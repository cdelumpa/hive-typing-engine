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

---

## 3. The build report

### 3.1 The eleven assertions

| # | Assertion | Result | Red-proof, on failure text |
|---|---|---|---|
| **B1** | IO-75 Wings band baseline, recorded **first** | **10.3869%** (18,816 / 181,152 px of the band), green at 0.0000pp | `CLIENT_GEO.rHome` 15 → 16 moves it to 10.6568% (+0.2699pp) and the gate names the figure and the delta |
| **B2** | edge clearance ≥ 5, all 72 ring configurations | **minimum 8.35** (`QUICKREF 1x2 "LEADING"`) | rail raised 12px → `clearance -3.65px < 5px` |
| **B3** | node filter yields 9, **red first** | red at **0**, green at **9** | geometry withheld → `0 circles sit at canonical node positions`; nodes drawn 3px off centre → same |
| **B4** | label → node clearance, all 72 | 0 overlaps | covered by B2's rail proof and B3's non-vacuity |
| **B5** | no label/label overlap, all 72 | 0 overlaps | same-rail nudge disabled → `labels "LEADING" and "ALTERNATE" overlap` |
| **B6** | no banned opacity construct in the emitted string | 0 across 72 | `fill-opacity` restored → `banned opacity construct "fill-opacity"` |
| **B7** | **standalone** PDF scan: 0 groups / masks / alphas | 0 / 0 / 0 on 9×5, 1×2, 4×8 | **the tracked mockup SVG → 1 / 1 / 8**, a real artifact |
| **B8** | no `#F68625` in `client-quickref` (**per-variant**) | 0 across 72; `client-cover` keeps its orange untouched | `RAMP_BASE` set to the orange → `#F68625 inside the heat map` |
| **B9** | fills follow `0.10 + 0.90 × score/100` as opaque solids | **all four predictions exact** — 91→`#15B8DC`, 31→`#9EE2F1`, 100→`#00B2D9`, 0→`#E6F7FB` | B6/B7 cover the "opaque" half |
| **B10** | two score vectors differ **only** in fills | differs in fills only ✓ | label `x` made to read a score → `differ OUTSIDE fill` |
| **B11** | nine pre-existing variants byte-identical | **81 / 81 byte-identical** | — (it is the proof, not a gate) |

### 3.2 Predictions against actuals

| # | Predicted | Actual | |
|---|---|---|---|
| C1 | B11: 81 renders byte-identical | 81/81 | **HELD** |
| C2 | Coach: HTML passes, **PDF skips** locally | `ALL PASSED — HTML only (PDF half skipped off-Linux)` | **HELD** |
| C3 | Coach HTML byte-identical, `sp4` + `sx7` | byte-identical | **HELD** |
| C4 | B3 red at **0**, green at **9** | 0 → 9 | **HELD** |
| C5 | B2 ≥ 5 across 72, viewBox units | minimum **8.35** | **HELD** |
| C6 | B7 quickref 0/0/0; control 1/1/8 | 0/0/0; 1/1/8 | **HELD** |
| C7 | B8 clean; `client-cover` keeps `#F68625` | both | **HELD** |
| — | **ramp: 4 exact hex values** | all four exact | **HELD** |
| C8 | page count 10; four forbidden paths untouched | 10; 0 hits each; `V3_PAGE_ORDER` constant unedited | **HELD** |
| **C9** | `verify_diagrams` **1.5–3.0s** | **1.10s** | **DEVIATED — under the floor** |
| **C10** | five gates within ±0.2s | **`verify_transparency` 2.88s → 7.48s** | **DEVIATED — and it is a rule violation** |

### 3.3 The two deviations

**C9 — `verify_diagrams` at 1.10s against a 1.5–3.0s floor.** `[JUDGMENT]` I estimated that 72
configurations would cost more than they do. Each is a `setContent` plus an `evaluate` on an
already-open page — no navigation, no PDF — so the marginal cost per configuration is small. The
estimate had no measured basis and said so; this is what that looks like when it lands low rather
than high.

