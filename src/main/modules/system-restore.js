'use strict';

const fs = require('fs');
const { journalSetting, guid } = require('./performance-settings');
const robloxDetector = require('./roblox-detector');
const backupManager = require('./backup-manager');
const changeJournal = require('./change-journal');
const registry = require('../utils/registry');
const logger = require('../utils/logger');

const categories = ['fps', 'cpu', 'gpu', 'ram', 'windows'];

/**
 * Restores Roblox XML configuration to pristine original state from original_backup.xml.
 */
async function restoreFpsConfiguration() {
  logger.info('Restoring FPS configuration to original state...');
  const detection = await robloxDetector.detectRoblox();

  if (!backupManager.hasOriginalBackup()) {
    const origPath = backupManager.getOriginalBackupPath();
    if (!fs.existsSync(origPath) && detection?.configExists && detection?.configPath) {
      backupManager.createOriginalBackup(detection.configPath);
      return {
        success: true,
        category: 'fps',
        status: 'Original State Verified',
        targetPath: detection.configPath,
        message: 'Roblox configuration is already at pristine baseline. Original backup secured.',
      };
    }
    throw new Error('Original backup (original_backup.xml) not found or damaged. Cannot restore original state.');
  }

  const originalBackupPath = backupManager.getOriginalBackupPath();
  const targetPath = detection.configPath;

  // Snapshot before restoring (safety mechanism)
  if (fs.existsSync(targetPath)) {
    backupManager.createSnapshotBackup(targetPath, 'pre-restore');
  }

  // Atomic restore
  const res = backupManager.restoreFromBackup(originalBackupPath, targetPath);
  if (!res.success) {
    throw new Error('Failed to copy original backup to target configuration path.');
  }

  // Mark pending journal entries for FPS as restored
  const entries = changeJournal.getUnrestoredEntries('fps');
  for (const entry of entries) {
    changeJournal.markRestored(entry.id);
  }

  logger.info('FPS configuration successfully restored.');
  return {
    success: true,
    category: 'fps',
    status: 'Successfully Restored',
    targetPath,
    message: 'Roblox GlobalBasicSettings_13.xml restored to original state.',
  };
}

/**
 * Reverts registry or system setting using recorded originalValue from journal entry.
 */
async function revertJournalEntry(entry) {
  try {
    let result;
    const original = entry.originalValue;
    if (entry.category === 'windows' && entry.key === 'PowerScheme/ActiveGUID') {
      if (typeof original !== 'string' || !guid.test(original)) throw new Error('Invalid original power scheme GUID.');
      result = await registry.runWindowsTool('powercfg.exe', ['/setactive', original]);
    } else {
      const s = journalSetting(entry);
      if (!s) throw new Error('Unrecognized registry target.');
      if (original === null) {
        const current = await registry.getRegistryValue(s.key, s.valueName);
        if (current.error) throw new Error(current.error);
        result = current.found ? await registry.deleteRegistryValue(s.key, s.valueName) : { success: true };
      } else {
        const valid = s.type === 'REG_SZ' ? typeof original === 'string' && !original.includes('\0') :
          Number.isInteger(original) && original >= 0 && original <= 0xffffffff;
        if (!valid) throw new Error('Invalid original registry value.');
        result = await registry.setRegistryValue(s.key, s.valueName, s.type, original);
      }
    }
    if (!result.success) throw new Error(result.error || 'Windows rejected the restore.');
    if (!changeJournal.markRestored(entry.id)) throw new Error('Rollback record missing.');
    return { success: true, key: entry.key, restoredValue: entry.originalValue };
  } catch (err) {
    logger.error(`Error reverting entry ${entry.id} (${entry.key}): ${err.message}`);
    return { success: false, key: entry.key, error: err.message };
  }
}

/**
 * Restores a specific category of optimizations.
 * @param {'fps'|'cpu'|'gpu'|'ram'|'windows'} category
 */
