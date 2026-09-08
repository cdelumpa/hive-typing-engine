# PR 5 · Build A — content and model for sheet 5

**Branch** `pr5-buildA-content-model`, base `2c4dbb3`. Predictions committed first at **`519bc8f`**,
before any file was edited. **No page renders.** No builder, no `built` flag, no `PAGE_INVENTORY`
bump — Build B's, all three. Section references of the form `§N` name `docs/audit_pr5_quickref.md`.

## 1. What is wrong

### 1.1 `verify_content_library.js` reported 39 leaves as Word-canonical that came from a JS constant, and stayed green doing it

`SCRIPT_SOURCED` (`scripts/verify_content_library.js:48`) is a **hand-maintained** table — its own
comment says "Keep in step with the constants themselves" — and **nothing fails when it falls
behind.** Landing `INTERIM_QUICKREF_V3` and `INTERIM_QUICKREF_STATIC_V3` without adding rows to it
produced, `[MEASURED]`, a **green** run reporting:

> `Word-canonical: 1355/2108 leaves.` · `753 leaf/leaves come from INTERIM_* constants`

against a truth of **1316/2108 and 792**. Thirty-nine leaves that came from a JavaScript literal were
counted as *proven canonical from Word* — which is the single claim that figure exists to make.

**The gate did not catch it. The Build A predictions did**, because they named 792 and 1316 in
advance (`519bc8f`, A2.2 and A2.4). Six rows added; the numbers now read 1316/2108 and 792
`[MEASURED]`. This is another instance of the repo's dominant defect class — a gate whose subject is
a hand-maintained list — and it belongs on the PR 7 card, not here: **nothing asserts that
`SCRIPT_SOURCED` covers every `INTERIM_*` constant.**

### 1.2 The chrome count was wrong in both directions — twelve, not eight and not eleven

The brief said "the eight static chrome strings". The audit that produced that phrase then enumerated
**eleven**. **Both are wrong. The answer is twelve.** `[MEASURED]` — selector enumeration of the
mockup, below.

The string that fell between the two counts and that nobody was storing is **the second `<h2>`**.
The mockup carries two: `How the Nine Patterns Scored` over the scores, and **`Tips for Debriefing
This Report with Your Coach`** over the tips grid. The enumeration of eleven counted only the first.

### 1.3 §26.6 item 6 is settled, and settled against us

**The curly quote form is unreachable.** `_v3Straighten` (`app/renderer.js:3473`) rewrites `“ ”` to
`"` inside `_v3t`, which every v3 prose zone runs. Whatever a coach publishes, SO8 renders with
**straight** quotes. `[MEASURED]` — read from the function; the library's own convention is straight
throughout (`build_content_library.js:676`).

So SO8 renders at **307.69 px in the 308.00 px box — 0.31 px of slack, not 0.86 px** `[MEASURED,
audit §26–§27]`. It fits, and it is the tightest string in the set, and no choice of quote glyph can
loosen it. Committed straight, as `U+0022 U+0022` — verified in the built JSON by codepoint, not by
eye. The build script applies no quote transform to `INTERIM_*` literals.

### 1.4 §5.3's rule, as my own audit stated it, is wrong

The audit said "a string is CMS-editable only if it ALSO has a preview entry." **It is not true.**
Editability is gated by `CMS_STATIC_FIELDS` / `cmsIsValidSubtypeKey`; previewability by
`cmsPreviewSpec`. They are **independent gates that merely coincide today** — 8 of 8 before this
build, `[MEASURED]` by diffing the two lists — and **nothing asserts they must.**

That correction is what makes the Build A / Build B seam clean rather than a compromise (§5).

### 1.5 The source document — recorded by ID, and the ingest direction with it

**AMENDED.** The Doc now exists: **`1zSvB-mR0AH06Z69fSstBQz411yJ7D3Ecr2AzEih_uW4`**, *"Subtype
Summaries — p5 Quick Reference — Content for Review"*, recorded in the constant's header so the
block follows the same convention as every other `INTERIM_*`.

