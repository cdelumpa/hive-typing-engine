'use strict';

/**
 * build_content_library.js — Step 7 Phase 2.
 *
 * Compiles the static content library docx into app/content/content_library.json.
 * Authoring surface stays Word; this script parses it into the runtime store.
 * Offline; no API key. Word stays the single editing surface (handles smart quotes).
 *
 *   docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx
 *        │  node scripts/build_content_library.js
 *        ▼
 *   app/content/content_library.json   (keys: type_1..type_9, subtype_sp1..sx9, static)
 *
 * Hard coverage gate: 9 types × required keys, 27 subtypes × 3 pattern blocks +
 * narrative + shifts; wing/line targets validated against the engine. The 6 global
 * static.* units are not in the docx — emitted as null with a PENDING warning
 * (not a hard fail), pending a separate authoring pass before Phase 6.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const JSZip = require(path.join(ROOT, 'app/node_modules/jszip'));

const DOCX = path.join(ROOT, 'docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx');
const OUT  = path.join(ROOT, 'app/content/content_library.json');

// INTERIM SOURCE — provisional welcome content pending canonical binary-docx
// reconciliation (tracked offline). Do not treat as permanent source of truth.
// When the canonical step7-incoming docx gains a Word-styled WELCOME PAGE section,
// replace this with a parseStatics() read and confirm regenerated output is identical.
const INTERIM_WELCOME = {
  subhead: "You just did something most people never do.",
  letters: [
    "You took the time to look inward. That’s not a small thing. Whether you’re here because a coach recommended this, a colleague forwarded it, or you simply got curious — we’re glad you showed up!",
    "What you’re holding is a hypothesis about your personality — specifically, a map of what drives you, how you see the world, and why you do the things you do. It’s built from how you responded to the InsightOut Assessment, and it’s designed to be a starting point, not a final word.",
    "This report is organized as a journey: first, a brief introduction to the Enneagram system itself, then a deep dive into the pattern your responses point to most strongly. Along the way we’ll also introduce a secondary hypothesis — another pattern worth exploring with a coach.",
    "There’s no perfect outcome here. The goal isn’t to be “typed correctly” — it’s to see yourself a little more clearly, and to have a richer conversation with whoever helps you go deeper.",
    "We hope it lands!"
  ],
  callout: "You are the final authority on your own type. If something in here resonates deeply, wonderful — that’s the recognition we’re going for. If something doesn’t quite fit, that’s useful information too. Hold all of it lightly, and stay curious."
};

// Engine source of truth (mirrors renderer TYPE_NAMES + design A6; Phase 4 centralizes into type_meta.js).
const TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer', 4: 'The Individualist',
  5: 'The Observer', 6: 'The Questioner', 7: 'The Enthusiast', 8: 'The Protector', 9: 'The Peacemaker',
};
const TYPE_META = {
  1: { stress: 4, security: 7, wings: [9, 2] }, 2: { stress: 8, security: 4, wings: [1, 3] },
  3: { stress: 9, security: 6, wings: [2, 4] }, 4: { stress: 2, security: 1, wings: [3, 5] },
  5: { stress: 7, security: 8, wings: [4, 6] }, 6: { stress: 3, security: 9, wings: [5, 7] },
  7: { stress: 1, security: 5, wings: [6, 8] }, 8: { stress: 5, security: 2, wings: [7, 9] },
  9: { stress: 6, security: 3, wings: [8, 1] },
};
const INSTINCT_OF = { SP: 'sp', SO: 'so', SX: 'sx' };

// ── XML → tokens ──────────────────────────────────────────────────────────────
function unescapeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function tokenize(xml) {
  const chunks = xml.split(/(?=<w:p[ >])/);
  const toks = [];
  for (const c of chunks) {
    if (!/^<w:p[ >]/.test(c)) continue;
    const styleM = c.match(/<w:pStyle w:val="([^"]+)"/);
    const style = styleM ? styleM[1] : 'Normal';
    const text = unescapeXml([...c.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map(m => m[1]).join('')).trim();
    if (!text) continue;
    toks.push({ style, text, label: isLabel(text), bullet: style === 'ListParagraph' });
  }
  return toks;
}
function isLabel(t) {
  if (t.length > 60) return false;
  const letters = [...t].filter(ch => /[a-z]/i.test(ch));
  if (!letters.length) return false;
  return letters.filter(ch => ch === ch.toUpperCase()).length / letters.length > 0.85;
}
const stripWc = (s) => /^\[word count/i.test(s);

// ── Block model: a label + the non-label tokens until the next label ──────────
function toBlocks(toks) {
  const blocks = [];
  let cur = null;
  for (const t of toks) {
    if (t.label) { cur = { label: t.text, paras: [], bullets: [] }; blocks.push(cur); }
    else if (cur) { (t.bullet ? cur.bullets : cur.paras).push(t.text); }
  }
  return blocks;
}
const findBlock  = (blocks, label) => blocks.find(b => b.label === label);
const findByRe   = (blocks, re)    => blocks.filter(b => re.test(b.label));
const normParas  = (b) => (b ? b.paras.filter(p => !stripWc(p)) : []);

// ── Assemble one type ─────────────────────────────────────────────────────────
const errs = [];
function need(cond, msg) { if (!cond) errs.push(msg); }

function assembleType(n, blocks) {
  const name = TYPE_NAMES[n];
  const t = { number: n, name };

  // description
  const world = findBlock(blocks, 'HOW YOU SEE THE WORLD');
  const motiv = findBlock(blocks, 'CORE MOTIVATION');
  t.description = { worldview: (normParas(world)[0] || ''), core_motivation: (normParas(motiv)[0] || '') };

  // patterns + inquiry_lines
  t.patterns = {};
  for (const [key, lab] of [['thinking', 'PATTERN OF THINKING'], ['feeling', 'PATTERN OF FEELING'], ['behaving', 'PATTERN OF BEHAVING']]) {
    const b = findBlock(blocks, lab);
    const np = normParas(b);
    const inquiry = (np.find(p => /^Inquiry:/i.test(p)) || '').replace(/^Inquiry:\s*/i, '');
    const intro = np.find(p => !/^Inquiry:/i.test(p)) || '';
    t.patterns[key] = { intro, bullets: b ? b.bullets : [], inquiry };
  }
  t.inquiry_lines = ['thinking', 'feeling', 'behaving'].map(k => t.patterns[k].inquiry).filter(Boolean);

  // wings (order → wing_a, wing_b; target type parsed from label, validated vs engine)
  const wingBlocks = findByRe(blocks, /^TYPE \d WING/);
  t.wings = {};
  ['wing_a', 'wing_b'].forEach((slot, i) => {
    const b = wingBlocks[i];
    const tt = b && b.label.match(/^TYPE (\d) WING/);
    t.wings[slot] = { target_type: tt ? +tt[1] : null, body: normParas(b).join('\n\n') };
  });

  // lines (order → stress, security; target parsed; resource_card from "Resource card:")
  const lineBlocks = findByRe(blocks, /^MOVING TOWARD TYPE/);
  t.lines = {};
  ['stress', 'security'].forEach((slot, i) => {
    const b = lineBlocks[i];
    const tt = b && b.label.match(/TYPE (\d)/);
    const np = normParas(b);
    const card = (np.find(p => /^Resource card:/i.test(p)) || '').replace(/^Resource card:\s*/i, '');
    const narrative = np.find(p => !/^Resource card:/i.test(p)) || '';
    t.lines[slot] = { target_type: tt ? +tt[1] : null, narrative, resource_card: card };
  });

  // strengths / challenges → 3 {title, body} pairs each
  const pairs = (label) => {
    const np = normParas(findBlock(blocks, label));
    const out = [];
    for (let i = 0; i + 1 < np.length; i += 2) out.push({ title: np[i], body: np[i + 1] });
    return out;
  };
  t.strengths = pairs('STRENGTHS');
  t.challenges = pairs('CHALLENGES');

  // practices → {intro, bullets}
  const pr = findBlock(blocks, 'PRACTICES THAT HELP');
  t.practices = { intro: (normParas(pr)[0] || ''), bullets: pr ? pr.bullets : [] };

  // application: communication / conflict / center (subhead+framework live in the PRIOR block's paras)
  const subFw = (b) => { const np = normParas(b); return { subhead: np[0] || '', framework: np[1] || '' }; };
  const comm = findBlock(blocks, 'HOW YOU NATURALLY COMMUNICATE');
  const watch = findBlock(blocks, 'WHAT TO WATCH FOR');
  const conf = findBlock(blocks, 'HOW CONFLICT SHOWS UP FOR YOU');
  const work = findBlock(blocks, 'WORKING WITH IT');
  const cen  = findBlock(blocks, 'YOUR CENTER OF INTELLIGENCE');
  const off  = findBlock(blocks, "WHEN YOU'RE OFF-CENTER");
  t.communication = { ...subFw(findBlock(blocks, 'PUTTING IT ALL TOGETHER — APPLICATION')), bullets: comm ? comm.bullets : [], watch_for: watch ? watch.bullets : [] };
  t.conflict      = { ...subFw(watch), bullets: conf ? conf.bullets : [], working_with: work ? work.bullets : [] };
  t.center        = { ...subFw(work), bullets: cen ? cen.bullets : [], off_center: off ? off.bullets : [] };

  // comparison rows
  const cmp = findBlock(blocks, 'COMPARISON ROWS (PAGES 3 & COACH REPORT)');
  const rowMap = { 'core motivation': 'core_motivation', 'focus of attention': 'focus', 'energy goes to': 'energy', 'gifts': 'gifts', 'challenges': 'challenges' };
  t.comparison = {};
  for (const p of normParas(cmp)) {
    const m = p.match(/^([^:]+):\s*(.+)$/s);
    if (m && rowMap[m[1].trim().toLowerCase()]) t.comparison[rowMap[m[1].trim().toLowerCase()]] = m[2].trim();
  }
  return t;
}

