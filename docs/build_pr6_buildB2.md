# PR 6 · Build B2 — CMS editing and the publish gate for sheet 11

**Branch** `pr6-buildB2-cms-gate`, base **`c234700`** (confirmed equal to `origin/main` before
branching). Predictions committed first at **`5f6d08f`**, before any file was edited.

**Status: COMPLETE ON THE BRANCH, NOT PUSHED.** Eleven commits (this report the eleventh). Every CI
gate green locally, every prediction met, the gate watched refusing on the real renderer. Sheet 11 is
now CMS-editable, and every publish, draft save and revert of it is gated. Paused for review, as
instructed. **Read §1 first: this build connected to the production database once, unintentionally.**

## 1. ⚠ Incident: a local load of `server.js` connected to the production database

To check that the new wiring loaded, I ran `server.js` for four seconds with `app/` as the working
directory. `server.js` line 18 calls `dotenv.config({ override: true })`, which reads `.env` from the
working directory — **`app/.env`, whose `DATABASE_URL` is the production Railway database.** In those
four seconds the process:

- ran **`db.initDb()`** — `SCHEMA_SQL` and `SEED_SQL`, the idempotent boot migration production itself
  runs on every restart (`CREATE … IF NOT EXISTS` ×161, backfills written to re-run, the two founders
  `INSERT … ON CONFLICT DO NOTHING`, flag `UPDATE`s to values they already hold, a `DELETE` of two test
  coaches that no longer exist). Its effect is that of one extra production restart's database step;
- ran the new **sheet 11 boot audit**, read-only: `[sheet11-audit] ok — tightest page Type 9,
  82.87px free; 0 live sheet 11 override(s)`;
- **scheduled** the hourly event crons (`0 * * * *`), which did not fire in four seconds, and sent no
  email (`SENDGRID_API_KEY` is not set locally). No request reached any route; no CMS row was written.

I judge the effect on production to be nil, but it was a connection I did not intend and should not
have made. **What I've done:** recorded the hazard in project memory ("never load `server.js` from
`app/`"); the second load check ran from the repo root, where there is no `.env`, and the server
refused to start without an Anthropic key before touching anything. **Worth considering for PR 7:**
`override: true` makes any local run of the server a production connection by default.

The one useful by-product: the boot audit has now run once against real production data — correctly.

## 2. Your question — does the strict reader share the lenient one's fetch?

**Yes: one fetch, two failure modes. They cannot drift on anything but the error case.** Both
`loadPublishedOverrides` and the new `loadPublishedOverridesStrict` call a single `readPublished()`
in `app/content_overrides.js`: the same `SELECT`, the same row parsing (JSON, falling back to the raw
string), the same `auditShapes` warning, the same module cache. The strict one returns
`readPublished()`; the lenient one wraps it in a `try` and returns an empty `Map` on failure — silent
when the database is unreachable, logged otherwise, exactly as before. Pinned by three tests: on
success both return **the same `Map` instance** from one query; on a failed read the lenient returns
empty and the strict throws; a failure is never cached.

**The one subtlety worth knowing:** they share the cache, so the strict reader can return a Map the
lenient reader filled. That is coherent because every write invalidates the cache and Railway runs one
replica — the premise `content_overrides.js` already rests on. Note also that `db.query` catches query
errors and returns `null` (`app/db.js:1313`), so the lenient reader's empty `Map` was never only the
no-`DATABASE_URL` case: a transient error produced it too. That is the gap the strict reader closes.

## 3. Commits and files