**C10 — `verify_transparency` at 7.48s against a ±0.2s band. This one is a rule violation, not a
bad estimate.** I added four standalone PDF renders to that gate (three quickref configurations
plus the mockup control) and **did not re-open C10 in the same commit**. Each render is ~1.1s, so
the +4.6s is fully attributed and nothing is unexplained — but the prediction was written against
the un-widened gate and I widened it afterwards.

`[JUDGMENT]` **This is Build 1's P5 again, in a different gate.** The standing rule exists because
of it, and it did not fire. The failure mode is specific: the widening was *planned* (the plan doc
names `verify_transparency.js` as a Build 2 file) but the *timing* prediction was written from the
Build 1 baseline as though the file were untouched. **A prediction table needs re-reading against
the file list before it is committed, not only after a gate grows.**

### 3.4 The coach byte-diff — which half

**HTML half PASSED. PDF half SKIPPED** (`ALL PASSED — HTML only (PDF half skipped off-Linux)`).

**This is the load-bearing half this build and I do not have it.** `_coachPage1` calls
`buildEnneagramSVG` (§1), so unlike Build 1 the coach report is downstream of the change. B11 covers
markup completely — 81/81 byte-identical, broader than the coach gate's two fixtures — but only the
PDF hash catches a rendering-level change that leaves markup identical. **CI is where this is
settled.**

### 3.5 §4.1 — where "two rings on one node" landed

**In the diagram, as a refusal.** `buildEnneagramSVG` throws when `leading === alternate`:

> `client-quickref leading and alternate are both type 9 — the two rings would collide; the caller must resolve this before rendering`

`[JUDGMENT]` **Not the gate, and not step 6.** A gate would catch it in CI, after someone had already
written the calling code; refusing in the builder means the defect cannot be rendered at all. And it
belongs to the diagram rather than the page because the diagram is what knows a dashed ring stacked
on a solid one is meaningless — step 6 would only know it as two equal numbers.

### 3.6 §4.2 — `client-cover`: **LATENT, not live**

`[MEASURED]` Read in the file rather than inferred. The `r <= 20` filter sat inside
`for (const variant of VARIANTS)`, and `VARIANTS` was `['client-wings', 'client-lines']`.
`client-cover` appeared only in the structural block, which runs **no** overlap or clearance test.
So the vacuum was never exercised on it.

**It is not a seventh vacuous gate and needs no card** — the position-based node matching in commit
3/6 removes the latency outright, because nothing selects on radius any more.

### 3.7 What carries the guarantee

* **The node filter** — a mechanism was *replaced*, so this matters. The guarantee is "the
  label-vs-node check tests something", and it is carried by **the count assertion**, not by the
  matching being written correctly. If the matching breaks, the count goes to 0 and the run says so
  by name.
* **The signature widening** — nothing displaced; the guarantee that it is inert is carried by
  **B11**, and independently by the coach byte-diff's PDF half in CI.
* **Label placement** — the guarantee is "no label clips an edge or a node in any of the 72
  configurations", carried by **B2/B4/B5 sweeping all 72**, not by the rail rule being right. Two
  rules were measured failing before this one; the sweep is what found them.
* **`client-explore`** — nothing replaced. The guarantee is that the last ungated v3 wheel now has
  the structural assertion, and it is carried by the check itself.

### 3.8 Scope

**Touched:** `app/renderer.js`, `scripts/verify_diagrams.js`, `scripts/verify_transparency.js`,
`scripts/verify_wings_pixel.js` (new), `scripts/check_docs.py`, and three `.md`.

**Untouched, as scoped:** `V3_PAGE_ORDER` (0 edits to the constant, verified on the diff rather than
by file), `tests/lib/report_page_inventory.js` (still `{ 'v3-page': 10 }`),
`app/content/content_library.json`, any `.docx`. Also untouched: `app/report_prep.js`,
`scripts/render_client.js`, `app/server.js`, `tests/`.

**No page is built.** `quickref` still has no `built: true`; the page count is still 10.

⚠ **PR 5 is adding a Wings regression gate** (`scripts/verify_wings_pixel.js`) for a page PR 5 does
not build. Named here and in the file's own header rather than left to be discovered.

---

## 4. The visual smoke test — and what only looking found

