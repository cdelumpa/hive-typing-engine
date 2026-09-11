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

// ── THE BACKSTOP, and the module that needed it ─────────────────────────────────────────────────
//
// app/generate_report.js loaded app/.env at require time. server.js requires it AFTER the boot check,
// so a server that started with no DATABASE_URL — approved as "no database" — had the PRODUCTION URL
// put in place behind the check, and its session store connected to it. Measured on this branch:
// requiring the module with DATABASE_URL unset left it set to the production host.

test('checkUnchanged passes an untouched URL and refuses any change after the boot check', () => {
  assert.strictEqual(G.checkUnchanged(LOCAL, LOCAL).ok, true);
  assert.strictEqual(G.checkUnchanged(undefined, undefined).ok, true);
  assert.strictEqual(G.checkUnchanged(undefined, '').ok, true, 'unset and empty are the same "none"');
  const v = G.checkUnchanged(undefined, PROD_LIKE);
  assert.strictEqual(v.ok, false);
  assert.match(v.message, /changed after the boot check — now switchyard\.proxy\.rlwy\.net, approved none/);
  assert.doesNotMatch(v.message, /secret/);
  assert.strictEqual(G.checkUnchanged(LOCAL, PROD_LIKE).ok, false);
});

test('server.js checks DATABASE_URL is unchanged after every module has loaded, before the session store connects', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app/server.js'), 'utf8');
  const at = (needle) => { const i = src.indexOf(needle); assert.ok(i >= 0, `server.js no longer contains: ${needle}`); return i; };
  const approved = at('const APPROVED_DATABASE_URL = process.env.DATABASE_URL;');
  const backstop = at("require('./env_guard').checkUnchanged(APPROVED_DATABASE_URL, process.env.DATABASE_URL)");
  const store = at('new PgSession(');
  assert.ok(at('if (!target.ok)') < approved, 'the approved URL is captured right after the boot check');
  for (const mod of ["require('./render_report')", "require('./generate_report')", "require('./db')"]) {
    assert.ok(at(mod) < backstop, `${mod} must load before the backstop, so the backstop sees what it did`);
  }
  assert.ok(backstop < store, 'the backstop must run before the session store opens a connection');
});

test('no module server.js requires loads a .env file at require time', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app/server.js'), 'utf8');
  const mods = [...new Set([...src.matchAll(/require\('\.\/([a-z_]+)'\)/g)].map((m) => m[1]))];
  assert.ok(mods.includes('generate_report') && mods.length > 10, `server.js local requires: ${mods.join(', ')}`);
  // A top-level dotenv load: a line that starts (column 0) by calling .config on a dotenv require.
  const TOP_LEVEL_DOTENV = /^(?:require\([^\n]*dotenv[^\n]*\)\)?\.config\(|const \w+ = require\([^\n]*dotenv[^\n]*\);\s*\n\w+\.config\()/m;
  const offenders = mods.filter((m) => fs.existsSync(path.join(ROOT, 'app', `${m}.js`))
    && TOP_LEVEL_DOTENV.test(fs.readFileSync(path.join(ROOT, 'app', `${m}.js`), 'utf8')));
  assert.deepStrictEqual(offenders, [], `modules that load a .env file when server.js requires them: ${offenders.join(', ')}`);
  // generate_report keeps its .env for the command line — loaded inside runCli, nowhere else.
  const gr = fs.readFileSync(path.join(ROOT, 'app/generate_report.js'), 'utf8');
  assert.match(gr, /async function runCli\(\) \{\n  loadCliEnv\(\);/);
  assert.strictEqual((gr.match(/loadCliEnv\(\)/g) || []).length, 1, 'loadCliEnv is called from runCli only');
});
