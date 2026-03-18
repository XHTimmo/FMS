import { app, dialog, ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database';
import dayjs from 'dayjs';
import { extname, join } from 'path';
import fs from 'fs-extra';
import { createHash } from 'crypto';
import { buildFeeReportCsv, FeeCycle, getExpiryDate, getFeeStatus } from './membership-fee-utils';
import { assertRole, resolveActor, writeAuditLog } from './security';

const allowedProofMime = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const proofDir = join(app.getPath('userData'), 'secure_receipts');
const normalizeDateTime = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value || '') ? `${value} 00:00:00` : value);

function decodeBase64File(dataUrl: string) {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl || '');
  if (!match) {
    throw new Error('凭证文件格式不正确');
  }
  const mimeType = match[1];
  if (!allowedProofMime.has(mimeType)) {
    throw new Error('仅支持 JPG、PNG、PDF 凭证');
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    throw new Error('凭证文件为空');
  }
  return { mimeType, buffer };
}

function getSafeExt(fileName: string, mimeType: string) {
  const rawExt = (extname(fileName || '').toLowerCase() || '').replace('.', '');
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'application/pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'pdf'].includes(rawExt)) return rawExt === 'jpeg' ? 'jpg' : rawExt;
  return 'bin';
}

function enqueueSyncRetry(refId: string, payload: unknown, errorMessage: string) {
  const db = getDB();
  db.prepare(`
    INSERT INTO sync_retry_queue (id, queue_type, ref_id, payload, retry_count, last_error, next_retry_at, status)
    VALUES (?, 'member_fee_sync', ?, ?, 1, ?, strftime('%s', 'now') + 300, 'pending')
  `).run(uuidv4(), refId, JSON.stringify(payload), errorMessage);
}

function processSyncRetryQueue() {
  const db = getDB();
  const pending = db.prepare(`
    SELECT id, ref_id, payload, retry_count
    FROM sync_retry_queue
    WHERE queue_type = 'member_fee_sync'
      AND status = 'pending'
      AND next_retry_at <= strftime('%s', 'now')
    ORDER BY created_at ASC
    LIMIT 20
  `).all() as { id: string; ref_id: string; payload: string; retry_count: number }[];
  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload);
      const fee = db.prepare(`
        SELECT id, member_id, cycle, amount, payment_date, transaction_id
        FROM membership_fee_records
        WHERE id = ?
      `).get(item.ref_id) as {
        id: string;
        member_id: string;
        cycle: FeeCycle;
        amount: number;
        payment_date: string;
        transaction_id?: string;
      } | undefined;
      if (!fee) {
        db.prepare(`UPDATE sync_retry_queue SET status = 'failed', updated_at = strftime('%s', 'now') WHERE id = ?`).run(item.id);
        continue;
      }
      if (!fee.transaction_id) {
        const category = db.prepare(`SELECT id FROM categories WHERE type = 'income' AND name = '会员费' LIMIT 1`).get() as { id: number } | undefined;
        const account = db.prepare(`SELECT id FROM accounts ORDER BY id LIMIT 1`).get() as { id: number } | undefined;
        const member = db.prepare(`SELECT name FROM members WHERE id = ?`).get(fee.member_id) as { name: string } | undefined;
        if (!category || !account || !member) {
          throw new Error('补偿同步失败：缺少分类、账户或会员');
        }
        const transactionId = uuidv4();
        db.prepare(`
          INSERT INTO transactions (
            id, date, type, amount, account_id, category_id, description, member_id, created_by,
            source_type, source_ref_id, version, updated_at
          )
          VALUES (?, ?, 'income', ?, ?, ?, ?, ?, 0, 'membership_fee_retry', ?, 1, strftime('%s', 'now'))
        `).run(
          transactionId,
          normalizeDateTime(fee.payment_date),
          Number(fee.amount),
          account.id,
          category.id,
          `会员缴费补偿同步-${member.name}-${fee.cycle}`,
          fee.member_id,
          fee.id
        );
        db.prepare(`
          UPDATE accounts
          SET balance = balance + ?
          WHERE id = ?
        `).run(Number(fee.amount), account.id);
        db.prepare(`
          UPDATE membership_fee_records
          SET transaction_id = ?
          WHERE id = ?
        `).run(transactionId, fee.id);
      }
      db.prepare(`
        UPDATE membership_fee_records
        SET sync_status = 'synced', retry_count = retry_count + 1
        WHERE id = ?
      `).run(item.ref_id);
      db.prepare(`UPDATE sync_retry_queue SET status = 'done', updated_at = strftime('%s', 'now') WHERE id = ?`).run(item.id);
      void payload;
    } catch (error: unknown) {
      const err = error as Error;
      const nextRetry = item.retry_count >= 5 ? null : Math.floor(Date.now() / 1000) + item.retry_count * 600;
      db.prepare(`
        UPDATE sync_retry_queue
        SET retry_count = retry_count + 1,
            last_error = ?,
            next_retry_at = ?,
            status = ?
        WHERE id = ?
      `).run(err.message, nextRetry, nextRetry ? 'pending' : 'failed', item.id);
    }
  }
}

