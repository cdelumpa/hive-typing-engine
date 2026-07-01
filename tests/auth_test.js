'use strict';

// Unit tests for the pure (non-DB) functions in app/auth.js.
// Run with: node tests/auth_test.js   (no test framework; Node's assert only)
//
// Requiring app/auth.js pulls in app/db.js, which only creates a pg pool when
// DATABASE_URL is set — unset in the test environment, so no connection is made
// and the pure functions under test never touch a database.

const assert = require('assert');
const path = require('path');
const auth = require(path.join(__dirname, '..', 'app', 'auth'));

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log(`  ✓  ${label}`);
}

console.log('\n=== auth.js unit tests ===\n');

// ── validatePasswordStrength ────────────────────────────────────────────────────
console.log('validatePasswordStrength:');
check('rejects passwords under 10 characters', () => {
  const r = auth.validatePasswordStrength('Ab3');
  assert.strictEqual(r.valid, false);
  assert.match(r.reason, /10 characters/);
});
check('rejects passwords with no uppercase letter', () => {
  const r = auth.validatePasswordStrength('lowercase9x');
  assert.strictEqual(r.valid, false);
  assert.match(r.reason, /uppercase/);
});
check('rejects passwords with no number', () => {
  const r = auth.validatePasswordStrength('NoNumbersHere');
  assert.strictEqual(r.valid, false);
  assert.match(r.reason, /number/);
});
check('accepts a valid password', () => {
  const r = auth.validatePasswordStrength('Correct9Horse');
  assert.strictEqual(r.valid, true);
});

// ── checkAccountLock ────────────────────────────────────────────────────────────
console.log('checkAccountLock:');
check('returns false when locked_until is null', () => {
  assert.strictEqual(auth.checkAccountLock({ locked_until: null }), false);
});
check('returns false when locked_until is in the past', () => {
  const past = new Date(Date.now() - 60 * 1000).toISOString();
  assert.strictEqual(auth.checkAccountLock({ locked_until: past }), false);
});
check('returns true when locked_until is in the future', () => {
  const future = new Date(Date.now() + 60 * 1000).toISOString();
  assert.strictEqual(auth.checkAccountLock({ locked_until: future }), true);
});

// ── hasRole ─────────────────────────────────────────────────────────────────────
console.log('hasRole:');
check('returns false when req.session.roles is undefined', () => {
  assert.strictEqual(auth.hasRole({ session: {} }, 'admin'), false);
});
check('returns false when role is not in the array', () => {
  assert.strictEqual(auth.hasRole({ session: { roles: ['client', 'coach'] } }, 'admin'), false);
});
check('returns true when role is in the array', () => {
  assert.strictEqual(auth.hasRole({ session: { roles: ['client', 'admin'] } }, 'admin'), true);
});

// ── checkResetRateLimit ─────────────────────────────────────────────────────────
console.log('checkResetRateLimit:');
check('first 3 requests for an email are under the limit', () => {
  const email = 'rate-a@example.com';
  assert.strictEqual(auth.checkResetRateLimit(email), false);
  assert.strictEqual(auth.checkResetRateLimit(email), false);
  assert.strictEqual(auth.checkResetRateLimit(email), false);
});
check('4th request for the same email exceeds the limit', () => {
  // rate-a already has 3 hits from the previous test; the 4th trips it.
  assert.strictEqual(auth.checkResetRateLimit('rate-a@example.com'), true);
});
check('a different email is unaffected by another email\'s count', () => {
  assert.strictEqual(auth.checkResetRateLimit('rate-b@example.com'), false);
});

// ── reset-token helpers (async, DB-bound — smoke-check only) ─────────────────────
console.log('validateResetToken:');
check('returns a promise and does not throw synchronously', () => {
  const p = auth.validateResetToken('not-a-real-token');
  assert.ok(p && typeof p.then === 'function');
  p.catch(() => {}); // no DB in the test env; swallow any async rejection
});

console.log(`\n=== RESULT: ${passed} passed, 0 failed ===\n`);
process.exit(0);
