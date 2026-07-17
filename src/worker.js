const REGIONS = [
  "Birmingham", "Central London", "East Midlands", "Head Office", "Leeds and Yorkshire",
  "Liverpool", "Manchester", "North East", "North London", "Scotland", "Shires",
  "South Coast", "Wales and Bristol"
];

const TV_MODELS = ["A4Q", "A5Q", "A6Q", "A7Q", "E7Q", "E7Q Pro", "U7Q", "U7Q Pro", "U8Q", "U7S", "U7S Pro", "UR8S", "UR9S", "C2", "C2 Ultra", "Other"];
const SOUNDBAR_MODELS = ["AX3100Q", "AX5100Q", "AX5125H", "AX5125Q", "AX7100Q", "AX8100Q", "Other"];
const SIZES = ["32", "40", "43", "50", "55", "65", "75", "85", "100", "Other"];
const ACCOUNT_CREATION_SECRET = "C2ULTRA!";
const PRIMARY_ACCOUNT_USERNAME = "03h043";
const PRODUCT_TYPES = ["UHD", "QLED", "MINI LED", "RGB", "LASER"];
const DEFAULT_MODEL_CATEGORIES = {
  A4Q: "UHD",
  A5Q: "UHD",
  A6Q: "UHD",
  A7Q: "QLED",
  E7Q: "QLED",
  "E7Q Pro": "QLED",
  U7Q: "MINI LED",
  "U7Q Pro": "MINI LED",
  U8Q: "MINI LED",
  U7S: "MINI LED",
  "U7S Pro": "MINI LED",
  UR8S: "RGB",
  UR9S: "RGB",
  C2: "LASER",
  "C2 Ultra": "LASER"
};
const DEFAULT_SKUS = {
  A6Q: { 43: "643644", 50: "676172", 55: "693866", 65: "739467", 75: "694145", 85: "568128", 100: "695150" },
  E7Q: { 43: "643519", 50: "749522", 55: "693686", 65: "739304", 75: "519328", 85: "526657", 100: "^ 58\"" },
  "E7Q Pro": { 43: "630177", 50: "594655", 55: "680825", 65: "725644", 75: "631417", 85: "628973", 100: "577046" },
  U7Q: { 50: "665262", 55: "667972", 65: "715928", 75: "856306", 85: "677759", 100: "793145" },
  "U7Q Pro": { 55: "666670", 65: "715214", 75: "855179", 85: "859981", 100: "517009" },
  U8Q: { 55: "665955", 65: "702459", 75: "850340", 85: "579848", 100: "855845" },
  PX3: { 150: "603437" },
  C2: { 300: "626823" },
  "C2 Ultra": { 300: "617952" }
};
const DEFAULT_RESET_PASSWORD = "C2ULTRA";
const ADMIN_COOKIE = "llamasales_admin";
const ALLOWED_ORIGINS = new Set([
  "https://app.tiredllama.co.uk",
  "https://tiredllama.co.uk",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
]);
const WEBAPP_SUSPENDED = true;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (WEBAPP_SUSPENDED) {
      if (url.pathname === "/sw.js" && (request.method === "GET" || request.method === "HEAD")) {
        return env.ASSETS.fetch(request);
      }
      return suspendedResponse(request);
    }

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

function suspendedResponse(request) {
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>LLAMA unavailable</title>
  <style>
    :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05030a;color:#f8fafc;font-family:Segoe UI,Arial,sans-serif;padding:24px}.notice{width:min(520px,100%);border:1px solid rgba(0,170,166,.72);background:#11141a;padding:28px;text-align:center}.brand{margin:0 0 12px;color:#00aaa6;font-size:38px;font-weight:900}.message{margin:0;color:#b3bfd2;font-size:18px;line-height:1.5}
  </style>
</head>
<body>
  <main class="notice">
    <h1 class="brand">LLAMA</h1>
    <p class="message">This service is currently unavailable.</p>
  </main>
</body>
</html>`;
  return new Response(request.method === "HEAD" ? null : body, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Set-Cookie": `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    }
  });
}

async function handleApi(request, env, url) {
  const db = requireDb(env);
  await ensureSchema(db);
  await assignUnlocatedSalesToPrimaryAccount(db);

  if (request.method === "GET" && url.pathname === "/api/status") {
    const users = await count(db, "users");
    const sales = await count(db, "sales");
    const commissionRates = await count(db, "commission_rates");
    const barcodes = await count(db, "barcodes");
    return json({ ok: true, serverTime: new Date().toISOString(), users, sales, commissionRates, barcodes }, request);
  }

  if (request.method === "GET" && url.pathname === "/api/meta") {
    return json(await publicMeta(db), request);
  }

  if (request.method === "POST" && url.pathname === "/api/repair/primary-sales") {
    const body = await request.json();
    if (String(body.repairSecret || "") !== ACCOUNT_CREATION_SECRET) {
      return json({ ok: false, error: "Repair secret is incorrect" }, request, 403);
    }
    const repair = await forceAssignCurrentSalesToPrimaryAccount(db);
    return json({ ok: true, ...repair }, request);
  }

  if (request.method === "POST" && url.pathname === "/api/register") {
    const body = await request.json();
    const username = clean(body.username);
    const email = clean(body.email);
    const region = canonicalRegion(body.region);
    const store = clean(body.store);
    const passwordHash = clean(body.passwordHash).toLowerCase();
    if (String(body.signupSecret || "") !== ACCOUNT_CREATION_SECRET) {
      return json({ ok: false, error: "Account creation secret is incorrect" }, request, 403);
    }
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
        if (!sale) continue;
        if (!sale.id || sale.username.toLowerCase() !== user.username.toLowerCase()) continue;
        await upsertSale(db, sale);
      }
    }
    if (Array.isArray(body.barcodes)) {
      for (const rawBarcode of body.barcodes) {
        const barcode = normalizeBarcodePayload(rawBarcode, user);
        if (barcode) await saveBarcode(db, barcode);
      }
    }
    await purgeExpiredBarcodes(db);
    return json(await clientPayload(db, user), request);
  }

  if (request.method === "POST" && url.pathname === "/api/barcodes/save") {
    const body = await request.json();
    const user = await authenticatedUser(db, body) || { username: clean(body.createdBy || body.created_by || "unknown") || "unknown" };
    const barcode = normalizeBarcodePayload(body, user);
    if (!barcode) return json({ ok: false, error: "Description, valid dates, 15 digit code, and model/size combos are required" }, request, 400);
    await saveBarcode(db, barcode);
    await purgeExpiredBarcodes(db);
    return json(await publicMeta(db), request);
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
    await saveCommissionRate(db, itemType, model, size, value, todayIso(), false, "current");
    return json(await clientPayload(db, user), request);
  }

  return json({ ok: false, error: "Not found" }, request, 404);
}

