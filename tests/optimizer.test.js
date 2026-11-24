'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const reg = require('../src/main/utils/registry');
const journal = require('../src/main/modules/change-journal');
const logger = require('../src/main/utils/logger');
const opt = require('../src/main/modules/performance-optimizer');
const restore = require('../src/main/modules/system-restore');
const { settings } = require('../src/main/modules/performance-settings');

function isolate(t) {
  // No test in this suite may launch a process or access the real journal.
  t.mock.method(cp, 'execFile', () => assert.fail('Unexpected process launch'));
  for (const method of ['getUnrestoredEntries', 'addEntry', 'markRestored', 'markApplyFailed']) {
    t.mock.method(journal, method, () => assert.fail(`Unexpected ${method}`));
  }
  for (const method of ['error', 'info', 'warn']) t.mock.method(logger, method, () => {});
}
test.beforeEach(isolate);

for (const fail of [false, true]) {
  test(`GameDVR records both originals; second write failure = ${fail}`, async t => {
    const events = [];
    const entries = [];
    t.mock.method(journal, 'addEntry', entry => { events.push('journal'); entries.push(entry); return { id: entries.length }; });
    t.mock.method(journal, 'markApplyFailed', id => events.push(`failed:${id}`));
    t.mock.method(reg, 'getRegistryValue', async (_, name) => name === 'GameDVR_Enabled' ? { found: false } : { found: true, type: 'REG_DWORD', value: 1 });
    t.mock.method(reg, 'setRegistryValue', async (_, name) => {
      events.push('write'); return { success: !(fail && name === 'GameDVR_Enabled'), error: 'denied' };
    });
    const result = await opt.optimizeGameDvr();
    assert.equal(result.success, !fail);
    assert.equal(result.partial, fail);
    assert.deepEqual(entries.map(e => e.originalValue), [1, null]);
    assert.deepEqual(events, ['journal', 'write', 'journal', 'write', ...(fail ? ['failed:2'] : [])]);
  });
}

test('a failed snapshot read or journal save prevents the registry write', async t => {
  const write = t.mock.method(reg, 'setRegistryValue', assert.fail);
  const get = t.mock.method(reg, 'getRegistryValue', async () => ({ found: false, error: 'denied' }));
  assert.equal((await opt.optimizeCpuPriority()).error, 'denied');
  get.mock.mockImplementation(async () => ({ found: false }));
  t.mock.method(journal, 'addEntry', () => { throw new Error('disk full'); });
  assert.equal((await opt.optimizeCpuPriority()).error, 'disk full');
  assert.equal(write.mock.callCount(), 0);
});

test('registry queries accept literal GPU path names and preserve the data', async t => {
  const exe = 'C:\\Users\\A & B (1)\\version-123\\RobloxPlayerBeta.exe';
  t.mock.method(cp, 'execFile', (file, args, options, cb) => {
    assert.equal(file, 'reg.exe');
    assert.deepEqual(args, ['query', 'HKCU\\Example', '/v', exe]);
    assert.ok(!options.shell);
    cb(null, `\r\nHKCU\\Example\r\n    ${exe}    REG_SZ    GpuPreference=2;\r\n`, '');
  });
  assert.deepEqual(await reg.getRegistryValue('HKCU\\Example', exe), { found: true, type: 'REG_SZ', value: 'GpuPreference=2;' });
});

test('refuses to change a power plan when the original GUID cannot be read', async t => {
  const power = t.mock.method(reg, 'runWindowsTool', async () => ({ success: false, output: '' }));
  assert.equal((await opt.optimizePowerPlan()).success, false);
  assert.equal(power.mock.callCount(), 1);
});

test('a failed undo blocks older entries until a retry succeeds in reverse application order', async t => {
  const s = settings.cpu;
  const key = `${s.key}\\${s.valueName}`;
  const queue = [2, 1].map(id => ({ id, category: 'cpu', key, originalValue: id }));
  t.mock.method(journal, 'getUnrestoredEntries', () => queue.slice());
  t.mock.method(journal, 'markRestored', id => { queue.splice(queue.findIndex(e => e.id === id), 1); return true; });
  let deny = true;
  const values = [];
  t.mock.method(reg, 'setRegistryValue', async (_, __, ___, value) => { values.push(value); return { success: !deny, error: 'denied' }; });
  assert.equal((await restore.restoreCategory('cpu')).restoredCount, 0);
  assert.equal(queue.length, 2);
  deny = false;
  assert.equal((await restore.restoreCategory('cpu')).restoredCount, 2);
  assert.deepEqual(values, [2, 2, 1]);
  assert.equal(queue.length, 0);
});

test('unknown keys, malformed power plan GUIDs, and wildcard categories are rejected', async t => {
  t.mock.method(journal, 'getUnrestoredEntries', () => [
    { id: 'a', category: 'windows', key: 'HKLM\\Unknown\\value', originalValue: 1 },
    { id: 'b', category: 'windows', key: 'PowerScheme/ActiveGUID', originalValue: 'invalid' },
  ]);
  const r = await restore.restoreCategory('windows');
  assert.deepEqual(r.details.map(e => e.error), ['Unrecognized registry target.', 'Invalid original power scheme GUID.']);
  await assert.rejects(restore.restoreCategory('all'), /Unknown/);
  await assert.rejects(restore.restoreSelected(['cpu', null]), /Unknown/);
});
