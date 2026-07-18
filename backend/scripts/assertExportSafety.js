// backend/scripts/assertExportSafety.js
// Standalone guard (no DB connection): inspects the snapshot export whitelist in
// jobs/snapshots.js and FAILS the build (exit 1) if sensitive collections would
// ever leave the database. Wired as `npm run check:exports`.
//
// Rules:
//   1. No dataset key may be ChangeRequest, SecurityEvent, or any Feedback*
//      model (bcrypt hashes / security data / feedback PII).
//   2. The User export MUST exclude password, loginAttempts and lockUntil.
const { WHITELIST } = require('../jobs/snapshots');

const failures = [];
const keys = Object.keys(WHITELIST || {});

// Rule 1 — forbidden collections.
const forbidden = keys.filter(k =>
  k === 'ChangeRequest' || k === 'SecurityEvent' || /^Feedback/.test(k));
if (forbidden.length) {
  failures.push(`Forbidden datasets present in whitelist: ${forbidden.join(', ')}`);
}

// Rule 2 — User projection must drop credential/lockout internals.
const userSelect = (WHITELIST.User && WHITELIST.User.select) || '';
const userTokens = userSelect.split(/\s+/).filter(Boolean);
const REQUIRED_USER_EXCLUSIONS = ['password', 'loginAttempts', 'lockUntil'];
const missingExclusions = REQUIRED_USER_EXCLUSIONS.filter(f => !userTokens.includes('-' + f));
if (!WHITELIST.User) {
  failures.push('User dataset is missing from the whitelist (cannot verify projection).');
} else if (missingExclusions.length) {
  failures.push(`User projection does not exclude: ${missingExclusions.join(', ')} (select="${userSelect}")`);
}

if (failures.length) {
  console.error('✗ Export-safety check FAILED:');
  failures.forEach(f => console.error('  - ' + f));
  process.exit(1);
}

console.log('✓ Export-safety check passed.');
console.log(`  Datasets (${keys.length}): ${keys.join(', ')}`);
console.log(`  User projection: ${userSelect}`);
process.exit(0);
