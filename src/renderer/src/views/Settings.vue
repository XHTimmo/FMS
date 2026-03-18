<template>
  <Layout>
    <div class="page-header">
      <h2>系统设置</h2>
    </div>
    <el-card class="page-card">
      <el-form label-width="120px">
        <el-form-item label="数据存储路径">
          <div class="db-path-container form-actions">
            <el-input v-model="dbPath" readonly />
            <el-button @click="openDbFolder">打开文件夹</el-button>
            <el-button type="primary" @click="changeDbPath">更改存储位置</el-button>
          </div>
        </el-form-item>
        <el-divider />
        <el-form-item label="数据备份">
          <el-button type="primary" @click="backupData">立即备份</el-button>
        </el-form-item>
        <el-divider />
        <el-form-item label="审计日志">
          <el-button @click="loadAuditLogs">刷新日志</el-button>
          <el-tag type="info">最近 {{ auditLogs.length }} 条</el-tag>
        </el-form-item>
        <el-table :data="auditLogs" style="width: 100%" max-height="280">
          <el-table-column prop="module" label="模块" width="130" />
          <el-table-column prop="action" label="动作" width="130" />
          <el-table-column prop="operator_name" label="操作人" width="120" />
          <el-table-column prop="operator_role" label="角色" width="110" />
          <el-table-column prop="ip_address" label="IP" width="140" />
          <el-table-column prop="created_at" label="时间" />
        </el-table>
        <el-divider />
        <el-form-item label="系统更新">
          <div class="update-container">
            <span>当前版本: v1.0.0</span>
            <el-button type="primary" @click="checkForUpdates" :loading="updateStatus === 'checking'">检查更新</el-button>
            
            <div v-if="updateStatus === 'available'" class="update-status">
              <el-tag type="success">发现新版本: {{ updateInfo?.version }}</el-tag>
              <el-button type="success" @click="downloadUpdate">下载更新</el-button>
            </div>
            
            <div v-if="updateStatus === 'downloading'" class="update-status">
              <el-progress :percentage="Math.round(downloadProgress)" />
            </div>

            <div v-if="updateStatus === 'downloaded'" class="update-status">
              <el-tag type="warning">更新下载完成</el-tag>
              <el-button type="danger" @click="installUpdate">重启并安装</el-button>
            </div>

            <div v-if="updateStatus === 'not-available'" class="update-status">
              <el-tag type="info">当前已是最新版本</el-tag>
            </div>

            <div v-if="updateStatus === 'error'" class="update-status">
              <el-tag type="danger">检查更新失败: {{ updateError }}</el-tag>
            </div>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </Layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import Layout from '../components/Layout.vue';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';

const dbPath = ref('');
const updateStatus = ref('');
const updateInfo = ref<any>(null);
const downloadProgress = ref(0);
const updateError = ref('');
const auditLogs = ref<any[]>([]);

const loadDbPath = async () => {
  try {
    dbPath.value = await window.electronAPI.invoke('system:get-db-path');
  } catch (error) {
    console.error(error);
  }
};

const openDbFolder = async () => {
  await window.electronAPI.invoke('system:open-db-folder');
};

const changeDbPath = async () => {
  try {
    const result = await window.electronAPI.invoke('system:change-db-path');
    if (result.success) {
      dbPath.value = result.newPath;
      ElMessage.success('数据存储位置已更新，请重启应用以确保最佳体验');
    } else if (result.reason !== 'canceled') {
      ElMessage.error('更改失败: ' + result.error);
    }
  } catch (error: any) {
    ElMessage.error('操作失败: ' + (error.message || error));
  }
};

const backupData = async () => {
  try {
    const result = await window.electronAPI.invoke('system:backup:run');
    if (result?.success) {
      ElMessage.success(`备份完成：${result.backupPath}`);
      return;
    }
    ElMessage.warning('备份失败，请检查数据文件状态');
  } catch (error: any) {
    ElMessage.error(error.message || '备份失败');
  }
};

const loadAuditLogs = async () => {
  try {
    const logs = await window.electronAPI.invoke('system:audit:list', { limit: 100 });
    auditLogs.value = (logs || []).map((item: any) => ({
      ...item,
      created_at: dayjs.unix(Number(item.created_at || 0)).format('YYYY-MM-DD HH:mm:ss')
    }));
  } catch (error: any) {
    ElMessage.error(error.message || '加载审计日志失败');
  }
};

// --- Update Logic ---
const checkForUpdates = async () => {
  updateStatus.value = 'checking';
  updateError.value = '';
  await window.electronAPI.invoke('updater:check');
};

const downloadUpdate = async () => {
  updateStatus.value = 'downloading';
  await window.electronAPI.invoke('updater:download');
};

const installUpdate = () => {
  window.electronAPI.invoke('updater:install');
};

const handleUpdaterStatus = (data: any) => {
  updateStatus.value = data.status;
  if (data.info) updateInfo.value = data.info;
  if (data.error) updateError.value = data.error;
};

const handleUpdaterProgress = (data: any) => {
  if (updateStatus.value !== 'downloading') {
    updateStatus.value = 'downloading';
  }
  downloadProgress.value = data.percent;
};

onMounted(() => {
  loadDbPath();
  loadAuditLogs();
  window.electronAPI.on('updater:status', handleUpdaterStatus);
  window.electronAPI.on('updater:progress', handleUpdaterProgress);
});

onUnmounted(() => {
  window.electronAPI.off('updater:status');
  window.electronAPI.off('updater:progress');
});
</script>

<style scoped>
.db-path-container {
  display: flex;
  gap: var(--space-sm);
  width: 100%;
  align-items: center;
  flex-wrap: wrap;
}
.update-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: flex-start;
}
.update-status {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  width: 100%;
  flex-wrap: wrap;
}
@media (max-width: 768px) {
  .db-path-container :deep(.el-input) {
    width: 100%;
  }
}
</style>
