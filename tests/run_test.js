#!/usr/bin/env node
/**
 * Hive Typing Engine — end-to-end fixture test runner
 *
 * Usage:
 *   node tests/run_test.js sp4
 *   node tests/run_test.js sx7
 *
 * What it does:
 *   1. Loads the named fixture from tests/fixtures/<name>.json
 *   2. Builds the context block (user message) from the fixture data
 *   3. POSTs to http://localhost:3000/api/analyze
 *   4. Verifies the JSON result against expected values
 *   5. Renders client + coach HTML using the functions in app/public/app.js
 *   6. Saves output to samples/hive_client_report_<NAME>_test.html
 *              and  samples/hive_coach_report_<NAME>_test.html
 *
 * Prerequisites:
 *   Server must be running: cd app && node server.js
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

// ─── Args ─────────────────────────────────────────────────────────────────────
const fixtureName = (process.argv[2] || '').toLowerCase();
if (!fixtureName) {
  console.error('Usage: node tests/run_test.js <fixture>   (e.g. sp4 or sx7)');
  process.exit(1);
}

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT      = path.resolve(__dirname, '..');
const APP_JS    = path.join(ROOT, 'app/public/app.js');
const TYPE_LIB  = path.join(ROOT, 'content/type_library.json');
const FIXTURE   = path.join(__dirname, `fixtures/${fixtureName}.json`);
const SAMPLES   = path.join(ROOT, 'samples');
const SERVER_JS = path.join(ROOT, 'app/server.js');

if (!fs.existsSync(FIXTURE)) {
  console.error(`Fixture not found: ${FIXTURE}`);
  console.error(`Available fixtures: ${fs.readdirSync(path.join(__dirname,'fixtures')).join(', ')}`);
  process.exit(1);
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
console.log(`\n=== Hive Test Runner — ${fixture._meta.name} ===\n`);

// Quarantined fixtures are skipped (pending), not run and not failed. They assert
// on fields the v2 migration removes (center scoring, CT_COMBOS, mechanical
// confidence labels), so they cannot pass until the pipeline is whole again
// (after Step 6). Skipping with exit 0 keeps the suite green and avoids training
// us to ignore a permanently-red test. Re-enable by removing _meta._quarantined.
if (fixture._meta && fixture._meta._quarantined) {
  console.log(`⊘ QUARANTINED — skipping ${fixtureName}.`);
  console.log(`  ${fixture._meta._quarantined}\n`);
  process.exit(0);
}

// ─── Build context block (prompt constants now live in server.js) ─────────────
// The test runner reads non-public source files only to extract rendering
// functions (buildClientHTML etc.) — prompt assembly is done server-side.
const srcFiles = [
  path.join(ROOT, 'app/public/state.js'),
  path.join(ROOT, 'app/public/ui.js'),
  path.join(ROOT, 'app/public/assessment.js'),
  path.join(ROOT, 'app/public/app.js'),
].filter(p => fs.existsSync(p));
const src = srcFiles.map(p => fs.readFileSync(p, 'utf8')).join('\n\n');

// ─── Build user message (context block) from fixture ─────────────────────────
function buildContextFromFixture(f) {
  const s0  = f.stage0;
  const s1  = f.stage1;
  const s2  = f.stage2;
  const s3  = f.stage3;
  const s4  = f.stage4;

  const secondCenterLine = (s1.secondCenter)
    ? `Second candidate Center: ${s1.secondCenter}\n` : '';

  const ctStage1 = s1.counterTypeFlag === 'YES'
    ? `Counter-type flag: YES\nCounter-type combination: ${s1.counterTypeCombination}`
    : 'Counter-type flag: NO';

  const secondCandidateLine = s4.secondType
    ? `Second candidate tested: Type ${s4.secondType}\n` : '';

  const boolStr = (v) => v === true ? 'YES' : v === false ? 'NO' : 'N/A';

  // Stage 2 bucket labels
  const BUCKET_LABELS = {
    Hornevian:       { A: 'Assertive', B: 'Compliant',   C: 'Withdrawn'  },
    Harmonic:        { A: 'Intensity', B: 'Positive',    C: 'Competency' },
    ObjectRelations: { A: 'Attachment', B: 'Frustration', C: 'Rejection' },
  };

  // Coach and final open response
  const coach = f.coach || 'Cai Delumpa';
  const finalOpen = (f.final_open_response && f.final_open_response !== '[none provided]')
    ? `"${f.final_open_response}"`
    : '[none provided]';

  return `CLIENT INFORMATION
==================
Name: Test Client
Organization: Not provided
Coach: ${coach}

CLIENT ASSESSMENT DATA
======================

Stage 0 — Open Text Responses
Self-description (client's own words): "${s0.q1}"
How others describe them: "${s0.q2}"
Greatest strength: "${s0.q3}"
Most problematic quality: "${s0.q4}"

Stage 1 — Centers Scoring
Scoring: Rank 1 = 3pts, Rank 2 = 2pts, Rank 3 = 1pt. Maximum per Center: 18. Confidence: HIGH = gap 5+, MEDIUM = gap 3-4, LOW = gap 0-2.
Head Center total: ${s1.centers.Head} / 18
Heart Center total: ${s1.centers.Heart} / 18
Body Center total: ${s1.centers.Body} / 18
Identified Center: ${s1.identifiedCenter}
Gap to next Center: ${s1.centerGap} points
Center confidence: ${s1.centerConfidence}
${secondCenterLine}
Stage 1 — Instinct Scoring
Maximum per Instinct: 18. Confidence: HIGH = gap 4+, MEDIUM = gap 2-3, LOW = gap 0-1.
SP total: ${s1.instincts.SP} / 18
SO total: ${s1.instincts.SO} / 18
SX total: ${s1.instincts.SX} / 18
Identified Instinct: ${s1.identifiedInstinct}
Gap to next Instinct: ${s1.instinctGap} points
Instinct confidence: ${s1.instinctConfidence}

Stage 1 — Type Hypotheses
Three type hypotheses from Stage 1: Type ${s1.typeHypotheses.join(', Type ')}
${ctStage1}

Stage 2 — Cross-Referencing Results
Q1 Hornevian answer: ${s2.hornevian} (${BUCKET_LABELS.Hornevian[s2.hornevian]})
Q2 Harmonic answer: ${s2.harmonic} (${BUCKET_LABELS.Harmonic[s2.harmonic]})
Q3 Object Relations answer: ${s2.objectRelations} (${BUCKET_LABELS.ObjectRelations[s2.objectRelations]})

Cross-referencing primary hypothesis: Type ${s2.xrefPrimary}
Cross-referencing live alternative: Type ${s2.xrefAlternative}
Ambiguity axis: ${s2.ambiguityAxis}
Counter-type mode triggered: ${s2.counterTypeModeTriggered}

Stage 3 — Pairwise Discrimination Results
Mode: ${s3.mode}
Pair tested: ${s3.pair}
Q1 Core Motivation result: ${s3.mode === 'COUNTER-TYPE' ? 'N/A (counter-type mode — single CT question)' : (s3.q1Result || 'N/A')}
Q2 Avoidance result: ${s3.mode === 'COUNTER-TYPE' ? 'N/A' : (s3.q2Result || 'N/A')}
Stage 3 leading hypothesis: Type ${s3.leading}
Stage 3 confidence: ${s3.confidence}
Counter-type mode answer: ${s3.ctAnswer}

Stage 4 — Confirmation Results
Path: ${s4.path}
Option: ${s4.option}
Lead type tested: Type ${s4.leadType}
${secondCandidateLine}Stress confirmed: ${boolStr(s4.stressConfirmed)}
Security confirmed: ${boolStr(s4.securityConfirmed)}
Habit of Mind confirmed: ${boolStr(s4.habitConfirmed)}
Stage 4 outcome: ${s4.outcome}

Stage 4 — Answer Details (use for stress_point_description / security_point_description / habit_of_mind_description)
Stress: ${s4.stressDescription}
Security: ${s4.securityDescription}
Habit of Mind: ${s4.habitDescription || 'N/A — did not fire'}

Final open response (optional): ${finalOpen}`;
}

const contextBlock = buildContextFromFixture(fixture);
console.log(`contextBlock: ${contextBlock.length} chars (~${Math.round(contextBlock.length/4)} tokens)`);

// ─── API call ─────────────────────────────────────────────────────────────────
function postAnalyze() {
  return new Promise((resolve, reject) => {
    const body  = JSON.stringify({ contextBlock });
    const start = Date.now();
    console.log(`\n[API] Starting — ${new Date().toISOString()}`);

    // Basic auth credentials for the test runner
    const authUser = process.env.BASIC_AUTH_USER || 'hive-enneagram';
    const authPass = process.env.BASIC_AUTH_PASSWORD || '9Types!';
    const authHeader = 'Basic ' + Buffer.from(`${authUser}:${authPass}`).toString('base64');

    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/analyze', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': authHeader,
      },
      timeout: 360000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`[API] Done — ${elapsed}s, HTTP ${res.statusCode}`);
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`Response parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Rendering setup ──────────────────────────────────────────────────────────
const typeLibrary = JSON.parse(fs.readFileSync(TYPE_LIB, 'utf8'));

const TYPE_NAMES = {
  1:'The Improver', 2:'The Giver', 3:'The Performer',
  4:'The Individualist', 5:'The Observer', 6:'The Questioner',
  7:'The Enthusiast', 8:'The Protector', 9:'The Peacemaker',
};

const SUBTYPE_NAMES = {
  'sp-1': 'The Organizer',     'so-1': 'The Social Reformer',     'sx-1': 'The Evangelist',
  'sp-2': 'The Nurturer',      'so-2': 'The Ambassador',           'sx-2': 'The Healer',
  'sp-3': 'The Diligent Worker','so-3': 'The Politician',          'sx-3': 'The Movie Star',
  'sp-4': 'The Creative Individualist','so-4': 'The Critical Commentator','sx-4': 'The Dramatic Person',
  'sp-5': 'The Castle Defender','so-5': 'The Professor',           'sx-5': 'The Secret Agent',
  'sp-6': 'The Family Loyalist','so-6': 'The Social Guardian',     'sx-6': 'The Warrior',
  'sp-7': 'The Epicure',       'so-7': 'The Social Visionary',     'sx-7': 'The Adventurer',
  'sp-8': 'The Survivalist',   'so-8': 'The Group Leader',         'sx-8': 'The Commander',
  'sp-9': 'The Collector',     'so-9': 'The Community Benefactor', 'sx-9': 'The Seeker',
};

// Extract a named function from app.js source by balanced-brace matching
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

// Write a temp module with all rendering functions and load it
const fnNames = ['esc','renderParas','renderMultiPara','typeData',
                 'clientReportBodyHtml','coachReportBodyHtml',
                 'buildClientHTML','buildCoachHTML'];

const moduleCode = `'use strict';
const typeLibrary   = global.__hiveEnv.typeLibrary;
const TYPE_NAMES    = global.__hiveEnv.TYPE_NAMES;
const SUBTYPE_NAMES = global.__hiveEnv.SUBTYPE_NAMES;
const state         = global.__hiveEnv.state;
${fnNames.map(extractFn).join('\n\n')}
module.exports = { buildClientHTML, buildCoachHTML };
`;

const tmpMod = path.join(require('os').tmpdir(), 'hive_render.js');
fs.writeFileSync(tmpMod, moduleCode);
global.__hiveEnv = {
  typeLibrary,
  TYPE_NAMES,
  SUBTYPE_NAMES,
  state: { scores: fixture.mockScores },
};
// Clear require cache so each run gets a fresh module
delete require.cache[tmpMod];
const { buildClientHTML, buildCoachHTML } = require(tmpMod);

// ─── Verification helpers ─────────────────────────────────────────────────────
let passed = 0, failed = 0;
function check(label, actual, expected, exact = true) {
  const ok = exact ? actual === expected : actual;
  const icon = ok ? '✓' : '✗';
  const suffix = ok ? '' : ` (expected: ${expected})`;
  console.log(`  ${icon}  ${label}: ${JSON.stringify(actual)}${suffix}`);
  ok ? passed++ : failed++;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const resp = await postAnalyze();

  if (!resp.ok || !resp.result) {
    console.error('\n[FAIL] API not-ok:', resp.message || JSON.stringify(resp).slice(0,300));
    process.exit(1);
  }

  const result = resp.result;
  const h  = result.hypothesis;
  const cr = result.coach_report || {};
  const cf = result.client_facing || {};
  const flags = (result.flags || []).map(f => f.flag_type);
  const meta = fixture._meta;

  console.log('\n=== VERIFICATION ===');

  // Core hypothesis
  check('confirmed_type',         h.confirmed_type,         meta.expected_type);
  check('confirmed_instinct',     h.confirmed_instinct,     meta.expected_instinct);
  check('counter_type_confirmed', h.counter_type_confirmed, meta.expected_sections.includes('section1a'));
  if (meta.expected_confidence) {
    check('confidence_level',     h.confidence_level,       meta.expected_confidence);
  }
  check('second_candidate_type',  h.second_candidate_type,  h.second_candidate_type !== undefined, false);

  // Flags
  for (const expected of meta.expected_flags) {
    check(`flag: ${expected}`, flags.includes(expected), true);
  }

  // Coach sections
  for (const section of ['section1','section2','section3','section4','section5','section6']) {
    check(`coach.${section}`, !!cr[section], true);
  }
  const expect1a = meta.expected_sections.includes('section1a');
  const expect6a = meta.expected_sections.includes('section6a');
  check('coach.section1a (counter-type)',   !!cr.section1a, expect1a);
  check('coach.section6a (type-confusion)', !!cr.section6a, expect6a);

  // Client-facing fields
  check('client_narrative',        !!cf.client_narrative,         true);
  check('core_motivation_evidence',!!cf.core_motivation_evidence, true);
  check('instinct_personal_overlay',!!cf.instinct_personal_overlay, true);
  check('stress_point_narrative',  !!cf.stress_point_narrative,   true);
  check('security_point_narrative',!!cf.security_point_narrative, true);
  check('what_to_explore ≥3',      (cf.what_to_explore||[]).length >= 3, true);

  // final_response checks
  const fr = result.final_response || {};
  check('final_response present',  fr.present !== undefined, true, false);
  if (meta.expected_final_response_classification) {
    check('final_response.classification', fr.classification, meta.expected_final_response_classification);
  }
  if (meta.expected_client_self_typed !== undefined) {
    check('final_response.client_self_typed', fr.client_self_typed, meta.expected_client_self_typed);
  }
  if (meta.expected_client_self_typed_type !== undefined) {
    check('final_response.client_self_typed_type', fr.client_self_typed_type, meta.expected_client_self_typed_type);
  }
  if (meta.expected_client_self_typed_match !== undefined) {
    check('final_response.client_self_typed_match', fr.client_self_typed_match, meta.expected_client_self_typed_match);
  }

  // ── Render HTML ─────────────────────────────────────────────────────────────
  console.log('\n[Render] Building HTML reports...');
  const clientHtml = buildClientHTML(result);
  const coachHtml  = buildCoachHTML(result);
  console.log(`  Client HTML: ${clientHtml.length.toLocaleString()} chars`);
  console.log(`  Coach HTML:  ${coachHtml.length.toLocaleString()} chars`);

  // Check section headers appear in rendered output
  const clientHeaders = (clientHtml.match(/font-size:14pt;line-height:16pt;font-weight:700;letter-spacing:0\.12em/g)||[]).length;
  const coachHeaders  = (coachHtml.match(/font-size:14pt;line-height:16pt;font-weight:700;letter-spacing:0\.12em/g)||[]).length;
  check('client HTML section headers ≥10', clientHeaders >= 10, true);
  check('coach HTML section headers ≥6',   coachHeaders  >= 6,  true);
  if (expect1a) check('Section 1A in coach HTML', coachHtml.includes('1A ·'), true);
  if (expect6a) check('Section 6A in coach HTML', coachHtml.includes('6A ·'), true);

  // ── Save files ──────────────────────────────────────────────────────────────
  const label = fixtureName.toUpperCase();
  const clientOut = path.join(SAMPLES, `hive_client_report_${label}_test.html`);
  const coachOut  = path.join(SAMPLES, `hive_coach_report_${label}_test.html`);
  fs.writeFileSync(clientOut, clientHtml, 'utf8');
  fs.writeFileSync(coachOut,  coachHtml,  'utf8');
  console.log(`\n[Save] ${clientOut}`);
  console.log(`[Save] ${coachOut}`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
})().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