function syncMemberPrivileges() {
  const db = getDB();
  const members = db.prepare('SELECT id, status, auto_frozen FROM members').all() as { id: string; status: string; auto_frozen: number }[];
  const latestFees = db.prepare(`
    SELECT fr.member_id, fr.expiry_date
    FROM membership_fee_records fr
    JOIN (
      SELECT member_id, MAX(expiry_date) as max_expiry
      FROM membership_fee_records
      WHERE status = 'paid'
      GROUP BY member_id
    ) latest
    ON fr.member_id = latest.member_id AND fr.expiry_date = latest.max_expiry AND fr.status = 'paid'
  `).all() as { member_id: string; expiry_date: string }[];
  const latestMap = new Map(latestFees.map(item => [item.member_id, item.expiry_date]));
  const freezeStmt = db.prepare(`UPDATE members SET status = 'suspended', auto_frozen = 1 WHERE id = ?`);
  const unfreezeStmt = db.prepare(`UPDATE members SET status = 'active', auto_frozen = 0 WHERE id = ?`);

  for (const member of members) {
    const expiryDate = latestMap.get(member.id) || null;
    const { status } = getFeeStatus(expiryDate);
    if (status === 'overdue' && member.status !== 'suspended') {
      freezeStmt.run(member.id);
      continue;
    }
    if (status !== 'overdue' && member.auto_frozen === 1) {
      unfreezeStmt.run(member.id);
    }
  }
}

function getMembersWithFeeOverview() {
  const db = getDB();
  syncMemberPrivileges();

  const members = db.prepare('SELECT * FROM members ORDER BY created_at DESC').all() as MemberRow[];
  const latestFees = db.prepare(`
    SELECT fr.member_id, fr.cycle, fr.amount, fr.payment_date, fr.expiry_date, fr.status
    FROM membership_fee_records fr
    JOIN (
      SELECT member_id, MAX(expiry_date) as max_expiry
      FROM membership_fee_records
      WHERE status = 'paid'
      GROUP BY member_id
    ) latest
    ON fr.member_id = latest.member_id AND fr.expiry_date = latest.max_expiry
  `).all() as { member_id: string; cycle: string; amount: number; payment_date: string; expiry_date: string; status: string }[];

  const historyStat = db.prepare(`
    SELECT member_id, COUNT(*) as history_count, SUM(amount) as total_paid
    FROM membership_fee_records
    GROUP BY member_id
  `).all() as { member_id: string; history_count: number; total_paid: number }[];

  const latestMap = new Map(latestFees.map(item => [item.member_id, item]));
  const statMap = new Map(historyStat.map(item => [item.member_id, item]));

  return members.map(member => {
    const latestFee = latestMap.get(member.id);
    const stat = statMap.get(member.id);
    const feeState = getFeeStatus(latestFee?.expiry_date || null);
    return {
      ...member,
      fee_status: feeState.status,
      remaining_days: feeState.remainingDays,
      due_reminder: feeState.dueReminder,
      last_payment_date: latestFee?.payment_date || '',
      expiry_date: latestFee?.expiry_date || '',
      fee_cycle: latestFee?.cycle || '',
      fee_amount: latestFee?.amount || 0,
      fee_record_status: latestFee?.status || '',
      fee_history_count: stat?.history_count || 0,
      total_paid: stat?.total_paid || 0
    };
  });
}

