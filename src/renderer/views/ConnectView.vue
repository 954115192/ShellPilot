<template>
  <div class="connect-view">
    <div class="connect-header">
      <h2 class="page-title">SSH 连接管理</h2>
      <div class="header-actions">
        <el-button @click="importSSHConfig">
          <el-icon><Upload /></el-icon>
          导入
        </el-button>
        <el-button @click="showGroupDialog = true">
          <el-icon><FolderOpened /></el-icon>
          分组管理
        </el-button>
        <el-button type="primary" @click="openNewDialog">
          <el-icon><Plus /></el-icon>
          新建连接
        </el-button>
      </div>
    </div>

    <div class="saved-section" v-loading="loading">
      <el-empty v-if="!loading && savedSessions.length === 0" description="暂无历史连接，点击「新建连接」添加服务器" :image-size="100">
        <el-button type="primary" @click="openNewDialog">
          <el-icon><Plus /></el-icon>
          新建连接
        </el-button>
      </el-empty>

      <div v-else-if="!loading" class="grouped-list">
        <div v-for="group in groupedSessions" :key="group.id" class="session-group">
          <div class="group-header" @click="toggleGroup(group.id)">
            <el-icon class="group-arrow" :class="{ expanded: expandedGroups.has(group.id) }"><ArrowRight /></el-icon>
            <span class="group-name">{{ group.name }}</span>
            <el-tag size="small" type="info">{{ group.sessions.length }}</el-tag>
          </div>
          <transition name="group-expand">
            <div v-if="expandedGroups.has(group.id)" class="group-sessions">
              <el-card v-for="session in group.sessions" :key="session.id" class="saved-card" shadow="hover" @dblclick="quickConnect(session)">
                <div class="card-body">
                  <div class="card-info">
                    <div class="card-name">
                      <el-icon><Monitor /></el-icon>
                      <span class="name-text">{{ session.name }}</span>
                      <el-tag size="small" type="info">{{ session.port }}</el-tag>
                    </div>
                    <div class="card-meta">
                      <span class="meta-host">{{ session.username }}@{{ session.host }}</span>
                      <span v-if="session.lastConnected" class="meta-time">{{ formatTime(session.lastConnected) }}</span>
                    </div>
                  </div>
                  <div class="card-actions">
                    <el-button type="primary" size="small" :loading="connectingId === session.id" @click="quickConnect(session)">连接</el-button>
                    <el-button size="small" @click="openEditDialog(session)">编辑</el-button>
                    <el-button size="small" type="danger" plain @click="deleteSession(session)">删除</el-button>
                  </div>
                </div>
              </el-card>
            </div>
          </transition>
        </div>

        <div v-if="ungroupedSessions.length > 0" class="session-group">
          <div class="group-header" @click="toggleGroup('__ungrouped__')">
            <el-icon class="group-arrow" :class="{ expanded: expandedGroups.has('__ungrouped__') }"><ArrowRight /></el-icon>
            <span class="group-name">未分组</span>
            <el-tag size="small" type="info">{{ ungroupedSessions.length }}</el-tag>
          </div>
          <transition name="group-expand">
            <div v-if="expandedGroups.has('__ungrouped__')" class="group-sessions">
              <el-card v-for="session in ungroupedSessions" :key="session.id" class="saved-card" shadow="hover" @dblclick="quickConnect(session)">
                <div class="card-body">
                  <div class="card-info">
                    <div class="card-name">
                      <el-icon><Monitor /></el-icon>
                      <span class="name-text">{{ session.name }}</span>
                      <el-tag size="small" type="info">{{ session.port }}</el-tag>
                    </div>
                    <div class="card-meta">
                      <span class="meta-host">{{ session.username }}@{{ session.host }}</span>
                      <span v-if="session.lastConnected" class="meta-time">{{ formatTime(session.lastConnected) }}</span>
                    </div>
                  </div>
                  <div class="card-actions">
                    <el-button type="primary" size="small" :loading="connectingId === session.id" @click="quickConnect(session)">连接</el-button>
                    <el-button size="small" @click="openEditDialog(session)">编辑</el-button>
                    <el-button size="small" type="danger" plain @click="deleteSession(session)">删除</el-button>
                  </div>
                </div>
              </el-card>
            </div>
          </transition>
        </div>
      </div>
    </div>

    <!-- Connection dialog -->
    <el-dialog v-model="showDialog" :title="isEditing ? '编辑 SSH 连接' : '新建 SSH 连接'" width="480px" :close-on-click-modal="false" destroy-on-close>
      <el-form ref="formRef" :model="connectionForm" label-width="80px" @keyup.enter="handleSubmit">
        <el-form-item label="会话" required>
          <el-input v-model="connectionForm.name" placeholder="例如: 生产服务器" />
        </el-form-item>
        <el-form-item label="主机" required>
          <el-input v-model="connectionForm.host" placeholder="例如: 192.168.1.100" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="connectionForm.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="用户名" required>
          <el-input v-model="connectionForm.username" placeholder="例如: root" />
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="connectionForm.groupId" placeholder="不分组" clearable style="width: 100%">
            <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="认证方式">
          <el-radio-group v-model="connectionForm.authType">
            <el-radio value="password">密码</el-radio>
            <el-radio value="key">私钥</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="connectionForm.authType === 'password'" label="密码">
          <el-input v-model="connectionForm.password" type="password" :placeholder="isEditing ? '留空则不修改密码' : '输入密码'" show-password />
        </el-form-item>
        <template v-if="connectionForm.authType === 'key'">
          <el-form-item label="选择密钥">
            <el-select v-model="connectionForm.keyId" placeholder="选择已保存的密钥" clearable style="width: 100%">
              <el-option v-for="key in sshKeys" :key="key.id" :label="key.name" :value="key.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="或上传">
            <el-upload :auto-upload="false" :show-file-list="false" accept=".pem,.key,.pub,*" @change="handleKeyFileUpload">
              <el-button size="small">选择私钥文件</el-button>
            </el-upload>
            <div v-if="connectionForm.privateKey" class="key-uploaded">
              <el-tag type="success" size="small">已加载</el-tag>
              <span class="key-name">{{ uploadedKeyName }}</span>
            </div>
          </el-form-item>
          <el-form-item label="密码短语">
            <el-input v-model="connectionForm.passphrase" type="password" placeholder="可选，私钥密码短语" show-password />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button v-if="isEditing" type="primary" :loading="connecting" @click="handleUpdate">保存</el-button>
        <el-button v-else type="primary" :loading="connecting" @click="handleConnect">连接</el-button>
      </template>
    </el-dialog>

    <!-- SSH config import dialog -->
    <el-dialog v-model="showImportDialog" title="从 SSH Config 导入" width="520px" destroy-on-close>
      <div v-if="importableHosts.length === 0" style="text-align:center;padding:20px;">
        <el-empty description="未找到 ~/.ssh/config 文件或文件中无可用 Host 配置" :image-size="60" />
      </div>
      <template v-else>
        <el-checkbox-group v-model="selectedImportHosts">
          <div v-for="host in importableHosts" :key="host.name" class="import-host-item">
            <el-checkbox :value="host.name">
              <span class="import-host-name">{{ host.name }}</span>
              <span class="import-host-meta">{{ host.user }}@{{ host.hostName }}:{{ host.port }}</span>
            </el-checkbox>
          </div>
        </el-checkbox-group>
      </template>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" :disabled="selectedImportHosts.length === 0" @click="doImport">
          导入 ({{ selectedImportHosts.length }})
        </el-button>
      </template>
    </el-dialog>

    <!-- Group management dialog -->
    <el-dialog v-model="showGroupDialog" title="分组管理" width="400px" destroy-on-close>
      <div class="group-management">
        <div class="group-add-row">
          <el-input v-model="newGroupName" placeholder="新分组名称" @keyup.enter="addGroup" />
          <el-button type="primary" @click="addGroup" :disabled="!newGroupName.trim()">添加</el-button>
        </div>
        <div class="group-list">
          <div v-for="g in groups" :key="g.id" class="group-item">
            <template v-if="editingGroupId === g.id">
              <el-input v-model="editingGroupName" size="small" @keyup.enter="saveGroupEdit(g.id)" @blur="saveGroupEdit(g.id)" />
            </template>
            <template v-else>
              <span class="group-item-name">{{ g.name }}</span>
            </template>
            <div class="group-item-actions">
              <el-button size="small" link @click="startEditGroup(g)"><el-icon><Edit /></el-icon></el-button>
              <el-button size="small" link type="danger" @click="deleteGroup(g)"><el-icon><Delete /></el-icon></el-button>
            </div>
          </div>
          <el-empty v-if="groups.length === 0" description="暂无分组" :image-size="60" />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Monitor, FolderOpened, ArrowRight, Edit, Delete, Upload } from '@element-plus/icons-vue'
