#!/bin/sh
cd /app/packages/db
npx prisma db push --skip-generate 2>/dev/null || npx prisma db push || echo "WARN: prisma db push failed — check DATABASE_URL"
cd /app
exec node apps/api/dist/index.js
