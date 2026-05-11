import { SSHClient } from '../ssh/SSHClient';

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
    rxSpeed: number;
    txSpeed: number;
    interface: string;
  };
  uptime: number;
  hostname: string;
}

export class StatsCollector {
  private ssh: SSHClient;
  private lastNetworkStats = { rxBytes: 0, txBytes: 0, timestamp: 0 };
  private cachedIface: string = '';

  constructor(ssh: SSHClient) {
    this.ssh = ssh;
  }

  async collect(): Promise<ServerStats> {
    try {
      // 获取基础信息（合并命令减少往返）
      const basicCmd = `echo "CORES:$(nproc)" && echo "LOAD:$(cat /proc/loadavg | awk '{print $1,$2,$3}')" && echo "MEM:$(free -b | awk '/Mem:/{print $2,$3,$4}')" && echo "DISK:$(df -B1 / | tail -1 | awk '{print $2,$3,$4,$5,$6}')" && echo "UPTIME:$(cat /proc/uptime | awk '{print $1}')" && echo "HOST:$(hostname)"`;

      const output = await this.ssh.executeCommand(basicCmd);

      const getVal = (key: string): string => {
        const match = output.match(new RegExp(`${key}:([^\\n]+)`));
        return match ? match[1].trim() : '';
      };

      const cores = parseInt(getVal('CORES')) || 1;
      const loadParts = getVal('LOAD').split(' ');
      const loadAverage = loadParts.map(v => parseFloat(v) || 0);

      // CPU 使用率用 /proc/stat 计算（更可靠）
      const cpuUsage = await this.getCpuUsage();

      const memParts = getVal('MEM').split(' ');
      const memTotal = parseInt(memParts[0]) || 0;
      const memUsed = parseInt(memParts[1]) || 0;
      const memFree = parseInt(memParts[2]) || 0;
      const memUsage = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0;

      const diskParts = getVal('DISK').split(' ');
      const diskTotal = parseInt(diskParts[0]) || 0;
      const diskUsed = parseInt(diskParts[1]) || 0;
      const diskFree = parseInt(diskParts[2]) || 0;
      const diskUsage = parseInt(diskParts[3]?.replace('%', '')) || 0;
      const diskPath = diskParts[4] || '/';

      const uptime = parseFloat(getVal('UPTIME')) || 0;
      const hostname = getVal('HOST') || 'unknown';

      // 单独获取网络数据
      const network = await this.getNetworkStats();

      return {
        cpu: { usage: cpuUsage, loadAverage, cores },
        memory: { total: memTotal, used: memUsed, free: memFree, usage: memUsage },
        disk: [{ path: diskPath, total: diskTotal, used: diskUsed, free: diskFree, usage: diskUsage }],
        network,
        uptime,
        hostname,
      };
    } catch (error) {
      console.error('[StatsCollector] Failed to collect stats:', error);
      return this.getEmptyStats();
    }
  }

  private async getCpuUsage(): Promise<number> {
    try {
      // 使用 /proc/stat 计算 CPU 使用率
      const stat1 = await this.ssh.executeCommand('cat /proc/stat | grep "^cpu "');
      await new Promise(resolve => setTimeout(resolve, 100));
      const stat2 = await this.ssh.executeCommand('cat /proc/stat | grep "^cpu "');

      const parse = (line: string) => {
        const parts = line.split(/\s+/).slice(1).map(Number);
        const idle = parts[3] + (parts[4] || 0);
        const total = parts.reduce((a, b) => a + b, 0);
        return { idle, total };
      };

      const cpu1 = parse(stat1);
      const cpu2 = parse(stat2);

      const idleDiff = cpu2.idle - cpu1.idle;
      const totalDiff = cpu2.total - cpu1.total;

      return totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;
    } catch {
      return 0;
    }
  }

  async getNetworkStats(): Promise<{ rxBytes: number; txBytes: number; rxSpeed: number; txSpeed: number; interface: string }> {
    try {
      // 获取网络接口名（缓存）
      if (!this.cachedIface) {
        const ifaceOutput = await this.ssh.executeCommand("ip route show default 2>/dev/null | awk '{print $5}' | head -1");
        this.cachedIface = ifaceOutput.trim() || 'eth0';
      }

      // 获取收发字节数
      const netCmd = `cat /proc/net/dev | grep "${this.cachedIface}" | awk '{print $2, $10}'`;
      const netOutput = await this.ssh.executeCommand(netCmd);
      const parts = netOutput.trim().split(/\s+/);

      const rxBytes = parseInt(parts[0]) || 0;
      const txBytes = parseInt(parts[1]) || 0;

      // 计算速度
      const now = Date.now();
      let rxSpeed = 0;
      let txSpeed = 0;

      if (this.lastNetworkStats.timestamp > 0 && rxBytes >= this.lastNetworkStats.rxBytes) {
        const timeDiff = (now - this.lastNetworkStats.timestamp) / 1000;
        if (timeDiff > 0) {
          rxSpeed = Math.round((rxBytes - this.lastNetworkStats.rxBytes) / timeDiff);
          txSpeed = Math.round((txBytes - this.lastNetworkStats.txBytes) / timeDiff);
        }
      }

      this.lastNetworkStats = { rxBytes, txBytes, timestamp: now };

      return {
        rxBytes,
        txBytes,
        rxSpeed: Math.max(0, rxSpeed),
        txSpeed: Math.max(0, txSpeed),
        interface: this.cachedIface,
      };
    } catch (error) {
      console.error('[StatsCollector] Failed to get network stats:', error);
      return { rxBytes: 0, txBytes: 0, rxSpeed: 0, txSpeed: 0, interface: 'unknown' };
    }
  }

  private getEmptyStats(): ServerStats {
    return {
      cpu: { usage: 0, loadAverage: [0, 0, 0], cores: 1 },
      memory: { total: 0, used: 0, free: 0, usage: 0 },
      disk: [{ path: '/', total: 0, used: 0, free: 0, usage: 0 }],
      network: { rxBytes: 0, txBytes: 0, rxSpeed: 0, txSpeed: 0, interface: 'N/A' },
      uptime: 0,
      hostname: 'unknown',
    };
  }
}
