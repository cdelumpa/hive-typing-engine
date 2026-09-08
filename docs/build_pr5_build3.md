# PR 5 Build 3 — rank-based shading

Branch `pr5-build3-rank-shading`, off `main @ 0f77cea` `[MEASURED]`. Preconditions confirmed from
the repo: Build 2 merged, `main` and `origin/main` both `0f77cea`, **only `main` exists** locally and
remotely, and `client-quickref` / `QUICKREF_GEO` each appear **3×** in `main`'s `renderer.js`.

Mechanism from `docs/exploratory_rank_shading.md` §2–§5 and its §2.2 redirect trace, both on `main`.

---

## 1. The prompt's §3 — the measurement that gates the authoring brief

**Reported first, and separately, because it is the highest-value thing in the build.**
Section numbers prefixed "the prompt's" refer to the build prompt; this document numbers its own
sections independently.

All `[MEASURED]` on the `AtAGlance_v1.html` scaffold, Chromium 147, at the real widths.

### 1.1 The new zone-8 string — **2 lines, not 3**

| | chars | width | rendered lines | box |
|---|---|---|---|---|
| current string | 165 | 710px | **2** | 33.34px |
| **new string** | **227** | 710px | **2** | **33.34px** |
| new string, **non-italic** (the decision) | 227 | 710px | **2** | **33.34px** |

**The prompt's estimate — "probably three lines against two" — is wrong, and by a comfortable
margin.** At 710px the `.note` column fits roughly 113 characters per line, so a 37% longer string
still lands in two. Italic versus normal makes no difference to the line count.

**Page height unchanged: 1015.22px. Headroom unchanged: 40.78px.**

### 1.2 The prompt's §3.2 — **the subtype budget does NOT move**

Measured with the new zone-8 string in place, non-italic, growing `.stxt` one rendered line at a
time:

| `.stxt` lines | intrinsic page | headroom | |
|---|---|---|---|
| 2 | 1015.22 | 40.78 | fits |
| **3** | **1033.97** | **22.03** | **fits — the budget** |
| 4 | 1052.72 | 3.28 | fits, but inside font-substitution noise |
| 5 | 1071.47 | −15.47 | **fails the 1057 gate** |

**Identical to the 8 September table.** The authoring brief for the 27 subtype summaries is
**unchanged at 3 rendered lines**, with 4 still not a budget for the reason it never was: 3.28px is
under a fifth of a line, and design spec v3.0 §3.3 names font substitution as the most likely cause
of a page silently becoming two sheets.

### 1.3 The prompt's §3.3 — nothing needs restoring

The budget did not move, so the standing authorisation to delete zone 8 and free 45.34px **is not
needed and is not used**. It remains available.

---

## 2. Predictions, committed before the code changed

**Read against this build's own file list.** And per the prompt's §0.2, the self-reference is handled explicitly
this time: **every count below is the value AFTER this commit lands and after the whole build**, not
before. That is what D2 and D9 missed — they described the branch as it stood while the predictions
commit was being written.

**The one thing I cannot predict is this commit's own SHA**, so the branch head is stated as "the
final commit of the build" rather than a value.

### 2.1 Scope

| # | Prediction | Label |
|---|---|---|
| E1 | **4 files** total: `app/report_prep.js`, `app/renderer.js`, `scripts/verify_diagrams.js`, `docs/build_pr5_build3.md` — **3 non-`.md`** | `[ESTIMATED]` |
| E2 | **4 commits** on the branch at the end: predictions, report_prep, the variant + gates, the build report | `[ESTIMATED]` |
| E3 | `V3_PAGE_ORDER`, `report_page_inventory.js`, `content_library.json`, any `.docx`, `.github/workflows/` — **all absent from both the aggregate and per-commit views** | `[ESTIMATED]` intent |
| E4 | Page count stays **10**; `quickref` still has no `built: true` | `[MEASURED]` — no builder exists to register |

### 2.2 Behaviour

