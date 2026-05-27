# Deploy everything on one VPS

One server runs the database, API, worker, web UI, and HTTPS — no Railway/Netlify split.

## What you need

| Item | Suggestion |
|------|------------|
| VPS | 2 GB RAM minimum, **4 GB recommended** (Playwright + Chromium) |
| OS | Ubuntu 22.04 or 24.04 |
| Domain | Two subdomains → same VPS IP |

Example DNS (at your registrar):

| Type | Name | Value |
|------|------|-------|
| A | `outreach` | `YOUR_VPS_IP` |
| A | `api.outreach` | `YOUR_VPS_IP` |

Results: `outreach.yourdomain.com` and `api.yourdomain.com`

## 1. Prepare the server

SSH in as root, then:

```bash
apt update && apt upgrade -y
apt install -y git docker.io docker-compose-plugin
systemctl enable docker --now
```

Optional: add your user to the docker group.

## 2. Clone and configure

```bash
git clone YOUR_REPO_URL /opt/linkedin-agent
cd /opt/linkedin-agent
cp .env.production.example .env
nano .env   # fill in domains, passwords, OPENAI_API_KEY
```

Required in `.env`:

- `APP_DOMAIN`, `API_DOMAIN`, `WEB_URL`, `API_URL`
- `POSTGRES_PASSWORD`, `SESSION_ENCRYPTION_KEY`, `AGENCY_ADMIN_PASSWORD`
- `OPENAI_API_KEY`

## 3. Build and start (one command)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes 10–20 minutes. Then:

- **App:** https://outreach.yourdomain.com  
- **API:** https://api.yourdomain.com  

Caddy obtains free SSL certificates automatically.

## 4. Seed admin user (first time only)

```bash
docker compose -f docker-compose.prod.yml exec api pnpm --filter @linkedin-agent/db seed
```

Log in with `AGENCY_ADMIN_EMAIL` / `AGENCY_ADMIN_PASSWORD` from `.env`.

## 5. LinkedIn on a VPS (important)

The **“Connect LinkedIn”** button opens a browser on the machine running the worker. On a headless VPS there is no screen, so:

1. Run `pnpm playwright:install` is already in the Docker image.
2. Connect LinkedIn **once** from your laptop:
   - Log in locally with the CLI, or use a test session.
   - In the app: **LinkedIn** → **Advanced** → paste the encrypted session blob.

Or run the worker on your PC and only host API+web on VPS (not recommended — splits the stack).

## 6. Updates

```bash
cd /opt/linkedin-agent
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## 7. Logs and restarts

```bash
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml restart worker
docker compose -f docker-compose.prod.yml down   # stop all
```

## Architecture (single VPS)

```text
Internet
   │
   ▼
 Caddy :443
   ├── outreach.domain → web:3000 (Next.js)
   └── api.domain      → api:3001 (Fastify)
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
    postgres:5432      redis:6379         worker (Playwright)
```

## Cost

Roughly **$12–24/mo** (Hetzner CX22, DigitalOcean 4GB, Vultr, etc.) vs multiple PaaS bills.

## Local vs VPS

| | Local (`Start App.bat`) | VPS (`docker-compose.prod.yml`) |
|--|-------------------------|----------------------------------|
| Use case | Dev / your machine | Production for clients |
| LinkedIn login | Browser button works | Paste session (advanced) |
| HTTPS | No | Yes (Caddy) |
