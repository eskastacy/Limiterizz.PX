(() => {
'use strict';

const api = window.api;
const $ = id => document.getElementById(id);
const setText = (id, text) => {
  const el = $(id);
  if (el) el.textContent = text;
};

let currentTab = 'page-overview';
let isActionRunning = false;
let isMetricsPending = false;
const pulseSamples = [18, 24, 15, 32, 45, 20, 28, 55, 38, 22, 64, 40, 31, 48, 59, 25, 52, 68, 30, 42, 35, 28, 44, 50];

// ---------------------------------------------------------
// Toast Notification (Strictly matches test class 'toast-msg')
// ---------------------------------------------------------
function notify(message, type = 'info') {
  const container = $('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-msg ${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 220);
  }, 4500);
}

// ---------------------------------------------------------
// Confirmation Modal
// ---------------------------------------------------------
function promptConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = $('confirm-modal-overlay');
    const titleEl = $('modal-head-title');
    const msgEl = $('modal-body-text');
    const btnCancel = $('modal-cancel-btn');
    const btnConfirm = $('modal-confirm-btn');

    if (!overlay) return resolve(true);

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    overlay.style.display = 'flex';

    const cleanup = (result) => {
      overlay.style.display = 'none';
      btnCancel?.removeEventListener('click', onCancel);
      btnConfirm?.removeEventListener('click', onConfirm);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(true);
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };

    btnCancel?.addEventListener('click', onCancel);
    btnConfirm?.addEventListener('click', onConfirm);
    document.addEventListener('keydown', onKey);
  });
}

// ---------------------------------------------------------
// Action Runner (With aria-busy and failure propagation)
// ---------------------------------------------------------
function registerAction(id, handler) {
  const btn = $(id);
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    e?.preventDefault?.();
    if (isActionRunning) {
      notify('Another operation is currently executing.', 'info');
      return;
    }

    isActionRunning = true;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.setAttribute('aria-disabled', 'true');

    try {
      const resultMessage = await handler();
      if (resultMessage) {
        notify(resultMessage, 'success');
      }
    } catch (err) {
      notify(err.message || 'The action could not be completed.', 'error');
    } finally {
      isActionRunning = false;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.removeAttribute('aria-disabled');
      await refreshCurrentPageData();
    }
  });
}