| # | Prediction | Label |
|---|---|---|
| E5 | **The nine pre-existing variants stay byte-identical** — 81 renders. `client-quickref` is the only one that changes. | `[ESTIMATED]`, premise `[MEASURED]`: the change is inside that branch and in `typeRamp` |
| E6 | **Coach byte-diff blind again**, as in Build 1 — the coach renders variant `type`, and neither `typeRamp` nor the quickref branch is on its path. **HTML half passes locally, PDF half SKIPS off-Linux.** | skip `[MEASURED]`; pass `[ESTIMATED]` |
| E7 | The nine constants' endpoints are **byte-identical to B9's verified values**: position 1 `#00B2D9`, position 9 `#E6F7FB` | `[MEASURED]` — arithmetic on the same formula |
| E8 | **B2's geometry is unaffected** — minimum edge clearance stays **8.35px** across 72, unchanged | `[ESTIMATED]`, premise `[MEASURED]`: placement reads node position and the two ring parameters, never a fill |
| E9 | **B12 red-proves against `leading_candidate` ordering** — fails on every REDIRECT-shaped input | `[ESTIMATED]` |

### 2.3 Timings — rebased on the changed gate

`verify_diagrams.js` is the only CI-run gate this build touches; B12 adds a fill read per
configuration. Local baseline on `main` **1.10s** `[MEASURED]`.

| Gate | baseline | predicted |
|---|---|---|
| `verify_diagrams.js` | 1.10s | **1.2 – 1.7s** `[ESTIMATED]` |
| `npm test` 0.27s · `verify:render` 51.83s · `verify_transparency` 7.48s · `verify_coach_baseline` 2.83s · `verify_content_library` 0.20s · `verify_wings_pixel` 2.79s | | **unchanged, ±0.3s** `[ESTIMATED]` — none is touched |

**No CI prediction**: this prompt stops at the commit.

### 2.4 What this build does **not** contain `[MEASURED]`

**The copy decisions in the prompt's §2 cannot be built here, and this is the lead finding — see
this document's §3.** There is no `_clv3QuickRef`; sheet 5 has no builder, so the H2 and zone-8 strings have nowhere
in the renderer to go. They are measured above and recorded for step 6.

---

## 3. The lead finding — the copy decisions cannot be built here

**There is no `_clv3QuickRef`.** `[MEASURED]` The v3 builders are `_clv3Cover`, `_clv3Contents`,
`_clv3Welcome`, `_clv3WhatIs`, `_clv3Thoughts`, `_clv3Wings`, `_clv3TypeA`, `_clv3TypeB`,
`_clv3Lines`, `_clv3Instincts` — **ten, and none is sheet 5.** `V3_PAGE_ORDER`'s `quickref` entry
has no `built` flag and the builder registry has no `quickref` key.

So the prompt's §2.1 (the H2) and §2.2 (zone 8's string, its non-italic treatment, and the inline
margin becoming a modifier) **have nowhere in the renderer to go.** They are step-6 inputs, measured
here and recorded, not built.

**§2.4 checked and clear** `[MEASURED]`: neither string lives in `content_library.json`, any `.docx`,
or behind a CMS key. `grep` for "How the Nine Patterns Scored", "How the Nine Types Show Up" and
"scored close behind" across `app/content/content_library.json` and `app/*.js` returns **nothing**;
`content_library.json` has no quickref key and `cmsPreviewSpec` has no `quickref` entry. **The copy
exists only in the tracked mockup HTML.** No stop condition — but also nothing to change.

