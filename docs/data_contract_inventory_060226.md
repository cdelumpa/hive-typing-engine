# Data Contract Inventory — Nine-Type Engine vs. Target Report Contract

_Read-only discovery pass. Generated against the working tree at `~/Developer/hive-typing-engine` on 2026-06-02. No engine files were modified; this document is the only write._

---

## 1. Architecture confirmation

### Branch & working-tree state

- **Branch:** `main`, tracking `origin/typing-engine-v2` (`git status`).
- **Working tree is essentially clean** — the nine-type v2 work is **committed, not uncommitted**:
  - Modified: `.DS_Store` only.
  - Untracked: `docs/V2 Design Documents/`, `verify_6c_live.js`.
- HEAD = `eb5daa3 Step 6d: v2 fixture rewrite (sp4/sx7) + Call #2-isolation runner`. The v2 redesign lands across commits `f2b9e27` (Step 1, "retire ranking/center/CT") through `eb5daa3` (Step 6d). Relevant scoring-redesign commits:
  - `96bf527` Step 3A — "Stage 1 slider UI — replace forced-rank with 60 0-100 sliders"
  - `c44c50d` Step 3C — "AI Call #1 — post-Stage-2 reasoning call producing the frozen §6.3 contract"
  - `11241d4` Step 6 — "AI Call #2 — verdict schema, context builder, prompt"

**You are inventorying the committed working-tree version (HEAD `eb5daa3`), which is correct.**

### Nine types vs. three centers — VERDICT: **nine types**

This tree scores **nine individual types on a 0–100 coherence scale**, not three centers. Evidence:

- `app/server.js:1251` (CALL1_SYSTEM): _"SCORING — assign each of the nine types a 0-100 coherence score expressing how well the WHOLE picture fits that type."_
- `app/server.js:1297-1300` (CALL1_OUTPUT_FORMAT): a 9-entry `ranking` array of `{ "type": 1-9, "score": 0-100 }`.
- `app/public/assessment.js:827-828`: slider scoring builds a flat per-type profile (`typeProfile[t] = mean5(...)`) for all nine types — no Type→Center collapse.
- `app/public/assessment.js:803` comment: _"No center scoring, no Type->Center lookup, no [CT]"_ in the v2 Stage 1 scorer.

**Centers still appear, but only as a Stage 2 framework dimension, not as the scoring output:**
- `app/server.js:149-151` describes Body/Heart/Head as anger/shame/fear centers for the AI's reading.
- `app/server.js:1174` (CT mini-call) passes `Centers: Body=…, Heart=…, Head=…` as one of three framework signals.
- Production `main` (deployed) scores the three centers; this tree does not. Center is now a per-type _attribute_ (`type_library.json` `types[N].center`), used for `center_of_intelligence`, not a score.

Proceeding to Phase 2 — nine-type architecture confirmed.

---

## 2. The AI calls and their output contracts

There are **four** AI calls (the brief named three plus "possibly a CT mini-call"; the CT mini-call is present). All four use model `claude-sonnet-4-6`.

### Call A — Stage 0 mini-call

- Endpoint: `app/server.js:1057` `POST /api/stage0-signal`; model at `:1109`.
- Soft 2–3 candidate-type signal from the four Stage 0 open-text answers. Stored on `clients.stage0_signal`.
- Output contract (`app/server.js:1089-1101`):

```json
{
  "stage0_signal": [
    { "type": [number], "likelihood": 1, "rationale": "[one sentence in plain English]" },
    { "type": [number], "likelihood": 2, "rationale": "[one sentence in plain English]" }
  ]
}
```

### Call B — CT mini-call (counter-type adjustment)

- Endpoint: `app/server.js:1144` `POST /api/ct-adjustment`; model at `:1189`.
- Reconciles Stage 0 signal + Stage 1 scores + a CT flag into a reordered hypothesis list. Stored on `clients.ct_adjustment`.
- Output contract (`app/server.js:1180-1184`):

