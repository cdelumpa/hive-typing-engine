'use strict';
/**
 * p8 WINGS FIT PROBE — AUDIT SCRATCH, NOT A GATE.
 *
 * Written for docs/audit_pr3_wings.md (PR 3 audit, 13 Aug 2026). Measures the p8 "Your
 * Wings" page with the real v3 renderer and the pinned bundled Chromium — the same engine
 * scripts/render_client.js uses — and prints:
 *
 *   1. PAGE HEADROOM   — 1056px minus the natural content-stack height, per type.
 *   2. COLUMN DRIFT    — the height difference between the two wing columns with the flex
 *                        stretch RELEASED. `.v3-wings` is display:flex and `.v3-wing-body`
 *                        is flex:1, so page height is set by the taller column alone and
 *                        drift is invisible to headroom. It is visible to the eye.
 *   3. ZONE LINE COUNTS — from getClientRects(), not character arithmetic. Plus last-line
 *                        fill as a fraction of the content box width.
 *   4. LINE BUDGET     — px cost of one line in each zone class, and how many body lines a
 *                        column can carry before the page spills. This is the number the
 *                        unauthored types need, and it does not require their content.
 *
 * Types 1-8 have no authored v3 wing content, so their zones measure as empty here. That is
 * the finding, not a defect in the probe.
 *
 *   node scripts/spike/wings_fit_probe.js            # measure, print a table
 *   node scripts/spike/wings_fit_probe.js --pdf      # also write per-type PDFs
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

const R = require(path.join(ROOT, 'app/renderer.js'));
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));

const PAGE_PX = 1056;
const WINGS_INDEX = 4;                 // document order: Cover, Contents, Welcome, WhatIs, WINGS, Lines, Thoughts
const WRITE_PDF = process.argv.includes('--pdf');
const OUT = path.join(ROOT, '.phase6_out');
fs.mkdirSync(OUT, { recursive: true });

// Same client/coach stubs render_client.js uses.
const V3_CLIENT = { full_name: 'Anders Lindqvist', first_name: 'Anders', email: 'anders@example.com', date: 'August 13, 2026' };
const coach = { full_name: 'Monique Breault', first_name: 'Mo', email: 'mo@hive.example' };

/** Measurement runs inside the page. Every number below comes from a layout box. */
function probe(WINGS_INDEX, PAGE_PX) {
  const pages = [...document.querySelectorAll('.v3-page')];
  const el = pages[WINGS_INDEX];
  if (!el) return { error: 'no wings page at index ' + WINGS_INDEX };

  // ── page headroom: natural stack height with min-height released ────────────
  const prevMin = el.style.minHeight;
  el.style.minHeight = '0px';
  const natural = el.getBoundingClientRect().height;
  el.style.minHeight = prevMin;
  const rendered = el.getBoundingClientRect().height;

  // ── zone line counts, measured before any flex mutation ─────────────────────
  //
  // LINE BOXES, NOT ELEMENT BOXES. `el.getClientRects()` on a block returns ONE rect for
  // the whole block — it counts 1 for every zone regardless of how many lines rendered.
  // A Range over the element's contents returns one rect PER LINE BOX, which is the number
  // this probe exists to produce. Rects are then merged by top edge: an inline span (the
  // _v3NoBreak wrapper, <em>, the ${...} tokens) splits a single visual line into several
  // rects sharing a top.
  const lineRects = (n) => {
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const raw = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    const byTop = new Map();
    for (const r of raw) {
      const k = Math.round(r.top * 2) / 2;          // half-px tolerance
      const cur = byTop.get(k);
      if (!cur) byTop.set(k, { top: k, left: r.left, right: r.right });
      else { cur.left = Math.min(cur.left, r.left); cur.right = Math.max(cur.right, r.right); }
    }
    return [...byTop.values()].sort((a, b) => a.top - b.top).map(r => ({ top: r.top, width: r.right - r.left }));
  };

  const measure = (n, label) => {
    if (!n) return null;
    const rects = lineRects(n);
    const cs = getComputedStyle(n);
    const boxW = n.getBoundingClientRect().width
      - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const last = rects[rects.length - 1];
    return {
      label,
      chars: n.textContent.trim().length,
      lines: rects.length,
      boxW: +boxW.toFixed(2),
      lastFill: rects.length ? +(last.width / boxW).toFixed(4) : 0,
      height: +n.getBoundingClientRect().height.toFixed(2),
    };
  };
  const zoneOf = (root, sel, label) => measure(root.querySelector(sel), label);

  const cols = [...el.querySelectorAll('.v3-wing')];
  const zones = cols.map((col, ci) => {
    const side = ci === 0 ? 'wing_a' : 'wing_b';
    const out = [];
    const ov = zoneOf(col, '.v3-wing-over', `${side}.overview`);
    if (ov) out.push(ov);
    [...col.querySelectorAll('.v3-wing-txt')].forEach((n, bi) => {
      out.push(measure(n, `${side}.bullet${bi + 1}`));
    });
    const rs = zoneOf(col, '.v3-res-txt', `${side}.resource`);
    if (rs) out.push(rs);
    return out;
  });

  // ── intro zone (shared, above the columns) ──────────────────────────────────
  const intro = zoneOf(el, '.v3-intro-body .lead', 'intro');

  // ── column drift: release the stretch, then measure each column ─────────────
  // `.v3-wings` stretches children to equal height and `.v3-wing-body{flex:1}` absorbs the
  // slack, so both columns always report the same box. align-items:flex-start + flex:none
  // lets each column fall to its own content height. Restored immediately.
  const wings = el.querySelector('.v3-wings');
  const prevAlign = wings.style.alignItems;
  const bodies = [...el.querySelectorAll('.v3-wing-body')];
  const prevFlex = bodies.map(b => b.style.flex);
  wings.style.alignItems = 'flex-start';
  bodies.forEach(b => { b.style.flex = 'none'; });
  const colH = cols.map(c => +c.getBoundingClientRect().height.toFixed(2));
  wings.style.alignItems = prevAlign;
  bodies.forEach((b, i) => { b.style.flex = prevFlex[i]; });

  // ── line-height calibration per zone class, straight from computed style ────
  const lh = (sel) => {
    const n = el.querySelector(sel);
    if (!n) return null;
    const v = parseFloat(getComputedStyle(n).lineHeight);
    return Number.isFinite(v) ? +v.toFixed(2) : null;
  };

  return {
    rendered: +rendered.toFixed(2),
    natural: +natural.toFixed(2),
    headroom: +(PAGE_PX - natural).toFixed(2),
    colH,
    drift: +Math.abs(colH[0] - colH[1]).toFixed(2),
    intro,
    zones,
    lineHeights: {
      overview: lh('.v3-wing-over'),
      bullet: lh('.v3-wing-txt'),
      resource: lh('.v3-res-txt'),
      intro: lh('.v3-intro-body .lead'),
    },
    // Chrome cost: the page minus the two column bodies. What the layout spends before a
    // single word of wing body text is placed.
    colBodyH: [...el.querySelectorAll('.v3-wing-body')].map(b => +b.getBoundingClientRect().height.toFixed(2)),
  };
}

