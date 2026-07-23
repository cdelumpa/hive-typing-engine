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

  console.log('\n=== RESULT: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('\n[ERROR]', e.stack || e.message); process.exit(1); });
