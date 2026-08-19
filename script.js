const tabsEl = document.getElementById('tabs');
const newTabBtn = document.getElementById('new-tab');
const homeView = document.getElementById('home-view');
const resultsView = document.getElementById('results-view');
const settingsView = document.getElementById('settings-view');
const fallbackView = document.getElementById('fallback-view');
const address = document.getElementById('address');
const addressForm = document.getElementById('address-form');
const searchForm = document.getElementById('search-form');
const search = document.getElementById('search');
const resultsSearch = document.getElementById('results-search');
const resultsList = document.getElementById('results-list');
const resultStatus = document.getElementById('result-status');
const pagination = document.getElementById('pagination');
const resultsTitle = document.getElementById('results-title');
const fallbackTitle = document.getElementById('fallback-title');
const fallbackText = document.getElementById('fallback-text');
const pageFrame = document.getElementById('page-frame');
const searchBlockOverlay = document.getElementById('search-block-overlay');
const searchBlockText = document.getElementById('search-block-text');
const closeSearchBlock = document.getElementById('close-search-block');

const BLOCKED_SEARCH_TERMS = ['minor', 'child', 'kid', 'illegal', 'drugs', 'suicide', 'self-harm', 'self harm', 'gore', 'graphic violence'];

const tabs = [];
let activeId = null;
let nextId = 1;
let selectedCategory = 'all';
let safeSearch = true; // Session-only. Nothing is persisted.
let currentSearch = '';
let resultState = { all: [], sites: [], images: [], videos: [], news: [] };
let currentPage = 1;
const RESULTS_PER_PAGE = 5;

function makeTab(title = 'new tab', url = '') {
  const tab = {
    id: nextId++,
    title,
    url,
    isHome: !url,
    history: [],
    historyIndex: -1,
    view: 'home'
  };
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
    close.addEventListener('click', event => {
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
  if (activeId === id) activeId = tabs[Math.max(0, index - 1)].id;
  renderTabs();
  showTab(activeTab());
}

function setVisible(view) {
  homeView.hidden = view !== 'home';
  resultsView.hidden = view !== 'results';
  settingsView.hidden = view !== 'settings';
  fallbackView.hidden = view !== 'fallback';
}

function showTab(tab) {
  if (!tab) return;
  setVisible(tab.view || 'home');
  if (pageFrame) {
    pageFrame.hidden = tab.view !== 'fallback' || !tab.url;
    if (tab.view !== 'fallback' || !tab.url) pageFrame.src = 'about:blank';
  }
  address.value = tab.url || '';

  if (tab.view === 'home') {
    search.focus();
  } else if (tab.view === 'results') {
    resultsSearch.value = currentSearch;
    renderResults();
  }
}

function setTabUrl(tab, url, title) {
  if (!tab) return;
  if (tab.history[tab.historyIndex] !== url) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(url);
    tab.historyIndex++;
  }
  tab.url = url;
  tab.title = title || safeHostname(url) || 'page';
  tab.isHome = false;
  renderTabs();
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'page';
  }
}

function normalizeInput(value) {
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
  return '';
}

function navigate(value) {
  const raw = value.trim();
  if (!raw) return;

  if (/^(https?:\/\/)/i.test(raw) || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) {
    const url = normalizeInput(raw);
    const tab = activeTab() || makeTab();
    setTabUrl(tab, url);
    tab.view = 'fallback';
    fallbackTitle.textContent = safeHostname(url);
    fallbackText.textContent = 'loading this site inside ayde… if the site blocks embedding, ayde will keep you here instead of opening a new tab.';
    if (pageFrame) { pageFrame.hidden = false; pageFrame.src = url; }
    showTab(tab);
    return;
  }

  runSearch(raw, selectedCategory);
}

