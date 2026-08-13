# Audit — PR 3, p8 "Your Wings" for Types 1–8

**Date:** 13 August 2026
**Branch:** `pr-3-per-type-pages`
**Scope:** read-only investigation plus a measurement spike. No content applied, no renderer
or stylesheet change, no gate weakened.
**Card:** "PR 3 — Per-type pages", Client Report Redesign — Build Board.

---

## 1. Branch state

| | |
|---|---|
| HEAD | `4f0ed466badb99c8e92332762af1554a15fcd4c4` |
| vs `main` (`475942f`) | **11 ahead, 0 behind** |
| vs `origin/pr-3-per-type-pages` | 0 ahead, 0 behind — in sync, tracking set, `git pull` reports up to date |
| Working tree | **not clean** — see below |

Working tree at audit start: `.claude/launch.json` modified; untracked `.override_snapshots/`
and ten untracked `docs/*` files (design specs, architecture docs, `.docx` drafts). None of
them is on the Wings path. This audit adds `docs/audit_pr3_wings.md` and two scratch scripts
under `scripts/spike/`.

The eleven commits are `f3ec754` (the unconditional Wings gate), two audit-doc commits, one
headroom-measurement commit, and seven p9 Stress & Security spike rounds. **No commit on this
branch authors Wings content.** The branch is named for Wings and has so far done p9.

> **Correction to the brief.** The working copy is `/Users/caidelumpa/Developer/hive-typing-engine`.
> A second clone exists at `/Users/caidelumpa/Documents/GitHub/hive-typing-engine`; it is a
> single-commit stub from 25 April 2026 with no `app/` directory. It is not "the project copy"
> referenced in D4 and holds no `type_library.json` at all.

---

## 2. Findings

### A. Ingestion path

#### A1 — The Type 9 path, end to end

The path is already built and already carries content. Types 1–8 need data, not plumbing.

| Step | Location | What happens |
|---|---|---|
| 1. Storage | `scripts/build_content_library.js:145–178` | `INTERIM_WINGS_V3`, a plain JS object literal keyed by type number. Only key `9` is populated. Inner wings are keyed by **target type number** (`8`, `1` for Type 9), not by slot. |
| 2. Emit | `scripts/build_content_library.js:238` `assembleType()`, wings block `:258–271` | `:261–269` walks `wing_a`/`wing_b`; `:267` looks up `INTERIM_WINGS_V3[n].wings[target_type]`; `:268` `Object.assign`s `overview`, `bullets`, `resource` onto the docx-parsed `{target_type, body}`. `:270` sets `t.wings.intro_v3`. Purely additive — the v2 `body` field is untouched. |
| 3. Gate | `scripts/build_content_library.js:414` `validateType()`, v3 block `:443–450` | Seven assertions per type. Unconditional. |
| 4. Write | `scripts/build_content_library.js:586` | `writeFileSync` to `app/content/content_library.json`. **Never reached when the gate fails** — verified: exit 1, `git status` clean. |
| 5. Keys | `app/content/content_library.json` | `type_N.wings.intro_v3`; `type_N.wings.wing_{a,b}.{overview, bullets[0..4], resource}` |
| 6. Model | `app/report_prep.js:305–327` | `v3_wings` IIFE. `mk(slot)` at `:322–325` emits `{number, name, overview, bullets, resource}`; `:326` returns `{intro, wing_a, wing_b}`. Every field defaults `\|\| ''` / `\|\| []` — **this is why unauthored types render silently.** Column order follows library `wing_a`/`wing_b`, deliberately (see the comment at `:306–321`). |
| 7. Render | `app/renderer.js:3239` `_clv3Wings(m)` | intro `:3265`, overview `:3249`, five bullets `:3250`, resource band `:3254`. Called unconditionally from `buildClientReportHTML_v3` at `:3350`. |
| 8. Page identity | `app/renderer.js:2943` (`V3_PAGE_ORDER`) | key `wings` → **sheet 8, footer 6**. |

All v3 prose passes through `_v3t` (`app/renderer.js:3044`) = `_v3NoBreak(esc(_v3Straighten(s)))`.
See D2.

#### A2 — Landing place, and what to hand over

**`INTERIM_WINGS_V3` is not a proposal; it is the existing mechanism.** It already sits
alongside `INTERIM_WELCOME`, `INTERIM_CONTENTS`, `INTERIM_THOUGHTS` and `INTERIM_WINGS_USING`
in the same file, it already produces the live Type 9 page, and `verify_content_library.js`
already declares it at `:53–55`. Adding keys `1`–`8` to that literal is the whole change.

Cost of that choice, stated plainly:

- 120 more leaves that Word is not canonical for (A5).
- The `SCRIPT_SOURCED` accounting entry must be widened or the printed Word-canonical figure
  becomes wrong in the flattering direction (A5, and it is a real finding).
- `intro_v3` is required **per type** (`:270` reads `INTERIM_WINGS_V3[n].intro`) even though
  the text is identical for all nine. Either repeat the same 365-character string nine times,
  or hoist it to a module-level constant and reference it from each entry. **Recommend
  hoisting** — nine copies of one paragraph is nine chances for them to drift, and the gate
  cannot see divergence, only emptiness.

No better home exists today. A docx section would be better in principle and is what the
comment at `:141–144` anticipates, but the docx has no schema for overview / five bullets /
resource band, and inventing one is a larger change than this PR.

**What to hand me, and in what format.** One committed file:

```
docs/wings_content_r2.md
```

Markdown, one section per type, in this exact shape — machine-parseable in one pass, and
editable in a text editor without escaping anything:

```markdown
## Type 1

### Wing 9
OVERVIEW: <two sentences on one line>
BULLET1: <text>
BULLET2: <text>
BULLET3: <text>
BULLET4: <text>
BULLET5: <text>
RESOURCE: <two sentences on one line>

### Wing 2
OVERVIEW: ...
```

Rules that make this parse without a follow-up question:

