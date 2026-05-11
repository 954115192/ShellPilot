<template>
  <div
    v-if="visible && suggestions.length > 0"
    class="command-suggestions"
    :style="positionStyle"
  >
    <div
      v-for="(item, index) in suggestions"
      :key="index"
      class="suggestion-item"
      :class="{ active: index === selectedIndex, 'is-input': index === 0 }"
      @click="$emit('select', item)"
    >
      <span class="suggestion-text">{{ item }}</span>
      <span v-if="index === 0" class="suggestion-tag">当前</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  visible: boolean
  suggestions: string[]
  selectedIndex: number
  x: number
  y: number
  flipAbove?: boolean
}>()

defineEmits<{
  select: [command: string]
}>()

const positionStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  transform: props.flipAbove ? 'translateY(-100%)' : 'none',
}))
</script>

<style scoped>
.command-suggestions {
  position: fixed;
  z-index: 9999;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 240px;
  overflow-y: auto;
  min-width: 200px;
  max-width: 500px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  font-family: 'Consolas', 'Courier New', monospace;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  transition: background-color 0.1s;
}

.suggestion-item:hover,
.suggestion-item.active {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.suggestion-item.active {
  background-color: var(--el-color-primary-light-8);
}

.suggestion-item.is-input {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.suggestion-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-tag {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-lighter);
  border-radius: 3px;
  padding: 1px 5px;
}
</style>
