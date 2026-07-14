#!/usr/bin/env node
/*
 * Reusable local-DB launcher for Coach Portal PR smoke tests.
 *
 * Problem it solves: app/server.js runs `require('dotenv').config({ override: true })`,
 * which loads app/.env (pointed at PRODUCTION) and overrides anything set in the shell.
 * We must NOT edit app/.env. This launcher:
 *   1. Loads app/.env first (so ANTHROPIC_API_KEY, SENDGRID_*, SESSION_SECRET, etc.
 *      are available) — without override.
 *   2. Loads .env.dev.local with override, forcing DATABASE_URL at the LOCAL Postgres.
 *   3. Neutralizes server.js's own dotenv.config({override:true}) (same cached module
 *      object) so it can't re-apply app/.env's prod DATABASE_URL.
 *   4. chdir into app/ (server.js uses CWD-relative express.static('public')).
 *   5. Boots server.js — db.initDb() then runs SCHEMA_SQL/SEED_SQL against the LOCAL DB.
 *
 * Usage:  node scripts/dev-local.js        (from repo root)
 * See README "Local dev database" for one-time Postgres setup.
 */
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const appDir   = path.join(repoRoot, 'app');
const dotenv   = require(path.join(appDir, 'node_modules', 'dotenv'));

// 1) Prod/shared non-DB keys from app/.env (no override — don't clobber anything preset).
dotenv.config({ path: path.join(appDir, '.env') });
// 2) Local overrides win — DATABASE_URL -> local Postgres.
dotenv.config({ path: path.join(repoRoot, '.env.dev.local'), override: true });

if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) {
  console.error('[dev-local] REFUSING TO BOOT: DATABASE_URL is not local:', process.env.DATABASE_URL);
  process.exit(1);
}

// 3) Stop server.js's line-15 dotenv.config({override:true}) from reloading app/.env.
dotenv.config = () => ({ parsed: {} });

// 4) express.static('public') is CWD-relative.
process.chdir(appDir);

console.log('[dev-local] booting server.js against', process.env.DATABASE_URL);
require(path.join(appDir, 'server.js'));
