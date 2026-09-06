# Audit — PR 4, Instincts & Subtypes

**Branch:** `pr-4-instincts-audit`, off `main` @ `9285751b7a7274d5e5d8af56821a00734b34e20f`
(`9285751` — "Merge pull request #85 from cdelumpa/pr-3f-gate-hard"), pulled 4 Sep 2026.
**Nature:** audit and proposal. No page content, no gate flipped, no renderer change.

Every claim is tagged **[CC-MEASURED]** (read out of the repo or executed), **[CC-DERIVED]**
(arithmetic on measured values), or **[CC-JUDGMENT]** (my read — not evidence).

---

> ## AMENDMENT 1 — 5 Sep 2026
>
> Cai's governing decision on Z5 was not in the original prompt. **The mockup's three-block
> subtype column ("Where The Energy Goes" / "The Inner Experience" / "Growing Edge") is being
> replaced by the single narrative per subtype in Google Doc
> `1_M7tvK1I-5bJw0JjDF4xpTRAEPgpyeWkGCQea6nH364`.** The mockup is what is being changed; the Doc is
> the replacement content, not a parallel draft.
>
> **I have now read the Doc** (Drive, 5 Sep 2026) and measured all 27 rows. Findings voided by this
> decision are struck below rather than deleted. New material: **§2.2A** (the corrected Z5 model and
> the Doc measurements), **§2.7** (the new field name and its CMS consequences), **§4a** (scope),
> **§7** (where I think the counterproposal is still wrong).
>
> Everything not struck stands. §3.1 — the gate correction — is accepted as written and is
> unchanged.

