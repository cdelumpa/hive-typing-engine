#!/usr/bin/env node
/**
 * Hive Typing Engine — v2 fixture runner (Call #2 isolation)
 *
 * Usage:
 *   node tests/run_test.js sp4
 *   node tests/run_test.js sx7
 *
 * Two modes, selected by the fixture's _meta._quarantined flag:
 *
 *   CAPTURE MODE  (fixture IS quarantined — call1Result/expected_* not yet locked)
 *     1. Builds the Call #1 §6.2 context from the fixture (buildContextBlock).
 *     2. If fixture.call1Result is null, POSTs it to /api/call1 (client_id:null)
 *        to mint a realistic frozen call1Result, and writes it to /tmp.
 *        If fixture.call1Result is already present, it is used as-is (frozen).
 *     3. Builds the Call #2 §9.1 case file (buildCall2Context) on top of that
 *        frozen call1Result and POSTs it to /api/analyze — TWICE — dumping the
 *        raw JSON for both runs to /tmp. NO assertions are made.
 *     The point of capture mode is to hand the human realistic outputs to review
 *     before any expected value is locked.
 *
 *   ASSERT MODE  (fixture is NOT quarantined — expected_* are locked)
 *     Exercises Call #2 only against the fixture's frozen call1Result and checks
 *     the v2 api_result against the locked expected_* values. (Authored after the
 *     capture pass is approved.)
 *
 * Pipeline depth: Call #2 isolation. /api/call1 is hit once (during capture) to
 * freeze a realistic call1Result; the recurring test exercises only Call #2. This
 * keeps Call #1 nondeterminism out of the locked expected values.
 *
 * Prerequisites:
 *   Server running: cd app && node server.js   (needs ANTHROPIC_API_KEY)
 *   Basic auth: BASIC_AUTH_USER / BASIC_AUTH_PASSWORD (defaults below).
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
// Render half (Step 7 Phase 7b): exercise the full pipeline — report_prep -> Part B/C
// renderer -> measurement gate (with self-heal) — on the live Call #2 result.
const renderReport = require(path.join(__dirname, '..', 'app', 'render_report'));

// ─── Args ─────────────────────────────────────────────────────────────────────
const fixtureName = (process.argv[2] || '').toLowerCase();
if (!fixtureName) {
  console.error('Usage: node tests/run_test.js <fixture>   (e.g. sp4 or sx7)');
  process.exit(1);
}

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT          = path.resolve(__dirname, '..');
const ASSESSMENT_JS = path.join(ROOT, 'app/public/assessment.js');
const FIXTURE       = path.join(__dirname, `fixtures/${fixtureName}.json`);
const TMP           = os.tmpdir();

if (!fs.existsSync(FIXTURE)) {
  console.error(`Fixture not found: ${FIXTURE}`);
  console.error(`Available fixtures: ${fs.readdirSync(path.join(__dirname,'fixtures')).join(', ')}`);
  process.exit(1);
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const meta = fixture._meta || {};
const CAPTURE_MODE = !!meta._quarantined;
console.log(`\n=== Hive v2 Runner — ${meta.name || fixtureName} ===`);
console.log(`Mode: ${CAPTURE_MODE ? 'CAPTURE (no assertions — quarantined)' : 'ASSERT'}\n`);

// ─── Constants the assessment.js context builders depend on ───────────────────
const TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer',
  4: 'The Individualist', 5: 'The Observer', 6: 'The Questioner',
  7: 'The Enthusiast', 8: 'The Protector', 9: 'The Peacemaker',
};
const HIGH_AMBIGUITY_MARGIN = 8;
const STAGE2_BUCKET_LABELS = {
  Hornevian:       { A: 'Assertive',  B: 'Compliant',  C: 'Withdrawn'  },
  Harmonic:        { A: 'Intensity',  B: 'Positive',   C: 'Competency' },
  ObjectRelations: { A: 'Attachment', B: 'Frustration', C: 'Rejection' },
};

// ─── Build the shared `state` object the builders read from ───────────────────
// The context builders (assessment.js) read Stage 0 text, Stage 1 opens, Stage 2
// answers, intake, and call1Result from a module-global `state`; the Stage 1
// profile is passed as `s`. We mirror the live browser state exactly.
const state = {
  intake:             fixture.intake || {},
  stage0Answers:      fixture.stage0Answers || {},
  stage1TypeOpen:     fixture.stage1TypeOpen || '',
  stage1InstinctOpen: fixture.stage1InstinctOpen || '',
  stage2Answers:      fixture.stage2Answers || [],
  call1Result:        fixture.call1Result || null,  // mutated after Call #1 in capture
  scores:             fixture.scores,
};
const s = fixture.scores;

// ─── Extract the v2 context builders from assessment.js ───────────────────────
const src = fs.readFileSync(ASSESSMENT_JS, 'utf8');

function extractFn(name) {
  const startRe = new RegExp(`^function ${name}\\s*\\(`, 'm');
  const idx = src.search(startRe);
  if (idx < 0) throw new Error(`Cannot find function in assessment.js: ${name}`);
  let depth = 0, i = idx, started = false;
  while (i < src.length) {
    if (src[i] === '{') { depth++; started = true; }
    else if (src[i] === '}') { depth--; }
    if (started && depth === 0) return src.slice(idx, i + 1);
    i++;
  }
  throw new Error(`Unbalanced braces extracting: ${name}`);
}

const builderFns = [
  '_evidenceHeaderBlock',
  '_stage1TypeBlock',
  '_stage1InstinctBlock',
  '_stage1OpenBlock',
  '_stage2EvidenceBlock',
  'buildContextBlock',
  'rankingOverrideInfo',
  '_call1ResultBlock',
  '_stage3LeanBlock',
  '_stage4EvidenceBlock',
  'buildCall2Context',
];

const moduleCode = `'use strict';
const state                 = global.__hiveEnv.state;
const TYPE_NAMES            = global.__hiveEnv.TYPE_NAMES;
const HIGH_AMBIGUITY_MARGIN = global.__hiveEnv.HIGH_AMBIGUITY_MARGIN;
const STAGE2_BUCKET_LABELS  = global.__hiveEnv.STAGE2_BUCKET_LABELS;
${builderFns.map(extractFn).join('\n\n')}
module.exports = { buildContextBlock, buildCall2Context };
`;

const tmpMod = path.join(TMP, `hive_ctx_${fixtureName}.js`);
fs.writeFileSync(tmpMod, moduleCode);
global.__hiveEnv = { state, TYPE_NAMES, HIGH_AMBIGUITY_MARGIN, STAGE2_BUCKET_LABELS };
delete require.cache[tmpMod];
const { buildContextBlock, buildCall2Context } = require(tmpMod);

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const authUser = process.env.BASIC_AUTH_USER || 'hive-enneagram';
const authPass = process.env.BASIC_AUTH_PASSWORD || '9Types!';
const authHeader = 'Basic ' + Buffer.from(`${authUser}:${authPass}`).toString('base64');

function post(routePath, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const start = Date.now();
    console.log(`[API] POST ${routePath} — ${new Date().toISOString()}`);
    const req = http.request({
      hostname: 'localhost', port: 3000, path: routePath, method: 'POST',
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
        console.log(`[API] ${routePath} done — ${elapsed}s, HTTP ${res.statusCode}`);
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error from ${routePath}: ${e.message}\n${data.slice(0,400)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.write(body);
    req.end();
  });
}

function writeOut(name, content) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, content, 'utf8');
  console.log(`[Save] ${p}`);
  return p;
}

// ─── Capture mode ─────────────────────────────────────────────────────────────
async function runCapture() {
  // Phase 1 — freeze a realistic call1Result.
  const call1Context = buildContextBlock(s);
  writeOut(`${fixtureName}_call1_context.txt`, call1Context);
  console.log(`Call #1 context: ${call1Context.length} chars (~${Math.round(call1Context.length/4)} tokens)\n`);

  if (!state.call1Result) {
    const c1resp = await post('/api/call1', { client_id: null, contextBlock: call1Context });
    if (!c1resp || !c1resp.ok || !c1resp.result) {
      throw new Error(`/api/call1 not-ok: ${JSON.stringify(c1resp).slice(0,400)}`);
    }
    state.call1Result = c1resp.result;
    writeOut(`${fixtureName}_call1_result.json`, JSON.stringify(c1resp.result, null, 2));
    console.log('Frozen call1Result minted from /api/call1.\n');
  } else {
    console.log('Using call1Result already present in fixture (frozen).\n');
  }

  // Phase 2 — Call #2, twice, raw dump, no assertions.
  const call2Context = buildCall2Context(s);
  writeOut(`${fixtureName}_call2_context.txt`, call2Context);
  console.log(`Call #2 context: ${call2Context.length} chars (~${Math.round(call2Context.length/4)} tokens)\n`);

  for (const run of [1, 2]) {
    const resp = await post('/api/analyze', { contextBlock: call2Context });
    if (!resp || !resp.ok || !resp.result) {
      throw new Error(`/api/analyze (run ${run}) not-ok: ${JSON.stringify(resp).slice(0,400)}`);
    }
    writeOut(`${fixtureName}_call2_run${run}.json`, JSON.stringify(resp.result, null, 2));
    const h = resp.result.hypothesis || {};
    const flags = (resp.result.flags || []).map(f => f.flag_type);
    console.log(`  run ${run}: confirmed_type=${h.confirmed_type} confidence=${h.confidence_level} ` +
                `dominant_instinct=${h.dominant_instinct_hypothesis || h.dominant_instinct} ` +
                `flags=[${flags.join(', ')}]`);
  }

  console.log('\n=== CAPTURE COMPLETE — no assertions run. Review the /tmp dumps above. ===');
  console.log('Hand back: *_call1_result.json + *_call2_run1.json + *_call2_run2.json for review.\n');
}

// ─── Assert mode ──────────────────────────────────────────────────────────────
// Call #2 isolation: the fixture carries a frozen call1Result, so we never hit
// /api/call1 here — we build the Call #2 case file on top of the frozen result
// and check the verdict against the locked expected_* values in _meta.
//
// HARD checks fail the run. SOFT checks (dominant_instinct_hypothesis) only warn:
// they are stable in the authored fixtures but the field is acknowledged as
// near-tie-sensitive in general, so a flip should not red the suite.
let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`  ${ok ? '✓' : '✗'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  ok ? passed++ : failed++;
}
function checkTrue(label, cond) {
  console.log(`  ${cond ? '✓' : '✗'}  ${label}`);
  cond ? passed++ : failed++;
}
function softCheck(label, actual, expected) {
  const ok = actual === expected;
  console.log(`  ${ok ? '✓' : '⚠'}  (soft) ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)} — soft, not failing)`}`);
}

async function runAssert() {
  if (!state.call1Result || typeof state.call1Result !== 'object') {
    throw new Error('ASSERT mode requires a frozen call1Result in the fixture; found none. ' +
                    'Re-quarantine to run capture mode and mint one.');
  }

  const call2Context = buildCall2Context(s);
  const resp = await post('/api/analyze', { contextBlock: call2Context });
  if (!resp || !resp.ok || !resp.result) {
    throw new Error(`/api/analyze not-ok: ${JSON.stringify(resp).slice(0,400)}`);
  }

  const result = resp.result;
  const h = result.hypothesis || {};
  const flags = (result.flags || []).map(f => f.flag_type);
  const fr = result.final_response || {};

  console.log('\n=== VERIFICATION ===');
  check('confirmed_type',   h.confirmed_type,   meta.expected_type);
  check('confidence_level', h.confidence_level, meta.expected_confidence);
  check('stage4_outcome',   h.stage4_outcome,   meta.expected_stage4_outcome);
  check('ranking_override', h.ranking_override, meta.expected_ranking_override);
  for (const f of (meta.expected_flags || [])) {
    checkTrue(`flags contains "${f}"`, flags.includes(f));
  }
  if (meta.expected_final_response_classification) {
    check('final_response.classification', fr.classification, meta.expected_final_response_classification);
  }
  if (meta.expected_dominant_instinct) {
    softCheck('dominant_instinct_hypothesis', h.dominant_instinct_hypothesis, meta.expected_dominant_instinct);
  }

  // Render half: build both reports through report_prep -> renderer (flowing layout, no gate).
  console.log('\n=== RENDER ===');
  const intake = state.intake || {};
  const client = { first_name: intake.firstName || 'Test', last_name: intake.lastName || 'Client', organization: intake.organization, date: 'June 2026' };
  const coach = { full_name: intake.coach || 'Cai Delumpa', type: null, instinct: null };
  for (const [kind, fn] of [['coach', renderReport.renderCoachReport], ['client', renderReport.renderClientReport]]) {
    try {
      const r = await fn({ apiResult: result, client, coach });
      const pageCount = (r.html.match(/class="report-page/g) || []).length;
      checkTrue(`${kind} report renders (${pageCount} pages)`, typeof r.html === 'string' && r.html.length > 0);
    } catch (e) {
      checkTrue(`${kind} report renders`, false);
      console.log(`      ${e.message}`);
    }
  }

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

// ─── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  if (CAPTURE_MODE) await runCapture();
  else await runAssert();
})().catch(e => { console.error('\n[ERROR]', e.message); process.exit(1); });
