<template>
  <el-popover
    :visible="visible"
    placement="top"
    :width="360"
    trigger="click"
    @update:visible="$emit('update:visible', $event)"
  >
    <template #reference>
      <slot />
    </template>

    <div class="transfer-history">
      <div class="transfer-header">
        <span class="transfer-title">传输记录</span>
        <el-button size="small" text @click="clearCompleted">清除已完成</el-button>
      </div>

      <div class="transfer-list" v-if="transfers.length > 0">
        <div
          v-for="item in transfers"
          :key="item.id"
          class="transfer-item"
          :class="item.status"
        >
          <div class="transfer-info">
            <el-icon :size="16" :class="item.type">
              <Upload v-if="item.type === 'upload'" />
              <Download v-else />
            </el-icon>
            <span class="transfer-name" :title="item.name">{{ item.name }}</span>
            <el-tag :type="getStatusType(item.status)" size="small" class="transfer-status">
              {{ getStatusText(item.status) }}
            </el-tag>
          </div>

          <div v-if="item.status === 'transferring'" class="transfer-progress">
            <el-progress
              :percentage="getPercentage(item)"
              :stroke-width="4"
              :show-text="false"
            />
            <span class="transfer-speed">{{ formatSize(item.transferred) }} / {{ formatSize(item.size) }}</span>
          </div>

          <div v-else-if="item.status === 'completed'" class="transfer-done">
            <span class="transfer-size">{{ formatSize(item.size) }}</span>
            <span class="transfer-time">{{ formatDuration(item.startTime, item.endTime) }}</span>
          </div>

          <div v-else-if="item.status === 'failed'" class="transfer-error">
            <span>{{ item.error }}</span>
          </div>

          <el-button
            size="small"
            text
            class="transfer-remove"
            @click="removeTransfer(item.id)"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>

      <div v-else class="transfer-empty">
        <span>暂无传输记录</span>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Upload, Download, Close } from '@element-plus/icons-vue'
import { useTransferStore, TransferItem } from '../../stores/transferStore'

defineProps<{
  visible: boolean
}>()

defineEmits<{
  'update:visible': [value: boolean]
}>()

const transferStore = useTransferStore()

const transfers = computed(() => transferStore.transfers)

const getPercentage = (item: TransferItem): number => {
  if (item.size === 0) return 0
  return Math.round((item.transferred / item.size) * 100)
}

const getStatusType = (status: string): string => {
  switch (status) {
    case 'transferring': return 'warning'
    case 'completed': return 'success'
    case 'failed': return 'danger'
    default: return 'info'
  }
}

const getStatusText = (status: string): string => {
  switch (status) {
    case 'pending': return '等待中'
    case 'transferring': return '传输中'
    case 'completed': return '完成'
    case 'failed': return '失败'
    default: return status
  }
}

const formatSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

const formatDuration = (start: number, end?: number): string => {
  const duration = ((end || Date.now()) - start) / 1000
  if (duration < 60) return `${Math.round(duration)}秒`
  if (duration < 3600) return `${Math.round(duration / 60)}分钟`
  return `${Math.round(duration / 3600)}小时`
}

const clearCompleted = () => {
  transferStore.clearCompleted()
}

const removeTransfer = (id: string) => {
  transferStore.removeTransfer(id)
}
</script>

<style scoped>
.transfer-history {
  max-height: 400px;
}

.transfer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.transfer-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.transfer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.transfer-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  position: relative;
}

.transfer-item.transferring {
  background: var(--el-color-warning-light-9);
}

.transfer-item.completed {
  background: var(--el-color-success-light-9);
}

.transfer-item.failed {
  background: var(--el-color-danger-light-9);
}

.transfer-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.transfer-info .upload {
  color: var(--el-color-primary);
}

.transfer-info .download {
  color: var(--el-color-success);
}

.transfer-name {
  flex: 1;
  font-size: 13px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transfer-status {
  flex-shrink: 0;
}

.transfer-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.transfer-progress :deep(.el-progress) {
  flex: 1;
}

.transfer-speed {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.transfer-done {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.transfer-error {
  font-size: 12px;
  color: var(--el-color-danger);
}

.transfer-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 2px !important;
  height: auto !important;
}

.transfer-empty {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
