const providerSelect      = document.getElementById('provider');
const fieldAnthropic      = document.getElementById('field-anthropic');
const fieldOpenAI         = document.getElementById('field-openai');
const apiKeyInput         = document.getElementById('api-key');
const openaiKeyInput      = document.getElementById('openai-key');
const streamerNameInput   = document.getElementById('streamer-name');
const saveBtn             = document.getElementById('save');
const clearBtn            = document.getElementById('clear-data');
const savedMsg            = document.getElementById('saved-msg');
const clearedMsg          = document.getElementById('cleared-msg');
const toggleVisibility    = document.getElementById('toggle-visibility');
const toggleVisibilityOAI = document.getElementById('toggle-visibility-openai');

function updateProviderFields() {
  const isOpenAI = providerSelect.value === 'openai';
  fieldAnthropic.style.display = isOpenAI ? 'none' : '';
  fieldOpenAI.style.display    = isOpenAI ? '' : 'none';
}

const customPromptEl  = document.getElementById('custom-prompt');
const contextSizeEl   = document.getElementById('context-size');

// Load saved values
chrome.storage.local.get(['apiKey', 'openaiApiKey', 'aiProvider', 'streamerName', 'customPrompt', 'contextSize'], ({ apiKey, openaiApiKey, aiProvider, streamerName, customPrompt, contextSize }) => {
  if (apiKey)        apiKeyInput.value       = apiKey;
  if (openaiApiKey)  openaiKeyInput.value    = openaiApiKey;
  if (aiProvider)    providerSelect.value    = aiProvider;
  if (streamerName)  streamerNameInput.value = streamerName;
  if (customPrompt)  customPromptEl.value    = customPrompt;
  if (contextSize)   contextSizeEl.value     = contextSize;
  updateProviderFields();
});

providerSelect.addEventListener('change', updateProviderFields);

// Save
saveBtn.addEventListener('click', () => {
  const key       = apiKeyInput.value.trim();
  const oaiKey    = openaiKeyInput.value.trim();
  const name      = streamerNameInput.value.trim();
  const provider  = providerSelect.value;

  const toSave = { aiProvider: provider, streamerName: name, customPrompt: customPromptEl.value.trim(), contextSize: contextSizeEl.value };
  if (key)    toSave.apiKey       = key;
  if (oaiKey) toSave.openaiApiKey = oaiKey;

  chrome.storage.local.set(toSave, () => {
    savedMsg.style.display = 'block';
    setTimeout(() => { savedMsg.style.display = 'none'; }, 2500);
  });
});

// Clear all data
clearBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['apiKey', 'openaiApiKey', 'aiProvider', 'streamerName', 'whitelistMode', 'whitelist', 'customBlocklist', 'customPrompt', 'contextLog', 'contextSize'], () => {
    apiKeyInput.value       = '';
    openaiKeyInput.value    = '';
    streamerNameInput.value = '';
    providerSelect.value    = 'anthropic';
    updateProviderFields();
    whitelistModeEl.checked = false;
    whitelistSection.style.display = 'none';
    currentWhitelist = [];
    renderWhitelist();
    currentBlocklist = [];
    renderBlocklist();
    customPromptEl.value = '';
    renderContextLog([]);
    clearedMsg.style.display = 'block';
    setTimeout(() => { clearedMsg.style.display = 'none'; }, 2500);
  });
});

// ── Consent gate toggle ───────────────────────────────────

const consentGateToggle = document.getElementById('consent-gate-toggle');

chrome.storage.local.get('consentGateEnabled', ({ consentGateEnabled }) => {
  consentGateToggle.checked = consentGateEnabled !== false; // default on
});

consentGateToggle.addEventListener('change', () => {
  chrome.storage.local.set({ consentGateEnabled: consentGateToggle.checked });
});

// ── Whitelist ──────────────────────────────────────────────

const whitelistModeEl  = document.getElementById('whitelist-mode');
const whitelistSection = document.getElementById('whitelist-section');
const whitelistInput   = document.getElementById('whitelist-input');
const whitelistAddBtn  = document.getElementById('whitelist-add');
const whitelistListEl  = document.getElementById('whitelist-list');

let currentWhitelist = [];

function escapeHtmlOpts(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderWhitelist() {
  whitelistListEl.innerHTML = '';
  currentWhitelist.forEach((host, i) => {
    const item = document.createElement('div');
    item.className = 'whitelist-item';
    item.innerHTML = `<span>${escapeHtmlOpts(host)}</span><button class="whitelist-remove" data-i="${i}" title="Remove">&#215;</button>`;
    whitelistListEl.appendChild(item);
  });
  whitelistListEl.querySelectorAll('.whitelist-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      currentWhitelist.splice(parseInt(btn.dataset.i), 1);
      chrome.storage.local.set({ whitelist: currentWhitelist });
      renderWhitelist();
    });
  });
}

chrome.storage.local.get(['whitelistMode', 'whitelist'], ({ whitelistMode, whitelist }) => {
  whitelistModeEl.checked = !!whitelistMode;
  whitelistSection.style.display = whitelistMode ? '' : 'none';
  currentWhitelist = whitelist || [];
  renderWhitelist();
});

whitelistModeEl.addEventListener('change', () => {
  const enabled = whitelistModeEl.checked;
  whitelistSection.style.display = enabled ? '' : 'none';
  chrome.storage.local.set({ whitelistMode: enabled });
});

