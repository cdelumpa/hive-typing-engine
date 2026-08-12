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
| 12.1 | Header subtype on every page | **REVERSED 12 Aug.** The subtype appears in no chrome anywhere — see §6 |
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

### 5.1 Where the U+2011 substitution lives — and why it should not stay there

**It is hand-edited into source constants, not a renderer transform.** Both substitutions sit
in `INTERIM_*` constants in `scripts/build_content_library.js`:

* `INTERIM_THOUGHTS.intro` — `pressure‑test`
* `INTERIM_WINGS_V3` (`type_9.wings.wing_b.bullets[4]`) — `self‑forgetting`

Those constants **are** the canonical source for those two leaves, so there is no
JSON-versus-docx drift of the PR 1.5 kind: neither leaf is parsed from Word, and
`verify_content_library.js` passes precisely because the build reproduces them. **Measured**:
the canonical docx contains **zero** U+2011 characters.

But it is consistent **by memory, not by construction**, and it has already produced a
divergence worth naming. **Measured** — five leaves in the library contain the compound, and
only one is spelled with U+2011:

| Leaf | Source | Character |
|---|---|---|
| `type_9.wings.wing_b.bullets[4]` | INTERIM | **U+2011** |
| `type_9.patterns.feeling.bullets[3]` | Word | U+002D |
| `type_9.challenges[0].title` | Word | U+002D |
| `type_9.comparison.challenges` | Word | U+002D |
| `subtype_sx9.narrative` | Word | U+002D |

The same word is now spelled two ways inside one content library. Across PR 3, 4 and 6 —
roughly 500 more zones — every future splitting compound needs the same manual edit, applied
by whoever remembers this document exists. The render gate catches the *symptom* (a word
split across lines) but not the *remedy*, and it only fires when that particular line happens
to break at that particular point.

**Two consequences to flag rather than let be discovered:**

1. **The Wings review copy and the built copy differ by one character.**
   `type_9.wings.wing_b.bullets[4]` is approved content currently in front of Mo for the
   Wings review. The approved string has a plain hyphen; the build has U+2011.
2. **U+2011 is not copy-exact.** A client copying `self‑forgetting` out of the PDF gets a
   non-ASCII character that will not match a search for `self-forgetting`. That is the same
   objection that ruled U+2011 out for URLs (§5).

**Recommendation, for PR 3 rather than here:** replace the source edits with a renderer-side
transform — the same shape as `_v3NoBreakUrls`, wrapping hyphenated compounds in a
`white-space:nowrap` span. That would make source strings byte-identical to approved copy
(removing both consequences above), apply automatically to all future content, and keep the
extracted text exact. It needs one guard: a compound long enough to exceed its column must
still be allowed to break, so the wrap should be conditional on length. Not done in PR 2
because it changes hyphenation behaviour across pages this PR does not own.

---

## 6. §12.1 reversed — no subtype in chrome, and what that costs

Cai reversed §12.1 on 12 Aug: **the subtype appears in no chrome anywhere in the client
report.** `_v3Header` is back to what PR 1 shipped, and the Contents client strip drops it
too. `display.instinct_code` stays derived in the model but is unconsumed by PR 2 — sheet 5
needs it.

Consequence, accepted: **the client's subtype now appears nowhere in the six built sheets.**
Quick Reference (sheet 5) introduces it properly. It must not be reintroduced into chrome.
`report_pages_test.js` asserts the code appears nowhere in the rendered HTML, so a future
"restore fidelity to the mockup" trips a test instead of shipping.

### 6.1 Six deliberate departures from the gold-standard mockups

Five mockups print `· SX9` in the running header and `TOC_v2` prints it in the client strip.
The build departs from all six. **Aggregate** (`grep` over `docs/mockup/*.html`):

| # | Mockup | Where | Mockup prints | Build prints |
|---|---|---|---|---|
| 1 | `TOC_v2.html` | header | `… The Peacemaker · SX9` | `… The Peacemaker` |
| 2 | `TOC_v2.html` | `.prep-sub` client strip | `… The Peacemaker · SX9 · August 2026` | `… The Peacemaker · August 2026` |
| 3 | `Welcome_v2.html` | header | `… · SX9` | omitted |
| 4 | `WhatIs_v2.html` | header | `… · SX9` | omitted |
| 5 | `CAR_v1.html` | header | `… · SX9` | omitted |
| 6 | `Thoughts_v2.html` | header | `… · SX9` | omitted |

Departures 5 is on a sheet PR 2 does not build; it is listed because the shared header will
apply to it at PR 6. Without this list a pixel diff reads as six regressions.

### 6.2 Wings does not pixel-match its mockup — and never did

The brief expected the revert to restore a pixel match "exactly as it did on main @
808174f". **Measured** (Chromium screenshot of the rendered page vs the mockup rendered at
816×1056, per-pixel max-channel delta > 8):

