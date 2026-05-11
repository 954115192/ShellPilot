import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type AIMode = 'qa' | 'agent'

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  timestamp: number
  type?: 'text' | 'thinking' | 'tool-call' | 'tool-result' | 'command-card' | 'confirm-needed' | 'error' | 'done'
  tool?: string
  args?: any
  command?: string
  level?: string
}

export interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface AITabState {
  messages: AIMessage[]
  isLoading: boolean
  mode: AIMode
  pendingConfirm: { command: string; level: string } | null
}

const STORAGE_KEY = 'shell-app-ai-config'
const WIDTH_KEY = 'shell-app-ai-width'

const defaultConfig: AIConfig = {
  baseUrl: '',
  apiKey: '',
  model: '',
}

function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultConfig, ...JSON.parse(raw) }
  } catch {}
  return { ...defaultConfig }
}

function loadWidth(): number {
  try {
    const raw = localStorage.getItem(WIDTH_KEY)
    if (raw) return parseInt(raw) || 360
  } catch {}
  return 360
}

function createTabState(): AITabState {
  return {
    messages: [],
    isLoading: false,
    mode: 'qa',
    pendingConfirm: null,
  }
}

export const useAIStore = defineStore('ai', () => {
  const config = ref<AIConfig>(loadConfig())
  const sidebarWidth = ref(loadWidth())
  const tabStates = ref<Map<string, AITabState>>(new Map())

  const isConfigured = computed(() => {
    return !!(config.value.baseUrl && config.value.model)
  })

  function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value))
  }

  function updateConfig(updates: Partial<AIConfig>) {
    config.value = { ...config.value, ...updates }
    saveConfig()
  }

  function saveWidth() {
    localStorage.setItem(WIDTH_KEY, String(sidebarWidth.value))
  }

  function setWidth(w: number) {
    sidebarWidth.value = w
    saveWidth()
  }

  // 获取或创建标签状态
  function getState(tabId: string): AITabState {
    if (!tabStates.value.has(tabId)) {
      tabStates.value.set(tabId, createTabState())
    }
    return tabStates.value.get(tabId)!
  }

  function getMessages(tabId: string): AIMessage[] {
    return getState(tabId).messages
  }

  function isLoading(tabId: string): boolean {
    return getState(tabId).isLoading
  }

  function getMode(tabId: string): AIMode {
    return getState(tabId).mode
  }

  function getPendingConfirm(tabId: string) {
    return getState(tabId).pendingConfirm
  }

  function setMode(tabId: string, newMode: AIMode) {
    getState(tabId).mode = newMode
  }

  function setLoading(tabId: string, loading: boolean) {
    getState(tabId).isLoading = loading
  }

  function addMessage(tabId: string, msg: Omit<AIMessage, 'id' | 'timestamp'>) {
    const state = getState(tabId)
    state.messages.push({
      ...msg,
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    })
  }

  function appendText(tabId: string, text: string) {
    const state = getState(tabId)
    const last = state.messages[state.messages.length - 1]
    if (last && last.role === 'assistant' && last.type === 'text') {
      last.content += text
    } else {
      addMessage(tabId, { role: 'assistant', content: text, type: 'text' })
    }
  }

  // 移除所有思考中消息
  function removeThinking(tabId: string) {
    const state = getState(tabId)
    state.messages = state.messages.filter(m => m.type !== 'thinking')
  }

  function addAgentEvent(tabId: string, event: { type: string; content?: string; tool?: string; args?: any; result?: string; command?: string; level?: string }) {
    const state = getState(tabId)
    switch (event.type) {
      case 'text':
        removeThinking(tabId)
        appendText(tabId, event.content || '')
        break
      case 'thinking':
        removeThinking(tabId)
        addMessage(tabId, { role: 'assistant', content: event.content || '思考中...', type: 'thinking' })
        break
      case 'tool-call':
        removeThinking(tabId)
        addMessage(tabId, {
          role: 'tool', content: '', type: 'tool-call',
          tool: event.tool, args: event.args,
        })
        break
      case 'tool-result': {
        // 作为独立消息追加，保留完整的执行过程
        const lastTool = [...state.messages].reverse().find(m => m.type === 'tool-call')
        if (lastTool) {
          lastTool.type = 'tool-result'
          lastTool.content = event.result || ''
        }
        break
      }
      case 'command-card':
        addMessage(tabId, { role: 'assistant', content: event.command || '', type: 'command-card', command: event.command })
        break
      case 'confirm-needed':
        state.pendingConfirm = { command: event.command || '', level: event.level || 'high' }
        addMessage(tabId, { role: 'assistant', content: event.command || '', type: 'confirm-needed', command: event.command, level: event.level })
        break
      case 'error':
        addMessage(tabId, { role: 'assistant', content: event.content || '', type: 'error' })
        break
      case 'done':
        state.pendingConfirm = null
        break
    }
  }

  function clearMessages(tabId: string) {
    const state = getState(tabId)
    state.messages = []
    state.pendingConfirm = null
  }

  function setPendingConfirm(tabId: string, value: { command: string; level: string } | null) {
    getState(tabId).pendingConfirm = value
  }

  function buildHistory(tabId: string): { role: string; content: string }[] {
    return getState(tabId).messages
      .filter(m => m.type === 'text' || !m.type)
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))
  }

  return {
    config,
    sidebarWidth,
    isConfigured,
    updateConfig,
    setWidth,
    getState,
    getMessages,
    isLoading,
    getMode,
    getPendingConfirm,
    setMode,
    setLoading,
    addMessage,
    appendText,
    addAgentEvent,
    clearMessages,
    setPendingConfirm,
    buildHistory,
    saveConfig,
  }
})
