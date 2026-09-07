# Audit — PR 4 step 6, Z6 "In Your Words"

**Branch:** `pr-4-step6-z6-audit`, off `main` @ `db7bd7aa2fe1bf665105bb5464d277c3d830376b`
(`db7bd7a` — the 5B merge). Fresh pull: **nothing came down, I was already current.** [CC-MEASURED]

**Nature:** audit. No behaviour change. The only commit is this document.

Tags: **[CC-MEASURED]** read out of the repo or executed · **[CC-DERIVED]** arithmetic on measured
values · **[CC-JUDGMENT]** my read, and where I have inferred rather than traced I say so.

**Counting basis for every char and word figure below**, unless a line says otherwise: characters
on the **rendered string with whitespace collapsed and ends trimmed**; words by `/\s+/` split on
the same. Where a raw-source count differs I give both — the two disagree and it matters.

---

## LEADING WITH WHAT IS WRONG IN THE FRAMING

Four corrections. The third is the one that changes the step.

### A. §1(b) is no longer true — the page gate HAS evaluated a populated Z6

`render_client.js` still imports neither `applyZ6` nor `Z6_STATES` — that half stands.
[CC-MEASURED] But **5A added `sp4` to the `client_v3` fixture list**, and
`sp4_api_result.json` carries a real 3-bullet `instinct_evidence`. So since 5A the gate at
`render_client.js:364` has been evaluating a real Z6 payload on every run: measured on the shipped
page at **4 lines / 140.5px box / page 1056**. [CC-MEASURED]

What remains true is narrower and worth restating precisely: **the synthetic worst cases have never
reached the gate.** Only in-contract real evidence has.

### B. There are FOUR runtime writers, not two

§1(a) groups them as "the evidence-model path" and "the CMS preview path". Traced, there are four,
and 5B added the fourth. §2.1 has the table.

### C. THE EM WORST CASE IS 58.12px WORSE THAN RECORDED, AND `docs/p10_fit_results.md` UNDERSTATES IT

This is the finding that most affects step 6.

`app/renderer.js`'s `esc()` ends with `.replace(/\n/g, '<br>')`. [CC-MEASURED] The EM producer emits
a **multi-paragraph** string — sp4's is 3 paragraphs — so its two `\n\n` breaks become **four
`<br>` tags**, which add two blank line-slots that no character or word count can see.

| | rendered height | text lines | page | |
|---|---|---|---|---|
| step-3 scaffold recorded | 186.63px | 7 | — | the scaffold collapsed `\n\n` to a space before rendering |
| **shipped p10 renders** | **244.75px** | **8** | **1131.38** | **spills by 74.38px** |

[CC-MEASURED] The element is **193.75px of text = exactly 10 × 19.375px line-slots**, of which
**8 carry text and 2 are blank**. The arithmetic closes exactly. [CC-DERIVED]

`docs/p10_fit_results.md:113` records `em_paragraph | 186.63px | 7`. **That figure is
scaffold-specific and understates the shipped page by 58.12px — three line-heights.** It is not
wrong about what it measured; it is wrong as a description of the page that now exists. Correcting
it is out of scope here (§6) and is listed as carry-forward.

**And it breaks a measurement technique, not just a number.** My Range-based line counter — the one
in `line_metrics.js` and in the step-3 probe — counts **text** line boxes. It reports **8** where
the zone occupies **10 slots**. Any cap enforced on "rendered lines" counted that way would permit
a value two slots taller than it believes. §3 mechanism A depends on this and must measure
**height**, not counted lines.

### D. §3's three mechanisms each have a hole, and it is the same hole

Traced in §2.4: the two producers differ at the **record level**, not in formatting. SM emits three
distinct evidence items; EM emits **one** narrative that `_toEvidenceArray` wraps as a one-element
array. Consequently:

- **B (select fewer items upstream) is SM-only.** Dropping an item from a one-element array empties
  the zone.
- **C (word contract at the producer) cannot see the `<br>` slots** (correction C), so an
  in-contract value can still be two slots taller than the count suggests.
- **A (measure and trim at render) is the only one that covers both** — and only if it measures
  height rather than counted lines.

That points at a **fourth mechanism the framing does not list: normalize the shapes at the adapter**,
which converts a record-level divergence into a formatting one at a single choke point and makes B
or C viable afterwards. Priced as **D** in §3.

---

## 1. Job 1 — the producers

### 2.1 Every writer, traced

Two write `client_facing.instinct_evidence` (the model input); two write
`model.pages.instinct_subtype.instinct_evidence` after the model is built. [CC-MEASURED]

| # | Producer | Where | Shape emitted |
|---|---|---|---|
| 1 | **SM Call #2** | prompt `server.js:4827` (FIELD 7), schema `:4961` | `[string, string, string]` or `null` — three distinct evidence items |
| 2 | **EM adapter** | `em_report_adapter.js:143`, `_toEvidenceArray(cf.instinct_personal_overlay)` | **`[string]`** — ONE narrative wrapped as a one-element array, or `null` |
| 3 | **CMS v2 preview** | `server.js:13998`, gated `spec.selector === '.p6-page'` | `CMS_PREVIEW_WORST_EVIDENCE.slice()` — 3 items |
| 4 | **CMS v3 preview** | `server.js:13999`, gated `spec.doc === 'v3'` (5B) | `CMS_PREVIEW_V3_EVIDENCE.slice()` — 3 items |

Reader, for completeness: `report_prep.js:408` is `cf.instinct_evidence ?? null` — a passthrough,
not a producer. `tests/fixtures/instinct_axis.js` `applyZ6` writes into cloned fixtures for
model-level tests only.

### 2.2 Contracts, and whether anything enforces them

| Producer | Contract | Written where | Enforced at runtime? |
|---|---|---|---|
| SM | "exactly 3 short bullets, ≤25 words each"; null on `low_instinct_confidence` | `server.js:4828` + schema `:4961` | **No.** It is prompt text to the model. |
| EM | "2–3 sentences" on `instinct_personal_overlay` | `experimental_analysis.js:613` (and `server.js:4956` says 2–4 for the SM copy of that field) | **No.** Prompt text. |
| both | `instinct_evidence`: exactly 3 strings ≤25 words, or null | `scripts/verify_phase1_fields.js:20,71–83` | **Checked by a script that is NOT in CI** — see 2.5 |
| both | `instinct_evidence` is a 3-element array | `scripts/verify_phase4_prep.js:55` | **Yes, in CI** via `verify:render` — but against a **fixture**, not production output |

**Nothing enforces a size bound on live output.** [CC-MEASURED]

### 2.3 Worst cases present in the repo, measured on the SHIPPED p10 renderer

Basis as stated at the top. Box = `.v3-inst-resp` height; page = the p10 `.v3-page` height.
[CC-MEASURED]

| Value | text lines | box px | page px | chars | words each | |
|---|---|---|---|---|---|---|
| `CMS_PREVIEW_V3_EVIDENCE` (5B) | 5 | 159.88 | 1056 | 357 | 20/18/14 | fits |
| sx7 real `instinct_evidence` | 3 | 121.13 | 1056 | 332 | 23/15/20 | fits |
| sp4 real `instinct_evidence` | 4 | 140.5 | 1056 | 360 | 22/19/16 | fits |
| `CMS_PREVIEW_WORST_EVIDENCE` (v2) | 6 | 179.25 | 1065.88 | 568 | 27/29/28 | **SPILLS by 8.88px** |
| **EM shape (sp4 overlay, 1 elem)** | **8 (10 slots)** | **244.75** | **1131.38** | **775** | 122 | **SPILLS by 74.38px** |

Z6 text width **measured on the shipped page: 670px** — §1(d) confirmed. [CC-MEASURED]

Two notes on basis. The sp4 overlay is **777 chars raw / 775 collapsed**; the step-3 doc uses 777
and this table uses 775, and the difference is the basis, not the string. And sp4's Z6 measures
**140.5px** here against **134.5px** on the step-3 scaffold — the shipped page uses
`.v3-inst-resp-txt + .v3-inst-resp-txt { margin-top: 6px }` where the scaffold's 3px margins
collapsed to 3px per gap. [CC-MEASURED]

