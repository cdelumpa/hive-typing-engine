'use strict';
/**
 * Sheet 5 ("Your Report at a Glance") — CMS preview wiring. PR 5 Build B4.
 *
 * WHY THIS IS ITS OWN FILE, AND WHY THAT IS NOT THE PR 7 EXTRACTION. app/server.js exports
 * nothing and calls app.listen() unconditionally at require time, so no test can load it — the
 * whole CMS key surface is therefore untestable, which is carded for PR 7. Moving the EXISTING
 * surface out is that card's job and deliberately not this build's: a server refactor underneath
 * a preview feature makes both harder to judge.
 *
 * But the NEW entries do not have to be born there. server.js requires this module and spreads
 * these entries into the maps cmsPreviewSpec already builds; a test requires it directly. Nothing
 * existing moves, and the surface this build adds is testable from the first commit.
 *
 * ── WHAT AN `apply` IS, AND WHY IT IS THE ONE THING WORTH TESTING ────────────────────────────
 * cmsRenderPreviewPng builds the client model with reportPrep.buildClientModel and renders it
 * with buildClientReportHTML_v3 — the SAME model builder and the SAME page builder a client
 * gets. So a preview is the client's page by construction, with exactly one divergence: `apply`
 * writes the edited value ONTO the built model, bypassing the resolveLibObject path the real
 * render uses.
 *
 * That makes `apply` the seam. An apply that writes a field the builder does not read shows the
 * editor the OLD text with no error at all — a preview that looks like it worked. Every entry
 * below is covered by a sentinel test (tests/cms_quickref_preview_test.js) that renders the page
 * and requires the sentinel to appear, which is what turns "the apply is correct" from a
 * code-review property into a mechanical one.
 *
 * ── THE SELECTOR ─────────────────────────────────────────────────────────────────────────────
 * `.v3-qr-two` appears on sheet 5 and nowhere else in the document. A bare `.v3-page` selector
 * would screenshot the FIRST match — the cover — and hand an editor "a real, plausible page that
 * is simply the wrong one", which is the p10 preview failure this repo already paid for once.
 */

const P5 = 'P5 — Your Report at a Glance';
/** Sheet 5's page element. `:has()` is load-bearing — see the header. */
const P5_SEL = '.v3-page:has(.v3-qr-two)';

/**
 * The five `static.*` sheet-5 keys.
 *
 * Each apply writes the field `_clv3QuickRef` reads, by the same path report_prep fills it on.
 * `doc: 'v3'` routes the preview through buildClientReportHTML_v3 rather than the v2 document.
 */
const STATIC_ENTRIES = {
  'static.quickref_lead_v3': {
    page: P5, selector: P5_SEL, doc: 'v3', fit: true, zone: '.lead',
    apply: (m, v) => { m.pages.v3_quickref.lead = v; },
  },
  'static.quickref_h2_v3': {
    page: P5, selector: P5_SEL, doc: 'v3', fit: true, zone: 'h2',
    apply: (m, v) => { m.pages.v3_quickref.h2 = v; },
  },
  'static.quickref_zone8_v3': {
    page: P5, selector: P5_SEL, doc: 'v3', fit: true, zone: '.v3-qr-zone8',
    apply: (m, v) => { m.pages.v3_quickref.zone8 = v; },
  },
  'static.quickref_tips_v3': {
    page: P5, selector: P5_SEL, doc: 'v3', fit: true, zone: '.v3-qr-tgrid',
    apply: (m, v) => { m.pages.v3_quickref.tips = v; },
  },
  'static.quickref_tips_heading_v3': {
    page: P5, selector: P5_SEL, doc: 'v3', fit: true, zone: '.v3-qr-tips h2',
    apply: (m, v) => { m.pages.v3_quickref.tips_heading = v; },
  },
};

