#!/usr/bin/env node
'use strict';
/**
 * Transparency gate for the client report PDF.
 *
 * WHY THIS EXISTS (PR 2, client report v3)
 * ----------------------------------------
 * Design spec v3.0 section 3.2 states a document-wide invariant: no `transparent` keyword
 * and no rgba() in any CSS that reaches the PDF. In CSS `transparent` is rgba(0,0,0,0), and
 * Chromium emits a transparency group with soft masks for any element using it. Some PDF
 * viewers render that path with a colour cast — the cover page displayed PINK instead of
 * blue in one preview client while rendering correctly in others. Terminating the cover
 * gradient on an opaque colour took it from 14 shading objects / 6 transparency groups /
 * 3 soft masks down to 0 groups / 0 masks.
 *
 * That invariant had never been enforced. Before this script, `report-verify.yml` ran five
 * gates and not one of them looked inside the emitted PDF; the build plan listed the check
 * as "becomes load-bearing at PR 5" and it was never built. PR 2 lands the cover — the one
 * page the bug actually manifested on — so the gate lands with it.
 *
 * This is not theoretical. The tracked Quick Reference mockup
 * (docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html) carries fill-opacity on all
 * nine heat-map nodes plus a stop-opacity gradient, and rendering it produces 1 transparency
 * group, 1 soft mask and 8 non-opaque alphas. When PR 5 ports that page, anyone who copies
 * the SVG verbatim is stopped here rather than in a client's PDF viewer.
 *
 * WHAT IT CHECKS
 * --------------
 *   /Group << /S /Transparency >>   transparency groups
 *   /SMask  (anything but /None)    soft masks
 *   /ca or /CA < 1                  constant alpha
 *   /BM not Normal|Compatible       blend modes
 *
 * Object streams (/Type /ObjStm) are inflated before scanning, so nothing hides inside a
 * compressed stream.
 *
 * SELF-TEST: run with --self-test to render a deliberately BAD page (the cover with its
 * gradient terminated on `transparent` and an rgba() panel) and assert the scanner FINDS
 * the violations. A detector that always returns zero would pass every real check while
 * proving nothing, so the positive control runs in CI alongside the real assertion.
 *
 *   node scripts/verify_transparency.js              # gate (CI)
 *   node scripts/verify_transparency.js --self-test  # positive control only
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));

const V3_CLIENT = { first_name: 'Anders', last_name: 'Wennerstrom', organization: 'Hive', date: 'August 2026' };
const COACH = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };
const FIXTURE = 'anders_sx9';

let failed = false;
const fail = (m) => { failed = true; console.log(`  *** FAIL — ${m}`); };

/**
 * Scannable text: the whole file, PLUS every stream that inflates.
 *
 * Deliberately NOT reassembled object-by-object. An earlier version of this script split
 * the file on `obj`/`endobj` and scanned only the reconstructed bodies; the self-test
 * caught it finding zero transparency in a page that demonstrably had it, because those
 * tokens also occur inside binary stream data and the non-greedy split silently dropped
 * object 7 — the very object carrying the /Group dict. Concatenating the raw file with the
 * inflated streams cannot lose a byte, which is the property that matters for a gate.
 */
function scannableText(input) {
  // page.pdf() resolves to a Uint8Array, not a Buffer. Uint8Array#toString ignores its
  // argument and returns the comma-joined byte values, so reading it directly yields
  // "37,80,68,70,..." — no PDF syntax, and every counter silently reports zero. Normalize
  // first. (The self-test is what surfaced this; without it the gate would have shipped
  // green and meaningless.)
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const raw = buf.toString('latin1');
  const parts = [raw];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    try { parts.push(zlib.inflateSync(Buffer.from(raw.slice(start, end), 'latin1')).toString('latin1')); }
    catch { /* not Flate (or an image); the raw bytes are already in parts[0] */ }
  }
  return parts.join('\n');
}

