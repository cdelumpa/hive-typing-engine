# Audit — PR 3: p6 / p7 "Exploring Your Type Hypothesis"

**Date:** 13 August 2026
**Branch:** `pr-3-explore`, cut from `main` @ `5ad3ff9`
**Scope:** sheets 6 and 7 — band reconciliation, current headroom, zone inventory, Type 9
content readiness, risk surface.
**Not in scope:** p8 Wings and p9 Lines (merged, PR #77/#78). No authoring, no building, no PR.

Every number is tagged **measured** (command + where), **derived** (inputs + assumption) or
**aggregate** (the set). Figures carried over from either prior audit were re-verified here
rather than cited; two of them changed.

**Measurement environment:** repo root at `5ad3ff9`, macOS (darwin 25.5.0), lockfile-pinned
bundled Chromium `Chrome/147.0.7727.57` via `app/browser_launch.js`, font probe asserted
(genuine Arial) before every measurement. Instrument: `scripts/spike/explore_pages_probe.js`
(committed under the scratch path); ad-hoc cross-checks in the session scratchpad.

---

## Branch state

| | |
|---|---|
| Base | `main` @ `5ad3ff98e3cd669d3f873b866989a1f4d14c629e` |
| Branch | `pr-3-explore`, 0 commits ahead at audit start |
| `docs/audit_pr3_per_type_pages.md` | **present and intact** — 884 lines, 50,018 bytes, all 9 top-level sections and 40 subsections readable. The PR #77 squash of `f4d622a`+`7455423` did not mangle it. |
| Working tree | `.claude/launch.json` modified (pre-existing, unrelated) |

---

## 0. The finding that reorders everything below

**p6 and p7 do not exist in the renderer.** `V3_PAGE_ORDER` (`app/renderer.js:2957–2958`)
reserves both sheets —

```js
{ key: 'typeA', sheet: 6, footer: 4, title: 'Exploring Your Type Hypothesis' },
{ key: 'typeB', sheet: 7, footer: 5, title: 'Exploring Your Type Hypothesis (continued)' },
```

— but `buildClientReportHTML_v3` emits **seven** pages (Cover, Contents, Welcome, What Is,
Wings, Lines, Thoughts) and there is no `_clv3TypeA` / `_clv3TypeB`. **measured** — read of
`app/renderer.js:3104–3367`; `grep -n "^function _clv3"` returns exactly seven functions.

Consequence for section B: "re-measure headroom on current main" cannot mean the shipped
renderer, because these pages have no shipped form. The only renderable source is the mockup
pair, and that changes what a confirmed figure proves. Stated in full in B.

**And the mockups for both pages exist, with complete Type 9 prose.**

> ### ⚠️ Premise correction — the p6/p7 references were not missing, they were misfiled
>
> The brief states *"Only two Peacemaker HTML reference pages are confirmed present (Welcome,
> TOC) — do NOT assume full p6/p7 HTML references exist."*
>
> **Twelve exist**, covering every sheet of the document. **measured** — `ls docs/mockup/`.
> p6 and p7 are:
>
> - `docs/mockup/claude_The_Peacemaker_Page_LeadingType_A_v1.html` (12,226 bytes)
> - `docs/mockup/claude_The_Peacemaker_Page_LeadingType_B_v1.html` (9,818 bytes)
>
> They are named **LeadingType**, not *Exploring*, which is almost certainly why a search for
> the page titles missed them. That they are the right pages is not an inference:
>
> | | LeadingType_A | LeadingType_B |
> |---|---|---|
> | `<title>` | InsightOut · Exploring Your Leading Type · Type 9 | …(continued) · Type 9 |
> | `.eyebrow` | **Exploring Your Type Hypothesis** | **Exploring Your Type Hypothesis (continued)** |
> | footer | **Page 4** | **Page 5** |
> | `V3_PAGE_ORDER` | `typeA` sheet 6, **footer 4** | `typeB` sheet 7, **footer 5** |
>
> Eyebrows and footer numbers match the code exactly. Both are Type 9 / The Peacemaker.
> **This is the single most consequential finding in the audit** — it moves p6/p7 from "no
> reference, author from scratch" to "a complete Type 9 reference exists and is measurable."

