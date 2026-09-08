# PR 5 Build 2 — plan detail · the diagram

Branch `pr5-build2-diagram`, off `main @ b394a06` `[MEASURED]` (fetch brought nothing down).
**Not a build.** No renderer change, no gate change, no SVG. One document.

Every figure `[MEASURED]` or `[ESTIMATED]`, with its counting basis.

---

## 1. Lead — what is wrong

### 1.1 §4.4's premise is false: the `r <= 20` filter does **not** exclude `client-explore`'s home node `[MEASURED]`

Counted on the emitted markup, per variant, at type 9:

| Variant | circle radii | kept by `r <= 20` | non-numeral labels |
|---|---|---|---|
| `client-explore` | 12.5 ×8, **16** (home), 80 (ring) | **9 of 10** | **0** |
| `client-whatis` | 16 ×9, 112 | 9 of 10 | 0 |
| `client-wings` | 11, 13, 15, 95 | 9 of 10 | 5 |
| **`client-cover`** | **23** ×9, 158 | **0 of 10** | 0 |
| *quickref (proposed)* | *21 ×9, 27 ×2, 105* | *0 of 12* | *2 + 2 legend* |

`EXPLORE_GEO`'s `rNode` is 12.5 and its `homeRNode` is **16** — both under 20. **The filter works
correctly for `client-explore`**, keeping all nine nodes and dropping only the outer ring.

This changes §4.4's pricing, and not in the direction the prompt assumes — see §6.4.

The variant the filter *does* break on, besides the proposed quickref, is **`client-cover`** at
r=23. That is currently harmless because `client-cover` is covered by the **structural** wheel check
(`verify_diagrams.js:116`), not the label check — but it means the `r <= 20` heuristic is already
wrong for one shipped variant and would silently become wrong for any future geometry with nodes
over 20px.

### 1.2 The audit says `buildEnneagramSVG` has **five** variants. It has **nine**. `[MEASURED]`

`docs/audit_pr5_quickref.md:845` reads *"`buildEnneagramSVG` has five variants: `base`, `type`,
`my-report`, `wings-lines` (v2), and four v3 ones…"* — it says five and then lists four plus four.
The **list is right and the count is wrong**, and it is on `main`.

Enumerated by calling the function `[MEASURED]`: `base`, `type`, `my-report`, `wings-lines`,
`client-cover`, `client-whatis`, `client-explore`, `client-wings`, `client-lines` — **nine accepted,
and an unknown variant throws.** Build 2 makes it **ten**.

### 1.3 Build 2 has no `§22.4d` equivalent — its scope was never enumerated in one place `[MEASURED]`

§1.1 of the prompt asks which audit section carries Build 2's scope. **The honest answer is that no
single section does.** Build 1 got `§22.4d "Build 1 — exact scope"` with a file table and eight
assertions. Build 2 has:

* `§22.1`, one table row — *"5. The diagram | **BUILD 2** | plus P6, plus IO-75's baseline as its
  first commit"*;
* `§22.2a` — P6 folds in entirely;
* `§22.2b` — the shared-file table, which has a Build 2 column naming `renderer.js` (`QUICKREF_GEO`
  ~:1087, the variant ~:1233) and `verify_diagrams.js` (the variant + the `r <= 20` fix);
* `§22.2c` — IO-75 lands as Build 2's first commit;
* `§7.2`, `§7.3`, `§7.4`, `§7.5` — the original geometry, variant and gate findings.

**Has it gone stale? In one respect, yes** — `§22.2b`'s Build 2 column does not mention
`verify_transparency.js`, and §3 below shows Build 2 must touch it. Otherwise it holds.

`[JUDGMENT]` This is the same shape as the orphaned `instinctRanks`: named in several places, never
enumerated in one. **§6 of this document is Build 2's `§22.4d`**, and writing it is the main reason
this plan exists.