```json
{
  "revised_hypotheses": [n, n, n],
  "adjustment_made": true/false,
  "rationale": "one sentence in plain English about why the primary type was selected"
}
```

### Call #1 — coherence-weighted ranking of all nine types (KEYSTONE)

- Endpoint: `app/server.js:1340` `POST /api/call1`; model at `:1351`. Fires after Stage 2. Persisted to `clients.call1_result`.
- System prompt `CALL1_SYSTEM` `app/server.js:1244-1288`; output `CALL1_OUTPUT_FORMAT` `app/server.js:1295-1311`.
- **This call carries the per-type 0–100 scores.** Output contract verbatim:

```json
{
  "ranking": [
    { "type": <type number 1-9>, "score": <0-100> }
    // exactly nine entries, one per type, ordered highest score first
  ],
  "leading_candidate": <type number, equal to ranking[0].type>,
  "alternate_candidate": <type number, equal to ranking[1].type>,
  "third_candidate": <type number, equal to ranking[2].type>,
  "gap": "tight" | "medium" | "wide",
  "supporting_language": "<aligning open-response text>" | "Null",
  "stage3_mode": "standard" | "counter_type" | "none",
  "ct_pair": "SP-3" | "SX-6" | "SP-4" | "SX-1" | "SO-7" | "Null",
  "dominant_instinct": "SP" | "SO" | "SX"
}
```

- Server post-processing: `gap` is **re-derived in code** from the arithmetic of the top two scores (`app/server.js:1366-1368`: `tight` if diff ≤10, `wide` if >25, else `medium`) — the model's own `gap` label is overwritten. `stage3_mode`/`ct_pair` are coerced to `standard`/`Null` unless the CT key's base type and instinct match (`app/server.js:1374-1381`).

### Call #2 — final verdict + both report registers

- Triggered by `POST /api/submit` → `runBackgroundJob` → `callClaudeWithRetry` (`app/server.js:1009-1051`, `:907-939`). Model `claude-sonnet-4-6` (`:867`/`:1109` call sites; system = `SYSTEM_PROMPT` + `TASK_INSTRUCTIONS`, user = context + `OUTPUT_FORMAT`, assembled `:1011-1012`).
- `SYSTEM_PROMPT` `:136`; `TASK_INSTRUCTIONS` `:231`; `OUTPUT_FORMAT` `:484-614`.
- Output contract `hypothesis` block verbatim (`app/server.js:486-502`):

```json
{
  "hypothesis": {
    "confirmed_type": <integer 1-9 — Call #2 final verdict; may differ from leading_candidate only on a REDIRECT>,
    "confirmed_type_name": <string>,
    "confidence_level": <"HIGH" | "MEDIUM_HIGH" | "MEDIUM" | "LOW">,
    "leading_candidate": <integer 1-9 — position 1 of the AI Call #1 coherence ranking>,
    "alternate_candidate": <integer 1-9 — position 2 of the AI Call #1 coherence ranking>,
    "third_candidate": <integer 1-9 — position 3; reasoning context only, NOT shown in either report>,
    "call1_ranking": [{"type": <integer 1-9>, "score": <integer 0-100>}, ... 9 objects, rank-descending, from the AI Call #1 result],
    "type_score_profile": {"1": <0-100>, "2": <0-100>, "3": <0-100>, "4": <0-100>, "5": <0-100>, "6": <0-100>, "7": <0-100>, "8": <0-100>, "9": <0-100>},
    "instinct_score_profile": {"SP": <0-100>, "SO": <0-100>, "SX": <0-100>},
    "dominant_instinct_hypothesis": <"SP" | "SO" | "SX">,
    "ranking_override": <boolean — true when the AI Call #1 ranking departed from raw slider order (a type was promoted)>,
    "stage4_outcome": <"CONFIRMED" | "CONFIRMED_WITH_NOTE" | "AMBIGUOUS" | "REDIRECT">,
    "redirect_from_type": <integer 1-9 or null>,
    "hypothesis_validated": <boolean>
  },
  ...
}
```

