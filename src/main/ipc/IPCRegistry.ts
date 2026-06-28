import { BrowserWindow } from 'electron'
import { SessionManager } from '../session/SessionManager'
import { Session, SessionConfig } from '../session/Session'
import { SSHClient, SSHConfig } from '../ssh/SSHClient'
import { StatsCollector } from '../stats/StatsCollector'
import { StatsMonitor } from '../stats/StatsMonitor'

export class IPCRegistry {
  private sessionManager: SessionManager
  private currentSession: Session | null = null
  private sshClients: Map<string, SSHClient> = new Map()
  private statsMonitor: StatsMonitor
  private statsCollectors: Map<string, StatsCollector> = new Map()
  private mainWindow: BrowserWindow | null = null

  constructor() {
    this.sessionManager = new SessionManager()
    this.statsMonitor = new StatsMonitor()
  }

  /** Set main window reference for precise event delivery */
  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win
  }

  /** Get main window, preferring saved reference */
  private getMainWindow(): BrowserWindow | null {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow
    }
    return BrowserWindow.getAllWindows()[0] || null
  }

  /** Send event to renderer via main window */
  sendToRenderer(channel: string, ...args: any[]) {
    const win = this.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }

  // Session management
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

  getSavedSessionsDecrypted(): any[] {
    return this.sessionManager.getSavedSessionsDecrypted()
  }

  getSavedSessionDecrypted(id: string): any {
    return this.sessionManager.getSavedSessionDecrypted(id)
  }

  saveSession(config: { name: string; remark?: string; host: string; port: number; username: string; password?: string; authType?: string; keyId?: string; groupId?: string }): void {
    this.sessionManager.saveSessionToHistory(config)
  }

  updateSavedSession(id: string, data: { name: string; remark?: string; host: string; port: number; username: string; password?: string; authType?: string; keyId?: string; groupId?: string }): void {
    this.sessionManager.updateSavedSession(id, data)
  }

  deleteSavedSession(id: string): void {
    this.sessionManager.deleteSavedSession(id)
  }

  closeAllSessions(): void {
    this.sessionManager.closeAll()
    this.currentSession = null
    this.sshClients.forEach(client => client.disconnect())
    this.sshClients.clear()
  }

  // SSH connection - per-tab independent connection
  async connectSSH(config: SSHConfig, tabId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[IPCRegistry] Attempting to connect to SSH:', {
        host: config.host, port: config.port, username: config.username, tabId
      });

      const existingClient = this.sshClients.get(tabId);
      if (existingClient) {
        console.log('[IPCRegistry] Disconnecting existing SSH client for tabId:', tabId);
        await existingClient.disconnect();
        this.sshClients.delete(tabId);
      }

      const client = new SSHClient(config);
      await client.connect();
      this.sshClients.set(tabId, client);

      client.on('error', (err: Error) => {
        this.sendToRenderer('ssh-error', tabId, err.message);
      });

      client.on('disconnected', () => {
        this.sendToRenderer('ssh-disconnected', tabId);
      });

      console.log('[IPCRegistry] SSH connected successfully for tabId:', tabId);
      return { success: true, message: 'SSH connected' };
    } catch (error) {
      console.error('[IPCRegistry] SSH connection failed:', error);
      let errorMessage = 'Connection failed';
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('ECONNREFUSED') || msg.includes('Connection refused')) {
          errorMessage = `Cannot connect to ${config.host}:${config.port}\n\nPossible causes:\n1. SSH server not running\n2. Wrong host/port\n3. Firewall blocking`;
        } else if (msg.includes('ETIMEDOUT') || msg.includes('timed out')) {
          errorMessage = `Connection timed out\n\nPlease check:\n1. Network connectivity\n2. Host address\n3. Server status`;
        } else if (msg.includes('ENOTFOUND')) {
          errorMessage = `Host not found: ${config.host}`;
        } else if (msg.includes('ECONNRESET')) {
          errorMessage = `Connection reset\n\nPossible causes:\n1. Server dropped connection\n2. Unstable network`;
        } else {
          errorMessage = msg;
        }
      }
      return { success: false, message: errorMessage };
    }
  }

  async disconnectSSH(tabId: string): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (client) {
      await client.disconnect();
      this.sshClients.delete(tabId);
    }
    this.statsCollectors.delete(tabId);
  }

  async executeCommand(command: string, tabId: string): Promise<{ success: boolean; output: string; error?: string }> {
    const client = this.sshClients.get(tabId);
    if (!client) return { success: false, output: '', error: 'SSH not connected' }
    try {
      const output = await client.executeCommand(command);
      return { success: true, output: output || '' };
    } catch (error) {
      return { success: false, output: '', error: (error as Error).message };
    }
  }

  async listDirectory(path: string, tabId: string): Promise<any[]> {
    const client = this.sshClients.get(tabId);
    if (!client) throw new Error('SSH not connected')
    return client.listDirectory(path);
  }

  async uploadFile(filePath: string, remotePath: string, tabId: string, onProgress: (transferred: number, total: number) => void, transferId?: string): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) throw new Error('SSH not connected')
    await client.uploadFile(filePath, remotePath, onProgress, transferId)
  }

  async uploadDirectory(localDir: string, remoteDir: string, tabId: string, callbacks?: { onStart?: (totalFiles: number, totalSize: number) => void; onProgress?: (transferred: number, total: number, fileName: string, fileIndex: number, totalFiles: number) => void }, abortSignal?: AbortSignal): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) throw new Error('SSH not connected')
    await client.uploadDirectory(localDir, remoteDir, callbacks, abortSignal)
  }

  async downloadFile(remotePath: string, filePath: string, tabId: string, onProgress: (transferred: number, total: number) => void, transferId?: string): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) throw new Error('SSH not connected')
    await client.downloadFile(remotePath, filePath, onProgress, transferId)
  }

  async downloadDirectory(remotePath: string, localPath: string, tabId: string, callbacks?: any, abortSignal?: AbortSignal): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) throw new Error('SSH not connected')
    await client.downloadDirectory(remotePath, localPath, callbacks, abortSignal)
  }

  cancelTransfer(tabId: string, transferId: string): void {
    const client = this.sshClients.get(tabId);
    if (client) client.cancelTransfer(transferId)
  }

  registerAbortSignal(tabId: string, transferId: string): { aborted: boolean } | null {
    const client = this.sshClients.get(tabId);
    if (!client) return null;
    return client.registerAbortSignal(transferId)
  }

  async createDirectory(remotePath: string, tabId: string): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) throw new Error('SSH not connected')
    await client.executeCommand(`mkdir -p "${remotePath}"`)
  }

  getWorkingDirectory(tabId: string): string {
    const client = this.sshClients.get(tabId);
    if (!client) return '/';
    return client.getWorkingDirectory();
  }

  async readFileContent(tabId: string, remotePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    const client = this.sshClients.get(tabId);
    if (!client) return { success: false, error: 'SSH not connected' }
    try {
      const content = await client.readFile(remotePath)
      return { success: true, content }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async writeFileContent(tabId: string, remotePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    const client = this.sshClients.get(tabId);
    if (!client) return { success: false, error: 'SSH not connected' }
    try {
      await client.writeFile(remotePath, content)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async getSystemStats(tabId: string): Promise<any> {
    const client = this.sshClients.get(tabId);
    if (!client) throw new Error('SSH not connected')
    let collector = this.statsCollectors.get(tabId)
    if (!collector) {
      collector = new StatsCollector(client)
      this.statsCollectors.set(tabId, collector)
    }
    return collector.collect()
  }

  async startStatsMonitor(callback: (stats: any) => void, tabId: string): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) throw new Error('SSH not connected')
    await this.statsMonitor.start(callback, client)
  }

  async stopStatsMonitor(): Promise<void> {
    await this.statsMonitor.stop()
  }

  async createShellStream(tabId: string, cols: number, rows: number): Promise<void> {
    const client = this.sshClients.get(tabId);
    if (!client) throw new Error('SSH not connected')
    return new Promise((resolve, reject) => {
      client.createShellStream(
        tabId,
        (data: string) => {
          this.sendToRenderer('shell-data', tabId, data);
        },
        cols,
        rows
      ).then(resolve).catch(reject);
    });
  }

  writeToShell(tabId: string, data: string): void {
    const client = this.sshClients.get(tabId);
    if (!client) throw new Error('SSH not connected')
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

  getSSHClient(tabId: string): SSHClient | undefined {
    return this.sshClients.get(tabId)
  }
  // --- Group management ---
  getGroups() { return this.sessionManager.getGroups() }
  createGroup(name: string) { return this.sessionManager.createGroup(name) }
  updateGroup(id: string, data: { name?: string; order?: number }) { this.sessionManager.updateGroup(id, data) }
  deleteGroup(id: string) { this.sessionManager.deleteGroup(id) }
}