### 1.4 A signature change is unavoidable, and it was not in any plan `[MEASURED]`

`buildEnneagramSVG({ type, variant })` takes **exactly two parameters**, and no call site passes
anything else — checked across all 13 call sites. **A score cannot currently reach the function.**

The quickref variant's nine fills are a function of nine scores. **So Build 2 must widen the
signature of a function five shipped pages call.** Destructuring makes added optional keys
backward-compatible, but this is a change to a shared primitive and no plan named it.

---

## 2. §1.2 — what the sweep produces now, and whether it is what a diagram measurement needs

### 2.1 What it produces `[MEASURED]`

After Build 1's fix, for `anders_sx9` swept 1–9:

| asType | leading | alternate | ramp #1 | ramp #2 | ramp scores |
|---|---|---|---|---|---|
| 1…9 | = asType | `(asType%9)+1` | = asType | = alternate | **91, 83, 74, 52, 47, 44, 38, 35, 31** — identical for every asType |

Score values are preserved and only reassigned, so **every one of the nine renders carries the same
score multiset**. The ramp's *shape* is the fixture's real distribution, rotated onto different
nodes.

### 2.2 Do A7's three clauses cover what a diagram measurement depends on? `[JUDGMENT]`

**They cover ordering. A diagram measurement depends on position and identity, which is adjacent —
and on score diversity, which A7 does not touch at all.**

| What the figure needs | Depends on | A7 covers it? |
|---|---|---|
| Node positions | `CLIENT_ANGLES` + the geometry constant. **No data input.** | not applicable |
| Which node carries the LEADING ring | `hero.number` (`confirmed_type`) | indirectly — the retype sets it |
| Which node carries the ALTERNATE ring | `alternate_candidate` | **yes**, clause 3 ties it to ramp #2 |
| The two rings being on **different** nodes | `alternate_candidate ≠ confirmed_type` | **NO — A7 does not assert this.** Structurally safe in the sweep because `(asType%9)+1` is never `asType`, but unasserted |
| The nine fill values | the ramp scores | **NO** |
| Fill *diversity* — flat, tied, at the ceiling | the score distribution | **NO — and §2.1 shows the sweep produces one distribution, nine times** |

### 2.3 The refinement that matters, and it partly refutes my own earlier argument `[MEASURED]`

**Build 2's geometry gate does not go through the harness at all.** `verify_diagrams.js` calls
`R.buildEnneagramSVG({ type, variant })` directly in a loop; it never builds a model and never
touches `render_client.js`.

So the split-the-builds argument — *"bad harness data corrupts Build 2's geometry measurements"* —
was **about step 6's page renders, not about Build 2's own gate.** Build 2's measurements are
harness-independent. The argument for splitting still stands on the other ground I gave (two chances
to catch a confidently-wrong result), but this specific mechanism does not apply to Build 2's gate,
and I should not have implied it did.

**What the harness fix *does* buy Build 2** is that when step 6 renders sheet 5, the nine sweep
pages will each show a ramp whose brightest node is that page's own type. That is a step-6 property,
banked early.

**What is still missing, and it is a step-7 item, not a Build 2 one:** the sweep cannot exercise a
flat profile, a tie at the top, or the 100 ceiling — the four fixture additions in the audit's §20.2.
Build 2 should assert the ramp *formula* on synthetic inputs it constructs itself, not wait for
fixtures.

---

## 3. §2 — the shape-changing question. **Both can be proven at Build 2.**

`[MEASURED]` The premise that makes this work: **`buildEnneagramSVG` is a pure function that takes
no page context.** Its output is a string. So it can be gated standalone, and `built: true` at step
6 is not a precondition for anything below.

### 3.1 Proving the ramp is opaque, before the page exists

**Two levels, both demonstrated on repo code just now — not on the mockup alone.**

**Level 1 — static, no browser.** Scan the emitted string for banned constructs
(`fill-opacity`, `stop-opacity`, `opacity=`, `rgba(`, `transparent`, `oklch(`, 8-digit hex).

