import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import { registerIPCHandlers, cleanupConnections } from './ipc/handlers';

process.on('uncaughtException', (error) => {
  console.error('[Main Process] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1e1e1e',
    frame: false,
    show: false,  // 内容加载完再显示，避免黑屏闪烁
    icon: app.isPackaged
      ? path.join(__dirname, '../renderer/icon.png')
      : path.join(__dirname, '../../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  // 内容加载完成后显示窗口
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 开发模式加载本地服务器，生产模式加载本地文件
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    // 从环境变量获取端口，默认为 5173
    const port = process.env.VITE_PORT || 5173;
    const url = `http://localhost:${port}`;

    console.log(`Loading from ${url}...`);

    // 添加加载失败重试机制
    let loadAttempts = 0;
    const maxAttempts = 10;

    const tryLoad = () => {
      loadAttempts++;
      console.log(`Attempt ${loadAttempts}/${maxAttempts} to load ${url}...`);

      if (!mainWindow) return;

      mainWindow.loadURL(url).catch((err) => {
        console.error(`Load failed: ${err.message}`);
        if (loadAttempts < maxAttempts) {
          setTimeout(tryLoad, 1000); // 1秒后重试
        } else {
          console.error('Failed to load after maximum attempts');
        }
      });
    };

    // 延迟一下再加载，给 Vite 一些启动时间
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
  // 移除默认菜单栏（File/Edit/View/Help）
  Menu.setApplicationMenu(null)

  // 注册所有 IPC handlers
  registerIPCHandlers();

  // 注册一些基础 IPC handlers
  ipcMain.handle('app:hello', async () => {
    return { message: 'ShellPilot 运行中！' };
  });

  ipcMain.handle('app:get-version', async () => {
    return app.getVersion();
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

// 应用退出前清理所有连接
app.on('before-quit', async () => {
  await cleanupConnections();
});
