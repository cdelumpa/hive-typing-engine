# Audit — PR 4 step 5, the renderer

**Branch:** `pr-4-step5-renderer-audit`, off `main` @
`f3ce143a2049bf00a80dddb3eb109729feffbb72` (`f3ce143` — "Merge pull request #89"), pulled and
confirmed 7 Sep 2026. **Main has not moved** since step 4 merged. [CC-MEASURED]

**Nature:** audit. No renderer, no `V3_PAGE_BUILDERS` entry, no CSS, no CMS, no fixture.

Tags: **[CC-MEASURED]** read out of the repo or executed · **[CC-DERIVED]** arithmetic on measured
values · **[CC-JUDGMENT]** my read.

**Two headlines, both measured, both refuting a premise in the prompt:**

1. **§3's page-gate problem does not arise.** The gate is real, but the gated fixture renders Z6
   *empty*, and so does every real fixture at 3–4 lines. Step 5 goes green without the cap. **No
   reorder.**
2. **§9's CMS preview is bigger than a mapping.** `cmsRenderPreviewPng` calls
   `buildClientReportHTML` — the **v2** builder. Previewing a v3 field needs the harness taught to
   build the v3 document, not a `cmsPreviewSpec` entry.

---

## 0. A correction I owe first

**The function is `cmsBudgetFor` (`app/server.js:9998`). There is no `cmsWordBudget` in the
codebase.** [CC-MEASURED] I have called it `cmsWordBudget` in four committed documents —
`audit_pr4_instincts_subtypes.md`, `audit_pr4_step2_fixture_axis.md`,
`audit_pr4_step4_content.md`, `p10_fit_results.md` — and, worse, in a **code comment I wrote at
step 4**, `scripts/build_content_library.js:1355`.

Everything I said *about* it was right: the branches, the return-0 behaviour, the line numbers.
Only the name was wrong, and it is now on main in a comment. **Step 5 touches no content file, so
I have not fixed it here.** Correct the comment in whichever build next opens that file; the docs
can carry the correction in this one.

---

## 1. §3 — the page gate. Answered first, because it was said to be the plan-changer

### 3a. What asserts page height, where, and on what

**One assertion, and it is enforced.** `scripts/render_client.js:364`: [CC-MEASURED]

```js
if (cfg.enforceSheet && p.height > PAGE_PX + 1) {
  fail(`… spills to ${p.sheets} sheets (${p.height}px > ${PAGE_PX}px)`);
}
```

`PAGE_PX = 1056`, so the threshold is **> 1057**. `client_v3` carries `enforceSheet: true`
(`:116`), and the check runs **inside the per-page loop of every render in the job** — so every
page of every one of today's 11 renders. `fail()` sets the exit code, so a spill is a red CI run.
[CC-MEASURED]

Nothing else asserts page height. `report_pages_test.js` works on HTML strings with no browser and
cannot measure pixels. [CC-MEASURED]

### 3b. Would a step-5 page with an uncapped worst-case Z6 fail it? — **The situation does not arise**

The premise assumes the gated matrix carries a worst-case Z6. **It does not, and adding the
deferred fixtures does not make it.** Three measurements:

**1. The gated fixture renders Z6 empty.** `anders_sx9_api_result.json` has `client_facing: {}`, so
`instinct_evidence` is `undefined` → `null` in the model → the box is guarded out entirely.
[CC-MEASURED] Rendered at the real grid with the new Z3 and the revised SO7:

| Type | page px | headroom |
|---|---|---|
| all nine | **1056** | **+197.38px** |

Every type renders at exactly the sheet height, with 197.38px to spare — **10.2 lines of Z6** at
19.37px/line. [CC-MEASURED / CC-DERIVED]

**2. Step 2's Z6 states are model-only.** `scripts/render_client.js` does not import `applyZ6` or
`Z6_STATES`; they are exercised in `tests/instinct_axis_test.js` against the built model, never
rendered. [CC-MEASURED] That was deliberate at step 2 and it is why the synthetic worst cases
cannot reach the page gate.