Plus `flags[]` (`:503-508`), `stage0_analysis` (`:509-513`), `stage2_analysis` (`:514-519`), `stage4_analysis` (`:520-524`), `holistic_analysis` (`:525-531`), `client_facing` (`:532-540`), `coach_report` (`:541-605`), `final_response` (`:606-613`).

**Critical: the deterministic fields are stamped server-side, not trusted from the model** (`app/server.js:928-939`): `leading_candidate`, `alternate_candidate`, `third_candidate` ← Call #1; `call1_ranking` ← `c1.ranking`; `type_score_profile` ← `scores.typeProfile` (**raw sliders**); `instinct_score_profile` ← `scores.instinctProfile`; `ranking_override`, `stage4_outcome` ← payload.

### Most important single question — does any call emit per-type 0–100 scores?

**YES. Two distinct per-type 0–100 sets exist:**

| Field path | Source | Meaning | Use for nine-bar chart? |
|---|---|---|---|
| `call1.ranking[].score` → mirrored to `hypothesis.call1_ranking[].score` | AI Call #1 coherence judgment (`server.js:1297-1300`, stamped `:935`) | Whole-picture **coherence** fit, 0–100, can override sliders | **YES — this is the canonical bar-graph source.** `server.js:424`: _"the coach report shows a coherence bar graph of all nine types … rendered downstream from the `call1_ranking` field."_ |
| `hypothesis.type_score_profile["1".."9"]` | Raw Stage 1 sliders (`server.js:495`, stamped from `scores.typeProfile` `:936`; built `assessment.js:827-828`) | Conscious **self-report** mean, 0–100 | Only if page 1 wants raw self-rating, not the engine's read |

The target's `scores.types.1..9` therefore maps to **real data** — the open decision is _which_ set (coherence `call1_ranking` vs. self-report `type_score_profile`). Recommend coherence (`call1_ranking`), keyed by type, to match the engine's actual verdict. `instinct_score_profile.{SP,SO,SX}` (`server.js:496`) covers `scores.instincts` exactly.

---

## 3. Reconciliation table

Status legend: **EXACT** (same field/shape) · **RENAME** (prep-layer key rename) · **TRANSFORM** (reshape, e.g. array→keyed map) · **DERIVE** (compute from engine values) · **LIBRARY** (look up in `type_library.json`) · **MISSING** (genuinely absent; must author or escalate a new AI field).

> Note: `type_library.json` lives at **`app/type_library.json`** (not repo root as the brief stated). Per-type fields present (`types[N]`): `number, name, center, wings, stress_point, security_point, how_you_see_the_world, core_motivation, strengths, challenges, development_tips, patterns_of_thinking, patterns_of_feeling, patterns_of_behaving, instincts{sp,sx,so}, wing_low, wing_high`.

### Identity

| Target field | Engine field / source | Status | Resolution |
|---|---|---|---|
| `client.first_name` | `clients.first_name` / `intake.firstName` (`db.js:35,183`) | EXACT | direct |
| `client.full_name` | `first_name` + `last_name` (`db.js:35-36`) | DERIVE | prep-layer concat |
| `client.org` | `clients.organization` (`db.js:38`) | RENAME | `org` ← `organization` |
| `client.date` | assessment date — computed at send (`server.js:690` `new Date().toLocaleDateString`); `assessments.pdf_generated_at`/`completed_at` | DERIVE | stamp from completion timestamp at render |
| `coach.full_name` | `coaches.name` (`db.js:530` `co.name`) | RENAME | `full_name` ← `name` |
| `coach.type` | — no column on `coaches` (`db.js:21-30`) | MISSING | escalate: add coach profile attribute |
| `coach.instinct` | — no column on `coaches` | MISSING | escalate: add coach profile attribute |

