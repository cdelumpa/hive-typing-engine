# PR 5 · Build B2b — the Quick Reference page

**Branch** `pr5-buildB2b-quickref-page`, base `6fff7fc`. Predictions committed first at
**`5634139`**. Every `§N` names a section of `docs/audit_pr5_quickref.md` unless said otherwise.

**Sheet 5 renders.** `_clv3QuickRef` exists, `quickref` carries `built: true`, and
`PAGE_INVENTORY.client_v3` is **11**.

## 1. Were C1–C4 achieved, and how do I know

**All four hold on all 35 renders, asserted over the rendered page rather than the model** —
`scripts/render_client.js`, the C4 block. A model-level check would prove the pair self-consistent
and prove nothing about what the client sees; the failure being guarded against is a template
naming one type beside a ring on another.

| | how it is established | result |
|---|---|---|
| **C1** both present | the panels are `H.map(pick)` over a fixed-length-2 array — no code path emits one — **and asserted anyway**, because it is the outcome | **35/35** |
| **C2** each identifiable | `role` travels with the data; label and CSS modifier are looked up **by role** (`PICK_LABEL[hyp.role]`, `PICK_MOD[hyp.role]`), never by index or a ternary, so an unknown role renders `undefined` loudly rather than silently taking the alternate's styling | **35/35** |
| **C3** two distinct types | `typeRamp` de-duplicates while placing, so position 2 can never equal position 1 | **35/35** |
| **C4** everything agrees | for each role: the ring's node, the ring **label's** node, and the panel heading's type must be **one number**; the two roles must differ; and neither panel may carry the other's copy | **35/35** |

**The assertion is red-controlled, not merely green.** Reintroducing the exact defect Build B2a
removed — sourcing the alternate panel from `m.alternate.number` — produced `[MEASURED]`:

```
*** FAIL — C4/C3 anders_sx9_t9_collided: both panels name Type 9 — one hypothesis wearing two labels
*** FAIL — C4 anders_sx9_t9_collided: ALTERNATE disagrees — ring on node 1, label on node 1,
           panel says Type 9. Every element naming a hypothesis must name the same one.
```

**6 failures on exactly the 3 collided renders; the other 32 passed.** That asymmetry is the proof
the check is worth having: on a non-collided record the scalar and position 2 agree, so the defect
is *invisible* there. **The check is silent where the defect is silent and loud where it matters —
and it only has a record to be loud on because B2a built one.**

**The last conventional link in C4 is closed.** The figure's `leading` is
`hypotheses[0].number`, not `m.hero.number`. Equal on every record — `typeRamp` places `heroN` at
position 1 unconditionally — but taken *from the pair* rather than agreeing with it.

## 2. Execution

**Three commits, in this order, deliberately.**

**1 — the content, proven inert.** `type_N.quickref_v3 = { core_motivation }`, nine second-person
strings, DRAFT. A **sibling** of `type_N.description.core_motivation`, not a replacement: that field
is rendered twice in the **coach** report (`renderer.js:247`, `:1883`), so person-shifting it in
place would have a coach reading *"…asserting **your** own priorities"* about their client.

Not a leaf inside `description` either — `type_N.description` **is** CMS-editable
(`cmsIsValidTypeKey`) `[MEASURED]`, so a new leaf there is the `assertOverrideShape` hazard.
`content_overrides` is **TABLE EMPTY** on the deploy target `[MEASURED]`, which would make the leaf
safe *now* — and that is exactly the reasoning that leaves a key unsafe later.

`[MEASURED]` leaves **2112 → 2121**, `INTERIM_*` **796 → 805**, Word-canonical **1316 unchanged**,
chars 123–163 mean 141.6, the shared v2 field untouched. **0 of 10 renders differed** — proven
before the page was written, which is what lets a red gate be attributed to the page rather than the
content.

**The recipe's own check is asserted, not claimed.** `validateQuickrefType` requires type 9's string
to be byte-identical to the ratified mockup's `.ptxt[0]`. If the transform is ever re-run and stops
reproducing it, the build fails.

**2 — the page.** `_clv3QuickRef`, `built: true`, inventory 10 → 11. Panels map over the pair;
`instinctRanks` is the same helper p10 calls, so the two pages cannot disagree about which instinct
is Primary; the subtype comes from `hypotheses[0].subtype` so it cannot describe the alternate; the
tagline is composed as `${naranjo} · ${signature}` with **no article**, and the mockup's unratified
`The Seeker` is not ported.

