'use strict';

/**
 * render_coach.js — Step 7 Phase 5 verification (offline, no API key).
 *
 * For sp4/sx7: committed api_result fixture + synthetic client/coach → buildCoachModel
 * → buildCoachReportHTML → measureReport (HARD GATE) → PDF. Halts loudly (no PDF) if any
 * zone overflows. Writes HTML + PDF to .phase5_out/ (gitignored) for inspection.
 *
 * USAGE: node scripts/render_coach.js
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
const { measureReport } = require(path.join(ROOT, 'app/measure.js'));

const OUT = path.join(ROOT, '.phase5_out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const client = { first_name: 'Test', last_name: 'Client', organization: 'Acme Co', date: 'June 2026' };
const coach = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };

async function generatePDF(html, file) {
  const puppeteerCore = require(path.join(ROOT, 'app/node_modules/puppeteer-core'));
  const browser = await puppeteerCore.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    await page.pdf({ path: file, ...R.buildCoachPdfOptions() });
  } finally { await browser.close(); }
}

(async () => {
  let failures = 0;
  for (const fx of ['sp4', 'sx7']) {
    console.log(`\n=== ${fx} ===`);
    const apiResult = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));
    const model = prep.buildCoachModel({ apiResult, client, coach });
    if (model._flags && model._flags.length) console.log('  prep flags:', model._flags.join('; '));
    if (model._warnings && model._warnings.length) console.log('  prep warnings:', model._warnings.join('; '));

    const html = R.buildCoachReportHTML(model);
    const htmlPath = path.join(OUT, `coach_${fx}.html`);
    fs.writeFileSync(htmlPath, html);

    const gate = await measureReport(html);
    console.log('  zone measurements:');
    for (const z of gate.zones) {
      const tag = z.overflow ? '*** OVER' : 'ok ';
      console.log(`    ${tag}  [${z.kind}] ${z.zone}${z.page ? ' (p' + z.page + ')' : ''}: ${z.measured}px / budget ${Math.round(z.budget)}px`);
    }
    if (!gate.pass) {
      failures++;
      console.log(`  HARD GATE FAILED — ${gate.violations.length} zone(s) over budget. PDF NOT generated (halt; regeneration deferred to Phase 7).`);
      continue;
    }
    await generatePDF(html, path.join(OUT, `coach_${fx}.pdf`));
    console.log(`  HARD GATE PASSED — wrote ${path.relative(ROOT, path.join(OUT, `coach_${fx}.pdf`))} + ${path.relative(ROOT, htmlPath)}`);
  }
  console.log('');
  if (failures) { console.log(`RESULT: ${failures} fixture(s) failed the measurement gate.`); process.exit(1); }
  console.log('RESULT: ALL COACH REPORTS PASSED THE MEASUREMENT GATE.');
})().catch(e => { console.error('RENDER FAILED:', e.stack || e.message); process.exit(1); });
