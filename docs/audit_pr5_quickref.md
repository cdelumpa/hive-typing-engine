# PR 5 audit — Quick Reference (sheet 5 / footer 3)

**Branch:** `pr-5-quickref-audit` · **Base:** `main @ f385c9a` (fetched 7 Sep 2026; working tree was
already current, `Already up to date`) · **Scope:** audit only. No code and no content changed.

**Path note.** The prompt suggested `docs/pr5_quickref_audit.md`. The repo convention is
`docs/audit_prN_<topic>.md` — nine existing files follow it, zero follow the other shape — so this
is `docs/audit_pr5_quickref.md`.

**Tagging.** `[MEASURED]` = observed by running something on this branch. `[JUDGMENT]` = my reading.
`[UNVERIFIED]` = stated but not confirmed here. Every char/line/px figure names its counting basis.

**Gate baseline at the time of measurement** `[MEASURED]`: `npm test` 27/27 pass ·
`scripts/verify_diagrams.js` green (18 diagrams, min edge clearance 5.47px) ·
`scripts/verify_transparency.js` green (0 groups / 0 masks / 0 alpha<1). Chromium 147.0.7727.57.

---

## 0. Lead — what is wrong

Eight items. The first five are wrong in the prompt; the sixth is a live contradiction the prompt
half-anticipated; the last two are the content and data answers that belong up here.

### 0.1 §6.1's premise is false. You have the Quick Reference HTML. `[MEASURED]`

The prompt says "The project workspace holds the rendered PDF and only two older .html files (TOC
and Welcome)." **All twelve reference implementations are tracked in `docs/mockup/`**, and the Quick
Reference is `docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html`, 165 lines. It is named in
`docs/mockup_file_manifest.md` as the sheet-5 file, and `scripts/verify_transparency.js:22` already
cites it by full path.

PR 5 is a port from HTML, not a reconstruction from a PDF. That is a materially cheaper job, and
every geometry number in §6.2 and §7.2 below is measured off that file rather than estimated.

### 0.2 `generate_report.js` is not the client report generator. It is dead code. `[MEASURED]`

§1.2 asks for a trace "through to `generate_report.js`". That file builds the **retired beta
diagnostic PDF**, and it says so at [`app/generate_report.js:568`](app/generate_report.js:568):

> `DEAD CODE (PR-F): the beta diagnostic PDF report was retired when /admin/beta-review replaced it.
> launchBrowser, htmlToPdf, generateBetaReport, and runCli below are no longer called by any route
> or CLI shim.`

`generate_report.js:588` — the bare `page.pdf()` that **IO-93 cites as its evidence** — is inside
`htmlToPdf`, one of the four functions named in that comment. IO-93's *substance* is correct and I
confirm it below (§9), but its citation points at a function nothing calls. The live emitter is
[`app/server.js:5065`](app/server.js:5065). **The card should be re-cited before anyone works it**,
or the first person to open it will "fix" a dead path and believe they are done.

### 0.3 §7.2 quotes a spec claim the spec itself struck out. `[MEASURED]`

§7.2 says "Spec §3.5 records a minimum label-to-label gap of 27.7px, verified across all 9 types on
both EXISTING page types." In the tracked spec that sentence is inside `~~strikethrough~~`
([`docs/hive_insightout_client_report_design_spec_v3_0.md:126`](docs/hive_insightout_client_report_design_spec_v3_0.md:126), and the retraction is at `:145`),
and the post-lock correction dated **12 Aug 2026** retracts it on four counts, including:

> **The 27.7px label-to-label minimum is not met either.** Measured minimum gap between distinct
> labels is **24.12px** … which suggests the 27.7px figure was not met by the original either.
> … The gate asserts **non-overlap**, not the 27.7px figure, since that figure was never met.

So there is no 27.7px floor to "carry across". There is a measured 24.12px baseline on
wings/lines, and an instruction to set a floor from it if one is wanted. §7.2's real question —
"measure p5's actual geometry" — is answered in §7 below, and the answer is that label separation
is the wrong gate for this diagram entirely.

### 0.4 IO-75's 1.96% is a Wings-page figure, and it has grown to 2.3433% `[MEASURED]`

§7.1 describes IO-75 as "the 1.96% pixel delta between the diagram port and the hand-authored
mockup SVG" and says to re-measure it. Two corrections:

* The figure is a **whole-page** diff of the built **Wings** page against `Wings_v1.html`
  ([`docs/audit_pr2_static_pages.md:310`](docs/audit_pr2_static_pages.md:310)), localised *by
  inspection* to the diagram band. It is not a diagram-only measurement and it is not about p5.
* **There is no p5 diagram to re-measure.** `quickref` has no `built` flag in `V3_PAGE_ORDER` and no
  renderer, so the delta §7.1 asks for cannot exist until step 5 of the build.

I re-measured the thing that does exist. Method: Chromium 147 screenshot of the built page at
816×1056 against the mockup rendered the same way, per-pixel max-channel delta > 8, percentage **of
the 861,696 pixels in the sheet** — the same method and basis as the PR 2 table.

| When | Comparison | Differing px | Share |
|---|---|---|---|
| PR 2 audit | `main @ 808174f` Wings vs `Wings_v1.html` | 16,926 / 861,696 | 1.9643% |
| PR 2 audit | PR 2 branch Wings vs `Wings_v1.html` | 18,318 / 861,696 | 2.1258% |
| **This audit, `main @ f385c9a`** | **built Wings vs `Wings_v1.html`** | **20,192 / 861,696** | **2.3433%** |

Densest bands `[MEASURED]`: y200–249 (5,601), y250–299 (5,539), y300–349 (4,925), y150–199 (2,751),
y750–799 (1,376). The first four are the `.v3-dia` diagram band, matching PR 2's localisation. The
y750–799 band is the `_v3NoBreak` hyphenation change PR 2 introduced, which the PR 2 audit measured
at y=782–789.

**Treat the difference as a finding, per §7.1's instruction.** The delta has grown ~0.38pp since 11
Aug, in two steps, and neither step was a diagram change. `[JUDGMENT]` **My recommendation is
accept-and-assert, not close-the-gap** — and to assert it on the *diagram band only*, not the page.
The reasons are measured: the whole-page figure moves whenever any line of copy rewraps, so a
page-level threshold is a copy-change detector wearing a geometry costume, which is what just
happened twice. A band-scoped assertion over y=148–370 would have held flat across both changes.
Closing the gap means editing `buildEnneagramSVG` to chase sub-pixel stroke offsets against a
hand-authored SVG that is not the source of truth for any other page — cost with no correctness
gain, on a primitive five shipped pages depend on.

### 0.5 §8.1 reads the instinct-axis fixtures the opposite way round from how they are documented `[MEASURED]`

§8.1 says PR 4's instinct axis "may ALREADY SATISFY PART OF" IO-64's near-tie requirement.
`tests/fixtures/instinct_axis.js:44` says the opposite, in its own words:

> The three profiles are permutations of anders_sx9's own {66, 64, 84} … It also means **ALL THREE
> carry the same 2-point second/third gap, i.e. every profile in this set is a near-tie.** A
> clearly-separated profile ({90,50,10} or similar) is wanted at STEP 4.

Measured across every instinct profile in the repo `[MEASURED]`:

| Fixture | Ordered | gap 1→2 | gap 2→3 | dominant | dominant == top score? |
|---|---|---|---|---|---|
| `anders_sx9` | SX 84 / SP 66 / SO 64 | 18 | 2 | SX | yes |
| `sp4` | SP 73 / SX 51 / SO 40 | 22 | 11 | SP | yes |
| `sx7` | SX 74 / SO 52 / SP 40 | 22 | 12 | SX | yes |
| axis `sp_primary` | SP 84 / SO 66 / SX 64 | 18 | 2 | SP | yes |
| axis `so_primary` | SO 84 / SX 66 / SP 64 | 18 | 2 | SO | yes |
| axis `sx_primary` | SX 84 / SP 66 / SO 64 | 18 | 2 | SX | yes |

**The minimum primary→secondary gap in the entire repo is 18 points.** Every fixture is a clear
leader. The near-tie that exists is at the 2↔3 boundary, which p5 does not badge as a decision.
And in all six, `dominant_instinct_hypothesis` agrees with the top score — so **the one case that
makes p5 look broken has never been rendered**. See §4.4 and §8.1.

### 0.6 The mockup's heat-map SVG violates spec §3.2. Both cannot be canon. `[MEASURED]`

`AtAGlance_v1.html` paints its nine nodes with `fill-opacity` (0.100 → 1.000) and its legend ramp
with a `stop-opacity` gradient. Spec §3.2 forbids both, and §7.4's decision of 11 Aug restates it.

Rendered verbatim through the pinned Chromium and scanned with `verify_transparency.js`'s own
scanner `[MEASURED]`: **1 transparency group, 1 soft mask, 8 non-opaque alpha values.** That is
exactly what [`scripts/verify_transparency.js:22`](scripts/verify_transparency.js:22) predicts, and
I confirmed it rather than quoting it.

So "the mockup is canon for this page in every respect except the naming line" (prompt §3) is one
exception short. **It is canon for layout and copy; it is not canon for the fill mechanism.** The
node fills and the ramp must be re-expressed as opaque solids on white before anything renders. The
good news is §7.4's gate catches this — see §7.4.

### 0.7 The nine type scores are not exposed, and it is worse than that: two candidate sources disagree `[MEASURED]`

Full trace in §1. The short form: instinct scores **are** on the client model and p5 can read them
today. The nine type scores are **not**, and the drop is a deliberate one-line projection. But the
harder question is one §8.4 does not ask — **which** nine numbers the heat map means. There are
two nine-number fields, they mean different things, and on `sp4` they disagree about which type is
the alternate. That question has to be decided before any plumbing is written.

### 0.8 The subtype one-sentence summary does not exist. 27 strings. Critical path. `[MEASURED]`

Confirmed and quantified in §5.1. Everything *else* the page needs exists: naranjo and signature
**27/27**, core motivation **9/9**. Spec §7.3's "Only the three Type 9 subtypes exist" is stale.

---

## 1. Spec §8.4 — the trace

> "The heat map and instinct bars need all nine type scores plus the three instinct scores. The
> coach report has them. ARE THEY EXPOSED TO THE CLIENT REPORT GENERATOR TODAY?"

**Answer: the three instinct scores yes; the nine type scores no.** `[MEASURED]`

### 1.1 Where the scores live at rest

| | Nine type scores | Three instinct scores |
|---|---|---|
| Table / column | `assessments.api_result` JSONB ([`app/db.js:81`](app/db.js:81)) | same |
| JSON path | `hypothesis.type_score_profile` | `hypothesis.instinct_score_profile` |
| Observed shape | object keyed by **string** `"1"`…`"9"`, values numbers | `{ SP, SO, SX }`, values numbers |
| Also at rest | `assessments.scores_snapshot` JSONB ([`app/db.js:82`](app/db.js:82)) as `typeProfile` | as `instinctProfile` |
| Written by | [`app/call2_stamp.js:36`](app/call2_stamp.js:36) and [`app/server.js:5471`](app/server.js:5471) | `call2_stamp.js:37`, `server.js:5472` |

**Shape observed, not promised** `[MEASURED]`: across the three tracked `*_api_result.json`
fixtures, all nine keys are present and all values are integers. **That is a fixture artefact.** The
production values cannot be integers in general — `scoreStage1Profile`
([`app/public/assessment.js:771`](app/public/assessment.js:771)) computes each score as the mean of
exactly five 0–100 sliders (`(a+b+c+d+e)/5`), so real values land on `.0/.2/.4/.6/.8`. The coach
portal already renders them `.toFixed(1)` ([`app/server.js:2236`](app/server.js:2236)). **A p5
builder must not assume integers**, and the fixtures will not catch it if it does (§8.2).

Both fields are stamped **unconditionally from the deterministic slider math on both the SM and the
EM path** — [`app/em_report_adapter.js:21`](app/em_report_adapter.js:21) says so explicitly and the
guard at `call2_stamp.js:36` is truthiness only. Production is EM-only, so this matters: **the nine
type scores are present on production rows.** `[MEASURED]`

### 1.2 What the client report generator receives today

The entry point in §1.2 is misnamed (§0.2). The real path:

| Hop | File:line | What happens to the nine type scores |
|---|---|---|
| 1 | [`app/server.js:5320`](app/server.js:5320) | `renderClientReport({ apiResult, client, coach })` — full `apiResult`, nothing dropped |
| 2 | [`app/render_report.js:23`](app/render_report.js:23) | `prep.buildClientModel({ apiResult, client, coach })` — still whole |
| 3 | **[`app/report_prep.js:261`](app/report_prep.js:261)** | **DROPPED HERE** |
| 4 | [`app/render_report.js:25`](app/render_report.js:25) | `R.buildClientReportHTML(model)` — model only; `apiResult` is out of scope |

**Hop 3 is the drop, and it is deliberate.** The coach model at
[`app/report_prep.js:172`](app/report_prep.js:172) reads:

```js
charts: { types: typeBars(h.call1_ranking), instincts: instinctBars(h.instinct_score_profile) },
```

and the client model at [`app/report_prep.js:261`](app/report_prep.js:261) reads:

```js
charts: { instincts: instinctBars(h.instinct_score_profile) },
```

Same helper, same scope, one key omitted. It is an **explicit projection in an object literal** — a
DTO boundary, not an allowlist and not an accident. `[JUDGMENT]` It reads as "the v2 client report
never had a type chart", which is true, rather than as a decision about v3.

**Verified by building the model rather than reading it** `[MEASURED]` — `buildClientModel` on
`anders_sx9`:

* top-level keys: `client, hero, display, alternate, confidence, svg, charts, instinct_stack, pages, _flags, _warnings`
* `charts` = `{ instincts: [ {SP,66}, {SO,64}, {SX,84} ] }` — **no `types` key**
* the substring `type_score_profile` appears **nowhere** in the serialised model
* the substring `call1` appears **nowhere** in the serialised model

`nearTie(h.call1_ranking)` runs at `report_prep.js:259`, but only the resulting **boolean** survives
onto `confidence.near_tie`. The array does not.

### 1.3 The three instinct scores — separate trace, and p10's path

**Exposed, at `model.charts.instincts`** ([`app/report_prep.js:261`](app/report_prep.js:261)), as
`[{code:'SP',score},{code:'SO',score},{code:'SX',score}]` with `Math.round()` applied by
`instinctBars` ([`app/report_prep.js:62`](app/report_prep.js:62)). **Note the rounding**: the model
carries integers even though the source is fractional. Bar widths from these are integer-quantised;
that is fine for a 13px-tall bar and worth knowing before anyone reports a 0.4 discrepancy.

**Does p10 reach the raw three scores or only the derived stack?** `[MEASURED]` **Both, and it
deliberately ignores the stack.** [`app/renderer.js:3838`](app/renderer.js:3838):

```js
const dom = String(m.display.instinct_code || '').toUpperCase();
const rank = (() => {
  const score = Object.fromEntries((m.charts.instincts || []).map((b) => [b.code, b.score]));
  const rest = ['SP','SO','SX'].filter((c) => c !== dom)
    .sort((a, b) => (score[b] || 0) - (score[a] || 0));
  return { [dom]: 'Primary', [rest[0]]: 'Secondary', [rest[1]]: 'Tertiary' };
})();
```

It reads `m.charts.instincts` (raw scores) and `m.display.instinct_code` (dominant), and the comment
above it at `renderer.js:3828` explains that it must **not** use `instinctStack`, because that
helper labels Leading/Supporting/Growing **by score alone with no dominant input** and is read by
live v2 p6, the coach report and the Coach Prep Report.

**Can p5 reuse that path as-is? Yes, exactly as-is.** `[MEASURED]` Both inputs
(`m.charts.instincts`, `m.display.instinct_code`) are already on the client model for every render.
**p5 needs zero data plumbing for the instinct half of the page.**

### 1.4 The shortest honest path to exposing the nine type scores

`[JUDGMENT]` Before the files: **there is a decision above the plumbing.** Two nine-number fields
exist and they are not the same thing.

| | `hypothesis.type_score_profile` | `hypothesis.call1_ranking` |
|---|---|---|
| Origin | mean of 5 sliders per type, `scoreStage1Profile` | em_only: EM's AI `em_ranking`; sm: Call #1 coherence |
| Deterministic? | **yes** — pure arithmetic on client input | **no** — an AI judgment field |
| Exactly nine? | **yes** — a `TYPES` loop over 1..9 | contract says "exactly 9 entries" ([`app/experimental_analysis.js:134`](app/experimental_analysis.js:134)), **unenforced in code** — the guard at [`app/em_report_adapter.js:106`](app/em_report_adapter.js:106) is `.length` truthiness |
| What it measures | how much the client endorsed each type's statements | the engine's confidence in each type as a hypothesis |
| On the client model | no | no |

They disagree `[MEASURED]`. Ranking each fixture's `type_score_profile` and comparing position 2
against the shipped `alternate_candidate`:

| Fixture | `type_score_profile` #1, #2 | `alternate_candidate` | agree? |
|---|---|---|---|
| `anders_sx9` | T9 91, **T5 83** | 5 | yes |
| `sx7` | T7 80, **T5 58** | 5 | yes |
| `sp4` | T4 79, **T3 61** | **1** | **no** |

On `sp4`, a heat map drawn from `type_score_profile` would put the dashed ALTERNATE ring on **node
3**, while the panel beside it, sheets 6–7, and the coach report all name **Type 1**. The page would
contradict itself. `[JUDGMENT]` **That is the single largest correctness risk on this page** and it
is invisible on the `anders_sx9` fixture the mockup was built for, because there the two sources
coincide exactly.

`[JUDGMENT]` **Recommendation: `type_score_profile` for the nine node fills, and the ring positions
sourced from `leading_candidate` / `alternate_candidate` — never from the heat map's own ordering.**
Reasons, all measured above: it is deterministic, it is guaranteed to be nine, it is the same number
the client actually produced with the sliders (which is what "How the Nine Patterns Scored" claims
to show), and decoupling the rings from the fill ordering makes the `sp4` disagreement render as a
mid-ramp node wearing the alternate ring — visibly odd but *not wrong* — instead of as a
contradiction. If instead the rings are derived from the ordering, `sp4` ships a false statement.

**The work, enumerated. No days, no adjectives.**

1. `app/report_prep.js` — **one line**, at :261, mirroring :172:
   `charts: { types: typeBars(h.type_score_profile…), instincts: … }`. `typeBars` as written takes
   `call1_ranking`'s `[{type,score}]` array shape and applies `centerFill`, so either a sibling
   helper or a shape adapter is needed — the profile is a `{"1":n}` object, not an array, and p5
   wants a cyan ramp, not centre colours. **Call it `typeScoreRamp`, not an overload of `typeBars`**;
   `renderer.js:3828`'s "two ordering rules in one module is how the wrong one gets imported" applies
   verbatim to two chart-shaping rules.
2. `app/report_prep.js` — `validateModel` (invoked from `buildClientModel`): assert nine entries,
   numeric, and that `leading_candidate`/`alternate_candidate` are both present. Today nothing does
   (§1.5).
3. `app/server.js:13985` `cmsPreviewApiResult` — the CMS preview stub emits a **2-entry**
   `call1_ranking` and **no `type_score_profile` at all** `[MEASURED]`. Any p5 field that becomes
   CMS-previewable renders a heat map with 2 of 9 nodes until this stub carries nine scores.
4. `tests/fixtures/*` — nothing new required for existence; three fixtures already carry a full
   nine-key profile (§8.2). New fixtures are required for the *hazard* cases, not the happy path.
5. `tests/report_pages_test.js` / `scripts/render_client.js` — assertions for the new model key.

That is **three production files and two test files**, with the only non-trivial one being the
decision in §1.4's first half rather than any of the edits.

### 1.5 What validates the fields today

**Nothing, on either set.** `[MEASURED]`

* `buildClientModel` throws if `dominant_instinct_hypothesis` and `confirmed_instinct` are both null
  (noted at `renderer.js:3840`), so `display.instinct_code` is safe.
* `instinctBars(profile)` at [`app/report_prep.js:62`](app/report_prep.js:62) is
  `Math.round((profile && profile[code]) || 0)` — **a missing or malformed instinct profile silently
  yields three zeros**, and on p5 that renders as three zero-width bars with one of them badged
  Primary. On p10 the same input renders a page that looks entirely normal, because p10 draws no
  magnitudes. This is IO-97's blast radius widening, not a new defect (§4.4).
* There is no validator for `type_score_profile` anywhere in the report path, because nothing in the
  report path reads it.

---

## 2. Spec §8.5 — the score scale

### 2.1 What the scale is `[MEASURED]`

From [`app/public/assessment.js:768`](app/public/assessment.js:768) and the `mean5` helper at :778:

> Each type/instinct score is the **MEAN of its five sliders (sum / 5)**, landing on a 0-100 scale.

So, definitively: **a 0–100 index, the arithmetic mean of five 0–100 self-report sliders.** It is
**not** a percentage of anything, **not** a raw sum, and — the point that matters most for §2.2 —
**the nine type scores are nine independent means. They are not normalised against each other and
they do not sum to anything.**

Both extremes are reachable, not theoretical: `tests/stage1_scoring_test.js:101-103` asserts
`typeProfile[3] = 100.0` and `typeProfile[1] = 0.0` from real slider input.

**Observed range across the stored assessments.** I have no database access in this session, so this
is the honest scope: **observed across the three tracked fixtures** `[MEASURED]` — type scores span
**31 to 91** (per-fixture ranges 31–91, 38–79, 38–80); instinct scores span **40 to 84**. Per-fixture
type spread is 60, 41 and 42 points. `[UNVERIFIED]` The production distribution is not measured here
and should be before §2.2's choice is locked — it is a single query against
`assessments.api_result -> 'hypothesis' -> 'type_score_profile'`.

### 2.2 What the ratios should be OF — and whether the data supports the mockup's answer

**The mockup uses two different bases on the same page.** `[MEASURED]`

**Instinct bars** — `style="width:66%"`, `width:64%`, `width:84%` for SP 66 / SO 64 / SX 84. That is
the raw score as a percentage of a **fixed ceiling of 100**. Given §2.1, this is **correct and
meaningful**: the scale ceiling is 100, it is reachable, and the same score renders the same width
for every client. `[JUDGMENT]` Keep it.

**Heat map** — nine `fill-opacity` values. Reverse-engineered `[MEASURED]`: with the mockup's stated
scores (9:90 … 6:35), every value matches
`0.10 + 0.90 × (score − min) / (max − min)` to three decimals, e.g. 5:85 → 0.918, 8:55 → 0.427,
6:35 → 0.100. That is **min–max normalisation across the client's own nine scores**.

**The data does not support that choice, and this is the answer to "meaningful or decorative".**
`[JUDGMENT]`, from `[MEASURED]` premises:

* Because the nine scores are nine *independent* means with a fixed 0–100 ceiling, a client's own
  min and max carry no scale information. Normalising to them **discards the only comparable
  quantity on the page**.
* The formula is degenerate by construction: **every** client gets exactly one node at full cyan and
  exactly one at 0.10, regardless of spread. A client scoring 48–52 across all nine — genuinely
  undifferentiated, the exact case a Quick Reference should communicate honestly — renders a heat map
  **pixel-identical** to Anders's 31–91 profile. The figure would state a strong type pattern that
  the data does not contain.
* The fixture spreads already vary 41 → 60 points `[MEASURED]`, so this is not a corner case; it is
  a 46% swing in what one unit of ramp means, across three samples.

`[JUDGMENT]` **Recommendation: `0.10 + 0.90 × score/100`, the fixed scale ceiling, for both charts.**
It makes the two charts on this page mean the same thing, makes the ramp comparable between clients,
and lets a flat profile look flat. The cost is real and should go to Cai and Mo, not be decided in a
build: on Anders it compresses the visible range from 0.100–1.000 to 0.379–0.919, so the picture is
less dramatic. If the drama is wanted, the honest middle is a fixed *floor* at 0 and a fixed ceiling
at 100 with a non-linear ramp — still client-comparable, still flat when the data is flat.

**A third live surface already disagrees with both.** `[MEASURED]` The coach portal's bars
([`app/server.js:2228`](app/server.js:2228) `renderStrengthBars`) use
`max = Math.max(1, ...rows.map(r => r.score))` and `pct = score/max*100` — **ratio of max observed**,
a third basis, for the same three instinct numbers p5 will draw as a ratio of 100. Whatever is
decided, it is worth deciding once across surfaces.

### 2.3 Does anything downstream read the numbers? `[MEASURED]`

**Yes — one live consumer, and removing the numerals from the client chart does not touch it.**

| Consumer | File:line | Reads | Displays numerals? |
|---|---|---|---|
| **Coach portal, "type pattern strength" bars** | [`app/server.js:2493`](app/server.js:2493)→[`:2228`](app/server.js:2228) | `call1_ranking` | **yes**, `.toFixed(1)` |
| **Coach portal, instinct bars** | [`app/server.js:2497`](app/server.js:2497)→`:2228` | `instinct_score_profile` | **yes**, `.toFixed(1)` |
| Coach report, type chart | `report_prep.js:172` `typeBars` | `call1_ranking` | via `renderTypeStrengthChart` |
| Coach report / Coach Prep, instinct chart + stack | `report_prep.js:172, 262, 409` | `instinct_score_profile` | chart only |
| EM/SM comparison admin view | [`app/server.js:11695`](app/server.js:11695) | `call1_ranking` vs `em_ranking` | yes |
| Beta diagnostic report | `generate_report.js:346` | `scores.typeProfile` | **dead code** (§0.2) |

