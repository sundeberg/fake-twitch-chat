# Fake Twitch Chat

A Chrome extension that injects a live, AI-powered Twitch-style chat sidebar into any webpage. The chat reads the content of whatever you're looking at — a YouTube video, a Reddit post, your CV, a GitHub repo — and generates realistic, chaotic, and occasionally hilarious fake Twitch chat messages reacting to it in real time.

Built with Claude Haiku via the Anthropic API.

---

## Features

### AI-Powered Chat Generation
The extension sends page context (title, description, and site-specific content) to Claude Haiku, which generates batches of authentic-feeling Twitch chat messages. Messages follow real Twitch chat patterns: short bursts, emote spam, bandwagon reactions, recurring "personalities", and the occasional unhinged off-topic comment.

### Six Chat Personality Modes
Switch between fundamentally different chat personalities from the popup:

| Mode | Behavior |
|------|----------|
| **Default** | Mixed crowd — hype, toxic, wholesome, and dumb takes all at once |
| **Hype Train** | Pure unfiltered excitement. Everything is incredible. W W W. |
| **Toxic** | Sarcastic, mocking, never impressed. Skill issue. Ratio. |
| **Wholesome** | Supportive and kind. You got this. W human being. |
| **Backseaters** | Everyone knows better. Unsolicited advice, maximum confidence. |
| **Clueless** | Every chatter is confidently wrong about something completely different. No shared reality. |

### Intensity Slider
A 0–10 slider controls how strongly the selected personality comes through. At 0 it's almost indistinguishable from normal chat. At 10 it's fully unhinged with nothing held back.

### Three Tiers

| Tier | Description | Cost |
|------|-------------|------|
| **Free** | Hardcoded message pools per mode. No API key needed. No AI. | Free |
| **Standard** | AI-powered. Fetches 30 messages at a time, refetches every 40s, pre-fetches when queue drops below 5. Efficient and cost-aware. | ~$0.001–0.002 per fetch |
| **Constant** | AI-powered. Fetches 50 messages at a time, refetches every 25s, pre-fetches when queue drops below 15. Faster drip speed (150–1050ms between messages vs 300–1700ms). Noticeably more active chat. | ~$0.002–0.003 per fetch |

### Chat Memory with Time-Based Decay
Each AI fetch includes the last 10 messages from the past 90 seconds as context. Claude uses this to build on running jokes, reference what was just said, and feel like a continuous conversation rather than 30 unrelated one-liners. Messages older than 90 seconds naturally fade from context, preventing the chat from looping on a single topic indefinitely.

### You Can Talk to the Chat
A message input bar sits at the bottom of the sidebar. Type something and press Enter or click send — your message appears immediately in chat with a purple accent and your streamer name, and the next AI batch reacts specifically to what you said. The chat will argue with you, agree with you, ask follow-up questions, or go completely off the rails.

### Streamer Name
Set your name in the popup (or in Settings). The chat will occasionally address you by name, and your messages appear under that name in the sidebar.

### Smart Page Context
The extension reads different things depending on what site you're on:

| Site | What it reads |
|------|--------------|
| **YouTube** | Video title, channel name, description, current chapter |
| **Reddit** | Post title, post body, top 3 comments |
| **Twitter / X** | First 2 visible tweets |
| **GitHub** | Repo name, description, README excerpt |
| **Twitch** | Streamer name, stream title, game |
| **Everything else** | Page title, meta description, `<article>` paragraph text |

All extracted content is sanitized before being sent to the API — newlines are stripped to prevent prompt injection via page content.

### Per-Site Settings
Mode, tier, intensity, and font size are saved per hostname. Visiting YouTube will restore your YouTube settings; Reddit restores your Reddit settings. Automatically applied when you open the popup on a known site.

### SPA Navigation Detection
Single-page apps (YouTube, Reddit, Twitter) don't reload the page on navigation. The extension detects URL changes via polling, waits 1500ms for the DOM to settle, then fetches fresh context. Chat history and the message queue are cleared on navigation so old content doesn't bleed into a new page.

### Sidebar Controls
- **Drag to resize** — grab the left edge of the sidebar and drag to any width between 220–520px. Width is saved to storage.
- **Pause / Resume** — pause the message drip without disabling the extension. Pre-fetching also pauses.
- **Clip** — takes the last 12 messages and renders them to a 2× resolution PNG card, which downloads directly. Ready to paste into Discord, post on Twitter, or share anywhere.
- **Font size** — S / M / L buttons in the popup (11px / 13px / 15px), saved per site.
- **Keyboard shortcut** — `Alt+T` toggles the sidebar from anywhere without opening the popup.

