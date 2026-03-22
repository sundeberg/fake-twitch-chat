let isEnabled = false;
let isPaused = false;
let isCollapsed = false;
let savedSidebarWidth = 300;
let sidebar = null;
let messageQueue = [];
let schedulerTimer = null;
let fetchTimer = null;
let isFetching = false;
let currentMode = 'default';
let currentIntensity = 5;
let currentTier = 'standard';
let currentFontSize = 13;
let fetchGeneration = 0;
let chatHistory = [];
let pendingUserMessage = '';
let streamerName = '';
let currentTheme = 'auto';

// Load streamer name from storage
chrome.storage.local.get('streamerName', ({ streamerName: name }) => {
  if (name) streamerName = name;
});


// Cached custom prompt — appended to page context on every AI fetch
let customPrompt = '';
chrome.storage.local.get('customPrompt', ({ customPrompt: p }) => {
  customPrompt = p || '';
});

// Cached context size limit
const CONTEXT_LIMITS = { standard: 800, extended: 2500, full: 5000 };
let contextLimit = 800;
chrome.storage.local.get('contextSize', ({ contextSize }) => {
  contextLimit = CONTEXT_LIMITS[contextSize] || 800;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.customPrompt) customPrompt = changes.customPrompt.newValue || '';
  if (changes.contextSize) contextLimit = CONTEXT_LIMITS[changes.contextSize.newValue] || 800;
});

// Confirmed BTTV shared emote IDs. Hardcoded here so updates take effect on
// extension reload without waiting for the 24h API cache to expire.
const BTTV_SHARED_EMOTES = {
  'KEKW':      '5e9c6c187e090362f8b0b9e8',
  'OMEGALUL':  '583089f4737a8e61abb0186b',
  'Pog':       '5ff827395ef7d10c7912c106',
  'PogChamp':  '61d538fd06fd6a9f5bdf6b44',
  'LULW':      '5dc79d1b27360247dd6516ec',
  'catJAM':    '5f1b0186cf6d2144653d2970',
  'CATJAM':    '5f1b0186cf6d2144653d2970',
  'PauseChamp':'5cd6b08cf1dac14a18c4b61f',
  'GIGACHAD':  '609431bc39b5010444d0cbdc',
  'Sadge':     '5e0fa9d40550d42106b8a489',
  'copium':    '5f64475bd7160803d895a112',
};

// Merge hardcoded emotes with BTTV global emotes fetched by background.js
let bttvEmoteMap = { ...BTTV_SHARED_EMOTES };
chrome.storage.local.get('bttvEmotes', ({ bttvEmotes }) => {
  if (bttvEmotes?.map) bttvEmoteMap = { ...bttvEmotes.map, ...BTTV_SHARED_EMOTES };
});

// ── Username pool ────────────────────────────────────────

const USERNAMES = [
  'xXDarkSlayer99Xx', 'pogmaster3000', 'TwitchViewer420', 'SweatyPalms_',
  'NotABot123', 'ClipThat_', 'RandomChatter', 'BackseatGamer',
  'HypeTrainConductor', 'LowKeyVibing', 'TouchGrassPlease', 'JustPassingBy42',
  'ChatSpammer', 'NeverLucky_', 'ActuallyGood', 'KekwMoment',
  'OmegalulFan', 'W_Enjoyer', 'SilentWatcher99', 'CasualViewer_',
  'NoChill__', 'shroud_fan99', 'HasturPog', 'its_giving_W', 'copium_addict'
];

const USERNAME_COLORS = [
  '#FF4500', '#FF6347', '#FFD700', '#00FF7F', '#1E90FF',
  '#DA70D6', '#FF69B4', '#00CED1', '#FFA500', '#ADFF2F',
  '#9147FF', '#F8312F', '#00B5AD', '#E91E8C', '#43A8FF'
];

function getUsernameColor(username) {
  let hash = 0;
  for (const c of username) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return USERNAME_COLORS[Math.abs(hash) % USERNAME_COLORS.length];
}

function getRandomUsername() {
  return USERNAMES[Math.floor(Math.random() * USERNAMES.length)];
}

// ── Free tier message pools ──────────────────────────────

