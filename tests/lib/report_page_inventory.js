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
