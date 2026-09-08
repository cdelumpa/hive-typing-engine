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
// Legibility floor between two labels on the same rail — a DIFFERENT requirement from the
// non-overlap the spec's §3.5 gate asserts, and one that check cannot express.
const MIN_LABEL_SEP = 12;
const VARIANTS = ['client-wings', 'client-lines'];

// ── client-quickref: 72 RING CONFIGURATIONS, NOT NINE TYPES ────────────────────────────────
// The two rings are PARAMETERS (design spec v3.0 §8.4) — step 6 passes hero.number and
// alternate.number — so what varies geometrically is every LEADING x ALTERNATE pair, each
// placing the two labels at different node positions. 9 x 8 = 72. Scores are NOT swept here:
// they change fills only, and a fill cannot clip a label. That claim is itself asserted, as the
// score-independence check further down, rather than assumed.
const RING_PAIRS = [];
for (let lead = 1; lead <= 9; lead++) {
  for (let alt = 1; alt <= 9; alt++) if (alt !== lead) RING_PAIRS.push([lead, alt]);
}
// A representative profile for the sweep — the tracked anders_sx9 call1_ranking, TYPE-MAPPED.
// The score MULTISET is the fixture's; so is the mapping, which matters for anyone reading a
// rendered sweep: the sorted list assigned to types 1..9 in order puts the highest score on
// type 1 and the lowest on type 9, so a LEADING ring on node 9 sits on the palest node. That
// is confusing to look at and was caught on a contact sheet rather than by any gate — geometry
// does not depend on scores (asserted below), so nothing here could have failed.
const SWEEP_SCORES = [
  { type: 9, score: 91 }, { type: 5, score: 83 }, { type: 1, score: 74 },
  { type: 8, score: 52 }, { type: 3, score: 47 }, { type: 2, score: 44 },
  { type: 7, score: 38 }, { type: 4, score: 35 }, { type: 6, score: 31 },
];

let failed = false;
const fail = (m) => { failed = true; console.log(`  *** FAIL — ${m}`); };
// Per-variant geometry, so nodes can be located rather than guessed at.
const GEOM = { 'client-wings': R.CLIENT_GEO, 'client-lines': R.CLIENT_GEO,
  'client-quickref': R.QUICKREF_GEO };

/** Canonical node centres for a geometry, from the same angle table the renderer uses. */
function nodeCentres(GEO) {
  return Object.fromEntries(Object.entries(R.CLIENT_ANGLES).map(([n, deg]) => {
    const rad = deg * Math.PI / 180;
    return [n, [GEO.cx + GEO.r * Math.cos(rad), GEO.cy + GEO.r * Math.sin(rad)]];
  }));
}

/**
 * One box per canonical node position, sized to the LARGEST circle sitting there.
 * Returns [] rather than throwing when a geometry is unknown, so the count assertion at the
 * call site reports it as 0-of-9 by name instead of aborting the run.
 */
