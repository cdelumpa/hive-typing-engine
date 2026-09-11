'use strict';
/**
 * Local development must not default to the production database (env-safety PR).
 *
 * app/env_guard.js decides; app/server.js must ask it before anything reaches the database. The
 * decision is tested directly. The ordering is tested by reading server.js, which no test can load
 * (it calls app.listen() at require time) — and which, run from app/, would load the production URL.
 * The boot itself is proved in the build report against a fake non-local host, never a real one.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const G = require(path.join(ROOT, 'app/env_guard.js'));

const PROD_LIKE = 'postgresql://user:secret@switchyard.proxy.rlwy.net:51043/railway';
const LOCAL = 'postgresql://someone@localhost:5432/hive_typing_local';

test('a local database, or none at all, boots', () => {
  for (const u of [LOCAL, 'postgresql://u@127.0.0.1:5432/x', 'postgresql://u@[::1]:5432/x', 'postgres://localhost/x']) {
    assert.strictEqual(G.checkDatabaseTarget({ databaseUrl: u }).ok, true, u);
  }
  assert.strictEqual(G.checkDatabaseTarget({ databaseUrl: undefined }).ok, true);
  assert.strictEqual(G.checkDatabaseTarget({ databaseUrl: '' }).ok, true);
});

test('a non-local database is refused, naming the host and the safe way in', () => {
  const v = G.checkDatabaseTarget({ databaseUrl: PROD_LIKE, outsideEnv: {} });
  assert.strictEqual(v.ok, false);
  assert.match(v.message, /REFUSING TO BOOT/);
  assert.match(v.message, /switchyard\.proxy\.rlwy\.net/);
  assert.match(v.message, /node scripts\/dev-local\.js/);
  assert.doesNotMatch(v.message, /secret/, 'the refusal must never print the password');
});

test('a host that merely contains "localhost" is not local, and an unreadable URL is not local', () => {
  assert.strictEqual(G.checkDatabaseTarget({ databaseUrl: 'postgresql://u@localhost.evil.example:5432/x' }).ok, false);
  assert.strictEqual(G.checkDatabaseTarget({ databaseUrl: 'postgresql://u@db.example/localhost' }).ok, false);
  assert.strictEqual(G.checkDatabaseTarget({ databaseUrl: 'not a url at all' }).ok, false);
});

test('on Railway, any one documented system variable is enough', () => {
  for (const k of G.RAILWAY_MARKERS) {
    const v = G.checkDatabaseTarget({ databaseUrl: PROD_LIKE, outsideEnv: { [k]: 'x' } });
    assert.strictEqual(v.ok, true, k);
    assert.match(v.why, new RegExp(k));
  }
});

test('an explicit opt-in boots, and says so loudly; anything but "1" is not an opt-in', () => {
  const v = G.checkDatabaseTarget({ databaseUrl: PROD_LIKE, outsideEnv: { ALLOW_NONLOCAL_DATABASE: '1' } });
  assert.strictEqual(v.ok, true);
  assert.match(v.note, /WARNING: ALLOW_NONLOCAL_DATABASE=1 .*switchyard\.proxy\.rlwy\.net/);
  for (const val of ['true', 'yes', '0', '']) {
    assert.strictEqual(G.checkDatabaseTarget({ databaseUrl: PROD_LIKE, outsideEnv: { ALLOW_NONLOCAL_DATABASE: val } }).ok, false, val);
  }
});

test('server.js snapshots the environment before dotenv, and guards before anything reaches the database', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app/server.js'), 'utf8');
  const at = (needle) => { const i = src.indexOf(needle); assert.ok(i >= 0, `server.js no longer contains: ${needle}`); return i; };
  const snapshot = at('const envBeforeDotenv = { ...process.env };');
  const dotenv = at("require('dotenv').config(");
  const guard = at("require('./env_guard').checkDatabaseTarget({ databaseUrl: process.env.DATABASE_URL, outsideEnv: envBeforeDotenv })");
  const exit = at('if (!target.ok) { console.error(target.message); process.exit(1); }');
  assert.ok(snapshot < dotenv, 'the snapshot must be taken BEFORE dotenv, or a .env file could grant its own permission');
  assert.ok(dotenv < guard && guard < exit, 'the guard must run after dotenv has set DATABASE_URL');
  // Every module that can open a connection loads after the guard. ./render_report is the first: it
  // pulls report_prep -> content_overrides -> db.
  for (const mod of ["require('./render_report')", "require('./db')", "require('./content_overrides')", "require('./report_prep')"]) {
    const i = src.indexOf(mod);
    if (i >= 0) assert.ok(i > exit, `${mod} loads before the guard`);
  }
  assert.strictEqual((src.match(/require\('dotenv'\)\.config\(/g) || []).length, 1, 'one dotenv load, and it is the guarded one');
});
