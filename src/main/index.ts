import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import { registerIPCHandlers, cleanupConnections, setMainWindow } from './ipc/handlers';
import { shortcutsManager } from './ShortcutsManager';

process.on('uncaughtException', (error) => {
  console.error('[Main Process] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

let mainWindow: BrowserWindow | null = null;
const editorWindows: Map<string, BrowserWindow> = new Map();
let sharedEditorWindow: BrowserWindow | null = null;
let sharedEditorReady = false;
let pendingEditorFiles: Array<{ path: string; tabId: string }> = [];

function createEditorWindow(filePath: string, tabId: string, isDark: boolean, mode: string = 'window'): BrowserWindow {
  const fileName = filePath.split('/').pop() || filePath;
  const editorWin = new BrowserWindow({
    width: 900,
    height: 700,
    title: `${fileName} - ShellPilot Editor`,
    backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
    show: false,
    icon: app.isPackaged
      ? path.join(__dirname, '../renderer/icon.png')
      : path.join(__dirname, '../../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  editorWin.once('ready-to-show', () => editorWin.show());

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const query = `?editor=1&path=${encodeURIComponent(filePath)}&tabId=${encodeURIComponent(tabId)}&dark=${isDark ? '1' : '0'}&mode=${mode}`;

  if (isDev) {
    const port = process.env.VITE_PORT || 15173;
    editorWin.loadURL(`http://localhost:${port}/${query}`);
    editorWin.webContents.openDevTools();
  } else {
    editorWin.loadFile('dist/renderer/index.html', { search: query });
  }

  editorWin.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      if (editorWin.webContents.isDevToolsOpened()) {
        editorWin.webContents.closeDevTools();
      } else {
        editorWin.webContents.openDevTools();
      }
    }
  });

  return editorWin;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1e1e1e',
    frame: false,
    show: false,
    icon: app.isPackaged
      ? path.join(__dirname, '../renderer/icon.png')
      : path.join(__dirname, '../../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  // Pass main window reference to IPCRegistry for precise event delivery
  setMainWindow(mainWindow);
  shortcutsManager.setMainWindow(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    const port = process.env.VITE_PORT || 15173;
    const url = `http://localhost:${port}`;
    console.log(`Loading from ${url}...`);

    let loadAttempts = 0;
    const maxAttempts = 10;

    const tryLoad = () => {
      loadAttempts++;
      console.log(`Attempt ${loadAttempts}/${maxAttempts} to load ${url}...`);
      if (!mainWindow) return;

      mainWindow.loadURL(url).catch((err) => {
        console.error(`Load failed: ${err.message}`);
        if (loadAttempts < maxAttempts) {
          setTimeout(tryLoad, 1000);
        } else {
          console.error('Failed to load after maximum attempts');
        }
      });
    };

    setTimeout(tryLoad, 2000);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile('dist/renderer/index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  registerIPCHandlers();
  shortcutsManager.registerAll();

  ipcMain.handle('app:hello', async () => {
    return { message: 'ShellPilot running!' };
  });

  ipcMain.handle('app:get-version', async () => {
    return app.getVersion();
  });

  ipcMain.on('editor:ready', () => {
    sharedEditorReady = true;
    if (sharedEditorWindow && !sharedEditorWindow.isDestroyed()) {
      for (const file of pendingEditorFiles) {
        sharedEditorWindow.webContents.send('editor:open-file', file);
      }
      pendingEditorFiles = [];
    }
  });

  ipcMain.handle('editor:open', async (_event, filePath: string, fileName: string, tabId: string, isDark: boolean, mode: string = 'window') => {
    if (mode === 'tab') {
      if (sharedEditorWindow && !sharedEditorWindow.isDestroyed()) {
        if (sharedEditorReady) {
          sharedEditorWindow.webContents.send('editor:open-file', { path: filePath, tabId });
        } else {
          pendingEditorFiles.push({ path: filePath, tabId });
        }
        sharedEditorWindow.focus();
        return { success: true };
      }
      sharedEditorReady = false;
      pendingEditorFiles = [];
      sharedEditorWindow = createEditorWindow(filePath, tabId, isDark, 'tab');
      sharedEditorWindow.on('closed', () => {
        sharedEditorWindow = null;
        sharedEditorReady = false;
        pendingEditorFiles = [];
      });
      return { success: true };
    }

    const windowKey = `${tabId}:${filePath}`;
    if (editorWindows.has(windowKey)) {
      const win = editorWindows.get(windowKey)!;
      if (!win.isDestroyed()) { win.focus(); return { success: true }; }
      editorWindows.delete(windowKey);
    }
    const editorWin = createEditorWindow(filePath, tabId, isDark, 'window');
    editorWindows.set(windowKey, editorWin);
    editorWin.on('closed', () => editorWindows.delete(windowKey));
    return { success: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
shortcutsManager.unregisterAll();
    await cleanupConnections();
});
