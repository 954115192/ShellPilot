import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPCRegistry } from './IPCRegistry'
import { AIBridge, AIConfig } from '../ai/AIBridge'

const ipcRegistry = new IPCRegistry()
const aiBridge = new AIBridge()

// 注册所有 IPC handlers
export function registerIPCHandlers(): void {
  // 会话管理
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

  // SSH 连接
  ipcMain.handle('connect-ssh', async (event, config, tabId) => {
    try {
        console.log('[IPC Handler] connect-ssh called with tabId:', tabId)
      return await ipcRegistry.connectSSH(config, tabId)
    } catch (error) {
      console.error('[IPC Handler] connect-ssh error:', error)
      return { success: false, message: '连接失败：' + (error as Error).message }
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

  ipcMain.handle('disconnect-ssh', async (event, tabId) => {
    try {
      await ipcRegistry.disconnectSSH(tabId)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] disconnect-ssh error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 文件操作
  ipcMain.handle('upload-file', async (event, filePath, remotePath, tabId, transferId) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      await ipcRegistry.uploadFile(filePath, remotePath, tabId, (transferred, total) => {
        if (win) {
          win.webContents.send('transfer-progress', { tabId, type: 'upload', transferred, total })
        }
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
        if (win) {
          win.webContents.send('transfer-progress', { tabId, type: 'download', transferred, total })
        }
      }, transferId)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] download-file error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 取消传输
  ipcMain.handle('cancel-transfer', async (event, tabId, transferId) => {
    try {
      ipcRegistry.cancelTransfer(tabId, transferId)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] cancel-transfer error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('create-directory', async (event, remotePath, tabId) => {
    try {
      await ipcRegistry.createDirectory(remotePath, tabId)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] create-directory error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('list-directory', async (event, path, tabId) => {
    try {
      const files = await ipcRegistry.listDirectory(path, tabId)
      return { success: true, files }
    } catch (error) {
      console.error('[IPC Handler] list-directory error:', error)
      return { success: false, error: (error as Error).message, files: [] }
    }
  })

  // 获取工作目录
  ipcMain.handle('get-working-directory', async (event, tabId) => {
    try {
      const dir = ipcRegistry.getWorkingDirectory(tabId)
      return { success: true, directory: dir }
    } catch (error) {
      console.error('[IPC Handler] get-working-directory error:', error)
      return { success: false, error: (error as Error).message, directory: '/' }
    }
  })

  // 性能监控
  ipcMain.handle('get-system-stats', async (event, tabId) => {
    try {
      const stats = await ipcRegistry.getSystemStats(tabId)
      return { success: true, stats }
    } catch (error) {
      console.error('[IPC Handler] get-system-stats error:', error)
      return { success: false, error: (error as Error).message, stats: null }
    }
  })

  ipcMain.handle('start-stats-monitor', async (event, tabId) => {
    try {
      await ipcRegistry.startStatsMonitor(() => {}, tabId)
      return { started: true }
    } catch (error) {
      console.error('[IPC Handler] start-stats-monitor error:', error)
      return { started: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('stop-stats-monitor', async () => {
    try {
      await ipcRegistry.stopStatsMonitor()
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] stop-stats-monitor error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Shell stream 支持
  ipcMain.handle('create-shell-stream', async (event, tabId, cols, rows) => {
    try {
      await ipcRegistry.createShellStream(tabId, cols, rows)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] create-shell-stream error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('write-to-shell', async (event, tabId, data) => {
    try {
      ipcRegistry.writeToShell(tabId, data)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] write-to-shell error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('resize-shell', async (event, tabId, cols, rows) => {
    try {
      ipcRegistry.resizeShell(tabId, cols, rows)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] resize-shell error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('close-shell-stream', async (event, tabId) => {
    try {
      ipcRegistry.closeShellStream(tabId)
      return { success: true }
    } catch (error) {
      console.error('[IPC Handler] close-shell-stream error:', error)
      return { success: false, error: (error as Error).message }
    }
  })
  // 文件对话框
  ipcMain.handle('select-save-dialog', async (event, options: { defaultName?: string }) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: options?.defaultName,
      filters: [{ name: 'All Files', extensions: ['*'] }]
    })
    return result
  })

  ipcMain.handle('select-open-dialog', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: 'All Files', extensions: ['*'] }]
    })
    return result
  })

  // 用本地程序打开文件
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

  // 获取本地文件大小
  ipcMain.handle('get-file-size', async (event, filePath: string) => {
    try {
      const fs = require('fs')
      const stats = fs.statSync(filePath)
      return { success: true, size: stats.size }
    } catch (error) {
      return { success: false, size: 0 }
    }
  })

  // ========== AI 相关 ==========

  // 配置 AI
  ipcMain.handle('ai:configure', async (event, config: AIConfig) => {
    try {
      aiBridge.configure(config)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 获取 AI 配置
  ipcMain.handle('ai:get-config', async () => {
    return aiBridge.getConfig()
  })

  // 测试 AI 连接
  ipcMain.handle('ai:test-connection', async (event, config: AIConfig) => {
    return aiBridge.testConnection(config)
  })

  // 智能问答
  ipcMain.handle('ai:ask', async (event, tabId: string, question: string, context: any, history: any[]) => {
    try {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
      if (!win) throw new Error('无窗口')

      // 设置当前 tab 的 SSH Client
      const client = ipcRegistry.getSSHClient(tabId)
      if (client) aiBridge.setSSHClient(tabId, client)

      await aiBridge.askQuestion(tabId, question, context, history, win)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 智能体执行
  ipcMain.handle('ai:agent', async (event, tabId: string, message: string, context: any, history: any[]) => {
    try {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
      if (!win) throw new Error('无窗口')

      const client = ipcRegistry.getSSHClient(tabId)
      if (client) aiBridge.setSSHClient(tabId, client)

      await aiBridge.runAgent(tabId, message, context, history, win)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 用户确认命令
  ipcMain.handle('ai:confirm', async (event, tabId: string, confirmed: boolean) => {
    try {
      await aiBridge.confirmCommand(tabId, confirmed)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 确认继续执行（步数超限后）
  ipcMain.handle('ai:continue', async (event, tabId: string, confirmed: boolean) => {
    try {
      await aiBridge.confirmContinue(tabId, confirmed)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // 取消执行
  ipcMain.handle('ai:cancel', async (event, tabId: string) => {
    aiBridge.cancel(tabId)
    return { success: true }
  })

  // 窗口控制
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
}

// 清理所有连接
export async function cleanupConnections(): Promise<void> {
  ipcRegistry.closeAllSessions()
}