function scan(pdfBuf) {
  const blob = scannableText(pdfBuf);
  // `[\s\S]{0,200}?` rather than `[^>]*?`: the group dict legitimately contains nested
  // dictionaries, so a "no closing angle bracket" guard would miss real groups.
  const groups = blob.match(/\/Group\s*<<[\s\S]{0,200}?\/S\s*\/Transparency/g) || [];
  // A soft mask is written as a DICTIONARY (`/SMask <</Type /Mask /S /Luminosity …>>`), an
  // indirect reference, or the name /None. Only /None means "no mask" — matching just names
  // and refs misses the dictionary form, which is the one Chromium actually emits.
  const smasks = (blob.match(/\/SMask\s*(<<|\/\w+|\d+\s+\d+\s+R)/g) || []).filter(s => !/\/None$/.test(s));
  const alphas = (blob.match(/\/(?:ca|CA)\s+([0-9.]+)/g) || []).filter(s => parseFloat(s.split(/\s+/)[1]) < 1);
  const blends = (blob.match(/\/BM\s*\/(\w+)/g) || []).filter(s => !/\/(Normal|Compatible)$/.test(s));
  const shadings = blob.match(/\/ShadingType\s*\d+/g) || [];
  return { groups: groups.length, smasks: smasks.length, alphas: alphas.length, blends: blends.length, shadings: shadings.length };
}

async function renderPdf(browser, html) {
  const page = await browser.newPage();
  await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  const pdf = await page.pdf(R.buildCoachPdfOptions());
  await page.close();
  return pdf;
}

/** The cover, with spec 3.2's two banned constructs put back. Must trip the scanner. */
function badControlHtml() {
  const src = fs.readFileSync(path.join(ROOT, 'docs/mockup/claude_The_Peacemaker_Page_Cover_v1.html'), 'utf8');
  const out = src
    .replace('#FCFEFE 68%, #FFFFFF 84%', '#FCFEFE 68%, transparent 84%')
    .replace('.prep{background:#D9E4E9', '.prep{background:rgba(217,228,233,0.6)');
  if (out === src) throw new Error('self-test: cover fixture changed shape; control no longer injects anything');
  return out;
}

(async () => {
  const selfTestOnly = process.argv.includes('--self-test');
  const browser = await browserLaunch.launchBrowser();
  console.log(`Chromium: ${await browser.version()}`);

  try {
    // ── positive control: the scanner must FIND violations in a known-bad page ──
    const bad = scan(await renderPdf(browser, badControlHtml()));
    console.log(`\nself-test (known-bad cover): groups ${bad.groups} · masks ${bad.smasks} · alpha<1 ${bad.alphas}`);
    if (bad.groups < 1 || bad.smasks < 1) {
      fail('self-test: scanner found no transparency in a page that deliberately uses `transparent` + rgba(). ' +
           'The gate is not measuring anything — fix the scanner before trusting a pass.');
    } else {
      console.log('  ✓ scanner detects transparency when it is present');
    }

    if (!selfTestOnly) {
      // ── the real gate: the v3 client report must be free of all four ──
      const apiResult = require(path.join(ROOT, `tests/fixtures/${FIXTURE}_api_result.json`));
      const model = await prep.buildClientModel({ apiResult, client: V3_CLIENT, coach: COACH });
      const pdf = await renderPdf(browser, R.buildClientReportHTML_v3(model));
      const r = scan(pdf);
      console.log(`\nclient v3 (${FIXTURE}, ${(pdf.length / 1024).toFixed(1)} KB):`);
      console.log(`  transparency groups : ${r.groups}`);
      console.log(`  soft masks          : ${r.smasks}`);
      console.log(`  alpha < 1           : ${r.alphas}`);
      console.log(`  non-normal blends   : ${r.blends}`);
      console.log(`  shading objects     : ${r.shadings}  (informational — opaque gradients are fine)`);
      if (r.groups) fail(`${r.groups} transparency group(s) in the client PDF (spec 3.2 requires 0)`);
      if (r.smasks) fail(`${r.smasks} soft mask(s) in the client PDF (spec 3.2 requires 0)`);
      if (r.alphas) fail(`${r.alphas} non-opaque alpha value(s) — check for rgba(), opacity, fill-opacity, stop-opacity`);
      if (r.blends) fail(`${r.blends} non-normal blend mode(s)`);
    }
  } finally { await browser.close(); }

  if (failed) { console.log('\nTRANSPARENCY CHECK: FAILURES ABOVE.'); process.exit(1); }
  console.log('\nTRANSPARENCY CHECK: ALL PASSED.');
})().catch(e => { console.error('TRANSPARENCY CHECK FAILED:', e.stack || e.message); process.exit(1); });
