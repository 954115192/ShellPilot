<template>
  <div class="ai-sidebar" :style="{ width: aiStore.sidebarWidth + 'px' }">
    <div class="ai-drag-handle" @mousedown="startDrag">
      <div class="drag-indicator"></div>
    </div>

    <div class="ai-header">
      <div class="ai-header-left">
        <span class="ai-title">AI 助手</span>
        <el-tag size="small" :type="currentMode === 'qa' ? 'info' : 'success'" class="mode-tag">
          {{ currentMode === 'qa' ? '问答' : '智能体' }}
        </el-tag>
      </div>
      <div class="ai-header-right">
        <el-tooltip content="清空" placement="top" :show-after="300">
          <el-button text size="small" @click="aiStore.clearMessages(props.tabId)" :disabled="currentMessages.length === 0">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
        <el-button text size="small" @click="$emit('close')">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="ai-messages" ref="messagesRef">
      <div v-if="currentMessages.length === 0" class="ai-welcome">
        <div v-if="currentMode === 'qa'">
          <p>💡 智能问答 — 解释命令、分析错误、回答问题</p>
        </div>
        <div v-else>
          <p>🤖 智能体 — 自主探索服务器、执行任务</p>
        </div>
      </div>

      <template v-for="msg in currentMessages" :key="msg.id">
        <!-- 用户消息 -->
        <div v-if="msg.role === 'user'" class="msg-row msg-user">
          <div class="msg-user-bubble">{{ msg.content }}</div>
        </div>

        <!-- 思考中 -->
        <div v-else-if="msg.type === 'thinking'" class="msg-row msg-ai">
          <span class="msg-thinking">{{ msg.content }}<span class="dots"></span></span>
        </div>

        <!-- 工具执行中 -->
        <div v-else-if="msg.type === 'tool-call'" class="msg-row msg-ai">
          <div class="tool-step">
            <div class="tool-step-head">
              <span class="spinner"></span>
              <span class="tool-label">{{ toolName(msg.tool) }}</span>
            </div>
            <code class="tool-cmd">{{ toolArgs(msg.args) }}</code>
          </div>
        </div>

        <!-- 工具执行完成 -->
        <div v-else-if="msg.type === 'tool-result'" class="msg-row msg-ai">
          <div class="tool-step tool-done">
            <div class="tool-step-head" @click="msg._collapsed = !msg._collapsed">
              <span class="arrow" :class="{ open: !msg._collapsed }">▸</span>
              <span class="tool-label">{{ toolName(msg.tool) }}</span>
              <span class="tool-args-preview">{{ toolArgs(msg.args) }}</span>
            </div>
            <div v-if="!msg._collapsed" class="tool-result">
              <pre>{{ msg.content }}</pre>
            </div>
          </div>
        </div>

        <!-- 确认 -->
        <div v-else-if="msg.type === 'confirm-needed'" class="msg-row msg-ai">
          <div class="confirm-box">
            <div class="confirm-label">
              <span>⚠</span>
              <span>{{ msg.level === 'continue' ? '任务执行中' : '需要确认' }}</span>
            </div>
            <code class="confirm-cmd">{{ msg.command }}</code>
            <div class="confirm-actions">
              <el-button size="small" type="primary" @click="handleConfirm(true, msg.level)">
                {{ msg.level === 'continue' ? '继续' : '确认' }}
              </el-button>
              <el-button size="small" @click="handleConfirm(false, msg.level)">
                {{ msg.level === 'continue' ? '停止' : '拒绝' }}
              </el-button>
            </div>
          </div>
        </div>

        <!-- 错误 -->
        <div v-else-if="msg.type === 'error'" class="msg-row msg-ai">
          <div class="msg-error">✕ {{ msg.content }}</div>
        </div>

        <!-- AI 文本回答 -->
        <div v-else class="msg-row msg-ai">
          <div class="msg-text" v-html="renderText(msg.content)"></div>
        </div>
      </template>
    </div>

    <div class="ai-input-area">
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="2"
        :placeholder="currentMode === 'qa' ? '问我任何运维问题...' : '告诉我你想做什么...'"
        resize="none"
        @keydown.enter.exact.prevent="sendMessage"
      />
      <div class="input-bar">
        <el-select
          :model-value="currentMode"
          @update:model-value="(v: string) => switchMode(v as 'qa' | 'agent')"
          size="small"
          class="mode-select"
        >
          <el-option value="qa" label="问答" />
          <el-option value="agent" label="智能体" />
        </el-select>
        <el-button v-if="currentLoading" type="danger" size="small" @click="cancelTask">停止</el-button>
        <el-button v-else type="primary" size="small" :disabled="!inputText.trim() || !aiStore.isConfigured" @click="sendMessage">
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useAIStore } from '../../stores/aiStore'
import { ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'

const props = defineProps<{
  tabId: string
  sessionHost?: string
  sessionPort?: number
  sessionUsername?: string
  initialQuestion?: string
}>()

const emit = defineEmits<{
  close: []
  writeToShell: [command: string]
}>()

const aiStore = useAIStore()
const inputText = ref('')
const messagesRef = ref<HTMLElement>()

const currentMessages = computed(() => aiStore.getMessages(props.tabId))
const currentLoading = computed(() => aiStore.isLoading(props.tabId))
const currentMode = computed(() => aiStore.getMode(props.tabId))

function startDrag(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = aiStore.sidebarWidth
  const onMove = (ev: MouseEvent) => aiStore.setWidth(Math.max(200, startWidth + (startX - ev.clientX)))
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function scrollToBottom() {
  nextTick(() => { if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight })
}

function switchMode(m: 'qa' | 'agent') { aiStore.setMode(props.tabId, m) }

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || currentLoading.value) return
  if (!aiStore.isConfigured) {
    aiStore.addMessage(props.tabId, { role: 'assistant', content: '请先在设置中配置 AI', type: 'error' })
    return
  }
  aiStore.addMessage(props.tabId, { role: 'user', content: text })
  inputText.value = ''
  aiStore.setLoading(props.tabId, true)
  scrollToBottom()
  try {
    const { baseUrl, apiKey, model } = aiStore.config
    await window.electronAPI.aiConfigure({ baseUrl, apiKey, model })
    const ctx = { host: props.sessionHost || '', port: props.sessionPort || 22, username: props.sessionUsername || '', currentDir: '', frequentCommands: [], recentOutput: '' }
    if (currentMode.value === 'qa') await window.electronAPI.aiAsk(props.tabId, text, ctx, [])
    else await window.electronAPI.aiAgent(props.tabId, text, ctx, [])
  } catch (err) {
    aiStore.addMessage(props.tabId, { role: 'assistant', content: `错误: ${(err as Error).message}`, type: 'error' })
  } finally {
    aiStore.setLoading(props.tabId, false)
    scrollToBottom()
  }
}

