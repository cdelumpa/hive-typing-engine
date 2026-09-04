# Audit — PR 3e, the five-type p6/p7 ingest

**Prepared:** 4 September 2026 · **Branch:** `pr-3e-audit`, from `main` @ `f1c3aba`
**Scope:** ground truth before the ingest. Read-only. No parser, no content change, no gate change.
**Why:** everything the 3e plan rested on about the source documents was relayed rather than read.
Some of it was wrong. This is what is actually there.

Numbers are tagged **measured** (command and where), **derived** (inputs and assumption) or
**aggregate** (the set).

---

## 1. Branch state

`git checkout main && git fetch --all --prune && git pull --ff-only` → **`f1c3abaf8e0b191e3140e3605f0cbfdd6458f260`**,
tree clean. Matches the expected `f1c3aba`. Branched `pr-3e-audit` from it.

**Document IDs cross-checked against spec §7.4** — all nine agree with the prompt, and the folder
ID `1AvZHg0MZUMdGorMa71REeScalVnW8spy` is present. No disagreement to resolve. *(measured — parse of
§7.4's table against the prompt's list.)* All nine were fetched **by ID**, never by title.

---

## 2. The source documents — read first-hand, all nine

### 2.1 The relayed claims, confirmed or corrected

| | Claim | Verdict |
|---|---|---|
| a | `## ZONE` → prose → `*budget NNN*`, consistent | **PARTLY WRONG** — see 2.2 |
| b | Three p7 zones carry prose instead of a number | **CONFIRMED**, all nine |
| c | p6 zones **and the chicklet line** carry `*budget NNN*` | **WRONG for the chicklet line** — see 2.3 |
| d | All per-string character annotations stripped | **CONFIRMED**, all nine |
| e | Notes for review in 3, 5, 6, 8; absent from 1, 2, 4, 7, 9 | **CONFIRMED** |
| f | Type 2 has an empty `##` heading | **NOT FOUND** |
| g | `**Label** — body` on At Your Best / Growing Edge | **CONFIRMED** |
| h | Catching Your Patterns is a table with escaped `\*\*` in its header row | **CONFIRMED but mis-described** — see 2.4 |
| i | Header boilerplate gone from all nine | **CONFIRMED**. Type 9's "Open item" paragraph is **also gone** |

### 2.2 Heading levels are three deep, and one `##` is not a zone

The structure is **not** flat. Every document uses:

- `#` for the title and for **section** banners — `# **p6 — …**`, `# **AT A GLANCE**`,
  `# **TYPICAL PATTERNS**`, `# **p7 — …**`, `# **COMMUNICATION, CONFLICT, AND DECISION-MAKING STYLES**`,
  `# **CATCHING YOUR PATTERNS IN THE MOMENT**`, `# **Notes for review**`
- `##` for zones — **and for `## p6/p7 Content for Review`, which is a subtitle, not a zone**
- `###` for the three chicklet names — `### **Principled and Practical**`

⚠️ **A parser splitting on `##` gets a phantom zone in every document.** `p6/p7 Content for Review`
is the second line of all nine files.

Two further shape notes: the Typical Patterns zone headings carry a numeric prefix
(`## 1 THINKING`, `## 2 FEELING`, `## 3 BEHAVING`), so zone names are not bare; and chicklet names
sit at `###` while everything else authored sits at `##`.

### 2.3 The chicklet instruction line is prose, and it varies between documents

Claim (c) said it stays machine-readable. It does not. It reads:

```
*Budget 90 chars per bullet. Tagline ≤29 chars.*      types 1, 2, 4, 7, 9
*Budget 90 chars per bullet. Tagline 29 chars max.*   types 3, 5, 6, 8
```

Capital **B**, **two** numbers in one line, and **two different wordings across the nine**. A parser
expecting `*budget NNN*` here fails on all nine; one expecting a single number gets 90 and silently
drops the 29. *(measured — read of all nine.)*

So the count of instruction lines a parser cannot read as `*budget NNN*` is **four per document**,
not three: the three p7 prose budgets plus this one.

### 2.4 The table's real header row is empty

The block is:

```
|  |  |
| :-: | :-: |
| \*\*Signs the Pattern Is Showing Up\*\* | \*\*Interrupting the Pattern\*\* |
| …content row… | …content row… |
```

The **header row is blank**, the alignment row follows, and the escaped-bold line is the **first body
row**. A parser that takes "everything after the alignment row" as data gets **four** rows and treats
the labels as content. The escaping is `\*\*`, so a naive un-escape leaves literal asterisks.

