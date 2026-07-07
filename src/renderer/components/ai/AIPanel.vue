<template>
  <div class="ai-sidebar" :style="{ width: aiStore.sidebarWidth + 'px' }">
    <div class="ai-drag-handle" @mousedown="startDrag"><div class="drag-indicator"></div></div>

    <div class="ai-header">
      <div class="ai-header-left">
        <div class="ai-brand">
          <div class="ai-icon-wrap" :class="currentMode">
            <el-icon :size="14"><ChatDotRound /></el-icon>
          </div>
          <span class="ai-title">AI 助手</span>
        </div>
        <div class="mode-switch">
          <button class="mode-btn" :class="{ active: currentMode === 'qa' }" @click="switchMode('qa')">问答</button>
          <button class="mode-btn" :class="{ active: currentMode === 'agent' }" @click="switchMode('agent')">智能体</button>
        </div>
      </div>
      <div class="ai-header-right">
        <el-tooltip content="清空对话" placement="top" :show-after="300">
          <button class="icon-btn" @click="aiStore.clearMessages(props.tabId)" :disabled="currentMessages.length === 0">
            <el-icon :size="14"><Delete /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip content="关闭面板" placement="top" :show-after="300">
          <button class="icon-btn" @click="emit('close')">
            <el-icon :size="14"><Close /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </div>

    <div v-if="props.sessionHost" class="ai-context-bar">
      <el-icon :size="12"><Connection /></el-icon>
      <span class="context-text">{{ props.sessionUsername }}@{{ props.sessionHost }}</span>
    </div>

    <div class="ai-messages" ref="messagesRef">
      <div v-if="currentMessages.length === 0" class="ai-welcome">
        <div class="welcome-icon"><svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="var(--el-color-primary-light-9)"/><path d="M12 16h16M12 20h10M12 24h14" stroke="var(--el-color-primary)" stroke-width="1.5" stroke-linecap="round"/></svg></div>
        <h3 class="welcome-title">{{ currentMode === 'qa' ? '智能问答' : '智能体模式' }}</h3>
        <p class="welcome-desc">{{ currentMode === 'qa' ? '解释命令、分析错误日志、回答运维问题' : '自主探索服务器环境并执行复杂任务' }}</p>
        <div class="welcome-chips">
          <button v-for="chip in (currentMode === 'qa' ? qaChips : agentChips)" :key="chip" class="chip" @click="useChip(chip)">{{ chip }}</button>
        </div>
      </div>

      <template v-for="(msg, idx) in currentMessages" :key="msg.id">
        <div class="msg-row" :class="[msg.role === 'user' ? 'msg-user' : 'msg-ai', msg.type ? 'msg-' + msg.type : '']" :style="{ animationDelay: Math.min(idx * 30, 200) + 'ms' }">
          <div v-if="msg.role !== 'user'" class="msg-avatar">
            <div class="avatar-ai" :class="{ 'is-thinking': msg.type === 'thinking', 'is-tool': msg.type === 'tool-call' || msg.type === 'tool-result' }">
              <el-icon :size="12"><ChatDotRound /></el-icon>
            </div>
          </div>
          <div class="msg-body">
            <div v-if="msg.role === 'user'" class="bubble-user">
              <span class="bubble-text">{{ msg.content }}</span>
              <span class="bubble-time">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <div v-else-if="msg.type === 'thinking'" class="card-thinking">
              <div class="thinking-dots"><span></span><span></span><span></span></div>
              <span class="thinking-text">{{ msg.content }}</span>
            </div>
            <div v-else-if="msg.type === 'tool-call'" class="card-tool tool-running">
              <div class="tool-indicator"><div class="tool-spinner"></div></div>
              <div class="tool-info">
                <span class="tool-name">{{ toolName(msg.tool) }}</span>
                <code class="tool-cmd">{{ toolArgs(msg.args) }}</code>
              </div>
            </div>
            <div v-else-if="msg.type === 'tool-result'" class="card-tool tool-done">
              <div class="tool-indicator"><el-icon :size="12" class="tool-check"><Select /></el-icon></div>
              <div class="tool-info">
                <div class="tool-head" @click="msg._collapsed = !msg._collapsed">
                  <span class="tool-name">{{ toolName(msg.tool) }}</span>
                  <span class="tool-args-hint">{{ toolArgs(msg.args) }}</span>
                  <el-icon :size="10" class="tool-arrow" :class="{ open: !msg._collapsed }"><ArrowRight /></el-icon>
                </div>
                <transition name="collapse">
                  <div v-if="!msg._collapsed" class="tool-output"><pre>{{ msg.content }}</pre></div>
                </transition>
              </div>
            </div>
            <div v-else-if="msg.type === 'confirm-needed'" class="card-confirm">
              <div class="confirm-header">
                <el-icon :size="14" class="confirm-icon"><WarningFilled /></el-icon>
                <span>{{ msg.level === 'continue' ? '任务执行中' : '需要确认操作' }}</span>
              </div>
              <div class="confirm-command"><code>{{ msg.command }}</code></div>
              <div class="confirm-actions">
                <el-button size="small" type="primary" @click="handleConfirm(true, msg.level)">{{ msg.level === 'continue' ? '继续执行' : '确认' }}</el-button>
                <el-button size="small" @click="handleConfirm(false, msg.level)">{{ msg.level === 'continue' ? '停止' : '拒绝' }}</el-button>
              </div>
            </div>
            <div v-else-if="msg.type === 'error'" class="card-error">
              <el-icon :size="14"><CircleCloseFilled /></el-icon>
              <span>{{ msg.content }}</span>
            </div>
            <div v-else class="card-text">
              <div class="text-content" v-html="renderText(msg.content)"></div>
              <div class="text-actions">
                <button class="action-chip" @click="copyText(msg.content)">
                  <el-icon :size="11"><CopyDocument /></el-icon>复制
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="ai-input-area">
      <div class="input-container" :class="{ focused: inputFocused }">
        <textarea ref="textareaRef" v-model="inputText" class="input-textarea"
          :placeholder="currentMode === 'qa' ? '问我任何运维问题…' : '描述你想执行的任务…'"
          rows="1" @focus="inputFocused = true" @blur="inputFocused = false" @keydown.enter.exact.prevent="sendMessage" @input="autoResize" />
        <div class="input-footer">
          <div class="input-hints">
            <span class="hint-key">Enter</span>
            <span class="hint-label">发送</span>
          </div>
          <div class="input-actions">
            <button v-if="currentLoading" class="send-btn stop-btn" @click="cancelTask">
              <div class="stop-icon"></div>停止
            </button>
            <button v-else class="send-btn" :disabled="!inputText.trim() || !aiStore.isConfigured" @click="sendMessage">
              <el-icon :size="14"><Promotion /></el-icon>
            </button>
          </div>
        </div>
      </div>
      <div class="input-status" v-if="!aiStore.isConfigured">
        <el-icon :size="12"><WarningFilled /></el-icon>
        <span>请先在设置中配置 AI 服务</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useAIStore } from '../../stores/aiStore'
