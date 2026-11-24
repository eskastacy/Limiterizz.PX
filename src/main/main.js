'use strict';

delete process.env.ELECTRON_RUN_AS_NODE;

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const logger = require('./utils/logger');

// Modules
const robloxDetector = require('./modules/roblox-detector');
const fpsUnlocker = require('./modules/fps-unlocker');
const perfOptimizer = require('./modules/performance-optimizer');
const systemRestore = require('./modules/system-restore');
const backupManager = require('./modules/backup-manager');
const changeJournal = require('./modules/change-journal');
const perfMonitor = require('./modules/perf-monitor');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0a0a0a',
    title: 'Limiterizz.PX',
    icon: path.join(__dirname, '../assets/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Limiterizz.PX main window initialized.');
}

// App lifecycle
app.whenReady().then(() => {
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

// ======================== IPC HANDLERS ========================

// Window controls
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// External browser open
ipcMain.handle('shell:openExternal', async (event, url) => {
  // Security validation: only allow http/https protocols
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Invalid URL scheme' };
});

// Roblox Detection
ipcMain.handle('roblox:detect', async () => {
  return await robloxDetector.detectRoblox();
});

// FPS Unlocker
ipcMain.handle('fps:status', async () => {
  return await fpsUnlocker.getFpsStatus();
});

ipcMain.handle('fps:unlock', async (event, targetFps) => {
  return await fpsUnlocker.unlockFps(targetFps);
});

// Performance Optimizations
ipcMain.handle('optimize:status', async () => {
  return await perfOptimizer.getOptimizationStatus();
});

ipcMain.handle('optimize:all', async () => {
  return await perfOptimizer.applyAllOptimizations();
});

ipcMain.handle('optimize:cpu', async () => {
  const p1 = await perfOptimizer.optimizeCpuPriority();
  const p2 = await perfOptimizer.optimizePowerThrottling();
  return { success: p1.success && p2.success, items: [p1, p2] };
});

ipcMain.handle('optimize:gpu', async () => {
  return await perfOptimizer.optimizeGpuPreference();
});

ipcMain.handle('optimize:ram', async () => {
  return await perfOptimizer.optimizeMemoryPriority();
});

ipcMain.handle('optimize:windows', async () => {
  const p1 = await perfOptimizer.optimizePowerPlan();
  const p2 = await perfOptimizer.optimizeGameMode();
  const p3 = await perfOptimizer.optimizeGameDvr();
  return { success: p1.success && p2.success && p3.success, items: [p1, p2, p3] };
});

// System Restore
ipcMain.handle('restore:overview', async () => {
  return await systemRestore.getRestoreOverview();
});

ipcMain.handle('restore:fps', async () => {
  return await systemRestore.restoreFpsConfiguration();
});

ipcMain.handle('restore:category', async (event, cat) => {
  return await systemRestore.restoreCategory(cat);
});

ipcMain.handle('restore:selected', async (event, cats) => {
  return await systemRestore.restoreSelected(cats);
});

ipcMain.handle('restore:everything', async () => {
  return await systemRestore.restoreEverything();
});

// Backups & Journal
ipcMain.handle('backup:list', async () => {
  return backupManager.listBackups();
});

ipcMain.handle('journal:get', async (event, cat) => {
  return changeJournal.getEntries(cat);
});

ipcMain.handle('journal:summary', async () => {
  return changeJournal.getSummary();
});

ipcMain.handle('journal:export', async () => {
  const exportPath = path.join(process.env.USERPROFILE || '', 'Desktop', `LimiterizzPX_Journal_${Date.now()}.json`);
  return changeJournal.exportJournal(exportPath);
});

// Performance Metrics
ipcMain.handle('metrics:live', async () => {
  return await perfMonitor.getLiveMetrics();
});
