# Pricing — a finalized nine-wide ranking

**8 September 2026.** Read-only; no code changed. Raised by PR 5, **not part of it**. Committed to
`pr5-build2-diagram` so it is not orphaned; it does not touch the build.

Every figure `[MEASURED]` or `[ESTIMATED]`. Production counts are `[CAI-MEASURED, n=19]`.

---

## 1. The root-cause claim — **refuted, and the refutation changes the shape**

> *"Both symptoms have one cause: `call1_ranking` is the only nine-wide field and is never
> rewritten when the ranking is finalized."*

**The statement of fact is true. The diagnosis is not.** `call1_ranking` is never rewritten — but
**nothing intends it to be the finalized ranking**, and the two faces have **different mechanisms
on different code paths**. Pricing them as one defect would buy the wrong thing.

### 1.1 There is no "finalization step" on the production path `[MEASURED]`

On **em_only — which is production** — `em_ranking` and the scalars come out of **one call**.
`app/experimental_analysis.js`'s `_SCHEMA` (`:121`) emits `confirmed_type`, `leading_candidate`,
`alternate_candidate` **and** `em_ranking` together. There is no later call to rewrite anything.

So "the final call moves the alternate" does not describe what happens. **One AI output disagrees
with itself**, and the engine keeps both halves.

### 1.2 Face 1 — the leader — is **already closed on the production path** `[MEASURED]`

`experimental_analysis.js:493-497` stamps, server-side:

```js
// v1.1 invariant: confirmed_type must equal leading_candidate.
parsed.confirmed_type = lead;
```

So `confirmed_type === leading_candidate` is **enforced**, not observed. The leading ring can only
leave `em_ranking`'s top if the AI's own `leading_candidate` disagrees with its own `em_ranking[0]`
— **0 of 19** `[CAI-MEASURED]`. And a redirect cannot occur on EM at all:
`em_report_adapter.js:98` hard-sets `redirect_from_type: null`.

**Face 1 is reachable only via the SM fallback, where a REDIRECT is a designed override** of Call
#1's coherence by stage-4 movement evidence. That is the feature working, not a stale array.

### 1.3 Face 2 — the alternate — is **not a defect. It is specified behaviour.** `[MEASURED]`

This is the finding that matters most, and it is in the EM prompt at `experimental_analysis.js:101`:

> *"Your `alternate_candidate` **must** be the type with the second-highest dimensional confidence
> score from your analytical passes **unless you can explicitly name a specific reason** — grounded
> in the dimensional evidence — why a lower-ranked type is a stronger alternate. **If you depart
> from the dimensional ranking for the alternate, state the reason in `alternate_rationale`.**"*

The 2-of-19 divergence is **the escape hatch being used as designed**, and the justification is
carried in `alternate_rationale`, which is **rendered to the coach** at `server.js:11602`.

`[JUDGMENT]` **So the two faces are not one defect. They are two designed overrides on two paths**
— stage-4 evidence overriding coherence (SM), and dimensional judgment overriding dimensional rank
(EM). Neither is staleness.

### 1.4 What the mismatch actually is

The engine deliberately separates **evidence** (nine-wide, dimensional) from **verdict** (three
scalars, judged). Cai's decision requires a figure in which **the verdict orders the evidence**.
No such field exists **because the architecture is built not to have one.**

`[JUDGMENT]` That reframes the ask: **not "rewrite `call1_ranking`" but "create a verdict-consistent
nine-wide field"** — and, first, a product question that precedes any pricing:

> **When the AI names a lower-ranked alternate for a stated reason, should the client-facing figure
> show that judgment, or the dimensional ranking it departed from?**

Today the page shows both, and they disagree. Any fix picks one. **That is Cai and Mo's call, and it
is not a display decision.**

---

## 2. Is there a derivation? **No — and Cai's reasoning is right, with one correction**

`[MEASURED]` The three candidates, and why each fails:

| Candidate | Why it fails |
|---|---|
| **Reorder the array** | The ramp fills **by score, not position** (`typeRamp`, `report_prep.js:82`, does not sort; the SVG reads `byType[i]`). Reordering changes nothing on the figure. |
| **Reassign scores** | States numbers the engine never produced. Swapping the top two scores also **inverts the gap** — a leading type at 83 promoted to 91 asserts more confidence than the engine has. |
| **Derive from `type_score_profile`** | It is the raw slider means, and `ranking_override` (`experimental_analysis.js:498`) exists precisely because the verdict can depart from it. `confirmed_type` is not its top either. |

