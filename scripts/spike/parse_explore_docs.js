'use strict';
/**
 * p6/p7 source-document parser — the ingest path for INTERIM_EXPLORE_V3.
 *
 * Input is the nine Google Docs exported as markdown, one file per type, in a directory.
 * The export step is MANUAL (Drive is not reachable from node here), so this parses files
 * rather than fetching. The files are throwaway; the documents are the source of record.
 *
 * FOUR REQUIREMENTS, each from a defect found in docs/audit_pr3e_source_rebuild_v2.md.
 * They are requirements, not conveniences — three of the four fail SILENTLY if dropped.
 *
 *  1. KEY ON (section, zone). THINKING / FEELING / BEHAVING each appear TWICE per document
 *     at the same heading level — once under TYPICAL PATTERNS with a numeric prefix, once
 *     under CATCHING YOUR PATTERNS without. A flat zoneName -> value map keeps whichever it
 *     reads last and loses three zones per document with no error at all.
 *
 *  2. HARD STOP AT THE SECOND `#`. Everything below `# END OF CONTENT …` is budgets,
 *     structure notes and Notes for review. Those carry italic `*…*` spans and `  - ` bullet
 *     lists that a lenient parser reads as budgets and content. Stopping is not a filter
 *     applied afterwards; the scan ends there.
 *
 *  3. READ THE TYPE FROM `type: N`, a plain paragraph between the H1 and the first `##`.
 *     Not from the title. A title regex that mis-fires mis-files forty zones silently.
 *
 *  4. NORMALISE QUOTES. The export returns curly apostrophes; the library on main is
 *     entirely straight — 0 curly of either kind across 160 strings, measured. Storing raw
 *     would make the round-trip report up to 43 false differences and bury any real one.
 *     The transform is the one `_v3Straighten` applies at render, so this is not a new
 *     convention: it moves an existing render-time normalisation to ingest time, where it
 *     can be asserted.
 *
 * Also handled: headings export with optional `**` inside the text; bullets export as
 * `  - `; `**Label** — body` keeps the em dash in `body`, matching what is already stored
 * on main for the four built types.
 *
 *   node scripts/spike/parse_explore_docs.js <dir>            # parse, report, validate
 *   node scripts/spike/parse_explore_docs.js <dir> --emit     # emit the INTERIM_EXPLORE_V3 literal
 *   node scripts/spike/parse_explore_docs.js <dir> --diff     # diff against the built library
 *   node scripts/spike/parse_explore_docs.js <dir> --budgets  # measured chars vs budget
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

/** The transform `_v3Straighten` applies in app/renderer.js, applied here at ingest instead. */
const straighten = (s) => String(s)
  .replace(/’/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/…/g, '...');

const clean = (s) => straighten(String(s).replace(/\s+/g, ' ').trim());
/** Heading text arrives as `**WORLDVIEW**` or `WORLDVIEW` depending on the export. */
const unbold = (s) => String(s).replace(/^\*\*(.*)\*\*$/, '$1').trim();

const SENTINEL = /^#\s+\**END OF CONTENT/i;

/** Budgets as printed in each document's own table, below the sentinel. */
const BUDGET = {
  worldview: 155, core_motivation: 210, core_belief: 107,
  glance: [80, 111, 80, 111],
  patterns: 201,
  best: null, edge: null,            // "under revision" — §7.4 strikes the old ceiling
  style_bullet: 90, style_name: 29,
  catching: null,                    // "under revision"
};

