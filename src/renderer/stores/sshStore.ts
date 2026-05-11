import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface WorkingDirMap {
  [tabId: string]: string;
}

export const useSSHStore = defineStore('ssh', () => {
  // 全局 SSH 连接状态
  const isConnected = ref(false);
  const currentHost = ref('');
  
  // 为每个标签页维护独立的工作目录
  const workingDirs = ref<WorkingDirMap>({});
  
  // 计算属性：获取当前激活标签页的工作目录
  const getCurrentWorkingDir = (tabId?: string) => {
    if (!tabId) return '/';
    return workingDirs.value[tabId] || '/';
  };
  
  // 设置标签页的工作目录
  const setWorkingDir = (tabId: string, dir: string) => {
    workingDirs.value[tabId] = dir;
  };
  
  // 清除标签页的工作目录（当标签关闭时）
  const clearWorkingDir = (tabId: string) => {
    delete workingDirs.value[tabId];
  };
  
  // 设置连接状态
  const setConnectionStatus = (connected: boolean, host?: string) => {
    isConnected.value = connected;
    if (host) {
      currentHost.value = host;
    }
  };
  
  // 重置所有状态
  const reset = () => {
    isConnected.value = false;
    currentHost.value = '';
    workingDirs.value = {};
  };
  
  return {
    isConnected,
    currentHost,
    workingDirs,
    getCurrentWorkingDir,
    setWorkingDir,
    clearWorkingDir,
    setConnectionStatus,
    reset,
  };
});
