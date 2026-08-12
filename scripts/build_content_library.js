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
const crypto = require('crypto');
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

// INTERIM SOURCE — "Using Your Wings and Lines" bullets.
// Migrated to the CMS by hand in commit 36aab5c (static.wings_using) WITHOUT a matching
// parser change, so this script did not reproduce it. Re-running the build therefore
// silently dropped the key and regressed the live Wings & Lines page to an empty list
// (renderer.js guards with `|| ''`, so it failed silently rather than crashing).
// Restoring it here makes this script the sole producer of content_library.json again,
// which is what makes a rebuild idempotent and safe. Same contract as INTERIM_WELCOME:
// when the canonical docx gains a Word-styled USING YOUR WINGS AND LINES section, replace
// this with a parseStatics() read and confirm regenerated output is identical.
const INTERIM_WINGS_USING = [
  'Notice which wing is more active this week. You don’t need to pick one permanently — just observe where the texture is coming from right now.',
  'Use your stress point as an early warning system. When you notice yourself moving into that pattern, something important has been pushed aside.',
  'Your security point is a resource, not just a destination. You can consciously move toward those qualities before you need them.',
  'Wings and lines aren’t fixed. They’re dynamic — the texture of your type shifts with context, stress, and growth.',
].join('\n');

// INTERIM SOURCE — client report v3 "Your Wings" page content.
// Hive-authored copy (design spec v3.0 section 7.1 lists wings narratives and resource
// bands as authored and approved), transcribed verbatim from the tracked reference
// implementation docs/mockup/claude_The_Peacemaker_Page_Wings_v1.html. Nothing here is
// newly written.
//
// The v3 page needs three fields per wing that the current docx schema has no sections
// for — an overview, exactly five bullets, and an "As a Resource" band — so it cannot be
// parsed out of the canonical docx yet. It lives here rather than as a hand-edit of the
// built JSON so that this script remains the only writer of that file.
//
// Type 9 only. Types 1-8 land with their page content in a later PR. When the docx gains
// TYPE {n} WING {t} OVERVIEW / BULLETS / AS A RESOURCE sections, replace this with a
// parser read (the tokenizer already handles ALL-CAPS labels and ListParagraph bullets,
// so that change is small) and confirm regenerated output is identical.
const INTERIM_WINGS_V3 = {
  9: {
    intro: 'Wings are the two types immediately adjacent to your home base type. Each wing "flavors" how your type shows up, and most people naturally lean more towards one. Both are always present, but which one shows up more is unique to you. When you access your wings intentionally they become valuable resources for balancing the automatic patterns of your home base type.',
    wings: {
      8: {
        overview: 'A Nine with a strong Eight wing carries more edge, more appetite, and more willingness to push back when pushed. The Eight wing brings access to anger as a useful signal rather than something to manage away.',
        bullets: [
          'You carry real presence, and you will protect others more readily than yourself.',
          'You can be direct, and you will confront something that matters to you.',
          'Once you know where you stand, you act on it.',
          'Others may find you more grounded and forceful than your easygoing manner suggests.',
          'Left unexamined, irritation can arrive suddenly and then vanish back into accommodation.',
        ],
        resource: "When you need to hold a position, take up space, or act decisively, reach for the Eight wing. It turns the Peacemaker's steadiness into something with backbone.",
      },
      1: {
        overview: 'A Nine with a stronger One wing carries more structure, more attention to doing things properly, and more internal discipline. The One wing brings a sense that things should be a certain way.',
        bullets: [
          'You follow through on things, where Nine energy on its own might drift.',
          'You hold standards and want things done right.',
          'You bring care and craft to what you take on.',
          'Others may find you more orderly and idealistic than they expect of a Nine.',
          'Left unchecked, quiet perfectionism can turn self-forgetting into self-judgment.',
        ],
        resource: "When you need focus, standards, or the discipline to finish something important, reach for the One wing. It channels the Peacemaker's acceptance into something more purposeful.",
      },
    },
  },
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
    // v3 client report additions (INTERIM, see top). Purely additive: target_type/body are
    // untouched, so splitWingBest() and the existing P5 renderer are unaffected.
    const v3 = INTERIM_WINGS_V3[n] && INTERIM_WINGS_V3[n].wings[t.wings[slot].target_type];
    if (v3) Object.assign(t.wings[slot], { overview: v3.overview, bullets: v3.bullets, resource: v3.resource });
  });
  if (INTERIM_WINGS_V3[n]) t.wings.intro_v3 = INTERIM_WINGS_V3[n].intro;

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
    welcome: INTERIM_WELCOME,   // INTERIM (see top): structured welcome
    primer,
    wings_primer: text('WINGS PRIMER'),
    lines_primer: text('LINES PRIMER'),
    wings_using: INTERIM_WINGS_USING,   // INTERIM (see top): restores a key a hand-edit added
    instinct_primer: text('INSTINCT PRIMER'),
    instinct_definitions: pipeRows('INSTINCT DEFINITIONS', ['code', 'name', 'body']),
  };
}

