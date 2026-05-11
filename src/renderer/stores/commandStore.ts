import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface QuickCommand {
  id: string
  name: string
  command: string
  description?: string
  category: '内置' | '自定义'
}

export interface FrequentCommand {
  command: string
  useCount: number
  lastUsed: number
}

const STORAGE_KEY_QUICK = 'shell-app-quick-commands'
const STORAGE_KEY_FREQUENT = 'shell-app-frequent-commands'

const builtinCommands: QuickCommand[] = [
  { id: 'sys-1', name: '系统信息', command: 'uname -a', description: '显示系统内核信息', category: '内置' },
  { id: 'sys-2', name: '主机名', command: 'hostname', description: '显示主机名', category: '内置' },
  { id: 'sys-3', name: '运行时间', command: 'uptime', description: '显示系统运行时间', category: '内置' },
  { id: 'sys-4', name: '磁盘空间', command: 'df -h', description: '查看磁盘使用情况', category: '内置' },
  { id: 'sys-5', name: '内存使用', command: 'free -h', description: '查看内存使用情况', category: '内置' },
  { id: 'proc-1', name: '进程列表', command: 'ps aux', description: '显示所有进程', category: '内置' },
  { id: 'proc-2', name: '进程树', command: 'ps auxf', description: '以树形显示进程', category: '内置' },
  { id: 'net-1', name: '监听端口', command: 'ss -tuln', description: '查看监听端口', category: '内置' },
  { id: 'net-2', name: '网络连接', command: 'netstat -tuln', description: '查看网络连接', category: '内置' },
  { id: 'file-1', name: '查找日志', command: 'find /var/log -name "*.log" -mtime -7', description: '查找7天内的日志文件', category: '内置' },
  { id: 'file-2', name: '目录大小', command: 'du -sh *', description: '查看当前目录各文件/夹大小', category: '内置' },
  { id: 'file-3', name: '实时日志', command: 'tail -f /var/log/syslog', description: '实时查看系统日志', category: '内置' },
  { id: 'svc-1', name: '服务状态', command: 'systemctl status', description: '查看系统服务状态', category: '内置' },
  { id: 'svc-2', name: '服务列表', command: 'systemctl list-units --type=service', description: '列出所有服务', category: '内置' },
]

function loadQuickCommands(): QuickCommand[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUICK)
    if (raw) {
      const custom: QuickCommand[] = JSON.parse(raw)
      return [...builtinCommands, ...custom]
    }
  } catch {}
  return [...builtinCommands]
}

// 常用命令按连接标识存储: Map<connKey, Map<command, FrequentCommand>>
function loadFrequent(): Map<string, Map<string, FrequentCommand>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FREQUENT)
    if (raw) {
      const outer: Record<string, Record<string, FrequentCommand>> = JSON.parse(raw)
      const result = new Map<string, Map<string, FrequentCommand>>()
      for (const [connKey, records] of Object.entries(outer)) {
        const inner = new Map<string, FrequentCommand>()
        for (const [cmd, rec] of Object.entries(records)) {
          inner.set(cmd, rec)
        }
        result.set(connKey, inner)
      }
      return result
    }
  } catch {}
  return new Map()
}

// 生成连接标识: host:port@username
export function makeConnKey(host: string, port: number, username: string): string {
  return `${host}:${port}@${username}`
}

