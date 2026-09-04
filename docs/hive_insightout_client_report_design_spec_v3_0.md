# InsightOut Client Report — Design Specification v3.0

**Date:** 7 August 2026
**Status:** Design locked. Engine work in progress — see §4.4 for shipped departures from the
mockup, and §7.3/§7.4 for content status.
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

### 4.4 Deliberate departures from the mockup (sheets 6 and 7)

§4.3 covers places the mockup is simply *wrong*. These are different: places where the shipped
renderer **intentionally differs** from `LeadingType_A_v1` / `LeadingType_B_v1`. A pixel-diff
against those files will flag ~~all three~~ **all four** (M4 added 3 Sep 2026). **They are not
regressions — do not "fix" them back.** Each is also commented at its definition in
`app/renderer.js`.

| # | Departure | Mockup | Shipped | Why |
|---|-----------|--------|---------|-----|
| M1 | At-a-glance labels | `What Nines Want` / `Where Nines Turn Their Attention` / `What Nines Tend to Avoid` / `Driving Emotion` | `Core Desire` / `Attention Goes To` / `Avoidance` / `Driving Emotion` | The locked wording in the four p6/p7 source docs, which head these zones with the new labels. `Driving Emotion` is the tell — it is identical in both, so the doc headings are labels, not zone names. Ratified 20 Aug 2026. |
| M2 | Space above each sheet-7 `h2` | 30px (`.two-col`, `.styles`), with `h2` margin-bottom 14px | 20px, with `h2` margin-bottom 10px | The two Exploring mockups disagree with each other — sheet 6 uses 20px above / 10px below, sheet 7 uses 30px / 14px. The original port already resolved the *bottom* half in sheet 6's favour (the shared `h2` rule is 10px), leaving the sheets inconsistent in opposite directions. This finishes the normalisation and buys 20px on the tightest page in the document. Ratified 20 Aug 2026. |
| M3 | Glance label gutter | none — label box is `flex:0 0 92px` with no padding, value starts where it ends | `padding-right:10px` inside the 92px | A consequence of M1, not a free choice. `ATTENTION GOES` renders 89.42px into the 92px box — a 2.58px gutter against 22–45px on the other three — and collides with the value text. Hidden while the labels were long plurals, which broke into short lines. The padding is *inside* the flex basis so the **value column stays 221.5px**; the glance budgets (80 and 111 chars) were measured at that width and taking the gutter out of the value would invalidate them. |
| M4 | p6 diagram home node | all nine nodes equal — `rNode` 12.5, numeral 12 | home node `rNode` **16**, home numeral **15**, plus the fill and stroke | The mockup draws the home node larger, not merely filled. This **departs from §3.5's equal-radii convention**, which the cover and What-Is wheels follow — those differentiate home BY FILL ONLY and keep all nine radii equal. Ported as drawn rather than normalised, because the mockup is the design reference and silently "fixing" it would be a design decision taken inside a build. **Note it is two changes, not one:** the numeral grows with the node (`homeFs` 12 → 15), so a pixel-diff flags both. Defined at `EXPLORE_GEO` in `app/renderer.js`, where the comment is now the pointer to this row rather than the record. Recorded 3 Sep 2026; **the departure itself is still open for Cai and Mo** — this row documents what ships today, it does not ratify it. |

~~A fourth difference~~ **A further difference** is content, not design: **Type 9's p6/p7 prose is
no longer the mockup's.** See §7.4 for the source of record, and §7.2 for the one part of it still
unlocked. (Reworded 3 Sep 2026 — "fourth" referred to the count when the table held three rows, and
M4 now occupies that number. This difference is deliberately *not* an M-row: the M-rows are design
departures, this one is content.)

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
| Pattern / shift bullets | ~~\~27 words, last line **>50% of column width**~~ **53–88 characters** (see the bands below); last line **not below 25%** of column width, >50% aspirational | Line count is not the issue — stranded 13–20% last lines are what read as ragged |
| Paired column overviews | **Matched line counts** between columns. Scope of enforcement: **§6.1** | Verified programmatically, not by eye |
| Subtype comparison zones | 3–4 lines, last line ~~>50%~~ **not below 25%**, >50% aspirational | |
| Diagram labels | Under **88px** at 11px Arial (~17 chars) | Includes the eyebrow strings, which are wider than the names |
| "How You May Experience SP/SO/SX" | Exactly 25 chars, fits 1 line | No headroom at current column width |
| CAR page title | `Development Ideas for {plural}` | Strip "The" from archetype name, add `s`. All nine work |