> ## AMENDMENT 2 — 6 Sep 2026
>
> Audit of the **revised build sequence** (content-first), the **Naranjo / passion-term checks**,
> the **A/B/C fork pricing** and the **Z6 placeholders**. It is a full section at the end of this
> document, not an edit to the body — **see [Amendment 2](#amendment-2--6-sep-2026)**.
>
> Findings below that Amendment 2 corrects: **§2.6**'s "roughly 450 chars" (A2.6), **§2.7**'s named
> build-source docx (A2.7), and **§5 item 7**'s consumer claim (A2.4 iii). **§2.5**'s badge
> recommendation and **§5 item 5** are closed by Cai's 6 Sep decision — all three badges ship, as
> the build plan already required. **§6 items 6, 8 and 9** are closed; four new questions replace
> them (A2.8).

---

## 1. The numbering collision — RESOLVED, NOT AMBIGUOUS

**All four names refer to the same page. PR 3's "p8" is a different page. The premise of PR 4 is
intact.** [CC-MEASURED]

There are two numbering axes in this project, and both are carried on the same record in
`app/renderer.js:3092` (`V3_PAGE_ORDER`):

```
{ key: 'instincts', sheet: 10, footer: 8, title: 'Instincts & Subtypes',
  eyebrow: 'Navigating the Enneagram System' },        // app/renderer.js:3104
```

- `sheet` — position in the v3 document (1–12).
- `footer` — the number **printed on the page**. Cover and Contents carry `footer: null`, so
  numbering starts at Welcome (sheet 3 = printed 1) and **`footer = sheet − 2`** for every
  numbered sheet. Sheet 10 → printed 8. [CC-MEASURED]

| Name in circulation | Axis used | Resolves to |
|---|---|---|
| Notion IO-63 "Instincts & Subtypes (page 10)" | `sheet` | sheet 10 ✔ |
| Google Doc "p8 Instincts & Subtypes" | `footer` | printed page 8 ✔ |
| 080726 mockup "Page 8" | `footer` | printed page 8 ✔ |
| Spec v3.0 §2 table, row 10 | `sheet` | sheet 10 ✔ |

All four agree. [CC-MEASURED]

### 1.1 What PR 3's four sheets actually are, by content

Measured from commit subjects and from `V3_PAGE_ORDER`: [CC-MEASURED]

| PR 3 name | `V3_PAGE_ORDER` key | sheet | footer | Content |
|---|---|---|---|---|
| p6 | `typeA` | 6 | 4 | Exploring Your Type Hypothesis |
| p7 | `typeB` | 7 | 5 | Exploring Your Type Hypothesis (continued) |
| **p8** | `wings` | **8** | 6 | **Your Wings** |
| p9 | `lines` | 9 | 7 | Your Stress and Security Points |

Corroborated by the commit subjects themselves: `d893c1f` "PR 3-Wings: populate **p8** *Your
Wings*" and `8facb6f` "PR 3-Lines: **p9** content for all nine types". [CC-MEASURED]

**PR 3 numbers by `sheet`. The Google Doc and the mockup number by `footer`.** The string "p8"
therefore denotes Wings in one vocabulary and Instincts in the other. Nothing is wrong in the
repo; the collision is entirely in the prose that talks about it.

### 1.2 The identifier the spec and the renderer actually use

**Spec v3.0 calls this page `p10`, not `p8`.** [CC-MEASURED]

- §2 page-structure table, row 10: *"Instincts & Subtypes | Per-subtype static + 1 personalized
  zone | 'In Your Responses'"*.
- §2, closing line: *"Personalized zones total three: the Quick Reference data block, the p6
  client quote, and the **p10** instinct evidence."*
- §7.2 lists *"The nine SX9 shift bullets (**p10**)"* and *"The two 'Leaning Into the Other
  Instincts' blocks (**p10**)"*.
- §7.3: *"The subtype signature (`Merging & Intensity`) ... **Only the three Type 9 subtypes
  exist.**"*

**§7.4 does not cover this page at all.** Its title is "Sheets 6-7 prose — source of record" and
its scope is sheets 6–7. The three struck ceilings (95, 53, 90) are p6/p7 zone budgets and never
applied here. [CC-MEASURED] The *lesson* transfers; the numbers were never in scope to transfer.

The renderer has no `instincts` entry in `V3_PAGE_BUILDERS` (`app/renderer.js:3749`) and the
record carries no `built` flag, so the page is unbuilt. [CC-MEASURED]

### 1.3 A third collision, in CSS, that will bite the build

`p8-` and `p6-` are **already taken** by the live v2 client renderer. [CC-MEASURED]

`app/renderer.js` defines `_clP1Welcome` … `_clP8Application`, emitting `.p3-page` … `.p8-page`;
`tests/lib/report_page_inventory.js` asserts one of each. The live **`.p6-page` is
`_clP6Instinct` (`app/renderer.js:2247`) — the v2 Instincts page** — and it owns the whole `p6-*`
namespace (`.p6-stack`, `.p6-inst-block`, `.p6-ow-label`, …). `.p8-page` is the live Application
page. [CC-MEASURED]

Spec §3.4 and the sheet-6/7 port both already handle this by prefixing (`v3-ta-`, `v3-tb-`).
**The v3 Instincts page must use `v3-inst-`** and must not be called `p8-` or `p6-` anything in
code. [CC-JUDGMENT]

### 1.4 Recommendation

Retire "p8" for this page in prose. **Call it `p10` / `instincts`,** matching the spec, the Notion
card and `V3_PAGE_ORDER`. Where the Google Doc or mockup is cited, write "p10 (printed page 8)".
[CC-JUDGMENT]

---

## 2. Answers to the MEASURED questions

### 2.0 There is already a ratified plan for this page — the proposal partly re-litigates it

`docs/client_report_v3_build_plan.md` carries **decision D4, ratified**: [CC-MEASURED]

> Page 10 scope **fixed**: 3 instinct-definition cards + one 3-column subtype comparison unit +
> "In Your Responses". **Shift bullets and "Leaning Into the Other Instincts" blocks are CUT** →
> PR 4

and a full PR 4 section (lines 181–207) naming the files, the four content prerequisites, the
pass/fail criteria and the gate requirement. `docs/feasibility_report_client_report_v3.md` §7 had
already flagged the spec↔mockup inconsistency the plan then resolved.

**The proposal in the prompt should be read against that plan, not in place of it.** Where the two
differ I say so below. [CC-JUDGMENT]

### 2.1 Does p10/Instincts content already exist in the store?

**Yes — substantially, and more than the proposal assumes.** [CC-MEASURED]
`app/content/content_library.json` holds:

| Key | Shape | Status for p10 |
|---|---|---|
| `static.instinct_primer` | 330-char string | Z2 candidate — **wording differs from the mockup** (§2.4) |
| `static.instinct_definitions` | 3 × `{code, name, body}` | Z3 — **bodies longer than the mockup's** (§2.4) |
| `subtype_sp1` … `subtype_sx9` | **27 rows**, fields `code, name, tagline, narrative, patterns, shifts` | Partly reusable, wrong shape for Z5 |
| `static.contents[6]` | `{start:'instincts', desc:'…what it means to be a {subtype_label}.'}` | TOC entry **already promises the page** |

27/27 subtype rows present, all six fields on all 27. [CC-MEASURED]

**These rows are live production content**, consumed by the v2 report and editable in the admin
CMS (`app/server.js:10546` — *"108 fields across 27 subtypes"* = 27 × {tagline, narrative,
patterns, shifts}). [CC-MEASURED] PR 4 cannot repurpose them destructively.

### 2.2 The mockup's Z5 structure — measured, and now SUPERSEDED

> **Amendment 1.** The three-block structure measured here is **being replaced** by one narrative
> per subtype (§2.2A). This section is retained because it is the measured baseline the probe
> compares against, and because the block/heading geometry is what the new shape *removes*.
> Findings that treated the three-block model as the target are struck.

I extracted every text node and every CSS rule from
`docs/mockup/claude_The_Peacemaker_Page_Instincts_v1.html`. [CC-MEASURED]

Z5 as drawn is not one narrative per subtype. Each column carries **three separately labelled
prose blocks** under fixed headings:

| Mockup class | Field | n | chars (min–max) |
|---|---|---|---|
| `.cname` | display name — "The Collector" | 3 | 10–24 |
| `.cline` | two-word signature — "Comfort & Routine" | 3 | 17–25 |
| `.ctxt` under `Where the Energy Goes` | prose | 3 | 99–134 |
| `.ctxt` under `The Inner Experience` | prose | 3 | 98–102 |
| `.ctxt` under `Growing Edge` | prose | 3 | 91–95 |

All nine `.ctxt` blocks: **91–134 chars** (mean 102.8). [CC-MEASURED]

**Per-column three-block totals — measured, as asked in the counterproposal §3:** [CC-MEASURED]

| Column | Blocks | Prose total | Heading text |
|---|---|---|---|
| SP9 The Collector | 134 + 102 + 95 | **331** | 53 chars over 3 rows |
| SO9 The Community Benefactor | 103 + 101 + 91 | **295** | 53 chars over 3 rows |
| SX9 The Seeker | 99 + 98 + 92 | **289** | 53 chars over 3 rows |

min 289 · max 331 · mean 305.0 · spread 42. The counterproposal's derived 288–331 was right to
within one character on the low end. Heading text is identical in all three columns
(`Where the Energy Goes` 21 + `The Inner Experience` 20 + `Growing Edge` 12 = 53), each on its own
`.clbl` row with a 4px bottom margin, inside a `.czone` with a 14px bottom margin. [CC-MEASURED]

Consequences:

1. **The passion term ("Appetite") does not appear on the page.** It is not a p10 field.
   [CC-MEASURED] — **stands** (and is reconfirmed by the Doc, §2.2A).
2. ~~**The Google Doc's 27 narratives cannot be used as drafted.** At 360–394 chars they are 3–4×
   a single Z5 block. They would have to be split three ways under fixed headings, which is
   re-authoring, not ingest.~~ **VOID — Amendment 1.** The narratives are not being fitted into
   the three-block structure; they replace it. This finding was correct about the *mockup* and
   wrong about the *intent*, because I did not know the mockup was being changed.
3. **The store's narratives are further still from the target: 602–762 chars, mean 693, spread
   160, all two-paragraph.** SP9 is 677, SO5 is 695. Split by paragraph they are 246–380 and
   263–414. **No slicing of the store text reproduces the Doc's 345–415 band**, so the Doc and the
   store are two independent bodies of prose. [CC-MEASURED] — **stands, and is now load-bearing:**
   it is the evidence that the Doc must land in a *new* field rather than overwrite `narrative`
   (§2.7).
4. ~~Net-new authored strings for Z5: **27 × 4 = 108** … **24 × 4 = 96 to author**, plus 24
   signatures. This matches the build plan's content-prerequisite table exactly.~~ **VOID —
   Amendment 1.** Corrected count in §2.2A. **The build plan's "24 to author" prerequisite is
   therefore stale and should be struck with it.**
5. ~~`Growing Edge` is **derivable, not net-new, for the three that exist**: SP9's mockup text is
   `subtype_sp9.shifts[2]` with the lead-in stripped.~~ **MOOT as an authoring route — Amendment
   1.** The derivation itself is still measured fact and is worth keeping for one reason: it shows
   the mockup's Z5 prose was condensed *out of the v2 store*, which is corroborating evidence that
   the Doc — measurably independent of the store (item 3) — is genuinely new content and not a
   re-transcription. [CC-JUDGMENT]

### 2.2A Z5, CORRECTED — one narrative per subtype, measured from the Doc

Read from Drive on 5 Sep 2026 and parsed in full. **27/27 rows present.** [CC-MEASURED]

The Doc's per-subtype header line is three `·`-delimited elements followed by a stated count:

```
SP9 · Appetite · Comfort & Routine — 360 chars
    ^code  ^passion   ^signature
```

**Ingest hazard, name it before writing the parser:** the signature is the **third** element, not
the second. The second is the passion term, which §2.2(1) establishes is not a page field. A
parser that takes "the text after the first `·`" ingests the wrong string for all 27.
[CC-JUDGMENT]

**Corrected Z5 per-column field model:**

| Field | Source | Status |
|---|---|---|
| display name — "The Collector" | `reference/hive_27_subtype_reference.md` | 27/27, **not in the Doc** (§2.3) |
| signature — "Comfort & Routine" | Doc, 3rd header element | 27/27 [CC-MEASURED] |
| narrative — one paragraph | Doc body | 27/27 [CC-MEASURED] |
| passion term | — | **not a page field** |

The three block headings cease to exist on p10.

**Doc narrative measurements** [CC-MEASURED]:

- **min 360 (SP9) · max 394 (SO5) · mean 382.7 · spread 34.** All 27 inside the stated 345–415
  band. Exactly reproduces the figures in the prompt.
- Words: min 53 · max 67 · mean 60.4.
- **All 27 stated char counts are EXACT — zero delta, 27/27.** This is worth recording because it
  is the opposite of the standing caution: §7.4 warns that the p6/p7 source docs' printed counts
  run low. **That caution does not apply to this Doc.** Recount at ingest anyway — the counts being
  right today is not a property of the file, and my read came through a text rendering, not the
  raw document.
- **Signatures: 12–25 chars, and none exceeds 25.** [CC-MEASURED] This clears the existing spec §6
  ceiling *"How You May Experience SP/SO/SX — exactly 25 chars, fits 1 line"* without a new
  measurement. The single 25-char case is `Belonging & Participation` (SO9) — the same string the
  mockup carries, so it is already known to render on one line at this column width.
- **The Doc's three Type 9 signatures match the mockup's `.cline` values exactly, 3/3**
  (`Comfort & Routine`, `Belonging & Participation`, `Merging & Intensity`). [CC-MEASURED]
  Independent corroboration that this Doc is the p10 source and not an unrelated artifact.

**The Z5 vertical delta, for the three columns where both shapes exist** [CC-MEASURED]:

| Column | Mockup 3-block prose | Doc narrative | Δ prose | Δ structure |
|---|---|---|---|---|
| SP9 | 331 | 360 | **+29** | −3 heading rows |
| SO9 | 295 | 382 | **+87** | −3 heading rows |
| SX9 | 289 | 381 | **+92** | −3 heading rows |

**This is not uniform, and that matters.** SP9 gains 29 characters; SX9 gains 92. Whatever the net
vertical effect is, it is **not the same for all three columns of a single page**, and the tallest
column sets the row height. Only 3 of 27 can be compared this way at all — the other 24 have no
mockup counterpart. The counterproposal is right that this must be probed and not assumed.
[CC-JUDGMENT]

**Worst case is per-type, not global — the probe needs the right nine.** All three columns render
side by side, so the tallest of a type's triple sets the height: [CC-MEASURED]

| Type | SP | SO | SX | tallest |
|---|---|---|---|---|
| 1 | 379 | 379 | 389 | SX1 389 |
| 2 | 378 | 381 | 382 | SX2 382 |
| 3 | 377 | 386 | 379 | SO3 386 |
| 4 | 383 | 387 | 377 | SO4 387 |
| 5 | 381 | **394** | 382 | **SO5 394** |
| 6 | 378 | 387 | 388 | SX6 388 |
| 7 | 389 | 389 | 383 | SP7 389 |
| 8 | 384 | 389 | 389 | SO8 389 |
| 9 | 360 | 382 | 381 | SO9 382 |

SO5 at 394 is confirmed the global worst column, and it sits in Type 5's triple, so **probing
Type 5 does cover the global worst case.** But note the tallest-per-type values span only
**382–394 — a 12-character band across all nine types.** [CC-DERIVED] Unlike p6/p7, where types
differed widely, there is no "easy" type here: if Type 5 fits, the rest almost certainly fit; if it
does not, none do. That makes the probe cheaper to reason about, and it makes a single-type probe
result close to conclusive — which it was not on p6/p7. [CC-JUDGMENT]

### 2.3 The 27-row join — the display names are already in the repo, twice, in agreement

**`hive_27_subtype_keywords_v5.docx` is not in this repo.** [CC-MEASURED] It is not needed.

`reference/hive_27_subtype_reference.md` (git-tracked) carries all 27 as headings of the form
`### SP 9 — The Collector (Appetite)`, including the passion term and the ⚠ counter-type marker.
I parsed all 27 and cross-checked each name against the name embedded in the corresponding
`content_library.json` tagline: **27/27 match, zero mismatches.** 5 counter-types marked (SO7,
SP3, SP4, SX1, SX6). [CC-MEASURED]

**Recommended authoritative source: `reference/hive_27_subtype_reference.md`.** It is in the repo,
version-controlled, complete, carries the passion and CT marker the store does not, and already
agrees with the store. Ingesting names from an external docx would add a third copy of a fact that
already has two agreeing ones. [CC-JUDGMENT]

~~I could not verify the Google Doc `1_M7tvK1I-…`: its ID appears nowhere in the repo, and I did
not fetch it.~~ **Amendment 1 — now read and measured (§2.2A).**

**The Doc contains no display names.** I searched all 27 rows for their own display name across
narrative, signature and passion: **zero hits.** [CC-MEASURED] So the recommendation above is no
longer a preference between two sources — **`reference/hive_27_subtype_reference.md` is the only
source in existence for `.cname`.** The Doc adds no third vote and cannot be a fallback.

The store's 27 taglines still carry the same names and still agree 27/27, so there remain two
agreeing sources — but per §2 of the counterproposal the store's `tagline` is v2's and is being
left untouched, so it is a cross-check, not a supply. [CC-JUDGMENT]

**One divergence to record, not to fix here.** The Doc and the reference file disagree on the
**passion term for 18 of 27 subtypes** [CC-MEASURED] — e.g. SX9 Doc `Fusion` vs ref `Union`; SP5
Doc `Castle` vs ref `Home`; SO5 Doc `Totem` vs ref `Symbols`; SP7 Doc `Keepers of the Castle` vs
ref `Family`. Nine are identical. This does **not** block p10, because the passion term is not a
page field. It matters because the reference file describes itself as *"Draft reference for
inclusion in the Hive AI Prompt Spec"* feeding Section 4 of the Coach Prep Report — so two
artifacts that both reach a reader disagree on 18 of 27 terms. **Own card (§5, item 7). Do not
widen PR 4 to reconcile it.** [CC-JUDGMENT]

### 2.4 Z2 / Z3 reconciliation — the discrepancy is real, and it is an AS-IS / EDIT decision

**Confirmed, measured, both zones.** Not resolved here — this is Cai's call. [CC-MEASURED]

**Z3, instinct definitions.** Store bodies run 177–201 chars; mockup `.itxt` runs 117–126. The
mockup is ~40% shorter and reworded, and adds a `Focused On` label the store has no field for.

> Store SP: *"Focused on safety, comfort, health, and the practical resources of daily life. SP
> energy goes toward securing what you need — physically, materially, and in terms of personal
> wellbeing."* (183)
> Mockup SP: *"Safety, comfort, health, and the practical resources of daily life: securing what
> you need physically and materially."* (117)

**Z2, intro.** Store `instinct_primer` is 330 chars and ends on a *why-two-people-differ* beat with
**no type token**. Mockup `.lead` is 299 chars and ends *"…creating a distinct flavor of the
**Peacemaker** pattern"* — i.e. it **requires** a type token the store string has no slot for.
[CC-MEASURED]

So Z2 is not "static templated with a single token" over the existing string — the existing string
would have to be **re-authored** to accept the token. The proposal's §2.2 classification is
optimistic. [CC-JUDGMENT]

Note the build plan already commits Z3 as **AS-IS** (`static.instinct_definitions[3]`), which
means shipping the *longer* store text into cards the mockup fitted to the *shorter* text. That is
a fit risk the plan does not price, and it is exactly what 4a must measure. [CC-JUDGMENT]

### 2.5 Z5 badges — the risk is real, confirmed three independent ways

**What is persisted per client.** [CC-MEASURED] Both, at different layers:

| Field | Where written | Shape |
|---|---|---|
| `hypothesis.instinct_score_profile` | `app/call2_stamp.js:37`, `app/server.js:5472`, from `scores.instinctProfile` — into the `assessments.api_result` JSONB | `{SP,SO,SX}`, each 0–100 |
| `hypothesis.dominant_instinct_hypothesis` | AI Call #2 judgment; denormalized to a column by `app/db.js:1497` / `:1543` | `"SP"｜"SO"｜"SX"` |

The column was added by migration (`app/db.js:68`, `ADD COLUMN IF NOT EXISTS`), so **rows written
before it existed hold NULL**. `instinct_score_profile` is worse: `call2_stamp.js:37` writes it
**conditionally** (`if (scores.instinctProfile)`), so where the scorer produced none the key is
simply absent from the JSONB. [CC-MEASURED]

**Read path.** `app/report_prep.js:262` → `instinctStack(h.instinct_score_profile)`
(`report_prep.js:65`), which sorts `['SP','SO','SX']` by raw score and labels them
`Leading / Supporting / Growing`.

**Is there a tie-break? No.** I executed it: [CC-MEASURED]

```
exact 3-way tie {50,50,50}   → Leading=SP, Supporting=SO, Growing=SX
SO/SX tie at top {10,80,80}  → Leading=SO, Supporting=SX, Growing=SP
1-pt gap 2nd/3rd {70,51,50}  → Leading=SP, Supporting=SO, Growing=SX
profile undefined            → Leading=SP, Supporting=SO, Growing=SX
profile {}                   → Leading=SP, Supporting=SO, Growing=SX
```

Ties fall through to `Array.prototype.sort` stability, i.e. **SP → SO → SX declaration order**.
A missing or empty profile produces a confident-looking **"Leading = SP"** rather than an error,
and `report_prep`'s `nonEmptyArrays` validation passes because the array is always length 3.
[CC-MEASURED]

`nearTie` exists (`report_prep.js:73`) but operates on `call1_ranking` — **types, not instincts**.
There is no near-tie concept for instincts anywhere in the code. [CC-MEASURED]

**The design doc says exactly what the prompt claims.** `hive_typing_engine_design_v2_052926.docx`,
under §4.2 Scoring / §4.3 What is removed: [CC-MEASURED]

> *"No mechanical confidence labels. The AI characterizes dominance and confidence from the
> distributions."*
> *"Center confidence and instinct confidence threshold labels (HIGH/MEDIUM/LOW)"* — removed.
> **"Instinct statements are deliberately NOT written to force separation. All three instincts are
> real for everyone… Near-ties are a feature."**

**And the engine acts on it.** `app/server.js:4736` instructs Call #2: *"if the top two instincts
are within a point or two, do not force a winner — name your best read and raise
`low_instinct_confidence`."* [CC-MEASURED]

**The fixture proves the case.** The only v3 fixture, `tests/fixtures/anders_sx9_api_result.json`,
carries `{SP: 66, SO: 64, SX: 84}` — a **2-point** gap between second and third. The mockup built
from that fixture badges **SP9 "Secondary" and SO9 "Tertiary"** on those two points.
[CC-MEASURED] `docs/mockup_file_manifest.md:47` records the same scores.

**My read.** The risk is real and I would not ship all three badges as drawn. But two corrections
to the framing: [CC-JUDGMENT]

- **This is not a new behaviour to accept or reject — it ships today.** Live v2 `_clP6Instinct`
  already renders a numbered "YOUR INSTINCTS STACK" labelling all three
  `Leading / Supporting / Growing` (`app/renderer.js:2254`). Badging Primary only on p10 is a
  *change to shipped behaviour*, and arguably a defect fix that should also reach v2 — not a
  free choice inside a new page.
- **The mockup already half-agrees.** `.ctag` is orange for Primary, `.ctag.rank` is grey for
  Secondary/Tertiary. The design already weights Primary; the objection is to asserting the
  *ordinal* between the two grey ones. [CC-MEASURED]

**Recommendation, for Cai to accept or reject:** badge **Primary only**; render Secondary and
Tertiary with no rank word; keep the fixed SP → SO → SX column order the mockup uses (it is
already fixed — the mockup's columns run SP9, SO9, SX9 with the badges floating). Additionally,
make an absent or all-zero `instinct_score_profile` **throw**, not silently return SP — that is a
correctness bug independent of the badge decision. [CC-JUDGMENT]

**Also note:** the build plan's PR 4 pass/fail *requires* the three badges ("Rank badges match
`instinct_score_profile` ordering"), so this recommendation reopens a ratified line of D4-adjacent
plan text, not just a fresh proposal. It should be decided explicitly. [CC-MEASURED]

### 2.6 Z6 "In Your Responses" — **not net-new. A producer exists, and there are two of them.**

The proposal's premise is wrong here. [CC-MEASURED]

**Producer 1 — SM path.** `app/server.js:4828` defines the field *by this page's name*:

> *"For the client report's 'In Your Responses' box (Page 6): exactly 3 short bullets, ≤25 words
> each… Set to null when the `low_instinct_confidence` flag is present."*

Schema at `server.js:4961`; validated by `scripts/verify_phase1_fields.js:71–83`.

**Producer 2 — EM path.** `app/em_report_adapter.js:143` maps
`client_facing.instinct_personal_overlay → instinct_evidence` via `_toEvidenceArray`, whose own
comment says the EM call emits *"a single 2–3 sentence string → wrap it as a one-element array"*.

**So the same field arrives in two different shapes** depending on which pipeline produced the
assessment: three short bullets, or one paragraph. [CC-MEASURED] The mockup's `.resp-txt` is a
single 333-char paragraph — the **EM** shape. The live v2 renderer prints it as bullets. A p10
renderer must handle both, and the fit probe must cover both worst cases. This is the single most
consequential thing in this audit that neither the prompt nor the build plan names. [CC-JUDGMENT]

**Where it renders today:** live v2 `.p6-own-words` / `.p6-ow-label` "IN YOUR RESPONSES", guarded
`${evidence ? … : ''}` — the box **disappears** when the field is null. [CC-MEASURED]

**Worst case already exists in the repo:** `CMS_PREVIEW_WORST_EVIDENCE` (`app/server.js:13823`),
injected for `.p6-page` CMS preview at `:13915`. 4a should use it rather than invent one.
[CC-MEASURED]

**Would CI exercise it? No — and the failure mode is worse than the `render_client.js:259`
analogue.** [CC-MEASURED]

- `render_client.js:259` clears `client_words` when a fixture is re-typed. `instinct_evidence`
  lives on `client_facing`, which that block does not touch — so it would *not* be cleared.
- It would not need to be. **`tests/fixtures/anders_sx9_api_result.json` has
  `client_facing: {}` — empty.** `instinct_evidence` is `null` in the only v3 fixture.
- With the live renderer's `evidence ? … : ''` guard, **Z6 would render as nothing in all nine CI
  renders**, and every fit check would pass on a page missing its riskiest zone.

**And re-typing does not exercise Z4/Z5 either.** `render_client.js` re-types one fixture across
`types: [1..9]` but never varies `instinct_score_profile`. So p10 would be rendered for 9 types ×
**one** instinct ordering — always SX-primary, always the `SX{n}` subtype in the "yours" slot.
**Nine of the 27 subtype columns would ever be the highlighted one, and SP-primary and SO-primary
orderings would never render at all.** The build plan's "27 renders" pass/fail is not reachable
with the current harness. [CC-DERIVED]

**The band is not fixed-height.** `.resp` has `padding:16px 18px` and **no height or max-height**;
`.page` is `min-height:1056px`. So an over-long Z6 does not clip — it **spills the page past the
1057px gate** (`PAGE_PX = 1056`, `scripts/spike/explore_fit_probe.js:37`; gate per
`client_report_v3_build_plan.md:37`). The risk is real but the mechanism is page spill, not
truncation, and the existing render gate already catches it *if the zone is populated*.
[CC-MEASURED]

Mockup Z6 is 333 chars. Three SM bullets at ≤25 words each is roughly 450 chars plus three bullet
rows of leading — comfortably more. [CC-DERIVED] That is the number the Z6 build must settle, and
per the prompt I am not proposing a cap here.

### 2.7 The new p10 field — name, and what it does to the CMS *(Amendment 1)*

Per counterproposal §2, the Doc's narratives take a **new field on the same 27 rows**;
`subtype_*.narrative` is v2's and stays untouched.

#### Proposed name: `instincts_v3`, a nested object

```
subtype_sp9.instincts_v3 = { signature: "Comfort & Routine", narrative: "Self-Preservation Nines…" }
```

**Why this shape.** [CC-JUDGMENT], on measured precedent:

- **`_v3` is the established suffix for "v3 field living beside its v2 counterpart" on the same
  row.** Measured in the store: `type_N.wings.intro_v3`, `type_N.lines.intro_v3`,
  `.work_lead_v3`, `.work_v3`, and `type_N.explore_v3`. [CC-MEASURED] This is the same situation.
- **Nesting the pair mirrors `explore_v3: {p6, p7}` exactly** — one new top-level field carrying
  page-scoped v3 content, rather than two loose siblings. [CC-MEASURED]
- **It costs one CMS field per subtype instead of two.** The signature and narrative are authored
  together on one Doc line and edited together; `resolveLibObject` replaces an overridden field
  *whole* (`app/content_overrides.js:199–212`, "replaces a field WHOLE"), which is the right
  granularity for a pair authored as a unit. [CC-MEASURED]
- Nested values are already first-class in the editor: `patterns` is `{thinking, feeling,
  behaving}` under a single content_key, with per-leaf budgets keyed off `path`. [CC-MEASURED]
- **It is deletable as a unit** if the page is ever re-scoped again, which `narrative_v3` +
  `signature` as loose siblings would not be.

**Alternative considered and rejected:** `narrative_v3` + `signature` as two flat fields. It reads
slightly more directly, but suffixes inconsistently (one field needs `_v3` to avoid the v2
collision, the other does not), and it costs two CMS fields, two regex entries and two budget
branches instead of one. **Rejected on consistency, not on effort.** [CC-JUDGMENT]

I did **not** name it `p10_*`: §1 of this audit is an argument that page numbers on this page are
ambiguous, and putting one in a schema key would bake the ambiguity into the data. [CC-JUDGMENT]

#### Consequences for `validateSubtype`

`scripts/build_content_library.js:1682`. Per §3.1 the existing `shifts` requirement **stays**.
Add:

```js
need(st.instincts_v3 && st.instincts_v3.signature, `${P}.instincts_v3.signature empty`);
need(st.instincts_v3 && st.instincts_v3.narrative, `${P}.instincts_v3.narrative empty`);
```

The 27/27 coverage assertion is already structural — `build_content_library.js:1742–1743` loops
all 27 keys and calls `validateSubtype` on each, so presence is enforced for all 27 by
construction once the field is required. [CC-MEASURED]

**Where the content enters the build.** The builder reads `InsightOut_Static_Content_Library_
Subtypes_v1_3_060726.docx`; the Doc's narratives are not in it. The established pattern for
v3-only content is an `INTERIM_*_V3` constant in the builder, merged additively onto the
docx-derived row — `t.explore_v3 = INTERIM_EXPLORE_V3[n]` (`build_content_library.js:1402`),
same for `INTERIM_WINGS_V3` and `INTERIM_LINES_V3`. [CC-MEASURED] **`INTERIM_INSTINCTS_V3`, keyed
by subtype code, merged at `build_content_library.js:1731`** (`lib['subtype_'+key] = st`) follows
it exactly. [CC-JUDGMENT]

#### Consequences for the CMS — six touchpoints, and one that does not work yet

I swept every site that hardcodes the four subtype field names. There are exactly two regexes, one
declarative array, one iteration site, one budget function and one summary string. [CC-MEASURED]

| # | Site | Change | If missed |
|---|---|---|---|
| 1 | `CMS_SUBTYPE_FIELDS` — `server.js:9893` | add `{ field: 'instincts_v3', label: 'Instincts (v3)' }` | field never appears in the editor |
| 2 | `cmsIsValidSubtypeKey` — `server.js:9900` | add `instincts_v3` to the alternation | **write routes reject the key**; edits silently impossible |
| 3 | `cmsWordBudget` — `server.js:~10023` | add a branch, keyed on `path` | returns `0` — no budget shown |
| 4 | `cmsPreviewSpec` — `server.js:13854` | see below | preview returns a 400 |
| 5 | Summary string — `server.js:10546` | `108` → **`135`** | admin UI states a wrong denominator |
| 6 | Comment — `server.js:9902` | "6 static + 108 subtype keys" → 135 | stale comment |

Field count: **27 × 5 = 135**, up from 108. [CC-DERIVED]

**Trap on #5 — do not global-replace `108`.** `server.js:10833` also reads *"108 fields across 9
types"*. That is the **type** editor (9 types × 12 fields), an unrelated coincidence. Only
`server.js:10546` changes. [CC-MEASURED]

**#4 is the consequence that does not resolve cleanly, and I am not absorbing it.** Every entry in
`cmsPreviewSpec` maps a content_key to a **live v2 page** — `.p6-page`, `.p7-page`, `.p5-page`.
`instincts_v3` renders on no live page: the v3 document is built beside the live one and is not in
production until cutover. [CC-MEASURED] So:

- **Behaviour if left unmapped:** `cmsPreviewSpec` returns `undefined`, and
  `POST /admin/content/preview` returns a clean `400 {ok:false, error:'no preview mapping for
  key'}` (`server.js:13936–13937`). It does not crash, and it cannot corrupt anything.
  [CC-MEASURED]
- **But the editor renders a Preview button that now fails with an error toast** on one of the five
  fields, which reads as a bug to whoever clicks it. [CC-JUDGMENT]

**Recommendation:** leave `instincts_v3` out of `cmsPreviewSpec` until cutover, and **suppress the
Preview control for fields with no mapping** rather than letting it fail — a one-line UI condition
in `renderSubtypesPage`, honest about the reason. Wiring preview to the v3 renderer is a
cutover-time job and does not belong in PR 4. [CC-JUDGMENT]

**No change needed** to `resolveLibObject` (`content_overrides.js:199`) — it iterates
`Object.keys(baseObj)`, so a new field on the row resolves overrides automatically — nor to
`cmsArrayHeading`, since `instincts_v3` is an object of two strings, not an array. [CC-MEASURED]

---

## 3. Where the proposed architecture is wrong

Zone inventory Z1–Z6 (§2.1) is **correct** and matches the mockup. [CC-MEASURED] The errors are
all below it.

| # | Proposal | Measured reality | What I'd do |
|---|---|---|---|
| 1 | "p8" throughout | `p8` is Wings (sheet 8); this page is `p10` / `instincts` | Rename in prose; use `v3-inst-` in code (`p6-`/`p8-` are taken) |
| 2 | ~~§2.2 PER-SUBTYPE = 5 fields, one narrative~~ | **VOID — Amendment 1.** The one-narrative model is the decision; the mockup's three blocks are what changes | Per-column model in §2.2A; new field in §2.7 |
| 3 | §2.2 lists a passion term as a page field | "Appetite" appears nowhere on the page | Drop it from the p10 schema |
| 4 | §2.3 display names come from `hive_27_subtype_keywords_v5.docx` | Not in the repo. All 27 names + passions + CT markers are in `reference/hive_27_subtype_reference.md`, agreeing 27/27 with the store | Source from the repo file; do not ingest a third copy |
| 5 | ~~§2.3 narratives ingest from the Google Doc~~ | **REVERSED — Amendment 1.** Ingest is correct. 27/27 read and measured; stated counts exact; signatures ≤25ch | Ingest to a new field (§2.7), recount at ingest |
| 6 | §2.2 Z2 is "static template + type token" | The store string has no token slot and ends on a different beat | Z2 is a re-author, not a tokenisation |
| 7 | §2.6 Z6 is "not a content-library item; something has to produce it" | Two producers exist, in two shapes, with a null path | Build to the existing field; reconcile the two shapes |
| 8 | §2.6 "unbounded string in a fixed-height band" | `.resp` is auto-height; overflow spills the page past 1057px | Real risk, different mechanism — the existing page gate catches it |
| 9 | §4b gate asserts **no shift zone exists** (accepted in full by the counterproposal) | `validateSubtype` **requires** `shifts.length >= 1`, and `subtype.shifts` renders on **live v2 p7** (`renderer.js:2347`) | See below — this is the most dangerous item |
| 10 | §2.5 badges framed as a new-page choice | All three are already labelled on live v2 p6 | Decide it as a change to shipped behaviour |

### 3.1 The negative gate as specified would break the live report

**This is the finding I would most want acted on.** [CC-MEASURED]

The prompt asks 4b's content gate to assert *"no shift-bullet … zone exists"*. The build plan asks
`build_content_library.js` to *"remove any gate requirement for shift/leaning content so the cut
content isn't demanded."*

But `subtype.shifts` is **live production content on a different page**:
`report_prep.js:375` feeds it to `pages.strengths_challenges.shifts`, rendered by
`renderer.js:2347` on the live v2 **p7** (Strengths & Growth), and it is admin-editable
(`server.js:13861`, selector `.p7-page`). Removing `need(st.shifts.length >= 1, …)` from
`validateSubtype` would let a content rebuild silently empty a live page.

**D4 cut shifts *from p10*. It did not cut them from the product.** The correct enforcement is:

- **Content gate (`build_content_library.js`): leave `shifts` REQUIRED.** It is v2's.
- **Add** requirements for the new p10 fields — **`instincts_v3.signature` and
  `instincts_v3.narrative`, 27/27** (§2.7; amended from "three comparison zones").
- **Renderer gate (a test, not the content build): assert the emitted `.v3-inst-` page contains no
  shift zone and no "Leaning Into the Other Instincts" block.** That is where D4 belongs — it is a
  statement about what p10 *renders*, not about what the library *holds*.

[CC-JUDGMENT] — the classification is mine; the facts above it are measured.

### 3.2 Two stale documents PR 4 should correct in passing

- **Spec §7.2 still lists "the nine SX9 shift bullets (p10)" and "the two 'Leaning Into the Other
  Instincts' blocks (p10)" as open content items.** D4 cut both, and the `Instincts_v1` mockup
  contains neither. `feasibility_report_client_report_v3.md:173` flagged this in exactly these
  terms and it was never struck. [CC-MEASURED] Strike it in the PR that builds the page, or the
  spec of record contradicts the gate.
- **Amendment 1 adds a third stale entry, one section earlier.** Spec **§7.1 "Authored and
  approved"** lists *"The three subtype comparison columns"* — the exact structure the Doc
  replaces. [CC-MEASURED] Strike it in the same sweep. §7.3's *"Only the three Type 9 subtypes
  exist"* also goes: all 27 signatures now exist in the Doc.
- **The build plan's PR 4 pass/fail claims Z6's border is "the only orange element on the page
  except the client name in the header (§5.3)". The mockup falsifies it:** `.ctag` (Primary badge)
  is `#F68625`, `.resp` background is `#FDF3E9`, `.hhead` is `#F9E7D2`, `.hlbl` is `#C2650F`.
  [CC-MEASURED] Either the criterion or the mockup is wrong; that is a §5.3 question for Cai.

---

## 4. Proposed build sequence — five builds

The prompt's 4a–4d is close. **Keep four, but move the CI-coverage work out of 4c and to the
front, because without it 4a measures the wrong thing and 4d cannot be verified at all.**
[CC-JUDGMENT]

The single reason: **the current harness renders 9 types × 1 instinct ordering, with an empty
`client_facing`.** A probe run on that fixture measures a page with no Z6 and only SX-primary
badges. Every budget it produced would be a floor, not a ceiling — the exact error §7.4 records
being made twice already.

### 4a — FIXTURE AXIS (new, first) — scope statement

*Amendment 1: stated precisely enough to build from, as asked.*

**Purpose.** Give `scripts/render_client.js` the two dimensions p10 needs and that nothing else in
the harness can supply. Today it renders **9 types × 1 instinct ordering** from a fixture whose
`client_facing` is `{}` (`tests/fixtures/anders_sx9_api_result.json`) — so a p10 probe run against
it would measure a page with no Z6 and only SX-primary badges. [CC-MEASURED]

**Files touched**
- `scripts/render_client.js` — the `client_v3` config gains an instinct axis alongside `types`.
- `tests/fixtures/` — profile and evidence variants (see below). No new *client* fixture: the
  model derives the subtype from `dominant_instinct_hypothesis` + `confirmed_type`, so the existing
  `anders_sx9` fixture plus overrides covers all 27. [CC-MEASURED]

**The instinct axis.** Three profiles, applied the way `types` is applied today — override
`hypothesis.instinct_score_profile` **and** `hypothesis.dominant_instinct_hypothesis` together, so
the badge order and the selected subtype cannot disagree:

| Case | `{SP, SO, SX}` | `dominant` | Exercises |
|---|---|---|---|
| `sp_primary` | `{84, 66, 64}` | `SP` | SP column highlighted; 9 SP subtypes |
| `so_primary` | `{64, 84, 66}` | `SO` | SO column highlighted; 9 SO subtypes |
| `sx_primary` | `{66, 64, 84}` | `SX` | today's fixture ordering; 9 SX subtypes |

3 × 9 = **27 renders, and all 27 subtype rows become the highlighted column at least once** — which
is what the build plan's PR 4 pass/fail already asks for and the current harness cannot deliver.
[CC-DERIVED]

**Named edge cases** (rendered, not necessarily in the 27-render matrix):
- `exact_tie` — `{70, 70, 70}`. Records what ships today; **expected to change** once §2.5 (a) is
  decided.
- `near_tie` — `{66, 64, 84}` is *already* a 2-point second/third gap, so today's fixture **is** the
  near-tie case. Name it as such rather than adding one. [CC-MEASURED]
- `missing_profile` — `instinct_score_profile` absent. **Today this silently renders "Leading =
  SP"** (§2.5). This case exists to pin that behaviour now and to go red when §5 item 1 is fixed.

**The Z6 axis.** `client_facing.instinct_evidence` in three states, because two producers emit two
shapes (§2.6):
- `sm_bullets` — 3 strings, worst case from `CMS_PREVIEW_WORST_EVIDENCE` (`app/server.js:13823`).
- `em_paragraph` — one string, the EM shape (`em_report_adapter.js:143`).
- `null` — the `low_instinct_confidence` path, so the empty state is a **rendered case** rather
  than the accident it is today.

**Explicitly out of scope for 4a:** no p10 renderer, no content, no gate change, no badge decision,
no fix to the silent-SP default (4d). 4a only makes those observable.

**Done when:** the three instinct profiles and three evidence states render through the existing
`client_v3` config on the pages that exist **today** (sheets 1–9, 12) with no change in output for
the `sx_primary` + `null` combination — i.e. the current baseline is byte-identical, and the new
axes are additive. That is the check that 4a changed the harness and not the report. [CC-JUDGMENT]

### 4b — PROBE

p10 skeleton at real column widths — Z1–Z3 static from the store AS-IS (so the §2.4 length gap is
*measured*, not argued), Z5 scaffold, Z6 populated from `CMS_PREVIEW_WORST_EVIDENCE` and from the
EM paragraph shape.

Method is settled — reuse `scripts/spike/explore_fit_probe.js`: real renderer, shared stylesheet,
pinned Chromium, Arial asserted, `Range.getClientRects()` merged by top edge, real prose grown word
by word, contentBox re-read after every mutation with WIDTH-UNSTABLE suppression.

**Output:** measured per-zone budgets for p10, stating the counting basis before any number is
published. **Do not reuse the p6/p7 bands.** Derived from the mockup, p10's comparison column is
roughly 207px of text width against p6/p7's wider pattern column [CC-DERIVED] — the probe must
measure it, and §6's `≤52 / 53–70 / 71–88` bands were taken at the other width.

**Lands:** a spike script and a measurements JSON. No content, no gate.

### 4c — CONTENT

Ingest the 27 rows against 4b's budgets, into the new `instincts_v3` field (§2.7) via an
`INTERIM_INSTINCTS_V3` constant. **Signature and narrative from the Doc** (third `·` element and
body respectively — mind the ingest hazard in §2.2A); **display names from
`reference/hive_27_subtype_reference.md`**, which is their only source (§2.3). `narrative`,
`tagline`, `patterns` and `shifts` are untouched. Recount every string at ingest.

**Gate, corrected per §3.1:** keep `shifts` required; add 27/27 presence for
`instincts_v3.signature` and `instincts_v3.narrative`; put the D4 negative assertion in the
**renderer** test, not the content build.

**Prove each new assertion fails before trusting it — in memory, touching no tracked file.**
`validateSubtype` takes the row object as an argument, so the proof is to `require` the library,
`delete` the field on a clone, call the validator and assert it throws. Same for the renderer
assertion: build the page HTML from a model, inject a shift-shaped block, assert red. No fixture is
edited and nothing is committed in the failing state. [CC-JUDGMENT]

### 4d — PER-CLIENT STRUCTURE

Z4 banner + Z5 badges + the badge decision from §2.5. Must render green across the 4a matrix —
SP/SO/SX primary — not just the fixture's SX.

Also fix the silent-SP default: absent/empty profile should throw.

### 4e — Z6

Only the cap and the two-shape reconciliation remain; the producer already exists. Counting basis
into the spec **before** the cap is implemented. PR 7's quote-budget reconciliation stays on its
own card and is not pulled in here.

**So: five builds, one of which (4a) is small and is the reason the other four can be trusted.**
An acceptable compression is to fold 4a into 4b — but then the probe and the fixture work land
together and a red probe has two possible causes. I would not. [CC-JUDGMENT]

---

## 5. Adjacent — named once, each its own card. Not PR 4.

1. **`instinctStack` returns "Leading = SP" for a missing or empty `instinct_score_profile`.**
   Correctness bug, own card. **Amendment 1 — the blast radius is wider than I wrote, and it is
   already shipping.** `static.contents[6]` renders `{subtype_label}` in the **v3 Contents page**,
   so page 2 of the staged Type 9 report reads *"…what it means to be a One-to-One Nine."* A client
   with a missing or empty profile therefore gets a **confident wrong subtype named on a page that
   ships today** — not merely a latent p10 risk. [CC-MEASURED, per Cai] Same card, wider radius.
   **Do not widen PR 4 to fix it.**
2. **`instinct_evidence` has two producer shapes** (3 bullets vs 1 paragraph) with no contract
   reconciling them. Own card — p10 can consume both, but the contract should be settled once.
3. **Spec §7.2's two stale p10 entries** (shift bullets, Leaning blocks) contradict ratified D4.
   Docs card. **Amendment 1 adds a third, in §7.1:** *"The three subtype comparison columns"* is
   listed under **Authored and approved** — and under the new Z5 model those columns are the thing
   being replaced. [CC-MEASURED] Strike all three in the same sweep, or the spec of record
   describes a page that is not being built.
4. **Build plan PR 4's "only orange element" criterion is falsified by the mockup it cites.**
   §5.3 question for Cai. Docs card.
5. **Live v2 p6 badges all three instincts** `Leading/Supporting/Growing` on a 2-point gap. If
   §2.5 is decided as I recommend, v2 has the same defect. Own card — do not widen PR 4 into v2.
6. **`docs/mockup_file_manifest.md` records a superseded
   `claude_The_Peacemaker_Page_Subtypes_v1.html`** — the second page from when Instincts &
   Subtypes was two pages. Worth confirming nothing in the content plan still assumes two.
7. **The Doc and `reference/hive_27_subtype_reference.md` disagree on the passion term for 18 of
   27 subtypes** (§2.3). [CC-MEASURED] Does not block p10 — passion is not a page field — but the
   reference file feeds Coach Prep Report guidance, so two reader-facing artifacts disagree. Own
   card.
8. **The build plan's PR 4 content prerequisite ("27 subtypes (Type-9's 3 exist) → 24 to author",
   plus "two-word signature: 27 (3 exist)") is stale** under the new Z5 model — all 27 signatures
   and narratives now exist in the Doc. Docs card, same sweep as item 3.

