'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../utils/logger');

function isRobloxRunning() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq RobloxPlayerBeta.exe" /NH', { windowsHide: true }, (err, stdout) => {
      if (err) {
        return resolve(false);
      }
      const running = stdout.toLowerCase().includes('robloxplayerbeta.exe');
      resolve(running);
    });
  });
}

function findConfigFile() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return null;
  }

  // Primary standard location
  const primaryPath = path.join(localAppData, 'Roblox', 'GlobalBasicSettings_13.xml');
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }

  // Fallback search in Roblox directory for potential newer versions (e.g. _14, _15)
  const robloxDir = path.join(localAppData, 'Roblox');
  if (fs.existsSync(robloxDir)) {
    try {
      const files = fs.readdirSync(robloxDir);
      const match = files.find(f => /^GlobalBasicSettings_\d+\.xml$/i.test(f));
      if (match) {
        return path.join(robloxDir, match);
      }
    } catch (err) {
      logger.warn(`Error scanning Roblox folder: ${err.message}`);
    }
  }

  return primaryPath; // Return standard path even if not yet created
}

function getRobloxVersion() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return 'Unknown';

  const versionsDir = path.join(localAppData, 'Roblox', 'Versions');
  if (!fs.existsSync(versionsDir)) return 'Unknown';

  try {
    const entries = fs.readdirSync(versionsDir, { withFileTypes: true });
    const versionFolders = entries.filter(e => e.isDirectory() && e.name.startsWith('version-'));
    if (versionFolders.length > 0) {
      // Get the latest modified version directory
      versionFolders.sort((a, b) => {
        const statA = fs.statSync(path.join(versionsDir, a.name));
        const statB = fs.statSync(path.join(versionsDir, b.name));
        return statB.mtimeMs - statA.mtimeMs;
      });
      return versionFolders[0].name;
    }
  } catch (err) {
    logger.warn(`Could not determine Roblox version: ${err.message}`);
  }
  return 'Unknown';
}

async function detectRoblox() {
  const localAppData = process.env.LOCALAPPDATA;
  const robloxDir = localAppData ? path.join(localAppData, 'Roblox') : null;
  const installed = robloxDir ? fs.existsSync(robloxDir) : false;
  const configPath = findConfigFile();
  const configExists = configPath ? fs.existsSync(configPath) : false;
  const running = await isRobloxRunning();
  const version = getRobloxVersion();

  return {
    installed,
    robloxDir,
    configPath,
    configExists,
    running,
    version,
  };
}

module.exports = {
  detectRoblox,
  isRobloxRunning,
  findConfigFile,
  getRobloxVersion,
};
