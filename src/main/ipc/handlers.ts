import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPCRegistry } from './IPCRegistry'
import { AIBridge, AIConfig } from '../ai/AIBridge'

const ipcRegistry = new IPCRegistry()
const aiBridge = new AIBridge()

/** Set main window reference (called by index.ts after window creation) */
export function setMainWindow(win: BrowserWindow): void {
  ipcRegistry.setMainWindow(win)
}

/** Get IPCRegistry instance */
export function getIPCRegistry(): IPCRegistry {
  return ipcRegistry
}

export function registerIPCHandlers(): void {
  // Session management
  ipcMain.handle('create-session', async (event, config) => {
    try {
      return await ipcRegistry.createSession(config)
    } catch (error) {
      console.error('[IPC Handler] create-session error:', error)
      return { success: false, message: (error as Error).message }
    }
  })

  ipcMain.handle('get-session', async (event, id) => {
    return ipcRegistry.getSession(id)
  })

  ipcMain.handle('list-sessions', async () => {
    return ipcRegistry.listSessions()
  })

  ipcMain.handle('get-saved-sessions', async () => {
    try {
      return ipcRegistry.getSavedSessions()
    } catch (error) {
      console.error('[IPC Handler] get-saved-sessions error:', error)
      return []
    }
  })

  ipcMain.handle('save-session', async (event, config) => {
    try {
      ipcRegistry.saveSession(config)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] save-session error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('update-saved-session', async (event, id, data) => {
    try {
      ipcRegistry.updateSavedSession(id, data)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] update-saved-session error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('delete-saved-session', async (event, id) => {
    try {
      ipcRegistry.deleteSavedSession(id)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] delete-saved-session error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('close-all-sessions', async () => {
    ipcRegistry.closeAllSessions()
    return { success: true }
  })

  // SSH connection
  ipcMain.handle('connect-ssh', async (event, config, tabId) => {
    try {
      return await ipcRegistry.connectSSH(config, tabId)
    } catch (error) {
      console.error('[IPC Handler] connect-ssh error:', error)
      return { success: false, message: 'Connection failed: ' + (error as Error).message }
    }
  })

  ipcMain.handle('get-saved-session-decrypted', async (event, id) => {
    try {
      return ipcRegistry.getSavedSessionDecrypted(id)
    } catch (error) {
      return null
    }
  })

  ipcMain.handle('execute-command', async (event, command, tabId) => {
    try {
      return await ipcRegistry.executeCommand(command, tabId)
    } catch (error) {
      console.error('[IPC Handler] execute-command error:', error)
      return { success: false, output: '', error: (error as Error).message }
    }
  })

  ipcMain.handle('file:read-content', async (event, tabId, remotePath) => {
    try {
      return await ipcRegistry.readFileContent(tabId, remotePath)
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('file:write-content', async (event, tabId, remotePath, content) => {
    try {
      return await ipcRegistry.writeFileContent(tabId, remotePath, content)
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('disconnect-ssh', async (event, tabId) => {
    try {
      await ipcRegistry.disconnectSSH(tabId)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] disconnect-ssh error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // File operations
  ipcMain.handle('upload-file', async (event, filePath, remotePath, tabId, transferId) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      await ipcRegistry.uploadFile(filePath, remotePath, tabId, (transferred, total) => {
        if (win) win.webContents.send('transfer-progress', { tabId, type: 'upload', transferred, total, transferId })
      }, transferId)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] upload-file error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('download-file', async (event, remotePath, filePath, tabId, transferId) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      await ipcRegistry.downloadFile(remotePath, filePath, tabId, (transferred, total) => {
        if (win) win.webContents.send('transfer-progress', { tabId, type: 'download', transferred, total, transferId })
      }, transferId)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] download-file error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('download-directory', async (event, remotePath, localPath, tabId, transferId) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const abortSignal = ipcRegistry.registerAbortSignal(tabId, transferId)
      await ipcRegistry.downloadDirectory(remotePath, localPath, tabId, {
        onStart: (totalFiles: number, totalSize: number) => {
          win?.webContents.send('transfer-start', { tabId, transferId, totalFiles, totalSize })
        },
        onProgress: (transferred: number, total: number, fileName: string, fileIndex: number, totalFiles: number) => {
          win?.webContents.send('transfer-progress', { tabId, transferId, type: 'download', transferred, total, fileName, fileIndex, totalFiles })
        },
      }, abortSignal as any)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] download-directory error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('list-directory', async (event, path, tabId) => {
    try {
      const files = await ipcRegistry.listDirectory(path, tabId)
      return { success: true, files }
    } catch (error) {
      console.error('[IPC Handler] list-directory error:', error)
      return { success: false, files: [], error: (error as Error).message }
    }
  })

  ipcMain.handle('cancel-transfer', async (event, tabId, transferId) => {
    try {
      ipcRegistry.cancelTransfer(tabId, transferId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('create-directory', async (event, remotePath, tabId) => {
    try {
      await ipcRegistry.createDirectory(remotePath, tabId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('get-working-directory', async (event, tabId) => {
    return ipcRegistry.getWorkingDirectory(tabId)
  })

  // System stats
  ipcMain.handle('get-system-stats', async (event, tabId) => {
    try {
      return await ipcRegistry.getSystemStats(tabId)
    } catch (error) {
      console.error('[IPC Handler] get-system-stats error:', error)
      return { cpu: { usage: 0, loadAverage: [0, 0, 0], cores: 1 }, memory: { total: 0, used: 0, free: 0, usage: 0 }, disk: [], network: { rxBytes: 0, txBytes: 0, rxSpeed: 0, txSpeed: 0, interface: 'N/A' }, uptime: 0, hostname: 'unknown' }
    }
  })

  ipcMain.handle('start-stats-monitor', async (event, tabId) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      await ipcRegistry.startStatsMonitor((stats) => {
        if (win) win.webContents.send('stats-update', stats)
      }, tabId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('stop-stats-monitor', async () => {
    await ipcRegistry.stopStatsMonitor()
    return { success: true }
  })

  // File dialogs
  ipcMain.handle('select-save-dialog', async (event, options: { defaultName?: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: options?.defaultName,
      filters: [{ name: 'All Files', extensions: ['*'] }]
    })
    return result
  })

  ipcMain.handle('select-open-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile', 'openDirectory', 'multiSelections'],
      filters: [{ name: 'All Files', extensions: ['*'] }]
    })
    return result
  })

  ipcMain.handle('select-directory-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
    })
    return result
  })

  ipcMain.handle('open-file-with-system', async (event, filePath: string) => {
    try {
      const { shell } = require('electron')
      await shell.openPath(filePath)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] open-file-with-system error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('read-directory-tree', async (event, dirPath: string) => {
    const fs = require('fs')
    const path = require('path')
    try {
      const result: { localPath: string; relativePath: string; size: number }[] = []
      const walk = (local: string, rel: string) => {
        const stat = fs.statSync(local)
        if (stat.isDirectory()) {
          const entries = fs.readdirSync(local)
          for (const entry of entries) {
            walk(path.join(local, entry), rel ? rel + '/' + entry : entry)
          }
        } else if (stat.isFile()) {
          result.push({ localPath: local, relativePath: rel, size: stat.size })
        }
      }
      console.log("[read-directory-tree] Starting walk:", dirPath);
walk(dirPath, '')
      
console.log("[read-directory-tree] Found files:", result.length, result.map(f => f.relativePath));
return { success: true, files: result }
    } catch (error) {
      console.error('[IPC Handler] read-directory-tree error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('get-file-size', async (event, filePath: string) => {
    try {
      const fs = require('fs')
      console.log("[get-file-size] Checking:", filePath);
      const stats = fs.statSync(filePath)
      if (stats.isDirectory()) return { success: false, size: 0 }
      return { success: true, size: stats.size }
    } catch (error) {
      return { success: false, size: 0 }
    }
  })

  // AI
  ipcMain.handle('ai:configure', async (event, config: AIConfig) => {
    try {
      aiBridge.configure(config)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('ai:get-config', async () => {
    return aiBridge.getConfig()
  })

  ipcMain.handle('ai:test-connection', async (event, config: AIConfig) => {
    return aiBridge.testConnection(config)
  })

  ipcMain.handle('ai:ask', async (event, tabId: string, question: string, context: any, history: any[]) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow()
      if (!win) throw new Error('No window')

      const client = ipcRegistry.getSSHClient(tabId)
      if (client) aiBridge.setSSHClient(tabId, client)

      await aiBridge.askQuestion(tabId, question, context, history, win)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('ai:agent', async (event, tabId: string, message: string, context: any, history: any[]) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow()
      if (!win) throw new Error('No window')

      const client = ipcRegistry.getSSHClient(tabId)
      if (client) aiBridge.setSSHClient(tabId, client)

      await aiBridge.runAgent(tabId, message, context, history, win)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('ai:confirm', async (event, tabId: string, confirmed: boolean) => {
    try {
      await aiBridge.confirmCommand(tabId, confirmed)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('ai:continue', async (event, tabId: string, confirmed: boolean) => {
    try {
      await aiBridge.confirmContinue(tabId, confirmed)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('ai:cancel', async (event, tabId: string) => {
    aiBridge.cancel(tabId)
    return { success: true }
  })

  // Window controls
  ipcMain.handle('window:minimize', async () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })

  ipcMain.handle('window:maximize', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      win.isMaximized() ? win.unmaximize() : win.maximize()
    }
  })

  ipcMain.handle('window:close', async () => {
    BrowserWindow.getFocusedWindow()?.close()
  })

  ipcMain.handle('window:is-maximized', async () => {
    return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false
  })

  // Shell stream
  ipcMain.handle('create-shell-stream', async (event, tabId, cols, rows) => {
    try {
      await ipcRegistry.createShellStream(tabId, cols, rows)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('write-to-shell', async (event, tabId, data) => {
    try {
      ipcRegistry.writeToShell(tabId, data)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('resize-shell', async (event, tabId, cols, rows) => {
    try {
      ipcRegistry.resizeShell(tabId, cols, rows)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('close-shell-stream', async (event, tabId) => {
    try {
      ipcRegistry.closeShellStream(tabId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}


  // Group management
  ipcMain.handle('get-groups', async () => {
    return ipcRegistry.getGroups()
  })

  ipcMain.handle('create-group', async (event, name: string) => {
    try {
      return ipcRegistry.createGroup(name)
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('update-group', async (event, id: string, data: { name?: string; order?: number }) => {
    try {
      ipcRegistry.updateGroup(id, data)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('delete-group', async (event, id: string) => {
    try {
      ipcRegistry.deleteGroup(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })


  // SSH config import
  ipcMain.handle('import-ssh-config', async () => {
    try {
      const { parseSSHConfig } = require('../session/SSHConfigParser')
      return parseSSHConfig()
    } catch (error) {
      console.error('[IPC Handler] import-ssh-config error:', error)
      return []
    }
  })


  ipcMain.handle('upload-directory', async (event, localDir, remoteDir, tabId, transferId) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const abortSignal = ipcRegistry.registerAbortSignal(tabId, transferId)
      await ipcRegistry.uploadDirectory(localDir, remoteDir, tabId, {
        onStart: (totalFiles: number, totalSize: number) => {
          win?.webContents.send('transfer-start', { tabId, transferId, totalFiles, totalSize })
        },
        onProgress: (transferred: number, total: number, fileName: string, fileIndex: number, totalFiles: number) => {
          win?.webContents.send('transfer-progress', { tabId, transferId, type: 'upload', transferred, total, fileName, fileIndex, totalFiles })
        },
      }, abortSignal as any)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] upload-directory error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

export async function cleanupConnections(): Promise<void> {
  ipcRegistry.closeAllSessions()
}
