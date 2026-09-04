'use strict';

/**
 * render_client.js — report layout verification (offline, no API key, no DB).
 *
 * For sp4/sx7: api_result fixture + synthetic client/coach → report_prep →
 * renderer → PDF, for BOTH the client and coach reports. Flowing layout (no
 * measurement gate): renders straight, then measures each page's rendered height.
 * Writes HTML + PDF per report to .phase6_out/ (gitignored).
 *
 * Failure (process exits non-zero) on any of:
 *   - a builder or render throwing;
 *   - wrong logical page count (client 10, coach 3);
 *   - CLIENT page spill past one physical sheet (1056px @96dpi) — the client
 *     report is a hard one-sheet-per-page contract.
 * Coach `.report-page` is min-height:1056 and flows by design, so coach spill is
 * reported for visibility but is NOT a failure.
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));

const PAGE_PX = 1056; // US Letter 11in @96dpi
const OUT = path.join(ROOT, '.phase6_out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const client = { first_name: 'Test', last_name: 'Client', organization: 'Acme Co', date: 'June 2026' };
const coach = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };
// The v3 reference implementation is built for this client; the masthead is compared
// against it, so the name must match.
const V3_CLIENT = { first_name: 'Anders', last_name: 'Wennerstrom', organization: 'Hive', date: 'August 2026' };

/**
 * SPEC §6.1 — matched line counts between paired columns on sheets 6 and 7.
 *
 * REPORT-ONLY, DELIBERATELY. This prints and never fails, and the run exits zero whatever it
 * finds. Two of the four built types do not satisfy the rule on `main` today — Type 1's
 * signs/interrupt and Type 7's best/edge — so a hard gate would go red on arrival and block
 * every unrelated PR until PR 3e re-ingests the corrected source. Both are already fixed in the
 * Google Docs and land with the five remaining types; the gate is promoted to hard once they do.
 *
 * Landing it now rather than with 3e is the point: it establishes the baseline the five new
 * types get read against, at the moment they are ingested, instead of after.
 *
 * Columns are addressed by their own headings where the markup allows — `.v3-tb-col` carries
 * `.is-best` / `.is-edge` — rather than by sibling position. `.v3-tb-pr-col` has no such marker,
 * so those two are positional, and the renderer emits Signs before Interrupting (`_clv3TypeB`).
 */
const V3_PAIRS = [
  { name: 'worldview / core_belief', pageKey: 'typeA',
    a: { label: 'worldview',   root: '.v3-ta-cm-col:nth-of-type(1) .v3-ta-cm-txt' },
    b: { label: 'core_belief', root: '.v3-ta-cm-col:nth-of-type(2) .v3-ta-cm-txt' } },
  { name: 'best / edge', pageKey: 'typeB',
    a: { label: 'best', root: '.v3-tb-col:has(.v3-tb-col-head.is-best)', sel: '.v3-tb-item-txt' },
    b: { label: 'edge', root: '.v3-tb-col:has(.v3-tb-col-head.is-edge)', sel: '.v3-tb-item-txt' } },
  { name: 'signs / interrupt', pageKey: 'typeB',
    a: { label: 'signs',     root: '.v3-tb-pr-col:nth-of-type(1)', sel: '.v3-tb-pr-txt' },
    b: { label: 'interrupt', root: '.v3-tb-pr-col:nth-of-type(2)', sel: '.v3-tb-pr-txt' } },
];

/**
 * The two zones design spec §6 flagged as last-line fill outliers. Re-measured here rather
 * than in a separate run: same browser, same page, no second launch.
 *
 * The standing 13.0% / 15.9% figures were taken on `deb13f3`, before the Type 9 source doc
 * replaced 36 of that type's 40 strings, so they describe prose that no longer ships.
 */
const V3_FILL_ZONES = [
  { name: 'p6 core motivation',  pageKey: 'typeA', sel: '.v3-ta-cm-narr' },
  { name: 'p7 chicklet bullet 8', pageKey: 'typeB', sel: '.v3-tb-s-txt', nth: 7 },
];

