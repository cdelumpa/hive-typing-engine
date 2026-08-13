# Hive Typing Engine

The complete source-of-truth artifacts for the Hive Enneagram Typing Engine — a structured, AI-assisted self-assessment tool that produces Enneagram type hypotheses for clients who complete a multi-stage questionnaire inside the Hive app.

This repository holds the AI prompt specification, the question bank, the static content library, sample report outputs, and supporting reference material. It is the source of truth for what the engine does, what content it generates, and how the resulting reports should look.

## Repository Layout

```
hive-typing-engine/
├── spec/         AI prompt spec + technical scoring spec
├── content/      Static type library (docx source + runtime JSON)
├── questions/    Question bank for all assessment stages
├── reference/    Typing heuristics, lookalike pairs, 27-subtype reference
├── samples/      Gold-standard sample client and coach reports
└── docs/         Change summaries and integration notes
```

### `spec/` — Engine logic

| File | Purpose |
|---|---|
| `hive_ai_prompt_spec_v2_4.docx` | The complete AI prompt sent to the Claude API at the end of each client assessment. System prompt, context block, task instructions, and JSON output schema. |
| `hive_typing_engine_spec.docx` | Technical specification for the assessment scoring engine — Stage 1-4 routing logic, confidence calculations, and how the mechanical engine interfaces with the AI layer. |

### `content/` — Static type-general content

| File | Purpose |
|---|---|
| `hive_type_library_v1_1.docx` | The human-readable source of truth for all type-general content. Edit here when content needs to change. |
| `type_library.json` | The runtime artifact loaded by the rendering app. Generated from the docx; do not edit by hand. |

### `questions/` — Assessment questions

| File | Purpose |
|---|---|
| `hive_question_bank_v2_consolidated.docx` | The full question set across all four assessment stages (Stage 0 warm-up, Stage 1 Centers and Instincts, Stage 2 cross-referencing, Stage 3 pairwise discrimination). |

### `reference/` — Engine reasoning material

| File | Purpose |
|---|---|
| `hive_typing_heuristics_v1_111725.docx` | Narrative Enneagram typing heuristics that inform the engine's interpretive logic. |
| `hive_essential_lookalike_pairings_111725.docx` | Lookalike type distinctions the engine must handle. |
| `hive_27_subtype_reference.md` | Plain-text reference of all 27 subtypes (9 types × 3 instincts) with "why this can be easy to miss" guidance. Used by the coach report. |

### `samples/` — Sample report outputs

Gold-standard examples of what the engine should produce. Use these as visual references when updating the rendering app or as test fixtures when validating engine output.

| File | Purpose |
|---|---|
| `hive_client_report_SP9_expanded.html` | Client report — clean SP 9 case (high confidence). |
| `hive_coach_report_SP9_orange.html` | Coach prep report — clean SP 9 case. |
| `hive_client_report_SO7_v24.html` | Client report — SO 7 with Type 2 ambiguity (counter-type + lookalike). |
| `hive_coach_report_SO7_v24.html` | Coach prep report — same SO 7 case. |

### `docs/` — Change history and integration notes

| File | Purpose |
|---|---|
| `hive_v2_4_change_summary.docx` | Plain-English summary of everything that changed from spec v2.1 through v2.4. |
| `engine_spec_changes.md` | Original change document for the expanded client report (Task 3 changes). Now integrated into v2.4 spec; kept for historical reference. |
| `report_template_changes.md` | HTML rendering instructions for the rendering app team. |

## How the Three Layers Fit Together

The final client report is assembled from three sources:

1. **Static type-general content** (`content/type_library.json`) — same for every client of a given type.
2. **AI-generated client-specific content** — produced by the engine using the prompt in `spec/hive_ai_prompt_spec_v2_4.docx`.
3. **HTML template** — the rendering app combines static content, AI output, and template framing into the final report.

All three layers must be coordinated. Updating one without the others produces an inconsistent report.

## Versioning

Each artifact has its own version, tracked independently:

- AI prompt spec: **v2.4**
- Type library: **v1.1**
- Question bank: **v2 (consolidated)**

When changes ship as a bundle, the bundle is referred to by the spec version (currently v2.4). See `spec/CHANGELOG.md` for the spec's full version history.

## Working With This Repo

### When making content changes (type library, primers, development tips)

1. Edit `content/hive_type_library_v1_1.docx` (use track changes for review).
2. Once approved, regenerate `content/type_library.json` from the updated docx.
3. Commit both files together with a message describing the content change.
4. Bump the type library version (e.g., `v1_1` → `v1_2`).