### 2.5 What nobody mentioned — the things a parser will actually trip on

| # | Finding | Where |
|---|---|---|
| 1 | **Whitespace-only paragraph** (`  `) between the budget line and the first item | **Type 6** (At Your Best), **Type 9** (Your Growing Edge) |
| 2 | **Trailing spaces** on authored lines and inside table cells | **Type 2** (all six p7 bold lines, all table cells), **Type 9** (best items 2–3, all three Decision-Making bullets, all table cells). Types 1, 3, 4, 5, 6, 7, 8 clean |
| 3 | **Italic `*…*` spans inside Notes for review** that look like budget lines | Type 3 (`*sadness at the thought…*`), Type 5 (`*yourself*`), Type 6 (`*of*`), Type 8 (`*strong*`) |
| 4 | **`  - ` bullet lists inside Notes** that mimic chicklet bullets | Types 3, 5, 6, 8 |
| 5 | **Mixed quote styles** — curly apostrophes (U+2019) but **straight** double quotes | all nine |
| 6 | **Escaped tilde** `\~87`, `\~49` inside the prose budgets | all nine |
| 7 | **Trailing `  ` line** at end of file | all nine |

Findings 1 and 2 are the dangerous pair, and they are exactly the class the prompt predicted: **nine
separate manual edit passes, divergences in different zones of different documents.** Neither is
visible in a spot check.

⚠️ **Finding 3 raises the stakes on the stop condition.** Notes for review is not merely "ignorable" —
it contains italic spans and bullet lists that a lenient parser will read as budgets and content. The
parser must **hard-stop at `# **Notes for review**`**, not filter it out afterwards.

**On finding 5:** this is what the Drive export returns. Whether the underlying document stores the
same code points, I **don't know** — the export may normalise. The authoritative check is a
byte-comparison at ingest, which is why §3 below matters more than this observation.

---

## 3. The four-type re-diff — types 1, 4, 7, 9, all 160 leaves

**measured** — library values printed from `app/content/content_library.json` at `f1c3aba` and
compared against the documents read above.

**Result: 156 of 160 leaves identical. Four differences. All four are the known, intended
corrections. Nothing else differs.**

| Type | Leaf | On `main` | In source | Δ |
|---|---|---|---|---|
| 1 | `p7.signs[2]` | `You're reworking something that's already been done.` **52ch** | `You're reworking something already finished.` **44ch** | known pair fix |
| 1 | `p7.interrupt[2]` | `Trust that you can correct things after it ships.` **49ch** | `Trust you can correct it after it ships.` **40ch** | known pair fix |
| 4 | `p7.styles[2].bullets[1]` | `Decisions must align **to** your personal purpose…` **82ch** | `…align **with** your personal purpose…` **84ch** | known correction |
| 7 | `p7.edge[1].body` | `— Sometimes the room needs to **experience the seriousness** of the moment.` rendered **91ch** at a 19ch label | `— Sometimes the room needs to **feel the weight** of the moment.` rendered **80ch** | known pair fix |

Every figure the plan quoted is confirmed to the character: 52→44, 49→40, 91→80 at an unchanged
19ch label. *(measured — string lengths computed, not counted by eye.)*

**Type 9's Catching Your Patterns is a whole-zone replacement, as expected.** The dropped pair is
`You say "yes" when you want to say "no".` / `Make a counteroffer instead of a flat "no".`, a new
Thinking pair is added, and **the two surviving rows swap order** — body-tension moves 3rd → 2nd,
hard-thing 2nd → 3rd. That is the Thinking / Feeling / Behaving ordering §7.2 was closed on in #82.

**Types 3, 5 and 8's trailing-period restorations are not visible here** — those types are unbuilt,
so there is nothing on `main` to differ from. They will land as part of the ingest.

> **3e is an ingest, not a reconciliation.** The four built types are clean against their sources
> apart from four intended corrections. Nothing unexplained was found.

**One parser-design consequence, and it is load-bearing.** On `main` the em-dash separator is stored
**inside `body`**: `best[0] = { title: 'Integrity', body: '— You do what you said you'd do…' }`. The
document line is `**Integrity** — You do what…`. A parser that splits on ` — ` and stores the text
*after* it will produce values that do not round-trip against the four built types, and the byte-diff
will show 24 false differences. Match the existing convention.

