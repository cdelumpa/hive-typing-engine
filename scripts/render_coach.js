'use strict';

/**
 * render_coach.js — coach report verification (offline, no API key).
 *
 * For sp4/sx7: committed api_result fixture + synthetic client/coach → buildCoachModel
 * → buildCoachReportHTML → PDF. Flowing layout (no measurement gate): renders straight,
 * then measures each .report-page's rendered height to flag any page that spills past one
 * physical sheet (1056px @96dpi), plus a page-1 .bc-grid diagnostic (the height:100% flex
 * edge case). Writes HTML + PDF to .phase5_out/ (gitignored).
 *
 * USAGE: node scripts/render_coach.js
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));

const PAGE_PX = 1056; // US Letter 11in @96dpi
const OUT = path.join(ROOT, '.phase5_out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const client = { first_name: 'Test', last_name: 'Client', organization: 'Acme Co', date: 'June 2026' };
const coach = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };

async function launch() {
  const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));
  return browserLaunch.launchBrowser();
}

async function measureLayout(page) {
  await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 150));
  return page.evaluate((PAGE_PX) => {
    const pages = [...document.querySelectorAll('.report-page')].map((el, i) => {
      const h = el.getBoundingClientRect().height;
      return { index: i, height: Math.round(h), sheets: Math.max(1, Math.ceil(h / (PAGE_PX + 1))) };
    });
    // Page-1 .bc-grid diagnostic: confirm the height:100% grid filled its flex page-body
    // and the right column (svg + bar charts) rendered with real height.
    const grid = document.querySelector('.bc-grid');
    const body = grid && grid.closest('.page-body');
    const right = document.querySelector('.bc-right');
    const bars = document.querySelectorAll('.bc-right svg').length;
    const bcGrid = grid ? {
      gridHeight: Math.round(grid.getBoundingClientRect().height),
      bodyHeight: body ? Math.round(body.getBoundingClientRect().height) : null,
      rightHeight: right ? Math.round(right.getBoundingClientRect().height) : null,
      rightCharts: bars,
    } : null;
    return { pages, bcGrid };
  }, PAGE_PX);
}

(async () => {
  await require(path.join(ROOT, 'scripts/lib/override_banner.js')).printOverrideBanner();
  const browser = await launch();
  try {
    for (const fx of ['sp4', 'sx7']) {
      console.log(`\n=== ${fx} ===`);
      const apiResult = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));
      const model = await prep.buildCoachModel({ apiResult, client, coach });
      if (model._flags && model._flags.length) console.log('  prep flags:', model._flags.join('; '));
      if (model._warnings && model._warnings.length) console.log('  prep warnings:', model._warnings.join('; '));

      const html = R.buildCoachReportHTML(model);
      fs.writeFileSync(path.join(OUT, `coach_${fx}.html`), html);

      const page = await browser.newPage();
      await page.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('print');
      const { pages, bcGrid } = await measureLayout(page);
      const labels = ['P1 Orientation', 'P2 Comparison', 'P3 Debrief'];
      let sheets = 0;
      for (const p of pages) {
        sheets += p.sheets;
        const spill = p.height > PAGE_PX + 1 ? `  *** SPILL → ${p.sheets} sheets` : '';
        console.log(`  ${(labels[p.index] || 'page ' + p.index).padEnd(15)} ${p.height}px${spill}`);
      }
      if (bcGrid) {
        const filled = bcGrid.bodyHeight && Math.abs(bcGrid.gridHeight - bcGrid.bodyHeight) <= 2;
        console.log(`  .bc-grid: grid=${bcGrid.gridHeight}px body=${bcGrid.bodyHeight}px right=${bcGrid.rightHeight}px charts=${bcGrid.rightCharts}` +
          `  [${filled ? 'FILLED ok' : 'grid≠body — eyeball'}]`);
      }
      await page.pdf({ path: path.join(OUT, `coach_${fx}.pdf`), ...R.buildCoachPdfOptions() });
      await page.close();
      console.log(`  logical pages: ${pages.length} · estimated physical sheets: ${sheets} · wrote .phase5_out/coach_${fx}.pdf`);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error('RENDER FAILED:', e.stack || e.message); process.exit(1); });
