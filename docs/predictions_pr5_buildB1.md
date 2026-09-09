# PR 5 · Build B1 — Predictions, committed BEFORE building

**Branch** `pr5-buildB1-panel-css`. **Base** `c03254a` (main, clean).
**Written** 9 Sep 2026, before any file was edited and before any browser was launched.
Every `§N` below names a section of `docs/audit_pr5_quickref.md` unless it says otherwise.

**Scope.** The panel stylesheet, the box measurement, and the tips restructure. **No page renders**
— no `_clv3QuickRef`, no `built` flag, no `PAGE_INVENTORY` bump.

## B1.0 — the stop condition, resolved before predicting

`node scripts/overrides_check.js` against the deploy target: **`published rows: 0`**, exit 0 — not
exit 2, so the database was genuinely read `[MEASURED]`. A direct count by status returns
**TABLE EMPTY** — no published rows and **no draft rows either**, and no row naming any `quickref`
key `[MEASURED]`. The stop condition does not fire and the reshape is unconditionally free.

Published-only would have been the narrower question: `assertOverrideShape` runs on
`status = 'published'`, but a *draft* against the old shape would have become invalid on publish and
surprised an editor later. Both are zero.

## B1.1 — the box

| # | Prediction | Value |
|---|---|---|
| 1.1 | **`.stxt` content width against the real stylesheet** | **308.00 px** |
| 1.2 | `.v3-page` outer / content | 816.00 / 710.00 px |
| 1.3 | `.two` content · computed gap | 710.00 px · 18 px |
| 1.4 | `.half` × 2, border-box / content | 346.00 / 344.00 px each |
| 1.5 | `.half` computed flex | `1` / `1` / `0%` |
| 1.6 | `.hbd` content · padding | 308.00 px · `16px 18px` |
| 1.7 | `font-size` / `line-height` | 12.5 px / 18.75 px |
| 1.8 | Arial probe | 2378.80859375 vs the 2378.81 constant |
| 1.9 | `m` / safe ceiling | **44 / 132**, unchanged — conditional on 1.1 |

**1.7 is a real prediction this time, not a tautology.** In Build 0 the rules were injected verbatim
so the values were fixed by the method. Here they are written into `clientReportV3PageStyles()` by
hand from a selector-matched lift, so a transcription slip is possible and the check is live.

## B1.2 — what could move the box, predicted before measuring

| candidate | prediction |
|---|---|
| namespace `.two/.half/.hbd/.stxt` → `.v3-qr-*` | **does not move it** |
| specificity vs the reset | **does not move it** — every rule at `.v3-page .v3-qr-*`, (0,2,0) vs (0,1,0) |
| the 18 px gap | **does not move it** — ported unchanged |
| the 1 px `.half` border | **does not move it** — ported unchanged |
| `.hbd` padding `16px 18px` | **does not move it** — ported unchanged |
| a fixed-width instincts half | **not introduced** — both halves stay `flex:1 1 0%` |
| inherited v3-shell rules the Build 0 scaffold lacked | **none** — the scaffold already rendered inside a real `.v3-page` in the real document |

**Every row predicts "no". If any says otherwise, that row is the finding.**

## B1.3 — the tips restructure

Reshaped to **array[4] of `{lead, body}`**, following `static.instinct_definitions_v3` — already an
array-of-object and already CMS-editable, so the shape has precedent `[MEASURED]`.

| # | Prediction | Value | Basis |
|---|---|---|---|
| 3.1 | New leaves from the reshape | **+4** | `[DERIVED]` 4 tips × 2 fields = 8, was 4 |
| 3.2 | Total leaves after | **2112** | 2108 + 4 |
| 3.3 | `INTERIM_*` leaves after | **796** | 792 + 4 |
| 3.4 | Word-canonical after | **1316**, unchanged | none of the new leaves come from Word |
| 3.5 | `SCRIPT_SOURCED`'s tips row count updates **automatically** | **yes** — `countLeaves` computes it; only the human LABEL "(4)" lies and must be hand-corrected | reading the function |