function nodeBoxes(circles, GEO) {
  if (!GEO) return [];
  const centres = nodeCentres(GEO);
  const out = [];
  for (const [, [ex, ey]] of Object.entries(centres)) {
    const here = circles.filter(c => Math.hypot(c.cx - ex, c.cy - ey) < 1);
    if (here.length) out.push({ cx: ex, cy: ey, r: Math.max(...here.map(c => c.r)) });
  }
  return out;
}

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

        // ── WHICH CIRCLES ARE NODES ────────────────────────────────────────────────────
        //
        // BY POSITION, against the canonical centres. Nodes were previously selected by
        // `r <= 20`, a heuristic tuned to this pair's radii (11/13/15 against a 95 ring). It is
        // ALREADY WRONG for a shipped variant — client-cover's nodes are r=23, so it returns 0
        // of 10 there — and it returns 0 of 12 for client-quickref (nodes 21, rings 27, circle
        // 105). A filter that returns nothing makes the label-vs-node check below PASS BY
        // TESTING NOTHING.
        //
        // client-cover's vacuum is LATENT, not live: VARIANTS did not include it, and the
        // structural block at the foot of this file runs no overlap or clearance test. Matching
        // by position removes the latency rather than leaving it for whoever adds it.
        //
        // WHY POSITION AND NOT AN ATTRIBUTE. A `data-node` marker was written first and
        // discarded: it changed the emitted markup on five shipped v3 variants (45 of 81
        // renders, measured), and it is weaker — a circle drawn in the WRONG PLACE but tagged
        // as a node would pass. Matching against CLIENT_ANGLES + the geometry constant asserts
        // the circle is where the node belongs, and emits nothing. This is the same technique
        // the structural block at the foot of this file already uses.
        //
        // ONE BOX PER POSITION, SIZED TO THE LARGEST CIRCLE THERE. client-quickref draws a ring
        // concentric with its leading and alternate nodes, so two positions carry two circles.
        // A label must clear the ring, not merely the node, so the conservative radius is right.
        const nodeCircles = nodeBoxes(geo.circles, GEOM[variant]);

        // NON-VACUITY. Without this, the fix above reintroduces the same vacuum at the next
        // geometry change. Asserting the COUNT is what makes the label-vs-node test meaningful.
        if (nodeCircles.length !== 9) {
          fail(`${variant} T${type}: ${nodeCircles.length} circles sit at canonical node `
             + `positions, expected 9 — the label-vs-node check below would test nothing`);
        }
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

  // ── client-quickref — 72 ring configurations (PR 5 Build 2) ────────────────
  console.log('\nQuick Reference heat map — 72 ring configurations:');
  {
    const qpage = await browser.newPage();
    let worst = Infinity, worstAt2 = '', nodeCountBad = 0, orange = 0, banned = 0;
    const BANNED = /fill-opacity|stop-opacity|\sopacity\s*=|rgba\(|\btransparent\b|oklch\(|#[0-9a-fA-F]{8}\b/;
    for (const [lead, alt] of RING_PAIRS) {
      const svg = R.buildEnneagramSVG({ variant: 'client-quickref', leading: lead, alternate: alt, scores: SWEEP_SCORES });

      // B6 — no transparency construct in the emitted markup. Cheap, and it catches the thing at
      // authoring time rather than after a render.
      const m = svg.match(BANNED);
      if (m) { banned++; fail(`quickref ${lead}x${alt}: banned opacity construct "${m[0]}" in the emitted SVG`); }
      // B8 — PER-VARIANT, not blanket. client-cover legitimately carries #F68625: the cover's
      // home node is the sole client marker on a sheet with no page header (spec §5.3, and
      // renderer.js documents it at the emitter). A blanket check would turn CI red on shipped,
      // correct work. Orange on THIS figure would be the ramp borrowing the instinct bars' fill.
      if (svg.includes('#F68625')) { orange++; fail(`quickref ${lead}x${alt}: #F68625 (client orange) inside the heat map — the ramp must stay cyan (spec §5.3)`); }

      await qpage.setContent(`<!doctype html><body style="margin:0;background:#FFFFFF">${svg}</body>`, { waitUntil: 'load' });
      const geo = await qpage.evaluate(() => {
        const svgEl = document.querySelector('svg');
        const vb = svgEl.viewBox.baseVal;
        return {
          vw: vb.width, vh: vb.height,
          texts: [...svgEl.querySelectorAll('text')].map(t => { const b = t.getBBox();
            return { s: t.textContent, x: b.x, y: b.y, w: b.width, h: b.height }; }),
          circles: [...svgEl.querySelectorAll('circle')].map(c => ({
            cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'), r: +c.getAttribute('r') })),
        };
      });
      const id = `QUICKREF ${lead}x${alt}`;
      const boxes = nodeBoxes(geo.circles, R.QUICKREF_GEO);
      if (boxes.length !== 9) { nodeCountBad++; fail(`${id}: ${boxes.length} circles at canonical node positions, expected 9`); }
      const isNodeNumber = (t) => /^\d$/.test(t.s.trim());
      for (const t of geo.texts) {
        const clear = Math.min(t.x, t.y, geo.vw - (t.x + t.w), geo.vh - (t.y + t.h));
        if (clear < worst) { worst = clear; worstAt2 = `${id} "${t.s}"`; }
        if (clear < MIN_EDGE_CLEARANCE) fail(`${id}: label "${t.s}" clearance ${clear.toFixed(2)}px < ${MIN_EDGE_CLEARANCE}px`);
        if (isNodeNumber(t)) continue;
        for (const c of boxes) {
          const box = { x: c.cx - c.r, y: c.cy - c.r, w: c.r * 2, h: c.r * 2 };
          if (rectsOverlap(t, box)) fail(`${id}: label "${t.s}" overlaps the node at (${c.cx.toFixed(1)}, ${c.cy.toFixed(1)})`);
        }
      }
      const labels = geo.texts.filter(t => !isNodeNumber(t));
      for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
        if (rectsOverlap(labels[i], labels[j])) fail(`${id}: labels "${labels[i].s}" and "${labels[j].s}" overlap`);
      }
      // ── LEGIBILITY, WHICH IS NOT NON-OVERLAP (added after a contact-sheet review) ──────
      // Two labels sharing a rail passed the overlap check above at a 2.49px gap on eight of
      // the 72 pairs, and at 8.5px they read as ONE WORD — "LEADINGALTERNATE". Non-overlap and
      // legibility are different requirements and the first does not imply the second. This
      // asserts the second. Same-rail is a y match; different rails cannot crowd each other.
      for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
        const [A, B] = labels[i].x <= labels[j].x ? [labels[i], labels[j]] : [labels[j], labels[i]];
        if (Math.abs(A.y - B.y) > 1) continue;
        const gap = B.x - (A.x + A.w);
        if (gap < MIN_LABEL_SEP) {
          fail(`${id}: labels "${A.s}" and "${B.s}" share a rail with only ${gap.toFixed(2)}px `
             + `between them (min ${MIN_LABEL_SEP}) — they read as one word`);
        }
      }
    }
    console.log(`  ${RING_PAIRS.length} configurations measured · minimum edge clearance ${worst.toFixed(2)}px (${worstAt2})`);
    console.log(`  node-count failures ${nodeCountBad} · banned opacity constructs ${banned} · #F68625 hits ${orange}`);

    // ── THE COLLIDED RECORD: ONE RING, NO ALTERNATE, AND IT MUST NOT THROW ────────────
    //
    // call2_stamp.js can ship a record with confirmed_type === alternate_candidate: its Defect #3
    // guard flags the collision for admin review and deliberately does NOT hard-stop, "the client
    // still gets a report". buildClientModel builds it — CLIENT_SPEC requires alternate.number to
    // be present, never to differ — so step 6 will hand this figure two equal node numbers.
    // Reachable on the em_only production path, not just the SM fallback.
    //
    // Asserted because an earlier version of this branch THREW on it, which would have turned a
    // record the engine ships into a client report that fails to generate.
    {
      let svg;
      try {
        svg = R.buildEnneagramSVG({ variant: 'client-quickref', leading: 9, alternate: 9, scores: SWEEP_SCORES });
      } catch (e) {
        fail(`collided record (leading === alternate): buildEnneagramSVG THREW — "${e.message}". `
           + `call2_stamp.js ships these deliberately; the figure must degrade, not hard-stop`);
        svg = null;
      }
      if (svg) {
        const rings = (svg.match(/<circle[^>]*r="27"/g) || []).length;
        const dashed = (svg.match(/stroke-dasharray/g) || []).length;
        const alt = /<text[^>]*>ALTERNATE</.test(svg);
        if (rings !== 1) fail(`collided record: ${rings} rings drawn, expected exactly 1 (the leading)`);
        if (dashed !== 0) fail(`collided record: ${dashed} dashed ring(s) drawn, expected 0`);
        if (alt) fail('collided record: an ALTERNATE label was drawn for a type that is also the leading');
        if (rings === 1 && !dashed && !alt) console.log('  collided record: one ring, no ALTERNATE, no throw ✓');
      }
    }

    // B10 — SCORE INDEPENDENCE. Two renders with different score vectors must differ ONLY in
    // fills. Geometry could not previously depend on scores because they could not reach the
    // builder; Build 2 breaks that property deliberately, so the claim is re-established as a
    // gate rather than inherited.
    const strip = (svg) => svg.replace(/fill="#[0-9A-F]{6}"/g, 'fill="X"')
                              .replace(/stop-color="#[0-9A-F]{6}"/g, 'stop-color="X"');
    const flat = [1,2,3,4,5,6,7,8,9].map(t => ({ type: t, score: 50 }));
    const a = R.buildEnneagramSVG({ variant: 'client-quickref', leading: 9, alternate: 5, scores: SWEEP_SCORES });
    const b = R.buildEnneagramSVG({ variant: 'client-quickref', leading: 9, alternate: 5, scores: flat });
    if (a === b) fail('score-independence: two different score vectors produced identical SVG — the ramp is not reading scores');
    else if (strip(a) !== strip(b)) fail('score-independence: two score vectors differ OUTSIDE fill — a position or label depends on a score');
    else console.log('  score independence: differs in fills only ✓');
    await qpage.close();
  }

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
    const { CLIENT_ANGLES, CLIENT_TRIANGLE, CLIENT_HEXAGON, COVER_GEO, WHATIS_GEO, EXPLORE_GEO } = R;
    // client-explore (sheet 6) RIDES ALONG — [DECISION — Cai, 8 Sep 2026]. STRUCTURAL BLOCK
    // ONLY, not VARIANTS: it emits ZERO non-numeral labels (measured), so the label-vs-node and
    // label-vs-label checks would have nothing to test there. What it was missing is THIS check
    // — it was the last v3 wheel with no structural assertion of any kind, and the defect class
    // is the one the design spec's §4.3 records as having actually happened: a mockup that
    // shipped MIRRORED and MISSING NODE 2.
    //
    // Note its home node is r=16 and its others 12.5, so the retired `r <= 20` filter would have
    // included them — the plan's premise that this rode along with the filter fix was wrong, and
    // it is in on its own merit instead.
    for (const [variant, GEO, type, webLines] of [['client-cover', COVER_GEO, 9, true],
                                                  ['client-whatis', WHATIS_GEO, null, true],
                                                  ['client-explore', EXPLORE_GEO, 9, false]]) {
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
        // client-explore grows its HOME numeral (homeFs 15 against fs 12) — design spec §4.4 row
        // M4, ported as drawn. The baseline offset is fs * 0.37, so the home numeral's expected y
        // differs from the other eight and comparing both against GEO.fs reports a real, correct
        // figure as a 1.2px rotation. Use the size the renderer actually applied.
        const fs = (GEO.homeFs && t.n === type) ? GEO.homeFs : GEO.fs;
        const off = Math.hypot(t.x - ex, t.y - (ey + fs * 0.37));
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
      // WEB LINES ARE NOT UNIVERSAL. client-explore draws the ring and the nine nodes only —
      // the mockup omits the triangle and hexad rather than drawing them faintly, and EXPLORE_GEO
      // records that ("It carries NO web lines"). Asserting sequences there would demand markup
      // the design deliberately does not emit. The flag is per-variant so the omission is a
      // stated property rather than a silently skipped check.
      for (const [label, want] of (webLines ? [['triangle', CLIENT_TRIANGLE.join('→')], ['hexad', CLIENT_HEXAGON.join('→')]] : [])) {
        if (!traced.includes(want)) {
          fail(`${variant}: ${label} sequence ${want} not found; traced ${JSON.stringify(traced)}`);
        }
      }
      console.log(`  ${variant.padEnd(14)} 9/9 nodes · angles OK · `
        + (webLines ? `${traced.length} sequence(s): ${traced.join('  ')}` : 'no web lines by design'));
    }
  }

  if (failed) { console.log('\nDIAGRAM CHECK: FAILURES ABOVE.'); process.exit(1); }
  console.log('DIAGRAM CHECK: ALL PASSED.');
})().catch(e => { console.error('DIAGRAM CHECK FAILED:', e.stack || e.message); process.exit(1); });
