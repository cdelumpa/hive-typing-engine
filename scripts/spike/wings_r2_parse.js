'use strict';
/**
 * Parse docs/hive_insightout_wings_content_all_types_081226_r2_verified.md
 * READ ONLY. Writes nothing into the repo. Emits a JSON blob to the scratchpad for the
 * measurement pass, plus a parse report on stdout.
 *
 * Annotations are parsed as DATA (provenance tag + role note), not discarded — the tag is
 * the one thing a JS literal cannot carry, and 43 of 126 zones are CLAUDE-authored.
 */
const fs = require('fs');
const path = require('path');
const ROOT = '/Users/caidelumpa/Developer/hive-typing-engine';
const SRC = path.join(ROOT, 'docs/hive_insightout_wings_content_all_types_081226_r2_verified.md');
const OUT = '/private/tmp/claude-501/-Users-caidelumpa/d23ef6cf-3512-43ae-91cf-0def433f857e/scratchpad/r2_parsed.json';

// Google Docs markdown escaping: a backslash before punctuation. Prose contains no real
// backslashes (verified: zero occurrences of \\ not followed by punctuation).
const unescape = (s) => s.replace(/\\([-_.()[\]*#+!`~>|<])/g, '$1');

const WORD2NUM = { ONE:1, TWO:2, THREE:3, FOUR:4, FIVE:5, SIX:6, SEVEN:7, EIGHT:8, NINE:9 };

const raw = fs.readFileSync(SRC, 'utf8');
const lines = raw.split('\n').map(l => l.replace(/\r$/, ''));

const ANNOT = /^(\d+)\s+chars\s+·\s+(\d+)\s+(?:words?|lines?)\s+·\s+(APPROVED|ADAPTED|CLAUDE)(?:\s+·\s+(.+))?\s*$/;
const TYPE_H = /^TYPE\s+([1-9])\s+—\s+(.+?)\s*$/;
const WING_H = /^([A-Z]+(?:-[A-Z]+)?)\s+WING\s+·\s+TYPE\s+([1-9])\s+—\s+(.+?)\s*$/;
const BULLET = /^\\?-\s+(.*)$/;

const types = {};
const problems = [];
let curType = null, curWing = null, curZone = null, pending = null;

const flush = () => {
  // a content line awaiting its annotation
  if (pending && !pending.annot) problems.push(`${pending.where}: content with NO annotation — ${JSON.stringify(pending.text.slice(0, 60))}`);
  pending = null;
};

for (let i = 0; i < lines.length; i++) {
  const rawLine = lines[i];
  const line = rawLine.trim();
  if (!line) continue;

  let m;
  if ((m = line.match(TYPE_H))) {
    flush();
    curType = +m[1];
    types[curType] = { number: curType, name: unescape(m[2]), wings: {} };
    curWing = null; curZone = null;
    continue;
  }
  if ((m = line.match(WING_H))) {
    flush();
    if (!curType) { problems.push(`line ${i + 1}: wing header before any TYPE header`); continue; }
    const slotWord = m[1];                 // e.g. NINE, TWO, ONE-TO-ONE (not expected here)
    const target = +m[2];
    const declared = WORD2NUM[slotWord];
    if (declared !== undefined && declared !== target) {
      problems.push(`type ${curType}: wing header word "${slotWord}" (=${declared}) disagrees with "TYPE ${target}"`);
    }
    curWing = { target_type: target, name: unescape(m[3]), overview: null, bullets: [], resource: null };
    types[curType].wings[target] = curWing;
    curZone = null;
    continue;
  }
  if (/^OVERVIEW$/.test(line))      { flush(); curZone = 'overview'; continue; }
  if (/^WING BULLETS$/.test(line))  { flush(); curZone = 'bullets';  continue; }
  if (/^AS A RESOURCE$/.test(line)) { flush(); curZone = 'resource'; continue; }

  if ((m = line.match(ANNOT))) {
    if (!pending) { continue; }           // annotations in the preamble/legend — ignore
    pending.annot = { chars: +m[1], units: +m[2], provenance: m[3], role: m[4] ? unescape(m[4]) : null };
    const actual = pending.text.length;
    if (actual !== pending.annot.chars) {
      pending.annot.char_mismatch = { stated: pending.annot.chars, actual };
    }
    pending = null;
    continue;
  }

  if (!curType || !curWing || !curZone) continue;   // preamble prose

  const bm = rawLine.match(BULLET) || line.match(BULLET);
  if (curZone === 'bullets') {
    if (!bm) { problems.push(`type ${curType} wing ${curWing.target_type}: non-bullet line inside WING BULLETS — ${JSON.stringify(line.slice(0, 60))}`); continue; }
    flush();
    const text = unescape(bm[1].trim());
    const rec = { text, annot: null };
    curWing.bullets.push(rec);
    pending = { ...rec, where: `type ${curType} wing ${curWing.target_type} bullet ${curWing.bullets.length}` };
    // keep the same object identity so the annotation lands on the record
    pending.assignTo = rec;
    Object.defineProperty(pending, 'annot', {
      get() { return rec.annot; }, set(v) { rec.annot = v; }, configurable: true,
    });
    continue;
  }
  if (curZone === 'overview' || curZone === 'resource') {
    flush();
    const text = unescape(line);
    const rec = { text, annot: null };
    curWing[curZone] = rec;
    pending = { text, where: `type ${curType} wing ${curWing.target_type} ${curZone}` };
    Object.defineProperty(pending, 'annot', {
      get() { return rec.annot; }, set(v) { rec.annot = v; }, configurable: true,
    });
    continue;
  }
}
flush();

// ── coverage assertions ──────────────────────────────────────────────────────
let zoneCount = 0;
for (let n = 1; n <= 9; n++) {
  const t = types[n];
  if (!t) { problems.push(`TYPE ${n} MISSING`); continue; }
  const tgts = Object.keys(t.wings).map(Number).sort((a, b) => a - b);
  if (tgts.length !== 2) problems.push(`type ${n}: ${tgts.length} wing blocks (want 2) — ${tgts}`);
  for (const tt of tgts) {
    const w = t.wings[tt];
    if (!w.overview) problems.push(`type ${n} wing ${tt}: overview missing`);
    if (!w.resource) problems.push(`type ${n} wing ${tt}: resource missing`);
    if (w.bullets.length !== 5) problems.push(`type ${n} wing ${tt}: ${w.bullets.length} bullets (want 5)`);
    for (const z of [w.overview, ...w.bullets, w.resource].filter(Boolean)) {
      zoneCount++;
      if (!z.annot) problems.push(`type ${n} wing ${tt}: a zone has no provenance annotation — ${JSON.stringify(z.text.slice(0, 50))}`);
    }
  }
}

// ── engine cross-check: wing targets vs TYPE_META ────────────────────────────
const TYPE_META = { 1:[9,2], 2:[1,3], 3:[2,4], 4:[3,5], 5:[4,6], 6:[5,7], 7:[6,8], 8:[7,9], 9:[8,1] };
const TYPE_NAMES = { 1:'The Improver',2:'The Giver',3:'The Performer',4:'The Individualist',5:'The Observer',6:'The Questioner',7:'The Enthusiast',8:'The Protector',9:'The Peacemaker' };
for (let n = 1; n <= 9; n++) {
  if (!types[n]) continue;
  const got = Object.keys(types[n].wings).map(Number).sort((a, b) => a - b);
  const want = [...TYPE_META[n]].sort((a, b) => a - b);
  if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`type ${n}: wing targets ${got} != engine ${want}`);
  for (const tt of got) {
    const declared = types[n].wings[tt].name.replace(/^THE\s+/i, 'The ');
    if (declared.toLowerCase() !== TYPE_NAMES[tt].toLowerCase()) {
      problems.push(`type ${n} wing ${tt}: name "${types[n].wings[tt].name}" != engine "${TYPE_NAMES[tt]}"`);
    }
  }
}

// ── report ───────────────────────────────────────────────────────────────────
console.log('=== (a) PARSE REPORT ===');
console.log(`source: docs/hive_insightout_wings_content_all_types_081226_r2_verified.md (${raw.length} bytes, ${lines.length} lines)`);
console.log(`zones extracted: ${zoneCount} (expect 126)\n`);
console.log('type  name                wings by TARGET TYPE NUMBER            zones');
for (let n = 1; n <= 9; n++) {
  const t = types[n]; if (!t) { console.log(`  ${n}   *** MISSING`); continue; }
  const tgts = Object.keys(t.wings).map(Number).sort((a, b) => a - b);
  const desc = tgts.map(tt => { const w = t.wings[tt];
    return `${tt} ${w.name.replace(/^THE /i,'')} (o:${w.overview?1:0} b:${w.bullets.length} r:${w.resource?1:0})`; }).join('  ·  ');
  const z = tgts.reduce((a, tt) => a + (t.wings[tt].overview?1:0) + t.wings[tt].bullets.length + (t.wings[tt].resource?1:0), 0);
  console.log(`  ${n}   ${t.name.padEnd(18)} ${desc.padEnd(56)} ${z}`);
}

console.log('\n--- provenance mix (aggregate over all parsed zones) ---');
const prov = {};
const roles = {};
for (const n of Object.keys(types)) for (const tt of Object.keys(types[n].wings)) {
  const w = types[n].wings[tt];
  for (const z of [w.overview, ...w.bullets, w.resource].filter(Boolean)) {
    if (!z.annot) continue;
    prov[z.annot.provenance] = (prov[z.annot.provenance] || 0) + 1;
    if (z.annot.role) roles[z.annot.role] = (roles[z.annot.role] || 0) + 1;
  }
}
console.log('  ' + Object.entries(prov).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('  role notes: ' + Object.entries(roles).map(([k, v]) => `${k} ${v}`).join(' · '));

console.log('\n--- stated vs actual character counts ---');
let mismatch = 0;
for (const n of Object.keys(types)) for (const tt of Object.keys(types[n].wings)) {
  const w = types[n].wings[tt];
  [['overview', w.overview], ...w.bullets.map((b, i) => [`bullet${i + 1}`, b]), ['resource', w.resource]]
    .filter(([, z]) => z && z.annot && z.annot.char_mismatch)
    .forEach(([lab, z]) => { mismatch++; console.log(`  T${n} w${tt} ${lab}: stated ${z.annot.char_mismatch.stated}, actual ${z.annot.char_mismatch.actual} (${z.annot.char_mismatch.actual - z.annot.char_mismatch.stated >= 0 ? '+' : ''}${z.annot.char_mismatch.actual - z.annot.char_mismatch.stated})`); });
}
console.log(`  ${mismatch} of ${zoneCount} differ` + (mismatch ? '' : ' — all stated counts exact'));

console.log('\n--- (1) residual backslash escapes after unescaping ---');
let esc = 0;
for (const n of Object.keys(types)) for (const tt of Object.keys(types[n].wings)) {
  const w = types[n].wings[tt];
  for (const [lab, z] of [['overview', w.overview], ...w.bullets.map((b, i) => [`b${i + 1}`, b]), ['resource', w.resource]]) {
    if (z && /\\/.test(z.text)) { esc++; console.log(`  T${n} w${tt} ${lab}: ${JSON.stringify(z.text)}`); }
  }
}
console.log(`  ${esc} zones still contain a backslash` + (esc ? ' *** MUST NOT REACH THE LIBRARY' : ' — clean'));

console.log('\n--- (3) em-dash / en-dash inventory (NEW material for em_dash_editorial_review.md) ---');
const dashes = [];
for (const n of Object.keys(types)) for (const tt of Object.keys(types[n].wings)) {
  const w = types[n].wings[tt];
  for (const [lab, z] of [['overview', w.overview], ...w.bullets.map((b, i) => [`bullet${i + 1}`, b]), ['resource', w.resource]]) {
    if (!z) continue;
    const em = (z.text.match(/—/g) || []).length, en = (z.text.match(/–/g) || []).length;
    if (em || en) dashes.push({ type: +n, wing: +tt, zone: lab, em, en, text: z.text });
  }
}
console.log(`  ${dashes.length} zones contain an em- or en-dash`);
dashes.forEach(d => console.log(`  T${d.type} w${d.wing} ${d.zone}  (em ${d.em}, en ${d.en})  ${JSON.stringify(d.text)}`));

console.log('\n--- (4) ellipsis scan (… expands 1 char -> 3 at render via _v3Straighten) ---');
let ell = 0;
for (const n of Object.keys(types)) for (const tt of Object.keys(types[n].wings)) {
  const w = types[n].wings[tt];
  for (const [lab, z] of [['overview', w.overview], ...w.bullets.map((b, i) => [`bullet${i + 1}`, b]), ['resource', w.resource]]) {
    if (!z) continue;
    const c = (z.text.match(/…/g) || []).length;
    if (c) { ell++; console.log(`  T${n} w${tt} ${lab}: ${c} ellipsis · stored ${z.text.length}ch -> effective ${z.text.length + 2 * c}ch`); }
  }
}
console.log(`  ${ell} zones contain U+2026` + (ell ? '' : ' — none'));

console.log('\n--- (2) curly punctuation (left as-is by instruction; _v3Straighten handles at render) ---');
let curlyZones = 0, curlyChars = 0;
for (const n of Object.keys(types)) for (const tt of Object.keys(types[n].wings)) {
  const w = types[n].wings[tt];
  for (const z of [w.overview, ...w.bullets, w.resource].filter(Boolean)) {
    const c = (z.text.match(/[‘’“”]/g) || []).length;
    if (c) { curlyZones++; curlyChars += c; }
  }
}
console.log(`  ${curlyZones} zones carry ${curlyChars} curly quote/apostrophe characters — NOT pre-straightened`);

console.log('\n=== PROBLEMS ===');
if (problems.length) { problems.forEach(p => console.log('  *** ' + p)); }
else console.log('  none — every zone parsed cleanly');

fs.writeFileSync(OUT, JSON.stringify({ types, problems, zoneCount }, null, 2));
console.log(`\nwrote ${OUT}`);
