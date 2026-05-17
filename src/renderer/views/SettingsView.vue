<template>
  <div class="settings-view">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="card-title">设置</span>
        </div>
      </template>

      <el-collapse v-model="activeSections">
        <!-- 主题设置 -->
        <el-collapse-item title="主题" name="theme">
          <div class="theme-setting">
            <el-radio-group v-model="currentTheme" @change="handleThemeChange">
              <el-radio-button value="dark">深色</el-radio-button>
              <el-radio-button value="light">浅色</el-radio-button>
              <el-radio-button value="system">跟随系统</el-radio-button>
            </el-radio-group>
          </div>
        </el-collapse-item>

        <!-- 终端主题 -->
        <el-collapse-item title="终端主题" name="terminalTheme">
          <div class="terminal-theme-section">
            <!-- 预设主题 -->
            <div class="theme-group">
              <div class="theme-presets">
                <div
                  v-for="(preset, key) in terminalPresets"
                  :key="key"
                  class="theme-card"
                  :class="{ active: settingsStore.terminalThemeName === key }"
                  @click="settingsStore.setTerminalTheme(key as string)"
                >
                  <div class="theme-preview" :style="{ background: preset.background, color: preset.foreground }">
                    <span :style="{ color: preset.green }">$</span>
                    <span :style="{ color: preset.yellow }">ls</span>
                    <span :style="{ color: preset.blue }">-la</span>
                  </div>
                  <span class="theme-name">{{ preset.name }}</span>
                </div>
              </div>
            </div>

            <!-- 自定义主题 -->
            <div class="theme-group">
              <div class="theme-group-header">
                <span>自定义主题</span>
                <el-button size="small" type="primary" plain @click="openNewTheme">
                  <el-icon><Plus /></el-icon> 新建
                </el-button>
              </div>
              <div class="theme-presets">
                <div
                  v-for="t in settingsStore.customTerminalThemes"
                  :key="t.name"
                  class="theme-card"
                  :class="{ active: settingsStore.terminalThemeName === t.name }"
                  @click="settingsStore.setTerminalTheme(t.name)"
                >
                  <div class="theme-preview" :style="{ background: t.background, color: t.foreground }">
                    <span :style="{ color: t.green }">$</span>
                    <span :style="{ color: t.yellow }">ls</span>
                    <span :style="{ color: t.blue }">-la</span>
                  </div>
                  <div class="theme-card-footer">
                    <span class="theme-name">{{ t.name }}</span>
                    <div class="theme-card-actions">
                      <el-button size="small" text @click.stop="openEditTheme(t)">编辑</el-button>
                      <el-button size="small" text type="danger" @click.stop="deleteTheme(t.name)">删除</el-button>
                    </div>
                  </div>
                </div>
                <div v-if="settingsStore.customTerminalThemes.length === 0" class="theme-empty">
                  暂无自定义主题
                </div>
              </div>
            </div>
          </div>
        </el-collapse-item>

        <!-- 搜索高亮颜色 -->
        <el-collapse-item title="终端搜索高亮颜色" name="search">
          <div class="color-setting">
            <div class="color-row">
              <label>普通匹配</label>
              <div class="color-preview" :style="{ background: searchColors.matchBackground, borderColor: searchColors.matchBorder }">
                <span>示例文本</span>
              </div>
              <el-color-picker
                v-model="searchColors.matchBackground"
                show-alpha
                :predefine="presetColors"
              />
            </div>
            <div class="color-row">
              <label>当前匹配</label>
              <div class="color-preview" :style="{ background: searchColors.activeMatchBackground, borderColor: searchColors.activeMatchBorder }">
                <span>示例文本</span>
              </div>
              <el-color-picker
                v-model="searchColors.activeMatchBackground"
                show-alpha
                :predefine="presetColors"
              />
            </div>
            <div class="color-actions">
              <el-button size="small" @click="resetColors">恢复默认</el-button>
            </div>
          </div>
        </el-collapse-item>

        <!-- 编辑器设置 -->
        <el-collapse-item title="编辑器设置" name="editor">
          <div class="editor-setting">
            <label>文件打开方式</label>
            <el-radio-group v-model="settingsStore.editorMode" size="small">
              <el-radio-button value="window">独立窗口</el-radio-button>
              <el-radio-button value="tab">标签页</el-radio-button>
            </el-radio-group>
            <p class="setting-hint">独立窗口：每个文件一个独立窗口</p>
            <p class="setting-hint">标签页：所有文件在一个窗口内通过标签切换</p>
          </div>
        </el-collapse-item>

        <!-- 文件传输设置 -->
        <el-collapse-item title="文件传输" name="transfer">
          <div class="editor-setting">
            <label>最大同时下载数</label>
            <el-slider
              v-model="settingsStore.maxConcurrentDownloads"
              :min="1"
              :max="10"
              :step="1"
              show-stops
              show-input
              :marks="{ 1: '1', 3: '3', 5: '5', 10: '10' }"
            />
            <p class="setting-hint">同时下载的文件数量，推荐 3-5。过大可能导致服务器限速或连接被拒。</p>
          </div>
        </el-collapse-item>

        <!-- SSH 密钥管理 -->
        <el-collapse-item title="SSH 密钥管理" name="keys">
          <div class="keys-section">
            <div class="keys-header">
              <el-button type="primary" size="small" @click="openAddKey">
                <el-icon><Plus /></el-icon>
                添加密钥
              </el-button>
            </div>

            <el-table :data="sshKeys" style="width: 100%" size="small" empty-text="暂无密钥">
              <el-table-column prop="name" label="名称" min-width="150" />
              <el-table-column label="密钥预览" min-width="200">
                <template #default="{ row }">
                  <code class="key-preview">{{ row.privateKey.substring(0, 30) }}...</code>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="140">
                <template #default="{ row }">
                  <el-button size="small" @click="openEditKey(row)">编辑</el-button>
                  <el-button size="small" type="danger" plain @click="deleteKey(row.id)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-collapse-item>

        <!-- AI 助手设置 -->
        <el-collapse-item title="AI 助手" name="ai">
          <div class="ai-section">
            <el-form label-width="80px" size="default">
              <el-form-item label="API 地址">
                <el-input
                  v-model="aiConfig.baseUrl"
                  placeholder="如 https://api.openai.com/v1"
                />
              </el-form-item>
              <el-form-item label="API Key">
                <el-input
                  v-model="aiConfig.apiKey"
                  type="password"
                  show-password
                  placeholder="API Key（Ollama 可留空）"
                />
              </el-form-item>
              <el-form-item label="模型">
                <el-input
                  v-model="aiConfig.model"
                  placeholder="如 gpt-4o, qwen2.5"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" size="small" @click="saveAIConfig">保存</el-button>
                <el-button size="small" @click="testAIConnection" :loading="aiTesting">
                  测试连接
                </el-button>
              </el-form-item>
              <el-form-item v-if="aiTestResult">
                <el-tag :type="aiTestResult.success ? 'success' : 'danger'" size="small">
                  {{ aiTestResult.message }}
                </el-tag>
              </el-form-item>
            </el-form>
          </div>
        </el-collapse-item>

        <!-- 快捷命令提示 -->
        <el-collapse-item title="快捷命令提示" name="commands">
          <div class="commands-section">
            <div class="commands-header">
              <el-button type="primary" size="small" @click="openAddCommand">
                <el-icon><Plus /></el-icon>
                添加命令
              </el-button>
            </div>

            <el-table :data="quickCommands" style="width: 100%" size="small" empty-text="暂无快捷命令">
              <el-table-column prop="name" label="名称" width="120" />
              <el-table-column prop="command" label="命令" min-width="200">
                <template #default="{ row }">
                  <code class="command-text">{{ row.command }}</code>
                </template>
              </el-table-column>
              <el-table-column prop="category" label="类型" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.category === '内置' ? 'info' : 'success'" size="small">
                    {{ row.category }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="描述" min-width="150" />
              <el-table-column label="操作" width="140">
                <template #default="{ row }">
                  <el-button size="small" @click="openEditCommand(row)">编辑</el-button>
                  <el-button size="small" type="danger" plain @click="deleteCommand(row.id)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <!-- 添加/编辑命令对话框 -->
    <el-dialog
      v-model="showCommandDialog"
      :title="isEditingCommand ? '编辑命令' : '添加命令'"
      width="480px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form :model="commandForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="commandForm.name" placeholder="例如: 查看日志" />
        </el-form-item>
        <el-form-item label="命令" required>
          <el-input v-model="commandForm.command" placeholder="例如: tail -f /var/log/syslog" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="commandForm.description" placeholder="可选，命令描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCommandDialog = false">取消</el-button>
        <el-button type="primary" @click="saveCommand">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑密钥对话框 -->
    <el-dialog
      v-model="showKeyDialog"
      :title="isEditingKey ? '编辑密钥' : '添加密钥'"
      width="520px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form :model="keyForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="keyForm.name" placeholder="例如: 生产服务器密钥" />
        </el-form-item>
        <el-form-item label="私钥" required>
          <el-input
            v-model="keyForm.privateKey"
            type="textarea"
            :rows="8"
            placeholder="粘贴私钥内容（以 -----BEGIN 开头）"
          />
        </el-form-item>
        <el-form-item label="密码短语">
          <el-input
            v-model="keyForm.passphrase"
            type="password"
            placeholder="可选，私钥密码短语"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showKeyDialog = false">取消</el-button>
        <el-button type="primary" @click="saveKey">保存</el-button>
      </template>
    </el-dialog>

    <!-- 自定义终端主题对话框 -->
    <el-dialog
      v-model="showCustomThemeDialog"
      :title="isEditingExisting ? '编辑主题' : '新建主题'"
      width="520px"
      destroy-on-close
    >
      <div class="custom-theme-form">
        <el-form-item label="主题名称">
          <el-input v-model="editingTheme.name" placeholder="给主题取个名字" :disabled="isEditingExisting" />
        </el-form-item>
        <div class="color-grid">
          <div v-for="item in colorFields" :key="item.key" class="color-item">
            <label>{{ item.label }}</label>
            <el-color-picker v-model="editingTheme[item.key]" size="small" />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showCustomThemeDialog = false">取消</el-button>
        <el-button type="primary" @click="applyCustomTheme">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore, TERMINAL_PRESETS } from '../stores/settingsStore'