---

## 6. Open questions I cannot resolve from the repo

1. ~~**Does Google Doc `1_M7tvK1I-…` supersede the store's 27 narratives, or is it a parallel
   draft?**~~ **RESOLVED — Amendment 1.** It is the p10 replacement content, and it does **not**
   supersede the store's `narrative`, which stays as v2's. New field per §2.7. Per §7.4's
   convention the Doc ID should be recorded in the spec when the content lands.
2. ~~**Given the Doc's narratives are the wrong shape for Z5, what is the Doc actually for?**~~
   **RESOLVED — Amendment 1.** The Doc is not the wrong shape; the mockup is being changed to fit
   the Doc.
3. **Z3 AS-IS or edited?** The build plan says AS-IS; the store text is ~40% longer than the cards
   were fitted to. 4b measures the cost; the choice is Cai's.
4. **Z2: re-author the primer to carry a type token, or drop the token and use the store string?**
   §2.4. Not mine to pick.
5. ~~**Do the three Type 9 signatures and comparison zones in the mockup count as authored, or as
   Claude-authored-pending-review?**~~ **MOOT — Amendment 1.** The comparison zones are being
   replaced, and all 27 signatures now come from the Doc, so nothing depends on the mockup's three
   being ratified. The **display names** still do depend on a single unreviewed source (§2.3) —
   that is the residue of this question, and it is item 9 below.
