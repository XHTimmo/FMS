import { ipcMain, shell, dialog } from 'electron';
import fs from 'fs-extra';
import { getCurrentDbPath, closeDB, initDB } from '../database';
import store from '../store';

export function registerSystemHandlers() {
  ipcMain.handle('system:get-db-path', async () => {
    return getCurrentDbPath();
  });

  ipcMain.handle('system:open-db-folder', async () => {
    const dbPath = getCurrentDbPath();
    shell.showItemInFolder(dbPath);
    return { success: true };
  });

  ipcMain.handle('system:change-db-path', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择新的数据存储目录',
      properties: ['openDirectory'],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, reason: 'canceled' };
    }

    const newDir = filePaths[0];
    const newDbPath = `${newDir}/studio_finance.sqlite`;

    // 1. Check if DB already exists there
    let shouldMigrate = false;
    const exists = await fs.pathExists(newDbPath);

    if (exists) {
      const { response } = await dialog.showMessageBox({
        type: 'question',
        title: '确认',
        message: '该目录下已存在数据库文件，是否直接使用它？',
        buttons: ['使用现有', '覆盖它(迁移当前数据)', '取消'],
      });
      if (response === 2) return { success: false, reason: 'canceled' };
      shouldMigrate = response === 1;
    } else {
      shouldMigrate = true;
    }

    try {
      // 2. Close current DB
      const currentPath = getCurrentDbPath();
      closeDB();

      // 3. Migrate if needed
      if (shouldMigrate) {
        await fs.copy(currentPath, newDbPath, { overwrite: true });
      }

      // 4. Update config
      store.set('dbPath', newDbPath);

      // 5. Re-init DB (Verify it works)
      initDB();

      return { success: true, newPath: newDbPath };
    } catch (error: any) {
      console.error('Migration failed:', error);
      // Rollback logic could go here, but for now just re-init old DB
      // We don't change the store if migration fails
      initDB(); 
      return { success: false, error: error.message };
    }
  });
}