// Per report kind: how to build it, which page containers to measure, how many to
// expect, and whether page spill past one sheet is a failure (client only).
// Client uses .cover (Title/TOC/Welcome), .page (P2), and .pN-page (P3–P8) — the
// legacy .report-page selector no longer matches any client page. Coach uses
// .report-page ×3.
const REPORTS = {
  client: {
    build: async (apiResult) => R.buildClientReportHTML(await prep.buildClientModel({ apiResult, client, coach })),
    selector: '.cover, .page, .p3-page, .p4-page, .p5-page, .p6-page, .p7-page, .p8-page',
    expected: 10,
    enforceSheet: true,
    labels: ['Title', 'TOC', 'P1 Welcome', 'P2 Primer', 'P3 Hypotheses', 'P4 Patterns',
      'P5 Wings/Lines', 'P6 Instinct', 'P7 Strengths', 'P8 Application'],
  },
  // CLIENT REPORT v3 (PR 1). Renders alongside the live 10-page config above, which stays
  // green until cutover. Grows one page at a time; PR 1 carries Wings only.
  client_v3: {
    build: async (apiResult) => R.buildClientReportHTML_v3(
      await prep.buildClientModel({ apiResult, client: V3_CLIENT, coach })),
    selector: '.v3-page',
    // PER-TYPE, not a single literal. Sheets 6-7 are pilot-scoped to type 9, so type 9 emits
    // nine pages and every other type seven. A fixed `expected` cannot express that, and a
    // uniform count is genuinely wrong until the rollout finishes.
    expectedFor: (type) => R.v3PagesFor(type == null ? 9 : type).length,
    labelsFor: (type) => R.v3PagesFor(type == null ? 9 : type)
      .map(p => `P${p.sheet} ${p.title.replace(/ \(continued\)$/, ' cont')}`.slice(0, 16)),
    enforceSheet: true,
    // Document order, not sheet order: PR 2 adds sheets 1-4 and 12 around the Wings page
    // PR 1 built, and sheets 5-11 land in later PRs.
    checkHyphens: true,
    // §6.1 matched line counts + the §6 fill outliers. Report-only; see V3_PAIRS.
    pairChecks: V3_PAIRS,
    fillZones: V3_FILL_ZONES,
    fixtures: ['anders_sx9'],   // Type 9 / SX9 — the fixture the v3 mockups were built for
    // Render EVERY type from the one fixture, swapping confirmed_type. The per-type pages
    // fit differently per type — the canon line narratives alone range 284-351 chars — so a
    // single-type run cannot answer "does this page fit". No new fixtures needed: the client
    // model derives everything from hypothesis.confirmed_type.
    types: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  },
  coach: {
    build: async (apiResult) => R.buildCoachReportHTML(await prep.buildCoachModel({ apiResult, client, coach })),
    selector: '.report-page',
    expected: 3,
    enforceSheet: false,
    labels: ['Coach P1', 'Coach P2', 'Coach P3'],
  },
};

// Pinned bundled Chromium via the shared launcher — same engine as production and CI.
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));
const lineMetrics = require(path.join(ROOT, 'scripts/lib/line_metrics.js'));
async function launch() { return browserLaunch.launchBrowser(); }
let fontReported = false;

/**
 * Find lines that break at a hyphen, splitting a word across two lines (brief v2.0 §12.6).
 *
 * The obvious check — look for U+00AD or automatic hyphenation — finds nothing and would
 * pass forever: computed `hyphens` is `manual` on every page, so Chromium never inserts a
 * hyphen. Every real occurrence is a break at a hyphen that is ALREADY in the string, which
 * `hyphens` does not govern at all. Measured on the reference set, three compounds split
 * this way ("self-forgetting", "present-moment", "pressure-test") and, once the Welcome
 * letter landed, so did a URL — "www.hiveleadership.com/the-" / "enneagram." in a
 * client-facing PDF.
 *
 * Fixes are U+2011 (non-breaking hyphen) in prose, and a nowrap span for URLs so the text
 * stays copy-exact. A hyphen preceded by whitespace is a dash, not a compound, and breaking
 * there is correct typography — those are excluded.
 */
async function findHyphenBreaks(page, selector) {
  return page.evaluate((sel) => {
    const out = [];
    for (const root of document.querySelectorAll(sel)) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.nodeValue;
        if (!t || !t.trim() || !n.parentElement || n.parentElement.closest('svg')) continue;
        const r = document.createRange();
        const lines = []; let cur = null;
        for (let i = 0; i < t.length; i++) {
          r.setStart(n, i); r.setEnd(n, i + 1);
          const b = r.getBoundingClientRect();
          if (!b.width && !b.height) continue;
          const top = Math.round(b.top * 2) / 2;
          if (!cur || cur.top !== top) { cur = { top, f: i, l: i }; lines.push(cur); } else cur.l = i;
        }
        for (let i = 0; i < lines.length - 1; i++) {
          const seg = t.slice(lines[i].f, lines[i].l + 1).replace(/\s+$/, '');
          if (/[-‐]$/.test(seg) && !/\s.$/.test(seg)) {
            out.push({ cls: n.parentElement.className,
              before: seg.slice(-30), after: t.slice(lines[i + 1].f, lines[i + 1].l + 1).trim().slice(0, 20) });
          }
        }
      }
    }
    return out;
  }, selector);
}

