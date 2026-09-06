# Audit — PR 4 step 2, the fixture axis

**Branch:** `pr-4-step2-fixture-axis-audit`, off `main` @
`feb5e4f4aef18f18a08131d05b97c1040ef7bd86` (`feb5e4f` — "Merge pull request #86"), pulled and
confirmed 6 Sep 2026. Main had moved: step 1 merged at `13119b4`, and `pr-4-instincts-audit` is
gone from local and remote. [CC-MEASURED]

**Nature:** audit. No harness change, no fixture written, no renderer, no content.

Tags: **[CC-MEASURED]** read out of the repo or executed · **[CC-DERIVED]** arithmetic on measured
values · **[CC-JUDGMENT]** my read.

**Verdict in one line:** Claude's concern is correct and understated. The instinct axis moves
**one line of one page**, `instinct_score_profile` moves **nothing at all**, and all three Z6
states render **byte-identical**. The 4a "done when" cannot be met for Z6, and the 27-render
matrix does not earn its cost at step 2. Scope statement in §6.

---

## 1. Re-validating the 4a scope against main as it now stands

Re-checked, not assumed. Of the six changes listed in the prompt, **five leave 4a untouched** —
step 1's content, the badge decision, fork A, option (ii), and the deferred Z2/Z3/orange items all
concern content or later steps and none of them touches `scripts/render_client.js` or the
fixtures. [CC-MEASURED — `scripts/render_client.js` is byte-identical between `9285751` and
`feb5e4f`; `git diff 9285751 feb5e4f -- scripts/render_client.js tests/fixtures/` is empty.]

The sixth — the EM stress case moving to sp4's 777-char overlay — **does** change 4a, and §5
answers it.

What invalidates 4a is not on that list. It is §2.

---

## 2. What step 2 can actually prove

### 2a. Every v3 consumer of the three fields — measured

**v3 pages that exist today:** 9 of 12 are built (`cover, contents, welcome, whatis, typeA,
typeB, wings, lines, thoughts`). **`quickref` (sheet 5), `instincts` (sheet 10) and `car`
(sheet 11) are unbuilt** — no entry in `V3_PAGE_BUILDERS`. [CC-MEASURED]

That matters more than it looks: spec §2 says the personalized zones total three — *the Quick
Reference data block, the p6 client quote, and the p10 instinct evidence.* **Two of those three
live on unbuilt pages.** [CC-MEASURED]

I searched the entire v3 builder region (`app/renderer.js:3258–3762`, all nine `_clv3*`
functions) for `instinct`, `subtype`, `Instinct`, `Subtype`. **One match, and it is a comment
saying the strip carries no subtype.** [CC-MEASURED]

| Field | Consumers on main today | v3 consumer? |
|---|---|---|
| `dominant_instinct_hypothesis` | `report_prep.js:213` → `display.subtype_label`, `hero.subtype_name`; then v2 `clientReportBodyHtml`, v2 p7 (`renderer.js:2346`), coach report, Coach Prep (`server.js:2295,2419`) | **Yes — indirectly, via `display.subtype_label`, on the Contents page only** |
| `instinct_score_profile` | `report_prep.js:65,73` → `charts.instincts` (`instinctBars`) and `instinct_stack` (`instinctStack`); consumed by v2 p6 (`renderer.js:2254`), coach chart (`renderer.js:1603`), Coach Prep (`server.js:2278`) | **NO — none** |
| `instinct_evidence` | `report_prep.js:371` → `pages.instinct_subtype.instinct_evidence`; consumed by v2 `_clP6Instinct` (`renderer.js:2251`) and Coach Prep (`server.js:2297`) | **NO — none** |

**The single v3 path is:** `dominant_instinct_hypothesis` → `report_prep.js:213` → `display.
subtype_label` → `_v3Tokens` (`renderer.js:3127`) → `static.contents[6].desc`'s `{subtype_label}`
→ `_clv3Contents` (`renderer.js:3283`). [CC-MEASURED]

### The empirical confirmation — I rendered it rather than reasoning about it

Built the v3 document under each proposed axis value and byte-diffed against the current
baseline. Read-only; scratchpad only. [CC-MEASURED]

