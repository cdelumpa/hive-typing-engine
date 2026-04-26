# Report Template Changes

## Target file

The HTML template that renders the client report. The existing example to reference is `hive_client_report_SP9.html` — this document describes the changes from that baseline.

## Summary of required changes

| # | Change | Type |
|---|---|---|
| 1 | Add Enneagram primer section at the top of the report | New static block |
| 2 | Fix the duplicate opening sentence between "A Note on This Result" and "What We Noticed About You" | Rewrite |
| 3 | Add an evidence paragraph under Core Motivation | Conditional render |
| 4 | Add Patterns of Thinking / Feeling / Behaving section | New section |
| 5 | Add Development Tips section after Strengths/Challenges | New section |
| 6 | Add Instinct primer + personalized overlay under the Instinct section | Rewrite + conditional render |
| 7 | Add Wing Influence section after Stress/Ease | New section |
| 8 | Add Secondary Type Hypothesis section (conditional) | Conditional render |

All content for changes 1, 4, 5, 6 (primer), 7 comes from `type_library.json`. All content for changes 3, 6 (overlay), 8 comes from the Engine's JSON output (the new fields defined in `engine_spec_changes.md`).

---

## Critical rendering convention — array-valued fields

**The type library stores multi-paragraph text fields as arrays of strings, not as single strings with embedded line breaks.** This is an intentional schema choice so each paragraph is explicit and authored.

For every field whose value is an array in `type_library.json`, the template must iterate the array and emit one `<p>` tag per string. Do NOT render arrays as a single joined block. Do NOT render them as bullet lists.

**Example — correct rendering:**

Given this JSON:
```json
"core_motivation": [
  "Nines are driven by a deep need to maintain inner and outer peace...",
  "Underneath this drive is an early-formed belief...",
  "The cost, over time, is self-forgetting..."
]
```

The correct rendered output is three separate `<p>` tags:
```html
<p>Nines are driven by a deep need to maintain inner and outer peace...</p>
<p>Underneath this drive is an early-formed belief...</p>
<p>The cost, over time, is self-forgetting...</p>
```

**Fields affected by the array convention:**
- `static_primers.enneagram_intro.body` (3 paragraphs)
- `static_primers.instinct_primer.body` (2 paragraphs)
- `static_primers.wing_primer.body` (2 paragraphs)
- `types[N].core_motivation` (3 paragraphs per type)
- `types[N].patterns_of_thinking` (2 paragraphs per type)
- `types[N].patterns_of_feeling` (2 paragraphs per type)
- `types[N].patterns_of_behaving` (2 paragraphs per type)
- `types[N].instincts.sp` / `.sx` / `.so` (2 paragraphs each)
- `types[N].wing_low.body` / `.wing_high.body` (2 paragraphs each)

**Fields that remain single strings:**
- `types[N].how_you_see_the_world`
- `types[N].name`, metadata fields
- `types[N].strengths` / `.challenges` / `.development_tips` (these are arrays of bullet points — see those sections for rendering)

**Engine-generated fields (`client_narrative`, `core_motivation_evidence`, `instinct_personal_overlay`, `secondary_type_narrative`):** These are single strings, but may contain multiple paragraphs separated by `\n\n`. Split on double newlines and emit one `<p>` tag per resulting segment.

The JSON itself carries this note in `_meta.schema_notes` as a safety check. If an array is ever found where a string was expected or vice versa, trust the actual JSON structure and render accordingly — but flag the inconsistency to Cai or Mo.

---

## Required final section order

The report should render sections in this order:

1. **Type header** (existing — Type name, confidence badge)
2. **About the Enneagram** (NEW — `type_library.static_primers.enneagram_intro`)
3. **A Note on This Result** (existing, but see Change 2 for updated content)
4. **What We Noticed About You** (existing — renders `client_narrative`, but see Change 2)
5. **Your Type at a Glance** (existing — How You See the World, Core Motivation)
   - **Core Motivation Evidence** (NEW — conditional — renders `core_motivation_evidence` if non-null)
6. **Patterns of Thinking, Feeling, and Behaving** (NEW — renders patterns from type library)
7. **Strengths and Challenges** (existing)
8. **Development Tips** (NEW — renders `development_tips` from type library)
9. **About the Instincts** (NEW — renders `instinct_primer`)
10. **Your Instinct — [SP/SX/SO]** (existing — renders static instinct flavor from type library)
    - **Personal Instinct Overlay** (NEW — conditional — renders `instinct_personal_overlay` if non-null)
