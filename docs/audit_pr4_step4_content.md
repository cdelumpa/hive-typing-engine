# Audit — PR 4 step 4, the content build (Z3 + SO7)

**Branch:** `pr-4-step4-content-audit`, off `main` @
`8377cab292cc5478b5217e7676b6e43ec5983b09` (`8377cab` — "Merge pull request #88"), pulled and
confirmed 7 Sep 2026. **Main has not moved** since step 3 merged. [CC-MEASURED]

**Nature:** audit. No store change, no builder change, no gate change, no renderer.

Tags: **[CC-MEASURED]** read out of the repo or executed · **[CC-DERIVED]** arithmetic on measured
values · **[CC-JUDGMENT]** my read.

**Verdict in one line:** half A is straightforward and half B is not — **option (ii) is a live-path
hazard I was able to reproduce**, and the CMS deferral does transfer but for a different reason
than at step 1.

---

## 1. §2 — the Doc diff, all 81 leaves

Re-read the subtypes Doc **by ID** and re-parsed with the committed parser
(`scripts/spike/parse_subtype_narratives.js --diff`). [CC-MEASURED]

```
document order: SP8 SO8 SX8 SP9 SO9 SX9 SP1 SO1 SX1 SP2 SO2 SX2 SP3 SO3 SX3
                SP4 SO4 SX4 SP5 SO5 SX5 SP6 SO6 SX6 SP7 SO7 SX7
header formatting: 15 bold, 12 plain
recount vs stated: all 27 EXACT
diff against app/content/content_library.json: 80/81 leaves identical
```

**The only delta is `SO7.narrative`, 389 → 373.** Stated explicitly rather than left implied: all
27 naranjo values are unchanged, all 27 signatures are unchanged, and 26 of the 27 narratives are
unchanged. Nothing else moved in the hand edit. [CC-MEASURED]

Supporting measurements:

- All 27 of the Doc's own stated character counts are **exact**, including SO7's new 373 — so the
  Doc is internally consistent after the edit, not just changed.
- Narrative statistics move exactly as one row losing 16 characters predicts: **mean 382.7 →
  382.1**, min 360, max 394, spread 34 all unchanged. [CC-MEASURED] 16 ÷ 27 = 0.59. [CC-DERIVED]
- The type-7 `Spread:` line moved 6 → 16, consistent with SP7 389 and SO7 373. [CC-MEASURED]

**And the string is the one step 3 measured.** The Doc's SO7 narrative is **byte-identical** to
`SO7_REVISED` in `scripts/spike/p10_fit_probe.js`. [CC-MEASURED] That matters: it means the
measurements in `docs/p10_fit_results.md` — 12 → 11 lines, 315.20 → 297.81px, last-line fill 21.3%
→ 51.5% — apply to exactly the string being ingested, not to a near variant of it.

### Half A is straightforward, and here is why

`subtype_so7.instincts_v3.narrative` is already v3-only, added at step 1. It has no v2 consumer, no
`cmsPreviewSpec` mapping, and is not in `CMS_SUBTYPE_FIELDS` (option (ii) held those back). So the
change is: edit one string in `INTERIM_INSTINCTS_V3`, rebuild, commit. The existing
`validateSubtype` assertion already requires the leaf non-empty and needs no amendment.
[CC-MEASURED] **Nothing about half A is unexpected.**

### Section B recount

The three Section B strings from the new Doc (`15W55J9eYkwDn9WPLYXW-…`), recounted on the stated
basis: **157 / 150 / 156 — all three exact**, min 150 · max 157 · spread 7 · mean 154.3, matching
the Doc's own figures. [CC-MEASURED] They are also **byte-identical to the `Z3_NEW` strings step 3
rendered**, so the 53.50px recovery figure applies to exactly these. [CC-MEASURED]

---

## 2. §3 — the field shape

### Option (ii) is not merely worse; I reproduced its failure

Adding a `body_v3` leaf to the three existing `instinct_definitions` entries **changes the shape of
a field that is CMS-editable with a live preview**. `overrideShape` enumerates leaf paths and
`assertOverrideShape` throws when the published override is missing any of them. Executed against
the real library: [CC-MEASURED]

