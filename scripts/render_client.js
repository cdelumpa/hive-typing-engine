'use strict';

/**
 * render_client.js — client report verification (offline, no API key).
 *
 * For sp4/sx7: api_result fixture + synthetic client/coach → buildClientModel →
 * buildClientReportHTML → PDF. Flowing layout (no measurement gate): renders straight,
 * then measures each .report-page's rendered height to flag any page that spills past
 * one physical sheet (1056px @96dpi). Writes HTML + PDF to .phase6_out/ (gitignored).
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));

const PAGE_PX = 1056; // US Letter 11in @96dpi
const OUT = path.join(ROOT, '.phase6_out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const client = { first_name: 'Test', last_name: 'Client', organization: 'Acme Co', date: 'June 2026' };
const coach = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };

async function launch() {
  const puppeteerCore = require(path.join(ROOT, 'app/node_modules/puppeteer-core'));
  return puppeteerCore.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

// Measure each .report-page's rendered height + physical-sheet count under flowing layout.
async function measureLayout(page) {
  await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 150));
  return page.evaluate((PAGE_PX) => {
    return [...document.querySelectorAll('.report-page')].map((el, i) => {
      const h = el.getBoundingClientRect().height;
      return { index: i, height: Math.round(h), sheets: Math.max(1, Math.ceil(h / (PAGE_PX + 1))) };
    });
  }, PAGE_PX);
}

(async () => {
  const browser = await launch();
  try {
    for (const fx of ['sp4', 'sx7']) {
      console.log(`\n=== ${fx} ===`);
      const apiResult = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));
      const model = prep.buildClientModel({ apiResult, client, coach });
      if (model._flags && model._flags.length) console.log('  prep flags:', model._flags.join('; '));

      const html = R.buildClientReportHTML(model);
      fs.writeFileSync(path.join(OUT, `client_${fx}.html`), html);

      const page = await browser.newPage();
      await page.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('print');
      const pages = await measureLayout(page);
      const labels = ['Title', 'TOC', 'P1 Welcome', 'P2 Primer', 'P3 Hypotheses', 'P4 Patterns',
        'P5 Wings/Lines', 'P6 Instinct', 'P7 Strengths', 'P8 Application'];
      let sheets = 0;
      for (const p of pages) {
        sheets += p.sheets;
        const spill = p.height > PAGE_PX + 1 ? `  *** SPILL → ${p.sheets} sheets` : '';
        console.log(`  ${(labels[p.index] || 'page ' + p.index).padEnd(16)} ${p.height}px${spill}`);
      }
      await page.pdf({ path: path.join(OUT, `client_${fx}.pdf`), ...R.buildCoachPdfOptions() });
      await page.close();
      console.log(`  logical pages: ${pages.length} · estimated physical sheets: ${sheets} · wrote .phase6_out/client_${fx}.pdf`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error('RENDER FAILED:', e.stack || e.message); process.exit(1); });
