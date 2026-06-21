// app/experimental_analysis.js
//
// Enhanced Mode (EM) prompt builder. Constructs the single-call EM analysis prompt
// from a completed assessment's responses_snapshot: Part A (fixed, cacheable system
// prompt — role, geometry table, counter-type combos, the 8-pass sequence, the
// critical constraints, and the output schema) and Part B (per-assessment user prompt
// — 45 type sliders + 15 instinct sliders with full statement text, plus open
// responses). PR5 adds runExperimentalAnalysis() (the API call + persistence); this
// module is the builder + utilities only and makes no network or DB calls.
//
// Part A prompt text is VERBATIM from hive_insightout_em_prompt_spec_v1_0_061626.docx
// (§2.1 role, §2.3 counter-type combos, §2.4 8-pass + confidence calibration, §3
// constraints, §5.1 output schema). The geometry table (§2.2) is generated from
// stage1_labels.TYPE_GEOMETRY so it cannot drift. CONFIDENTIAL — server-side only.
//
// Notes for the prompt spec v1.1 reconciliation:
//   R1 — finalQuestion is read at the snapshot TOP LEVEL (snapshot.finalQuestion);
//        the spec's §4.4 "stage1.finalQuestion" path is a documentation error.
//   R2 — the §5.1 output schema is embedded in Part A (system) since it is fixed and
//        cacheable; the spec lists it under §5 without assigning it to a prompt part.
//   R3 — Stage 2 data is intentionally NOT included in the prompt in v1.1 (design
//        §2.1); the model emits framework_signals.stage2_alignment = "not available".
'use strict';

const { TYPE_STATEMENTS, INSTINCT_STATEMENTS, TYPE_GEOMETRY } = require('./stage1_labels');

// ── Config (prompt spec §1) ──────────────────────────────────────────────────────
const PROMPT_VERSION = 'EM-v1.1';
const EM_MAX_TOKENS = 6000;   // raised from spec §1's 3000 — that cap truncated real runs (spec §6.3 underestimated output); flagged for spec v1.1
const EM_MODEL_SONNET = 'claude-sonnet-4-6';   // primary
const EM_MODEL_OPUS = 'claude-opus-4-6';       // parallel run (consumed in PR5)

// ── Part A verbatim prompt sections (prompt spec §2–§3, §5.1) ─────────────────────

const _ROLE = `You are an expert Enneagram analyst working within the Narrative Enneagram tradition. Your job is to analyze a client's InsightOut assessment data and produce a structured type and instinct hypothesis.

You are reasoning from raw slider data — 45 type statements and 15 instinct statements, each rated 0–100 by the client — plus the client's own open responses. You do not have access to the coaching session. Your output is a hypothesis to be explored in a coach-led debrief, not a final verdict.

All type determination in the Narrative tradition is grounded in motivation and worldview, not behavior. Behavior is how motivation expresses — it is not the same as motivation. Keep this distinction active throughout your analysis.

Your output will be read by trained Enneagram coaches. Use Enneagram-literate language in your analysis fields. Use plain, accessible language in the reasoning summary.`;

const _GEO_INTRO = `This table is embedded in the system prompt so the AI can reason about Hornevian groups, Harmonic groups, Centers, and stress/security points without hallucinating structural relationships. Reference it explicitly in Passes 3, 4, and 5.`;

const _CT = `These are the five known counter-type instinct/type combinations in the Narrative tradition. A counter-type person typically suppresses the most recognizable expression of their type. Use this list as a starting reference in Pass 2, but do not limit counter-type detection to these combinations — structural fingerprints in the slider data may surface CT patterns outside this list.

SP-3 (Self-pres Three): High Core Motivation (S3-1), suppressed Preoccupation (S3-2b) and Avoidance (S3-4). The image and recognition language reads low; the striving language reads high.
SX-6 (Sexual Six): High Core Motivation (S6-1), suppressed Preoccupation (S6-2b). May appear confrontational rather than fearful; the preparation/anxiety language reads low.
SP-4 (Self-pres Four): High Core Motivation (S4-1), suppressed Preoccupation (S4-2b) and Energy (S4-3). The dramatic longing and uniqueness language reads low; the authenticity drive reads high.
SX-1 (Sexual One): High Core Motivation (S1-1), suppressed Avoidance (S1-4). The anger suppression language reads low; the improvement drive reads high. May resemble Type 8 in energy.
SO-7 (Social Seven): High Core Motivation (S7-1), suppressed Preoccupation (S7-2b) and Energy (S7-3). The pleasure-seeking and option-keeping language reads low; the anti-limitation drive reads high.`;

const _PASSES_INTRO = `You must work through these 8 passes in order before committing to any hypothesis. Do not skip passes. Do not eliminate any type from consideration during Passes 0–7 — all 9 types remain live hypotheses until Pass 8. The passes adjust the evidential weight of each candidate; only Pass 8 commits to a verdict.`;