### 2.4 The divergence is RECORD-LEVEL, not formatting — traced

`_toEvidenceArray` (`em_report_adapter.js:57–65`): an array passes through filtered; **a string
becomes `[string]`**. The EM producer's field is `instinct_personal_overlay`, "2–3 sentences", a
single narrative. [CC-MEASURED]

So SM's three items and EM's one item are **not the same records rendered differently**. EM never
had three. Reconciliation is therefore **not a normalizer over a shared record set** — it is either
a redesign of one producer's output, or a rule that accepts both shapes. This is the fact behind
correction D.

### 2.5 Is the ≤25-word contract enforced? — **No, and nothing bounds production output**

`scripts/verify_phase1_fields.js` is the only place that checks it, and it appears in **neither the
CI workflow nor any npm script**. The workflow's eight `run:` steps are `npm ci`, `npm test`,
`npm run verify:render`, `verify_diagrams`, `verify_transparency`, `verify_coach_baseline`,
`verify_content_library`, plus the font install. [CC-MEASURED]

**What bounds live output today: nothing.** Not a schema validator, not a length check, not a
truncation. The only bound is the model's compliance with prompt text — and the repo's two real
overlay samples both exceed their own instruction (sp4 is 5 sentences under "2–4 sentences",
sx7 is 4). [CC-MEASURED] `CMS_PREVIEW_WORST_EVIDENCE` exceeding its own contract at 27/29/28 words
is the same fact seen in a fixture.

### 2.6 Is 777 representative? — **Unestablished, and there is no observed maximum**

The repo holds **two** real `instinct_evidence` samples (sp4, sx7), **both SM-produced and both
in contract** (max 23 words). It holds **two** real `instinct_personal_overlay` samples (775 and
606 chars). It holds **zero EM-pipeline fixtures** — I checked for `experimental_raw_analysis` in
`tests/fixtures/` and found none. [CC-MEASURED]

So **no EM-produced `instinct_evidence` exists anywhere in the repo.** The 777-char worst case is
constructed: my own `EM_PARAGRAPH` in `instinct_axis.js` wraps sp4's *overlay* — a field the EM
adapter would map, on a fixture the EM pipeline did not produce.

`assessments.api_result` (JSONB, `db.js:81`) would contain real values in production, and
`pre_rerun_api_result` (`:398`) retains pre-force-write copies. **I did not query production and
cannot from here.** Nothing in the repo logs or aggregates evidence sizes. [CC-MEASURED that no
such logging exists; CC-JUDGMENT that a query would settle it]

**So "what is the real upper bound" has no measured answer today.** That is the honest state, and
it bears directly on §3: a cap chosen against a constructed worst case is a cap chosen against a
guess about the producer.

### 2.7 `applyZ6` / `Z6_STATES` — belief (b) corrected

Four states in `tests/fixtures/instinct_axis.js`: `sm_bullets`, `em_paragraph`, `null`, `absent`.
Nothing selects among them at runtime — they are test inputs, applied by `applyZ6` to a cloned
`api_result`. `render_client.js` imports `applyInstinct` and `INSTINCT_MARKUP` from that module and
**not** `applyZ6` or `Z6_STATES`. [CC-MEASURED]

But see correction A: sp4's own real evidence *is* in the gated matrix as of 5A.

### 2.8 Does p6 already have a cap? — **No. There is no proven mechanism to mirror**

`renderer.js:2251` is `(i.instinct_evidence || []).map(...)` — every item rendered, no slice, no
truncation. The `.p6-own-words` / `.p6-ow-*` rules contain **zero** `max-height`, `overflow`,
`line-clamp` or `ellipsis` declarations; the band is auto-height exactly like p10's. [CC-MEASURED]

The preference for mirroring a proven mechanism cannot be satisfied, because none exists. p6 has
the same unbounded exposure p10 has — it has simply never been measured. **Out of scope to fix
(§6), but worth knowing that step 6 is not adding a risk p6 lacks; it is addressing one p6 shares.**

---

## 2. Job 2 — pricing the mechanisms

Common ground: the decision is **5 rendered lines**, recorded in `docs/p10_fit_results.md` §8, and
the reason is margin — at 5 lines the page absorbs a one-line regression anywhere on p10 and still
fits. Nothing enforces it today. [CC-MEASURED]

### A. Measure and trim at render time

**Work:** in the p10 builder, render-measure the Z6 block and remove content until it is within the
cap. **Files:** `app/renderer.js`.

**The blocker, and it is structural:** `buildClientReportHTML_v3(model)` returns a **string**. There
is no browser in the render path — measurement happens later, in `render_client.js` / Puppeteer /
the PDF step. A builder cannot measure its own output. Implementing A means either moving Z6
assembly into a post-render pass that owns a browser, or introducing measurement into a synchronous
string builder that has never had it. [CC-MEASURED that the builder is a pure string function;
CC-JUDGMENT that this is the blocker]

**What could go wrong silently:** it measures counted lines rather than height and permits the two
blank `<br>` slots (correction C). **On hitting the cap:** whatever the trim rule says — mid-item
truncation would produce a dangling fragment, which 5B's preview work already rejected on
readability grounds.

**My read: A is the only mechanism that covers both producers, and the most expensive place to put
it.** [CC-JUDGMENT]

### B. Select fewer evidence items upstream

**Work:** cap the array length before it reaches the model. **Files:** `app/report_prep.js` or the
producers.

**It does not cover EM.** EM emits one element (2.4); dropping items empties the zone. So B is
SM-only and leaves the *worse* of the two worst cases — 244.75px against 179.25px — entirely
unaddressed. [CC-MEASURED]

**What could go wrong silently:** it looks like a general fix and is not. A future EM-produced
client would spill with the mechanism "in place". **On hitting the cap:** drops a whole item, which
loses evidence rather than truncating it.

### C. Cap at the producer on a word contract

**Work:** enforce ≤N words per item and exactly 3 items, at ingest or in a validator. **Files:**
`scripts/verify_phase1_fields.js` (and it would need adding to CI), or a runtime validator in
`report_prep.js`.

**Two holes.** It cannot see the `<br>` slots (correction C), so an in-contract multi-paragraph
value still adds two line-heights. And enforcing "3 items ≤25 words" on the EM path would reject
its single narrative outright, which is a producer redesign wearing a validator's clothes.

**What could go wrong silently:** a value passes the word check and still spills. **On hitting the
cap:** rejects or truncates at the producer, before the page ever sees it.

**Against §1(c):** I am not proposing a character cap and I would argue against one. The evidence is
in this PR twice — SO7 389 chars at 12 lines vs SO5 394 at 11, and now the `<br>` finding, where two
line-slots appear with **zero** additional characters. A word cap is a better proxy than a character
cap and still not a bound.

### D — **the one the framing does not list: normalize the shapes at the adapter**

**Work:** in `_toEvidenceArray`, split the EM overlay on `\n\n` into separate array elements instead
of wrapping it whole. **Files:** `app/em_report_adapter.js`, one function.

**What it buys:** the record-level divergence (2.4) becomes a formatting one at a **single choke
point**. EM's 3-paragraph overlay becomes 3 items, structurally identical to SM's 3 bullets — and
the four `<br>` tags disappear with the paragraph breaks, removing the two blank slots at source.
After D, **B and C both become viable and cover both producers**, because there is only one shape
left.

**What could go wrong silently:** an overlay with a different paragraph count yields 2 or 5 items
rather than 3, so an item-count rule must handle a range, not exactly 3. And it changes what the EM
path *renders* — three blocks instead of one flowing paragraph — which is a presentation change and
therefore **Cai's, not mine**. [CC-JUDGMENT]

**My read: D then C is the shape I would propose**, because it is the only ordering where a single
rule covers both producers and no mechanism has to measure geometry. But D contains a presentation
decision, which is why the split below exists.

---

## 3. The gate, and how it is red-proven

**Whatever mechanism lands, the gate is the existing page gate** — `enforceSheet && p.height >
PAGE_PX + 1` at `render_client.js:364`, which already fails the run on spill. The work is not
building a gate; it is **putting the worst cases in front of the one that exists**.

