#!/usr/bin/env node
'use strict';
/**
 * Content library invariant — the durable fix from PR 1.5.
 *
 *     app/content/content_library.json  ==  build(Word source)      [modulo _meta]
 *
 * WHY THIS IS THE ENFORCEMENT
 * ---------------------------
 * The library drifted from its Word source by 132 leaf fields because page-fit trims were
 * made against rendered output, so the JSON was the natural place to edit and nothing
 * detected it. PR 1.5 reconciled the two. This check is what keeps them reconciled.
 *
 * It replaces a build-time guard that refused to overwrite changed content. That guard was
 * scaffolding for the reconciliation itself and could not survive it: afterwards, a
 * legitimate Word edit looks exactly like the corruption it was written to stop, so its
 * override flag would have become the normal authoring path. This check needs no flag and
 * no heuristic, it fails in the PR that introduces the problem rather than at whoever next
 * rebuilds, and it catches the one case the guard structurally could not see — a docx
 * edited but never rebuilt.
 *
 * WHAT GREEN DOES AND DOES NOT PROVE
 * ----------------------------------
 * It proves the JSON equals build(docx + the INTERIM_* constants in the build script).
 * A small number of leaves are emitted from those constants rather than parsed from Word,
 * so Word is not yet canonical for them. The count is printed on every run so it moves
 * visibly as constants retire into Word, and so a green check is never mistaken for a
 * stronger claim than it makes.
 *
 * Builds to a temporary copy; the committed artifact is never modified by this check.
 *
 *   node scripts/verify_content_library.js
 *   npm run content:check        (from app/)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/build_content_library.js');
const LIB = path.join(ROOT, 'app/content/content_library.json');
const DOCX_REL = 'docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx';

// Leaves produced by INTERIM_* constants in the build script rather than parsed from Word,
// with what would retire each group. Keep in step with the constants themselves.
const SCRIPT_SOURCED = [
  { path: 'static.welcome', label: 'static.welcome',
    retires: 'when the docx gains a WELCOME PAGE section (no current plan — raise with design)' },
  { path: 'static.wings_using', label: 'static.wings_using',
    retires: 'when the docx gains a USING YOUR WINGS AND LINES section (no current plan — raise with design)' },
  { path: 'type_9.wings', label: 'type_9 v3 wing fields (intro_v3/overview/bullets/resource)',
    retires: 'when Wings content lands in Word for all nine types (drafted, in review with Mo)',
    only: ['intro_v3', 'overview', 'bullets', 'resource'] },
];

let failed = false;
const fail = (m) => { failed = true; console.log(`  *** FAIL — ${m}`); };

function leaves(o, prefix = '', out = {}) {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(o)) {
    o.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
  } else out[prefix] = o;
  return out;
}
const countLeaves = (o) => Object.keys(leaves(o)).length;

/** Build into a temp file without disturbing the committed artifact. */
function buildToTemp(tmpPath) {
  const original = fs.readFileSync(LIB);
  try {
    execFileSync('node', [SCRIPT], { cwd: ROOT, stdio: 'pipe' });
    fs.copyFileSync(LIB, tmpPath);
  } finally {
    fs.writeFileSync(LIB, original);
  }
}

(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clib-'));
  const a = path.join(tmp, 'a.json'), b = path.join(tmp, 'b.json');

  // ── 1. Reproducible ────────────────────────────────────────────────────────
  buildToTemp(a);
  buildToTemp(b);
  if (Buffer.compare(fs.readFileSync(a), fs.readFileSync(b)) === 0) {
    console.log('  reproducible: two builds byte-identical ✓');
  } else {
    fail('build is not reproducible — two runs produced different bytes');
  }

  // ── 2. THE INVARIANT ───────────────────────────────────────────────────────
  const committed = JSON.parse(fs.readFileSync(LIB, 'utf8'));
  const built = JSON.parse(fs.readFileSync(a, 'utf8'));
  const C = leaves(committed), B = leaves(built);
  const skip = (k) => k.startsWith('_meta');
  const changed = Object.keys(C).filter(k => !skip(k) && k in B && C[k] !== B[k]);
  const missing = Object.keys(C).filter(k => !skip(k) && !(k in B));
  const extra = Object.keys(B).filter(k => !skip(k) && !(k in C));

  if (changed.length || missing.length || extra.length) {
    failed = true;
    console.log('\n  *** FAIL — app/content/content_library.json does not match a build of the Word source.\n');
    console.log(`      ${changed.length} field(s) differ, ${missing.length} present only in the JSON, `
      + `${extra.length} present only in the build.\n`);
    const show = (label, arr) => arr.slice(0, 15).forEach(k => console.log(`      ${label}  ${k}`));
    show('DIFFERS  ', changed); show('JSON-ONLY', missing); show('BUILD-ONLY', extra);
    const more = changed.length + missing.length + extra.length - Math.min(15, changed.length)
      - Math.min(15, missing.length) - Math.min(15, extra.length);
    if (more > 0) console.log(`      … and ${more} more`);
    console.log('\n      The Word source is canonical. Most likely you edited the JSON directly.');
    console.log(`      Move the edit into ${DOCX_REL}`);
    console.log('      and run:  npm run content:check');
    console.log('\n      If you edited the docx, you have not rebuilt: run the same command and');
    console.log('      commit the regenerated app/content/content_library.json alongside it.\n');
  } else {
    console.log('  invariant: committed library == build(Word source) ✓');
  }

  // ── 3. The asterisk — what green does not prove ────────────────────────────
  const total = Object.keys(B).filter(k => !skip(k)).length;
  let scripted = 0;
  const rows = [];
  for (const s of SCRIPT_SOURCED) {
    const node = s.path.split('.').reduce((o, k) => (o || {})[k], built);
    let n = 0;
    if (node !== undefined) {
      if (s.only) {
        const walk = (o) => {
          if (!o || typeof o !== 'object') return;
          for (const [k, v] of Object.entries(o)) {
            if (s.only.includes(k)) n += countLeaves(v); else if (typeof v === 'object') walk(v);
          }
        };
        walk(node);
      } else n = countLeaves(node);
    }
    scripted += n; rows.push({ ...s, n });
  }
  console.log(`\n  Word-canonical: ${total - scripted}/${total} leaves.`);
  console.log(`  ${scripted} leaf/leaves come from INTERIM_* constants in build_content_library.js`);
  console.log('  and are NOT proven canonical by this check:');
  for (const r of rows) console.log(`    ${String(r.n).padStart(3)}  ${r.label}\n         retires ${r.retires}`);

  fs.rmSync(tmp, { recursive: true, force: true });
  if (failed) { console.log('\nCONTENT LIBRARY: FAILURES ABOVE.'); process.exit(1); }
  console.log('\nCONTENT LIBRARY: ALL PASSED.');
})();