> **Post-lock correction — 3 Sep 2026.** Two corrections to the table above, both established by
> the 12 Aug fit spike (`scripts/spike/explore_fit_probe.js`) — measured in the real v3 renderer
> against the shared stylesheet, pinned Chromium, Arial asserted, line counts from
> `Range.getClientRects()` merged by top edge.
>
> - **Word counts do not predict wrapping; character counts do.** One row had kept a word count
>   (`~27 words`) under a preamble that already declares these guardrails "structural, not word
>   counts" — the row contradicted the section it sits in. Two strings of equal word count wrap
>   differently on word shape alone. The measured bands, at the pattern-body column width:
>
>   | Characters | Renders as |
>   |------------|------------|
>   | **≤ 52** | one full line |
>   | **53–70** | the ragged band — two lines, last holding only **6–33%** |
>   | **71–88** | two lines, well filled at **50–81%** |
>
>   53–70 is the band to write *out* of, not into. It is the only range that reliably produces the
>   stranded last line the "Why" column describes.
>
> - **">50% last line" was never a gate, and asserting it as one was wrong.** The approved Type 9
>   page misses it on **5 of its 11 multi-line zones**. A rule that ratified content fails is not a
>   gate; enforcing it would have rejected approved work. The honest discriminator is **nothing
>   below 25%** — that is what separates the ragged band from the well-filled one in the measured
>   data. **>50% remains the target to write toward, and is aspirational, not enforced.**
>
> Applied to both rows that carried the >50% figure: Pattern / shift bullets, and Subtype
> comparison zones.

### 6.1 Matched line counts — scope of enforcement

*Added 3 Sep 2026. This scopes the rule the table already states; it does not add one.*

The "matched line counts between paired columns" rule has been in this section since the spec was
written and has **never been enforced**. The table said "verified programmatically" without saying
what that verification covers, so nothing was ever built.

| Surface | Pairs | Enforcement |
|---------|-------|-------------|
| **p6 / p7** | `worldview` / `core_belief`; `best` / `edge` (`.v3-tb-two`); `signs` / `interrupt` (`.v3-tb-practice`) | **HARD GATE** |
| **p8 Wings, p9 Lines** | their paired columns | **REPORT-ONLY** |

**Why p8/p9 are report-only rather than exempt.** Both shipped before any such check existed, so we
do not yet know whether they satisfy the rule this section already states. Gating them would turn a
PR 3 deliverable into a retro-fix of two merged pages. Reporting them tells us the answer at no
cost. **A clean p8/p9 result promotes the rule to document-wide.** If they turn out to fail, §6
gets a dated correction recording that the stated rule was never met there — the pages do not get
retrofitted inside a PR 3 gate.

**The rule cannot be derived from content.** Line count is a function of character count, word
shapes **and** column width, so it requires rendering. This is the same failure mode the fit spike
caught in its own method: a single growing string samples one wrap path, not the ceiling, and
validating that against shipped content failed immediately. The instrument already exists —
`scripts/spike/explore_fit_probe.js` merges `Range.getClientRects()` by top edge to produce
per-zone line counts. Building the gate is promoting that core out of `spike/`, not new research.

**Derive the gate from the four built types (1, 4, 7, 9), not nine.** The five unbuilt types have
no strings to measure. The point of the check is to catch drift *while* the remaining types are
authored, so waiting for all nine to exist inverts it.

### 6.2 The client-quote zone — "In Your Own Words" (p6)

