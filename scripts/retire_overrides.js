#!/usr/bin/env node
'use strict';
/**
 * Retire published content overrides — snapshot first, then delete.
 *
 * WHY A SCRIPT AND NOT THE /admin/content REVERT BUTTON
 * -----------------------------------------------------
 * revertOverride() is `DELETE FROM content_overrides WHERE content_key = $1`
 * (content_overrides.js). The row goes and `previous_value` goes with it — that column only
 * ever undoes the LAST publish while the row still exists, it is not an archive. Confirmed
 * on production 12 Aug 2026: all seven rows carry previous_value IS NULL, so each was
 * published exactly once and the button offers no undo at all.
 *
 * This script writes a full JSON snapshot of every row it is about to touch — including
 * previous_value — before deleting anything, so retirement is reversible in practice.
 *
 * DRY RUN IS THE DEFAULT. Nothing is deleted without --confirm.
 *
 *   node scripts/retire_overrides.js                      # dry run, all published rows
 *   node scripts/retire_overrides.js static.welcome       # dry run, named rows only
 *   node scripts/retire_overrides.js --confirm            # snapshot, then delete
 *
 * The snapshot path is printed and can be replayed with an INSERT; keep it with the PR.
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'app/node_modules/dotenv')).config({ path: path.join(ROOT, 'app/.env') });

const argv = process.argv.slice(2);
const confirm = argv.includes('--confirm');
const keys = argv.filter(a => !a.startsWith('--'));

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL is not set.'); process.exit(2); }
  const host = (url.match(/@([^:/]+)/) || [])[1] || '(unparsed host)';

  const { Client } = require(path.join(ROOT, 'app/node_modules/pg'));
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const where = keys.length ? ' AND content_key = ANY($1)' : '';
  const params = keys.length ? [keys] : [];
  const { rows } = await c.query(
    `SELECT * FROM content_overrides WHERE status = 'published'${where} ORDER BY content_key`, params);

  console.log(`database: ${host}`);
  console.log(`rows selected: ${rows.length}${keys.length ? ` (filtered to ${keys.join(', ')})` : ' (all published)'}\n`);
  for (const r of rows) {
    console.log(`  ${r.content_key.padEnd(24)} ${String(r.updated_at).slice(0, 10)}  ` +
                `${String(r.value.length).padStart(5)} chars  wc ${String(r.word_count).padStart(4)}  ` +
                `previous_value: ${r.previous_value == null ? 'NULL' : 'present'}`);
  }

  if (!rows.length) { console.log('\nNothing to do.'); await c.end(); return; }

  if (!confirm) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --confirm to snapshot and delete.');
    await c.end();
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snap = path.join(ROOT, `.override_snapshots/content_overrides_${stamp}.json`);
  fs.mkdirSync(path.dirname(snap), { recursive: true });
  fs.writeFileSync(snap, JSON.stringify(rows, null, 2));
  console.log(`\nsnapshot written: ${path.relative(ROOT, snap)} (${rows.length} row(s), full columns)`);

  const res = await c.query('DELETE FROM content_overrides WHERE content_key = ANY($1)',
    [rows.map(r => r.content_key)]);
  console.log(`deleted: ${res.rowCount} row(s)`);
  console.log('\nThe next render reloads the published set — content_overrides.js busts its cache');
  console.log('on every mutator, but this script writes directly, so RESTART THE APP (or wait for');
  console.log('the next deploy) to be certain the in-process memo is cleared.');
  await c.end();
})().catch(e => { console.error('RETIRE FAILED:', e.stack || e.message); process.exit(1); });
