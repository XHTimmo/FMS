<template>
  <Layout>
    <div class="header">
      <h2>收支记账</h2>
      <el-button type="primary" @click="dialogVisible = true">新增记账</el-button>
    </div>

    <el-table :data="transactions" style="width: 100%">
      <el-table-column prop="date" label="日期" width="120" />
      <el-table-column prop="type" label="类型" width="80">
        <template #default="scope">
          <el-tag :type="scope.row.type === 'income' ? 'success' : 'danger'">
            {{ scope.row.type === 'income' ? '收入' : '支出' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="amount" label="金额" width="100">
        <template #default="scope">
          {{ scope.row.amount.toFixed(2) }}
        </template>
      </el-table-column>
      <el-table-column prop="category_name" label="分类" width="120" />
      <el-table-column prop="account_name" label="账户" width="120" />
      <el-table-column prop="description" label="描述" />
    </el-table>

    <el-dialog v-model="dialogVisible" title="新增记账" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio label="income">收入</el-radio>
            <el-radio label="expense">支出</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="form.date" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="金额">
          <el-input-number v-model="form.amount" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category_id">
            <el-option
              v-for="cat in categories.filter(c => c.type === form.type)"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="账户">
          <el-select v-model="form.account_id">
            <el-option
              v-for="acc in accounts"
              :key="acc.id"
              :label="acc.name"
              :value="acc.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveTransaction">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import Layout from '../components/Layout.vue';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import type { Transaction, Category, Account } from '../types';

const transactions = ref<Transaction[]>([]);
const categories = ref<Category[]>([]);
const accounts = ref<Account[]>([]);
const dialogVisible = ref(false);

const form = reactive({
  date: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  type: 'expense',
  amount: 0,
  category_id: null,
  account_id: null,
  description: '',
  member_id: null,
  created_by: 1 // Default admin
});

const loadData = async () => {
  try {
    const [trans, cats, accs] = await Promise.all([
      window.electronAPI.invoke('transaction:list', {}),
      window.electronAPI.invoke('category:list'),
      window.electronAPI.invoke('account:list'),
    ]);
    transactions.value = trans;
    categories.value = cats;
    accounts.value = accs;
  } catch (error) {
    ElMessage.error('加载数据失败');
  }
};

const saveTransaction = async () => {
  try {
    await window.electronAPI.invoke('transaction:create', { ...form });
    dialogVisible.value = false;
    loadData();
    ElMessage.success('保存成功');
    form.amount = 0;
    form.description = '';
  } catch (error) {
    ElMessage.error('保存失败');
  }
};

onMounted(loadData);
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>