import { ElMessage } from 'element-plus'
import { Delete, Close, ChatDotRound, Connection, Select, ArrowRight, WarningFilled, CircleCloseFilled, CopyDocument, Promotion } from '@element-plus/icons-vue'

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
const inputFocused = ref(false)
const messagesRef = ref<HTMLElement>()
const textareaRef = ref<HTMLTextAreaElement>()

const currentMessages = computed(() => aiStore.getMessages(props.tabId))
const currentLoading = computed(() => aiStore.isLoading(props.tabId))
const currentMode = computed(() => aiStore.getMode(props.tabId))

const qaChips = ['这个命令是什么意思？', '帮我分析错误日志', '如何查看系统资源占用？']
const agentChips = ['检查服务器磁盘使用情况', '查找占用端口的进程', '清理 tmp 目录大文件']

function useChip(text: string) {
  inputText.value = text
  nextTick(() => sendMessage())
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
}

function startDrag(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = aiStore.sidebarWidth
  const onMove = (ev: MouseEvent) => aiStore.setWidth(Math.max(280, startWidth + (startX - ev.clientX)))
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function scrollToBottom() {
  nextTick(() => { if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight })
}

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

function switchMode(m: 'qa' | 'agent') { aiStore.setMode(props.tabId, m) }

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || currentLoading.value) return
  if (!aiStore.isConfigured) {
    aiStore.addMessage(props.tabId, { role: 'assistant', content: '请先在设置中配置 AI 服务', type: 'error' })
    return
  }
  aiStore.addMessage(props.tabId, { role: 'user', content: text })
  inputText.value = ''
  if (textareaRef.value) textareaRef.value.style.height = 'auto'
  aiStore.setLoading(props.tabId, true)
  scrollToBottom()
  try {
    const { baseUrl, apiKey, model } = aiStore.config
    await window.electronAPI.aiConfigure({ baseUrl, apiKey, model })
    const ctx = { host: props.sessionHost || '', port: props.sessionPort || 22, username: props.sessionUsername || '', currentDir: '', frequentCommands: [], recentOutput: '' }
    if (currentMode.value === 'qa') await window.electronAPI.aiAsk(props.tabId, text, ctx, [])
    else await window.electronAPI.aiAgent(props.tabId, text, ctx, [])
  } catch (err) {
    aiStore.addMessage(props.tabId, { role: 'assistant', content: '请求失败: ' + (err as Error).message, type: 'error' })
  } finally {
    aiStore.setLoading(props.tabId, false)
    scrollToBottom()
  }
}

