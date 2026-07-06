const REGIONS = [
  "Birmingham", "Central London", "East Midlands", "Head Office", "Leeds and Yorkshire",
  "Liverpool", "Manchester", "North East", "North London", "Scotland", "Shires",
  "South Coast", "Wales and Bristol"
];

const TV_MODELS = ["A4Q", "A5Q", "A6Q", "A7Q", "E7Q", "E7Q Pro", "U7Q", "U7Q Pro", "U8Q", "U7S", "U7S Pro", "UR8S", "UR9S", "C2", "C2 Ultra", "Other"];
const SOUNDBAR_MODELS = ["AX3100Q", "AX5100Q", "AX5125H", "AX5125Q", "AX7100Q", "AX8100Q", "Other"];
const SIZES = ["32", "40", "43", "50", "55", "65", "75", "85", "100", "Other"];
const ADMIN_COOKIE = "llamasales_admin";
const ALLOWED_ORIGINS = new Set([
  "https://app.tiredllama.co.uk",
  "https://tiredllama.co.uk",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return corsResponse(null, request, 204);

    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url);
      if (url.hostname.startsWith("api.") || url.pathname.startsWith("/admin") || url.pathname === "/backup") {
        return await handleAdmin(request, env, url);
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      const wantsJson = url.pathname.startsWith("/api/");
      if (wantsJson) return json({ ok: false, error: error.message || "Server error" }, request, 500);
      return html(page("LlamaSales Backend", `<section class="card error">${escapeHtml(error.message || "Server error")}</section>`), request, 500);
    }
  }
};

async function handleApi(request, env, url) {
  const db = requireDb(env);

  if (request.method === "GET" && url.pathname === "/api/status") {
    const users = await count(db, "users");
    const sales = await count(db, "sales");
    const commissionRates = await count(db, "commission_rates");
    return json({ ok: true, serverTime: new Date().toISOString(), users, sales, commissionRates }, request);
  }

  if (request.method === "GET" && url.pathname === "/api/meta") {
    return json(await publicMeta(db), request);
  }

  if (request.method === "POST" && url.pathname === "/api/register") {
    const body = await request.json();
    const username = clean(body.username);
    const email = clean(body.email);
    const region = canonicalRegion(body.region);
    const store = clean(body.store);
    const passwordHash = clean(body.passwordHash).toLowerCase();
    const validation = validateUser(username, email, region, store, passwordHash);
    if (validation) return json({ ok: false, error: validation }, request, 400);

    const existing = await db.prepare("SELECT username FROM users WHERE lower(username)=lower(?)").bind(username).first();
    if (existing) return json({ ok: false, error: "That username is already taken" }, request, 409);

    await db.prepare("INSERT INTO users (username,password_hash,email,region,store,created_at) VALUES (?,?,?,?,?,?)")
      .bind(username, passwordHash, email, region, store, Date.now()).run();
    const user = await getUser(db, username);
    return json(await clientPayload(db, user), request);
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    const body = await request.json();
    const user = await authenticatedUser(db, body);
    if (!user) return json({ ok: false, error: "Username or password is incorrect" }, request, 401);
    return json(await clientPayload(db, user), request);
  }

  if (request.method === "POST" && url.pathname === "/api/sync") {
    const body = await request.json();
    const user = await authenticatedUser(db, body);
    if (!user) return json({ ok: false, error: "Not authenticated" }, request, 401);

    if (Array.isArray(body.deletedSaleIds)) {
      for (const id of body.deletedSaleIds.map(clean).filter(Boolean)) {
        await db.prepare("DELETE FROM sales WHERE id=? AND lower(username)=lower(?)").bind(id, user.username).run();
      }
    }

    if (Array.isArray(body.sales)) {
      for (const rawSale of body.sales) {
        const sale = normalizeSale(rawSale, user);
        if (!sale.id || sale.username.toLowerCase() !== user.username.toLowerCase()) continue;
        await upsertSale(db, sale);
      }
    }
    return json(await clientPayload(db, user), request);
  }

  if (request.method === "POST" && url.pathname === "/api/rates/save") {
    const body = await request.json();
    const user = await authenticatedUser(db, body);
    if (!user) return json({ ok: false, error: "Not authenticated" }, request, 401);
    const itemType = clean(body.itemType || "tv") === "soundbar" ? "soundbar" : "tv";
    const model = clean(body.model);
    const size = itemType === "soundbar" ? "" : clean(body.size);
    const value = Number(body.value || 0);
    if (!model || (itemType === "tv" && !size)) return json({ ok: false, error: "Model and size are required" }, request, 400);
    await saveModel(db, itemType, model);
    if (size) await saveSize(db, size);
    await db.prepare("INSERT INTO commission_rates (item_type,model,size,value) VALUES (?,?,?,?) ON CONFLICT(item_type,model,size) DO UPDATE SET value=excluded.value")
      .bind(itemType, model, size, value).run();
    return json(await clientPayload(db, user), request);
  }

  return json({ ok: false, error: "Not found" }, request, 404);
}

