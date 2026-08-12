# Audit — PR 2: Static pages (Cover, Contents, Welcome, What Is, Your Thoughts)

**Prepared by:** Claude Code (lead engineer / QA)
**Audit delivered:** 12 August 2026 · **Landed with the build:** 12 August 2026
**Scope:** spec v3.0 sheets 1, 2, 3, 4 and 12, plus `V3_PAGE_ORDER`, `V3_CONTENTS`, two new
`buildEnneagramSVG` variants and the transparency gate.
**Not in scope:** sheets 5–11. Em-dash normalization (separate PR).

Every number below is tagged **measured** (with the command), **derived** (with the
assumption) or **aggregate** (with the set). This convention exists because a *derived*
5.88px clearance figure in PR 1 concealed a real *measured* failure at 4.47px.

---

## 0. Why this document exists

The process doc requires an audit doc on `main` for every PR. The rule failed on PR 1 and
PR 1.5 and cost a rescue PR each time. This is the third PR and the first to comply on the
first attempt.

---

## 1. Three premises in the audit brief that measurement contradicted

All three were conceded by design on 12 Aug. They are recorded here because the pattern —
design-doc numbers going stale against the shipped mockups — is now five instances deep and
is being consolidated into a single docs-correction PR.

### 1.1 There was no footer/page-number drift

**Measured** (rendered DOM footer spans, all twelve `docs/mockup/*.html` through the pinned
Chromium): the mockups are internally consistent with `docs/mockup_file_manifest.md`. Cover
and Contents are unnumbered; every other sheet prints `footer = sheet − 2`.

| Sheet | Page | Footer | | Sheet | Page | Footer |
|---|---|---|---|---|---|---|
| 1 | Cover | *(no footer element)* | | 7 | Exploring (cont.) | Page 5 |
| 2 | Contents | *(present, empty)* | | 8 | Your Wings | Page 6 |
| 3 | Welcome | Page 1 | | 9 | Stress and Security | Page 7 |
| 4 | What Is the Enneagram? | Page 2 | | 10 | Instincts & Subtypes | Page 8 |
| 5 | Quick Reference | Page 3 | | 11 | Development Ideas | Page 9 |
| 6 | Exploring Your Type | Page 4 | | 12 | Your Thoughts | Page 10 |

The cited symptom — "`Instincts_v1` reads Page 8 though it is sheet 10 of 12" — is the
scheme working. The real subtlety is one level up and is handled in §3.

### 1.2 The 18px TOC padding concern was already resolved

**Measured**: `TOC_v2.html:21` uses `padding:15px 0 16px`, not 18px. The 18px value exists
only in two superseded 24 Jul drafts that were never in the repo. The shipped nine-entry
Contents page measures **862.17px against the 976px budget — 113.87px headroom**, the
second-roomiest page in the document. No copy needed to yield.

### 1.3 The cover home node is differentiated by fill, not radius

**Measured** (`Cover_v1.html:32`): all nine nodes are `r="23"` in a 420×420 viewBox rendered
at 316px. The home node differs by fill (`#F68625` with `#FFFFFF` numerals) only. The
"radius 12 vs 10.5" figures come from brief v2.0 §3 and match nothing in the shipped set.

---

## 2. Content sourcing — the build plan was wrong on all five pages

`client_report_v3_build_plan.md:127` says *"Content prerequisites: none new — all AS-IS from
`static.*`"*. **Measured** (character-by-character diff of `content_library.json` against the
five mockups): nothing on these pages was AS-IS.

| Page | Where copy lived | What PR 2 did |
|---|---|---|
| 1 Cover | nothing in the library | chrome + model fields; no content dependency |
| 2 Contents | **nothing anywhere** — 9 titles + 9 descriptors existed only in `TOC_v2.html` | new `INTERIM_CONTENTS` |
| 3 Welcome | `INTERIM_WELCOME`, a JS constant, not Word | rewritten to the approved copy |
| 4 What Is | `static.primer` — **Word-sourced** | docx round-trip: 4 framing strings, 5 card fixes, 1 new section |
| 12 Your Thoughts | **nothing anywhere** | new `INTERIM_THOUGHTS` |

