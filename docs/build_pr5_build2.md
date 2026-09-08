# PR 5 Build 2 — the Quick Reference diagram

Branch `pr5-build2-diagram`, continued from `7a7f2bd`, off `main @ b394a06` `[MEASURED]`.
Scope and the eleven assertions from `docs/plan_pr5_build2.md` §6.

---

## 1. §1.1 — coach-side callers. **YES. The coach byte-diff is load-bearing this build.**

`[MEASURED]` Every `buildEnneagramSVG` call site, resolved to its enclosing function:

| Call | Enclosing function | Side |
|---|---|---|
| **`renderer.js:1590`** | **`_coachPage1` (`:1522`)** | **COACH** |
| `:1816`, `:2017`, `:2086`, `:2205` | `_clTitle`, `_clP2Primer`, `_clP3Hypotheses`, `_clP5WingsLines` | client v2 |
| `:3327`, `:3429`, `:3491`, `:3617`, `:3778` | `_clv3Cover`, `_clv3WhatIs`, `_clv3Wings`, `_clv3TypeA`, `_clv3Lines` | client v3 |

**The coach report renders a diagram.** Its model carries `svg: { variant: 'type', type: heroN }`
(`report_prep.js:194`), verified by building the coach model for `sp4`: `{"variant":"type","type":4}`.

**What this means for which gate carries the guarantee** `[JUDGMENT]`:

* In Build 1 the coach byte-diff was **structurally blind** — nothing it renders touched the change.
  **Here it is not.** Any change to `buildEnneagramSVG` that alters the `type` variant changes the
  coach report.
* **B11 is the proof and it is the broader one**: 9 variants × 9 types byte-identical, runnable
  locally and completely. The coach byte-diff is **narrower** — it exercises the `type` variant at
  two types only (`sp4`, `sx7`).
* **The coach byte-diff is independent, and its PDF half is the only thing that can catch a
  rendering-level change that leaves markup identical.** That half **skips on this machine**. So the
  local result is a half result on the gate that matters most this build, and CI is where it is
  settled.

---

## 2. Predictions, committed before the primitive was touched

Each labelled. **Widening a gate re-opens its prediction in the same commit.**

### 2.1 The signature widening

| # | Prediction | Label |
|---|---|---|
| C1 | **B11: 81 renders (9 variants × 9 types) byte-identical before and after.** | `[ESTIMATED]`, premise `[MEASURED]`: the widening adds optional destructured keys, and no existing branch reads them |
| C2 | Coach byte-diff: **HTML half PASSES, PDF half SKIPS** locally | `[MEASURED]` — every local run of Build 1 skipped it |
| C3 | Coach HTML byte-identical for `sp4` and `sx7` | `[ESTIMATED]` from C1 |

### 2.2 The gates

| # | Prediction | Label |
|---|---|---|
| C4 | **B3 red first: `nodeCircles` yields `0` of 12 for quickref**, then `9` after the fix | `0` is `[MEASURED]`; `9` is `[ESTIMATED]` |
| C5 | **B2: minimum edge clearance ≥ 5 across all 72 ring configurations**, in **viewBox units** — the unit `verify_diagrams.js` already enforces | `[ESTIMATED]` |
| C6 | **B7 standalone scan: quickref 0 groups / 0 masks / 0 alpha<1.** Red control — the tracked mockup SVG — **1 / 1 / 8** | control `[MEASURED]`; quickref `[ESTIMATED]` |
| C7 | **B8: no `#F68625` in `client-quickref`. `client-cover` still contains it** and must not be flagged | cover `[MEASURED]`; quickref `[ESTIMATED]` |

### 2.3 The ramp — arithmetic, so these are exact

`[MEASURED]` (arithmetic on the decided formula, not a guess). `t = 0.10 + 0.90 × score/100`, and the
opaque fill is white lerped toward `#00B2D9` (0, 178, 217) at `t`:

| Score | `t` | Predicted opaque fill |
|---|---|---|
| 91 (anders max) | 0.919 | **`#15B8DC`** |
| 31 (anders min) | 0.379 | **`#9EE2F1`** |
| 100 | 1.000 | **`#00B2D9`** — the token exactly |
| 0 | 0.100 | **`#E6F7FB`** |

**A deviation in any of these four is a finding**, not a rounding note.

### 2.4 Scope and timings

| # | Prediction | Label |
|---|---|---|
| C8 | Page count stays **10**; `V3_PAGE_ORDER`, `report_page_inventory.js`, `content_library.json`, any docx **untouched** | `[MEASURED]` intent |
| C9 | `verify_diagrams.js` grows from **0.93s** to **1.5–3.0s** (72 configs + 9 types × the new checks) | baseline `[MEASURED]`; range `[ESTIMATED]` |
| C10 | Other five gates within ±0.2s of their Build 1 actuals (`npm test` 0.25s, `verify:render` 52.39s, `verify_transparency` 2.88s, `verify_coach_baseline` 2.87s, `verify_content_library` 0.22s) | baselines `[MEASURED]`; ranges `[ESTIMATED]` |

### 2.5 One measurement that is not a prediction

`[MEASURED]` **`verify_diagrams.js` enforces its 5px rule in viewBox units, not rendered pixels.**
`getBBox()` returns user units, and `MIN_EDGE_CLEARANCE = 5` is compared to them directly. On
wings/lines the viewBox is 430×252 rendered at 378×222 — scale **0.879** — so the shipped
"minimum edge clearance 5.47px" is **4.81px on the page**. Not a defect and not this build's to
change; recorded because Build 2 adds a variant at a different scale (0.894) and the two figures
must not later be compared as if they were the same unit.
