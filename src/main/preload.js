'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Roblox Detection
  detectRoblox: () => ipcRenderer.invoke('roblox:detect'),

  // FPS Unlocker
  getFpsStatus: () => ipcRenderer.invoke('fps:status'),
  unlockFps: (targetFps) => ipcRenderer.invoke('fps:unlock', targetFps),

  // Performance Optimizations
  getOptimizationStatus: () => ipcRenderer.invoke('optimize:status'),
  applyAllOptimizations: () => ipcRenderer.invoke('optimize:all'),
  optimizeCpu: () => ipcRenderer.invoke('optimize:cpu'),
  optimizeGpu: () => ipcRenderer.invoke('optimize:gpu'),
  optimizeRam: () => ipcRenderer.invoke('optimize:ram'),
  optimizeWindows: () => ipcRenderer.invoke('optimize:windows'),

  // Restore & Revert
  getRestoreOverview: () => ipcRenderer.invoke('restore:overview'),
  restoreFps: () => ipcRenderer.invoke('restore:fps'),
  restoreCategory: (cat) => ipcRenderer.invoke('restore:category', cat),
  restoreSelected: (cats) => ipcRenderer.invoke('restore:selected', cats),
  restoreEverything: () => ipcRenderer.invoke('restore:everything'),

  // Backups & Journal
  listBackups: () => ipcRenderer.invoke('backup:list'),
  getJournal: (cat) => ipcRenderer.invoke('journal:get', cat),
  getJournalSummary: () => ipcRenderer.invoke('journal:summary'),
  exportJournal: () => ipcRenderer.invoke('journal:export'),

  // Live Performance Metrics
  getLiveMetrics: () => ipcRenderer.invoke('metrics:live'),

  // System & Window Actions
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
});
