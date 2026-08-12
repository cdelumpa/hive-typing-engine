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
// PR 2 note: the letters below are the copy approved for the v3 twelve-page report. They
// supersede BOTH the previous interim text and the v2 mockup. The mockup's third paragraph
// described a page order v3.0 does not have — it promised "first a quick summary of your
// results, then a brief introduction", where the real order is Welcome (sheet 3) → What Is
// (sheet 4) → Quick Reference (sheet 5). Shipping it would have had page one misdescribe
// the report. See docs/audit_pr2_static_pages.md.
//
// `callout` is retained but is now ORPHANED: the v3 Welcome page has no callout box, and
// its substance ("You are the final authority on your own type") folded into letters[2].
// Kept so the shape gate still holds and so removal is a deliberate later decision, not a
// side effect of this PR.
const INTERIM_WELCOME = {
  subhead: "You just did something most people never do.",
  letters: [
    "You took the time to look inward. That's not a small thing. However you were introduced to InsightOut (through a coach, a friend, or sheer coincidence), we're glad you're here.",
    "This report is built from your answers to the InsightOut Enneagram Assessment. It introduces the basic Enneagram concepts, goes deep on your \"home base\" type, explores the dynamics that shape it, and offers development ideas for putting what you learn to work.",
    "Hold all of it as a hypothesis to be tested in the real world. You are the final authority on your own type; what follows is a starting point. Our goal is to help you see yourself more clearly: what drives you, how you see the world, and why you do the things you do. That clarity is what lets you step out of your default patterns and bring more range to everyday life.",
    "If you want to go further, connect with us or any InsightOut-certified coach, or visit www.hiveleadership.com/the-enneagram.",
    "We're honored to be on this journey with you."
  ],
  signoff: "With gratitude and respect,",
  callout: "You are the final authority on your own type. If something in here resonates deeply, wonderful — that’s the recognition we’re going for. If something doesn’t quite fit, that’s useful information too. Hold all of it lightly, and stay curious."
};

// INTERIM SOURCE — client report v3 Contents page (sheet 2). Nine entries, transcribed
// verbatim from docs/mockup/claude_The_Peacemaker_Page_TOC_v2.html except entry 07 (see
// below). Same contract as INTERIM_WELCOME: when the docx gains a CONTENTS ENTRIES section
// this becomes a parseStatics() read and the regenerated output must be identical.
//
// `start` names the FIRST sheet of the entry's span, never a page number. Entry 04 spans
// sheets 6-7 (footers 4-5) and is listed once, which is why nine entries cover ten numbered
// sheets and footer 5 never appears in the page column. Page numbers are resolved from
// V3_PAGE_ORDER at render time — never stored here.
//
// Three descriptors carry tokens: {type_word} ("Nine"), {subtype_label} ("One-to-One Nine")
// and {nickname_plural} ("Peacemakers"). Entry 07's descriptor is the one deliberate
// departure from the mockup: the shipped string read "your instincts priority", a reference
// to the instinct stack that decision D4 cut from page 10, and it was ungrammatical. The
// replacement binds to {subtype_label} rather than a [Subtype] [Nickname] pair because all
// 27 labels begin Self-Preservation / Social / One-to-One and therefore all take "a", which
// removes the a/an agreement problem instead of solving it with a conditional.
const INTERIM_CONTENTS = [
  { start: 'welcome',   desc: 'What this report is, how to use it, and what to bring to your debrief.' },
  { start: 'whatis',    desc: 'A brief introduction to the system: nine types, one dynamic map.' },
  { start: 'quickref',  desc: 'Your assessment results at a glance, and tips for your debrief conversation.' },
  { start: 'typeA',     desc: 'Your leading type, its core motivation, and how the pattern shows up in the real world.' },
  { start: 'wings',     desc: 'The two adjacent types that flavor your {type_word}, and what each one offers you.' },
  { start: 'lines',     desc: 'Where you move under pressure and in flow, and how to draw on both.' },
  { start: 'instincts', desc: 'Your dominant instinct, the three instincts, and what it means to be a {subtype_label}.' },
  { start: 'car',       desc: 'Practical ways to build courage, agility, and resilience, starting today.' },
  { start: 'thoughts',  desc: 'A closing note, questions to sit with, and what to expect in your debrief conversation.' },
];

