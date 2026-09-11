# PR 6 · Build B1 — the Development Ideas page (sheet 11)

**Branch** `pr6-buildB1-page`, base **`4382369`** (confirmed equal to `origin/main` before
branching). Predictions committed first at **`4da81b6`**, before any file was edited.

**Status: COMPLETE ON THE BRANCH, NOT PUSHED.** Eleven commits, all seven CI gates plus the new
sheet 11 step green locally, every page measurement predicted to the hundredth. **Sheet 11 renders
and is not CMS-editable** — `app/server.js`, `app/content_overrides.js` and
`app/cms_quickref_preview.js` are untouched. Paused for review, as instructed.

| Commit | Step |
|---|---|
| `4da81b6` | Predictions, committed before building |
| `c00d0d2` | `_v3Straighten` converts `‘` too (D-B6) |
| `960a490` | `app/devideas_fit.js` — the one definition of "fits" for sheet 11 |
| `f4e8919` | Sheet 11 renders — `_clv3DevIdeas`, `built`, page count 12 |
| `28dfa60` | D1–D4 on every v3 render, and the long-name reserve (D-B2) |
| `8e6fda0` | Sheet 5's PDF-spill control derives the page count (a latent defect this build exposed) |
| `61f57a6` | Sheet 11's positive controls, wired into CI |
| `7286e55` | One re-typing recipe, in `scripts/lib/retype_fixture.js` |
| `6d07321` | The smoke sheet, and the script that makes it |
| `1e9dd07` | The design spec describes the new sheet 11 |
| *this commit* | Build report |

## 1. The page

`_clv3DevIdeas(m)` reads only `m.pages.v3_devideas` plus the shared chrome, and throws when the
block is missing. The H1 is `_v3Title(m, 'car')`. The three cards come from one function. Every
string goes through `_v3t`, and each Field Experiment renders as `<b>label:</b> body`, written by the
renderer. The CSS is geometry only, per D1: shared `h1`, `h2.is-tight`, `.note`, `.lead.is-mid`; the
report's dot bullet and 3px accent; and the mockup's 210px rail, padding and gaps. `built: true`,
builder registered, `PAGE_INVENTORY.client_v3` 11 → **12** — every v3 sheet is now built.

## 2. D1–D4 — pass/fail evidence