| Comparison | Differing pixels | Share | max Δ |
|---|---|---|---|
| **main @ 808174f** built Wings vs `Wings_v1.html` | 16,926 / 861,696 | **1.9643%** | 181 |
| **this branch** built Wings vs `Wings_v1.html` | 18,318 / 861,696 | **2.1258%** | 225 |
| **this branch vs main @ 808174f**, both built | 1,392 / 861,696 | **0.1615%** | 225 |

**The premise is false on both halves: Wings did not match on `main`, and it does not match
now.** PR 1's "verify against the contact sheet" was inspection, not a pixel diff.

Two findings separate cleanly:

* **The header revert is pixel-clean.** The branch-vs-main delta is confined to rows
  **y = 782–789** — a single text line — and the header band (y ≈ 45) is byte-for-byte
  identical. **Measured**: the differing rows fall inside the wing bullet *"Left unchecked,
  quiet perfectionism can turn self‑forgetting into self-judgment."* (y0 757, y1 795). That
  is the U+2011 hyphenation fix changing where the line breaks — deliberate, and the only
  thing PR 2 changes on this page.
* **A pre-existing ~1.96% delta against the mockup, from PR 1.** Concentrated in rows
  y = 177–288, the intro + diagram band (`.v3-dia`, y0 148 → y1 370). Side-by-side crops at
  100% are visually indistinguishable, so this is sub-pixel stroke and glyph offset between
  the mockup's hand-authored SVG and `buildEnneagramSVG`'s port, not a geometry error — the
  structural gate confirms nodes, angles and both flow sequences are correct. **Logged for
  the docs/PR-1 follow-up; not fixed here**, because changing the diagram in PR 2 would put
  an unrelated visual change inside a static-pages PR.

The useful conclusion is about the gate, not the number: "pixel-reference diff" has been a
reviewer eyeballing a render since PR 1. It is now measurable, and the honest baseline is
1.96%, not zero.

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

### 8.1 The constraint is a width, not a character count

Earlier drafts of this section quoted a single character ceiling and the number moved twice
(33, 34, 35). All three were real measurements of *different name shapes*, which is the
finding: **where the spaces fall changes the wrap point, so no single character count is
correct.** The stable constraint is the box.

**Measured** (`ceiling.js`, print media, Arial metrics asserted, sweeping three word shapes):

| Surface | Font | Box width | Character ceiling | Unbreakable token |
|---|---|---|---|---|
| Cover `.v3-cv-name` | 20px bold | **362px** | **32–36 chars**, by word shape | no overflow ≤60 after the fix |
| Contents `.v3-toc-name` | 22px bold | 662px | >60 chars | no overflow ≤60 |
| Page header `.header-client` | 10px bold | inline | >60 chars, never wraps | no overflow ≤60 |

Cover ceiling by shape: **one long token 32 · two even words 34 · many short words 36.**

Sanity check against reality — **measured**, all twelve of a set of real-world names fit one
line, the widest being *Bartholomew Featherstonehaugh* (29 chars) at **317.8px**, still 44px
inside the 362px box.

The fix is `overflow-wrap:break-word` plus `overflow:hidden` on the cover shell — **not**
conditional font sizing. A wrap to two lines is harmless (286.56px of vertical clearance);
the actual defect was an unbreakable token overrunning the panel horizontally, which a font
reduction would not have fixed. Page heights stay 1056px at every name length tested.

### 8.2 Correction owed to the docs PR — and where the claim actually lives

The claim is **not in design spec v3.0 at all**; earlier drafts of this document cited
"spec §3.2", which is the transparency section, and pointing the correction there would have
reproduced the stale-citation pattern the docs PR exists to fix.

**Measured** (`grep` across `docs/*.md` and both briefs on disk): the only source is
**CD Brief v1.9, the Cover page section**, reading:

> "Client name: dynamic — personalized. No max word count; name fits on one line at 20px bold
> up to ~30 characters. Longer names may need font-size reduction to 17px."

Two corrections for that section, not spec §3.2:

1. **"~30 characters"** is a safe rule of thumb, low by 2–6 against the measured 32–36 band.
   Better restated as the box: *fits one line at 20px bold within a 362px column, roughly
   32–36 characters depending on the name.*
2. **"reduction to 17px"** should be struck. It addresses a failure mode that no longer
   exists — `overflow-wrap` handles the real defect, and a font reduction never addressed it.

**Bonus finding from the same brief section**, corroborating §10.1: brief v1.9 lists orange
as *"Cover logotype 'Out' half, cover client name. **EXCEPTION — Page 2 only: also used for
type archetype names**"*. So the nine orange type names on What Is are **documented** in the
brief as a deliberate exception. Spec §5.3, which names exactly four places and omits it, is
the stale artifact — exactly as ratified on 12 Aug.