whitelistAddBtn.addEventListener('click', () => {
  const val = whitelistInput.value.trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!val || currentWhitelist.includes(val)) return;
  currentWhitelist.push(val);
  chrome.storage.local.set({ whitelist: currentWhitelist });
  whitelistInput.value = '';
  renderWhitelist();
});

whitelistInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') whitelistAddBtn.click();
});

// ── Custom blocklist ──────────────────────────────────────

const blocklistInput  = document.getElementById('blocklist-input');
const blocklistAddBtn = document.getElementById('blocklist-add');
const blocklistListEl = document.getElementById('blocklist-list');

let currentBlocklist = [];

function renderBlocklist() {
  blocklistListEl.innerHTML = '';
  currentBlocklist.forEach((host, i) => {
    const item = document.createElement('div');
    item.className = 'whitelist-item';
    item.innerHTML = `<span>${escapeHtmlOpts(host)}</span><button class="whitelist-remove" data-i="${i}" title="Remove">&#215;</button>`;
    blocklistListEl.appendChild(item);
  });
  blocklistListEl.querySelectorAll('.whitelist-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      currentBlocklist.splice(parseInt(btn.dataset.i), 1);
      chrome.storage.local.set({ customBlocklist: currentBlocklist });
      renderBlocklist();
    });
  });
}

chrome.storage.local.get('customBlocklist', ({ customBlocklist }) => {
  currentBlocklist = customBlocklist || [];
  renderBlocklist();
});

blocklistAddBtn.addEventListener('click', () => {
  const val = blocklistInput.value.trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!val || currentBlocklist.includes(val)) return;
  currentBlocklist.push(val);
  chrome.storage.local.set({ customBlocklist: currentBlocklist });
  blocklistInput.value = '';
  renderBlocklist();
});

blocklistInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') blocklistAddBtn.click();
});


// ── Context log ───────────────────────────────────────────

const logToggle      = document.getElementById('log-toggle');
const logSection     = document.getElementById('log-section');
const logToggleLabel = document.getElementById('log-toggle-label');
const logDivider     = document.getElementById('log-divider');
const logListEl      = document.getElementById('log-list');
const clearLogBtn    = document.getElementById('clear-log');

let logOpen = false;
logToggle.addEventListener('click', () => {
  logOpen = !logOpen;
  logSection.style.display = logOpen ? '' : 'none';
  logDivider.style.display = logOpen ? '' : 'none';
  logToggleLabel.textContent = logOpen ? 'Hide' : 'Show';
  logToggleLabel.style.color = logOpen ? '#efeff1' : '#adadb8';
  logToggleLabel.style.borderColor = logOpen ? '#6a6a6e' : '#3a3a3e';
  if (logOpen) loadContextLog();
});

function renderContextLog(entries) {
  logListEl.innerHTML = '';
  if (!entries.length) {
    logListEl.innerHTML = '<div style="font-size:12px; color:#6a6a6e;">No fetches logged yet.</div>';
    return;
  }
  entries.forEach(e => {
    const d = new Date(e.timestamp);
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    let hostname = '';
    try { hostname = new URL(e.url || 'about:blank').hostname; } catch {}
    const displayTitle = e.title || hostname || e.urlType || 'Unknown';
    const item = document.createElement('details');
    item.className = 'log-entry';
    const summary = document.createElement('summary');
    summary.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px;" title="${escapeHtmlOpts(displayTitle)}">${escapeHtmlOpts(displayTitle)}</span><span style="color:#6a6a6e;white-space:nowrap;flex-shrink:0;">${date} ${time}</span>`;
    const body = document.createElement('div');
    body.className = 'log-entry-body';
    body.innerHTML = `
      <div><strong>Site:</strong> ${escapeHtmlOpts(hostname || e.urlType || '')}</div>
      <div><strong>Type:</strong> ${escapeHtmlOpts(e.urlType || '')}</div>
      <div><strong>Mode:</strong> ${escapeHtmlOpts(e.mode || '')} / ${escapeHtmlOpts(e.tier || '')}</div>
      <div><strong>Context:</strong> ${e.description ? escapeHtmlOpts(e.description) : '<em>None extracted</em>'}</div>
      ${e.customPrompt ? `<div><strong>Your prompt:</strong> ${escapeHtmlOpts(e.customPrompt)}</div>` : ''}
    `;
    item.appendChild(summary);
    item.appendChild(body);
    logListEl.appendChild(item);
  });
}

function loadContextLog() {
  chrome.storage.local.get('contextLog', ({ contextLog }) => {
    renderContextLog(contextLog || []);
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.contextLog && logOpen) {
    renderContextLog(changes.contextLog.newValue || []);
  }
});

clearLogBtn.addEventListener('click', () => {
  chrome.storage.local.remove('contextLog', () => renderContextLog([]));
});

// Show/hide toggles
toggleVisibility.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleVisibility.textContent = isPassword ? 'Hide key' : 'Show key';
});

toggleVisibilityOAI.addEventListener('click', () => {
  const isPassword = openaiKeyInput.type === 'password';
  openaiKeyInput.type = isPassword ? 'text' : 'password';
  toggleVisibilityOAI.textContent = isPassword ? 'Hide key' : 'Show key';
});
