# InsightOut by Hive
## Report Design System & Content Specification
### Version 1.3 · June 5, 2026 · Authoritative build reference

This document specifies how all InsightOut reports are built. It drives a deterministic templating + Puppeteer rendering pipeline and gives the engine clear content-generation constraints. Part A is the shared design language. Part B is the coach report. Part C is the client report. Both B and C inherit Part A.

> **HOW THIS DOCUMENT IS ORGANIZED**
> Part A is the shared Design System governing every InsightOut report. Part B is the Coach Report content spec. Part C is the Client Report content spec. Both B and C inherit Part A. Build Part A once; reference it everywhere.

> **V1.3 CHANGES FROM V1.2**
> — A6 fully rewritten: JPG static assets replaced by `buildEnneagramSVG()` function spec; three diagram variants locked with precise geometry, colors, and per-type lookup table

> **V1.2 CHANGES FROM V1.1**
> — Edge bars removed from both reports (A4)
> — Section label color corrected to Hive Blue 00B2D9 (A3)
> — "INSIGHTOUT ENNEAGRAM REPORT" header scoped to title page and TOC only (A4)
> — New A8: page container rules and content-fit requirement
> — New A9: static vs. personalized content model (Option B)
> — New A10: responsive HTML delivery intent (Session E)
> — Part C (Client Report) written for the first time at full spec level
> — TOC added as a required page in both reports
> — B8 data contract fully inlined (was "unchanged from v1.1" pointer); this document is now self-contained

> **RECONCILIATION STATUS**
> The data contract in B8 is reconciled against `typing-engine-v2` (committed HEAD, nine-type scoring). Field names reflect actual engine output.

---

# Part A — Shared Design System

*Governs all InsightOut reports. Colors, type, geometry, graphics logic, and cross-cutting content rules live here so they are specified once and inherited by every report type.*

## A1. Page geometry & rendering target

- Page size: US Letter, 8.5 × 11 in. InDesign reports this as 612 × 792 pt (72 pt/in).
- Rendering target: HTML/CSS rendered to PDF via Puppeteer. Convert pt to 96-DPI px: pt × 1.3333. So 612 × 792 pt → 816 × 1056 px.
- All InDesign ruler measurements in this spec are 72-DPI points. Convert with the 1.3333 factor.
- Margins: ~40 pt (0.55 in) left/right content margin. Confirm exact top/bottom against the .indd.
- Bleed: 0 on all sides. Correct for digital/PDF delivery.
- Set `@page` size explicitly. Force page breaks between pages. Each page is a fixed-height container; content is constrained to its zones (see A8).

## A2. Color palette

All values are RGB hex (document is RGB; no CMYK conversion needed). Percent-of-black grays are K-only tints converted to hex.

| Role | Hex | Notes |
|------|-----|-------|
| Hive Blue | `00B2D9` | Brand cyan. Section labels, inquiry lines, powerful questions, footer accents. |
| Hive Orange | `F68625` | Client name; bullet glyphs; instinct bars; orange accent boxes. |
| Body text (default) | `404040` | 75% black. |
| Section titles / row labels | `595959` | 65% black. |
| Alternate pill text | `333333` | 80% black. |
| Gut/Body center | `5271B7` | Types 8,9,1 bar fill AND center-label text. Also graph outline. |
| Heart center | `D38481` | Types 2,3,4 bar fill AND center-label text. |
| Head center — FILL | `BED6A8` | Types 5,6,7 bar fill only. Too light for text. |
| Head center — TEXT | `4F845C` | Center-of-Intelligence label text when Head. Same as confidence pill text. |
| Graph track (unfilled) | `D6D7D8` | Bar chart background track. |
| Leading hypothesis pill bg | `D9E4E9` | Also page 2 leading-column fill. |
| Leading pill title/text | `495A78` | Type number, name, subtype; page 2 column headers. |
| Confidence pill bg / text | `DFEAD8` / `4F845C` | Green confidence badge. |
| Alternate pill bg | `E6E7E8` | "Alternate: Type X" pill. |
| Page 2 callout / alt column | `F5F5EE` | Callout note bg; alternate-column fill on page 2. |
| Teal inquiry/callout box | `E8F6FA` | Client report inquiry boxes. Left border `00B2D9`. |

> **CENTER COLOR MAPPING — SINGLE SOURCE OF TRUTH**
> Gut/Body = blue `5271B7`. Heart = red `D38481`. Head = green (`BED6A8` fill / `4F845C` text). Shared by bar-chart fills, diagram triad shading, and Center-of-Intelligence labels. Only Head splits fill vs. text; Heart and Body use one value for both.

## A3. Typography

