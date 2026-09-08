# PR 5 Build 1 — data exposure, the shared instinct rule, and the harness

Branch `pr5-build1-data-exposure`, off `main @ 216e926`. Scope and assertions from
`docs/audit_pr5_quickref.md` **§22.4d** (not §§19-21 — see the build report).

**Every number below is labelled `[MEASURED]` or `[ESTIMATED]`.** On the docs PR the whole
wall-clock deviation sat in unlabelled estimates while the one scaled figure held to 4.9%, so
nothing here carries a decimal point without saying where it came from.

---

## 1. Predictions, committed before the code changed

### 1.1 What the build will and will not move

| # | Prediction | Basis |
|---|---|---|
| P1 | **The v3 client HTML is byte-identical before and after the ENTIRE build**, for all nine types — not just after the `instinctRanks` extraction. | `[MEASURED]` No v3 page builder reads `m.alternate` or `confidence.near_tie` (`awk 'NR>3140' app/renderer.js \| grep` → no hits; the three readers are `:1576` coach and `:2076`/`:2106` v2 p3). Nothing renders `charts.types` yet. So every change in this build is invisible to the emitted document. |
| P2 | **The 27-render 3×9 instinct matrix stays green**, and it is a weaker statement than P1. | `[MEASURED]` — it is the gate; P1 is the proof. |
| P3 | **`charts.types` will carry exactly 9 entries** for all three fixtures. | `[MEASURED]` — all three `*_api_result.json` carry `call1_ranking` at 9/9 (audit §20.1). |
| P4 | **The page count does not change: 10.** No `V3_PAGE_ORDER` edit, no tripwire edit. | `[MEASURED]` — `report_page_inventory.js:47` is `client_v3: { 'v3-page': 10 }` and this build does not touch it. |

### 1.2 A7, red first

| # | Prediction | Basis |
|---|---|---|
| P5 | A7 fails on **exactly 8 of 9 types** for `anders_sx9` (types 1–8) and **0 of 1** for `sp4`. | `[MEASURED]` — the table in audit §19.1. `asType 9` passes because `leading_candidate` is already 9 and `call1 #1` is already 9. `sp4` renders only at its own type 4, so its scalars already agree. |
| P6 | The red run fails **on the assertion's own message**, not on a `TypeError`. | `[ESTIMATED]` — it is what the assertion is written to do; the proof is the captured text. |

### 1.3 Gates

| # | Prediction | Basis |
|---|---|---|
| P7 | **Coach byte-diff: HTML half PASSES, PDF half SKIPS.** A local pass is a **HALF-RESULT** and is not something to merge on. | `[MEASURED]` — this machine printed `COACH BASELINE: ALL PASSED — HTML only (PDF half skipped off-Linux)` earlier today. |
| P8 | All six gates green after the build. | `[MEASURED]` premise (P1: no rendered output moves) + `[ESTIMATED]` conclusion. |

### 1.4 Timings — local, on this machine

Baselines measured on `main @ 216e926` earlier today, macOS, Chromium 147.0.7727.57:

| Gate | Baseline `[MEASURED]` | Predicted after the build | Label |
|---|---|---|---|
| `npm test` | 0.31s | 0.3–0.5s | `[ESTIMATED]` |
| `npm run verify:render` | 52.53s | 52–56s | `[ESTIMATED]` |
| `verify_diagrams.js` | 0.95s | 0.9–1.0s | `[ESTIMATED]` — untouched |
| `verify_transparency.js` | 2.89s | 2.8–3.0s | `[ESTIMATED]` — untouched |
| `verify_coach_baseline.js` | 2.85s | 2.8–3.0s | `[ESTIMATED]` |
| `verify_content_library.js` | 0.22s | 0.2–0.3s | `[ESTIMATED]` — untouched |

**The four "untouched" rows are the honest ones**; the two that could move are `verify:render`
(the harness changes) and `npm test` (new assertions). **No CI prediction is made** — this prompt
stops at the commit, so no CI runs.

**A note on the estimate labels, given the docs-PR finding.** The only figures with a measured
basis are the baselines. Every "predicted after" cell is an estimate, and the honest content of
each is "roughly unchanged, because the work added is small next to 27 renders." If one of them
moves by more than a few percent that is a finding.

---
## 2. The build report

### 2.1 Predictions against actuals