function executeCommand(cmd: string) { emit('writeToShell', cmd); aiStore.addMessage(props.tabId, { role: 'assistant', content: '已发送到终端: ' + cmd, type: 'text' }) }
async function copyCommand(cmd: string) { try { await navigator.clipboard.writeText(cmd); ElMessage.success('已复制到剪贴板') } catch {} }
async function copyText(text: string) { try { await navigator.clipboard.writeText(text); ElMessage.success('已复制') } catch {} }

async function handleConfirm(ok: boolean, level?: string) {
  if (level === 'continue') await window.electronAPI.aiContinue(props.tabId, ok)
  else await window.electronAPI.aiConfirm(props.tabId, ok)
  aiStore.setPendingConfirm(props.tabId, null)
}
async function cancelTask() { await window.electronAPI.aiCancel(props.tabId); aiStore.setLoading(props.tabId, false) }

function toolArgs(args: any): string { if (!args) return ''; if (args.command) return '$ ' + args.command; if (args.path) return args.path; return JSON.stringify(args) }
function toolName(t?: string): string { const m: Record<string, string> = { executeCommand: '执行命令', readFile: '读取文件', listDirectory: '列出目录', searchFiles: '搜索文件' }; return m[t || ''] || t || '工具调用' }

function renderText(content: string): string {
  let h = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  h = h.replace(/```(?:command|bash|sh)?\s*\n([\s\S]*?)```/g, (_: string, code: string) => {
    const cmds = code.trim().split('\n').filter((l: string) => l.trim() && !l.trim().startsWith('#'))
    return cmds.map((c: string) => {
      const cmd = c.replace(/^\s*[$>]\s*/, '').trim()
      if (!cmd) return ''
      return '<div class="ic"><div class="ic-head"><code>' + cmd + '</code></div><div class="ic-acts"><button class="ic-btn" onclick="window.__aiExecute(\x27' + cmd.replace(/'/g, '\\\'') + '\x27)"><span class="ic-btn-icon">▶</span>执行</button><button class="ic-btn" onclick="window.__aiCopy(\x27' + cmd.replace(/'/g, '\\\'') + '\x27)"><span class="ic-btn-icon">⎘</span>复制</button></div></div>'
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
.ic { border: 1px solid var(--el-border-color-lighter); border-left: 3px solid var(--el-color-primary); padding: 10px 12px; margin: 10px 0; background: var(--el-fill-color); border-radius: 6px; transition: border-color 0.2s; }
.ic:hover { border-color: var(--el-color-primary-light-5); }
.ic-head { font-family: 'Cascadia Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace; font-size: 12px; line-height: 1.6; }
.ic-head code { color: var(--el-text-color-primary); }
.ic-acts { display: flex; gap: 6px; margin-top: 8px; }
.ic-btn { display: inline-flex; align-items: center; gap: 4px; background: var(--el-color-primary-light-9); border: 1px solid var(--el-color-primary-light-7); border-radius: 4px; padding: 3px 10px; font-size: 12px; cursor: pointer; color: var(--el-color-primary); transition: all 0.15s; }
.ic-btn:hover { background: var(--el-color-primary-light-7); border-color: var(--el-color-primary-light-5); }
.ic-btn-icon { font-size: 10px; }
.ic-inline { background: var(--el-fill-color); padding: 1px 5px; border-radius: 3px; font-family: 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace; font-size: 11.5px; border: 1px solid var(--el-border-color-lighter); }
</style>

<style scoped>
.ai-sidebar { display: flex; flex-direction: column; height: 100%; background: var(--el-bg-color); border-left: 1px solid var(--el-border-color); position: relative; flex-shrink: 0; overflow: hidden; }
.ai-drag-handle { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; cursor: ew-resize; z-index: 10; display: flex; align-items: center; justify-content: center; }
.ai-drag-handle:hover .drag-indicator, .ai-drag-handle:active .drag-indicator { background: var(--el-color-primary); opacity: 1; }
.drag-indicator { width: 2px; height: 36px; border-radius: 1px; background: var(--el-border-color); opacity: 0.5; transition: all 0.2s; }
.ai-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px 8px 14px; border-bottom: 1px solid var(--el-border-color); flex-shrink: 0; min-height: 42px; }
.ai-header-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.ai-header-right { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.ai-brand { display: flex; align-items: center; gap: 7px; }
.ai-icon-wrap { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.ai-icon-wrap.qa { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.ai-icon-wrap.agent { background: var(--el-color-success-light-9); color: var(--el-color-success); }
.ai-title { font-size: 13px; font-weight: 600; color: var(--el-text-color-primary); }
.mode-switch { display: flex; background: var(--el-fill-color); border-radius: 6px; padding: 2px; gap: 1px; }
.mode-btn { border: none; background: transparent; padding: 3px 10px; font-size: 11.5px; border-radius: 4px; cursor: pointer; color: var(--el-text-color-secondary); transition: all 0.2s; font-weight: 500; }
.mode-btn:hover { color: var(--el-text-color-primary); }
.mode-btn.active { background: var(--el-bg-color); color: var(--el-color-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
.icon-btn { width: 28px; height: 28px; border: none; background: transparent; border-radius: 5px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--el-text-color-secondary); transition: all 0.15s; }
.icon-btn:hover { background: var(--el-fill-color); color: var(--el-text-color-primary); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ai-context-bar { display: flex; align-items: center; gap: 6px; padding: 5px 14px; background: var(--el-fill-color-lighter); border-bottom: 1px solid var(--el-border-color-lighter); color: var(--el-text-color-secondary); flex-shrink: 0; }
.context-text { font-family: 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace; font-size: 11px; }
.ai-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; scroll-behavior: smooth; }
.ai-welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 20px; text-align: center; gap: 12px; }
.welcome-icon { opacity: 0.9; }
.welcome-title { font-size: 16px; font-weight: 600; color: var(--el-text-color-primary); margin: 0; }
.welcome-desc { font-size: 12.5px; color: var(--el-text-color-placeholder); margin: 0; line-height: 1.5; }
.welcome-chips { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; width: 100%; max-width: 280px; }
.chip { width: 100%; text-align: left; padding: 8px 12px; font-size: 12.5px; border: 1px solid var(--el-border-color); border-radius: 8px; background: var(--el-bg-color); color: var(--el-text-color-regular); cursor: pointer; transition: all 0.2s; line-height: 1.4; }
.chip:hover { border-color: var(--el-color-primary-light-5); background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.msg-row { display: flex; gap: 8px; width: 100%; animation: msg-in 0.25s ease-out both; }
@keyframes msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.msg-user { justify-content: flex-end; }
.msg-ai { justify-content: flex-start; }
.msg-avatar { flex-shrink: 0; padding-top: 2px; }
.avatar-ai { width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: var(--el-color-primary-light-9); color: var(--el-color-primary); transition: all 0.2s; }
.avatar-ai.is-thinking { background: var(--el-fill-color); color: var(--el-text-color-placeholder); animation: pulse 1.5s ease-in-out infinite; }
.avatar-ai.is-tool { background: var(--el-color-warning-light-9); color: var(--el-color-warning); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.msg-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.bubble-user { margin-left: auto; max-width: 85%; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.bubble-text { background: var(--el-color-primary); color: #fff; border-radius: 12px 12px 4px 12px; padding: 8px 14px; font-size: 13px; line-height: 1.55; word-break: break-word; }
.bubble-time { font-size: 10.5px; color: var(--el-text-color-placeholder); padding-right: 4px; }
.card-thinking { display: flex; align-items: center; gap: 8px; padding: 8px 12px; }
.thinking-dots { display: flex; gap: 3px; }
.thinking-dots span { width: 5px; height: 5px; border-radius: 50%; background: var(--el-text-color-placeholder); animation: dot-bounce 1.2s ease-in-out infinite; }
.thinking-dots span:nth-child(2) { animation-delay: 0.15s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.3s; }
@keyframes dot-bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
.thinking-text { font-size: 12.5px; color: var(--el-text-color-placeholder); }
.card-tool { width: 100%; display: flex; gap: 10px; background: var(--el-fill-color-lighter); border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 8px 10px; transition: border-color 0.2s; }
.card-tool:hover { border-color: var(--el-border-color); }
.tool-indicator { flex-shrink: 0; width: 22px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; }
.tool-running .tool-indicator { background: var(--el-color-warning-light-9); }
.tool-done .tool-indicator { background: var(--el-color-success-light-9); color: var(--el-color-success); }
.tool-spinner { width: 12px; height: 12px; border: 2px solid var(--el-color-warning-light-5); border-top-color: var(--el-color-warning); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.tool-check { color: var(--el-color-success); }
.tool-info { flex: 1; min-width: 0; }
.tool-name { font-size: 12px; font-weight: 500; color: var(--el-text-color-regular); }
.tool-cmd { display: block; margin-top: 3px; font-family: 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace; font-size: 11.5px; color: var(--el-text-color-primary); word-break: break-all; line-height: 1.5; }
.tool-head { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 2px 0; }
.tool-head:hover .tool-name { color: var(--el-color-primary); }
.tool-args-hint { flex: 1; min-width: 0; font-family: 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace; font-size: 11px; color: var(--el-text-color-placeholder); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tool-arrow { color: var(--el-text-color-placeholder); transition: transform 0.2s; flex-shrink: 0; }
.tool-arrow.open { transform: rotate(90deg); }
.tool-output { margin-top: 6px; padding: 8px; background: var(--el-fill-color); border-radius: 5px; border: 1px solid var(--el-border-color-lighter); }
.tool-output pre { margin: 0; font-family: 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace; font-size: 11px; color: var(--el-text-color-secondary); max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; line-height: 1.5; }
.collapse-enter-active, .collapse-leave-active { transition: all 0.2s ease; overflow: hidden; }
.collapse-enter-from, .collapse-leave-to { opacity: 0; max-height: 0; margin-top: 0; padding: 0; }
.collapse-enter-to, .collapse-leave-from { opacity: 1; max-height: 500px; }
.card-confirm { width: 100%; background: var(--el-color-warning-light-9); border: 1px solid var(--el-color-warning-light-7); border-radius: 8px; padding: 12px; }
.confirm-header { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--el-color-warning-dark-2); margin-bottom: 8px; }
.confirm-icon { color: var(--el-color-warning); }
.confirm-command { background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); border-radius: 5px; padding: 8px 10px; margin-bottom: 10px; }
.confirm-command code { font-family: 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace; font-size: 12.5px; color: var(--el-text-color-primary); word-break: break-all; }
.confirm-actions { display: flex; gap: 8px; }
.card-error { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: var(--el-color-danger-light-9); border: 1px solid var(--el-color-danger-light-7); border-radius: 8px; font-size: 12.5px; color: var(--el-color-danger); line-height: 1.5; }
.card-text { width: 100%; background: var(--el-fill-color-lighter); border: 1px solid var(--el-border-color-lighter); border-radius: 10px; padding: 10px 14px; font-size: 13px; line-height: 1.65; color: var(--el-text-color-primary); word-break: break-word; transition: border-color 0.2s; }
.card-text:hover { border-color: var(--el-border-color); }
.text-actions { display: flex; gap: 6px; margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--el-border-color-lighter); opacity: 0; transition: opacity 0.2s; }
.card-text:hover .text-actions { opacity: 1; }
.action-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid var(--el-border-color); border-radius: 4px; background: var(--el-bg-color); font-size: 11px; color: var(--el-text-color-secondary); cursor: pointer; transition: all 0.15s; }
.action-chip:hover { border-color: var(--el-color-primary-light-5); color: var(--el-color-primary); }
.ai-input-area { padding: 10px 12px 8px; border-top: 1px solid var(--el-border-color); flex-shrink: 0; }
.input-container { border: 1.5px solid var(--el-border-color); border-radius: 10px; background: var(--el-bg-color); transition: all 0.2s; overflow: hidden; }
.input-container.focused { border-color: var(--el-color-primary-light-3); box-shadow: 0 0 0 2px var(--el-color-primary-light-9); }
.input-textarea { width: 100%; border: none; outline: none; resize: none; padding: 10px 12px 4px; font-size: 13px; line-height: 1.5; font-family: inherit; color: var(--el-text-color-primary); background: transparent; min-height: 36px; max-height: 120px; }
.input-textarea::placeholder { color: var(--el-text-color-placeholder); }
.input-footer { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px 6px; }
.input-hints { display: flex; align-items: center; gap: 4px; }
.hint-key { font-size: 10px; padding: 1px 5px; background: var(--el-fill-color); border: 1px solid var(--el-border-color-lighter); border-radius: 3px; color: var(--el-text-color-placeholder); font-family: inherit; }
.hint-label { font-size: 10.5px; color: var(--el-text-color-placeholder); }
.input-actions { display: flex; align-items: center; }
.send-btn { width: 30px; height: 26px; border: none; border-radius: 6px; background: var(--el-color-primary); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; font-size: 12px; gap: 4px; }
.send-btn:hover { background: var(--el-color-primary-light-3); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.stop-btn { width: auto; padding: 0 10px; background: var(--el-color-danger); }
.stop-btn:hover { background: var(--el-color-danger-light-3); }
.stop-icon { width: 8px; height: 8px; background: #fff; border-radius: 2px; }
.input-status { display: flex; align-items: center; gap: 5px; margin-top: 6px; font-size: 11.5px; color: var(--el-color-warning); }
@media (max-width: 400px) {
  .ai-header { padding: 6px 8px; }
  .mode-switch { display: none; }
  .ai-messages { padding: 8px; }
  .bubble-text { font-size: 12.5px; }
}
</style>