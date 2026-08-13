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

const library = require('./content/content_library.json');
const { TYPE_NAMES, TYPE_META, INSTINCT_NAME } = require('./type_meta');
const { loadPublishedOverrides, resolveLibObject } = require('./content_overrides');

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
// Archetype name minus its leading article — "The Peacemaker" -> "Peacemaker". Design spec
// v3.0 §6; verified against all nine TYPE_NAMES by tests/report_pages_test.js.
const nickname = (typeName) => String(typeName || '').replace(/^The\s+/, '');
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
// Near-tie when the alternate's coherence score is within 5% of the leading
// score (relative threshold). call1_ranking is rank-ordered: [0] leading, [1]
// alternate. Call #1 always runs, so these scores are always available.
const nearTie = (ranking) => {
  if (!ranking || ranking.length < 2) return false;
  const leading = ranking[0].score;
  const alternate = ranking[1].score;
  return alternate >= leading * 0.95;
};
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
async function buildCoachModel({ apiResult, client, coach, tighten = 0 }) {
  const flags = [], warnings = [];
  // CMS: load published content_overrides once per render; resolveLibObject below
  // applies any "<topKey>.<field>" override over the content_library baseline.
  const overrides = await loadPublishedOverrides();
  const capW = 130;   // PR-4: single 130w/band budget (verified ceiling at 48px band spacing). Was [80,62,48,40] tighten ladder — inert since the measurement gate was removed.
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

  const t = resolveLibObject(overrides, `type_${heroN}`, lib(`type_${heroN}`));
  const alt = resolveLibObject(overrides, `type_${altN}`, lib(`type_${altN}`));
  const s2 = cr.section2 || {}, s4 = cr.section4 || {}, s5 = cr.section5 || {}, s6 = cr.section6 || {};
  const pb = s6.pushes_back || {};

  const model = {
    client: {
      first_name: client.first_name || '',
      full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),   // composed from the input arg (carries last_name), mirroring buildClientModel; powers the coach mastheads
      org: client.organization || '', date: client.date || '',
    },
    coach: { full_name: coach.full_name || coach.name || '', type: coach.type ?? null, instinct: coach.instinct || '' },
    hero: { number: heroN, name: meta.name, subtype_name: instinctName(instinct), center: meta.center, centerColor: meta.centerColor },
    confidence: {
      label: confidenceLabel(h.confidence_level),
      near_tie: nearTie(h.call1_ranking),
      leading_score: (h.call1_ranking && h.call1_ranking[0]) ? h.call1_ranking[0].score : null,
      alternate_score: (h.call1_ranking && h.call1_ranking[1]) ? h.call1_ranking[1].score : null,
      leading_type: h.leading_candidate ?? null,
      alternate_type: h.alternate_candidate ?? null,
      leading_type_name: h.leading_candidate != null ? (TYPE_NAMES[h.leading_candidate] || '') : '',
      alternate_type_name: h.alternate_candidate != null ? (TYPE_NAMES[h.alternate_candidate] || '') : '',
      confidence_summary: cr.confidence_summary ?? null,   // State 2 (no near-tie) — AI-authored
      near_tie_callout: cr.near_tie_callout ?? null,        // State 1 (near-tie) — AI-authored
    },
    alternate: nameNode(altN),
    // DEAD CODE — redirect box removed 2026-06-20. Mark for removal
    // in post-beta cleanup sweep.
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
async function buildClientModel({ apiResult, client, coach, tighten = 0 }) {  // tighten: renderer-side compaction (self-heal)
  const flags = [], warnings = [];
  void tighten;
  // CMS: load published content_overrides once per render; resolveLibObject below
  // applies any "<topKey>.<field>" override over the content_library baseline.
  const overrides = await loadPublishedOverrides();
  const h = apiResult.hypothesis;
  const cf = apiResult.client_facing || {};
  const cw = apiResult.client_words || {};
  const heroN = h.confirmed_type;
  const altN = h.alternate_candidate;
  const instinct = h.dominant_instinct_hypothesis || h.confirmed_instinct || '';
  const meta = resolveTypeMeta(heroN);
  assertName(flags, 'hero', meta.name, h.confirmed_type_name, heroN);

  const t = resolveLibObject(overrides, `type_${heroN}`, lib(`type_${heroN}`));
  const alt = resolveLibObject(overrides, `type_${altN}`, lib(`type_${altN}`));   // P3: alternate candidate's EXISTING comparison rows
  const st = resolveLibObject(overrides, subtypeKey(instinct, heroN), lib(subtypeKey(instinct, heroN)));
  const stat = resolveLibObject(overrides, 'static', lib('static'));

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
      // [Nickname] tokens (brief v2.0 §12.4). The archetype name minus its article, and its
      // plural. Design spec v3.0 §6 defines the rule as strip "The", add "s"; it holds for
      // all nine names. PR 2 needs the plural for the Contents entry "Development Ideas for
      // Peacemakers"; PR 6 uses both for the page-11 title.
      //
      // NOT to be confused with hero.subtype_name, which despite the name holds the INSTINCT
      // label alone ("One-to-One"). For a subtype string use display.subtype_label.
      nickname: nickname(meta.name),                          // "The Peacemaker" -> "Peacemaker"
      nickname_plural: `${nickname(meta.name)}s`,             // -> "Peacemakers"
    },
    alternate: nameNode(altN),
    confidence: { label: confidenceLabel(h.confidence_level), near_tie: nearTie(h.call1_ranking) },
    svg: { type: { variant: 'type', type: heroN }, base: { variant: 'base' }, wings: { variant: 'wings-lines', type: heroN } },
    charts: { instincts: instinctBars(h.instinct_score_profile) },
    instinct_stack: instinctStack(h.instinct_score_profile),
    pages: {
      welcome: { greeting_name: client.first_name || '',
        subhead: stat.welcome.subhead, letters: stat.welcome.letters, callout: stat.welcome.callout },
      primer: stat.primer,                                                                      // static PENDING

      // ── client report v3 (PR 2) ───────────────────────────────────────────────
      // nine_types is stored in the Word source's own row order — [8,2,5,1,4,7,9,3,6] at
      // time of writing — because the docx groups the table by centre, not by number. The
      // v3 "What Is the Enneagram?" grid reads 1..9, and an unsorted grid renders nine
      // plausible-looking cards in the wrong order, which is exactly the kind of defect
      // that survives review. Sort here, once, rather than in the template.
      v3_whatis: {
        intro: stat.primer.intro,
        scan_heading: stat.primer.scan_heading,
        scan_line: stat.primer.scan_line,
        nine_types: stat.primer.nine_types.slice().sort((a, b) => a.number - b.number),
        close: stat.primer.footer,
      },
      v3_welcome: {
        greeting_name: client.first_name || '',
        subhead: stat.welcome.subhead,
        letters: stat.welcome.letters,
        signoff: stat.welcome.signoff,
      },
      // Contents rows carry `start` (the first sheet of the entry's span) and a descriptor
      // that may contain {type_word} / {subtype_label} / {nickname_plural}. Titles and page
      // numbers are NOT stored here — the renderer resolves both from V3_PAGE_ORDER so the
      // Contents page and the footers cannot disagree.
      v3_contents: stat.contents,
      v3_thoughts: stat.thoughts,
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
      wings_lines: { wings: t.wings, lines: t.lines, wings_primer: stat.wings_primer, lines_primer: stat.lines_primer, wings_using: stat.wings_using, // P5 (wings/lines unchanged; primers PENDING)
        wing_low: wingLow, wing_high: wingHigh, line_stress: lineStress, line_security: lineSecurity }, // P5 remap (template-shaped)
      // CLIENT REPORT v3 — p8 "Your Wings". Additive: the v2 wings_lines model above is
      // untouched, so the live 10-page report is unaffected. Reads the v3-only fields
      // (overview/bullets/resource/intro_v3) added to the content library alongside the
      // existing target_type/body, which splitWingBest() still consumes for v2.
      v3_wings: (() => {
        // COLUMN ORDER — deliberate decision, do not "fix" this.
        //
        // Columns follow the content library's wing_a/wing_b order. For Type 9 that happens
        // to match the diagram left-to-right (8 Wing left, 1 Wing right), which is why the
        // question never came up while Type 9 was the only authored type.
        //
        // It does NOT generalise, and that was checked against the section 3.5 node angles
        // rather than left for later: under library ordering, Types 4 and 5 are genuinely
        // crossed relative to the diagram, and Types 2, 3, 6 and 7 have both wings on the
        // same side of the wheel, so for those four "column position matches diagram
        // position" has no meaning at all. Type 9 is the only type where the two agree.
        //
        // Library order is kept anyway: it is one consistent rule that holds for all nine
        // types, whereas positional ordering is undefined for the four same-side types.
        // Both the columns and the diagram carry explicit labels ("8 WING · TYPE 8", "The
        // Protector"), so no reader depends on spatial correspondence between them.
        const mk = (slot) => {
          const w = t.wings[slot], n = w.target_type;
          return { number: n, name: TYPE_NAMES[n], overview: w.overview || '', bullets: w.bullets || [], resource: w.resource || '' };
        };
        return { intro: t.wings.intro_v3 || '', wing_a: mk('wing_a'), wing_b: mk('wing_b') };
      })(),
      // CLIENT REPORT v3 — p9 "Your Stress and Security Points". SPIKE wiring.
      //
      // narrative and band are CANON: type_N.lines.{stress,security}.{narrative,resource_card},
      // docx-sourced and Mo-approved for all nine types. They are read AS-IS and must not be
      // trimmed to fit — see docs/audit_pr3_per_type_pages.md.
      //
      // bullets / work / intro / work_lead come from the v3-only fields, absent for any type
      // whose p9 content is unauthored (they render empty, exactly as Wings does for types 1-8).
      v3_lines: (() => {
        const mk = (slot) => {
          const ln = t.lines[slot], n = ln.target_type;
          return { number: n, name: TYPE_NAMES[n],
            narrative: ln.narrative || '', band: ln.resource_card || '',
            bullets: ln.bullets_v3 || [] };
        };
        return { intro: t.lines.intro_v3 || '', work_lead: t.lines.work_lead_v3 || '',
          work: t.lines.work_v3 || [], stress: mk('stress'), security: mk('security') };
      })(),
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
    'client.first_name', 'client.full_name', 'hero.number', 'hero.name', 'hero.center', 'hero.centerColor',
    'confidence.label', 'confidence.near_tie', 'alternate.number', 'alternate.name',
    'svg.type', 'bottom_line', 'comparison.leading.rows', 'comparison.alternate.rows',
    'comparison.discriminator', 'comparison.client_words', 'ataglance.stress', 'ataglance.release',
    'debrief.subtype.question', 'debrief.lines.question', 'debrief.wings.question',
  ],
  nonEmptyArrays: ['charts.types', 'charts.instincts', 'ataglance.wings', 'responses_revealed',
    'debrief.subtype.bullets', 'debrief.lines.bullets', 'debrief.wings.bullets'],
  ints0to100: ['charts.types', 'charts.instincts'],
  // OPTIONAL — AI-authored confidence-box content (near-tie redesign 2026-06-20). Not
  // required: keeps dry-validate, CMS preview, and existing fixtures passing when absent.
  // The renderer guards on their presence before rendering the box.
  optional: ['confidence.confidence_summary', 'confidence.near_tie_callout'],
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
    'pages.welcome.subhead', 'pages.welcome.callout',                               // PR-2b structured welcome (body stays unread)
  ],
  nonEmptyArrays: ['charts.instincts', 'instinct_stack', 'pages.patterns.inquiry_lines',
    'pages.strengths_challenges.strengths', 'pages.strengths_challenges.challenges',
    'pages.welcome.letters'],
  ints0to100: ['charts.instincts'],
};

module.exports = {
  buildCoachModel, buildClientModel, validateModel,
  // helpers exported for unit checks
  lib, resolveTypeMeta, subtypeKey, typeBars, instinctBars, instinctStack, nearTie, confidenceLabel,
};