- Type headings `## Type N` for N = 1..8. **Type 9 is not included** — it is live and unchanged.
- Wing headings `### Wing T` where T is the **target type number**. Two per type, in the order
  they appear in the r2 doc; I map them to `wing_a`/`wing_b` by target type, not by position.
- One label per line, `LABEL: text`, text on the **same line**, no wrapping. Labels exactly as
  above, uppercase.
- **Strip the grey italic annotation lines** (character count · line count · provenance tag)
  when you paste. If any survive they will land in the content — the parser cannot tell an
  annotation from a sentence.
- Paste the text as-is otherwise. Do not straighten quotes or convert dashes; that is handled
  at render time (D2) and I want to see what the doc actually says.
- Put the r2 doc id and the date you copied it in a comment line at the top.

I will parse that file into the constant. It stays committed as provenance for where the
strings came from, which is the thing a JS literal cannot record on its own.

#### A3 — What the branch already carries

**No r2 Wings content exists anywhere in the repo.** Checked, not assumed:

- `app/content/content_library.json` — Type 9 populated (`intro_v3`, both wings with overview,
  5 bullets, resource). Types 1–8 carry **only** `{target_type, body}`; the v3 keys are absent
  entirely, not empty.
- `scripts/spike/p9_lines_content.js` (16.6 KB, `4f0ed46`) — this is **p9 Stress & Security**
  content for all nine types, not Wings. Its header says so explicitly.
- Type 9's Wings text predates the r1/r2 numbering. Per the comment at
  `build_content_library.js:130–134` it was transcribed from
  `docs/mockup/claude_The_Peacemaker_Page_Wings_v1.html`. It is neither r1 nor r2.

There is no leftover fit script from the 12 Aug spike. The two scripts under `scripts/spike/`
whose names begin `wings_` are the ones this audit wrote (section C).

#### A4 — `static.wings_using` on p8

**No.** `static.wings_using` appears only in the **legacy v2** P5 "Wings & Lines" page
(`app/renderer.js:2185`). The v3 p8 page (`_clv3Wings`, `:3239–3274`) never references it.
Its INTERIM status blocks nothing here.

#### A5 — The Word-canonical check

> **Two premises in the brief are wrong and the correction matters.**
>
> 1. **Nothing asserts `_meta.source_sha256` against the docx.** The hash is *written* by
>    `build_content_library.js:486` and read by nothing.
>    `verify_content_library.js:126` explicitly skips every `_meta` key. There is no hash
>    comparison anywhere in the repo (`grep -rn source_sha256` → one write, two doc mentions).
> 2. **The real check is stronger for content and weaker for the file.** It rebuilds from the
>    docx on disk into a temp file and compares all non-`_meta` leaves against the committed
>    JSON (`:122–148`). That subsumes a hash check for anything that reaches a leaf — but a
>    docx edit that changes no parsed leaf passes unnoticed, and the recorded hash never
>    stops it.

**(i) What the two checks assert, and whether they fail or warn.**

| Check | Location | Asserts | On non-Word content |
|---|---|---|---|
| Reproducibility | `:113–120` | Two consecutive builds are byte-identical | Unaffected |
| **The invariant** | `:122–148` | committed JSON == build(docx + `INTERIM_*` constants), all non-`_meta` leaves | **Passes**, provided the library is rebuilt and committed in the same PR. `INTERIM_*` output is on *both* sides of the comparison. |
| Word-canonical ratio | `:150–173` | *nothing* | **Prints only.** `scripted` never sets `failed`. |

Adding non-Word content is **not** a failure in either check.

**(ii) What the count becomes.** Measured on the committed library today:

```
   8  static.welcome
   1  static.wings_using
  15  type_9 v3 wing fields
  18  static.contents
   6  static.thoughts
  48  scripted   ·   1400 total   →   Word-canonical: 1352/1400
```

> The brief's "1351 of 1374" is stale. Current is **1352/1400**.

Fifteen leaves per type (`intro_v3` + 2 × (overview + 5 bullets + resource)) × 8 types = **+120**.

- Total: 1400 → **1520**
- If `SCRIPT_SOURCED` is widened to cover all nine types: scripted 48 → 168, printing
  **1352/1520**. Honest.
- If it is left as-is: the entry is hardcoded to path `type_9.wings`
  (`verify_content_library.js:53`), so scripted stays 48 and it prints **1472/1520** — a
  number that has gone *up* while 120 non-Word leaves were added.

**This is a finding for the build prompt.** Widening that entry is a one-line change from a
fixed path to a walk over `type_1..type_9`. I have not made it — `verify_content_library.js`
is out of scope for this audit — but landing Wings without it silently overstates canonicity
by 120 leaves, which is precisely the misreading the file's own header comment at `:22–28`
exists to prevent.

**(iii) Does CI treat the ratio as a failure?** **No.** `.github/workflows/report-verify.yml`
runs `node scripts/verify_content_library.js`, which exits non-zero only on non-reproducibility
or invariant mismatch. The ratio is a printed line. **Not a blocker.**

#### A6 — The `cms-override-cleanup` docx collision

**Confirmed: the Wings path does not touch the docx.** Stated explicitly so it can stop being
carried as a risk:

- Wings content lands in `scripts/build_content_library.js` (a JS constant) and
  `app/content/content_library.json` (a regenerable build artifact).
- `cms-override-cleanup` does **not** modify `scripts/build_content_library.js` at all
  (`git diff --stat main..origin/cms-override-cleanup -- scripts/build_content_library.js` → empty).
- The docx edit is real (87432 → 87435 bytes; `_meta.source_sha256`
  `a28e8d0f…` on main vs `3fb8e971…` on the cms branch) but **the two branches never both write
  that file.** No three-way merge of a `.docx` is required.

Two genuine overlaps, both minor:

- `app/content/content_library.json` — both branches regenerate it. Conflict resolution is
  "rebuild after merge", not a textual merge.
- `scripts/render_client.js` — cms adds **one** line at the top of the IIFE (the override
  banner); pr-3 changes 89 lines lower down. Low risk.