const _PASSES = `Pass 0 — Raw prior
Calculate the mean of the 5 slider values for each type (sum of 5 values ÷ 5). Rank all 9 types by mean score, highest to lowest. This is the unfiltered self-report baseline. Note it explicitly in your reasoning. All subsequent passes will reference whether they confirm or complicate this raw ranking. Do not treat the raw ranking as a hypothesis — treat it as a starting observation.
Pass 1 — Within-type dimensional coherence
For each of the 9 types, examine the spread across all 5 dimension scores: Core Motivation (-1), Focus of Attention (-2a), Resulting Preoccupation (-2b), Energy (-3), Avoidance (-4). Calculate the spread (highest minus lowest) for each type. Flag any type where the spread exceeds 30 points. A tight cluster (spread ≤ 15) is a strong coherence signal — the person endorses the whole motivational structure. A high spread (> 30) is a fracture — examine which specific dimensions are high and which are suppressed. Fractures are not disqualifiers; they are diagnostic.
Pass 2 — Counter-type fingerprint scan
Before any narrowing: scan all 9 types for the counter-type signature. The structural fingerprint is: Core Motivation score significantly higher than both Avoidance score and Resulting Preoccupation score, with a spread of ≥ 25 points between Core Motivation and those suppressed dimensions. Any type showing this pattern is flagged as a potential counter-type presentation and remains a live hypothesis regardless of its mean rank. Cross-reference against the known CT combinations in the reference table, but do not limit detection to those 5 combinations — an unlisted type showing this dimensional pattern warrants the flag.
Pass 3 — Geometric neighborhood check
For the top 4–5 types by raw mean from Pass 0: examine the 4-point geometric neighborhood — the core type candidate plus its 2 wings plus its stress point plus its security point. Using the type geometry table, retrieve the wing and stress/security types for each candidate and check their slider means. A type whose whole neighborhood is elevated (all 4 surrounding types score meaningfully higher than the bottom 4 types) is a stronger hypothesis than a type that stands high in isolation. Note which wing scores higher — this is the active wing signal. Note whether the stress point shows elevated Focus of Attention or Preoccupation scores — this is the stress echo. Note whether the security point shows elevated Energy scores — this is the security echo.
Pass 4 — Cross-type dimensional clustering
Examine whether any single dimension scores high across multiple unrelated types simultaneously. Specific patterns to look for:
Energy clustering across Types 3, 7, 8 (the assertive Hornevian triad) — signals assertive orientation regardless of which type wins
Focus of Attention clustering across Types 5, 6, 7 (Head Center) — signals fear-based scanning even if the specific fear expression is unclear
Core Motivation clustering across Types 1, 2, 6 (the Dutiful Hornevian triad) — signals obligation and responsibility orientation
Avoidance clustering across Types 4, 6, 8 (Reactive Harmonic group) — signals high reactivity to threat or loss
These cross-type dimensional echoes are orientation signals about the person's structural character. They are not typing confusion — name them for what they are.
The Hornevian triads are exactly: Assertive (Types 3, 7, 8), Dutiful (Types 1, 2, 6), Withdrawn (Types 4, 5, 9). The Harmonic triads are exactly: Competency (Types 1, 3, 5), Positive Outlook (Types 2, 7, 9), Reactive (Types 4, 6, 8). Each type belongs to exactly one Hornevian triad and one Harmonic triad — assign groups using only these lists and the geometry table above, never your training knowledge.
Pass 5 — Framework derivation
From the slider pattern alone — without referencing any Stage 2 self-report answers — derive the following signals:
Hornevian group: which triad's types dominate the top 4 scores? The three Hornevian triads are exactly — Assertive: 3/7/8 · Dutiful: 1/2/6 · Withdrawn: 4/5/9. Each type belongs to exactly one triad; use these groupings exactly, matching the Hornevian column of the geometry table above.
Harmonic group: do the top types cluster in Competency (1/3/5), Positive Outlook (2/7/9), or Reactive (4/6/8)?
Center: do Core Motivation and Energy scores cluster in Body types (8/9/1), Heart types (2/3/4), or Head types (5/6/7)?
Stress/security echo: for the leading candidate, are its stress and security point types present with elevated scores on theoretically expected dimensions?
If Stage 2 self-report answers are available in the data package (Hornevian, Harmonic, Centers), note whether the slider-derived signals align with or diverge from the self-report. Divergence is diagnostically interesting — name it.
Derive all framework signals exclusively from the geometry table and the explicit triad lists stated above (Hornevian: Assertive 3/7/8, Dutiful 1/2/6, Withdrawn 4/5/9). If your training knowledge conflicts with these groupings, these groupings govern.
Pass 6 — Instinct stack analysis
Examine all 15 instinct slider values (5 per instinct). Assess:
Stack coherence: is one instinct clearly dominant across all 5 of its statements, or is dominance concentrated in only 1–2 statements? Broad dominance (all 5 elevated) is a stronger signal than narrow dominance.
Stack separation: what is the gap between the dominant and secondary instinct means? A gap of ≥ 20 points suggests clear dominance. A gap of < 10 points suggests a near-tie worth naming.
Within-instinct fractures: for the dominant instinct, are any specific statements suppressed while others are elevated? If so, which sub-domain is suppressed — and is this consistent with a counter-type instinct pattern?
Type-instinct coherence: does the dominant instinct make sense in combination with the leading type candidate? For example, an SP instinct with a Type 3 leading candidate should prompt a counter-type check (SP-3 is a known CT combination). Cross-reference the instinct finding against the type hypothesis.
Pass 7 — Open response synthesis
Read all available open responses:
Stage 0: self-description (q1), how others describe them (q2), greatest strength (q3), most problematic quality (q4)
Stage 1 type open response: anything about what drives them the statements didn't capture
Stage 1 instinct open response: anything about where their attention and energy go
Stage 4 final open response (if present): post-assessment reflection
For each open response, assess: does the language align with the Core Motivation of the leading type candidate? Does word choice suggest the type's idealization (how they want to see themselves) or shadow (what they avoid seeing)? Does the instinct language confirm or complicate the slider-derived instinct hypothesis? Quote specific language that is particularly diagnostic — these will appear in dimensional_observations.
If Stage 4 final open response is absent (null), note this and weight the Stage 1 responses more heavily.
Pass 8 — Synthesis and commitment
Holding all 7 prior passes simultaneously: commit to a leading type hypothesis, an alternate type hypothesis, an instinct hypothesis, and confidence levels for each. Your synthesis must:
State the decisive factors — which specific passes and which specific data points drove the leading hypothesis
Name what the alternate hypothesis explains that the leading hypothesis does not — what genuine ambiguity remains
Note any unresolved tensions between passes — where the evidence points in different directions
State explicitly whether the final verdict confirms or overrides the raw slider ranking from Pass 0, and why
Set confidence level based on the dimensional evidence alone — not on Stage 3/4 outcomes
Your alternate_candidate must be the type with the second-highest dimensional confidence score from your analytical passes unless you can explicitly name a specific reason — grounded in the dimensional evidence — why a lower-ranked type is a stronger alternate. If you depart from the dimensional ranking for the alternate, state the reason in alternate_rationale. Do not override the dimensional ranking based on general Enneagram knowledge or training data.
Confidence calibration guidelines:
  HIGH — Within-type coherence is tight (spread ≤ 15), geometric neighborhood is elevated, instinct stack is clear (gap ≥ 20), open response language confirms the core motivation. All passes point in the same direction.
  MEDIUM_HIGH — Most passes confirm the leading type but 1–2 create tension. Dimensional coherence is good but not tight. Alternate hypothesis is present but clearly secondary.
  MEDIUM — The leading type is the best available hypothesis but the pattern is genuinely ambiguous. Passes disagree in meaningful ways. The alternate hypothesis has real evidential support.
  LOW — No type produces a clearly coherent pattern. Multiple types compete for the leading position with roughly equal support. Or: a counter-type pattern is suspected but the evidence is insufficient to confirm which type it's a counter-type of.`;

