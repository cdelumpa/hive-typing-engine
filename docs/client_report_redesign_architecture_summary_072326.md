# Hive Typing Engine — Client Report Redesign: Architectural Summary

_Companion to `client_report_test_coverage_audit_072326.md`. Written 2026-07-23._

## System context

The Hive Typing Engine is an Enneagram assessment engine. An AI pipeline (Call #1 → Call #2)
produces an `api_result`, which `report_prep` transforms into two view-models (coach + client).
A `renderer` turns each view-model into HTML → PDF. Both reports can be built fully offline from
committed fixtures (`tests/fixtures/{sp4,sx7}_api_result.json`) with no server, API key, or DB —
this offline path is the substrate for all regression testing.

We are redesigning the CLIENT report. Before touching design, we hardened the regression net.
Phase 1 is complete and merged to `main` (PR #66, merge commit `b43a80e`). Phases 2–3 are planned.

## The architectural problem Phase 1 addressed

The fixture runner reported "client report renders (0 pages)" on every run. This was an
observability defect, not a rendering defect — the client report renders 10 pages, each exactly
1056px (one US Letter sheet), zero spill.

Root cause was **contract drift between two independently-evolving components**:

- The structural verifier counted one hardcoded marker class, `report-page`.
- Only the COACH renderer emits `report-page` (×3). During a V2 port the CLIENT renderer moved
  to a different container vocabulary — `.cover` ×3, `.page` ×1, `.p3-page`…`.p8-page` ×6 (10
  containers) — and the counter was never updated. The client count was structurally always 0.

Two deeper architectural gaps sat underneath the symptom:

1. **Orphaned verification tooling.** Offline verifiers that already measured page layout and
   validated the view-models existed but were reachable from no npm script — capability with no
   surface. Structural/visual regression had no automated coverage; the only safety net was a
   production-time dry-validate probe on the live submit path.
2. **Identity encoded in position.** Client page containers (`p3-page`…`p8-page`) encode ordinal
   position in their class names. Reorder or insert a page and every name lies while the CSS
   keeps working — a redesign hazard.

## Phase 1 — done (promote + harden the offline net)

Framed architecturally rather than as a changelog:

- **Single source of truth for the page contract.** Extracted the per-kind page-container
  inventory and the class-counting logic into `tests/lib/report_page_inventory.js`. Both the
  live fixture runner and the new offline test import it, so the two can no longer drift — the
  exact failure mode that caused the original bug is now structurally prevented.
- **Shift-left of structural regression.** Added `tests/report_pages_test.js` to the free
  offline `npm test` suite. It unit-tests the class-token-boundary matcher (so `page` never
  matches `page-body`/`p3-page`, and `cover cover-welcome` counts once) and asserts the real
  rendered inventory from both fixtures. Structural regressions now surface on every commit
  instead of only in production.
- **Assertion strengthened from count to inventory.** Verify each expected container appears its
  expected number of times (coach 3; client cover×3, page×1, p3–p8×1), not just that a total is
  met. A total-only check passes if one page vanishes while another duplicates; the per-selector
  inventory catches the specific loss. Proven by fault injection.
- **Fail-closed verification.** The layout script (`render_client.js`) now covers the coach
  report too and exits non-zero on client page spill or wrong page count — previously it only
  printed spill and always passed. Promoted both offline verifiers under `npm run verify:render`
  (the ~15s Chrome-backed layout gate), kept out of the fast suite by design.
- **Drift pin.** The offline test asserts the client HTML emits zero legacy `report-page`, so
  nobody "repairs" the old 0-count by re-adding the wrong marker to the client report.

Deliberately unchanged in Phase 1: the ordinal `pN-page` class names (their replacement is the
Phase 2 redesign, not a Phase 1 fix).

## Phase 2 — planned (structural contract, part of the redesign itself)

- **Decouple page identity from position.** Replace ordinal containers (`p3-page`…) with
  semantic attributes — `data-report-page` + `data-section="welcome|primer|hypotheses|…"` —
  emitted by BOTH reports so they share one structural vocabulary.
- **Assert a section inventory, not a page count.** Check each expected `data-section` is present
  exactly once. This is what catches "the Strengths page disappeared" through a reorder or
  rename, which positional counting cannot. `report_page_inventory.js` is the natural place to
  evolve this contract.

## Phase 3 — planned (close blind spots before the redesign ships)

- **Confidence/branch coverage.** Both fixtures are CONFIRMED, high-confidence, no near-tie.
  REDIRECT / LOW-confidence / near-tie render branches are renderer-guarded and exercised in zero
  offline tests. Add a REDIRECT-shaped fixture so those branches render offline at least once.
- **Content-override coverage.** Published CMS overrides resolve against content-library
  structure (`<topKey>.<field>`), not page structure — so they survive a layout redesign but
  break if underlying content fields are renamed/restructured. Every offline tool renders with an
  empty override map, so override breakage is currently invisible. Settle this (a fixture
  carrying a small override map, or an explicit key inventory checked against post-redesign field
  names) before restructuring content fields.

## Open architectural judgment calls for the redesign

- **Asset strategy.** ~181KB of base64-embedded headshots are ~53% of the client payload.
  Harmless for email/PDF, wrong for a web-viewed report. Decide up front rather than inheriting
  it into new templates.
- **Content scale.** The client report carries ~3.6× the coach report's visible text. If length
  is in scope it is a content-model change — cheapest to make at the model layer, before
  templates are rebuilt.

## Guiding principles established

Single source of truth for cross-component contracts; identity decoupled from position; regression
detection shifted left into a free offline suite; verification that fails closed; and coverage
targeted at the structural/branch/override gaps that content-completeness checks already cover.