`[JUDGMENT]` Recorded for step 6, verbatim, with the two load-bearing properties from the prompt's
§2.3: the string **interpolates nothing** (so §1.1's measurement never has to be repeated) and it
**does not count the rings** — "the candidates marked here" holds at one ring or two, which the
COLLIDED tile in §5 shows is a real shape.

---

## 4. The build report

### 4.1 Assertions

| # | Assertion | Result | Red-proof |
|---|---|---|---|
| **B9** *(replaced)* | nine constants, endpoints byte-identical to the verified values | `#00B2D9` … `#E6F7FB`, exact | ramp direction reversed → prints both arrays |
| **B10** *(restated)* | two **orderings** differ only in fills | ✓ | a node's `x` reads its position → *"differ OUTSIDE fill"*. **Two earlier controls did not fire** — see 4.3 |
| **B12** *(new)* | rings sit on positions 1 and 2 | **72/72** | **ordering from the alternate first** — the REDIRECT shape — **144 failures** |
| B1–B8, B11 | unchanged from Build 2 | all green | — |
| — | positions are 1–9 exactly once; position 1 = hero, position 2 = alternate | ✓ | in `report_pages_test.js` |
| — | no backfilled entries on the tracked fixtures | ✓ | 2-entry ranking → *"backfilled entries at p3…p9"* |

### 4.2 Predictions against actuals

| # | Predicted | Actual | |
|---|---|---|---|
| E1 | 4 files (3 non-`.md`) | **5** (4 non-`.md`) | **RE-OPENED in `d964627`**, not missed — see 4.4 |
| E2 | 4 commits | **5** | same |
| E3 | forbidden all absent, both views | absent; `V3_PAGE_ORDER` constant 0 `+`/`-` | **HELD** |
| E4 | page count 10, no `built: true` | 10 | **HELD** |
| E5 | nine variants 81/81 byte-identical | 81/81 | **HELD** |
| E6 | coach blind: HTML passes, **PDF skips** | `ALL PASSED — HTML only (PDF half skipped off-Linux)` | **HELD** |
| E7 | endpoints byte-identical to B9's | `#00B2D9` / `#E6F7FB` | **HELD** |
| E8 | edge clearance unchanged at 8.35px | **8.35px** | **HELD** |
| E9 | B12 red-proves against the wrong ordering | 144 failures | **HELD** |
| — | `verify_diagrams` **1.2–1.7s** | **1.08s** | **MISS — below the floor** |

**The timing miss** `[JUDGMENT]`: B12 adds 72 regex matches over strings already in memory, which is
cheaper than the render work already in the loop. I estimated upward from "more work" without a
measured basis for the increment — the same shape as Build 2's C9, and the same lesson: an unlabelled
intuition about *direction* is not a prediction about *magnitude*.

### 4.3 The two red controls that did not fire, and why it is structural

**B10's first control** offset a label's `x` by `position × 0.01` — swallowed by the coordinate's own
`toFixed(1)`. **The second** used `× 4`, which is visible — and still passed. The reason is not the
control: **labels attach only to the ringed types, and the two orderings B10 compares share their
rings, so positions 1 and 2 are identical between them by construction.** A label reading the
ordering cannot vary. What differs is the tail, positions 3–9 — the part carrying no ring and no
label.

So B10 asserts **node geometry** is ordering-independent; the **label** half is guaranteed
structurally instead, by B12 pinning the two ringed positions. **That reach is now written beside
the assertion** (`670da38`), because an assertion whose reach is narrower than its name is how a gate
goes quietly vacuous — this project's recurring failure, and B10 was being restated precisely to
avoid becoming the seventh instance.

**B12's own lookup also had to be corrected before it was trustworthy**: `_wheelNodes` does
`+(x).toFixed(1)`, so `49.0` is emitted as `"49"`. A naive `.toFixed(1)` missed every whole-numbered
coordinate — node 9 on this geometry — and B12 failed on all eight `x9` pairs until fixed.

### 4.4 A gate I weakened, and the fix in the same commit

`typeRamp` now **backfills** any type missing from `call1_ranking`, so a malformed ranking can never
leave a ring unplaced. Deliberate, and it matches `call2_stamp.js`'s flag-don't-hard-stop posture.

**But it means `validateModel`'s `ninePerType` can no longer detect a short ranking.** `[MEASURED]`
A two-entry `call1_ranking` **threw on `main`** and **builds cleanly here**, backfilling positions
3–9. That is a regression in a gate I added in Build 1.

**The detection moved rather than disappearing.** Backfilled entries carry `score: null` — honest,
since the engine produced no number for them — and `report_pages_test.js` now asserts **no nulls** on
the tracked fixtures. Production degrades; a malformed fixture or CMS stub is still caught. Both
changes are in `d964627`, so no commit lands a knowingly weakened gate.

`ints0to100` is scoped off `charts.types` for the same reason and replaced by `positionsOneToNine`,
which is what the figure actually reads.

### 4.5 The coach byte-diff — which half

**HTML half PASSED. PDF half SKIPPED** off-Linux. **Blind, as predicted** — confirmed rather than
assumed: `buildCoachReportHTML` and `_coachPage1/2/3` have no `+`/`-` in the diff, the coach renders
variant `type`, and E5's 81/81 covers it. Unlike Build 2, nothing this build changes is on the coach
path.

### 4.6 The prompt's §4.5 — the `em_ranking` ordering validator

`[JUDGMENT]` **Stays filed. It does not belong here.**

Under this design positions 1–2 come from `hero.number` and `alternate.number`, so a mis-ordered
`em_ranking` can only permute positions 3–9 — seven nodes carrying no ring, no label, and no claim
of magnitude. **The figure has no way to be wrong about them**, because it asserts only that they
are the remaining seven. Its remaining stakes are the coach chart and `near_tie`, both of which read
positionally and neither of which this build touches.

### 4.7 What carries the guarantee

* **The ring/fill agreement** — a mechanism *replaced*: fills used to follow scores, now they follow
  position. The guarantee ("the leading ring is on the darkest node") is carried by **positions 1–2
  being sourced from the ring's own fields**, and asserted by **B12**. It is one value used twice,
  not two that agree.
* **Nine positions always** — carried by the **backfill**, asserted by `positionsOneToNine`. Not by
  `call1_ranking` being well-formed, which nothing upstream checks.
* **A malformed ranking staying visible** — carried by the **null-score assertion**, not by
  `ninePerType`, which the backfill defeated.
* **Ordering-independent geometry** — carried by **B10 for nodes** and **B12 for labels**, and 4.3
  records which does which.

---

## 5. The smoke test

`.phase6_out/quickref_rank_shipped.png`. **Every tile built through the production stamper and
`buildClientModel`** — not a prototype wrapper this time.

| Tile | |
|---|---|
| normal | node 9 darkest and ringed, node 5 second and dashed |
| **REDIRECT 9 → 5** | **node 5 darkest with the solid ring, node 9 second with the dashed** — the case score-shading rendered backwards |
| alternate at rank 3 | the 2-of-19 production case; the alternate is second-darkest regardless |
| **COLLIDED** | one ring, complete nine-step scale, no ALTERNATE label |
| FLAT profile | indistinguishable from `normal` — intended, not a defect |
| SHORT ranking | 2 entries; positions 3–9 backfilled; the picture is complete |

---

## 6. The legend — priced, **not built**

**It did not ride along.** No change to the legend is in this build.

`[MEASURED]` The bar is a continuous `linearGradient` from `RAMP_MIN` to `RAMP_MAX`; the nodes are
now nine discrete steps. The swatch strip at the top of the smoke test reads more clearly than the
bar beneath it, and that is the argument.

**The price** `[ESTIMATED]`, all inside the existing variant:

| | |
|---|---|
| Markup | replace one `<rect fill="url(#…)">` with **nine `<rect>`s**, ~30px each across the same 300px span, filled from `RANK_FILL` — the table already exists and is exported |
| `<defs>` | the gradient and its `uid` become unnecessary; **`shadings` drops from 1 to 0** in the transparency scan |
| Gates | B6/B7 unaffected (opaque either way). **B9 gets stronger** — it would assert the legend reads the same nine constants as the nodes, closing the one way they could drift |
| Geometry | the ramp sits below every node; B2's minimum clearance is on `"LEADING"` at 8.35px, nowhere near it. **No re-measurement.** |
| Copy | ⚠ **the captions become a live question.** "Less like you → More like you" reads as a continuum; nine blocks read as a ranking. This is the half that is a design decision, not an implementation. |

`[JUDGMENT]` Cheap, and it makes the figure say one thing instead of two. **But the caption question
rides with it**, and that is Cai and Mo's — which is why it is priced here and left.

**The instinct bars are untouched and out of scope**, as instructed. Same question one zone over.
