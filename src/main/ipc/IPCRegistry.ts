import { SessionManager } from '../session/SessionManager'
import { Session, SessionConfig } from '../session/Session'
import { SSHClient, SSHConfig } from '../ssh/SSHClient'
import { StatsCollector } from '../stats/StatsCollector'
import { StatsMonitor } from '../stats/StatsMonitor'

export class IPCRegistry {
  private sessionManager: SessionManager
  private currentSession: Session | null = null
  private sshClients: Map<string, SSHClient> = new Map()  // 使用 Map 存储多个连接，key 为 tabId
  private statsMonitor: StatsMonitor
  private statsCollectors: Map<string, StatsCollector> = new Map()  // 缓存 collector，保留上次网络数据

  constructor() {
    this.sessionManager = new SessionManager()
    this.statsMonitor = new StatsMonitor()
  }

  // 会话管理
  async createSession(config: SessionConfig): Promise<Session> {
    const session = await this.sessionManager.createSession(config)
    this.currentSession = session
    return session
  }

  getSession(id: string): Session | undefined {
    return this.sessionManager.getSession(id)
  }

  listSessions(): Session[] {
    return this.sessionManager.listSessions()
  }

  getSavedSessions(): any[] {
    return this.sessionManager.getSavedSessions()
  }

  saveSession(config: { name: string; remark?: string; host: string; port: number; username: string; password?: string }): void {
    this.sessionManager.saveSessionToHistory(config)
  }

  updateSavedSession(id: string, data: { name: string; remark?: string; host: string; port: number; username: string; password?: string }): void {
    this.sessionManager.updateSavedSession(id, data)
  }

  deleteSavedSession(id: string): void {
    this.sessionManager.deleteSavedSession(id)
  }

  closeAllSessions(): void {
    this.sessionManager.closeAll()
    this.currentSession = null
    // 断开所有 SSH 连接
    this.sshClients.forEach(client => client.disconnect())
    this.sshClients.clear()
  }

