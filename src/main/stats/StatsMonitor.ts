import { StatsCollector } from './StatsCollector';
import { SSHClient } from '../ssh/SSHClient';

export class StatsMonitor {
  private collector: StatsCollector | null = null;
  private interval: number;
  private listeners: ((stats: any) => void)[];
  private timerId: NodeJS.Timeout | null = null;
  private sshClient: SSHClient | null = null;

  constructor(interval: number = 5000) {
    this.interval = interval;
    this.listeners = [];
  }

  addListener(callback: (stats: any) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (stats: any) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  async start(callback: (stats: any) => void, sshClient: SSHClient | null): Promise<void> {
    this.sshClient = sshClient;
    this.listeners = [callback];

    if (!sshClient) {
      throw new Error('SSH client not connected');
    }

    this.collector = new StatsCollector(sshClient);

    // 立即执行一次
    const stats = await this.collector.collect();
    this.listeners.forEach((cb) => cb(stats));

    // 停止之前的定时器
    if (this.timerId) {
      clearInterval(this.timerId);
    }

    // 启动定时器
    this.timerId = setInterval(async () => {
      if (this.collector && this.sshClient) {
        const stats = await this.collector.collect();
        this.listeners.forEach((cb) => cb(stats));
      }
    }, this.interval);
  }

  async stop(): Promise<void> {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.collector = null;
    this.sshClient = null;
    this.listeners = [];
  }

  isRunning(): boolean {
    return this.timerId !== null;
  }
}