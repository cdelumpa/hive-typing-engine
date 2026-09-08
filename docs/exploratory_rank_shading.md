# Exploratory — rank-based shading for the Quick Reference figure

**8 September 2026.** Read, measure, price. **Renderer untouched**; the prototype lives in the
scratchpad. `main` `b394a06`, branch `pr5-build2-diagram` at `9ff33eb` `[MEASURED]`.

Every figure `[MEASURED]`, `[DERIVED]` or `[ESTIMATED]`.

---

## 1. Lead — what is wrong

### 1.1 ⚠ The proposed ordering source does not deliver the guarantee `[MEASURED]`

> *"position 1 ← `leading_candidate`"*

**The leading ring is not on `leading_candidate`. It is on `hero.number` = `confirmed_type`** —
Cai's own 8 Sep decision, recorded in the design spec's §8.4(d). On a stage-4 REDIRECT the two
diverge. Run through the production stamper:

| | |
|---|---|
| `confirmed_type` → `hero.number` → **the LEADING ring** | **5** |
| `leading_candidate` → the proposed **position 1** | **9** |

**The leading ring would land on position 2 — the second-darkest node.** That is precisely the case
the whole design exists to eliminate, and the proposed source reintroduces it.

**Fix: position 1 ← `hero.number`, position 2 ← `alternate.number`.** Those are the exact two fields
the rings already read, so the guarantee becomes true *by construction* rather than by agreement
between two fields. On the EM path it makes no difference — `experimental_analysis.js:493` forces
`confirmed_type = leading_candidate` — so this costs nothing and closes the SM fallback.

### 1.2 ⚠ `third_candidate` should not be in the ordering at all `[MEASURED]`

Three independent reasons, any one sufficient:

* **It does not exist on the production path.** `em_report_adapter.js:100` hard-sets
  `third_candidate: null`, and the EM schema never asks for one — **0 occurrences** of the token in
  `experimental_analysis.js`.
* **So on em_only it would come from somewhere else entirely.** The only writer is
  `call2_stamp.js:32`, reading **SM Call #1's** third. Positions 1–2 from EM's verdict, position 3
  from SM coherence, positions 4–9 from EM's ranking — **three provenances in one nine-step scale.**
* **The spec says it is not for the client.** `server.js:4636`: *"The `third_candidate` is reasoning
  context for YOU only — **it is never shown to the client**."* Shading a node third-darkest is a
  soft disclosure of exactly that.

And it buys nothing: on all three fixtures `third_candidate` **equals** em_ranking's top entry after
removing the two placed types `[MEASURED]`. **Drop it. Positions 3–9 fall out of em_ranking with
placed types removed.**

### 1.3 The legend caption becomes a claim the figure no longer makes `[JUDGMENT]`

The ramp legend still reads **"Less like you → More like you"** under a continuous gradient. As an
*ordinal* statement that survives — position 1 is most like you. But the continuous bar implies
interpolation between steps that a nine-step scale does not have. §6's copy decisions cover the H2
and a new block; **the legend was not in scope and now sits slightly ahead of what the figure
claims.** Worth a look, not a blocker.

---

## 2. The ordering, and the collided record

### 2.1 Proposed source `[JUDGMENT]`

```
position 1     ← hero.number        (confirmed_type)        — the LEADING ring
position 2     ← alternate.number   (alternate_candidate)   — the ALTERNATE ring
positions 3-9  ← em_ranking (via charts.types), descending, placed types removed
backfill       ← any type still unplaced, ascending
```

**Needs nothing the store does not already carry.** All three inputs are on the client model today:
`hero.number`, `alternate.number` and `charts.types` (Build 1, merged).

### 2.2 How a stage-4 redirect is *ensured* to hold both positions `[MEASURED]`

Asked directly, and it is the question the ordering source exists to answer. Traced through the
production stamper across every redirect shape, with the ordering built from `hero.number` /
`alternate.number`:

| Shape | hero | alt | pos 1 | pos 2 | pos1 = hero | pos2 = alt |
|---|---|---|---|---|---|---|
| RD69 — canonical redirect 6 → 9 | 9 | 6 | **9** | **6** | ✅ | ✅ |
| suppressed redirect (`CONFIRMED_WITH_NOTE`) | 6 | 9 | **6** | **9** | ✅ | ✅ |
| REDIRECT, `redirect_from_type` **null** | 9 | — | **9** | 6 | ✅ | alternate dropped |
| REDIRECT, `redirect_from_type` **=** `confirmed_type` | 9 | — | **9** | 6 | ✅ | alternate dropped |

