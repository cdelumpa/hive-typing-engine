# AI Prompt Spec — Changelog

Tracks changes to `hive_ai_prompt_spec_*.docx`. See `docs/hive_v2_4_change_summary.docx` for the full plain-English summary of everything that changed from v2.1 through v2.4.

## v2.4 — April 2026 — Integrated Coach Report + Expanded Client Report

Combines the v2.3 coach report rebuild with the parallel expanded client report changes into a single specification.

**Task 3 (Client-Facing Content) — major rewrite.**
- Now produces multiple client-facing fields: `client_narrative`, `core_motivation_evidence`, `instinct_personal_overlay`, `secondary_type_narrative`, plus structured `what_to_explore` (3 questions + optional 4th).
- New rule: never reference internal assessment architecture (stage numbers, framework axes) in client-facing copy.
- Practitioner naming generalized: AI-generated client text uses "your Enneagram coach or practitioner" rather than naming Cai or Monique.
- Removed duplicate "Based on your responses..." opening between static and AI-generated content.

**Three-layer architecture documented.** Spec now explicitly identifies the three content sources (Hive Type Library + AI engine + HTML template) and the integration responsibilities.

**Schema breaking changes.** `client_narrative` (string) → `client_facing` (structured object). New fields: `core_motivation_evidence`, `instinct_personal_overlay`, `secondary_type_narrative`, `what_to_explore`. The rendering app must be updated to consume the new structure.

## v2.3 — April 2026 — Wings & Lines as Static Reference + Type Confusion as Data

Reformatted Section 5 of the coach report to use static type-specific content with active-noticing prompts rather than claims about which wing or line is "more active."

**New Part 1 references.**
- Core Motivations Reference (all 9 types).
- Wings and Lines Reference (9 types × 2 wings + 9 types × 2 lines).

**New conditional Section 6A.** Type-confusion observation block in coach report, parallel to Section 1A (counter-type considerations). Renders only when type-confusion flags fire.

**Task 3 conditional addendum.** Client report gets a 4th "What to Explore" question (in-life observation invitation) when type confusion is present.

**Practitioner references generalized** in client-facing language.

## v2.2 — April 2026 — Reimagined Coach Report + 27-Subtype Reference

**Task 4 fully rewritten.** What used to be a 2-3 sentence coach note is now a structured Coach Prep Report with six sections plus two conditional sections.

**New Part 1 sections.**
- Coaching Pointer Voice (relational/presence-based language for coach pointers).
- Framework Expected Patterns (Hornevian, Harmonic, Object Relations match/mismatch reference).
- Subtype Recognition Reference (all 27 subtypes with "why this can be easy to miss").

**New flag.** `framework_cluster_mismatch` (3-of-3 framework mismatches escalates to type re-examination).

**Schema breaking change.** `coach_note` (string) → `coach_report` (structured object).

## v2.1 — Earlier 2026 — Baseline

Initial production version of the AI prompt spec.
