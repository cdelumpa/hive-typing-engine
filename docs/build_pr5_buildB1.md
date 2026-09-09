# PR 5 · Build B1 — the panel stylesheet, the box, and the tips restructure

**Branch** `pr5-buildB1-panel-css`, base `c03254a`. Predictions committed first at **`ded284d`**,
before any file was edited. **No page renders** — no `_clv3QuickRef`, no `built` flag, no
`PAGE_INVENTORY` bump. Every `§N` names a section of `docs/audit_pr5_quickref.md` unless said
otherwise.

## 1. The headline

**`.stxt` measures 308.00 px against the real shipped stylesheet.** `[MEASURED]` — `clientWidth`
minus horizontal padding, on `.v3-qr-stxt` inside a real `.v3-page` of the real document, with the
CSS coming from `clientReportV3PageStyles()` rather than injected.

**`m` = 44 and the safe ceiling of 132 stand. Mo continues.** The audit's §26.3–§26.5 are not
re-run, because nothing moved.

## 2. What is wrong

### 2.1 The ratified mockup carries 25 dead rules, and a verbatim port would have shipped them

`[MEASURED]` — the mockup's `<style>` selectors diffed against its own `<body>` class attributes:
**40 classes live, 20 dead**, across **25 dead rules**. `.band`, `.bhead`, `.bnum`, `.blbl`,
`.bname`, `.bbody`, `.krow`, `.knum`, `.kname`, `.kval`, `.row`, `.rnum`, `.rname`, `.rtrack`,
`.rfill`, `.rval`, `.sub`, `.top`, `.is-lead`, `.is-alt` — leftovers from earlier iterations of the
page. None appears in the mockup's markup.

"Lift the rules selector-matched" would have carried every one of them into the shipped stylesheet.
The generator drops them and reports the count.

### 2.2 The v3 shell already owns five of the names the mockup declares

`client_report_v3_styles.js:40` states it outright — `.lead`, `.sub`, `.note`, `.eyebrow` and
`.page` belong to the shared sheet — and records that re-using them **"bit twice during design,
both times invisibly"**. **11 mockup rules are skipped for this reason.**

The sharpest case: the shell's `.lead` plus `.lead.is-loose` is **byte-equivalent** to the mockup's
`.lead` — 14 px / `#4A5568` / 1.55 / 24 px bottom `[MEASURED]`, `--v3-soft-navy` resolving to
`#4A5568`. **So sheet 5's lead paragraph needs no rule at all**; the page emits
`class="lead is-loose"`. `h1` and `h2` likewise already match the mockup exactly. A namespaced
`.v3-qr-lead` would have been a near-duplicate of a rule that already exists — the collision class
§3.4 of the design spec exists to prevent.

### 2.3 The mockup violates the shell's own `is-` modifier rule in three places

