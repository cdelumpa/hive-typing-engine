# PR — CMS override cleanup

**Branch:** `cms-override-cleanup` (off `main` @ `475942f`)
**Companion audit:** `docs/audit_pr3_per_type_pages.md` §9

---

## ⚠️ DEPLOY ORDER — read this before merging

`resolveContent` now **throws** on a shape mismatch. That throw reaches every render
including the dry-validate probe in `POST /api/submit`, so a mismatched row fails
**assessment submission**, not just a PDF — and `static.*` keys are global.

**The seven offending rows were already migrated and retired on 12 August 2026** (below), and
`npm run overrides:check` against production returns **exit 0, 0 published rows**. This PR is
therefore safe to deploy as it stands.

It will not stay safe by itself. Any future library change that alters an overridable field's
shape while a published override exists reproduces the hazard. The standing procedure is in
`README.md` → *"Deploying a content change — READ BEFORE SHIPPING"*, and the backstop is the
boxed warning `loadPublishedOverrides()` prints on every cache fill.

---

## What this PR does

The `content_overrides` table is a **fourth content source** alongside the docx, the compiled
library and the `INTERIM_*` constants. PR 1.5 reconciled the docx against
`content_library.json` and declared Word canonical; seven rows published 13–29 June 2026 sat
outside that reconciliation for seven weeks. Nothing could see them — every offline harness
renders with an empty override map, so the content-library, coach, render and transparency
gates were all green against output production would not produce.

| | |
|---|---|
| **`app/content_overrides.js`** | `resolveContent` compares the override's leaf-path set to the baseline's and throws `OverrideShapeError`, naming the key and both shapes. Array indices normalize to `[]`, so cardinality is not a mismatch. `loadPublishedOverrides` runs a loud, non-fatal audit on each cache fill. |
| **`tests/content_overrides_test.js`** + fixture | 11 cases, no database, in `npm test`. Recommendation 7 of `docs/client_report_test_coverage_audit_072326.md`, unactioned since 23 July. |
| **`scripts/overrides_check.js`** / `npm run overrides:check` | Pre-deploy gate. Exit 0 clean / 1 mismatch / **2 did-not-run**, so a missing `DATABASE_URL` can never read as green. |
| **`scripts/lib/override_banner.js`** | Every harness prints `overrides: N published` as a first-class line, not an error buried in noise. |
| **`scripts/retire_overrides.js`** | Dry-run by default; `--confirm` snapshots every column to a gitignored `.override_snapshots/` before deleting. |
| **`scripts/migrate_overrides_to_docx.js`** | One-time: moved the two kept edits into the Word source, paragraph-indexed, asserting the current text against the committed library before writing. |
| **`README.md`** | The standing deploy procedure. |

### Why a throw and not a merge

`resolveLibObject` replaces a field **whole**. An override published against an older library
silently drops any key the field has gained since. Measured: the June `static.welcome` row
predates the `signoff` key PR 2 added, and the v3 Welcome page rendered the literal word
**"undefined"** above the founder photos.

Deep-merging would marry June's `letters` to August's `signoff` — a combination nobody
reviewed and nobody can source — and would make the stale row permanently invisible, so
nothing ever prompts a cleanup. That is the 130-field drift mechanism applied to a new table.
A silent fallback is the same defect pointed the other way: a coach's edit stops applying and
nobody is told.

---

## The seven rows — disposition

Six of the seven carried a real edit, against a plan that assumed all seven were stale by
construction.

| Row | Disposition | Evidence |
|---|---|---|
| `static.primer.footer` | **MIGRATED** to the docx, then retired | before/after below |
| `subtype_sx9.tagline` | **MIGRATED** to the docx, then retired | before/after below |
| `static.welcome` | retired — Δ 0 chars vs the 18-Jun baseline, a publish with no edit | — |
| `static.wings_using` | retired — 4th bullet deleted; legacy p5 only, dies at PR 7 | — |
| `subtype_sp9.tagline` | retired — trailing period | — |
| `type_1.wings` | retired — `body` trims; v3 never reads `body` | — |
| `type_8.wings` | retired — `body` trim; v3 never reads `body` | — |

