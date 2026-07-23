'use strict';

/**
 * capture_phase1.js — Step 7 Phase 1 live capture (Call #2 isolation, x2).
 *
 * Why this exists: sp4/sx7 are non-quarantined, so `tests/run_test.js` runs in
 * ASSERT mode — one /api/analyze call, no file dump. Phase 1 needs the raw result
 * captured TWICE per fixture (to check the new fields are present + stable). This
 * script builds the Call #2 case file exactly as the runner does (reusing the
 * frozen call1Result in the fixture — no /api/call1, no fixture mutation) and POSTs
 * to /api/analyze twice, writing <fixture>_call2_run1.json / _run2.json to tmpdir.
 *
 * PREREQ: app server running on localhost:3000 with ANTHROPIC_API_KEY set.
 * USAGE:  node scripts/capture_phase1.js sp4
 *         node scripts/capture_phase1.js sx7
 * Then:   node scripts/verify_phase1_fields.js
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT          = path.resolve(__dirname, '..');
const ASSESSMENT_JS = path.join(ROOT, 'app/public/assessment.js');
const fixtureName   = (process.argv[2] || '').toLowerCase();
if (!fixtureName) { console.error('Usage: node scripts/capture_phase1.js <sp4|sx7|...>'); process.exit(1); }

const FIXTURE = path.join(ROOT, `tests/fixtures/${fixtureName}.json`);
if (!fs.existsSync(FIXTURE)) { console.error(`Fixture not found: ${FIXTURE}`); process.exit(1); }
const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

// ── Constants the assessment.js context builders depend on (mirror run_test.js) ──
const TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer',
  4: 'The Individualist', 5: 'The Observer', 6: 'The Questioner',
  7: 'The Enthusiast', 8: 'The Protector', 9: 'The Peacemaker',
};
const HIGH_AMBIGUITY_MARGIN = 8;
const STAGE2_BUCKET_LABELS = {
  Hornevian:       { A: 'Assertive',  B: 'Compliant',   C: 'Withdrawn'  },
  Harmonic:        { A: 'Intensity',  B: 'Positive',    C: 'Competency' },
  ObjectRelations: { A: 'Attachment', B: 'Frustration', C: 'Rejection'  },
};

const state = {
  intake:             fixture.intake || {},
  stage0Answers:      fixture.stage0Answers || {},
  stage1TypeOpen:     fixture.stage1TypeOpen || '',
  stage1InstinctOpen: fixture.stage1InstinctOpen || '',
  stage2Answers:      fixture.stage2Answers || [],
  call1Result:        fixture.call1Result || null,
  scores:             fixture.scores,
};
const s = fixture.scores;
if (!state.call1Result) {
  console.error('This fixture has no frozen call1Result. capture_phase1 reuses a frozen Call #1; ' +
                're-mint it via the runner first.'); process.exit(1);
}

// ── Extract the v2 context builders from assessment.js (same approach as run_test) ──
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
  '_evidenceHeaderBlock', '_stage1TypeBlock', '_stage1InstinctBlock', '_stage1OpenBlock',
  '_stage2EvidenceBlock', 'buildContextBlock', 'rankingOverrideInfo', '_call1ResultBlock',
  '_stage3LeanBlock', '_stage4EvidenceBlock', 'buildCall2Context',
];
const moduleCode = `'use strict';
const state                 = global.__hiveEnv.state;
const TYPE_NAMES            = global.__hiveEnv.TYPE_NAMES;
const HIGH_AMBIGUITY_MARGIN = global.__hiveEnv.HIGH_AMBIGUITY_MARGIN;
const STAGE2_BUCKET_LABELS  = global.__hiveEnv.STAGE2_BUCKET_LABELS;
${builderFns.map(extractFn).join('\n\n')}
module.exports = { buildCall2Context };
`;
const tmpMod = path.join(os.tmpdir(), `hive_cap_${fixtureName}.js`);
fs.writeFileSync(tmpMod, moduleCode);
global.__hiveEnv = { state, TYPE_NAMES, HIGH_AMBIGUITY_MARGIN, STAGE2_BUCKET_LABELS };
delete require.cache[tmpMod];
const { buildCall2Context } = require(tmpMod);

// ── HTTP (same auth/POST as run_test.js) ──
const authHeader = require(path.join(__dirname, '..', 'tests', 'lib', 'basic-auth')).basicAuthHeader();
function post(routePath, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost', port: 3000, path: routePath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Authorization': authHeader },
      timeout: 360000,
    }, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(`Parse error ${routePath}: ${e.message}\n${data.slice(0,400)}`)); } });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.write(body); req.end();
  });
}

(async () => {
  const call2Context = buildCall2Context(s);
  console.log(`=== Phase 1 capture — ${fixtureName} ===`);
  console.log(`Call #2 context: ${call2Context.length} chars (~${Math.round(call2Context.length / 4)} tokens)\n`);
  for (const run of [1, 2]) {
    const resp = await post('/api/analyze', { contextBlock: call2Context });
    if (!resp || !resp.ok || !resp.result) {
      throw new Error(`/api/analyze (run ${run}) not-ok: ${JSON.stringify(resp).slice(0, 400)}`);
    }
    const outDir = path.join(ROOT, '.phase1_captures');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, `${fixtureName}_call2_run${run}.json`);
    fs.writeFileSync(out, JSON.stringify(resp.result, null, 2));
    const h = resp.result.hypothesis || {};
    console.log(`[run ${run}] confirmed_type=${h.confirmed_type} instinct=${h.dominant_instinct_hypothesis} → ${out}`);
  }
  console.log('\nDone. Now run: node scripts/verify_phase1_fields.js');
})().catch(e => { console.error('CAPTURE FAILED:', e.message); process.exit(1); });
