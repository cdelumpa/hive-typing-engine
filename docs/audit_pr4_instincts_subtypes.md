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