### Hypothesis

| Target field | Engine field / source | Status | Resolution |
|---|---|---|---|
| `hypothesis.leading_type` | `hypothesis.leading_candidate` (`server.js:491`) | RENAME | `leading_type` ← `leading_candidate` |
| `hypothesis.leading_type_name` | `TYPE_NAMES[leading]` / `type_library.types[N].name` (`renderer.js:31`, lib `name`) | DERIVE/LIBRARY | name lookup on leading_candidate |
| `hypothesis.subtype_name` | `SUBTYPE_NAMES[instinct-type]` (`renderer.js:37,361`); also `coach_report.section4.subtype_name` (`server.js:570`) | DERIVE | lookup on (dominant_instinct, leading) |
| `hypothesis.dominant_instinct` | `hypothesis.dominant_instinct_hypothesis` (`server.js:497`) | RENAME | `dominant_instinct` ← `dominant_instinct_hypothesis` |
| `hypothesis.alternate_type` | `hypothesis.alternate_candidate` (`server.js:492`) | RENAME | `alternate_type` ← `alternate_candidate` |
| `hypothesis.alternate_type_name` | name lookup on `alternate_candidate` | DERIVE/LIBRARY | as leading_type_name |
| `hypothesis.confidence_level` | `hypothesis.confidence_level` (`server.js:490`) | EXACT | direct (HIGH/MEDIUM_HIGH/MEDIUM/LOW) |
| `hypothesis.gap` | Call #1 `gap` is a **label** (tight/medium/wide, `server.js:1304`); numeric diff available from `call1_ranking[0].score - [1].score` | TRANSFORM/DERIVE | compute numeric points from top-two coherence scores |
| `hypothesis.near_tie` | not emitted; derivable from gap | DERIVE | `near_tie = (gap label === "tight")` or numeric ≤ threshold |
| `hypothesis.confidence_level` | (dup of above) | EXACT | — |

### At-a-glance

| Target field | Engine field / source | Status | Resolution |
|---|---|---|---|
| `wings` (two) | `type_library.types[N].wings` (e.g. `[8,1]`); also `wing_low`/`wing_high` | LIBRARY | lookup on confirmed/leading type |
| `active_wing` | not emitted by any call | MISSING | escalate-new AI field OR DERIVE from wing slider scores (none currently captured per-wing) |
| `stress_point` | `type_library.types[N].stress_point` | LIBRARY | lookup |
| `release_point` | `type_library.types[N].security_point` | LIBRARY+RENAME | `release_point` ← `security_point` |
| `center_of_intelligence` | `type_library.types[N].center` (Body/Heart/Head) | LIBRARY/DERIVE | lookup on confirmed type — **not emitted by any call** |

### Scores

| Target field | Engine field / source | Status | Resolution |
|---|---|---|---|
| `scores.types.1..9` (ints) | `hypothesis.call1_ranking[].score` (coherence) OR `hypothesis.type_score_profile["1".."9"]` (sliders) | TRANSFORM / EXACT | **present, not missing.** Coherence: array→keyed map. Self-report: already keyed (EXACT). Decision below. |
| `scores.instincts.SP/SO/SX` | `hypothesis.instinct_score_profile.{SP,SO,SX}` (`server.js:496`) | EXACT | direct |

### Page 1

| Target field | Engine field / source | Status | Resolution |
|---|---|---|---|
| `bottom_line` | nearest = `client_facing.client_narrative` (3–4 sentences, `server.js:533`) — wrong length/register | MISSING | escalate-new AI field (one-line "bottom line") OR derive a lead sentence from `client_narrative` |
| `responses_revealed[]` (≤6, each `bold_lead`+`body`) | no structured array; nearest client = `client_facing.core_motivation_evidence` prose (`server.js:534`); coach = `coach_report.section2.what_responses_showed[]` bullets (`server.js:553`) | MISSING | escalate-new structured AI field (client register), or transform coach bullets |