import { useCommandStore, makeConnKey } from '../stores/commandStore'
import { useKeyStore } from '../stores/keyStore'

interface SavedSession {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  keyId?: string
  groupId?: string
  createdAt: number
  lastConnected?: number
}

interface SessionGroup {
  id: string
  name: string
  order: number
}

const props = defineProps<{ tabId?: string }>()
const emit = defineEmits<{
  connected: [session: { tabId: string; host: string; port: number; username: string; password?: string }]
}>()

const savedSessions = ref<SavedSession[]>([])
const groups = ref<SessionGroup[]>([])
const expandedGroups = ref<Set<string>>(new Set())
const connecting = ref(false)
const connectingId = ref<string | null>(null)
const showDialog = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const loading = ref(true)
const formRef = ref<any>(null)
const commandStore = useCommandStore()
const keyStore = useKeyStore()
const sshKeys = computed(() => keyStore.keys)
const uploadedKeyName = ref('')

const showGroupDialog = ref(false)
const newGroupName = ref('')
const editingGroupId = ref<string | null>(null)
const editingGroupName = ref('')

const showImportDialog = ref(false)
const importableHosts = ref<any[]>([])
const selectedImportHosts = ref<string[]>([])

const connectionForm = ref({
  name: '', host: '', port: 22, username: '',
  authType: 'password' as 'password' | 'key',
  password: '', keyId: '', privateKey: '', passphrase: '', groupId: '',
})

