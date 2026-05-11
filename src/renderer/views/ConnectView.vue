<template>
  <div class="connect-view">
    <div class="connect-header">
      <h2 class="page-title">SSH 连接管理</h2>
      <el-button type="primary" @click="openNewDialog">
        <el-icon><Plus /></el-icon>
        新建连接
      </el-button>
    </div>

    <div class="saved-section" v-loading="loading">
      <div class="section-header">
        <h3 class="section-title">历史连接</h3>
      </div>

      <el-empty v-if="!loading && savedSessions.length === 0" description="暂无历史连接，点击「新建连接」添加服务器" :image-size="100">
        <el-button type="primary" @click="openNewDialog">
          <el-icon><Plus /></el-icon>
          新建连接
        </el-button>
      </el-empty>

      <div v-else-if="!loading" class="saved-list">
        <el-card
          v-for="session in savedSessions"
          :key="session.id"
          class="saved-card"
          shadow="hover"
          @dblclick="quickConnect(session)"
        >
          <div class="card-body">
            <div class="card-info">
              <div class="card-name">
                <el-icon><Monitor /></el-icon>
                <span class="name-text">{{ session.name }}</span>
                <el-tag size="small" type="info">端口 {{ session.port }}</el-tag>
              </div>
              <div class="card-meta">
                <span class="meta-host">{{ session.username }}@{{ session.host }}</span>
                <span v-if="session.lastConnected" class="meta-time">
                  上次连接: {{ formatTime(session.lastConnected) }}
                </span>
              </div>
            </div>
            <div class="card-actions">
              <el-button
                type="primary"
                size="small"
                :loading="connectingId === session.id"
                @click="quickConnect(session)"
              >
                快速连接
              </el-button>
              <el-button
                size="small"
                @click="openEditDialog(session)"
              >
                编辑
              </el-button>
              <el-button
                size="small"
                type="danger"
                plain
                @click="deleteSession(session)"
              >
                删除
              </el-button>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 新建/编辑连接对话框 -->
    <el-dialog
      v-model="showDialog"
      :title="isEditing ? '编辑 SSH 连接' : '新建 SSH 连接'"
      width="480px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="connectionForm"
        label-width="80px"
        @keyup.enter="handleSubmit"
      >
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
        <el-form-item label="认证方式">
          <el-radio-group v-model="connectionForm.authType">
            <el-radio value="password">密码</el-radio>
            <el-radio value="key">私钥</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="connectionForm.authType === 'password'" label="密码">
          <el-input
            v-model="connectionForm.password"
            type="password"
            :placeholder="isEditing ? '留空则不修改密码' : '输入密码'"
            show-password
          />
        </el-form-item>
        <template v-if="connectionForm.authType === 'key'">
          <el-form-item label="选择密钥">
            <el-select
              v-model="connectionForm.keyId"
              placeholder="选择已保存的密钥"
              clearable
              style="width: 100%"
            >
              <el-option
                v-for="key in sshKeys"
                :key="key.id"
                :label="key.name"
                :value="key.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="或上传">
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              accept=".pem,.key,.pub,*"
              @change="handleKeyFileUpload"
            >
              <el-button size="small">选择私钥文件</el-button>
            </el-upload>
            <div v-if="connectionForm.privateKey" class="key-uploaded">
              <el-tag type="success" size="small">已加载</el-tag>
              <span class="key-name">{{ uploadedKeyName }}</span>
            </div>
          </el-form-item>
          <el-form-item label="密码短语">
            <el-input
              v-model="connectionForm.passphrase"
              type="password"
              placeholder="可选，私钥密码短语"
              show-password
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button v-if="isEditing" type="primary" :loading="connecting" @click="handleUpdate">
          保存
        </el-button>
        <el-button v-else type="primary" :loading="connecting" @click="handleConnect">
          连接
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Monitor } from '@element-plus/icons-vue'
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
  createdAt: number
  lastConnected?: number
}

const props = defineProps<{
  tabId?: string
}>()

const emit = defineEmits<{
  connected: [session: { tabId: string; host: string; port: number; username: string; password?: string }]
}>()

const savedSessions = ref<SavedSession[]>([])
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

const connectionForm = ref({
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password' as 'password' | 'key',
  password: '',
  keyId: '',
  privateKey: '',
  passphrase: '',
})

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
  connectionForm.value = { name: '', host: '', port: 22, username: '', authType: 'password', password: '', keyId: '', privateKey: '', passphrase: '' }
  uploadedKeyName.value = ''
  showDialog.value = true
}

function openEditDialog(session: SavedSession) {
  isEditing.value = true
  editingId.value = session.id
  connectionForm.value = {
    name: session.name,
    host: session.host,
    port: session.port,
    username: session.username,
    authType: session.authType || 'password',
    password: '',
    keyId: session.keyId || '',
    privateKey: '',
    passphrase: '',
  }
  uploadedKeyName.value = ''
  showDialog.value = true
}