async function handleAdmin(request, env, url) {
  const db = requireDb(env);
  await ensureDefaults(db);

  if (request.method === "POST" && url.pathname === "/admin/setup") {
    const form = await request.formData();
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (await adminPasswordHash(db)) return redirect("/admin");
    if (password.length < 8 || password !== confirm) return html(adminSetup("Use at least 8 characters and make sure both passwords match."), request, 400);
    await setSetting(db, "admin_password_hash", await sha256(password));
    const token = randomToken();
    await setSetting(db, "admin_session_token", token);
    return redirect("/admin", adminCookie(token));
  }

  if (request.method === "POST" && url.pathname === "/admin/login") {
    const form = await request.formData();
    const password = String(form.get("password") || "");
    const hash = await adminPasswordHash(db);
    if (!hash || hash !== await sha256(password)) return html(adminLogin("Password is incorrect."), request, 401);
    const token = randomToken();
    await setSetting(db, "admin_session_token", token);
    return redirect("/admin", adminCookie(token));
  }

  if (request.method === "POST" && url.pathname === "/admin/logout") {
    await setSetting(db, "admin_session_token", "");
    return redirect("/admin", adminCookie(""));
  }

  if (!(await adminPasswordHash(db))) return html(adminSetup(), request);
  if (!(await isAdmin(request, db))) return html(adminLogin(), request);

  if (request.method === "POST" && url.pathname === "/admin/users/save") {
    await adminSaveUser(request, db);
    return redirect("/admin");
  }
  if (request.method === "POST" && url.pathname === "/admin/users/delete") {
    const form = await request.formData();
    await db.prepare("DELETE FROM users WHERE username=?").bind(clean(form.get("username"))).run();
    return redirect("/admin");
  }
  if (request.method === "POST" && url.pathname === "/admin/catalog/model/save") {
    const form = await request.formData();
    await saveModel(db, clean(form.get("itemType")) === "soundbar" ? "soundbar" : "tv", clean(form.get("model")));
    return redirect("/admin");
  }
  if (request.method === "POST" && url.pathname === "/admin/catalog/size/save") {
    const form = await request.formData();
    await saveSize(db, clean(form.get("size")));
    return redirect("/admin");
  }
  if (request.method === "POST" && url.pathname === "/admin/rates/save") {
    const form = await request.formData();
    const itemType = clean(form.get("itemType")) === "soundbar" ? "soundbar" : "tv";
    const model = clean(form.get("model"));
    const size = itemType === "soundbar" ? "" : clean(form.get("size"));
    const valueText = clean(form.get("value"));
    if (model && (itemType === "soundbar" || size)) {
      if (!valueText) {
        await db.prepare("DELETE FROM commission_rates WHERE item_type=? AND model=? AND size=?").bind(itemType, model, size).run();
      } else {
        await db.prepare("INSERT INTO commission_rates (item_type,model,size,value) VALUES (?,?,?,?) ON CONFLICT(item_type,model,size) DO UPDATE SET value=excluded.value")
          .bind(itemType, model, size, Number(valueText || 0)).run();
      }
    }
    return redirect("/admin");
  }
  if (request.method === "GET" && url.pathname === "/backup") {
    const backup = await buildBackup(db);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="llamasales-cloudflare-backup-${new Date().toISOString().slice(0, 10)}.json"`
      }
    });
  }

  return html(await adminHome(db), request);
}

async function adminSaveUser(request, db) {
  const form = await request.formData();
  const username = clean(form.get("username"));
  const email = clean(form.get("email"));
  const region = canonicalRegion(form.get("region"));
  const store = clean(form.get("store"));
  const password = String(form.get("password") || "");
  if (!username || !email || !region || !store) return;
  const existing = await getUser(db, username);
  const passwordHash = password ? await sha256(password) : existing?.password_hash;
  if (!passwordHash) return;
  await db.prepare("INSERT INTO users (username,password_hash,email,region,store,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET email=excluded.email, region=excluded.region, store=excluded.store, password_hash=excluded.password_hash")
    .bind(username, passwordHash, email, region, store, existing?.created_at || Date.now()).run();
}

async function adminHome(db) {
  const users = await all(db, "SELECT * FROM users ORDER BY username");
  const sales = await all(db, "SELECT * FROM sales ORDER BY date DESC, created_at DESC LIMIT 100");
  const tvModels = await modelList(db, "tv");
  const soundbarModels = await modelList(db, "soundbar");
  const sizes = await sizeList(db);
  const rates = await ratesMap(db);
  const totals = await db.prepare("SELECT COUNT(*) totalUnits, SUM(CASE WHEN brand='Hisense' AND item_type='tv' THEN 1 ELSE 0 END) hisenseUnits, SUM(price) totalRevenue, SUM(CASE WHEN brand='Hisense' AND item_type='tv' THEN price ELSE 0 END) hisenseRevenue FROM sales").first();
  const totalRevenue = Number(totals?.totalRevenue || 0);
  const hisenseRevenue = Number(totals?.hisenseRevenue || 0);
  const share = totalRevenue <= 0 ? 0 : Math.round(hisenseRevenue * 100 / totalRevenue);

  return page("LlamaSales Backend", `
    <div class="actions">
      <div style="flex:1 1 auto"><h1>LlamaSales Backend</h1><div class="muted">Cloudflare Worker + D1 backend.</div></div>
      <a class="buttonLink" href="/backup">Download Backup</a>
      <form method="post" action="/admin/logout"><button class="danger">Sign Out</button></form>
    </div>
    <div class="grid">
      ${kpi("Total Units", totals?.totalUnits || 0, "uploaded sales")}
      ${kpi("Hisense TV Units", totals?.hisenseUnits || 0, "uploaded Hisense TVs")}
      ${kpi("Hisense SOV", `${share}%`, "share of TV value")}
      ${kpi("Sales Value", money(totalRevenue), "all brands")}
    </div>
    <section class="card">
      <h2>Manage Users</h2>
      <form method="post" action="/admin/users/save" class="row">
        <div><label>Username</label><input name="username" required></div>
        <div><label>Email</label><input name="email" type="email" required></div>
        <div><label>Region</label><select name="region" required><option value="">Choose region</option>${options(REGIONS, "")}</select></div>
        <div><label>Store</label><input name="store" required></div>
        <div><label>Password</label><input name="password" type="password" placeholder="required for new"><button>Create User</button></div>
      </form>
      ${users.map((user) => `
        <div class="userEdit">
          <form method="post" action="/admin/users/save" class="userEditForm">
            <div><label>Username</label><input name="username" value="${attr(user.username)}" readonly></div>
            <div><label>Email</label><input name="email" type="email" value="${attr(user.email)}" required></div>
            <div><label>Region</label><select name="region" required>${options(REGIONS, user.region)}</select></div>
            <div><label>Store</label><input name="store" value="${attr(user.store)}" required></div>
            <div><label>Password</label><input name="password" type="password" placeholder="blank keeps existing"></div>
            <button>Save</button>
          </form>
          <form method="post" action="/admin/users/delete"><input type="hidden" name="username" value="${attr(user.username)}"><button class="danger">Delete</button></form>
        </div>
      `).join("")}
    </section>
    ${matrixSection("TV Commission Matrix", "tv", tvModels, sizes, rates)}
    ${soundbarSection(soundbarModels, rates)}
    <section class="card">
      <h2>Uploaded Sales</h2>
      <table class="table"><tr><th>Date</th><th>User</th><th>Region</th><th>Store</th><th>Brand</th><th>Type</th><th>Model</th><th>Size</th><th>Value</th></tr>
        ${sales.map((sale) => `<tr><td>${escapeHtml(sale.date)}</td><td>${escapeHtml(sale.username)}</td><td>${escapeHtml(sale.region)}</td><td>${escapeHtml(sale.store)}</td><td>${escapeHtml(sale.brand)}</td><td>${escapeHtml(sale.item_type)}</td><td>${escapeHtml(sale.model)}</td><td>${escapeHtml(sale.size)}</td><td>${money(sale.price)}</td></tr>`).join("")}
      </table>
    </section>
  `);
}

function matrixSection(title, itemType, models, sizes, rates) {
  return `
    <section class="card">
      <h2>${escapeHtml(title)}</h2>
      <p class="muted">Models run down rows and sizes run across columns. Save a blank cell to clear it.</p>
      <div class="matrixTools">
        <form method="post" action="/admin/catalog/model/save"><input type="hidden" name="itemType" value="${itemType}"><label>Add TV Model</label><div class="inlineForm"><input name="model" placeholder="Model name"><button>Add</button></div></form>
        <form method="post" action="/admin/catalog/size/save"><label>Add Size</label><div class="inlineForm"><input name="size" placeholder="Screen size"><button>Add</button></div></form>
      </div>
      <div class="matrixWrap"><table class="matrix"><thead><tr><th>Model</th>${sizes.map((size) => `<th>${escapeHtml(size)}"</th>`).join("")}</tr></thead><tbody>
        ${models.map((model) => `<tr><th scope="row">${escapeHtml(model)}</th>${sizes.map((size) => rateCell(itemType, model, size, rates)).join("")}</tr>`).join("")}
      </tbody></table></div>
    </section>
  `;
}

function soundbarSection(models, rates) {
  return `
    <section class="card">
      <h2>Soundbar Commission</h2>
      <div class="matrixTools">
        <form method="post" action="/admin/catalog/model/save"><input type="hidden" name="itemType" value="soundbar"><label>Add Soundbar Model</label><div class="inlineForm"><input name="model" placeholder="Soundbar model"><button>Add</button></div></form>
      </div>
      <div class="matrixWrap"><table class="matrix"><thead><tr><th>Model</th><th>Commission</th></tr></thead><tbody>
        ${models.map((model) => `<tr><th scope="row">${escapeHtml(model)}</th>${rateCell("soundbar", model, "", rates)}</tr>`).join("")}
      </tbody></table></div>
    </section>
  `;
}

function rateCell(itemType, model, size, rates) {
  const key = rateKey(itemType, model, size);
  const value = rates[key] ?? "";
  return `<td><form method="post" action="/admin/rates/save" class="matrixCell"><input type="hidden" name="itemType" value="${attr(itemType)}"><input type="hidden" name="model" value="${attr(model)}"><input type="hidden" name="size" value="${attr(size)}"><input class="matrixInput" name="value" type="number" step="0.01" value="${attr(value)}" placeholder="-"><button>Save</button></form></td>`;
}

function adminSetup(error = "") {
  return page("Set Up LlamaSales Backend", `<section class="auth card"><h1>LlamaSales Backend</h1><p class="muted">Create the admin password for the Cloudflare backend.</p>${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}<form method="post" action="/admin/setup"><label>Admin password</label><input name="password" type="password" required autofocus><label>Confirm password</label><input name="confirm" type="password" required><button>Create Admin Login</button></form></section>`);
}

function adminLogin(error = "") {
  return page("LlamaSales Backend Login", `<section class="auth card"><h1>LlamaSales Backend</h1><p class="muted">Admin sign-in is required.</p>${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}<form method="post" action="/admin/login"><label>Admin password</label><input name="password" type="password" required autofocus><button>Sign In</button></form></section>`);
}

function page(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${adminCss()}</style></head><body><main>${body}</main></body></html>`;
}

function adminCss() {
  return "body{margin:0;background:#05030a;color:#f8fafc;font-family:Segoe UI,Arial,sans-serif}main{max-width:1180px;margin:0 auto;padding:28px 18px 60px}h1{margin:0 0 4px;font-size:34px}h2{margin:0 0 14px;font-size:20px}.muted{color:#9dabc0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.card{background:rgba(24,27,34,.82);border:1px solid rgba(114,126,166,.65);border-radius:14px;padding:16px;margin:14px 0}.auth{max-width:430px;margin:54px auto}.kpi{font-size:32px;font-weight:800;color:#00aaa6}label{display:block;font-size:12px;color:#9dabc0;margin:10px 0 4px}input,select{box-sizing:border-box;width:100%;height:38px;border-radius:10px;border:1px solid rgba(120,136,166,.7);background:#0b0d11;color:#fff;padding:0 10px}button,.buttonLink{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border:0;border-radius:10px;background:#00aaa6;color:#fff;font-weight:700;padding:0 14px;cursor:pointer;text-decoration:none}.danger{background:#b21c2d}.row{display:grid;grid-template-columns:1.2fr 1.4fr 1fr 1fr auto;gap:8px;align-items:end}.userEdit{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end;border-top:1px solid rgba(120,136,166,.25);padding:10px 0}.userEditForm{display:grid;grid-template-columns:1.1fr 1.5fr 1fr 1fr 1fr auto;gap:8px;align-items:end}.table{width:100%;border-collapse:collapse}.table th,.table td{border-bottom:1px solid rgba(120,136,166,.35);padding:8px;text-align:left;font-size:13px}.pill{display:inline-block;border:1px solid rgba(0,170,166,.6);border-radius:999px;padding:4px 8px;color:#00aaa6;font-size:12px}.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.error{color:#ff8b8b;font-weight:700}.notice{color:#7df2c7;font-weight:700}.matrixTools{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:10px;margin:10px 0 14px}.inlineForm{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.matrixWrap{overflow:auto;border:1px solid rgba(120,136,166,.35);border-radius:12px}.matrix{width:100%;border-collapse:separate;border-spacing:0;min-width:760px}.matrix th,.matrix td{border-bottom:1px solid rgba(120,136,166,.28);border-right:1px solid rgba(120,136,166,.2);padding:7px;text-align:left;font-size:12px}.matrix th{position:sticky;top:0;background:#10131a;z-index:1;color:#dbeafe}.matrix th:first-child{left:0;z-index:2}.matrix tbody th{top:auto;left:0;background:#10131a}.matrixCell{display:grid;grid-template-columns:minmax(74px,1fr) auto;gap:6px;align-items:center}.matrixInput{height:32px;padding:0 8px}.matrixCell button{min-height:32px;padding:0 9px;font-size:12px}@media(max-width:980px){.userEdit,.userEditForm{grid-template-columns:1fr}.matrixTools{grid-template-columns:1fr}}@media(max-width:760px){.row{grid-template-columns:1fr}.table{display:block;overflow:auto}}";
}

async function clientPayload(db, user) {
  return {
    ok: true,
    serverTime: new Date().toISOString(),
    account: userToClient(user),
    sales: (await all(db, "SELECT * FROM sales ORDER BY created_at DESC")).map(saleToClient),
    commissionRates: await ratesClientMap(db),
    meta: await publicMeta(db)
  };
}

async function publicMeta(db) {
  await ensureDefaults(db);
  const users = await all(db, "SELECT region, store FROM users");
  const storesByRegion = Object.fromEntries(REGIONS.map((region) => [region, []]));
  for (const user of users) {
    const region = canonicalRegion(user.region);
    const store = clean(user.store);
    if (!region || !store) continue;
    if (!storesByRegion[region]) storesByRegion[region] = [];
    if (!storesByRegion[region].some((item) => item.toLowerCase() === store.toLowerCase())) storesByRegion[region].push(store);
  }
  Object.values(storesByRegion).forEach((stores) => stores.sort((a, b) => a.localeCompare(b)));
  return {
    ok: true,
    regions: REGIONS,
    storesByRegion,
    models: await modelList(db, "tv"),
    soundbarModels: await modelList(db, "soundbar"),
    sizes: await sizeList(db)
  };
}

async function ensureDefaults(db) {
  for (const [index, model] of TV_MODELS.entries()) await db.prepare("INSERT OR IGNORE INTO product_models (item_type,model,sort_order) VALUES ('tv',?,?)").bind(model, (index + 1) * 10).run();
  for (const [index, model] of SOUNDBAR_MODELS.entries()) await db.prepare("INSERT OR IGNORE INTO product_models (item_type,model,sort_order) VALUES ('soundbar',?,?)").bind(model, (index + 1) * 10).run();
  for (const [index, size] of SIZES.entries()) await db.prepare("INSERT OR IGNORE INTO product_sizes (size,sort_order) VALUES (?,?)").bind(size, (index + 1) * 10).run();
}

async function authenticatedUser(db, body) {
  const username = clean(body.username);
  const passwordHash = clean(body.passwordHash);
  if (!username || !passwordHash) return null;
  const user = await getUser(db, username);
  return user && user.password_hash === passwordHash ? user : null;
}

async function getUser(db, username) {
  return db.prepare("SELECT * FROM users WHERE lower(username)=lower(?)").bind(username).first();
}

async function upsertSale(db, sale) {
  await db.prepare("INSERT INTO sales (id,date,brand,item_type,model,size,price,username,region,store,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date, brand=excluded.brand, item_type=excluded.item_type, model=excluded.model, size=excluded.size, price=excluded.price, username=excluded.username, region=excluded.region, store=excluded.store, created_at=excluded.created_at")
    .bind(sale.id, sale.date, sale.brand, sale.itemType, sale.model, sale.size, sale.price, sale.username, sale.region, sale.store, sale.createdAt).run();
}

function normalizeSale(raw, user) {
  const brand = clean(raw?.brand);
  const itemType = brand === "Hisense" && clean(raw?.itemType) === "soundbar" ? "soundbar" : "tv";
  return {
    id: clean(raw?.id),
    date: clean(raw?.date) || new Date().toISOString().slice(0, 10),
    brand,
    itemType,
    model: brand === "Hisense" ? clean(raw?.model) : "",
    size: brand === "Hisense" && itemType === "tv" ? clean(raw?.size) : "",
    price: Number(raw?.price || 0),
    username: clean(raw?.username || user.username),
    region: user.region,
    store: user.store,
    createdAt: Number(raw?.createdAt || Date.now())
  };
}

async function ratesClientMap(db) {
  const rows = await all(db, "SELECT * FROM commission_rates");
  const map = {};
  for (const row of rows) map[rateKey(row.item_type, row.model, row.size)] = Number(row.value || 0);
  return map;
}

async function ratesMap(db) {
  return ratesClientMap(db);
}

function rateKey(itemType, model, size) {
  return itemType === "soundbar" ? `soundbar|${model}|` : `${model}|${size}`;
}

async function modelList(db, itemType) {
  return (await all(db, "SELECT model FROM product_models WHERE item_type=? ORDER BY sort_order, model", itemType)).map((row) => row.model);
}

async function sizeList(db) {
  return (await all(db, "SELECT size FROM product_sizes ORDER BY sort_order, size")).map((row) => row.size);
}

async function saveModel(db, itemType, model) {
  if (!model) return;
  const max = await db.prepare("SELECT COALESCE(MAX(sort_order),0) maxSort FROM product_models WHERE item_type=?").bind(itemType).first();
  await db.prepare("INSERT OR IGNORE INTO product_models (item_type,model,sort_order) VALUES (?,?,?)").bind(itemType, model, Number(max?.maxSort || 0) + 10).run();
}

async function saveSize(db, size) {
  if (!size) return;
  const max = await db.prepare("SELECT COALESCE(MAX(sort_order),0) maxSort FROM product_sizes").first();
  await db.prepare("INSERT OR IGNORE INTO product_sizes (size,sort_order) VALUES (?,?)").bind(size, Number(max?.maxSort || 0) + 10).run();
}

async function buildBackup(db) {
  return {
    settings: await all(db, "SELECT * FROM settings"),
    users: await all(db, "SELECT * FROM users"),
    sales: await all(db, "SELECT * FROM sales"),
    commissionRates: await all(db, "SELECT * FROM commission_rates"),
    productModels: await all(db, "SELECT * FROM product_models"),
    productSizes: await all(db, "SELECT * FROM product_sizes")
  };
}

async function adminPasswordHash(db) {
  return getSetting(db, "admin_password_hash");
}

async function isAdmin(request, db) {
  const cookie = cookieValue(request, ADMIN_COOKIE);
  const token = await getSetting(db, "admin_session_token");
  return Boolean(cookie && token && cookie === token);
}

async function getSetting(db, key) {
  const row = await db.prepare("SELECT value FROM settings WHERE key=?").bind(key).first();
  return row?.value || "";
}

async function setSetting(db, key, value) {
  await db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key, value).run();
}