**The Word round-trip was a prerequisite for exactly one of the five pages.** The CI
invariant is `content_library.json == build(docx + INTERIM_*)`, and `INTERIM_*` constants are
a first-class input — so Cover, Contents, Welcome and Your Thoughts landed without touching
Word, and only What Is required editing
`docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx`.

**Aggregate** (`node scripts/verify_content_library.js`): 1352 of 1400 leaves are
Word-canonical; 48 come from `INTERIM_*` constants, up from 23, with the increase declared
in `SCRIPT_SOURCED` and its retirement condition recorded.

---

## 3. Page numbering

`V3_PAGE_ORDER` now carries all twelve sheets. Two tables, because one cannot express the
6–7 span:

* **`V3_PAGE_ORDER`** — sheet, footer, chrome, title, eyebrow. `footer = sheet − 2` for
  sheets 3–12; `null` for cover and contents.
* **`static.contents`** (`V3_CONTENTS`) — nine rows, each naming the **first** sheet of its
  span via `start`. Page numbers are resolved at render time and are never stored.

Entry 04 spans sheets 6–7, so **nine entries cover ten numbered sheets and footer 5 never
appears in the column**. A one-row-per-page table would have printed ten entries with wrong
numbers — the off-by-one this structure exists to prevent.

**The footer helper has three states**, all three present in the reference set: `chrome:'none'`
(cover — no footer element), `chrome:'blank'` (contents — full bar, empty number slot), and
the default numbered bar.

**Measured** (`node tests/report_pages_test.js`): rendered footers `['',1,2,6,10]` equal
`V3_PAGE_ORDER`; rendered `.v3-toc-pg` values `[1,2,3,4,6,7,8,9,10]` equal the computed
values; 5 is absent; no `{token}` survives into the HTML.

---

## 4. Brief v2.0 §12 — all six resolved

The section was unreachable during the audit (not in the repo, Drive or Downloads — it lives
in the claude.ai project knowledge). Design supplied §12.5 and §12.6 verbatim on 12 Aug and
confirmed the six-item enumeration taken from Notion card IO-54 was faithful.

| § | Item | Resolution |
|---|---|---|
| 12.1 | Header subtype on every page | **Done.** Added to the shared `_v3Header`. Deliberate re-baseline of the Wings page — see §6 |
| 12.2 | Footer copyright form | **Long form**, all interior pages. See §4.1 |
| 12.3 | TOC entry 07 descriptor | **Done.** Rebound to `display.subtype_label` — see §4.2 |
| 12.4 | `[Nickname]` vs `[TypeName]` | **Done.** `display.nickname` + `display.nickname_plural` added |
| 12.5 | Type-specific labels as authored zones | **Not PR 2.** All the named labels are on sheets 6–11 |
| 12.6 | Hyphenation artifacts | **Done**, but not as specified — see §5 |

### 4.1 §12.2 — the premise was not reproducible

§12.2 recommends standardizing on the short form, asserting an inconsistency *within* v3 and
naming which pages carry which variant.

**Measured** (`grep` over every `.html` in the repo and `~/Downloads`, plus `app/*.js`):

* v3 mockups: **11 long form, 0 short form** (the cover has no footer)
* pre-v3 drafts, 24 Jul: **4 long form, 0 short form**
* all HTML artifacts on disk: **52 files long form, 0 short form**
* production `renderer.js`: **10 long-form sites**, including the live coach report

**The short form does not exist in any artifact on disk**, pre-v3 or v3. §12.2's premise is
not reproducible; the item is superseded rather than declined. Adopting the short form would
have made the v3 client report the only Hive artifact with a different copyright string,
diverging from the coach report generated by the same pipeline. Long form was ratified.

### 4.2 §12.3 — bound to `subtype_label`, not `[Subtype] [Nickname]`

