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

  // ── Structural gate for the two label-free v3 wheels (PR 2) ────────────────
  // 'client-cover' (sheet 1) and 'client-whatis' (sheet 4) carry numerals only, so every
  // check above — which measures label boxes — is vacuous for them. That is precisely the
  // hazard: design spec v3.0 section 4.3 records an earlier mockup figure that was MIRRORED
  // (counterclockwise) and MISSING NODE 2 entirely, which also made the interior lines
  // wrong. Nothing about that is visible to a clearance test, and on a decorative wheel it
  // is easy to miss by eye. Assert the structure instead: nine nodes, each numeral at the
  // angle CLIENT_ANGLES specifies, and both flow sequences in the canonical direction.
  console.log('\nStructural check — label-free v3 wheels:');
  {
    const { CLIENT_ANGLES, CLIENT_TRIANGLE, CLIENT_HEXAGON, COVER_GEO, WHATIS_GEO } = R;
    for (const [variant, GEO, type] of [['client-cover', COVER_GEO, 9], ['client-whatis', WHATIS_GEO, null]]) {
      const svg = R.buildEnneagramSVG({ variant, type });

      // Canonical node centres, from the same angle table the renderer uses.
      const centre = {};
      for (const [n, deg] of Object.entries(CLIENT_ANGLES)) {
        const rad = deg * Math.PI / 180;
        centre[n] = [GEO.cx + GEO.r * Math.cos(rad), GEO.cy + GEO.r * Math.sin(rad)];
      }

      // The numeral's y is the node centre shifted down by the baseline offset the renderer
      // applies (fs * 0.37) — compare against that, not against the raw centre.
      const numerals = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>(\d)<\/text>/g)]
        .map(m => ({ x: +m[1], y: +m[2], n: +m[3] }));
      const seen = numerals.map(t => t.n).sort((a, b) => a - b);
      if (seen.join(',') !== '1,2,3,4,5,6,7,8,9') {
        fail(`${variant}: nodes present are [${seen.join(',')}], expected 1..9 (spec 4.3: an earlier figure was missing node 2)`);
      }
      for (const t of numerals) {
        const [ex, ey] = centre[t.n];
        const off = Math.hypot(t.x - ex, t.y - (ey + GEO.fs * 0.37));
        if (off > 1) fail(`${variant}: numeral ${t.n} is ${off.toFixed(1)}px from its CLIENT_ANGLES position — wheel mirrored or rotated?`);
      }

      // Node circles: nine of them, one on each canonical centre. The ring is r = GEO.r.
      const circles = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
        .map(m => ({ x: +m[1], y: +m[2], r: +m[3] })).filter(c => c.r !== GEO.r);
      if (circles.length !== 9) fail(`${variant}: ${circles.length} node circles, expected 9`);
      for (const [n, [ex, ey]] of Object.entries(centre)) {
        if (!circles.some(c => Math.hypot(c.x - ex, c.y - ey) < 1)) fail(`${variant}: no node circle at position ${n}`);
      }

      // Both polylines must trace the canonical sequences (spec 3.6), in order.
      const polys = [...svg.matchAll(/<polyline points="([^"]+)"/g)].map(m =>
        m[1].trim().split(/\s+/).map(p => p.split(',').map(Number)));
      const nodeAt = (pt) => {
        const hit = Object.entries(centre).find(([, c]) => Math.hypot(c[0] - pt[0], c[1] - pt[1]) < 1);
        return hit ? +hit[0] : '?';
      };
      const traced = polys.map(p => p.map(nodeAt).join('→'));
      for (const [label, want] of [['triangle', CLIENT_TRIANGLE.join('→')], ['hexad', CLIENT_HEXAGON.join('→')]]) {
        if (!traced.includes(want)) {
          fail(`${variant}: ${label} sequence ${want} not found; traced ${JSON.stringify(traced)}`);
        }
      }
      console.log(`  ${variant.padEnd(14)} 9/9 nodes · angles OK · ${traced.length} sequence(s): ${traced.join('  ')}`);
    }
  }

  if (failed) { console.log('\nDIAGRAM CHECK: FAILURES ABOVE.'); process.exit(1); }
  console.log('DIAGRAM CHECK: ALL PASSED.');
})().catch(e => { console.error('DIAGRAM CHECK FAILED:', e.stack || e.message); process.exit(1); });