### Tab Visibility Awareness
The extension pauses fetching and the message drip when the tab is in the background, and resumes automatically when you switch back to it.

### Usage Tracking
The popup shows estimated cost, total API calls, and total tokens used since the last reset. Based on Haiku pricing ($0.80/1M input, $4.00/1M output).

---

## How It Works

### Architecture

```
popup.html / popup.js         — Extension popup UI (controls, settings, stats)
options.html / options.js     — API key + streamer name settings page
content.js                    — Injected into every page (sidebar, logic, context reading)
sidebar.css                   — Sidebar styles (scoped to #ftc-sidebar)
background.js                 — Service worker (API calls to Claude)
manifest.json                 — Extension manifest (MV3)
```

### Message Flow

```
1. User enables chat on a page
2. content.js reads the page context (title, description, etc.)
3. content.js sends a FETCH_MESSAGES message to background.js
   — includes: context, mode, intensity, recent chat history, any pending user message
4. background.js calls the Claude Haiku API with a crafted system + user prompt
5. Claude returns a JSON array of 30–50 chat message strings
6. content.js queues the messages and drips them into the sidebar
   — random delay between messages (150–1700ms depending on tier)
   — 20% chance of a burst (2–3 messages at once)
7. When the queue runs low, a new fetch is triggered automatically
```

### Fetch Generation System
Every fetch call captures the current `fetchGeneration` counter. If the URL changes or the mode is switched while a fetch is in-flight, the counter is incremented. When the response arrives, it's discarded if its generation doesn't match the current one — preventing stale content from a previous page appearing in the new chat.

### Prompt Structure
Each API call uses a fixed system prompt defining Twitch chat behavior rules, and a dynamic user prompt containing:
- Page title, site type, and description
- Chat personality modifier for the selected mode
- Intensity level (0–10) with a plain-English description
- Streamer name (if set)
- Recent chat history (last 10 messages, max 90 seconds old)
- The streamer's typed message, if any

### Security
- **API key** stored in `chrome.storage.local` — sandboxed to the extension, never sent anywhere except `api.anthropic.com`
- **User input sanitized** before being embedded in the prompt — newlines, tabs, and angle brackets are stripped to prevent prompt injection
- **Page content sanitized** — all six context extractors flatten newlines from extracted DOM text before it reaches the prompt
- **XSS prevention** — all text rendered in the sidebar and the clip card is HTML-escaped. Color values from the DOM are filtered to valid CSS characters only.
- **Content policy** — Claude Haiku will not generate slurs, explicit content, or genuinely harmful messages regardless of the selected personality mode

---

## Installation

> This extension is not yet on the Chrome Web Store. Install it manually as an unpacked extension.

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `fake-twitch-chat` folder
5. Click the extension icon → **API Key Settings**
6. Paste your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))
7. Navigate to any page, open the popup, and enable the chat

---

## Usage Tips

- **Free tier** works out of the box — no API key needed. Messages are hardcoded but still react to personality mode.
- **Standard tier** is the sweet spot for regular use. Cost is negligible for personal browsing.
- **Constant tier** is for when you want the chat to feel like a live stream — faster pace, bigger batches, more variety.
- The **Clueless** mode works best on sites with recognizable content (YouTube, GitHub, news articles) because the contrast between what's on screen and what chat thinks is happening is funnier.
- **Type something** in the input bar — the chat reacting to you personally is one of the best parts.
- The **clip button** (camera icon) is great for sharing funny moments. It renders a clean PNG card of the last 12 messages.
- Use `Alt+T` to toggle the sidebar without interrupting whatever you're doing.

---

## Planned / Future

- **Hosted API proxy** — removes the need for users to bring their own Anthropic API key. Rate-limited per user.
- **Chrome Web Store listing** — public install link for friends and wider sharing.
- **Emote rendering** — render known Twitch emote names (KEKW, PogChamp, etc.) as styled badges or images inline.
- **More context sources** — Netflix, Spotify, news sites, Google Docs.

---

## Cost Reference

All AI tiers use **Claude Haiku** (`claude-haiku-4-5-20251001`).

| | Input | Output |
|--|-------|--------|
| Price | $0.80 / 1M tokens | $4.00 / 1M tokens |
| Per fetch (Standard, ~30 msgs) | ~600–800 tokens | ~250–350 tokens |
| Per fetch (Constant, ~50 msgs) | ~650–850 tokens | ~400–500 tokens |
| Cost per fetch | ~$0.0015–0.002 | |
| 1 hour of Standard use (~90 fetches) | ~$0.13–0.18 | |
| 1 hour of Constant use (~144 fetches) | ~$0.22–0.30 | |

Actual costs vary based on page content length and history size. The usage tracker in the popup shows your running total since the last reset.