const _CONSTRAINTS = `CONSTRAINT 1 — No elimination before Pass 8. Do not eliminate any type from consideration during Passes 0–7. All 9 types remain live hypotheses. A type with a low mean that shows a counter-type fingerprint in Pass 2 must remain a live candidate through Pass 7.

CONSTRAINT 2 — Motivation over behavior. Type is determined by what a person is fundamentally driving toward, not how they behave. Two people can behave identically for different motivational reasons. When behavior and motivation appear to conflict in the data, weight motivation (Core Motivation and Avoidance scores) over behavioral expressions (Energy and Preoccupation scores).

CONSTRAINT 3 — Near-ties reproduce as near-ties. If the top two type candidates have similar evidential support after all 8 passes, report them as a genuine near-tie with MEDIUM confidence. Do not force a single verdict when the data genuinely supports two. The coaching debrief is the resolution point by design.

CONSTRAINT 4 — No fabrication. Every specific observation in dimensional_observations must be traceable to actual slider values or actual open response language. Do not invent observations. If a pattern is absent, do not report it as present.

CONSTRAINT 5 — JSON only. Your entire output must be a single valid JSON object. No preamble, no explanation, no markdown fences. The output will be parsed directly by server code.

CONSTRAINT 6 — Hypothesis language. Use language of hypothesis throughout: 'the pattern appears consistent with', 'this suggests', 'worth exploring in debrief', 'appears to indicate'. Never use language of certainty: 'this person is', 'definitively', 'clearly confirms'.`;

const _SCHEMA = `{
  "confirmed_type": <integer 1-9>,
  "confirmed_type_name": <string>,
  "confidence_level": <"HIGH" | "MEDIUM_HIGH" | "MEDIUM" | "LOW">,
  "confidence_rationale": <string — one sentence explaining the confidence level>,
  "leading_candidate": <integer 1-9>,
  "alternate_candidate": <integer 1-9>,
  "alternate_rationale": <string — one sentence on what makes alternate a live hypothesis>,
  "dominant_instinct_hypothesis": <"SP" | "SO" | "SX">,
  "em_instinct_confidence": <"HIGH" | "MEDIUM_HIGH" | "MEDIUM" | "LOW">,
  "ranking_override": <boolean — true if synthesis departs from raw slider mean ranking>,
  "em_ranking": [
    { "type": <1-9>, "score": <0-100> },
    ... exactly 9 entries, ordered by EM dimensional confidence score descending
  ],
  "counter_type_flag": {
    "flagged": <boolean>,
    "type": <integer 1-9 or null>,
    "instinct": <"SP" | "SO" | "SX" or null>,
    "rationale": <string describing the dimensional fingerprint, or null>
  },
  "geometric_neighborhood": {
    "active_wing": <integer — the wing type with the higher mean score>,
    "stress_echo_present": <boolean>,
    "stress_echo_note": <string — which dimension shows the echo, or null>,
    "security_echo_present": <boolean>,
    "security_echo_note": <string — which dimension shows the echo, or null>,
    "neighborhood_coherence": <"strong" | "moderate" | "weak">
  },
  "framework_signals": {
    "hornevian": <string — derived group and confidence>,
    "harmonic": <string — derived group and confidence>,
    "center": <string — derived center and confidence>,
    "stage2_alignment": <string — aligns / diverges / not available>
  },
  "instinct_analysis": {
    "stack_coherence": <string — broad / narrow / near-tie>,
    "dominant_mean": <number 0-100>,
    "secondary_mean": <number 0-100>,
    "tertiary_mean": <number 0-100>,
    "stack_gap": <number — dominant minus secondary mean>,
    "dominant_confidence": <"clear" | "moderate" | "near-tie">,
    "within_instinct_notes": <string or null>
  },
  "dimensional_observations": [
    <string>, ... array of specific pattern observations, each referencing
    actual statement IDs and scores. Minimum 3, maximum 8.
    Tag each with a prefix: [CONFIRMS], [NOTE], or [FLAG]
  ],
  "reasoning": <string — 2-3 paragraphs in plain English summarizing how
    the hypothesis was reached. Written for a coach, not a client.
    Use hypothesis language throughout.>,
  "meta": {
    "prompt_version": "EM-v1.1",
    "pass0_raw_ranking": [
      { "type": <1-9>, "mean": <0-100> },
      ... all 9 types, mean-descending
    ]
  }
}`;

const _HEADER = `You are analyzing an InsightOut assessment. Below you will find:
1. The full 45 type slider responses (raw 0-100 values with statement text)
2. The full 15 instinct slider responses (raw 0-100 values with statement text)
3. All client open responses

Work through the 8-pass analytical sequence specified in your system prompt.
Do not reference Stage 2 or Stage 3 data in your analysis — derive all
framework signals from the slider pattern independently.
Return your complete analysis as a single JSON object matching the output schema.`;


// ── Geometry table (generated from TYPE_GEOMETRY at module load — DRY, cannot drift
//    from stage1_labels.js, byte-stable so the cached system prompt stays stable). ──
function _geometryTableText() {
  const rows = ['Type | Name | Center | Hornevian | Harmonic | Stress | Security | Wings'];
  for (let t = 1; t <= 9; t++) {
    const g = TYPE_GEOMETRY[t];
    rows.push([t, g.name, g.center, g.hornevian, g.harmonic, g.stress, g.security, g.wings.join(' & ')].join(' | '));
  }
  return rows.join('\n');
}

// EM_SYSTEM_PROMPT — Part A (spec §2–§3 + §5.1 output schema). Fixed and cacheable;
// assembled once at module load. PR5 applies cache_control: ephemeral at call time.
const EM_SYSTEM_PROMPT = [
  _ROLE,
  'TYPE GEOMETRY REFERENCE TABLE\n' + _GEO_INTRO + '\n\n' + _geometryTableText(),
  'KNOWN COUNTER-TYPE COMBINATIONS\n' + _CT,
  'THE 8-PASS ANALYTICAL SEQUENCE\n' + _PASSES_INTRO + '\n' + _PASSES,
  'CRITICAL CONSTRAINTS\n' + _CONSTRAINTS,
  'OUTPUT SCHEMA\nReturn a single valid JSON object matching exactly this schema. No markdown, no preamble, no text outside the JSON object:\n' + _SCHEMA,
].join('\n\n');

