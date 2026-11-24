'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Checks if XML content is well-formed by attempting a basic parse.
 */
function validateXml(content) {
  try {
    if (typeof content !== 'string' || content.trim().length === 0) {
      return { valid: false, error: 'Content is empty or not a string' };
    }

    // Check for basic XML structure
    const trimmed = content.trim();
    if (!trimmed.startsWith('<')) {
      return { valid: false, error: 'Content does not start with XML tag' };
    }

    // Use fast-xml-parser for validation
    const { XMLValidator } = require('fast-xml-parser');
    const result = XMLValidator.validate(content);

    if (result === true) {
      return { valid: true, error: null };
    }

    return {
      valid: false,
      error: result.err ? `${result.err.msg} at line ${result.err.line}` : 'Invalid XML',
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Checks if value is a valid FPS integer between 1 and 9999.
 */
function validateFpsValue(value) {
  try {
    const num = parseInt(value, 10);

    if (isNaN(num)) {
      return { valid: false, error: 'Value is not a number' };
    }
    if (!Number.isInteger(num)) {
      return { valid: false, error: 'Value must be an integer' };
    }
    if (num < 1 || num > 9999) {
      return { valid: false, error: 'Value must be between 1 and 9999' };
    }

    return { valid: true, error: null, value: num };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Checks if a file path exists and is accessible.
 */
function validateFilePath(filePath) {
  try {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      return { valid: false, error: 'Path is empty or not a string' };
    }

    const resolved = path.resolve(filePath);

    if (!fs.existsSync(resolved)) {
      return { valid: false, error: 'File does not exist', path: resolved };
    }

    // Check read access
    fs.accessSync(resolved, fs.constants.R_OK);

    const stats = fs.statSync(resolved);
    return {
      valid: true,
      error: null,
      path: resolved,
      size: stats.size,
      isFile: stats.isFile(),
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Compares file integrity between a backup and original by computing SHA-256 hashes.
 */
function validateBackup(backupPath, originalPath) {
  try {
    const backupCheck = validateFilePath(backupPath);
    if (!backupCheck.valid) {
      return { valid: false, error: `Backup file: ${backupCheck.error}`, match: false };
    }

    const originalCheck = validateFilePath(originalPath);
    if (!originalCheck.valid) {
      return { valid: false, error: `Original file: ${originalCheck.error}`, match: false };
    }

    const backupContent = fs.readFileSync(backupPath);
    const originalContent = fs.readFileSync(originalPath);

    const backupHash = crypto.createHash('sha256').update(backupContent).digest('hex');
    const originalHash = crypto.createHash('sha256').update(originalContent).digest('hex');

    const match = backupHash === originalHash;

    return {
      valid: true,
      error: null,
      match,
      backupHash,
      originalHash,
      backupSize: backupContent.length,
      originalSize: originalContent.length,
    };
  } catch (err) {
    return { valid: false, error: err.message, match: false };
  }
}

module.exports = {
  validateXml,
  validateFpsValue,
  validateFilePath,
  validateBackup,
};
