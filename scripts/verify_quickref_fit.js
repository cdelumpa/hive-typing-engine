'use strict';
/**
 * verify_quickref_fit.js — the positive controls for sheet 5's fit assertions (PR 5 Build B3).
 *
 * ── WHY THIS IS A SEPARATE GATE ──────────────────────────────────────────────────────────────
 * F1-F4 run inside scripts/render_client.js, over the 35 renders, and they are green. Green is
 * the state a gate spends its whole life in, and it is also the state a gate that has silently
 * stopped working spends its whole life in. This project has found ten gates that did not gate,
 * and the recurring shape is an assertion that agrees with its subject by construction.
 *
 * So every predicate in scripts/lib/quickref_fit.js is driven here with a deliberately broken
 * measurement and REQUIRED to fail. A gate that has never been observed red is not a gate.
 *
 * ── WHAT MAKES THESE CONTROLS REAL AND NOT THEATRE ───────────────────────────────────────────
 * They call the SAME predicate functions render_client.js calls — judgeSheet, judgeOverlaps,
 * judgeAcross, checkPageCount — not a paraphrase of them. Where a control needs a broken page it
 * breaks a REAL rendered sheet 5 in the DOM and re-measures with the real probes, so the
 * measurement path is exercised too, not just the arithmetic.
 *
 * scripts/verify_transparency.js established this pattern in this repo and its own note records
 * why: without a control, a detector that silently stops working passes everything.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
const QF = require(path.join(ROOT, 'scripts/lib/quickref_fit.js'));
const pdfLib = require(path.join(ROOT, 'scripts/lib/pdf_pages.js'));
const qrPreview = require(path.join(ROOT, 'app/cms_quickref_preview.js'));
const shellProbe = require(path.join(ROOT, 'scripts/lib/page_shell_probe.js'));
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));

const PAGE_PX = 1056;
const CAP = qrPreview.subtypeEntry().cap;

let failed = false;
const results = [];
/** A control PASSES when the predicate it drives FAILS. That inversion is the whole file. */
function control(name, messages, expect) {
  const red = messages.length > 0;
  const ok = red === expect;
  if (!ok) failed = true;
  results.push({ name, ok, red, expect, first: messages[0] || null });
}

/** Render sheet 5 once, for a chosen type. Type 5 puts a ring label on the LOWER rail, which is
 *  the only rail that approaches the legend — a control for F3a on an upper-rail type would be
 *  measuring a 300-unit gap and could not tell a floor from no floor at all. */
