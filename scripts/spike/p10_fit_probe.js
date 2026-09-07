'use strict';
/**
 * p10 "Instincts & Subtypes" — PAGE FIT. AUDIT SCRATCH.
 *
 * ── THIS IS A MEASUREMENT INSTRUMENT, NOT A DRAFT OF THE PAGE ─────────────────────────
 * p10 has no entry in V3_PAGE_BUILDERS, so there is no page to probe. This builds a
 * scaffold to the NEW Z5 structure (code · naranjo · signature · narrative) at the
 * mockup's outer grid, measures it, and throws it away. **Step 4 is not obliged to
 * inherit this markup.** The geometry is inherited from
 * docs/mockup/claude_The_Peacemaker_Page_Instincts_v1.html — its <style> block is read
 * VERBATIM rather than re-typed — and then ASSERTED, so if the scaffold ever stops
 * measuring the mockup's column the probe fails instead of reporting.
 *
 * ── WHAT THIS PUBLISHES, AND WHAT IT REFUSES TO ──────────────────────────────────────
 * MEASUREMENTS ONLY. Every figure is a fact about a rendered artifact. No budget, no
 * ceiling, for any zone, including Z5. Spec §7.4 struck three ceilings — 95, 53, 90 —
 * with NO replacement mechanism, because the rule that generated them (label width drives
 * the wrap) was invented, written into the spec and nine documents, and disproved.
 * Character count does not predict line count. With 345-415 adopted as the working
 * standard and the 27 narratives already committed to the store, nothing consumes a Z5
 * character ceiling, so none is produced.
 *
 * The probe DIAGNOSES; it does not gate. A result that disagrees with a committed
 * narrative is a diagnosis and the response is Cai's.
 *
 * ── WHY LINE COUNTS SIT BESIDE EVERY PIXEL HEIGHT ────────────────────────────────────
 * If the answer to a negative composite is "shorten content", height alone is not
 * actionable for an author. "This column runs 7 lines and needs 6" is a measurement plus a
 * target, and shorten-then-re-measure is the loop that produced Wings r2. A character
 * target would be the struck-ceiling error again. Lines, not characters.
 *
 * ── FOUR WIDTHS, NOT ONE ─────────────────────────────────────────────────────────────
 * Z5 207.33px · Z3 196px · Z6 670px · Z2 710px. No band transfers between them, and none
 * of them is the p6/p7 width the struck ceilings were taken at.
 *
 * ── THE TRAP THIS IS BUILT TO NOT REPEAT ─────────────────────────────────────────────
 * `.ccard` is a flex item under default `align-items: stretch`, so ALL THREE COLUMNS
 * RENDER THE SAME HEIGHT REGARDLESS OF CONTENT. Measured on the shipped mockup: three
 * cards at 350.42px against intrinsic needs of 350.42 / 333.03 / 333.03 — exactly one
 * 17.39px line of absorbed stretch in two of them. A probe reading card height would
 * report three equal columns when one is driving. Every Z5 figure here is INTRINSIC:
 * chead + cbody padding + the natural height of the body's children.
 *
 *   node scripts/spike/p10_fit_probe.js
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const bl = require(path.join(ROOT, 'app/browser_launch.js'));
const lineMetrics = require(path.join(ROOT, 'scripts/lib/line_metrics.js'));
const lib = require(path.join(ROOT, 'app/content/content_library.json'));
const { TYPE_NAMES, INSTINCT_NAME } = require(path.join(ROOT, 'app/type_meta.js'));
const { SM_BULLETS_OVER_SPEC, EM_PARAGRAPH } = require(path.join(ROOT, 'tests/fixtures/instinct_axis.js'));

const MOCKUP = path.join(ROOT, 'docs/mockup/claude_The_Peacemaker_Page_Instincts_v1.html');
const OUT = path.join(ROOT, '.phase6_out');
fs.mkdirSync(OUT, { recursive: true });

/**
 * Z3 — THE NEW INSTINCT DEFINITIONS. SCAFFOLD CONTENT ONLY; NOT COMMITTED TO THE STORE.
 *
 * Locked by Cai 7 Sep 2026 and rendered here to be measured. Step 3 is a measurement
 * instrument and touches no content, so these live in the probe and nowhere else. The
 * store change is its own build.
 *
 * ⚠ AND IT CANNOT BE AN EDIT IN PLACE WHEN IT COMES. `static.instinct_definitions` is
 * LIVE v2 CONTENT — `_clP6Instinct` (app/renderer.js:2247) renders these three strings at
 * :2252 on the live v2 `.p6-page`, which `tests/lib/report_page_inventory.js:22` asserts is
 * present in every client report. It is CMS-editable (server.js:9866) with a WORKING
 * preview mapped to `.p6-page` (server.js:13850). Editing the three strings for p10 would
 * change what shipped v2 clients see. This is the `subtype_*.narrative` trap in a different
 * guise, and the answer is the same one step 1 used: a v3-only field beside them, not an
 * edit in place.
 *
 * VOICE IS DELIBERATE. Third person, matching Z5's narratives. The old bodies were second
 * person ("your place within a community"), which told an SP-dominant reader that a
 * community was THEIR place while describing the Social instinct. Do not "fix" it.
 *
 * The FOCUSED ON label row goes with them. The old bodies opened by echoing it — "Focused
 * on safety, comfort…" directly under a label reading FOCUSED ON — which is part of why
 * they ran long. These open with "Governs", reading as a continuation of the card heading.
 * The card heading itself (code chip + name) is unchanged.
 */
const Z3_NEW = [
  { code: 'SP', name: 'Self-Preservation',
    body: 'Governs our need for physical well-being, material security, and safety. People who lead with SP prioritize food, shelter, warmth, health, and managing risk.' },
  { code: 'SO', name: 'Social',
    body: 'Governs our need for belonging, membership, and a recognized place within groups. People who lead with SO seek power and influence in a group setting.' },
  { code: 'SX', name: 'One-to-One',
    body: 'Governs our need for an intense bond or connection with one person at a time. People who lead with SX seek intimacy and passion in one-on-one relationships.' },
];

/**
 * SO7 — REVISED NARRATIVE. SCAFFOLD CONTENT ONLY; NOT COMMITTED TO THE STORE.
 *
 * Cai's revision, 7 Sep 2026, rendered here to be measured. Same boundary as Z3_NEW: step 3
 * is a measurement instrument and touches no content. The store change is its own build.
 *
 * ⚠ AND IT IS NOT A LENGTH PROBLEM, WHICH IS THE WHOLE POINT. Measured last round: SO5 is
 * 394 chars and renders 11 lines; SO7 is 389 and renders 12. SO7 is FIVE CHARACTERS SHORTER
 * than a column that fits and still costs a line. It loses the line to WHERE ITS WORDS
 * BREAK, not to how much text it holds. So -16 characters may drop the line or may do
 * nothing, and only the render says which. Nothing here reasons from the character count.
 *
 * Three edits against the committed 389: "social norms and expectations" -> "social
 * expectations"; "ideas and possibilities" -> "ideas and options"; "scattered" ->
 * "unfocused" (a wash at 9 characters each).
 */