**Bringing Z6 states into the matrix. Yes — and the arithmetic:** [CC-DERIVED, from 5A's measured
1.424 s/render local and ~2.25 s CI]

| state | render needed? |
|---|---|
| `absent` | already covered — `anders_sx9` ships `client_facing: {}` |
| `null` | **no** — proven at step 2 to converge with `absent` at `report_prep`'s `??` |
| `sm_bullets` | +1 |
| `em_paragraph` | +1 |

**28 → 30 renders. +2.8s local, ~+4.5s CI.**

### How I would red-prove it — three proofs, because this PR has produced three false-green gates

1. **The gate catches the worst case.** Put `em_paragraph` in the matrix *before* the cap lands and
   confirm the run fails with the spill message naming p10. Measured prediction: page 1131.38 against
   1057. **If that does not go red, the matrix addition is not load-bearing** — which is the
   step-5A "vacuous pass" lesson applied here.
2. **The cap is what makes it green.** Land the cap, confirm the same matrix passes, then set the
   cap one line looser and confirm it goes red again. A cap that cannot be made to fail by loosening
   it is not being consulted.
3. **The gate reports its own message.** The step-4 lesson: assert the failure output contains the
   spill line, not merely that the exit code is non-zero. A TypeError also exits non-zero.

Green control first in every case.

---

## 4. Carry-forward from 5B — §5.1 and §5.2

**5.1 — measured, and it agrees.** `CMS_PREVIEW_V3_EVIDENCE` renders **5 text lines / 159.88px box
/ page 1056** at Z6's 670px on the shipped page. [CC-MEASURED] That is exactly the 5-line decision,
so the preview is correct **today**. Nothing asserts it, which is the risk I flagged at 5B.

**5.2 — the assertion, and where.** Two candidates:

- **In the render matrix**, as a Z6 state: add `CMS_PREVIEW_V3_EVIDENCE` as a fifth state and let
  the page gate evaluate it. Costs +1 render (30 → 31). Catches a stale preview constant the same
  way it catches everything else, and needs no new mechanism.
- **In `tests/instinct_axis_test.js`**, as a model/geometry assertion tying the constant to the cap
  figure.

**I would take the first**, for one reason: it puts the preview constant under *the same gate* as
the page, so the two cannot disagree without something going red. A separate assertion can drift
from the cap it references; a render cannot drift from the page it renders. [CC-JUDGMENT]

**The deeper fix is that the cap should be one exported constant** rather than a number repeated in
`server.js` and wherever the cap lands. That is a build decision, named here so it is not
rediscovered.

---

## 5. Should step 6 split? — **Yes, and the boundary is the presentation decision**

**6A — reconcile the producer shapes.** Mechanism D. Lands in `em_report_adapter.js`. Contains a
question only Cai can answer: *does the EM path render as three blocks or one paragraph?* Until that
is settled, any cap has to handle two shapes.

**6B — enforce the cap and gate it.** Mechanism C (or B, once D has run), the matrix addition, the
three red proofs, and the 5.2 assertion.

**The dependency is real, not tidiness:** if 6A lands, 6B is one rule over one shape; if it does
not, 6B is two rules and mechanism A becomes the only complete option. That changes what 6B
*is*. [CC-JUDGMENT]

If the split is rejected, the fallback is A — measure and trim at render — with the builder-is-a-
string blocker priced in.

---

## 6. Out of scope — named once

- **`docs/p10_fit_results.md:113` records the EM shape at 186.63px / 7 lines.** Shipped p10 renders
  it at 244.75px, spilling. The doc is not wrong about the scaffold it measured; it is stale as a
  description of the page. **Needs correcting; not here.**
- **`scripts/verify_phase1_fields.js` is not in CI**, so the ≤25-word contract it checks is checked
  by nobody automatically.
- **p6's "In Your Words" is unbounded too** (2.8) — same exposure, never measured. Live v2, out of
  scope by §6.
- **`esc()`'s `\n` → `<br>`** is global to the renderer and affects every multi-paragraph v3 field,
  not only Z6. I have not audited the others.
- Locked content — the 27 narratives, the three Z3 descriptions, `static.instinct_primer` — untouched
  and unexamined here.

---

## 7. Open questions

1. **What is the real upper bound on production `instinct_evidence`?** No observed maximum exists in
   the repo (2.6). A query against `assessments.api_result` would settle it, and would tell us
   whether the constructed 777-char worst case is pessimistic, representative, or optimistic.
2. **Does the EM path render as three blocks or one paragraph?** The presentation decision inside
   6A.
3. **Has any EM-pipeline assessment ever produced a p10?** There is no EM fixture, so the EM shape
   has never been rendered from real pipeline output — only from a hand-built wrapper.
4. Carried: the TOC still promises two unbuilt pages; inter-zone spacing on p10 is unasserted beyond
   the four geometry properties.

---
---

# Amendment 1 — response to the step 6 counterproposal

**Branch:** `pr-4-step6-z6-audit`. **Fresh fetch: nothing came down**, `main` and `origin/main`
both still `db7bd7a`. [CC-MEASURED]

**Nature:** audit. No behaviour change. Every measurement below was taken in the scratchpad
against the **shipped renderer** (`buildClientReportHTML_v3` via `buildClientModel`), touching no
tracked file.

Tags and counting basis as declared at the top of this document. Where a figure is new here and
contradicts one above, the new one is the shipped page.

---

## A. LEADING WITH WHAT §2 AND §3 FORCE THAT YOU HAVE NOT SEEN

Three things. The first two change where the work goes; the third changes what 6B must do.

### A1. §3.3 is wrong on both halves, and the second half is a live regression

**`_toEvidenceArray` is not a convergence point.** It has **exactly one call site** in the repo —
`em_report_adapter.js:143`. It serves one writer. The four writers converge nowhere before the
renderer: SM lands via `report_prep.js:408`, the two CMS previews are injected into the built model
at `server.js:13998`/`:13999`, after `report_prep` has run. [CC-MEASURED]

**And it is not free of v2 exposure — the `\n\n` is load-bearing somewhere else.** Its output
reaches `server.js:2297`, which builds the coach portal's "Your Subtype" section, and
`server.js:2326` renders that as:

```js
s.personal.split('\n\n').filter(Boolean).map(par => `<p class="cp-sec-body">${cpEsc(par)}</p>`)
```

Collapsing `\n\n` at `_toEvidenceArray` would flatten the coach's subtype section from three
paragraphs to one wall of text — in `renderMyReport`, a surface step 6 is not supposed to touch.
[CC-MEASURED]

**And no gate would catch it.** `adaptEmToContract` has two callers, `server.js:5505` and
`server.js:12060` — **both production routes. Nothing in the test suite or CI calls the adapter at
all.** The coach byte-diff gate runs fixtures straight into `buildClientModel`; the adapter is not
in its path. So the sharpest test in this PR is structurally blind to a change made in that file.
[CC-MEASURED]

**Where the join belongs instead: the p10 renderer's Z6 block**, `app/renderer.js:3866–3896`. That
is where all four writers actually converge *for p10*, it is p10-local, and it touches no other
page and no other product surface. It also makes p10 correct for the preview shape for free (A2,
and §B2.3 below).

### A2. The join does not make the EM case fit

| sp4 overlay | rendered lines | `.v3-inst-resp` box | p10 page | |
|---|---|---|---|---|
| as shipped (`\n\n` intact) | 8 text / **10 slots** | 244.75px | 1131.38 | spills 75.38 |
| **JOINED** | **7** | **186.63px** | **1073.25** | **still spills 17.25** |

[CC-MEASURED] The join removes 58.12px. The value needs to lose about 96px. **A cap that actually
removes content is still required** — the join is a precondition for measuring honestly, not a fix.

### A3. The editorial pass has no mechanism, and the v2 one cannot be pointed at this field

You said the EM output gets edited for tone, length and language, and that the mechanism is "the
step before renderer.js". **The layer you mean is real and is in the right place** —
`report_prep.js:126/207` loads `content_overrides` and resolves through `resolveLibObject` at lines
141, 142, 219, 220 and (from 5B) 393.

**It cannot reach `instinct_evidence`.** Two independent reasons, both traced:

1. `resolveLibObject(overrides, topKey, baseObj)` keys on `${topKey}.${field}` — library object
   keys (`type_4`, `subtype_sp4`, `static`). `content_overrides.content_key` is a **global
   `TEXT PRIMARY KEY`** with no assessment dimension, so the table cannot hold a per-client value
   by construction. [CC-MEASURED]
2. `instinct_evidence` is not library content. It enters at `report_prep.js:408` as
   `cf.instinct_evidence ?? null`, straight off the `apiResult`, and **no override is consulted on
   that line or anywhere near it.** [CC-MEASURED]

I searched for a per-client editor as well: every `POST /admin/*` route, every `/admin/em-lab`
surface, the `edit_history` table (it logs profile-field edits, `db.js:191–204`), and repo-wide for
`instinct_personal_overlay` / `core_motivation_evidence`, which appear only in the renderer, the
server, the adapter, `experimental_analysis.js`, tests and fixtures. **I found no surface that
edits per-client AI output.** The EM Lab regenerates by re-running the report call; it does not let
anyone edit its result. [CC-MEASURED that I found none; **not** a certainty that none exists —
if you can name it I will trace it.]

**Why this matters to the plan, and it is the biggest single thing here:** if Z6 is edited before
it ships, the page is exposed to *what the editor leaves*, not to what the model emits. That makes
the cap's job "tell an editor they are over" rather than "silently cut an AI sentence in half" —
which is mechanism **E** in §J, and I now think it is the right one.

---

## B. Your §2 consequences — confirmed and corrected

**2.1 — confirmed, with a correction that goes further than you did.** Mechanism B is not merely
unconstrained by the SM path; under §2 **plus** the §3 join it is **deleted**. The join produces one
element. "Select fewer items" has nothing to select. EM-only and the join together remove B from
the list rather than rescuing it. [CC-JUDGMENT on the reading; the one-element result is
CC-MEASURED.]

**2.2 — confirmed, with one thing carried forward.** It stops being a reconciliation between two
shipping producers. But p10 must still *render* the multi-item shape correctly, because §2.3 is
true — so the fix should make p10 **shape-agnostic** rather than assume one shape. A p10-local join
does exactly that; a join at `_toEvidenceArray` would not (the previews bypass it).

**2.3 — confirmed and measured.** `CMS_PREVIEW_V3_EVIDENCE` renders as **3 separate
`.v3-inst-resp-txt` elements, 5 lines, box 159.88px**. Under a p10-local join it becomes **1
element, 4 lines, box 128.50px** — which is what production would show. A preview whose job is to
show an editor the real page should therefore get the join too, and does, for free, if the join is
p10-local. [CC-MEASURED]

---

## C. §3.1 — PROVEN, and here is exactly how far it goes

Six no-`<br>` payloads and one with `<br>`, all through the shipped renderer at Z6's 670px.
`slots` = element height ÷ computed line-height (19.375px). [CC-MEASURED]

| payload | elements | `<br>` | counted lines | slots | verdict |
|---|---|---|---|---|---|
| EM as shipped | 1 | **4** | 8 | **10** | **DIVERGE by 2.000** |
| EM joined | 1 | 0 | 7 | 7 | CONVERGE |
| CMS preview, 3 items | 3 | 0 | 5 | 5 | CONVERGE |
| CMS preview, joined | 1 | 0 | 4 | 4 | CONVERGE |
| sp4 real SM, 3 items | 3 | 0 | 4 | 4 | CONVERGE |
| sp4 real SM, joined | 1 | 0 | 4 | 4 | CONVERGE |

**Your belief holds.** The divergence is caused by `<br>` and by nothing else in this zone; remove
the `<br>` and counted lines equal occupied slots exactly, in every case measured, to three
decimals.

**What it does to "any geometry mechanism must measure height" — the position narrows, it does not
survive intact and it does not disappear.** Precisely:

- **The convergence is per element.** Box height is *not* counted-lines × line-height whenever
  there are several elements, because of `.v3-inst-resp-txt + .v3-inst-resp-txt{margin-top:6px}`.
  Measured: the 3-item preview is 5 lines but its box is 159.88px, which is 5 × 19.375 **+ 2 × 6**
  + 51px of chrome.
- **Under the join there is one element, so counted lines become a faithful unit for the cap.**
  That is a real gain: the cap can be stated and enforced in lines.
- **The gate must still be geometric, because Z6 is not the only thing on the page.** A line cap on
  Z6 cannot see a regression in Z3 or Z5. The page gate stays the gate.

So the join changes the basis of the **cap** (lines become trustworthy) without changing the basis
of the **gate** (the page stays measured). That split is the honest version of the position, and it
is better than what I wrote above, which conflated the two.

---

## D. The arithmetic, in closed form — because it makes the cap checkable

Every measured row above and below is reproduced exactly by two expressions. [CC-DERIVED from 13
measured rows; closes on all 13 to ±0.01px]

```
Z6 box height   = 51 + 19.375 × lines + 6 × (elements − 1)
p10 natural     = 886.63 + Z6 box height          (Z6 absent → 864.63, no box, no 22px gap)
```

Check against the awkward cases: EM as shipped = 51 + 19.375×10 = 244.75 ✓ (slots, not counted
lines — which is precisely why `<br>` was invisible). 3-item preview = 51 + 96.875 + 12 = 159.88 ✓.
sp4 SM 3-item = 51 + 77.5 + 12 = 140.50 ✓.

### The headroom table — the artifact I think 6B should be designed against

p10 natural height by Z6 line count, joined shape, measured by removing the `min-height` floor
(the rendered page reports 1056 until it spills, which hides all headroom). Gate is
`height > 1057`. [CC-MEASURED]

| Z6 lines | box | p10 natural | headroom vs 1057 | |
|---|---|---|---|---|
| absent | 0 | 864.63 | 192.37 | |
| 1 | 70.38 | 957.00 | 100.00 | |
| 2 | 89.75 | 976.38 | 80.62 | |
| 3 | 109.13 | 995.75 | 61.25 | |
| 4 | 128.50 | 1015.13 | 41.87 | |
| **5** | **147.88** | **1034.50** | **22.50** | **the decision** |
| 6 | 167.25 | 1053.88 | 3.12 | last that fits |
| 7 | 186.63 | 1073.25 | −16.25 | **SPILLS** |
| 8 | 206.00 | 1092.63 | −35.63 | **SPILLS** |

**This vindicates the 5-line decision numerically, and it is the first time that has been done.**
Six lines fits with 3.12px. Five leaves 22.50px — one full line box (19.375) plus 3.125px. So
**5 is exactly the largest cap that survives a one-line regression anywhere else on p10.** The
margin argument was right; now it has a number.

---

## E. §3.4 — confirmed, measured, and one rule to leave alone

A one-element array with no newlines emits **exactly one `.v3-inst-resp-txt`** — measured
`elements=1` on every joined case. `evList.map(...)` at `renderer.js:3896` needs no change.
[CC-MEASURED]

Leave `.v3-inst-resp-txt + .v3-inst-resp-txt{margin-top:6px}` in place. It becomes dead for the
shipping path, but it is what makes the multi-item shape render correctly if anything ever emits
one, and deleting it would make a future multi-item payload render as a single block with no
separation. Dead CSS that is a correct fallback is not the same as dead CSS.

---

## F. §5 — the preview constant re-measured under the join

| `CMS_PREVIEW_V3_EVIDENCE` | elements | lines | box | page |
|---|---|---|---|---|
| as shipped (3 items) | 3 | 5 | 159.88 | 1056, fits |
| **under the join** | **1** | **4** | **128.50** | 1056, fits |

[CC-MEASURED] **It drops to 4 lines and stops being a 5-line canary.** Joining recovers exactly one
line plus the two 6px margins (159.88 − 128.50 = 31.38 = 19.375 + 12.00), because each item's
partial last line is reclaimed.

**So it needs re-cutting** if it is to sit at the cap — roughly one line's worth of additional text,
to be measured and not estimated when it is cut. Recommendation unchanged: assert it by putting it
in the render matrix, not in a separate test.

---