Typeface: Arial family throughout (Regular, Italic, Bold, Bold Italic). No dingbat fonts in the build; replace with CSS list markers.

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Report title | 13 pt | Bold | `404040` |
| Client name | 24 pt | Regular | Hive Orange `F68625` |
| "Prepared for" line | 10 pt | Regular | `404040` |
| Section labels (all-caps) | 9 pt | Bold | `00B2D9` (Hive Blue) |
| Body copy | 10/15 pt | Regular | `404040` |
| Bullets (pp. 1–2 coach) | 10/15 pt | Reg + sel. bold | `404040` |
| Pill: type number | 27 pt | Bold | `495A78` |
| Pill: type name | 14 pt | Bold | `495A78` |
| Pill: subtype | 10 pt | Regular | `495A78` |
| Confidence pill | 9 pt | Bold | `4F845C` on `DFEAD8` |
| Alternate pill | 9 pt | Italic | `333333` on `E6E7E8` |
| At-a-glance labels | 10 pt | Bold | Label `404040`; value colored |
| Bar chart labels | 11 pt | Bold | Center color / `404040` |
| Powerful questions / inquiry lines | 10 pt | Italic | `00B2D9` (Hive Blue) |
| Table col header (name) | 12 pt | Bold | `495A78` |
| Table col header (role) | 10 pt | Regular | `495A78` |
| Table row labels | 9 pt | Bold | `595959` |
| Table cell text | 10 pt | Regular | `404040` |
| Page 3 coach section titles | 9 pt | Bold | `00B2D9` |
| Page 3 coach bullets | 9/13.5 pt | Reg + sel. bold | `404040` |
| Footer | 7 pt | Regular | `999999` |

> **PAGE-3 STEP-DOWN (COACH REPORT)** Pages 1–2 run body/bullets at 10/15 pt. Page 3 steps down to 9/13.5 pt in a two-column layout. The 1 pt difference is intentional and creates the density needed on content-heavy pages.

## A4. Header, footer & edge bars

- **Edge bars: REMOVED.** Neither report uses a teal top bar or orange bottom bar. Removed in v1.2.
- **Title page header:** Hive logo top-left; "INSIGHTOUT ENNEAGRAM REPORT" (small Hive Blue label) top-right. This label appears ONLY on the title page and the TOC.
- **TOC header:** Same as title page.
- **Interior page header (all other pages):** Hive logo top-left; per-page section title below a thin rule. No "INSIGHTOUT ENNEAGRAM REPORT" label.
- **Footer (all pages):** 7 pt, `999999`. Three zones: © copyright left, page number center, confidentiality notice right.

## A5. Bar charts (deterministic, data-driven — never AI-generated)

- Two charts: Relative Type Pattern Strength (9 bars) and Relative Instincts Strength (3 bars). Generated from numeric scores by a templating function. The AI never touches these.
- **Data source for the 9 type bars:** `hypothesis.call1_ranking[].score` — the AI Call #1 COHERENCE judgment. NOT `type_score_profile` (raw sliders). Chart the coherence ranking. They differ by design; Call #1 exists to override self-report.
- Instinct bars use `instinct_score_profile {SP, SO, SX}`.
- Scale is fixed 0–100. Full track width = 100. Do NOT auto-scale to the max value.
- Track color `D6D7D8`. Type-bar fills use the Center color per type. Instinct bars all use Hive Orange `F68625`.
- Type chart sort order: numerical 8,9,1,2,3,4,5,6,7 (preserves Center grouping). Instinct: SP, SO, SX.
- Labels: type/instinct code at left (11 pt bold, colored); integer score at right. Round decimals to integers.
- Render as inline SVG for deterministic, crisp output.

## A6. Enneagram symbol — `buildEnneagramSVG()` function spec

All Enneagram diagrams are rendered as inline SVG by a single function in `renderer.js`. No static image files. The function signature is:

```js
buildEnneagramSVG({ type, variant })
// type: integer 1–9 (ignored for variant 'base')
// variant: 'base' | 'type' | 'wings-lines'
```

### Shared geometry (all variants)

All node positions are derived mathematically from a single center (250, 250) and radius (210), with nodes placed clockwise from the top at 40° increments:

| Node | Angle from top | x | y |
|------|---------------|------|------|
| 9 | 0° | 250.0 | 40.0 |
| 1 | 40° | 385.0 | 89.1 |
| 2 | 80° | 456.8 | 213.5 |
| 3 | 120° | 431.9 | 355.0 |
| 4 | 160° | 321.8 | 447.3 |
| 5 | 200° | 178.2 | 447.3 |
| 6 | 240° | 68.1 | 355.0 |
| 7 | 280° | 43.2 | 213.5 |
| 8 | 320° | 115.0 | 89.1 |

All line endpoints are trimmed 30px from each node center along the line's unit vector, so arrows and gaps land consistently at every node.

Hexad sequence: 1→4→2→8→5→7→1. Triangle sequence: 9→6→3→9.

