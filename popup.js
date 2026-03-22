chrome.storage.local.get('sidebarTheme', ({ sidebarTheme }) => {
  if (sidebarTheme) document.documentElement.dataset.theme = sidebarTheme;
});

const toggle    = document.getElementById('toggle');
const liveBadge = document.getElementById('live-badge');
const liveText  = document.getElementById('live-text');
const toggleSub = document.getElementById('toggle-sub');

// ── UI helpers ────────────────────────────────────────────

const reloadHint = document.getElementById('reload-hint');

const reloadMsg = document.getElementById('reload-msg');
const reloadBtn = document.getElementById('reload-tab-btn');

let costHintTimer = null;

function showCostHint() {
  if (reloadHint.style.display === 'block') return;
  reloadMsg.textContent = 'Heads up: ~3x the token usage of Standard.';
  reloadBtn.style.display = 'none';
  reloadHint.style.display = 'block';
  clearTimeout(costHintTimer);
  costHintTimer = setTimeout(() => {
    reloadHint.style.display = 'none';
    reloadBtn.style.display = '';
  }, 3000);
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('about:') ||
         url.startsWith('devtools://');
}

function showReloadHint(message, showButton = true) {
  reloadMsg.textContent = message || 'Reload this tab to activate.';
  reloadBtn.style.display = showButton ? '' : 'none';
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
  toggle.checked  = enabled;
  toggle.disabled = false;
  liveBadge.classList.toggle('active', enabled);
  liveText.textContent  = enabled ? 'Live' : 'Off';
  toggleSub.textContent = enabled ? 'Chat is active on this page' : 'Chat is inactive';
}

// ── Tier selector ─────────────────────────────────────────

const TIER_DESCRIPTIONS = {
  free:     'No API key needed. Hardcoded message pool.',
  standard: 'AI-powered. Reacts to what\'s on screen.',
  turbo:    'Chatters argue, agree, and react to each other.'
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
    if (tier === 'turbo') showCostHint();
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

// ── Sensitive site detection (must match content.js) ──────

const SENSITIVE_SITES = {
  'mail.google.com': 'email service', 'inbox.google.com': 'email service',
  'outlook.com': 'email service', 'outlook.live.com': 'email service',
  'outlook.office.com': 'email service', 'outlook.office365.com': 'email service',
  'mail.yahoo.com': 'email service', 'protonmail.com': 'email service',
  'proton.me': 'email service', 'tutanota.com': 'email service',
  'fastmail.com': 'email service', 'icloud.com': 'email service',
  'paypal.com': 'payment service', 'venmo.com': 'payment service',
  'cash.app': 'payment service', 'wise.com': 'payment service',
  'revolut.com': 'payment service', 'pay.google.com': 'payment service',
  'payments.google.com': 'payment service', 'mobilepay.dk': 'payment service',
  'mobilepay.fi': 'payment service',
  'lastpass.com': 'password manager', '1password.com': 'password manager',
  'app.1password.com': 'password manager', 'bitwarden.com': 'password manager',
  'vault.bitwarden.com': 'password manager', 'dashlane.com': 'password manager',
  'nordpass.com': 'password manager', 'keepersecurity.com': 'password manager',
  'skat.dk': 'government portal', 'borger.dk': 'government portal',
  'mitid.dk': 'digital identity service', 'e-boks.dk': 'government portal',
};

function getSensitiveCategory(hostname) {
  if (!hostname) return null;
  const h = hostname.replace(/^www\./, '');
  if (SENSITIVE_SITES[h]) return SENSITIVE_SITES[h];
  for (const domain of Object.keys(SENSITIVE_SITES)) {
    if (h.endsWith('.' + domain)) return SENSITIVE_SITES[domain];
  }
  if (h.endsWith('.gov') || /\.gov\.[a-z]{2,3}$/.test(h)) return 'government portal';
  if (h.endsWith('.bank')) return 'banking service';
  if (h.endsWith('.mil')) return 'government portal';
  return null;
}

async function initWithRetry(attemptsLeft = 6, delay = 300) {
  const tab = await getActiveTab();

  if (isRestrictedUrl(tab?.url)) {
    setUI(false);
    showReloadHint("Chat can't run on browser pages.", false);
    return;
  }

  // Whitelist check
  const { whitelistMode, whitelist } = await new Promise(r => chrome.storage.local.get(['whitelistMode', 'whitelist'], r));
  if (whitelistMode) {
    const hostname = getHostname(tab)?.replace(/^www\./, '');
    const list = whitelist || [];
    const blocked = hostname && !list.some(h => hostname === h || hostname.endsWith('.' + h));
    if (blocked) {
      setUI(false);
      toggle.disabled = true;
      document.getElementById('whitelist-blocked').style.display = 'block';
      document.getElementById('add-to-whitelist').addEventListener('click', () => {
        chrome.storage.local.get('whitelist', ({ whitelist: cur }) => {
          const updated = cur || [];
          if (!updated.includes(hostname)) updated.push(hostname);
          chrome.storage.local.set({ whitelist: updated }, () => {
            document.getElementById('whitelist-blocked').style.display = 'none';
            initWithRetry();
          });
        });
      }, { once: true });
      return;
    }
  }

  // Sensitive site check (hardcoded list + user's custom blocklist)
  const hostname = getHostname(tab)?.replace(/^www\./, '') || '';
  let effectiveCategory = getSensitiveCategory(hostname);
  if (!effectiveCategory) {
    const { customBlocklist } = await new Promise(r => chrome.storage.local.get('customBlocklist', r));
    const list = customBlocklist || [];
    if (list.some(h => hostname === h || hostname.endsWith('.' + h))) {
      effectiveCategory = 'user-blocked site';
    }
  }
  if (effectiveCategory) {
    const sensitiveCategory = effectiveCategory;
    const siteKey = `site:${hostname}`;
    const stored = await new Promise(r => chrome.storage.local.get(siteKey, r));
    if (!stored[siteKey]?.sensitiveOverride) {
      setUI(false);
      toggle.disabled = true;
      document.getElementById('sensitive-site-label').textContent = sensitiveCategory;
      document.getElementById('sensitive-blocked').style.display = 'block';
      document.getElementById('sensitive-enable-anyway').addEventListener('click', () => {
        const existing = stored[siteKey] || {};
        chrome.storage.local.set({ [siteKey]: { ...existing, sensitiveOverride: true } }, () => {
          document.getElementById('sensitive-blocked').style.display = 'none';
          initWithRetry();
        });
      }, { once: true });
      return;
    }
  }

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
      showReloadHint('Reload this tab to activate.');
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
