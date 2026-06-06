'use strict';

/**
 * report_prep.js — render-time assembly (Step 7 Phase 4). Pure data, no HTML.
 *
 * Sits between the stored Call #2 result and renderer.js: assembles ONE fully-formed
 * view-model per report from three sources — engine output (api_result), the static
 * content library, and the client/coach records. renderer.js becomes pure templating.
 *
 * Rules baked in (Phases 0–3):
 *  - Name authority: displayed names derive from TYPE_NAMES; AI *_name strings are
 *    asserted-equal and drift is FLAGGED, never rendered.
 *  - Instinct read: dominant_instinct_hypothesis (not confirmed_instinct).
 *  - near_tie: top-two call1_ranking COHERENCE scores within 10 (A7) — NOT hypothesis.gap.
 *  - Charts from call1_ranking (coherence) + instinct_score_profile; feed Part A renderers.
 *  - Content from content_library.json (Phase 2 shapes); only personalized zones are AI.
 */

const library = require('../content/content_library.json');
const { TYPE_NAMES, TYPE_META, INSTINCT_NAME } = require('./type_meta');

// Bar-fill per Center (A5/A2): Gut/Heart use one value; Head fill is lighter than its text.
const CENTER_FILL = { Gut: '#5271B7', Heart: '#D38481', Head: '#BED6A8' };

// Spelled type numbers for display.* (spec §5): display.type_word, e.g. 8 -> "Eight".
const TYPE_WORD = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine' };
// Split a wing body on its "At their best:" marker (audited: all 18 carry exactly one,
// preceded by a paragraph break). Returns { body, best } — body before the marker,
// best the descriptor after the colon (the "At their best:" label is supplied by the
// template at render time). No marker -> best is ''.
function splitWingBest(text) {
  const s = String(text || '');
  const m = s.match(/\n+\s*At their best:\s*/i);
  if (!m) return { body: s.trim(), best: '' };
  const idx = m.index;
  return { body: s.slice(0, idx).trim(), best: s.slice(idx + m[0].length).trim() };
}

// ---------- shared helpers ----------
function lib(key) {
  if (!(key in library)) throw new Error(`content_library missing key: ${key}`);
  return library[key];
}
function resolveTypeMeta(n) {
  const m = TYPE_META[n];
  if (!m) throw new Error(`resolveTypeMeta: invalid type ${n}`);
  return { number: n, name: TYPE_NAMES[n], center: m.center, centerColor: m.centerColor,
           stressPoint: m.stress, securityPoint: m.security, wings: m.wings.slice() };
}
const subtypeKey = (instinct, n) => `subtype_${String(instinct).toLowerCase()}${n}`;
const instinctName = (code) => INSTINCT_NAME[code] || code;
const nameNode = (n) => ({ number: n, name: TYPE_NAMES[n] });
const centerFill = (n) => CENTER_FILL[TYPE_META[n].center];

function typeBars(call1_ranking) {
  return (call1_ranking || []).map(r => ({ type: r.type, score: Math.round(r.score), color: centerFill(r.type) }));
}
function instinctBars(profile) {
  return ['SP', 'SO', 'SX'].map(code => ({ code, score: Math.round((profile && profile[code]) || 0) }));
}
function instinctStack(profile) {
  const ranked = ['SP', 'SO', 'SX'].map(c => [c, (profile && profile[c]) || 0]).sort((a, b) => b[1] - a[1]);
  const labels = ['Leading', 'Supporting', 'Growing'];
  return ranked.map(([code], i) => ({ label: labels[i], code, name: instinctName(code) }));
}
// A7: near-tie when the top two COHERENCE scores are within 10 points.
function nearTie(call1_ranking) {
  const s = (call1_ranking || []).map(r => r.score).sort((a, b) => b - a);
  return s.length >= 2 ? (s[0] - s[1]) <= 10 : false;
}
const confidenceLabel = (level) =>
  ({ HIGH: 'High', MEDIUM_HIGH: 'Medium-High', MEDIUM: 'Medium', LOW: 'Low' }[level] || level || '');

