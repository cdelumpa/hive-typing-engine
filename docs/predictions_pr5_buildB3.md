# PR 5 · Build B3 — Predictions, committed BEFORE building

**Branch** `pr5-buildB3-fit-assertions`. **Base** `11bca71` (main, clean).
**Written** 9 Sep 2026, before any source file was edited. Every `§N` names a section of
`docs/audit_pr5_quickref.md` unless said otherwise.

The build is the fit assertions F1–F4 for sheet 5, plus the PDF question §8 opened in the
B3 plan and closed here by decision.

## B0 — what reading the code changed about the plan, before measuring

Three corrections to my own plan, recorded here so the build report is judged against what
I actually believed at the start rather than against a plan I had already quietly revised.

**B0.1 — `fitProbe` is already zone-parametric.** It takes `zoneSel` and locates sheet 5 by
`.v3-page` containing `.v3-qr-two`, so it runs unchanged against any rendered v3 document.
The architecture change I proposed (§4.1 of the plan) is **not needed**.

**B0.2 — F3's ring-label clause is redundant and is dropped.** `verify_diagrams.js` already
asserts label-vs-label and label-vs-node non-overlap across all 72 pairs and the collided
sweep. What it does NOT assert is label-vs-legend *clearance*, and its own note at :241
records why a non-overlap test cannot: two labels passed the overlap check at a 2.49px gap.
That is the gap F3's named pair fills.

**B0.3 — F4b as planned was near-tautological, and the real disagreement is elsewhere.**
I planned "same string, two paths, same line count". But `cmsRenderPreviewPng` builds the
model with `buildClientModel` and renders with `buildClientReportHTML_v3` — the same builder
the client gets — so the preview zone and the page zone are the same DOM by construction, and
no transform sits on one path and not the other. The comparison would have been green forever.

The disagreement that is real is between the **cap** and the **page**:

- `.v3-qr-stxt` carries `font-size:12.5px; line-height:1.5` and **no height, max-height or
  overflow**. There is no box bound. `cap: 3` is a PAGE bound expressed in lines.
- The comment justifying `cap: 3` says "the `.v3-qr-stxt` box is 308.00px and three lines is
  what fits". 308.00px is the box's **width** (§29.4, the character-ceiling work). As a
  justification for a three-line height bound it is the wrong measurement.
- §28.8's numbers say 3 lines leaves 22.03px of page headroom and 4 leaves 3.28px. **A
  four-line summary fits.** So `fitVerdict`'s "a fourth pushes the page onto a second sheet"
  is false as written.

F4b therefore becomes: **the cap the editor is held to must be provable against the page.**

## B1 — the matrix, and whether F2 needs a pass of its own

| # | Prediction | Value | Basis |
|---|---|---|---|
| 1.1 | Sheet-5 renders in `npm run verify:render` | **35** | anders_sx9 8 types x 3 inst = 24, type 9 x 3 inst x 2 collided = 6, sp4 x 5 Z6 states = 5 |
| 1.2 | Distinct (type x instinct) pairs among them | **27** | anders_sx9's non-collided 27; `instinctsFor` gives sx/sp/so, `typesFor` gives 1..9 |
| 1.3 | Distinct `subtype_<i><N>` summaries rendered | **27 of 27** | `v3SubtypeRows` keys off `leadingN` and the record's `instinct` (report_prep:361-373) |
| 1.4 | F2 therefore needs **no** new browser sweep | **true** | it lives inside the existing pass |
| 1.5 | sp4's 5 renders add 0 new summaries | **true** | all five are Type 4, SP |

If 1.3 comes back below 27 the plan's separate 27-string gate is reinstated and that is the
finding.

## B2 — F1, headroom

| # | Prediction | Value | Basis |
|---|---|---|---|
| 2.1 | Min sheet-5 headroom over 35 renders | **51.61px** | §28.8, Type 1 |
| 2.2 | Max | **73.86px** | §28.8, Type 9 |
| 2.3 | Mean | **62.19px** | §28.8 |
| 2.4 | The type carrying the minimum | **Type 1** | §28.8 |
| 2.5 | One rendered `.v3-qr-stxt` line | **18.75px** | 12.5px x 1.5 |
| 2.6 | The floor I will assert (one summary line) | **18.75px**, measured not hard-coded | see §31 |
| 2.7 | Margin between the floor and the observed minimum | **32.86px** | 51.61 - 18.75 |
| 2.8 | F1's positive control (injected filler) goes RED | **yes** | |

## B3 — F2, the summary bound

