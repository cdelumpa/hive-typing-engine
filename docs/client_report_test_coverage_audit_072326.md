# Client Report — Test Coverage Audit (2026-07-23)

Read-only audit run ahead of the client-report redesign. No code changed.

## Why this exists

The live fixture runner prints `✓ client report renders (0 pages)` on every fixture. That
looked like a failing artifact. It is not — the client report renders **10 pages, every one
exactly 1056px (one US Letter sheet), zero spill**. The `0` is a broken counter in the test.

## Root cause of the `0 pages` report

`tests/run_test.js:368` counts one hardcoded marker:

```js
const pageCount = (r.html.match(/class="report-page/g) || []).length;
```

Only the **coach** renderer emits `class="report-page"` (3 of them). The **client** renderer
uses `.cover` ×3 (Title / TOC / Welcome), `.page` ×1 (P2 Primer), and `.p3-page` … `.p8-page`
(P3–P8) — 10 containers, none matching the regex. So the client count is structurally
always `0`.

This is drift, not design. The client renderer used to emit `report-page`; commit `3107026`
("cleanup: remove dead legacy client renderer code") removed that markup during the V2 port,
and the counter — added separately in `54c6a4f` — was never updated.

Red herring: the client HTML contains 8 `cv-entry-page` occurrences. Those are table-of-contents
page *numbers* (`renderer.js:1595`), not page containers.

## The tooling already exists and already knows this

`scripts/render_client.js` renders both fixtures offline (no API key, no DB), measures every
page, and flags spill. Its comment at line 34 states the correct selectors explicitly and notes
"the legacy `.report-page` selector no longer matches any client page." It runs today in ~15s.

`scripts/verify_phase4_prep.js` feeds the same fixtures through `report_prep` and asserts both
view-models fully populate.

**Neither is reachable from any npm script.** `app/package.json` has only `start`, `test`,
`test:fixtures`. Both verifiers are Phase-4/Phase-6 era tools that were never promoted.

## Baseline (captured 2026-07-23, pre-redesign)

Rendered offline from `tests/fixtures/sp4_api_result.json`:

| | Coach | Client |
|---|---|---|
| HTML size | 68,261 chars | 464,432 chars |
| Visible text | 14,559 chars | 52,953 chars |
| Page containers | 3 (`report-page`) | 10 (`cover`×3, `page`×1, `p3`–`p8`) |
| Per-page height | — | all exactly 1056px, no spill |
| PDF | — | ~1.2 MB, 10 sheets |

Client payload composition: **53% two base64 PNG headshots** (~90KB each, welcome-page
signature block), 31% inline SVG, 6.6% CSS, 11% actual content. The coach report embeds
zero images.

## Coverage map

| Layer | Exists | In `npm test`? |
|---|---|---|
| Model contract | `validateModel(model, CLIENT_SPEC)` — 30 required paths, 6 non-empty arrays, throws | ✗ (only via render) |
| Model population | `scripts/verify_phase4_prep.js` (offline) | ✗ orphaned |
| Client layout | `scripts/render_client.js` (offline) | ✗ orphaned |
| Client structure | `run_test.js` page count | ✗ broken — always 0 |
| Coach layout | nothing offline | — |
| Render smoke | dry-validate probe, `server.js:5391` | production only |

The model contract is stronger than the `0 pages` symptom suggests: `validateModel` throws on
missing fields, and `/api/submit` deliberately renders both reports as a dry-validate probe —
added because a renderer-level type mismatch shipped a broken PDF for #45 (`server.js:5387`).
The real gap is **structural/visual regression**, not content completeness.

## Risks specific to the redesign

1. **Ordinal class names.** `p3-page` … `p8-page` encode position in identity. Reorder or insert
   a page and every name lies while the CSS keeps working. `render_client.js`'s selector list
   *and* its hardcoded `labels` array both assume this exact sequence.
2. **Content overrides key off content-library structure, not page structure.**
   `resolveLibObject` resolves `"<topKey>.<field>"` — `type_9.wings`, `static.welcome`
   (`content_overrides.js:85`). Published CMS overrides survive a layout redesign but break if
   underlying content fields are renamed or restructured. Every offline tool renders with an
   empty override map, so override breakage is invisible in testing.
3. **Two fixtures, both CONFIRMED.** `sp4` (Type 4/SP) and `sx7` (Type 7/SX). No REDIRECT, no
   LOW confidence, no near-tie. The confidence box and near-tie callout are `optional` in
   `COACH_SPEC` and renderer-guarded, so those branches render in zero offline tests.

## Agreed approach

**Phase 1 — promote the existing tools (do before designing; no redesign dependency)**

1. Fix `run_test.js:368` to count per report kind; assert `pageCount >= expected`
   (coach 3, client 10) instead of only `html.length > 0`.
2. Add `npm run verify:render` wiring `verify_phase4_prep.js` + `render_client.js`, extended to
   cover the coach report. Offline, free, ~15s.
3. Make both scripts exit non-zero on failure — `render_client.js` currently only *prints* spill.

**Phase 2 — structural contract (part of the redesign, not a follow-up)**

4. Replace ordinal containers with `data-report-page` + semantic
   `data-section="welcome|primer|hypotheses|…"`, emitted by both reports.
5. Assert the **section inventory** (each expected `data-section` present exactly once), not
   just a page count — that is what catches "the strengths page vanished."

**Phase 3 — close blind spots (before the redesign ships)**

6. Save a REDIRECT/LOW-confidence `api_result` fixture (`redirect69` is the right shape) so the
   near-tie and confidence-box branches render offline at least once.
7. Settle the override story before restructuring content fields: either a fixture carrying a
   small published-override map, or an explicit inventory of override keys checked against
   post-redesign field names.

## Open judgment calls for the redesign

- **181KB of embedded headshots.** Harmless for email/PDF, not for a web-viewed report. Settle
  as an asset-strategy decision up front rather than inheriting it into new templates.
- **Scale.** The client report carries 3.6× the coach report's visible text. If length is in
  scope, decide before templates are rebuilt — it is a content-model change, and the model is
  where it is cheap.

## How to re-run the audit

```bash
cd ~/Developer/hive-typing-engine && node scripts/render_client.js   # offline, ~15s, writes .phase6_out/ (gitignored)
cd ~/Developer/hive-typing-engine && node scripts/verify_phase4_prep.js
```

Neither needs a server, an API key, or a database.