---

## A. The band discrepancy

### A1 — What the 96–114 / 190–231 figures were actually measured against

**They are not p6/p7 figures.** `docs/audit_pr3_per_type_pages.md` §3.1 contains **four
separate tables**, one per sheet, each with its own zones and widths. The numbers quoted in
the brief come from the **p8 Wings** table (lines 234–235):

| Zone | Width | 1 line | 2 | 3 | 4 |
|---|---|---|---|---|---|
| `.v3-wing-txt` bullet | **293px** | 50–57 | **96–114** | 142–171 | 188–228 |
| `.v3-wing-over` overview | **308px** | 52–60 | 98–117 | 144–174 | **190–231** |

The p6 and p7 tables (lines 208–228) share **not one zone class** with that table. So the
premise that the two documents disagree "for what reads as the same zone types" is only half
right: they disagree about **p8**, and neither figure set was ever about p6/p7.

**measured** — read of `docs/audit_pr3_per_type_pages.md:195–248`, local.

### A2 — p6 and p7 column widths, measured independently

**measured** — `node scripts/spike/explore_pages_probe.js`, local, against the two mockups at
816×1056, print media, Arial asserted. Widths are `clientWidth − horizontal padding`, read
**without mutating the DOM** (see the note below on why that matters).

#### p6 Exploring A

| Zone | n | contentBox | Font | Type 9 chars | lines |
|---|---|---|---|---|---|
| `.cm-words-quote` "In Your Own Words" | 1 | **668px** | 12.5/400 | 267 | 3 |
| `.intro-desc` | 1 | **514px** | 14/400 | 348 | 5 |
| `.cm-narrative` core motivation | 1 | **423px** | 13.5/400 | 144 | 3 |
| `.cm-col-txt` worldview, core belief | 2 | **314px** | 13/400 | 115, 90 | 3, 2 |
| `.glance-value` | 4 | **222px** | 12.5/400 | 61–94 | 2–3 |
| `.pat-body` pattern body | 3 | **196px** | 12.5/400 | 173–188 | 5–6 |
| `.glance-label` | 4 | **92px** | 9/700 | 15–32 | 2–3 |

#### p7 Exploring B

| Zone | n | contentBox | Font | Type 9 chars | lines |
|---|---|---|---|---|---|
| `.lead` | 1 | **710px** | 14/400 | 319 | 3 |
| `.col-head` / `.pr-head` | 2 / 2 | **312px** | 10/700 | 12–31 | 1 |
| `.item-text` strengths/challenges | 6 | **293px** | 13/400 | 73–95 | 2 |
| `.pr-text` catching-patterns | 6 | **229px** | 12.5/400 | 36–49 | 1 |
| `.style-name` / `.style-lbl` chicklet | 3 / 3 | **192px** | 13.5/700 | 19–22 | 1 |
| `.s-text` chicklet bullet | 9 | **179px** | 12.5/400 | 64–85 | 3 |

**p6 and p7 use different widths from each other** — seven distinct widths on p6, six on p7,
with no value shared between them. They are one logical page split in two, but not one
geometry.

**Every one of these confirms the 12 Aug table to the pixel.** Both audits independently
measure `.cm-narrative` 423, `.cm-col-txt` 314, `.glance-value` 222, `.pat-body` 196,
`.glance-label` 92, `.intro-desc` 514, `.cm-words-quote` 668, `.item-text` 293, `.col-head`
312, `.pr-text` 229, `.style-name` 192, `.s-text` 179.

### A3 — Verdict: neither set governs p6/p7, and the 12 Aug widths are the correct ones