function findBlockedSearchTerm(query) {
  const normalized = String(query)
    .toLocaleLowerCase()
    .normalize('NFKC');

  for (const term of BLOCKED_SEARCH_TERMS) {
    // Match the requested term as a standalone word, including common
    // punctuation boundaries, without accidentally blocking words such as
    // "kidney" or "minority".
    const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${term}(?=$|[^\\p{L}\\p{N}])`, 'iu');
    if (pattern.test(normalized)) return term;
  }

  return null;
}

function showSearchBlocked(term) {
  const label = term ? `“${term}”` : 'that term';
  searchBlockText.textContent =
    `Ayde can't run this search because it contains the blocked term ${label}. ` +
    `This search was not sent to DuckDuckGo.`;
  searchBlockOverlay.hidden = false;
  closeSearchBlock.focus();
}

function hideSearchBlocked() {
  searchBlockOverlay.hidden = true;
}

async function runSearch(query, category = 'all') {
  query = query.trim();
  if (!query) return;

  const blockedTerm = findBlockedSearchTerm(query);
  if (blockedTerm) {
    showSearchBlocked(blockedTerm);
    return;
  }

  currentSearch = query;
  selectedCategory = category;
  currentPage = 1;

  const tab = activeTab() || makeTab();
  tab.view = 'results';
  setTabUrl(tab, `ayde://search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`, `ayde · ${query}`);
  showTab(tab);

  resultStatus.textContent = 'Contacting DuckDuckGo…';
  resultsList.replaceChildren();
  pagination.hidden = true;

  // DuckDuckGo's public Instant Answer endpoint is the only documented,
  // client-friendly endpoint we can use from a static GitHub Pages site.
  // It is not a full web/image/video/news search API.
  const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`;
  // DuckDuckGo documents Safe Search URL parameters for its normal search pages,
  // but not as a full-search filter on this Instant Answer API. We therefore do
  // not pretend the API call itself is filtered; the fallback search uses kp=1/-2.

  try {
    const response = await fetch(endpoint, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error(`DuckDuckGo returned ${response.status}`);
    const data = await response.json();
    const sites = flattenRelatedTopics(data).map((item, index) => ({
      type: 'site',
      title: item.Text?.split(' - ')[0] || data.Heading || query,
      url: item.FirstURL,
      description: item.Text || '',
      index
    })).filter(item => item.url);

    resultState = {
      all: sites,
      sites,
      images: [],
      videos: [],
      news: []
    };

    if (category === 'images' || category === 'videos' || category === 'news') {
      showUnsupportedCategory(category);
    } else if (sites.length) {
      resultStatus.textContent = `${sites.length} provider result${sites.length === 1 ? '' : 's'} available in Ayde.`;
      renderResults();
    } else {
      showProviderFallback('DuckDuckGo did not return embeddable result data for this query.');
    }
  } catch (error) {
    console.warn('Ayde DuckDuckGo request failed:', error);
    showProviderFallback('DuckDuckGo’s public client-side endpoint could not be reached from this GitHub Pages page. This is usually a browser CORS/API-access limitation, not an Ayde error.');
  }
}

function flattenRelatedTopics(data) {
  const out = [];
  for (const item of data.RelatedTopics || []) {
    if (item.Topics) {
      for (const nested of item.Topics) if (nested.FirstURL) out.push(nested);
    } else if (item.FirstURL) {
      out.push(item);
    }
  }
  return out;
}

function showUnsupportedCategory(category) {
  const label = category[0].toUpperCase() + category.slice(1);
  resultStatus.textContent = `loading ${label.toLowerCase()} results…`;
  resultsList.replaceChildren();
  const card = document.createElement('div');
  card.className = 'media-search-card';
  const frame = document.createElement('iframe');
  frame.className = 'media-search-frame';
  frame.loading = 'eager';
  frame.referrerPolicy = 'no-referrer';
  frame.title = `DuckDuckGo ${label} results`;
  const ia = category === 'images' ? 'images' : category === 'videos' ? 'videos' : 'news';
  const kp = safeSearch ? '1' : '-2';
  frame.src = `https://duckduckgo.com/?q=${encodeURIComponent(currentSearch)}&ia=${ia}&iax=${ia === 'images' || ia === 'videos' ? ia : ''}&kp=${kp}`;
  card.appendChild(frame);
  const note = document.createElement('p');
  note.className = 'muted media-note';
  note.textContent = 'results are displayed inside ayde; if duckduckgo blocks framing, the browser will show its normal security page instead of opening a new tab.';
  card.appendChild(note);
  resultsList.appendChild(card);
  pagination.hidden = true;
}

function showProviderFallback(message) {
  resultStatus.textContent = 'Provider fallback';
  resultsList.replaceChildren();
  const card = document.createElement('div');
  card.className = 'empty-card';
  card.innerHTML = `
    <div class="blocked-mark">?</div>
    <h2>Ayde can't fetch those results directly</h2>
    <p>${escapeHTML(message)}</p>
    <p class="muted">Ayde will not open DuckDuckGo in a separate browser tab or redirect this page. GitHub Pages cannot bypass DuckDuckGo's browser security restrictions without a backend/proxy.</p>
  `;
  resultsList.appendChild(card);
}

function renderResults() {
  resultsTitle.textContent = currentSearch ? `Results for “${currentSearch}”` : 'Search';
  resultsSearch.value = currentSearch;
  syncCategoryButtons();
  resultsList.replaceChildren();

  if (selectedCategory === 'images') {
    renderImages();
    return;
  }
  if (selectedCategory === 'videos') {
    showUnsupportedCategory('videos');
    return;
  }
  if (selectedCategory === 'news') {
    showUnsupportedCategory('news');
    return;
  }

  const items = selectedCategory === 'sites' ? resultState.sites : resultState.all;
  const start = (currentPage - 1) * RESULTS_PER_PAGE;
  const pageItems = items.slice(start, start + RESULTS_PER_PAGE);

  pageItems.forEach(item => resultsList.appendChild(createSiteResult(item)));

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.textContent = 'No provider results are available.';
    resultsList.appendChild(empty);
  }
  renderPagination(items.length);
}