| Variant | banned construct `[MEASURED]` |
|---|---|
| `client-cover`, `client-whatis`, `client-explore`, `client-wings`, `client-lines` | **none** |
| the tracked mockup's heat-map SVG | **`stop-opacity`** |

**Level 2 — the PDF scan, standalone.** Wrap the SVG in a minimal white-background page, render
through the pinned Chromium, and run `verify_transparency.js`'s own scanner over the bytes.

| Subject | groups | masks | alpha<1 | blends |
|---|---|---|---|---|
| all five existing v3 variants | **0** | **0** | **0** | **0** |
| **the mockup heat-map SVG alone** | **1** | **1** | **8** | 0 |

**The scanner distinguishes clean from dirty on a standalone SVG.** `[MEASURED]` That is the whole
question, and the answer is yes.

`[JUDGMENT]` Level 1 catches it at authoring time and is nearly free; Level 2 is the authoritative
one, because it proves what *Chromium emits*, which is where the pink-cover bug lived. **Build both.**
Level 2 belongs in `verify_transparency.js`, beside its existing `badControlHtml()` self-test, which
is the same shape.

### 3.2 The non-orange check — it survives contact, **but only scoped per-variant** `[MEASURED]`

The proposed form was *"no `#F68625` inside the heat-map SVG"*. Tested against every v3 variant:

| Variant | contains `#F68625` |
|---|---|
| `client-cover` | **PRESENT** |
| `client-whatis`, `client-explore`, `client-wings`, `client-lines` | absent |

**`client-cover` legitimately contains client orange** — spec §5.3, the cover's home node is the
sole client marker on a sheet with no page header, and `renderer.js:1270` documents it as *"the ONLY
figure in the document with an ORANGE home node"*.

**So a blanket "no `#F68625` in any diagram" would fail on a shipped page for a correct reason.** The
check must be **per-variant**, asserting absence for `client-quickref` specifically. Home:
`verify_diagrams.js`, which already has the SVG string in hand and iterates variants.

### 3.3 The red-proofs `[JUDGMENT]`

| Assertion | Red-proof | Why it is a real proof |
|---|---|---|
| Static opacity | inject `fill-opacity="0.5"` into the emitted string | fails naming the attribute |
| **PDF opacity** | **render the tracked mockup's heat-map SVG** and require the scanner to find > 0 | a **real tracked artifact**, not a synthetic mutation — already measured at 1/1/8 |
| Non-orange | build the variant with `#F68625` substituted for the ramp colour | fails naming the variant and the hex |
| Node-filter non-vacuity | **assert the filter yields 9 circles, before fixing it** — it yields **0** | this is the RED-FIRST assertion; see §6.3 |
| Edge clearance | port the mockup's LEADING label at its measured 1.17 vb | fails at 1.17 < 5 |

### 3.4 §2.4 — is the honest answer "not until step 6"? **No.**

Everything above runs against a pure function. **No part of Build 2's verification needs
`built: true`, and no part of step 6 needs to move forward.** `[JUDGMENT]`

The one thing that genuinely cannot be proven until the page exists is **whether the figure fits its
card at the mockup's 322×315** — a layout property, not a diagram property, and already scoped to
step 6.

---

## 4. §3 — re-measured against `b394a06`. **All four held.**

Measured 8 Sep against `f385c9a`; `main` has moved twice since (`216e926`, `b394a06`).

| # | Figure | 8 Sep | Now | |
|---|---|---|---|---|
| 3.1 | mockup LEADING label edge clearance, viewBox units, against the 5px rule | 1.17 | **1.17 — FAILS** | **HELD** |
| 3.2 | label→node clearance, rendered px at scale 0.894444 | LEADING 6.06 / ALTERNATE 6.41 | **6.06 / 6.41** | **HELD** |
| 3.3 | `nodeCircles` after `r <= 20`, on the mockup SVG | 0 of 12 | **0 of 12 — VACUOUS** | **HELD** |
| 3.4 | IO-75, built Wings vs `Wings_v1.html`, % of 861,696 px, max-channel Δ > 8 | 2.3433% | **2.3433%** (20,192 px) | **HELD** |