**3. The fixtures deferred *into* step 5 carry real evidence, and it is small.** sp4 — the one the
step-3 switch adds — carries three real bullets, and so does sx7. Rendered in the real Z6 box:
[CC-MEASURED]

| Z6 payload | box | lines | chars |
|---|---|---|---|
| `sm_bullets` (synthetic, over-spec) | 173.25px | 6 | 568 |
| `em_paragraph` (synthetic, sp4's *overlay*) | 186.63px | 7 | 775 |
| **sp4's real `instinct_evidence`** | **134.5px** | **4** | 360 |
| **sx7's real `instinct_evidence`** | **115.13px** | **3** | 332 |
| `null` / `absent` | 0 | 0 | 0 |

**sp4 at 4 lines leaves +46.88px; sx7 at 3 lines leaves +66.25px.** [CC-MEASURED / CC-DERIVED]
Both are inside the decided 5-line cap without the cap existing.

**So: step 5 goes green, with or without the cap, and adding sp4 does not change that.** The
answer to 3b is no. [CC-MEASURED]

### 3c. The options — and why none is needed

There is exactly **one** way to create the failure: put a *synthetic* worst-case Z6 into the
**render** matrix. Nothing proposes that, and step 2 deliberately kept those model-level. The
recommendation is therefore to **change nothing**: the synthetic worsts stay where step 2 put them,
and the cap stays at step 6 where it was decided.

**What the cap is actually for, restated so its absence at step 5 is not mistaken for safety.** The
existing fixtures do not exercise the failure — that is a fact about two fixtures, not about the
producers. Neither producer respects its own spec: the EM sample is 5 sentences under a "2–4
sentences" instruction, and `CMS_PREVIEW_WORST_EVIDENCE` runs 27/29/28 words against "≤25 words
each". [CC-MEASURED, step 3] **The cap protects against producer output no current fixture
exhibits.** Step 5 being green says nothing about that, and the build report should say so.
[CC-JUDGMENT]

### 3d. What Z2 renders at step 5

**`static.instinct_primer`, the committed string, AS-IS** — 330 chars, measured at 3 lines /
65.06px at 710px. [CC-MEASURED] No v3-only field is needed, and here is the distinction the prompt
may be collapsing:

> **The v3-only rule is about *editing* a shared field, not about *reading* one.** The hazard at
> steps 1 and 4 was that changing a string for p10 would change what live v2 clients see. Step 5
> changes no string; it renders one that already exists.

**But it does create a coupling that does not exist today, and that is worth stating.** Once p10
renders `static.instinct_primer`, the two pages share a string: an edit for v2 moves p10, and an
edit for p10 moves v2. Today only v2 reads it. Since Z2's content decision is **open** — including
the type-token question — that moment may well come, and when it does the field needs the same
`_v3` treatment `instinct_definitions` just got. Reading it now is safe, reversible, and prejudges
nothing. [CC-JUDGMENT]

---

## 2. §2 — one step or two? **Two, and the seam is sharper than Claude's read**

### 2a. Separable, and the dependency runs one way only

**The renderer does not need the CMS.** No `V3_PAGE_BUILDERS` entry, no CSS and no model read
depends on any CMS surface. [CC-MEASURED — the existing nine builders reference no `cms*` symbol.]

**The CMS needs the renderer, and by more than the prompt assumes.** `cmsPreviewSpec` needs a page,
which is the known half. The unknown half:

> **`cmsRenderPreviewPng` (`app/server.js`) calls `buildClientReportHTML(model)` — the v2 document
> builder — not `buildClientReportHTML_v3`.** [CC-MEASURED]

So previewing *any* v3 field requires teaching the preview harness to build the v3 document and
select within it. That is not "add a mapping"; it is a branch in the preview path plus a v3
analogue of the `.p6-page` special case that injects `CMS_PREVIEW_WORST_EVIDENCE` (`:13915`).
[CC-MEASURED] **That is the strongest argument for the split**, and it is stronger than the
review-surface argument the prompt makes.

### 2b. Order and gates

**5A — the renderer, first.** Gate: renders. The 27-render matrix goes green, the negative
assertion is red-proven both halves, the geometry assertions hold (§5), and the page gate stays
green at 1057.

**5B — the CMS, second.** Gate: shape assertions and a preview that actually renders. Nothing in it
is checked by a render of the client document; everything in it is checked by admin plumbing.
Different evidence, and — measured — a different file: 5A touches `app/renderer.js` and
`scripts/render_client.js`; 5B touches `app/server.js`, which 5A does not open at all.

**I am not countering the split. I am strengthening it**, and adding that 5B is larger than it
looked because of the v2-only preview harness. [CC-JUDGMENT]

---

## 3. §4 — everything that moves when the page appears

`instincts` is already in `V3_PAGE_ORDER` with `sheet: 10, footer: 8` and **no `built` flag**.
Adding a builder and `built: true` takes `v3PagesFor(n).length` from 9 to 10. [CC-MEASURED]

| # | Thing | Moves how |
|---|---|---|
| 1 | **`tests/lib/report_page_inventory.js:47`** — `client_v3: { 'v3-page': 9 }` | **BY HAND, 9 → 10.** Its own comment says so: *"Raise this as each page PR lands"*, and *"⚠️ THIS LITERAL IS DELIBERATELY NOT DERIVED FROM V3_PAGE_ORDER… This number is the tripwire."* **The single most likely missed line in step 5.** [CC-MEASURED] |
| 2 | `EXPECTED_PAGES` (same file) | **Automatic** — derived by summing `PAGE_INVENTORY`. |
| 3 | `report_pages_test.js:117` and `:179` | **Automatic** — both assert against `EXPECTED_PAGES.client_v3`. Two assertions, one number. |
| 4 | `report_pages_test.js:199` `builtPages = R.v3PagesFor(...)` | **Automatic** — derives from the `built` flags. |
| 5 | `report_pages_test.js:207–210` rendered-footer sequence | **Automatic** — `wantFooters` derives from `withChrome`. Footer **8** enters the sequence. **The comment at `:206` naming the sequence is already stale and will get staler**; it is prose, not an assertion. [CC-MEASURED] |
| 6 | `render_client.js` `expectedFor` / `labelsFor` | **Automatic** — both call `v3PagesFor`. |
| 7 | PDF sheet count | **Automatic** — `sheets` accumulates per page; the v3 PDF gains one sheet. Coach PDFs are unaffected (`enforceSheet: false`, separate job). |
| 8 | Positional indexing | **None found.** `p.index` indexes into `labelsFor(asType)`, which derives from the same list. No test indexes `.v3-page` by a hardcoded position. [CC-MEASURED] |

### The TOC — it stays silent, and that is itself the finding

`report_pages_test.js:216–222` asserts the Contents page-number column equals
`model.pages.v3_contents.map(e => order.find(p => p.key === e.start).footer)` — i.e. **TOC against
`V3_PAGE_ORDER`, not against pages actually emitted.** [CC-MEASURED]

Measured on today's build: [CC-MEASURED]

```
TOC page-number column, rendered today : [1,2,3,4,6,7,8,9,10]
footers of pages actually built        : [1,2,4,5,6,7,10]
TOC numbers with NO emitted page       : [3, 8, 9]
```

**The TOC promises three pages that do not exist — quickref (3), instincts (8), car (9) — and
nothing asserts otherwise.** Building p10 removes one of the three **silently**: the assertion
passed before and passes after.

That is a real gap, and it is adjacent to step 5 rather than part of it. **An assertion that every
TOC entry names a page the document actually emits would fail today** (three entries), so it cannot
simply be added — it would have to be scoped to built pages, or land with the last of the three.
**Own card. Do not widen step 5 into it.** [CC-JUDGMENT]

---

## 4. §5 — holding the shipped page to the measured geometry

Every figure in `docs/p10_fit_results.md` was taken on a scaffold, and my own step-3 scope says
step 5 need not inherit its markup. So the shipped page can drift from the measured one, and
nothing today would notice.

**What I would assert, and where.** `scripts/render_client.js` already has the machinery: it runs a
real Chromium render per type and already carries two per-zone hooks — `pairChecks` (line-count
pairs) and `fillZones` (last-line fill), both consuming `scripts/lib/line_metrics.js`.
[CC-MEASURED] A third hook of the same shape is the natural home, because it runs **on every v3
render in CI**, which an HTML-string test cannot.

Three assertions, and the third is the one that matters:

1. **`.v3-inst-` column content width = 207.33px**, ±0.05, measured with
   `getBoundingClientRect` minus padding — **not** `line_metrics.contentBox`, which derives from
   integer `clientWidth` and reports 207. That distinction cost me a false failure at step 3 and
   should be written down where the next person will hit it. [CC-MEASURED]
2. **The badge row reserves 13px with the badge removed.** Asserting the row *is* 13px is satisfied
   by the badge being 13px tall on its own; the reservation is the thing that matters, and testing
   it means removing the badge and re-reading. Step 3 shipped the weak version first and had to fix
   it. [CC-MEASURED]
3. **The tallest column's intrinsic height, not the card box.** `.ccard` stretches, so all three
   columns report the same height whatever they hold — measured 297.81 across the board against
   intrinsic needs that differ. An assertion on the card box would be green while the page was
   wrong. [CC-MEASURED]

**Where the numbers come from.** They are in `docs/p10_fit_results.md`, and the assertion should
cite it, so a future divergence sends the reader to the measurements rather than to a bare
constant. [CC-JUDGMENT]

---

## 5. §6 — the negative assertion

**Still the right shape, and now it can actually be built.** The trap stands: *"the emitted
`v3-inst-` page contains no shift zone"* is **green right now**, because
`V3_PAGE_BUILDERS` has no `instincts` entry and nothing is emitted. [CC-MEASURED] A negative
assertion that passes before the work starts is not a gate.

**Where it lives: `tests/report_pages_test.js`.** It is an assertion about emitted HTML, needs no
browser, and that file already holds the v3 page-inventory and footer-sequence contracts. The
render harness is the wrong home — it measures geometry, and this is a content-absence claim.
[CC-JUDGMENT]

**Two halves, two red proofs:**

1. **Presence** — the `v3-inst-` page IS emitted. Red proof: remove the `V3_PAGE_BUILDERS` entry
   and assert it fails. Without this half the negative is vacuous.
2. **Absence** — no shift zone and no "Leaning Into the Other Instincts" block. Red proof: inject a
   shift-shaped block into the model and assert red.

`subtype.shifts` is on the same row the builder reads and already renders on live v2 p7, so the
absence half is guarding against a real and easy mistake, not a hypothetical one. [CC-MEASURED]

---

## 6. §7 — badges and the NULL dominant

### The p10-local ordering

PRIMARY from `dominant_instinct_hypothesis`; SECONDARY/TERTIARY by `instinct_score_profile`
descending. It must be **p10-local**: `instinctStack` (`report_prep.js:65`) is read by live v2 p6
(`renderer.js:2254`), the coach report, and the Coach Prep Report (`server.js:2278`).
[CC-MEASURED]

**Where it lives: in the p10 builder, from `model.charts.instincts` and
`model.display.instinct_code`** — both already on the model, neither carrying an ordering.
`charts.instincts` is declaration-ordered `SP/SO/SX` with raw scores, so p10 sorts its own copy.
[CC-MEASURED] That touches no shared function. The alternative — a second exported helper beside
`instinctStack` — would put two ordering rules in one module and invite the wrong import.
[CC-JUDGMENT]

### NULL dominant — **the premise is wrong, measured**

> §1 says: *"pre-migration rows hold NULL, and under this decision PRIMARY has no source when it is
> null."*

**A null `dominant_instinct_hypothesis` alone does not leave PRIMARY without a source.**
`report_prep.js:213` is `h.dominant_instinct_hypothesis || h.confirmed_instinct || ''` — a
documented legacy fallback. Measured: with `dominant` set to `null`, and with the key deleted
entirely, the model still resolves to `SX` from `confirmed_instinct`, and every display field is
correct. [CC-MEASURED]

**The real edge is both null, and it does not reach p10 at all:**

```
dominant = null AND confirmed_instinct = null
  → buildClientModel THROWS: "content_library missing key: subtype_9"
```

[CC-MEASURED] `subtypeKey('', 9)` yields `subtype_9`, which does not exist. **The model does not
build, so no renderer of any kind — p10 included — ever sees it.** This is existing behaviour for
every v3 page, not something step 5 introduces.

**So there is no state in which p10 receives a model with no instinct.** The case the prompt asks
for a rendering of is unreachable through `buildClientModel`. **Step 5 should assert that rather
than design for it:** a test that both-null throws, so the day someone adds a fallback that makes
it renderable, the missing p10 case is loud. [CC-JUDGMENT]

**One thing that is genuinely wrong and is not step 5's:** the throw says *"content_library missing
key: subtype_9"*, which names the symptom two layers down from the cause. An assessment with no
instinct should say so. **Own card.** How many production rows are in that state is open question 6
and still needs a query. [CC-JUDGMENT]

Carried, unwidened: `instinctStack`'s silent SP default, and the unreconciled dominant/profile
pair. Both own cards, both watch-in-beta.

---

## 7. §8 — the fixture matrix, re-derived against today's job

**Measured today, two runs each:** [CC-MEASURED]

| job | renders | wall-clock |
|---|---|---|
| `client_v3` full | 11 | 16.416 / 16.264 → **16.34 s** |
| `client_v3`, one type | 3 | 4.951 / 4.939 → **4.945 s** |

**Derived:** marginal **1.424 s/render**, fixed **0.672 s**. [CC-DERIVED]

**CI, measured on the step-4 merge run `34151114566`:** render step **35.97 s** (15 renders), whole
job **65.04 s**. [CC-MEASURED] Against the comparable local figure that is a **1.58×** ratio, so
**≈2.25 s/render in CI** — [CC-DERIVED], and it is a derivation on a derivation; treat it as an
order of magnitude, not a budget.

| Matrix | renders | local | CI delta | CI job |
|---|---|---|---|---|
| today | 11 | 16.3 s | — | 65 s |
| 27 only | 27 | 39.1 s | ~+36 s | ~101 s |
| 27 + sp4 | 28 | 40.6 s | ~+38 s | ~103 s |
| **27 + sp4 + wide_gap at one type** | **29** | **42.0 s** | **~+40 s** | **~105 s** |
| 27 + sp4 + wide_gap across nine | 37 | 53.4 s | ~+58 s | ~123 s |

**Does the step-2 position still hold?** At step 2 I declined a nightly/subset split because 11
renders did not need one. **At 29 it still holds, and now for a reason rather than an absence of
one:** the 27-render matrix is the only thing that puts all 27 subtype columns in the highlighted
slot, which is the build plan's own PR 4 pass/fail. A subset that skipped types would not satisfy
it, and a nightly that ran it separately would let a per-PR run go green on a matrix that never
checked the page's stated acceptance criterion. **Keep it per-PR.** [CC-JUDGMENT]

**`wide_gap` at one type, not nine.** Its purpose is to show a separated stack rendering
differently from a near-tie; that is visible on one page. Nine costs 8 more renders for nine copies
of one fact. And **sp4 brings a separated profile for free** — `{SP:73, SO:40, SX:51}`, a 22-point
top gap and 11-point second/third, against the 2-point gap every step-2 profile carries.
[CC-MEASURED] It may make a synthetic `wide_gap` unnecessary altogether; that is a step-5 call once
badges render.

---

## 8. §9 — the CMS half (step 5B)

### `instincts_v3` — the six touchpoints

| # | Site | What it needs |
|---|---|---|
| 1 | `CMS_SUBTYPE_FIELDS` (`server.js:9893`) | add `{ field: 'instincts_v3', label: 'Instincts (v3)' }` |
| 2 | `cmsIsValidSubtypeKey` (`:9900`) | add to the alternation, or **write routes reject the key** |
| 3 | `cmsBudgetFor` (`:9998`) | a path-branched clause — see below |
| 4 | `cmsPreviewSpec` (`:13854`) | **needs the v3 preview harness** — see below |
| 5 | Summary string (`:10546`) | `108` → `135`. **Do not global-replace**: `:10833` also says 108, for the unrelated type editor |
| 6 | Comment (`:9902`) | 108 → 135 |

Field count **27 × 5 = 135**, unchanged from my step-1 figure. [CC-DERIVED]

### `instinct_definitions_v3` — the same shape, one list over

`CMS_STATIC_FIELDS` (`:9866`), `cmsIsValidStaticKey` (`:9867`, which gates on membership of that
list), `CMS_FIELD_META` (`:9880`) for the display name and page label, `cmsBudgetFor`, and
`cmsPreviewSpec`. [CC-MEASURED]

### The preview is the hard part, and it is not a mapping

`cmsRenderPreviewPng` builds **`buildClientReportHTML(model)` — the v2 document**. [CC-MEASURED]
A v3 field has no page in that document, so a `cmsPreviewSpec` entry alone yields either a 400 or,
if pointed at `.p6-page`, a **confidently wrong preview** — the new text shown on the page it is
explicitly not for, which is the step-4 reasoning and it still holds.

**What 5B actually needs:** a branch in `cmsRenderPreviewPng` that builds the v3 document for v3
keys and selects within it, plus a v3 analogue of the `.p6-page` special case at `:13915` that
injects `CMS_PREVIEW_WORST_EVIDENCE` — and that analogue should inject a **capped** Z6 once step 6
lands, or the preview shows an over-spec box as if it were normal. [CC-JUDGMENT]

### `cmsBudgetFor` — **setting it from the probe would be publishing a ceiling. Do not.**

It is **advisory, not enforcing**: the value is emitted as `data-budget` and rendered as
`N / M words` beside the textarea. No write route rejects on it. [CC-MEASURED]

**But advisory to code is authoritative to a person.** An editor reading "52 / 60 words" treats 60
as the limit, and it would be one — enforced by them, not by the build.

**And the probe cannot supply it.** The probe measured **lines and pixels**. Converting a line
count into a word budget is the character-count-does-not-predict-line-count error in another
currency, and words are a *worse* proxy than characters because they vary more in width. §7.4
struck three ceilings for exactly this and left no replacement mechanism.

**Recommendation: leave it 0**, which renders as a plain word count with no denominator — honest,
and what the field shows today. A budget could be set later from a measurement that actually
supports one; the probe is not it. [CC-JUDGMENT]

### The labelling ambiguity

An editor sees "Instinct Definitions · P6" with no sign a p10-only copy exists. With both fields
editable that is two cards whose titles differ only by whatever `CMS_FIELD_META` says. **Give the
v3 card a page label naming p10 and a name that distinguishes it**, and consider a one-line note on
the v2 card that a v3 copy exists. Presentation-only — `CMS_FIELD_META` is explicitly
presentation-only and the raw key drives the routes. [CC-MEASURED / CC-JUDGMENT]

---

## 9. Scope statements

### Step 5A — the renderer

**Files:** `app/renderer.js` (the `instincts` builder, `built: true`, the `v3-inst-` CSS),
`scripts/render_client.js` (matrix + geometry hook), `tests/lib/report_page_inventory.js` (9 → 10),
`tests/report_pages_test.js` (the negative assertion), `tests/fixtures/` (sp4 in the matrix;
`wide_gap` if wanted). **No `app/server.js`.**

**Builds:** Z4 banner (`.htag` = naranjo · signature, per step 4's decision), Z5 three columns from
`instincts_v3`, Z3 from `instinct_definitions_v3` **with no FOCUSED ON row**, Z2 from
`instinct_primer` AS-IS, Z6 titled **"In Your Words"** and uncapped, all three badges p10-locally.

**Done when**
1. `v3PagesFor` returns 10; the hand-maintained inventory literal is 10; both derived assertions
   agree.
2. The 27-render matrix is green, plus sp4 at its own type and dominant.
3. **No page exceeds 1057px** — expected, and expected *for a stated reason*: every fixture's Z6 is
   0–4 lines against a 197.38px allowance.
4. The negative assertion is red-proven **both halves**.
5. The three geometry assertions hold, citing `docs/p10_fit_results.md`.
6. Coach baseline byte-identical; `content:check`, `npm test` green.

**Not done when**
- **Z6 is uncapped.** Green here does not mean the cap is unnecessary — it means no current fixture
  exhibits the producer output the cap exists for.
- **No CMS.** Neither v3 field is editable or previewable.
- **Z2 is undecided**, and p10 now shares `static.instinct_primer` with live v2 p6 — a coupling
  that did not exist before and that ends the moment either page wants different text.
- **The TOC still promises two pages that do not exist** (quickref, car), and nothing asserts it.

### Step 5B — the CMS

**Files:** `app/server.js` only.

**Done when** both v3 fields are editable and rejected-if-invalid; the preview harness builds the
v3 document and both fields preview correctly; the summary string and comment read 135; the v3
cards are labelled so neither is mistaken for the v2 one.

**Not done when** — `cmsBudgetFor` returns 0 for both new fields, deliberately, because no
measurement supports a word budget.

---

## 10. Where I think §1–§9 is wrong

**a. §3's premise.** *"If the page gate runs in CI at step 5 against a fixture carrying the worst
Z6, step 5 cannot go green."* True as a conditional and **the antecedent is false**: no fixture in
the render matrix carries a worst Z6, step 2 kept the synthetic ones model-level on purpose, and
the two real fixtures render 3 and 4 lines. Nothing needs reordering. [CC-MEASURED]

**b. §7's premise.** *"under this decision PRIMARY has no source when it is null."* A null
`dominant_instinct_hypothesis` falls back to `confirmed_instinct`; both null throws in
`buildClientModel` before any renderer runs. **There is no reachable state where p10 must render a
missing instinct.** [CC-MEASURED]

**c. §9 understates the preview work.** It asks what the touchpoints need "now that a page exists
to preview against". The preview harness renders the **v2** document; a page existing in the v3
document does not give it something to preview. [CC-MEASURED]

**d. §5 is right and I would go further.** It asks whether the real page should carry the
scaffold's assertions. It should, and two of the three should be the *corrected* versions — the
width assertion must use `getBoundingClientRect`, not `contentBox`, and the reservation must be
tested by removing the badge. Both were wrong on first write at step 3.

---

## 11. Open questions

### New

1. **Should an assertion require every TOC entry to name an emitted page?** It would fail today on
   three entries. Scoped to built pages it would have caught nothing so far; landed with the last
   page it is trivial. Own card. [§4]
2. **Does `wide_gap` survive sp4 joining the matrix?** sp4 carries `{73, 40, 51}` — already a
   separated stack. A synthetic profile may be redundant once badges render. [§8]
3. **The both-null throw names the wrong thing** — `"content_library missing key: subtype_9"` for
   an assessment with no instinct. Own card. [§7]
4. **`cmsWordBudget` → `cmsBudgetFor`** in four docs and one code comment on main. [§0]

### Carried

5. `instinctStack`'s silent SP default · 6. the unreconciled dominant/profile pair ·
7. `CMS_PREVIEW_WORST_EVIDENCE`'s stale "~25 words" comment · 8. how many production rows lack the
instinct fields · 9. the 18-of-27 passion-term divergence · 10. the 345–415 band's provenance ·
11. Mo has reviewed none of this content · 12. Z2's content and its type-token question.