const FREE_MESSAGES = {
  default: [
    'W', 'L', 'KEKW', 'LUL', 'OMEGALUL', 'Pog', 'PogChamp', 'BRO', 'no way',
    'actually insane', 'W chat', 'chat is wild', 'ngl kinda W', 'no shot',
    'bro really did that', 'LMAOOO', 'this guy man...', 'imagine',
    'copium', 'skill issue', 'based', 'mid', 'actually decent',
    'W moment', 'crazy', 'bro is built different', 'not bad ngl',
    'GIGACHAD', 'who asked', 'ratio', 'chat going crazy rn',
    'bro said what', 'nah this is real', 'actual W', 'kinda based tbh',
    'no way this is happening', 'CLIP THAT', 'bro cooked', 'insane',
    'ok I fw this', 'pause', 'PauseChamp', 'what is going on',
    'chat did we just witness that', 'I am in shock', 'ok ok ok',
    'we so back', 'it is what it is', 'bro said say less'
  ],
  hype: [
    'LETS GOOOO', 'W W W', 'POGGERS', 'YESSS', 'HYPE', 'LETS GO CHAT',
    'NO WAYYYY', 'ACTUAL GOAT', 'GREATEST OF ALL TIME', 'WE ARE SO BACK',
    'BEST MOMENT EVER', 'CLIP THAT', 'INSANE', 'UNREAL', 'LEGENDARY',
    'HYPE TRAIN', 'W W W W W', 'THIS IS PEAK', 'ACTUAL CINEMA',
    'GOATED WITH THE SAUCE', 'HE IS HIM', 'SHE IS HER', 'THEY ARE THAT',
    'NO ONE DOES IT LIKE THIS', 'ABSOLUTE W', 'CHAT WE ARE WITNESSING HISTORY',
    'GREATEST ALIVE', 'OMGGG', 'I CANT BREATHE', 'TOO GOOD',
    'THIS IS EVERYTHING', 'PEAK PEAK PEAK', 'CARRIED BY SKILL',
    'GOATED', 'W MOMENT', 'CHAT LETS GOOO', 'ABSOLUTELY INSANE',
    'BEST DAY EVER', 'THIS SLAPS', 'ACTUAL PERFECTION', 'NO NOTES',
    'CLEAN', 'SO CLEAN', 'FLAWLESS', 'BASED AND W PILLED', 'MAGNIFICENT'
  ],
  toxic: [
    'L', 'L + ratio', 'skill issue', 'mid', 'who asked', 'nobody asked',
    'ratio', 'L take', 'cope', 'copium', 'stay mad', 'imagine being this bad',
    'embarrassing', 'bro really thought', 'not gonna make it',
    'bro is cooked', 'who let him cook', 'touch grass',
    'certified L moment', 'this is painful to watch', 'please stop',
    'actual clown behavior', 'beyond saving', 'L mentality',
    'OMEGALUL', 'the cringe is unbearable', 'not him actually trying',
    'bro fell off', 'W for the trash can', 'dogwater',
    'bro is allergic to Ws', 'negative IQ play', 'stay losing',
    'bro took an L vacation', 'bro needs a refund on his brain',
    'not a single braincell', 'yikes', 'certified fail',
    'bro is built for Ls', 'clown behavior fr', 'laughing rn'
  ],
  wholesome: [
    'so wholesome', 'W', 'we love to see it', 'this is beautiful',
    'actually cute', 'love this energy', 'so good', 'heart',
    'bro is so kind', 'we support you', 'you got this', 'keep going',
    'actually inspiring', 'W human being', 'so valid', 'blessed content',
    'this made my day', 'we are rooting for you', 'so pure',
    'actual angel behavior', 'love this so much', 'W vibes only',
    'no hate in this chat', 'good energy', 'this is the content I needed',
    'wholesome W', 'we love you', 'never change', 'stay wonderful',
    'the world needs more of this', 'genuinely sweet', 'absolute W person',
    'so much respect', 'love the effort', 'you are doing great',
    'happy for you', 'this community is something else', 'grateful'
  ],
  backseaters: [
    'bro just do it differently', 'why would you do it that way',
    'I would have done that completely differently', 'that is the wrong approach',
    'let me explain the better way', 'this is why you need to listen to chat',
    'I literally told you this would happen', 'classic mistake',
    'just do what I said', 'trust me I know better', 'wrong move bro',
    'there is an easier way', 'why are you making this harder',
    'I have done this before it is simple', 'you should have prepared more',
    'bro read the guide', 'do the thing from before', 'no no no not like that',
    'I am screaming at my screen rn', 'chat was right all along',
    'just follow the optimal path', 'this is so inefficient',
    'I could do this in half the time', 'let me take over please',
    'step 1 is so obvious bro', 'you are skipping the important part'
  ],
  clueless: [
    'what am I watching', 'wrong tab?', 'is this still going',
    'bro what is this', 'I am so confused', 'what just happened',
    'can someone explain', 'I have no idea what is happening',
    'is this normal', 'why', 'how', 'what', 'huh',
    'bro I just got here what did I miss', 'is this a game',
    'wait what is the objective', 'why is everyone calm about this',
    'am I the only one confused', 'this makes no sense to me',
    'I thought this was something else', 'is this part of the plan',
    'someone please explain', 'genuinely lost rn', 'ok so what are we doing',
    'this is not what I signed up for', 'where did that come from'
  ]
};

