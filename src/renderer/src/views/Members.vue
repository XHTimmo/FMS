<template>
  <Layout>
    <div class="page-header">
      <h2>会员管理</h2>
      <div class="page-actions">
        <el-button type="success" @click="exportFeeReport">导出会费报表</el-button>
        <el-button type="primary" @click="openCreateDialog">新增会员</el-button>
      </div>
    </div>

    <el-card class="report-filter page-card">
      <el-row :gutter="12">
        <el-col :xs="24" :md="10">
          <el-date-picker
            v-model="reportRange"
            type="daterange"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
          />
        </el-col>
        <el-col :xs="24" :md="6">
          <el-select v-model="reportMemberType" style="width: 100%">
            <el-option label="全部会员类型" value="all" />
            <el-option label="标准会员" value="standard" />
            <el-option label="高级会员" value="premium" />
            <el-option label="VIP会员" value="vip" />
          </el-select>
        </el-col>
      </el-row>
    </el-card>

    <el-alert
      v-if="reminders.length > 0"
      title="有会员会费将在7天内到期，请及时续费"
      type="warning"
      show-icon
      :closable="false"
      class="reminder-alert"
    >
      <template #default>
        <div v-for="item in reminders" :key="item.member_id" class="reminder-item">
          {{ item.member_name }}：剩余 {{ item.remaining_days }} 天（到期日 {{ item.expiry_date }}）
        </div>
      </template>
    </el-alert>

    <el-table :data="members" style="width: 100%">
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="member_type" label="会员类型" width="110">
        <template #default="scope">
          {{ getMemberTypeLabel(scope.row.member_type) }}
        </template>
      </el-table-column>
      <el-table-column prop="contact_info" label="联系方式">
        <template #default="scope">
          {{ getContactPhone(scope.row.contact_info) }}
        </template>
      </el-table-column>
      <el-table-column prop="join_date" label="入会日期" width="120" />
      <el-table-column label="会费状态" width="120">
        <template #default="scope">
          <el-tag :type="getFeeStatusTag(scope.row.fee_status)">
            {{ getFeeStatusLabel(scope.row.fee_status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="有效期/到期提醒" width="220">
        <template #default="scope">
          <div v-if="scope.row.expiry_date">
            <div>到期日：{{ scope.row.expiry_date }}</div>
            <div :class="scope.row.remaining_days < 0 ? 'text-danger' : 'text-warning'">
              剩余天数：{{ scope.row.remaining_days }}
            </div>
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="累计缴费" width="140">
        <template #default="scope">¥ {{ Number(scope.row.total_paid || 0).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="scope">
          <el-tag :type="getMemberStatusTag(scope.row.status)">{{ getMemberStatusLabel(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template #default="scope">
          <div class="member-action-group">
            <el-button class="member-action-btn" type="success" @click="openFeeDialog(scope.row)">缴费</el-button>
            <el-button class="member-action-btn" @click="openHistoryDialog(scope.row)">缴费历史</el-button>
            <el-button class="member-action-btn" @click="editMember(scope.row)">编辑</el-button>
            <el-button class="member-action-btn" type="danger" @click="deleteMember(scope.row.id)">删除</el-button>
          </div>
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
            <el-option label="冻结" value="suspended" />
          </el-select>
        </el-form-item>
        <el-form-item label="会员类型">
          <el-select v-model="form.member_type">
            <el-option label="标准会员" value="standard" />
            <el-option label="高级会员" value="premium" />
            <el-option label="VIP会员" value="vip" />
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

    <el-dialog v-model="feeDialogVisible" title="记录会费缴纳" width="460px">
      <el-form :model="feeForm" label-width="90px">
        <el-form-item label="会员">
          <el-input v-model="feeForm.member_name" disabled />
        </el-form-item>
        <el-form-item label="缴费周期">
          <el-select v-model="feeForm.cycle">
            <el-option label="按月" value="month" />
            <el-option label="按季度" value="quarter" />
            <el-option label="按年" value="year" />
          </el-select>
        </el-form-item>
        <el-form-item label="缴费金额">
          <el-input-number v-model="feeForm.amount" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="缴费日期">
          <el-date-picker v-model="feeForm.payment_date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="转账凭证">
          <div class="proof-upload">
            <el-button @click="triggerFeeProofSelect">选择凭证</el-button>
            <span class="proof-name">{{ feeProofFile?.name || '未选择文件' }}</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="feeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveFeeRecord">保存缴费</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyDialogVisible" title="缴费历史" width="760px">
      <el-table :data="feeHistory">
        <el-table-column prop="payment_date" label="缴费日期" width="130" />
        <el-table-column prop="cycle" label="周期" width="100">
          <template #default="scope">{{ getCycleLabel(scope.row.cycle) }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="scope">¥ {{ Number(scope.row.amount).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="expiry_date" label="到期日期" width="130" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'paid' ? 'success' : 'warning'">
              {{ scope.row.status === 'paid' ? '已缴' : scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sync_status" label="同步状态" width="110">
          <template #default="scope">
            <el-tag :type="scope.row.sync_status === 'synced' ? 'success' : 'warning'">
              {{ scope.row.sync_status === 'synced' ? '已同步' : '待重试' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="凭证管理" width="300">
          <template #default="scope">
            <div class="proof-actions">
              <el-button link type="primary" @click="uploadHistoryProof(scope.row)">上传</el-button>
              <el-button link @click="viewHistoryProof(scope.row)">查看</el-button>
              <el-button link @click="downloadHistoryProof(scope.row)">下载</el-button>
              <el-button link type="danger" @click="deleteHistoryProof(scope.row)">删除</el-button>
              <el-button link type="warning" v-if="scope.row.status === 'paid'" @click="revokeFeePayment(scope.row)">撤销</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
    <input ref="proofInputRef" type="file" class="hidden-proof-input" accept=".jpg,.jpeg,.png,.pdf" @change="onProofFileChange" />
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import Layout from '../components/Layout.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import dayjs from 'dayjs';
import type { FeeProof, Member } from '../types';

const members = ref<Member[]>([]);
const reminders = ref<{ member_id: string; member_name: string; remaining_days: number; expiry_date: string }[]>([]);
const dialogVisible = ref(false);
const feeDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const feeHistory = ref<any[]>([]);
const proofInputRef = ref<HTMLInputElement | null>(null);
const feeProofFile = ref<File | null>(null);
const pendingProofRecordId = ref('');
const reportRange = ref<[string, string]>([
  dayjs().startOf('month').format('YYYY-MM-DD'),
  dayjs().endOf('month').format('YYYY-MM-DD')
]);
const reportMemberType = ref('all');
const form = reactive({
  id: '',
  name: '',
  contact_info: { phone: '' },
  join_date: dayjs().format('YYYY-MM-DD'),
  status: 'active',
  member_type: 'standard',
  notes: '',
});
const feeForm = reactive({
  member_id: '',
  member_name: '',
  cycle: 'month',
  amount: 0,
  payment_date: dayjs().format('YYYY-MM-DD')
});

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

const compressAndWatermarkImage = async (file: File) => {
  const reader = new FileReader();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('加载图片失败'));
    img.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  const maxWidth = 1400;
  const ratio = Math.min(1, maxWidth / image.width);
  canvas.width = Math.floor(image.width * ratio);
  canvas.height = Math.floor(image.height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('图片处理失败');
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const watermark = `财务凭证 ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.fillStyle = 'rgba(220, 60, 60, 0.18)';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(watermark, 0, 0);
  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.8);
};

const fileToDataUrl = async (file: File) => {
  const reader = new FileReader();
  return await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
};

const buildProofPayload = async (file: File) => {
  const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    throw new Error('仅支持 JPG、PNG、PDF');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('文件大小不能超过 10MB');
  }
  const base64Data = file.type === 'application/pdf'
    ? await fileToDataUrl(file)
    : await compressAndWatermarkImage(file);
  return {
    file_name: file.name,
    base64_data: base64Data,
    watermark_text: `财务凭证-${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
  };
};

const getContactPhone = (contactInfo: string) => {
  try {
    if (!contactInfo) return '-';
    const parsed = JSON.parse(contactInfo);
    return parsed?.phone || '-';
  } catch (e) {
    return '-';
  }
};

const getCycleLabel = (cycle: string) => {
  if (cycle === 'month') return '按月';
  if (cycle === 'quarter') return '按季度';
  if (cycle === 'year') return '按年';
  return cycle;
};

const getMemberTypeLabel = (memberType: string) => {
  if (memberType === 'premium') return '高级会员';
  if (memberType === 'vip') return 'VIP会员';
  return '标准会员';
};

const getFeeStatusLabel = (status: string) => {
  if (status === 'paid') return '已缴';
  if (status === 'overdue') return '逾期';
  return '待缴';
};

const getFeeStatusTag = (status: string) => {
  if (status === 'paid') return 'success';
  if (status === 'overdue') return 'danger';
  return 'warning';
};

const getMemberStatusLabel = (status: string) => {
  if (status === 'active') return '活跃';
  if (status === 'suspended') return '冻结';
  return '暂停';
};

const getMemberStatusTag = (status: string) => {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'danger';
  return 'info';
};

const loadMembers = async () => {
  try {
    members.value = await window.electronAPI.invoke('member:list');
    reminders.value = await window.electronAPI.invoke('member:fee:reminders');
  } catch (error) {
    ElMessage.error('加载会员列表失败');
  }
};

const openCreateDialog = () => {
  resetForm();
  dialogVisible.value = true;
};

const saveMember = async () => {
  try {
    if (form.id) {
      await window.electronAPI.invoke('member:update', {
        ...JSON.parse(JSON.stringify(form)),
        actor: getActor()
      });
    } else {
      await window.electronAPI.invoke('member:create', {
        ...JSON.parse(JSON.stringify(form)),
        actor: getActor()
      });
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
  form.member_type = row.member_type || 'standard';
  form.notes = row.notes;
  dialogVisible.value = true;
};

const openFeeDialog = (row: any) => {
  feeForm.member_id = row.id;
  feeForm.member_name = row.name;
  feeForm.cycle = 'month';
  feeForm.amount = Number(row.fee_amount || 0) || 0;
  feeForm.payment_date = dayjs().format('YYYY-MM-DD');
  feeProofFile.value = null;
  feeDialogVisible.value = true;
};

const triggerFeeProofSelect = () => {
  pendingProofRecordId.value = '';
  proofInputRef.value?.click();
};

const onProofFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  if (pendingProofRecordId.value) {
    uploadProofForRecord(pendingProofRecordId.value, file);
  } else {
    feeProofFile.value = file;
  }
  target.value = '';
};

const saveFeeRecord = async () => {
  try {
    if (!feeForm.member_id || feeForm.amount <= 0) {
      ElMessage.warning('请填写有效缴费信息');
      return;
    }
    const created = await window.electronAPI.invoke('member:fee:create', {
      ...JSON.parse(JSON.stringify(feeForm)),
      actor: getActor()
    });
    if (feeProofFile.value && created?.id) {
      await uploadProofForRecord(created.id, feeProofFile.value, feeForm.member_id);
    }
    feeProofFile.value = null;
    feeDialogVisible.value = false;
    await loadMembers();
    ElMessage.success('缴费记录保存成功');
  } catch (error) {
    ElMessage.error((error as Error).message || '保存缴费失败');
  }
};

const openHistoryDialog = async (row: any) => {
  try {
    feeHistory.value = await window.electronAPI.invoke('member:fee:history', row.id);
    historyDialogVisible.value = true;
  } catch (error) {
    ElMessage.error('加载缴费历史失败');
  }
};

const uploadHistoryProof = (row: any) => {
  pendingProofRecordId.value = row.id;
  proofInputRef.value?.click();
};

const uploadProofForRecord = async (feeRecordId: string, file: File, memberId?: string) => {
  const payload = await buildProofPayload(file);
  await window.electronAPI.invoke('member:fee:proof:upload', {
    fee_record_id: feeRecordId,
    member_id: memberId || feeForm.member_id,
    ...payload,
    actor: getActor()
  });
  if (historyDialogVisible.value) {
    const currentMemberId = feeHistory.value[0]?.member_id;
    if (currentMemberId) {
      feeHistory.value = await window.electronAPI.invoke('member:fee:history', currentMemberId);
    }
  }
  ElMessage.success('凭证上传成功');
};

const getProofList = async (feeRecordId: string) => {
  return await window.electronAPI.invoke('member:fee:proof:list', feeRecordId) as FeeProof[];
};

const viewHistoryProof = async (row: any) => {
  try {
    const proofs = await getProofList(row.id);
    if (!proofs.length) {
      ElMessage.warning('暂无凭证');
      return;
    }
    const detail = await window.electronAPI.invoke('member:fee:proof:download', proofs[0].id);
    window.open(detail.base64_data, '_blank');
  } catch (error) {
    ElMessage.error((error as Error).message || '查看凭证失败');
  }
};

const downloadHistoryProof = async (row: any) => {
  try {
    const proofs = await getProofList(row.id);
    if (!proofs.length) {
      ElMessage.warning('暂无凭证');
      return;
    }
    const detail = await window.electronAPI.invoke('member:fee:proof:download', proofs[0].id);
    const link = document.createElement('a');
    link.href = detail.base64_data;
    link.download = detail.file_name;
    link.click();
  } catch (error) {
    ElMessage.error((error as Error).message || '下载凭证失败');
  }
};

const deleteHistoryProof = async (row: any) => {
  try {
    const proofs = await getProofList(row.id);
    if (!proofs.length) {
      ElMessage.warning('暂无凭证');
      return;
    }
    await ElMessageBox.confirm('确认删除该缴费记录的最新凭证吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    });
    await window.electronAPI.invoke('member:fee:proof:delete', {
      file_id: proofs[0].id,
      actor: getActor()
    });
    ElMessage.success('凭证已删除');
  } catch (error) {
    if (error === 'cancel') return;
    ElMessage.error((error as Error).message || '删除凭证失败');
  }
};

const revokeFeePayment = async (row: any) => {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入撤销原因：', '撤销缴费', {
      confirmButtonText: '确认撤销',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '撤销原因不能为空',
      type: 'warning'
    });
    
    await window.electronAPI.invoke('member:fee:revoke', {
      id: row.id,
      reason,
      actor: getActor()
    });
    
    ElMessage.success('撤销成功');
    
    // Refresh history if history dialog is open
    if (historyDialogVisible.value && row.member_id) {
      feeHistory.value = await window.electronAPI.invoke('member:fee:history', row.member_id);
    }
    
    // Refresh members list
    await loadMembers();
  } catch (error: any) {
    if (error === 'cancel') return;
    ElMessage.error(error.message || '撤销缴费失败');
  }
};

const exportFeeReport = async () => {
  try {
    const [startDate, endDate] = reportRange.value;
    if (!startDate || !endDate) {
      ElMessage.warning('请选择导出时间范围');
      return;
    }
    const result = await window.electronAPI.invoke('member:fee:report:export', {
      startDate,
      endDate,
      memberType: reportMemberType.value
    });
    if (result?.success) {
      ElMessage.success(`导出成功，共 ${result.count} 条`);
    }
  } catch (error) {
    ElMessage.error('导出失败');
  }
};

const deleteMember = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定删除该会员吗？', '删除确认', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    });
    await window.electronAPI.invoke('member:delete', {
      id,
      actor: getActor()
    });
    ElMessage.success('删除成功');
    loadMembers();
  } catch (error: any) {
    if (error === 'cancel') return;
    ElMessage.error(error.message || '删除会员失败');
  }
};

const resetForm = () => {
  form.id = '';
  form.name = '';
  form.contact_info = { phone: '' };
  form.join_date = dayjs().format('YYYY-MM-DD');
  form.status = 'active';
  form.member_type = 'standard';
  form.notes = '';
};

onMounted(loadMembers);
</script>

<style scoped>
.report-filter {
  margin-bottom: var(--space-md);
}
.reminder-alert {
  margin-bottom: var(--space-md);
}
.reminder-item {
  line-height: 1.8;
}
.text-warning {
  color: #e6a23c;
}
.text-danger {
  color: #f56c6c;
}
.member-action-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.proof-upload {
  display: flex;
  align-items: center;
  gap: 10px;
}
.proof-name {
  color: #606266;
  font-size: 13px;
}
.proof-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.hidden-proof-input {
  display: none;
}
.member-action-btn {
  width: 96px;
  height: 38px;
  margin: 0;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s ease;
}
.member-action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(31, 42, 61, 0.14);
}
@media (max-width: 1366px) {
  .member-action-btn {
    width: 88px;
    height: 36px;
  }
}
</style>
