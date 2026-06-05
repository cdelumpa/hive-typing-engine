# Step 7 Plan — InsightOut Reports

**Status:** Planning complete; ready to build. **Branch:** `typing-engine-v2`.
**Source specs:**
- `docs/V2 Design Documents/hive_insightout_report_design_system_v1_3.md` — authoritative build reference (Parts A/B/C). Supersedes §9.3/§9.4 of the older v2 design doc. Data contract (B8) reconciled against `typing-engine-v2` HEAD.
- `docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx` — static content library, v1 draft (9 types + 27 subtypes; Type 8 is the approved benchmark; rest awaits Mo review).

Each phase below is a single verified commit on `typing-engine-v2`.

---

## Settled decisions

1. **Engine type-names are the source of truth.** `TYPE_NAMES` (Improver / Giver / Performer / Individualist / Observer / Questioner / Enthusiast / Protector / Peacemaker). The content-library headings for types 1/3/4/6 ("Perfectionist / Achiever / Romantic / Loyal Skeptic") are stale hallucinated labels and get corrected in the docx in Phase 0. No engine change, no prep-layer name override.
2. **`active_wing` dropped.** Render both wings; never assert which is active. (`active_wing` was OPEN/uncaptured — removed from scope.)
3. **Static content is looked up at render time** (Option B, A9). Only the *personalized* AI output is persisted; static units are pulled fresh from the library on every render, so content edits never require re-running the AI.
4. **Prep layer = a new server-side module** (`app/report_prep.js`) between the stored AI result and `renderer.js`. `renderer.js` becomes pure presentation.
5. **Authoring surface = the `.docx`.** A build script parses it directly into the runtime store, so Word stays the single editing surface for Cai/Mo and handles smart-quote escaping.
6. **Runtime store = new `content/content_library.json`**, compiled from the docx (not an extension of `type_library.json`).
7. **Validation gate is split** (see "Risk note" below): word-count proxy from Phase 4; **real Puppeteer zone-measurement as a hard-fail gate from Phase 5**; only the automated regeneration loop defers to Phase 7.
8. **Call #2 delta = reuse existing fields + ~3 genuinely new** (see Phase 1).