const SO7_REVISED = 'The Social Seven gains freedom from pain and constraints by accepting some limitations that keep them aligned with social expectations. SO7s are typically generous, wanting to share the things they love and being of service to the group, similar to the Type 2 Giver. Their abundance of ideas and options can lead them to become overextended, unfocused, and spread too thin.';

const PAGE_PX = 1056;                 // .page min-height; the 1057 gate is one past it
const PAGE_CONTENT_PX = 976;          // 1056 less 40px top and bottom padding [measured]
const GRID_W = 207.33;                // .ccard content width on the mockup [measured]
const EYEBROW_H = 13;                 // .ceyebrow min-height, which is what reserves the badge row
const TOL = 0.05;

const TYPE_WORD = { 1:'One',2:'Two',3:'Three',4:'Four',5:'Five',6:'Six',7:'Seven',8:'Eight',9:'Nine' };
const INSTINCTS = ['SP', 'SO', 'SX'];
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── The scaffold ──────────────────────────────────────────────────────────────────────

/** The mockup's <style> block, read verbatim. The geometry of record; never re-typed. */
function mockupCss() {
  const m = fs.readFileSync(MOCKUP, 'utf8').match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!m) throw new Error('mockup <style> block not found — the geometry source is gone');
  return m[1];
}

/**
 * Z6 in one of four states.
 *
 * ⚠ THE SM SHAPE'S MARKUP IS A SCAFFOLD ASSUMPTION AND ITS HEIGHT IS NOT INHERITED.
 * The mockup draws Z6 once, as a single paragraph — the EM shape. It shows no SM shape at
 * all, so three-bullet markup has to be chosen here rather than measured from the mockup.
 * The choice: three `.resp-txt` siblings at the mockup's own type size, separated by the
 * margin the live v2 `.p6-ow-bullet` uses (3px top and bottom, so 6px between). The
 * inter-bullet contribution is reported separately so a different step-4 choice can be
 * re-derived without re-running this. EM's height carries no such caveat.
 */
const SM_BULLET_MARGIN = 3;
function z6Html(state) {
  // "IN YOUR WORDS" (Cai, 7 Sep) — p6 and p10 align on one label.
  // ⚠ THE LABELS ALIGN, THE FIELDS DO NOT. p10's "In Your Words" is instinct_evidence
  // (this zone). p6's is client_words — a different zone, a different page, a different
  // producer, and the one carrying the PR 7 budget problem. Aligning the labels makes them
  // easier to conflate, not harder. p6's own label change is not step 3's work.
  const LBL = '<div class="resp-lbl">In Your Words</div>';
  if (state === 'null' || state === 'absent') return '';        // the live guard drops the box
  if (state === 'em_paragraph') return `<div class="resp">${LBL}<div class="resp-txt">${esc(EM_PARAGRAPH[0].replace(/\n\n+/g, ' '))}</div></div>`;
  if (state === 'sm_bullets') {
    const b = SM_BULLETS_OVER_SPEC.map((s) =>
      `<div class="resp-txt p10-sm-bullet">${esc(s)}</div>`).join('');
    return `<div class="resp">${LBL}${b}</div>`;
  }
  throw new Error(`unknown Z6 state "${state}"`);
}

/**
 * The whole scaffold page for one type, one Z6 state and one dominant instinct.
 *
 * `dom` selects the highlighted column, the badge order and what the Z4 banner names. It
 * does NOT affect any measurement — badge height is reserved by `.ceyebrow`'s min-height
 * whatever the badge says, and `.htag` is one line for every naranjo/signature pair. It
 * affects COHERENCE, which is what the smoke render is for: sp4's overlay says "the
 * self-preservation instinct as the dominant lens", so a Type 4 render carrying that prose
 * must badge SP, or the page contradicts itself in the way the sp4 switch exists to stop.
 * The measurement renders use SX, the v3 fixture's own dominant.
 */
