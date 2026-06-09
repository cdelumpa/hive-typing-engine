'use strict';
/*
 * Builds docs/hive_typing_engine_spec_v2_0.docx — the v2.0 spec-of-record,
 * regenerated from source. Run from repo root: node scripts/build_spec_v2_0.js
 */
const fs = require('fs');
const path = require('path');
const docx = require(path.join(__dirname, '..', 'app', 'node_modules', 'docx'));
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, TabStopType, TabStopPosition,
  HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
  TableOfContents,
} = docx;

const TODAY = '2026-06-09';
const CONTENT_W = 9360; // US Letter, 1" margins

// ---- helpers ---------------------------------------------------------------
const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const cellBorders = { top: border, bottom: border, left: border, right: border };
const HEAD_FILL = 'D5E8F0';
const MONO = 'Consolas';

function H1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function H2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  });
}
// paragraph from an array of run-specs ({text, bold, italics, font, ...})
function PR(runs, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: runs.map((r) => (typeof r === 'string' ? new TextRun(r) : new TextRun(r))),
  });
}
function ref(t) { return new TextRun({ text: t, font: MONO, size: 18, color: '555555' }); }
function code(t) { return new TextRun({ text: t, font: MONO, size: 20 }); }

function bullet(text, runs) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 40 },
    children: runs ? runs.map((r) => (typeof r === 'string' ? new TextRun(r) : new TextRun(r))) : [new TextRun(text)],
  });
}

function cell(content, { fill, width, bold, font, size, align } = {}) {
  const runs = Array.isArray(content) ? content : [content];
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: align,
      children: runs.map((c) => {
        if (typeof c === 'string') return new TextRun({ text: c, bold, font, size });
        return new TextRun(c);
      }),
    })],
  });
}

// build a table from a header row + data rows. cols = array of widths.
function table(cols, headers, rows, opts = {}) {
  const mono = opts.mono;
  const headRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { fill: HEAD_FILL, width: cols[i], bold: true, size: 19 })),
  });
  const bodyRows = rows.map((r) => new TableRow({
    children: r.map((c, i) => {
      // a cell value can be a string, or {t, mono, bold} or array of runs
      if (Array.isArray(c)) return cell(c, { width: cols[i] });
      if (c && typeof c === 'object') {
        return cell(c.t, { width: cols[i], font: c.mono ? MONO : undefined, size: c.mono ? 18 : (opts.size || 19), bold: c.bold });
      }
      return cell(String(c), { width: cols[i], font: mono ? MONO : undefined, size: opts.size || 19 });
    }),
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cols,
    rows: [headRow, ...bodyRows],
  });
}

function spacer() { return new Paragraph({ spacing: { after: 80 }, children: [] }); }

// monospace block (e.g. JSON contract), one Paragraph per line
function codeBlock(lines) {
  return lines.map((ln, idx) => new Paragraph({
    spacing: { after: idx === lines.length - 1 ? 120 : 0 },
    shading: { fill: 'F4F4F4', type: ShadingType.CLEAR },
    children: [new TextRun({ text: ln === '' ? ' ' : ln, font: MONO, size: 18 })],
  }));
}

// ---- content ---------------------------------------------------------------
const children = [];
const push = (...x) => x.forEach((e) => children.push(e));

