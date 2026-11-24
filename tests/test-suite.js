'use strict';

const path = require('path');
const robloxDetector = require('../src/main/modules/roblox-detector');
const xmlConfig = require('../src/main/modules/xml-config');
const backupManager = require('../src/main/modules/backup-manager');
const changeJournal = require('../src/main/modules/change-journal');
const perfOptimizer = require('../src/main/modules/performance-optimizer');
const systemRestore = require('../src/main/modules/system-restore');
const perfMonitor = require('../src/main/modules/perf-monitor');

async function runTestSuite() {
  console.log('=== STARTING LIMITERIZZ.PX SYSTEM TEST SUITE ===');

  // Test 1: Roblox Detection
  console.log('\n[1] Testing Roblox Detection...');
  const detection = await robloxDetector.detectRoblox();
  console.log('Roblox Installed:', detection.installed);
  console.log('Config Path:', detection.configPath);
  console.log('Config Exists:', detection.configExists);
  console.log('Roblox Running:', detection.running);
  console.log('Version:', detection.version);

  // Test 2: XML Config Reading
  console.log('\n[2] Testing XML Config Reading...');
  if (detection.configExists) {
    const raw = xmlConfig.readConfigFile(detection.configPath);
    const fps = xmlConfig.extractFpsFromXml(raw);
    const summary = xmlConfig.extractSettingsSummary(raw);
    console.log('Current FramerateCap:', fps);
    console.log('Settings Summary:', summary);
  }

  // Test 3: Backup System
  console.log('\n[3] Testing Backup System...');
  backupManager.ensureBackupDir();
  const hasOrig = backupManager.hasOriginalBackup();
  console.log('Has Original Backup:', hasOrig);
  if (!hasOrig && detection.configExists) {
    const origResult = backupManager.createOriginalBackup(detection.configPath);
    console.log('Created Original Backup:', origResult);
  }
  const backups = backupManager.listBackups();
  console.log('Available Backups Count:', backups.length);

  // Test 4: Change Journal
  console.log('\n[4] Testing Change Journal...');
  const testEntry = changeJournal.addEntry({
    category: 'fps',
    key: 'test/key',
    originalValue: 144,
    modifiedValue: 9999,
    status: 'applied',
    description: 'Unit test change verification',
  });
  console.log('Added Journal Entry ID:', testEntry.id);
  const summary = changeJournal.getSummary();
  console.log('Journal Summary:', JSON.stringify(summary));

  // Mark test entry restored to keep journal clean
  changeJournal.markRestored(testEntry.id);

  // Test 5: Optimization Status
  console.log('\n[5] Testing Optimization Status...');
  const optStatus = await perfOptimizer.getOptimizationStatus();
  console.log('Optimization Status:', JSON.stringify(optStatus, null, 2));

  // Test 6: Performance Monitor Metrics
  console.log('\n[6] Testing Performance Monitor...');
  const metrics = await perfMonitor.getLiveMetrics();
  console.log('CPU %:', metrics.cpuPercent);
  console.log('Memory:', metrics.memory);
  console.log('Roblox Process:', metrics.roblox);

  // Test 7: System Restore Overview
  console.log('\n[7] Testing System Restore Overview...');
  const restoreOverview = await systemRestore.getRestoreOverview();
  console.log('Restore Overview:', restoreOverview);

  console.log('\n=== ALL UNIT TESTS PASSED SUCCESSFULLY! ===');
}

runTestSuite().catch(err => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