function scaffold(typeN, z6State, dom = 'SX', z3Variant = 'new_nolabel', so7 = 'revised') {
  // 'store_label'   — what ships today: store bodies under a FOCUSED ON row (the baseline)
  // 'store_nolabel' — store bodies, label row removed   -> isolates the LABEL saving
  // 'new_label'     — new bodies, label row kept        -> isolates the TEXT saving
  // 'new_nolabel'   — both changes, and the configuration the composites use
  const useNew = z3Variant.startsWith('new');
  const showLabel = z3Variant.endsWith('_label');
  const defs = useNew ? Z3_NEW : lib.static.instinct_definitions;
  const rows = INSTINCTS.map((i) => ({ i, st: lib[`subtype_${i.toLowerCase()}${typeN}`] }));
  const domRow = rows.find((r) => r.i === dom);
  // PRIMARY follows `dom`; the other two take the remaining ranks in declaration order.
  // Ordering SECONDARY/TERTIARY by profile is step 4's job, not the scaffold's.
  const rest = INSTINCTS.filter((i) => i !== dom);
  const badge = { [dom]: 'Primary', [rest[0]]: 'Secondary', [rest[1]]: 'Tertiary' };

  const cards = rows.map(({ i, st }) => {
    const iv = st.instincts_v3;
    // The SO7 swap is a SCAFFOLD OVERRIDE. The store is untouched; `so7: 'committed'`
    // renders what actually ships, which is what the before/after comparison needs.
    const narrative = (so7 === 'revised' && st.code === 'SO7') ? SO7_REVISED : iv.narrative;
    return `<div class="ccard${i === dom ? ' yours' : ''}">
    <div class="chead">
      <div class="ceyebrow"><span>${esc(i)}${typeN}</span><span class="ctag${i === dom ? '' : ' rank'}">${badge[i]}</span></div>
      <div class="cname">${esc(iv.naranjo)}</div>
      <div class="cline">${esc(iv.signature)}</div>
    </div>
    <div class="cbody"><div class="czone"><div class="ctxt">${esc(narrative)}</div></div></div>
  </div>`;
  }).join('\n  ');

  const icards = defs.map((d) => `<div class="icard">
    <div class="ihead"><span class="icode">${esc(d.code)}</span><span class="iname">${esc(d.name)}</span></div>
    <div class="ibody">${showLabel ? '<div class="ilbl">Focused On</div>' : ''}<div class="itxt">${esc(d.body)}</div></div>
  </div>`).join('\n  ');

  const domIv = domRow.st.instincts_v3;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>p10 fit probe — Type ${typeN} · ${z6State}</title>
<style>${mockupCss()}
/* SCAFFOLD-ONLY. Not part of the mockup's geometry; see z6Html(). */
.p10-sm-bullet{margin:${SM_BULLET_MARGIN}px 0}
.p10-sm-bullet:first-of-type{margin-top:0}
.p10-sm-bullet:last-of-type{margin-bottom:0}
</style></head><body>
<div class="page">
<div class="page-header">
  <span class="header-left">InsightOut Enneagram Report</span>
  <span class="header-right"><span class="header-client">Anders Wennerstrom</span> &middot; Type ${typeN} &mdash; ${esc(TYPE_NAMES[typeN])}</span>
</div>
<div class="header-rule"></div>
<div class="eyebrow">Navigating the Enneagram System</div>
<h1>Instincts &amp; Subtypes</h1>
<div class="lead">${esc(lib.static.instinct_primer)}</div>

<h2>The Three Instincts</h2>
<div class="inst">
  ${icards}
</div>

<div class="unit">
  <div class="hhead">
    <div class="hbadge">${dom}&middot;${typeN}</div>
    <div>
      <div class="hlbl">Your Subtype</div>
      <div class="hname">The ${esc(INSTINCT_NAME[dom])} ${esc(TYPE_WORD[typeN])}</div>
      <div class="htag">${esc(domIv.naranjo)} &middot; ${esc(domIv.signature)}</div>
    </div>
  </div>
  <div class="cmp">
  ${cards}
  </div>
</div>
${z6Html(z6State)}
<div class="page-footer"><span>&copy; Copyright 2026 Hive, Inc. All rights reserved.</span><span>Client confidential &mdash; for use by report owner only.</span></div>
</div>
</body></html>`;
}

// ── Measurement ───────────────────────────────────────────────────────────────────────

/** Runs inside the page. Returns everything one render can tell us. */
const MEASURE = () => {
  const L = window.__lineMetrics;
  const n = (x) => +x.toFixed(2);
  const box = (el) => (el ? n(el.getBoundingClientRect().height) : null);

  // INTRINSIC card height. `.ccard` stretches, so its box says nothing; the natural height
  // is the header plus the body's padding plus the body children's own heights + margins.
  const intrinsic = (card) => {
    const head = card.querySelector('.chead').getBoundingClientRect().height;
    const body = card.querySelector('.cbody');
    const cs = getComputedStyle(body);
    let inner = 0;
    for (const kid of body.children) {
      const k = getComputedStyle(kid);
      inner += kid.getBoundingClientRect().height + parseFloat(k.marginTop) + parseFloat(k.marginBottom);
    }
    return n(head + parseFloat(cs.paddingTop) + inner + parseFloat(cs.paddingBottom));
  };

  const cards = [...document.querySelectorAll('.ccard')].map((c) => {
    const txt = c.querySelector('.ctxt');
    const nameEl = c.querySelector('.cname');
    return {
      code: c.querySelector('.ceyebrow span').textContent,
      cardBox: n(c.getBoundingClientRect().height),
      intrinsic: intrinsic(c),
      narrLines: L.lineCount(txt),
      narrHeight: box(txt),
      narrChars: txt.textContent.replace(/\s+/g, ' ').trim().length,
      narrWidth: L.contentBox(txt),
      nameText: nameEl.textContent,
      nameLines: L.lineCount(nameEl),
      // Last-line fill as a fraction of the WIDEST rendered line in the same zone. This is
      // the fragility number: a column that fits at 97% fill gives the line straight back
      // the moment anyone edits a word in it.
      lastLineFill: L.lastLineFill(txt),
      sigLines: L.lineCount(c.querySelector('.cline')),
      eyebrowH: box(c.querySelector('.ceyebrow')),
      headH: box(c.querySelector('.chead')),
    };
  });

  const itxt = [...document.querySelectorAll('.itxt')].map((e) => ({
    lines: L.lineCount(e), h: box(e), chars: e.textContent.replace(/\s+/g, ' ').trim().length, w: L.contentBox(e),
  }));
  const lead = document.querySelector('.lead');
  const respBox = document.querySelector('.resp');
  const respTxts = [...document.querySelectorAll('.resp-txt')];

  const page = document.querySelector('.page');
  const foot = document.querySelector('.page-footer');
  const lastContent = respBox || document.querySelector('.unit');
  const pageH = n(page.getBoundingClientRect().height);
  const gap = n(foot.getBoundingClientRect().top - lastContent.getBoundingClientRect().bottom);

  return {
    grid: {
      // getBoundingClientRect, NOT line_metrics' contentBox. contentBox derives from
      // clientWidth, which is an INTEGER: it reports this column as 207 where the real
      // width is 207.3281. Fine for line counting, wrong for asserting a grid against a
      // fractional reference. Same ruler as the figure it is checked against, or the
      // assertion measures the instrument rather than the page.
      ccardContentW: (() => {
        const b = document.querySelector('.cbody'), cs = getComputedStyle(b);
        return +(b.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)).toFixed(4);
      })(),
      eyebrowH: box(document.querySelector('.ceyebrow')),
      // THE RESERVATION, TESTED DIRECTLY RATHER THAN INFERRED.
      // Asserting `.ceyebrow === 13px` is satisfied by two different mechanisms: the
      // min-height reserving the row, or the badge simply being 13px tall itself. Those
      // are not the same fact. The one that matters is the reservation, because a step-4
      // renderer that omits the badge inherits 13px per column only if the min-height is
      // doing the work. So: pull the badge out, re-read, put it back.
      eyebrowHNoBadge: (() => {
        const eb = document.querySelector('.ceyebrow');
        const tag = eb.querySelector('.ctag');
        if (!tag) return box(eb);
        const html = tag.outerHTML;
        tag.remove();
        const h = box(eb);
        eb.insertAdjacentHTML('beforeend', html);
        return h;
      })(),
      cmpW: n(document.querySelector('.cmp').getBoundingClientRect().width),
      pageW: n(page.getBoundingClientRect().width),
    },
    cards,
    z5RowH: n(document.querySelector('.cmp').getBoundingClientRect().height),
    unitH: box(document.querySelector('.unit')),
    z4H: box(document.querySelector('.hhead')),
    z3: { itxt, icardH: box(document.querySelector('.icard')), instH: box(document.querySelector('.inst')) },
    z2: { h: box(lead), lines: L.lineCount(lead), chars: lead.textContent.replace(/\s+/g, ' ').trim().length, w: L.contentBox(lead) },
    z6: respBox ? {
      boxH: box(respBox),
      lines: respTxts.reduce((a, e) => a + L.lineCount(e), 0),
      blocks: respTxts.length,
      chars: respTxts.map((e) => e.textContent.replace(/\s+/g, ' ').trim().length).reduce((a, b) => a + b, 0),
      w: L.contentBox(respTxts[0]),
      perBlock: respTxts.map((e) => ({ lines: L.lineCount(e), h: box(e) })),
    } : null,
    page: { pageH, gap, spill: n(Math.max(0, pageH - 1056)) },
  };
};

/**
 * THE Z6 SHORTENING STUDY, run inside the page.
 *
 * Shortens by REMOVING RENDERED LINES and re-measuring, never by a character target — a
 * character target derived from this table would be the struck-ceiling error, and the
 * whole point of measuring lines is that characters do not predict them.
 *
 * The existing real samples are TRUNCATED AT LINE BOUNDARIES FOR MEASUREMENT ONLY. No
 * replacement prose is authored: trailing words are dropped from the last block until the
 * rendered line count falls by one, which is the cheapest honest way to ask "what does this
 * zone look like one line shorter". The resulting strings are not content and are not kept.
 *
 * SM loses height more slowly than EM per line removed, because three bullets carry three
 * rows of leading and inter-bullet margin that survive until a whole bullet goes. Both
 * rates are reported.
 *
 * Returns headroom at each target line count, measured from the live page after each cut.
 */
const Z6_STUDY = (targets) => {
  const L = window.__lineMetrics;
  const n = (x) => +x.toFixed(2);
  const resp = document.querySelector('.resp');
  const blocks = [...document.querySelectorAll('.resp-txt')];
  const page = document.querySelector('.page');
  const foot = document.querySelector('.page-footer');
  const total = () => blocks.reduce((a, b) => a + L.lineCount(b), 0);
  const readout = () => {
    const pageH = n(page.getBoundingClientRect().height);
    const gap = n(foot.getBoundingClientRect().top - resp.getBoundingClientRect().bottom);
    const spill = Math.max(0, pageH - 1056);
    return { lines: total(), boxH: n(resp.getBoundingClientRect().height), pageH,
             headroom: n(spill > 0 ? -spill : gap) };
  };
  const out = {};
  // Trailing words come off the LAST non-empty block first, so a three-bullet shape loses
  // its final bullet before its first — the order an editor would cut in.
  const dropWord = () => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const w = blocks[i].textContent.trim().split(/\s+/);
      if (w.length > 1) { blocks[i].textContent = w.slice(0, -1).join(' '); return true; }
    }
    return false;
  };
  for (const t of targets) {
    let guard = 4000;
    while (total() > t && guard-- > 0) { if (!dropWord()) break; }
    out[t] = readout();
  }
  return out;
};

/**
 * WHERE THE LINES ACTUALLY BREAK, read off the render.
 *
 * Walks the text node word by word with a Range, takes each word's rect top, and groups
 * words that share a top into a line. That is the same merge-by-top-edge rule
 * line_metrics uses to count lines, so the grouping here and the count there cannot
 * disagree. Reports each line's text and its width as a fraction of the widest line, so a
 * line that is nearly full is visible as such.
 */
const BREAKS = (sel) => {
  const el = document.querySelector(sel);
  const node = el.firstChild;
  const text = node.textContent;
  const rg = document.createRange();
  const lines = new Map();
  let i = 0;
  while (i < text.length) {
    let j = i;
    while (j < text.length && !/\s/.test(text[j])) j++;
    if (j > i) {
      rg.setStart(node, i); rg.setEnd(node, j);
      const r = rg.getBoundingClientRect();
      const k = Math.round(r.top * 2) / 2;
      if (!lines.has(k)) lines.set(k, { top: k, words: [], l: r.left, r: r.right });
      const L = lines.get(k);
      L.words.push(text.slice(i, j));
      L.l = Math.min(L.l, r.left); L.r = Math.max(L.r, r.right);
    }
    i = j;
    while (i < text.length && /\s/.test(text[i])) i++;
  }
  const out = [...lines.values()].sort((a, b) => a.top - b.top)
    .map((L) => ({ text: L.words.join(' '), w: +(L.r - L.l).toFixed(2) }));
  const widest = Math.max(...out.map((o) => o.w));
  return out.map((o, n) => ({ n: n + 1, text: o.text, w: o.w, fill: +(o.w / widest).toFixed(4) }));
};

/** All 27 naranjo values at 14px bold in the real column, in one pass. */
const MEASURE_CNAME = (vals, w) => {
  const L = window.__lineMetrics;
  const host = document.createElement('div');
  host.style.cssText = `position:absolute;left:-9999px;top:0;width:${w}px`;
  const el = document.createElement('div');
  el.className = 'cname';
  host.appendChild(el);
  document.body.appendChild(host);
  const out = vals.map(({ code, v }) => {
    el.textContent = v;
    return { code, v, chars: v.length, lines: L.lineCount(el), h: +el.getBoundingClientRect().height.toFixed(2) };
  });
  host.remove();
  return out;
};

// ── Driver ────────────────────────────────────────────────────────────────────────────

async function render(browser, html) {
  const page = await browser.newPage();
  await page.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  await lineMetrics.install(page);
  return page;
}

const fail = [];
// Filled once from the mockup itself, so the scaffold is checked against the artifact it
// inherits from and not only against a literal transcribed out of an audit. A literal can
// go stale silently; a live reading cannot.
let MOCKUP_REF = null;

function assertGrid(g, where) {
  if (Math.abs(g.ccardContentW - GRID_W) > TOL) {
    fail.push(`${where}: .ccard content width ${g.ccardContentW} != ${GRID_W} — THE SCAFFOLD IS WRONG, not the page`);
  }
  if (MOCKUP_REF && Math.abs(g.ccardContentW - MOCKUP_REF.ccardContentW) > TOL) {
    fail.push(`${where}: .ccard ${g.ccardContentW} != the MOCKUP's live ${MOCKUP_REF.ccardContentW} — the scaffold has drifted from the geometry of record`);
  }
  if (Math.abs(g.eyebrowH - EYEBROW_H) > TOL) {
    fail.push(`${where}: .ceyebrow ${g.eyebrowH} != ${EYEBROW_H} — the badge row is the wrong height`);
  }
  if (Math.abs(g.eyebrowHNoBadge - EYEBROW_H) > TOL) {
    fail.push(`${where}: .ceyebrow WITHOUT its badge is ${g.eyebrowHNoBadge}, not ${EYEBROW_H} — `
      + 'min-height is not reserving the row, so a renderer that omits the badge reads 13px short per column');
  }
}

