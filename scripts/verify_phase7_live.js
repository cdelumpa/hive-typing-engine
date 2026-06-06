'use strict';

/**
 * verify_phase7_live.js — Step 7 Phase 7a verification (offline, no API key).
 *
 * Exercises app/render_report.js (the live-path orchestrator + measurement-gate
 * self-heal) the way generateReportPDFs will use it:
 *   1. sp4/sx7 fixtures → coach + client reports pass at tighten=0 (green first try).
 *   2. Injected-overlong field → self-heal tightens and recovers (tighten>0).
 *   3. Absurdly-overlong field → GateExhaustedError (halt; no PDF).
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { renderCoachReport, renderClientReport, GateExhaustedError } = require(path.join(ROOT, 'app/render_report.js'));

const client = { first_name: 'Test', last_name: 'Client', organization: 'Acme Co', date: 'June 2026' };
const coach = { full_name: 'Cai Delumpa', type: null, instinct: null };
const load = (fx) => JSON.parse(JSON.stringify(require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`))));

let failures = 0;
const check = (label, cond) => { console.log(`  ${cond ? 'PASS' : '*** FAIL'} — ${label}`); if (!cond) failures++; };
const words = (n, w = 'lorem') => Array(n).fill(w).join(' ');

(async () => {
  console.log('CASE 1 — fixtures pass at tighten=0:');
  for (const fx of ['sp4', 'sx7']) {
    const apiResult = load(fx);
    const cr = await renderCoachReport({ apiResult, client, coach });
    const cl = await renderClientReport({ apiResult, client, coach });
    check(`${fx} coach report pass @ tighten=${cr.tighten}`, cr.gate.pass && cr.tighten === 0);
    check(`${fx} client report pass @ tighten=${cl.tighten}`, cl.gate.pass && cl.tighten === 0);
  }

  console.log('\nCASE 2 — injected-overlong bottom_line → self-heal recovers (tighten>0):');
  {
    const apiResult = load('sp4');
    apiResult.coach_report.bottom_line = words(230);  // ~230 words overflows P1 at tighten=0
    const cr = await renderCoachReport({ apiResult, client, coach });
    check(`coach report recovered @ tighten=${cr.tighten} (>0)`, cr.gate.pass && cr.tighten > 0);
  }

  console.log('\nCASE 3 — absurdly-overlong bottom_line → GateExhaustedError (halt):');
  {
    const apiResult = load('sp4');
    apiResult.coach_report.bottom_line = words(4000);
    let threw = null;
    try { await renderCoachReport({ apiResult, client, coach }); }
    catch (e) { threw = e; }
    check('threw GateExhaustedError', threw instanceof GateExhaustedError);
    check('error names the kind + violations', !!threw && threw.kind === 'coach' && threw.violations.length >= 1);
  }

  console.log('');
  if (failures) { console.log(`RESULT: ${failures} FAILURE(S)`); process.exit(1); }
  console.log('RESULT: ALL PHASE 7a CHECKS PASSED.');
})().catch(e => { console.error('HARNESS ERROR:', e.stack || e.message); process.exit(1); });
