'use strict';
/**
 * env_guard.js — local development must not default to the production database (env-safety PR).
 *
 * THE HAZARD. app/server.js loads `.env` from the working directory with `override: true`. Run from
 * app/, that is app/.env, whose DATABASE_URL is the PRODUCTION database — so `npm start`, or any
 * `node server.js` from app/, connected to production by default and ran its boot migration there.
 * It happened once in PR 6 Build B2, and it left scripts/overrides_check.js unverifiable.
 * scripts/dev-local.js was the safe way in; the obvious commands were the dangerous ones.
 *
 * THE RULE. The server boots against a database only if it is LOCAL, or the process is running on
 * RAILWAY, or someone OPTED IN explicitly. Anything else refuses to boot, before any module that
 * reaches the database is loaded.
 *
 * WHERE PERMISSION MAY COME FROM. The Railway markers and the opt-in are read from the environment
 * as it stood BEFORE dotenv ran (server.js snapshots it). A .env file can therefore supply a
 * production URL but can never also grant permission to use it — otherwise copying one line into
 * app/.env would switch the guard off for everyone.
 *
 * WHY THIS CANNOT CHANGE PRODUCTION. app/.env is gitignored and is not deployed; on Railway the
 * variables come from the platform, and Railway injects its own system variables into every
 * deployment. Any ONE of the markers below is enough, so no single variable going missing can stop
 * production booting.
 *
 * Pure: values in, a verdict out. Also used by scripts/overrides_check.js, so "local" has one meaning.
 */

// Railway system variables, documented as present in every deployment (docs.railway.com/reference/
// variables, read 11 Sep 2026). RAILWAY_ENVIRONMENT is the legacy name, kept in case it is set.
const RAILWAY_MARKERS = ['RAILWAY_PROJECT_ID', 'RAILWAY_ENVIRONMENT_ID', 'RAILWAY_SERVICE_ID',
  'RAILWAY_DEPLOYMENT_ID', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_ENVIRONMENT'];
const OPT_IN = 'ALLOW_NONLOCAL_DATABASE';
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|::1|\[::1\])$/i;

/** The database host, or null if the URL cannot be read — which is then treated as non-local. */
function databaseHost(url) {
  try { return new URL(String(url)).hostname || null; } catch { return null; }
}
const isLocalDatabaseUrl = (url) => LOCAL_HOST.test(databaseHost(url) || '');

/**
 * The verdict for one boot. `databaseUrl` is what the server will connect to (after dotenv);
 * `outsideEnv` is the environment before dotenv — the only place permission may come from.
 */
function checkDatabaseTarget({ databaseUrl, outsideEnv = {} }) {
  if (!databaseUrl) return { ok: true, why: 'no database configured' };
  const host = databaseHost(databaseUrl);
  if (isLocalDatabaseUrl(databaseUrl)) return { ok: true, why: 'local', host };
  const marker = RAILWAY_MARKERS.find((k) => outsideEnv[k]);
  if (marker) return { ok: true, why: `running on Railway (${marker})`, host };
  if (outsideEnv[OPT_IN] === '1') {
    return { ok: true, why: 'explicit opt-in', host,
      note: `[boot] WARNING: ${OPT_IN}=1 — this server is connecting to the NON-LOCAL database at ${host}.` };
  }
  return { ok: false, host, message: [
    `[boot] REFUSING TO BOOT: DATABASE_URL points at a non-local database (${host || 'unreadable URL'}).`,
    '  Outside Railway this is almost always app/.env, which points at PRODUCTION.',
    '  For local work:   node scripts/dev-local.js      (from the repo root — uses .env.dev.local)',
    `  To connect anyway, set ${OPT_IN}=1 in the shell (not in a .env file) and run again.`,
  ].join('\n') };
}

/**
 * THE BACKSTOP. The boot check runs before any module that reaches the database; this runs after
 * every module has LOADED, before the first one CONNECTS, and requires DATABASE_URL to be exactly what
 * the boot check approved. A module that loads a .env file of its own could otherwise put a production
 * URL in place after the check — app/generate_report.js did exactly that until this PR.
 */
function checkUnchanged(approvedUrl, currentUrl) {
  if ((approvedUrl || '') === (currentUrl || '')) return { ok: true };
  return { ok: false, message: [
    `[boot] REFUSING TO BOOT: DATABASE_URL changed after the boot check — now ${databaseHost(currentUrl) || 'unset'}, `
      + `approved ${databaseHost(approvedUrl) || 'none'}.`,
    '  A module loaded a .env file of its own. Find it and stop it loading at require time.',
  ].join('\n') };
}

module.exports = { checkDatabaseTarget, checkUnchanged, isLocalDatabaseUrl, databaseHost, RAILWAY_MARKERS, OPT_IN };
