# Plan — PR 4 step 6B: the Z6 cap as a CI regression gate

**Branch:** `pr-4-step6b-cap`, off `main` @ `a4a3dca` (the 6A merge). **Fresh pull: already
current.** [CC-MEASURED]

**Why this doc exists.** It carries measurements that would otherwise live only in a chat log —
the prediction table on both headroom bases, the preview re-cut's char/fill range, and the
three-items-versus-one equivalence. Every step of PR 4 has landed its planning with its build.

Tags: **[CC-MEASURED]** rendered or read out of the repo · **[CC-DERIVED]** arithmetic on measured
values · **[CC-PREDICTED]** committed before the build ran · **[CC-JUDGMENT]** my read.

**Counting basis.** Characters are whitespace-collapsed and ends-trimmed. `lines` is the merge-by-
top-edge Range count from `scripts/lib/line_metrics.js`. `box` is `.v3-inst-resp`. `natural` is the
`.v3-page` height with `min-height` released. **Headroom is given on both bases throughout**, because
two are in circulation and they differ by exactly 1px: `1056 − natural` is what
`scripts/render_client.js` prints, and the page gate fails above **1057**.

---

## 1. Three corrections that became the design

### 1.1 "Mechanism E" is retired as a label

The audit priced four mechanisms — measure-and-trim, select-fewer-items, a producer word contract,
and refuse-and-report. **All four were runtime behaviours.** Once the cap was scoped as a CI
regression gate (audit Amendment 4 §A), the runtime half left this step entirely, and **CI can only
do one thing: fail.**

So there is no mechanism choice left to make. **6B builds an assertion.** The letter is not used in
this repo, because it dresses a foregone conclusion as a design decision. The contingency the audit
attached to it — "contingent on the still-open editing-surface question" — applied only to the
runtime half and was **stale from the moment the scoping was settled**. It was carried forward
without being re-derived against a decision made in the same document.

### 1.2 The exemption is replaced by a declaration, not flipped off

6A introduced `z6Exempt = z6Key != null` so that two states that spill by design would not take the
matrix red on every branch. 6B removes it — but **not by flipping enforcement on.**

**An exemption only suppresses failures. A declaration also catches a state that stops failing.**
If someone shortens `EM_PARAGRAPH`, the hazard case silently stops being a hazard case and an
exemption notices nothing.

Two mandatory fields per Z6 state, **no defaults**:

| field | meaning |
|---|---|
| `capLines` | the exact expected rendered line count. **Asserted exactly, not as a bound.** |
| `page` | `'fits'` or `'spills'`, asserted against the existing page gate |

**They are not redundant.** A 6-line state exceeds a cap of 5 **and still fits the page** at
1053.88px natural. Both facts have to be declarable independently.

**Name collision, recorded so it is not walked into:** `expect` is already used in `Z6_STATES` for
the *model-shape* expectation. The new fields must not shadow it.

**No tripwire.** A hand-maintained literal on the `report_page_inventory.js:47` precedent was
considered and rejected: once every state carries a declaration there is **no exemption left to
reintroduce**, so a tripwire would guard a thing that no longer exists. The declaration table is
self-policing in a way a literal is not — a new state with no declaration cannot inherit a
permissive default, it fails by name.

### 1.3 Declare the expectation; do not catch the failure

`render_client.js:346` is `const fail = (msg) => { failed = true; ... }`, and `failed` gates the
exit code. If a state were "expected to fail", the run's green would **depend on a failure having
occurred**, which inverts the harness's contract and leaves a later reader unable to tell whether a
red run is real.

`fail()` is therefore called **only when an observation contradicts its declaration.** Green keeps
its ordinary meaning: everything matched what it said it would do.

---

## 2. The preview re-cut — why 5 lines, and what not to assert

`CMS_PREVIEW_V3_EVIDENCE` renders **4 lines / 128.50px** under the join. It is one line under the
cap.

**The reason it must sit at the cap is not "honesty about the limit".** The editor using that
preview is editing **Z3 definitions and Z5 narratives** — the content that shares p10 with Z6. They
cannot edit Z6 at all. So the preview's real job is: *if I lengthen this narrative, does the page
still fit?* At 4 lines it answers that question with **19.375px of slack production will not have**,
and an editor could make a change that previews clean and spills in production. [CC-JUDGMENT]

**Measured, and it constrains the re-cut:** [CC-MEASURED]

| variant | chars | els | lines | box | natural |
|---|---|---|---|---|---|
| current, 3 items | 359 | 1 | 4 | 128.50 | 1015.13 |
| **current, joined to 1 element** | **359** | **1** | **4** | **128.50** | **1015.13** |
| + one clause | 422 | 1 | 4 | 128.50 | 1015.13 |
| + longer clause | 439 | 1 | 4 | 128.50 | 1015.13 |
| + two clauses | 467 | 1 | **5** | **147.88** | **1034.50** |

**Three items and one element render identically** — the join made the shape irrelevant, which is
why the constant can be reduced to one element to match production's actual shape at no visual cost.