**The real sequencing hazard is not the docx — it is D3.** See below.

---

### B. Coverage

#### B1 — 56 reproduced, and the arithmetic reconciled

```bash
node scripts/build_content_library.js
```

Run locally on `4f0ed46`. Output: `*** COVERAGE FAILURES (56):`, exit **1**, and
`app/content/content_library.json` **unmodified** (the write at `:586` is never reached).

The seven distinct required key paths, per type N ∈ 1..8:

| # | Key path | Assertion |
|---|---|---|
| 1 | `type_N.wings.intro_v3` | non-empty |
| 2 | `type_N.wings.wing_a.overview` | non-empty |
| 3 | `type_N.wings.wing_a.bullets` | `Array`, `length === 5`, every element truthy |
| 4 | `type_N.wings.wing_a.resource` | non-empty |
| 5 | `type_N.wings.wing_b.overview` | non-empty |
| 6 | `type_N.wings.wing_b.bullets` | `Array`, `length === 5`, every element truthy |
| 7 | `type_N.wings.wing_b.resource` | non-empty |

7 × 8 = **56**. ✓

**Reconciling 7 assertions against 14 authored zones per type.** Both numbers are right; they
count different things.

```
14 authored zones/type   =  2 wings × (1 overview + 5 bullets + 1 resource)
−8                       =  bullets validate as ONE array, not 5 leaves (−4 per wing, ×2)
+1                       =  intro_v3, which is a gate but NOT an authored zone
= 7 assertions/type
```

**Yes — bullets validate as a single array** (`:447–448`), so "coverage failures" is a count of
*assertions*, not of authoring work. 112 authored zones remain the right unit for tracking
Mo's review. 56 is the right unit for tracking the build turning green.

The 15-leaf figure in A5(ii) is a third count again (leaves in the built JSON, where the five
bullets *are* five leaves). All three are consistent.

#### B2 — Key ↔ zone mapping

| Required key | Authored zone | Status |
|---|---|---|
| `wing_{a,b}.overview` | OVERVIEW (2 sentences, <205ch) | maps 1:1 |
| `wing_{a,b}.bullets[0..2]` | WING BULLETS 1–3, capacities | maps 1:1 |
| `wing_{a,b}.bullets[3]` | BULLET 4, perception frame | maps 1:1 |
| `wing_{a,b}.bullets[4]` | BULLET 5, shadow frame | maps 1:1 |
| `wing_{a,b}.resource` | AS A RESOURCE (2 sentences) | maps 1:1 |
| **`wings.intro_v3`** | — **no authored zone** | **finding, see below** |

**One key with no authored zone: `intro_v3`.** The brief says the page intro is "already
written, already in the build" — it is, *for Type 9 only*, at
`build_content_library.js:147`. The gate demands it for all eight remaining types. This is not
new authoring (the text is identical for all nine) but it **is** eight more entries someone has
to produce, and it is 8 of the 56 failures. Handle it by hoisting the constant (A2).

**No authored zone lacks a key.** All 14 zones per type land.

#### B3 — Page numbering, and the missing inventory

**The code says sheet 8, footer 6.** `V3_PAGE_ORDER` (`app/renderer.js:2943`):

```js
{ key: 'wings', sheet: 8, footer: 6, title: 'Your Wings', eyebrow: 'Navigating the Enneagram System' },
```

Calling it "p8" is correct and matches the code. Nothing in the codebase uses `p11.*` IDs.

> **`claude/content_zone_inventory_v1_080426.json` does not exist.** There is no `claude/`
> directory. The file is not in the working tree, not anywhere under `/Users/caidelumpa`, and
> has never been tracked in git history on any branch
> (`git log --all --diff-filter=A -- "*content_zone_inventory*"` → empty).
>
> I therefore cannot confirm or deny the `p11.*` numbering or the "At their best" discrepancy
> against any artifact. **Reporting the disagreement rather than reconciling it**, as instructed.

What I *can* say about the "At their best" line, because it exists in code: it is real in **v2**,
not a v3 zone. `splitWingBest()` (`app/report_prep.js:32`, used at `:224`) splits the docx wing
`body` on an `"At their best: …"` marker into `{body, best}`, and the legacy P5 page renders it.
The v3 p8 page never reads it. So an inventory listing a per-wing "At their best" line is
describing v2 behaviour. **If that inventory is being used to plan v3 zones, it is the wrong
document** — but I am inferring that from the v2 code, not from the file.

**Action:** locate the inventory and re-check B3 before the build prompt is written, or drop it
as a source.

---

### C. Fit — measured

Two scratch scripts, both **clearly marked scratch, both under `scripts/spike/`**, neither
imported by the renderer, the content library, or any gate:

- `scripts/spike/wings_fit_probe.js` — per-type headroom, column drift, per-zone line counts
- `scripts/spike/wings_band_calibration.js` — replaces the character-band proxy with measurement

Both use the real v3 renderer and the pinned bundled Chromium (`Chrome/147.0.7727.57`) via
`app/browser_launch.js`, with `assertReportFont` verifying Arial metrics before any number is
trusted — the same engine and the same guard `scripts/render_client.js` uses.

**No r2 content exists (A3), so nothing was substituted and no filler was invented.** What
follows is (a) everything measurable about the container, which does not need the content, and
(b) Type 9, the only authored type.

#### C1 — Per-type page headroom, 1056px container

Measured, all nine types, corroborated by two independent runs (the probe, and
`npm run verify:render` which reports the same figures).

| Type | Rendered | Natural stack | **Headroom** |
|---|---|---|---|
| 1–8 | 1056px | 640.00px | **416.00px** |
| 9 | 1056px | 1018.75px | **37.25px** |

Types 1–8 are identical to the pixel because their Wings content is uniformly absent. This
confirms the 416px / 976px figures asserted in the `validateType` comment at
`build_content_library.js:432–436`.

#### C2 — Column drift, flex stretch released

