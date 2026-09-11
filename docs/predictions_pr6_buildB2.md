# PR 6 · Build B2 — Predictions, committed BEFORE building

**Branch** `pr6-buildB2-cms-gate`. **Base** `c234700` (confirmed equal to `origin/main`). **Written**
before any file was edited. A deviation is a finding, reported in the build report — not quietly
corrected here.

**Plan of record:** the Build B2 audit (artifact `9d0b2214`), with B2-1 (the write routes move into
`app/cms_write.js`) and B2-2 (the boot audit alerts through `sendErrorNotification`'s SendGrid channel)
decided. Sheet 11 becomes CMS-editable **in the same build** as the gate that guards it.

## Baseline `[MEASURED]` on `c234700`, before any edit

All eight CI gates green: `npm test` 53/53 · `verify:render` ALL PASSED (67s) · sheet 5 controls
19/19 · sheet 11 controls 19/19 · diagrams · transparency · coach baseline · content library
2264 / 1316 / 948.

## B2.1 — nothing that renders changes

| # | Prediction |
|---|---|
| B2.1a | Every reference render is **byte-identical** to base: nine v3 types, sp4 v3, v2 client ×2, coach ×2. B2 changes no renderer and no default model path; `buildClientModel`'s new `overrides` parameter is optional and absent everywhere it is called today. |
| B2.1b | The content library is **byte-identical** after `validateDevIdeas` moves into `app/devideas_rules.js`, and Build A's 13 build-validation controls still behave 13/13. |
| B2.1c | `verify:render`, both control scripts, diagrams, transparency and the coach baseline all pass unchanged. |

## B2.2 — the gate, committed, reproduces the audit

Through the committed `guardedWrite`, real renderer, 82-character name — the audit's §7 table to the
hundredth:

| Case | Verdict | Worst page |
|---|---|---|
| Type 9 published unchanged | allow | 973.13 |
| Type 9 + 3 one-line Growth items | allow | 1047.38 |
| Type 9 + 4 one-line Growth items | block, 1 line over | 1072.13 |
| Type 9 + 3 two-line inquiries | block, 3 lines over | 1103.63 |
| An unbreakable URL on Type 3 | block, 75.6px past its column | — |
| Lead + one sentence | allow | 994.81 |
| That lead edit after Type 9 + 3 lines is live | block, 1 line over | 1069.06 |
| A bigger lead with a shortened Type 9 live | allow (Type 1 tightest) | 1047.88 |
| Save draft / revert on that Type 9 | block, 1 line over | 1059.88 |
| Revert the lead instead | allow | 961.13 |
| Save draft on a key that is not live | allow, no render | — |
| Half-blank experiment · colon in a label · a list blanked to empty | block at validation | — |
| An extra `note` key on an experiment | block, **as a shape error** (the audit's wording defect, fixed) | — |
| A database read error · the browser cannot start | block, nothing saved | — |

## B2.3 — coverage and the strict reader

| # | Prediction |
|---|---|
| B2.3a | Of the 44 library fields on `type_9`, `subtype_sx9` and `static` with a mutable string, **39 leave sheet 11 byte-identical**; the 5 that move it are the four gated keys and `static.devideas_titles_v3`, which stays out of `CMS_STATIC_FIELDS`. |
| B2.3b | The strict reader and the existing lenient one **share one fetch-and-parse path and one cache**; they differ only in what happens when the query fails. |

## B2.4 — gates after the build

`npm test` rises by exactly the new `test()` calls, all passing; the only existing test edited is
`cms_quickref_preview_test.js`'s P1, which must accept keys `app/cms_devideas.js` previews. Sheet 11's
control script gains the gate's controls and passes them all.
