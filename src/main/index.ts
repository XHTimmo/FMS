import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import log from 'electron-log/main';
import { initDB, getDB, setupAutoBackup } from './database';
import { registerMemberHandlers } from './ipc/members';
import { registerTransactionHandlers } from './ipc/transactions';
import { registerDashboardHandlers } from './ipc/dashboard';
import { registerSystemHandlers } from './ipc/system';
import { setupAutoUpdater } from './updater';

log.initialize();

let mainWindow: BrowserWindow | null = null;
const shouldOpenStartupDevTools = process.env.ENABLE_STARTUP_DEVTOOLS === 'true';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1160,
    minHeight: 760,
    backgroundColor: '#f3f5f9',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      zoomFactor: 1,
    },
  });

  let zoomFactor = 1;
  const applyZoom = (next: number) => {
    const clamped = Math.min(1.5, Math.max(0.8, Number(next.toFixed(2))));
    zoomFactor = clamped;
    mainWindow?.webContents.setZoomFactor(clamped);
  };

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isZoomShortcut = (input.control || input.meta) && input.type === 'keyDown';
    if (!isZoomShortcut) return;

    if (input.key === '+' || input.key === '=') {
      event.preventDefault();
      applyZoom(zoomFactor + 0.1);
      return;
    }
    if (input.key === '-' || input.key === '_') {
      event.preventDefault();
      applyZoom(zoomFactor - 0.1);
      return;
    }
    if (input.key === '0') {
      event.preventDefault();
      applyZoom(1);
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (shouldOpenStartupDevTools) {
      mainWindow.webContents.openDevTools();
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  // Setup auto updater
  setupAutoUpdater(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Init DB
  try {
    initDB();
    setupAutoBackup();
    log.info('Database initialized successfully.');
    registerMemberHandlers();
    registerTransactionHandlers();
    registerDashboardHandlers();
    registerSystemHandlers();
  } catch (error) {
    log.error('Failed to initialize database:', error);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('test-db', async () => {
  const db = getDB();
  const row = db.prepare('SELECT sqlite_version() as version').get();
  return { success: true, data: row };
});
