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
    expected: 6,
    enforceSheet: true,
    // Document order, not sheet order: PR 2 adds sheets 1-4 and 12 around the Wings page
    // PR 1 built, and sheets 5-11 land in later PRs.
    labels: ['P1 Cover', 'P2 Contents', 'P3 Welcome', 'P4 What Is', 'P8 Wings', 'P12 Thoughts'],
    checkHyphens: true,
    fixtures: ['anders_sx9'],   // Type 9 / SX9 — the only type with v3 content so far
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

// Measure each page container's rendered height + physical-sheet count under flowing layout.
async function measureLayout(page, selector) {
  await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 150));
  return page.evaluate((PAGE_PX, selector) => {
    return [...document.querySelectorAll(selector)].map((el, i) => {
      const h = el.getBoundingClientRect().height;
      return { index: i, height: Math.round(h), sheets: Math.max(1, Math.ceil(h / (PAGE_PX + 1))) };
    });
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
      const apiResult = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));
      {
        console.log(`\n=== ${fx} · ${kind} ===`);
        let html;
        try {
          html = await cfg.build(apiResult);
        } catch (e) {
          fail(`${kind} build threw: ${e.message}`);
          continue;
        }
        fs.writeFileSync(path.join(OUT, `${kind}_${fx}.html`), html);

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
          console.log(`  ${(cfg.labels[p.index] || 'page ' + p.index).padEnd(16)} ${p.height}px${spill}`);
          if (cfg.enforceSheet && p.height > PAGE_PX + 1) {
            fail(`${kind} ${cfg.labels[p.index] || 'page ' + p.index} spills to ${p.sheets} sheets (${p.height}px > ${PAGE_PX}px)`);
          }
        }
        if (pages.length !== cfg.expected) {
          fail(`${kind} page count ${pages.length}, expected ${cfg.expected}`);
        }
        if (cfg.checkHyphens) {
          const hb = await findHyphenBreaks(page, cfg.selector);
          for (const b of hb) {
            fail(`${kind} word split across lines at an existing hyphen in .${b.cls}: ` +
                 `"…${b.before}" / "${b.after}…" — use U+2011, or a nowrap span for a URL`);
          }
          if (!hb.length) console.log('  hyphenation: no word split across lines');
        }
        await page.pdf({ path: path.join(OUT, `${kind}_${fx}.pdf`), ...R.buildCoachPdfOptions() });
        await page.close();
        console.log(`  logical pages: ${pages.length} · estimated physical sheets: ${sheets} · wrote .phase6_out/${kind}_${fx}.pdf`);
      }
     }
    }
  } finally { await browser.close(); }
  if (failed) { console.log('\nRENDER CHECK: FAILURES ABOVE.'); process.exit(1); }
  console.log('\nRENDER CHECK: ALL PASSED.');
})().catch(e => { console.error('RENDER FAILED:', e.stack || e.message); process.exit(1); });
