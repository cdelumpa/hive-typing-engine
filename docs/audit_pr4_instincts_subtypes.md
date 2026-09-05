# Audit — PR 4, Instincts & Subtypes

**Branch:** `pr-4-instincts-audit`, off `main` @ `9285751b7a7274d5e5d8af56821a00734b34e20f`
(`9285751` — "Merge pull request #85 from cdelumpa/pr-3f-gate-hard"), pulled 4 Sep 2026.
**Nature:** audit and proposal. No page content, no gate flipped, no renderer change.

Every claim is tagged **[CC-MEASURED]** (read out of the repo or executed), **[CC-DERIVED]**
(arithmetic on measured values), or **[CC-JUDGMENT]** (my read — not evidence).

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

### 2.2 Where the proposal's field model is wrong — measured against the mockup

I extracted every text node and every CSS rule from
`docs/mockup/claude_The_Peacemaker_Page_Instincts_v1.html`. [CC-MEASURED]

**The proposal's PER-SUBTYPE tier (§2.2: "27 rows, 5 fields each … narrative (one paragraph)") does
not match the page.** Z5 is not one narrative per subtype. Each column carries **three separately
labelled prose blocks** under fixed headings:

| Mockup class | Field | n | chars (min–max) |
|---|---|---|---|
| `.cname` | display name — "The Collector" | 3 | 10–24 |
| `.cline` | two-word signature — "Comfort & Routine" | 3 | 17–25 |
| `.ctxt` under `Where the Energy Goes` | prose | 3 | 99–134 |
| `.ctxt` under `The Inner Experience` | prose | 3 | 98–102 |
| `.ctxt` under `Growing Edge` | prose | 3 | 91–95 |

All nine `.ctxt` blocks: **91–134 chars** (mean 102.8). [CC-MEASURED]

Consequences:

1. **The passion term ("Appetite") does not appear on the page.** It is not a p10 field.
   [CC-MEASURED]
2. **The Google Doc's 27 narratives cannot be used as drafted.** At 360–394 chars they are 3–4×
   a single Z5 block. They would have to be split three ways under fixed headings, which is
   re-authoring, not ingest. [CC-DERIVED]
3. **The store's narratives are further still from the target: 602–762 chars, mean 693, spread
   160, all two-paragraph.** SP9 is 677, SO5 is 695 — neither matches the prompt's stated 360 /
   394. Split by paragraph they are 246–380 and 263–414. **No slicing of the store text reproduces
   the Doc's 345–415 band**, so the Doc and the store are two independent bodies of prose.
   [CC-MEASURED]
4. Net-new authored strings for Z5: **27 × 4 = 108** (signature + three zones), of which the three
   Type 9 subtypes exist in the mockup → **24 × 4 = 96 to author**, plus 24 signatures. This
   matches the build plan's content-prerequisite table exactly ("27 subtypes (Type-9's 3 exist) →
   24 to author"). [CC-DERIVED]
5. `Growing Edge` is **derivable, not net-new, for the three that exist**: SP9's mockup text is
   `subtype_sp9.shifts[2]` with the lead-in stripped —
   store: *"The growing edge is noticing the numbing — the comfortable habits that quietly
   substitute for what actually matters."* → mockup: *"Noticing the numbing: the comfortable
   habits that quietly substitute for what actually matters."* [CC-MEASURED] Whether the other 24
   can be derived the same way is a content question for Cai and Mo, not a build question.
   [CC-JUDGMENT]

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

I could not verify the Google Doc `1_M7tvK1I-…`: its ID appears nowhere in the repo, and I did not
fetch it. Whether its narratives supersede the store's is **open** (§6). [CC-MEASURED]

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
rows of leading — comfortably more. [CC-DERIVED] That is the number 4a must settle, and per the
prompt I am not proposing a cap here.

---

## 3. Where the proposed architecture is wrong

Zone inventory Z1–Z6 (§2.1) is **correct** and matches the mockup. [CC-MEASURED] The errors are
all below it.

| # | Proposal | Measured reality | What I'd do |
|---|---|---|---|
| 1 | "p8" throughout | `p8` is Wings (sheet 8); this page is `p10` / `instincts` | Rename in prose; use `v3-inst-` in code (`p6-`/`p8-` are taken) |
| 2 | §2.2 PER-SUBTYPE = 5 fields, one narrative | Three labelled blocks of 91–134 chars + name + signature | 27 × 4 authored strings (96 + 24 to write) |
| 3 | §2.2 lists a passion term as a page field | "Appetite" appears nowhere on the page | Drop it from the p10 schema |
| 4 | §2.3 display names come from `hive_27_subtype_keywords_v5.docx` | Not in the repo. All 27 names + passions + CT markers are in `reference/hive_27_subtype_reference.md`, agreeing 27/27 with the store | Source from the repo file; do not ingest a third copy |
| 5 | §2.3 narratives ingest from the Google Doc | Doc narratives (360–394) are 3–4× a Z5 block; store narratives (602–762) are further off. No split reproduces the Doc band | Treat Z5 as authoring against measured budgets, not ingest |
| 6 | §2.2 Z2 is "static template + type token" | The store string has no token slot and ends on a different beat | Z2 is a re-author, not a tokenisation |
| 7 | §2.6 Z6 is "not a content-library item; something has to produce it" | Two producers exist, in two shapes, with a null path | Build to the existing field; reconcile the two shapes |
| 8 | §2.6 "unbounded string in a fixed-height band" | `.resp` is auto-height; overflow spills the page past 1057px | Real risk, different mechanism — the existing page gate catches it |
| 9 | §4b gate asserts **no shift zone exists** | `validateSubtype` **requires** `shifts.length >= 1`, and `subtype.shifts` renders on **live v2 p7** (`renderer.js:2347`) | See below — this is the most dangerous item |
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
- **Add** requirements for the new p10 fields (signature + three comparison zones, 27/27).
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
- **The build plan's PR 4 pass/fail claims Z6's border is "the only orange element on the page
  except the client name in the header (§5.3)". The mockup falsifies it:** `.ctag` (Primary badge)
  is `#F68625`, `.resp` background is `#FDF3E9`, `.hhead` is `#F9E7D2`, `.hlbl` is `#C2650F`.
  [CC-MEASURED] Either the criterion or the mockup is wrong; that is a §5.3 question for Cai.

