# PR 5 · Build B2a — the resolved hypothesis pair, and a collided record the harness can render

**Branch** `pr5-buildB2a-hypothesis-pair`, base `51a85df`. Predictions committed first at
**`7e56eb2`**. **No page** — no `_clv3QuickRef`, no `built` flag, no `PAGE_INVENTORY` bump. Every
`§N` names a section of `docs/audit_pr5_quickref.md` unless said otherwise.

## 1. Were the two outcomes achieved, and how do I know

### 1.1 The system can carry two distinct, correctly-roled hypotheses from one source — YES

`pages.v3_quickref.hypotheses`, two entries, both resolved from `charts.types` positions 1 and 2.
`[MEASURED]` on the `anders_sx9` fixture, both record shapes:

| | ORDINARY | COLLIDED |
|---|---|---|
| entries | **2** | **2** |
| roles | `leading` / `alternate` | `leading` / `alternate` |
| numbers | **9 / 5** | **9 / 5** |
| matches figure's ring positions 1 and 2 | **yes** | **yes** |
| `m.hero.number` | 9 — same as pair | 9 — same as pair |
| `m.alternate.number` | 5 — same as pair | **9 — DIFFERS from the pair** |

**That last cell is the build.** On a collided record the scalar says 9 and the pair says 5, and the
pair is the one that agrees with the figure. The demonstration that opened the B2 audit — a panel
printing *"Type 9 — The Peacemaker"* beside a dashed ring on node 5 — is now impossible to build by
accident, because the panels' source and the rings' source are the same ordering.

**Why C1–C3 are structural rather than checked.** `typeRamp` places `heroN`, then `altN`, then the
ranking, then 1–9, skipping anything already placed. Positions 1 and 2 are therefore distinct on
every record whatever arrives — including a malformed `call1_ranking`, which is the case the
de-duplication was written for. The pair is a fixed-length-2 map over those two positions, so:

* **C1** — a page cannot render one hypothesis; there is no code path, only an array of two.
* **C2** — `role` travels *with* the data, so a label and its type cannot be transposed by a
  template edit.
* **C3** — free, from the de-duplication.
* **C4** — one place turns a position into a type; everything downstream reads its output. The last
  link is B2b's: the builder must map over the array rather than reading `[0]` and `[1]` into two
  hand-written blocks, and must pass `hypotheses[0].number` as the figure's `leading`.

### 1.2 A collided record can be produced and rendered — YES, for the first time

`[MEASURED]`: **32 → 35** `client_v3` renders. Three new artefacts, byte-distinct filenames:

```
client_v3_anders_sx9_t9_collided.html
client_v3_anders_sx9_t9_sp_primary_collided.html
client_v3_anders_sx9_t9_so_primary_collided.html
```

**All 32 pre-existing renders are byte-identical**, established by rendering the whole matrix twice
against a wiped output directory — once with the axis reverted, once with it — and diffing
`[MEASURED]`, 32 of 32. A new axis defaulting to `[null]` is byte-neutral, proved rather than
assumed.

**Why it had never happened.** The harness's retype rule is
`alternate_candidate = (asType % 9) + 1`, which has **no fixed point on 1..9**. Across the whole
32-render matrix the collided shape was unreachable — in a project whose sheet 5 exists to present
two hypotheses on exactly that record.

## 2. Execution

**`app/report_prep.js`** — `typeRamp` hoisted to a single call (`typeBars0`) read by both
`charts.types` and the pair, so there is one ordering by construction rather than two calls that
happen to agree. The pair is built beside `v3SubtypeRows`, the other resolve-once-consume-twice
helper, and hung on `pages.v3_quickref.hypotheses`.

**`m.alternate` is untouched**, deliberately: `renderer.js:2285` and `:2315` (the v2 client report)
and `:1785` and `:1850` (the coach report) read it, and both ship today. For a coach, "the type the
engine named" stays the truth worth having; the collision's provenance reaches them through
`collision_flag`. The pair is the **client's sheet-5 view**, added beside it.

**`motivation` is left `null`.** Which library field the panels read is the content decision in
flight; the *shape* lands now so B2b has one field to fill rather than a structure to invent.
Resolving the wrong field today would have to be undone.

**`tests/fixtures/instinct_axis.js`** — `applyCollision`, mirroring `applyZ6`. It sets **only**
`alternate_candidate`: `call1_ranking` is left alone because a real collided record still has a
runner-up, and that is where position 2 comes from; `leading_candidate` is left alone because on a
stage-4 REDIRECT it legitimately differs from `confirmed_type`, and collapsing them would fold two
engine states into one fixture.

**`scripts/render_client.js`** — `collidedFor(fx, asType)`, innermost, defaulting to `[null]`.
Applied to `anders_sx9` at its **own** type 9, not a re-typed clone: collapsing a synthetic
alternate onto a synthetic leading would model a fixture artefact rather than the engine state.

**One (fixture, type) pair, not a sweep.** The nine-way collided sweep that matters is the
*figure's*, and `verify_diagrams` already does it — 1×1 through 9×9, asserting the dashed ring lands
on position 2's node. Duplicating it here would spend renders re-proving a geometry another gate
owns.

**`CLIENT_SPEC` validation — included, as a warning.** C1 and C3 cannot fire on any record the
engine can produce; it exists for the case `typeRamp`'s guarantee is ever weakened. **Not a throw**,
for `call2_stamp`'s own reason: it ships imperfect records deliberately so the client still gets a
report, and a fatal prep-time check would refuse to render a record the engine chose to send. The
hard gate belongs at render time over the emitted page — B2b's. `[MEASURED]`: **0 warnings** on
`anders_sx9`, collided `anders_sx9`, `sp4` and `sx7`.

