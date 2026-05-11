import { SSHClient, SSHConfig } from '../ssh/SSHClient';
import { EventEmitter } from 'events';

export interface SessionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  timeout?: number;
}

export class Session extends EventEmitter {
  public id: string;
  public config: SessionConfig;
  private sshClient: SSHClient | null = null;
  private connected: boolean = false;

  constructor(config: SessionConfig) {
    super();
    this.id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const sshConfig: SSHConfig = {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
      privateKey: this.config.privateKey,
      passphrase: this.config.passphrase,
      timeout: this.config.timeout || 10000,
    };

    this.sshClient = new SSHClient(sshConfig);

    // Forward events
    this.sshClient.on('ready', () => {
      this.connected = true;
      this.emit('connected');
    });

    this.sshClient.on('error', (err) => {
      this.emit('error', err);
    });

    this.sshClient.on('close', () => {
      this.connected = false;
      this.emit('disconnected');
    });

    await this.sshClient.connect();
  }

  async executeCommand(command: string): Promise<string> {
    if (!this.sshClient || !this.connected) {
      throw new Error('Session not connected');
    }
    return this.sshClient.executeCommand(command, this.id);
  }

  async listDirectory(path: string): Promise<any[]> {
    if (!this.sshClient || !this.connected) {
      throw new Error('Session not connected');
    }
    return this.sshClient.listDirectory(path);
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    if (!this.sshClient || !this.connected) {
      throw new Error('Session not connected');
    }
    return this.sshClient.uploadFile(localPath, remotePath);
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    if (!this.sshClient || !this.connected) {
      throw new Error('Session not connected');
    }
    return this.sshClient.downloadFile(remotePath, localPath);
  }

  async disconnect(): Promise<void> {
    if (!this.sshClient) {
      return;
    }
    await this.sshClient.disconnect();
    this.connected = false;
    this.sshClient = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getInfo(): { id: string; host: string; username: string; connected: boolean } {
    return {
      id: this.id,
      host: this.config.host,
      username: this.config.username,
      connected: this.connected,
    };
  }

  getWorkingDirectory(): string {
    if (this.sshClient) {
      return this.sshClient.getWorkingDir(this.id);
    }
    return '/';
  }
}