---

## 4. Proposed build sequence — four builds, reordered

The prompt's 4a–4d is close. **Keep four, but move the CI-coverage work out of 4c and to the
front, because without it 4a measures the wrong thing and 4d cannot be verified at all.**
[CC-JUDGMENT]

The single reason: **the current harness renders 9 types × 1 instinct ordering, with an empty
`client_facing`.** A probe run on that fixture measures a page with no Z6 and only SX-primary
badges. Every budget it produced would be a floor, not a ceiling — the exact error §7.4 records
being made twice already.

### 4a — FIXTURE AXIS (new, first)

Give the harness the two dimensions p10 needs and nothing else can supply.

- A second and third instinct profile on the existing fixture — SP-primary and SO-primary — so all
  27 subtype columns can be the highlighted one. No new client fixture needed; `buildClientModel`
  derives the subtype from `dominant_instinct_hypothesis` + `confirmed_type`.
- A populated `client_facing.instinct_evidence` in **both shapes** (3 SM bullets, 1 EM paragraph),
  plus an explicit `null` case, so the empty state is a rendered case rather than an accident.
- An exact-tie and a 2-point-gap profile as named cases.

**Lands:** fixture + harness changes only. No page. **Proves:** a render that omits Z6 now fails
instead of passing quietly.

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

Ingest the 27 joined rows against 4b's budgets. Names from
`reference/hive_27_subtype_reference.md`, recounted at ingest.

**Gate, corrected per §3.1:** keep `shifts` required; add 27/27 presence for signature and the
three comparison zones; put the D4 negative assertion in the **renderer** test, not the content
build. **Prove each new assertion fails before trusting it** — delete a field, watch it go red.

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
   Affects the **live** report today, not just p10. Correctness bug, own card.
2. **`instinct_evidence` has two producer shapes** (3 bullets vs 1 paragraph) with no contract
   reconciling them. Own card — p10 can consume both, but the contract should be settled once.
3. **Spec §7.2's two stale p10 entries** (shift bullets, Leaning blocks) contradict ratified D4.
   Docs card.
4. **Build plan PR 4's "only orange element" criterion is falsified by the mockup it cites.**
   §5.3 question for Cai. Docs card.
5. **Live v2 p6 badges all three instincts** `Leading/Supporting/Growing` on a 2-point gap. If
   §2.5 is decided as I recommend, v2 has the same defect. Own card — do not widen PR 4 into v2.
6. **`docs/mockup_file_manifest.md` records a superseded
   `claude_The_Peacemaker_Page_Subtypes_v1.html`** — the second page from when Instincts &
   Subtypes was two pages. Worth confirming nothing in the content plan still assumes two.

---

## 6. Open questions I cannot resolve from the repo

1. **Does Google Doc `1_M7tvK1I-5bJw0JjDF4xpTRAEPgpyeWkGCQea6nH364` supersede the store's 27
   narratives, or is it a parallel draft?** The ID is nowhere in the repo and I did not fetch it.
   The two bodies are measurably independent (§2.2). If the Doc is the source of record, the store
   rows are stale — and they are **live v2 content**, so that has consequences beyond p10.
   Whichever it is, §7.4's convention says record the ID in the spec.
2. **Given the Doc's narratives are the wrong shape for Z5 (§2.2), what is the Doc actually for?**
   Possibly the v2 page, possibly a pre-D4 design. This changes whether PR 4 has a content
   dependency at all.
3. **Z3 AS-IS or edited?** The build plan says AS-IS; the store text is ~40% longer than the cards
   were fitted to. 4b measures the cost; the choice is Cai's.
4. **Z2: re-author the primer to carry a type token, or drop the token and use the store string?**
   §2.4. Not mine to pick.
5. **Do the three Type 9 signatures and comparison zones in the mockup count as authored, or as
   Claude-authored-pending-review?** §7.2's pattern suggests the latter. If pending, the authoring
   job is 27, not 24.
6. **Badge decision (§2.5)** — reopens a build-plan line, so it needs an explicit yes or no.
7. **Historical assessments:** I established that `dominant_instinct_hypothesis` is a late-added
   nullable column and `instinct_score_profile` is conditionally written. I could not measure
   **how many** stored assessments actually lack them — that needs a query against production,
   which I did not run. If p10 is ever regenerated for an old assessment, item 1 in §5 decides
   whether it renders wrong or fails loudly.
