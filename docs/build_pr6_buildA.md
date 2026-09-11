# PR 6 · Build A — content and model for sheet 11

**Branch** `pr6-buildA-content-model`, base **`c7a3697`** (confirmed equal to `origin/main` before
branching). Predictions committed first at **`0775d96`**, before any file was edited. **No page
renders.** No builder, no `built` flag, no `PAGE_INVENTORY` bump — those are Build B's.

**Status: COMPLETE ON THE BRANCH, NOT PUSHED.** Five commits, all seven CI gates green locally,
every prediction met. Paused for review, as instructed.

| Commit | Step |
|---|---|
| `0775d96` | Predictions, committed before building |
| `4aea475` | Sheet 11 content: nine types, the static strings, and their validation |
| `74594d7` | Sheet 11 model: `pages.v3_devideas`, three sections of one shape |
| `1e27771` | Contents entry 08 describes the new sheet 11 (p2) |
| `41a6689` | Your Thoughts prompt 3: the ratified wording, guarded by page order (p12) |

## 1. The two tweaks

### 1.1 Canonical type names — Types 3, 5, 6 and 8, sourced from the engine

**Affected types: 3, 5, 6 and 8.** The canonical names are **the Performer, the Observer, the
Questioner and the Protector**, so the page title reads *Development Ideas for Performers /
Observers / Questioners / Protectors*. The pre-canon names are Achiever, Investigator, Loyal
Skeptic and Challenger.

**Sourced from, in order of authority, all of which agree:**

1. `app/type_meta.js` `TYPE_NAMES` — the name source every report page renders from.
2. `app/server.js:4607–4613`, the Call #2 prompt's list headed **"CANONICAL TYPE AND SUBTYPE
   NAMES"**, which also forbids "The Challenger" by name at `:4625`.
3. Both `type_library.json` copies (`app/`, `content/`) and every `type_N.name` in the content
   library.
4. Design spec §4.1's "name of record" column.

**⚠ The nine source docs assert the opposite, and the reason is outside this repo.** The notes in
the Type 3, 5, 6 and 8 docs read *"the canon name in the current type library is 'The
Achiever'"* (and so on). That is false against every type library here. The cause is already on
record in `docs/hive_insightout_wings_content_all_types_081226_r2_verified.md:45`: *"The project
copy of type_library.json still carries the old archetype names — Achiever, Investigator, Loyal
Skeptic, Challenger. The repo copy is correct."* The docs were generated against that stale
project copy. **Recommend replacing the Claude AI project's `type_library.json` with the repo's**,
or the next generated doc will repeat the claim.

**What this build did about it:**

- **Nothing ingested carries a type name.** The 108 list items name no type. The pre-canon names
  appear only in the docs' titles, section headings and notes, and none of those are ingested.
- **The only type name Build A renders** is the Contents row 08 title, which already derives from
  `TYPE_NAMES` through `{nickname_plural}`. Build B's H1 uses the same token. No name table was
  ported.
- **Made structural, not conventional.** `validateDevIdeas` fails the build if any of the four
  pre-canon names (singular or plural) appears anywhere in sheet 11's content, per-type or static.
  `report_pages_test.js` renders all nine types and asserts each Contents row reads the canonical
  plural (written out literally, not derived from `TYPE_NAMES`, which would pass whatever
  `TYPE_NAMES` said). It also asserts no pre-canon name reaches the model or the rendered page.
  Both proved red (§4).

### 1.2 Apostrophe conversion — a clean pass for the new content, one pre-existing gap

**Clean pass.** All **143** new strings go through the real `_v3Straighten` **unchanged: 0 of 143
altered.** Measured by loading `app/renderer.js`'s own function, not a copy of it. The source docs
carry **no** curly quotes, curly apostrophes or ellipses (checked in all three Drive exports), and
the content library as a whole carries none either.

**Straight at ingest, straightened again at render.** The library stores straight forms, and
`validateDevIdeas` now *asserts* it — a curly quote in sheet 11's content fails the build (proved
red). That is the p6/p7 rule: the transform moved to ingest, so it can be asserted rather than
relied on. At render, Build B's builder passes every string through `_v3t` like every other v3
zone. The 5 strings carrying a straight apostrophe come out as `&#039;`, the same as elsewhere,
and hyphenated compounds such as "self-worth" get the same no-break protection. `_v3t` is what
covers a CMS edit, since overrides are never validated at ingest.

**⚠ The gap, pre-existing and report-wide.** `_v3Straighten` (`renderer.js:3629`) converts
`’ “ ” …` but **not `‘` (U+2018, the opening single quote).** A CMS edit typed with smart quotes
as `‘what is’` renders as `‘what is'`: curly open, straight close. Measured on the real function.
It affects every v3 page equally, not just sheet 11, and no content in the library triggers it
today. **Not fixed here**, because it is a renderer change outside Build A's scope. The fix is one
character class, and it is byte-identical for all current content, since the library has zero
U+2018. Recommend it as its own small commit, in Build B or separately.

