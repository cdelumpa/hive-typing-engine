# Mockup file manifest — InsightOut Client Report v3.0

Twelve reference implementations. Real HTML, rendered through headless Chromium via the same
`Page.printToPDF` call Puppeteer uses. Each renders to exactly one US Letter sheet (816 × 1056 px).

Place these in `/docs/mockup/` in the repo.

| PDF sheet | Page | Footer number | File |
|-----------|------|---------------|------|
| 1 | Cover | none | `claude_The_Peacemaker_Page_Cover_v1.html` |
| 2 | Contents | none | `claude_The_Peacemaker_Page_TOC_v2.html` |
| 3 | Welcome | 1 | `claude_The_Peacemaker_Page_Welcome_v2.html` |
| 4 | What Is the Enneagram? | 2 | `claude_The_Peacemaker_Page_WhatIs_v2.html` |
| 5 | Quick Reference | 3 | `claude_The_Peacemaker_Page_AtAGlance_v1.html` |
| 6 | Exploring Your Type Hypothesis | 4 | `claude_The_Peacemaker_Page_LeadingType_A_v1.html` |
| 7 | Exploring Your Type Hypothesis (cont.) | 5 | `claude_The_Peacemaker_Page_LeadingType_B_v1.html` |
| 8 | Your Wings | 6 | `claude_The_Peacemaker_Page_Wings_v1.html` |
| 9 | Your Stress and Security Points | 7 | `claude_The_Peacemaker_Page_Lines_v1.html` |
| 10 | Instincts & Subtypes | 8 | `claude_The_Peacemaker_Page_Instincts_v1.html` |
| 11 | Development Ideas for Peacemakers | 9 | `claude_The_Peacemaker_Page_CAR_v1.html` |
| 12 | Your Thoughts | 10 | `claude_The_Peacemaker_Page_Thoughts_v2.html` |

**Note on numbering:** the cover and contents are unnumbered, so the printed footer number is the
PDF sheet index minus two. The contents page lists footer numbers, not sheet indices.

---

## Superseded drafts — do NOT include in `/docs/mockup/`

These three exist in the working directory but were abandoned during design. Including them would
mislead the audit:

| File | Why it is superseded |
|------|----------------------|
| `claude_The_Peacemaker_Page_AlternateType_v1.html` | The alternate type page was cut. The alternate now appears only as a labelled node on Quick Reference. Its discriminator treatment moves to the coach report |
| `claude_The_Peacemaker_Page_Subtypes_v1.html` | Instincts & Subtypes was consolidated from two pages to one. This was the second page |
| `claude_The_Peacemaker_Page_TypeHypothesis_v1.html` | Early single-page version of the type hypothesis, replaced by LeadingType_A and LeadingType_B |

---

## Client data used throughout

The mockup is built for one real client so that every zone shows plausible content:

- **Anders Wennerstrom**, Type 9 — The Peacemaker, **SX9** subtype (The Seeker)
- Type scores: 9:90 · 5:85 · 1:75 · 8:55 · 3:50 · 2:48 · 7:42 · 4:40 · 6:35
- Instinct scores: SP 66 · SO 64 · **SX 84**
- Wings 8 and 1 · Stress point 6 · Security point 3
- Alternate hypothesis: Type 5 — The Observer

Source: `coach_Anders_Wennerstrom_55_1782364137994.pdf`.

**Caution:** the earlier v3 mockup labels this client **SP9**, which is wrong. See spec §4.3.
