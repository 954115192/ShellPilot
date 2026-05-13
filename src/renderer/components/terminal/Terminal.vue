<template>
  <div class="terminal-wrapper" @contextmenu.prevent="handleContextMenu" @mousedown="handleContainerClick">
    <div class="terminal-area">
      <div ref="terminalRef" class="terminal"></div>
      <CommandSuggestion
        :visible="suggestionsVisible"
        :suggestions="suggestions"
        :selected-index="suggestionIndex"
        :x="suggestionPos.x"
        :y="suggestionPos.y"
        :flip-above="suggestionFlip"
        @select="handleSuggestionSelect"
      />

      <!-- AI 侧边栏 -->
      <AIPanel
        v-if="showAI"
        :tab-id="session?.tabId || ''"
        :session-host="session?.host"
        :session-port="session?.port"
        :session-username="session?.username"
        :initial-question="aiInitialQuestion"
        @close="showAI = false"
        @write-to-shell="handleAIWriteToShell"
        class="ai-sidebar-instance"
      />
    </div>

    <!-- 扩展面板（文件/状态） -->
    <div v-if="activePanel" class="extension-panel" :style="{ height: panelHeight + 'px' }">
        <div class="panel-drag-handle" @mousedown="startDrag">
          <div class="drag-indicator"></div>
        </div>
        <div class="panel-content">
          <FileBrowser v-if="activePanel === 'file'" :tab-id="session?.tabId || ''" @close="activePanel = null" />
          <StatsView v-else-if="activePanel === 'stats'" :tab-id="session?.tabId || ''" @close="activePanel = null" />
        </div>
      </div>

    <!-- 底部工具栏 -->
    <div class="bottom-toolbar">
      <div class="toolbar-left">
        <el-divider direction="vertical" />
        <el-tooltip content="文件浏览器" placement="top-end" :show-after="300">
          <el-button
            size="small"
            :type="activePanel === 'file' ? 'primary' : ''"
            @click="togglePanel('file')"
          >
            <el-icon><FolderOpened /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="性能监控" placement="top-end" :show-after="300">
          <el-button
            size="small"
            :type="activePanel === 'stats' ? 'primary' : ''"
            @click="togglePanel('stats')"
          >
            <el-icon><DataLine /></el-icon>
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical" />
        <!-- 搜索 -->
        <transition name="search-slide">
          <div v-if="showSearch" class="search-bar">
            <el-button size="small" @click="closeSearch">✕</el-button>
            <el-input
              v-model="searchText"
              @input="doSearch"
              placeholder="搜索..."
              size="small"
              clearable
              class="search-input-inline"
            />
            <span class="search-count">{{ searchResults.current }}/{{ searchResults.total }}</span>
            <el-button size="small" @click="searchPrev">◀</el-button>
            <el-button size="small" @click="searchNext">▶</el-button>
          </div>
        </transition>
        <el-tooltip v-if="!showSearch" content="搜索" placement="top-end" :show-after="300">
          <el-button size="small" @click="showSearch = true">
            <el-icon><Search /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
      <div class="toolbar-right">
        <el-tooltip content="清屏" placement="top-end" :show-after="300">
          <el-button size="small" @click="clearTerminal">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="常用命令" placement="top-end" :show-after="300">
          <el-button size="small" @click="showHistoryDialog = true">
            <el-icon><Clock /></el-icon>
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical" />
        <!-- 传输记录 -->
        <el-popover
          :visible="showTransferHistory"
          placement="top"
          :width="360"
          trigger="click"
        >
          <template #reference>
            <div
              class="transfer-icon-wrapper"
              @click="showTransferHistory = !showTransferHistory"
            >
              <el-progress
                v-if="transferStore.hasActiveTransfers"
                type="circle"
                :percentage="transferStore.overallProgress"
                :indeterminate="transferStore.overallProgress === 0"
                :width="22"
                :stroke-width="2"
                :show-text="false"
                color="#E6A23C"
              />
              <el-icon v-else :size="16" class="transfer-icon"><Promotion /></el-icon>
            </div>
          </template>
          <div class="transfer-history-content">
            <div class="transfer-history-header">
              <span>传输记录</span>
              <el-button size="small" text @click="transferStore.clearCompleted()">清除已完成</el-button>
            </div>
            <div class="transfer-list" v-if="transferStore.transfers.length > 0">
              <div
                v-for="item in transferStore.transfers"
                :key="item.id"
                class="transfer-item"
                :class="item.status"
              >
                <div class="transfer-info">
                  <el-icon :size="14" :class="item.type">
                    <Upload v-if="item.type === 'upload'" />
                    <Download v-else />
                  </el-icon>
                  <span class="transfer-name">{{ item.name }}</span>
                  <el-tag :type="getStatusType(item.status)" size="small">{{ getStatusText(item.status) }}</el-tag>
                </div>
                <div class="transfer-actions">
                  <el-button
                    v-if="item.status === 'transferring'"
                    size="small"
                    type="danger"
                    text
                    @click="cancelTransfer(item)"
                  >
                    取消
                  </el-button>
                  <el-button size="small" text @click="transferStore.removeTransfer(item.id)">
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
                <div v-if="item.status === 'transferring'" class="transfer-progress-bar">
                  <el-progress
                    v-if="item.size > 0"
                    :percentage="Math.round((item.transferred / item.size) * 100)"
                    :stroke-width="6"
                    :format="(p: number) => formatSize(item.transferred) + '/' + formatSize(item.size)"
                  />
                  <span v-else class="transfer-status-text">传输中...</span>
                </div>
                <div v-else-if="item.status === 'completed'" class="transfer-done">
                  <span>{{ formatSize(item.size) }}</span>
                  <span class="transfer-duration">{{ formatDuration(item.startTime, item.endTime) }}</span>
                </div>
                <div v-else-if="item.status === 'failed'" class="transfer-error">
                  <span>{{ item.error }}</span>
                </div>
              </div>
            </div>
            <div v-else class="transfer-empty">暂无传输记录</div>
          </div>
        </el-popover>
        <span class="connection-status" :class="{ connected: connected }">
          <el-icon v-if="connected"><CircleCheck /></el-icon>
          <el-icon v-else><CircleClose /></el-icon>
          {{ connected ? '已连接' : '未连接' }}
        </span>
        <el-tooltip v-if="!connected" content="重新连接" placement="top" :show-after="300">
          <el-button size="small" type="warning" @click="reconnect">
            <el-icon><Connection /></el-icon>
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical" />
        <el-tooltip :content="showAI ? '关闭 AI' : 'AI 助手'" placement="top" :show-after="300">
          <el-button
            size="small"
            :type="showAI ? 'primary' : ''"
            @click="showAI = !showAI"
          >
            <el-icon><MagicStick /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 常用命令对话框 -->
    <el-dialog
      v-model="showHistoryDialog"
      title="常用命令"
      width="500px"
      destroy-on-close
    >
      <div class="history-dialog-content">
        <div class="history-dialog-header">
          <span class="history-count">共 {{ frequentRecords.length }} 条记录</span>
          <el-button type="danger" size="small" plain @click="clearHistory" :disabled="frequentRecords.length === 0">
            清空
          </el-button>
        </div>
        <el-table :data="frequentRecords" style="width: 100%" size="small" empty-text="暂无常用命令" max-height="350">
          <el-table-column prop="command" label="命令" min-width="250">
            <template #default="{ row }">
              <code class="command-text">{{ row.command }}</code>
            </template>
          </el-table-column>
          <el-table-column prop="useCount" label="次数" width="70" sortable />
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-tooltip content="添加为全局快捷命令" placement="top" :show-after="500">
                <el-button size="small" type="primary" plain @click="addAsQuickCommand(row.command)">
                  <el-icon><CirclePlus /></el-icon>
                </el-button>
              </el-tooltip>
              <el-button size="small" type="danger" plain @click="deleteHistoryItem(row.command)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 右键菜单 -->
    <el-dropdown
        ref="termMenuDropdownRef"
        :virtual-ref="triggerRef"
        trigger="click"
        virtual-triggering
        :show-arrow="false"
        @command="handleTermMenuCommand"
        @visible-change="onTermMenuVisibleChange"
    >
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="copy">
            <el-icon><CopyDocument /></el-icon> 复制
          </el-dropdown-item>
          <el-dropdown-item command="paste">
            <el-icon><Upload /></el-icon> 粘贴
          </el-dropdown-item>
          <el-dropdown-item v-if="selectedText" command="askAI" divided>
            <el-icon><MagicStick /></el-icon> 询问 AI
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import 'xterm/css/xterm.css';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete, Connection, CircleCheck, CircleClose, FolderOpened, DataLine, CopyDocument, Upload, Download, Search, Clock, Close, Promotion, MagicStick, CirclePlus } from '@element-plus/icons-vue';
import FileBrowser from '../files/FileBrowser.vue';
import StatsView from '../../views/StatsView.vue';
import CommandSuggestion from './CommandSuggestion.vue';
import { useSettingsStore } from '../../stores/settingsStore';

