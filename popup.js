// popup.js — Tab Time Tracker popup logic

const CATEGORY_COLORS = {
  work:          { bar: '#1D9E75', legend: '#1D9E75' },
  learning:      { bar: '#378ADD', legend: '#378ADD' },
  social:        { bar: '#D85A30', legend: '#D85A30' },
  entertainment: { bar: '#BA7517', legend: '#BA7517' },
  other:         { bar: '#5F5E5A', legend: '#5F5E5A' }
};

const CATEGORY_LABELS = {
  work: 'Work',
  learning: 'Learning',
  social: 'Social',
  entertainment: 'Entertainment',
  other: 'Other'
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function getDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayKey() { return getDateKey(Date.now()); }

function getFaviconColor(hostname) {
  // Deterministic color based on first char
  const palettes = [
    { bg: '#1a3a2a', color: '#4ade80' },
    { bg: '#1a2a3a', color: '#60a5fa' },
    { bg: '#3a1a2a', color: '#f472b6' },
    { bg: '#2a2a1a', color: '#facc15' },
    { bg: '#2a1a3a', color: '#c084fc' },
    { bg: '#1a3a3a', color: '#34d399' },
    { bg: '#3a2a1a', color: '#fb923c' },
  ];
  const idx = (hostname.charCodeAt(0) || 0) % palettes.length;
  return palettes[idx];
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getDataForKeys(keys) {
  const storageKeys = keys.map(k => `data_${k}`);
  const result = await chrome.storage.local.get(storageKeys);

  // Merge all days into one aggregated object
  const merged = { sites: {}, total: 0 };
  for (const sk of storageKeys) {
    const day = result[sk];
    if (!day) continue;
    merged.total += day.total || 0;
    for (const [hostname, info] of Object.entries(day.sites || {})) {
      if (!merged.sites[hostname]) {
        merged.sites[hostname] = { seconds: 0, category: info.category, visits: 0 };
      }
      merged.sites[hostname].seconds += info.seconds || 0;
      merged.sites[hostname].visits += info.visits || 0;
    }
  }
  return merged;
}

function getKeysForPeriod(period) {
  const keys = [];
  const now = new Date();
  if (period === 'today') {
    keys.push(getTodayKey());
  } else if (period === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      keys.push(getDateKey(d));
    }
  } else if (period === 'month') {
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      keys.push(getDateKey(d));
    }
  }
  return keys;
}

async function getPreviousPeriodData(period) {
  const keys = [];
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now); d.setDate(now.getDate() - 1);
    keys.push(getDateKey(d));
  } else if (period === 'week') {
    for (let i = 7; i < 14; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      keys.push(getDateKey(d));
    }
  } else if (period === 'month') {
    for (let i = 30; i < 60; i++) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      keys.push(getDateKey(d));
    }
  }
  return getDataForKeys(keys);
}

// ─── Rendering ────────────────────────────────────────────────────────────────

let currentSort = 'time'; // 'time' | 'alpha'

function renderSummary(data, prevData) {
  const totalSec = data.total;
  const prevSec = prevData.total;
  const diff = totalSec - prevSec;
  const sites = Object.keys(data.sites).length;
  const prevSites = Object.keys(prevData.sites).length;

  const prodCategories = ['work', 'learning'];
  const prodSec = Object.values(data.sites)
    .filter(s => prodCategories.includes(s.category))
    .reduce((a, s) => a + s.seconds, 0);

  document.getElementById('stat-total').textContent = formatTime(totalSec);
  document.getElementById('stat-sites').textContent = sites;
  document.getElementById('stat-prod').textContent = formatTime(prodSec);

  const periodLabel = { today: 'yesterday', week: 'last week', month: 'last month' };
  const period = document.querySelector('.day-btn.active').dataset.period;
  const label = periodLabel[period] || 'before';

  if (prevSec > 0) {
    const sign = diff >= 0 ? '+' : '';
    document.getElementById('stat-total-sub').textContent = `${sign}${formatTime(Math.abs(diff))} vs ${label}`;
  } else {
    document.getElementById('stat-total-sub').textContent = 'No previous data';
  }

  const siteDiff = sites - prevSites;
  document.getElementById('stat-sites-sub').textContent =
    prevSites > 0 ? `${siteDiff >= 0 ? '+' : ''}${siteDiff} vs ${label}` : `across this period`;

  const prodPct = totalSec > 0 ? Math.round((prodSec / totalSec) * 100) : 0;
  document.getElementById('stat-prod-sub').textContent = `${prodPct}% of total`;
}

