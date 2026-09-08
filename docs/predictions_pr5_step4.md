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

---

# AMENDMENT — predictions, committed BEFORE re-measuring

**Written** 8 Sep 2026, appended at branch head `db7e0d0`, before any browser was launched for the
amendment. Nothing in the pass-1 section above is altered; that record stands as written.

## The basis, named up front so last pass's error cannot repeat

**Every capacity prediction below is on the FULL-LINE basis** — the character count of a
*non-terminal* line, a line that was filled until the next word would not fit. Terminal lines are
excluded, always, everywhere in this section.

Last pass 9 of 20 misses came from one conflation: a capacity estimate was scored against
chars ÷ lines, a per-string average that includes short terminal lines. Those are different
quantities and they differ by the amount the terminal lines drag — full-line mean 51.63 against
pooled average 42.96. **No prediction here is to be scored against the average basis.** Where a
number below is an average, it says so.

## A0 — input claims in the amendment brief, checked without rendering

| # | Claim | Verdict |
|---|---|---|
| A0.1 | Revised SX5 is 120 characters | **CONFIRMED.** 120, on `replace(/\s+/g,' ').trim().length`, the pass-1 basis. |
| A0.2 | Longest word is `individuals`, 11 | **PARTLY WRONG.** 11 is right; `individuals` is *co*-longest. **`connections` also has 11 characters.** Char length does not decide width, so both are measured. |

## A — revised SX5

Predictions derived from Arial advance widths at 12.5 px, arithmetic not rendering. The revised
string's first 50 characters are identical to the version measured in pass 1, so line 1 is predicted
to reproduce exactly.

| # | Prediction | Value |
|---|---|---|
| A1.1 | Rendered line count | **3** |
| A1.2 | Per-line character counts | **50 · 50 · 18** (Σ 118 + 2 break spaces = 120, the pass-1 check) |
| A1.3 | Line widths px | **271.23 · 271.66 · 102.14** |
| A1.4 | Longest line | **271.66 px** (line 2) |
| A1.5 | Slack against 308.00 px | **36.34 px** |
| A2.1 | Line 1 break type | **FULL** — `choosing` needs 53.50 px into 36.77 px remaining |
| A2.2 | Line 2 break type | **FULL** — `connections` needs 70.18 px into 36.34 px remaining |
| A2.3 | Line 3 break type | **TERMINAL** |
| A2.4 | Revised SX5's minimum full line | **50 characters** — up from 41. **It no longer sets m and no longer constrains anything.** |

## B — m and the ceiling

| # | Prediction | Value |
|---|---|---|
| B1.1 | New m (minimum full-line char count over the corrected 27) | **44** |
| B1.2 | Which line sets it | **A TIE at 44 characters — SO4 line 2 and SO6 line 1.** m is defined in characters, so this is a genuine tie, not a rounding artefact. |
| B1.3 | Widths of the two tied lines | SO4 L2 **253.61 px**; SO6 L1 **235.81 px**. SO6's is the more constraining in pixels — 72.19 px left empty against SO4's 54.39 px. |
| B1.4 | Word forcing SO6 L1's break | **`responsibility`**, **72.27 px**, **23.5 %** of the 308.00 px box |
| B1.5 | Word forcing SO4 L2's break | **`compared`**, **55.58 px**, **18.0 %** of the box |
| B2.1 | New safe ceiling, 3m | **132** |
| B2.2 | Movement | **+9**, from 123 |
| B3.1 | Strings above the new ceiling | **2** |
| B3.2 | Which | **SO5** (161 chars, 3 lines) and **SO1** (148 chars, 3 lines) |
| B3.3 | Does the band empty? | **No.** The 133–161 band keeps two members. Four strings leave it — SP1 125, SO8 126, SO3 130, and revised SX5 at 120 — so the band shrinks from six to two but does not clear. |
| B4.1 | Monotonicity violations on the corrected set | **0** |
| B4.2 | Does one changed string invalidate the 351-pair result? | **No.** A violation is a property of a *pair*; changing one string can only affect the **26** pairs containing it. The other 325 are untouched and their pass-1 result stands. Re-running all 351 is free, so it will be re-run in full — but the argument for why 26 suffice is the finding, not the re-run. |

## C — SO8 quote normalisation

**Honesty about what is and is not a prediction here.** SO8 was already measured in both quote forms
in pass 1, as the §26.3 sensitivity check — straight 307.69 px, curly 307.14 px. C1.1 through C1.4
below therefore **restate a prior measurement; they are retrodictions, not predictions, and are not
scored.** The genuinely unmeasured quantities are the two glyph advances, C1.5 and C1.6, predicted
from Arial's metrics table and not from any render.

| # | Prediction | Value | |
|---|---|---|---|
| C1.1 | Straight (U+0022) longest line | 307.69 px | retrodiction |
| C1.2 | Straight slack against 308.00 px | 0.31 px | retrodiction |
| C1.3 | Curly (U+201C/U+201D) longest line | 307.14 px | retrodiction |
| C1.4 | Curly slack against 308.00 px | 0.86 px | retrodiction |
| C1.5 | Advance of **U+0022** at 12.5 px Arial | **4.4375 px** (355/1000 em) | **prediction** |
| C1.6 | Advance of **U+201C** and of **U+201D** | **4.1625 px each** (333/1000 em) | **prediction** |
| C1.7 | Delta, curly − straight, on the longest line, **with sign** | **−0.55 px.** **Curly is NARROWER.** The Google Doc's form is the safer of the two, by 2 × 0.275 px, which also implies **both quote glyphs sit on the same rendered line** — if only one did, the delta would be −0.275 px. | **prediction** |
| C2.1 | Does either form wrap to 4 lines? | **No. Both render at 3.** | |

**The direction matters and is stated flatly: the form Cai and Mo are actually editing is the wider-
margin one.** If this is wrong and curly is *wider*, SO8 has 0.31 px of slack in the measured form
and less than that in the shipping form, and it is a rewrite, not a note.

## D — housekeeping

| # | Prediction | Value |
|---|---|---|
| D1.1 | Is Synthetic B still load-bearing? | **No — not for anything in the shipping set.** Its referent line no longer exists. |
| D1.2 | A new Synthetic C, matched on the render to the new m-setting line (SO6 line 1, 235.81 px), is achievable within **1.00 px** on the constraining line | **achievable** |
| D2.1 | §26.4's `compartmentalizing` finding | Restated in the past tense as the reason m **was** 41 on 8 Sep. Not deleted — it is the evidence for the ceiling's conditionality, which is unchanged. |
| D3.1 | `verify_coach_baseline.js` applies to this amendment | **No.** Docs-only. |
| D3.2 | If run on this Mac | **HALF-RESULT** — PDF half skips off-Linux. |
| D3.3 | Files this branch touches at merge | **2**, both `.md`, both under `docs/`. Non-`.md`: **0**. |

## Post-commit values

This amendment's predictions commit moves the branch head from `db7e0d0`. Every number above was
fixed before that commit. The measurement runs against the working tree at the commit **after** this
one; `docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html` is not modified by this branch and
its blob stays `813e871` throughout — asserted again in the findings.
