'use strict';
/**
 * devideas_fit.js — the ONE definition of "fits" for sheet 11, Development Ideas (PR 6 Build B1).
 *
 * Read by scripts/render_client.js (CI, every v3 render), by scripts/verify_devideas_fit.js (the
 * controls that prove each check can fail), and from Build B2 by the CMS preview and the publish
 * gate. Lives in app/ because the server needs it; a copy in scripts/ would be a second definition
 * that agrees with this one until it doesn't — the Build B4 lesson.
 *
 * Two halves:
 *   · PROBE runs inside the page and returns measurements. It MEASURES; it never decides.
 *   · The judges (judgeD1..judgeD4, judgeAcross) are pure: a probe in, failure messages out, so a
 *     test can drive every one of them without a browser.
 *
 * The four checks are the PR 6 criteria, asserted over the RENDERED page:
 *   D1 · C1  one sheet, and the height model still true
 *   D2 · C2  three cards of one shape, rails stretched, nothing past its column
 *   D3 · C3  every Field Experiment is a bold "Label:" followed by body text
 *   D4 · C4  the rail descriptions, titles, lead and closing note are the library's, on every type
 */

const PAGE_PX = 1056;
const SHEET_SEL = '.v3-page:has(.v3-di-card)';

/**
 * THE HEIGHT MODEL — measured, not derived, on `4382369` with the pinned Chromium and Arial
 * asserted (PR 6 Build B audit). The page's natural height is
 *
 *     fixed + Σ over the three cards of max(cardFloor, cardPad + line × lines + itemGap × (items − 1))
 *
 * `fixed` is everything that is not a card: header, rule, eyebrow, H1, the two-line lead, the two
 * 26px gaps between cards, the two-line closing note and the footer. `cardFloor` is the rail's own
 * content (title + three-line description + padding): a card never gets shorter than its rail, so
 * a very short section costs the floor, not its lines. The straight-line formula in the PR 6 audit
 * (591.12 − 18.75L − 6(N−3)) is this model while every card is taller than its rail.
 *
 * ASSERTED ON EVERY RENDER (judgeD1). The author guidance in design spec §6 is derived from these
 * numbers, so a CSS or global-copy change that moves them must fail CI rather than leave that
 * guidance silently wrong. Change them together, never one without the other.
 */
const MODEL = {
  fixed: 368.88,
  cardFloor: 108.02,
  cardPad: 32,
  line: 18.75,
  itemGap: 6,
  // A two-line page header costs exactly this much more than a one-line one (measured on all nine).
  headerWrap: 11,
  tolerance: 0.5,
};

/**
 * THE LONG-NAME RESERVE (decision D-B2). A long client name wraps the page header onto a second
 * line and costs every page 11px. What is reserved is that WRAPPED HEADER, not a character count:
 * measured, the wrap begins anywhere from 72 to 78 characters depending on the type's name and on
 * the letters in the name itself, so a count would be the proxy spec §6 keeps striking. This name
 * wraps the header on all nine types, and judgeD1 asserts it did — a reserve pass whose header
 * stayed on one line would be measuring nothing.
 *
 * No hyphens, deliberately: the name is escaped but not no-break protected in the header, and a
 * hyphen would add a break the render check's hyphen sweep does not expect.
 */
const LONG_NAME = {
  first_name: 'Maximiliana Alexandrine',
  last_name: 'Beaumont Delacroix Wennerstrom Okonkwo Fitzgerald Santiago',
};

/**
 * The canonical H1 plurals, WRITTEN OUT rather than derived from TYPE_NAMES — deriving them would
 * pass whatever TYPE_NAMES says. PR 6 Build A's report_pages_test records the same reasoning.
 */
const CANON_PLURAL = {
  1: 'Improvers', 2: 'Givers', 3: 'Performers', 4: 'Individualists', 5: 'Observers',
  6: 'Questioners', 7: 'Enthusiasts', 8: 'Protectors', 9: 'Peacemakers',
};

const SECTIONS = ['growth', 'inquiries', 'experiments'];

const spills = (natural) => natural > PAGE_PX;

/**
 * The model's prediction for a set of cards. A card's `items` may be a count or the probe's item
 * array — the first version took only a count, was handed the probe's array, and computed NaN, which
 * made judgeD1's drift check unable to fail (NaN compares false). tests/devideas_fit_test.js caught it.
 */
function modelHeight(cards, { headerLines = 1 } = {}) {
  const body = cards.reduce((sum, c) => {
    const items = Array.isArray(c.items) ? c.items.length : c.items;
    return sum + Math.max(MODEL.cardFloor, MODEL.cardPad + MODEL.line * c.lines + MODEL.itemGap * (items - 1));
  }, 0);
  return +(MODEL.fixed + body + (headerLines > 1 ? MODEL.headerWrap : 0)).toFixed(2);
}