async function doConnect(config: { name: string; host: string; port: number; username: string; authType?: 'password' | 'key'; password?: string; keyId?: string; privateKey?: string; passphrase?: string }, savedId?: string): Promise<boolean> {
  const tabId = props.tabId || String(tabCounter++)

  // 获取认证信息
  let sshConfig: any = { host: config.host, port: config.port, username: config.username }

  const authType = config.authType || 'password'

  if (authType === 'key') {
    // 私钥认证
    let privateKey = config.privateKey
    let passphrase = config.passphrase

    // 如果没有上传的私钥，从已保存的密钥中获取
    if (!privateKey && config.keyId) {
      const key = keyStore.getKeyById(config.keyId)
      if (key) {
        privateKey = key.privateKey
        passphrase = key.passphrase
      }
    }

    if (privateKey) {
      sshConfig.privateKey = privateKey
      sshConfig.passphrase = passphrase
    }
  } else {
    // 密码认证
    sshConfig.password = config.password || ''
  }

  try {
    const result = await window.electronAPI.connectSSH(sshConfig, tabId)
    if (!result.success) {
      ElMessage.error(result.message || '连接失败')
      return false
    }

    // 连接成功后，如果是上传的私钥且未保存，自动保存
    if (config.authType === 'key' && config.privateKey && !config.keyId) {
      keyStore.addKey({
        name: config.name,
        privateKey: config.privateKey,
        passphrase: config.passphrase,
      })
    }

    await window.electronAPI.saveSession({
      name: config.name,
      host: config.host,
      port: config.port,
      username: config.username,
      authType: config.authType,
      password: config.authType === 'password' ? config.password : undefined,
      keyId: config.keyId,
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
  if (!connectionForm.value.name) {
    ElMessage.warning('请输入连接名称')
    return
  }
  if (!connectionForm.value.host) {
    ElMessage.warning('请输入主机地址')
    return
  }
  if (!connectionForm.value.username) {
    ElMessage.warning('请输入用户名')
    return
  }

  connecting.value = true
  try {
    const ok = await doConnect({ ...connectionForm.value })
    if (ok) {
      showDialog.value = false
      connectionForm.value = { name: '', host: '', port: 22, username: '', authType: 'password', password: '', keyId: '', privateKey: '', passphrase: '' }
      uploadedKeyName.value = ''
    }
  } finally {
    connecting.value = false
  }
}

async function handleUpdate() {
  if (!connectionForm.value.name) {
    ElMessage.warning('请输入连接名称')
    return
  }
  if (!connectionForm.value.host) {
    ElMessage.warning('请输入主机地址')
    return
  }
  if (!connectionForm.value.username) {
    ElMessage.warning('请输入用户名')
    return
  }
  if (!editingId.value) return

  connecting.value = true
  try {
    await window.electronAPI.updateSavedSession(editingId.value, {
      name: connectionForm.value.name,
      host: connectionForm.value.host,
      port: connectionForm.value.port,
      username: connectionForm.value.username,
      password: connectionForm.value.password || undefined,
    })
    await loadSavedSessions()
    showDialog.value = false
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败：' + (error as Error).message)
  } finally {
    connecting.value = false
  }
}

async function handleSubmit() {
  if (isEditing.value) {
    await handleUpdate()
  } else {
    await handleConnect()
  }
}

async function quickConnect(session: SavedSession) {
  connectingId.value = session.id
  try {
    await doConnect({
      name: session.name,
      host: session.host,
      port: session.port,
      username: session.username,
      authType: session.authType || 'password',
      password: session.password,
      keyId: session.keyId,
    }, session.id)
  } finally {
    connectingId.value = null
  }
}

async function deleteSession(session: SavedSession) {
  try {
    await ElMessageBox.confirm(
      `确定要删除「${session.name}」(${session.username}@${session.host}) 的连接记录吗？`,
      '确认删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await window.electronAPI.deleteSavedSession(session.id)
    // 清除该连接的常用命令
    const connKey = makeConnKey(session.host, session.port, session.username)
    commandStore.clearFrequentByConnKey(connKey)
    savedSessions.value = savedSessions.value.filter(s => s.id !== session.id)
    ElMessage.success('删除成功')
  } catch {
    // 取消删除不做操作
  }
}

async function loadSavedSessions() {
  loading.value = true
  try {
    const sessions = await window.electronAPI.getSavedSessions()
    savedSessions.value = (sessions || []).sort((a: SavedSession, b: SavedSession) => {
      const ta = a.lastConnected || a.createdAt
      const tb = b.lastConnected || b.createdAt
      return tb - ta
    })
  } catch (error) {
    console.error('[ConnectView] Failed to load saved sessions:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSavedSessions()
})
</script>

<style scoped>
.connect-view {
  height: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 20px;
  overflow-y: auto;
}

.connect-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
}

.saved-section {
  margin-top: 8px;
}

.section-header {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin: 0;
}

.saved-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.saved-card {
  border-radius: 8px;
  transition: all 0.2s;
}

.saved-card:hover {
  border-color: var(--el-color-primary);
}

.card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.name-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  padding-left: 24px;
}

.meta-host {
  font-family: 'Consolas', 'Courier New', monospace;
}

.meta-time {
  font-size: 12px;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.key-uploaded {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.key-name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
