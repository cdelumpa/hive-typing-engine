# Audit — PR 3e, source documents rebuilt (v2)

**Prepared:** 4 September 2026 · **Branch:** `pr-3e-audit-v2`, from `main` @ `f1c3aba`
**Scope:** validate the rebuilt source documents. Read-only. No parser, no content change, no gate change.
**Supersedes nothing** — this sits alongside `docs/audit_pr3e_five_type_ingest.md`, which audited the
originals and whose findings drove the rebuild.

Numbers are tagged **measured** (command and where), **derived** (inputs and assumption) or
**aggregate** (the set).

---

## 1. Branch state and provenance

`git pull --ff-only` → **`f1c3abaf8e0b191e3140e3605f0cbfdd6458f260`**, tree clean, matching the
expected `f1c3aba`. Branched `pr-3e-audit-v2`.

**New folder `123a0BtPaFyhh-HbEZbRa3EN5fcg3KT8d` verified.** It holds **exactly nine** documents, all
owned by `cdelumpa@gmail.com`, all created 2026-09-04 between 22:03 and 22:08. Every ID in the prompt
resolves to a document whose title carries the matching type number, archetype, and the `· p6/p7
Content v2` suffix. No transpositions, no extras. *(measured — `parentId` search against the prompt's
list.)*

All nine were fetched **by ID**. The `v2` suffix does make a title collision with the old set
impossible, but ID remains the right discipline and cost nothing.

---

## 2. The rebuild, validated — all nine read end to end

### 2.1 Every structural claim holds, on all nine

| Claim | Verdict |
|---|---|
| One role per heading level; `#` title, `##` section, `###` zone, `####` chicklet tagline | **CONFIRMED**, 9/9 |
| The "p6/p7 Content for Review" subtitle is gone | **CONFIRMED**, 9/9 |
| Exactly one sentinel per document, nothing above it that is not content | **CONFIRMED**, 9/9 |
| Catching Your Patterns is three `###` zones with `Sign:` / `Interrupt:` lines | **CONFIRMED**, 9/9 |
| No whitespace-only paragraphs | **CONFIRMED** — Type 6 and Type 9's are gone |
| No trailing spaces | **CONFIRMED** — Type 2 and Type 9's are gone |
| Notes for review only in 3, 5, 6, 8, and only below the sentinel | **CONFIRMED** |
| `**Label** — body` unchanged on At Your Best / Growing Edge | **CONFIRMED**, 9/9 |

**Every defect the first audit found is fixed.** The four format errors, the two per-document
divergences, and the italic-spans-in-Notes hazard are all resolved — the last one structurally, by
moving Notes below the sentinel rather than by asking a parser to recognise it.

The three read-back observations are also confirmed as described: zone headings return bolded
(`### **WORLDVIEW**`) while section headings do not (`## AT A GLANCE`); the budgets table exports with
an empty header row and `\*\*Zone\*\*` as its first body row; bullets export as `  - `. All three are
benign — the first needs one tolerant regex, the other two sit below the sentinel.

### 2.2 What would still break a parser — one real item, one to decide

> **⚠️ FINDING — zone names are not unique within a document.**
>
> `THINKING`, `FEELING` and `BEHAVING` each appear **twice** in every document, at the same heading
> level:
>
> - `## TYPICAL PATTERNS` → `### **1 THINKING**`, `### **2 FEELING**`, `### **3 BEHAVING**`
> - `## CATCHING YOUR PATTERNS IN THE MOMENT` → `### **THINKING**`, `### **FEELING**`, `### **BEHAVING**`
>
> The numeric prefix distinguishes them *today*, but it is a naming coincidence, not a guarantee — and
> a parser that builds a flat `zoneName → value` map silently keeps whichever it reads last, losing
> three zones per document with no error.
>
> **The parser must key on `(section, zone)`, not on zone name alone.** That is a parser requirement,
> not a document defect, and it is stated here because it is the one thing in this format that fails
> quietly rather than loudly. The alternative — renaming the Catching zones — is not recommended; §2.3
> explains why the section-scoped key is the better fix.

**Smaller, decide-or-ignore:** the trailing `  ` line at end of file survives in all nine. It is below
the sentinel and therefore harmless. No action needed; noted so it is not rediscovered.

