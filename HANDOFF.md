# HANDOFF — LinkedIn Outreach Agent

**Purpose:** Single source of truth for agent continuity after refresh or session abort. Read this at session start; update before ending a substantial session.

**Do not edit** the plan file `linkedin_outreach_agent` in `.cursor/plans` — track progress here instead.

**Last updated:** 2026-05-28 (Jim Harshaw voice playbooks integrated)

---

## Project summary

Multi-tenant LinkedIn wrestler outreach platform: Playwright per coach session, LLM personalization from playbooks, state machine from connection → Calendly booking, Next.js dashboard + agency admin.

Monorepo (`pnpm` workspaces): `apps/web`, `apps/api`, `apps/worker`, `packages/{db,agent,linkedin,shared}`.

---

## Current status

### Built (in repo)

| Area | Location | Notes |
|------|----------|--------|
| Monorepo scaffold | root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `docker-compose.yml`, `.env.example`, `README.md` | pnpm 9.15, Node 20+ |
| Database | `packages/db/prisma/schema.prisma` | Tenants, campaigns, prospects, jobs, playbooks, metrics, audit |
| Shared types | `packages/shared` | Zod `PlaybookConfig`, queue job types, `redis.ts` helper |
| Agent / playbook | `packages/agent` | Jim voice: `jim-base-prompt.ts`, `playbooks/jim-wrestlers.ts`, `jim-athletes.ts`, stage inference, conversation insights |
| LinkedIn automation | `packages/linkedin` | Playwright `LinkedInClient`, session encrypt/decrypt, rate limiter, `pnpm login` CLI |
| API | `apps/api/src` | Fastify: auth, tenants, playbook draft/publish/preview, CSV import, dashboard, Calendly webhook, orchestrate enqueue |
| Worker | `apps/worker/src` | BullMQ worker + `orchestrator.ts` (stage machine, job processors) |
| Web — client | `apps/web/src/app` | login, dashboard, prospects, setup (CSV), settings |
| Web — admin | `apps/web/src/app/admin` | tenants, per-tenant playbook/accounts/audit, templates, agency settings |
| Playbook UI | `apps/web/src/components/PlaybookEditor.tsx` | Brand / stages / guardrails tabs |

### Verified working (this session)

- `npx pnpm@9.15.0 --filter @linkedin-agent/web typecheck` — **passes**
- `node_modules` present; prior `pnpm install` succeeded (per prior agent)
- Partial `dist/` outputs exist for `agent`, `linkedin`, `shared`, `db`, `worker`
- `apps/web/.next` present (Next build artifact from earlier attempt)

### Not verified / likely broken

- **`pnpm build` (root) fails** at `packages/shared`: `src/redis.ts` uses `process.env` without `@types/node` in shared package (TS2580). Blocks downstream `api` / `worker` rebuilds in a clean build.
- **`apps/api/dist`** — missing; API package not confirmed built in this session.
- **End-to-end runtime** — Docker + `db:push` + `db:seed` + three dev servers not re-run after abort.
- **LinkedIn Playwright** — selectors are best-effort; needs real account + manual `login` CLI smoke test.
- **Worker rate limiter** — `packages/linkedin` exports limiter; confirm worker job handlers enforce daily caps in production path.

### Prior build issue (may be fixed)

Previous session failed on **`PlaybookEditor`** props: `onSave` / `onPublish` expected `Promise<void>` but `api.savePlaybookDraft` / `api.publishPlaybook` returned `Promise<unknown>`. Web **typecheck now passes** — if `pnpm build` still fails on web, re-check those callbacks or change `fetchApi` return types to `Promise<void>` / `Promise<{ ok: boolean }>`.

### Other type pitfalls (if web build regresses)

- `updateStage` in `PlaybookEditor.tsx` spreads `c.stages[stage]` where stages are a **discriminated union** (`conversing` has `pivotGoals`, `call_offered` has `calendlyUrl`) — strict mode may complain on generic `field: string` updates.

---

## Plan todos (do not edit `.cursor/plans`)

| ID | Status | Evidence |
|----|--------|----------|
| scaffold-monorepo | **done** | Full workspace layout, README, Docker, env template |
| linkedin-playwright | **done** | `packages/linkedin` client, session, CLI login |
| agent-playbook | **done** | `packages/agent` + shared Zod playbook schema |
| orchestrator | **done** | `apps/worker/src/orchestrator.ts` + queue worker |
| api-import | **done** | `apps/api/src/services/csv-import.ts` + multipart route |
| dashboard-mvp | **done** | Client pages: dashboard, prospects, setup, settings |
| admin-panel | **done** | Admin routes + `PlaybookEditor` |

**Remaining work** is polish and green build/runtime, not greenfield scaffolding.

---

## Blockers

1. `packages/shared` build: add `@types/node` devDependency (or remove `process` from shared and pass Redis URL from apps).
2. Confirm full `pnpm build` then `db:push` + `db:seed` with Docker up.
3. Optional: align `api.ts` return types with `PlaybookEditor` callback signatures for clarity.

---

## Next actions (next agent session)

1. Read this file; do **not** modify `.cursor/plans/linkedin_outreach_agent`.
2. Fix `packages/shared` build (`@types/node` or refactor `redis.ts`).
3. Run `Set-Location "D:\Work\APPS\Likedin"; npx pnpm@9.15.0 build` until all 7 workspace packages pass.
4. `docker compose up -d` → `npx pnpm@9.15.0 db:push` → `npx pnpm@9.15.0 db:seed`.
5. Start `dev:api`, `dev:worker`, `dev:web`; smoke-test login (`admin` / `changeme`).
6. Run `npx pnpm@9.15.0 --filter @linkedin-agent/linkedin login`; paste session in Admin → Clients → LinkedIn.
7. Import sample CSV on client Setup; trigger orchestrate; watch worker logs for Playwright/LLM errors.
8. Update this HANDOFF with build/runtime results and any selector or API fixes.

---

## How to run

**One command** (Docker must be running):

```powershell
Set-Location "D:\Work\APPS\Likedin"
npx pnpm@9.15.0 start
```

Or double-click `Start App.bat`. Open http://localhost:3000

Stop: Ctrl+C in that terminal, then `npx pnpm@9.15.0 stop` for Docker.

LinkedIn session capture:

```powershell
npx pnpm@9.15.0 --filter @linkedin-agent/linkedin login
```

**Login:** Removed for now — api uses first agency admin from DB (`getAppUser`). No sign-in page; open `/setup` directly. Re-add auth before a public deploy.

**Typecheck only:** `npx pnpm@9.15.0 typecheck`

---

## Session log

| Date | Agent | Changes |
|------|-------|---------|
| 2026-05-27 | handoff subagent | Created HANDOFF.md + `.cursor/rules/handoff.mdc`; scanned repo; confirmed web typecheck OK; root build fails on `packages/shared` `process` types |
| 2026-05-28 | auth bypass | `DISABLE_AUTH=true` on api: `auth-bypass.ts`, `requireAuth` bypass, `/auth/me` + banner in web; home → `/setup`; `env/railway-api.raw.env` |
| 2026-05-28 | no login | Removed session login; `getAppUser` always; `/login` → `/setup`; dropped `/auth/login` routes |

---

## Key paths

- API entry: `apps/api/src/index.ts`
- Worker entry: `apps/worker/src/index.ts`
- Orchestrator: `apps/worker/src/orchestrator.ts`
- Playbook editor: `apps/web/src/components/PlaybookEditor.tsx`
- Prisma schema: `packages/db/prisma/schema.prisma`
