'use strict';
/**
 * quickref_fit.js — sheet 5's fit measurements (PR 5 Build B3, F1-F4).
 *
 * ONE HOME FOR THE MEASUREMENT, TWO CALLERS. scripts/render_client.js runs these over the 35
 * renders as a gate; tests/quickref_fit_test.js runs the pure halves without a browser. Nothing
 * re-derives a number that is measured here.
 *
 * ── WHY THE PROBES MEASURE AND DO NOT COMPUTE ────────────────────────────────────────────────
 * Every quantity sheet 5's layout depends on is a term in QUICKREF_GEO or in the stylesheet. An
 * assertion that recomputes the expected value from those constants and compares it to a render
 * driven by the same constants is a constant measured against itself: it agrees by construction
 * and goes green forever. So the label-to-legend clearance comes off getBBox(), the line counts
 * come off Range rects, and the page bound is found by MUTATING the page until it spills rather
 * than by dividing a headroom figure by a line height.
 *
 * The one exception is `assertGeoRelation`, which is deliberately an assertion ON the constants:
 * viewBox clipping happens inside the SVG, where no DOM box exists to measure. See its note.
 */

/**
 * Rendered line count: Range rects merged on their top edge, rounded to 0.5px.
 *
 * The method every sheet-5 measurement in this project uses (audit §26.3) and the same one
 * app/cms_quickref_preview.js's fitProbe uses, so the gate and the editor count identically. A
 * naive getClientRects().length over-counts: an inline <b> or a _v3NoBreak nowrap span splits one
 * visual line into several rects, and sheet 5's tips carry both.
 *
 * Emitted as source text because it is injected into page.evaluate bodies below.
 */
const LINES_FN = `(n) => {
  if (!n) return null;
  const rg = document.createRange(); rg.selectNodeContents(n);
  const tops = new Set();
  for (const r of rg.getClientRects()) if (r.width > 0 && r.height > 0) tops.add(Math.round(r.top * 2) / 2);
  return tops.size;
}`;

/** Sheet 5's page element, located the way fitProbe locates it: the .v3-page carrying .v3-qr-two. */
const SHEET_FN = `() => [...document.querySelectorAll('.v3-page')].find((p) => p.querySelector('.v3-qr-two'))`;

/**
 * F1 + F2 + F3, in one pass over an already-rendered document.
 *
 * Returns null when sheet 5 is absent, which the caller must treat as a failure rather than a
 * skip — "the page was not there" and "the page was fine" are the two outcomes a fit gate must
 * never conflate.
 */