**One correction to the reasoning, which does not change the answer.** A fourth option exists and
is *technically* free: **override `alternate_candidate` to `em_ranking[1].type`** at parse time, the
same server-side-stamp pattern already used for `confirmed_type` at `:493`. No new AI output, no new
field, no invented numbers.

**It should still be rejected, for a reason that is not about numbers**: §1.3 shows the divergence is
a *justified judgment* with a rationale the coach reads. Overriding it would discard the judgment and
**orphan `alternate_rationale`**, leaving a coach-facing sentence explaining a choice the engine no
longer reflects. `[JUDGMENT]` Cheaper, and worse.

---

## 3. Every consumer of `call1_ranking` `[MEASURED]`

| # | Consumer | File:line | Reads | Effect if `call1_ranking` became the finalized ranking |
|---|---|---|---|---|
| 1 | Coach report type chart | `report_prep.js:195` → `typeBars` | array | Chart would show verdict order. **Changes a shipped page** — caught by the coach byte-diff. |
| 2 | **`near_tie`** | `report_prep.js:96`, read at `:179`, `:282` | **`ranking[0]` / `ranking[1]` POSITIONALLY** | **Silent meaning change.** See §3.1. |
| 3 | Coach `leading_score` / `alternate_score` | `report_prep.js:180-181` | positional | Same positional dependency. |
| 4 | **Client sheet 5 heat map** | `report_prep.js:284` → `typeRamp` | array, by score | The point of the exercise. |
| 5 | Coach portal strength bars | `server.js:2493` → `:2228` | array + `.toFixed(1)` | Numerals shown to coaches would change. |
| 6 | **EM/SM comparison view** | `server.js:11506` `_emSm` | see §3.2 | **Already immune on EM rows; breaks on SM rows.** |
| 7 | Comparison bar chart | `server.js:11695` → `_emBarsHtml` | `sm.ranking` + **`em.em_ranking`** | EM side reads the **raw** field, not `call1_ranking`. Immune. |
| 8 | Beta diagnostic report | `generate_report.js:319` | array | **Dead code** (PR-F). |
| 9 | CMS preview stub | `server.js:13999` | synthetic | Would need its stub kept consistent. |
| 10 | Harness / gates | `render_client.js:400-443`, `verify_phase4_prep.js:41` | array | A7's clauses would need restating. |

### 3.1 ⚠ The consumer nobody has named: `near_tie` reads **positionally** `[MEASURED]`

```js
const nearTie = (ranking) => {
  if (!ranking || ranking.length < 2) return false;
  const leading = ranking[0].score;
  const alternate = ranking[1].score;
  return alternate >= leading * 0.95;
};
```

It takes `[0]` and `[1]` **by position and never sorts**, and `typeBars`/`typeRamp` do not sort
either. **Nothing validates that `em_ranking` arrives descending** — the schema says "ordered by EM
dimensional confidence score descending" and no code checks it. The three tracked fixtures are
sorted `[MEASURED]`; that is the only evidence there is.

`near_tie` drives the coach report's confidence callout (`renderer.js:1534`). Under a finalized
ranking, `[0]`/`[1]` would become the verdict's leading and alternate — arguably **more** correct for
that callout, but it is a **meaning change that no assertion would catch**.

### 3.2 ⚠ The consumer that needs Call #1 — and the state is more interesting than expected

Cai's suspicion is right in principle and **the code has already solved half of it**. `_emSm`
(`server.js:11506`):

```js
let ranking = Array.isArray(h.call1_ranking) ? h.call1_ranking : null;
if (ar && ar.meta && ar.meta.source === 'em_primary') {
  const c1 = ss && ss.call1Result && ss.call1Result.ranking;
  if (Array.isArray(c1)) ranking = c1;                    // the TRUE SM coherence
}
```

On **em_primary** rows it already bypasses `call1_ranking` and reads the real Call #1 coherence from
`scores_snapshot.call1Result.ranking` — **so a rewrite would not break the EM case.** But on
**sm_only / parallel** rows it still uses `h.call1_ranking` as the "SM Coherence" column, and a
rewrite **would make that column lie**.

`[JUDGMENT]` **The fix is one line — always read from `scores_snapshot` — and the pattern is already
there.** So this consumer argues for care, not for a new field. **The argument for a new field is
§1.3**: `call1_ranking` is contracted, named and prompted as the *dimensional* ranking, and three
prompts tell the AI it is engine-set and not to be second-guessed (`server.js:4638`). Overloading it
with a second meaning is what would be wrong.

---

## 4. The enumerated work, if a nine-wide verdict-consistent ranking is wanted

`[JUDGMENT]` **A new field, not a rewrite** — `final_ranking`, alongside `call1_ranking`.

