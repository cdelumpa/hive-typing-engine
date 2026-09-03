# PR 3-Explore — the 1/4/7 batch, the quote band, and two layout corrections

**Branch:** `pr-3-explore`
**Companion audit:** `docs/audit_pr3_explore_pages.md`
**Design spec:** `docs/hive_insightout_client_report_design_spec_v3_0.md` §4.4, §7.2–§7.4
**Date:** 20 August 2026

---

## What this is

Sheets 6 and 7 ("Exploring Your Type Hypothesis" and its continuation) shipped as a Type 9 solo
pilot in `deb13f3`. This takes them to **four authored types — 1, 4, 7 and 9** — builds the one
zone the pilot could not build, and corrects two layout problems that only became visible with
real content in place.

Nine-page documents for types 1, 4, 7, 9; seven-page for the other five. All 27 v3 page-renders
fit one sheet, exit 0.

---

## 1. Content — 160 strings, four types

`INTERIM_EXPLORE_V3` in `scripts/build_content_library.js` now carries types 1, 4, 7 and 9.

Source is four Google Docs authored by Cai and Mo (`Type N — <Nickname> · p6/p7 Final Content for
Review`); IDs are recorded in the design spec §7.4. The docs are the source of record, the
constant is a transcription. To avoid drift the literal was **generated** from the transcribed
data and round-tripped — 160/160 strings byte-identical — rather than hand-written twice.

**Type 9's content is a REPLACEMENT, not an update.** 36 of its 40 strings differ from the
version `deb13f3` shipped, which was a verbatim port of the two Type 9 mockups landed with an
explicit note that it carried no authorisation for editorial re-cuts. The Type 9 source doc
supersedes that port; ratified by Cai, 20 Aug 2026. The mockups remain the **geometry** source
and are no longer the **content** source for any authored type.

**Fit.** Every zone is inside its measured budget — nothing over, on any of the four types. The
tightest is Type 9's core belief at 102 of 107 characters.

⚠️ **The character counts printed in the docs are unreliable** — low by 1 to 6 in roughly half the
zones, not by a consistent offset. Measure the strings; do not trust the annotations. The
**budgets** beside them are sound (`scripts/spike/explore_fit_probe.js`).

### Pilot gating

`EXPLORE_PILOT_TYPES` (build script) and `V3_EXPLORE_PILOT_TYPES` (renderer) both move to
`[1, 4, 7, 9]`. These are the two lists that must agree, flagged for collapse in both files. They
should be **deleted, not extended**, when the remaining five types land — a list naming all nine
types is not a gate.

The build script's `validateExplore` still asserts both halves: an authored type has all of
sheets 6-7, an unauthored type has `explore_v3` **absent** — not empty, not half-filled.

---

## 2. "In Your Own Words" — the quote band (p6)

The band is in the renderer. It was measured as a spike in `6a8a95f` but deliberately not shipped,
because the zone is a per-client quotation and the pilot fixture carried no source for it.

**It is the only per-CLIENT zone on either Exploring sheet.** Everything else there is per-type
library content. It reads `client_words.leading_quotes` off the Call #2 result — the same verbatim
Stage-1 language P3 quotes — via `pages.v3_explore.words`.

Three things worth knowing:

- **Omitted, not emptied, when a client has no quotes.** An empty band is a cream strip with a
  heading and nothing under it — the blank-zone defect the Wings and Lines gates exist to prevent,
  and invisible to a page-count check. Asserted in both directions.
- **The model object is spread, never mutated.** `t.explore_v3` is the require-cached content
  library object shared by every render in the process; assigning onto it would leak one client's
  quotes into the next client's report. There is a test that the library object stays clean.
- **Re-typed fixture renders withhold the quote.** `scripts/render_client.js` renders every type
  from one fixture by swapping `confirmed_type`. A client's quotes are evidence for the fixture's
  *real* type, so they are dropped when it is re-typed — otherwise a Type 9 client's own words
  print under a Type 1 heading, reading as authored-for-that-type when they are not. The band
  therefore appears on the fixture's own type and nowhere else.

### ⚠️ Fixture invariant changed — read this

`tests/fixtures/anders_sx9_api_result.json` previously carried **no** AI-authored content at all:
`client_facing`, `client_words` and `coach_report` were all `{}`, and its `_comment` said so. That
invariant is now partially broken by design — `client_words.leading_quotes` is populated, because
with it empty the band cannot be rendered or measured at all. `client_facing` and `coach_report`
remain empty.

The two quotes are transcribed from the ratified mockup (`LeadingType_A_v1`, BAND 3), which prints
them as one string joined by an ellipsis — the same `' … '` join P3 uses — which is why they are
stored as two. **They are the reference implementation's words for this client, not the output of
a live Call #2.** Pointing this at a real Anders result requires no code change.

---

## 3. Two layout corrections

Both are deliberate departures from the ratified mockups and are tabulated in design spec §4.4 as
**M1–M3**. A pixel-diff against `LeadingType_A_v1` / `LeadingType_B_v1` will flag them. They are
not regressions.

### 3.1 At-a-glance labels (M1, M3)

