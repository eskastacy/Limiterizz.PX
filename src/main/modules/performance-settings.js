'use strict';

const path = require('path').win32;
const fs = require('fs');

const perf = 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\RobloxPlayerBeta.exe\\PerfOptions';
const gpuKey = 'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences';
const highPower = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const guid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

function setting(category, key, valueName, target, name) {
  return { category, key, valueName, target, name, type: category === 'gpu' ? 'REG_SZ' : 'REG_DWORD' };
}

const settings = {
  cpu: setting('cpu', perf, 'CpuPriorityClass', 3, 'CPU Process Priority'),
  io: setting('cpu', perf, 'IoPriority', 3, 'I/O Priority'),
  ram: setting('ram', perf, 'PagePriority', 5, 'Memory Page Priority'),
  mode: setting('windows', 'HKCU\\Software\\Microsoft\\GameBar', 'AutoGameModeEnabled', 1, 'Windows Game Mode'),
  capture: setting('windows', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'AppCaptureEnabled', 0, 'GameDVR App Capture'),
  dvr: setting('windows', 'HKCU\\System\\GameConfigStore', 'GameDVR_Enabled', 0, 'GameDVR Recording'),
};

function versionsDirectory() {
  const local = process.env.LOCALAPPDATA;
  return local && path.isAbsolute(local) ? path.join(local, 'Roblox', 'Versions') : null;
}

function gpuSetting(exe) {
  return setting('gpu', gpuKey, exe, 'GpuPreference=2;', 'GPU Preference Selection');
}

function findGpuSetting() {
  const root = versionsDirectory();
  if (!root) return null;
  try {
    const candidates = [];
    for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
      if (!dir.isDirectory() || !/^version-[\w-]+$/i.test(dir.name)) continue;
      const exe = path.join(root, dir.name, 'RobloxPlayerBeta.exe');
      try {
        const stat = fs.statSync(exe);
        if (stat.isFile()) candidates.push({ exe, time: stat.mtimeMs });
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    candidates.sort((a, b) => b.time - a.time || a.exe.localeCompare(b.exe));
    return candidates.length ? gpuSetting(candidates[0].exe) : null;
  } catch { return null; }
}

function journalSetting(entry) {
  if (typeof entry.key !== 'string') return null;
  if (entry.category !== 'gpu') {
    return Object.values(settings).find(s => s.category === entry.category && `${s.key}\\${s.valueName}` === entry.key);
  }
  if (!entry.key.startsWith(gpuKey + '\\')) return null;
  const exe = entry.key.slice(gpuKey.length + 1);
  // Older releases also wrote this specific relative value name.
  if (exe === 'RobloxPlayerBeta.exe') return gpuSetting(exe);
  const root = versionsDirectory();
  if (!root || !exe.toLowerCase().startsWith(root.toLowerCase() + '\\')) return null;
  return /^version-[\w-]+\\RobloxPlayerBeta\.exe$/i.test(exe.slice(root.length + 1)) ? gpuSetting(exe) : null;
}

module.exports = { settings, findGpuSetting, journalSetting, highPower, guid };
