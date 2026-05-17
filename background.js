// background.js — Tab Time Tracker service worker
// Tracks active tab time locally using chrome.storage.local

const IDLE_THRESHOLD = 60; // seconds before considered idle

let activeTabId = null;
let activeUrl = null;
let sessionStart = null;
let isIdle = false;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHostname(url) {
  try {
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) return null;
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCategory(hostname) {
  if (!hostname) return 'other';
  const rules = {
    work: ['github.com', 'gitlab.com', 'bitbucket.org', 'jira', 'confluence', 'notion.so', 'linear.app', 'figma.com', 'vercel.com', 'netlify.com', 'docs.google.com', 'sheets.google.com', 'slides.google.com', 'mail.google.com', 'outlook.', 'slack.com', 'trello.com', 'asana.com', 'monday.com'],
    learning: ['stackoverflow.com', 'developer.mozilla.org', 'medium.com', 'dev.to', 'hashnode.dev', 'coursera.org', 'udemy.com', 'khanacademy.org', 'wikipedia.org', 'docs.', 'learn.'],
    social: ['reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'discord.com', 'whatsapp.com', 'telegram.org', 'tiktok.com'],
    entertainment: ['youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com', 'primevideo.com', 'disneyplus.com', 'hulu.com', 'crunchyroll.com']
  };
  for (const [cat, patterns] of Object.entries(rules)) {
    if (patterns.some(p => hostname.includes(p))) return cat;
  }
  return 'other';
}

// ─── Core tracking logic ─────────────────────────────────────────────────────

async function flushTime() {
  if (!activeUrl || !sessionStart || isIdle) return;
  const hostname = getHostname(activeUrl);
  if (!hostname) return;

  const elapsed = Math.floor((Date.now() - sessionStart) / 1000); // seconds
  if (elapsed <= 0) return;

  const todayKey = getTodayKey();
  const storageKey = `data_${todayKey}`;

  const result = await chrome.storage.local.get([storageKey]);
  const data = result[storageKey] || { sites: {}, total: 0 };

  if (!data.sites[hostname]) {
    data.sites[hostname] = { seconds: 0, category: getCategory(hostname), visits: 0 };
  }
  data.sites[hostname].seconds += elapsed;
  data.total += elapsed;

  await chrome.storage.local.set({ [storageKey]: data });
  sessionStart = Date.now(); // reset start so we don't double-count
}

async function startTracking(tabId, url) {
  await flushTime(); // flush previous session first
  activeTabId = tabId;
  activeUrl = url;
  sessionStart = Date.now();
}

function stopTracking() {
  flushTime();
  activeTabId = null;
  activeUrl = null;
  sessionStart = null;
}

// ─── Event listeners ─────────────────────────────────────────────────────────

// Tab activated (user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await startTracking(tab.id, tab.url);
    // mark visit
    const hostname = getHostname(tab.url);
    if (hostname) {
      const todayKey = getTodayKey();
      const storageKey = `data_${todayKey}`;
      const result = await chrome.storage.local.get([storageKey]);
      const data = result[storageKey] || { sites: {}, total: 0 };
      if (!data.sites[hostname]) {
        data.sites[hostname] = { seconds: 0, category: getCategory(hostname), visits: 0 };
      }
      data.sites[hostname].visits += 1;
      await chrome.storage.local.set({ [storageKey]: data });
    }
  }
});

// Tab updated (navigation within same tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tabId === activeTabId && tab.url) {
    await startTracking(tabId, tab.url);
  }
});

// Window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await flushTime();
    isIdle = true;
    return;
  }
  isIdle = false;
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab && tab.url) {
    await startTracking(tab.id, tab.url);
  }
});

// Idle detection
chrome.idle.setDetectionInterval(IDLE_THRESHOLD);
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' || state === 'locked') {
    await flushTime();
    isIdle = true;
  } else {
    isIdle = false;
    sessionStart = Date.now();
  }
});

// Periodic flush every 30 seconds via alarms
chrome.alarms.create('flush', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'flush') flushTime();
});

// On install / startup: pick up the active tab
chrome.runtime.onInstalled.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) await startTracking(tab.id, tab.url);
});

chrome.runtime.onStartup.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) await startTracking(tab.id, tab.url);
});