**The y=148–370 band still bounds the diagram** `[MEASURED]`: the `.v3-dia` box on the built Wings
page measures **y 148.00 – 370.00**, and the `<svg>` inside it occupies the same box exactly. The
densest differing bands remain y200–349 (16,065 px of the 20,192).

`[JUDGMENT]` That IO-75 did **not** move across Build 1 is the expected result and is worth stating
as a positive: Build 1's P1 predicted byte-identical v3 output and this is an independent
confirmation at the pixel level on a page P1 also covered.

---

## 5. §4.3 — confirmed in the code, with a consequence `[MEASURED]`

**Confirmed, and more strongly than proposed.** It is not merely that geometry does not depend on
scores — **scores cannot reach the builder at all.** `buildEnneagramSVG({ type, variant })` takes two
parameters, and all 13 call sites pass only those.

**The consequence is §1.4.** Build 2 breaks that property deliberately: the quickref variant needs
the nine scores. So the claim must be **re-established rather than inherited**, in this form:

> Positions and label placement depend on `type`, `variant`, and which nodes carry rings. **Fills
> depend on scores. Nothing else does.**

`[JUDGMENT]` That is assertable and should be asserted — **render the quickref variant twice with
different score vectors and require every non-`fill` attribute to be byte-identical.** It is the same
technique as Build 1's A1, and it converts §4.3 from a claim into a gate.

**What the geometry sweep must cover instead of scores: ring configurations.** 9 leading × 8
alternate = **72**, each placing the two labels at different node positions. `verify_diagrams.js`
already iterates variants and types directly, so it can iterate all 72 without a fixture.

---

## 6. Build 2 — exact scope. **This section is Build 2's `§22.4d`.**

### 6.1 Files

| # | File | Change |
|---|---|---|
| 1 | `app/renderer.js` | `QUICKREF_GEO` beside the other three (~:1087); the `client-quickref` variant branch (~:1233); **widen `buildEnneagramSVG`'s signature** for the score vector and the alternate |
| 2 | `scripts/verify_diagrams.js` | add the variant; **fix the `r <= 20` node filter**; the 72 ring-configuration sweep; the per-variant colour check; the static opacity check |
| 3 | `scripts/verify_transparency.js` | the standalone-SVG scan and its mockup red control |
| 4 | `docs/build_pr5_build2.md` | the build report |

**Forbidden, and none of the work wants them:** `V3_PAGE_ORDER`, `tests/lib/report_page_inventory.js`,
`app/content/content_library.json`, any `.docx`. Also **not** touched: `app/report_prep.js` (Build 1's
file — the model already carries `charts.types`), `scripts/render_client.js`, `app/server.js`.

**No page is built. `quickref` stays without `built: true`. The page count stays 10.**

### 6.2 Assertions

| # | Assertion | Red-proof |
|---|---|---|
| **B1** | IO-75 band baseline (y=148–370, Wings) recorded **first, before any geometry change**, and still green after | a deliberate 1px node-radius change → the band figure moves |
| **B2** | edge clearance ≥ 5px, quickref, **all 72 ring configurations** | the mockup's LEADING label at 1.17 vb |
| **B3** | **the node filter yields 9 circles for quickref** — non-vacuity | **RED FIRST: it yields 0** |
| **B4** | label→node clearance ≥ 5px, all 72 | a label moved onto a node |
| **B5** | no label/label or label/numeral overlap, all 72 | two labels forced to the same point |
| **B6** | the emitted string carries **no** banned opacity construct | inject `fill-opacity` |
| **B7** | standalone PDF scan: 0 groups, 0 masks, 0 alpha<1 | **the tracked mockup SVG → 1/1/8** |
| **B8** | **no `#F68625` in `client-quickref`** (per-variant, not blanket) | substitute the ramp colour |
| **B9** | fills follow `0.10 + 0.90 × score/100` as **opaque solids** | an off-by-one ramp constant |
| **B10** | two renders with different score vectors are byte-identical outside `fill` | make a label position read a score |
| **B11** | the nine existing variants are **byte-identical** before and after | — (the Build 1 A1 technique, applied to the shared primitive) |

