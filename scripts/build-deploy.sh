#!/usr/bin/env bash
# Vercel build command (see README → Deploying). Runs database migrations only
# for production builds: preview deployments share the production DATABASE_URL,
# so migrating there would apply unmerged branch migrations to the live schema.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "preview" ]; then
  echo "Preview deployment — skipping payload migrate (see scripts/build-deploy.sh)"
else
  pnpm payload migrate
fi

pnpm build