const settingsStore = useSettingsStore();
import { useCommandStore, makeConnKey } from '../../stores/commandStore';
import { useTransferStore } from '../../stores/transferStore';
import { useAIStore } from '../../stores/aiStore';
import AIPanel from '../ai/AIPanel.vue';

interface SessionInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  connected?: boolean;
  tabId?: string;
}

const props = defineProps<{
  session?: SessionInfo;
  isDark?: boolean;
}>();

const terminalRef = ref<HTMLElement | null>(null);
const connected = ref(false);

const terminal = ref<Terminal | null>(null);
const fitAddon = ref<FitAddon | null>(null);
const shellConnected = ref(false);
const resizeObserver = ref<ResizeObserver | null>(null);
const activePanel = ref<'file' | 'stats' | null>(null);
const panelHeight = ref(Math.round(window.innerHeight * 2 / 3));
const isDragging = ref(false);

// 搜索相关
const searchAddon = ref<SearchAddon | null>(null);
const showSearch = ref(false);
const searchText = ref('');
const searchResults = ref<{ current: number; total: number }>({ current: 0, total: 0 });

// 命令建议相关
const commandStore = useCommandStore()
const suggestions = ref<string[]>([])
const suggestionIndex = ref(-1)
const suggestionsVisible = ref(false)
const suggestionPos = ref({ x: 0, y: 0 })
const suggestionFlip = ref(false)
const currentInput = ref('')