async function measureSheet(page) {
  return page.evaluate(`(() => {
    const lines = ${LINES_FN};
    const sheet = (${SHEET_FN})();
    if (!sheet) return null;

    // NATURAL height with min-height released and restored, matching measureLayout and fitProbe.
    // A page that fits and a page that overflows both report 1056px otherwise.
    const pm = sheet.style.minHeight, phh = sheet.style.height;
    sheet.style.minHeight = '0px'; sheet.style.height = 'auto';
    const natural = sheet.getBoundingClientRect().height;
    sheet.style.minHeight = pm; sheet.style.height = phh;

    const stxt = sheet.querySelector('.v3-qr-stxt');
    const summaryLines = lines(stxt);
    const summaryText = stxt ? stxt.textContent.trim() : '';
    const lineHeight = stxt ? parseFloat(getComputedStyle(stxt).lineHeight) : null;

    // WHICH of the 27 summaries this render showed, read OFF the page rather than inferred from
    // the harness's axis keys. The axis says what was requested; this says what was rendered, and
    // F2's completeness claim is only worth making about the latter.
    const primary = sheet.querySelector('.v3-qr-irow.is-primary .v3-qr-icode');
    const leadName = sheet.querySelector('.v3-qr-plbl.is-lead');
    const pick = leadName && leadName.closest('.v3-qr-pick');
    const nm = pick && pick.querySelector('.v3-qr-pname');
    const mm = nm && /Type\\s+([1-9])\\b/.exec(nm.textContent);
    const subtypeCode = (primary && mm) ? primary.textContent.trim().toUpperCase() + mm[1] : null;

    // ── F3a: THE RING LABELS AGAINST THE LEGEND ──────────────────────────────────────────────
    //
    // In SVG USER UNITS via getBBox(), not CSS px via getBoundingClientRect(). The figure is
    // scaled by its container, so a px threshold would silently change meaning the day the column
    // width changes; user units are the coordinates the geometry is authored in and are
    // scale-free. getBBox() on a laid-out <text> is a measurement of the glyphs, not of the y
    // attribute — it moves if the font, the size or the string changes.
    //
    // The legend's TOP is the nine blocks, which are the only <rect>s in this figure. Its
    // captions sit BELOW them and are already covered: verify_diagrams asserts label-vs-label
    // non-overlap across all 72 pairs, and the captions are labels to that check.
    let clearance = null;
    const svg = sheet.querySelector('.v3-qr-hm svg');
    if (svg) {
      const marks = [...svg.querySelectorAll('text')]
        .filter((t) => /^(LEADING|ALTERNATE)$/.test(t.textContent.trim()));
      const blocks = [...svg.querySelectorAll('rect')];
      if (marks.length && blocks.length) {
        const legendTop = Math.min(...blocks.map((r) => r.getBBox().y));
        const per = marks.map((t) => {
          const b = t.getBBox();
          return {
            text: t.textContent.trim(),
            gap: +(legendTop - (b.y + b.height)).toFixed(2),
            em: +parseFloat(getComputedStyle(t).fontSize).toFixed(2),
          };
        });
        per.sort((a, b) => a.gap - b.gap);
        clearance = { legendTop: +legendTop.toFixed(2), marks: per,
                      worst: per[0], ratio: +(per[0].gap / per[0].em).toFixed(2) };
      }
    }

    // ── F3b: NOTHING CROWDS ANYTHING — THE SIBLING SWEEP ─────────────────────────────────────
    //
    // GENERIC, not a list of named pairs. Named pairs are precise and blind to anything nobody
    // thought of, and "what changed upstream since it was designed" is exactly the unforeseen
    // case. The cost is an allowlist, which is where gates go to die one entry at a time — so it
    // lives in the caller, is commented per entry, and adding to it is a diff a reviewer sees.
    //
    // Block-level siblings only. Inline boxes legitimately share a line, and every <text> inside
    // the figure legitimately shares space with the web lines behind it, so both are out of
    // scope — the figure's internal geometry is verify_diagrams' subject, not this one's.
    const overlaps = [];
    const label = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).join('.') : '');
    const boxy = (e) => {
      if (e.closest('svg')) return false;
      const cs = getComputedStyle(e);
      if (cs.display === 'inline' || cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') return false;
      const r = e.getBoundingClientRect();
      return r.width > 0.5 && r.height > 0.5;
    };
    const walk = (parent) => {
      const kids = [...parent.children].filter(boxy);
      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect();
          const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          // 0.5px, not 0: adjacent boxes routinely share an edge to sub-pixel precision, and a
          // shared edge is a layout, not a collision.
          if (dx > 0.5 && dy > 0.5) {
            overlaps.push({ a: label(kids[i]), b: label(kids[j]),
                            dx: +dx.toFixed(2), dy: +dy.toFixed(2) });
          }
        }
      }
      for (const k of kids) walk(k);
    };
    walk(sheet);

    return {
      natural: +natural.toFixed(2),
      summaryLines, summaryText, subtypeCode,
      summaryChars: summaryText.length,
      lineHeight: lineHeight && !Number.isNaN(lineHeight) ? +lineHeight.toFixed(2) : null,
      clearance, overlaps,
    };
  })()`);
}

/**
 * F4: THE PAGE'S OWN BOUND ON SUMMARY LINES, FOUND BY PUSHING THE PAGE UNTIL IT SPILLS.
 *
 * WHY MUTATE RATHER THAN DIVIDE. Dividing headroom by a line height assumes every extra line
 * costs one line height, and on this sheet that assumption is FALSE at the short end: the two
 * .v3-qr-half panels are flex items under the default align-items:stretch, so while the instincts
 * panel is the taller of the two, a summary line costs the page NOTHING. Measured: going from one
 * summary line to two costs 3.50px, not 18.75px. A gate that divided would report a bound that is
 * wrong by a line for exactly the records with the shortest summaries.
 *
 * The zone's innerHTML is saved and restored, not its textContent: _v3t wraps hyphenated
 * compounds in nowrap spans, and restoring text alone would strip them and quietly change what
 * every later measurement on this page — including the PDF that gets written — is looking at.
 *
 * Returns the largest N for which the page still fits, and the free space at that N.
 */
