# InsightOut Client Report v3.0 — Engineering Feasibility Report

**Prepared by:** Claude Code (lead engineer / QA)
**Date:** 11 August 2026
**Against:** `main` @ `3913f30` (pulled and confirmed current before analysis)
**Reads:** design spec v3.0, 12 mockup HTML files, rendered PDF, 18-diagram contact sheet, name patch, and the production codebase.

> This is an investigation. No files were changed. Anything flagged as "broken" is reported, not fixed.

---

## 0. The one question first — template or rebuild?

**Recommendation: rebuild in the production framework, using the mockup HTML as a locked visual/pixel reference — do *not* wire the mockup files in as runtime templates.**

The recommendation is not close, and the reason is that the production framework *is already the mockup's rendering path*. The mockup PDF was produced by headless Chromium via `Page.printToPDF` (spec §0, appendix). Production renders HTML strings through Puppeteer's `page.pdf()`, which is the same CDP call (`app/server.js:5065`, `launchBrowser` at `:5044`). A faithful rebuild reproduces the mockup exactly because it uses the identical engine — that is the whole reason the spec insisted on rendering rather than comping.

Concretely, using the HTML files as templates fails on five points:

1. **They are single-client, single-type artifacts.** Every mockup file hard-codes "Anders Wennerstrom," "Type 9," the nine SVG node positions for a Type-9 wheel, and a literal page number. Turning them into templates means building placeholder substitution, a 9-node diagram loop, per-type content injection, and instinct-driven ranking — i.e. re-implementing `report_prep.js` + `buildEnneagramSVG()` on top of dead HTML.
2. **The production renderer already does this.** `app/renderer.js` builds report HTML from JS template literals off a view-model assembled by `app/report_prep.js`. `buildClientReportHTML(model)` (`renderer.js:2487`) and per-page functions already exist. This is the natural home for the 12 pages.
3. **The coach report shares that code and must not break.** `report_prep.js` (holds both `buildClientModel` and `buildCoachModel`), `renderer.js` (`buildEnneagramSVG`, `partAStyles()`, chart primitives, `esc`), `type_meta.js`, `content_library.json`, `content_overrides.js`, and `report_assets.js` are all shared. A template fork abandons that sharing and doubles the maintenance surface.
4. **Quick Reference (p5) cannot be a static template at all.** Its heat map, instinct bars, and alternate node are computed per client. That page is code no matter what.
5. **Content must stay in the CMS/build pipeline.** The live report content is `app/content/content_library.json`, built from Word by `scripts/build_content_library.js` and overridable at runtime by DB-published edits (`content_overrides.js`). Static templates would strand both the Word→JSON authoring surface and the published-override mechanism.

**What the mockup HTML is used for instead** (it is not discarded — it is the contract):
- the **pixel acceptance reference** — rendered output is diffed against these files per page;
- the **CSS source of truth** — the shared stylesheet is extracted from these 12 inline `<style>` blocks (see §4 Q2);
- the **authored Type-9 content and the exact SVG geometry** (node coords, label offsets, arrow markers) to port into the generator.

**Consequence for everything downstream:** because we rebuild, CSS consolidation lands **early** (foundation, with the first page), not late — there is no point re-inlining twelve stylesheets and consolidating afterwards. This is the single biggest sequencing effect of the answer. Details in §6.

---

## 1. Current-state inventory

### 1.1 What produces the report today
There is **no on-demand "make a PDF" route**. Both PDFs are a side effect of assessment delivery:

- **`generateReportPDFs(result, scores, intake, assessmentId)`** — `app/server.js:5313`. Calls `renderClientReport` then `renderCoachReport` (`:5330`, `:5340`), writes both PDFs to `REPORTS_DIR`, records them via `db.createReport(assessmentId, 'client'|'coach', path)`.
  - Invoked from the coach resend flow `POST /coach/clients/:id/resend` (`server.js:1861`) and from the post-Call-#2 background job (`server.js:5693`).
- **`generateRerunReportPDFs`** (`server.js:5357`) — EM-Lab re-run twin; writes `rerun_*`, never touches `db.createReport`.
- Generated PDFs are served inline near `server.js:11970`, filename-gated by `PDF_FILENAME_RE` (`:15069`).

