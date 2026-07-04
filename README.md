# LlamaSales Web App

This repository contains the LlamaSales PWA frontend for Cloudflare Workers static assets deployment.

## Production URLs

- PWA: `https://app.tiredllama.co.uk`
- Backend/API: `https://api.tiredllama.co.uk`

## Cloudflare Workers Setup

Connect this GitHub repository to Cloudflare Workers Builds. The repository includes `wrangler.jsonc`, which tells Wrangler to deploy the static PWA from `./web`.

Use these settings on Cloudflare's "Set up your application" screen:

- Project name: `llamasaleswebapp`
- Build command: leave blank
- Deploy command: `npx wrangler deploy`
- Builds for non-production branches: optional; safe to leave enabled
- Non-production branch deploy command: `npx wrangler versions upload`
- Path: `/`
- API token: use the generated `llamasaleswebapp build token`
- Variable name/value: leave blank

After deployment, add the custom domain:

`app.tiredllama.co.uk`

The PWA automatically uses `https://api.tiredllama.co.uk` when served from `app.tiredllama.co.uk`.

## Backend

The backend is not hosted by Cloudflare Workers. Keep running the local Windows backend executable on the laptop and expose it through Cloudflare Tunnel:

`api.tiredllama.co.uk -> http://localhost:8787`

Current local backend executable in the project files:

`LlamaSalesBackend-v2.exe`

## Local Frontend Test

Serve the `web` folder with any static file server, then open the local URL in a browser.

Example:

```powershell
cd web
python -m http.server 5173
```

Open:

`http://localhost:5173`
