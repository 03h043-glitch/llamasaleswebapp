# LlamaSales Web App

This repository contains the LlamaSales PWA frontend for Cloudflare Pages Git deployment.

## Production URLs

- PWA: `https://app.tiredllama.co.uk`
- Backend/API: `https://api.tiredllama.co.uk`

## Cloudflare Pages Setup

Connect this GitHub repository to Cloudflare Pages with these settings:

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `web`
- Root directory: leave as repository root

Then add the custom domain:

`app.tiredllama.co.uk`

The PWA automatically uses `https://api.tiredllama.co.uk` when served from `app.tiredllama.co.uk`.

## Backend

The backend is not hosted by Cloudflare Pages. Keep running the local Windows backend executable on the laptop and expose it through Cloudflare Tunnel:

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