| Case | v3 HTML vs baseline | `display.subtype_label` | `instinct_stack[0]` |
|---|---|---|---|
| `sp_primary` {84,66,64} dom=SP | differs — **7 chars, 1 line of 965** | Self-Preservation Nine | SP |
| `so_primary` {64,84,66} dom=SO | differs — **31 chars, 1 line of 965** | Social Nine | SO |
| `sx_primary` {66,64,84} dom=SX | **BYTE-IDENTICAL** | One-to-One Nine | SX |
| `exact_tie` {70,70,70} | **BYTE-IDENTICAL** | One-to-One Nine | **SP** |
| `missing_profile` (key deleted) | **BYTE-IDENTICAL** | One-to-One Nine | **SP** |
| Z6 `sm_bullets` (3 strings) | **BYTE-IDENTICAL** | — | — |
| Z6 `em_paragraph` (777 chars) | **BYTE-IDENTICAL** | — | — |
| Z6 explicit `null` | **BYTE-IDENTICAL** | — | — |

The whole diff, both non-identical cases, is this one line:

```
baseline : …what it means to be a <span class="v3-nb">One-to-One</span> Nine.
so_primary: …what it means to be a Social Nine.
```

**Four findings from that table.**

1. **`instinct_score_profile` is invisible in v3.** `exact_tie` and `missing_profile` render
   byte-identical to baseline *even though `instinct_stack[0]` flips from SX to SP in the model.*
   The profile axis has no rendered effect whatsoever at step 2. [CC-MEASURED]
2. **All three Z6 states render byte-identical**, including a 777-character paragraph. Claude's
   concern is confirmed exactly. [CC-MEASURED]
3. **`sx_primary` is byte-identical to baseline**, which confirms the fixture already *is*
   sx_primary — the "baseline for free" claim in 4a holds. [CC-MEASURED]
4. **The three instinct labels produce three *different markup shapes*, not just three strings.**
   `_v3Compounds` (`renderer.js:3189`) wraps hyphenated compounds ≤24 chars in a `v3-nb` nowrap
   span. So `Self-Preservation` and `One-to-One` are wrapped and `Social` is not:

   ```
   Self-Preservation Nine -> <span class="v3-nb">Self-Preservation</span> Nine
   Social Nine            -> Social Nine
   One-to-One Nine        -> <span class="v3-nb">One-to-One</span> Nine
   ```

   That accounts for the diff sizes exactly (+7 for SP; −31 for SO). [CC-MEASURED] **This is the
   only thing the instinct axis genuinely exercises today** — that the nowrap treatment is correct
   for both a hyphenated and an unhyphenated instinct label. It is small, but it is real, and it
   is not something I claimed in 4a. [CC-JUDGMENT]

### 2b. What step 2 should assert instead

The 4a "done when" was a *rendered* claim. For Z6 it is unmeetable: there is nothing to render.
The honest substitute is a **model-level** assertion.

**Assert:** for each of the four Z6 states, `model.pages.instinct_subtype.instinct_evidence` holds
the expected shape — 3 strings · 1 string · `null` · `null` (absent). And the same for the profile
axis: `model.instinct_stack` and `model.charts.instincts` hold the expected ordering.

**What that is worth.** It proves the override reaches the model intact through
`buildClientModel`, that `report_prep.js:371`'s `?? null` normalisation behaves, that the model
passes `validateModel(model, CLIENT_SPEC)` in every state, and that a 777-char single-element
array does not throw anywhere in the prep path. Those are real and they are prerequisites for
step 3/4. [CC-JUDGMENT]

**What it is not worth, and must not be written up as.** It says nothing about rendering, height,
fit, page spill, or the two-producer reconciliation. It cannot go red for a rendering regression,
because nothing renders. It is a test of `report_prep`'s passthrough on a field with no consumer.
Calling it "the Z6 axis is verified" would be false. [CC-JUDGMENT]

One more thing it is worth knowing now: `instinct_evidence` is in neither `CLIENT_SPEC.required`
nor `nonEmptyArrays` (`report_prep.js:430–452`), so **`null` passes model validation** — that is
measured, not assumed. `charts.instincts` and `instinct_stack` *are* in `nonEmptyArrays`, and both
are always length 3, so **a missing profile passes validation silently**. [CC-MEASURED]

