<template>
  <Layout>
    <div class="page-header">
      <h2>收支记账</h2>
      <el-button type="primary" @click="openCreateDialog">新增记账</el-button>
    </div>

    <el-table :data="transactions" style="width: 100%" class="page-card">
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
      <el-table-column prop="member_name" label="关联会员" width="140" />
      <el-table-column prop="description" label="描述" />
      <el-table-column label="凭证" width="90">
        <template #default="scope">
          <el-button type="info" link @click="openProofDialog(scope.row)">
            {{ scope.row.proof_count || 0 }}个
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="scope">
          <div class="table-actions">
            <el-button type="primary" link @click="openEditDialog(scope.row)">编辑</el-button>
            <el-button type="danger" link @click="deleteTransaction(scope.row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑记账' : '新增记账'" width="500px">
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
          <el-button type="primary" @click="saveTransaction">{{ editingId ? '更新' : '保存' }}</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="proofDialogVisible" title="关联凭证" width="420px">
      <el-empty v-if="proofList.length === 0" description="暂无凭证" />
      <el-table v-else :data="proofList" style="width: 100%">
        <el-table-column prop="file_name" label="文件名" />
        <el-table-column prop="file_type" label="类型" width="120" />
      </el-table>
    </el-dialog>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import Layout from '../components/Layout.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import type { Transaction, Category, Account, FeeProof } from '../types';

const transactions = ref<Transaction[]>([]);
const categories = ref<Category[]>([]);
const accounts = ref<Account[]>([]);
const dialogVisible = ref(false);
const proofDialogVisible = ref(false);
const proofList = ref<FeeProof[]>([]);
const editingId = ref('');

const getActor = () => {
  const authUser = localStorage.getItem('auth_user');
  if (!authUser) {
    return { id: 1, name: 'admin', role: 'admin', ip: '127.0.0.1' };
  }
  try {
    const parsed = JSON.parse(authUser);
    return {
      id: parsed.id || 1,
      name: parsed.name || 'admin',
      role: parsed.role || 'admin',
      ip: parsed.ip || '127.0.0.1'
    };
  } catch {
    return { id: 1, name: 'admin', role: 'admin', ip: '127.0.0.1' };
  }
};

const form = reactive({
  date: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  type: 'expense' as 'income' | 'expense',
  amount: 0,
  category_id: null as number | null,
  account_id: null as number | null,
  description: '',
  member_id: null as string | null
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
    if (!form.amount || form.amount <= 0 || !form.category_id || !form.account_id) {
      ElMessage.warning('请完整填写账单信息');
      return;
    }
    const payload = { ...form, actor: getActor() };
    if (editingId.value) {
      await window.electronAPI.invoke('transaction:update', {
        id: editingId.value,
        patch: payload,
        actor: getActor()
      });
    } else {
      await window.electronAPI.invoke('transaction:create', payload);
    }
    dialogVisible.value = false;
    await loadData();
    ElMessage.success(editingId.value ? '更新成功' : '保存成功');
    resetForm();
  } catch (error) {
    ElMessage.error((error as Error).message || '保存失败');
  }
};

const openCreateDialog = () => {
  editingId.value = '';
  resetForm();
  dialogVisible.value = true;
};

const openEditDialog = (row: Transaction) => {
  editingId.value = row.id;
  form.date = row.date;
  form.type = row.type as 'income' | 'expense';
  form.amount = Number(row.amount);
  form.category_id = row.category_id;
  form.account_id = row.account_id;
  form.description = row.description || '';
  form.member_id = row.member_id || null;
  dialogVisible.value = true;
};

const deleteTransaction = async (row: Transaction) => {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.date} 的这条账单吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    });
    await window.electronAPI.invoke('transaction:delete', { id: row.id, actor: getActor() });
    await loadData();
    ElMessage.success('删除成功');
  } catch (error) {
    if (error === 'cancel') return;
    ElMessage.error((error as Error).message || '删除失败');
  }
};

const openProofDialog = async (row: Transaction) => {
  try {
    proofList.value = await window.electronAPI.invoke('transaction:proof:list', row.id);
    proofDialogVisible.value = true;
  } catch {
    ElMessage.error('加载凭证失败');
  }
};

const resetForm = () => {
  form.date = dayjs().format('YYYY-MM-DD HH:mm:ss');
  form.type = 'expense';
  form.amount = 0;
  form.category_id = null;
  form.account_id = null;
  form.description = '';
  form.member_id = null;
};

onMounted(loadData);
</script>

<style scoped>
.table-actions {
  display: flex;
  gap: 8px;
}
</style>
