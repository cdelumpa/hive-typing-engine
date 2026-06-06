# Step 7 — Call #2 Field Delta (Phase 1 build target)

**Status:** Locked in Phase 0 (reconciliation spike). Approved by Cai.
**Purpose:** The authoritative list of what Phase 1 adds to AI Call #2, what it reuses
as-is, and what the prep layer reshapes — so Phase 1 changes the schema/prompt by the
**minimum** needed. Reconciled against `app/server.js` Call #2 schema (HEAD) and design
system v1.3 Parts B/C.

Settled decision #7: *Call #2 delta = reuse existing fields + ~3 genuinely new.* This
doc holds the engine to that.

---

## RULE 0 — Name authority (engine is source of truth)

> **Every displayed type/subtype name is derived from the engine number via `TYPE_NAMES`
> — never from the AI's `*_name` strings.**

- `hero.name` ← `TYPE_NAMES[confirmed_type]`; `alternate.name` ← `TYPE_NAMES[alternate_candidate]`;
  `hero.subtype_name` ← instinct+type lookup.
- The AI-emitted strings `confirmed_type_name`, `section6.pushes_back.alt_type_name`,
  `section4.subtype_name` are **reasoning context only**. The prep layer MUST NOT render
  them. The prep layer SHOULD assert the AI string agrees with the derived name and
  **flag drift** (do not silently render the AI's version).
- Rationale: the AI has been observed echoing stale labels (e.g. "Type 4 — The Romantic").
  Deriving from the number makes name drift structurally impossible in the output.
- Enforced by `resolveTypeMeta(n)` in `report_prep.js`, which keys names off `TYPE_NAMES[n]`.

---

## Bucket 1 — Reuse as-is (already emitted; prep reads directly, no schema change)

`confirmed_type`, `confidence_level`, `leading_candidate`, `alternate_candidate`,
`call1_ranking[]`, `instinct_score_profile`, `dominant_instinct_hypothesis`,
`redirect_from_type`, `stage4_outcome`.

> `confirmed_type_name` is **NOT** in this bucket — see Rule 0 (derived, not trusted).

## Bucket 2 — Derived from engine (names; prep computes, AI string ignored)

`hero.name`, `alternate.name`, `hero.subtype_name`, and any type/subtype name embedded
in the reshaped `comparison` / `debrief` blocks. Source = `TYPE_NAMES` + subtype lookup.

## Bucket 3 — Reuse by reshape (already emitted; prep transforms, NO schema change)

| Template target | Source field (Call #2) | Reshape |
|---|---|---|
| `responses_revealed[]` (coach P1) | `coach_report.section2.what_responses_showed` | → ≤6 `{bold_lead, body}` |
| `debrief.subtype` (coach P3) | `coach_report.section4` | → `{question, bullets[]}` |
| `debrief.lines` (coach P3) | `coach_report.section5` (stress/security notes + probes) | → `{question, bullets[]}` |
| `debrief.wings` (coach P3) | `coach_report.section5.wings_notes` (+ probe) | → `{question, bullets[]}` |
| `comparison.discriminator` (coach P2 / client P3) | `coach_report.section6.pushes_back.key_distinction` | direct (1 sentence) |
| `comparison.note` (coach P2 callout) | `coach_report.section6.pushes_back` (key_distinction + alt signal) | short callout line |
| client P3 alternate-type note | `client_facing.secondary_type_narrative` | direct (≤40 words; null if none) |

> **Discriminator decision (locked):** `comparison.discriminator` AND `comparison.note`
> **reuse** `section6.pushes_back.key_distinction`. **No 4th new AI field is added.**
> (B8 once tagged `discriminator` "AI new"; superseded — reuse wins.)

## Bucket 4 — Genuinely new (Phase 1 schema + prompt additions) — EXACTLY 3

| # | New field | Serves | Shape / budget | Notes |
|---|---|---|---|---|
| 1 | `bottom_line` | Coach P1 "THE BOTTOM LINE" | string, 1 short paragraph (~2–3 sentences) | Plain-English summary. No jargon, no scores. Proposed location: `coach_report.bottom_line`. |
| 2 | `client_words` | Coach P2 "In [Client]'s Words" row + Client P3 "In Your Own Words" | `{ leading_quotes: [<verbatim>, ...1–2], alternate_absence_note: <string> }`; quotes ≤60 words total | **Verbatim selection from `responses_snapshot`** — AI selects, NEVER edits the quote. `leading_quotes` shared by both reports; `alternate_absence_note` is coach-P2 alternate-column only. |
| 3 | `instinct_evidence` | Client P6 "In Your Responses" orange box | `[<string>, <string>, <string>]`, ≤25 words/bullet | Client-specific instinct evidence drawn from `responses_snapshot`. Proposed location: `client_facing.instinct_evidence`. |

> Field placement (which object each lands in) is finalized when the schema is written in
> Phase 1; the *count* (3) and *purpose* are locked here.

---

## Carry-over verifications (confirm during Phase 1 / Phase 4 — not new fields)

1. **`gap` → `near_tie`.** `gap` (tight/medium/wide) is **NOT** in the Call #2 `hypothesis`
   schema; it rides in the `scores` payload from `app.js`. `near_tie = (gap === "tight")`
   is derived in prep (Phase 4). Confirm `gap` reaches the stored result — either prep reads
   it from the scores record, or the server stamps it onto `hypothesis` the way
   `ranking_override` is stamped. Fixtures currently emit `"wide"`.
2. **`responses_snapshot` reaches prep.** Confirmed present in the `/api/submit` payload
   (`buildResponsesSnapshot()` in `app/public/app.js`) and written by `db.js`. Prep reads
   the DB column. New fields #2/#3 depend on it.
3. **Instinct read.** Prep reads `dominant_instinct_hypothesis` (NOT `confirmed_instinct`);
   renderer read-path corrected in Phase 0 (Step C).

## Phase 1 verification (from step7_plan.md)

Re-run the Step 6d capture for sp4/sx7; assert the 3 new fields are present and stable
across 2 runs; assert no name drift (Rule 0 holds — derived names == AI `*_name` strings,
or drift is flagged).
