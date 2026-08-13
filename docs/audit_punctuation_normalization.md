# Audit — Punctuation normalization of the content library

**Prepared by:** Claude Code (lead engineer / QA)
**Phase 1 (measure) delivered:** 12 August 2026 · **Phase 2 (build) landed:** 12 August 2026
**Scope:** `content_library.json` punctuation — em dashes, curly quotes, curly apostrophes,
ellipses. Source pass on the Word original plus a render-time transform on the v3 client path.
**Not in scope:** the ~473 em dashes in fields PR 3, PR 4 and PR 6 rewrite; `type_N.comparison`;
the 53 sentences routed to Mo in `docs/em_dash_editorial_review.md`.

Every number is tagged **measured** (with the command and *where it was taken*), **derived**
(with the assumption) or **aggregate** (with the set).

---

## 0. The measurement lesson this pass turned on

Three methods were tried for the single question *"does normalizing this break the coach
gate?"*. Two were wrong, and the way they were wrong is the reusable part.

| Method | Result | Why it was wrong |
|---|---|---|
| Recording `Proxy` over the library module | 825 coach leaves / 356 em dashes | Measures what the **model reads**. `buildClientModel` pulls whole objects, so it reported ~all 1,346 leaves for the client path. |
| Substring probe of leaf text against rendered HTML | 7 em dashes | Defeated by truncation — `capByLines` / `clampText` cut fields, so a probe drawn from the full string misses a partially-rendered field. |
| **Normalize in memory, re-render, diff** | **4 em dashes, one family** | Measures the artifact. No proxy, no heuristic. |

Same lesson as the glyph-ID finding in the coach-baseline fix: **measure the artifact, not a
proxy for it.** A third instance of the same error class appears in §1 below.

---

## 1. The orphan split — and a duplicate field nobody knew about

Phase 2's gate was: re-count the 16 mechanical em dashes in fields that actually render, and
stop if fewer than ~8 survive.

**Method** *(measured: `orphan.js`, run against `main` @ `cd9a946`)* — inject a marker into
every punctuation-bearing string of one family at a time, re-render all three reports, diff.
A changed output means the family renders there.

| Family | coach | legacy client | v3 | verdict |
|---|---|---|---|---|
| `type_N.practices` | – | **yes** | – | renders |
| `type_N.center` | – | **yes** | – | renders |
| `type_N.comparison` | **yes** | **yes** | – | renders |
| `static.primer` | – | yes | **yes** | renders |
| `static.welcome` / `wings_using` / `lines_primer` / `instinct_primer` / `instinct_definitions` | – | yes | – | renders |
| `type_N.inquiry_lines` | – | – | – | **orphaned** |
| `static.wings_primer` / `static.contents` / `static.thoughts` | – | – | – | orphaned |

**Two methodological corrections were needed before this table could be trusted.**

1. The marker was first **appended**. `report_prep` truncates tails, so a rendered field
   could lose its marker and read as orphaned. Moving the marker to the **head** fixed it —
   the result was unchanged, which is what makes it trustworthy rather than lucky.
2. A cross-check appeared to contradict the table: the text of `type_4.inquiry_lines[0]`
   *is* in the legacy HTML. Chasing that produced the real finding below. **The substring
   cross-check was the wrong method again** — a substring can reach the output from a
   different field.

### 1.1 `type_N.inquiry_lines` is a build-time duplicate

**Measured** (`build_content_library.js:256`):

```js
t.inquiry_lines = ['thinking', 'feeling', 'behaving'].map(k => t.patterns[k].inquiry)
```

`type_N.inquiry_lines` is **derived** from `type_N.patterns.*.inquiry`. Verified
byte-identical for all nine types. **One docx paragraph, two JSON leaves.** The renderer
prints the `patterns.*.inquiry` copy; the `inquiry_lines` copy is never read.

Consequence for this pass: those 4 em dashes have no independent edit surface. Their only
source paragraph lives inside the patterns section, which is category (a) — PR 3 rewrites it.
**Excluded.**

### 1.2 Surviving count: 12 — gate cleared, with a qualification

| Family | Mechanical em dashes | Renders |
|---|---|---|
| `type_N.practices` | 8 | legacy client only |
| `type_N.center` | 4 | legacy client only |
| ~~`type_N.inquiry_lines`~~ | ~~4~~ | orphaned duplicate — dropped |

**12 ≥ the ~8 threshold, so the em-dash half proceeded.** The qualification, stated because
it is not visible in the number: **all 12 render only in the legacy client report.** None
reach v3 or coach, and both families retire at PR 7 — `type_N.center` is already listed in
the build plan for post-cutover removal.

The argument for proceeding anyway is that the legacy report is **what clients receive
today**. PR 7 is not merged; this is live client-facing prose, not dead content. The value is
time-limited, and that is worth knowing.

---

## 2. What changed

### 2.1 Em dashes — 12, section-scoped

**Measured** (`patch_punct.py`): 12 replacements, docx `744 → 732`.

