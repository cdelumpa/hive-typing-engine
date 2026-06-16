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
//   R3 — Stage 2 data is intentionally NOT included in the prompt in v1.0 (design
//        §2.1); the model emits framework_signals.stage2_alignment = "not available".
'use strict';

const { TYPE_STATEMENTS, INSTINCT_STATEMENTS, TYPE_GEOMETRY } = require('./stage1_labels');

// ── Config (prompt spec §1) ──────────────────────────────────────────────────────
const PROMPT_VERSION = 'EM-v1.0';
const EM_MAX_TOKENS = 3000;
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
Pass 5 — Framework derivation
From the slider pattern alone — without referencing any Stage 2 self-report answers — derive the following signals:
Hornevian group: which triad's types dominate the top 4 scores? (Dutiful: 1/2/6 · Withdrawn: 3/4/5/7 · Assertive: 3/7/8 — note Type 3 appears in both Withdrawn and Assertive; use the dimensional pattern to discriminate)
Harmonic group: do the top types cluster in Competency (1/3/5), Positive Outlook (2/7/9), or Reactive (4/6/8)?
Center: do Core Motivation and Energy scores cluster in Body types (8/9/1), Heart types (2/3/4), or Head types (5/6/7)?
Stress/security echo: for the leading candidate, are its stress and security point types present with elevated scores on theoretically expected dimensions?
If Stage 2 self-report answers are available in the data package (Hornevian, Harmonic, Centers), note whether the slider-derived signals align with or diverge from the self-report. Divergence is diagnostically interesting — name it.
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
    "prompt_version": "EM-v1.0",
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
// around the JSON object (spec §6.2). Throws if no object is present; PR5 owns the
// retry-once-then-fail loop.
function extractJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');
  return JSON.parse(text.slice(start, end + 1));
}

module.exports = {
  EM_SYSTEM_PROMPT,
  buildExperimentalPrompt,
  extractJSON,
  PROMPT_VERSION,
  EM_MAX_TOKENS,
  EM_MODEL_SONNET,
  EM_MODEL_OPUS,
};