/**
 * Measure each page container's rendered height, physical-sheet count, and HEADROOM.
 *
 * WHY HEADROOM IS MEASURED SEPARATELY, AND WHY IT MATTERS MORE THAN ITS SIZE SUGGESTS
 * -----------------------------------------------------------------------------------
 * `.v3-page` is `min-height:1056px`, so getBoundingClientRect().height reports exactly
 * 1056px for every page that fits — on every platform, at every content length. The spill
 * check below is still correct (an overflowing page grows past the minimum and is caught),
 * but the number it prints carries almost no information: a page with 200px to spare and a
 * page one word from spilling both log `1056px`.
 *
 * That is why CI green has only ever proved "content stack <= 976px". It says nothing about
 * whether the stack is 938.75px on Linux or 951px — and the character bands governing the
 * ~550 authoring units of PR 3 have never been corroborated cross-platform by anything
 * except the font probe. Liberation Sans is metric-compatible with Arial, so they should
 * agree; "should" is not a measurement.
 *
 * Releasing min-height to 0 lets the box collapse to its natural content height. Headroom is
 * then 1056 minus that — directly "how much can this page grow before it spills", with no
 * convention to argue about. (Note this differs by ~20px from the figures in
 * docs/audit_pr2_static_pages.md section 9, which excluded the .page-footer box from the
 * stack; the ordering is identical and the offset is constant.)
 *
 * With this printed, PR 3's first CI run yields the Linux bands for free.
 *
 * CAVEAT: this only collapses boxes sized by `min-height`. The legacy `.cover` pages (Title,
 * TOC, P1 Welcome) use a fixed `height`, so they report `0.00px free` — that is "not
 * measurable this way", not "one word from spilling". Every `.v3-page` is min-height, so the
 * figure is real for the whole v3 document, which is what PR 3 needs.
 */
async function measureLayout(page, selector) {
  await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 150));
  return page.evaluate((PAGE_PX, selector) => {
    const els = [...document.querySelectorAll(selector)];
    const rendered = els.map(el => el.getBoundingClientRect().height);
    // Natural height with the minimum released, then restored. Done per element and undone
    // immediately so no later measurement in this page context sees a mutated layout.
    const natural = els.map(el => {
      const prev = el.style.minHeight;
      el.style.minHeight = '0px';
      const h = el.getBoundingClientRect().height;
      el.style.minHeight = prev;
      return h;
    });
    return els.map((el, i) => ({
      index: i,
      height: Math.round(rendered[i]),
      natural: +natural[i].toFixed(2),
      headroom: +(PAGE_PX - natural[i]).toFixed(2),
      sheets: Math.max(1, Math.ceil(rendered[i] / (PAGE_PX + 1))),
    }));
  }, PAGE_PX, selector);
}

