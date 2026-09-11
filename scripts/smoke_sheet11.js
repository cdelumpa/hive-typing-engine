'use strict';
/**
 * smoke_sheet11.js — the visual smoke sheet for sheet 11, Development Ideas (PR 6 Build B1).
 *
 *   node scripts/smoke_sheet11.js            → docs/pr6_smoke/
 *
 * Full-page renders of sheet 11 for all nine types, at 2× device scale, through the REAL document
 * builder — the same buildClientModel → buildClientReportHTML_v3 path CI measures — plus one Type 9
 * render with the long-name fixture (the D-B2 reserve), and a contact sheet of the nine.
 *
 * Earlier smoke sheets in this repo were made ad hoc and could not be regenerated. This one is a
 * script so any commit that touches the page can re-run it and the images stay current. It measures
 * as it renders, with the same probe CI uses, and prints the table the README carries.
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
const DF = require(path.join(ROOT, 'app/devideas_fit.js'));
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));
const { retypeFixture } = require(path.join(ROOT, 'scripts/lib/retype_fixture.js'));

const OUT = path.join(ROOT, 'docs/pr6_smoke');
const CLIENT = { first_name: 'Anders', last_name: 'Wennerstrom', organization: 'Hive', date: 'August 2026' };
const COACH = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const fixture = require(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json'));
  const browser = await browserLaunch.launchBrowser();
  const rows = [];
  try {
    const shoot = async (type, client, file) => {
      const page = await browser.newPage();
      await page.setViewport({ width: 816, height: DF.PAGE_PX, deviceScaleFactor: 2 });
      const m = await prep.buildClientModel({ apiResult: retypeFixture(fixture, type), client, coach: COACH });
      await page.setContent(R.buildClientReportHTML_v3(m), { waitUntil: 'networkidle0' });
      await page.emulateMediaType('print');
      await browserLaunch.assertReportFont(page);
      await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
      const p = await page.evaluate(DF.PROBE, DF.SHEET_SEL);
      await (await page.$(DF.SHEET_SEL)).screenshot({ path: path.join(OUT, file) });
      await page.close();
      return p;
    };
    for (let t = 1; t <= 9; t++) {
      const p = await shoot(t, CLIENT, `sheet11_type${t}.png`);
      rows.push({ t, natural: p.natural, lines: p.cards.map((c) => c.lines).join('/'), items: p.cards.map((c) => c.items.length).join('/') });
    }
    const long = await shoot(9, { ...DF.LONG_NAME, organization: 'Hive', date: 'August 2026' }, 'sheet11_type9_long_name.png');

    // The contact sheet: the nine full-page PNGs side by side, labelled with what CI measured.
    const page = await browser.newPage();
    await page.setViewport({ width: 2520, height: 3300, deviceScaleFactor: 1 });
    const cells = rows.map((r) => `<div><div style="display:flex;justify-content:space-between;font:600 15px Arial;margin:0 0 6px">`
      + `<span>Type ${r.t}</span><span style="font-weight:400;color:#4A5568">${(DF.PAGE_PX - r.natural).toFixed(2)}px free · ${r.lines} lines · ${r.items} items</span></div>`
      + `<img src="data:image/png;base64,${fs.readFileSync(path.join(OUT, `sheet11_type${r.t}.png`)).toString('base64')}" style="width:816px;display:block;box-shadow:0 0 0 1px #C8D0D9"></div>`).join('');
    await page.setContent(`<body style="margin:0;background:#E9EDF1"><div style="display:grid;grid-template-columns:repeat(3,816px);gap:26px;padding:26px">${cells}</div></body>`, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(OUT, 'sheet11_contact_sheet.png'), fullPage: true });
    await page.close();

    console.log('| Type | Natural px | Free px | Lines G/I/E | Items G/I/E |');
    console.log('|---|---|---|---|---|');
    for (const r of rows) console.log(`| ${r.t} | ${r.natural.toFixed(2)} | ${(DF.PAGE_PX - r.natural).toFixed(2)} | ${r.lines} | ${r.items} |`);
    console.log(`\nType 9, long-name fixture: header ${long.headerLines} lines · ${long.natural.toFixed(2)}px · ${(DF.PAGE_PX - long.natural).toFixed(2)}px free`);
    console.log(`\nwrote ${fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length} PNGs to ${path.relative(ROOT, OUT)}/`);
  } finally { await browser.close(); }
})().catch((e) => { console.error('SMOKE FAILED:', e.stack || e.message); process.exit(1); });
