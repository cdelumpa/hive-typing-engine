# PR 5 · Build B4 — CMS preview for sheet 5

**Branch** `pr5-buildB4-cms-preview`, base `9be6089`. Every `§N` names a section of
`docs/audit_pr5_quickref.md` unless said otherwise.

## 1. The question asked before starting, answered

**Can the sentinel test be written without dragging PR 7's extraction in? Yes.**

`app/server.js` calls `app.listen()` unconditionally at require time, so nothing can load it —
that part of the audit stands, and this build does not change it. But the test does not need to
reach **existing** functions. It needs to reach the **new** ones, and where those are born is a
choice.

**The six sheet-5 entries live in `app/cms_quickref_preview.js`.** `server.js` requires it and
spreads them into the maps `cmsPreviewSpec` already builds. Nothing existing moves,
`cmsPreviewSpec` keeps its shape, and the surface this build adds is testable from its first
commit. `[MEASURED]` — the `apply` closures capture nothing from `server.js` scope except
`instinct`, which a factory takes as an argument.

**My earlier framing was the wrong instinct.** "Add to the untestable file and let that force the
extraction" trades a real property now for a hoped-for refactor later. Not adding to it is cheaper
and better, and it leaves PR 7's card exactly as it was.

## 2. Were P1–P3 achieved

**Yes, and all three are asserted in `npm test`** (`tests/cms_quickref_preview_test.js`, 6 tests,
33 pass / 0 fail overall).

| | how it is established | structural? |
|---|---|---|
| **P1** every editable key previewable | a test reads `CMS_STATIC_FIELDS` and `cmsPreviewSpec`'s `STATIC` map and asserts every editable static key is previewable | **yes** — the coincidence you flagged (8 of 8, nothing asserting it) is now pinned at 13 of 13 |
| **P2** the right page | `.v3-page:has(.v3-qr-two)` — and a test asserts `class="v3-qr-two"` appears **exactly once** in the rendered document | **yes** |
| **P3** the client's page | already true for model and builder — `cmsRenderPreviewPng` uses `buildClientModel` and `buildClientReportHTML_v3`. The **apply is the seam**, and each one is applied to a real model, rendered by the real builder, and required to put its sentinel on sheet 5 | **yes**, at the seam |

**The sentinel tests are red-controlled.** Two deliberate defects — the lead's apply writing
`lead_v3` instead of `lead`, and the subtype's apply writing a sibling key instead of
`hypotheses[0].subtype` — were both caught, and the other four tests kept passing. That is the
failure mode worth catching: an apply writing a field the builder does not read shows an editor the
**old text with no error at all**.

**One thing P1's test cannot do.** It reads `server.js` **as text**, because it cannot load it. A
text scan catches a key added to one list and not the other — the actual failure — but it cannot
catch a malformed entry. Sheet 5's six are covered by the sentinel tests instead; the other seven
static keys are not, and that is a limit of this build, not a property of the design.

## 3. What P4's fit check does and does not cover

**Does:** measures sheet 5's intrinsic stack and the subtype box's rendered line count, in the page
already open immediately before the screenshot, and returns a verdict with the PNG.

**Worst case, not the previewed case.** A static key previews at Type 9 — 73.86 px free — while
Type 1 has 51.61. `[MEASURED]` The sweep runs all nine and reports the tightest. A subtype summary
appears on exactly one type's sheet, so its own type **is** the worst case and the sweep is skipped.

**The latency objection I raised was wrong, and measuring it is what settled it.** I expected nine
renders to be too slow to sit behind a preview button. On a reused page they run in **0.1–0.2 s**
`[MEASURED]` — `setContent` at `domcontentloaded` on a warm page is cheap. So no compromise was
needed: static keys measure all nine, and the tradeoff I described in the plan does not exist.

**Two failure modes, both exercised end to end** `[MEASURED]`:

| edit | verdict |
|---|---|
| lead + ~460 chars | *"This will push the page onto a second sheet. On Type 1 it runs 56.8px past the bottom."* |
| SX5 summary + one sentence | *"The subtype summary runs to 5 lines. Three is the most that fits — a fourth pushes the page onto a second sheet."* |

**The second case still had 14.11 px of page free.** It is caught on **line count**, not height —
the summary broke its three-line bound before the page ran out of room. A height-only check would
have passed it. That is why both are measured.

**Advisory, never blocking** `[DECISION — Cai, 10 Sep]`. The wording names the consequence rather
than a rule, which was the instruction and is the part that matters.

**Does NOT cover — and this does not close IO-93.** It catches what someone **previews**. A
published override that was never previewed still reaches production unmeasured. The downstream
half is a check over *published* overrides, which belongs with `overrides_check.js` and is its own
build. Said plainly here because a check that looks total is worse than one whose edges are known.

## 4. Execution

`app/cms_quickref_preview.js` — five static entries, a subtype factory, the browser-side fit probe
and the verdict function. `app/server.js` — requires and spreads them, widens the subtype regex by
one alternative, runs the sweep inside `cmsRenderPreviewPng`, and returns `fit` alongside `png`.
The modal gained a verdict line; its CSS and markup are duplicated across the three admin pages, so
**all three** were updated `[MEASURED]`, 3 of 3.

**The caption names the type in the picture.** The verdict covers every type the string reaches,
which is usually not the one shown — so without the caption the image would quietly claim to be the
thing that was measured. That was my own objection to reporting the previewed type's number, and it
applies to the picture as much as to the number.

## 5. Issues that emerged

**a. Three sentinel tests failed identically on the first run — and the tell was that they were
identical.** My `sheet5()` helper searched for the bare token `v3-qr-two`, which appears in the
`<style>` block and in a CSS comment **before** it ever appears in markup, so it sliced the wrong
region and every sentinel missed. The same mistake made the P2 count report 3 instead of 1. Fixed
to match `class="v3-qr-two"`.

**This is the second time in two builds that a check was wrong rather than the code** — B2b's C4
label locator assumed a label's `x` matched its node's. Both were caught because the failure
pattern was implausible for the thing supposedly under test. Worth naming as a habit: *when several
independent assertions fail the same way, suspect the harness.*

**b. A regression check that came back clean, and was worth running anyway.** `cmsPreviewApiResult`
carries a comment saying its nine-entry ranking exists so v3 previews would not throw *"the moment
sheet 5 is `built`"*. Sheet 5 is now built — so I verified all three v3 preview stubs still build
and render `[MEASURED]`. They do. **B2b introduced no preview regression.**

**c. A correction to my own B2b report.** I wrote "container count 9 → 10". Wrong: my scratch regex
`class="v3-page"` misses the cover's `class="v3-page is-cover"`. The real counts are **10 → 11**,
matching `v3PagesFor(9).length` and the gate — which asserted 11 and passed. The gate was right; the
number I published was not.

## 6. Gates

**33 pass / 0 fail** (was 27; six new). Six gates green. Library **1316/2121**, unmoved — no content
changed. C4 failures **0** across all 35 renders.

`verify_coach_baseline` does not apply — no coach path touched. Off-Linux it is a **HALF-RESULT**.

## 7. Outstanding

**Nothing blocking.**

- **IO-93's downstream half** — a check over published overrides — is untouched and is its own build.
- **The seven pre-existing static keys have no sentinel coverage.** Sheet 5's six do. Closing that
  needs the PR 7 extraction, which is where it belongs.
- **B3 inherits a measurement, not a duplicate.** The fit probe and verdict are exported from
  `app/cms_quickref_preview.js`; B3's harness assertion should call them rather than re-derive the
  numbers, so preview and the gate cannot disagree about what "fits" means.
