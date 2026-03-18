import test from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';
import { buildFeeReportCsv, getExpiryDate, getFeeStatus } from '../../src/main/ipc/membership-fee-utils';

test('按月周期应正确计算到期日期', () => {
  const result = getExpiryDate('2026-03-01', 'month');
  assert.equal(result, '2026-04-01');
});

test('按季度周期应正确计算到期日期', () => {
  const result = getExpiryDate('2026-03-15', 'quarter');
  assert.equal(result, '2026-06-15');
});

test('按年周期应正确计算到期日期', () => {
  const result = getExpiryDate('2026-03-20', 'year');
  assert.equal(result, '2027-03-20');
});

test('到期前7天内应返回提醒状态', () => {
  const now = dayjs('2026-03-01');
  const state = getFeeStatus('2026-03-05', now);
  assert.equal(state.status, 'paid');
  assert.equal(state.dueReminder, true);
  assert.equal(state.remainingDays, 4);
});

test('过期状态应返回逾期', () => {
  const now = dayjs('2026-03-10');
  const state = getFeeStatus('2026-03-05', now);
  assert.equal(state.status, 'overdue');
  assert.equal(state.dueReminder, false);
});

test('报表CSV应输出标题和数据行', () => {
  const csv = buildFeeReportCsv([
    {
      member_name: '张三',
      member_type: 'vip',
      cycle: 'year',
      amount: 1200,
      payment_date: '2026-01-01',
      expiry_date: '2027-01-01',
      status: 'paid'
    }
  ]);
  assert.equal(csv.split('\n').length, 2);
  assert.ok(csv.includes('张三,vip,year,1200.00,2026-01-01,2027-01-01,paid'));
});
