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

    // ── SHEET 5's MODEL CONTRACT (PR 5 Build 1) ────────────────────────────────────────
    //
    // Sheet 5 does not exist yet — this asserts the DATA it will read, so the shape is
    // locked before a page builder assumes it. buildClientModel already throws on all of
    // these via CLIENT_SPEC; asserting here as well is not redundant, because a future
    // relaxation of the spec would otherwise be silent.
    //
    // NOT ASSERTED: hypothesis.leading_candidate. Cai's 8 Sep decision sources the LEADING
    // ring from hero.number, so no client page reads it, and it is not on the client model
    // (report_prep.js puts it on the COACH model only). See report_prep.js CLIENT_SPEC.
    {
      const t = model.charts.types;
      assert(Array.isArray(t), `v3 sheet-5 contract: charts.types is not an array`);
      assert(t.length === 9, `v3 sheet-5 contract: charts.types has ${t.length} entries, expected 9`);
      const types = t.map(r => r.type).sort((a, b) => a - b).join(',');
      assert(types === '1,2,3,4,5,6,7,8,9',
        `v3 sheet-5 contract: charts.types types are [${types}], expected one per type 1-9`);
      assert(t.every(r => Number.isInteger(r.score) && r.score >= 0 && r.score <= 100),
        `v3 sheet-5 contract: charts.types carries a non-integer or out-of-range score`);
      // The two rings must each have a node to sit on.
      assert(t.some(r => r.type === model.hero.number),
        `v3 sheet-5 contract: hero.number ${model.hero.number} has no node in charts.types`);
      assert(t.some(r => r.type === model.alternate.number),
        `v3 sheet-5 contract: alternate.number ${model.alternate.number} has no node in charts.types`);
      // ── POSITIONS, AND THE THING THE BACKFILL WOULD OTHERWISE HIDE (PR 5 Build 3) ────
      //
      // Sheet 5 shades by `position`, so positions 1-9 exactly once is the invariant that has
      // to hold; validateModel throws on it.
      const pos = t.map(r => r.position).sort((a, b) => a - b).join(',');
      assert(pos === '1,2,3,4,5,6,7,8,9',
        `v3 sheet-5 contract: charts.types positions are [${pos}], expected 1-9 exactly once`);
      assert(t.find(r => r.position === 1).type === model.hero.number,
        'v3 sheet-5 contract: position 1 is not hero.number — the LEADING ring would not be darkest');
      assert(t.find(r => r.position === 2).type === model.alternate.number,
        'v3 sheet-5 contract: position 2 is not alternate.number — the ALTERNATE ring would not be second');

      // WHY A NULL-SCORE CHECK EXISTS AT ALL. typeRamp now BACKFILLS any type missing from
      // call1_ranking, so that a malformed ranking can never leave a ring unplaced — deliberate,
      // and it matches call2_stamp.js's posture of flagging rather than hard-stopping. But it
      // also means validateModel's ninePerType can no longer detect a short ranking: MEASURED,
      // a two-entry call1_ranking threw on main and builds cleanly here, backfilling positions
      // 3-9. The backfilled entries carry `score: null`, which is honest — the engine produced
      // no number for them — and that is the signal. Asserting NO NULLS on the tracked fixtures
      // keeps a malformed fixture or CMS stub detectable, while leaving production free to
      // degrade rather than fail to generate a report.
      const nulls = t.filter(r => r.score === null).map(r => 'p' + r.position);
      assert(nulls.length === 0,
        `v3 sheet-5 contract: charts.types has backfilled entries at ${nulls.join(', ')} — `
        + 'call1_ranking was short or malformed for this fixture');

      // The ALTERNATE hypothesis block's motivation, from the alternate's own library entry.
      const acm = model.pages.type_hypotheses.alternate_core_motivation;
      assert(typeof acm === 'string' && acm.trim().length > 0,
        `v3 sheet-5 contract: alternate_core_motivation is empty (${JSON.stringify(acm)})`);
      assert(acm !== model.pages.v3_explore.p6.core_motivation,
        `v3 sheet-5 contract: alternate_core_motivation equals the HERO's — it must come from the alternate`);
    }

    // Every type renders the NINE-page document as of PR 3e — sheets 6-7 are authored for all
    // nine, so the two page counts collapse back to one.
    const total = countPages(html, 'client_v3');
    assert(total === EXPECTED_PAGES.client_v3,
      `v3: ${total} .v3-page containers (expected ${EXPECTED_PAGES.client_v3})`);

    // THE BLANK-PAGE GUARD — the mechanism changed in PR 3e, the guarantee did not.
    //
    // This block used to render the lowest type absent from V3_EXPLORE_PILOT_TYPES and assert
    // it produced a seven-page document. That list is gone: sheets 6-7 are unconditional now,
    // so there is no drop to test and no list to be absent from.
    //
    // What still needs asserting is the same thing it always did — a type with no content must
    // not render the page anyway, blank. The mechanism is now a THROW in the render functions
    // rather than a filter in v3PagesFor, so that is what is asserted, against a synthetic
    // model. Synthetic on purpose: a real type would put this back on the shipping schedule,
    // which is exactly what made the previous version expire.
    {
      const bare = await prep.buildClientModel({ apiResult, client: V3_CLIENT, coach });
      delete bare.pages.v3_explore;
      let threw = null;
      try { R.buildClientReportHTML_v3(bare); } catch (e) { threw = e; }
      assert(threw != null, 'v3: a model with no explore_v3 must throw, not render sheets 6-7 blank');
      assert(/explore_v3/.test(threw.message),
        `v3: the throw names the missing content — got "${threw.message.slice(0, 70)}"`);
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
      assert(countPages(hw, 'client_v3') === EXPECTED_PAGES.client_v3,
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

    // ALL NINE, each actually rendered. The fixture render above proves it for type 9 only,
    // and "every type carries sheets 6-7" is the claim PR 3e makes — so it is asserted per
    // type rather than inferred from the list being full.
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const tn = JSON.parse(JSON.stringify(apiResult));
      tn.hypothesis.confirmed_type = n;
      tn.hypothesis.confirmed_type_name = null;
      const mn = await prep.buildClientModel({ apiResult: tn, client: V3_CLIENT, coach });
      const hn = R.buildClientReportHTML_v3(mn);
      assert(countPages(hn, 'client_v3') === EXPECTED_PAGES.client_v3,
        `v3: type ${n} renders ${EXPECTED_PAGES.client_v3} .v3-page containers`);
      assert(/class="v3-ta-/.test(hn) && /class="v3-tb-/.test(hn),
        `v3: type ${n} emits both Exploring sheets`);
    }

    // The order table itself: sheets 1..12, contiguous; cover and contents unnumbered;
    // every other sheet numbered sheet-2. A typo here would renumber the whole document.
    const order = R.V3_PAGE_ORDER;
    assert(order.length === 12, `v3: V3_PAGE_ORDER has ${order.length} rows (expected 12)`);
    assert(order.every((p, i) => p.sheet === i + 1), 'v3: V3_PAGE_ORDER sheets are 1..12 in order');
    assert(order[0].footer === null && order[1].footer === null, 'v3: cover and contents are unnumbered');
    assert(order.slice(2).every(p => p.footer === p.sheet - 2), 'v3: every numbered sheet has footer === sheet - 2');
    assert(order[2].footer === 1, 'v3: the first numbered sheet (Welcome) carries footer 1');
    // PR 6 (audit A5). Two strings point across pages by position: sheet 11's closing note ("use
    // the next page") and Your Thoughts prompt 3 ("on the previous page"). Both are true only
    // while Development Ideas immediately precedes Your Thoughts, so the order is asserted —
    // a reorder fails here instead of shipping two false pointers in a client's PDF.
    const carAt = order.findIndex(p => p.key === 'car');
    assert(carAt >= 0 && order[carAt + 1] && order[carAt + 1].key === 'thoughts',
      'v3: Development Ideas (car) immediately precedes Your Thoughts — the cross-page pointers depend on it');

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

    // ── p10 Instincts & Subtypes — D4's negative gate, in TWO halves (PR 4 step 5A) ──
    //
    // WHY THE PRESENCE HALF EXISTS. "the emitted page contains no shift zone" passed
    // VACUOUSLY for the whole of PR 4 — green from the first audit onward — because
    // V3_PAGE_BUILDERS had no `instincts` entry and nothing was emitted to contain
    // anything. A negative assertion that is green before the work starts is not a gate.
    // So: assert the page IS there, then assert what it does not carry.
    //
    // WHY THE ABSENCE HALF IS WORTH ASSERTING. D4 cut the shift bullets and the "Leaning
    // Into the Other Instincts" blocks FROM p10 — it did not cut them from the product.
    // subtype.shifts is live v2 content on p7 (report_prep -> renderer.js:2347) and it sits
    // on the very row this page reads. Rendering it here is a one-line mistake.
    {
      const p10 = html.match(/<div class="v3-page">(?:(?!<div class="v3-page">)[\s\S])*?v3-inst-cmp[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
      assert(/class="v3-inst-cmp"/.test(html), 'v3: p10 IS emitted — the .v3-inst-cmp comparison unit is present');
      assert(/class="v3-inst-card"|class="v3-inst-card is-yours"/.test(html), 'v3: p10 emits subtype columns');
      assert((html.match(/class="v3-inst-card/g) || []).length === 3, 'v3: p10 emits exactly three subtype columns');

      // The absence half, scoped to the page rather than the document: p7 legitimately
      // carries shift content, so a whole-document check would be asserting the wrong thing.
      // `class="v3-inst-cmp"` with the quote, NOT the bare token: the stylesheet in <head>
      // carries `.v3-inst-cmp{…}`, so a bare match finds the head and every assertion below
      // then runs against CSS instead of the page.
      const pages = html.split('<div class="v3-page">');
      const p10html = pages.find((x) => x.includes('class="v3-inst-cmp"')) || '';
      assert(p10html.length > 0, 'v3: p10 page body located for the absence check');
      assert(!/shift/i.test(p10html), 'v3: p10 emits NO shift zone (D4 cut it from this page, not from p7)');
      assert(!/Leaning Into/i.test(p10html), 'v3: p10 emits no "Leaning Into the Other Instincts" block');

      // The Naranjo substitution: the display nickname appears nowhere on p10.
      assert(!/The Collector|The Community Benefactor|The Seeker/.test(p10html),
        'v3: p10 carries the Naranjo name, not the display nickname');
      assert(/class="v3-inst-name">Appetite</.test(p10html), 'v3: p10 renders the Naranjo name in the column head');

      // Z3 reads the v3-only field, and the FOCUSED ON row is gone.
      assert(/Governs our need/.test(p10html), 'v3: p10 Z3 renders instinct_definitions_v3, not the live v2 strings');
      assert(!/Focused On/i.test(p10html), 'v3: p10 has no FOCUSED ON label row');
      assert(!/Focused on safety, comfort/.test(p10html), 'v3: p10 does NOT render the live v2 instinct_definitions bodies');

      // Z6's label.
      assert(!/In Your Responses/i.test(p10html), 'v3: p10 does not use the old "In Your Responses" label');
    }

    // ── The NULL-dominant case is UNREACHABLE, and that is what is asserted ───────────
    //
    // p10 sources PRIMARY from dominant_instinct_hypothesis, which is a late-added nullable
    // column, so the obvious worry is a pre-migration row leaving the badge without a
    // source. Measured: it cannot happen, for two reasons in series.
    //
    //   1. A null dominant alone falls back to confirmed_instinct (report_prep.js), so the
    //      model still resolves a real instinct and p10 renders normally.
    //   2. With BOTH null, buildClientModel THROWS before any page is built — subtypeKey('')
    //      yields "subtype_9", which is not a library key.
    //
    // So there is no state in which p10 receives a model with no instinct, and designing a
    // rendering for one would be designing for the unreachable. This asserts the throw
    // instead: the day someone adds a fallback that makes it renderable, this goes red and
    // p10's missing case becomes a decision rather than a surprise.
    {
      const bothNull = JSON.parse(JSON.stringify(apiResult));
      bothNull.hypothesis.dominant_instinct_hypothesis = null;
      bothNull.hypothesis.confirmed_instinct = null;
      let threw = null;
      try { await prep.buildClientModel({ apiResult: bothNull, client: V3_CLIENT, coach }); }
      catch (e) { threw = e; }
      assert(threw != null,
        'v3: an assessment with no instinct at all must THROW in buildClientModel, not reach p10');

      // And a null dominant ALONE must still render, via the documented fallback.
      const domOnly = JSON.parse(JSON.stringify(apiResult));
      domOnly.hypothesis.dominant_instinct_hypothesis = null;
      const fallbackModel = await prep.buildClientModel({ apiResult: domOnly, client: V3_CLIENT, coach });
      assert(fallbackModel.display.instinct_code === 'SX',
        'v3: a null dominant_instinct_hypothesis falls back to confirmed_instinct');
      assert(/class="v3-inst-cmp"/.test(R.buildClientReportHTML_v3(fallbackModel)),
        'v3: p10 still renders when dominant_instinct_hypothesis is null');
    }

    // Tokens (brief v2.0 section 12.4). nickname/nickname_plural must exist and be applied:
    // the contents page prints "Development Ideas for Peacemakers", never the raw template.
    assert(model.display.nickname === 'Peacemaker', `v3: display.nickname = ${model.display.nickname} (expected Peacemaker)`);
    assert(model.display.nickname_plural === 'Peacemakers', `v3: display.nickname_plural = ${model.display.nickname_plural}`);
    assert(!/\{(type_word|subtype_label|nickname|nickname_plural)\}/.test(html), 'v3: no unresolved {token} placeholders in the rendered HTML');
    assert(html.includes('Development Ideas for Peacemakers'), 'v3: contents entry 08 renders the plural nickname');
    // PR 6 Build B1: every curly form a Mac types is straightened on a v3 page, the opening single
    // quote included — it was the one _v3Straighten missed. Driven through a real page, since the
    // function is private; the Thoughts prompts are an ordinary _v3t zone.
    {
      const mq = JSON.parse(JSON.stringify(model));
      mq.pages.v3_thoughts = { ...mq.pages.v3_thoughts, prompts: ['‘what is’ and “good enough”…', ...mq.pages.v3_thoughts.prompts.slice(1)] };
      const hq = R.buildClientReportHTML_v3(mq);
      assert(hq.includes('&#039;what is&#039; and &quot;good enough&quot;...') && !/[‘’“”…]/.test(hq),
        'v3: _v3t straightens ‘ ’ “ ” and … — no curly form reaches the page');
    }
    // PR 6: entry 08's descriptor no longer promises Courage / Agility / Resilience.
    assert(html.includes('Practical ways to put your new insights to work today.') && !/courage, agility/i.test(html),
      'v3: contents entry 08 carries the PR 6 descriptor, not the Courage / Agility / Resilience one');

    // The nickname rule (strip "The", add "s") must hold for all nine archetype names —
    // spec section 6 claims "all nine work", and PR 6 depends on it.
    const { TYPE_NAMES } = require(path.join(ROOT, 'app/type_meta.js'));
    const plurals = Object.values(TYPE_NAMES).map(n => n.replace(/^The\s+/, '') + 's');
    assert(plurals.every(p => /^[A-Z][a-z]+s$/.test(p)), `v3: plural rule holds for all nine names (${plurals.join(', ')})`);

    // ── SHEET 11's MODEL CONTRACT (PR 6 Build A) ───────────────────────────────────────
    //
    // Sheet 11 does not render yet — this locks the DATA its builder will read, for all nine
    // types. Re-typed the way scripts/render_client.js re-types: the scalars and the ranking
    // together, and the client's own quotes withheld from any type but the fixture's.
    {
      const libc = require(path.join(ROOT, 'app/content/content_library.json'));
      const retype = (n) => {
        const c = JSON.parse(JSON.stringify(apiResult));
        const h = c.hypothesis, real = apiResult.hypothesis.confirmed_type;
        h.confirmed_type = n; h.confirmed_type_name = null; h.leading_candidate = n;
        h.alternate_candidate = (n % 9) + 1;
        if (n !== real) c.client_words = {};
        const scores = h.call1_ranking.map(r => r.score).sort((a, b) => b - a);
        const rest = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(t => t !== n && t !== h.alternate_candidate);
        h.call1_ranking = [n, h.alternate_candidate, ...rest].map((type, i) => ({ type, score: scores[i] }));
        return c;
      };
      // THE CANONICAL NAMES, written out rather than derived: deriving them from TYPE_NAMES
      // would pass whatever TYPE_NAMES says. The four pre-canon names come from the p11 source
      // docs' own titles and headings, and must reach neither the model nor the page.
      const CANON_PLURAL = { 1: 'Improvers', 2: 'Givers', 3: 'Performers', 4: 'Individualists', 5: 'Observers',
        6: 'Questioners', 7: 'Enthusiasts', 8: 'Protectors', 9: 'Peacemakers' };
      const PRE_CANON = /\b(?:Achievers?|Investigators?|Loyal Skeptics?|Challengers?)\b/;
      const shared = new Set(), bad = [];
      for (let n = 1; n <= 9; n++) {
        const m = await prep.buildClientModel({ apiResult: retype(n), client: V3_CLIENT, coach });
        const page = R.buildClientReportHTML_v3(m);
        const d = m.pages.v3_devideas, src = libc[`type_${n}`].devideas_v3;
        if (!d) { bad.push(`type ${n}: v3_devideas is null`); continue; }
        const keys = d.sections.map(s => s.key).join(',');
        if (keys !== 'growth,inquiries,experiments') bad.push(`type ${n}: sections ${keys}`);
        const titles = d.sections.map(s => s.title).join(' | ');
        if (titles !== 'Growth Strategies | Inquiries | Field Experiments') bad.push(`type ${n}: titles ${titles}`);
        for (const s of d.sections) {
          if (JSON.stringify(s.items) !== JSON.stringify(src[s.key])) bad.push(`type ${n}: ${s.key} items differ from the library`);
          if (!s.items.length) bad.push(`type ${n}: ${s.key} is empty`);
        }
        if (!d.sections[2].items.every(e => Object.keys(e).join() === 'label,body' && e.label && e.body)) {
          bad.push(`type ${n}: an experiment is not { label, body }`);
        }
        // C4 at the model: everything that is not the three lists must be the same on every type.
        shared.add(JSON.stringify({ lead: d.lead, coda: d.coda, rails: d.sections.map(s => [s.title, s.desc]) }));
        if (!page.includes(`Development Ideas for ${CANON_PLURAL[n]}`)) bad.push(`type ${n}: page lacks "Development Ideas for ${CANON_PLURAL[n]}"`);
        if (m.display.nickname_plural !== CANON_PLURAL[n]) bad.push(`type ${n}: nickname_plural ${m.display.nickname_plural}`);
        const leak = (JSON.stringify(d) + page).match(PRE_CANON);
        if (leak) bad.push(`type ${n}: pre-canon name "${leak[0]}" reached the model or page`);
      }
      assert(bad.length === 0, `v3 sheet-11 contract: nine types, three sections each, library items, canonical plurals${bad.length ? ' — ' + bad.join('; ') : ''}`);
      assert(shared.size === 1, `v3 sheet-11 contract: lead, closing note, titles and rail descriptions identical on all nine types (${shared.size} variants)`);
      const rails = libc.static.devideas_rails_v3;
      assert(rails.growth === "Stretch beyond your type's habitual patterns to grow your range and expand your choices."
        && rails.inquiries === 'Use these prompts to reflect quietly on your own or go deeper by journaling your thoughts.'
        && rails.experiments === 'Try one or more of these practices in the real world and notice what happens.',
        'v3 sheet-11 contract: the three rail descriptions are the ratified text');

      // devIdeas() directly: no block means null, never an empty page; a blank CMS item is
      // dropped; a half-blank experiment is kept; and the library object is not mutated.
      assert(prep.devIdeas(undefined, libc.static) === null, 'v3 sheet-11 model: a type with no block resolves to null');
      const input = { growth: ['Keep', '  ', ''], inquiries: ['Ask?'],
        experiments: [{ label: '', body: ' ' }, { label: 'Try', body: 'This.' }, { label: '', body: 'Half.' }] };
      const before = JSON.stringify(input);
      const out = prep.devIdeas(input, libc.static);
      assert(JSON.stringify(out.sections[0].items) === '["Keep"]', 'v3 sheet-11 model: blank Growth items are dropped');
      assert(out.sections[2].items.length === 2 && out.sections[2].items[1].body === 'Half.',
        'v3 sheet-11 model: a fully blank experiment is dropped, a half-blank one is kept');
      assert(JSON.stringify(input) === before && out.sections[2].items[0] !== input.experiments[1],
        'v3 sheet-11 model: the input is not mutated and items are copies');
    }

    // NO subtype anywhere in chrome (brief v2.0 section 12.1, reversed 12 Aug 2026). Five
    // mockups print "· SX9" in the header and TOC_v2 prints it in the client strip; the
    // build deliberately departs from all six. Asserted so the next person to "restore
    // fidelity to the mockup" trips a test instead of shipping it.
    const headers = (html.match(/<span class="header-right">[\s\S]*?<\/span>\s*<\/div>/g) || []);
    assert(headers.length === withChrome.length,
      `v3: ${headers.length} page headers (expected ${withChrome.length}; the cover has none)`);
    const code = `${model.display.instinct_code}${model.hero.number}`;   // "SX9"
    assert(headers.every(h => !h.includes(code)), `v3: no page header carries the subtype code (${code})`);
    // NARROWED FROM DOCUMENT-WIDE TO CHROME AT PR 4 STEP 5A. Deliberately not deleted, and
    // the reasoning is written down because this guard exists to stop exactly the kind of
    // change I am making to it.
    //
    // It used to assert `!html.includes(code)` across the whole document. That was correct
    // while no page carried a subtype code, and it is now unsatisfiable for TWO independent
    // reasons, neither of which is a regression:
    //
    //   1. p10 identifies its three comparison columns as SP9 / SO9 / SX9 in their eyebrow,
    //      which is how the mockup itself distinguishes them. That is content — it tells
    //      the reader which column they are in — not chrome.
    //   2. THE COMMITTED NARRATIVES NAME THEIR OWN CODES. SX9's reads "…merging can lead
    //      the SX9 to struggle with boundaries…". That is Cai's prose, in the store since
    //      step 1, and no renderer change can or should alter it.
    //
    // Reason 2 alone makes the document-wide form impossible to satisfy, so keeping it would
    // mean deleting the check entirely. Instead it is scoped to what the comment above says
    // it protects: five mockups printing "· SX9" in the PAGE HEADER, and TOC_v2's CLIENT
    // STRIP. Both are still asserted — headers on the line above, the Contents strip here —
    // and the guard trips exactly as before for anyone restoring either.
    const tocChrome = (html.match(/<div class="v3-toc-(?:prep|lbl|name|sub)">[\s\S]*?<\/div>/g) || []).join('');
    assert(tocChrome.length > 0, 'v3: the Contents client strip was located for the subtype-code check');
    assert(!tocChrome.includes(code),
      `v3: the Contents client strip carries no subtype code (${code})`);
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