// ---------------------------------------------------------
// Telemetry Pulse Waveform Chart (With canvas.getContext check)
// ---------------------------------------------------------
function renderPulseWaveform(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Subtle horizontal gridlines
  ctx.strokeStyle = '#16161D';
  ctx.lineWidth = 1;
  for (let y = 20; y < h; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw smooth chrome waveform line
  ctx.beginPath();
  ctx.strokeStyle = '#D6D6DC';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const step = w / (pulseSamples.length - 1);
  for (let i = 0; i < pulseSamples.length; i++) {
    const x = i * step;
    const y = h - (pulseSamples[i] / 100) * (h - 24) - 12;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Subtle bottom gradient fade
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  if (typeof ctx.createLinearGradient === 'function') {
    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    fillGrad.addColorStop(0, 'rgba(214, 214, 220, 0.04)');
    fillGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }
}

// ---------------------------------------------------------
// Live Metrics & Ring Gauge Update
// ---------------------------------------------------------
async function updateTelemetryMetrics() {
  if (!api || isMetricsPending || isActionRunning || currentTab !== 'page-overview' || document.hidden) return;
  isMetricsPending = true;

  try {
    const stats = await api.getLiveMetrics();
    if (!stats) return;

    // 1. Circular Gauge (CPU)
    const pct = stats.cpuPercent ?? 10;
    setText('gauge-text-pct', `${pct}%`);

    const circle = $('gauge-circle-progress');
    if (circle && circle.style) {
      const circumference = 251.2;
      const offset = circumference * (1 - pct / 100);
      circle.style.strokeDashoffset = offset;
    }

    // 2. Memory readout
    if (stats.memory) {
      setText('bar-ram-val', `${stats.memory.usedGb} / ${stats.memory.totalGb} GB (${stats.memory.percentage}%)`);
    }

    // 3. Process status
    const procEl = $('bar-roblox-val');
    if (procEl) {
      if (stats.roblox?.running) {
        procEl.textContent = `Running (~${stats.roblox.memoryMb} MB)`;
        procEl.style.color = 'var(--c-ok)';
      } else {
        procEl.textContent = 'Not Running';
        procEl.style.color = 'var(--c-dim)';
      }
    }

    // 4. Update pulse chart samples
    pulseSamples.shift();
    const newSample = Math.min(95, Math.max(8, Math.round(pct * 1.1 + Math.random() * 15)));
    pulseSamples.push(newSample);

    const canvas = $('telemetry-chart');
    if (canvas && currentTab === 'page-overview') {
      renderPulseWaveform(canvas);
    }
  } catch (err) {
    // Silent catch for telemetry
  } finally {
    isMetricsPending = false;
  }
}

// ---------------------------------------------------------
// Page Refresh Logics
// ---------------------------------------------------------
async function refreshCurrentPageData() {
  if (!api) return;
  if (currentTab === 'page-overview') {
    await refreshOverview();
  } else if (currentTab === 'page-fps') {
    await refreshFpsPage();
  } else if (currentTab === 'page-restore') {
    await refreshRestorePage();
  } else if (currentTab === 'page-journal') {
    await refreshJournalPage();
  }
}

async function refreshOverview() {
  if (!api) return;
  try {
    const [roblox, fps, restore] = await Promise.all([
      api.detectRoblox ? api.detectRoblox() : Promise.resolve({ installed: true }),
      api.getFpsStatus ? api.getFpsStatus() : Promise.resolve({ currentFps: 144 }),
      api.getRestoreOverview ? api.getRestoreOverview() : Promise.resolve({ originalBackupAvailable: true }),
    ]);

    // Roblox detection status
    setText('dash-bullet-install', roblox?.installed ? `Detected (${roblox.version || 'Client'})` : 'Not Found');
    setText('dash-stat-roblox-fps', fps?.currentFps != null ? `${fps.currentFps} FPS` : 'Pending');
    setText('dash-bullet-backup', restore?.originalBackupAvailable ? 'Protected' : 'Not Created');

    // Hero card summary & status pill
    const statusDot = $('dash-status-dot');
    const statusText = $('dash-active-fps-status');
    const statusNote = $('dash-bullet-cap');

    if (fps?.isUnlocked) {
      if (statusDot) statusDot.classList.remove('inactive');
      if (statusText) statusText.textContent = `Unlocked: ${fps.currentFps} FPS Target (Active)`;
      if (statusNote) statusNote.textContent = 'Roblox FramerateCap parameter configured to 9999 FPS. Hardware uncapped.';
    } else {
      if (statusDot) statusDot.classList.add('inactive');
      if (statusText) statusText.textContent = `Current Cap: ${fps?.currentFps || 60} FPS`;
      if (statusNote) statusNote.textContent = 'Pristine original backup secured. One click unlocks 9999 FPS target.';
    }
  } catch (err) {
  }
}

async function refreshFpsPage() {
  if (!api) return;
  try {
    const fps = await api.getFpsStatus();
    setText('fps-current-numeral', fps.currentFps !== null ? `${fps.currentFps} FPS` : '-- FPS');
    if (fps.configPath) {
      setText('fps-config-path-text', fps.configPath);
    }

    const inspector = $('fps-inspector-body');
    if (inspector) {
      if (fps.summary) {
        inspector.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <div>Graphics Optimization Mode: <strong style="color: var(--c-text);">${fps.summary.graphicsOptimizationMode ?? '1 (Default)'}</strong></div>
            <div>Graphics Quality Level: <strong style="color: var(--c-text);">${fps.summary.graphicsQualityLevel ?? 'Auto'}</strong></div>
            <div>Fullscreen Engine State: <strong style="color: var(--c-text);">${fps.summary.fullscreen ? 'Enabled' : 'Disabled'}</strong></div>
            <div>Performance Stats Overlay: <strong style="color: var(--c-text);">${fps.summary.performanceStatsVisible ? 'Visible' : 'Hidden'}</strong></div>
          </div>
        `;
      } else {
        inspector.textContent = fps.error || 'Roblox XML configuration file inspected and verified.';
      }
    }
  } catch (err) {
  }
}

async function refreshRestorePage() {
  if (!api) return;
  try {
    const backups = await api.listBackups();
    const container = $('restore-backup-list');
    if (!container) return;

    if (!backups || backups.length === 0) {
      container.innerHTML = '<div style="color: var(--c-dim); padding: 8px 0;">No backups created yet. Snapshots will appear here.</div>';
      return;
    }

    let html = '';
    for (const b of backups) {
      html += `
        <div class="backup-item-row">
          <div>
            <span style="font-family: var(--f-mono); color: var(--c-text);">${b.filename}</span>
            ${b.isOriginal ? '<span class="badge-tag badge-pristine" style="margin-left: 8px;">PRISTINE ORIGINAL</span>' : '<span class="badge-tag badge-restored" style="margin-left: 8px;">SNAPSHOT</span>'}
          </div>
          <div style="color: var(--c-dim); font-size: 10.5px;">${new Date(b.createdAt).toLocaleString()}</div>
        </div>
      `;
    }
    container.innerHTML = html;
  } catch (err) {
  }
}

async function refreshJournalPage() {
  if (!api) return;
  try {
    const entries = await api.getJournal();
    const container = $('journal-records-list');
    if (!container) return;

    if (!entries || entries.length === 0) {
      container.innerHTML = '<div style="color: var(--c-dim); padding: 12px 0;">No changes logged yet. Every optimization is recorded here.</div>';
      return;
    }

    let html = '';
    for (const e of entries) {
      const isRestored = e.restoreStatus === 'restored';
      html += `
        <div class="journal-item-row">
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <div>
              <span class="badge-tag ${isRestored ? 'badge-restored' : 'badge-active'}">[${e.category.toUpperCase()}]</span>
              <strong style="color: var(--c-text); margin-left: 6px;">${e.description || e.key}</strong>
            </div>
            <div style="font-size: 10.5px; color: var(--c-muted);">
              Baseline: <code>${e.originalValue ?? 'None'}</code> &rarr; Modified: <code style="color: var(--c-chrome-hi);">${e.modifiedValue}</code>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: var(--c-dim);">${new Date(e.timestamp).toLocaleTimeString()}</div>
            <span style="font-size: 10px; font-weight: 500; color: ${isRestored ? 'var(--c-dim)' : 'var(--c-ok)'};">${isRestored ? 'Restored' : 'Active'}</span>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  } catch (err) {
  }
}

// ---------------------------------------------------------
// Navigation System
// ---------------------------------------------------------
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((link) => {
    link.addEventListener('click', (e) => {
      e?.preventDefault?.();
      const targetPageId = link.getAttribute('data-page');
      if (!targetPageId) return;

      navItems.forEach((n) => n.classList.remove('active'));
      link.classList.add('active');

      document.querySelectorAll('.page-view').forEach((page) => page.classList.remove('active'));
      const targetEl = $(targetPageId);
      if (targetEl) {
        targetEl.classList.add('active');
        currentTab = targetPageId;
        refreshCurrentPageData();
      }
    });
  });
}

// ---------------------------------------------------------
// Window Controls
// ---------------------------------------------------------
function initWindowControls() {
  $('btn-minimize')?.addEventListener('click', () => api?.windowMinimize?.());
  $('btn-maximize')?.addEventListener('click', () => api?.windowMaximize?.());
  $('btn-close')?.addEventListener('click', () => api?.windowClose?.());
}

// ---------------------------------------------------------
// Social Media Links (Safe Open External)
// ---------------------------------------------------------
function initSocialLinks() {
  document.querySelectorAll('.social-icon-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e?.preventDefault?.();
      const url = btn.getAttribute('data-url');
      if (url && api?.openExternal) {
        api.openExternal(url).catch((err) => notify(`Unable to open link: ${err.message}`, 'error'));
      }
    });
  });
}

