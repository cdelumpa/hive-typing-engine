#!/usr/bin/env node
/**
 * Hive Typing Engine — Stage 1 (v2) scoring unit test
 *
 * Usage (absolute path):
 *   node /Users/<you>/Developer/hive-typing-engine/tests/stage1_scoring_test.js
 *
 * What it does:
 *   Extracts HIGH_AMBIGUITY_MARGIN and the pure scoreStage1Profile() function
 *   from app/public/assessment.js (a browser-global file, not a module) via the
 *   same balanced-brace extraction the e2e runner uses, then feeds known slider
 *   values and asserts the exact nine-type profile, instinct profile, and the
 *   high-ambiguity flag. No server, no AI, no pipeline — this is the correct
 *   Step-1 test and gives immediate true/false signal on scoring correctness.
 *
 *   The flag assertions are made against HIGH_AMBIGUITY_MARGIN (the named,
 *   tunable constant), never a hard-coded threshold, so tuning the margin in
 *   Step 1 does not silently invalidate the test.
 */

'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const ASSESSMENT = path.join(ROOT, 'app/public/assessment.js');
const src        = fs.readFileSync(ASSESSMENT, 'utf8');

// ─── Extract the constant + the pure function from the browser source ─────────
const marginMatch = src.match(/const HIGH_AMBIGUITY_MARGIN\s*=\s*[^;]+;/);
if (!marginMatch) { console.error('Cannot find HIGH_AMBIGUITY_MARGIN in assessment.js'); process.exit(1); }

function extractFn(name) {
  const startRe = new RegExp(`^function ${name}\\s*\\(`, 'm');
  const idx = src.search(startRe);
  if (idx < 0) throw new Error(`Cannot find function: ${name}`);
  let depth = 0, i = idx, started = false;
  while (i < src.length) {
    if (src[i] === '{') { depth++; started = true; }
    else if (src[i] === '}') { depth--; }
    if (started && depth === 0) return src.slice(idx, i + 1);
    i++;
  }
  throw new Error(`Unbalanced braces in: ${name}`);
}

const moduleCode = `'use strict';
${marginMatch[0]}
${extractFn('scoreStage1Profile')}
module.exports = { HIGH_AMBIGUITY_MARGIN, scoreStage1Profile };
`;
const tmp = path.join(os.tmpdir(), 'hive_stage1_scoring.js');
fs.writeFileSync(tmp, moduleCode);
delete require.cache[tmp];
const { HIGH_AMBIGUITY_MARGIN, scoreStage1Profile } = require(tmp);

console.log(`\n=== Stage 1 (v2) Scoring Unit Test — HIGH_AMBIGUITY_MARGIN = ${HIGH_AMBIGUITY_MARGIN} ===\n`);

