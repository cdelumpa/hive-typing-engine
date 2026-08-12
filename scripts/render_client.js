'use strict';

/**
 * render_client.js — report layout verification (offline, no API key, no DB).
 *
 * For sp4/sx7: api_result fixture + synthetic client/coach → report_prep →
 * renderer → PDF, for BOTH the client and coach reports. Flowing layout (no
 * measurement gate): renders straight, then measures each page's rendered height.
 * Writes HTML + PDF per report to .phase6_out/ (gitignored).
 *
 * Failure (process exits non-zero) on any of:
 *   - a builder or render throwing;
 *   - wrong logical page count (client 10, coach 3);
 *   - CLIENT page spill past one physical sheet (1056px @96dpi) — the client
 *     report is a hard one-sheet-per-page contract.
 * Coach `.report-page` is min-height:1056 and flows by design, so coach spill is
 * reported for visibility but is NOT a failure.
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

// Per report kind: how to build it, which page containers to measure, how many to
// expect, and whether page spill past one sheet is a failure (client only).
// Client uses .cover (Title/TOC/Welcome), .page (P2), and .pN-page (P3–P8) — the
// legacy .report-page selector no longer matches any client page. Coach uses
// .report-page ×3.
const REPORTS = {
  client: {
    build: async (apiResult) => R.buildClientReportHTML(await prep.buildClientModel({ apiResult, client, coach })),
    selector: '.cover, .page, .p3-page, .p4-page, .p5-page, .p6-page, .p7-page, .p8-page',
    expected: 10,
    enforceSheet: true,
    labels: ['Title', 'TOC', 'P1 Welcome', 'P2 Primer', 'P3 Hypotheses', 'P4 Patterns',
      'P5 Wings/Lines', 'P6 Instinct', 'P7 Strengths', 'P8 Application'],
  },
  coach: {
    build: async (apiResult) => R.buildCoachReportHTML(await prep.buildCoachModel({ apiResult, client, coach })),
    selector: '.report-page',
    expected: 3,
    enforceSheet: false,
    labels: ['Coach P1', 'Coach P2', 'Coach P3'],
  },
};

// Pinned bundled Chromium via the shared launcher — same engine as production and CI.
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));
async function launch() { return browserLaunch.launchBrowser(); }

// Measure each page container's rendered height + physical-sheet count under flowing layout.
async function measureLayout(page, selector) {
  await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 150));
  return page.evaluate((PAGE_PX, selector) => {
    return [...document.querySelectorAll(selector)].map((el, i) => {
      const h = el.getBoundingClientRect().height;
      return { index: i, height: Math.round(h), sheets: Math.max(1, Math.ceil(h / (PAGE_PX + 1))) };
    });
  }, PAGE_PX, selector);
}

(async () => {
  const browser = await launch();
  let failed = false;
  const fail = (msg) => { failed = true; console.log(`  *** FAIL — ${msg}`); };
  try {
    for (const fx of ['sp4', 'sx7']) {
      const apiResult = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));
      for (const [kind, cfg] of Object.entries(REPORTS)) {
        console.log(`\n=== ${fx} · ${kind} ===`);
        let html;
        try {
          html = await cfg.build(apiResult);
        } catch (e) {
          fail(`${kind} build threw: ${e.message}`);
          continue;
        }
        fs.writeFileSync(path.join(OUT, `${kind}_${fx}.html`), html);

        const page = await browser.newPage();
        await page.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.emulateMediaType('print');
        const pages = await measureLayout(page, cfg.selector);
        let sheets = 0;
        for (const p of pages) {
          sheets += p.sheets;
          const spill = p.height > PAGE_PX + 1 ? `  *** SPILL → ${p.sheets} sheets` : '';
          console.log(`  ${(cfg.labels[p.index] || 'page ' + p.index).padEnd(16)} ${p.height}px${spill}`);
          if (cfg.enforceSheet && p.height > PAGE_PX + 1) {
            fail(`${kind} ${cfg.labels[p.index] || 'page ' + p.index} spills to ${p.sheets} sheets (${p.height}px > ${PAGE_PX}px)`);
          }
        }
        if (pages.length !== cfg.expected) {
          fail(`${kind} page count ${pages.length}, expected ${cfg.expected}`);
        }
        await page.pdf({ path: path.join(OUT, `${kind}_${fx}.pdf`), ...R.buildCoachPdfOptions() });
        await page.close();
        console.log(`  logical pages: ${pages.length} · estimated physical sheets: ${sheets} · wrote .phase6_out/${kind}_${fx}.pdf`);
      }
    }
  } finally { await browser.close(); }
  if (failed) { console.log('\nRENDER CHECK: FAILURES ABOVE.'); process.exit(1); }
  console.log('\nRENDER CHECK: ALL PASSED.');
})().catch(e => { console.error('RENDER FAILED:', e.stack || e.message); process.exit(1); });