## G. §7 — confirmed exactly, and one adjacent row that IS stale

**You are right, and to the hundredth of a pixel.** The joined sp4 overlay measures **186.63px,
7 rendered lines** — `docs/p10_fit_results.md:113` says `186.63px | 7`. The step-3 scaffold's
collapse and the proposed join are the same operation, so the doc describes the **target** state
correctly. **Annotation, not renumber.** [CC-MEASURED]

**But the row above it is stale and needs a number changed.** The same table records `sm_bullets`
at `173.25px | 6`; the shipped page renders that payload at **179.25px**, 6px higher, because the
scaffold's 3px item margins collapsed to 3px per gap where the shipped rule is a non-collapsing
`margin-top:6px` on the adjacent sibling. [CC-MEASURED] Two gaps × 3px = the whole difference.

So the correction to that section is: annotate `em_paragraph` as target-state-correct, **fix
`sm_bullets` to 179.25px**, and add the headroom table from §D — which is the thing the doc is
missing and the thing every later fit decision on this page wants.

---

## H. §4 — the fixture, and why I think it should not lead

### 4.1 How to get a real EM output — three options, priced

**(a) Capture from production.** `assessments.api_result` holds the adapted result and
`experimental_raw_analysis` holds the EM Analysis output (`db.js:2991–2998`); `analysis_mode`
distinguishes rows. Requires production DB access and a PII decision — this is a real client's
prose. **Establishes:** one genuine post-adapter shape, and if `pre_rerun_api_result` is populated
for the row, a before/after pair. **Does not establish:** a ceiling, or anything about what an
editor would have left.

**(b) Re-run the EM Report Call locally** against a stored `experimental_raw_analysis` — the path
`POST /admin/em-lab/report/:assessment_id` takes (`server.js:12007–12060`). Requires an API key,
the stored analysis, and `responses_snapshot`. **Establishes:** a fresh sample from the live prompt.
**Does not establish:** stability — it is one sample from a stochastic producer, and the same input
run twice will not match.

**(c) Reconstruct from the adapter contract.** This is what `EM_PARAGRAPH` already is, and it
establishes nothing new. Naming it only so it is not proposed again.

### 4.2 What one sample proves

**Proves:** the shape survives the adapter, prep, `validateModel` and the page gate; the paragraph
count a real overlay carries; that the pipeline emits what the contract says. **Does not prove:** a
worst case, a distribution, or a ceiling. One sample is a sample. Given §7.4's history on this
project, laundering it into a bound would be the same error in a new place.

### 4.3 You asked whether leading with it is wrong. I think it is — for one specific reason

**The cap's VALUE does not come from the producer. It comes from the page.** §D settles it: the
page tips between 6 and 7 lines, and 5 is the largest cap with a line of margin. That is true
whatever EM emits.

What the fixture tells us is **how often the cap will bite**, and therefore what hitting it must
do. And on that, the two real overlays already say something loud: joined, **sx7 lands at exactly
5 lines (147.88px) and sp4 lands at 7 (186.63px, spills).** [CC-MEASURED] **One of the only two
real samples in the repo is over the fitting limit, not merely over the cap.** So cap-hit
behaviour is a routine path, not an edge case — which is the design fact that matters, and we
already have it.

Leading 6A with the capture also **blocks the step on an artifact outside the repo** plus the
unresolved editor question in §A3. My proposal: keep the capture in 6A as work, but make it a
prerequisite for **tuning** the cap and for the cap-hit UX, **not** for the cap mechanism or its
value. If the capture cannot be obtained, 6B still lands, and the doc says the hit rate is
unmeasured.

---

## J. THE REVISED PLAN

### Mechanism: E, with A as the fallback

**E — the cap refuses rather than trims, and says so where someone can act.**

Given §2 (one shipping producer), §3 (one element), and §A3 (the content is edited by a person
before it ships), the right behaviour on a cap hit is **not** to cut a client-facing AI sentence in
half. It is to fail loudly and name the overage. The page gate already fails the render; the work
is to make that failure legible at the point of editing rather than only in CI.

