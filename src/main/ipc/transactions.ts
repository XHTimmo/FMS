import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database';
import { assertRole, resolveActor, writeAuditLog } from './security';

const normalizeDateTime = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    return `${value} 00:00:00`;
  }
  return value;
};

interface TransactionRow {
  id: string;
  amount: number;
  type: string;
  category_id: string;
  account_id: string;
  member_id: string;
  description: string;
  date: string;
  source_type?: string;
  source_ref_id?: string;
}

export function registerTransactionHandlers() {
  const db = getDB();
  const balanceUpdate = db.prepare(`
    UPDATE accounts
    SET balance = balance + ?
    WHERE id = ?
  `);

  ipcMain.handle('transaction:list', async (_, { start_date, end_date }) => {
    let query = `
      SELECT
        t.*,
        c.name as category_name,
        a.name as account_name,
        m.name as member_name,
        (SELECT COUNT(*) FROM file_attachments f WHERE f.transaction_id = t.id AND f.is_deleted = 0) as proof_count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN members m ON t.member_id = m.id
      WHERE t.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (start_date && end_date) {
      query += ' AND t.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += ' ORDER BY t.date DESC';
    return db.prepare(query).all(...params);
  });

  ipcMain.handle('transaction:create', async (_, data) => {
    const actor = resolveActor(data);
    assertRole(actor.role, ['admin', 'finance']);
    const id = uuidv4();
    const { date, type, amount, account_id, category_id, description, member_id } = data;
    const normalizedDate = normalizeDateTime(date);
    const normalizedAmount = Number(amount || 0);
    if (normalizedAmount <= 0) {
      throw new Error('金额必须大于 0');
    }

    const duplicate = db.prepare(`
      SELECT id FROM transactions
      WHERE date = ? AND type = ? AND amount = ? AND account_id = ? AND category_id = ?
        AND IFNULL(description, '') = IFNULL(?, '')
        AND IFNULL(member_id, '') = IFNULL(?, '')
        AND deleted_at IS NULL
      LIMIT 1
    `).get(normalizedDate, type, normalizedAmount, account_id, category_id, description || '', member_id || '');
    if (duplicate) {
      throw new Error('检测到疑似重复账单，请核对后再提交');
    }

    const stmt = db.prepare(`
      INSERT INTO transactions (
        id, date, type, amount, account_id, category_id, description, member_id, created_by,
        source_type, source_ref_id, version, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, strftime('%s', 'now'))
    `);

    const execute = db.transaction(() => {
      stmt.run(
        id,
        normalizedDate,
        type,
        normalizedAmount,
        account_id,
        category_id,
        description || '',
        member_id || null,
        Number(actor.id) || 0,
        data.source_type || 'manual',
        data.source_ref_id || null
      );
      const balanceChange = type === 'income' ? normalizedAmount : -normalizedAmount;
      balanceUpdate.run(balanceChange, account_id);
      writeAuditLog(db, {
        module: 'transaction',
        action: 'create',
        targetId: id,
        afterData: { id, date, type, amount: normalizedAmount, account_id, category_id, description, member_id },
        actor
      });
    });

    execute();
    return { id };
  });

  ipcMain.handle('transaction:update', async (_, data) => {
    const actor = resolveActor(data);
    assertRole(actor.role, ['admin', 'finance']);
    const { id, patch } = data;
    const before = db.prepare('SELECT * FROM transactions WHERE id = ? AND deleted_at IS NULL').get(id) as TransactionRow | undefined;

    if (!before) {
      throw new Error('账单不存在或已删除');
    }
    const next = {
      ...before,
      ...patch
    };
    next.date = normalizeDateTime(next.date);
    if (Number(next.amount) <= 0) {
      throw new Error('金额必须大于 0');
    }

    const execute = db.transaction(() => {
      if (before.account_id && before.type) {
        const beforeBalance = before.type === 'income' ? -Number(before.amount) : Number(before.amount);
        balanceUpdate.run(beforeBalance, before.account_id);
      }
      const nextBalance = next.type === 'income' ? Number(next.amount) : -Number(next.amount);
      balanceUpdate.run(nextBalance, next.account_id);
      db.prepare(`
        UPDATE transactions
        SET date = ?, type = ?, amount = ?, account_id = ?, category_id = ?, description = ?,
            member_id = ?, version = version + 1, updated_at = strftime('%s', 'now')
        WHERE id = ?
      `).run(
        next.date,
        next.type,
        Number(next.amount),
        next.account_id,
        next.category_id,
        next.description || '',
        next.member_id || null,
        id
      );
      writeAuditLog(db, {
        module: 'transaction',
        action: 'update',
        targetId: id,
        beforeData: before,
        afterData: next,
        actor
      });
    });
    execute();
    return { success: true };
  });

  ipcMain.handle('transaction:delete', async (_, data) => {
    const actor = resolveActor(data);
    assertRole(actor.role, ['admin', 'finance']);
    const { id } = data;
    const before = db.prepare('SELECT * FROM transactions WHERE id = ? AND deleted_at IS NULL').get(id) as TransactionRow | undefined;
    
    if (!before) {
      throw new Error('账单不存在或已删除');
    }

    const execute = db.transaction(() => {
      const rollbackBalance = before.type === 'income' ? -Number(before.amount) : Number(before.amount);
      balanceUpdate.run(rollbackBalance, before.account_id);
      db.prepare(`
        UPDATE transactions
        SET deleted_at = strftime('%s', 'now'), updated_at = strftime('%s', 'now')
        WHERE id = ?
      `).run(id);

      if ((before.source_type === 'membership_fee' || before.source_type === 'membership_fee_retry') && before.source_ref_id) {
        db.prepare(`
          UPDATE membership_fee_records
          SET status = 'revoked', version = version + 1
          WHERE id = ? AND status = 'paid'
        `).run(before.source_ref_id);
      }

      writeAuditLog(db, {
        module: 'transaction',
        action: 'delete',
        targetId: id,
        beforeData: before,
        actor
      });
    });
    execute();
    return { success: true };
  });

  ipcMain.handle('transaction:proof:list', async (_, transactionId: string) => {
    return db.prepare(`
      SELECT id, file_name, file_type, file_size, created_at
      FROM file_attachments
      WHERE transaction_id = ? AND is_deleted = 0
      ORDER BY created_at DESC
    `).all(transactionId);
  });

  ipcMain.handle('category:list', async () => {
    return db.prepare('SELECT * FROM categories ORDER BY id').all();
  });

  ipcMain.handle('account:list', async () => {
    return db.prepare('SELECT * FROM accounts ORDER BY id').all();
  });
  
  // Seed some categories/accounts if empty
  const accountCount = db.prepare('SELECT COUNT(*) as c FROM accounts').get() as { c: number };
  if (accountCount.c === 0) {
    db.prepare("INSERT INTO accounts (name, type, balance) VALUES ('现金', 'cash', 0)").run();
    db.prepare("INSERT INTO accounts (name, type, balance) VALUES ('银行卡', 'bank', 0)").run();
  }
  
  const categoryCount = db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number };
  if (categoryCount.c === 0) {
    const insertCat = db.prepare("INSERT INTO categories (name, type) VALUES (?, ?)");
    insertCat.run('会员费', 'income');
    insertCat.run('赞助', 'income');
    insertCat.run('房租', 'expense');
    insertCat.run('水电', 'expense');
    insertCat.run('设备', 'expense');
  }
}