**Neither the 96–114/190–231 figures nor the Wings audit's 69–89/186–196 apply to p6 or p7**,
because both were measured on other pages' zones. p6/p7 have their own widths, listed above.

**One exception, and it is useful:** p7's `.item-text` is **293px at 13/400** — the same width
as p8's `.v3-wing-txt`, one point larger. p8's bullet bands transfer to that one zone with a
small downward adjustment for the larger type; nothing else transfers.

### A4 — Why the two documents diverged, and which is right

The discrepancy is real but it is about **p8**, and it has two independent causes.

**Cause 1 — the Wings audit's width was wrong. My error, and it is the load-bearing one.**

`docs/audit_pr3_wings.md` §C3a reports `.v3-wing-txt` at **280.66px**. It measured that by
stuffing the node with filler text and reading the widest resulting line box. That method is
unsound for any element that sizes to its content: stuffing changes the layout, so the number
that comes back is a width the element never had. Re-measured **without mutation**, on the
**shipped renderer** (not a mockup):

```
sel                contentBox   maxLine  lines   parentBox
.v3-wing-txt             293    283.72      2         308
.v3-wing-over            308    307.81      4         308
.v3-res-txt              308    288.39      4         308
```

**measured** — Puppeteer against `buildClientReportHTML_v3`, local, Arial asserted.

**293px and 308px — exactly the 12 Aug figures.** The 12 Aug audit was right and the Wings
audit was wrong by ~12px (4%) on the bullet zone. Bands derived at 280.66px are therefore
**conservative, not incorrect** — they fit fewer characters than the column really holds.

The same probe now reports all three readings side by side and flags any zone where stuffing
disagrees with the content box; on p7 it inflates `.pr-text` from its true 229px to 280.66px,
which is how the error was caught.

**Cause 2 — the two documents measure different quantities.**

- 12 Aug measures a **ceiling**: the most characters that still fit in N lines, swept across
  three synthetic word shapes. "96–114" is a range *across word shapes*, not a target band.
- Wings §C3a measures a **safe band**: the range where line count is stable across 40–60 real
  prose samples *and* the last line is at least 25% full.

Both are correct; they answer different questions. Once the width is corrected they agree
where it matters — 12 Aug concludes *"the safe 1-line ceiling is 50"*, and Wings' 48 is that
same figure computed against a 4%-narrow column.

**Settled empirically.** The Wings audit flagged 16 shipped bullets sitting at 49–52 chars as
a coin-flip risk and recommended pulling them to ≤48 in r3. Measured against the shipped page,
all nine types:

```
total bullets rendered: 90
bullets in the 49-52 char band: 16
  of those, rendering ONE line : 16
  of those, WRAPPING to 2 lines: 0
highest char count that renders ONE line in shipped content: 52
char counts with mixed line counts across types: (none)
```

**measured** — Puppeteer over all nine types against `buildClientReportHTML_v3`, local.

> **Withdraw the r3 recommendation.** All 16 render on one line; none wraps. The concern was
> an artifact of the under-measured width. No r3 re-cut is needed on that basis.