```
Published content override "static.instinct_definitions" no longer matches the content
library's shape.
  missing from the override: [].body_v3
  library shape:  [].body · [].body_v3 · [].code · [].name
```

That is not hypothetical, and the codebase already records it happening: the comment at
`content_overrides.js:100–107` documents the June `static.welcome` row predating the `signoff` key,
which rendered the literal word "undefined" on a live page. **Option (ii) sets up the same
mechanism on a field that has a working CMS editor pointed at it.** And per the deploy-order
warning at `:117`, the throw reaches *"EVERY report render, including the dry-validate probe in
`/api/submit`"* — i.e. a mismatched row fails assessment submission. [CC-MEASURED]

The same check against option (i) is clean: `static.instinct_definitions`'s shape is untouched, so
any existing override still matches and nothing throws. [CC-MEASURED]

**Option (ii) is rejected on a measured live-path failure, not on preference.**

### Proposed: (i), a parallel top-level array — `static.instinct_definitions_v3`

Shape mirrors v2 exactly — 3 × `{code, name, body}`.

**Why mirror rather than carry only the bodies.** Step 5's renderer needs the card heading (`SP` +
`Self-Preservation`, unchanged) and the new body. If the v3 array held bodies alone, p10 would join
two arrays by index to build one card — a join with nothing enforcing that index 0 is SP in both.
Mirroring lets p10 read one array and never touch the v2 one. The six duplicated leaves are the
price, and they are **checkable**: a build assertion requiring `_v3[i].code === instinct_definitions[i].code`
and the same for `name` makes drift impossible rather than merely unlikely. [CC-JUDGMENT]

### Does the `_v3` suffix convention still apply, or does it strain?

It strains in one specific way, and it survives. Every existing `_v3` key sits **on a type or
subtype row**: `<row>.wings.intro_v3`, `<row>.lines.work_v3`, `<row>.explore_v3`,
`<row>.instincts_v3`. **There is no `static.*_v3` key today; this would be the first.**
[CC-MEASURED]

But the convention's *content* is "a v3 field beside its v2 counterpart on the same parent", and
that is exactly what `static.instinct_definitions_v3` is — the parent is `static` instead of a row.
The relationship a reader needs to see is *"this exists so the one next to it is not edited"*, and
sitting beside it is what makes that legible. [CC-JUDGMENT]

**The alternative I considered and did not propose:** a page-scoped namespace,
`static.instincts_v3 = { definitions, primer }`, following `explore_v3: {p6, p7}`. It anticipates
Z2 needing the same treatment (§4 below establishes that it will). I rejected it because **Section A
is undecided**, and creating a slot for a preamble nobody has approved is inventing schema for a
page that is not being built — the objection I raised against `p10_*` keys at step 1. If Z2 later
lands as `static.instinct_primer_v3`, two flat `_v3` siblings beside their two v2 counterparts is
*more* consistent than one namespace holding both, not less. [CC-JUDGMENT]

### The six touchpoints, priced

| # | Touchpoint | Option (i) — proposed | Option (ii) — rejected |
|---|---|---|---|
| 1 | `renderer.js:2252` (live v2 p6) | **No change.** It reads `i.instinct_definitions` and destructures `.name/.code/.body`; a new top-level key is invisible to it. [CC-MEASURED] | No change *at render* — it also ignores `body_v3` — but the field it reads has changed shape, which is where the throw comes from |
| 2 | Page inventory test | **No change.** `report_page_inventory.js:22` counts `.p6-page` elements; it asserts nothing about content. [CC-MEASURED] | No change |
| 3 | `CMS_STATIC_FIELDS` (`server.js:9866`) | **No change at step 4** — see §5. Adding the key is what would make it editable, and that is deferred | Nothing to add: the key is still `static.instinct_definitions`, so the CMS would edit v2 and v3 **under one key**, and `resolveLibObject` replaces a field whole |
| 4 | `cmsPreviewSpec` (`server.js:13850`) | **No change at step 4.** The existing `.p6-page` mapping is for the v2 field and stays correct | Existing mapping now previews a field that also carries v3 content, on a page that renders only the v2 half |
| 5 | `cmsWordBudget` (`server.js:10018`) | **No change at step 4.** Returns 0 for an unrecognised key, and there is no editor to show it in | The existing `/^\d+\.body$/ → 45` branch would not match `body_v3`, so the new leaf shows no budget |
| 6 | Build hard gate (`build_content_library.js:1994`) | **Sibling assertion** — see §3 | The existing `length === 3` still passes; nothing new is enforced unless a separate assertion is added |