### 1.2 The render pipeline
`app/render_report.js` (`:18–26`) is the thin orchestrator:

```
renderClientReport → report_prep.buildClientModel → renderer.buildClientReportHTML → Puppeteer page.pdf()
renderCoachReport  → report_prep.buildCoachModel  → renderer.buildCoachReportHTML  → Puppeteer page.pdf()
```

- **Templating:** plain JS template literals in `app/renderer.js`. No Handlebars/EJS/React. Client root `buildClientReportHTML` (`renderer.js:2487`); per-page fragment functions (`_clTitle` `:1550`, `_clTOC`, `_clP8Application` `:2144`, etc.).
- **PDF:** Puppeteer `^24.42.0` (`app/package.json:26`), `page.pdf()` = `Page.printToPDF`. `generatePDF()` (`server.js:5065`): `setContent(html, {waitUntil:'networkidle0'})` → `emulateMediaType('print')` → `page.pdf()`. PDF options = `buildCoachPdfOptions()` (`renderer.js:1530`): `8.5in × 11in, printBackground:true, displayHeaderFooter:false, margin:0, preferCSSPageSize:true` — used for **both** reports.
- **Chromium/font pinning:** **not pinned.** Production uses Puppeteer's bundled Chromium (npm range only); local dev hard-codes system Chrome's path (`server.js` launch block, mirrored in `scripts/render_client.js:59`). No font is installed or pinned anywhere. (Directly relevant to spec §3.3.)
- **Current client report = 10 logical pages** (labels in `scripts/render_client.js`): Title, TOC, Welcome, Primer, Hypotheses, Patterns, Wings/Lines, Instinct, Strengths/Challenges/Practices, Application. The redesign is a 12-page reflow of this.

### 1.3 Where content lives
- **Live report content:** `app/content/content_library.json` (175 KB), required by `report_prep.js:19`. Keys: `static`, `type_1…type_9` (9/9), `subtype_sp1…subtype_sx9` (27/27). Built from `docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx` by `scripts/build_content_library.js`, which enforces a coverage gate. **Word is the editing surface; the report reads the committed JSON.**
- **Runtime overrides:** `app/content_overrides.js` — `loadPublishedOverrides()` + `resolveLibObject()` layer DB-published CMS edits over the JSON. Both models use it.
- **Type structure/names:** `app/type_meta.js` (`TYPE_NAMES`, `TYPE_META` = stress/security/wings/center, `INSTINCT_NAME`). Displayed names always come from here; the AI's names are only asserted-equal, never rendered (`report_prep.js:110`).
- **`app/type_library.json` (and byte-identical `content/type_library.json`)** is the **older v1.1** library used by the engine/questionnaire/portal (`db.js`, `public/ui.js`, served at `server.js:4374`). **It is not on the report path.** Do not confuse it with the report content source.

### 1.4 How the PDF is produced / page numbering
`displayHeaderFooter:false`, so Puppeteer draws no chrome — **footers and page numbers are baked into each page's HTML as literal strings** (client per-page footers e.g. `renderer.js:1657` "Page 1", `:1770` "Page 2", …; coach shared footer `:1252`). The legacy `buildPdfOptions()` (`renderer.js:955`) with native `pageNumber`/`totalPages` is used only by the **beta** report and `scripts/html_to_pdf.js` — not by client/coach.

### 1.5 The coach report (shared surface — handle with care)
Generated by the same pipeline. Everything in §1.2 and the modules in §2 flagged **[COACH]** are shared. The coach report *renders numeric charts* the client report does not (see §4 Q4). The single-sheet harness treats the coach report as flow-allowed, the client report as one-sheet-per-page (`scripts/render_client.js`).

---

## 2. Create / modify / obsolete

**[COACH]** = coach report also depends on this; changes must be regression-tested against the coach PDF.