/**
 * `subtype_<inst><N>.quickref_v3` — the 27 one-line summaries.
 *
 * ⚠ THE SUMMARY LIVES ON hypotheses[0].subtype, NOT ON A SIBLING KEY. Build B2a folded the
 * subtype onto the leading hypothesis precisely so nothing could attach it to the alternate;
 * writing it anywhere else here would render nothing and look like the edit did not take.
 *
 * MERGED, NOT REPLACED, for the reason the p10 instincts_v3 entry records: the editor submits
 * the field's whole object, and a missing leaf should leave the baseline standing rather than
 * blank the zone.
 *
 * The caller seeds dominant_instinct_hypothesis from the key, so the previewed page is the
 * EDITED subtype's — editing subtype_so7.quickref_v3 previews an SO-primary Type 7 sheet.
 */
function subtypeEntry() {
  return {
    // `cap: 3` is the summary's own hard bound — the .v3-qr-stxt box is 308.00px and three lines
    // is what fits (audit §26-§27). No other sheet-5 zone has a cap of its own; they are bounded
    // by the page.
    page: P5, selector: P5_SEL, doc: 'v3', fit: true, zone: '.v3-qr-stxt', cap: 3,
    apply: (m, v) => {
      const lead = (m.pages.v3_quickref.hypotheses || [])[0];
      if (!lead || !lead.subtype) throw new Error('preview: sheet 5 has no leading hypothesis subtype to apply to');
      if (v && typeof v === 'object' && v.summary != null) lead.subtype.summary = v.summary;
    },
  };
}

/**
 * ── THE FIT CHECK (P4) ───────────────────────────────────────────────────────────────────────
 *
 * WHAT IT IS FOR. The 27 summaries have a hard bound — three rendered lines in a 308.00px box —
 * and coaches can now edit them. Nothing measured a published override's rendered length:
 * assertOverrideShape checks SHAPE, and the render harness runs library values, not overrides.
 * So an editor could lengthen a summary, spill a client's page, and find out from nobody.
 *
 * This runs where the answer is already available. cmsRenderPreviewPng has a live page with the
 * whole document rendered, immediately before it screenshots — so measuring costs one evaluate,
 * and the nine-type sweep below measured at 0.3s on a reused page.
 *
 * ⚠ WORST CASE, NOT THE PREVIEWED CASE, AND THE TWO ARE DIFFERENT. A static key previews at
 * Type 9, which has 73.86px of free space; Type 1 has 51.61px. Reporting the previewed type's
 * number would be honest and useless — it asks a content editor to know that Type 1 is tighter
 * and discount accordingly, which is a fact about layout geometry and exactly the kind of thing
 * handing someone a character ceiling already failed at. The verdict covers every type the string
 * appears on; the IMAGE is labelled with the type it depicts, so the picture never quietly claims
 * to be the thing that was measured.
 *
 * A SUBTYPE key measures ONE type, and that is not a shortcut: a subtype summary appears on
 * exactly one type's sheet, so its own type IS the worst case.
 *
 * ⚠ WHAT THIS DOES NOT COVER, said here because a check that looks total is worse than one whose
 * edges are known. It catches what someone PREVIEWS. A published override that was never
 * previewed still reaches production unmeasured — that is IO-93's upstream half, and the
 * downstream half is a check over published overrides, which belongs with overrides_check.js and
 * is its own build. This does not close IO-93.
 *
 * ADVISORY, NOT BLOCKING [DECISION — Cai, 10 Sep]. The check only covers previewed edits, so
 * blocking would frustrate the people doing the right thing while giving false confidence about
 * everyone else. And advisory is the reversible choice.
 */

/** The sheet's own height budget. One page, 1056px, matching the single-sheet gate. */
const PAGE_PX = 1056;

/**
 * Runs IN the page. Returns sheet 5's intrinsic stack and the subtype box's rendered line count.
 *
 * min-height is released and restored so the NATURAL stack is measured rather than the padded
 * page box — a page that fits and a page that overflows both report 1056px otherwise.
 *
 * Lines are counted by merging Range rects on their top edge, the method every sheet-5
 * measurement in this project uses (audit §26.3): an inline <b> or a nowrap span splits one
 * visual line into several rects, so a naive getClientRects().length over-counts.
 */