// 常用命令相关
const connKey = computed(() => {
  if (props.session) {
    return makeConnKey(props.session.host, props.session.port, props.session.username)
  }
  return 'default'
})

const showHistoryDialog = ref(false)
const frequentRecords = computed(() => {
  return commandStore.getFrequentByConn(connKey.value)
})

// 传输记录相关
const transferStore = useTransferStore()
const showTransferHistory = ref(false)

// AI 相关
const aiStore = useAIStore()
const showAI = ref(false)
const aiInitialQuestion = ref('')
const selectedText = ref('')

// 传输历史辅助函数
const getStatusType = (status: string) => {
  switch (status) {
    case 'transferring': return 'warning'
    case 'completed': return 'success'
    case 'failed': return 'danger'
    default: return 'info'
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending': return '等待'
    case 'transferring': return '传输中'
    case 'completed': return '完成'
    case 'failed': return '失败'
    default: return status
  }
}

const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

const formatDuration = (start: number, end?: number) => {
  const duration = ((end || Date.now()) - start) / 1000
  if (duration < 1) return '不到1秒'
  if (duration < 60) return `${Math.round(duration)}秒`
  if (duration < 3600) return `${Math.round(duration / 60)}分${Math.round(duration % 60)}秒`
  return `${Math.round(duration / 3600)}小时`
}

const cancelTransfer = async (item: any) => {
  try {
    await window.electronAPI.cancelTransfer(item.tabId, item.id)
    transferStore.failTransfer(item.id, '已取消')
  } catch (error) {
    console.error('Failed to cancel transfer:', error)
  }
}

// 终端主题（从 settingsStore 获取用户配置的预设主题）
const getTerminalTheme = () => {
  const t = settingsStore.getTerminalTheme()
  return {
    background: t.background,
    foreground: t.foreground,
    cursor: t.cursor,
    cursorAccent: t.cursorAccent,
    selectionBackground: t.selectionBackground,
    selectionForeground: t.selectionForeground,
    black: t.black,
    red: t.red,
    green: t.green,
    yellow: t.yellow,
    blue: t.blue,
    magenta: t.magenta,
    cyan: t.cyan,
    white: t.white,
    brightBlack: t.brightBlack,
    brightRed: t.brightRed,
    brightGreen: t.brightGreen,
    brightYellow: t.brightYellow,
    brightBlue: t.brightBlue,
    brightMagenta: t.brightMagenta,
    brightCyan: t.brightCyan,
    brightWhite: t.brightWhite,
  }
}

const position = ref({
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
})
const triggerRef = ref({
  getBoundingClientRect: () => position.value,
})

const togglePanel = (panel: 'file' | 'stats') => {
  activePanel.value = activePanel.value === panel ? null : panel;
  // 重置 drag 状态
  isDragging.value = false;
};

const startDrag = (e: MouseEvent) => {
  e.preventDefault();
  isDragging.value = true;
  const startY = e.clientY;
  const startHeight = panelHeight.value;

  const onMouseMove = (ev: MouseEvent) => {
    const delta = startY - ev.clientY;
    const newHeight = Math.max(80, startHeight + delta);
    panelHeight.value = newHeight;
  };

  const onMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

// 扩展面板打开/关闭/拖拽后重新 fit 终端
watch([activePanel, panelHeight], () => {
  nextTick(() => fit());
});

// 右键菜单（el-dropdown 手动触发）
const termMenuDropdownRef = ref();
const termMenuVisible = ref(false);

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  if (termMenuVisible.value) {
    termMenuDropdownRef.value.handleClose();
  }
  setTimeout(() => {
    const { clientX, clientY } = event
    position.value = DOMRect.fromRect({
      x: clientX,
      y: clientY,
    })
    termMenuDropdownRef.value.handleOpen();
  }, 50);
};

