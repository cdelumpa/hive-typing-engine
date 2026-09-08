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
confirm it below (§9.1), but its citation points at a function nothing calls. The live emitter is
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
* **Label-to-label: assert non-overlap only**, exactly as the corrected §3.5 already prescribes. If a
  numeric floor is ever wanted, p5's measured baseline is **24.81** counting numerals, **46.98**
  excluding them — and the two must not be conflated, which is arguably how 27.7 was born.

### 7.3 Ringed node, dashed node, ramp legend — **all new** `[MEASURED]`

`buildEnneagramSVG` has five variants: `base`, `type`, `my-report`, `wings-lines` (v2), and four v3
ones — `client-cover` (`COVER_GEO`), `client-whatis` (`WHATIS_GEO`), `client-explore`
(`EXPLORE_GEO`), `client-wings`/`client-lines` (`CLIENT_GEO`). **None supports any of the three.**

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

## 19. Commits

Enumerated at the end of the run. No push, no PR, no merge, no branch deletion.

| # | SHA | Message |
|---|---|---|
| 1 | `8ec97e7` | PR 5 audit: Quick Reference (sheet 5 / footer 3) — §§1–11 |
| 2 | `8e553e4` | PR 5 audit: record the commit set in §12 *(the commits section, since renumbered to §19)* |
| 3 | *this commit* | PR 5 audit addendum: content sources and the reopened P2 — §§12–18 |

Commit 3's SHA is reported in the build response and readable from `git log --oneline main..HEAD`.
It is deliberately not written here: a commit cannot record its own SHA, and amending one to insert
it just produces a new SHA and a stale table — which is what happened on the first attempt at
commit 2, and is why that commit exists at all.

Branch `pr-5-quickref-audit`, off `main @ f385c9a` — unchanged across both runs; the addendum pull
brought nothing down. `git diff main...HEAD --stat` touches `docs/audit_pr5_quickref.md` and nothing
else — no code and no content changed, as both prompts required.