const cap = (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : []);
// A7 bullet-sizing: ≤6 bullets AND ≤~80 words (~9 lines) per section. Greedily keep
// bullets until the word budget is hit (always keep at least one). Drops overflow so
// the section fits its fixed zone. (Phase-1 prompt tightening to make the AI author
// shorter coach bullets is a logged follow-up.)
function capByLines(bullets, maxWords = 80, maxBullets = 6) {
  const out = []; let words = 0;
  for (const b of (bullets || [])) {
    if (out.length >= maxBullets) break;
    const w = countWords(b);
    if (out.length > 0 && words + w > maxWords) break;
    out.push(b); words += w;
  }
  return out;
}
const stripProbe = (s) => (s || '').replace(/^\s*(Try asking|Weave in)\s*:\s*/i, '').trim();
// Clamp a long narrative to ~maxWords, backing off to the last sentence end (B2 callout ≈ 3 lines).
function clampText(str, maxWords) {
  const words = String(str || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return (str || '').trim();
  let cut = words.slice(0, maxWords).join(' ');
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (end > 0) cut = cut.slice(0, end + 1);
  return cut.trim();
}
// section2 bullet → {bold_lead, body}: split on first em/en-dash or colon; else lead empty.
function splitLead(str) {
  const m = (str || '').match(/^(.{3,60}?)\s*[—–:]\s+(.+)$/s);
  return m ? { bold_lead: m[1].trim(), body: m[2].trim() } : { bold_lead: '', body: (str || '').trim() };
}
// Name-authority: derived name must equal the AI's *_name string (modulo "Type N — " prefix).
function assertName(flags, label, derivedName, aiString, typeNum) {
  if (!aiString) return;
  const cleaned = String(aiString).replace(/^\s*Type\s*\d+\s*[—–-]\s*/i, '').trim();
  if (cleaned && cleaned !== derivedName) {
    flags.push(`name drift @ ${label}: engine "${derivedName}" (Type ${typeNum}) vs AI "${aiString}"`);
  }
}

// ---------- coach view-model ----------
function buildCoachModel({ apiResult, client, coach, tighten = 0 }) {
  const flags = [], warnings = [];
  const capW = [80, 62, 48, 40][Math.min(tighten, 3)];   // self-heal: debrief word budget tightens by level
  const h = apiResult.hypothesis;
  const cr = apiResult.coach_report || {};
  const cw = apiResult.client_words || {};
  const cf = apiResult.client_facing || {};
  const heroN = h.confirmed_type;
  const altN = h.alternate_candidate;
  const instinct = h.dominant_instinct_hypothesis || h.confirmed_instinct || '';
  const meta = resolveTypeMeta(heroN);

  assertName(flags, 'hero', meta.name, h.confirmed_type_name, heroN);
  if (cr.section6 && cr.section6.pushes_back)
    assertName(flags, 'alternate', TYPE_NAMES[altN], cr.section6.pushes_back.alt_type_name, altN);

  const t = lib(`type_${heroN}`);
  const alt = lib(`type_${altN}`);
  const s2 = cr.section2 || {}, s4 = cr.section4 || {}, s5 = cr.section5 || {}, s6 = cr.section6 || {};
  const pb = s6.pushes_back || {};

  const model = {
    client: { first_name: client.first_name || '', org: client.organization || '', date: client.date || '' },
    coach: { full_name: coach.full_name || coach.name || '', type: coach.type ?? null, instinct: coach.instinct || '' },
    hero: { number: heroN, name: meta.name, subtype_name: instinctName(instinct), center: meta.center, centerColor: meta.centerColor },
    confidence: { label: confidenceLabel(h.confidence_level), near_tie: nearTie(h.call1_ranking) },
    alternate: nameNode(altN),
    redirect: (h.stage4_outcome === 'REDIRECT' || h.redirect_from_type != null)
      ? { is_redirect: true, from_type: h.redirect_from_type } : null,
    svg: { variant: 'type', type: heroN },
    charts: { types: typeBars(h.call1_ranking), instincts: instinctBars(h.instinct_score_profile) },
    ataglance: {
      wings: meta.wings.map(nameNode), stress: nameNode(meta.stressPoint),
      release: nameNode(meta.securityPoint), center: meta.center, centerColor: meta.centerColor,
    },
    bottom_line: cr.bottom_line ?? null,   // always-present per Phase 1; null (missing) is caught by validateModel
    responses_revealed: cap(s2.what_responses_showed, 6).map(splitLead),
    comparison: {
      leading: { number: heroN, name: meta.name, rows: t.comparison },
      alternate: { number: altN, name: TYPE_NAMES[altN], rows: alt.comparison },
      discriminator: pb.key_distinction || '',
      note: clampText(cf.secondary_type_narrative, 40) || null,   // callout = why the alternate surfaced (~3 lines, NOT the discriminator)
      client_words: { quotes: cw.leading_quotes || [], absence_note: cw.alternate_absence_note ?? null },
    },
    debrief: {
      subtype: { question: stripProbe(s4.probe), bullets: capByLines([...(s4.how_instinct_shapes || []), ...(s4.easy_to_miss || []), ...(s4.coaching_notes || [])], capW) },
      lines: { question: stripProbe(s5.stress_probe), bullets: capByLines([...(s5.stress_notes || []), ...(s5.security_notes || [])], capW) },
      wings: { question: stripProbe(s5.probe), bullets: capByLines(s5.wings_notes, capW) },
    },
  };

  // word-count proxy (warn only)
  if (countWords(model.bottom_line) > 80) warnings.push(`bottom_line ${countWords(model.bottom_line)}w > 80`);

  validateModel(model, COACH_SPEC);
  model._flags = flags; model._warnings = warnings;
  return model;
}

// ---------- client view-model ----------
function buildClientModel({ apiResult, client, coach, tighten = 0 }) {  // tighten: renderer-side compaction (self-heal)
  const flags = [], warnings = [];
  void tighten;
  const h = apiResult.hypothesis;
  const cf = apiResult.client_facing || {};
  const cw = apiResult.client_words || {};
  const heroN = h.confirmed_type;
  const altN = h.alternate_candidate;
  const instinct = h.dominant_instinct_hypothesis || h.confirmed_instinct || '';
  const meta = resolveTypeMeta(heroN);
  assertName(flags, 'hero', meta.name, h.confirmed_type_name, heroN);

  const t = lib(`type_${heroN}`);
  const alt = lib(`type_${altN}`);                 // P3: alternate candidate's EXISTING comparison rows
  const st = lib(subtypeKey(instinct, heroN));
  const stat = lib('static');

  // P5 remap (store untouched): wings keyed by NUMBER -> wing_low/wing_high; lines -> line_stress/line_security.
  const wingPair = [t.wings.wing_a, t.wings.wing_b].slice().sort((a, b) => a.target_type - b.target_type);
  const remapWing = (w) => { const s = splitWingBest(w.body); return { number: w.target_type, name: TYPE_NAMES[w.target_type], body: s.body, best: s.best }; };
  const remapLine = (l) => ({ name: TYPE_NAMES[l.target_type], body: l.narrative, resource: l.resource_card, toward: l.target_type });
  const wingLow = remapWing(wingPair[0]);
  const wingHigh = remapWing(wingPair[1]);
  const lineStress = remapLine(t.lines.stress);
  const lineSecurity = remapLine(t.lines.security);

  const model = {
    client: {
      first_name: client.first_name || '', last_name: client.last_name || '',
      full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(), date: client.date || '',
    },
    hero: { number: heroN, name: meta.name, subtype_name: instinctName(instinct), center: meta.center, centerColor: meta.centerColor },
    // display.* (spec §5): grammar-ready strings composed once here so templates never assemble per-type grammar.
    display: {
      type_word: TYPE_WORD[heroN],                            // spelled number, e.g. "Eight"
      instinct_label: instinctName(instinct),                 // SX -> "One-to-One" (INSTINCT_NAME authority; never "Sexual")
      instinct_code: String(instinct).toUpperCase(),          // "SP" / "SO" / "SX"
      subtype_label: `${instinctName(instinct)} ${TYPE_WORD[heroN]}`, // e.g. "Social Eight"
      confirmed_type_name: meta.name,                         // "The Protector" (TYPE_NAMES authority)
    },
    alternate: nameNode(altN),
    confidence: { label: confidenceLabel(h.confidence_level), near_tie: nearTie(h.call1_ranking) },
    svg: { type: { variant: 'type', type: heroN }, base: { variant: 'base' }, wings: { variant: 'wings-lines', type: heroN } },
    charts: { instincts: instinctBars(h.instinct_score_profile) },
    instinct_stack: instinctStack(h.instinct_score_profile),
    pages: {
      welcome: { greeting_name: client.first_name || '', body: stat.welcome_body },           // static PENDING
      primer: stat.primer,                                                                      // static PENDING
      type_hypotheses: {                                                                        // P3
        pill: { number: heroN, name: meta.name, subtype_name: instinctName(instinct) },
        core_motivation: t.description.core_motivation,
        alternate_note: cf.secondary_type_narrative ?? null,
        quote: cw.leading_quotes || [],
        comparison_rows: t.comparison,                                                           // leading column (unchanged)
        alternate: { number: altN, name: TYPE_NAMES[altN], comparison: alt.comparison },         // P3: alternate column (EXISTING content)
        discriminator: (apiResult.coach_report && apiResult.coach_report.section6 && apiResult.coach_report.section6.pushes_back && apiResult.coach_report.section6.pushes_back.key_distinction) || '',
      },
      patterns: { thinking: t.patterns.thinking, feeling: t.patterns.feeling, behaving: t.patterns.behaving, inquiry_lines: t.inquiry_lines }, // P4
      wings_lines: { wings: t.wings, lines: t.lines, wings_primer: stat.wings_primer, lines_primer: stat.lines_primer, // P5 (wings/lines unchanged; primers PENDING)
        wing_low: wingLow, wing_high: wingHigh, line_stress: lineStress, line_security: lineSecurity }, // P5 remap (template-shaped)
      instinct_subtype: {                                                                       // P6
        subtype: { name: st.name, tagline: st.tagline, narrative: st.narrative, patterns: st.patterns },
        instinct_evidence: cf.instinct_evidence ?? null,
        instinct_stack: instinctStack(h.instinct_score_profile),
        instinct_primer: stat.instinct_primer, instinct_definitions: stat.instinct_definitions, // static PENDING
      },
      strengths_challenges: { strengths: t.strengths, challenges: t.challenges, shifts: st.shifts, practices: t.practices }, // P7
      application: { communication: t.communication, conflict: t.conflict, center: t.center },   // P8
    },
  };

  validateModel(model, CLIENT_SPEC);
  model._flags = flags; model._warnings = warnings;
  return model;
}

// ---------- validation ----------
const countWords = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
// spec: { required:[paths — present & non-null, '' ok], nonEmptyArrays:[paths], ints0to100:[paths to arrays of {score}] }
function validateModel(model, spec) {
  const missing = [];
  for (const p of spec.required) {
    const v = getPath(model, p);
    if (v === undefined || v === null) missing.push(p);
  }
  for (const p of spec.nonEmptyArrays || []) {
    const v = getPath(model, p);
    if (!Array.isArray(v) || v.length === 0) missing.push(`${p} (non-empty array)`);
  }
  if (missing.length) throw new Error(`validateModel: missing/invalid required fields:\n  - ${missing.join('\n  - ')}`);
  for (const p of spec.ints0to100 || []) {
    const arr = getPath(model, p) || [];
    for (const item of arr) {
      const v = item.score;
      if (!Number.isInteger(v) || v < 0 || v > 100) throw new Error(`validateModel: ${p} score out of range/int: ${v}`);
    }
  }
  return true;
}

const COACH_SPEC = {
  required: [
    'client.first_name', 'hero.number', 'hero.name', 'hero.center', 'hero.centerColor',
    'confidence.label', 'confidence.near_tie', 'alternate.number', 'alternate.name',
    'svg.type', 'bottom_line', 'comparison.leading.rows', 'comparison.alternate.rows',
    'comparison.discriminator', 'comparison.client_words', 'ataglance.stress', 'ataglance.release',
    'debrief.subtype.question', 'debrief.lines.question', 'debrief.wings.question',
  ],
  nonEmptyArrays: ['charts.types', 'charts.instincts', 'ataglance.wings', 'responses_revealed',
    'debrief.subtype.bullets', 'debrief.lines.bullets', 'debrief.wings.bullets'],
  ints0to100: ['charts.types', 'charts.instincts'],
};

// Client spec excludes the 6 PENDING static.* zones (allowed null until Phase 6).
const CLIENT_SPEC = {
  required: [
    'client.first_name', 'client.full_name', 'hero.number', 'hero.name', 'hero.subtype_name',
    'confidence.label', 'alternate.number', 'alternate.name', 'svg.type', 'svg.base', 'svg.wings',
    // display.* (spec §5) — grammar-ready strings the page port will consume
    'display.type_word', 'display.instinct_label', 'display.instinct_code',
    'display.subtype_label', 'display.confirmed_type_name',
    'pages.type_hypotheses.core_motivation', 'pages.type_hypotheses.comparison_rows',
    'pages.type_hypotheses.alternate.comparison',                                  // P3 alternate column
    'pages.patterns.thinking', 'pages.patterns.feeling', 'pages.patterns.behaving',
    'pages.wings_lines.wings', 'pages.wings_lines.lines',
    'pages.wings_lines.wing_low.name', 'pages.wings_lines.wing_high.name',          // P5 remap (leaf coverage)
    'pages.wings_lines.line_stress.body', 'pages.wings_lines.line_security.body',
    'pages.instinct_subtype.subtype', 'pages.strengths_challenges.strengths',
    'pages.strengths_challenges.challenges', 'pages.application.communication',
    'pages.application.conflict', 'pages.application.center',
  ],
  nonEmptyArrays: ['charts.instincts', 'instinct_stack', 'pages.patterns.inquiry_lines',
    'pages.strengths_challenges.strengths', 'pages.strengths_challenges.challenges'],
  ints0to100: ['charts.instincts'],
};

module.exports = {
  buildCoachModel, buildClientModel, validateModel,
  // helpers exported for unit checks
  lib, resolveTypeMeta, subtypeKey, typeBars, instinctBars, instinctStack, nearTie, confidenceLabel,
};