import { useCommandStore } from '../stores/commandStore'
import { useKeyStore } from '../stores/keyStore'
import { useAIStore } from '../stores/aiStore'

const settingsStore = useSettingsStore()
const commandStore = useCommandStore()
const keyStore = useKeyStore()
const activeSections = ref(['search'])

// 终端主题
const terminalPresets = TERMINAL_PRESETS
const showCustomThemeDialog = ref(false)
const editingTheme = ref<TerminalTheme>({ ...TERMINAL_PRESETS.default, name: '' })
const isEditingExisting = ref(false)

const colorFields = [
  { key: 'foreground', label: '前景色' },
  { key: 'background', label: '背景色' },
  { key: 'cursor', label: '光标' },
  { key: 'cursorAccent', label: '光标文字' },
  { key: 'selectionBackground', label: '选中背景' },
  { key: 'black', label: 'Black' },
  { key: 'red', label: 'Red' },
  { key: 'green', label: 'Green' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'blue', label: 'Blue' },
  { key: 'magenta', label: 'Magenta' },
  { key: 'cyan', label: 'Cyan' },
  { key: 'white', label: 'White' },
  { key: 'brightBlack', label: 'Bright Black' },
  { key: 'brightRed', label: 'Bright Red' },
  { key: 'brightGreen', label: 'Bright Green' },
  { key: 'brightYellow', label: 'Bright Yellow' },
  { key: 'brightBlue', label: 'Bright Blue' },
  { key: 'brightMagenta', label: 'Bright Magenta' },
  { key: 'brightCyan', label: 'Bright Cyan' },
  { key: 'brightWhite', label: 'Bright White' },
]