Canonical flow direction (per client report design spec v3.0 §3.6, derived from `type_library.json`
`stress_point` data): home → stress point goes **with** the arrow; security point → home goes **with**
the arrow, so the client reaches their security point by moving **against** it. This holds for all nine
types without exception.

### Per-type lookup table

| Type | Stress point | Security point | Wings | Center |
|------|-------------|---------------|-------|--------|
| 1 | 4 | 7 | 9, 2 | Gut |
| 2 | 8 | 4 | 1, 3 | Heart |
| 3 | 9 | 6 | 2, 4 | Heart |
| 4 | 2 | 1 | 3, 5 | Heart |
| 5 | 7 | 8 | 4, 6 | Head |
| 6 | 3 | 9 | 5, 7 | Head |
| 7 | 1 | 5 | 6, 8 | Head |
| 8 | 5 | 2 | 7, 9 | Gut |
| 9 | 6 | 3 | 8, 1 | Gut |

### Center triad shading (variant `type` only)

Three wedge paths divide the circle from center to circumference at the midpoints between adjacent center triads:

- Gut/Head boundary: midpoint of 7–8 arc = (68.1, 145.0)
- Gut/Heart boundary: midpoint of 1–2 arc = (431.9, 145.0)
- Heart/Head boundary: midpoint of 4–5 arc = (250.0, 460.0)

| Triad | Types | SVG path | Fill | Opacity |
|-------|-------|----------|------|---------|
| Gut/Body | 8, 9, 1 | `M 250,250 L 68.1,145.0 A 210,210 0 0,1 431.9,145.0 Z` | `#5271B7` | 0.15 |
| Heart | 2, 3, 4 | `M 250,250 L 431.9,145.0 A 210,210 0 0,1 250.0,460.0 Z` | `#D38481` | 0.15 |
| Head | 5, 6, 7 | `M 250,250 L 250.0,460.0 A 210,210 0 0,1 68.1,145.0 Z` | `#BED6A8` | 0.50 |

White dividing lines (`stroke="white" stroke-width="1.5"`) from center to each boundary point.

### Variant: `base`

Used on: Client report Page 2 (Enneagram Primer), Coach report title page.

| Element | Spec |
|---------|------|
| Outer circle | `#00B2D9`, `stroke-width="8"`, no fill |
| All nodes | `r=22`, fill `#F7941D` |
| Node labels | `font-size="20"`, bold, white, `font-family="Arial,sans-serif"`, `dominant-baseline="central"` |
| All hexad + triangle lines | `stroke="#F7941D"`, `stroke-width="2"`, arrowheads on all lines |
| Arrowhead marker | Solid filled triangle, fill `#F7941D` |

### Variant: `type`

Used on: Client report Page 3 (Type Hypotheses), Coach report Page 1.

| Element | Spec |
|---------|------|
| Outer circle | `#00B2D9`, `stroke-width="8"`, no fill |
| Center triad shading | See table above |
| All hexad + triangle lines (inactive) | `stroke="#C8C8C8"`, `stroke-width="1.5"`, no arrowheads |
| Stress line (home → stress point) | `stroke="#D38481"`, `stroke-width="2.5"`, `stroke-dasharray="6,4"`, arrowhead |
| Security line (security point → home) | `stroke="#4F845C"`, `stroke-width="2.5"`, solid, arrowhead |
| Home base node | `r=26`, fill `#00B2D9` |
| Stress point node | `r=22`, fill `#D38481` |
| Security point node | `r=22`, fill `#4F845C` |
| Wing nodes (2 adjacent types) | `r=20`, fill `#A0A0A0` |
| All other nodes | `r=20`, fill `#C8C8C8` |
| Home base label | `font-size="19"`, bold, white |
| Active node labels (stress, security) | `font-size="17"`, bold, white |
| Inactive node labels | `font-size="17"`, non-bold, white |

Arrowhead markers: stress uses fill `#D38481`; security uses fill `#4F845C`.

### Variant: `wings-lines`

Used on: Client report Page 5 (Wings & Lines), Coach report Page 1 sidebar.

| Element | Spec |
|---------|------|
| Outer circle | `#C8C8C8`, `stroke-width="8"`, no fill |
| No triad shading | — |
| No hexad or triangle lines | — |
| Wing connectors (home → each wing) | `stroke="#C8C8C8"`, `stroke-width="2"`, no arrowheads |
| Stress line (home → stress point) | `stroke="#D0312D"`, `stroke-width="2.5"`, `stroke-dasharray="10,6"`, no arrowhead |
| Security line (home → security point) | `stroke="#4F845C"`, `stroke-width="2.5"`, solid, no arrowhead |
| Home base node | `r=26`, fill `#2E3F6F` |
| Stress point node | `r=22`, fill `#D0312D` |
| Security point node | `r=22`, fill `#4F845C` |
| All other nodes (including wings) | `r=20`, fill `#C8C8C8` |
| Home base label | `font-size="19"`, bold, white |
| Active node labels (stress, security) | `font-size="17"`, bold, white |
| Inactive node labels (including wings) | `font-size="17"`, non-bold, white |

