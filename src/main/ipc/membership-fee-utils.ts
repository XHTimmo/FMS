import dayjs from 'dayjs';

export type FeeCycle = 'month' | 'quarter' | 'year';
export type FeeStatus = 'paid' | 'pending' | 'overdue';

export function getExpiryDate(paymentDate: string, cycle: FeeCycle) {
  const base = dayjs(paymentDate).endOf('day');
  if (cycle === 'year') {
    return base.add(1, 'year').format('YYYY-MM-DD');
  }
  if (cycle === 'quarter') {
    return base.add(3, 'month').format('YYYY-MM-DD');
  }
  return base.add(1, 'month').format('YYYY-MM-DD');
}

export function getFeeStatus(expiryDate: string | null, now = dayjs()) {
  if (!expiryDate) {
    return { status: 'pending' as FeeStatus, remainingDays: 0, dueReminder: false };
  }
  const diff = dayjs(expiryDate).endOf('day').diff(now.startOf('day'), 'day');
  if (diff < 0) {
    return { status: 'overdue' as FeeStatus, remainingDays: diff, dueReminder: false };
  }
  return { status: 'paid' as FeeStatus, remainingDays: diff, dueReminder: diff <= 7 };
}

export function buildFeeReportCsv(rows: Array<{
  member_name: string;
  member_type: string;
  cycle: string;
  amount: number;
  payment_date: string;
  expiry_date: string;
  status: string;
}>) {
  return [
    '会员姓名,会员类型,缴费周期,缴费金额,缴费日期,到期日期,缴费状态',
    ...rows.map(row => {
      return [
        row.member_name,
        row.member_type,
        row.cycle,
        Number(row.amount).toFixed(2),
        row.payment_date,
        row.expiry_date,
        row.status
      ].join(',');
    })
  ].join('\n');
}
