# PR 5 · Build B3 — the fit assertions

**Branch** `pr5-buildB3-fit-assertions`, base `11bca71`. Predictions committed first at `2aea055`,
before any source file was edited. Every `§N` names a section of `docs/audit_pr5_quickref.md`
unless said otherwise.

The outcome served: *a client's page arrives whole — one sheet, nothing crowded, nothing cut off —
no matter what changed upstream since it was designed.*

## 1. What is wrong, first

Three things, two of them mine.

**1.1 · `fitVerdict` has been telling editors something false.** The over-limit message read
*"Three is the most that fits — a fourth pushes the page onto a second sheet."* Measured on the
render this build: the page holds **five** summary lines and does not spill until **six**. A fourth
line leaves 32.86px free and a fifth leaves 14.11px. The sentence was wrong by two lines, and wrong
in the RESTRICTIVE direction — it told people to cut copy that fits, citing a consequence that
would not happen. Shipped in B4, which is mine. Corrected here; the new wording is **not yet
ratified** (§7.1).

**1.2 · The B4 fit sweep measured the wrong page on its last pass.** It read
`if (t !== spec.type) setContent(...)` — "the page already shows `spec.type`, do not re-render it"
— which is true only on the FIRST iteration. `spec.type` is 9 for every static key and the sweep
ran 1..9, so the final pass skipped its render and measured **type 8's page while recording it as
type 9**. Also mine, also from B4. Fixed by tracking what the page actually holds.

**1.3 · The numbers in the B3 brief were not consistent, and one set was wrong.** The brief gave
"22.03px headroom at 3 lines, 3.28px at 4, fails at 5" alongside a 51.61px minimum. Those cannot
both be sheet-5 page headroom, which prediction 5.5 recorded before measuring. Measured: 51.61px at
3 lines, 32.86px at 4, 14.11px at 5. The brief's own "14.11px still free at five lines" matches
exactly; the 22.03/3.28 pair matches nothing on this sheet.

## 2. Two conditions in the brief were refused, and why

**2.1 · F1 as briefed was already built.** `scripts/render_client.js:156` sets `enforceSheet: true`
for `client_v3` and `:589` fails any v3 page past 1056px. Asserting "one sheet on every rendered
record" again would have been a second assertion that is true because the first one is. F1 was
rewritten as the two things the binary cannot do: **record** the headroom, and hold a **floor** far
enough above zero to be a warning rather than a cliff.

**2.2 · F3's 22.10px was a constant that would have been measured against itself.** Every term in
it — `rampY`, `lblGap`, `lblAsc`, `cy`, `r`, `ringR` — is a field of `QUICKREF_GEO`. The clearance
is now measured with `getBBox()` in SVG user units and compared against **the label's own em**, so
no `QUICKREF_GEO` term appears on the assertion side at all.

**2.3 · F4b as I planned it would have been near-tautological, which reading the code showed.**
`cmsRenderPreviewPng` builds with `buildClientModel` and renders with `buildClientReportHTML_v3` —
the client's own builder — so "same string, two paths, same line count" compares a page with
itself. It was replaced by the real disagreement (§4.4).

**2.4 · One clause was dropped as redundant.** F3's ring-label check: `verify_diagrams.js` already
asserts label-vs-label and label-vs-node non-overlap across all 72 pairs. Its own note at `:241`
records why non-overlap is not enough — two labels passed it at a 2.49px gap — which is exactly the
gap the clearance floor fills.

## 3. Do F1–F4 hold

Yes. `npm run verify:render`, 35 sheet-5 renders, all green.

```
renders                35
page headroom          min 51.61px · mean 62.19px · max 73.86px
tightest on            16 render(s), types 1,2,3,4,5,7,8,9
summary lines          1-3 (limit 3), line height 18.75px
distinct summaries     27 — SO1..SO9 SP1..SP9 SX1..SX9
label vs legend        min gap 19.86 user units · min ratio 2.34 ems
sibling overlaps       0
page's own line bound  5-5 lines (limit 3, slack 2)
```

## 4. What each assertion catches, and what slips past it