### 2c. Does this change the ordering? — Yes, but not the step numbers

**The Z6 axis stays at step 2, as plumbing. The 27-render matrix moves to step 4.**

Keeping Z6 at step 2 is right: the fixture variants are a prerequisite for step 3's probe, they
are cheap, and building them alongside the instinct axis keeps one piece of work in one place.
Moving them to step 3 would mean the probe lands its own fixtures, and a red probe would again
have two possible causes — the objection I raised in Amendment 1 against folding 4a into 4b, and
it still applies. [CC-JUDGMENT]

But the **27-render matrix** is a different question, and it does not survive §2a. At step 2 the
matrix would spend 18 extra renders to vary **one string on one line**, in **three** distinct
markup shapes. 27 renders test 27 string values of a plain template substitution; 3 renders cover
all 3 markup shapes. The other 24 add coverage of `String.replace`. [CC-DERIVED]

**Counter, and it is cheaper than either version:** the existing 9-type run already renders
Type 9 at `sx_primary` — that *is* the baseline. So covering all three markup shapes needs
**two** new renders, not eighteen:

| | renders | local | CI (derived) |
|---|---|---|---|
| today | 9 | 13.42 s | ~20.8 s |
| **step 2 as I'd scope it** | **11** | **~16.2 s** | **~25 s** |
| 3 × 9 matrix at step 2 | 27 | ~38.8 s | ~60 s |

The full 3 × 9 matrix lands at **step 4**, where it earns its cost: p10 exists, and 27 renders
then put all 27 subtype columns in the highlighted slot at least once — which is what the build
plan's pass/fail actually asks for and what the matrix was designed to deliver. At step 2 it
delivers none of that. [CC-JUDGMENT]

---

## 3. Mechanics

### 3a. The subtype derivation — re-verified, and one thing I did not say before

Confirmed on current main: [CC-MEASURED]

```js
report_prep.js:213   const instinct = h.dominant_instinct_hypothesis || h.confirmed_instinct || '';
report_prep.js:219   const st = resolveLibObject(overrides, subtypeKey(instinct, heroN), lib(subtypeKey(instinct, heroN)));
report_prep.js:242   subtype_label: `${instinctName(instinct)} ${TYPE_WORD[heroN]}`,
```

So the subtype **row** and the subtype **label** are both selected by `dominant_instinct_
hypothesis` + `confirmed_type`. No new client fixture is needed. 4a's claim holds. [CC-MEASURED]

**What consumes each field, and why overriding them together is required rather than merely tidy.**
`dominant_instinct_hypothesis` selects the row and the label. `instinct_score_profile` feeds only
`instinctBars` → `charts.instincts` and `instinctStack` → `instinct_stack`. **Neither is derived
from the other, and nothing anywhere asserts they agree.** I searched every read site: the field
is read at `renderer.js:119/335/659` and written/selected at `db.js:1487/1534`, and there is no
consistency check in the codebase. [CC-MEASURED]

So a record can carry `dominant = SP` with a profile of `{SP:10, SO:80, SX:70}`, and the report
will name the SP subtype while badging SO as Leading — with all three badges now shipping, that
is a visible self-contradiction on one page. Overriding both together in the fixture is therefore
**necessary**, not stylistic: override one and the fixture itself becomes an instance of that
contradiction. [CC-JUDGMENT on the consequence; the absence of a check is measured.]

*This is a new observation and it is adjacent to §5 item 1, not the same bug.* Item 1 is
`instinctStack` having no tie-break. This is the two fields being unreconciled. **Own card. Do not
widen step 2.** [CC-JUDGMENT]

### 3b. The three profiles — deliberate, and insufficient for a purpose step 2 does not have

They are permutations of the existing fixture's `{66, 64, 84}`, which is what makes `sx_primary`
the baseline for free. That was deliberate and it is confirmed working (§2a table, row 3).
[CC-MEASURED]

**Claude is right that every profile in the set is a near-tie.** All three are permutations, so
all three carry the same 2-point second/third gap. Sorted, each is `{84, 66, 64}`. **There is no
clearly-separated profile in the matrix.** [CC-MEASURED]