  // SSH 连接 - 每个标签页独立连接
  async connectSSH(config: SSHConfig, tabId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[IPCRegistry] Attempting to connect to SSH:', {
        host: config.host,
        port: config.port,
        username: config.username,
        tabId: tabId
      });

      // 如果该 tabId 已有连接，先断开
      const existingClient = this.sshClients.get(tabId);
      if (existingClient) {
        console.log('[IPCRegistry] Disconnecting existing SSH client for tabId:', tabId);
        await existingClient.disconnect();
        this.sshClients.delete(tabId);
      }

      const client = new SSHClient(config);
      await client.connect();
      this.sshClients.set(tabId, client);

      // 监听 SSH 级别的错误和断开事件
      const { BrowserWindow } = require('electron');
      client.on('error', (err: Error) => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          win.webContents.send('ssh-error', tabId, err.message);
        }
      });

      client.on('disconnected', () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          win.webContents.send('ssh-disconnected', tabId);
        }
      });

      console.log('[IPCRegistry] SSH connected successfully for tabId:', tabId);
      return { success: true, message: 'SSH 连接成功' };
    } catch (error) {
      console.error('[IPCRegistry] SSH connection failed:', error);
      
      // 提供更友好的错误信息
      let errorMessage = '连接失败';
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('ECONNREFUSED') || msg.includes('连接被拒绝')) {
          errorMessage = `无法连接到 ${config.host}:${config.port}\n\n可能原因：\n1. SSH 服务器未启动\n2. 主机地址或端口错误\n3. 防火墙阻止了连接`;
        } else if (msg.includes('ETIMEDOUT') || msg.includes('连接超时')) {
          errorMessage = `连接超时\n\n请检查：\n1. 网络连接是否正常\n2. 主机地址是否正确\n3. 服务器是否在线`;
        } else if (msg.includes('ENOTFOUND') || msg.includes('无法找到主机')) {
          errorMessage = `无法找到主机: ${config.host}\n\n请检查主机地址是否正确`;
        } else if (msg.includes('ECONNRESET') || msg.includes('连接被重置')) {
          errorMessage = `连接被重置\n\n可能原因：\n1. 服务器主动断开连接\n2. 网络不稳定`;
        } else {
          errorMessage = msg;
        }
      }
      
      return { success: false, message: errorMessage };
    }
  }

  async executeCommand(command: string, tabId: string): Promise<{ success: boolean; output: string; error?: string }> {
    const client = this.sshClients.get(tabId);
    if (!client) {
      return { success: false, output: '', error: '未连接 SSH' }
    }

    try {
      const output = await client.executeCommand(command)
      return { success: true, output }
    } catch (error) {
      return { success: false, output: '', error: (error as Error).message }
    }
  }

  async disconnectSSH(tabId: string): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (client) {
      await client.disconnect()
      this.sshClients.delete(tabId)
      this.statsCollectors.delete(tabId)
      console.log('[IPCRegistry] Disconnected SSH for tabId:', tabId);
    }
  }

  // 文件操作
  async uploadFile(filePath: string, remotePath: string, tabId: string, onProgress?: (transferred: number, total: number) => void, transferId?: string): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) {
      throw new Error('未连接 SSH')
    }
    await client.uploadFile(filePath, remotePath, onProgress, transferId)
  }

  async downloadFile(remotePath: string, filePath: string, tabId: string, onProgress?: (transferred: number, total: number) => void, transferId?: string): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) {
      throw new Error('未连接 SSH')
    }
    await client.downloadFile(remotePath, filePath, onProgress, transferId)
  }

  // 取消传输
  cancelTransfer(tabId: string, transferId: string): void {
    const client = this.sshClients.get(tabId);
    if (client) {
      client.cancelTransfer(transferId)
    }
  }

  async createDirectory(remotePath: string, tabId: string): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) {
      throw new Error('未连接 SSH')
    }
    await client.executeCommand(`mkdir -p "${remotePath}"`)
  }

  // 获取当前工作目录
  getWorkingDirectory(tabId: string): string {
    const client = this.sshClients.get(tabId);
    if (!client) {
      return '/';
    }
    return client.getWorkingDirectory();
  }

  async listDirectory(path: string, tabId: string): Promise<any[]> {
    console.log('[IPCRegistry] listDirectory called with path:', path, 'tabId:', tabId);
    
    const client = this.sshClients.get(tabId);
    if (!client) {
      console.error('[IPCRegistry] No SSH client connected for tabId:', tabId);
      throw new Error('未连接 SSH')
    }
    
    try {
      console.log('[IPCRegistry] Calling sshClient.listDirectory...');
      const result = await client.listDirectory(path);
      console.log('[IPCRegistry] listDirectory success, files:', result.length);
      return result;
    } catch (error) {
      console.error('[IPCRegistry] listDirectory failed:', error);
      throw error;
    }
  }

  // 性能监控 - 使用远程服务器统计
  async getSystemStats(tabId: string): Promise<any> {
    const client = this.sshClients.get(tabId);
    if (!client) {
      throw new Error('未连接 SSH')
    }
    // 复用同一个 collector，保留 lastNetworkStats 以计算速度
    let collector = this.statsCollectors.get(tabId)
    if (!collector) {
      collector = new StatsCollector(client)
      this.statsCollectors.set(tabId, collector)
    }
    return collector.collect()
  }

  async startStatsMonitor(callback: (stats: any) => void, tabId: string): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) {
      throw new Error('未连接 SSH')
    }
    await this.statsMonitor.start(callback, client)
  }

  async stopStatsMonitor(): Promise<void> {
    await this.statsMonitor.stop()
  }

  // Shell stream 支持
  async createShellStream(tabId: string, cols: number, rows: number): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) {
      throw new Error('未连接 SSH')
    }
    return new Promise((resolve, reject) => {
      client.createShellStream(
        tabId,
        (data: string) => {
          // 通过 Electron main 进程发送数据到渲染进程
          const { BrowserWindow } = require('electron');
          const win = BrowserWindow.getAllWindows()[0];
          if (win) {
            win.webContents.send('shell-data', tabId, data);
          }
        },
        cols,
        rows
      ).then(resolve).catch(reject);
    });
  }

  writeToShell(tabId: string, data: string): void {
    const client = this.sshClients.get(tabId);
    if (!client) {
      throw new Error('未连接 SSH')
    }
    client.writeToShell(tabId, data);
  }

  resizeShell(tabId: string, cols: number, rows: number): void {
    const client = this.sshClients.get(tabId);
    if (!client) return;
    client.resizeShell(tabId, cols, rows);
  }

  closeShellStream(tabId: string): void {
    const client = this.sshClients.get(tabId);
    if (!client) return;
    client.closeShellStream(tabId);
  }

  // 获取 SSH Client（供 AI 模块使用）
  getSSHClient(tabId: string): SSHClient | undefined {
    return this.sshClients.get(tabId)
  }
}