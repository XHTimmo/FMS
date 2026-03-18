import test from 'node:test';
import assert from 'node:assert/strict';
import dayjs from 'dayjs';
import { getExpiryDate, getFeeStatus } from '../../src/main/ipc/membership-fee-utils';

test('会费流转集成：缴费后状态应为已缴，逾期后应冻结', () => {
  const member = {
    id: 'm1',
    status: 'active',
    auto_frozen: 0
  };

  const expiryDate = getExpiryDate('2026-03-01', 'month');

  const paidState = getFeeStatus(expiryDate, dayjs('2026-03-10'));
  assert.equal(paidState.status, 'paid');

  const overdueState = getFeeStatus(expiryDate, dayjs('2026-04-05'));
  if (overdueState.status === 'overdue') {
    member.status = 'suspended';
    member.auto_frozen = 1;
  }
  assert.equal(member.status, 'suspended');
  assert.equal(member.auto_frozen, 1);
});
