'use strict';

/**
 * verify_phase7_live.js — render smoke-check (offline, no API key).
 *
 * Exercises app/render_report.js the way generateReportPDFs uses it: for the sp4/sx7
 * fixtures, both the coach and client reports must render to non-empty HTML. Flowing
 * layout removed the measurement gate + self-heal, so the former CASE 2 (tighten self-heal)
 * and CASE 3 (GateExhaustedError halt) cases no longer apply and were dropped.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { renderCoachReport, renderClientReport } = require(path.join(ROOT, 'app/render_report.js'));

const client = { first_name: 'Test', last_name: 'Client', organization: 'Acme Co', date: 'June 2026' };
const coach = { full_name: 'Cai Delumpa', type: null, instinct: null };
const load = (fx) => JSON.parse(JSON.stringify(require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`))));

let failures = 0;
const check = (label, cond) => { console.log(`  ${cond ? 'PASS' : '*** FAIL'} — ${label}`); if (!cond) failures++; };
const renders = (r) => typeof r.html === 'string' && r.html.length > 0;
const pageCount = (r) => (r.html.match(/class="report-page/g) || []).length;

(async () => {
  console.log('Both reports render (non-empty HTML) for sp4/sx7:');
  for (const fx of ['sp4', 'sx7']) {
    const apiResult = load(fx);
    const cr = await renderCoachReport({ apiResult, client, coach });
    const cl = await renderClientReport({ apiResult, client, coach });
    check(`${fx} coach report renders (${pageCount(cr)} pages)`, renders(cr));
    check(`${fx} client report renders (${pageCount(cl)} pages)`, renders(cl));
  }

  console.log('');
  if (failures) { console.log(`RESULT: ${failures} FAILURE(S)`); process.exit(1); }
  console.log('RESULT: ALL RENDER CHECKS PASSED.');
})();