Rule: an em dash immediately before *and / but / or / so / yet / not* becomes a comma.
Sections `YOUR CENTER OF INTELLIGENCE` and `PRACTICES THAT HELP` only. The patcher walks
paragraphs and tracks the current section label — **a global character replace would have hit
all 549**, including the ~473 PR 3/4/6 rewrite.

Excluded within those sections: any dash that is **half of a paired aside** (another dash
within 120 characters). Verified one by one across all 19 candidates; the 3 paired ones
visibly break when only one dash is replaced:

> `something is off — or right — is often accurate` → `something is off, or right — is often accurate` ✗

### 2.2 Curly and ellipsis — whole document, both layers

**Measured** (`content_library.json`, before → after):

| | Before | After |
|---|---|---|
| Curly apostrophe U+2019 | 54 | **0** |
| Curly double quotes U+201C/D | 68 | **0** |
| Ellipsis U+2026 | 4 | **0** |
| Em dash U+2014 | 549 | 537 |

Whole-library scope is safe on measured evidence, not inference: **the same transform applied
across the entire library left coach output byte-identical** (§3). The double-review objection
that excluded category (a) from the em-dash work does not apply — nobody reviewing copy is
choosing between U+2019 and U+0027.

**The balance defect is repaired at source.** The library was unbalanced **39 `“` against
29 `”`** — five `subtype_*` leaves used an *opening* quote to close:

> `the most visibly “peacemaking“ Nines` → `the most visibly "peacemaking" Nines`
> `Can “fall asleep“ in a comfortable social role` → `Can "fall asleep" in a comfortable…`

**Measured after: 0 unbalanced leaves.** Fixing at source was required rather than incidental:
the render transform would have **masked** this in v3 while leaving it wrong in the docx and
in coach and legacy rendering.

### 2.3 The transform — `_v3Straighten`

Added to `_v3t`, v3 client path only. This is the permanent half: Word's smart quotes are on
by default — `build_content_library.js` names Word as the editing surface *because* it
"handles smart quotes" — so a source-only pass is a treadmill that starts refilling on the
next edit, with no gate to catch it.

**Measured: a no-op on merge.** v3 output carries 0 curly characters before and after, and
output length is unchanged at 82,444 chars. It takes effect only as new content lands, which
is the point.

---

## 3. Gate answers

**Coach.** *(measured: `verify_coach_baseline.js`)* HTML **byte-identical on both fixtures**.
This is the check that proves the scope decision: `type_N.comparison` is the only family
reaching coach output, and excluding it kept the pass quiet.

The coupling matters and is why the exclusion was not merely convenient: the coach PDF
baselines were re-recorded only hours earlier by PR #74, from CI run `31644633865`, and they
encode a render in which the **U+2713 checkmark is absent on Linux**. Re-baselining on top
would have blessed that state a second time and made the defect harder to see.

**Legacy client byte-identity: no gate asserts it.** *(measured: `grep` over `tests/`,
`scripts/`, `.github/`; `tests/baselines/` contains coach artifacts only)* The legacy client
is checked for page-container counts (`report_pages_test.js`) and page heights
(`render_client.js`) — both structural. So the escaping growth breaks nothing.

That growth is real and worth recording: straight quotes are **larger** in HTML than curly
ones, because `esc()` maps `"` → `&quot;` and `'` → `&#039;` while curly forms pass through
unescaped. **Measured: legacy client output 928,881 → 929,041 chars (+160).**

**Render.** Confirmed rather than assumed — every v3 page is one sheet and **every headroom
figure is unchanged** by the normalization:

| Page | Height | Headroom before | Headroom after |
|---|---|---|---|
| Contents | 1056px | 113.87 | **113.87** |
| Welcome | 1056px | 130.75 | **130.75** |
| What Is | 1056px | 32.58 | **32.58** |
| Wings | 1056px | 57.25 | **57.25** |
| Your Thoughts | 1056px | 75.39 | **75.39** |

**Content library invariant:** green — `json == build(docx + INTERIM_*)`.

---

## 4. Mo's list

`docs/em_dash_editorial_review.md` — **53 sentences** carrying **60 em dashes** (the 7 paired
asides hold two each), each with its field path, full sentence, and the options that preserve
meaning. Per-instance, not a rule, because the rule is what makes the output wrong.

| Class | Sentences |
|---|---|
| Paired aside | 7 |
| Definition / appositive | 11 |
| Clause joiner | 11 |
| Mixed | 14 |
| Heading separator | 10 |

`static.primer.scan_heading` — *"The Nine Enneagram Types — Scan Each One"* — is in that list
rather than in the mechanical pass, because it renders on the v3 What Is page signed off on
12 August. Changing signed-off copy silently is not a mechanical act.

---

## 5. Carried to the board, not fixed here

**Brief §3's rule does not reach most of the violations.** *(measured: rendered coach HTML,
both fixtures)* Of the 60 em dashes in coach output, only **~4 come from the content
library** — the other ~56 are renderer literals and AI-generated text. Normalizing the
library will not make the coach report em-dash-free. Two questions follow, neither chased
here: whether the rule should reach the generation prompts, and whether any AI-generated text
lands in the **client** report, where signed-off copy sets the standard.