### Modify
| Path | Reason |
|------|--------|
| `app/renderer.js` **[COACH]** | Add 12 client page-fragment functions; replace the current 10-page client body. Keep coach fragments untouched. Highest-risk file — shared. |
| `app/report_prep.js` **[COACH]** | Extend `buildClientModel` to expose the three personalized zones + the Quick-Reference score vector (data already reachable — see Q4). Do not alter `buildCoachModel` shared helpers. |
| `app/content/content_library.json` | Regenerated (not hand-edited) once the Word source gains the new zones — CAR page, two-word subtype signatures, decision-making style, wing bullets/bands (see §3). |
| `scripts/build_content_library.js` | Add coverage-gate keys for the new zones so missing content fails the build instead of shipping blank. |
| `scripts/render_client.js` | Re-point the single-sheet harness at the new 12-page client renderer; update expected page count 10 → 12 and the page-label list. |
| `app/render_report.js` | Only if the client model signature changes; keep the coach path identical. |
| `reference/hive_27_subtype_reference.md` | §4.1: Type 6 still reads "The Loyal Skeptic" → "The Questioner." |
| `docs/V2 Design Documents/hive_insightout_report_design_system_v1_3.md` | §4.2: fix the reversed triangle text and the security-line direction (doc only). |

### Create
| Path | Reason |
|------|--------|
| `app/report.css` (or `renderer` constant) | Single consolidated client stylesheet extracted from the 12 inline blocks; 18 real tokens as CSS variables (spec §5, §8 Q2). |
| Quick-Reference render helpers in `renderer.js` | Heat-map SVG (9 nodes, score→intensity), instinct bars, leading/alternate/subtype blocks. New; the current client report has no equivalent. |
| CAR / Development-Ideas page fragment | New p11; no current analogue. |
| Diagram generation for the two client wheel variants | The mockup's Wings and Lines wheels use a **430×252** geometry distinct from `buildEnneagramSVG`'s 500×500. Either add variants or a second builder (see §4 Q3). |
| (Optional, v1-out) PDF field-stamping post-process | Only if editable p12 is in scope (see §4 Q6). |
| New content zones in the **Word** source | The authoring gaps in §3 — authored by the design team, not code. |

### Obsolete / repurpose (verify before deleting)
| Item | Status |
|------|--------|
| Current client **P8 "Application"** (`_clP8Application`, `renderer.js:2144`) and its `type_N.communication` / `conflict` / `center` content | Page removed. Communication + Conflict content is *repurposed* into the p7 style chicklets (condensed); `center` content is **orphaned** (Centers of Intelligence is deliberately cut, spec §1). |
| Current client **P3 "Hypotheses"** full secondary-type treatment (`cf.secondary_type_narrative`, alternate `comparison` rows) | Reduced to a single labelled node + one sentence on the Quick Reference heat map (spec §1). The full alternate treatment moves to the coach report — **do not delete the underlying data or the coach usage.** |
| Reflection prompts on interior pages | Consolidated to p12; interior prompts removed. |
| `"At Work"` / `"In Relationships"` content | **Nothing to obsolete — these do not exist in the current codebase.** The spec's "Removed" list refers to an earlier CD-brief design, not production. |
| Dead `.reflect` / `oklch()` CSS block in the mockup Wings file | Leftover; must not be carried into the consolidated stylesheet. |

---

## 3. Content audit

Live source = `app/content/content_library.json` unless noted. Categories: **AS-IS** (usable unchanged) · **EDIT** (exists, needs rework) · **NEW** (does not exist anywhere).

Counts below are for the **full catalogue** (all 9 types, and 27 subtypes where relevant), because content must be authored for every type even though one client sees one. A "unit" is one authored text field that varies by type/subtype (a bullet, a narrative, a label value).

### By page

**p1 Cover / p2 Contents / p3 Welcome / p4 What Is the Enneagram** — static.
- Welcome letter, nine type cards, TOC, cover — all **AS-IS** (`static.welcome`, `static.primer.nine_types[9]`). ~1 static set each. Only the client name/type is per-client (already handled).

**p5 Quick Reference** — computed + reuse.
- Leading & alternate one-sentence motivations → **AS-IS** reuse of `type_N.description.core_motivation` (×9 already exist).
- Subtype signature line + one-sentence subtype descriptor → **EDIT** (see p10 signatures).
- Four debrief tips → **NEW** (spec §7.2 marks them explicit placeholders). 4 static units.
- Heat map / instinct bars / ranking → **computed**, not authored.