async function probePageBound(page, pagePx, maxProbe) {
  return page.evaluate(`(() => {
    const lines = ${LINES_FN};
    const sheet = (${SHEET_FN})();
    if (!sheet) return null;
    const z = sheet.querySelector('.v3-qr-stxt');
    if (!z) return null;
    const keep = z.innerHTML;
    const natural = () => {
      const pm = sheet.style.minHeight, phh = sheet.style.height;
      sheet.style.minHeight = '0px'; sheet.style.height = 'auto';
      const h = sheet.getBoundingClientRect().height;
      sheet.style.minHeight = pm; sheet.style.height = phh;
      return h;
    };
    const rows = [];
    try {
      for (let want = 1; want <= ${maxProbe}; want++) {
        // Grow a synthetic string until it occupies exactly the wanted number of visual lines. Repeating one word is
        // deliberate: it makes the count a function of the line box alone, with no dependence on
        // where the words happen to break — the character ceiling's word-width caveat (§27) is
        // exactly the thing a bound probe must not inherit.
        let words = 1, got = 0, guard = 0;
        while (guard++ < 500) {
          z.textContent = Array(words).fill('measurement').join(' ');
          got = lines(z);
          if (got >= want) break;
          words++;
        }
        if (got !== want) { rows.push({ want, got, unreached: true }); continue; }
        const nat = natural();
        rows.push({ want, got, natural: +nat.toFixed(2), free: +(${pagePx} - nat).toFixed(2), fits: nat <= ${pagePx} + 1 });
      }
    } finally { z.innerHTML = keep; }
    const fitting = rows.filter((r) => r.fits);
    const bound = fitting.length ? fitting[fitting.length - 1] : null;
    return { rows, bound: bound ? bound.want : 0, freeAtBound: bound ? bound.free : null };
  })()`);
}

/**
 * `vh = rampY + 32` — ASSERTED ON THE CONSTANTS, AND THAT IS NOT THE TAUTOLOGY THE OTHERS AVOID.
 *
 * The figure's captions sit at rampY + rampH + 13 and need 11px of descender room below their
 * baseline. If vh does not clear that, the viewBox CLIPS them — and a clipped glyph has no DOM box
 * outside the SVG for any measurement to catch. There is nothing to measure, so the relation
 * between the constants IS the only available guard, and it is a relation rather than a value:
 * moving rampY and vh together is a legitimate design change and stays green.
 */
function assertGeoRelation(geo) {
  const capBaseline = geo.rampY + geo.rampH + 13;
  const descender = geo.vh - capBaseline;
  const ok = geo.vh === geo.rampY + 32 && descender >= 11;
  return { ok, vh: geo.vh, rampY: geo.rampY, expected: geo.rampY + 32, capBaseline, descender };
}

/**
 * ── THE PREDICATES, SEPARATED FROM THE MEASURING ──────────────────────────────────────────────
 *
 * Pure functions over an already-taken measurement, returning failure messages. They live apart
 * from the probes for one reason: scripts/verify_quickref_fit.js --self-test drives THESE with
 * deliberately broken measurements to prove each one can go red. A control that exercised a
 * paraphrase of the gate would prove nothing about the gate, which is the failure this whole build
 * is about.
 */

