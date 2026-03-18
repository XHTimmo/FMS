<template>
  <Layout>
    <h2>系统设置</h2>
    <el-card>
      <el-form label-width="120px">
        <el-form-item label="数据存储路径">
          <div class="db-path-container">
            <el-input v-model="dbPath" readonly />
            <el-button @click="openDbFolder">打开文件夹</el-button>
            <el-button type="primary" @click="changeDbPath">更改存储位置</el-button>
          </div>
        </el-form-item>
        <el-divider />
        <el-form-item label="数据备份">
          <el-button type="primary" @click="backupData">立即备份</el-button>
        </el-form-item>
        <el-form-item label="数据恢复">
          <el-button type="warning" @click="restoreData">恢复备份</el-button>
        </el-form-item>
        <el-form-item label="系统版本">
          <span>v1.0.0</span>
        </el-form-item>
      </el-form>
    </el-card>
  </Layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Layout from '../components/Layout.vue';
import { ElMessage } from 'element-plus';

const dbPath = ref('');

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
  // TODO: Implement backup via IPC
  ElMessage.info('备份功能开发中...');
};

const restoreData = async () => {
  // TODO: Implement restore via IPC
  ElMessage.info('恢复功能开发中...');
};

onMounted(loadDbPath);
</script>

<style scoped>
.db-path-container {
  display: flex;
  gap: 10px;
  width: 100%;
}
</style>