> **Premise correction, and it does not change the conclusion.** The brief names `.v3-pts`.
> That is the **p9 Lines** page. p8 Wings uses `.v3-wings` / `.v3-wing` / `.v3-wing-body`
> (`app/renderer.js:2868–2875`). The mechanism is identical — `display:flex`, `flex:1` on the
> column, `flex:1` on the body — so page height is set by the taller column alone and drift is
> invisible to headroom, exactly as described.

Measured with `align-items:flex-start` and `flex:none` on the bodies, then restored:

| Type | Column A | Column B | **Drift** |
|---|---|---|---|
| 1–8 | 184.00px | 184.00px | 0.00px |
| 9 | 562.75px | 544.00px | **18.75px** |

Type 9's 18.75px drift is exactly one bullet line. 184px is the empty column shell (head +
zero-height body + band label).

#### C3 — Per-zone line counts, Type 9

From `Range.getClientRects()`, merged by top edge so an inline `_v3NoBreak` span does not
count as an extra line. Fill is the last line's width over the available line width.

| Zone | Chars | Lines | Last-line fill |
|---|---|---|---|
| intro (static, all types) | 365 | 8 | 88.0% |
| `wing_a.overview` | 207 | 4 | 94.9% |
| `wing_a.bullet1` | 80 | 2 | 50.3% |
| `wing_a.bullet2` | 71 | 2 | **36.5%** |
| `wing_a.bullet3` | 45 | 1 | — |
| `wing_a.bullet4` | 83 | 2 | 73.5% |
| `wing_a.bullet5` | 88 | 2 | 72.6% |
| **`wing_a.resource`** | **160** | **4** | **18.7%** ← below 25% |
| `wing_b.overview` | 191 | 4 | 55.4% |
| `wing_b.bullet1` | 71 | 2 | **34.4%** |
| `wing_b.bullet2` | 46 | 1 | — |
| `wing_b.bullet3` | 45 | 1 | — |
| `wing_b.bullet4` | 75 | 2 | 41.3% |
| `wing_b.bullet5` | 80 | 2 | 61.9% |
| `wing_b.resource` | 176 | 4 | 30.5% |

**One zone falls below 25%: `type_9.wings.wing_a.resource`, at 18.7%.** It is live, correct in
production, and **out of scope — do not touch it.** It is recorded because it calibrates the
discriminator, and because 160 characters sits in a band the calibration below shows to be
unstable. Single-line zones are excluded from the fill test: a one-line block that does not
fill its box is not a stranded line.

#### C3a — The character bands, measured (this replaces the proxy)

The 12 Aug bands were a rule of thumb. `wings_band_calibration.js` renders **3,323 real prose
strings** — every string leaf of `content_library.json` plus the p9 spike, cut at word
boundaries to hit each target length, 40–60 samples per length — into the real zone elements
and reports what actually happened. No string is proposed as copy; they are probes for the
container.

Measured line widths: **bullets 280.66px**, **overview and resource 296.63px** (all three zones
are `font-size:12.5px`; only line-height differs — 19.38 / 18.75 / 18.13px — so overview and
resource share wrap behaviour and differ only in height).

**BULLETS**

| Band | Measured behaviour |
|---|---|
| 35–48 | **1 line, safe.** Min fill 81%+ |
| 49–55 | **Coin flip.** At 52ch: 21 of 40 samples 1 line, 19 samples 2 lines |
| 56–68 | 2 lines, last line **under 25%** — the ragged band |
| **69–89** | **2 lines, safe.** Min fill 27.5% → 63.0%, rising with length |
| 90+ | Coin flip into 3 lines (at 95ch, 4 of 40 went to 3 lines) |

> **The proxy was wrong at both ends.** It said "≤52 one line" — 52 is a coin flip; the true
> safe ceiling is **48**. It said the safe two-line floor was 73 "because 71–72 is a coin flip"
> — 69–72 are not coin flips at all (40/40 samples give 2 lines), they are merely *short*
> (27–33% fill). The safe two-line floor is **69**. The ceiling is **89**, not 88.
>
> The two Type 9 bullets at 71ch that the brief flags as out-of-band are, measured, in-band for
> line count and at the bottom of the acceptable fill range (36.5%, 34.4%) — consistent with
> the calibration's 29.0% minimum at that length.

**OVERVIEW / RESOURCE** (identical wrap, different line height)

| Band | Measured behaviour |
|---|---|
| 134–150 | 3 lines, safe |
| 153–185 | Coin flip 3↔4 lines, or 4 lines under 25% |
| **186–196** | **4 lines, safe.** Min fill 25.5% → 50.6% (189 dips to 19.9%) |
| 197–215 | **Coin flip 4↔5.** At 205ch: 50 of 53 give 4 lines, 3 give 5 |
| 237–249 | 5 lines, safe |

> **"Under 205 characters renders four lines" is too loose.** 197 already strands a fifth line
> in 1 sample of 60, and by 205 it is 3 in 53. The safe four-line window is **186–196**, with
> **195–196 the only lengths where the minimum fill clears 50%**.

**Recommended bands for r2 (measured, not derived):**

| Zone | Target |
|---|---|
| Bullets, one line | **≤48 chars** |
| Bullets, two lines | **69–89 chars**, preferring 82+ for ≥50% fill |
| Bullets | **avoid 49–68** entirely |
| Overview / resource, 3 lines | 134–150 |
| Overview / resource, 4 lines | **186–196** |
| Overview / resource | **avoid 153–185 and 197–215** |

#### C4 — The re-cut list

**Empty.** No re-cut can be proposed: types 1–8 have no authored zones, and Type 9 is live and
out of scope. The table in section 3 is empty for that reason, not because everything fits.

When r2 lands in the format from A2, this section becomes runnable: `wings_band_calibration.js`
already produces the per-length verdict, and `wings_fit_probe.js` produces per-zone rendered
line counts and fills. Both take under a minute.

#### C5 — Worst type, and the budget