### 4.1 F1 — headroom, recorded and floored

**Where it lives** `scripts/lib/quickref_fit.js` `judgeAcross`, called from the harness after the
loops. The floor is **one rendered summary line**, and the line height is measured off the render
rather than written down, so a font change moves the floor with it.

**Catches** any content growth anywhere on sheet 5 that eats more than ~33px of today's margin — a
longer h2, a fourth tip, a taller figure, a Chromium pin change. It catches it as a warning, about
33px before `enforceSheet` catches it as a failure. It also fails when the line height cannot be
measured, rather than skipping.

**Misses**

- **A fixed height.** If anyone gives `.v3-page` an explicit `height`, the natural-height release
  stops meaning anything, headroom becomes a constant and both this and `enforceSheet` go green
  forever while content is clipped. Nothing here guards it. **Named, not closed** — §7.3.
- **Records not in the harness.** 35 renders is a sample of the fixtures that exist.
- **`z6Governed`.** `enforceSheet` is skipped for a zone-6-governed page. If sheet 5 ever acquires
  that flag it leaves the gate with no diff anywhere near sheet 5.
- **Anything that fits but looks wrong.** Headroom says nothing about balance or orphans.

### 4.2 F2 — the summary bound, both ways, over all 27

**Where it lives** `judgeSheet` (per render) and `judgeAcross` (the coverage claim). The upper
bound is `cap`, **imported** from `cms_quickref_preview.js`, never restated.

**All 27 are covered inside the existing pass** — predicted at 1.3 and confirmed: `anders_sx9`
sweeps 9 types × 3 instincts, and the subtype row keys off the leading hypothesis's type and the
record's instinct, so every one of the 27 appears. The separate 27-string gate the plan proposed
was not needed. The gate asserts the count is 27 rather than assuming it, because it is a property
of the matrix that a later axis change could remove silently.

**Catches** an edited or 28th summary that wraps long; a width change on the box; font-metric
drift; and — via the lower bound — the empty-string class: a renamed leaf, a missed
`resolveLibObject`, an override that resolves to `''`. An empty box "fits" perfectly and nothing
else here would see it.

**Misses**

- **Word width.** SO5 is **161 characters** and still renders inside three lines, above §27's
  132-character "safe ceiling" — which was always sufficient, not necessary. The gate measures what
  rendered; it gives an editor no rule for a string that does not exist yet. That is what the CMS
  probe is for.
- **Every other zone.** `.v3-qr-stxt` is the only zone with a cap. The panel motivations, the h2,
  the tips and the lead are page-bounded — caught by F1 only, so they can grow until the whole
  sheet spills rather than failing at their own boundary.
- **Content that is present, three lines, and wrong.** F2 is a shape check; C4 checks identity.

### 4.3 F3 — clearances

**F3a, the named pair.** Ring label to legend, `getBBox()`, SVG user units, floor of one label em.
Measured min **19.86 units against an 8.5-unit em — a ratio of 2.34**. (The 22.10 figure in the
brief is the label's BASELINE to the legend; 19.86 is its glyph box, which is the more conservative
of the two and the one crowding is actually about.)

**F3b, the sweep.** No two block-level siblings anywhere in sheet 5's subtree may overlap.
**Measured 0 overlaps across all 35 renders, and the allowlist is empty.** Prediction 4.5 said 1 —
I expected `.v3-qr-zone8`'s `margin:-6px` to appear and it does not: a negative top margin closes a
gap, it does not create an overlap.

**F3c, the relation.** `vh === rampY + 32`, asserted on the constants in
`tests/quickref_fit_test.js`. This is the one place a constant is asserted against a constant, and
deliberately: the failure it guards is the viewBox CLIPPING the legend captions, which happens
inside the SVG where no DOM box exists for anything to measure. There is nothing to measure, so the
relation is the only available guard — and it is a relation, so moving `rampY` and `vh` together
stays green.

**Catches** a `rampY`/`lblGap`/`lblAsc` move; an added caption line; a label pushed into the legend
by the collision nudge; the zone-8 gap closing into an overlap; any newly introduced sibling
overlap nobody anticipated; and a viewBox that stops containing its own captions.

