#!/bin/sh
set -e

echo "==> Applying database schema (prisma db push)..."
cd /app/packages/db
# Required when adding username / making email optional on an existing DB (Prisma safety prompt).
npx prisma db push --accept-data-loss

cd /app
echo "==> Seeding database..."
pnpm --filter @linkedin-agent/db seed || echo "WARN: db seed failed — check AGENCY_ADMIN_* vars"

echo "==> Starting API..."
exec node apps/api/dist/index.js
