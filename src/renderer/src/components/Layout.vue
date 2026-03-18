<template>
  <el-container class="layout-container">
    <el-aside width="200px">
      <el-menu
        default-active="/"
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
    <el-main>
      <slot></slot>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { DataLine, User, Money, Setting } from '@element-plus/icons-vue';
</script>

<style scoped>
.layout-container {
  height: 100vh;
}
.el-menu-vertical {
  height: 100%;
  border-right: none;
}
</style>