const groupedSessions = computed(() => {
  return groups.value.map(g => ({
    ...g,
    sessions: savedSessions.value.filter(s => s.groupId === g.id)
  })).filter(g => g.sessions.length > 0)
})

const ungroupedSessions = computed(() => {
  const groupIds = new Set(groups.value.map(g => g.id))
  return savedSessions.value.filter(s => !s.groupId || !groupIds.has(s.groupId))
})

function toggleGroup(id: string) {
  if (expandedGroups.value.has(id)) {
    expandedGroups.value.delete(id)
  } else {
    expandedGroups.value.add(id)
  }
}

let tabCounter = 1

const handleKeyFileUpload = (file: any) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    if (content) {
      connectionForm.value.privateKey = content
      uploadedKeyName.value = file.name
    }
  }
  reader.readAsText(file.raw)
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function openNewDialog() {
  isEditing.value = false
  editingId.value = null
  connectionForm.value = { name: '', host: '', port: 22, username: '', authType: 'password', password: '', keyId: '', privateKey: '', passphrase: '', groupId: '' }
  uploadedKeyName.value = ''
  showDialog.value = true
}

function openEditDialog(session: SavedSession) {
  isEditing.value = true
  editingId.value = session.id
  connectionForm.value = {
    name: session.name, host: session.host, port: session.port, username: session.username,
    authType: session.authType || 'password', password: '', keyId: session.keyId || '',
    privateKey: '', passphrase: '', groupId: session.groupId || '',
  }
  uploadedKeyName.value = ''
  showDialog.value = true
}

async function doConnect(config: any, savedId?: string): Promise<boolean> {
  const tabId = props.tabId || String(tabCounter++)
  let sshConfig: any = { host: config.host, port: config.port, username: config.username }
  const authType = config.authType || 'password'

  if (authType === 'key') {
    let privateKey = config.privateKey
    let passphrase = config.passphrase
    if (!privateKey && config.keyId) {
      const key = keyStore.getKeyById(config.keyId)
      if (key) { privateKey = key.privateKey; passphrase = key.passphrase }
    }
    if (privateKey) { sshConfig.privateKey = privateKey; sshConfig.passphrase = passphrase }
  } else {
    sshConfig.password = config.password || ''
  }

  try {
    const result = await window.electronAPI.connectSSH(sshConfig, tabId)
    if (!result.success) { ElMessage.error(result.message || '连接失败'); return false }

    if (config.authType === 'key' && config.privateKey && !config.keyId) {
      keyStore.addKey({ name: config.name, privateKey: config.privateKey, passphrase: config.passphrase })
    }

    await window.electronAPI.saveSession({
      name: config.name, host: config.host, port: config.port, username: config.username,
      authType: config.authType, password: config.authType === 'password' ? config.password : undefined,
      keyId: config.keyId, groupId: config.groupId,
    })
    await loadSavedSessions()
    emit('connected', { tabId, ...config, connected: true })
    return true
  } catch (error) {
    ElMessage.error('连接失败：' + (error as Error).message)
    return false
  }
}

