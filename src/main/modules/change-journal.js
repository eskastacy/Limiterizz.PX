'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

const DATA_DIR = path.join(process.env.APPDATA || '', 'LimiterizzPX');
const JOURNAL_FILE = path.join(DATA_DIR, 'change-journal.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJournal() {
  ensureDataDir();
  if (!fs.existsSync(JOURNAL_FILE)) {
    return { version: '1.0.0', entries: [] };
  }
  try {
    const raw = fs.readFileSync(JOURNAL_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) {
      return { version: '1.0.0', entries: [] };
    }
    return parsed;
  } catch (err) {
    logger.error(`Error loading journal: ${err.message}. Initializing empty.`);
    return { version: '1.0.0', entries: [] };
  }
}

function saveJournal(data) {
  ensureDataDir();
  const tmpFile = `${JOURNAL_FILE}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.copyFileSync(tmpFile, JOURNAL_FILE);
    fs.unlinkSync(tmpFile);
  } catch (err) {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
    logger.error(`Failed to save change journal: ${err.message}`);
    throw err;
  }
}

/**
 * Adds an entry to the change journal.
 *
 * @param {object} params
 * @param {'fps'|'cpu'|'gpu'|'ram'|'windows'} params.category
 * @param {string} params.key
 * @param {any} params.originalValue
 * @param {any} params.modifiedValue
 * @param {'applied'|'failed'} [params.status='applied']
 * @param {string} [params.description='']
 * @returns {object} The created entry
 */
function addEntry({ category, key, originalValue, modifiedValue, status = 'applied', description = '' }) {
  const journal = loadJournal();

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : `mod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    category,
    key,
    originalValue,
    modifiedValue,
    status,
    restoreStatus: status === 'applied' ? 'pending' : 'not_applicable',
    description,
    restoredAt: null,
  };

  journal.entries.unshift(entry); // Newest first
  saveJournal(journal);
  logger.info(`Journal entry added: [${category}] ${key} (${originalValue} -> ${modifiedValue})`);

  return entry;
}

/**
 * Returns all entries, optionally filtered by category.
 */
function getEntries(category = null) {
  const journal = loadJournal();
  if (!category || category === 'all') {
    return journal.entries;
  }
  return journal.entries.filter(e => e.category === category);
}

/**
 * Returns all entries that have not yet been restored.
 */
function getUnrestoredEntries(category = null) {
  const journal = loadJournal();
  return journal.entries.filter(e => {
    const isPending = e.restoreStatus === 'pending' && e.status === 'applied';
    if (!isPending) return false;
    if (category && category !== 'all') {
      return e.category === category;
    }
    return true;
  });
}

/**
 * Marks an entry as restored.
 */
function markRestored(entryId) {
  const journal = loadJournal();
  const entry = journal.entries.find(e => e.id === entryId);
  if (entry) {
    entry.restoreStatus = 'restored';
    entry.restoredAt = new Date().toISOString();
    saveJournal(journal);
    logger.info(`Journal entry marked restored: ${entryId}`);
    return true;
  }
  return false;
}

/**
 * Gets summary of journal status by category.
 */
function getSummary() {
  const journal = loadJournal();
  const summary = {
    totalModifications: journal.entries.length,
    pendingRestoreCount: 0,
    categories: {
      fps: { applied: 0, pendingRestore: 0 },
      cpu: { applied: 0, pendingRestore: 0 },
      gpu: { applied: 0, pendingRestore: 0 },
      ram: { applied: 0, pendingRestore: 0 },
      windows: { applied: 0, pendingRestore: 0 },
    },
  };

  for (const entry of journal.entries) {
    const cat = summary.categories[entry.category];
    if (cat) {
      if (entry.status === 'applied') {
        cat.applied++;
        if (entry.restoreStatus === 'pending') {
          cat.pendingRestore++;
          summary.pendingRestoreCount++;
        }
      }
    }
  }

  return summary;
}

/**
 * Exports journal to a specific path.
 */
function exportJournal(destPath) {
  const journal = loadJournal();
  fs.writeFileSync(destPath, JSON.stringify(journal, null, 2), 'utf8');
  return { success: true, count: journal.entries.length, path: destPath };
}

function markApplyFailed(entryId) {
  const journal = loadJournal();
  const entry = journal.entries.find(e => e.id === entryId);
  if (!entry) throw new Error('Rollback record missing.');
  entry.status = 'failed';
  entry.restoreStatus = 'not_applicable';
  saveJournal(journal);
}

module.exports = {
  markApplyFailed,
  addEntry,
  getEntries,
  getUnrestoredEntries,
  markRestored,
  getSummary,
  exportJournal,
  JOURNAL_FILE,
};
