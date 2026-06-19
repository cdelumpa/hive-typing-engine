#!/usr/bin/env node
'use strict';

/**
 * Deterministic unit test for the Call #2 REDIRECT post-processing
 * (app/call2_stamp.js → applyCall2DeterministicStamps).
 *
 * No server, no Claude API — feeds synthetic raw "model output" + engine scores
 * straight into the extracted stamping function and asserts the shipped fixes:
 *   Defect #2 — alternate_candidate swap on a legitimate REDIRECT
 *   Defect #3 — equality guard when no clean recovery is possible
 *   Defect #4 — redirect_suppressed coach flag (fires / does not fire by gap)
 *
 * Because the model is out of the loop entirely, these assertions are 100%
 * deterministic — zero flicker. Run: node tests/redirect_logic_test.js
 */

const path = require('path');
const { applyCall2DeterministicStamps } = require(path.join(__dirname, '..', 'app', 'call2_stamp'));

let passed = 0, failed = 0;
function check(label, cond) {
  console.log(`  ${cond ? '✓' : '✗'}  ${label}`);
  cond ? passed++ : failed++;
}
const hasFlag = (result, type) => Array.isArray(result.flags) && result.flags.some((f) => f.flag_type === type);

// Canonical Call #1 scores for a 6→9 REDIRECT (leading 6, alternate 9). The deterministic
// stamp re-asserts alternate_candidate = 9 (Call #1 position 2) before the redirect swap runs.
const redirectScores = {
  call1Result: { leading_candidate: 6, alternate_candidate: 9, third_candidate: 1 },
  stage4: { outcome: 'REDIRECT', redirectSuppressed: false },
};

// ── Test 1 — Defect #2: REDIRECT swap ────────────────────────────────────────────
console.log('\n=== Test 1 — Defect #2: alternate_candidate swap on REDIRECT ===');
{
  // Raw model output on a REDIRECT: confirmed_type = former alternate (9),
  // redirect_from_type = displaced leader (6), alternate_candidate echoes 9 → collides.
  const result = { hypothesis: { stage4_outcome: 'REDIRECT', confirmed_type: 9, redirect_from_type: 6, alternate_candidate: 9 } };
  applyCall2DeterministicStamps(result, redirectScores, 'sm_only', null);
  const h = result.hypothesis;
  check('alternate_candidate swapped to redirect_from_type (6)', h.alternate_candidate === 6);
  check('confirmed_type (9) !== alternate_candidate (6)', h.confirmed_type !== h.alternate_candidate);
  check('confirmed_type unchanged (9)', h.confirmed_type === 9);
  check('redirect_from_type unchanged (6)', h.redirect_from_type === 6);
  check('no engine_collision flag (clean swap)', !hasFlag(result, 'engine_collision'));
}

// ── Test 2 — Defect #3: equality guard, no clean recovery ────────────────────────
console.log('\n=== Test 2 — Defect #3: equality guard (redirect_from_type null) ===');
{
  // Pathological: REDIRECT but redirect_from_type is null, so the swap can't fire and
  // the deterministic stamp leaves alternate_candidate = 9 = confirmed_type. The guard
  // must catch the collision and flag it (no silent pass-through).
  const result = { hypothesis: { stage4_outcome: 'REDIRECT', confirmed_type: 9, redirect_from_type: null, alternate_candidate: 9 } };
  applyCall2DeterministicStamps(result, redirectScores, 'sm_only', null);
  check('collision_flag === true', result.collision_flag === true);
  check('engine_collision flag injected', hasFlag(result, 'engine_collision'));
  const f = (result.flags || []).find((x) => x.flag_type === 'engine_collision');
  check('engine_collision flag has a description', !!(f && f.description && f.description.length > 0));
}

// ── Test 3 — Defect #4: suppression does NOT fire (gap ≤ 30) ──────────────────────
console.log('\n=== Test 3 — Defect #4: no suppression flag when redirectSuppressed=false (gap 20) ===');
{
  const result = { hypothesis: { stage4_outcome: 'REDIRECT', confirmed_type: 9, redirect_from_type: 6, alternate_candidate: 9 } };
  const scores = { call1Result: { leading_candidate: 6, alternate_candidate: 9 }, stage4: { outcome: 'REDIRECT', redirectSuppressed: false, redirectGap: 20 } };
  applyCall2DeterministicStamps(result, scores, 'sm_only', null);
  check('no redirect_suppressed flag injected', !hasFlag(result, 'redirect_suppressed'));
  check('REDIRECT proceeded — swap still applied (alternate_candidate === 6)', result.hypothesis.alternate_candidate === 6);
}

// ── Test 4 — Defect #4: suppression fires (gap > 30) ──────────────────────────────
console.log('\n=== Test 4 — Defect #4: redirect_suppressed flag when redirectSuppressed=true (gap 35) ===');
{
  // computeStage4Scores downgraded the wide-gap REDIRECT to CONFIRMED_WITH_NOTE upstream,
  // so the model confirmed the leading type (6) normally — no collision here. The stamp
  // must inject the redirect_suppressed coach flag.
  const result = { hypothesis: { stage4_outcome: 'CONFIRMED_WITH_NOTE', confirmed_type: 6, redirect_from_type: null, alternate_candidate: 9 } };
  const scores = { call1Result: { leading_candidate: 6, alternate_candidate: 9 }, stage4: { outcome: 'CONFIRMED_WITH_NOTE', redirectSuppressed: true, redirectGap: 35 } };
  applyCall2DeterministicStamps(result, scores, 'sm_only', null);
  check('redirect_suppressed flag injected', hasFlag(result, 'redirect_suppressed'));
  const f = (result.flags || []).find((x) => x.flag_type === 'redirect_suppressed');
  check('flag description mentions the suppressed redirect', !!(f && /redirect has been suppressed/.test(f.description)));
  check('no engine_collision flag (leading type confirmed cleanly)', !hasFlag(result, 'engine_collision'));
  check('confirmed_type retained as leading type (6)', result.hypothesis.confirmed_type === 6);
}

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
