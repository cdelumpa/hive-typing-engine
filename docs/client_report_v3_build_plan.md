# InsightOut Client Report v3.0 — Build Plan (PR by PR)

**Prepared by:** Claude Code (lead engineer / QA)
**Date:** 11 August 2026
**Status:** Draft for joint validation. **No PR is authorized to start.** This plan is the artifact we reality-check together before PR 0.
**Companion:** `docs/feasibility_report_client_report_v3.md` (ratified). This document expands §6 of that report to review depth and folds in the five decisions below.

---

## Decisions ratified (folded into the plan)

| # | Decision | Where it lands |
|---|----------|----------------|
| D1 | Editable PDF fields **OUT for v1** | PR 8 deferred (confirmed below) |
| D2 | Heat map uses **opaque solid fills** along the cyan ramp; keep "zero transparency groups" document-wide; ramp must stay **clearly non-orange at every step** (orange = client-only per §5.3; the heat map is framework chrome) | PR 5 |
| D3 | "Ask about the alternate" tip is **always included**, reworded to hold at any score gap — **copy fix, no conditional rendering** | PR 5 (design owns copy) |
| D4 | Page 10 scope **fixed**: 3 instinct-definition cards + one 3-column subtype comparison unit + "In Your Responses". **Shift bullets and "Leaning Into the Other Instincts" blocks are CUT** | PR 4 |
| D5 | p7 chicklets — Communication, Conflict, **and** Decision-Making all require **fresh per-type authoring**, not reformatting, despite existing `type_N.communication`/`conflict` JSON keys | PR 3 content-readiness |

---

## How to read this plan

### The overall build strategy — the new renderer is built *beside* the old one
The single hard constraint is: **the live client and coach reports keep working at every step.** We honor it structurally.

- The 12-page report is built as a **new, separate entry point** — `buildClientReportHTML_v3(model)` in `app/renderer.js` — that is **not wired into production** (`generateReportPDFs`) until **PR 7**. Through PR 1–6, production keeps calling the existing `buildClientReportHTML` (the current 10-page report). Nothing a client or coach receives changes until cutover.
- Each page PR adds page-fragment functions to the v3 renderer and verifies them **offline** through the render harness, not through production.
- The **coach report** is never edited directly. The only way a client PR can touch it is through **shared primitives** — `buildEnneagramSVG`, `partAStyles()`, chart helpers, `report_prep.js` shared helpers, `type_meta.js`. That is exactly why the coach regen+diff runs on every PR from PR 1 on (see the global gate below).

This "build beside, cut over once" shape is what lets us take page-at-a-time PRs without ever shipping a half-migrated report.

### Global gates — run on **every** PR from PR 1 onward, in addition to each PR's own checks
| Gate | Command / mechanism | Pass criterion |
|------|---------------------|----------------|
| **Coach regen + diff** | `node scripts/render_coach.js` for both fixtures (`sp4`, `sx7`) → compare new `coach_*.pdf` / `.html` to the pre-PR baseline | Coach HTML **byte-identical** unless the PR intentionally changed a shared primitive; if intentional, the visual diff is reviewed and explicitly signed off. Never an unreviewed coach change. |
| **Client single-sheet** | `node scripts/render_client.js` (v3 path) | Every v3 `.page` height ≤ 1057px (`PAGE_PX + 1`); process exits 0. A spill `fail()`s the run. |
| **Page-count / structure** | same harness, `expected` count for the v3 path | Logical page count equals the number of pages built so far; `tests/report_pages_test.js` updated and green. |
| **Pixel reference diff** | render v3 page → PDF/PNG → overlay against the corresponding `docs/mockup/claude_The_Peacemaker_Page_*.html` rendered at 816×1056 | No visible drift in layout, type, color, or diagram at 100%. Reviewer sign-off (we do not yet have automated pixel-diff tooling — see Open Infra). |
| **No transparency groups** | inspect emitted PDF (e.g. `qpdf --show-object` / a transparency-group grep) for any page with SVG | Zero transparency groups / soft masks in the document (spec §3.2). Becomes load-bearing at PR 5. |