Plus two the prompt did not list, both real:

- **`verify_content_library.js` `SCRIPT_SOURCED`** needs an entry. The three strings are not in the
  docx — they are in a Google Doc — so they arrive from an `INTERIM_*` constant, exactly like
  `INTERIM_INSTINCTS_V3`. **9 leaves** (3 × `{code, name, body}`). The table is printed, not
  asserted, so omitting it does not fail CI; it silently understates the Word-canonical
  denominator. [CC-MEASURED, from step 1]
- **`resolveLibObject(overrides, 'static', …)`** (`report_prep.js:220`) iterates `Object.keys` of
  the static object, so a new key resolves overrides automatically with no change. [CC-MEASURED]

---

## 3. §4 — the "exactly 3" gate

**The existing gate holds unchanged and must not be touched.**
`build_content_library.js:1994` reads:

```js
need(Array.isArray(S.instinct_definitions) && S.instinct_definitions.length === 3,
     `static.instinct_definitions != 3 (…)`);
```

It names the v2 key explicitly, so a new sibling key is invisible to it. [CC-MEASURED]

**It needs a sibling, not a rewrite.** Proposed:

```js
need(Array.isArray(S.instinct_definitions_v3) && S.instinct_definitions_v3.length === 3,
     `static.instinct_definitions_v3 != 3 (…)`);
for (let i = 0; i < 3; i++) {
  const d = S.instinct_definitions_v3[i];
  need(d && d.code && d.name && d.body, `static.instinct_definitions_v3[${i}] incomplete`);
  // The duplicated heading fields are the price of p10 reading one array; this is what
  // stops them drifting from the live ones they mirror.
  need(d.code === S.instinct_definitions[i].code, `static.instinct_definitions_v3[${i}].code != v2`);
  need(d.name === S.instinct_definitions[i].name, `static.instinct_definitions_v3[${i}].name != v2`);
}
```

That gives a missing v3 string the same treatment a missing `instincts_v3` leaf gets: the build
exits 1 and names the field. As at step 1, **each new assertion must be proven to fail before it is
trusted** — in memory, touching no tracked file — with a green control first. [CC-JUDGMENT]

**One nuance worth stating.** `static.*` is gated in two places: the loop at `:1986`
(`need(S[k], …)` for four named keys) and the explicit `length === 3` at `:1994`. The new key
belongs with the second, not the first — the first is a non-empty check for scalar strings.
[CC-MEASURED]

---

## 4. §5 — does the CMS deferral transfer? **Yes, and for a stronger reason**

Verified rather than inherited, and the step-1 reasoning does **not** transfer as-is.

**At step 1 the argument was:** `assertOverrideShape` throws on a live path, so do not expose
`instincts_v3` in the CMS before its shape is final. That argument is *weaker* here, because under
option (i) `static.instinct_definitions_v3`'s shape is final on the day it lands — 3 ×
`{code, name, body}`, mirroring a v2 field that has not changed shape in the project's history.

**The argument that does apply is the preview one, and it is worse than at step 1.**
`cmsIsValidStaticKey` gates on membership of `CMS_STATIC_FIELDS`, so the key is simply rejected by
the write routes until it is added. [CC-MEASURED] If it *were* added at step 4:

- `cmsPreviewSpec` has no mapping for it, so `POST /admin/content/preview` returns
  `400 {ok:false, error:'no preview mapping for key'}`. [CC-MEASURED] Same as `instincts_v3`.