**A 5-line cut lands at 477–485 chars with a last-line fill of 15.9%–26.3%**; reaching roughly 50%
fill needs about 525 characters. [CC-MEASURED across six candidates]

**Do not assert the preview's fill.** It is a readability choice, not a contract — pinning it would
be the same over-pinning rejected for `EM_OBSERVED_MAX`, where the absolute last-line and
widest-line widths were deliberately left unpinned. **Assert lines and box.**

### The canary, stated plainly

**The preview state and `em_observed_max` both sit at 5 lines / 21.50px, so they are the first
things that go red on ANY p10 growth.** A later reader will see a red preview and conclude the
preview is broken, when what happened is that the page grew. This is written into the fixture file
in the same terms.

---

## 3. Landing order, with the unrepeatable-observation test

**Step 1 — declarations only. Exemption still in place.**
*Unrepeatable: nothing.* Deliberately inert: the declarations exist and nothing reads them, so a
mistake is visible before it can gate anything.

**Step 2 — cap gate + declaration enforcement; exemption removed.**
*Unrepeatable:* **the moment the exemption and the expectations coexist.** It is the only point at
which one can prove the *expectations* keep the run green — delete the exemption and observe the
verdict not change. Once the exemption is gone that comparison cannot be made again.

**Step 3a — preview state added, constant still at 4 lines. RUN IS RED.**
**Step 3b — constant re-cut to 5 lines, one element. RUN IS GREEN.**
*Unrepeatable:* the pre-re-cut render **with the cap gate live**. As a single commit this happens
between two edits in a working tree and is not preserved; split, the history shows the assertion
catching drift that actually occurred rather than a red proof reconstructing it.

> **The one cost of a deliberately red commit, named rather than glossed:** `git bisect` through
> 3a returns a false "bad" on `verify:render` for an unrelated hunt. It is bounded to one commit and
> mitigated by saying **RED BY DESIGN** in the commit subject, where a bisector reads it. CI is
> unaffected — the workflow runs on pull-request and main-push heads, not on intermediate branch
> commits. [CC-JUDGMENT: the cost is real and worth paying; the observation is worth more.]

**Step 4 — docs.** Last, recording what the runs did rather than what they were meant to do.

---

## 4. Predictions, committed before the build

[CC-PREDICTED — every row measured in the scratchpad before being written down.]

| Z6 state | lines | box | natural | headroom 1056 / 1057 | declared |
|---|---|---|---|---|---|
| `null` (sp4's own) | 4 | 128.50 | 1015.13 | 40.87 / 41.87 | `fits` |
| `sm_bullets` | 5 | 147.88 | 1034.50 | 21.50 / 22.50 | `fits` |
| `em_paragraph` | **7** | 186.63 | 1073.25 | −17.25 / −16.25 | **`spills`** |
| `em_observed_max` | 5 | 147.88 | 1034.50 | 21.50 / 22.50 | `fits` |
| preview, pre-re-cut | 4 | 128.50 | 1015.13 | 40.87 / 41.87 | — |
| preview, post-re-cut | **5** | **147.88** | **1034.50** | **21.50 / 22.50** | `fits` |

**Matrix 31 → 32.** CI render step **83.6s → ~86.0s** [CC-DERIVED: 6A measured +7.3s for 3 renders,
so 2.43 s/render]. Coach byte-diff: **no movement, both halves, 0 SKIPPED.**

**The testable claim, stated once:** **zero pre-existing renders change output.** One state is
added. 6B does not touch `app/renderer.js`, so nothing that renders today can move. *(The 6B plan
first said "only one existing render changes" and then "no pre-existing render moves at all" — the
first was left over from 6A, where sp4's own render did change. Only the second is true here.)*

---

## 5. Boundary

**6B does not:** add any production guard; touch `app/renderer.js`, `app/report_prep.js` or
`app/em_report_adapter.js`; touch p6; revise the EM Report Call; or trim, truncate or alter client
content.

**The cap does not protect clients from a spill. Nothing does** — `generate_report.js:588` is a
bare `page.pdf()` call and `scripts/render_client.js` is a CI harness reached only through
`npm run verify:render`. **6B hardens a CI regression gate.**

---

## 6. What outlives PR 4

Two items **created by PR 4**, so neither is on the out-of-scope list:

1. **`cmsWordBudget` does not exist.** 15 occurrences across four committed PR 4 audit docs name a
   function whose real name is `cmsBudgetFor` (`app/server.js:10006`). [CC-MEASURED]
2. **p10's inter-zone spacing is unasserted.** `V3_GEOMETRY` asserts four properties; the gaps
   between Z2/Z3/Z5/Z6 are not among them — **and the unisolated 6.00px scaffold offset lives in
   that same stack.** They are one investigation seen from two ends.

For the wider document: **10 of 12 v3 pages are built.** `quickref` (sheet 5) and `car` (sheet 11)
remain, and they are PR 5/6 — they are also what the TOC card is now actually about.
