import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';

export function setupAutoUpdater(mainWindow: BrowserWindow) {
  // Configure logger for autoUpdater
  autoUpdater.logger = log;
  (autoUpdater.logger as any).transports.file.level = 'info';

  // Do not automatically download updates, let the user choose
  autoUpdater.autoDownload = false;

  // Handle autoUpdater events
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
    mainWindow.webContents.send('updater:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    mainWindow.webContents.send('updater:status', { 
      status: 'available', 
      info: {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      } 
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available.');
    mainWindow.webContents.send('updater:status', { status: 'not-available', info });
  });

  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater:', err);
    mainWindow.webContents.send('updater:status', { status: 'error', error: err.message || err.toString() });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    log.info(log_message);
    mainWindow.webContents.send('updater:progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded');
    mainWindow.webContents.send('updater:status', { status: 'downloaded', info });
  });

  // IPC handlers for frontend communication
  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, result };
    } catch (error: any) {
      log.error('Check update failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error: any) {
      log.error('Download update failed:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}