function executeCommand(cmd: string) { emit('writeToShell', cmd); aiStore.addMessage(props.tabId, { role: 'assistant', content: `已发送: ${cmd}`, type: 'text' }) }
async function copyCommand(cmd: string) { try { await navigator.clipboard.writeText(cmd); ElMessage.success('已复制') } catch {} }
async function handleConfirm(ok: boolean, level?: string) {
  if (level === 'continue') await window.electronAPI.aiContinue(props.tabId, ok)
  else await window.electronAPI.aiConfirm(props.tabId, ok)
  aiStore.setPendingConfirm(props.tabId, null)
}
async function cancelTask() { await window.electronAPI.aiCancel(props.tabId); aiStore.setLoading(props.tabId, false) }

function toolArgs(args: any): string { if (!args) return ''; if (args.command) return `$ ${args.command}`; if (args.path) return args.path; return JSON.stringify(args) }
function toolName(t?: string): string { const m: Record<string, string> = { executeCommand: '执行命令', readFile: '读取文件', listDirectory: '列出目录', searchFiles: '搜索文件' }; return m[t || ''] || t || '工具' }

function renderText(content: string): string {
  let h = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  h = h.replace(/```(?:command|bash|sh)?\s*\n([\s\S]*?)```/g, (_: string, code: string) => {
    const cmds = code.trim().split('\n').filter((l: string) => l.trim() && !l.trim().startsWith('#'))
    return cmds.map((c: string) => {
      const cmd = c.replace(/^\s*[$>]\s*/, '').trim()
      if (!cmd) return ''
      return `<div class="ic"><div class="ic-head"><code>${cmd}</code></div><div class="ic-acts"><button class="ic-btn" onclick="window.__aiExecute('${cmd.replace(/'/g, "\\'")}')">执行</button><button class="ic-btn" onclick="window.__aiCopy('${cmd.replace(/'/g, "\\'")}')">复制</button></div></div>`
    }).join('')
  })
  h = h.replace(/`([^`]+)`/g, '<code class="ic-inline">$1</code>')
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  h = h.replace(/\n/g, '<br>')
  return h
}

watch(() => currentMessages.value.length, () => scrollToBottom())

onMounted(() => {
  ;(window as any).__aiExecute = (cmd: string) => executeCommand(cmd)
  ;(window as any).__aiCopy = (cmd: string) => copyCommand(cmd)
  if (props.initialQuestion) { inputText.value = props.initialQuestion; nextTick(() => sendMessage()) }
})
</script>

<style>
/* v-html 内容的样式（非 scoped） */
.ic { border-left: 2px solid var(--el-border-color); padding: 8px 12px; margin: 8px 0; background: var(--el-fill-color-dark); border-radius: 4px; }
.ic-head { font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; }
.ic-head code { color: var(--el-text-color-primary); }
.ic-acts { display: flex; gap: 8px; margin-top: 6px; }
.ic-btn { background: var(--el-color-primary-light-9); border: none; border-radius: 4px; padding: 4px 14px; font-size: 13px; cursor: pointer; color: var(--el-color-primary); transition: all 0.15s; }
.ic-btn:hover { background: var(--el-color-primary-light-3); }
.ic-inline { background: var(--el-fill-color-light); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 12px; }
</style>

<style scoped>
.ai-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  border-left: 1px solid var(--el-border-color);
  position: relative;
  flex-shrink: 0;
}

.ai-drag-handle {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 5px;
  cursor: ew-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ai-drag-handle:hover .drag-indicator { background: var(--el-color-primary); }
.drag-indicator { width: 2px; height: 32px; border-radius: 1px; background: var(--el-border-color); transition: background 0.15s; }

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}
.ai-header-left { display: flex; align-items: center; gap: 8px; }
.ai-header-right { display: flex; align-items: center; gap: 2px; }
.ai-title { font-size: 13px; font-weight: 600; }

/* 消息列表 */
.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-welcome { padding: 12px 4px; color: var(--el-text-color-placeholder); font-size: 13px; }

.msg-row { display: flex; width: 100%; }
.msg-user { justify-content: flex-end; }
.msg-ai { justify-content: flex-start; }

/* 用户气泡 */
.msg-user-bubble {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.5;
  max-width: 80%;
  margin-left: auto;
  word-break: break-word;
}

/* AI 回答卡片 */
.msg-text {
  width: 100%;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  word-break: break-word;
}

/* 思考中 */
.msg-thinking {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  padding: 4px 0;
}
.dots::after { content: ''; animation: d 1.5s infinite; }
@keyframes d { 0%,20%{content:'.'} 40%{content:'..'} 60%,100%{content:'...'} }

/* 工具步骤 — 和回答卡片同底色 */
.tool-step {
  width: 100%;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
}
.tool-step-head {
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}
.tool-done .tool-step-head { cursor: pointer; }
.tool-done .tool-step-head:hover .tool-label { color: var(--el-color-primary); }

.spinner {
  width: 10px; height: 10px;
  border: 2px solid var(--el-border-color);
  border-top-color: var(--el-text-color-secondary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.arrow { font-size: 10px; color: var(--el-text-color-placeholder); transition: transform 0.2s; flex-shrink: 0; }
.arrow.open { display: inline-block; transform: rotate(90deg); }

.tool-label { font-size: 12px; color: var(--el-text-color-secondary); flex-shrink: 0; }

.tool-cmd {
  display: block;
  margin-top: 2px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.tool-args-preview {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.tool-result {
  margin-top: 4px;
  padding-left: 2px;
}
.tool-result pre {
  margin: 0;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 确认 */
.confirm-box {
  width: 100%;
  padding: 8px 0;
}
.confirm-label { display: flex; align-items: center; gap: 6px; font-size: 13px; margin-bottom: 6px; color: var(--el-text-color-secondary); }
.confirm-cmd {
  display: block;
  font-family: monospace;
  font-size: 13px;
  padding: 6px 8px;
  background: var(--el-fill-color);
  border-radius: 4px;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}
.confirm-actions { display: flex; gap: 8px; }

/* 错误 */
.msg-error {
  width: 100%;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  padding: 6px 0;
}

/* 输入区域 */
.ai-input-area {
  padding: 10px;
  border-top: 1px solid var(--el-border-color);
  flex-shrink: 0;
}
.input-bar { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
.mode-select { width: 100px; }
</style>
