# PR 5 · Build R — Predictions, committed BEFORE building

**Branch** `pr5-buildR-alt-ring-position`. **Base** `12a0f41` (main, clean).
**Written** 9 Sep 2026, before any file was edited. Every `§N` names a section of
`docs/audit_pr5_quickref.md` unless said otherwise.

**Scope.** The ALTERNATE ring reads position 2 instead of `alternate.number`. **No page is
involved** — `_clv3QuickRef` does not exist, `quickref` carries no `built` flag, and neither is
touched here.

## R0 — the thing the sweep cannot tell us, stated before it runs

Both implementations agree on **all 72 ring pairs by construction**: `verify_diagrams`'s
`orderFor(lead, alt)` does `put(lead); put(alt)`, so position 2 **is** the alternate in every pair
it builds. **72/72 byte-identity is therefore a regression check, not evidence the change is
correct** — a wrong implementation of "read position 2" would produce the same 72. The only render
that distinguishes the two implementations is the collided one, which is why the gate assertion
covering it has to be inverted rather than widened.

## R1 — the sequence

| # | Prediction | Value |
|---|---|---|
| 1.1 | Inverting the collided assertion **before** the code change makes the gate go **RED** | **yes** |
| 1.2 | It fails on the **ring count** first — `1 ring drawn, expected 2` | the current code draws one ring on a collided record, so the inverted count assertion is the first to trip |
| 1.3 | Number of distinct failures from the inverted block, pre-change | **3** — rings, dashed stroke, and the missing ALTERNATE label |
| 1.4 | After the one-line change, the inverted block goes **green** | **yes** |
| 1.5 | Lines changed in `app/renderer.js`, excluding comments | **1** |

## R2 — the 72 pairs

| # | Prediction | Value |
|---|---|---|
| 2.1 | Ring pairs byte-identical to `12a0f41` | **72 of 72** |
| 2.2 | Pairs differing | **0** |
| 2.3 | What that proves | **only that nothing else moved.** See R0. |

## R3 — the 10 v3 document renders

The quickref variant is called by **no page** — `[MEASURED]` at `12a0f41`, the only callers of
`client-quickref` in the repo are `scripts/verify_diagrams.js` and `scripts/verify_transparency.js`.

| # | Prediction | Value |
|---|---|---|
| 3.1 | v3 renders differing from `12a0f41` | **0 of 10 — byte-identical** |
| 3.2 | Why | the figure this build changes is emitted by nothing the document builds; sheet 5 has no builder |
| 3.3 | Established by | **diff, not assertion** |

Contrast with B1, where 10 of 10 differed: that build changed the shared stylesheet, which every
page emits. This build changes a function no page calls.

## R4 — the fixture correction

| # | Prediction | Value |
|---|---|---|
| 4.1 | The collided block's score vector today | `SWEEP_SCORES`, which is `orderFor(9, 5)` — a **non-collided** vector, while the rings say `9 × 9` |
| 4.2 | Position 2 under `orderFor(9, 5)` vs `orderFor(9, 9)` | **both give type 5** `[MEASURED]` — which is why the defect survived |
| 4.3 | Correcting it changes the assertion outcome | **no** — it makes the fixture honest, not different |

## R5 — the coach path

| # | Prediction | Value |
|---|---|---|
| 5.1 | `_coachPage1` calls `buildEnneagramSVG` | **yes**, `renderer.js:1799`, as `buildEnneagramSVG(m.svg)` |
| 5.2 | That call reaches the line being changed | **NO** — the coach model sets `svg: { variant: 'type', type: heroN }` (`report_prep.js:228`), and `variant: 'type'` never enters the `client-quickref` branch |
| 5.3 | `verify_coach_baseline.js` applies | **No.** Run anyway off-Linux it is a **HALF-RESULT**, not a pass. |

## R6 — files

| # | Prediction | Value |
|---|---|---|
| 6.1 | Files touched | **9** |
| 6.2 | Which | `app/renderer.js`, `scripts/verify_diagrams.js`, `docs/build_pr5_buildR.md`, this file, and **5** smoke-sheet PNGs under `docs/` |
| 6.3 | `app/report_prep.js` touched | **NO** — position already reaches the figure via `charts.types` |
| 6.4 | `app/content/content_library.json`, `app/server.js`, the inventory, the mockup | **all untouched** |
| 6.5 | `built` flag set or `PAGE_INVENTORY` bumped | **NO** |

## R7 — gates

Baselines are the ones measured **on the B1 branch**, which is the tree `12a0f41` carries — B1 is
merged and `12a0f41` adds only docs on top of it, so no gate's subject has changed since. **Those are
the most recent runs**; the audit's §29.8 figures predate B1's stylesheet and must not be used.

| gate | baseline (post-B1) | predicted | why |
|---|---|---|---|
| `npm test` | 0.23 / 0.41 s | **0.23–0.45 s** | a spread; the baseline showed 0.18 s of real variance across two samples |
| `npm run verify:render` | 52.84 s | **52.5–53.5 s** | untouched subject |
| `verify_diagrams.js` | 1.22 s | **1.2–1.4 s** | the collided block gains a sweep over several leading types |
| `verify_transparency.js` | 7.55 s | **7.5–7.7 s** | it renders the quickref variant; one more dashed ring per collided render |
| `verify_coach_baseline.js` | 2.85 s | **2.8–2.9 s** | untouched |
| `verify_content_library.js` | 0.22 s | **0.2 s** | untouched |
| 7.1 | all six green **after** the change | **yes** |
| 7.2 | leaves / INTERIM / Word-canonical | **2112 / 796 / 1316**, unmoved — no content changes |

## Post-commit

This commit moves the head from `12a0f41`. Every number above was fixed before it.
