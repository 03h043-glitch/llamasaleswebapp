# LlamaSales PWA

This is the web/PWA client for LlamaSales. It is dependency-free and can be served as static files.

## Local Test

From the repo root:

```powershell
cd web
python -m http.server 5173
```

If Python is not available, use any static file server. Then open:

`http://localhost:5173`

The PWA defaults to `http://localhost:8787` when opened on localhost.

## Production Shape

Recommended final URLs:

- PWA: `https://app.tiredllama.co.uk`
- Backend: `https://api.tiredllama.co.uk`

When hosted at `app.<domain>`, the PWA automatically derives `https://api.<domain>` as its backend URL.

## Cloudflare Pages Settings

Use Git integration with this repository:

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `web`
- Root directory: repository root

## Production Notes

- The backend admin screen is password protected.
- User login and sync authenticate against backend-managed users.
- CORS is restricted to `https://app.tiredllama.co.uk`, `https://tiredllama.co.uk`, and local test origins.
- Create the backend admin password locally before exposing `api.tiredllama.co.uk` through Cloudflare Tunnel.
- Users are currently backend-admin-only; there is no public self-registration flow.