// ── Drift detection ───────────────────────────────────────────────────────────
// Flattens both trees to leaf paths and reports what a write would do to content that
// already exists. Additions are safe; changes and removals are what we guard against.
// _meta is excluded — it describes the build, not the content.
function flattenLeaves(o, prefix = '', out = {}) {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) flattenLeaves(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(o)) {
    o.forEach((v, i) => flattenLeaves(v, `${prefix}[${i}]`, out));
  } else {
    out[prefix] = o;
  }
  return out;
}
function diffAgainstExisting(outPath, nextLib) {
  if (!fs.existsSync(outPath)) return null;
  let prev;
  try { prev = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch { return null; }
  const skip = (k) => k.startsWith('_meta');
  const a = flattenLeaves(prev), b = flattenLeaves(nextLib);
  const removed = Object.keys(a).filter(k => !skip(k) && !(k in b));
  const changed = Object.keys(a).filter(k => !skip(k) && k in b && a[k] !== b[k]);
  const added   = Object.keys(b).filter(k => !skip(k) && !(k in a));
  return (removed.length || changed.length) ? { removed, changed, added } : null;
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
  // v3 "Your Wings" page fields. Gated per type: enforced only where INTERIM_WINGS_V3
  // supplies content, so types not yet authored fail loudly at their own PR, not this one.
  if (INTERIM_WINGS_V3[n]) {
    need(t.wings.intro_v3, `${P}.wings.intro_v3 empty (v3 page intro)`);
    for (const slot of ['wing_a', 'wing_b']) {
      const w = t.wings[slot];
      need(w.overview, `${P}.wings.${slot}.overview empty (v3)`);
      need(Array.isArray(w.bullets) && w.bullets.length === 5 && w.bullets.every(Boolean),
        `${P}.wings.${slot}.bullets must be exactly 5 non-empty (v3), got ${w.bullets ? w.bullets.length : 'none'}`);
      need(w.resource, `${P}.wings.${slot}.resource empty (v3 "As a Resource" band)`);
    }
  }
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
  // _meta identifies the SOURCE, not the moment of the build. A wall-clock `built_at`
  // made the output differ on every run, so the artifact churned on every rebuild and a
  // byte-level idempotence check was impossible. A digest of the docx is deterministic on
  // any machine and answers the more useful question: which source produced this file.
  const sourceSha = crypto.createHash('sha256').update(fs.readFileSync(DOCX)).digest('hex');
  const lib = { _meta: { source: path.basename(DOCX), source_sha256: sourceSha, version: 'v1_060526' }, static: {
    primer: null, welcome: null, instinct_primer: null, instinct_definitions: null, wings_primer: null, lines_primer: null,
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
  for (const k of ['wings_primer', 'lines_primer', 'wings_using', 'instinct_primer']) need(S[k], `static.${k} empty`);
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
  const staticKeys = ['welcome', 'primer', 'wings_primer', 'lines_primer', 'wings_using', 'instinct_primer', 'instinct_definitions'];
  const pending = staticKeys.filter(k => lib.static[k] == null);
  console.log(`Static globals:  ${staticKeys.length - pending.length}/${staticKeys.length} populated` + (pending.length ? ` — PENDING: ${pending.join(', ')}` : ' (zero PENDING)'));

  if (errs.length) {
    console.error(`\n*** COVERAGE FAILURES (${errs.length}):`);
    errs.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  // ── DRIFT GUARD ────────────────────────────────────────────────────────────
  // The committed content_library.json has diverged from this docx: copy was edited
  // downstream (CMS/hand edits) and never round-tripped back to Word. At the time this
  // guard was added, a rebuild would have silently REVERTED 130 leaf fields of live
  // report copy — mostly subtype narratives and the primer — and dropped one key.
  //
  // Additions are always safe. Changing or removing a field that the live report already
  // renders is not, so it now requires an explicit --accept-drift. This converts a silent
  // regression into a loud, reviewable decision.
  const drift = diffAgainstExisting(OUT, lib);
  if (drift && !process.argv.includes('--accept-drift')) {
    console.error(`\n✖ REFUSING TO WRITE — this build would change existing content.\n`);
    console.error(`  ${drift.changed.length} field(s) would CHANGE, ${drift.removed.length} would be REMOVED,`
      + ` ${drift.added.length} would be added.\n`);
    for (const k of drift.removed.slice(0, 10)) console.error(`  REMOVED  ${k}`);
    for (const k of drift.changed.slice(0, 10)) console.error(`  CHANGED  ${k}`);
    const more = drift.changed.length + drift.removed.length - Math.min(10, drift.removed.length) - Math.min(10, drift.changed.length);
    if (more > 0) console.error(`  … and ${more} more`);
    console.error(`\n  The docx is the authoring surface, but it is currently STALE relative to the`);
    console.error(`  committed library. Reconcile the two before rebuilding, or re-run with`);
    console.error(`  --accept-drift if you have confirmed the docx is now canonical.\n`);
    process.exit(1);
  }
  if (drift) {
    console.log(`\n⚠ --accept-drift: overwriting ${drift.changed.length} changed and `
      + `${drift.removed.length} removed field(s).`);
  }

  fs.writeFileSync(OUT, JSON.stringify(lib, null, 2));
  console.log(`\nHARD GATE GREEN — wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
})().catch(e => { console.error('BUILD FAILED:', e.stack || e.message); process.exit(1); });
