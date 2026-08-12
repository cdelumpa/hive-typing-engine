# InsightOut Client Report — Design Specification v3.0

**Date:** 7 August 2026
**Status:** Design locked. Content and engine work not started.
**Supersedes:** Client Report CD Brief v2.0 (4 Aug 2026)
**Reference implementation:** 12 HTML files + `insightout_client_report_full_draft_080726.pdf`

---

## 0. Purpose of this document

This spec accompanies a complete twelve-page HTML mockup rendered to PDF. The mockup is the
reference implementation: it is real, live HTML rendered through headless Chromium, not a visual
comp. Every page has been measured to fit a single US Letter sheet.

**What is being requested from engineering, in this order:**

1. A **feasibility report** — everything that must be created, modified, or obsoleted in the current
   codebase to produce this report from assessment data. No code changes yet.
2. Joint ratification of that report, then a **proposed build plan** as a sequence of PRs.
3. One PR at a time, validated at each step.

This is a substantial change to the existing report architecture. The priority is not to break
working systems along the way.

**Roles:** Cai and Mo are designer and solution architect. Claude Code is lead engineer and QA.

---

## 1. What changed from the previous architecture

The current production report and the v3 mockup both differ substantially from this design.

**Removed:**

- **"The Peacemaker at Work"** and **"The Peacemaker in Relationships"** pages. Deferred to a future
  product or handled by the coach at debrief.
- **The alternate type page.** The alternate hypothesis now appears only as a labelled node on the
  Quick Reference heat map plus one sentence. The full discriminator treatment moves to the coach
  report, where it becomes a differentiator the iEQ9 coach report does not offer.
- **Centers of Intelligence.** Deliberately omitted. Alpha testers found it confusing without
  context, and naming it invites tri-type questions the report cannot answer in the space available.
- **All reflection prompts** on interior pages. Reflection is consolidated on the final page.

**Added:**

- **Quick Reference** (p3) — the only page carrying computed per-client data beyond the type itself.
- **Development Ideas** (p11) — the "out" in InsightOut. Courage, Agility, Resilience, from Hive's
  Connection-Centered Leadership model, applied at the "me" level only.

**Net:** 15 pages to 12, and roughly 120 of ~250 content zones removed.

---

## 2. Page structure

| # | Page | Content type | Notes |
|---|------|--------------|-------|
| 1 | Cover | Static + client name | Type symbol with home type highlighted |
| 2 | Contents | Static + client name | 9 entries |
| 3 | Welcome | Static | Letter from Cai & Mo. Signature and avatar assets are placeholders |
| 4 | What Is the Enneagram? | Static | All nine type cards. Identical for every client |
| 5 | Quick Reference | **Computed** | Heat map, leading + alternate, instinct bars, subtype, debrief tips |
| 6 | Exploring Your Type Hypothesis | Per-type static + 1 personalized zone | "In Your Own Words" quote |
| 7 | (continued) | Per-type static | Strengths/challenges, 3 styles, catching patterns |
| 8 | Your Wings | Per-type static | Wings diagram + two wing columns |
| 9 | Your Stress and Security Points | Per-type static | Lines diagram + two point columns |
| 10 | Instincts & Subtypes | Per-subtype static + 1 personalized zone | "In Your Responses" |
| 11 | Development Ideas | Per-type static | Courage / Agility / Resilience |
| 12 | Your Thoughts | Static | Five reflection boxes |

**Personalized zones total three:** the Quick Reference data block, the p6 client quote, and the p10
instinct evidence. Everything else is static content keyed to type or subtype.

---

## 3. Non-negotiable technical constraints

These are constraints discovered by rendering, not stylistic preferences. Each has a reason. If a
constraint appears arbitrary during implementation, the reason is stated so it can be evaluated
rather than silently optimised away.

### 3.1 Page geometry

- Page is **816 × 1056 px** (US Letter at 96dpi). Padding **40px top/bottom, 53px left/right**.
- Every page must render to **exactly one sheet**. The build must assert this. Two overflows during
  design were invisible in code and only caught by counting pages in the output PDF.