### Risk note — why measurement is not deferred to the end
A8 bundles two mechanisms: (a) the **measurement check** (measure each zone's rendered height, hard-fail on overflow) and (b) the **automated regeneration loop** (halt → regenerate → re-measure). Deferring (a) is risky: word-count is a proxy (rendered height depends on font metrics, wrapping, bold runs, wide glyphs), and the measurement loop is what validates the word budgets that Mo's ~203 units are authored against — defer it and you risk a content/budget rework cascade discovered last. Deferring (b) is fine — it is a self-healing convenience, not a safety mechanism; until Phase 7, an overflow simply halts loudly and is fixed by hand. You cannot measure rendered height before a real template exists, so the earliest possible point is Phase 5 (first rendered template) — which is where the hard gate lands.

---

## Architecture

```
content_library.json ─┐
api_result (DB)       ─┼─► report_prep.js ─► renderer.js ─► Puppeteer ─► PDF
client + coach record ─┘   (assemble view-     (pure templates +
                            model @ render       buildEnneagramSVG +
                            time; validate)      bar charts)
```

Model / controller / view split: content library = static model; `report_prep.js` = assembly + transforms + validation; `renderer.js` = pure templating (including `buildEnneagramSVG`). The duplicate client-side report copy in `app/public/assessment.js` collapses into this in Phase 6 — the browser consumes the server view-model rather than re-implementing render logic.

---

## `report_prep.js` interface

```js
// app/report_prep.js — render-time assembly. Pure data, no HTML.
const library = require('../content/content_library.json');
const { TYPE_NAMES } = require('./constants');      // engine names = source of truth
const TYPE_META = require('./type_meta');           // A6 lookup: center, stress, security, wings

// apiResult: stored Call #2 result   client: DB assessment record   coach: provisioning record
function buildCoachModel({ apiResult, client, coach })  { /* → coachViewModel */ }
function buildClientModel({ apiResult, client, coach }) { /* → clientViewModel */ }

module.exports = { buildCoachModel, buildClientModel };
```

Shared helpers (Part A; used by both):
```js
lib(key)                     // library lookup; THROWS loudly if a key is missing (no silent drops)
resolveTypeMeta(n)           // { number, name: TYPE_NAMES[n], center, centerColor,
                             //   stressPoint, securityPoint, wings:[a,b] }  ← from TYPE_META
subtypeKey(instinct, n)      // 'subtype_so8'
typeBars(call1_ranking)      // [{type,score,color}] sorted 8,9,1,2,3,4,5,6,7  (COHERENCE, not sliders)
instinctBars(profile)        // [{code,score}] SP,SO,SX, all Hive-Orange
nearTie(gap)                 // gap === 'tight'
confidenceLabel(level)       // HIGH→'High', MEDIUM_HIGH→'Medium-High', ...
selectQuotes(snapshot, n)    // verbatim picks from responses_snapshot, never edited
validateModel(model, spec)   // required field present (empty string OK, null NOT); ints 0–100;
                             // word-count proxy; THROW/flag before render
```

View-model shape (coach, representative):
```js
{
  client:  { first_name, org, date },
  coach:   { full_name, type, instinct },
  hero:    { number, name, subtype_name, center, centerColor },   // confirmed_type (Call #2)
  confidence: { label, near_tie },                                // near_tie from gap==='tight'
  alternate:  { number, name },                                   // alternate_candidate
  svg:     { variant: 'type', type: heroNumber },                 // renderer calls buildEnneagramSVG
  charts:  { types: typeBars(...), instincts: instinctBars(...) },
  ataglance: { wings:[a,b], stress, release, center },            // TYPE_META + library
  bottom_line,                                                    // Call #2 (new)
  responses_revealed: [ {bold_lead, body}, ... ],                 // reshaped section2
  comparison: { rows:{...library...}, discriminator, note, client_words }, // lib + AI
  debrief: { subtype:{question,bullets}, lines:{...}, wings:{...} }         // reshaped section4/5/6
}
```

`renderer.js` receives this and renders only — including calling `buildEnneagramSVG({type, variant})` from `model.svg`. `validateModel` runs at the end of prep (word-count proxy); the Puppeteer measurement gate runs post-render from Phase 5.

---

## Content-library build-script workflow

```
InsightOut_Static_Content_Library_v1_060526.docx   ← Cai/Mo edit here (Word)
                    │
                    ▼   node scripts/build_content_library.js
        content/content_library.json                ← compiled runtime store (git-tracked)
                    │
                    ▼   require()
              report_prep.js  (render-time lookups)
```

`scripts/build_content_library.js` (Node):
1. **Parse** the docx by its heading convention. `Heading1 "Type N — Name"` opens a `type_{N}` namespace; ALL-CAPS labels map to keys; `Heading2 "Type N Subtypes"` → `subtype_{inst}{N}`:

   | Docx label | Key |
   |---|---|
   | HOW YOU SEE THE WORLD / CORE MOTIVATION | `type_{N}.description.{worldview,core_motivation}` |
   | PATTERN OF THINKING/FEELING/BEHAVING (+ `Inquiry:`) | `type_{N}.patterns.{thinking,feeling,behaving}.{intro,bullets[],inquiry}` |
   | WINGS | `type_{N}.wings.{wing_a,wing_b}` |
   | LINES — STRESS & SECURITY | `type_{N}.lines.{stress,security}` (+ `.resource_card`) |
   | STRENGTHS / CHALLENGES / PRACTICES THAT HELP | `type_{N}.{strengths[],challenges[],practices[]}` |
   | PUTTING IT ALL TOGETHER | `type_{N}.{communication,conflict,center}` |
   | COMPARISON ROWS | `type_{N}.comparison.{core_motivation,focus,energy,gifts,challenges}` |
   | SUBTYPE NARRATIVE / PATTERN BULLETS / WHAT SHIFTS | `subtype_{inst}{N}.{narrative,patterns.{...},shifts}` |

2. **Handles smart-quote escaping** automatically → removes the JSON-corruption trap; Word stays the editing surface.
3. **Validates coverage loudly** — all 9 types × required keys, all 27 subtypes × 3 blocks, all `static.*` units; fail on any missing/extra unit. Uses the `[word count: …]` annotations to flag budget overflow.
4. Writes `content/content_library.json`.

Parser details to confirm against the doc while building:
- `type_{N}.inquiry_lines` — the three appear inline as `Inquiry:` lines under each pattern; parser collects them.
- The 4 global `static.*` units (`static.primer`, `static.instinct_definitions`/`.instinct_primer`, `static.wings_primer`/`.lines_primer`, `static.welcome_body`) were not in the types/subtypes export — may need a small separate source block.

---

## Phases (each a commit)

- **Phase 0 — Reconciliation spike.** Correct content-library type names for 1/3/4/6 in the docx; lock the Call #2 field delta (Phase 1 set); fix the `confirmed_instinct → dominant_instinct_hypothesis` read in the existing path. *Verify:* names consistent; field list approved.
- **Phase 1 — Call #2 schema/prompt additions.** Add the small personalized set. **Reuse** where possible — `client_facing.secondary_type_narrative` → client P3 alt note; `section6.key_distinction` → `discriminator`/`note`; `section2.what_responses_showed` → `responses_revealed`. **Genuinely new:** `bottom_line`, verbatim `client_words` selection from `responses_snapshot`, P6 `instinct_evidence` (3 bullets). *Verify:* re-run Step 6d capture for sp4/sx7; new fields present + stable across 2 runs.
- **Phase 2 — Content build script + compiled store** (above). *Verify:* green coverage on all ~203 units.
- **Phase 3 — Part A shared library.** CSS variables (palette + type scale + the one Center-color object), `buildEnneagramSVG()` (3 variants), bar-chart functions. *Verify:* render all 3 SVG variants × 9 types + both charts in isolation in a browser.
- **Phase 4 — `report_prep.js`** + `validateModel` (word-count proxy). *Verify:* unit-test against sp4/sx7 `api_result` + library → both view-models fully populate, zero missing keys.
- **Phase 5 — Coach report (Part B, 3 pages)** consuming the coach view-model. **Introduce the real Puppeteer zone-measurement hard gate here** (`getBoundingClientRect()` vs the A8 pixel budgets; overflow halts loudly). *Verify:* render sp4/sx7 → PDF; visual QA vs design; no zone over budget.
- **Phase 6 — Client report (Part C, 10 pages)**; collapse the `assessment.js` duplicate so the browser consumes the server view-model. *Verify:* render → visual QA; measurement gate green.
- **Phase 7 — Hardening.** Automated regeneration loop on measurement failure; re-add the render half to `tests/run_test.js`; rewrite `beta/` + `app/generate_report.js`. *Verify:* end-to-end sp4/sx7 green through HTML.

**Parallel / off the critical path:** Mo content-review session (finalize the draft prose — build templates against the draft now, swap text in without structural change; budgets confirmed by the Phase-5 measurement gate); `so7`/`sp9` v2 fixtures; the sx7 counter_type-flag prompt tightening.

---

## Reconciliation carry-overs (from design-doc review)

- **Type-name conflict** — resolved: engine wins; fix docx headings (Phase 0).
- **`responses_snapshot`** — confirm the DB column is populated and reaches the prep layer (the `app.js` submit payload already includes it); add the verbatim-selection step (Phase 1).
- **`near_tie`** — confirm Call #1 emits `gap: "tight"` for close gaps (fixtures were `"wide"`); derive `near_tie` in prep (Phase 4).
- **Renderer `confirmed_instinct` bug** — read `dominant_instinct_hypothesis` directly (Phase 0).