That is a real gap — but it is a **step 4** gap, not a step 2 one. At step 2 every profile renders
byte-identically, so a wide-gap case would be indistinguishable from a near-tie case in the
output. Adding one now buys nothing measurable.

**Recommendation:** add a `wide_gap` profile — `{90, 50, 10}` or similar — **at step 4**, when
badges render and the difference between a 2-point gap and a 40-point gap is finally visible. Note
it in step 2's scope as a known follow-on so it is not lost. [CC-JUDGMENT]

### 3c. Render cost — measured and derived

**Measured, local (darwin), two runs each:** [CC-MEASURED]

| job | runs | wall-clock |
|---|---|---|
| full `verify:render` (13 renders) | 1 | 19.84 s |
| `client_v3` only, 9 renders | 2 | 13.449 / 13.399 s → **13.42 s** |
| `client_v3` only, 1 render | 2 | 2.164 / 2.147 s → **2.156 s** |

**Derived decomposition:** 8 marginal renders = 13.42 − 2.156 = 11.27 s → **1.409 s per render**,
fixed overhead **0.747 s**. [CC-DERIVED]

- 27 renders = 0.747 + 27 × 1.409 = **38.8 s** → **+25.4 s** over today's 9.
- 11 renders = 0.747 + 11 × 1.409 = **16.2 s** → **+2.8 s** over today's 9.

**Measured, CI (Linux), from the step-1 merge run `34049964803`:** [CC-MEASURED]

- Render check step: `17:53:09.139` → `17:53:39.984` = **30.85 s** for 13 renders.
- Whole `verify` job: `17:52:52.728` → `17:53:50.833` = **58.11 s**.

CI runs the same 13-render job my local 19.84 s covers, so CI is **1.55×** local. Scaling the
marginal rate gives **≈2.19 s per render on CI**. [CC-DERIVED]

- 27 renders: **+18 × 2.19 ≈ +39 s** → render step ~70 s, whole job ~97 s (**+68 %**).
- 11 renders: **+2 × 2.19 ≈ +4.4 s** → whole job ~62 s (**+8 %**).

**The work, named:** tripling the matrix adds roughly forty seconds to every CI run on every
branch, to vary one string. At 11 renders it adds roughly four. I am not calling either figure
acceptable or unacceptable — that is yours. But the 27-render version buys nothing at step 2 that
the 11-render version does not, so the comparison is between +39 s and +4.4 s **for the same
coverage**. [CC-JUDGMENT]

I did not need a nightly/subset split to reach a workable number, so I am not proposing one. If
the full matrix is wanted at step 2 anyway, subset-per-PR + full-nightly is the shape I would
choose — but it adds a second CI configuration to maintain, and I would rather defer the matrix
than split the pipeline. [CC-JUDGMENT]

---

## 4. The edge cases

### 4a. `exact_tie` — a test, not a trap, but it is the same test as `missing_profile`

**The trap concern does not hold, for a measured reason.** `Array.prototype.sort` has been
**stability-guaranteed by the language since ES2019**; it is not an implementation detail that can
drift under us. What is arbitrary is the literal `['SP', 'SO', 'SX']` in `instinctStack`
(`report_prep.js:65`). So the test pins a **declaration order**, and it goes red when someone
edits that literal — which is a genuine behaviour change worth catching, because it silently
changes which instinct wins ties for every client who has one. That red is a true positive.
[CC-MEASURED that the literal is the source of the ordering; CC-JUDGMENT on the verdict]

The residual risk is **misreading**, not flakiness: a future reader may take "SP wins ties" for a
decision someone made. That is fixed by the assertion message, not by dropping the test (§4b).

**The sharper point, which is measured:** `exact_tie` and `missing_profile` produce the *same*
result — `instinct_stack[0] = SP`, v3 output byte-identical to baseline — and for the *same*
reason. They are **one assertion about `instinctStack`, not two cases.** [CC-MEASURED] I would
write one test with two inputs rather than two named fixture cases, and say in the message that
both fall through to declaration order.

And at step 2 neither can be a render assertion at all: both render byte-identical. Model-level
only, per §2b.

### 4b. There is no deliberately-red convention in this repo — and one good convention that is not that

