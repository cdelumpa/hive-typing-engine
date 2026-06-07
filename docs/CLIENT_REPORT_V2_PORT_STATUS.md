# InsightOut Client Report — V2 Port Status

**Repo:** `cdelumpa/hive-typing-engine`
**Branch:** `port-clientv2-prep` (local + `origin/`, in sync) — **never merged to main**
**As of commit:** `b223a13`
**Last updated:** 2026-06-07

> Living tracking doc for the InsightOut client-report V2 template port. Update the
> commit stack, page table, and Open/Tracked section as work lands.

## Commit stack (newest first)
```
b223a13  port: P6 Instinct & Subtype -> V2 (full-width evidence box, one sheet)   <- origin tip
acd88ab  docs: client-report V2 port status (this tracking doc)
d931a44  fix: cover margin reset specificity (restore cover-page spacing)
faaf361  port: P5 Wings & Lines -> V2 (renderer-only)
8b1f869  port: P4 How Your Type Shows Up -> V2 (renderer-only)
1ce2613  port: P3 Your Type Hypotheses -> V2 (renderer-only)
18c52e7  port: P1 Welcome -> V2 + base64 headshots (renderer-only)
c69e900  fix: repair .cover CSS comment that dropped the .cover rule (PR-2a regression)
9c4a096  PR-2b-1: additive structured static.welcome (prep, no visual change)
9548f26  PR-2a: Title + TOC covers -> V2 (renderer + consolidated stylesheet)
438be28  PR-0: additive prep fields (display.*, P3 alt column, P5 wing/line remap)
54c6a4f  base: flowing layout, measurement-gate removal (tip of typing-engine-v2)
```

## Pages ported (8 of 10)
| Page | Status | Notes |
|---|---|---|
| Title, TOC | done (V2) | `.cover` fixed-height, absolute footer |
| P1 Welcome | done (V2) | Two base64 headshots in `app/report_assets.js`; structured `static.welcome` |
| P2 Enneagram | done (V2, PR-1) | center-colored type grid |
| P3 Hypotheses | done (V2) | two-column comparison; type-variant SVG; legend from in-file `SVG_TYPE_META` |
| P4 Patterns | done (V2) | flex-column flow page; plain bullets |
| P5 Wings & Lines | done (V2) | wings-lines SVG variant; resource cards |
| P6 Instinct & Subtype | done (V2) | **Intentional deviation:** "In Your Responses" evidence box promoted to full-width below both columns (resolves column imbalance + spill). Both fixtures fit one sheet. See 27-subtype sweep below. |
| **P7, P8** | NOT ported (legacy renderer) | next up |

## Verification standard (applied every PR)
- **Structural diff** on both fixtures (`sp4_api_result.json`, `sx7_api_result.json`):
  prove only the target page(s) changed; all other client pages **and the entire coach
  report byte-identical**.
- **Rendered-height assertion** on the *actual* page element (added after a real miss —
  see regressions), with physical-sheet count + clip check.
- **Visual QA** (pages 1–5, sx7) passed: layout, mastheads/footers, typography, Hive
  palette, both SVG variants with legends, Welcome headshots + mid-letter callout.

## Regressions found & fixed mid-port (both PR-2a CSS bugs the markup-diff missed)
1. **`c69e900`** — a `*/` inside a CSS comment (`.tp-*/.toc-*`) closed the comment early
   and dropped the `.cover` rule entirely; Title/TOC rendered collapsed (height 0) since
   PR-2a.
2. **`d931a44`** — the cover UA-reset (`.cover h1,.cover p,…`, specificity 0,1,1)
   outranked authored `.cv-*/.cw-*` margins (0,1,0), zeroing them; fixed with `:where()`
   (zero specificity). Restored Title rule→tagline spacing (now equidistant, 20px) and
   Welcome/TOC spacing.

**Lesson logged:** cover/CSS ports need a *rendered-height + computed-style* assertion on
the real elements, not just a markup byte-diff — a shared stylesheet means identical
markup can still render broken.

## Constraints held throughout
- Prep layer frozen during renderer PRs (`report_prep.js`, `content_library.json`,
  `build_content_library.js` untouched except the dedicated additive PR-2b-1).
- `partAStyles()` (shared with coach) never touched -> coach byte-identical across the
  whole stack.
- Single `HIVE_LOGO_SVG` asset reused on every masthead (no duplication).
- All cover CSS additive/namespaced (`.cv-`/`.cw-`/`.p3-`/`.p4-`/`.p5-`) inside
  `clientReportStyles()`.

