const SUSPENDED_HTML = `<!doctype html>
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

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(clients.map((client) => client.navigate(client.url)));
  })());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(new Response(SUSPENDED_HTML, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  }));
});
