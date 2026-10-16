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
# A hidden prompt shows nothing either way, so an answer that did not land (a
# paste that missed) looks like one that did: ask again, three times at most.
ask() { # <variable> <what> <prompt> [hidden]
  local name=$1 what=$2 prompt=$3 hidden=${4:-} tries=0
  until [ -n "${!name:-}" ]; do
    if [ "$tries" -eq 3 ]; then
      echo "No CMS $what entered; nothing was written." >&2
      exit 1
    fi
    [ "$tries" -eq 0 ] || echo "No $what entered; try again." >&2
    tries=$((tries + 1))
    read -r ${hidden:+-s} -p "$prompt" "$name" || true
    [ -z "$hidden" ] || echo
  done
}
ask MHG_CMS_EMAIL email 'CMS email: '
ask MHG_CMS_PASSWORD password 'CMS password: ' hidden
export MHG_CMS_EMAIL MHG_CMS_PASSWORD
trap 'unset MHG_CMS_EMAIL MHG_CMS_PASSWORD' EXIT
pnpm exec node --import tsx scripts/content-run.ts "$@"