## 3. Issues that emerged, and how they were solved

**a. A7's stated reason is stale since Build R — named before it was tripped.** `render_client.js`'s
third A7 clause asserts `call1_ranking[1].type === alternate_candidate` on the grounds that otherwise
*"the ALTERNATE ring and the ramp ordering would disagree."* **After Build R the ring reads position
2 — it reads the ramp ordering — so those two cannot disagree.** What survives is a narrower
fixture-sanity check: that the retype helper left the clone coherent. The comment now says that
plainly rather than leaving a guarantee it no longer provides.

**It needed no exemption**, which is the part worth recording: A7 reads `retyped`, which is
*upstream* of `applyCollision` — the collision is applied on a further clone inside the z6 loop. Had
the axis been placed higher it would have had to be exempted, because a collided record differs from
the runner-up by construction. That is written down so the next person moving an axis knows why the
order matters.

**b. Two errors of mine, both caught by the checks rather than by review.** The first insertion left
the `collKey` loop unclosed and included a placeholder guard line I should not have written —
`node --check` failed and both were removed. Recorded because the placeholder referenced an
undefined symbol and would have thrown at runtime, not at parse, had it been syntactically valid.

**c. The output tag would have silently overwritten a render, and this is the one worth reading.**
`tag` is built from fixture, type, instinct and Z6 — not from the new axis. Without adding it, the
collided render and its own control shared a filename, and **the artefact a reviewer opened would
have been whichever ran last.** The gate would have stayed green: nothing counts artefacts. Fixed,
and commented at the site as a rule — every axis that varies a render must appear in the tag.

**d. A contaminated comparison, redone.** The first before/after artefact diff reported "39 before,
39 after, 0 new", which is wrong: `git checkout` reverts source but does not delete
`.phase6_out`, so the collided artefacts from the previous run survived into the "before" set and
compared against themselves. Redone with the directory wiped between runs; the real figures are
32 → 35 with 32 of 32 byte-identical.

## 4. Gates

| gate | predicted | measured | |
|---|---|---|---|
| `npm test` | 0.23–0.45 s | **0.22 / 0.25 s** | ✓ |
| `npm run verify:render` | 56–58 s | **56.15 s** | ✓ |
| `verify_diagrams.js` | 1.2–1.4 s | **1.12 s** | ✗ marginally — 0.08 s under |
| `verify_transparency.js` | 7.5–7.7 s | **7.50 s** | ✓ |
| `verify_coach_baseline.js` | 2.8–2.9 s | **2.82 s** | ✓ |
| `verify_content_library.js` | 0.2 s | **0.21 s** | ✓ |

Six green, 27 tests pass, 0 fail. Library unmoved at **2112 / 796 / 1316** — no content changed.
**0 of 10 v3 document renders differ** from `51a85df` `[MEASURED]`, by diff: the pair is additive
model data and no builder reads it.

**`verify_coach_baseline.js` does not apply** — the coach model gets no `v3_quickref` slot, and
`m.alternate` is untouched. Run anyway it printed `ALL PASSED — HTML only (PDF half skipped
off-Linux)`, a **HALF-RESULT**, not a pass.

## 5. Predictions versus measurement

`7e56eb2`. **21 of 22 scored items hit.** The miss is `verify_diagrams` at 1.12 s against a
1.2–1.4 s band — 0.08 s under, on a two-sample baseline. Recorded because a range is a claim.

Every outcome prediction (A0.1–A0.4), every pair property (1.1–1.6), the render count (**35**), the
byte-neutrality of the axis (**32/32**), the v3 document renders (**0 of 10**), the warning count
(**0**), and all five file predictions hit. The A7 staleness (2.1–2.3) was called before the build
and confirmed.

## 6. Outstanding — nothing blocking, one thing to decide

**Nothing blocks B2b that was not already known.** The panel copy is in flight with Cai and Mo and
was explicitly not this build's.

**One question I would like answered before B2b, not by it:** whether the pair should carry the
**subtype** too. Sheet 5's subtype panel currently reads `pages.v3_quickref.subtype`, resolved from
`display.instinct_code` — a third source. It cannot disagree with the hypotheses today because the
subtype is always the *leading* type's, and the leading type is position 1 either way. But that is a
convention holding, not a construction, and it is exactly the shape of the defect this build
removed. It is one line to fold in and I did not do it unasked.

## 7. What B2b inherits

* **The pair, and one instruction: map over it.** Reading `hypotheses[0]` and `[1]` into two
  hand-written panel blocks would restore by hand the transposition risk `role` exists to remove.
* **Pass `hypotheses[0].number` as the figure's `leading`.** Identical to `hero.number` on every
  record — `typeRamp` places `heroN` at position 1 unconditionally — but sourced from the pair
  rather than agreeing with it. That closes the last conventional link in C4.
* **A collided record renders.** `client_v3_anders_sx9_t9_collided.html` exists in `.phase6_out`
  from the first commit of B2b onward, so the C4 assertion has the record it needs on day one and
  the smoke sheet has a page to photograph.
* **The C4 assertion is unchanged from the plan** — extract both ring node numbers, both ring
  labels' nodes and both panel headings from the emitted page; assert the three-way agreement per
  role and that the two roles name different types; run it across all 35 renders.
* **One plan change:** the plan said the collided record's visibility "comes before the page". It
  does now, and the axis costs **+3 renders** rather than the +1 I estimated — the instinct axis
  multiplies it. 56.15 s against 52.62 s, which is the price of the record and is worth it.