export const useCommandStore = defineStore('command', () => {
  const quickCommands = ref<QuickCommand[]>(loadQuickCommands())
  const frequentCommands = ref<Map<string, Map<string, FrequentCommand>>>(loadFrequent())

  function saveQuickCommands() {
    const custom = quickCommands.value.filter(c => c.category === '自定义')
    localStorage.setItem(STORAGE_KEY_QUICK, JSON.stringify(custom))
  }

  function saveFrequent() {
    const outer: Record<string, Record<string, FrequentCommand>> = {}
    for (const [connKey, records] of frequentCommands.value.entries()) {
      const inner: Record<string, FrequentCommand> = {}
      for (const [cmd, rec] of records.entries()) {
        inner[cmd] = rec
      }
      outer[connKey] = inner
    }
    localStorage.setItem(STORAGE_KEY_FREQUENT, JSON.stringify(outer))
  }

  // 记录命令使用
  function recordCommand(connKey: string, command: string) {
    const trimmed = command.trim()
    if (!trimmed) return

    if (!frequentCommands.value.has(connKey)) {
      frequentCommands.value.set(connKey, new Map())
    }
    const connHistory = frequentCommands.value.get(connKey)!

    const existing = connHistory.get(trimmed)
    if (existing) {
      existing.useCount++
      existing.lastUsed = Date.now()
    } else {
      connHistory.set(trimmed, {
        command: trimmed,
        useCount: 1,
        lastUsed: Date.now(),
      })
    }
    saveFrequent()
  }

  // 搜索建议
  function searchSuggestions(connKey: string, input: string): string[] {
    if (!input || input.trim().length === 0) return []

    const query = input.toLowerCase().trim()
    const results: { command: string; score: number; useCount: number }[] = []

    // 1. 搜索当前连接的常用命令
    const connHistory = frequentCommands.value.get(connKey)
    if (connHistory) {
      for (const record of connHistory.values()) {
        const cmd = record.command.toLowerCase()
        let score = 0
        if (cmd.startsWith(query)) score = 100
        else if (cmd.includes(query)) score = 50
        if (score > 0) {
          results.push({ command: record.command, score, useCount: record.useCount })
        }
      }
    }

    // 2. 搜索快捷命令
    for (const qc of quickCommands.value) {
      const cmd = qc.command.toLowerCase()
      const name = qc.name.toLowerCase()
      let score = 0
      if (cmd.startsWith(query) || name.startsWith(query)) score = 90
      else if (cmd.includes(query) || name.includes(query)) score = 40
      if (score > 0) {
        if (!results.find(r => r.command === qc.command)) {
          results.push({ command: qc.command, score, useCount: 0 })
        }
      }
    }

    results.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      return b.useCount - a.useCount
    })

    const seen = new Set<string>()
    const suggestions: string[] = []
    for (const r of results) {
      if (!seen.has(r.command) && r.command !== input) {
        seen.add(r.command)
        suggestions.push(r.command)
        if (suggestions.length >= 8) break
      }
    }

    return suggestions
  }

  // 快捷命令 CRUD
  function addQuickCommand(cmd: Omit<QuickCommand, 'id' | 'category'>) {
    quickCommands.value.push({
      ...cmd,
      id: 'custom-' + Date.now(),
      category: '自定义',
    })
    saveQuickCommands()
  }

  function updateQuickCommand(id: string, data: Partial<QuickCommand>) {
    const idx = quickCommands.value.findIndex(c => c.id === id)
    if (idx >= 0) {
      quickCommands.value[idx] = { ...quickCommands.value[idx], ...data }
      saveQuickCommands()
    }
  }

  function deleteQuickCommand(id: string) {
    quickCommands.value = quickCommands.value.filter(c => c.id !== id)
    saveQuickCommands()
  }

  // 常用命令管理
  function getFrequentByConn(connKey: string): FrequentCommand[] {
    const connHistory = frequentCommands.value.get(connKey)
    if (!connHistory) return []
    return Array.from(connHistory.values())
      .sort((a, b) => b.useCount - a.useCount)
  }

  function deleteFrequentCommand(connKey: string, command: string) {
    const connHistory = frequentCommands.value.get(connKey)
    if (connHistory) {
      connHistory.delete(command)
      saveFrequent()
    }
  }

  function clearFrequentByConn(connKey: string) {
    frequentCommands.value.delete(connKey)
    saveFrequent()
  }

  // 删除连接时清除对应的常用命令
  function clearFrequentByConnKey(connKey: string) {
    frequentCommands.value.delete(connKey)
    saveFrequent()
  }

  return {
    quickCommands,
    frequentCommands,
    recordCommand,
    searchSuggestions,
    addQuickCommand,
    updateQuickCommand,
    deleteQuickCommand,
    getFrequentByConn,
    deleteFrequentCommand,
    clearFrequentByConn,
    clearFrequentByConnKey,
  }
})
