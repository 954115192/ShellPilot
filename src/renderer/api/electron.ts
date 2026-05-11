// 渲染进程统一使用 window.electronAPI（通过 contextBridge 暴露）
// 不再使用 nodeIntegration，所有 IPC 调用通过 preload 脚本

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

export const electronAPI = window.electronAPI;

export default electronAPI;