6. **Badge decision (§2.5)** — reopens a build-plan line, so it needs an explicit yes or no.
7. **Historical assessments:** I established that `dominant_instinct_hypothesis` is a late-added
   nullable column and `instinct_score_profile` is conditionally written. I could not measure
   **how many** stored assessments actually lack them — that needs a query against production,
   which I did not run. Given §5 item 1's widened radius, this now bears on a page that ships.
8. **Does the Doc's content need Mo's sign-off before ingest, or is it already locked?** The Doc
   carries a character-limit instruction at the top but no lock marker. §7.2's post-lock correction
   warns that a lock line was deliberately removed from a p6/p7 source during cleanup and *"do not
   expect the doc to corroborate this"* — so the absence of a marker proves nothing either way.
   [CC-MEASURED] Someone who knows has to say.
9. **Is `reference/hive_27_subtype_reference.md` ratified for the 27 display names?** It calls
   itself a *"Draft reference"* in its own header. [CC-MEASURED] It is now the only source for
   `.cname` (§2.3), so its status matters more than it did when it was one of two agreeing votes.

---

## 7. Where I think the counterproposal is still wrong *(Amendment 1)*

Asked directly, so answered directly. Three things, in descending order of how much they matter.
None of them changes the Z5 decision, which I accept. *(Lettered, not numbered — this document
already cites spec §7.1–§7.4 and a second §7.x would be one more collision in an audit about
collisions.)*

