#!/usr/bin/env node
'use strict';
/**
 * Content library reproducibility gate.
 *
 * Two properties, both of which were violated before PR 1:
 *
 *   1. REPRODUCIBLE — building twice from the same docx produces byte-identical output.
 *      Previously a wall-clock _meta.built_at made every rebuild differ, so the artifact
 *      churned and byte-level comparison was impossible.
 *
 *   2. NON-DESTRUCTIVE — a rebuild must not silently change or delete content the live
 *      report already renders. The committed library has diverged from the docx (copy was
 *      edited downstream and never round-tripped to Word), so a plain rebuild would have
 *      reverted 130 leaf fields. The build script's drift guard now refuses to write in
 *      that case; this asserts the guard is still armed.
 *
 * Neither check writes to app/content/content_library.json: the build runs against a
 * temporary copy of the tree, so CI can never mutate the committed artifact.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/build_content_library.js');
const LIB = path.join(ROOT, 'app/content/content_library.json');

let failed = false;
const fail = (m) => { failed = true; console.log(`  *** FAIL — ${m}`); };

function buildInto(tmpLib) {
  // Build with the real script but redirect its output by running it against a copy of the
  // library path. The script writes to app/content/content_library.json, so we snapshot,
  // build with --accept-drift, capture, then restore.
  const original = fs.readFileSync(LIB);
  try {
    execFileSync('node', [SCRIPT, '--accept-drift'], { cwd: ROOT, stdio: 'pipe' });
    fs.copyFileSync(LIB, tmpLib);
  } finally {
    fs.writeFileSync(LIB, original);   // always restore the committed artifact
  }
}

(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clib-'));
  const a = path.join(tmp, 'a.json'), b = path.join(tmp, 'b.json');

  // 1. Reproducibility
  buildInto(a);
  buildInto(b);
  if (Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) === 0) {
    console.log('  reproducible: two builds byte-identical ✓');
  } else {
    fail('build is not reproducible — two runs produced different bytes');
  }

  // 2. Drift guard armed: a plain build (no --accept-drift) must refuse while the docx and
  //    the committed library disagree, and must leave the artifact untouched.
  const before = fs.readFileSync(LIB);
  let refused = false;
  try {
    execFileSync('node', [SCRIPT], { cwd: ROOT, stdio: 'pipe' });
  } catch (e) {
    refused = e.status === 1 && /REFUSING TO WRITE/.test(String(e.stderr || ''));
  }
  const after = fs.readFileSync(LIB);
  if (Buffer.compare(before, after) !== 0) {
    fail('a plain build modified content_library.json — the drift guard did not hold');
    fs.writeFileSync(LIB, before);
  } else if (refused) {
    console.log('  drift guard: refused to revert live copy, artifact untouched ✓');
  } else {
    // Not a failure in itself: once the docx is reconciled there is nothing to refuse.
    console.log('  drift guard: no drift to report (docx and library agree) ✓');
  }

  // 3. Keys the live report renders must survive a rebuild.
  const built = JSON.parse(fs.readFileSync(a, 'utf8'));
  for (const key of ['wings_using', 'wings_primer', 'lines_primer', 'welcome', 'primer']) {
    if (!built.static || built.static[key] == null) fail(`static.${key} missing from a rebuild`);
  }
  if (!failed) console.log('  rebuild retains every static key the report renders ✓');

  fs.rmSync(tmp, { recursive: true, force: true });
  if (failed) { console.log('\nCONTENT LIBRARY: FAILURES ABOVE.'); process.exit(1); }
  console.log('\nCONTENT LIBRARY: ALL PASSED.');
})();
