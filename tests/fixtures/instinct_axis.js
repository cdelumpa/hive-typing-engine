'use strict';
/**
 * PR 4 step 2 — the instinct and Z6 fixture axes.
 *
 * Shared by scripts/render_client.js (which renders the instinct axis) and
 * tests/instinct_axis_test.js (which asserts the model-level facts). One definition, so the
 * harness and the test cannot drift apart.
 *
 * A .js and not a .json, which departs from the rest of tests/fixtures/. Two reasons, both
 * load-bearing: this file has to CARRY COMMENTS (the over-spec labelling below is a
 * correctness note, not decoration), and it DERIVES the EM value from sp4_api_result.json
 * rather than duplicating 777 characters that would then need keeping in step.
 *
 * ── WHAT THIS AXIS CAN AND CANNOT PROVE AT STEP 2 ──────────────────────────────────────
 * Measured on main @ feb5e4f, by rendering the v3 document under every value below and
 * byte-diffing (docs/audit_pr4_step2_fixture_axis.md §2a):
 *
 *   - dominant_instinct_hypothesis changes ONE line of 965, on the Contents page, via
 *     display.subtype_label -> {subtype_label}.
 *   - instinct_score_profile changes NOTHING RENDERED. exact_tie and missing_profile both
 *     render byte-identical to baseline even though model.instinct_stack[0] flips SX -> SP.
 *   - ALL FOUR Z6 STATES RENDER BYTE-IDENTICAL, including a 777-character paragraph,
 *     because instinct_evidence has no v3 consumer: its only renderer is live v2 p6
 *     (app/renderer.js:2251), and p10 does not exist yet.
 *
 * So the Z6 states here are asserted AT THE MODEL LEVEL only. That proves the override
 * reaches the model, that report_prep.js:371's `?? null` behaves, that validateModel passes
 * in every state, and that a 777-char single-element array throws nowhere in the prep path.
 * It proves NOTHING about rendering, height, fit, page spill, or the reconciliation of the
 * two producer shapes. Do not read a green run here as "Z6 works".
 */

const sp4 = require('./sp4_api_result.json');

// ── The instinct axis ─────────────────────────────────────────────────────────────────
//
// Each case overrides instinct_score_profile AND dominant_instinct_hypothesis TOGETHER.
// That is necessary, not stylistic. Nothing in the codebase reconciles the two — the
// profile feeds instinctBars/instinctStack (report_prep.js:65,73) and the dominant selects
// the subtype row and label (report_prep.js:213,219), and no read site checks them against
// each other. Override only one and the fixture itself becomes an instance of that
// contradiction: a report naming the SP subtype while badging SO as Leading.
//
// The three profiles are permutations of anders_sx9's own {66, 64, 84}, which is what makes
// sx_primary the existing baseline for free — applying it explicitly is a no-op, verified
// byte-identical. It also means ALL THREE carry the same 2-point second/third gap, i.e.
// every profile in this set is a near-tie. A clearly-separated profile ({90,50,10} or
// similar) is wanted at STEP 4, where badges render and a 2-point gap and a 40-point gap
// finally look different. It buys nothing at step 2, where all three render identically.
const INSTINCT_PROFILES = {
  sp_primary: { profile: { SP: 84, SO: 66, SX: 64 }, dominant: 'SP', label: 'Self-Preservation Nine' },
  so_primary: { profile: { SP: 64, SO: 84, SX: 66 }, dominant: 'SO', label: 'Social Nine' },
  sx_primary: { profile: { SP: 66, SO: 64, SX: 84 }, dominant: 'SX', label: 'One-to-One Nine' },
};

// The markup each label produces once _v3NoBreak has run (app/renderer.js:3176). Hyphenated
// compounds of 24 characters or fewer are wrapped in a nowrap span, so the three instinct
// labels are three different MARKUP shapes and not merely three strings — which is the only
// rendered difference the instinct axis produces on main today, and the reason two extra
// renders are enough to cover it.
const INSTINCT_MARKUP = {
  sp_primary: '<span class="v3-nb">Self-Preservation</span> Nine',
  so_primary: 'Social Nine',                                        // not hyphenated: NO span
  sx_primary: '<span class="v3-nb">One-to-One</span> Nine',
};

// Applied to a re-typed api_result clone. Returns a new object; never mutates its argument.
function applyInstinct(apiResult, key) {
  const c = INSTINCT_PROFILES[key];
  if (!c) throw new Error(`unknown instinct profile "${key}"`);
  const out = JSON.parse(JSON.stringify(apiResult));
  out.hypothesis.instinct_score_profile = { ...c.profile };
  out.hypothesis.dominant_instinct_hypothesis = c.dominant;
  return out;
}