function createSiteResult(item) {
  const card = document.createElement('article');
  card.className = 'result-card';

  const title = document.createElement('button');
  title.className = 'result-title';
  title.type = 'button';
  title.textContent = item.title || item.url;
  title.addEventListener('click', () => openResult(item.url, item.title));
  card.appendChild(title);

  const url = document.createElement('div');
  url.className = 'result-url';
  url.textContent = item.url;
  card.appendChild(url);

  const desc = document.createElement('p');
  desc.className = 'result-description';
  desc.textContent = item.description || 'No description supplied by DuckDuckGo.';
  card.appendChild(desc);
  return card;
}

function renderPagination(total) {
  pagination.replaceChildren();
  const pages = Math.ceil(total / RESULTS_PER_PAGE);
  pagination.hidden = pages <= 1;
  if (pages <= 1) return;

  const prev = makePageButton('Previous', currentPage > 1);
  prev.addEventListener('click', () => { currentPage--; renderResults(); });
  pagination.appendChild(prev);

  for (let i = 1; i <= Math.min(pages, 10); i++) {
    const btn = makePageButton(String(i), true);
    if (i === currentPage) btn.classList.add('current');
    btn.addEventListener('click', () => { currentPage = i; renderResults(); });
    pagination.appendChild(btn);
  }

  const next = makePageButton('Next', currentPage < pages);
  next.addEventListener('click', () => { currentPage++; renderResults(); });
  pagination.appendChild(next);
}

function makePageButton(label, enabled) {
  const button = document.createElement('button');
  button.className = 'page-button';
  button.type = 'button';
  button.textContent = label;
  button.disabled = !enabled;
  return button;
}

function renderImages() {
  showUnsupportedCategory('images');
}

function openResult(url, title) {
  if (!url) return;
  const tab = activeTab();
  if (!tab) return;
  setTabUrl(tab, url, title || safeHostname(url));
  tab.view = 'fallback';
  fallbackTitle.textContent = title || safeHostname(url);
  fallbackText.textContent = 'loading inside ayde… this site may block embedding, but ayde will never open it in a new tab.';
  if (pageFrame) { pageFrame.hidden = false; pageFrame.src = url; }
  showTab(tab);
}