Why E over the others, now:
- **B is gone** (§B2.1) — one element, nothing to select.
- **C is weaker than it was.** A producer word contract cannot bind what ships if a person edits
  the text afterwards, and it still cannot predict lines (§3.2, and §7.4's three struck ceilings).
- **A still has its blocker** — `buildClientReportHTML_v3` returns a string with no browser in the
  path — and it buys a truncation nobody wants to read.
- **E costs the least and loses no prose.**

**E is contingent on §A3.** If there is no editing surface, "refuse" has no one to tell, and the
fallback is **A** — measure and trim at render, with the string-builder blocker priced in and a
trim rule that cuts at a sentence boundary, never mid-sentence.

### 6A — one shape, one basis, one honest record

| Work | Files |
|---|---|
| Join the Z6 payload p10-locally: collapse the array and its internal whitespace to one string before `evList` | `app/renderer.js` (Z6 block, ~3866–3896) |
| Add `sm_bullets` and `em_paragraph` to the render matrix, **REPORT-ONLY** | `scripts/render_client.js`, `tests/fixtures/instinct_axis.js` |
| Correct and extend the fit record: annotate `em_paragraph` as target-correct, fix `sm_bullets` 173.25 → 179.25, add the §D headroom table | `docs/p10_fit_results.md` |
| Obtain an EM fixture if available (§H) | `tests/fixtures/` |

**Report-only first is the project's own precedent, and it is load-bearing here.** Under the join
`em_paragraph` still spills at 7 lines (§A2). If 6A enforced it, CI would be red on every branch
between 6A and 6B — exactly the failure `V3_PAIRS` documents from PR 3d, where a gate that went red
on arrival would have blocked every unrelated PR. Report-only in 6A, enforce in 6B, same as PR 3d →
PR 3f.

**Explicitly NOT in 6A:** any change to `em_report_adapter.js`. §A1 is why.

### 6B — the cap and its gate

| Work | Files |
|---|---|
| The cap at 5 rendered lines, as one exported constant, not a repeated literal | wherever E lands + `app/server.js` |
| Flip the matrix states to enforcing | `scripts/render_client.js` |
| Re-cut `CMS_PREVIEW_V3_EVIDENCE` to sit at the cap under the join, measured (§F) | `app/server.js` |
| The §5.2 assertion: the preview constant enters the matrix as a Z6 state | `scripts/render_client.js` |

### Red proofs — one per gate, each shown failing for the right reason

| # | Gate | How it is proven red |
|---|---|---|
| 1 | the page gate sees the worst case | Land the matrix states in 6A **before** the join. Run. It must fail naming p10, predicted page **1131.38** vs 1057. If it does not go red, the matrix addition is not load-bearing — the step-5A vacuous-pass lesson. |
| 2 | the join is doing work | With the join in, the same state must move to **1073.25 and still fail**. A join that made it pass would mean the join was doing the cap's job and the cap is untested. **This proof is why 6A is report-only:** the expected 6A state is a reported spill, not a green run. |
| 3 | the cap is consulted | In 6B, set the cap to 6 and confirm a 6-line payload passes and a 7-line fails; set it to 5 and confirm the 6-line payload now fails. A cap that cannot be made to fail by loosening it is not being read. |
| 4 | the preview constant is pinned | Change one word of `CMS_PREVIEW_V3_EVIDENCE` so it crosses to 6 lines and confirm the matrix goes red. |
| 5 | the failure names itself | Assert the failure **output** contains the spill line and the page identity, not merely a non-zero exit. Step 4's `TypeError` also exited non-zero. |

Green control before each.

### Matrix cost

28 → 30 renders, ~+4.5s CI (§4 above, unchanged). 6B's preview state makes it **31** if §5.2 lands
as a matrix state, ~+2.25s more. [CC-DERIVED from 5A's measured rates]

---

## K. Out of scope, added by this amendment

- **The coach portal's `\n\n` paragraph split** (`server.js:2326`) is correct and stays. Named only
  because it is what makes `_toEvidenceArray` the wrong place for the join.
- **Nothing in CI exercises `adaptEmToContract`.** A real coverage gap in a file two production
  routes depend on. Its own card; step 6 must not be widened into it, but it is the reason A1's
  regression would have shipped silently.
- **There is no editing surface for per-client AI output** (§A3), and `content_overrides` cannot
  become one without a schema change — its key is a global primary key. If the editorial pass is a
  requirement, this is its own card and it is upstream of mechanism E.
- Retiring or gating the SM Z6 path — your §8, agreed, untouched.
- p6's unbounded "In Your Words" — your card, not widened into here.

## L. Open questions

1. **Where is the per-client editing surface?** I could not find one and I am not concluding it
   does not exist. Mechanism E depends on the answer; if there is none, the plan falls back to A.
2. **Can a production EM `api_result` be captured**, and is the PII acceptable? It sets the cap's
   hit rate, not its value.
3. **Does the editorial pass happen before or after `api_result` is written?** If after, the cap
   has to be enforced on the edited text, which is a different insertion point again.

---

# Amendment 2 — a real EM sample exists, and it corrects this document

**Source:** a v2 client PDF supplied by Cai (assessment 74, Cai's own report), page 8 of the file /
**"Page 6"** by the printed footer — the Instinct & Subtype page. Text recovered by decompressing
the PDF content streams and mapping glyph IDs through the embedded `ToUnicode` CMaps; no PDF
tooling is installed on this machine. **No client prose is reproduced in this document** — the
transcription stayed in the scratchpad. [CC-MEASURED]

## 1. It is EM output, and the shape proves it

The `IN YOUR RESPONSES` box on that page renders **one `■` bullet carrying three sentences.** The
three "HOW THE ONE-TO-ONE SEVEN THINKS/FEELS/BEHAVES" blocks on the same page each render three
`■` markers, so the marker count is legible and the comparison is direct.

`renderer.js:2251` maps **one array element to one `.p6-ow-bullet`**. The SM contract is *exactly 3
bullets, ≤25 words each* (`server.js:4828`/`:4961`). One bullet of 70 words is not that. It is
`_toEvidenceArray` wrapping a single narrative — **the EM path**. [CC-MEASURED]

## 2. How that box is produced — the traced chain

1. **EM Analysis Call** → `assessments.experimental_raw_analysis` (`db.js:2991`).
2. **EM Report Call**, always Opus (`runEmReportCall`, C5), emits
   `client_facing.instinct_personal_overlay` — contract **"2–3 sentences"**,
   `experimental_analysis.js:613`, schema `:640`.
3. **`adaptEmToContract`** renames it at `em_report_adapter.js:143`:
   `instinct_personal_overlay` → `instinct_evidence`, through `_toEvidenceArray`, which wraps the
   single string as a **one-element array**.
4. Dry-validate, then persist to `assessments.api_result`
   (`server.js:5505`+ or `:12060`+ / `forceWriteApiResult`).
5. **`report_prep.js:408`** — `cf.instinct_evidence ?? null` → `pages.instinct_subtype.instinct_evidence`.
   **No CMS override is consulted** (Amendment 1 §A3).
6. **`renderer.js:2251`** renders each element as a `.p6-ow-bullet`; label `IN YOUR RESPONSES` at
   `renderer.js:2296`.

The one visible oddity: a single-item bullet list. The v2 box was built for SM's three bullets, so
EM's one narrative arrives wearing a bullet marker it does not need.

## 3. Measured on the shipped p10 renderer

Basis as declared: whitespace-collapsed, ends-trimmed. [CC-MEASURED]

| | chars | words | sentences | paragraphs | lines | box | p10 natural | |
|---|---|---|---|---|---|---|---|---|
| **real EM (assessment 74)** | **438** | **70** | 3 | 1 | **4** | **128.50px** | **1015.13** | fits, 41.87px headroom |
| constructed `EM_PARAGRAPH` | 775 | 122 | 5 | 3 | 7 (10 slots as shipped) | 186.63 / 244.75 | 1073.25 / 1131.38 | **spills** |

**It fits, one line under the 5-line cap, with 41.87px of headroom.** Zero `<br>` — no paragraph
breaks in the rendered flow. [The absence of `\n\n` is **CC-INFERRED from the render**, not traced
from the source string: text extraction does not preserve vertical gaps reliably, and I do not have
the `api_result` row.]

## 4. What this corrects in this document

**§2.6 and Amendment 1 §H are wrong in one respect each, and both in Cai's favour.**

- §2.6 said no EM-produced `instinct_evidence` exists. **True of the repo, false of the world** —
  one has been shipping in client PDFs. Amendment 1 §H priced capture as blocked on production DB
  access; **a supplied PDF is a capture route I did not list**, and it is the cheapest of the four.
- **`EM_PARAGRAPH` is not EM output and never was.** `sp4_api_result.json` is an **SM** fixture —
  `instinct_evidence` is 3 bullets and it carries `stress_point_narrative`, the SM field name, where
  the EM report emits `stress_security_narratives`. So `EM_PARAGRAPH` is **SM's** overlay
  (contract "2-4 sentences", `server.js:4956`) hand-run through a simulated adapter. The two
  producers write that field to **different contracts**.
- Against the one real EM sample the constructed worst case is **1.77× the characters, 1.74× the
  words, and the only source of the `\n\n`.** **The constructed worst case is probably
  pessimistic**, and my A2 framing leaned on it harder than one hand-built artifact deserved.

**What it does not establish**, and the distinction Cai asked to hold: this is **one sample**. It is
not a ceiling, not a distribution, and not evidence that EM never emits `\n\n` — sp4's overlay shows
this class of producer emitting three paragraphs under a "2-4 sentences" instruction, so the `<br>`
hazard stays real even though this sample does not show it. The `esc()` finding stands; what
changes is how likely it is to bite.

## 5. What it changes in the plan

- **6A's fixture item is unblocked and much cheaper.** One real sample is obtainable from a PDF
  Cai already holds; the `api_result` row for assessment 74 would be better still, because it
  settles the `\n\n` question that the PDF cannot.
- **The cap value is unaffected** — it comes from the page (Amendment 1 §D), and 5 lines stands.
- **The hit rate looks better than Amendment 1 §H4.3 estimated.** That section read "one of the
  only two real samples is over the fitting limit" — but both of those were SM-produced overlays.
  On the one genuine EM sample, the cap does not bite at all.
- **Mechanism E is unaffected and slightly better supported:** if real EM output lands at 4 lines,
  a cap that refuses rather than truncates will fire rarely, which is exactly when refusing is
  cheap and truncating is not worth building.

## 6. Open question, sharpened

Amendment 1 §L2 asked whether a production `api_result` could be captured. It now has a specific,
small target: **the `api_result` row for assessment 74**, which would confirm or refute the
no-`\n\n` inference in §3 and give the repo its first genuine EM fixture. Whether Cai's own report
data becomes a committed fixture is Cai's call, not mine.

---

# Amendment 3 — sequence validated, with one item removed

**Branch:** `pr-4-step6-z6-audit`. **Fresh fetch: nothing came down**; `main` and `origin/main` both
still `db7bd7a`. [CC-MEASURED] Audit only. Measurements taken in the scratchpad against the shipped
renderers, touching no tracked file. Counting basis as declared at the top of this document.

---

## A. LEADING: §3.4 AND §4b DESCRIBE A CHANGE THAT IS ALREADY MADE

**p10's Z6 has no marker. It has never had one. 5A emitted a paragraph.**

`renderer.js:3896` is `<div class="v3-inst-resp-txt">${_v3t(b)}</div>` — a plain block div. Its
only rule is `renderer.js:3117`: `font-size:12.5px; color:var(--v3-navy); line-height:1.55;`. There
is no `::before`, no `list-style`, no `padding-left`, no `text-indent`, no flex row. Measured live
on the shipped page: [CC-MEASURED]

| | `display` | `padding-left` | `margin-left` | `::before` content | text width |
|---|---|---|---|---|---|
| **p10 `.v3-inst-resp-txt`** | `block` | `0px` | `0px` | **`none`** | **670px** |
| p6 `.p6-ow-bullet` | flex | — | — | `"■"` | 660.16px (row 673, **inset 12.84px**) |

So:

- **§3.4 is not a decision to implement — it is the current state.** Nothing to build.
- **§4b is a no-op and should come out of 6A.** There is no marker on p10 to drop.
- **§6.2 answers itself: no marker, no inset, no width change.** Every Z6 line and pixel figure in
  this document was taken at 670px, which is the real width. **Nothing published so far is against
  the wrong geometry.** [CC-MEASURED]

**The marker you saw is p6's**, in the v2 PDF — `renderer.js:2665`,
`.p6-ow-bullet::before{content:"■"}`. That is the vestigial marker your own §7 lists as out of
scope, on its own card with p6's missing cap. **§3.4 would reach into it.** One card, one visit,
one coach-byte-diff event — your rule, and it applies here.

This is the third time the lead has been a scope correction rather than a technical one. Worth
naming: the pattern is not that the reasoning is wrong, it is that a fact observed on **p6 in a v2
PDF** gets attributed to **p10 in v3**. Both zones render the same field under near-identical
labels. That confusion is now three-for-three and is worth a line in the build prompt.

---

## B. §5.4 — REFUTED, MEASURED. Sentence count is not a proxy for anything

Three sentences, generic prose, no client data, rendered through the shipped p10 at 670px.
[CC-MEASURED; basis: whitespace-collapsed, ends-trimmed]

| sentences | words | chars | rendered lines | p10 natural | |
|---|---|---|---|---|---|
| 3 | 66 | 359 | 3 | 995.75 | fits |
| 3 | 114 | 599 | 6 | 1053.88 | fits, 3.12px left |
| 3 | 162 | 839 | 8 | 1092.63 | **SPILLS** |
| 3 | 210 | 1079 | 10 | 1131.38 | **SPILLS** |
| 3 | 258 | 1319 | 12 | 1170.13 | **SPILLS** |

**"Three sentences" spans 3 to 12 rendered lines — a 4× range on a constant sentence count.**
Your position is confirmed and it is stronger than stated: nothing bounds sentence length, so the
contract bounds nothing at all.

**And word count is not a bound either**, which matters because it is the obvious next proposal.
Measured words-per-line across the samples in this document: assessment 74 is **17.5**, the
synthetic rows above are **19.0–22.0**. A **26% spread**, so a word budget set from one sample
misprices another by more than a line. [CC-DERIVED from measured rows] Same lesson as §7.4's three
struck ceilings, in a third place.

---

## C. §6.3 — the join is justified either way, and the strongest reason is not the hazard

Argued as asked, both directions.

**If the population contains `\n\n`:** the join is **corrective**. It removes a shipped defect.

**If the population contains zero `\n\n`:** the join is **defensive for production** — and this is
the part worth getting right — but it is **corrective for two other things regardless of the
population:**

1. **The CMS preview.** `CMS_PREVIEW_V3_EVIDENCE` is 3 elements; production is 1. Measured, the
   preview renders 5 lines / 159.88px where production's shape renders 4 / 128.50px. A p10-local
   join makes the preview show the editor **the page they will actually get**. That is corrective
   today, with no population input at all. [CC-MEASURED]
2. **6B's cap unit.** Amendment 1 §C proved counted lines equal occupied slots only with no `<br>`
   and one element. **6B's cap is stated in lines. It is only measurable in lines after the join.**

**So the honest commit-message claim, and I would write it this way whatever the query returns:**
*corrective for preview fidelity and for the cap's measurement basis; defensive against a `<br>`
hazard whose frequency in production is [measured / unmeasured].* The bracket gets filled by step 0
and the sentence does not otherwise change. **The join does not need the query to be justified —
only its hazard clause does.**

---

## D. §6.4 — every consumer, traced

`instinct_evidence` is read in exactly three places, and written in four (§2.1). [CC-MEASURED]

| Consumer | Site | Affected by a p10 paragraph render? |
|---|---|---|
| v2 p6 orange box | `renderer.js:2251` | **No** — different builder, different page |
| v3 p10 Z6 | `renderer.js:3866–3896` | The site itself |
| Coach portal "Your Subtype" | `server.js:2297` → `:2326` | **No** — reads the model field, not p10's markup |

Nothing else. No email, no export, no CSV, no PDF path of its own — searched repo-wide excluding
`node_modules`/`docs`. **And since §A removes the paragraph change as a no-op, this table's answer
is moot for 6A**; it is recorded because you asked it traced rather than assumed, and because it is
the check that would have caught §3.3 had it been run then.

---

## E. §5 — WHO CAN RUN THE QUERY: **CAI MUST. I CANNOT.**

Stated plainly, as asked. `psql` is installed and `app/.env` holds a production `DATABASE_URL`, so
the *capability* exists — but **this session's permission layer refused the connection**, and I did
not attempt to route around it. [CC-MEASURED — the attempt was made and blocked]

So the queries below are written to be handed to you. **Query 1 returns no client prose** — only
lengths, counts and flags — so it can be run and pasted anywhere. Query 2 returns prose and should
go to a file I read locally, never into this document.

### Query 1 — the population, no prose

```sql
WITH ov AS (
  SELECT a.id,
         a.analysis_mode,
         (a.experimental_raw_analysis IS NOT NULL)                     AS has_em_analysis,
         a.api_result->'client_facing'->>'instinct_personal_overlay'   AS raw,
         btrim(regexp_replace(
           a.api_result->'client_facing'->>'instinct_personal_overlay',
           '\s+', ' ', 'g'))                                           AS txt,
         jsonb_typeof(a.api_result->'client_facing'->'instinct_evidence') AS ev_type,
         CASE WHEN jsonb_typeof(a.api_result->'client_facing'->'instinct_evidence') = 'array'
              THEN jsonb_array_length(a.api_result->'client_facing'->'instinct_evidence')
         END                                                           AS ev_len
  FROM assessments a
  WHERE a.api_result IS NOT NULL
    AND a.permanently_deleted IS NOT TRUE
    AND a.api_result->'client_facing'->>'instinct_personal_overlay' IS NOT NULL
), m AS (
  SELECT ov.*,
         length(txt)                                            AS chars,
         array_length(regexp_split_to_array(txt, ' '), 1)       AS words,
         (SELECT count(*) FROM regexp_matches(txt, '[.!?]+(\s|$)', 'g')) AS sentences,
         (position(chr(10) in raw) > 0)                         AS has_nl,
         (raw LIKE '%' || chr(10) || chr(10) || '%')            AS has_blank_line,
         (position(chr(13) in raw) > 0)                         AS has_cr
  FROM ov
)
SELECT count(*)                                    AS n,
       count(*) FILTER (WHERE has_nl)              AS with_any_newline,
       count(*) FILTER (WHERE has_blank_line)      AS with_blank_line,
       count(*) FILTER (WHERE has_cr)              AS with_cr,
       count(*) FILTER (WHERE ev_len = 1)          AS evidence_1_elem,
       count(*) FILTER (WHERE ev_len = 3)          AS evidence_3_elem,
       count(*) FILTER (WHERE ev_len NOT IN (1,3)) AS evidence_other,
       count(*) FILTER (WHERE ev_type IS NULL
                           OR ev_type = 'null')    AS evidence_null,
       min(chars), max(chars), round(avg(chars))                                  AS avg_chars,
       percentile_disc(0.50) WITHIN GROUP (ORDER BY chars)                        AS p50_chars,
       percentile_disc(0.90) WITHIN GROUP (ORDER BY chars)                        AS p90_chars,
       percentile_disc(0.99) WITHIN GROUP (ORDER BY chars)                        AS p99_chars,
       min(words), max(words), round(avg(words))                                  AS avg_words,
       percentile_disc(0.90) WITHIN GROUP (ORDER BY words)                        AS p90_words,
       min(sentences), max(sentences), round(avg(sentences), 1)                   AS avg_sentences
FROM m;
```

Run it a second time with `GROUP BY analysis_mode, has_em_analysis` appended (and those two columns
added to the SELECT) — that is what confirms or refutes §2's claim that **every** stored report is
EM-shaped. The `evidence_1_elem` / `evidence_3_elem` split is the direct test: 1 is EM, 3 is SM.

**Counting basis, stated because you asked:** `chars` and `words` are on the
**whitespace-collapsed, ends-trimmed** string, matching every figure in this document. `words` splits
on single spaces after collapsing. `sentences` counts `[.!?]+` followed by whitespace-or-end — which
**undercounts a sentence ending in `."` or `.'`**, exactly as it did on assessment 74 (my script
reported 2; the true count is 3). Treat `sentences` as a floor, not a count. The newline flags are
on the **raw** string, deliberately — collapsing would destroy the thing being measured.

### Query 2 — the longest handful, prose, for geometry only

```sql
SELECT a.id,
       length(btrim(regexp_replace(
         a.api_result->'client_facing'->>'instinct_personal_overlay','\s+',' ','g'))) AS chars,
       a.api_result->'client_facing'->>'instinct_personal_overlay' AS overlay
FROM assessments a
WHERE a.api_result IS NOT NULL
  AND a.permanently_deleted IS NOT TRUE
  AND a.api_result->'client_facing'->>'instinct_personal_overlay' IS NOT NULL
ORDER BY chars DESC
LIMIT 10;
```

**Format I need:** `psql -At -F $'\t'` output, or JSON, written to a file path you give me. **Raw
string, newlines preserved** — `\n` is the measurement. I will render each through the shipped p10
and p6 and report **lines and px only**; no prose reaches any committed file, same as Amendment 2.

Add assessment 74's row to that export (`WHERE a.id = 74`) — it is what 3.1 needs and, per your own
3.1, the fixture must come from the **stored bytes**, not my PDF transcription.

### What it will and will not establish

**Will:** whether `\n\n` occurs in production at all (5.2, the one that decides §C's hazard clause);
the real char/word/sentence distribution; whether the population is EM-shaped end to end; the
observed maximum. **Will not:** a ceiling. An observed max over stored assessments is a floor for
the decision, which is all you claimed and all I would claim.

### 5.5 — p6, recorded not acted on

The same field on p6's geometry, measured now so the card starts with numbers. Assessment 74's
overlay on the live v2 p6: **4 rendered lines**, font 11.5px, line-height 17.25px, text column
660.16px (673 row − 12.84 marker inset), **p6 height 1056 — fits.** [CC-MEASURED] p6's zone is
narrower AND smaller-typed than p10's, so it holds slightly more text per line; the query's longest
rows should be rendered against both.

---

## F. THE §4 SEQUENCE — ITEM BY ITEM

| Item | Verdict |
|---|---|
| **Step 0 — population query** | **Validated, and your rationale is better than mine.** It does not gate the join (§C), but it decides one clause of what the commit claims, and that is worth a step. **Blocked on you** (§E). |
| **6A(a)** p10-local join | **Validated.** |
| **6A(b)** drop the marker | **REFUTED — remove it. No-op on p10; the marker is p6's, and p6 is your own out-of-scope card.** (§A) |
| **6A(c)** assessment 74 as fixture | **Validated, but it is downstream of step 0, not parallel to it.** Your 3.1 says the fixture must come from the stored `api_result` string; I only have a PDF transcription. **It cannot land until Query 2 runs.** If step 0 slips, 6A ships without it and 6B gets it. |
| **6A(d)** fit-doc corrections | **Validated.** |
| **6A(e)** matrix states report-only | **Validated**, with a caveat on how it is red-proven (§G). |
| **6B** | **Validated**, including writing down the reusable part — PR 5 and PR 6 will face this and the headroom method (Amendment 1 §D) is the transferable artifact, not the 5-line number. |

**On your (b)/(c) rationale — "both change the geometry 6B measures against."** Correct as a
principle, and it is why (c) is right to be early. But (b) changes no geometry, because there is no
marker (§A). Your reasoning was sound; the premise was not.

**One thing I would add to 6A that is on neither list:** **relabel `EM_PARAGRAPH`** (your 3.3). It
lives in `tests/fixtures/instinct_axis.js`, whose comment block currently asserts a provenance that
Amendment 2 disproved. 6A already edits the matrix that consumes it, and leaving a file claiming
false provenance while editing the file next to it is how the `cmsWordBudget` error propagated
through four documents.

---

## G. THE 6A BUILD PLAN

**Files: three, plus a fourth only if step 0 has run.**

| # | File | Change |
|---|---|---|
| 1 | `tests/fixtures/instinct_axis.js` | Relabel `EM_PARAGRAPH` as a **synthetic hazard case**, not EM output. Add assessment 74's overlay as a separate labelled export *(only with step 0)*. |
| 2 | `app/renderer.js` | The p10-local join in the Z6 block (~3866–3896). **Nothing else in this file.** |
| 3 | `scripts/render_client.js` | Add `sm_bullets` + `em_paragraph` Z6 states, **report-only**. |
| 4 | `docs/p10_fit_results.md` | Annotate `em_paragraph` as target-correct; fix `sm_bullets` 173.25 → **179.25**; add the Amendment 1 §D headroom table. |

**Order, and it is load-bearing:**

**3 before 2.** The matrix states must exist and be *observed spilling* before the join lands,
because that observation is red-proof #1 and it is unrepeatable afterwards — once the join is in,
`em_paragraph` reports 1073.25 instead of 1131.38 and the pre-join number can never be taken again.
Then **2**, then re-run and record the new number. Then **1** and **4**, which touch nothing the
renders depend on.

### Done-when evidence

1. The matrix prints Z6 rows for both states, pre-join, with `em_paragraph` at **page 1131.38** and
   `sm_bullets` at **1065.88** — both flagged as spills, run still green because report-only.
2. Post-join, the same rows read **1073.25** and **1056**. `sm_bullets` **stops spilling** — that is
   the join's corrective effect on a multi-element payload, visible in the run output.
3. `em_paragraph` **still spills at 1073.25**. **A green run here would mean the join did the cap's
   job and 6B is untested.** This is the expected, intended end state of 6A.
4. Coach HTML byte-identical, both fixtures. Mandatory — `renderer.js` is touched.
5. `npm test`, `verify:render`, `verify_content_library`, transparency, diagrams all green.

### Red proofs — one per assertion, each shown failing for the right reason

| # | Assertion | How it is proven red, against a green control |
|---|---|---|
| 1 | the matrix states reach the gate | **Before** the join, in a scratch copy, flip the Z6 rows to enforcing. The run must fail **naming p10** at 1131.38 > 1057. A report-only gate cannot be proven by running it — it never fails — so it is proven by showing it *would*. This is the only way to red-prove a report-only gate and it must happen before item 2 lands. |
| 2 | the join is doing work | Post-join, the same scratch enforcement must fail at **1073.25**, not pass. Pass = the join is silently acting as the cap. |
| 3 | the join actually joins | Feed a two-element payload with `\n\n` in each. Assert **one** `.v3-inst-resp-txt` and **zero** `<br>` in p10's markup. Red-prove by reverting the join and observing 2 elements / 4 `<br>`. |
| 4 | the join is p10-local | Assert p6's markup for the same payload is **unchanged** — still one `.p6-ow-bullet` per element, `<br>` intact. Red-prove by moving the join to `report_prep.js` and observing p6 change. **This is the assertion that would have caught §3.3.** |
| 5 | the doc numbers are the shipped ones | Re-measure `sm_bullets` on the shipped page and confirm **179.25**, not the recorded 173.25. Red-prove by asserting 173.25 and watching it fail. |

**Green control before each.** And per step 4's lesson: assert on the failure **output** — the spill
line and the page identity — not merely a non-zero exit, because a `TypeError` also exits non-zero.

### Not in 6A, explicitly

The cap. Enforcement. `CMS_PREVIEW_V3_EVIDENCE`'s re-cut. `em_report_adapter.js`. p6 — its marker
and its missing cap. Anything in your §7.

---

## H. Carried, and one thing added to Amendment 1's list

**Capture routes for production reality** (Amendment 1 §H4.1) now has a fourth, permanently:
**(d) a shipped artifact the operator already holds** — a client PDF, an email, an export. It was
the cheapest route to the truth on this step and it was not on the list. [Your note, recorded as
asked.]

**Open, unchanged:** whether an editing surface for per-client AI output exists (Amendment 1 §L1).
Mechanism E in 6B depends on it, and 6A does not.