async function renderSheet(page, asType) {
  const fixture = require(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json'));
  const c = JSON.parse(JSON.stringify(fixture));
  c.hypothesis.confirmed_type = asType;
  c.hypothesis.leading_candidate = asType;
  const alt = (asType % 9) + 1;
  c.hypothesis.alternate_candidate = alt;
  const rest = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((t) => t !== asType && t !== alt);
  c.hypothesis.call1_ranking = [asType, alt, ...rest].map((t, i) => ({ type: t, score: 90 - i * 5 }));
  const m = await prep.buildClientModel({
    apiResult: c,
    client: { first_name: 'Control', last_name: 'Sample', date: 'June 2026' },
    coach: { full_name: '', type: null, instinct: null },
  });
  await page.setContent(R.buildClientReportHTML_v3(m), { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
  return m;
}

/** Measure + judge, the way render_client.js does it. */
async function judge(page, tag, { cap = CAP, pagePx = PAGE_PX } = {}) {
  const m = await QF.measureSheet(page);
  const probe = await page.evaluate(qrPreview.fitProbe('.v3-qr-stxt'));
  const bound = await QF.probePageBound(page, pagePx, cap + 3);
  return {
    m,
    sheet: QF.judgeSheet({ tag, m, probeLines: probe ? probe.zoneLines : null, bound, cap }),
    overlaps: QF.judgeOverlaps({ tag, m, allowed: [] }),
  };
}

/** Put N rendered lines into the summary box. */
const setSummaryLines = (page, n) => page.evaluate((n) => {
  const el = [...document.querySelectorAll('.v3-page')].find((p) => p.querySelector('.v3-qr-two'));
  const z = el.querySelector('.v3-qr-stxt');
  const count = () => {
    const rg = document.createRange(); rg.selectNodeContents(z);
    const tops = new Set();
    for (const r of rg.getClientRects()) if (r.width > 0 && r.height > 0) tops.add(Math.round(r.top * 2) / 2);
    return tops.size;
  };
  if (n === 0) { z.textContent = ''; return 0; }
  let w = 1, guard = 0;
  while (guard++ < 500) { z.textContent = Array(w).fill('measurement').join(' '); if (count() >= n) break; w++; }
  return count();
}, n);

(async () => {
  const browser = await browserLaunch.launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });

    // ── THE NEGATIVE CONTROL FIRST ────────────────────────────────────────────────────────
    // An untouched sheet 5 must be SILENT. Without this every control below is satisfied by a
    // predicate that fails on everything, which is not a gate either.
    await renderSheet(page, 5);
    const clean = await judge(page, 'control/clean');
    control('negative control — an untouched sheet 5 is silent', clean.sheet.concat(clean.overlaps), false);

    // ── F2 UPPER: a summary over the editorial limit ──────────────────────────────────────
    await renderSheet(page, 5);
    const over = await setSummaryLines(page, CAP + 2);
    const r2a = await judge(page, 'control/f2-over');
    control(`F2 upper — a ${over}-line summary is caught over the ${CAP}-line limit`,
      r2a.sheet.filter((x) => /FIT\/F2/.test(x)), true);

    // ── F2 LOWER: an empty summary ────────────────────────────────────────────────────────
    // The regression this exists for is a renamed leaf or a missed resolveLibObject resolving
    // to '' — which "fits" perfectly and is a blank box on a client's page.
    await renderSheet(page, 5);
    await setSummaryLines(page, 0);
    const r2b = await judge(page, 'control/f2-empty');
    control('F2 lower — an empty summary is caught', r2b.sheet.filter((x) => /FIT\/F2/.test(x)), true);

    // ── F3a: a ring label pushed down into the legend ─────────────────────────────────────
    await renderSheet(page, 5);
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.v3-page')].find((p) => p.querySelector('.v3-qr-two'));
      const t = [...el.querySelectorAll('.v3-qr-hm svg text')]
        .find((n) => /^(LEADING|ALTERNATE)$/.test(n.textContent.trim()));
      // 320 sits just above the legend blocks at y=324 — inside the one-em floor but NOT
      // overlapping, which is exactly the case verify_diagrams' non-overlap test cannot see.
      t.setAttribute('y', '320');
    });
    const r3a = await judge(page, 'control/f3-clearance');
    control('F3a — a label crowding the legend without overlapping it is caught',
      r3a.sheet.filter((x) => /FIT\/F3/.test(x)), true);

    // ── F3b: a forced sibling overlap ─────────────────────────────────────────────────────
    await renderSheet(page, 5);
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.v3-page')].find((p) => p.querySelector('.v3-qr-two'));
      el.querySelector('.v3-qr-tips').style.marginTop = '-120px';
    });
    const r3b = await judge(page, 'control/f3-overlap');
    control('F3b — a block dragged onto its sibling is caught', r3b.overlaps, true);

    // ── F4b: the page cannot hold cap + 1 ─────────────────────────────────────────────────
    // Driven by shrinking the BUDGET rather than the page, which is the same inequality from
    // the other side and needs no synthetic content: at 950px the sheet holds fewer lines than
    // the CMS lets an editor write.
    await renderSheet(page, 5);
    const r4b = await judge(page, 'control/f4b', { pagePx: 950 });
    control('F4b — a cap the page cannot carry is caught',
      r4b.sheet.filter((x) => /FIT\/F4b/.test(x)), true);

    // ── F4a: the gate and the editor counting differently ─────────────────────────────────
    // Pure: judgeSheet is handed a probe count that disagrees with the measured one.
    await renderSheet(page, 5);
    const m4a = await QF.measureSheet(page);
    control('F4a — the gate and the editor disagreeing about a line count is caught',
      QF.judgeSheet({ tag: 'control/f4a', m: m4a, probeLines: m4a.summaryLines + 1,
                      bound: { bound: CAP + 1 }, cap: CAP }).filter((x) => /FIT\/F4a/.test(x)), true);

    // ── THE PDF: a document that runs to two sheets ───────────────────────────────────────
    // A REAL two-sheet PDF, produced by making sheet 5 too tall to fit, then read back with the
    // same reader the harness uses. Nothing here trusts the DOM's opinion of the page.
    //
    // THE EXPECTED COUNT IS DERIVED, AND THE QUIET CONTROL BESIDE IT IS WHY. This was the literal
    // 11 — true until PR 6 Build B1 built sheet 11, after which an UNSPILLED document is 12 pages
    // and `checkPageCount(pdf, 11)` goes red with no spill at all. Measured on the B1 branch before
    // this fix. The red control above could not tell: it passed whether or not the spill happened.
    // An unspilled document must now read back QUIET against the same count, so a stale count fails.
    const logical = R.v3PagesFor(5).length;
    await renderSheet(page, 5);
    const whole = await page.pdf(R.buildCoachPdfOptions());
    control(`PDF — an unspilled document reads back as exactly its ${logical} logical pages`,
      pdfLib.checkPageCount(whole, logical, 'control/pdf-whole') ? ['red'] : [], false);
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.v3-page')].find((p) => p.querySelector('.v3-qr-two'));
      el.querySelector('.v3-qr-stxt').textContent = Array(400).fill('measurement').join(' ');
    });
    const spilled = await page.pdf(R.buildCoachPdfOptions());
    const read = pdfLib.readPageCount(spilled);
    control(`PDF — a spilled document reads back as more than its logical pages (${read.pages} sheets, /Count ${read.count})`,
      pdfLib.checkPageCount(spilled, logical, 'control/pdf') ? ['red'] : [], true);
    // And the reader must not be reporting zero, which would pass everything.
    control('PDF — the reader finds page objects at all',
      read.pages > 0 ? [] : ['found none'], false);

    // ── THE SHELL: A PAGE WHOSE HEIGHT STOPS RESPONDING TO ITS CONTENT ────────────────────
    //
    // The worst failure in the set, because it does not break one assertion — it silently
    // empties all of them while every one stays green. Driven on a REAL page by freezing its
    // height the way one line of CSS on the shared class would.
    await renderSheet(page, 5);
    const shellClean = shellProbe.judgePageShell({
      tag: 'control/shell-clean', rows: await shellProbe.probePageShell(page, 40), spacerPx: 40 });
    control('negative control — every .v3-page responds to its content', shellClean, false);

    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.v3-page')].find((p) => p.querySelector('.v3-qr-two'));
      el.style.height = '1056px';
      el.style.overflow = 'hidden';
    });
    control('SHELL — a page frozen to a fixed height is caught',
      shellProbe.judgePageShell({ tag: 'control/shell-frozen',
        rows: await shellProbe.probePageShell(page, 40), spacerPx: 40 }), true);

    // And the declared exception is not a free pass: the cover clips rather than spills, so it is
    // held to "your content does not overflow your box" instead.
    await renderSheet(page, 5);
    await page.evaluate(() => {
      const cover = document.querySelector('.v3-page.is-cover');
      // Tall enough to certainly exceed the box: the cover's own children are absolutely
      // positioned, so its normal-flow content starts near zero and a small spacer still fits.
      const d = document.createElement('div');
      d.style.cssText = 'height:1400px';
      cover.appendChild(d);
    });
    control('SHELL — the fixed-height cover CLIPPING its content is caught',
      shellProbe.judgePageShell({ tag: 'control/shell-cover',
        rows: await shellProbe.probePageShell(page, 40), spacerPx: 40 }), true);

    await page.close();
  } finally { await browser.close(); }

  // ── PURE CONTROLS: no browser needed ────────────────────────────────────────────────────
  const row = (over) => ({ tag: 't', headroom: 60, lines: 2, code: 'SP1', lineHeight: 18.75, ...over });
  control('F1 — a sheet with less than one line of headroom is caught',
    QF.judgeAcross({ rows: [row({ headroom: 12 })], expectedSummaries: 1 }).filter((x) => /FIT\/F1/.test(x)), true);
  control('F1 — an unmeasurable line height is caught, not skipped',
    QF.judgeAcross({ rows: [row({ lineHeight: null })], expectedSummaries: 1 }).filter((x) => /FIT\/F1/.test(x)), true);
  control('F2 coverage — renders that show only some of the 27 summaries are caught',
    QF.judgeAcross({ rows: [row({})], expectedSummaries: 27 }).filter((x) => /FIT\/F2/.test(x)), true);
  control('FIT — a missing sheet 5 fails rather than skipping',
    QF.judgeSheet({ tag: 't', m: null, probeLines: null, bound: null, cap: CAP }), true);

  // The viewBox relation. Captions are clipped INSIDE the SVG when it breaks, where no DOM box
  // exists for any measurement to catch — so the relation between the constants is the only
  // available guard, and it has to be shown capable of failing like everything else.
  const geo = R.QUICKREF_GEO;
  control('geo — vh = rampY + 32 holds today',
    QF.assertGeoRelation(geo).ok ? [] : ['red'], false);
  control('geo — moving rampY without vh is caught',
    QF.assertGeoRelation({ ...geo, rampY: geo.rampY + 10 }).ok ? [] : ['red'], true);

  const width = Math.max(...results.map((r) => r.name.length));
  console.log('\nQUICKREF FIT — POSITIVE CONTROLS\n');
  for (const r of results) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.expect ? 'expected RED' : 'expected quiet'} · got ${r.red ? 'RED' : 'quiet'}`);
    if (!r.ok && r.first) console.log(`        first message: ${r.first}`);
  }
  console.log(`\n  ${results.filter((r) => r.ok).length}/${results.length} controls behaved as required`);
  if (failed) { console.log('\nQUICKREF FIT CONTROLS: FAILURES ABOVE.'); process.exit(1); }
  console.log('\nQUICKREF FIT CONTROLS: ALL PASSED.');
})().catch((e) => { console.error('CONTROLS FAILED:', e.stack || e.message); process.exit(1); });
