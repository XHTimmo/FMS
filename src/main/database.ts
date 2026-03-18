import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import fs from 'fs-extra';
import log from 'electron-log/main';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

import store from './store';

let db: Database.Database | null = null;
let currentDbPath: string = '';
let backupTimer: NodeJS.Timeout | null = null;

export function getDbPath() {
  const configuredPath = store.get('dbPath');
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }
  
  // Fallback to default
  const userDataPath = app.getPath('userData');
  const dbDir = join(userDataPath, 'database');
  fs.ensureDirSync(dbDir);
  return join(dbDir, 'studio_finance.sqlite');
}

export function initDB() {
  currentDbPath = getDbPath();
  const dbDir = require('path').dirname(currentDbPath);
  fs.ensureDirSync(dbDir);
  
  db = new Database(currentDbPath, { verbose: log.info });

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      is_active BOOLEAN DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_info TEXT,
      join_date TEXT,
      status TEXT DEFAULT 'active',
      member_type TEXT DEFAULT 'standard',
      auto_frozen INTEGER DEFAULT 0,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS membership_fee_records (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      cycle TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      transaction_id TEXT,
      proof_file_id TEXT,
      sync_status TEXT DEFAULT 'synced',
      retry_count INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY(member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'CNY'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      parent_id INTEGER,
      icon TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      account_id INTEGER,
      to_account_id INTEGER,
      category_id INTEGER,
      description TEXT,
      member_id TEXT,
      created_by INTEGER,
      source_type TEXT DEFAULT 'manual',
      source_ref_id TEXT,
      version INTEGER DEFAULT 1,
      updated_at INTEGER,
      deleted_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY(account_id) REFERENCES accounts(id),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      target_id TEXT,
      before_data TEXT,
      after_data TEXT,
      operator_id TEXT,
      operator_name TEXT,
      operator_role TEXT,
      ip_address TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS file_attachments (
      id TEXT PRIMARY KEY,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      member_id TEXT,
      transaction_id TEXT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_hash TEXT NOT NULL,
      watermark_text TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_by TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sync_retry_queue (
      id TEXT PRIMARY KEY,
      queue_type TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      next_retry_at INTEGER,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transaction_dedup
      ON transactions(date, type, amount, account_id, category_id, description, member_id);
  `);

  const memberColumns = db.prepare(`PRAGMA table_info(members)`).all() as { name: string }[];
  const memberColumnNames = new Set(memberColumns.map(item => item.name));
  if (!memberColumnNames.has('member_type')) {
    db.exec(`ALTER TABLE members ADD COLUMN member_type TEXT DEFAULT 'standard'`);
  }
  if (!memberColumnNames.has('auto_frozen')) {
    db.exec(`ALTER TABLE members ADD COLUMN auto_frozen INTEGER DEFAULT 0`);
  }

  const feeColumns = db.prepare(`PRAGMA table_info(membership_fee_records)`).all() as { name: string }[];
  const feeColumnNames = new Set(feeColumns.map(item => item.name));
  if (!feeColumnNames.has('transaction_id')) {
    db.exec(`ALTER TABLE membership_fee_records ADD COLUMN transaction_id TEXT`);
  }
  if (!feeColumnNames.has('proof_file_id')) {
    db.exec(`ALTER TABLE membership_fee_records ADD COLUMN proof_file_id TEXT`);
  }
  if (!feeColumnNames.has('sync_status')) {
    db.exec(`ALTER TABLE membership_fee_records ADD COLUMN sync_status TEXT DEFAULT 'synced'`);
  }
  if (!feeColumnNames.has('retry_count')) {
    db.exec(`ALTER TABLE membership_fee_records ADD COLUMN retry_count INTEGER DEFAULT 0`);
  }
  if (!feeColumnNames.has('version')) {
    db.exec(`ALTER TABLE membership_fee_records ADD COLUMN version INTEGER DEFAULT 1`);
  }

  const transactionColumns = db.prepare(`PRAGMA table_info(transactions)`).all() as { name: string }[];
  const transactionColumnNames = new Set(transactionColumns.map(item => item.name));
  if (!transactionColumnNames.has('source_type')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN source_type TEXT DEFAULT 'manual'`);
  }
  if (!transactionColumnNames.has('source_ref_id')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN source_ref_id TEXT`);
  }
  if (!transactionColumnNames.has('version')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN version INTEGER DEFAULT 1`);
  }
  if (!transactionColumnNames.has('updated_at')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN updated_at INTEGER`);
  }
  if (!transactionColumnNames.has('deleted_at')) {
    db.exec(`ALTER TABLE transactions ADD COLUMN deleted_at INTEGER`);
  }

  // Seed default admin
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    db.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`).run('admin', hash, 'admin');
    log.info('Default admin user created.');
  }
}

function getBackupDir() {
  const userDataPath = app.getPath('userData');
  const backupDir = join(userDataPath, 'backups');
  fs.ensureDirSync(backupDir);
  return backupDir;
}

export function performDatabaseBackup() {
  if (!currentDbPath || !fs.existsSync(currentDbPath)) {
    return { success: false, reason: 'db_not_found' };
  }
  const backupDir = getBackupDir();
  const backupName = `studio_finance_backup_${dayjs().format('YYYYMMDD_HHmmss')}.sqlite`;
  const backupPath = join(backupDir, backupName);
  fs.copyFileSync(currentDbPath, backupPath);
  return { success: true, backupPath };
}

export function setupAutoBackup() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
  backupTimer = setInterval(() => {
    try {
      performDatabaseBackup();
    } catch (error) {
      log.error('Auto backup failed:', error);
    }
  }, 6 * 60 * 60 * 1000);
}

export function closeDB() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
  if (db) {
    db.close();
    db = null;
  }
}

export function getDB() {
  if (!db) {
    initDB();
  }
  return db!;
}

export function getCurrentDbPath() {
  return currentDbPath;
}
