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
  status: 'pending' | 'transferring' | 'completed' | 'failed'
  startTime: number
  endTime?: number
  error?: string
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

  function addTransfer(item: Omit<TransferItem, 'id' | 'status' | 'startTime' | 'transferred'>): string {
    const id = 'transfer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    transfers.value.unshift({
      ...item,
      id,
      status: 'pending',
      transferred: 0,
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
    if (item) {
      item.transferred = transferred
      if (total > 0 && item.size === 0) {
        item.size = total
      }
      if (item.status === 'pending') {
        item.status = 'transferring'
      }
    }
  }

  function completeTransfer(id: string) {
    const item = transfers.value.find(t => t.id === id)
    if (item) {
      item.status = 'completed'
      item.transferred = item.size || item.transferred
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

  // 根据 tabId 和类型找到最新的活跃传输
  function findActiveTransfer(tabId: string, type: 'upload' | 'download'): TransferItem | undefined {
    return transfers.value.find(t =>
      t.tabId === tabId && t.status === 'transferring' && t.type === type
    )
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
    findActiveTransfer,
  }
})
