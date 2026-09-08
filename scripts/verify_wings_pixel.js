#!/usr/bin/env node
'use strict';
/**
 * IO-75 — the Wings diagram-band pixel baseline.
 *
 * WHY THIS EXISTS, AND WHY IT IS IN PR 5. `buildEnneagramSVG` is a shared primitive that five
 * shipped pages call, and PR 5 Build 2 changes it — a new geometry constant, a new variant, and
 * a widened signature. The built Wings page has never pixel-matched its mockup: measured at
 * 1.9643% on main @ 808174f (docs/audit_pr2_static_pages.md:310), 2.1258% at PR 2, and 2.3433%
 * today. Accept-and-assert was the decision; this is the assertion.
 *
 * ⚠ PR 5 IS THEREFORE ADDING A REGRESSION GATE FOR A PAGE PR 5 DOES NOT BUILD. That is unusual
 * and is named here rather than left for a reader to discover a Wings assertion inside a Quick
 * Reference PR. It lands as Build 2's FIRST commit, before any geometry change, because an
 * assertion added afterwards baselines the post-change value and proves nothing.
 *
 * BAND-SCOPED, NOT WHOLE-PAGE, and the reason is measured. The whole-page figure moved twice —
 * 1.9643 -> 2.1258 -> 2.3433 — and NEITHER change was a geometry change: both were copy rewraps
 * (the U+2011/nowrap hyphenation fix landed a differing band at y=782-789). A page-level
 * threshold is a copy-change detector wearing a geometry costume. The band y=148-370 bounds the
 * diagram exactly: .v3-dia on the built Wings page measures y 148.00-370.00, and the <svg>
 * inside it occupies the same box (docs/plan_pr5_build2.md §4).
 *
 * COUNTING BASIS: differing pixels are those whose max per-channel delta exceeds 8, counted
 * inside the band only, expressed as a percentage OF THE BAND (816 x 222 = 181,152 px) — not of
 * the sheet. The whole-page figure is also printed, informationally, so the two are never
 * confused for each other.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));
const sharp = require(path.join(ROOT, 'app/node_modules/sharp'));

const V3_CLIENT = { first_name: 'Anders', last_name: 'Wennerstrom', organization: 'Hive', date: 'August 2026' };
const COACH = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };
const MOCKUP = path.join(ROOT, 'docs/mockup/claude_The_Peacemaker_Page_Wings_v1.html');

const BAND_TOP = 148, BAND_BOTTOM = 370, SHEET_W = 816, SHEET_H = 1056;
const CHANNEL_DELTA = 8;
// The recorded baseline, and a tolerance. EXACT would be brittle across Chromium patch versions;
// this is tight enough that a geometry change cannot hide inside it — a one-pixel node-radius
// change moves the band figure by far more than 0.15pp (red-proven at build time).
const BAND_BASELINE_PCT = 10.3869;
const BAND_TOLERANCE_PCT = 0.15;

let failed = false;
const fail = (m) => { failed = true; console.log(`  *** FAIL — ${m}`); };

async function shoot(page, out) {
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: SHEET_W, height: SHEET_H }, type: 'png' });
  fs.writeFileSync(out, buf);
  return out;
}

async function diffBand(aPath, bPath) {
  const A = await sharp(aPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(bPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    throw new Error(`size mismatch ${A.info.width}x${A.info.height} vs ${B.info.width}x${B.info.height}`);
  }
  const W = A.info.width;
  let band = 0, whole = 0;
  for (let y = 0; y < A.info.height; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const d = Math.max(Math.abs(A.data[o] - B.data[o]),
                         Math.abs(A.data[o + 1] - B.data[o + 1]),
                         Math.abs(A.data[o + 2] - B.data[o + 2]));
      if (d > CHANNEL_DELTA) { whole++; if (y >= BAND_TOP && y < BAND_BOTTOM) band++; }
    }
  }
  const bandPx = SHEET_W * (BAND_BOTTOM - BAND_TOP);
  return { band, bandPct: (band / bandPx) * 100, whole, wholePct: (whole / (SHEET_W * SHEET_H)) * 100, bandPx };
}

(async () => {
  const outDir = path.join(ROOT, '.phase6_out');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await browserLaunch.launchBrowser();
  console.log(`Chromium: ${await browser.version()}`);
  try {
    const apiResult = require(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json'));
    const model = await prep.buildClientModel({ apiResult, client: V3_CLIENT, coach: COACH });
    const html = R.buildClientReportHTML_v3(model);

    const page = await browser.newPage();
    await page.setViewport({ width: SHEET_W, height: SHEET_H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    // The built Wings sheet, located by V3_PAGE_ORDER rather than by a hard-coded index.
    const wingsIdx = R.v3PagesFor(9).map(p => p.key).indexOf('wings');
    const top = await page.evaluate((i) => Math.round(
      [...document.querySelectorAll('.v3-page')][i].getBoundingClientRect().top + window.scrollY), wingsIdx);
    const builtBuf = await page.screenshot({ clip: { x: 0, y: top, width: SHEET_W, height: SHEET_H }, type: 'png' });
    const builtPath = path.join(outDir, 'io75_built_wings.png');
    fs.writeFileSync(builtPath, builtBuf);
    await page.close();

    const mp = await browser.newPage();
    await mp.setViewport({ width: SHEET_W, height: SHEET_H, deviceScaleFactor: 1 });
    await mp.goto('file://' + MOCKUP, { waitUntil: 'networkidle0' });
    await mp.emulateMediaType('print');
    const mockPath = await shoot(mp, path.join(outDir, 'io75_mockup_wings.png'));
    await mp.close();

    const r = await diffBand(builtPath, mockPath);
    console.log(`\nIO-75 — built Wings vs Wings_v1.html, max-channel delta > ${CHANNEL_DELTA}:`);
    console.log(`  DIAGRAM BAND y=${BAND_TOP}-${BAND_BOTTOM}: ${r.band}/${r.bandPx} = ${r.bandPct.toFixed(4)}%  (baseline ${BAND_BASELINE_PCT}% +/- ${BAND_TOLERANCE_PCT})`);
    console.log(`  whole sheet (informational, NOT the gate): ${r.whole}/${SHEET_W * SHEET_H} = ${r.wholePct.toFixed(4)}%`);
    const delta = Math.abs(r.bandPct - BAND_BASELINE_PCT);
    if (delta > BAND_TOLERANCE_PCT) {
      fail(`diagram band is ${r.bandPct.toFixed(4)}%, baseline ${BAND_BASELINE_PCT}% — moved ${delta.toFixed(4)}pp. `
         + `buildEnneagramSVG changed the Wings figure. If intended, re-record BAND_BASELINE_PCT and say why.`);
    } else {
      console.log(`  ✓ within tolerance (moved ${delta.toFixed(4)}pp)`);
    }
  } finally { await browser.close(); }
  if (failed) { console.log('\nWINGS PIXEL CHECK: FAILURES ABOVE.'); process.exit(1); }
  console.log('\nWINGS PIXEL CHECK: PASSED.');
})().catch(e => { console.error('WINGS PIXEL CHECK FAILED:', e.stack || e.message); process.exit(1); });
