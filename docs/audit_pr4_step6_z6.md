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
