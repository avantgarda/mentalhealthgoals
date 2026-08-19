#!/usr/bin/env bash
# Fails if src/payload-types.ts is out of date with the Payload config.
# Restores the committed file afterwards so the working tree stays clean.
set -euo pipefail
cd "$(dirname "$0")/.."

TYPES=src/payload-types.ts

cp "$TYPES" "$TYPES.orig"
trap 'mv -f "$TYPES.orig" "$TYPES"' EXIT

pnpm generate:types >/dev/null

if ! diff -q "$TYPES.orig" "$TYPES" >/dev/null; then
  echo "✗ $TYPES is out of date with the Payload config." >&2
  echo "  Run 'pnpm generate:types' and commit the result." >&2
  exit 1
fi

echo "✓ payload-types.ts is in sync with the Payload config"