11. **How Your Type Moves Through Stress and Ease** (existing)
12. **About Wings** (NEW — renders `wing_primer`)
13. **Wing Influence** (NEW — renders both `wing_low.body` and `wing_high.body` from type library)
14. **Secondary Type Hypothesis** (NEW — conditional — renders only if `secondary_type_narrative` is non-null)
15. **What to Explore With Cai** (existing)
16. **Footer** (existing)

---

## Change 1 — Enneagram primer at the top

### Placement

Immediately after the type header, before "A Note on This Result."

### Content

Render `type_library.static_primers.enneagram_intro.title` as the section heading and `type_library.static_primers.enneagram_intro.body` as a single paragraph.

### Style

Match the existing section header style (small-caps, brand color, underline) and use the same paragraph styling as other body text in the report. No special callout box — this is the report's orienting text.

---

## Change 2 — Fix the duplicate opening sentence

### Problem

Currently, both the "A Note on This Result" static paragraph and the `client_narrative` (rendered in "What We Noticed About You") open with "Based on your responses, the pattern that appears most consistent with your experience is Type X."

### Fix

The "A Note on This Result" block keeps the hypothesis framing. The `client_narrative` is rewritten by the Engine (per `engine_spec_changes.md`) to open with specific client detail instead.

### Updated static text for "A Note on This Result"

Replace the existing static paragraph with:

> Based on your responses, the pattern that appears most consistent with your experience is **Type X — [Type Name]**. This is a hypothesis, not a verdict — one we hope will feel like recognition rather than assignment. If it resonates, wonderful. If it doesn't fully fit, that's important information too. A follow-up debrief session with Cai or Monique is the right place to explore what fits, what doesn't, and why.

(Where "Type X" and "[Type Name]" are substituted with the confirmed type.)

**Important:** Do not presume a session is already scheduled. The phrasing "A follow-up debrief session with Cai or Monique is the right place to explore…" is deliberately open-ended.

### "What We Noticed About You" content

This block now renders the Engine's `client_narrative` field directly, without additional static text. The Engine will no longer open with "Based on your responses…" (see `engine_spec_changes.md`, Change 1).

---

## Change 3 — Core Motivation Evidence paragraph

### Placement

Immediately after the existing "Core Motivation" paragraph (which is rendered from `type_library.types[N].core_motivation`).

### Render logic

```
IF engine_output.core_motivation_evidence IS NOT NULL:
  render core_motivation_evidence as a follow-up paragraph
ELSE:
  render nothing
```

### Style

Use the same "In your responses" subheader style currently used in the Stress/Ease section (italic, smaller, mid-tone color) to distinguish AI-generated evidence from the static type-general content above it. The label can be "In your responses" or similar, matching existing convention.

---

## Change 4 — Patterns of Thinking, Feeling, and Behaving

### Placement

After "Your Type at a Glance" (Core Motivation + its evidence paragraph), before "Strengths and Challenges."

### Content

Render three subsections, each as a paragraph under a small subsection header:

- **How You Think** → `type_library.types[N].patterns_of_thinking`
- **How You Feel** → `type_library.types[N].patterns_of_feeling`
- **How You Behave** → `type_library.types[N].patterns_of_behaving`

### Section heading

"Patterns of Thinking, Feeling, and Behaving" as the main section header. The three subsection labels follow the small-caps, brand color style used for "How You See the World" and "Core Motivation" in the existing report.

---

## Change 5 — Development Tips

### Placement

Immediately after the Strengths and Challenges box grid, before "Your Instinct."

### Content

Render `type_library.types[N].development_tips` as a numbered list (5 items) under the section header "Development Tips."

### Style

Match the numbered list style already used in "What to Explore With Cai" — light background, brand-colored number, body text. Each tip is one full item; do not render lead-in phrases as bold. Tips are plain prose.

### Introductory line

Above the list, include a short intro line: *"These practices can help you leverage your strengths and address the patterns that can hold you back."* (Or similar — one sentence.)

---

## Change 6 — Instinct section rewrite

### Placement

The existing "Your Instinct — SP/SX/SO" section stays where it is in the flow, but it is split into three parts now.

### New structure

**6a. About the Instincts** (NEW section, placed before "Your Instinct — …")