**Misses**

- **Crowding that is not overlap and is not this pair.** Text 1px from a border, a label kissing
  the rim. No box-intersection test sees that; only a person does.
- **Anything else clipped inside an SVG viewBox.** The relation covers the captions specifically.
- **A third element overlapping an allowlisted pair.** Entries are per-pair. The list is empty
  today, so this is latent, not live.

### 4.4 F4 — the gate and the editor agree

**F4a — one definition, cross-checked.** The gate imports `fitProbe` and `cap` and asserts nothing
of its own about either. It also runs `fitProbe` alongside its own line counter on every render and
**requires the two counts to be equal** — so the two implementations cannot quietly drift into two
definitions that agree until they don't.

**F4b — the limit must be safe against the page.** The page's own bound is found by **pushing the
page until it spills**, not by dividing headroom by a line height. That distinction is load-bearing
and it is measured: while the instincts panel is the taller of the two flex halves, a summary line
costs the page **nothing** — going from one line to two costs **3.50px**, not 18.75px. Arithmetic
would have reported a bound wrong by a line for exactly the records with the shortest summaries,
which is four of the 35.

The assertion is **`cap + 1` must still fit**. Measured bound is 5, cap is 3, slack is 2.

**F4c — the population the verdict claims must be the population it measured.** This is the one
that found something. `server.js:13994` gives every static key `type: 9, instinct: 'SP'`, and the
sweep ran types 1..9 **all at SP** — nine of the twenty-seven records a static string reaches. It
mattered because sheet 5's height varies with exactly one thing, the summary's line count, and that
is a property of the (type, instinct) PAIR: only three page heights exist across all 35 records,
and **16 of the 35 sit at the tightest, spanning eight different types**. So "Type 1 is tightest"
named a type for something that is not a fact about types, and the SP-only sweep found the true
worst only because SP happens to include three-line summaries. Had they been shorter, an editor
would have been told there was 70.36px of room while their readers got 51.61px — one whole line of
overstatement, silently. The sweep now covers all 27, and lives in `cms_quickref_preview.js` where
`tests/quickref_fit_test.js` asserts its coverage.

**Catches** a cap raised past what the page carries; two line-counting implementations drifting; a
sweep that stops covering the population; a `cap` edited in one place and not the other.

**Misses**

- **A cap that is wrong in both places.** What keeps `cap: 3` honest is F4b's measured bound, which
  is recorded every run. The assertions interlock: F1's recording and F4b's bound are the evidence
  for the cap that F2 enforces.
- **Strings that never reach the probe.** IO-93's downstream half is still open — see §7.4.
- **The render context.** Both sides run in the same pinned Chromium at the same viewport.

## 5. The PDF — checked, then closed here

**What already existed: nothing.** `render_client.js:883` wrote a PDF per render and no gate ever
opened it. `sheets` at `:366` is `ceil(height / (PAGE_PX + 1))` — a DOM estimate, printed as
"estimated physical sheets". `verify_transparency.js` reads PDF bytes but scans for transparency
objects, not pages. Prediction 6.1 confirmed.

**What was added.** `scripts/lib/pdf_pages.js` counts `/Type /Page` objects (excluding `/Type
/Pages`), cross-checks against the page tree's own `/Count`, and **fails on disagreement rather
than picking a winner** — two readings of one file that disagree mean the parse is wrong, and a
reader that silently prefers one has stopped measuring. A parse that finds zero page objects also
fails, because zero would pass everything.

**What it asserts.** Not the logical page count — the DOM's own **prediction**. `sheets` is what the
proxy says the file will be; the PDF is what it is. Matching them validates the proxy against the
artefact in both directions: a page that fits in the DOM and paginates differently in print shows
up as more sheets, and a Z6 hazard state declared to spill whose PDF comes back at one sheet per
page shows up as fewer — which would mean the spill was never reaching the PDF at all and the
declaration was being validated against nothing.

It first ran expecting `pages.length` and **failed on `sp4_t4_z6-em_paragraph`**: 11 logical pages,
12 PDF sheets. That state is DECLARED to spill (`declared 7 lines / spills, observed 7 lines /
spills`), so 12 is correct and the expectation was wrong. Corrected, not suppressed.