## P6 27-subtype sweep + Mo content target list
P6's `.cover` is fixed 816×1056 (spec A8). The two fixtures (sp4/sx7) fit one sheet, but a
27-subtype sweep (9 types × 3 instincts, final full-width layout) under a **worst-case
evidence stand-in** (3 bullets × exactly 25 words = the ≤25-word max; box a constant 144px)
shows **16/27 spill**. Binding metric is **total left-column height** = narrative + 9
pattern bullets — *not* narrative word count alone (e.g. `sp8` spills with a 114w narrative
because its pattern bullets run 163w; `so7` 122w fits while `sx7` 116w spills).

**Primary fix is CONTENT (Mo, via docx → build_content_library → JSON), not layout.**
Reference budget (from the 11 fitting subtypes): narrative ~97–122w, pattern-bullets
~96–120w, left-column height ≤ ~667px.

Target list — 16 over-budget subtypes (page overage under worst-case evidence; w = words):

| Subtype | over | narrative w → target | pattern-bullets w → target | primary lever |
|---|---|---|---|---|
| sx8 One-to-One Eight | +65 | 133 → ~108 | **178 → ~120** | both (bullets worst) |
| so8 Social Eight | +50 | 144 → ~115 | **162 → ~120** | both |
| sp8 Self-Preservation Eight | +46 | 114 (ok) | **163 → ~120** | pattern bullets |
| so9 Social Nine | +46 | 120 → ~108 | 132 → ~115 | both |
| sx6 One-to-One Six | +32 | 130 → ~112 | 113 (ok) | narrative |
| sp9 Self-Preservation Nine | +31 | 115 → ~108 | 132 → ~115 | both (mild) |
| sx9 One-to-One Nine | +31 | 118 → ~108 | 128 → ~115 | both (mild) |
| sx7 One-to-One Seven | +29 | 116 → ~108 | 116 → ~108 | both (borderline) |
| so1 Social One | +27 | 115 → ~108 | 118 → ~110 | both (borderline) |
| sx1 One-to-One One | +27 | 117 → ~108 | 133 → ~115 | bullets lean |
| so6 Social Six | +14 | 123 → ~115 | 121 → ~115 | both (mild) |
| sp3 Self-Preservation Three | +13 | 117 → ~110 | 104 (ok) | narrative |
| sp4 Self-Preservation Four | +13 | 116 → ~110 | 116 → ~110 | both (mild) |
| sx5 One-to-One Five | +13 | 123 → ~113 | 109 (ok) | narrative |
| sp2 Self-Preservation Two | +10 | 128 → ~118 | 120 (ok) | narrative |
| sx2 One-to-One Two | +10 | 116 → ~110 | 121 → ~113 | both (mild) |

Caveats: (1) height is **line-quantized** — word cuts only help at line boundaries; the
re-sweep confirms. (2) The four worst (sx8/so8/sp8/so9, +46…+65) likely need pattern-bullet
trims too (the Eights' bullets run 162–178w) and may leave a residual for the layout lever.
(3) Worst-case evidence; under typical evidence (~15–20w/bullet) the small-overage tier
mostly self-resolves, but the Eights/Nines stay the structural risk.

Sequence: **(1)** Mo content trim (above) → **(2)** re-sweep with trimmed narratives (still
worst-case 3×25w evidence), report new spill list → **(3)** minimum layout lever for the
residual only (multi-column evidence box ≈ −45px, or lighter box-padding) — *not built
pre-emptively; it's a partial fix for a content problem and has a cosmetic cost (3 bullets
split 2+1 across a wide measure).*

## Open / tracked
**Remaining work**
- Port P7 (Strengths, Challenges & Growth), P8 (Putting It All Together).
- P6 spill: Mo content pass (target list above) → re-sweep → minimum residual layout lever.

**Cleanup PR (deferred)**
- Remove dead `welcome_body` + dead legacy CSS (`.tp-*`/`.toc-*`, and once P6–P8 move,
  `cl-2col`/`cl-svg`/`cmp`/`pat-*`).
- Consolidate duplicated `p3-/p4-/p5-` masthead chrome into a shared set.
- Fix `render_client.js` positional page-label drift (mislabels since ported pages left
  the `.report-page` selector).

**Offline / content-pipeline track**
- Replace the interim `INTERIM_WELCOME` constant in `build_content_library.js` with a
  canonical binary-docx `parseStatics()` read (the generator's source docx lacks the
  structured welcome section).
- P4 bullet lead-in bold (mockups show it; data carries plain strings).
- P5 `wings_primer` one-word wording difference vs template ABOUT copy.
- P4 heading mixed-casing (`type_word` title-case beside uppercased type name —
  template-faithful but visually inconsistent).