## 2. Files changed

| File | Change |
|---|---|
| `scripts/build_content_library.js` | `INTERIM_DEVIDEAS_V3` (nine types, 108 items) and `INTERIM_DEVIDEAS_STATIC_V3` (3 titles, 3 rails, lead, coda); `validateDevIdeas` + static checks; the Contents `car` descriptor; Your Thoughts prompt 3 and its comment |
| `app/content/content_library.json` | Regenerated. +143 leaves at `type_N.devideas_v3` and four `static.devideas_*_v3` siblings; two leaves changed (p2, p12) |
| `scripts/verify_content_library.js` | Five `SCRIPT_SOURCED` rows |
| `app/report_prep.js` | `devIdeas()` (exported) and `pages.v3_devideas` |
| `tests/report_pages_test.js` | Sheet 11 model contract for all nine types; the canonical plural in the page; `devIdeas()` unit checks; the p2 descriptor; the `car` → `thoughts` order |
| `docs/predictions_pr6_buildA.md`, this file | New |

**Key shape**, for Build B and C: `type_N.devideas_v3 = { growth: [string], inquiries: [string],
experiments: [{ label, body }] }`; `static.devideas_titles_v3` and `static.devideas_rails_v3` =
`{ growth, inquiries, experiments }`; `static.devideas_lead_v3`, `static.devideas_coda_v3`. The
model is `pages.v3_devideas = { lead, coda, sections: [{ key, title, desc, items }] × 3 }`, or
`null`.

## 3. Predictions against measurement

Every prediction in `docs/predictions_pr6_buildA.md` held.

| # | Predicted | Measured |
|---|---|---|
| A1.1–A1.2 | +135 per-type, +8 static leaves | **135 · 3 + 3 + 1 + 1** |
| A1.3 | 2121 → 2264 total | **2264** |
| A1.4 | 805 → 948 INTERIM | **948** — every `SCRIPT_SOURCED` row counted |
| A1.5 | Word-canonical unchanged at 1316 | **1316** |
| A2.1 | Only sheets 2 and 12 differ in the v3 render | **Exactly two text nodes differ**, on all 10 v3 renders (types 1–9 and sp4) |
| A2.2 | v2 client and coach byte-identical | **Byte-identical** (sp4, sx7); coach baseline green |
| A2.3 | Sheet 2 stays 93.88px free | **93.88px**, 35 of 35 renders |
| A2.4 | Sheet 12 55.39 → 36.55px free | **36.55px**, 35 of 35 renders |
| A2.5 | 11 logical pages and 11 PDF sheets | **Unchanged from base**: 34 renders at 11 sheets, 1 declared Z6 spill at 12, the same as base |
| A3.1 | Types 3/5/6/8; nothing in the content to correct | **Confirmed** (§1.1) |
| A3.2 | 0 curly forms; `_v3Straighten` a no-op | **0 of 143** (§1.2) |
| A4 | `npm test` 44/44 | **44/44** |

## 4. Evidence that the new checks work — every one watched failing

**`validateDevIdeas`, 13 controls, 13 behaved as expected.** The real build source was run from a
scratch copy with one mutation injected, writing to a scratch path. The committed library was
never touched.

| Mutation | Build result |
|---|---|
| none | green |
| Type 5's block deleted | `type_5.devideas_v3 missing — sheet 11 requires it for every type` |
| colon in a label | `… label "Assertiveness: Training" contains a colon — the renderer adds it` |
| 35-character label | `… label is 35 characters (max 30)` |
| curly apostrophe | `… contains a curly quote or ellipsis — sheet 11 stores straight forms` |
| "Achievers" in an inquiry | `… names a pre-canon type ("Achievers") — use TYPE_NAMES` |
| empty inquiries list | `… inquiries must be a non-empty list of non-empty strings, got 0` |
| blank growth item | `… growth must be a non-empty list of non-empty strings, got 4` |
| experiment without `body` | `… experiments[2] must be exactly { label, body }` |
| extra list key | `… keys are [growth, inquiries, experiments, notes] — want exactly …` |
| renamed rail key | `static.devideas_rails_v3 must be exactly { growth, inquiries, experiments }, all non-empty` |
| blank coda | `static.devideas_coda_v3 empty` |
| "Challengers" in a title | `static.devideas_titles_v3.growth names a pre-canon type ("Challengers")` |

**`report_pages_test.js`, three red runs.** Each run is a scratch copy of the test with one
in-memory defect:

