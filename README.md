# 🕐 Tab Time Tracker

> Track how long you spend on each website. 100% local, no account, no cloud.

---

## ✨ Features

- **Automatic tracking** — records time on every site you visit, no setup needed
- **Category breakdown** — sorts sites into Work, Learning, Social, Entertainment, and Other
- **Today / Week / Month views** — with comparisons to the previous period
- **Live indicator** — shows exactly what's being tracked right now
- **Idle detection** — pauses automatically when you step away
- **Export** — download all your data as JSON anytime
- **9 themes** — Dark, Catppuccin Mocha, Catppuccin Latte, Tokyo Night, Rosé Pine, Gruvbox, Nord, Dracula, Solarized

---

## 📦 Install on Chrome

1. Download and unzip this repo
2. Go to `chrome://extensions/`
3. Toggle **Developer mode** ON (top right)
4. Click **Load unpacked**
5. Select the `Tab-Time-Tracker-Extension` folder
6. The extension icon will appear in your toolbar!

## 🦊 Install on Firefox 

It will soon be available on the firefox add-ons store

---

## 🗂 File Structure

```
Tab-Time-Tracker-Extension/
├── manifest.json     — Extension config & permissions
├── background.js     — Tracks time in the background
├── popup.html        — Popup UI structure
├── popup.css         — Styling & all 9 themes
├── popup.js          — Popup logic & data rendering
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## ⚙️ How It Works

- `background.js` listens to tab switches, URL changes, window focus, and idle state
- Time is stored locally using `storage.local` keyed by date (e.g. `data_2025-05-16`)
- No data ever leaves your device — everything stays in your browser
- The popup reads from storage and renders everything fresh on each open

---

## 🔒 Permissions

| Permission | Why |
|---|---|
| `tabs` | Detect active tab and URL |
| `storage` | Save time data locally |
| `alarms` | Flush time data every 30 seconds |
| `idle` | Pause tracking when you step away |
| `<all_urls>` | Read tab URLs for any website |

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.**
