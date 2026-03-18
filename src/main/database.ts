import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import fs from 'fs-extra';
import log from 'electron-log/main';
import bcrypt from 'bcryptjs';

import store from './store';

let db: Database.Database | null = null;
let currentDbPath: string = '';

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
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
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
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY(account_id) REFERENCES accounts(id),
      FOREIGN KEY(category_id) REFERENCES categories(id)
    );
  `);

  // Seed default admin
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    db.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`).run('admin', hash, 'admin');
    log.info('Default admin user created.');
  }
}

export function closeDB() {
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