- Content budget is therefore **976px of vertical space**. Pages currently sit between 930 and 1047.

### 3.2 No transparency in print CSS

**Do not use the `transparent` keyword or `rgba()` in any CSS that reaches the PDF.**

In CSS, `transparent` is `rgba(0,0,0,0)`. Chromium emits a transparency group with soft masks for
any element using it. Some PDF viewers render that path with a colour cast — the cover page
displayed pink instead of blue in one preview client while rendering correctly in others.

Terminate gradient stops on the underlying opaque colour instead. On the cover this reduced the
page from 14 shading objects with 6 transparency groups and 3 soft masks, to **2 shading objects,
0 groups, 0 soft masks**, at 48.5 KB. The full document now contains zero transparency groups.

This is also the lightest option for client-side render time — no alpha compositing at all.

### 3.3 Fonts

Every page uses **Arial**. If the production container lacks it, Chromium substitutes and every
measurement in this spec shifts — line counts, last-line fill, single-sheet fit. Install a
metric-compatible font (Liberation Sans) or Arial itself, and **pin the Chromium version**.

This is the most likely cause of a page silently becoming two sheets in production.

### 3.4 CSS class namespacing

The shared page CSS owns short generic names: `.lead`, `.sub`, `.note`, `.page`, `.eyebrow`.
Component modifiers must be prefixed `is-`.

This bit twice during design, both times invisible in code:

- `class="krow lead"` picked up `.lead`'s 14px font and 24px bottom margin, opening a gap in the
  middle of a ranked list.
- `class="hhd sub"` picked up `.sub`'s 14px bottom margin, pushing one card's content 17px lower
  than its neighbour.

### 3.5 Enneagram diagram geometry

All diagrams share one geometry. ~~Verified across all 9 types on both page types — **54 labels, zero
clipped, minimum edge clearance 5px, minimum label-to-label gap 27.7px**.~~

