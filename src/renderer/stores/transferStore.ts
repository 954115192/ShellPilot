import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TransferItem {
  id: string
  tabId: string
  name: string
  path: string
  type: 'upload' | 'download'
  size: number
  transferred: number
  speed: number
  status: 'pending' | 'waiting' | 'transferring' | 'completed' | 'failed'
  startTime: number
  endTime?: number
  error?: string
  _lastTransferred?: number
  _lastSpeedTime?: number
}

export const useTransferStore = defineStore('transfer', () => {
  const transfers = ref<TransferItem[]>([])

  const activeCount = computed(() =>
    transfers.value.filter(t => t.status === 'transferring' || t.status === 'pending').length
  )

  const hasActiveTransfers = computed(() => activeCount.value > 0)

  const overallProgress = computed(() => {
    const active = transfers.value.filter(t => t.status === 'transferring' && t.size > 0)
    if (active.length === 0) return 0
    const totalSize = active.reduce((sum, t) => sum + t.size, 0)
    const totalTransferred = active.reduce((sum, t) => sum + t.transferred, 0)
    return totalSize > 0 ? Math.round((totalTransferred / totalSize) * 100) : 0
  })

  function addTransfer(item: Omit<TransferItem, 'id' | 'status' | 'startTime' | 'transferred' | 'speed'>): string {
    const id = 'transfer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    transfers.value.unshift({
      ...item,
      id,
      status: 'pending',
      transferred: 0,
      speed: 0,
      startTime: Date.now(),
    })
    return id
  }

  function startTransfer(id: string) {
    const item = transfers.value.find(t => t.id === id)
    if (item) {
      item.status = 'transferring'
    }
  }

  function updateProgress(id: string, transferred: number, total: number) {
    const item = transfers.value.find(t => t.id === id)
    if (!item) return

    // 计算速度
    const now = Date.now()
    if (item._lastSpeedTime && item._lastTransferred !== undefined) {
      const dt = (now - item._lastSpeedTime) / 1000
      if (dt > 0) {
        item.speed = Math.round((transferred - item._lastTransferred) / dt)
      }
    }
    item._lastTransferred = transferred
    item._lastSpeedTime = now

    item.transferred = transferred
    if (total > 0 && item.size === 0) {
      item.size = total
    }
    if (item.status === 'pending' || item.status === 'waiting') {
      item.status = 'transferring'
    }
  }

  function completeTransfer(id: string) {
    const item = transfers.value.find(t => t.id === id)
    if (item) {
      item.status = 'completed'
      item.transferred = item.size || item.transferred
      item.speed = 0
      item.endTime = Date.now()
    }
  }

  function failTransfer(id: string, error: string) {
    const item = transfers.value.find(t => t.id === id)
    if (item) {
      item.status = 'failed'
      item.error = error
      item.endTime = Date.now()
    }
  }

  function removeTransfer(id: string) {
    transfers.value = transfers.value.filter(t => t.id !== id)
  }

  function clearCompleted() {
    transfers.value = transfers.value.filter(t => t.status !== 'completed' && t.status !== 'failed')
  }

  function clearAll() {
    transfers.value = []
  }

  // 清理超过 2 秒没更新的传输速度
  function clearStaleSpeeds() {
    const now = Date.now()
    for (const t of transfers.value) {
      if (t.status === 'transferring' && t._lastSpeedTime && now - t._lastSpeedTime > 2000) {
        t.speed = 0
      }
    }
  }

  return {
    transfers,
    activeCount,
    hasActiveTransfers,
    overallProgress,
    addTransfer,
    startTransfer,
    updateProgress,
    completeTransfer,
    failTransfer,
    removeTransfer,
    clearCompleted,
    clearAll,
    clearStaleSpeeds,
  }
})
