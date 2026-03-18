<template>
  <div class="home-container">
    <h1>工作室财务管理系统 - 主页</h1>
    <el-button type="primary" @click="testDb">测试数据库连接</el-button>
    <p>{{ result }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const result = ref('');

const testDb = async () => {
  if (window.electronAPI) {
    try {
      const res = await window.electronAPI.invoke('test-db');
      result.value = JSON.stringify(res, null, 2);
    } catch (error: any) {
      result.value = 'Error: ' + error.message;
    }
  } else {
    result.value = 'electronAPI 未注入';
  }
};
</script>

<style scoped>
.home-container {
  padding: 20px;
}
</style>