function openNewTheme() {
  editingTheme.value = { ...TERMINAL_PRESETS.default, name: '' }
  isEditingExisting.value = false
  showCustomThemeDialog.value = true
}

function openEditTheme(t: TerminalTheme) {
  editingTheme.value = { ...t }
  isEditingExisting.value = true
  showCustomThemeDialog.value = true
}

function applyCustomTheme() {
  if (!editingTheme.value.name.trim()) {
    ElMessage.warning('请输入主题名称')
    return
  }
  settingsStore.addCustomTheme({ ...editingTheme.value })
  showCustomThemeDialog.value = false
  ElMessage.success(isEditingExisting.value ? '主题已更新' : '主题已创建')
}

function deleteTheme(name: string) {
  settingsStore.deleteCustomTheme(name)
  ElMessage.success('已删除')
}

// AI 配置
const aiConfig = ref({ baseUrl: '', apiKey: '', model: '' })
const aiTesting = ref(false)
const aiTestResult = ref<{ success: boolean; message: string } | null>(null)

// 加载 AI 配置
function loadAIConfig() {
  const aiStore = useAIStore()
  aiConfig.value = { ...aiConfig.value, ...aiStore.config }
}
loadAIConfig()

async function saveAIConfig() {
  const { baseUrl, apiKey, model } = aiConfig.value
  await window.electronAPI.aiConfigure({ baseUrl, apiKey, model })
  // 同步到 renderer 的 store
  const aiStore = useAIStore()
  aiStore.updateConfig({ baseUrl, apiKey, model })
  ElMessage.success('AI 配置已保存')
}

