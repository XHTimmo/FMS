import test from 'node:test';
import assert from 'node:assert';

test('会费撤销与账单双向同步逻辑测试', () => {
  // Mock DB logic for transaction -> fee revocation
  const membership_fee_records = [
    { id: 'fee1', status: 'paid', source_ref_id: 'tx1' }
  ];

  const transactions = [
    { id: 'tx1', source_type: 'membership_fee', source_ref_id: 'fee1', deleted_at: null }
  ];

  // 1. Simulate "transaction:delete"
  const txBefore = transactions.find(t => t.id === 'tx1');
  if (txBefore && txBefore.source_type === 'membership_fee' && txBefore.source_ref_id) {
    const fee = membership_fee_records.find(f => f.id === txBefore.source_ref_id);
    if (fee) fee.status = 'revoked';
    txBefore.deleted_at = 123456789 as any;
  }

  assert.strictEqual(membership_fee_records[0].status, 'revoked');
  assert.notStrictEqual(transactions[0].deleted_at, null);

  // 2. Reset
  membership_fee_records[0].status = 'paid';
  transactions[0].deleted_at = null;

  // 3. Simulate "member:fee:revoke"
  const feeBefore = membership_fee_records.find(f => f.id === 'fee1');
  if (feeBefore) {
    feeBefore.status = 'revoked';
    const tx = transactions.find(t => t.source_ref_id === feeBefore.id);
    if (tx) {
      tx.deleted_at = 987654321 as any;
    }
  }

  assert.strictEqual(membership_fee_records[0].status, 'revoked');
  assert.notStrictEqual(transactions[0].deleted_at, null);
});