// ─── Assertion helpers ────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? '✓' : '✗'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  ok ? passed++ : failed++;
}
function approx(label, actual, expected) {
  const ok = typeof actual === 'number' && Math.abs(actual - expected) < 1e-9;
  console.log(`  ${ok ? '✓' : '✗'}  ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
  ok ? passed++ : failed++;
}
// Ties the flag assertion to the constant, not to a literal threshold.
function checkFlagAgainstConstant(p) {
  const expected = p.gap <= HIGH_AMBIGUITY_MARGIN;
  const ok = p.highAmbiguity === expected;
  console.log(`  ${ok ? '✓' : '✗'}  flag === (gap <= HIGH_AMBIGUITY_MARGIN): ${p.highAmbiguity} (gap ${p.gap}, margin ${HIGH_AMBIGUITY_MARGIN})`);
  ok ? passed++ : failed++;
}

// ─── Slider-set builders ──────────────────────────────────────────────────────
const ZERO = () => [0, 0, 0, 0, 0];
const uniform = (v) => [v, v, v, v, v];
function types(overrides) {
  const t = {};
  for (let i = 1; i <= 9; i++) t[i] = overrides[i] || ZERO();
  return t;
}
function instincts(o) {
  return { SP: o.SP || ZERO(), SO: o.SO || ZERO(), SX: o.SX || ZERO() };
}

// ─── Case A — clean winner, flag FALSE ────────────────────────────────────────
// Type 3 all 100 -> 100.0; Type 8 all 50 -> 50.0; gap 50 -> not ambiguous.
console.log('Case A — clean winner (flag FALSE):');
{
  const p = scoreStage1Profile(
    types({ 3: uniform(100), 8: uniform(50) }),
    instincts({ SP: uniform(50) })
  );
  approx('typeProfile[3]', p.typeProfile[3], 100.0);
  approx('typeProfile[8]', p.typeProfile[8], 50.0);
  approx('typeProfile[1] (untouched)', p.typeProfile[1], 0.0);
  check('leadingType', p.leadingType, 3);
  check('alternateType', p.alternateType, 8);
  approx('gap', p.gap, 50);
  check('highAmbiguity', p.highAmbiguity, false);
  checkFlagAgainstConstant(p);
}

// ─── Case B — near-tie, flag TRUE ─────────────────────────────────────────────
// Type 4 all 80 -> 80.0; Type 5 all 76 -> 76.0; gap 4 -> ambiguous.
console.log('\nCase B — near-tie (flag TRUE):');
{
  const p = scoreStage1Profile(
    types({ 4: uniform(80), 5: uniform(76) }),
    instincts({ SP: uniform(50) })
  );
  approx('typeProfile[4]', p.typeProfile[4], 80.0);
  approx('typeProfile[5]', p.typeProfile[5], 76.0);
  check('leadingType', p.leadingType, 4);
  check('alternateType', p.alternateType, 5);
  approx('gap', p.gap, 4);
  check('highAmbiguity', p.highAmbiguity, true);
  checkFlagAgainstConstant(p);
}

// ─── Case C — mixed (non-uniform) instinct sliders, dominant SP ───────────────
// SP=[90,80,70,60,100]->80.0; SO=[40,50,30,20,10]->30.0; SX all 60->60.0.
console.log('\nCase C — mixed instinct sliders (dominant SP):');
{
  const p = scoreStage1Profile(
    types({ 1: uniform(70), 2: uniform(20) }),
    instincts({ SP: [90, 80, 70, 60, 100], SO: [40, 50, 30, 20, 10], SX: uniform(60) })
  );
  approx('instinctProfile.SP', p.instinctProfile.SP, 80.0);
  approx('instinctProfile.SO', p.instinctProfile.SO, 30.0);
  approx('instinctProfile.SX', p.instinctProfile.SX, 60.0);
  check('dominantInstinct', p.dominantInstinct, 'SP');
  checkFlagAgainstConstant(p);
}

// ─── Case D — non-uniform TYPE sliders (catches drop/average bugs) ────────────
// Type 6=[50,60,70,80,90]->70.0; Type 9=[10,30,50,70,90]->50.0. A dropped slider
// or divide-by-4 would give 65 or 87.5 instead of 70 — so this catches that class.
console.log('\nCase D — non-uniform type sliders:');
{
  const p = scoreStage1Profile(
    types({ 6: [50, 60, 70, 80, 90], 9: [10, 30, 50, 70, 90] }),
    instincts({ SP: uniform(50) })
  );
  approx('typeProfile[6]', p.typeProfile[6], 70.0);
  approx('typeProfile[9]', p.typeProfile[9], 50.0);
  check('leadingType', p.leadingType, 6);
  check('alternateType', p.alternateType, 9);
  approx('gap', p.gap, 20);
  check('highAmbiguity', p.highAmbiguity, false);
  checkFlagAgainstConstant(p);
}

// ─── Case E — boundary, derived from the constant (not a magic number) ────────
// E1: gap exactly == MARGIN  -> flag TRUE  (inclusive boundary).
// E2: gap == MARGIN + 1      -> flag FALSE.
console.log('\nCase E — boundary at HIGH_AMBIGUITY_MARGIN (inclusive):');
{
  const e1 = scoreStage1Profile(
    types({ 1: uniform(80), 2: uniform(80 - HIGH_AMBIGUITY_MARGIN) }),
    instincts({ SP: uniform(50) })
  );
  approx('E1 gap == MARGIN', e1.gap, HIGH_AMBIGUITY_MARGIN);
  check('E1 highAmbiguity (gap == MARGIN -> TRUE)', e1.highAmbiguity, true);
  checkFlagAgainstConstant(e1);

  const e2 = scoreStage1Profile(
    types({ 1: uniform(80), 2: uniform(80 - HIGH_AMBIGUITY_MARGIN - 1) }),
    instincts({ SP: uniform(50) })
  );
  approx('E2 gap == MARGIN + 1', e2.gap, HIGH_AMBIGUITY_MARGIN + 1);
  check('E2 highAmbiguity (gap == MARGIN+1 -> FALSE)', e2.highAmbiguity, false);
  checkFlagAgainstConstant(e2);
}

// ─── Case F — exact tie: deterministic tie-break by type number, gap 0 -> TRUE ─
console.log('\nCase F — exact tie (deterministic tie-break, gap 0):');
{
  const p = scoreStage1Profile(
    types({ 2: uniform(60), 5: uniform(60) }),
    instincts({ SP: uniform(50) })
  );
  check('leadingType (lower number wins tie)', p.leadingType, 2);
  check('alternateType', p.alternateType, 5);
  approx('gap', p.gap, 0);
  check('highAmbiguity (gap 0 within margin)', p.highAmbiguity, true);
  checkFlagAgainstConstant(p);
}

// ─── Case G — wrong slider count fails loudly ─────────────────────────────────
console.log('\nCase G — defensive: a 4-slider group throws (fail loudly):');
{
  let threw = false;
  try {
    const bad = types({ 3: uniform(100) });
    bad[3] = [100, 100, 100, 100]; // only 4 — must throw, not silently divide
    scoreStage1Profile(bad, instincts({ SP: uniform(50) }));
  } catch (e) {
    threw = true;
    console.log(`  ✓  threw: ${e.message}`);
  }
  check('threw on 4-slider group', threw, true);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
