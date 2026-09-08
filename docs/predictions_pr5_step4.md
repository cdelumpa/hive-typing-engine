# PR 5 · Step 4 — Predictions, committed BEFORE measuring

**Branch** `pr5-step4-subtype-measure`. **Base** `90640b8` (main, clean).
**Written** 8 Sep 2026, before any browser was launched. Nothing below is a range hedged to be
unfalsifiable; every line is a number that can be wrong. A deviation is a finding, reported as a
deviation in `docs/audit_pr5_quickref.md` §26 — not quietly corrected here.

**Subject.** The 27 subtype one-sentence summaries (SP1…SX9), injected at runtime into the `.stxt`
box of `docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html`. The strings are client prose and
are **not** committed anywhere in this repo, including this file. Only labels and numbers are.

## P0 — the box

| # | Prediction | Value | Basis |
|---|---|---|---|
| P0.1 | `.stxt` computed content width | **308.00 px** | CSS arithmetic, not a render: `.page` 816 − 2×53 padding = 710; `.two` is `display:flex; gap:18px`, two `flex:1` children → 346 each; `.half` has `1px` border each side → 344; `.hbd` has `padding:16px 18px` → **308**. |
| P0.2 | Font actually resolved | **Arial**, no substitution | macOS host has genuine Arial; `bl.assertReportFont` probe passes at 2378.81 ± 1.0 px. |
| P0.3 | `font-size` | **12.5 px** | `.stxt{font-size:12.5px}` |
| P0.4 | `line-height` | **18.75 px** | `line-height:1.5` × 12.5 |
| P0.5 | Content width is **invariant** across all 27 injections | width identical to 2 dp for every string | `flex:1` = `flex:1 1 0%` — basis 0, equal grow, so the halves split the row regardless of content. If this is false, every per-string number is confounded and the pass is invalid. |

## P1 — chars per line

| # | Prediction | Value |
|---|---|---|
| P1.1 | Mean chars per line across the 27 (Σchars ÷ Σlines) | **49** |
| P1.2 | Minimum chars-per-line on the *average* basis (chars ÷ lines, per string) | **34**, produced by **SP6** (68 chars, predicted 2 lines) |
| P1.3 | Median chars-per-line, average basis | **46** |
| P1.4 | Maximum chars-per-line, average basis | **52**, produced by a 1-line string (**SP9**, 52 chars) |
| P1.5 | Minimum **full-line** char count — the narrowest non-terminal line anywhere in the 27 | **44** |

P1.1 derives from 308 px ÷ 6.25 px, taking Arial's average advance over English prose (including
spaces) as 0.50 em at 12.5 px. It is a real number and it can be wrong by more than rounding.

## P2 — line counts

| # | Prediction | Value |
|---|---|---|
| P2.1 | Count of the 27 rendering at **4 or more** lines | **1** |
| P2.2 | Which | **SO5** (161 chars) and only SO5 |
| P2.3 | The nearest miss — longest string still at 3 lines | **SO1** (148 chars) |
| P2.4 | Line count is **monotone** in char count across the 27 — no string renders on more lines than a longer string | **holds** |

P2.4 is the prediction most likely to fail, and it matters: if it fails, "the highest char count that
still fits" is not a ceiling at all, and M4's OBSERVED CEILING has to be reported with the
counter-example beside it.

## P3 — the two ceilings

| # | Prediction | Value | Basis |
|---|---|---|---|
| P3.1 | OBSERVED CEILING | **148 chars** (SO1) | highest char count among the 27 still at ≤ 3 lines |
| P3.2 | SAFE CEILING, by the formula in the step-4 prompt: 3 × min chars-per-line (average basis), floored | **102 chars** | 3 × 34 |
| P3.3 | SAFE CEILING, by the full-line method: 3 × min non-terminal line char count, floored | **132 chars** | 3 × 44 |

**P3.2 and P3.3 disagree by ~30 characters and that gap is predicted, not accidental.** The prompt's
formula divides by a per-string average that includes a possibly near-empty last line, so a short
string with a stranded last word drags the minimum down for a reason that has nothing to do with how
much text a line holds. The full-line method is the one that follows from how greedy wrapping works
and it is the number this pass will recommend. Stated here, before the measurement, so it reads as a
method disagreement and not as a result chosen after seeing the data.

## P4 — the gate

| # | Prediction | Value |
|---|---|---|
| P4.1 | `verify_coach_baseline.js` applies to this pass | **No.** Docs-only; the coach portal render path is untouched. |
| P4.2 | If run on this Mac anyway | **HALF-RESULT** — the PDF-hash half skips off-Linux; only the HTML half executes. |
| P4.3 | Files this branch touches, at merge | **2**, both `.md`, both under `docs/`. Non-`.md` paths: **0**. |

## P5 — post-commit note

This predictions file is itself a commit, so it moves the branch head. Every number above was fixed
before that commit; the measurement runs against the working tree at the commit **after** this one,
and the `.stxt` box is read from `docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html`, which
this branch does not modify — its content hash is identical at base, at this commit, and at the
findings commit. That invariance is asserted in the findings.