No arrowheads on any line in this variant.

## A7. Cross-cutting content rules (all AI-generated prose)

### Bullet sizing rule (per section)
- Maximum 6 bullets per section.
- Each bullet ≤ 3 lines.
- ≤ 9 lines total across all bullets in a section.
- A paragraph break (space) between bullets.
- Word-budget proxy: 9 pt Arial two-column layout holds ~9 words/line in a ~240 pt column. So a 3-line bullet ≈ 27 words; a 9-line section ≈ 80 words. Verify against first render.

### Bold-density rule
- Bold only the 2–3 most important bullets per section — the ones that tell the story when read alone. Within a bolded bullet, bold the opening claim, not the elaboration. Bold falls early.

### Powerful-question and inquiry-line heuristics
- Under ~15 words. Open (never yes/no). One concept per question. Invites reflection on lived experience, not knowledge of the model. No jargon. 10 pt italic, Hive Blue.

### Near-tie rule
- Near-tie fires when the engine's coherence gap is "tight" (top two `call1_ranking` scores within 10 points). Display "Near-Tie (see notes)" in the confidence position.
- Near-tie is a SEPARATE signal from the confidence rating. High confidence and near-tie can co-occur.
- The engine still designates a leading type. Tiebreaker reasoning is explained in plain English, not via the number.
- Derive: `near_tie = (gap === "tight")`. The engine computes the gap; the AI writes the explanation; the data decides whether the indicator appears.

### Language & voice
- Warm, direct, plain-English. No clinical tone. Never use "Narrative" or "Narrative Enneagram" anywhere.
- Hypothesis-driven language throughout ("appears to," "consistent with," "worth exploring"). The report informs the debrief; it does not label the client.
- No engine/mechanics language in any prose.

## A8. Page container rules & content-fit requirement

**The container is fixed. The content must be written to fit it.**

- Every page renders as a fixed 816 × 1056 px container. There is no overflow — not because content is clipped, but because the AI and the prep layer generate content that fits.
- Each page has named zones (header, body, sidebar, footer) with fixed pixel budgets. The AI receives explicit word/line budgets per zone as prompt context.
- The prep layer must measure rendered zone height with Puppeteer's `getBoundingClientRect()` BEFORE PDF generation. Any zone exceeding its budget triggers a pre-render halt and regeneration cycle, not a silent clip.

| Page | Body zone height (px) | Column layout | Notes |
|------|----------------------|---------------|-------|
| Title | 680 | Single, centered | Hero + title block + client card |
| TOC | 750 | Single | 8 entry rows |
| Welcome (P1) | 800 | Single, centered | 3 paras + quote box + signatures |
| Enneagram Primer (P2) | 800 | Left text + right diagram | 9-type grid is static |
| Type Structure (P3) | 800 | Two-column | Type pill + motivation + table |
| Patterns (P4) | 820 | Full width, 3 sections | Each = intro + 2 cols + inquiry box |
| Wings & Lines (P5) | 820 | 60/40 two-column | Narrative left, diagram + sidebar right |
| Instinct & Subtype (P6) | 820 | 60/40 two-column | Narrative left, primer + stack right |
| Strengths & Challenges (P7) | 820 | Full width, 3 sections | S/C cards + subtype callout + practices |
| Application (P8) | 820 | Full width, 3 sections | 3 equal sections × 2 columns each |

## A9. Static vs. personalized content model (Option B)

**Static content is stored and retrieved; only designated personalized zones are AI-generated per assessment.**

- Static content library: ~203 content units written once per type/subtype (9 types × ~10 fields + 27 subtypes × 4 fields + 4 global statics). Generated in a dedicated content-generation session with Mo reviewing and approving all units. Stored with structured keys (e.g. `type_8.description`, `subtype_so8.narrative`).
- Personalized content: a small number of designated zones per report are AI-generated per assessment from `responses_snapshot` and engine output. See Parts B and C for the field-level breakdown.
- Build rule: if a field is not in the personalized-zones list for its page, it is static and retrieved from the library. The AI never generates content for static zones.

## A10. Responsive HTML delivery (Session E — future)

- The same content library and data contract used for PDF will drive responsive HTML templates.
- Responsive templates replace fixed-height containers with fluid layouts; the visual design (colors, hierarchy, components) is preserved.
- PDF remains available as a download option.
- Client access: time-limited magic link (30-day expiry) via SendGrid at report completion. No password for MVP.
- Future: full client login with retake history.
- Pre-requisite: confirm `db.js` has a clean one-to-one between assessment record and client email before Session E begins.

