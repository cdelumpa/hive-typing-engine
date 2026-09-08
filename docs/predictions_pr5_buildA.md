# PR 5 · Build A — Predictions, committed BEFORE building

**Branch** `pr5-buildA-content-model`. **Base** `2c4dbb3` (main, clean).
**Written** 8 Sep 2026, before any file was edited. A deviation is a finding, reported as a
deviation in the build report — not quietly corrected here.

**Section references.** Every `§N` below names a section of `docs/audit_pr5_quickref.md`.

**Scope.** Content and model for sheet 5. **No page renders.** No builder, no `built` flag, no
`PAGE_INVENTORY` bump.

## Basis note

Gate timings are predicted **from the last measured run**, named per row, not estimated. Estimates
on this PR have run high 4 times out of 4; this section predicts from measurement or not at all.

## A0 — the shape, decided before building

`overrideShape` (`app/content_overrides.js:79`) collapses every array to `prefix[]` and does **not**
track length. `[MEASURED]` — read from the function. So an array field can **grow** without tripping
`assertOverrideShape`, while adding an **object key** trips it. That decides the shape:

- **Flat sibling `static.*_v3` keys**, one per CMS-editable unit — the convention
  `build_content_library.js:1368` states for `static.instinct_definitions_v3` ("a second flat
  sibling, which stays consistent with this"). A future field is a new sibling, never a new leaf.
- **The four tips as one array**, because arrays may grow safely.
- **`subtype_<code>.quickref_v3 = { summary }`**, a new sibling object on the subtype row.

## A1 — the count reconciliation (§2.1)

| # | Prediction | Value |
|---|---|---|
| A1.1 | The true count of sheet-5 strings that need a content home and have none | **12** |
| A1.2 | "Eight" was wrong, and so was "eleven" | **both wrong** |
| A1.3 | The string that falls between the counts — stored by neither | **the second `<h2>`, "Tips for Debriefing This Report with Your Coach"**. The audit's eleven counted one H2; the mockup has two. |

## A2 — leaves and keys

Baseline `[MEASURED]`, printed by `verify_content_library.js` at `2c4dbb3`: **2069 total leaves ·
1316 Word-canonical · 753 from `INTERIM_*`**.

| # | Prediction | Value | Basis |
|---|---|---|---|
| A2.1 | New leaves | **39** | `[DERIVED]` 27 summaries + lead 1 + h2 1 + zone8 1 + tips 4 + labels 5 |
| A2.2 | `INTERIM_*` leaves after | **792** | 753 + 39 |
| A2.3 | Total leaves after | **2108** | 2069 + 39 |
| A2.4 | Word-canonical after | **1316**, unchanged | none of the 39 come from Word |
| A2.5 | New top-level `content_library.json` keys | **0** | all 39 are fields on existing `static` / `subtype_*` objects |
| A2.6 | New `static.*` keys | **5** | `quickref_lead_v3`, `quickref_h2_v3`, `quickref_zone8_v3`, `quickref_tips_v3`, `quickref_labels_v3` |
| A2.7 | New `subtype_*.quickref_v3` objects | **27** | one per subtype |

## A3 — files

| # | Prediction | Value |
|---|---|---|
| A3.1 | Files touched | **6** |
| A3.2 | Which | `scripts/build_content_library.js`, `app/content/content_library.json` (rebuilt, never hand-edited), `app/report_prep.js`, `app/server.js`, `docs/build_pr5_buildA.md`, this file |
| A3.3 | `app/renderer.js` touched | **NO** — no builder, no `built` flag |
| A3.4 | `tests/lib/report_page_inventory.js` touched | **NO** — Build B |
| A3.5 | Mockup touched | **NO** — blob stays `813e871` |

## A4 — gates, predicted from the last measured run

| Gate | Last measured | Predicted here | Why |
|---|---|---|---|
| `verify_content_library.js` | **0.20 / 0.22 s**, two runs at `2c4dbb3` today | **0.25 s** | 39 more leaves to compare; marginal |
| `npm test` | **0.31 s** (audit §25.2) | **0.35 s** | model slot added, no page emitted |
| `npm run verify:render` | **52.53 s** (audit §25.2) | **53 s** | 32 renders, unchanged count |
| `verify_diagrams.js` | **0.95 s** (audit §25.2) | **0.95 s** | untouched |
| `verify_transparency.js` | **2.89 s** (audit §25.2) | **2.89 s** | untouched |
| `verify_coach_baseline.js` | **2.85 s** (audit §25.2) | **2.85 s** | untouched |

| # | Prediction | Value |
|---|---|---|
| A4.1 | Rendered v3 output is **byte-identical** to `2c4dbb3` across all 32 renders | **yes** — nothing reads the new slot |
| A4.2 | `verify_coach_baseline.js` applies | **No.** Coach path untouched. Run off-Linux it is a **HALF-RESULT**, not a pass. |
| A4.3 | All six gates green | **yes** |

## A5 — SO8's quote form

| # | Prediction | Value |
|---|---|---|
| A5.1 | Committed form | **straight `U+0022`**, as supplied in the Build A prompt |
| A5.2 | The build script normalises it | **No** — prediction; to be verified against the script's own quote handling, not assumed |
| A5.3 | Slack in the committed form | **0.31 px** against the 308.00 px box `[MEASURED, audit §26–§27]` — the tightest in the set |

## A6 — the provenance gap (§9)

| # | Prediction | Value |
|---|---|---|
| A6.1 | Committing client prose via `INTERIM_*` is consistent with the repo | **yes** — `INTERIM_INSTINCTS_V3` already carries all 27 subtype narratives as committed prose |
| A6.2 | There is a convention the Build A prompt does not account for | **yes — provenance by source-document ID.** Every `INTERIM_*` block naming client prose cites a Google Doc by ID and states a recount ("Read and recounted 7 Sep 2026 … Recount at every re-ingest anyway"). The 27 summaries have **no source doc**; they arrived in a chat prompt. |
| A6.3 | Response | Record provenance honestly as the Build A prompt + date + DRAFT status. **Do not invent a Doc ID.** Recount all 27 and state the basis. |

## Post-commit

This commit moves the head from `2c4dbb3`. Every number above was fixed before it.
