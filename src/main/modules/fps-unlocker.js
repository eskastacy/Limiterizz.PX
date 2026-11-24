'use strict';

const fs = require('fs');
const robloxDetector = require('./roblox-detector');
const xmlConfig = require('./xml-config');
const backupManager = require('./backup-manager');
const changeJournal = require('./change-journal');
const logger = require('../utils/logger');

const DEFAULT_TARGET_FPS = 9999;

/**
 * Reads current FPS configuration state without modifying.
 */
async function getFpsStatus() {
  const detection = await robloxDetector.detectRoblox();

  if (!detection.installed || !detection.configExists) {
    return {
      installed: detection.installed,
      configFound: detection.configExists,
      configPath: detection.configPath,
      robloxRunning: detection.running,
      robloxVersion: detection.version,
      currentFps: null,
      isUnlocked: false,
      targetFps: DEFAULT_TARGET_FPS,
      status: 'not_found',
      backupAvailable: backupManager.hasOriginalBackup(),
      error: 'Roblox configuration file not found.',
    };
  }

  try {
    const rawXml = xmlConfig.readConfigFile(detection.configPath);
    const currentFps = xmlConfig.extractFpsFromXml(rawXml);
    const summary = xmlConfig.extractSettingsSummary(rawXml);
    const hasBackup = backupManager.hasOriginalBackup();

    // Roblox considers > 60 unlocked, target is 9999
    const isUnlocked = currentFps !== null && currentFps >= 9999;

    return {
      installed: true,
      configFound: true,
      configPath: detection.configPath,
      robloxRunning: detection.running,
      robloxVersion: detection.version,
      currentFps,
      isUnlocked,
      targetFps: DEFAULT_TARGET_FPS,
      status: 'valid',
      backupAvailable: hasBackup,
      summary,
      error: null,
    };
  } catch (err) {
    return {
      installed: true,
      configFound: true,
      configPath: detection.configPath,
      robloxRunning: detection.running,
      robloxVersion: detection.version,
      currentFps: null,
      isUnlocked: false,
      targetFps: DEFAULT_TARGET_FPS,
      status: 'invalid',
      backupAvailable: backupManager.hasOriginalBackup(),
      error: err.message,
    };
  }
}

/**
 * Unlocks Roblox FPS to 9999 with validation, backup, and change journal recording.
 *
 * @param {number} [targetFps=9999]
 */
async function unlockFps(targetFps = DEFAULT_TARGET_FPS) {
  if (!Number.isInteger(targetFps) || targetFps < 1 || targetFps > 9999) {
    throw new Error('Target FPS must be an integer between 1 and 9999.');
  }
  logger.info(`Starting FPS unlock procedure targeting ${targetFps} FPS...`);

  const detection = await robloxDetector.detectRoblox();

  if (!detection.installed) {
    throw new Error('Roblox installation directory was not detected in %LOCALAPPDATA%\\Roblox.');
  }

  if (!detection.configExists || !detection.configPath) {
    throw new Error(`Roblox configuration file not found at: ${detection.configPath}`);
  }

  // 1. Read current value and validate current file
  const rawXml = xmlConfig.readConfigFile(detection.configPath);
  const originalFps = xmlConfig.extractFpsFromXml(rawXml);

  // 2. Ensure pristine original backup is safely stored
  if (!backupManager.hasOriginalBackup()) {
    backupManager.createOriginalBackup(detection.configPath);
  }

  // 3. Create snapshot backup before this modification
  const snapshot = backupManager.createSnapshotBackup(detection.configPath, 'fps');

  // 4. Update XML to target FPS
  xmlConfig.updateFpsInXml(detection.configPath, targetFps, fs.readFileSync(snapshot.path, 'utf8'));

  // 5. Verify the modification
  const postStatus = await getFpsStatus();
  if (postStatus.currentFps !== targetFps) {
    throw new Error(`Verification failed: Expected ${targetFps} FPS, but read back ${postStatus.currentFps}`);
  }

  // 6. Record to change journal
  changeJournal.addEntry({
    category: 'fps',
    key: 'GlobalBasicSettings_13.xml/FramerateCap',
    originalValue: originalFps,
    modifiedValue: targetFps,
    status: 'applied',
    description: `Unlocked Roblox FramerateCap from ${originalFps} to ${targetFps} FPS`,
  });

  logger.info(`FPS successfully unlocked to ${targetFps}!`);

  return {
    success: true,
    previousFps: originalFps,
    currentFps: postStatus.currentFps,
    targetFps,
    isUnlocked: postStatus.isUnlocked,
    configStatus: postStatus.status,
    robloxRunning: detection.running,
    backupPath: snapshot.path,
    originalBackupAvailable: true,
    configPath: detection.configPath,
  };
}

module.exports = {
  getFpsStatus,
  unlockFps,
  DEFAULT_TARGET_FPS,
};