| Defect | Result |
|---|---|
| `TYPE_NAMES[3] = 'The Achiever'` | the sheet 11 contract fails, naming type 3's plural *and* type 2, whose page renders type 3 as its alternate |
| Type 4's block deleted | fails: `type 4: v3_devideas is null` |
| `car` swapped with `instincts` in `V3_PAGE_ORDER` | the order assertion fails |

**What Build A holds of C1–C4, and what waits for Build B.** Build A holds them at the
**content and model** layer only:

- **C3:** `{label, body}` split, with no colon in a label. Enforced at build.
- **C4:** titles, rails, lead and coda are the same on all nine types. Asserted at the model;
  the builder has no per-type path to them.
- **C2:** one `sections` shape for all three.

**C1 is not measurable until the page renders.** One sheet per type, the D1–D4 assertions over
the rendered page, and their render-level red controls are Build B's.

## 5. Global gates

Each gate was run with absolute paths, once on `c7a3697` before any edit and once on `41a6689`:

| Gate | Base | Build A |
|---|---|---|
| `npm test` | 44/44 | **44/44** (`report_pages_test.js` 125 assertions, all passing) |
| `npm run verify:render` | ALL PASSED, 58s | **ALL PASSED, 58s**. The log is identical to base except the 35 sheet 12 rows (55.39 → 36.55px) and file-write lines |
| `verify_quickref_fit.js` | pass | **pass** |
| `verify_diagrams.js` | pass | **pass** |
| `verify_transparency.js` | pass | **pass** |
| `verify_coach_baseline.js` | pass (HTML; PDF half skipped off-Linux) | **pass** (same) — CI runs the PDF half |
| `verify_content_library.js` | 2121 / 1316 / 805 | **2264 / 1316 / 948**, reproducible, invariant holds |

`python3 scripts/check_docs.py` is clean on both new docs. CI reads no `.md` file.

## 6. Deviations from the plan

1. **D5 taken as (b).** "Everything else in your plan for Build A stands as proposed" was read as
   accepting the plan's recommendation, which was also the original brief's ratified request. The
   p12 change is **isolated in `41a6689`**, so option (a) is a one-commit revert.
2. **The A5 order assertion landed in Build A, not Build B.** The plan listed it under Build B,
   but the p12 wording that depends on it lands here, so the guard lands with it.
3. **`devIdeas()` is exported from `report_prep.js`,** which the plan did not mention, so the
   blank-item rule has a direct unit test rather than one reached only through a full model
   build.
4. **Red-control harnesses are not committed.** They ran from scratch space and their output is
   recorded in §4. The plan's committed red-control script, `verify_devideas_fit.js`, covers the
   render-level checks and is Build B's.

## 7. New risks surfaced

1. **The source docs misstate the canonical names** (§1.1). The build now rejects the four names in
   content, but the uniformity pass is done in docs whose own headers say the opposite. An editor
   who trusts a doc's note could ask for the page title to be "corrected" to the old names. Fix
   the project copy of `type_library.json`.
2. **The `‘` gap in `_v3Straighten`** (§1.2). It is report-wide, dormant today, and reached by any
   CMS edit typed with smart quotes.
3. **Between Build A and Build B, sheet 12's "previous page" points at sheet 10.** The v3 document
   skips unbuilt sheet 11, so in any v3 render taken before Build B, prompt 3's pointer is false.
   **Not client-facing:** production sends v2 until PR 7, and Your Thoughts is not
   CMS-previewable. Build B closes it by building sheet 11.
4. **Requiring `build_content_library.js` runs the build.** The script is an IIFE, so a syntax check
   by `require()` overwrites `content_library.json`. It was harmless here (the output was
   byte-identical) and is worth knowing: check syntax with `node --check` instead.
5. **The re-typing recipe now exists three times:** `scripts/render_client.js`, the new sheet 11
   block in `report_pages_test.js`, and the audit scratch. A shared fixture helper would stop
   them drifting. Not urgent.

## 8. What Build B inherits

- **Missing content:** `pages.v3_devideas` is `null` when a type has no block. `_clv3DevIdeas` must
  throw on it, the `_clv3TypeA` pattern.
- **Rendering the sections:** one card function per `sections[i]`. Titles and descriptions come
  from the section, never from a per-type path. `_v3t` goes on every string. Experiments render as
  `<b>${_v3t(label)}:</b> ${_v3t(body)}`.
- **The H1** is `_v3Title(m, 'car')`, the existing, unused helper, which fills in
  `{nickname_plural}`.
- **Uncovered content in the render:** the lists are unedited. Most Growth items have no terminal
  period, Type 2's third inquiry reads "receive give and love", and Types 6 and 8 each carry a
  spaced en dash. The renderer adds nothing; these are for the uniformity pass.