> **Post-lock correction — 12 Aug 2026.** The verification claim above is **false on four counts**,
> all found by rendering during PR 1.
>
> - **Not zero clipped.** On **WINGS · TYPE 1** the 9-wing label ran through the home node and
>   collided with the home label. The "place above" rule below applied only to the *home* label, so
>   a non-home node at the top of the circle fell through to horizontal placement and defaulted to
>   one side. Type 1 is the only type whose home node sits immediately clockwise of the top, which
>   is why it was the only diagram affected — and why it survived review. Fixed with a general rule,
>   not a Type-1 special case.
> - **The 5px minimum was never met.** Real measured clearance was **4.47px**. The 5.88px figure
>   reported earlier in PR 1 was arithmetic over font size, not a measurement — it appeared in an
>   evidence table looking like one, and it was concealing a live failure.
> - **A second defect surfaced only on render.** The first fix stacked two-line labels above the
>   node; that pushed the eyebrow off-canvas and Chromium clipped it on four diagrams (WINGS 1,
>   WINGS 8, LINES 3, LINES 6).
> - **The 27.7px label-to-label minimum is not met either.** Measured minimum gap between distinct
>   labels is **24.12px** (tightest pair: WINGS · TYPE 4, "3 WING / The Performer" against "YOUR
>   HOME BASE"). Nothing overlaps, so this is a tighter layout than advertised rather than a defect.
>   Note that TYPE 4's labels are placed entirely by the horizontal rule and are untouched by the
>   placement change below, which suggests the 27.7px figure was not met by the original either.
>
> **Final placement rule.** Single-line labels at the top of the circle (the home eyebrow) stack
> above the node, centred — unchanged, and Type 9 still renders identically to the reference
> implementation. Two-line labels at the top (Types 1, 3, 6, 8) place **horizontally on the side
> away from home**, raised ~6px so they clear the neighbouring nodes, which sit only ~61px away.
>
> Stacking two lines above is **geometrically impossible**, not merely tight: a 13px node at cy=40
> leaves 27px of headroom, and 5px clearance plus two rendered text boxes needs ~27.4px. Note this
> lands *closer* to this section as originally written than the intermediate rule did — the spec
> only ever specified stacking for the **home** label.
>
> **Current verified state — all values measured, not derived:** minimum edge clearance **5.47px**
> (against the 5px requirement), minimum label-to-label gap **24.12px**, **zero overlaps** of any
> kind, across **18/18** diagrams. Measured via Chromium `getBBox()` in `scripts/verify_diagrams.js`,
> which fails on any label that is clipped, within 5px of a canvas edge, overlapping another label,
> or overlapping a node circle. Enforced in CI, so a longer archetype name in future content cannot
> quietly break the geometry.
>
> The gate asserts **non-overlap**, not the 27.7px figure, since that figure was never met. If a
> minimum separation is wanted as a design rule, set it from the measured 24.12px baseline.

```
viewBox        430 × 252
radius R       95
centre         cx = VW/2 = 215,  cy = R + 40 = 135
node radius    home 15, resource 13, inactive 11
label offset   DX = 22 from node centre, horizontal
home label     ABOVE the node when it is at the top of the circle (dy < -0.8);
               horizontal placement for every other position
rendered at    378 × 222 px, giving a 167px circle
```

**Node angles (degrees, clockwise from 9 at top):**
`9:-90  1:-50  2:-10  3:30  4:70  5:110  6:150  7:190  8:230`

**Do not derive label positions from a formula without rendering.** Three separate bugs were found
this way during design: wrong node positions per type, untested eyebrow strings (which are wider
than the archetype names), and the home label never being tested at all. Each time the arithmetic
said fine and the render disagreed. Generate all 18 diagrams and inspect them.

**This is a required step, not an assumption** (added 12 Aug 2026). Three further defects in this
area during PR 1 were invisible in code and visible only on render: the Type 1 collision, the
clipped eyebrows from the first fix, and a clearance figure that was derived from font size rather
than measured and so reported a passing 5.88px over a failing 4.47px. The instruction above had been
treated as satisfied rather than performed. It is now automated — `scripts/verify_diagrams.js`
renders all 18 and asserts the geometry in CI — but the automation replaces the arithmetic, not the
looking: regenerate the contact sheet and inspect it whenever placement changes.

### 3.6 Canonical flow direction

Derived from `type_library.json` `stress_point` data, not from memory:

- Hexad: **1 → 4 → 2 → 8 → 5 → 7 → 1**
- Triangle: **9 → 6 → 3 → 9**
- Home → stress point goes **with** the arrow. Security point → home goes **with** the arrow, so the
  client reaches their security point by moving **against** it.

This holds for all nine types without exception.

---

## 4. Corrections required in existing artifacts

These are bugs in current project files, found during design. They are independent of any design
decision and should be fixed regardless.

### 4.1 `type_library.json` — four wrong archetype names

| Type | Library says | Name of record |
|------|--------------|----------------|
| 3 | The Achiever | **The Performer** |
| 5 | The Investigator | **The Observer** |
| 6 | The Loyal Skeptic | **The Questioner** |
| 8 | The Challenger | **The Protector** |

The library is the outlier — the stage 4 handoff, the 27-subtype reference, and the design system
already use the names of record. Each name appears exactly once, in the `name` field. Wings, stress
and security are stored as integers, so no cross-references break.

**Patched copy:** ~~`type_library_name_patch_080726.json`~~

> **Post-lock correction — 11 Aug 2026.** The file above **corrects no archetype names**: all nine
> names in `type_library.json` already match the names of record. Its only real delta is an
> unreviewed rewrite of the `static_primers` stress/security prose. It has been renamed to
> `type_library_stress_security_primer_draft_080726.json` and **must not be applied**; treat the
> prose as a draft to be reviewed on its own merits. The one genuine name bug in §4.1 is the
> `hive_27_subtype_reference.md` Type 6 entry noted below (fixed 11 Aug 2026). See feasibility
> report §5.1.

Type 6 is also wrong in `hive_27_subtype_reference.md`.

### 4.2 Design system v1.3 — reversed line geometry

- States "Triangle sequence: 3 → 6 → 9 → 3". **Reversed.** Correct is 9 → 6 → 3 → 9.
- Specifies the security line as home → security point with an arrowhead. **Wrong direction.**
- The hexad sequence is stated correctly.

Both must be fixed before `buildEnneagramSVG()` renders arrows anywhere.

### 4.3 v3 mockup is unreliable as a source

The v3 client report mockup has been wrong about client data twice:

- Its Enneagram figure is mirrored (counterclockwise numbering) and **missing node 2** entirely,
  which also makes the interior lines wrong.
- It labels Anders **SP9** throughout, including the TOC. The coach report gives SP 66 / SO 64 /
  **SX 84**, and the production client report says One-to-One Nine.

Anything sourced from v3 must be verified against the coach report or production output.

---

## 5. Design tokens

Of 39 distinct hex values in the mockup, **18 appear on 3+ pages and are system tokens.** The rest
are page-local and should be reviewed during the CSS consolidation — several are near-duplicates.

### 5.1 Core tokens (existing)

| Token | Hex | Use |
|-------|-----|-----|
| Cyan | `#00B2D9` | Eyebrows, accents, home type, active state |
| Dark Navy | `#1E2A35` | Primary text, headings |
| Soft Navy | `#4A5568` | Secondary text |
| Grey | `#6B7785` | Labels, tertiary text |
| Rule | `#C8D0D9` | Rules, borders |
| Orange | `#F68625` | **Client identity only** |
| Leading BG | `#D9E4E9` | Framework panels |
| Border | `#E8ECF0` | Card borders |
| Panel | `#F7FBFC` | Card headers |
| Alt BG | `#F5F5EE` | Quote blocks |

### 5.2 New tokens introduced by this design

| Token | Hex | Use |
|-------|-----|-----|
| Subtype BG | `#F9E7D2` | Subtype identifier band, client's subtype column |
| Subtype Label | `#C2650F` | Label text on Subtype BG |
| Evidence BG | `#FDF3E9` | "In Your Responses", with a 3px `#F68625` left border |
| Green fill | `#E8F4E8` | Resource bands ("As a Resource", "Accessing the High Side") |
| Green label | `#2D7A2D` | Label text on green |
| Red fill | `#FAE8E8` | Automatic-movement bands |
| Red label | `#A32D2D` | Label text on red |
| Stress node | `#D38481` | Stress point node and dashed line |
| Security node | `#4F845C` | Security point node and solid line |

### 5.3 The colour rule

**Blue-grey means the framework. Orange means the client.**

Orange appears in exactly four places: the client's name in every page header, the cover
identifier, the subtype identifier and column, and the "In Your Responses" block. A client can find
what is about *them* without reading. This must not be diluted.

---

## 6. Content authoring guardrails

These are **structural, not word counts.** The previous spec used word counts fitted to a layout
that no longer exists. Structural constraints survive layout changes and are what a writer can hold
in mind across nine types.

| Zone | Constraint | Why |
|------|------------|-----|
| Strengths / challenges bullets | Exactly **2 lines**. Bold label under 20 chars, total under 90 | Bold Arial is ~2× width per char. A 99-char bullet with a 29-char bold label wraps to 3; a 98-char bullet with a 15-char label fits 2 |
| Practice bullets (p7) | **1 line**, under 47 chars | Six single lines scan as a checklist |
| Style names (p7) | **1 line**, under 24 chars | Longer names wrap and break header alignment across the three cards |
| Pattern / shift bullets | ~27 words, last line **>50% of column width** | Line count is not the issue — stranded 13–20% last lines are what read as ragged |
| Paired column overviews | **Matched line counts** between columns | Verified programmatically, not by eye |
| Subtype comparison zones | 3–4 lines, last line >50% | |
| Diagram labels | Under **88px** at 11px Arial (~17 chars) | Includes the eyebrow strings, which are wider than the names |
| "How You May Experience SP/SO/SX" | Exactly 25 chars, fits 1 line | No headroom at current column width |
| CAR page title | `Development Ideas for {plural}` | Strip "The" from archetype name, add `s`. All nine work |

---

## 7. Content status

### 7.1 Authored and approved

- Wings narratives and resource bands (from v3, Hive-authored)
- Lines narratives and high-side bands (Static Content Library v1.2, Mo-approved)
- The three instinct definitions
- The three subtype comparison columns

### 7.2 Claude-authored in the mockup — requires review before it becomes canon

- **The nine SX9 shift bullets (p10).** Converted from Hive-authored SP9 copy; the SX versions are
  written from general Enneagram knowledge, not lifted from the Static Content Library.
- **The two "Leaning Into the Other Instincts" blocks (p10)** — rewritten for SX.
- **The three CAR capacity practices (p11)** — structure is canon-derived (avoidance, resource
  points, holy idea), specific lines are not. Definitions and preambles are Cai-authored.
- **The four debrief tips (p5)** — explicit placeholders.
- **All Type 9 practice bullets (p7).**

### 7.3 Known content gaps

- Type 9 is the only type authored. Eight remain.
- The subtype signature (`Merging & Intensity`) is a new three-part naming convention: formal name,
  nickname, two-word signature. Only the three Type 9 subtypes exist.
- One "In Your Responses" bullet on p5 — "Ask about the alternate" — only makes sense when a second
  pattern scored close. As global static content it needs to hold for a client whose leading type is
  20 points clear, or become conditional.

---

## 8. Open questions for the feasibility report

1. **Template vs rebuild.** Should the generator use these HTML files as templates, or rebuild in
   the production framework with the mockup as visual reference?

2. **CSS consolidation.** 478 rules across 12 inline `<style>` blocks, no shared stylesheet. What
   does extracting a shared stylesheet cost, and does it belong in the first PR or a later one?

3. **Diagram generation.** All 18 diagrams (9 types × 2 page types) are generated from one Python
   function in the mockup. Where does the production equivalent live, and does it replace
   `buildEnneagramSVG()` or extend it?

4. **Quick Reference data.** The heat map and instinct bars need all nine type scores plus the three
   instinct scores. The coach report has them. Are they exposed to the client report generator today?

5. **Score display.** Numeric values were deliberately removed from the client-facing charts. Confirm
   the underlying scale is not a percentage, and that removing the numbers does not break anything
   downstream.

6. **Editable PDF fields.** Chromium's print-to-PDF does not emit AcroForm fields; `<input>` and
   `<textarea>` render flat. Making p12 typeable requires a post-render stamping step. Field
   positions should be **measured at render time** from the `.qspace` elements, not hard-coded, or
   copy changes silently break them. Scope this — is it in or out?

7. **Page numbering.** Footers are hard-coded in the mockup. Where does numbering live in production,
   and how does it stay in sync with the contents page?

8. **Single-sheet assertion.** Where in the build does this go, and does it fail the build or warn?

---

## 9. Suggested first milestone

**One type, one page, end to end.** Data in, PDF out, single-sheet assertion passing.

This proves the pipeline before any content authoring and surfaces the font and Chromium-version
issues immediately rather than at page nine.

Recommended page: **Your Wings.** It exercises diagram generation, per-type content lookup, the
paired-column layout, and the fitting constraints, without needing the computed score data that
Quick Reference requires.

---

## Appendix — reference files

| File | Contents |
|------|----------|
| `insightout_client_report_full_draft_080726.pdf` | 12-page rendered mockup |
| `claude_The_Peacemaker_Page_*.html` | 12 reference implementations |
| ~~`type_library_name_patch_080726.json`~~ → renamed `type_library_stress_security_primer_draft_080726.json` | **Corrected 11 Aug 2026:** corrects no names — do not apply. Unreviewed stress/security primer-prose draft (see §4.1 note and feasibility report §5.1) |
| `insightout_all18_diagrams_check.png` | All 18 diagrams, contact sheet. **Regenerated 12 Aug 2026 from the production implementation** (`buildEnneagramSVG`), so it is now a regression baseline rather than an independent check of it — it no longer verifies the renderer, it records what the renderer produces. Regenerate and inspect whenever placement changes |

**Rendering note:** every page in the mockup was rendered through headless Chromium via the same
`Page.printToPDF` DevTools call Puppeteer uses. The mockup PDF *is* a Chromium print output, not an
approximation of one.