async function count(db, table) {
  const row = await db.prepare(`SELECT COUNT(*) value FROM ${table}`).first();
  return Number(row?.value || 0);
}

async function all(db, sql, ...bindings) {
  const result = await db.prepare(sql).bind(...bindings).all();
  return result.results || [];
}

function requireDb(env) {
  if (!env.DB) throw new Error("D1 database binding DB is not configured.");
  return env.DB;
}

function validateUser(username, email, region, store, passwordHash) {
  if (username.length < 3) return "Username must be at least 3 characters";
  if (/\s/.test(username)) return "Username cannot contain spaces";
  if (!email.includes("@") || !email.includes(".")) return "Enter a valid email address";
  if (!REGIONS.includes(region)) return "Choose a valid region";
  if (!store) return "Choose or add a store name";
  if (!/^[a-f0-9]{64}$/i.test(passwordHash)) return "Password could not be securely saved";
  return "";
}

function userToClient(user) {
  return { username: user.username, passwordHash: user.password_hash, email: user.email, region: user.region, store: user.store };
}

function saleToClient(row) {
  return {
    id: row.id,
    date: row.date,
    brand: row.brand,
    itemType: row.item_type,
    model: row.model,
    size: row.size,
    price: Number(row.price || 0),
    soundbarUnits: row.item_type === "soundbar" ? 1 : 0,
    soundbarRevenue: row.item_type === "soundbar" ? Number(row.price || 0) : 0,
    username: row.username,
    region: row.region,
    store: row.store,
    createdAt: Number(row.created_at || 0)
  };
}

