<template>
  <div class="editor-window">
    <!-- 标签栏（仅标签页模式显示） -->
    <div class="editor-tabs" v-if="isTabMode && openFiles.length > 0">
      <div
        v-for="(file, index) in openFiles"
        :key="file.path"
        class="editor-tab"
        :class="{ active: index === activeIndex }"
        @click="switchTab(index)"
        @mousedown.middle.prevent="closeTab(index)"
      >
        <span v-if="file.modified" class="tab-modified">●</span>
        <span class="tab-name">{{ file.name }}</span>
        <span class="tab-close" @click.stop="closeTab(index)">&times;</span>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="editor-toolbar" v-if="currentFile">
      <span class="file-path" :title="currentFile.path">{{ currentFile.path }}</span>
      <span v-if="currentFile.modified" class="modified-dot">● 未保存</span>
      <span class="lang-label">{{ currentFile.langLabel }}</span>
      <el-button size="small" type="primary" :disabled="!currentFile.modified || currentFile.saving" @click="save" :loading="currentFile.saving">
        <el-icon><Check /></el-icon> 保存
      </el-button>
    </div>

    <!-- 搜索替换栏 -->
    <transition name="el-zoom-in-top">
      <div v-if="showSearch" class="search-bar">
        <div class="search-row">
          <el-input ref="searchInputRef" v-model="searchText" size="small" placeholder="查找..." clearable @input="doSearch" @keyup.enter="findNext" @keyup.escape="closeSearch" class="search-input">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <span class="search-count" v-if="searchText">{{ matchCurrent }}/{{ matchTotal }}</span>
          <el-button size="small" @click="findPrev" title="上一个"><el-icon><ArrowUp /></el-icon></el-button>
          <el-button size="small" @click="findNext" title="下一个"><el-icon><ArrowDown /></el-icon></el-button>
          <el-button size="small" :type="showReplace ? 'primary' : ''" @click="showReplace = !showReplace" title="替换"><el-icon><Sort /></el-icon></el-button>
          <el-button size="small" @click="closeSearch" title="关闭"><el-icon><Close /></el-icon></el-button>
        </div>
        <div v-if="showReplace" class="replace-row">
          <el-input v-model="replaceText" size="small" placeholder="替换为..." @input="syncSearchQuery" @keyup.enter="replaceOne" @keyup.escape="closeSearch" class="search-input">
            <template #prefix><el-icon><Edit /></el-icon></template>
          </el-input>
          <el-button size="small" @click="replaceOne">替换</el-button>
          <el-button size="small" @click="replaceAll">全部</el-button>
        </div>
      </div>
    </transition>

    <!-- 加载/错误/空状态 -->
    <div class="editor-loading" v-if="loading">
      <el-icon class="is-loading" :size="24"><Loading /></el-icon>
      <span>正在加载文件...</span>
    </div>
    <div class="editor-error" v-else-if="error">
      <el-icon :size="40" color="var(--el-color-danger)"><CircleCloseFilled /></el-icon>
      <span>{{ error }}</span>
    </div>
    <div class="editor-empty" v-else-if="openFiles.length === 0">
      <el-icon :size="48" color="var(--el-text-color-placeholder)"><Document /></el-icon>
      <span>没有打开的文件</span>
    </div>

    <!-- 编辑器容器 -->
    <div ref="editorContainer" class="editor-container" v-show="!loading && !error && openFiles.length > 0"></div>

    <!-- 状态栏 -->
    <div class="editor-status" v-if="currentFile && !loading && !error">
      <span>行 {{ cursorLine }}, 列 {{ cursorCol }}</span>
      <span>{{ currentFile.langLabel }}</span>
      <span>{{ formatSize(currentFile.contentLength) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, shallowRef, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Loading, CircleCloseFilled, Search, ArrowUp, ArrowDown, Close, Sort, Edit, Document } from '@element-plus/icons-vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches, SearchQuery, setSearchQuery, getSearchQuery, findNext as cmFindNext, findPrevious as cmFindPrevious, replaceNext as cmReplaceNext, replaceAll as cmReplaceAll } from '@codemirror/search'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { python } from '@codemirror/lang-python'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps<{
  filePath?: string
  tabId?: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// 模式：从 URL 参数读取
const urlParams = new URLSearchParams(window.location.search)
const isTabMode = ref(urlParams.get('mode') === 'tab')

// 文件状态
interface OpenFile {
  path: string; name: string; tabId: string; content: string
  langLabel: string; contentLength: number; modified: boolean; saving: boolean
  editorState: EditorState | null
}

const openFiles = ref<OpenFile[]>([])
const activeIndex = ref(-1)
const editorView = shallowRef<EditorView | null>(null)
const editorContainer = ref<HTMLElement | null>(null)
const loading = ref(false)
const error = ref('')
const cursorLine = ref(1)
const cursorCol = ref(1)

const currentFile = computed(() => activeIndex.value >= 0 ? openFiles.value[activeIndex.value] : null)

// 搜索状态
const searchInputRef = ref()
const showSearch = ref(false)
const showReplace = ref(false)
const searchText = ref('')
const replaceText = ref('')
const matchCurrent = ref(0)
const matchTotal = ref(0)

// ---- 工具函数 ----
const getLanguage = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const m: Record<string, any> = {
    js: javascript, mjs: javascript, cjs: javascript, ts: javascript, mts: javascript,
    jsx: javascript, tsx: javascript, json: json, jsonc: json, html: html, htm: html,
    css: css, scss: css, less: css, py: python, xml: xml, svg: xml,
    yaml: yaml, yml: yaml, md: markdown, markdown: markdown,
  }
  return m[ext] || null
}

