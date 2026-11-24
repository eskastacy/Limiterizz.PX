'use strict';

const registry = require('../utils/registry');
const journal = require('./change-journal');
const { settings, findGpuSetting, highPower, guid } = require('./performance-settings');

// Preserve a recovery record before touching Windows, including if the app exits mid-command.
async function recordedWrite(name, record, write) {
  try {
    const entry = journal.addEntry({ ...record, description: name });
    const result = await write();
    if (!result.success) {
      journal.markApplyFailed(entry.id);
      return { success: false, name, error: result.error };
    }
    return { success: true, name, previousValue: record.originalValue, newValue: record.modifiedValue };
  } catch (err) { return { success: false, name, error: err.message }; }
}

async function apply(s) {
  const prev = await registry.getRegistryValue(s.key, s.valueName);
  if (prev.error || (prev.found && prev.type !== s.type)) {
    return { success: false, name: s.name, error: prev.error || 'Unexpected registry type; value was not changed.' };
  }
  if (prev.found && prev.value === s.target) return { success: true, name: s.name, unchanged: true };
  return recordedWrite(s.name, {
    category: s.category, key: `${s.key}\\${s.valueName}`,
    originalValue: prev.found ? prev.value : null, modifiedValue: s.target,
  }, () => registry.setRegistryValue(s.key, s.valueName, s.type, s.target));
}

async function optimizeGpuPreference() {
  const setting = findGpuSetting();
  return setting ? apply(setting) : { success: false, name: 'GPU Preference Selection', error: 'Roblox player executable was not found.' };
}

async function readPowerPlan() {
  const result = await registry.runWindowsTool('powercfg.exe', ['/getactivescheme']);
  return result.success ? result.output.split(/\s+/).find(token => guid.test(token))?.toLowerCase() : null;
}

async function optimizePowerPlan() {
  const name = 'Windows Power Plan';
  const previous = await readPowerPlan();
  if (!previous) return { success: false, name, error: 'Cannot determine the current power plan.' };
  if (previous === highPower) return { success: true, name, unchanged: true };
  return recordedWrite(name, {
    category: 'windows', key: 'PowerScheme/ActiveGUID', originalValue: previous, modifiedValue: highPower,
  }, () => registry.runWindowsTool('powercfg.exe', ['/setactive', highPower]));
}

async function optimizeGameDvr() {
  const name = 'Disable GameDVR Overhead';
  const first = await apply(settings.capture);
  if (!first.success) return { ...first, name };
  const second = await apply(settings.dvr);
  return { ...second, name, partial: !first.unchanged && !second.success, details: [first, second] };
}

const optimizeCpuPriority = () => apply(settings.cpu);
const optimizePowerThrottling = () => apply(settings.io);
const optimizeMemoryPriority = () => apply(settings.ram);
const optimizeGameMode = () => apply(settings.mode);

async function applyAllOptimizations() {
  const results = [];
  for (const action of [optimizeCpuPriority, optimizePowerThrottling, optimizeGpuPreference,
    optimizeMemoryPriority, optimizePowerPlan, optimizeGameMode, optimizeGameDvr]) results.push(await action());
  const successful = results.filter(r => r.success).length;
  return { success: successful === results.length, total: results.length, successful, results };
}

async function isApplied(s) {
  if (!s) return false;
  const r = await registry.getRegistryValue(s.key, s.valueName);
  return r.found === true && r.type === s.type && r.value === s.target;
}

async function getOptimizationStatus() {
  const [cpu, io, ram, mode, capture, dvr, gpu, power] = await Promise.all([
    ...[settings.cpu, settings.io, settings.ram, settings.mode, settings.capture, settings.dvr].map(isApplied),
    isApplied(findGpuSetting()), readPowerPlan(),
  ]);
  return {
    cpu: { priorityApplied: cpu, powerThrottlingDisabled: io },
    gpu: { configured: gpu }, ram: { pagePriorityApplied: ram },
    windows: { highPerformancePlan: power === highPower, gameModeEnabled: mode, gameDvrDisabled: capture && dvr },
  };
}

module.exports = { optimizeCpuPriority, optimizePowerThrottling, optimizeGpuPreference, optimizeMemoryPriority,
  optimizePowerPlan, optimizeGameMode, optimizeGameDvr, applyAllOptimizations, getOptimizationStatus };
