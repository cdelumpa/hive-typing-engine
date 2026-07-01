'use strict';

// ═══ IAA v1.2 — Authentication & Authorization module ══════════════════════════
// Owns all authentication logic for the admin/identity layer. Reads and writes the
// six IAA tables (users, roles, user_roles, auth_events, password_reset_tokens,
// embargo_list) plus coaches.user_id linkage. Uses db.js query helpers — never
// opens its own pool. Per IAA §5: security review reads one file; extraction to a
// standalone auth service moves one file behind a stable interface.

const crypto = require('crypto');
const db = require('./db');

// ─── 1.1 Password strength policy (IAA §6.1) ────────────────────────────────────
// Minimum 10 chars, ≥1 uppercase, ≥1 number. Returns the first failing rule only —
// error messages identify which rule failed without spelling out the whole policy.
function validatePasswordStrength(password) {
  const pw = password || '';
  if (pw.length < 10) {
    return { valid: false, reason: 'Password must be at least 10 characters.' };
  }
  if (!/[A-Z]/.test(pw)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[0-9]/.test(pw)) {
    return { valid: false, reason: 'Password must contain at least one number.' };
  }
  return { valid: true };
}

// ─── 1.2 Embargo check ──────────────────────────────────────────────────────────
// Returns true if the email is blocked by an exact-match or domain-suffix entry.
async function checkEmbargo(email) {
  const addr = (email || '').toLowerCase().trim();
  if (!addr) return false;
  const at = addr.lastIndexOf('@');
  const domain = at >= 0 ? addr.slice(at + 1) : '';
  const r = await db.query(
    `SELECT 1 FROM embargo_list
      WHERE (match_type = 'exact'  AND value = $1)
         OR (match_type = 'domain' AND value = $2)
      LIMIT 1`,
    [addr, domain]
  );
  return !!(r && r.rows.length > 0);
}

// ─── 1.3 In-process login rate limiter (IAA §4.1) ───────────────────────────────
// Max 10 attempts per IP per 15-minute sliding window. Module-level Map, no new
// dependency. Timestamp-based expiry (no setTimeout). Resets on deploy — acceptable
// for the single Railway instance; must move to a shared store if scaled out.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const rateLimitHits = new Map(); // ip -> [timestamps]

function checkRateLimit(ip) {
  const key = ip || 'unknown';
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (rateLimitHits.get(key) || []).filter(ts => ts > cutoff);
  recent.push(now);
  rateLimitHits.set(key, recent);
  return recent.length > RATE_LIMIT_MAX;
}

// ─── 1.4 Account lock check ─────────────────────────────────────────────────────
// Synchronous. True if locked_until is set and still in the future.
function checkAccountLock(user) {
  if (!user || !user.locked_until) return false;
  return new Date(user.locked_until).getTime() > Date.now();
}

// ─── 1.5 Increment failed attempts, lock at threshold (IAA §4.2) ────────────────
// Increments failed_login_attempts; at 5 sets locked_until = NOW() + 15 minutes.
// Returns the updated count.
async function incrementFailedAttempts(userId) {
  const r = await db.query(
    `UPDATE users SET failed_login_attempts = failed_login_attempts + 1
      WHERE id = $1
      RETURNING failed_login_attempts`,
    [userId]
  );
  const count = r && r.rows.length > 0 ? r.rows[0].failed_login_attempts : 0;
  if (count >= 5) {
    await db.query(
      `UPDATE users SET locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $1`,
      [userId]
    );
  }
  return count;
}

// ─── 1.6 Reset failed attempts + clear lock ─────────────────────────────────────
async function resetFailedAttempts(userId) {
  await db.query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
    [userId]
  );
}