/** F2/F3/F4b, for one render. `m` is measureSheet's result, `bound` is probePageBound's. */
function judgeSheet({ tag, m, probeLines, bound, cap }) {
  const out = [];
  if (!m) return [`FIT ${tag}: sheet 5 not found — a fit gate must never read "absent" as "fine"`];

  // F4a — one definition of a line. The gate and the editor's fitProbe must agree.
  if (probeLines !== m.summaryLines) {
    out.push(`FIT/F4a ${tag}: the gate counts ${m.summaryLines} summary lines and the editor's `
           + `fitProbe counts ${probeLines} — the CMS verdict and this gate are measuring `
           + `different things`);
  }
  // F2 — bounded BOTH ways. An empty box "fits" perfectly; a blank summary is a wholeness
  // failure too, and it is what a renamed leaf or a missed resolveLibObject actually produces.
  if (m.summaryLines == null || m.summaryLines < 1 || !m.summaryText) {
    out.push(`FIT/F2 ${tag}: the subtype summary rendered ${m.summaryLines} line(s) and `
           + `${m.summaryChars} characters — the box is empty or missing`);
  } else if (m.summaryLines > cap) {
    out.push(`FIT/F2 ${tag}: the subtype summary runs to ${m.summaryLines} rendered lines, over `
           + `the ${cap}-line limit the CMS holds editors to`);
  }
  // F3a — a CLEARANCE, not a non-overlap. verify_diagrams asserts labels do not overlap and its
  // own note at :241 records why that is not enough: two labels passed it at a 2.49px gap.
  if (!m.clearance) {
    out.push(`FIT/F3 ${tag}: could not measure the ring labels against the legend`);
  } else if (m.clearance.ratio < 1) {
    out.push(`FIT/F3 ${tag}: the ${m.clearance.worst.text} label clears the legend by `
           + `${m.clearance.worst.gap} user units, under its own ${m.clearance.worst.em} em — `
           + `the two are crowding`);
  }
  // F4b — the limit the editor is held to must be safe against the page.
  if (!bound || !bound.bound) {
    out.push(`FIT/F4b ${tag}: could not measure the page's own bound on summary lines`);
  } else if (bound.bound < cap + 1) {
    out.push(`FIT/F4b ${tag}: the page holds ${bound.bound} summary line(s) but the CMS lets `
           + `editors write ${cap} — a summary at the limit is one line from spilling, or `
           + `already over`);
  }
  return out;
}

/** F3b, kept separate so the allowlist stays at the call site where a reviewer sees it grow. */
function judgeOverlaps({ tag, m, allowed }) {
  if (!m || !m.overlaps) return [];
  return m.overlaps
    .filter((o) => !(allowed || []).some((a) => a.a === o.a && a.b === o.b))
    .map((o) => `FIT/F3 ${tag}: ${o.a} overlaps ${o.b} by ${o.dx}x${o.dy}px`);
}

/**
 * F1 and F2's coverage claim, across every render.
 *
 * F1's FLOOR IS ONE RENDERED SUMMARY LINE, and that is a design statement rather than a
 * restatement of the measurement: one more line of content must be able to land anywhere on this
 * sheet. enforceSheet already occupies the strict end of this axis — a second strict gate beside
 * it would just get edited the first time it fired — so this one is a warning stage, set far
 * enough below today's minimum that it fires only when something real is happening.
 *
 * The line height is MEASURED off the render rather than written down, so a font or line-height
 * change moves the floor with it instead of leaving it stale.
 */
function judgeAcross({ rows, expectedSummaries }) {
  const out = [];
  if (!rows.length) return out;
  const nums = (xs) => xs.filter((x) => typeof x === 'number');
  const headrooms = nums(rows.map((r) => r.headroom));
  const minRoom = Math.min(...headrooms);
  const lh = rows.find((r) => r.lineHeight)?.lineHeight ?? null;
  if (lh == null) {
    out.push('FIT/F1: could not measure the summary line height, so the headroom floor has no basis');
  } else if (minRoom < lh) {
    out.push(`FIT/F1: sheet 5's tightest render has ${minRoom.toFixed(2)}px of headroom, under one `
           + `rendered summary line (${lh}px). One more line of content anywhere on this sheet `
           + `would put it onto a second one.`);
  }
  // The per-render bound is worth little if the renders only ever showed nine of the twenty-seven
  // summaries. anders_sx9 sweeps 9 types x 3 instincts so all 27 SHOULD appear — asserted rather
  // than assumed, because it is a property of the matrix a later axis change could remove
  // silently.
  const codes = [...new Set(rows.map((r) => r.code).filter(Boolean))].sort();
  if (codes.length !== expectedSummaries) {
    out.push(`FIT/F2: the renders showed ${codes.length} of the ${expectedSummaries} subtype `
           + `summaries (${codes.join(' ')}) — the rest are bounded by nothing`);
  }
  return out;
}

module.exports = { measureSheet, probePageBound, assertGeoRelation, judgeSheet, judgeOverlaps, judgeAcross };
