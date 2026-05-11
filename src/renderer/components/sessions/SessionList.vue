<template>
  <div class="session-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>会话列表</span>
          <el-button @click="refreshSessions" :disabled="!connected" size="small">
            刷新
          </el-button>
        </div>
      </template>

      <el-empty v-if="sessions.length === 0" description="暂无会话" />

      <el-table v-else :data="sessions" style="width: 100%">
        <el-table-column prop="host" label="主机" width="180" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="port" label="端口" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.connected ? 'success' : 'info'" size="small">
              {{ row.connected ? '已连接' : '已断开' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button
              v-if="!row.connected"
              size="small"
              type="primary"
              @click="reconnectSession(row)"
            >
              重连
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="removeSession(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

interface Session {
  id: string;
  host: string;
  port: number;
  username: string;
  connected: boolean;
}

const sessions = ref<Session[]>([]);
const connected = ref(false);

const refreshSessions = async () => {
  try {
    const result = await window.electronAPI.listSessions();
    sessions.value = result || [];
    connected.value = sessions.value.some(s => s.connected);
  } catch (error) {
    ElMessage.error('获取会话列表失败');
  }
};

const reconnectSession = async (session: Session) => {
  try {
    await window.electronAPI.createSession({
      host: session.host,
      port: session.port,
      username: session.username,
    });
    ElMessage.success('重连成功');
    refreshSessions();
  } catch (error) {
    ElMessage.error('重连失败：' + (error as Error).message);
  }
};

const removeSession = async (session: Session) => {
  try {
    await window.electronAPI.deleteSavedSession(session.id);
    sessions.value = sessions.value.filter(s => s.id !== session.id);
    connected.value = sessions.value.some(s => s.connected);
    ElMessage.success('删除成功');
  } catch (error) {
    ElMessage.error('删除失败');
  }
};

onMounted(() => {
  refreshSessions();
});
</script>

<style scoped>
.session-list {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>