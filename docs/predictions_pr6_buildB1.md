# PR 6 · Build B1 — Predictions, committed BEFORE building

**Branch** `pr6-buildB1-page`. **Base** `4382369` (confirmed equal to `origin/main`). **Written**
before any file was edited. A deviation is a finding, reported in the build report — not quietly
corrected here.

**Plan of record:** the Build B audit (artifact `9df2ba58`), B1 only — the page. **Sheet 11 is not
made CMS-editable in B1**: no allowlist, preview or gate change. That is B2.

## Baseline `[MEASURED]` on `4382369`, before any edit

All seven CI gates green: `npm test` 44/44 · `verify:render` ALL PASSED (58s) · quickref fit ·
diagrams · transparency · coach baseline (HTML; PDF half off-Linux) · content library
(2264 / 1316 / 948). v3 renders: 11 logical pages and 11 PDF sheets, except the one declared Z6
spill state at 12.

## B1.1 — the page, measured (prototype on `4382369`, the planned builder over the real model)

Natural height of sheet 11, `Anders Wennerstrom` in the header:

| Type | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| natural px | 950.13 | 893.88 | 893.88 | 912.63 | 893.88 | 850.38 | 900.63 | 918.63 | **962.13** |
| spare px | 105.87 | 162.12 | 162.12 | 143.37 | 162.12 | 205.62 | 155.37 | 137.37 | **93.87** |

| # | Prediction |
|---|---|
| B1.1a | The committed builder reproduces these to the hundredth — the prototype *is* the planned builder. |
| B1.1b | The model `368.88 + Σ max(108.02, 32 + 18.75·lines + 6·(items − 1))` equals the measurement on every render, Δ 0.00. |
| B1.1c | **The long-name pass adds exactly 11.00px on all nine types** (a two-line header), so Type 9 is tightest at **82.87px** spare. |

## B1.2 — what the document does

| # | Prediction |
|---|---|
| B1.2a | Every v3 render is **12 logical pages and 12 PDF sheets**; the declared Z6 spill state reads 13. |
| B1.2b | Every other v3 sheet is byte-identical to base. The only other change is the stylesheet in `<head>`, which gains the `v3-di-*` rules. |
| B1.2c | The v2 client and coach reports are byte-identical; the coach baseline passes. |
| B1.2d | The `‘` fix to `_v3Straighten` is byte-identical on every render — the library holds no U+2018. |

## B1.3 — a latent gate defect this build must fix

`verify_quickref_fit.js`'s PDF-spill control hard-codes **11** as the document's page count. Once
sheet 11 is built, an *unspilled* v3 document is 12 pages, so `checkPageCount(pdf, 11)` goes red
with no spill at all — the control would keep "passing" while testing nothing. **Predicted:** with
sheet 11 built and the literal left in place, the control stays green even when the spill injection
is removed. The fix derives the count from `v3PagesFor`.

## B1.4 — gates after the build

`npm test` **45 / 45** (one new file: the sheet 11 judges' pure tests). `verify:render`,
quickref fit (18 controls), diagrams, transparency, coach baseline and the content library all
green, and the content library unchanged at 2264 / 1316 / 948. The new
`verify_devideas_fit.js` step passes with every control behaving as required.