### 7a "Signature ← Google Doc tagline" — the Doc has no field called a tagline, and the wrong segment is easy to grab

Counterproposal §1 sources the signature from the *"Google Doc tagline"*. The Doc has no tagline
field. Its header line is **three** `·`-delimited elements — `SP9 · Appetite · Comfort & Routine` —
and the signature is the **third**. The second is the passion term, which the same §1 correctly
excludes from the page. [CC-MEASURED]

This is terminology, not a decision error, and it would be pedantic except that "tagline" is a
**live field name on the same 27 rows** (`subtype_*.tagline`, v2's, 57–85 chars, and the place the
display name is currently embedded). Two different things called "tagline" on one row, with an
ingest parser being written against the Doc, is how the wrong string lands in all 27. Flagged as an
ingest hazard in §2.2A. [CC-JUDGMENT]

### 7b "This resolves your §6.2 and half of §6.1" — it resolves both, and opens two more

§6.1 is fully resolved, not half: the Doc neither supersedes nor is a parallel draft — it lands in
a new field, which is a third answer neither of my options offered. Minor.

What is not minor: the decision **creates** two open questions that did not exist before, and I
have added them as §6 items 8 and 9. The Doc carries no lock marker, and §7.2 of the spec is on
record that a missing lock marker proves nothing on this project. And
`reference/hive_27_subtype_reference.md` — which calls itself a *"Draft reference"* — went from
being one of two agreeing sources for the display names to being **the only one**, because the Doc
contains none. [CC-MEASURED] Neither blocks 4a or 4b. Both should be answered before 4c ingests.

