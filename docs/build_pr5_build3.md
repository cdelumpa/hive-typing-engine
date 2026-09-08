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