**The primary is guaranteed structurally, not by agreement.** Position 1 is not *derived from* the
redirect — **it is `hero.number`**, the same value the ring reads. There is no path on which they
can differ, because it is one field used twice. That is the whole of the "ensure": *the ordering
reads the ring's own source*. It holds in all four shapes above, including the two malformed ones.

**The alternate is guaranteed by `call2_stamp.js:50-53` — Defect #2 — and that stamp is what makes
it editorially right**, not merely consistent:

```js
if (h.stage4_outcome === 'REDIRECT' && h.redirect_from_type != null
    && h.redirect_from_type !== h.confirmed_type) {
  h.alternate_candidate = h.redirect_from_type;
}
```

On a redirect the alternate becomes **the type the client was redirected away from** — which is
exactly what a coach would want second-darkest and dashed. Without Defect #2, `alternate_candidate`
would still hold Call #1's position 2, which on a redirect *is* the confirmed type.

**Two shapes ship no distinct alternate**, and there position 2 has no ring: a `REDIRECT` whose
`redirect_from_type` is null, or equal to `confirmed_type`. Defect #2's guard does not fire, Defect
#3 cannot recover, and the record ships flagged. `[JUDGMENT]` **Not PR 5's to fix** — it is
malformed engine output the engine already decided to ship — but it is the reason B12 must assert
positions rather than assume them, and why the collided case needs the posture in §2.3.

### 2.3 The collided record — proposal, not decision `[JUDGMENT]`

Measured collisions, `[CAI-MEASURED, n=19]`: row 72 `third == alternate`; row 57
`third == leading`; and a redirect stamps `leading == alternate`. **Dropping `third_candidate`
(§1.2) removes two of the three outright.**

What remains is `hero.number === alternate.number`. **The build already has a posture for it**:
Build 2's variant drops the alternate ring rather than hard-stopping, because `call2_stamp.js`
ships those records deliberately. The ordering should match:

* **De-duplicate while placing.** Each type is placed once; a collision simply means position 2
  falls through to em_ranking's first unplaced type. Prototyped and rendered — order comes out
  `9 · 5 · 1 · 8 · 3 · 2 · 7 · 4 · 6`, a complete nine-position scale with no gap.
* **One consequence to put to Cai:** position 2 is then the second-darkest node **carrying no ring**
  — a faint echo of the "darkest unringed" confusion, on a record that is already flagged. The
  alternative is to collapse position 2 into the 3–9 band so nothing is conspicuously second.
  **My recommendation is to leave it**: the record has an `engine_collision` flag, the coach sees
  it, and a nine-step scale with a hole would be a worse artefact.

### 2.4 Malformed `em_ranking` `[MEASURED]`

Nothing validates it — no length, ordering, range or duplicate check; the only guard is `.length`
truthiness at `em_report_adapter.js:106`.

**Rank-shading is materially more robust here than score-shading, and this is the strongest
engineering argument for it.** Under score-shading a short or unsorted array produces wrong *fills*
silently. Under rank-shading the ordering is **built by placement**: positions 1–2 come from the
verdict, and the backfill loop guarantees all nine positions are filled from `1..9` whatever
`em_ranking` contains. **A malformed `em_ranking` can only scramble positions 3–9 — it can never
misplace a ring.** Build 1's `ninePerType` validator already refuses a short `charts.types` before
this point.

---

## 3. What changes

### 3.1 `report_prep.js` — merged code (Build 1)

| Change | |
|---|---|
| `typeRamp` (`:82`) | today `{type, score}` per entry. Becomes an **ordering**: emit `{type, position}` — or keep `score` and add `position`, which leaves the coach path and `near_tie` untouched. |
| `charts.types` (`:284`) | pass `heroN` and `altN` so the helper can place them first. Currently `typeRamp(h.call1_ranking)` takes one argument. |
| `CLIENT_SPEC` (`:554`, `:560`) | `ninePerType` still applies. `nodesFor` still applies. Add: positions are exactly `1..9`, each once. |

`[JUDGMENT]` **Keep the score on the entry.** It costs nothing, keeps `charts.types` truthful about
what the engine produced, and leaves the door open if the figure ever wants magnitude again.

### 3.2 The `client-quickref` variant — committed, unmerged (Build 2)

`rampFill(score)` becomes `rampFill(position)` — a **lookup into nine constants**, not a computation.
The `dark` numeral-contrast threshold moves from a score test to a position test (positions 1–4 take
white; see §3.3). Everything else in the branch is unchanged.

### 3.3 The nine fixed values `[DERIVED]`