function renderBreakdownBar(data) {
  const bar = document.getElementById('breakdown-bar');
  const legend = document.getElementById('legend');
  bar.innerHTML = '';
  legend.innerHTML = '';

  const byCategory = {};
  for (const [, info] of Object.entries(data.sites)) {
    const cat = info.category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + info.seconds;
  }

  const total = data.total || 1;
  const order = ['work', 'learning', 'social', 'entertainment', 'other'];

  for (const cat of order) {
    const sec = byCategory[cat] || 0;
    if (sec === 0) continue;
    const pct = Math.max(1, (sec / total) * 100);
    const color = CATEGORY_COLORS[cat].bar;

    const seg = document.createElement('div');
    seg.className = 'bar-seg';
    seg.style.cssText = `width:${pct.toFixed(1)}%;background:${color};`;
    seg.title = `${CATEGORY_LABELS[cat]}: ${formatTime(sec)}`;
    bar.appendChild(seg);

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<div class="legend-dot" style="background:${color}"></div>${CATEGORY_LABELS[cat]}`;
    legend.appendChild(item);
  }

  if (bar.children.length === 0) {
    bar.style.background = '#161b22';
  }
}

function renderSitesList(data) {
  const list = document.getElementById('sites-list');
  const sites = Object.entries(data.sites);

  if (sites.length === 0) {
    list.innerHTML = '<div class="empty-state">No data yet — browse around and come back!</div>';
    return;
  }

  // Sort
  if (currentSort === 'time') {
    sites.sort((a, b) => b[1].seconds - a[1].seconds);
  } else {
    sites.sort((a, b) => a[0].localeCompare(b[0]));
  }

  const top = sites.slice(0, 8);
  const maxSec = top[0]?.[1]?.seconds || 1;

  list.innerHTML = '';
  top.forEach(([hostname, info], i) => {
    const pct = Math.round((info.seconds / maxSec) * 100);
    const color = CATEGORY_COLORS[info.category || 'other'].bar;
    const faviconStyle = getFaviconColor(hostname);
    const letter = hostname.charAt(0).toUpperCase();

    const row = document.createElement('div');
    row.className = 'site-row';
    row.style.animationDelay = `${i * 30}ms`;
    row.innerHTML = `
      <div class="favicon" style="background:${faviconStyle.bg};color:${faviconStyle.color};">${letter}</div>
      <span class="site-name" title="${hostname}">${hostname}</span>
      <div class="site-bar-wrap">
        <div class="site-bar-fill" style="width:${pct}%;background:${color};"></div>
      </div>
      <span class="site-time">${formatTime(info.seconds)}</span>
    `;
    list.appendChild(row);
  });
}

async function renderLiveTab() {
  const dot = document.getElementById('live-dot');
  const label = document.getElementById('live-label');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      const hostname = url.hostname.replace(/^www\./, '');
      if (hostname && !url.href.startsWith('chrome://')) {
        dot.classList.remove('idle');
        label.innerHTML = `Tracking <strong style="color:#c9d1d9">${hostname}</strong>`;
        return;
      }
    }
  } catch {}
  dot.classList.add('idle');
  label.textContent = 'Not tracking (system page)';
}

// ─── Main render ──────────────────────────────────────────────────────────────

async function render(period) {
  const keys = getKeysForPeriod(period);
  const [data, prevData] = await Promise.all([
    getDataForKeys(keys),
    getPreviousPeriodData(period)
  ]);

  renderSummary(data, prevData);
  renderBreakdownBar(data);
  renderSitesList(data);
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function exportData() {
  const result = await chrome.storage.local.get(null);
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tab-time-tracker-${getTodayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.querySelectorAll('.day-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render(btn.dataset.period);
  });
});

document.getElementById('sort-btn').addEventListener('click', () => {
  currentSort = currentSort === 'time' ? 'alpha' : 'time';
  const period = document.querySelector('.day-btn.active').dataset.period;
  render(period);
});

document.getElementById('export-btn').addEventListener('click', exportData);

// ─── Init ─────────────────────────────────────────────────────────────────────

render('today');
renderLiveTab();
