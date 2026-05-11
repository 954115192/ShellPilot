<template>
  <div class="stats-view" v-loading="loading" element-loading-text="获取数据中...">
    <el-card class="stats-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">系统性能监控</span>
          <div class="header-actions">
            <el-tag v-if="isConnected" type="success" size="small">
              <el-icon><Link /></el-icon>
              已连接
            </el-tag>
            <el-tag v-else type="info" size="small">
              <el-icon><SwitchButton /></el-icon>
              未连接
            </el-tag>
            <el-button class="close-btn" circle size="small" type="danger" plain @click="$emit('close')" title="关闭">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
      </template>

      <div class="stats-grid">
        <!-- CPU -->
        <div class="stat-item">
          <div ref="cpuChartRef" class="chart-container"></div>
          <div class="stat-detail">
            <p>负载: {{ stats.cpu.loadAverage.join(', ') }}</p>
            <p>核心数: {{ stats.cpu.cores }}</p>
          </div>
        </div>

        <!-- 内存 -->
        <div class="stat-item">
          <div ref="memChartRef" class="chart-container"></div>
          <div class="stat-detail">
            <p>总计: {{ formatSize(stats.memory.total) }}</p>
            <p>已用: {{ formatSize(stats.memory.used) }}</p>
            <p>可用: {{ formatSize(stats.memory.free) }}</p>
          </div>
        </div>

        <!-- 磁盘 -->
        <div class="stat-item" v-for="(disk, index) in stats.disk" :key="index">
          <div :ref="(el) => setDiskChartRef(el, index)" class="chart-container"></div>
          <div class="stat-detail">
            <p>{{ disk.path }}</p>
            <p>总计: {{ formatSize(disk.total) }}</p>
            <p>已用: {{ formatSize(disk.used) }}</p>
            <p>可用: {{ formatSize(disk.free) }}</p>
          </div>
        </div>

        <!-- 网络 -->
        <div class="stat-item network-item">
          <div class="network-header">
            <el-icon class="stat-icon" color="#9B59B6" :size="20"><Connection /></el-icon>
            <span class="stat-title">网络 {{ stats.network.interface }}</span>
          </div>
          <div class="network-speed">
            <div class="speed-row">
              <span class="speed-label">↓ 接收</span>
              <span class="speed-value rx">{{ formatSpeed(stats.network.rxSpeed) }}</span>
            </div>
            <div class="speed-row">
              <span class="speed-label">↑ 发送</span>
              <span class="speed-value tx">{{ formatSpeed(stats.network.txSpeed) }}</span>
            </div>
          </div>
          <div ref="networkChartRef" class="network-chart-container"></div>
          <div class="stat-detail">
            <p>累计接收: {{ formatSize(stats.network.rxBytes) }}</p>
            <p>累计发送: {{ formatSize(stats.network.txBytes) }}</p>
          </div>
        </div>
      </div>

      <div v-if="stats.uptime" class="system-info">
        <el-divider />
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="主机名">{{ stats.hostname || 'N/A' }}</el-descriptions-item>
          <el-descriptions-item label="运行时间">{{ formatUptime(stats.uptime) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ lastUpdateTime }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import { Connection, Link, SwitchButton, Close } from '@element-plus/icons-vue';
import { getActiveTabId } from '../stores/terminalStore';

const props = defineProps<{
  tabId?: string
}>()

const emit = defineEmits<{
  close: []
}>()

interface Stats {
  cpu: { usage: number; loadAverage: number[]; cores: number };
  memory: { total: number; used: number; free: number; usage: number };
  disk: Array<{ path: string; total: number; used: number; free: number; usage: number }>;
  network: { rxBytes: number; txBytes: number; rxSpeed: number; txSpeed: number; interface: string };
  uptime: number;
  hostname: string;
}

const isConnected = ref(false);
const loading = ref(false);
const stats = ref<Stats>({
  cpu: { usage: 0, loadAverage: [0, 0, 0], cores: 1 },
  memory: { total: 0, used: 0, free: 0, usage: 0 },
  disk: [{ path: '/', total: 0, used: 0, free: 0, usage: 0 }],
  network: { rxBytes: 0, txBytes: 0, rxSpeed: 0, txSpeed: 0, interface: 'N/A' },
  uptime: 0,
  hostname: 'N/A',
});
const lastUpdateTime = ref('-');

// 图表引用
const cpuChartRef = ref<HTMLElement | null>(null);
const memChartRef = ref<HTMLElement | null>(null);
const diskChartRefs = ref<Map<number, HTMLElement>>(new Map());
const networkChartRef = ref<HTMLElement | null>(null);

// 图表实例
let cpuChart: echarts.ECharts | null = null;
let memChart: echarts.ECharts | null = null;
const diskCharts = new Map<number, echarts.ECharts>();
let networkChart: echarts.ECharts | null = null;

// 网络速度历史
const rxSpeedHistory = ref<number[]>([]);
const txSpeedHistory = ref<number[]>([]);
const timeLabels = ref<string[]>([]);
const maxHistoryPoints = 30;

let statsInterval: number | null = null;

// 前端计算网络速度（不依赖主进程的 speed 字段）
let prevRxBytes = 0;
let prevTxBytes = 0;
let prevNetTimestamp = 0;

const setDiskChartRef = (el: any, index: number) => {
  if (el) {
    diskChartRefs.value.set(index, el);
  }
};

const getTabId = (): string => {
  if (props.tabId) return props.tabId;
  return getActiveTabId();
};

const formatSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

const formatSpeed = (bytesPerSec: number): string => {
  if (!bytesPerSec || bytesPerSec === 0) return '0 B/s';
  if (bytesPerSec < 1024) return bytesPerSec + ' B/s';
  if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
  return (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
};

const formatUptime = (seconds: number): string => {
  if (!seconds) return '-';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}天 ${hours}小时 ${minutes}分`;
};

// 创建仪表盘图表选项
function createGaugeOption(title: string, value: number, color: string): echarts.EChartsOption {
  return {
    series: [{
      type: 'gauge',
      startAngle: 220,
      endAngle: -40,
      min: 0,
      max: 100,
      pointer: { show: false },
      progress: {
        show: true,
        overlap: false,
        roundCap: true,
        clip: false,
        itemStyle: {
          color: color,
        },
      },
      axisLine: {
        roundCap: true,
        lineStyle: {
          width: 10,
          color: [[1, '#E6EBF8']],
        },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: {
        show: true,
        offsetCenter: [0, '30%'],
        fontSize: 14,
        color: '#666',
      },
      detail: {
        offsetCenter: [0, '-10%'],
        fontSize: 28,
        fontWeight: 'bold',
        formatter: '{value}%',
        color: color,
      },
      data: [{
        value: value,
        name: title,
      }],
    }],
  };
}

// 创建网络速度图表选项
function createNetworkOption(): echarts.EChartsOption {
  return {
    grid: {
      top: 10,
      right: 10,
      bottom: 30,
      left: 50,
    },
    xAxis: {
      type: 'category',
      data: timeLabels.value,
      axisLabel: {
        fontSize: 10,
        color: '#999',
      },
      axisLine: { lineStyle: { color: '#E6EBF8' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 10,
        color: '#999',
        formatter: (val: number) => {
          if (val < 1024) return val + ' B';
          if (val < 1024 * 1024) return (val / 1024).toFixed(0) + ' K';
          return (val / (1024 * 1024)).toFixed(1) + ' M';
        },
      },
      splitLine: { lineStyle: { color: '#F0F0F0' } },
    },
    series: [
      {
        name: '接收',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#67C23A', width: 1.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103, 194, 58, 0.2)' },
            { offset: 1, color: 'rgba(103, 194, 58, 0.02)' },
          ]),
        },
        data: rxSpeedHistory.value,
      },
      {
        name: '发送',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#E6A23C', width: 1.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(230, 162, 60, 0.2)' },
            { offset: 1, color: 'rgba(230, 162, 60, 0.02)' },
          ]),
        },
        data: txSpeedHistory.value,
      },
    ],
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = params[0].axisValue + '<br/>';
        params.forEach((p: any) => {
          result += p.marker + ' ' + p.seriesName + ': ' + formatSpeed(p.value) + '<br/>';
        });
        return result;
      },
    },
  };
}

function getColorByUsage(usage: number): string {
  if (usage < 50) return '#67C23A';
  if (usage < 80) return '#E6A23C';
  return '#F56C6C';
}

function initCharts() {
  nextTick(() => {
    if (cpuChartRef.value) {
      cpuChart = echarts.init(cpuChartRef.value);
      cpuChart.setOption(createGaugeOption('CPU', 0, '#67C23A'));
    }
    if (memChartRef.value) {
      memChart = echarts.init(memChartRef.value);
      memChart.setOption(createGaugeOption('内存', 0, '#67C23A'));
    }

    // 初始化磁盘图表
    diskChartRefs.value.forEach((el, index) => {
      const chart = echarts.init(el);
      chart.setOption(createGaugeOption('磁盘', 0, '#67C23A'));
      diskCharts.set(index, chart);
    });

    if (networkChartRef.value) {
      networkChart = echarts.init(networkChartRef.value);
      networkChart.setOption(createNetworkOption());
    }
  });
}

function updateCharts() {
  const cpuColor = getColorByUsage(stats.value.cpu.usage);
  cpuChart?.setOption(createGaugeOption('CPU', stats.value.cpu.usage, cpuColor));

  const memColor = getColorByUsage(stats.value.memory.usage);
  memChart?.setOption(createGaugeOption('内存', stats.value.memory.usage, memColor));

  // 更新磁盘图表
  stats.value.disk.forEach((disk, index) => {
    const chart = diskCharts.get(index);
    if (chart) {
      const diskColor = getColorByUsage(disk.usage);
      chart.setOption(createGaugeOption('磁盘', disk.usage, diskColor));
    }
  });

  networkChart?.setOption(createNetworkOption());
}

const fetchStats = async () => {
  const tabId = getTabId();
  if (!tabId) {
    isConnected.value = false;
    return;
  }

  try {
    const result = await window.electronAPI.getSystemStats(tabId);
    if (result.success && result.stats) {
      // 前端自行计算网络速度
      const now = Date.now();
      const rxBytes = result.stats.network.rxBytes || 0;
      const txBytes = result.stats.network.txBytes || 0;

      if (prevNetTimestamp > 0 && rxBytes >= prevRxBytes) {
        const timeDiff = (now - prevNetTimestamp) / 1000;
        if (timeDiff > 0) {
          result.stats.network.rxSpeed = Math.round((rxBytes - prevRxBytes) / timeDiff);
          result.stats.network.txSpeed = Math.round((txBytes - prevTxBytes) / timeDiff);
        }
      }

      prevRxBytes = rxBytes;
      prevTxBytes = txBytes;
      prevNetTimestamp = now;

      stats.value = result.stats;
      isConnected.value = true;
      lastUpdateTime.value = new Date().toLocaleTimeString('zh-CN');

      // 更新网络速度历史
      const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      rxSpeedHistory.value.push(result.stats.network.rxSpeed || 0);
      txSpeedHistory.value.push(result.stats.network.txSpeed || 0);
      timeLabels.value.push(timeStr);

      if (rxSpeedHistory.value.length > maxHistoryPoints) {
        rxSpeedHistory.value.shift();
        txSpeedHistory.value.shift();
        timeLabels.value.shift();
      }

      updateCharts();
    } else {
      isConnected.value = false;
    }
  } catch (error) {
    console.error('[StatsView] Failed to fetch stats:', error);
    isConnected.value = false;
  }
};

const startMonitoring = async () => {
  const tabId = getTabId();
  if (!tabId) return;

  // 重置速度计算状态
  prevRxBytes = 0;
  prevTxBytes = 0;
  prevNetTimestamp = 0;

  loading.value = true;
  try {
    await window.electronAPI.startStatsMonitor(tabId);
    await fetchStats();
    statsInterval = window.setInterval(fetchStats, 5000);
  } catch (error) {
    console.error('[StatsView] Failed to start monitoring:', error);
  } finally {
    loading.value = false;
  }
};

const stopMonitoring = async () => {
  try {
    await window.electronAPI.stopStatsMonitor();
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
  } catch (error) {
    console.error('[StatsView] Failed to stop monitoring:', error);
  }
};

// 窗口大小变化时重绘图表
const handleResize = () => {
  cpuChart?.resize();
  memChart?.resize();
  diskCharts.forEach(chart => chart.resize());
  networkChart?.resize();
};

watch(() => getActiveTabId(), () => {
  const tabId = getTabId();
  isConnected.value = !!tabId;
  if (tabId) {
    fetchStats();
  }
});

onMounted(() => {
  initCharts();
  window.addEventListener('resize', handleResize);

  const tabId = getTabId();
  isConnected.value = !!tabId;
  if (tabId) {
    startMonitoring();
  }
});

onBeforeUnmount(() => {
  stopMonitoring();
  window.removeEventListener('resize', handleResize);
  cpuChart?.dispose();
  memChart?.dispose();
  diskCharts.forEach(chart => chart.dispose());
  networkChart?.dispose();
});
</script>

<style scoped>
.stats-view {
  height: 100%;
}

.stats-card {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.stat-item {
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.chart-container {
  width: 100%;
  height: 180px;
}

.stat-detail {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}

.stat-detail p {
  margin: 4px 0;
}

.system-info {
  margin-top: 16px;
}

:deep(.el-divider) {
  margin: 16px 0;
}

/* 网络卡片 */
.network-item {
  text-align: left;
}

.network-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-icon {
  flex-shrink: 0;
}

.stat-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.network-speed {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
}

.speed-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.speed-value {
  font-size: 16px;
  font-weight: 600;
  font-family: 'Consolas', 'Courier New', monospace;
}

.speed-value.rx {
  color: #67C23A;
}

.speed-value.tx {
  color: #E6A23C;
}

.network-chart-container {
  width: 100%;
  height: 120px;
}
</style>
