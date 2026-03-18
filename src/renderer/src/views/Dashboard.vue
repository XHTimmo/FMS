<template>
  <Layout v-loading="loading">
    <div id="export-full">
      <div class="page-header">
      <h2>数据看板</h2>
      <div class="page-actions">
        <el-button @click="applyQuickRange('month')">本月</el-button>
        <el-button @click="applyQuickRange('quarter')">本季度</el-button>
        <el-button @click="applyQuickRange('year')">本年</el-button>
        <el-dropdown @command="exportReport">
          <el-button type="success" :loading="exporting">导出报告</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="pdf">导出 PDF</el-dropdown-item>
              <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
              <el-dropdown-item command="png">导出 PNG (高清配置)</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="primary" @click="loadData">刷新</el-button>
      </div>
    </div>

    <el-card class="filter-card page-card">
      <el-row :gutter="12" class="filter-row">
        <el-col :xs="24" :sm="24" :md="10" :lg="8">
          <div class="period-button-group">
            <el-button
              v-for="item in periodOptions"
              :key="item.value"
              class="period-button"
              :class="{ active: query.periodType === item.value }"
              @click="setPeriodType(item.value)"
            >
              {{ item.label }}
            </el-button>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="4" :lg="3">
          <el-select v-model="query.year" :disabled="query.periodType === 'custom'" @change="loadData">
            <el-option v-for="year in years" :key="year" :label="`${year}年`" :value="year" />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="12" :md="4" :lg="3" v-if="query.periodType === 'quarter'">
          <el-select v-model="query.quarter" @change="loadData">
            <el-option v-for="q in [1,2,3,4]" :key="q" :label="`第${q}季度`" :value="q" />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="12" :md="4" :lg="3" v-if="query.periodType === 'month'">
          <el-select v-model="query.month" @change="loadData">
            <el-option v-for="m in 12" :key="m" :label="`${m}月`" :value="m" />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="24" :md="9" :lg="7" v-if="query.periodType === 'custom'">
          <el-date-picker
            v-model="customRange"
            type="daterange"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            @change="handleCustomRangeChange"
          />
        </el-col>
      </el-row>
    </el-card>

    <div id="export-core">
      <el-row :gutter="16" class="dashboard-grid">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover">
          <template #header>总资产</template>
          <div class="card-value">¥ {{ stats.totalAssets.toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover">
          <template #header>收入合计</template>
          <div class="card-value income">¥ {{ stats.totalIncome.toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover">
          <template #header>支出合计</template>
          <div class="card-value expense">¥ {{ stats.totalExpense.toFixed(2) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover">
          <template #header>净收支</template>
          <div class="card-value" :class="stats.netIncome >= 0 ? 'income' : 'expense'">¥ {{ stats.netIncome.toFixed(2) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="dashboard-grid" v-if="loaded">
      <el-col :xs="24" :lg="14">
        <el-card>
          <template #header>收支趋势</template>
          <div ref="trendChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="10">
        <el-card>
          <template #header>收入支出对比</template>
          <div ref="compareChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="dashboard-grid" v-if="loaded">
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>收入构成</template>
          <div ref="incomePieChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>支出构成</template>
          <div ref="expensePieChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="dashboard-grid" v-if="loaded">
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>收入项目明细</template>
          <el-table :data="stats.incomeItems" size="small">
            <el-table-column prop="category" label="项目" min-width="140" />
            <el-table-column prop="count" label="笔数" width="90" />
            <el-table-column prop="amount" label="金额" width="130">
              <template #default="scope">¥ {{ Number(scope.row.amount).toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>支出项目明细</template>
          <el-table :data="stats.expenseItems" size="small">
            <el-table-column prop="category" label="项目" min-width="140" />
            <el-table-column prop="count" label="笔数" width="90" />
            <el-table-column prop="amount" label="金额" width="130">
              <template #default="scope">¥ {{ Number(scope.row.amount).toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
    </div>

    <div id="export-table">
    <el-card class="dashboard-grid page-card" v-if="loaded">
      <template #header>收支明细（当前筛选）</template>
      <el-table :data="pagedDetails" size="small">
        <el-table-column prop="date" label="日期" width="160" />
        <el-table-column prop="type" label="类型" width="90">
          <template #default="scope">
            <el-tag :type="scope.row.type === 'income' ? 'success' : 'danger'">{{ scope.row.type === 'income' ? '收入' : '支出' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category_name" label="分类" width="130" />
        <el-table-column prop="amount" label="金额" width="130">
          <template #default="scope">¥ {{ Number(scope.row.amount).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="220" />
      </el-table>
      <div class="pager">
        <el-pagination
          layout="prev, pager, next"
          :total="stats.details.length"
          :page-size="pageSize"
          v-model:current-page="currentPage"
        />
      </div>
    </el-card>

    <el-empty v-if="!loading && loaded && stats.details.length === 0" description="当前筛选暂无数据" />
    </div>
    </div>

    <el-dialog v-model="exporting" title="导出中" width="400px" :close-on-click-modal="false" :show-close="false">
      <el-progress :percentage="exportProgress" />
    </el-dialog>

    <el-dialog v-model="pngConfigVisible" title="导出 PNG 设置" width="400px" :close-on-click-modal="false">
      <el-form label-width="100px">
        <el-form-item label="导出区域">
          <el-select v-model="pngConfig.area" style="width: 100%">
            <el-option label="全局看板 (包含顶部)" value="full" />
            <el-option label="核心数据 (图表与概览)" value="core" />
            <el-option label="仅明细表格" value="table" />
          </el-select>
        </el-form-item>
        <el-form-item label="图片分辨率">
          <el-select v-model="pngConfig.scale" style="width: 100%">
            <el-option label="标清 (1x)" :value="1" />
            <el-option label="高清 (2x)" :value="2" />
            <el-option label="超清 (3x)" :value="3" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="pngConfigVisible = false">取消</el-button>
          <el-button type="primary" @click="doExportPng" :loading="exporting">开始导出</el-button>
        </span>
      </template>
    </el-dialog>

  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import dayjs from 'dayjs';
import Layout from '../components/Layout.vue';
import * as echarts from 'echarts';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { DashboardStats } from '../types';
import { useRouter } from 'vue-router';
import html2canvas from 'html2canvas';

const router = useRouter();
const years = Array.from({ length: 7 }).map((_, i) => dayjs().year() - 5 + i);
const pageSize = 10;
const currentPage = ref(1);
const loading = ref(false);
const loaded = ref(false);
const exporting = ref(false);
const exportProgress = ref(0);
const pngConfigVisible = ref(false);
const pngConfig = reactive({
  area: 'full',
  scale: 2
});
let exportTimer: number | null = null;

const query = reactive({
  periodType: 'month' as 'year' | 'quarter' | 'month' | 'custom',
  year: dayjs().year(),
  quarter: Math.ceil((dayjs().month() + 1) / 3),
  month: dayjs().month() + 1,
  startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
  endDate: dayjs().endOf('month').format('YYYY-MM-DD')
});
const customRange = ref<[string, string]>([
  dayjs().startOf('month').format('YYYY-MM-DD'),
  dayjs().endOf('month').format('YYYY-MM-DD')
]);
const periodOptions: Array<{ label: string; value: 'year' | 'quarter' | 'month' | 'custom' }> = [
  { label: '按年', value: 'year' },
  { label: '按季度', value: 'quarter' },
  { label: '按月', value: 'month' },
  { label: '自定义', value: 'custom' }
];

const stats = reactive<DashboardStats>({
  totalAssets: 0,
  periodType: 'month',
  startTime: '',
  endTime: '',
  totalIncome: 0,
  totalExpense: 0,
  netIncome: 0,
  trend: [],
  incomeComposition: [],
  expenseComposition: [],
  incomeItems: [],
  expenseItems: [],
  details: []
});

const trendChartRef = ref<HTMLDivElement | null>(null);
const compareChartRef = ref<HTMLDivElement | null>(null);
const incomePieChartRef = ref<HTMLDivElement | null>(null);
const expensePieChartRef = ref<HTMLDivElement | null>(null);
let trendChart: echarts.ECharts | null = null;
let compareChart: echarts.ECharts | null = null;
let incomePieChart: echarts.ECharts | null = null;
let expensePieChart: echarts.ECharts | null = null;

const pagedDetails = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return stats.details.slice(start, start + pageSize);
});

const loadData = async () => {
  if (!localStorage.getItem('auth_token')) {
    ElMessage.error('登录状态已失效，请重新登录');
    router.push('/login');
    return;
  }
  loading.value = true;
  try {
    const payload = {
      periodType: query.periodType,
      year: query.year,
      quarter: query.quarter,
      month: query.month,
      startDate: query.startDate,
      endDate: query.endDate
    };
    const data = await window.electronAPI.invoke('dashboard:stats', payload);
    if (data) {
      stats.totalAssets = data.totalAssets;
      stats.periodType = data.periodType;
      stats.startTime = data.startTime;
      stats.endTime = data.endTime;
      stats.totalIncome = data.totalIncome;
      stats.totalExpense = data.totalExpense;
      stats.netIncome = data.netIncome;
      stats.trend = data.trend;
      stats.incomeComposition = data.incomeComposition;
      stats.expenseComposition = data.expenseComposition;
      stats.incomeItems = data.incomeItems;
      stats.expenseItems = data.expenseItems;
      stats.details = data.details;
      currentPage.value = 1;
      loaded.value = true;
      initCharts();
    }
  } catch (error) {
    ElMessage.error('加载看板数据失败');
  } finally {
    loading.value = false;
  }
};

const applyQuickRange = (type: 'year' | 'quarter' | 'month') => {
  query.periodType = type;
  query.year = dayjs().year();
  query.quarter = Math.ceil((dayjs().month() + 1) / 3);
  query.month = dayjs().month() + 1;
  loadData();
};

const setPeriodType = (type: 'year' | 'quarter' | 'month' | 'custom') => {
  query.periodType = type;
  loadData();
};

const handleCustomRangeChange = (value: [string, string]) => {
  if (!value || value.length !== 2) return;
  query.startDate = value[0];
  query.endDate = value[1];
  loadData();
};

const getChartImages = () => {
  return {
    trend: trendChart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' }),
    compare: compareChart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' }),
    incomePie: incomePieChart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' }),
    expensePie: expensePieChart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })
  };
};

const exportReport = async (format: 'png' | 'pdf' | 'excel') => {
  if (format === 'png') {
    pngConfigVisible.value = true;
    return;
  }

  exporting.value = true;
  exportProgress.value = 10;
  
  if (exportTimer) {
    window.clearInterval(exportTimer);
  }
  
  // Progress simulation
  exportTimer = window.setInterval(() => {
    if (exportProgress.value < 85) {
      exportProgress.value += 5;
    }
  }, 200);

  try {
    const chartImages = getChartImages();
    const payload = {
      format,
      query,
      chartImages,
      stats: {
        totalAssets: stats.totalAssets,
        totalIncome: stats.totalIncome,
        totalExpense: stats.totalExpense,
        netIncome: stats.netIncome,
        incomeItems: stats.incomeItems,
        expenseItems: stats.expenseItems,
      }
    };

    const result = await window.electronAPI.invoke('dashboard:export-report', payload);
    
    if (result?.success) {
      exportProgress.value = 100;
      ElMessage.success(`导出成功：${result.filePath}`);
    } else if (!result?.canceled) {
      ElMessage.error(result?.error || '导出失败');
      // Retry mechanism for specific errors
      if (result?.retryable) {
        ElMessageBox.confirm('导出失败，是否重试？', '提示', {
          confirmButtonText: '重试',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(() => {
          exportReport(format);
        }).catch(() => {});
      }
    }
  } catch (error) {
    ElMessage.error('导出请求失败，请检查网络或重试');
  } finally {
    if (exportTimer) {
      window.clearInterval(exportTimer);
      exportTimer = null;
    }
    setTimeout(() => {
      exporting.value = false;
      exportProgress.value = 0;
    }, 500);
  }
};

const doExportPng = async () => {
  pngConfigVisible.value = false;
  exporting.value = true;
  exportProgress.value = 10;
  if (exportTimer) window.clearInterval(exportTimer);
  exportTimer = window.setInterval(() => {
    if (exportProgress.value < 85) exportProgress.value += 5;
  }, 200);

  try {
    const targetId = pngConfig.area === 'core' ? 'export-core' 
      : pngConfig.area === 'table' ? 'export-table' 
      : 'export-full';

    const element = document.getElementById(targetId);
    if (!element) throw new Error('找不到导出区域');

    // 修复 html2canvas 在 flex/grid 布局下的截断与背景色分离问题
    // 强制设定一个固定宽度，并使其脱离滚动条的限制
    const originalWidth = element.style.width;
    const originalPosition = element.style.position;
    const originalBackgroundColor = element.style.backgroundColor;
    
    // 获取实际内容的完整宽度
    const scrollWidth = Math.max(element.scrollWidth, 1200); 
    
    element.style.width = `${scrollWidth}px`;
    // 设置底色以保留卡片间隙的视觉效果，防止背景色被错误截断
    element.style.backgroundColor = 'var(--ui-bg, #f5f7fa)'; 
    element.style.padding = '20px'; // 增加一点内边距让导出图更美观

    // 确保图表重新调整大小以适应新的固定宽度（避免图表被拉伸或压缩）
    handleResize();
    // 等待图表重新渲染完成
    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await html2canvas(element, {
      scale: pngConfig.scale,
      useCORS: true,
      backgroundColor: '#f5f7fa',
      logging: false,
      width: scrollWidth + 40, // 包含 padding
      windowWidth: scrollWidth + 40,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(targetId);
        if (clonedElement) {
          clonedElement.style.width = `${scrollWidth}px`;
          // 移除可能会导致偏移的外边距
          clonedElement.style.margin = '0';
        }
      }
    });

    // 恢复原始样式
    element.style.width = originalWidth;
    element.style.position = originalPosition;
    element.style.backgroundColor = originalBackgroundColor;
    element.style.padding = '';
    handleResize();

    const base64Data = canvas.toDataURL('image/png');
    
    const result = await window.electronAPI.invoke('dashboard:save-base64-image', {
      base64Data,
      format: 'png'
    });

    if (result?.success) {
      exportProgress.value = 100;
      ElMessage.success(`导出成功：${result.filePath}`);
    } else if (!result?.canceled) {
      ElMessage.error(result?.error || '导出失败');
    }
  } catch (error) {
    console.error('PNG Export Error:', error);
    ElMessage.error('生成图片失败，请重试');
  } finally {
    if (exportTimer) {
      window.clearInterval(exportTimer);
      exportTimer = null;
    }
    setTimeout(() => {
      exporting.value = false;
      exportProgress.value = 0;
    }, 500);
  }
};

const initCharts = () => {
  nextTick(() => {
    if (trendChartRef.value) {
      if (!trendChart) trendChart = echarts.init(trendChartRef.value);
      
      const labels = stats.trend.map(item => item.label);
      const incomes = stats.trend.map(item => item.income);
      const expenses = stats.trend.map(item => item.expense);

      trendChart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['收入', '支出'] },
        xAxis: { type: 'category', data: labels },
        yAxis: { type: 'value' },
        series: [
          { name: '收入', type: 'line', data: incomes, smooth: true, itemStyle: { color: '#67C23A' } },
          { name: '支出', type: 'line', data: expenses, smooth: true, itemStyle: { color: '#F56C6C' } }
        ]
      });
    }

    if (compareChartRef.value) {
      if (!compareChart) compareChart = echarts.init(compareChartRef.value);
      compareChart.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: ['收入', '支出']
        },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'bar',
            data: [
              { value: stats.totalIncome, itemStyle: { color: '#67C23A' } },
              { value: stats.totalExpense, itemStyle: { color: '#F56C6C' } }
            ]
          }
        ]
      });
    }

    if (incomePieChartRef.value) {
      if (!incomePieChart) incomePieChart = echarts.init(incomePieChartRef.value);
      incomePieChart.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: '0%' },
        series: [
          {
            name: '收入分类',
            type: 'pie',
            radius: ['40%', '70%'],
            itemStyle: {
              borderRadius: 10,
              borderColor: '#fff',
              borderWidth: 2
            },
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
            labelLine: { show: false },
            data: stats.incomeComposition.map(item => ({ value: item.value, name: item.name }))
          }
        ]
      });
    }

    if (expensePieChartRef.value) {
      if (!expensePieChart) expensePieChart = echarts.init(expensePieChartRef.value);
      expensePieChart.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: '0%' },
        series: [
          {
            name: '支出分类',
            type: 'pie',
            radius: ['40%', '70%'],
            itemStyle: {
              borderRadius: 10,
              borderColor: '#fff',
              borderWidth: 2
            },
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
            labelLine: { show: false },
            data: stats.expenseComposition.map(item => ({ value: item.value, name: item.name }))
          }
        ]
      });
    }
  });
};

const handleResize = () => {
  trendChart?.resize();
  compareChart?.resize();
  incomePieChart?.resize();
  expensePieChart?.resize();
};

onMounted(() => {
  loadData();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  trendChart?.dispose();
  compareChart?.dispose();
  incomePieChart?.dispose();
  expensePieChart?.dispose();
});
</script>

<style scoped>
.filter-card {
  margin-bottom: var(--space-xs);
}
.filter-row {
  align-items: center;
}
.period-button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.period-button {
  min-width: 98px;
  height: 42px;
  margin: 0;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 600;
  color: #4a5568;
  border-color: #dbe3ef;
  background: #fff;
  transition: all 0.2s ease;
}
.period-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(58, 122, 254, 0.18);
  border-color: #bcd0ff;
}
.period-button.active {
  color: #fff;
  background: var(--ui-brand);
  border-color: var(--ui-brand);
}
.dashboard-grid {
  margin-top: var(--space-lg);
}
.card-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}
.income { color: #67C23A; }
.expense { color: #F56C6C; }
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
@media (max-width: 768px) {
  .period-button {
    min-width: 92px;
    height: 40px;
    font-size: 16px;
  }
}
</style>
