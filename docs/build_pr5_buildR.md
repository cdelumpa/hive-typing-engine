# PR 5 · Build R — the ALTERNATE ring reads position

**Branch** `pr5-buildR-alt-ring-position`, base `12a0f41`. Predictions committed first at
**`f959a07`**. **No page is involved** — `_clv3QuickRef` does not exist, `built` is not set,
`PAGE_INVENTORY` is not bumped. Every `§N` names a section of `docs/audit_pr5_quickref.md` unless
said otherwise.

**[DECISION — Cai, 9 Sep]** The ALTERNATE ring reads **position 2**, not `alternate.number`. The
page marks two candidates on every record, collided ones included.

## 1. What is wrong

### 1.1 The change is real but the sweep that covers this figure is blind to it — say so out loud

**The 72-pair sweep is a regression check, not evidence of correctness, and the next reader must not
mistake 72/72 for the latter.** `[MEASURED]` — 72 of 72 byte-identical before and after. That is
guaranteed by construction: `verify_diagrams`'s `orderFor(lead, alt)` does `put(lead); put(alt)`, so
position 2 **is** the alternate in every pair it builds, and both readings agree everywhere.
**A wrong implementation of "read position 2" would pass all 72.**

The whole test is the collided block, which is why it was inverted rather than widened, and why it
now sweeps nine leading types rather than one.

### 1.2 The inverted assertion produced four distinct failure kinds, not the three predicted

Predicted 3 — rings, dashed stroke, missing label. **Measured 4** `[MEASURED]`, **36 failure lines
across 9 of 9 leading types**, exit 1:

```
*** FAIL — collided record 1x1: 1 rings drawn, expected 2 (leading + alternate)
*** FAIL — collided record 1x1: 0 dashed ring(s), expected exactly 1
*** FAIL — collided record 1x1: no ALTERNATE label drawn — the alternate ring must be labelled
*** FAIL — collided record 1x1: could not locate the dashed ring to check its node
```

The fourth is the node-placement check reporting that it had nothing to check — a *consequence* of
the second rather than an independent defect. It is worth having as its own line anyway: it is the
assertion that would catch a dashed ring drawn on the **wrong** node, which the first three cannot,
and a silent skip there would be the strongest failure mode to miss.

### 1.3 One thing the smoke sheet shows that no gate asserts

`[DERIVED]` from `QUICKREF_GEO`: the bottom label rail's baseline is
`cy + (r + ringR + lblGap) + lblAsc` = **305.90 px**, and the legend ramp starts at
`rampY` = **316**. **Clearance 10.10 px.**

This is pre-existing and Build R does not change it — but Build R **increases how often two labels
are drawn**, because collided records previously drew one. Nothing asserts label-versus-legend
clearance: `verify_diagrams` checks label-vs-node and label-vs-label, not label-vs-legend. Named,
not fixed.

## 2. The sequence, in the order §30.6 specified

**Step 1 — invert first, confirm red for the right reason.** Done before any renderer change.
Exit 1, 36 failures, the text quoted in §1.2. **The assertion, not the exit code**, is what was
checked: every failure names the ring count, the dashed stroke, the label, or the node placement —
none names a throw, a geometry error or an unrelated gate.

**Step 2 — one line.** `app/renderer.js`, now line 1377:

```js
const altN = ((scores || []).find((r) => r && r.position === 2) || {}).type ?? null;
```

**Step 3 — the 72 pairs.** `[MEASURED]` **72 of 72 byte-identical**, 0 differing. The **9** collided
renders all differ, which is the intended change: for 9 × 9, dashed rings 0 → 1 and the ALTERNATE
label absent → present.

After the change the gate is **green**, and prints
`collided records 1x1..9x9: two rings, dashed on position 2, labelled, no throw ✓`.

## 3. The fixture correction

**Before:** the block rendered `leading: 9, alternate: 9` but passed `SWEEP_SCORES`, which is
`orderFor(9, 5)` — a score vector describing a **non-collided** record while the ring parameters said
collided. It asserted **one ring, zero dashed strokes, no ALTERNATE label**.

**After:** it passes `orderFor(N, N)` — a genuinely collided vector — for each of **nine** leading
types, and asserts **two rings, exactly one dashed stroke, an ALTERNATE label present, and the
dashed ring sitting on position 2's node and not on the leading node.**

**The correction changes no outcome, and that is the finding.** `orderFor(9, 5)` and `orderFor(9, 9)`
produce **identical** orderings `[MEASURED]` — `put(9); put(5)` gives `[9, 5, …]`, and
`put(9); put(9)` de-duplicates to `[9]` then takes 5 from the head of the tail. **The SVGs are
byte-identical.** Nothing read the vector under the old code, so the contradiction was invisible;
under the new code the vector is the thing under test, so the fixture now has to describe the record
it claims to be even though today it makes no numerical difference.

## 4. The comments — restated, not deleted

Three blocks were rewritten rather than removed.

**`:1314` — "the two rings are parameters, not derived"** now says the *leading* ring is a parameter
and the *alternate* is derived from position, and keeps the reason the leading ring must not come
from `leading_candidate`: on a REDIRECT it equals `alternate_candidate`, which would draw both rings
on one node and none on the client's own type. **That hazard is unchanged and still guarded.**

**`:1328` — "TWO RINGS ON ONE NODE: THE ALTERNATE IS DROPPED, NOT THROWN"** is the block §3 of the
brief was most concerned about, and the concern is right: a comment describing a case the code no
longer handles is how the next reader concludes something is covered when it isn't. It now records
that the earlier version **threw**, that the throw was wrong — not the refusal, the hard stop — and
that the figure still never throws for that reason. Then it states what actually changed:

* **The distinction has a better home and already lives there.** "The engine NAMED a second
  hypothesis" versus "one was INFERRED from the ranking" is an engine fact addressed to a coach or
  an admin, and `collision_flag` (`call2_stamp.js:64`, asserted by `tests/redirect_logic_test.js:58`)
  carries it there. `[MEASURED]` — those two, plus the line replaced here, were the only readers in
  the repo. It was never a rendering fact addressed to a client, and encoding it as a *missing ring*
  said nothing a reader could decode.
* **The figure was already contradicting itself.** `rankFill(posOf[i])` shades position 2
  second-darkest on every record including a collided one. The picture said "5 is second" and "there
  is no second" simultaneously — visible in `collided_9x9_before.png`. **Reading position 2 removes
  a contradiction rather than adding a claim.**

It also carries the warning from §1.1, so anyone reading the code learns there that the 72-pair
sweep cannot check this line.

**`:1322` — "position 1 is hero.number and position 2 is alternate.number"** was a note that the two
happened to agree. It now says they agree on a non-collided record and diverge on a collided one,
with the alternate ring following the ordering — which is the mechanism, not a coincidence.

## 5. The null path — kept, and re-commented for its new cause

`altN` can still be `null`, and the branch that tolerates it is kept deliberately. **Its cause has
changed and the comment now says so:** it used to mean *collided*; it now means *position 2 did not
resolve*, i.e. a malformed or empty `scores`. The figure degrades to one ring rather than throwing —
the same posture, for a different reason, and for the same underlying rule: a record the engine
ships must still render.

## 6. Gates

| gate | predicted | measured | |
|---|---|---|---|
| `npm test` | 0.23–0.45 s | **0.23 / 0.42 s** | ✓ |
| `npm run verify:render` | 52.5–53.5 s | **52.62 s** | ✓ |
| `verify_diagrams.js` | 1.2–1.4 s | **1.24 s** | ✓ |
| `verify_transparency.js` | 7.5–7.7 s | **7.53 s** | ✓ |
| `verify_coach_baseline.js` | 2.8–2.9 s | **2.87 s** | ✓ |
| `verify_content_library.js` | 0.2 s | **0.22 s** | ✓ |

Six green, 27 tests pass, 0 fail. Library unmoved at **2112 / 796 / 1316** `[MEASURED]` — no content
changed.

**`verify_coach_baseline.js` does not apply, and the reason is specific rather than general.**
`_coachPage1` **does** call `buildEnneagramSVG` (`renderer.js:1799`, as `buildEnneagramSVG(m.svg)`)
— so the question is real. But the coach model sets `svg: { variant: 'type', type: heroN }`
(`report_prep.js:228`), and `variant: 'type'` never enters the `client-quickref` branch.
**The coach path does not reach the changed line.** `[MEASURED]` — the only callers of
`client-quickref` in the repo are `scripts/verify_diagrams.js` and `scripts/verify_transparency.js`.
Run anyway the gate printed `ALL PASSED — HTML only (PDF half skipped off-Linux)`, which is a
**HALF-RESULT**, not a pass.

## 7. Predictions versus measurement

`f959a07`. **17 of 18 scored items hit. One miss.**

| # | predicted | measured | |
|---|---|---|---|
| 1.1 | inverting first goes RED | exit 1 | ✓ |
| 1.2 | fails on ring count first | first failure line is `1 rings drawn, expected 2` | ✓ |
| **1.3** | **3 distinct failure kinds** | **4** | **✗** — the node-placement check reports separately when it cannot locate a ring |
| 1.4 | green after the change | green | ✓ |
| 1.5 | 1 non-comment line changed | 1 | ✓ |
| 2.1–2.3 | 72/72 identical, 0 differing, proves only that nothing else moved | confirmed | ✓ |
| 3.1–3.3 | **0 of 10** v3 renders differ, by diff | **0 of 10 byte-identical** | ✓ |
| 4.1–4.3 | vector was `orderFor(9,5)`; both give type 5; correcting changes no outcome | confirmed, SVGs byte-identical | ✓ |
| 5.1–5.3 | coach calls the function but not this branch; gate N/A | confirmed | ✓ |
| 6.1–6.5 | 9 files; report_prep, library, server, inventory, mockup untouched; no `built`, no inventory bump | confirmed | ✓ |
| 7.1–7.2 | six green; 2112 / 796 / 1316 | confirmed | ✓ |

**The v3-render prediction is the one worth noting as a hit.** B1 changed the shared stylesheet and
all 10 renders moved; this build changes a function **no page calls**, and 0 moved. Predicting the
difference in advance is what distinguishes "the diff is small" from "the diff is what I expected".

## 8. Files

**9, as predicted:** `app/renderer.js`, `scripts/verify_diagrams.js`, `docs/build_pr5_buildR.md`,
`docs/predictions_pr5_buildR.md`, and five files under `docs/buildR_smoke/` — four PNGs and the
sheet's own README. `app/report_prep.js`, `app/content/content_library.json`, `app/server.js`,
`tests/lib/report_page_inventory.js` and the mockup are all untouched.

*(Nine paths; the smoke sheet is 5 files rather than the 5 PNGs predicted — four images plus a
README, because the fifth image had nothing to show. §3 and the sheet's README explain why.)*

## 9. For PR 7 — named, not scoped

* Nothing asserts label-versus-legend clearance in the quickref figure; the derived margin is
  10.10 px and Build R makes two-label renders more common.
* The v2 client report still names the alternate from `alternate.number` (`renderer.js:2285`,
  `:2315`), so a collided record prints the hero's own type as "also in the picture".
* B2's `.pick` panel must read **position 2**, not `alternate.number` — otherwise a collided record
  gets a panel naming one type beside a ring on another, which is the split this decision exists to
  prevent.