### 7c The probe reasoning is right, and I can sharpen one thing in it

§3 is correct and I am not contesting it: character count does not predict line count, the net
vertical effect is unknown, and 4b must probe the real shape. Two measured refinements:

- **The delta is not uniform across the three columns of one page.** SP9 +29, SO9 +87, SX9 +92
  (§2.2A). The tallest column sets the row height, so a probe that measures one column and
  generalises would repeat the single-example error §7.4 records. Probe the triple.
- **But the nine types are unusually uniform**, which is good news. Each type's tallest column
  falls in a **12-character band, 382–394**. [CC-DERIVED] On p6/p7 the types diverged widely and a
  single-type probe genuinely could not answer "does this page fit". Here it nearly can: Type 5
  carries the global worst column (SO5, 394) and is only 12 characters above the mildest type.
  **This does not license skipping the other eight** — it means a Type 5 pass is strong evidence
  and a Type 5 failure is conclusive, which is a better position than p6/p7 was ever in.
  [CC-JUDGMENT]

### 7d Not wrong, but worth saying plainly

Both of my §2.2 findings that this decision voided were **correct about the artifact and wrong
about the intent**. I measured the mockup accurately and then reasoned about what to build from it,
without knowing the mockup was the thing being changed. The measurement stands; the inference did
not. That is a failure mode worth naming, because §7.4 of the spec records the same class of error
twice — reasoning forward from an artifact whose status was not established first. [CC-JUDGMENT]

---

# AMENDMENT 2 — 6 Sep 2026

**Scope:** audit of the revised build sequence, the §3 Naranjo checks, the fork pricing and the
Z6 placeholders. No build, no ingest, no renderer change, no gate flipped. Working tree clean
apart from this file.

**Main has not moved.** `origin/main` and local `main` are both `9285751`, and `9285751` is still
an ancestor of this branch's HEAD. Nothing to pull. [CC-MEASURED]

**The Doc was re-read by ID today** (`1_M7tvK1I-5bJw0JjDF4xpTRAEPgpyeWkGCQea6nH364`), not by
title, and re-parsed from scratch. 27/27 rows present; the header triples and stated counts match
what Amendment 1 recorded. Its title is *"Subtype Narratives — **p8** Instincts & Subtypes —
Content for Review"* — it carries the §1 numbering collision in its own title, and the words
"Content for Review" in it. [CC-MEASURED]

Tags as before: **[CC-MEASURED]** read out of the repo or executed · **[CC-DERIVED]** arithmetic on
measured values · **[CC-JUDGMENT]** my read.

**Letter → number mapping**, as asked: my `4c` → **step 1**, `4a` → **step 2**, `4b` → **step 3**,
`4d` → **step 4**, `4e` → **step 5**.

---

## A2.1 The re-order — ACCEPTED, with one amendment to what step 1 ingests

### 2a — Orthogonal. Content-first violates nothing the fixtures-first argument was protecting

My fixtures-first argument protected **the probe**, not the content. The claim was narrow: a probe
run on today's harness measures a page with no Z6 and one badge ordering, and publishes floors as
ceilings. The revised order keeps **fixtures (2) before probe (3)**, so that protection is intact
and untouched. Content ingest touches `build_content_library.js`, the store and the CMS; it touches
nothing in `scripts/render_client.js`. The two axes do not interact. [CC-JUDGMENT, on measured
file boundaries]

There is also measured precedent for content landing in the store ahead of a renderer that reads
it. **663 of 1979 leaves in the committed library already come from `INTERIM_*` constants**,
including **360 leaves of sheets 6–7 Exploring content for pilot types only**. [CC-MEASURED]
Content-in-store-before-full-renderer is the established pattern on this project, not a new risk.

**One thing genuinely changes, and it should be on the record.** My 4c said "ingest the 27 rows
*against 4b's budgets*". Under 1b there are no budgets at ingest. The probe's role therefore
changes from *producing the budgets content must meet* to *diagnosing content already committed*.
That is a consequence of 1b, not of the re-order, and 1b accepts it — but it means step 3's output
must not later be read as a gate the content passed. It will not be one. [CC-JUDGMENT]

### 2d — One thing beyond the assertion, and it is a number nobody has

`cmsWordBudget` (`app/server.js:~10023`) returns **`0`** for a key it does not recognise — no budget
shown in the editor. Step 1 exposes `instincts_v3` in the CMS (touchpoints 1–3 of §2.7), so step 1
must either publish a word budget for the narrative leaf or ship the field with none.

A budget is a fit claim. Step 1 cannot derive one — only the probe can. So the choice is:

- **(a)** publish a budget derived from the 345–415 band — a [CC-DERIVED] number shown to editors as
  a limit, which is exactly the floors-as-ceilings move §7.4 records twice; or
- **(b)** leave it `0` until step 3, and ship a CMS field with no budget for one step.

**I would take (b).** It is honest, it is reversible, and a missing budget is visible where a wrong
one is not. Either way, name the choice — it is currently unnamed. [CC-JUDGMENT]

