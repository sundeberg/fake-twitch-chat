# Claude Instructions — Fake Twitch Chat

## On every new session

Read the following files before doing anything else:

1. `context.md` — full project context, architecture, and current state
2. `todo.md` — what needs doing right now
3. `plan.md` — roadmap and upcoming milestones

Also check memory files at:
`C:\Users\Mathias Søndberg\.claude\projects\C--Users-Mathias-S-ndberg-projects-fake-twitch-chat\memory\`

These files are gitignored and local only. They represent the ground truth for where the project is at.

## Project conventions

- No em dashes anywhere in user-facing text or documentation
- Exact domain matching in all routing (`host === domain || host.endsWith('.' + domain)`) — never substring includes
- All security checks (whitelist, sensitive site, custom blocklist) are async and read fresh from storage each time
- SENSITIVE_SITES is duplicated in content.js and popup.js by necessity (no shared modules in MV3) — keep them in sync
- The consent gate, sensitiveOverride, and contextApproved flags are all stored per `site:${host}`
- customBlocklist is a flat array of hostnames in chrome.storage.local
- Turbo tier: 20 messages per batch, ~12s fetch interval, prefetch at 8 remaining, last 20 messages / 120s history window
- Standard tier: 30 messages per batch, 40s fetch interval, prefetch at 5 remaining, last 10 messages / 90s history window
