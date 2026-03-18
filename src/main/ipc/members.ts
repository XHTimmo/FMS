import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from '../database';

export function registerMemberHandlers() {
  const db = getDB();

  ipcMain.handle('member:list', async () => {
    return db.prepare('SELECT * FROM members ORDER BY created_at DESC').all();
  });

  ipcMain.handle('member:create', async (_, data) => {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO members (id, name, contact_info, join_date, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.name, JSON.stringify(data.contact_info), data.join_date, data.status, data.notes);
    return { id };
  });

  ipcMain.handle('member:update', async (_, { id, ...data }) => {
    const stmt = db.prepare(`
      UPDATE members 
      SET name = ?, contact_info = ?, join_date = ?, status = ?, notes = ?
      WHERE id = ?
    `);
    stmt.run(data.name, JSON.stringify(data.contact_info), data.join_date, data.status, data.notes, id);
    return { success: true };
  });

  ipcMain.handle('member:delete', async (_, id) => {
    db.prepare('DELETE FROM members WHERE id = ?').run(id);
    return { success: true };
  });
}