Contact sheet: `.phase6_out/quickref_contact_sheet.png` — the shipped variant beside the tracked
mockup, then 12 of the 72 ring configurations, plus a flat profile and a tied-at-100 profile.
Regenerated from `client-quickref` on this branch.

Design spec v3.0 §3.5 requires this rather than treating it as optional: *"Do not derive label
positions from a formula without rendering… the automation replaces the arithmetic, not the
looking."* It found two things.

### 4.1 A defect the gate could not see — eight pairs read as one word `[MEASURED]`

On the first sheet, `1 × 2` rendered its two labels as **`LEADINGALTERNATE`**. Measured across all
72: **32 pairs share a rail, and 8 of them sat at a 2.49–2.79px gap.** The label-vs-label check
passed every one of them, correctly — **2.5px is not an overlap.** Non-overlap and legibility are
different requirements, and the first does not imply the second.

Two causes, both fixed:

* **The advance-width estimate was 7% low.** `wide()` used `length × 6.1`; measured, LEADING
  renders **45.24px over 7 characters** and ALTERNATE **59.20px over 9** — about **6.6** each. The
  shortfall ate the separation margin.
* **The margin itself was 6px**, which is a non-overlap allowance, not a legibility one. Now
  **`LBL_SEP = 14`**.

**Result: minimum same-rail gap 2.49px → 14.59px.** Pairs under 12px: **8 → 0**.

**A new assertion, `MIN_LABEL_SEP = 12`, and per the standing rule it re-opens its own prediction
in the same commit** — predicted minimum same-rail gap **≥ 12px across all 72** `[ESTIMATED]`,
actual **14.59px** `[MEASURED]`, held. Red-proven: restoring `LBL_SEP = 6` fails **8 pairs** with
*"share a rail with only 6.59px between them (min 12) — they read as one word"*.

### 4.2 A defect in the smoke test's own data `[MEASURED]`

The first sheet drew **node 9 ringed LEADING but palest on the ramp**. The renderer was right; my
contact sheet was wrong. It built scores as
`[91, 83, 74, …].map((score, i) => ({ type: i + 1, score }))` — the **sorted** list indexed by
position, so type 1 got 91 and type 9 got 31, while the fixture's real mapping is
**T9:91 T5:83 T1:74 T8:52 T3:47 T2:44 T7:38 T4:35 T6:31**.

**`SWEEP_SCORES` in `verify_diagrams.js` carried the same shape**, and its comment claimed "the
tracked anders_sx9 call1_ranking values" — true of the multiset, false of the mapping. Corrected to
the real type mapping, and the comment now says why it matters.

`[JUDGMENT]` Nothing could have failed on this: geometry does not depend on scores, which B10
asserts. It is a **readability defect in the evidence**, and it is the same class as Build 1's
harness finding — a sweep producing data that contradicts the page it draws.

### 4.3 One design note for Cai and Mo, not a defect

The rail places a label at the wheel's **outer radius**, so for the mockup's own case the ALTERNATE
label sits slightly further below node 5 than the mockup draws it. That is the cost of a rule that
holds for all 72 rather than for the one pair the mockup contains — and for mid-height nodes
(3, 6, 7) the label is ~90px from its node, associated by horizontal position alone. It reads
correctly on the sheet, but it is a design choice worth seeing rather than inheriting.

---

## 5. Pre-merge trace — the sweep's tiles are not evidence of reachability

Read-only question, answered against the code. It found one thing, fixed below.

### 5.1 What the sweep is `[MEASURED]`

**Ring positions varied against a fixed score profile, and nothing more.** The generator says so:
`RING_PAIRS` is every `leading × alternate` pair, and its comment reads *"Scores are NOT swept
here: they change fills only."* There is no reachability claim anywhere in it. **Cai is right, and
reading a reachability claim off a parameter sweep was my error** — the combinations present in a
sweep are a property of the loop, not of the data.

### 5.2 Is the combination reachable? **Yes — but not the tile-6×3 shape** `[MEASURED]`

Traced through the production stamper. A stage-4 REDIRECT (Call #1 ranks 9 first, 6 second; the
model confirms 6, `redirect_from_type` 9):

