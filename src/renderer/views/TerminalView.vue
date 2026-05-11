<template>
  <div class="terminal-view">
    <div class="terminal-tabs-container">
      <div class="tabs-header" v-if="tabs.length > 0">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ active: tab.id === activeTabId }"
          @click="selectTab(tab.id)"
        >
          <span class="tab-name">{{ tab.name }}</span>
          <span
            class="tab-close"
            @click.stop="removeTab(tab.id)"
          >&times;</span>
        </div>
        <el-button size="small" class="add-tab-btn" @click="addNewTab">+</el-button>
      </div>

      <div class="terminal-content">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="terminal-wrapper"
          v-show="tab.id === activeTabId"
        >
          <!-- 已连接 → 显示终端 -->
          <Terminal
            v-if="getTabSession(tab.id)"
            :session="getTabSession(tab.id)"
            :is-dark="isDark"
            :ref="el => setTerminalRef(tab.id, el as any)"
          />
          <!-- 未连接 → 显示快捷登录页面 -->
          <ConnectView
            v-else
            :tab-id="tab.id"
            @connected="handleTabConnect"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Terminal from '../components/terminal/Terminal.vue'
import ConnectView from './ConnectView.vue'
import { getAllTabs, updateTabSession } from '../stores/terminalStore'

const props = defineProps<{
  activeTabId?: string
  tabs?: { id: string; name: string }[]
  connectedTabIds?: Set<string>
  isDark?: boolean
}>()

const emit = defineEmits<{
  'tab-add': [tab: { id: string; name: string }]
  'tab-remove': [tabId: string]
  'tab-select': [tabId: string]
}>()

const terminalRefs = ref<Map<string, any>>(new Map())
const tabSessions = ref<Map<string, any>>(new Map())

let tabCounter = (props.tabs?.length || 0) + 1

const setTerminalRef = (tabId: string, el: any) => {
  if (el) {
    terminalRefs.value.set(tabId, el)
  }
}

const getTabSession = (tabId: string) => {
  // 本地连接（从标签内的 ConnectView 连接）
  const local = tabSessions.value.get(tabId)
  if (local) return local
  // 兜底：从 App 首页 ConnectView 连接后存入 store 的 session
  const allTabs = getAllTabs()
  const tab = allTabs.find(t => t.id === tabId)
  return tab?.session || null
}

const handleTabConnect = (session: any) => {
  const tabId = session.tabId
  // 保存 session，标签内容自动从 ConnectView 切换为 Terminal
  tabSessions.value.set(tabId, session)
  updateTabSession(tabId, session)
  // 更新标签名
  const name = session.name || `${session.username}@${session.host}`
  emit('tab-add', { id: tabId, name })
  emit('tab-select', tabId)
}

const selectTab = (tabId: string) => {
  emit('tab-select', tabId)
}

const addNewTab = () => {
  const tabId = String(tabCounter++)
  const tab = { id: tabId, name: '新标签' }
  emit('tab-add', tab)
  emit('tab-select', tabId)
}

const removeTab = (tabId: string) => {
  tabSessions.value.delete(tabId)
  emit('tab-remove', tabId)
}
</script>

<style scoped>
.terminal-view {
  height: 100%;
  min-height: 0;
}

.terminal-tabs-container {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.tabs-header {
  display: flex;
  align-items: center;
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  padding: 0 8px;
  overflow-x: auto;
  min-height: 36px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  font-size: 13px;
  white-space: nowrap;
  color: var(--el-text-color-regular);
  transition: background-color 0.2s;
}

.tab-item:hover {
  background-color: var(--el-fill-color);
}

.tab-item.active {
  background-color: var(--el-fill-color);
  color: var(--el-color-primary);
  font-weight: 500;
}

.tab-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  font-size: 14px;
  opacity: 0.5;
  cursor: pointer;
  line-height: 1;
}

.tab-close:hover {
  opacity: 1;
}

.add-tab-btn {
  margin-left: 4px;
  width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.terminal-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.terminal-wrapper {
  flex: 1;
  min-height: 0;
}

/* 当 TerminalView 内部嵌入 ConnectView 时，让它占满容器 */
.terminal-wrapper :deep(.connect-view) {
  max-width: 100%;
  height: 100%;
  padding: 24px 20px;
}
</style>
