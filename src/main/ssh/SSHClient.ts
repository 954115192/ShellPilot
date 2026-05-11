import { Client, SFTPWrapper, Channel } from 'ssh2';
import { EventEmitter } from 'events';
import * as fs from 'fs';

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

export class SSHClient extends EventEmitter {
  private client: Client;
  private sftp?: SFTPWrapper;
  private transferSftp?: SFTPWrapper; // 独立的传输通道
  private config: SSHConfig;
  private connected: boolean = false;
  private connectPromise: Promise<void> | null = null;
  private currentWorkingDir: string = '/';
  private workingDirs: Map<string, string> = new Map();
  private shellStreams: Map<string, Channel> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: SSHConfig) {
    super();
    this.config = config;
    this.client = new Client();
    this.client.on('error', (err: Error) => {
      this.connected = false;
      this.emit('error', err);
    });
  }

  async connect(): Promise<void> {
    // 如果正在连接中，返回现有 promise
    if (this.connectPromise) {
      return this.connectPromise;
    }

    const connectPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      let errorHandled = false;

      const safeResolve = (value?: void) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      const safeReject = (error: Error) => {
        if (!settled && !errorHandled) {
          settled = true;
          errorHandled = true;
          this.connected = false;
          this.connectPromise = null;
          console.log(`[SSHClient] Rejecting with error: ${error.message}`);
          reject(this.formatError(error));
        }
      };

      // 使用更短的超时时间用于快速失败
      const quickTimeout = 3000; // 3秒快速超时
      const normalTimeout = this.config.timeout || 10000;
      
      let timeoutTimer: NodeJS.Timeout;
      
      // 先设置一个快速超时，如果能连接上就清除
      timeoutTimer = setTimeout(() => {
        if (!settled) {
          console.log(`[SSHClient] Quick timeout reached for ${this.config.host}:${this.config.port}`);
          // 设置正常超时
          clearTimeout(timeoutTimer);
          timeoutTimer = setTimeout(() => {
            if (!settled) {
              safeReject(new Error(`连接超时 - ${this.config.host}:${this.config.port}`));
            }
          }, normalTimeout - quickTimeout);
        }
      }, quickTimeout);

      this.client.once('ready', () => {
        clearTimeout(timeoutTimer);
        this.connected = true;
        console.log(`[SSHClient] Connected successfully to ${this.config.host}:${this.config.port}`);
        safeResolve();
      });

      this.client.once('error', (err: Error) => {
        if (!errorHandled) {
          clearTimeout(timeoutTimer);
          console.log(`[SSHClient] Connection error event: ${err.message}`);
          safeReject(err);
        }
      });

      try {
        console.log(`[SSHClient] Calling client.connect() for ${this.config.host}:${this.config.port}...`);
        this.client.connect({
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          password: this.config.password,
          privateKey: this.config.privateKey,
          passphrase: this.config.passphrase,
          readyTimeout: quickTimeout, // 使用较短的 readyTimeout
          tryKeyboard: true,
          keepaliveInterval: 15000, // 每 15 秒发一次心跳
          keepaliveCountMax: 3,     // 3 次无响应才断开
        });
        console.log(`[SSHClient] client.connect() called successfully, waiting for events...`);
      } catch (err) {
        clearTimeout(timeoutTimer);
        errorHandled = true;
        console.log(`[SSHClient] client.connect() threw synchronous error: ${(err as Error).message}`);
        safeReject(err as Error);
      }
    }).finally(() => {
      this.connectPromise = null;
    });

    this.connectPromise = connectPromise;
    return connectPromise;
  }

  private formatError(err: Error): Error {
    const msg = err.message;
        if (msg.includes('ECONNREFUSED')) {
          return new Error(`无法连接到 ${this.config.host}:${this.config.port} - 连接被拒绝。请检查：1) SSH 服务是否运行 2) 主机地址和端口是否正确 3) 防火墙设置`);
        }
        if (msg.includes('ETIMEDOUT')) {
          return new Error(`连接超时 - ${this.config.host}:${this.config.port}。请检查网络连接和主机是否在线`);
        }
        if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
          return new Error(`无法找到主机: ${this.config.host}。请检查主机地址是否正确`);
        }
        if (msg.includes('ECONNRESET')) {
          return new Error(`连接被重置 - ${this.config.host}:${this.config.port}。可能原因：1) 服务器主动断开 2) 网络不稳定`);
        }
        if (msg.includes('Authentication failed')) {
          return new Error(`认证失败 - 用户名或密码错误。请检查凭据是否正确`);
        }
        if (msg.includes('No auth method')) {
          return new Error(`没有可用的认证方式 - 请提供密码或私钥`);
        }
        return err;
      }

      async executeCommand(command: string, sessionId?: string): Promise<string> {
        if (!this.connected) {
          throw new Error('SSH 未连接');
        }

        // 获取当前会话的工作目录
        const workingDir = sessionId ? this.getWorkingDir(sessionId) : this.currentWorkingDir;

        // 处理 cd 命令，更新工作目录
        const trimmedCmd = command.trim();
        if (trimmedCmd.startsWith('cd ')) {
          return this.handleCdCommand(trimmedCmd, sessionId);
        }

        // 其他命令在当前工作目录下执行
        return new Promise((resolve, reject) => {
          // 使用 bash -c 确保在正确的目录下执行
          const fullCommand = `cd "${workingDir}" && ${command}`;

          this.client.exec(fullCommand, (err: Error | undefined, stream: any) => {
            if (err) return reject(err);

            let output = '';
            let stderr = '';

            stream.on('data', (data: Buffer) => {
              output += data.toString();
            });

            stream.stderr.on('data', (data: Buffer) => {
              stderr += data.toString();
            });

            stream.on('close', (code: number) => {
              if (code !== 0) {
                reject(new Error(`命令执行失败 (退出码: ${code}): ${stderr || output}`));
              } else {
                resolve(output.trim());
              }
            });

            stream.on('error', reject);
          });
        });
      }

      // 处理 cd 命令
      private async handleCdCommand(cmd: string, sessionId?: string): Promise<string> {
        const targetDir = cmd.substring(3).trim();

        // 获取当前工作目录
        const currentDir = sessionId ? this.getWorkingDir(sessionId) : this.currentWorkingDir;

        // 处理特殊路径
        let resolvedPath: string;
        if (targetDir === '~' || targetDir === '') {
          // cd 或 cd ~ -> 回到用户主目录
          resolvedPath = await this.getUserHomeDir();
        } else if (targetDir === '..') {
          // cd .. -> 上一级目录
          const parts = currentDir.split('/').filter(Boolean);
          parts.pop();
          resolvedPath = '/' + parts.join('/');
          if (resolvedPath === '/') resolvedPath = '/';
        } else if (targetDir.startsWith('/')) {
          // 绝对路径
          resolvedPath = targetDir;
        } else {
          // 相对路径
          resolvedPath = currentDir === '/'
            ? '/' + targetDir
            : currentDir + '/' + targetDir;
        }

        // 验证目录是否存在
        try {
          const sftp = await this.getSFTP();
          await new Promise<void>((resolve, reject) => {
            sftp.stat(resolvedPath, (err: any) => {
              if (err) {
                reject(new Error(`cd: ${targetDir}: 没有那个文件或目录`));
              } else {
                resolve();
              }
            });
          });

          // 更新工作目录
          if (sessionId) {
            this.setWorkingDir(sessionId, resolvedPath);
          } else {
            this.currentWorkingDir = resolvedPath;
          }
          return '';
        } catch (error) {
          throw error;
        }
      }

      // 获取用户主目录
      private async getUserHomeDir(): Promise<string> {
        try {
          const result = await new Promise<string>((resolve, reject) => {
            this.client.exec('echo $HOME', (err: Error | undefined, stream: any) => {
              if (err) return reject(err);
              let output = '';
              stream.on('data', (data: Buffer) => output += data.toString());
              stream.on('close', () => resolve(output.trim()));
              stream.on('error', reject);
            });
          });
          return result || '/';
        } catch {
          return '/';
        }
      }

      async getSFTP(): Promise<SFTPWrapper> {
        if (!this.connected) {
          throw new Error('SSH 未连接');
        }

        return new Promise((resolve, reject) => {
          if (this.sftp) {
            resolve(this.sftp);
            return;
          }

          this.client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
            if (err) return reject(err);
            this.sftp = sftp;
            resolve(sftp);
          });
        });
      }

      // 获取独立的传输通道（不阻塞其他 SFTP 操作）
      private async getTransferSFTP(): Promise<SFTPWrapper> {
        if (!this.connected) {
          throw new Error('SSH 未连接');
        }

        // 每次创建新通道，避免复用异常通道
        return new Promise((resolve, reject) => {
          this.client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
            if (err) return reject(err);
            resolve(sftp);
          });
        });
      }

      // 取消传输
      cancelTransfer(transferId: string): void {
        const controller = this.abortControllers.get(transferId);
        if (controller) {
          controller.abort();
          this.abortControllers.delete(transferId);
        }
      }

      async listDirectory(path: string): Promise<FileInfo[]> {
        const sftp = await this.getSFTP();
        return new Promise((resolve, reject) => {
          sftp.readdir(path, (err: Error | undefined, list: any[]) => {
            if (err) return reject(err);
            resolve(list.map((item: any) => ({
              filename: item.filename,
              longname: item.longname,
              attrs: {
                size: item.attrs.size,
                mode: item.attrs.mode,
                isDirectory: (item.attrs.mode & 0o040000) !== 0,
                isFile: (item.attrs.mode & 0o100000) !== 0,
                mtime: item.attrs.mtime,
                atime: item.attrs.atime,
              }
            })));
          });
        });
      }

      async uploadFile(localPath: string, remotePath: string, onProgress?: (transferred: number, total: number) => void, transferId?: string): Promise<void> {
        const sftp = await this.getTransferSFTP(); // 每次新建独立通道
        return new Promise((resolve, reject) => {
          const options: any = {};
          let aborted = false;
          let settled = false;

          const safeReject = (err: Error) => {
            if (settled) return;
            settled = true;
            if (transferId) this.abortControllers.delete(transferId);
            sftp.end();
            reject(err);
          };

          const safeResolve = () => {
            if (settled) return;
            settled = true;
            if (transferId) this.abortControllers.delete(transferId);
            sftp.end();
            resolve();
          };

          // 注册取消控制器
          if (transferId) {
            const controller = new AbortController();
            this.abortControllers.set(transferId, controller);
            controller.signal.addEventListener('abort', () => {
              aborted = true;
              safeReject(new Error('传输已取消'));
            });
          }

          if (onProgress) {
            try {
              const stats = fs.statSync(localPath);
              const totalSize = stats.size;
              options.step = (transferred: number, chunk: any, totalBytes: number) => {
                if (aborted || settled) return;
                onProgress(transferred, totalBytes || totalSize);
              };
            } catch {}
          }

          sftp.fastPut(localPath, remotePath, options, (err: any) => {
            if (settled) return;
            if (aborted) {
              safeReject(new Error('传输已取消'));
            } else if (err) {
              safeReject(err);
            } else {
              safeResolve();
            }
          });
        });
      }

      async downloadFile(remotePath: string, localPath: string, onProgress?: (transferred: number, total: number) => void, transferId?: string): Promise<void> {
        const sftp = await this.getTransferSFTP(); // 每次新建独立通道
        return new Promise((resolve, reject) => {
          const options: any = {};
          let aborted = false;
          let settled = false;

          // 清理失败/取消的下载文件
          const cleanupPartialFile = () => {
            try {
              if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
              }
            } catch {}
          };

          // 安全完成（防止重复 resolve/reject）
          const safeReject = (err: Error) => {
            if (settled) return;
            settled = true;
            if (transferId) this.abortControllers.delete(transferId);
            sftp.end(); // 关闭本次传输通道
            cleanupPartialFile();
            reject(err);
          };

          const safeResolve = () => {
            if (settled) return;
            settled = true;
            if (transferId) this.abortControllers.delete(transferId);
            sftp.end(); // 关闭本次传输通道
            resolve();
          };

          // 注册取消控制器
          if (transferId) {
            const controller = new AbortController();
            this.abortControllers.set(transferId, controller);
            controller.signal.addEventListener('abort', () => {
              aborted = true;
              // 立即清理文件并拒绝
              safeReject(new Error('传输已取消'));
            });
          }

          const startDownload = () => {
            if (onProgress) {
              sftp.stat(remotePath, (err: any, stats: any) => {
                if (settled) return;
                if (!err && stats) {
                  const totalSize = stats.size;
                  options.step = (transferred: number, chunk: any, totalBytes: number) => {
                    if (aborted || settled) return;
                    onProgress(transferred, totalBytes || totalSize);
                  };
                }
                sftp.fastGet(remotePath, localPath, options, (err: any) => {
                  if (settled) return;
                  if (aborted) {
                    safeReject(new Error('传输已取消'));
                  } else if (err) {
                    safeReject(err);
                  } else {
                    safeResolve();
                  }
                });
              });
            } else {
              sftp.fastGet(remotePath, localPath, options, (err: any) => {
                if (settled) return;
                if (aborted) {
                  safeReject(new Error('传输已取消'));
                } else if (err) {
                  safeReject(err);
                } else {
                  safeResolve();
                }
              });
            }
          };

          startDownload();
        });
      }

      async deleteFile(remotePath: string): Promise<void> {
        const sftp = await this.getSFTP();
    return new Promise((resolve, reject) => {
      sftp.unlink(remotePath, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async deleteDirectory(remotePath: string): Promise<void> {
    await this.executeCommand(`rm -rf "${remotePath}"`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.sftp) {
      this.sftp.end();
      this.sftp = undefined;
    }
    if (this.client) {
      try {
        this.client.end();
      } catch (err) {
        // 忽略断开连接时的错误
      }
    }
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getWorkingDirectory(): string {
    return this.currentWorkingDir;
  }

  // 获取指定会话的工作目录
  getWorkingDir(sessionId: string): string {
    return this.workingDirs.get(sessionId) || this.currentWorkingDir;
  }

  // 设置指定会话的工作目录
  setWorkingDir(sessionId: string, dir: string): void {
    this.workingDirs.set(sessionId, dir);
  }

  getConfig(): SSHConfig {
    return this.config;
  }

  async createShellStream(
    tabId: string,
    onData: (data: string) => void,
    cols: number = 80,
    rows: number = 24
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('SSH 未连接');
    }

    const existingStream = this.shellStreams.get(tabId);
    if (existingStream) {
      existingStream.end();
      this.shellStreams.delete(tabId);
    }

    return new Promise((resolve, reject) => {
      this.client.shell({
        term: 'xterm-256color',
        cols,
        rows,
      }, (err, stream) => {
        if (err) return reject(err);

        this.shellStreams.set(tabId, stream);

        stream.on('data', (data: Buffer) => {
          onData(data.toString());
        });

        stream.on('close', () => {
          this.shellStreams.delete(tabId);
          this.emit('shell-close', tabId);
        });

        stream.on('error', (err: Error) => {
          this.shellStreams.delete(tabId);
          this.emit('shell-error', tabId, err);
        });

        resolve();
      });
    });
  }

  writeToShell(tabId: string, data: string): void {
    const stream = this.shellStreams.get(tabId);
    if (!stream) {
      throw new Error(`Shell stream not found for tabId: ${tabId}`);
    }
    stream.write(data);
  }

  resizeShell(tabId: string, cols: number, rows: number): void {
    const stream = this.shellStreams.get(tabId);
    if (!stream) return;
    stream.setWindow(rows, cols, 0, 0);
  }

  closeShellStream(tabId: string): void {
    const stream = this.shellStreams.get(tabId);
    if (stream) {
      stream.end();
      this.shellStreams.delete(tabId);
    }
  }

  hasShellStream(tabId: string): boolean {
    return this.shellStreams.has(tabId);
  }
}