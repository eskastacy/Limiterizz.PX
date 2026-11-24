'use strict';

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.env.APPDATA || '', 'LimiterizzPX', 'logs');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

let currentLogFile = null;
let logStream = null;
let minLevel = LEVELS.INFO;

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create log directory:', err.message);
  }
}

function getLogFileName() {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return `limiterizz_${stamp}.log`;
}

function rotateIfNeeded() {
  if (!currentLogFile) return;
  try {
    const stats = fs.statSync(currentLogFile);
    if (stats.size >= MAX_FILE_SIZE) {
      if (logStream) {
        logStream.end();
        logStream = null;
      }
      const ext = path.extname(currentLogFile);
      const base = currentLogFile.slice(0, -ext.length);
      const rotated = `${base}_${Date.now()}${ext}`;
      fs.renameSync(currentLogFile, rotated);
      openStream();
    }
  } catch {
    // File might not exist yet: that's fine
  }
}

function openStream() {
  ensureLogDir();
  const fileName = getLogFileName();
  currentLogFile = path.join(LOG_DIR, fileName);
  logStream = fs.createWriteStream(currentLogFile, { flags: 'a' });
  logStream.on('error', (err) => {
    console.error('Log stream error:', err.message);
    logStream = null;
  });
}

function formatTimestamp() {
  return new Date().toISOString();
}

function write(level, message) {
  if (LEVELS[level] < minLevel) return;

  const line = `[${formatTimestamp()}] [${level}] ${message}\n`;

  // Always write to console
  if (level === 'ERROR') {
    console.error(line.trim());
  } else if (level === 'WARN') {
    console.warn(line.trim());
  } else {
    console.log(line.trim());
  }

  // Write to file
  try {
    if (!logStream) {
      openStream();
    }
    rotateIfNeeded();
    if (logStream) {
      logStream.write(line);
    }
  } catch (err) {
    console.error('Failed to write log:', err.message);
  }
}

function info(message) {
  write('INFO', message);
}

function warn(message) {
  write('WARN', message);
}

function error(message) {
  write('ERROR', message);
}

function debug(message) {
  write('DEBUG', message);
}

function setLevel(level) {
  if (LEVELS[level] !== undefined) {
    minLevel = LEVELS[level];
  }
}

function close() {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

function getLogDir() {
  return LOG_DIR;
}

module.exports = {
  info,
  warn,
  error,
  debug,
  setLevel,
  close,
  getLogDir,
  LEVELS,
};