async function handleAdmin(request, env, url) {
  const db = requireDb(env);
  await ensureSchema(db);
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
  await assignUnlocatedSalesToPrimaryAccount(db);

  if (request.method === "POST" && url.pathname === "/admin/users/save") {
    await adminSaveUser(request, db);
    return redirect("/admin");
  }
  if (request.method === "POST" && url.pathname === "/admin/users/reset-password") {
    await adminResetUserPassword(request, db);
    return redirect("/admin");
  }
  if (request.method === "POST" && url.pathname === "/admin/users/repair") {
    await adminRepairUserFromSales(request, db);
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
  if (request.method === "POST" && url.pathname === "/admin/catalog/model/delete") {
    const form = await request.formData();
    await deleteModel(db, clean(form.get("itemType")) === "soundbar" ? "soundbar" : "tv", clean(form.get("model")));
    return redirect("/admin");
  }
  if (request.method === "POST" && url.pathname === "/admin/catalog/size/save") {
    const form = await request.formData();
    await saveSize(db, clean(form.get("size")));
    return redirect("/admin");
  }
  if (request.method === "GET" && url.pathname === "/admin/rates/dated") {
    const itemType = clean(url.searchParams.get("itemType")) === "soundbar" ? "soundbar" : "tv";
    return html(await datedRatesPage(db, itemType, url.searchParams.get("saved") === "1"), request);
  }
  if (request.method === "POST" && url.pathname === "/admin/rates/batch-save") {
    await adminBatchSaveRates(request, db, false);
    return redirect("/admin");
  }
  if (request.method === "POST" && url.pathname === "/admin/rates/dated-save") {
    const itemType = await adminBatchSaveRates(request, db, true);
    return redirect(`/admin/rates/dated?itemType=${encodeURIComponent(itemType)}&saved=1`);
  }
  if (request.method === "POST" && url.pathname === "/admin/rates/save") {
    const form = await request.formData();
    const itemType = clean(form.get("itemType")) === "soundbar" ? "soundbar" : "tv";
    const model = clean(form.get("model"));
    const size = itemType === "soundbar" ? "" : clean(form.get("size"));
    const valueText = clean(form.get("value"));
    if (model && (itemType === "soundbar" || size)) {
      if (!valueText) {
        await saveCommissionRate(db, itemType, model, size, 0, todayIso(), true, "current");
      } else {
        await saveCommissionRate(db, itemType, model, size, Number(valueText || 0), todayIso(), false, "current");
      }
    }
    return redirect("/admin");
  }
  if (request.method === "POST" && url.pathname === "/admin/skus/batch-save") {
    await adminBatchSaveSkus(request, db);
    return redirect("/admin#sku-matrix");
  }
  if (request.method === "POST" && url.pathname === "/admin/import/legacy") {
    await adminImportLegacyBackup(request, db);
    return redirect("/admin?imported=1");
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

  return html(await adminHome(db, url.searchParams.get("imported") === "1"), request);
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

async function adminResetUserPassword(request, db) {
  const form = await request.formData();
  const username = clean(form.get("username"));
  if (!username) return;
  await db.prepare("UPDATE users SET password_hash=? WHERE username=?").bind(await sha256(DEFAULT_RESET_PASSWORD), username).run();
}

async function adminRepairUserFromSales(request, db) {
  const form = await request.formData();
  const username = clean(form.get("username"));
  const email = clean(form.get("email"));
  const region = canonicalRegion(form.get("region"));
  const store = clean(form.get("store"));
  if (!username || !email || !region || !store) return;
  await db.prepare("INSERT INTO users (username,password_hash,email,region,store,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET email=excluded.email, region=excluded.region, store=excluded.store")
    .bind(username, await sha256(DEFAULT_RESET_PASSWORD), email, region, store, Date.now()).run();
}

async function adminImportLegacyBackup(request, db) {
  const form = await request.formData();
  const backupText = String(form.get("backupJson") || "").trim();
  if (!backupText) return;

  let backup = null;
  try {
    backup = JSON.parse(backupText);
  } catch {
    return;
  }

  const users = Array.isArray(backup.Users) ? backup.Users : Array.isArray(backup.users) ? backup.users : [];
  for (const rawUser of users) {
    if (!rawUser || typeof rawUser !== "object") continue;
    const username = clean(rawUser.Username || rawUser.username);
    const passwordHash = clean(rawUser.PasswordHash || rawUser.passwordHash || rawUser.password_hash).toLowerCase();
    const email = clean(rawUser.Email || rawUser.email);
    const region = canonicalRegion(rawUser.Region || rawUser.region);
    const store = clean(rawUser.Store || rawUser.store);
    if (!username || !passwordHash || !email || !region || !store) continue;
    await db.prepare("INSERT INTO users (username,password_hash,email,region,store,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, email=excluded.email, region=excluded.region, store=excluded.store")
      .bind(username, passwordHash, email, region, store, Number(rawUser.CreatedAt || rawUser.createdAt || Date.now())).run();
  }

  const sales = Array.isArray(backup.Sales) ? backup.Sales : Array.isArray(backup.sales) ? backup.sales : [];
  for (const rawSale of sales) {
    if (!rawSale || typeof rawSale !== "object") continue;
    const sale = legacySaleToDb(rawSale);
    if (!sale) continue;
    await upsertSale(db, sale);
  }

  const commissionRates = backup.CommissionRates && typeof backup.CommissionRates === "object" ? backup.CommissionRates : backup.commissionRates;
  if (commissionRates && typeof commissionRates === "object") {
    for (const [key, value] of Object.entries(commissionRates)) {
      const [model, size] = String(key).split("|");
      const cleanModel = clean(model);
      const cleanSize = clean(size);
      if (!cleanModel || !cleanSize) continue;
      await saveCommissionRate(db, "tv", cleanModel, cleanSize, Number(value || 0), "1970-01-01", false, "legacy-import");
    }
  }
}

async function adminBatchSaveRates(request, db, datedOnly) {
  const form = await request.formData();
  const itemType = clean(form.get("itemType")) === "soundbar" ? "soundbar" : "tv";
  const effectiveFrom = datedOnly ? validDateOrToday(form.get("effectiveFrom")) : todayIso();
  const combos = form.getAll("combo");
  const values = form.getAll("value");
  const currentRates = datedOnly ? {} : await ratesMap(db);

  if (!datedOnly && itemType === "tv") {
    await saveModelCategoriesFromForm(db, form);
  }

  for (let index = 0; index < combos.length; index += 1) {
    const combo = parseCombo(combos[index]);
    if (!combo || combo.itemType !== itemType) continue;
    const model = clean(combo.model);
    const size = itemType === "soundbar" ? "" : clean(combo.size);
    if (!model || (itemType === "tv" && !size)) continue;

    const valueText = clean(values[index]);
    const key = rateKey(itemType, model, size);

    if (datedOnly) {
      if (!valueText) continue;
      await saveCommissionRate(db, itemType, model, size, Number(valueText || 0), effectiveFrom, false, "dated");
      continue;
    }

    const hasCurrentValue = Object.prototype.hasOwnProperty.call(currentRates, key);
    if (!valueText) {
      if (hasCurrentValue) await saveCommissionRate(db, itemType, model, size, 0, effectiveFrom, true, "current");
      continue;
    }

    const nextValue = Number(valueText || 0);
    if (!hasCurrentValue || Number(currentRates[key] || 0) !== nextValue) {
      await saveCommissionRate(db, itemType, model, size, nextValue, effectiveFrom, false, "current");
    }
  }

  return itemType;
}

async function adminBatchSaveSkus(request, db) {
  const form = await request.formData();
  const combos = form.getAll("combo");
  const values = form.getAll("sku");
  for (let index = 0; index < combos.length; index += 1) {
    const combo = parseCombo(combos[index]);
    const model = clean(combo?.model);
    const size = clean(combo?.size);
    const sku = clean(values[index]);
    if (!model || !size) continue;
    if (!sku) {
      await db.prepare("DELETE FROM product_skus WHERE model=? AND size=?").bind(model, size).run();
    } else {
      await saveSku(db, model, size, sku);
    }
  }
}

async function saveModelCategoriesFromForm(db, form) {
  const models = form.getAll("modelCategoryModel");
  const categories = form.getAll("modelCategory");
  for (let index = 0; index < models.length; index += 1) {
    await saveModelCategory(db, clean(models[index]), clean(categories[index]));
  }
}

function parseCombo(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function adminHome(db, imported = false) {
  const users = await all(db, "SELECT * FROM users ORDER BY username");
  const missingUsers = await salesUsersWithoutAccounts(db, users);
  const sales = await all(db, "SELECT * FROM sales WHERE brand='Hisense' ORDER BY date DESC, created_at DESC LIMIT 100");
  const tvModels = await modelList(db, "tv");
  const soundbarModels = await modelList(db, "soundbar");
  const sizes = await sizeList(db);
  const rates = await ratesMap(db);
  const skus = await skuMap(db);
  const skuModels = skuModelList(tvModels);
  const skuSizes = skuSizeList(sizes);
  const modelCategories = await modelCategoryMap(db);
  const totals = await db.prepare(`
    SELECT
      COUNT(*) totalRows,
      SUM(CASE WHEN item_type='tv' AND refund=0 THEN 1 ELSE 0 END) tvUnits,
      SUM(CASE WHEN item_type='soundbar' AND refund=0 THEN 1 ELSE 0 END) soundbarUnits,
      SUM(CASE WHEN item_type='tv' AND refund=0 THEN price ELSE 0 END) tvRevenue,
      SUM(CASE WHEN item_type='soundbar' AND refund=0 THEN price ELSE 0 END) soundbarRevenue
    FROM sales
    WHERE brand='Hisense'
  `).first();
  const tvRevenue = Number(totals?.tvRevenue || 0);
  const soundbarRevenue = Number(totals?.soundbarRevenue || 0);
  const totalRevenue = tvRevenue + soundbarRevenue;

  return page("LlamaSales Backend", `
    <div class="actions">
      <div style="flex:1 1 auto"><h1>LlamaSales Backend</h1><div class="muted">Cloudflare Worker + D1 backend.</div></div>
      <a class="buttonLink" href="/backup">Download Backup</a>
      <form method="post" action="/admin/logout"><button class="danger">Sign Out</button></form>
    </div>
    <div class="grid">
      ${kpi("TV Units", totals?.tvUnits || 0, "uploaded Hisense TVs")}
      ${kpi("Soundbar Units", totals?.soundbarUnits || 0, "uploaded soundbars")}
      ${kpi("TV Value", money(tvRevenue), "Hisense TV value")}
      ${kpi("Total Value", money(totalRevenue), "TV and soundbar value")}
    </div>
    ${imported ? `<p class="notice">Legacy backup import completed. Any valid users, sales, and commission rates in the pasted backup were merged into D1.</p>` : ""}
    ${usersSection(users, missingUsers)}
    ${legacyImportSection()}
    ${matrixSection("TV Commission Matrix", "tv", tvModels, sizes, rates, modelCategories)}
    ${soundbarSection(soundbarModels, rates)}
    <section class="card">
      <h2>Uploaded Sales</h2>
      <table class="table"><tr><th>Date</th><th>User</th><th>Region</th><th>Store</th><th>Brand</th><th>Type</th><th>Model</th><th>Size</th><th>Value</th><th>Refund</th></tr>
        ${sales.map((sale) => `<tr><td>${escapeHtml(sale.date)}</td><td>${escapeHtml(sale.username)}</td><td>${escapeHtml(sale.region)}</td><td>${escapeHtml(sale.store)}</td><td>${escapeHtml(sale.brand)}</td><td>${escapeHtml(sale.item_type)}</td><td>${escapeHtml(sale.model)}</td><td>${escapeHtml(sale.size)}</td><td>${money(sale.price)}</td><td>${sale.refund ? "Yes" : ""}</td></tr>`).join("")}
      </table>
    </section>
    ${skuSection(skuModels, skuSizes, skus)}
  `);
}

async function salesUsersWithoutAccounts(db, users) {
  const known = new Set(users.map((user) => clean(user.username).toLowerCase()).filter(Boolean));
  const rows = await all(db, "SELECT username, region, store, MIN(created_at) created_at, COUNT(*) sales_count FROM sales WHERE trim(username) <> '' GROUP BY lower(username) ORDER BY lower(username)");
  return rows
    .map((row) => ({
      username: clean(row.username),
      email: "",
      region: canonicalRegion(row.region),
      store: clean(row.store),
      created_at: Number(row.created_at || 0),
      sales_count: Number(row.sales_count || 0)
    }))
    .filter((row) => row.username && !known.has(row.username.toLowerCase()));
}

function usersSection(users, missingUsers = []) {
  return `
    <section class="card">
      <h2>Manage Users</h2>
      ${missingUsers.length ? `<p class="notice">Some sales are attached to usernames that do not have backend account records yet. Add an email, then repair the account to make it manageable below.</p>` : ""}
      <form method="post" action="/admin/users/save" class="row createUserRow">
        <div><label>Username</label><input name="username" required></div>
        <div><label>Email</label><input name="email" type="email" required></div>
        <div><label>Region</label><select name="region" required><option value="">Choose region</option>${options(REGIONS, "")}</select></div>
        <div><label>Store</label><input name="store" required></div>
        <div><label>Password</label><input name="password" type="password" placeholder="required for new"></div>
        <button>Create User</button>
      </form>
      <div class="userTable" role="table" aria-label="Users">
        <div class="userTableHead" role="row">
          <span>Username</span><span>Email</span><span>Region</span><span>Store</span><span>Created</span><span>Actions</span>
        </div>
        ${users.map((user) => `
          <form method="post" action="/admin/users/save" class="userTableRow" role="row">
            <input name="username" value="${attr(user.username)}" readonly>
            <input name="email" type="email" value="${attr(user.email)}" required>
            <select name="region" required>${options(REGIONS, user.region)}</select>
            <input name="store" value="${attr(user.store)}" required>
            <span class="createdAt">${escapeHtml(formatAdminDate(user.created_at))}</span>
            <span class="userActions">
              <button>Save</button>
              <button class="ghost" formaction="/admin/users/reset-password">Reset to ${escapeHtml(DEFAULT_RESET_PASSWORD)}</button>
              <button class="danger" formaction="/admin/users/delete" onclick="return confirm('Delete ${attr(user.username)}?');">Delete</button>
            </span>
          </form>
        `).join("")}
        ${missingUsers.map((user) => `
          <form method="post" action="/admin/users/repair" class="userTableRow saleOnlyUser" role="row">
            <input name="username" value="${attr(user.username)}" readonly>
            <input name="email" type="email" placeholder="email required" required>
            <select name="region" required>${options(REGIONS, user.region)}</select>
            <input name="store" value="${attr(user.store)}" required>
            <span class="createdAt">${escapeHtml(user.sales_count)} sale${user.sales_count === 1 ? "" : "s"}</span>
            <span class="userActions">
              <button>Create account</button>
              <span class="pill">password ${escapeHtml(DEFAULT_RESET_PASSWORD)}</span>
            </span>
          </form>
        `).join("")}
      </div>
    </section>
  `;
}

function legacyImportSection() {
  return `
    <section class="card">
      <h2>Import Legacy Laptop Backup</h2>
      <p class="muted">Paste the contents of the old <code>llamasales-backend-data.json</code> file here to merge its users, sales, and simple commission rates into Cloudflare D1. Existing matching rows are updated, not duplicated.</p>
      <form method="post" action="/admin/import/legacy" class="stackForm">
        <textarea name="backupJson" rows="6" placeholder="{ &quot;Users&quot;: [...], &quot;Sales&quot;: [...] }"></textarea>
        <div class="actions matrixActions"><button>Import Backup JSON</button></div>
      </form>
    </section>
  `;
}

function matrixSection(title, itemType, models, sizes, rates, modelCategories = {}) {
  const isTv = itemType === "tv";
  return `
    <section class="card">
      <h2>${escapeHtml(title)}</h2>
      <p class="muted">Models run down rows and sizes run across columns. Edit any number of cells, then save the whole matrix once.</p>
      <div class="matrixTools">
        <form method="post" action="/admin/catalog/model/save"><input type="hidden" name="itemType" value="${itemType}"><label>Add TV Model</label><div class="inlineForm"><input name="model" placeholder="Model name"><button>Add</button></div></form>
        <form method="post" action="/admin/catalog/size/save"><label>Add Size</label><div class="inlineForm"><input name="size" placeholder="Screen size"><button>Add</button></div></form>
      </div>
      ${modelDeleteList(itemType, models)}
      <form method="post" action="/admin/rates/batch-save" class="stackForm">
        <input type="hidden" name="itemType" value="${attr(itemType)}">
        <div class="actions matrixActions">
          <button>Save All Current TV Rates</button>
          <a class="buttonLink ghost" href="/admin/rates/dated?itemType=${encodeURIComponent(itemType)}" target="_blank" rel="noopener">Dated TV Changes</a>
        </div>
        <div class="matrixWrap"><table class="matrix"><thead><tr>${isTv ? "<th>Type</th>" : ""}<th>Model</th>${sizes.map((size) => `<th>${escapeHtml(size)}"</th>`).join("")}</tr></thead><tbody>
          ${models.map((model) => `<tr>${isTv ? modelCategoryCell(model, modelCategories[model]) : ""}<th scope="row">${escapeHtml(model)}</th>${sizes.map((size) => rateInputCell(itemType, model, size, rates)).join("")}</tr>`).join("")}
        </tbody></table></div>
      </form>
    </section>
  `;
}

function modelCategoryCell(model, category) {
  return `<td class="categoryCell"><input type="hidden" name="modelCategoryModel" value="${attr(model)}"><select name="modelCategory">${productTypeOptions(category || defaultModelCategory(model))}</select></td>`;
}

function soundbarSection(models, rates) {
  return `
    <section class="card">
      <h2>Soundbar Commission</h2>
      <div class="matrixTools">
        <form method="post" action="/admin/catalog/model/save"><input type="hidden" name="itemType" value="soundbar"><label>Add Soundbar Model</label><div class="inlineForm"><input name="model" placeholder="Soundbar model"><button>Add</button></div></form>
      </div>
      ${modelDeleteList("soundbar", models)}
      <form method="post" action="/admin/rates/batch-save" class="stackForm">
        <input type="hidden" name="itemType" value="soundbar">
        <div class="actions matrixActions">
          <button>Save All Current Soundbar Rates</button>
          <a class="buttonLink ghost" href="/admin/rates/dated?itemType=soundbar" target="_blank" rel="noopener">Dated Soundbar Changes</a>
        </div>
        <div class="matrixWrap"><table class="matrix soundbarMatrix"><thead><tr><th>Model</th><th>Commission</th></tr></thead><tbody>
          ${models.map((model) => `<tr><th scope="row">${escapeHtml(model)}</th>${rateInputCell("soundbar", model, "", rates)}</tr>`).join("")}
        </tbody></table></div>
      </form>
    </section>
  `;
}

function rateInputCell(itemType, model, size, rates, blank = false) {
  const key = rateKey(itemType, model, size);
  const value = blank ? "" : rates[key] ?? "";
  return `<td><input type="hidden" name="combo" value="${attr(JSON.stringify({ itemType, model, size }))}"><input class="matrixInput" name="value" type="number" step="0.01" value="${attr(value)}" placeholder="-"></td>`;
}

function skuSection(models, sizes, skus) {
  return `
    <section class="card" id="sku-matrix">
      <h2>SKU Lookup Matrix</h2>
      <p class="muted">Low-frequency reference table. Models run down rows and sizes run across columns. Edit any number of cells, then save once.</p>
      <form method="post" action="/admin/skus/batch-save" class="stackForm">
        <div class="actions matrixActions"><button>Save SKU Matrix</button></div>
        <div class="matrixWrap"><table class="matrix skuMatrix"><thead><tr><th>Model</th>${sizes.map((size) => `<th>${escapeHtml(size)}"</th>`).join("")}</tr></thead><tbody>
          ${models.map((model) => `<tr><th scope="row">${escapeHtml(model)}</th>${sizes.map((size) => skuInputCell(model, size, skus)).join("")}</tr>`).join("")}
        </tbody></table></div>
      </form>
    </section>
  `;
}

function skuInputCell(model, size, skus) {
  const value = skus[skuKey(model, size)] || "";
  return `<td><input type="hidden" name="combo" value="${attr(JSON.stringify({ model, size }))}"><input class="matrixInput skuInput" name="sku" value="${attr(value)}" placeholder="-"></td>`;
}

function modelDeleteList(itemType, models) {
  return `
    <div class="modelDeleteList" aria-label="Delete ${itemType === "soundbar" ? "soundbar" : "TV"} models">
      <div class="muted">Delete models from future dropdowns. Existing sales remain unchanged.</div>
      <div class="modelChipGrid">
        ${models.map((model) => `
          <form method="post" action="/admin/catalog/model/delete" class="modelChip" onsubmit="return confirm('Delete ${attr(model)}? Existing sales will remain, but this model will disappear from future dropdowns.');">
            <input type="hidden" name="itemType" value="${attr(itemType)}">
            <input type="hidden" name="model" value="${attr(model)}">
            <span>${escapeHtml(model)}</span>
            <button class="danger" title="Delete ${attr(model)}">Delete</button>
          </form>
        `).join("")}
      </div>
    </div>
  `;
}

async function datedRatesPage(db, itemType, saved = false) {
  const tvModels = await modelList(db, "tv");
  const soundbarModels = await modelList(db, "soundbar");
  const sizes = await sizeList(db);
  const models = itemType === "soundbar" ? soundbarModels : tvModels;
  return page(`Dated ${itemType === "soundbar" ? "Soundbar" : "TV"} Commission Changes`, `
    <section class="card">
      <div class="actions">
        <div style="flex:1 1 auto">
          <h1>Dated ${itemType === "soundbar" ? "Soundbar" : "TV"} Commission Changes</h1>
          <p class="muted">Only filled cells will be saved. Blank cells keep their previous value.</p>
        </div>
        <a class="buttonLink ghost" href="/admin">Back to Admin</a>
      </div>
      ${saved ? `<p class="notice">Dated changes saved. Blank cells were left unchanged.</p>` : ""}
      <form method="post" action="/admin/rates/dated-save" class="stackForm">
        <input type="hidden" name="itemType" value="${attr(itemType)}">
        <div class="datedHeader">
          <div><label>Start Date</label><input name="effectiveFrom" type="date" value="${todayIso()}" required></div>
          <button>Apply Dated Changes</button>
        </div>
        <div class="matrixWrap"><table class="matrix ${itemType === "soundbar" ? "soundbarMatrix" : ""}">
          <thead><tr><th>Model</th>${itemType === "soundbar" ? "<th>Commission</th>" : sizes.map((size) => `<th>${escapeHtml(size)}"</th>`).join("")}</tr></thead>
          <tbody>
            ${models.map((model) => `<tr><th scope="row">${escapeHtml(model)}</th>${itemType === "soundbar" ? rateInputCell("soundbar", model, "", {}, true) : sizes.map((size) => rateInputCell("tv", model, size, {}, true)).join("")}</tr>`).join("")}
          </tbody>
        </table></div>
      </form>
    </section>
  `);
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
  return "body{margin:0;background:#05030a;color:#f8fafc;font-family:Segoe UI,Arial,sans-serif}main{max-width:1180px;margin:0 auto;padding:28px 18px 60px}h1{margin:0 0 4px;font-size:34px}h2{margin:0 0 14px;font-size:20px}.muted{color:#9dabc0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.card{background:rgba(24,27,34,.82);border:1px solid rgba(114,126,166,.65);border-radius:14px;padding:16px;margin:14px 0}.auth{max-width:430px;margin:54px auto}.kpi{font-size:32px;font-weight:800;color:#00aaa6}label{display:block;font-size:12px;color:#9dabc0;margin:10px 0 4px}input,select,textarea{box-sizing:border-box;width:100%;border-radius:10px;border:1px solid rgba(120,136,166,.7);background:#0b0d11;color:#fff;padding:0 10px}input,select{height:38px}textarea{min-height:140px;padding:10px;resize:vertical;font-family:Consolas,monospace;font-size:12px}code{color:#dbeafe}.saleOnlyUser{outline:1px solid rgba(125,242,199,.35)}button,.buttonLink{display:inline-flex;align-items:center;justify-content:center;min-height:38px;border:0;border-radius:10px;background:#00aaa6;color:#fff;font-weight:700;padding:0 14px;cursor:pointer;text-decoration:none}.ghost{background:rgba(120,136,166,.16);border:1px solid rgba(120,136,166,.42);color:#dbeafe}.danger{background:#b21c2d}.row{display:grid;grid-template-columns:1.2fr 1.4fr 1fr 1fr auto;gap:8px;align-items:end}.createUserRow{grid-template-columns:1fr 1.4fr 1fr 1fr 1fr auto}.table{width:100%;border-collapse:collapse}.table th,.table td{border-bottom:1px solid rgba(120,136,166,.35);padding:8px;text-align:left;font-size:13px}.pill{display:inline-block;border:1px solid rgba(0,170,166,.6);border-radius:999px;padding:4px 8px;color:#00aaa6;font-size:12px}.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.error{color:#ff8b8b;font-weight:700}.notice{color:#7df2c7;font-weight:700}.userTable{display:grid;gap:4px;margin-top:14px;overflow:auto}.userTableHead,.userTableRow{display:grid;grid-template-columns:1fr 1.5fr 1fr 1fr .8fr 2fr;gap:6px;align-items:center;min-width:1040px}.userTableHead{color:#9dabc0;font-size:12px;font-weight:800;padding:0 8px}.userTableRow{padding:8px;border-top:1px solid rgba(120,136,166,.28);background:rgba(11,13,17,.32);border-radius:10px}.createdAt{color:#dbeafe;font-size:13px}.userActions{display:flex;gap:6px;flex-wrap:wrap}.userActions button{min-height:32px;padding:0 10px;font-size:12px}.matrixTools{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:10px;margin:10px 0 14px}.modelDeleteList{display:grid;gap:8px;margin:0 0 12px}.modelChipGrid{display:flex;flex-wrap:wrap;gap:6px}.modelChip{display:inline-flex;align-items:center;gap:6px;min-height:30px;border:1px solid rgba(120,136,166,.3);border-radius:999px;background:rgba(11,13,17,.42);padding:3px 3px 3px 9px}.modelChip span{font-size:12px;color:#dbeafe}.modelChip button{min-height:24px;border-radius:999px;padding:0 8px;font-size:11px}.inlineForm{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.stackForm{display:grid;gap:12px}.matrixActions{justify-content:flex-end;margin:4px 0}.datedHeader{display:grid;grid-template-columns:minmax(180px,260px) auto;gap:10px;align-items:end;margin:10px 0 14px}.matrixWrap{overflow:auto;border:1px solid rgba(120,136,166,.35);border-radius:12px}.matrix{width:100%;border-collapse:separate;border-spacing:0;min-width:900px}.soundbarMatrix{min-width:420px}.matrix th,.matrix td{border-bottom:1px solid rgba(120,136,166,.28);border-right:1px solid rgba(120,136,166,.2);padding:7px;text-align:left;font-size:12px}.matrix th{position:sticky;top:0;background:#10131a;z-index:1;color:#dbeafe}.matrix th:first-child{left:0;z-index:2}.matrix tbody th{top:auto;left:0;background:#10131a}.categoryCell{min-width:132px}.categoryCell select,.matrixInput{height:32px;padding:0 8px}.matrixInput{min-width:74px}@media(max-width:980px){.userTableHead,.userTableRow{min-width:980px}.matrixTools{grid-template-columns:1fr}}@media(max-width:760px){.row,.createUserRow,.datedHeader{grid-template-columns:1fr}.table{display:block;overflow:auto}}";
}

async function clientPayload(db, user) {
  return {
    ok: true,
    serverTime: new Date().toISOString(),
    account: userToClient(user),
    sales: (await all(db, "SELECT * FROM sales WHERE brand='Hisense' ORDER BY created_at DESC")).map(saleToClient),
    commissionRates: await ratesClientMap(db),
    commissionRateHistory: await rateHistoryClientList(db),
    meta: await publicMeta(db)
  };
}

async function publicMeta(db) {
  await ensureDefaults(db);
  await purgeExpiredBarcodes(db);
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
    sizes: await sizeList(db),
    modelCategories: await modelCategoryMap(db),
    skus: await skuClientMap(db),
    commissionRates: await ratesClientMap(db),
    commissionRateHistory: await rateHistoryClientList(db),
    barcodes: await activeBarcodes(db)
  };
}

async function ensureDefaults(db) {
  const tvCount = await db.prepare("SELECT COUNT(*) value FROM product_models WHERE item_type='tv'").first();
  const soundbarCount = await db.prepare("SELECT COUNT(*) value FROM product_models WHERE item_type='soundbar'").first();
  const sizeCount = await db.prepare("SELECT COUNT(*) value FROM product_sizes").first();
  if (Number(tvCount?.value || 0) <= 0) {
    for (const [index, model] of TV_MODELS.entries()) await db.prepare("INSERT OR IGNORE INTO product_models (item_type,model,category,sort_order) VALUES ('tv',?,?,?)").bind(model, defaultModelCategory(model), (index + 1) * 10).run();
  }
  if (Number(soundbarCount?.value || 0) <= 0) {
    for (const [index, model] of SOUNDBAR_MODELS.entries()) await db.prepare("INSERT OR IGNORE INTO product_models (item_type,model,sort_order) VALUES ('soundbar',?,?)").bind(model, (index + 1) * 10).run();
  }
  if (Number(sizeCount?.value || 0) <= 0) {
    for (const [index, size] of SIZES.entries()) await db.prepare("INSERT OR IGNORE INTO product_sizes (size,sort_order) VALUES (?,?)").bind(size, (index + 1) * 10).run();
  }
  await applyDefaultModelCategories(db);
  await seedDefaultSkus(db);
}

async function ensureSchema(db) {
  const salesColumns = await all(db, "PRAGMA table_info(sales)");
  if (salesColumns.length && !salesColumns.some((column) => column.name === "refund")) {
    await db.prepare("ALTER TABLE sales ADD COLUMN refund INTEGER NOT NULL DEFAULT 0").run();
  }
  const tables = await all(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='product_models'");
  if (tables.length) {
    const columns = await all(db, "PRAGMA table_info(product_models)");
    if (!columns.some((column) => column.name === "category")) {
      await db.prepare("ALTER TABLE product_models ADD COLUMN category TEXT NOT NULL DEFAULT ''").run();
    }
  }
  await db.prepare("CREATE TABLE IF NOT EXISTS commission_rate_history (item_type TEXT NOT NULL, model TEXT NOT NULL, size TEXT NOT NULL DEFAULT '', effective_from TEXT NOT NULL, value REAL NOT NULL DEFAULT 0, cleared INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'current', created_at INTEGER NOT NULL, PRIMARY KEY (item_type, model, size, effective_from))").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS barcodes (id TEXT PRIMARY KEY, description TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, code TEXT NOT NULL, applies_to TEXT NOT NULL DEFAULT '[]', created_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS product_skus (model TEXT NOT NULL, size TEXT NOT NULL, sku TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (model, size))").run();
  const historyColumns = await all(db, "PRAGMA table_info(commission_rate_history)");
  if (!historyColumns.some((column) => column.name === "source")) {
    await db.prepare("ALTER TABLE commission_rate_history ADD COLUMN source TEXT NOT NULL DEFAULT 'current'").run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_commission_rate_history_effective ON commission_rate_history (item_type, model, size, effective_from)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_barcodes_dates ON barcodes (start_date, end_date)").run();
  await db.prepare("INSERT OR IGNORE INTO commission_rate_history (item_type, model, size, effective_from, value, cleared, source, created_at) SELECT item_type, model, size, '1970-01-01', value, 0, 'current', 0 FROM commission_rates").run();
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

async function assignUnlocatedSalesToPrimaryAccount(db) {
  const user = await getUser(db, PRIMARY_ACCOUNT_USERNAME);
  if (!user) return 0;
  const result = await db.prepare(`
    UPDATE sales
    SET username=?, region=?, store=?
    WHERE brand='Hisense'
      AND (
        trim(username) = ''
        OR lower(trim(username)) IN ('unknown', 'unassigned', 'not located', 'not located to an account', 'no account')
        OR NOT EXISTS (
          SELECT 1
          FROM users
          WHERE lower(users.username) = lower(trim(sales.username))
        )
      )
  `).bind(user.username, user.region, user.store).run();
  return Number(result?.meta?.changes || 0);
}

async function forceAssignCurrentSalesToPrimaryAccount(db) {
  const user = await getUser(db, PRIMARY_ACCOUNT_USERNAME);
  if (!user) return { repaired: 0, skipped: "Primary account does not exist" };
  const userCount = await count(db, "users");
  if (userCount !== 1) return { repaired: 0, skipped: "Repair only runs while 03h043 is the only backend user" };
  const result = await db.prepare(`
    UPDATE sales
    SET username=?, region=?, store=?
    WHERE brand='Hisense'
      AND (
        lower(trim(username)) <> lower(?)
        OR trim(region) <> ?
        OR trim(store) <> ?
      )
  `).bind(user.username, user.region, user.store, user.username, user.region, user.store).run();
  const counts = await salesUsernameCounts(db);
  return { repaired: Number(result?.meta?.changes || 0), assignedTo: user.username, region: user.region, store: user.store, salesByUsername: counts };
}

async function salesUsernameCounts(db) {
  return all(db, "SELECT username, region, store, COUNT(*) count FROM sales WHERE brand='Hisense' GROUP BY username, region, store ORDER BY count DESC, username");
}

async function upsertSale(db, sale) {
  await db.prepare("INSERT INTO sales (id,date,brand,item_type,model,size,price,refund,username,region,store,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date, brand=excluded.brand, item_type=excluded.item_type, model=excluded.model, size=excluded.size, price=excluded.price, refund=excluded.refund, username=excluded.username, region=excluded.region, store=excluded.store, created_at=excluded.created_at")
    .bind(sale.id, sale.date, sale.brand, sale.itemType, sale.model, sale.size, sale.price, sale.refund ? 1 : 0, sale.username, sale.region, sale.store, sale.createdAt).run();
}

function normalizeSale(raw, user) {
  const incomingBrand = clean(raw?.brand);
  if (incomingBrand && incomingBrand !== "Hisense") return null;
  const brand = "Hisense";
  const refund = truthyFlag(raw?.refund || raw?.isRefund || raw?.is_refund);
  const itemType = !refund && clean(raw?.itemType) === "soundbar" ? "soundbar" : "tv";
  return {
    id: clean(raw?.id),
    date: clean(raw?.date) || new Date().toISOString().slice(0, 10),
    brand,
    itemType,
    model: refund ? "" : clean(raw?.model),
    size: !refund && itemType === "tv" ? clean(raw?.size) : "",
    price: Number(raw?.price || 0),
    refund,
    username: clean(raw?.username || user.username),
    region: user.region,
    store: user.store,
    createdAt: Number(raw?.createdAt || Date.now())
  };
}

function legacySaleToDb(raw) {
  const brand = clean(raw?.Brand || raw?.brand);
  if (brand !== "Hisense") return null;
  const username = clean(raw?.Username || raw?.username);
  const region = canonicalRegion(raw?.Region || raw?.region);
  const store = clean(raw?.Store || raw?.store);
  const itemTypeValue = clean(raw?.ItemType || raw?.itemType || raw?.item_type).toLowerCase();
  const itemType = brand === "Hisense" && itemTypeValue === "soundbar" ? "soundbar" : "tv";
  const date = strictDate(raw?.Date || raw?.date) || todayIso();
  if (!brand || !username || !region || !store) return null;
  return {
    id: clean(raw?.Id || raw?.id) || crypto.randomUUID(),
    date,
    brand,
    itemType,
    model: brand === "Hisense" ? clean(raw?.Model || raw?.model) : "",
    size: brand === "Hisense" && itemType === "tv" ? clean(raw?.Size || raw?.size) : "",
    price: Number(raw?.Price || raw?.price || 0),
    refund: truthyFlag(raw?.Refund || raw?.refund || raw?.IsRefund || raw?.isRefund || raw?.is_refund),
    username,
    region,
    store,
    createdAt: Number(raw?.CreatedAt || raw?.createdAt || raw?.created_at || Date.now())
  };
}

function normalizeBarcodePayload(raw, user) {
  const description = clean(raw?.description).slice(0, 120);
  const code = clean(raw?.code).replace(/\D/g, "");
  const startDate = strictDate(raw?.startDate || raw?.start_date);
  const endDate = strictDate(raw?.endDate || raw?.end_date);
  let appliesTo = normalizeBarcodeCombos(raw?.appliesTo || raw?.applies_to);
  if (!appliesTo.length) {
    const models = uniqueCleanList(raw?.models);
    const sizes = uniqueCleanList(raw?.sizes);
    appliesTo = normalizeBarcodeCombos(models.flatMap((model) => sizes.map((size) => ({ model, size }))));
  }
  const models = uniqueCleanList(appliesTo.map((combo) => combo.model));
  const sizes = uniqueCleanList(appliesTo.map((combo) => combo.size));
  if (!description || code.length !== 15 || !appliesTo.length || endDate < startDate) return null;
  return {
    id: clean(raw?.id) || crypto.randomUUID(),
    description,
    startDate,
    endDate,
    code,
    models,
    sizes,
    appliesTo,
    createdBy: clean(raw?.createdBy || raw?.created_by || user.username),
    createdAt: Number(raw?.createdAt || raw?.created_at || Date.now())
  };
}

async function saveBarcode(db, barcode) {
  await db.prepare("INSERT INTO barcodes (id,description,start_date,end_date,code,applies_to,created_by,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET description=excluded.description, start_date=excluded.start_date, end_date=excluded.end_date, code=excluded.code, applies_to=excluded.applies_to, created_by=excluded.created_by")
    .bind(barcode.id, barcode.description, barcode.startDate, barcode.endDate, barcode.code, JSON.stringify(barcode.appliesTo), barcode.createdBy, barcode.createdAt).run();
}

async function activeBarcodes(db) {
  const today = todayIso();
  const rows = await all(db, "SELECT * FROM barcodes WHERE start_date<=? AND end_date>=? ORDER BY end_date ASC, description ASC", today, today);
  return rows.map(barcodeToClient);
}

async function purgeExpiredBarcodes(db) {
  await db.prepare("DELETE FROM barcodes WHERE end_date < ?").bind(todayIso()).run();
}

function barcodeToClient(row) {
  const appliesTo = normalizeBarcodeCombos(parseJsonArray(row.applies_to));
  const models = uniqueCleanList(appliesTo.map((item) => item?.model));
  const sizes = uniqueCleanList(appliesTo.map((item) => item?.size));
  return {
    id: row.id,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    code: row.code,
    models,
    sizes,
    appliesTo,
    createdBy: row.created_by,
    createdAt: Number(row.created_at || 0)
  };
}

async function ratesClientMap(db) {
  const rows = await all(db, "SELECT item_type, model, size, value FROM commission_rates ORDER BY item_type, model, size");
  const map = {};
  for (const row of rows) {
    map[rateKey(row.item_type, row.model, row.size)] = Number(row.value || 0);
  }
  return map;
}

async function ratesMap(db) {
  return ratesClientMap(db);
}

async function rateHistoryClientList(db) {
  const rows = await all(db, "SELECT item_type, model, size, effective_from, value, cleared, source FROM commission_rate_history ORDER BY item_type, model, size, effective_from");
  return rows.map((row) => ({
    itemType: row.item_type === "soundbar" ? "soundbar" : "tv",
    model: row.model || "",
    size: row.size || "",
    effectiveFrom: row.effective_from || "1970-01-01",
    value: Number(row.value || 0),
    cleared: Boolean(Number(row.cleared || 0)),
    source: clean(row.source) === "dated" ? "dated" : "current"
  }));
}

async function effectiveRateRows(db, effectiveDate) {
  return all(db, `
    SELECT history.*
    FROM commission_rate_history history
    JOIN (
      SELECT item_type, model, size, MAX(effective_from) effective_from
      FROM commission_rate_history
      WHERE effective_from <= ?
      GROUP BY item_type, model, size
    ) latest
      ON latest.item_type = history.item_type
     AND latest.model = history.model
     AND latest.size = history.size
     AND latest.effective_from = history.effective_from
    ORDER BY history.item_type, history.model, history.size
  `, effectiveDate);
}

async function saveCommissionRate(db, itemType, model, size, value, effectiveFrom, cleared, source = "current") {
  await saveModel(db, itemType, model);
  if (itemType === "tv") await saveSize(db, size);
  const cleanDate = validDateOrToday(effectiveFrom);
  const cleanSource = source === "dated" ? "dated" : "current";
  await db.prepare("INSERT INTO commission_rate_history (item_type,model,size,effective_from,value,cleared,source,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(item_type,model,size,effective_from) DO UPDATE SET value=excluded.value, cleared=excluded.cleared, source=excluded.source, created_at=excluded.created_at")
    .bind(itemType, model, size, cleanDate, Number(value || 0), cleared ? 1 : 0, cleanSource, Date.now()).run();

  if (cleanDate <= todayIso()) {
    if (cleared) {
      await db.prepare("DELETE FROM commission_rates WHERE item_type=? AND model=? AND size=?").bind(itemType, model, size).run();
    } else {
      await db.prepare("INSERT INTO commission_rates (item_type,model,size,value) VALUES (?,?,?,?) ON CONFLICT(item_type,model,size) DO UPDATE SET value=excluded.value")
        .bind(itemType, model, size, Number(value || 0)).run();
    }
  }
}

function rateKey(itemType, model, size) {
  return itemType === "soundbar" ? `soundbar|${model}|` : `${model}|${size}`;
}

async function modelList(db, itemType) {
  return (await all(db, "SELECT model FROM product_models WHERE item_type=? ORDER BY lower(model), model", itemType)).map((row) => row.model);
}

async function modelCategoryMap(db) {
  const rows = await all(db, "SELECT model, category FROM product_models WHERE item_type='tv' ORDER BY lower(model), model");
  const map = {};
  for (const row of rows) {
    const model = clean(row.model);
    const category = normalizeProductType(row.category) || defaultModelCategory(model);
    if (model && category) map[model] = category;
  }
  return map;
}

async function sizeList(db) {
  return (await all(db, "SELECT size FROM product_sizes ORDER BY sort_order, size")).map((row) => row.size);
}

async function saveModel(db, itemType, model, category = "") {
  if (!model) return;
  const max = await db.prepare("SELECT COALESCE(MAX(sort_order),0) maxSort FROM product_models WHERE item_type=?").bind(itemType).first();
  const modelCategory = itemType === "tv" ? (normalizeProductType(category) || defaultModelCategory(model)) : "";
  await db.prepare("INSERT OR IGNORE INTO product_models (item_type,model,category,sort_order) VALUES (?,?,?,?)").bind(itemType, model, modelCategory, Number(max?.maxSort || 0) + 10).run();
  if (itemType === "tv" && modelCategory) await saveModelCategory(db, model, modelCategory);
}

async function saveModelCategory(db, model, category) {
  if (!model) return;
  const productType = normalizeProductType(category);
  await db.prepare("UPDATE product_models SET category=? WHERE item_type='tv' AND model=?").bind(productType, model).run();
}

async function applyDefaultModelCategories(db) {
  for (const [model, category] of Object.entries(DEFAULT_MODEL_CATEGORIES)) {
    await db.prepare("UPDATE product_models SET category=? WHERE item_type='tv' AND model=? AND (category IS NULL OR category='')").bind(category, model).run();
  }
}

async function deleteModel(db, itemType, model) {
  if (!model) return;
  await db.prepare("DELETE FROM product_models WHERE item_type=? AND model=?").bind(itemType, model).run();
  await db.prepare("DELETE FROM commission_rates WHERE item_type=? AND model=?").bind(itemType, model).run();
  await db.prepare("DELETE FROM commission_rate_history WHERE item_type=? AND model=?").bind(itemType, model).run();
}

async function saveSize(db, size) {
  if (!size) return;
  const max = await db.prepare("SELECT COALESCE(MAX(sort_order),0) maxSort FROM product_sizes").first();
  await db.prepare("INSERT OR IGNORE INTO product_sizes (size,sort_order) VALUES (?,?)").bind(size, Number(max?.maxSort || 0) + 10).run();
}

async function saveSku(db, model, size, sku) {
  if (!model || !size) return;
  await db.prepare("INSERT INTO product_skus (model,size,sku,updated_at) VALUES (?,?,?,?) ON CONFLICT(model,size) DO UPDATE SET sku=excluded.sku, updated_at=excluded.updated_at")
    .bind(model, size, sku, Date.now()).run();
}

async function seedDefaultSkus(db) {
  const countRow = await db.prepare("SELECT COUNT(*) value FROM product_skus").first();
  if (Number(countRow?.value || 0) > 0) return;
  for (const [model, sizes] of Object.entries(DEFAULT_SKUS)) {
    for (const [size, sku] of Object.entries(sizes)) {
      await saveSku(db, model, size, sku);
    }
  }
}

async function skuMap(db) {
  const rows = await all(db, "SELECT model, size, sku FROM product_skus ORDER BY model, size");
  const map = {};
  for (const row of rows) {
    const model = clean(row.model);
    const size = clean(row.size);
    const sku = clean(row.sku);
    if (model && size && sku) map[skuKey(model, size)] = sku;
  }
  return map;
}

async function skuClientMap(db) {
  const rows = await all(db, "SELECT model, size, sku FROM product_skus ORDER BY model, size");
  const map = {};
  for (const row of rows) {
    const model = clean(row.model);
    const size = clean(row.size);
    const sku = clean(row.sku);
    if (!model || !size || !sku) continue;
    if (!map[model]) map[model] = {};
    map[model][size] = sku;
  }
  return map;
}

function skuKey(model, size) {
  return `${clean(model).toLowerCase()}|${clean(size).toLowerCase()}`;
}

function skuModelList(models) {
  return uniqueCleanList([...Object.keys(DEFAULT_SKUS), ...models]);
}

function skuSizeList(sizes) {
  const defaultSizes = Object.values(DEFAULT_SKUS).flatMap((row) => Object.keys(row));
  return uniqueCleanList([...sizes, ...defaultSizes]).sort(compareSizes);
}

function compareSizes(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftIsNumber = Number.isFinite(leftNumber);
  const rightIsNumber = Number.isFinite(rightNumber);
  if (leftIsNumber && rightIsNumber) return leftNumber - rightNumber;
  if (leftIsNumber) return -1;
  if (rightIsNumber) return 1;
  return String(left).localeCompare(String(right), undefined, { sensitivity: "base", numeric: true });
}

async function buildBackup(db) {
  return {
    settings: await all(db, "SELECT * FROM settings"),
    users: await all(db, "SELECT * FROM users"),
    sales: await all(db, "SELECT * FROM sales"),
    commissionRates: await all(db, "SELECT * FROM commission_rates"),
    commissionRateHistory: await all(db, "SELECT * FROM commission_rate_history"),
    productModels: await all(db, "SELECT * FROM product_models"),
    productSizes: await all(db, "SELECT * FROM product_sizes"),
    productSkus: await all(db, "SELECT * FROM product_skus"),
    barcodes: await all(db, "SELECT * FROM barcodes")
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function validDateOrToday(value) {
  const text = clean(value);
  return strictDate(text) || todayIso();
}

function strictDate(value) {
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text) return text;
  }
  return "";
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
    refund: Boolean(row.refund),
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

function productTypeOptions(selected) {
  return `<option value="">Choose type</option>${PRODUCT_TYPES.map((value) => `<option${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}`;
}

function normalizeProductType(value) {
  const cleanValue = clean(value).toUpperCase();
  return PRODUCT_TYPES.find((item) => item === cleanValue) || "";
}

function defaultModelCategory(model) {
  return DEFAULT_MODEL_CATEGORIES[clean(model)] || "";
}

function money(value) {
  return `GBP ${Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function formatAdminDate(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString("en-GB");
}

function canonicalRegion(region) {
  const cleanValue = clean(region);
  return REGIONS.find((item) => item.toLowerCase() === cleanValue.toLowerCase()) || cleanValue;
}

function clean(value) {
  return String(value ?? "").trim();
}

function truthyFlag(value) {
  return value === true || value === 1 || value === "1" || clean(value).toLowerCase() === "true" || clean(value).toLowerCase() === "on";
}

function uniqueCleanList(values) {
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = clean(value);
    if (text && !output.some((item) => item.toLowerCase() === text.toLowerCase())) output.push(text);
  }
  return output.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base", numeric: true }));
}

function normalizeBarcodeCombos(values) {
  const output = [];
  const seen = new Set();
  let source = values;
  if (!Array.isArray(source)) {
    try {
      const parsed = JSON.parse(String(source || "[]"));
      source = Array.isArray(parsed) ? parsed : [];
    } catch {
      source = [];
    }
  }
  for (const item of source) {
    const parsed = typeof item === "string" ? parseJsonObject(item) : item;
    const model = clean(parsed?.model);
    const size = clean(parsed?.size);
    const key = `${model.toLowerCase()}::${size.toLowerCase()}`;
    if (model && size && !seen.has(key)) {
      seen.add(key);
      output.push({ model, size });
    }
  }
  return output.sort((left, right) => left.model.localeCompare(right.model, undefined, { sensitivity: "base", numeric: true }) || left.size.localeCompare(right.size, undefined, { sensitivity: "base", numeric: true }));
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
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