**Nothing reads `type_score_profile` in any report path.** Every "type score" surface in the product
today is reading `call1_ranking`. `[JUDGMENT]` That is worth stating plainly, because it means the
recommendation in §1.4 puts a number on a client-facing page that **no other surface currently
shows** — which is defensible (it is the client's own answers) but is a product decision, not a
plumbing one.

**Conclusion for §8.5: safe.** The numerals were removed from the *client chart*; the coach portal
is a different surface and keeps them. No consumer breaks.

---

## 3. Collision 1 — subtype naming. Decided; pricing the path.

**Decision received:** p5's subtype panel uses NARANJO NAME + SIGNATURE. "Fusion · Merging &
Intensity", not "The Seeker · Merging & Intensity".

### 3.1 Where p10 sources them `[MEASURED]`

**Field:** `content_library.json` → `subtype_<code>` → **`instincts_v3.{naranjo, signature, narrative}`**.
**Model path:** `m.pages.v3_instincts.columns[]`, each `{ instinct, code, naranjo, signature, narrative }`.
**Read at:** [`app/renderer.js:3851`](app/renderer.js:3851) (`.v3-inst-name` ← `c.naranjo`) and
`:3852` (`.v3-inst-sig` ← `c.signature`).

### 3.2 Coverage — **27 of 27, not 3 of 27** `[MEASURED]`

I counted rather than repeating the spec. All 27 `subtype_*` entries carry a non-empty
`instincts_v3.naranjo`, `signature` and `narrative`. Spot values: SO1 `Non-Adaptability · Standards
& Systems`, SP7 `Keepers of the Castle · Abundance & Options`, **SX9 `Fusion · Merging & Intensity`**
— which is exactly the string Cai's decision names.

The three-part convention spec §7.3 describes is also complete `[MEASURED]`: formal name
(`subtype_*.name`, 27/27), nickname (`subtype_*.tagline` prefix, 27/27 — see §5.1), two-word
signature (`instincts_v3.signature`, 27/27).

**Spec §7.3's "Only the three Type 9 subtypes exist" is stale** — PR 4 landed all 27. **This is not a
content blocker and does not belong in the opening paragraph.** Note it for the docs pass alongside
§5.3's two stale lines.

### 3.3 Can p5 read the same source? `[MEASURED]` **Yes. No second lookup path.**

p10's own selection is one line, [`app/renderer.js:3845`](app/renderer.js:3845):

```js
const you = iz.columns.find((c) => c.instinct === dom) || iz.columns[0];
```

`m.pages.v3_instincts.columns` is built for every client on every render, and both `columns` and
`display.instinct_code` are already on the model. p5 repeats that one `.find()`. **Nothing new is
required in `report_prep.js` for the subtype panel.**

`[JUDGMENT]` The `|| iz.columns[0]` fallback is worth *not* copying. On p10 it silently falls back to
SP; on p5 the same fallback would put an SP subtype name beside an SX-badged bar chart. p5 should
throw or blank rather than guess — same reasoning as IO-97 (§4.4).

### 3.4 The type name line — confirmed on the code `[MEASURED]`

The mockup's `.sname` reads **"The One-to-One Nine"**. On the model,
`display.subtype_label` = `"One-to-One Nine"`, built at
[`app/report_prep.js:242`](app/report_prep.js:242) as
`` `${instinctName(instinct)} ${TYPE_WORD[heroN]}` ``. I verified the equality directly:
`"The " + m.display.subtype_label === "The One-to-One Nine"` → **true**.

So the line is `"The " + display.subtype_label`, and the article is the template's, not the data's —
which is the same shape `_v3Title`'s token interpolation already uses. **Confirmed on the code, and
it matches p10's convention.** `display.instinct_label` is the authority for "One-to-One" and is
explicitly never "Sexual" (`report_prep.js:240`).

---

## 4. Collision 2 — where PRIMARY comes from. Decided; pricing the shape.

### 4.1 Is p10's rule factored out? `[MEASURED]` **No. It is inline, and deliberately so.**

[`app/renderer.js:3838-3845`](app/renderer.js:3838) — an IIFE inside `_clv3Instincts`. The comment
immediately above it (`renderer.js:3832`) states the intent:

> Computed **HERE**, from data already on the model, and **NOT from `instinctStack`** — that helper
> is read by live v2 p6 (`renderer.js:2254`), the coach report and the Coach Prep Report, and it
> labels Leading/Supporting/Growing by score alone with no dominant input. **Two ordering rules in
> one module is how the wrong one gets imported.**

So "sourced once" runs into a documented decision to keep it page-local — but note **what** that
decision was against. It was against reusing `instinctStack`, a helper with *different semantics*.
It was not against sharing the p10 rule itself, which did not have a second caller until now.
`[JUDGMENT]` The decision and the goal are compatible; the constraint is that the shared thing must
be a **third, distinctly named** helper, not an overload of `instinctStack` and not a home for both.

### 4.2 What extraction would touch `[MEASURED]`, and the risk to p10

**Files touched:** exactly two, plus tests.

| File | Change |
|---|---|
| `app/renderer.js` (or a small shared module) | new `instinctRanks(dominantCode, instinctBars)` → `{SP\|SO\|SX: 'Primary'\|'Secondary'\|'Tertiary'}`; move the IIFE body into it |
| `app/renderer.js:3838` | replace the IIFE with the call |
| `tests/report_pages_test.js` | direct assertions on the helper, incl. the cases §8.1 shows are unrendered |

**Would the coach byte-diff see it?** `[MEASURED]` **No — and it is structurally blind, not merely
lucky.** `scripts/verify_coach_baseline.js` asserts the **coach** HTML is byte-identical and hashes
the **coach** PDF. `_clv3Instincts` is a client v3 page; the coach report never renders it, and the
v3 shared stylesheet is client-only ([`app/renderer.js:17`](app/renderer.js:17): "client-only; coach
never loads it"). A p10 regression would be invisible there.

**What would catch it** `[MEASURED]`: `scripts/render_client.js`'s p10 assertions — the 27-render
3×9 instinct matrix, the 207.33px column-width and 13px badge-row geometry checks, and the Z6 cap —
plus `tests/report_pages_test.js`'s p10 structural assertions. Those are real and they run in CI as
hard fails. `[JUDGMENT]` **The risk of touching p10 is low and it is well-instrumented**, provided
the extraction is a pure move with no behaviour change and lands in its own commit so the 27-render
matrix is the only thing that has to stay green.

### 4.3 The alternative, and my recommendation

**Alternative — p5 reimplements the rule.** Cost: seven lines duplicated. Divergence risk is
**specific, not abstract** `[JUDGMENT]`: the rule has three independent moving parts (which field
supplies the dominant; the sort key for the remaining two; the tie-break when they are equal), and
the third has no fixture (§8.1) so a divergence there is invisible to CI. The failure mode is p5 and
p10 disagreeing about which instinct is Secondary — inside one PDF, four sheets apart, where nobody
is looking at both at once. That is precisely the class this project has been bitten by twice
(spec §3.4's two invisible CSS collisions).

`[JUDGMENT]` **Recommendation: extract the shared helper.** Reason: the risk is measured-low (§4.2),
the divergence risk is real and CI-invisible, and Cai's stated goal — the two pages cannot disagree —
is only *structurally* guaranteed by one implementation. I am not refuting the framing; the decision
that the pages agree is right and the shared helper is the cheapest way to make it true rather than
maintained.

**One condition.** Name it for what it does (`instinctRanks` / `primarySecondaryTertiary`), put it
where `instinctStack` is **not**, and leave `renderer.js:3828`'s warning in place pointing at both.
The whole hazard that comment describes is a caller importing the wrong one of two similar helpers,
and extraction creates a third.

### 4.4 IO-97 — is p5 more or less exposed than p10? `[JUDGMENT]` **Materially more.**

Not fixing it here, as instructed. Reporting the exposure.

**p10 draws no magnitudes.** `_clv3Instincts` renders a badge (`Primary`/`Secondary`/`Tertiary`), the
naranjo, the signature and a narrative. With a missing or empty profile, IO-97's confident
"Leading = SP" produces a page that is **internally consistent and simply wrong** — nothing on the
sheet contradicts the badge, and a reader cannot tell.

**p5 draws the numbers as lengths.** The instinct panel is three bars whose widths are the scores.
Three failure modes, none of which p10 has:

1. **Empty/missing profile.** `instinctBars` returns three zeros (§1.5) → three zero-width bars, one
   badged Primary. On p10 this is invisible; on p5 it is a visibly broken chart. `[JUDGMENT]` That is
   arguably p5 *helping* — it is the first surface that would show IO-97 to a human.
2. **Dominant disagrees with the top score.** `dominant_instinct_hypothesis` is an **AI judgment
   field** (`server.js:4638`) while the profile is deterministic slider math, and **nothing in the
   codebase reconciles them** — `tests/fixtures/instinct_axis.js:38` states this explicitly. When
   they disagree, p5 renders the **longest bar labelled Secondary** next to a shorter one labelled
   Primary. Self-contradicting, on the page, in front of the client. p10 renders this case without a
   visible tell.
3. **Near-tie at the top.** Two bars within a point or two, one badged Primary, and the client's eye
   resolves the tie the other way. p10 has no equivalent.

**And none of the three has ever been rendered** `[MEASURED]` — §0.5's table shows all six repo
profiles have `dominant == top score` and a ≥18-point primary gap. See §8.1 for what that costs.

---

## 5. Content fields

### 5.1 The subtype one-sentence summary — **does not exist** `[MEASURED]`

**Confirmed absent, and it is on the critical path.** The mockup's `.stxt` is:

> "Peace is achieved through deep, intense connection with a partner, a practice, or a cause you
> care about." — 105 chars, one sentence, **second person**.

The three candidate existing fields, all measured:

| Candidate | Coverage | Shape | Verdict |
|---|---|---|---|
| `instincts_v3.narrative` (p10's) | 27/27 | **360–394 chars**, 3 sentences, third person ("One-to-One Nines find peace through…") | wrong length and person |
| `subtype_*.tagline` suffix | 27/27 | **35–65 chars**, a fragment, impersonal ("peace through merging with a significant other.") | closest in meaning, wrong register and half the length |
| Z3 instinct definitions | 3 | per-instinct, not per-subtype | wrong grain |

**Measured on the mockup's own scaffold** (`.stxt` box, 308px wide, 12.5px/1.5, Chromium 147)
`[MEASURED]`: the mockup's one-liner renders **2 lines**. Dropping the 27 p10 narratives into the
same box renders **7–8 lines** — 5 to 6 lines of overflow, against a `.half` body of 111.5px and a
whole-page headroom of 40.78px (§6.2). At 18.75px per line that is 94–113px of overflow from this
zone alone. **Verbatim reuse is not merely stylistically wrong; it spills the sheet.**

`[JUDGMENT]` **27 strings to author, and they are on the critical path** — but it is not a blank
page. The 27 tagline suffixes are the right *content* at roughly half the length and in the wrong
person; the job is expansion and a person shift, not invention. Budget it as an editing pass over 27
existing 35–65-char clauses, targeting ~100–110 chars each and **bounded in rendered lines, not
characters** (§8.4). One caution `[JUDGMENT]`: the nickname and the clause live in a **single
`tagline` string** joined by an em dash, so extracting the clause needs a split, and Cai's §3
decision drops the nickname half. Authoring the new field standalone is cleaner than deriving it.

### 5.2 The core-motivation line — **exists, 9 of 9** `[MEASURED]`

`content_library.json` → `type_N.description.core_motivation`, present and non-empty for **all
nine** types, 124–164 chars. Checked against existing per-type content before assuming, as asked.

It is very nearly the mockup's copy. Library Type 9:

> "To maintain inner and outer peace, stay connected to others, and avoid the conflict and
> discomfort that come with asserting **their** own priorities."

Mockup p5 leading block:

> "…that come with asserting **your** own priorities."

**Identical but for `their` → `your`.** `[MEASURED]` The alternate block is a looser match — the
mockup's Type 5 line ("…protecting limited inner resources from the demands of others.", 114 chars)
is a shortened rewrite of the library's 155-char version, not a person-shift of it.

**Does the library string fit?** `[MEASURED]` I swept all nine, person-shifted, through the mockup's
`.ptxt` box (316px, 12.5px/1.5): **every one renders exactly 3 lines, 56.25px** — 124 chars and 163
chars alike. The mockup ships 3 and 3. **Zero lines of cost, zero variability across types.**

`[JUDGMENT]` So this zone is solved and safe. The only open item is *how* the person shift happens —
a rendered transform, a second `_v3` field, or a CMS edit. A mechanical `their → your` transform is
tempting and I would not do it: it is a per-string editorial change (some read badly in second
person) and it makes the CMS preview show text the page will not print. Recommend a `_v3` field or
an accepted third-person rendering. This zone's 39-char spread costing **zero** lines is also a
clean local demonstration of §8.4's rule.

### 5.3 The four debrief tips `[MEASURED]`

Decision received: **the mockup copy is final**, ported as rendered, "Ask about the alternate"
always included, no conditional logic. The four strings are at
`docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html:151-156`, two per `.tcol`, each a `<b>`
lead plus a sentence. **Measured: all four render 2 lines** in the mockup's `.ttxt` box (329px),
`.tcol` intrinsic height 87px.

**Both stale spec lines confirmed, noted for the docs pass, not changed here** `[MEASURED]`:

* **§7.2**, bullet 4: "**The four debrief tips (p5)** — explicit placeholders." Superseded — they are
  final copy.
* **§7.3**, bullet 3: "One 'In Your Responses' bullet on p5 — 'Ask about the alternate' — only makes
  sense when a second pattern scored close… or become conditional." Superseded — always included.
  **This line is also wrong on its own terms**: the tip is a *debrief tip*, not an "In Your
  Responses" bullet. "In Your Responses" is the `#FDF3E9` evidence block (spec §5.2), which does not
  appear on p5 at all. Worth correcting in the same pass so a reader does not go looking for a zone
  that is not there.

Add **§7.3 bullet 2** to that docs pass — the "only the three Type 9 subtypes exist" line refuted in
§3.2.

### 5.4 CMS-editability of each field `[MEASURED]`

From the registry at [`app/server.js:13900`](app/server.js:13900) `cmsPreviewSpec`. **IO-92 not
scoped here — state only.**

| Field | CMS key | Editable? | Preview renders |
|---|---|---|---|
| naranjo / signature / narrative | `subtype_<i><n>.instincts_v3` | **yes** | **v3** p10 (`doc:'v3'`) |
| subtype nickname + clause | `subtype_<i><n>.tagline` | **yes** | **v2** p6 (`.p6-page`) |
| core motivation | `type_N.description` | **yes** | **v2** p3 (`.p3-page`) |
| subtype one-sentence summary | — | **does not exist** | — |
| the four debrief tips | — | **no key** | — |
| instinct definitions (v3) | `static.instinct_definitions_v3` | **yes** | **v3** p10 (`doc:'v3'`) |

**Would a new `_v3` field be CMS-editable? Yes, and the pattern is already established.** `[MEASURED]`
`static.instinct_definitions_v3` is the worked example: a `doc:'v3'` flag on the registry entry plus
a `:has()`-scoped page selector. The comment at `server.js:13918` states the design — a flag on the
entry, "no naming convention to remember and no regex to keep in step."

**Two state observations worth recording against IO-92** `[JUDGMENT]`:

1. **Two fields p5 would use preview the wrong document.** `subtype_*.tagline` and
   `type_N.description` both point at v2 pages. An editor changing a core motivation for p5 would see
   it previewed on the v2 p3 — the confidently-wrong preview `server.js:14016` says the p10 work
   exists to avoid.
2. **`cmsPreviewApiResult` cannot render a p5 heat map.** It emits a 2-entry `call1_ranking` and no
   `type_score_profile` at all (§1.4 item 3).

---

## 6. The reference implementation

### 6.1 Do we have it? **Yes.** `[MEASURED]`

`docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html` — 165 lines, tracked, named as sheet 5 in
`docs/mockup_file_manifest.md`, and already referenced by path in
`scripts/verify_transparency.js:22`. All twelve reference implementations are present. See §0.1.

### 6.2 The page as it actually is

All figures below `[MEASURED]` in Chromium 147.0.7727.57 at an 816×1056 viewport, print media, the
file loaded from disk.

**Zone order and geometry** (offsets from the `.page` top; padding 40px top/bottom, 53px sides):

| # | Zone | Top | Bottom | Height |
|---|---|---|---|---|
| 1 | `.page-header` | 40.00 | 51.00 | 11.00 |
| 2 | `.header-rule` | 61.00 | 62.00 | 1.00 |
| 3 | `.eyebrow` "Your Report at a Glance" | 84.00 | 96.00 | 12.00 |
| 4 | `h1` "Quick Reference" | 104.00 | 132.00 | 28.00 |
| 5 | `.lead` | 144.00 | 187.38 | 43.38 |
| 6 | `h2` "How the Nine Patterns Scored" | 211.38 | 229.38 | 18.00 |
| 7 | `.chart` (heat map + two hypothesis blocks) | 239.38 | 592.38 | **353.00** |
| 8 | `.note` (leading/alternate sentence) | 604.38 | 637.72 | 33.34 |
| 9 | `.two` (instincts panel ∥ subtype panel) | 655.72 | 799.22 | 143.50 |
| 10 | `.tips` (h2 + 2×2 debrief grid) | 829.22 | 944.22 | 115.00 |
| — | `.page-footer` (pushed by `margin-top:auto`) | 996.00 | 1016.00 | 20.00 |

**Height against the 976px budget, both bases stated.** The footer block occupies 31.00px
(1px border-top + 10px padding-top + 20px content). Content stack 40.00 → 944.22 = **904.22px**.

* **Used:** 904.22 + 31.00 = **935.22px of the 976px content budget**
* **Headroom, 1056 basis:** 976 − 935.22 = **40.78px**
* **Headroom, gate basis:** `render_client.js` fails on `height > PAGE_PX + 1` = **> 1057** `[MEASURED]`,
  so **41.78px**

The two differ by exactly 1px, as the prompt anticipated. **Quote the 40.78px figure**; it is the one
that leaves a margin if the gate is ever tightened.

`[JUDGMENT]` **40.78px is about two rendered lines.** This is a tight page before any per-client
variation, and it is the mockup's *own* content — one line more in the subtype summary, or one more
in the alternate note, and it spills. §8.3's probe is not optional here.

**CSS classes and the generic-name collisions.** The file defines **60 selectors** and uses **40
classes** `[MEASURED]`. Colliding with names owned elsewhere in shipped v3 code:

| p5 class | Owned by | The hazard, measured |
|---|---|---|
| `.lead` | shared sheet, `client_report_v3_styles.js:129` | **The live one.** The shared `.lead` has **no default margin** — ":128 `/* No default — always a modifier. */`". The mockup's `.lead` bakes in `margin-bottom:24px`. A verbatim `class="lead"` port renders **24px shorter** with the lead butting the `h2`. Correct port: `class="lead is-loose"` (24px). |
| `.note` | shared sheet, `:140` | Shared `.note` has **no margin at all**; the mockup's has `margin-top:14px` **plus an inline `style="margin:-6px 0 18px 0"` override**. Spacing must be supplied explicitly; the negative top margin is a mockup hack and should become a modifier, not survive as an inline style. |
| `.eyebrow` | shared sheet, `:118` | Owned, four modifiers. Mockup's 8px = the shared default. |
| `.page`, `.page-header`, `.page-footer`, `.header-rule`, `.header-left/right/client` | shared sheet | Chrome; `_v3Header`/`_v3Footer` emit them. Do not re-declare. |
| `.chart` | **`renderer.js` markup** (live v2 page) | Must be namespaced. |
| `.two` | **`renderer.js` markup** (live v2 page) | Must be namespaced. |
| `.sub` | shared sheet, `:136` | **Declared in the mockup but never used** — no collision in practice. |

**The two collisions spec §3.4 says "bit twice during design" are both in this file, and both are
already fixed in the tracked copy** `[MEASURED]`: the mockup uses `class="hhd is-sub"` and
`class="hhd is-sys"`, not `hhd sub`. `client_report_v3_styles.js:43` says exactly this. The `krow`
half is moot — see below.

**Twenty dead selectors in the reference implementation** `[MEASURED]`:
`band bbody bhead blbl bname bnum is-alt is-lead kname knum krow kval rfill rname rnum row rtrack rval sub top`.
`[JUDGMENT]` These are the fossil of the removed numeric chart: `.krow`/`.kval`/`.knum`/`.kname` are
a ranked list with a value column, `.row`/`.rtrack`/`.rfill`/`.rval` a numeric bar chart, `.is-lead`/
`.is-alt` its highlight states. **The mockup file is itself the evidence for spec §8.5's claim that
numeric values were deliberately removed** — the layout that showed them is still in the stylesheet
with nothing rendering it. Do not port them.

### 6.3 §4.3 versus the reference implementation — **§4.3 describes an earlier mockup. Confirmed.**

Confirmed on the **HTML**, which is stronger than the PDF read, since node positions are literal
attributes `[MEASURED]`:

* **Nine nodes present, node 2 included.** Twelve `<circle>` elements: the outer ring (r=105), nine
  node circles (r=21) and two decorative rings (r=27). Node 2 is at `cx=283.4 cy=131.8`.
* **Clockwise, not mirrored.** 9 at top (180, 45), then 1 (247.5, 69.6), 2 (283.4, 131.8),
  3 (270.9, 202.5), 4 (215.9, 248.7), 5 (144.1, 248.7), 6 (89.1, 202.5), 7 (76.6, 131.8),
  8 (112.5, 69.6). **Clockwise 9-1-2-3-4-5-6-7-8**, matching `CLIENT_ANGLES`.
* **SX, not SP.** The instinct panel marks the `SX` row `.irow.pri` with the `Primary` rank; SP and
  SO read Secondary and Tertiary. Bar widths 66/64/84 match the coach report's SP 66 / SO 64 / SX 84.
* **The subtype panel reads "The One-to-One Nine"**, not "The Self-Preservation Nine".

**Verdict:** §4.3's two specific charges — mirrored/missing node 2, and SP9 throughout — are **both
false of `AtAGlance_v1.html`**. `[JUDGMENT]` §4.3 is describing an earlier draft, exactly as §6.3
proposes. It should be dated and scoped to that draft rather than left standing as a blanket
"anything sourced from v3 must be verified", which currently reads as a warning against the file
PR 5 is supposed to port from.

**Two caveats, so this is not read as blanket exoneration** `[MEASURED]`:

1. **The mockup's client data is synthetic.** `docs/mockup_file_manifest.md` lists Anders's type
   scores as 9:90 · 5:85 · 1:75 · 8:55 · 3:50 · 2:48 · 7:42 · 4:40 · 6:35. The tracked fixture
   `anders_sx9_api_result.json` has **91 · 83 · 74 · 52 · 47 · 44 · 38 · 35 · 31**. Same ordering,
   different numbers. The mockup's `fill-opacity` values were computed from numbers that are not in
   the fixture, so a port with real data will not reproduce them and **that is not a regression**.
2. **§4.3 is right about one thing that still bites**: the mockup's `.stag` reads "The Seeker ·
   Merging & Intensity", and Cai's §3 decision drops that nickname. So the file is canon for the page
   *except* one naming line (as stated) *and* the fill mechanism (§0.6) *and* its score data.

---

## 7. Geometry, gates, and the two diagram cards

### 7.1 IO-75 — re-measured

See §0.4 for the table, the method, the counting basis, and the accept-and-assert recommendation.
Current delta **2.3433%** against the 1.9643% of 11 Aug.

### 7.2 IO-70 — p5's actual geometry, measured

**The p5 symbol is a fourth client geometry and shares nothing with the gated pair.** `[MEASURED]`

| | wings/lines (gated) | p5 mockup |
|---|---|---|
| viewBox | 430 × 252 | **360 × 352** |
| circle radius R | 95 | **105** |
| node radius | 15 / 13 / 11 | **21 (all nine)** |
| decorative rings | none | **r=27**, one solid (leading), one dashed `4,3` (alternate) |
| rendered | 378 × 222 | **322 × 315**, uniform scale **0.894444** |
| text elements | up to 54 across 18 diagrams | **13** — nine numerals, 2 labels, 2 legend captions |

**I applied `verify_diagrams.js`'s rules verbatim to the mockup SVG.** Results, in viewBox units
with rendered px in brackets `[MEASURED]`:

| Check | Result |
|---|---|
| **Edge clearance (5px rule)** | **FAIL — "LEADING" at 1.17 (1.05px rendered)** |
| Min text-to-text gap, all 13 boxes | 24.81 (22.19px), tightest pair `"5"` / `"ALTERNATE"` |
| Min label-to-label gap, numerals excluded (4 boxes) | 46.98 (42.02px), `"ALTERNATE"` / `"Less like you"` |
| Label → nearest node/ring | LEADING 6.77 (6.06px) to the r=27 ring; ALTERNATE 7.17 (6.41px) |
| **`nodeCircles` after the `r <= 20` filter** | **0 of 12 — the label-vs-node check would be VACUOUS** |

Three findings:

1. **The mockup fails the existing 5px edge rule by a wide margin.** "LEADING" sits 1.17 viewBox px
   (1.05 rendered px) from the canvas top. Porting the SVG verbatim and adding the variant to
   `VARIANTS` turns CI red immediately. The fix is trivial — grow the viewBox height or lower the
   ring — but it must be a deliberate step, not a surprise.
2. **`verify_diagrams.js`'s `r <= 20` node filter is tuned to the 430×252 geometry** (radii 15/13/11)
   and **excludes every circle on p5** (r = 21, 27, 105). Adding p5 to `VARIANTS` without changing
   that filter yields a check that **passes because it tests nothing**. That is a gate that does not
   gate — a real one, and it is the fix p5 must land alongside the variant. `[JUDGMENT]` Replace the
   magic number with an explicit set: nodes are the circles the builder marks as nodes, not the ones
   under an arbitrary radius.
3. **Label separation is the wrong gate for this diagram.** Four non-numeral labels, two of them at
   opposite ends of the canvas; the minimum label-to-label gap is **46.98 (42.02px)**, nearly double
   the wings/lines 24.12px. Nothing here crowds anything. **The binding constraints on p5 are edge
   clearance and label-to-node clearance**, and the mockup fails the first.

**Proposed floor, and what it derives from** `[JUDGMENT]`:

* **Do not carry 27.7px across.** It was retracted (§0.3) and it is not p5's binding constraint.
* **Edge clearance: keep the existing 5px**, unchanged, applied to p5 — and fix the mockup to meet
  it. Derived from: the rule already in `verify_diagrams.js:33`, already met at 5.47px on 18
  diagrams, and currently failed by p5 at 1.17. One rule across all diagrams beats a per-page floor.
* **Label-to-node clearance: propose 5px**, same value, same reason. Measured p5 headroom **6.06px**
  (LEADING) and **6.41px** (ALTERNATE) — thin but passing, and directly comparable to wings/lines'
  5.47px. This is the check `r <= 20` currently disables.
* **Label-to-label: assert non-overlap only**, exactly as the spec's corrected §3.5 already prescribes. If a
  numeric floor is ever wanted, p5's measured baseline is **24.81** counting numerals, **46.98**
  excluding them — and the two must not be conflated, which is arguably how 27.7 was born.

### 7.3 Ringed node, dashed node, ramp legend — **all new** `[MEASURED]`

~~`buildEnneagramSVG` has five variants: `base`, `type`, `my-report`, `wings-lines` (v2), and four v3
ones — `client-cover` (`COVER_GEO`), `client-whatis` (`WHATIS_GEO`), `client-explore`
(`EXPLORE_GEO`), `client-wings`/`client-lines` (`CLIENT_GEO`).~~ **None supports any of the three.**

> **Post-lock correction — 8 Sep 2026. NINE, NOT FIVE.** The list above is right and the count is
> wrong — it says "five" and then names four v2 plus four v3 groups. Enumerated by calling the
> function `[MEASURED]`: **`base`, `type`, `my-report`, `wings-lines`, `client-cover`,
> `client-whatis`, `client-explore`, `client-wings`, `client-lines`** — nine accepted, and an
> unknown variant throws. **PR 5 Build 2 makes it ten**, adding `client-quickref`.
>
> The sentence the strikethrough leaves standing — none of them supports a ringed node, a dashed
> node or a ramp legend — was and is correct.

| p5 feature | Nearest existing | Gap |
|---|---|---|
| Per-node fill graded by score | none — every variant fills by role (home/wing/stress) | **new**: a score→colour ramp |
| Solid outer ring (leading) | `client-explore` grows the home node and fills it (`homeRNode` 16) | **new**: a concentric ring is a second circle |
| Dashed outer ring (alternate) | none — no variant emits `stroke-dasharray` on a node | **new** |
| `LEADING` / `ALTERNATE` text | `client-wings`/`client-lines` place labels | placement logic exists, **these strings and positions are new** |
| Horizontal ramp legend + captions | none — no variant emits a `<rect>` or a gradient | **new** |

`[JUDGMENT]` The **mechanism** is cheap even though every feature is new: `_wheelNodes(C)` already
derives node positions from any geometry constant and `CLIENT_ANGLES`, so a `QUICKREF_GEO` sits
beside the existing three with no new maths and all four figures stay angle-consistent by
construction. The work is a new geometry constant, a new variant branch, an **opaque** ramp function
(§7.4), and the gate changes in §7.2 — not a rewrite.

**One structural finding, in passing** `[MEASURED]`: **`client-explore` (p6's wheel) appears zero
times in `verify_diagrams.js`.** `VARIANTS` covers wings/lines; the structural wheel check at
`:116` covers `client-cover` and `client-whatis`. The p6 wheel is in neither list and is **ungated
today**. Not PR 5's to fix, but it means "add p5 to the gate" should be "add the two missing v3
variants to the gate", and the same `r <= 20` filter bug applies to p6's `rNode` 12.5 / `homeRNode`
16 (the home node is already excluded there too).

### 7.4 Transparency — **the gate exists, runs against client output, and would catch this** `[MEASURED]`

Confirmed on all four counts, by running it rather than reading it:

1. **It exists**: `scripts/verify_transparency.js`, scanning for `/Group << /S /Transparency`,
   `/SMask` (non-`/None`), `/ca`|`/CA` < 1, and non-normal `/BM`, with object streams inflated first.
2. **It runs against client output**: `:146-147` renders
   `R.buildClientReportHTML_v3(buildClientModel(anders_sx9))` — **the whole v3 document**. Once
   `quickref` carries `built: true`, p5 is inside that PDF automatically. No gate change needed.
3. **It is a CI hard fail**: `.github/workflows/report-verify.yml`, step "Transparency gate".
4. **It would catch a verbatim port.** I rendered `AtAGlance_v1.html` through the pinned Chromium and
   ran the gate's own scanner over the result: **1 transparency group, 1 soft mask, 8 non-opaque
   alphas** — tripping three of the four assertions independently. Current run on `main`: **0 / 0 /
   0 / 0**, and the positive control fires (`groups 1 · masks 1 · alpha<1 1` on the known-bad cover).

**This is not the sixth gate that does not gate.** `[JUDGMENT]` It is the best-instrumented gate in
the repo, it names this exact file and this exact hazard in its own header, and it has a positive
control so it cannot silently stop working.

**Two limits worth stating** `[JUDGMENT]`: it renders **one fixture at one type**, so it proves the
*shipped* SVG is opaque, not that every code path is; and it scans the PDF, so a violation is caught
after render rather than at authoring time. Neither weakens it for p5 — an opacity violation in a
ramp function is type-independent — but "green" means "the anders_sx9 render is clean", not "the
renderer cannot emit alpha".

### 7.5 The ramp must stay non-orange `[MEASURED]` — **nothing asserts this today**

`grep -rn "F68625" scripts/ tests/` → **zero hits**. No test, gate or harness asserts any colour
token anywhere. Colour regressions are caught only indirectly, by
`verify_coach_baseline.js`'s normalised **coach** PDF hash — which does not cover client pages
(§4.2). **The client report has no colour assertion at all.**

The mockup itself is compliant `[MEASURED]`: the ramp gradient runs `#00B2D9 → #00B2D9`, every node
fill is `#00B2D9`, and the only orange on the page is `#F68625` / `#F5D2AC` on the instinct bars and
`#F9E7D2` / `#C2650F` on the subtype panel header.

**But there is a spec collision to surface.** `[JUDGMENT]` Spec §5.3 states orange appears in
**exactly four places**: the client's name in every page header, the cover identifier, the subtype
identifier and column, and the "In Your Responses" block. **The p5 instinct bars are a fifth**, and
§5.3 says the rule "must not be diluted". The prompt's §7.5 asserts that on p5 orange "belongs to the
instinct bars alone" — which is a **new allocation**, not a restatement of §5.3. The subtype panel
header is covered by the existing "subtype identifier" clause; the bars are not. This wants Cai and
Mo's ratification and a §5.3 amendment, not a build-time assumption.

`[JUDGMENT]` If an assertion is wanted, the cheap and durable one is not "the ramp is not orange" but
**"no `#F68625` appears inside the heat-map SVG"** — a substring check on `buildEnneagramSVG`'s
output for the quickref variant, which costs nothing, cannot false-positive on the legitimate bar
usage elsewhere on the page, and is the check that would actually have caught a ramp built by
copy-pasting the instinct bar's fill.

### 7.6 The page-count tripwire `[MEASURED]`

**`tests/lib/report_page_inventory.js:47` — confirmed, exactly as the prompt states.**

```js
client_v3: { 'v3-page': 10 },   // PR 4 step 5A adds p10 Instincts & Subtypes (sheet 10)
```

Current value **10**. It went 9 → 10 at PR 4 step 5A. **Sheet 5 takes it to 11.** The comment at
`:35-47` is explicit that it is hand-maintained on purpose and must not be derived from
`V3_PAGE_ORDER` — deriving it would make the suite agree with itself.

`quickref` is in `V3_PAGE_ORDER` at [`app/renderer.js:3153`](app/renderer.js:3153) with
`sheet: 5, footer: 3` and **no `built` flag** `[MEASURED]`, so `v3PagesFor()` excludes it and the
document emits 10 pages today — confirmed by rendering (cover, contents, welcome, whatis, typeA,
typeB, wings, lines, instincts, thoughts).

---

## 8. Fixtures and the probe

### 8.1 IO-64 against the existing fixtures — checked before authoring `[MEASURED]`

Full table in §0.5. Summary against the requirement:

| IO-64 case | Instinct axis | Covered by |
|---|---|---|
| **Clear leader** | ✅ **six times over** | all three fixtures + all three axis profiles; min gap 1→2 is **18** |
| **Near-tie at 1↔2** (which instinct is Primary) | ❌ **not covered at all** | nothing; the smallest gap in the repo is 18 |
| Near-tie at 2↔3 (which is Secondary) | ✅ | `anders_sx9` and all three axis profiles, at 2 points |
| Exact three-way tie | ✅ model-level only | `STACK_EDGE_CASES.exact_tie` {70,70,70} |
| Missing profile | ✅ model-level only | `STACK_EDGE_CASES.missing_profile` |
| **`dominant` disagrees with top score** | ❌ **never rendered** | all six agree |

**What is genuinely missing: two cases, both about the top of the stack.** `[JUDGMENT]`

1. **A near-tie at the primary boundary** — e.g. `{SP: 71, SO: 69, SX: 44}` with `dominant: 'SP'`.
   Proves p5's bars stay legible and the badge stays readable when two bars are 2px apart.
2. **A `dominant` that is not the top score** — e.g. `{SP: 44, SO: 61, SX: 79}` with `dominant: 'SP'`.
   This is the visible-contradiction case of §4.4, it is reachable in production (an AI judgment
   field against deterministic math, with nothing reconciling them), and **no fixture has ever
   rendered it.** `[JUDGMENT]` This is the highest-value new fixture on the page, and it is one entry
   in the existing `INSTINCT_PROFILES` map — the mechanism (`applyInstinct`) already exists and both
   the harness and the test read it.

**Note the retirement precedent still holds.** The synthetic `wide_gap` was retired *by evidence*
because the axis already covered separation. That reasoning was correct and is exactly why these two
are needed: it is the *tie at the top* the evidence does not cover.

### 8.2 Nine-score fixtures — the type axis `[MEASURED]`

**Yes — three fixtures carry a full nine-score profile**, and the shape is uniform:

| Fixture | `type_score_profile` | Keys | min–max | spread | gap 1→2 |
|---|---|---|---|---|---|
| `anders_sx9` | `{"1":74,"2":44,…,"9":91}` | 9 | 31–91 | 60 | 8 |
| `sp4` | `{"1":57,…,"9":45}` | 9 | 38–79 | 41 | 18 |
| `sx7` | `{"1":40,…,"9":42}` | 9 | 38–80 | 42 | 22 |

Shape: object keyed by **string** `"1"`…`"9"`, values numbers, all nine keys always present.

**Against IO-64's two cases on the TYPE axis** `[JUDGMENT]`:

* **Clear leader: covered** — `sx7` at a 22-point gap, `sp4` at 18.
* **Near-tie: covered, and it is `anders_sx9`** — an 8-point gap between T9 91 and T5 83, which is
  precisely what the mockup's "Type 5 scored close behind" sentence is written for.

**Three gaps that are not about near-ties** `[JUDGMENT]`:

1. **No flat profile.** The tightest spread is 41 points. A client scoring 48–52 across all nine is
   the case that exposes §2.2's normalisation defect, and nothing in the repo produces it.
2. **All values are integers.** Production values land on `.0/.2/.4/.6/.8` (§1.1). A ramp function
   that quietly assumes integers passes every fixture.
3. **No fixture where `type_score_profile` #2 ≠ `alternate_candidate`… except `sp4`, which has one
   and nobody is asserting on it** (§1.4). `sp4` is already in `render_client.js`'s fixture list. It
   is the regression case for §1.4's decision, free.

### 8.3 The probe — proposed, as its own step

`[JUDGMENT]` PR 4's step 3 turned a page spilling for all nine types into one that fits, by measuring
before the page existed. This page needs it more: **40.78px of headroom** (§6.2) on the mockup's own
content, and more per-client variety than any other sheet.

**Scaffold.** Not a new HTML file. Use the tracked `AtAGlance_v1.html`, loaded from disk and
DOM-manipulated in Chromium — the technique this audit used for §5.1, §5.2 and §6.2. It is the real
grid at the real widths (`.ptxt` 316px, `.stxt` 308px, `.ttxt` 329px, all measured), it needs no
renderer, and it costs one browser launch. Swap the mockup's chrome spacing to the shared sheet's
modifiers first, so the measurements are against what will ship (§6.2 records a 4px difference at the
eyebrow between the mockup's `header-rule` 22px and p10's 26px).

**What it must measure, and what would falsify each:**

| # | Measurement | Falsified by |
|---|---|---|
| P1 | `.stxt` rendered lines for 27 candidate one-sentence summaries | any subtype exceeding the line budget P4 sets |
| P2 | `.ptxt` rendered lines for 9 leading × 9 alternate motivation strings | any pair exceeding 3+3 lines (**already measured: all nine are 3 lines** — P2 is a regression guard, not an open question) |
| P3 | `.note` rendered lines across near-tie and clear-leader phrasings | the alternate sentence exceeding 2 lines |
| P4 | Whole-page intrinsic height for the **worst composite** — longest subtype summary × longest motivations × longest note | intrinsic height > 1015.22px, i.e. any composite eating the 40.78px |
| P5 | `.half` **intrinsic** heights, both panels, measured per §8.5 | either panel's content exceeding the 111.5px body |
| P6 | Heat-map SVG geometry under both ramp formulas (§2.2) at the flat, spread and extreme profiles | edge clearance < 5px or any label-node overlap (§7.2) |
| P7 | Node fill values for a flat profile under both formulas | min–max producing a full-range ramp from a 4-point spread — **expected to falsify min–max, which is the point** |

**What it must answer before a build step is written:**

1. What is the rendered-line budget for the subtype summary, given the worst composite? (Sets the
   authoring brief for the 27 strings — §5.1.)
2. Does the worst composite fit in 976px, and with how much margin?
3. Which ramp formula ships? (P6/P7 turn §2.2 from a judgment into a measurement.)
4. Does the p5 SVG geometry meet 5px edge clearance after the mockup's LEADING label is fixed?

**Budget it as its own step, before any content authoring and before the renderer.** `[JUDGMENT]`
P1 and P4 gate the content brief; shipping the renderer first means authoring 27 strings against a
budget nobody has measured.

### 8.4 No new character ceiling `[MEASURED]` — and this page proves the rule twice

Agreed and adopted. This audit generated two fresh confirmations on the p5 scaffold itself:

* **The nine core motivations span 124–163 chars (a 39-char, 31% spread) and every one renders
  exactly 3 lines.** A character ceiling here would be pure noise.
* Conversely, the mockup's 105-char `.stxt` renders 2 lines while the 360–394-char p10 narratives
  render 7–8 — a 3.5× char ratio producing a 4× line ratio, i.e. not even proportional.

**No character ceiling is published anywhere in this document.** Every content bound proposed
(§5.1, §8.3 P1–P4) is expressed in **rendered lines** and derived from the probe.

### 8.5 Intrinsic height, not the flex box — **the trap is live on this page, measured** `[MEASURED]`

Confirmed on the mockup, not assumed. `.two` is `display:flex`; `.half` is `flex:1`; `.hbd` is
`flex:1` inside it:

| Panel | `.half` height | `.hbd` height | **sum of `.hbd` children** |
|---|---|---|---|
| Your Instincts Priority | **143.50** | 111.50 | **42.00** |
| Your Subtype | **143.50** | 111.50 | **68.50** |

**Both panels report 143.50px against 26.50px of genuinely different content.** Reading `.half` (or
`.hbd`) would report the two columns as identical, which is exactly the `.ccard` failure. `.tcol`
in the debrief grid has the same shape (both 87px) and is currently non-diagnostic only because its
content happens to match.

**How this audit avoided it, and what the probe must do** `[JUDGMENT]`:

1. **Never measure a flex child's box.** Sum the bounding rects of the content children
   (`[...bd.children].reduce(...)`) — the column that produced the 42.00 / 68.50 split above.
2. **Count rendered lines with a `Range`**, not heights: `range.selectNodeContents(el)`, take
   `getClientRects()`, filter `height > 1`, count distinct rounded `top` values. Immune to flex
   stretch, and it is the unit §8.4 requires. This is what produced every line count in §5.1, §5.2
   and §5.3.
3. **For the page total, measure the intrinsic stack, not `.page`.** `.page` is
   `min-height:1056px`, so it reports 1056 whatever it contains. §6.2's 1015.22px is
   `40 + (last content bottom − 40) + 31 + 40`, with the footer's `margin-top:auto` excluded from the
   content span. `render_client.js`'s existing `measureLayout` already does the equivalent for
   `.v3-page`; the probe should reuse it rather than reinvent it.

---

## 9. Named, not scoped

**IO-93 — nothing detects a spilled client report in production.** `[MEASURED]` **Confirmed, and the
card needs re-citing.** The production emitter is [`app/server.js:5065`](app/server.js:5065) — a bare
`await page.pdf({ path: filePath, ...pdfOptions })` with no height measurement. `PAGE_PX` and the
`height > PAGE_PX + 1` gate exist only in `scripts/render_client.js`, reached via
`npm run verify:render` in CI. The card's cited evidence, `generate_report.js:588`, is inside the
dead beta path (§0.2). **Substance right, citation wrong.** Quick Reference does have the most
exposure — 40.78px headroom, the most per-client variety in the document — but the fix is not PR 5's.

**IO-92 — CMS coverage.** State reported in §5.4. Two facts against the card: two fields p5 needs
(`subtype_*.tagline`, `type_N.description`) preview the **v2** document; and `cmsPreviewApiResult`
cannot render a heat map. Not scoped here.

**IO-95 — p10's unisolated 6.00px offset. Can I confirm cheaply whether it lands on p5?**
`[MEASURED]` **Yes, and the answer is no — not through the shared chrome.** From the chrome
measurement I was already taking for §6.2, across all ten built v3 pages **and** the p5 mockup:
`.page-header` is **40.00 → 51.00** and `.header-rule` is **61.00 → 62.00** on **every one of the
eleven**. Byte-identical. The header band above the rule cannot be the source of a page-invariant
6.00px, and p5 will not inherit it from there.

Below the rule, spacing is per-page modifier choice, not shared chrome: `.header-rule` has four
modifiers (18/22/26/28) and **no default**, and p10 uses `is-loose` (26px) where the p5 mockup bakes
22px — a **4px** difference, not 6, and a deliberate per-page choice rather than drift. **A
modifier choice cannot produce a constant that is invariant across pages, so this does not isolate
the 6.00px either.** Stopping here as instructed: the offset remains unisolated, and the only thing
newly established is that the shared header chrome is not where it lives.

**IO-97 — `instinctStack`'s confident "Leading = SP".** Not fixed here. Exposure analysis in §4.4:
**p5 is materially more exposed than p10**, because p5 draws magnitudes and p10 draws only badges.
Fixture gap in §8.1.

**IO-98 — the Contents page asserts against `V3_PAGE_ORDER`, not emitted pages.** `[MEASURED]`
Confirmed: `quickref` and `car` are the two entries without `built` flags, so building sheet 5
removes one phantom and the symptom halves. **The wrong assertion basis is untouched by that.** PR 5
should not be credited with fixing IO-98, and its build report should say so explicitly — a
half-disappeared symptom is the most likely way this card gets closed by accident.

---

## 10. Proposed PR 5 step sequence

`[JUDGMENT]` Seven steps. Each states what it measures and what falsifies it. The probe is step 2 —
before content and before the renderer, because both depend on its output.

| Step | What it does | What it measures | Falsified by |
|---|---|---|---|
| **1. The data decision** | Ratify `type_score_profile` vs `call1_ranking` (§1.4) and the ramp basis (§2.2). Doc-only; no code. | Nothing new — reads §1.4 and §2.2 | A production query showing `type_score_profile` absent or short on real rows. **Run that query in this step**; §2.1's range is fixture-only. |
| **2. THE PROBE** | Measure on the `AtAGlance_v1.html` scaffold, per §8.3. | P1–P7 | Worst composite > 1015.22px intrinsic; or min–max surviving the flat-profile test |
| **3. Expose the nine scores** | `report_prep.js:261` + a `typeScoreRamp` helper + `validateModel` assertions (§1.4 items 1–2) | Model shape: nine numeric entries, leading/alternate present | RED-first: assert `charts.types` before it exists, watch it fail, then build |
| **4. Content** | Author 27 one-sentence subtype summaries to step 2's **line** budget; settle the motivation person-shift (§5.2) | Rendered lines per string on the step-2 scaffold | Any string over budget; any type's motivation exceeding 3 lines |
| **5. The diagram** | `QUICKREF_GEO` + variant; **opaque** ramp and legend (§0.6); raise the LEADING label to clear 5px; add p5 **and `client-explore`** to `verify_diagrams.js`; fix the `r <= 20` filter (§7.2) | Edge clearance ≥ 5px, label-node ≥ 5px, non-overlap, across 9 types | Any clearance < 5px; **or the node filter yielding 0 circles — assert the count, or the gate is vacuous** |
| **6. The page** | Renderer, `built: true`, tripwire 47 → 11, single-sheet across 9 types × the instinct axis | Per-type page height vs the 1057 gate; per-zone intrinsic heights per §8.5 | Any type spilling; any zone exceeding step 2's declared budget |
| **7. Gates and fixtures** | The two §8.1 fixtures (near-tie at 1↔2; dominant ≠ top score); nine scores into `cmsPreviewApiResult`; the non-orange-ramp check (§7.5) | Both hazard cases render; CMS preview draws 9 nodes | Either fixture producing a self-contradicting page — **which is a finding for IO-97, not a step-7 failure** |

Steps 3 and 5 are independent and can run in parallel after step 2. Step 4 cannot start before
step 2 delivers P1.

---

## 11. Framings I would refute

Requested explicitly. Six, each with the measured reason.

1. **"Trace … through to `generate_report.js`."** (§1.2) — Refuted. It is the retired beta report and
   says so in its own comment. The path is `server.js:5320 → render_report.js:23 → report_prep.js →
   renderer.js`. **This also invalidates IO-93's citation.** §0.2.
2. **"The project workspace holds … only two older .html files."** (§6.1) — Refuted. All twelve are
   tracked; the Quick Reference is `AtAGlance_v1.html`. PR 5 is an HTML port. §0.1.
3. **"Spec §3.5 records a minimum label-to-label gap of 27.7px, verified…"** (§7.2) — Refuted. The
   sentence is struck out in the tracked spec and retracted on four counts. And on p5 the measured
   label-to-label minimum is **46.98** — nearly double — so it is not the binding constraint anyway.
   §0.3, §7.2.
4. **"Spec §7.3 says the three-part naming convention exists only for Type 9. Count what is actually
   there… If it is 3 of 27, that is a content blocker."** (§3.2) — Refuted. **27 of 27.** Not a
   blocker, and does not belong in the opening paragraph. §3.2.
5. **"PR 4's instinct axis may ALREADY SATISFY PART OF this."** (§8.1) — Refuted, and the fixture file
   says so itself. Every profile in the repo has a ≥18-point primary gap; the near-tie IO-64 wants,
   at the 1↔2 boundary, is covered **zero** times. §0.5, §8.1.
6. **"The mockup is canon for this page in every respect EXCEPT this line."** (§3) — Refuted, one
   exception short. The SVG's `fill-opacity` and `stop-opacity` violate spec §3.2 and §7.4's own
   locked decision — measured at 1 group / 1 mask / 8 alphas. It is also not canon for the client's
   *scores*, which differ from the tracked fixture. §0.6, §6.3.

And one I **would not** refute, though it looked like a candidate: **§7.6's `report_page_inventory.js:47`
is exactly right** — line 47, value 10, going to 11. I checked it because the surrounding line numbers
in this prompt have drifted elsewhere; this one has not.

---

# Addendum — content sources and the reopened P2

**Appended 8 Sep 2026.** Same branch, same document, one record. `main` and `origin/main` both at
`f385c9a` at the time of the pull — **the tree was already current, nothing came down**. Branch head
before this addendum: `8e553e4`.

**Measurement only. No code and no content changed.** Same tagging convention as the audit above.
**No character ceilings** — every content bound below is in rendered lines.

---

## 12. Lead — what is wrong

### 12.1 The nine strings are in the repo. They already ship on sheet 6. `[MEASURED]`

§2 of the addendum prompt says the nine v3 second-person core motivations "are not in the repo."
**All nine are in `app/content/content_library.json`**, at
**`type_N.explore_v3.p6.core_motivation`**, and I verified every one **byte-identical** to the
prompt's transcription:

| Type | Repo value at `explore_v3.p6.core_motivation` | ch | identical to prompt |
|---|---|---|---|
| 1 | To reform, improve, and hold the line on your standards. | 56 | ✅ |
| 2 | To be loved, connected, and indispensable to the people that matter to you. | 75 | ✅ |
| 3 | To be recognized, respected, and admired for getting things done and achieving your goals. | 90 | ✅ |
| 4 | To feel significant and authentic, express your uniqueness, and experience real emotional depth. | 96 | ✅ |
| 5 | To guard your inner resources, be competent, and maintain your self-sufficiency. | 80 | ✅ |
| 6 | To feel safe, have contingencies, and find people you can truly rely on. | 72 | ✅ |
| 7 | To live life fully, escaping limits and maintaining your freedom. | 65 | ✅ |
| 8 | To be strong, stay free of anyone's control, and protect what matters to you. | 77 | ✅ |
| 9 | To keep the peace, stay connected, and avoid conflict. | 54 | ✅ |

Range **54–96 chars, mean 73.9** — the prompt's own figures, reproduced exactly, which is
independent corroboration that this is the same set rather than a coincidence.

They are transcribed in `scripts/build_content_library.js` at `:689, :755, :821, :887, :953, :1019,
:1085, :1151, :1217` inside `INTERIM_EXPLORE_V3`, validated by `build_content_library.js:1911`
(`need(e.p6.core_motivation, …)`), exposed on the client model at
[`app/report_prep.js:350`](app/report_prep.js:350) as `pages.v3_explore.p6`, and **rendered today**
on sheet 6 at [`app/renderer.js:3624`](app/renderer.js:3624):

```js
<div class="v3-ta-cm-narr">${_v3t(x.core_motivation)}</div>
```

This is not a new source. **It is live v3 content that landed with PR 3e.**

### 12.2 Therefore §3's hazard does not arise `[MEASURED]`

§3 asks whether replacing `type_N.description.core_motivation` would change a live v2 page. **There
is nothing to replace.** The v3 second-person string and the v2 third-person string are **two
different fields that coexist in the same library object today**:

| | `type_N.description.core_motivation` | `type_N.explore_v3.p6.core_motivation` |
|---|---|---|
| Person | third ("their own priorities") | **second** ("your standards") |
| Length | 124–164 ch | **54–96 ch** |
| Renders on | v2 client p3 (`renderer.js:2074`), v2 p1 (`:247`), coach comparison (`:1644`) | **v3 sheet 6** (`renderer.js:3624`) |
| On the client model | `pages.type_hypotheses.core_motivation` | `pages.v3_explore.p6.core_motivation` |

p5 reads the v3 field. Nothing is replaced, no v2 page changes, and the "same class as the content
gate that would have silently emptied live v2 p7" scenario does not occur. **I answer 3.1–3.3 below
anyway**, because the enumeration is worth having on the record and because it confirms the coverage
gap §3.2 predicted.

### 12.3 The one real plumbing item §3 did not ask about `[MEASURED]`

**The alternate's v3 core motivation is not on the client model.** `v3_explore` is built from `t`,
the **hero** type's library object (`report_prep.js:350`). The alternate's object `alt` is resolved
at [`app/report_prep.js:218`](app/report_prep.js:218) but only `alt.comparison` is exposed
(`:299`). Verified by building the model: the Type 5 string
`"To guard your inner resources, be competent, and maintain your self-sufficiency."` **does not
appear anywhere in the serialised client model** for the `anders_sx9` render, whose alternate is
Type 5.

p5 draws **two** hypothesis blocks. The leading one is free; the alternate one needs one line in
`report_prep.js`. That is the whole cost — but it has to be named, because it is the sort of thing
that gets discovered at the renderer.

### 12.4 Three smaller corrections `[MEASURED]`

* **§1.3's "its predicate is 100 chars" is 111.** The SX9 first sentence is 128 ch; the predicate
  after the subject `"One-to-One Nines "` is **111 ch**. The companion figure is right — the
  mockup's `.stxt` line is **105 ch** exactly.
* **§4.1's stripped character figures do not reproduce.** Prompt: 33–128, median 78, 3 over 105.
  My extraction: **47–157, median 111, 17 of 27 over 105.** The **full**-sentence figures reproduce
  exactly (60–173, median 134, 21 of 27 over 105), so the divergence is in the strip rule, not the
  extraction. See §15.1 — I report mine, labelled as mine, and it does not change the budget.
* **§1.1's caption measurement is confirmed exactly.** All 72 leading×alternate pairs render
  **157 characters, one distinct length, zero variance.** Both slots are single-digit numerals, so
  the string is length-invariant by construction.

---

## 13. The three decisions, recorded

**13.1 The alternate caption is final** (Cai, 8 Sep). Two numeral slots, no branching, no generated
text:

> "Type {leading} is your leading hypothesis. Type {alternate} is the alternate worth exploring with
> your coach, particularly if parts of the Type {leading} description do not quite fit."

157 chars for every pair `[MEASURED]`. It replaces the mockup's "scored close behind", which claims
a distance the data does not support. Fit confirmed in §16.

`[JUDGMENT]` Worth recording why this is the stronger line beyond the truth claim: it removes the
last piece of conditional display logic from the page. The audit's §4 and §5.3 both ended at "no
branching"; with this, **p5 has no conditional content at all.** Every zone renders the same shape
for every client, which is what makes the 72-pair matrix in §14 a complete proof rather than a
sample.

**13.2 §5.3's orange enumeration is amended, not the rule.** The p5 instinct bars are a fifth place
orange appears; orange still means the client. This closes the collision the audit raised at §7.5.
Docs pass. `[JUDGMENT]` The audit's suggested assertion — "no `#F68625` inside the heat-map SVG" —
still stands and is unaffected: it scopes the check to the figure, which is where the rule could
actually be broken by copy-paste, and leaves the bars alone.

**13.3 The 27 subtype summaries derive from the first sentence of each narrative**, subject clause
dropped, restated in second person. Measured in §15.

---

## 14. §3's answers, on the record

Recorded even though §12.2 makes the decision moot, because the coverage facts are load-bearing for
anything else that ever touches `description.core_motivation`.

### 14.1 Every consumer of `type_N.description.core_motivation` `[MEASURED]`

| # | Consumer | File:line | Surface |
|---|---|---|---|
| 1 | v2 client **p1** — "Core Motivation" section | [`app/renderer.js:247`](app/renderer.js:247) | live client PDF |
| 2 | v2 client **p3** — `.p3-motivation` | [`app/renderer.js:2074`](app/renderer.js:2074) | live client PDF |
| 3 | Coach portal — assessment overview | [`app/server.js:2392`](app/server.js:2392) | live portal |
| 4 | CMS preview — `type_N.description` | [`app/server.js:13963`](app/server.js:13963) | editor preview, **v2 p3** |
| 5 | Model assembly | [`app/report_prep.js:295`](app/report_prep.js:295) | `pages.type_hypotheses.core_motivation` |
| 6 | Model validation — required key | [`app/report_prep.js:474`](app/report_prep.js:474) | throws if absent |
| 7 | Content-library build validation | `scripts/build_content_library.js:1813` | build gate |

Distinct from `type_N.comparison.core_motivation` (a different field, `renderer.js:1644`, `:2110`)
and from the AI's `client_facing.core_motivation_evidence` (a different thing entirely).

**Not a consumer:** v3 sheet 6, which reads `explore_v3.p6.core_motivation` (§12.1).

### 14.2 Would replacing it change shipped output? **Yes, and nothing would catch it.** `[MEASURED]`

**Against the coach byte-diff: structurally blind.** `scripts/verify_coach_baseline.js:101` builds
only `R.buildCoachReportHTML(buildCoachModel(...))`, and `tests/baselines/` contains exactly four
files — `coach_sp4.html`, `coach_sp4.pdf.sha256`, `coach_sx7.html`, `coach_sx7.pdf.sha256`. It
would catch consumer #7 above (the coach comparison row uses a *different* field) but cannot see
consumers #1 or #2 at all.

**Against whatever covers the v2 client pages: nothing covers them.** As expected, and precisely:

* `scripts/render_client.js:136` and `tests/report_pages_test.js:72` both build the v2 client HTML,
  but assert only **structure** — page-container counts against `PAGE_INVENTORY`, single-sheet
  spill, and that no legacy `.report-page` survives (`report_pages_test.js:90`).
* **There is no v2 client baseline.** No `client_*.html` in `tests/baselines/`.
* `grep -rn "core_motivation" tests/*.js scripts/render_client.js scripts/verify_content_library.js`
  → **zero hits.** Nothing asserts the text anywhere.
* The failure would be **silent by shape**: the v3 strings are 54–96 ch against 124–164, so a
  replacement makes both v2 pages *shorter*. No spill, no page-count change, every structural gate
  green.
* `scripts/verify_content_library.js` would catch a hand-edit of the JSON (the `committed ==
  build(docx)` invariant), but **not** a docx or `INTERIM_*` edit followed by a rebuild — which is
  the sanctioned way to change content on this project.

`[JUDGMENT]` So the class §3 names is real and the repo is exactly as exposed as it fears. It simply
is not the situation PR 5 is in.

### 14.3 New `_v3` field versus replacement — priced `[MEASURED]`

**Replacement: do not.** Seven consumers, two of them live client pages, zero content coverage.

**New `_v3` field: already done, at zero cost.** `explore_v3.p6.core_motivation` *is* the new field,
and it landed in PR 3e with its own validation. p5's remaining cost is the single line in §12.3 for
the alternate's copy — no new content key, no docx change, no `cmsPreviewSpec` entry needed for the
data to render.

**One IO-92 state fact, not scoped here** `[MEASURED]`: `explore_v3` is **not CMS-editable**. The
registry regex at [`app/server.js:13957`](app/server.js:13957) enumerates
`description|comparison|patterns|inquiry_lines|wings|lines|strengths|challenges|practices|communication|conflict|center`
— `explore_v3` is absent, so `type_9.explore_v3` returns no spec. The v3 core motivations, on sheets
6 and (prospectively) 5, are not editable through the CMS today.

---

## 15. §2 — P2's real answer

### 15.1 The nine, in `.ptxt` `[MEASURED]`

Measured on the `AtAGlance_v1.html` scaffold, `.ptxt` box **316px**, 12.5px / 1.5 line-height,
Chromium 147.0.7727.57, line counts by `Range.getClientRects()` per the audit's §8.5 method.

| Type | ch | **rendered lines** | px |
|---|---|---|---|
| 1 | 56 | **1** | 18.75 |
| 2 | 75 | 2 | 37.50 |
| 3 | 90 | 2 | 37.50 |
| 4 | 96 | 2 | 37.50 |
| 5 | 80 | 2 | 37.50 |
| 6 | 72 | 2 | 37.50 |
| 7 | 65 | 2 | 37.50 |
| 8 | 77 | 2 | 37.50 |
| 9 | 54 | **1** | 18.75 |

**Distribution: 1 line — T1, T9 (2 types). 2 lines — T2–T8 (7 types).**

**P2 is genuinely reopened.** The audit closed it because all nine library strings rendered exactly
3 lines; this source does not have that property. The prompt is right.

The other variable in the block is inert `[MEASURED]`: `.pname` ("Type N · The Name", 15px bold,
316px) renders **1 line for all nine**, 17.00px, the longest being Type 4 at 26 ch. So block height
is governed by `.ptxt` alone.

### 15.2 The 72-pair matrix `[MEASURED]`

Both `.pick` blocks set from this source, all 72 leading×alternate pairs. **Four distinct
(leading height / alternate height) combinations:**

| Leading / alternate | Pairs | Verdict |
|---|---|---|
| 74.50 / 74.50 | **42** | matched — both 2-line |
| 74.50 / 55.75 | **14** | **ragged, +18.75px** — alternate is T1 or T9 |
| 55.75 / 74.50 | **14** | **ragged, −18.75px** — leading is T1 or T9 |
| 55.75 / 55.75 | **2** | matched — the 1×9 and 9×1 pairs |

**44 of 72 matched, 28 of 72 ragged**, always by exactly one line (18.75px). The ragged set is
structurally determined: it is every pair where exactly one of {T1, T9} appears — 2 types × 7 others
× 2 positions = 28.

### 15.3 §2.3 — the fix. **Accept the ragged pair.** `[JUDGMENT]`

Because the measurement changes the question. **The ragged pair costs zero page height** `[MEASURED]`:
across all 72 pairs, with the new caption in place, the **intrinsic page height is 1015.22px for
every single one**, `.chart` is **353px for every single one**, and the caption is 2 lines for every
single one. Headroom stays **40.78px** (1056 basis) / **41.78px** (1057 gate basis) on the worst
pair — identical to the mockup baseline in §6.2.

The reason is structural: `.chart` is `align-items:center` with the heat map at `flex:0 0 322px` and
a 315px-tall SVG. `.klist` varies **131.50 / 150.25 / 169.00px** across the matrix and is shorter
than the figure in every case, so the variation is absorbed inside a box the SVG governs.

Four reasons to accept it rather than fix it:

1. **Zero fit cost, measured on all 72 pairs.** There is no spill risk to buy off.
2. **Spec §6.1 does not apply.** Its matched-line rule is for **paired columns** — side-by-side, where
   a ragged bottom edge is visible against its neighbour. These two blocks are **stacked vertically**
   inside `.klist` (`.pick` + `margin-bottom:20px`). There is no adjacent column edge to reveal the
   mismatch; the alternate block simply begins 18.75px higher or lower against a 315px figure.
3. **A `min-height` buys an orphan.** Forcing T1's 56-ch and T9's 54-ch lines into a two-line box
   leaves a visible empty half-line under the two shortest strings — and Type 9 is the reference
   client. It trades an invisible defect for a visible one.
4. **A line-count authoring target would change live output.** These strings **ship today on sheet
   6** (§12.1). Rewriting T1 and T9 to reach two lines on p5 edits a page that is already approved
   and already rendering, to fix a cosmetic issue on a page that does not exist. That is the wrong
   direction of travel, and it is the same "changing live content to satisfy a new page" shape §3
   was right to be alert to.

`[JUDGMENT]` If Cai wants them matched anyway, the cheapest honest option is **neither** of §2.3's
first two: it is to let the *label* row absorb it — `.plbl` is a single 8.5px uppercase line and a
`min-height` there is invisible when unused. But I would not spend it. Cai's call.

---

## 16. §4.2 — the caption at 157

`[MEASURED]` `.note` is **710px** wide — the full content column, not the 316px `.klist` — 11.5px
italic / 1.45. Measured, not assumed:

| Line | ch | rendered lines | px |
|---|---|---|---|
| Shipped mockup line ("scored close behind") | 165 | 2 | 33.34 |
| **New caption, 9×5** | **157** | **2** | **33.34** |
| New caption, 1×9 | 157 | 2 | 33.34 |
| New caption, 8×2 | 157 | 2 | 33.34 |

**Confirmed at 2 lines, byte-for-byte the same box height as the line it replaces.**

**Headroom to 3 lines: 114 further characters** `[MEASURED]` — the caption breaks to a third line at
**271 ch**, measured by growing the string until the line count changed rather than inferring it.
At 157 the caption uses 58% of its two-line box. This zone is not a risk.

---

## 17. §4.1 — the 27 first sentences, and the line budget

### 17.1 Extraction

Extracted from the store, as instructed — `content_library.json` →
`subtype_<code>.instincts_v3.narrative`, first sentence by `/^.*?[.!?](?=\s|$)/s`.

**A necessary caveat on the "stripped" column** `[JUDGMENT]`: the recipe in §1.3 is *subject clause
dropped **and** restated in second person*. Restating in second person is authoring, which this
audit does not do. So my stripped column is a **mechanical subject-strip only** — it removes the
leading noun phrase naming the subtype and sentence-cases the remainder. It is a **proxy for the
recipe's output, not the recipe's output.** That is also why my character figures diverge from the
prompt's (§12.4): a more aggressive strip, or the second-person restatement, shortens further. The
mockup's SX9 line is the evidence — 105 ch against my strip's 111 for the same sentence.

The budget below is set in lines with margin, so the divergence does not move it.

### 17.2 Rendered lines, `.stxt` at 308px `[MEASURED]`

| Key | full ch | **full lines** | strip ch | **strip lines** |
|---|---|---|---|---|
| so1 | 157 | 4 | 142 | 3 |
| so2 | 102 | 2 | 87 | 2 |
| so3 | 163 | 3 | 146 | 3 |
| so4 | 134 | 3 | 118 | 3 |
| so5 | 173 | 4 | 157 | 3 |
| so6 | 113 | 2 | 98 | 2 |
| so7 | 135 | 3 | 118 | 3 |
| so8 | 140 | 3 | 126 | 3 |
| so9 | 60 | 2 | 47 | **1** |
| sp1 | 149 | 3 | 123 | 3 |
| sp2 | 137 | 3 | 111 | 2 |
| sp3 | 103 | 2 | 75 | 2 |
| sp4 | 135 | 3 | 108 | 2 |
| sp5 | 136 | 3 | 109 | 3 |
| sp6 | 91 | 2 | 65 | 2 |
| sp7 | 143 | 3 | 115 | 3 |
| sp8 | 109 | 3 | 84 | 2 |
| sp9 | 72 | 2 | 48 | **1** |
| sx1 | 117 | 3 | 98 | 2 |
| sx2 | 126 | 3 | 107 | 3 |
| sx3 | 136 | 3 | 115 | 3 |
| sx4 | 136 | 3 | 116 | 3 |
| sx5 | 147 | 3 | 127 | 3 |
| sx6 | 103 | 2 | 84 | 2 |
| sx7 | 132 | 3 | 111 | 3 |
| sx8 | 110 | 3 | 92 | 2 |
| sx9 | 128 | 3 | 111 | 2 |

**Full:** 2–4 lines — 2 lines ×7, 3 lines ×18, 4 lines ×2 (so1, so5).
**Stripped:** 1–3 lines — 1 line ×2 (so9, sp9), 2 lines ×11, 3 lines ×14.

### 17.3 The character ordering contradicts the line ordering — **the fourth instance, and the cleanest** `[MEASURED]`

The prompt named this as a possibility. It happens, and it happens as an **exact tie**:

| Key | stripped ch | rendered lines |
|---|---|---|
| **sx9** | **111** | **2** |
| **sp2** | **111** | **2** |
| **sx7** | **111** | **3** |

**Three strings at exactly 111 characters. Two render two lines; one renders three.** No
character-based rule can express that, because the inputs are identical.

And the ordering **inverts**, not merely ties:

| Key | stripped ch | rendered lines |
|---|---|---|
| sp5 | **109** | **3** |
| sp4 | 108 | 2 |
| sx9 | **111** | **2** |

**sp5 is shorter than sx9 and renders one line more.** The cause is word shape, not length —
sx7 carries `constraints`, `approaching` and the hyphenated `rose-colored`; sp5 carries `protection`,
`intrusion`, `depletion` and `world's`. Long tokens break early in a 308px box.

The **three longest by character count** are so5 (157), so3 (146), so1 (142) — the same three types
the prompt names, in a different order. **By rendered lines, fourteen strings tie at the maximum of
three, and so5/so3/so1 are not distinguishable from the other eleven.** The character ranking
carries no information the budget can use.

### 17.4 The line budget `[MEASURED]`

Measured by growing `.stxt` one rendered line at a time on a worst-case pair (leading T4, alternate
T3 — both 2-line motivations) with the new caption in place:

| `.stxt` lines | `.two` height | intrinsic page | headroom to 1056 | verdict |
|---|---|---|---|---|
| 1 | 140.00 | 1011.72 | 44.28 | fits |
| **2** (mockup) | 143.50 | **1015.22** | **40.78** | fits |
| **3** | 162.25 | **1033.97** | **22.03** | **fits** |
| **4** | 181.00 | **1052.72** | **3.28** | fits, but see below |
| 5 | 199.75 | 1071.47 | −15.47 | **fails the 1057 gate** |
| 6 | 218.50 | 1090.22 | −34.22 | fails |
| 7 | 237.25 | 1108.97 | −52.97 | fails |

Note the first line is nearly free (3.50px, the panel absorbing it) and every line after costs a
full 18.75px.

**Proposed budget: 3 rendered lines, gated at 3.** `[JUDGMENT]`

* **The hard ceiling is 4**, at **3.28px** of headroom. That is under a fifth of a line, and design
  spec §3.3 states that a font substitution shifts every measurement in the document. **3.28px is
  inside the noise of the one failure mode the spec calls most likely.** Authoring to 4 would be
  building on it.
* **3 lines leaves 22.03px** — over a full line of margin, absorbing a rewrap without a rebuild.
* **The recipe already meets it.** Even my deliberately conservative mechanical strip lands **1–3
  lines for all 27, maximum 3**. The authored second-person form is shorter again (105 vs 111 on the
  SX9 evidence), so it should sit comfortably inside 3 with several dropping to 2.
* **State it in lines and gate it in lines.** `render_client.js` already counts rendered lines for
  the §6.1 pairs and the Z6 cap; this is the same assertion shape, and it is the fourth time on this
  project that a character figure would have set the wrong bound.

---

## 18. Effect on the seven-step sequence

`[JUDGMENT]` Three steps change; the sequence does not.

| Step | Change |
|---|---|
| **1. Data decision** | **Unchanged.** Still the one that decides the shape. §12 touches content, not the nine type scores. |
| **2. The probe** | **P2 and P3 are done — delete them.** §15 answers P2 (nine line counts, the 72-pair matrix, zero page cost) and §16 answers P3 (the caption at 2 lines, 114 ch of headroom). **P1 narrows**: §17.4 sets the 3-line budget, so P1 becomes verification of the authored strings against a known budget, not discovery of one. P4–P7 unchanged. The probe gets smaller, and it gets smaller because the measuring happened here. |
| **3. Expose the nine scores** | **Add one line**: the alternate's `explore_v3.p6.core_motivation` (§12.3), alongside the `charts.types` work. Same file, same commit, same validator. |
| **4. Content** | **Materially smaller.** The 9 motivation strings need **no authoring at all** — they exist, they ship, and they are second person already. The caption needs none — it is final and fits. What remains is the 27 subtype summaries, now with a measured **3-line** budget and a starting draft in each narrative's first sentence. |
| **5. The diagram** | Unchanged. |
| **6. The page** | **Add one assertion**: `.stxt` ≤ 3 rendered lines across all 27 subtypes, in the existing 27-render 3×9 matrix. And record that all 72 pairs render 1015.22px, so a page-height regression is attributable. |
| **7. Gates and fixtures** | Unchanged. |

**One item moves up.** `[JUDGMENT]` §12.3's alternate exposure was not in the audit's plan at all,
because the audit had p5 reading `description.core_motivation`, which is on the model for the hero
and never needed for the alternate. It belongs in step 3, and it is the kind of one-line omission
that otherwise surfaces at step 6 with the renderer half-written.

**And one thing to protect.** §15.3 recommends accepting the ragged pair. If Cai takes the other
option, it belongs in **step 4, not step 6** — because "match the line counts" means editing T1's and
T9's live sheet-6 strings, which is a content change to a shipped page and needs the coach and
content gates run against it, not a layout tweak inside the p5 build.

---

# Plan detail — revalidating the sequence

**Appended 8 Sep 2026.** `main` and `origin/main` both at `f385c9a`, branch head `2ac1add` before
this section — **the tree was already current, nothing came down.**

**Not an audit and not a build.** Same tagging convention. No character ceilings.

---

## 19. Lead — what is wrong

### 19.1 The harness invalidates the heat map's inputs on 9 of 9 renders `[MEASURED]`

This is the plan-moving finding, and it is not a fixture gap — it is a **harness** gap.

`scripts/render_client.js:362-377` re-types the `anders_sx9` fixture to render all nine types. It
swaps `confirmed_type`, sets `alternate_candidate = (asType % 9) + 1`, nulls the name strings and
drops `client_words`. **It does not touch `leading_candidate`, and it does not touch
`call1_ranking`.** Measured across the sweep:

| asType | confirmed_type | leading_candidate | alternate_candidate | call1 #1 | call1 #2 |
|---|---|---|---|---|---|
| 1 | 1 | **9** | **2** | **9** | 5 |
| 2 | 2 | **9** | **3** | **9** | 5 |
| 3 | 3 | **9** | **4** | **9** | 5 |
| 4 | 4 | **9** | 5 | **9** | 5 |
| 5 | 5 | **9** | **6** | **9** | 5 |
| 6 | 6 | **9** | **7** | **9** | 5 |
| 7 | 7 | **9** | **8** | **9** | 5 |
| 8 | 8 | **9** | **9** | **9** | 5 |
| 9 | 9 | 9 | **1** | 9 | 5 |

Under the decided design — **fills from `call1_ranking`, rings from `leading_candidate` and
`alternate_candidate`** — this produces, for the eight re-typed renders:

* the **ramp's brightest node is 9** on a page headlined "Type 3";
* the **LEADING ring sits on node 9** while the header, the subtype panel and the motivation block
  all say Type 3;
* the **ALTERNATE ring sits on a node the ramp does not rank second** (`(asType%9)+1` against a
  constant call1 #2 of 5).

And note **row 9**: even the fixture's own type is broken, because the sweep overwrites the correct
`alternate_candidate` (5) with `(9%9)+1 = 1`. `asType` is never null for `client_v3` —
`typesFor` returns `[1..9]` at `render_client.js:176` — so **every** render goes through the retype.

`[JUDGMENT]` This has never mattered because **p5 is the first v3 page to render the alternate at
all** — the alternate page was cut, and `m.alternate` reaches no built v3 sheet today. The moment
p5 exists, the harness produces nine pages that contradict themselves, and a reviewer would have to
be told to ignore them. That is the same failure the `client_words` drop at `:371` already solved
for a different field, with the same reasoning, and it needs the same treatment.

**Consequence for the plan: this lands in the first build prompt, not step 6.** It is data-shape
work on the exact field the first prompt exposes, and doing it late means every render between now
and then is untrustworthy.

### 19.2 On a REDIRECT, both rings land on the same node — and it is the wrong node `[MEASURED]`

Proved by running the production stamper (`app/call2_stamp.js`), not by reading it. Input: Call #1
ranks 9 first and 6 second; the model confirms 6 and records `redirect_from_type: 9`.

| Field | Value |
|---|---|
| `confirmed_type` (drives `hero.number` and every other zone) | **6** |
| `leading_candidate` | **9** |
| `alternate_candidate` | **9** |
| call1 #1 / #2 | 9 / 6 |

`call2_stamp.js:51` sets `alternate_candidate = redirect_from_type` (Defect #2's swap), and
`leading_candidate` is stamped from Call #1 and never moved. On a REDIRECT they are **the same
type**, and it is the type the client was redirected *away from*.

So: **LEADING ring on node 9 against a header that says Type 6, ALTERNATE ring on node 9 too.** One
node wearing both rings, and the client's actual type wearing neither.

**Is it reachable in production?** `[MEASURED]` Not on the EM path — `em_report_adapter.js:98`
hard-sets `redirect_from_type: null`, so em_only never redirects. **But the SM path is a live
fallback**: `server.js:5479` returns null on any EM failure "so runBackgroundJob falls back to SM's
Call #2". So a REDIRECT reaches production whenever the EM call fails. `redirect69.json` exercises
this exact path today through `tests/run_test.js`.

`[JUDGMENT]` **Recommendation, and it is a small change to the decided design rather than a
challenge to it: source the LEADING ring from `hero.number` (`confirmed_type`), not
`leading_candidate`.** Reasons, all measured:

1. **Every other zone on p5 uses `confirmed_type`** — the header, the subtype panel, the leading
   motivation block, the page title. A ring drawn from a different scalar can contradict the page
   it sits on, and on a REDIRECT it does.
2. **It fixes 8 of the 9 sweep renders for free** (§19.1), independently of the harness fix.
3. **It costs nothing when they agree**, which is 19 of 19 production rows and all three fixtures.

The ALTERNATE ring stays on `alternate_candidate` — that part of the decision is right, and it is
what makes the 2-of-19 "alternate is ramp #3" case render as a mid-ramp node wearing the alternate
ring: visibly odd, but not a false statement. Add one guard: **if the two rings resolve to the same
node, draw the leading ring only and flag it**, rather than stacking a dashed ring on a solid one.

### 19.3 One note on the decided field, stated once `[JUDGMENT]`

The decision is `call1_ranking`, and I am building to it. One thing to have on the record: in
em_only — which is production — `call1_ranking` is EM's `em_ranking`
(`em_report_adapter.js:106`), an **AI-generated** dimensional confidence ranking, not the client's
own slider answers. The mockup heads this figure **"How the Nine Patterns Scored"**. Under the
decided field, that heading describes the engine's confidence, not the client's responses.

I am not reopening the field choice — the decision buys internal consistency with
`leading_candidate` and `alternate_candidate`, which is worth more than provenance here, and §1.4
of the audit was wrong to weigh that lightly. But **the heading may want a word**, and that is a
copy question for Cai and Mo, not a build question.

### 19.4 A seventh stale spec line, found while making the six `[MEASURED]`

Not corrected, because it is outside the decided list. **§7.3's first bullet** still reads:

> "**Types 1, 4, 7 and 9 are authored (20 Aug 2026). Five remain: 2, 3, 5, 6, 8.**"

§7.4's own **4 Sep 2026** post-lock correction in the same document says "All nine types are now
authored", and `V3_EXPLORE_PILOT_TYPES` was collapsed in PR 3e. The document contradicts itself
two sections apart. One line, same shape as the others. Cai's list, Cai's call — say the word.

### 19.5 Two small corrections to this prompt `[MEASURED]`

* **§2.2's "the type-axis fixture need is gone" is right, but not for the stated reason.**
  `leading_candidate = call1 #1` holds on 19/19 production rows **and on all three fixtures** —
  but it is not an invariant of the code. On the SM REDIRECT path they diverge by construction
  (§19.2). The fixture need is gone for **CONFIRMED** rows; it reappears as a REDIRECT need.
* **§2.3's premise is sound and the answer is the one it suspects** — see §21.

---

## 20. §2.2 — the fixtures, measured

### 20.1 What carries `call1_ranking` `[MEASURED]`

Scanned every `.json` in `tests/fixtures/`. Eight of the eleven carry no `hypothesis` at all —
`redirect69.json`, `so7.json`, `sp4.json`, `sx7.json`, `sp4_pre051426.json`, `sx7_pre051426.json`,
`sp9_selftyping.json`, `published_overrides.json` are Call #2 *input* fixtures (`intake`,
`scores`, `call1Result`) replayed by `tests/run_test.js`, not `api_result` shapes.

**Three carry it. All three carry nine entries.**

| Fixture | entries | all nine types? | score range | shape | leading = ramp #1 | alternate = ramp #2 | ties at top | scores at 100 | stage4 |
|---|---|---|---|---|---|---|---|---|---|
| `anders_sx9_api_result.json` | **9** | yes | 31–91 | **all integers** | ✅ 9 | ✅ 5 | none | **0** | CONFIRMED |
| `sp4_api_result.json` | **9** | yes | 18–92 | **all integers** | ✅ 4 | ✅ 1 | none | **0** | CONFIRMED |
| `sx7_api_result.json` | **9** | yes | 18–92 | **all integers** | ✅ 7 | ✅ 5 | none | **0** | CONFIRMED |

**So the shape is not thin — every fixture is 9/9, and `cmsPreviewApiResult`'s two-entry stub is
the only short one in the repo.** The thinness is elsewhere.

### 20.2 Where the fixtures *are* thin — and it is exactly the production hazards `[JUDGMENT]`

| Case | In production `[CAI-MEASURED]` | In fixtures `[MEASURED]` |
|---|---|---|
| `alternate_candidate` ≠ ramp #2 | **2 of 19** (it is ramp #3) | **0 of 3** |
| Two types tied at the top | **row 57, both at 100** | **0 of 3** |
| A score at the 100 ceiling | row 57 | **0 of 3** — max observed 92 |
| Fractional scores | unknown | **0 of 3** — all integers |
| REDIRECT (rings collide, §19.2) | reachable via the SM fallback | **0 of 3** — all CONFIRMED |

**Plain answer to "can the heat map be tested with what exists": partly.** The nine-fill ramp and
the ordinary two-ring case are covered three times over once the harness is fixed. **Four hazards
are not testable with what exists**, and two of them are known to occur in production.

**Step 7 changes materially, and it gets bigger, not smaller.** It now carries four fixture
additions rather than the two the audit proposed:

1. **`alternate_candidate` = ramp #3** — the 2-of-19 case. Proves the ring decouples from the ramp
   ordering without contradicting the page.
2. **Two types tied at the top, both at 100** — production row 57. Proves the ramp's fixed-ceiling
   formula terminates at exactly 1.00 for both, and that the LEADING ring's node is chosen by
   `hero.number` rather than by a `sort()` whose tie-break is undefined between them.
3. **A REDIRECT** — §19.2's ring collision. This one is cheap: `redirect69.json` already exists and
   already produces the collided scalars; it needs promoting to an `api_result`-shaped fixture the
   client harness can render.
4. **A flat profile** — all nine within a few points. Under the decided fixed-ceiling ramp this is
   the case that renders *correctly* flat, and it is the regression guard that stops anyone
   reintroducing min–max normalisation. Carried over from the audit's §8.2.

Plus the two instinct-axis fixtures from audit §8.1, unchanged.

### 20.3 What replaces the retired fixture need `[MEASURED]`

The audit's §8.2 wanted a fixture where "`type_score_profile` #2 ≠ `alternate_candidate`" — the
`sp4` disagreement. **Under the decided field that case cannot occur**, because `alternate_candidate`
and the ramp now come from the same array. Correct, and it retires.

**What replaces it is item 1 above** — `alternate_candidate` ≠ **ramp #2**, which *can* occur under
the decided field, does occur on 2 of 19 production rows, and is now the only thing that can put the
alternate ring somewhere the ramp does not predict. The need did not disappear; it moved fields.

---

## 21. §2.3 — the `|| iz.columns[0]` fallback is **NOT REACHABLE**

`[MEASURED]` Tested empirically rather than reasoned about — fifteen values of
`dominant_instinct_hypothesis` with `confirmed_instinct` deleted, each run through
`buildClientModel`:

| Input | `buildClientModel` | Column match |
|---|---|---|
| `"SX"`, `"sx"`, `"sX"`, `"SP"` | builds | **match** — SX9 / SP9 |
| `" SX"`, `"SX "` | **throws** — `content_library missing key: subtype_ sx9` / `subtype_sx 9` | never reached |
| `"SEXUAL"`, `"Sexual"` | **throws** — `subtype_sexual9` | never reached |
| `"One-to-One"`, `"ONE-TO-ONE"` | **throws** — `subtype_one-to-one9` | never reached |
| `"XX"` | **throws** — `subtype_xx9` | never reached |
| `""`, `null`, key deleted, `0` | **throws** — `subtype_9` | never reached |

**The mechanism, and why it is structural rather than lucky.** Two lookups read the same variable
through transforms that differ *only* in case folding:

* `report_prep.js:219` — `lib(subtypeKey(instinct, heroN))`, where `subtypeKey` is
  `` `subtype_${String(instinct).toLowerCase()}${n}` ``. `lib()` **throws** on a missing key.
* `renderer.js:3836` — `String(m.display.instinct_code).toUpperCase()`, matched against
  `columns[].instinct`.

Any input that would miss the column differs from `sp`/`so`/`sx` by more than case — and any input
that differs by more than case produces a `subtype_<x><N>` key that does not exist, so
`buildClientModel` throws at `:219` **before any page is built**. The set of values that survive to
the renderer is exactly `{sp, so, sx}` in any casing, and `toUpperCase()` maps all of them to a
column.

**The short-array branch closes too** `[MEASURED]`: `columns` is built at `report_prep.js:391` from
a literal `['sp','so','sx'].map(...)` — **always exactly length 3** — and each iteration calls
`lib()`, which throws rather than yielding a short array.

`[JUDGMENT]` **So this is a comment, not a decision. Stop treating it as one.** The right disposition
is to leave `|| iz.columns[0]` in place on p10 and **not copy it to p5** — not because the risk is
real, but because on p5 it would be dead code that reads as a live fallback, and the next person to
audit the page would have to re-derive this proof. p5's builder should index the column directly and
let a miss throw, which is what already happens one hop earlier.

---

## 22. §2.4 — the sequence, revalidated

### 22.1 What the seven steps become

The old step 1 is a decision that has been taken, and **the old step 2 dissolves**. Both are
reported rather than kept as placeholders.

| Old | Now | Why |
|---|---|---|
| 1. Data decision | **gone — decided** | `call1_ranking`, fixed-ceiling ramp `0.10 + 0.90 × score/100`, rings from the scalars. One production query remains outstanding and moves into Build 1 as a pre-flight check, not a step. |
| 2. The probe | **gone — dissolved** | P2 and P3 answered (addendum §15, §16). P7 superseded by the ramp decision. P1, P4, P5 became verification and move into Step C's assertions. **P6 folds into Build 2** — see §22.2a. Nothing is left to measure before code. |
| 3. Expose the scores | **BUILD 1** | plus §19.1's harness fix, plus the alternate motivation, plus §2.1's `instinctRanks` extraction |
| 4. Content | **parallel, non-blocking** | per Cai 1.1 — the 27 summaries at a 3-rendered-line budget |
| 5. The diagram | **BUILD 2** | plus P6, plus IO-75's baseline as its **first** commit |
| 6. The page | **Step C** | plus the P1/P4/P5 verification assertions |
| 7. Gates and fixtures | **Step D** | now four fixture additions, not two (§20.2) |

**Five things, two of which are the build prompts Cai specified.**

### 22.2a Does P6 fold into Build 2? **Yes, entirely.** `[JUDGMENT]`

P6 was "heat-map SVG geometry under both ramp formulas at the flat, spread and extreme profiles".
Two halves, both gone as a *separate* step:

* **"Both ramp formulas" is decided**, so that half evaporates.
* **The geometry does not depend on the scores.** Node positions come from `CLIENT_ANGLES` and the
  geometry constant; only the *fills* vary with score, and a fill cannot clip a label. What varies
  geometrically is which node carries a ring and where the LEADING / ALTERNATE labels sit — a
  function of **node position only**, 72 configurations, purely geometric.

So P6 is not a measurement that must precede the code — **it is the code's own gate**, and
`verify_diagrams.js` is the harness that performs it. The one thing a pre-step would have taught is
already known: the mockup's LEADING label sits **1.17 viewBox px** from the canvas top and fails the
existing 5px rule (audit §7.2). Build 2 opens with that fix.

### 22.2b Do Builds 1 and 2 touch a file in common? **Yes — `app/renderer.js`.** `[MEASURED]`

Answered from the file list, not from memory:

| File | Build 1 | Build 2 |
|---|---|---|
| `app/report_prep.js` | ✅ `charts.types`, alternate motivation, `validateModel` | — |
| **`app/renderer.js`** | **✅ `instinctRanks` extraction, ~:3838** | **✅ `QUICKREF_GEO` ~:1087, new variant ~:1233, and the SIGNATURE WIDENING** |
| `scripts/render_client.js` | ✅ the retype fix, :362-377 | — |
| `app/server.js` | ✅ `cmsPreviewApiResult`, :13985 | — |
| `tests/report_pages_test.js` | ✅ model-shape assertions | — |
| `scripts/verify_diagrams.js` | — | ✅ variant + the `r <= 20` filter fix |
| `scripts/verify_transparency.js` | — | ✅ **the standalone-SVG scan** — added 8 Sep, see below |

> **Post-lock correction — 8 Sep 2026. THIS TABLE OMITTED `verify_transparency.js`.** Build 2 must
> touch it, and the reason is structural rather than incidental: that gate renders the **whole v3
> document**, and `quickref` has no `built: true` until step 6 — so **the strongest gate in the repo
> cannot see the figure Build 2 produces.** Deferring to step 6 would be the PR 4 failure exactly, a
> renderer assertion passing vacuously because the page did not exist. `buildEnneagramSVG` is a pure
> function taking no page context, so Build 2 scans its output standalone, with the tracked mockup's
> own heat-map SVG as the positive control at 1 group / 1 mask / 8 alphas. Also corrected in the row
> above: the Build 2 column did not name the **signature widening**, which is the change that made
> B11 load-bearing.

**One file in common, and it is not a conflict, for two reasons.** First, Cai's 1.2 sequences them
— Build 1 lands before Build 2 is written — so there is no parallel edit to merge. Second, the two
regions are ~2,750 lines apart (`:1087`/`:1233` against `:3838`) with no shared symbol.

`[JUDGMENT]` **The two prompts cannot be collapsed into one, and I have no refutation to offer** —
the separation Cai gives is the right one, and §19.1 is the argument for it. Build 1 changes what
the harness renders; if it is wrong, every geometry measurement Build 2 takes is taken against bad
data, and the two errors would surface together with no way to attribute them. One condition:
**Build 2 must not start until Build 1's 27-render matrix and coach baseline are green**, which is
the sequencing already decided.

### 22.2c Where IO-75 lands `[JUDGMENT]`

**Build 2, as its first commit — before any geometry change.** Not step 7.

The reasoning is about *ordering*, not filing. IO-75's delta lives in `buildEnneagramSVG`, which is
the function Build 2 modifies. **If the assertion is added after the change, it baselines the
post-change value and proves nothing.** Added first, it is a genuine safety gate on the shared
primitive five shipped pages depend on — which is precisely the risk Cai's 1.2 cites for splitting
the prompts.

So Build 2 runs: (1) record the band-scoped Wings baseline at today's measured value, green; (2) the
geometry work; (3) the same assertion, still green. If step 3 goes red, Build 2 broke a shipped page
and knows it immediately.

**Scope it to the diagram band, y = 148–370, not the whole page** — as decided. The audit's reason
holds and is now twice-demonstrated: the whole-page figure moved from 1.9643% → 2.1258% → 2.3433%
across two changes, **neither of which was a geometry change**; both were copy rewraps. A page-level
threshold is a copy-change detector.

**The one thing I would say out loud in the build report**: PR 5 is adding a standing regression gate
for a page PR 5 does not build. That is unusual and worth naming rather than letting a future reader
discover a Wings assertion inside a Quick Reference PR. The alternative — file the standing assertion
as its own card and have Build 2 merely *report* the before/after number — is defensible and cheaper,
but it leaves the shared primitive ungated during the one change most likely to move it. I recommend
carrying it here and naming it.

### 22.3 §2.1 — where the orphaned decision lands

**Build 1, as its own commit, sequenced first within the prompt.** Not its own step, not folded into
the `report_prep.js` commit.

* **Why Build 1 and not Build 2**, even though it touches `renderer.js` and Build 2 owns that file:
  it must land **before p5's renderer is written** (Step C), or p5 duplicates the rule and gets
  refactored later — which is the divergence the decision exists to prevent. Build 2 is the diagram,
  not the page, so waiting for it buys nothing and risks Step C starting first.
* **Why its own commit**: because the condition depends on it.

**The condition still holds, and it is now stronger than when I stated it** `[MEASURED]`. Restated:
a **pure move**, in its **own commit**, with the 27-render matrix the only thing that has to stay
green. Two things have been measured since:

1. **The coach byte-diff is structurally blind to it** — `verify_coach_baseline.js:101` builds only
   `buildCoachReportHTML`, and `tests/baselines/` holds four files, all coach. So the 27-render
   matrix and `report_pages_test.js` really are the only gates, and a shared commit would give a red
   run two candidate causes.
2. **A stronger falsification is available and costs one render each side.** A pure move must produce
   **byte-identical v3 client HTML**. Build 1 should capture `buildClientReportHTML_v3` output before
   and after the extraction and assert equality — that is a complete proof of "no behaviour change",
   far tighter than "the matrix stayed green".

**One addition to the extraction itself**, from §22: the new helper should **not** carry p10's
`|| iz.columns[0]` fallback into shared code. That fallback is unreachable and belongs to the
subtype-column lookup, not to the rank computation; the two are separate concerns in the same IIFE
today.

### 22.4d Build 1 — exact scope

**Files touched, and nothing else.**

| # | File | Change | Commit |
|---|---|---|---|
| 1 | `app/renderer.js` | Extract the `rank` IIFE at `:3838` into `instinctRanks(dominantCode, instinctBars)`. Pure move. Leave `:3828`'s warning in place pointing at both it and `instinctStack`. | **1 — alone** |
| 2 | `app/report_prep.js` | `:261` — add `types` to the client `charts`, from `h.call1_ranking`, as a new `typeRamp` helper (not an overload of `typeBars`, which applies centre colours). Expose the alternate's `explore_v3.p6.core_motivation`. | 2 |
| 3 | `app/report_prep.js` | `validateModel` — assert the new keys. | 2 |
| 4 | `scripts/render_client.js` | `:362-377` — extend the retype to rebuild `leading_candidate` and `call1_ranking` consistently with `asType`. | **3 — alone** |
| 5 | `app/server.js` | `:13985` `cmsPreviewApiResult` — nine `call1_ranking` entries instead of two. | 4 |
| 6 | `tests/report_pages_test.js` | Assertions for 1–5. | with each |

**Not touched by Build 1**, and worth stating so the prompt can say so: `app/content/content_library.json`,
any `.docx`, `scripts/build_content_library.js`, `scripts/verify_diagrams.js`, `V3_PAGE_ORDER`,
`tests/lib/report_page_inventory.js`. **No page is built and no page count changes.**

**Assertions added.**

| # | Assertion | Falsified by |
|---|---|---|
| A1 | `buildClientReportHTML_v3` output is **byte-identical** before and after the `instinctRanks` extraction | any diff — the move was not pure |
| A2 | The 27-render 3×9 instinct matrix stays green | p10 changed |
| A3 | `model.charts.types` has **exactly 9** entries, each `{type, score}`, `type` ∈ 1–9 with no repeats | a short or malformed `call1_ranking` reaching the model |
| A4 | `model.charts.types` scores are numeric and within 0–100 | a fractional or out-of-range score being assumed away |
| A5 | `leading_candidate` and `alternate_candidate` are both present and both ∈ 1–9 | either absent — the rings would have no node |
| A6 | The alternate's core motivation is a non-empty string for all 72 leading×alternate pairs | a type whose `explore_v3` is missing |
| A7 | **After the retype, for every `asType`: `leading_candidate === confirmed_type` and `call1_ranking` position 1 `=== confirmed_type`** | §19.1's defect surviving — **RED BY DESIGN first**, then green |
| A8 | `cmsPreviewApiResult` emits 9 `call1_ranking` entries | the two-entry stub surviving |

**A7 is the one to write red first.** It fails today on 8 of 9 types, for a reason the table in
§19.1 states exactly, and watching it fail is what proves the assertion is measuring the thing.

**One pre-flight, not a code change**: run the production query for
`api_result -> 'hypothesis' -> 'call1_ranking'` — entry count, score range, and whether any value is
fractional — and record it in the build report. Audit §2.1's range is fixture-only, and A4's bounds
should be set against real data rather than three hand-authored fixtures. `[UNVERIFIED]` here; I have
no database access in this session.

### 22.5 What I would now do differently

`[JUDGMENT]` Three things, all of them consequences of measuring rather than of the decisions:

1. **The probe was over-scoped.** Seven measurements, five of which turned out to be answerable from
   the tracked mockup with no scaffold and no new code. A probe earns its own step when the page's
   *fit* is genuinely unknown; here the mockup is the fit evidence, and I should have measured
   against it before proposing a step.
2. **I placed the fixture work in the wrong step and under-sized it.** Step 7's fixtures are not a
   tidy-up after the page works — items 2 and 3 in §20.2 (the tie at 100, the REDIRECT) are cases
   where the *design* is undefined, not merely untested. They should be settled before Step C draws
   a ring, even if the fixtures land later.
3. **I named `instinctRanks` and did not place it**, which is the thing Cai's 2.1 caught. The lesson
   generalises: a recommendation inside a findings section is not a plan item until it has a step, a
   commit and a falsification. §22.3 gives it all three.

---

## 23. §4 — read-back of the repo copy

Requested so the other copy can be compared against it. **The repo copy at commit `ddd5043`**,
i.e. **after** the five corrections in §3 of the prompt. Where I changed a section, both states
are given, because the divergence being hunted is between copies *and* across time.

### 23.1 Every post-lock correction the document contains `[MEASURED]`

Counted by `grep -o "Post-lock correction — [0-9]* [A-Za-z]* 2026"`, plus the inline dated
markers that do not use that heading form.

| Date | Count | Sections |
|---|---|---|
| **11 Aug 2026** | 1 | §4.1 — `type_library_name_patch_080726.json` corrects no archetype names; do not apply. Also the Appendix row. |
| **12 Aug 2026** | 1 + 1 inline | spec §3.5 — the four-count retraction (this is the convention the others follow). Plus "**This is a required step, not an assumption** (added 12 Aug 2026)" later in §3.5. |
| **20 Aug 2026** | 2 inline | §4.4 rows M1 and M2, both marked "Ratified 20 Aug 2026". |
| **3 Sep 2026** | 1 + 2 inline | §6.1 table (two corrections to the line-count bands). Inline: §4.4 row M4 "Recorded 3 Sep 2026", and §4.4's closing paragraph "Reworded 3 Sep 2026". |
| **4 Sep 2026** | 7 | §6.1 (×2 — scope, and the hard gate at PR 3f), §7.2 (Type 9 p7 rows CLOSED), §7.4 (×2 — all nine authored; the nine doc IDs superseded at PR 3e), §7.4 budgets (×2 — the budgets are not sound). |
| **8 Sep 2026** | 5 | §4.3, §5.3, §7.2, §7.3 (×2). Added by commit `ddd5043` on this branch. |

**Total: 17 dated post-lock corrections or ratifications, across six dates.** The oldest is
11 Aug; the document has been corrected in place on every working date since.

`[JUDGMENT]` If the other copy carries none of these, the divergence is not one line in spec §3.5 —
it is every section listed above. §6.1, §7.2 and §7.4 have each been corrected twice, and §7.4's
4 Sep entry explicitly says a claim in it was "**false when written**".

### 23.2 §3.5 — unchanged by me, already struck

The opening claim and its retraction, verbatim:

```
All diagrams share one geometry. ~~Verified across all 9 types on both page types — **54 labels, zero
clipped, minimum edge clearance 5px, minimum label-to-label gap 27.7px**.~~

> **Post-lock correction — 12 Aug 2026.** The verification claim above is **false on four counts**,
> all found by rendering during PR 1.
>
> - **Not zero clipped.** On **WINGS · TYPE 1** the 9-wing label ran through the home node and
>   collided with the home label. The "place above" rule below applied only to the *home* label, so
>   a non-home node at the top of the circle fell through to horizontal placement and defaulted to
>   one side. Type 1 is the only type whose home node sits immediately clockwise of the top, which
>   is why it was the only diagram affected — and why it survived review. Fixed with a general rule,
>   not a Type-1 special case.
> - **The 5px minimum was never met.** Real measured clearance was **4.47px**. The 5.88px figure
>   reported earlier in PR 1 was arithmetic over font size, not a measurement — it appeared in an
>   evidence table looking like one, and it was concealing a live failure.
> - **A second defect surfaced only on render.** The first fix stacked two-line labels above the
>   node; that pushed the eyebrow off-canvas and Chromium clipped it on four diagrams (WINGS 1,
>   WINGS 8, LINES 3, LINES 6).
> - **The 27.7px label-to-label minimum is not met either.** Measured minimum gap between distinct
>   labels is **24.12px** (tightest pair: WINGS · TYPE 4, "3 WING / The Performer" against "YOUR
>   HOME BASE"). Nothing overlaps, so this is a tighter layout than advertised rather than a defect.
>   Note that TYPE 4's labels are placed entirely by the horizontal rule and are untouched by the
>   placement change below, which suggests the 27.7px figure was not met by the original either.
>
```

**The 27.7px figure is inside `~~strikethrough~~` and the blockquote withdraws it explicitly.**
The measured replacement is **24.12px**, and the gate asserts **non-overlap**, not any figure.

### 23.3 §4.3 — corrected by me

**Before `ddd5043`** the section was four short paragraphs asserting the v3 mockup "has been
wrong about client data twice" — a mirrored figure missing node 2, and SP9 throughout — closing
with "Anything sourced from v3 must be verified against the coach report or production output."
**No date, no scope, no retraction.**

**Now:** all of that is struck, with a dated correction scoping it to the earlier draft and
keeping the two cautions that are still true (synthetic scores; the §3.2 transparency
violation). Current text:

```
### 4.3 v3 mockup is unreliable as a source

~~The v3 client report mockup has been wrong about client data twice:~~

- ~~Its Enneagram figure is mirrored (counterclockwise numbering) and **missing node 2** entirely,
  which also makes the interior lines wrong.~~
- ~~It labels Anders **SP9** throughout, including the TOC. The coach report gives SP 66 / SO 64 /
  **SX 84**, and the production client report says One-to-One Nine.~~

~~Anything sourced from v3 must be verified against the coach report or production output.~~

> **Post-lock correction — 8 Sep 2026. THIS SECTION DESCRIBES AN EARLIER DRAFT, NOT THE TRACKED
> REFERENCE IMPLEMENTATION.** Both charges above are **false of
> `docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html`**, the sheet-5 file this section's
> warning is most likely to be read against. Confirmed on the HTML, not on the rendered PDF, since
> node positions are literal attributes there (PR 5 audit §6.3):
>
> - **Nine nodes, node 2 present, clockwise.** Node 2 is at `cx=283.4 cy=131.8`; the sequence from
>   9 at the top runs **9-1-2-3-4-5-6-7-8**, matching `CLIENT_ANGLES`. Twelve `<circle>` elements:
>   the outer ring at r=105, nine nodes at r=21, two decorative rings at r=27.
> - **SX, not SP9.** The instinct panel marks the `SX` row `.irow.pri` with rank `Primary`; bar
>   widths are 66 / 64 / 84, matching the coach report's SP 66 / SO 64 / SX 84. The subtype panel
>   reads "The One-to-One Nine".
>
> As written, this section warns against the exact file PR 5 must port from. **Scope it to whatever
> earlier draft it was written against, and do not apply it to the twelve tracked mockups.**
>
> **Two cautions about that file remain true and are not withdrawn:**
>
> 1. **Its client scores are synthetic.** `docs/mockup_file_manifest.md` lists Anders at
>    9:90 · 5:85 · 1:75 · 8:55 · 3:50 · 2:48 · 7:42 · 4:40 · 6:35. The tracked fixture
>    `anders_sx9_api_result.json` has **91 · 83 · 74 · 52 · 47 · 44 · 38 · 35 · 31** — same
>    ordering, different numbers. The mockup's `fill-opacity` values were computed from numbers
>    that are not in the fixture, so a port with real data will not reproduce them, and that is
>    not a regression.
> 2. **Its SVG violates §3.2.** `fill-opacity` on all nine heat-map nodes plus a `stop-opacity`
>    gradient. Measured through the pinned Chromium with `verify_transparency.js`'s own scanner:
>    **1 transparency group, 1 soft mask, 8 non-opaque alphas.** The gate catches it; the SVG must
>    be re-expressed as opaque solids on white before it ships.
```

### 23.4 §5.3 — corrected by me

**Before:** "Orange appears in exactly four places: the client's name in every page header, the
cover identifier, the subtype identifier and column, and the \"In Your Responses\" block."

**Now:**

```
### 5.3 The colour rule

**Blue-grey means the framework. Orange means the client.**

Orange appears in exactly ~~four~~ **five** places: the client's name in every page header, the
cover identifier, the subtype identifier and column, the "In Your Responses" block, and **the p5
instinct bars**. A client can find what is about *them* without reading. This must not be diluted.

> **Post-lock correction — 8 Sep 2026. THE ENUMERATION WAS INCOMPLETE; THE RULE IS UNCHANGED.**
> [DECISION — Cai, 8 Sep 2026] The Quick Reference instinct bars are a fifth place orange appears
> — `#F68625` on the primary bar, `#F5D2AC` on the other two. **Orange still means the client**,
> and these bars are the client's own instinct scores, so the principle holds; the list was written
> before p5 existed and simply did not contain them. This amends the count, not the rule.
>
> The subtype panel's header (`#F9E7D2` / `#C2650F`) needs no new entry — it is already covered by
> "the subtype identifier and column".
>
> **Nothing asserts this rule today** (PR 5 audit §7.5): `grep -rn "F68625" scripts/ tests/`
> returns zero hits, and the only colour gate in the repo is `verify_coach_baseline.js`'s
> normalised **coach** PDF hash, which does not cover client pages. If an assertion is wanted, the
> durable one is scoped to the figure — **no `#F68625` inside the heat-map SVG** — which catches a
> ramp built by copy-pasting the instinct bar's fill and leaves the legitimate bar usage alone.

```

### 23.5 §7.2 — corrected by me (bullet 4 only)

**Before:** `- **The four debrief tips (p5)** — explicit placeholders.`

**Now:**

```
- ~~**The four debrief tips (p5)** — explicit placeholders.~~

  > **Post-lock correction — 8 Sep 2026. CLOSED.** [DECISION — Cai, 8 Sep 2026] **The mockup copy
  > is final.** The four tips ship as rendered in
  > `docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html:151-156`, including the reworded
  > "Ask about the alternate" (see §7.3). They are not placeholders and are not to be re-authored.
  > Measured on the tracked mockup: all four render **2 lines** in the `.ttxt` box at 329px,
  > `.tcol` intrinsic height 87px.
- ~~**All Type 9 practice bullets (p7).** ⚠️ **Still open, for a changed reason.** The mockup's
```

The rest of §7.2 is unchanged, including its own 4 Sep correction closing the Type 9 p7 rows.

### 23.6 §7.3 — two bullets corrected by me, one left stale

```
### 7.3 Known content gaps

- **Types 1, 4, 7 and 9 are authored (20 Aug 2026). Five remain: 2, 3, 5, 6, 8.** Sheets 6-7 are
  gated to the authored set by `V3_EXPLORE_PILOT_TYPES` (`app/renderer.js`) and
  `EXPLORE_PILOT_TYPES` (`scripts/build_content_library.js`) — two lists that must agree, flagged
  in both files for collapse when the remaining five land.
- ~~The subtype signature (`Merging & Intensity`) is a new three-part naming convention: formal name,
  nickname, two-word signature. Only the three Type 9 subtypes exist.~~

  > **Post-lock correction — 8 Sep 2026. CLOSED — ALL 27 EXIST.** The three-part convention is
  > complete and landed in PR 4. Counted in `app/content/content_library.json`, not inferred
  > (PR 5 audit §3.2): formal name (`subtype_*.name`) **27/27**; nickname (`subtype_*.tagline`
  > prefix) **27/27**; two-word signature (`subtype_*.instincts_v3.signature`) **27/27**. The
  > narrative that accompanies them is likewise **27/27**. Spot values: SO1 `Non-Adaptability ·
  > Standards & Systems`, SP7 `Keepers of the Castle · Abundance & Options`, SX9 `Fusion ·
  > Merging & Intensity`.
  >
  > This is **not a content blocker** for any page that reads naranjo and signature, which is what
  > the sentence above was being used to argue.
- ~~One "In Your Responses" bullet on p5 — "Ask about the alternate" — only makes sense when a second
  pattern scored close. As global static content it needs to hold for a client whose leading type is
  20 points clear, or become conditional.~~

  > **Post-lock correction — 8 Sep 2026. CLOSED, AND THE SENTENCE MISNAMED THE ZONE.** Two errors,
  > corrected together.
  >
  > **The zone.** "Ask about the alternate" is one of the **four debrief tips** on p5, not an "In
  > Your Responses" bullet. "In Your Responses" is the `#FDF3E9` evidence block with a 3px
  > `#F68625` left border defined in §5.2, and it **does not appear on p5 at all** — a reader
  > following this sentence would go looking for a zone that is not on the page.
  >
  > **The conditionality.** [DECISION — Cai, 8 Sep 2026] The tip is **always included, with no
  > conditional display logic**, and its copy is final (see §7.2). It no longer needs to hold as a
  > claim about closeness, because the alternate caption beside it no longer makes one — the locked
  > caption reads "Type {alternate} is the alternate worth exploring with your coach", which
  > asserts only that the alternate is the alternate. It therefore holds at any gap, including the
  > 20-points-clear case this bullet was written about.
  >
  > With this, **p5 carries no conditional content in any zone.**
```

**Note the first bullet is untouched and is stale** — see §19.4. It claims five types remain
unauthored; §7.4's 4 Sep correction in the same document says all nine are authored.


## 24. Commits

Enumerated at the end of the run. No push, no PR, no merge, no branch deletion.

| # | SHA | Message |
|---|---|---|
| 1 | `8ec97e7` | PR 5 audit: Quick Reference (sheet 5 / footer 3) — §§1–11 |
| 2 | `8e553e4` | PR 5 audit: record the commit set — the commits section, since renumbered |
| 3 | `2ac1add` | PR 5 audit addendum: content sources and the reopened P2 — §§12–18 |
| 4 | `ddd5043` | **Spec v3.0: five post-lock corrections, 8 Sep 2026** — the only commit that touches a file other than this document |
| 5 | `eb856b9` | PR 5 plan detail: revalidate the sequence — §§19–23 |
| 6 | `7843749` | PR 5 plan detail: close the section-numbering gap |
| 7 | `e877c53` | **Spec v3.0: §7.3 bullet 1 — the sixth correction** |
| 8 | `a9eaf33` | PR 5: bring §24's commit table current before the docs merge |
| 9 | *this commit* | PR 5 Phase B: commit the merge predictions before pushing (§25) |

Commit 9's SHA is in the build response and in `git log --oneline main..HEAD`; a commit cannot
record its own SHA, and amending one to insert it just produces a new SHA and a stale table.

**Commit 7 is the sixth spec correction**, added 8 Sep after the check in its own message: §7.3's
first bullet did not merely name a stale count, it pointed at **two constants that no longer
exist**. `V3_EXPLORE_PILOT_TYPES` and `EXPLORE_PILOT_TYPES` were **deleted** at `c1d5183`
(4 Sep 2026), not collapsed to nine — `grep -rn "PILOT_TYPES"` returns zero hits in any `.js` file.
Sheets 6-7 are unconditional, and the blank-page guarantee moved from a filter in `v3PagesFor` to a
throw in the render functions. **Six spec corrections now, not five.**

**Two files on the branch, and the split is deliberate** — commit 4 is the spec, alone, so it can be
reviewed, reverted or cherry-picked independently of the audit. Everything else is this document.
Branch `pr-5-quickref-audit`, off `main @ f385c9a`, unchanged across all three runs.

`[JUDGMENT]` **On whether the spec corrections belong in their own docs PR** — Cai offered the split
and asked me to say rather than do. **My recommendation is to keep them here**, for one reason: every
correction cites a measurement that lives in this document on this branch, and separating them puts
the correction and its evidence in different PRs. This branch is docs-only today, so there is no
code to entangle them with.

**One condition, and it is the failure mode the original prompt named.** If Builds 1 and 2 branch
off `main` rather than continuing here, this branch must merge **first**, as a docs PR — otherwise
the corrections are stranded on a branch nobody merges, which the opening prompt says has happened
twice on this project.

---

## 25. Phase B — predictions, committed before the push

**Committed 8 Sep 2026, before the branch was pushed and before any PR existed.** A deviation from
anything below is a **finding**, not a licence to edit this section. Nothing here is copied from a
prompt; every figure is measured on this machine or read out of the workflow file.

### 25.1 What will and will not run

| Prediction | Basis |
|---|---|
| **Exactly one workflow** — `.github/workflows/report-verify.yml`. `ls .github/workflows/` returns one file. | `[MEASURED]` |
| **Exactly one job**, `verify`, on `ubuntu-latest`, `timeout-minutes: 15`. | `[MEASURED]` |
| **The bare branch push triggers ZERO runs.** Triggers are `pull_request:` and `push: branches: [main]`. `pr-5-quickref-audit` is neither. | `[MEASURED]` — workflow lines 17-20 |
| **Opening the PR triggers exactly ONE run**, on the `pull_request` event. | `[MEASURED]` |
| **All 11 steps run. NONE skip.** There are no `paths:`/`paths-ignore:` filters and no step-level `if:`. A docs-only diff runs the entire suite — six gates, Chromium, 27+ renders. | `[MEASURED]` — grep for `paths` returns nothing |
| **Merging triggers a SECOND run** on the `push: branches: [main]` event, against the merge commit. | `[MEASURED]` |
| **The next PR number is #94.** Last merged is #93 (PR 4 step 6B, 2026-09-08T00:04:39Z). | `[MEASURED]` |

### 25.2 Wall-clock

Every gate timed on this machine (macOS, Chromium 147.0.7727.57) immediately before the push, all
six green:

| Step | Local | Predicted CI |
|---|---|---|
| `npm test` (7 test files, 27 tests) | **0.31s** | ~2s |
| `npm run verify:render` | **52.53s** | ~81s |
| `verify_diagrams.js` | **0.95s** | ~2s |
| `verify_transparency.js` | **2.89s** | ~5s |
| `verify_coach_baseline.js` | **2.85s** | ~6s |
| `verify_content_library.js` | **0.22s** | ~1s |
| **Gate compute subtotal** | **59.75s** | **~97s** |

CI scaling factor **1.55×** on the render-bound steps, taken from `docs/audit_pr3_per_type_pages.md`
(1.409 s/render locally against ~2.19 s/render in CI), not guessed. Plus setup, which does not scale
the same way: checkout ~5s, `setup-node@v4` ~5s, `apt-get update && install fonts-liberation` ~20s,
Puppeteer cache restore ~10s (expect a **hit** — `app/package-lock.json` is unchanged on this
branch, so the key matches `main`'s), `npm ci` ~30s.

> **Point estimate: 3m00s. Predicted range 2m30s – 4m30s.** Same for both runs; the merge-commit run
> does identical work. Anything over 5m or under 2m is a finding.

**One asymmetry predicted explicitly:** `verify_coach_baseline.js` reported *"ALL PASSED — HTML only
(PDF half skipped off-Linux)"* locally. **On CI the PDF-hash half will also run**, so that step does
strictly more work there than it did here. Predicted still green: `tests/baselines/coach_*.pdf.sha256`
was recorded on Linux and this branch changes no code.

### 25.3 The merge

| Prediction | Value |
|---|---|
| Files changed | **2**, both `.md` |
| Line delta | **+2375 / −18** (2393 changed) |
| Paths | `docs/audit_pr5_quickref.md`, `docs/hive_insightout_client_report_design_spec_v3_0.md` |
| Non-`.md` paths | **0** |
| Merge commit parents | **2** (`--no-ff`, no squash, no rebase) |
| Commits landing on `main` | **9** |

**These are the figures as of commit 8 (`a9eaf33`).** This commit adds §25 and updates §24, so the
final numbers will be **larger by this commit's own diff** — one file, `docs/audit_pr5_quickref.md`.
The file count stays **2** and the non-`.md` count stays **0**; only the insertion count moves. Said
here rather than after the fact, so the discrepancy is predicted rather than explained.

### 25.4 Conclusions

**Every step of both runs: `success`.** Basis — the branch is docs-only (asserted two ways in Phase
A: the aggregate `main...HEAD` diff and a per-commit `--name-only` sweep across all eight commits),
and all six gates are green on this machine at this HEAD. No `.js`, `.json`, fixture, baseline,
lockfile or workflow file is touched, so there is no mechanism by which a gate's subject could have
changed.

**If any step fails, that is the finding**, and it means the docs-only assertion was wrong or CI is
testing something the local run does not.

---

## 26. Step 4 — the 27 subtype summaries, measured

> **⚠ SUPERSEDED IN PART BY §27 (amendment, same day).** SX5 was revised after this section was
> written and the word that set `m = 41` is gone from the shipping set. **`m` is now 44 and the
> recommended ceiling is 132, not 123.** Every measurement below stands as a correct record of the
> set as it was on 8 Sep; the ones that no longer describe a live constraint are marked inline.
> Read §27 before quoting any ceiling from here.

**Branch** `pr5-step4-subtype-measure`, base `90640b8`. Predictions committed first at `6acef77`
(`docs/predictions_pr5_step4.md`), before any browser launched. This section is the result.

**No product code changed. No client prose entered the repo.** The 27 strings were injected at
runtime by replacing `.stxt`'s `textContent` in the loaded page; the mockup file on disk is
untouched — blob `813e871` at base, at the predictions commit, and here. The measurement harness
lives in the session scratchpad and is not committed, because it embeds the strings.

**One deliberate exception, stated rather than slipped in.** The single word `compartmentalizing`
appears below. It is one common English word, not prose, and it is the measured cause of the
narrowest full line in the set — the number the recommended ceiling is derived from. Without it the
finding in §26.4 is unverifiable. No sentence, clause or phrase from the 27 appears anywhere in this
repo; a scan of this branch's full diff against `main` for eleven distinctive phrases from the set
returns nothing.
>
> **Amendment note.** That word is no longer in any shipping string — see §27.A. It is retained here
> because §26.4 is now a record of why `m` **was** 41, and deleting the evidence would leave the
> finding unverifiable while the conclusion it supports — that the ceiling is conditional on word
> width — is still live.

### 26.1 What is wrong with the ask — read this before the numbers

**① The premise that some of the 27 fail is false. Zero of them render at 4 or more lines.** The
step-4 brief asked for the table sorted descending "so the failures are at the top." There are no
failures. Fifteen render at 3 lines, ten at 2, two at 1. The longest string in the set, SO5 at 161
characters, lands at exactly 3 lines with its widest line at 300.17 px in a 308.00 px box — 7.83 px
of slack. Cai and Mo have already written inside the bound. The ceiling below is for *future*
authoring and for the rewrite that a page build may force; it is not triage of this set.

**② M4's SAFE CEILING formula is unsound, and it is unsound in a way that would cost real copy.**
`3 × (min chars-per-line)` takes the minimum of a *per-string average* — chars ÷ lines — and that
average is depressed by short terminal lines, which say nothing about how much text a line holds.
The minimum is set by SP6 at 34.00, and SP6 hits 34.00 only because its 68 characters break 57 / 10:
its second line carries one word. The resulting ceiling, **102**, would reject **17 of the 27
strings that demonstrably fit**, six of them by more than 20 characters, including SO5 which fits by
7.83 px. A rule that rejects the whole measured sample is not a safe rule, it is a broken one.

The number that actually follows from greedy line-breaking is the **minimum full-line char count**.
If a string wraps to 4 lines, its first 3 lines are by definition full — a further word would
overflow. So `chars ≥ 3 × m`, where `m` is the smallest number of characters a full line can carry.
Terminal lines are excluded because they are never full. That method is used below and it is the
number this pass recommends. It was named as the recommendation in the predictions file, before the
data — see P3.3 — so it is a method disagreement, not a result picked after the fact.

**③ Neither ceiling is unconditionally sufficient, and "sufficient, not necessary" understates it.**
*(The conclusion here is unchanged and still live. The specific string is not: SX5 was revised and
`m` is now 44 — §27.B. The mechanism below is exactly why the amendment was needed, and it is the
best evidence in this document that a ceiling moves when one word changes.)*
The brief asks the report to say the ceiling is a sufficient condition. It is weaker than that: it
is sufficient *conditional on the character mix and the maximum word length staying close to the
sample's*. `m = 41` **was** set by SX5's second line as that string then stood, and that line stopped
at 41 characters (218.19 px in a 308.00 px box, 89.81 px left empty) for one reason — the next word is **"compartmentalizing"**, 18
characters, **108.39 px, 35.2 % of the box width**. A 22-character word would push `m` lower and the
ceiling with it. The only *unconditionally* sufficient char ceiling is the widest-glyph bound:
`3 × floor(308.00 / 11.7984)` = **78**, where 11.7984 px is the measured advance of `W`. That is
correct, useless, and 40 % below what the sample actually sustains. Say "safe for prose like this
prose," and mean it.

**④ "Ceiling" presupposes monotonicity, so it was checked rather than assumed.** Across all 351
ordered pairs of the 27, no string renders on more lines than a longer string. It holds here. It is
a property of this sample, not a law — a single wide word can invert it — so the OBSERVED CEILING
below is quoted with that check attached rather than left implicit.

### 26.2 M1 — the box

Chromium 147.0.7727.57 (pinned, bundled, via `app/browser_launch.js`), viewport 816 × 1056,
`emulateMediaType('print')`, `document.fonts.ready` awaited.

| Property | Value | Label | Counting basis |
|---|---|---|---|
| `.stxt` content width | **308.00 px** | `[MEASURED]` | `clientWidth − paddingLeft − paddingRight`, the `contentBox` helper in `scripts/lib/line_metrics.js`. `getBoundingClientRect().width` agrees at 308.00 — the box is not content-shrunk. |
| Width invariance across all 29 injections | **308.00 px, every one** | `[MEASURED]` | `.half` is `flex:1` = `flex:1 1 0%`, basis 0 and equal grow, so the halves split the row regardless of content. Asserted, not assumed: every per-string number below shares one width. |
| `font-family` resolved | **`Arial, sans-serif`** — Arial, no substitution | `[MEASURED]` | `bl.assertReportFont` advance probe returned **2378.80859375 px**, against the genuine-Arial constant **2378.81** — Δ **0.0014 px**. Liberation Sans reproduces this; DejaVu Sans does not. |
| `font-size` | **12.5 px** | `[MEASURED]` | `getComputedStyle`, from `.stxt{font-size:12.5px}` |
| `line-height` | **18.75 px** | `[MEASURED]` | `getComputedStyle`, `1.5 × 12.5` |
| `font-weight` / `letter-spacing` / `word-spacing` | **400 / normal / 0 px** | `[MEASURED]` | no tracking adjustments in play |

Derivation of 308.00 from the stylesheet, so the number is checkable without a browser: `.page` 816
− 2 × 53 padding = 710; `.two` is `display:flex; gap:18px` with two `flex:1` children → 346 each;
`.half` has a 1 px border each side → 344; `.hbd` has `padding:16px 18px` → **308**. `[DERIVED]`,
and it agrees with the measurement exactly.

Selected Arial advances at 12.5 px, used by the bounds above. `[MEASURED]` — width of a 20-character
repeat ÷ 20, in a `white-space:pre` span inheriting `.stxt`'s font:

| `W` | `M` | `m` | `w` | `O` | `A` | `e`/`o`/`n` | space | `i`/`l` |
|---|---|---|---|---|---|---|---|---|
| 11.7984 | 10.4133 | 10.4133 | 9.0273 | 9.7234 | 8.3375 | 6.9523 | 3.4734 | 2.7773 |

### 26.3 M2 — the 27

Sorted by line count descending, then char count descending.

- **lines** `[MEASURED]` — `Range.selectNodeContents(.stxt)` → `getClientRects()`, rects with
  `width > 0 && height > 0`, merged by top edge rounded to 0.5 px, sorted by top. The established
  method, identical to `lineRects` in `scripts/lib/line_metrics.js`. Not box height.
- **chars** `[MEASURED]` — `textContent.replace(/\s+/g,' ').trim().length`, the same basis as
  `measureZones`. Includes spaces and terminal punctuation.
- **widest line** `[MEASURED]` — merged rect `right − left`, 2 dp.
- **per-line chars** `[MEASURED]` — one `Range` per character index; a space collapsed at a wrap has
  a zero-width rect and is counted on neither line. So `Σ lineChars + (lines − 1) = chars`, which
  held for all 27 with no exceptions — the arithmetic check is what makes the per-line split
  trustworthy.
- **chars/line** `[DERIVED]` — chars ÷ lines. The average basis. See §26.1 ② for why it misleads.

⚠ **The SX5 row is the pre-revision string.** Revised SX5 is 120 chars at 3 lines breaking
50 · 50 · 18 — §27.A. The row is kept as the measured record of what was in the doc on 8 Sep.

| # | lines | chars | widest line px | chars/line | per-line chars |
|---|---|---|---|---|---|
| SO5 | 3 | 161 | 300.17 | 53.7 | 50 · 55 · 54 |
| SO1 | 3 | 148 | 298.80 | 49.3 | 52 · 52 · 42 |
| SO3 | 3 | 130 | 297.39 | 43.3 | 56 · 55 · 17 |
| SX5 ⚠ | 3 | 130 | 271.23 | 43.3 | 50 · **41** · 37 |
| SO8 | 3 | 126 | **307.69** | 42.0 | 55 · 54 · 15 |
| SP1 | 3 | 125 | 298.31 | 41.7 | 55 · 50 · 18 |
| SO7 | 3 | 120 | 294.63 | 40.0 | 45 · 53 · 20 |
| SX4 | 3 | 119 | 301.56 | 39.7 | 45 · 56 · 16 |
| SP7 | 3 | 118 | 304.59 | 39.3 | 54 · 54 · 8 |
| SX3 | 3 | 117 | 300.84 | 39.0 | 52 · 54 · 9 |
| SX7 | 3 | 114 | 301.11 | 38.0 | 53 · 51 · 8 |
| SX9 | 3 | 114 | 301.88 | 38.0 | 52 · 48 · 12 |
| SP2 | 3 | 113 | 295.31 | 37.7 | 48 · 54 · 9 |
| SO4 | 3 | 112 | 260.14 | 37.3 | 47 · 44 · 19 |
| SP5 | 3 | 112 | 278.91 | 37.3 | 50 · 52 · 8 |
| SP4 | 2 | 110 | 306.70 | 55.0 | 54 · 55 |
| SX2 | 2 | 108 | 307.14 | 54.0 | 51 · 56 |
| SO6 | 2 | 101 | 292.53 | 50.5 | 44 · 56 |
| SX1 | 2 | 97 | 289.30 | 48.5 | 50 · 46 |
| SX8 | 2 | 93 | 305.98 | 46.5 | 55 · 37 |
| SO2 | 2 | 89 | 304.61 | 44.5 | 53 · 35 |
| SX6 | 2 | 87 | 302.52 | 43.5 | **57** · 29 |
| SP8 | 2 | 85 | 298.33 | 42.5 | 53 · 31 |
| SP3 | 2 | 78 | 299.72 | 39.0 | 54 · 23 |
| SP6 | 2 | 68 | 303.22 | **34.0** | **57** · 10 |
| SP9 | 1 | 52 | 291.41 | 52.0 | 52 |
| SO9 | 1 | 51 | 284.50 | 51.0 | 51 |

**Strings rendering at 4 or more lines: NONE.** `[MEASURED]` — stated explicitly because M2 asked
for it explicitly. The set maximum is 3.

`[AGGREGATE]` — line distribution **1 line: 2 · 2 lines: 10 · 3 lines: 15 · 4+ lines: 0**; total
rendered lines **67** across 2878 characters.

**Quote-form sensitivity `[MEASURED]`.** Two strings carry quote marks and the transcription used
straight forms. Both were re-measured with curly forms (`'` → `’`, `"…"` → `“…”`): SP5 3 lines,
278.91 → 279.08 px; SO8 3 lines, 307.69 → 307.14 px. Line counts unchanged, widths move by
< 0.6 px. **The typographic form of the quotes does not affect any conclusion here** — but SO8's
widest line is the widest in the whole set at 307.69 px in a 308.00 px box, **0.31 px of slack**, so
if the authoring doc's punctuation normalisation ever changes that line's characters, SO8 is the
string that wraps first.

### 26.4 M3 — chars per line

**Average basis** — chars ÷ lines, per string, as M3 specifies. `[AGGREGATE]` over 27 strings:

| | value | string |
|---|---|---|
| min | **34.00** | **SP6** — 68 chars breaking 57 / 10 |
| median | **42.50** | — |
| max | **55.00** | SP4 — 110 chars breaking 54 / 55 |
| mean, pooled (2878 ÷ 67) | **42.96** | — |

**SP6 is the worst case only in the sense M3 means, and it is not a worst case at all.** Its *first*
line carries **57 characters**, the joint-widest in the set. It scores 34.00 because its last word
sits alone on line 2. Nothing about SP6 tells you a line is hard to fill; the opposite.

**Full-line basis** — the 40 non-terminal lines across the 27, which are the only lines that were
actually filled to the wrap. `[AGGREGATE]`:

| | chars | width px |
|---|---|---|
| min | **41** — SX5 line 2 | 218.19 |
| median | 52.5 | 295.79 |
| mean | 51.63 | — |
| max | **57** — SP6 line 1, SX6 line 1 | 307.69 (SO8 line 2, 54 chars) |

**The worst case in the set as measured on 8 Sep was SX5's second line: 41 characters, 218.19 px,
89.81 px of the box left empty.** The cause was measured, not guessed — the following word was
`compartmentalizing`, rendering at **108.39 px**, **35.2 %** of the 308.00 px box, the widest word
anywhere in the 27. Next widest at that time: `attractiveness` 77.13 px, `indispensable` 76.45 px,
`expectations.` 73.67 px.

> **⚠ This is now a historical finding, and §27.B is the live one.** SX5 was revised; the word is
> gone; that 41-character line no longer exists in any shipping string. **`m` is 44 and the ceiling
> is 132.** The paragraph is kept in place rather than rewritten because it is the derivation of the
> ceiling's conditionality, and that conclusion did not change — it was *confirmed*. One word left
> one sentence and the safe ceiling moved 9 characters.

**The general finding is unchanged and is the durable one: a single long word costs more line
capacity than any other property of the copy**, and it is the one thing authors can control without
counting characters. §27.B measures the same effect at a smaller magnitude in the corrected set.

### 26.5 M4 — the ceilings

| Ceiling | Value | Label | Basis, and exactly what it licenses |
|---|---|---|---|
| **OBSERVED** | **161 chars** | `[MEASURED]` | The highest char count among the 27 still at ≤ 3 lines — **SO5**, and it is the longest string in the set, so the sample never found the wall. Holds **for this sample only**. Meaningful as a "ceiling" only because line count is monotone in char count across all 351 pairs here (§26.1 ④); it is not a licence to write a 28th string at 161. |
| **SAFE, prompt formula** | **102 chars** | `[DERIVED]` | `3 × 34.00` (min chars-per-line, average basis), floored. **Not recommended.** It rejects 17 of the 27 measured-good strings. See §26.1 ②. |
| **SAFE, full-line method** ⚠ **superseded — see §27.B2** | ~~123 chars~~ → **132** | `[DERIVED]` | `3 × 41` (min full-line char count), floored, **on the pre-revision set**. A string of ≤ 123 characters cannot reach 4 lines, because reaching 4 lines requires 3 full lines and no full line in this sample carried fewer than 41. Sufficient, **conditional on word widths staying within the sample's** — no word wider than `compartmentalizing`'s 108.39 px. |
| **Unconditional bound** | **78 chars** | `[DERIVED]` | `3 × floor(308.00 / 11.7984)`, the measured `W` advance. True for any character mix, assuming no single word exceeds the box width. Recorded to show the price of an unconditional guarantee; not proposed as the rule. |
| **Practical wall** | **166 chars** | `[MEASURED]` | Most characters observed at ≤ 3 lines across 900 synthetic neutral-prose candidates. Vocabulary-dependent and an upper bound only for prose of that shape — short words pack more characters per line because a space is 3.4734 px against ~6.95 px for a typical lowercase letter. `[DERIVED]` companion: `3 × 57 + 2` = **173**, from the widest full line observed. |

⚠ **The guidance below is superseded. §27.B3 carries the version to give Mo.** It is left here so
the change is legible: the ceiling was 123, the render-first band held six strings, and both moved.

> ~~**The guidance to hand Cai and Mo, in one line:** *write to **123 characters** and you never need
> a render; between 124 and 161 the sample says you are fine but the string must be rendered before
> it ships; avoid words longer than about 16 characters.* Six of the current 27 sit in the 124–161
> band — SP1 125, SO8 126, SO3 130, SX5 130, SO1 148, SO5 161.~~

**This is a sufficient condition, not a limit.** A string over 123 characters is not too long. Nine
of the 27 exceed the 102-char figure and every one of them fits. Character count does not predict
line count; it only bounds it.

### 26.6 M5 — the caveat, and what the page build must re-confirm

**`_clv3QuickRef` does not exist on `main`.** `[MEASURED]` — the `_clv3*` builders in
`app/renderer.js` are Contents, Cover, Instincts, Lines, Thoughts, TypeA, TypeB, Welcome, WhatIs,
Wings. There is no QuickRef, and the string `stxt` does not appear in `app/renderer.js` at all.
`V3_PAGE_ORDER` reserves sheet 5 (`{ key: 'quickref', sheet: 5, footer: 3 }`, `app/renderer.js:3362`)
with a title and a footer number and nothing behind it.

**So the box measured here is the MOCKUP's box, and every number in §26.2 through §26.5 is
downstream of one quantity: 308.00 px.** Chars per line scales with width; the ceilings are 3 ×
a chars-per-line figure. If the built page produces a box 20 px narrower, roughly 7 % of the
capacity goes, `m` falls from 41 toward 38, and the recommended ceiling falls from 123 toward 114 —
at which point SO5, SO1, SX5, SO3, SO8 and SP1 are all above it and must be re-rendered rather than
trusted.

**What the page build must re-confirm, before any of these numbers is quoted as a constraint:**

*(Item 6 was added by the amendment. Items 1–5 are unchanged and still live.)*

1. **The `.stxt` content width is 308.00 px in the built page.** Not "about 308" — the same number,
   measured the same way (`clientWidth` minus horizontal padding). If it differs, §26.3 through
   §26.5 are re-run, not adjusted.
2. **`font-size: 12.5px` and `line-height: 1.5`** survive into the built stylesheet. Line count is a
   function of both; the 3-line bound is worth 56.25 px of stack.
3. **The 3-line bound still holds at the page level.** The 22.03 px headroom at 3 lines and 3.28 px
   at 4 (§17.4, measured 8 Sep on this mockup) are whole-page figures. Any other zone that grows on
   the built page spends the same headroom, and the subtype panel is not the only thing on sheet 5.
4. **The two `.half` columns still split the row evenly.** The width invariance in §26.2 rests on
   `flex:1 1 0%`. If the built page gives the instincts half a fixed width, the subtype half is a
   different box and 308.00 is wrong.
5. **Re-render the strings above the ceiling.** Not the whole 27 — only those the ceiling does not
   cover on its own. ⚠ **That set is now two, not six: SO5 (161) and SO1 (148)** — §27.B3.
6. **Which quote form the CMS actually stores for SO8, and re-measure SO8 in that form against the
   real `.stxt` box.** The fact, stated here so §26.6 is checkable without opening the amendment:
   **SO8's two quote forms render at different widths — straight U+0022 at 307.69 px, curly
   U+201C/U+201D at 307.14 px, a delta of −0.55 px, and SO8 has only 0.31 px of slack in the wider
   form.** `[MEASURED]`, §27.C. The form that was measured in §26.3 is the *straight* one; the form
   in the authoring doc is *curly*, which is the narrower and safer of the two. This is the only
   string in the set where the choice of quote glyph is worth more than a rounding error, and it is
   the string with the least slack. If the CMS normalises curly to straight on ingest, SO8 goes from
   0.86 px of slack to 0.31 px on a box whose width is itself unconfirmed.

### 26.7 Committed synthetics — render-matched, no client prose

Two strings are committed here so a future gate can assert the worst cases without client copy in
the repo. **They are machine-generated word sequences selected for their rendered geometry. They
carry no meaning and are not copy.** Matched on the **render** — line count and line widths — not on
character count, as the step-4 brief specifies.

**Synthetic A — matched to the tightest 3-line case (referent: the 161-char string, label SO5):**

> `derived for over under table over figure output on measured those in table build sample margin of panel these into on number author from sheet with measure.`

| | lines | line widths px | per-line chars | chars |
|---|---|---|---|---|
| referent | 3 | 271.23 · 296.72 · 300.17 | 50 · 55 · 54 | 161 |
| **Synthetic A** | **3** | **271.02 · 296.72 · 300.17** | 50 · 52 · 52 | 156 |
| Δ | 0 | **−0.21 · 0.00 · 0.00** | — | −5 |

`[MEASURED]`. Lines 2 and 3 are **bit-identical in width**; line 1 is 0.21 px narrower — **0.08 %**.
Char count deliberately differs, per the brief.

**Synthetic B — matched to the narrow-full-line case that set the safe ceiling *on the pre-revision
set* (referent: the 130-char string, label SX5).** ⚠ **Its referent line no longer exists in any
shipping string.** B is no longer a fixture for a live constraint; §27.D1 states what it is a fixture
for now, and §27.D2 adds **Synthetic C**, which is the fixture for the current `m`.

> `typography proportionality counterbalancing block value basis measure and in measure of counterbalancing version author figure.`

| | lines | line widths px | per-line chars | chars |
|---|---|---|---|---|
| referent | 3 | 271.23 · **218.19** · 216.09 | 50 · **41** · 37 | 130 |
| **Synthetic B** | **3** | 275.17 · **218.19** · 216.11 | 49 · 37 · 39 | 127 |
| Δ | 0 | +3.94 · **0.00** · +0.02 | — | −3 |

`[MEASURED]`. **The line that matters — the narrow full line at 218.19 px — matches exactly**, and
line 3 to 0.02 px. Line 1 is 3.94 px wider (**1.45 %**), so **B is a match on the constraining line
and a near-match on the others, and is reported as such rather than as an exact match.** It
reproduces the mechanism: `counterbalancing` renders at a width that strands line 2 the same way
`compartmentalizing` does.

### 26.8 The coach byte-diff

**`verify_coach_baseline.js` does not apply to this pass.** `[MEASURED]` — the branch diff against
`main` is `docs/` only; no `.js`, no fixture, no baseline, no template. The gate's subject is the
coach-portal render path, and nothing on this branch can reach it.

It was run anyway, as a control. **`COACH BASELINE: ALL PASSED — HTML only (PDF half skipped
off-Linux).`** In the brief's own words: **this is a HALF-RESULT, not a pass.** The PDF-hash half
skipped on every fixture — `normalized PDF hash SKIPPED (platform is darwin, not linux)` — because
the embedded fonts differ from production. The HTML half was byte-identical on every fixture. The
PDF half runs on CI, on Linux, and only that run is a full result.

### 26.9 Predictions versus measurement

Predictions are at `6acef77`, `docs/predictions_pr5_step4.md`. **11 of 20 hit, 9 missed.** The
misses are listed as findings, not corrected in the predictions file.

| # | Predicted | Measured | |
|---|---|---|---|
| P0.1 | 308.00 px | 308.00 px | ✓ |
| P0.2 | Arial, no substitution | Arial, probe Δ 0.0014 px | ✓ |
| P0.3 / P0.4 | 12.5 px / 18.75 px | 12.5 px / 18.75 px | ✓ |
| P0.5 | width invariant across injections | 308.00 on all 29 | ✓ |
| P1.1 | mean chars/line **49** | **42.96** | ✗ −6.04 |
| P1.2 | min chars/line **34**, from **SP6** | **34.00**, from **SP6** | ✓ exact |
| P1.3 | median **46** | **42.50** | ✗ −3.50 |
| P1.4 | max **52**, from SP9 (1 line) | **55.00**, from **SP4** (2 lines) | ✗ |
| P1.5 | min full line **44** | **41** | ✗ −3 |
| P2.1 | **1** string over 3 lines | **0** | ✗ |
| P2.2 | SO5 is the one | none | ✗ |
| P2.3 | longest at 3 lines: SO1, 148 | **SO5, 161** | ✗ |
| P2.4 | monotone | holds, 0 violations / 351 pairs | ✓ |
| P3.1 | OBSERVED ceiling **148** | **161** | ✗ +13 |
| P3.2 | SAFE, prompt formula **102** | **102** | ✓ exact |
| P3.3 | SAFE, full-line method **132** | **123** | ✗ −9 |
| P4.1 / P4.2 | gate does not apply; half-result if run | both confirmed | ✓ |
| P4.3 | 2 files, both `.md`, 0 non-`.md` | 2 files, both `.md`, 0 non-`.md` | ✓ |

**The nine misses have one root cause, and it is the same error as §26.1 ②.** P1.1 predicted 49 by
estimating how many characters a *full line* holds, then compared that estimate against a statistic
that averages full lines together with short terminal ones. The two quantities are different, and
they differ by exactly the amount the terminal lines drag: full lines mean **51.63**, pooled average
**42.96**. The full-line estimate of 49 was in fact **2.63 low** against 51.63, not 6.04 high — it
was a decent estimate of the wrong quantity, scored against the wrong number.

Everything downstream followed. Underestimating full-line capacity by ~3 characters made SO5 look
like a 4-line string (P2.1, P2.2, P2.3), which set the observed ceiling 13 too low (P3.1). P1.4
missed for a separate and simpler reason: a 2-line string with two near-full lines beats a 1-line
string on the average basis, and SP4 at 110 ÷ 2 = 55.0 does exactly that.

**The one prediction that was exactly right on the average basis — P1.2, 34.00 from SP6 — was right
because it was a prediction about a stranded last word, which is what that statistic measures.**
That is the clearest evidence available that the statistic measures stranding rather than capacity,
and it is why 123 and not 102 is the number to hand the authors.

---

## 27. Step 4 amendment — revised SX5, recomputed ceiling, quote normalisation

**Branch** `pr5-step4-subtype-measure`, base `90640b8`, amended from `db7e0d0`. Amendment
predictions committed first at **`587547f`** (`docs/predictions_pr5_step4.md`, second section),
before any browser launched for this pass. Same rules as §26: injected at runtime, no client prose
committed, mockup untouched — blob **`813e871`** at base, at `db7e0d0`, at `587547f` and here.

Box re-asserted at the head of this pass, because everything below divides by it: **308.00 px**,
Arial resolved with the advance probe at **2378.80859375** against the constant 2378.81
(Δ 0.0014 px), 12.5 px / 18.75 px. `[MEASURED]`, same basis as §26.2. Nothing moved.

### 27.0 What is wrong — and one thing that is not

**① The brief names `individuals` as the longest word in the revised SX5. It is *co*-longest.**
`connections` is also 11 characters. `[MEASURED]` — `split(/\s+/)`, character length per token.
This is not pedantry: §26.4's whole finding is that the *width* of the following word sets the
break, and character length does not order words by width. In this string it happens not to matter —
neither word forces the constraining break — but a brief that identifies the longest word by
counting letters is using the wrong ruler, and that is the ruler that produced `m = 41`.

**② The safe-ceiling formula from the original step-4 brief is still unsound, and this amendment
does not repeat the error.** Nothing here divides a per-string average. `3 × 34` on the corrected
set would give **105**, and it would still reject strings that fit. Every capacity number in §27 is
on the **full-line basis** — non-terminal lines only — and the predictions file names that basis in
its own text (`587547f`) so it could not be scored the wrong way twice.

**③ Not wrong, and worth saying plainly: the revision does not rescue anything, because nothing
needed rescuing.** All 27 fitted before and all 27 fit now. The ceiling moved from 123 to 132 and
that is a change in *how much unrendered headroom the authors have*, not a change in what ships.

**④ The amendment's own predictions were essentially all correct, which is a weaker result than it
looks and is stated as such.** 22 of 22 scored items hit, most to within 0.04 px — because after
§26 the line-breaking behaviour of this box was understood well enough to compute the answers from
Arial advance widths by hand before rendering. Predicting a system you have already characterised is
not the same test as predicting one you have not. The pass-1 misses were the informative ones.

### 27.A — Revised SX5

`[MEASURED]`, same bases as §26.3 — lines by merged `Range.getClientRects()`, chars by
`replace(/\s+/g,' ').trim().length`, per-line chars by one `Range` per character index with
break-collapsed spaces counted on neither line.

| | value | check |
|---|---|---|
| Character count | **120** | brief's claim **CONFIRMED**; Σ per-line 118 + 2 break spaces = 120 ✓ |
| Longest word | **11**, but a **TIE** — `individuals` **and** `connections` | brief's `individuals` is co-longest, §27.0 ① |
| Rendered line count | **3** | — |
| Per-line characters | **50 · 50 · 18** | — |
| Line widths px | **271.23 · 271.70 · 102.16** | — |
| Longest line | **271.70 px** (line 2) | — |
| **Slack against 308.00 px** | **36.30 px** | against 0.31 px for SO8, the tightest in the set |

Line 1 is byte-identical to the pre-revision string's line 1 and renders identically at 271.23 px —
the revision changed nothing before character 50.

#### 27.A2 — break type per line

`[MEASURED]`. Break type is determined two ways and they agree. Structurally, a line is *full* iff
it is not the last line. Mechanically, the next word is measured against the space remaining:

| line | chars | width px | type | next word | its width | space remaining |
|---|---|---|---|---|---|---|
| 1 | 50 | 271.23 | **FULL** | `choosing` | 50.05 px | 33.16 px |
| 2 | 50 | 271.70 | **FULL** | `connections` | 66.72 px | 32.67 px |
| 3 | 18 | 102.16 | **TERMINAL** | — | — | — |

**Revised SX5's minimum full line is 50 characters, up from 41.** `[MEASURED]` **It no longer sets
`m` and no longer constrains the ceiling at all** — 50 is above the set median full line of 52.5 by
only 2.5, i.e. it is now an ordinary line rather than the extreme one.

**Method note on the break-type table.** The "next word / space remaining" columns come from a greedy
re-wrap simulated from measured word run-widths, not from the rendered line rects. That simulation
reproduced the rendered per-line character counts for **all 27 strings with zero mismatches**
`[MEASURED]`, which is what licenses using it for attribution. It carries a systematic bias of
**+0.05 to +0.17 px** against the rendered rect, from summing per-word runs rather than measuring one
line box. Every *width* quoted in §27 is the rendered value; the simulation is used only for "which
word forced this break", where a 0.17 px bias against a 33–72 px margin cannot change the answer.

### 27.B — `m` and the ceiling, recomputed

Over the corrected 27 — 26 unchanged, SX5 revised. 40 full lines, unchanged in count (the revised
SX5 still contributes exactly 2).

#### 27.B1 — the new minimum full line

**`m` = 44 characters** `[MEASURED]`, and **it is a genuine tie.** `m` is defined in characters, so
two lines set it:

| line | chars | rendered width | empty | word forcing the break | its width | share of the 308.00 px box |
|---|---|---|---|---|---|---|
| **SO6 line 1** | **44** | **235.81 px** | **72.19 px** | **`responsibility`** | **72.27 px** | **23.5 %** |
| **SO4 line 2** | **44** | **253.61 px** | 54.39 px | `compared` | 55.59 px | 18.0 % |

**SO6 line 1 is the more constraining of the two in pixels** — 72.19 px left empty against SO4's
54.39 px, and the narrowest full line in the set by width `[MEASURED]`. Both carry 44 characters, so
both set `m` equally.

Next narrowest full lines, for the margin: SX4 L1 45 ch / 264.44 px (`connection`, 60.47 px, 19.6 %),
SO7 L1 45 ch / 258.14 px (`accepting`, 53.52 px, 17.4 %), SO4 L1 47 ch / 260.28 px. `[MEASURED]`

`[AGGREGATE]` full-line character counts over the corrected 40: **min 44 · median 52.5 · mean 51.85 ·
max 57**. The mean moved 51.63 → 51.85 and the median did not move.

**The mechanism from §26.4 is confirmed, not overturned.** The narrowest full line in the corrected
set is *still* set by a long following word — `responsibility` at 23.5 % of the box. The magnitude
fell because `compartmentalizing` was 35.2 %, half again as wide. **A ceiling that moves 9 characters
because one word left one sentence is exactly the conditionality §26.1 ③ warned about, now
demonstrated rather than argued.**

#### 27.B2 — the ceiling

| | value | label | basis |
|---|---|---|---|
| **Safe ceiling, 3m — RECOMMENDED** | **132 characters** | `[DERIVED]` | `3 × 44`. A string of ≤ 132 characters cannot reach 4 lines: reaching 4 requires 3 full lines, and no full line in the corrected set carries fewer than 44. |
| Movement | **+9**, from 123 | `[DERIVED]` | — |
| Observed ceiling | **161**, SO5, unchanged | `[MEASURED]` | still the longest string in the set, so the sample still never finds the wall |
| Prompt-formula ceiling, for contrast | 105 (`3 × 35.0`, SO9/SP6 average basis) | `[DERIVED]` | **not recommended**, §27.0 ② |
| Unconditional bound | 78, unchanged | `[DERIVED]` | `3 × ⌊308.00 / 11.7984⌋` |

**Still sufficient, still not necessary, and still conditional.** 132 is sufficient *for prose whose
widest word stays under `responsibility`'s 72.27 px*. It is not a limit: SO5 at 161 characters fits
in 3 lines with 7.83 px to spare.

#### 27.B3 — who is above the ceiling now

**Two strings, and the band does not empty.** `[MEASURED]`

| string | chars | rendered lines | verdict |
|---|---|---|---|
| **SO5** | 161 | **3** | above the ceiling, **measured good** |
| **SO1** | 148 | **3** | above the ceiling, **measured good** |

**Four strings left the band:** SP1 (125), SO8 (126), SO3 (130) — the ceiling rose past them — and
SX5, which fell from 130 to **120**. The render-first band goes **six → two**.

**What Mo should be told, replacing §26.5's line:** *write to **132 characters** and you never need a
render. Between 133 and 161 the sample says you are fine, but the string must be rendered before it
ships — that is two strings today, SO5 and SO1. Avoid words longer than about 14 characters: a
14-character word already costs 23 % of the line, and it is the single word that sets the ceiling for
everyone else.*

Note the word-length guidance tightened from "about 16" to "about 14" even though the ceiling
loosened. Those move in opposite directions on purpose — the ceiling rose *because* the longest word
got shorter, so the advice that keeps it there has to be stricter, not looser.

#### 27.B4 — monotonicity

**0 violations across all 351 ordered pairs.** `[MEASURED]`, re-run in full.

**One changed string does not invalidate the pass-1 result, and re-running all 351 was not
necessary.** A monotonicity violation is a property of a *pair* — a shorter string on more lines than
a longer one. Changing SX5 can only affect the **26** pairs that contain SX5; the other **325** are
between untouched strings whose char counts and line counts are unchanged, so their pass-1 verdict
carries over unexamined. Re-running the full set costs nothing and was done as a control, but **the
26-pair argument is the finding** — it is what makes the check cheap the next time a single string is
revised, and there will be more revisions.

For the record, the 26: SX5 fell 130 → 120 and stayed at 3 lines, so it moved *down* the char
ordering while holding its line count. Every string it crossed — SP1 125, SO8 126, SO3 130 — also
renders at 3 lines, so no pair could invert.

`[AGGREGATE]` corrected set: **1 line: 2 · 2 lines: 10 · 3 lines: 15 · 4+ lines: 0**, 67 rendered
lines over **2868** characters (was 2878; SX5 shed 10).

### 27.C — SO8 quote normalisation

#### 27.C2 first, as the brief asks

**Neither form wraps to 4 lines. Both render at exactly 3.** `[MEASURED]`

#### 27.C1 — the two forms

`[MEASURED]`. Both strings are 126 characters and break 55 · 54 · 15. Only line 2 differs — it is the
line carrying both quote glyphs, which the equal-and-doubled delta confirms independently.

| form | line 1 | **line 2** | line 3 | longest line | **slack against 308.00 px** |
|---|---|---|---|---|---|
| **Straight** `U+0022` — what §26.3 measured | 305.28 | **307.69** | 74.34 | **307.69 px** | **0.31 px** |
| **Curly** `U+201C`/`U+201D` — what the authoring doc holds | 305.28 | **307.14** | 74.34 | **307.14 px** | **0.86 px** |
| **Δ (curly − straight)** | 0.00 | **−0.55** | 0.00 | **−0.55 px** | **+0.55 px more slack** |

**Curly is narrower. The form Cai and Mo are actually editing is the safer of the two**, by 0.55 px —
which is 178 % of the slack the measured form had.

Glyph advances at 12.5 px Arial `[MEASURED]` — width of a 20-character repeat ÷ 20, in a
`white-space:pre` span inheriting `.stxt`'s font:

| glyph | advance | metrics-table value |
|---|---|---|
| `U+0022` straight double | **4.4375 px** | 355/1000 em = 4.4375 — exact |
| `U+201C` left double | **4.1633 px** | 333/1000 em = 4.1625, Δ 0.0008 px (0.02 %, the repeat-and-divide method's own resolution) |
| `U+201D` right double | **4.1633 px** | as above |
| `U+0027` straight single | 2.3867 px | (measured for completeness; not in SO8) |
| `U+2019` right single | 2.5633 px | **wider** than the straight single — the opposite direction to the doubles |

**2 × (4.4375 − 4.1633) = 0.5484 px**, against the measured line-2 delta of **0.55 px** `[DERIVED]`.
The arithmetic closes, which is what proves both glyphs land on the same line rather than one on each.

**The direction does not generalise, and that is the finding worth carrying.** For *double* quotes,
curly is narrower. For *single* quotes it reverses — `U+2019` is 2.5633 px against `U+0027`'s
2.3867 px, so curly is **wider** by 0.1766 px. **"Curly is safer" is true of SO8 and false as a
rule.** SP5 is the string with a single quote; §26.3 measured it at 278.91 px straight and 279.08 px
curly — the same reversal, 29.09 px of slack either way, so it does not matter there. It would matter
on a string with SO8's margins.

#### 27.C3 — added to §26.6

Item 6 has been added to §26.6's list of what the page build must confirm, with the numbers stated
inline so that section is checkable without opening this one.

### 27.D — housekeeping

#### 27.D1 — Synthetic B

**Synthetic B is no longer load-bearing for any shipping string.** Its referent — the 41-character,
218.19 px line — does not exist in the corrected set.

**It is retained, and it is now a fixture for the ceiling's conditionality rather than for a string.**
Concretely: B is the committed, client-prose-free demonstration that a full line in this box **can**
fall to 218.19 px and that `m` **can** be 41, when an 18-character word follows. That is the case
`132` does not cover, and it is the regression a future gate should hold — *if a new string ever
produces a full line as narrow as Synthetic B's, the ceiling is 123 again, not 132.* Reframed, not
deleted; §26.7 is marked accordingly.

#### 27.D2 — Synthetic C, the fixture for the current `m`

New, committed here. Matched on the **render** to **SO6**, whose line 1 is the pixel-narrowest of the
two lines that set `m = 44`. Machine-generated word sequence, no meaning, not copy:

> `width for author gate an report but in count recapitalisation result result in rendered report under.`

| | lines | line widths px | per-line chars | chars |
|---|---|---|---|---|
| referent (SO6) | 2 | **235.81** · 292.53 | **44** · 56 | 101 |
| **Synthetic C** | **2** | **235.58** · **292.53** | **44** · **56** | **101** |
| Δ | 0 | −0.23 · **0.00** | **0 · 0** | **0** |

`[MEASURED]`. **The closest match of the three: identical line count, identical per-line character
counts, identical total character count, line 2 exact, line 1 within 0.23 px — 0.10 %.** It
reproduces `m = 44` exactly, so a gate can assert the current ceiling's derivation against a
committed fixture with no client prose in the repo. As with A and B, character count matching here is
a coincidence of the search landing on it, not a criterion — the criterion is the render.

The three synthetics now cover: **A** the tightest 3-line fit, **B** the adversarial narrow line that
sets a lower ceiling, **C** the narrow line that sets the current one.

#### 27.D3 — the coach byte-diff

**`verify_coach_baseline.js` does not apply to this amendment**, for the same reason as §26.8 — the
branch diff against `main` is `docs/` only, **0 non-`.md` paths** `[MEASURED]`, and the gate's
subject is the coach-portal render path, which nothing here can reach.

Run again as a control: **`COACH BASELINE: ALL PASSED — HTML only (PDF half skipped off-Linux).`**
**This is a HALF-RESULT, not a pass.** The PDF-hash half skipped on every fixture —
`normalized PDF hash SKIPPED (platform is darwin, not linux)`. The HTML half was byte-identical on
every fixture. Only the Linux CI run is a full result.

### 27.E — Predictions versus measurement

Predictions at **`587547f`**. **22 of 22 scored items hit.** Two items were declared unscoreable in
the predictions file itself (C1.1–C1.4, retrodictions of a pass-1 measurement) and are excluded
rather than counted as wins.

| # | Predicted | Measured | |
|---|---|---|---|
| A0.1 | 120 chars | 120 | ✓ |
| A0.2 | brief's "longest word" claim is partly wrong; `connections` ties at 11 | tie confirmed | ✓ |
| A1.1 | 3 lines | 3 | ✓ |
| A1.2 | 50 · 50 · 18 | 50 · 50 · 18 | ✓ exact |
| A1.3 | 271.23 · 271.66 · 102.14 | 271.23 · **271.70** · **102.16** | ✓ Δ 0 / +0.04 / +0.02 |
| A1.4 | longest 271.66 | 271.70 | ✓ Δ +0.04 |
| A1.5 | slack 36.34 | 36.30 | ✓ Δ −0.04 |
| A2.1–A2.3 | FULL · FULL · TERMINAL | FULL · FULL · TERMINAL | ✓ |
| A2.4 | SX5 min full line 50, no longer sets `m` | 50, confirmed | ✓ |
| B1.1 | m = 44 | 44 | ✓ |
| B1.2 | a tie: SO4 L2 and SO6 L1 | tie confirmed | ✓ |
| B1.3 | SO4 253.61 / SO6 235.81, SO6 more constraining | 253.61 / 235.81 | ✓ exact |
| B1.4 | `responsibility` 72.27 px, 23.5 % | 72.27 px, 23.5 % | ✓ exact |
| B1.5 | `compared` 55.58 px, 18.0 % | 55.59 px, 18.0 % | ✓ Δ 0.01 |
| B2.1 | ceiling 132 | 132 | ✓ |
| B2.2 | +9 | +9 | ✓ |
| B3.1 | 2 above | 2 | ✓ |
| B3.2 | SO5, SO1 | SO5, SO1 | ✓ |
| B3.3 | band does not empty; 4 strings leave it | does not empty; SP1, SO8, SO3, SX5 leave | ✓ |
| B4.1 | 0 violations | 0 / 351 | ✓ |
| B4.2 | only 26 pairs need re-checking | argument holds | ✓ |
| C1.5 | `U+0022` = 4.4375 px | 4.4375 px | ✓ exact |
| C1.6 | `U+201C`/`U+201D` = 4.1625 px | **4.1633 px** | ✓ Δ +0.0008 px — within the method's own resolution, not a real disagreement |
| C1.7 | **−0.55 px, curly narrower**, both glyphs on one line | **−0.55 px**, curly narrower, doubling confirms one line | ✓ exact, sign correct |
| C2.1 | neither wraps to 4 | both 3 lines | ✓ |
| D1.2 | Synthetic C achievable within 1.00 px | **0.23 px**, and exact on chars | ✓ |
| D3.1–D3.3 | gate N/A; half-result; 2 files, both `.md`, 0 non-`.md` | all confirmed | ✓ |

**Read this scoreline with §27.0 ④ attached.** The A-series predictions were computed by hand from
Arial advance widths before rendering — the 271.66 px prediction against a 271.70 px measurement is
arithmetic agreeing with itself, not foresight. The one genuinely blind prediction was **C1.6**, and
it landed 0.0008 px off. The pass-1 report's 9 misses taught more than these 22 hits.

**The basis error from pass 1 did not recur.** The predictions file named the full-line basis in its
own text before any number was written, which is why there is no repeat of scoring a capacity
estimate against a terminal-line-diluted average. That was the point of naming it, and it worked.

---

## 28. Build 0 — the sheet-5 audit, and the real `.stxt` box measured

**Branch** `pr5-build0-stxt-measure`, base `e027a04`. Predictions committed first at **`e45f830`**,
before any browser launched. Read-only against product code: this build changes **no** `.js`, sets
**no** `built` flag, bumps **no** inventory. The mockup is read, never written — blob `813e871`
throughout.

### 28.0 The headline

**`.stxt` measures 308.00 px inside the real v3 page shell.** `[MEASURED]` The figure every
subtype-panel number on `main` rests on is confirmed against the shipped pipeline rather than
against the mockup alone. **`m` = 44 and the safe ceiling of 132 stand. Mo keeps authoring to 132.**
Nothing in §26.3–§26.5 is re-run, because nothing moved.

### 28.1 Two things that lead, both decided

#### 28.1a DECIDED — the summary is a new sibling field, never a leaf inside `instincts_v3`

**The hazard, verified in the repo.** `assertOverrideShape` (`app/content_overrides.js:159`) throws
when a published override's leaf set no longer matches the library's. Adding a `summary` leaf inside
`subtype_<code>.instincts_v3` makes every already-published `instincts_v3` override throw at render.
`content_overrides.js:114` is explicit about the blast radius, and it is **wider than the audit brief
stated**: *"This throw reaches EVERY report render, including the dry-validate probe in
`/api/submit`. A mismatched row therefore **fails assessment submission**, not just a PDF."*
`build_content_library.js:1360` records this being **reproduced**, not theorised — a `body_v3` leaf
was rejected on exactly this failure.

**DECIDED.** The 27 summaries land as a **new sibling object on the subtype row**:

```
content_library.json → subtype_<code>.quickref_v3 = { summary }
```

authored as `INTERIM_QUICKREF_V3` in `scripts/build_content_library.js`, the same shape and
provenance convention `INTERIM_INSTINCTS_V3` follows. A key that does not yet exist can have no
published override, so the shape guard cannot fire. It satisfies the co-location decision — the
summary sits on the same record as both narratives — and gives the CMS a clean
`subtype_sx5.quickref_v3` key. `[DECIDED, Cai, 8 Sep]`

#### 28.1b The registry entry already exists

`app/renderer.js:3362` — `{ key: 'quickref', sheet: 5, footer: 3, title: 'Quick Reference',
eyebrow: 'Your Report at a Glance' }`. `[MEASURED]` Only the `built` flag is absent. The state
document said there was no registry entry; it was wrong. The row's title, eyebrow, sheet and footer
are already decided, already committed, and **already read by the TOC** — see §28.5.

`quickref` and `car` are the only two of twelve rows without `built`. `[MEASURED]`

### 28.2 The summary / narrative overlap — design, not defect

`[MEASURED]` Longest contiguous shared word-run between each summary and the first sentence of the
corresponding `subtype_<code>.instincts_v3.narrative`, whitespace-normalised and case-folded:
**16 of 27 at ≥ 60 %**. SP7 90 %, SP5 89 %, SX7 89 %, SP9 88 %, SO6 88 %, SX6 87 %, SO9 86 %,
SX9 83 %. Lowest SO8 26 %, SO4 35 %, SX8 40 %. All 27 are recognisably the same sentence, the
summary in second person and the narrative in third.

**DECIDED — this is by design.** `[Cai, 8 Sep]` Two renditions of the same subtype content, a long
one on sheet 10 and a short one on sheet 5, is the design; a summary that opens with the same
sentence as the long form is what a summary is. The pages are five sheets apart and each is
internally consistent in its own voice. **There is no client-visible defect and it is not an open
question.** The audit measurement stands; the design conclusion drawn from it in the audit report
does not, and is withdrawn here.

> **Maintenance note.** What survives is narrower: if the p8 narrative's opening sentence is later
> edited, the p5 summary will not follow, and the two renditions will drift. **Mitigation, already
> chosen: co-locating both fields on the same subtype row** (§28.1a), so an editor changing one has
> the other in front of them. Not a finding; a thing to know when editing.

### 28.3 Content — where the strings live

**Two narrative fields per subtype. Never write "the narrative" unqualified.** `[MEASURED]`

| field | length | page |
|---|---|---|
| `subtype_<code>.instincts_v3.narrative` | **360–394 chars** | sheet 10, printed page 8 — **the one this build cites** |
| `subtype_<code>.narrative` | **602–762 chars** | the v2 P6 page |

Counting basis: JSON string length, all 27 present in both fields.

`type_N.explore_v3.p6.core_motivation` `[MEASURED]` — present for all nine types, **54–96 chars**.
Sheet 5 needs the **alternate's** copy, and it is already staged (§28.6).

**Four content homes, plus chrome. The rule is provenance, not page.**

1. **Word docx** — canonical for authored client prose.
2. **`INTERIM_*` constants in `scripts/build_content_library.js`** — canonical for prose with no
   docx section yet; an explicit staging state whose count `verify_content_library.js` prints on
   every run "so it moves visibly as constants retire into Word."
3. **`app/content/content_library.json`** — the **built artifact**. Never hand-edited; CI asserts
   `JSON == build(docx + INTERIM_*)`.
4. **`content_overrides` DB table** — the CMS runtime layer, keyed `<topKey>.<field>`, resolved per
   render with library fallback.
5. Literal strings in `renderer.js` — page furniture only, no content key.

**`cmsPreviewSpec` is not a content home.** It stores no content: it is the CMS *preview routing*
table, mapping an editable key to a page and selector. A string is CMS-*editable* only if it also
gets an entry there. Recorded because treating it as a home sends the reader looking for strings
that were never in it.

### 28.4 The analogue builder

**`_clv3Instincts` (`app/renderer.js:4069`), not wings.** It is the only builder that reads the
subtype row, the only one that renders instinct badges — it already calls `instinctRanks`, the
Build 1 helper sheet 5 must reuse so the two pages cannot disagree about which instinct is Primary —
and the only one whose geometry was measured on a scaffold *before the page existed* and asserted
afterwards, which is exactly sheet 5's position.

**Contract.** `function _clv3Instincts(m)` → HTML string. Takes the whole client model, returns one
`<div class="v3-page">…</div>`. Opens `const page = v3Page('instincts')` (throws on an unknown key),
reads its content slice from `m.pages.v3_instincts`, closes with `${_v3Footer(page)}`. Registered in
`V3_PAGE_BUILDERS` (`:4171`); `V3_PAGE_BUILDERS_ORDERED` throws if a `built` page has no builder.
Content is prepared in `report_prep.js` into `m.pages.<slot>` — never read from the library inside
the renderer. Geometry comes from a module-level `*_GEO` constant; `QUICKREF_GEO` already exists at
`renderer.js:1092`.

**Conventions an eleventh builder must follow that are nowhere written down:**

- **Namespace.** `p5-` is taken by the live v2 renderer; `.v3-inst-`'s header documents the same
  collision for `p6-`/`p8-`. Use `v3-qr-`.
- **`_v3t()` for library content, `esc()` for chrome.** `_v3t` runs `_v3NoBreak`, which wraps
  hyphenated compounds — "Self-Preservation", "One-to-One" — in nowrap spans.
- **No HTML comments in output** — notes go in JS comments so they do not ship inside the client PDF.
- **`{type_word}` / `{subtype_label}` / `{nickname_plural}`** resolve through `_v3Tokens`.
- **Footer number from `V3_PAGE_ORDER`, never a literal.**
- **Set `built: true` in the same commit as the builder** (`renderer.js:3352`).
- **Bump `PAGE_INVENTORY.client_v3` by hand** — §28.5.
- **Never inline the mockup's SVG** — §28.7.

### 28.5 Registry, order and the tripwire

**`V3_PAGE_ORDER`** is twelve rows of `{key, sheet, footer, chrome?, built?, title, eyebrow?}`,
asserted at 12 rows with `sheet === i+1`. `quickref` **inserts nowhere — it is already row 5.**
Build B adds `built: true` to the existing row. At runtime `built` does exactly one thing:
`v3PagesFor` filters on it (`:3383`), which drives the renderer, the render harness and the
structural test from one source.

**`report_page_inventory.js:47`** — `{ 'v3-page': 10 }` → **11**. Left un-bumped, both
`report_pages_test.js` and `tests/run_test.js` fail on the container count, deliberately. The
comment at `:29–47` is emphatic that this is the one v3 count **not** derived from `V3_PAGE_ORDER`,
because if every assertion derives from the constant the renderer reads, "a wrong `V3_PAGE_ORDER`
passes silently and the suite becomes a tautology." **Do not tidy it into a derivation.** No other
place counts pages: `EXPECTED_PAGES` derives from this literal, and the footer and header counts
derive from the `built` flags.

**The TOC assertion** (`tests/report_pages_test.js:273–282`) checks that there are 9 entries, that
each `v3_contents.start` names a real `V3_PAGE_ORDER` key, that each printed page number equals that
entry's `.footer`, and that footer 5 is absent.

**It asserts TOC-vs-registry consistency and never TOC-vs-document-existence — and that gap is live
now.** `INTERIM_CONTENTS` entry 03 is `quickref`, so **the contents column already prints "3" for a
page the document does not contain**, as it prints "9" for `car`. `[MEASURED]` Adding sheet 5 makes
the assertion neither stronger nor weaker — it was never testing existence. It closes one of the two
remaining lies in that column.

**`pilotTypes`** appears in exactly two places — the comment at `:3377` and the filter at `:3383` —
and **no page entry sets it**. `[MEASURED]` Sheet 5 declares nothing there. Not cleaned up.

### 28.6 The data the page needs

| Needed | Reaches the renderer? | Path |
|---|---|---|
| Nine type scores | **YES** | `m.charts.types` — `typeRamp()`, `{type, position, score}` × 9, hero at position 1, alternate at 2 |
| `instinctRanks` | **YES** | `renderer.js:4037`, called with `m.display.instinct_code` + `m.charts.instincts` |
| `hero.number` / `alternate.number` | **YES** | `m.hero.number`, `m.alternate.number` |
| Which of the 27 subtypes | **YES** | `m.display.instinct_code` × `m.hero.number`; label at `m.display.subtype_label` |
| Naranjo + signature | **YES** | `m.pages.v3_instincts.columns[].{naranjo, signature}` — slotted for p10's three-column layout, needs reslotting for one |
| Leading + alternate core motivations | **YES, already** | `m.pages.type_hypotheses.core_motivation` and **`.alternate_core_motivation`**, the latter commented *"Sheet 5's ALTERNATE hypothesis block"* (`report_prep.js:357–363`) |
| `buildEnneagramSVG` quickref inputs | **YES** | `{leading, alternate, scores}` |
| The 27 summaries | **NO** | do not exist — §28.1a |
| `.lead`, both `.plbl`, both `.hhd`, H2, zone 8, four debrief tips | **NO** | mockup only `[MEASURED]`, grep excluding audit/build docs |

**Call signature.** `buildEnneagramSVG({ variant: 'client-quickref', leading: m.hero.number,
alternate: m.alternate.number, scores: m.charts.types })`. The branch reads **position, not score**,
"so the darkest node and the solid ring cannot disagree."

**Two data steps precede Build B:** the 27 summaries via `INTERIM_QUICKREF_V3` plus a
`pages.v3_quickref` model slot; and **the eight static chrome strings**, which are unscoped and
unowned — §28.9.

### 28.7 What would catch a broken page, and what would not

**The single-sheet gate.** `npm run verify:render` → `verify_phase4_prep.js && render_client.js`.
**32 v3 renders** `[AGGREGATE]`, computed from the config's own functions: `anders_sx9` = 9 types ×
3 instincts × 1 Z6 = **27**; `sp4` = 1 type × 1 instinct × 5 Z6 states = **5**. A full 3 × 9 on the
instinct axis, all 27 subtype columns in the highlighted slot.

**No collided fixture exists and the harness structurally cannot make one.** `[MEASURED]` All three
`*_api_result.json` fixtures have `confirmed ≠ alternate` — 9/5, 4/1, 7/5 — and the retype rule is
`alternate_candidate = (asType % 9) + 1`, which has **no fixed point on 1..9** `[DERIVED]`. So the
collided path renders **zero times in any gate**, despite `call2_stamp.js` deliberately shipping such
records, `buildEnneagramSVG` carrying a documented recovery branch for them ("the alternate is
dropped, not thrown"), and `typeRamp`'s de-duplication existing for them. Three pieces of code
written for a case nothing renders. **Nothing asserts a collided record produces a complete
document.**

**Gates a new page passes without being examined by:**

- `verify_coach_baseline.js` — coach path only, structurally blind.
- `verify_content_library.js` — asserts JSON == build(docx); says nothing about rendering.
- `verify_diagrams.js` — covers `client-quickref` across 72 ring configurations, but only the
  **standalone SVG**; it never sees the page the SVG is embedded in.
- `verify_transparency.js` — the page-level half runs **one fixture at one type**, not the 32-render
  matrix.
- `check_docs.py` — not in CI at all.
- The derived halves of `report_pages_test.js` — footer, header and built-key counts all derive from
  `V3_PAGE_ORDER`; only the hand-maintained `client_v3` literal can catch a wrong constant.
- The whole suite, on the collided path.
- **The `.stxt` box width** — nothing measures it. §28.8 is a one-off, not a gate.

**Transparency, and why the mockup must not be "fixed."** The mockup's heat-map SVG carries
`fill-opacity` on all nine nodes (0.100–1.000), a `stop-opacity` `linearGradient`, and
`fill="url(#sc)"` — a §3.2 violation. It is already known: `verify_transparency.js:22` names the file
and `:172` uses it as the scanner's **positive control**, failing if it ever scans clean.
**Editing the mockup to remove the transparency would break that gate.** Build B calls
`buildEnneagramSVG('client-quickref')`, whose `RANK_FILL` ramp is opaque solid hex.

### 28.8 The measurement

**Method, and why it is not the §26 measurement again.** §26 measured the mockup's own `.stxt` in the
mockup document. This measures `.stxt` **inside a page rendered by the real v3 pipeline** —
`buildClientReportHTML_v3` on the `anders_sx9` fixture, a real non-cover `.v3-page` as the host —
with the mockup's `.two` / `.half` / `.hhd` / `.hbd` / `.sname` / `.stag` / `.stxt` rules lifted
**verbatim** from its `<style>` block (11 rules extracted by selector match, never re-typed, the same
discipline `scripts/spike/p10_fit_probe.js` uses) and injected at runtime, with a content-free
skeleton: the row, the two `.half` columns, the `.stxt` element.

**Nothing was registered.** `built` was not set, `PAGE_INVENTORY` was not bumped, no builder was
written. §2.2's stop condition — "if the only way to get a real box is to register the page" — **did
not fire**: the shell is real without it.

| # | Property | Value | Label | Counting basis |
|---|---|---|---|---|
| M1 | `.v3-page` count in the rendered document | 10 | `[MEASURED]` | `querySelectorAll('.v3-page')` |
| M2 | `.v3-page` outer / **content** width | 816.00 / **710.00 px** | `[MEASURED]` | `clientWidth` − horizontal padding; `padding: 40px 53px`, `box-sizing: border-box` |
| M3 | `.two` content width, `display`, `gap` | 710.00 px, `flex`, 18 px | `[MEASURED]` | as M2 |
| M4 | `.half` × 2 — border-box / content | **346.00 / 344.00 px each** | `[MEASURED]` | `getBoundingClientRect().width`; content as M2 |
| M5 | `.half` computed flex | **`1` / `1` / `0%`** | `[MEASURED]` | `getComputedStyle` grow/shrink/basis |
| M6 | `.hbd` content width | **308.00 px** | `[MEASURED]` | as M2; `padding: 16px 18px` |
| M7 | **`.stxt` content width** | **308.00 px** | `[MEASURED]` | as M2 |
| M8 | `.stxt` bounding width | 308.00 px | `[MEASURED]` | `getBoundingClientRect().width` — agrees, so the box is not content-shrunk |
| M9 | `font-family` / `font-size` / `line-height` | `Arial, sans-serif` / 12.5 px / 18.75 px | `[MEASURED]` | `getComputedStyle`. **Fixed by the method** — the rules were injected verbatim — and declared unscoreable in the predictions before the run. |
| M10 | Arial resolved | probe **2378.80859375** vs the 2378.81 constant, Δ 0.0014 px | `[MEASURED]` | `bl.assertReportFont` |

**What this confirms.** The v3 page shell offers the same 710.00 px content band as the mockup's
`.page`, and a panel built at the mockup's grid inside it yields **the same 308.00 px** the §26–§27
numbers were taken at. **`m` = 44 and the safe ceiling of 132 stand unchanged. §26.3–§26.5 are not
re-run, because nothing moved.**

**What it does not settle, stated plainly.** This measures the panel **as the mockup specifies it**.
It does not settle what CSS Build B writes. Change the gap, the border, the `.hbd` padding, or give
the instincts half a fixed width, and 308.00 moves with it. That is §26.6 item 4 and it remains
Build B's to answer against Build B's own stylesheet.

**§26.6, after this build:**

| item | status |
|---|---|
| 1 — `.stxt` is 308.00 px in the built page | **answered conditionally** — 308.00 px in the real shell at the mockup's grid; final only against Build B's stylesheet |
| 2 — 12.5 px / 1.5 survive into the built stylesheet | **not answered** — injected verbatim here, so untested; Build B's |
| 3 — the 3-line bound holds at page level | **not answered** — needs the whole page |
| 4 — the two `.half` columns split evenly | **ANSWERED** — `flex: 1 1 0%`, 346.00 px each, in the real v3 shell |
| 5 — re-render the strings above the ceiling | **not needed** — the ceiling did not move |
| 6 — SO8's CMS quote form | **not answered** — a CMS question, not a geometry one |

### 28.9 Decisions and open questions

**DECIDED** `[Cai, 8 Sep]`

- **The build split**, with this measurement pulled out in front as **Build 0** (this section):
  **A** content and model — `INTERIM_QUICKREF_V3`, the eight chrome strings, the `pages.v3_quickref`
  slot, the CMS preview entry; ends with the library rebuilt and green, **no page rendering**.
  **B** the page — `_clv3QuickRef`, `v3-qr-` namespace, `built: true`, `PAGE_INVENTORY` → 11;
  ends with 32 renders single-sheet and §26.6 items 1, 2 and 4 answered against the real stylesheet.
  **C** fit and the ceiling — §26.6 items 3, 5, 6; ends with 132 confirmed or restated against the
  built page. **D** the collided-record fixture; ends with §28.7's gap closed.
- **D stays in PR 5.** Sheet 5 is the first page that renders the alternate at all, so it is the page
  that makes the collided path reachable in a client report.
- **`.sname` / `.stag` are UNRATIFIED.** The mockup carries **three** stale strings, not two.
  Alongside the H2 and the italic caption, `.stag` reads "The Seeker · Merging & Intensity" — but the
  library's SX9 naranjo is **`Fusion`** `[MEASURED]`, and "Seeker" is not among the 27 naranjo values
  at all. The signature matches; the name does not. The `The ` prefix also fails to generalise:
  it yields "The Appetite" (SP9), "The Non-Adaptability" (SO1), "The Keepers of the Castle" (SP7).
  p10 renders naranjo with no article. Do not port `.sname`/`.stag` as chrome.

**OPEN, with owners**

| # | Question | Owner | Blocks |
|---|---|---|---|
| 1 | The `.sname` / `.stag` copy decision — author 27 taglines, or ratify `${naranjo} · ${signature}` with no article | **Cai & Mo** | Build A |
| 2 | The eight chrome strings — lead, two pick labels, two panel headers, H2, zone 8, four debrief tips — and whether they are authored into a docx section or an `INTERIM_*` constant | **Cai** | Build A |
| 3 | Are the summaries CMS-editable? If yes they need a `cmsPreviewSpec` entry and sheet 5 needs a preview selector — unscoped work | **Cai** | Build A |

### 28.10 Predictions versus measurement

Predictions at `e45f830`. **12 of 14 scored items hit. Two missed, and both are mine.**

| # | Predicted | Measured | |
|---|---|---|---|
| B0.1 | `.v3-page` content 710.00 px | 710.00 px | ✓ |
| B0.2 | **`.stxt` content 308.00 px** | **308.00 px** | ✓ |
| B0.3 | `.half` 346.00 px each, `flex 1 1 0%` | 346.00 px, `1 1 0%` | ✓ |
| B0.4 | probe 2378.80859375 | 2378.80859375 | ✓ |
| B0.5 | 12.5 px / 18.75 px | confirmed | — declared unscoreable before the run |
| **B1.1** | The two box models yield the same 308.00 px | 308.00 px both | **✗ — right answer, wrong reason. See below.** |
| **B1.2** | Content-box arithmetic: free space 710 − (2+2+18) = 688 → 344 content each | **Never applied.** | **✗ WRONG** |
| B1.3 | The v3 reset loses to the panel's padding on source order | untestable by this method | — the scaffold appends its `<style>` last **by construction**, so this proves nothing about `clientReportV3PageStyles()` ordering. Not scored. Build B must confirm it. |
| B2.1 | `m` = 44 | 44 | ✓ |
| B2.2 | ceiling 132 | 132 | ✓ |
| B2.3 | 2 above — SO5, SO1 | 2 — SO5, SO1 | ✓ |
| B2.4 | no re-run needed | none run | ✓ |
| B3.1 | a real box without registering the page | confirmed; §2.2's stop did not fire | ✓ |
| B3.2–B3.4 | 2 files, both `.md`, 0 non-`.md`; 0 CI jobs examine them; coach gate N/A | confirmed | ✓ |

**The miss, stated properly.** B1 was built on the claim that the mockup's `.page` declares no
`box-sizing` and its panel is therefore **content-box**, against the v3 shell's border-box reset —
a divergence the predictions called "the reason this is not a foregone conclusion." **It is not
true.** `docs/mockup/…AtAGlance_v1.html:4` opens with `*{margin:0;padding:0;box-sizing:border-box}`,
a universal reset one line above the `.page` rule I read. `[MEASURED]` — the mockup's `.half`,
`.hbd` and `.stxt` all compute `border-box`, and its `.half` measures 346.00 / 344.00 px, identical
to the v3 shell's.

So **there was never a box-model divergence to reconcile**, and B1.2's arithmetic describes a layout
that does not exist anywhere. B1.1's conclusion happens to be correct because the two documents use
**the same** box model, not because two different models converge.

**This makes the result stronger, not weaker, and it is worth being precise about why.** Had the
premise been true, 308.00 px would have been a coincidence of two box models agreeing — durable only
while both stayed as they are. What is actually the case is that the mockup and the v3 shell are
geometrically the same document: 816 px wide, `40px 53px` padding, border-box throughout, 710.00 px
of content. The mockup's measurements transfer to the v3 shell because there is nothing to transfer
across. That is a better guarantee than the one predicted, arrived at by being wrong about the
mechanism — recorded here rather than quietly corrected, because the reasoning error is the
interesting part and the reading habit that caused it (reading a rule without checking the reset
above it) is the one to carry forward.

---

## 29. Build B — plan detail, against `main` as it now is

Read at **`4a2f80e`**, read-only. Nothing was built, no product code changed. This is the delta
from §28, not a re-audit: §28 was written before Build A moved the surface Build B consumes.

### 29.0 What is wrong

**① Two things sheet 5 needs are on neither path. They open Build B and one of them reopens Build A's
surface.** §29.2.

**② "12 static + 162 subtype CMS keys" is stale by one.** It is **13 static** `[MEASURED]`,
`CMS_STATIC_FIELDS` in `app/server.js` — the tips-heading amendment added a fifth sheet-5 key after
the count being quoted. Subtype 162 is right.

**③ §3.2's question dissolves rather than needing an assertion, and the repo answers it.** §29.4.

**④ One seam is in the wrong place, and it is mine as much as this brief's.** §3.4 calls commit one
"the ten-minute answer". **It is not ten minutes and it should not be framed that way.** Measuring
`.stxt` against the *real* stylesheet means *writing* the real stylesheet — the namespace decision,
every rule, the whole panel CSS. That is most of the CSS work in Build B, and calling it ten minutes
invites a rushed stylesheet whose numbers then get treated as settled. It is still the right first
commit, and §29.4 designs it so it needs no builder and no `built` flag. It is a half-day, not ten
minutes.

### 29.1 The model slot as landed

`pages.v3_quickref`, `app/report_prep.js:503–518`. `[MEASURED]` on the `anders_sx9` fixture; string
lengths are `String.length`.

| field | type | how `report_prep` puts it there |
|---|---|---|
| `subtype` | object `{instinct, code, naranjo, signature, summary}` | IIFE at `:504`; selects from `v3SubtypeRows` **by instinct code** (`.find(c => c.instinct === dom)`), falling back to `v3SubtypeRows[0]` |
| `lead` | string, 162 ch | `stat.quickref_lead_v3 \|\| ''` |
| `h2` | string, 26 ch | `stat.quickref_h2_v3 \|\| ''` |
| `zone8` | string, 227 ch | `stat.quickref_zone8_v3 \|\| ''` |
| `tips` | array[4] of string | `stat.quickref_tips_v3 \|\| []` |
| `tips_heading` | string, 47 ch | `stat.quickref_tips_heading_v3 \|\| ''` |
| `labels` | object, **4 keys** | `stat.quickref_labels_v3 \|\| {}` |

All six `stat.*` reads are override-resolved for free: `stat = resolveLibObject(overrides, 'static',
lib('static'))` resolves each child as `static.<field>`.

**Must be DERIVED, not read — neither is in the slot** `[MEASURED]`, `'tagline' in subtype` and
`'sname' in subtype` both false:

* **tagline** — `${naranjo} · ${signature}`, no article → `Fusion · Merging & Intensity`
* **`.sname`** — `The ${m.display.subtype_label}` → `The One-to-One Nine`
* `.pname` ×2 — `Type ${m.hero.number} · ${m.hero.name}` / `Type ${m.alternate.number} · ${m.alternate.name}`
* `.irank` ×3 — `instinctRanks(m.display.instinct_code, m.charts.instincts)`
* `.icode` ×3 — the literals `SP`/`SO`/`SX`
* `.ifill` widths — `m.charts.instincts[].score` as a percentage (66 / 64 / 84)
* eyebrow and `<h1>` — from `V3_PAGE_ORDER`'s `quickref` row, never literals
* footer — `_v3Footer(page)`

**Read from elsewhere, must NOT be duplicated into the slot** `[MEASURED]`, all present at
`4a2f80e`: `m.charts.types` (array[9] of `{type, position, score}`, positions 1–9 in array order),
`m.charts.instincts`, `m.hero.number` / `m.alternate.number`, `m.display.instinct_code`,
`m.display.subtype_label`, `m.pages.type_hypotheses.core_motivation` (145 ch) and
`.alternate_core_motivation` (80 ch). `instinctRanks` is a renderer-local helper
(`renderer.js:4037`), not a model field.

**The diagram is already complete.** The `client-quickref` branch of `buildEnneagramSVG` emits the
nodes, both rings, the LEADING/ALTERNATE labels, the nine-block legend **and** the
"Less like you / More like you" captions `[MEASURED]`. Sheet 5 calls it and adds nothing.

### 29.2 The two gaps — these open Build B

#### 29.2a The tips' bold lead-in was flattened, and the fix is a content change

The mockup renders each tip as `<b>Bring what didn't land.</b> The parts that felt wrong…`
`[MEASURED]`, raw markup. Build A extracted `textContent`, so what is stored is
`"Bring what didn't land. The parts that felt wrong…"` — **the bold split is gone, and it is on
neither path.** All four tips are affected.

**Do not reconstruct it by splitting on the first period.** It happens to work for all four strings
today `[MEASURED]` and it is exactly the class of invented rule this project has already paid for —
spec §7.4 struck three character ceilings generated by a rule ("label width drives the wrap") that
was invented, written into nine documents, and disproved. A lead-in containing an abbreviation, a
decimal, or a question mark breaks it silently inside a client PDF.

**The repo's own precedent is an explicit sentinel, not a heuristic.** `splitWingBest`
(`report_prep.js:32`) splits on the literal `"At their best:"` authored into the content, returning
`{body, best}`. Sheet 5 wants the same shape: a marker in the stored string, split in `report_prep`,
two fields on the model.

**This reopens Build A's content surface** — the constant, the library, the CMS value shape — so it
is a content decision, not a rendering one, and it needs Cai before Build B's CSS is written.
**Alternative worth considering:** drop the bold entirely. It is a visual emphasis nobody has
ratified, and the mockup is canon for layout only.

#### 29.2b No collision signal reaches the model, so the page cannot do what the diagram does

Forced a collided record (`alternate_candidate = confirmed_type`) and built the model `[MEASURED]`:

| | value |
|---|---|
| `hero` / `alternate` | **both `9 · The Peacemaker`** |
| `_flags` mentioning collision | **none** — `collision_flag` is set on the apiResult by `call2_stamp.js:64` and `buildClientModel` does not surface it |
| `core_motivation` vs `alternate_core_motivation` | **DIFFERENT strings for the same type** — 145 ch vs 80 ch, not identical |
| `charts.types` positions 1, 2 | **`9@1`, `5@2`** |

**So sheet 5, built naively, renders two `.pick` panels both headed `Type 9 · The Peacemaker`,
carrying two different paraphrases of the same motivation.** That reads as two hypotheses about one
type — worse than a visible duplicate, because it looks deliberate.

`buildEnneagramSVG` solves this internally: it drops the alternate ring rather than throwing, and
documents why at length (`renderer.js:1329–1345`). **The page has no equivalent and no signal to
build one on.** And note the third row: `typeRamp`'s de-duplication gives **position 2 to type 5**, a
type the page never names — so the second-darkest node belongs to a type absent from both panels.

**This is a data gap before it is a rendering decision.** Either `buildClientModel` surfaces the
collision, or the builder infers it from `hero.number === alternate.number` — which is available and
sufficient, but leaves the *policy* undecided: suppress the alternate panel, relabel it, or show it.
That is Cai's call and it is not in this brief.

### 29.3 What §28 got stale — my audit against my own build

| §28 claim | status at `4a2f80e` |
|---|---|
| `_clv3Instincts` contract — `(m)` → HTML string, `v3Page(key)`, `m.pages.<slot>`, `_v3Footer(page)`, registered in `V3_PAGE_BUILDERS` | **HOLDS** unchanged |
| Naranjo + signature reach the renderer "slotted for p10's three columns, **needs reslotting for one**" | **MOVED.** Build A did the reslot: `pages.v3_quickref.subtype` selects by instinct code from the same `v3SubtypeRows` p10 reads. §28's instruction is done. |
| "Two data steps precede Build B: the 27 summaries, and **the eight** static chrome strings" | **MOVED and was WRONG when written.** Both steps are done; the count was twelve, not eight. |
| `.lead`, `.plbl` ×2, `.hhd` ×2, H2, zone 8, four tips — "mockup only" | **MOVED.** All in the library, six of them CMS-editable. |
| The unwritten conventions — `v3-qr-` namespace, `_v3t` vs `esc`, no HTML comments in output, `_v3Tokens`, footer from `V3_PAGE_ORDER`, `built` in the same commit, bump `PAGE_INVENTORY` by hand, never inline the mockup's SVG | **ALL HOLD** |
| Registry: `quickref` is already row 5, only `built` absent | **HOLDS** `[MEASURED]` |
| Tripwire: `PAGE_INVENTORY.client_v3` is `10`, hand-maintained, deliberately underived | **HOLDS** |
| TOC asserts registry-consistency, never document-existence; prints "3" for a page that does not exist | **HOLDS** |
| `pilotTypes` live, unused, set by no entry | **HOLDS** |
| Gate coverage list | **REFRESHED** — §29.6 |

**One §28 claim was wrong when written and is corrected here.** §28.6 listed naranjo/signature as
reaching the renderer "for p10's three-column layout, needs reslotting" and implied that was Build
B's work. It was Build A's, and Build A did it. Anyone planning from §28 alone would scope it twice.

### 29.4 The `.stxt` box

**Where v3 styles live** `[MEASURED]`. Three sheets, emitted in this order by
`buildClientReportHTML_v3` (`renderer.js:4193–4195`):

1. `partAStyles()` — shared with the coach report
2. `clientReportV3Styles()` — `app/client_report_v3_styles.js`; the shell, the tokens, and the reset
   `.v3-page, .v3-page *{ margin:0; padding:0; box-sizing:border-box }`
3. `clientReportV3PageStyles()` — `app/renderer.js:2987`; **this is where a page contributes its own
   CSS**, and where Build B's `.v3-qr-*` rules go.

**§3.2 — source-order specificity, answered. The question dissolves.** `[MEASURED]`: **187 of 188**
top-level rules in `clientReportV3PageStyles()` are of the form `.v3-page .x{…}` — specificity
**(0,2,0)** against the reset's `.v3-page *` at **(0,1,0)**. The single exception is
`.v3-page.is-cover`, also (0,2,0). **Specificity decides, not source order.** Follow the existing
convention — `.v3-page .v3-qr-*` — and the ordering B1.3 asked about never arises. Build B asserts
the resulting width, not the cascade mechanism.

**§3.3 — what could move the box, each judged.**

| candidate | real risk? |
|---|---|
| **Namespace rename** `.two/.half/.hbd/.stxt` → `.v3-qr-*` | **NO.** Renaming changes nothing geometric provided the new rules keep the same declarations and are written at (0,2,0) like every other page rule. |
| **Specificity / the v3 reset winning** | **NO**, for the reason above — and it is why the convention exists. |
| **The 18px gap** | **YES, and it is the largest single lever.** `.stxt` = `(710 − gap)/2 − 2 − 36`. Every 2px of gap costs 1px of box. |
| **The 1px border on `.half`** | **YES, small.** Dropping it widens `.stxt` by 1px per side. |
| **`.hbd` padding `16px 18px`** | **YES.** The 18px horizontal is subtracted twice; changing it moves the box 1:1. |
| **A fixed-width instincts half** | **YES, and it is the one that breaks silently.** `flex:1 1 0%` is what makes the halves equal. A `flex-basis` or `width` on the instincts half makes the subtype half a different box and no gate notices. |
| **Inherited rules from the v3 shell the scaffold did not have** | **NO.** The Build 0 scaffold injected into a *real* `.v3-page` inside the *real* document, so shell inheritance was already in play — it is the one thing that measurement did cover. |
| **`font-size` / `line-height` drifting from 12.5 / 1.5** | **YES**, and it changes line count without changing width, which is the failure the box measurement would not catch. |

**§3.4 — commit one, designed.**

The tension the brief does not name: emitting the panel "for real" seems to need a builder and
`built: true`, which would put an unbuilt page into the document and force the inventory bump. **It
does not.** CSS for markup that does not exist yet is inert — it renders nothing and costs nothing.

**Commit one contains:**

1. The complete `.v3-qr-*` block written into `clientReportV3PageStyles()`, at `.v3-page .v3-qr-*`
   specificity, porting the mockup's declarations. **No builder. No `built` flag. No
   `PAGE_INVENTORY` change. No content.**
2. A scaffold probe (scratchpad, uncommitted) that renders the real document, injects only the
   **markup** skeleton into a real `.v3-page`, and measures — the Build 0 method with the CSS now
   coming from the shipped stylesheet instead of from the mockup.

**It reports:** `.stxt` content width against **308.00 px**; computed `font-size` and `line-height`
against 12.5 / 18.75; `.half` computed `flex-grow/shrink/basis` and both widths; the Arial probe
against 2378.81. **If `.stxt` is 308.00 px, `m` = 44 and the 132 ceiling stand and Mo continues. If
it is not, §26.3–§26.5 are re-run at the real width and Mo stops that day.**

This is the only commit in Build B whose result can invalidate work already published to an author.
It goes first for that reason, not because it is small.

**§3.5 of the Build B prompt — which gate catches transparency in a new page's CSS.**

`verify_diagrams.js:195` scans a regex over **the emitted SVG string only** — it never sees CSS.
`[MEASURED]`

`verify_transparency.js` is the one that would catch it, and it catches it **in the rendered PDF**,
not in the source — so `rgba()`, `transparent`, or an `opacity` in `.v3-qr-*` surfaces as a
transparency group or a non-opaque alpha and fails. Its page-level half runs on **one fixture at one
type** (`FIXTURE = 'anders_sx9'`, no retype loop) `[MEASURED]` against the render harness's 32.

**For CSS-introduced transparency, one render is sufficient**, because page CSS does not vary by
type or instinct — the same stylesheet is emitted on every one of the 32. The one-fixture limitation
is real but it bites **content-driven** transparency, not this. Stated precisely so Build B does not
"fix" a non-problem.

### 29.5 The deferred CMS half

**§4.1 — what the entry needs.** The template is the p10 entry (`server.js:13948`):
`{ page, selector, doc: 'v3', apply }`. Sheet 5 needs the same four:

* `page` — a display label, e.g. `'P5 — Quick Reference'`
* `doc: 'v3'` — the flag that routes through the v3 document builder
* `selector` — `.v3-page:has(.v3-qr-…)`, naming a class that appears **only** on sheet 5. The bare
  `.v3-page` is the documented trap: `page.$()` returns the first match, the cover.
* `apply(m, v)` — writes the edited value into `m.pages.v3_quickref.<field>`

**§4.2 — one selector, six `apply`s.** All six editable keys render on the same page, so they share
a single selector; each needs its own `apply`. The five `static.quickref_*_v3` keys go in the
`STATIC` map; `subtype_*.quickref_v3` needs a branch in the subtype regex and the `SUB` map, and —
following the p10 `instincts_v3` precedent — the previewed page should be seeded so the client's
**own** subtype is the one rendered, since sheet 5 shows exactly one.

**§4.3 — the coincidence gets larger, and yes, something should assert it.** `CMS_STATIC_FIELDS` is
**13** `[MEASURED]`; `cmsPreviewSpec`'s `STATIC` map is **8**. Build B takes preview to 13, so the
coincidence goes **8 of 8 → 13 of 13** and nothing asserts it at either size. An editor whose key is
in one list and not the other gets a silent capability gap — editable but unpreviewable, or the
reverse. **The assertion is cheap and is blocked on §29.6's `server.js` problem**, which is what
makes that problem worth fixing rather than merely noting.

### 29.6 Gates

**§5.1 — refreshed against `4a2f80e`.**

| gate | will it examine sheet 5? |
|---|---|
| `npm test` — `report_pages_test.js` | **YES**, and hardest: container count, footer sequence, header count, TOC page numbers |
| `npm run verify:render` | **YES** — single-sheet contract across the 32 renders |
| `verify_transparency.js` | **PARTLY** — the page-level PDF scan, 1 fixture of 32; sufficient for CSS, not for content |
| `verify_diagrams.js` | **NO** — the SVG in isolation, never the page |
| `verify_content_library.js` | **NO** — asserts JSON == build(docx); says nothing about rendering |
| `verify_coach_baseline.js` | **NO** — coach path, structurally blind |
| `check_docs.py` | **NO**, and not in CI |
| Anything touching `app/server.js` | **NO** — §5.4 |

**§5.2 — what Build B must assert that nothing asserts today.** Beyond the brief's three:

1. `.stxt` renders **≤ 3 lines** for all 27 summaries **in the built page**, by the merged-rect
   method, not by character count.
2. `.stxt` content width is **308.00 px** in the built page — the number nothing has ever gated.
3. Single sheet across the **32**-render matrix.
4. A **collided** record renders a complete document — and §29.2b says what "complete" must mean,
   which is a decision before it is an assertion.
5. **`.half` computed `flex-basis` is `0%` and both halves are equal**, which is what makes (2)
   durable rather than incidental.
6. The **subtype panel's naranjo matches p10's** for the same client — one read, two pages, and
   nothing currently proves they agree in the output.
7. `font-size` 12.5 / `line-height` 1.5 survive into the built stylesheet — §26.6 item 2, still open.
8. The page renders **no `.sname`/`.stag` article artefact** — i.e. the tagline carries no leading
   `The`, which is the one ratified string most likely to be reintroduced by porting the mockup.

**§5.3 — confirmed.** `PAGE_INVENTORY.client_v3: 10 → 11` is the single edit. `EXPECTED_PAGES`
derives from it, and its only consumers are `report_pages_test.js` and `tests/run_test.js`
`[MEASURED]`. **Nothing else counts pages**, and the literal is still deliberately underived — the
comment at `report_page_inventory.js:29–47` is the reason and it still stands.

**§5.4 — it stays true after Build B, and the cheap fix is not a test.** `app/server.js` **exports
nothing** (`module.exports` count: **0**) and **binds a port on require** — `app.listen(PORT, …)` at
`server.js:17236` `[MEASURED]`. So it is not merely untested, it is **structurally untestable**: a
test that requires it would open a socket in CI. Build B adds the preview entries to that file, so
after Build B the untested surface is *larger*.

**Cheapest thing that would make it false:** extract the CMS key predicates and maps —
`CMS_STATIC_FIELDS`, `CMS_SUBTYPE_FIELDS`, `cmsIsValid*Key`, `cmsPreviewSpec` — into a
side-effect-free module (`app/cms_keys.js`) that both `server.js` and a test require. That is a
mechanical move, it unblocks §4.3's assertion, and **it is PR 7's, not Build B's** — Build B should
not carry a refactor of the server on top of a new page.

### 29.7 The plan

**§6.1 / §6.2 — Build B splits into four. Over-split, as asked.**

| | commit / build | ends at |
|---|---|---|
| **B1** | **The stylesheet and the box.** `.v3-qr-*` into `clientReportV3PageStyles()`; scaffold-measure `.stxt`. No builder, no `built`, no inventory. | A measured width against 308.00 px, and a go/stop for Mo. **Everything else waits on this.** |
| **B2** | **The page.** `_clv3QuickRef`, `built: true`, `PAGE_INVENTORY` → 11, `buildEnneagramSVG('client-quickref')`, `instinctRanks`. | 32 renders single-sheet; `report_pages_test` green on 11 containers and the footer sequence; the TOC's "3" finally true. |
| **B3** | **Fit and the assertions.** §29.6's list — 27 summaries at ≤ 3 lines in the built page, the flex assertion, naranjo agreement with p10. | The 132 ceiling confirmed against the built page, or restated. |
| **B4** | **The CMS preview half.** Six `apply`s, one selector, `doc: 'v3'`. | An editor can preview every one of the six editable keys. |

Cai's **D** — the collided-record fixture — stays a separate build in PR 5, and §29.2b now gives it
a decision to encode rather than only a fixture to write.

**§6.3 — riskiest part, and what de-risks it.** Still the box, and B1 is the de-risking. But the
sharper risk is **ordering**: §29.2a (the tips' bold lead-in) is a *content* decision that reopens
Build A's surface, and if it is settled after B2 the CSS for `.ttxt` gets written twice. **Settle
29.2a before B1 starts** — it costs one decision and nothing else in the plan depends on it.

**§6.4 of the prompt — what has not been asked and I would want settled.**

1. **The tips' bold lead-in** — sentinel, or drop the bold? §29.2a. Blocks B1's `.ttxt` rules.
2. **Collided-record policy** — suppress the alternate panel, relabel it, or show it? §29.2b.
   Blocks B2's `.pick` markup and B4's fixture.
3. **Zone 8's negative top margin.** The mockup carries `style="margin:-6px 0 18px 0"` inline. Under
   the v3 reset every descendant starts at `margin:0`, so this becomes a real declaration rather
   than an override of a UA default. Ratified as a modifier class — is the **−6px** ratified, or was
   it mockup nudging?
4. **Is `.ifill` width = instinct score?** The mockup's 66/64/84 equal `charts.instincts` exactly
   `[MEASURED]`, so it looks like a straight percentage — but nothing states it, and a bar whose
   length is a raw coherence score is a design claim, not a rendering one.
5. **`pages.type_hypotheses.discriminator`** is populated and unused. Does sheet 5 want it?

**§6.5 of the prompt — belongs elsewhere, one line each.**

* **PR 7** — `app/server.js` exports nothing and binds a port on require; the whole CMS key surface
  is structurally untestable.
* **PR 7** — nothing asserts `CMS_STATIC_FIELDS` and `cmsPreviewSpec` cover the same keys.
* **PR 7** — nothing asserts `SCRIPT_SOURCED` covers every `INTERIM_*` constant.
* **PR 7** — **no v3 page slot appears in `CLIENT_SPEC`**; the whole v3 model family is unvalidated.
* **PR 7** — `pages.type_hypotheses.core_motivation` is in `CLIENT_SPEC` but
  `.alternate_core_motivation` is not, while the comment above it (`report_prep.js:386`) asserts
  CLIENT_SPEC would catch a regression there. Sheet 5 is the only page that renders the alternate.
* **PR 7** — `verify_transparency`'s page-level half runs 1 render against the harness's 32.
* **PR 7** — no collided-record fixture exists anywhere, and the retype rule
  `alternate = (asType % 9) + 1` cannot produce one.

### 29.8 Measured baselines for Build B's predictions

**Measured now, at `4a2f80e`, on this machine — not quoted from any earlier section.** Two runs each
for the fast gates. **These are the most recent runs by construction: they were taken at HEAD after
the last merge, with nothing since.** Build A's two misses came from quoting audit §25.2, which
Build 3 had already superseded; this table exists so that cannot recur.

| gate | run 1 | run 2 | use |
|---|---|---|---|
| `npm test` | **0.39 s** | **0.23 s** | 0.23–0.39 s — the spread is real, do not predict a point |
| `npm run verify:render` | **52.48 s** | — | 52.5 s |
| `verify_diagrams.js` | **1.18 s** | **1.01 s** | 1.0–1.2 s |
| `verify_transparency.js` | **7.45 s** | **7.48 s** | 7.5 s |
| `verify_coach_baseline.js` | **2.83 s** | **2.81 s** | 2.8 s — HTML half only off-Linux |
| `verify_content_library.js` | **0.21 s** | **0.19 s** | 0.2 s |
| **local subtotal** | | | **≈ 64.5 s** `[AGGREGATE]`, sum of the faster run of each |

**CI wall-clock, last `main` run** `[MEASURED]`: run `34291163853`, sha `4a2f80e`,
23:33:17Z → 23:35:24Z = **2 m 07 s**. Build B adds one page to a 32-render matrix, so
`verify:render` is the only step that should move materially.

**Two of these supersede audit §25.2 and the gap is why §25.2 must not be quoted again**:
`verify_diagrams` 0.95 s → **1.0–1.2 s**, `verify_transparency` 2.89 s → **7.5 s**, both because
Build 3 enlarged them.

---

## 30. Scoping — the ALTERNATE ring reads position

Read at **`70add3e`**, read-only. Nothing built, no product code changed. This is scoping for a
decision already taken; the audit's §29 remains B2's plan-detail and is unaffected.

**[DECISION — Cai, 9 Sep] The ALTERNATE ring reads POSITION 2 instead of `alternate.number`.** The
page therefore marks two candidates on every record, collided ones included.

### 30.0 What is wrong

**The gate that covers this figure most heavily cannot see the change at all, and the one assertion
that can see it currently asserts the opposite.** `[MEASURED]` — simulating both implementations
across the gate's own sweep: **identical in 72 of 72 ring pairs, zero differing.** The single case
that distinguishes them is the collided record, and `scripts/verify_diagrams.js:258–286` asserts
today that it draws **one ring, no dashed stroke, no ALTERNATE label** — exactly what the decision
reverses. **That block goes red on the first commit, by design, and it must be inverted rather than
widened.**

So the change's entire evidential weight sits on one assertion that has to be rewritten in the same
commit that breaks it. That is worth knowing before it is buried in a page build.

### 30.1 What changes in `buildEnneagramSVG`

**One line.** `app/renderer.js:1347`:

```
const altN = (alternate != null && alternate !== leading) ? alternate : null;
```

becomes a read of the type at position 2 from `scores` — the same array `posOf` is already built
from at `:1323`.

`altN` is consumed in exactly **two** places `[MEASURED]`, and both follow from that one definition:

| line | use |
|---|---|
| `:1352` | `const isLead = i === leading, isAlt = i === altN;` — draws the dashed ring |
| `:1403` | `[place(leading, 'LEADING'), place(altN, 'ALTERNATE')].filter(Boolean)` — draws the label |

The `alternate` parameter becomes **unread by the quickref branch**. Whether it stays in the
signature is B-of-this-build's call; the other variants are unaffected.

Three comment blocks describe the retired behaviour and would be stale on landing: `:1314–1318`
(the "rings are parameters, not derived" rationale), `:1328–1346` (the whole "TWO RINGS ON ONE NODE:
THE ALTERNATE IS DROPPED, NOT THROWN" argument), and `:1322`'s claim that position 2 *is*
`alternate.number` — which becomes the mechanism rather than a coincidence worth noting.

### 30.2 Does anything still read the named-vs-inferred distinction?

**Yes — one thing, and it is the right thing.** `call2_stamp.js:64` sets `collision_flag = true` and
raises an `engine_collision` flag for admin review; `tests/redirect_logic_test.js:58` asserts it.
`[MEASURED]` — those, plus `renderer.js:1347`, are the only readers in the repo.

**So the branch retires cleanly.** The distinction between an alternate the engine *named* and one
*inferred* from the ranking is an engine fact addressed to a coach or an admin, and it survives
intact in the flag. It was never a rendering fact addressed to a client. What the figure was doing
was translating an internal provenance distinction into a missing ring on the page the client reads
first — and the ramp was contradicting it in the same picture anyway (§29.2b): `rankFill(posOf[i])`
shades position 2 second-darkest on a collided record regardless. **The decision removes a
contradiction rather than adding a claim.**

### 30.3 The dashed ring and the ALTERNATE label always render

**Confirmed** — both flow from `altN`, so both appear whenever position 2 resolves. `[MEASURED]` on
the collided case: current `altN = null`; proposed `altN = 5`, i.e. a dashed ring and an ALTERNATE
label on node 5.

**One residual null path, and it should be kept.** `place()` returns `null` when `i == null || !N[i]`
(`:1399`), and `.filter(Boolean)` drops it. If `scores` were empty or malformed, position 2 would not
resolve and the figure would fall back to one ring rather than throw. That is the same
degrade-not-hard-stop posture the retired branch had, for a different cause, and it is worth
preserving explicitly rather than inheriting by accident.

**What downstream assumes about ring count:**

| consumer | assumes one ring? |
|---|---|
| Label-separation floor, `:1407` — `if (marks.length === 2 && marks[0].up === marks[1].up)` | **No.** It is already conditional on two marks and simply becomes always-true. `LBL_SEP = 14` and the symmetric push are unchanged. |
| Label rail, `:1386–1387` | **No.** The rail sits outside every node's ring by construction, so a label cannot overlap any node — the property the per-node rule could not guarantee. |
| Nine-block legend, `:1424+` | **No.** Reads `RANK_FILL`, independent of rings. |
| Node-count / edge-clearance check, `verify_diagrams.js:150` | **No.** "One box per position, sized to the largest circle there" — it already sizes for a ring where one exists. |
| `verify_diagrams` collided block, `:275–283` | **YES — and it is the only one.** §30.4. |

### 30.4 What `verify_diagrams` asserts, and what it would not catch

**The 72-pair sweep would not catch this change, because it cannot.** The sweep builds its score
vector with `orderFor(lead, alt)` (`:57–65`), which does `put(lead); put(alt);` — so **position 2 is
the alternate by construction**. Reading `alternate` and reading position 2 return the same value for
every pair. `[MEASURED]`: **72 of 72 identical, 0 differing.**

That is the IO-108 tautology in its exact form: the gate derives its expectation from the same rule
the code is about to adopt, so it agrees with the change before the change is made. **A wrong
implementation of "read position 2" would still pass all 72** — the sweep is not evidence here.

**What the sweep does still assert, unaffected:** node-count and edge clearance per pair, the banned
opacity scan (`:203`), and the `#F68625` client-orange exclusion (`:208`).

**What must change:** the collided block at `:258–286` inverts. Today it fails on
`rings !== 1`, `dashed !== 0`, and any ALTERNATE label. It must assert **2 rings, 1 dashed stroke,
an ALTERNATE label present, and that the label names a type different from the leading** — plus the
existing must-not-throw, which stays.

**Does the gate need widening? Yes, in one specific way, and it is not more pairs.** The collided
case is currently the only render where the two implementations differ, so it is the whole test. It
should therefore be swept rather than run once — at minimum across several leading types, since
position 2 depends on the ranking tail and a single hard-coded pair proves it for one tail only.

**A defect in that block, found while reading it and not fixed:** it renders
`leading: 9, alternate: 9` but passes `SWEEP_SCORES`, which is `orderFor(9, 5)` `[MEASURED]` — a
score vector for a **non-collided** record. The rings say collided and the positions say otherwise.
It happens not to matter numerically (both `orderFor(9,5)` and `orderFor(9,9)` put type 5 at
position 2 `[MEASURED]`), which is precisely why it has survived. Under this decision the block
starts reading position 2, so its score vector stops being decorative and becomes the thing under
test. Pass `orderFor(9, 9)`.

### 30.5 Who else reads `alternate.number` for a visual decision

`[MEASURED]` — every read in `app/renderer.js`:

| line | reader | v3? |
|---|---|---|
| `:1785` | coach report — "Alternate: Type N — Name" | no, coach |
| `:1850` | coach page 2 comparison header | no, coach |
| `:2285` | **v2 client p3** — "Also in the picture: Type N (Name)." | no, v2 client |
| `:2315` | **v2 client p3** comparison table header, ALTERNATE badge | no, v2 client |

**Inside v3, `buildEnneagramSVG` is the only reader**, so this change leaves no v3 sibling reading
the scalar — today.

**The sibling to watch is not in the repo yet.** Sheet 5's `.pick` panel is B2's, and it is the
element that names the alternate *in words* beside this figure. **If it reads `alternate.number`
while the ring reads position 2, a collided record produces exactly the split the decision exists to
prevent** — a panel headed with the leading type's name beside a dashed ring on a different node.
**B2 must source the panel from position 2 as well**, and that is a constraint this build should hand
forward rather than leave to be rediscovered.

Named, not scoped: the two **v2 client** readers at `:2285` and `:2315` name the alternate from the
scalar and will print the hero's own type on a collided record. That is a live defect in the report
that ships today, and it is not this build's.

### 30.6 Its own build, before B2

**Cai's reasoning is right, and there is a stronger reason than the one given.** The stated one —
that a red diagram gate during B2 would have two possible causes — holds. The stronger one is
§30.0: **the 72-pair sweep proves nothing about this change, so the entire evidence for it is one
assertion that has to be inverted in the same commit that breaks it.** An inverted gate assertion
landing inside a page build reads as collateral damage from the page. On its own it is the subject.

It is also genuinely self-contained: one line of `buildEnneagramSVG`, three stale comment blocks, one
gate block inverted and swept. No page, no model, no content, no CMS. Call it **B1.5**, before B2.

**Sequence:** invert and sweep the gate assertion first so it is red for the right reason, then
change the line, then confirm the 72 pairs are byte-identical — which is the real regression check
here, since identical output across the sweep is what proves nothing else moved.

### 30.7 For PR 7 — named, not scoped

* The v2 client report names the alternate from `alternate.number` at `renderer.js:2285` and `:2315`,
  so a collided record prints the hero's own type as "also in the picture".
* `verify_diagrams`'s collided block renders `9 × 9` but passes `orderFor(9, 5)` — the score vector
  contradicts the ring parameters.
* IO-108, restated with a fresh instance: the quickref sweep derives position 2 from the same rule
  the figure reads, so it agrees with any change to that rule before the change is made.