| Commit | Step |
|---|---|
| `5f6d08f` | Predictions |
| `52b8920` | `app/devideas_rules.js` — one definition of valid sheet 11 content, shared by the build and the gate |
| `533c07b` | `loadPublishedOverridesStrict`, sharing the lenient reader's fetch |
| `db35487` | `buildClientModel({ overrides })` — optional; absent at every existing call site |
| `ceadffd` | `app/cms_devideas.js` — the gate, the preview verdict, the boot audit |
| `7f8d241` | The three write routes move to `app/cms_write.js` (B2-1); sheet 11 becomes editable, gated; boot audit and alert (D-B5, B2-2) |
| `a219665` | `tests/cms_devideas_test.js` (21), and `cms_quickref_preview_test` P1 accepting sheet 11's keys |
| `3c04348` | The gate's controls in `verify_devideas_fit.js`, through the real gate and renderer |
| `20566f6` | `overrides_check.js` measures sheet 11 before a deploy |
| `523d21a` | Design spec §6.3 — editable, and gated |
| *this commit* | Build report |

`app/server.js` changes are wiring only: two requires; `cmsIsValidTypeKey` gains `devideas_v3`;
`CMS_STATIC_FIELDS` gains the rails, lead and closing note (never the titles); field labels; a
**SHEET 11** group on the types page with the note *"Leave a box empty to remove that item; adding an
item is done in the source document. Publishing, saving a draft or reverting is refused if this type's
page would run onto a second sheet — Preview shows whether it fits"*; item headings (*Growth Strategy
N*, *Inquiry N*, *Field Experiment N*); an explicit zero word budget; one mounting line per write
route; the preview branch; `sendSheet11Alert` (the `sendErrorNotification` channel) and the boot audit
after `app.listen`, skipped when there is no `DATABASE_URL`.

## 4. C1 — pass/fail evidence

**The audit's table, reproduced through the committed gate, to the hundredth** (real renderer, real
override resolution and shape guard, 82-character name):

| Case | Verdict | Worst page |
|---|---|---|
| Type 9 unchanged | allow | 973.13 |
| Type 9 + 3 one-line items | allow | 1047.38 |
| Type 9 + 4 one-line items | **refuse** — *"Not published — Type 9 would run 1 line onto a second sheet."* | 1072.13 |
| Type 9 + 3 two-line inquiries | **refuse**, 3 lines | 1103.63 |
| An unbreakable URL on Type 3 | **refuse** — text past its column | 948.38 |
| Lead + one sentence (nine types) | allow | 994.81 |
| **The combination:** that lead after Type 9 + 3 is live | **refuse**, 1 line | 1069.06 |
| A bigger lead with a shortened Type 9 live | allow (Type 1 tightest) | 1047.88 |
| **Save draft** on that Type 9 | **refuse** — *"Not saved — saving a draft takes this edit out of live reports, and then Type 9 would run 1 line…"* | 1059.88 |
| **Revert** that Type 9 | **refuse** | 1059.88 |
| Revert the lead instead | allow | 961.13 |
| Save draft on Type 3 (not live) | allow, **no render** | — |
| An extra `note` key on an experiment | **refuse, as a shape error** — the audit's wording defect, fixed | — |
| One growth item blanked | allow — the list shrinks | 836.63 |

**In CI, 35/35** (`verify_devideas_fit.js`): B1's 19 plus **16 gate controls** through the real gate —
allowed: Type 9 unchanged, filled to the most that fits, a lead two lines longer alone, reverting the
lead, a draft save of a key not live (browser never launched); refused: one item more than fits, the
URL, the combination, a draft save and a revert that remove a live edit the page depended on
(**write never called**), a half-blank experiment, a colon in a label, an emptied list, a reshaped
experiment, a failed read and a browser that cannot start (**write never called**).

**In `npm test`, 21 new tests**, and **six of them proved red** by breaking the code under each in a
scratch copy: no lock → the lock test fails; write before the verdict → "a refusal never reaches the
database" fails; `devIdeas` reading an ungated field → coverage fails; a route mounted inline → the
mount scan fails; the titles made editable → the titles scan fails; a second writer in `app/` → the
writer scan names it.