const getLanguageName = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const n: Record<string, string> = {
    js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', ts: 'TypeScript', mts: 'TypeScript',
    tsx: 'TSX', jsx: 'JSX', json: 'JSON', html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS',
    less: 'LESS', py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust', java: 'Java',
    xml: 'XML', svg: 'SVG', yaml: 'YAML', yml: 'YAML', md: 'Markdown',
    sh: 'Shell', bash: 'Shell', zsh: 'Shell', conf: 'Config', cfg: 'Config',
    ini: 'INI', toml: 'TOML', sql: 'SQL', log: 'Log', txt: 'Text', vue: 'Vue',
  }
  return n[ext] || '纯文本'
}

const isDark = () => document.documentElement.classList.contains('dark')

const formatSize = (b: number): string => {
  if (!b) return '0 B'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / (1024 * 1024)).toFixed(2) + ' MB'
}

// ---- 编辑器 ----
const createExtensions = (name: string) => {
  const lang = getLanguage(name)
  const exts: any[] = [
    lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(),
    highlightSelectionMatches(), drawSelection(), history(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged && currentFile.value) {
        const txt = u.state.doc.toString()
        currentFile.value.modified = txt !== currentFile.value.content
        currentFile.value.contentLength = new TextEncoder().encode(txt).length
      }
      const pos = u.state.selection.main.head
      const ln = u.state.doc.lineAt(pos)
      cursorLine.value = ln.number
      cursorCol.value = pos - ln.from + 1
      if (showSearch.value && searchText.value) updateMatchCount()
    }),
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto', fontFamily: "'Consolas','Courier New',monospace" },
      '.cm-content': { fontSize: '13px' },
      '.cm-panel.cm-search': { display: 'none' },
    }),
  ]
  if (lang) exts.push(lang())
  if (isDark()) exts.push(oneDark)
  return exts
}

// ---- 文件操作 ----
const openFile = async (filePath: string, tabId: string) => {
  const exist = openFiles.value.findIndex(f => f.path === filePath)
  if (exist >= 0) { switchTab(exist); return }

  const isFirst = openFiles.value.length === 0
  if (isFirst) loading.value = true
  error.value = ''
  try {
    const res = await (window as any).electronAPI.readFileContent(tabId, filePath)
    if (!res.success) { ElMessage.error('打开失败：' + (res.error || '')); return }
    const content = res.content || ''
    // 二进制检测：前 8KB 含 \0 字节则为二进制
    const head = content.substring(0, 8192)
    if (head.includes('\0')) {
      const name = filePath.split('/').pop() || filePath
      try {
        await ElMessageBox.confirm(
          `"${name}" 看起来是二进制文件，在编辑器中可能无法正常显示，确定要打开吗？`,
          '二进制文件',
          { confirmButtonText: '仍然打开', cancelButtonText: '取消', type: 'warning' }
        )
      } catch { return }
    }
    const len = new TextEncoder().encode(content).length
    const name = filePath.split('/').pop() || filePath
    openFiles.value.push({
      path: filePath, name, tabId, content,
      langLabel: getLanguageName(name), contentLength: len,
      modified: false, saving: false, editorState: null,
    })
    switchTab(openFiles.value.length - 1)
  } catch (e) {
    ElMessage.error('打开失败：' + (e as Error).message)
  } finally {
    if (isFirst) loading.value = false
  }
}