### Page 2

| Target field | Engine field / source | Status | Resolution |
|---|---|---|---|
| `comparison.note` | nearest = `coach_report.section6.pushes_back.key_distinction` (`server.js:592`) | MISSING/TRANSFORM | escalate-new AI field, or reuse key_distinction |
| `comparison.rows.core_motivation.{leading,alternate}` | `type_library.types[N].core_motivation` (array) | LIBRARY | lookup per type (by type, not pair) |
| `comparison.rows.focus.{leading,alternate}` | **absent** from `type_library.json` (grep: no `focus`) | LIBRARY-MISSING | **author `focus` per type in type_library.json** |
| `comparison.rows.energy.{leading,alternate}` | **absent** from `type_library.json` (grep: no `energy`) | LIBRARY-MISSING | **author `energy` per type in type_library.json** |
| `comparison.rows.gifts.{leading,alternate}` | `type_library.types[N].strengths` (array len 3) | LIBRARY+RENAME | `gifts` ← `strengths` |
| `comparison.rows.challenges.{leading,alternate}` | `type_library.types[N].challenges` (array) | LIBRARY | lookup |
| `comparison.rows.discriminator.{leading,alternate}` | not in library; nearest = `section6.pushes_back.key_distinction` (single, not per-side) | MISSING | author per-pair library OR escalate AI field |
| `comparison.client_words.leading[]` | open-response text in `responses_snapshot` (`stage0.q1-q4`, `stage1.typeOpen`, `stage1.instinctOpen` — `app.js:170,194-195`); Call #1 `supporting_language` aligns to **third** candidate only (`server.js:1305`) | TRANSFORM/MISSING | escalate AI field that quotes leading-aligned client language, or hand-curate from responses_snapshot |
| `comparison.client_words.alternate_absence` | not emitted | MISSING | escalate-new AI field |
| `clarification_questions[]` (6 + `dimension`) | `client_facing.what_to_explore[]` (3 only, `server.js:539`); bespoke per-pair Stage 3 questions exist (`assessment.js:463-492`) | MISSING/TRANSFORM | fixed-by-pair library (preferred) or escalate AI field; needs `dimension` tag |

### Page 3

| Target field | Engine field / source | Status | Resolution |
|---|---|---|---|
| `debrief.subtype.{question,bullets[]}` | `coach_report.section4` (`subtype_name`, `how_instinct_shapes[]`, `easy_to_miss[]`, `probe` — `server.js:570-574`) | TRANSFORM | reshape section4 into {question=probe, bullets} |
| `debrief.lines.{question,bullets[]}` | `coach_report.section5` stress/security (`stress_notes[]`, `security_notes[]`, probes — `server.js:577-580`) | TRANSFORM | reshape section5 movement bullets |
| `debrief.wings.{question,bullets[]}` | `coach_report.section5.wings_notes[]` + `probe` (`server.js:581-582`) | TRANSFORM | reshape wings bullets |

---

## 4. MISSING list (with recommendation)

1. `coach.type` — escalate: add a type attribute to the coach profile (`coaches` table / coach record).
2. `coach.instinct` — escalate: add an instinct attribute to the coach profile.
3. `active_wing` — escalate or derive: no per-wing score is captured today; either add an AI field or capture wing sliders.
4. `bottom_line` — escalate-new: a one-line client-facing summary; or derive a lead sentence from `client_narrative`.
5. `responses_revealed[]` — escalate-new: structured client-facing array (`bold_lead`+`body`, ≤6); coach analog exists as `section2.what_responses_showed` bullets.
6. `comparison.note` — reuse `section6.pushes_back.key_distinction` or escalate-new.
7. `comparison.rows.focus` (per type) — **author in `type_library.json`** (LIBRARY gap).
8. `comparison.rows.energy` (per type) — **author in `type_library.json`** (LIBRARY gap).
9. `comparison.rows.discriminator` (per side) — author per-pair library or escalate AI field.
10. `comparison.client_words.leading[]` — escalate AI field (leading-aligned quotes) or hand-curate from `responses_snapshot`.
11. `comparison.client_words.alternate_absence` — escalate-new AI field.
12. `clarification_questions[]` (6 + `dimension`) — fixed-by-pair library (Stage 3 bespoke pairs exist) or escalate AI field; only 3 (`what_to_explore`) exist now.

