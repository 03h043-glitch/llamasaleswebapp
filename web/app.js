const REGIONS = [
  "Birmingham", "Central London", "East Midlands", "Head Office", "Leeds and Yorkshire",
  "Liverpool", "Manchester", "North East", "North London", "Scotland", "Shires",
  "South Coast", "Wales and Bristol"
];

const BRANDS = ["Hisense", "TCL", "LG", "Samsung", "Sony", "Other"];
const MODELS = ["A4Q", "A5Q", "A6Q", "A7Q", "E7Q", "E7Q Pro", "U7Q", "U7Q Pro", "U8Q", "U7S", "U7S Pro", "UR8S", "UR9S", "C2", "C2 Ultra", "Other"];
const SIZES = ["32", "40", "43", "50", "55", "65", "75", "85", "100", "Other"];
const TIMEFRAMES = ["Today", "This Week", "Month to Date", "Year to Date"];
const SCOPES = ["Store", "Region"];
const PREMIUM = [
  { label: "UHD", color: "var(--cyan)" },
  { label: "QLED", color: "var(--teal)" },
  { label: "MINI LED", color: "var(--gold)" },
  { label: "RGB", color: "var(--blood)" },
  { label: "LASER", color: "var(--laser)" }
];
const DEFAULT_COMMISSION = [5, 8, 15, 25, 35];
const OTHER_HISENSE_COMMISSION = 5;
const PRODUCTION_DOMAIN = "tiredllama.co.uk";
const PRODUCTION_API_URL = "https://api.tiredllama.co.uk";
const ADD_NEW_STORE = "__add_new_store__";
const DASHBOARD_ACCENT = "var(--hisense)";
const BRAND_COLORS = {
  Hisense: "var(--hisense)",
  TCL: "#ed1c24",
  LG: "#a50034",
  Samsung: "#034ea2",
  Sony: "#000000",
  Other: "#cbd5e1"
};

const KEY = {
  apiUrl: "llamasales.pwa.apiUrl",
  users: "llamasales.pwa.users",
  sales: "llamasales.pwa.sales",
  rates: "llamasales.pwa.rates",
  session: "llamasales.pwa.session",
  asmHash: "llamasales.pwa.asmHash",
  lastSync: "llamasales.pwa.lastSync"
};

const state = {
  page: "dashboard",
  authMode: "login",
  menuOpen: false,
  asmUnlocked: false,
  syncInProgress: false,
  apiUrl: localStorage.getItem(KEY.apiUrl) || defaultApiUrl(),
  users: readJson(KEY.users, []),
  sales: readJson(KEY.sales, []),
  rates: readJson(KEY.rates, {}),
  session: readJson(KEY.session, null),
  meta: { regions: REGIONS, storesByRegion: {} },
  filters: { timeframe: "Today", scope: "Store" },
  toast: ""
};

const app = document.querySelector("#app");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

render();
loadMeta();
syncDaily();

app.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const value = target.dataset.value || "";

  if (action === "menu") {
    state.menuOpen = true;
    render();
  } else if (action === "auth-mode") {
    state.authMode = value === "register" ? "register" : "login";
    render();
  } else if (action === "close-menu") {
    state.menuOpen = false;
    render();
  } else if (action === "page") {
    state.page = value;
    state.menuOpen = false;
    render();
  } else if (action === "dashboard") {
    goDashboard();
  } else if (action === "sign-out") {
    state.session = null;
    state.asmUnlocked = false;
    writeJson(KEY.session, null);
    state.menuOpen = false;
    render();
  } else if (action === "filter-time") {
    state.filters.timeframe = value;
    render();
  } else if (action === "filter-scope") {
    state.filters.scope = value;
    render();
  } else if (action === "share") {
    shareDashboard();
  } else if (action === "sync") {
    state.menuOpen = false;
    render();
    await syncNow(true);
  } else if (action === "asm") {
    state.menuOpen = false;
    state.page = "asm";
    render();
  } else if (action === "commission-config") {
    state.menuOpen = false;
    state.page = "config";
    render();
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-register-region]")) {
    refreshRegisterStores(target.form, target.value);
  } else if (target.matches("[data-register-store]")) {
    toggleNewStoreField(target.form, target.value === ADD_NEW_STORE);
  } else if (target.matches("[data-sale-brand]")) {
    toggleSaleFields(target.form, target.value === "Hisense");
  }
});

app.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!target.matches("input, select, textarea")) return;
  setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 90);
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const formName = form.dataset.form;
  const data = Object.fromEntries(new FormData(form).entries());

  if (formName === "login") {
    await handleLogin(data);
  } else if (formName === "register") {
    await handleRegister(data);
  } else if (formName === "server") {
    state.apiUrl = normalizeUrl(data.apiUrl || "");
    localStorage.setItem(KEY.apiUrl, state.apiUrl);
    await loadMeta();
    if (state.session?.passwordHash) {
      await syncNow(true);
    } else {
      toast("Server URL saved. Sign in to sync.");
    }
  } else if (formName === "sale") {
    await saveSale(data);
  } else if (formName === "asm") {
    await unlockAsm(data);
  } else if (formName === "rate") {
    await saveRate(data);
  }
});

function render() {
  const account = currentAccount();
  app.innerHTML = account ? renderShell(account) : renderAuth();
}

function renderAuth() {
  return `
    <main class="app">
      <section class="auth-shell stack">
        <div>
          <h1>LlamaSales</h1>
          <p class="muted">Sign in to track Hisense TV sales.</p>
        </div>

        <div class="segmented auth-switch">
          <div class="seg-row two">
            ${buttonSeg("auth-mode", "login", "Sign in", state.authMode === "login")}
            ${buttonSeg("auth-mode", "register", "Create account", state.authMode === "register")}
          </div>
        </div>

        ${state.authMode === "register" ? renderRegisterForm() : renderLoginForm()}

        ${renderServerPanel()}
        ${toastHtml()}
      </section>
    </main>
  `;
}