// ── Instinct-stack edge cases ─────────────────────────────────────────────────────────
//
// ONE assertion, two inputs. An exact three-way tie and a missing profile produce the same
// result for the same reason: instinctStack (report_prep.js:65) sorts a literal declared
// ['SP','SO','SX'] and Array.prototype.sort has been stability-guaranteed since ES2019, so
// both fall through to DECLARATION ORDER and yield Leading = SP.
//
// That is today's behaviour, asserted as today's behaviour — it is NOT a decision anyone
// made, and a missing profile producing a confident "Leading = SP" is a defect tracked on
// its own card. Whoever fixes it changes this assertion in the same commit. This repo has
// no deliberately-red-later test convention and does not acquire one here; the convention
// followed is tests/timing_test.js's — assert what happens, carry the why in the message.
const STACK_EDGE_CASES = {
  exact_tie:       { profile: { SP: 70, SO: 70, SX: 70 } },
  missing_profile: { profile: undefined },   // the key is deleted, not set to undefined
};

// ── The Z6 axis ───────────────────────────────────────────────────────────────────────

// ⚠ DELIBERATELY OVER-SPEC, AND A COPY.
//
// Copied from CMS_PREVIEW_WORST_EVIDENCE (app/server.js:13823) because server.js exports
// nothing and requiring it would boot the application. instinct_axis_test.js asserts these
// three strings still appear in server.js, so the copy is self-policing rather than a
// silent duplicate.
//
// These bullets run 185/193/190 chars = 27/29/28 WORDS against the producer's own contract
// of "exactly 3 short bullets, ≤25 words each" (app/server.js:4828, asserted by
// scripts/verify_phase1_fields.js:20) — and against the constant's own comment, which says
// "~25 words each". Total 568 chars; a spec-conformant worst (3 x 25 words) is ~450.
//
// As a fixture that over-stress is a feature. As a BUDGET SOURCE it is not: a budget derived
// from these numbers is a budget for a shape the producer cannot legally emit. Whoever
// measures Z6 at step 3 should read this note before deriving anything from 568.
// Correcting the constant's own stale comment is a server.js change and its own card.
const SM_BULLETS_OVER_SPEC = [
  'Across several of your responses you returned to maintaining comfort, protecting your energy, and keeping daily life steady and predictable, which is the clearest available signal here.',
  'You repeatedly described scanning your environment for what could go wrong and quietly securing resources ahead of time, a pattern that points strongly toward this instinctual focus showing up.',
  'When asked about stress you emphasized withdrawing to conserve, tending to practical needs first, and restoring your baseline before re-engaging with the people and demands around you again.',
];

// The EM shape, verbatim from sp4_api_result.json's instinct_personal_overlay — 777 chars,
// 122 words, 5 sentences, 3 paragraphs. Derived, not copied, so it cannot drift.
//
// Two things a later reader needs. FIRST, this is the field em_report_adapter.js:143 maps
// into instinct_evidence, wrapped by _toEvidenceArray as a ONE-ELEMENT array — which is why
// it appears here as [string] and not as a string. SECOND, scripts/render_client.js NEVER
// CALLS em_report_adapter.js: the client_v3 job goes straight to buildClientModel. So this
// is a hand-made post-adapter artifact and it does NOT exercise the EM pipeline. It tests
// the prep path's tolerance of a shape that pipeline can produce.
//
// It is also Type 4 SP prose. That has no force at step 2, because nothing renders it. From
// STEP 3 it does: the probe's own output would carry Type 4 SP prose under a Type 9 SX
// heading, so step 3 should run sp4 as its own fixture rather than transplanting its text.
const EM_PARAGRAPH = [sp4.client_facing.instinct_personal_overlay];

// The four states. `null` and `absent` are listed separately and asserted to CONVERGE:
// report_prep.js:371 is `cf.instinct_evidence ?? null`, and `??` maps undefined and null to
// the same model value, so they are one model state reached two ways — not two states.
// anders_sx9 ships with client_facing: {}, so `absent` is the current baseline.
const Z6_STATES = {
  sm_bullets:   { evidence: SM_BULLETS_OVER_SPEC, expect: SM_BULLETS_OVER_SPEC },
  em_paragraph: { evidence: EM_PARAGRAPH,         expect: EM_PARAGRAPH },
  null:         { evidence: null,                 expect: null },
  absent:       { evidence: undefined,            expect: null },   // client_facing: {}
};

// Applied to an api_result clone. `absent` deletes the key rather than setting undefined,
// so the fixture genuinely reproduces client_facing: {}.
function applyZ6(apiResult, key) {
  const s = Z6_STATES[key];
  if (!s) throw new Error(`unknown Z6 state "${key}"`);
  const out = JSON.parse(JSON.stringify(apiResult));
  out.client_facing = out.client_facing || {};
  if (s.evidence === undefined) delete out.client_facing.instinct_evidence;
  else out.client_facing.instinct_evidence = s.evidence;
  return out;
}

module.exports = {
  INSTINCT_PROFILES, INSTINCT_MARKUP, applyInstinct,
  STACK_EDGE_CASES, SM_BULLETS_OVER_SPEC, EM_PARAGRAPH, Z6_STATES, applyZ6,
};