function kpi(title, value, subtitle) {
  return `<div class="card"><div class="muted">${escapeHtml(title)}</div><div class="kpi">${escapeHtml(value)}</div><div class="muted">${escapeHtml(subtitle)}</div></div>`;
}

function options(values, selected) {
  return values.map((value) => `<option${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function money(value) {
  return `GBP ${Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function canonicalRegion(region) {
  const cleanValue = clean(region);
  return REGIONS.find((item) => item.toLowerCase() === cleanValue.toLowerCase()) || cleanValue;
}

function clean(value) {
  return String(value ?? "").trim();
}

function attr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
}

async function sha256(value) {
  const data = new TextEncoder().encode(value || "");
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function adminCookie(value) {
  if (!value) return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`;
}

function redirect(location, cookie = "") {
  const headers = { location };
  if (cookie) headers["set-cookie"] = cookie;
  return new Response("Redirecting", { status: 303, headers });
}

function html(body, request, status = 200) {
  return corsResponse(body, request, status, "text/html; charset=utf-8");
}

function json(payload, request, status = 200) {
  return corsResponse(JSON.stringify(payload), request, status, "application/json; charset=utf-8");
}

function corsResponse(body, request, status = 200, contentType = "text/plain") {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type");
  if (contentType) headers.set("content-type", contentType);
  return new Response(body, { status, headers });
}