---

## 9. Fit — every page measured against the 976px budget

**Measured** (`node scripts/render_client.js`, print media, Arial metrics asserted):

| Sheet | Page | Content stack | Headroom | Sheets |
|---|---|---|---|---|
| 1 | Cover | *(absolutely positioned)* | n/a | 1 |
| 2 | Contents | 862.13px | 113.87px | 1 |
| 3 | Welcome | 796.50px | **179.50px** | 1 |
| 4 | What Is | 943.42px | **32.58px** | 1 |
| 8 | Wings | 918.75px | 57.25px | 1 |
| 12 | Your Thoughts | 900.61px | **75.39px** | 1 |

Two of the brief's predictions were wrong in the safe direction:

* **Welcome was expected to be tight.** It is not: **179.50px** headroom with the founder
  photos in place, at the mockup's 14px body (155.50px before the photo/scrawl swap).
  **Measured** on the pre-photo layout, 15px gave 132.75px and 16px gave 110.00px — it fits
  at all three. The photos were held in reserve as a release valve for a fit problem that
  never materialised, and adding them made the page *roomier*. The approved copy is
  **179 words** measured, not the ~215 estimated.

  On body size: the build ships the v2 mockup's **14px**, since v2 is the gold standard and
  font size was not a carve-out. For the record, the artifact the 15px exception was
  recorded against — the locked v1.7 `The_Peacemaker_Page_Welcome.html` — **does use 15px**:
  `.subhead { font-size: 15px }` and `.letter-para { font-size: 15px }`, against
  `.callout-text` at 14px. **Measured**, 15px fits with 132.75px to spare. Cai's call.
* **Your Thoughts gained headroom**, 32.76px → 75.39px, as predicted — prompt 3 dropped from
  two rendered lines to one.

**What Is is now the tightest page in the document at 32.58px.** It is nine cards in a
flex-wrap grid; a longer archetype name or one extra clause in a card description will spill
it. That is the page to watch in any future content edit.

---

## 10. Open conflicts raised, not silently resolved

### 10.0 Founder photos — the named source does not contain them

Brief v1.7 is recorded as locking founder photos at 84px circles in the Welcome signature
block, sourced from `The_Peacemaker_Page_Welcome.html`.

**Measured.** The named file exists at
`~/Library/Mobile Documents/.Trash/The_Peacemaker_Page_Welcome.html` (8,359 bytes, modified
2026-07-24 09:14). It contains **zero `<img>` tags** and no external `src` of any kind. Its
`.photo-circle` rule is:

```css
.photo-circle { width: 84px; height: 84px; border-radius: 50%;
                background: #D9E4E9; flex-shrink: 0; overflow: hidden; margin-bottom: 12px; }
```

That is an **empty CSS placeholder**, structurally the same thing PR 2 already ships as
`.v3-wl-av`. The 84px figure is the *circle* size; there is no photo asset behind it.

Real headshots do exist, but only in superseded drafts: `~/Downloads/welcome_page.html` and
`welcome_page_1.html` (both 2026-06-06, seven weeks before v1.7), each carrying two
base64-embedded 240×240 PNGs in a `.sig-photo` block sized **92px, not 84px**. The two files
share Cai's photo (`sha256 a7964b4e…`) but carry **different** photos for Mo
(`17b07604…` vs `c3c7c5a4…`), with no marker of which is current.

So the assets were neither embedded nor linked in the named source — they were **absent**, a
third case the instruction did not cover.

**Resolved 12 Aug: Cai supplied both headshots**, and they are now in the build.

### 10.0.1 The alpha trap, and why the photos are re-encoded

**Measured** (`sharp` metadata on the supplied files):

| Source | Format | Size | Dimensions | Alpha |
|---|---|---|---|---|
| `docs/hive_cai_headshot-round_kit_091125.png` | PNG | 0.20 MB | 300×299 | **yes — 23.0% fully transparent, 0.6% semi-transparent** |
| `docs/mo_headshot_square_07162-4.jpeg` | JPEG | 18.31 MB | 2623×2623 | no |

The Cai headshot is a **round crop**: its corners are transparent and its circle edge is
antialiased. Chromium emits an `/SMask` soft mask for any alpha imagery, spec §3.2 forbids
soft masks document-wide, and `verify_transparency.js` fails the build on a single one — so
embedding it as supplied would have broken the gate added in this same PR. It is the same
mechanism as the cover-page pink bug.

`scripts/build_founder_photos.js` therefore normalizes both: square-crop to 220px (110px
rendered at 2× for print), **flatten onto opaque white, remove the alpha channel**, strip
ICC/EXIF, re-encode as JPEG. The circular crop moves to CSS (`border-radius:50%` +
`overflow:hidden` on `.v3-wl-av`), which is how the placeholder already worked. Visually
identical, zero soft masks. Flattening is lossless in effect because the page behind the
photo is white.