// ── Assemble subtypes under an H2 region ──────────────────────────────────────
function assembleSubtypes(n, toks) {
  const out = {}; // 'sp8' -> {...}
  let cur = null, field = null, awaitTagline = false;
  const open = (code, name) => {
    const inst = INSTINCT_OF[code.slice(0, 2)];
    cur = { code, name, tagline: '', narrative: '', patterns: { thinking: [], feeling: [], behaving: [] }, shifts: [] };
    out[`${inst}${n}`] = cur; field = null; awaitTagline = true;
  };
  for (const t of toks) {
    const m = !t.bullet && t.text.match(/^(SP|SO|SX)(\d)\s*[—–-]\s*(.+)$/);
    if (m && +m[2] === n) { open(`${m[1]}${m[2]}`, m[3].trim()); continue; }
    if (!cur) continue;
    if (awaitTagline && !t.label && !t.bullet) { cur.tagline = t.text; awaitTagline = false; continue; }
    if (t.label) {
      if (t.text === 'SUBTYPE NARRATIVE') field = 'narrative';
      else if (/^PATTERN BULLETS — THINKING/.test(t.text)) field = 'p_thinking';
      else if (/^PATTERN BULLETS — FEELING/.test(t.text))  field = 'p_feeling';
      else if (/^PATTERN BULLETS — BEHAVING/.test(t.text)) field = 'p_behaving';
      else if (/^WHAT SHIFTS/.test(t.text)) field = 'shifts';
      else field = null;
      continue;
    }
    if (stripWc(t.text)) continue;
    if (field === 'narrative' && !t.bullet) cur.narrative = cur.narrative ? cur.narrative + '\n\n' + t.text : t.text;
    else if (field === 'p_thinking' && t.bullet) cur.patterns.thinking.push(t.text);
    else if (field === 'p_feeling'  && t.bullet) cur.patterns.feeling.push(t.text);
    else if (field === 'p_behaving' && t.bullet) cur.patterns.behaving.push(t.text);
    else if (field === 'shifts'     && t.bullet) cur.shifts.push(t.text);
  }
  return out;
}

