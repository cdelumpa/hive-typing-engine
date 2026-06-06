'use strict';

/**
 * verify_phase0_instinct.js — Step 7 Phase 0, Step C verification (offline, no API key).
 *
 * Proves the renderer reads the Call #2 instinct from `dominant_instinct_hypothesis`
 * (the field actually present on the rendered object) rather than the legacy
 * `confirmed_instinct` mirror that the feed trace showed is ALWAYS absent.
 *
 * Three cases:
 *   A. in-memory shape  — dominant_instinct_hypothesis: 'SP', confirmed_instinct ABSENT  → must show SP
 *   B. negative control — neither field present                                         → must NOT show SP
 *   C. legacy fallback  — confirmed_instinct: 'SP' only (no hypothesis field)           → must show SP
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
require('module').globalPaths.push(path.join(ROOT, 'app/node_modules'));
const { buildClientHTML, buildCoachHTML } = require(path.join(ROOT, 'app/renderer'));

const typeLibrary = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/type_library.json'), 'utf8'));
const intake = { firstName: 'Test', lastName: 'Client', organization: 'Not provided' };

// Minimal scores object the coach render reads (guarded fields; shape per renderer).
const scores = {
  body: 6, heart: 9, head: 3, identifiedCenter: 'Heart',
  sortedInstincts: [['SP', 9], ['SX', 6], ['SO', 3]],
};

// Build the proven in-memory Call #2 result shape. confirmed_type 4 / SP = sp4.
function makeResult({ dominant, legacy }) {
  const h = {
    confirmed_type: 4,
    confirmed_type_name: 'Type 4 — The Individualist',
    confidence_level: 'HIGH',
    leading_candidate: 4, alternate_candidate: 5, third_candidate: 6,
    call1_ranking: [4,5,6,1,2,3,9,8,7].map((t,i) => ({ type: t, score: 90 - i*8 })),
    type_score_profile: {1:40,2:45,3:50,4:88,5:70,6:55,7:30,8:35,9:42},
    instinct_score_profile: { SP: 80, SO: 40, SX: 60 },
    stage4_outcome: 'CONFIRMED',
    redirect_from_type: null,
    hypothesis_validated: true,
  };
  if (dominant) h.dominant_instinct_hypothesis = dominant;   // live field
  if (legacy)   h.confirmed_instinct = legacy;               // legacy DB-only mirror
  return {
    hypothesis: h,
    client_facing: { client_narrative: 'A specific, warm narrative.', what_to_explore: ['q1','q2','q3'] },
    coach_report: {},
  };
}

let failures = 0;
function check(label, cond) {
  console.log(`  ${cond ? 'PASS' : '*** FAIL'} — ${label}`);
  if (!cond) failures++;
}

// SP label as it appears in rendered HTML ('Self-Preservation' for client, 'Type 4 · SP' for coach).
function renders(result) {
  const client = buildClientHTML(result, typeLibrary, intake);
  const coach  = buildCoachHTML(result, typeLibrary, scores, intake);
  return { client, coach };
}

console.log('CASE A — in-memory shape (dominant_instinct_hypothesis: SP, confirmed_instinct absent):');
{
  const r = makeResult({ dominant: 'SP' });
  if ('confirmed_instinct' in r.hypothesis) { console.log('  *** FAIL — fixture leaked confirmed_instinct'); failures++; }
  const { client, coach } = renders(r);
  // Personalized marker (renderer.js:288) — distinct from static instinct-definition prose.
  check('client report shows "Your Instinct — Self-Preservation"', /Your Instinct — Self-Preservation/.test(client));
  check('coach report shows "Type 4 · SP"',        /Type 4 · SP/.test(coach));
  check('coach report shows "Self-Preservation (SP)"', /Self-Preservation \(SP\)/.test(coach));
}

console.log('CASE B — negative control (neither field present):');
{
  const { client, coach } = renders(makeResult({}));
  // With no instinct field the personalized "Your Instinct — …" section is gated out entirely.
  check('client report has NO personalized "Your Instinct — Self-Preservation"', !/Your Instinct — Self-Preservation/.test(client));
  check('coach report shows "Type 4 · "  (blank instinct, no SP)', /Type 4 · </.test(coach) && !/Type 4 · SP/.test(coach));
}

console.log('CASE C — legacy fallback (confirmed_instinct: SP only):');
{
  const { client, coach } = renders(makeResult({ legacy: 'SP' }));
  check('client report shows "Your Instinct — Self-Preservation" via fallback', /Your Instinct — Self-Preservation/.test(client));
  check('coach report shows "Type 4 · SP" via fallback',        /Type 4 · SP/.test(coach));
}

console.log('');
if (failures) { console.log(`RESULT: ${failures} FAILURE(S)`); process.exit(1); }
console.log('RESULT: ALL CHECKS PASSED — renderer reads dominant_instinct_hypothesis; legacy fallback intact.');