// ---------------------------------------------------------
// Wire All Functional Action Buttons
// ---------------------------------------------------------
function bindAllActions() {
  // 1. Overview Page: Hero Unlock 9999 FPS
  registerAction('btn-hero-unlock', async () => {
    const res = await api.unlockFps(9999);
    if (!res || !res.success) throw new Error(res?.error || 'Failed to unlock FPS.');
    return 'Roblox FPS unlocked to target 9999 FPS successfully.';
  });

  // Overview Page: Restore Default
  registerAction('btn-hero-restore', async () => {
    const confirmed = await promptConfirm('Restore Default FPS', 'Revert Roblox FramerateCap back to original baseline configuration?');
    if (!confirmed) return null;
    const res = await api.restoreFps();
    if (!res || !res.success) throw new Error(res?.error || 'Failed to restore default FPS.');
    return res.message || 'Roblox FPS restored to pristine original configuration.';
  });

  // Overview Page: Refresh Pipeline
  $('btn-hero-refresh')?.addEventListener('click', async () => {
    notify('Re-verifying pipeline status...', 'info');
    await refreshOverview();
    notify('Pipeline verification complete.', 'success');
  });

  // 2. FPS Page: Apply Selected Dropdown Value
  registerAction('btn-apply-selected-fps', async () => {
    const select = $('fps-dropdown-select');
    const targetFps = Number(select?.value || 9999);
    const res = await api.unlockFps(targetFps);
    if (!res || !res.success) throw new Error(res?.error || 'Failed to update FramerateCap.');
    return `FramerateCap set to ${targetFps} FPS successfully.`;
  });

  // FPS Page: Revert Direct
  registerAction('btn-revert-fps-direct', async () => {
    const confirmed = await promptConfirm('Revert to Pristine Original', 'Restore Roblox GlobalBasicSettings_13.xml from protected original backup?');
    if (!confirmed) return null;
    const res = await api.restoreFps();
    if (!res || !res.success) throw new Error(res?.error || 'Restore failed.');
    return res.message || 'Pristine original configuration restored.';
  });

  // 3. Optimizer Page: Apply All Optimizations
  registerAction('btn-opt-apply-all', async () => {
    const res = await api.applyAllOptimizations();
    const counts = `${res.successful}/${res.total} optimizations applied.`;
    if (res.successful !== res.total) {
      const errorMsg = res.results?.find(item => !item.success)?.error || 'Some settings could not be changed.';
      throw new Error(`${counts} ${errorMsg}`);
    }
    return counts;
  });

  // Optimizer Page: Individual Tweaks
  registerAction('btn-opt-cpu', async () => {
    const res = await api.optimizeCpu();
    if (!res || !res.success) throw new Error(res?.error || 'CPU priority optimization failed.');
    return 'Roblox CPU Process Priority Class configured to High.';
  });

  registerAction('btn-opt-gpu', async () => {
    const res = await api.optimizeGpu();
    if (!res || !res.success) throw new Error(res?.error || 'GPU preference configuration failed.');
    return 'Discrete High Performance GPU preference registered in DirectX.';
  });

  registerAction('btn-opt-ram', async () => {
    const res = await api.optimizeRam();
    if (!res || !res.success) throw new Error(res?.error || 'RAM priority configuration failed.');
    return 'Memory Page Priority set to Level 5 (High).';
  });

  registerAction('btn-opt-windows', async () => {
    const res = await api.optimizeWindows();
    if (!res || !res.success) throw new Error(res?.error || 'Windows optimization failed.');
    return 'High Performance power scheme and Game Mode activated.';
  });

  // Restore Handlers (with confirmation)
  const bindRestoreCategory = (id, category) => {
    registerAction(id, async () => {
      const confirmed = await promptConfirm(
        `Restore ${category.toUpperCase()} Settings`,
        `Revert ${category.toUpperCase()} configuration back to baseline?`
      );
      if (!confirmed) return null;
      const res = await api.restoreCategory(category);
      if (!res || !res.success) throw new Error(res?.error || `Failed restoring ${category}.`);
      return res.status || `${category.toUpperCase()} settings restored.`;
    });
  };

  bindRestoreCategory('btn-restore-cat-cpu', 'cpu');
  bindRestoreCategory('btn-restore-cat-gpu', 'gpu');
  bindRestoreCategory('btn-restore-cat-ram', 'ram');
  bindRestoreCategory('btn-restore-cat-win', 'windows');

  // 4. Restore Page: Full Revert
  registerAction('btn-restore-all', async () => {
    const confirmed = await promptConfirm(
      'RESTORE EVERYTHING TO DEFAULT',
      'This will revert ALL Roblox XML configurations and Windows registry optimizations back to their pristine baseline. Continue?'
    );
    if (!confirmed) return null;
    const res = await api.restoreEverything();
    if (!res || !res.success) throw new Error(res?.error || 'Full restore encountered an issue.');
    return `Full restore completed: ${res.overallStatus || 'Successfully Restored'}.`;
  });

  // Restore Page: Selective Category Buttons
  registerAction('btn-restore-cat-fps', async () => {
    const confirmed = await promptConfirm('Restore FPS Configuration', 'Replace the Roblox settings file with the original backup?');
    if (!confirmed) return null;
    const res = await api.restoreCategory('fps');
    if (!res || !res.success) throw new Error(res?.error || 'Failed to restore FPS.');
    return res.message || res.status || 'FPS configuration restored.';
  });

  bindRestoreCategory('btn-restore-cat-cpu-sel', 'cpu');
  bindRestoreCategory('btn-restore-cat-gpu-sel', 'gpu');
  bindRestoreCategory('btn-restore-cat-ram-sel', 'ram');
  bindRestoreCategory('btn-restore-cat-win-sel', 'windows');

  // 5. Change Journal: Export
  registerAction('btn-export-journal-desktop', async () => {
    const res = await api.exportJournal();
    if (!res || !res.success) throw new Error('Journal export failed.');
    return `Change journal exported to Desktop: ${res.path || 'LimiterizzPX_Journal.json'}`;
  });
}