**p6 Exploring Your Type (A)** — per type (×9):
| Zone | Cat | Source |
|------|-----|--------|
| Core Motivation narrative | EDIT (length) | `type_N.description.core_motivation` |
| Worldview | EDIT | `type_N.description.worldview` |
| Core Belief | NEW | no field today |
| At-a-Glance ×4 (Want / Attention / Avoid / Driving Emotion) | NEW | not in content_library (partial analogues in old `type_library.json`) |
| Typical Patterns ×3 (Thinking/Feeling/Behaving) | EDIT (shorten) | `type_N.patterns` |
| "In Your Own Words" | personalized | AI `client_words` — not authored |

**p7 Exploring Your Type (B)** — per type (×9):
| Zone | Cat | Source |
|------|-----|--------|
| At Your Best ×3 | EDIT (reformat to 2-line, bold label <20ch) | `type_N.strengths[3]` |
| Growing Edge ×3 | EDIT | `type_N.challenges[3]` |
| Communication chicklet: name + 3 bullets | EDIT (condense 4→3, extract name) | `type_N.communication` — *derived differently in mockup; the task flags this* |
| Conflict chicklet: name + 3 bullets | EDIT | `type_N.conflict` |
| Decision-Making chicklet: name + 3 bullets | NEW | no decision field exists |
| Catching Patterns: Signs ×3 + Interrupting ×3 | NEW/EDIT | Type-9 version is Claude-authored placeholder (spec §7.2); `type_N.practices` is adjacent but differently framed |

**p8 Your Wings** — per type (×9):
| Zone | Cat | Source |
|------|-----|--------|
| 2 wing overviews | EDIT (trim to overview) | `type_N.wings.wing_a/b.body` |
| 2 × 5 wing bullets | NEW | not in content_library (Type-9 only, in v3 mockup) |
| 2 "As a Resource" bands | NEW | content_library has resource text on **lines**, not wings |

> Note: spec §7.1 calls wings narratives + resource bands "authored (from v3, Hive-authored)." That is true **for Type 9 only** (it lives in the mockup, not the library). The other 8 types have the old single-body wing narrative and no bullets/bands.

**p9 Stress & Security** — per type (×9):
| Zone | Cat | Source |
|------|-----|--------|
| 2 point overviews | EDIT | `type_N.lines.stress/security.narrative` |
| 2 × 3 point bullets | NEW/EDIT | narrative is prose; bullets are new |
| 2 "Accessing the High Side" bands | EDIT | `type_N.lines.*.resource_card` |
| "Putting Resources to Work" ×3 | NEW | Type-9 in mockup only |

**p10 Instincts & Subtypes** — mixed:
| Zone | Cat | Source |
|------|-----|--------|
| 3 instinct definitions | AS-IS | `static.instinct_definitions[3]` |
| Subtype comparison: 3 columns × 3 zones (Where Energy / Inner Experience / Growing Edge) | NEW (restructure) | ×27 subtypes; `subtype.*.patterns`/`narrative` exist but in a different shape (81 zone-texts) |
| Two-word subtype signature (e.g. "Merging & Intensity") | NEW | ×27; no such field anywhere |
| Subtype formal name + nickname | EDIT | `subtype.name` + `subtype.tagline` (27/27 exist) |
| Ranking badges (Primary/Secondary/Tertiary) + "yours" column | computed | from instinct scores |
| "In Your Responses" | personalized | AI evidence — not authored |

> Spec §7.2 also references "nine SX9 shift bullets" and "two Leaning Into the Other Instincts blocks" on p10. **Neither appears in the `Instincts_v1` mockup HTML I audited** — the mockup shows the 3-column comparison instead. Flagged as a spec↔mockup inconsistency to resolve before authoring (see §7).

**p11 Development Ideas (CAR)** — per type (×9):
| Zone | Cat | Source |
|------|-----|--------|
| 3 capacity definitions + preambles | NEW (Cai-authored, mostly generic) | spec-only |
| 3 capacities × 3–4 per-type bullets (~10) | NEW | **0/9 authored** — CAR / Connection-Centered Leadership model absent from all built content |

**p12 Your Thoughts** — 5 reflection prompts, **AS-IS/NEW-light** (5 static units); rendered as `.qspace` boxes.

### Totals