// ── Parse the GLOBAL STATIC CONTENT section → static.* (Phase 6 prerequisite) ──
function parseStatics(toks) {
  const blocks = toBlocks(toks);
  const linesOf = (label) => normParas(findBlock(blocks, label));
  const text = (label) => linesOf(label).join('\n\n');
  const pipeRows = (label, keys) => linesOf(label).map(line => {
    const parts = line.split('|').map(s => s.trim());
    const o = {}; keys.forEach((k, i) => { o[k] = parts[i] || ''; }); return o;
  });
  const primer = {
    intro: text('ENNEAGRAM PRIMER INTRO'),
    scan_line: linesOf('ENNEAGRAM PRIMER SCAN LINE')[0] || '',
    pillars: pipeRows('ENNEAGRAM PRIMER PILLARS', ['title', 'body']),
    nine_types: pipeRows('ENNEAGRAM PRIMER NINE TYPES', ['number', 'center', 'name', 'description', 'gifts'])
      .map(r => ({ ...r, number: +r.number })),
    footer: linesOf('ENNEAGRAM PRIMER FOOTER')[0] || '',
  };
  return {
    welcome_body: text('WELCOME BODY'),
    welcome: INTERIM_WELCOME,   // INTERIM (see top): structured welcome; welcome_body kept additively
    primer,
    wings_primer: text('WINGS PRIMER'),
    lines_primer: text('LINES PRIMER'),
    instinct_primer: text('INSTINCT PRIMER'),
    instinct_definitions: pipeRows('INSTINCT DEFINITIONS', ['code', 'name', 'body']),
  };
}