**Worst by headroom: Type 9, at 37.25px.** Worst by drift: Type 9, at 18.75px. Every other type
is empty and therefore uninformative on both measures.

Type 9 must not be re-cut. But it is the **binding constraint on the eight new types**, because
it establishes what a full page costs. The load-bearing derived number:

```
chrome above the columns (Type 9)  = 1018.75 − 562.75 = 456.00px
chrome above the columns (empty)   =  640.00 − 184.00 = 456.00px   ← identical
                        COLUMN BUDGET = 1056 − 456    = 600.00px
```

**Each wing column must render at ≤600.00px. The taller column alone sets page height.**
Type 9's taller column is 562.75px, leaving 37.25px — **two bullet lines** (18.75px each) or
**one overview line plus change** (19.38px).

The two chrome figures being *identical* is itself a measured finding worth acting on: the
intro band's height is set by the 430×252 diagram, not by the intro text. The 8-line, 365-char
intro is **free**. It can grow to roughly the diagram's height before it costs a pixel — so the
page intro is not a place to economise, and shortening it would buy nothing.

Per-line costs for budgeting a column: overview **19.38px**, bullet **18.75px**, resource
**18.13px**, plus **15px** between bullets and 15px below the overview rule.

**Does anything sit close enough to the edge to warrant re-cutting before the build?** Type 9
does — 37.25px is under two bullet lines — but it is out of scope and stable. The honest answer
for the build is different: **the eight new types have no measured position at all**, and a
type whose content is one line longer per column than Type 9's will spill. The 600px budget
should be handed to whoever finalises r2 *before* it is transcribed, not discovered afterwards.

#### C6 — Measured vs extrapolated

| Claim | Provenance |
|---|---|
| Headroom, all 9 types | **Measured**, twice (probe + `verify:render`) |
| Column drift, all 9 types | **Measured** |
| Zone line counts & fills, Type 9 | **Measured** |
| Character bands | **Measured**, 3,323 samples |
| 456px chrome / 600px column budget | **Derived** from two measurements that agree exactly |
| Per-line px costs | **Measured** (computed `line-height`) |
| Anything about types 1–8 with content | **Not measured. Does not exist.** |

---

### D. Risk surface

#### D1 — Coach report regression

**Nothing on the Wings path touches a shared primitive in a way that can reach the coach report.**

- The Wings change is data: a JS object literal plus a regenerated JSON artifact.
- `buildCoachModel` (`app/report_prep.js:124–200`) reads `meta.wings` (type *numbers* from
  `TYPE_META`) and `s5.wings_notes` (from the API result). It **never** reads
  `type_N.wings.{overview,bullets,resource,intro_v3}`.
- `_clv3Wings` calls `buildEnneagramSVG({variant:'client-wings'})` — a shared function, but a
  v3-only variant, and adding content does not alter the diagram.
- `partAStyles()` and the shared stylesheet are untouched.

**Blast radius: zero on coach output** — provided the build stays content-only. If the build
prompt ends up touching `renderer.js` or `partAStyles()`, this assessment expires.

**Where the gate ran — the citation, as required.**

| | |
|---|---|
| Local, this branch, today | `node scripts/verify_coach_baseline.js` → **HTML byte-identical ✓ on both fixtures.** **PDF hash SKIPPED** — "platform is darwin, not linux". **Half the gate did not run.** |
| **CI, this branch** | **Never.** `gh run list` shows zero runs for `pr-3-per-type-pages`. The workflow triggers on `pull_request` and `push: [main]`; there is no PR and nothing pushed to main. |
| CI, last green | `main` @ `475942f`, 2026-08-13T00:22:45Z |

**I am not citing a green CI coach gate for this branch, because there isn't one.** The local
run proves the HTML half only. This is exactly the failure mode the brief describes — and see
D6, which is why CI would not reach the coach step even if it ran.

#### D2 — Punctuation

`_v3Straighten` (`app/renderer.js:3039–3042`), applied to **every** v3 prose string via `_v3t`,
before `esc()`:

| Input | Output |
|---|---|
| `’` U+2019 | `'` |
| `“` `”` U+201C/201D | `"` |
| `…` U+2026 | `...` |

**Not normalized:** em-dash U+2014, en-dash U+2013, hyphen U+002D. They pass through verbatim.

**Can it silently alter authored text? Yes — and one case has a measurement consequence.**

