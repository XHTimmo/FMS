<template>
  <el-config-provider size="default">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { ElConfigProvider } from 'element-plus';
</script>

<style>
:root {
  --ui-bg: #f3f5f9;
  --ui-surface: #ffffff;
  --ui-surface-soft: #f9fbff;
  --ui-border: #dfe5ef;
  --ui-text-primary: #1f2a3d;
  --ui-text-secondary: #5b6b84;
  --ui-brand: #3a7afe;
  --ui-success: #34b368;
  --ui-warning: #f5a524;
  --ui-danger: #f05b6b;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 20px;
  --space-xl: 24px;
  --radius-md: 12px;
  --radius-lg: 16px;
}
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--ui-bg);
  color: var(--ui-text-primary);
  font-size: 14px;
  line-height: 1.5;
}
#app {
  height: 100vh;
  width: 100vw;
}
h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 650;
  color: var(--ui-text-primary);
}
.page-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}
.page-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}
.page-card {
  border-radius: var(--radius-md);
}
.form-actions {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  flex-wrap: wrap;
}
.el-card {
  border-radius: var(--radius-md);
  border: 1px solid var(--ui-border);
}
.el-button + .el-button {
  margin-left: 0;
}
.el-tag {
  border-radius: 999px;
}
.el-table {
  border-radius: var(--radius-md);
  overflow: hidden;
}
@media (max-width: 1280px) {
  h2 {
    font-size: 22px;
  }
}
@media (max-width: 992px) {
  h2 {
    font-size: 20px;
  }
}
</style>