I searched for one: no `todo`, no `skip`, no xfail marker, no "expected to fail", "will go red",
"pins current behaviour" anywhere in `tests/`, `scripts/` or `app/`. `node:test` supports `todo`
and the suite reports `todo 0`. **There is no such convention.** [CC-MEASURED]

**What the repo does have, and what I would follow:** `tests/timing_test.js:67–73` asserts the
current, knowingly-imperfect behaviour and carries the reason inside the assertion string —

> `session_days = 2 — 20-min session crossing midnight reads as multi-day (accepted for alpha)`

under a heading `Midnight edge case (documented approximation)`. And
`tests/report_pages_test.js:241` pins a deliberate departure *"so the next person to 'restore' it"*
trips. [CC-MEASURED]

So the convention is: **assert today's behaviour, put the why in the message, and expect whoever
changes the behaviour to change the assertion in the same commit.** Nothing is ever mysteriously
red, and nothing is silently green-because-skipped.

**A deliberately-red-later test would be new to this repo, and I would not introduce one.** My 4a
wording — "to go red when §5 item 1 is fixed" — was wrong in the same way: it described a test that
fails as a *feature*, which nothing here does. Corrected: the assertion should read something like
*"missing/empty profile currently yields Leading = SP by declaration order — not a decision; see
§5 item 1. Change this assertion in the commit that fixes it."* [CC-JUDGMENT]

### 4c. `near_tie` — confirmed, named not added

The fixture's `{SP:66, SO:64, SX:84}` has a **2-point second/third gap** and an 18-point top gap.
So it is a near-tie **between Secondary and Tertiary**, which is precisely the pair the badge
decision now asserts an ordinal between. It is already the near-tie case; **no fourth case.**
[CC-MEASURED]

---

## 5. The Z6 placeholders

### The transplant problem — and a prior question that decides it

Before choosing between (i), (ii) and (iii), one measured fact reframes all three:

**`scripts/render_client.js` never calls `em_report_adapter.js`.** The `client_v3` job is
`buildClientReportHTML_v3(await buildClientModel({ apiResult, … }))` — the adapter is not in the
path. [CC-MEASURED] So an "EM shape" fixture value is a **hand-made post-adapter artifact under
every one of the three options.** No option exercises the adapter, and none should be described as
testing the EM pipeline. It tests the renderer's tolerance of a shape the EM pipeline can produce.

That also means sp4's 777-char string lives in `instinct_personal_overlay`, and would have to be
moved into `instinct_evidence` as a one-element array by hand regardless. Option (iii) does not
avoid that.

**My read: (i) at step 2, (iii) at step 3.** Staged, and the stage boundary is where the objection
becomes real.

- **(i) sp4's text verbatim, at step 2.** Cost: none. The mismatch objection has **no force at
  step 2**, because Z6 renders nothing (§2a) — there is no smoke render of it to eyeball, so
  there is no page for Type 4 prose to contradict. Using real prose beats inventing any.
- **(iii) sp4 as its own fixture, from step 3.** Cost: `fixtures: ['anders_sx9']` gains `'sp4'`,
  which multiplies the render matrix by the number of fixtures — on today's 9-type axis that is
  +9 renders (**+12.7 s local, +19.7 s CI** [CC-DERIVED]), and it should probably be scoped to one
  type rather than the full axis. Benefit: sp4's overlay is genuinely sp4's, so it stays coherent
  with its own page and the smoke render is honest.
- **(ii) an authored Type-9 variant.** Cost: authoring ~777 characters of placeholder prose that
  is not canon and will need policing so it never ships. **I would not.** It is exactly the move
  §1b's own reasoning rejects — feeding invented filler at roughly the right length measures the
  filler. And it introduces a Claude-authored string into a repo whose content provenance is
  otherwise tracked to a source of record. [CC-JUDGMENT]

**The step-3 boundary is not optional.** If Z6 renders and step 3 still uses sp4's text on
anders_sx9, the fit probe's own output carries Type 4 SP prose under a Type 9 SX heading, and
anyone eyeballing it has to be told to ignore the words. Name the switch in step 3's scope now.

### `CMS_PREVIEW_WORST_EVIDENCE` — how it gets labelled