| # | Prediction | Actual | |
|---|---|---|---|
| P1 | v3 client HTML byte-identical before and after the **entire** build, 9 types | **40/40 renders byte-identical** to `main @ 216e926` (2 fixtures × 9 types × 4 instinct states), re-checked after each of the four code commits | **HELD** |
| P2 | 27-render matrix green | `RENDER CHECK: ALL PASSED` | **HELD** |
| P3 | `charts.types` = 9 entries, all fixtures | 9/9, integer, `{type, score}` with no `color` key | **HELD** |
| P4 | Page count stays 10, tripwire untouched | `report_page_inventory.js:47` unchanged at `{ 'v3-page': 10 }` | **HELD** |
| P5 | A7 fails on 8 of 9 anders types, 0 of 1 sp4 | **8 of 9 and 0 of 1 for the two-clause A7 the plan specified. 9 of 9 and 1 of 1 for the three-clause A7 I built.** | **DEVIATED — see 2.2** |
| P6 | Red run fails on the assertion's message, not a `TypeError` | 73 `fail()` lines, **0** TypeError/abort lines, run reached `RENDER CHECK: FAILURES ABOVE.` | **HELD** |
| P7 | Coach byte-diff: HTML half passes, **PDF half skips** | `ALL PASSED — HTML only (PDF half skipped off-Linux)` — a **HALF RESULT** | **HELD** |
| P8 | All six gates green | all six green | **HELD** |

**Timings — every figure `[MEASURED]`, baselines from `main @ 216e926` earlier today.**

| Gate | Baseline | Predicted | Actual | Δ vs baseline |
|---|---|---|---|---|
| `npm test` | 0.31s | 0.3–0.5s `[ESTIMATED]` | **0.25s** | −0.06s |
| `verify:render` | 52.53s | 52–56s `[ESTIMATED]` | **52.39s** | −0.14s |
| `verify_diagrams` | 0.95s | 0.9–1.0s `[ESTIMATED]` | **0.93s** | −0.02s |
| `verify_transparency` | 2.89s | 2.8–3.0s `[ESTIMATED]` | **2.88s** | −0.01s |
| `verify_coach_baseline` | 2.85s | 2.8–3.0s `[ESTIMATED]` | **2.87s** | +0.02s |
| `verify_content_library` | 0.22s | 0.2–0.3s `[ESTIMATED]` | **0.22s** | 0.00s |

All six inside their predicted ranges. `npm test` came in 0.06s under a floor of 0.3s — noise at
this scale, on a 90ms test body, and not treated as a finding.

### 2.2 The one deviation, and it is mine

**P5 was exactly right for what it predicted and wrong for what I built.**

The plan (audit §22.4d) specified A7 as two clauses: `leading_candidate === confirmed_type` and
`call1_ranking` position 1 `=== confirmed_type`. P5 predicted those fail on 8 of 9 anders types and
0 of 1 for sp4. **Measured on the red run, that subset fails on exactly anders types 1–8 and not on
sp4 — the prediction to the type.**

I then built a **three**-clause A7, adding `call1_ranking` position 2 `=== alternate_candidate`
because the audit's §19.1 table shows those disagreeing. The third clause fails on 9 types plus sp4, and
that is the whole deviation.

| Clause | Failing (fixture, asType) pairs |
|---|---|
| `leading_candidate !== asType` | **8** — anders 1–8 |
| `call1_ranking #1 !== asType` | **8** — anders 1–8 |
| `call1_ranking #2 !== alternate_candidate` | **9** — anders 1,2,3,5,6,7,8,9 **+ sp4 4** |

`[JUDGMENT]` **The assertion is better for the third clause; the prediction discipline was worse.**
Widening an assertion after committing a prediction against the narrower one converts a falsifiable
claim into an unfalsifiable one — the same failure as an unlabelled estimate, one level up. The fix
is not to drop the clause: it is that widening a gate should re-open its prediction in the same
commit.

Noted for the record: anders `asType 4` passes the position-2 clause by coincidence —
`(4 % 9) + 1 = 5`, and `call1 #2` is 5.

### 2.3 Assertions, and what each one's red-proof was

Every gate shown failing **for the right reason** against a green control, asserting on the failure
text.

