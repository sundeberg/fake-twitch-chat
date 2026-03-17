const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are simulating a fast-moving Twitch chat.
Your job is to generate short, chaotic, realistic Twitch-style chat messages reacting to a moment.

Rules:
- Messages MUST be very short (1–8 words max)
- Use slang, memes, and informal language
- Do NOT write full sentences unless it feels natural
- Some messages should be repetitive or similar
- Include occasional emote-style words (e.g. KEKW, LUL, Pog, W, L, PauseChamp, OMEGALUL, copium, GIGACHAD)
- Some users should repeat the same message in slightly different ways
- Mix lowercase and uppercase messages
- Do NOT explain anything
- Do NOT narrate
- Do NOT describe the situation
- ONLY output chat messages

Behavior:
- 20–40% of messages should be short reactions like: "W", "L", "NO WAY", "BRO", "KEKW"
- 20–30% should be slightly longer reactions
- Some messages should be duplicates or near-duplicates (bandwagon effect)
- Occasionally include 1–2 weird or off-topic messages
- Include 2–3 recurring "users" who repeat similar phrases or styles across the batch
- If a streamer name is provided, occasionally address them by name naturally (not every message)
- If recent chat history is provided, build on it — reference jokes, continue threads, feel like the same conversation
- If the streamer sent a message, have multiple chatters react to it specifically

Output format:
Return ONLY a valid JSON array of strings.
No explanation, no markdown, no code block. Just the raw JSON array.
Example: ["NO WAY", "WTF WAS THAT", "bro got lucky", "CLIP THAT", "LMAOOO", "W", "W", "W"]`;

const PERSONALITIES = {
  default: {
    label: 'Default',
    modifier: 'Mixed chat — some toxic, some hype, some dumb takes, some wholesome. Realistic variety of personalities.'
  },
  hype: {
    label: 'Hype Train',
    modifier: 'Pure hype and excitement. Everything is incredible and amazing. Lots of caps, "W", "Pog", "LETS GO", celebration emotes. Absolutely no negativity. Everyone is hyped beyond reason.'
  },
  toxic: {
    label: 'Toxic',
    modifier: 'Sarcastic, mocking, and doubting. Lots of "L", "skill issue", "ratio", "report him", roasting. Mean-spirited but not hateful or slur-based. Chat is never impressed.'
  },
  wholesome: {
    label: 'Wholesome',
    modifier: 'Supportive, positive, and friendly. Celebrate everything, encourage the streamer, be kind. Use hearts, "W", "you got this". No negativity whatsoever.'
  },
  backseaters: {
    label: 'Backseaters',
    modifier: 'Everyone is giving unsolicited advice as if they know better. "bro just do X", "why didn\'t you Y", "I would have done Z", acting like experts. Annoying but confident.'
  },
  clueless: {
    label: 'Clueless',
    modifier: 'Every chatter is confidently wrong about something completely different. There is no shared reality in this chat — nobody agrees on what they are watching, and none of them are right. Each message comes from its own alternate universe. State wrong things with total confidence and be specific. Never acknowledge the actual content. No two consecutive messages should be wrong about the same thing. Draw from the full range of human activities, hobbies, media, and events — be unpredictable and varied.'
  }
};

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-sidebar') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'KEYBOARD_TOGGLE' }, () => {
          void chrome.runtime.lastError;
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_MESSAGES') {
    handleFetchMessages(
      message.context,
      message.mode,
      message.intensity,
      message.history,
      message.userMessage,
      message.streamerName,
      message.count
    ).then(sendResponse);
    return true;
  }
});

const INTENSITY_DESCRIPTIONS = {
  0:  'completely flat — almost no personality, indistinguishable from normal chat',
  1:  'extremely mild and barely noticeable — almost indistinguishable from normal chat',
  2:  'very subtle, only slight hints of the personality come through',
  3:  'mild — the personality is present but restrained',
  4:  'moderate — clearly noticeable but not overwhelming',
  5:  'balanced — a solid, clear expression of the personality',
  6:  'strong — the personality dominates most messages',
  7:  'very strong — leaning into extremes, little restraint',
  8:  'intense — exaggerated and over the top',
  9:  'extreme — nearly unhinged, pushed as far as reasonable',
  10: 'maximum — take the personality to its absolute limit, nothing held back, fully unhinged'
};

function sanitizeUserInput(text) {
  return text
    .replace(/[\r\n\t]/g, ' ')   // no newlines — prevents prompt injection via line breaks
    .replace(/[<>]/g, '')         // no angle brackets
    .trim()
    .substring(0, 200);
}

async function handleFetchMessages(context, mode = 'default', intensity = 5, history = [], userMessage = '', streamerName = '', count = 30) {
  userMessage = sanitizeUserInput(userMessage);
  const { apiKey } = await chrome.storage.local.get('apiKey');

  if (!apiKey) {
    return { error: 'No API key set. Click the extension icon → Settings to add your Claude API key.' };
  }

  const personality = PERSONALITIES[mode] || PERSONALITIES.default;

  let historySection = '';
  if (history.length > 0) {
    historySection = `\nRecent chat (build on this naturally, don't repeat exactly):\n${history.map(h => `- ${h}`).join('\n')}`;
  }

  let userSection = '';
  if (userMessage) {
    const name = streamerName || 'the streamer';
    userSection = `\n${name} just typed in chat: "${userMessage}" — have several chatters react to this specifically.`;
  }

  const nameSection = streamerName ? `\n- Streamer name: ${streamerName} (address them occasionally, not every message)` : '';

  const userPrompt = `Context:
- Page title: ${context.title}
- Site type: ${context.urlType}
- Description: ${context.description}
- Current year: ${new Date().getFullYear()}
- Chat personality: ${personality.modifier}
- Intensity: ${intensity}/10 — ${INTENSITY_DESCRIPTIONS[intensity]}${nameSection}${historySection}${userSection}

Generate ${count} Twitch chat messages reacting to this content.`;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error?.message || `API error: ${response.status}` };
    }

    let text = data.content[0].text.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const messages = JSON.parse(text);
    return { messages, usage: data.usage };

  } catch (err) {
    return { error: err.message };
  }
}