**On every CI render: silent.** 35 v3 renders (nine types × three instincts, the collided record,
sp4's five Z6 states) plus **nine long-name passes** — 44 measurements of sheet 11, zero failures.
D4 also holds across all 44: one form of the shared strings.

| Type | Natural | Model | Δ | Free | Lines G/I/E | Items | Long name: natural | Free |
|---|---|---|---|---|---|---|---|---|
| 1 | 950.13 | 950.13 | 0.00 | 105.87 | 6/8/9 | 5/4/3 | 961.13 | 94.87 |
| 2 | 893.88 | 893.88 | 0.00 | 162.12 | 6/5/9 | 5/4/3 | 904.88 | 151.12 |
| 3 | 893.88 | 893.88 | 0.00 | 162.12 | 7/4/9 | 5/4/3 | 904.88 | 151.12 |
| 4 | 912.63 | 912.63 | 0.00 | 143.37 | 7/5/9 | 6/3/3 | 923.63 | 132.37 |
| 5 | 893.88 | 893.88 | 0.00 | 162.12 | 6/5/9 | 5/4/3 | 904.88 | 151.12 |
| 6 | 850.38 | 850.38 | 0.00 | 205.62 | 5/4/9 | 5/3/3 | 861.38 | 194.62 |
| 7 | 900.63 | 900.63 | 0.00 | 155.37 | 7/5/9 | 4/3/3 | 911.63 | 144.37 |
| 8 | 918.63 | 918.63 | 0.00 | 137.37 | 7/5/9 | 6/4/3 | 929.63 | 126.37 |
| 9 | **962.13** | 962.13 | 0.00 | **93.87** | 7/7/9 | 7/4/3 | **973.13** | **82.87** |

**The budget formula is re-confirmed against the built page**: the model predicts all nine to
0.00px, and CI now asserts it on every render (tolerance 0.5px), so the design spec §6.3 guidance cannot drift
from the page silently. Every long-name pass rendered a **two-line header** and added exactly 11.00px.

**Watched failing — `scripts/verify_devideas_fit.js`, 19/19.** Each check is driven against a
deliberately broken real sheet 11, and CI now runs this step:

| Control | Check | Result |
|---|---|---|
| Untouched sheet 11, all nine types | all four | quiet |
| The long-name fixture | all four, long-name mode | quiet — it really wraps, and fits |
| Type 9 + five Growth lines (1085.88px) | D1 spill | **red** |
| …its PDF | page count vs `v3PagesFor` | **red** (13 ≠ 12); the unspilled PDF reads exactly 12 |
| A 4px padding change the model doesn't know | D1 model | **red**, while the page still fits |
| A long-name pass whose header stayed one line | D1 reserve | **red** |
| A rail that stops short of its card | D2 | **red** |
| A missing card | D2 | **red** |
| An unbreakable URL past its column | D2 sideways | **red** — and D1 alone stays quiet, which is why D2 checks it |
| An experiment label that lost its bold | D3 | **red** |
| A bold label without its colon | D3 | **red** |
| Bold leaking into Growth Strategies | D3 | **red** |
| A per-type rail description | D4 on the page, and across renders | **red**, both |
| A pre-canon plural in the H1 | D4 | **red** |
| Sheet 11 frozen to a fixed height | shell probe, and D1's model | **red**, both |

Plus **9 pure tests** (`tests/devideas_fit_test.js`) driving every judge on synthetic probes. They
caught a real bug in the first draft: the model took an item count, was handed the probe's item
array, computed `NaN`, and **the drift check could never fail** (`NaN` compares false). Fixed before
the commit, and an uncomputable model now fails loudly — which the tests also assert.

## 3. Predictions against measurement

| # | Predicted | Measured |
|---|---|---|
| B1.1a | Sheet 11 heights as the prototype | **All nine, to the hundredth** |
| B1.1b | Model Δ 0.00 on every render | **0.00 on all nine** |
| B1.1c | Long-name +11.00px, Type 9 tightest at 82.87px | **+11.00 on all nine; 82.87px** |
| B1.2a | 12 logical / 12 PDF sheets per v3 render, Z6 spill 13 | **34 × 12, 1 × 13** |
| B1.2b | Every other v3 sheet byte-identical; only the head's CSS changes | **Confirmed** on all ten reference renders: the head gains 26 lines and loses none |
| B1.2c | v2 client and coach byte-identical | **Byte-identical**; coach baseline green |
| B1.2d | The `‘` fix byte-identical | **All 14 renders byte-identical** |
| B1.3 | The hard-coded 11 passes a spill control without a spill | **Confirmed**: an unspilled 12-page PDF went red against 11 |
| B1.4 | `npm test` 45/45 | **53/53 — missed**, see §5 |

## 4. Global gates

Run with absolute paths, once on `4382369` before any edit, once on the finished branch:

| Gate | Base | B1 |
|---|---|---|
| `npm test` | 44/44 | **53/53** (+9: `devideas_fit_test.js`; `report_pages_test.js` at 127 assertions) |
| `npm run verify:render` | ALL PASSED · 58s | **ALL PASSED · 68s** (+10s: the nine long-name passes) |
| `verify_quickref_fit.js` | 18/18 | **19/19** (+1 quiet control, §5) · sheet 5 unchanged at 51.61–73.86px free |
| `verify_devideas_fit.js` | — | **19/19** (new CI step) |
| `verify_diagrams.js` | pass | **pass** |
| `verify_transparency.js` | pass | **pass** — the new CSS emits no transparency |
| `verify_coach_baseline.js` | pass (HTML; PDF off-Linux) | **pass** (same; CI runs the PDF half) |
| `verify_content_library.js` | 2264 / 1316 / 948 | **unchanged** |

`check_docs.py` is clean on every doc this build wrote or edited. `client_report_v3_build_plan.md`
carries 8 dangling references, identical in count and list to base — pre-existing, untouched.

## 5. Deviations from the plan

1. **D-B2 reserves a wrapped header, not a 70-character name.** Measured on the branch, a 70-character
   name does not wrap the header on any type with ordinary letters — wrapping begins at 72–78
   characters depending on the type's name and the letters in the name. A character count is the
   proxy spec §6 keeps striking, so the fixture is an 82-character name that wraps on all nine, and
   `judgeD1` fails any long-name pass whose header did **not** wrap. The reserve is the intent; the
   number was mine, and wrong.
2. **`npm test` is 53, not the predicted 45.** `node --test` counts tests inside a file, not files, and the
   new file carries 9. The prediction's premise was wrong, not the build.
3. **Sheet 5's PDF-spill control was fixed in this build.** Not in the plan; it surfaced while writing
   the predictions (B1.3) and would have been left testing nothing the moment sheet 11 was built. It
   now derives the count, and a new quiet control makes a stale count fail — proved by restoring 11.
4. **`retypeFixture` moved to `scripts/lib/`.** Not in the plan. The controls were about to become a
   fourth copy of the recipe (Build A §7.5 named three); one shared function now, body unchanged.
5. **D1 decides with `natural > 1056`**, where `enforceSheet` uses `rendered > 1057`. D1 is stricter by
   up to a pixel, deliberately: it is the definition B2's gate will use, and the two agree on every
   render today.

## 6. What holds by construction, and what waits for B2

- **C1** — by construction for library content: CI measures all nine on every PR, with the reserve.
  **CMS edits cannot reach sheet 11 yet**; the gate that must accompany editability is B2's.
- **C2** — one card function; D2 asserts shape, stretch, alignment and sideways overflow.
- **C3** — the renderer writes the bold and the colon; D3 asserts it on every render.
- **C4** — the builder reads shared strings only from `static` via the model; D4 asserts them per page
  and across every render.

## 7. New risks surfaced

1. **A long client name wraps the header's brand as well as the name.** Visible in
   `docs/pr6_smoke/sheet11_type9_long_name.png`: "INSIGHTOUT ENNEAGRAM REPORT" breaks onto two lines
   beside the wrapped name. The header still measures two lines (22px), so the reserve holds — but it
   looks broken, it is **report-wide chrome on every v3 page**, and it predates this build. The likely
   fix, `white-space:nowrap` on the shared `.header-left`, changes every page for long names, so it is
   not taken here. A three-line header (a name of roughly 150+ characters) is not reserved.
2. **The model constants will turn D1 red on any global copy change.** That is the design — the design spec §6.3
   guidance must move with them — but the uniformity pass or a lead/closing-note edit will surprise
   whoever makes it. The failure message names the file and the section to update.
3. **B2 must not let CMS edits of global copy invalidate the guidance silently.** A CMS edit to the
   lead or a rail description changes the page without passing CI, so the constants in design spec §6.3 stop
   describing it. B2's gate measures the real page and is unaffected; the guidance is what drifts.
4. **These numbers are macOS.** Liberation Sans on Linux CI is metric-compatible and the mockup's
   Linux figures matched to 0.5px, but the first CI run of this branch is the confirmation.
5. **`verify:render` is 10s slower** (68s): the long-name pass.

## 8. What B2 inherits

- `app/devideas_fit.js` exports `PROBE`, `SHEET_SEL`, the judges, `spills()`, `modelHeight()`,
  `MODEL` and `LONG_NAME`. The gate should render each affected type with `LONG_NAME`, and decide
  with `judgeD1({ longName: true })` plus `judgeD2` for sideways overflow — the same code CI runs.
- `verify_devideas_fit.js` is where the gate's own red controls go, through the real gate.
- Sheet 11's height depends only on the type's `devideas_v3`, the four `static.devideas_*_v3` strings
  and the client's name — the property that lets B2's gate cover it completely.
- The smoke sheet regenerates with `node scripts/smoke_sheet11.js`.
