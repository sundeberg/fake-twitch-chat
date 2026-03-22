# Fake Twitch Chat

A Chrome extension that injects a live, AI-powered Twitch-style chat sidebar into any webpage. The chat reads the content of whatever you're looking at (a YouTube video, a Reddit post, a GitHub repo, a news article) and generates realistic, chaotic, and occasionally hilarious fake Twitch chat messages reacting to it in real time.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-Support%20this%20project-FFDD00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sundeberg)

> Contributions go toward running a hosted API proxy so users never need to bring their own API key.

---

## Features

### AI-Powered Chat Generation
The extension sends page context (title, description, and site-specific content) to the selected AI model, which generates batches of authentic-feeling Twitch chat messages. Messages follow real Twitch chat patterns: short bursts, emote spam, bandwagon reactions, recurring personalities, and the occasional unhinged off-topic comment.

### Six Chat Personality Modes
Switch between fundamentally different chat personalities from the popup:

| Mode | Behavior |
|------|----------|
| **Default** | Mixed crowd: hype, toxic, wholesome, and bad takes all at once |
| **Hype Train** | Pure unfiltered excitement. Everything is incredible. W W W. |
| **Toxic** | Sarcastic, mocking, never impressed. Skill issue. Ratio. |
| **Wholesome** | Supportive and kind. You got this. W human being. |
| **Backseaters** | Everyone knows better. Unsolicited advice, maximum confidence. |
| **Clueless** | Every chatter is confidently wrong about something completely different. No shared reality. |

### Intensity Slider
A 0-10 slider controls how strongly the selected personality comes through. At 0 it is almost indistinguishable from normal chat. At 10 it is fully unhinged with nothing held back, but always reacting to what is actually on the page.

### Three Tiers