Render `type_library.static_primers.instinct_primer.title` as the section header and `type_library.static_primers.instinct_primer.body` as the paragraph.

**6b. Your Instinct — [SP/One-to-One/SO]** (existing section, updated content)

- Section header: "Your Instinct — Self-Preservation" / "Your Instinct — One-to-One" / "Your Instinct — Social" (note: use "One-to-One" for SX clients, not "Sexual" or "SX").
- Body: render the matching instinct flavor from the type library:
  - If client's dominant instinct is SP → `type_library.types[N].instincts.sp`
  - If SX → `type_library.types[N].instincts.sx`
  - If SO → `type_library.types[N].instincts.so`

**6c. Personal Instinct Overlay** (NEW — conditional)

```
IF engine_output.instinct_personal_overlay IS NOT NULL:
  render instinct_personal_overlay as a follow-up paragraph
ELSE:
  render nothing
```

Same "In your responses" subheader style as the Core Motivation Evidence paragraph.

---

## Change 7 — Wing Influence

### Placement

After "How Your Type Moves Through Stress and Ease," before "What to Explore With Cai."

### Content

Three parts:

**7a. About Wings** (primer)

Render `type_library.static_primers.wing_primer.title` as a subheader and `type_library.static_primers.wing_primer.body` as the paragraph.

**7b. [Lower wing name] — Type [N]** (first wing)

- Subheader: e.g., "Nine wing — Type 9" (for a Type 1 client)
- Body: render `type_library.types[N].wing_low.body`

**7c. [Higher wing name] — Type [N]** (second wing)

- Subheader: e.g., "Two wing — Type 2" (for a Type 1 client)
- Body: render `type_library.types[N].wing_high.body`

### Section heading

"Wing Influence" as the main section header.

---

## Change 8 — Secondary Type Hypothesis (conditional)

### Placement

After "Wing Influence," before "What to Explore With Cai."

### Render logic

```
IF engine_output.secondary_type_narrative IS NOT NULL:
  render the full Secondary Type Hypothesis section
ELSE:
  render nothing — skip this section entirely
```

### Content when rendered

- Section header: "Secondary Type Hypothesis"
- Body: render `engine_output.secondary_type_narrative` as a single paragraph.

### Style

Match the existing section header style. The body paragraph uses the same callout/highlight style used for "What We Noticed About You" (light brand-colored background, left border accent) to visually distinguish it as a meaningful AI-generated observation.

---

## Styling guidance

- No bold lead-ins in the Development Tips list. Tips are plain prose.
- All new AI-generated content (Core Motivation Evidence, Personal Instinct Overlay, Secondary Type Hypothesis) should use the italic "In your responses" subheader style already established in the Stress/Ease section, or an equivalent visual treatment that distinguishes AI observations from static type content.
- All new static content (primers, patterns, development tips, wings) should use the same body text style as existing static sections.
- Section headers (small-caps, brand color, underline) are used consistently throughout.
- The existing confidence badge, typography, and color palette are preserved.

## What not to change

- The existing header (Type name, Peacemaker/etc. subtitle, confidence badge).
- The Strengths/Challenges two-column box layout.
- The "How Your Type Moves Through Stress and Ease" section.
- The "What to Explore With Cai" section.
- The footer.
- The overall font, color palette, and general visual design.

## Validation checklist

After implementation, verify:

- [ ] No duplicate "Based on your responses…" opening sentence appears anywhere.
- [ ] The Enneagram primer appears at the top, before "A Note on This Result."
- [ ] The Core Motivation Evidence paragraph is present when `core_motivation_evidence` is non-null and absent when null.
- [ ] Patterns of Thinking/Feeling/Behaving section renders three paragraphs.
- [ ] Development Tips renders as 5 plain-prose numbered items (no bold lead-ins).
- [ ] Instinct primer appears once before the client's specific instinct description.
- [ ] The Personal Instinct Overlay paragraph is present when non-null and absent when null.
- [ ] Wing Influence section renders both wing paragraphs for the client's type.
- [ ] Secondary Type Hypothesis section renders ONLY when `secondary_type_narrative` is non-null. For clients without a meaningful secondary type, the section does not appear at all.
- [ ] All SX-flavor content uses "One-to-One" labeling client-facing.
- [ ] No text anywhere in the rendered report references "The Narrative Enneagram" by name.