async function testAIConnection() {
  aiTesting.value = true
  aiTestResult.value = null
  try {
    const { baseUrl, apiKey, model } = aiConfig.value
    aiTestResult.value = await window.electronAPI.aiTestConnection({ baseUrl, apiKey, model })
  } catch (err) {
    aiTestResult.value = { success: false, message: (err as Error).message }
  } finally {
    aiTesting.value = false
  }
}


const searchColors = computed(() => settingsStore.searchColors)
const quickCommands = computed(() => commandStore.quickCommands)
const sshKeys = computed(() => keyStore.keys)

const presetColors = [
  'rgba(76, 175, 80, 0.3)',
  'rgba(33, 150, 243, 0.3)',
  'rgba(255, 193, 7, 0.3)',
  'rgba(156, 39, 176, 0.3)',
  'rgba(255, 87, 34, 0.3)',
  'rgba(0, 188, 212, 0.3)',
]

const resetColors = () => {
  settingsStore.resetSearchColors()
}

// 主题设置
const currentTheme = ref(settingsStore.theme)
const handleThemeChange = (mode: 'dark' | 'light' | 'system') => {
  settingsStore.setTheme(mode)
}

// 快捷命令管理
const showCommandDialog = ref(false)
const isEditingCommand = ref(false)
const editingCommandId = ref<string | null>(null)
const commandForm = ref({
  name: '',
  command: '',
  description: '',
})

const openAddCommand = () => {
  isEditingCommand.value = false
  editingCommandId.value = null
  commandForm.value = { name: '', command: '', description: '' }
  showCommandDialog.value = true
}

const openEditCommand = (cmd: { id: string; name: string; command: string; description?: string }) => {
  isEditingCommand.value = true
  editingCommandId.value = cmd.id
  commandForm.value = {
    name: cmd.name,
    command: cmd.command,
    description: cmd.description || '',
  }
  showCommandDialog.value = true
}