**Nothing else.** I looked specifically for the classes that bit last time — stray whitespace
paragraphs, trailing spaces, heading-level overloading, annotation lines among content, italic spans
that mimic markers, escaped punctuation in content. None present above the sentinel in any of the nine.

### 2.3 Is this the format I want? Yes, with one addition

**Yes.** I would not work around any of it. Three things it gets right that matter more than they look:

- **The sentinel is a hard stop, not a filter.** The first audit's worst hazard was Notes containing
  italic spans and bullet lists that a lenient parser reads as content. Moving them below a sentinel
  removes the class of bug rather than asking the parser to be clever.
- **Catching Your Patterns as three labelled zones is strictly better than the table.** It kills the
  empty-header-row artifact and the `\*\*` escaping, and it makes the Thinking/Feeling/Behaving triad
  *explicit* rather than positional — which matters because Type 9's row order was wrong once already
  and positional parsing could not have caught it.
- **Keeping `**Label** — body` unchanged was the right call.** Changing it would have broken
  round-trip on the four built types, where the em dash is stored inside `body`.

**The one addition I would ask for, and it is optional:** a machine-readable type marker. Every
document identifies its type only in the H1 prose (`# **Type 4 — The Individualist**`). A parser must
regex the title to learn which type it is holding, and a mis-parse there mis-files forty zones
silently. A line immediately below the title — `type: 4` — would make it explicit. **This is a
nice-to-have.** The title format is consistent across all nine and the regex is trivial; I would not
rebuild the documents for this alone. If they are regenerated for another reason, add it.

I do **not** want the Catching zones renamed to disambiguate. Section-scoped keys are needed anyway
(sections are what the model is organised by), and renaming would make the documents less readable to
the humans who review them, which is the constituency they exist for.

---

## 3. The quote question — settled, and it has a consequence

**measured** — every string in `type_{1,4,7,9}.explore_v3` on `main` @ `f1c3aba`, 160 strings:

| character | count |
|---|---|
| curly apostrophe U+2019 | **0** |
| straight apostrophe `'` | **43** |
| curly double U+201C/U+201D | **0** |
| straight double `"` | **7** |

**The library is entirely straight, both marks.** That is the fact this turns on, and it is measured
rather than assumed.

The Drive export returns **curly apostrophes and straight double quotes** — the first audit's
observation, and the prompt confirms the rebuild wrote back what the export returned.

> **Therefore the round-trip will show a difference on every string containing an apostrophe — 43 of
> 160 for the four built types alone — unless the ingest normalises.**

**Does it matter?** Two different answers, and the distinction is the point:

- **At render: no.** `_v3Straighten` (`app/renderer.js`) maps `’ → '`, `“ ” → "`, `… → ...` before
  escaping, on every v3 prose string. A curly apostrophe in the library renders identically to a
  straight one. Nothing a client sees would change.
- **At the byte-exactness check: yes, decisively.** The round-trip diff that proves the transcription
  is faithful would report 43 false differences on the four built types, and would bury any real
  difference among them. The check would become useless in exactly the PR it exists to protect.

**Recommendation: normalise at ingest, using the same transform `_v3Straighten` applies, and compare
post-normalisation.** Then the library keeps its current all-straight form, the four built types
round-trip clean, and a real difference stands out. This also means the render-time straightening
becomes a no-op for this content rather than load-bearing, which is the safer arrangement.

**One consequence to record in §7.4:** the documents are then the source of record *modulo a
documented normalisation*, not byte-for-byte. That should be stated where the invariant is stated,
because "the docs are the source" and "the library is a byte-copy of the docs" would otherwise read
as the same claim, and they are not.

**On Type 9's old curly double quotes:** the prompt notes the old Type 9 table used `“yes”`/`“no”`
where Type 1's were straight. That string — `You say "yes" when you want to say "no".` — is the row
**dropped** in the re-authoring. It exists on `main` (straight, measured above) and in **neither**
version of the source document. It cannot produce a diff, and the mixed-quote hazard it represented
dies with it.