// ── Part B helpers ──────────────────────────────────────────────────────────────

const _INSTINCT_NAMES = { SP: 'Self-Preservation', SO: 'Social', SX: 'Sexual / One-to-One' };

// Numeric slider value or null. Keeps 0 (a valid response); excludes null/undefined/
// non-number. Never substitutes a midpoint default (spec §6.1).
function _num(v) { return (typeof v === 'number' && !Number.isNaN(v)) ? v : null; }

// Mean of a type's 5 sliders over non-null values, or null if all are missing (§6.1).
function _typeMean(snapshot, typeNum) {
  const sliders = (snapshot && snapshot.stage1 && snapshot.stage1.typeSliders) || {};
  const vals = TYPE_STATEMENTS.filter((s) => s.type === typeNum).map((s) => _num(sliders[s.id]));
  const nn = vals.filter((v) => v !== null);
  return nn.length ? nn.reduce((a, b) => a + b, 0) / nn.length : null;
}

// Mean of an instinct's 5 sliders over non-null values, or null.
function _instinctMean(snapshot, instinct) {
  const sliders = (snapshot && snapshot.stage1 && snapshot.stage1.instinctSliders) || {};
  const vals = INSTINCT_STATEMENTS.filter((s) => s.instinct === instinct).map((s) => _num(sliders[s.id]));
  const nn = vals.filter((v) => v !== null);
  return nn.length ? nn.reduce((a, b) => a + b, 0) / nn.length : null;
}

function _meanLabel(m) { return m === null ? 'n/a' : m.toFixed(1); }            // §R5
function _fmtScore(v) { return v === null ? '(not answered)' : String(v); }     // §R5
function _openOrNone(v) {
  return (typeof v === 'string' && v.trim()) ? v.trim() : '[none provided]';    // empty-string opens → inline marker
}

// Block 1 — assessment header (spec §4.1, verbatim).
function _buildHeaderBlock() { return _HEADER; }

// Block 2 — 45 type sliders, Types 1→9, dimension order, with per-type mean (spec §4.2).
function _buildTypeBlock(snapshot) {
  const sliders = (snapshot && snapshot.stage1 && snapshot.stage1.typeSliders) || {};
  const out = [];
  for (let t = 1; t <= 9; t++) {
    const rows = TYPE_STATEMENTS.filter((s) => s.type === t);
    const name = rows[0].typeName;
    out.push('TYPE ' + t + ' — ' + name + ' (mean: ' + _meanLabel(_typeMean(snapshot, t)) + ')');
    for (const s of rows) {
      out.push('  ' + s.id + ' [' + s.dimension + ']  "' + s.text + '"  ->  ' + _fmtScore(_num(sliders[s.id])));
    }
  }
  return 'TYPE SLIDER DATA (45 statements, raw 0-100)\n' + out.join('\n');
}

// Block 3 — 15 instinct sliders, SP→SO→SX, with per-instinct mean (spec §4.3).
function _buildInstinctBlock(snapshot) {
  const sliders = (snapshot && snapshot.stage1 && snapshot.stage1.instinctSliders) || {};
  const out = [];
  for (const inst of ['SP', 'SO', 'SX']) {
    const rows = INSTINCT_STATEMENTS.filter((s) => s.instinct === inst);
    out.push('INSTINCT ' + inst + ' — ' + _INSTINCT_NAMES[inst] + ' (mean: ' + _meanLabel(_instinctMean(snapshot, inst)) + ')');
    for (const s of rows) {
      out.push('  ' + s.id + ' [' + s.subdomain + ']  "' + s.text + '"  ->  ' + _fmtScore(_num(sliders[s.id])));
    }
  }
  return 'INSTINCT SLIDER DATA (15 statements, raw 0-100)\n' + out.join('\n');
}

// Block 4 — open responses (spec §4.4). finalQuestion is read TOP-LEVEL
// (snapshot.finalQuestion) — the spec's "stage1.finalQuestion" is a doc error
// (confirmed R1; flag for prompt spec v1.1). D9: when finalQuestion is null, the
// Stage 4 section is omitted entirely — no header, no null placeholder.
function _buildOpenResponseBlock(snapshot) {
  const s0 = (snapshot && snapshot.stage0) || {};
  const s1 = (snapshot && snapshot.stage1) || {};
  const parts = [];
  parts.push(
    'STAGE 0 — SELF-DESCRIPTION\n' +
    'Q1 (self-description): "' + _openOrNone(s0.q1) + '"\n' +
    'Q2 (how others describe you): "' + _openOrNone(s0.q2) + '"\n' +
    'Q3 (greatest strength): "' + _openOrNone(s0.q3) + '"\n' +
    'Q4 (most problematic quality): "' + _openOrNone(s0.q4) + '"'
  );
  parts.push('STAGE 1 — TYPE OPEN RESPONSE\n"' + _openOrNone(s1.typeOpen) + '"');
  parts.push('STAGE 1 — INSTINCT OPEN RESPONSE\n"' + _openOrNone(s1.instinctOpen) + '"');
  const finalQ = snapshot ? snapshot.finalQuestion : null;   // top-level only (R1)
  if (typeof finalQ === 'string' && finalQ.trim()) {
    parts.push('STAGE 4 — FINAL REFLECTION\n"' + finalQ.trim() + '"');
  }
  return 'OPEN RESPONSES\n' + parts.join('\n\n');
}

// Build the full EM prompt for one assessment. Returns { system, user }.
// CONTRACT: responsesSnapshot is a PARSED object (PR5 owns fetch + JSON parsing; no
// defensive JSON.parse here, per R6).
function buildExperimentalPrompt(responsesSnapshot) {
  const user = [
    _buildHeaderBlock(),
    _buildTypeBlock(responsesSnapshot),
    _buildInstinctBlock(responsesSnapshot),
    _buildOpenResponseBlock(responsesSnapshot),
  ].join('\n\n');
  return { system: EM_SYSTEM_PROMPT, user };
}

// extractJSON — tolerate leading whitespace / an explanatory sentence / code fences
// around the JSON object (spec §6.2). Throws if no object is present; the retry-once-
// then-fail loop lives in runExperimentalAnalysis below.
function extractJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');
  return JSON.parse(text.slice(start, end + 1));
}

// ── EM execution layer ───────────────────────────────────────────────────────────