`cmsPreviewSpec` (§2.7 #4) is *not* a second instance of this: leaving `instincts_v3` unmapped and
suppressing the Preview control is renderer-independent and lands cleanly at step 1. [CC-MEASURED]

### 2e — Counter: keep five steps; change what step 1 ingests

**Ingest the passion term at step 1 regardless of how the §3 fork is decided** — i.e. build the
option-B *data* shape — and decide render-or-not at step 4.

The reason is a measured live-path hazard, not a preference.

`assertOverrideShape` (`app/content_overrides.js:159`) throws when a published override's shape no
longer matches the library field it replaces. The deploy-order warning above it (`:117`) records
what that throw reaches:

> *"This throw reaches EVERY report render, including the dry-validate probe in `/api/submit`. A
> mismatched row therefore fails assessment submission, not just a PDF."* [CC-MEASURED]

Step 1 as proposed puts `instincts_v3` into the CMS. If the fork later resolves to **A**,
`instincts_v3` gains a third leaf, and **any override published against the two-leaf shape becomes
a shape mismatch on a live path.** The remedy exists (`npm run overrides:check` as a pre-deploy
gate, retire or re-publish the rows) but the hazard is created purely by ordering. [CC-MEASURED
mechanism; CC-JUDGMENT that the ordering creates it]

Two ways to avoid it, both acceptable:

- **(i) Ingest the superset shape at step 1** — `{signature, narrative, passion}`. The shape then
  never changes; A and B differ only in whether the renderer reads the leaf. Priced in A2.5.
- **(ii) Hold the CMS touchpoints out of step 1** and land them at step 4 once the shape is final.
  Step 1 ships content + gate only.

**I'd take (i).** The 27 values are already in the Doc, so it costs no authoring, and it settles the
data question before the CMS can form an opinion about it.

**Caveat — (i) is not neutral.** Ingesting the Doc's passion term silently resolves the 18-of-27
divergence (A2.4) in the Doc's favour. If it is stored, the `INTERIM_INSTINCTS_V3` comment must
record that the value is the Doc's and that `reference/hive_27_subtype_reference.md` differs on 18
of 27 — otherwise the store becomes a *fourth* artifact and the divergence gets harder to see, not
easier. [CC-JUDGMENT]

**Five steps, not four or six.** Nothing in the revised order wants merging, and nothing in it is
doing two jobs. My Amendment-1 objection to folding the fixture work into the probe still applies
and is now moot anyway, since they are separate steps.

---

## A2.2 The renderer assertion lands at **step 4**, not step 3

**Two reasons, and one trap that matters more than either.**

**1. Step 3's page is a spike artifact, not the shipped renderer.** My own 4b scope says step 3
lands *"a spike script and a measurements JSON. No content, no gate."* A negative assertion is only
meaningful against the artifact that could actually violate it. The spike cannot emit a shift zone
because nothing in the spike would ever produce one — it has no access to the model path that
carries `subtype.shifts`. Asserting D4 there proves the spike author's restraint, not the
product's. [CC-JUDGMENT]

**2. The thing that could violate it is born at step 4.** `V3_PAGE_BUILDERS`
(`app/renderer.js:3749`) has no `instincts` entry today. [CC-MEASURED] `subtype.shifts` sits on the
same row a builder would read, and `report_prep.js:375` already feeds it to a different page
(`renderer.js:2347`, live v2 p7). Step 4 is the first moment a real emitter holds both the page and
the field.

### The trap — name it before the assertion is written

**"The emitted `v3-inst-` page contains no shift zone" passes vacuously if the page is not emitted
at all.** Since `V3_PAGE_BUILDERS` has no `instincts` entry today, **that vacuous pass is the
current state**: the assertion would be green right now, before the page exists. A negative gate
that is green before the work starts is not a gate. [CC-MEASURED premise, CC-JUDGMENT conclusion]

It needs a positive precondition in the same test:

1. assert the `v3-inst-` page **is present** in the emitted document, then
2. assert it carries no shift zone and no "Leaning Into the Other Instincts" block.

`tests/lib/report_page_inventory.js` already asserts one-of-each-page and is the precedent for
half (1). [CC-MEASURED]

**Proof-of-failure — two red proofs, because the assertion has two halves.** In memory, touching no
tracked file: (a) build the page HTML from a model, inject a shift-shaped block into the model,
assert red; (b) remove the `instincts` builder entry and assert the presence half goes red. A single
proof covering only (a) would leave the vacuous-pass hole open. [CC-JUDGMENT]

**The content-library half stays at step 1, unchanged and agreed.** `validateSubtype` takes the row
as an argument, so the proof is: `require` the library, clone a row, `delete` the field, call the
validator, assert it throws. `shifts` stays REQUIRED. [CC-MEASURED]

---

## A2.3 Rework the re-order creates that has not been named

Named, not priced. Five items; the first two are certain, the rest are conditional.

**1. `verify_content_library.js` `SCRIPT_SOURCED` — and it fails silently.**
Measured today, green: reproducible, `committed library == build(Word source)`, **1316/1979 leaves
Word-canonical, 663 from `INTERIM_*` constants.** [CC-MEASURED] `INTERIM_INSTINCTS_V3` adds **54**
leaves (2 per subtype) or **81** (3 per subtype, superset shape). The table is **printed, not
asserted** (`verify_content_library.js:236–241`) — omitting the entry does not fail CI, it silently
understates the Word-canonical denominator. The file's own comment names this exact failure mode:
*"pinning one while eight more land is how this table silently stops counting."* [CC-MEASURED]
**Work:** one `SCRIPT_SOURCED` entry with a `retires` line.

**2. The ingest cannot be a JSON edit.**
`verify_content_library.js` asserts `content_library.json == build(docx + INTERIM_*)`, it is green
today, and the docx digest matches the committed `_meta.source_sha256` exactly
(`3fb8e971…62175`). [CC-MEASURED] So step 1 is: edit `build_content_library.js`, rebuild, commit
both. **A hand-edit of `content_library.json` fails CI in the PR that makes it.** *(This corrects a
stale note I was carrying — A2.7.)*

**3. CMS override masking, if step 3 forces a re-author.**
Overrides carry **no base snapshot and no staleness detection**; `resolveLibObject` replaces a field
WHOLE. A *same-shape* correction — new narrative text, same two leaves — produces no shape mismatch,
so a row published between step 1 and step 3 **silently masks the corrected text**, with no warning
and no throw. [CC-MEASURED] **Work:** if content is re-authored after step 1, audit and retire
`instincts_v3` override rows by hand. Nothing does this automatically.

**4. Shape change on a live path** — A2.1/2e above. `assertOverrideShape` throws at render, and that
throw reaches `/api/submit`'s dry-validate probe. **Work:** `npm run overrides:check` against the
target DB before deploying any shape change, and retire offending rows first. [CC-MEASURED]

**5. A `cmsWordBudget` number must be chosen at step 1** — A2.1/2d. Either derived-and-published, or
`0`. Both are work; neither is currently scheduled.

**Fixture churn: none found.** Step 2's axes are `instinct_score_profile`,
`dominant_instinct_hypothesis` and `client_facing.instinct_evidence`. None of them reads
`instincts_v3`. Step 1 does not move step 2's work. [CC-MEASURED]

---

## A2.4 The §3 checks

### (i) The full 18-of-27 divergence — Doc vs `reference/hive_27_subtype_reference.md`

Re-derived from a fresh parse of both. **18 diverge, 9 identical** — matching Amendment 1's count
exactly. [CC-MEASURED]

| Code | Doc passion | ref passion | | Structural class |
|---|---|---|---|---|
| SP1 | Worry | Anxiety | **DIVERGE** | distinct word |
| SO1 | Non-Adaptability | Inadaptability | **DIVERGE** | distinct word |
| SX1 | Zeal | Zealousness | **DIVERGE** | shared stem |
| SP2 | Privilege | Entitlement | **DIVERGE** | distinct word |
| SO2 | Ambition | Ambition | same | — |
| SX2 | Seduction | Seduction / Aggression | **DIVERGE** | **ref is superset** |
| SP3 | Security | Material Security | **DIVERGE** | **ref is superset** |
| SO3 | Prestige | Prestige | same | — |
| SX3 | Charisma | Charisma | same | — |
| SP4 | Tenacity | Dauntlessness / Recklessness | **DIVERGE** | distinct word |
| SO4 | Shame | Honor / Shame | **DIVERGE** | **ref is superset** |
| SX4 | Competition | Competitiveness | **DIVERGE** | shared stem |
| SP5 | Castle | Home | **DIVERGE** | distinct word |
| SO5 | Totem | Symbols | **DIVERGE** | distinct word |
| SX5 | Confidence | Confidentiality | **DIVERGE** | shared stem |
| SP6 | Warmth | Warmth | same | — |
| SO6 | Duty | Duty | same | — |
| SX6 | Strength/Beauty | Strength / Beauty | **DIVERGE** | **whitespace only** |
| SP7 | Keepers of the Castle | Family | **DIVERGE** | distinct word |
| SO7 | Sacrifice | Sacrifice | same | — |
| SX7 | Suggestibility | Suggestibility | same | — |
| SP8 | Satisfaction | Assured Survival | **DIVERGE** | distinct word |
| SO8 | Solidarity | Friendship | **DIVERGE** | distinct word |
| SX8 | Possession | Possession / Surrender | **DIVERGE** | **ref is superset** |
| SP9 | Appetite | Appetite | same | — |
| SO9 | Participation | Participation | same | — |
| SX9 | Fusion | Union | **DIVERGE** | distinct word |

Breakdown of the 18: **10 distinct word · 4 ref-is-superset · 3 shared stem · 1 whitespace-only.**
[CC-MEASURED] This is what falsifies the "de-Naranjo'd in every case" reading — see A2.7.

Doc passion terms measure **4–21 chars, mean 9.2**; the longest is SP7 `Keepers of the Castle` (21).
Doc signatures re-measure **12–25, mean 19.0**, max still SO9 `Belonging & Participation` (25),
unchanged from Amendment 1. [CC-MEASURED]

### (ii) Is any Naranjo term stored in the content library today? **No. Nowhere, under any field.**

- Subtype rows carry exactly `code, name, tagline, narrative, patterns, shifts`. **No passion field**,
  and no field name matching `/passion|naranjo/i`. [CC-MEASURED]
- As a standalone field **value**: **0/27** for the Doc's terms, **0/27** for the ref's. [CC-MEASURED]
- Seven Doc terms appear *incidentally inside their own row's prose* — Worry, Charisma, Shame,
  Castle, Warmth, Duty, Sacrifice — and **SP5's "Castle" hit is the display name "The Castle
  Defender", not the passion.** None is a stored term. [CC-MEASURED]

**So fork C is the status quo, and A and B both introduce the passion term to the store for the
first time.** That is worth stating plainly: this is not a migration, it is an addition.

### (iii) Consumers of the ref file's passion terms: **there are none**

- **No code path reads `reference/` at all.** `grep -rn "reference/" app/ scripts/ tests/ spec/`
  returns nothing. [CC-MEASURED]
- The file is named only in prose: `README.md:45`, three `docs/` files (all about an unrelated
  Type 6 naming fix), and my own audit. [CC-MEASURED]
- **`easy_to_miss` — the Coach Prep Report field the ref file says it feeds — is AI-generated at
  runtime** from a prompt instruction (`app/server.js:4871`, schema `:4995`), then rendered at
  `renderer.js:555`. It is not read from the file. [CC-MEASURED]
- Every ref-only passion term — `Assured Survival`, `Material Security`, `Dauntlessness`,
  `Zealousness`, `Inadaptability`, `Competitiveness`, `Honor / Shame`, `Possession / Surrender`,
  `Seduction / Aggression` — appears **only in the ref file itself**, nowhere else in the repo.
  [CC-MEASURED]

**This inverts my §5 item 7 a second time, and the correction is mine.** I filed that item on the
file's own self-description — *"Draft reference for inclusion in the Hive AI Prompt Spec… gives the
engine guidance for Section 4 of the Coach Prep Report"* — which is a statement of **intent that
was never implemented**. The file is a leaf document with zero machine consumers. Nothing
downstream breaks whichever way the divergence is resolved, and the card should say so rather than
implying a reader is currently seeing the ref's terms. **Change none of them** — I have not.

### Display-name sanity diff — mismatch-only, as offered

**5 of 27 mismatch**, and the disagreement is not random. [CC-MEASURED]

| Code | repo file **and** store tagline | project docx |
|---|---|---|
| SP2 | The Family Nurturer | The Nurturer |
| SP3 | The Diligent Worker | The Company Person |
| SX3 | The Star | The Movie Star |
| SP7 | The Epicure | The Gourmand |
| SX8 | The Director | The Commander |

The store's 27 taglines contain the **repo file's** name **27/27** and the **project docx's** name
**22/27**. [CC-MEASURED] Counter-type markers agree **5/5** (SX1, SP3, SP4, SX6, SO7). Nothing was
ingested from the table. Consequences in A2.7.

### One ingest hazard I did not see in Amendment 1

The Doc's header lines are **not uniformly formatted**. Types 8, 9, 1 and 2 (12 rows) carry a plain
header; types 3, 4, 5, 6 and 7 (15 rows) carry a **bold** header with the em-dash character count
*outside* the bold run. The type order in the Doc is **8, 9, 1, 2, 3, 4, 5, 6, 7**, not 1–9, and the
trailing "Spread:" lines vary (`Spread: 4 chars` / `Spread:4 chars` / `Spread: 21 char`).
[CC-MEASURED] A parser keying on formatting rather than on the `·` structure splits **12/15**.
Add this to the §2.2A ingest-hazard note; the third-element rule remains the safe one.

---

## A2.5 The fork, priced

### Common to A and B — the data half

| Item | Cost | Tag |
|---|---|---|
| `INTERIM_INSTINCTS_V3` gains a third leaf per row | 27 values, **already in the Doc — no authoring** | [CC-MEASURED] |
| `validateSubtype` | +1 `need(...)` line | [CC-MEASURED] |
| `verify_content_library.js` `SCRIPT_SOURCED` | 54 → **81** leaves | [CC-DERIVED] |
| **CMS field count** | **UNCHANGED — 135** | [CC-MEASURED] |
| `cmsWordBudget` | **+1 path branch** (2 → 3) | [CC-MEASURED] |

**The CMS field count does not move, and that is the load-bearing number here.** `instincts_v3` is
one top-level field regardless of how many leaves it holds; `CMS_SUBTYPE_FIELDS`
(`server.js:9893`) and `cmsIsValidSubtypeKey` (`:9900`) both key off the top-level field name. So
**27 × 5 = 135 under A, B and C alike** — the §2.7 figure stands unchanged, and **the passion term
costs zero CMS fields.** [CC-MEASURED]

`cmsWordBudget`'s subtype block keys off the field suffix and notes *"all leaves of a unit share
it"*. `instincts_v3` needs a **path-branched** clause either way, because signature and narrative
want different budgets — `static.instinct_definitions` is the precedent, branching `/^\d+\.name$/`
against `/^\d+\.body$/`. So the branch count is **2 under B/C-shape, 3 under A**: one extra line, not
one extra field. [CC-MEASURED]

### A only — the render half

- **Slot.** Under the one-narrative Z5 the column is `.cname` (display name) → `.cline` (signature)
  → narrative. The passion is a **fourth** element, and it is a label, not prose, so it belongs in
  the header cluster — immediately after `.cline`, or between name and signature. It does not belong
  above the narrative. [CC-JUDGMENT]
- **Probe column content.** +1 rendered line. Max 21 chars (SP7), mean 9.2, min 4 — comfortably one
  line at the ~207px column width I derived for Z5. Because **all three columns gain the same one
  line**, the delta is uniform: **+1 line box, not +3.** That is the cheapest possible vertical
  addition — and it is still a real addition to a page whose fit is unmeasured. [CC-DERIVED]
- **One more string on the page that the repo's other artifact disagrees with on 18 of 27.**
  [CC-MEASURED]

### B only

The leaf is stored and CMS-editable but rendered nowhere: **an editor gets a field whose edits do
nothing.** Same class of wart as the unmapped Preview control (§2.7 #4), and the same remedy — label
it or suppress it, honestly. [CC-JUDGMENT]

### C

Zero cost. My original §2.2(1) finding stands, and the Doc's second header element is parsed and
discarded at ingest.

### Preference (not a finding — the fork is Cai's)

**B as the step-1 data shape, with A or C decided at step 4.** It costs 27 leaves already written,
one budget branch and zero CMS fields; it takes the fork off step 1's critical path; and it makes
the shape final before the CMS can form an opinion about it, which is what matters per A2.3 item 4.
Conditional on the divergence being recorded in the constant's comment. [CC-JUDGMENT]

---

## A2.6 The placeholders

### EM nominal — the mockup's `.resp-txt`: right choice, confirmed

**333 chars, 51 words, 2 sentences.** [CC-MEASURED] Confirms the prompt's 333/51 exactly. It is the
right nominal precisely because it was authored for this fixture. Note it is **2** sentences — the
floor of the EM producer's own "2–3 sentences" (`app/experimental_analysis.js:613`), not the middle.

### EM stress — the arithmetic is right, but this is not the stress case

The Claude draft measures **exactly as stated: 416 chars, 66 words, 2 sentences, +83 over nominal.**
[CC-MEASURED] No correction to the numbers.

**But there are better cases already in the repo, and they are much larger.**
`tests/fixtures/sp4_api_result.json` and `tests/fixtures/sx7_api_result.json` each carry a real
`instinct_personal_overlay` — the exact field `em_report_adapter.js:143` maps into
`instinct_evidence`:

| Fixture | chars | words | sentences | paragraphs |
|---|---|---|---|---|
| `sx7_api_result.json` | 607 | 109 | 4 | 2 |
| **`sp4_api_result.json`** | **777** | **122** | **5** | **3** |

[CC-MEASURED] `sp4` is **87% larger than the Claude draft**, and unlike it, **multi-paragraph**.
`_toEvidenceArray` (`em_report_adapter.js:57–65`) wraps the whole string as **one** element, so Z6
receives a single ~777-char run-on bullet.

Two things follow.

- **Use `sp4_api_result.json`'s overlay as the EM stress case.** It is real, production-shaped,
  already tracked, and it answers §1b's own objection to invented filler on exactly that ground —
  the spike method grows real prose, and this is real prose.
- **The sentence instruction does not bound the length.** `sp4` is **5 sentences under a "2-4
  sentences" instruction** (`app/server.js:4806`). [CC-MEASURED] So "2–3 sentences with no character
  bound" is not a soft constraint that happens to land near 400 — the only two real samples in the
  repo land at 607 and 777.

Keep 416 if a mid-point is useful, but label it a mid-point, not a stress case. **I am not proposing
a budget** — the real upper end still falls out of the probe, as §4 says.

### SM shape — `CMS_PREVIEW_WORST_EVIDENCE` is the right choice, with one correction

3 bullets: **185 / 193 / 190 chars — 27 / 29 / 28 words.** [CC-MEASURED]

**All three exceed the ≤25-word cap they are meant to represent.** The producer contract is "exactly
3 short bullets, ≤25 words each" (`server.js:4828`), and `scripts/verify_phase1_fields.js:20`
asserts it — while the constant's own comment claims "~25 words each". As a *fixture* that is fine,
arguably better, since it over-stresses. But **label it**, or a budget derived from it is derived
from a shape the producer cannot legally emit. Total prose **568 chars**; a spec-conformant worst
(3 × 25 words) is **~450**. [CC-DERIVED]

**This also corrects my own §2.6**, where I wrote "roughly 450 chars" for the SM worst. 450 is the
spec-conformant figure; the constant actually in the repo is 568.

### Null shape — yes, and it is the only one of the four reachable in CI today

`anders_sx9_api_result.json` has `client_facing: {}`, so `instinct_evidence` is `undefined`.
[CC-MEASURED] Making it a rendered case rather than the accident it is today is right, and it is
the one placeholder that needs no sourcing decision.

### Ordering, with a caveat

By **prose characters**: sp4 EM 777 > sx7 EM 607 > SM worst 568 > Claude draft 416 > mockup 333 >
null 0. [CC-MEASURED] **Prose characters do not order rendered height** — SM's 568 is spread across
three bullet rows, each with its own leading and marker, so it may well render taller than a
607-char single paragraph. The probe measures that; do not infer it from this list. [CC-JUDGMENT]

---

## A2.7 Where §1–§4 is wrong

Asked directly. **Yes — a third, and it is in §3, the section correcting me.** Plus a fourth in the
same section, and three of my own.

### Third: "In every case the DOC carries the Naranjo term and the REF FILE carries a plain-English substitute"

True of three of the four examples cited. **Not true across the 18.** [CC-MEASURED] Four of the 18
are not substitutions at all:

- **SX6 is whitespace only** — `Strength/Beauty` vs `Strength / Beauty`. Nothing is substituted.
- **In four cases the ref carries MORE than the Doc, and the Doc's value is a subset of the ref's:**
  SX2 `Seduction` ⊂ `Seduction / Aggression`; SX8 `Possession` ⊂ `Possession / Surrender`;
  SO4 `Shame` ⊂ `Honor / Shame`; SP3 `Security` ⊂ `Material Security`. Here the **ref is the fuller
  term and the Doc is the truncation** — the opposite direction from the one the claim describes.
- **Three are morphological variants of one stem** (SX1 Zeal/Zealousness, SX4
  Competition/Competitiveness, SX5 Confidence/Confidentiality), where neither is plainer English
  than the other.

Only **10 of 18** have the "distinct word" shape the claim generalises from — and all four cited
examples are drawn from those 10.

**What survives, and what I would drop.** The *conclusion* is unaffected: the Doc is authoritative
for this field and the ref file is not a supply for it. That rests on the Doc being the content of
record, not on a theory about how the ref file was produced. **Keep the conclusion, drop the
theory.** [CC-JUDGMENT]

**What the theory would have cost if acted on:** if "the ref is de-Naranjo'd" were taken as a rule,
the natural cleanup is to overwrite the ref's terms from the Doc — which in four cases **deletes the
second arm of a pair the Doc never carried.** That is a live risk, not a hypothetical one, because
the ref file has no consumers to object (A2.4 iii) and the deletion would be invisible. [CC-JUDGMENT]

I am not qualified from the repo to say which of the two is Naranjo's own term — that is scholarship,
not measurement, and I have not published a view on it. The structural finding above needs no such
view: a whitespace difference and a ref-is-superset case are not substitutions under any reading.

### Fourth: "display nicknames are SETTLED. Four attesting artifacts"

The mismatch-only diff was offered as a sanity check. **It returns 5 of 27, and two of the four
attesting artifacts attest to a different set of names than the third.** [CC-MEASURED]

The repo file and the store's 27 taglines agree with each other **27/27** and disagree with the
project docx on **5/27** — table in A2.4. I cannot check the fourth artifact; O'Hanrahan's handbook
is not in the repo, and the prompt marks it [CLAUDE-MEASURED] for 15 of 27. **It would be worth
knowing whether those 15 include any of these 5.**

**One tiebreak I can measure: the Doc's own prose backs the repo file on SP7.** SP7's narrative reads
*"The true 'epicures' of the Type 7 subtypes"* — repo and store say **The Epicure**, the docx says
*The Gourmand*. SX5's narrative likewise says *"sometimes known as 'secret agents'"*, and there all
three agree. [CC-MEASURED]

**This does not reopen the decision.** The names are settled, I accept that, and my open question 9
is closed as instructed. **The build is unaffected** — the repo file remains the supply and the store
already agrees with it 27/27. The correction is to the *claim*: the four artifacts are not
unanimous, and the project docx is the odd one out on five. Left unrecorded, the next person to open
that docx re-opens this. New open question 10.

### Three of my own

- **§2.7 named the wrong build source.** I wrote that the builder reads
  `InsightOut_Static_Content_Library_Subtypes_v1_3_060726.docx`. It reads
  **`docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx`**, the only docx in that
  directory. [CC-MEASURED] The `INTERIM_*` route in §2.7 is unaffected; the filename was wrong.
- **§5 item 7 was filed on an unverified consumer claim** — A2.4(iii). The ref file has no consumers.
  I took its self-description for an implemented path and did not check.
- **§2.6's "roughly 450 chars" for the SM worst** — A2.6. 450 is the spec-conformant figure; the
  constant in the repo is 568.

### Not wrong, but recorded as asked

**1b's provenance: not hunted, and I did not trip over it.** Nothing I read today touched the origin
of the 345–415 band.

**Mo's review.** Recorded on the standing decision, as instructed: review is **deferred** — she edits
in the CMS before beta, not in this workstream, and content ships to beta without her review, trigger
*"CMS update complete."* The Doc is treated as ingestable on that decision, not on a lock marker.
Flagged here so it is on the record and correctable. Worth one note against it: the Doc's **title**
ends *"— Content for Review"*. [CC-MEASURED] That is not a lock marker either way, and per §7.2's
precedent I draw no inference from it — but it is the only status-shaped string the Doc carries, and
whoever confirms the standing decision should see it.

---

## A2.8 Open questions — updated

### Closed

- ~~**6. Badge decision.**~~ **CLOSED by 1a.** All three badges. My §2.5 recommendation is rejected
  and I accept it; the build plan's pass/fail line stands. **§5 item 5 closes with it** — v2 is
  correct as shipped, no card.
- ~~**8. Does the Doc need Mo's sign-off before ingest?**~~ **CLOSED** by the standing deferred-review
  decision. Recorded in A2.7.
- ~~**9. Is `hive_27_subtype_reference.md` ratified for the 27 display names?**~~ **CLOSED by 1a.**
  Superseded by question 10 below, which is about a different thing — not whether the names are
  settled, but which artifact the settlement names.
- ~~**§5 item 7's framing**~~ — resolved by measurement, A2.4(iii). The card stays; its rationale
  changes.

### Still open, unchanged

- **3. Z3 AS-IS or edited?** (§5a) · **4. Z2 token or no token?** (§5b) · **7. How many stored
  assessments lack the instinct fields?** — still needs a production query I have not run.

### New

- **10. Which artifact supplies the display names, given the project docx disagrees with the repo
  file and the store on 5 of 27?** The build is unaffected; the docx is in circulation. One line
  settles it. [A2.7]
- **11. The fork — A, B or C.** Priced in A2.5. My counter is that its **data** half should be
  settled before step 1 regardless of the render half, for the override-shape reason in A2.3 item 4.
- **12. Does step 1 publish a `cmsWordBudget` for the narrative leaf, or leave it `0` until the
  probe?** [A2.1/2d]
- **13. If the passion term is stored, does the store record that it is the Doc's value and that the
  ref file differs on 18 of 27?** Otherwise the store becomes a fourth artifact. [A2.5]

### Carried, unwidened

**`instinctStack` has no tie-break and returns a confident "Leading = SP" for a missing or empty
`instinct_score_profile`.** Per 1a, with all three badged this now prints a **fabricated full
stack** rather than one wrong word, and it already names a wrong subtype on the v3 Contents page
today. **Own card. PR 4 is not widened to fix it.** [§5 item 1, sharpened]
