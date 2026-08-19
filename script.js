const tabsEl = document.getElementById("tabs");
const newTabBtn = document.getElementById("new-tab");
const startScreen = document.getElementById("start-screen");
const pageScreen = document.getElementById("page-screen");
const searchForm = document.getElementById("search-form");
const search = document.getElementById("search");
const webview = document.getElementById("webview");
const address = document.getElementById("address");
const fallback = document.getElementById("frame-fallback");
const openDirect = document.getElementById("open-direct");

let tabs = [];
let activeId = 0;
let nextId = 1;
let currentUrl = "";

function makeTab(title = "New tab", url = "") {
  const tab = { id: nextId++, title, url };
  tabs.push(tab);
  activeId = tab.id;
  renderTabs();
  if (url) showPage(url, title);
  else showHome();
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
    const tab = tabs.find(t => t.id === activeId);
    tab.url ? showPage(tab.url, tab.title) : showHome();
  }
  renderTabs();
}

function renderTabs() {
  tabsEl.innerHTML = "";
  tabs.forEach(tab => {
    const el = document.createElement("div");
    el.className = "tab" + (tab.id === activeId ? " active" : "");
    el.setAttribute("role", "tab");
    el.innerHTML = `<span class="tab-title"></span><button class="tab-close" aria-label="Close tab">×</button>`;
    el.querySelector(".tab-title").textContent = tab.title;
    el.addEventListener("click", e => {
      if (e.target.closest(".tab-close")) return;
      activeId = tab.id;
      tab.url ? showPage(tab.url, tab.title) : showHome();
      renderTabs();
    });
    el.querySelector(".tab-close").addEventListener("click", () => closeTab(tab.id));
    tabsEl.appendChild(el);
  });
}

function showHome() {
  startScreen.hidden = false;
  pageScreen.hidden = true;
  webview.src = "about:blank";
  currentUrl = "";
  search.value = "";
  requestAnimationFrame(() => search.focus());
}

function showPage(url, title = "Web") {
  startScreen.hidden = true;
  pageScreen.hidden = false;
  currentUrl = url;
  address.textContent = cleanUrl(url);
  fallback.hidden = true;
  webview.src = url;

  const tab = tabs.find(t => t.id === activeId);
  if (tab) {
    tab.url = url;
    tab.title = title;
  }
  renderTabs();
}

function cleanUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
}

searchForm.addEventListener("submit", e => {
  e.preventDefault();
  const query = search.value.trim();
  if (!query) return;

  const url = "https://duckduckgo.com/?q=" + encodeURIComponent(query);
  const tab = tabs.find(t => t.id === activeId);
  if (tab && !tab.url) {
    tab.title = query.length > 22 ? query.slice(0, 22) + "…" : query;
    tab.url = url;
    showPage(url, tab.title);
  } else {
    makeTab(query.length > 22 ? query.slice(0, 22) + "…" : query, url);
  }
});

document.querySelectorAll(".app").forEach(app => {
  app.addEventListener("click", () => {
    const title = app.dataset.title;
    const url = app.dataset.url;
    makeTab(title, url);
  });
});

newTabBtn.addEventListener("click", () => makeTab());

document.getElementById("home-btn").addEventListener("click", showHome);
document.getElementById("reload").addEventListener("click", () => {
  if (currentUrl) webview.src = currentUrl;
});

document.getElementById("back").addEventListener("click", () => {
  try { webview.contentWindow.history.back(); } catch {}
});
document.getElementById("forward").addEventListener("click", () => {
  try { webview.contentWindow.history.forward(); } catch {}
});

openDirect.addEventListener("click", () => {
  if (currentUrl) window.open(currentUrl, "_blank", "noopener");
});

// No localStorage/sessionStorage/cookies are used by this page.
makeTab();