| Category | Where it dominates | Approx. units (full catalogue) |
|---|---|---|
| **AS-IS** | static pages, instinct defs, motivations reused on p5 | ~25 |
| **EDIT** (reformat existing library content) | strengths, challenges, patterns, wing/line overviews, comm/conflict, high-side bands, subtype names | ~250 |
| **NEW** (blank-page) | CAR page (~120 across 9 types), subtype 3-zone comparison (81) + two-word signatures (27), decision-making style (~36), wing bullets/bands (~96), catching-patterns, at-a-glance, core-belief | ~330 |

**Answer to "40 or 400":** it is firmly in the **~400+** range for the full 9-type / 27-subtype catalogue (a single generated report surfaces ~50–60 of these). It is **not** 40. But the split matters more than the total: roughly **half is EDIT** — reformatting content that already exists in `content_library.json` to the new structural constraints — and the genuinely blank-page work concentrates in five places: **the CAR/Development-Ideas page, the subtype 3-zone comparison, two-word signatures, the decision-making style chicklet, and the wing bullets + resource bands.** Type 9 is done in all of them; eight types (and 24 subtypes) remain.

---

## 4. Open questions (spec §8)

**Q1 — Template vs rebuild.** Rebuild; mockup as reference. See §0.

**Q2 — CSS consolidation.** The 12 mockups carry 12 independent inline `<style>` blocks (~478 rules), no shared sheet, 39 hex values of which 18 are real tokens (spec §5). Cost is low and mechanical: extract one stylesheet, promote the 18 tokens to CSS variables, prefix component modifiers `is-` (spec §3.4), and drop the dead `.reflect`/`oklch()` block. **Because we rebuild, it belongs at the front** — created with (or immediately before) the first page so every subsequent page is authored against the shared sheet. Doing it late would mean consolidating twelve hand-re-inlined copies. Watch the near-duplicate page-local hexes (spec §5.1) — resolve each to a token or keep it deliberately, don't auto-merge by eye.

**Q3 — Diagram generation.** `buildEnneagramSVG({type, variant})` (`renderer.js:1066`) already renders base / type / my-report / wings-lines variants with correct flow (see Q via §5.2). **But the mockup wheels use a different geometry** — viewBox **430×252**, R=95, the node-angle set and label rules in spec §3.5 — whereas `buildEnneagramSVG` is **500×500**. The Quick-Reference heat map is a *third* geometry (360×352). So the production equivalent should **extend** `buildEnneagramSVG` with the two new client variants (and a heat-map renderer) rather than replace it — replacement would break the coach report, which depends on the 500×500 output. Geometry must be ported from the mockup verbatim and verified against `insightout_all18_diagrams_check.png`; spec §3.5 is explicit that formula-derived positions were wrong three times.

**Q4 — Quick Reference data. (Blocker — resolved: data is available today.)** The nine type scores are `apiResult.hypothesis.call1_ranking` (`{type,score}`, coherence) and the three instinct scores are `apiResult.hypothesis.instinct_score_profile` (`{SP,SO,SX}`). **Both are already reachable by the client generator:** `buildClientModel` already reads `call1_ranking` (to derive the near-tie flag, `report_prep.js:243`) and already computes `instinctBars(h.instinct_score_profile)` (`:245`) — it simply never renders them. The coach report renders both as 0–100 bars (`renderer.js:1337`, `:1341`). **So Quick Reference needs rendering work, not data plumbing.** No new pipeline, no new query. This is the reassuring answer: the page the spec worried most about is unblocked.

**Q5 — Score display / scale.** The underlying scale is a **0–100 coherence** value, **not a percentage of a whole** (`report_prep.js:15`, `renderer.js:1180` "Fixed 0-100 scale (no auto-scale)"; the coach report even prints "`X.X / 100`" at `renderer.js:723`). The mockup's `width:84%` bars therefore map directly (score → width%). Removing numbers from client charts breaks nothing downstream: the client already renders **no** type-score chart, and the computed client instinct bars are currently unused. For the heat map, node intensity must be normalized across the nine scores at render time (min→max), which is presentation-only. (Caveat: `renderer.js:396/414` compute a *share-of-total* percentage for the coach "center/instinct" display — a different normalization; don't reuse it for the client heat map.)

