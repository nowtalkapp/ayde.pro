const tabsEl = document.getElementById('tabs');
const newTabBtn = document.getElementById('new-tab');
const homeView = document.getElementById('home-view');
const pageView = document.getElementById('page-view');
const frame = document.getElementById('page-frame');
const blocked = document.getElementById('blocked');
const openCurrent = document.getElementById('open-current');
const address = document.getElementById('address');
const addressForm = document.getElementById('address-form');
const searchForm = document.getElementById('search-form');
const search = document.getElementById('search');

// Intentionally memory-only. No localStorage, sessionStorage, IndexedDB, cookies,
// analytics, history API, or other persistence is used by Ayde.
const tabs = [];
let activeId = null;
let nextId = 1;
let blockedTimer = null;

function makeTab(title = 'new tab', url = '') {
  const tab = { id: nextId++, title, url, isHome: !url };
  tabs.push(tab);
  activeId = tab.id;
  renderTabs();
  showTab(tab);
}

function activeTab() {
  return tabs.find(t => t.id === activeId);
}

function renderTabs() {
  tabsEl.replaceChildren();
  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeId ? ' active' : '');
    el.title = tab.title;
    el.addEventListener('click', () => {
      activeId = tab.id;
      renderTabs();
      showTab(tab);
    });

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = tab.title;
    el.appendChild(label);

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', `Close ${tab.title}`);
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(close);
    tabsEl.appendChild(el);
  });
}

function closeTab(id) {
  const index = tabs.findIndex(t => t.id === id);
  if (index < 0) return;
  tabs.splice(index, 1);

  if (!tabs.length) {
    makeTab();
    return;
  }

  if (activeId === id) {
    activeId = tabs[Math.max(0, index - 1)].id;
  }
  renderTabs();
  showTab(activeTab());
}

function showTab(tab) {
  clearTimeout(blockedTimer);
  blocked.hidden = true;
  frame.src = 'about:blank';

  if (tab.isHome || !tab.url) {
    homeView.hidden = false;
    pageView.hidden = true;
    address.value = '';
    setTimeout(() => search.focus(), 0);
    return;
  }

  homeView.hidden = true;
  pageView.hidden = false;
  address.value = tab.url;
  // DuckDuckGo explicitly does not permit its search pages to be framed.
  // For it, use a normal same-tab navigation so search always works without
  // creating another browser tab. Other sites are attempted in the Ayde view.
  if (/^https?:\/\/(?:www\.)?duckduckgo\.com\//i.test(tab.url)) {
    window.location.replace(tab.url);
    return;
  }

  frame.src = tab.url;

  // Some sites block iframe embedding with browser security headers.
  // We cannot override those headers from GitHub Pages, so expose a clean
  // same-tab fallback instead of leaving the user on a broken frame.
  blockedTimer = setTimeout(() => {
    if (activeTab() === tab) blocked.hidden = false;
  }, 3500);
}

function normalizeInput(value) {
  const raw = value.trim();
  if (!raw) return null;

  // Looks like a URL: keep it in the current Ayde tab.
  if (/^(https?:\/\/)/i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;

  return `https://duckduckgo.com/?q=${encodeURIComponent(raw)}`;
}

function navigate(value) {
  const url = normalizeInput(value);
  if (!url) return;
  const tab = activeTab() || makeTab();
  const current = activeTab();
  current.url = url;
  current.isHome = false;
  try {
    current.title = new URL(url).hostname.replace(/^www\./, '') || 'page';
  } catch {
    current.title = 'page';
  }
  renderTabs();
  showTab(current);
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = search.value.trim();
  if (!query) return;
  navigate(query);
  search.value = '';
});

addressForm.addEventListener('submit', (event) => {
  event.preventDefault();
  navigate(address.value);
});

document.querySelectorAll('.app').forEach(app => {
  app.addEventListener('click', () => navigate(app.dataset.url));
});

newTabBtn.addEventListener('click', () => makeTab());

document.getElementById('home').addEventListener('click', () => {
  const tab = activeTab();
  if (!tab) return;
  tab.isHome = true;
  tab.url = '';
  tab.title = 'new tab';
  renderTabs();
  showTab(tab);
});

document.getElementById('reload').addEventListener('click', () => {
  const tab = activeTab();
  if (tab && !tab.isHome) showTab(tab);
});

document.getElementById('back').addEventListener('click', () => {
  try { frame.contentWindow.history.back(); } catch { /* cross-origin restriction */ }
});

document.getElementById('forward').addEventListener('click', () => {
  try { frame.contentWindow.history.forward(); } catch { /* cross-origin restriction */ }
});

openCurrent.addEventListener('click', () => {
  const tab = activeTab();
  if (!tab || !tab.url) return;
  // This intentionally replaces the current top-level page rather than opening a new tab.
  window.location.replace(tab.url);
});

// Start with exactly one in-memory tab.
makeTab();
