import { contextBridge, ipcRenderer } from 'electron'

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  timeout?: number;
}

export interface FileInfo {
  filename: string;
  longname: string;
  attrs: {
    size: number;
    mode: number;
    isDirectory: boolean;
    isFile: boolean;
    mtime: number;
    atime: number;
  };
}

export interface ServerStats {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: Array<{
    path: string;
    total: number;
    used: number;
    free: number;
    usage: number;
  }>;
  network: {
    rxBytes: number;
    txBytes: number;
    interface: string;
  };
  uptime: number;
  hostname: string;
}

export interface SessionInfo {
  id: string;
  host: string;
  username: string;
  connected: boolean;
}

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ConnectionResult {
  success: boolean;
  message: string;
}

// 编辑器窗口：立即监听新文件 IPC（不等 Vue 挂载）
const _pendingEditorFiles: Array<{ path: string; tabId: string }> = [];
let _editorFileCallback: ((data: { path: string; tabId: string }) => void) | null = null;
ipcRenderer.on('editor:open-file', (_event, data) => {
  if (!data || !data.path) return;
  if (_editorFileCallback) {
    _editorFileCallback(data);
  } else {
    _pendingEditorFiles.push(data);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  connectSSH: (config: SSHConfig, tabId: string) => ipcRenderer.invoke('connect-ssh', config, tabId),
  disconnectSSH: (tabId: string) => ipcRenderer.invoke('disconnect-ssh', tabId),
  executeCommand: (command: string, tabId: string) => ipcRenderer.invoke('execute-command', command, tabId),
  getWorkingDirectory: (tabId: string) => ipcRenderer.invoke('get-working-directory', tabId),
  uploadFile: (filePath: string, remotePath: string, tabId: string, transferId?: string) => ipcRenderer.invoke('upload-file', filePath, remotePath, tabId, transferId),
  downloadFile: (remotePath: string, filePath: string, tabId: string, transferId?: string) => ipcRenderer.invoke('download-file', remotePath, filePath, tabId, transferId),
  createDirectory: (remotePath: string, tabId: string) => ipcRenderer.invoke('create-directory', remotePath, tabId),
  listDirectory: (path: string, tabId: string) => ipcRenderer.invoke('list-directory', path, tabId),
  readFileContent: (tabId: string, remotePath: string) => ipcRenderer.invoke('file:read-content', tabId, remotePath),
  writeFileContent: (tabId: string, remotePath: string, content: string) => ipcRenderer.invoke('file:write-content', tabId, remotePath, content),
  openEditorWindow: (filePath: string, fileName: string, tabId: string, isDark: boolean, mode?: string) => ipcRenderer.invoke('editor:open', filePath, fileName, tabId, isDark, mode),
  onOpenFile: (callback: (data: { path: string; tabId: string }) => void) => {
    _editorFileCallback = callback;
    for (const f of _pendingEditorFiles) callback(f);
    _pendingEditorFiles.length = 0;
  },
  editorReady: () => ipcRenderer.send('editor:ready'),
  createSession: (config: SSHConfig) => ipcRenderer.invoke('create-session', config),
  getSession: (id: string) => ipcRenderer.invoke('get-session', id),
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  getSavedSessions: () => ipcRenderer.invoke('get-saved-sessions'),
  saveSession: (config: { name: string; remark?: string; host: string; port: number; username: string }) => ipcRenderer.invoke('save-session', config),
  updateSavedSession: (id: string, data: { name: string; remark?: string; host: string; port: number; username: string }) => ipcRenderer.invoke('update-saved-session', id, data),
  deleteSavedSession: (id: string) => ipcRenderer.invoke('delete-saved-session', id),
  closeAllSessions: () => ipcRenderer.invoke('close-all-sessions'),
  getSystemStats: (tabId: string) => ipcRenderer.invoke('get-system-stats', tabId),
  startStatsMonitor: (tabId: string) => ipcRenderer.invoke('start-stats-monitor', tabId),
  stopStatsMonitor: () => ipcRenderer.invoke('stop-stats-monitor'),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  openFileWithSystem: (filePath: string) => ipcRenderer.invoke('open-file-with-system', filePath),
  getFileSize: (filePath: string) => ipcRenderer.invoke('get-file-size', filePath),
  cancelTransfer: (tabId: string, transferId: string) => ipcRenderer.invoke('cancel-transfer', tabId, transferId),
  showSaveDialog: (options?: { defaultName?: string }) => ipcRenderer.invoke('select-save-dialog', options),
  showOpenDialog: () => ipcRenderer.invoke('select-open-dialog'),

  createShellStream: (tabId: string, cols: number, rows: number) => ipcRenderer.invoke('create-shell-stream', tabId, cols, rows),
  writeToShell: (tabId: string, data: string) => ipcRenderer.invoke('write-to-shell', tabId, data),
  resizeShell: (tabId: string, cols: number, rows: number) => ipcRenderer.invoke('resize-shell', tabId, cols, rows),
  closeShellStream: (tabId: string) => ipcRenderer.invoke('close-shell-stream', tabId),

  onShellData: (callback: (tabId: string, data: string) => void) => {
    ipcRenderer.on('shell-data', (_event, tabId: string, data: string) => callback(tabId, data));
  },
  onShellClose: (callback: (tabId: string) => void) => {
    ipcRenderer.on('shell-close', (_event, tabId: string) => callback(tabId));
  },
  onSSHError: (callback: (tabId: string, error: string) => void) => {
    ipcRenderer.on('ssh-error', (_event, tabId: string, error: string) => callback(tabId, error));
  },
  onSSHDisconnected: (callback: (tabId: string) => void) => {
    ipcRenderer.on('ssh-disconnected', (_event, tabId: string) => callback(tabId));
  },
  onTransferProgress: (callback: (data: { tabId: string, type: string, transferred: number, total: number }) => void) => {
    ipcRenderer.on('transfer-progress', (_event, data) => callback(data));
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },

  // AI 相关
  aiConfigure: (config: { baseUrl: string; apiKey: string; model: string }) => ipcRenderer.invoke('ai:configure', config),
  aiGetConfig: () => ipcRenderer.invoke('ai:get-config'),
  aiTestConnection: (config: { baseUrl: string; apiKey: string; model: string }) => ipcRenderer.invoke('ai:test-connection', config),
  aiAsk: (tabId: string, question: string, context: any, history: any[]) => ipcRenderer.invoke('ai:ask', tabId, question, context, history),
  aiAgent: (tabId: string, message: string, context: any, history: any[]) => ipcRenderer.invoke('ai:agent', tabId, message, context, history),
  aiConfirm: (tabId: string, confirmed: boolean) => ipcRenderer.invoke('ai:confirm', tabId, confirmed),
  aiContinue: (tabId: string, confirmed: boolean) => ipcRenderer.invoke('ai:continue', tabId, confirmed),
  aiCancel: (tabId: string) => ipcRenderer.invoke('ai:cancel', tabId),
  onAIEvent: (callback: (data: { tabId: string; event: any }) => void) => {
    ipcRenderer.on('ai:event', (_event, data) => callback(data));
  },

  // 窗口控制
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),
})