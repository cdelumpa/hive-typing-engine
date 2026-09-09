# PR 5 · Build B2b — Predictions, committed BEFORE building

**Branch** `pr5-buildB2b-quickref-page`. **Base** `6fff7fc` (main, clean).
**Written** 9 Sep 2026, before any file was edited. Every `§N` names a section of
`docs/audit_pr5_quickref.md` unless said otherwise.

## B0 — shape decision, made before starting

**The new core-motivation field is folded into this build, not split out.** It is small and
mechanical, nothing consumes it until the page exists, and it lands as **its own commit, proven
inert (0 render diff) before the page is written** — which gives the same "a red gate has one cause"
disambiguation a separate build would, without a merge cycle. Same pattern as B1, where the
stylesheet landed and was measured before the page existed.

**Home: `type_N.quickref_v3 = { core_motivation }`** — a new sibling object on the type row,
mirroring Build A's `subtype_<code>.quickref_v3 = { summary }` exactly.

**Not `type_N.description.core_motivation_v3`.** `type_N.description` **is** CMS-editable
(`cmsIsValidTypeKey`, `app/server.js:9941`) `[MEASURED]`, so a new leaf inside it is the
`assertOverrideShape` hazard Build A was built around. `content_overrides` is **TABLE EMPTY** on the
deploy target today `[MEASURED]`, so it would be safe *now* — and that is exactly the reasoning that
makes a key unsafe later. A new sibling cannot trip the guard at any time.

**Authoring: `INTERIM_QUICKREF_TYPE_V3`** in `scripts/build_content_library.js`, DRAFT, provenance
recorded as the B2b prompt. **I author no prose** — the nine strings are transcribed as supplied.

## B1 — content

| # | Prediction | Value | Basis |
|---|---|---|---|
| 1.1 | New leaves | **9** | one `core_motivation` per type |
| 1.2 | Total leaves after | **2121** | 2112 + 9 |
| 1.3 | `INTERIM_*` after | **805** | 796 + 9 |
| 1.4 | Word-canonical after | **1316**, unchanged | none come from Word |
| 1.5 | Type 9's new string is byte-identical to the ratified mockup `.ptxt[0]` | **yes** — the recipe check |
| 1.6 | Render diff from the content commit alone | **0 of 10** | nothing reads it until the page exists |

## B2 — the page

| # | Prediction | Value |
|---|---|---|
| 2.1 | `PAGE_INVENTORY.client_v3` | **10 → 11**, by hand |
| 2.2 | v3 document renders differing from `6fff7fc` | **10 of 10** — a page is added; expected, not a regression |
| 2.3 | `client_v3` render count | **35**, unchanged — a page per render, not more renders |
| 2.4 | Contents page prints footer **3** for a sheet that now exists | **yes** — one of the two remaining lies in that column closes |
| 2.5 | Rendered footers gain **3** | **yes** |

## B3 — C1–C4 on the page

| # | Prediction | Value |
|---|---|---|
| 3.1 | C1 both panels present on all 35 renders | **yes** — a `.map()` over a fixed-length-2 array |
| 3.2 | C2 roles carried from the data, not from template position | **yes** — label and modifier looked up **by role**, not by a ternary or an index |
| 3.3 | C3 two distinct types on all 35, including the collided render | **yes** — `typeRamp` de-duplicates while placing |
| 3.4 | C4 three-way agreement per role on all 35 | **yes** |
| 3.5 | C4 asserted over the **rendered page**, not the model | **yes** — ring nodes, ring-label nodes and panel headings parsed out of the emitted HTML |

## B4 — fit, the contingency I named

The B1 scaffold measured the full sheet at **955.23 px natural, 100.77 px headroom**, using the
mockup's copy: leading `.ptxt` 145 ch, alternate 80 ch. Both panels now take the new field, so the
**alternate grows** — for `anders_sx9` that is type 5, **80 → 155 ch** `[MEASURED]`, about +75
characters or 1–2 rendered lines at 18.75 px.

| # | Prediction | Value |
|---|---|---|
| 4.1 | Sheet 5 fits one page on all 35 renders | **yes** |
| 4.2 | Headroom on `anders_sx9` | **60–85 px** |
| 4.3 | If it overflows | reported with the measured stack; **the copy is left alone** — that is Cai's decision, not a trim |

## B5 — files

| # | Prediction | Value |
|---|---|---|
| 5.1 | Files touched | **9** |
| 5.2 | Which | `scripts/build_content_library.js`, `app/content/content_library.json` (rebuilt), `scripts/verify_content_library.js`, `app/report_prep.js`, `app/renderer.js`, `tests/lib/report_page_inventory.js`, `scripts/render_client.js`, `docs/build_pr5_buildB2b.md`, this file — plus the smoke sheet under `docs/` |
| 5.3 | `app/server.js` touched | **NO** — CMS preview is a later build |
| 5.4 | Mockup touched | **NO** — blob stays `813e871` |

## B6 — gates

Baselines are the post-B2a runs at `6fff7fc`. **Confirmed most recent**: nothing has run since.

| gate | baseline | predicted | why |
|---|---|---|---|
| `npm test` | 0.22–0.25 s | **0.22–0.45 s** | one more page in the structural test |
| `npm run verify:render` | 56.15 s | **58–64 s** | 35 renders, each one page heavier |
| `verify_diagrams.js` | 1.12–1.24 s | **1.1–1.4 s** | untouched |
| `verify_transparency.js` | 7.50–7.55 s | **7.5–8.2 s** | one more page in the scanned PDF |
| `verify_coach_baseline.js` | 2.82–2.87 s | **2.8–2.9 s** | untouched |
| `verify_content_library.js` | 0.21–0.22 s | **0.2 s** | nine more leaves |
| 6.1 | all six green | **yes** |
| 6.2 | `verify_coach_baseline` applies | **No** — the coach path is untouched and the shared field is unchanged. Off-Linux a **HALF-RESULT**. |

## Post-commit

This commit moves the head from `6fff7fc`. Every number above was fixed before it.
