'use strict';
/**
 * PR 4 step 2 — model-level assertions for the instinct and Z6 fixture axes.
 *
 * ── WHAT THIS FILE PROVES, AND WHAT A GREEN RUN HERE DOES NOT MEAN ────────────────────
 *
 * It proves the fixture overrides reach the built model intact: that the profile drives
 * instinct_stack and charts.instincts, that report_prep.js:371's `?? null` maps an absent
 * and an explicit-null instinct_evidence to the same model state, that validateModel passes
 * in all four Z6 states, and that a 777-character single-element array throws nowhere in
 * the prep path.
 *
 * IT PROVES NOTHING ABOUT RENDERING. instinct_evidence has no v3 consumer — its only
 * renderer is live v2 p6 (app/renderer.js:2251) and p10 does not exist. Measured on main @
 * feb5e4f, all four Z6 states render byte-identical, including the 777-char paragraph, and
 * instinct_score_profile changes nothing rendered at all. These are model assertions
 * because a rendered assertion is not available, not because it is the stronger choice.
 * Do not read a green run here as "Z6 works". See docs/audit_pr4_step2_fixture_axis.md §2.
 *
 * The rendered half of the axis — the three Contents markup shapes — is asserted in
 * scripts/render_client.js, which is where an actual browser render happens.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const base = require(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json'));
const {
  INSTINCT_PROFILES, applyInstinct, STACK_EDGE_CASES,
  SM_BULLETS_OVER_SPEC, EM_PARAGRAPH, Z6_STATES, applyZ6,
} = require(path.join(ROOT, 'tests/fixtures/instinct_axis.js'));

const CLIENT = { first_name: 'Anders', full_name: 'Anders Lindqvist', date: '6 September 2026' };
const build = (apiResult) => prep.buildClientModel({ apiResult, client: CLIENT, coach: {} });
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── The instinct axis ─────────────────────────────────────────────────────────────────

test('instinct axis: each profile yields the expected stack and bar ordering', async () => {
  for (const [key, c] of Object.entries(INSTINCT_PROFILES)) {
    const m = await build(applyInstinct(base, key));

    // instinct_stack is ordered by score, descending, labelled Leading/Supporting/Growing.
    const want = Object.entries(c.profile).sort((a, b) => b[1] - a[1]).map(([code]) => code);
    assert.deepStrictEqual(m.instinct_stack.map((s) => s.code), want,
      `${key}: instinct_stack order`);
    assert.deepStrictEqual(m.instinct_stack.map((s) => s.label), ['Leading', 'Supporting', 'Growing'],
      `${key}: instinct_stack labels`);
    assert.strictEqual(m.instinct_stack[0].code, c.dominant,
      `${key}: the leading instinct and dominant_instinct_hypothesis must agree — the fixture ` +
      `overrides both together precisely so they cannot diverge`);

    // charts.instincts is declaration-ordered SP/SO/SX with raw scores, NOT rank-ordered.
    assert.deepStrictEqual(m.charts.instincts, [
      { code: 'SP', score: c.profile.SP },
      { code: 'SO', score: c.profile.SO },
      { code: 'SX', score: c.profile.SX },
    ], `${key}: charts.instincts`);

    // The dominant selects the subtype row and the label (report_prep.js:213,219).
    assert.strictEqual(m.display.subtype_label, c.label, `${key}: display.subtype_label`);
  }
});

test('instinct axis: every profile in the set is a near-tie — recorded, not asserted as desirable', async () => {
  // All three are permutations of the fixture's own {66,64,84}, which is what makes
  // sx_primary the existing baseline for free. The consequence is that the second/third gap
  // is 2 points in all three, so the matrix contains NO clearly-separated profile. That buys
  // nothing at step 2, where all three render identically; a wide_gap case is wanted at STEP
  // 4, when badges render and a 2-point gap and a 40-point gap finally look different.
  for (const [key, c] of Object.entries(INSTINCT_PROFILES)) {
    const sorted = Object.values(c.profile).sort((a, b) => b - a);
    assert.strictEqual(sorted[1] - sorted[2], 2,
      `${key}: second/third gap is 2 — if this changes, the wide_gap note in instinct_axis.js is stale`);
  }
});

// ── The instinct-stack edge cases: ONE assertion, two inputs ──────────────────────────

test('instinct stack: an exact tie and a missing profile both fall through to declaration order', async () => {
  // TODAY'S BEHAVIOUR, ASSERTED AS TODAY'S BEHAVIOUR — not a decision anyone made.
  //
  // instinctStack (app/report_prep.js:65) sorts a literal declared ['SP','SO','SX'], and
  // Array.prototype.sort has been stability-guaranteed since ES2019. So an exact three-way
  // tie and a missing profile produce the SAME result for the SAME reason: Leading = SP.
  // One assertion with two inputs, because it is one behaviour.
  //
  // A missing or empty profile therefore yields a confident "Leading = SP" rather than an
  // error, and with all three badges shipping that prints a fabricated full stack. That is
  // a defect tracked on its own card and deliberately NOT fixed here.
  //
  // WHOEVER FIXES IT CHANGES THIS ASSERTION IN THE SAME COMMIT. This is not a
  // deliberately-red-later test — this repo has no such convention (tests/timing_test.js is
  // the pattern followed: assert what happens, carry the why in the message).
  for (const [key, c] of Object.entries(STACK_EDGE_CASES)) {
    const a = clone(base);
    if (c.profile === undefined) delete a.hypothesis.instinct_score_profile;
    else a.hypothesis.instinct_score_profile = c.profile;
    const m = await build(a);
    assert.strictEqual(m.instinct_stack[0].code, 'SP',
      `${key}: Leading = SP by declaration order, not by decision`);
    assert.strictEqual(m.instinct_stack.length, 3, `${key}: stack is still length 3`);
  }
});

// ── The Z6 axis ───────────────────────────────────────────────────────────────────────

test('Z6: all four states build a valid model with the expected instinct_evidence shape', async () => {
  for (const [key, s] of Object.entries(Z6_STATES)) {
    const m = await build(applyZ6(base, key));   // buildClientModel calls validateModel itself
    assert.deepStrictEqual(m.pages.instinct_subtype.instinct_evidence, s.expect,
      `${key}: model instinct_evidence`);
  }
});

test('Z6: null and absent converge — they are one model state reached two ways', async () => {
  // report_prep.js:371 is `cf.instinct_evidence ?? null`, and `??` maps undefined and null
  // to the same value. anders_sx9 ships with client_facing: {}, so `absent` is the CURRENT
  // baseline and an explicit null is indistinguishable from it downstream.
  const [a, b] = [await build(applyZ6(base, 'null')), await build(applyZ6(base, 'absent'))];
  assert.strictEqual(a.pages.instinct_subtype.instinct_evidence, null);
  assert.strictEqual(b.pages.instinct_subtype.instinct_evidence, null);
  assert.deepStrictEqual(a, b, 'null and absent must produce identical models');
});

test('Z6: the EM shape is one element of 777 characters and survives the prep path', async () => {
  // Derived from sp4_api_result.json's instinct_personal_overlay — the field
  // em_report_adapter.js:143 maps into instinct_evidence, wrapped by _toEvidenceArray as a
  // ONE-element array. scripts/render_client.js never calls that adapter, so this is a
  // hand-made post-adapter artifact: it exercises the prep path's tolerance of the shape,
  // NOT the EM pipeline.
  assert.strictEqual(EM_PARAGRAPH.length, 1, 'EM shape is a single element, not three bullets');
  assert.strictEqual(EM_PARAGRAPH[0].length, 777);
  assert.strictEqual(EM_PARAGRAPH[0].split(/\n\n+/).length, 3, 'three paragraphs');
  const m = await build(applyZ6(base, 'em_paragraph'));
  assert.strictEqual(m.pages.instinct_subtype.instinct_evidence[0].length, 777,
    'the 777-char paragraph reaches the model intact and throws nowhere');
});

test('Z6: the SM bullets are a live copy of CMS_PREVIEW_WORST_EVIDENCE, and are over-spec', async () => {
  // SELF-POLICING COPY. app/server.js exports nothing and requiring it would boot the
  // application, so the three bullets are duplicated in instinct_axis.js. This asserts the
  // copy still matches the source, by reading server.js as text.
  const src = fs.readFileSync(path.join(ROOT, 'app/server.js'), 'utf8');
  for (const b of SM_BULLETS_OVER_SPEC) {
    assert.ok(src.includes(b),
      'SM bullet has drifted from CMS_PREVIEW_WORST_EVIDENCE (app/server.js:13823) — re-copy it');
  }
  // DELIBERATELY OVER-SPEC, asserted so nobody derives a budget from it by accident. The
  // producer contract is "exactly 3 short bullets, ≤25 words each" (app/server.js:4828,
  // asserted by scripts/verify_phase1_fields.js:20). Every bullet exceeds it.
  const words = SM_BULLETS_OVER_SPEC.map((b) => b.trim().split(/\s+/).length);
  assert.deepStrictEqual(words, [27, 29, 28], 'measured word counts');
  assert.ok(words.every((w) => w > 25),
    'these bullets are over the ≤25-word contract ON PURPOSE — a budget derived from them ' +
    'is a budget for a shape the producer cannot legally emit');
});
