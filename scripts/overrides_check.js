#!/usr/bin/env node
'use strict';
/**
 * Published-override shape check — the pre-deploy gate for the resolver throw.
 *
 * The content_overrides table is a fourth content source alongside the docx, the compiled
 * library and the INTERIM_* constants, and until 12 August 2026 nothing inspected it. PR 1.5
 * reconciled the docx against content_library.json and declared Word canonical; seven rows
 * published 13-29 June sat outside that reconciliation the whole time, carrying June copies
 * of fields the library has since changed.
 *
 * WHY THIS IS NOT A CI STEP
 * -------------------------
 * .github/workflows/report-verify.yml has no `env`, no `secrets` and no `services`, so CI
 * has no database and cannot read this table. Wiring a production DATABASE_URL into PR CI is
 * not a trade worth making for this. So the check runs wherever the database is — a
 * developer machine with app/.env loaded, or a one-off against the deploy target.
 *
 * WHAT IT IS FOR
 * --------------
 * resolveContent now THROWS on a shape mismatch, and that throw reaches every report render
 * including the dry-validate probe in /api/submit. A mismatched row therefore fails
 * assessment submission, not just a PDF. Run this against the target database BEFORE
 * deploying a library change that alters any overridable field's shape. Green here means the
 * throw cannot fire in production.
 *
 *   node scripts/overrides_check.js          # from repo root, app/.env loaded automatically
 *   npm run overrides:check                  # from app/
 *
 * Exit 0 = every published override matches the current library shape.
 * Exit 1 = at least one row would throw, or names a key the library does not have.
 * Exit 2 = no database reachable (the check did not run — never mistake this for green).
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'app/node_modules/dotenv')).config({ path: path.join(ROOT, 'app/.env') });

const library = require(path.join(ROOT, 'app/content/content_library.json'));
const { overrideShape, assertOverrideShape, OverrideShapeError } = require(path.join(ROOT, 'app/content_overrides.js'));

const baselineFor = (key) => {
  const dot = key.indexOf('.');
  if (dot < 0) return { ok: false, why: 'key is not "<topKey>.<field>"' };
  const top = key.slice(0, dot), field = key.slice(dot + 1);
  if (!(top in library)) return { ok: false, why: `content_library has no "${top}"` };
  if (!(field in library[top])) return { ok: false, why: `content_library.${top} has no "${field}"` };
  return { ok: true, value: library[top][field] };
};

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('OVERRIDES CHECK: DID NOT RUN — DATABASE_URL is not set.');
    console.error('  This is not a pass. Load app/.env, or point at the deploy target explicitly.');
    process.exit(2);
  }
  const host = (url.match(/@([^:/]+)/) || [])[1] || '(unparsed host)';

  let rows;
  try {
    const { Client } = require(path.join(ROOT, 'app/node_modules/pg'));
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();
    ({ rows } = await c.query(
      `SELECT content_key, value, status, updated_at FROM content_overrides
        WHERE status = 'published' ORDER BY content_key`));
    await c.end();
  } catch (e) {
    console.error(`OVERRIDES CHECK: DID NOT RUN — database error: ${e.message}`);
    process.exit(2);
  }

  console.log(`=== Published override shape check ===`);
  console.log(`database: ${host}`);
  console.log(`published rows: ${rows.length}\n`);

  let bad = 0;
  for (const r of rows) {
    const b = baselineFor(r.content_key);
    const stamp = String(r.updated_at).slice(0, 10);
    if (!b.ok) {
      bad++;
      console.log(`  ORPHANED  ${r.content_key.padEnd(24)} ${stamp}  — ${b.why}`);
      continue;
    }
    let value;
    try { value = JSON.parse(r.value); } catch { value = r.value; }
    try {
      assertOverrideShape(r.content_key, b.value, value);
      console.log(`  ok        ${r.content_key.padEnd(24)} ${stamp}`);
    } catch (e) {
      if (!(e instanceof OverrideShapeError)) throw e;
      bad++;
      const want = [...overrideShape(b.value)], got = [...overrideShape(value)];
      console.log(`  MISMATCH  ${r.content_key.padEnd(24)} ${stamp}`);
      const missing = want.filter(p => !got.includes(p));
      const unknown = got.filter(p => !want.includes(p));
      if (missing.length) console.log(`              missing from override: ${missing.join(', ')}`);
      if (unknown.length) console.log(`              only in override:      ${unknown.join(', ')}`);
    }
  }

  if (bad) {
    console.log(`\n*** ${bad} of ${rows.length} published override(s) would THROW at render time.`);
    console.log('    Every report render resolves these, including the dry-validate probe in');
    console.log('    /api/submit — a mismatched row fails assessment submission, not just a PDF.');
    console.log('    Re-publish each row from the current baseline in /admin/content, or retire it');
    console.log('    (scripts/retire_overrides.js). Do not deploy the resolver throw until green.');
    process.exit(1);
  }
  console.log('\nOVERRIDES CHECK: ALL PASSED — every published override matches the current library shape.');
})().catch(e => { console.error('OVERRIDES CHECK FAILED:', e.stack || e.message); process.exit(1); });