The shell requires component modifiers to be prefixed `is-`, and names the two invisible bugs the
rule exists to stop (`class="krow lead"` picking up `.lead`'s font-size; `class="hhd sub"` picking
up `.sub`'s margin). The mockup complies for `hhd is-sys` / `is-sub` but **not** for `plbl ld`,
`plbl at` and `irow pri` — bare generic names on a page that will share a document with eleven
others. Ported as `.is-lead`, `.is-alt`, `.is-primary`.

### 2.4 One declaration is corrected, not copied — the figure would have been squashed 1.19 %

The mockup pins `.hm svg` to `322px × 315px`, which matches **its own** diagram's `360 × 352`
viewBox (aspect 1.02273). The **shipped** figure is `QUICKREF_GEO` at `360 × 348` (aspect 1.03448)
`[MEASURED]`. Pinning both axes would compress it vertically by **1.19 %** `[DERIVED]`.

`height:auto` lets the viewBox govern. Measured result: the figure renders **311.27 px** tall rather
than 315 `[MEASURED]`, and survives any future change to `QUICKREF_GEO`.

### 2.5 Zone 8 is not a `.note`, and porting it as one would have fought a shell rule

The mockup marks zone 8 up as `.note`. The ratified copy is **normal text, not italic** — and
`.note` **is** the italic aside; the shell defines it as `font-style:italic`. Un-italicising it
would mean overriding a shell rule to remove its defining property. Zone 8 gets its own page class,
`.v3-qr-zone8`, carrying the size, colour, leading and the margin the mockup applied inline.

### 2.6 A process failure of mine, reported rather than buried

Establishing the render diff, I ran `git stash` from the wrong working directory; the subsequent
`git stash pop` picked up **a pre-existing stash belonging to someone else** (a GitHub Desktop
auto-stash on `main`) and dropped six foreign conflicted paths into the tree — four tracked
`samples/*.html` and two `.DS_Store`.

**Nothing was lost and nothing foreign was committed.** The samples were restored to exactly `HEAD`
(`git diff HEAD -- samples/` empty), the `.DS_Store` entries cleared from the index (they are
gitignored and absent from `HEAD`), and **all three pre-existing stashes are still present and
undropped** `[MEASURED]`, `git stash list` = 3 before and after. The diff was then redone with plain
file copies and no stash at all.

**I flagged this exact risk in the Build A report and then repeated it.** The rule going forward is
simply: do not use `git stash` in this repo — it has long-lived stashes that are not mine, and
copying files aside costs nothing.

## 3. The stylesheet

**39 rules**, all at `.v3-page .v3-qr-*` — specificity **(0,2,0)** against the reset's `.v3-page *`
at **(0,1,0)**, the convention 187 of 188 existing page rules already use. **No rule needed to drop
to (0,1,0).**

Generated, never re-typed: the mockup's `<style>` block is parsed, each rule's declarations carried
verbatim, only selectors rewritten. The mockup is read and never written — blob `813e871`.

**Spec §3.2 asserted in this build, not deferred** `[MEASURED]`: scanning the block's **declaration
lines only**, banned constructs = **0** (`transparent`, `rgba(`, `fill-opacity`, `stop-opacity`,
`opacity:`).

> A first pass at this scan returned **4** — and every hit was my own comment prose describing the
> ban. Scanning a CSS block that documents the rule it obeys will match the documentation. The scan
> is over rule lines only.

## 4. The box

`[MEASURED]`. Real stylesheet, markup-only scaffold, real `.v3-page`, real document.

| property | value | predicted |
|---|---|---|
| `.v3-page` outer / content | 816.00 / **710.00 px**, `padding 40px 53px`, border-box | ✓ |
| `.v3-qr-two` content · display · gap | 710.00 px · flex · **18 px** | ✓ |
| `.v3-qr-half` × 2, border-box / content | **346.00 / 344.00 px** each, border 1 px | ✓ |
| `.v3-qr-half` computed flex | **`1 1 0%`** | ✓ |
| `.v3-qr-hbd` content · padding | **308.00 px** · `16px 18px` | ✓ |
| **`.v3-qr-stxt` content** | **308.00 px** (bounding agrees — not content-shrunk) | ✓ |
| `font-size` / `line-height` | **12.5 px / 18.75 px** | ✓ |
| Arial probe | **2378.80859375** vs the 2378.81 constant | ✓ |

**`font-size` and `line-height` were a live prediction this time, not a tautology.** Build 0
injected the mockup's rules verbatim so those values were fixed by the method; here they were
transcribed by a generator into a hand-placed block, so a slip was possible. There was none.

### 4.1 What could have moved the box — and what did

| candidate | predicted | measured |
|---|---|---|
| namespace `.two/.half/.hbd/.stxt` → `.v3-qr-*` | no | **did not move it** |
| specificity vs the v3 reset | no | **did not move it** — (0,2,0) throughout |
| the 18 px gap | no | **did not move it** — ported unchanged, computed 18 px |
| the 1 px `.half` border | no | **did not move it** — computed 1 px |
| `.hbd` padding `16px 18px` | no | **did not move it** — computed `16px 18px` |
| a fixed-width instincts half | not introduced | **not introduced** — both halves `1 1 0%` |
| inherited v3-shell rules the Build 0 scaffold lacked | none | **none** — Build 0 already rendered inside a real `.v3-page` |

**Every row predicted "no" and every row measured "no". Seven for seven.**

## 5. The tips restructure

### 5.1 The stop condition, resolved as a measurement

`scripts/overrides_check.js` against the deploy target: **`published rows: 0`**, exit **0** — not
exit 2, so the database was genuinely read and this is not a silent skip `[MEASURED]`. A direct
count by status returns **TABLE EMPTY**: no published rows, **no draft rows**, and no row naming any
`quickref` key.

Published-only would have been the narrower question — `assertOverrideShape` runs on
`status = 'published'` — but a *draft* against the old shape would have become invalid on publish and
surprised an editor later. Both are zero, so the reshape is unconditionally free. **One day later
this is a migration.**

### 5.2 The four pairs, verbatim, with their selectors

Lifted from the mockup's raw markup: the lead from `.ttxt[i] > b`, the body from the remaining
sibling nodes — taken from the DOM, not by string surgery. **Each pair was verified to rejoin into
exactly the string Build A stored** `[MEASURED]`, 4 of 4.

| # | selector | `lead` | `body` |
|---|---|---|---|
| 0 | `.ttxt[0] > b` | `Bring what didn't land.` | `The parts that felt wrong are as useful to your coach as the parts that felt true.` |
| 1 | `.ttxt[1] > b` | `Come with examples, not conclusions.` | `A recent situation you can describe is worth more than a verdict.` |
| 2 | `.ttxt[2] > b` | `Ask about the alternate.` | `If a second pattern scored close, that is a conversation, not a loose end.` |
| 3 | `.ttxt[3] > b` | `Pick one thing to work on.` | `You do not need to act on all of it. One growing edge is enough to start.` |

Stored as **array[4] of `{lead, body}`**, following `static.instinct_definitions_v3` — already an
array of objects and already CMS-editable, so the shape has precedent rather than inventing one.
Validation requires **both** leaves on every tip: a lead with no body renders as a bold fragment
followed by nothing, which reads as truncation rather than as a missing field.

### 5.3 Counts

| | before | after | predicted |
|---|---|---|---|
| total leaves | 2108 | **2112** | ✓ |
| from `INTERIM_*` | 792 | **796** | ✓ |
| Word-canonical | 1316 | **1316** | ✓ |

`[MEASURED]`, printed by `verify_content_library.js`. **Build A's stop-condition constants
792 / 1316 do not both survive**, by design and as predicted: 792 → 796, 1316 holds.

**`SCRIPT_SOURCED`'s row count corrected itself; its label did not.** The count is computed by
`countLeaves` and moved 4 → 8 on its own. The human label still said "(4)" and was hand-corrected to
"(4 × lead/body)". That asymmetry is the audit's §29.6 finding in miniature: **the number moves,
the description does not**, and only the number is checked.

## 6. Zone 8 — measured both ways

`[MEASURED]` on a full sheet-5 markup scaffold with real model content and the real stylesheet.

| variant | natural stack | **headroom to 1056** | chart → zone 8 gap | zone 8 → panels gap |
|---|---|---|---|---|
| **A — `margin-top:-6px`** | 955.23 px | **100.77 px** | **12.00 px** | 18.00 px |
| **B — `margin-top:0`** | 961.23 px | **94.77 px** | **18.00 px** | 18.00 px |
| delta | +6.00 px | −6.00 px | +6.00 px | 0 |

The delta is **exactly 6.00 px**, as predicted. **Both fit comfortably** — neither is within 90 px
of the sheet, so **headroom is not the deciding constraint** and the choice is rhythm.

**Chosen: A, keep the −6px.** The reason is not "the mockup did it". Zone 8 is a note *about the
figure above it* — *"the candidates marked here"*. A gives **12 px above / 18 px below**; B gives
**18 / 18**. The asymmetry is what binds the note to the chart it annotates instead of letting it
float midway between the chart and the panels. B's symmetry is the page's default rhythm, which is
exactly why it reads as unrelated to either neighbour.

Recorded so it can be reversed cheaply: it is one declaration, both variants fit, and the cost of
being wrong is 6 px of headroom out of ~100.

## 7. Byte-identity — proved by diff, not asserted

Predicted to break, and it did. `[MEASURED]` — full-text diff of all 10 renders, before against
after, computed as common-prefix / common-suffix:

| | result |
|---|---|
| renders differing from `c03254a` | **10 of 10**, as predicted |
| bytes **removed**, any render | **0 — a pure insertion** |
| insertions per render | **exactly 1**, contiguous |
| insertion offset | **byte 33630 in every one of the ten** |
| insertion length | **6192 bytes in every one of the ten** |
| distinct inserted blocks across all ten | **1** — byte-identical everywhere |
| insertion inside `<style>` | **yes** |
| insertion contains any markup tag | **no** |

**So no rendered content, geometry or layout on any existing page moved.** A single identical CSS
block was inserted into the stylesheet of all ten and nothing else changed anywhere.

**The tips reshape contributed zero render diff, and the same diff proves it.** The "after" renders
were produced with the reshaped library in place. Had the reshape had any render effect it would
appear as a second diff region; there is none — the only delta is the CSS block, which contains no
tip content. Tips render nowhere yet, and now that is measured rather than assumed.

## 8. The two read-only questions

### 8.1 The alternate ring, sourced from `alternate.number` vs from position

The ring is dropped by one line: `const altN = (alternate != null && alternate !== leading) ? alternate : null;`
(`renderer.js:1347`). **Sourcing it from position 2 would make that branch unreachable** — `typeRamp`
de-duplicates while placing, so position 2 is by construction always a different type from position 1
(the forced collided record put 9 at position 1 and 5 at position 2 `[MEASURED]`), and a ring drawn
on position 2 could never land on the leading node. **But the branch is carrying something real, and
it is not redundancy: it carries the difference between a second hypothesis the engine NAMED and one
INFERRED from the ranking.** On a collision `call2` could not recover a distinct alternate; promoting
`call1_ranking`'s runner-up to a dashed ALTERNATE ring asserts a second hypothesis the record does
not contain, which is precisely what that comment says it refuses to do. The sharp part is that
**the page already leaks the inference anyway**: `rankFill(posOf[i])` shades position 2
second-darkest on every record including a collided one, so today the figure simultaneously shades
type 5 as second-most-like-you and withholds the ring that would say so. The real question is
therefore not which field the ring reads, but **whether the page asserts a second hypothesis at all
on a collision — and the ramp has already half-answered it in the affirmative without anyone
deciding that.** That inconsistency predates sheet 5 and is worth Cai's decision before B2 writes
the `.pick` panels, since the panels will make it visible in words.

### 8.2 `type_hypotheses.discriminator` — sheet 5 should not take it

**What it holds** `[MEASURED]`: the EM-generated *key distinguishing question* — e.g. for `sp4`,
*"The key question is: does the drive toward improvement come from an internalized standard of
correctness (One) or from a persistent sense that something is missing in yourself…"* — 214 chars on
`sp4`, 177 on `sx7`, and **empty on `anders_sx9`**, the fixture the v3 mockups were built for. Source
is `coach_report.section6.pushes_back.key_distinction`, built by `em_report_adapter.js:134`.

**My judgment: no.** Four pieces of evidence, three of them decisive on their own.

1. **It was already deliberately removed from the client report.** `renderer.js:2250–2254`:
   *"The legacy 'Key Distinction' row is intentionally dropped — the V2 template has no such slot
   (the discriminator still surfaces in the coach report)."* Putting it on sheet 5 reverses a
   recorded decision without revisiting its reasoning.
2. **It is empty on 1 of 3 fixtures**, including the primary one, so it cannot be a required page
   element — it would need an absent-state, on the page with the least slack.
3. **It is coach-facing by construction.** It renders today in `_coachPage2` as *"Key distinguishing
   question"*. Sheet 5 already carries the client-facing version of that job in the four debrief tips.
4. At 177–214 chars it is longer than either `.ptxt` block on the page (145 and 80).

**Consequence to name, not fix:** `pages.type_hypotheses.discriminator` on the **client** model
(`report_prep.js:388`) is read by nobody and, on this answer, will stay that way. Dead weight — a
PR 7 line, not Build B's.

## 9. Gates — six green

| gate | predicted | measured | |
|---|---|---|---|
| `npm test` | 0.23–0.39 s | **0.23 / 0.41 s** | ✗ marginally — 0.41 is 0.02 s past the range top |
| `npm run verify:render` | 52.5 s | **52.84 s** | ✓ |
| `verify_diagrams.js` | 1.0–1.2 s | **1.22 s** | ✗ marginally — 0.02 s past |
| `verify_transparency.js` | 7.5 s | **7.55 s** | ✓ |
| `verify_coach_baseline.js` | 2.8 s | **2.85 s** | ✓ |
| `verify_content_library.js` | 0.2 s | **0.22 s** | ✓ |

27 tests pass, 0 fail. The two marginal misses are 0.02 s each and are noise on a two-sample
baseline, not signal — recorded because a range is a claim and 0.41 is outside the one I made.

**`verify_coach_baseline.js` does not apply** — the coach render path is untouched. Run anyway it
printed `ALL PASSED — HTML only (PDF half skipped off-Linux)`. **That is a HALF-RESULT, not a pass.**

## 10. Predictions versus measurement

`ded284d`. **24 of 26 scored items hit; the two misses are the 0.02 s timings above.**

Every box prediction (1.1–1.9), every "could it move the box" row (7 of 7), every leaf count
(3.1–3.5), the zone-8 delta (4.2) and my own choice (4.3), all six byte-identity predictions
(6.1–6.5) and all six file predictions (7.1–7.6) hit.

**B1.5 is void, not scored.** The predictions file carried a prediction about the collided record's
second panel; the revised brief removed that question from B1's scope after the predictions were
committed. Recorded as superseded rather than quietly deleted or counted as a win.

**Files: 6, as predicted** — `scripts/build_content_library.js`, `app/content/content_library.json`
(rebuilt, never hand-edited), `scripts/verify_content_library.js`, `app/renderer.js`,
`docs/build_pr5_buildB1.md`, `docs/predictions_pr5_buildB1.md`. `app/report_prep.js` untouched, as
predicted — `tips: stat.quickref_tips_v3 || []` passes the new shape through unchanged.
`app/server.js`, `tests/lib/report_page_inventory.js` and the mockup all untouched.

## 11. Open, and what B2 inherits

| # | question | owner |
|---|---|---|
| 1 | Does the page assert a second hypothesis on a collided record? The ramp already does; the ring does not. §8.1 | **Cai**, before B2's `.pick` panels |
| 2 | The `.sname` leading article — `The One-to-One Nine` generalises, but `The One-to-One One` (SX1) reads oddly | **Cai**, at B2 review |
| 3 | Zone 8's −6px is chosen and reversible; one declaration | — |
