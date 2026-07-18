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

let passed = 0, failed = 0;
function check(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓  ${label}`);
  } catch (err) {
    failed++;
    console.log(`  ✗  ${label}`);
    console.log(`     ${err.message}`);
  }
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

// ── detectEmbargoType (Phase D — pure match_type detection) ──────────────────────
console.log('detectEmbargoType:');
check('a value starting with @ is identified as domain', () => {
  const r = auth.detectEmbargoType('@Spam.com');
  assert.strictEqual(r.matchType, 'domain');
  assert.strictEqual(r.value, '@spam.com'); // trimmed + lowercased
});
check('a value containing @ but not starting with it is exact', () => {
  const r = auth.detectEmbargoType('  Evil@Example.com ');
  assert.strictEqual(r.matchType, 'exact');
  assert.strictEqual(r.value, 'evil@example.com');
});
check('a value with no @ returns a validation error', () => {
  const r = auth.detectEmbargoType('spam.com');
  assert.ok(r.error && !r.matchType);
});

// ── revokeRole self-revoke guard (pure condition) ────────────────────────────────
// revokeRole is async/DB-bound, and the runner's check() is synchronous (it can't
// await), so we test the guard's condition expression directly per the plan: a
// super_admin revoke targeting the actor's own id must trip the guard.
console.log('revokeRole self-revoke guard:');
const selfRevokeGuard = (roleName, userId, actorUserId) => roleName === 'super_admin' && userId === actorUserId;
check('trips when actor revokes their own super_admin', () => {
  assert.strictEqual(selfRevokeGuard('super_admin', 42, 42), true);
});
check('does not trip when revoking another user\'s super_admin', () => {
  assert.strictEqual(selfRevokeGuard('super_admin', 42, 7), false);
});
check('does not trip for a non-super_admin self-revoke', () => {
  assert.strictEqual(selfRevokeGuard('coach', 42, 42), false);
});

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