/**
 * PROBE — evaluated in the page: `page.evaluate(PROBE, SHEET_SEL)`. Self-contained on purpose;
 * it is serialized into the browser and can reach nothing in this module.
 *
 * Natural height releases ONLY min-height, per scripts/lib/page_shell_probe.js: also setting
 * `height:auto` would defeat the frozen-height case that module exists to catch.
 */
function PROBE(sel) {
  const page = document.querySelector(sel);
  if (!page) return null;
  const lineCount = (el) => {
    const r = document.createRange(); r.selectNodeContents(el);
    const tops = new Set();
    for (const x of r.getClientRects()) if (x.width > 0 && x.height > 0) tops.add(Math.round(x.top * 2) / 2);
    return tops.size;
  };
  const textRight = (el) => {
    const r = document.createRange(); r.selectNodeContents(el);
    let right = -Infinity;
    for (const x of r.getClientRects()) if (x.width > 0) right = Math.max(right, x.right);
    return right;
  };
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  const round = (n) => +n.toFixed(2);

  const prev = page.style.minHeight;
  page.style.minHeight = '0px';
  const natural = page.getBoundingClientRect().height;
  page.style.minHeight = prev;

  const hdr = page.querySelector('.page-header .header-right');
  const cards = [...page.querySelectorAll('.v3-di-card')].map((card) => {
    const rails = card.querySelectorAll(':scope > .v3-di-rail');
    const bodies = card.querySelectorAll(':scope > .v3-di-body');
    const rail = rails[0], body = bodies[0];
    const cr = card.getBoundingClientRect();
    const rr = rail ? rail.getBoundingClientRect() : null;
    let contentRight = null;
    if (body) {
      const cs = getComputedStyle(body);
      contentRight = body.getBoundingClientRect().right - parseFloat(cs.paddingRight);
    }
    const items = body ? [...body.querySelectorAll('.v3-di-txt')].map((t) => {
      const first = t.firstElementChild;
      const lead = first && first.tagName === 'B' && t.firstChild === first ? text(first) : null;
      const rest = lead != null ? text({ textContent: t.textContent.slice(first.textContent.length) }) : null;
      return { lines: lineCount(t), bold: !!t.querySelector('b'), lead, rest, right: round(textRight(t)) };
    }) : [];
    return {
      key: card.getAttribute('data-di'),
      rails: rails.length, bodies: bodies.length,
      height: round(cr.height),
      railLeft: rr ? round(rr.left) : null, railWidth: rr ? round(rr.width) : null, railHeight: rr ? round(rr.height) : null,
      contentRight: contentRight == null ? null : round(contentRight),
      title: text(rail && rail.querySelector('h2')), desc: text(rail && rail.querySelector('.note')),
      items, lines: items.reduce((s, i) => s + i.lines, 0),
    };
  });
  return {
    natural: round(natural),
    headerLines: hdr ? lineCount(hdr) : 0,
    h1: text(page.querySelector('h1')),
    lead: text(page.querySelector('.lead')),
    coda: text(page.querySelector('.v3-di-coda')),
    cards,
  };
}

// ── Judges — pure. A probe in, failure messages out. ─────────────────────────────────────────

/** D1 · C1. One sheet, and the model still describes the page. */
function judgeD1({ tag, probe, longName = false }) {
  if (!probe) return [`D1 ${tag}: sheet 11 not found in the rendered document`];
  const out = [];
  if (spills(probe.natural)) {
    out.push(`D1 ${tag}: sheet 11 spills — natural height ${probe.natural}px > ${PAGE_PX}px, `
      + `about ${Math.ceil((probe.natural - PAGE_PX) / MODEL.line)} line(s) over`);
  }
  const model = modelHeight(probe.cards, { headerLines: probe.headerLines });
  // Not-finite fails LOUDLY. A NaN here once made the comparison below false on every render.
  if (!Number.isFinite(model) || !Number.isFinite(probe.natural)) {
    out.push(`D1 ${tag}: the height model could not be computed (model ${model}, measured ${probe.natural})`);
  } else if (Math.abs(probe.natural - model) > MODEL.tolerance) {
    out.push(`D1 ${tag}: the height model no longer describes sheet 11 — measured ${probe.natural}px, `
      + `model ${model}px. Update MODEL in app/devideas_fit.js and the design spec §6 guidance together`);
  }
  if (longName && probe.headerLines !== 2) {
    out.push(`D1 ${tag}: the long-name pass rendered a ${probe.headerLines}-line header, not 2 — `
      + `the wrapped-header reserve was not exercised`);
  }
  return out;
}