const fitProbe = (zoneSel) => `(() => {
  const el = [...document.querySelectorAll('.v3-page')].find((p) => p.querySelector('.v3-qr-two'));
  if (!el) return null;
  const pm = el.style.minHeight, ph = el.style.height;
  el.style.minHeight = '0px'; el.style.height = 'auto';
  const natural = el.getBoundingClientRect().height;
  el.style.minHeight = pm; el.style.height = ph;
  const lines = (n) => {
    if (!n) return null;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const tops = new Set();
    for (const r of rg.getClientRects()) if (r.width > 0 && r.height > 0) tops.add(Math.round(r.top * 2) / 2);
    return tops.size;
  };
  // The EDITED zone, not a fixed one. A lead edit is bounded by the page in units of the lead's
  // own line height; a summary edit is bounded by its box in units of the summary's. Reporting
  // one field's spare room in another field's lines is how "52px to spare" came to mean nothing.
  const zone = ${JSON.stringify(zoneSel || null)} ? el.querySelector(${JSON.stringify(zoneSel || '')}) : null;
  const lh = zone ? parseFloat(getComputedStyle(zone).lineHeight) : null;
  return {
    natural: +natural.toFixed(2),
    zoneLines: lines(zone),
    zoneLineHeight: lh && !Number.isNaN(lh) ? +lh.toFixed(2) : null,
    summaryLines: lines(el.querySelector('.v3-qr-stxt')),
  };
})()`;

/**
 * Turn the worst measured type into something an editor can act on.
 *
 * THE WORDING IS THE POINT, not the mechanism. "Over the recommended length" tells someone a
 * rule they then have to interpret. "This will push the page onto a second sheet" tells them what
 * happens. [Cai, 10 Sep]
 */
function fitVerdict(worst, opts) {
  const o = opts || {};
  if (!worst) return { ok: null, message: 'Fit could not be measured — sheet 5 was not found in the preview.' };
  const free = +(PAGE_PX - worst.natural).toFixed(2);

  // WHERE THE MEASUREMENT CAME FROM, and it differs by key. A static string appears on all nine
  // types, so nine were surveyed and the tightest is worth naming. A subtype summary appears on
  // exactly ONE type's sheet — saying "the tightest type" there implies a survey that did not
  // happen and could not have.
  const where = o.surveyed > 1
    ? ` Checked on all ${o.surveyed} types; Type ${worst.type} is tightest.`
    : ` On the Type ${worst.type} page.`;

  if (free < 0) {
    return { ok: false, ...worst, freePx: free,
      message: `This will push the page onto a second sheet — ${Math.abs(free).toFixed(0)}px past the bottom.${where}` };
  }
  // A zone with its own hard bound reports against that bound. Only the summary has one.
  if (o.cap != null && worst.zoneLines != null) {
    if (worst.zoneLines > o.cap) {
      return { ok: false, ...worst, freePx: free,
        message: `This runs to ${worst.zoneLines} lines. ${cap1(cardinal(o.cap))} is the most that fits — a `
               + `${ordinal(o.cap + 1)} pushes the page onto a second sheet.${where}` };
    }
    const all = worst.zoneLines === o.cap ? 'all ' : '';
    return { ok: true, ...worst, freePx: free,
      message: `Fits — using ${all}${worst.zoneLines} of the ${o.cap} lines available.${where}` };
  }
  // No hard bound: the page is the bound, priced in THIS zone's own lines so the cost of another
  // sentence is legible before it is written.
  if (worst.zoneLines != null && worst.zoneLineHeight) {
    const room = Math.floor(free / worst.zoneLineHeight);
    const spare = room <= 0
      ? 'no room for another line'
      : `room for about ${room} more line${room === 1 ? '' : 's'}`;
    return { ok: true, ...worst, freePx: free,
      message: `Fits — using ${worst.zoneLines} line${worst.zoneLines === 1 ? '' : 's'}, with ${spare} before the page runs onto a second sheet.${where}` };
  }
  return { ok: true, ...worst, freePx: free, message: `Fits.${where}` };
}

/** Small helpers so the cap message reads "Three is the most … a fourth", not "3 … a 4th". */
const cap1 = (w) => w.charAt(0).toUpperCase() + w.slice(1);
function cardinal(n) {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] || String(n);
}
function ordinal(n) {
  return ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'][n] || `${n}th`;
}

module.exports = { P5, P5_SEL, STATIC_ENTRIES, subtypeEntry, fitProbe, fitVerdict, PAGE_PX };
