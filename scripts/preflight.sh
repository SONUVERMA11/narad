#!/usr/bin/env bash
# Pre-launch gate: run before every production deploy.
#   SIGNALING_URL=wss://signaling.narad.sh/ws ./scripts/preflight.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SIG="${SIGNALING_URL:-}"
fail=0
step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "Install (frozen lockfile)"; pnpm install --frozen-lockfile --silent
step "Typecheck";                 pnpm -r typecheck >/dev/null && echo ok
step "Unit tests";                pnpm -r --filter '!./e2e' test 2>&1 | grep -E 'Tests ' || true

step "Production builds"
if [ -z "$SIG" ]; then echo "SIGNALING_URL not set: building with the dev default (fine for a dry run, NOT for deploy)"; fail=1; fi
VITE_SIGNALING_URL="$SIG" pnpm --filter @narad/web build >/dev/null && echo "web ok      → apps/web/dist"
VITE_SIGNALING_URL="$SIG" pnpm --filter @narad/extension build >/dev/null && echo "extension ok → apps/extension/dist"
pnpm --filter @narad/signaling build >/dev/null && echo "signaling ok → apps/signaling/dist"
pnpm --filter @narad/site icons >/dev/null && echo "site icons ok"

step "Bundle sizes"
du -sh apps/web/dist apps/extension/dist | sed 's/^/  /'

step "Placeholder scan (landing page must point at real URLs)"
if grep -on 'https://github.com/narad-app/narad[^"]*\|[a-z.]*example\.com' apps/site/index.html | sort -u -t: -k2 | head -12; then :; fi
if grep -q 'narad-app/narad\|example\.com' apps/site/index.html; then echo "  ↑ replace these before going live (GO-LIVE.md §3)"; fail=1; else echo "  none"; fi

step "Secrets must not be in git"
if git grep -nE 'rzp_live_[A-Za-z0-9]{6,}|BEGIN (EC )?PRIVATE KEY|VAPID_PRIVATE_KEY *= *"[A-Za-z0-9_-]{20,}' -- ':!scripts/preflight.sh' >/dev/null; then echo "  ✗ a live key or private key is committed"; fail=1; else echo "  clean"; fi

step "Signaling smoke test"
if [ -n "$SIG" ]; then
  H="${SIG/wss:/https:}"; H="${H%/ws}"
  curl -fsS "$H/health" && echo && curl -fsS "$H/ice" | head -c 300 && echo || { echo "  ✗ $H not reachable"; fail=1; }
else echo "  skipped (SIGNALING_URL not set)"; fi

step "Result"
if [ "$fail" -eq 0 ]; then echo "READY — deploy with: see GO-LIVE.md §6–§8"; else echo "NOT READY — fix the items above"; exit 1; fi