### Content-readiness rule
A page PR **cannot start** until its authored content exists in the **Word source** and has been compiled to `app/content/content_library.json` via `scripts/build_content_library.js` **with the coverage gate updated to require the new keys** — so "missing content" fails the build instead of rendering blank. Content authoring is the design team's; the engineering PR consumes the compiled JSON. The content-readiness column on each PR states what must be authored and by whom **before** that PR opens.

### Open infra this plan assumes (called out, not hidden)
- **No CI exists today** (`.github/workflows` is absent). "Wire into CI" below means *create* a workflow (or, minimum viable, a documented pre-merge command block that a reviewer runs). Landed in PR 1.
- **Font + Chromium are unpinned** (feasibility §7). The single-sheet numbers are only trustworthy once a metric-compatible font (Arial / Liberation Sans) is installed **and** the Chromium version is pinned in the render container. This is a **PR 1 deliverable**, because PR 1 is the first PR whose pass/fail depends on measured height.
- **Fixtures today are `sp4` and `sx7`** (`tests/fixtures/{sp4,sx7}_api_result.json`) — neither is Type 9. The v3 work needs a **Type-9 / SX9 fixture** (the "Anders" case the mockup was built from) plus, for PR 5, a **near-tie** fixture and a **20-point-clear** fixture. Fixture creation is listed as a prerequisite on the PRs that need it.

---

## PR 0 — Corrections & guardrails (docs only)

**Purpose:** land the two real, independent corrections before any build, and neutralize the misleading patch file.

**Files touched**
- `reference/hive_27_subtype_reference.md:151` — "TYPE 6 — The Loyal Skeptic" → "The Questioner."
- `docs/V2 Design Documents/hive_insightout_report_design_system_v1_3.md` — `:145` fix triangle text `3→6→9→3` → `9→6→3→9`; `:198–199` fix the security-line direction (security point → home; the client reaches security **against** the arrow) per §3.6.
- `docs/type_library_name_patch_080726.json` — **rename or remove** (e.g. `→ type_library_stress_security_primer_draft_080726.json`) so it is never mistaken for a name patch. (The previously double-nested mirror was removed by the 11 Aug `docs/mockup/` flatten; only this one copy exists.) Its only real delta is unreviewed primer prose (feasibility §5.1). **Do not apply it to `type_library.json`.**