**What I could not verify, and will not infer:** the exact code point of the apostrophes *in the
documents*. Characters read through this session's context cannot be byte-identified with confidence.
**Don't know** — and it does not need to be known in advance, because the normalise-then-compare
recommendation makes the ingest correct under either answer. The check that settles it is the first
round-trip run, and it settles it as a by-product.

### 3.1 The four-type differences, re-confirmed against the NEW documents

Every difference found against the old documents is present, unchanged, in the new ones. No new
difference appeared, and the rebuild introduced none. *(measured — library values printed and compared
against the nine documents read above.)*

| Type | Leaf | On `main` | In v2 source | Class |
|---|---|---|---|---|
| 1 | `p7.signs[2]` | `…something that's already been done.` **52ch** | `…something already finished.` **44ch** | (a) known |
| 1 | `p7.interrupt[2]` | `Trust that you can correct things after it ships.` **49ch** | `Trust you can correct it after it ships.` **40ch** | (a) known |
| 4 | `p7.styles[2].bullets[1]` | `align **to** your personal purpose` **82ch** | `align **with** your personal purpose` **84ch** | (a) known |
| 7 | `p7.edge[1].body` | `…**experience the seriousness** of the moment.` rendered **91ch** | `…**feel the weight** of the moment.` rendered **80ch** | (a) known |
| 9 | `p7` Catching Your Patterns | old three rows | re-authored, Thinking/Feeling/Behaving, two surviving rows reordered | (a) known |

**Class (c) — anything else: empty.** Nothing unexplained.

**Class (b) — normalisation:** the apostrophe question above, affecting up to 43 of 160 strings.
Pending the first round-trip run, per §3.

Types 3, 5 and 8's restored trailing periods are present in the v2 documents and remain invisible in
this diff, because those types are unbuilt.

---

## 4. Sweep re-confirmed — 15 sites, one line-number correction

**No commits have landed since `#83`** *(measured — `git log f1c3aba..origin/main` is empty)*, so the
list stands. Verified by re-reading each anchor rather than assuming.

**One correction to my own previous report:** `client_v3: { 'v3-page': 7 }` is at
`tests/lib/report_page_inventory.js:47`, not `:49`. The two-bucket rationale comment begins at `:41`.
Every other anchor is where the last audit said it was.

Classification unchanged: **1 fires** (`tests/report_pages_test.js:131–132`), **8 silently wrong**
(four already false today), **6 cosmetic**.

---

## 5. The gate — prediction re-confirmed from the new documents

The rebuild changed no content, and I verified that rather than accepting it: the At Your Best and
Growing Edge lines in the v2 documents are character-for-character what the v1 documents carried, for
all five unbuilt types.

**The prediction stands unchanged.** *(derived — rendered lengths from the v2 document lines with `**`
markers removed, against the §7.4 bands. Not rendered.)*

| | T1 | T4 | T7 | T9 | **T2** | **T3** | **T5** | **T6** | **T8** |
|---|---|---|---|---|---|---|---|---|---|
| best | 239 | 228 | 257 | 254 | 243 | 249 | 247 | 257 | 246 |
| edge | 219 | 241 | 243 | 242 | 232 | **277** | **262** | **286** | **270** |
| edge − best | −20 | +13 | −14 | −12 | −11 | **+28** | **+15** | **+29** | **+24** |

T3 and T6 expected to fail `best`/`edge`; T8 likely; T5 uncertain; T2 borderline on a 51ch interrupt
cell. **Nothing in the rebuild changes the reasoning**, and the accepted sequencing — land the five
types with the gate report-only, flip it in a follow-up carrying the content fixes — still holds.

One thing the rebuild *does* improve: because Catching Your Patterns is now explicitly labelled
Thinking/Feeling/Behaving, a row-order error like Type 9's cannot recur silently. That was a content
defect the gate could never have caught, and the format now prevents it structurally.

---

## 6. What §7.4 should say

Not applied here — this lands with the 3e PR.

**On the old documents: describe them as SUPERSEDED, and keep them.** Not archived, not deleted.
Reasons: they are the provenance for the four types already in `INTERIM_EXPLORE_V3`, so a future
question about how a shipped string got there is answerable only against them; deleting them would
strand `#82`'s §7.4 correction, which records nine IDs that would then resolve to nothing; and there
is no cost to keeping them. Moving them to an `Archive/` subfolder is fine and does not change the
recommendation — but the IDs must stay resolvable.

