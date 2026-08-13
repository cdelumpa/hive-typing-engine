# Audit — PR 3: Per-type pages (Exploring A, Exploring B, Wings, Stress & Security)

**Prepared by:** Claude Code (lead engineer / QA)
**Audit delivered:** 12 August 2026 · **Status:** delivered for ratification; no build authorized
**Scope:** spec v3.0 sheets 6, 7, 8 and 9 across all nine types, plus the derived-leaf
enumeration that gates PR 3's scope, and the CMS override layer surfaced during the audit.
**Not in scope:** sheets 1–5, 10, 11, 12. The 27-subtype work (PR 4). CAR (PR 6).

Every number below is tagged **measured** (with the command *and where it was run*),
**derived** (with the assumption) or **aggregate** (with the set). The "where" clause is
mandatory as of this audit: the coach gate passed locally for a day while failing in CI
because nobody asked where the green came from.

**Measurement environment for every render in this document:** run from the repo root at
`475942f` on macOS (darwin 25.5.0), pinned bundled Chromium `Chrome/147.0.7727.57` via
`app/browser_launch.js`, font probe **2378.81px** (genuine Arial) asserted before each
measurement. Instruments live in the session scratchpad, not the repo:
`derived_leaves.js`, `measure_pr3.js`, `bands2.js`, `nine_types_v3.js`, `override_probe.js`,
`june_probe.js`.

---

## 0. The derived-leaf enumeration — precondition, run first

### 0.1 The census

**Measured** — `node scripts/verify_content_library.js` plus a flatten/classify pass over
`app/content/content_library.json`:

| Class | Count | Detail |
|---|---|---|
| **Total leaves** (excl. `_meta`) | **1400** | matches `verify_content_library.js`'s own count exactly |
| Word-canonical | 1352 | asserted by the CI invariant |
| `INTERIM_*` constants | 48 | welcome 8 · wings_using 1 · type_9 v3 wings 15 · contents 18 · thoughts 6 |
| **A — build-time DERIVED** | **27** | `type_N.inquiry_lines[0..2]` × 9, from `patterns.{thinking,feeling,behaving}.inquiry` (`build_content_library.js:256`) |
| **B — constant-injected** | 9 | `type_N.name` ← the `TYPE_NAMES` table (`:181`, assigned at `:240`) |
| **C — intra-type byte duplicates** | **0** | no string ≥25ch appears twice within one type outside class A |
| **D — cross-type identical strings** | 8 redundant | `type_N.practices.intro` is byte-identical across all nine types |
| Structural (numbers, codes, `target_type`, `center`, `contents.start`) | 93 | parsed or enumerated, never authored |

**Corrected count: 1400 leaves → 1262 independently authorable prose leaves** after removing
93 structural, 27 derived, 9 constant names and 9 `contents.start`.

### 0.2 Divergence check — clean

**Measured**: all nine `inquiry_lines` arrays are byte-identical to their source
`patterns.*.inquiry` triples. **No silent drift of the 130-field class.**

### 0.3 Is any derived leaf read by a renderer?

`inquiry_lines` is not. The v2 patterns page reads `blk.inquiry` directly
(`renderer.js:2104`). It survives in three other places: `report_prep.js:298` (model),
`CLIENT_SPEC.nonEmptyArrays` (`:407`), and the CMS override editor (`server.js:10695`),
which ships it as an editable field carrying the note *"This field is not currently rendered
in the client report preview."*

**One live risk the build-time check cannot see.** A published CMS override on
`type_N.inquiry_lines` would desync it from `patterns.*.inquiry` at render time with nothing
to catch it. Build-time divergence: zero. Runtime divergence: possible and unguarded. Low
impact today only because nothing renders it. See §9 — this is the same class of hole.

### 0.4 A dead assertion, found in passing

`build_content_library.js:416` is `need(t.name === TYPE_NAMES[n], …)`, but `:240` is
`const name = TYPE_NAMES[n]`. The assertion compares a value to the table it was just copied
from — **it can never fail.** Harmless today, but it is one of nine "coverage" checks that
reads as protection and provides none.

Nothing was deleted. `pillars != 3` and every other hard field-count assertion are untouched.

### 0.5 ⚠️ Where "~296 content units" comes from, and why it is wrong for this PR

`insightout_client_report_v3_content_zone_inventory_v1_080426.csv` (Dropbox, 4 Aug 2026) is
**295 rows / 296 lines**. *(Provenance: inferred from the exact numeric match plus
subject-matter fit — the figure is not stated as such anywhere.)*

That CSV is:

- the **whole 13-page report**, cover + TOC + pages 1–13 — not PR 3's four sheets;
- **one type's worth** of zones, not nine;
- **all scopes mixed** — 129 per-type, 115 static, 31 per-subtype, 15 dynamic-token,
  3 per-pair, 2 ai-generated;
- keyed to a **13-page structure `V3_PAGE_ORDER` does not have** (see §5).

The corrected figure is in §4.4. It is roughly **1.8×** the number the schedule is built on.

---

## 1. Current state

`buildClientReportHTML_v3` (`renderer.js:3240`) assembles six pages today: `_clv3Cover`,
`_clv3Contents`, `_clv3Welcome`, `_clv3WhatIs`, `_clv3Wings`, `_clv3Thoughts`.
`V3_PAGE_ORDER` (`:2899`) already carries all twelve rows including `typeA`, `typeB` and
`lines` — the table is complete; the page functions are not.

| Sheet | Page fn | CSS | SVG variant | Content today |
|---|---|---|---|---|
| **6 Exploring A** | ✗ new | ✗ new | ✓ none needed | `core_motivation`, `worldview`, 3 × `patterns.*.intro` in library 9/9; core belief + at-a-glance nowhere |
| **7 Exploring B** | ✗ new | ✗ new | none | strengths/challenges 9/9; chicklets + catching-patterns nowhere |
| **8 Wings** | ✓ exists | ✓ exists | ✓ `client-wings` | Type 9 only (`INTERIM_WINGS_V3`) |
| **9 Lines** | ✗ new | ✗ new | ✓ **`client-lines` already shipped** | `lines.*.narrative` + `resource_card` 9/9; bullets + resources-to-work nowhere |

