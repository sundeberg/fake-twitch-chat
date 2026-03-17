const toggle    = document.getElementById('toggle');
const liveBadge = document.getElementById('live-badge');
const liveText  = document.getElementById('live-text');
const toggleSub = document.getElementById('toggle-sub');

// ── UI helpers ────────────────────────────────────────────

const reloadHint = document.getElementById('reload-hint');

function showReloadHint() {
  reloadHint.style.display = 'block';
}

function shakeReloadHint() {
  reloadHint.style.display = 'block';
  reloadHint.classList.remove('shake');
  void reloadHint.offsetWidth;
  reloadHint.classList.add('shake');
}

function hideReloadHint() {
  reloadHint.style.display = 'none';
  reloadHint.classList.remove('shake');
}

document.getElementById('reload-tab-btn').addEventListener('click', async () => {
  const tab = await getActiveTab();
  chrome.tabs.reload(tab.id);
});

function setUI(enabled) {
  toggle.checked = enabled;
  liveBadge.classList.toggle('active', enabled);
  liveText.textContent  = enabled ? 'Live' : 'Off';
  toggleSub.textContent = enabled ? 'Chat is active on this page' : 'Chat is inactive';
}

// ── Tier selector ─────────────────────────────────────────

const TIER_DESCRIPTIONS = {
  free:     'No API key needed. Hardcoded messages.',
  standard: 'AI-powered. Batched fetches, minimal idle gap.',
  constant: 'AI-powered. Always pre-fetching, no gaps.'
};

function setTierUI(tier) {
  document.querySelectorAll('.tier-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tier === tier);
  });
  document.getElementById('tier-desc').textContent = TIER_DESCRIPTIONS[tier] || '';
}

document.querySelectorAll('.tier-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const tier = btn.dataset.tier;
    setTierUI(tier);
    const tab = await getActiveTab();
    chrome.tabs.sendMessage(tab.id, { type: 'SET_TIER', tier }, () => {
      void chrome.runtime.lastError;
    });
    saveSiteSetting(tab, 'tier', tier);
  });
});

// ── Font size ─────────────────────────────────────────────

function setFontSizeUI(size) {
  document.querySelectorAll('.font-size-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.size) === size);
  });
}

document.querySelectorAll('.font-size-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const fontSize = parseInt(btn.dataset.size);
    setFontSizeUI(fontSize);
    const tab = await getActiveTab();
    chrome.tabs.sendMessage(tab.id, { type: 'SET_FONT_SIZE', fontSize }, () => {
      void chrome.runtime.lastError;
    });
    saveSiteSetting(tab, 'fontSize', fontSize);
  });
});

// ── Per-site settings ─────────────────────────────────────

function getHostname(tab) {
  try { return new URL(tab.url).hostname; } catch { return null; }
}

function saveSiteSetting(tab, key, value) {
  const host = getHostname(tab);
  if (!host) return;
  const storageKey = `site:${host}`;
  chrome.storage.local.get(storageKey, (result) => {
    const settings = result[storageKey] || {};
    settings[key] = value;
    chrome.storage.local.set({ [storageKey]: settings });
  });
}

async function loadSiteSettings(tab) {
  const host = getHostname(tab);
  if (!host) return null;
  return new Promise(resolve => {
    chrome.storage.local.get(`site:${host}`, (result) => {
      resolve(result[`site:${host}`] || null);
    });
  });
}

// ── Init ──────────────────────────────────────────────────

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function applyState(response) {
  hideReloadHint();
  setUI(response.enabled ?? false);
  if (response.mode) document.getElementById('mode-select').value = response.mode;
  if (response.intensity != null) {
    document.getElementById('intensity-slider').value = response.intensity;
    document.getElementById('intensity-value').textContent = response.intensity;
  }
  if (response.tier) setTierUI(response.tier);
  if (response.fontSize) setFontSizeUI(response.fontSize);
  if (response.streamerName) document.getElementById('streamer-name-input').value = response.streamerName;
}