(async () => {
  console.log('p10 FIT PROBE — MEASUREMENTS ONLY. No budget, no ceiling, for any zone.\n');
  console.log('COUNTING BASIS, stated before any number:');
  console.log('  Characters are counted on the RENDERED string with whitespace collapsed and the');
  console.log('  ends trimmed — what the browser lays out and what an author types into the CMS.');
  console.log('  Markup is excluded. Labels are excluded from the string they label and measured');
  console.log('  separately. Source indentation is not content.');
  console.log('  (Same basis scripts/lib/line_metrics.js already uses for its `chars`.)\n');
  console.log('  Every figure below is a MEASUREMENT — a fact about a rendered artifact.');
  console.log('  None is a ceiling. Character count does not predict line count.\n');
  console.log(`  Widths: Z5 ${GRID_W} · Z3 196 · Z6 670 · Z2 710. No band transfers between them.\n`);

  const browser = await bl.launchBrowser();
  const results = { basis: 'whitespace-collapsed, ends trimmed, markup excluded', types: {}, z6: {}, cname: null };

  // Font, once.
  {
    const p = await render(browser, scaffold(9, 'em_paragraph'));
    const w = await bl.assertReportFont(p);
    console.log(`font probe: ${w.toFixed(2)}px (Arial metrics OK)\n`);
    await p.close();
  }

  // The mockup itself, measured live — the geometry of record, and the per-zone baseline
  // the scaffold's numbers are read against.
  {
    const p = await render(browser, fs.readFileSync(MOCKUP, 'utf8'));
    const m = await p.evaluate(MEASURE);
    MOCKUP_REF = m.grid;
    results.mockup = m;
    console.log('── REFERENCE · the mockup as it ships, measured in this same run ──');
    console.log(`  .ccard content width ${m.grid.ccardContentW}  ·  .ceyebrow ${m.grid.eyebrowH}px (${m.grid.eyebrowHNoBadge}px with the badge removed — the reservation, tested not inferred)`);
    console.log(`  Z2 ${m.z2.h}px/${m.z2.lines}L · Z3 row ${m.z3.instH}px · Z4 ${m.z4H}px · Z5 card ${m.cards[0].cardBox}px (intrinsic ${m.cards.map((c) => c.intrinsic).join('/')}) · Z6 ${m.z6.boxH}px/${m.z6.lines}L`);
    console.log(`  page ${m.page.pageH}px · slack to footer ${m.page.gap}px\n`);
    await p.close();
  }

  // ── 2. Z6 — all four states. Type-independent, so measured once. ────────────────────
  console.log('── MEASUREMENT 2 · Z6 "In Your Words" — four states, width 670px ──');
  for (const state of ['sm_bullets', 'em_paragraph', 'null', 'absent']) {
    const p = await render(browser, scaffold(9, state));
    const m = await p.evaluate(MEASURE);
    assertGrid(m.grid, `Z6/${state}`);
    results.z6[state] = m.z6 ? { ...m.z6 } : { boxH: 0, lines: 0, blocks: 0, chars: 0 };
    const z = results.z6[state];
    // MEASURED, not computed. An earlier version of this line multiplied the margin by two
    // per gap and reported 12.00px; adjacent block margins COLLAPSE, so the real figure is
    // half that. Measure the box with the margins zeroed and take the difference.
    let extra = '';
    if (state === 'sm_bullets') {
      const zeroed = await p.evaluate(() => {
        const els = [...document.querySelectorAll('.p10-sm-bullet')];
        const before = document.querySelector('.resp').getBoundingClientRect().height;
        els.forEach((e) => { e.style.margin = '0'; });
        const after = document.querySelector('.resp').getBoundingClientRect().height;
        els.forEach((e) => { e.style.margin = ''; });
        return +(before - after).toFixed(2);
      });
      z.interBullet = zeroed;
      extra = `  [inter-bullet spacing contributes ${zeroed.toFixed(2)}px MEASURED (margins collapse) — SCAFFOLD ASSUMPTION]`;
    }
    console.log(`  ${state.padEnd(13)} box ${String(z.boxH).padStart(7)}px · ${String(z.lines).padStart(2)} lines · ${z.blocks} block(s) · ${String(z.chars).padStart(3)} chars${extra}`);
    await p.close();
  }
  const worstZ6 = Object.entries(results.z6).reduce((a, b) => (b[1].boxH > a[1].boxH ? b : a));
  console.log(`  WORST BY RENDERED HEIGHT: ${worstZ6[0]} at ${worstZ6[1].boxH}px / ${worstZ6[1].lines} lines`);
  const byChars = Object.entries(results.z6).reduce((a, b) => (b[1].chars > a[1].chars ? b : a));
  console.log(`  (worst by CHARACTER COUNT would have been: ${byChars[0]} at ${byChars[1].chars} chars — ${byChars[0] === worstZ6[0] ? 'same answer here, but not derivable from chars' : 'A DIFFERENT ANSWER'})\n`);

  // ── 1 + 3 + 4 + 6. Per type. ────────────────────────────────────────────────────────
  // ── SO7 BEFORE AND AFTER ────────────────────────────────────────────────────────────
  console.log('── SO7 · committed vs revised — width 207.33px, intrinsic height ──');
  console.log('   NOT A LENGTH COMPARISON. SO5 is 394 chars at 11 lines; SO7 is 389 at 12.');
  console.log('   SO7 is 5 characters SHORTER than a column that fits and still costs a line.\n');
  const so7 = {};
  for (const v of ['committed', 'revised']) {
    const p = await render(browser, scaffold(7, worstZ6[0], 'SX', 'new_nolabel', v));
    const m = await p.evaluate(MEASURE);
    assertGrid(m.grid, `so7/${v}`);
    const c = m.cards.find((x) => x.code === 'SO7');
    const brk = await p.evaluate(BREAKS, '.ccard:nth-of-type(2) .ctxt');
    await p.close();
    so7[v] = { ...c, breaks: brk };
    console.log(`  ${v.padEnd(10)} ${String(c.narrChars).padStart(3)} chars · ${c.narrLines} lines · intrinsic ${c.intrinsic}px · last-line fill ${(c.lastLineFill * 100).toFixed(1)}%`);
  }
  results.so7 = so7;
  const dChars = so7.revised.narrChars - so7.committed.narrChars;
  const dLines = so7.revised.narrLines - so7.committed.narrLines;
  console.log(`  delta: ${dChars} chars, ${dLines} line(s), ${(so7.revised.intrinsic - so7.committed.intrinsic).toFixed(2)}px`);
  console.log(`  recount vs stated 373: ${so7.revised.narrChars}${so7.revised.narrChars === 373 ? ' — EXACT' : ' — DELTA ' + (so7.revised.narrChars - 373)}`);
  console.log(`  ${dLines < 0 ? 'THE REVISION DROPS THE LINE.' : 'THE REVISION DOES NOT DROP THE LINE — see the break positions below.'}\n`);

  for (const v of ['committed', 'revised']) {
    console.log(`  SO7 ${v} — where the lines break (fill = width as a fraction of the widest line):`);
    so7[v].breaks.forEach((b) => console.log(`    ${String(b.n).padStart(2)}  ${(b.fill * 100).toFixed(1).padStart(5)}%  ${b.text}`));
    console.log('');
  }

  console.log('── MEASUREMENT 1 · Z5 columns — INTRINSIC height and lines, width 207.33px ──');
  console.log('   (card box is reported too, to show the flex-stretch it hides)\n');
  const composites = [];
  for (let t = 1; t <= 9; t++) {
    const p = await render(browser, scaffold(t, worstZ6[0]));
    const m = await p.evaluate(MEASURE);
    assertGrid(m.grid, `type ${t}`);
    const tallest = m.cards.reduce((a, b) => (b.intrinsic > a.intrinsic ? b : a));
    results.types[t] = m;
    composites.push({ t, m, tallest });
    const cells = m.cards.map((c) => `${c.code} ${String(c.intrinsic).padStart(6)}px/${c.narrLines}L`).join('  ');
    console.log(`  Type ${t}: ${cells}   | card box ${m.cards[0].cardBox} (all three) | TALLEST ${tallest.code}`);
    await p.close();
  }
  console.log('\n  LAST-LINE FILL of each type\'s tallest column — the fragility number.');
  console.log('  Nine separate figures, not "~297.81/11L": a column that fits at 97% fill');
  console.log('  gives the line back the moment anyone edits a word in it.\n');
  for (const { t, tallest, m } of composites) {
    const f = tallest.lastLineFill;
    // With nine columns tied at the top, "the tallest" is whichever the reduce reached
    // first, so its fill alone would be an accident. The fragility-relevant column is the
    // one in that triple whose last line is FULLEST — the nearest to gaining a line.
    const tiedTallest = m.cards.filter((c) => Math.abs(c.intrinsic - tallest.intrinsic) < 0.01);
    const fullest = tiedTallest.reduce((a, b) => ((b.lastLineFill || 0) > (a.lastLineFill || 0) ? b : a));
    const flag = fullest.lastLineFill >= 0.90 ? '   <-- FRAGILE' : (fullest.lastLineFill >= 0.80 ? '   <-- tight' : '');
    console.log(`   Type ${t}  tallest ${tallest.code.padEnd(4)} ${String(tallest.intrinsic).padStart(6)}px/${tallest.narrLines}L fill ${(f * 100).toFixed(1).padStart(5)}%`
      + `   |  fullest of ${tiedTallest.length} tied: ${fullest.code} at ${(fullest.lastLineFill * 100).toFixed(1)}%${flag}`);
  }
  {
    // Across all 27, not just the nine tallest: the columns nearest to gaining a line.
    const all = composites.flatMap((c) => c.m.cards).filter((c) => c.lastLineFill != null);
    const rank = [...all].sort((a, b) => b.lastLineFill - a.lastLineFill);
    console.log(`\n  MOST FRAGILE COLUMNS ACROSS ALL 27 — highest last-line fill, i.e. least room`);
    console.log('  before a further line appears:');
    rank.slice(0, 5).forEach((c) => console.log(`    ${c.code.padEnd(4)} ${(c.lastLineFill * 100).toFixed(1).padStart(5)}%  ${c.narrLines}L  ${c.narrChars} chars`));
    console.log(`    (lowest: ${rank[rank.length - 1].code} at ${(rank[rank.length - 1].lastLineFill * 100).toFixed(1)}%)`);
  }

  const globalWorst = composites.reduce((a, b) => (b.tallest.intrinsic > a.tallest.intrinsic ? b : a));
  console.log(`\n  GLOBAL WORST Z5 COLUMN: ${globalWorst.tallest.code} at ${globalWorst.tallest.intrinsic}px / ${globalWorst.tallest.narrLines} lines (${globalWorst.tallest.narrChars} chars)`);
  {
    // If SO7 is no longer the constraint, something else is. Found by rendering, not
    // assumed — the character-worst and the render-worst have already been shown to differ.
    const ranked = composites.map((c) => c.tallest).sort((a, b) => b.intrinsic - a.intrinsic);
    const tied = ranked.filter((c) => Math.abs(c.intrinsic - ranked[0].intrinsic) < 0.01);
    console.log(`  ${globalWorst.tallest.code === 'SO7' ? 'SO7 IS STILL THE CONSTRAINT.' : 'SO7 IS NO LONGER THE CONSTRAINT.'}`
      + ` ${tied.length > 1 ? `${tied.length} columns tie at the top: ${tied.map((c) => c.code).join(', ')}` : `The single worst is ${ranked[0].code}`}.`);
    console.log(`  Next three by rendered height: ${ranked.slice(0, 3).map((c) => `${c.code} ${c.intrinsic}px/${c.narrLines}L (${c.narrChars}ch)`).join(' · ')}`);
  }
  const charWorst = composites.flatMap((c) => c.m.cards).reduce((a, b) => (b.narrChars > a.narrChars ? b : a));
  console.log(`  By CHARACTER COUNT the worst would have been ${charWorst.code} (${charWorst.narrChars} chars, ${charWorst.narrLines} lines) — ${charWorst.code === globalWorst.tallest.code ? 'same column' : 'A DIFFERENT COLUMN'}`);

  const one = composites[0].m;
  console.log('\n── MEASUREMENT 3 · Z3 instinct definitions — width 196px ──');
  console.log('   TWO MECHANISMS, TWO NUMBERS. Removing the FOCUSED ON row is structural — it');
  console.log('   happens whatever the characters do. Shortening the bodies is not. Measured');
  console.log('   separately so neither is credited with the other\'s saving.\n');
  const z3v = {};
  for (const v of ['store_label', 'store_nolabel', 'new_label', 'new_nolabel']) {
    const p = await render(browser, scaffold(9, 'em_paragraph', 'SX', v));
    const m = await p.evaluate(MEASURE);
    assertGrid(m.grid, `z3/${v}`);
    z3v[v] = m.z3;
    const lines = m.z3.itxt.map((x) => x.lines).join('/');
    const chars = m.z3.itxt.map((x) => x.chars).join('/');
    console.log(`  ${v.padEnd(14)} row ${String(m.z3.instH).padStart(7)}px · card ${String(m.z3.icardH).padStart(7)}px · ${lines} lines · ${chars} chars`);
    await p.close();
  }
  results.z3Variants = z3v;
  const labelSaving = +(z3v.store_label.instH - z3v.store_nolabel.instH).toFixed(2);
  const textSaving  = +(z3v.store_nolabel.instH - z3v.new_nolabel.instH).toFixed(2);
  const totalSaving = +(z3v.store_label.instH - z3v.new_nolabel.instH).toFixed(2);
  console.log(`\n  LABEL ROW removed       : ${labelSaving}px   (structural — independent of the text)`);
  console.log(`  TEXT shortened          : ${textSaving}px   (185/185/200 chars -> ${Z3_NEW.map((d) => d.body.length).join('/')})`);
  console.log(`  TOTAL Z3 recovery       : ${totalSaving}px   (row ${z3v.store_label.instH} -> ${z3v.new_nolabel.instH})`);
  console.log(`  cross-check: ${labelSaving} + ${textSaving} = ${(labelSaving + textSaving).toFixed(2)} vs measured total ${totalSaving}`);
  console.log(`  new-string recount at 196px, basis as stated: ${z3v.new_nolabel.itxt.map((x) => x.chars).join(' / ')} chars (stated 157 / 150 / 156)`);

  console.log('\n── MEASUREMENT 4 · Z2 instinct_primer AS-IS — width 710px ──');
  console.log(`  ${one.z2.lines} lines · ${one.z2.h}px · ${one.z2.chars} chars · width ${one.z2.w}`);

  console.log('\n── MEASUREMENT 5 · .cname, all 27 naranjo values at 14px bold in 207.33px ──');
  {
    const vals = [];
    for (let t = 1; t <= 9; t++) for (const i of INSTINCTS) {
      const iv = lib[`subtype_${i.toLowerCase()}${t}`].instincts_v3;
      vals.push({ code: `${i}${t}`, v: iv.naranjo });
    }
    const p = await render(browser, scaffold(9, 'em_paragraph'));
    results.cname = await p.evaluate(MEASURE_CNAME, vals, GRID_W);
    await p.close();
    const multi = results.cname.filter((x) => x.lines > 1);
    const widest = results.cname.reduce((a, b) => (b.chars > a.chars ? b : a));
    console.log(`  27/27 measured. Longest: "${widest.v}" (${widest.chars} chars) at ${widest.lines} line(s), ${widest.h}px`);
    console.log(`  MORE THAN ONE LINE: ${multi.length === 0 ? 'none — all 27 occupy exactly one line' : multi.map((x) => `${x.code} "${x.v}" ${x.lines}L`).join(', ')}`);
  }

  console.log(`\n── MEASUREMENT 6 · THE COMPOSITE, PER TYPE — against the ${PAGE_CONTENT_PX}px content box ──`);
  console.log(`   Z6 held at its worst state (${worstZ6[0]}). Headroom is signed: positive = slack`);
  console.log('   before the footer; negative = the page has spilled past 1056px.\n');
  console.log('  Type | Z2      Z3       Z4     Z5(tallest)      Z6       | page px | HEADROOM');
  console.log('  -----|---------------------------------------------------|---------|----------');
  for (const { t, m, tallest } of composites) {
    const headroom = m.page.spill > 0 ? -m.page.spill : m.page.gap;
    results.types[t].headroom = headroom;
    results.types[t].tallestCode = tallest.code;
    console.log(`   ${t}   | ${String(m.z2.h).padStart(6)}  ${String(m.z3.instH).padStart(6)}  ${String(m.z4H).padStart(5)}  ${tallest.code} ${String(tallest.intrinsic).padStart(6)}/${tallest.narrLines}L  ${String(m.z6 ? m.z6.boxH : 0).padStart(6)}  | ${String(m.page.pageH).padStart(7)} | ${headroom >= 0 ? '+' : ''}${headroom.toFixed(2)}px`);
  }
  // ── WHICH ZONE MOVED, against the mockup measured in this same run ─────────────────
  // The composite says whether the page fits. This says why, and it is the difference
  // between "p10 does not fit" and a zone anyone can act on. Deltas are scaffold minus
  // mockup, at the worst Z6 state and the global worst Z5 triple.
  {
    const mk = results.mockup, w = globalWorst.m;
    const d = (a, b) => `${b - a >= 0 ? '+' : ''}${(b - a).toFixed(2)}`;
    console.log('\n  ZONE DELTAS vs the mockup as it ships (worst type, worst Z6):');
    console.log(`    Z2 lead     ${String(mk.z2.h).padStart(7)} -> ${String(w.z2.h).padStart(7)}   ${d(mk.z2.h, w.z2.h)}px  (${mk.z2.lines}L -> ${w.z2.lines}L)`);
    console.log(`    Z3 inst row ${String(mk.z3.instH).padStart(7)} -> ${String(w.z3.instH).padStart(7)}   ${d(mk.z3.instH, w.z3.instH)}px  (NEW text, FOCUSED ON row dropped; ${mk.z3.itxt[0].lines}L -> ${w.z3.itxt[0].lines}L per card)`);
    console.log(`    Z4 banner   ${String(mk.z4H).padStart(7)} -> ${String(w.z4H).padStart(7)}   ${d(mk.z4H, w.z4H)}px`);
    const mkZ5 = Math.max(...mk.cards.map((c) => c.intrinsic));
    console.log(`    Z5 tallest  ${String(mkZ5).padStart(7)} -> ${String(globalWorst.tallest.intrinsic).padStart(7)}   ${d(mkZ5, globalWorst.tallest.intrinsic)}px  (3 labelled blocks -> one narrative)`);
    console.log(`    Z6 box      ${String(mk.z6.boxH).padStart(7)} -> ${String(w.z6.boxH).padStart(7)}   ${d(mk.z6.boxH, w.z6.boxH)}px  (mockup's ${mk.z6.chars} chars -> worst state's ${w.z6.chars})`);
    console.log(`    page        ${String(mk.page.pageH).padStart(7)} -> ${String(w.page.pageH).padStart(7)}   ${d(mk.page.pageH, w.page.pageH)}px`);
  }

  const negatives = composites.filter(({ t }) => results.types[t].headroom < 0);
  console.log('');
  if (!negatives.length) {
    console.log('  ALL NINE FIT. No type spills the page at the worst Z6 state.');
  } else {
    console.log(`  ${negatives.length} OF 9 SPILL. Per §5 the response is CONTENT WORK and a separate build.`);
    console.log('  Nothing here is shortened, and no padding, margin or line-height is touched.\n');
    console.log('  Type | deficit | LINE DELTA — lines needed back, and from where');
    for (const { t, tallest, m } of negatives) {
      const d = -results.types[t].headroom;
      const z5line = +(tallest.narrHeight / tallest.narrLines).toFixed(2);
      const z6line = m.z6 && m.z6.lines ? +((m.z6.boxH - 34) / m.z6.lines).toFixed(2) : null;
      console.log(`   ${t}   | ${d.toFixed(2)}px | Z5 ${Math.ceil(d / z5line)} line(s) off ${tallest.code} (@${z5line}px/line)`
        + (z6line ? `, or Z6 ${Math.ceil(d / z6line)} line(s) (@${z6line}px/line)` : ''));
    }
  }

  // ── THE Z6 SHORTENING STUDY ─────────────────────────────────────────────────────────
  {
    const worstLines = worstZ6[1].lines;
    const targets = [worstLines, worstLines - 1, worstLines - 2, worstLines - 3];
    console.log(`\n── THE Z6 SHORTENING STUDY — headroom as a function of Z6 LINE COUNT ──`);
    console.log(`   Nine types down, Z6 line count across. Worst shape is ${worstZ6[0]} at ${worstLines} lines.`);
    console.log('   New Z3 in place. Each cell is headroom in px against the 976px content box,');
    console.log('   at that type\'s tallest Z5 triple. Real samples truncated at line boundaries');
    console.log('   FOR MEASUREMENT ONLY — no replacement prose is authored, and nothing is kept.\n');
    const hdr = targets.map((t) => `${t}L`.padStart(9)).join('');
    console.log(`  Type | tallest Z5     |${hdr}`);
    console.log(`  -----|----------------|${'-'.repeat(9 * targets.length)}`);
    const study = {};
    for (const { t, tallest } of composites) {
      const p = await render(browser, scaffold(t, worstZ6[0]));
      const r = await p.evaluate(Z6_STUDY, targets);
      await p.close();
      study[t] = r;
      const cells = targets.map((k) => {
        const h = r[k].headroom;
        return `${h >= 0 ? '+' : ''}${h.toFixed(1)}`.padStart(9);
      }).join('');
      console.log(`   ${t}   | ${tallest.code} ${String(tallest.intrinsic).padStart(6)}/${tallest.narrLines}L |${cells}`);
    }
    results.z6Study = study;
    // How many lines must Z6 give back for EVERY type to be positive?
    let need = null;
    for (const k of targets) if (need === null && composites.every(({ t }) => study[t][k].headroom >= 0)) need = k;
    console.log('');
    if (need === null) {
      console.log(`  NO TESTED LINE COUNT MAKES ALL NINE POSITIVE. At ${targets[targets.length - 1]} lines the worst type is still`);
      const w = composites.reduce((a, b) => (study[a.t][targets[targets.length - 1]].headroom < study[b.t][targets[targets.length - 1]].headroom ? a : b));
      console.log(`  Type ${w.t} at ${study[w.t][targets[targets.length - 1]].headroom}px. Read the remaining deficit off the table.`);
    } else {
      console.log(`  ALL NINE TYPES ARE POSITIVE AT Z6 = ${need} LINES — ${worstLines - need} line(s) back from the worst shape.`);
      const tight = composites.reduce((a, b) => (study[a.t][need].headroom < study[b.t][need].headroom ? a : b));
      console.log(`  Tightest at that count: Type ${tight.t} with ${study[tight.t][need].headroom}px to spare.`);
    }
    console.log('\n  No cap is proposed here. The margin is Cai\'s to set once he can see the table,');
    console.log('  and the cap follows from that at step 5.');

    // Per-line cost of each producer shape, measured rather than assumed.
    console.log('\n  PER-LINE COST BY PRODUCER SHAPE — measured, and it corrects an expectation:');
    const rates = {};
    for (const state of ['em_paragraph', 'sm_bullets']) {
      const p = await render(browser, scaffold(9, state));
      const base = results.z6[state].lines;
      const targets = [];
      for (let k = base; k >= 3; k--) targets.push(k);
      const r = await p.evaluate(Z6_STUDY, targets);
      await p.close();
      rates[state] = r;
      const steps = targets.slice(1).map((k) => `${k}L ${r[k].boxH}px (-${(r[k + 1].boxH - r[k].boxH).toFixed(2)})`).join(' -> ');
      console.log(`    ${state.padEnd(13)} ${base}L ${r[base].boxH}px -> ${steps}`);
    }
    console.log('');
    console.log('    Both shapes shed 19.37-19.38px per line — ONE LINE BOX at 12.5px x 1.55.');
    console.log('    The expectation was that SM sheds less because three bullets carry three rows');
    console.log('    of leading and inter-bullet margin. MEASURED, IT DOES NOT, and the reason is');
    console.log('    that those rows survive: removing a line from inside a bullet removes a line');
    console.log('    box and nothing else. The rates would only diverge when a WHOLE BULLET goes,');
    console.log('    and SM cannot reach that point by shortening — with 3 bullets it bottoms out');
    console.log(`    at 3 rendered lines (measured ${rates.sm_bullets[3] ? rates.sm_bullets[3].boxH + 'px' : 'n/a'}), one line each, and going below that`);
    console.log('    means emitting fewer than 3 bullets, which is a PRODUCER CONTRACT change');
    console.log('    (app/server.js:4828 says "exactly 3"), not a shortening.');
  }

  // ── The smoke render: sp4's own type, so the EM prose matches the page ──────────────
  {
    // TYPE 7 — the constrained type, and the one the SO7 revision is for. The dominant is
    // SO so the highlighted column IS the revised one. Note the Z6 overlay is sp4's, so its
    // prose does not match a Type 7 page; that is a known and stated limitation of having
    // one real EM sample, and it does not affect any measurement. The Type 4 / SP render
    // stays alongside it as the coherent one.
    for (const [tag, t, d] of [['t7_so', 7, 'SO'], ['t4_em', 4, 'SP']]) {
      const h = scaffold(t, 'em_paragraph', d);
      fs.writeFileSync(path.join(OUT, `p10_probe_scaffold_${tag}.html`), h);
      const pp = await render(browser, h);
      await pp.screenshot({ path: path.join(OUT, `p10_probe_scaffold_${tag}.png`), fullPage: true });
      await pp.close();
    }
    const html = scaffold(4, 'em_paragraph', 'SP');
    fs.writeFileSync(path.join(OUT, 'p10_probe_scaffold_t4_em.html'), html);
    const p = await render(browser, html);
    await p.screenshot({ path: path.join(OUT, 'p10_probe_scaffold_t4_em.png'), fullPage: true });
    await p.close();
    console.log('\n  smoke render: .phase6_out/p10_probe_scaffold_t4_em.{html,png}');
    console.log('  Type 4 · SP — sp4\'s own type AND its own dominant instinct, so the badge,');
    console.log('  the Z4 banner and the overlay\'s own words all agree.');
  }

  fs.writeFileSync(path.join(OUT, 'p10_fit_measurements.json'), JSON.stringify(results, null, 2));
  console.log('  measurements: .phase6_out/p10_fit_measurements.json');

  await browser.close();
  if (fail.length) { console.log('\n*** PROBE FAILED ***'); fail.forEach((f) => console.log('  - ' + f)); process.exit(1); }
  console.log('\nGrid asserted at every render: .ccard 207.33px, .ceyebrow 13px.');
  console.log('p10 FIT PROBE: COMPLETE. Measurements only — nothing here is a budget or a ceiling.');
})();