**Build A's stop-condition constants 792 / 1316 do not survive this build**, by design: 792 → **796**,
1316 holds. Predicted here so the change is expected rather than alarming.

## B1.4 — zone 8's −6px top margin

| # | Prediction | Value |
|---|---|---|
| 4.1 | Both variants fit the sheet | **yes** |
| 4.2 | Headroom difference between them | **exactly 6.00 px** |
| 4.3 | Which is chosen | **keep the −6px** — it is the ratified mockup's rhythm and headroom is not the binding constraint |

4.3 is a prediction about my own conclusion and is scored honestly: if the measurement says
otherwise it changes, and that is a finding.

## B1.5 — the collided record's second panel

| # | Prediction | Value |
|---|---|---|
| 5.1 | The `.pick` box constrains content length | **NO** — no fixed height, so a second panel of different length reflows without a variant rule |
| 5.2 | B1 therefore writes one stylesheet with no collision variant | **yes** |

## B1.6 — byte-identity

**It will break, and that is expected.** Adding rules to `clientReportV3PageStyles()` changes the
emitted `<style>` block on every v3 page.

| # | Prediction | Value |
|---|---|---|
| 6.1 | Renders differing from `c03254a` | **10 of 10** |
| 6.2 | The only diff is the added CSS block | **yes** — one contiguous insertion inside `<style>`, byte-identical across all 10 |
| 6.3 | Rendered content, geometry or layout moving on any existing page | **none** |
| 6.4 | The tips reshape contributes **zero** render diff | **yes** — tips render nowhere; `pages.v3_quickref` is read by no builder |
| 6.5 | How 6.2/6.3 are established | **by diff, not assertion** — the render diff is computed and its extent shown |

## B1.7 — files

| # | Prediction | Value |
|---|---|---|
| 7.1 | Files touched | **6** |
| 7.2 | Which | `scripts/build_content_library.js`, `app/content/content_library.json` (rebuilt, never hand-edited), `scripts/verify_content_library.js`, `app/renderer.js`, `docs/build_pr5_buildB1.md`, this file |
| 7.3 | `app/report_prep.js` touched | **NO** — `tips: stat.quickref_tips_v3 \|\| []` passes the new shape through unchanged |
| 7.4 | `app/server.js` touched | **NO** — CMS preview is B4 |
| 7.5 | `tests/lib/report_page_inventory.js` touched | **NO** — B2 |
| 7.6 | Mockup touched | **NO** — blob stays `813e871` |

## B1.8 — gates

Predicted from the baselines measured at `4a2f80e` in the audit's §29.8 — **and re-confirmed as the most recent
runs**: nothing has run since except this build's own work, and `c03254a` is a docs-only commit on
top of `4a2f80e`, so no gate's subject changed between them.

| gate | baseline | predicted | why |
|---|---|---|---|
| `npm test` | 0.23–0.39 s | **0.23–0.39 s** | a spread, not a point — the baseline showed 0.16 s of real variance |
| `npm run verify:render` | 52.48 s | **52.5 s** | same 32 renders; the CSS block is a few hundred bytes |
| `verify_diagrams.js` | 1.0–1.2 s | **1.0–1.2 s** | untouched |
| `verify_transparency.js` | 7.5 s | **7.5 s** | untouched subject, one more stylesheet to scan |
| `verify_coach_baseline.js` | 2.8 s | **2.8 s** | untouched |
| `verify_content_library.js` | 0.2 s | **0.2 s** | four more leaves |
| 8.1 | all six green | **yes** | |
| 8.2 | `verify_coach_baseline` applies | **No** — coach path untouched. Off-Linux it is a **HALF-RESULT**, not a pass. | |
| 8.3 | Spec §3.2: zero `transparent` / `rgba()` / `fill-opacity` / `stop-opacity` in the new CSS | **zero**, asserted in this commit rather than left to a downstream gate measured as thin | |

## Post-commit

This commit moves the head from `c03254a`. Every number above was fixed before it.