const handleTermMenuCommand = async (command: string) => {
  if (command === 'copy') {
    const term = terminal.value;
    if (!term) return;
    const selection = term.getSelection();
    if (selection) {
      try {
        await navigator.clipboard.writeText(selection);
      } catch {}
    }
  } else if (command === 'paste') {
    try {
      const text = await navigator.clipboard.readText();
      if (props.session?.tabId && shellConnected.value) {
        window.electronAPI.writeToShell(props.session.tabId, text);
      } else if (terminal.value) {
        terminal.value.write(text);
      }
    } catch {}
  } else if (command === 'askAI') {
    const term = terminal.value;
    if (term) {
      const selection = term.getSelection();
      if (selection) {
        selectedText.value = selection;
        aiInitialQuestion.value = selection;
        showAI.value = true;
        // 清除终端选中
        term.clearSelection();
      }
    }
  }
};

// AI 写入 shell
const handleAIWriteToShell = (command: string) => {
  if (props.session?.tabId && shellConnected.value) {
    window.electronAPI.writeToShell(props.session.tabId, command + '\n');
  }
};

const onTermMenuVisibleChange = (visible: boolean) => {
  termMenuVisible.value = visible;
};

const shellDataHandler = ref<((tabId: string, data: string) => void) | null>(null);
const shellCloseHandler = ref<((tabId: string) => void) | null>(null);
const sshErrorHandler = ref<((tabId: string, error: string) => void) | null>(null);
const sshDisconnectHandler = ref<((tabId: string) => void) | null>(null);
let pasteHandler: ((e: ClipboardEvent) => void) | null = null;

const initTerminal = () => {
  if (!terminalRef.value) return;

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: getTerminalTheme(),
    scrollback: 10000,
    tabStopWidth: 4,
    convertEol: true,
    allowProposedApi: true,
  });

  terminal.value = term;

  const fitAddonInstance = new FitAddon();
  term.loadAddon(fitAddonInstance);
  fitAddon.value = fitAddonInstance;

  const searchAddonInstance = new SearchAddon();
  term.loadAddon(searchAddonInstance);
  searchAddon.value = searchAddonInstance;
  searchAddonInstance.onDidChangeResults((results) => {
    if (results.resultCount > 0) {
      searchResults.value = { current: results.resultIndex + 1, total: results.resultCount };
    }
  });

  term.open(terminalRef.value);

  // 立即 fit
  if (fitAddonInstance) {
    fitAddonInstance.fit();
  }

  resizeObserver.value = new ResizeObserver(() => {
    fit();
  });
  resizeObserver.value.observe(terminalRef.value);

  // 粘贴事件：capture 阶段拦截，避免 xterm 重复处理
  pasteHandler = (e: ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = e.clipboardData?.getData('text');
    if (text && shellConnected.value && props.session?.tabId) {
      window.electronAPI.writeToShell(props.session.tabId, text);
    }
  };
  terminalRef.value.addEventListener('paste', pasteHandler, true);

  // Ctrl+C / Ctrl+V 智能切换
  term.attachCustomKeyEventHandler((ev: KeyboardEvent) => {
    if (ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      // Ctrl+C: 有选中→复制，无选中→发送 SIGINT
      if (ev.key === 'c' && ev.type === 'keydown') {
        const selection = term.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          ElMessage({ message: '已复制', type: 'success', duration: 1200, grouping: true });
          return false; // 阻止 xterm 处理（不发送 \x03）
        }
        return true; // 无选中，正常发送 SIGINT
      }
      // Ctrl+V: 阻止 xterm 默认处理，改由下方 paste 事件监听处理
      if (ev.key === 'v' && ev.type === 'keydown') {
        return false;
      }
    }
    return true;
  });

  term.onData((data) => {
    if (shellConnected.value && props.session?.tabId) {
      handleShellInput(data);
    } else {
      handleLocalInput(data, term);
    }
  });

  term.onResize((size) => {
    if (props.session?.tabId && shellConnected.value) {
      window.electronAPI.resizeShell(props.session.tabId, size.cols, size.rows);
    }
  });

  showWelcomePrompt();
};

const fit = () => {
  if (fitAddon.value && terminal.value) {
    fitAddon.value.fit();
  }
};

const showWelcomePrompt = () => {
  const term = terminal.value;
  if (!term) return;
  term.write('\x1b[1;32m$\x1b[0m ');
};

const handleLocalInput = (data: string, term: Terminal) => {
  const code = data.charCodeAt(0);

  // 断连状态下任意输入都触发重连
  if (!shellConnected.value && props.session?.tabId) {
    reconnect();
    return;
  }

  if (code === 13) {
    term.write('\r\n');
    showWelcomePrompt();
  } else if (code === 3) {
    term.write('^C\r\n');
    showWelcomePrompt();
  } else if (code === 12) {
    term.clear();
    showWelcomePrompt();
  } else if (code >= 32 && code <= 126) {
    term.write(data);
  }
};