**The control runs where the gate runs.** Prediction 6.4 was wrong in the useful direction:
`page.pdf()` is not the Linux-only half — `verify_coach_baseline.js`'s **hash comparison** is. So
the PDF control renders a real spilled document and reads it back **on this Mac and in CI both**.
It measured 14 sheets against an expectation of 11 and went red as required.

## 6. Every positive control, observed RED

`node scripts/verify_quickref_fit.js` — **15/15 behaved as required**, and it is wired into CI as a
seventh gate in the same build that wrote it.

| Control | Expected | Got |
|---|---|---|
| negative control — an untouched sheet 5 is silent | quiet | quiet |
| F2 upper — a 5-line summary over the 3-line limit | RED | RED |
| F2 lower — an empty summary | RED | RED |
| F3a — a label crowding the legend **without overlapping it** | RED | RED |
| F3b — a block dragged onto its sibling | RED | RED |
| F4b — a cap the page cannot carry | RED | RED |
| F4a — gate and editor disagreeing about a line count | RED | RED |
| PDF — a spilled document reads back as 14 sheets | RED | RED |
| PDF — the reader finds page objects at all | quiet | quiet |
| F1 — a sheet with under one line of headroom | RED | RED |
| F1 — an unmeasurable line height (not skipped) | RED | RED |
| F2 coverage — fewer than 27 summaries rendered | RED | RED |
| FIT — a missing sheet 5 fails rather than skipping | RED | RED |
| geo — `vh = rampY + 32` today | quiet | quiet |
| geo — `rampY` moved without `vh` | RED | RED |

They drive the **same** predicate functions the harness calls — `judgeSheet`, `judgeOverlaps`,
`judgeAcross`, `checkPageCount` — not a paraphrase, which is why the predicates were lifted out of
the harness into `scripts/lib/quickref_fit.js`. The F3a control is the one worth pointing at: it
moves a label to y=320, **inside the one-em floor but not overlapping the legend at y=324**, which
is precisely the case `verify_diagrams`' non-overlap test cannot see.

## 7. Predictions against measurement

Full table in `docs/predictions_pr5_buildB3.md`. Confirmed: 1.1–1.5, 2.1, 2.2, 2.3, 2.5–2.8,
3.4, 3.5, 4.1, 4.2, 4.4, 4.6, 5.1, 5.3, 5.6, 6.1, 6.2, 6.3, 6.5, 7.1–7.3, 8.1–8.4.

**Wrong, and what the deviation was**

| # | Predicted | Measured |
|---|---|---|
| 2.4 | Type 1 carries the minimum headroom | **16 of 35 renders tie at 51.61px, across eight types.** The minimum is not a fact about Type 1 at all — it is a fact about (type, instinct). This is the same error the B4 comment made, and it is what §4.4's finding rests on |
| 3.1 | all 27 summaries render at 2 or 3 lines | **1 to 3.** SP9, SO9 and SP6 are short enough for one line |
| 3.3 | zero summaries render at 1 line | **wrong** — so F2's lower bound was built at 1, not the 2 the plan proposed |
| 4.3 | clearance ratio 2.60 today | **2.34** — 2.60 is the ratio using the label's baseline, 2.34 using its glyph box, which is what `getBBox()` measures and the stricter of the two |
| 4.5 | the sweep finds 1 overlap | **0.** I said I expected to be wrong about this number and was |
| 5.7 | F4b goes RED on first run | **It would have.** The assertion I planned — "cap + 1 spills, as the message claims" — is false by two lines. Rather than ship a red gate I changed the ASSERTION to the safety property (`cap + 1` must fit) and fixed the false message instead. That is a decision, recorded here rather than absorbed: the finding was real, the red was avoided by correcting the thing that was wrong |
| 6.4 | the PDF control cannot be red-proven off Linux | **wrong, usefully.** `page.pdf()` runs here; only the hash comparison is Linux-only |

## 8. Execution

