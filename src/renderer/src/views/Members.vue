<template>
  <Layout>
    <div class="header">
      <h2>会员管理</h2>
      <el-button type="primary" @click="dialogVisible = true">新增会员</el-button>
    </div>

    <el-table :data="members" style="width: 100%">
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="contact_info" label="联系方式">
        <template #default="scope">
          {{ getContactPhone(scope.row.contact_info) }}
        </template>
      </el-table-column>
      <el-table-column prop="join_date" label="入会日期" width="120" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'active' ? 'success' : 'info'">{{ scope.row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="scope">
          <el-button size="small" @click="editMember(scope.row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteMember(scope.row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="新增/编辑会员" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="姓名">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.contact_info.phone" />
        </el-form-item>
        <el-form-item label="入会日期">
          <el-date-picker v-model="form.join_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="活跃" value="active" />
            <el-option label="暂停" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveMember">保存</el-button>
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
import type { Member } from '../types';

const members = ref<Member[]>([]);
const dialogVisible = ref(false);
const form = reactive({
  id: '',
  name: '',
  contact_info: { phone: '' },
  join_date: dayjs().format('YYYY-MM-DD'),
  status: 'active',
  notes: '',
});

const getContactPhone = (contactInfo: string) => {
  try {
    if (!contactInfo) return '-';
    const parsed = JSON.parse(contactInfo);
    return parsed?.phone || '-';
  } catch (e) {
    return '-';
  }
};

const loadMembers = async () => {
  try {
    members.value = await window.electronAPI.invoke('member:list');
  } catch (error) {
    ElMessage.error('加载会员列表失败');
  }
};

const saveMember = async () => {
  try {
    if (form.id) {
      await window.electronAPI.invoke('member:update', JSON.parse(JSON.stringify(form)));
    } else {
      await window.electronAPI.invoke('member:create', JSON.parse(JSON.stringify(form)));
    }
    dialogVisible.value = false;
    loadMembers();
    ElMessage.success('保存成功');
    resetForm();
  } catch (error) {
    ElMessage.error('保存失败');
  }
};

const editMember = (row: any) => {
  form.id = row.id;
  form.name = row.name;
  try {
    form.contact_info = JSON.parse(row.contact_info) || { phone: '' };
  } catch (e) {
    form.contact_info = { phone: '' };
  }
  form.join_date = row.join_date;
  form.status = row.status;
  form.notes = row.notes;
  dialogVisible.value = true;
};

const deleteMember = async (id: string) => {
  if (confirm('确定删除该会员吗？')) {
    await window.electronAPI.invoke('member:delete', id);
    loadMembers();
  }
};

const resetForm = () => {
  form.id = '';
  form.name = '';
  form.contact_info = { phone: '' };
  form.join_date = dayjs().format('YYYY-MM-DD');
  form.status = 'active';
  form.notes = '';
};

onMounted(loadMembers);
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>
