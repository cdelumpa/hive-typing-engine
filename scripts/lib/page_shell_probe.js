'use strict';
/**
 * page_shell_probe.js — the v3 page shell's own invariant (PR 5 Build B3).
 *
 * ── WHAT THIS PROTECTS, AND WHY IT IS NOT SHEET 5'S GATE ─────────────────────────────────────
 * Every fit assertion in this repo rests on one mechanism: a `.v3-page` is sized by `min-height`,
 * so releasing that minimum reveals the NATURAL height of its content, and 1056 minus that is
 * "how much can this page grow before it spills". `measureLayout`, `enforceSheet`, `fitProbe` and
 * all of B3's F1-F4 are built on it.
 *
 * Give a `.v3-page` a fixed `height` and that mechanism stops reporting anything. Natural height
 * becomes the fixed value whatever the content is, headroom becomes a constant, and BOTH
 * enforceSheet and F1 go green forever while content is clipped. It is the worst failure in the
 * set because it does not break one assertion, it silently empties all of them — and it is one
 * line of CSS on a shared class.
 *
 * So the invariant belongs to the SHELL, not to sheet 5. It is asserted over every `.v3-page` in
 * every v3 render.
 *
 * ── TESTED BY FUNCTION, NOT BY INSPECTION ────────────────────────────────────────────────────
 * `getComputedStyle(el).height` returns a used value in px whether the height came from content
 * or from a declaration, so reading it distinguishes nothing. The probe instead ADDS a spacer of
 * known height and requires the page's natural height to grow by it. That tests the mechanism the
 * gates actually use rather than the declaration behind it, so it also catches the ways of
 * freezing a height that are not the word `height` — an absolutely-positioned shell, a
 * transform, a parent clip.
 *
 * ── THE COVER IS A DECLARED EXCEPTION, AND IT IS NOT A FREE PASS ─────────────────────────────
 * `renderer.js:3050` sets `.v3-page.is-cover{ height:1056px; min-height:1056px; overflow:hidden }`
 * deliberately — the cover is a full-bleed design, not a flowing page. That means enforceSheet and
 * F1 have ALWAYS been blind there, which was not written down anywhere until this build, and the
 * cover is the one page that cannot spill because it CLIPS instead.
 *
 * "Nothing cut off" is half of the outcome this build serves, so the exception is not simply
 * allowed: a fixed-height page is held to the assertion that fits it instead — its content must
 * not overflow its box. `FIXED_HEIGHT_ALLOWED` is the list, kept short and per-entry commented so
 * that adding a second one is a diff a reviewer sees rather than a habit.
 */

/**
 * Pages permitted to be fixed-height, each with the reason and what is asserted instead.
 * A page NOT on this list must prove its height responds to content.
 */
const FIXED_HEIGHT_ALLOWED = [
  // The cover is a full-bleed design with a background that must reach every edge; it is not a
  // flowing page and never grows. Held instead to "its content does not overflow its box", which
  // is the failure that IS reachable here — overflow:hidden means the cover clips rather than
  // spills, so a long client name is cut off in silence.
  { match: 'is-cover', why: 'full-bleed cover, renderer.js:3050' },
];

/**
 * Returns one row per `.v3-page`: whether its height responded to injected content, and whether
 * its content currently overflows its box.
 *
 * The spacer is inserted, measured and removed inside a single evaluate so no later measurement
 * on this page — including the PDF that gets written — ever sees a mutated layout.
 */
async function probePageShell(page, spacerPx) {
  return page.evaluate(`(() => {
    const px = ${spacerPx};
    const out = [];
    for (const el of document.querySelectorAll('.v3-page')) {
      // ⚠ RELEASES min-height ONLY, MIRRORING measureLayout — AND THE FIRST VERSION OF THIS
      // PROBE DID NOT, WHICH MADE IT USELESS. It also set height:'auto', which overrides a fixed
      // height from any source, inline or cascaded. So it defeated the exact condition it exists
      // to detect and reported every page as healthy: its own positive control caught it.
      //
      // measureLayout (render_client.js) releases min-height and nothing else, and it is what
      // drives enforceSheet and F1's headroom. A probe that protects a mechanism has to measure
      // through that mechanism, not through a more permissive one.
      const natural = () => {
        const pm = el.style.minHeight;
        el.style.minHeight = '0px';
        const h = el.getBoundingClientRect().height;
        el.style.minHeight = pm;
        return h;
      };
      const before = natural();
      const spacer = document.createElement('div');
      spacer.style.cssText = 'height:' + px + 'px;flex:0 0 auto';
      el.appendChild(spacer);
      const after = natural();
      spacer.remove();
      // Does the content currently exceed the box it is painted into? On a fixed-height,
      // overflow:hidden page this is the only way anything is ever lost.
      const clipped = +(el.scrollHeight - el.clientHeight).toFixed(2);
      out.push({
        cls: el.className,
        grew: +(after - before).toFixed(2),
        natural: +before.toFixed(2),
        clipped,
      });
    }
    return out;
  })()`);
}

/**
 * The predicate. Kept pure and separate so scripts/verify_quickref_fit.js can drive it with a
 * broken measurement and prove it goes red.
 */
function judgePageShell({ tag, rows, spacerPx, labels }) {
  const out = [];
  if (!rows || !rows.length) return [`SHELL ${tag}: no .v3-page found to check`];
  rows.forEach((r, i) => {
    const name = (labels && labels[i]) || `page ${i}`;
    const allowed = FIXED_HEIGHT_ALLOWED.find((a) => (r.cls || '').split(/\s+/).includes(a.match));
    if (allowed) {
      // Not a free pass — see the header. A clipping page is asserted not to be clipping.
      if (r.clipped > 1) {
        out.push(`SHELL ${tag} ${name}: fixed-height page is CLIPPING its content by `
               + `${r.clipped}px (${allowed.why}) — overflow:hidden means this is cut off, not spilled`);
      }
      return;
    }
    // 1px of slack for sub-pixel rounding; the spacer is large enough that a real freeze reads 0.
    if (r.grew < spacerPx - 1) {
      out.push(`SHELL ${tag} ${name}: adding ${spacerPx}px of content grew the page by `
             + `${r.grew}px. Its height is not driven by its content, so measureLayout, `
             + `enforceSheet and every fit assertion are measuring a constant on this page. `
             + `If this is deliberate, it belongs in FIXED_HEIGHT_ALLOWED with its reason.`);
    }
  });
  return out;
}

module.exports = { probePageShell, judgePageShell, FIXED_HEIGHT_ALLOWED };