Measured: 3 bullets at **185 / 193 / 190 chars = 27 / 29 / 28 words**, total **568 chars**. The
producer contract is *"exactly 3 short bullets, ≤25 words each"* (`app/server.js:4828`) and
`scripts/verify_phase1_fields.js:20` asserts it. **All three bullets exceed the cap they are meant
to represent**, and the constant's own comment says *"~25 words each"*. A spec-conformant worst
(3 × 25 words) is **~450 chars**. [CC-MEASURED / CC-DERIVED]

**Labelling, concretely:** the step-2 fixture variant that carries it names it in a comment as
**deliberately over-spec** — 27/29/28 against a ≤25 contract, 568 against a conformant ~450 — and
says that a budget derived from it is a budget for a shape the producer cannot legally emit. That
is where a later step will look. [CC-JUDGMENT]

**The constant's own stale comment is a separate fix in `app/server.js`, and step 2 touches no
server file. Own card.** Do not widen step 2 to correct it. [CC-JUDGMENT]

---

## 6. The baseline check — §6 answered, and 4a's wording corrected

**`undefined` and `null` do travel the same path to the same output.** `report_prep.js:371` is
`cf.instinct_evidence ?? null`, and `??` treats both identically, so the model field is `null` in
both cases; downstream `(i.instinct_evidence || [])` cannot tell them apart. [CC-MEASURED]

Confirmed empirically as well: the "Z6 explicit `null`" case renders **byte-identical** to the
baseline, whose fixture has `client_facing: {}` and therefore `undefined`. [CC-MEASURED]

**So the baseline pair is sound, and 4a's wording was loose.** The fixture state is *absent*; the
model state is `null`. Corrected phrasing for the scope statement: the baseline is **`sx_primary` +
evidence-absent (`client_facing: {}`)**, and the explicit-`null` case should be **asserted to
converge with it** rather than rendered as a separate case — it is the same render, and running it
as one of the four states would spend a render proving `??` works. [CC-JUDGMENT]

---

## 7. Step-2 scope statement, revised

**Purpose.** Give the harness the two axes p10 will need, and land the Z6 fixture variants the
step-3 probe consumes. **Step 2 builds plumbing; it does not verify Z6, and must not claim to.**

**Files touched**
- `scripts/render_client.js` — `client_v3` gains an instinct axis alongside `types`.
- `tests/fixtures/` — profile and evidence variants. **No new client fixture** (§3a).
- `tests/` — one new test file for the model-level assertions (§2b).

**The instinct axis.** Three profiles, overriding `instinct_score_profile` **and**
`dominant_instinct_hypothesis` together — necessary, not stylistic, because nothing reconciles
them (§3a):

| Case | `{SP, SO, SX}` | `dominant` | markup shape exercised |
|---|---|---|---|
| `sp_primary` | `{84, 66, 64}` | SP | `v3-nb` wrapped (17 ch) |
| `so_primary` | `{64, 84, 66}` | SO | **unwrapped** |
| `sx_primary` | `{66, 64, 84}` | SX | `v3-nb` wrapped (10 ch) — today's baseline |

**Render matrix: 11, not 27.** Keep the existing 9 types at `sx_primary`; add **two** renders,
Type 9 × `{sp_primary, so_primary}`. That covers all three markup shapes — the only rendered
difference the axis produces today (§2a). **+2.8 s local, +4.4 s CI.** The full 3 × 9 = 27 matrix
lands at **step 4**, where it puts all 27 subtype columns in the highlighted slot and earns its
~39 s.

**The Z6 axis — model-level only.** Four states, asserted on the built model, not on rendered
output: `sm_bullets` (`CMS_PREVIEW_WORST_EVIDENCE`, labelled over-spec), `em_paragraph` (sp4's
777-char overlay, verbatim, per §5), `null`, and absent. Assert `null` and absent **converge**.

**Edge cases — one assertion, not two.** `exact_tie {70,70,70}` and `missing_profile` both yield
`instinct_stack[0] = SP` by declaration order; assert once, with the reason in the message per the
`timing_test` convention (§4b). `near_tie` is the existing fixture, **named not added** (§4c).

