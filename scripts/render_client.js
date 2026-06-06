'use strict';

/**
 * render_client.js — Step 7 Phase 6a verification (offline, no API key).
 *
 * For sp4/sx7: api_result fixture + synthetic client/coach → buildClientModel →
 * buildClientReportHTML → measureReport (HARD GATE across all 10 pages) → PDF.
 * Halts (no PDF) on any zone overflow. Writes HTML + PDF to .phase6_out/ (gitignored).
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
const { measureReport } = require(path.join(ROOT, 'app/measure.js'));

const OUT = path.join(ROOT, '.phase6_out');
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
    await page.pdf({ path: file, ...R.buildCoachPdfOptions() }); // shared US Letter options
  } finally { await browser.close(); }
}

(async () => {
  let failures = 0;
  for (const fx of ['sp4', 'sx7']) {
    console.log(`\n=== ${fx} ===`);
    const apiResult = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));
    const model = prep.buildClientModel({ apiResult, client, coach });
    if (model._flags && model._flags.length) console.log('  prep flags:', model._flags.join('; '));

    const html = R.buildClientReportHTML(model);
    fs.writeFileSync(path.join(OUT, `client_${fx}.html`), html);

    const gate = await measureReport(html);
    console.log('  page measurements:');
    for (const z of gate.zones.filter(z => z.kind === 'overflow')) {
      console.log(`    ${z.overflow ? '*** OVER' : 'ok '}  page ${z.page}: ${z.measured}px / ${Math.round(z.budget)}px`);
    }
    if (!gate.pass) {
      failures++;
      console.log(`  HARD GATE FAILED — ${gate.violations.length} zone(s) over budget. PDF NOT generated.`);
      continue;
    }
    await generatePDF(html, path.join(OUT, `client_${fx}.pdf`));
    console.log(`  HARD GATE PASSED — wrote .phase6_out/client_${fx}.pdf`);
  }
  console.log('');
  if (failures) { console.log(`RESULT: ${failures} fixture(s) failed the measurement gate.`); process.exit(1); }
  console.log('RESULT: ALL CLIENT REPORTS PASSED THE MEASUREMENT GATE.');
})().catch(e => { console.error('RENDER FAILED:', e.stack || e.message); process.exit(1); });