| | |
|---|---|
| `confirmed_type` → `hero.number` → LEADING ring | **6** |
| `alternate_candidate` → `alternate.number` → dashed ring | **9** |
| `charts.types` ranked | T9:91 **T6:83** T5:74 T1:52 T3:47 T2:44 T7:38 T4:35 T8:31 |

**The LEADING ring lands on fill rank 2 of 9, and the darkest node carries the DASHED ring.** So the
chain holds — but the picture is not tile 6×3, where the leading ring sits on the *palest* node and
the darkest is *unringed*. On a redirect the two rings sit on the top two fills, swapped. **My read
of the tile was wrong in its specifics as well as its method.**

### 5.3 Bug, or correct-but-unexplained? `[JUDGMENT]` **Correct, and it needs no context.**

The page states: this client's type is 6, and 9 is worth exploring. Both true. The ramp states: the
engine's coherence scored 9 highest. Also true. A redirect *is* the engine confirming against its
own ranking on stage-4 evidence, and the figure showing the alternate darker than the leading is a
faithful picture of that — arguably the most informative thing on the sheet for such a client.

The locked caption already carries the meaning without asserting rank: *"Type 6 is your leading
hypothesis. Type 9 is the alternate worth exploring with your coach."* Nothing is false and nothing
needs adding. **Not a bug, and not a blocker.**

### 5.4 What §5 actually turned up — and it is a real defect I introduced `[MEASURED]`

Chasing question 5 — *does the new throw fire on a redirect?* — the answer for a redirect is **no**:
`hero.number` 6 and `alternate.number` 9 differ. **But there is a path where they do not.**

`call2_stamp.js`'s Defect #3 guard fires whenever `confirmed_type === alternate_candidate`. When it
cannot recover a distinct alternate it sets `collision_flag`, raises an `engine_collision` flag for
admin review, and **ships** — its comment is explicit: *"Never pass a collided result through
silently — **but do not hard-stop: the client still gets a report**."* `buildClientModel` then
builds it without complaint: `CLIENT_SPEC` requires `alternate.number` to be **present**, never to
**differ**.

Measured end to end: `hero.number === alternate.number === 6`, model builds, and
**`buildEnneagramSVG` THREW** — `"leading and alternate are both type 6"`.

**That converts a record the engine deliberately ships into a client report that fails to generate
at all.** And it is reachable on the **em_only production path**, not only the SM fallback: both
fields come from EM there, and the guard fires whenever it emits one type for both, redirect or not
— confirmed by running the stamper in `em_only` with `stage4_outcome: 'CONFIRMED'`.

`[JUDGMENT]` **The refusal was right; the hard stop was wrong.** A diagram builder should not
override an explicit, documented engine decision about whether a client gets a report. **Now it
degrades**: when the two collide the alternate is dropped — one ring, no dashed ring, no ALTERNATE
label. On such a record the alternate is not a distinct hypothesis, so that is the honest render,
and the coach already has the flag.

Asserted, and red-proven both ways:

| Red control | Failure |
|---|---|
| restore the throw | `buildEnneagramSVG THREW … the figure must degrade, not hard-stop` |
| keep the dashed ring on the shared node | `1 dashed ring(s) drawn, expected 0` **and** `an ALTERNATE label was drawn for a type that is also the leading` |

### 5.5 Is the prevention asserted or incidental?

**It was incidental, and that is now closed at the diagram.** Nothing between the stamper and the
renderer required the two to differ — not `CLIENT_SPEC`, not `nodesFor`, not the tests. The only
thing standing between a collided record and a broken document was that **sheet 5 does not exist
yet**, which is the "not prevented, merely not yet possible" state this project keeps finding on the
wrong side of.

`[JUDGMENT]` **Step 6 still wants its own assertion** — that a collided record renders a complete
document rather than throwing — because the diagram is only one of the places that could hard-stop
on it. Recorded here rather than left to be rediscovered.

### 5.6 Does this block the merge? **No.**

Build 2 renders what it is passed, and now degrades rather than hard-stopping on the one input that
the engine can legitimately produce. All seven gates green, B11 still 81/81 byte-identical. The
step-6 assertion in §5.5 is the follow-up, not a blocker.

---

## 6. Merge predictions, committed before the push