---

## 5. Decisions surfaced

| # | Decision | What the code says | Recommendation / flag |
|---|---|---|---|
| D1 | **near-tie threshold** | Call #1 `gap` is derived in code: `tight` if top-two coherence diff ≤10, `wide` if >25, else `medium` (`server.js:1366-1368`). The retired slider scorer used `HIGH_AMBIGUITY_MARGIN = 8` (`assessment.js:293`). | The brief's "≤2 pts" is the wrong scale (that's neither slider nor coherence). **Recommend `near_tie = (gap === "tight")`, i.e. ≤10 coherence points.** Flag for Cai/Mo to confirm the threshold. |
| D2 | **comparison rows: library-by-pair vs. AI** | `core_motivation`, `strengths` (gifts), `challenges` exist per-type in `type_library.json`; `focus`, `energy`, `discriminator` do not. | **Library-by-type** for the three that exist (deterministic, stable). `focus`/`energy` must be **authored per type** (9 entries each). `discriminator` is genuinely per-pair — author a small pair library or escalate to AI. |
| D3 | **clarification questions: fixed-by-pair vs. AI** | Bespoke per-pair Stage 3 questions already exist (`assessment.js:463-492`, 26 pairs). AI emits only 3 `what_to_explore`. Target wants 6 + `dimension`. | **Fixed-by-pair library** is the cheaper, more controllable path; needs a `dimension` tag added and expansion to 6. Flag whether Cai wants AI-generated instead. |
| D4 | **center_of_intelligence: emitted vs. derive** | Not emitted by any call. `type_library.types[N].center` exists (Body/Heart/Head). | **DERIVE** via library lookup on confirmed type. No new AI field needed. |
| D5 | **near_tie: emitted vs. derive-from-gap** | Not emitted. `gap` label is available. | **DERIVE** from `gap` (see D1). |
| D6 | **field holding open-response text for "in client's words"** | `responses_snapshot.stage0.{q1..q4}` and `responses_snapshot.stage1.{typeOpen,instinctOpen}` (`app.js:170,194-195`; column `clients.responses_snapshot` `db.js:86`). Call #1 `supporting_language` aligns to the **third** candidate only — not usable for leading/alternate. | Use `responses_snapshot` as the source; needs an AI/curation step to select leading-aligned vs. alternate-absent fragments. Flag. |
| D7 | **debrief bullets: AI vs. template-by-subtype** | `coach_report.section4`/`section5` are **AI-emitted** bullets (`server.js:570-582`). | Reuse the AI bullets (reshape into `{question,bullets}`). Flag if Cai prefers a deterministic template-by-subtype instead. |
| D8 | **does `type_library.json` need `focus`/`energy` authored per type?** | grep for `focus`/`energy` in `type_library.json` → **none**. | **YES — both must be authored for all 9 types** before page 2 comparison rows can render. |

---

## 6. Notes & surprises