- **And it cannot borrow the v2 mapping.** The prompt is right that `instinct_definitions` has a
  *working* `.p6-page` mapping where `instincts_v3` had none — but that mapping applies
  `m.pages.instinct_subtype.instinct_definitions = v`, and `renderer.js:2252` renders **that** key.
  Pointing a v3 field at it would render the v2 field with the v3 value, i.e. preview the new text
  on the page it is explicitly not for. [CC-MEASURED]
- So the honest options at step 4 are a 400 or a **misleading green preview**. A misleading preview
  is worse than an error: an editor would see their p10 text appear on p6 and conclude it had
  landed correctly. [CC-JUDGMENT]

**Recommendation: defer all CMS work to step 5 or later**, when a v3 page exists to preview against.
Step 4 ships content plus the build gate. Nothing touches `app/server.js`.

**What changes at step 5, recorded now:** the existing `static.instinct_definitions` CMS entry
becomes ambiguous — an editor sees "Instinct Definitions · P6" and has no way to know a second,
p10-only copy exists. That is a labelling problem, not a correctness one, and it belongs with the
renderer work. Own card if step 5 does not absorb it.

---

## 5. §6 — the two report-only items

### 6a. `static.instinct_primer` **is live v2 content**, confirmed — same treatment required

[CC-MEASURED]

| Consumer | What it does |
|---|---|
| `renderer.js:2284` | `.p6-about-body` under "ABOUT THE INSTINCTS", inside `_clP6Instinct` — the **live v2 p6 page** |
| `report_prep.js:373` | into the shared model as `pages.instinct_subtype.instinct_primer` |
| `server.js:9866` | in `CMS_STATIC_FIELDS` — **editable** |
| `server.js:13849` | `cmsPreviewSpec` → `.p6-page` — a **working preview** |
| `server.js:10017` | `cmsWordBudget` → 75 |
| `build_content_library.js:1986` | non-empty hard gate |
| `verify_phase4_prep.js:64` | asserts it is populated |

**So the Doc's caution is correct and is now verified.** If Section A's preamble is ever edited it
needs the identical treatment: a v3-only field, not an edit in place.

**One false positive worth naming so nobody re-derives it.** `renderer.js:285` reads
`(primers.instinct_primer || {}).body`, which looks like a consumer and is not: `primers` is
`typeLibrary.static_primers` (`renderer.js:127`), a different object on a different source.
`static.instinct_primer` is a bare 330-character string with no `.body`. [CC-MEASURED]

**Report only. Nothing changed.**

### 6b. Nothing asserts the band, a character count, or a length on any `instincts_v3` field

**No.** [CC-MEASURED] Searched `app/`, `scripts/` and `tests/`:

- No assertion references 345 or 415. The only hits are an SVG path with coincidental digits
  (`renderer.js:1968`), two spec-builder line references, and a comment in my own probe.
- No length, budget, `max`, `min` or `chars` assertion names `instincts_v3` anywhere.
- `validateSubtype` requires the three leaves **non-empty** and asserts nothing about their size.

**So SO7 going 389 → 373 trips nothing**, and that is measured rather than assumed. The corollary
is worth stating too: **nothing would have caught it going the other way either.** The band is a
working standard held by people, not by the build.

---

## 6. Step-4 scope statement

**Purpose.** Move two pieces of settled content into the store. No page, no renderer, no layout.

**Files touched**
- `scripts/build_content_library.js` — one edited string in `INTERIM_INSTINCTS_V3`; a new
  `INTERIM_INSTINCT_DEFS_V3` constant; the merge; the sibling gate.
- `app/content/content_library.json` — regenerated, never hand-edited.
- `scripts/verify_content_library.js` — one `SCRIPT_SOURCED` entry, 9 leaves.
- **Nothing else.** No `app/server.js`, no renderer, no test file.

**A — SO7.** Replace the narrative in `INTERIM_INSTINCTS_V3.SO7`, 389 → 373. Recount at ingest. The
other 80 leaves are unchanged and the build's own diff should say so.

