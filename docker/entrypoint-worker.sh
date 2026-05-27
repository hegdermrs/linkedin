#!/bin/sh
set -e
# Headless Chromium on VPS (no display). LinkedIn login uses "paste session" in admin UI.
exec node apps/worker/dist/index.js
