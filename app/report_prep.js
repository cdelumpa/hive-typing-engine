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

/**
 * Sheet 11 "Development Ideas" (PR 6 Build A) — the page model, from the resolved type row
 * and the resolved statics, so a published CMS override reaches it without further wiring.
 *
 * ONE SHAPE FOR ALL THREE SECTIONS. `sections` is what lets the Build B builder draw three
 * cards from one function (criterion C2). Titles and rail descriptions come from `stat` and
 * never from the type row, so they cannot vary by type (C4).
 *
 * NULL, NOT DEFAULTED, when a type has no block — the v3_explore rule, so a missing type throws
 * in the builder rather than rendering empty cards. Never a throw here: this model also feeds
 * the live v2 report.
 *
 * A BLANK ITEM IS DROPPED (audit A4). The CMS saves an emptied box as '' and has no way to
 * remove an item, so blanking is how an editor shortens a list. An experiment counts as blank
 * only when both halves are; a half-blank one is kept, for Build C's publish check to refuse.
 *
 * New arrays and objects throughout: `d` is the require-cached library object, shared by
 * every render in the process.
 */
const DEVIDEAS_SECTIONS = ['growth', 'inquiries', 'experiments'];
function devIdeas(d, stat) {
  if (!d) return null;
  const blank = (s) => typeof s !== 'string' || s.trim() === '';
  const titles = stat.devideas_titles_v3 || {}, rails = stat.devideas_rails_v3 || {};
  return {
    lead: stat.devideas_lead_v3 || '',
    coda: stat.devideas_coda_v3 || '',
    sections: DEVIDEAS_SECTIONS.map((key) => ({
      key,
      title: titles[key] || '',
      desc: rails[key] || '',
      items: key === 'experiments'
        ? (d.experiments || []).filter((e) => e && !(blank(e.label) && blank(e.body)))
            .map((e) => ({ label: e.label, body: e.body }))
        : (d[key] || []).filter((s) => !blank(s)),
    })),
  };
}

function typeBars(call1_ranking) {
  return (call1_ranking || []).map(r => ({ type: r.type, score: Math.round(r.score), color: centerFill(r.type) }));
}
/**
 * The client heat map's nine node values — sheet 5 (PR 5).
 *
 * A SIBLING OF typeBars, NOT AN OVERLOAD OF IT. typeBars colours every bar by CENTRE for the
 * coach's chart; the client figure is a single cyan ramp and has no centre semantics at all.
 * Merging them would put two chart-shaping rules behind one name, which is the hazard
 * renderer.js's instinctRanks comment describes for ordering rules.
 *
 * ROUNDS, and that is load-bearing rather than cosmetic. call1_ranking is AI-emitted
 * (`<0-100>`; in em_only it is EM's em_ranking) and nothing constrains it to integers, while
 * validateModel's ints0to100 check requires Number.isInteger. Without the round, one
 * fractional score from the model would throw inside buildClientModel and the client report
 * would fail to generate. typeBars has always rounded, which is why the coach path has never
 * seen it.
 *
 * DOES NOT SORT. The ramp is a lookup by type, and the two rings are placed from
 * hero.number and alternate.number — never from this array's ordering. Sorting here would
 * invite a page builder to read position 1 as "the leading type", which is exactly the
 * coupling that makes a REDIRECT render both rings on one node.
 */