**Q6 — Editable PDF fields.** Confirmed: `page.pdf()` emits no AcroForm fields; the p12 boxes are `.qspace` divs (five of them), not `<input>`/`<textarea>`, so they render flat. Making them typeable needs a post-render stamping step (e.g. `pdf-lib`) that reads each `.qspace` bounding box at render time and overlays a form field — positions measured, never hard-coded (spec §6). Scope: one new dependency, a render-time coordinate export, a stamping pass, and cross-viewer testing (Acrobat/Preview/Chrome fill differently). **Recommendation: OUT for v1.** It touches every subsequent page's layout export, adds a viewer-compatibility test matrix, and delivers a "nice to have." Ship the visual report first; add stamping as a fast-follow once the 12 pages are pixel-locked.

**Q7 — Page numbering.** Today every footer is a literal per-page string with a hard-coded label, and `displayHeaderFooter:false` means Puppeteer adds nothing (`renderer.js` per-page footers). The mockups make the risk concrete: their footers number **Welcome=1 … Thoughts=10**, which is neither the spec's 12-page Contents pagination nor consistent with the Contents page they ship alongside. Production should derive the number from a single page-order array (the same array that renders the Contents page), so footer and TOC cannot drift. Small, and worth doing when the page sequence is assembled.

**Q8 — Single-sheet assertion.** Already exists: `scripts/render_client.js` sets `PAGE_PX=1056`, renders at `816×1056`, measures each page, and **fails the process** on any client page taller than one sheet (`enforceSheet`), plus asserts the expected page count. It is a script gate (run via `npm run verify:render`), not part of `npm test`. **Recommendation: keep it fail-hard (not warn) and wire it into CI**, re-pointed at the 12-page renderer with expected count 12. This is the assertion spec §3.1 demands, and it already caught real overflows.

---

## 5. Corrections (spec §4) — confirmed against the codebase

### 5.1 §4.1 — four wrong archetype names
**Status: already fixed in the report/library data; one doc still wrong; and the patch file is not what it says it is.**
- `app/type_library.json` and `content/type_library.json` **already read the names of record**: 3 = The Performer, 5 = The Observer, 6 = The Questioner, 8 = The Protector. They are byte-identical to each other. `type_meta.js` (the actual report name source) also uses these. So the "four wrong names" bug **is not present on `main`.**
- **The patch file is misleading.** Diffed against the current library, `docs/type_library_name_patch_080726.json` changes **no names**. Its only delta is a rewrite of the `static_primers` stress/security prose (1 paragraph → 4). **Do not apply the patch wholesale** — it would smuggle an unreviewed content change into a file billed as a name fix. If that expanded primer is wanted, review it as content on its own merits.
- **Still broken:** `reference/hive_27_subtype_reference.md:151` reads "TYPE 6 — The Loyal Skeptic." Real, unfixed. One-line fix.

### 5.2 §4.2 — reversed triangle + security arrow
**Status: the design-system *doc* is wrong; the *code* is already correct.**
- `docs/V2 Design Documents/hive_insightout_report_design_system_v1_3.md:145` states "Triangle sequence: 3→6→9→3" (reversed) and `:198–199` specify the security line as home→security with an arrowhead (wrong direction). Both confirmed present.
- **`buildEnneagramSVG` already works around both.** `renderer.js:1041` hard-codes `SVG_TRIANGLE = [[9,6],[6,3],[3,9]]` with a comment naming the doc error explicitly, and `:1044` orients security so it "follows the flow into home." The mockup Lines page renders the same correct directions. So §4.2 is a **documentation-only** fix — no code change needed, but the doc must be corrected before anyone re-derives geometry from it.

### 5.3 §4.3 — v3 mockup unreliable as a data source
**Status: partially stale — the HTML reference set is actually SX9-correct.** The spec warns the v3 mockup mirrors the wheel, drops node 2, and labels Anders SP9 throughout. In the **HTML files** I audited, none of that holds: the wheels are clockwise with node 2 present and matching §3.5 geometry, and the subtype is correctly "One-to-One Nine / SX·9" with instinct bars SP 66 / SO 64 / SX 84 (the coach-report values). The mirror/SP9 problems evidently lived in an earlier figure or the PDF, not this HTML set. The **guardrail still stands**: anything sourced from the mockup must be verified against the coach report / production output at build time — but treat the current HTML as the corrected reference.

**Sequencing of corrections:** bundle the two real fixes (`hive_27_subtype_reference.md` Type 6; the v1.3 doc geometry) into **one tiny standalone doc-correction PR ahead of the build** — both are independent, near-zero risk, and touch nothing the renderer runs. **Do not** include the `type_library_name_patch` file in it.

