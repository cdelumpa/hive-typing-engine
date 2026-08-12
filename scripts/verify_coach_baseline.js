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
 * Two gates, with DIFFERENT reach — this split is the fix landed 12 Aug 2026:
 *   1. Coach HTML byte-identical. Chromium never touches HTML generation, so this is
 *      deterministic and platform-independent. Runs EVERYWHERE, no exceptions.
 *   2. Normalized coach PDF hash identical — catches rendering regressions that leave the
 *      markup intact and the page heights unchanged, colour above all. Runs ONLY where the
 *      font environment matches production (Linux). SKIPPED elsewhere, loudly.
 *
 * WHY THE PDF HALF IS PLATFORM-GATED
 * ----------------------------------
 * This gate had never passed in CI. Every run since it was created was red, on every branch
 * including main, and five PRs merged underneath it while their reports cited "coach
 * byte-identical, both fixtures" as evidence. That claim was true — and local, single-machine
 * and macOS-only. The automated signal said the opposite the whole time.
 *
 * The cause is not a bug in the renderer. macOS has genuine Arial; Linux has Liberation Sans.
 * They are metric-compatible, so line breaks, page heights and the emitted HTML are all
 * identical — which is exactly why the HTML half passes on both. But the PDFs cannot match:
 *
 *   - Text is written as GLYPH IDS, not characters: the content streams contain `<002C> Tj`,
 *     and glyph IDs are internal to a font. Two metric-compatible fonts assign different IDs
 *     to the same character, so THE CONTENT STREAM BYTES THEMSELVES DIFFER.
 *   - Measured on the coach PDF: font programs are 71.5% of the file (260,602 of 364,668
 *     bytes), plus 40 /FontDescriptor dicts carrying platform-specific metrics, 20 CIDFont /W
 *     arrays keyed by glyph ID, and 40 /BaseFont names.
 *
 * So normalization cannot fix this. To make the hash platform-stable you would have to strip
 * every font object AND decode the glyph IDs in every content stream back to text through the
 * ToUnicode CMap — i.e. write a PDF text extractor and hash a reconstruction of the document
 * rather than the document. What survived would no longer be the artifact clients receive.
 *
 * The alternative is PR 1's precedent: pin the environment rather than teach the comparison
 * to ignore differences. PR 1 did not normalize away the Chromium version split, it pinned
 * the version. The same logic here says compare PDFs only where the fonts match production.
 * Baselines are therefore recorded on Linux and asserted on Linux.
 *
 * WHAT THIS GATE CAN AND CANNOT SEE AFTERWARDS
 *   CAN, everywhere        — any change to generated markup or content (the HTML half).
 *   CAN, in CI only        — colour, layout and rendering regressions (the PDF half), in the
 *                            environment that matches production.
 *   CANNOT, on a developer machine — PDF-level regressions before push. That feedback moves
 *                            from a ~15s local run to a ~2min CI run. Accepted: a signal that
 *                            is available instantly and wrong is worth less than one that
 *                            arrives on push and is right.
 *
 * Baselines live in tests/baselines/ as committed text, so a legitimate change to coach
 * output shows up as a reviewable diff in the PR that causes it rather than drifting
 * silently. Refresh them with --update, and only in a PR that intends the change.
 *
 *   node scripts/verify_coach_baseline.js            # verify (CI)
 *   node scripts/verify_coach_baseline.js --update   # re-record (PDF half: Linux only)
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

// The PDF half is only meaningful where the embedded fonts match production. Production and
// CI are Linux + Liberation Sans; a developer machine is typically macOS + genuine Arial.
// Comparing across those is not a weaker check, it is a check of a different document.
const PDF_COMPARABLE = process.platform === 'linux';
const PDF_SKIP_REASON = `platform is ${process.platform}, not linux — the embedded fonts differ from production`;

/** Font families embedded in a PDF. The diagnostic that would have caught this months ago. */
function embeddedFonts(buf) {
  const s = Buffer.isBuffer(buf) ? buf.toString('latin1') : Buffer.from(buf).toString('latin1');
  return [...new Set([...s.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+\-]+)/g)]
    .map(m => m[1].replace(/^[A-Z]{6}\+/, '')))].sort();
}
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
        if (PDF_COMPARABLE) {
          fs.writeFileSync(hashPath, ph + '\n');
          console.log(`  ${fx}: recorded (html ${htmlHash(html).slice(0, 12)}… · pdf ${ph.slice(0, 12)}…)`);
        } else {
          // Recording a macOS hash is what created the permanently-red gate. Refuse, rather
          // than write a baseline that can never be satisfied where it is asserted.
          console.log(`  ${fx}: recorded HTML only — PDF baseline NOT written (${PDF_SKIP_REASON}).`);
          console.log(`  ${fx}: to record it, run this on Linux (CI) and commit the printed hash.`);
        }
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
      console.log(`  ${fx}: embedded fonts — ${embeddedFonts(pdf).join(', ')}`);

      if (!PDF_COMPARABLE) {
        console.log(`  ${fx}: normalized PDF hash SKIPPED (${PDF_SKIP_REASON})`);
        console.log(`  ${fx}: this run's hash ${ph} (informational — not compared)`);
        continue;
      }
      const wantPdf = fs.readFileSync(hashPath, 'utf8').trim();
      if (ph !== wantPdf) {
        // Full hashes, not truncated: a truncated hash cannot be pasted into a baseline file,
        // which is what made re-recording from a CI log impossible before.
        fail(`${fx}: coach PDF changed\n`
          + `        baseline ${wantPdf}\n`
          + `        current  ${ph}\n`
          + '        Rendering differs even though markup may not — check colour and Chromium version.');
      } else {
        console.log(`  ${fx}: normalized PDF hash identical ✓`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failed) { console.log('\nCOACH BASELINE: FAILURES ABOVE.'); process.exit(1); }
  const scope = PDF_COMPARABLE ? 'HTML + normalized PDF' : 'HTML only (PDF half skipped off-Linux)';
  console.log(update ? `\nCOACH BASELINE: recorded — ${scope}.` : `\nCOACH BASELINE: ALL PASSED — ${scope}.`);
})().catch(e => { console.error('COACH BASELINE FAILED:', e.stack || e.message); process.exit(1); });