function getFreeTierMessages(count = 10) {
  const pool = FREE_MESSAGES[currentMode] || FREE_MESSAGES.default;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ── Sidebar ──────────────────────────────────────────────

function injectSidebar() {
  if (document.getElementById('ftc-sidebar')) return;

  sidebar = document.createElement('div');
  sidebar.id = 'ftc-sidebar';
  sidebar.innerHTML = `
    <div id="ftc-drag-handle"></div>
    <div id="ftc-header">
      <div id="ftc-header-left">
        <span id="ftc-title">&#128172; Chat</span>
        <button id="ftc-pause" title="Pause chat"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg></button>
        <button id="ftc-theme" title="Toggle dark mode"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></button>
        <button id="ftc-clip" title="Save clip"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
      </div>
      <div id="ftc-controls">
        <span id="ftc-status">connecting...</span>
        <button id="ftc-collapse" title="Collapse"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button id="ftc-close" title="Close">&#x2715;</button>
      </div>
    </div>
    <div id="ftc-messages"></div>
    <div id="ftc-input-area">
      <input type="text" id="ftc-input" placeholder="Send a message..." maxlength="200" autocomplete="off">
      <button id="ftc-send" title="Send"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
    </div>
    <button id="ftc-expand-strip" title="Expand chat"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    <div id="ftc-consent-gate">
      <p class="ftc-cg-title">&#128274; What gets sent to the AI</p>
      <p class="ftc-cg-body">Before connecting, this is the page context that will be sent to <strong id="ftc-cg-provider"></strong>. Nothing else leaves your browser.</p>
      <div class="ftc-cg-data">
        <div class="ftc-cg-row"><span class="ftc-cg-key">Site type</span><span class="ftc-cg-val" id="ftc-cg-type"></span></div>
        <div class="ftc-cg-row"><span class="ftc-cg-key">Title</span><span class="ftc-cg-val" id="ftc-cg-title"></span></div>
        <div class="ftc-cg-row"><span class="ftc-cg-key">Context excerpt</span><span class="ftc-cg-val" id="ftc-cg-desc"></span></div>
        <div class="ftc-cg-row" id="ftc-cg-prompt-row" style="display:none"><span class="ftc-cg-key">Your prompt</span><span class="ftc-cg-val" id="ftc-cg-prompt"></span></div>
      </div>
      <p class="ftc-cg-body">Approval is saved for <strong id="ftc-cg-host"></strong>. You won't be asked again unless you clear data.</p>
      <div class="ftc-cg-btns">
        <button id="ftc-consent-allow">Allow for this site</button>
        <button id="ftc-consent-deny">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(sidebar);
  setPushMargin(300);

  // Load saved width
  chrome.storage.local.get(['sidebarWidth', 'fontSize', 'sidebarTheme'], ({ sidebarWidth, fontSize, sidebarTheme }) => {
    const width = sidebarWidth || 300;
    if (sidebarWidth) sidebar.style.width = width + 'px';
    setPushMargin(width);
    if (fontSize) applyFontSize(fontSize);
    const theme = sidebarTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (!sidebarTheme) chrome.storage.local.set({ sidebarTheme: theme });
    applyTheme(theme);
  });

  document.getElementById('ftc-close').addEventListener('click', () => disable());
  document.getElementById('ftc-collapse').addEventListener('click', () => collapseSidebar());
  document.getElementById('ftc-expand-strip').addEventListener('click', () => expandSidebar());

  document.getElementById('ftc-theme').addEventListener('click', () => {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    chrome.storage.local.set({ sidebarTheme: next });
  });

  document.getElementById('ftc-pause').addEventListener('click', () => {
    isPaused ? resumeChat() : pauseChat();
  });

  document.getElementById('ftc-clip').addEventListener('click', () => openClip());

  const inputEl = document.getElementById('ftc-input');
  document.getElementById('ftc-send').addEventListener('click', () => handleUserSend());
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleUserSend(); }
    // Prevent the page from catching keyboard events while typing
    e.stopPropagation();
  });
  inputEl.addEventListener('keyup', (e) => e.stopPropagation());
  inputEl.addEventListener('keypress', (e) => e.stopPropagation());

  initDragHandle();
}

function addNavSeparator() {
  const messagesEl = document.getElementById('ftc-messages');
  if (!messagesEl) return;
  const rawTitle = document.title.replace(/^\(\d+\)\s*/, '').trim();
  const label = rawTitle.length > 45 ? rawTitle.substring(0, 43) + '...' : rawTitle;
  const sep = document.createElement('div');
  sep.className = 'ftc-nav-sep';
  sep.dataset.host = label || window.location.hostname.replace(/^www\./, '');
  messagesEl.appendChild(sep);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setPushMargin(width) {
  document.body.style.marginRight = width + 'px';
}

function clearPushMargin() {
  document.body.style.marginRight = '';
}

function collapseSidebar() {
  if (!sidebar) return;
  isCollapsed = true;
  savedSidebarWidth = sidebar.offsetWidth;
  sidebar.style.width = '36px';
  sidebar.classList.add('ftc-collapsed');
  setPushMargin(36);
  clearTimeout(schedulerTimer);
  clearTimeout(fetchTimer);
}

function expandSidebar() {
  if (!sidebar) return;
  isCollapsed = false;
  sidebar.style.width = savedSidebarWidth + 'px';
  sidebar.classList.remove('ftc-collapsed');
  setPushMargin(savedSidebarWidth);
  if (isEnabled && !isPaused) {
    startMessageDrip();
    if (currentTier !== 'free') fetchAndSchedule();
  }
}

function removeSidebar() {
  clearPushMargin();
  const el = document.getElementById('ftc-sidebar');
  if (el) el.remove();
  sidebar = null;
}

function setStatus(text) {
  const el = document.getElementById('ftc-status');
  if (!el) return;
  el.textContent = text;
  el.dataset.status = text;
}

function applyFontSize(size) {
  currentFontSize = size;
  if (!sidebar) return;
  sidebar.style.setProperty('--ftc-font-size', size + 'px');
}

const THEME_ICONS = {
  dark:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  light: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
};

const THEME_TITLES = {
  dark:  'Switch to light mode',
  light: 'Switch to dark mode'
};

function applyTheme(theme) {
  currentTheme = theme;
  if (!sidebar) return;
  sidebar.dataset.theme = theme;
  const btn = document.getElementById('ftc-theme');
  if (!btn) return;
  btn.innerHTML = THEME_ICONS[theme];
  btn.title = THEME_TITLES[theme];
}

function addMessage(text, isUser = false) {
  const messagesEl = document.getElementById('ftc-messages');
  if (!messagesEl) return;

  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msg = document.createElement('div');
  msg.className = 'ftc-message';

  const username = isUser ? null : getRandomUsername();

  if (isUser) {
    const displayName = streamerName || 'You';
    msg.classList.add('ftc-user-message');
    msg.innerHTML = `<span class="ftc-username ftc-you">${escapeHtml(displayName)}</span><span class="ftc-text">${escapeHtml(text)}</span><span class="ftc-ts">${time}</span>`;
  } else {
    const color = getUsernameColor(username);
    msg.innerHTML = `<span class="ftc-username" style="color:${color}">${username}</span><span class="ftc-text">${renderEmotes(escapeHtml(text))}</span><span class="ftc-ts">${time}</span>`;
  }

  messagesEl.appendChild(msg);
  msg.querySelectorAll('.ftc-emote').forEach(img => {
    img.addEventListener('error', () => img.remove());
  });

  // Track history for AI context (skip system error messages)
  if (!text.startsWith('⚠️')) {
    const historyEntry = isUser
      ? `[${streamerName || 'Streamer'}]: ${text}`
      : `[${username}]: ${text}`;
    chatHistory.push({ text: historyEntry, ts: Date.now() });
    if (chatHistory.length > 40) chatHistory.shift();
  }

  while (messagesEl.children.length > 150) {
    messagesEl.removeChild(messagesEl.firstChild);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEmotes(escapedText) {
  if (!Object.keys(bttvEmoteMap).length) return escapedText;
  return escapedText.split(' ').map(token => {
    // Strip trailing punctuation before lookup so "KEKW!" still matches
    const clean = token.replace(/[.,!?]+$/, '');
    const suffix = token.slice(clean.length);
    if (bttvEmoteMap[clean]) {
      const url = `https://cdn.betterttv.net/emote/${bttvEmoteMap[clean]}/1x`;
      return `<img src="${url}" class="ftc-emote" alt="${clean}" title="${clean}">${suffix}`;
    }
    return token;
  }).join(' ');
}

