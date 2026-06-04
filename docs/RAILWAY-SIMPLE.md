# Run this app on Railway (simple guide)

You do **not** need a VPS, Netlify, or three different websites.  
Everything can live in **one Railway project** — one login, one bill.

---

## What is this app? (30 seconds)

Think of **5 pieces**:

| Piece | What it does |
|-------|----------------|
| **Website** | What you open in the browser (dashboard) |
| **API** | Saves data, login, uploads CSV |
| **Worker** | Runs LinkedIn automation in the background |
| **Postgres** | Database |
| **Redis** | Queue so the worker knows what to do |

On your PC, **Start App.bat** starts all of that at once.  
On Railway, you add the same 5 pieces **inside one project**.

---

## Step 1 — New Railway project

1. Go to [railway.app](https://railway.app) and log in.
2. **New Project** → **Deploy from GitHub repo** (push this code to GitHub first if you have not).
3. Pick this repository.

You now have one empty service. We will add more.

---

## Step 2 — Add database and Redis

In the same project:

1. Click **+ New** → **Database** → **PostgreSQL**  
2. Click **+ New** → **Database** → **Redis**

Railway creates `DATABASE_URL` and `REDIS_URL` automatically.

---

## Step 3 — Three app services (same repo, three times)

You need **three services** from the **same GitHub repo**:

### A) API service

1. **+ New** → **GitHub Repo** → same repo (or duplicate the first service).
2. Name it `api`.
3. **Settings** → **Build**:
   - Builder: **Dockerfile**
   - Dockerfile path: `Dockerfile`
4. **Settings** → **Deploy** → **Start command** must be:
   ```
   /entrypoint-api.sh
   ```
   If this is blank, the service shows **Completed** (crashed/exited) instead of **Online**.
5. **Variables** (see list below). Important:
   - `DATABASE_URL` → **Reference** → your Postgres service
   - `REDIS_URL` → **Reference** → your Redis service
6. **Settings** → **Networking** → **Generate domain** (e.g. `https://something.up.railway.app`).  
   Copy this URL — that is your **API URL**.

### B) Worker service

1. **+ New** → same repo again.
2. Name it `worker`.
3. Dockerfile path: `Dockerfile` (same file as API).
4. **Settings** → **Deploy** → **Start command**:
   ```
   /entrypoint-worker.sh
   ```
5. Same `DATABASE_URL` and `REDIS_URL` references as API.
6. Worker needs **more RAM** (Playwright). In **Settings** → give it at least **2–4 GB** if jobs fail.

### C) Website service

1. **+ New** → same repo again.
2. Name it `web`.
3. Dockerfile path: `Dockerfile.web`
4. **Variables** (runtime — **do not** set `NEXT_PUBLIC_API_URL`; Chrome blocks cross-site session cookies):
   - `API_URL` = `http://api.railway.internal:${{api.PORT}}` (use Railway **Reference** on `api` → **PORT**)
5. **Generate domain** for the website.  
   That URL is what you open in the browser.

---

## Step 4 — Variables (copy-paste files)

Ready-made blocks (edit `CHANGE_ME` and URLs, then **Raw Editor** on each service):

| Service | File |
|---------|------|
| api | [env/railway-api.raw.env](../env/railway-api.raw.env) |
| worker | [env/railway-worker.raw.env](../env/railway-worker.raw.env) |
| web | [env/railway-web.raw.env](../env/railway-web.raw.env) |

`DATABASE_URL` / `REDIS_URL` use `${{Postgres.DATABASE_URL}}` style references — fix service names in Railway if yours differ (e.g. `PostgreSQL` instead of `Postgres`).

## Step 4b — Variables (manual checklist)

Set these on **API** and **Worker** (and shared where noted):

| Variable | What to put |
|----------|-------------|
| `DATABASE_URL` | Reference → Postgres |
| `REDIS_URL` | Reference → Redis |
| `SESSION_ENCRYPTION_KEY` | Any long random string (32+ characters) |
| `AGENCY_ADMIN_USERNAME` | Login username (e.g. `admin`) |
| `AGENCY_ADMIN_PASSWORD` | A strong password you choose |
| `AGENCY_ADMIN_EMAIL` | Optional (not used for login) |
| `DEEPSEEK_API_KEY` | From [DeepSeek](https://platform.deepseek.com) |
| `DEFAULT_LLM_PROVIDER` | `deepseek` |
| `DEFAULT_LLM_MODEL` | `deepseek-chat` |
| `WEB_URL` | **Website** public URL (step C) |
| `NODE_ENV` | `production` |

On **Website** only:

| Variable | What to put |
|----------|-------------|
| `API_URL` | `http://api.railway.internal:${{api.PORT}}` (Reference **api** PORT) |

Remove `NEXT_PUBLIC_API_URL` if you added it earlier, then **redeploy web**. The site calls `/auth/...` on the **same domain** as the UI (proxied to api).

**Chrome stuck on login?** Usually `NEXT_PUBLIC_API_URL` pointing at a separate api URL — remove it and set `API_URL` only.

---

## Step 5 — First login

1. Open your **website** URL.
2. Log in with `AGENCY_ADMIN_USERNAME` / `AGENCY_ADMIN_PASSWORD`.

Login uses `AGENCY_ADMIN_USERNAME` / `AGENCY_ADMIN_PASSWORD` on the **api** service. Seed runs automatically when **api** starts.

If login says **`User.username` does not exist**, the database schema is behind the app. Open **api** → **Shell** and run:

```bash
cd /app/packages/db && npx prisma db push --accept-data-loss
cd /app && pnpm --filter @linkedin-agent/db seed
```

Then restart **api** (or redeploy). After a code deploy, **api** should run `db push` automatically on start.

Manual seed only (schema already up to date):

```bash
pnpm --filter @linkedin-agent/db seed
```

---

## Step 6 — LinkedIn

The **“Connect LinkedIn”** button needs a screen. Railway servers have no screen.

**On your own computer** (with the project installed):

```powershell
cd D:\Work\APPS\Likedin
npx pnpm@9.15.0 --filter @linkedin-agent/linkedin login
```

Copy the session it gives you. In the live app: **LinkedIn** → **Advanced** → paste it.

After that, the **worker** on Railway can run automation.

---

## VPS vs Railway (for you)

| | VPS guide | Railway (this guide) |
|--|-----------|----------------------|
| You already have an account? | No | **Yes** |
| Feels like | Rent a server, run Docker yourself | Click boxes in Railway |
| Good if | You like servers | You want simple hosting |

You can **ignore** [VPS-DEPLOY.md](./VPS-DEPLOY.md) if you use Railway.

---

## Still confused?

**Minimum to remember:**

1. One Railway **project**.
2. Postgres + Redis + **api** + **worker** + **web**.
3. Two public URLs: website for you, API for the website to talk to.
4. Paste LinkedIn session once (Advanced), not the Connect button on Railway.

If you want, we can add a `railway.toml` so Railway auto-creates services — say the word and we can do that next.
