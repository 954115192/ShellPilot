<template>
  <div class="app-root" :class="{ 'dark-theme': isDark }">
    <div class="title-bar">
      <div class="title-bar-drag">
        <img src="/icon.png" alt="ShellPilot" class="title-icon" />
      <span class="title-text">ShellPilot</span>
      </div>
      <div class="title-bar-controls">
        <button class="title-btn" @click="windowMinimize"><el-icon><Minus /></el-icon></button>
        <button class="title-btn" @click="windowMaximize"><el-icon><FullScreen /></el-icon></button>
        <button class="title-btn title-btn-close" @click="windowClose"><el-icon><Close /></el-icon></button>
      </div>
    </div>
  <el-container class="main-container">
    <el-aside :width="isCollapsed ? '64px' : '200px'" class="sidebar">
      <el-menu
        :default-active="activeMenu"
        class="menu"
        @select="handleMenuSelect"
        :collapse="isCollapsed"
        background-color="var(--el-bg-color)"
        text-color="var(--el-text-color-primary)"
        active-text-color="var(--el-color-primary)"
      >
        <el-menu-item index="terminal">
          <el-icon><Monitor /></el-icon>
          <template #title>终端</template>
        </el-menu-item>
        <el-menu-item index="settings">
          <el-icon><Setting /></el-icon>
          <template #title>设置</template>
        </el-menu-item>
      </el-menu>
      
      <div class="sidebar-footer">
        <el-button 
          link 
          class="collapse-btn" 
          @click="toggleCollapse"
          :title="isCollapsed ? '展开' : '折叠'"
        >
          <el-icon><Fold v-if="!isCollapsed" /><Expand v-else /></el-icon>
        </el-button>
        <el-button 
          link 
          class="theme-toggle" 
          @click="toggleTheme"
          :title="isDark ? '切换到亮色主题' : '切换到暗色主题'"
        >
          <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
        </el-button>
      </div>
    </el-aside>

    <el-container class="content">
<!--      <el-header class="header" height="40px">-->
<!--        <div class="header-left">-->
<!--          <el-breadcrumb v-if="breadcrumbItems.length > 0" separator="/">-->
<!--            <el-breadcrumb-item v-for="item in breadcrumbItems" :key="item">-->
<!--              {{ item }}-->
<!--            </el-breadcrumb-item>-->
<!--          </el-breadcrumb>-->
<!--        </div>-->
<!--        <div class="header-right">-->
<!--          <el-tag v-if="connectionStatus" :type="connectionStatusType" effect="plain">-->
<!--            {{ connectionStatusText }}-->
<!--          </el-tag>-->
<!--        </div>-->
<!--      </el-header>-->

      <el-main class="main">
        <TerminalView
          v-show="activeMenu === 'terminal'"
          :active-tab-id="activeTabId"
          :tabs="tabs"
          :connected-tab-ids="connectedTabIds"
          :is-dark="isDark"
          @tab-add="addTab"
          @tab-remove="removeTab"
          @tab-select="selectTab"
          @connected="handleConnectViewConnected"
        />
        <SettingsView v-show="activeMenu === 'settings'" />
      </el-main>
    </el-container>
  </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  Monitor, Fold, Expand, Sunny, Moon, Setting, Minus, FullScreen, Close
} from '@element-plus/icons-vue'
import TerminalView from './views/TerminalView.vue'
import SettingsView from './views/SettingsView.vue'
import { addTab as addStoreTab, removeTab as removeStoreTab, setActiveTabId } from './stores/terminalStore'
import { useSettingsStore } from './stores/settingsStore'
import { useAIStore } from './stores/aiStore'

const settingsStore = useSettingsStore()
const aiStore = useAIStore()

// 启动时同步 AI 配置到主进程
onMounted(() => {
  const { baseUrl, apiKey, model } = aiStore.config
  if (baseUrl && model) {
    window.electronAPI.aiConfigure({ baseUrl, apiKey, model })
  }
})
// 窗口控制
const windowMinimize = () => window.electronAPI.windowMinimize()
const windowMaximize = () => window.electronAPI.windowMaximize()
const windowClose = () => window.electronAPI.windowClose()

const activeMenu = ref('terminal')
const isCollapsed = ref(false)
const isDark = computed(() => settingsStore.theme === 'dark' || (settingsStore.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches))

const tabs = ref<{ id: string; name: string }[]>([{ id: '1', name: '新标签' }])
const activeTabId = ref('1')
const connectedTabIds = ref<Set<string>>(new Set())

const breadcrumbItems = ref<string[]>([])
// const connectionStatus = ref<'connected' | 'disconnected' | 'connecting' | null>(null)