**B — the three instinct descriptions.** New `static.instinct_definitions_v3`, 3 × `{code, name,
body}`, from an `INTERIM_INSTINCT_DEFS_V3` constant. `static.instinct_definitions` is **not
touched** — the constant's comment must carry why, naming `renderer.js:2252` and the live `.p6-page`.

**Gate.** Existing `length === 3` unchanged; add the sibling plus the code/name mirror assertions
(§3). Every new assertion proven to fail first, against a green control, in memory.

**Done when**
1. The Doc diff is 81/81 identical after the build — the parser's `--diff` is the check, and it
   already exists.
2. `static.instinct_definitions` is byte-identical to `8377cab`; `static.instinct_definitions_v3`
   holds 157/150/156 recounted.
3. The library diff is **purely additive** apart from the single SO7 string: 9 leaves added, 1
   changed, 0 removed.
4. `content:check` green with the new `SCRIPT_SOURCED` entry, and Word-canonical unchanged.
5. `verify:render`, coach baseline, `npm test` green.

**Not done when — state it in the build report**
- **No page, no renderer.** The FOCUSED ON row still renders on p10 because p10 does not exist; the
  "In Your Words" retitle is step 5.
- **No CMS.** `static.instinct_definitions_v3` is not editable and has no preview, by decision.
- **Z2 is not decided** and `static.instinct_primer` is not touched, though §5 now establishes it
  would need the same v3-only treatment.
- **The v3 descriptions do not render anywhere** after this step. They are in the store and inert,
  exactly as `instincts_v3` was between steps 1 and 5.

---

## 7. Where I think §1–§7 is wrong

**a. §3's framing of the precedent is right, and understates it.** The prompt says the `_v3`
convention "may strain" because this is a top-level static structure with a hard count gate. The
measured position is sharper: **there is no `static.*_v3` key at all today** — every one of the
eight existing `_v3` keys sits on a type or subtype row. [CC-MEASURED] So this is not a strained
application of the convention; it is the first application of it in a new location. Worth saying
plainly in the constant's comment so the next person does not think they have found an
inconsistency.

**b. §5's premise about the working preview points the other way.** The prompt asks whether
`instinct_definitions` having a working `.p6-page` mapping — which `instincts_v3` lacked — changes
the deferral answer. It does change the reasoning, and it makes deferral *more* important, not
less: the mapping's existence creates the option of pointing the v3 field at the v2 page, which
would produce a **confidently wrong** preview rather than an honest 400. [CC-JUDGMENT]

**c. Nothing else.** Half A really is straightforward; §2's diff came back exactly as hoped; and
the Doc's own hazard notice is accurate on every point I checked.

---

## 8. Open questions

### New

1. **Does `static.instinct_definitions`'s CMS card need re-labelling once a v3 copy exists?** An
   editor sees "Instinct Definitions · P6" with no indication a p10-only copy exists beside it.
   Labelling, not correctness. Step 5 or its own card. [§5]
2. **Section A (the preamble) is undecided, and the type-token question inside it is undecided
   too.** §6a now establishes that whichever way it goes, it needs a v3-only field. Not step 4's
   content. [§6a]

### Carried

3. **`instinctStack` returns "Leading = SP" for a missing or empty profile** — own card, pinned by
   step 2, not fixed.
4. **`dominant_instinct_hypothesis` and `instinct_score_profile` are never reconciled** — own card,
   watch-in-beta.
5. **`CMS_PREVIEW_WORST_EVIDENCE`'s comment says "~25 words each" against measured 27/29/28** — own
   card, a `server.js` fix.
6. **How many stored assessments lack the instinct fields** — needs a production query.
7. **The Doc and `reference/hive_27_subtype_reference.md` disagree on the passion term for 18 of
   27** — own card; the ref file has no machine consumers.
8. **The 345–415 band's provenance is unestablished** — accepted knowingly. §6b now adds that
   nothing in the build enforces it either, in either direction.
9. **Mo has reviewed none of this content.** Per the standing decision it ships to beta without her
   review, trigger "CMS update complete". The new static-content Doc says so itself.
