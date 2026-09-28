#!/usr/bin/env bash
# Resets the shared local Postgres + Redis to a known-clean, freshly-seeded state before an e2e run.
#
# Why this exists (Phase 9): backend Jest e2e and frontend Playwright both run against the same live
# Postgres/Redis (no per-suite database). Before this script, the only defence against contamination was a
# manually-followed ordering rule ("run Jest before Playwright, or reset by hand in between" — see
# docs/PROGRESS.md's Phase 5 environment-quirk note). This script is invoked automatically from both
# apps/api/test/global-setup.ts and apps/web/e2e/global-setup.ts, so every suite run starts from the same
# clean state regardless of run order — the manual-ordering rule is no longer required.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[reset-test-env] resetting database (migrate reset --force + seed)..."
pnpm --filter @buisnez/database db:reset-test

echo "[reset-test-env] flushing Redis (clears cached search/discovery results and rate-limit buckets)..."
docker compose exec -T redis redis-cli FLUSHALL >/dev/null

echo "[reset-test-env] done."
