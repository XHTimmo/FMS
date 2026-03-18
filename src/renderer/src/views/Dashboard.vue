<template>
  <Layout>
    <div class="dashboard-header">
      <h2>数据看板</h2>
      <el-button type="primary" @click="loadData">刷新</el-button>
    </div>

    <el-row :gutter="20">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>总资产</template>
          <div class="card-value">¥ {{ stats.totalAssets.toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>本月收入</template>
          <div class="card-value income">¥ {{ stats.monthlyIncome.toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>本月支出</template>
          <div class="card-value expense">¥ {{ stats.monthlyExpense.toFixed(2) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card>
          <template #header>收支趋势 (近6个月)</template>
          <div ref="trendChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>本月支出构成</template>
          <div ref="pieChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue';
import Layout from '../components/Layout.vue';
import * as echarts from 'echarts';
import { ElMessage } from 'element-plus';
import type { DashboardStats } from '../types';

const stats = reactive<DashboardStats>({
  totalAssets: 0,
  monthlyIncome: 0,
  monthlyExpense: 0,
  trend: [],
  composition: []
});

const trendChartRef = ref(null);
const pieChartRef = ref(null);
let trendChart: echarts.ECharts | null = null;
let pieChart: echarts.ECharts | null = null;

const loadData = async () => {
  try {
    const data = await window.electronAPI.invoke('dashboard:stats');
    if (data) {
      stats.totalAssets = data.totalAssets;
      stats.monthlyIncome = data.monthlyIncome;
      stats.monthlyExpense = data.monthlyExpense;
      stats.trend = data.trend;
      stats.composition = data.composition;
      
      initCharts();
    }
  } catch (error) {
    ElMessage.error('加载看板数据失败');
    console.error(error);
  }
};

const initCharts = () => {
  nextTick(() => {
    if (trendChartRef.value) {
      if (!trendChart) trendChart = echarts.init(trendChartRef.value);
      
      const months = stats.trend.map((item: any) => item.month);
      const incomes = stats.trend.map((item: any) => item.income);
      const expenses = stats.trend.map((item: any) => item.expense);

      trendChart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['收入', '支出'] },
        xAxis: { type: 'category', data: months },
        yAxis: { type: 'value' },
        series: [
          { name: '收入', type: 'line', data: incomes, smooth: true, itemStyle: { color: '#67C23A' } },
          { name: '支出', type: 'line', data: expenses, smooth: true, itemStyle: { color: '#F56C6C' } }
        ]
      });
    }

    if (pieChartRef.value) {
      if (!pieChart) pieChart = echarts.init(pieChartRef.value);
      
      pieChart.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: '0%' },
        series: [
          {
            name: '支出分类',
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 10,
              borderColor: '#fff',
              borderWidth: 2
            },
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
            labelLine: { show: false },
            data: stats.composition.map((item: any) => ({ value: item.value, name: item.name }))
          }
        ]
      });
    }
  });
};

onMounted(() => {
  loadData();
  window.addEventListener('resize', () => {
    trendChart?.resize();
    pieChart?.resize();
  });
});
</script>

<style scoped>
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.card-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}
.income { color: #67C23A; }
.expense { color: #F56C6C; }
</style>