*Added 3 Sep 2026.*

Every other band in this section assumes a writer working to a budget. This zone has no writer:
it is the client's own verbatim language, read from `client_words.leading_quotes` off the Call #2
result. It is the **only per-client zone on either Exploring sheet** — everything else there is
per-type library content. The constraint therefore lives at **generation and selection time — at
the point the quote is chosen, before it ever reaches the renderer.** Not in an authoring
guideline, because there is no author; and **not at render.** This subsection exists because §6
otherwise has no concept of a zone whose length nobody controls.

| Control | Applies at | Value | Status |
|---------|-----------|-------|--------|
| Character cap, **including** quotation marks | **selection / generation** | **270** | ⚠️ **PROVISIONAL** — see below |
| 3-line assertion | **render** | quote band renders in **3 lines** | backstop — **fails loudly, never truncates** |
| Fourth line | render | tolerated overflow, **not design** | — |

**270 is neither measured nor derived. It is an estimate, and the spec should say so until it is
replaced.** It is bracketed by two real figures and sits between them:

- The ratified mockup's own example quote: **267 characters including marks**, 265 without, 45
  words, mean word length 4.91, longest word 11.
- **290** — the highest value *measured* safe at three lines. This is the top of what was tested,
  **not a bound anyone established.** Nothing above 290 has been measured, in either direction.

**Replacing the estimate is a single measurement, not an investigation.**
`scripts/spike/explore_fit_probe.js` is the instrument: sweep the band zone upward across distinct
real-prose samples until a fourth line appears, and set the cap from the measured SAFE threshold
minus a margin. Then delete "PROVISIONAL" here and record the measured figure and its date.

**Why the cap alone is insufficient — and why that does not make the render assertion the
mechanism.** Character count does not determine wrap; word shapes do. A 285-character quote of long
words can take a fourth line where a 295-character quote of short ones does not. Any character cap
is therefore a *heuristic* over the real constraint, which is why a render-time check is needed at
all.

But the render check is a **detector, not a control.** It asserts; it does not edit. Its job is to
fail loudly so a miss is caught before the report ships — **not** to rescue an over-long quote by
cutting it. The cap at selection time is what keeps quotes off the boundary in the first place, and
it is the only place any shortening ever happens.

> ⚠️ **Do not build a truncator into the renderer.** The failure this guards against is a report
> that cuts a client's sentence in half at layout time. The correct behaviour is to never select an
> over-long quote; the correct behaviour on a miss is a **loud failure**, not a silent cut. If the
> 3-line assertion fires, the fix belongs upstream at selection — not in the renderer.

**Truncation convention.** Stated here rather than left to whoever implements it. All of it applies
**at selection time**, per the enforcement point above — none of it describes renderer behaviour.

**Every point below is tagged. Do not treat a `PROPOSED` point as spec.** `SETTLED` points are
ratified and may be implemented as written. `PROPOSED` points are drafted, awaiting Cai and Mo, and
**must be ratified before they are built** — they record a recommendation, not a decision.

1. ✅ **SETTLED** — Apply the cap to the **joined** string. Where a client has two quotes, P3 joins
   them with `' … '` (space, U+2026, space) and this zone uses the same join, so the pair is one
   string for the purpose of the cap.
2. ✅ **SETTLED** — **Never truncate mid-word.** Cut at the last word boundary that keeps the
   total — including both quotation marks and the ellipsis — at or under the cap.
3. 🔶 **PROPOSED — awaiting ratification.** Append a single **U+2026**, with **no space before it**,
   inside the closing quotation mark. Do not use three periods, and do not stack an ellipsis onto a
   quote that already ends in one.
4. 🔶 **PROPOSED — awaiting ratification.** Where a *pair* of quotes would exceed the cap, **drop
   the second quote entirely rather than truncating it to a fragment.** A truncated second quote
   reads as the client trailing off mid-thought when in fact it is the layout speaking. This is an
   editorial decision about how a client's own words are presented, not a layout one, which is why
   it is not settled here.
