'use strict';

/**
 * report_page_inventory.js — the per-kind page-container contract, shared by the
 * live fixture runner (tests/run_test.js) and the offline structural test
 * (tests/report_pages_test.js) so the two can never drift.
 *
 * Drift history (see docs/client_report_test_coverage_audit_072326.md): the COACH
 * renderer emits class="report-page" ×3. The CLIENT renderer emits .cover ×3
 * (Title / TOC / Welcome), .page ×1 (P2 primer), and .p3-page … .p8-page ×1 each
 * (P3–P8) = 10 containers — none matching "report-page". The old counter matched
 * only "report-page", so the client count was structurally always 0.
 *
 * Asserting the per-selector breakdown (PAGE_INVENTORY), not just the total, is
 * what catches a *specific* dropped page — e.g. p7-page (Strengths) vanishing
 * while a duplicated cover keeps the total at 10.
 */

// Exact number of each page-container class each report kind must emit.
const PAGE_INVENTORY = {
  coach:  { 'report-page': 3 },
  client: { cover: 3, page: 1, 'p3-page': 1, 'p4-page': 1, 'p5-page': 1, 'p6-page': 1, 'p7-page': 1, 'p8-page': 1 },
  // Client report v3, built beside the live report and not wired into production until
  // cutover. One container class for every page, so the count IS the page count. PR 1 built
  // 1 (Wings); PR 2 took it to 6; PR 3-Lines takes it to 7 (cover, contents, welcome,
  // what-is, wings, LINES, thoughts). Raise this as each page PR lands; it reaches 12 at
  // cutover.
  //
  // ⚠️ THIS LITERAL IS DELIBERATELY NOT DERIVED FROM V3_PAGE_ORDER, and it is the only v3
  // page count that is not. report_pages_test.js derives the built key list, the footer
  // count and the header count from that constant's `built` flags, which is right — those
  // three were restating it by hand and drifted. But if EVERY assertion derives from the
  // same constant the renderer itself reads, a wrong V3_PAGE_ORDER passes silently and the
  // suite becomes a tautology: mark a page `built` that the renderer never emits and all
  // three derived checks agree with each other about the wrong number.
  //
  // This number is the tripwire. It is maintained by hand, by whoever lands the page, and
  // it fails when the constant is wrong rather than when it is inconsistent with itself.
  // Do not "tidy" it into a derivation.
  //
  // TYPE-AWARE as of PR 3-Explore. Sheets 6-7 are pilot-scoped to type 9, so type 9 emits
  // NINE pages and every other type seven. A single number can no longer express the
  // document, and pretending otherwise would either fail the pilot type or stop noticing a
  // missing page on the other eight. Both entries stay hand-maintained for the reason above.
  client_v3: { 'v3-page': 7 },          // types 1-8 — sheets 6-7 not authored yet
  client_v3_pilot: { 'v3-page': 9 },    // type 9 — the two Exploring sheets included
};

// Expected total page containers per kind, derived from PAGE_INVENTORY (coach 3, client 10).
const EXPECTED_PAGES = Object.fromEntries(
  Object.entries(PAGE_INVENTORY).map(([kind, inv]) => [kind, Object.values(inv).reduce((a, b) => a + b, 0)]),
);

// Count elements whose class attribute carries `token` as a whole space-delimited
// word, so `page` does not match `page-body`/`pageNumber`/`p3-page`, and `cover`
// matches both `class="cover"` and `class="cover cover-welcome"` (one element each).
function countByClass(html, token) {
  const t = String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (String(html).match(new RegExp(`class="(?:[^"]*\\s)?${t}(?:\\s[^"]*)?"`, 'g')) || []).length;
}

// Total page containers of `kind` found in `html`.
function countPages(html, kind) {
  return Object.keys(PAGE_INVENTORY[kind] || {}).reduce((n, sel) => n + countByClass(html, sel), 0);
}

// Per-selector breakdown { selector: foundCount } for `kind`, over the expected selectors.
function pageBreakdown(html, kind) {
  return Object.fromEntries(Object.keys(PAGE_INVENTORY[kind] || {}).map(sel => [sel, countByClass(html, sel)]));
}

module.exports = { PAGE_INVENTORY, EXPECTED_PAGES, countByClass, countPages, pageBreakdown };
