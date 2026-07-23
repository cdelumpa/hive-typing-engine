/*
 * Basic Auth credentials for local test + tooling scripts.
 *
 * These scripts talk to a locally running server.js, which registers the basic-auth
 * gate unconditionally and refuses to boot without BASIC_AUTH_USER / BASIC_AUTH_PASSWORD
 * (app/server.js:107). Callers previously each carried their own hardcoded fallback pair;
 * when the password rotated (c95f406) every one of them started returning 401, and the
 * runner surfaced that as a JSON parse error rather than an auth failure. There is now
 * exactly one place credentials come from, and no literal to go stale.
 *
 * Resolution order:
 *   1. process.env  — an explicit override always wins (CI, or a one-off shell export).
 *   2. app/.env     — the same file server.js loads, so local runs match the server by
 *                     construction.
 *   3. throw        — never fall back to a guess; a wrong guess is a 401 ten minutes into
 *                     a paid run.
 *
 * IMPORTANT: only BASIC_AUTH_USER / BASIC_AUTH_PASSWORD are read out of app/.env, and
 * nothing is written into process.env. app/.env's DATABASE_URL points at PRODUCTION —
 * loading the whole file (dotenv.config(), `node -r dotenv/config`) would hand a test
 * script a live production pool. scripts/dev-local.js is what points the *server* at the
 * local DB; these client-side scripts need no DATABASE_URL at all.
 */
const fs   = require('fs');
const path = require('path');

const APP_DIR  = path.join(__dirname, '..', '..', 'app');
const ENV_FILE = path.join(APP_DIR, '.env');
// Resolved by absolute path: dotenv only exists under app/node_modules, so a bare
// require('dotenv') breaks whenever the caller's cwd is not app/.
const dotenv   = require(path.join(APP_DIR, 'node_modules', 'dotenv'));

const KEYS = ['BASIC_AUTH_USER', 'BASIC_AUTH_PASSWORD'];

// Parse (not load) app/.env and pick out only the two keys we want. dotenv.parse takes a
// buffer and returns an object — it has no side effects on process.env.
function fromEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const parsed = dotenv.parse(fs.readFileSync(ENV_FILE));
  const picked = {};
  for (const k of KEYS) if (parsed[k]) picked[k] = parsed[k];
  return picked;
}

// Returns { user, pass, source }. Throws with an actionable message if neither source
// supplies both values. Never logs or returns the password anywhere it could be printed
// by accident — `source` is for diagnostics, the values are not.
function resolveBasicAuth() {
  const fromShell = process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASSWORD;
  if (fromShell) {
    return { user: process.env.BASIC_AUTH_USER, pass: process.env.BASIC_AUTH_PASSWORD, source: 'process.env' };
  }

  const file = fromEnvFile();
  if (file.BASIC_AUTH_USER && file.BASIC_AUTH_PASSWORD) {
    return { user: file.BASIC_AUTH_USER, pass: file.BASIC_AUTH_PASSWORD, source: 'app/.env' };
  }

  throw new Error(
    'Basic Auth credentials not found.\n' +
    `  Looked in: process.env, then ${ENV_FILE}\n` +
    '  Fix: set BASIC_AUTH_USER and BASIC_AUTH_PASSWORD in app/.env (the same values the\n' +
    '  server boots with), or export them in this shell. Do not hardcode them in a script.'
  );
}

// Ready-to-use `Authorization` header value.
function basicAuthHeader() {
  const { user, pass } = resolveBasicAuth();
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

module.exports = { resolveBasicAuth, basicAuthHeader };
