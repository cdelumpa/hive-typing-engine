'use strict';

/**
 * verify_phase7c_beta.js — Step 7 Phase 7c verification (offline, no API key, no DB).
 *
 * Synthesizes a v2 client `row` from the committed sp4 fixtures, runs the (now
 * v2-aligned) buildBetaData, and asserts the previously-broken sections populate
 * from v2 shapes — center rows gone, Stage 1/2/3 sourced correctly — then confirms
 * buildBetaHTML renders without error.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { buildBetaData } = require(path.join(ROOT, 'app/generate_report.js'));
const { buildBetaHTML } = require(path.join(ROOT, 'app/renderer.js'));

const scores = require(path.join(ROOT, 'tests/fixtures/sp4.json')).scores;
const apiResult = require(path.join(ROOT, 'tests/fixtures/sp4_api_result.json'));

// Minimal v2 responses_snapshot (the verified sections don't depend on response text).
const responses = {
  stage0: { q1: 'a', q2: 'b', q3: 'c', q4: 'd' },
  stage1: {}, stage2: { q1: 'A', q2: 'B', q3: 'C' },
  stage3: { q1: scores.stage3 && scores.stage3.q1Answer }, stage4: {},
};
const row = {
  first_name: 'Test', last_name: 'Client', assessment_date: '2026-06-05',
  scores_snapshot: JSON.stringify(scores),
  responses_snapshot: JSON.stringify(responses),
  api_result: JSON.stringify(apiResult),
};

let failures = 0;
const check = (label, cond) => { console.log(`  ${cond ? 'PASS' : '*** FAIL'} — ${label}`); if (!cond) failures++; };
const val = (rows, label) => (rows.find(r => r.label === label) || {}).value;

console.log('=== Phase 7c — beta report v2 alignment ===\n');
const data = buildBetaData(row);
const s1 = data.stage1.summary, s2 = data.stage2.summary, s3 = data.stage3.summary;

// Centers dropped
check('no Head/Heart/Body center row', !s1.some(r => /Head \/ Heart \/ Body|Confirmed Center|Center Confidence/.test(r.label)));

// Stage 1 sourced from v2 instinctProfile + ranking
check(`SP/SO/SX from instinctProfile (${val(s1, 'SP / SO / SX')})`, /\d/.test(val(s1, 'SP / SO / SX') || '') && !/\?/.test(val(s1, 'SP / SO / SX') || ''));
check(`Dominant Instinct = ${apiResult.hypothesis.dominant_instinct_hypothesis}`, val(s1, 'Dominant Instinct') === apiResult.hypothesis.dominant_instinct_hypothesis);
check('Leading / Alternate populated', /Type \d+ \/ Type \d+/.test(val(s1, 'Leading / Alternate') || ''));
check('Coherence Ranking populated (not —)', (val(s1, 'Coherence Ranking') || '—') !== '—');

// Stage 2 from stage2_analysis
const s2a = apiResult.stage2_analysis || {};
check(`Hornevian = stage2_analysis.hornevian_result`, val(s2, 'Hornevian (Social Style)') === (s2a.hornevian_result || '—') && !!s2a.hornevian_result);
check('Framework Alignment populated', (val(s2, 'Framework Alignment') || '—') !== '—');
check('no v1 Primary/Ambiguity rows', !s2.some(r => /Primary Hypothesis|Ambiguity Axis|Cross-Center/.test(r.label)));

// Stage 3 from scores.stage3
check(`Stage 3 Mode = ${scores.stage3.mode}`, (val(s3, 'Mode') || '').replace(/-/g, '_') === scores.stage3.mode.replace(/-/g, '_'));
check('Stage 3 Pair Tested populated', (val(s3, 'Pair Tested') || '—') !== '—');
check('no Stage 3 Confidence row (dropped)', !s3.some(r => r.label === 'Confidence'));

// Renderer still consumes the data contract
let rendered = false;
try { const html = buildBetaHTML(data); rendered = typeof html === 'string' && html.length > 1000; } catch (e) { console.log('    render error: ' + e.message); }
check('buildBetaHTML renders the v2-sourced data', rendered);

console.log('');
if (failures) { console.log(`RESULT: ${failures} FAILURE(S)`); process.exit(1); }
console.log('RESULT: ALL PHASE 7c CHECKS PASSED.');