| # | Prediction | Value | Basis |
|---|---|---|---|
| 3.1 | Every one of the 27 summaries renders at 2 or 3 lines | **27 of 27** | §26/§27 measured them at <= 3, and none is short enough for 1 |
| 3.2 | Count at exactly 3 lines | **unknown — I will not guess a number I can read off §26** | recorded as a deviation only if any exceeds 3 |
| 3.3 | Count at 1 line | **0** | the lower bound is a tripwire for the empty-string class, not a live constraint |
| 3.4 | F2's positive control (5-line synthetic) goes RED | **yes** | B4 already produces the 5-line verdict |
| 3.5 | An empty summary is caught by the LOWER bound and by nothing else today | **true** | |

## B4 — F3, clearances

| # | Prediction | Value | Basis |
|---|---|---|---|
| 4.1 | Label baseline to legend top, SVG user units | **22.10** | railBot = 157 + (105+27+5) + 7.9 = 301.9; rampY = 324 |
| 4.2 | Measured via `getBBox()` rather than the constants | scale-free, no `QUICKREF_GEO` term on the assertion side | |
| 4.3 | The floor asserted (one label em, measured from the label's own box) | **>= 1.0x** | gap/em is 22.10/8.5 = **2.60** today |
| 4.4 | `vh === rampY + 32` holds | **true** — 356 = 324 + 32 | |
| 4.5 | Sibling-box overlaps found by the sweep | **1** — `.v3-qr-zone8`'s `margin:-6px` | I expect to be wrong about this number |
| 4.6 | F3's positive controls (label into legend; relation broken) go RED | **yes** | |

## B5 — F4, the cap against the page

| # | Prediction | Value | Basis |
|---|---|---|---|
| 5.1 | Page headroom at 3 summary lines, Type 1 | **51.61px** | the shipped state |
| 5.2 | Cost of one extra summary line, in page px | **18.75px** | one line height; §28.8's 22.03 -> 3.28 is exactly 18.75 |
| 5.3 | A 4-line summary FITS on every type | **true** | 51.61 - 18.75 = 32.86px free at worst |
| 5.4 | A 5-line summary SPILLS on Type 1 | **true** | 32.86 - 18.75 = 14.11px... **so it FITS.** See 5.5 |
| 5.5 | Correction to 5.4 before measuring: §28.8's 3.28px is NOT Type 1 | the 22.03/3.28 pair is one type's; the 51.61px minimum is another's. **These two numbers cannot both be sheet-5 page headroom at 3 lines.** Resolving this is part of the build | |
| 5.6 | `cap: 3` is therefore not provable as "the most that fits" | **true** — it is conservative by at least one line | |
| 5.7 | F4b's assertion goes **RED on first run** | **yes** | and that is the point of it |
| 5.8 | The recommended resolution keeps `cap: 3` and fixes its justification and message | proposed, **not applied without Cai** | the verdict text is editor-facing copy |

## B6 — the PDF (plan §8, closed here by decision)

| # | Prediction | Value | Basis |
|---|---|---|---|
| 6.1 | Any gate today asserting the page count of a sheet-5 PDF | **none** | `render_client.js:883` writes a PDF and nothing reads it back; `sheets` at :366 is `ceil(height/(PAGE_PX+1))`, a DOM estimate, printed as "estimated physical sheets" |
| 6.2 | The v3 client document's PDF page count equals its logical page count | **11** | 11 `.v3-page` containers |
| 6.3 | Reading page count needs no new dependency | **true** — count `/Type /Page` in the PDF bytes, the method `verify_transparency.js` already uses on `page.pdf()` output | |
| 6.4 | The PDF assertion's positive control cannot be red-proven on this Mac | **true** — but PDF generation in `render_client.js` is NOT the Linux-only half; `verify_coach_baseline.js`'s hash comparison is. `page.pdf()` runs here | |
| 6.5 | So the control CAN run locally and in CI | **true** — if 6.4 is wrong the control is CI-only and I say so | |

## B7 — wiring (addition 1)

| # | Prediction | Value |
|---|---|---|
| 7.1 | B3 adds a job or step to `.github/workflows/report-verify.yml` | **yes** |
| 7.2 | Gates in the workflow after | **7** (six + this) |
| 7.3 | The workflow PR keeps its four items | **yes** |

## B8 — inert-by-construction

| # | Prediction | Value | Basis |
|---|---|---|---|
| 8.1 | Rendered output diff from this build | **0 of 35** | B3 adds assertions, not markup or CSS |
| 8.2 | `PAGE_INVENTORY.client_v3` moves | **no** | no page added |
| 8.3 | `npm test` count after | **33 + the new relation/cap tests** | |
| 8.4 | `scripts/check_docs.py` exit code before committing docs | **0** | run by hand, it is not in CI |