const switchTab = (idx: number) => {
  if (idx < 0 || idx >= openFiles.value.length) return
  // 保存当前状态
  if (editorView.value && activeIndex.value >= 0 && activeIndex.value < openFiles.value.length) {
    openFiles.value[activeIndex.value].editorState = editorView.value.state
  }
  activeIndex.value = idx
  const file = openFiles.value[idx]
  error.value = ''
  document.title = `${file.name} - ShellPilot Editor`

  if (file.editorState && editorView.value) {
    editorView.value.setState(file.editorState)
  } else if (editorContainer.value) {
    const state = EditorState.create({ doc: file.content, extensions: createExtensions(file.name) })
    file.editorState = state
    if (editorView.value) {
      editorView.value.setState(state)
    } else {
      editorView.value = new EditorView({ state, parent: editorContainer.value })
    }
  }
}

const closeTab = async (idx: number) => {
  const file = openFiles.value[idx]
  if (file.modified) {
    try {
      await ElMessageBox.confirm(`"${file.name}" 未保存，确定关闭？`, '提示', {
        confirmButtonText: '不保存关闭', cancelButtonText: '取消', type: 'warning',
      })
    } catch { return }
  }
  openFiles.value.splice(idx, 1)
  if (openFiles.value.length === 0) {
    activeIndex.value = -1
    editorView.value?.destroy(); editorView.value = null
    if (isTabMode.value) window.close()
  } else if (activeIndex.value >= openFiles.value.length) {
    switchTab(openFiles.value.length - 1)
  } else {
    switchTab(Math.max(0, activeIndex.value - (idx <= activeIndex.value ? 1 : 0)))
  }
}

const save = async () => {
  if (!editorView.value || !currentFile.value) return
  const f = currentFile.value; f.saving = true
  try {
    const content = editorView.value.state.doc.toString()
    const res = await (window as any).electronAPI.writeFileContent(f.tabId, f.path, content)
    if (res.success) { f.content = content; f.modified = false; ElMessage.success('保存成功') }
    else ElMessage.error('保存失败：' + (res.error || ''))
  } catch (e) { ElMessage.error('保存失败：' + (e as Error).message) }
  finally { f.saving = false }
}

// ---- 搜索替换 ----
const openSearch = () => { showSearch.value = true; showReplace.value = false; nextTick(() => searchInputRef.value?.focus()) }
const openReplace = () => { showSearch.value = true; showReplace.value = true; nextTick(() => searchInputRef.value?.focus()) }
const closeSearch = () => {
  showSearch.value = false; showReplace.value = false
  if (editorView.value) editorView.value.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) })
  matchCurrent.value = 0; matchTotal.value = 0
}
const syncSearchQuery = () => {
  if (!editorView.value) return
  editorView.value.dispatch({
    effects: setSearchQuery.of(new SearchQuery({ search: searchText.value, replace: replaceText.value }))
  })
}
const doSearch = () => {
  if (!editorView.value || !searchText.value) { matchCurrent.value = 0; matchTotal.value = 0; return }
  syncSearchQuery()
  updateMatchCount()
}
const updateMatchCount = () => {
  if (!editorView.value || !searchText.value) { matchCurrent.value = 0; matchTotal.value = 0; return }
  const q = getSearchQuery(editorView.value.state)
  const c = q.getCursor(editorView.value.state)
  let total = 0, cur = 0, p = c.next(), head = editorView.value.state.selection.main.head
  while (!p.done) { total++; if (p.value.from <= head) cur++; p = c.next() }
  matchTotal.value = total; matchCurrent.value = cur || (total > 0 ? 1 : 0)
}
const findNext = () => { editorView.value && (cmFindNext(editorView.value), updateMatchCount()) }
const findPrev = () => { editorView.value && (cmFindPrevious(editorView.value), updateMatchCount()) }
const replaceOne = () => { editorView.value && (cmReplaceNext(editorView.value), updateMatchCount()) }
const replaceAll = () => { editorView.value && (cmReplaceAll(editorView.value), updateMatchCount()) }