Both `flatten()` and `removeAlpha()` are needed: flatten alone leaves a 4-channel image whose
alpha is uniformly 255, and Chromium still emits a mask for it.

**Measured, after**: 14.6 KB (Cai) and 13.8 KB (Mo) as embedded data URIs; client PDF scan
still 0 groups / 0 masks / 0 alpha < 1. The scan was re-run after the 110px re-encode
specifically because a re-encode at a new size is where an alpha channel could creep back in.

**Source ceiling, recorded because it binds:** the Cai headshot is 300×299, so a true 2×
embed caps the rendered circle at **150px**. 110px needs 220px and is comfortably inside it.
Anything above 150px needs a new source file rather than an upscale — `sharp` would enlarge
without complaint and the result would be soft in print with no gate failing. Mo's 2623×2623
source is unconstrained.

The 18.31 MB source is 31× more resolution than an 84px circle can use, so the originals are
**gitignored** rather than committed; their sha256 digests are recorded in the generated
module so the inputs stay identifiable.

### 10.0.2 Signature scrawl removed

The hand-drawn SVG squiggle in the reference implementations was a placeholder for a real
signature asset. Design dropped the signature entirely rather than source one, so the card is
now photo → name → role → type.

**Measured**, in two steps:

| Stage | Stack | Headroom |
|---|---|---|
| Placeholder + scrawl (as first built) | 820.50px | 155.50px |
| 84px photos, scrawl removed | 796.50px | 179.50px |
| **110px photos, cards tightened** (shipped) | **822.50px** | **153.50px** |

Removing the 26px scrawl and its 8px margin more than paid for the 70→84px avatar; raising
to 110px then spent it back. Net against the original placeholder layout: **2px**. Welcome
remains the second-roomiest page in the document.

### 10.0.3 Signature block spacing

Cai asked for the pair to read as a pair. **Measured before changing anything**: the block
was already `display:flex` at `justify-content: normal` — i.e. left-aligned, not distributed.
The spread came from the CARD WIDTH: cards were fixed at `214px` against measured content
widths of **121.2px** and **132.1px**, so each card carried 82–93px of dead space and the two
circles sat **190px** apart.

The fix is therefore the card, not the justification: `width: max-content` sizes each card to
its own longest line, which makes `gap` the only spacing lever, and the gap drops 60px → 36px.

| | Before | After |
|---|---|---|
| Avatar | 84px | **110px** |
| Card width | 214px fixed | **121.2 / 132.1px** (max-content) |
| Gap | 60px | **36px** |
| Circle-edge separation | 190px | **47.2px** |

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

Anything not on this list is a defect.

**Structural / CSS**

1. **`.trow:last-of-type` → `:last-child`.** **Measured**: the ninth row's computed
   `border-bottom-width` in the mockup is `0px` and `last.matches('.trow:last-of-type')` is
   `false` — the last `div` in `.page` is `.page-footer`, so no row ever matches and the
   contents list renders with **no closing rule**. Fixed deliberately; a pixel diff against
   the mockup would otherwise lock the bug in as correct.
2. **Six subtype omissions** (§6.1) — five headers plus the Contents client strip.
3. **URLs wrapped in a nowrap span** (§5), so the Welcome URL cannot split across lines.

**Copy**

4. **TOC entry 07 descriptor** — the shipped string referenced the instinct stack D4 cut,
   and was ungrammatical. Now bound to `display.subtype_label` (§4.2).
5. **TOC entry 09 descriptor** — the mockup promised "what to expect in your debrief
   conversation", which the approved p12 copy does not deliver. Replaced with *"A closing
   note and questions to reflect and/or journal on."*
6. **Welcome paragraph 3** — the mockup described a page order v3.0 does not have (it
   promised "first a quick summary of your results, then a brief introduction", where the
   real order is Welcome → What Is → Quick Reference).
7. **Your Thoughts intro and prompts 3–5** — approved copy; prompt 3's positional
   "the previous page" reference deliberately removed.
8. **`self-forgetting` → `self‑forgetting`** (U+2011) in the type-9 wing bullet, and
   `pressure‑test` in the p12 intro (§5).

9. **Founder photos in, signature scrawl out** (§10.0.1–2) — the mockups draw an empty
   placeholder circle and a hand-drawn SVG squiggle; the build carries real 110px headshots
   and no signature.

**Explicitly NOT a departure:** the nine orange type names on What Is. Ratified 12 Aug as
correct-as-shipped; spec §5.3 is the thing that is now wrong, and that correction is logged
against the docs PR (§10.1).

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
