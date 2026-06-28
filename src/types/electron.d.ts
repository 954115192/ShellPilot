// Electron API 类型声明
import type { SSHConfig, FileInfo, ServerStats, SessionInfo, CommandResult, ConnectionResult } from '../preload/index'

declare global {
  interface Window {
    electronAPI: {
      connectSSH: (config: SSHConfig, tabId: string) => Promise<ConnectionResult>;
      disconnectSSH: (tabId: string) => Promise<{ success: boolean }>;
      executeCommand: (command: string, tabId: string) => Promise<CommandResult>;
      getWorkingDirectory: (tabId: string) => Promise<{ success: boolean; directory: string; error?: string }>;
      uploadFile: (filePath: string, remotePath: string, tabId: string, transferId?: string) => Promise<{ success: boolean }>;
      downloadFile: (remotePath: string, filePath: string, tabId: string, transferId?: string) => Promise<{ success: boolean }>;
      downloadDirectory: (remotePath: string, localPath: string, tabId: string, transferId: string) => Promise<{ success: boolean; error?: string }>;
      createDirectory: (remotePath: string, tabId: string) => Promise<{ success: boolean }>;
      listDirectory: (path: string, tabId: string) => Promise<{ success: boolean; files: FileInfo[]; error?: string }>;
      readFileContent: (tabId: string, remotePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeFileContent: (tabId: string, remotePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      openEditorWindow: (filePath: string, fileName: string, tabId: string, isDark: boolean, mode?: string) => Promise<{ success: boolean }>;
      onOpenFile: (callback: (data: { path: string; tabId: string }) => void) => void;
      editorReady: () => void;
      createSession: (config: SSHConfig) => Promise<SessionInfo>;
      getSession: (id: string) => Promise<SessionInfo | undefined>;
      listSessions: () => Promise<SessionInfo[]>;
      getSavedSessions: () => Promise<any[]>;
      getSavedSessionDecrypted: (id: string) => Promise<any>;
      saveSession: (config: { name: string; remark?: string; host: string; port: number; username: string; password?: string }) => Promise<{ success: boolean }>;
      updateSavedSession: (id: string, data: { name: string; remark?: string; host: string; port: number; username: string; password?: string }) => Promise<{ success: boolean }>;
      deleteSavedSession: (id: string) => Promise<{ success: boolean }>;
      importSSHConfig: () => Promise<any[]>;
      getGroups: () => Promise<any[]>;
      createGroup: (name: string) => Promise<any>;
      updateGroup: (id: string, data: { name?: string; order?: number }) => Promise<{ success: boolean }>;
      deleteGroup: (id: string) => Promise<{ success: boolean }>;
      closeAllSessions: () => Promise<{ success: boolean }>;
      getSystemStats: (tabId: string) => Promise<{ success: boolean; stats: ServerStats | null; error?: string }>;
      startStatsMonitor: (tabId: string) => Promise<{ started: boolean }>;
      stopStatsMonitor: () => Promise<{ stopped: boolean }>;
      openFile: (filePath: string) => Promise<void>;
      openFileWithSystem: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      getFileSize: (filePath: string) => Promise<{ success: boolean; size: number }>;
      cancelTransfer: (tabId: string, transferId: string) => Promise<{ success: boolean }>;
      showSaveDialog: (options?: { defaultName?: string }) => Promise<{ canceled: boolean; filePath?: string }>;
      showOpenDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
      showDirectoryDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;

      createShellStream: (tabId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
      writeToShell: (tabId: string, data: string) => Promise<{ success: boolean; error?: string }>;
      resizeShell: (tabId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
      closeShellStream: (tabId: string) => Promise<{ success: boolean; error?: string }>;

      onShellData: (callback: (tabId: string, data: string) => void) => void;
      onShellClose: (callback: (tabId: string) => void) => void;
      onSSHError: (callback: (tabId: string, error: string) => void) => void;
      onSSHDisconnected: (callback: (tabId: string) => void) => void;
      onTransferProgress: (callback: (data: { tabId: string, type: string, transferred: number, total: number }) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;

      // AI 相关
      aiConfigure: (config: { baseUrl: string; apiKey: string; model: string }) => Promise<{ success: boolean; error?: string }>;
      aiGetConfig: () => Promise<{ baseUrl: string; apiKey: string; model: string } | null>;
      aiTestConnection: (config: { baseUrl: string; apiKey: string; model: string }) => Promise<{ success: boolean; message: string }>;
      aiAsk: (tabId: string, question: string, context: any, history: any[]) => Promise<{ success: boolean; error?: string }>;
      aiAgent: (tabId: string, message: string, context: any, history: any[]) => Promise<{ success: boolean; error?: string }>;
      aiConfirm: (tabId: string, confirmed: boolean) => Promise<{ success: boolean }>;
      aiContinue: (tabId: string, confirmed: boolean) => Promise<{ success: boolean }>;
      aiCancel: (tabId: string) => Promise<{ success: boolean }>;
      onAIEvent: (callback: (data: { tabId: string; event: any }) => void) => void;

      // 窗口控制
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
      windowIsMaximized: () => Promise<boolean>;
    }
  }
}

export {};