// ---- 快捷键 ----
const handleKeydown = (e: KeyboardEvent) => {
  const m = e.ctrlKey || e.metaKey
  if (m && e.key === 's') { e.preventDefault(); currentFile.value?.modified && save() }
  else if (m && e.key === 'f') { e.preventDefault(); openSearch() }
  else if (m && e.key === 'h') { e.preventDefault(); openReplace() }
  else if (m && e.key === 'w') { e.preventDefault(); activeIndex.value >= 0 && closeTab(activeIndex.value) }
  else if (e.key === 'F3') { e.preventDefault(); e.shiftKey ? findPrev() : findNext() }
  else if (e.key === 'Escape' && showSearch.value) closeSearch()
}

// ---- IPC：接收新文件 ----
const handleOpenFile = (data: any) => {
  if (data && data.path) {
    openFile(data.path, data.tabId || '')
  }
}

// ---- 生命周期 ----
onMounted(async () => {
  const initPath = props.filePath || urlParams.get('path') || ''
  const initTabId = props.tabId || urlParams.get('tabId') || ''
  if (urlParams.get('dark') === '1') document.documentElement.classList.add('dark')

  // 注册 IPC 监听（处理缓冲区中的暂存文件）
  if ((window as any).electronAPI.onOpenFile) {
    (window as any).electronAPI.onOpenFile(handleOpenFile)
  }

  if (initPath && initTabId) await openFile(initPath, initTabId)

  // 通知主进程就绪
  if ((window as any).electronAPI.editorReady) {
    (window as any).electronAPI.editorReady()
  }

  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if ((window as any).electronAPI.removeListener) {
    (window as any).electronAPI.removeListener('editor:open-file', handleOpenFile)
  }
  editorView.value?.destroy()
})

defineExpose({ hasUnsavedChanges: () => openFiles.value.some(f => f.modified) })
</script>

<style scoped>
.editor-window { display: flex; flex-direction: column; height: 100vh; background: var(--el-bg-color); }

/* 标签栏 */
.editor-tabs { display: flex; align-items: center; background: var(--el-fill-color-lighter); border-bottom: 1px solid var(--el-border-color); overflow-x: auto; min-height: 32px; flex-shrink: 0; }
.editor-tab { display: flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; color: var(--el-text-color-regular); border-right: 1px solid var(--el-border-color-lighter); max-width: 160px; transition: background 0.15s; }
.editor-tab:hover { background: var(--el-fill-color); }
.editor-tab.active { background: var(--el-bg-color); color: var(--el-color-primary); font-weight: 500; border-bottom: 2px solid var(--el-color-primary); }
.tab-modified { color: var(--el-color-warning); font-size: 10px; }
.tab-name { overflow: hidden; text-overflow: ellipsis; }
.tab-close { font-size: 14px; opacity: 0.4; cursor: pointer; line-height: 1; margin-left: 4px; }
.tab-close:hover { opacity: 1; }

/* 工具栏 */
.editor-toolbar { display: flex; align-items: center; padding: 6px 12px; border-bottom: 1px solid var(--el-border-color); gap: 8px; flex-shrink: 0; -webkit-app-region: drag; }
.file-path { font-size: 13px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.modified-dot { color: var(--el-color-warning); font-size: 12px; flex-shrink: 0; }
.lang-label { font-size: 12px; color: var(--el-text-color-placeholder); flex-shrink: 0; }

/* 搜索栏 */
.search-bar { padding: 8px 12px; border-bottom: 1px solid var(--el-border-color); background: var(--el-fill-color-lighter); flex-shrink: 0; display: flex; flex-direction: column; gap: 6px; }
.search-row, .replace-row { display: flex; align-items: center; gap: 4px; }
.search-input { flex: 1; max-width: 300px; }
.search-count { font-size: 12px; color: var(--el-text-color-secondary); white-space: nowrap; min-width: 40px; text-align: center; }

/* 内容区 */
.editor-loading, .editor-error, .editor-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; flex: 1; color: var(--el-text-color-secondary); font-size: 14px; }
.editor-container { flex: 1; overflow: hidden; }

/* 状态栏 */
.editor-status { display: flex; gap: 16px; padding: 4px 12px; font-size: 12px; color: var(--el-text-color-secondary); border-top: 1px solid var(--el-border-color); background: var(--el-fill-color-lighter); flex-shrink: 0; }
</style>
