'use strict';

const childProcess = require('child_process');

function runWindowsTool(executable, args) {
  return new Promise(resolve => {
    childProcess.execFile(executable, args, { windowsHide: true, timeout: 10000 }, (error, stdout, stderr) => {
      resolve({ success: !error, output: stdout || '', error: error ? (stderr || error.message).trim() : null });
    });
  });
}

async function getRegistryValue(keyPath, valueName) {
  const result = await runWindowsTool('reg.exe', ['query', keyPath, '/v', valueName]);
  if (!result.success) {
    // reg.exe uses the same exit code for missing values and access failures.
    // Fail closed for unknown/localized diagnostics rather than lose the original.
    const missing = /unable to find the specified registry key or value/i.test(result.error);
    return { found: false, value: null, type: null, error: missing ? null : result.error };
  }
  for (const row of result.output.split(/\r?\n/)) {
    const text = row.trimStart();
    if (text.slice(0, valueName.length).toLowerCase() !== valueName.toLowerCase()) continue;
    const match = /^\s+(REG_\w+)(?: {4}(.*))?$/i.exec(text.slice(valueName.length));
    if (!match) continue;
    const type = match[1].toUpperCase();
    const raw = match[2] || '';
    if (type === 'REG_DWORD' && !/^0x[\da-f]{1,8}$/i.test(raw)) break;
    return { found: true, type, value: type === 'REG_DWORD' ? Number(raw) : raw };
  }
  return { found: false, error: 'Could not parse registry value.' };
}

function setRegistryValue(keyPath, valueName, type, data) {
  return runWindowsTool('reg.exe', ['add', keyPath, '/v', valueName, '/t', type, '/d', String(data), '/f']);
}

function deleteRegistryValue(keyPath, valueName) {
  return runWindowsTool('reg.exe', ['delete', keyPath, '/v', valueName, '/f']);
}

async function registryKeyExists(keyPath) {
  return (await runWindowsTool('reg.exe', ['query', keyPath])).success;
}

module.exports = { getRegistryValue, setRegistryValue, deleteRegistryValue, registryKeyExists, runWindowsTool };
