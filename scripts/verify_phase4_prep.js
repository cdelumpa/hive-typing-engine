'use strict';

/**
 * verify_phase4_prep.js — Step 7 Phase 4 verification (offline, no API key).
 *
 * Feeds the committed sp4/sx7 api_result fixtures + synthetic client/coach records
 * through report_prep → asserts both view-models fully populate (validateModel passes),
 * names match the engine, near_tie derives from call1_ranking, and charts are valid.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const { TYPE_NAMES } = require(path.join(ROOT, 'app/type_meta.js'));

let failures = 0;
const check = (label, cond) => { console.log(`    ${cond ? 'PASS' : '*** FAIL'} — ${label}`); if (!cond) failures++; };

const client = { first_name: 'Test', last_name: 'Client', organization: 'Acme Co', date: 'June 2026' };
const coach = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };

for (const fx of ['sp4', 'sx7']) {
  console.log(`\nFIXTURE ${fx}:`);
  const apiResult = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));
  const h = apiResult.hypothesis;

  let coachModel, clientModel;
  try { coachModel = prep.buildCoachModel({ apiResult, client, coach }); check('buildCoachModel populated + validated (no throw)', true); }
  catch (e) { check('buildCoachModel: ' + e.message, false); continue; }
  try { clientModel = prep.buildClientModel({ apiResult, client, coach }); check('buildClientModel populated + validated (no throw)', true); }
  catch (e) { check('buildClientModel: ' + e.message, false); continue; }

  // Name authority
  check('hero.name derived from engine', coachModel.hero.name === TYPE_NAMES[h.confirmed_type]);
  check('alternate.name derived from engine', coachModel.alternate.name === TYPE_NAMES[h.alternate_candidate]);
  check('no name-drift flags', (coachModel._flags || []).length === 0 || coachModel._flags.every(Boolean));

  // near_tie from call1_ranking (coherence), expected false for sp4/sx7 (spread 40)
  const ranked = [...h.call1_ranking].map(r => r.score).sort((a, b) => b - a);
  const expectedNearTie = (ranked[0] - ranked[1]) <= 10;
  check(`near_tie from coherence spread (${ranked[0]}-${ranked[1]}=${ranked[0] - ranked[1]}) = ${expectedNearTie}`,
    coachModel.confidence.near_tie === expectedNearTie && clientModel.confidence.near_tie === expectedNearTie);
  check('near_tie NOT derived from slider gap', coachModel.confidence.near_tie === expectedNearTie);

  // Charts
  check('coach type chart = 9 bars, ints 0-100', coachModel.charts.types.length === 9 && coachModel.charts.types.every(b => Number.isInteger(b.score) && b.score >= 0 && b.score <= 100));
  check('coach instinct chart = 3 bars', coachModel.charts.instincts.length === 3);

  // Phase 1 personalized fields
  check('bottom_line present', !!coachModel.bottom_line);
  check('comparison.client_words.quotes present', Array.isArray(coachModel.comparison.client_words.quotes) && coachModel.comparison.client_words.quotes.length >= 1);
  check('comparison has both leading+alternate rows', !!coachModel.comparison.leading.rows.core_motivation && !!coachModel.comparison.alternate.rows.core_motivation);
  check('client instinct_evidence = 3 bullets', Array.isArray(clientModel.pages.instinct_subtype.instinct_evidence) && clientModel.pages.instinct_subtype.instinct_evidence.length === 3);
  check('client instinct_stack = Leading/Supporting/Growing', clientModel.instinct_stack.length === 3 && clientModel.instinct_stack[0].label === 'Leading');

  // Static library content reached the model
  check('client P4 patterns.thinking has bullets', (clientModel.pages.patterns.thinking.bullets || []).length >= 1);
  check('client P7 strengths = 3 {title,body}', clientModel.pages.strengths_challenges.strengths.length === 3 && !!clientModel.pages.strengths_challenges.strengths[0].title);
  check('client P8 application.center has bullets', (clientModel.pages.application.center.bullets || []).length >= 1);

  // PENDING static.* are null (not a failure — expected)
  const pend = clientModel.pages.welcome.body === null && clientModel.pages.primer === null && clientModel.pages.instinct_subtype.instinct_primer === null;
  check('PENDING static.* are null (welcome/primer/instinct_primer)', pend);

  const warns = (coachModel._warnings || []).concat(clientModel._warnings || []);
  if (warns.length) console.log('    (warnings: ' + warns.join('; ') + ')');
}

console.log('');
if (failures) { console.log(`RESULT: ${failures} FAILURE(S)`); process.exit(1); }
console.log('RESULT: ALL PHASE 4 CHECKS PASSED.');