---

## 6. Recommended PR sequence

One PR at a time; each leaves client **and** coach reports working; each is validated before the next starts.

**PR 0 — Corrections & guardrails (docs only).** Fix `hive_27_subtype_reference.md` Type 6; fix the v1.3 design-system triangle/security text. No code, no renderer risk. *Validate:* proofread; confirm no code references the changed lines. *Breaks:* nothing.

**PR 1 — Foundation: consolidated stylesheet + Quick-Reference-free first page (Your Wings), one type, end to end.** This is spec §9's milestone, and I **agree with it** — Wings exercises diagram generation, per-type content lookup, the paired-column layout, and the fitting constraints, with no dependence on the score data. Fold the CSS consolidation (Q2) into this PR so page one is authored against the shared sheet: extract `app/report.css`, promote the 18 tokens to variables, add the 430×252 wings-lines client diagram variant to `buildEnneagramSVG`, render the Wings page for Type 9 from `content_library.json`, and re-point `scripts/render_client.js` at it. *Validate:* single-sheet assertion passes; rendered page diffs to the mockup; **coach PDF regenerated and byte/visually unchanged** (shared `renderer.js`/`buildEnneagramSVG`). *Breaks if:* the diagram-variant change perturbs the coach wheel, or a shared token rename hits coach CSS — both caught by regenerating the coach report.
> CSS consolidation lives **here**, at the front — the direct consequence of the rebuild decision (§0). Not a later PR.

**PR 2 — Static pages (Cover, Contents, Welcome, What Is, Your Thoughts).** All static content, all AS-IS from `static.*`. Establishes the page-order array and derived footer/TOC numbering (Q7). *Validate:* single-sheet on all five; footer numbers match the Contents page. *Breaks:* nothing shared with coach.

**PR 3 — Per-type static pages (Exploring A + B, Stress & Security).** The EDIT-heavy pages. Requires the reformatted strengths/challenges/patterns/wing/line content in the Word source first (design team). *Validate:* per-type render for all 9 types; single-sheet each; matched-column-count checks (spec §6). *Breaks:* nothing shared, but this is where the fitting constraints bite — expect iteration.

**PR 4 — Instincts & Subtypes.** Needs the new 3-zone subtype comparison and two-word signatures authored (27 subtypes). Renders the computed instinct ranking (data already available, Q4). *Validate:* all 27 subtypes; ranking matches instinct scores; single-sheet.

**PR 5 — Quick Reference (computed).** The heat map, instinct bars, leading/alternate node, subtype band. Depends on the Q4 score vector (already reachable) and the heat-map renderer. **Highest computed-rendering risk** and the §3.2 transparency issue lands here (see §7). *Validate:* render across several real assessments incl. a near-tie and a 20-point-clear leader; confirm the "Ask about the alternate" tip behaves for both (spec §7.3); single-sheet; **no transparency groups in the emitted PDF.**

**PR 6 — Development Ideas (CAR).** Entirely NEW content; gated on the design team authoring the CAR page for 9 types. Pure new page fragment. *Validate:* 9 types; title rule "Development Ideas for {plural}" (spec §6) for all nine; single-sheet.

**PR 7 — Cutover + obsolete removal.** Switch `generateReportPDFs` to the 12-page client renderer; remove the old client P8 Application page and interior reflection prompts; **retain** the alternate-type data/coach usage. Flip `verify:render` expected count to 12 and wire into CI. *Validate:* full end-to-end from a real assessment; client and coach both correct; `db.createReport` still records both.

**PR 8 (optional, post-v1) — Editable p12 stamping.** Only if Q6 is pulled in. Standalone post-render pass; no page-content risk.

**Milestone note:** I agree Wings is the right first page. The only adjustment to spec §9 is to **carry CSS consolidation into that same PR** rather than treat it as separate — otherwise page one is authored twice.

---

## 7. Risks

