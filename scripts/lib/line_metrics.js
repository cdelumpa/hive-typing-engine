'use strict';
/**
 * Rendered line geometry — the measurement core, out of `spike/` and into a reusable place.
 *
 * WHAT THIS IS FOR. Design spec §6.1 requires matched line counts between paired columns on
 * sheets 6 and 7. That rule has been in the spec since it was written and was never enforced,
 * because line count cannot be derived from content: it is a function of character count, word
 * shapes AND column width, so it requires rendering. This module is what makes it measurable
 * from the real render path rather than from a scratch script.
 *
 * The implementation is lifted from `scripts/spike/explore_fit_probe.js`, which is where it was
 * proven. That probe now consumes this module rather than carrying its own copy, so there is one
 * definition of "how many lines is this".
 *
 * HOW A LINE IS COUNTED. A `Range` over an element's contents yields one client rect per line
 * box. Rects are then merged by top edge, because an inline `<b>` label, a `_v3NoBreak` span or
 * any other inline child splits a single visual line into several rects that share a top. Naive
 * `getClientRects().length` therefore over-counts any zone with inline markup — which on these
 * sheets is every Strengths/Challenges item.
 *
 * ONE FIX ON EXTRACTION. The spike sorted merged rects by `a.top - b.top` while the merged
 * objects carried only `{l, r}` — no `top` — so the comparator returned NaN and the sort was a
 * no-op. Line COUNTS were unaffected, and every published count from that probe stands. But the
 * ORDER of returned widths was accidental (it happened to be right because `getClientRects()`
 * returns document order and `Map` preserves insertion order), and anything reading "the last
 * line" was relying on that accident. `top` is now carried and the sort is real.
 *
 * BROWSER SIDE, INJECTED AS SOURCE. These helpers run inside the page, so they cannot be
 * `require`d there. `install(page)` evaluates them into `window.__lineMetrics`; callers then
 * evaluate their own functions against that namespace.
 */

/** Injected verbatim into the page. Keep self-contained — it cannot close over anything here. */
const BROWSER_SRC = `(() => {
  const lineRects = (n) => {
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const raw = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    const m = new Map();
    for (const r of raw) {
      const k = Math.round(r.top * 2) / 2, c = m.get(k);
      if (!c) m.set(k, { top: k, l: r.left, r: r.right });
      else { c.l = Math.min(c.l, r.left); c.r = Math.max(c.r, r.right); }
    }
    return [...m.values()].sort((a, b) => a.top - b.top).map(v => ({ top: v.top, width: v.r - v.l }));
  };

  const lineCount = (n) => (n ? lineRects(n).length : 0);

  /** Total rendered lines across every node matching \`sel\` within \`root\`. */
  const columnLines = (root, sel) =>
    [...root.querySelectorAll(sel)].reduce((a, n) => a + lineCount(n), 0);

  /**
   * Content-box width. NOT \`getBoundingClientRect().width\`: several of these zones are flex
   * children that shrink to their own content, so a short string reports a box narrower than
   * the space it actually had.
   */
  const contentBox = (n) => {
    const cs = getComputedStyle(n);
    return +(n.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)).toFixed(2);
  };

  /**
   * Last-line fill as a fraction of the widest line in the same zone.
   *
   * Measured against the widest RENDERED line rather than the content box: a flex child that
   * shrinks to content reports a box equal to its own longest line, which would make every
   * such zone read as 100% full. The widest line is the real reference for "does the last line
   * look stranded".
   */
  const lastLineFill = (n) => {
    const rects = lineRects(n);
    if (rects.length < 2) return null;          // a single line is never a stranded line
    const widest = Math.max(...rects.map(r => r.width));
    return widest > 0 ? +(rects[rects.length - 1].width / widest).toFixed(4) : null;
  };

  window.__lineMetrics = { lineRects, lineCount, columnLines, contentBox, lastLineFill };
})()`;

/** Evaluate the helpers into the page. Idempotent. */
async function install(page) {
  await page.evaluate(BROWSER_SRC);
}

/**
 * Matched line counts for a set of paired columns.
 *
 * `pairs` entries are `{ name, pageKey, a: {label, root, sel}, b: {…} }`. `root` is a selector
 * resolved within the page element; omit `sel` to measure `root` itself as a single zone.
 * Returns one row per pair with both line counts and whether they match.
 */
async function measurePairs(page, pageIndexByKey, pairs) {
  await install(page);
  return page.evaluate((pageIndexByKey, pairs) => {
    const L = window.__lineMetrics;
    const pages = [...document.querySelectorAll('.v3-page')];
    const side = (pageEl, spec) => {
      const root = spec.root ? pageEl.querySelector(spec.root) : pageEl;
      if (!root) return { lines: null, missing: spec.root };
      return { lines: spec.sel ? L.columnLines(root, spec.sel) : L.lineCount(root) };
    };
    return pairs.map((p) => {
      const idx = pageIndexByKey[p.pageKey];
      const pageEl = idx == null ? null : pages[idx];
      if (!pageEl) return { name: p.name, skipped: `page "${p.pageKey}" not in this document` };
      const a = side(pageEl, p.a), b = side(pageEl, p.b);
      return {
        name: p.name, pageKey: p.pageKey,
        aLabel: p.a.label, bLabel: p.b.label,
        a: a.lines, b: b.lines,
        missing: a.missing || b.missing || null,
        match: a.lines != null && b.lines != null && a.lines === b.lines,
      };
    });
  }, pageIndexByKey, pairs);
}

/** Per-zone line count and last-line fill, for named zones. */
async function measureZones(page, pageIndexByKey, zones) {
  await install(page);
  return page.evaluate((pageIndexByKey, zones) => {
    const L = window.__lineMetrics;
    const pages = [...document.querySelectorAll('.v3-page')];
    return zones.map((z) => {
      const idx = pageIndexByKey[z.pageKey];
      const pageEl = idx == null ? null : pages[idx];
      if (!pageEl) return { name: z.name, skipped: `page "${z.pageKey}" not in this document` };
      const nodes = [...pageEl.querySelectorAll(z.sel)];
      const n = z.nth == null ? nodes[0] : nodes[z.nth];
      if (!n) return { name: z.name, skipped: `no match for ${z.sel}${z.nth == null ? '' : ` [${z.nth}]`}` };
      return {
        name: z.name, pageKey: z.pageKey,
        chars: n.textContent.replace(/\s+/g, ' ').trim().length,
        lines: L.lineCount(n),
        width: L.contentBox(n),
        fill: L.lastLineFill(n),
      };
    });
  }, pageIndexByKey, zones);
}

module.exports = { BROWSER_SRC, install, measurePairs, measureZones };