/** D2 · C2. Three cards of one shape, in order, rails stretched, nothing past its column. */
function judgeD2({ tag, probe }) {
  if (!probe) return [`D2 ${tag}: sheet 11 not found`];
  const out = [];
  const keys = probe.cards.map((c) => c.key).join(',');
  if (keys !== SECTIONS.join(',')) out.push(`D2 ${tag}: cards are [${keys}], want [${SECTIONS.join(',')}]`);
  for (const c of probe.cards) {
    if (c.rails !== 1 || c.bodies !== 1) out.push(`D2 ${tag}: card "${c.key}" has ${c.rails} rail(s) and ${c.bodies} body(ies), want 1 and 1`);
    if (c.railHeight != null && Math.abs(c.railHeight - c.height) > 0.5) {
      out.push(`D2 ${tag}: card "${c.key}" rail is ${c.railHeight}px in a ${c.height}px card — the rail must run the card's full height`);
    }
    if (!c.items.length) out.push(`D2 ${tag}: card "${c.key}" has no items`);
    const wide = c.items.filter((i) => c.contentRight != null && i.right > c.contentRight + 0.5);
    for (const w of wide) out.push(`D2 ${tag}: card "${c.key}" has text ${(w.right - c.contentRight).toFixed(1)}px past its column`);
  }
  const widths = new Set(probe.cards.map((c) => c.railWidth)), lefts = new Set(probe.cards.map((c) => c.railLeft));
  if (widths.size > 1) out.push(`D2 ${tag}: rail widths differ (${[...widths].join(', ')})`);
  if (lefts.size > 1) out.push(`D2 ${tag}: rails do not share a left edge (${[...lefts].join(', ')})`);
  return out;
}

/** D3 · C3. Every experiment is a bold "Label:" then body text; the other two lists carry no bold. */
function judgeD3({ tag, probe }) {
  if (!probe) return [`D3 ${tag}: sheet 11 not found`];
  const out = [];
  for (const c of probe.cards) {
    c.items.forEach((i, n) => {
      if (c.key === 'experiments') {
        if (i.lead == null) out.push(`D3 ${tag}: experiment ${n + 1} does not open with a bold label`);
        else if (!/^.+:$/.test(i.lead)) out.push(`D3 ${tag}: experiment ${n + 1}'s bold label "${i.lead}" does not end in a colon`);
        if (i.lead != null && !i.rest) out.push(`D3 ${tag}: experiment ${n + 1} has a label and no body`);
      } else if (i.bold) {
        out.push(`D3 ${tag}: ${c.key} item ${n + 1} carries bold — only Field Experiments have a bold label`);
      }
    });
  }
  return out;
}

/**
 * D4 · C4. The strings that are the same on every type are exactly the library's, and the H1 is the
 * canonical plural. `expected` is { titles, rails, lead, coda } from the content library; `type` is
 * the page's hero type. Compared as text, because that is what the client reads.
 */
function judgeD4({ tag, probe, expected, type }) {
  if (!probe) return [`D4 ${tag}: sheet 11 not found`];
  const out = [];
  const wantH1 = `Development Ideas for ${CANON_PLURAL[type]}`;
  if (probe.h1 !== wantH1) out.push(`D4 ${tag}: H1 is "${probe.h1}", want "${wantH1}"`);
  if (probe.lead !== expected.lead) out.push(`D4 ${tag}: the lead is not the library's`);
  if (probe.coda !== expected.coda) out.push(`D4 ${tag}: the closing note is not the library's`);
  for (const c of probe.cards) {
    if (!SECTIONS.includes(c.key)) continue;
    if (c.title !== expected.titles[c.key]) out.push(`D4 ${tag}: the "${c.key}" title is "${c.title}", want "${expected.titles[c.key]}"`);
    if (c.desc !== expected.rails[c.key]) out.push(`D4 ${tag}: the "${c.key}" rail description is not the library's`);
  }
  return out;
}

/** D4 across renders: the shared strings are identical on every page, whatever the type. */
function judgeAcross({ rows }) {
  const shared = new Set(rows.map((r) => r.shared));
  return shared.size > 1
    ? [`D4 across renders: the rail descriptions, titles, lead and closing note take ${shared.size} forms across ${rows.length} renders — they must be one`]
    : [];
}

/** The cross-render fingerprint judgeAcross compares. */
const sharedOf = (probe) => JSON.stringify({ lead: probe.lead, coda: probe.coda,
  rails: probe.cards.map((c) => [c.key, c.title, c.desc]) });

module.exports = {
  PAGE_PX, SHEET_SEL, MODEL, LONG_NAME, CANON_PLURAL, SECTIONS,
  spills, modelHeight, PROBE, judgeD1, judgeD2, judgeD3, judgeD4, judgeAcross, sharedOf,
};