**Read against this branch's own file list before committing, not against Build 1's baseline.**
That is the C10 correction: Build 2 *changes two gates that CI runs*, so a Build-1 timing baseline
is not a prediction for them.

### 6.1 Which steps this branch actually moves `[MEASURED]` from the diff

| CI step | Touched by this branch? |
|---|---|
| Diagram geometry gate | **yes** — `verify_diagrams.js` +232 lines: 72 ring configurations, the collided-record check, score-independence |
| Transparency gate | **yes** — `verify_transparency.js` +47 lines: **4 additional standalone PDF renders** |
| Unit tests · Render check · Coach regression · Content library | no |
| — | `verify_wings_pixel.js` is **new and not in the workflow** — see §6.5 — so it adds **0s** |

### 6.2 Predictions

| # | Prediction | Label |
|---|---|---|
| D1 | Bare push → **0** runs; this branch has never been pushed | `[MEASURED]` — held twice |
| D2 | Opening the PR → **1** run, `pull_request`, on branch head **`46a211e`** | `[MEASURED]` |
| D3 | **No run fires on `6aa2821`** (deliberately red). `pull_request` tests the head; `push` only fires on `main` | `[MEASURED]` — workflow lines 17-20 |
| D4 | **PR #96** (last merged #95) | `[MEASURED]` |
| D5 | All 11 named steps run, none skip | `[MEASURED]` |
| D6 | **Coach byte-diff: HTML *and* PDF halves pass, on `sp4` and `sx7`** | `[ESTIMATED]`, premise `[MEASURED]` — see 6.4 |
| D7 | Every other step `success` | `[ESTIMATED]` |
| D8 | Merge → a second run, `push`, on the merge commit | `[MEASURED]` |
| D9 | 10 files (5 non-`.md`), **+1834 / −13**, 2 parents, **16 branch commits** | `[MEASURED]` |

### 6.3 Wall-clock — rebased on the changed steps

Build 1's CI run measured 113s of steps, of which **Diagram gate < 1s** and **Transparency 5s**
`[MEASURED]`. Local deltas for this branch `[MEASURED]`: diagrams 0.93s → **1.10s**; transparency
2.88s → **7.48s** (+4.60s, the four PDF renders).

| | Build 1 CI | Predicted here |
|---|---|---|
| Diagram gate | <1s | **~2s** `[ESTIMATED]` |
| Transparency gate | 5s | **~12s** `[ESTIMATED]` |
| everything else | 107s | 107s `[MEASURED]` |

> **Point estimate 2m07s; predicted range 1m55s – 2m30s**, both runs. `[ESTIMATED]` from measured
> components.

### 6.4 ⚠ The coach byte-diff — the half that has never run

**This branch has never been pushed and no Build 2 commit has ever had a CI run** `[MEASURED]`. So
the PDF half of the coach byte-diff has **never executed against this build**, and Build 2 is the
build where it is load-bearing: `_coachPage1` (`renderer.js:1590`) calls `buildEnneagramSVG`, whose
signature this branch widened.

**Predicted PASS**, on these measured premises:

* **B11: 81/81 byte-identical** across nine variants × nine types — the coach renders variant
  `type`, and its markup is unchanged;
* the coach byte-diff's **HTML half passes locally** on both fixtures — a direct check of the coach
  HTML, not an inference;
* `buildCoachReportHTML` and `_coachPage1/2/3` have **no `+`/`-` in the diff**;
* the additions to `renderer.js` are module-level (`QUICKREF_GEO`, `rampFill`, one export line) plus
  a new variant branch no coach path reaches.

**A PDF-half failure stops the merge and will not be re-run.** It would mean the coach PDF moved
while its HTML did not — a rendering-level change none of the premises above predicts, and a finding
about a shipped page.

### 6.5 One thing this branch does not do `[MEASURED]`

It adds **123 lines of gate** in `scripts/verify_wings_pixel.js` and **CI coverage does not
increase**, because nothing runs it: `grep verify_wings_pixel .github/workflows/report-verify.yml`
and the same over `app/package.json` both return **0** `[MEASURED]`. Stated here so the merge is not read as
having landed IO-75's assertion. The workflow PR is the next thing.
