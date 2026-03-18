<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="layout-aside">
      <el-menu
        :default-active="activeMenu"
        class="el-menu-vertical"
        router
        background-color="#545c64"
        text-color="#fff"
        active-text-color="#ffd04b"
      >
        <el-menu-item index="/">
          <el-icon><DataLine /></el-icon>
          <span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/members">
          <el-icon><User /></el-icon>
          <span>会员管理</span>
        </el-menu-item>
        <el-menu-item index="/transactions">
          <el-icon><Money /></el-icon>
          <span>收支记账</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>系统设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main class="layout-main">
      <div class="page-shell">
        <slot></slot>
      </div>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { DataLine, User, Money, Setting } from '@element-plus/icons-vue';

const route = useRoute();
const activeMenu = computed(() => route.path);
</script>

<style scoped>
.layout-container {
  height: 100vh;
  min-height: 100vh;
  background: var(--ui-bg);
}
.layout-aside {
  box-shadow: 2px 0 12px rgba(31, 42, 61, 0.08);
}
.el-menu-vertical {
  height: 100%;
  border-right: none;
}
.layout-main {
  padding: var(--space-xl);
  overflow: auto;
  min-width: 0;
}
@media (max-width: 1024px) {
  .layout-main {
    padding: var(--space-lg);
  }
}
</style>