function goHistory(direction) {
  const tab = activeTab();
  if (!tab || !tab.history.length) return;

  const next = tab.historyIndex + direction;
  if (next < 0 || next >= tab.history.length) return;

  tab.historyIndex = next;
  tab.url = tab.history[next];

  if (/^ayde:\/\/search\?q=/i.test(tab.url)) {
    tab.view = 'results';
    try {
      const url = new URL(tab.url);
      currentSearch = url.searchParams.get('q') || '';
      const ia = url.searchParams.get('category') || 'all';
      selectedCategory = ia === 'images' ? 'images' : ia === 'videos' ? 'videos' : ia === 'news' ? 'news' : 'all';
    } catch {}
  } else {
    tab.view = 'fallback';
  }
  showTab(tab);
}

function syncCategoryButtons() {
  document.querySelectorAll('.mode').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === selectedCategory);
  });
}

document.querySelectorAll('.mode').forEach(button => {
  button.addEventListener('click', () => {
    selectedCategory = button.dataset.category;
    syncCategoryButtons();
    if (currentSearch) runSearch(currentSearch, selectedCategory);
  });
});

searchForm.addEventListener('submit', event => {
  event.preventDefault();
  const query = search.value.trim();
  if (query) runSearch(query, selectedCategory);
});

document.getElementById('results-submit').addEventListener('click', () => {
  const query = resultsSearch.value.trim();
  if (query) runSearch(query, selectedCategory);
});

resultsSearch.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    document.getElementById('results-submit').click();
  }
});

addressForm.addEventListener('submit', event => {
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
  tab.view = 'home';
  renderTabs();
  showTab(tab);
});

document.getElementById('reload').addEventListener('click', () => {
  const tab = activeTab();
  if (!tab) return;
  if (tab.view === 'results' && currentSearch) runSearch(currentSearch, selectedCategory);
  else showTab(tab);
});

document.getElementById('back').addEventListener('click', () => goHistory(-1));
document.getElementById('forward').addEventListener('click', () => goHistory(1));

function openSettings() {
  const tab = activeTab();
  if (!tab) return;
  tab.view = 'settings';
  showTab(tab);
}

document.getElementById('settings-button').addEventListener('click', openSettings);
document.getElementById('results-settings').addEventListener('click', openSettings);
document.getElementById('close-settings').addEventListener('click', () => {
  const tab = activeTab();
  if (!tab) return;
  tab.view = currentSearch ? 'results' : 'home';
  showTab(tab);
});

const safeToggle = document.getElementById('safe-toggle');
function renderSafeToggle() {
  safeToggle.classList.toggle('on', safeSearch);
  safeToggle.setAttribute('aria-pressed', String(safeSearch));
  safeToggle.querySelector('b').textContent = safeSearch ? 'ON' : 'OFF';
}
safeToggle.addEventListener('click', () => {
  safeSearch = !safeSearch;
  renderSafeToggle();
  if (currentSearch) runSearch(currentSearch, selectedCategory);
});
renderSafeToggle();
safeToggle.disabled = false;
safeToggle.title = 'Toggle DuckDuckGo Safe Search for this session.';

document.getElementById('continue-current').addEventListener('click', () => {
  const tab = activeTab();
  if (!tab?.url) return;
  // This is intentionally disabled for GitHub Pages. Ayde stays inside its
  // own UI rather than turning into a redirect/new-tab launcher.
  if (pageFrame && activeTab()?.url) { pageFrame.hidden = false; pageFrame.src = activeTab().url; }
  fallbackText.textContent = 'reloading inside ayde…';
});

document.getElementById('return-results').addEventListener('click', () => {
  const tab = activeTab();
  if (!tab) return;
  tab.view = currentSearch ? 'results' : 'home';
  showTab(tab);
});

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

closeSearchBlock.addEventListener('click', hideSearchBlocked);

searchBlockOverlay.addEventListener('click', event => {
  if (event.target === searchBlockOverlay) hideSearchBlocked();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !searchBlockOverlay.hidden) {
    hideSearchBlocked();
  }
});

// Start with exactly one in-memory Ayde tab.
makeTab();