// The type with the highest raw slider mean (tie-break: lowest type number), used to
// server-verify ranking_override rather than trusting the model's self-report (§5.2).
function _highestRawMeanType(snapshot) {
  let best = null;
  let bestMean = -Infinity;
  for (let t = 1; t <= 9; t++) {
    const m = _typeMean(snapshot, t);
    if (m !== null && m > bestMean) { bestMean = m; best = t; }
  }
  return best;
}

// EM-vs-declared match status (design §7.2, decision C-a). Pending when there is no
// declared_type; Exact when type AND instinct match; partial otherwise; Mismatch when
// neither matches.
function computeMatchStatus(em, declared) {
  if (declared == null || declared.type == null) return 'Pending';
  const typeMatch = Number(em.type) === Number(declared.type);
  const instMatch = declared.instinct != null && em.instinct != null
    && String(em.instinct) === String(declared.instinct);
  if (typeMatch && instMatch) return 'Exact';
  if (typeMatch) return 'Type only';
  if (instMatch) return 'Instinct only';
  return 'Mismatch';
}

// Resolve the active analysis mode by the three-level hierarchy (design §6.2):
// per-assessment override → per-client override → global app_settings. First non-empty
// wins; defaults to 'sm_only'. Consumed by PR6's runBackgroundJob auto-fire; the manual
// route runs EM regardless of mode.
function resolveAnalysisMode({ assessment, client, appSettings } = {}) {
  const a = assessment && assessment.analysis_mode;
  if (a) return a;
  const c = client && client.analysis_mode;
  if (c) return c;
  const g = appSettings && appSettings.em_analysis_mode;
  return g || 'sm_only';
}