From B9's formula with `t` linear from 1.00 to 0.10 across nine steps — **so the endpoints are
byte-identical to B9's verified values**: position 1 is `#00B2D9` (B9's score-100 fill) and position
9 is `#E6F7FB` (B9's score-0 fill).

| pos | t | fill | pos | t | fill |
|---|---|---|---|---|---|
| 1 | 1.0000 | **`#00B2D9`** | 6 | 0.4375 | `#8FDDEE` |
| 2 | 0.8875 | `#1DBBDD` | 7 | 0.3250 | `#ACE6F3` |
| 3 | 0.7750 | `#39C3E2` | 8 | 0.2125 | `#C9EFF7` |
| 4 | 0.6625 | `#56CCE6` | 9 | 0.1000 | **`#E6F7FB`** |
| 5 | 0.5500 | `#73D5EA` | | | |

### 3.4 Label placement — **unaffected** `[MEASURED]`

B2's geometry does **not** need re-measuring. Label placement reads only node position and the
`leading`/`alternate` parameters; fills are a separate attribute on a separate element. The 72-pair
sweep already varies exactly what still varies. **This is what B10 was for**, and it is why the
question can be answered without re-running anything.

---

## 4. Sequencing — three shapes priced

**Neither gate constrains the choice** `[MEASURED]`: rank-shading touches only the `client-quickref`
branch and the client model, so **B11 stays 81/81** (the other nine variants never read the changed
code) and **the coach byte-diff is unaffected** (the coach renders variant `type`).

| | Shape | Cost |
|---|---|---|
| **a** | Fold into Build 2 before merging | Build 2's diff grows a design change decided *after* its plan was written and reviewed, and it reaches into `report_prep.js` — a **merged** file outside Build 2's declared scope. Re-opens a complete, green, reviewed build. |
| **b** | Merge Build 2, then Build 3 | Two clean PRs, each matching its own plan. The intermediate state ships a variant **nothing calls** — `quickref` has no `built: true` until step 6 — so shipping then changing it is invisible to production. Two merge cycles. |
| **c** | Merge Build 2; fold rank-shading into **step 6** | Step 6 already touches `V3_PAGE_ORDER`, the tripwire and the page builder. Bundling a fill change means step 6's first render is also its first sight of the new shading — the two would debug together. |

`[JUDGMENT]` **Recommend (b).** The deciding fact is that this change spans a **merged** file
(`report_prep.js`, Build 1) and an **unmerged** one (`renderer.js`, Build 2). Folding it into Build 2
would have Build 2 modify code from a PR that already landed, which is exactly the scope creep its
own plan was written to prevent — and Build 2's value as a reviewable unit is that its diff matches
its plan. (c) is worse than either: it puts a design change inside the step that first renders the
page.

The intermediate state is genuinely free here, and that is what makes (b) cheap rather than merely
tidy.

---

## 5. The gates

### 5.1 The eleven

| | Under rank-shading |
|---|---|
| B1 Wings band, B2 edge clearance, B3 node count, B4 label→node, B5 label/label, B6 opacity markup, B7 standalone scan | **unchanged** — none reads fills by value |
| B8 no `#F68625` | **unchanged, and stronger**: nine constants are easier to assert than a computed ramp |
| **B9 ramp formula** | **replaced** — asserts nine constants rather than `0.10 + 0.90 × score/100`. Strictly easier to red-prove: an off-by-one in the table is a literal diff |
| **B10 score independence** | **becomes trivially true, and should be RESTATED rather than deleted** — see below |
| B11 nine variants byte-identical | **unchanged**, and still the load-bearing one |

**B10 still earns its place, restated.** Today it asserts "two score vectors differ only in fills".
Under rank-shading fills stop depending on scores at all, so that passes vacuously — **which is the
vacuous-gate pattern this project has now found seven times.** The property worth keeping is the one
B10 was really protecting: **geometry does not depend on the data.** Restate it as *two different
**orderings** produce identical output outside `fill`* — same technique, live subject.

### 5.2 The new assertion, and its red-proof `[JUDGMENT]`

> **B12 — the leading ring sits on position 1's fill and the alternate on position 2's, across all
> 72 pairs.**

Implementation: build the SVG, read the fill of the circle at `hero.number`'s node, assert it equals
`RANK_FILL[0]`; same for `alternate.number` and `RANK_FILL[1]`.

**Red-proofs, all three failing on their own message:**

| Control | Expected failure |
|---|---|
| order positions 1–2 from `leading_candidate` instead of `hero.number` | fails on every REDIRECT-shaped input — **this is §1.1's defect, made into a gate** |
| reverse the `RANK_FILL` table | position 1 gets `#E6F7FB` |
| skip the de-duplication in the placement loop | a collided record yields eight positions, tripping the `1..9` check |

The first is the valuable one: it converts the flaw found in this document into something that
cannot come back.

### 5.3 Does the `em_ranking` ordering validator still matter? `[JUDGMENT]` **Much less.**

It was proposed to close the leading-ring case. Under this design **positions 1–2 no longer come
from `em_ranking` at all**, so a mis-ordered array can only scramble positions 3–9 — nodes carrying
no ring and no label, on a figure that claims no magnitude. **It drops from load-bearing to
cosmetic.** Still worth a card for the coach chart and for `near_tie`, which reads `[0]`/`[1]`
positionally (pricing doc §3.1) — but **it stops being a precondition for sheet 5.**

---

## 6. The copy, measured on the scaffold

All `[MEASURED]` on `AtAGlance_v1.html`, Chromium 147, in the real column at the real width.

### 6.1 The new block

170 characters, at `.ptxt` styling (12.5px / 1.5) in `.klist` at **316px**:
**4 rendered lines, 75.00px**, plus a 14px top margin.

### 6.2 Does the card grow? **No — it is free** `[MEASURED]`

| | before | after |
|---|---|---|
| `.klist` | 206.50 | **301.50** |
| `.chart` | 353.00 | **353.00** |
| intrinsic page | 1015.22 | **1015.22** |

The 315px figure still governs the card's height, so the block is absorbed. **Headroom unchanged at
40.78px.**

⚠ **But the slack is thin.** `.chart`'s content box is ~317px and `.klist` now stands at 301.50 —
**15.5px of room, less than one more rendered line (18.75px)**. One more line in this block, or in
either motivation, and the card starts to grow.

### 6.3 Zone 8 — the derived figure, corrected `[MEASURED]`

**45.34px**, against the 45–50px estimate. **Confirmed, at the low end.** The `.note` box is
33.34px; the rest is its 18px bottom margin less the −6px inline top margin, which is 12px of the
gap above it. Page **1015.22 → 969.88**.

**Both together: 969.88px, headroom 86.12px** — more than doubled from 40.78.

### 6.4 ⚠ With zone 8 gone, the "doesn't quite fit" guidance disappears `[MEASURED]`

The new block says the two are the strongest candidates. It does **not** say what to do if the
leading description does not fit. Zone 8's unique clause — *"particularly if parts of the Type N
description do not quite fit"* — has **no other home on the page**: the four debrief tips say *"Bring
what didn't land"* and *"Ask about the alternate"*, which are debrief instructions, not the
permission-to-disagree the caption gives.

`[JUDGMENT]` **Name it, do not silently accept it.** Options: fold the clause into the new block
(measured cost — the block has 15.5px of slack, so one more line grows the card by ~3px, well inside
86.12px of headroom); or keep zone 8 and spend 45.34px of the headroom on it. **The headroom exists
either way** — removing zone 8 is authorised *if headroom is needed*, and after this measurement it
is not.

---

## 7. The smoke test — rendered

`.phase6_out/quickref_rank_shading.png`, from a **prototype wrapper; the renderer is unchanged.**

* **Tile 6 × 3 side by side**, score-shaded against rank-shaded. Under rank-shading node 6 is
  darkest with the solid ring and node 3 second with the dashed — by construction.
* **Is 6 × 3 ungenerable? YES, with §1.1's correction — and NO under the ordering as proposed.**
  With position 1 sourced from `hero.number` it cannot occur: the ring and the fill read the same
  field. With position 1 from `leading_candidate`, a REDIRECT reproduces it exactly.
* **REDIRECT (5 × 9)** — leading 5 darkest and ringed, ex-leader 9 second and dashed. The picture
  the current build cannot produce.
* **FLAT profile** — indistinguishable from any other client, as intended.
* **Collided record** — one ring, complete nine-step scale, no gap.

---

## 8. The instinct bars — noted, not scoped `[JUDGMENT]`

The bars use `width: score%` against a fixed 100 — true magnitude — beside a figure that would claim
none. Two logics on one page.

**Would the same treatment be cheap there? Yes, and cheaper.** Three bars, three fixed widths, one
lookup; the primary/secondary/tertiary order already exists in `instinctRanks` (Build 1, merged), so
the ordering input is present. **But it is a bigger design question than the heat map's**, because
the instinct bars are the only place on the sheet where a client can see *how close* two things are
— and unlike the nine types, three bars at a glance are legible. Removing that would remove the
page's only readable magnitude. **For Cai and Mo. Not priced here, not built.**