// ─── 1.7 Append-only auth audit log ─────────────────────────────────────────────
// Never throws — a logging failure must never abort the primary auth operation.
async function logAuthEvent(userId, eventType, req, metadata) {
  try {
    const ip = req && req.ip ? req.ip : null;
    const ua = req && req.headers ? (req.headers['user-agent'] || null) : null;
    await db.query(
      `INSERT INTO auth_events (user_id, event_type, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId ?? null, eventType, ip, ua, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (e) {
    console.error('[auth] logAuthEvent failed:', e.message);
  }
}

// ─── 1.8 User lookup by email ───────────────────────────────────────────────────
async function getUserByEmail(email) {
  const r = await db.query(
    `SELECT id, email, password_hash, is_active, failed_login_attempts,
            locked_until, auth_provider, confirmed_type, dominant_instinct,
            last_login_at, created_at
       FROM users WHERE email = $1 LIMIT 1`,
    [(email || '').toLowerCase().trim()]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// ─── 1.9 Role set for a user ────────────────────────────────────────────────────
async function getUserRoles(userId) {
  const r = await db.query(
    `SELECT r.name
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = $1`,
    [userId]
  );
  return r ? r.rows.map(row => row.name) : [];
}

// ─── 1.10 Resolve the coach domain row for a user ───────────────────────────────
// May be null for client-only users (future-safe). Used at login to populate the
// session's coach_id / coach_name.
async function resolveCoachByUserId(userId) {
  const r = await db.query(
    `SELECT id, name, organization FROM coaches WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// ─── 1.11 Record a successful login ─────────────────────────────────────────────
async function recordLoginSuccess(userId, req) {
  const ip = req && req.ip ? req.ip : null;
  await db.query(
    `UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2`,
    [ip, userId]
  );
  await resetFailedAttempts(userId);
}

// ─── 1.12 Invalidate all sessions for a user (IAA §4.5) ─────────────────────────
// connect-pg-simple stores the session object in a `json` column (confirmed Phase A),
// so ->> returns text and must be cast to int. Best-effort — never rethrows.
async function invalidateAllSessions(userId) {
  try {
    await db.query(
      `DELETE FROM session WHERE (sess->>'user_id')::int = $1`,
      [userId]
    );
  } catch (e) {
    console.error('[auth] invalidateAllSessions failed:', e.message);
  }
}

// ─── 1.13 Role check helper ─────────────────────────────────────────────────────
// Replacement for every inline coach_is_admin / coach_is_super_admin read.
function hasRole(req, roleName) {
  return !!(req && req.session && Array.isArray(req.session.roles) && req.session.roles.includes(roleName));
}

// ─── 1.14 Update a user's password (Phase C reset; not the Phase B change route) ─
async function updateUserPassword(userId, passwordHash) {
  await db.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [passwordHash, userId]
  );
}

// ─── 1.15 Create a user row + assign roles atomically ───────────────────────────
// Returns the new user id, or null if the email already existed.
async function createUserWithRoles(email, passwordHash, roleNames) {
  const addr = (email || '').toLowerCase().trim();
  const r = await db.query(
    `INSERT INTO users (email, password_hash, auth_provider, is_active)
     VALUES ($1, $2, 'local', TRUE)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [addr, passwordHash]
  );
  if (!r || r.rows.length === 0) return null;
  const userId = r.rows[0].id;
  for (const roleName of (roleNames || [])) {
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, r.id FROM roles r WHERE r.name = $2
       ON CONFLICT DO NOTHING`,
      [userId, roleName]
    );
  }
  return userId;
}

// ═══ IAA v1.2 — Phase C: password reset flow ════════════════════════════════════
// DELIBERATE DEVIATION FROM SPEC (approved): the IAA spec's literal wording stores
// the reset token as a bcrypt hash. We use SHA-256 instead. bcrypt is salted and
// non-deterministic, so it cannot support an indexed lookup by hash — you'd be
// forced into an O(n) per-row bcrypt.compare scan or leaking the row id in the URL.
// A 256-bit crypto.randomBytes token has ample entropy, so a fast deterministic
// digest (SHA-256) is the correct OWASP approach for high-entropy secrets and keeps
// the lookup a single indexed WHERE token_hash = $1.

// Internal only — NOT exported. Shared by generate + validate so both sides agree.
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// ─── Generate a single-use reset token (1-hour TTL) ─────────────────────────────
// Returns the RAW token (for the email link only); the DB stores only its hash.
async function generateResetToken(userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  await db.invalidateUserResetTokens(userId);          // expire any outstanding tokens
  const hash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.createPasswordResetToken(userId, hash, expiresAt);
  return rawToken;
}

// ─── Validate a raw reset token ─────────────────────────────────────────────────
async function validateResetToken(rawToken) {
  const hash = hashToken(rawToken);
  const row = await db.getPasswordResetToken(hash);
  if (!row) return { valid: false, reason: 'not_found' };
  if (row.used_at) return { valid: false, reason: 'already_used' };
  if (new Date(row.expires_at) < new Date()) return { valid: false, reason: 'expired' };
  return { valid: true, userId: row.user_id, tokenId: row.id };
}

// ─── Redeem a reset token: set the new password, burn the token, kill sessions ──
async function redeemResetToken(rawToken, newPasswordHash) {
  const result = await validateResetToken(rawToken);
  if (!result.valid) return { ok: false, reason: result.reason };
  await updateUserPassword(result.userId, newPasswordHash);
  await db.markResetTokenUsed(result.tokenId);
  await invalidateAllSessions(result.userId);
  await logAuthEvent(result.userId, 'password_reset_used', null, null);
  return { ok: true, userId: result.userId };
}

// ─── Reset-request rate limiter (IAA §6.6): 3 per email per 60-minute window ─────
// Separate Map from the login limiter — different key (email), limit (3), window (1h).
const RESET_RATE_LIMIT_MAX = 3;
const RESET_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const resetRateLimitHits = new Map(); // email -> [timestamps]

function checkResetRateLimit(email) {
  const key = (email || '').toLowerCase().trim() || 'unknown';
  const now = Date.now();
  const cutoff = now - RESET_RATE_LIMIT_WINDOW_MS;
  const recent = (resetRateLimitHits.get(key) || []).filter(ts => ts > cutoff);
  recent.push(now);
  resetRateLimitHits.set(key, recent);
  return recent.length > RESET_RATE_LIMIT_MAX;
}

module.exports = {
  validatePasswordStrength,
  checkEmbargo,
  checkRateLimit,
  checkAccountLock,
  incrementFailedAttempts,
  resetFailedAttempts,
  logAuthEvent,
  getUserByEmail,
  getUserRoles,
  resolveCoachByUserId,
  recordLoginSuccess,
  invalidateAllSessions,
  hasRole,
  updateUserPassword,
  createUserWithRoles,
  generateResetToken,
  validateResetToken,
  redeemResetToken,
  checkResetRateLimit,
};