- **Two competing per-type 0–100 sets.** `hypothesis.call1_ranking` (coherence, the engine's actual judgment) and `hypothesis.type_score_profile` (raw self-report sliders) are both 0–100 and both nine-wide. They will frequently **disagree** (Call #1 exists precisely to override the sliders — `server.js:1249`). The §9.4 coach bar graph is wired to `call1_ranking` (`server.js:424`). Page 1's chart must pick deliberately; defaulting to sliders would contradict the engine's verdict.
- **`gap` is a label, not a number, in the frozen contract.** Call #1 emits `"tight"|"medium"|"wide"` and the server re-derives even that from arithmetic (`server.js:1366-1368`). A numeric `gap` for the target must be recomputed from `call1_ranking` top-two scores. The model's raw `gap` is intentionally discarded.
- **`confirmed_*` vs. `leading_*` divergence.** `confirmed_type` (Call #2 verdict) equals `leading_candidate` _except on a REDIRECT_ (`server.js:488,330`). The target's `hypothesis.leading_type` should map to `leading_candidate`; the report's headline type is `confirmed_type`. Confirm which the page-1 hero uses.
- **`renderer.js` reads `h.confirmed_instinct`** (`renderer.js:121,356,452`) but Call #2 emits `dominant_instinct_hypothesis` and the server stamping block (`server.js:928-939`) does **not** set `confirmed_instinct` on the result object — only the DB write mirrors `dominant_instinct_hypothesis` into the legacy `confirmed_instinct` column (`db.js:201-213`). **UNCERTAIN** whether the in-memory `result.hypothesis.confirmed_instinct` is ever populated for the current renderer path (checked `server.js:928-939`, `renderer.js:121`); the new report's prep layer should read `dominant_instinct_hypothesis` directly, not `confirmed_instinct`.
- **Fields emitted but unused by the target:** `third_candidate` (reasoning-only, never shown — `server.js:493,424`), `supporting_language` (third-candidate alignment), most of `holistic_analysis`, `final_response`, `stage2_analysis.object_relations_result`. These are available if a row ever needs them.
- **`type_library.json` is at `app/type_library.json`**, not repo root — the brief's path was off. All library lookups resolve there.
- **No Call #1 ↔ Call #2 shape disagreement** on the per-type scores: Call #2's `call1_ranking` is server-stamped directly from `call1.ranking` (`server.js:935`), so they are identical by construction; the model is not trusted to restate them.

---

## Terminal summary

This working tree (branch `main`, committed HEAD `eb5daa3`, tracking `origin/typing-engine-v2`) **scores nine individual types on a 0–100 coherence scale, not three centers** — confirmed by `CALL1_SYSTEM` scoring instructions (`server.js:1251`) and the nine-entry `ranking` contract (`server.js:1297-1300`); centers survive only as a per-type attribute and a Stage 2 framework signal. **Per-type 0–100 scores exist and are real:** the canonical set is `hypothesis.call1_ranking[].score` (AI Call #1 coherence, mirrored from `call1.ranking`, and the documented source of the §9.4 nine-bar graph), with a second self-report set in `hypothesis.type_score_profile["1".."9"]`; `scores.instincts` maps exactly to `instinct_score_profile`. Of ~55 target fields, roughly **half resolve cheaply (EXACT/RENAME/LIBRARY-by-lookup/DERIVE)** — identity, hypothesis names, at-a-glance (wings/stress/release/center all library-derivable), both score blocks, and the page-3 debrief (reshape of `coach_report` sections) — while **~12 are MISSING** and split between two authoring buckets: **library authoring** (`focus` + `energy` per type, plus a per-pair `discriminator`) and **new AI/escalation fields** (`bottom_line`, `responses_revealed[]`, `comparison.note`, `comparison.client_words`, an expanded 6-item `clarification_questions`, and `coach.type`/`coach.instinct` profile attributes). The **top three decisions needing Cai/Mo input**: (1) which nine-bar source to chart — coherence `call1_ranking` (recommended) vs. self-report sliders; (2) confirm the **near-tie threshold** (recommend `gap === "tight"`, i.e. ≤10 coherence pts — the brief's "≤2 pts" is the wrong scale); (3) author **`focus`/`energy` per type** in `type_library.json` (both confirmed absent) and decide whether the page-2 `discriminator` and 6 `clarification_questions` are fixed-by-pair libraries or AI-generated.