| # | Assertion | Red-proof | Result |
|---|---|---|---|
| A1 | v3 HTML byte-identical across the `instinctRanks` extraction | `instinctRanks`' sort reversed | **40/40 renders differ**; restored, green |
| A2 | 27-render matrix green | — (it is the weaker gate; A1 is the proof) | green |
| A3 | `charts.types` carries one entry per type 1–9 | emptied · **the 2-entry CMS shape** · 8 entries · a duplicate · a stray type 10 | all **red**; control green |
| A4 | scores integer, 0–100 | a score of 140 → **red**; a score of **84.5 → green** (rounds, as designed) | both as specified |
| A5 | `hero.number` and `alternate.number` each have a node | each removed from the ramp in turn | both **red**, naming the missing ring |
| A6 | `alternate_core_motivation` non-empty **and not the hero's** | asserted in `report_pages_test.js` | green |
| A7 | re-typed scalars agree with the re-typed page | **written red first**, 73 `fail()` lines, 0 TypeErrors | red → fixed → green |
| A8 | CMS stub emits 9 entries | a two-entry stub → **red** | 27/27 permutations build |

**A3's red-proof found a real under-implementation.** As first written, A3 leaned on
`nonEmptyArrays`, and **the two-entry CMS stub shape passed every check** — its two entries are the
hero and the alternate, so even `nodesFor` was satisfied. It would have rendered two of nine nodes
on a green build. `ninePerType` was added in response, and runs **before** `nodesFor` so a malformed
array is diagnosed as malformed rather than as a missing ring.

### 2.4 The coach byte-diff — which half

**HTML half: PASSED. PDF half: SKIPPED.** `COACH BASELINE: ALL PASSED — HTML only (PDF half skipped
off-Linux)`, on every run in this build. **This is a HALF RESULT and is not something to merge on.**
The PDF half needs Linux with Liberation Sans, which is what CI provides and this machine does not.

Predicted in advance as P7 rather than reported afterwards, so it cannot read as a full pass.

### 2.5 Scope

**Touched:** `app/renderer.js`, `app/report_prep.js`, `app/server.js`, `scripts/render_client.js`,
`tests/report_pages_test.js`, and two `.md`.

**Not touched, as scoped:** `app/content/content_library.json`, any `.docx`,
`scripts/verify_diagrams.js`, `V3_PAGE_ORDER`, `tests/lib/report_page_inventory.js`. Nothing in the
build wanted one of them, so there is no scope finding.

`V3_PAGE_ORDER` is untouched and **no entry acquired a `pilotTypes` key** — still 0 of 12, and
`v3PagesFor` still honours it. Build 2 edits that file.

### 2.6 What carries the guarantee

The pilot-list lesson applied to each change:

* **`instinctRanks`** — a mechanism moved, not replaced. The guarantee ("p5 and p10 cannot disagree
  about which instinct is Primary") is carried by there being **one** implementation, and by the
  comment on it naming the other two ordering rules so the next reader cannot import the wrong one.
  If it is ever inlined again, nothing detects that; **that is a known gap and the audit's §22.3
  byte-identical check is the tool if it is ever wanted as a gate.**
* **The harness fix** — a mechanism added, nothing displaced. The guarantee ("the harness cannot
  render a page that contradicts its own scalars") is carried by **A7**, not by the retype block
  being written correctly. If the retype is rewritten, A7 survives it.
* **`validateModel`** — the guarantee ("sheet 5's rings always have nodes") is carried by
  `ninePerType` + `nodesFor`, which test the invariant rather than a scalar proxy. The scalar proxy
  A5 originally specified would have passed the two-entry stub.

---

## 3. Phase B — predictions, committed before the push

**Committed before the branch was pushed and before any PR existed.** A deviation is a **finding**.

### 3.1 Expected-red: what CI does with `74f47b5`

`74f47b5` ("A7 — RED BY DESIGN") is deliberately failing. Stated **before** the run:

| Prediction | Basis |
|---|---|
| **The `pull_request` run tests the BRANCH HEAD**, not any intermediate commit. `gh` reports its `headSha` as the PR head — the docs PR's run reported `66f2cfe`, which was that branch's head. | `[MEASURED]` on run `34183865983` |
| **No run fires on `74f47b5`.** `pull_request` fires on PR open/synchronize against the head; `push` fires only on `main`. Neither addresses an intermediate commit. | `[MEASURED]` — workflow lines 17–20 |
| **So the deliberate red is invisible to CI and cannot fail this PR.** It is reachable only by checking that commit out and running the gates by hand, where it fails by design. | `[ESTIMATED]` from the two above |
| **The merge commit's `push` run also does not test it** — it tests the merge result. | `[MEASURED]` |

**If a run does fire on `74f47b5` and fails, that is EXPECTED-RED, not a build failure** — and it
would also be a finding about the workflow, because nothing in the triggers should produce it.

### 3.2 The runs

| # | Prediction | Basis |
|---|---|---|
| Q1 | Bare branch push → **zero** runs | `[MEASURED]` — held on the docs PR |
| Q2 | Opening the PR → **exactly one** run, `pull_request`, on the branch head | `[MEASURED]` |
| Q3 | **PR number #95** (last merged #94) | `[MEASURED]` |
| Q4 | **All 11 named steps run, none skip** — no path filters, no step-level `if:` | `[MEASURED]` |
| Q5 | Merging → a **second** run, `push`, on the merge commit SHA | `[MEASURED]` |
| Q6 | Both runs `success` on every step | `[ESTIMATED]`, premises measured — see 3.4 |

### 3.3 Wall-clock — a measured basis this time

The docs PR gives real CI numbers for this exact workflow: **branch 2m06s, merge 1m58s**, of which
**117s** was steps — setup 20s, `verify:render` **85s**, everything else ~12s. `[MEASURED]`

Build 1's local `verify:render` is **52.39s** against a **52.53s** baseline — **−0.3%**. `[MEASURED]`
So the dominant step should not move.

> **Point estimate 2m06s, predicted range 1m50s – 2m30s, for both runs.** `[ESTIMATED]` from
> measured components. **The docs-PR lesson is applied**: last time the render step (scaled from
> measurement) held to 4.9% while the setup steps (estimated by feel) were 3.5× out. Setup is now
> measured at ~20s rather than guessed at ~70s, and that is where the whole previous deviation sat.

### 3.4 ⚠ The coach byte-diff — the half that has never run

**This branch run is Build 1's first full coach byte-diff.** Every local run reported
`ALL PASSED — HTML only (PDF half skipped off-Linux)`.

| Half | Prediction | Basis |
|---|---|---|
| **HTML** | **PASS** — coach HTML byte-identical | `[MEASURED]` locally on every run of this build |
| **PDF hash** | **PASS** | `[ESTIMATED]` from measured premises below |

The premises, each `[MEASURED]` on the branch diff:

* the **coach** `charts` line (`report_prep.js:195`, `typeBars`) has no `+`/`-` in the diff;
* `COACH_SPEC` is unchanged, so `validateModel`'s two new loops (`ninePerType`, `nodesFor`) iterate
  empty lists for the coach and cannot alter it;
* `buildCoachReportHTML` and `_coachPage1/2/3` are untouched;
* `instinctRanks` is called only from `_clv3Instincts`, a client v3 page;
* everything added to the model — `charts.types`, `alternate_core_motivation` — is on the **client**
  model only.

The PDF is a deterministic render of that HTML on pinned Chromium 147 with Liberation Sans.
Identical input, identical environment, identical output.

**A PDF-half failure is a finding and it stops the merge.** It would mean the coach PDF moved while
its HTML did not — a rendering-level change from something in this build, which none of the premises
above predicts. It will not be re-run and will not be read as a flake.

### 3.5 The merge

| Prediction | Value | Basis |
|---|---|---|
| Files changed | **9** (6 code/script/test + 3 `.md`) | `[MEASURED]` |
| Line delta | **+587 / −51** | `[MEASURED]` |
| Non-`.md` paths | **6** — this is a code PR, not a docs PR | `[MEASURED]` |
| Merge commit parents | **2** (`--no-ff`) | `[MEASURED]` |
| Branch commits landing | **10** (11 in `rev-list` including the merge) | `[MEASURED]` — stated both ways, since the docs PR's "9 vs 10" was a definitional miss |

**These are the figures as of commit 10 (`4318358`).** This commit adds §3, so the final numbers are
larger by its own diff — one file, `docs/build_pr5_build1.md`. **File count stays 9, non-`.md` stays
6; only the insertion count moves.** Predicted rather than explained afterwards.