**Explicitly out of scope:** no p10 renderer, no content, no gate change, no badge work, no fix to
the silent-SP default, no CMS or server file, no `wide_gap` profile (step 4), no second fixture in
the matrix (step 3), no correction to `CMS_PREVIEW_WORST_EVIDENCE`'s comment (own card).

**Done when.**
1. The three instinct profiles render through `client_v3`, and the `sx_primary` Type-9 render is
   **byte-identical to today's baseline** — the check that step 2 changed the harness and not the
   report.
2. The two new renders produce the two other markup shapes, asserted on the emitted HTML.
3. All four Z6 states build a model that passes `validateModel`, with the expected
   `instinct_evidence` shape, and `null` and absent produce identical models.
4. `verify:render` and the coach baseline stay green; the coach HTML half is byte-identical.

**Not done when — say so in the build report:** Z6 is not verified, no budget is measured, no
ceiling is published, and no rendered assertion about instinct evidence exists or can exist until
p10 does.

---

## 8. Where I think §1–§6 is wrong

Two things, both small, and one process note.

**a. §5's framing of the transplant assumes Z6 renders at step 2.** *"For a smoke-test render it is
prose that contradicts the page around it"* — measured, there is no such render at step 2 (§2a).
The objection is real but it lands at **step 3**, and dating it correctly is what lets (i) be
adequate now and (iii) be required later. [CC-MEASURED]

**b. §5 cites a workflow doc I cannot read.** *"the workflow doc requires an eyeballed render
whenever a PR changes visible output"* — `claude/pr_workflow_process_081126.md` **is not in this
repo**: no `claude/` directory, no file of that name anywhere, and nothing tracked references it.
[CC-MEASURED] I have followed §7's instruction as given and I am not disputing it. But a process
doc that governs the work and lives outside the repo cannot be checked by anyone reviewing a PR,
and I could not verify either the eyeball requirement or the commit/report boundary against a
source. Worth putting in the repo. [CC-JUDGMENT]

**c. §2's premise is right, and understated.** Claude said the instinct axis is *"visible in
exactly ONE line of one page"* — true. But `instinct_score_profile` specifically is visible in
**zero** lines: `exact_tie` and `missing_profile` render byte-identical (§2a). Only
`dominant_instinct_hypothesis` reaches v3 at all. That distinction matters, because two of the
four edge cases vary the profile and therefore cannot produce a rendered difference of any kind.
[CC-MEASURED]

**One correction of my own, carried forward from 4a:** *"this case exists to pin that behaviour now
and to go red when §5 item 1 is fixed"* describes a convention this repo does not have (§4b). My
wording, my error.

---

## 9. Open questions

### New

1. **Is +39 s per CI run acceptable at step 4 for the 27-render matrix?** I have measured the cost
   and stated that it earns its keep at step 4 and not at step 2. Whether it earns it *then* is a
   judgment I have not been asked for and would not make alone. [§3c]
2. **`dominant_instinct_hypothesis` and `instinct_score_profile` are never reconciled.** Nothing
   asserts the dominant matches the top of the profile. With all three badges shipping, a
   mismatched record renders a visible self-contradiction. **Own card, adjacent to §5 item 1 and
   not the same bug.** [§3a]
3. **Should `claude/pr_workflow_process_081126.md` be in the repo?** [§8b]

### Carried, unchanged

4. **Z3 AS-IS or edited?** · 5. **Z2 token or no token?** · 6. **How many stored assessments lack
   the instinct fields?** — still needs a production query.
7. **`instinctStack` returns "Leading = SP" for a missing or empty profile**, now printing a
   fabricated full stack. Own card; step 2 pins the behaviour, does not fix it. [§5 item 1]
8. **`CMS_PREVIEW_WORST_EVIDENCE`'s comment says "~25 words each" against measured 27/29/28.** Own
   card — a `server.js` fix, out of step 2's scope. [§5]

### Closed since Amendment 2

- **Fork A** — resolved as a substitution. · **Badges** — all three, closed. · **CMS touchpoints**
  — option (ii), step 4. · **Open question 12** (`cmsWordBudget` at step 1 or 0) — dissolved by
  option (ii). · **Open question 13** (record the divergence) — answered yes, and step 1 recorded
  it in the constant's comment.