**Geometry vs prose (A4's instruction).** Every width above is a CSS fact and is stated with
confidence. **No character bands for p6/p7 are proposed in this audit.** Type 9's real prose
now exists for both pages (section C), so bands should be derived from it during the build
rather than from probe strings — the Wings lesson was that prefix-cut probes mispredict what
authored copy does, and there is no longer any need to guess.

---

## B. Headroom on current main

**measured** — `node scripts/spike/explore_pages_probe.js`, local, min-height released, natural
height read, restored.

| Sheet | Page | Natural stack | **Headroom** | 12 Aug | Delta |
|---|---|---|---|---|---|
| **6** | **Exploring A** | 1044.69px | **11.31px** | 11.31px | **0.00** |
| **7** | **Exploring B** | 1041.75px | **14.25px** | 14.25px | **0.00** |

Both **confirm exactly**.

> ### ⚠️ What that confirmation does and does not prove
>
> The brief expects the figures may have moved because *"multiple shared-CSS and footer-adjacent
> changes have landed since."* They have not moved, but **not because the CSS is stable — because
> the mockups cannot see it.**
>
> The mockups are fully self-contained: one inline `<style>` block, **zero `<link>` elements**
> (**measured** — `grep -cE "<link"` returns 0). They do not load `clientReportV3Styles()` or
> `partAStyles()`. Nothing merged into `main` since 12 August could have changed these numbers,
> so "unchanged" is a statement about insulated artifacts, not about the live stylesheet.
>
> **These are pre-port figures and they will be re-established when the pages are built.** The
> only evidence that porting preserves geometry is p8: its mockup and its shipped form measure
> the same content stack to the hundredth of a pixel. That is one data point, and it is
> encouraging, not conclusive.

### B2 — p6 is still the tightest page in the document

**Confirmed.** p6 at **11.31px** is tighter than P4 What Is at **12.58px**, which I measured on
the **shipped renderer** this session (**measured** — Type 7 render, `.v3-page` index 3, local).
p7 at 14.25px is third.

At 11.31px, p6 cannot absorb one additional rendered line anywhere: its smallest line box is
`.glance-label` at 12.60px, already larger than the whole budget. Every p6 zone is a
one-line-or-spill constraint. The `.pat-body` zones already run **5–6 lines each** at 196px, so
the margin is thinnest exactly where the per-type prose varies most.

---

## C. Zone inventory and Type 9 content readiness

### C1 — Zone inventory, re-derived

**measured** — every text-bearing leaf element enumerated from both mockups.

| | p6 | p7 |
|---|---|---|
| DOM text zones (distinct classes) | 21 | 13 |
| SVG numerals (`<text>`) | 9 | 0 |
| Chrome (header, eyebrow, footer) | 6 | 6 |
| Static labels (same for all types) | 6 | 4 |
| Token-derived (nickname, type name, numeral) | 7 | 1 |
| **Per-type authored** | **10** | **24** |

**p6's 10 authored zones:** `.cm-narrative` ×1, `.cm-col-txt` ×2, `.glance-value` ×4,
`.pat-body` ×3.
**p7's 24:** `.item-text` ×6, `.style-name` ×3, `.s-text` ×9, `.pr-text` ×6.

Both **confirm the 12 Aug counts** (p6 10 authored, p7 24 authored, p7 34 DOM zones). The
provisional scope table stands.

Two zones sit outside the per-type count and are worth naming because they are easy to
mis-budget:

- **`.intro-desc`** (p6, 348 chars, 5 lines) — templated, tokens only. Not per-type authoring.
- **`.cm-words-quote`** (p6, 267 chars, 3 lines, 668px) — *"In Your Own Words"*, a quotation
  from **the client's own questionnaire responses**. Per-client, not per-type. It is a pipeline
  dependency, not a content one, and nothing in the docx or library will ever supply it.

**Does main's 1316/1619 Word-canonical figure already include these leaves?** Partly, and the
distinction matters. The canon that *feeds* p6/p7 — `description.*`, `patterns.*.intro`,
`strengths`, `challenges`, `practices` — is Word-canonical and already inside the 1316.
**None of the p6/p7 zones themselves are in the library at all**, so none is counted in the
1619. Building these pages adds new leaves the way Wings did, and the same `SCRIPT_SOURCED`
widening will be needed if they land as an `INTERIM_*` constant.

### C2 — Mapping to spec §6, with misattributions flagged

| §6 row | Belongs to | Evidence |
|---|---|---|
| Strengths / challenges bullets | **p7** `.item-text` ×6 | 3 strengths + 3 challenges, `{title, body}` shape matches the bold-lead-in markup |
| Style names / chicklets | **p7** `.style-name` ×3 | Communication, Conflict, **Decision-Making** |
| Pattern bullets | **p6** `.pat-body` ×3 | Thinking / Feeling / Behaving |
| Practice bullets | **not p6 or p7** | No practices zone exists on either mockup |
| Subtype comparison | **not p6 or p7** | No subtype content on either mockup — PR 4 / p10, as the brief suspected |

> **Two misattributions confirmed.** Neither *practice bullets* nor *subtype comparison* has any
> zone on p6 or p7. `type_N.practices.bullets` (5 per type, all nine populated) feeds a page that
> is not in this PR — the 12 Aug handoff note's claim that Practices "feed page 7" is **not
> supported by the mockup**. Do not budget either into p6/p7 scope.
>
> A third, subtler one: the library has `type_N.center` ("Coming Back to Center"), which reads
> like a natural third chicklet. **It is not.** p7's third chicklet is **Decision-Making Style**,
> a different concept with no library or docx equivalent. Mapping `center` onto it would ship
> the wrong content under the right heading.

### C3 — Type 9 content readiness

**Docx sections confirmed directly** (**measured** — unzipped `word/document.xml`, ALL-CAPS
paragraph labels enumerated, local), *not* taken from the handoff note:

**Present:** `TYPE DESCRIPTION`, `HOW YOU SEE THE WORLD`, `CORE MOTIVATION`, `PATTERN OF
THINKING/FEELING/BEHAVING`, **`STRENGTHS`**, **`CHALLENGES`**, **`PRACTICES THAT HELP`**,
`HOW YOU NATURALLY COMMUNICATE`, `HOW CONFLICT SHOWS UP FOR YOU`, `YOUR CENTER OF INTELLIGENCE`.

**Absent:** any At-a-Glance section · Core Belief · Decision-Making · catching-patterns ·
chicklet bullets.

The handoff note's claim that the docx carries Strengths/Challenges/Practices is **correct**.
Its claim that they feed page 7 is **half right** — Strengths and Challenges do; Practices
does not appear on p7 at all.

**The full-draft PDF is a derivative, not a source.** `docs/insightout_client_report_full_draft_080726.pdf`
is 12 pages, `/Producer = pypdf`, `/Title = InsightOut Client Report - Anders Wennerstrom (Draft)`
— the same client name the mockups carry, and twelve mockups exist. It is a concatenation of
them. Text extraction needs `poppler` (not installed; `pdftotext` and `pdftoppm` both absent),
but there is no reason to extract it: the mockups are the same content in a measurable form.

#### ⚠️ The finding that shapes the build: the canon is third person, the page is second person

No p6/p7 mockup zone is byte-identical to any library string — **0 of 37** on exact
normalized comparison. But that is not because the content is unrelated. It is because the
voice differs:

| | |
|---|---|
| **Library** `type_9.description.core_motivation` (145ch) | "To maintain inner and outer peace, stay connected to others, and avoid the conflict and discomfort that come with asserting **their** own priorities." |
| **Mockup** `.cm-narrative` (144ch) | "To maintain inner and outer peace, stay connected to others, and avoid the conflict and discomfort that come with asserting **your** own priorities." |

**One word.** The docx canon is written in third person ("Nines…", "their", "them"); the v3
client report is written in second person ("you", "your").

**aggregate** — across all nine types, **28 of the 99** canon leaves that feed p6/p7 contain
third-person pronouns and need conversion; the remainder (strengths/challenges bodies,
practices) are already person-neutral.

This is the difference between transcription and editing, and it did not arise for Wings or
Lines because those constants were authored directly in second person. **Budget p6/p7 canon
reuse as adaptation, not transcription** — even where the substance is 9/9 ready.

#### Per-zone readiness table

| Page | Zone | n | Type 9 | Canon substrate (all 9 types) | Verdict |
|---|---|---|---|---|---|
| p6 | `.cm-narrative` core motivation | 1 | ✅ mockup | `description.core_motivation` — Word-canonical | **EXISTS** · one-word person edit |
| p6 | `.cm-col-txt` worldview | 1 | ✅ mockup | `description.worldview` — Word-canonical | **EXISTS** · reframed, needs editorial |
| p6 | `.cm-col-txt` **core belief** | 1 | ✅ mockup | **none** — no docx section | **NEEDS AUTHORING** ×8 |
| p6 | `.glance-value` at-a-glance | 4 | ✅ mockup | **none** — no docx section | **NEEDS AUTHORING** ×8 |
| p6 | `.pat-body` thinking/feeling/behaving | 3 | ✅ mockup | `patterns.*.intro` — Word-canonical | **EXISTS** · person conversion |
| p6 | `.intro-desc` | 1 | ✅ mockup | templated | **NOT AUTHORED** — tokens |
| p6 | `.cm-words-quote` | 1 | ✅ mockup | per-**client** AI output | **PIPELINE** — never authored |
| p7 | `.item-text` at your best / growing edge | 6 | ✅ mockup | `strengths` ×3 + `challenges` ×3 — Word-canonical, 9/9 | **EXISTS** · compressed to ~77–95ch |
| p7 | `.style-name` communication | 1 | ✅ mockup (22ch) | `communication.subhead` (33ch after prefix) | **EXISTS** · must be re-cut to fit 192px |
| p7 | `.style-name` conflict | 1 | ✅ mockup (21ch) | `conflict.subhead` (36ch after prefix) | **EXISTS** · must be re-cut to fit 192px |
| p7 | `.style-name` **decision-making** | 1 | ✅ mockup (19ch) | **none** | **NEEDS AUTHORING** ×8 |
| p7 | `.s-text` chicklet bullets | 9 | ✅ mockup | `communication.bullets`, `conflict.bullets` partial; decision-making none | **UNCLEAR** — 6 of 9 have partial substrate, 3 have none |
| p7 | `.pr-text` catching patterns | 6 | ✅ mockup | **none** — no docx section | **NEEDS AUTHORING** ×8 |
| p7 | `.lead` | 1 | ✅ mockup | **none** | **NEEDS AUTHORING** ×8 (or static) |

**Type 9 is complete for both pages** — all 34 authored zones exist as approved-looking prose
in the mockups. The pilot has a full reference.

**For types 1–8:** 12 of 34 zones have a Word-canonical substrate needing adaptation; **19
need authoring from scratch**; 1 is client-pipeline; 2 are template/static.

### C4 — The three chicklet style names

> **Premise correction.** The brief says these "need fresh authoring regardless." For **Type 9
> they already exist** in the p7 mockup: **"Inclusive and Indirect" (22)**, **"Go Along to Get
> Along" (21)**, **"Every Option Counts" (19)**. All three render **one line** at 192px.
> **measured**, local.

For types 1–8 they do need authoring — two with a canon substrate that is too long to reuse
directly, one with none at all:

| Chicklet | Canon | Length after stripping the "… Style — " prefix | Fits 192px? |
|---|---|---|---|
| Communication | `communication.subhead` | "Easygoing, Inclusive, and Diffuse" — 33ch | ✗ re-cut needed |
| Conflict | `conflict.subhead` | "Around the Edges — Keeping the Peace" — 36ch | ✗ re-cut needed |
| Decision-Making | — | none | ✗ author from scratch |

**The guardrail, against the measured width.** `.style-name` is **192px at 13.5/700**
(**measured**, this audit — confirming 12 Aug). The 12 Aug sweep puts the 1-line ceiling at
**28–31 chars** at that width. **The "under 24 characters" figure in circulation is
conservative by 4–7 characters** and is not the measured constraint. Type 9's three names sit
at 19–22, comfortably inside either figure.

---

## D. Risk surface

### D1 — Diagram labels: not a p6/p7 risk

**p7 renders no diagram at all** (**measured** — `grep -c "<svg"` returns 0).

**p6 renders one**, and it carries **no archetype names**: a 200×200 wheel, 10 circles, and
nine `<text>` numerals of one character each. The home type is highlighted — node 9 at `r=16`
against the others' `r=12.5`, fill `#D9E4E9`, stroke `#00B2D9`, numeral 15px bold against 12px
regular.

> **Premise correction.** The brief notes Type 4's "The Individualist" (17 chars) as the
> tightest case in the PR and flags it as relevant because Type 4 is in the second pilot batch.
> **It is not relevant to p6 or p7.** That constraint belongs to `.pt-name` at 124px on **p9
> Lines**, which is merged. Neither of these pages puts an archetype name in a diagram.
>
> p6 does print the name in its `<h1>` — "Type 9 · The Peacemaker", 23 chars, one line at
> 514px, rendering 285px wide. "Type 4 · The Individualist" is 26 chars ≈ 322px (**derived** —
> linear scaling from the measured 23-char/285px h1, assuming comparable glyph widths). Roughly
> 60% of the available width. No risk.

**But p6 does need SVG work, contradicting §1.1.** The 12 Aug audit states *"PR 3 needs no new
SVG variants."* That was scoped to p8/p9, and it does not hold here:

| | vw × vh | r | rNode | Home highlight? |
|---|---|---|---|---|
| `COVER_GEO` | 420 × 420 | 158 | 23 | yes |
| `WHATIS_GEO` | 300 × 300 | 112 | 16 | **no** |
| **p6 mockup** | **200 × 200** | **80** | **12.5** | **yes** |

p6's geometry matches neither, and the one variant at a comparable scale (`client-whatis`)
has no home-type highlight — `isHome` is gated to `client-cover` (`app/renderer.js:1232`).
p6 needs either a new variant or a `client-whatis` parameterization. Small, but it is not zero,
and it lands in a shared primitive (see D2).

### D2 — Shared-primitive touch and blast radius

Porting p6/p7 touches more shared surface than Wings or Lines did, because those were
content-only changes into an existing page function and these are new pages.

| Surface | Touched? | Blast radius |
|---|---|---|
| `buildEnneagramSVG` | **yes**, if p6 gets a variant | **Reaches the coach report.** Must be strictly additive — a new `variant ===` branch, no edits to existing branches or to `COVER_GEO`/`WHATIS_GEO`. The coach regression gate is the check. |
| Shared v3 stylesheet | **yes** | The mockups carry their own inline CSS with **zero `<link>`s**, so every p6/p7 rule must be newly written into `clientReportV3PageStyles()`. Additive class names only; note that the mockups already reuse generic names (`.lead`, `.eyebrow`, `.col-head`) that exist elsewhere in v3 — **namespace them**, exactly as `cdf96ee` did for p9 (`.v3-pt`, `.v3-band`) after the mockup's bare `.band` collided with the cover's. |
| `partAStyles` | no | — |
| Content resolver | **yes**, if content lands as `type_N.*` | A published CMS override on any top-level key these pages read would drop the new fields whole. The table is currently empty (confirmed 13 Aug), and PR #79's `OverrideShapeError` now makes drift loud rather than silent. |
| `report_prep` | yes, additive | Two new model blocks, same shape as `v3_wings` / `v3_lines`. Coach model untouched. |
| Page count | **yes** | 7 → 9. Two assertions must move together: `scripts/render_client.js` `expected` and `tests/lib/report_page_inventory.js`. That pair going out of sync is what made `npm test` red for a day during the Lines work. |

### D3 — What else makes this longer than "content exists, fits, renders"

1. **The person conversion (C3).** The single largest hidden cost. 28 of 99 canon leaves need
   third-to-second-person rewriting, and rewriting is Mo's review surface, not a mechanical pass.
2. **19 of 34 zones have no canon substrate at all** — At-a-Glance ×4, Core Belief, catching
   patterns ×6, decision-making chicklet + its 3 bullets, the p7 lead. For eight types that is
   **152 zones authored from nothing**, which is more than Wings' 112.
3. **p6 has 11.31px of headroom and its `.pat-body` zones already run 5–6 lines.** There is no
   room to absorb a longer type. Expect re-cutting to be routine on p6, not exceptional.
4. **`.cm-words-quote` is a per-client pipeline dependency**, not content. It needs a source in
   the client model that does not exist yet, and it cannot be authored or faked per type.
5. **Two page-count assertions**, per D2.
6. **`.glance-label` at 92px** is the second-tightest zone in the PR after p9's `.pt-name`
   (124px) — "Where Nines Turn Their Attention" is 32 chars and already renders 3 lines. Type
   names with longer plurals ("Individualists", 14 chars vs "Nines", 5) will push it.

**The honest summary:** this is not "content exists or gets drafted, fits, renders." It is the
largest authoring lift in PR 3, on the tightest page in the document, with a voice conversion
on top of the reusable canon. The one thing that is much better than expected is that Type 9 is
completely done for both pages.

---

## Recommended build sequence

**Type 9 alone first, then the 1/4/8 batch** — as instructed, and the mockups make the pilot
genuinely cheap.

### Phase 0 — resolve before authoring
1. **Decide the p6/p7 boundary.** Not this audit's call. The inventory says p6 carries 10
   authored zones against 11.31px of headroom and p7 carries 24 against 14.25px. If anything
   moves, it should move **p7 → p6** only if p6 sheds a zone first; p6 cannot absorb one line.
2. **Confirm the `.cm-words-quote` source.** Per-client, no content-library path. If it is not
   ready, decide now whether p6 ships with the block omitted or with a fallback.
3. **Withdraw the r3 ≤48-char bullet recommendation** (A4). It rests on a width that measured
   wrong.

### Phase 1 — Type 9 pilot, no new content
4. Port both mockups to `_clv3TypeA` / `_clv3TypeB`, namespacing every class. Land the CSS,
   the two `report_prep` model blocks, and the p6 SVG variant.
5. Move **both** page-count assertions 7 → 9 in the same commit.
6. Transcribe Type 9's 34 zones from the mockups verbatim. **No authoring** — this phase proves
   the port preserves geometry, exactly as p8 did at 938.75px.
7. Re-measure headroom on the *rendered* pages and compare against 11.31 / 14.25. **This is the
   number that matters**; everything in section B is pre-port.
8. Derive the real character bands from Type 9's rendered prose, per zone, and publish them
   before anyone writes for types 1–8.

### Phase 2 — content, types 1, 4, 8
9. Adapt the 12 canon-backed zones (person conversion first, then fit).
10. Author the 19 zones with no substrate, against Phase 1's measured bands.
11. Render all four types; re-cut what misses; Mo reviews the adaptations and the new copy
    separately, since they carry different risk.

### Phase 3 — remaining five types, then gates
12. Types 2, 3, 5, 6, 7. Full nine-type sweep, single-sheet gate, coach regression **in CI on
    Linux** — a local macOS run proves the HTML half only.

---

## Status

**Audit complete. No blockers to starting Phase 1; three decisions needed before Phase 2.**

- **Needs decision — Cai and Mo:** the p6/p7 boundary. Inventory is above; the decision is not
  mine.
- **Needs decision — Cai:** the `.cm-words-quote` per-client source.
- **Needs decision — Cai:** withdraw the r3 ≤48 bullet re-cut (recommended — measured
  unnecessary).
- **Ready now:** Type 9 is complete for both pages in the mockups, every column width is
  measured and confirmed against the 12 Aug audit, and the pilot can start without any new
  content at all.

The two corrections that matter most for planning: **the p6/p7 references were never missing**,
and **the reusable canon is in the wrong person**, which converts a large part of the "already
exists" column from transcription into editing.
