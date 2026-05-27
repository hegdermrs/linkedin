#!/bin/sh
set -e
cd /app/packages/db
npx prisma db push --skip-generate 2>/dev/null || npx prisma db push
cd /app
exec node apps/api/dist/index.js
