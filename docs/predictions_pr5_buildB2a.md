# PR 5 · Build B2a — Predictions, committed BEFORE building

**Branch** `pr5-buildB2a-hypothesis-pair`. **Base** `51a85df` (main, clean).
**Written** 9 Sep 2026, before any file was edited. Every `§N` names a section of
`docs/audit_pr5_quickref.md` unless said otherwise.

**Scope.** The resolved hypothesis pair on the model, and a collision axis so the harness can
render a record whose two hypothesis scalars name the same type. **No page** — no
`_clv3QuickRef`, no `built` flag, no `PAGE_INVENTORY` bump.

## A0 — the two outcomes this build is judged on

| # | Prediction | Value |
|---|---|---|
| A0.1 | The system can carry two distinct, correctly-roled hypotheses resolved from one source | **yes** — `pages.v3_quickref.hypotheses`, two entries, both resolved from `charts.types` positions 1 and 2 |
| A0.2 | A collided record can be produced and rendered by the harness | **yes** — a `collidedFor` axis mirroring `instinctsFor` / `z6For` |
| A0.3 | On a collided record the pair's two entries are **distinct types** | **yes**, guaranteed by `typeRamp` de-duplicating while placing |
| A0.4 | On a collided record the pair's alternate **differs from `m.alternate.number`** | **yes** — that difference is the whole point; the pair follows position, `m.alternate` keeps the scalar |

## A1 — the pair

| # | Prediction | Value |
|---|---|---|
| 1.1 | Entries | **exactly 2**, always, on every record |
| 1.2 | Fields per entry | `role`, `position`, `number`, `name`, `motivation` |
| 1.3 | `hypotheses[0].number` equals `m.hero.number` on **every** record | **yes** — `typeRamp` places `heroN` at position 1 unconditionally |
| 1.4 | `hypotheses[1].number` equals `m.alternate.number` on a **non-collided** record | **yes** |
| 1.5 | …and **differs** on a collided one | **yes** — 5 against 9 on the `anders_sx9` collided case |
| 1.6 | `m.alternate` itself is unchanged anywhere | **yes** — additive only; the v2 client (`renderer.js:2285`, `:2315`) and coach (`:1785`, `:1850`) still read the scalar |

## A2 — the harness axis, and a stale assertion it will trip

**`render_client.js:441` — the A7 third clause — asserts that `call1_ranking[1].type` equals
`alternate_candidate`, on the stated grounds that otherwise "the ALTERNATE ring and the ramp
ordering would disagree."**

| # | Prediction | Value |
|---|---|---|
| 2.1 | That rationale is **stale since Build R** | **yes** — the ring now reads position, i.e. it reads the ramp ordering, so the two cannot disagree. The clause still checks something real (that the retype helper left the fixture coherent) but its stated reason is no longer true. |
| 2.2 | A collided record **violates** that clause by construction | **yes** — a collided record's `alternate_candidate` equals position 1, not position 2 |
| 2.3 | So the clause needs an explicit exemption for the collided state, with the reason recorded | **yes** |
| 2.4 | Renders before | **32** |
| 2.5 | Renders after | **35** — the collided state applies to `anders_sx9` at type 9 only, and the instinct axis multiplies it by 3 |
| 2.6 | Existing 32 renders byte-identical | **yes** — a new axis defaulting to `[null]` is byte-neutral, proved by diff |

## A3 — the 10 v3 document renders

| # | Prediction | Value |
|---|---|---|
| 3.1 | v3 renders differing from `51a85df` | **0 of 10 — byte-identical** |
| 3.2 | Why | the pair is additive model data and no builder reads it; sheet 5 has no builder |
| 3.3 | Established by | **diff, not assertion** |

## A4 — `CLIENT_SPEC` validation (§6c, my call)

| # | Prediction | Value |
|---|---|---|
| 4.1 | Included in this build | **yes**, as a **warning**, never a throw |
| 4.2 | Why warn | `call2_stamp` ships imperfect records deliberately so the client still gets a report; a fatal prep-time check would contradict that, and the C4 render assertion in B2b is the right hard gate |
| 4.3 | Warnings emitted on the tracked fixtures | **0** |

## A5 — files

| # | Prediction | Value |
|---|---|---|
| 5.1 | Files touched | **5** |
| 5.2 | Which | `app/report_prep.js`, `tests/fixtures/instinct_axis.js`, `scripts/render_client.js`, `docs/build_pr5_buildB2a.md`, this file |
| 5.3 | `app/renderer.js` touched | **NO** — no page, no builder |
| 5.4 | `tests/lib/report_page_inventory.js`, `app/server.js`, the content library, the mockup | **all untouched** |
| 5.5 | `built` set or `PAGE_INVENTORY` bumped | **NO** |

## A6 — gates

Baselines are the post-Build-R runs measured at `12a0f41`+`c2d7eb9`, which is the tree `51a85df`
carries. **Confirmed as the most recent**: nothing has run since, and `51a85df` is Build R's merge.

| gate | baseline | predicted | why |
|---|---|---|---|
| `npm test` | 0.23 / 0.42 s | **0.23–0.45 s** | a spread, not a point |
| `npm run verify:render` | 52.62 s | **56–58 s** | 32 → 35 renders at ~1.42 s each |
| `verify_diagrams.js` | 1.24 s | **1.2–1.4 s** | untouched |
| `verify_transparency.js` | 7.53 s | **7.5–7.7 s** | untouched |
| `verify_coach_baseline.js` | 2.87 s | **2.8–2.9 s** | untouched |
| `verify_content_library.js` | 0.22 s | **0.2 s** | untouched |
| 6.1 | all six green | **yes** |
| 6.2 | leaves / INTERIM / Word-canonical | **2112 / 796 / 1316**, unmoved — no content changes |
| 6.3 | `verify_coach_baseline` applies | **No.** The coach model gets no `v3_quickref` slot. Off-Linux it is a **HALF-RESULT**. |

## Post-commit

This commit moves the head from `51a85df`. Every number above was fixed before it.
