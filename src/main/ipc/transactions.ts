import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database';

export function registerTransactionHandlers() {
  const db = getDB();

  ipcMain.handle('transaction:list', async (_, { start_date, end_date }) => {
    let query = 'SELECT t.*, c.name as category_name, a.name as account_name FROM transactions t LEFT JOIN categories c ON t.category_id = c.id LEFT JOIN accounts a ON t.account_id = a.id';
    const params: any[] = [];
    
    if (start_date && end_date) {
      query += ' WHERE t.date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    query += ' ORDER BY t.date DESC';
    return db.prepare(query).all(...params);
  });

  ipcMain.handle('transaction:create', async (_, data) => {
    const id = uuidv4();
    const { date, type, amount, account_id, category_id, description, member_id, created_by } = data;
    
    const stmt = db.prepare(`
      INSERT INTO transactions (id, date, type, amount, account_id, category_id, description, member_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Wrap in transaction for balance update
    const execute = db.transaction(() => {
      stmt.run(id, date, type, amount, account_id, category_id, description, member_id, created_by);
      
      // Update account balance
      const balanceUpdate = db.prepare(`
        UPDATE accounts 
        SET balance = balance + ? 
        WHERE id = ?
      `);
      
      const balanceChange = type === 'income' ? amount : -amount;
      balanceUpdate.run(balanceChange, account_id);
    });
    
    execute();
    return { id };
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