| # | File | Work |
|---|---|---|
| 1 | `app/experimental_analysis.js` `_SCHEMA` `:121` | add `final_ranking`, nine entries, contracted as **ordered consistently with `leading_candidate` and `alternate_candidate`** |
| 2 | `app/experimental_analysis.js` `_SYNTHESIS` ~`:95-101` | a clause requiring the top two to be the committed scalars, beside the existing `alternate_candidate` clause. **This is the substantive prompt change** — it asks the model to re-score after committing, not merely to sort. |
| 3 | `app/experimental_analysis.js` `:492+` | **validate**, and stamp: nine entries, one per type 1-9, integer 0-100, `[0].type === leading_candidate`, `[1].type === alternate_candidate` |
| 4 | `app/experimental_analysis.js` | **fallback when malformed** — see §4.1. Load-bearing, because a client-facing figure would depend on it |
| 5 | `app/em_report_adapter.js` `:106` | carry `final_ranking` through beside `call1_ranking` |
| 6 | `app/call2_stamp.js` | SM path: derive or omit; on a REDIRECT the verdict order is known deterministically (`confirmed_type`, then `redirect_from_type`) |
| 7 | `app/report_prep.js` `:284` | client `charts.types` reads `final_ranking`; `:195` coach keeps `call1_ranking` |
| 8 | `app/report_prep.js` CLIENT_SPEC | extend `ninePerType`/`nodesFor` to the new field |
| 9 | `app/server.js:13999` | CMS stub emits it |
| 10 | `tests/fixtures/*_api_result.json` ×3 | add the field |
| 11 | `scripts/render_client.js` `:400` | the retype must permute it too, as it now does for `call1_ranking` |
| 12 | `docs/…spec_v3_0.md` §8.4 | record it — that entry currently states there is no nine-wide finalized ranking |

### 4.1 The fallback is the hard part, not the field `[JUDGMENT]`

`em_ranking` is **validated nowhere today** — no length, ordering, range or cross-check with the
scalars; the only guard is `.length` truthiness at `em_report_adapter.js:106`. That is survivable
because it feeds a coach chart. **A client-facing ramp cannot inherit that.**

Three options, in ascending cost: fall back to `call1_ranking` and accept that the figure is
occasionally verdict-inconsistent (i.e. today's behaviour, as a degraded mode); fall back and
**suppress the rings**; or fail the render, which contradicts `call2_stamp.js`'s standing decision
that a flagged record still produces a report. **The first is the only one consistent with the
engine's existing posture**, and it means the guarantee Cai wants would be "almost always", not
"always" — which is the thing the decision was written to avoid. **That tension is the real cost and
it should be settled before any of the twelve rows above.**

---

## 5. Sequencing — both pictures

**It does not have to land before step 6, and I would not hold sheet 5 for it** `[JUDGMENT]`.

**If sheet 5 ships first (recommended).** The figure is verdict-consistent on **17 of 19** stored
rows. On ~2 of 19 the ALTERNATE ring sits on the third-darkest node; on redirects (0 of 19; EM
cannot produce them) the two rings swap. **What a client sees:** their type ringed and labelled
LEADING, their alternate ringed and labelled ALTERNATE, and a shading that on those rows makes a
third type slightly darker than their alternate. **Nothing on the page is false** — the locked
caption asserts which is which, never which scored highest — and the divergence is a judgment the
coach can read the rationale for. The exposure is a client noticing and asking; the debrief is where
that is answered.

**If the ranking lands first.** Sheet 5 waits on a prompt change, a new contract, a validator, a
fallback decision and three re-cut fixtures — with the §4.1 tension unresolved, so the guarantee may
still not be absolute. **What a client sees in the interim: nothing. Sheet 5 does not ship.**

`[JUDGMENT]` **The asymmetry is the argument.** Shipping first costs a rare, non-false, explicable
inconsistency. Waiting costs the whole page, for a guarantee §4.1 suggests cannot be made absolute
anyway. And **§1.3 means this may not be a defect to fix at all** — it may be a product decision to
take, in which case the answer could be a caption, not an engine change.

---

## 6. What I would put to Cai first

1. **§1.3 — the alternate divergence is prompted, justified and coach-visible.** Is the client figure
   meant to show the *judgment* or the *dimensional ranking*? Everything else follows from that.
2. **§4.1 — the fallback.** If a malformed `final_ranking` degrades to today's behaviour, the
   guarantee is "almost always". Is that acceptable? If not, the answer is not a new field.
3. **§3.1 — `near_tie` reads positionally and nothing validates the ordering.** Worth its own card
   regardless of this decision.