1. Curly apostrophes and quotes are silently straightened. This is ratified and intended
   (PR #75, `e2527e7`), but it means **rendered output is not character-identical to the r2
   document**. Google Docs inserts curly forms by default, exactly as Word does.
2. **`…` expands from 1 character to 3 at render time.** Any r2 zone whose annotation counts an
   ellipsis as one character will render three characters wider than its annotation claims.
   Given how tight the bands in C3a are, a single ellipsis can push a 196-char overview to an
   effective 198 and into the 4↔5 coin-flip band. **Worth a search-and-check on ingestion.**
3. Em-dashes land un-normalized and become **new material for the outstanding 53-item editorial
   list** (`docs/em_dash_editorial_review.md`). Flag any em-dash in r2 for Mo rather than
   assuming the existing list covers it — that list was compiled before r2 existed.
4. `_v3NoBreak` wraps short hyphenated compounds in `nowrap` spans. Related gate: `render_client.js`
   sets `checkHyphens: true` and **fails** if a word splits across lines at an existing hyphen.
   It passes today. Hyphenated compounds in r2 are the most likely new trigger.

#### D3 — The content resolver — **this is the real sequencing blocker**

> **Premise correction:** on this branch (and on `main`) the resolver does **not** throw on
> shape mismatch, and the CMS override table is **not** retired in code. Both changes live on
> the unmerged `cms-override-cleanup`. The brief describes that branch's state as if it were
> current.

**Two of the seven published override rows are `type_1.wings` and `type_8.wings`** — two of the
eight types this PR adds content to. From `docs/pr_cms_override_cleanup.md:59–72` and confirmed
against the local retirement snapshot:

```
rows snapshotted: 7
 - static.primer         published  2026-06-29
 - static.welcome        published  2026-06-13
 - static.wings_using    published  2026-06-18
 - subtype_sp9.tagline   published  2026-06-13
 - subtype_sx9.tagline   published  2026-06-13
 - type_1.wings          published  2026-06-13   ←
 - type_8.wings          published  2026-06-13   ←
```

Both carry the **v2 wing shape** (`{target_type, body}`) and predate the v3 fields.
`resolveLibObject` (`app/content_overrides.js:85–98`) replaces a field **whole**:
`out[field] = resolved`.

**Consequence if a `type_1.wings` / `type_8.wings` row is published when Wings content lands:**

| Code state | Behaviour |
|---|---|
| **This branch / main** | The override silently **replaces the entire `wings` object**, dropping `overview`, `bullets`, `resource` and `intro_v3`. **Types 1 and 8 render blank Wings pages in production** — the exact defect this PR exists to eliminate — while every offline gate stays green, because no harness loads overrides. |
| **After `cms-override-cleanup`** | Loud `OverrideShapeError` at render time, naming the key and both shapes. Correct, but it reaches every report render. |

The cms branch's own test fixture (`tests/fixtures/published_overrides.json`) anticipates this
precisely, using `type_9.wings` in its `drifted` group with the note that it "predates the
overview/bullets/resource/intro_v3 fields". **The same defect applies to types 1 and 8, and
those rows are real, not fixtures.**

**Mitigating fact:** `retire_overrides.js --confirm` appears to have been run on 12 Aug 2026 at
21:47 PDT — `.override_snapshots/content_overrides_2026-08-13T04-47-15-813Z.json` holds all
seven rows, which is what that script snapshots before deleting. **I did not verify the live
table**; doing so requires a production database connection, which is out of scope for a
read-only audit and not something I will do unasked.

**Required before Wings content reaches production:**

```bash
npm run overrides:check
```

That script exists only on `cms-override-cleanup` (exit 0 clean / 1 mismatch / **2 did-not-run**,
so a missing `DATABASE_URL` cannot read as green). Either merge that branch first, or confirm by
another means that `type_1.wings` and `type_8.wings` are gone.

#### D4 — Two source defects, confirmation only

**(i) Archetype names — the premise does not hold.** Both in-repo copies are **correct** and
byte-identical to each other:

| Type | `app/type_library.json` | `content/type_library.json` |
|---|---|---|
| 3 | The Performer | The Performer |
| 5 | The Observer | The Observer |
| 6 | The Questioner | The Questioner |
| 8 | The Protector | The Protector |

`diff` of the two parsed files: empty. `build_content_library.js:181–184` agrees, and
`validateType:416` hard-asserts the library name against it.

**No `type_library.json` anywhere carries Achiever / Investigator / Loyal Skeptic / Challenger.**
Those strings appear in exactly five files: four design documents
(`docs/client_report_v3_build_plan.md`, `docs/feasibility_report_client_report_v3.md`,
`docs/hive_insightout_client_report_design_spec_v3_0.md`,
`docs/V2 Design Documents/step7_plan.md`) and one occurrence in `app/server.js:4621` which is a
prompt instruction **forbidding** those names. **The stale names are a docs problem, not a data
problem.** Nothing to fix in `type_library.json`; the design spec is what needs correcting.

**(ii) The Type 8 "impatient" string — confirmed present, in three files:**

```
app/type_library.json:643
content/type_library.json:643
docs/type_library_stress_security_primer_draft_080726.json:646
```

> "An Eight with a strong Nine wing is more grounded, more impatient, and more measured."

"impatient" contradicts "grounded", "measured", "calm", and "steady presence" in the same
sentence and the next. Reads as a typo for "patient". **Not fixed here.** Note it is **v2** wing
narrative (`type_N.wings.wing_*.body`), which the v3 p8 page does not read — so it does not
affect this PR, but it does affect the live legacy report and all three copies need the same fix.

#### D5 — Expected page count — **two counts exist and they disagree**

Answered from the code, not from reasoning about it.

**Does populating an already-present blank page change the count? No.** `_clv3Wings(model)` is
called unconditionally at `app/renderer.js:3350` and always emits exactly one
`<div class="v3-page">` (`:3258`). The page container exists whether or not it has content.
Counts are of matched DOM elements. **Populating it changes nothing.**

**But there are two assertions, and one is already wrong:**

| Assertion | Location | Value | Actual | Status |
|---|---|---|---|---|
| Render gate | `scripts/render_client.js:56` | **7** | 7 | ✓ passes |
| Test inventory | `tests/lib/report_page_inventory.js:27` | **6** | 7 | ✗ **fails** |

`cdf96ee` ("SPIKE: p9 Stress & Security page") added the Lines page and bumped
`render_client.js` from 6 to 7 — its commit message says so explicitly — but did **not** touch
`tests/lib/report_page_inventory.js`, which this branch never modifies at all.

**Measured, locally, on `4f0ed46`:**

```
cd app && npm test
  ✗  v3: 7 .v3-page containers (expected 6)
  → tests 5, pass 4, fail 1  —  ../tests/report_pages_test.js
```

**`npm test` is red on this branch right now, and has been since `cdf96ee` on 12 Aug.** It has
nothing to do with Wings. It is a one-line fix (`6` → `7`) that belongs in whatever lands the
Lines page.

**Neither count changes when Wings gains content.** Both stay 7. The work here is to make the
second one *say* 7.

#### D6 — What else makes this longer than "add content, rebuild, render, verify"

It is *nearly* that mechanical. The plumbing is built, the gate is precise, the renderer needs
nothing. But five things sit between here and green, in rough order of cost:

1. **`npm test` is already red** (D5). It is the **first** hard-fail step in
   `report-verify.yml`, before `verify:render`, the diagram gate, the transparency gate, the
   coach gate and the content-library gate. **CI on this branch would fail at step 1 and never
   reach any of the others.** No CI signal for this branch exists on *anything*. Fix this first
   or every later gate remains unobserved.
2. **`type_1.wings` / `type_8.wings` overrides** (D3) — silent blank pages in production for two
   of the eight types, invisible to every offline harness.
3. **`SCRIPT_SOURCED` accounting** (A5) — one line, but skipping it makes the Word-canonical
   figure move the wrong way while claiming the opposite.
4. **The 600px column budget is not yet known to be met** (C5). The eight types are unmeasured.
   If r2 runs long, the re-cut round happens *after* transcription rather than before.
5. **The `intro_v3` × 8 requirement** (B2) — small, but it is 8 of the 56 failures and it is not
   in anybody's count of "112 zones to author".

Two smaller ones: the ellipsis expansion in D2(2), and the hyphenation gate in D2(4).

**Render artifacts.** 9 PDFs (one per type), `.phase6_out/wings_probe_t{1..9}.pdf`, **5.4 MB
total**, plus `wings_fit_probe.json` and `wings_band_calibration.json`. Not deleted.

> **Correction to the brief:** these cannot be archived on the branch. `.phase6_out/` is
> gitignored (`.gitignore:12`), by the same policy that covers every other render output. They
> are local-only. If branch-archived PDFs are wanted, that needs a deliberate path change —
> and nothing in the build plan should assume they exist.

---

## 3. The re-cut list (C4)

| Type | Zone | Current text | Proposed | Measurement | Mechanical or meaning? |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

**Empty by necessity, not by result.** Types 1–8 have no authored zones to re-cut; Type 9 is
live and out of scope. This table is the deliverable of the *next* pass, once r2 arrives in the
A2 format. The measured bands in C3a are what it will be evaluated against.

---

## 4. Evidence

Every number carries a provenance tag. `measured` names the command and where it ran;
`derived` names the inputs and the assumption; `aggregate` names the set.

| # | Figure | Value | Tag | Source |
|---|---|---|---|---|
| 1 | HEAD | `4f0ed46` | measured | `git rev-parse HEAD`, local |
| 2 | Ahead / behind main | 11 / 0 | measured | `git rev-list --left-right --count main...HEAD`, local |
| 3 | Coverage failures | **56** | measured | `node scripts/build_content_library.js`, local, exit 1 |
| 4 | Assertions per type | 7 | aggregate | the 56 above, over types 1–8 |
| 5 | 7 vs 14 zones | reconciled | derived | 14 − 8 (bullets as one array) + 1 (`intro_v3`) |
| 6 | Build writes on failure | no | measured | exit code + `git status --porcelain app/content/`, local |
| 7 | Word-canonical, today | **1352 / 1400** | measured | `SCRIPT_SOURCED` walk of the committed library, local |
| 8 | Wings leaves per type | 15 | measured | leaf walk of `type_9.wings`, local |
| 9 | Word-canonical after | 1352 / 1520 | derived | #7 + 8 × #8, assuming `SCRIPT_SOURCED` is widened |
| 10 | If not widened | 1472 / 1520 | derived | #7 + 8 × #8, `scripted` held at 48 |
| 11 | Ratio gates CI | no | measured | read of `verify_content_library.js:150–177` + `report-verify.yml` |
| 12 | `source_sha256` asserted | **never** | measured | `grep -rn source_sha256` → one write, two doc refs |
| 13 | docx bytes, main / cms | 87432 / 87435 | measured | `git show … \| wc -c`, local |
| 14 | docx hash differs | yes | measured | `_meta.source_sha256` on both branches, local |
| 15 | cms touches build script | **no** | measured | `git diff --stat main..origin/cms-override-cleanup -- scripts/build_content_library.js` → empty |
| 16 | Headroom, types 1–8 | **416.00px** | measured | `wings_fit_probe.js` + `npm run verify:render`, local, macOS, Chrome 147.0.7727.57, Arial verified |
| 17 | Headroom, type 9 | **37.25px** | measured | same, both runs agree |
| 18 | Column drift, type 9 | **18.75px** | measured | `wings_fit_probe.js`, flex released then restored, local |
| 19 | Line heights | 19.38 / 18.75 / 18.13px | measured | computed `line-height`, local |
| 20 | Zone lines & fills, type 9 | see C3 | measured | `Range.getClientRects()` merged by top, local |
| 21 | Zone below 25% | 1 (`t9.wing_a.resource`, 18.7%) | measured | #20 |
| 22 | Line widths | 280.66 / 296.63px | measured | forced-wrap probe, local |
| 23 | Calibration corpus | 3,323 strings | aggregate | `content_library.json` leaves + p9 spike, sentence-split, prefixed at word boundaries |
| 24 | Bullet: 1 line safe | **≤48 chars** | measured | `wings_band_calibration.js`, 40 samples/length, local |
| 25 | Bullet: 2 lines safe | **69–89 chars** | measured | same |
| 26 | 52ch is a coin flip | 21×1L / 19×2L of 40 | measured | same |
| 27 | Overview: 4 lines safe | **186–196 chars** | measured | same, 60 samples/length |
| 28 | 205ch strands a 5th line | 3 of 53 samples | measured | same |
| 29 | Chrome above columns | **456.00px** | measured | identical in the type-9 and empty runs |
| 30 | **Column budget** | **600.00px** | derived | 1056 − #29; verified against #17 (562.75 + 37.25 = 600) |
| 31 | Empty column shell | 184.00px | measured | `wings_fit_probe.js`, local |
| 32 | Intro is height-free | yes | derived | #29 identical at 0 and 8 intro lines ⇒ the 252px diagram governs |
| 33 | Coach model reads v3 wings | **no** | measured | read of `report_prep.js:124–200` |
| 34 | Coach gate, local | HTML ✓, **PDF skipped** | measured | `node scripts/verify_coach_baseline.js`, local **macOS — PDF half does not run off-Linux** |
| 35 | Coach gate, CI, this branch | **never ran** | measured | `gh run list` — zero runs for `pr-3-per-type-pages` |
| 36 | CI last green | `main` @ `475942f`, 2026-08-13T00:22:45Z | measured | `gh run list` |
| 37 | Straightening transform | `’→'`, `“”→"`, `…→...` | measured | `renderer.js:3039–3042` |
| 38 | Em/en-dash normalized | **no** | measured | same |
| 39 | Published override rows | 7, incl. `type_1.wings`, `type_8.wings` | measured | `.override_snapshots/…-813Z.json`, local; corroborated by `docs/pr_cms_override_cleanup.md:66–72` |
| 40 | Live override table state | **not verified** | — | requires a production DB connection; not attempted |
| 41 | Archetype names, both copies | correct, identical | measured | parse + `diff` of `app/` and `content/type_library.json`, local |
| 42 | "impatient" present | 3 files | measured | `grep -rn "more impatient"`, local |
| 43 | Render-gate page count | 7, passes | measured | `render_client.js:56`; `npm run verify:render` → ALL PASSED, local |
| 44 | Test-inventory count | **6, fails** | measured | `tests/lib/report_page_inventory.js:27`; `npm test` → 1 failed, local |
| 45 | Populating changes count | **no** | measured | `renderer.js:3350` calls `_clv3Wings` unconditionally; `:3258` emits one container |
| 46 | Zone inventory file | **does not exist** | measured | filesystem search + `git log --all --diff-filter=A`, both empty |
| 47 | PDFs produced | 9, **5.4 MB** | measured | `ls -la .phase6_out/wings_probe_t*.pdf`, local |
| 48 | PDFs archivable on branch | **no** | measured | `git check-ignore` → `.gitignore:12` |

**Platform caveat on every rendered figure (#16–#32).** All rendering ran locally on macOS
(darwin) with the lockfile-pinned bundled Chromium, `assertReportFont` confirming Arial metrics.
CI runs Linux with Liberation Sans, which is metrically compatible — identical advance widths,
so line breaks land in the same places. Line counts and fills should therefore hold. **They have
not been confirmed on Linux, because CI has never run on this branch (#35).**

---

## 5. Recommended build sequence

### Blockers — resolve before the build prompt is written

**B1. Hand over r2 in the A2 format.** Nothing in section C4 can be produced without it. It is
the only thing on this list that is not a code change, and everything else waits on it.
→ *Cai, from the r2 doc (`1YLIlbYXmac…`), per the template in A2.*

**B2. Fix `tests/lib/report_page_inventory.js:27`, `6` → `7`.** `npm test` is red today. It is
the first hard-fail CI step; nothing downstream of it has ever been observed on this branch. One
line. **Do this first — before the Wings work, not with it** — so that the first CI run on this
branch tests Wings rather than rediscovering a stale count.

**B3. Confirm `type_1.wings` and `type_8.wings` are retired.** Silent blank pages in production
for two of the eight types, invisible to every offline gate. Either merge `cms-override-cleanup`
first, or run `npm run overrides:check` from that branch against production and record the
result. **Not optional, and not deferrable to merge time** — it is a production-only failure
mode.

**B4. Locate `content_zone_inventory_v1_080426.json` or drop it.** It is not in the repo (#46).
If it is steering the zone shape, B3 of this audit is unverified and the "At their best"
question is open. If it is superseded, say so and stop citing it.

### Sequence, once those clear

1. **Land B2** on its own. Confirm CI goes green on the branch for the first time — that
   establishes the baseline every later gate is read against.
2. **Ingest r2** → `docs/wings_content_r2.md`, committed. Strip annotation lines; grep for `…`
   (D2(2)) and for em-dashes (D2(3)) and route the latter to Mo.
3. **Measure before transcribing.** Run `wings_band_calibration.js` logic over the r2 strings
   against the bands in C3a, and sum each column against the **600.00px budget** (C5). Produce
   the C4 re-cut table *here*, while it is still cheap.
4. **Mo reviews r2** — she has not seen it — plus any re-cut that changes meaning, plus the
   em-dashes from step 2.
5. **Populate `INTERIM_WINGS_V3`** keys 1–8. Hoist the shared `intro` to a module constant
   rather than repeating it nine times (A2, B2).
6. **Widen `SCRIPT_SOURCED`** (`verify_content_library.js:53`) from the fixed `type_9.wings`
   path to a walk over all nine types (A5). Expect the printed figure to read **1352/1520**.
7. **Rebuild and commit** `app/content/content_library.json`. Expect 56 → 0 and exit 0.
8. **Render and verify:** `npm test`, `npm run verify:render`, `node scripts/verify_content_library.js`.
   Confirm page count stays **7** (D5), no spill on any type, and no zone below 25% fill.
9. **Push and open a PR** — the only way the coach gate's PDF half and the diagram, transparency
   and font gates ever run (D1, #35). Do not cite a local green for the coach gate.

Steps 5–8 really are "add content, rebuild, render, verify". The cost in this PR is steps 1–4.

---

## 6. Status

**BLOCKED on four items, none of which is the build itself.**

- **Needs input — Cai:** r2 Wings content in the A2 format (112 zones, types 1–8). Nothing in
  section C4 exists until this arrives.
- **Needs input — Cai or design:** the whereabouts of `content_zone_inventory_v1_080426.json`,
  or a decision to drop it.
- **Needs input — Mo:** r2 has not been reviewed by the content owner.
- **Blocked — code:** `npm test` red at `report_page_inventory.js:27` (one line); and
  `type_1.wings` / `type_8.wings` override rows unconfirmed against production.

**Ready for a build prompt once B1–B4 clear.** The ingestion path is built and proven end to end
by Type 9; the gate is exact and correctly unconditional; the renderer needs no change; the page
count does not move; the coach report cannot be affected by a content-only change. The container
is now measured rather than estimated — **600.00px per column, bullets ≤48 or 69–89 characters,
overviews 186–196** — so the r2 text can be checked against real numbers before anyone
transcribes it.

The single largest risk is not fit. It is that **this branch has never once been through CI**,
so five of the six hard gates are unobserved on eleven commits of work.