### When making spec changes (engine logic, task instructions, JSON schema)

1. Update `spec/hive_ai_prompt_spec_v2_4.docx` (or the next version).
2. Update `spec/CHANGELOG.md` with a description of what changed and why.
3. If the change is a breaking schema change, flag it explicitly in the changelog.
4. Commit. Bump version on next release.

### When making sample/test changes

Samples in `samples/` are reference outputs. Update them whenever the spec changes in a way that affects what the engine produces. They serve as visual regression tests.

## Local dev database (PR live smoke testing)

A reusable local Postgres setup for testing PRs end-to-end without touching the
production database. `app/.env` stays pointed at prod and is never modified.

**One-time setup:**

```bash
# 1. Install + start Postgres (Homebrew)
brew install postgresql@16
brew services start postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# 2. Create the local dev database
createdb hive_typing_local

# 3. Create a git-ignored local env file at repo root (.env.* is gitignored)
cat > .env.dev.local <<'EOF'
DATABASE_URL=postgresql://<your-macos-username>@localhost:5432/hive_typing_local
NODE_ENV=development
PORT=3000
EOF
```

**Each test run:**

```bash
node scripts/dev-local.js        # boots app/server.js against the LOCAL db
                                 # (loads app/.env for non-DB keys, then overrides
                                 #  DATABASE_URL from .env.dev.local; refuses to boot
                                 #  if DATABASE_URL is not localhost). initDb() runs
                                 #  SCHEMA_SQL/SEED_SQL against the local db on boot.

node scripts/seed-smoke-users.js # seeds test users for all role combinations
                                 # (password: Smoke!test1). Idempotent.
```

Server runs at http://localhost:3000. Log in at `/admin/login` with any seeded
user (e.g. `smoke-coach@local.test`). Both scripts hard-refuse any non-local
`DATABASE_URL` as a guardrail against pointing at prod.

## Deploying a content change — READ BEFORE SHIPPING

There are **four** places report content lives, not three: the Word source, the compiled
`app/content/content_library.json`, the `INTERIM_*` constants in
`scripts/build_content_library.js`, and the **`content_overrides` table** written by
`/admin/content`. The fourth is the one that bites, because every offline harness renders
with an empty override map and therefore cannot see it.

`resolveContent` **throws** when a published override's shape no longer matches the library
field it replaces. That throw reaches *every* render including the dry-validate probe in
`POST /api/submit`, so **a mismatched row fails assessment submission, not just a PDF** — and
`static.*` keys are global, so it fails for every client at once.

**Before deploying any change that alters an overridable field's shape** — adding, renaming or
removing a key under `static.*`, `type_N.*` or `subtype_*.*`:

```bash
npm run overrides:check          # from app/, against the DEPLOY TARGET's database
```

* **exit 0** — every published override matches the current library shape. Safe to deploy.
* **exit 1** — at least one row would throw. Fix it before deploying: re-publish the row from
  the current baseline in `/admin/content`, or retire it with
  `node scripts/retire_overrides.js --confirm` (dry-run by default; snapshots every column,
  including `previous_value`, to a gitignored `.override_snapshots/` before deleting).
* **exit 2** — the check did **not run** (no `DATABASE_URL`). This is not a pass.

CI cannot run this: `.github/workflows/report-verify.yml` has no `env`, no `secrets` and no
`services`, so the runner has no database. That is deliberate — a production `DATABASE_URL` in
PR CI is a worse trade — which is exactly why the step is written down here instead.

**Backstop, if the check is skipped:** `loadPublishedOverrides()` audits every row on each
cache fill — the first render after a deploy, and immediately after any coach publishes — and
prints a boxed `PUBLISHED OVERRIDE(S) WILL THROW AT RENDER TIME` block naming the keys. It is
deliberately non-fatal; the hard stop stays at render. If that block is in the deploy log,
stop and fix the rows.

*History: seven rows published 13-29 June 2026 sat outside PR 1.5's docx/JSON reconciliation
for seven weeks. One would have rendered the literal word "undefined" in a client PDF; two
would have blanked a Wings page the moment PR 3's content landed. All seven were migrated or
retired on 12 August 2026 — see `docs/audit_pr3_per_type_pages.md` section 9.*

## Confidentiality

This repository contains proprietary content developed by Hive, Inc. for the Hive Typing Engine. Do not share, redistribute, or check this material into any public repository.

## Contact

For questions about this repository or the typing engine, contact Cai Delumpa or Monique Breault.