Draft replacement for the §7.4 blockquote table and the paragraph above it:

> **Post-lock correction — [date of the 3e PR].** The source documents were **rebuilt** on 4 September
> 2026 into a format designed against `docs/audit_pr3e_five_type_ingest.md`. The IDs recorded on
> 4 Sep (below, struck) point at the **superseded** set. They are retained, not deleted: they are the
> provenance for the four types transcribed in PR #80, and the correction that recorded them should
> stay resolvable.
>
> **Current folder** — `123a0BtPaFyhh-HbEZbRa3EN5fcg3KT8d`,
> *"InsightOut Client Report Type Content - Updated 9/4/26"*. Titles end `· p6/p7 Content v2`.
>
> | Type | Archetype | Document ID |
> |---|---|---|
> | 1 | The Improver | `1iZdaq8h9y6q_0H7EUH4DJb99l2oib9_J9w-TfXq49MI` |
> | 2 | The Giver | `1c5p9yQt8r2sx9wlB0r0q8dXroI3zGAfkac_4L3SAzR4` |
> | 3 | The Performer | `1VXM-SmnYZL3-tcJDvlCxWoITmNq5qqnXzQsJU6N98Co` |
> | 4 | The Individualist | `1JzEW7reYFeB2Iu2jf3GukKN0QBuspR_pElIrI0XqYzA` |
> | 5 | The Observer | `1P3iDKDGib8p0eXXMJCFw05algzSKeq9zjbF67UTY7QM` |
> | 6 | The Questioner | `1x3tnhYWxIkgb2R3svjSJrqdS1yx-Bwlx1Py1i38xqaY` |
> | 7 | The Enthusiast | `1tkaClcJ78npfye1F7Pn6EAsEVN78lPGUG15vTWWV3wU` |
> | 8 | The Protector | `1lx-owBlGIFbXyDeIp732TUScbEy6xHLgtc5kj7ldSgA` |
> | 9 | The Peacemaker | `17wU25GiurExkaJJqCa4Qx-3qETTDywV1O1zUxqB9HiE` |
>
> **Superseded set** — folder `1AvZHg0MZUMdGorMa71REeScalVnW8spy`, nine documents titled
> `Type N — <Nickname> · p6/p7 Final Content for Review`. Retained as provenance for PR #80. **Do not
> ingest from them.**
>
> All nine current IDs were resolved against Drive before being recorded, as the previous set was.
>
> **The format is structural, and the parser depends on it.** `#` document title, `##` section, `###`
> zone, `####` chicklet tagline. The **second `#`** — `# END OF CONTENT — NOTHING BELOW THIS LINE IS
> INGESTED` — is a hard stop; budgets, structure notes and Notes for review live below it and are
> never content. Zone headings export with bold markers inside the heading text; sections do not.
> **Zone names are not unique within a document** — Thinking / Feeling / Behaving appear under both
> Typical Patterns and Catching Your Patterns — so the parser keys on `(section, zone)`.
>
> **The library is not a byte-copy of the documents.** The Drive export returns curly apostrophes;
> `INTERIM_EXPLORE_V3` stores straight ones throughout. The ingest applies the same normalisation
> `_v3Straighten` applies at render, and the round-trip check compares post-normalisation. The
> documents are the source of record **modulo that documented transform**.

---

## 7. Status

**The rebuild is good. I would write an extractor against these documents as they stand.**

- Every defect from the first audit is fixed, on all nine, verified individually.
- **One new finding**, and it fails quietly rather than loudly: zone names repeat within a document,
  so the parser must key on `(section, zone)`. That is a parser requirement, not a document change.
- **The quote question is settled on the side that matters**: the library is measurably all-straight.
  The ingest must normalise, and the round-trip check must compare post-normalisation, or it will
  report up to 43 false differences on the four built types and hide any real one.
- The four-type diff is unchanged: four known corrections plus Type 9's re-authored zone, **nothing
  in class (c)**.
- The gate prediction is re-confirmed from the new documents and the accepted sequencing stands.

**One optional ask:** an explicit `type: N` line under the title, if the documents are regenerated for
any other reason. Not worth a rebuild on its own.
