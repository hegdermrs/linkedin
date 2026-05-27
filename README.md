# LinkedIn Wrestler Outreach Agent

Multi-tenant platform for automated LinkedIn outreach: Playwright drives each coach's session, an LLM personalizes messages from profiles and threads, and a state machine moves prospects from connection request to Calendly booking.

## Stack

- **apps/web** — Next.js dashboard (client + agency admin)
- **apps/api** — Fastify REST API
- **apps/worker** — BullMQ + Playwright job processor
- **packages/agent** — LLM prompts, guardrails, playbook compiler
- **packages/linkedin** — Playwright LinkedIn automation
- **packages/db** — Prisma + PostgreSQL
- **packages/shared** — Zod schemas and types

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (Postgres + Redis)

## One-click start (Windows)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.
2. Double-click **`Start App.bat`** in the project folder.

   Or in a terminal:

   ```powershell
   cd D:\Work\APPS\Likedin
   npx pnpm@9.15.0 start
   ```

3. Open **http://localhost:3000** — login `admin@example.com` / `changeme`

Press **Ctrl+C** in that terminal to stop the app. Run `npx pnpm@9.15.0 stop` to stop Docker.

### First-time setup only

```powershell
npx pnpm@9.15.0 setup
```

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` (and `SESSION_ENCRYPTION_KEY`, 32+ chars) before using AI features.

## Put it online (Railway — recommended if you already use Railway)

Everything in **one Railway project** (database + API + worker + website). Plain-English steps:

**[docs/RAILWAY-SIMPLE.md](docs/RAILWAY-SIMPLE.md)**

## Production on one VPS (optional)

For a single Linux server instead of Railway: **[docs/VPS-DEPLOY.md](docs/VPS-DEPLOY.md)**.

```bash
cp .env.production.example .env   # edit domains and secrets
docker compose -f docker-compose.prod.yml up -d --build
```

## Manual start (optional)

```bash
pnpm install
docker compose up -d
pnpm db:push && pnpm db:seed
pnpm dev:all   # API + worker + web in one terminal
```

## Login

| Role | Email | Password |
|------|-------|----------|
| Agency admin | admin@example.com | changeme |

Configure via `AGENCY_ADMIN_EMAIL` / `AGENCY_ADMIN_PASSWORD` in `.env`. The seed also creates a sample client tenant (`demo-coach`) for testing — manage it from the admin UI; no separate coach login.

## LinkedIn connection

In the app: **LinkedIn** tab → **Connect LinkedIn**. A browser window opens on the machine running the API; log in to LinkedIn there.

For remote servers without a screen, use **Advanced (technical team only)** on that page to paste a session from the CLI (`pnpm --filter @linkedin-agent/linkedin login`).

## Client workflow

1. **Setup** — Upload Sales Navigator CSV
2. **Dashboard** — Metrics, pause/resume campaign
3. **Prospects** — Pipeline stages and last messages
4. **Settings** — Calendly URL, timezone

## Agency admin

- **Clients** — Create tenants, edit playbook (prompts + guardrails), publish versions
- **Agency settings** — Global base prompt, LLM model
- **Templates** — Niche playbooks (wrestlers, etc.)
- **Audit** — AI sends and stage changes per tenant

## Calendly webhook

Point Calendly to `POST http://localhost:3001/webhooks/calendly` with header `calendly-webhook-signature` matching `CALENDLY_WEBHOOK_SECRET`.

## Important

LinkedIn automation may violate LinkedIn's Terms of Service and can risk account restrictions. Use conservative rate limits and monitor account health in the dashboard.