// INTERIM SOURCE — client report v3 "Your Thoughts" page (sheet 12). Approved copy; the
// intro and prompts 3-5 supersede the mockup.
//
// Prompt 3 previously read "Of the development ideas on the previous page (Courage,
// Agility, and Resilience), what would create the most leverage…". The positional
// cross-reference was true only while Development Ideas is sheet 11 and would have broken
// silently inside a client-facing PDF on any reorder. It is deliberately gone; do not
// reintroduce it. The rewrite also drops the prompt from two rendered lines to one.
//
// Coach reference rule across Welcome and this page: "an InsightOut coach", never "your
// coach" — Welcome states a reader may have arrived "through a coach, a friend, or sheer
// coincidence", so not every reader has one.
const INTERIM_THOUGHTS = {
  intro: "Whatever landed as recognition is good data. So is whatever made you want to argue with a paragraph or two. This report is a hypothesis, not a verdict, and the only way to test it is against your own experience. The questions below are a place to start. An InsightOut coach can help you pressure‑test any of it.",
  prompts: [
    "What's one thing you want to remember from this report?",
    "What's one thing you're still curious about and want to learn more about?",
    "What's one insight from Development Ideas you'd like to work on?",
    "What would working on that insight give you?",
    "What else would you like to capture?",
  ],
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
          // U+2011 non-breaking hyphen in "self‑forgetting" (brief v2.0 §12.6). Measured:
          // Chromium broke this line at the hyphen, rendering "self-" / "forgetting" across
          // two lines. hyphens:manual does not govern breaks at hyphens that already exist
          // in the string, so the fix is the character, not a CSS property. U+2011 has the
          // same advance width as U+002D in Arial and Liberation Sans (measured 4.67px at
          // 14px), so nothing reflows.
          'Left unchecked, quiet perfectionism can turn self‑forgetting into self-judgment.',
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
    scan_heading: linesOf('ENNEAGRAM PRIMER SCAN HEADING')[0] || '',
    // ORPHANED at PR 2: the v3 "What Is the Enneagram?" page has no pillars band. Kept
    // (and still gated at 3) so removal is a deliberate decision rather than a side effect.
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
    contents: INTERIM_CONTENTS,         // INTERIM (see top): v3 Contents page, 9 entries
    thoughts: INTERIM_THOUGHTS,         // INTERIM (see top): v3 Your Thoughts page
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
    contents: null, thoughts: null,
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
  need(S.welcome && S.welcome.subhead && Array.isArray(S.welcome.letters) && S.welcome.letters.length === 5 && S.welcome.letters.every(Boolean) && S.welcome.signoff && S.welcome.callout,
    'static.welcome shape invalid (want { subhead, letters[5], signoff, callout })');
  need(S.primer && S.primer.intro, 'static.primer.intro empty');
  need(S.primer && S.primer.scan_heading, 'static.primer.scan_heading empty');
  need(S.primer && Array.isArray(S.primer.pillars) && S.primer.pillars.length === 3, `static.primer.pillars != 3 (${S.primer && S.primer.pillars && S.primer.pillars.length})`);
  need(S.primer && Array.isArray(S.primer.nine_types) && S.primer.nine_types.length === 9, `static.primer.nine_types != 9 (${S.primer && S.primer.nine_types && S.primer.nine_types.length})`);
  need(S.primer && S.primer.nine_types && S.primer.nine_types.every(t => t.number >= 1 && t.number <= 9 && t.name && t.description && t.gifts), 'static.primer.nine_types rows incomplete');
  need(Array.isArray(S.instinct_definitions) && S.instinct_definitions.length === 3, `static.instinct_definitions != 3 (${S.instinct_definitions && S.instinct_definitions.length})`);

  // v3 Contents (sheet 2) — nine entries, each naming the first sheet of its span. The
  // `start` keys are checked against V3_PAGE_ORDER by tests/report_pages_test.js; here we
  // only assert shape, so a missing entry fails the build rather than rendering a short TOC.
  need(Array.isArray(S.contents) && S.contents.length === 9, `static.contents != 9 (${S.contents && S.contents.length})`);
  need(Array.isArray(S.contents) && S.contents.every(e => e.start && e.desc), 'static.contents rows incomplete (want { start, desc })');
  // v3 Your Thoughts (sheet 12) — intro plus exactly five reflection prompts.
  need(S.thoughts && S.thoughts.intro, 'static.thoughts.intro empty');
  need(S.thoughts && Array.isArray(S.thoughts.prompts) && S.thoughts.prompts.length === 5 && S.thoughts.prompts.every(Boolean),
    `static.thoughts.prompts != 5 (${S.thoughts && S.thoughts.prompts && S.thoughts.prompts.length})`);

  // Report
  console.log('=== Content library build ===');
  console.log(`Types parsed:    ${seenTypes.sort((a, b) => a - b).join(', ')} (${seenTypes.length}/9)`);
  console.log(`Subtypes parsed: ${subCount}/27`);
  const staticKeys = ['welcome', 'primer', 'wings_primer', 'lines_primer', 'wings_using', 'instinct_primer', 'instinct_definitions', 'contents', 'thoughts'];
  const pending = staticKeys.filter(k => lib.static[k] == null);
  console.log(`Static globals:  ${staticKeys.length - pending.length}/${staticKeys.length} populated` + (pending.length ? ` — PENDING: ${pending.join(', ')}` : ' (zero PENDING)'));

  if (errs.length) {
    console.error(`\n*** COVERAGE FAILURES (${errs.length}):`);
    errs.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  // Reconciliation (PR 1.5) made the docx canonical again, so this script is a plain
  // deterministic producer once more: it builds and it writes. The build-time drift guard
  // that lived here was scaffolding for exactly that operation — it blocked a 130-field
  // revert, and "the guard stops objecting" was the signal the patch was complete.
  //
  // It is not kept, for two reasons. After reconciliation a legitimate Word edit is
  // indistinguishable to it from the corruption it existed to prevent, so --accept-drift
  // would have become the normal authoring path — and a flag used routinely is not a guard.
  // And it could not see the case that matters most: a docx edited but never rebuilt.
  //
  // The invariant is enforced instead by scripts/verify_content_library.js in CI, which
  // asserts that the committed JSON equals a fresh build. That catches a direct JSON edit
  // in the PR that makes it rather than at whoever's next rebuild, does not false-positive
  // on legitimate docx or script changes, and does catch the never-rebuilt case.
  const summary = diffAgainstExisting(OUT, lib);
  if (summary) {
    console.log(`\n  note: ${summary.changed.length} changed, ${summary.removed.length} removed, `
      + `${summary.added.length} added vs the committed library.`);
    console.log('  If you did not intend that, check whether app/content/content_library.json');
    console.log('  was edited directly — the Word source is canonical.');
  }

  fs.writeFileSync(OUT, JSON.stringify(lib, null, 2) + '\n');
  console.log(`\nHARD GATE GREEN — wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
})().catch(e => { console.error('BUILD FAILED:', e.stack || e.message); process.exit(1); });