// Run one EM analysis for a completed assessment and persist it. Fully isolated: any
// failure resolves to { ok:false } and writes a failure row to em_reliability_log
// (em_type_* = null, error_message populated) — it never throws, so callers (the manual
// route now, runBackgroundJob in PR6) are insulated and SM is never affected.
//
// Dependencies are injected (no SDK, no db require in this module): `callClaude` is an
// async ({ model, max_tokens, system, user }) => { text, usage } adapter owned by the
// route (C-c); `db` is the app/db.js module.
//
// On EM failure, experimental_raw_analysis is left UNTOUCHED — null is the correct
// signal that no valid EM result exists (decision C-b); the reliability-log failure row
// is the sole failure record.
async function runExperimentalAnalysis({ assessmentId, model, trigger, callClaude, db } = {}) {
  const modelId = (model === EM_MODEL_OPUS || model === 'opus') ? EM_MODEL_OPUS : EM_MODEL_SONNET; // C-d default
  const isOpus = modelId === EM_MODEL_OPUS;

  // Mutable context populated as we go, so a failure row carries whatever we know.
  let clientId = null;
  let sm = { type: null, instinct: null, confidence: null };
  let declared = { type: null, instinct: null, confidence: null };

  const emCols = (type, instinct, confidence) => isOpus
    ? { em_type_opus: type, em_instinct_opus: instinct, em_confidence_opus: confidence }
    : { em_type_sonnet: type, em_instinct_sonnet: instinct, em_confidence_sonnet: confidence };

  const logFailure = async (errMsg) => {
    try {
      await db.insertEmReliabilityLog({
        assessment_id: assessmentId,
        client_id: clientId,
        sm_type: sm.type, sm_instinct: sm.instinct, sm_confidence: sm.confidence,
        ...emCols(null, null, null),
        declared_type: declared.type, declared_instinct: declared.instinct,
        declaration_confidence: declared.confidence,
        match_status: null,
        prompt_version: PROMPT_VERSION,
        model_version: modelId,
        full_em_result: null,
        error_message: errMsg,
      });
    } catch (e) { /* never let logging failure escape */ }
    return { ok: false, error: errMsg };
  };

  try {
    // 1. Assessment → client.
    const assessment = await db.getAssessmentById(assessmentId);
    if (!assessment) return logFailure('Assessment not found');
    clientId = assessment.client_id;

    // SM verdict for the reliability log (api_result is JSONB → object; parse defensively).
    let apiResult = assessment.api_result;
    if (typeof apiResult === 'string') { try { apiResult = JSON.parse(apiResult); } catch (e) { apiResult = null; } }
    const h = (apiResult && apiResult.hypothesis) || {};
    sm = {
      type: h.confirmed_type ?? null,
      instinct: h.dominant_instinct_hypothesis ?? null,
      confidence: h.confidence_level ?? null,
    };

    // 2. responses_snapshot now lives on the assessment (A1); fall back to the deprecated
    //    clients column for pre-migration rows. (pg returns JSONB as an object.)
    let snapshot = assessment.responses_snapshot;
    if (!snapshot) {
      const client = await db.getClientById(clientId);
      snapshot = client && client.responses_snapshot;
    }
    if (!snapshot) return logFailure('No responses_snapshot for this assessment');

    // 3. Staleness — warn, never block (design §5.1).
    const latestId = await db.getLatestAssessmentId(clientId);
    const isLatest = latestId === assessmentId;

    // Declared ground truth (may be absent).
    const bf = await db.getBetaFeedback(assessmentId);
    declared = {
      type: bf ? (bf.declared_type ?? null) : null,
      instinct: bf ? (bf.declared_instinct ?? null) : null,
      confidence: bf ? (bf.declaration_confidence ?? null) : null,
    };

    // 4. Build the prompt and 5. call with one retry on parse/API failure (§6.2).
    const { system, user } = buildExperimentalPrompt(snapshot);
    let parsed = null;
    let usage = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const resp = await callClaude({ model: modelId, max_tokens: EM_MAX_TOKENS, system, user });
        parsed = extractJSON(resp && resp.text != null ? resp.text : '');
        usage = (resp && resp.usage) || null;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!parsed) return logFailure('EM call/parse failed: ' + (lastErr && lastErr.message));

    // 6. Server-side verification stamps (§5.2).
    const lead = Number(parsed.leading_candidate);
    if (Number.isInteger(lead) && lead >= 1 && lead <= 9) {
      // v1.1 invariant: confirmed_type must equal leading_candidate.
      parsed.confirmed_type = lead;
      parsed.confirmed_type_name = (TYPE_GEOMETRY[lead] && TYPE_GEOMETRY[lead].name) || parsed.confirmed_type_name;
    }
    const rawTop = _highestRawMeanType(snapshot);
    parsed.ranking_override = (rawTop != null) && (Number(parsed.confirmed_type) !== rawTop);

    parsed.meta = parsed.meta || {};
    parsed.meta.prompt_version = PROMPT_VERSION;
    parsed.meta.model = modelId;
    parsed.meta.generated_at = new Date().toISOString();          // C-e: server-side at persist time
    // Total input = uncached + cache-creation + cache-read. With the system prompt
    // cached (cache_control: ephemeral), usage.input_tokens is only the uncached
    // remainder (e.g. 3 on a cache hit), so sum all three to reflect the true input
    // footprint. Cache fields are 0 when caching is inactive, so the sum is correct
    // either way — and robust whether the first attempt or the retry supplied usage
    // (cache_read on a retry ≈ cache_creation on the first call: same prefix size).
    parsed.meta.input_tokens = usage
      ? ((usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0))
      : null;
    parsed.meta.output_tokens = usage ? (usage.output_tokens ?? null) : null;
    // Preserve the cache breakdown for cost analysis (matches the D6/PR2 usage shape).
    parsed.meta.cache_creation_input_tokens = usage ? (usage.cache_creation_input_tokens ?? null) : null;
    parsed.meta.cache_read_input_tokens = usage ? (usage.cache_read_input_tokens ?? null) : null;
    parsed.meta.source_assessment_is_latest = isLatest;
    parsed.meta.latest_assessment_id = latestId;
    parsed.meta.trigger = trigger || null;

    const matchStatus = computeMatchStatus(
      { type: parsed.confirmed_type, instinct: parsed.dominant_instinct_hypothesis },
      declared
    );

    // 7. Persist: EM result on the assessment, plus a reliability-log row.
    await db.saveEmResult(assessmentId, parsed);
    await db.insertEmReliabilityLog({
      assessment_id: assessmentId,
      client_id: clientId,
      sm_type: sm.type, sm_instinct: sm.instinct, sm_confidence: sm.confidence,
      ...emCols(parsed.confirmed_type ?? null, parsed.dominant_instinct_hypothesis ?? null, parsed.confidence_level ?? null),
      declared_type: declared.type, declared_instinct: declared.instinct,
      declaration_confidence: declared.confidence,
      match_status: matchStatus,
      prompt_version: PROMPT_VERSION,
      model_version: modelId,
      full_em_result: parsed,
      error_message: null,
    });

    return {
      ok: true,
      result: parsed,
      match_status: matchStatus,
      source_assessment_is_latest: isLatest,
      latest_assessment_id: latestId,
      stale_snapshot_warning: isLatest ? null
        : 'responses_snapshot reflects the client\'s latest assessment (#' + latestId + '), not #' + assessmentId + '.',
    };
  } catch (e) {
    return logFailure('EM run error: ' + (e && e.message));
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// EM REPORT CALL (PR8b) — the second call in the B1 two-call EM-primary architecture.
// Governed by docs/hive_insightout_em_report_prompt_spec_v1_0.docx. Takes the EM
// Analysis output + open responses and authors the prose registers the renderer needs.
// CONFIDENTIAL — server-side only. extractJSON() reused; callClaude/db injected (no SDK).
// ════════════════════════════════════════════════════════════════════════════════

const EM_REPORT_PROMPT_VERSION = 'EM-Report-v1.1';
const EM_REPORT_MAX_TOKENS = 8000;

// Part A — system prompt (fixed, cacheable). Verbatim from report-prompt spec §2–§5.
const EM_REPORT_SYSTEM_PROMPT = `You are an expert Enneagram coach writing personalized reports for clients who have completed the InsightOut assessment. You have been given a structured analysis of this client's assessment data. Your job is to translate that analysis into two report registers: a coach report (for the coach preparing the debrief) and a client report (for the client to read after the debrief).

You write in warm, direct, plain-English. You never use clinical or academic language. You never mention the Narrative Enneagram or any proprietary framework by name. You never reference scores, sliders, dimensional analysis, passes, or any engine mechanics. You write as if you are a skilled practitioner who has studied this person's responses and formed a clear hypothesis.

All typing is hypothesis-driven. The report prepares the coach for the debrief — it does not label the client. Use language of hypothesis throughout: 'appears to,' 'consistent with,' 'worth exploring,' 'the pattern suggests.' Never write 'this person is a Type X' — write 'the pattern appears consistent with Type X.'

The coach report is written for a trained Enneagram practitioner. Use Enneagram-literate language in the coach report: type names, instinct names, subtype names, stress and security point references. The client report is written for someone who may be encountering this material for the first time. Use plain language, avoid jargon, and explain concepts briefly where necessary.

The container is fixed. Every page of the report renders in a fixed pixel container. Content that is too long will break the layout. Observe every word count and line count constraint in this specification precisely.

CROSS-CUTTING CONTENT RULES (non-negotiable, apply to every generated field):
- Warm, direct, plain-English. No clinical tone. Never use 'Narrative' or 'Narrative Enneagram' anywhere.
- Hypothesis language throughout. Use 'appears to,' 'consistent with,' 'worth exploring,' 'the pattern suggests.' Never 'is,' 'definitively,' 'confirms,' 'proves.'
- The alternate type is fixed and provided to you as alternate_candidate_name in the context header. Every reference to the alternate type throughout ALL prose fields — bottom_line, what_responses_revealed, alternate_callout, key_discriminator, client_words, debrief sections, and client_facing fields — must refer to this specific alternate type and no other. Do not substitute a different type as the foil even if your analysis suggests another type is interesting. The alternate is determined by the analysis — your job is to author prose about the pair you were given.
- No engine or mechanics language. No mention of sliders, scores, dimensions, passes, coherence, rankings, or dimensional analysis in any prose field.
- Ground prose in what the client actually said. Quote or closely paraphrase their open response language wherever it illuminates the hypothesis. Never fabricate quotes — use only language that appears in the responses provided.
- Bold only the 2–3 most important bullets per section. Within a bolded bullet, bold the opening claim, not the elaboration. The bold falls early in the bullet.
- Powerful questions: under 15 words, open (never yes/no), one concept per question, invites reflection on lived experience, no jargon.
- The container is fixed. Observe every word/line constraint precisely. Content that exceeds the constraint will break the layout.

You have access to the dimensional analysis — use it to inform your prose, but never reference it explicitly. Write as if you are a skilled Enneagram coach summarizing what you observed, not as an AI reporting what scores showed.

COACH REPORT FIELDS:
- bottom_line: 1 paragraph, 3–4 sentences, 90 words maximum. Names the leading type, subtype, and confidence in plain language; what made the pattern clear; the alternate hypothesis and what distinguishes it; a forward-looking framing for the debrief.
- what_responses_revealed: 4–6 bullets, each ≤ ~27 words, ≤ 80 words total. Bold the opening claim of 2–3 bullets. One bullet must name the alternate hypothesis and motivational distinction; one must address the instinct; at least one must quote or closely paraphrase the client's own language.
- alternate_callout: ~3 lines (~40–50 words). Why the alternate surfaced, what in the client's data lifted it, the motivational distinction between leading and alternate, framed as worth exploring (not a competing verdict).
- key_discriminator: MAXIMUM 1 sentence per column, 25 words per column. This field renders in a fixed two-column table cell on Page 2. Content exceeding 1 sentence per side will overflow and create a blank page. Write the single sharpest motivational distinction — nothing more.
- client_words: { leading_quotes (1–2 verbatim strings, never edited), alternate_absence_note (1 sentence on why the alternate-type language is absent/minimal, informative not dismissive) }.
- debrief.subtype: { question (powerful question ≤ 15 words), bullets (≤ 6, each ≤ 3 lines, ≤ 9 lines total, bold 2–3) }. Cover counter-type/lookalike notes first if flagged, sequencing advice, and one client-specific foothold from their actual language.
- debrief.stress_release: { question, bullets } same budget. What the stress point looks like for THIS client (behavioral + motivational, not generic), what the security point offers, coaching angle, an early-warning signal. Reference the client's language where present.
- debrief.wings: { question, bullets } same budget. Cover both wings; let behavioral description carry which is more active — do NOT label a wing 'dominant' or 'active' in prose. Coaching advice and a foothold if available.
- confidence_summary: one sentence, 25 words maximum, coach-register, plain English. Summarizes why the leading type returned the confidence level it did. No scores, no engine mechanics, no type numbers in isolation. Example: "Type 7 returned high confidence across all motivational dimensions with no competing alternate signal."
- near_tie_callout: { framing_note, discriminating_questions }. framing_note is 1–2 sentences, coach-register, warm but direct, directing the coach to treat the debrief as the primary resolution instrument for this near-tie result. discriminating_questions is an array of exactly 3 questions specific to the tension between THIS leading type and THIS alternate type — not generic Enneagram questions. Generate them from the leading and alternate type hypotheses you are authoring for.
- IMPORTANT — confidence box: author BOTH confidence_summary AND near_tie_callout on every run. The server decides (from data you never see) which one is displayed. You do not see scores and you never determine which state applies — always produce both, fully.

CLIENT REPORT FIELDS (written for the client, plain language, warm, hypothesis-framed):
- client_narrative: 3–4 sentences. Names the leading type and what the pattern pointed to; what the type is about in the client's terms; invites them into the exploration.
- core_motivation_evidence: 2–3 sentences. How the client's own responses confirmed the core motivation; references their actual language; written so they recognize themselves.
- instinct_personal_overlay: 2–3 sentences. How the dominant instinct shapes this client's particular expression; references their instinct/Stage 4 language; if the stack was a near-tie, name the ambiguity briefly.
- secondary_type_narrative: 2–3 sentences. Names the alternate type in plain language; what makes it worth exploring; framed as a question for the debrief, not a competing verdict.
- stress_security_narratives: { stress, security } — 2–3 sentences each. What the stress point looks like for this client in plain behavioral language; what becomes available when resourced. If no echo is present, write the generic type-level description. Never alarming or pathologizing.
- what_to_explore: exactly 3 questions, each ≤ 15 words, open, one concept each, no jargon. Cover (1) core motivation, (2) instinct/subtype, (3) the alternate type or genuine ambiguity.

OUTPUT: return a single valid JSON object exactly matching this schema. No markdown, no preamble, no trailing text. Field names must match exactly.
{
  "coach_report": {
    "bottom_line": <string — 1 paragraph, 3–4 sentences, 90 words maximum>,
    "what_responses_revealed": [ { "bold": <boolean>, "bold_lead": <string or null>, "body": <string> }, ... 4-6 ],
    "alternate_callout": <string>,
    "confidence_summary": <string — one sentence, 25 words maximum, coach-register summary of leading type confidence. No scores. No engine mechanics.>,
    "near_tie_callout": {
      "framing_note": <string — 1-2 sentences directing the coach to treat the debrief as the primary resolution instrument for this near-tie result. Coach-register, warm but direct.>,
      "discriminating_questions": [ <string>, <string>, <string> ]
    },
    "key_discriminator": { "leading": <string>, "alternate": <string> },
    "client_words": { "leading_quotes": [<string>, ...], "alternate_absence_note": <string> },
    "debrief": {
      "subtype": { "question": <string>, "bullets": [ { "bold": <boolean>, "text": <string> }, ... up to 6 ] },
      "stress_release": { "question": <string>, "bullets": [ { "bold": <boolean>, "text": <string> }, ... up to 6 ] },
      "wings": { "question": <string>, "bullets": [ { "bold": <boolean>, "text": <string> }, ... up to 6 ] }
    }
  },
  "client_facing": {
    "client_narrative": <string>,
    "core_motivation_evidence": <string>,
    "instinct_personal_overlay": <string>,
    "secondary_type_narrative": <string>,
    "stress_security_narratives": { "stress": <string>, "security": <string> },
    "what_to_explore": [<string>, <string>, <string>]
  },
  "client_words": { "leading_quotes": [<string>, ...], "alternate_absence_note": <string> },
  "meta": { "prompt_version": "EM-Report-v1.0", "confirmed_type": <integer 1-9>, "dominant_instinct_hypothesis": <"SP" | "SO" | "SX"> }
}`;

// Part B — user prompt (dynamic, per assessment). Three blocks (report spec §6).
function buildEmReportUserPrompt(emAnalysis, snapshot, ctx) {
  const a = emAnalysis || {};
  const c = ctx || {};
  const s1 = (snapshot && snapshot.stage1) || {};
  const s0 = (snapshot && snapshot.stage0) || {};
  const ia = a.instinct_analysis || {};
  const gn = a.geometric_neighborhood || {};
  const fs = a.framework_signals || {};
  const ctf = a.counter_type_flag || {};

  // Block 1 — context header.
  const block1 = [
    'You are writing InsightOut reports for the following client assessment.',
    '',
    `CLIENT: ${c.client_first_name || ''} ${c.client_last_name || ''}`.trim(),
    `LEADING TYPE HYPOTHESIS: Type ${a.confirmed_type} — ${c.confirmed_type_name || ''}`,
    `SUBTYPE: ${a.dominant_instinct_hypothesis} Subtype — ${c.subtype_name || ''}`,
    `CONFIDENCE: ${a.confidence_level || ''}`,
    `ALTERNATE TYPE HYPOTHESIS: Type ${a.alternate_candidate} — ${c.alternate_candidate_name || ''}`,
    '',
    'Write all coach report prose for a trained Enneagram practitioner.',
    'Write all client report prose for the client directly — warm, plain-English, hypothesis-framed.',
    'Observe all word count and line count constraints precisely.',
    'Return a single valid JSON object matching the output schema.',
  ].join('\n');

  // Block 2 — EM analysis object.
  const obs = Array.isArray(a.dimensional_observations) ? a.dimensional_observations.map((o) => '  ' + o).join('\n') : '';
  const block2 = [
    'EM ANALYSIS OUTPUT',
    '==================',
    `Confirmed type: ${a.confirmed_type} — ${c.confirmed_type_name || ''}`,
    `Confidence: ${a.confidence_level || ''}`,
    `Confidence rationale: ${a.confidence_rationale || ''}`,
    '',
    `Alternate type: ${a.alternate_candidate} — ${c.alternate_candidate_name || ''}`,
    `Alternate rationale: ${a.alternate_rationale || ''}`,
    '',
    `Dominant instinct: ${a.dominant_instinct_hypothesis} (${a.em_instinct_confidence || ''} confidence)`,
    `Instinct stack: ${ia.stack_coherence || ''}`,
    `  Dominant mean: ${ia.dominant_mean ?? ''}  Secondary mean: ${ia.secondary_mean ?? ''}  Tertiary mean: ${ia.tertiary_mean ?? ''}`,
    `  Stack gap: ${ia.stack_gap ?? ''}  Dominant confidence: ${ia.dominant_confidence || ''}`,
    `  Notes: ${ia.within_instinct_notes || ''}`,
    '',
    `Counter-type flag: ${ctf.flagged ? 'YES' : 'no'} — ${ctf.rationale || ''}`,
    '',
    'Geometric neighborhood:',
    `  Dominant wing: Type ${gn.active_wing ?? ''}`,
    `  Stress echo present: ${gn.stress_echo_present ? 'yes' : 'no'} — ${gn.stress_echo_note || ''}`,
    `  Security echo present: ${gn.security_echo_present ? 'yes' : 'no'} — ${gn.security_echo_note || ''}`,
    `  Neighborhood coherence: ${gn.neighborhood_coherence || ''}`,
    '',
    'Framework signals:',
    `  Hornevian: ${fs.hornevian || ''}`,
    `  Harmonic: ${fs.harmonic || ''}`,
    `  Center: ${fs.center || ''}`,
    '',
    'Dimensional observations:',
    obs,
    '',
    'Reasoning:',
    a.reasoning || '',
  ].join('\n');

  // Block 3 — client open responses (omit null/empty; Stage 4 only if non-null — top-level finalQuestion).
  const lines = ['CLIENT OPEN RESPONSES', '====================='];
  lines.push('Stage 0 — Self description:');
  lines.push(`Q1 (self): "${s0.q1 || ''}"`);
  lines.push(`Q2 (how others see you): "${s0.q2 || ''}"`);
  lines.push(`Q3 (greatest strength): "${s0.q3 || ''}"`);
  lines.push(`Q4 (most challenging quality): "${s0.q4 || ''}"`);
  if (s1.typeOpen) { lines.push('', 'Stage 1 — Type open response:', `"${s1.typeOpen}"`); }
  if (s1.instinctOpen) { lines.push('', 'Stage 1 — Instinct open response:', `"${s1.instinctOpen}"`); }
  if (snapshot && snapshot.finalQuestion) { lines.push('', 'Stage 4 — Final reflection:', `"${snapshot.finalQuestion}"`); }
  const block3 = lines.join('\n');

  return [block1, '', block2, '', block3].join('\n');
}

// runEmReportCall — assembles Part B, calls Claude (Opus by default — report is
// client-facing, C5), parses with one retry. Never throws: returns {ok:false,error}
// so runBackgroundJob can fall back to SM's Call #2 (C1). callClaude({model,max_tokens,
// system,user}) => {text, usage} is injected by the route, same as the analysis call.
async function runEmReportCall({ emAnalysis, responsesSnapshot, contextFields, callClaude, db, model } = {}) {
  const modelId = model || EM_MODEL_OPUS;
  const system = EM_REPORT_SYSTEM_PROMPT;
  const user = buildEmReportUserPrompt(emAnalysis, responsesSnapshot, contextFields);

  let parsed = null;
  let usage = null;
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await callClaude({ model: modelId, max_tokens: EM_REPORT_MAX_TOKENS, system, user });
      parsed = extractJSON(resp && resp.text != null ? resp.text : '');
      usage = (resp && resp.usage) || null;
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!parsed) {
    return { ok: false, error: 'EM report call/parse failed: ' + (lastErr && lastErr.message), model: modelId };
  }

  parsed.meta = parsed.meta || {};
  parsed.meta.prompt_version = EM_REPORT_PROMPT_VERSION;
  parsed.meta.model = modelId;
  // Total input = uncached + cache-creation + cache-read (same rationale as the analysis call).
  parsed.meta._usage = usage ? {
    input_tokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    output_tokens: usage.output_tokens ?? null,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? null,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? null,
  } : null;

  return { ok: true, result: parsed, model: modelId };
}

module.exports = {
  EM_SYSTEM_PROMPT,
  buildExperimentalPrompt,
  extractJSON,
  runExperimentalAnalysis,
  resolveAnalysisMode,
  computeMatchStatus,
  PROMPT_VERSION,
  EM_MAX_TOKENS,
  EM_MODEL_SONNET,
  EM_MODEL_OPUS,
  // EM Report Call (PR8b)
  EM_REPORT_SYSTEM_PROMPT,
  buildEmReportUserPrompt,
  runEmReportCall,
  EM_REPORT_PROMPT_VERSION,
  EM_REPORT_MAX_TOKENS,
};