// Title block
push(
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'HIVE TYPING ENGINE', bold: true, size: 40 })] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Technical Specification — v2.0 (Spec of Record)', size: 28, color: '444444' })] }),
  new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: `Regenerated from source · ${TODAY} · CONFIDENTIAL`, italics: true, size: 20, color: '666666' })] }),
  new Paragraph({ children: [new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ======================================================================= §1
push(H1('1. Purpose & Scope'));
push(P('The Hive Typing Engine administers a structured, multi-stage self-assessment and produces an Enneagram type hypothesis for debrief in a coaching session. It is a hypothesis-generator, not an oracle: all output is hypothesis-framed, in two registers — a plain-English client-facing register and an Enneagram-literate coach-facing register. Legitimate near-ties are preserved by the instrument and passed forward rather than resolved mechanically.'));

push(H2('1.1 What changed from v1 to v2'));
push(
  bullet(null, [new TextRun({ text: 'AI is the decision-maker. ', bold: true }), new TextRun('In v1 the scoring engine narrowed candidates with mechanical logic between stages. In v2 the scoring engine produces raw data only; an AI reasoning call after Stage 2 makes the candidate decision and can override the slider order.')]),
  bullet(null, [new TextRun({ text: 'Center scoring retired. ', bold: true }), new TextRun('Type→Center hypothesis lookup, center confidence, cross-center overrides, and the CT_COMBOS mechanical counter-type flag are gone. Center survives only as a per-type attribute and as one Stage 2 framework question.')]),
  bullet(null, [new TextRun({ text: 'Nine-type coherence scoring. ', bold: true }), new TextRun('Stage 1 produces a full nine-type 0–100 self-report profile plus a three-instinct profile; AI Call #1 re-scores all nine types on its own 0–100 coherence scale (a judgment of fit, not a recomputation of the sliders).')]),
  bullet(null, [new TextRun({ text: 'Four AI calls. ', bold: true }), new TextRun('Two mini-calls (Stage 0 signal; counter-type adjustment) plus the two keystone calls — AI Call #1 (candidate reasoning, post-Stage-2) and AI Call #2 (verdict + both report registers).')]),
);

push(H2('1.2 Source of truth'));
push(PR([new TextRun({ text: 'Code wins over this document. ', bold: true }), new TextRun('This spec is regenerated from the source files; where it and the code diverge, the code is correct and this document is stale. Standing instruction: change parameters in code first, then regenerate this spec (see §10). Every parameter, threshold, field name, and formula below carries a '), new TextRun({ text: 'file:line', font: MONO, size: 18 }), new TextRun(' annotation against the working tree as read on 2026-06-09 (branch '), code('main'), new TextRun(', tracking '), code('origin/typing-engine-v2'), new TextRun(').')]));

push(H2('1.3 Primary source files'));
push(table(
  [2400, 6960],
  ['File', 'Role'],
  [
    [{ t: 'app/server.js', mono: true }, 'Express server. Holds all four AI calls, their system prompts and output contracts, server-side post-processing (gap re-derivation, CT coercion, deterministic field stamping), the background job runner, and DB writes.'],
    [{ t: 'app/db.js', mono: true }, 'PostgreSQL layer. Schema DDL (CREATE/ALTER), seed data, and all query helpers. The authoritative schema source.'],
    [{ t: 'app/public/assessment.js', mono: true }, 'Client assessment app. Stage definitions, the 60 sliders, Stage 1 scoring, Stage 3/4 question banks and routing, Stage 4 outcome math, and the AI context-block builders.'],
    [{ t: 'app/public/state.js', mono: true }, 'In-browser state object, slider initialization, and the serializable-state contract used for mid-assessment resume.'],
    [{ t: 'app/public/ui.js', mono: true }, 'Presentation helpers: HTML escaping, type-library loading, and the 23-question progress bar.'],
    [{ t: 'app/renderer.js', mono: true }, 'Report renderer (HTML→PDF). Consumes the Call #2 output contract to produce the client and coach reports; not part of the typing decision path.'],
  ],
));
push(new Paragraph({ children: [new PageBreak()] }));

// ======================================================================= §2
push(H1('2. Type & Instinct Fundamentals'));

push(H2('2.1 Nine types and center mapping'));
push(PR([new TextRun('Canonical names are defined in '), ref('assessment.js:764-768'), new TextRun('. The center mapping (and its affect) is described to the AI in '), ref('server.js:149-152'), new TextRun('. Centers are a per-type attribute only — they are not scored (§1.1).')]));
push(table(
  [1400, 3000, 1400, 3560],
  ['Type', 'Name', 'Center', 'Center affect (server.js:149-152)'],
  [
    ['1', 'The Improver', 'Body', 'Anger converted inward to resentment'],
    ['2', 'The Giver', 'Heart', 'Shame/grief avoided through giving'],
    ['3', 'The Performer', 'Heart', 'Shame/grief buried under performance'],
    ['4', 'The Individualist', 'Heart', 'Shame/grief dwelt in as deficiency'],
    ['5', 'The Observer', 'Head', 'Fear managed through withdrawal and conservation'],
    ['6', 'The Questioner', 'Head', 'Fear managed through preparation / counterphobic confrontation'],
    ['7', 'The Enthusiast', 'Head', 'Fear managed through reframing and forward motion'],
    ['8', 'The Protector', 'Body', 'Anger expressed outward'],
    ['9', 'The Peacemaker', 'Body', 'Anger dissipated'],
  ],
));
push(spacer());
push(PR([new TextRun({ text: 'Center groupings: ', bold: true }), new TextRun('Body = 8, 9, 1 · Heart = 2, 3, 4 · Head = 5, 6, 7 ('), ref('server.js:149-152'), new TextRun(').')]));

push(H2('2.2 Three instincts'));
push(PR([new TextRun('The dominant-instinct hypothesis is anchored primarily on the three-instinct slider profile and the instinct open response ('), ref('server.js:1287'), new TextRun('). Slider statements per instinct: '), ref('assessment.js:260-282'), new TextRun('.')]));
push(table(
  [1400, 2400, 5560],
  ['Key', 'Instinct', 'Domain (one line)'],
  [
    ['SP', 'Self-Preservation', 'Body, comfort, resources, security, and self-reliance — looking after one’s own survival domain first.'],
    ['SO', 'Social', 'Place in the group, belonging, trust/reciprocity, and reading the social landscape.'],
    ['SX', 'Sexual / One-to-One', 'Magnetized attention, intensity, and charged one-to-one connection; the more aspirational vocabulary.'],
  ],
));

push(H2('2.3 Counter-type combinations'));
push(PR([new TextRun('Five counter-type (CT) keys are recognized. The closed set and its instinct/base-type validation live in '), ref('server.js:1404'), new TextRun(' ('), code('CT_SPEC'), new TextRun('); the comparative content (display label, counter-type, lookalike) lives in '), code('STAGE3_CT_COMPARATIVES'), new TextRun(' at '), ref('assessment.js:496-502'), new TextRun('. SO-7 and SX-6 carry an explicit lookalike-trap note in '), ref('server.js:1298'), new TextRun('.')]));
push(table(
  [1300, 3000, 1800, 3260],
  ['Key', 'Display name', 'Lookalike type', 'Note'],
  [
    [{ t: 'SO-7', mono: true }, 'SO 7 vs. Type 2', '2 (The Giver)', 'SO-7 (Sacrifice) resembles Type 2 — warm, other-focused; often ranks below 2 on sliders (server.js:1298).'],
    [{ t: 'SX-6', mono: true }, 'SX 6 vs. Type 8', '8 (The Protector)', 'SX-6 (Counterphobic) resembles Type 8 — confrontational, fear-forward; often ranks below 8 (server.js:1298).'],
    [{ t: 'SP-3', mono: true }, 'SP 3 vs. Type 1', '1 (The Improver)', 'Counter-type 3 presenting as principled/self-sufficient (assessment.js:499).'],
    [{ t: 'SP-4', mono: true }, 'SP 4 vs. Type 3', '3 (The Performer)', 'Counter-type 4 presenting as driven/resilient (assessment.js:500).'],
    [{ t: 'SX-1', mono: true }, 'SX 1 vs. Type 8', '8 (The Protector)', 'Counter-type 1 presenting as intense/forceful (assessment.js:501).'],
  ],
));
push(new Paragraph({ children: [new PageBreak()] }));

// ======================================================================= §3
push(H1('3. Stage Objectives'));
push(P('Stage objectives are stable from the v2 design intent and unchanged by the redesign (which changed plumbing, not purpose). The code does not contradict them; the AI calls and routing all key off the same per-stage roles.'));
push(table(
  [1400, 7960],
  ['Stage', 'Objective'],
  [
    ['Stage 0', 'Capture the person’s own unstructured language about how they see themselves and their shadow, before structured framing biases self-report. A raw idiolect sample for the AI.'],
    ['Stage 1', 'Establish the primary type signal (motivation/worldview resonance) and the instinct signal as full raw 0–100 profiles, with ambiguity preserved rather than resolved.'],
    ['Stage 2', 'Provide an orthogonal cross-check on the Stage 1 candidates using independent Narrative frameworks. The value is independence from Stage 1, not more of the same signal. Evidence only — no scoring.'],
    ['Stage 3', 'Discriminate the specific lookalike confusions that motivation language cannot separate, via a direct A-vs-B comparison of the live pair.'],
    ['Stage 4', 'Test the leading hypothesis against the dynamic signature (stress arrow, security arrow, habit of mind) — the one facet self-report on motivation cannot reach.'],
  ],
));
push(new Paragraph({ children: [new PageBreak()] }));

// ======================================================================= §4
push(H1('4. Stage 0 — Mini-Call'));
push(H2('4.1 Trigger and timing'));
push(PR([new TextRun('Stage 0 collects four open-text answers ('), ref('assessment.js:7-32'), new TextRun('). The mini-call fires once, on entry to the '), code('mid-assessment-reminders'), new TextRun(' phase — i.e. immediately after the client completes Stage 0 and before Stage 1 ('), ref('app.js:16'), new TextRun('). A snapshot guard re-fires only when the concatenated answers change ('), ref('app.js:6-20'), new TextRun('; snapshot stored on '), code('state.stage0LastSnapshot'), new TextRun(', '), ref('state.js:10'), new TextRun(').')]));

push(H2('4.2 Input — the four Stage 0 questions'));
push(table(
  [900, 8460],
  ['Q', 'Prompt (assessment.js:7-32)'],
  [
    ['q1', 'What are 3–5 words or phrases you would use to describe yourself?'],
    ['q2', 'What are 3–5 words or phrases others would use to describe you?'],
    ['q3', 'Which of the words or phrases you listed is your greatest strength?'],
    ['q4', 'Which of the words or phrases you listed tends to be most problematic for you?'],
  ],
));
push(spacer());

push(H2('4.3 API call'));
push(table(
  [3000, 6360],
  ['Parameter', 'Value'],
  [
    ['Route', { t: 'POST /api/stage0-signal  (server.js:1087)', mono: true }],
    ['Model', { t: 'claude-sonnet-4-6  (server.js:1139)', mono: true }],
    ['Max tokens', { t: '300  (server.js:1140)', mono: true }],
    ['System prompt', { t: 'STAGE0_SYSTEM, inline (server.js:1091-1100)', mono: true }],
    ['Request payload', { t: '{ client_id, stage0_answers:{q1,q2,q3,q4} }  (app.js:34)', mono: true }],
  ],
));
push(spacer());
push(PR([new TextRun({ text: 'System prompt summary: ', bold: true }), new TextRun('identify the 2–3 Enneagram types most consistent with the language and themes in the four answers; focus on specific words/phrases, idealization and shadow language; return plain-language rationales with no framework jargon.')]));

push(H2('4.4 Output contract & storage'));
push(...codeBlock([
  '{',
  '  "stage0_signal": [',
  '    { "type": <number>, "likelihood": 1, "rationale": "<one sentence>" },',
  '    { "type": <number>, "likelihood": 2, "rationale": "<one sentence>" }',
  '  ]',
  '}',
]));
push(PR([new TextRun('Stored on '), code('clients.stage0_signal'), new TextRun(' via '), code('db.updateClientStage0Signal()'), new TextRun(' ('), ref('server.js:1159'), new TextRun(', '), ref('db.js:447-452'), new TextRun('). Held in browser state as '), code('state.stage0_signal'), new TextRun(' ('), ref('state.js:9'), new TextRun('); '), code('null'), new TextRun(' on failure.')]));
push(new Paragraph({ children: [new PageBreak()] }));

// ======================================================================= §5
push(H1('5. Stage 1 — Slider Scoring'));
push(H2('5.1 UI: 60 sliders'));
push(PR([new TextRun('60 continuous 0–100 sliders, identical neutral poles throughout ("Not like me / Very much like me"), no numeric value shown to the client:')]));
push(
  bullet(null, [new TextRun({ text: '45 type sliders ', bold: true }), new TextRun('— 9 types × 5 statements (core motivation, focus of attention, resulting preoccupation, energy, avoidance). '), ref('assessment.js:194-258'), new TextRun('. Screen order 3, 6, 9, 1, 4, 2, 8, 5, 7.')]),
  bullet(null, [new TextRun({ text: '15 instinct sliders ', bold: true }), new TextRun('— 3 instincts × 5 statements. '), ref('assessment.js:260-282'), new TextRun('. Screen order SP → SO → SX.')]),
  bullet(null, [new TextRun({ text: 'Two optional open responses ', bold: true }), new TextRun('— one after the type block ('), code('state.stage1TypeOpen'), new TextRun('), one after the instinct block ('), code('state.stage1InstinctOpen'), new TextRun('). '), ref('state.js:16-17'), new TextRun('. Both passed verbatim to the AI.')]),
);

push(H2('5.2 Continue gating'));
push(PR([new TextRun('Each slider initializes to '), code('null'), new TextRun(' (untouched) so the UI can distinguish a deliberate 50 from an unmoved control ('), ref('state.js:38-45'), new TextRun('). Continue is disabled until every slider on the screen is non-null — '), code('slots.filter(s => stage1SlotValue(s) !== null).length !== N'), new TextRun(' disables the button ('), ref('assessment.js:2418-2424'), new TextRun('). First touch commits the current value even if the client never drags ('), ref('assessment.js:2454-2465'), new TextRun(').')]));

push(H2('5.3 State fields'));
push(table(
  [3400, 5960],
  ['Field', 'Shape'],
  [
    [{ t: 'state.stage1TypeSliders', mono: true }, { t: '{ 1:[v×5], …, 9:[v×5] } — each value 0–100 or null (state.js:14,39-40)', mono: true }],
    [{ t: 'state.stage1InstinctSliders', mono: true }, { t: '{ SP:[v×5], SO:[v×5], SX:[v×5] } — each 0–100 or null (state.js:15,41-42)', mono: true }],
  ],
));

push(H2('5.4 Scoring aggregation'));
push(PR([new TextRun('Flat scoring — every statement equally weighted. '), code('scoreStage1Profile()'), new TextRun(' ('), ref('assessment.js:813-862'), new TextRun(') computes each per-type score as the mean of its five sliders and each instinct score likewise:')]));
push(...codeBlock([
  'mean5(arr) = (arr[0]+arr[1]+arr[2]+arr[3]+arr[4]) / 5      // assessment.js:824',
  'typeProfile[t]    = mean5(typeSliders[t])      for t in 1..9   // :827-828',
  'instinctProfile[i]= mean5(instinctSliders[i])  for i in SP,SO,SX // :830-831',
]));
push(PR([new TextRun('Types are ranked score-descending, ties broken by type number ascending ('), ref('assessment.js:835-837'), new TextRun('). A high-ambiguity near-tie flag is set when the top two type scores fall within '), code('HIGH_AMBIGUITY_MARGIN = 8'), new TextRun(' points on the normalized scale ('), ref('assessment.js:293'), new TextRun('); it is passed to the AI as a signal, not a routing directive.')]));

push(H2('5.5 Passed forward to the AI'));
push(PR([new TextRun('The Stage 1 contribution to the AI Call #1 context block ('), code('buildContextBlock'), new TextRun(', '), ref('assessment.js:1283-1293'), new TextRun(') comprises: the nine-type profile rank-ordered with leading/alternate/gap/ambiguity flag ('), code('_stage1TypeBlock'), new TextRun(', '), ref('assessment.js:1201-1218'), new TextRun('); the three-instinct profile with dominant instinct ('), code('_stage1InstinctBlock'), new TextRun(', '), ref('assessment.js:1220-1234'), new TextRun('); and both verbatim open responses ('), code('_stage1OpenBlock'), new TextRun(', '), ref('assessment.js:1236-1245'), new TextRun('). The raw '), code('typeProfile'), new TextRun(' / '), code('instinctProfile'), new TextRun(' are also carried to Call #2 and stamped into the final contract (§7.D).')]));
push(new Paragraph({ children: [new PageBreak()] }));

// ======================================================================= §6
push(H1('6. Stages 2, 3, 4 — Evidence Collection'));

push(H2('6.1 Stage 2 — Orthogonal frameworks'));
push(P('Purpose: collect three independent framework answers as raw evidence for AI Call #1 (no scoring).'));
push(table(
  [1700, 2300, 5360],
  ['Q (framework)', 'Title / format', 'Answer options'],
  [
    [{ t: 'Q1 Hornevian', mono: false }, 'Social Stance · select A/B/C', 'A go for what I want · B attend to what’s needed · C move inward to peace/solitude (assessment.js:376-387)'],
    [{ t: 'Q2 Harmonic', mono: false }, 'Conflict Response · select A/B/C', 'A call out what’s wrong · B look on the bright side · C switch to analysis (assessment.js:388-399)'],
    [{ t: 'Q3 Centers', mono: false }, 'Decision Making · ranking', 'Rank Gut / Feelings / Facts in order of reliance (assessment.js:400-412)'],
  ],
));
push(spacer());
push(PR([new TextRun({ text: 'Capture & storage: ', bold: true }), code('state.stage2Answers'), new TextRun(' ('), ref('state.js:19'), new TextRun(') — Q1/Q2 as '), code("'A'|'B'|'C'"), new TextRun(', Q3 as a rank map '), code('{a,b,c}'), new TextRun('. Framework type buckets ('), ref('assessment.js:416-420'), new TextRun(') are used only to label the answer for the AI in '), code('_stage2EvidenceBlock'), new TextRun(' ('), ref('assessment.js:1247-1281'), new TextRun('). Object Relations (a former Q3) is retired.')]));

push(H2('6.2 Stage 3 — Pairwise discrimination'));
push(P('Purpose: run exactly one pairwise on AI Call #1’s top two candidates (or a counter-type comparative) to discriminate the live confusion.'));
push(
  bullet(null, [new TextRun({ text: 'Modes: ', bold: true }), code('state.stage3Mode'), new TextRun(' is '), code("'STANDARD'"), new TextRun(' or '), code("'COUNTER-TYPE'"), new TextRun(' ('), ref('state.js:23'), new TextRun('; selection '), ref('assessment.js:876-905'), new TextRun('). STANDARD composes Q1 from the nine core-motivation descriptions ('), ref('assessment.js:443-453'), new TextRun('); COUNTER-TYPE serves the CT comparative ('), ref('assessment.js:496-502'), new TextRun(').')]),
  bullet(null, [new TextRun({ text: 'Q1 answer scale: ', bold: true }), new TextRun('4-point pairwise lean '), code("'A' | 'A-slight' | 'B-slight' | 'B'"), new TextRun(' ('), code('state.stage3Answers'), new TextRun(', '), ref('state.js:25'), new TextRun('; capture '), ref('assessment.js:2704-2708'), new TextRun('). Lower-numbered type is Person A by convention.')]),
  bullet(null, [new TextRun({ text: 'Q2 (bespoke, gap-driven): ', bold: true }), new TextRun('fires only when '), code("call1.gap === 'tight'"), new TextRun(' and the pair is one of the 26 authored pairs ('), code('STAGE3_Q2_PAIRS'), new TextRun(', '), ref('assessment.js:460-490'), new TextRun('; gate '), ref('assessment.js:903'), new TextRun('). Only ★ pairs reach '), code('stage3Idx = 1'), new TextRun('.')]),
  bullet(null, [new TextRun({ text: 'Skip: ', bold: true }), new TextRun('when '), code("call1.stage3_mode === 'none'"), new TextRun(', Stage 3 is skipped, '), code('state.noPairwise = true'), new TextRun(', and the case is flagged for AI Call #2 ('), ref('assessment.js:2681-2692'), new TextRun(').')]),
);

push(H2('6.3 Stage 4 — Confirmation'));
push(P('Purpose: test the leading hypothesis against the dynamic signature — stress arrow, security arrow, and a conditional habit-of-mind tiebreaker.'));
push(
  bullet(null, [new TextRun({ text: 'Sequence build: ', bold: true }), code('state.stage4Sequence'), new TextRun(' is assembled at Stage 4 entry from the Call #1 read + Stage 3 lean ('), ref('assessment.js:1018-1037'), new TextRun('): Option A (3-option on the lead type), Option B (pairwise lead vs. alternate), or MODIFIED_B (CT pairwise).')]),
  bullet(null, [new TextRun({ text: 'Instruments: ', bold: true }), new TextRun('Stress ('), ref('assessment.js:530'), new TextRun('), Security ('), ref('assessment.js:531'), new TextRun('), and conditional Habit of Mind ('), ref('assessment.js:532'), new TextRun('; fires when stress/security split or come back unconfirmed, '), ref('assessment.js:1042-1059'), new TextRun(').')]),
  bullet(null, [new TextRun({ text: 'Answer formats: ', bold: true }), code("'correct'|'alt1'|'alt2'"), new TextRun(' for 3-option; '), code("'A'|'A-slight'|'B-slight'|'B'"), new TextRun(' for pairwise ('), code('state.stage4Answers'), new TextRun(', '), ref('state.js:28'), new TextRun('). 3-option display order is a Fisher–Yates permutation of [0,1,2] in '), code('state.stage4Shuffles'), new TextRun(' ('), ref('assessment.js:1144-1152'), new TextRun(').')]),
  bullet(null, [new TextRun({ text: 'Outcome math: ', bold: true }), code('computeStage4Scores()'), new TextRun(' ('), ref('assessment.js:1061-1142'), new TextRun(') yields CONFIRMED (stress + security both match lead), CONFIRMED_WITH_NOTE (one matches + habit confirms), AMBIGUOUS (no clean resolution), or REDIRECT (both favor the alternate).')]),
);
push(PR([new TextRun({ text: 'Feed to AI: ', bold: true }), new TextRun('Stage 3 lean → '), code('_stage3LeanBlock'), new TextRun(' ('), ref('assessment.js:1346-1362'), new TextRun('); Stage 4 evidence + outcome → '), code('_stage4EvidenceBlock'), new TextRun(' ('), ref('assessment.js:1365-1381'), new TextRun('); both included only in the Call #2 context ('), code('buildCall2Context'), new TextRun(', '), ref('assessment.js:1392-1415'), new TextRun(').')]));
push(new Paragraph({ children: [new PageBreak()] }));

// ======================================================================= §7
push(H1('7. AI Call Sequence'));
push(PR([new TextRun('Four calls, all model '), code('claude-sonnet-4-6'), new TextRun('. Two mini-calls (A, B) and two keystone calls (C, D). The keystone context blocks are assembled client-side and posted to the server, which appends the output-format spec and calls the model.')]));

push(H2('7.A Call A — Stage 0 mini-call'));
push(PR([new TextRun('Covered in full in §4. Route '), code('POST /api/stage0-signal'), new TextRun(' ('), ref('server.js:1087'), new TextRun('), model '), code('claude-sonnet-4-6'), new TextRun(' ('), ref('server.js:1139'), new TextRun('), system '), code('STAGE0_SYSTEM'), new TextRun(' ('), ref('server.js:1091-1100'), new TextRun('). Output '), code('stage0_signal[]'), new TextRun(' → '), code('clients.stage0_signal'), new TextRun('.')]));

push(H2('7.B Call B — CT mini-call'));
push(PR([new TextRun({ text: 'Trigger: ', bold: true }), new TextRun('a counter-type situation after Stage 1 — reconciles the Stage 0 signal, Stage 1 scores, and a CT key. Route '), code('POST /api/ct-adjustment'), new TextRun(' ('), ref('server.js:1174'), new TextRun('), model '), code('claude-sonnet-4-6'), new TextRun(' ('), ref('server.js:1219'), new TextRun('), max tokens 300 ('), ref('server.js:1220'), new TextRun('), system '), code('CT_SYSTEM'), new TextRun(' ('), ref('server.js:1178-1194'), new TextRun(').')]));
push(PR([new TextRun({ text: 'Input: ', bold: true }), code('stage0_signal'), new TextRun(', Stage 1 framework signals (Centers Body/Heart/Head '), ref('server.js:1204'), new TextRun('; Instincts SP/SO/SX '), ref('server.js:1205'), new TextRun('), and the '), code('ct_key'), new TextRun('. The system weights the Stage 0 language heavily and returns exactly three types in likelihood order.')]));
push(PR([new TextRun({ text: 'Output contract & storage: ', bold: true }), new TextRun('written to '), code('clients.ct_adjustment'), new TextRun(' via '), code('db.updateClientCtAdjustment()'), new TextRun(' ('), ref('server.js:1239'), new TextRun(', '), ref('db.js:459-464'), new TextRun(').')]));
push(...codeBlock([
  '{',
  '  "revised_hypotheses": [n, n, n],',
  '  "adjustment_made": true|false,',
  '  "rationale": "<one sentence on why the primary type was selected>"',
  '}',
]));

push(H2('7.C Call C — AI Call #1 (post-Stage-2)'));
push(table(
  [3000, 6360],
  ['Parameter', 'Value'],
  [
    ['Route', { t: 'POST /api/call1  (server.js:1370)', mono: true }],
    ['Model', { t: 'claude-sonnet-4-6  (server.js:1381)', mono: true }],
    ['Max tokens', { t: '2000  (server.js:1382)', mono: true }],
    ['System prompt', { t: 'CALL1_SYSTEM  (server.js:1274-1318)', mono: true }],
    ['Output spec', { t: 'CALL1_OUTPUT_FORMAT  (server.js:1325-1341)', mono: true }],
    ['Storage', { t: 'clients.call1_result via db.saveCall1Result  (server.js:1423, db.js:471-476)', mono: true }],
  ],
));
push(spacer());
push(PR([new TextRun({ text: 'System prompt summary: ', bold: true }), new TextRun('the reasoning layer of the engine — not a ratifier of the slider ranking. It assigns "each of the nine types a 0-100 coherence score expressing how well the WHOLE picture fits that type" ('), ref('server.js:1281'), new TextRun('), and may promote a type the sliders understated (counter-type / under-endorsement cases). It also names the dominant instinct, anchored on the instinct profile ('), ref('server.js:1287'), new TextRun('), and sets the Stage 3 routing.')]));
push(PR([new TextRun({ text: 'Context block (buildContextBlock, assessment.js:1283-1293) — sections passed in:', bold: true })]));
push(
  bullet(null, [new TextRun('Evidence header: client name / org / coach + Stage 0 verbatim answers — '), code('_evidenceHeaderBlock'), ref(' assessment.js:1179-1199')]),
  bullet(null, [new TextRun('Stage 1 nine-type profile (rank-ordered; leading/alternate/gap/ambiguity) — '), ref('assessment.js:1201-1218')]),
  bullet(null, [new TextRun('Stage 1 three-instinct profile (dominant instinct) — '), ref('assessment.js:1220-1234')]),
  bullet(null, [new TextRun('Stage 1 open responses (type + instinct, verbatim) — '), ref('assessment.js:1236-1245')]),
  bullet(null, [new TextRun('Stage 2 framework answers (Hornevian / Harmonic / Centers) — '), ref('assessment.js:1247-1281')]),
  bullet(null, [new TextRun('Legal-pair constraint + output format appended server-side — '), ref('server.js:1320-1341')]),
);
push(PR([new TextRun({ text: 'Output contract (frozen §6.3):', bold: true })]));
push(...codeBlock([
  '{',
  '  "ranking": [ { "type": <1-9>, "score": <0-100> }, … exactly 9, score-descending ],',
  '  "leading_candidate":   <type = ranking[0].type>,',
  '  "alternate_candidate": <type = ranking[1].type>,',
  '  "third_candidate":     <type = ranking[2].type>,',
  '  "gap": "tight" | "medium" | "wide",',
  '  "supporting_language": "<aligning open-response text>" | "Null",',
  '  "stage3_mode": "standard" | "counter_type" | "none",',
  '  "ct_pair": "SP-3"|"SX-6"|"SP-4"|"SX-1"|"SO-7" | "Null",',
  '  "dominant_instinct": "SP" | "SO" | "SX"',
  '}',
]));
push(PR([new TextRun({ text: 'Server post-processing (the model is not trusted on these): ', bold: true }), code('gap'), new TextRun(' is re-derived from the actual top-two scores — '), code("d <= 10 ? 'tight' : d > 25 ? 'wide' : 'medium'"), new TextRun(' ('), ref('server.js:1398'), new TextRun('). A '), code('counter_type'), new TextRun(' route is coerced to '), code('standard'), new TextRun(' / '), code('ct_pair = Null'), new TextRun(' unless the key’s instinct and base type match the leading candidate, per '), code('CT_SPEC'), new TextRun(' ('), ref('server.js:1404-1410'), new TextRun(').')]));
push(PR([new TextRun({ text: 'Written to DB at this point: ', bold: true }), new TextRun('the full (post-processed) contract → '), code('clients.call1_result'), new TextRun('. No '), code('assessments')]), );
push(P('row fields are written by Call #1; the verdict fields are written only at Call #2 (§8).'));

push(H2('7.D Call D — AI Call #2 (verdict)'));
push(table(
  [3000, 6360],
  ['Parameter', 'Value'],
  [
    ['Trigger', { t: 'POST /api/submit → runBackgroundJob → callClaudeWithRetry (server.js:1039, 914, 890)', mono: true }],
    ['Model', { t: 'claude-sonnet-4-6  (server.js:895)', mono: true }],
    ['Max tokens', { t: '12000  (server.js:896)', mono: true }],
    ['System prompt', { t: 'SYSTEM_PROMPT (server.js:137) + TASK_INSTRUCTIONS (server.js:232)', mono: true }],
    ['Output spec', { t: 'OUTPUT_FORMAT  (server.js:500-636)', mono: true }],
    ['Retry', { t: '3 attempts, exponential backoff 2s/4s (server.js:890-912)', mono: true }],
  ],
));
push(spacer());
push(PR([new TextRun({ text: 'Context (buildCall2Context, assessment.js:1392-1415): ', bold: true }), new TextRun('reuses the same five Stage 0–2 evidence blocks Call #1 received (verbatim, same helpers), then adds three new blocks — the frozen Call #1 result ('), code('_call1ResultBlock'), ref(' assessment.js:1316-1341'), new TextRun('), the Stage 3 lean ('), ref('assessment.js:1346-1362'), new TextRun('), and the Stage 4 evidence + outcome ('), ref('assessment.js:1365-1381'), new TextRun('). The Call #1 ranking is presented as ground truth; Call #2 does not recompute it.')]));
push(PR([new TextRun({ text: 'System prompt summary: ', bold: true }), new TextRun('the final reasoning call renders the verdict and both report registers. Tasks run in fixed order — coherence check, flag generation, confidence setting — all settled before either narrative is drafted, so prose and values cannot disagree ('), ref('server.js:232'), new TextRun('). It does not re-run scoring math.')]));
push(PR([new TextRun({ text: 'Output contract — hypothesis block (server.js:503-518):', bold: true })]));
push(...codeBlock([
  '"hypothesis": {',
  '  "confirmed_type": <1-9 — final verdict; differs from leading only on REDIRECT>,',
  '  "confirmed_type_name": <string>,',
  '  "confidence_level": "HIGH"|"MEDIUM_HIGH"|"MEDIUM"|"LOW",',
  '  "leading_candidate":   <1-9 — Call #1 rank 1>,',
  '  "alternate_candidate": <1-9 — Call #1 rank 2>,',
  '  "third_candidate":     <1-9 — context only, not shown>,',
  '  "call1_ranking": [ {"type":<1-9>,"score":<0-100>}, … 9 ],',
  '  "type_score_profile":     {"1":<0-100>, …, "9":<0-100>},',
  '  "instinct_score_profile": {"SP":<0-100>,"SO":<0-100>,"SX":<0-100>},',
  '  "dominant_instinct_hypothesis": "SP"|"SO"|"SX",',
  '  "ranking_override": <boolean>,',
  '  "stage4_outcome": "CONFIRMED"|"CONFIRMED_WITH_NOTE"|"AMBIGUOUS"|"REDIRECT",',
  '  "redirect_from_type": <1-9 or null>,',
  '  "hypothesis_validated": <boolean>',
  '}',
]));
push(PR([new TextRun({ text: 'Other top-level output sections: ', bold: true }), code('flags[]'), ref(' :519-523'), new TextRun(', '), code('stage0_analysis'), ref(' :525-529'), new TextRun(', '), code('stage2_analysis'), ref(' :530-535'), new TextRun(', '), code('stage4_analysis'), ref(' :536-540'), new TextRun(', '), code('holistic_analysis'), ref(' :541-547'), new TextRun(', '), code('client_facing'), ref(' :548-557'), new TextRun(', '), code('coach_report'), ref(' :558-622'), new TextRun(', '), code('client_words'), ref(' :624-627'), new TextRun(', '), code('final_response'), ref(' :628-635'), new TextRun('.')]));
push(PR([new TextRun({ text: 'Deterministic stamping (server-side, model output ignored — server.js:955-969): ', bold: true }), code('ranking_override'), new TextRun(', '), code('leading_candidate'), new TextRun(', '), code('alternate_candidate'), new TextRun(', '), code('third_candidate'), new TextRun(', '), code('call1_ranking'), new TextRun(' ← Call #1; '), code('type_score_profile'), new TextRun(' / '), code('instinct_score_profile'), new TextRun(' ← raw sliders; '), code('stage4_outcome'), new TextRun(' ← Stage 4 math; '), code('gap'), new TextRun(' ('), ref('server.js:966-967'), new TextRun('). The AI judges only '), code('confirmed_type'), new TextRun(', '), code('confirmed_type_name'), new TextRun(', '), code('confidence_level'), new TextRun(', '), code('dominant_instinct_hypothesis'), new TextRun(', '), code('redirect_from_type'), new TextRun(', '), code('hypothesis_validated'), new TextRun(' ('), ref('server.js:237'), new TextRun(').')]));

push(H2('7.E Flags enum'));
push(PR([new TextRun('Closed enum, declared in '), code('OUTPUT_FORMAT'), new TextRun(' ('), ref('server.js:521'), new TextRun(') and defined with triggers in '), code('TASK_INSTRUCTIONS'), new TextRun(' ('), ref('server.js:338-354'), new TextRun('). The AI cannot invent flag types.')]));
push(table(
  [2900, 6460],
  ['flag_type', 'Trigger condition'],
  [
    [{ t: 'counter_type', mono: true }, 'The instinct + type combination produces a known counter-type (server.js:338).'],
    [{ t: 'lookalike_ambiguity', mono: true }, 'Two types remain close after Stage 3/4, or ambiguous answers persisted (server.js:340).'],
    [{ t: 'stage0_contradiction', mono: true }, 'Stage 0 / open-response language points toward a different type than the leading hypothesis (server.js:342).'],
    [{ t: 'ranking_override', mono: true }, 'AI Call #1 promoted a type above the raw slider leader; raise only when the pre-resolved line says YES (server.js:344).'],
    [{ t: 'stage4_stress_unrecognized', mono: true }, 'The stress-point answer didn’t match the leading type (server.js:346).'],
    [{ t: 'stage4_security_unrecognized', mono: true }, 'The security-point answer didn’t match the leading type (server.js:348).'],
    [{ t: 'stage4_habit_unrecognized', mono: true }, 'The Habit-of-Mind answer aligned more with the alternate than the leading type (server.js:350).'],
    [{ t: 'stage4_redirect', mono: true }, 'Stress and security both favor the alternate; the hypothesis is reopened (server.js:352).'],
    [{ t: 'low_instinct_confidence', mono: true }, 'The top two instinct scores are too close to name a dominant instinct with confidence (server.js:354).'],
  ],
));
push(spacer());
push(PR([new TextRun({ text: 'Confidence & outcome enums: ', bold: true }), code('confidence_level'), new TextRun(' ∈ HIGH / MEDIUM_HIGH / MEDIUM / LOW ('), ref('server.js:506'), new TextRun('); '), code('stage4_outcome'), new TextRun(' ∈ CONFIRMED / CONFIRMED_WITH_NOTE / AMBIGUOUS / REDIRECT ('), ref('server.js:515'), new TextRun('). Outcome→confidence starting points: CONFIRMED→HIGH, CONFIRMED_WITH_NOTE→MEDIUM_HIGH, AMBIGUOUS→LOW, REDIRECT→LOW ('), ref('server.js:357-362'), new TextRun('); the AI may move the final value on the holistic read.')]));
push(new Paragraph({ children: [new PageBreak()] }));

// ======================================================================= §8
push(H1('8. Database Schema'));
push(PR([new TextRun('Pulled from '), code('db.js'), new TextRun(' DDL ('), ref('db.js:20-129'), new TextRun('). Columns added by '), code('ALTER … ADD COLUMN IF NOT EXISTS'), new TextRun(' are listed with their defining lines. Postgres types shown as declared.')]));

push(H2('8.1 coaches'));
push(table(
  [2700, 2200, 4460],
  ['Column', 'Type', 'Notes'],
  [
    [{ t: 'id', mono: true }, 'SERIAL PK', 'db.js:22'],
    [{ t: 'name', mono: true }, 'VARCHAR(255)', 'NOT NULL (db.js:23)'],
    [{ t: 'email', mono: true }, 'VARCHAR(255)', 'NOT NULL UNIQUE (db.js:24)'],
    [{ t: 'created_at', mono: true }, 'TIMESTAMP', 'DEFAULT NOW() (db.js:25)'],
    [{ t: 'password_hash', mono: true }, 'TEXT', 'bcrypt (db.js:28)'],
    [{ t: 'is_admin', mono: true }, 'BOOLEAN', 'DEFAULT FALSE (db.js:29)'],
    [{ t: 'is_active', mono: true }, 'BOOLEAN', 'DEFAULT TRUE (db.js:30)'],
    [{ t: 'updated_at / updated_by', mono: true }, 'TIMESTAMPTZ / TEXT', 'db.js:89-90'],
  ],
));

push(H2('8.2 clients'));
push(PR([new TextRun('FK '), code('coach_id → coaches(id)'), new TextRun(' ('), ref('db.js:34'), new TextRun('). Holds per-client assessment artifacts and the resume session state.')]));
push(table(
  [2900, 2100, 4360],
  ['Column', 'Type', 'Notes'],
  [
    [{ t: 'id', mono: true }, 'SERIAL PK', 'db.js:33'],
    [{ t: 'coach_id', mono: true }, 'INTEGER', 'FK → coaches(id) (db.js:34)'],
    [{ t: 'first_name / last_name', mono: true }, 'VARCHAR(255)', 'NOT NULL (db.js:35-36)'],
    [{ t: 'email', mono: true }, 'VARCHAR(255)', 'NOT NULL (db.js:37)'],
    [{ t: 'organization', mono: true }, 'VARCHAR(255)', 'db.js:38'],
    [{ t: 'status', mono: true }, 'TEXT', "DEFAULT 'not_started' (db.js:68)"],
    [{ t: 'stage0_signal', mono: true }, 'JSONB', 'Call A output (db.js:84)'],
    [{ t: 'ct_adjustment', mono: true }, 'JSONB', 'Call B output (db.js:85)'],
    [{ t: 'responses_snapshot', mono: true }, 'JSONB', 'Raw open responses (db.js:86)'],
    [{ t: 'call1_result', mono: true }, 'JSONB', 'Call C frozen contract (db.js:87)'],
    [{ t: 'session_state', mono: true }, 'JSONB', 'Mid-assessment resume (db.js:98)'],
    [{ t: 'reminder_sent_at', mono: true }, 'JSONB', 'Abandonment reminders (db.js:99)'],
    [{ t: 'beta_report_generated_at / _filename', mono: true }, 'TIMESTAMPTZ / TEXT', 'db.js:95-96'],
    [{ t: 'updated_at / updated_by', mono: true }, 'TIMESTAMPTZ / TEXT', 'db.js:92-93'],
  ],
));

push(H2('8.3 assessments'));
push(PR([new TextRun('FK '), code('client_id → clients(id)'), new TextRun(' ('), ref('db.js:44'), new TextRun('). The verdict row. '), new TextRun({ text: 'Verdict columns are written by Call #2 ', bold: true }), new TextRun('via '), code('completeAssessment()'), new TextRun(' ('), ref('db.js:198-228'), new TextRun(').')]));
push(table(
  [3100, 2000, 4260],
  ['Column', 'Type', 'Notes'],
  [
    [{ t: 'id', mono: true }, 'SERIAL PK', 'db.js:43'],
    [{ t: 'client_id', mono: true }, 'INTEGER', 'FK → clients(id) (db.js:44)'],
    [{ t: 'status', mono: true }, 'VARCHAR(50)', "DEFAULT 'pending'; → processing/complete/failed (db.js:45)"],
    [{ t: 'responses', mono: true }, 'JSONB', 'Full answer payload (db.js:46)'],
    [{ t: 'confirmed_type', mono: true }, 'INTEGER', 'Call #2 ← hypothesis.confirmed_type (db.js:47,218)'],
    [{ t: 'confidence_level', mono: true }, 'VARCHAR(50)', 'Call #2 (db.js:48,219)'],
    [{ t: 'stage4_outcome', mono: true }, 'VARCHAR(50)', 'Call #2 (db.js:49,220)'],
    [{ t: 'flags', mono: true }, 'JSONB', 'Call #2 flags[] (db.js:50,221)'],
    [{ t: 'final_response_classification', mono: true }, 'VARCHAR(50)', 'Call #2 (db.js:51,222)'],
    [{ t: 'confirmed_instinct', mono: true }, 'VARCHAR(20)', 'Legacy; mirrors dominant_instinct_hypothesis (db.js:64,223)'],
    [{ t: 'instinct_confidence', mono: true }, 'VARCHAR(20)', 'db.js:65'],
    [{ t: 'dominant_instinct_hypothesis', mono: true }, 'VARCHAR(20)', 'Call #2 (db.js:66,224)'],
    [{ t: 'api_result', mono: true }, 'JSONB', 'Full Call #2 result (db.js:79)'],
    [{ t: 'scores_snapshot', mono: true }, 'JSONB', 'Raw scores at submit (db.js:80)'],
    [{ t: 'pdf_generated_at / email_sent_at', mono: true }, 'TIMESTAMPTZ', 'db.js:81-82'],
    [{ t: 'created_at / completed_at', mono: true }, 'TIMESTAMP', 'db.js:52-53'],
  ],
));

push(H2('8.4 Supporting tables'));
push(table(
  [2400, 6960],
  ['Table', 'Purpose / key columns / FKs'],
  [
    [{ t: 'reports', mono: true }, 'id PK; assessment_id → assessments(id); report_type (client|coach); pdf_path (db.js:56-62).'],
    [{ t: 'client_tokens', mono: true }, 'id PK; client_id → clients(id) ON DELETE CASCADE; token UNIQUE; expires_at; used_at (db.js:70-77).'],
    [{ t: 'pdf_tokens', mono: true }, 'token PK; filename; coach_id; expires_at; redeemed_at (db.js:121-128).'],
    [{ t: 'app_settings', mono: true }, 'Single row (CHECK id=1); beta_mode_enabled BOOLEAN (db.js:101-108).'],
    [{ t: 'edit_history', mono: true }, 'id PK; record_type; record_id; edited_by_id/name; change_summary; editor_note (db.js:110-119).'],
  ],
));
push(new Paragraph({ children: [new PageBreak()] }));

// ======================================================================= §9
push(H1('9. Session Lifecycle & Persistence'));

push(H2('9.1 Assessment phase state machine'));
push(PR([new TextRun('Phases enumerated at '), ref('state.js:4'), new TextRun('. Normal order (transitions in assessment.js / app.js):')]));
push(table(
  [600, 2700, 6060],
  ['#', 'Phase', 'Transition into next'],
  [
    ['1', { t: 'welcome', mono: true }, '→ intake (assessment.js:2239)'],
    ['2', { t: 'intake', mono: true }, '→ stage0 (assessment.js:2266)'],
    ['3', { t: 'stage0', mono: true }, '→ mid-assessment-reminders, all 4 answered (assessment.js:2344)'],
    ['4', { t: 'mid-assessment-reminders', mono: true }, '→ stage1; Stage 0 mini-call fires on entry (app.js:16; assessment.js:2368)'],
    ['5', { t: 'stage1', mono: true }, '→ stage2, sliders complete + scored (assessment.js:2514)'],
    ['6', { t: 'stage2', mono: true }, '→ call1-analyzing, 3 answers given (assessment.js:2627)'],
    ['7', { t: 'call1-analyzing', mono: true }, '→ stage3 or stage4 per Call #1 routing (assessment.js:2692-2696)'],
    ['8', { t: 'stage3', mono: true }, '→ stage4, Stage 3 complete (assessment.js:2742)'],
    ['9', { t: 'stage4', mono: true }, '→ finalopen, all slots answered (assessment.js:2803)'],
    ['10', { t: 'finalopen', mono: true }, '→ processing (assessment.js:2821, 2829)'],
    ['11', { t: 'processing', mono: true }, '→ confirmation when job returns (app.js:289)'],
    ['12', { t: 'confirmation → results', mono: true }, 'Server completes; client polls to results.'],
  ],
));
push(spacer());
push(PR([new TextRun({ text: 'Conditional branches: ', bold: true }), new TextRun('the '), code('ct-analyzing'), new TextRun(' phase exists in the enum but has no normal entry point post-v2. Stage 3 is skipped when '), code("call1.stage3_mode === 'none'"), new TextRun(' ('), code('noPairwise = true'), new TextRun(', '), ref('assessment.js:2681-2692'), new TextRun('). '), code('error'), new TextRun(' is reachable from any phase on failure.')]));

push(H2('9.2 localStorage'));
push(PR([new TextRun({ text: 'Mid-assessment resume is server-side, not localStorage. ', bold: true }), new TextRun('The session is POSTed to '), code('/assessment/{token}/save'), new TextRun(' ('), code('saveSessionState'), new TextRun(', '), ref('app.js:304-316'), new TextRun(') at each stage boundary and persisted to '), code('clients.session_state'), new TextRun('. The only localStorage usage is '), code('clearResult()'), new TextRun(', which removes the retired '), code("'hive_typing_result_v1'"), new TextRun(' key ('), code('RESULT_STORAGE_KEY'), new TextRun(', '), ref('state.js:53-57'), new TextRun(') — the synchronous in-browser result flow was removed in Step 7.')]));
push(table(
  [2900, 6460],
  ['Aspect', 'Detail'],
  [
    ['Persistence', { t: 'Server-side clients.session_state (JSONB); saved via POST (app.js:304-316)', mono: false }],
    ['Schema version', { t: 'schemaVersion: 2 (state.js:68); restore rejects < 2 (app.js:333)', mono: false }],
    ['TTL', 'None. Session persists until cleared on completion. Resume gated only by token expiry on client_tokens.expires_at.'],
    ['Saved fields', { t: 'getSerializableState() — 27 fields incl. all stage answers + scores; excludes apiResult, resultsTab, intake (state.js:63-95)', mono: false }],
    ['Restore', { t: 'Rehydrate from window.__hiveSessionState, schemaVersion-gated (app.js:325-361)', mono: false }],
    ['Clear', { t: 'clearClientSessionState() on completion/failure (db.js:592-597); legacy clearResult() (state.js:55-57)', mono: false }],
  ],
));

push(H2('9.3 Server-side session: memory vs. DB'));
push(PR([new TextRun('The final typing job runs in the background ('), code('runBackgroundJob'), new TextRun(', '), ref('server.js:914'), new TextRun('). During the run, the scores object, intake, and responses snapshot are held in memory and passed to '), code('callClaudeWithRetry'), new TextRun('. Persisted to DB along the way: '), code('scores_snapshot'), new TextRun(' before the call ('), ref('server.js:917-922'), new TextRun('), '), code('responses_snapshot'), new TextRun(' ('), ref('server.js:926-932'), new TextRun('), '), code('api_result'), new TextRun(' on success ('), ref('server.js:972-977'), new TextRun('), then '), code('completeAssessment'), new TextRun(' + status '), code('complete'), new TextRun(' + '), code('clearClientSessionState'), new TextRun(' ('), ref('server.js:980-984'), new TextRun('). The mini-call and Call #1 outputs are persisted to '), code('clients')]), );
push(P('as they occur, so the running case file survives a page reload.'));

push(H2('9.4 Fail-safe behavior'));
push(
  bullet(null, [new TextRun('Every DB op goes through '), code('db.query'), new TextRun(', which catches and logs errors and returns '), code('null'), new TextRun(' rather than throwing ('), ref('db.js:164-172'), new TextRun(').')]),
  bullet(null, [new TextRun('Session save is best-effort: failures are swallowed silently so a save error never blocks the client ('), ref('app.js:313-314'), new TextRun('). No quota/retry fallback.')]),
  bullet(null, [code('clearResult()'), new TextRun(' wraps localStorage in try/catch ('), ref('state.js:56'), new TextRun(').')]),
  bullet(null, [new TextRun('Call #2 retries 3× with 2s/4s backoff, then '), code('failAssessment'), new TextRun(' sets status '), code('failed'), new TextRun(' ('), ref('server.js:890-912'), new TextRun(', '), ref('db.js:230-235'), new TextRun(').')]),
  bullet(null, [new TextRun('Mini-call and Call #1 failures degrade gracefully: the corresponding state field is left '), code('null'), new TextRun(' and the flow continues.')]),
);
push(new Paragraph({ children: [new PageBreak()] }));

// ======================================================================= §10
push(H1('10. Changing Engine Parameters'));
push(PR([new TextRun({ text: 'Standing instruction: ', bold: true }), new TextRun('update the parameter in code first, then regenerate this document (it is the spec-of-record, not the design intent). When a change affects user-facing prose, update the system prompt and the client/coach overview material together so the registers stay aligned.')]));

push(H2('10.1 Parameter categories'));
push(table(
  [2600, 3400, 3360],
  ['Category', 'Where it lives', 'Examples'],
  [
    ['Scoring aggregation', { t: 'assessment.js', mono: true }, ['mean5 formula (:824); rank tie-break (:835-837); ', { text: 'HIGH_AMBIGUITY_MARGIN = 8', font: MONO, size: 16 }, ' (:293)']],
    ['AI prompts', { t: 'server.js', mono: true }, 'STAGE0_SYSTEM (:1091); CT_SYSTEM (:1178); CALL1_SYSTEM (:1274); SYSTEM_PROMPT (:137) + TASK_INSTRUCTIONS (:232)'],
    ['Output contracts', { t: 'server.js', mono: true }, 'CALL1_OUTPUT_FORMAT (:1325); OUTPUT_FORMAT (:500)'],
    ['Flag thresholds', { t: 'server.js / assessment.js', mono: true }, ['gap thresholds 10 / 25 (server.js:1398); flag triggers (server.js:338-354); Stage 4 outcome math (assessment.js:1061-1142)']],
    ['Routing rules', { t: 'server.js / assessment.js', mono: true }, ['CT coercion CT_SPEC (server.js:1404-1410); stage3_mode / Q2 gate (assessment.js:876-905); Stage 4 sequence build (assessment.js:1018-1037)']],
    ['Model / call params', { t: 'server.js', mono: true }, 'model claude-sonnet-4-6 + max_tokens at each call site (:895-896, :1139-1140, :1219-1220, :1381-1382)'],
    ['Counter-type set', { t: 'server.js / assessment.js', mono: true }, 'CT_SPEC (server.js:1404); STAGE3_CT_COMPARATIVES (assessment.js:496-502)'],
    ['Question banks', { t: 'assessment.js', mono: true }, 'Stage 0 (:7-32); Stage 1 statements (:194-282); Stage 2 (:375-413); Stage 3 (:438-502); Stage 4 (:530-681)'],
    ['Schema', { t: 'db.js', mono: true }, 'SCHEMA_SQL DDL (:20-129); regenerate §8 after any column change'],
  ],
));

// build the doc -------------------------------------------------------------
const doc = new Document({
  creator: 'Hive Typing Engine',
  title: 'Hive Typing Engine — Technical Specification v2.0',
  styles: {
    default: { document: { run: { font: 'Arial', size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: 'Arial', color: '1F3864' },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: '2E75B6' },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 480, hanging: 280 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } },
        children: [
          new TextRun({ text: 'Hive Typing Engine — Technical Specification v2.0', size: 16, color: '888888' }),
          new TextRun({ text: '\tCONFIDENTIAL', size: 16, color: '888888' }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } },
        children: [
          new TextRun({ text: `© 2026 Hive, Inc. · CONFIDENTIAL · For internal use only · Regenerated ${TODAY}`, size: 16, color: '888888' }),
          new TextRun({ text: '\tPage ', size: 16, color: '888888' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      })] }),
    },
    children,
  }],
});

const outPath = path.join(__dirname, '..', 'docs', 'hive_typing_engine_spec_v2_0.docx');
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log('WROTE', outPath, buf.length, 'bytes');
});
