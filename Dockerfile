# API + Worker (Playwright for LinkedIn automation)
FROM node:20-bookworm AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @linkedin-agent/db generate
RUN pnpm --filter @linkedin-agent/db build
RUN pnpm --filter @linkedin-agent/shared build
RUN pnpm --filter @linkedin-agent/agent build
RUN pnpm --filter @linkedin-agent/linkedin build
RUN pnpm --filter @linkedin-agent/api build
RUN pnpm --filter @linkedin-agent/worker build

FROM mcr.microsoft.com/playwright:v1.49.1-noble AS runner

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/apps/worker ./apps/worker
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY docker/entrypoint-api.sh /entrypoint-api.sh
COPY docker/entrypoint-worker.sh /entrypoint-worker.sh
RUN chmod +x /entrypoint-api.sh /entrypoint-worker.sh

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