// const connectionStatusText = computed(() => {
//   switch (connectionStatus.value) {
//     case 'connected': return '已连接'
//     case 'connecting': return '连接中...'
//     case 'disconnected': return '未连接'
//     default: return ''
//   }
// })
//
// const connectionStatusType = computed(() => {
//   switch (connectionStatus.value) {
//     case 'connected': return 'success'
//     case 'connecting': return 'warning'
//     case 'disconnected': return 'danger'
//     default: return 'info'
//   }
// })

const handleMenuSelect = (index: string) => {
  activeMenu.value = index
  breadcrumbItems.value = [index.charAt(0).toUpperCase() + index.slice(1)]
}

const toggleTheme = () => {
  const next = settingsStore.theme === 'dark' ? 'light' : 'dark'
  settingsStore.setTheme(next)
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const addTab = (tab: { id: string; name: string }) => {
  const existing = tabs.value.find(t => t.id === tab.id)
  if (existing) {
    existing.name = tab.name
    addStoreTab({ id: tab.id, name: tab.name, session: null })
    activeTabId.value = tab.id
    setActiveTabId(tab.id)
    return
  }
  tabs.value.push(tab)
  addStoreTab({ id: tab.id, name: tab.name, session: null })
  activeTabId.value = tab.id
  setActiveTabId(tab.id)
}

const removeTab = async (tabId: string) => {
  const index = tabs.value.findIndex(t => t.id === tabId)
  if (index === -1) return

  // 先清理资源
  removeStoreTab(tabId)
  connectedTabIds.value.delete(tabId)

  try {
    await window.electronAPI.closeShellStream(tabId)
    await window.electronAPI.disconnectSSH(tabId)
  } catch {}

  if (tabs.value.length === 1) {
    // 最后一个标签：关闭后在其原位新建一个空标签
    const newTab = { id: String(Date.now()), name: '新标签' }
    tabs.value = [newTab]
    activeTabId.value = newTab.id
    setActiveTabId(newTab.id)
  } else {
    tabs.value.splice(index, 1)
    if (activeTabId.value === tabId) {
      const nextTab = tabs.value[Math.min(index, tabs.value.length - 1)]
      activeTabId.value = nextTab.id
      setActiveTabId(nextTab.id)
    }
  }
}

const selectTab = (tabId: string) => {
  activeTabId.value = tabId
  setActiveTabId(tabId)
}

// 从 ConnectView 直接连接时创建 tab
const handleConnectViewConnected = (session: any) => {
  const tabId = session.tabId
  const tabName = session.name || `${session.username}@${session.host}`
  const tab = { id: tabId, name: tabName }

  if (!tabs.value.find(t => t.id === tab.id)) {
    tabs.value.push(tab)
    addStoreTab({ id: tab.id, name: tab.name, session })
  }
  activeTabId.value = tab.id
  setActiveTabId(tab.id)
}

const handleSwitchMenu = (event: Event) => {
  const customEvent = event as CustomEvent
  if (customEvent.detail) {
    activeMenu.value = customEvent.detail
  }
}

onMounted(() => {
  // 初始化 store 中的默认空标签
  setActiveTabId('1')
  addStoreTab({ id: '1', name: '新标签', session: null })

  window.addEventListener('switch-menu', handleSwitchMenu)
})

onBeforeUnmount(() => {
  window.removeEventListener('switch-menu', handleSwitchMenu)
})
</script>

<style>
:root {
  --el-bg-color: #ffffff;
  --el-text-color-primary: #303133;
  --el-border-color: #e4e7ed;
  --el-fill-color: #f2f6fc;
}

html.dark {
  --el-bg-color: #1a1a1a;
  --el-text-color-primary: #e5e7eb;
  --el-border-color: #374151;
  --el-fill-color: #1f2937;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>

<style scoped>
.app-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.title-bar {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
  -webkit-app-region: drag;
  user-select: none;
}

.title-bar-drag {
  flex: 1;
  padding-left: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  width: 22px;
  height: 22px;
  border-radius: 4px;
}

.title-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.title-bar-controls {
  display: flex;
  -webkit-app-region: no-drag;
  height: 100%;
}

.title-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-primary);
  transition: background 0.15s;
}

.title-btn:hover {
  background: var(--el-fill-color);
}

.title-btn-close:hover {
  background: #e81123;
  color: white;
}

.main-container {
  flex: 1;
  min-height: 0;
  transition: all 0.3s;
}

.sidebar {
  background-color: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  overflow: hidden;
}

.menu {
  flex: 1;
  border-right: none;
  margin-top: 8px;
}

.sidebar-footer {
  padding: 8px;
  border-top: 1px solid var(--el-border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.collapse-btn,
.theme-toggle {
  color: var(--el-text-color-primary);
  font-size: 16px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.collapse-btn:hover,
.theme-toggle:hover {
  background-color: var(--el-fill-color);
}

.content {
  display: flex;
  flex-direction: column;
}

.header {
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.header-left {
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.main {
  flex: 1;
  min-height: 0;
  background-color: var(--el-bg-color);
  padding: 16px;
  overflow: hidden;
}
</style>