function renderLoginForm() {
  return `
    <form class="card stack" data-form="login">
      <div class="field">
        <label>Username</label>
        <input name="username" autocomplete="username" required>
      </div>
      <div class="field">
        <label>Password</label>
        <input name="password" type="password" autocomplete="current-password" required>
      </div>
      <button class="button">Sign in</button>
      <p class="muted">Create an account if this is your first time using LlamaSales.</p>
    </form>
  `;
}

function renderRegisterForm() {
  return `
    <form class="card stack" data-form="register">
      <div class="field">
        <label>Username</label>
        <input name="username" autocomplete="username" minlength="3" required>
      </div>
      <div class="field">
        <label>Email</label>
        <input name="email" type="email" autocomplete="email" required>
      </div>
      <div class="field">
        <label>Password</label>
        <input name="password" type="password" autocomplete="new-password" minlength="8" required>
      </div>
      <div class="field">
        <label>Confirm Password</label>
        <input name="confirm" type="password" autocomplete="new-password" minlength="8" required>
      </div>
      <div class="field">
        <label>Region</label>
        <select name="region" data-register-region required>
          <option value="">Choose region</option>
          ${REGIONS.map((region) => `<option value="${esc(region)}">${esc(region)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>Store</label>
        <select name="storeChoice" data-register-store required disabled>
          <option value="">Choose a region first</option>
        </select>
      </div>
      <div class="field" data-new-store-wrap hidden>
        <label>New Store Name</label>
        <input name="newStore" autocomplete="organization">
      </div>
      <button class="button">Create account</button>
      <p class="muted">Your account will be created on the LlamaSales backend and available for admin edits.</p>
    </form>
  `;
}

function renderShell(account) {
  return `
    <main class="app">
      <header class="topbar">
        <button class="icon-btn" data-action="menu" aria-label="Menu">${icon("menu")}</button>
        <div class="brand-title">
          <strong>LlamaSales</strong>
          <span>${esc(subtitle(account))}</span>
        </div>
        <div class="status-pill">
          <span class="dot"></span>
          <span class="status-copy"><small>Signed in</small><span>${esc(account.username)}</span></span>
        </div>
      </header>

      <section class="content stack">
        ${renderPage(account)}
      </section>

      <nav class="bottom-nav">
        <button class="icon-btn ${state.page === "dashboard" ? "active" : ""}" data-action="dashboard" aria-label="Dashboard">${icon("home")}</button>
        <button class="icon-btn ${state.page === "commission" ? "active" : ""}" data-action="page" data-value="commission" aria-label="Commission">${icon("commission")}</button>
        <button class="icon-btn add" data-action="page" data-value="add" aria-label="Add sale">${icon("add")}</button>
        <button class="icon-btn" data-action="share" aria-label="Share">${icon("share")}</button>
      </nav>

      ${state.menuOpen ? renderMenu() : ""}
      ${toastHtml()}
    </main>
  `;
}

function renderPage(account) {
  if (state.page === "add") return renderAddSale(account);
  if (state.page === "commission") return renderCommission(account);
  if (state.page === "asm") return renderAsm(account);
  if (state.page === "config") return renderCommissionConfig();
  if (state.page === "settings") return renderSettings();
  return renderDashboard(account);
}

function renderMenu() {
  const asmMode = state.page === "asm" || state.page === "config";
  return `
    <div class="drawer" data-action="close-menu">
      <div class="drawer-panel" onclick="event.stopPropagation()">
        <button class="button secondary" data-action="dashboard">Dashboard</button>
        <button class="button secondary" data-action="page" data-value="commission">Commission tracker</button>
        ${asmMode ? `<button class="button secondary" data-action="asm">ASM analytics</button><button class="button secondary" data-action="commission-config">Configure commission</button>` : `<button class="button secondary" data-action="asm">ASM Tools</button>`}
        <button class="button secondary" data-action="page" data-value="settings">Server sync</button>
        <button class="button secondary" data-action="page" data-value="add">Add sale</button>
        <button class="button secondary" data-action="share">Share dashboard</button>
        <button class="button danger" data-action="sign-out">Sign out</button>
        <button class="button secondary" data-action="close-menu">Close</button>
      </div>
    </div>
  `;
}

function renderSettings() {
  return `
    ${renderServerPanel()}
  `;
}

function renderServerPanel(forceForm = false) {
  if (isProductionHost() && !forceForm) {
    return `
      <section class="card stack">
        <h3>Server Sync</h3>
        <p class="muted">Using ${esc(PRODUCTION_API_URL)}.</p>
        <p class="muted">Last sync: ${esc(localStorage.getItem(KEY.lastSync) || "Never")}</p>
      </section>
    `;
  }
  return `
    <form class="card stack" data-form="server">
      <h3>Server Sync</h3>
      <p class="muted">${isProductionHost() ? "Production uses the fixed backend URL. Change this only for testing." : "Use the local backend URL while testing."}</p>
      <div class="field">
        <label>Backend URL</label>
        <input name="apiUrl" value="${esc(state.apiUrl)}" placeholder="${esc(PRODUCTION_API_URL)}">
      </div>
      <button class="button secondary">Save${state.session?.passwordHash ? " & Sync" : ""}</button>
      <p class="muted">Last sync: ${esc(localStorage.getItem(KEY.lastSync) || "Never")}</p>
    </form>
  `;
}

function renderDashboard(account) {
  const stats = dashboardStats(account, state.filters.timeframe, state.filters.scope);
  const sovColor = stats.shareOfValue < 10 ? "var(--red)" : stats.shareOfValue < 20 ? "var(--yellow)" : "var(--green)";
  return `
    <div class="segmented dashboard-filters">
      <div class="seg-row four">${TIMEFRAMES.map((time) => buttonSeg("filter-time", time, shortTime(time), state.filters.timeframe === time)).join("")}</div>
      <div class="seg-row two">${SCOPES.map((scope) => buttonSeg("filter-scope", scope, scope, state.filters.scope === scope)).join("")}</div>
    </div>

    <div class="grid">
      ${kpi("Hisense Share of Value", `${stats.shareOfValue}%`, `${money(stats.hisenseRevenue)} of ${money(stats.totalRevenue)} total value`, sovColor, "span-4 large sov-card", brandShareBar(stats))}
      ${kpi("Hisense Units", stats.hisenseUnits, `of ${stats.totalUnits} total units across brands`, DASHBOARD_ACCENT, "span-2")}
      ${kpi("Hisense Revenue", money(stats.hisenseRevenue), `vs ${money(stats.totalRevenue)} across all brands`, DASHBOARD_ACCENT, "span-2")}
      ${kpi("Hisense ASP", money(stats.hisenseAsp), "average selling price", DASHBOARD_ACCENT, "span-2")}
      ${kpi("Soundbar Sales", stats.soundbarUnits, `${money(stats.soundbarRevenue)} soundbar value`, DASHBOARD_ACCENT, "span-2")}
    </div>

    ${premiumMix(stats)}
  `;
}

function renderAddSale(account) {
  return `
    <form class="card stack" data-form="sale">
      <div>
        <h2>Add Sale</h2>
        <p class="muted">Choose a brand, then add the required sale details.</p>
      </div>
      <div class="field">
        <label>Brand</label>
        <select name="brand" id="sale-brand" data-sale-brand required>${optionsWithPlaceholder(BRANDS, "Choose brand")}</select>
      </div>
      <div class="field" data-hisense-sale-field hidden>
        <label>Hisense Model</label>
        <select name="model">${optionsWithPlaceholder(MODELS, "Choose model")}</select>
      </div>
      <div class="field" data-hisense-sale-field hidden>
        <label>Screen Size</label>
        <select name="size">${optionsWithPlaceholder(SIZES, "Choose size")}</select>
      </div>
      <div class="field">
        <label>Sale Value</label>
        <input name="price" inputmode="decimal" placeholder="Example: 799" required>
      </div>
      <div class="field" data-hisense-sale-field hidden>
        <label>Soundbar Value</label>
        <input name="soundbarRevenue" inputmode="decimal" placeholder="Leave blank if none">
      </div>
      <button class="button">Complete Sale</button>
      <p class="muted">Sale will be saved locally and uploaded on the next successful sync.</p>
    </form>
  `;
}

function renderCommission(account) {
  const stats = commissionStats(account);
  return `
    <div>
      <h2>Commission Tracker</h2>
      <p class="muted">Paid Hisense sales for ${esc(account.username)}</p>
    </div>
    <div class="grid">
      ${kpi("Today", money(stats.todayEarnings), `${stats.todayUnits} paid Hisense units`, "var(--hisense)", "span-2")}
      ${kpi("Pay Period", money(stats.periodEarnings), `${stats.periodUnits} units | ${shortDate(stats.periodStart)} to ${shortDate(stats.periodEnd)}`, "var(--gold)", "span-2")}
      ${kpi("Year To Date", money(stats.ytdEarnings), `${stats.ytdUnits} paid Hisense units`, "var(--green)", "span-4")}
    </div>
    <section class="card">
      <h3>Commission Rates</h3>
      <div class="metric-row">
        ${PREMIUM.map((cat, index) => metric(cat.label, money(DEFAULT_COMMISSION[index]), "category default", cat.color)).join("")}
        ${metric("OTHER", money(OTHER_HISENSE_COMMISSION), "fallback", "var(--muted)")}
      </div>
    </section>
    <section class="card">
      <h3>Paid Sales</h3>
      ${stats.entries.length ? stats.entries.slice(0, 8).map((entry) => listRow(saleName(entry.sale), `${entry.sale.date} | ${money(entry.sale.price)}`, money(entry.value))).join("") : `<p class="muted">No paid Hisense sales in this pay period.</p>`}
    </section>
  `;
}

function renderAsm(account) {
  if (!state.asmUnlocked) return renderAsmGate();
  const regions = regionStats();
  const total = regions.reduce((acc, region) => {
    acc.totalUnits += region.totalUnits;
    acc.hisenseUnits += region.hisenseUnits;
    acc.totalRevenue += region.totalRevenue;
    acc.hisenseRevenue += region.hisenseRevenue;
    acc.soundbarUnits += region.soundbarUnits;
    acc.commissionDue += region.commissionDue;
    if (region.totalUnits > 0) acc.activeRegions += 1;
    return acc;
  }, blankRegion("All Regions"));
  finishRegion(total);

  return `
    <div>
      <h2>ASM Tools</h2>
      <p class="muted">Regional analytics across synced sales data.</p>
    </div>
    <div class="grid">
      ${kpi("Regions", total.activeRegions, "with recorded sales", "var(--violet)", "span-2")}
      ${kpi("Hisense Units", total.hisenseUnits, `of ${total.totalUnits} total units`, "var(--hisense)", "span-2")}
      ${kpi("Hisense Value", money(total.hisenseRevenue), `${total.shareOfValue}% share of value`, "var(--green)", "span-2")}
      ${kpi("Commission Due", money(total.commissionDue), "configured model rates", "var(--gold)", "span-2")}
    </div>
    ${regions.map(regionCard).join("")}
  `;
}

function renderAsmGate() {
  const hasPassword = Boolean(localStorage.getItem(KEY.asmHash));
  return `
    <form class="card stack" data-form="asm">
      <h2>ASM Tools</h2>
      <p class="muted">${hasPassword ? "Enter the ASM password." : "Create the ASM password for this device."}</p>
      <div class="field">
        <label>${hasPassword ? "ASM password" : "Create ASM password"}</label>
        <input name="password" type="password" required>
      </div>
      ${hasPassword ? "" : `<div class="field"><label>Confirm password</label><input name="confirm" type="password" required></div>`}
      <button class="button">${hasPassword ? "Unlock" : "Save Password"}</button>
    </form>
  `;
}

function renderCommissionConfig() {
  if (!state.asmUnlocked) return renderAsmGate();
  const rates = Object.entries(state.rates).sort(([a], [b]) => a.localeCompare(b));
  return `
    <form class="card stack" data-form="rate">
      <h2>Commission Config</h2>
      <p class="muted">Set paid commission by Hisense model and size.</p>
      <div class="field"><label>Model</label><select name="model">${options(MODELS, "U7Q")}</select></div>
      <div class="field"><label>Size</label><select name="size">${options(SIZES, "55")}</select></div>
      <div class="field"><label>Commission Value</label><input name="value" inputmode="decimal" placeholder="Example: 15" required></div>
      <button class="button">Save Rate</button>
      <p class="muted">If a backend URL is configured, this saves to the laptop backend and syncs back.</p>
    </form>
    <section class="card">
      <h3>Configured Combos</h3>
      ${rates.length ? rates.map(([key, value]) => {
        const [model, size] = key.split("|");
        return listRow(`${esc(model)} ${esc(size)}"`, "model/size override", money(value));
      }).join("") : `<p class="muted">No overrides yet. Category defaults are still used.</p>`}
    </section>
  `;
}

async function handleLogin(data) {
  const username = String(data.username || "").trim();
  const passwordHash = await sha256(String(data.password || ""));
  if (!username || !passwordHash) {
    toast("Enter username and password.");
    return;
  }

  try {
    const payload = await apiPost("/api/login", { username, passwordHash });
    applyServerPayload(payload);
    const account = payload.account;
    state.session = { username: account.username, passwordHash, account };
    writeJson(KEY.session, state.session);
    state.page = "dashboard";
    toast("Signed in.");
    render();
    return;
  } catch (error) {
    const cached = state.users.find((user) => user.username.toLowerCase() === username.toLowerCase());
    if (!cached || cached.passwordHash !== passwordHash) {
      toast(error.message || "Username or password is incorrect.");
      return;
    }
    state.session = { username: cached.username, passwordHash, account: cached };
    writeJson(KEY.session, state.session);
    state.page = "dashboard";
    toast("Signed in offline.");
    render();
  }
}

async function handleRegister(data) {
  const username = String(data.username || "").trim();
  const email = String(data.email || "").trim();
  const password = String(data.password || "");
  const confirm = String(data.confirm || "");
  const region = canonicalRegion(data.region || "");
  const store = data.storeChoice === ADD_NEW_STORE ? String(data.newStore || "").trim() : String(data.storeChoice || "").trim();

  if (!username || !email || !region || !store) {
    toast("Complete all account fields.");
    return;
  }
  if (/\s/.test(username) || username.length < 3) {
    toast("Username must be at least 3 characters with no spaces.");
    return;
  }
  if (password.length < 8) {
    toast("Use at least 8 characters for the password.");
    return;
  }
  if (password !== confirm) {
    toast("Passwords do not match.");
    return;
  }

  try {
    const passwordHash = await sha256(password);
    const payload = await apiPost("/api/register", { username, email, region, store, passwordHash });
    applyServerPayload(payload);
    applyMetaPayload(payload.meta);
    const account = payload.account;
    state.session = { username: account.username, passwordHash, account };
    writeJson(KEY.session, state.session);
    state.authMode = "login";
    state.page = "dashboard";
    toast("Account created.");
    render();
  } catch (error) {
    toast(`Account creation failed: ${error.message}`);
  }
}

async function saveSale(data) {
  const account = currentAccount();
  if (!account) return;
  const brand = data.brand || "";
  const price = Number(data.price || 0);
  if (!brand || !price) {
    toast("Choose a brand and enter a valid value.");
    return;
  }
  const isHisense = brand === "Hisense";
  if (isHisense && (!data.model || !data.size)) {
    toast("Choose the Hisense model and screen size.");
    return;
  }
  const soundbarRevenue = isHisense ? Number(data.soundbarRevenue || 0) : 0;
  const sale = {
    id: randomId(),
    date: todayIso(),
    brand,
    model: isHisense ? data.model || "" : "",
    size: isHisense ? data.size || "" : "",
    price,
    soundbarUnits: soundbarRevenue > 0 ? 1 : 0,
    soundbarRevenue,
    username: account.username,
    region: account.region,
    store: account.store,
    createdAt: Date.now()
  };
  mergeSales([sale]);
  persistSales();
  state.page = "dashboard";
  toast("Sale saved.");
  render();
  await syncNow(false);
}

async function unlockAsm(data) {
  const existing = localStorage.getItem(KEY.asmHash);
  const password = String(data.password || "");
  const hash = await sha256(password);
  if (existing) {
    if (existing !== hash) {
      toast("ASM password is incorrect.");
      return;
    }
    state.asmUnlocked = true;
    toast("ASM unlocked.");
    render();
    return;
  }
  if (password.trim().length < 4) {
    toast("Use at least 4 characters.");
    return;
  }
  if (password !== String(data.confirm || "")) {
    toast("ASM passwords do not match.");
    return;
  }
  localStorage.setItem(KEY.asmHash, hash);
  state.asmUnlocked = true;
  toast("ASM password saved.");
  render();
}

async function saveRate(data) {
  const model = String(data.model || "").trim();
  const size = String(data.size || "").trim();
  const value = Number(data.value || 0);
  if (!model || !size || Number.isNaN(value)) {
    toast("Choose a model/size and enter a valid value.");
    return;
  }

  if (state.apiUrl) {
    try {
      const payload = await apiPost("/api/rates/save", { ...authPayload(), model, size, value });
      applyServerPayload(payload);
      toast("Commission rate saved to backend.");
      render();
      return;
    } catch (error) {
      toast(`Backend save failed. Saved locally instead.`);
    }
  }

  state.rates[`${model}|${size}`] = value;
  writeJson(KEY.rates, state.rates);
  render();
}

async function syncDaily() {
  const today = todayIso();
  if (state.apiUrl && state.session?.passwordHash && localStorage.getItem(KEY.lastSync) !== today) {
    await syncNow(false);
  }
}

async function loadMeta() {
  if (!state.apiUrl) return;
  try {
    const payload = await apiGet("/api/meta");
    applyMetaPayload(payload);
  } catch {
    // Store suggestions are useful but should not block sign-in.
  }
}

async function syncNow(showResult) {
  if (!state.apiUrl) {
    if (showResult) toast("Set the backend URL first.");
    return;
  }
  if (!state.session?.passwordHash) {
    if (showResult) toast("Sign in before syncing.");
    return;
  }
  if (state.syncInProgress) return;
  state.syncInProgress = true;
  try {
    const payload = await apiPost("/api/sync", { ...authPayload(), sales: state.sales });
    applyServerPayload(payload);
    if (showResult) toast("Sync complete.");
  } catch (error) {
    if (showResult) toast(`Sync failed: ${error.message}`);
  } finally {
    state.syncInProgress = false;
    render();
  }
}

async function apiPost(path, payload) {
  const response = await fetch(`${state.apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
  return body;
}

async function apiGet(path) {
  const response = await fetch(`${state.apiUrl}${path}`, { method: "GET" });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
  return body;
}

function authPayload() {
  return {
    username: state.session?.username || "",
    passwordHash: state.session?.passwordHash || ""
  };
}

function applyServerPayload(payload) {
  if (payload.account && typeof payload.account === "object") {
    const account = payload.account;
    state.users = [account];
    writeJson(KEY.users, state.users);
    if (state.session?.username?.toLowerCase() === String(account.username || "").toLowerCase()) {
      state.session.account = account;
      writeJson(KEY.session, state.session);
    }
  } else if (Array.isArray(payload.users)) {
    state.users = payload.users;
    writeJson(KEY.users, state.users);
  }
  if (Array.isArray(payload.sales)) {
    mergeSales(payload.sales);
    persistSales();
  }
  if (payload.commissionRates && typeof payload.commissionRates === "object") {
    state.rates = payload.commissionRates;
    writeJson(KEY.rates, state.rates);
  }
  applyMetaPayload(payload.meta);
  localStorage.setItem(KEY.lastSync, todayIso());
}

function applyMetaPayload(meta) {
  if (!meta || typeof meta !== "object") return;
  if (Array.isArray(meta.regions)) {
    state.meta.regions = meta.regions.map((region) => canonicalRegion(region)).filter(Boolean);
  }
  if (meta.storesByRegion && typeof meta.storesByRegion === "object") {
    state.meta.storesByRegion = meta.storesByRegion;
  }
}

function dashboardStats(account, timeframe, scope) {
  const stats = {
    totalUnits: 0,
    hisenseUnits: 0,
    soundbarUnits: 0,
    shareOfValue: 0,
    totalRevenue: 0,
    hisenseRevenue: 0,
    hisenseAsp: 0,
    soundbarRevenue: 0,
    premiumTotalRevenue: 0,
    premiumRevenue: [0, 0, 0, 0, 0],
    brandRevenue: Object.fromEntries(BRANDS.map((brand) => [brand, 0]))
  };
  for (const sale of state.sales) {
    if (!inScope(sale, account, scope) || !inTimeframe(sale, timeframe)) continue;
    const saleValue = Number(sale.price || 0);
    const brand = BRANDS.includes(sale.brand) ? sale.brand : "Other";
    stats.totalUnits += 1;
    stats.totalRevenue += saleValue;
    stats.brandRevenue[brand] += saleValue;
    stats.soundbarUnits += Number(sale.soundbarUnits || 0);
    stats.soundbarRevenue += Number(sale.soundbarRevenue || 0);
    if (sale.brand === "Hisense") {
      stats.hisenseUnits += 1;
      stats.hisenseRevenue += saleValue;
      const index = premiumIndex(sale.model);
      if (index >= 0) {
        stats.premiumRevenue[index] += saleValue;
        stats.premiumTotalRevenue += saleValue;
      }
    }
  }
  stats.shareOfValue = stats.totalRevenue <= 0 ? 0 : Math.round((stats.hisenseRevenue * 100) / stats.totalRevenue);
  stats.hisenseAsp = stats.hisenseUnits <= 0 ? 0 : stats.hisenseRevenue / stats.hisenseUnits;
  return stats;
}

function commissionStats(account) {
  const today = dateOnly(new Date());
  const periodStart = currentPayPeriodStart(today);
  const periodEnd = currentPayPeriodEnd(today);
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const stats = { todayUnits: 0, periodUnits: 0, ytdUnits: 0, todayEarnings: 0, periodEarnings: 0, ytdEarnings: 0, periodStart, periodEnd, entries: [] };
  for (const sale of state.sales) {
    if (sale.brand !== "Hisense" || !belongsTo(sale, account)) continue;
    const saleDate = parseIsoDate(sale.date);
    if (!saleDate || saleDate > today) continue;
    const value = commissionValue(sale);
    if (sameDate(saleDate, today)) {
      stats.todayUnits += 1;
      stats.todayEarnings += value;
    }
    if (saleDate >= yearStart) {
      stats.ytdUnits += 1;
      stats.ytdEarnings += value;
    }
    if (saleDate >= periodStart && saleDate <= periodEnd) {
      stats.periodUnits += 1;
      stats.periodEarnings += value;
      stats.entries.push({ sale, value });
    }
  }
  return stats;
}

function regionStats() {
  const regions = REGIONS.map(blankRegion);
  for (const sale of state.sales) {
    const region = regions.find((item) => item.region.toLowerCase() === canonicalRegion(sale.region).toLowerCase());
    if (!region) continue;
    region.totalUnits += 1;
    region.totalRevenue += Number(sale.price || 0);
    region.soundbarUnits += Number(sale.soundbarUnits || 0);
    if (sale.brand === "Hisense") {
      region.hisenseUnits += 1;
      region.hisenseRevenue += Number(sale.price || 0);
      region.commissionDue += commissionValue(sale);
    }
  }
  regions.forEach(finishRegion);
  return regions;
}

function blankRegion(region) {
  return { region, totalUnits: 0, hisenseUnits: 0, soundbarUnits: 0, shareOfValue: 0, activeRegions: 0, totalRevenue: 0, hisenseRevenue: 0, hisenseAsp: 0, commissionDue: 0 };
}

function finishRegion(region) {
  region.shareOfValue = region.totalRevenue <= 0 ? 0 : Math.round((region.hisenseRevenue * 100) / region.totalRevenue);
  region.hisenseAsp = region.hisenseUnits <= 0 ? 0 : region.hisenseRevenue / region.hisenseUnits;
}

function inScope(sale, account, scope) {
  if (!account) return false;
  if (!sale.username) return true;
  if (scope === "Region") return canonicalRegion(sale.region).toLowerCase() === canonicalRegion(account.region).toLowerCase();
  return canonicalRegion(sale.region).toLowerCase() === canonicalRegion(account.region).toLowerCase() && String(sale.store || "").toLowerCase() === String(account.store || "").toLowerCase();
}

function belongsTo(sale, account) {
  return account && (!sale.username || String(sale.username).toLowerCase() === String(account.username).toLowerCase());
}

function inTimeframe(sale, timeframe) {
  const date = parseIsoDate(sale.date);
  if (!date) return timeframe === "Year to Date";
  const today = dateOnly(new Date());
  if (timeframe === "Today") return sameDate(date, today);
  if (timeframe === "This Week") {
    const start = new Date(today);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return date >= start && date <= today;
  }
  if (timeframe === "Month to Date") return date >= new Date(today.getFullYear(), today.getMonth(), 1) && date <= today;
  if (timeframe === "Year to Date") return date >= new Date(today.getFullYear(), 0, 1) && date <= today;
  return true;
}

function premiumIndex(model) {
  if (["A4Q", "A5Q", "A6Q"].includes(model)) return 0;
  if (["A7Q", "E7Q", "E7Q Pro"].includes(model)) return 1;
  if (["U7Q", "U7Q Pro", "U8Q", "U7S", "U7S Pro"].includes(model)) return 2;
  if (["UR8S", "UR9S"].includes(model)) return 3;
  if (["C2", "C2 Ultra"].includes(model)) return 4;
  return -1;
}

function commissionValue(sale) {
  const key = `${sale.model || ""}|${sale.size || ""}`;
  if (Object.prototype.hasOwnProperty.call(state.rates, key)) return Number(state.rates[key] || 0);
  const index = premiumIndex(sale.model);
  return index >= 0 ? DEFAULT_COMMISSION[index] : OTHER_HISENSE_COMMISSION;
}

function currentAccount() {
  if (!state.session) return null;
  return state.users.find((user) => user.username === state.session.username) || state.session.account || null;
}

function mergeSales(incoming) {
  const byId = new Map(state.sales.map((sale) => [sale.id, sale]));
  for (const sale of incoming) {
    if (!sale || !sale.id) continue;
    byId.set(sale.id, normalizeSale(sale));
  }
  state.sales = Array.from(byId.values()).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function normalizeSale(sale) {
  return {
    id: String(sale.id || randomId()),
    date: String(sale.date || todayIso()),
    brand: String(sale.brand || ""),
    model: String(sale.model || ""),
    size: String(sale.size || ""),
    price: Number(sale.price || 0),
    soundbarUnits: Number(sale.soundbarUnits || 0),
    soundbarRevenue: Number(sale.soundbarRevenue || 0),
    username: String(sale.username || ""),
    region: canonicalRegion(sale.region || ""),
    store: String(sale.store || ""),
    createdAt: Number(sale.createdAt || Date.now())
  };
}

function persistSales() {
  writeJson(KEY.sales, state.sales);
}

function goDashboard() {
  state.page = "dashboard";
  state.menuOpen = false;
  state.filters = { timeframe: "Today", scope: "Store" };
  render();
}

function shareDashboard() {
  const account = currentAccount();
  if (!account) return;
  const stats = dashboardStats(account, state.filters.timeframe, state.filters.scope);
  const text = `LlamaSales\nHisense SOV: ${stats.shareOfValue}%\nHisense Units: ${stats.hisenseUnits}/${stats.totalUnits}\nHisense Revenue: ${money(stats.hisenseRevenue)} of ${money(stats.totalRevenue)}`;
  if (navigator.share) {
    navigator.share({ title: "LlamaSales dashboard", text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text);
    toast("Dashboard summary copied.");
  }
}

function subtitle(account) {
  if (state.page === "commission") return "Commission Tracker";
  if (state.page === "asm") return "ASM Tools";
  if (state.page === "config") return "Commission Config";
  if (state.page === "settings") return "Server Sync";
  if (state.page === "add") return "Add Sale";
  return account.store || "Dashboard";
}

function premiumMix(stats) {
  const total = stats.premiumTotalRevenue;
  const segments = PREMIUM.map((cat, index) => {
    const value = stats.premiumRevenue[index];
    const pct = total <= 0 ? 0 : Math.round((value * 100) / total);
    return { ...cat, value, pct };
  });
  return `
    <section class="card">
      <h3>Premium Mix <span class="muted">Hisense value by category</span></h3>
      <div class="premium-bar">
        ${total <= 0 ? `<div class="premium-seg" style="width:100%;background:rgba(92,108,130,.45)"></div>` : segments.filter((item) => item.value > 0).map((item) => `<div class="premium-seg" style="width:${item.pct}%;background:${item.color}"></div>`).join("")}
      </div>
      <div class="legend">
        ${segments.map((item) => `<span><i class="swatch" style="background:${item.color}"></i>${item.label} ${item.pct}%</span>`).join("")}
      </div>
    </section>
  `;
}

function brandShareBar(stats) {
  const total = stats.totalRevenue;
  const segments = BRANDS.map((brand) => {
    const value = Number(stats.brandRevenue?.[brand] || 0);
    const pct = total <= 0 ? 0 : (value * 100) / total;
    return { brand, value, pct, color: brandColor(brand) };
  });
  const visibleSegments = segments.filter((item) => item.value > 0);
  const legendSegments = segments.filter((item) => item.value > 0 || item.brand === "Hisense");
  const arcSegments = [];
  let cursor = 0;

  visibleSegments.forEach((item, index) => {
    const start = cursor;
    const end = index === visibleSegments.length - 1 ? 100 : Math.min(100, cursor + item.pct);
    cursor = end;
    if (end > start) arcSegments.push({ ...item, start, end });
  });

  const firstArc = arcSegments[0];
  const lastArc = arcSegments[arcSegments.length - 1];
  const score = Math.max(0, Math.min(100, Number(stats.shareOfValue) || 0));
  const needle = gaugePoint(score, 76);
  const marker10 = gaugeMarker(10);
  const marker20 = gaugeMarker(20);
  const label10 = gaugePoint(10, 116);
  const label20 = gaugePoint(20, 116);

  return `
    <div class="brand-share" aria-label="Brand share of value">
      <div class="brand-share-gauge">
        <svg viewBox="0 0 240 148" role="img" aria-label="Hisense share of value at ${score}% with brand value mix">
          <path class="brand-share-track" d="${gaugeArc(0, 100)}"></path>
          ${arcSegments.map(brandShareArcSegment).join("")}
          ${firstArc ? brandShareCap(firstArc, "start") : ""}
          ${lastArc ? brandShareCap(lastArc, "end") : ""}
          <line class="brand-share-threshold" x1="${marker10.inner.x}" y1="${marker10.inner.y}" x2="${marker10.outer.x}" y2="${marker10.outer.y}"></line>
          <line class="brand-share-threshold" x1="${marker20.inner.x}" y1="${marker20.inner.y}" x2="${marker20.outer.x}" y2="${marker20.outer.y}"></line>
          <text class="brand-share-label" x="${label10.x}" y="${label10.y}">10%</text>
          <text class="brand-share-label" x="${label20.x}" y="${label20.y}">20%</text>
          <line class="brand-share-needle" x1="120" y1="118" x2="${needle.x}" y2="${needle.y}"></line>
          <circle class="brand-share-hub" cx="120" cy="118" r="7"></circle>
          <text class="brand-share-end-label" x="28" y="138">0%</text>
          <text class="brand-share-end-label" x="212" y="138">100%</text>
        </svg>
      </div>
      <div class="brand-share-legend">
        ${legendSegments.map((item) => `<span><i class="swatch" style="background:${item.color}"></i>${esc(item.brand)} ${shareLabel(item.pct)}</span>`).join("")}
      </div>
    </div>
  `;
}

function brandShareArcSegment(item) {
  return `<path class="brand-share-arc-segment" d="${gaugeArc(item.start, item.end)}" stroke="${item.color}" aria-label="${esc(item.brand)} ${shareLabel(item.pct)}"></path>`;
}

function brandShareCap(item, position) {
  const point = gaugePoint(position === "start" ? item.start : item.end, 92);
  return `<circle class="brand-share-cap" cx="${point.x}" cy="${point.y}" r="8" fill="${item.color}"></circle>`;
}

function shareLabel(percent) {
  if (percent > 0 && percent < 1) return `${Math.max(0.1, Math.round(percent * 10) / 10)}%`;
  return `${Math.round(percent)}%`;
}

function brandColor(brand) {
  return BRAND_COLORS[brand] || BRAND_COLORS.Other;
}

function gaugeArc(startPercent, endPercent) {
  const start = gaugePoint(startPercent, 92);
  const end = gaugePoint(endPercent, 92);
  const largeArc = Math.abs(endPercent - startPercent) > 100 ? 1 : 0;
  return `M ${start.x} ${start.y} A 92 92 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function gaugeMarker(percent) {
  return {
    inner: gaugePoint(percent, 78),
    outer: gaugePoint(percent, 106)
  };
}

function gaugePoint(percent, radius) {
  const angle = (180 - (Math.max(0, Math.min(100, percent)) * 1.8)) * Math.PI / 180;
  return {
    x: Math.round((120 + radius * Math.cos(angle)) * 10) / 10,
    y: Math.round((118 - radius * Math.sin(angle)) * 10) / 10
  };
}

function regionCard(region) {
  return `
    <section class="card">
      <h3>${esc(region.region)} <span class="muted">${region.shareOfValue}% SOV</span></h3>
      <div class="metric-row">
        ${metric("Hisense", region.hisenseUnits, `of ${region.totalUnits} units`, "var(--hisense)")}
        ${metric("Value", money(region.hisenseRevenue), `of ${money(region.totalRevenue)}`, "var(--green)")}
        ${metric("ASP", money(region.hisenseAsp), "Hisense average", "var(--blue)")}
        ${metric("Commission", money(region.commissionDue), `${region.soundbarUnits} soundbars`, "var(--gold)")}
      </div>
    </section>
  `;
}

function kpi(title, value, subtitleText, accent, extraClass = "", extra = "") {
  return `
    <section class="card kpi ${extraClass}" style="--accent:${accent}">
      <div class="kpi-title">${esc(title)}</div>
      <div class="kpi-value">${esc(String(value))}</div>
      <div class="kpi-sub">${esc(subtitleText)}</div>
      ${extra}
    </section>
  `;
}

function metric(title, value, subtitleText, accent) {
  return `
    <div class="metric" style="--accent:${accent}">
      <span class="muted">${esc(title)}</span>
      <strong>${esc(String(value))}</strong>
      <span class="subtle">${esc(subtitleText)}</span>
    </div>
  `;
}

function listRow(title, subtitleText, value) {
  return `<div class="list-row"><div><strong>${esc(title)}</strong><br><span class="muted">${esc(subtitleText)}</span></div><strong>${esc(String(value))}</strong></div>`;
}

function buttonSeg(action, value, label, active) {
  return `<button class="seg ${active ? "active" : ""}" data-action="${action}" data-value="${esc(value)}">${esc(label)}</button>`;
}

function refreshRegisterStores(form, region) {
  if (!form) return;
  const storeSelect = form.querySelector("[data-register-store]");
  if (!storeSelect) return;
  storeSelect.disabled = !region;
  storeSelect.innerHTML = region ? registerStoreOptions(region) : `<option value="">Choose a region first</option>`;
  toggleNewStoreField(form, false);
}

function toggleNewStoreField(form, show) {
  if (!form) return;
  const wrap = form.querySelector("[data-new-store-wrap]");
  const input = form.elements.newStore;
  if (!wrap || !input) return;
  wrap.hidden = !show;
  input.required = show;
  if (!show) input.value = "";
  if (show) setTimeout(() => input.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
}

function toggleSaleFields(form, showHisense) {
  if (!form) return;
  form.querySelectorAll("[data-hisense-sale-field]").forEach((field) => {
    field.hidden = !showHisense;
    field.querySelectorAll("input, select").forEach((input) => {
      input.required = showHisense && (input.name === "model" || input.name === "size");
      if (!showHisense) input.value = "";
    });
  });
}

function registerStoreOptions(region) {
  const stores = storesForRegion(region);
  const existing = stores.map((store) => `<option value="${esc(store)}">${esc(store)}</option>`).join("");
  return `<option value="">Choose store</option>${existing}<option value="${ADD_NEW_STORE}">Add new store</option>`;
}

function storesForRegion(region) {
  const clean = canonicalRegion(region);
  const storesByRegion = state.meta.storesByRegion || {};
  const direct = Array.isArray(storesByRegion[clean]) ? storesByRegion[clean] : [];
  const lowerKey = Object.keys(storesByRegion).find((key) => key.toLowerCase() === clean.toLowerCase());
  const matched = lowerKey && Array.isArray(storesByRegion[lowerKey]) ? storesByRegion[lowerKey] : [];
  const combined = [...direct, ...matched];
  return [...new Set(combined.map((store) => String(store || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function options(values, selected) {
  return values.map((value) => `<option ${value === selected ? "selected" : ""}>${esc(value)}</option>`).join("");
}

function optionsWithPlaceholder(values, placeholder) {
  return `<option value="">${esc(placeholder)}</option>${values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}`;
}

function toast(message) {
  state.toast = message;
  render();
  setTimeout(() => {
    if (state.toast === message) {
      state.toast = "";
      render();
    }
  }, 3200);
}

function toastHtml() {
  return state.toast ? `<div class="toast">${esc(state.toast)}</div>` : "";
}

function icon(name) {
  const paths = {
    menu: "M4 7h16v2H4zm0 4h16v2H4zm0 4h16v2H4z",
    home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    commission: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm3 2v2h10V8zm0 4v2h3v-2zm5 0v2h5v-2zm-5 4v2h3v-2zm5 0v2h5v-2z",
    add: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z",
    share: "M18 16.1c-1 0-1.9.4-2.5 1.1l-6.8-4c.1-.4.1-.8 0-1.2l6.8-4c.6.7 1.5 1.1 2.5 1.1a3.1 3.1 0 1 0-3.1-3.1c0 .2 0 .4.1.6l-6.9 4.1a3.1 3.1 0 1 0 0 4.6l6.9 4.1c0 .2-.1.4-.1.6a3.1 3.1 0 1 0 3.1-3.1z"
  };
  return `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${paths[name] || paths.menu}"/></svg>`;
}

function saleName(sale) {
  if (sale.brand === "Hisense") return `${sale.brand} ${sale.model || ""} ${sale.size ? `${sale.size}"` : ""}`.trim();
  return `${sale.brand} TV`;
}

function money(value) {
  return `GBP ${Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function shortTime(value) {
  if (value === "This Week") return "Week";
  if (value === "Month to Date") return "MTD";
  if (value === "Year to Date") return "YTD";
  return value;
}

function shortDate(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function todayIso() {
  return localIsoDate(new Date());
}

function parseIsoDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : dateOnly(date);
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function currentPayPeriodStart(today) {
  if (today.getDate() >= 26) return new Date(today.getFullYear(), today.getMonth(), 26);
  return new Date(today.getFullYear(), today.getMonth() - 1, 26);
}

function currentPayPeriodEnd(today) {
  const start = currentPayPeriodStart(today);
  return new Date(start.getFullYear(), start.getMonth() + 1, 25);
}

function canonicalRegion(region) {
  const clean = String(region || "").trim();
  return REGIONS.find((item) => item.toLowerCase() === clean.toLowerCase()) || clean;
}

async function sha256(value) {
  if (!crypto.subtle) throw new Error("Secure browser context required for password hashing.");
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultApiUrl() {
  const host = location.hostname;
  if (!host) return "http://127.0.0.1:8787";
  if (host === "localhost" || host === "127.0.0.1") return `http://${host}:8787`;
  if (host === PRODUCTION_DOMAIN || host === `app.${PRODUCTION_DOMAIN}`) return PRODUCTION_API_URL;
  if (host.startsWith("app.")) return `${location.protocol}//api.${host.slice(4)}`;
  return PRODUCTION_API_URL;
}

function normalizeUrl(value) {
  let clean = String(value || "").trim();
  while (clean.endsWith("/")) clean = clean.slice(0, -1);
  if (clean && !clean.startsWith("http://") && !clean.startsWith("https://")) clean = `https://${clean}`;
  return clean;
}

function isProductionHost() {
  return location.hostname === PRODUCTION_DOMAIN || location.hostname === `app.${PRODUCTION_DOMAIN}`;
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (value === null || value === undefined) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}