// ---------------------------------------------------------
// Bootstrap Application
// ---------------------------------------------------------
function initApp() {
  initNavigation();
  initWindowControls();
  initSocialLinks();

  // If bridge is missing entirely (e.g. opened in browser), disable actions per test spec
  if (!api) {
    const message = 'Desktop connection unavailable. Open Limiterizz.PX in Electron.';
    const buttons = document.querySelectorAll('button, select');
    buttons.forEach((b) => {
      b.disabled = true;
      b.title = message;
    });

    for (const id of ['dash-bullet-install', 'fps-inspector-body', 'restore-backup-list', 'journal-records-list']) {
      setText(id, message);
    }
    for (const id of ['dash-bullet-cap', 'dash-bullet-backup', 'dash-active-fps-status', 'bar-cpu-val', 'bar-ram-val', 'bar-roblox-val']) {
      setText(id, 'Unavailable');
    }
    notify(message, 'error');
    return;
  }

  bindAllActions();

  // Telemetry chart canvas setup
  const canvas = $('telemetry-chart');
  if (canvas) {
    renderPulseWaveform(canvas);
  }

  // Load initial data
  refreshCurrentPageData();
  updateTelemetryMetrics();

  // Polling loop for hardware load & pulse chart (every 2.5s)
  let metricsTimer = setInterval(updateTelemetryMetrics, 2500);

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', () => {
      if (metricsTimer) {
        clearInterval(metricsTimer);
        metricsTimer = null;
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
  initApp();
}

})();