**3 — the C4 assertion and the smoke sheet.**

## 3. Issues that emerged

**a. The C4 check was wrong on its first run, and the failure was mine, not the page's.**
12 of 35 renders failed with *"no LEADING ring LABEL found in the figure"*. My locator matched a
label to the numeral sitting at the label's own `x` — but `renderer.js` **deliberately pushes two
labels apart** when they would collide on one rail, so a label's `x` stops matching its node's by
design. Fixed by matching each label to the **nearer of the two rings**, which is sound because the
push moves them apart and never across each other. The comment records why, so the next reader does
not "fix" it back.

**Worth noting what this was not:** the rings, panels and types agreed on all 35 from the first run.
Only the check's own geometry was wrong — a check failing loudly rather than a page failing quietly.

**b. Fit — the contingency I named, and it did not fire.** `[MEASURED]` across all 35 renders:
sheet 5 fits one page on every one. Headroom **58.77–81.02 px free**, mean **69.35 px**, worst case
`anders_sx9` re-typed to **Type 1** at 58.77 px. **No copy was touched.**

That is tighter than before this build, and predictably so: both panels now take the new field, and
the alternate grew from 80 chars to 155 for type 5. The B1 scaffold measured 100.77 px with the old
mixed sources; ~31 px of that went to the longer alternate panel.

## 4. Gates

| gate | predicted | measured | |
|---|---|---|---|
| `npm test` | 0.22–0.45 s | **0.25 s**, 27 pass / 0 fail | ✓ |
| `npm run verify:render` | 58–64 s | **56.91 s** | ✗ — 1.1 s under the band |
| `verify_diagrams.js` | 1.1–1.4 s | **1.22 s** | ✓ |
| `verify_transparency.js` | 7.5–8.2 s | **7.54 s** | ✓ |
| `verify_coach_baseline.js` | 2.8–2.9 s | **2.84 s** | ✓ |
| `verify_content_library.js` | 0.2 s | **0.22 s** | ✓ |

**Library 2121 / 805 / 1316.** `[MEASURED]` **10 of 10** v3 renders differ from `6fff7fc` — expected
and predicted, because a page was added; container count 9 → 10 in the tracked render.

**`verify_coach_baseline` does not apply** — the coach path is untouched and the shared field is
unchanged, which was the whole reason for a sibling. Off-Linux it printed `ALL PASSED — HTML only
(PDF half skipped off-Linux)`: a **HALF-RESULT**, not a pass.

## 5. Predictions versus measurement

`5634139`. **21 of 23 hit.**

| # | predicted | measured | |
|---|---|---|---|
| 1.1–1.4 | 9 leaves → 2121 / 805 / 1316 | exact | ✓ |
| 1.5 | type 9 byte-identical to the mockup | asserted in the build | ✓ |
| 1.6 | content commit inert | 0 of 10 | ✓ |
| 2.1–2.5 | inventory 11; 10 of 10 differ; 35 renders; footer 3 real | all confirmed | ✓ |
| 3.1–3.5 | C1–C4 on all 35, asserted over the rendered page | 35/35 | ✓ |
| 4.1 | fits on all 35 | fits | ✓ |
| **4.2** | headroom **60–85 px** | **58.77–81.02 px** | **✗ — 1.23 px below the band** |
| 5.1–5.4 | 9 files + smoke sheet; no `server.js`; mockup untouched | confirmed | ✓ |
| **6.x** | `verify:render` 58–64 s | **56.91 s** | **✗ — 1.1 s under** |

Both misses are undershoots on ranges I set, and both are small. The headroom one is the more
interesting: I predicted from the B1 scaffold's `anders_sx9` figure and did not account for the
worst case being a **different type** — Type 1's pair is longer than Type 9's.

## 6. Outstanding

**Nothing blocking.**

**One thing for Cai, and it is the reason the smoke sheet exists.** C2's *visual* half —
whether the alternate reads as a second offer rather than an afterthought — is a design property no
assertion can reach. The three full-page renders in `docs/buildB2b_smoke/` are for that judgement.

**One observation, not a request.** `p5_ordinary_type9.png` and `p5_collided_type9.png` are
**byte-identical** `[MEASURED]`, same MD5. That is the outcome working: a collided record is no
longer a visibly different page. If they ever stop matching, something has regressed.

**Deferred, as planned:** the `cmsPreviewSpec` entries for sheet 5's six editable keys. Editability
landed in Build A; preview needs the selector this page now provides, and it is a later build.