interface MemberRow {
  id: string;
  name: string;
  contact_info: string;
  join_date: string;
  member_type: string;
  status: string;
  notes: string;
  membership_fee_period: string;
  membership_fee_amount: number;
  membership_due_date: string;
}

interface FeeRecordRow {
  id: string;
  member_id: string;
  payment_date: string;
  amount: number;
  period_start: string;
  period_end: string;
  status: string;
  transaction_id: string;
}

export function registerMemberHandlers() {
  const db = getDB();
  fs.ensureDirSync(proofDir);

  ipcMain.handle('member:list', async () => {
    return getMembersWithFeeOverview();
  });

  ipcMain.handle('member:create', async (_, data) => {
    const actor = resolveActor(data);
    assertRole(actor.role, ['admin', 'finance']);
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO members (id, name, contact_info, join_date, status, member_type, auto_frozen, notes)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `);
    stmt.run(
      id,
      data.name,
      JSON.stringify(data.contact_info),
      data.join_date,
      data.status,
      data.member_type || 'standard',
      data.notes
    );
    writeAuditLog(db, {
      module: 'member',
      action: 'create',
      targetId: id,
      afterData: { ...data, id },
      actor
    });
    return { id };
  });

  ipcMain.handle('member:update', async (_, payload) => {
    const actor = resolveActor(payload);
    assertRole(actor.role, ['admin', 'finance']);
    const { id, ...data } = payload;
    const before = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as MemberRow | undefined;

    if (!before) throw new Error('会员不存在');
    const stmt = db.prepare(`
      UPDATE members 
      SET name = ?, contact_info = ?, join_date = ?, status = ?, member_type = ?, notes = ?
      WHERE id = ?
    `);
    stmt.run(
      data.name,
      JSON.stringify(data.contact_info),
      data.join_date,
      data.status,
      data.member_type || 'standard',
      data.notes,
      id
    );
    writeAuditLog(db, {
      module: 'member',
      action: 'update',
      targetId: id,
      beforeData: before,
      afterData: data,
      actor
    });
    return { success: true };
  });

  ipcMain.handle('member:delete', async (_, data) => {
    const actor = resolveActor(data);
    assertRole(actor.role, ['admin']);
    const id = typeof data === 'string' ? data : data?.id;
    const before = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as MemberRow | undefined;

    if (!before) throw new Error('会员不存在');

    const execute = db.transaction(() => {
      // 1. Delete associated fee records first to avoid foreign key constraints
      db.prepare('DELETE FROM membership_fee_records WHERE member_id = ?').run(id);
      
      // 2. Clear member references from transactions and files (soft detach)
      db.prepare('UPDATE transactions SET member_id = NULL WHERE member_id = ?').run(id);
      db.prepare('UPDATE file_attachments SET member_id = NULL WHERE member_id = ?').run(id);
      
      // 3. Delete the member
      db.prepare('DELETE FROM members WHERE id = ?').run(id);
      
      // 4. Log the deletion
      writeAuditLog(db, {
        module: 'member',
        action: 'delete',
        targetId: id,
        beforeData: before,
        actor
      });
    });

    execute();
    syncMemberPrivileges();
    
    return { success: true };
  });

  ipcMain.handle('member:fee:create', async (_, data) => {
    const actor = resolveActor(data);
    assertRole(actor.role, ['admin', 'finance']);
    const id = uuidv4();
    const cycle = data.cycle as FeeCycle;
    const paymentDate = data.payment_date || dayjs().format('YYYY-MM-DD');
    const expiryDate = getExpiryDate(paymentDate, cycle);
    const amount = Number(data.amount || 0);
    if (!data.member_id || amount <= 0) {
      throw new Error('缴费信息不完整');
    }

    const category = db.prepare(`
      SELECT id FROM categories WHERE type = 'income' AND name = '会员费' LIMIT 1
    `).get() as { id: number } | undefined;
    const account = db.prepare(`
      SELECT id FROM accounts ORDER BY id LIMIT 1
    `).get() as { id: number } | undefined;
    if (!category || !account) {
      throw new Error('缺少默认分类或账户，无法同步收支记录');
    }

    const member = db.prepare(`SELECT id, name FROM members WHERE id = ?`).get(data.member_id) as { id: string; name: string } | undefined;
    if (!member) {
      throw new Error('会员不存在');
    }

    const transactionId = uuidv4();
    const createFeeWithTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO transactions (
          id, date, type, amount, account_id, category_id, description, member_id, created_by,
          source_type, source_ref_id, version, updated_at
        )
        VALUES (?, ?, 'income', ?, ?, ?, ?, ?, ?, 'membership_fee', ?, 1, strftime('%s', 'now'))
      `).run(
        transactionId,
        normalizeDateTime(paymentDate),
        amount,
        account.id,
        category.id,
        `会员缴费-${member.name}-${cycle}`,
        member.id,
        Number(actor.id) || 0,
        id
      );
      db.prepare(`
        UPDATE accounts
        SET balance = balance + ?
        WHERE id = ?
      `).run(amount, account.id);
      db.prepare(`
        INSERT INTO membership_fee_records (
          id, member_id, cycle, amount, payment_date, expiry_date, status, transaction_id, sync_status, retry_count, version
        )
        VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, 'synced', 0, 1)
      `).run(id, data.member_id, cycle, amount, paymentDate, expiryDate, transactionId);
      writeAuditLog(db, {
        module: 'membership_fee',
        action: 'create_and_sync',
        targetId: id,
        afterData: {
          fee_id: id,
          member_name: member.name,
          member_id: member.id,
          amount,
          cycle,
          payment_date: paymentDate,
          transaction_id: transactionId
        },
        actor
      });
    });

    try {
      createFeeWithTransaction();
    } catch (error: unknown) {
      const err = error as Error;
      db.prepare(`
        INSERT INTO membership_fee_records (
          id, member_id, cycle, amount, payment_date, expiry_date, status, sync_status, retry_count, version
        )
        VALUES (?, ?, ?, ?, ?, ?, 'paid', 'pending', 1, 1)
      `).run(id, data.member_id, cycle, amount, paymentDate, expiryDate);
      enqueueSyncRetry(id, data, err.message);
      writeAuditLog(db, {
        module: 'membership_fee',
        action: 'sync_failed',
        targetId: id,
        afterData: { error: err.message, payload: data },
        actor
      });
    }

    syncMemberPrivileges();
    processSyncRetryQueue();
    return { success: true, id, expiry_date: expiryDate };
  });

  ipcMain.handle('member:fee:history', async (_, memberId: string) => {
    return db.prepare(`
      SELECT id, member_id, cycle, amount, payment_date, expiry_date, status, transaction_id, proof_file_id, sync_status, created_at
      FROM membership_fee_records
      WHERE member_id = ?
      ORDER BY payment_date DESC
    `).all(memberId);
  });

  ipcMain.handle('member:fee:revoke', async (_, data) => {
    const actor = resolveActor(data);
    assertRole(actor.role, ['admin', 'finance']);
    const { id, reason } = data;

    if (!id || !reason) {
      throw new Error('缺少撤销凭证或原因');
    }

    const feeRecord = db.prepare(`
      SELECT * FROM membership_fee_records WHERE id = ?
    `).get(id) as FeeRecordRow | undefined;

    if (!feeRecord) {
      throw new Error('缴费记录不存在');
    }

    if (feeRecord.status === 'revoked') {
      throw new Error('该缴费记录已被撤销，请勿重复操作');
    }

    const execute = db.transaction(() => {
      // 1. Mark fee as revoked
      db.prepare(`
        UPDATE membership_fee_records
        SET status = 'revoked', version = version + 1
        WHERE id = ?
      `).run(id);

      // 2. Rollback transaction if exists
      if (feeRecord.transaction_id) {
        const transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND deleted_at IS NULL').get(feeRecord.transaction_id) as { type: string; amount: number; account_id: string } | undefined;
        if (transaction) {
          const rollbackBalance = transaction.type === 'income' ? -Number(transaction.amount) : Number(transaction.amount);
          db.prepare(`
            UPDATE accounts
            SET balance = balance + ?
            WHERE id = ?
          `).run(rollbackBalance, transaction.account_id);

          db.prepare(`
            UPDATE transactions
            SET deleted_at = strftime('%s', 'now'), updated_at = strftime('%s', 'now')
            WHERE id = ?
          `).run(feeRecord.transaction_id);
          
          writeAuditLog(db, {
            module: 'transaction',
            action: 'delete',
            targetId: feeRecord.transaction_id,
            beforeData: transaction,
            actor
          });
        }
      }

      // 3. Audit log for revocation
      writeAuditLog(db, {
        module: 'membership_fee',
        action: 'revoke',
        targetId: id,
        beforeData: feeRecord,
        afterData: { reason },
        actor
      });
    });

    execute();
    syncMemberPrivileges();
    
    return { success: true };
  });

  ipcMain.handle('member:fee:proof:upload', async (_, data) => {
    const actor = resolveActor(data);
    assertRole(actor.role, ['admin', 'finance']);
    const { fee_record_id, member_id, file_name, base64_data, watermark_text } = data;
    if (!fee_record_id || !member_id || !file_name || !base64_data) {
      throw new Error('凭证参数缺失');
    }
    const feeRecord = db.prepare(`
      SELECT id, transaction_id FROM membership_fee_records WHERE id = ? AND member_id = ?
    `).get(fee_record_id, member_id) as { id: string; transaction_id: string } | undefined;
    if (!feeRecord) {
      throw new Error('缴费记录不存在');
    }

    const { mimeType, buffer } = decodeBase64File(base64_data);
    const ext = getSafeExt(file_name, mimeType);
    const safeName = `${uuidv4()}.${ext}`;
    const filePath = join(proofDir, safeName);
    await fs.writeFile(filePath, buffer);
    await fs.chmod(filePath, 0o600);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const fileId = uuidv4();
    db.prepare(`
      INSERT INTO file_attachments (
        id, owner_type, owner_id, member_id, transaction_id, file_name, file_path,
        file_type, file_size, file_hash, watermark_text, created_by
      )
      VALUES (?, 'membership_fee', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId,
      fee_record_id,
      member_id,
      feeRecord.transaction_id || null,
      file_name,
      filePath,
      mimeType,
      buffer.byteLength,
      hash,
      watermark_text || '财务凭证-仅限内部使用',
      actor.name
    );
    db.prepare(`
      UPDATE membership_fee_records
      SET proof_file_id = ?, version = version + 1
      WHERE id = ?
    `).run(fileId, fee_record_id);
    writeAuditLog(db, {
      module: 'membership_fee_proof',
      action: 'upload',
      targetId: fileId,
      afterData: { fee_record_id, file_name, mimeType, size: buffer.byteLength },
      actor
    });
    return { success: true, file_id: fileId };
  });

  ipcMain.handle('member:fee:proof:list', async (_, feeRecordId: string) => {
    return db.prepare(`
      SELECT id, file_name, file_type, file_size, created_at
      FROM file_attachments
      WHERE owner_type = 'membership_fee' AND owner_id = ? AND is_deleted = 0
      ORDER BY created_at DESC
    `).all(feeRecordId);
  });

  ipcMain.handle('member:fee:proof:download', async (_, fileId: string) => {
    const row = db.prepare(`
      SELECT id, file_name, file_path, file_type
      FROM file_attachments
      WHERE id = ? AND is_deleted = 0
    `).get(fileId) as { id: string; file_name: string; file_path: string; file_type: string } | undefined;
    if (!row || !(await fs.pathExists(row.file_path))) {
      throw new Error('凭证文件不存在');
    }
    const content = await fs.readFile(row.file_path);
    return {
      id: row.id,
      file_name: row.file_name,
      file_type: row.file_type,
      base64_data: `data:${row.file_type};base64,${content.toString('base64')}`
    };
  });

  ipcMain.handle('member:fee:proof:delete', async (_, data) => {
    const actor = resolveActor(data);
    assertRole(actor.role, ['admin', 'finance']);
    const { file_id } = data;
    const row = db.prepare(`
      SELECT id, file_path
      FROM file_attachments
      WHERE id = ? AND is_deleted = 0
    `).get(file_id) as { id: string; file_path: string } | undefined;
    if (!row) {
      throw new Error('凭证不存在');
    }
    db.prepare(`
      UPDATE file_attachments
      SET is_deleted = 1, deleted_at = strftime('%s', 'now')
      WHERE id = ?
    `).run(file_id);
    if (await fs.pathExists(row.file_path)) {
      await fs.remove(row.file_path);
    }
    writeAuditLog(db, {
      module: 'membership_fee_proof',
      action: 'delete',
      targetId: file_id,
      actor
    });
    return { success: true };
  });

  ipcMain.handle('member:fee:reminders', async () => {
    const members = getMembersWithFeeOverview();
    return members
      .filter(item => item.fee_status !== 'overdue' && item.due_reminder)
      .map(item => ({
        member_id: item.id,
        member_name: item.name,
        remaining_days: item.remaining_days,
        expiry_date: item.expiry_date
      }));
  });

  ipcMain.handle('member:fee:report:export', async (_, data: {
    startDate: string;
    endDate: string;
    memberType?: string;
  }) => {
    const startDate = dayjs(data.startDate).startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const endDate = dayjs(data.endDate).endOf('day').format('YYYY-MM-DD HH:mm:ss');
    const memberType = data.memberType || 'all';
    let query = `
      SELECT m.name as member_name, m.member_type, r.cycle, r.amount, r.payment_date, r.expiry_date, r.status
      FROM membership_fee_records r
      JOIN members m ON r.member_id = m.id
      WHERE r.payment_date BETWEEN ? AND ?
    `;
    const params: any[] = [startDate, endDate];
    if (memberType !== 'all') {
      query += ` AND m.member_type = ?`;
      params.push(memberType);
    }
    query += ` ORDER BY r.payment_date DESC`;
    const rows = db.prepare(query).all(...params) as { member_name: string; member_type: string; payment_date: string; amount: number; cycle: string; period_start: string; period_end: string; expiry_date: string; status: string; actor_name: string }[];
    const content = buildFeeReportCsv(rows);

    const now = dayjs().format('YYYYMMDD_HHmmss');
    const defaultPath = join(app.getPath('downloads'), `membership_fee_report_${now}.csv`);
    const saveResult = await dialog.showSaveDialog({
      title: '导出会费统计报表',
      defaultPath,
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
    });
    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, canceled: true };
    }
    await fs.writeFile(saveResult.filePath, content, 'utf-8');
    return {
      success: true,
      filePath: saveResult.filePath,
      count: rows.length
    };
  });
}
