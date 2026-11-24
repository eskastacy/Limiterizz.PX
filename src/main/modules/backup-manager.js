'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { XMLValidator } = require('fast-xml-parser');
const logger = require('../utils/logger');

const BACKUP_DIR = path.join(process.env.APPDATA || '', 'LimiterizzPX', 'backups');
const ORIGINAL_BACKUP_NAME = 'original_backup.xml';

function copyVerified(source, destination, allowDamagedXml = false) {
  const bytes = fs.readFileSync(source);
  if (!allowDamagedXml && XMLValidator.validate(bytes.toString('utf8')) !== true) {
    throw new Error('Source XML is invalid. No configuration changes were made.');
  }
  fs.writeFileSync(destination, bytes, { flag: 'wx' });
  if (!fs.readFileSync(destination).equals(bytes)) {
    throw new Error('Backup verification failed. No configuration changes were made.');
  }
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getOriginalBackupPath() {
  return path.join(BACKUP_DIR, ORIGINAL_BACKUP_NAME);
}

function hasOriginalBackup() {
  return verifyBackup(getOriginalBackupPath()).valid;
}

/**
 * Creates the permanent pristine original backup if it does not exist yet.
 * Once created, it is NEVER overwritten.
 */
function createOriginalBackup(sourcePath) {
  ensureBackupDir();
  const originalPath = getOriginalBackupPath();

  if (fs.existsSync(originalPath)) {
    const check = verifyBackup(originalPath);
    if (!check.valid) throw new Error(`Original backup is invalid: ${check.error}. No files were changed.`);
    logger.info('Original backup already exists, preserving it.');
    return { created: false, path: originalPath, reason: 'Already exists' };
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Cannot create original backup: Source file not found at ${sourcePath}`);
  }

  const content = fs.readFileSync(sourcePath, 'utf8');
  const valid = XMLValidator.validate(content);
  if (valid !== true) {
    throw new Error('Cannot create original backup from corrupted source XML');
  }

  copyVerified(sourcePath, originalPath);
  logger.info(`Original backup created at: ${originalPath}`);

  return { created: true, path: originalPath };
}

/**
 * Creates a timestamped snapshot backup before modifying.
 * @param {string} sourcePath
 * @param {'fps'|'optimization'|'pre-restore'|'manual'} category
 */
function createSnapshotBackup(sourcePath, category = 'fps') {
  ensureBackupDir();

  // First ensure original backup exists
  if (!hasOriginalBackup()) {
    createOriginalBackup(sourcePath);
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Cannot create snapshot: Source file not found at ${sourcePath}`);
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `snapshot_${category}_${timestamp}_${crypto.randomUUID()}.xml`;
  const destPath = path.join(BACKUP_DIR, filename);

  copyVerified(sourcePath, destPath, category === 'pre-restore');
  logger.info(`Snapshot backup created: ${destPath}`);

  return {
    filename,
    path: destPath,
    category,
    timestamp: now.toISOString(),
  };
}

/**
 * Verifies backup file integrity: file exists, readable, valid XML, non-zero length.
 */
function verifyBackup(backupPath) {
  try {
    if (!fs.existsSync(backupPath)) {
      return { valid: false, error: 'Backup file does not exist' };
    }
    const stats = fs.statSync(backupPath);
    if (stats.size === 0) {
      return { valid: false, error: 'Backup file is 0 bytes' };
    }

    const content = fs.readFileSync(backupPath, 'utf8');
    const valid = XMLValidator.validate(content);
    if (valid !== true) {
      return { valid: false, error: 'Backup file contains invalid XML' };
    }

    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return { valid: true, size: stats.size, sha256: hash };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Lists all available backups with metadata.
 */
function listBackups() {
  ensureBackupDir();
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backups = [];

    for (const file of files) {
      if (!file.endsWith('.xml')) continue;
      const fullPath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(fullPath);
      const isOriginal = file === ORIGINAL_BACKUP_NAME;

      backups.push({
        filename: file,
        path: fullPath,
        isOriginal,
        size: stat.size,
        createdAt: stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
      });
    }

    // Sort: original first, then newest first
    backups.sort((a, b) => {
      if (a.isOriginal) return -1;
      if (b.isOriginal) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return backups;
  } catch (err) {
    logger.error(`Error listing backups: ${err.message}`);
    return [];
  }
}

/**
 * Restores a backup to target path using atomic file replacement.
 */
function restoreFromBackup(backupPath, targetPath) {
  const verification = verifyBackup(backupPath);
  if (!verification.valid) {
    throw new Error(`Cannot restore from invalid backup: ${verification.error}`);
  }

  // Write to temporary file in target directory first
  const tempTarget = `${targetPath}.${crypto.randomUUID()}.restore.tmp`;
  try {
    copyVerified(backupPath, tempTarget);
    fs.renameSync(tempTarget, targetPath);
  } catch (err) {
    if (fs.existsSync(tempTarget)) {
      try { fs.unlinkSync(tempTarget); } catch {}
    }
    throw new Error(`Restore atomic write failed: ${err.message}`);
  }

  logger.info(`Successfully restored from ${backupPath} to ${targetPath}`);
  return { success: true, targetPath, backupPath };
}

module.exports = {
  ensureBackupDir,
  getOriginalBackupPath,
  hasOriginalBackup,
  createOriginalBackup,
  createSnapshotBackup,
  verifyBackup,
  listBackups,
  restoreFromBackup,
};