Commits: predictions → the shared measurement module → the harness wiring → the preview
corrections → controls, tests and CI → docs. `npm test` 33 → **43**. Workflow gates 6 → **7**.

**Inert by construction, measured not assumed.** Main was rendered in a **separate git worktree**
and compared file by file against a branch render into a wiped `.phase6_out`: **39 of 39 rendered
documents byte-identical**. The worktree is because `git checkout` reverts source but not
`.phase6_out`, which has contaminated a before/after comparison in this project once already; and
`git stash` is not used in this repo at all.

**Gates run locally**: `npm test` 43/43 · `verify:render` all passed, 0 failures ·
`verify_quickref_fit` 15/15 · `verify_diagrams` all passed · `verify_transparency` all passed ·
`verify_content_library` all passed · `verify_coach_baseline` **HALF-RESULT — HTML byte-identical,
PDF hash SKIPPED off Linux**. `scripts/check_docs.py` run by hand, exit 0.

## 9. Issues that emerged

**9.1 · Backticks in a comment inside a JS template literal**, terminating the literal. The exact
mistake this project recorded once before. Caught by `node --check` on the first write.

**9.2 · The PDF gate's first expectation was wrong**, not the render — §5.

**9.3 · A scratch probe discarded `applyInstinct`'s return value** (it returns a new object rather
than mutating), so an early reading showed SX summaries under SP labels. Scratch only; the harness
applies the axis correctly and the 27 distinct codes confirm it.

**9.4 · `content_library.json` is at `app/content/`, not the repo root** — two failed scratch
requires before I looked instead of guessing.

## 10. Outstanding — what needs your help

**10.1 · Two wordings changed and NOT ratified.** Both are editor-facing CMS copy, and B4's wording
was your decision, so these are proposals sitting in the code rather than settled:

- over-limit: *"This runs to 5 lines. Three is the limit for this panel."* — the previous sentence
  claimed a page spill that measurement says does not happen. I removed the claim rather than
  making it conditional, because F4b now asserts `cap + 1` fits, so it could never become true
  without that gate going red first. If you would rather keep a consequence in the sentence, the
  honest one is about the panel's balance against the instincts beside it, and that is a design
  claim I am not in a position to make for you.
- survey: *"Checked on all 27 type and instinct combinations; SP1 is tightest."* — was "all 9
  types; Type 1 is tightest". The count changed because the sweep did; naming the record rather
  than the type is what §4.4 requires. `SP1` is precise and is also jargon for a content editor —
  worth a look.

**10.2 · Should `cap` stay at 3?** The page carries 5. Three is defensible as a design limit and I
have not moved it; F4b only requires it to be safe. But it is now a **choice** rather than the
layout fact it was documented as, and it should be a choice someone made on purpose.

**10.3 · A fixed `height` on `.v3-page` would blind both F1 and `enforceSheet`.** Named in §4.1,
not closed. It is a one-line assertion (`computed height must be driven by content`) and it belongs
with the shared v3 page styles rather than in sheet 5's gate, which is why it is not in this build.

**10.4 · IO-93's downstream half is still open.** B4 closed the upstream half; this build does not
touch it. A check over PUBLISHED overrides belongs with `overrides_check.js`.

**10.5 · Mo's voice pass.** The 27 summaries and 9 core motivations remain DRAFT. F2's lower bound
can legitimately go red if a summary is shortened to a single line — as you said, that is the gate
doing its job, and the bound moves with a recorded reason.

**10.6 · `.sname`'s leading article.** Still open. "The One-to-One One" still reads oddly.

## 11. Does B3 close PR 5

**On code, yes.** F1–F4 hold, every predicate has been observed red, the PDF gap §8 of the plan
named is closed rather than carded, and the gate is wired into CI in the same build.

**What does not close with PR 5**: 10.2 through 10.6 above. None is a code defect in sheet 5; they
are a design decision, a guard that belongs to the shared page shell, a check that belongs with the
overrides tooling, a content pass, and an open copy question.

**The handoff for PR 7 and the workflow PR is at `docs/handoff_pr7_and_workflow.md`**, in the repo
rather than in anyone's memory.