`V3_GLANCE_LABELS` was type-number plurals ported from the mockup — "What Nines Want" and so on.
The locked wording in all four source docs is **Core Desire / Attention Goes To / Avoidance /
Driving Emotion**. The fourth label is the tell that these doc headings are labels rather than zone
names: it is identical in both.

This surfaced a second problem. The label box is `flex:0 0 92px` with no padding and the row has no
`gap`, so the value column starts exactly where the label box ends — the only separation is
whatever slack the label text happens to leave. That was invisible while the labels were long
plurals, which broke into short lines. `ATTENTION GOES` renders **89.42px into the 92px box — a
2.58px gutter, against 22–45px on the other three** — and collided with the value text.

Fixed with `padding-right:10px` on the label. The reset sets `box-sizing:border-box` globally, so
the gutter comes out of the 92px and **the value column stays 221.5px** — the width the glance
budgets (80 and 111 chars) were measured at. Line count is unchanged: `ATTENTION GOES / TO`
rebreaks as `ATTENTION / GOES TO`, which also reads better. Zero height change on any type.

`display.type_word_plural` (`app/report_prep.js`) existed solely to feed the three plurals and is
now **unused**. Left in place — sheets 5, 10 and 11 are unbuilt and may want it. Delete it if they
do not.

### 3.2 Space above the sheet-7 subheads (M2)

Both gaps went **30px → 20px** (`.v3-tb-two`, `.v3-tb-styles`).

The two Exploring mockups disagree with each other: sheet 6 sets 20px above its `h2` with 10px
below; sheet 7 sets 30px with 14px below. The original port had already resolved the *bottom* half
in sheet 6's favour — the shared `h2` rule is 10px, not 14px — which left the two sheets
inconsistent in opposite directions. This finishes the normalisation: both sheets now read 20px
above / 10px below.

It also reads better. At 30/10 each heading sat nearly equidistant between the block above and its
own section; at 20/10 it groups with the section it labels.

---

## 4. Headroom

Sheet 7 is the tight page, not sheet 6. Measured at 96dpi against the 1056px sheet, pinned
Chromium, Arial asserted.

| Type | p6 before | p6 after | p7 before | p7 after |
|------|-----------|----------|-----------|----------|
| 1 | 159.69 | 159.69 | 13.50 | **33.50** |
| 4 | 159.69 | 159.69 | 32.25 | **52.25** |
| 7 | 172.28 | 177.81 | 12.11 | **32.11** |
| 9 | 159.69 | **55.56** | 12.88 | **32.88** |

- **p7** gained exactly 20px on every type from §3.2 — roughly one extra line of prose (style
  bullets run 19.4px per line, best/edge items 20.2px). The tight types went from under one line
  of slack to just over one.
- **Type 9's p6** lost 104.13px to the quote band, matching the `6a8a95f` spike measurement to the
  hundredth. Still one sheet.
- **Type 7's p6** gained 5.53px from the shorter glance labels — its values are the shortest of the
  four, so labels were the constraint on one row. The other three types were unaffected because
  their values were already the taller side.

---

## 5. Tests

`tests/report_pages_test.js` — **80 passed, 0 failed** (was 73).

**The non-pilot assertion was silently dead and is now derived.** It rendered type 1 and asserted a
seven-page document. Type 1 became an authored type in this PR, so the assertion was still true of
the constant but no longer testing anything — it was a *pilot* render compared against the
non-pilot count. It now picks the lowest type absent from `V3_EXPLORE_PILOT_TYPES`, and a companion
loop asserts every authored type reaches nine pages with both Exploring sheets.

New coverage for the band: renders when quotes exist, prints **every** quote rather than only the
first, is **absent** when they do not, leaves the page count and the Core Motivation block intact
when absent, and does not mutate the shared content library object.

`tests/lib/report_page_inventory.js` — comments only. The two literals are unchanged and stay
hand-maintained: they are page counts, not type lists, and do not move as types change bucket.

---

## 6. Comes due when the remaining five types land

1. **Delete both pilot lists** and make sheets 6-7 unconditional, rather than extending lists that
   name every type. Both files flag this.
2. **Retire the non-pilot test block.** With all nine authored there is no non-pilot type, and the
   block fires `'v3: no non-pilot type left — retire this block when all nine are authored'`. That
   is intentional signalling, but it is a **failure**, not a warning.
3. **Retire `client_v3: { 'v3-page': 7 }`** from `PAGE_INVENTORY` — no type will match it.
4. **Close design spec §7.2** on the Type 9 practice bullets, which are still not locked.

---

## 7. Verification

```
node scripts/build_content_library.js     # HARD GATE GREEN
node scripts/verify_content_library.js    # ALL PASSED
node tests/report_pages_test.js           # 80 passed, 0 failed
node scripts/render_client.js             # ALL PASSED — 27 v3 renders, no spill
```

The content-library rebuild is **surgical**: 0 leaves removed, and all 156 added/changed leaves are
inside `explore_v3`. Worth checking, given `docs/` records the build-source docx as lagging the
committed JSON — that staleness does not bite here because `INTERIM_EXPLORE_V3` is a script
constant, not docx-sourced, and everything else round-tripped identically.

Review PDFs: `docs/client_report_v3_TYPE_{1,4,7,9}_*_082026.pdf`.