async function handleConnect() {
  if (!connectionForm.value.name) { ElMessage.warning('请输入连接名称'); return }
  if (!connectionForm.value.host) { ElMessage.warning('请输入主机地址'); return }
  if (!connectionForm.value.username) { ElMessage.warning('请输入用户名'); return }

  connecting.value = true
  try {
    const ok = await doConnect({ ...connectionForm.value })
    if (ok) {
      showDialog.value = false
      connectionForm.value = { name: '', host: '', port: 22, username: '', authType: 'password', password: '', keyId: '', privateKey: '', passphrase: '', groupId: '' }
      uploadedKeyName.value = ''
    }
  } finally { connecting.value = false }
}

async function handleUpdate() {
  if (!connectionForm.value.name) { ElMessage.warning('请输入连接名称'); return }
  if (!connectionForm.value.host) { ElMessage.warning('请输入主机地址'); return }
  if (!connectionForm.value.username) { ElMessage.warning('请输入用户名'); return }
  if (!editingId.value) return

  connecting.value = true
  try {
    await window.electronAPI.updateSavedSession(editingId.value, {
      name: connectionForm.value.name, host: connectionForm.value.host,
      port: connectionForm.value.port, username: connectionForm.value.username,
      password: connectionForm.value.password || undefined, groupId: connectionForm.value.groupId || undefined,
    })
    await loadSavedSessions()
    showDialog.value = false
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败：' + (error as Error).message)
  } finally { connecting.value = false }
}

async function handleSubmit() {
  isEditing.value ? await handleUpdate() : await handleConnect()
}

async function quickConnect(session: SavedSession) {
  connectingId.value = session.id
  try {
    const decrypted = await window.electronAPI.getSavedSessionDecrypted(session.id)
    const d = decrypted || session
    await doConnect({ name: d.name, host: d.host, port: d.port, username: d.username, authType: d.authType || 'password', password: d.password, keyId: d.keyId }, session.id)
  } finally { connectingId.value = null }
}