(async () => {
  await require(path.join(ROOT, 'scripts/lib/override_banner.js')).printOverrideBanner();
  const browser = await launch();
  let failed = false;
  const fail = (msg) => { failed = true; console.log(`  *** FAIL — ${msg}`); };
  try {
    for (const [kind, cfg] of Object.entries(REPORTS)) {
     for (const fx of (cfg.fixtures || ['sp4', 'sx7'])) {
      const fixture = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));
      for (const asType of (cfg.types || [null])) {
        const apiResult = asType == null ? fixture : (() => {
          const c = JSON.parse(JSON.stringify(fixture));
          const realType = fixture.hypothesis.confirmed_type;
          c.hypothesis.confirmed_type = asType;
          c.hypothesis.confirmed_type_name = null;                 // suppress the name-drift flag
          c.hypothesis.alternate_candidate = (asType % 9) + 1;
          const pb = c.coach_report && c.coach_report.section6 && c.coach_report.section6.pushes_back;
          if (pb) pb.alt_type_name = null;
          // The client's verbatim quotes are EVIDENCE FOR THE FIXTURE'S REAL TYPE, so they are
          // dropped when the fixture is re-typed. Sheet 6's "In Your Own Words" band would
          // otherwise print this Type 9 client's own language ("I project a calm presence…")
          // under a Type 1 or Type 7 heading — content that reads as authored-for-this-type and
          // is not. Every other zone on the re-typed sheets is per-type library content and
          // follows asType correctly; this is the only per-client one, and the only one that
          // has to be withheld. Consequence for review renders: the band appears on the
          // fixture's own type and nowhere else, which is the honest result.
          if (asType !== realType) c.client_words = {};
          return c;
        })();
        console.log(`\n=== ${fx}${asType == null ? '' : ` as Type ${asType}`} · ${kind} ===`);
        let html;
        try {
          html = await cfg.build(apiResult);
        } catch (e) {
          fail(`${kind} build threw: ${e.message}`);
          continue;
        }
        const tag = asType == null ? fx : `${fx}_t${asType}`;
        fs.writeFileSync(path.join(OUT, `${kind}_${tag}.html`), html);

        const page = await browser.newPage();
        await page.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.emulateMediaType('print');
        // Fail loudly if Chromium substituted a font: every single-sheet measurement below
        // assumes Arial metrics, and a substitution is otherwise invisible until a page
        // silently becomes two sheets.
        try {
          const w = await browserLaunch.assertReportFont(page);
          if (!fontReported) { console.log(`  font probe: ${w.toFixed(2)}px (Arial metrics OK)`); fontReported = true; }
        } catch (e) { fail(e.message); }
        const pages = await measureLayout(page, cfg.selector);
        let sheets = 0;
        for (const p of pages) {
          sheets += p.sheets;
          const spill = p.height > PAGE_PX + 1 ? `  *** SPILL → ${p.sheets} sheets` : '';
          // headroom, not height, is the informative number — see measureLayout.
          const room = p.headroom < 0 ? `OVER by ${(-p.headroom).toFixed(2)}px` : `${p.headroom.toFixed(2)}px free`;
          const LBL = cfg.labelsFor ? cfg.labelsFor(asType) : cfg.labels;
          console.log(`  ${(LBL[p.index] || 'page ' + p.index).padEnd(16)} ${p.height}px  ` +
                      `stack ${p.natural.toFixed(2)}px  ${room}${spill}`);
          if (cfg.enforceSheet && p.height > PAGE_PX + 1) {
            fail(`${kind}${asType == null ? '' : ' Type ' + asType} ${(cfg.labelsFor ? cfg.labelsFor(asType) : cfg.labels)[p.index] || 'page ' + p.index} spills to ${p.sheets} sheets (${p.height}px > ${PAGE_PX}px)`);
          }
        }
        const want = cfg.expectedFor ? cfg.expectedFor(asType) : cfg.expected;
        if (pages.length !== want) {
          fail(`${kind}${asType == null ? '' : ' Type ' + asType} page count ${pages.length}, expected ${want}`);
        }
        // ── §6.1 matched line counts — REPORT-ONLY ───────────────────────────────
        // Prints every pair for every built type, pass or fail. A run that only speaks up on
        // failure gives PR 3e nothing to read its five new types against, which is the whole
        // reason this lands before them. Never calls fail(); the run exits zero regardless.
        if (cfg.pairChecks && asType != null) {
          const idx = {};
          R.v3PagesFor(asType).forEach((pg, i) => { idx[pg.key] = i; });
          const rows = await lineMetrics.measurePairs(page, idx, cfg.pairChecks);
          for (const r of rows) {
            if (r.skipped) continue;               // sheet not built for this type
            const mark = r.missing ? '  ?? selector missed: ' + r.missing
                       : r.match ? '  ok' : '  *** MISMATCH';
            console.log(`  §6.1 pair  Type ${asType}  ${r.name.padEnd(24)} `
              + `${r.aLabel} ${String(r.a).padStart(2)} / ${r.bLabel} ${String(r.b).padStart(2)}${mark}`);
          }
        }

        // ── §6 last-line fill outliers — REPORT-ONLY ──────────────────────────────
        if (cfg.fillZones && asType != null) {
          const idx = {};
          R.v3PagesFor(asType).forEach((pg, i) => { idx[pg.key] = i; });
          const zs = await lineMetrics.measureZones(page, idx, cfg.fillZones);
          for (const z of zs) {
            if (z.skipped) continue;
            const fill = z.fill == null ? 'n/a (single line)' : (z.fill * 100).toFixed(1) + '%';
            console.log(`  §6 fill    Type ${asType}  ${z.name.padEnd(24)} `
              + `${String(z.chars).padStart(3)}ch / ${z.lines}L  last-line ${fill}`);
          }
        }

        if (cfg.checkHyphens) {
          const hb = await findHyphenBreaks(page, cfg.selector);
          for (const b of hb) {
            fail(`${kind} word split across lines at an existing hyphen in .${b.cls}: ` +
                 `"…${b.before}" / "${b.after}…" — use U+2011, or a nowrap span for a URL`);
          }
          if (!hb.length) console.log('  hyphenation: no word split across lines');
        }
        await page.pdf({ path: path.join(OUT, `${kind}_${tag}.pdf`), ...R.buildCoachPdfOptions() });
        await page.close();
        console.log(`  logical pages: ${pages.length} · estimated physical sheets: ${sheets} · wrote .phase6_out/${kind}_${tag}.pdf`);
      }
     }
    }
  } finally { await browser.close(); }
  if (failed) { console.log('\nRENDER CHECK: FAILURES ABOVE.'); process.exit(1); }
  console.log('\nRENDER CHECK: ALL PASSED.');
})().catch(e => { console.error('RENDER FAILED:', e.stack || e.message); process.exit(1); });