// ── Validation (hard gate for type/subtype AND the static globals) ────────────
function validateType(n, t) {
  const P = `type_${n}`;
  need(t.name === TYPE_NAMES[n], `${P}: name "${t.name}" != engine "${TYPE_NAMES[n]}"`);
  need(t.description.worldview, `${P}.description.worldview empty`);
  need(t.description.core_motivation, `${P}.description.core_motivation empty`);
  for (const k of ['thinking', 'feeling', 'behaving']) {
    need(t.patterns[k].intro, `${P}.patterns.${k}.intro empty`);
    need(t.patterns[k].bullets.length >= 1, `${P}.patterns.${k}.bullets empty`);
    need(t.patterns[k].inquiry, `${P}.patterns.${k}.inquiry empty`);
  }
  need(t.inquiry_lines.length === 3, `${P}.inquiry_lines = ${t.inquiry_lines.length} (want 3)`);
  const wt = [t.wings.wing_a.target_type, t.wings.wing_b.target_type].sort();
  need(JSON.stringify(wt) === JSON.stringify([...TYPE_META[n].wings].sort()), `${P}.wings targets ${wt} != engine ${TYPE_META[n].wings}`);
  need(t.wings.wing_a.body && t.wings.wing_b.body, `${P}.wings body empty`);
  need(t.lines.stress.target_type === TYPE_META[n].stress, `${P}.lines.stress target ${t.lines.stress.target_type} != engine ${TYPE_META[n].stress}`);
  need(t.lines.security.target_type === TYPE_META[n].security, `${P}.lines.security target ${t.lines.security.target_type} != engine ${TYPE_META[n].security}`);
  for (const s of ['stress', 'security']) { need(t.lines[s].narrative, `${P}.lines.${s}.narrative empty`); need(t.lines[s].resource_card, `${P}.lines.${s}.resource_card empty`); }
  need(t.strengths.length === 3, `${P}.strengths = ${t.strengths.length} (want 3)`);
  need(t.challenges.length === 3, `${P}.challenges = ${t.challenges.length} (want 3)`);
  need(t.practices.bullets.length >= 1, `${P}.practices.bullets empty`);
  for (const [k, sub] of [['communication', 'watch_for'], ['conflict', 'working_with'], ['center', 'off_center']]) {
    need(t[k].subhead, `${P}.${k}.subhead empty`);
    need(t[k].framework, `${P}.${k}.framework empty`);
    need(t[k].bullets.length >= 1, `${P}.${k}.bullets empty`);
    need(t[k][sub].length >= 1, `${P}.${k}.${sub} empty`);
  }
  for (const r of ['core_motivation', 'focus', 'energy', 'gifts', 'challenges']) need(t.comparison[r], `${P}.comparison.${r} empty`);
}
function validateSubtype(key, st) {
  const P = `subtype_${key}`;
  need(st.name, `${P}.name empty`); need(st.tagline, `${P}.tagline empty`); need(st.narrative, `${P}.narrative empty`);
  for (const k of ['thinking', 'feeling', 'behaving']) need(st.patterns[k].length >= 1, `${P}.patterns.${k} empty`);
  need(st.shifts.length >= 1, `${P}.shifts empty`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const buf = fs.readFileSync(DOCX);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  const toks = tokenize(xml);

  // Split into type regions by H1; within each, the H2 begins the subtype region.
  const h1idx = toks.map((t, i) => ({ t, i })).filter(x => x.t.style === 'Heading1');
  const lib = { _meta: { source: path.basename(DOCX), built_at: new Date().toISOString(), version: 'v1_060526' }, static: {
    primer: null, welcome_body: null, welcome: null, instinct_primer: null, instinct_definitions: null, wings_primer: null, lines_primer: null,
  } };
  const seenTypes = [];

  for (let k = 0; k < h1idx.length; k++) {
    const start = h1idx[k].i;
    const end = k + 1 < h1idx.length ? h1idx[k + 1].i : toks.length;
    if (toks[start].text === 'GLOBAL STATIC CONTENT') {
      lib.static = parseStatics(toks.slice(start + 1, end));
      continue;
    }
    const m = toks[start].text.match(/^Type (\d)\s*[—–-]\s*(.+)$/);
    if (!m) { errs.push(`Unparseable H1: "${toks[start].text}"`); continue; }
    const n = +m[1];
    seenTypes.push(n);
    const region = toks.slice(start + 1, end);
    const h2 = region.findIndex(t => t.style === 'Heading2');
    const typeToks = h2 >= 0 ? region.slice(0, h2) : region;
    const subToks  = h2 >= 0 ? region.slice(h2 + 1) : [];

    const t = assembleType(n, toBlocks(typeToks));
    const firstPara = typeToks.find(x => !x.label && !x.bullet);
    t.center_label = firstPara ? firstPara.text : '';  // e.g. "Body/Gut Center" — NOT the center-of-intelligence block
    lib[`type_${n}`] = t;

    const subs = assembleSubtypes(n, subToks);
    for (const [key, st] of Object.entries(subs)) lib[`subtype_${key}`] = st;
  }

  // Coverage validation
  for (let n = 1; n <= 9; n++) {
    if (!lib[`type_${n}`]) { errs.push(`type_${n} MISSING`); continue; }
    validateType(n, lib[`type_${n}`]);
  }
  let subCount = 0;
  for (let n = 1; n <= 9; n++) for (const inst of ['sp', 'so', 'sx']) {
    const key = `${inst}${n}`;
    if (!lib[`subtype_${key}`]) { errs.push(`subtype_${key} MISSING`); continue; }
    subCount++; validateSubtype(key, lib[`subtype_${key}`]);
  }

  // static.* coverage — now sourced from the docx GLOBAL STATIC CONTENT section (hard gate)
  const S = lib.static || {};
  for (const k of ['welcome_body', 'wings_primer', 'lines_primer', 'instinct_primer']) need(S[k], `static.${k} empty`);
  need(S.welcome && S.welcome.subhead && Array.isArray(S.welcome.letters) && S.welcome.letters.length === 5 && S.welcome.letters.every(Boolean) && S.welcome.callout,
    'static.welcome shape invalid (want { subhead, letters[5], callout })');
  need(S.primer && S.primer.intro, 'static.primer.intro empty');
  need(S.primer && Array.isArray(S.primer.pillars) && S.primer.pillars.length === 3, `static.primer.pillars != 3 (${S.primer && S.primer.pillars && S.primer.pillars.length})`);
  need(S.primer && Array.isArray(S.primer.nine_types) && S.primer.nine_types.length === 9, `static.primer.nine_types != 9 (${S.primer && S.primer.nine_types && S.primer.nine_types.length})`);
  need(S.primer && S.primer.nine_types && S.primer.nine_types.every(t => t.number >= 1 && t.number <= 9 && t.name && t.description && t.gifts), 'static.primer.nine_types rows incomplete');
  need(Array.isArray(S.instinct_definitions) && S.instinct_definitions.length === 3, `static.instinct_definitions != 3 (${S.instinct_definitions && S.instinct_definitions.length})`);

  // Report
  console.log('=== Content library build ===');
  console.log(`Types parsed:    ${seenTypes.sort((a, b) => a - b).join(', ')} (${seenTypes.length}/9)`);
  console.log(`Subtypes parsed: ${subCount}/27`);
  const staticKeys = ['welcome_body', 'welcome', 'primer', 'wings_primer', 'lines_primer', 'instinct_primer', 'instinct_definitions'];
  const pending = staticKeys.filter(k => lib.static[k] == null);
  console.log(`Static globals:  ${staticKeys.length - pending.length}/${staticKeys.length} populated` + (pending.length ? ` — PENDING: ${pending.join(', ')}` : ' (zero PENDING)'));

  if (errs.length) {
    console.error(`\n*** COVERAGE FAILURES (${errs.length}):`);
    errs.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  fs.writeFileSync(OUT, JSON.stringify(lib, null, 2));
  console.log(`\nHARD GATE GREEN — wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
})().catch(e => { console.error('BUILD FAILED:', e.stack || e.message); process.exit(1); });