// 命令建议相关函数
let cursorMoveDisposable: { dispose(): void } | null = null
let scrollDisposable: { dispose(): void } | null = null

const updateSuggestions = () => {
  if (currentInput.value.length === 0) {
    hideSuggestions()
    return
  }
  const results = commandStore.searchSuggestions(connKey.value, currentInput.value)
  // 第一个永远是用户当前输入的内容
  const all = [currentInput.value, ...results.filter(r => r !== currentInput.value)]
  suggestions.value = all
  if (all.length > 1) {
    suggestionIndex.value = 0
    suggestionsVisible.value = true
    startFollowingCursor()
  } else {
    hideSuggestions()
  }
}

const hideSuggestions = () => {
  suggestionsVisible.value = false
  suggestionIndex.value = -1
  lastPositionKey = ''
  stopFollowingCursor()
}

// 持续跟随光标位置
const startFollowingCursor = () => {
  stopFollowingCursor()
  const term = terminal.value
  if (!term) return
  // 光标移动或视口滚动时更新位置，而非每帧轮询
  cursorMoveDisposable = term.onCursorMove(() => {
    if (suggestionsVisible.value) updateSuggestionPosition()
  })
  scrollDisposable = term.onScroll(() => {
    if (suggestionsVisible.value) updateSuggestionPosition()
  })
  // 首次立即算一次
  updateSuggestionPosition()
}

const stopFollowingCursor = () => {
  cursorMoveDisposable?.dispose()
  cursorMoveDisposable = null
  scrollDisposable?.dispose()
  scrollDisposable = null
}

let lastPositionKey = ''

const updateSuggestionPosition = () => {
  const term = terminal.value
  if (!term || !term.element) return

  const cursorX = term.buffer.active.cursorX
  const cursorY = term.buffer.active.cursorY
  const viewportY = term.buffer.active.viewportY
  const baseY = term.buffer.active.baseY

  // 位置没变就不更新
  const key = `${cursorX}-${cursorY}-${viewportY}-${baseY}`
  if (key === lastPositionKey) return
  lastPositionKey = key

  const screenElement = term.element.querySelector('.xterm-screen') as HTMLElement
  if (!screenElement) return

  const rect = screenElement.getBoundingClientRect()
  const cellWidth = rect.width / term.cols
  const cellHeight = rect.height / term.rows

  // cursorY 相对于 baseY，需要减去 (viewportY - baseY) 得到视觉行号
  const visualY = cursorY - (viewportY - baseY)

  let x = rect.left + cursorX * cellWidth

  // 判断下方空间是否足够
  const spaceBelow = rect.height - (visualY + 1) * cellHeight
  const maxPossibleHeight = 8 * 28 + 4
  const shouldFlip = spaceBelow < maxPossibleHeight
  suggestionFlip.value = shouldFlip

  let y = shouldFlip
    ? rect.top + visualY * cellHeight
    : rect.top + (visualY + 1) * cellHeight + 2

  // 避免超出右边界
  const panelWidth = 300
  if (x + panelWidth > window.innerWidth) {
    x = window.innerWidth - panelWidth
  }
  suggestionPos.value = { x, y }
}

const handleSuggestionSelect = (command: string) => {
  const tabId = props.session?.tabId
  if (!tabId) return

  // 清除当前输入（发送退格）
  for (let i = 0; i < currentInput.value.length; i++) {
    window.electronAPI.writeToShell(tabId, '\x7f') // DEL character
  }

  // 发送选中的命令（不发 Enter，只替换显示）
  window.electronAPI.writeToShell(tabId, command)

  // 同步输入缓冲为选中的命令
  currentInput.value = command
  hideSuggestions()
}