async function restoreCategory(category) {
  if (!categories.includes(category)) throw new Error('Unknown restore category.');
  logger.info(`Starting selective restore for category: ${category}`);

  if (category === 'fps') {
    return await restoreFpsConfiguration();
  }

  const pendingEntries = changeJournal.getUnrestoredEntries(category);
  if (pendingEntries.length === 0) {
    return {
      success: true,
      category,
      status: 'Original State Verified',
      message: `No active modifications pending restore for ${category}.`,
      restoredCount: 0,
    };
  }

  const results = [];
  const blocked = new Set();
  // Entries are newest first. Do not unwind an older value past a failed undo.
  for (const entry of pendingEntries) {
    const key = String(entry.key).toLowerCase();
    const res = blocked.has(key) ? { success: false, key: entry.key, error: 'Newer restore is still pending.' } : await revertJournalEntry(entry);
    if (!res.success) blocked.add(key);
    results.push(res);
  }

  const failed = results.filter(r => !r.success);
  const status = !failed.length ? 'Successfully Restored' : failed.length === results.length ? 'Restore Failed' : 'Partially Restored';

  return {
    success: failed.length === 0,
    category,
    status,
    restoredCount: results.filter(r => r.success).length,
    failedCount: failed.length,
    details: results,
  };
}

/**
 * Restores multiple selected categories.
 * @param {string[]} categories Array e.g. ['fps', 'cpu', 'windows']
 */
async function restoreSelected(selected = []) {
  if (!Array.isArray(selected) || !selected.every(c => categories.includes(c))) throw new Error('Unknown restore category.');
  const summary = [];
  for (const cat of new Set(selected)) {
    const res = await restoreCategory(cat);
    summary.push(res);
  }
  return summary;
}

/**
 * Restores EVERYTHING modified by Limiterizz.PX back to original state.
 */
async function restoreEverything() {
  logger.info('Initiating COMPLETE SYSTEM RESTORE for Limiterizz.PX...');
  const categories = ['fps', 'cpu', 'gpu', 'ram', 'windows'];
  const results = {};

  for (const cat of categories) {
    try {
      results[cat] = await restoreCategory(cat);
    } catch (err) {
      results[cat] = {
        success: false,
        category: cat,
        status: 'Restore Failed',
        error: err.message,
      };
    }
  }

  const allSuccess = Object.values(results).every(r => r.success);
  const hasPartial = Object.values(results).some(r => r.status === 'Partially Restored' || r.status === 'Successfully Restored');

  let overallStatus = 'Successfully Restored';
  if (!allSuccess) {
    overallStatus = hasPartial ? 'Partially Restored' : 'Restore Failed';
  }

  logger.info(`Complete restore finished with status: ${overallStatus}`);

  return {
    success: allSuccess,
    overallStatus,
    results,
    originalBackupPreserved: backupManager.hasOriginalBackup(),
  };
}

/**
 * Verifies system restoration status.
 */
async function getRestoreOverview() {
  const summary = changeJournal.getSummary();
  const originalBackupAvailable = backupManager.hasOriginalBackup();

  const detection = await robloxDetector.detectRoblox();
  let currentFps = null;
  if (detection.configExists) {
    try {
      const xmlConfig = require('./xml-config');
      const raw = xmlConfig.readConfigFile(detection.configPath);
      currentFps = xmlConfig.extractFpsFromXml(raw);
    } catch {}
  }

  let originalFps = null;
  if (originalBackupAvailable) {
    try {
      const xmlConfig = require('./xml-config');
      const raw = xmlConfig.readConfigFile(backupManager.getOriginalBackupPath());
      originalFps = xmlConfig.extractFpsFromXml(raw);
    } catch {}
  }

  return {
    originalBackupAvailable,
    currentFps,
    originalFps,
    journalSummary: summary,
    canRestoreFps: originalBackupAvailable,
    canRestoreAny: originalBackupAvailable || summary.pendingRestoreCount > 0,
  };
}

module.exports = {
  restoreFpsConfiguration,
  restoreCategory,
  restoreSelected,
  restoreEverything,
  getRestoreOverview,
};
