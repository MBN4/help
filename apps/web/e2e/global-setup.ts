import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Runs once before the whole Playwright suite. Resets Postgres + Redis to a known-clean, freshly-seeded
// state so this suite never depends on run order relative to the backend Jest e2e suite (or a prior manual
// browser session) — see scripts/reset-test-env.sh for the full rationale.
//
// Skippable via E2E_SKIP_RESET=1 for fast local iteration on a single spec when you know the DB is already
// in the state you want (e.g. re-running one spec after a fix, without wiping fixtures you just inspected).
export default function globalSetup(): void {
  if (process.env.E2E_SKIP_RESET === '1') {
    return;
  }
  execFileSync(
    'bash',
    [path.join(__dirname, '../../../scripts/reset-test-env.sh')],
    {
      stdio: 'inherit',
    },
  );
}
