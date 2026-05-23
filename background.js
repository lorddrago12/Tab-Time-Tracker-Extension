// background.js — Tab Time Tracker
// Firefox/LibreWolf compatible — uses browser.* with chrome.* fallback

const api = typeof browser !== 'undefined' ? browser : chrome;
const IDLE_THRESHOLD = 60;

let isIdle = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getHostname(url) {
  try {
    if (!url) return null;
    if (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('moz-extension://') ||
      url.startsWith('about:') ||
      url.startsWith('browser:')
    ) return null;
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
    learning: ['stackoverflow.com', 'developer.mozilla.org', 'medium.com', 'dev.to', 'hashnode.dev', 'coursera.org', 'udemy.com', 'khanacademy.org', 'wikipedia.org', 'docs.', 'learn.', 'freecodecamp.org'],
    social: ['reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'discord.com', 'whatsapp.com', 'telegram.org', 'tiktok.com', 'pinterest.com'],
    entertainment: ['youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com', 'primevideo.com', 'disneyplus.com', 'hulu.com', 'crunchyroll.com']
  };
  for (const [cat, patterns] of Object.entries(rules)) {
    if (patterns.some(p => hostname.includes(p))) return cat;
  }
  return 'other';
}

// ─── Session stored in storage so it survives service worker restarts ─────────

async function getSession() {
  const result = await api.storage.local.get(['_session']);
  return result._session || null;
}

async function setSession(tabId, url) {
  await api.storage.local.set({
    _session: { tabId, url, start: Date.now() }
  });
}

async function clearSession() {
  await api.storage.local.remove(['_session']);
}

// ─── Core tracking ────────────────────────────────────────────────────────────

async function flushTime() {
  if (isIdle) return;
  const session = await getSession();
  if (!session) return;

  const hostname = getHostname(session.url);
  if (!hostname) return;

  const elapsed = Math.floor((Date.now() - session.start) / 1000);
  if (elapsed <= 0) return;

  const storageKey = `data_${getTodayKey()}`;
  const result = await api.storage.local.get([storageKey]);
  const data = result[storageKey] || { sites: {}, total: 0 };

  if (!data.sites[hostname]) {
    data.sites[hostname] = { seconds: 0, category: getCategory(hostname), visits: 0 };
  }
  data.sites[hostname].seconds += elapsed;
  data.total += elapsed;

  await api.storage.local.set({ [storageKey]: data });
  // Reset session start so we don't double count
  await setSession(session.tabId, session.url);
}

async function startTracking(tabId, url) {
  await flushTime(); // flush previous session first
  await setSession(tabId, url);
}

async function stopTracking() {
  await flushTime();
  await clearSession();
}

async function markVisit(url) {
  const hostname = getHostname(url);
  if (!hostname) return;
  const storageKey = `data_${getTodayKey()}`;
  const result = await api.storage.local.get([storageKey]);
  const data = result[storageKey] || { sites: {}, total: 0 };
  if (!data.sites[hostname]) {
    data.sites[hostname] = { seconds: 0, category: getCategory(hostname), visits: 0 };
  }
  data.sites[hostname].visits += 1;
  await api.storage.local.set({ [storageKey]: data });
}

// ─── Event listeners ──────────────────────────────────────────────────────────

api.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await api.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      await startTracking(tab.id, tab.url);
      await markVisit(tab.url);
    }
  } catch (e) {
    console.error('onActivated error:', e);
  }
});

api.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const session = await getSession();
  if (changeInfo.status === 'complete' && tab.url && session && tabId === session.tabId) {
    await startTracking(tabId, tab.url);
  }
});

api.windows.onFocusChanged.addListener(async (windowId) => {
  const NONE = api.windows.WINDOW_ID_NONE;
  if (windowId === NONE) {
    await flushTime();
    isIdle = true;
    return;
  }
  isIdle = false;
  try {
    const tabs = await api.tabs.query({ active: true, windowId });
    if (tabs.length > 0 && tabs[0].url) {
      await startTracking(tabs[0].id, tabs[0].url);
    }
  } catch (e) {
    console.error('onFocusChanged error:', e);
  }
});

api.idle.setDetectionInterval(IDLE_THRESHOLD);
api.idle.onStateChanged.addListener(async (state) => {
  if (state === 'idle' || state === 'locked') {
    await flushTime();
    isIdle = true;
  } else {
    isIdle = false;
    // Resume session from storage
    const session = await getSession();
    if (session) await setSession(session.tabId, session.url);
  }
});

// Flush every 30 seconds — also recovers if service worker was sleeping
api.alarms.create('flush', { periodInMinutes: 0.25 });
api.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'flush') await flushTime();
});

// Startup: pick up the current active tab
async function initTracking() {
  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].url) {
      await startTracking(tabs[0].id, tabs[0].url);
    }
  } catch (e) {
    console.error('initTracking error:', e);
  }
}

api.runtime.onInstalled.addListener(initTracking);
api.runtime.onStartup.addListener(initTracking);
initTracking();
