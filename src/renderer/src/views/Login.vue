<template>
  <div class="login-container">
    <el-card class="login-card">
      <h2>系统登录</h2>
      <el-form :model="form" @submit.prevent="handleLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" show-password />
        </el-form-item>
        <el-button type="primary" native-type="submit" class="w-full">登录</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const form = reactive({ username: '', password: '' });

const handleLogin = () => {
  // TODO: Implement actual auth via IPC
  if (form.username === 'admin' && form.password === '123456') {
    router.push('/');
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #2b3a4a;
}
.login-card {
  width: 350px;
}
.w-full {
  width: 100%;
}
</style>