---

# Part B — Coach Report Content Spec

*Inherits all of Part A. Defines the 3-page coach report structure (plus a Page 4 placeholder).*

## B1. Page 1 — Orientation

Two-column layout. Left column = analytical prose; right column = visual orientation.

**Left column**
- LEADING TYPE HYPOTHESIS: type pill (number 27 pt, name 14 pt, subtype 10 pt) on `D9E4E9`, Confidence pill and Alternate pill beneath. Hero type is `confirmed_type` (Call #2), not `leading_candidate`.
- REDIRECT edge case: when `confirmed_type ≠ leading_candidate`, surface a short explanatory line. The bar chart renders from `call1_ranking`, so the top bar may differ from the hero on a REDIRECT.
- THE BOTTOM LINE: 1 short paragraph. Plain-English summary of the finding. No jargon, no scores.
- WHAT [CLIENT] REVEALED: up to 6 bullets (bullet-sizing + bold-density rules). Includes one bullet naming the alternate pattern and motivational distinction.

**Right column (at-a-glance)**
- Pre-made Enneagram symbol for the home type.
- Wings / Security-Stress / Center-of-Intelligence labels (10 pt bold; value text colored using the Center text color).
- Relative Type Pattern Strength chart (9 bars). Relative Instincts Strength chart (3 bars).
- Reminder line (italic, Hive Blue): these are hypotheses, meant to inform not label.

**Personalized fields (Page 1):** client name, coach name (DB); all left-column prose (AI Call #2); bar chart scores (engine); symbol (static asset by type); at-a-glance labels — wings, stress, release, center (type library lookups).

## B2. Page 2 — Type Hypothesis Comparison

- Leading-vs-alternate callout (`F5F5EE` bg, orange left rule): ~3 lines explaining why the alternate surfaced. AI-generated.
- Comparison table: Core Motivation, Focus of Attention, Energy Goes To, Gifts, Challenges, Key Discriminator, In [Client]'s Words. Leading column `D9E4E9`; alternate column `F5F5EE`.
- Row sourcing: `core_motivation`, `gifts` (← strengths), `challenges` are LIBRARY per type. `focus` and `energy` are LIBRARY per type — extract from the Cai typing-summaries doc into `type_library.json`. `discriminator` is AI-GENERATED per pair (the only pair-specific AI field on this page).
- "In [Client]'s Words" row: leading column = 1–2 verbatim quotes from `responses_snapshot`; alternate column = brief note on the absence of alternate-type language. AI selects verbatim quotes; never edits them.
- Static clarification questions: 6 short questions, identical on every report, in the template. Not a data field.

**Personalized fields (Page 2):** alternate-type callout note (AI); Key Discriminator row (AI, pair-specific); "In [Client]'s Words" row (AI selection from `responses_snapshot`); all other comparison rows are static library lookups.

## B3. Page 3 — Debriefing Tips

- Three sections: Debriefing the [Subtype]; Debriefing the Stress & Release Points; Debriefing the Wings. Two-column flow, 9 pt.
- Each section leads with a Powerful Question (10 pt italic, Hive Blue) then up to 6 bullets (bullet-sizing + bold-density rules).
- Subtype section: counter-type/lookalike notes, sequencing advice, client-specific foothold from their language.
- Stress/Release section: what each connecting point looks like, coaching angle, early-warning intervention.
- Wings section: both wings, note on which is more active, how to let the client lead.

**Personalized fields (Page 3):** all three section bodies (AI Call #2 `coach_report` fields); client-specific foothold references client language.

## B4. Page 4 — Coach-Type Preparation (PLACEHOLDER)

Reserved. Being designed offline. Will inherit Part A. Likely type-on-type (45 unique pairings), not subtype-on-subtype.

## B5. Confidence & near-tie indicator

- Confidence rating (High / Medium-High / Medium / Low) reflects overall data coherence.
- "Near-Tie (see notes)" indicator appears in the confidence position when `gap === "tight"` (top two within 10 coherence points). It signals type-clarification work for the debrief.
- Two distinct indicators that can co-exist. High confidence + near-tie is a valid and common combination.

## B6. Graphics inputs (coach report)

- Symbol: pre-made file selected by home type number.
- Type chart: 9 integer scores from `call1_ranking[].score`.
- Instinct chart: 3 integer scores SP/SO/SX from `instinct_score_profile`.
- At-a-glance text: wings (active named in text), stress point, release point, Center of Intelligence.

## B7. Validation gate (before render)

- Confirm every required field present (empty string OK, null not).
- Check each prose field against its word budget; truncate/regenerate/flag on overflow BEFORE Puppeteer runs.
- Confirm scores are integers 0–100. Confirm the symbol file exists for the home type.
- Wait for `document.fonts.ready` and a brief settle; set `printBackground: true`; pin viewport; force page breaks.

## B8. Data contract — reconciled against typing-engine-v2

Reconciled June 2, 2026. The prep layer assembles ONE fully-formed object for the template from three sources: engine output (AI calls), the type library, and the coach provisioning record.

**Key engine fields the prep layer reads:**
- `hypothesis.confirmed_type` (Call #2 — the page-1 hero) and `confirmed_type_name`.
- `hypothesis.leading_candidate` / `alternate_candidate` (Call #1 ranking positions).
- `hypothesis.call1_ranking[]` — nine `{type, score}` coherence entries. SOURCE for the 9-bar chart.
- `hypothesis.instinct_score_profile {SP,SO,SX}` — SOURCE for the 3-bar instinct chart.
- `hypothesis.dominant_instinct_hypothesis` — read THIS, not `confirmed_instinct` (see renderer bug note).
- `hypothesis.confidence_level` (HIGH / MEDIUM_HIGH / MEDIUM / LOW); `gap` label (tight/medium/wide); `stage4_outcome`.
- `coach_report.section2/4/5/6` — AI prose reshaped into `responses_revealed` and page-3 debrief blocks.
- `responses_snapshot` (DB column) — verbatim client open-response text for "In [Client]'s Words".

**Field-by-field resolution:**

| Template field | Status | Prep-layer action |
|----------------|--------|-------------------|
| `client.first_name` / `org` / `date` | EXACT / RENAME / DERIVE | first_name direct; org ← organization; date stamped at render. |
| `coach.full_name` | RENAME | ← `coaches.name`. |
| `coach.type` / `coach.instinct` | MISSING → ADD | Add to coach provisioning record; prep layer joins them in. |
| `hypothesis.leading_type` / `alternate_type` | RENAME | ← `leading_candidate` / `alternate_candidate`. |
| hero type (page 1) | EXACT | `confirmed_type`. Differs from `leading_candidate` only on REDIRECT. |
| type / subtype names | DERIVE/LIBRARY | Name lookups on type + instinct. |
| `dominant_instinct` | RENAME | ← `dominant_instinct_hypothesis` (NOT `confirmed_instinct`). |
| `confidence_level` | EXACT | Direct. |
| `near_tie` | DERIVE | = `(gap === "tight")`, i.e. top-two coherence within 10 pts. |
| `scores.types.1..9` | TRANSFORM | `call1_ranking[]` array → keyed map by type. COHERENCE, not sliders. |
| `scores.instincts` | EXACT | `instinct_score_profile {SP,SO,SX}`. |
| wings / stress / release / center | LIBRARY | `type_library` lookups (release_point ← security_point). |
| `active_wing` | OPEN | Not captured. Either add an AI field or show both wings without asserting active. |
| comparison rows: motivation, gifts, challenges | LIBRARY | `type_library` lookups (gifts ← strengths). Per type. |
| comparison rows: focus, energy | LIBRARY — EXTRACT | Content in Cai typing-summaries; extract into new per-type fields in `type_library.json`. |
| `comparison.rows.discriminator` | AI (new) | AI-generated per client: leading-vs-alternate motivational distinction for the actual pair. |
| `comparison.client_words` | SELECT + AI | Verbatim from `responses_snapshot`; a selection step picks leading-aligned quotes. Never edit the quote. |
| `comparison.note` | AI (new) | Short AI line on why the alternate surfaced; or reuse `section6` key_distinction. |
| `clarification_questions` | STATIC | Fixed set of 6, identical every report, in the template. Not a data field. |
| `bottom_line` | AI (new) | One-line coach summary; new field, or derive a lead sentence. |
| `responses_revealed[]` | TRANSFORM | Reshape `coach_report.section2.what_responses_showed` into ≤6 `{bold_lead, body}`. |
| `debrief.subtype / lines / wings` | TRANSFORM | Reshape `coach_report.section4/5` into `{question, bullets[]}`. |

> **RENDERER BUG TO FIX IN NEXT BUILD** `renderer.js` reads `confirmed_instinct`, but Call #2 emits `dominant_instinct_hypothesis`. The in-memory result may not populate `confirmed_instinct` (only the DB write mirrors it to a legacy column). The prep layer must read `dominant_instinct_hypothesis` directly. Verify and fix the existing path while in there.

> **TWO PER-TYPE SCORE SETS — DO NOT CONFUSE THEM** `call1_ranking[].score` = AI coherence judgment (the engine's verdict; CHART THIS). `type_score_profile` = raw self-report sliders. They differ by design — Call #1 exists to override self-report. Always use coherence for the chart.

---

# Part C — Client Report Content Spec

*Inherits all of Part A. Defines the 10-page client report (Title + TOC + 8 body pages). The client report is read by the client before their debrief session. Its job is recognition and curiosity, not full self-diagnosis.*

## C1. Page order

| # | Page title | Content type |
|---|-----------|--------------|
| 0 | Title page | Static + personalized (name, date) |
| TOC | Table of Contents | Static structure + personalized (name, type, date) |
| 1 | Welcome from Cai & Monique | Static body + personalized greeting |
| 2 | What Is the Enneagram? | Fully static |
| 3 | Your Type Hypotheses | Static type content + personalized (quote, alternate hypothesis) |
| 4 | How Your Type Shows Up | Fully static (retrieved by type) |
| 5 | Wings & Lines | Fully static (retrieved by type) |
| 6 | Instinct & Subtype | Static (by subtype) + personalized (In Your Responses box, instinct stack) |
| 7 | Strengths, Challenges & Growth | Fully static (retrieved by type) |
| 8 | Putting It All Together | Fully static (retrieved by type) |

## C2. Personalized content (AI-generated per assessment)

| Page | Zone | Content | Source |
|------|------|---------|--------|
| Title | Client name + date | First + last name; report date | DB |
| TOC | Client name, type, subtype, date | e.g. "Type 8 · Social Subtype · June 2026" | Engine + DB |
| P1 Welcome | "Welcome, [Name]!" heading | Client first name | DB: `assessments.client_first_name` |
| P3 | "In Your Own Words" quote block | 1–2 verbatim client quotes (≤60 words total) | AI selection from `responses_snapshot` |
| P3 | Alternate type hypothesis | Type name + number | Engine: `hypothesis.alternate_candidate` |
| P3 | Alternate type note | 2–3 sentences on why alternate surfaced (≤40 words) | Engine: AI Call #2 field |
| P6 | "In Your Responses" orange box | 3 bullets of client-specific instinct evidence (≤25 words each) | Engine: AI from `responses_snapshot` |
| P6 | Instinct stack | Leading / Supporting / Growing labels | Engine: `instinct_score_profile` ranked |

> **PAGES 4, 7, AND 8** In v1 (Option B) these pages contain NO personalized content. All content is retrieved from the static library by type. The "In Your Responses" personalization is handled entirely by the Page 6 orange box.

## C3. Title page (Page 0)

- Layout: centered, single column. Generic Enneagram symbol (all 9 types equal, no highlighting). Report title, tagline, client block.
- "INSIGHTOUT BY HIVE" supertitle (static). "Your Enneagram Report" title (static). Tagline: "Understanding yourself, from the inside out." (static).
- Client name (DB: `assessments.client_name`). Date (stamped at render). Footer: © + confidentiality (static).

## C4. Table of Contents (TOC)

- Layout: single column. Client block at top: name, type + subtype + date line (e.g. "Type 8 — The Protector · Social Subtype · June 2026").
- 8 entry rows: page title + short description + page number. All static except the client block.

## C5. Welcome page (Page 1)

- Layout: single column, centered. Large client first-name greeting, italic tagline, body paragraphs, quote box, Cai & Mo signatures with photos.
- "Welcome, [Name]!" heading (DB). Body paragraphs (3): static, key `static.welcome_body`. Quote box ("You are the final authority..."): static. Signature block and photos: static.

## C6. What Is the Enneagram? (Page 2)

- Fully static. Retrieved once, cached, identical for every client. Storage key: `static.primer` (entire page).
- Content: Enneagram intro paragraphs; Dynamic/Motivational/Relational three-pillar cards; Enneagram diagram; 9-type grid with one-line descriptions and gifts.

## C7. Your Type Hypotheses (Page 3)

Layout: two-column (60/40). Left = type pill + motivation + alternate note + quote + comparison table. Right = Enneagram symbol (home type highlighted) + legend.

| Zone | Content | Source |
|------|---------|--------|
| Type pill (number, name, subtype) | Static labels + type/subtype from engine | Engine + library |
| Core motivation statement | Static per type | `type_{N}.description.core_motivation` |
| Alternate hypothesis note | AI-generated (~40 words) | Engine: AI Call #2 |
| "In Your Own Words" quote block | 1–2 verbatim client quotes (≤60 words) | AI selection from `responses_snapshot` |
| Comparison table rows (motivation/focus/energy/gifts/challenges) | Static per type | `type_{N}.comparison` |
| "Key Discriminator" row | AI-generated per pair | Engine: AI Call #2 |
| Enneagram symbol | Pre-made static SVG, home type highlighted | Static asset by type |
| Disclaimer footer line | Static | Template |

## C8. How Your Type Shows Up (Page 4)

- Fully static. Retrieved by type. No personalized content in v1.
- Layout: full-width, 3 sections (Thinking / Feeling / Behaving). Each = full-width intro + two-column bullets + teal inquiry box.
- Content keys: `type_{N}.patterns.{thinking|feeling|behaving}.intro`; `.bullets`; `type_{N}.inquiry_lines`.
- Word budgets: intro ≤ 40 words; 6 bullets ≤ 80 words total; inquiry line ≤ 15 words.

## C9. Wings & Lines (Page 5)

- Fully static. Retrieved by type. No personalized content.
- Layout: 60/40 two-column. Left = wing narratives + line narratives. Right = Enneagram diagram (stress/security highlighted) + primers + resource cards.
- Content keys: `type_{N}.wings.{wing_a|wing_b}`; `type_{N}.lines.{stress|security}`; `static.wings_primer`; `static.lines_primer`; `type_{N}.lines.{stress_card|security_card}`.
- Word budgets: each wing narrative ≤ 70 words; each line narrative ≤ 60 words.

## C10. Instinct & Subtype (Page 6)

Layout: 60/40 two-column. Left = subtype narrative + pattern bullets + personalized "In Your Responses" orange box. Right = instinct primer + three instinct definitions + instinct stack.

| Zone | Content | Source | Type |
|------|---------|--------|------|
| Subtype name + tagline | Static per subtype | `subtype_{inst}{N}.name` | Static |
| Subtype narrative (2 paragraphs) | Static per subtype | `subtype_{inst}{N}.narrative` | Static |
| Pattern bullets (T/F/B) | Static per subtype | `subtype_{inst}{N}.patterns` | Static |
| **"In Your Responses" orange box (3 bullets)** | **AI-generated per client (≤25 words/bullet)** | **Engine: AI from `responses_snapshot`** | **Personalized** |
| About the Instincts primer | Static | `static.instinct_primer` | Static |
| Three instinct definitions (SP, SO, SX) | Static | `static.instinct_definitions` | Static |
| **Instinct stack (Leading / Supporting / Growing)** | **Derived from engine scores** | **Engine: `instinct_score_profile` ranked** | **Personalized** |

## C11. Strengths, Challenges & Growth (Page 7)

- Fully static. Retrieved by type and subtype.
- Layout: full-width. Strengths section (3 cards, static per type); Challenges section (3 cards, static per type); Subtype callout box ("As a [Subtype] — What Shifts", static per subtype); Practices that help (static per type).
- Content keys: `type_{N}.strengths`; `type_{N}.challenges`; `subtype_{inst}{N}.shifts`; `type_{N}.practices`.

## C12. Putting It All Together (Page 8)

- Fully static. Retrieved by type.
- Layout: full-width, 3 equal sections (Communication Style, Conflict Style, Coming Back to Center). Each section has a Hornevian/Harmonic/Center framework attribution line and two-column content.
- Content keys: `type_{N}.communication`; `type_{N}.conflict`; `type_{N}.center`.

## C13. Static content library — build checklist

~203 content units to author before launch. All generated in a dedicated content-generation session with Mo reviewing and approving.

| Content unit | Scope | Storage key |
|--------------|-------|-------------|
| Enneagram Primer page | 1 version | `static.primer` |
| Type description (motivation, worldview) | 9 types | `type_{N}.description` |
| Type patterns (thinking/feeling/behaving) | 9 types | `type_{N}.patterns` |
| Inquiry lines (3 per type) | 9 types | `type_{N}.inquiry_lines` |
| Wings descriptions (both wings) | 9 types | `type_{N}.wings` |
| Stress/security point descriptions | 9 types | `type_{N}.lines` |
| Strengths | 9 types | `type_{N}.strengths` |
| Challenges | 9 types | `type_{N}.challenges` |
| Practices that help | 9 types | `type_{N}.practices` |
| Application: communication / conflict / center | 9 types × 3 | `type_{N}.communication` / `.conflict` / `.center` |
| Type comparison rows (motivation/focus/energy/gifts/challenges) | 9 types | `type_{N}.comparison` |
| Subtype narrative (2 paragraphs) | 27 subtypes | `subtype_{inst}{N}.narrative` |
| Subtype pattern bullets | 27 subtypes | `subtype_{inst}{N}.patterns` |
| Subtype "What Shifts" tips | 27 subtypes | `subtype_{inst}{N}.shifts` |
| Instinct definitions + primer | 1 version | `static.instinct_definitions` / `.primer` |
| Wings/lines sidebar primers | 1 version | `static.wings_primer` / `.lines_primer` |
| Welcome page body text | 1 version | `static.welcome_body` |

> **BUILD ORDER** Build Part A as a shared CSS + template library first (colors as CSS variables from one source, the Center mapping in one object, the bar-chart and symbol components). Then Part B (coach report). Then Part C (client report). Run the full 27-subtype suite through both templates before any client sees one. Dedicate a separate session with Mo to generating and reviewing all ~203 static content library units before soft launch.