(async () => {
  const fixture = require(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json'));
  const browser = await browserLaunch.launchBrowser();
  const rows = [];
  let pdfCount = 0, pdfBytes = 0;

  try {
    for (const asType of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const apiResult = JSON.parse(JSON.stringify(fixture));
      apiResult.hypothesis.confirmed_type = asType;
      apiResult.hypothesis.confirmed_type_name = null;
      apiResult.hypothesis.alternate_candidate = (asType % 9) + 1;
      const pb = apiResult.coach_report && apiResult.coach_report.section6 && apiResult.coach_report.section6.pushes_back;
      if (pb) pb.alt_type_name = null;

      const model = await prep.buildClientModel({ apiResult, client: V3_CLIENT, coach });
      const html = R.buildClientReportHTML_v3(model);

      const page = await browser.newPage();
      await page.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('print');
      await browserLaunch.assertReportFont(page);   // throws if Chromium substituted a face
      await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
      await new Promise(r => setTimeout(r, 150));

      const m = await page.evaluate(probe, WINGS_INDEX, PAGE_PX);
      m.type = asType;
      rows.push(m);

      if (WRITE_PDF) {
        const p = path.join(OUT, `wings_probe_t${asType}.pdf`);
        await page.pdf({ path: p, ...R.buildCoachPdfOptions() });
        pdfCount++; pdfBytes += fs.statSync(p).size;
      }
      await page.close();
    }
  } finally { await browser.close(); }

  // ── report ────────────────────────────────────────────────────────────────
  console.log('\n=== p8 WINGS — PAGE HEADROOM AND COLUMN DRIFT ===');
  console.log('type  rendered   natural  headroom |  colA     colB     drift');
  for (const r of rows) {
    console.log(`  ${r.type}   ${String(r.rendered).padStart(7)}  ${String(r.natural).padStart(8)}  `
      + `${String(r.headroom).padStart(8)} | ${String(r.colH[0]).padStart(7)} ${String(r.colH[1]).padStart(8)} `
      + `${String(r.drift).padStart(8)}`);
  }

  console.log('\n=== LINE HEIGHTS (computed, px) ===');
  console.log(JSON.stringify(rows[8].lineHeights));

  console.log('\n=== ZONE LINE COUNTS — types with authored content ===');
  for (const r of rows) {
    const all = [r.intro, ...r.zones.flat()].filter(Boolean);
    const authored = all.filter(z => z.chars > 0);
    if (!authored.length) { console.log(`\nType ${r.type}: NO AUTHORED WING CONTENT (all zones empty)`); continue; }
    console.log(`\nType ${r.type}:`);
    console.log('  zone                   chars  lines   boxW   lastFill  height');
    for (const z of all) {
      const flag = z.chars > 0 && z.lastFill < 0.25 ? '  <-- last line under 25%' : '';
      console.log(`  ${z.label.padEnd(20)} ${String(z.chars).padStart(6)} ${String(z.lines).padStart(6)} `
        + `${String(z.boxW).padStart(7)} ${(z.chars ? (z.lastFill * 100).toFixed(1) + '%' : '  —').padStart(9)} `
        + `${String(z.height).padStart(7)}${flag}`);
    }
  }

  console.log('\n=== LINE BUDGET (derived from the measurements above) ===');
  const t9 = rows[8];
  const empty = rows[0];
  console.log(`  Type 9 natural stack        : ${t9.natural}px  (headroom ${t9.headroom}px)`);
  console.log(`  Type 1-8 empty natural stack: ${empty.natural}px  (headroom ${empty.headroom}px)`);
  console.log(`  Type 9 body text adds       : ${(t9.natural - empty.natural).toFixed(2)}px over the empty page`);
  const t9lines = [t9.intro, ...t9.zones.flat()].filter(Boolean).reduce((a, z) => a + z.lines, 0);
  console.log(`  Type 9 total rendered lines : ${t9lines}`);
  const tallerCol = Math.max(...t9.colH), shorterCol = Math.min(...t9.colH);
  console.log(`  Type 9 taller column        : ${tallerCol}px  (shorter ${shorterCol}px, drift ${t9.drift}px)`);
  console.log(`  Headroom available to grow  : ${t9.headroom}px on the TALLER column only`);
  const bl = t9.lineHeights.bullet, ol = t9.lineHeights.overview;
  console.log(`  => ${(t9.headroom / bl).toFixed(2)} more bullet lines (@${bl}px) OR `
    + `${(t9.headroom / ol).toFixed(2)} more overview lines (@${ol}px) in the taller column`);

  fs.writeFileSync(path.join(OUT, 'wings_fit_probe.json'), JSON.stringify(rows, null, 2));
  console.log(`\nwrote .phase6_out/wings_fit_probe.json`);
  if (WRITE_PDF) console.log(`wrote ${pdfCount} PDFs, ${(pdfBytes / 1024 / 1024).toFixed(2)} MB total`);
})().catch(e => { console.error('PROBE FAILED:', e.stack || e.message); process.exit(1); });
