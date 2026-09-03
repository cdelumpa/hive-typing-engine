#!/usr/bin/env node
'use strict';

/**
 * report_pages_test.js — offline structural regression net for the report
 * page-container inventory. No server, no API key, no DB (renders straight from
 * the committed sp4/sx7 api_result fixtures via report_prep → renderer).
 *
 * Two layers:
 *   UNIT        — countByClass token-boundary correctness (the regex is the fix).
 *   INTEGRATION — the real coach/client HTML emits exactly the contracted page
 *                 containers (coach 3, client 10), per selector, on both fixtures.
 *
 * This is the offline twin of the render half of tests/run_test.js (which only
 * runs against a live server). Both import tests/lib/report_page_inventory.js, so
 * the live and offline checks share one contract and cannot drift. When the
 * Phase-2 redesign drops or reorders a page, this fails in the free `npm test`.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
const {
  PAGE_INVENTORY, EXPECTED_PAGES, countByClass, countPages, pageBreakdown,
} = require(path.join(__dirname, 'lib', 'report_page_inventory'));

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓  ' + msg); }
  else { failed++; console.log('  ✗  ' + msg); }
}

const client = { first_name: 'Test', last_name: 'Client', organization: 'Acme Co', date: 'June 2026' };
const coach = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };

// ── UNIT: countByClass matches a class as a whole space-delimited word ─────────
console.log('\ncountByClass token boundaries:');
{
  // exact single-token match
  assert(countByClass('<div class="page"></div>', 'page') === 1, 'page matches class="page"');
  assert(countByClass('<div class="p3-page"></div>', 'p3-page') === 1, 'p3-page matches class="p3-page"');
  assert(countByClass('<div class="report-page"></div>', 'report-page') === 1, 'report-page matches class="report-page"');

  // hyphen is NOT a word boundary here: `page` must not match longer class names
  assert(countByClass('<div class="page-body"></div>', 'page') === 0, 'page does NOT match page-body');
  assert(countByClass('<div class="page-footer"></div>', 'page') === 0, 'page does NOT match page-footer');
  assert(countByClass('<div class="pageNumber"></div>', 'page') === 0, 'page does NOT match pageNumber');
  assert(countByClass('<div class="p3-page"></div>', 'page') === 0, 'page does NOT match p3-page');
  assert(countByClass('<div class="p3-page-title"></div>', 'p3-page') === 0, 'p3-page does NOT match p3-page-title');
  assert(countByClass('<div class="p3-page-body"></div>', 'p3-page') === 0, 'p3-page does NOT match p3-page-body');

  // multi-token class: `cover cover-welcome` is ONE element, counted once
  assert(countByClass('<div class="cover cover-welcome"></div>', 'cover') === 1, 'cover matches "cover cover-welcome" once');
  assert(countByClass('<div class="cover cover-welcome"></div>', 'cover-welcome') === 1, 'cover-welcome matches "cover cover-welcome" once');
  assert(countByClass('<div class="cover-welcome"></div>', 'cover') === 0, 'cover does NOT match lone cover-welcome');

  // multiple occurrences accumulate
  const two = '<div class="cover"></div><section class="cover cover-welcome"></section>';
  assert(countByClass(two, 'cover') === 2, 'two distinct cover elements count as 2');
}

// ── INTEGRATION: real rendered HTML carries the contracted inventory ──────────
(async () => {
  for (const fx of ['sp4', 'sx7']) {
    console.log(`\nFIXTURE ${fx} — rendered page inventory:`);
    const apiResult = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));

    let coachHtml, clientHtml;
    try {
      coachHtml = R.buildCoachReportHTML(await prep.buildCoachModel({ apiResult, client, coach }));
      clientHtml = R.buildClientReportHTML(await prep.buildClientModel({ apiResult, client, coach }));
    } catch (e) {
      assert(false, `${fx}: build/render threw — ${e.message}`);
      continue;
    }

    for (const [kind, html] of [['coach', coachHtml], ['client', clientHtml]]) {
      const total = countPages(html, kind);
      assert(total === EXPECTED_PAGES[kind], `${kind}: ${total} page containers (expected ${EXPECTED_PAGES[kind]})`);
      const found = pageBreakdown(html, kind);
      for (const [sel, want] of Object.entries(PAGE_INVENTORY[kind])) {
        assert(found[sel] === want, `${kind}: .${sel} ×${found[sel]} (expected ${want})`);
      }
    }

    // Pin the documented drift so nobody "fixes" the 0-count symptom by re-adding
    // the legacy container to the client report: the client HTML must carry ZERO
    // class="report-page" (that marker belongs to the coach report only).
    assert(countByClass(clientHtml, 'report-page') === 0, `${fx}: client report emits no legacy .report-page`);
    assert(countByClass(coachHtml, 'report-page') === 3, `${fx}: coach report emits 3 .report-page`);
  }

  // ── CLIENT REPORT v3 — page inventory + the footer/Contents sync contract ────
  // Added in PR 2. Until now nothing in `npm test` knew .v3-page existed: the only v3
  // structural check lived in scripts/render_client.js's `expected` count, which is not
  // part of the free test run. Design spec v3.0 section 8 question 7 asks where page
  // numbering lives and how it stays in sync with the contents page — these assertions are
  // the answer, and they are cheap enough to run on every push.
  {
    console.log('\nCLIENT REPORT v3 — structure and page numbering:');
    const apiResult = require(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json'));
    const V3_CLIENT = { first_name: 'Anders', last_name: 'Wennerstrom', organization: 'Hive', date: 'August 2026' };
    let html, model;
    try {
      model = await prep.buildClientModel({ apiResult, client: V3_CLIENT, coach });
      html = R.buildClientReportHTML_v3(model);
    } catch (e) {
      assert(false, `v3: build/render threw — ${e.message}`);
      return;
    }

    // The fixture is Type 9, which is the sheets 6-7 pilot type, so this render carries the
    // NINE-page document. `client_v3` (7) is the count for every other type and is exercised
    // by the non-pilot render below.
    const total = countPages(html, 'client_v3_pilot');
    assert(total === EXPECTED_PAGES.client_v3_pilot,
      `v3: ${total} .v3-page containers for the pilot type (expected ${EXPECTED_PAGES.client_v3_pilot})`);

    // NON-PILOT TYPE — the other half of the pilot gate. A type with no explore_v3 content must
    // render a SEVEN-page document with no Exploring markup at all. A blank sheet 6/7 rendering
    // silently is the exact defect the Wings and Lines gates were added to stop, so it is
    // asserted here rather than assumed from the renderer's filter.
    //
    // The type is DERIVED, not a literal. This read type 1 until the 1/4/7 batch authored it,
    // at which point the assertion was still true of the constant but no longer testing
    // anything — type 1 had become a pilot type and the "non-pilot" render was a pilot render
    // that happened to be compared against the wrong count. Picking the lowest type absent
    // from the pilot list keeps this honest as the remaining types land.
    {
      const nonPilot = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(n => !R.V3_EXPLORE_PILOT_TYPES.includes(n));
      assert(nonPilot != null, 'v3: no non-pilot type left — retire this block when all nine are authored');
      const t1 = JSON.parse(JSON.stringify(apiResult));
      t1.hypothesis.confirmed_type = nonPilot;
      t1.hypothesis.confirmed_type_name = null;
      const m1 = await prep.buildClientModel({ apiResult: t1, client: V3_CLIENT, coach });
      const h1 = R.buildClientReportHTML_v3(m1);
      const n1 = countPages(h1, 'client_v3');
      assert(n1 === EXPECTED_PAGES.client_v3,
        `v3: non-pilot type ${nonPilot} renders ${n1} .v3-page containers (expected ${EXPECTED_PAGES.client_v3})`);
      // Scoped to class ATTRIBUTES: the p6/p7 rules ship in the stylesheet on every page, so
      // a bare substring test matches the CSS and passes for the wrong reason.
      assert(!/class="v3-ta-|class="v3-tb-/.test(h1), 'v3: a non-pilot type emits no Exploring-sheet markup');
      assert(R.v3PagesFor(nonPilot).length === EXPECTED_PAGES.client_v3,
        `v3: v3PagesFor(${nonPilot}) agrees with the non-pilot page count`);
    }

    // "IN YOUR OWN WORDS" — sheet 6's only per-client zone. Both directions are asserted,
    // and the absence direction is the one that matters: an empty band is a cream strip with
    // a heading and nothing under it, which is the blank-zone defect the Wings and Lines
    // gates exist to prevent, and it is invisible in a page-count check.
    {
      assert(/class="v3-ta-words"/.test(html), 'v3: sheet 6 renders the In Your Own Words band when the client has quotes');
      assert(/I project a calm presence/.test(html), "v3: the band prints the client's verbatim words");
      // Both quotes, joined — not just the first.
      assert(/I overthink things at times/.test(html), 'v3: the band prints every leading quote, not only the first');

      const noWords = JSON.parse(JSON.stringify(apiResult));
      noWords.client_words = {};
      const mw = await prep.buildClientModel({ apiResult: noWords, client: V3_CLIENT, coach });
      const hw = R.buildClientReportHTML_v3(mw);
      assert(!/class="v3-ta-words"/.test(hw), 'v3: a client with no quotes gets NO band, not an empty one');
      // The rest of sheet 6 must be unaffected — the band is additive, not load-bearing.
      assert(countPages(hw, 'client_v3_pilot') === EXPECTED_PAGES.client_v3_pilot,
        'v3: dropping the band leaves the page count unchanged');
      assert(/class="v3-ta-cm"/.test(hw), 'v3: dropping the band leaves the Core Motivation block intact');
    }

    // The library object must NOT have been mutated by the quote wiring — it is require-cached
    // and shared, so a stray assignment would leak one client's words into the next report.
    {
      const lib = require(path.join(ROOT, 'app/content/content_library.json'));
      assert(!('words' in (lib.type_9.explore_v3 || {})),
        'v3: the content library explore_v3 object was not mutated with per-client quotes');
    }

    // And the pilot half, likewise derived: every authored type must reach the nine-page
    // document. The fixture render above only proves it for type 9.
    for (const n of R.V3_EXPLORE_PILOT_TYPES) {
      const tn = JSON.parse(JSON.stringify(apiResult));
      tn.hypothesis.confirmed_type = n;
      tn.hypothesis.confirmed_type_name = null;
      const mn = await prep.buildClientModel({ apiResult: tn, client: V3_CLIENT, coach });
      const hn = R.buildClientReportHTML_v3(mn);
      assert(countPages(hn, 'client_v3_pilot') === EXPECTED_PAGES.client_v3_pilot,
        `v3: pilot type ${n} renders ${EXPECTED_PAGES.client_v3_pilot} .v3-page containers`);
      assert(/class="v3-ta-/.test(hn) && /class="v3-tb-/.test(hn),
        `v3: pilot type ${n} emits both Exploring sheets`);
    }

    // The order table itself: sheets 1..12, contiguous; cover and contents unnumbered;
    // every other sheet numbered sheet-2. A typo here would renumber the whole document.
    const order = R.V3_PAGE_ORDER;
    assert(order.length === 12, `v3: V3_PAGE_ORDER has ${order.length} rows (expected 12)`);
    assert(order.every((p, i) => p.sheet === i + 1), 'v3: V3_PAGE_ORDER sheets are 1..12 in order');
    assert(order[0].footer === null && order[1].footer === null, 'v3: cover and contents are unnumbered');
    assert(order.slice(2).every(p => p.footer === p.sheet - 2), 'v3: every numbered sheet has footer === sheet - 2');
    assert(order[2].footer === 1, 'v3: the first numbered sheet (Welcome) carries footer 1');

    // WHICH PAGES ARE BUILT comes from V3_PAGE_ORDER's `built` flags, not from a list
    // restated here. The three assertions below used to carry that subset by hand — the key
    // list, the footer count and the header count — so landing a page meant editing four
    // literals across two files. The p9 spike edited one of them and this suite went red.
    // Pilot-scoped sheets mean "which pages exist" is a function of the type, so this comes
    // from the same helper the renderer emits with rather than from `built` alone.
    const builtPages = R.v3PagesFor(model.hero.number);
    // Pages that emit chrome. _v3Footer returns '' for chrome:'none' (the cover), and the
    // cover is likewise the only page with no header — so both counts are the same subset.
    const withChrome = builtPages.filter(p => p.chrome !== 'none');

    // Rendered footers must equal V3_PAGE_ORDER.footer — the concrete anti-drift check.
    // The cover emits NO footer element and contents emits one with an EMPTY number slot,
    // so the rendered sequence is deliberately ['', 1, 2, 6, 7, 10] for the pages built so far.
    const renderedFooters = [...html.matchAll(/<div class="page-footer">[\s\S]*?<span>(?:Page )?(\d*)<\/span>/g)].map(m => m[1]);
    const wantFooters = withChrome.map(p => (p.footer == null ? '' : String(p.footer)));
    assert(renderedFooters.join(',') === wantFooters.join(','),
      `v3: rendered footers [${renderedFooters}] match V3_PAGE_ORDER [${wantFooters}]`);
    // The cover must emit no footer element at all (chrome:'none').
    assert((html.match(/<div class="page-footer">/g) || []).length === withChrome.length,
      `v3: ${withChrome.length} footer elements across ${builtPages.length} pages (the cover has none)`);

    // Contents page numbers must be COMPUTED from V3_PAGE_ORDER, never hardcoded. Nine
    // entries cover ten numbered sheets: entry 04 spans sheets 6-7, so footer 5 is
    // correctly absent from the column.
    const tpg = [...html.matchAll(/<div class="v3-toc-pg">(\d+)<\/div>/g)].map(m => +m[1]);
    const wantTpg = model.pages.v3_contents.map(e => order.find(p => p.key === e.start).footer);
    assert(tpg.length === 9, `v3: contents lists ${tpg.length} entries (expected 9)`);
    assert(tpg.join(',') === wantTpg.join(','), `v3: contents page numbers [${tpg}] are computed from V3_PAGE_ORDER [${wantTpg}]`);
    assert(!tpg.includes(5), 'v3: footer 5 is absent from the contents column (entry 04 spans sheets 6-7)');
    assert(model.pages.v3_contents.every(e => order.some(p => p.key === e.start)),
      'v3: every contents entry names a real V3_PAGE_ORDER key');

    // Tokens (brief v2.0 section 12.4). nickname/nickname_plural must exist and be applied:
    // the contents page prints "Development Ideas for Peacemakers", never the raw template.
    assert(model.display.nickname === 'Peacemaker', `v3: display.nickname = ${model.display.nickname} (expected Peacemaker)`);
    assert(model.display.nickname_plural === 'Peacemakers', `v3: display.nickname_plural = ${model.display.nickname_plural}`);
    assert(!/\{(type_word|subtype_label|nickname|nickname_plural)\}/.test(html), 'v3: no unresolved {token} placeholders in the rendered HTML');
    assert(html.includes('Development Ideas for Peacemakers'), 'v3: contents entry 08 renders the plural nickname');

    // The nickname rule (strip "The", add "s") must hold for all nine archetype names —
    // spec section 6 claims "all nine work", and PR 6 depends on it.
    const { TYPE_NAMES } = require(path.join(ROOT, 'app/type_meta.js'));
    const plurals = Object.values(TYPE_NAMES).map(n => n.replace(/^The\s+/, '') + 's');
    assert(plurals.every(p => /^[A-Z][a-z]+s$/.test(p)), `v3: plural rule holds for all nine names (${plurals.join(', ')})`);

    // NO subtype anywhere in chrome (brief v2.0 section 12.1, reversed 12 Aug 2026). Five
    // mockups print "· SX9" in the header and TOC_v2 prints it in the client strip; the
    // build deliberately departs from all six. Asserted so the next person to "restore
    // fidelity to the mockup" trips a test instead of shipping it.
    const headers = (html.match(/<span class="header-right">[\s\S]*?<\/span>\s*<\/div>/g) || []);
    assert(headers.length === withChrome.length,
      `v3: ${headers.length} page headers (expected ${withChrome.length}; the cover has none)`);
    const code = `${model.display.instinct_code}${model.hero.number}`;   // "SX9"
    assert(headers.every(h => !h.includes(code)), `v3: no page header carries the subtype code (${code})`);
    assert(!html.includes(code), `v3: the subtype code (${code}) appears nowhere in the ${builtPages.length} built sheets`);
    // The derivation stays in the model even though PR 2 stops consuming it — sheet 5 needs it.
    assert(model.display.instinct_code === 'SX', 'v3: display.instinct_code is still derived for sheet 5');

    // Spec section 3.2 is a source-level invariant too, not only a PDF one — this catches a
    // banned construct at `npm test` speed, before the PDF gate has to render anything.
    // CSS and HTML comments are stripped first: the stylesheets document WHY rgba() is
    // banned, and matching the prose instead of the declarations is a false positive.
    const live = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    const banned = ['rgba(', 'fill-opacity', 'stop-opacity'].filter(t => live.includes(t))
      .concat(/[:,]\s*transparent\b/.test(live) ? ['transparent keyword'] : []);
    assert(banned.length === 0, `v3: no rgba(), transparent keyword, or fill/stop-opacity in the emitted CSS${banned.length ? ' — found ' + banned.join(', ') : ''}`);
  }

  console.log('\n=== RESULT: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('\n[ERROR]', e.stack || e.message); process.exit(1); });
