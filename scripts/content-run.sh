#!/usr/bin/env bash
# One handoff command; credentials stay in this process and private requests.
set -euo pipefail
set +x
cd "$(dirname "$0")/.."
export CI=1 NO_UPDATE_NOTIFIER=1

# Local validation and a real, read-only transport check happen before login.
pnpm exec node --import tsx scripts/content-run.ts "$@" --preflight
for argument in "$@"; do
  case "$argument" in --validate|--preflight) exit 0 ;; esac
done
if [ -z "${MHG_CMS_EMAIL:-}" ]; then
  read -r -p 'CMS email: ' MHG_CMS_EMAIL
fi
if [ -z "${MHG_CMS_PASSWORD:-}" ]; then
  read -r -s -p 'CMS password: ' MHG_CMS_PASSWORD
  echo
fi
export MHG_CMS_EMAIL MHG_CMS_PASSWORD
trap 'unset MHG_CMS_EMAIL MHG_CMS_PASSWORD' EXIT
pnpm exec node --import tsx scripts/content-run.ts "$@"
