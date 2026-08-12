#!/usr/bin/env node
'use strict';
/**
 * Enneagram diagram geometry gate — all 18 client diagrams (9 types × 2 page types).
 *
 * Design spec v3.0 section 3.5 asserts "54 labels, zero clipped, minimum edge clearance
 * 5px, minimum label-to-label gap 27.7px" and instructs: "Do not derive label positions
 * from a formula without rendering... Generate all 18 diagrams and inspect them."
 *
 * That claim turned out to be false. WINGS TYPE 1's wing label ran through the home node
 * and collided with its label, and a first attempt at the fix pushed the eyebrow off the
 * top of the canvas on four diagrams. Both were invisible in code and visible only on
 * render — which is exactly why inspection has to be automated rather than remembered.
 *
 * Clearance is currently 5.47px against a 5px minimum. That is thin: one longer archetype
 * name or eyebrow string could clip silently. Note that an earlier estimate derived from
 * font size put it at 5.88px when the real rendered box was 4.47px — i.e. already failing.
 * This script therefore measures real text boxes via getBBox() in Chromium rather than
 * approximating from font metrics, and fails when:
 *
 *   1. any label is clipped or comes within 5px of a canvas edge, or
 *   2. any label overlaps another label, or
 *   3. any label overlaps a node circle (the original Type 1 defect).
 *
 * Run standalone or via CI. Content changes cannot quietly break the geometry.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const R = require(path.join(ROOT, 'app/renderer.js'));
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));

const MIN_EDGE_CLEARANCE = 5;   // px, spec section 3.5
const VARIANTS = ['client-wings', 'client-lines'];

let failed = false;
const fail = (m) => { failed = true; console.log(`  *** FAIL — ${m}`); };
const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

(async () => {
  const browser = await browserLaunch.launchBrowser();
  console.log(`Chromium: ${await browser.version()}`);
  let worstEdge = Infinity, worstAt = '';

  try {
    const page = await browser.newPage();
    for (let type = 1; type <= 9; type++) {
      for (const variant of VARIANTS) {
        const svg = R.buildEnneagramSVG({ type, variant });
        await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`,
          { waitUntil: 'load' });   // inline SVG only; networkidle0 stalls on repeated setContent

        const geo = await page.evaluate(() => {
          const svgEl = document.querySelector('svg');
          const vb = svgEl.viewBox.baseVal;
          const texts = [...svgEl.querySelectorAll('text')].map(t => {
            const b = t.getBBox();
            return { s: t.textContent, x: b.x, y: b.y, w: b.width, h: b.height };
          });
          const circles = [...svgEl.querySelectorAll('circle')].map(c => ({
            cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'), r: +c.getAttribute('r'),
          }));
          return { vw: vb.width, vh: vb.height, texts, circles };
        });

        const id = `${variant.replace('client-', '').toUpperCase()} T${type}`;

        // Labels are the text elements outside the node circles (node numbers sit inside).
        const nodeCircles = geo.circles.filter(c => c.r <= 20);
        const isNodeNumber = (t) => /^\d$/.test(t.s.trim());

        for (const t of geo.texts) {
          const clear = Math.min(t.x, t.y, geo.vw - (t.x + t.w), geo.vh - (t.y + t.h));
          if (clear < worstEdge) { worstEdge = clear; worstAt = `${id} "${t.s}"`; }
          if (clear < MIN_EDGE_CLEARANCE) {
            fail(`${id}: label "${t.s}" clearance ${clear.toFixed(2)}px < ${MIN_EDGE_CLEARANCE}px`);
          }
          if (isNodeNumber(t)) continue;
          // Label vs node circle (the Type 1 collision class).
          for (const c of nodeCircles) {
            const box = { x: c.cx - c.r, y: c.cy - c.r, w: c.r * 2, h: c.r * 2 };
            if (rectsOverlap(t, box)) fail(`${id}: label "${t.s}" overlaps the node at (${c.cx}, ${c.cy})`);
          }
        }

        // Label vs label.
        const labels = geo.texts.filter(t => !isNodeNumber(t));
        for (let i = 0; i < labels.length; i++) {
          for (let j = i + 1; j < labels.length; j++) {
            if (rectsOverlap(labels[i], labels[j])) {
              fail(`${id}: labels "${labels[i].s}" and "${labels[j].s}" overlap`);
            }
          }
        }
      }
    }
    await page.close();
  } finally {
    await browser.close();
  }

  console.log(`  18 diagrams measured · minimum edge clearance ${worstEdge.toFixed(2)}px (${worstAt})`);
  if (failed) { console.log('\nDIAGRAM CHECK: FAILURES ABOVE.'); process.exit(1); }
  console.log('DIAGRAM CHECK: ALL PASSED.');
})().catch(e => { console.error('DIAGRAM CHECK FAILED:', e.stack || e.message); process.exit(1); });
