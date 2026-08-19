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
const searchBlockOverlay = document.getElementById('search-block-overlay');
const searchBlockText = document.getElementById('search-block-text');
const closeSearchBlock = document.getElementById('close-search-block');

const BLOCKED_SEARCH_TERMS = ['minor', 'child', 'kid', 'children', 'kids', 'illegal', 'drugs', 'porn', 'pornography', 'sex', 'sexual', 'nude', 'nudity', 'nsfw'];

const tabs = [];
let activeId = null;
let nextId = 1;
let selectedCategory = 'all';
let safeSearch = true; // Session-only.
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
    fallbackTitle.textContent = 'This site may not embed in Ayde';
    fallbackText.textContent = 'The destination controls whether it can be embedded. Ayde will not bypass X-Frame-Options or CSP. Ayde will not bypass those policies or open the destination in another browser tab.';
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
  setTabUrl(tab, `ayde-search:${encodeURIComponent(query)}:${category}`, `ayde · ${query}`);
  showTab(tab);

  resultStatus.textContent = 'Searching DuckDuckGo…';
  resultsList.replaceChildren();
  pagination.hidden = true;

  try {
    const mode = category === 'images' ? 'iax=images&ia=images' : category === 'videos' ? 'iax=videos&ia=videos' : category === 'news' ? 'ia=news' : '';
    const kp = safeSearch ? '1' : '-2';
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=${kp}${mode ? `&${mode}` : ''}`;
    const proxyUrl = `https://r.jina.ai/${ddgUrl}`;
    const response = await fetch(proxyUrl, { method: 'GET', credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error(`search provider returned ${response.status}`);
    const text = await response.text();
    const parsed = parseDuckDuckGoResults(text, category);

    resultState = {
      all: parsed,
      sites: parsed.filter(item => item.type === 'site'),
      images: parsed.filter(item => item.type === 'image'),
      videos: parsed.filter(item => item.type === 'video'),
      news: parsed.filter(item => item.type === 'news')
    };

    if (!parsed.length) {
      resultStatus.textContent = 'No results found.';
      const empty = document.createElement('div');
      empty.className = 'empty-card';
      empty.textContent = 'DuckDuckGo returned no results for this search.';
      resultsList.appendChild(empty);
      return;
    }

    resultStatus.textContent = `${parsed.length} result${parsed.length === 1 ? '' : 's'} from DuckDuckGo.`;
    renderResults();
  } catch (error) {
    console.warn('Ayde DuckDuckGo request failed:', error);
    showProviderFallback('DuckDuckGo could not be reached right now. Try the search again in a moment.');
  }
}

function parseDuckDuckGoResults(text, category) {
  const results = [];
  const seen = new Set();
  const add = (title, url, description = '', type = category) => {
    if (!title || !url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    results.push({ type: type === 'all' || type === 'sites' ? 'site' : type.slice(0, -1), title: title.trim(), url, description: description.trim() });
  };

  // r.jina.ai returns a clean markdown representation of DuckDuckGo's page.
  const markdownLinks = [...text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)];
  markdownLinks.forEach(match => {
    const title = match[1].replace(/\\([()[\]])/g, '$1').trim();
    const url = match[2].trim();
    if (/^(duckduckgo|feedback|settings|privacy|terms|help)$/i.test(title)) return;
    if (title.length < 2) return;
    add(title, url);
  });

  // Also support raw HTML if a provider returns HTML instead of markdown.
  if (!results.length && /<html|<a\b/i.test(text)) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    [...doc.querySelectorAll('a.result__a, .result a[href]')].forEach(link => {
      const href = link.getAttribute('href');
      const title = link.textContent.trim();
      const container = link.closest('.result') || link.parentElement;
      const description = container?.querySelector('.result__snippet')?.textContent.trim() || '';
      if (!href || !title) return;
      let url = href;
      try {
        if (href.startsWith('//')) url = `https:${href}`;
        else if (href.startsWith('/')) url = new URL(href, 'https://duckduckgo.com').href;
        const u = new URL(url);
        const target = u.searchParams.get('uddg');
        if (target) url = decodeURIComponent(target);
      } catch {}
      add(title, url, description);
    });
  }

  return results.slice(0, 100);
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
  resultStatus.textContent = `${label} results are not exposed by DuckDuckGo's public Instant Answer API.`;
  resultsList.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'empty-card';
  card.innerHTML = `
    <div class="blocked-mark">?</div>
    <h2>${label} search needs a provider endpoint</h2>
    <p>GitHub Pages can run Ayde's JavaScript, but it cannot bypass DuckDuckGo's CORS/security rules or turn its public Instant Answer API into a full ${label.toLowerCase()} search API. Ayde will not fake results.</p>
  `;
  resultsList.appendChild(card);
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
  if (selectedCategory === 'videos' || selectedCategory === 'news') {
    renderSpecialResults(selectedCategory);
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
  const items = resultState.images;
  resultStatus.textContent = `${items.length} image result${items.length === 1 ? '' : 's'} from DuckDuckGo.`;
  resultsList.replaceChildren();
  items.forEach(item => resultsList.appendChild(createSiteResult(item)));
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.textContent = 'No image results found.';
    resultsList.appendChild(empty);
  }
  renderPagination(items.length);
}

function renderSpecialResults(category) {
  const items = resultState[category] || [];
  resultsList.replaceChildren();
  items.forEach(item => resultsList.appendChild(createSiteResult(item)));
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-card';
    empty.textContent = `No ${category} results found.`;
    resultsList.appendChild(empty);
  }
  renderPagination(items.length);
}

function openResult(url, title) {
  if (!url) return;
  const tab = activeTab();
  if (!tab) return;

  setTabUrl(tab, url, title || safeHostname(url));
  tab.view = 'fallback';
  fallbackTitle.textContent = 'This result cannot be displayed inside Ayde';
  fallbackText.textContent = 'The destination may block embedding with X-Frame-Options or CSP. Ayde cannot bypass those browser security policies. The result cannot be rendered inside Ayde without bypassing browser security policies, which Ayde does not do.';
  showTab(tab);
}

function goHistory(direction) {
  const tab = activeTab();
  if (!tab || !tab.history.length) return;

  const next = tab.historyIndex + direction;
  if (next < 0 || next >= tab.history.length) return;

  tab.historyIndex = next;
  tab.url = tab.history[next];

  if (/duckduckgo\.com\/\?q=/i.test(tab.url)) {
    tab.view = 'results';
    try {
      const url = new URL(tab.url);
      currentSearch = url.searchParams.get('q') || '';
      const ia = url.searchParams.get('ia') || 'web';
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
safeToggle.title = 'Toggle DuckDuckGo Safe Search';

document.getElementById('continue-current').addEventListener('click', () => {
  const tab = activeTab();
  if (!tab?.url) return;
  window.location.href = tab.url;
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
