const apiKeyInput       = document.getElementById('api-key');
const streamerNameInput = document.getElementById('streamer-name');
const saveBtn           = document.getElementById('save');
const savedMsg          = document.getElementById('saved-msg');
const toggleVisibility  = document.getElementById('toggle-visibility');

// Load saved values
chrome.storage.local.get(['apiKey', 'streamerName'], ({ apiKey, streamerName }) => {
  if (apiKey) apiKeyInput.value = apiKey;
  if (streamerName) streamerNameInput.value = streamerName;
});

// Save
saveBtn.addEventListener('click', () => {
  const key  = apiKeyInput.value.trim();
  const name = streamerNameInput.value.trim();
  if (!key) return;
  chrome.storage.local.set({ apiKey: key, streamerName: name }, () => {
    savedMsg.style.display = 'block';
    setTimeout(() => { savedMsg.style.display = 'none'; }, 2500);
  });
});

// Show/hide key toggle
toggleVisibility.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleVisibility.textContent = isPassword ? 'Hide key' : 'Show key';
});