async function initWithRetry(attemptsLeft = 6, delay = 300) {
  const tab = await getActiveTab();

  // Load per-site settings and pre-apply to content script
  const siteSettings = await loadSiteSettings(tab);
  if (siteSettings) {
    if (siteSettings.mode) {
      chrome.tabs.sendMessage(tab.id, { type: 'SET_MODE', mode: siteSettings.mode }, () => { void chrome.runtime.lastError; });
    }
    if (siteSettings.tier) {
      chrome.tabs.sendMessage(tab.id, { type: 'SET_TIER', tier: siteSettings.tier }, () => { void chrome.runtime.lastError; });
    }
    if (siteSettings.intensity != null) {
      chrome.tabs.sendMessage(tab.id, { type: 'SET_INTENSITY', intensity: siteSettings.intensity }, () => { void chrome.runtime.lastError; });
    }
    if (siteSettings.fontSize) {
      chrome.tabs.sendMessage(tab.id, { type: 'SET_FONT_SIZE', fontSize: siteSettings.fontSize }, () => { void chrome.runtime.lastError; });
    }
  }

  chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' }, (response) => {
    if (!chrome.runtime.lastError && response) {
      applyState(response);
    } else if (attemptsLeft > 1) {
      setTimeout(() => initWithRetry(attemptsLeft - 1, delay), delay);
    } else {
      setUI(false);
      showReloadHint();
    }
  });
}

initWithRetry();

// ── Toggle ────────────────────────────────────────────────

toggle.addEventListener('change', async () => {
  const enabled = toggle.checked;
  setUI(enabled);
  const tab = await getActiveTab();
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE', enabled }, () => {
    if (chrome.runtime.lastError) {
      setUI(false);
      shakeReloadHint();
    } else {
      hideReloadHint();
    }
  });
});

// ── Mode selector ─────────────────────────────────────────

document.getElementById('mode-select').addEventListener('change', async (e) => {
  const mode = e.target.value;
  const tab = await getActiveTab();
  chrome.tabs.sendMessage(tab.id, { type: 'SET_MODE', mode }, () => {
    void chrome.runtime.lastError;
  });
  saveSiteSetting(tab, 'mode', mode);
});

// ── Intensity slider ──────────────────────────────────────

const slider = document.getElementById('intensity-slider');
const intensityLabel = document.getElementById('intensity-value');

slider.addEventListener('input', () => {
  intensityLabel.textContent = slider.value;
});

slider.addEventListener('change', async () => {
  const intensity = parseInt(slider.value);
  const tab = await getActiveTab();
  chrome.tabs.sendMessage(tab.id, { type: 'SET_INTENSITY', intensity }, () => {
    void chrome.runtime.lastError;
  });
  saveSiteSetting(tab, 'intensity', intensity);
});

// ── Streamer name ─────────────────────────────────────────

const streamerNameInput = document.getElementById('streamer-name-input');

// Load saved name on open
chrome.storage.local.get('streamerName', ({ streamerName }) => {
  if (streamerName) streamerNameInput.value = streamerName;
});

streamerNameInput.addEventListener('change', async () => {
  const name = streamerNameInput.value.trim();
  chrome.storage.local.set({ streamerName: name });
  const tab = await getActiveTab();
  chrome.tabs.sendMessage(tab.id, { type: 'SET_STREAMER_NAME', name }, () => {
    void chrome.runtime.lastError;
  });
});

// ── Settings ──────────────────────────────────────────────

document.getElementById('options-link').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ── Usage stats ───────────────────────────────────────────

const INPUT_COST  = 0.80 / 1_000_000;
const OUTPUT_COST = 4.00 / 1_000_000;

function renderUsage(usage) {
  const u = usage || { inputTokens: 0, outputTokens: 0, fetches: 0 };
  const cost = (u.inputTokens * INPUT_COST) + (u.outputTokens * OUTPUT_COST);
  document.getElementById('stat-cost').textContent    = `$${cost.toFixed(4)}`;
  document.getElementById('stat-fetches').textContent = u.fetches.toLocaleString();
  document.getElementById('stat-tokens').textContent  = (u.inputTokens + u.outputTokens).toLocaleString();
}

chrome.storage.local.get('usage', ({ usage }) => renderUsage(usage));

document.getElementById('reset-usage').addEventListener('click', () => {
  const empty = { inputTokens: 0, outputTokens: 0, fetches: 0 };
  chrome.storage.local.set({ usage: empty }, () => renderUsage(empty));
});