async function deleteSession(session: SavedSession) {
  try {
    await ElMessageBox.confirm(`确定要删除「${session.name}」(${session.username}@${session.host}) 的连接记录吗？`, '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await window.electronAPI.deleteSavedSession(session.id)
    const connKey = makeConnKey(session.host, session.port, session.username)
    commandStore.clearFrequentByConnKey(connKey)
    savedSessions.value = savedSessions.value.filter(s => s.id !== session.id)
    ElMessage.success('删除成功')
  } catch {}
}

async function loadSavedSessions() {
  loading.value = true
  try {
    const [sessions, grp] = await Promise.all([
      window.electronAPI.getSavedSessions(),
      window.electronAPI.getGroups(),
    ])
    savedSessions.value = (sessions || []).sort((a: SavedSession, b: SavedSession) => {
      return (b.lastConnected || b.createdAt) - (a.lastConnected || a.createdAt)
    })
    groups.value = (grp || []).sort((a: SessionGroup, b: SessionGroup) => a.order - b.order)
    for (const g of groups.value) expandedGroups.value.add(g.id)
    if (ungroupedSessions.value.length > 0) expandedGroups.value.add('__ungrouped__')
  } catch (error) {
    console.error('[ConnectView] Failed to load:', error)
  } finally { loading.value = false }
}

async function addGroup() {
  const name = newGroupName.value.trim()
  if (!name) return
  try {
    const group = await window.electronAPI.createGroup(name)
    if (group) { groups.value.push(group); newGroupName.value = ''; ElMessage.success('分组已创建') }
  } catch { ElMessage.error('创建失败') }
}

function startEditGroup(g: SessionGroup) {
  editingGroupId.value = g.id
  editingGroupName.value = g.name
}

async function saveGroupEdit(id: string) {
  const name = editingGroupName.value.trim()
  if (name) {
    await window.electronAPI.updateGroup(id, { name })
    const g = groups.value.find(x => x.id === id)
    if (g) g.name = name
  }
  editingGroupId.value = null
}

async function deleteGroup(g: SessionGroup) {
  try {
    await ElMessageBox.confirm(`确定删除分组「${g.name}」？其中的连接将变为未分组。`, '确认删除', { type: 'warning' })
    await window.electronAPI.deleteGroup(g.id)
    groups.value = groups.value.filter(x => x.id !== g.id)
    await loadSavedSessions()
    ElMessage.success('分组已删除')
  } catch {}
}

async function importSSHConfig() {
  try {
    const hosts = await window.electronAPI.importSSHConfig()
    importableHosts.value = hosts || []
    selectedImportHosts.value = (hosts || []).map((h: any) => h.name)
    showImportDialog.value = true
  } catch { ElMessage.error('读取 SSH config 失败') }
}

async function doImport() {
  const toImport = importableHosts.value.filter(h => selectedImportHosts.value.includes(h.name))
  let count = 0
  for (const h of toImport) {
    try {
      await window.electronAPI.saveSession({ name: h.name, host: h.hostName, port: h.port, username: h.user || 'root' })
      count++
    } catch {}
  }
  await loadSavedSessions()
  showImportDialog.value = false
  ElMessage.success(`已导入 ${count} 个连接`)
}

onMounted(() => { loadSavedSessions() })
</script>

<style scoped>
.connect-view { height: 100%; max-width: 720px; margin: 0 auto; padding: 32px 20px; overflow-y: auto; }
.connect-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
.page-title { font-size: 22px; font-weight: 600; color: var(--el-text-color-primary); margin: 0; }
.header-actions { display: flex; gap: 8px; }
.saved-section { margin-top: 8px; }
.grouped-list { display: flex; flex-direction: column; gap: 8px; }
.session-group { margin-bottom: 4px; }
.group-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; cursor: pointer; border-radius: 6px; transition: background 0.15s; user-select: none; }
.group-header:hover { background: var(--el-fill-color-light); }
.group-arrow { transition: transform 0.2s; font-size: 14px; }
.group-arrow.expanded { transform: rotate(90deg); }
.group-name { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); }
.group-sessions { padding-left: 24px; display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.group-expand-enter-active, .group-expand-leave-active { transition: all 0.2s ease; overflow: hidden; }
.group-expand-enter-from, .group-expand-leave-to { opacity: 0; max-height: 0; }
.group-expand-enter-to, .group-expand-leave-from { opacity: 1; max-height: 2000px; }
.saved-card { border-radius: 8px; transition: all 0.2s; }
.saved-card:hover { border-color: var(--el-color-primary); }
.card-body { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.card-info { flex: 1; min-width: 0; }
.card-name { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.name-text { font-size: 15px; font-weight: 600; color: var(--el-color-primary); }
.card-meta { display: flex; align-items: center; gap: 16px; font-size: 13px; color: var(--el-text-color-secondary); padding-left: 24px; }
.meta-host { font-family: 'Consolas', 'Courier New', monospace; }
.meta-time { font-size: 12px; }
.card-actions { display: flex; gap: 8px; flex-shrink: 0; }
.key-uploaded { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.key-name { font-size: 12px; color: var(--el-text-color-secondary); }
.group-management { display: flex; flex-direction: column; gap: 16px; }
.group-add-row { display: flex; gap: 8px; }
.group-list { display: flex; flex-direction: column; gap: 4px; }
.group-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 6px; background: var(--el-fill-color-lighter); }
.group-item-name { font-size: 14px; }
.group-item-actions { display: flex; gap: 4px; }
.import-host-item { padding: 8px 0; border-bottom: 1px solid var(--el-border-color-lighter); }
.import-host-name { font-weight: 600; margin-right: 8px; }
.import-host-meta { font-size: 12px; color: var(--el-text-color-secondary); font-family: 'Consolas', monospace; }
</style>