const handleShellInput = (data: string) => {
  const tabId = props.session?.tabId
  if (!tabId) return

  const code = data.charCodeAt(0)

  // 上箭头
  if (data === '\x1b[A') {
    if (suggestionsVisible.value && suggestions.value.length > 0) {
      suggestionIndex.value = Math.max(0, suggestionIndex.value - 1)
      return
    }
  }

  // 下箭头
  if (data === '\x1b[B') {
    if (suggestionsVisible.value && suggestions.value.length > 0) {
      suggestionIndex.value = Math.min(suggestions.value.length - 1, suggestionIndex.value + 1)
      return
    }
  }

  // Esc
  if (code === 27) {
    if (suggestionsVisible.value) {
      hideSuggestions()
      return
    }
  }

  // Tab - 确认选中的建议
  if (code === 9) {
    if (suggestionsVisible.value && suggestionIndex.value >= 0) {
      handleSuggestionSelect(suggestions.value[suggestionIndex.value])
      return
    }
  }

  // Enter
  if (code === 13) {
    if (suggestionsVisible.value && suggestionIndex.value >= 0) {
      if (suggestionIndex.value === 0) {
        // 第一个是用户自己的输入 → 直接执行
        if (currentInput.value.trim()) {
          commandStore.recordCommand(connKey.value, currentInput.value)
        }
        currentInput.value = ''
        hideSuggestions()
        window.electronAPI.writeToShell(tabId, data)
      } else {
        // 选了历史建议 → 替换到终端，不执行，等用户再按 Enter 确认
        const selected = suggestions.value[suggestionIndex.value]
        // 清除当前输入
        for (let i = 0; i < currentInput.value.length; i++) {
          window.electronAPI.writeToShell(tabId, '\x7f')
        }
        // 写入选中的命令（不发 Enter）
        window.electronAPI.writeToShell(tabId, selected)
        currentInput.value = selected
        hideSuggestions()
      }
      return
    }
    // 无建议时正常执行
    if (currentInput.value.trim()) {
      commandStore.recordCommand(connKey.value, currentInput.value)
    }
    currentInput.value = ''
    hideSuggestions()
    window.electronAPI.writeToShell(tabId, data)
    return
  }

  // Ctrl+C
  if (code === 3) {
    currentInput.value = ''
    hideSuggestions()
    window.electronAPI.writeToShell(tabId, data)
    return
  }

  // Backspace
  if (code === 127) {
    if (currentInput.value.length > 0) {
      currentInput.value = currentInput.value.slice(0, -1)
    }
    window.electronAPI.writeToShell(tabId, data)
    updateSuggestions()
    return
  }

  // 可打印字符
  if (code >= 32 && code <= 126) {
    currentInput.value += data
    window.electronAPI.writeToShell(tabId, data)
    updateSuggestions()
    return
  }

  // 其他按键（方向键左/右等）- 重置输入缓冲
  if (data.startsWith('\x1b[')) {
    // 方向键或其他转义序列，不追踪
    window.electronAPI.writeToShell(tabId, data)
    return
  }

  // 默认：发送到 shell
  window.electronAPI.writeToShell(tabId, data)
};

const handleContainerClick = (e: MouseEvent) => {
  // 点击非建议区域时关闭建议框
  const target = e.target as HTMLElement
  if (!target.closest('.command-suggestions')) {
    hideSuggestions()
  }
}