§12.3's own template renders "an SP Peacemaker". The shipped string is bound to
`display.subtype_label` instead, for three reasons: it already exists and is correct; it
reads as natural language; and **all 27 labels begin Self-Preservation / Social / One-to-One,
so every one takes "a"** — which removes the a/an agreement problem rather than solving it
with a conditional.

**Measured** (longest case, `Self-Preservation Seven` vs the fixture's `One-to-One Nine`):
descriptor renders on **1 line, 18.13px**, row 72.13px, page 1056px. Both fit identically.

### 4.3 §12.4 — the naming trap

`hero.subtype_name` is **not** the subtype name: it holds `"One-to-One"`, the instinct label
alone (`report_prep.js:233`). Use `display.subtype_label`. `display.nickname` /
`nickname_plural` are new; the strip-"The"-add-"s" rule is asserted against all nine
archetype names in `report_pages_test.js`.

---

## 5. §12.6 — the proposed check was wrong, and measurement replaced it

The audit first proposed asserting that no text node ends in U+00AD or a soft-break hyphen.
Design pushed back: §12.6's examples ("de-escalate", "worst-case-focused") are *natively*
hyphenated compounds, which points at breaking on **existing** hyphens.

**Measured** (`hyphen.js`, all twelve mockups, characters grouped into line boxes by
client-rect top):

```
computed `hyphens` across all text:  manual   (every page, every node)
hyphen-terminated line breaks:       4
  NATIVE (break at a source hyphen): 4
  AUTO   (Chromium-inserted):        0
```

`hyphens: manual` is already computed everywhere, so **Chromium inserts nothing**;
`hyphens: none` would be a no-op and the proposed assertion would have passed vacuously
forever. Design's read was correct.

Neither of §12.6's cited examples appears in any v3 mockup — that item, like §12.2, was
observed against a pre-v3 artifact. The phenomenon is nonetheless real in v3: three compounds
split (`self-forgetting`, `present-moment`, `pressure-test`) plus one false positive
(`Type 9 - The Peacemaker`, a *spaced* hyphen used as a dash, where breaking is correct).

**A fourth case appeared only after the approved Welcome copy landed:** the URL wrapped as
`www.hiveleadership.com/the-` / `enneagram.` — a broken URL in a client-facing PDF.

**Fixes, by kind:**

* **prose** → U+2011 non-breaking hyphen. **Measured**: U+2011 and U+002D have identical
  advance width in the pinned font (4.67px at 14px), so nothing reflows — Wings headroom was
  57.25px before and after.
* **URLs** → a `nowrap` span (`_v3NoBreakUrls`), *not* U+2011. Putting a non-ASCII character
  inside a URL would mean anyone copying it out of the PDF copies something that does not
  resolve.

**The gate is the measurement**: `scripts/render_client.js` now walks rendered line boxes and
fails on any break at a hyphen not preceded by whitespace.

---

## 6. The Wings re-baseline (§12.1) — deliberate, not a regression

Adding the subtype to the shared header changes the page PR 1 already merged.

```
BEFORE (main @ 808174f):
  <span class="header-client">Anders Wennerstrom</span> · Type 9 — The Peacemaker

AFTER (this PR):
  <span class="header-client">Anders Wennerstrom</span> · Type 9 — The Peacemaker · SX9
```

The Wings page no longer pixel-matches `claude_The_Peacemaker_Page_Wings_v1.html`, which
omits the subtype. This is the ratified resolution of §12.1 and is recorded as a re-baseline.
**Measured**: Wings content stack 918.75px, headroom 57.25px — unchanged by the header edit.

---

## 7. Transparency gate — built, and it caught three bugs in itself

**Measured** (`grep -rniE 'transparen|SMask|soft ?mask|qpdf' scripts tests app .github` on
`main`): **zero hits**. The invariant spec §3.2 calls document-wide had never been enforced;
the build plan deferred it to PR 5 and it was never built.

`scripts/verify_transparency.js` now asserts zero transparency groups, zero soft masks, no
`/ca`|`/CA` < 1 and no non-normal `/BM` in the emitted client PDF, and runs as a sixth CI step.

**The positive control earned its place immediately.** It renders a deliberately bad page
(the cover with `transparent` and `rgba()` restored) and requires the scanner to *find* the
violation. It failed three times against my own scanner, each a real defect that would have
shipped a green, meaningless gate:

1. object-by-object reassembly silently dropped the object carrying the `/Group` dict;
2. `page.pdf()` returns a `Uint8Array`, whose `toString('latin1')` yields comma-joined byte
   values — so the scanner was reading `"37,80,68,70,…"`, not PDF syntax;
3. the `/SMask` pattern matched only names and indirect refs, missing the **dictionary** form
   Chromium actually emits.

**Measured, current state** (`node scripts/verify_transparency.js`): client v3 PDF —
0 groups, 0 soft masks, 0 non-opaque alphas, 0 non-normal blends, 1 shading object (the
opaque cover gradient). Control: 1 group, 1 mask, 1 alpha — detector confirmed live.

Two notes for the docs-correction PR: spec §3.2 claims **2** shading objects for the fixed
cover; **measured is 1**. And the tracked Quick Reference mockup carries `fill-opacity` on all
nine heat-map nodes plus a `stop-opacity` gradient — **measured**, rendering it produces 1
transparency group, 1 soft mask and 8 non-opaque alphas. When PR 5 ports that page, this gate
stops a verbatim copy at CI rather than in a client's viewer.

---

## 8. Long-name handling

**Measured** (name length walked 10→60 chars, line count from `Range.getClientRects()`):

| Surface | Font | Box | 1-line ceiling | Unbreakable token |
|---|---|---|---|---|
| Cover `.v3-cv-name` | 20px bold | 362px | **33 chars** (wraps at 34) | **no overflow ≤60** after the fix |
| Contents `.v3-toc-name` | 22px bold | 662px | **>60 chars** | no overflow ≤60 |
| Page header `.header-client` | 10px bold | inline | **>60 chars**, never wraps | no overflow ≤60 |

The fix is `overflow-wrap:break-word` plus `overflow:hidden` on the cover shell — **not**
conditional font sizing. The 34-char wrap is harmless (286.56px of vertical clearance), and a
font reduction would not have solved the 33-char unbreakable token, which was the actual
defect. Page heights stay 1056px across every name length tested.

Spec §3.2's "~30 characters" is conservative by 4; the measured ceiling is 34. For the
docs-correction PR.

---

## 9. Fit — every page measured against the 976px budget

**Measured** (`node scripts/render_client.js`, print media, Arial metrics asserted):

| Sheet | Page | Content stack | Headroom | Sheets |
|---|---|---|---|---|
| 1 | Cover | *(absolutely positioned)* | n/a | 1 |
| 2 | Contents | 862.13px | 113.87px | 1 |
| 3 | Welcome | 820.50px | **155.50px** | 1 |
| 4 | What Is | 943.42px | **32.58px** | 1 |
| 8 | Wings | 918.75px | 57.25px | 1 |
| 12 | Your Thoughts | 900.61px | **75.39px** | 1 |

Two of the brief's predictions were wrong in the safe direction:

* **Welcome was expected to be tight.** It is not: 155.50px headroom at the mockup's 14px
  body. **Measured** at 15px it is 132.75px and at 16px 110.00px — it fits at all three, so
  the founder photos held in reserve as a release valve were never needed. The approved copy
  is **179 words** measured, not the ~215 estimated.
* **Your Thoughts gained headroom**, 32.76px → 75.39px, as predicted — prompt 3 dropped from
  two rendered lines to one.

**What Is is now the tightest page in the document at 32.58px.** It is nine cards in a
flex-wrap grid; a longer archetype name or one extra clause in a card description will spill
it. That is the page to watch in any future content edit.

---

## 10. Open conflicts raised, not silently resolved

### 10.1 Orange on framework content (spec §5.3)

`WhatIs_v2.html` renders all nine type names in `#F68625`. Spec §5.3 reserves orange for
client identity, lists exactly four places, and says the rule "must not be diluted" — nine
framework type names is a fifth place and the largest by area in the document.

The v2 mockup is the ratified gold standard, so it is **reproduced verbatim** rather than
silently corrected, and flagged here for a decision. Changing it is a one-token CSS edit.

### 10.2 Orphaned content, tracked not deleted

* `static.welcome.callout` — the v3 Welcome page has no callout box; its substance folded
  into `letters[2]`. Retained so the shape gate holds.
* `static.primer.pillars` — the v3 What Is page has no pillars band. Still gated at exactly 3
  (`build_content_library.js`), so removal must be a deliberate decision.

### 10.3 Cover shell — hypothesis disproved

The audit expected the cover's absolutely-positioned children to break inside `.v3-page`
(static-positioned, `padding:40px 53px`, flex column) where the mockup uses
`position:relative; overflow:hidden; height:1056px` with no padding.

**Measured** (four configurations, including a second page stacked to remove the y=0
coincidence): the layout is **identical in all four**. Absolutely-positioned elements resolve
against the padding box, so the 53px padding does not inset them, and the cover is always
sheet 1 at y=0. The shell was still given `is-cover` for `height` and `overflow:hidden`,
which the long-name fix needs.

---

## 11. Gate status

**Measured**, this branch, all six green:

| Gate | Command | Result |
|---|---|---|
| Unit + structure | `npm --prefix app test` | PASS — 59 assertions |
| Render / single-sheet / hyphenation | `npm --prefix app run verify:render` | PASS — 6 pages, all 1056px |
| Diagram geometry + structure | `node scripts/verify_diagrams.js` | PASS — 18 diagrams + 2 new wheels |
| **Transparency (new)** | `node scripts/verify_transparency.js` | PASS — 0/0/0/0, control fires |
| Coach regression | `node scripts/verify_coach_baseline.js` | PASS — **byte-identical**, both fixtures |
| Content library invariant | `node scripts/verify_content_library.js` | PASS |

The coach byte-identical result is the load-bearing one: it proves the two new
`buildEnneagramSVG` variants did not perturb `SVG_NODES` or any shared primitive.

---

## 12. Deliberate departures from the mockups

Exactly three. Any other departure is a defect.

1. **`.trow:last-of-type` → `:last-child`.** **Measured**: the ninth row's computed
   `border-bottom-width` in the mockup is `0px` and `last.matches('.trow:last-of-type')` is
   `false` — the last `div` in `.page` is `.page-footer`, so no row ever matches and the
   contents list renders with **no closing rule**. Fixed deliberately; a pixel diff against
   the mockup would otherwise lock the bug in as correct.
2. **Wings header re-baseline** (§6).
3. **TOC entry 07 descriptor** (§4.2) — the shipped string referenced the instinct stack that
   D4 cut, and was ungrammatical.

Plus two copy carve-outs approved before the build: Welcome paragraph 3 (the mockup described
a page order v3.0 does not have — it promised "first a quick summary of your results, then a
brief introduction", where the real order is Welcome → What Is → Quick Reference), and the
Your Thoughts intro and prompts 3–5.

---

## 13. CSS namespacing

The twelve reference implementations are standalone documents that reuse bare class names
with **different values**: `.prep` is bordered with `15px 18px` padding on the cover and
borderless with `20px 24px` plus a 34px bottom margin on Contents; `.prep-name` is 20px on one
and 22px on the other; `.intro` means one thing on Wings and another on Your Thoughts.
Concatenated into one document those silently overwrite each other — the collision class spec
§3.4 exists for, which "bit twice during design, both times invisible in code".

Every page-local class is therefore namespaced by page: `v3-cv-*`, `v3-toc-*`, `v3-wl-*`,
`v3-wi-*`, `v3-th-*`.

---

## 14. Known risk carried forward

`report_pages_test.js` asserts `client_v3: { 'v3-page': 6 }`. That number must be raised by
each page PR and reaches 12 at cutover. It is a literal by design — a test that derived the
expected count from the renderer would assert nothing.
