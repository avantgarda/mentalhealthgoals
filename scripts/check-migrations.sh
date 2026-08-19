#!/usr/bin/env bash
# Verifies that the committed migrations (src/migrations) produce exactly the
# same schema as Payload's dev-mode push. If someone changes a collection
# without running `pnpm payload migrate:create`, this fails — before the
# mismatch can break a production deploy.
#
# Needs: psql + pg_dump on PATH, and a Postgres server it may create scratch
# databases on. Defaults to localhost; override with MIGRATION_CHECK_BASE_URL,
# e.g. postgresql://postgres:postgres@localhost:5432
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_URL="${MIGRATION_CHECK_BASE_URL:-postgresql://localhost:5432}"
SUFFIX="$(date +%s)_$$"
DB_MIGRATE="mhg_check_migrate_${SUFFIX}"
DB_PUSH="mhg_check_push_${SUFFIX}"
export PAYLOAD_SECRET="${PAYLOAD_SECRET:-migration-check}"

cleanup() {
  psql "${BASE_URL}/postgres" -qc "DROP DATABASE IF EXISTS ${DB_MIGRATE};" || true
  psql "${BASE_URL}/postgres" -qc "DROP DATABASE IF EXISTS ${DB_PUSH};" || true
}
trap cleanup EXIT

psql "${BASE_URL}/postgres" -qc "CREATE DATABASE ${DB_MIGRATE};"
psql "${BASE_URL}/postgres" -qc "CREATE DATABASE ${DB_PUSH};"

echo "— Running committed migrations against ${DB_MIGRATE}..."
DATABASE_URL="${BASE_URL}/${DB_MIGRATE}" NODE_ENV=production pnpm payload migrate >/dev/null

echo "— Push-syncing the live Payload config against ${DB_PUSH}..."
DATABASE_URL="${BASE_URL}/${DB_PUSH}" NODE_ENV=development \
  pnpm exec tsx scripts/push-schema.ts >/dev/null

dump() {
  # payload_migrations table exists only on the migrated DB; drizzle push
  # bookkeeping only on the pushed one — exclude both plus dump preamble noise.
  # Trailing commas are stripped so column *order* differences (ALTER TABLE ADD
  # in a migration vs CREATE TABLE order in push) don't register as drift.
  pg_dump --schema-only --no-owner --no-privileges \
    --exclude-table 'payload_migrations*' \
    --exclude-schema 'drizzle' \
    "$1" | grep -vE '^(--|$|SET |SELECT pg_catalog|\\(un)?restrict)' | sed 's/,$//'
}

echo "— Comparing schemas..."
if ! diff <(dump "${BASE_URL}/${DB_MIGRATE}" | sort) <(dump "${BASE_URL}/${DB_PUSH}" | sort); then
  echo "" >&2
  echo "✗ Schema drift: the Payload config defines schema that the committed" >&2
  echo "  migrations do not produce (or vice versa)." >&2
  echo "  Run 'pnpm payload migrate:create <name>' and commit the result." >&2
  exit 1
fi

echo "✓ Committed migrations match the Payload config schema"