const saveCommand = () => {
  if (!commandForm.value.name) {
    ElMessage.warning('请输入命令名称')
    return
  }
  if (!commandForm.value.command) {
    ElMessage.warning('请输入命令')
    return
  }

  if (isEditingCommand.value && editingCommandId.value) {
    commandStore.updateQuickCommand(editingCommandId.value, {
      name: commandForm.value.name,
      command: commandForm.value.command,
      description: commandForm.value.description,
    })
    ElMessage.success('修改成功')
  } else {
    commandStore.addQuickCommand({
      name: commandForm.value.name,
      command: commandForm.value.command,
      description: commandForm.value.description,
    })
    ElMessage.success('添加成功')
  }
  showCommandDialog.value = false
}

const deleteCommand = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个命令吗？', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    commandStore.deleteQuickCommand(id)
    ElMessage.success('删除成功')
  } catch {
    // 取消
  }
}

// 密钥管理
const showKeyDialog = ref(false)
const isEditingKey = ref(false)
const editingKeyId = ref<string | null>(null)
const keyForm = ref({
  name: '',
  privateKey: '',
  passphrase: '',
})

const openAddKey = () => {
  isEditingKey.value = false
  editingKeyId.value = null
  keyForm.value = { name: '', privateKey: '', passphrase: '' }
  showKeyDialog.value = true
}

const openEditKey = (key: { id: string; name: string; privateKey: string; passphrase?: string }) => {
  isEditingKey.value = true
  editingKeyId.value = key.id
  keyForm.value = {
    name: key.name,
    privateKey: key.privateKey,
    passphrase: key.passphrase || '',
  }
  showKeyDialog.value = true
}

const saveKey = () => {
  if (!keyForm.value.name) {
    ElMessage.warning('请输入密钥名称')
    return
  }
  if (!keyForm.value.privateKey) {
    ElMessage.warning('请输入私钥内容')
    return
  }

  if (isEditingKey.value && editingKeyId.value) {
    keyStore.updateKey(editingKeyId.value, {
      name: keyForm.value.name,
      privateKey: keyForm.value.privateKey,
      passphrase: keyForm.value.passphrase || undefined,
    })
    ElMessage.success('修改成功')
  } else {
    keyStore.addKey({
      name: keyForm.value.name,
      privateKey: keyForm.value.privateKey,
      passphrase: keyForm.value.passphrase || undefined,
    })
    ElMessage.success('添加成功')
  }
  showKeyDialog.value = false
}

const deleteKey = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个密钥吗？', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    keyStore.deleteKey(id)
    ElMessage.success('删除成功')
  } catch {
    // 取消
  }
}
</script>

<style scoped>
.settings-view {
  height: 100%;
  overflow-y: auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.theme-setting {
  padding: 8px 0;
}

.color-setting {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.color-row label {
  min-width: 80px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.color-preview {
  padding: 4px 12px;
  border-radius: 4px;
  border: 2px solid;
  font-size: 13px;
  color: var(--el-text-color-primary);
  min-width: 100px;
  text-align: center;
}

.color-actions {
  margin-top: 8px;
}

/* 编辑器设置 */
.editor-setting {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.editor-setting label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}
.setting-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin: 0;
}

.keys-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.keys-header {
  display: flex;
  justify-content: flex-end;
}

.key-preview {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 3px;
  display: inline-block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commands-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.commands-header {
  display: flex;
  justify-content: flex-end;
}

.command-text {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 3px;
}

/* 终端主题 */
.terminal-theme-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.theme-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.theme-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.theme-card {
  width: 140px;
  border: 2px solid var(--el-border-color);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
}

.theme-card:hover {
  border-color: var(--el-color-primary-light-3);
}

.theme-card.active {
  border-color: var(--el-color-primary);
}

.theme-preview {
  height: 48px;
  padding: 6px 8px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.theme-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px;
  background: var(--el-bg-color);
}

.theme-name {
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.theme-card-actions {
  display: flex;
  gap: 2px;
}

.theme-empty {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  padding: 8px 0;
}

/* 自定义主题编辑 */
.color-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.color-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.color-item label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
</style>
