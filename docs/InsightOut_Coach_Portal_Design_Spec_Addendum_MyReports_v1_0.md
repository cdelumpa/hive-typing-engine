# InsightOut Coach Portal — Design Spec Addendum: §7.5 My Reports

**Version 1.0 · Confidential · Hive, Inc.**

**Status:** Locked. Resolves the same "unchanged from v1.4, full specs on record" gap
Design Spec v2.2 had for §7.5. Transcribed from the Claude Design mockup set, already
committed in-repo at `docs/Coach Portal Screens/My Reports/` (6 PNGs: desktop default +
modal open, tablet accordion-inactive + modal-active, mobile accordion-closed + a
second mobile state showing an accordion item expanded inline), plus one net-new
control (the report selector below) designed this session and ratified by Cai. Fold
into the master Design Spec as §7.5 whenever that document is next revised.

**Route:** `/coach/reports`. Nav item already live (My Reports, file icon, MY PRACTICE
zone, per PR1/PR2's already-built nav).

**Job mapping:** the coach's **own** Enneagram report(s) from their own completed
self-assessment(s) — distinct from the per-client "Client Report" / "Coach Report"
download links already built into My Clients' Assessment History (PR4a).

**Ratified scope (Cai's calls):**
- A coach can have **multiple** reports if they've retaken their own assessment more
  than once — this is not a single always-current report. Needs the selector below.
- **No zero-state needed.** Completing a self-assessment is a required step during
  onboarding, so `/coach/reports` can assume at least one report always exists for any
  coach who reaches this screen.

## Header (all breakpoints)

Standard portal chrome — unchanged from other screens. H1 "My Reports" (Georgia,
`--color-text-heading`).

## Report selector (net-new, designed this session)

Positioned directly beneath the identity block's download-links row, above the Type
Overview section, on all breakpoints. Closed by default, showing the most recent
report's date plus a "(Most recent)" tag and a file icon — e.g. "Jul 15, 2026 (Most
recent)". Clicking/tapping opens a short dropdown list of the coach's past reports by
date, each row also showing the type that report resulted in (useful when a coach's
reading changed between retakes — e.g. an earlier report might show a different type
than the current one). The active/selected row highlights with
`--color-primary-light` background and `--color-primary-dark` text. Selecting a
different row reloads the report card below with that report's data — the rest of the
page (identity block, wheel diagram, detail sections, Strengths/Growth Edges/
Practices) all re-render for whichever report is selected, not just the most recent.

If a coach has only one report, render the same control but disabled/inert (no
chevron interaction) rather than hiding it — keeps the layout stable rather than
having the page shift depending on report count.

## Report card

Single white card containing everything below. No breakpoint-specific chrome changes
to the card itself — just its internal layout.

### Identity block (top of card, all breakpoints)

- Type headline: "Type 8 · The Protector" (Georgia bold, large — treat as an H2 within
  the card).
- Tritype/subtype line beneath: "SX8 · One-to-One Eight · The Director" (muted,
  smaller).
- "Confidence: Medium-High" (muted, small — reuses the same confidence-level language
  already established elsewhere in the assessment engine).
- Download row: "↓ My Client Report" and "↓ My Coach Report", side by side, primary-
  color links with a download icon. These reuse the existing client/coach report PDF
  generation already built for the engine — same two report types, just pointed at the
  coach's own assessment instead of a client's. Scoped to whichever report is
  currently selected in the selector above, not always the most recent.
- Report selector (see above).
- Divider.

### Type Overview

Eyebrow label "TYPE OVERVIEW" + a paragraph describing the type generically (not
personalized — this is the same static type-description content used elsewhere in the
product, e.g. Resources).

### Enneagram wheel diagram

A circular diagram: 9 numbered nodes arranged around a ring, three pastel triangular
zones filling the circle's interior (Head/Heart/Gut center thirds — blue/pink/green).
The coach's own type node is filled solid primary/cyan and enlarged slightly; all other
nodes render as muted gray circles. Two directional lines cross the circle's interior:
a dotted red/accent line from the identified type to its **stress** point, and a solid
dark green line to its **security** point.

**Flag for the audit — this is a non-trivial rendering component, not styled markup.**
Propose whether this should be a server-rendered inline SVG (computed per-coach from
their type/wing/stress/security data — consistent with the portal's server-rendered
architecture and enables the dynamic highlighting/line-drawing) versus any other
approach. Do not treat this as a static image — the highlighted node, stress line, and
security line all change per coach (and per selected report, given multiple reports
are now in scope).

Below the diagram: four labeled data rows — **Wings** (bold, e.g. "Type 7 / Type 9"),
**Stress** (accent/red-toned text naming the stress type, e.g. "Type 5 — The
Observer"), **Security** (green-toned text, e.g. "Type 2 — The Giver"), **Center**
(primary-color link-styled text, e.g. "Gut Center").

### Relative Type Pattern Strength

Eyebrow label + 9 horizontal bars, one per Enneagram type 1–9, each showing a fill
proportional to a numeric strength value (0–100 scale, one decimal — e.g. "81.6") and
the number itself printed at the row's end. The coach's own identified type's bar
renders as a solid, saturated fill; all other bars render at reduced-opacity/muted
fill. This is presumably driven by the same underlying pattern-strength data already
computed by the assessment engine for the client-facing report — confirm the data
source at build time rather than assuming a new calculation is needed.

### Relative Instincts Strength

Same bar-chart pattern, 3 rows (SP / SO / SX), accent/orange-toned fill instead of
primary, same numeric-value-at-end convention.

### Four detail sections — three different interaction patterns per breakpoint

The same four sections — **What Your Responses Revealed**, **Your Subtype**, **Your
Wings**, **Your Stress & Security Points** — render with genuinely different
interaction models at each breakpoint. Get this precise; it's easy to collapse into
"just an accordion" and lose the real distinction.

- **Desktop:** all four render as always-visible inline text — eyebrow label + a
  condensed paragraph — stacked in the card's left column below the Type Overview
  section. Three of the four end with a "More →" link (primary color) that opens a
  modal with the section's full content. Not an accordion — nothing is collapsed by
  default.
- **Tablet:** the same four sections collapse into a list of rows (icon + label +
  chevron-right), replacing the inline-paragraph layout entirely — narrower width
  doesn't have room for both the wheel diagram and four inline paragraphs side by
  side. Tapping a row opens the **same modal** desktop's "More →" link opens — full
  section title, subtitle (e.g. "SX8 · One-to-One Eight · The Director"), an italic
  one-line tagline (e.g. "The most relationally intense subtype of Eight." — confirm
  this renders on desktop's modal too; it's clearly present on tablet's, worth a
  build-time check for parity), a general description paragraph, an "IN YOUR
  RESPONSES" eyebrow-labeled personalized paragraph, and — specific to the Your
  Subtype modal only — three colored instinct-percentage badges (SX/SO/SP) at the
  bottom.
- **Mobile:** starts identical to tablet — the same collapsed row list. But tapping a
  row **expands its content inline**, directly in the page flow between that row and
  the next, rather than opening a modal. Confirmed from the mockup: the expanded
  section's content (title, subtitle, paragraph) pushes the remaining rows downward
  rather than overlaying them. This is a real, deliberate divergence from tablet's
  modal pattern, not an inconsistency to normalize away — build both behaviors as
  shown.

### Strengths / Growth Edges / Practices

Three cards below the detail sections, full-width row on desktop/tablet (need to
confirm exact column behavior on tablet — likely still 3-column given the width, but
verify against the tablet mockup at build time), stacked on mobile:

- **Strengths** — lightning-bolt icon, `--color-primary-light` bg, primary-color
  heading, bullet list.
- **Growth Edges** — trending-up icon, `--color-accent-light` bg, accent-color
  heading, bullet list.
- **Practices** — compass icon, green-toned bg (matches `--color-success-bg`
  territory — confirm exact hex at build time, this card's green reads slightly
  different from the existing success token and may need its own value), green
  heading, bullet list.

## Breakpoint notes

- **Desktop:** two-column layout — report content (identity block, type overview,
  four detail sections) on the left, wheel diagram + stat rows + both strength bar
  charts on the right, roughly 60/40 split.
- **Tablet:** same two-column split is preserved (confirmed from the tablet mockup —
  diagram and stats still sit to the right of the main content), but the four detail
  sections switch from inline paragraphs to the collapsed accordion-list per above.
- **Mobile:** fully single-column. Type Overview, then the wheel diagram, then the
  Wings/Stress/Security/Center rows and both strength bar charts, all stacked full-
  width beneath the diagram (not beside it) — with a "More →" / "Less →" toggle link
  that expands/collapses the two bar-chart sections (confirmed from the mockup: one
  mobile state shows both charts visible with a "Less →" link, implying they're
  collapsed by default behind a "More →" link on initial load). Then the four
  accordion rows with the inline-expand behavior described above, then the three
  Strengths/Growth Edges/Practices cards stacked full-width.

## Backend notes

- Confirm the source of the pattern-strength and instinct-strength numeric data —
  almost certainly already computed by the assessment engine for existing report
  generation, not a new calculation this PR needs to build.
- The wheel diagram needs per-coach, per-report dynamic data: identified type, wings,
  stress point, security point, center. All of this should already exist on each of
  the coach's own completed assessment records — confirm the exact fields at build
  time.
- Download links reuse the existing client/coach report PDF generation, pointed at
  the coach's own assessment ID (whichever is currently selected) rather than a
  client's — confirm this is a straightforward parameter swap and not blocked by any
  client-specific assumption baked into that generation code.
- The report selector needs a query returning all of a coach's completed self-
  assessments (date, resulting type, assessment ID) ordered most-recent-first — likely
  a straightforward query against the same `assessments` table already used
  everywhere else, scoped to the coach's own client-equivalent record rather than one
  of their actual clients. Confirm at build time how a coach's own self-assessment is
  actually represented in the data model (e.g. does the coach have a synthetic
  `clients` row, or is there a separate mechanism) — this is worth flagging explicitly
  since every other report-related route in the codebase assumes a client, not a
  coach, as the subject.

*End of Addendum — v1.0*
