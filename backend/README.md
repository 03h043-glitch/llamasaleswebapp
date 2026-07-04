# LlamaSales Backend

The backend is a local Windows executable, not a Cloudflare Pages app.

Current production shape:

- PWA frontend: `https://app.tiredllama.co.uk`
- Backend/API: `https://api.tiredllama.co.uk`
- Cloudflare Tunnel route: `api.tiredllama.co.uk -> http://localhost:8787`

Run the local project-root executable on the laptop:

`LlamaSalesBackend-v2.exe`

Do not commit backend runtime data to this repository:

- `llamasales-backend-data.json`
- compiled `.exe` files
- backup JSON files

The frontend in `/web` is the part Cloudflare Pages should build/deploy from GitHub.
