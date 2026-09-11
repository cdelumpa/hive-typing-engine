# PR 6 · Build A — Predictions, committed BEFORE building

**Branch** `pr6-buildA-content-model`. **Base** `c7a3697` (main, confirmed current against
`origin/main` on 10 Sep 2026). **Written** before any file was edited. A deviation is a finding,
reported as a deviation in the build report — not quietly corrected here.

**Plan of record:** the PR 6 audit (artifact `056cc492`), Build A — content and model for sheet 11.
**No page renders.** No builder, no `built` flag, no `PAGE_INVENTORY` bump — Build B's, all three.

## Baseline `[MEASURED]` on `c7a3697`, before any edit

| Gate | Result | Time |
|---|---|---|
| `npm test` | 44 / 44 | <1s |
| `npm run verify:render` | ALL PASSED · client_v3 11 logical pages, 11 PDF sheets | 58s |
| `verify_quickref_fit.js` | pass | 1s |
| `verify_diagrams.js` | pass | 1s |
| `verify_transparency.js` | pass | 8s |
| `verify_coach_baseline.js` | pass | 3s |
| `verify_content_library.js` | pass · **2121 leaves · 1316 Word-canonical · 805 INTERIM** | <1s |

Sheet 2 (Contents) **93.88px** free and sheet 12 (Your Thoughts) **55.39px** free, identical on
every v3 render.

## A1 — leaves

Per-type leaf count is `growth + inquiries + 2 × experiments`, from the nine source docs
(unchanged since extraction — every `modifiedTime` re-checked before building):

| Type | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| items G/I/E | 5/4/3 | 5/4/3 | 5/4/3 | 6/3/3 | 5/4/3 | 5/3/3 | 4/3/3 | 6/4/3 | 7/4/3 |
| leaves | 15 | 15 | 15 | 15 | 15 | 14 | 13 | 16 | 17 |

| # | Prediction | Value |
|---|---|---|
| A1.1 | New per-type leaves | **135** |
| A1.2 | New static leaves (3 titles + 3 rail descriptions + lead + coda) | **8** |
| A1.3 | Total leaves | 2121 → **2264** |
| A1.4 | From `INTERIM_*` | 805 → **948** |
| A1.5 | Word-canonical | **1316, unchanged** — purely additive, and the two copy changes edit leaves that are already script-sourced |

If A1.4 prints 805 + 135 = 940 or any figure other than 948, a `SCRIPT_SOURCED` row is missing —
the silent failure PR 5 Build A recorded.

## A2 — what renders differently

| # | Prediction |
|---|---|
| A2.1 | Every v3 page is byte-identical to base **except sheet 2** (the Contents description) **and sheet 12** (prompt 3). |
| A2.2 | The v2 client report (sp4, sx7) and the coach report (sp4, sx7) are byte-identical; `verify_coach_baseline` passes. |
| A2.3 | Sheet 2 stays **93.88px** free — the new description is shorter than the old and stays one line. |
| A2.4 | Sheet 12 goes **55.39 → 36.55px** free on every render: prompt 3 wraps from one line to two (measured in the audit at 18.84px). |
| A2.5 | Still 11 logical pages and 11 PDF sheets per v3 render. Sheet 11 does not render. |

## A3 — the two tweaks

| # | Prediction |
|---|---|
| A3.1 | **Canonical names.** Types **3, 5, 6, 8** are the affected ones. The ingested list content names no type at all, so nothing in it needs correcting; the four pre-canon names appear only in the source docs' titles, headings and notes, which are not ingested. The only type name this build renders is the Contents row 08 title, and it reads Performers / Observers / Questioners / Protectors from `app/type_meta.js`. |
| A3.2 | **Apostrophes.** Zero curly quotes, curly apostrophes or ellipses in all 143 new strings, so `_v3Straighten` is a no-op on them. The build will assert this at ingest rather than rely on it. |

## A4 — gates after the build

`npm test` stays **44 / 44** (report_pages_test.js is one test file; its assertion count rises, the
test count does not). Every other gate passes, with times within a second or two of the baseline.
