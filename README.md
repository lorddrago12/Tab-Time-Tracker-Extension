# Tab Time Tracker — Chrome Extension

Track how long you spend on each website. 100% local, no account, no cloud.

## Features
- Tracks active tab time automatically
- Breaks down by category: Work, Learning, Social, Entertainment, Other
- Today / Week / Month views with comparison to previous period
- Live indicator showing what's being tracked right now
- Export all data as JSON
- Idle detection — pauses when you're away

## How to install (Developer Mode)

1. Download and unzip this folder
2. Open Chrome and go to `chrome://extensions/`
3. Toggle **Developer mode** ON (top right)
4. Click **Load unpacked**
5. Select this `tab-time-tracker` folder
6. The extension icon will appear in your toolbar — click it!

## File structure

```
tab-time-tracker/
├── manifest.json    — Extension config & permissions
├── background.js    — Service worker: tracks time in background
├── popup.html       — Popup UI structure
├── popup.css        — Popup styling
├── popup.js         — Popup logic & data rendering
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## How it works

- `background.js` listens to tab switches, URL changes, window focus, and idle state
- Time is stored in `chrome.storage.local` keyed by date (e.g. `data_2025-05-16`)
- No data ever leaves your device
- Popup reads from storage and renders everything on open

## Permissions used

| Permission | Why |
|---|---|
| `tabs` | Detect active tab and URL |
| `storage` | Save time data locally |
| `alarms` | Flush time data every 30 seconds |
| `idle` | Pause tracking when you step away |
| `<all_urls>` | Read tab URLs for any website |
