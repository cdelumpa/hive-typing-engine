# PR 1 — Foundation: Pre-Build Audit

**Prepared by:** Claude Code (lead engineer / QA)
**Date:** 11 August 2026
**Against:** `main` @ `12ba66b` (PR 0 merged via PR #68)
**Scope:** Investigation only. No files changed outside this document.
**Answers:** the six questions in the PR 1 audit brief, against the actual codebase.

**Decisions taken as settled and not re-opened:** PR 1 stays whole (no 1a/1b split); CI workflow rather than a manual checklist; synthetic fixtures are acceptable for PR 1–6.

---

## Executive summary — the five things that matter

1. **There is no render container to pin.** No Dockerfile, no `railway.json`/`nixpacks.toml`/`Procfile`, no `engines` field. Deployment is auto-detected. "Pin the container" is not a config edit — it is *creating* build configuration that does not exist.
2. **Dev and production already render with different Chromium versions.** Production uses Puppeteer's bundled **147.0.7727.57**; local dev uses system Chrome **151.0.7922.137**. The §3.3 risk is not hypothetical — it is live today, and every local measurement is being taken on the wrong engine.
3. **CSS consolidation is far smaller, and differently shaped, than the plan assumes.** Of 285 unique selectors, only **9** are shared identically and **15** conflict semantically; **261 (92%) are single-page component CSS**. The work is *reconciling 15 drifted selectors*, not extracting 478 rules. And the drift is load-bearing: `.lead` carries five different `margin-bottom` values tuned for single-sheet fit.
4. **`scripts/build_content_library.js` is a loaded gun.** The committed `content_library.json` contains a hand-added key (`static.wings_using`) that the build script does not produce. Running the script today silently regresses the live Wings & Lines page. This must be defused in PR 1 because PR 1 touches Wings content.
5. **The 18-diagram contact sheet contains a real, unreported bug.** WINGS · TYPE 1's wing label collides with the home node and the home label. Spec §3.5 claims "54 labels, zero clipped, minimum label-to-label gap 27.7px." That claim is false. **Fixed in PR 1** via a general placement rule, with all 18 diagrams regenerated and re-verified (§7.3).

> **§7 (Round 2)** answers the four review items and **supersedes two recommendations in this document**: the content path (§4.2 → §7.1) and the Type 1 fix placement (§3.3 → §7.3). It also corrects a gate that cannot be implemented as written: Chromium stamps wall-clock timestamps into every PDF, so **coach PDF byte-comparison is impossible** — the PDF gate must be structural (§7.0).

---

## 1. Infra pinning — what does it actually take?

### 1.1 There is no container config to edit

Searched the repo: **no `Dockerfile`, no `railway.json`/`railway.toml`, no `nixpacks.toml`, no `Procfile`, no `.github/`, no `engines` field in `app/package.json`.** The deploy target (Railway, per code comments) is auto-detecting the Node app and building it with a default Nixpacks image.

**Consequence:** "install a metric-compatible font" has nowhere to go today. PR 1 must *introduce* build configuration. The two viable mechanisms:

| Option | Mechanism | Trade-off |
|---|---|---|
| **A. `nixpacks.toml`** (recommended) | `[phases.setup] nixPkgs = ['liberation_ttf', ...]` — keeps Railway's zero-config build, adds only the font | Minimal diff, Railway-native, no image maintenance. Nixpacks-specific. |
| **B. `Dockerfile`** | Full control: `apt-get install fonts-liberation`, pin base image | Portable and explicit, but takes over the whole build and is far more surface for a docs-adjacent PR |

**Recommendation: Option A.** PR 1 should not become a containerization project. A `nixpacks.toml` that adds the font package is a handful of lines and is reversible.

### 1.2 Fonts — what the report actually asks for

The shared CSS declares the stack (`app/renderer.js:1223`, inside `partAStyles()`):

```css
body{font-family:Arial,Helvetica,sans-serif;color:var(--body);}
```

The v3 mockup declares `font-family: Arial, sans-serif`. **Arial is not present on a stock Linux container** — neither is Helvetica. Chromium falls back to whatever the image provides (commonly DejaVu Sans), which is **metrically different from Arial**. Every line-count, last-line-fill and single-sheet measurement in spec §3 assumes Arial metrics.

**Mechanism:** install **Liberation Sans** (metric-compatible with Arial: same advance widths, so line breaks land identically) via the chosen build config, and verify at render time. No `@font-face` and no embedded webfont exists anywhere in the repo today (checked `renderer.js`, `report_assets.js`) — this is purely a system-font question.

**Verification worth adding to PR 1:** a runtime assertion that the resolved font is actually Arial/Liberation Sans rather than a fallback — otherwise the failure is silent, which is precisely how §3.3 says this bug arrives.

### 1.3 Chromium — the pin is easy; the *drift* is the real finding

Puppeteer maps 1:1 to a Chromium build. From the installed package:

```js
// app/node_modules/puppeteer-core/lib/cjs/puppeteer/revisions.js
PUPPETEER_REVISIONS = Object.freeze({
  chrome: '147.0.7727.57',
  'chrome-headless-shell': '147.0.7727.57',
  ...
});
```

- `app/package.json` declares `puppeteer: "^24.42.0"` — a **range**.
- `app/package-lock.json` resolves **exactly 24.42.0**, which pins Chromium **147.0.7727.57** (confirmed present at `~/.cache/puppeteer/chrome/mac_arm-147.0.7727.57`).
- **Local system Chrome is `151.0.7922.137`.**

So today: **production renders on Chromium 147 (bundled); local dev renders on Chrome 151 (system).** Four major versions apart, rendering the same HTML, with the single-sheet contract measured locally.

**How to pin, concretely — three steps, in order of value:**

1. **Eliminate the divergence, don't just pin it.** The highest-value change is to stop local dev from using system Chrome, so there is *one* rendering engine everywhere. This means dropping the hard-coded `executablePath` branch (`app/server.js` `launchBrowser`, mirrored in `scripts/render_client.js:59`) in favour of Puppeteer's bundled binary. This is both the pin *and* the dev/prod alignment, in one change.
2. **Change `^24.42.0` → `24.42.0`** (exact) in `app/package.json`, so a stray `npm install` cannot bump the Chromium build.
3. **Use `npm ci`, not `npm install`, in CI and deploy** so the lockfile is authoritative.

**Does pinning risk the coach report?** Yes — and this is the one genuinely uncomfortable answer in this audit. Moving local rendering from Chrome 151 to bundled 147 changes the engine that produces the coach PDF locally. The coach report is *flow-allowed* (`scripts/render_coach.js` reports spill non-fatally; `.report-page` uses `min-height`), so it is far more tolerant of metric shifts than the client report — but "tolerant" is not "unaffected."

**Mitigation:** capture the coach baseline first, then pin, then regenerate and diff. If the coach output shifts, that shift is *information* — production and local were already disagreeing and we have simply made it visible. It is not a regression introduced by PR 1, and it should not be "fixed" by reverting the pin.

> **Refined in §7.0.** The baseline must be captured from the **production** engine (bundled 147), *not* from local 151 — local output never shipped. Local converging on the 147 baseline is the success condition. §7.0 also splits the gate: coach **HTML** byte-identical (Chromium never touches HTML generation), coach **PDF** compared structurally.

---

## 2. CSS consolidation — the real shape

I parsed all 12 tracked mockup `<style>` blocks and normalized whitespace, property order and colour case.

### 2.1 Measured, not estimated

| Metric | Plan/spec said | **Measured** |
|---|---|---|
| Total rules | 478 | **430** |
| Distinct hex values | 39 | **39** ✅ |
| Unique selectors | — | **285** |
| Shared identically across ≥2 pages | — | **9** |
| Semantically conflicting across pages | — | **15** |
| Single-page only | — | **261 (92%)** |

**This reframes the task.** There is no large shared stylesheet hiding in these files. There is a small core of page chrome plus twelve sets of component CSS. The plan's "extract a shared stylesheet" is right in spirit but wrong in scale: the shared sheet is ~24 selectors, and the other 261 stay page-scoped.

### 2.2 The 15 conflicts — and why they are dangerous

The conflicts are almost entirely **spacing tuned per page to hit the single-sheet fit**:

| Selector | Real variants | The drift |
|---|---|---|
| `.lead` | **5** | `margin-bottom`: 24px (5 pages) / 18px (CAR) / 16px (Instincts) / **absent** (Lines) / **6px** (Wings) |
| `.header-rule` | 4 | 22px (6) / 26px (3) / 18px (Lines) / 28px (Welcome) |
| `.intro` | 4 | gap 26–28px, margin 22–26px; Thoughts uses `.intro` for something else entirely (text block, not flex row) |
| `.eyebrow` | 3 | 8px (9 pages) / 10px / 16px (TOC) |
| `h2` | 3 | 10px (6) / 8px (2) / 14px |
| `h1`, `.sub`, `.page`, `body` | 2 each | minor |
| `.band`, `.half`, `.icode`, `.prep`, `.prep-lbl`, `.prep-name` | 2 each | **same name, different component** across pages |

**The trap:** hoisting `.lead { margin-bottom: 24px }` into a shared sheet silently adds **18px to Wings** and **24px to Lines**. Both pages already sit inside a 976px budget with pages measured between 930 and 1047px. That is exactly the class of invisible regression spec §3.1 says was only caught by counting pages in the output PDF.

**Recommendation:** the shared sheet carries the *invariant* properties (colour, font-size, line-height, weight, letter-spacing) and **not** the page-variable ones. Per-page spacing becomes an explicit modifier (`is-tight`, `is-flush`) rather than an inherited default. Concretely: `.lead` shares `color/font-size/line-height`; its `margin-bottom` is set per page. This preserves each page's measured fit instead of averaging it away.

The last six rows in the table (`.band`, `.half`, `.icode`, `.prep*`) are **name collisions between unrelated components** — same class name, genuinely different purposes on different pages. These must be renamed during consolidation, not merged.

### 2.3 Hexes — the "18 tokens" heuristic does not hold

39 distinct values confirmed. But the "appears on 3+ pages ⇒ token" rule is wrong in **both** directions:

- **8 of the 19 spec-listed tokens appear on fewer than 3 pages** — `Alt BG` (1), `Evidence BG` (1), `Stress node` (1), `Security node` (1), `Subtype BG` (2), `Subtype Label` (2), `Red fill` (2), `Red label` (2). They are tokens by *role*, not frequency. §5.2 defines them semantically, and that is the correct basis.
- **4 non-token values appear on 3+ pages** — `#F0F0F0` (12), `#FFFFFF` (7), `#E4E9ED` (3), `#A8BFCA` (3).

Notable: **`#F0F0F0` appears on all 12 pages and must not become a token.** It is `body{background}` — the grey *around* the sheet in a browser. It never reaches the PDF and should not exist in the production renderer at all.

**Genuine near-duplicates to collapse (2):**
- `#D9E1E6` vs `#D9E4E9` (distance 4.2) — almost certainly accidental.
- `#FBFDFE` vs `#F7FBFC` (distance 4.9) — `.krow.is-alt` vs panel.

**Deliberate, do NOT collapse:** the seven Cover gradient stops (`#C8D9D1 #B9E0ED #CBE6F0 #D5EAF2 #E8F2F6 #EDF4F7 #FCFEFE`). These *are* the §3.2 no-transparency work — the gradient terminates on opaque colours instead of `transparent`. Collapsing them re-introduces the bug that produced the pink cover. Also deliberate: `#E4E9ED`/`#8A96A3` (inactive diagram strokes/labels), `#A8BFCA` (rule accent), `#F5D2AC` (instinct track, orange family), `#7FD3E8`/`#9FD9EA` (cover/what-is diagram tints), `#E8E4DF` (Wings One-wing header, pairs with `#D9E4E9`).

### 2.4 Where the stylesheet lives — and why the coach is safe

Ownership is already clean:

| Function | renderer.js | Selectors | Consumed by |
|---|---|---|---|
| `partAStyles()` | :1212 | 1 (`body`) + `:root` vars | **BOTH** reports (:1519 coach, :2490 client) |
| `coachReportStyles()` | :1428 | 56 | coach only |
| `clientReportStyles()` | :2161 | 215 | client only |

**The v3 sheet should be a new `clientReportV3Styles()`, injected only by `buildClientReportHTML_v3`.** The coach pulls `partAStyles()` + `coachReportStyles()` and nothing else, so as long as **`partAStyles()` is not modified**, the coach is untouched by construction.

Two things to know about `partAStyles()`:
- It already implements a **`:root` CSS-variable token system** driven by `PALETTE` (`renderer.js:1002`). v3 tokens should follow this existing pattern, but in the v3-only function.
- Its `--body` is **`#404040`**, whereas v3's Dark Navy is **`#1E2A35`**. Only 4 of the v3 tokens exist in `PALETTE` (`hiveBlue`, `hiveOrange`, `leadingPillBg`, `calloutBg`). So v3 tokens are mostly new and must **not** be added to the shared `PALETTE`.

### 2.5 `.lead` / `.sub` / `.note` collisions — the risk is not where the spec says

**Production never defines bare `.lead`, `.sub`, `.note`, or `.eyebrow`.** Verified: zero definitions in `renderer.js`. Existing code already prefixes everything — `cmp-lead`, `p8-sub-label`, `bc-conf-note`, `cw-note-label`, `p3-lead-side`. **So there is no collision between the v3 sheet and existing production CSS.**

Better still, **spec §3.4's two cited bugs are already fixed in the tracked mockup**: the files now use `hhd is-sub` and `krow is-lead`/`krow is-alt`. The `is-` convention is applied.

The residual risk is therefore *internal to v3 and forward-looking*: only two `is-` modifiers exist so far, and the 261 page-scoped selectors include the six genuine name collisions in §2.2. The namespacing discipline needs to be applied to those during consolidation.

---

## 3. The diagram variant — mechanism, geometry, and a bug in the reference

### 3.1 How the extension works without touching the coach

`buildEnneagramSVG({type, variant})` (`renderer.js:1066`) is an `if`-chain of early returns ending in a `throw`. All four existing variants are 500×500 **only because they share one string** at `:1067`; `viewBox="0 0 500 500"` appears exactly once in the codebase.

**Insert the new branch between `:1175` and the terminal `throw` at `:1177`.** Pure insertion — no existing line is edited, so the function's diff is add-only.

The safety rules, in priority order:

1. **🔴 Never add a key to `SVG_NODES`.** Every 500×500 branch iterates `Object.keys(SVG_NODES)` (`:1076, :1104, :1142, :1165`). An added key silently adds a node to the **coach wheel**. This is the single highest-probability failure mode in PR 1. New geometry goes in a **new sibling constant** (`SVG_NODES_CLIENT`).
2. **Do not reuse `_svgNode` / `_svgLabel`** (`:1056`, `:1058`) — they dereference `SVG_NODES[i]` internally and are hard-bound to the 500×500 table. Write new helpers taking explicit coordinates.
3. **Treat the `'type'` branch (`:1085–1116`) as frozen** — it is the only variant shared by the coach PDF (`_coachPage1`, `:1328`) and client P3 (`:1824`).
4. **Safe to reuse read-only:** `_trim` (:1048), `_svgLine` (:1053), `_arrowMarker` (:1061) — all geometry-agnostic — and `SVG_TYPE_META` (:1020), which is shared but only read.
5. **Use a new variant name** (e.g. `'client-wings'`). `'wings-lines'` is *not* used by the coach, but reusing it would silently repoint client P5 (`:1943`) and the dev gallery.
6. **New container class.** Every existing SVG container is square (coach `.bc-svg` is 232×232). At 430×252 (~1.71:1) the new diagram must not reuse `.p5-symbol` (230×230) or it will letterbox with ~100px of dead vertical space.

`PALETTE` and `CENTER_COLORS` are **not** read by `buildEnneagramSVG` — the audit brief's premise there was incorrect. A6 SVG colours are deliberately self-contained.

### 3.2 Geometry, extracted verbatim from the tracked Wings mockup

Confirmed against spec §3.5 — every value matches:

```
viewBox      0 0 430 252
centre       cx 215.0   cy 135.0        (= VW/2, = R + 40)
radius R     95
node radii   home 15 · wing/resource 13 · inactive 11
label DX     22 from node centre (anchor=end left of centre, start right)
home label   ABOVE the node when at top: x=215, y=13 (node cy=40, r=15)
```

| Type | cx | cy | angle |
|---|---|---|---|
| 9 | 215.0 | 40.0 | −90° |
| 1 | 276.1 | 62.2 | −50° |
| 2 | 308.6 | 118.5 | −10° |
| 3 | 297.3 | 182.5 | 30° |
| 4 | 247.5 | 224.3 | 70° |
| 5 | 182.5 | 224.3 | 110° |
| 6 | 132.7 | 182.5 | 150° |
| 7 | 121.4 | 118.5 | 190° |
| 8 | 153.9 | 62.2 | 230° |

All nine sit exactly 95.0 from centre. The angle set matches §3.6 exactly. **This is portable verbatim — no formula derivation**, per §3.5's explicit warning.

### 3.3 ✅ Verification against the contact sheet is possible — and it found a bug

`docs/insightout_all18_diagrams_check.png` is tracked (PR 0) and legible at 1320×1560; all 18 tiles are inspectable, and I verified individual tiles by cropping.

**🔴 WINGS · TYPE 1 is broken.** The `9 WING / The Peacemaker` label is placed to the **right** of node 9 and runs **directly into and behind the home node**, colliding with the `YOUR HOME BASE` label.

**Mechanism:** node 9 sits at top with `dx = 0` from centre, so the horizontal placement rule has no side to prefer and defaults right (+22). For Type 1 — and only Type 1 — the home node sits immediately clockwise at (276.1, 62.2), exactly where that label extends. I checked the mirror cases: **Type 8 is clean** (home is to the *left* of the top node) and **Type 5 is clean** (home at bottom, labels flank).

**This contradicts spec §3.5's "Verified across all 9 types on both page types — 54 labels, zero clipped, minimum label-to-label gap 27.7px."** That verification did not catch this.

**Impact on PR 1: none for Type 9** — it renders cleanly (home at top, wings 8 and 1 flanking left and right).

> **⚠️ Placement updated — see §7.3.** I originally recommended deferring the fix to PR 3. That was wrong for two reasons: PR 3 may not render Wings at all (§7.2), and diagram rendering needs **no authored content**, so all nine Wings diagrams can be generated and verified in PR 1 the moment the variant exists. **The fix and the 9-type verification both move into PR 1.**

---

## 4. Wings content — the path in, and a landmine

### 4.1 What exists vs. what the page needs

The current schema is two fields per wing (`build_content_library.js:123-130`):

```js
t.wings[slot] = { target_type: <int>, body: <string> };
```

`type_9.wings.wing_a` is a single narrative ending in an `"At their best: …"` marker, which `report_prep.js:32` (`splitWingBest`) splits into `{body, best}`.

The v3 page needs, **per wing**: an overview paragraph, **exactly 5 bullets**, and an "As a Resource" paragraph — plus a new page-level intro that does *not* match the existing `static.wings_primer`. **None of these fields exist**, and none of the corresponding labels (`WING OVERVIEW`, `WING BULLETS`, `AS A RESOURCE`) exist in the Word source.

### 4.2 The three paths, assessed

| Path | Verdict |
|---|---|
| **Word round-trip** (author in docx → re-run `build_content_library.js`) | The docx **does exist** and is tracked (`docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx`), and the script runs green today. But it requires design to author new labelled sections **and** the parser to learn them. **Correct long-term; too slow to gate PR 1.** |
| **DB override** (`content_overrides.js`) | ❌ **Ruled out.** `resolveLibObject` (:85-98) iterates `Object.keys(baseObj)` — it can only override fields that already exist, so new sibling fields are silently ignored. You *could* replace the whole `type_9.wings` object, but the mechanism is **DB-only**, and PR 1's acceptance gate is `node scripts/render_client.js`, which runs offline with no `DATABASE_URL`. **It cannot satisfy PR 1's own pass criterion.** |
| **Additive hand-edit of `content_library.json`** | ❌ **WITHDRAWN — see §7.1.** This was my original recommendation and it was wrong: it contradicts §4.3. Any later PR that compiles the library would wipe it, on a predictable schedule. |

> **⚠️ Superseded.** The hand-edit recommendation above was self-contradictory — it proposed adding hand-maintained keys to a file whose regeneration path destroys hand-maintained keys. **§7.1 replaces it** with the script-constant path, which makes the build script non-destructive instead of documenting that it isn't.

### 4.3 🔴 The landmine — defuse it in PR 1

**`static.wings_using` exists in the committed JSON, is read by `report_prep.js:261` and rendered at `renderer.js:1961`, but is NOT produced by `build_content_library.js`.** I verified all three independently.

**Anyone who runs `node scripts/build_content_library.js` today silently drops it** and regresses the live Wings & Lines page to an empty list (`renderer.js:1961` guards with `|| ''`, so it fails silently rather than crashing). The script is stale relative to the committed artifact.

This matters for PR 1 specifically because PR 1 is the first PR to touch Wings content, and the obvious instinct — "regenerate the content library" — is currently destructive.

**Recommended in PR 1:**
1. Extend `validateType` to require the new v3 wing fields (the plan already calls for this), so missing content fails loudly.
2. Fix the `wings_using` drift — either teach `parseStatics()` to read it, or move it to the script's own documented `INTERIM_*` constant pattern for content not yet in the docx.

Without step 2 we are adding more hand-maintained keys to a file whose regeneration path already destroys hand-maintained keys.

---

## 5. The Type-9 fixture

### 5.1 Strictly required: three fields

Empirically minimized by running `buildClientModel` for Type 9 / SX:

```json
{ "hypothesis": { "confirmed_type": 9, "alternate_candidate": 1, "dominant_instinct_hypothesis": "SX" } }
```

Removing any of the three fails — and notably **not** via `validateModel` but via `lib()` (`report_prep.js:41`) doing library lookups for `type_${altN}` and `subtype_${instinct}${heroN}`. Removing `call1_ranking`, `instinct_score_profile`, `client_facing`, `client_words`, `coach_report`, or even `client.first_name` **all still pass**.

### 5.2 🟢 No fabricated report content is required

This is the key result, and it matters given the standing rule against authoring content. **Every AI-authored zone the client model can consume is optional** — `client_facing.secondary_type_narrative`, `client_facing.instinct_evidence`, `client_words.leading_quotes`, `coach_report.section6.pushes_back.key_distinction`. None appears in `CLIENT_SPEC.required` or `nonEmptyArrays`; each falls through to `?? null` / `|| []` / `|| ''`. They feed P3 and P6 — pages PR 1 is not building.

**The Wings page is 100% library-driven.** The fixture contains only numbers and type/instinct identifiers.

### 5.3 Recommended fixture

Prior art exists: `cmsPreviewApiResult(N, instinct)` at `app/server.js:13906` is already a "minimal valid Call #2 result" built for exactly this purpose. Mirror its shape:

```json
{
  "hypothesis": {
    "confirmed_type": 9,
    "alternate_candidate": 1,
    "dominant_instinct_hypothesis": "SX",
    "confidence_level": "HIGH",
    "call1_ranking": [ … 9 × {type, score} … ],
    "instinct_score_profile": { "SP": 66, "SO": 64, "SX": 84 }
  },
  "coach_report": {}, "client_facing": {}, "client_words": {}
}
```

`call1_ranking` and `instinct_score_profile` are not needed for Wings but cost nothing and are required by PR 5 — include them now. The instinct values match the coach report's SX9 numbers per §4.3's verify-against-the-coach-report guardrail. Set `client.first_name = "Anders"` in the harness entry so the masthead matches the mockup.

**`buildClientModel` never reads the `coach` parameter at all** — `coach: {}` suffices.

---

## 6. Where the plan is wrong

Six corrections. None changes PR 1's goal; three change its content.

1. **"Pin the font and Chromium" understates the work.** There is no container config to edit — PR 1 must create it (§1.1). And the pin's real value is *eliminating* the dev/prod split (147 vs 151), not just freezing a version. **Plan §PR1 should say "introduce build config + unify the render engine," not "pin."**

2. **CSS consolidation is smaller and riskier than described.** Not 478 rules into a shared sheet — 24 cross-page selectors, of which 15 need reconciling, over 261 page-scoped rules that stay put (§2.1). The risk isn't volume, it's that the drifted spacing is *load-bearing for single-sheet fit* (§2.2). The plan's framing invites exactly the wrong move (hoist the common value and move on).

3. **The plan's coach-safety story is right but for a different reason than stated.** It warns that the diagram variant might perturb the coach wheel. The real mechanism is narrower and sharper: `Object.keys(SVG_NODES)` iteration (§3.1, rule 1). Everything else in the diagram block is private. Worth naming precisely, because "be careful with shared primitives" doesn't tell you what to actually avoid.

4. **The plan assumes Wings content is a prerequisite that design must land first.** In practice the *fields do not exist in the schema at all*, and the Word round-trip cannot realistically gate PR 1 (§4.2). The additive-hand-edit path should be stated explicitly in the plan, together with the `wings_using` defusal — otherwise PR 1 stalls on a content dependency that has no fast path.

5. **The plan does not mention that the content build script is currently destructive** (§4.3). This is a pre-existing defect, unrelated to the redesign, that PR 1 will walk straight into.

6. **Spec §3.5's "verified, zero clipped" claim is false** (§3.3), and the plan inherits it as an assumption. The Type 1 Wings collision needs a decision before PR 3, and the "generate all 18 and inspect them" instruction in §3.5 should be treated as a *step to redo*, not a box already ticked.

### Scope adjustments I recommend for PR 1

**Add:** the `wings_using` defusal (small, and PR 1 is the right moment). **Add:** a font-resolution assertion, so a fallback fails loudly rather than silently.

**Do not add:** the Type 1 label fix. It is a real bug but it belongs with PR 3, where all nine types render and it can be verified across the set. Logging it here is enough.

**One open question for you:** pinning will change which engine renders the coach report locally (§1.3). I recommend capturing the coach baseline *before* the pin, and treating any resulting diff as newly-revealed information rather than a regression to revert. Confirm you want it sequenced that way, because it is the one place in PR 1 where "coach byte-identical" may legitimately not hold.

---

## 7. Round 2 — answers to the four open items

Added 11 Aug 2026 after audit review. §7.1 and §7.3 supersede recommendations in §4.2 and §3.3.

### 7.0 Coach baseline sequencing — confirmed, with one correction

The HTML/PDF distinction is right and I'm adopting it: **Chromium never touches HTML generation** (`renderer.js` produces the string; Chromium only rasterizes it). So the coach **HTML** gate stays byte-identical, no exception, unaffected by the pin. Baseline for the coach **PDF** comes from the **production** engine (bundled, 147), never local 151. Local converging on the 147 baseline is the success condition; a diff against old-local-151 is expected and is the point.

**Pin target confirmed:** `app/package-lock.json` resolves `puppeteer@24.42.0`, which pins Chromium **147.0.7727.57** via `PUPPETEER_REVISIONS`. That is production's current engine. Pinning to it means **production rendering does not move** — the change is entirely on the local/CI side. No upgrade.

**What has to change so both paths use the same bundled Chromium.** Today the split is:

| Path | Package | Binary |
|---|---|---|
| Production (`NODE_ENV=production`) | `puppeteer` | bundled 147 ✅ |
| Local dev / `scripts/` | `puppeteer-core` + hard-coded `executablePath` | system Chrome 151 ❌ |

`puppeteer-core` deliberately ships **no** browser and **no** download step — that is the entire difference between the two packages. Both are already dependencies at the same version. The change is therefore small and mechanical:

1. In `launchBrowser` (`app/server.js:5044`), drop the `executablePath` branch and launch via `require('puppeteer')` on **both** paths, so the bundled binary is used everywhere. Keep an **opt-in** escape hatch (`PUPPETEER_EXECUTABLE_PATH`) for anyone who genuinely needs a system browser — env-gated, never the default.
2. Same in `scripts/render_client.js:59` and `scripts/render_coach.js`, which mirror the hard-coded path.
3. Ensure the bundled browser is actually installed: `npm ci` runs Puppeteer's postinstall download. Already present locally at `~/.cache/puppeteer/chrome/mac_arm-147.0.7727.57`. In CI, cache that directory (see §7.4).
4. `app/package.json`: `"puppeteer": "^24.42.0"` → `"24.42.0"` exact, and use `npm ci` so the lockfile is authoritative.

**🔴 One correction that changes the gate's design.** A real Puppeteer-generated coach PDF in this repo carries:

```
/Producer (Skia/PDF m148)
/CreationDate (D:20260606141647+00'00')
/ModDate     (D:20260606141647+00'00')
```

Chromium stamps wall-clock `CreationDate`/`ModDate` into every PDF. **Two renders of byte-identical HTML, seconds apart, produce different PDF bytes.** So "coach PDF byte-identical" is not implementable as written anywhere in the build plan. The workable gate is:

- **Coach HTML — byte-identical. Hard fail.** (Deterministic, text, reviewable in a diff.)
- **Coach PDF — page count + per-page measured heights.** `scripts/render_coach.js` already computes these. Hard fail on either changing.
- *(Optional)* byte-compare after stripping `/CreationDate` and `/ModDate` if we ever want content-level byte confidence.

Incidentally that PDF was produced by **Skia/PDF m148** — a third Chromium version, from June. Production's engine has moved before, unpinned. That is the argument for the pin in one line.

### 7.1 Item 1 — the contradiction, and the path that actually defuses it

You're right, and the criticism lands: I identified the script as destructive and then recommended feeding it more of exactly what it destroys. PR 3 compiles the library, so PR 1's wing content would be wiped on a predictable schedule. Withdrawn (§4.2 marked superseded).

**Neither (a) nor (b) as posed. The repo already has a third pattern, and it is the right one: a versioned constant inside the build script.**

`scripts/build_content_library.js:33-43` defines `INTERIM_WELCOME`, with this comment:

> *INTERIM SOURCE — provisional welcome content pending canonical binary-docx reconciliation… Do not treat as permanent source of truth. When the canonical step7-incoming docx gains a Word-styled WELCOME PAGE section, replace this with a parseStatics() read and confirm regenerated output is identical.*

That is precisely our situation, with a documented exit path already written down.

**Why this beats both posed options:**

| | Verdict |
|---|---|
| **(a) Extend the parser to read new Word labels** | The correct **destination**, but it cannot gate PR 1 — the docx has no `WING OVERVIEW` / `WING BULLETS` / `AS A RESOURCE` sections, so it needs a design authoring round-trip first. The *parser* is not the blocker (see below); the *document* is. |
| **(b) Preserve/merge hand-added keys** | **Rejected.** It would bless two sources of truth permanently and make silent divergence a supported feature. The whole point of the Word pipeline is one editing surface. |
| **(c) Script constant** ✅ | The script becomes **the sole producer of the JSON again**, so re-running it is idempotent and non-destructive *by construction* — which is what "defuse" has to mean. Content is version-controlled and shows up in PR diffs. Exit path to (a) is already prescribed. |

**What PR 1 does:**
1. Move the Type-9 v3 wing content into an `INTERIM_WINGS_V3` constant (transcription of already-approved Hive-authored copy from the tracked mockup — spec §7.1 lists wings narratives and resource bands as authored; **no new content is written**).
2. Move `static.wings_using` into the same pattern, so the pre-existing landmine is defused rather than documented.
3. Extend `validateType` to require the new wing fields.
4. **Acceptance test for the defusal: run the build script twice and assert `content_library.json` is unchanged the second time, and that no currently-rendered key disappears.** That is the check that proves the gun is unloaded. It belongs in CI.

**What the Word round-trip needs, for when we do (a).** Good news — the parser is already general. `tokenize()` (`:64`) tags any `ListParagraph` paragraph as a bullet, and `isLabel()` (`:77`) treats any ALL-CAPS line under 60 chars as a section label; `toBlocks()` (`:86`) then groups label + paragraphs + bullets automatically. So per type, design adds three Word sections per wing using existing styles:

```
TYPE 9 WING 8 OVERVIEW      → paragraph
TYPE 9 WING 8 BULLETS       → 5 ListParagraph bullets
TYPE 9 WING 8 AS A RESOURCE → paragraph
```

The parser change is then ~10 lines extending the existing `findByRe(blocks, /^TYPE \d WING/)` handler at `:123-130` to read the new blocks. **No new parsing machinery.** This does not need to happen in PR 1, and it does not change PR 1's content prerequisite — but it means (a) is cheap whenever design is ready.

### 7.2 Item 2 — Wings for types 1–8: fold into PR 3

Correct catch: p8 is in no PR's scope after PR 1, and would first surface at PR 7's full matrix.

**Recommendation: fold p8 into PR 3**, which becomes *"per-type static pages: p6, p7, p8, p9"* — 4 pages × 9 types.

**Why fold rather than a separate PR:**
- **The content-authoring unit is a type, not a page.** Design will author "everything for Type 4" in one pass. Splitting p8 out forces a second context-switch back through all eight types.
- **After PR 1 there is no new p8 code.** The page renderer, the 430×252 variant, and the fitting constraints all exist and are validated. Types 1–8 are content plus validation only.
- **Wings will be the best-understood page in the report** — built first, fully verified, all nine diagrams already checked in PR 1 (§7.3). Adding the lowest-risk page to PR 3 does not add proportional risk.
- A separate PR for "add content to a page that already works" is process overhead that isolates no meaningful technical risk.

**What it costs — stated honestly:**

| PR 3 | Before | After folding p8 |
|---|---|---|
| Pages × types | 3 × 9 = **27 renders** | 4 × 9 = **36 renders** |
| Content prerequisite | ~200 units | **~296 units** |
| Paired-column checks | best/edge, 2 line points | + 2 wing columns per type |

PR 3 becomes decisively the largest content gate in the build. That is a scheduling fact, not a technical risk — the fitting gate is per-page and fails per-page, so a 4th page lengthens the iteration loop without deepening it.

**Explicit fallback trigger:** if wing content for types 1–8 (~96 units) lands materially earlier than the p6/p7/p9 content (~200 units), split it into its own PR between 3 and 4 rather than letting finished content wait. The decision is reversible right up until PR 3 opens.

### 7.3 Item 3 — fix the label rule in PR 1, and it provably cannot touch the coach

Agreed on all three points, and your reasoning is stronger than mine: diagram rendering needs no authored content, so PR 1 can verify all nine Wings diagrams immediately.

**✅ Confirmed: the rule change cannot perturb the coach 500×500 output — because no label-placement logic exists on that path at all.**

The only label emitter in the existing SVG block is `_svgLabel` (`renderer.js:1057`):

```js
return `<text x="${x}" y="${y}" … fill="white" text-anchor="middle" dominant-baseline="central">${i}</text>`;
```

It renders **only the type number, centered inside the node**. No 500×500 variant emits any outside or archetype label — there is no DX offset, no side selection, and no home-above rule anywhere in the shared code. **Every bit of label-placement logic is new code belonging exclusively to the 430×252 variant.** The coach cannot regress from a change to a rule it does not have, and the coach HTML byte-diff proves it empirically regardless.

**The general rule** (not a Type-1 special case). Today's implied behaviour is "home label above when at top; horizontal at DX=22 otherwise," which leaves the horizontal side undefined when `dx ≈ 0`. Generalize the existing exception from the home node to **any** labelled node:

```
if |dx| < ε   → place the label ABOVE the node, centered      (top-of-circle case)
else          → place horizontally at DX = 22, on side sign(dx)
```

Geometry-derived, deterministic, no per-type branching. Only node 9 sits at `dx = 0` in this layout, so exactly one node per diagram can trigger it.

Effects across the set:
- **Type 1 — fixed.** The 9-wing label moves above instead of running right into the home node.
- **Type 9 — unchanged.** Home at top already places above; verified against the mockup (`x=215, y=13`).
- **Type 8 — changes, harmlessly.** Its 9-wing label moves from right-placement to above; home 8's label is anchored left at `x=131.9`, so no collision. Currently clean, still clean.

**Consequence to plan for:** the tracked contact sheet no longer matches for the types whose placement changes, so **PR 1 must regenerate all 18 diagrams and re-verify**, replacing `docs/insightout_all18_diagrams_check.png`. That is the §3.5 instruction *"Generate all 18 diagrams and inspect them"* being executed properly rather than assumed.

**Noted for a later PR, not this one:** spec §3.5's claim — *"Verified across all 9 types on both page types — 54 labels, zero clipped, minimum edge clearance 5px, minimum label-to-label gap 27.7px"* — is **falsified** by the Type 1 Wings collision. It needs the same dated post-lock correction treatment PR 0 applied to §4.1 and the appendix. I will carry it in the PR 1 build report so it is not lost.

### 7.4 Item 4 — CI workflow scope

`.github/workflows/report-verify.yml`, created in PR 1.

**Triggers:** `pull_request` (any branch), plus `push` to `main`.
**Runner:** `ubuntu-latest` — deliberately Linux, so CI exercises the *font-fallback* condition that macOS masks. Node pinned explicitly (no `engines` field exists today; pin to the current LTS and declare it).

**Steps:**
1. `actions/checkout`
2. `actions/setup-node` with the pinned version
3. **`sudo apt-get install -y fonts-liberation`** — mirrors the `nixpacks.toml` font install so CI and production resolve the same metrics
4. Cache `~/.cache/puppeteer`, then **`npm ci`** in `app/` (lockfile authoritative → Chromium 147; postinstall fetches the bundled binary)
5. **Font-resolution assertion** — fail if the rendered document resolves to anything other than Arial/Liberation Sans
6. `node scripts/render_client.js` — single-sheet + page-count gate
7. `node scripts/render_coach.js` — regenerate coach artifacts
8. **Coach HTML diff** vs stored baseline
9. **Coach PDF structural diff** — page count + per-page heights (not bytes; see §7.0)
10. `npm test` (includes `report_pages_test.js`)
11. **Content-library idempotence check** — run `build_content_library.js` twice, assert no diff and no key loss (§7.1)

**Fail vs. warn:**

| Hard fail (blocks merge) | Warn only |
|---|---|
| Client page spills past one sheet | Coach page spill (flow-allowed by design) |
| Client/coach logical page count wrong | Cosmetic-only CSS diffs flagged for review |
| **Coach HTML not byte-identical** | |
| Coach PDF page count or page heights changed | |
| Font resolves to a fallback | |
| `npm test` failure | |
| Content library not idempotent, or a key disappears | |

**How the coach baseline is stored.** Commit the rendered coach **HTML** for both fixtures as text baselines — e.g. `tests/baselines/coach_sp4.html`, `coach_sx7.html` — and diff against them in CI.

Rationale: HTML is deterministic and diffable, so a reviewer sees exactly what changed in the PR itself; and updating a baseline becomes an **explicit, visible act** in the diff rather than something that silently drifts. PDFs are not viable as stored baselines (§7.0 — embedded timestamps), which is why the PDF gate is structural. Baselines are generated from the **production** engine per §7.0 and refreshed only in a PR that intends to change coach output, with the diff reviewed.

**Note:** step 11 will fail on day one against today's `main`, because the library is not currently idempotent (§4.3). That is the point — it is the regression test for the defusal, and it should go green within PR 1.

---

## Appendix — key references

- Render pipeline: `app/server.js:5044` (`launchBrowser`), `:5065` (`generatePDF`), `:5313` (`generateReportPDFs`); `app/render_report.js:18`.
- Styles: `renderer.js:1212` (`partAStyles`, shared), `:1428` (coach), `:2161` (client), `:1002` (`PALETTE`).
- Diagram: `renderer.js:1066` (`buildEnneagramSVG`), `:1020` (`SVG_TYPE_META`), `:1033` (`SVG_NODES`), `:1041` (correct triangle), `:1175–1177` (insertion point).
- Content: `app/content/content_library.json`; `scripts/build_content_library.js:26` (docx path), `:123-130` (wing schema), `:253-255` (wing gate); `app/content_overrides.js:85-98`.
- Model: `app/report_prep.js:199-277` (`buildClientModel`), `:285-304` (`validateModel`), `:324-346` (`CLIENT_SPEC`).
- Harness: `scripts/render_client.js` (`PAGE_PX`, `enforceSheet`, `expected`), `scripts/render_coach.js`.
- Reference: `docs/mockup/claude_The_Peacemaker_Page_Wings_v1.html`, `docs/insightout_all18_diagrams_check.png`.
