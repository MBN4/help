// Plain JS (not ts-jest-transformed) so Jest can load it directly as `globalSetup`, no ts-node needed.
// Runs once before the whole e2e suite — see scripts/reset-test-env.sh for why.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

module.exports = function globalSetup() {
  if (process.env.E2E_SKIP_RESET === '1') {
    return;
  }
  execFileSync(
    'bash',
    [path.join(__dirname, '../../../scripts/reset-test-env.sh')],
    { stdio: 'inherit' },
  );
};
