#!/usr/bin/env node
'use strict';
/**
 * Coach report regression gate.
 *
 * The client report v3 rebuild touches modules the coach report shares — renderer.js,
 * report_prep.js, buildEnneagramSVG, partAStyles. Nothing in the test suite asserts on
 * coach output (no test covers SVG markup at all), so without this a client-side change
 * could silently alter what coaches receive and nothing would notice.
 *
 * Two gates, both hard failures:
 *   1. Coach HTML byte-identical. Chromium never touches HTML generation, so this is
 *      deterministic and must hold with no exception, including across a Chromium pin.
 *   2. Normalized coach PDF hash identical — catches rendering regressions that leave the
 *      markup intact and the page heights unchanged, colour above all (see
 *      tests/lib/pdf_normalize.js for why raw byte comparison is impossible).
 *
 * Baselines live in tests/baselines/ as committed text, so a legitimate change to coach
 * output shows up as a reviewable diff in the PR that causes it rather than drifting
 * silently. Refresh them with --update, and only in a PR that intends the change.
 *
 *   node scripts/verify_coach_baseline.js            # verify (CI)
 *   node scripts/verify_coach_baseline.js --update   # re-record
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));
const { pdfHash, htmlHash } = require(path.join(ROOT, 'tests/lib/pdf_normalize.js'));

const BASELINE_DIR = path.join(ROOT, 'tests/baselines');
const FIXTURES = ['sp4', 'sx7'];
const CLIENT = { first_name: 'Test', last_name: 'Client', organization: 'Acme Co', date: 'June 2026' };
const COACH = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };

const update = process.argv.includes('--update');
let failed = false;
const fail = (m) => { failed = true; console.log(`  *** FAIL — ${m}`); };

(async () => {
  if (!fs.existsSync(BASELINE_DIR)) fs.mkdirSync(BASELINE_DIR, { recursive: true });
  const browser = await browserLaunch.launchBrowser();
  console.log(`Chromium: ${await browser.version()}`);

  try {
    for (const fx of FIXTURES) {
      const apiResult = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));
      const html = R.buildCoachReportHTML(await prep.buildCoachModel({ apiResult, client: CLIENT, coach: COACH }));

      const page = await browser.newPage();
      await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('print');
      try { await browserLaunch.assertReportFont(page); } catch (e) { fail(e.message); }
      const pdf = await page.pdf(R.buildCoachPdfOptions());
      await page.close();

      const htmlPath = path.join(BASELINE_DIR, `coach_${fx}.html`);
      const hashPath = path.join(BASELINE_DIR, `coach_${fx}.pdf.sha256`);
      const ph = pdfHash(pdf);

      if (update) {
        fs.writeFileSync(htmlPath, html);
        fs.writeFileSync(hashPath, ph + '\n');
        console.log(`  ${fx}: recorded (html ${htmlHash(html).slice(0, 12)}… · pdf ${ph.slice(0, 12)}…)`);
        continue;
      }

      if (!fs.existsSync(htmlPath) || !fs.existsSync(hashPath)) {
        fail(`${fx}: no baseline recorded. Run with --update to create one.`);
        continue;
      }
      const wantHtml = fs.readFileSync(htmlPath, 'utf8');
      if (html !== wantHtml) {
        fail(`${fx}: coach HTML changed (baseline ${htmlHash(wantHtml).slice(0, 12)}… , got ${htmlHash(html).slice(0, 12)}…). `
          + 'A client-side change reached shared code. If intended, re-record with --update and review the diff.');
      } else {
        console.log(`  ${fx}: HTML byte-identical ✓`);
      }
      const wantPdf = fs.readFileSync(hashPath, 'utf8').trim();
      if (ph !== wantPdf) {
        fail(`${fx}: coach PDF changed (baseline ${wantPdf.slice(0, 12)}… , got ${ph.slice(0, 12)}…). `
          + 'Rendering differs even though markup may not — check colour, fonts and Chromium version.');
      } else {
        console.log(`  ${fx}: normalized PDF hash identical ✓`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failed) { console.log('\nCOACH BASELINE: FAILURES ABOVE.'); process.exit(1); }
  console.log(update ? '\nCOACH BASELINE: recorded.' : '\nCOACH BASELINE: ALL PASSED.');
})().catch(e => { console.error('COACH BASELINE FAILED:', e.stack || e.message); process.exit(1); });
