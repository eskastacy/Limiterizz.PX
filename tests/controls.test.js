'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
const renderer = source('renderer/scripts/renderer.js');
const html = source('renderer/index.html');

function harness(overrides, missing = false) {
  function element() {
    const handlers = new Map();
    return {
      style: {}, children: [], attrs: {}, disabled: false, value: '144',
      addEventListener: (type, fn) => handlers.set(type, fn),
      removeEventListener: type => handlers.delete(type),
      fire: type => handlers.get(type)?.({ preventDefault() {} }),
      appendChild(child) { this.children.push(child); },
      setAttribute(name, value) { this.attrs[name] = value; },
      removeAttribute(name) { delete this.attrs[name]; },
      replaceChildren() { this.children = []; }, focus() {},
    };
  }
  const nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], element()]));
  const buttons = [...nodes].filter(([id]) => id.startsWith('btn-')).map(([,el]) => el);
  const document = Object.assign(element(), {
    readyState: 'complete', hidden: true,
    getElementById: id => nodes.get(id), createElement: element,
    querySelectorAll: sel => sel === 'button, select' ? buttons : [],
  });
  const api = { getFpsStatus: async () => ({}), ...overrides };
  const world = { document, setInterval() {}, setTimeout() {} };
  world.window = world;
  // Electron exposes API bindings as non-configurable properties on window itself.
  if (!missing) Object.defineProperty(world, 'api', { value: api, configurable: false });
  vm.runInNewContext(renderer, world);
  return { get: id => nodes.get(id), click: id => nodes.get(id).fire('click'), last: () => nodes.get('toast-container').children.at(-1) };
}

test('desktop controls submit the selected value, surface failure and unlock for retry', async () => {
  const calls = [];
  const h = harness({ unlockFps: async n => { calls.push(n); return {success:true}; }, optimizeCpu: async () => { throw Error('Access denied'); } });
  await h.click('btn-apply-selected-fps');
  await h.click('btn-hero-unlock');
  assert.deepEqual(calls, [144,9999]);
  await h.click('btn-opt-cpu');
  assert.equal(h.last().textContent, 'Access denied');
  assert.equal(h.last().className, 'toast-msg error');
  assert.equal(h.get('btn-opt-cpu').attrs['aria-busy'], undefined);
});

test('partial batches never report success and pending submits are not repeated', async () => {
  let finish, count = 0;
  const h = harness({ applyAllOptimizations: () => { count++; return new Promise(resolve => { finish = resolve; }); } });
  const first = h.click('btn-opt-apply-all');
  await h.click('btn-opt-apply-all');
  assert.equal(count, 1);
  finish({successful:1,total:2,results:[{success:false,error:'Permission denied'}]});
  await first;
  assert.equal(h.last().className, 'toast-msg error');
  assert.match(h.last().textContent, /1\/2.*Permission denied/);
});

test('selective restore waits for confirmation and cancellation performs no write', async () => {
  const calls = [];
  const h = harness({ restoreCategory: async cat => { calls.push(cat); return {success:true}; } });
  const cancel = h.click('btn-restore-cat-gpu');
  h.click('modal-cancel-btn');
  await cancel;
  assert.deepEqual(calls, []);
  const accept = h.click('btn-restore-cat-gpu');
  h.click('modal-confirm-btn');
  await accept;
  assert.deepEqual(calls, ['gpu']);
});

test('a missing bridge disables desktop actions without inventing settings or results', () => {
  const h = harness({}, true);
  assert.equal(h.get('btn-hero-unlock').disabled, true);
  assert.equal(h.get('dash-bullet-cap').textContent, 'Unavailable');
  assert.match(h.last().textContent, /Desktop connection unavailable/);
});

test('every exposed bridge method invokes a registered IPC channel', async () => {
  let api;
  vm.runInNewContext(source('main/preload.js'), { require: () => ({contextBridge:{exposeInMainWorld: (_, value) => { api = value; }},ipcRenderer:{ invoke: async channel => channel }}) });
  const main = source('main/main.js');
  const registered = new Set([...main.matchAll(/ipcMain\.handle\('([^']+)'/g)].map(m => m[1]));
  for (const [method, invoke] of Object.entries(api)) assert.ok(registered.has(await invoke()), method);
});
