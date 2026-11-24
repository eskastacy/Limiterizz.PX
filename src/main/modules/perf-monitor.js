'use strict';

const os = require('os');
const { exec } = require('child_process');

let lastCpuTimes = null;
let lastCpuUsageValue = 0;

function getCpuUsage() {
  return new Promise((resolve) => {
    try {
      const cpus = os.cpus();
      if (!cpus || cpus.length === 0) return resolve(0);

      const currentIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
      const currentTotal = cpus.reduce((acc, cpu) => acc + Object.values(cpu.times).reduce((a, b) => a + b, 0), 0);

      if (!lastCpuTimes) {
        lastCpuTimes = { idle: currentIdle, total: currentTotal };
        return resolve(lastCpuUsageValue);
      }

      const idleDelta = currentIdle - lastCpuTimes.idle;
      const totalDelta = currentTotal - lastCpuTimes.total;
      lastCpuTimes = { idle: currentIdle, total: currentTotal };

      if (totalDelta > 0) {
        const percentage = Math.round((1 - idleDelta / totalDelta) * 100);
        lastCpuUsageValue = Math.max(0, Math.min(100, percentage));
      }
      resolve(lastCpuUsageValue);
    } catch {
      resolve(lastCpuUsageValue);
    }
  });
}

function getMemoryUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const percentage = Math.round((used / total) * 100);

  return {
    totalGb: (total / (1024 ** 3)).toFixed(1),
    usedGb: (used / (1024 ** 3)).toFixed(1),
    freeGb: (free / (1024 ** 3)).toFixed(1),
    percentage,
  };
}

let cachedRobloxStats = { running: false, memoryMb: 0, pid: null };
let lastRobloxCheckTime = 0;
const ROBLOX_CACHE_TTL_MS = 3500;

function getRobloxProcessStats() {
  const now = Date.now();
  if (now - lastRobloxCheckTime < ROBLOX_CACHE_TTL_MS) {
    return Promise.resolve(cachedRobloxStats);
  }

  return new Promise((resolve) => {
    // Check if RobloxPlayerBeta.exe is running and get memory
    exec('tasklist /FI "IMAGENAME eq RobloxPlayerBeta.exe" /FO CSV /NH', { windowsHide: true }, (err, stdout) => {
      lastRobloxCheckTime = Date.now();
      if (err || !stdout || !stdout.toLowerCase().includes('robloxplayerbeta.exe')) {
        cachedRobloxStats = { running: false, memoryMb: 0, pid: null };
        return resolve(cachedRobloxStats);
      }

      try {
        const parts = stdout.trim().split('","');
        const pid = parts[1] ? parts[1].replace(/"/g, '') : null;
        const memStr = parts[4] ? parts[4].replace(/[",\sK]/g, '') : '0';
        const memMb = Math.round(parseInt(memStr, 10) / 1024);

        cachedRobloxStats = {
          running: true,
          pid,
          memoryMb: memMb,
        };
        return resolve(cachedRobloxStats);
      } catch {
        cachedRobloxStats = { running: true, memoryMb: 0, pid: null };
        return resolve(cachedRobloxStats);
      }
    });
  });
}

async function getLiveMetrics() {
  const [cpuPercent, memUsage, robloxStats] = await Promise.all([
    getCpuUsage(),
    Promise.resolve(getMemoryUsage()),
    getRobloxProcessStats(),
  ]);

  return {
    timestamp: new Date().toISOString(),
    cpuPercent,
    memory: memUsage,
    roblox: robloxStats,
    cpuCount: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Processor',
  };
}

module.exports = {
  getLiveMetrics,
  getCpuUsage,
  getMemoryUsage,
  getRobloxProcessStats,
};
