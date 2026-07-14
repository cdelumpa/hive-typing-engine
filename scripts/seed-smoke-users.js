#!/usr/bin/env node
/*
 * Reusable smoke-test user seeder (LOCAL DB ONLY).
 * Creates one user per role combination with a shared known password, so PR smoke
 * tests can exercise real login POSTs. For coach-role users it also creates a
 * coaches row linked via coaches.user_id (mirrors resolveCoachByUserId at login).
 *
 * Usage:  node scripts/seed-smoke-users.js
 * Password for every seeded user: Smoke!test1   (meets IAA §6.1: 10+ chars, upper, number)
 * Idempotent: ON CONFLICT DO NOTHING, safe to re-run.
 */
const path = require('path');
const repoRoot = path.join(__dirname, '..');
const appDir = path.join(repoRoot, 'app');
const dotenv = require(path.join(appDir, 'node_modules', 'dotenv'));
dotenv.config({ path: path.join(repoRoot, '.env.dev.local'), override: true });

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) {
  console.error('[seed] REFUSING: DATABASE_URL is not local:', process.env.DATABASE_URL);
  process.exit(1);
}

const db = require(path.join(appDir, 'db'));
const auth = require(path.join(appDir, 'auth'));
const bcrypt = require(path.join(appDir, 'node_modules', 'bcrypt'));

const PASSWORD = 'Smoke!test1';
const USERS = [
  { email: 'smoke-admin@local.test',       roles: ['admin'],                name: null },
  { email: 'smoke-superadmin@local.test',  roles: ['super_admin'],          name: null },
  { email: 'smoke-coach@local.test',       roles: ['coach'],                name: 'Coach Only' },
  { email: 'smoke-coach-admin@local.test', roles: ['coach', 'admin'],       name: 'Coach Admin' },
  { email: 'smoke-coach-super@local.test', roles: ['coach', 'super_admin'], name: 'Coach Super' },
  { email: 'smoke-client@local.test',      roles: ['client'],               name: null },
  { email: 'smoke-noroles@local.test',     roles: [],                       name: null },
];

(async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const u of USERS) {
    let userId = await auth.createUserWithRoles(u.email, hash, u.roles);
    if (userId === null) {
      const r = await db.query('SELECT id FROM users WHERE email = $1', [u.email]);
      userId = r.rows[0].id;
      // ensure password + roles even on re-run
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
      for (const roleName of u.roles) {
        await db.query(
          `INSERT INTO user_roles (user_id, role_id) SELECT $1, r.id FROM roles r WHERE r.name = $2 ON CONFLICT DO NOTHING`,
          [userId, roleName]);
      }
    }
    if (u.name) {
      await db.query(
        `INSERT INTO coaches (name, email, user_id) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id`,
        [u.name, u.email, userId]);
    }
    console.log(`seeded ${u.email.padEnd(32)} roles=[${u.roles.join(',') || '(none)'}] userId=${userId}`);
  }
  console.log(`\nAll seeded. Password for every user: ${PASSWORD}`);
  process.exit(0);
})().catch(e => { console.error('[seed] error:', e); process.exit(1); });