| Tier | Description | Cost |
|------|-------------|------|
| **Free** | Hardcoded message pools per mode. No API key needed. No AI. | Free |
| **Standard** | AI-powered. Fetches 30 messages at a time, refetches every 40s, pre-fetches when the queue drops below 5. | ~$0.15-0.18/hr (Anthropic) |
| **Turbo** | Smaller batches of 20 messages fetched every 10-12s, with a pre-fetch trigger at 8 messages remaining. A larger context window (last 20 messages / 120s vs Standard's 10 / 90s) gives the AI more conversation history to work with. About 30% of messages are inter-chatter responses where chatters call each other out by name, argue, agree, or dunk on each other. About 3x the hourly cost of Standard, driven by fetch frequency rather than per-fetch price. | ~$0.45-0.55/hr (Anthropic) |

### Multi-Provider AI Support
Choose between Anthropic (Claude Haiku) and OpenAI (GPT-4o mini) from the Settings page. Both keys are saved separately so you can switch providers without re-entering credentials. OpenAI is approximately 5x cheaper than Anthropic for the same usage.

### BTTV Emote Rendering
Emote names in chat messages are replaced with real animated images sourced from the BetterTTV CDN. Supported emotes include KEKW, OMEGALUL, GIGACHAD, catJAM, Pog, PogChamp, PauseChamp, Sadge, copium, LULW, and the full BTTV global emote set (monkaS, haHAA, FeelsBadMan, FeelsGoodMan, SourPls, and more). Global emotes are fetched once from the BTTV API and cached for 24 hours.

### Chat Follows You Across Navigation
Enable the chat once and it stays with you as you browse. On single-page apps (YouTube, Reddit, Twitter/X) a subtle separator line appears in the chat when you navigate. On full page navigations the chat auto-enables on the new page using your saved settings. Auto-enable is tracked per tab so enabling on one tab does not affect other tabs, and the state clears when the browser closes.

### Chat Memory with Time-Based Decay
Each AI fetch includes recent messages as context. In Standard, the last 10 messages from the past 90 seconds are included. In Turbo, the last 20 messages from the past 120 seconds are included, giving chatters more to respond to each other with. Messages older than the window naturally fade from context, preventing the chat from looping on a single topic indefinitely.

### Turbo Inter-Chatter Dynamics
In Turbo mode, the AI receives the full chat history with usernames attached (e.g. `[pogmaster3000]: bro this is fire`). This lets chatters call each other out by name, agree or disagree with specific people, and build running threads, all grounded in what is on screen. Inter-chatter responses only kick in after 5 real messages have accumulated, preventing hallucinated conversations on cold start.

### You Can Talk to the Chat
A message input bar sits at the bottom of the sidebar. Type something and press Enter or click send. Your message appears immediately in chat with a purple accent and your streamer name, and the next AI batch reacts specifically to what you said.

### Streamer Name
Set your name in the popup or in Settings. The chat will occasionally address you by name, and your messages appear under that name in the sidebar.

### Smart Page Context
The extension reads different things depending on what site you are on:

| Site | What it reads |
|------|--------------|
| **YouTube** | Video title, channel name, description excerpt, current chapter |
| **Reddit** | Post title, post body, top 3 comments (top-level only, replies excluded) |
| **Twitter / X** | Author name, up to 2 visible tweet texts |
| **GitHub** | Repo name, description, README excerpt |
| **Twitch** | Streamer name, stream title, game |
| **Wikipedia** | Article title, opening paragraph |
| **Netflix** | Show or movie name, whether a watch session is active |
| **Google Docs / Sheets / Slides** | Page title, whatever text is available in the page shell |
| **Everything else** | Page title, meta description, first 3 article paragraphs |

All extracted content is sanitized before being sent to the API. Character limits are applied to all fields (150 chars for titles, 800 chars for descriptions) to keep prompts focused and costs predictable.

### Per-Site Settings
Mode, tier, intensity, and font size are saved per hostname. Visiting YouTube will restore your YouTube settings; Reddit restores your Reddit settings.

### Sidebar Controls
- **Collapse:** click the `<` button in the sidebar header to collapse the sidebar to a 36px strip. Chat pauses while collapsed (no API calls). Click the strip or press `Alt+T` to expand again.
- **Drag to resize:** grab the left edge of the sidebar and drag to any width between 220-520px. Width is saved to storage.
- **Pause / Resume:** pause the message drip without disabling the extension.
- **Theme toggle:** switches between dark and light mode. Initialises from your system preference and persists across sessions. Synced between the sidebar and popup.
- **Clip:** takes the last 12 messages and renders them to a 2x resolution PNG card for sharing.
- **Font size:** S / M / L buttons in the popup (11px / 13px / 15px), saved per site.
- **Keyboard shortcut:** `Alt+T` cycles the sidebar: off, active, collapsed, active.

### Page Content Push
On sites with standard document flow (GitHub, Reddit, news sites, blogs), the sidebar pushes page content to the left rather than overlaying it. On SPAs and sites with custom layouts (YouTube, Gemini), the sidebar floats over the page.

### Tab Visibility Awareness
The extension pauses fetching and the message drip when the tab is in the background, and resumes automatically when you switch back.

### Usage Tracking
The popup shows estimated cost, total API calls, and total tokens used since the last reset. Based on Claude Haiku pricing ($0.80/1M input, $4.00/1M output). Cost estimates will be higher than actual for OpenAI users.

---

## How It Works

### File Structure

| File | Role |
|------|------|
| `popup.html` / `popup.js` | Extension popup: enable toggle, tier, mode, intensity, font size, usage stats |
| `options.html` / `options.js` | Settings page: API keys, provider selection, whitelist, custom blocklist, consent gate toggle |
| `content.js` | Injected into every page: sidebar UI, context extraction, message drip, security checks |
| `sidebar.css` | Sidebar styles, scoped entirely to `#ftc-sidebar` so they never affect the host page |
| `background.js` | Service worker: API calls, BTTV emote cache, tab session state |
| `manifest.json` | Extension manifest (Manifest V3) |

### Message Flow

1. The user enables chat on a page via the popup toggle.
2. `content.js` runs the appropriate context extractor for the current site (YouTube, Reddit, GitHub, etc.) and collects the page context: title, description, and any site-specific content.
3. If this is the first time the extension has run on this hostname, a consent gate overlays the sidebar showing exactly what will be extracted and which AI provider it will go to. The user approves once and is never asked again for that site.
4. `content.js` sends a `FETCH_MESSAGES` message to `background.js`, including the page context, selected mode, intensity, tier, recent chat history (with usernames in Turbo), and any pending user message.
5. `background.js` calls the selected AI provider (Anthropic or OpenAI) with a crafted system and user prompt. The system prompt defines the personality and rules; the user prompt contains the page context and history.
6. The AI returns a JSON array of chat message strings. Each message is a short, authentic-sounding Twitch chat line.
7. `content.js` queues the messages and drips them into the sidebar one at a time. Each message has a randomised delay (250-1700ms depending on tier) and there is a 20% chance of a burst where 2-3 messages fire in quick succession. Emote names are replaced with BTTV images before rendering.
8. When the queue drops below the prefetch threshold (5 messages in Standard, 8 in Turbo), a new fetch is triggered automatically so the chat never runs dry.

### Turbo Mode Prompt Design
In Turbo, the AI receives the full chat history with usernames attached and is instructed to make approximately 30% of messages chatters responding to each other by name. The remaining 70% react to the page content as normal. The inter-chatter instruction is only injected when 5 or more real messages exist in history, preventing the AI from fabricating conversations on a cold start before any real chat has accumulated.

### Fetch Generation System
Every fetch call captures the current `fetchGeneration` counter before firing. If the URL changes or the mode is switched while a fetch is in-flight, the counter increments. When the response arrives, it is silently discarded if its generation does not match the current one. This prevents stale responses from a previous page appearing in the new chat.

### Context Extraction
Each supported site has a dedicated extractor that targets specific DOM elements rather than reading raw page content. Reddit comments use `shreddit-comment[depth="0"]` to select only top-level comments, with nested replies stripped via DOM cloning before the text is read. Twitter/X strips notification counts and quoted tweet text from the tab title to avoid duplication with the extracted tweet body. All domain routing uses exact hostname matching (`host === domain` or `host.endsWith('.' + domain)`) so sites with overlapping names are never misidentified.

---

## Security and Privacy

This extension reads visible page content and sends it to an external AI API. That is its entire job, and it is designed to be fully transparent about it.

### Four-Layer Protection Model

**1. Sensitive site blocking**

A hardcoded list of known sensitive hostnames is blocked by default. This includes major email providers (Gmail, Outlook, ProtonMail), payment services (PayPal, Wise, Revolut, MobilePay), password managers (Bitwarden, 1Password, Dashlane), and Danish government portals (skat.dk, borger.dk, mitid.dk, e-boks.dk). Any domain using a `.gov`, `.bank`, or `.mil` top-level domain is also blocked universally. Blocking applies to all subdomains, not just exact matches.

When you visit a blocked site, the popup shows a warning explaining the site type. A clearly labelled confirm button lets you enable the extension if you choose to, and that decision is saved per site. You will not be asked again on that site unless you clear your data.

**2. Custom blocked sites**

In Settings, you can add your own list of hostnames that should always show the sensitive site warning. Paste any URL or enter a hostname directly. These are treated identically to the hardcoded list and stored locally in your browser. This is useful for sites that matter to you personally but are not covered by the built-in list, such as your bank or your workplace portal.

**3. Whitelist mode**

An optional mode in Settings that locks the extension to a user-defined list of approved hostnames. The enable toggle and keyboard shortcut are fully disabled on every other site. Useful if you only want the extension active on a small set of trusted sites.

**4. Per-site consent gate**

Before the very first API call on any hostname, the sidebar shows a preview of exactly what will be extracted: the site type, the page title, and the context excerpt that would be sent, plus which AI provider it goes to. You approve once per site and are never asked again. This can be turned off in Settings for users who prefer a smoother experience.

**5. Free tier**

No API calls are made. No data ever leaves the browser.

### What Actually Gets Extracted

The extension does not scrape raw page content. It targets specific structural elements depending on the site:

| Site | Extracted |
|------|-----------|
| YouTube | Video title, channel name, description excerpt, current chapter |
| Reddit | Post title, post body (capped), top 3 comments (top-level only, replies excluded) |
| Twitter / X | Author name, up to 2 visible tweet texts |
| GitHub | Repo name, description, README excerpt |
| Twitch | Stream title, streamer name, game |
| Wikipedia | Article title, opening paragraph |
| Netflix | Show or movie name only |
| Google Docs / Sheets / Slides | Page title, whatever text is available in the page shell |
| Everything else | Page title, meta description, first 3 article paragraphs |

All fields have hard character limits: 150 characters for titles, 800 characters for descriptions. Content is sanitized before being embedded in any prompt: newlines stripped to prevent prompt injection, HTML escaped before rendering to prevent XSS.

### Additional Technical Measures

- API keys are stored in `chrome.storage.local`, sandboxed to the extension, and only ever sent to the selected provider's API endpoint.
- User input typed into the chat bar is sanitized before being embedded in the prompt. Newlines, tabs, and angle brackets are stripped.
- All text rendered in the sidebar is HTML-escaped before any emote substitution takes place.
- The AI providers (Claude Haiku, GPT-4o mini) apply their own content policies and will not generate slurs, explicit content, or genuinely harmful messages regardless of the personality mode selected.

### How to Verify This Yourself

You do not have to take any of the above on faith. Here is how to check independently:

- **Read the source.** The code that runs in your browser is the exact JavaScript in this repository. There is no build step, no bundler, no compiled output. Open `content.js` and search for `getPageContext` to see every extractor. Open `background.js` to see every network call the extension can make.
- **Check the manifest.** Open `manifest.json` and look at the `host_permissions` field. Chrome enforces these at the browser level. The extension is structurally incapable of making network requests to any domain not listed there, regardless of what the code says.
- **Watch your API usage.** Every call the extension makes shows up on your Anthropic or OpenAI usage dashboard. If anything was being sent elsewhere, your API key would travel with it and the call count would not match your browsing.

---

## Installation

> This extension is not yet on the Chrome Web Store. Install it manually as an unpacked extension.

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `fake-twitch-chat` folder
5. Click the extension icon and open **Settings**
6. Select your AI provider and paste your API key
7. Navigate to any page, open the popup, and enable the chat

---

## Usage Tips

- **Free tier** works out of the box with no API key needed.
- **Standard tier** is the sweet spot for regular use. Cost is negligible for personal browsing.
- **Turbo tier** makes the chat feel like a real crowd. Chatters argue with each other, reference what was just said, and build running jokes. About 3x the cost of Standard but still cheap in absolute terms.
- **Type something** in the input bar. The chat reacting to you personally is one of the best parts.
- **Collapse** the sidebar (`<` button or `Alt+T`) on sites where the overlay is in the way. Chat pauses while collapsed so you are not spending tokens in the background.
- The **clip button** (camera icon) is great for sharing funny moments.
- **Clueless** mode works best on sites with recognizable content because the contrast between what is on screen and what chat thinks is happening is funnier.

---

## Planned / Future

- **Hosted API proxy:** removes the need for users to bring their own API key.
- **Chrome Web Store listing:** public install link.
- **More context sources:** Spotify and similar.
- **Emote images in clip card:** render actual BTTV emote images in the PNG export.

---

## Cost Reference

| | Anthropic (Claude Haiku) | OpenAI (GPT-4o mini) |
|--|-------|--------|
| Input price | $0.80 / 1M tokens | $0.15 / 1M tokens |
| Output price | $4.00 / 1M tokens | $0.60 / 1M tokens |
| Standard, 1 hour (~90 fetches) | ~$0.15-0.18 | ~$0.03-0.04 |
| Turbo, 1 hour (~300-360 fetches) | ~$0.45-0.55 | ~$0.08-0.12 |

Actual costs vary based on page content length and history size. The usage tracker in the popup shows your running total since the last reset.