**B3 is the red-first assertion.** It is written against the unfixed `r <= 20` filter, where it
yields **0 of 12** `[MEASURED]`, making the label→node check pass by testing nothing. It is the
vacuous-gate defect made visible before it is fixed — and B4 is meaningless until B3 is green.

`[JUDGMENT]` **B11 is the one I would not skip.** Build 2 changes a function five shipped pages call
and widens its signature; byte-identical output for the nine existing variants is the proof that the
widening is inert, exactly as A1 was for `instinctRanks`.

### 6.3 Sequence

1. **B1 first** — record the band baseline before touching geometry. An assertion added afterwards
   baselines the post-change value and proves nothing.
2. **B3 red**, then the filter fix, then B3 green.
3. `QUICKREF_GEO` + the variant + the signature widening, with **B11** proving the widening inert.
4. B2, B4, B5 across the 72 configurations — including raising the mockup's LEADING label to clear 5px.
5. B6–B9 — opacity and colour, both levels.
6. B10 — the score-independence gate.

### 6.4 §4.4 — the `client-explore` price, **repriced**

`[MEASURED]` §1.1 shows the premise is wrong: the `r <= 20` filter **includes** all nine of
`client-explore`'s nodes. So including it is **not** adjacent to the filter fix, and the filter fix
does not partly pay for it.

**What it would actually cost and buy:**

| | |
|---|---|
| **Cost** | one entry in `VARIANTS`, or a second `for` over 9 types in the structural block. `[ESTIMATED]` a few lines. |
| **Buys — label checks** | **nothing.** `client-explore` emits **0 non-numeral labels** `[MEASURED]`, so label→node and label→label have nothing to test. |
| **Buys — edge clearance** | 9 numerals × 9 types = 81 boxes, currently unchecked. Real but low-risk: numerals sit inside nodes at a fixed offset. |
| **Buys — the structural wheel check** | **this is the actual value.** `client-cover` and `client-whatis` are asserted for nine nodes present, correct angles, and both flow sequences (`verify_diagrams.js:116`). `client-explore` is in **neither** list — the one v3 wheel with no structural assertion at all. Spec §4.3 exists because a mockup shipped **missing node 2**; that is precisely what this check catches. |

`[JUDGMENT]` **Recommendation: include it, in the structural block only, not the label block** — one
line added to the pair at `:116`. It closes the last ungated v3 wheel against the exact defect class
§4.3 documents, and it costs nothing the label sweep would waste. **But it is Cai's call and it is
visible here rather than absorbed into a commit.** If it rides along it should be its own commit,
named as such, so Build 2's diff does not quietly grow a page it does not otherwise touch.

---

## 7. Framings I would refute

1. **§4.4's "the same `r <= 20` filter excludes its home node"** — false. `EXPLORE_GEO`'s home node
   is r=16 and the filter keeps 9 of 10. §1.1.
2. **§1.2's implication that the harness fix bears on Build 2's own measurements** — it does not.
   `verify_diagrams.js` calls the builder directly and never builds a model. §2.3, and it partly
   refutes my own earlier argument, not only the prompt's.
3. **My own audit's "five variants"** — it is nine, and Build 2 makes it ten. §1.2.
4. **The premise that Build 2's scope lives in one audit section** — it does not; §6 is that section.
   §1.3.
