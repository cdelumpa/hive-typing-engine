'use strict';
/**
 * p10 subtype-narrative parser — the ingest path for INTERIM_INSTINCTS_V3.
 *
 * Input is Google Doc 1_M7tvK1I-5bJw0JjDF4xpTRAEPgpyeWkGCQea6nH364 ("Subtype Narratives —
 * p8 Instincts & Subtypes") exported as markdown to a file. INGEST BY ID, NEVER BY TITLE:
 * a duplicate doc with an identical title once received a misdirected edit on this project.
 * The export step is MANUAL (Drive is not reachable from node here), so this parses a file
 * rather than fetching. The file is throwaway; the document is the source of record.
 *
 * Same shape and same reasons as scripts/spike/parse_explore_docs.js.
 *
 * FIVE REQUIREMENTS, each from a hazard measured in docs/audit_pr4_instincts_subtypes.md.
 * Four of the five fail SILENTLY if dropped.
 *
 *  1. THE SIGNATURE IS THE THIRD `·` ELEMENT. The header is `code · naranjo · signature`.
 *     A parser taking "the text after the first ·" ingests the naranjo term as the
 *     signature for all 27 rows and reports nothing. Do not call the third element a
 *     "tagline" either: `tagline` is a live v2 field on these same rows, and two different
 *     things called tagline on one row is how the wrong string lands everywhere.
 *
 *  2. KEY ON THE `·` STRUCTURE, NOT ON FORMATTING. 12 rows (types 8/9/1/2) carry a plain
 *     header; 15 (types 3-7) carry a bold one, with the em-dash character count OUTSIDE
 *     the bold run. A formatting-keyed parser splits them 12/15. The `**` is stripped, not
 *     matched on.
 *
 *  3. DO NOT ASSUME TYPE ORDER. The document runs 8, 9, 1, 2, 3, 4, 5, 6, 7. Rows are
 *     collected by code and the 27-code set is asserted at the end, so order is irrelevant.
 *
 *  4. NORMALISE QUOTES. Same convention as parse_explore_docs.js: the library is entirely
 *     straight and a Drive export may return curly, which would report false differences on
 *     a round-trip. Every mapping is one char to one char, so normalising CANNOT change a
 *     measured length — U+2026 (…) would be 1 to 3 and is deliberately NOT mapped, it is
 *     asserted absent instead. Measured 6 Sep 2026: this export returned straight quotes
 *     already and the transform altered 0 of 27 rows. Keep it anyway; that is a property of
 *     one export, not of the document.
 *
 *  5. RECOUNT, DO NOT TRUST THE STATED COUNT. Every header states a character count. All 27
 *     were exact on 6 Sep 2026 — which is the OPPOSITE of the standing caution in spec
 *     §7.4, where the p6/p7 sources' printed counts run low. That is a fact about one read,
 *     not a property of the file. This script recounts and reports every delta.
 *
 * Not content, and skipped: the `=====` rules, the `TYPE n —` banners, the character-limit
 * line, and the trailing `Spread:` lines (whose format varies: "Spread: 4 chars",
 * "Spread:4 chars", "Spread: 21 char").
 *
 *   node scripts/spike/parse_subtype_narratives.js <file>          # parse, recount, validate
 *   node scripts/spike/parse_subtype_narratives.js <file> --emit   # emit the constant literal
 *   node scripts/spike/parse_subtype_narratives.js <file> --diff   # diff against the built library
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const LIB = path.join(ROOT, 'app/content/content_library.json');

// Requirement 4. One char -> one char, so lengths are preserved.
const NORM = { '‘': "'", '’': "'", '“': '"', '”': '"', '′': "'", '″': '"' };
const normalise = (s) => s.replace(/[‘’“”′″]/g, (c) => NORM[c]);

// Requirement 1 + 2: three '·' elements; the optional '**' run is stripped, not matched on.
const HEADER = /^\s*(?:\*\*)?\s*([A-Z]{2}[1-9])\s*·\s*([^·]+?)\s*·\s*(.+?)\s*(?:\*\*)?\s*—\s*(\d+)\s*chars?\s*$/;
const NOISE = /^\s*$|^\s*\\?=+\s*$|^\s*TYPE\s+\d|^\s*Spread\s*:|^\s*\*{0,3}Character Limit|^Subtype Narratives/;

const CODES = [];
for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9]) for (const i of ['SP', 'SO', 'SX']) CODES.push(i + t);

function parseDoc(text) {
  const lines = text.split('\n');
  const rows = new Map();
  const order = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADER);
    if (!m) continue;
    const [, code, naranjo, signature, stated] = m;
    // Body is the next line that is not structure. Handles both shapes: the plain rows put
    // a blank line between header and body, the bold rows put the body on the next line.
    let body = null;
    for (let j = i + 1; j < lines.length; j++) {
      if (HEADER.test(lines[j])) break;              // ran into the next header: body missing
      if (NOISE.test(lines[j])) continue;
      body = lines[j].trim();
      break;
    }
    order.push(code);
    rows.set(code, {
      code,
      naranjo: normalise(naranjo.trim()),
      signature: normalise(signature.trim()),
      narrative: body === null ? null : normalise(body),
      stated: +stated,
      bold: lines[i].includes('**'),
    });
  }
  return { rows, order };
}

function validate({ rows, order }, text) {
  const errs = [];
  if (rows.size !== 27) errs.push(`parsed ${rows.size} rows, want 27`);
  if (order.length !== new Set(order).size) errs.push('duplicate subtype codes in the document');
  const missing = CODES.filter((c) => !rows.has(c));
  if (missing.length) errs.push(`missing: ${missing.join(', ')}`);
  const extra = order.filter((c) => !CODES.includes(c));
  if (extra.length) errs.push(`unrecognised codes: ${extra.join(', ')}`);
  for (const r of rows.values()) {
    if (!r.narrative) errs.push(`${r.code}: no narrative found under the header`);
    if (!r.naranjo) errs.push(`${r.code}: empty naranjo`);
    if (!r.signature) errs.push(`${r.code}: empty signature`);
  }
  // Requirement 4's guard: an ellipsis would make normalisation change a length.
  if (/…/.test(text)) errs.push('U+2026 ellipsis present — normalisation is not length-preserving');
  return errs;
}

const stats = (a) => ({
  min: Math.min(...a), max: Math.max(...a),
  mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1),
  spread: Math.max(...a) - Math.min(...a),
});

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/spike/parse_subtype_narratives.js <exported-markdown-file> [--emit|--diff]');
    process.exit(2);
  }
  const text = fs.readFileSync(file, 'utf8');
  const parsed = parseDoc(text);
  const { rows, order } = parsed;

  console.log(`document order: ${order.join(' ')}`);
  console.log(`header formatting: ${[...rows.values()].filter((r) => r.bold).length} bold, `
    + `${[...rows.values()].filter((r) => !r.bold).length} plain  (requirement 2 — not keyed on)`);

  const errs = validate(parsed, text);
  if (errs.length) {
    console.error('\nPARSE FAILED:');
    errs.forEach((e) => console.error('  - ' + e));
    process.exit(1);
  }

  // Requirement 5.
  let deltas = 0;
  const lines = [];
  for (const c of CODES) {
    const r = rows.get(c);
    const d = r.narrative.length - r.stated;
    if (d !== 0) { deltas++; lines.push(`  ${c}: recounted ${r.narrative.length}, stated ${r.stated} (${d > 0 ? '+' : ''}${d})`); }
  }
  console.log(`\nrecount vs stated: ${deltas === 0 ? 'all 27 EXACT' : `${deltas} of 27 DIFFER`}`);
  lines.forEach((l) => console.log(l));

  const nl = CODES.map((c) => rows.get(c).narrative.length);
  const sl = CODES.map((c) => rows.get(c).signature.length);
  const al = CODES.map((c) => rows.get(c).naranjo.length);
  const show = (label, a) => {
    const s = stats(a);
    console.log(`  ${label.padEnd(11)} min ${s.min} · max ${s.max} · mean ${s.mean} · spread ${s.spread}`);
  };
  console.log('\nmeasured:');
  show('narrative', nl); show('signature', sl); show('naranjo', al);

  if (process.argv.includes('--emit')) {
    const q = (s) => (!s.includes("'") ? `'${s}'` : (!s.includes('"') ? `"${s}"` : `'${s.replace(/'/g, "\\'")}'`));
    console.log('\nconst INTERIM_INSTINCTS_V3 = {');
    for (const c of CODES) {
      const r = rows.get(c);
      console.log(`  ${c}: {`);
      console.log(`    naranjo: ${q(r.naranjo)},`);
      console.log(`    signature: ${q(r.signature)},`);
      console.log('    narrative:');
      console.log(`      ${q(r.narrative)},`);
      console.log('  },');
    }
    console.log('};');
  }

  if (process.argv.includes('--diff')) {
    const lib = JSON.parse(fs.readFileSync(LIB, 'utf8'));
    let same = 0; const diff = [];
    for (const c of CODES) {
      const r = rows.get(c);
      const iv = (lib[`subtype_${c.toLowerCase()}`] || {}).instincts_v3;
      if (!iv) { diff.push(`${c}: instincts_v3 absent from the library`); continue; }
      for (const leaf of ['naranjo', 'signature', 'narrative']) {
        if (iv[leaf] === r[leaf]) same++;
        else diff.push(`${c}.${leaf}: library ${JSON.stringify(iv[leaf])} != document ${JSON.stringify(r[leaf])}`);
      }
    }
    console.log(`\ndiff against ${path.relative(ROOT, LIB)}: ${same}/81 leaves identical`);
    diff.forEach((d) => console.log('  ' + d));
    if (diff.length) process.exit(1);
  }

  console.log('\nPARSE OK');
}

main();