**Content prerequisites:** none (design confirms the primer-prose file's fate: rename vs delete).

**Render/verify + references:** no render. Proofread against §3.6 and the 18-diagram contact sheet's arrow directions.

**Pass/fail:**
- `grep -n "Loyal Skeptic" reference/hive_27_subtype_reference.md` returns nothing.
- The v1.3 doc contains `9→6→3→9` and no `3→6→9→3`; security-line prose matches §3.6.
- No code references the renamed/removed patch file: `grep -rn "type_library_name_patch" --include=*.js .` returns nothing (confirmed today: only docs reference it).

**Coach validation:** N/A (no code).

**PR-specific risk:** none beyond ensuring nobody has a local script that reads the patch filename. Confirmed clear at time of writing.

**Depends on:** nothing. Can land immediately once authorized.

---

## PR 1 — Foundation: infra pin + consolidated stylesheet + Your Wings, one type, end to end

**Purpose:** spec §9's milestone — data in, PDF out, single-sheet passing, Wings as the page — plus the shared foundations every later PR builds on. This is the **largest** PR; see the split option at the end.

**Files touched**
- **Infra**
  - Render container / Dockerfile (or Railway build config) — install Liberation Sans (or Arial) and **pin the Chromium/Puppeteer version** (currently the `^24.42.0` range; pin to the exact resolved build). Remove reliance on local system-Chrome path for the verification harness, or document the pinned local version.
  - `.github/workflows/report-verify.yml` (**new**) — run `npm run verify:render` + coach regen on PRs. If CI is deferred, add a `docs/` pre-merge checklist block instead and say so explicitly.
  - `tests/fixtures/anders_sx9_api_result.json` (**new**) — Type-9 / SX9 fixture (nine `call1_ranking` scores + `instinct_score_profile` SP66/SO64/SX84) so PR 1 renders the authored Type-9 content.
- **CSS consolidation (Q2)**
  - `app/report.css` (**new**, or a single exported `clientReportStyles()` constant in `renderer.js`) — extracted from the 12 inline mockup `<style>` blocks: the shared rules once, the **18 real tokens** as `:root` CSS variables (spec §5.1/5.2), component modifiers prefixed `is-` (§3.4). **Drop the dead `.reflect` / `oklch()` block.** Resolve each of the 21 non-token page-local hexes to a token or keep it deliberately — documented, not auto-merged by eye.
- **Diagram**
  - `app/renderer.js` `buildEnneagramSVG` — **extend** (do not replace) with the client **430×252 wings-lines variant** (R=95, node angles + label rules from §3.5, `DX=22`, home-label-above rule). Port geometry verbatim from `claude_The_Peacemaker_Page_Wings_v1.html`; verify against `insightout_all18_diagrams_check.png`.
- **Renderer**
  - `app/renderer.js` — add `buildClientReportHTML_v3(model)` (returns a one-page document for now) and `_clv3Wings(m)`. Not called by production.
  - `app/report_prep.js` — add whatever Wings view-model fields are missing to `buildClientModel` (wing overview/bullets/resource-band lookups from `content_library.json`). **Touch no `buildCoachModel` shared helper.**
- **Harness**
  - `scripts/render_client.js` — add a v3 config entry (`selector: '.page'`, `expected: 1` for now, `enforceSheet: true`, label `['P8 Wings']`) driving the new Type-9 fixture, alongside the existing 10-page client config (kept green until PR 7).

**Content prerequisites (before PR opens):** Type-9 Wings content in the Word source → compiled: two wing overviews, 2×5 wing bullets, two "As a Resource" bands. This is the mockup's authored Type-9 content; design confirms it is final and lands it in the content library with gate keys added. *(Owner: design authoring; compile + gate: eng.)*

**Render/verify + references:** render the Wings page for the Type-9 fixture → diff against `claude_The_Peacemaker_Page_Wings_v1.html`; diagram against the contact sheet.

**Pass/fail (explicit):**
- `node scripts/render_client.js` v3 config: exactly 1 page, height ≤ 1057px, exit 0.
- Wings diagram: 54 labels equivalent not required here (single wheel), but **node 2 present, clockwise, home-above label, min edge clearance ≥ 5px** by inspection against §3.5.
- Consolidated stylesheet: `grep -c "<style" ` on a rendered v3 page = 1 shared sheet (or one `<style>` injected once); no `oklch(`, no `rgba(`, no `transparent`, no `fill-opacity`/`stop-opacity` on this page.
- Font: rendered page uses Arial/Liberation Sans (computed `font-family`), and the pinned Chromium version is recorded in the PR description.
- **Coach regen + diff: coach HTML byte-identical** — this proves the `buildEnneagramSVG` *extension* did not perturb the 500×500 coach wheel. **This is the highest-value check in the PR.**

**Coach validation:** full regen of both coach fixtures; byte-identical HTML expected (extension added a new variant branch, existing branches untouched). Any diff blocks the PR.

**PR-specific risks/open questions (beyond feasibility §7):**
- Splitting `buildEnneagramSVG`'s geometry constants (500×500 vs 430×252) risks an accidental shared-constant edit. Mitigation: new variant gets its own constant block; the coach byte-diff catches leakage.
- Scope size. **Option to split:** PR 1a = infra + CSS + fixture + harness (no visible page); PR 1b = Wings page + diagram variant. Recommended only if we want smaller review units; the spec milestone favors keeping them together so page one proves the whole pipeline. **Decision needed from us.**

**Depends on:** PR 0 (clean geometry doc so nobody re-derives from the wrong triangle).

---

## PR 2 — Static pages (Cover, Contents, Welcome, What Is, Your Thoughts)

**Purpose:** the five all-static pages, plus the single source of page order that fixes the footer/TOC sync bug (Q7).

**Files touched**
- `app/renderer.js` — `_clv3Cover`, `_clv3Contents`, `_clv3Welcome`, `_clv3WhatIs`, `_clv3Thoughts`; a **`CLIENT_PAGE_ORDER` array** that drives both the Contents page entries and each page's footer number (derive, never hard-code — Q7). `buildClientReportHTML_v3` now assembles these + Wings.
- `app/report_prep.js` — expose `static.welcome`, `static.primer.nine_types[9]`, reflection prompts to the client model (AS-IS lookups).
- `scripts/render_client.js` — v3 `expected` → 6; add labels; selector stays `.page`.

**Content prerequisites:** none new — all AS-IS from `static.*`. Reflection prompts (5) confirmed final by design (they're static; the `.qspace` boxes render flat, editable-field stamping is out per D1).

**Render/verify + references:** each page diffed to its mockup (`Cover_v1`, `TOC_v2`, `Welcome_v2`, `WhatIs_v2`, `Thoughts_v2`). Confirm cover `radial-gradient` terminates on opaque `#FFFFFF` (no transparency).

**Pass/fail:**
- 6 v3 pages, each ≤ 1057px, exit 0.
- **Footer numbers equal the Contents-page entries** for every page (assert in `report_pages_test.js`: parse rendered footers, compare to `CLIENT_PAGE_ORDER`). This is the concrete Q7 check.
- What-Is page: 9 type cards present, names match `type_meta.TYPE_NAMES` (Performer/Observer/Questioner/Protector included).
- No `rgba`/`transparent`/opacity anywhere in these five pages' output.

**Coach validation:** regen + byte-diff (should be identical; no shared primitive touched).

**PR-specific risk:** the Contents page lists 9 entries (spec §2) but the document is 12 physical pages — confirm the numbering model distinguishes "contents entries" from "page numbers" so they can't be conflated in the assertion.

**Depends on:** PR 1 (stylesheet, v3 skeleton).

---

## PR 3 — Per-type static pages: Exploring Your Type (A + B) and Stress & Security

**Purpose:** the three EDIT-heavy per-type pages (mockup pages 6, 7, 9), rendered for all 9 types.

**Files touched**
- `app/renderer.js` — `_clv3ExploringA` (p6), `_clv3ExploringB` (p7), `_clv3Lines` (p9). p9 reuses the wings-lines diagram variant from PR 1 with stress/security highlighting (dashed red / solid green, correct flow — already correct in code per §4.2).
- `app/report_prep.js` — client-model lookups for: core motivation, worldview, **core belief (new field)**, at-a-glance ×4 (new fields), typical patterns ×3, strengths ×3, challenges ×3, the **three style chicklets**, catching-patterns ×6, line overviews/bullets/high-side bands, "Putting Resources to Work" ×3.
- `scripts/build_content_library.js` — extend `validateType(n, …)` to require the new keys (core_belief, at_a_glance.*, chicklet names+bullets, wing bullets/bands already added in PR1, line bullets, resources) so missing content fails the build.
- `scripts/render_client.js` — v3 `expected` → 9; **loop the render over all 9 types**, not just the fixture's type, to exercise every type's fitting.

**Content prerequisites (before PR opens) — this is the critical-path PR for authoring:**
| Zone | Class | Owner |
|------|-------|-------|
| Core Motivation, Worldview, Typical Patterns, Strengths, Challenges, line overviews, high-side bands | **EDIT** (reformat existing library content to §6 constraints: 2-line bullets, <20ch bold labels, matched column counts) | design |
| **Core Belief** (p6) | NEW | design |
| At-a-Glance ×4 (p6) | NEW | design |
| **Communication, Conflict, Decision-Making chicklets** (p7) — name (<24ch) + 3 one-line bullets (<47ch) each | **NEW — per D5, all three authored fresh, not condensed from `type_N.communication`/`conflict`** | design |
| Catching-patterns Signs ×3 / Interrupting ×3 (p7) | NEW/EDIT (Type-9 was placeholder per §7.2) | design |
| Line bullets ×6, "Putting Resources to Work" ×3 (p9) | NEW/EDIT | design |
All for **8 remaining types** (Type 9 exists from the mockup). Content must be compiled + gate-green before the PR opens.

**Render/verify + references:** render all 9 types; diff Type-9 output to `LeadingType_A_v1`, `LeadingType_B_v1`, `Lines_v1`. For the other 8, verify against the §6 structural constraints (no mockup exists for them — this is why the assertions below matter more than pixel-diff for non-9 types).

**Pass/fail (explicit):**
- All 9 types × 3 pages: each ≤ 1057px, exit 0. This is 27 page-renders that must all fit — **the tightest fitting gate in the build.**
- **Matched-column-count check** (spec §6 "verified programmatically"): for paired columns (At Your Best / Growing Edge; the two line points), assert equal rendered line counts. Add this measurement to the harness.
- Chicklet style names ≤ 24ch and render on 1 line; practice bullets ≤ 47ch; strengths/challenges bullets render to exactly 2 lines with bold label < 20ch (measure, don't eyeball).
- p9 diagram: stress line home→stress (dashed), security line security→home (solid), arrowheads correct — matches `Lines_v1` and §3.6.

**Coach validation:** regen + byte-diff (p9 reuses the PR1 diagram variant; no coach change expected — confirm).

**PR-specific risks:** (1) fitting will iterate — 27 renders each subject to Arial metrics, so the font pin from PR 1 is load-bearing here; budget review cycles. (2) The comms/conflict re-authoring (D5) means the old `type_N.communication`/`conflict` keys become **orphaned** at PR 7, not reused — track them for removal, don't quietly leave both. (3) If any type's content overflows despite the constraints, that's a **content** fix (design tightens copy), not a layout hack — the assertion must stay fail-hard.

**Depends on:** PR 1 (diagram, CSS), PR 2 (page order), and the 8-type content being authored + compiled.

---

## PR 4 — Instincts & Subtypes (page 10)

**Purpose:** the subtype page, scope now fixed by **D4**.

**Files touched**
- `app/renderer.js` — `_clv3Instincts`: three instinct-definition cards (AS-IS `static.instinct_definitions[3]`), one **3-column subtype comparison** unit (SP/SO/SX, each with Where the Energy Goes / The Inner Experience / Growing Edge), computed **rank badges** (Primary/Secondary/Tertiary) and the client's highlighted column, and the "In Your Responses" evidence box (personalized). **No shift bullets, no "Leaning Into the Other Instincts" blocks (D4 — cut).**
- `app/report_prep.js` — instinct ranking from `hypothesis.instinct_score_profile` (data already available, Q4); subtype comparison lookups; personalized evidence from the AI result.
- `scripts/build_content_library.js` — `validateSubtype(key, …)` extended to require the **3-zone comparison** and the **two-word signature** for all 27 subtypes; **remove any gate requirement for shift/leaning content** so the cut content isn't demanded.
- `scripts/render_client.js` — v3 `expected` → 10.

**Content prerequisites (before PR opens):**
| Zone | Class | Coverage | Owner |
|------|-------|----------|-------|
| 3-column comparison: 3 zones × 3 columns | **NEW (restructure)** | 27 subtypes (Type-9's 3 exist) → 24 to author | design |
| Two-word signature (e.g. "Merging & Intensity") | **NEW** | 27 (3 exist) | design |
| Formal name + nickname | EDIT | 27 exist (`subtype.name` + `subtype.tagline`) | design |
| Instinct definitions | AS-IS | 3 exist | — |

**Render/verify + references:** diff Type-9/SX9 output to `Instincts_v1`; render all 27 subtypes for fit; confirm the rank badges and "yours" column follow the fixture's instinct scores (SX primary for Anders).

**Pass/fail:**
- Page ≤ 1057px for representative subtypes across all 9 types (render the 3 subtypes of each type = 27 renders; each fits).
- Rank badges match `instinct_score_profile` ordering; highlighted column = primary instinct; "How You May Experience SP/SO/SX" strings render on 1 line (spec §6, exactly 25ch).
- "In Your Responses" box uses the orange left border and is the **only** orange element on the page except the client name in the header (§5.3).
- Gate: build fails if any subtype lacks a comparison zone or two-word signature; build does **not** demand shift/leaning content.

**Coach validation:** regen + byte-diff (no shared primitive touched; expect identical).

**PR-specific risk:** D4 must be reflected in the **build gate**, not just the renderer — otherwise a future content compile could still expect the cut fields and fail, or worse, someone re-authors dropped content. Make the gate the source of truth for the fixed page-10 contract.

**Depends on:** PR 1–2; 24 subtype comparison units + 24 signatures authored + compiled.

---

## PR 5 — Quick Reference (computed)

**Purpose:** the one computed page — heat map, instinct bars, leading/alternate, subtype band, debrief tips. Highest computed-rendering risk.

**Files touched**
- `app/renderer.js` — `_clv3QuickRef`; a **heat-map SVG renderer** (360×352 geometry, 9 nodes) using **opaque solid fills** along the cyan ramp (**D2** — no `fill-opacity`, no `stop-opacity`; precompute each node's solid color from its normalized score); a client instinct-bar renderer (0–100 width, reuse the coach bar primitive's math but the client's own styling); leading/alternate blocks; the subtype signature band.
- `app/report_prep.js` — client model gains the **score vector**: normalized nine-score array for the heat map, the alternate (2nd-ranked) type + its one-sentence motivation, instinct bar values, subtype signature. All derive from `hypothesis.call1_ranking` + `instinct_score_profile` (already reachable — Q4). Reuse the existing `nearTie` result only to *label* the alternate node, not to gate the tip (D3).
- `scripts/render_client.js` — v3 `expected` → 11; add the **near-tie** and **20-point-clear** fixtures to the render matrix.
- `tests/fixtures/*` — add `neartie_api_result.json` and `clearleader_api_result.json`.

**Content prerequisites (before PR opens):**
- **Reworded "Ask about the alternate" debrief tip** (D3) — copy that holds at any score gap. *(Owner: design.)*
- The other three debrief tips finalized (spec §7.2 marked them placeholders). *(Owner: design.)*
- Leading/alternate one-sentence motivations are AS-IS reuse of `type_N.description.core_motivation` — no new authoring.

**Render/verify + references:** diff to `AtAGlance_v1` for the Anders fixture; render near-tie (alternate node prominent, dashed ring) and clear-leader (alternate node still present but the reworded tip still reads sensibly).

**Pass/fail (explicit):**
- Page ≤ 1057px for all three fixtures (Anders, near-tie, clear-leader).
- **Zero transparency groups in the emitted PDF** (D2) — the load-bearing check for this PR; run the PDF transparency inspection and require 0 groups / 0 soft masks, keeping the document-wide invariant (spec §3.2).
- **Heat-map ramp is non-orange at every step** (D2): assert each computed node fill is outside the orange hue band (e.g. not within ΔE of `#F68625`/`#F9E7D2`); the only orange on the page is the client name + (if shown) the subtype band per §5.3.
- Heat map: leading node = max intensity + solid ring; alternate = 2nd + dashed ring; both labels present; node 2 present; clockwise.
- Instinct bars: widths = coherence scores (0–100), primary instinct labeled; **no numeric values printed** (Q5 — numbers deliberately removed client-side).
- The reworded alternate tip renders identically for near-tie and clear-leader (proves D3 — no conditional logic).

**Coach validation:** regen + byte-diff. The heat-map renderer is **new and client-only**; if it accidentally reused/altered a shared chart helper, the coach diff catches it.

**PR-specific risks:** (1) heat-map normalization — decide and document the mapping (min→max across the 9 scores) so intensity is stable and legible; a degenerate case (all scores equal, or one dominant) must still render distinguishable steps. (2) The opaque-ramp precompute must be deterministic (no per-render color drift). (3) This is the first page whose correctness depends on real per-client data variety — hence the 3-fixture matrix.

**Depends on:** PR 1–2; debrief tip copy (incl. reworded alternate) finalized; 3 fixtures.

---

## PR 6 — Development Ideas (CAR, page 11)

**Purpose:** the entirely new "out"-in-InsightOut page.

**Files touched**
- `app/renderer.js` — `_clv3CAR`: three capacity blocks (Courage / Agility / Resilience), each with definition + preamble + per-type bullets; the coda; the title rule **"Development Ideas for {plural}"** (strip "The", add "s" — all nine work, spec §6).
- `app/report_prep.js` — CAR lookups per type; plural-title derivation from `type_meta.TYPE_NAMES`.
- `scripts/build_content_library.js` — `validateType` requires the CAR block for all 9 types.
- `scripts/render_client.js` — v3 `expected` → 12.

**Content prerequisites (before PR opens):** the CAR page for **all 9 types** — 3 capacity definitions + preambles (largely generic, Cai-authored) and 3×3–4 per-type bullets. **0/9 authored today** (Type-9 exists only in the mockup). This is the largest blank-page authoring block and gates the PR. *(Owner: design / Cai.)*

**Render/verify + references:** diff Type-9 output to `CAR_v1`; render all 9 types for fit and the plural-title rule.

**Pass/fail:**
- 9 types render, each ≤ 1057px, exit 0.
- Plural title correct for all nine (Peacemakers, Improvers, Givers, Performers, Individualists, Observers, Questioners, Enthusiasts, Protectors).
- CAR bullets meet their fitting constraints; coda present.
- Build gate fails if any type lacks CAR content.

**Coach validation:** regen + byte-diff (client-only page; expect identical).

**PR-specific risk:** the CAR definitions/preambles are "canon-derived structure, specific lines not canon" (§7.2) — they need Mo/Cai sign-off as canon before they harden, or PR 6 ships copy that later churns.

**Depends on:** PR 1–2; CAR authored for 9 types.

---

## PR 7 — Cutover + obsolete removal

**Purpose:** make v3 the live client report; retire the old one; wire the assertion into the merge gate.

**Files touched**
- `app/server.js` — `generateReportPDFs` (and `generateRerunReportPDFs`) call `buildClientReportHTML_v3` instead of `buildClientReportHTML`.
- `app/renderer.js` — **remove** the old client fragments (`_clP3Hypotheses`, `_clP4Patterns`, `_clP5WingsLines`, `_clP6Instinct`, `_clP7Strengths`, `_clP8Application`, old `_clTitle/_clTOC/_clP1Welcome/_clP2Primer`) and the old `buildClientReportHTML`; rename `buildClientReportHTML_v3` → `buildClientReportHTML`. **Retain everything the coach report imports.**
- `app/content/content_library.json` — after this lands, the **orphaned** keys (`type_N.center`, and the comms/conflict keys if D5's fresh authoring fully replaced them) can be removed from the Word source + recompiled in a follow-up; do not remove in the same PR as cutover (keep the diff reviewable).
- `scripts/render_client.js` — remove the old 10-page config; v3 config becomes the client config, `expected: 12`, `enforceSheet: true`, selector `.page`.
- `tests/report_pages_test.js` — update to assert the 12-page structure and footer/TOC sync.
- `app/package.json` / CI workflow — ensure `verify:render` (now 12-page) + coach regen run on every PR going forward; make `report_pages_test` part of `npm test` (it already is).

**Content prerequisites:** all pages authored (PRs 1–6 complete and green).

**Render/verify + references:** **full end-to-end from a real assessment** (not just fixtures) through `generateReportPDFs`: client 12-page PDF + coach 3-page PDF both produced, both recorded via `db.createReport`. Compare the client PDF end-to-end to the full mockup PDF (`insightout_client_report_full_draft_080726.pdf`) for the Anders case.

**Pass/fail (explicit):**
- Production path emits a 12-page client PDF, every page ≤ 1057px, and a 3-page coach PDF unchanged from baseline.
- `db.createReport(assessmentId, 'client'|'coach', …)` still fires for both.
- `npm test` green (incl. updated `report_pages_test.js`); `npm run verify:render` green at `expected: 12`.
- No dangling references to removed fragments: `grep -n "_clP8Application\|buildClientReportHTML_v3" app` returns nothing after the rename.
- The resend flow (`POST /coach/clients/:id/resend`) and the post-Call-#2 job both produce the new report.

**Coach validation:** the decisive one — regen + byte-diff of coach after the client cutover **and** after the old-fragment deletion. Deleting old client code must not perturb any shared symbol the coach uses. If the coach HTML changes by a byte, stop and find the shared dependency.

**PR-specific risks:** (1) this is the only PR that changes what clients/coaches actually receive — schedule it when a real end-to-end assessment can be run and eyeballed. (2) Orphaned-content removal is deliberately deferred to a follow-up so cutover stays a clean switch. (3) The EM-Lab rerun path (`generateRerunReportPDFs`) must be flipped too, or reruns silently keep emitting the old report.

**Depends on:** PR 1–6 all merged and green.

---

## PR 8 — Editable PDF fields — **DEFERRED (confirmed OUT for v1, per D1)**

Not built in this sequence. When revisited as a fast-follow: a standalone post-render stamping pass (e.g. `pdf-lib`) that reads each `.qspace` bounding box at render time and overlays an AcroForm field — positions **measured, never hard-coded** (spec §6) — plus a cross-viewer test matrix (Acrobat / Preview / Chrome). It touches no page content, so it can land any time after PR 7 without disturbing the visual report. No engineering work in PRs 0–7 should assume it.

---

## Dependency & ordering summary

```
PR0 (docs)  ─┐
             ├─► PR1 (infra+CSS+diagram+Wings) ─► PR2 (static+page-order)
             │                                     │
             │        ┌──────────────┬─────────────┼───────────────┐
             │        ▼              ▼             ▼               ▼
             │      PR3 (per-type)  PR4 (subtype) PR5 (Quick Ref) PR6 (CAR)
             │        └──────────────┴─────────────┴───────────────┘
             │                              │
             └──────────────────────────────► PR7 (cutover + retire old)  ──► [PR8 deferred]
```
PR 3–6 depend on PR 1–2 and on their own content being authored; they are **independent of each other** and could be built in any order or parallelized *if* their content lands — but we take them **one at a time and validate each** (spec constraint). Recommended order 3→4→5→6 front-loads the tightest fitting work (PR 3) and the highest technical risk (PR 5) before the pure-authoring page (PR 6).

## Content-readiness gating summary (what blocks what)

| PR | Blank-page NEW authoring required first | ~Units (8 types / 24 subtypes) |
|----|------------------------------------------|-------------------------------|
| PR 1 | Type-9 Wings only (exists) | 0 (fixture-only) |
| PR 2 | none (AS-IS static) | 0 |
| PR 3 | Core Belief, At-a-Glance×4, **all three chicklets (D5)**, catching-patterns, line bullets/resources — 8 types | ~200 |
| PR 4 | Subtype 3-zone comparison + two-word signatures — 24 subtypes | ~100 |
| PR 5 | Reworded alternate tip + 3 debrief tips (D3) | ~4 |
| PR 6 | CAR page — 9 types | ~120 |

**The schedule is content-bound, not code-bound.** PR 3, 4, and 6 each stall until their authoring lands; the fitting constraints mean authoring and rendering iterate together, so treat the single-sheet + matched-column assertions as the author's live feedback loop, not just a CI gate.

## Open items for us to close before PR 0

1. **PR 1 split?** One large foundation PR (spec-milestone shape) vs PR 1a infra/CSS + PR 1b Wings. *(Recommend: keep together unless review size is a concern.)*
2. **CI vs checklist.** Create `.github/workflows/report-verify.yml` in PR 1, or run a documented pre-merge command block manually? *(Recommend: minimal workflow — the coach byte-diff is too important to rely on memory.)*
3. **Fixture ownership.** Eng can synthesize the Type-9 / near-tie / clear-leader `api_result` fixtures from real coherence profiles — confirm design is OK with synthetic score vectors for layout testing.
4. **Orphaned-content removal timing.** Confirm `type_N.center` and the superseded comms/conflict keys are removed in a **post-PR-7 follow-up**, not at cutover.