function sanitizeContext(str) {
  return str
    .replace(/[\r\n\t]+/g, ' ')  // flatten newlines — prevents prompt injection via page content
    .trim();
}

// ── Drag to resize ───────────────────────────────────────

function initDragHandle() {
  const handle = document.getElementById('ftc-drag-handle');
  if (!handle) return;

  let startX, startWidth;

  handle.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    handle.classList.add('dragging');

    const onMove = (e) => {
      const newWidth = Math.max(220, Math.min(520, startWidth - (e.clientX - startX)));
      sidebar.style.width = newWidth + 'px';
      setPushMargin(newWidth);
    };

    const onUp = () => {
      handle.classList.remove('dragging');
      chrome.storage.local.set({ sidebarWidth: sidebar.offsetWidth });
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });
}

// ── Pause / Resume ───────────────────────────────────────

function pauseChat() {
  isPaused = true;
  clearTimeout(schedulerTimer);
  clearTimeout(fetchTimer);
  const btn = document.getElementById('ftc-pause');
  if (btn) { btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>'; btn.title = 'Resume chat'; }
  setStatus('paused');
}

function resumeChat() {
  isPaused = false;
  const btn = document.getElementById('ftc-pause');
  if (btn) { btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'; btn.title = 'Pause chat'; }
  startMessageDrip();
  if (currentTier !== 'free') fetchAndSchedule();
}

// ── User send message ────────────────────────────────────

function handleUserSend() {
  const input = document.getElementById('ftc-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  addMessage(text, true);

  if (currentTier !== 'free' && !isPaused && isEnabled) {
    pendingUserMessage = text;
    messageQueue = [];
    clearTimeout(fetchTimer);
    isFetching = false;
    fetchGeneration++;
    fetchAndSchedule();
  }
}

// ── Clip ─────────────────────────────────────────────────

function openClip() {
  const messagesEl = document.getElementById('ftc-messages');
  if (!messagesEl) return;

  const msgs = Array.from(messagesEl.querySelectorAll('.ftc-message')).slice(-12);
  if (!msgs.length) return;

  const lines = msgs.map(m => {
    const user  = m.querySelector('.ftc-username')?.textContent || '';
    const text  = m.querySelector('.ftc-text')?.textContent || '';
    const color = m.querySelector('.ftc-username')?.style.color || '#9147ff';
    const isUser = m.classList.contains('ftc-user-message');
    return { user, text, color, isUser };
  });

  const scale      = 2;
  const W          = 380;
  const PAD        = 16;
  const FONT       = 13;
  const LINE_H     = 26;
  const HEADER_H   = 46;
  const FOOTER_H   = 30;
  const font       = `${FONT}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const fontBold   = `700 ${FONT}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

  // Measure canvas height based on wrapped lines
  const tmpCanvas = document.createElement('canvas');
  const tmpCtx    = tmpCanvas.getContext('2d');
  const maxTextW  = W - PAD * 2 - 8;

  function measureWrapped(ctx, user, text, bold) {
    ctx.font = bold;
    const uW = ctx.measureText(user + ' ').width;
    ctx.font = font;
    const remaining = maxTextW - uW;
    // simple truncation — full word-wrap would be heavier
    let t = text;
    while (t.length > 0 && ctx.measureText(t).width > remaining) t = t.slice(0, -1);
    if (t.length < text.length) t = t.slice(0, -1) + '…';
    return t;
  }

  const rendered = lines.map(l => ({
    ...l,
    displayText: measureWrapped(tmpCtx, l.user, l.text, fontBold)
  }));

  const totalH = HEADER_H + lines.length * LINE_H + 12 + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width  = W * scale;
  canvas.height = totalH * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, W, totalH);

  // Purple top border
  ctx.fillStyle = '#9147ff';
  ctx.fillRect(0, 0, W, 3);

  // Header text
  ctx.font = fontBold;
  ctx.fillStyle = '#efeff1';
  ctx.fillText('\u{1F4AC} Fake Twitch Chat', PAD, 30);

  const pageTitle = document.title.substring(0, 35);
  ctx.font = `11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = '#6a6a6e';
  ctx.textAlign = 'right';
  ctx.fillText(pageTitle, W - PAD, 30);
  ctx.textAlign = 'left';

  // Header separator
  ctx.fillStyle = '#2a2a2e';
  ctx.fillRect(0, HEADER_H, W, 1);

  // Messages
  let y = HEADER_H + LINE_H;
  for (const line of rendered) {
    const xOffset = PAD + (line.isUser ? 5 : 0);

    if (line.isUser) {
      ctx.fillStyle = 'rgba(145,71,255,0.14)';
      ctx.fillRect(0, y - LINE_H + 4, W, LINE_H);
      ctx.fillStyle = '#9147ff';
      ctx.fillRect(0, y - LINE_H + 4, 3, LINE_H);
    }

    // Username
    ctx.font = fontBold;
    ctx.fillStyle = line.color;
    const uW = ctx.measureText(line.user + ' ').width;
    ctx.fillText(line.user, xOffset, y);

    // Message text
    ctx.font = font;
    ctx.fillStyle = '#efeff1';
    ctx.fillText(line.displayText, xOffset + uW, y);

    y += LINE_H;
  }

  // Footer separator
  ctx.fillStyle = '#2a2a2e';
  ctx.fillRect(0, totalH - FOOTER_H, W, 1);

  // Footer
  ctx.font = `10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = '#6a6a6e';
  ctx.fillText('faketch.at', PAD, totalH - 10);
  ctx.textAlign = 'right';
  ctx.fillText('Fake Twitch Chat', W - PAD, totalH - 10);
  ctx.textAlign = 'left';

  // Download as PNG
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'chat-clip.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}

// ── DOM context extractors ───────────────────────────────

function getPageContext() {
  const h = window.location.hostname;
  const is = (domain) => h === domain || h.endsWith('.' + domain);

  if (is('youtube.com'))    return getYouTubeContext();
  if (is('reddit.com'))     return getRedditContext();
  if (is('twitter.com') || is('x.com')) return getTwitterContext();
  if (is('github.com'))     return getGitHubContext();
  if (is('twitch.tv'))      return getTwitchContext();
  if (is('wikipedia.org'))  return getWikipediaContext();
  if (is('netflix.com'))    return getNetflixContext();
  return getGenericContext();
}

function getYouTubeContext() {
  const title =
    document.querySelector('ytd-watch-metadata h1 yt-formatted-string')?.textContent?.trim() ||
    document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim() ||
    document.title;

  const channel =
    document.querySelector('ytd-channel-name yt-formatted-string a')?.textContent?.trim() ||
    document.querySelector('#channel-name a')?.textContent?.trim() || '';

  const description =
    document.querySelector('#description-inner yt-attributed-string')?.textContent?.trim() ||
    document.querySelector('#description #snippet-text')?.textContent?.trim() || '';

  const chapter = document.querySelector('.ytp-chapter-title-content')?.textContent?.trim() || '';

  const parts = [
    channel && `Channel: ${channel}`,
    description.substring(0, 500),
    chapter && `Current chapter: ${chapter}`
  ].filter(Boolean);

  return {
    title: sanitizeContext(title.substring(0, 150)),
    description: sanitizeContext(parts.join('. ').substring(0, contextLimit)),
    urlType: 'YouTube video'
  };
}

function getRedditContext() {
  const title =
    document.querySelector('h1[slot="title"]')?.textContent?.trim() ||
    document.querySelector('[data-testid="post-title"]')?.textContent?.trim() ||
    document.querySelector('h1')?.textContent?.trim() ||
    document.title;

  const postText = Array.from(document.querySelectorAll('[data-click-id="text"] p'))
    .slice(0, 2).map(p => p.textContent?.trim()).filter(Boolean).join(' ');

  // Get top-level comments only — clone each and strip nested replies before reading text
  const topComments = Array.from(document.querySelectorAll(
    'shreddit-comment[depth="0"], [data-testid="comment"]'
  )).slice(0, 3).map(el => {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('shreddit-comment').forEach(r => r.remove());
    return clone.querySelector('p')?.textContent?.trim();
  }).filter(Boolean);

  const description = [
    postText,
    topComments.length && `Top comments: ${topComments.join(' | ')}`
  ].filter(Boolean).join(' ').substring(0, contextLimit);

  return { title: sanitizeContext(title.substring(0, 150)), description: sanitizeContext(description), urlType: 'Reddit post' };
}

function getTwitterContext() {
  const tweets = Array.from(document.querySelectorAll('[data-testid="tweetText"]'))
    .slice(0, 2).map(t => t.textContent?.trim()).filter(Boolean);

  // Strip "(N) " notification count prefix, then strip the quoted tweet text from
  // the tab title so we get just "Author on X" without duplicating the description
  const rawTitle = document.title.replace(/^\(\d+\)\s*/, '');
  const title = rawTitle.replace(/:\s*[""""].*$/, '').trim() || rawTitle;

  return {
    title: sanitizeContext(title.substring(0, 150)),
    description: sanitizeContext(tweets.join(' | ').substring(0, contextLimit)),
    urlType: 'Twitter/X post'
  };
}

function getGitHubContext() {
  const repoName =
    document.querySelector('strong[itemprop="name"] a')?.textContent?.trim() ||
    document.querySelector('h1 [itemprop="name"]')?.textContent?.trim() ||
    document.querySelector('.AppHeader-context-item-label')?.textContent?.trim() || '';

  const desc =
    document.querySelector('p[itemprop="description"]')?.textContent?.trim() ||
    document.querySelector('.f4.my-3')?.textContent?.trim() ||
    document.querySelector('p.f4')?.textContent?.trim() || '';

  const readme =
    document.querySelector('#readme article')?.textContent?.trim()?.substring(0, 500) ||
    document.querySelector('article.markdown-body')?.textContent?.trim()?.substring(0, 500) ||
    document.querySelector('.markdown-body')?.textContent?.trim()?.substring(0, 500) || '';

  return {
    title: sanitizeContext((repoName || document.title).substring(0, 150)),
    description: sanitizeContext([desc, readme].filter(Boolean).join(' ').substring(0, contextLimit)),
    urlType: 'GitHub repository'
  };
}


function getTwitchContext() {
  const streamer = document.querySelector('[data-a-target="user-channel-header-username"]')?.textContent?.trim() ||
    document.querySelector('h1[data-a-target="stream-title"]')?.textContent?.trim() || '';
  const title = document.querySelector('[data-a-target="stream-title"]')?.textContent?.trim() || document.title;
  const game = document.querySelector('[data-a-target="stream-game-link"]')?.textContent?.trim() || '';

  return {
    title: sanitizeContext(title.substring(0, 150)),
    description: sanitizeContext([streamer && `Streamer: ${streamer}`, game && `Playing: ${game}`].filter(Boolean).join('. ')),
    urlType: 'Twitch stream'
  };
}

function getWikipediaContext() {
  const title =
    document.querySelector('.mw-page-title-main')?.textContent?.trim() ||
    document.querySelector('#firstHeading')?.textContent?.trim() ||
    document.title.replace(/\s*-\s*Wikipedia.*$/, '').trim();

  // Find the first meaningful paragraph (skip disambiguation notices and short lines)
  const intro = Array.from(document.querySelectorAll('.mw-parser-output > p'))
    .find(p => p.textContent.trim().length > 80)?.textContent?.trim() || '';

  return {
    title: sanitizeContext(title.substring(0, 150)),
    description: sanitizeContext(intro.substring(0, contextLimit)),
    urlType: 'Wikipedia article'
  };
}

function getNetflixContext() {
  // Tab title format on watch pages: "Show Name - Netflix" or "Show: Episode - Netflix"
  const title = document.title.replace(/\s*[|\-–]\s*Netflix\s*$/i, '').trim() || 'Netflix';

  // Try DOM selectors for show/episode title (may not be available due to DRM rendering)
  const videoTitle =
    document.querySelector('[data-uia="video-title"]')?.textContent?.trim() ||
    document.querySelector('.video-title h4')?.textContent?.trim() || '';

  const displayTitle = videoTitle || title;
  const isWatchPage = window.location.pathname.startsWith('/watch');

  return {
    title: sanitizeContext(displayTitle.substring(0, 150)),
    description: isWatchPage ? sanitizeContext(`Watching on Netflix`) : '',
    urlType: 'Netflix'
  };
}

function getGenericContext() {
  // Strip notification count prefix "(N) " that browsers add to tab titles
  const title = document.title.replace(/^\(\d+\)\s*/, '') || 'Unknown page';
  const metaDesc =
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[property="og:description"]')?.content || '';

  // How many paragraphs to read scales with the context limit
  const maxParas = contextLimit <= 800 ? 3 : contextLimit <= 2500 ? 10 : 25;
  const sidebar = document.getElementById('ftc-sidebar');
  const notOurs = el => !sidebar || !sidebar.contains(el);

  // 1. article p — best for news/blog sites
  let bodyText = Array.from(document.querySelectorAll('article p'))
    .filter(notOurs).slice(0, maxParas).map(p => p.textContent?.trim()).filter(Boolean).join(' ');

  // 2. main or role=main p — catches sites without <article> (Google Docs, apps)
  if (!bodyText) {
    bodyText = Array.from(document.querySelectorAll('main p, [role="main"] p'))
      .filter(notOurs).filter(p => p.textContent?.trim().length > 30)
      .slice(0, maxParas).map(p => p.textContent?.trim()).join(' ');
  }

  // 3. Any p longer than 30 chars — last resort, exclude our sidebar
  if (!bodyText) {
    bodyText = Array.from(document.querySelectorAll('p'))
      .filter(notOurs).filter(p => p.textContent?.trim().length > 30)
      .slice(0, maxParas).map(p => p.textContent?.trim()).join(' ');
  }

  let urlType = 'website';
  if (window.location.hostname.endsWith('hbo.com') || window.location.hostname.endsWith('disneyplus.com')) urlType = 'streaming video';

  return {
    title: sanitizeContext(title.substring(0, 150)),
    description: sanitizeContext((bodyText || metaDesc).substring(0, contextLimit)),
    urlType
  };
}

// ── Message scheduler ────────────────────────────────────

const PREFETCH_THRESHOLD  = { standard: 5,  turbo: 8 };
const FETCH_INTERVAL_MS   = { standard: 40000, turbo: 12000 };
const DRIP_MIN_MS         = { standard: 300, turbo: 250 };
const DRIP_RANGE_MS       = { standard: 1400, turbo: 1000 };

function scheduleMessages(messages) {
  messageQueue.push(...messages);
}

function startMessageDrip() {
  clearTimeout(schedulerTimer);

  function drip() {
    if (!isEnabled || isPaused) return;

    if (currentTier === 'free') {
      if (messageQueue.length < 5) scheduleMessages(getFreeTierMessages(12));
    } else {
      const threshold = PREFETCH_THRESHOLD[currentTier] ?? 5;
      if (messageQueue.length < threshold && !isFetching) {
        clearTimeout(fetchTimer);
        fetchAndSchedule();
      }
    }

    if (messageQueue.length > 0) {
      const burstSize = Math.random() < 0.2 ? Math.min(3, messageQueue.length) : 1;
      for (let i = 0; i < burstSize; i++) {
        if (messageQueue.length > 0) addMessage(messageQueue.shift());
      }
    }

    const minD  = DRIP_MIN_MS[currentTier]   ?? 300;
    const range = DRIP_RANGE_MS[currentTier] ?? 1400;
    const delay = minD + Math.random() * range;
    schedulerTimer = setTimeout(drip, delay);
  }

  drip();
}

// ── API fetch ────────────────────────────────────────────

async function fetchAndSchedule() {
  if (!isEnabled || isFetching || currentTier === 'free' || isPaused) return;

  isFetching = true;

  // Consent gate: show once per hostname before the first API call (if enabled in settings)
  const cgHost = window.location.hostname.replace(/^www\./, '');
  const cgKey = `site:${cgHost}`;
  const cgStored = await chrome.storage.local.get([cgKey, 'consentGateEnabled']);
  const cgSettings = cgStored[cgKey] || {};
  const gateEnabled = cgStored.consentGateEnabled !== false; // default on
  if (gateEnabled && !cgSettings.contextApproved) {
    const approved = await showConsentGate();
    if (!approved) { isFetching = false; disable(); return; }
    const cgFresh = await chrome.storage.local.get(cgKey);
    chrome.storage.local.set({ [cgKey]: { ...(cgFresh[cgKey] || {}), contextApproved: true } });
  }

  const generation = fetchGeneration;
  setStatus('loading...');

  const context = getPageContext();

  try {
    const now = Date.now();
    const historyLimit = currentTier === 'turbo' ? 20 : 10;
    const historyAge   = currentTier === 'turbo' ? 120000 : 90000;
    const recentHistory = chatHistory
      .filter(h => now - h.ts < historyAge)
      .slice(-historyLimit)
      .map(h => h.text);

    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_MESSAGES',
      context,
      mode: currentMode,
      intensity: currentIntensity,
      history: recentHistory,
      userMessage: pendingUserMessage,
      streamerName,
      tier: currentTier,
      count: currentTier === 'turbo' ? 20 : 30,
      customPrompt,
      url: window.location.href
    });
    pendingUserMessage = '';

    if (generation !== fetchGeneration) { isFetching = false; return; }

    if (response.error) {
      setStatus('error');
      addMessage(`⚠️ ${response.error}`);
    } else {
      setStatus('live');
      scheduleMessages(response.messages);
      if (response.usage) accumulateUsage(response.usage);
    }
  } catch (err) {
    setStatus('error');
  }

  isFetching = false;
  fetchTimer = setTimeout(fetchAndSchedule, FETCH_INTERVAL_MS[currentTier] ?? 40000);
}

// ── Usage tracking ───────────────────────────────────────

async function accumulateUsage(usage) {
  const data = await chrome.storage.local.get('usage');
  const prev = data.usage || { inputTokens: 0, outputTokens: 0, fetches: 0 };
  chrome.storage.local.set({
    usage: {
      inputTokens: prev.inputTokens + (usage.input_tokens || 0),
      outputTokens: prev.outputTokens + (usage.output_tokens || 0),
      fetches: prev.fetches + 1
    }
  });
}

// ── Sensitive site detection ──────────────────────────────

const SENSITIVE_SITES = {
  // Email
  'mail.google.com': 'email service', 'inbox.google.com': 'email service',
  'outlook.com': 'email service', 'outlook.live.com': 'email service',
  'outlook.office.com': 'email service', 'outlook.office365.com': 'email service',
  'mail.yahoo.com': 'email service', 'protonmail.com': 'email service',
  'proton.me': 'email service', 'tutanota.com': 'email service',
  'fastmail.com': 'email service', 'icloud.com': 'email service',
  // Payments
  'paypal.com': 'payment service', 'venmo.com': 'payment service',
  'cash.app': 'payment service', 'wise.com': 'payment service',
  'revolut.com': 'payment service', 'pay.google.com': 'payment service',
  'payments.google.com': 'payment service', 'mobilepay.dk': 'payment service',
  'mobilepay.fi': 'payment service',
  // Password managers
  'lastpass.com': 'password manager', '1password.com': 'password manager',
  'app.1password.com': 'password manager', 'bitwarden.com': 'password manager',
  'vault.bitwarden.com': 'password manager', 'dashlane.com': 'password manager',
  'nordpass.com': 'password manager', 'keepersecurity.com': 'password manager',
  // Danish government / identity
  'skat.dk': 'government portal', 'borger.dk': 'government portal',
  'mitid.dk': 'digital identity service', 'e-boks.dk': 'government portal',
};

function getSensitiveCategory(hostname) {
  const h = hostname.replace(/^www\./, '');
  if (SENSITIVE_SITES[h]) return SENSITIVE_SITES[h];
  for (const domain of Object.keys(SENSITIVE_SITES)) {
    if (h.endsWith('.' + domain)) return SENSITIVE_SITES[domain];
  }
  // TLD patterns — universal, no manual list needed
  if (h.endsWith('.gov') || /\.gov\.[a-z]{2,3}$/.test(h)) return 'government portal';
  if (h.endsWith('.bank')) return 'banking service';
  if (h.endsWith('.mil')) return 'government portal';
  return null;
}

// ── Whitelist check ───────────────────────────────────────

async function isWhitelistBlocked() {
  const { whitelistMode, whitelist } = await chrome.storage.local.get(['whitelistMode', 'whitelist']);
  if (!whitelistMode) return false;
  const host = window.location.hostname.replace(/^www\./, '');
  const list = whitelist || [];
  return !list.some(h => host === h || host.endsWith('.' + h));
}

async function isSensitiveBlocked() {
  const host = window.location.hostname.replace(/^www\./, '');
  let sensitive = getSensitiveCategory(host) !== null;
  if (!sensitive) {
    const { customBlocklist } = await chrome.storage.local.get('customBlocklist');
    const list = customBlocklist || [];
    sensitive = list.some(h => host === h || host.endsWith('.' + h));
  }
  if (!sensitive) return false;
  const key = `site:${host}`;
  const stored = await chrome.storage.local.get(key);
  return !stored[key]?.sensitiveOverride;
}

// ── Consent gate ──────────────────────────────────────────

async function showConsentGate() {
  const gate = document.getElementById('ftc-consent-gate');
  if (!gate) return true;

  const context = getPageContext();
  const { aiProvider } = await chrome.storage.local.get('aiProvider');
  const providerName = aiProvider === 'openai' ? 'OpenAI' : 'Anthropic';
  const host = window.location.hostname.replace(/^www\./, '');

  document.getElementById('ftc-cg-provider').textContent = providerName;
  document.getElementById('ftc-cg-type').textContent = context.urlType;
  document.getElementById('ftc-cg-title').textContent = context.title || '(none)';
  const descEl = document.getElementById('ftc-cg-desc');
  if (context.description) {
    descEl.textContent = context.description;
    descEl.classList.remove('ftc-cg-empty');
  } else {
    descEl.textContent = 'None extracted';
    descEl.classList.add('ftc-cg-empty');
  }
  document.getElementById('ftc-cg-host').textContent = host;
  const promptRow = document.getElementById('ftc-cg-prompt-row');
  if (customPrompt) {
    document.getElementById('ftc-cg-prompt').textContent = customPrompt;
    promptRow.style.display = '';
  } else {
    promptRow.style.display = 'none';
  }
  gate.classList.add('ftc-visible');

  return new Promise(resolve => {
    document.getElementById('ftc-consent-allow').onclick = () => {
      gate.classList.remove('ftc-visible');
      resolve(true);
    };
    document.getElementById('ftc-consent-deny').onclick = () => {
      gate.classList.remove('ftc-visible');
      resolve(false);
    };
  });
}

// ── Enable / Disable ─────────────────────────────────────

async function enable() {
  if (await isWhitelistBlocked()) return;
  if (await isSensitiveBlocked()) return;
  isEnabled = true;
  isPaused = false;
  chrome.runtime.sendMessage({ type: 'SET_TAB_ENABLED', enabled: true }, () => { void chrome.runtime.lastError; });
  injectSidebar();
  startMessageDrip();
  if (currentTier !== 'free') {
    fetchAndSchedule();
  } else {
    setStatus('free');
    scheduleMessages(getFreeTierMessages(15));
  }
}

function disable() {
  isEnabled = false;
  isPaused = false;
  isCollapsed = false;
  chrome.runtime.sendMessage({ type: 'SET_TAB_ENABLED', enabled: false }, () => { void chrome.runtime.lastError; });
  clearTimeout(schedulerTimer);
  clearTimeout(fetchTimer);
  messageQueue = [];
  removeSidebar();
}

// ── Visibility ───────────────────────────────────────────

document.addEventListener('visibilitychange', () => {
  if (!isEnabled || isPaused) return;
  if (document.hidden) {
    clearTimeout(schedulerTimer);
    clearTimeout(fetchTimer);
  } else {
    startMessageDrip();
    if (currentTier !== 'free') fetchAndSchedule();
  }
});

// ── URL change detection ─────────────────────────────────

let lastUrl = location.href;
let urlChangeTimer = null;

setInterval(() => {
  if (!isEnabled) return;
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    messageQueue = [];
    chatHistory = []; // clear AI context on navigation — visible messages stay, but AI gets a clean slate for the new page
    clearTimeout(fetchTimer);
    clearTimeout(urlChangeTimer);
    fetchGeneration++;
    isFetching = true; // block drip loop from fetching with stale DOM context
    addNavSeparator();
    urlChangeTimer = setTimeout(() => {
      isFetching = false;
      if (isEnabled && currentTier !== 'free' && !isPaused) fetchAndSchedule();
    }, 1000);
  }
}, 1000);

// ── Message listener ─────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE') {
    if (message.enabled) enable(); else disable();
    sendResponse({ ok: true });
  }

  if (message.type === 'KEYBOARD_TOGGLE') {
    if (!isEnabled) enable();
    else if (isCollapsed) expandSidebar();
    else collapseSidebar();
    sendResponse({ ok: true });
  }

  if (message.type === 'GET_STATE') {
    sendResponse({ enabled: isEnabled, mode: currentMode, intensity: currentIntensity, tier: currentTier, fontSize: currentFontSize, streamerName });
  }

  if (message.type === 'SET_MODE') {
    currentMode = message.mode;
    messageQueue = [];
    chatHistory = [];
    clearTimeout(fetchTimer);
    isFetching = false;
    fetchGeneration++;
    if (currentTier !== 'free' && !isPaused) fetchAndSchedule();
    sendResponse({ ok: true });
  }

  if (message.type === 'SET_INTENSITY') {
    currentIntensity = message.intensity;
    messageQueue = [];
    clearTimeout(fetchTimer);
    isFetching = false;
    fetchGeneration++;
    if (currentTier !== 'free' && !isPaused) fetchAndSchedule();
    sendResponse({ ok: true });
  }

  if (message.type === 'SET_TIER') {
    currentTier = message.tier;
    clearTimeout(fetchTimer);
    isFetching = false;
    if (isEnabled && !isPaused) {
      if (currentTier === 'free') {
        setStatus('free');
        scheduleMessages(getFreeTierMessages(15));
      } else {
        fetchAndSchedule();
      }
    }
    sendResponse({ ok: true });
  }

  if (message.type === 'SET_STREAMER_NAME') {
    streamerName = message.name;
    sendResponse({ ok: true });
  }

  if (message.type === 'SET_FONT_SIZE') {
    applyFontSize(message.fontSize);
    chrome.storage.local.set({ fontSize: message.fontSize });
    sendResponse({ ok: true });
  }
});

// ── Auto-enable on navigation ─────────────────────────────
// If the user had chat active and navigated to a new page (full reload),
// re-enable automatically using the stored site settings.

chrome.runtime.sendMessage({ type: 'GET_TAB_ENABLED' }, ({ enabled } = {}) => {
  void chrome.runtime.lastError;
  if (!enabled) return;
  const host = window.location.hostname;
  chrome.storage.local.get([`site:${host}`, 'sidebarTheme'], (result) => {
    const s = result[`site:${host}`] || {};
    if (s.mode)              currentMode      = s.mode;
    if (s.tier)              currentTier      = s.tier;
    if (s.intensity != null) currentIntensity = s.intensity;
    if (s.fontSize)          currentFontSize  = s.fontSize;
    if (result.sidebarTheme) currentTheme     = result.sidebarTheme;
    enable();
  });
});