const deleteHistoryItem = async (command: string) => {
  try {
    await ElMessageBox.confirm(`确定要删除「${command}」吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    commandStore.deleteFrequentCommand(connKey.value, command)
    ElMessage.success('删除成功')
  } catch {}
}

const addAsQuickCommand = (command: string) => {
  const exists = commandStore.quickCommands.some(c => c.command === command)
  if (exists) {
    ElMessage.info('该命令已在全局快捷命令中')
    return
  }
  const name = command.length > 20 ? command.substring(0, 20) + '...' : command
  commandStore.addQuickCommand({ name, command })
  ElMessage.success('已添加为全局快捷命令')
}

const clearHistory = async () => {
  try {
    await ElMessageBox.confirm('确定要清空当前连接的所有常用命令吗？', '确认清空', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    })
    commandStore.clearFrequentByConn(connKey.value)
    ElMessage.success('已清空')
  } catch {}
}

const initShellSession = async () => {
  const tabId = props.session?.tabId;
  const term = terminal.value;
  if (!tabId || !term) return;

  try {
    shellDataHandler.value = (rcvdTabId: string, data: string) => {
      if (rcvdTabId === tabId && terminal.value) {
        terminal.value.write(data);
        if (!shellConnected.value) {
          shellConnected.value = true;
          connected.value = true;
        }
        // 如果建议可见，更新位置跟随光标
        if (suggestionsVisible.value) {
          requestAnimationFrame(() => updateSuggestionPosition())
        }
      }
    };

    shellCloseHandler.value = (rcvdTabId: string) => {
      if (rcvdTabId === tabId) {
        shellConnected.value = false;
        connected.value = false;
        term.writeln('\r\n\x1b[1;33m⚠ Shell 会话已关闭\x1b[0m');
        term.writeln('\x1b[90m点击工具栏的重连按钮重新连接\x1b[0m');
      }
    };

    // SSH 级别错误（连接断开、网络异常等）
    sshErrorHandler.value = (rcvdTabId: string, error: string) => {
      if (rcvdTabId === tabId) {
        shellConnected.value = false;
        connected.value = false;
        term.writeln(`\r\n\x1b[1;31m✗ SSH 连接错误: ${error}\x1b[0m`);
        term.writeln('\x1b[90m点击工具栏的重连按钮重新连接\x1b[0m');
      }
    };

    // SSH 连接断开
    sshDisconnectHandler.value = (rcvdTabId: string) => {
      if (rcvdTabId === tabId) {
        shellConnected.value = false;
        connected.value = false;
        term.writeln('\r\n\x1b[1;33m⚠ SSH 连接已断开\x1b[0m');
        term.writeln('\x1b[90m点击工具栏的重连按钮重新连接\x1b[0m');
      }
    };

    window.electronAPI.onShellData(shellDataHandler.value);
    window.electronAPI.onShellClose(shellCloseHandler.value);
    window.electronAPI.onSSHError(sshErrorHandler.value);
    window.electronAPI.onSSHDisconnected(sshDisconnectHandler.value);

    const cols = term.cols || 80;
    const rows = term.rows || 24;

    await window.electronAPI.createShellStream(tabId, cols, rows);

    shellConnected.value = true;
    connected.value = true;
  } catch (error) {
    term.writeln(`\x1b[1;31m建立 shell 会话失败：${(error as Error).message}\x1b[0m`);
    connected.value = false;
  }
};

const clearTerminal = async () => {
  const term = terminal.value;
  if (!term) return;
  term.clear();
};

// 重新连接
let reconnecting = false
const reconnect = async () => {
  if (reconnecting) return
  const tabId = props.session?.tabId;
  const term = terminal.value;
  if (!tabId || !term) return;

  reconnecting = true

  term.writeln('\r\n\x1b[1;36m正在重新连接...\x1b[0m');

  try {
    // 重新连接 SSH
    const result = await window.electronAPI.connectSSH({
      host: props.session!.host,
      port: props.session!.port,
      username: props.session!.username,
      password: props.session!.password,
      privateKey: props.session!.privateKey,
    }, tabId);

    if (!result.success) {
      term.writeln(`\x1b[1;31m重连失败: ${result.message}\x1b[0m`);
      reconnecting = false
      return;
    }

    // 重建 shell stream
    await window.electronAPI.createShellStream(tabId, term.cols, term.rows);

    shellConnected.value = true;
    connected.value = true;
    term.writeln('\x1b[1;32m✓ 重连成功\x1b[0m');
  } catch (err) {
    term.writeln(`\x1b[1;31m重连失败: ${(err as Error).message}\x1b[0m`);
  } finally {
    reconnecting = false
  }
};

const testConnection = async () => {
  const term = terminal.value;
  if (!term) {
    ElMessage.error('终端未初始化');
    return;
  }

  const tabId = props.session?.tabId;
  if (!tabId) {
    ElMessage.warning('请先连接到服务器');
    return;
  }

  try {
    const result = await window.electronAPI.executeCommand('echo "SSH 连接正常"', tabId);

    if (result.success) {
      connected.value = true;
      ElMessage.success('SSH 连接正常');

      if (!shellConnected.value) {
        await initShellSession();
      }
    } else {
      connected.value = false;
      ElMessage.error('SSH 连接失败');
    }
  } catch (error) {
    connected.value = false;
    ElMessage.error('连接测试失败');
  }
};

const searchDecorations = computed(() => ({
  ...settingsStore.searchColors,
  matchOverviewRuler: settingsStore.searchColors.matchBorder,
  activeMatchColorOverviewRuler: settingsStore.searchColors.activeMatchBorder,
}));

const doSearch = (text: string) => {
  if (!searchAddon.value) return;
  if (!text) {
    searchAddon.value.clearDecorations();
    searchResults.value = { current: 0, total: 0 };
    return;
  }
  searchAddon.value.clearDecorations();
  searchAddon.value.findNext(text, { decorations: searchDecorations.value });
};

const searchNext = () => {
  if (searchAddon.value && searchText.value) {
    searchAddon.value.findNext(searchText.value, { decorations: searchDecorations.value });
  }
};

const searchPrev = () => {
  if (searchAddon.value && searchText.value) {
    searchAddon.value.findPrevious(searchText.value, { decorations: searchDecorations.value });
  }
};

const closeSearch = () => {
  showSearch.value = false;
  searchText.value = '';
  searchResults.value = { current: 0, total: 0 };
  if (searchAddon.value) {
    searchAddon.value.clearDecorations();
  }
};

// 主题切换时实时更新终端颜色
function applyTerminalTheme() {
  const term = terminal.value;
  if (!term) return;
  const theme = getTerminalTheme();
  term.options.theme = theme;
  // 强制重绘所有行，使 ANSI 颜色立即生效
  term.refresh(0, term.rows - 1);
}

watch(() => settingsStore.terminalThemeName, applyTerminalTheme);
watch(() => settingsStore.customTerminalThemes, applyTerminalTheme, { deep: true });
watch(() => props.isDark, applyTerminalTheme, { immediate: true });

watch(connected, (newVal) => {
  // 连接状态变化时无需在终端显示消息
});

onMounted(() => {
  initTerminal();

  // 等待 DOM 布局稳定后再初始化 shell，确保 cols/rows 正确
  if (props.session && props.session.connected && props.session.tabId) {
    nextTick(() => {
      // 再次 fit 确保布局已稳定
      fit();
      nextTick(() => {
        initShellSession();
      });
    });
  }
});

onBeforeUnmount(() => {
  stopFollowingCursor()

  if (pasteHandler && terminalRef.value) {
    terminalRef.value.removeEventListener('paste', pasteHandler, true);
    pasteHandler = null;
  }

  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
  }

  if (shellDataHandler.value) {
    window.electronAPI.removeListener('shell-data', shellDataHandler.value);
  }
  if (shellCloseHandler.value) {
    window.electronAPI.removeListener('shell-close', shellCloseHandler.value);
  }
  if (sshErrorHandler.value) {
    window.electronAPI.removeListener('ssh-error', sshErrorHandler.value);
  }
  if (sshDisconnectHandler.value) {
    window.electronAPI.removeListener('ssh-disconnected', sshDisconnectHandler.value);
  }

  if (props.session?.tabId) {
    window.electronAPI.closeShellStream(props.session.tabId);
  }

  if (terminal.value) {
    terminal.value.dispose();
    terminal.value = null;
  }
});

const focus = () => {
  if (terminal.value) {
    terminal.value.focus();
  }
};

defineExpose({ focus });
</script>

<style scoped>
.terminal-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
  overflow: hidden;
}

.terminal {
  flex: 1;
  overflow: hidden;
  position: relative;
}

:deep(.xterm) {
  height: 100%;
}

:deep(.xterm-viewport) {
  overflow-y: auto;
}

/* 底部工具栏 */
.bottom-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  background: var(--el-fill-color);
  border-top: 1px solid var(--el-border-color);
  min-height: 36px;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.toolbar-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.connection-status.connected {
  color: var(--el-color-success);
}

/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-input-inline {
  width: 140px;
}

.search-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  min-width: 36px;
  text-align: center;
  user-select: none;
  white-space: nowrap;
}

/* 搜索动画 */
.search-slide-enter-active,
.search-slide-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  max-width: 0;
  transform: scaleX(0.8);
}

.search-slide-enter-to,
.search-slide-leave-from {
  opacity: 1;
  max-width: 300px;
  transform: scaleX(1);
}

/* 搜索高亮颜色通过 decoration 选项控制，见 searchDecorations 变量 */

/* 扩展面板（文件/状态共用） */
.extension-panel {
  overflow: hidden;
  border-top: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  position: relative;
}

.panel-drag-handle {
  height: 6px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color);
  flex-shrink: 0;
  user-select: none;
}

.panel-drag-handle:hover .drag-indicator {
  background: var(--el-color-primary);
}

.drag-indicator {
  width: 40px;
  height: 3px;
  border-radius: 2px;
  background: var(--el-border-color);
  transition: background 0.15s;
}

.panel-content {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* 右键菜单触发定位元素 */
.term-menu-trigger {
  position: fixed;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
}

/* 命令历史对话框 */
.history-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.command-text {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 3px;
}

/* 传输图标 */
.transfer-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
  border-radius: 4px;
}

.transfer-icon-wrapper:hover {
  background-color: var(--el-fill-color-light);
}

.transfer-icon {
  color: var(--el-text-color-secondary);
}

.transfer-icon-wrapper :deep(.el-progress-circle) {
  background: transparent !important;
}

.transfer-icon-wrapper :deep(.el-progress-circle__track) {
  stroke: var(--el-border-color-lighter);
}

/* 传输历史弹窗 */
.transfer-history-content {
  max-height: 400px;
}

.transfer-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.transfer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 350px;
  overflow-y: auto;
}

.transfer-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.transfer-item.transferring {
  background: var(--el-color-warning-light-9);
}

.transfer-item.completed {
  background: var(--el-color-success-light-9);
}

.transfer-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transfer-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.transfer-progress :deep(.el-progress) {
  flex: 1;
}

.transfer-size {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.transfer-status-text {
  font-size: 12px;
  color: var(--el-color-warning);
}

.transfer-progress-bar {
  width: 100%;
  margin-top: 4px;
}

.transfer-progress-bar :deep(.el-progress) {
  margin-bottom: 0;
}

.transfer-progress-bar :deep(.el-progress-bar__outer) {
  background-color: var(--el-fill-color);
}

.transfer-done {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  width: 100%;
}

.transfer-duration {
  color: var(--el-text-color-placeholder);
}

.transfer-error {
  font-size: 12px;
  color: var(--el-color-danger);
  width: 100%;
}

.transfer-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.transfer-actions .el-button {
  padding: 2px 4px !important;
  height: auto !important;
}

.transfer-empty {
  text-align: center;
  padding: 20px;
  color: var(--el-text-color-secondary);
}

/* 整体布局 */
.terminal-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

/* 终端 + AI 侧边栏 横向排列 */
.terminal-area {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.terminal-area .terminal {
  flex: 1;
  min-width: 0;
}

.ai-sidebar-instance {
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
}
</style>