---

## 4. The sweep list, re-swept at `f1c3aba`

The 3 Sep enumeration was made at `fda83bd`. Two PRs have landed since.

**Now 15 sites, not 17.** Three resolved, one added. Not padded.

### Resolved by #82 — drop from the list

| was | site | how |
|---|---|---|
| 5 | `pr_3_explore_batch.md:17` "27 renders" | struck, corrected to 71/81 |
| 6 | `pr_3_explore_batch.md:197` same figure | corrected to 71 |
| 11 | spec §7.4 "four Google Docs" | rewritten, nine IDs recorded |

### (a) Fires as a test failure — 1

| # | Site | What happens |
|---|---|---|
| 1 | `tests/report_pages_test.js:131–132` | `nonPilot` resolves `undefined`; the assert fires by design. Block :130–145 retires with it |

### (b) Silently wrong — 8

**Already false at `f1c3aba`, today** (4):

| # | Site | Why |
|---|---|---|
| 2 | `scripts/build_content_library.js:668–690` | "TYPE 9 ONLY", "solo pilot before the 1/4/8 batch", "Types 1-8 have no content here", "PORTED, NOT AUTHORED … from the two Type 9 mockups" — four false claims; §7.4 records the mockups stopped being the source on 20 Aug |
| 3 | `app/report_prep.js:334` | "PILOT: type 9 only." |
| 4 | `scripts/render_client.js:96` | "pilot-scoped to type 9" *(line moved from :56 — #83 grew this file 14,780 → 19,157 bytes)* |
| 5 | `tests/lib/report_page_inventory.js:41–48` | Two-bucket rationale; one bucket disappears |

**Goes wrong when the list moves** (4):

| # | Site | Why |
|---|---|---|
| 6 | `tests/lib/report_page_inventory.js:49` | `client_v3: { 'v3-page': 7 }` — bucket with no members. Sole consumer is `report_pages_test.js:138`, inside the block that retires at #1, so it goes dead rather than failing |
| 7 | `scripts/build_content_library.js:1293` | "PILOT SCOPE: types 1, 4, 7 and 9 carry content; 2, 3, 5, 6 and 8 carry…" |
| 8 | `scripts/build_content_library.js:1302` | "As each further type is authored, EXPLORE_PILOT_TYPES moves" |
| 9 | `app/renderer.js:3463–3465` | "PILOT SCOPE: types 1, 4, 7 and 9" |

### (c) Cosmetic — 6

| # | Site |
|---|---|
| 10 | `app/renderer.js:3093` — "PILOT SCOPE for sheets 6 and 7" heading |
| 11 | `app/renderer.js:3101` — "two lists that must agree" note |
| 12 | `app/renderer.js:3530` and `:3628` — throw messages; correct in form, will enumerate all nine |
| 13 | `app/renderer.js:3778` — `V3_EXPLORE_PILOT_TYPES` export; unnecessary once the concept retires |
| 14 | `tests/report_pages_test.js:113–118` — pilot-block comments |
| 15 | `scripts/build_content_library.js:692–696` — the `⚠️ PLACEHOLDER, revisit before the remaining five types` note; retires with the lists it describes |

**Added by #83:** none. The gate reads `R.v3PagesFor(asType)` and carries **no pilot assumption of its
own** *(measured — read of `scripts/render_client.js:305–330`)*, so it needs no change when the list
moves. That is worth stating because it was not designed for, it fell out of deriving from
`V3_PAGE_ORDER`.

**The two lists themselves** — `renderer.js:3105`, `build_content_library.js:697` — are the change,
not entries on the list.

**Spec §7.2 is no longer on this list.** #82 closed it.

---

## 5. What flipping the gate hard actually requires

### 5.1 Code, not config

`scripts/render_client.js:305–318` prints and never calls `fail()`. There is **no flag**. Flipping it
hard is a **code change** — call `fail()` on `!r.match` — and should probably add a cfg key
(`pairChecksHard`) so the intent is declared beside `pairChecks` rather than buried in the loop.
*(measured — read of the invocation.)*

### 5.2 Do types 1 and 7 pass once the fixes land? Yes — derived

**Type 1** currently 4/3. `signs` is 4 because the 52ch cell wraps to two lines (1+1+2); `interrupt`
is 3. At 44ch that cell drops to one line → **signs 3 / interrupt 3**. `interrupt[2]` 49→40 stays one
line. **Match.**

**Type 7** currently 6/7. `edge` is 7 because the 91ch item at a 19ch label renders three lines
(2+3+2); `best` is 6. At 80ch it renders two → **6/6**. **Match.**

*(derived — from the measured current line counts plus the measured cell/line bands. Assumes 44ch is
one line at ~49 working target, and 80ch is two lines at a 19ch label, both comfortably inside the
bands. Not re-rendered, per instruction.)*

### 5.3 The five unbuilt types — the gate will very likely go red

**This is the finding that matters most.** *(derived — rendered lengths computed from the document
lines with `**` markers removed, against the bands in §7.4 and the doc budgets. Not rendered.)*

Column totals, rendered characters, `best` vs `edge`:

| | T1 | T4 | T7 | T9 | **T2** | **T3** | **T5** | **T6** | **T8** |
|---|---|---|---|---|---|---|---|---|---|
| best | 239 | 228 | 257 | 254 | 243 | 249 | 247 | 257 | 246 |
| edge | 219 | 241 | 243 | 242 | 232 | **277** | **262** | **286** | **270** |
| edge − best | −20 | +13 | −14 | −12 | −11 | **+28** | **+15** | **+29** | **+24** |

The four built types sit between −20 and +13. **Four of the five unbuilt types skew heavily toward
`edge`** — and `best`/`edge` is a gated pair.

Per-type estimate:

| Type | best | edge | verdict |
|---|---|---|---|
| 2 | 6 | 6 | likely **pass** — but `interrupt[1]` is 51ch, inside the 50–52 uncertain band; if it wraps, 3/4 **fails** |
| 3 | 6 | **9** | **fails** — all three edge lines 92–93ch at 14–20ch labels |
| 5 | 7 | 6–7 | **uncertain** — `best[1]` is 95ch at a 5ch label; `edge[2]` 91ch at 20ch is on the unmeasured 87–91 boundary |
| 6 | 7 | **9** | **fails** — edge lines 93–99ch |
| 8 | 6 | 7–8 | **likely fails** — `edge[0]` 95ch at 12ch label; the doc's own Notes call this "tightest line in the project" |

**Realistic chance the gate goes red on at least one: very high — I would say near-certain, on three
to four of the five.** It is not noise. The Growing Edge column was authored longer than At Your Best
across exactly the types that have not yet been measured, and nothing has ever checked it.

### 5.4 Recommendation — land the types, flip the gate separately

Asked directly: **do not flip the gate hard inside 3e.**

1. **Fixing content mid-PR means editing approved content.** These are Cai-and-Mo-authored, locked
   documents. The project's standing rule is that a fit failure in approved content is a finding for
   them, not a build-time trim. Three-to-four types' worth of Growing Edge rewrites is an authoring
   round, not a build task.
2. **It would block the ingest on the slowest input.** 3e's value is getting all nine types into the
   library and rendering. Gating that on content edits couples a mechanical transcription to an
   editorial cycle.
3. **The gate is already report-only and already correct.** Landing the five types makes it print
   fifteen pairs across nine types on the very first CI run — which is precisely the baseline it was
   landed early to produce. Flipping it hard adds nothing to that.
4. **The 87–91 boundary is still unmeasured.** Several of these lines sit inside it. Flipping hard
   while the discriminating band is unknown means a red gate nobody can act on with confidence.

**Proposed sequence:** 3e lands the five types with the gate still report-only → the CI run produces
the measured pair counts for all nine → those go to Cai and Mo as a single list → a follow-up PR takes
the content fixes **and** flips the gate hard in the same change, so the flip lands green.

That also gives the 87–91 boundary a real measurement for free, on nine types instead of four.

---

## 6. Status

**Ready for the 3e build prompt, with three things settled that were not before.**

- **The parser spec is not what was relayed.** Four instruction lines per document are unreadable as
  `*budget NNN*`, not three; `##` is not a zone marker; the table's header row is empty; and two
  documents carry whitespace-only paragraphs. A parser written to the relayed description would have
  broken on all nine and silently mis-parsed two.
- **The four built types are clean.** 156/160 identical, four intended corrections, nothing else. 3e
  is an ingest.
- **The gate should not flip in 3e.** Three to four of the five unbuilt types are expected to fail a
  pair, for a structural reason, and fixing that is an authoring round.

**Open, and not resolvable here:** whether the Drive export's quote normalisation matches the stored
document. **Don't know** — settle it with a byte-comparison at ingest.