5. 🔶 **PROPOSED — awaiting ratification.** If a **single** quote alone exceeds the cap, truncate it
   per 2–3. There is no shorter fallback.

*Points 3–5 drafted 3 Sep 2026. When they are ratified, change the tag and add the date; when a
different convention is chosen, strike these and record the decision beside them per the §3.5
correction convention.*

**Measured geometry, for anyone reasoning about the page budget.** All figures measured in the real
renderer, not derived:

| Figure | Value |
|--------|-------|
| Band cost at 3 lines | **104.13px**, stable across 247 / 267 / 290 characters (all three wrap to three lines) |
| Type 9 p6 headroom **with** the band | **55.56px** (current build, `2675b52`) |
| Approximate cost of a fourth line | **~34px**, which would take that page to **~21px** |

⚠️ **The 17.31px figure that circulated earlier is retired — do not cite it.** It was a spike
condition measured against a page state that was never shipped. **55.56px is the number the p6
budget should be reasoned against.**

Type 9 is the only authored type currently carrying the band, because the fixture's quotes are
withheld from re-typed renders. It is therefore the tightest case *and* the only observed one.

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
- **All Type 9 practice bullets (p7).** ⚠️ **Still open, for a changed reason.** The mockup's
  Claude-authored bullets no longer ship — the Type 9 source doc replaced them, along with the
  rest of that type's p6/p7 prose (36 of its 40 strings; see §7.4). But the doc flags the
  replacement set itself as *"discussed but never explicitly locked"*, and notes it does not
  follow the Thinking / Feeling / Behaving row order the other three authored types use: rows 1
  and 2 are both Behaving, row 3 is Feeling, and nothing covers Thinking. So this entry is not
  closed — it now describes the replacement rather than the mockup.

### 7.3 Known content gaps

- **Types 1, 4, 7 and 9 are authored (20 Aug 2026). Five remain: 2, 3, 5, 6, 8.** Sheets 6-7 are
  gated to the authored set by `V3_EXPLORE_PILOT_TYPES` (`app/renderer.js`) and
  `EXPLORE_PILOT_TYPES` (`scripts/build_content_library.js`) — two lists that must agree, flagged
  in both files for collapse when the remaining five land.
- The subtype signature (`Merging & Intensity`) is a new three-part naming convention: formal name,
  nickname, two-word signature. Only the three Type 9 subtypes exist.
- One "In Your Responses" bullet on p5 — "Ask about the alternate" — only makes sense when a second
  pattern scored close. As global static content it needs to hold for a client whose leading type is
  20 points clear, or become conditional.

### 7.4 Sheets 6-7 prose — source of record

The p6/p7 content for types 1, 4, 7 and 9 is authored by Cai and Mo in four Google Docs
(`Type N — <Nickname> · p6/p7 Final Content for Review`), transcribed into `INTERIM_EXPLORE_V3`
in `scripts/build_content_library.js`. The docs are the source; the constant is a transcription.

**Type 9's entry is a replacement, not an update.** Sheets 6-7 originally shipped as a verbatim
port of the two Type 9 mockups, landed with an explicit note that it carried no authorisation for
editorial re-cuts. The Type 9 source doc supersedes it — 36 of 40 strings differ. This was
ratified by Cai on 20 Aug 2026; the mockups are no longer the content source for any authored
type, only the geometry source.

Two cautions when re-transcribing:

- **The per-zone character counts printed in the docs are unreliable** — low by 1 to 6 in roughly
  half the zones, and not by a consistent offset. Measure the strings. The **budgets** beside them
  are sound: they come from `scripts/spike/explore_fit_probe.js`, measured in the real rendered
  page under the pinned Chromium.
- **Sheet 7, not sheet 6, is the tight page.** After the M2 normalisation it runs 32–52px free
  across the four authored types; sheet 6 runs 56px on Type 9 with the quote band and ~160px
  without it. Growth on p7 is what pushes the document.

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
