# LlamaSales Web App

This repository contains the LlamaSales PWA and a Cloudflare Worker/D1 backend.

## Production URLs

- PWA: `https://app.tiredllama.co.uk`
- Backend/API: `https://api.tiredllama.co.uk`

## Cloudflare Workers + D1 Setup

The Worker in `src/worker.js` serves:

- the PWA static assets from `./web`
- `/api/*` login/register/sync endpoints
- the browser admin UI on `/admin` or the `api.tiredllama.co.uk` root

The database schema is in `migrations/0001_initial.sql`.

### 1. Create the D1 database

From this repository folder:

```powershell
npx wrangler d1 create llamasales-db
```

Copy the `database_id` from the output.

### 2. Add the D1 binding

Edit `wrangler.jsonc` and add this block after `assets`, replacing the database id:

```jsonc
,
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "llamasales-db",
    "database_id": "PASTE_DATABASE_ID_HERE"
  }
]
```

### 3. Apply the schema

```powershell
npx wrangler d1 execute llamasales-db --remote --file ./migrations/0001_initial.sql
```

### 4. Deploy

Cloudflare Workers Builds can deploy from GitHub with:

- Project name: `llamasaleswebapp`
- Build command: leave blank
- Deploy command: `npx wrangler deploy`
- Builds for non-production branches: optional; safe to leave enabled
- Non-production branch deploy command: `npx wrangler versions upload`
- Path: `/`
- API token: use the generated build token
- Variable name/value: leave blank

### 5. Add custom domains

Add both custom domains to the same Worker:

- `app.tiredllama.co.uk`
- `api.tiredllama.co.uk`

The PWA automatically uses `https://api.tiredllama.co.uk` when served from `app.tiredllama.co.uk`.

### 6. Create the backend admin login

Open:

`https://api.tiredllama.co.uk/admin`

The first visit will ask you to create the admin password. After that, use this admin UI to manage users, models, sizes, commission rates, and backups.

## Migrating laptop backend data

Export/download your current laptop backend JSON backup, then import rows into D1. A dedicated import tool is not included yet, so the first cloud deployment can either start fresh or have data imported manually with SQL/JSON scripts.

## Local Frontend Test

Serve the `web` folder with any static file server, then open the local URL in a browser.

Example:

```powershell
cd web
python -m http.server 5173
```

Open:

`http://localhost:5173`