**The ingest direction is recorded rather than smoothed over**, because it is the reverse of every
other block in that file: the Doc was created *after* these strings landed, so the values came from
the Build A prompt and the Doc was opened around them as the review surface. Writing "ingested from
the Doc" would imply a parse that never happened.

**DRAFT stays**, and the marker is load-bearing rather than stale: the Doc is where Mo's voice pass
happens. The header notes to re-ingest and recount from the Doc afterwards, on this file's counting
basis — not the Doc's own character count, which the p6/p7 ingest already found unreliable.

The subsection below records what the gap looked like before the Doc existed, and why no ID was
invented for it.

### 1.5a The convention the brief did not account for (§9)

Committing client prose through `INTERIM_*` is consistent with the repo — `INTERIM_INSTINCTS_V3`
already carries all 27 subtype narratives as committed prose. **But every `INTERIM_*` block carrying
client prose cites a Google Doc BY ID and records a recount** ("Read and recounted 7 Sep 2026 …
Recount at every re-ingest anyway").

**At the time of the first Build A commit these 27 had no source document.** They arrived in the
Build A prompt, and **no Doc ID was invented for them** — the header recorded prompt, date and DRAFT
status instead. §1.5 above is the amendment that closed it. The recount stands unchanged: 27 of 27
present, 51–161 characters, total 2868 `[MEASURED]`, counting basis "rendered string, whitespace
collapsed, ends trimmed", the basis this file already uses.

## 2. The twelve chrome strings, verbatim, with their selectors

Lifted by **selector match** from `docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html` —
rendered `textContent`, whitespace-collapsed, never re-typed. The mockup was read, never written
(blob `813e871`).

| # | selector | string |
|---|---|---|
| 1 | `.lead` | `A single-page summary of your assessment results. You'll find a more detailed description of your leading type hypothesis and its dynamics on the following pages.` |
| 2 | `.plbl[0]` | `Leading Hypothesis` |
| 3 | `.plbl[1]` | `Alternate Worth Exploring` |
| 4 | `.hhd[0]` | `Your Instincts Priority` |
| 5 | `.hhd[1]` | `Your Subtype (Primary Type + Primary Instinct)` |
| 6 | `h2[1]` | `Tips for Debriefing This Report with Your Coach` ← **the string neither count had; CMS-editable as of the amendment, §5a** |
| 7 | `.ttxt[0]` | `Bring what didn't land. The parts that felt wrong are as useful to your coach as the parts that felt true.` |
| 8 | `.ttxt[1]` | `Come with examples, not conclusions. A recent situation you can describe is worth more than a verdict.` |
| 9 | `.ttxt[2]` | `Ask about the alternate. If a second pattern scored close, that is a conversation, not a loose end.` |
| 10 | `.ttxt[3]` | `Pick one thing to work on. You do not need to act on all of it. One growing edge is enough to start.` |

**Not from the mockup — the mockup carries the old copy.** Source of record is the Build A prompt:

| # | key | string |
|---|---|---|
| 11 | `h2` | `How the Nine Types Show Up` |
| 12 | `zone8` | `We all have access to all nine types, and most of us have one home base we return to. Your responses point to the candidates marked here — worth exploring with your coach, especially if parts of the description don't quite fit.` |

**NOT PORTED.** `.sname` (`The One-to-One Nine`) and `.stag` (`The Seeker · Merging & Intensity`) are
UNRATIFIED and are stored nowhere. `Seeker` is not among the 27 naranjo values — SX9's is **`Fusion`**
`[MEASURED]` — and the leading article breaks on 26 of 27 (`The Appetite`, `The Non-Adaptability`,
`The Keepers of the Castle`). Sheet 5 composes `${naranjo} · ${signature}` with no article, in the
builder, from the subtype row's existing fields.

## 3. What landed

**`content_library.json` — a BUILT artifact, rebuilt, never hand-edited.**

| | `[MEASURED]`, printed by `verify_content_library.js` | before (`2c4dbb3`) | after |
|---|---|---|---|
| total leaves | | 2069 | **2108** |
| from `INTERIM_*` | | 753 | **792** |
| Word-canonical | | 1316 | **1316**, unchanged |

**New keys** `[MEASURED]`, from the built JSON: **27** `subtype_<code>.quickref_v3 = { summary }`,
**5** flat `static.quickref_*_v3` siblings, **0** new top-level keys. 39 new leaves.

**Why five flat siblings and not one object.** `overrideShape` (`content_overrides.js:79`) collapses
an array to `prefix[]` and **does not record its length** `[MEASURED]`, read from the function — so
the tips array can gain a fifth entry without tripping `assertOverrideShape`, while a fifth *object
key* could not. One grouped object would make every future addition a new leaf on a published shape:
the same hazard that forced `quickref_v3` to be a sibling of `instincts_v3` rather than a leaf
inside it. Flat siblings follow the convention `build_content_library.js:1368` states explicitly.

**Validation.** 27/27 summary coverage is enforced structurally in `validateSubtype` (the caller
loops all 27 keys). The five static keys are checked individually — the four tips by exact count, the
five labels **by name, not by count**, because a `length === 5` check passes on a renamed key and a
renamed label renders as `undefined` on a client page.

## 4. The model slot

`pages.v3_quickref` in `app/report_prep.js`. Nothing reads it: no builder exists and `quickref`
carries no `built` flag.

**The subtype is selected from p10's own rows, by instinct code, never by index.** `v3SubtypeRows` is
hoisted and **resolved once, consumed twice** — p10 renders all three columns, sheet 5 renders the
client's. That is the Build A prompt's §3.2 requirement met structurally rather than by convention: there is **one**
`resolveLibObject` read, so the two pages cannot print different naranjo names. Two reads of the same
key could return different values if an override landed between them.

`summary` is **stripped** from the p10 columns rather than carried into them, so p10's model slot is
byte-identical to what it was. Verified `[MEASURED]`: `columns[0]` keys are exactly
`instinct, code, naranjo, signature, narrative`; no `summary` leaks into any column.

**Deliberately absent, and the omission is the point:** `charts.types`, `instinctRanks`,
`hero.number`, `alternate.number`, `display.instinct_code`, `display.subtype_label`,
`type_hypotheses.core_motivation` and `.alternate_core_motivation` all already reach the renderer.
Duplicating any of them would create a second value that can drift from the first.

**The tagline is not stored.** Composing `${naranjo} · ${signature}` in the builder keeps one source
for both pages.

Populated for `anders_sx9` `[MEASURED]`: `SX9 · Fusion · Merging & Intensity`, summary 114 chars,
lead 162 chars, zone 8 227 chars, 4 tips, 5 labels. Client instinct `SX` → selected `SX9`.

## 5. CMS — where the seam falls and why

**Landed now: edit, draft, publish.** Four static keys added to `CMS_STATIC_FIELDS` with
`CMS_FIELD_META` cards; `quickref_v3` added to `CMS_SUBTYPE_FIELDS` and to `cmsIsValidSubtypeKey`.
The write routes accept **12 static + 162 subtype keys** (was 8 + 135); the stale comment that said
"7 static + 135" is corrected.

**Waits for Build B: preview only.** `cmsPreviewSpec` gets no `quickref` entry in this build. A
preview entry needs a `selector` pointing at page markup that does not exist until Build B, and a
selector that resolves to the wrong element is the documented p10 failure — it "renders and
screenshots a real, plausible page that is simply the wrong one, which an editor would read as *my
edit did nothing*."

**The seam is clean because §1.4 is true.** Editability and previewability are independent gates. The
failure mode of the gap is a clean, honest `400 — no preview mapping for key`, not a misleading
screenshot. **Build B must add:** one `STATIC` entry per CMS-editable static key (4), one branch in
the `subtype_*` regex/`SUB` map for `quickref_v3`, all with `doc: 'v3'` and a `.v3-page:has(...)`
selector naming a sheet-5-only class.

**`quickref_labels_v3` is deliberately not CMS-editable** — four structural labels, not prose.

### 5a. The tips heading — moved out and made editable, before merge

**AMENDED.** The tips heading is prose under Cai's own rule — a sentence a reader reads, not a
structural label — and the other `<h2>` is editable. It is now **`static.quickref_tips_heading_v3`**,
its own flat sibling, in `CMS_STATIC_FIELDS` with a `CMS_FIELD_META` card. **Six of the page's twelve
strings are CMS-editable**; the four structural labels are not. The write routes now accept **13
static + 162 subtype keys**.

It got its own key rather than a seat in `labels` because CMS granularity is per key: leaving it
there would make an editor choose between editing nothing and editing four structural labels
alongside it.

**Nothing about this was awkward, and the timing is the part worth keeping.** Moving it *after* these
keys shipped would be a leaf **removal** from `static.quickref_labels_v3`, and `assertOverrideShape`
rejects a published override in that direction too — *"present only in the override"* — so any coach
who had published a labels edit would break at render. Nothing is deployed and no override can exist
yet, so the move is free now and is not free later. **That asymmetry is the argument for settling CMS
granularity before a key ships, not after**, and it generalises past this string.

**Leaf-neutral, and asserted rather than assumed** `[MEASURED]`: `labels` 5 → 4 and one new key,
so the library still reports **1316/2108 Word-canonical and 792 from `INTERIM_*`** — the two figures
the merge was gated on. `SCRIPT_SOURCED` gained a row and its labels row was corrected 5 → 4, which
is §1.1's lesson applied on its first opportunity.

## 6. Gates — all six green, and the two stale baselines

| gate | predicted (from a named run) | measured | |
|---|---|---|---|
| `npm test` | 0.35 s | **0.33 s** | ✓ |
| `npm run verify:render` | 53 s | **52.71 s** | ✓ |
| `verify_content_library.js` | 0.25 s | **0.22 s** | ✓ |
| `verify_coach_baseline.js` | 2.85 s | **2.88 s** | ✓ |
| `verify_diagrams.js` | 0.95 s | **1.26 s** | ✗ **+33 %** |
| `verify_transparency.js` | 2.89 s | **7.57 s** | ✗ **+162 %** |

**Both misses are stale baselines, not slow code.** Both were predicted from the audit's §25.2, measured
**before PR 5 Build 3 landed**. Build 3 added `client-quickref` to the diagram gate's variant sweep
(72 ring configurations) and to the transparency gate's per-permutation PDF scan. The gates got
bigger; §25.2's figures no longer describe them. **Anything still predicting from that audit §25.2 is predicting
from a superseded run** — this build's own predictions did, and that is the finding.

Direction is worth noting: the brief's standing observation is that estimates on this PR run **high**.
These two ran **low**, for a different reason — not optimism, a stale source.

**`verify_coach_baseline.js` does not apply** to this build: the coach render path is untouched. Run
anyway it printed `COACH BASELINE: ALL PASSED — HTML only (PDF half skipped off-Linux)`. **That is a
HALF-RESULT, not a pass.** Only the Linux CI run is a full result.

**Byte-identity, the strongest check here.** All **10** distinct type/fixture v3 renders hash
**identical** to `2c4dbb3` `[MEASURED]` — SHA-256 of `buildClientReportHTML_v3` output, 9 types on
`anders_sx9` plus `sp4` at type 4. Ten, not 32: the instinct and Z6 axes vary one Contents line and
the Z6 band, neither of which this build touches. **Nothing this build added is rendered by anything**
— which is exactly the deliverable, a content and model build that changes no output.

## 7. Predictions versus measurement

`519bc8f`. **17 of 19 scored items hit. Both misses are §6's stale baselines.**

| # | predicted | measured | |
|---|---|---|---|
| A1.1 | chrome count **12** | 12 | ✓ |
| A1.2 | "eight" and "eleven" both wrong | both wrong | ✓ |
| A1.3 | the missing string is the second `<h2>` | the tips heading | ✓ |
| A2.1 | 39 new leaves | 39 | ✓ |
| A2.2 | `INTERIM_*` **792** | 792 — **after** the `SCRIPT_SOURCED` fix; 753 before it | ✓, and it is what caught §1.1 |
| A2.3 | total **2108** | 2108 | ✓ |
| A2.4 | Word-canonical **1316** | 1316 — **after** the fix; 1355 before | ✓, same |
| A2.5 | 0 new top-level keys | 0 | ✓ |
| A2.6 | 5 new `static.*` keys | 5 | ✓ |
| A2.7 | 27 `quickref_v3` objects | 27 | ✓ |
| A3.1 | 6 files | **7** | ✗ — `scripts/verify_content_library.js`, unforeseen because §1.1 was unforeseen |
| A3.3 | `renderer.js` untouched | untouched | ✓ |
| A3.4 | `report_page_inventory.js` untouched | untouched | ✓ |
| A3.5 | mockup untouched, blob `813e871` | unchanged | ✓ |
| A4.1 | renders byte-identical | 10/10 identical | ✓ |
| A4.2 | coach gate N/A; half-result off-Linux | confirmed | ✓ |
| A4.3 | all six gates green | green | ✓ |
| A5.1 | straight `U+0022` committed | `U+0022 U+0022` | ✓ |
| A5.2 | the build script does not normalise | it does not — **and `_v3Straighten` does, at render** | ✓ on the letter, and §1.3 is the part that matters |
| A6.1–A6.3 | prose via `INTERIM_*` is consistent; provenance-by-Doc-ID is a convention the brief missed | confirmed | ✓ |
| §6 | `verify_diagrams` 0.95 s · `verify_transparency` 2.89 s | **1.26 s · 7.57 s** | ✗ ✗ |

**A3.1 is an honest miss and a good one.** Seven files, not six. The seventh is
`verify_content_library.js`, and it was unforeseen because the defect that required it was
unforeseen. A prediction of six files was a prediction that the leaf-attribution table maintained
itself.

## 8a. What `.sname` actually is — the audit conflated two different strings

The audit listed "`.sname` / `.stag` copy decision" as one open question blocking Build B. **They are
not one question, and only one of them was ever a question.**

**`.stag` was a real problem.** It read `The Seeker · Merging & Intensity`, and `Seeker` is not among
the 27 naranjo values — SX9's is `Fusion` `[MEASURED]` — while the leading article breaks on 26 of 27
(`The Appetite`, `The Non-Adaptability`). Cai's ratification of `${naranjo} · ${signature}` with no
article settles it, and that is what landed: composed in the builder from the subtype row, not stored.

**`.sname` was never a copy question at all.** It is the subtype **display name**, and it is
`The ${display.subtype_label}` — a value already on the model, `${instinctName(instinct)}
${TYPE_WORD[heroN]}` (`report_prep.js:323`). The mockup's `The One-to-One Nine` reproduces **exactly**
from that `[MEASURED]`, and unlike the naranjo case the article generalises across all 27, because
`subtype_label` is always a noun phrase: `The Self-Preservation One`, `The Social Eight`,
`The One-to-One Four`.

**So the tagline ratification does not cover `.sname` — and `.sname` does not need covering. No
string is missing.** Build B composes it from data that already reaches the renderer, exactly as it
composes the tagline, and stores nothing.

The only residue is cosmetic and blocks nothing: **whether the leading article stays.** One case
reads oddly — SX1 is `The One-to-One One` — and that is inherent to the naming scheme rather than to
this decision; p10 already lives with the same construction. Worth Cai's eye at Build B review, not
before it.

**The audit was wrong to file this as blocking.** Naming two strings with one bullet hid that one of
them was already answered by data on the model.

## 8. Still open, with owners

| # | question | owner | blocks |
|---|---|---|---|
| 1 | ~~`.sname` / `.stag` copy~~ — **CLOSED, see §8a.** `.stag` is ratified and landed; `.sname` was never a copy question | — | nothing |
| 2 | ~~Is the tips heading CMS-editable?~~ — **CLOSED**, §5a: yes, moved to its own key before merge | — | nothing |
| 3 | Mo's voice pass on the 27 summaries. The key exists, so revisions are value changes: edit `INTERIM_QUICKREF_V3` and rebuild | **Mo** | nothing — the shape is settled |
| 4 | Nothing asserts `SCRIPT_SOURCED` covers every `INTERIM_*` constant (§1.1) | — | **PR 7 card** |