### Migration 1 — `static.primer.footer` (Cai: keep both URLs)

```
docx paragraph 1794, located as "the first body paragraph after the ENNEAGRAM PRIMER FOOTER label"

BEFORE (161ch)  "Each of us has access to all nine Enneagram types, and one of them is your
                 home base. Keep reading to find out which type your responses pointed to
                 most clearly."
AFTER  (141ch)  "For more detailed information on the Enneagram or each of the nine Enneagram
                 types, visit us at https://www.hiveleadership.com/the-enneagram."
```

### Migration 2 — `subtype_sx9.tagline` (Cai: keep "significant other")

```
docx paragraph 376, located as "the first body paragraph after the SX9 — heading"

BEFORE (55ch)   "The Seeker — peace through merging with a beloved other"
AFTER  (60ch)   "The Seeker — peace through merging with a significant other."
```

Both fields are Word-sourced (`ENNEAGRAM PRIMER FOOTER`; the paragraph after the `SX9 —`
heading), so the ordinary build carries them into the library. No `INTERIM_*` involved.

### Verification, in order

```
docx sha256   a28e8d0f0f3f8149…  →  3fb8e97128e7674b…   (_meta.source_sha256 matches)
build         2 changed, 0 removed, 0 added vs the committed library
invariant     committed library == build(Word source) ✓   ·  reproducible ✓
built values  static.primer.footer  ✓ carries the URL version
              subtype_sx9.tagline   ✓ carries "significant other."
controls      subtype_sp9.tagline unchanged · static.primer.intro still 495ch
six gates     all PASS
retire        snapshot 7 rows / 8799 bytes / all columns → deleted 7 rows
overrides:check  exit 0 — 0 published rows
```

The snapshot is at `.override_snapshots/content_overrides_2026-08-13T04-47-15-813Z.json`
(gitignored — production content, not source). Cai holds an independent copy.

---

## The design question, measured

Keeping the URL leaves page 4's footer pointing the reader **off** to the website, where the
original line handed them **forward** into their own results on the sheet before Quick
Reference. Can the footer carry both?

**Measured** (pinned Chromium 147, Arial probe 2378.81px, `.v3-wi-close`):

| Candidate | chars | lines | headroom | |
|---|---|---|---|---|
| current library (forward handoff) | 161 | 2 | 12.58px | fits |
| **override (URL only) — shipped** | 141 | 2 | **12.58px** | fits |
| both, concatenated | 303 | **3** | **−5.42px** | **spills** |
| both, condensed (illustrative) | 156 | 2 | 12.58px | fits |

One correction to the framing: the footer is a **2-line zone already**, not one line, so "one
extra line" means going to three — 18px against 12.58px of headroom.

**Concatenating both spills the sheet by 5.42px. A condensed sentence carrying both fits, at
the same 12.58px.** The room exists; the sentence is Mo's to write. Shipping the URL version
as decided — the condensed option is a one-paragraph docx change later with the fit already
measured.

---

## Gates

| Gate | Result |
|---|---|
| `npm test` (11 new cases) | PASS |
| `npm run verify:render` | PASS |
| `verify_diagrams` | PASS |
| `verify_transparency` | PASS |
| `verify_coach_baseline` | PASS |
| `verify_content_library` | PASS |
| `npm run overrides:check` (production) | PASS — 0 published rows |

`app/renderer.js` and `app/report_prep.js` are untouched, so the coach report cannot have
moved; the byte-identical baseline confirms it.

---

## Follow-ups, not in this PR

1. **The condensed footer** carrying both the URL and the forward handoff — Mo's copy, fit
   already measured.
2. **`word_count` in the CMS** is calibrated to a measure design spec §6 retired; the real
   ceilings are widths. Board card — `docs/audit_pr3_per_type_pages.md` §9.6.
3. **`type_N.center` and the superseded comms/conflict keys** remain orphaned; removal is
   already scheduled as a post-PR-7 follow-up.