**Coverage, measured on the real renderer:** every library field on `type_9`, `subtype_sx9` and
`static` changed in turn with its shape kept — **39 of 44 leave sheet 11 byte-identical**; the 5 that
move it are the four gated keys and `static.devideas_titles_v3`, which a scan keeps out of
`CMS_STATIC_FIELDS`.

## 5. Predictions against measurement

| # | Predicted | Measured |
|---|---|---|
| B2.1a | All reference renders byte-identical | **14 / 14** |
| B2.1b | Library byte-identical after the rules move; Build A's 13 controls 13/13 | **Both** |
| B2.1c | Other gates unchanged | **All pass**; sheet 5 unchanged |
| B2.2 | The audit's table reproduced to the hundredth | **Every row** (§4) |
| B2.3a | Coverage 39 / 44, the five movers as named | **Exactly** |
| B2.3b | The strict reader shares the lenient one's fetch | **Yes** (§2) |
| B2.4 | `npm test` rises by exactly the new tests; only P1 edited | **53 → 77** (+3 strict-reader, +21 gate and routes); P1 the only existing test edited |

## 6. Global gates

| Gate | Base | B2 |
|---|---|---|
| `npm test` | 53/53 | **77/77** |
| `npm run verify:render` | ALL PASSED · 67s | **ALL PASSED · 67s** |
| `verify_quickref_fit.js` | 19/19 | **19/19** |
| `verify_devideas_fit.js` | 19/19 · 2s | **35/35 · 17s** (each gate control launches a browser) |
| `verify_diagrams.js` · `verify_transparency.js` | pass | **pass** |
| `verify_coach_baseline.js` | pass (HTML; PDF off-Linux) | **pass** (same; CI runs the PDF half) |
| `verify_content_library.js` | 2264 / 1316 / 948 | **unchanged** |

`check_docs.py` clean on every doc this build wrote or edited.

## 7. Deviations from the plan

1. **The CI gate controls are built from measured room, not from the audit's pixel values.** The plan
   said every row of the audit's table would become an assertion. Hard-coded pixels would turn CI red
   the day the uniformity pass changes the content, so each CI control is constructed from the room
   the page has at run time (one item past what fits, a lead that fits alone but not with Type 9
   full), and a construction the content no longer permits reports as a precondition failure. The
   audit's exact table is reproduced separately, above, through the same committed gate.
2. **`defaultDeps` is exported** from `cms_devideas.js` so the controls can swap one collaborator.
3. **`overrides_check.js` was changed but not run.** It needs a database, and the only one configured
   locally is production — after §1, deliberately not.
4. **The preview renders twice for a shared key** — all nine to find the tightest, then that one at
   2× for the picture (about 1.5s). Once for a type's own key.

## 8. New risks surfaced

1. **`dotenv.config({ override: true })` in `server.js`** (§1). Any local run from `app/` is a
   production connection. Not changed here; worth a line in the PR 7 audit.
2. **The CMS editor for sheet 11 has not been seen.** The types-page card is generated by the existing
   `cmsRenderInputs` from the new headings and note, and I cannot sign in to the admin UI. The
   two-minute click-through (publish a Type 9 list four lines too long; see the refusal on the card;
   see nothing saved) is still yours — now also the first look at the card itself.
3. **A6 is still open:** saving a draft of a published field unpublishes it, on every CMS key. Sheet
   11's exposure is covered by gating draft saves; the fix is PR 7's call, as agreed.
4. **Every sheet 11 write now takes about 1s** (a browser launch plus the renders), and the server
   launches Chromium once at every boot for the audit.
5. **CMS edits to the lead, closing note or rails move the page without passing CI**, so the writing guidance in
   design spec §6.3 stops describing a live page that carries one. The gate measures the real
   page and is unaffected; the preview states the room in lines, measured.
6. **`scripts/retire_overrides.js` still deletes rows directly**, outside the gate. It is run after an
   edit is folded into the library, which CI measures; the boot audit covers the rest.