function typeRamp(call1_ranking, heroN, altN) {
  // ── THE ORDER IS THE OUTPUT. `position` is what sheet 5 shades by. ──────────────────────
  //
  // POSITIONS 1 AND 2 COME FROM THE FIELDS THE RINGS THEMSELVES READ — hero.number and
  // alternate.number — NOT from leading_candidate. That distinction is the whole guarantee.
  // On a stage-4 REDIRECT `confirmed_type` and `leading_candidate` differ (traced: confirmed 5,
  // leading 9), so ordering from `leading_candidate` would put the solid LEADING ring on
  // position 2 — the exact defect rank-shading exists to remove. Sourcing both from the ring's
  // own field means there is no path on which the fill and the ring can disagree: it is one
  // value used twice, not two values that happen to agree.
  //
  // `third_candidate` IS DELIBERATELY NOT USED. It is hard-null on the production path
  // (em_report_adapter.js sets `third_candidate: null`), the EM schema never asks for one, and
  // app/server.js's Call #2 prompt says it "is never shown to the client". On em_only it would
  // arrive from SM Call #1 — a third provenance in one nine-step scale — and it buys nothing:
  // on all three tracked fixtures it equals the ranking's top entry after the two placed types
  // are removed.
  //
  // THE SCORE IS KEPT. It costs nothing, keeps charts.types truthful about what the engine
  // produced, and leaves the door open if the figure ever wants magnitude again. Nothing on
  // sheet 5 reads it.
  //
  // DE-DUPLICATED WHILE PLACING, and the backfill is not decoration. A collided record ships
  // with confirmed_type === alternate_candidate (call2_stamp.js flags it and does NOT
  // hard-stop), and a malformed call1_ranking is not validated anywhere upstream. Placing each
  // type once and then backfilling 1-9 guarantees nine positions whatever arrives, so a bad
  // ranking can only scramble positions 3-9 — it can never misplace a ring.
  const byType = new Map((call1_ranking || []).map(r => [r.type, Math.round(r.score)]));
  const placed = [];
  const seen = new Set();
  const put = (t) => { if (t != null && !seen.has(t)) { seen.add(t); placed.push(t); } };
  put(heroN);
  put(altN);
  for (const r of [...(call1_ranking || [])].sort((a, b) => b.score - a.score)) put(r.type);
  for (let t = 1; t <= 9; t += 1) put(t);
  return placed.map((type, i) => ({ type, position: i + 1, score: byType.has(type) ? byType.get(type) : null }));
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
  // Computed ONCE and read twice — by charts.types below and by v3Hypotheses. Two calls could
  // not disagree today (typeRamp is pure), but the sheet-5 guarantee is that there is a single
  // ordering, and a single call is how that is enforced rather than assumed.
  const typeBars0 = typeRamp(h.call1_ranking, heroN, altN);
  const st = resolveLibObject(overrides, subtypeKey(instinct, heroN), lib(subtypeKey(instinct, heroN)));
  const stat = resolveLibObject(overrides, 'static', lib('static'));

  // ── SHEET 5's TWO HYPOTHESES — RESOLVED ONCE, FROM POSITION (PR 5 Build B2a) ──────────────
  //
  // THE ONE PLACE THAT TURNS A POSITION INTO A TYPE. Everything on sheet 5 that refers to a
  // hypothesis reads this array: both panels, their headings, their copy, and — via
  // charts.types, which this is built from — the figure's two rings and their labels. That is
  // what makes "every element agrees" a property of the construction rather than of care.
  //
  // WHY NOT THE SCALARS, WHICH IS THE DEFECT THIS EXISTS TO REMOVE. hero.number and
  // alternate.number are what the ENGINE named. On a collided record call2_stamp ships
  // confirmed_type === alternate_candidate deliberately — it flags the collision for admin
  // review and does not hard-stop, "the client still gets a report" — so the two scalars name
  // ONE type. typeRamp de-duplicates while placing, so position 2 falls through to the next
  // ranked type, and PR 5 Build R moved the figure's dashed ring onto position 2. A panel built
  // from alternate.number therefore prints "Type 9 — The Peacemaker" beside a dashed ring on
  // node 5. MEASURED on a forced collided anders_sx9, not reasoned about. That is the default
  // construction, not an edge case, and it is why this array exists.
  //
  // TWO ENTRIES, ALWAYS, AND THEY CANNOT BE THE SAME TYPE. typeRamp places heroN first, then
  // altN, then the ranking, then 1-9, skipping anything already placed — so positions 1 and 2
  // are distinct on every record whatever arrives, including a malformed call1_ranking. The
  // page cannot show one hypothesis twice, and it cannot show only one.
  //
  // `role` TRAVELS WITH THE DATA. The builder maps over this array rather than reading [0] and
  // [1] into two hand-written blocks, so a label and its type cannot be transposed by an edit
  // to a template.
  //
  // ⚠ ADDITIVE. `alternate` below is NOT redefined and must not be: renderer.js:2285 and :2315
  // (the v2 client report) and :1785 and :1850 (the coach report) read it, and both ship today.
  // For a coach, "the type the engine named" remains the truth worth having; the collision's
  // provenance reaches them through collision_flag. This array is the CLIENT's sheet-5 view.
  //
  // THE SUBTYPE IS NOT A THIRD HYPOTHESIS — IT IS A PROPERTY OF THE LEADING ONE, and it is
  // expressed that way: it hangs off hypotheses[0] rather than sitting beside the pair. Two
  // consequences, both structural. It cannot be attached to the alternate, because there is no
  // slot there to attach it to. And it is resolved from hypotheses[0].number rather than from
  // heroN, so the subtype and the leading hypothesis cannot name different types — they read one
  // number. Equal on every record either way; the difference is whether that equality is
  // guaranteed or merely observed, and this build exists because observed equality is what let a
  // panel disagree with a ring.
  //
  // MOTIVATION IS RESOLVED FROM THE ENTRY'S OWN TYPE NUMBER (PR 5 Build B2b). Each panel's copy
  // comes from type_<that entry's number>.quickref_v3.core_motivation — a client-facing
  // second-person sibling of description.core_motivation, which stays as it is because the COACH
  // report renders it and a coach must not be addressed as the client. See
  // INTERIM_QUICKREF_TYPE_V3 in scripts/build_content_library.js.
  //
  // Resolved HERE, from `number`, rather than passed in from heroN/altN — so a panel's words and
  // its heading cannot name different types. That is the same one-source rule the pair exists for,
  // applied one level down.
  const v3Hypotheses = (() => {
    const byPos = Object.fromEntries((typeBars0 || []).map((r) => [r.position, r.type]));
    return [
      { role: 'leading',   position: 1 },
      { role: 'alternate', position: 2 },
    ].map((h) => {
      const number = byPos[h.position] ?? null;
      const row = number != null ? resolveLibObject(overrides, `type_${number}`, lib(`type_${number}`)) : null;
      const motivation = (row && row.quickref_v3 && row.quickref_v3.core_motivation) || '';
      return { ...h, number, name: number != null ? (TYPE_NAMES[number] || '') : '', motivation };
    });
  })();

  // The three subtype rows for the hero type, RESOLVED ONCE AND CONSUMED TWICE — by p10's
  // three-column slot and by sheet 5's single-subtype slot. Hoisted out of pages.v3_instincts
  // at PR 5 Build A for exactly that reason: two `resolveLibObject` reads of the same key
  // could return different values if an override landed between them, and the two pages print
  // the same naranjo name. One read makes disagreement impossible rather than unlikely.
  //
  // `summary` is stripped from the p10 columns below, not carried into them: p10's model slot
  // stays byte-identical to what it was before this build, which is what keeps the 32 renders
  // byte-identical.
  //
  // ⚠ KEYED OFF THE LEADING HYPOTHESIS, NOT heroN (PR 5 Build B2a, folded in on review). The
  // subtype is not a third hypothesis — it is a PROPERTY OF the leading one, so it is resolved
  // from that hypothesis's type number rather than from the scalar. The two are equal on every
  // record, because typeRamp places heroN at position 1 unconditionally; the point is that they
  // are equal BY CONSTRUCTION rather than by two lookups that happen to agree. p10 reads these
  // same rows and is unaffected for exactly that reason.
  const leadingN = v3Hypotheses[0].number ?? heroN;
  const v3SubtypeRows = ['sp', 'so', 'sx'].map((i) => {
    const k = `subtype_${i}${leadingN}`;
    const row = resolveLibObject(overrides, k, lib(k));
    const iv = row.instincts_v3 || {};
    return {
      instinct: i.toUpperCase(),
      code: `${i.toUpperCase()}${leadingN}`,
      naranjo: iv.naranjo || '',
      signature: iv.signature || '',
      narrative: iv.narrative || '',
      summary: (row.quickref_v3 && row.quickref_v3.summary) || '',
    };
  });
  const v3SubtypeCols = v3SubtypeRows.map(({ summary, ...col }) => col);

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
      // The TYPE-NUMBER plural, which is a different string from the nickname plural and the
      // one sheet 6's at-a-glance labels use: "What Nines Want", not "What Peacemakers Want".
      // Six is the only one that does not take a bare "s".
      type_word_plural: TYPE_WORD[heroN] === 'Six' ? 'Sixes' : `${TYPE_WORD[heroN]}s`,
    },
    alternate: nameNode(altN),
    confidence: { label: confidenceLabel(h.confidence_level), near_tie: nearTie(h.call1_ranking) },
    svg: { type: { variant: 'type', type: heroN }, base: { variant: 'base' }, wings: { variant: 'wings-lines', type: heroN } },
    charts: { types: typeBars0, instincts: instinctBars(h.instinct_score_profile) },
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
        // Sheet 5's ALTERNATE hypothesis block. The v3 second-person motivation, from the
        // ALTERNATE type's library entry — `alt`, resolved at :218 — not the hero's. p6 reads
        // the hero's copy of this same field via pages.v3_explore.p6; sheet 5 is the first
        // page that needs the alternate's, and it is the only v3 page that renders the
        // alternate at all. Optional-chained: `explore_v3` is present for all nine types
        // today, and a `??  null` here would hide a regression that CLIENT_SPEC should catch.
        alternate_core_motivation: (alt.explore_v3 && alt.explore_v3.p6 && alt.explore_v3.p6.core_motivation) || null,
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
      // CLIENT REPORT v3 — sheets 6 and 7, "Exploring Your Type Hypothesis".
      //
      // ALL NINE TYPES as of PR 3e. `explore_v3` is present for every type, and
      // validateExplore in build_content_library.js asserts that a type either carries the
      // whole zone set or none of it — a partially-authored type fails the build rather than
      // rendering gaps. If a type ever lacks it, this resolves to null and the renderer drops
      // both sheets from the document rather than emitting them empty. Deliberately
      // NOT defaulted to '' / [] the way v3_wings and v3_lines are: those default so an
      // unauthored type renders an empty page, which is the failure mode this sequence has
      // twice had to fix. Here, no content means no page.
      // `words` is the sheet's one PER-CLIENT zone ("In Your Own Words") and is deliberately
      // carried on this object rather than beside it: it is what sheet 6 renders, and the
      // renderer already reads this object. Source is client_words.leading_quotes — the same
      // verbatim Stage-1 language P3 quotes — NOT the content library, which is per-type.
      //
      // SPREAD, never mutate: t.explore_v3 is the require-cached content library object,
      // shared by every render in the process. Assigning onto it would leak one client's
      // quotes into the next client's report.
      v3_explore: t.explore_v3 ? { ...t.explore_v3, words: cw.leading_quotes || [] } : null,
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
      // ── p10 Instincts & Subtypes (PR 4 step 5A) ─────────────────────────────────────
      //
      // WHY THIS IS HERE AND NOT IN THE RENDERER. renderer.js has no content-library access
      // and never has; every library read in this project goes through resolveLibObject so
      // that published CMS overrides apply. A renderer-side read would BYPASS that, and p10
      // would silently ignore every content override an editor publishes — which is exactly
      // what step 5B exists to enable. So the page is fed from here, like every other v3
      // page (v3_wings, v3_lines, v3_explore, v3_contents, v3_thoughts).
      //
      // All THREE subtype rows, not just the client's: p10 renders a three-column
      // comparison, so it needs the whole triple for the hero type. Each is resolved
      // through overrides independently.
      //
      // NOTE the definitions come from instinct_definitions_v3, NOT instinct_definitions.
      // The latter is live v2 content rendered by _clP6Instinct on .p6-page; step 4 landed
      // the v3 copy precisely so p10 does not read it.
      //
      // No badge ordering here, deliberately. PRIMARY/SECONDARY/TERTIARY is p10-LOCAL and
      // is computed in the page builder from charts.instincts + display.instinct_code.
      // instinctStack is read by live v2 p6, the coach report and the Coach Prep Report;
      // a second ordering rule in this module would invite the wrong import.
      v3_instincts: { columns: v3SubtypeCols, definitions: stat.instinct_definitions_v3 || [], primer: stat.instinct_primer || '' },

      // CLIENT REPORT v3 — sheet 5 "Quick Reference" (PR 5 Build A). CONTENT AND MODEL ONLY:
      // no builder exists yet and `quickref` carries no `built` flag, so nothing reads this.
      // It is prepared here because content is prepared into the model and never read from the
      // library in the renderer — the convention _clv3Instincts follows.
      //
      // THE SUBTYPE IS SELECTED FROM p10's OWN ROWS, BY INSTINCT CODE, NEVER BY INDEX.
      // v3SubtypeRows is resolved ONCE, above, and consumed twice: p10 renders all three
      // columns, sheet 5 renders the client's. So the two pages cannot disagree about a
      // subtype's naranjo name or signature — there is one read, not two. Selecting by index
      // would be right by luck for SP and silently wrong for SO and SX, the same trap
      // cmsPreviewSpec's instincts_v3 entry records for p10's preview.
      //
      // WHAT IS DELIBERATELY ABSENT. charts.types, instinctRanks, hero.number,
      // alternate.number, display.instinct_code, display.subtype_label and
      // type_hypotheses.core_motivation / .alternate_core_motivation ALL already reach the
      // renderer. Duplicating any of them here would create a second value that can drift from
      // the first, which is the defect this slot's subtype selection exists to avoid.
      //
      // THE TAGLINE IS NOT STORED. Sheet 5 renders `${naranjo} · ${signature}` with NO leading
      // article — ratified 8 Sep. The mockup's .stag ("The Seeker · Merging & Intensity") is
      // UNRATIFIED and is not ported: `Seeker` is not among the 27 naranjo values (SX9's is
      // `Fusion`), and the article breaks on 26 of 27 ("The Appetite", "The Non-Adaptability").
      // Composing it in the builder rather than storing it keeps one source for both pages.
      v3_quickref: {
        // The two hypotheses, resolved from position. See v3Hypotheses above for why this is
        // not sourced from hero.number / alternate.number.
        // The two hypotheses. The client's subtype hangs off hypotheses[0] — see the note
        // there — so sheet 5 has ONE place to read a hypothesis from, not two.
        hypotheses: v3Hypotheses.map((hyp) => {
          if (hyp.role !== 'leading') return hyp;
          const dom = String(instinct || '').toUpperCase();
          const own = v3SubtypeRows.find((c) => c.instinct === dom) || v3SubtypeRows[0];
          return { ...hyp, subtype: { instinct: own.instinct, code: own.code, naranjo: own.naranjo, signature: own.signature, summary: own.summary } };
        }),
        // CMS-EDITABLE, resolved per key through `stat` (resolveLibObject resolves each child
        // as `static.<field>`), so a published override reaches this without further wiring.
        lead: stat.quickref_lead_v3 || '',
        h2: stat.quickref_h2_v3 || '',
        zone8: stat.quickref_zone8_v3 || '',
        tips: stat.quickref_tips_v3 || [],
        tips_heading: stat.quickref_tips_heading_v3 || '',
        // NOT CMS-editable — structural labels, not prose.
        labels: stat.quickref_labels_v3 || {},
      },

      // CLIENT REPORT v3 — sheet 11 "Development Ideas" (PR 6 Build A; rendered from Build B1 by
      // _clv3DevIdeas, which throws on null). See devIdeas() for the shape.
      v3_devideas: devIdeas(t.devideas_v3, stat),

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

  // ── SHEET 5's TWO HYPOTHESES — WARN, NEVER THROW (PR 5 Build B2a) ────────────────────────
  //
  // C1 (both present) and C3 (two distinct types) are guaranteed by typeRamp's de-duplication,
  // so this cannot fire on any record the engine can produce. It is here for the case that
  // guarantee is ever weakened — a change to typeRamp's placing order, or a caller building
  // charts.types some other way — and it is a WARNING on purpose.
  //
  // NOT A THROW, and the reason is call2_stamp's: it ships imperfect records deliberately so the
  // client still gets a report, and a fatal prep-time check here would contradict that by
  // refusing to render a record the engine chose to send. A client with a slightly wrong sheet 5
  // is better served than a client with no report. The hard gate belongs at render time, over
  // the emitted page, where it can compare the rings against the panels — that is B2b's.
  const _h = model.pages.v3_quickref.hypotheses;
  if (!Array.isArray(_h) || _h.length !== 2) {
    warnings.push(`v3_quickref.hypotheses is ${Array.isArray(_h) ? _h.length : 'not an array'}, expected 2 (C1)`);
  } else {
    if (_h[0].number == null || _h[1].number == null) {
      warnings.push(`v3_quickref.hypotheses has an unresolved type: ${_h.map((x) => x.number).join('/')} (C1)`);
    } else if (_h[0].number === _h[1].number) {
      warnings.push(`v3_quickref.hypotheses names type ${_h[0].number} twice — one hypothesis wearing two labels (C3)`);
    }
  }

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
  for (const p of spec.positionsOneToNine || []) {
    const pos = (getPath(model, p) || []).map(r => r.position);
    const want = [1, 2, 3, 4, 5, 6, 7, 8, 9].join(',');
    if ([...pos].sort((a, b) => a - b).join(',') !== want) {
      throw new Error(`validateModel: ${p} positions must be 1-9 exactly once; got [${pos.join(', ')}]`);
    }
  }
  // Exactly nine entries, one per type 1-9, no repeats and no strays.
  for (const p of spec.ninePerType || []) {
    const types = (getPath(model, p) || []).map(r => r.type);
    const want = [1, 2, 3, 4, 5, 6, 7, 8, 9].join(',');
    const got = [...types].sort((a, b) => a - b).join(',');
    if (got !== want) {
      throw new Error(`validateModel: ${p} must carry one entry per type 1-9; got `
        + `${types.length} [${types.join(', ')}]`);
    }
  }
  // Every type named here must have a node in charts.types, or sheet 5 has a ring with
  // nowhere to draw it. Runs before ints0to100 so a MISSING node is reported as a missing
  // node rather than as a score-range failure on a shorter array.
  for (const p of spec.nodesFor || []) {
    const n = getPath(model, p);
    const types = (getPath(model, 'charts.types') || []).map(r => r.type);
    if (!types.includes(n)) {
      throw new Error(`validateModel: ${p} is ${n}, which has no node in charts.types `
        + `[${types.join(', ')}] — sheet 5 would have a ring with nowhere to draw it`);
    }
  }
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
  nonEmptyArrays: ['charts.types', 'charts.instincts', 'instinct_stack', 'pages.patterns.inquiry_lines',
    'pages.strengths_challenges.strengths', 'pages.strengths_challenges.challenges',
    'pages.welcome.letters'],
  // charts.types scores are NOT range-checked here any more: a type absent from a malformed
  // call1_ranking is backfilled with score null, which is honest — the engine produced no number
  // for it — and ints0to100 would reject it. What sheet 5 actually reads is `position`, asserted
  // by positionsOneToNine below. charts.instincts keeps the check.
  ints0to100: ['charts.instincts'],
  // Positions must be exactly 1..9, each once. This is what the figure shades by, so it is the
  // one that has to hold. It catches everything that changes the ENTRY COUNT; ninePerType covers
  // the type set, which is a different property — see the note there.
  positionsOneToNine: ['charts.types'],
  // ── SHEET 5's OWN INVARIANTS (PR 5 Build 1) ──────────────────────────────────────────
  //
  // WHY NOT `leading_candidate`. The plan (§22.4d, A5) asserted leading_candidate and
  // alternate_candidate were both present, written when the LEADING ring read
  // leading_candidate. Cai's 8 Sep decision moved that ring to hero.number, so
  // leading_candidate is no longer read by any client page — and it was never ON the client
  // model in the first place (report_prep.js:159 puts it on the COACH model only). Asserting
  // it here would be a category error: this validator checks model paths, and that is an
  // api_result field. Its integrity is a coach-model concern and stays there.
  //
  // WHAT REPLACES IT IS STRICTLY STRONGER. The ring needs a NODE, not a scalar. Checking that
  // charts.types actually contains hero.number and alternate.number tests the invariant the
  // page depends on, and catches a short or mis-typed call1_ranking — which the CMS preview
  // stub emitted for a year at two entries — where a scalar presence check would not.
  nodesFor: ['hero.number', 'alternate.number'],
  // ONE ENTRY PER TYPE 1-9. **ITS STATED PURPOSE IS STALE AND IS CORRECTED HERE; THE CHECK
  // ITSELF IS NOT VACUOUS AND STAYS.**
  //
  // It was added at PR 5 Build 1 to catch a TWO-entry call1_ranking — the shape the CMS preview
  // stub emitted — which satisfied every other check because its two entries happened to be the
  // hero and the alternate. **It can no longer do that.** Build 3's typeRamp BACKFILLS, so every
  // ranking becomes nine long: measured, a two-entry ranking threw before the backfill and
  // builds cleanly after it. The detector for that case is now the `score: null` assertion in
  // tests/report_pages_test.js — backfilled entries carry no score, which is the signal.
  //
  // WHY IT IS STILL HERE, checked rather than assumed. `positionsOneToNine` runs first and
  // catches every case that changes the ENTRY COUNT, which under the current typeRamp is every
  // stray or out-of-range type. But the two checks are not equivalent: positions are assigned
  // by index, so they can be 1-9 exactly once while the TYPES contain a duplicate and a gap.
  // Measured against a typeRamp with its de-duplication and backfill removed and a ranking
  // carrying type 9 twice: positionsOneToNine PASSES and this check fires —
  // "must carry one entry per type 1-9; got 9 [9, 9, 1, 8, 3, 2, 7, 4, 6]".
  //
  // So it guards the type set against a future rewrite of typeRamp, which is a different
  // property from the one positionsOneToNine guards. Deleting it would leave that unchecked.
  ninePerType: ['charts.types'],
};

module.exports = {
  buildCoachModel, buildClientModel, validateModel,
  // helpers exported for unit checks
  lib, resolveTypeMeta, subtypeKey, typeBars, instinctBars, instinctStack, nearTie, confidenceLabel,
  devIdeas,
};