### 1.1 Correction: PR 3 needs no new SVG work

`client-lines` was built alongside `client-wings` in PR 1 (`renderer.js:1351`). It is fully
generalized — home/stress/security from `TYPE_META`, arrow directions per spec §3.6, and the
two-line side-placement rule for the types whose label sits at the top (1, 3, 6, 8).

**Measured** — `node scripts/verify_diagrams.js`:
`18 diagrams measured · minimum edge clearance 5.47px (WINGS T9 "YOUR HOME BASE")`.

All nine types × both variants already pass. PR 3's diagram work is *wiring*, not geometry.
Note the clearance margin is **0.47px** against the 5px floor; PR 3 adds no new diagram
labels, so it does not consume that margin, but nothing else may either.

### 1.2 ⚠️ p8 generalizes structurally, and fails blank and silent for eight types

**Measured** (`nine_types_v3.js` — the `anders_sx9` fixture with `confirmed_type` swapped
1–9, full v3 document rendered each time):

```
type | Wings content stack | headroom | wing_a bullets | overview | empty text zones
 1-8 |            560.00px | 416.00px |      0         |    0ch   |        4
   9 |            938.75px |  37.25px |      5         |  207ch   |        0
```

Nothing in `_clv3Wings` or `report_prep`'s `mk(slot)` is Type-9-specific, and the column-order
decision is already documented at `report_prep.js:305`. **But for types 1–8 the page renders
two empty overviews, two empty resource bands, no bullets and no intro — silently.**
`validateType` gated the v3 wing fields behind `if (INTERIM_WINGS_V3[n])`
(`build_content_library.js:430`), `mk()` defaults to `''`/`[]` (`:324`), and every gate was
green on that output: content-library build passed, `verify:render` passed (416px of headroom
is *more* comfortable than Type 9's 37px), `verify_diagrams` passed, coach untouched.

**This is the defect class the content-readiness rule exists to prevent, and it was live in
the code.** Fixed during the audit — see §10.

---

## 2. The content pipeline at volume

**Position: keep `INTERIM_*` for PR 3. Do not attempt a docx round-trip for these four
pages.**

### 2.1 The round trip is cheap; that is not the constraint

**Measured**, back to back from the repo root:

```
node scripts/build_content_library.js    0.108s total
node scripts/verify_content_library.js   0.218s total
```

`git status app/content/` clean afterward — idempotent. A batch costs a third of a second.

### 2.2 The constraint is that the docx has no sections for these zones

**Measured** — the build script's own tokenizer over
`docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx`:

- **p9**: `MOVING TOWARD TYPE N` blocks and `Resource card:` lines **confirmed present, 9/9**
  — parsed at `:273–282`, hard-required at `:442`. But they supply only 4 of p9's 13 authored
  zones. The six line bullets and three resources-to-work texts have no section.
- **p6**: `HOW YOU SEE THE WORLD`, `CORE MOTIVATION`, `PATTERN OF *` present 9/9. Core belief
  and the four at-a-glance values: **no section.**
- **p7**: `STRENGTHS`, `CHALLENGES`, `HOW YOU NATURALLY COMMUNICATE`,
  `HOW CONFLICT SHOWS UP FOR YOU`, `PRACTICES THAT HELP` present 9/9, but shaped for the v2
  layout. No decision-making section at all.
- **p8**: **no section** — `verify_content_library.js` says so itself: *"retires when Wings
  content lands in Word for all nine types (drafted, in review with Mo)."*

A docx round-trip for PR 3 therefore means authoring **new Word section schemas for ~46 zones
per type**, teaching the tokenizer each one, while the copy is still churning. `INTERIM_*`
costs one JS object per batch, and the invariant script already reports the exact debt — 48
leaves, itemized, with a retirement condition per group. **That reporting is what makes
`INTERIM_*` safe at volume, and it already exists.**

**One change recommended:** make the `INTERIM_*` retirement ledger fail-loud above a
threshold, so "48 leaves outstanding" cannot quietly become "500 leaves outstanding."

---

## 3. The zone inventory — measured, per page, per column width

Instruments: `measure_pr3.js` + `bands2.js`. Each mockup rendered at 816×1056, `print` media,
Arial asserted. Widths are **content-box widths** (`clientWidth` minus horizontal padding),
not CSS declarations.

**Why the mockups are a legitimate geometry source for p6/p7/p9:** all four share the v3 page
shell exactly — `width:816px; min-height:1056px; padding:40px 53px`. And the check that proves
transfer: **the p8 Wings mockup and the shipped `_clv3Wings` measure the same content stack to
the hundredth of a pixel — 938.75px both.** The port preserved geometry exactly on the one
page where a comparison exists.

### 3.1 ⚠️ The stated bands do not transfer, and character count is the wrong instrument

The **52 / 53–72 / 73–88** bands and the **205-char overview ceiling** appear in **no tracked
document** — checked across `docs/*.md`, both briefs on disk, and the design spec. They exist
only in working memory. That alone needs fixing before ~500 units are authored against them.

More substantively, this repo already established the principle.
`docs/audit_pr2_static_pages.md:373`: *"The constraint is a width, not a character count…
where the spaces fall changes the wrap point, so no single character count is correct."*

**Measured** — max characters still fitting in N lines, swept per zone across three word
shapes (long tokens / even words / short words):

#### p6 Exploring A — content stack 964.69px

| Zone | n | Width | Type | 1 line | 2 | 3 | 4 |
|---|---|---|---|---|---|---|---|
| `.cm-narrative` core motivation | 1 | 423px | 13.5/400 | 67–77 | 129–153 | 191–229 | 251–305 |
| `.cm-col-txt` worldview, core belief | 2 | 314px | 13/400 | 51–59 | 97–116 | 143–173 | 189–230 |
| `.glance-label` | 4 | 92px | 9/700 | **13–19** | 23–38 | 36–57 | 46–76 |
| `.glance-value` | 4 | 222px | 12.5/400 | 37–42 | 71–80 | 106–120 | 140–160 |
| `.pat-body` pattern intro | 3 | 196px | 12.5/400 | 33–38 | 66–76 | 96–114 | 125–152 |
| `.intro-desc` | 1 | 514px | 14/400 | 79–90 | 158–166 | 234–242 | 309–322 |
| `.cm-words-quote` (AI) | 1 | 668px | 12.5/400 | 116–133 | 231–266 | 346–399 | — |

#### p7 Exploring B — content stack 961.75px

| Zone | n | Width | Type | 1 line | 2 | 3 |
|---|---|---|---|---|---|---|
| `.item-text` strengths/challenges | 6 | 293px | 13/400 | 48–55 | 93–100 | 131–149 |
| `.style-name` chicklet name | 3 | 192px | 13.5/700 | **28–31** | 50–60 | 69–88 |
| `.s-text` chicklet bullet | 9 | 179px | 12.5/400 | 30–34 | 51–61 | 72–90 |
| `.pr-text` catching-patterns | 6 | 229px | 12.5/400 | **39–43** | 78–81 | 118–121 |
| `.col-head` / `.pr-head` | 2 / 2 | 312px | 10/700 | 42–48 | 80–96 | 118–144 |

#### p8 Wings — content stack 938.75px

| Zone | n | Width | Type | 1 line | 2 | 3 | 4 |
|---|---|---|---|---|---|---|---|
| `.v3-wing-txt` bullet | 10 | 293px | 12.5/400 | **50–57** | **96–114** | 142–171 | 188–228 |
| `.v3-wing-over` overview | 2 | 308px | 12.5/400 | 52–60 | 98–117 | 144–174 | **190–231** |
| `.v3-res-txt` resource band | 2 | 308px | 12.5/400 | 52–60 | 98–117 | 144–174 | 190–231 |
| `.v3-wing-name` | 2 | 308px | 15/700 | 40–45 | 80–83 | 119–121 | 155–197 |

#### p9 Lines — content stack 941.50px

| Zone | n | Width | Type | 1 line | 2 | 3 |
|---|---|---|---|---|---|---|
| `.pt-txt` line bullet | 6 | 293px | 12.5/400 | 50–57 | 96–114 | 142–171 |
| `.pt-over` line narrative | 2 | 308px | 12.5/400 | 52–60 | 98–117 | 144–174 |
| `.band-txt` high-side band | 2 | 308px | 12.5/400 | 52–60 | 98–117 | 144–174 |
| `.work-txt` resources-to-work | 3 | 225px | 12.5/400 | 39–43 | 78–81 | 117–120 |
| `.pt-name` archetype name | 2 | **124px** | 15/700 | **16–19** | 32–38 | 49–57 |

### 3.2 Against the numbers in circulation

- **52** for the 1-line wing bullet sits inside the measured band 50–57, but on the optimistic
  edge: a 52-char word-dense bullet wraps to two lines. **The safe 1-line ceiling is 50.**
- **88** is not the 2-line ceiling. Measured, that is **96–114**. The figure is 8–26 chars
  conservative — safe, but it will make authors over-tighten.
- **205 for the overview is not safe.** Measured 4-line ceiling is **190 (dense) – 231
  (loose)**. The shipped Type-9 overviews are 207ch and 191ch and both render 4 lines, so 205
  holds *for copy shaped like Mo's*. A word-dense 205-char overview goes to 5 lines. At 37.25px
  headroom on p8, one extra 19.38px line leaves 17.87px; two spills the sheet.
- **`.pt-name` at 124px is the tightest zone in PR 3 and had not been flagged.** 1-line ceiling
  16–19 chars; `"The Individualist"` is 17. It fits with essentially no margin, and it is a
  derived string, so no author will ever review it.

### 3.3 ⚠️ Linux re-measurement was not possible, and it is not cheap

`docker`, `podman`, `colima`: **none installed** (`which` returns nothing; `docker info`
fails). No Liberation Sans on this machine (`ls ~/Library/Fonts`, `fc-list` — no matches).
`.github/workflows/report-verify.yml` triggers only on `pull_request` and `push` — there is no
`workflow_dispatch`, so `gh workflow run` cannot reach it and a Linux number requires pushing
a branch.

**The existing cross-platform evidence is also weaker than stated.** `render_client.js`
measures `.v3-page` via `getBoundingClientRect().height`, and `.v3-page` is
`min-height:1056px`. **Every page reports exactly 1056px on every platform** — confirmed
locally across all six v3 pages and all ten v2 pages. CI green therefore proves only
*"content stack ≤ 976px."* It says nothing about whether the stack is 938.75px on Linux or
951px. The bands have never been corroborated cross-platform by anything but the font probe.

**Recommended instead of guessing:** add content-stack measurement to `render_client.js` —
release `min-height` to `0`, read the natural height, restore. ~6 lines. It makes headroom a
first-class CI output and **the first CI run of PR 3 yields the Linux bands for free**, with
no Docker and no manual step. Worth landing as PR 3's first commit, before any content.

---

## 4. Headroom and spill risk

**Definition**, stated because existing figures use a different one:
`headroom = 1056 − (natural page height with min-height released)`. That is directly "how much
can content grow before the single-sheet gate fires" and needs no convention.

**Measured**, print media, Arial asserted:

| Sheet | Page | Content stack | **Headroom** | Source |
|---|---|---|---|---|
| **6** | **Exploring A** | 964.69px | **11.31px** | mockup |
| **7** | **Exploring B** | 961.75px | **14.25px** | mockup |
| 4 | What Is | 963.42px | 12.58px | shipped v3 |
| 8 | Wings | 938.75px | 37.25px | shipped v3 (= mockup exactly) |
| 9 | Lines | 941.50px | 34.50px | mockup |
| 12 | Your Thoughts | 920.61px | 55.39px | shipped v3 |
| 3 | Welcome | 865.25px | 110.75px | shipped v3 |
| 2 | Contents | 882.13px | 93.88px | shipped v3 |

**Reconciling with `docs/audit_pr2_static_pages.md` §9:** these figures are consistently
**19.99–20.00px** tighter, because that audit's "content stack" excluded the `.page-footer`
box (`padding-top:10px` + 1px border + 8px text ≈ 20.2px) and this one includes it. Welcome
differs by a further 48.75px because commit `4c3bd15` moved its body to 15px after that audit
was written. Under either convention the ordering is identical and the delta is constant.

### 4.1 p6 is the tightest page in the document

**Exploring A at 11.31px** — tighter than What Is at 12.58px. p7 is second at 14.25px.
Together they are the two tightest sheets of the twelve, and they are the two whose content is
least written.

At 11.31px, p6 cannot absorb **one additional rendered line anywhere on the page** — its
smallest text line is `.glance-label` at 12.6px. Every one of p6's ten authored zones is a hard
one-line-or-spill constraint for eight types that do not exist yet.

### 4.2 Correction: p7 is not "~200 zones"

`client_report_v3_build_plan.md:335` reads *"PR 3 | Core Belief, At-a-Glance×4, all three
chicklets (D5), catching-patterns, line bullets/resources — 8 types | ~200"*, under a column
headed *"~Units (8 types / 24 subtypes)"*. **~200 is the whole-PR unit estimate for eight
types, not p7's zone count.**

**Measured**: p7 has **34 DOM content zones, of which 24 are per-type authored** — the largest
of the four, but by 10 zones over p6, not by an order of magnitude.

### 4.3 Zone classification

**Measured** — zone-by-zone over all four mockups, cross-checked against `validateType` and
the compiled library:

| Page | DOM zones | Chrome / token-derived | **Authored per type** | Exists 9/9 | **NEW** |
|---|---|---|---|---|---|
| p6 Exploring A | 24 | 14 | **10** | 6 | 4 |
| p7 Exploring B | 34 | 10 | **24** | 6 | 18 |
| p8 Wings | 22 | 7 | **15** | 0 | 15 |
| p9 Lines | 26 | 13 | **13** | 4 | 9 |
| **Total** | **106** | **44** | **62** | **16** | **46** |

### 4.4 Corrected PR 3 scope

- **Total leaves to land across nine types: 62 × 9 = 558.**
- **NEW copy for the eight unauthored types: 46 × 8 = 368.**
- **Type 9 transcription still outstanding: 31** (46 − 15 already in `INTERIM_WINGS_V3`).
- **Reformat/EDIT of existing Mo-edited canon: 16 × 9 = 144** — real review load, not free.
- **Human-touched units before PR 3 can close: 543.**

Against ~296 that is **1.8×**. The build plan's ~200 is 1.84× low against the 368 NEW figure —
the same factor, which suggests both came from the same undercount.

---

## 5. What differs across types — the §12.5 premise is wrong

Brief v2.0 (`hive_insightout_client_report_cd_brief_v2_0_080426.docx`, extracted, 797
paragraphs) §12.5 reads:

> Page 10: "HOW PEACE WORKS" · Page 6: "FOCUS & PRIORITIES" / "PRESENCE & VOICE" and
> "COMMITMENTS & DECISIONS" / "EXPECTATIONS & ENVIRONMENT" · Page 8: "SIGNALS YOU'VE MERGED" /
> "THE RETURN PATH" / "WHAT PRESENCE LOOKS LIKE"

**Measured**: none of those strings appears in any tracked mockup or in
`insightout_client_report_full_draft_080726.pdf` — grepped across all twelve
`docs/mockup/*.html` and all 12 extracted PDF pages. Zero hits.

### 5.1 They belong to a different, 13-page structure

Brief §12.1 gives it away: *"With subtype: TOC, pages 1, 2, 13. Without: pages 3 through 12."*
Thirteen pages plus a TOC. Confirmed from two Dropbox artifacts dated 5 Aug 2026:

- `Type1_Improver_Authoring_Draft_080526.docx` — 107 zone IDs across `p3, p5, p6, p7, p8, p10,
  p11, p12`
- `InsightOut_Client_Report_Type1_SX1_DRAFT_080526.docx` — 114 Word bookmarks, same IDs,
  rendered into layout

In that structure:

- **p6** is *"The [Nickname] at Work (continued)"* — `p6.category1_label`…`p6.category4_label`,
  four per-type labels with three bullets each. Type 1's read **STANDARDS & SELF-CRITICISM /
  EASE & PERMISSION / FEEDBACK & STANDARDS / PACE & PRESSURE**. §12.5's page-6 labels are the
  Type-9 equivalents. ✅
- **p8** is *"The [Nickname] in Relationships (continued)"* — the `COMING BACK TO YOURSELF`
  band: `p8.signals_label` / `p8.return_path_label` / `p8.presence_label`. Type 1's read
  **SIGNS YOU'RE GRIPPING / THE RETURN PATH / WHAT PRESENCE LOOKS LIKE**. ✅ verbatim.
- **p11** is Wings. **p12** is Stress & Security.

**`V3_PAGE_ORDER` sheet 6 is not brief page 6, and sheet 8 is not brief page 8.** The v3
twelve-sheet report **cut the "at Work" and "in Relationships" page pairs entirely** and
compressed what survived into Exploring A/B. Both label groups §12.5 names live on pages that
no longer exist. Mapping them onto sheets 6 and 8 is a numbering collision.

### 5.2 The actual per-type variable labels on PR 3's four sheets

**Measured** from the four mockups' DOM:

| Sheet | Label zone | n | Verdict |
|---|---|---|---|
| p6 | `.glance-label` — "What Nines Want" / "Where Nines Turn Their Attention" / "What Nines Tend to Avoid" / "Driving Emotion" | 4 | **3 token-derivable** from `display.nickname_plural`; "Driving Emotion" fixed |
| p6 | `.glance-head`, `h1`, `h2` | 3 | token-derivable from `nickname` / `type_word` |
| p6 | `.cm-col-lbl`, `.pat-lbl` | 5 | fixed chrome |
| **p7** | **`.style-name`** — "Inclusive and Indirect" / "Go Along to Get Along" / "Every Option Counts" | **3** | **genuinely per-type authored** |
| p7 | `.style-lbl`, `.col-head`, `.pr-head`, `h2` | 9 | fixed chrome |
| p8 | `.v3-wing-lbl`, `.v3-wing-name`, `.v3-res-lbl` | 6 | derived from `TYPE_META` + `TYPE_NAMES` |
| p9 | `.pt-lbl`, `.pt-name`, `.band-lbl` | 6 | derived |
| p9 | `.work-lbl` — "Catch the shift" / "Notice the impact" / "Then choose" | 3 | reads generic — **needs a call** |

**27 strings, not "36 renders' worth of uncounted labels."** The only genuinely per-type
labels are p7's three chicklet style names × 9 types — already inside D5's scope and already
counted in the 46/type figure. Everything else is token-derivable chrome (`_v3Tokens` already
handles `{nickname}`, `{nickname_plural}`, `{type_word}`, `{subtype_label}`) or belongs to cut
pages.

**Open item:** p9's three `.work-lbl` strings. Type 9's read generic; the bodies beneath them
are unambiguously per-type ("the easy calm turns to worry"). **Recommendation: keep the three
labels static and author only the bodies** — what the mockup implies, and it saves 27 strings.

### 5.3 Mo-edited canon usable as ADAPTED source

`app/type_library.json` v1.1 (`generated_at 2026-04-25`, source *"hive_type_library_mo_edits_
04252026.docx — track changes accepted"*) carries, for **all nine types**:
`how_you_see_the_world`, `core_motivation[]`, `strengths[3]`, `challenges[3]`,
`development_tips[]`, `patterns_of_{thinking,feeling,behaving}`, `instincts`, `wing_low`,
`wing_high`. Plus the compiled library's
`type_N.comparison.{core_motivation,focus,energy,gifts,challenges}`, 9/9, docx-canonical.

**Correction to the build plan:** it classes At-a-Glance ×4 as flatly NEW. **Measured** against
`type_9.comparison`, three of four are adaptations:

- "What Nines Want" ← `comparison.core_motivation`
- "Where Nines Turn Their Attention" ← `comparison.focus` (near-verbatim)
- "What Nines Tend to Avoid" ← partially `comparison.challenges`
- "Driving Emotion" — genuinely NEW; no library field holds the passion

**No canon anywhere:** core belief, all three chicklet style names, the nine chicklet bullets
as one-liners, the six catching-patterns bullets, the six line bullets, the three
resources-to-work bodies, "Driving Emotion", and the fifteen Wings zones for types 1–8.

---

## 6. Sourcing base per type — premise out of date

**Types 7, 8 and 9 do have coaching tips.** **Measured** — `find` over
`~/Library/CloudStorage/Dropbox/Hive, Inc/Enneagram/InsightOut/Enneagram Collective/Tuesday
Tools Day/`, then word-counted through the build script's tokenizer:

| Type | File | Date | Paras / words |
|---|---|---|---|
| 1 | `hive_type1_coaching_tips_06182026` | 18 Jun | 36 / 617 |
| 2 | `hive_type2_coaching_tips_060926` | 9 Jun | 40 / 851 |
| 3 | `hive_type3_coaching_tips_062226` | 22 Jun | 36 / 609 |
| 4 | `hive_type4_coaching_tips_063026_v2` | 30 Jun | 36 / 585 |
| 5 | `hive_type5_coaching_tips_070726` | 7 Jul | 36 / 590 |
| 6 | `hive_type6_coaching_tips_072026` | 20 Jul | 36 / 561 |
| **7** | `hive_type7_coaching_tips_072826` | **28 Jul** | 37 / 621 |
| **8** | `hive_type8_coaching_tips_0804026` | **4 Aug** | 36 / 612 |
| **9** | `hive_type9_coaching_tips_081026` | **10 Aug** | 36 / 616 |

Nine of nine, `.docx` and `.pdf`, uniform structure and length. The gap closed between 28 Jul
and 10 Aug — after the premise was formed. **The ADAPTED base is uniform across all nine types;
sourcing no longer discriminates between them for authoring order.**

### 6.1 An unaccounted asset: the Type 1 authoring draft

`Type1_Improver_Authoring_Draft_080526.docx` (5 Aug) is a complete tiered prototype pass. Its
own coverage table reports:

> Total zones drafted (pages 3, 5–12): **181** · T1 verbatim: 0 · **T2 adapted from Hive
> source: 140** · **T3 AI draft, Hive voice: 40** · runtime: 1 · over-cap: 5

with per-zone tier, word cap, live word count, cited source and an over-cap flag list. Plus a
companion design-fit render with every zone bookmarked by ID. **This is not in the build
plan.** It is keyed to the 13-page contract, so it is not a drop-in:

| v3 sheet | Covered by the Type 1 draft | Gap |
|---|---|---|
| 6 Exploring A | `p3.*` — core_motivation, worldview, **core_belief**, 3 pattern chicklets | at-a-glance ×4 absent |
| 7 Exploring B | `p5.strength*/challenge*` (12), `p7.comm_style_name`, `p7.conflict_style_name` | **no decision-making style name**; bullets are 4+4/3+3, not 3 one-liners ≤43ch; catching-patterns absent |
| 8 Wings | `p11.wing{A,B}.{narrative,resource,best_line}` — 6 zones | **no 5-bullet lists** — 10 of 15 zones absent |
| 9 Lines | `p12.{stress,security}.{narrative,when_happening,as_resource}` — 7 zones | 6 line bullets + 3 resources-to-work absent |

### 6.2 Recommended authoring order — risk-driven, not sourcing-driven

1. **Type 1** — the only type with a drafted set; use it to prove the 13-page → v3 zone remap
   once before repeating it eight times.
2. **Types with the longest names**, because of the 124px `.pt-name` zone and p6's 11.31px
   headroom: **4 (The Individualist, 17ch), 6 (The Questioner), 3 (The Performer)**.
3. **Type 8** — `P6_Content_Trim_Review.docx` records the Eights already over budget on the
   subtype page by 50–65px; the same verbosity will hit p6 and p7 hardest.
4. Remainder.

---

## 7. Gates

| Gate | Applies | Evidence | State |
|---|---|---|---|
| **Coach regression** | ✅ | `verify_coach_baseline.js` — HTML byte-identical everywhere; normalized PDF hash Linux-only since PR #74 | baselines present |
| **Single-sheet, 36 renders** | ✅ | see §7.1 | **9 types × 6 pages = 10.9s wall, one browser launch** |
| **Content library invariant** | ✅ | *"reproducible: two builds byte-identical ✓ · invariant: committed == build(Word source) ✓ · 1352/1400 Word-canonical"* | green pre-§10 |
| **Transparency** | ✅ | `verify_transparency.js`, with a positive control | mockups p6/p7/p9 contain **zero** `rgba`/`opacity`/`transparent`/`oklch`; Wings_v1's 2 dead `oklch(` were dropped in the port. **Low risk** |
| **Diagram structural** | ✅ | *"18 diagrams measured · minimum edge clearance 5.47px"* | **green, already covers all of PR 3** |
| **Pixel-reference** | ⚠️ manual | reviewer sign-off; **no automated tooling exists** (`grep pixelmatch` → nothing) | see §7.2 |

### 7.1 Harness scaling, 6 → 42 renders

`render_client.js` iterates `cfg.fixtures`, and `buildClientModel` derives everything from
`apiResult.hypothesis.confirmed_type`. Scaling needs no new fixtures — a `types: [1..9]` key
that deep-clones the fixture and swaps `confirmed_type` / `alternate_candidate` (and nulls the
AI `*_name` strings so `assertName` does not flag drift). Built and working in
`nine_types_v3.js`. **Measured: full v3 document × 9 types = 10.9s.** At twelve pages, ~22s;
the current full run is 8.4s. **Cost is not a reason to sample.**

### 7.2 The pixel baseline is unverified

The 1.96% figure could not be reproduced or located — it is in no tracked doc and no script.
Flagged as unverified rather than repeated. Whatever the honest baseline is, it should be
written down before PR 3 makes claims against it, and it applies to **Type 9 only** — the other
eight have no mockup to diff against, which is why §3's assertions carry the weight the build
plan assigns them.

### 7.3 Which gate PR 3 most likely breaks

Ranked:

1. **The content-library gate failed to fire at all** — fixed, §10. This was the top risk.
2. **Single-sheet, on p6.** 11.31px. First real casualty once eight types of copy land.
3. **Coach regression** — low. p9's diagram already exists, so PR 3 touches no shared primitive
   PR 1 has not already proven.

---

## 8. Risks and unknowns

### 8.1 Where the render-only defect most likely is

Every PR in this series has surfaced one. The best candidate is **p6's `.glance-label` column
at 92px**, 9px bold, uppercase, with letter-spacing. Measured 1-line ceiling: **13–19 chars by
word shape** — the widest spread of any zone in PR 3. Type 9's four labels measure 15 / 32 / 24
/ 15 chars and already render at 2 / **3** / 2 / 2 lines. A three-line label on a page with
11.31px of headroom is one word from spilling, and the text is derived from `nickname_plural`,
so no author will see it in a copy review.

Second candidate: `.pt-name` at 124px, ceiling 16–19 chars, holding `"The Individualist"` at 17.

### 8.2 The at-a-glance grid has no matched-column protection

Spec §6 requires matched line counts for paired columns, and the plan adds that assertion for
At Your Best / Growing Edge and the two line points. The four `.glance-value` cells sit in a
2×2 grid and currently render **2 / 3 / 2 / 3** lines — already ragged in the reference. Either
the assertion covers it or the design accepts raggedness there; it should be a decision.

### 8.3 Type 9's own p6/p7/p9 content is not "done"

PR 1's pattern was to transcribe Type 9 from the mockup into `INTERIM_*`. **31 zones** still
need that treatment before Type 9 reaches parity with its Wings page. Invisible in the
"8 remaining types" framing.

### 8.4 The zone-ID contract has already forked twice

`insightout_client_report_v3_content_zone_inventory_v1_080426.csv` (4 Aug —
`p11.wingA.narrative` + `resource` + `best_line`) → the 7 Aug mockup (overview + **5 bullets**
+ resource). The CSV is stale against shipped code on the one page that shipped. **If PR 3's
content contract is not restated against `V3_PAGE_ORDER` before authoring begins, Mo will be
handed a third numbering scheme.**

---

## 9. The CMS override layer — a fourth content source

Raised as a code-only risk in §8 of the delivered audit; confirmed against production by Cai
the same day. **Seven published rows, all dated 13–29 June 2026** — before the v3 restructure,
before PR 1.5's reconciliation, before PR 2's copy sign-off, before PR #75's punctuation pass.

PR 1.5 reconciled the docx against `content_library.json` and declared Word canonical. **The
override table sat outside that reconciliation entirely and still does.** Every content
decision this project has made — canonical source, sign-off, normalization — has been made
about three sources while a fourth persisted stale copies of the same fields.

This was predicted and not actioned: `docs/client_report_test_coverage_audit_072326.md:80–84`
names the mechanism, and its recommendation 7 reads *"Settle the override story before
restructuring content fields."*

### 9.1 Does the v3 path resolve overrides? Yes — urgent, not deferrable

There is one client model builder. `buildClientReportHTML_v3(model)` consumes the same
`buildClientModel` output as the legacy renderer, and that function loads and applies overrides
at `report_prep.js:206–220` for `type_${heroN}`, `type_${altN}`, the subtype key and `static`.

**Measured** (`override_probe.js` — `db.query` stubbed to return a published set with the same
keys and shapes as the seven production rows; HTML byte-diff, overrides off → on):

| Path | Type 1 | Type 8 | Type 9 |
|---|---|---|---|
| **client v3** | **CHANGED** 80640→78861 | **CHANGED** 80678→78899 | **CHANGED** 83549→81770 |
| **client legacy** | **CHANGED** 464461→462043 | **CHANGED** 465785→463367 | **CHANGED** 464646→462210 |

**Coach resolves, but reaches only `type_N.comparison`.** `buildCoachModel` resolves
`type_${heroN}` / `type_${altN}` only — never `static`, never the subtype key — and reads only
`t.comparison` off the result (`report_prep.js:180–181`). Proved with sentinel controls:

```
coach sp4 (type 4)   CHANGED  68358 -> 67942 bytes
   SENTINEL-WINGS in coach html:      false     ← type_4.wings override: not reachable
   SENTINEL-COMPARISON in coach html: true      ← type_4.comparison override: reachable
coach sx7 (type 7)   IDENTICAL 68647 -> 68647   ← no override for type 7
```

**None of the seven rows is a `.comparison` key. Coach exposure is zero.** PR #75's finding
holds.

### 9.2 No gate can see it

Every harness runs with an empty override map — `[content_overrides] Failed to load overrides:
DATABASE_URL is not set` appears on every offline run. Content-library reproducibility, coach
regression, render and transparency are therefore all green against output production would not
produce. `.github/workflows/report-verify.yml` has no `env:`, no `secrets`, no `services`, so
CI cannot read the table as the workflow stands.

### 9.3 Byte forensics

`publishOverride` stores `JSON.stringify(value)` with no indent, so these counts are directly
comparable. `36aab5c` (18 Jun) is the last library commit before 1 July and is therefore the
baseline all seven publishes were made against.

| key | prod override | 18-Jun baseline `36aab5c` | today's baseline | Δ vs June |
|---|---|---|---|---|
| `static.primer` | 3414 | 3456 | 3564 | **−42** |
| `static.welcome` | 1292 | 1334 | 1358 | **−42** |
| `static.wings_using` | 418 | 543 | 537 | −125 |
| `subtype_sp9.tagline` | 67 | 68 | 68 | −1 |
| `subtype_sx9.tagline` | 62 | 59 | 59 | +3 |
| **`type_1.wings`** | **880** | **880** | **880** | **0** |
| `type_8.wings` | 855 | 907 | 907 | −52 |

### 9.4 Per-row effect

| Row | Reader | Shape vs today | Rendered output |
|---|---|---|---|
| `static.welcome` | v3 sheet 3 · legacy p1 | ✗ **missing `signoff`** | **renders the literal word "undefined"** |
| `static.primer` | v3 sheet 4 · legacy p2 | ✓ keys match | replaces signed-off copy; **headroom 12.58px → 5.91px** |
| `type_1.wings` | v3 sheet 8 | ✗ v2 shape | **no-op today; blanks the page the moment Type 1 content lands** |
| `type_8.wings` | v3 sheet 8 | ✗ v2 shape | same, plus a −52-byte content edit |
| `static.wings_using` | **legacy p5 only** | ✓ string | legacy-only; dies at PR 7 |
| `subtype_{sp9,sx9}.tagline` | legacy p6 · v3 sheet 10 (PR 4) | ✓ string | not in PR 3's four sheets |

#### `static.welcome` puts the word "undefined" in a client PDF

`signoff` was added by PR 2 on 12 Aug. The June override predates it, and `resolveLibObject`
does `out[field] = resolved` — whole-field replacement, no merge. **Measured** (`june_probe.js`,
using the real 18-June snapshot as the override value):

```
overrides OFF:  v3_welcome.signoff = "With gratitude and respect,"   literal "undefined" in HTML: 0
overrides ON :  v3_welcome.signoff = undefined                       literal "undefined" in HTML: 1
                rendered signoff markup: undefined
```

`_v3t(undefined)` → `String(undefined)` → escaped → shipped, in `.v3-wl-signoff`, directly
above the founder photos.

#### `static.primer.intro` is almost certainly **not** truncated in storage

The override is **3414 bytes against a June baseline of 3456 — a 42-byte reduction.** A
truncation of `intro` from 419 chars to 17 would be roughly **−402 bytes**. The arithmetic
fails by an order of magnitude.

There is also no truncation mechanism in the write path. `cmsCollect` (`server.js:10268`)
starts from `CMS_TEMPLATE[key]` — a deep clone of the baseline as served — and overwrites each
`data-path` from its input; `publishOverride` `JSON.stringify`s the result whole. Nothing
slices. **Read: "The Enneagram is…" is a display truncation in whatever surfaced the row, not
the stored value.** Settle it with
`SELECT length(value), substring(value from 1 for 400) FROM content_overrides WHERE content_key='static.primer';`

**What the −42 *is*, and it matters more:** a small, real copy edit made through the CMS rather
than through Word, on 29 June, to a field the docx owns — three weeks before PR 1.5 declared
Word canonical. `static.welcome` carries the same −42 signature.

#### The punctuation reintroduction is narrower than it looks

**Measured** — curly chars `[''""…]` in emitted HTML, overrides off → on:

```
type 9  v3      0 -> 0
type 9  legacy  2 -> 6
type 9  coach   2 -> 2
```

**The v3 path is immune.** `_v3Straighten` runs inside `_v3t` on every v3 prose string
(`renderer.js:3002`); it was written for the docx surface and covers the CMS surface too. The
exposure is **legacy-client-only, and legacy retires at PR 7.** Note em dashes are *canonical*
in the taglines (`"The Collector — peace through comfort…"` is the current library value), so
only curly quotes/apostrophes/ellipses are in scope.

#### `type_1.wings` at 880 bytes is a landmine that detonates on success

Exactly the June baseline and exactly today's. A **publish with no edit**. Measured consequence
today: none — both library and override are v2-shaped. **The moment Mo's Type 1 wing content
lands, the June override reverts it to the v2 shape and Type 1's Wings page goes blank again**
— and the obvious suspects (parser, gate, renderer) will all check out clean, because they will
all be correct. Type 1 is the pilot for the §6.1 remap, so clear it first.

### 9.5 Proposed position — not implemented, awaiting ratification

**(a) The resolver — fail loudly on shape mismatch, at render time.**
Not deep-merge: that marries June's `letters` to August's `signoff`, a combination nobody
reviewed, and it makes the stale row permanently invisible so nothing ever prompts a cleanup.
Not silent reject-to-baseline: a coach's published edit would quietly stop applying with no
notice. **Proposal:** in `resolveLibObject`, compare the override's leaf-path set to the
baseline's; on mismatch, throw, naming the key and both sets. This is the doctrine the codebase
already runs on (font probe, coach byte-diff, diagram gate, the retired `--accept-drift`), and
it surfaces at `/api/submit`'s dry-validate probe rather than in a delivered PDF. `value` being
`text` rather than `jsonb` costs nothing here — `jsonb` validates JSON-ness, not shape.

**(b) The seven rows — retire all seven, after a snapshot.**
**Retiring is NOT reversible in the app**: `revertOverride` is
`DELETE FROM content_overrides WHERE content_key = $1` (`content_overrides.js:183`), so
`previous_value` goes with the row. `previous_value` only undoes the last publish while the row
exists; it is not an archive. Take
`COPY (SELECT * FROM content_overrides) TO STDOUT WITH CSV HEADER` first, then delete. Retire
rather than migrate — the library holds better copy than every override except possibly
`static.primer`, whose −42 should be read before deletion and, if wanted, moved into the docx.

**(c) The gate gap — three things, cheapest first.**
1. **One line, today:** every harness prints `overrides: N published (0 = none loaded)`, so no
   future report can cite a harness run as evidence about production content without the reader
   seeing the override layer was absent.
2. **`npm run overrides:check`** — diffs every published override's leaf-path set against
   `content_library.json`, exits non-zero on mismatch. Runs wherever the DB is; no CI secret.
3. **The resolver throw from (a) is the actual gate** — no manifest, no CI database, no new
   script, and the only one that cannot be forgotten.

A fixture carrying a small published-override map (the 23 July audit's recommendation 7) still
stands, and belongs in the same PR as (a).

### 9.6 For the board, not this PR

`cmsBudgetFor` (`server.js:9997`) shows Mo a word budget per leaf — `.wings` → 70 words,
`.lines` → 60, strengths/challenges title → 5. Spec §6 already retired word counts as the
constraint, and §3 above found the real ceilings are widths whose character equivalents swing
15–25% by word shape. `word_count` is also the stored server-side authority (`cmsWordCount`).
**The editor surface is calibrated to the superseded measure.**

---

## 10. The one change made during this audit

`scripts/build_content_library.js:428` — the `if (INTERIM_WINGS_V3[n])` wrapper around the five
v3 Wings assertions is **removed**, so they run for all nine types. No logic inside the
assertions changed. The old comment claimed unauthored types would "fail loudly at their own
PR"; §1.2 measures that they did not. Not put behind a flag: PR 1.5 retired `--accept-drift`
because a flag used routinely stops being a guard.

**Measured** — `node scripts/build_content_library.js` → **exit 1, 56 coverage failures:
8 types × 7 assertions.** Type 9 passes.

```
*** COVERAGE FAILURES (56):
  - type_1.wings.intro_v3 empty (v3 page intro)
  - type_1.wings.wing_a.overview empty (v3)
  - type_1.wings.wing_a.bullets must be exactly 5 non-empty (v3), got none
  - type_1.wings.wing_a.resource empty (v3 "As a Resource" band)
  … through type_8
```

**Blast radius — measured, one CI step:**

| CI step | Result |
|---|---|
| `npm test` | PASS |
| `verify:render` | PASS |
| `verify_diagrams` | PASS |
| `verify_transparency` | PASS |
| `verify_coach_baseline` | PASS |
| **`verify_content_library`** | **FAIL (exit 1)** |

Contained, because the build exits before writing — `app/content/content_library.json` is
untouched, so every renderer gate still runs against the committed Type-9 content.

**Two consequences to decide on:**

1. **`main` goes red the moment this is committed** and stays red until Type 1–8 wing content
   lands, blocking unrelated PRs. That is the honest cost of the signal; whether it is
   acceptable now or should ride in on the PR 3 branch is a scheduling call.
2. **`verify_content_library.js` does not handle a failing build gracefully.** It exits 1
   correctly and the 56 failures are legible at the top, but it then appends a raw
   `execFileSync` error object with stderr as a ~3300-element byte array (6728 bytes of output
   for what should be 60 lines). PR 3 will hit this on every iteration. A `try/catch` printing
   `e.stdout` / `e.stderr` as text is a one-liner.

**A gap the gate still cannot close:** even unconditional, it only proves the *library* has the
fields. It cannot see the `type_1.wings` override wiping them at render time. §9.5(a) is not an
alternative to this change — it is the other half of the same fix.

---

## 11. Corrections to ratify

1. **~296 → 558 leaves / 368 NEW / 543 human-touched.** ~296 is the row count of a stale
   whole-document CSV against a superseded 13-page structure.
2. **PR 3 needs no new SVG variants.** `client-lines` shipped in PR 1; all 18 diagrams pass.
3. **Brief §12.5's labels do not belong to sheets 6 and 8.** They belong to cut pages of a
   13-page structure. The real per-type label load on PR 3's four sheets is **27 strings**,
   already inside D5.
4. **All nine types have coaching tips.** 7, 8 and 9 landed 28 Jul – 10 Aug. Sourcing no longer
   drives authoring order; risk does (§6.2).
5. **p6 is the tightest page in the document at 11.31px**, not What Is at 12.58px.
6. **Linux re-measurement is not cheap and was not done.** Land the ~6-line content-stack
   change to `render_client.js` first; the numbers then arrive free on PR 3's first CI run.
7. **`Type1_Improver_Authoring_Draft_080526.docx` exists** — 181 zones, 140 T2 / 40 T3 — and is
   unaccounted for in the build plan. Remap it before authoring type 2.
8. **The CMS override table is a fourth content source** reaching the v3 client path. Seven
   stale rows; one renders the literal word "undefined" in a client PDF; one is a landmine that
   fires when Type 1 content lands. §9.5 needs a decision before PR 3 authoring begins.
9. **`validateType`'s v3 Wings gate is now unconditional** (§10) — decide whether it commits to
   `main` now or rides the PR 3 branch.