function parseDoc(text, file) {
  const lines = text.split('\n');
  const err = (m) => { throw new Error(`${path.basename(file)}: ${m}`); };

  // ── requirement 2: hard stop at the SECOND `#` ────────────────────────────────
  let stop = lines.length, seenH1 = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^#\s/.test(lines[i]) && !/^##/.test(lines[i])) {
      seenH1++;
      if (seenH1 === 2) { stop = i; break; }
    }
  }
  if (seenH1 < 2) err('no END OF CONTENT sentinel found (expected a second `#`)');
  if (!SENTINEL.test(lines[stop])) err(`second \`#\` is not the sentinel: "${lines[stop].slice(0, 60)}"`);
  const body = lines.slice(0, stop);

  // ── requirement 3: `type: N`, between the H1 and the first `##` ───────────────
  let type = null;
  for (const l of body) {
    if (/^##/.test(l)) break;
    const m = l.match(/^type:\s*([1-9])\s*$/i);
    if (m) { type = +m[1]; break; }
  }
  if (type == null) err('no `type: N` line between the title and the first `##`');

  // ── requirement 1: walk keyed on (section, zone) ──────────────────────────────
  const sections = new Map();          // section -> Map(zone -> {tagline, lines[]})
  let sec = null, zone = null, rec = null;
  for (const raw of body) {
    const l = raw.replace(/\s+$/, '');
    let m;
    if ((m = l.match(/^####\s+(.*)$/))) { if (rec) rec.tagline = clean(unbold(m[1])); continue; }
    if ((m = l.match(/^###\s+(.*)$/)))  {
      zone = unbold(m[1]).toUpperCase();
      rec = { tagline: null, lines: [] };
      if (!sec) err(`zone "${zone}" before any section`);
      sections.get(sec).set(zone, rec);
      continue;
    }
    if ((m = l.match(/^##\s+(.*)$/)))   {
      sec = unbold(m[1]).toUpperCase(); zone = null; rec = null;
      if (!sections.has(sec)) sections.set(sec, new Map());
      continue;
    }
    if (/^#\s/.test(l)) continue;                       // the title
    if (!rec) continue;                                 // prose outside a zone (the `type:` line)
    if (!l.trim()) continue;
    rec.lines.push(l.trim());
  }

  const S = (name) => {
    const k = [...sections.keys()].find(x => x.startsWith(name));
    if (!k) err(`section "${name}" not found`);
    return sections.get(k);
  };
  const Z = (section, name) => {
    const z = S(section).get(name);
    if (!z) err(`zone "${name}" not found in section "${section}"`);
    return z;
  };
  const one = (section, name) => {
    const z = Z(section, name);
    if (z.lines.length !== 1) err(`zone "${name}" has ${z.lines.length} paragraphs, expected 1`);
    return clean(z.lines[0]);
  };

  // `**Label** — body`. The em dash stays in body, matching what main already stores.
  const labelled = (section, name) => {
    const z = Z(section, name);
    if (z.lines.length !== 3) err(`"${name}" has ${z.lines.length} lines, expected 3`);
    return z.lines.map((l) => {
      const m = l.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (!m) err(`"${name}": line does not match **Label** — body: "${l.slice(0, 50)}"`);
      const body = clean(m[2]);
      if (!body.startsWith('—')) err(`"${name}": body does not open with an em dash: "${body.slice(0, 40)}"`);
      return { title: clean(m[1]), body };
    });
  };

  const chicklet = (name) => {
    const z = Z('COMMUNICATION', name);
    const bullets = z.lines.filter(l => /^-\s/.test(l)).map(l => clean(l.replace(/^-\s*/, '')));
    if (!z.tagline) err(`"${name}" has no #### tagline`);
    if (bullets.length !== 3) err(`"${name}" has ${bullets.length} bullets, expected 3`);
    return { name: z.tagline, bullets };
  };

  // CATCHING: three zones, each a Sign: line and an Interrupt: line. Labelled, not positional.
  const catching = ['THINKING', 'FEELING', 'BEHAVING'].map((n) => {
    const z = Z('CATCHING', n);
    const get = (k) => {
      const hit = z.lines.find(l => new RegExp(`^${k}:`, 'i').test(l));
      if (!hit) err(`CATCHING/${n} has no "${k}:" line`);
      return clean(hit.replace(new RegExp(`^${k}:\\s*`, 'i'), ''));
    };
    return { sign: get('Sign'), interrupt: get('Interrupt') };
  });

  const glanceNames = ['CORE DESIRE', 'ATTENTION GOES TO', 'AVOIDANCE', 'DRIVING EMOTION'];
  const patternNames = ['1 THINKING', '2 FEELING', '3 BEHAVING'];

  return {
    type,
    p6: {
      core_motivation: one('P6', 'CORE MOTIVATION'),
      worldview: one('P6', 'WORLDVIEW'),
      core_belief: one('P6', 'CORE BELIEF'),
      glance: glanceNames.map(n => one('AT A GLANCE', n)),
      patterns: patternNames.map(n => one('TYPICAL PATTERNS', n)),
    },
    p7: {
      best: labelled('P7', 'AT YOUR BEST'),
      edge: labelled('P7', 'YOUR GROWING EDGE'),
      styles: ['COMMUNICATION STYLE', 'CONFLICT STYLE', 'DECISION-MAKING STYLE'].map(chicklet),
      signs: catching.map(c => c.sign),
      interrupt: catching.map(c => c.interrupt),
    },
  };
}

function loadAll(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
    const d = parseDoc(fs.readFileSync(path.join(dir, f), 'utf8'), f);
    if (out[d.type]) throw new Error(`two documents claim type ${d.type}`);
    out[d.type] = d;
  }
  return out;
}

// ── leaf flattening, shared by --diff and the counts ────────────────────────────
function leaves(e) {
  const o = {};
  o['p6.worldview'] = e.p6.worldview;
  o['p6.core_motivation'] = e.p6.core_motivation;
  o['p6.core_belief'] = e.p6.core_belief;
  e.p6.glance.forEach((v, i) => o[`p6.glance[${i}]`] = v);
  e.p6.patterns.forEach((v, i) => o[`p6.patterns[${i}]`] = v);
  for (const k of ['best', 'edge']) e.p7[k].forEach((v, i) => {
    o[`p7.${k}[${i}].title`] = v.title; o[`p7.${k}[${i}].body`] = v.body;
  });
  e.p7.styles.forEach((s, i) => {
    o[`p7.styles[${i}].name`] = s.name;
    s.bullets.forEach((b, j) => o[`p7.styles[${i}].bullets[${j}]`] = b);
  });
  e.p7.signs.forEach((v, i) => o[`p7.signs[${i}]`] = v);
  e.p7.interrupt.forEach((v, i) => o[`p7.interrupt[${i}]`] = v);
  return o;
}

const q = (s) => (s.includes("'") && !s.includes('"'))
  ? '"' + s.replace(/\\/g, '\\\\') + '"'
  : "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

module.exports = { straighten, parseDoc, leaves };

// CLI only. Guarded so the transform above can be unit-tested by requiring this file —
// which matters here because the manual export path strips curly characters before they
// reach the parser, so real data never exercises straighten().
if (require.main === module) (function main() {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: parse_explore_docs.js <dir> [--emit|--diff|--budgets]'); process.exit(2); }
  const all = loadAll(dir);
  const types = Object.keys(all).map(Number).sort((a, b) => a - b);

  if (process.argv.includes('--emit')) {
    const L = ['const INTERIM_EXPLORE_V3 = {'];
    for (const t of types) {
      const e = all[t];
      L.push(`  ${t}: {`);
      L.push('    p6: {');
      L.push(`      core_motivation: ${q(e.p6.core_motivation)},`);
      L.push(`      worldview: ${q(e.p6.worldview)},`);
      L.push(`      core_belief: ${q(e.p6.core_belief)},`);
      L.push('      glance: [');
      for (const g of e.p6.glance) L.push(`        ${q(g)},`);
      L.push('      ],');
      L.push('      patterns: [');
      for (const p of e.p6.patterns) L.push(`        ${q(p)},`);
      L.push('      ],');
      L.push('    },');
      L.push('    p7: {');
      for (const k of ['best', 'edge']) {
        L.push(`      ${k}: [`);
        for (const it of e.p7[k]) L.push(`        { title: ${q(it.title)}, body: ${q(it.body)} },`);
        L.push('      ],');
      }
      L.push('      styles: [');
      for (const s of e.p7.styles) {
        L.push('        {');
        L.push(`          name: ${q(s.name)},`);
        L.push('          bullets: [');
        for (const b of s.bullets) L.push(`            ${q(b)},`);
        L.push('          ],');
        L.push('        },');
      }
      L.push('      ],');
      for (const k of ['signs', 'interrupt']) {
        L.push(`      ${k}: [`);
        for (const v of e.p7[k]) L.push(`        ${q(v)},`);
        L.push('      ],');
      }
      L.push('    },');
      L.push('  },');
    }
    L.push('};');
    process.stdout.write(L.join('\n') + '\n');
    return;
  }

  if (process.argv.includes('--diff')) {
    const lib = require(path.join(ROOT, 'app/content/content_library.json'));
    let same = 0; const diffs = [];
    for (const t of types) {
      const built = lib[`type_${t}`] && lib[`type_${t}`].explore_v3;
      if (!built) { console.log(`  type ${t}: not in the library (unbuilt) — skipped`); continue; }
      const A = leaves(built), B = leaves(all[t]);
      for (const k of Object.keys(B)) {
        // Normalise BOTH sides: the library is already straight, but comparing post-transform
        // is what makes a real difference visible instead of drowned in 43 curly apostrophes.
        const a = straighten(A[k] == null ? '' : A[k]), b = straighten(B[k]);
        if (a === b) same++; else diffs.push({ t, k, a, b });
      }
    }
    console.log(`\nFOUR-TYPE RE-DIFF — library vs source, post-normalisation`);
    console.log(`  ${same} leaves identical, ${diffs.length} differ\n`);
    for (const d of diffs) {
      console.log(`  T${d.t} ${d.k}`);
      console.log(`    lib (${d.a.length}ch) |${d.a}|`);
      console.log(`    doc (${d.b.length}ch) |${d.b}|`);
    }
    return;
  }

  if (process.argv.includes('--budgets')) {
    console.log('\nMEASURED CHARACTERS vs the budget each document prints');
    console.log('  (§7.4 strikes the At Your Best / Growing Edge / Catching ceilings and publishes no replacement —');
    console.log('   those are reported as measurements only, with no pass/fail.)\n');
    console.log('type  zone                        chars  budget  over');
    for (const t of types) {
      const e = all[t], rows = [];
      rows.push(['worldview', e.p6.worldview.length, BUDGET.worldview]);
      rows.push(['core_motivation', e.p6.core_motivation.length, BUDGET.core_motivation]);
      rows.push(['core_belief', e.p6.core_belief.length, BUDGET.core_belief]);
      e.p6.glance.forEach((g, i) => rows.push([`glance[${i}]`, g.length, BUDGET.glance[i]]));
      e.p6.patterns.forEach((p, i) => rows.push([`patterns[${i}]`, p.length, BUDGET.patterns]));
      e.p7.styles.forEach((s, i) => {
        rows.push([`styles[${i}].name`, s.name.length, BUDGET.style_name]);
        s.bullets.forEach((b, j) => rows.push([`styles[${i}].bullets[${j}]`, b.length, BUDGET.style_bullet]));
      });
      for (const [k, arr] of [['best', e.p7.best], ['edge', e.p7.edge]])
        arr.forEach((it, i) => rows.push([`${k}[${i}] rendered`, it.title.length + 1 + it.body.length, null]));
      e.p7.signs.forEach((s, i) => rows.push([`signs[${i}]`, s.length, null]));
      e.p7.interrupt.forEach((s, i) => rows.push([`interrupt[${i}]`, s.length, null]));
      for (const [n, c, b] of rows) {
        const over = b != null && c > b;
        if (b != null && !over) continue;                   // only print budgeted-and-over, plus all unbudgeted
        console.log(`  ${t}   ${n.padEnd(26)} ${String(c).padStart(5)}  ${String(b == null ? '—' : b).padStart(6)}  ${over ? '*** OVER by ' + (c - b) : ''}`);
      }
    }
    return;
  }

  console.log(`parsed ${types.length} documents: types ${types.join(', ')}`);
  let n = 0;
  for (const t of types) n += Object.keys(leaves(all[t])).length;
  console.log(`leaves: ${n}  (${n / types.length} per type)`);
})();
