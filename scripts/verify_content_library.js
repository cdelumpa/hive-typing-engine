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
  // p8 "Your Wings", all nine types, from INTERIM_WINGS_V3.
  //
  // PURELY ADDITIVE, and that is the difference from the p9 rows below. The docx parse
  // produces only {target_type, body} for a wing (build_content_library.js:750); overview,
  // bullets, resource and intro_v3 have never had a Word equivalent for ANY type, Type 9
  // included. So there is no "replaced the docx value" group to split out here — every leaf
  // this row counts is a leaf the library would not otherwise have.
  //
  // Was pinned to `type_9.wings` while Type 9 was the only authored type. A fixed path
  // cannot express "every type", so it counted 15 while types 1-8 added 120 more — the
  // printed Word-canonical figure would have RISEN as non-Word content landed.
  { path: 'types_v3_wings',
    label: 'v3 wing fields, all 9 types (intro_v3/overview/bullets/resource)',
    retires: 'when Wings content lands in Word for all nine types (no current plan — the docx has no section for these three fields)',
    walkTypes: ['intro_v3', 'overview', 'bullets', 'resource'], under: 'wings' },

  // p9 "Your Stress and Security Points", all nine types, from INTERIM_LINES_V3.
  //
  // TWO GROUPS, COUNTED SEPARATELY AND ON PURPOSE. The first is additive — keys the library
  // did not have. The second is not: `narrative` and `resource_card` ARE parsed from the
  // docx, and INTERIM_LINES_V3 replaces them for all nine types (ratified 13 Aug 2026 — the
  // docx narratives run 284-351 characters against a layout drawn for ~189). Those 36 leaves
  // stop being Word-sourced the moment this lands, so they belong in this table.
  //
  // Leaving them out is the failure mode this table exists to prevent: the count of
  // script-sourced leaves would stay flat while 135 of them were added, and the printed
  // Word-canonical figure would go UP — reading as "more canonical" at the exact moment the
  // opposite became true. The number is bookkeeping about where a string came from, not a
  // claim about which source has authority.
  { path: 'types_v3_lines_additive',
    label: 'p9 v3 line fields, all 9 types (intro_v3/work_lead_v3/work_v3/bullets_v3)',
    retires: 'not planned — INTERIM_LINES_V3 is the editing surface for this page',
    // `under: 'lines'` is load-bearing, not tidiness. `intro_v3` is also a key of
    // type_9.wings, so an unscoped walk counts it twice — once here and once in the wings
    // row above — and reports 100 where the truth is 99.
    walkTypes: ['intro_v3', 'work_lead_v3', 'work_v3', 'bullets_v3'], under: 'lines' },
  { path: 'types_v3_lines_replaced',
    label: 'p9 narrative + resource card, all 9 types (REPLACE the docx values)',
    retires: 'if the docx p9 narratives are ever rewritten to the v3 length budget',
    walkTypes: ['narrative', 'resource_card'], under: 'lines' },
  { path: 'static.contents', label: 'static.contents (v3 Contents page, 9 entries)',
    retires: 'when the docx gains a CONTENTS ENTRIES section (no current plan — raise with design)' },
  { path: 'static.thoughts', label: 'static.thoughts (v3 Your Thoughts page)',
    retires: 'when the docx gains a YOUR THOUGHTS section (no current plan — raise with design)' },
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

/**
 * Build into a temp file without disturbing the committed artifact.
 *
 * A FAILING BUILD IS AN EXPECTED STATE HERE, not an exception. Through PR 3 the content
 * library legitimately fails for every type whose page content is not authored yet — that
 * failure IS the content-readiness signal. With `stdio: 'pipe'`, an uncaught execFileSync
 * error prints its own error object, which renders the child's stderr as a raw Buffer:
 * 6728 bytes of `[ 42, 42, 42, 32, ... 3257 more items ]` around 60 lines of legible
 * coverage failures. Catch it and print what the build actually said.
 */
function buildToTemp(tmpPath) {
  const original = fs.readFileSync(LIB);
  let failure = null;
  try {
    try { execFileSync('node', [SCRIPT], { cwd: ROOT, stdio: 'pipe' }); }
    catch (e) { failure = e; }
    if (!failure) fs.copyFileSync(LIB, tmpPath);
  } finally {
    // Always restore, including on a failed build. The report below therefore runs AFTER
    // this block and never from inside it: process.exit() does not run pending finally
    // blocks, so exiting in the catch would skip the restore. Harmless while the build
    // exits before its own writeFileSync, which is precisely the kind of "safe by accident"
    // this file exists to stop relying on.
    fs.writeFileSync(LIB, original);
  }
  if (failure) {
    const out = [failure.stdout, failure.stderr]
      .map(b => (b == null ? '' : b.toString())).join('').trimEnd();
    console.error(out || `(build produced no output; exit ${failure.status})`);
    console.error(`\nCONTENT LIBRARY: build failed (exit ${failure.status}) — the invariant cannot be checked.`);
    process.exit(1);
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
    let n = 0;
    // `walkTypes` sums a field set across ALL NINE type_N nodes rather than one fixed path.
    // The wings entry above is pinned to type_9 because that is the only authored type; a
    // fixed path cannot express "every type", and pinning one while eight more land is how
    // this table silently stops counting. `under` restricts the walk to a sub-node so
    // `narrative` matches type_N.lines.*.narrative and not some other field of that name.
    if (s.walkTypes) {
      for (let i = 1; i <= 9; i++) {
        const t = built[`type_${i}`];
        const node = s.under ? (t || {})[s.under] : t;
        if (!node) continue;
        const walk = (o) => {
          if (!o || typeof o !== 'object') return;
          for (const [k, v] of Object.entries(o)) {
            if (s.walkTypes.includes(k)) n += countLeaves(v); else if (typeof v === 'object') walk(v);
          }
        };
        walk(node);
      }
      scripted += n; rows.push({ ...s, n });
      continue;
    }
    const node = s.path.split('.').reduce((o, k) => (o || {})[k], built);
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