**Highest — the one computed visual violates the spec's own transparency rule.** The Quick-Reference heat map (the only per-client graphic) encodes the nine scores as SVG `fill-opacity` (0.10–1.0) and uses a `stop-opacity` gradient legend. That is exactly the transparency-group / soft-mask render path spec §3.2 forbids ("no `transparent`/`rgba()` reaching the PDF"), the same path blamed for the pink cover. Every other page is clean. **This must be resolved before p5 ships:** either §3.2 is narrowed to exclude SVG opacity (needs the same cross-viewer test that motivated §3.2 in the first place), or the score→intensity encoding is converted to **opaque** fills (pre-computed solid colors along the cyan ramp). I recommend opaque fills — it keeps the document's "zero transparency groups" guarantee intact. Flag raised now because it's invisible in code and only shows up in a PDF byte inspection.

**Font & Chromium are not pinned — spec §3.3's "most likely cause of a silent two-sheet page."** Production uses bundled Chromium (npm range) and no installed/pinned font; local dev uses whatever system Chrome is present. Every single-sheet measurement in the spec assumes Arial/Liberation Sans at a fixed Chromium. Until a metric-compatible font is installed **and** the Chromium version is pinned in the container, the single-sheet assertion is only valid on the machine that ran it. This is infra work that should precede PR 3 (where fitting gets tight).

**Spec ↔ mockup inconsistency on p10.** Spec §7.2 lists "nine SX9 shift bullets" and "two Leaning Into the Other Instincts blocks" on the Instincts page; the `Instincts_v1` mockup shows a 3-column comparison and neither of those elements. The p10 structure is therefore ambiguous — resolve *what actually renders* before the design team authors 27 subtypes' worth of it, or the authoring targets the wrong shape.

**The "Ask about the alternate" tip is unconditional but context-dependent (spec §7.3).** As global static it will tell a client whose leading type is 20 points clear to "ask about the alternate," which is nonsense for them. Either make it conditional on the near-tie flag (which the model already computes) or reword it to hold universally. Small, but it's live logic, not just copy.

**Shared-renderer blast radius.** `renderer.js`, `report_prep.js`, `buildEnneagramSVG`, and `partAStyles()` are the coach report's spine. Every client PR that touches them can silently change the coach PDF. Mitigation is cheap and mandatory: regenerate the coach report (`scripts/render_coach.js`) and diff it in every PR from PR 1 onward. Bake it into the validation checklist.

**Two SVG geometries + a heat map = three coordinate systems.** `buildEnneagramSVG` is 500×500; the mockup client wheels are 430×252; the heat map is 360×352. Porting must be verbatim-from-mockup and checked against the 18-diagram contact sheet — spec §3.5 documents three separate formula-derived geometry bugs. Do not "unify" the geometries to save code; they were measured, not chosen.

**Content is the critical path, not code.** The engine work is tractable and largely reuses existing plumbing. The schedule risk is the ~330 NEW units — the CAR page, the subtype 3-zone comparison, two-word signatures — none of which exist for eight types / 24 subtypes, all hand-authored, all gated by fitting constraints (§6) that can only be validated by rendering. PRs 3–6 will each stall on authoring, not engineering. Sequence the Word authoring to lead each page PR by a comfortable margin, and treat the single-sheet + matched-column assertions as the author's feedback loop, not just CI gates.

**Minor:** the `type_library_name_patch` file is a trap (§5.1) — applying it does nothing for names and quietly rewrites primer prose; a future engineer "applying the correction" would ship unreviewed content. Recommend renaming or removing it so it can't be mistaken for a safe patch.

---

## Appendix — key file references
- Pipeline: `app/server.js:5313` (`generateReportPDFs`), `:5044` (`launchBrowser`), `:5065` (`generatePDF`); `app/render_report.js:18`.
- Templating: `app/renderer.js:2487` (`buildClientReportHTML`), `:1530` (`buildCoachPdfOptions`), `:1066` (`buildEnneagramSVG`), `:1041` (correct triangle flow).
- Model/content: `app/report_prep.js:19,110,243,245`; `app/content/content_library.json`; `app/content_overrides.js`; `app/type_meta.js`.
- Assertion: `scripts/render_client.js` (`PAGE_PX`, `enforceSheet`).
- Corrections: `reference/hive_27_subtype_reference.md:151`; `docs/V2 Design Documents/hive_insightout_report_design_system_v1_3.md:145,198`.
- Mockup reference set: `docs/mockup/docs/mockup/claude_The_Peacemaker_Page_*.html` (12 files).
