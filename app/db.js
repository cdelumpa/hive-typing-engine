'use strict';

const { Pool } = require('pg');

// Fall back gracefully when DATABASE_URL is not set (local dev without Railway DB)
let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  console.log('[db] PostgreSQL pool created');
} else {
  console.warn('[db] DATABASE_URL not set — database features disabled');
}

// ─── Schema initialization ─────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS coaches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS organization VARCHAR(255);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER REFERENCES coaches(id),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  status VARCHAR(50) DEFAULT 'pending',
  responses JSONB,
  confirmed_type INTEGER,
  confidence_level VARCHAR(50),
  stage4_outcome VARCHAR(50),
  flags JSONB,
  final_response_classification VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  assessment_id INTEGER REFERENCES assessments(id),
  report_type VARCHAR(50) NOT NULL,
  pdf_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS confirmed_instinct VARCHAR(20);
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS instinct_confidence VARCHAR(20);
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS dominant_instinct_hypothesis VARCHAR(20);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_started';

CREATE TABLE IF NOT EXISTS client_tokens (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS api_result       JSONB;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS scores_snapshot  JSONB;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS email_sent_at    TIMESTAMPTZ;

-- Assessment timing (§9). Nullable, no default. assessment_started_at is the
-- server-stamped Stage 0 Q1 first-save time (carried in clients.session_state
-- until completion); assessment_completed_at is the submit moment. elapsed_seconds
-- is wall-clock (idle time included, intentional). session_days is calendar days
-- spanned (same day = 1).
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS assessment_started_at   TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS assessment_completed_at TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS elapsed_seconds         INTEGER;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS session_days            INTEGER;

-- Coach Debrief Confirmation: coach-verified type/instinct recorded
-- post-debrief, layered on top of the engine's hypothesis fields.
-- All NULL until a coach fills them in.
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS coach_confirmed_type     INTEGER;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS coach_confirmed_instinct VARCHAR(20);
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS type_clarification_notes TEXT;

-- Retake linkage: NULL on a first take; on a retake, points to the prior
-- assessment row. Self-referencing FK; ON DELETE SET NULL so deleting the prior
-- row nulls the link rather than orphaning/deleting the retake.
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS retake_of_assessment_id INTEGER REFERENCES assessments(id) ON DELETE SET NULL;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage0_signal JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ct_adjustment JSONB;
-- DEPRECATED (A1 migration in progress): responses_snapshot has moved to the
-- assessments table so every assessment is self-contained (a retake no longer
-- overwrites the prior take's raw answers). This client-level column is left in
-- place as a read-only safety net until A2 is verified; nothing writes to it
-- after A1. Do NOT add new reads against clients.responses_snapshot.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS responses_snapshot JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS call1_result JSONB;

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS beta_report_generated_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS beta_report_filename TEXT;

-- Per-assessment beta-tester flag. Set on the client via the admin profile modal
-- and mirrored onto each assessment row at creation (see createAssessment), so a
-- retake by a beta tester inherits is_beta = TRUE from the client row. This
-- supersedes the global app_settings.beta_mode_enabled switch (retired in a later PR).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_beta BOOLEAN DEFAULT FALSE;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS is_beta BOOLEAN DEFAULT FALSE;

-- Three-state soft delete, scoped to a single assessment (replaces the old
-- client-scoped cascade). State machine derived from these three columns:
--   active             : deleted_at IS NULL
--   pending deletion   : deleted_at IS NOT NULL AND permanently_deleted = FALSE  (reversible)
--   permanently deleted: deleted_at IS NOT NULL AND permanently_deleted = TRUE   (tombstone)
-- A tombstone keeps its assessments row forever (audit trail); its PDFs are purged
-- from disk and its reports rows removed. pre_deletion_status snapshots status at
-- mark time for display in /admin/deleted-assessments (status itself is never mutated).
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS deleted_at          TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS pre_deletion_status TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS permanently_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS session_state JSONB DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reminder_sent_at JSONB DEFAULT NULL;

-- Enforce one client per email. Unique INDEX (not ADD CONSTRAINT) so we can use
-- IF NOT EXISTS, matching the idempotent-migration style used throughout this file.
-- Case-sensitive by design for now; normalizing the /api/submit insert path to
-- lowercase is a tracked follow-up, not part of this change.
CREATE UNIQUE INDEX IF NOT EXISTS clients_email_key ON clients (email);

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  beta_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (id = 1)
);
INSERT INTO app_settings (id, beta_mode_enabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Beta analysis: singleton (id=1) holding the latest cross-record synthesis produced
-- by the /admin/beta-review Re-analyze pass (PR-F). Overwritten on each re-run.
-- analysis_json carries the full five-part result (deterministic aggregates + the
-- Opus narrative). No seed row — created on first save via UPSERT.
CREATE TABLE IF NOT EXISTS beta_analysis (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  analysis_json    JSONB,
  model            TEXT,
  token_usage      JSONB,
  respondent_count INTEGER,
  generated_at     TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1)
);

-- Beta feedback: one row per beta tester's post-submit feedback submission.
-- Cascades on assessment delete so feedback never outlives its assessment.
CREATE TABLE IF NOT EXISTS beta_feedback (
  id SERIAL PRIMARY KEY,
  assessment_id INTEGER REFERENCES assessments(id) ON DELETE CASCADE,
  self_hypothesis_types JSONB,
  self_hypothesis_instincts JSONB,
  flagged_keys JSONB,
  block_b_answers JSONB,
  overall_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS edit_history (
  id             SERIAL PRIMARY KEY,
  record_type    TEXT NOT NULL,
  record_id      INTEGER NOT NULL,
  edited_by_id   INTEGER NOT NULL,
  edited_by_name TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  editor_note    TEXT,
  edited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Client history log (PR B) ───────────────────────────────────────────────────
-- Read-only lifecycle audit trail surfaced in the client details modal's History tab
-- (super-admin only). Distinct from edit_history (which logs profile-field edits): this
-- records significant lifecycle events — client created, invitation sent, assessment
-- started/completed, report delivered, EM Lab activity, and retake workflow steps.
-- client_id CASCADE so history dies with the client; assessment_id SET NULL so a
-- retake-safe assessment deletion preserves the history row.
CREATE TABLE IF NOT EXISTS client_history (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  assessment_id     INTEGER REFERENCES assessments(id) ON DELETE SET NULL,
  event_type        VARCHAR(64),
  event_description TEXT,
  actor             VARCHAR(255),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdf_tokens (
  token TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  coach_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ
);

-- CMS content overrides: per-field-group replacements for baseline content_library.json /
-- type_library.json values. content_key is a field-group id (e.g. 'subtype_sp9.narrative',
-- 'static.welcome', 'type_9.wings'). value is a plain string or JSON-serialized object matching
-- the baseline shape for that key; the renderer JSON.parses it as a drop-in replacement.
-- word_count is computed by the server at save time (nullable). previous_value snapshots the
-- value at the most recent publish to enable one-click revert.
CREATE TABLE IF NOT EXISTS content_overrides (
  content_key     TEXT PRIMARY KEY,
  value           TEXT NOT NULL,
  word_count      INTEGER,
  updated_by      INTEGER REFERENCES coaches(id),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  previous_value  TEXT
);

-- Prompt version history (stub — no logic yet). call_number identifies which engine call
-- the prompt belongs to (1 or 2). No indexes / startup snapshot logic in this PR.
CREATE TABLE IF NOT EXISTS prompt_versions (
  id            SERIAL PRIMARY KEY,
  call_number   INTEGER NOT NULL CHECK (call_number IN (1, 2)),
  prompt_text   TEXT NOT NULL,
  deployed_at   TIMESTAMPTZ DEFAULT NOW(),
  deployed_by   TEXT,
  notes         TEXT
);

-- ─── Enhanced Mode (EM) — experimental raw-slider analysis path (design §8) ──────
-- All additive and nullable; existing rows are unaffected. EM is a parallel
-- analysis path that has zero contact with the live SM assessment flow in this PR.

-- EM result storage + per-assessment mode override (nullable; null = inherit).
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS experimental_raw_analysis JSONB;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS analysis_mode TEXT;

-- Per-client mode override (nullable; null = inherit from global).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS analysis_mode TEXT;

-- Global EM mode controls on the singleton app_settings row.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS em_active BOOLEAN DEFAULT FALSE;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS em_analysis_mode TEXT DEFAULT 'sm_only';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS em_model TEXT DEFAULT 'sonnet';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS em_prompt_version TEXT DEFAULT 'EM-v1.0';

-- Declared type/instinct ground truth captured in the beta feedback survey.
ALTER TABLE beta_feedback ADD COLUMN IF NOT EXISTS declared_type INTEGER;
ALTER TABLE beta_feedback ADD COLUMN IF NOT EXISTS declared_instinct VARCHAR(8);
ALTER TABLE beta_feedback ADD COLUMN IF NOT EXISTS declared_subtype TEXT;
ALTER TABLE beta_feedback ADD COLUMN IF NOT EXISTS declaration_confidence VARCHAR(8);

-- Explicit "Don't Know" flags for the EM Lab Declared Type editor. A null value
-- column with its flag FALSE means "not yet declared" (renders Pending); with its
-- flag TRUE it means the admin explicitly declared Don't Know for that dimension.
-- DEFAULT FALSE so every existing/backfilled row maps to the "known" matrix states.
ALTER TABLE beta_feedback ADD COLUMN IF NOT EXISTS declared_type_dont_know     BOOLEAN DEFAULT FALSE;
ALTER TABLE beta_feedback ADD COLUMN IF NOT EXISTS declared_instinct_dont_know BOOLEAN DEFAULT FALSE;

-- ─── State-at-time-of-assessment fields (beta mood/environment section) ──────────
-- Captured in the first section of the beta feedback survey for post-beta correlation
-- analysis only (zero effect on scoring, AI calls, or report generation). mood_at_time
-- and environment_at_time are constrained single-selects (validated at the route);
-- state_reflection_text is optional open text. state_analysis holds a short coach-facing
-- insight note written server-side by a non-blocking AI call after survey submission —
-- never sent or edited by the client.
ALTER TABLE beta_feedback ADD COLUMN IF NOT EXISTS mood_at_time          VARCHAR(24);
ALTER TABLE beta_feedback ADD COLUMN IF NOT EXISTS environment_at_time   VARCHAR(32);
ALTER TABLE beta_feedback ADD COLUMN IF NOT EXISTS state_reflection_text TEXT;
ALTER TABLE beta_feedback ADD COLUMN IF NOT EXISTS state_analysis        TEXT;

-- Backfill declared_type / declared_instinct from the self-hypothesis the tester
-- submitted in the beta survey. The submit path only ever wrote self_hypothesis_types /
-- self_hypothesis_instincts (each a JSONB object of shape {values:[...], dontKnow:bool}),
-- while the EM Lab DECLARED column reads declared_type / declared_instinct — so those
-- stayed NULL and every row rendered "Pending". declared_type takes the first element of
-- the values array; declared_instinct takes the first instinct value. Older bare-array
-- shapes (e.g. [7]) are handled via the jsonb_typeof branch. Idempotent: the
-- declared_type IS NULL guard skips rows already backfilled on later startups, and the
-- numeric guard leaves "don't know" rows (empty values → NULL) untouched.
UPDATE beta_feedback
   SET declared_type = (
         CASE WHEN jsonb_typeof(self_hypothesis_types) = 'array'
              THEN self_hypothesis_types->>0
              ELSE self_hypothesis_types->'values'->>0 END
       )::integer,
       declared_instinct = (
         CASE WHEN jsonb_typeof(self_hypothesis_instincts) = 'array'
              THEN self_hypothesis_instincts->>0
              ELSE self_hypothesis_instincts->'values'->>0 END
       )
 WHERE declared_type IS NULL
   AND self_hypothesis_types IS NOT NULL
   AND (
         CASE WHEN jsonb_typeof(self_hypothesis_types) = 'array'
              THEN self_hypothesis_types->>0
              ELSE self_hypothesis_types->'values'->>0 END
       ) ~ '^[0-9]+$';

-- EM reliability log: one row per EM run. Stores the SM result, the EM result(s)
-- (Sonnet and/or Opus), the declared type, and the full EM JSON for prompt tuning.
-- error_message is populated when an EM run fails (SM is unaffected in all cases).
CREATE TABLE IF NOT EXISTS em_reliability_log (
  id SERIAL PRIMARY KEY,
  assessment_id INTEGER REFERENCES assessments(id),
  client_id INTEGER REFERENCES clients(id),
  sm_type INTEGER,
  sm_instinct VARCHAR(8),
  sm_confidence VARCHAR(16),
  em_type_sonnet INTEGER,
  em_instinct_sonnet VARCHAR(8),
  em_confidence_sonnet VARCHAR(16),
  em_type_opus INTEGER,
  em_instinct_opus VARCHAR(8),
  em_confidence_opus VARCHAR(16),
  declared_type INTEGER,
  declared_instinct VARCHAR(8),
  declaration_confidence VARCHAR(8),
  match_status VARCHAR(16),
  prompt_version VARCHAR(32),
  model_version VARCHAR(64),
  full_em_result JSONB,
  error_message TEXT,
  ran_at TIMESTAMP DEFAULT NOW()
);

-- ─── A1 data-integrity migration ────────────────────────────────────────────────
-- 1) Per-assessment responses_snapshot. Moves the raw answers off the client row
--    (where every completion overwrote the prior take) onto the assessment, so each
--    assessment is forensically self-contained. Additive + nullable.
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS responses_snapshot JSONB;

-- 2) Best-effort backfill for existing rows. clients carries only its LATEST snapshot,
--    so only the most recent assessment per client gets accurate data; older assessments
--    inherit whatever is currently on the client row. Guarded on IS NULL so it is
--    idempotent across restarts and never clobbers a freshly written per-assessment value.
UPDATE assessments a
   SET responses_snapshot = c.responses_snapshot
  FROM clients c
 WHERE a.client_id = c.id
   AND a.responses_snapshot IS NULL
   AND c.responses_snapshot IS NOT NULL;

-- 3) EM re-run report storage. The EM Lab "Re-run Report" reshaped output lands here
--    (UPSERT, last-write-wins per assessment) instead of overwriting assessments.api_result.
--    Production assessment data is never touched by an EM Lab re-run.
CREATE TABLE IF NOT EXISTS em_rerun_reports (
  assessment_id  INTEGER PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
  result         JSONB,
  model          VARCHAR(64),
  prompt_version VARCHAR(64),
  generated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── A2 EM Lab tooling migration ─────────────────────────────────────────────────
-- Re-run PDF paths. A2 restores PDF generation for the EM Lab Re-run Report, but the
-- PDFs land under the rerun_*_<assessment_id>_<timestamp>.pdf naming convention and are
-- recorded HERE — never inserted into the reports table (which drives the dashboard).
ALTER TABLE em_rerun_reports ADD COLUMN IF NOT EXISTS rerun_client_pdf_path VARCHAR;
ALTER TABLE em_rerun_reports ADD COLUMN IF NOT EXISTS rerun_coach_pdf_path  VARCHAR;

-- ─── Re-Run Analysis (production recovery) ────────────────────────────────────────
-- POST /admin/em-rerun re-fires the full EM pipeline on a FAILED em_only assessment
-- (api_result IS NULL) and force-writes the new result into production. These three
-- columns record provenance + forensic backup. Additive + nullable.
--   rerun_at             — when the recovery ran.
--   rerun_by             — actor (coach email, falling back to name) who ran it.
--   pre_rerun_api_result — the api_result value at the instant before the force-write
--                          (null for a failed assessment), kept permanently so the prior
--                          state is recoverable if the new result is worse.
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS rerun_at             TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS rerun_by             TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS pre_rerun_api_result JSONB;

-- ═══ IAA v1.2 — Phase A: Identity & Access Architecture (DDL) ═══════════════════
-- Purely additive. Establishes the identity/auth/role foundation. NO existing code
-- path reads these tables yet (that is Phase B). All idempotent.
--
-- Execution-order note: the spec lists the updated_at trigger first, but a trigger
-- (and the FK columns below) cannot be created before the users table exists.
-- Statements are therefore ordered by PostgreSQL dependency — all CREATE TABLEs
-- (users first) → function + trigger → additive FK columns. Statement text is
-- unchanged from the spec; only execution order is corrected.

-- ── Table: users ── identity + authentication single source of truth.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT,
  auth_provider VARCHAR(50) DEFAULT 'local',
  provider_id VARCHAR(255),
  confirmed_type INTEGER,
  -- TODO: confirmed_type is pre-positioned for Pocket Coach / Coach Companion.
  -- Populated post-debrief when a coach confirms a client's Enneagram type.
  -- Write path is a future build item — do not add writes to this column in this PR.
  dominant_instinct VARCHAR(10),
  -- TODO: dominant_instinct is pre-positioned for Pocket Coach / Coach Companion.
  -- Populated post-debrief when a coach confirms a client's dominant instinct (SP/SO/SX).
  -- Write path is a future build item — do not add writes to this column in this PR.
  last_login_at TIMESTAMPTZ,
  last_login_ip VARCHAR(45),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  gdpr_consent_given BOOLEAN,
  gdpr_consent_at TIMESTAMPTZ,
  gdpr_consent_version VARCHAR(20),
  erasure_requested_at TIMESTAMPTZ,
  anonymized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Table: roles ── static reference; populated once in SEED_SQL, never mutated by app code.
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Table: user_roles ── many-to-many join with audit (granted_by / granted_at).
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- ── Table: auth_events ── append-only auth audit log.
CREATE TABLE IF NOT EXISTS auth_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Table: password_reset_tokens ── single-use, time-limited; token stored hashed.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Table: embargo_list ── permanent identity block; exact-email or domain-suffix match.
CREATE TABLE IF NOT EXISTS embargo_list (
  id SERIAL PRIMARY KEY,
  value VARCHAR(255) NOT NULL UNIQUE,
  match_type VARCHAR(10) NOT NULL CHECK (match_type IN ('exact', 'domain')),
  reason TEXT,
  embargoed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Function + trigger: maintain users.updated_at on every UPDATE ──
-- CREATE OR REPLACE FUNCTION is idempotent; DROP TRIGGER IF EXISTS before CREATE
-- TRIGGER makes the trigger idempotent. Ordered after CREATE TABLE users above.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Additive columns on existing domain tables (FK -> users; require users to exist) ──
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS client_context_summary TEXT;
-- TODO: client_context_summary is pre-positioned for the Pocket Coach system prompt.
-- Populated at assessment completion by the AI pipeline.
-- Write path is a future build item — do not add writes to this column in this PR.

-- ═══ Provisioning & Commerce v1.0 — PR1: new tables (DDL only) ════════════════════
-- Additive extension of IAA v1.2 (spec §10.1). Nothing here revises a ratified table.
-- Ordered by PostgreSQL FK dependency: accounts → credit_types → credit_lots →
-- credit_transactions → certifications → teams → team_members → team_reports →
-- assignment_events. Every table FKs into users/coaches/clients/assessments, all of
-- which are defined above, so this block must remain at the tail of SCHEMA_SQL.
-- teams / team_members / team_reports ship schema-only this build (no logic yet).

-- ── Table: accounts ── billing account abstraction. 1:1 with a coach today, modeled
-- so a future multi-coach practice needs no migration. The house account (Cai/Mo D2C)
-- has coach_id NULL; a coach's own account carries their coach_id. The partial unique
-- index enforces one 'coach' account per coach while leaving the NULL-coach_id house
-- row exempt (multiple NULLs would otherwise collide under a plain UNIQUE).
CREATE TABLE IF NOT EXISTS accounts (
  id           SERIAL PRIMARY KEY,
  coach_id     INTEGER REFERENCES coaches(id),
  account_type VARCHAR(10) NOT NULL CHECK (account_type IN ('coach', 'house')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_coach_id_key
  ON accounts (coach_id) WHERE coach_id IS NOT NULL;

-- ── Table: credit_types ── reference data (roles pattern). Seeded in PR3. name is the
-- machine key referenced by requested_report_types.
--
-- PR6a: no longer purely static — current_cost_credits is a MUTABLE operational value
-- (see the ALTER below). The rows themselves are still never inserted/deleted by app code.
CREATE TABLE IF NOT EXISTS credit_types (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

-- ── Table: credit_lots ── lot-based credit tracking (spec §5.3), not a flat balance.
-- Each purchase or grant is its own lot with its own price and remaining count, so a
-- cancellation can restore at the price actually paid. source distinguishes paid vs
-- free; price_paid_cents is NULL for granted lots.
CREATE TABLE IF NOT EXISTS credit_lots (
  id                 SERIAL PRIMARY KEY,
  account_id         INTEGER NOT NULL REFERENCES accounts(id),
  credit_type_id     INTEGER NOT NULL REFERENCES credit_types(id),
  quantity           INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  source             VARCHAR(10) NOT NULL CHECK (source IN ('purchased', 'granted')),
  price_paid_cents   INTEGER,
  purchase_reference TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS credit_lots_account_type_idx
  ON credit_lots (account_id, credit_type_id);
-- PR9: atomic idempotency for the ThriveCart webhook — a repeated purchase (same
-- purchase_reference) can INSERT at most once. Partial (WHERE NOT NULL) so the many
-- granted/consumed lots with a NULL reference are exempt from the uniqueness rule.
CREATE UNIQUE INDEX IF NOT EXISTS credit_lots_purchase_reference_key
  ON credit_lots (purchase_reference) WHERE purchase_reference IS NOT NULL;

-- ── Table: credit_transactions ── append-only ledger of every credit event
-- (auth_events pattern). lot_id is nullable (a restore may not target a single lot);
-- assessment_id links a consume/restore to the assessment it provisioned; created_by
-- is the acting user (SET NULL so the audit row survives user deletion).
CREATE TABLE IF NOT EXISTS credit_transactions (
  id             SERIAL PRIMARY KEY,
  account_id     INTEGER NOT NULL REFERENCES accounts(id),
  credit_type_id INTEGER NOT NULL REFERENCES credit_types(id),
  lot_id         INTEGER REFERENCES credit_lots(id),
  event_type     VARCHAR(10) NOT NULL CHECK (event_type IN ('consumed', 'restored', 'granted')),
  quantity       INTEGER NOT NULL,
  assessment_id  INTEGER REFERENCES assessments(id),
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes          TEXT
);
CREATE INDEX IF NOT EXISTS credit_transactions_account_idx
  ON credit_transactions (account_id);
CREATE INDEX IF NOT EXISTS credit_transactions_assessment_idx
  ON credit_transactions (assessment_id);

-- ── PR6a: variable per-assessment credit cost ────────────────────────────────────
-- A Standard Assessment costs 5 credits by default, not 1. The cost is MUTABLE so a
-- time-limited special ("4 credits this week") can be run with a single UPDATE — no
-- redeploy, no ThriveCart change, no coupon code. The discount lives entirely on the
-- redemption side.
--
-- It lives on credit_types because the cost is a property OF the credit type: when
-- Leadership/Team reports become sellable they get their own cost. NULL means "not
-- sellable yet" — consumeCredit refuses a type with no cost rather than guessing 1.
ALTER TABLE credit_types ADD COLUMN IF NOT EXISTS current_cost_credits INTEGER;

DO $$ BEGIN
  UPDATE credit_types SET current_cost_credits = 5
   WHERE name = 'standard_assessment' AND current_cost_credits IS NULL;
END $$;

-- Idempotent CHECK adds. SCHEMA_SQL re-runs on every boot and ADD CONSTRAINT has no
-- IF NOT EXISTS, so each is guarded on pg_constraint.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_types_cost_positive') THEN
    ALTER TABLE credit_types
      ADD CONSTRAINT credit_types_cost_positive
      CHECK (current_cost_credits IS NULL OR current_cost_credits > 0);
  END IF;
END $$;

-- Audit trail for every change to a credit type's cost. The cost is the price of every
-- assessment sold, so a silent change is a revenue event with no paper trail. The note
-- column is free text so a future admin can see WHY ("Summer special through Jul 21"), not
-- just that something moved. previous_cost_credits is NULL for the first recorded change.
--
-- FK types confirmed against the live schema: credit_types.id and users.id are both SERIAL
-- (= INTEGER), so INTEGER REFERENCES is correct for both. changed_by is ON DELETE SET NULL
-- so the audit row outlives the admin's user record (same posture as
-- credit_transactions.created_by).
CREATE TABLE IF NOT EXISTS credit_type_cost_history (
  id                    SERIAL PRIMARY KEY,
  credit_type_id        INTEGER NOT NULL REFERENCES credit_types(id),
  previous_cost_credits INTEGER,
  new_cost_credits      INTEGER NOT NULL,
  changed_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note                  TEXT
);
CREATE INDEX IF NOT EXISTS credit_type_cost_history_type_idx
  ON credit_type_cost_history (credit_type_id, changed_at DESC);

-- Guardrail the FIFO drain depends on. Before PR6a a lot could only ever be decremented
-- by 1 and was always checked for quantity_remaining > 0 first, so it could not go
-- negative. A multi-credit cost CAN overdraw a lot, and nothing in the schema was
-- stopping it — a bad drain would have silently written a negative balance. Now the
-- database refuses.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_lots_remaining_non_negative') THEN
    ALTER TABLE credit_lots
      ADD CONSTRAINT credit_lots_remaining_non_negative
      CHECK (quantity_remaining >= 0);
  END IF;
END $$;

-- ── Table: certifications ── dedicated certification record, separate from the coach
-- role grant, to support ICF CCE audit requirements (spec §4). user_id is the
-- certified person; evaluator_id is the Cai/Mo assessor (both → users, SET NULL).
CREATE TABLE IF NOT EXISTS certifications (
  id                          SERIAL PRIMARY KEY,
  user_id                     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  program_version             VARCHAR(50),
  completion_date             DATE,
  evaluator_id                INTEGER REFERENCES users(id) ON DELETE SET NULL,
  debrief_evaluation_outcome  TEXT,
  icf_cce_units               NUMERIC,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Table: teams ── (schema-only this build) roster of clients grouped for a Team
-- Report, decoupled from billing. leader_client_id is the designated report recipient.
CREATE TABLE IF NOT EXISTS teams (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(255),
  organization        VARCHAR(255),
  leader_client_id    INTEGER REFERENCES clients(id),
  created_by_coach_id INTEGER REFERENCES coaches(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Table: team_members ── (schema-only) join of teams↔clients, independent of how
-- any member's assessment was paid for. Composite PK prevents duplicate membership.
CREATE TABLE IF NOT EXISTS team_members (
  team_id   INTEGER NOT NULL REFERENCES teams(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, client_id)
);

-- ── Table: team_reports ── (schema-only) versioned Team Report records — each re-run
-- is a new row, not an overwrite. credit_transaction_id links the consuming ledger row.
CREATE TABLE IF NOT EXISTS team_reports (
  id                    SERIAL PRIMARY KEY,
  team_id               INTEGER NOT NULL REFERENCES teams(id),
  version_number        INTEGER,
  status                VARCHAR(50),
  generated_at          TIMESTAMPTZ,
  pdf_path              VARCHAR(500),
  bonus_rerun_used      BOOLEAN DEFAULT FALSE,
  credit_transaction_id INTEGER REFERENCES credit_transactions(id)
);

-- ── Table: assignment_events ── append-only audit trail for coach assignment and
-- reassignment (v1.2 didn't anticipate clients moving between coaches). previous/new
-- coach nullable (a first assignment has no previous); assigned_by → users (SET NULL).
CREATE TABLE IF NOT EXISTS assignment_events (
  id                SERIAL PRIMARY KEY,
  client_id         INTEGER NOT NULL REFERENCES clients(id),
  previous_coach_id INTEGER REFERENCES coaches(id),
  new_coach_id      INTEGER REFERENCES coaches(id),
  assigned_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assignment_events_client_idx
  ON assignment_events (client_id);

-- ═══ Provisioning & Commerce v1.0 — PR2: existing-table columns + backfill ════════
-- Additive columns on assessments / reports / app_settings (spec §10.2, with the
-- D1/D7 override that moves client_source + auto_send_invitation onto assessments,
-- not clients). Must follow the PR1 block above: reports.team_id FKs teams(id).

-- ── assessments ── cancellation audit trail (D3: orthogonal to soft-delete — these
-- three columns are distinct from deleted_at/pre_deletion_status/permanently_deleted),
-- the two per-assessment send flags (nullable, no column DEFAULT — written explicitly
-- at provisioning in PR8, backfilled below for pre-launch rows), requested_report_types
-- (JSONB array of credit_types.name strings), and client_source (D7).
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS cancelled_at           TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS cancellation_reason    TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS credit_restored_at     TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS auto_send_report       BOOLEAN;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS auto_send_invitation   BOOLEAN;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS requested_report_types JSONB;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS client_source          TEXT;

-- ── reports ── Team Report versioning (spec §7.2/§10.2). Nullable, no FK backfill;
-- parent_report_id self-references reports; team_id FKs the PR1 teams table.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS version_number   INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS parent_report_id INTEGER REFERENCES reports(id);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS team_id          INTEGER REFERENCES teams(id);

-- ── app_settings ── global credit-enforcement kill switch. FALSE at launch: the
-- house account still calls consumeCredit() and logs the ledger row, but no balance
-- floor is enforced until this flips TRUE (handoff F2). Mirrors the em_* flag style.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS credit_enforcement_enabled BOOLEAN DEFAULT FALSE;

-- ── Send-flag backfill (handoff G — the re-flip trap) ──
-- auto_send_report / auto_send_invitation carry NO column-level DEFAULT, so new rows
-- are NULL until PR8 stamps them at provisioning. Existing pre-launch rows must be
-- TRUE to preserve today's automatic send behavior. This one-time backfill is guarded
-- by a FIXED cutoff so it never re-flips a post-launch row that a coach intentionally
-- set to FALSE: SCHEMA_SQL runs on every boot, and a naive "IS NULL → TRUE" (or a
-- column DEFAULT TRUE) would silently re-enable auto-send on every restart.
DO $$ BEGIN
  UPDATE assessments
    SET auto_send_report = TRUE
    WHERE auto_send_report IS NULL
      AND created_at < '2026-07-01 12:00:00+00';

  UPDATE assessments
    SET auto_send_invitation = TRUE
    WHERE auto_send_invitation IS NULL
      AND created_at < '2026-07-01 12:00:00+00';
END $$;

-- ═══ Coach Portal PR2 — onboarding state on coaches + profile/keyword tables ═══════
-- Onboarding-state flags live on coaches (ratified). Same re-flip-safe pattern as the
-- handoff-G send-flag backfill above: nullable ADD (existing rows -> NULL) -> one-time
-- backfill of pre-existing coaches to TRUE under a FIXED cutoff (so a reboot never
-- re-locks a coach who is legitimately mid-onboarding) -> then SET DEFAULT FALSE so new
-- webhook/admin coaches gate into onboarding. Cutoff is the PR2 deploy moment.
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS onboarding_completed    BOOLEAN;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS onboarding_welcome_seen BOOLEAN;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS password_set            BOOLEAN;

DO $$ BEGIN
  UPDATE coaches SET onboarding_completed    = TRUE WHERE onboarding_completed    IS NULL AND created_at < '2026-07-14 00:00:00+00';
  UPDATE coaches SET onboarding_welcome_seen = TRUE WHERE onboarding_welcome_seen IS NULL AND created_at < '2026-07-14 00:00:00+00';
  UPDATE coaches SET password_set            = TRUE WHERE password_set            IS NULL AND created_at < '2026-07-14 00:00:00+00';
END $$;

ALTER TABLE coaches ALTER COLUMN onboarding_completed    SET DEFAULT FALSE;
ALTER TABLE coaches ALTER COLUMN onboarding_welcome_seen SET DEFAULT FALSE;
ALTER TABLE coaches ALTER COLUMN password_set            SET DEFAULT FALSE;

-- ── coach_profiles ── one row per coach (spec §9.8). Directory/profile fields; photo
-- persistence is deferred (PR2 renders the affordance only). icf_designations/keywords
-- are PostgreSQL text arrays. directory_opt_in defaults FALSE (explicit opt-in).
CREATE TABLE IF NOT EXISTS coach_profiles (
  id               SERIAL PRIMARY KEY,
  coach_id         INTEGER NOT NULL REFERENCES coaches(id) UNIQUE,
  photo_url        TEXT,
  bio              TEXT,
  icf_designations TEXT[],
  alternate_email  VARCHAR(255),
  phone            VARCHAR(50),
  directory_opt_in BOOLEAN DEFAULT FALSE,
  keywords         TEXT[],
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── keyword_tags ── curated directory keyword list (spec §9.9). Only active tags
-- appear in autocomplete; coaches select from this list (no free-text at launch).
-- Seeded with a provisional starter set in SEED_SQL until the admin tag manager ships.
CREATE TABLE IF NOT EXISTS keyword_tags (
  id         SERIAL PRIMARY KEY,
  label      VARCHAR(100) NOT NULL UNIQUE,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── clients ── coach-owned per-client fields (§7.2 My Clients addendum, PR4a).
-- CP-B (ratified): notes and debrief live on the CLIENT, not the assessment — the mockup
-- shows one Coach Notes box and one Coach Debrief section per client, not one per
-- assessment. Known v1 limitation: a client who retakes overwrites the single debrief
-- record rather than keeping one per assessment. Accepted, not solved here.
-- coach_notes is private to the owning coach and is never surfaced to the client.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS coach_notes       TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS debrief_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS debrief_date      DATE;

-- ── retake_requests ── coach-initiated, approval-gated retakes (§7.2 addendum, PR4b).
-- A retake request is NOT an assessment until launched — it is a request that references
-- the assessment being retaken. On launch we provision a REAL new assessment through the
-- standard path and record its id here.
--
-- CP-D: original_assessment_id is nullable with ON DELETE SET NULL, matching the
-- assessments.retake_of_assessment_id precedent. NOT NULL + ON DELETE SET NULL is
-- self-contradictory, and a NOT NULL FK here would block permanentlyDeleteAssessment from
-- ever tombstoning an assessment that had been retaken.
--
-- 'launched' is a real status, not a derived one: without it an approved-and-launched
-- request would sit at 'approved' forever and the Launch Retake button would never turn
-- off. The partial unique index below depends on it.
CREATE TABLE IF NOT EXISTS retake_requests (
  id                       SERIAL PRIMARY KEY,
  client_id                INTEGER NOT NULL REFERENCES clients(id),
  original_assessment_id   INTEGER REFERENCES assessments(id) ON DELETE SET NULL,
  coach_id                 INTEGER NOT NULL REFERENCES coaches(id),
  reason                   TEXT NOT NULL,
  status                   VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending | approved | denied | launched
  denial_reason            TEXT,
  requested_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by              INTEGER REFERENCES users(id),
  reviewed_at              TIMESTAMPTZ,
  resulting_assessment_id  INTEGER REFERENCES assessments(id) ON DELETE SET NULL,
  launched_at              TIMESTAMPTZ
);

-- At most ONE open (pending or approved) request per client. This is the double-submit and
-- double-launch guard, enforced in the database rather than by a read-then-write check that
-- could race. Denied and launched requests are unconstrained, so a coach may request again
-- after a denial, and a client may be retaken more than once over time.
CREATE UNIQUE INDEX IF NOT EXISTS retake_requests_one_open
  ON retake_requests (client_id) WHERE status IN ('pending', 'approved');

-- ── announcements ── "From InsightOut" feed (spec §9.10). published_at NULL = draft and
-- is never visible to coaches. Authored by Cai/Mo in the admin CMS, which is NOT built
-- yet — so this table is legitimately empty at launch and the Dashboard feed renders its
-- empty state. PR3 reads it; PR12 (§7.11 Announcements page) adds list/detail/search.
CREATE TABLE IF NOT EXISTS announcements (
  id           SERIAL PRIMARY KEY,
  category     VARCHAR(50)  NOT NULL,   -- what_is_new | tip | system
  title        VARCHAR(255) NOT NULL,
  preview_text TEXT         NOT NULL,   -- 2-line truncated preview on the card
  body         TEXT         NOT NULL,   -- full body, shown in the PR12 detail modal
  published_at TIMESTAMPTZ,             -- NULL = draft
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── coach_announcement_reads ── append-only read receipts (spec §9.11). A row exists =
-- that coach has read that announcement; no row = unread. Drives the unread dot + bold
-- title on §7.11. PR3 creates the table but never writes to it — the read receipt is
-- recorded when the detail modal opens, which is PR12.
CREATE TABLE IF NOT EXISTS coach_announcement_reads (
  coach_id        INTEGER NOT NULL REFERENCES coaches(id),
  announcement_id INTEGER NOT NULL REFERENCES announcements(id),
  read_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (coach_id, announcement_id)
);
`;

const SEED_SQL = `
INSERT INTO coaches (name, email)
VALUES ('Cai Delumpa', 'cai@hiveleadership.com'),
       ('Monique Breault', 'monique@hiveleadership.com')
ON CONFLICT (email) DO NOTHING;

-- Passwords are intentionally NOT seeded here — credentials must never live in
-- source control. Set them out-of-band against the target database with:
--   SEED_CAI_PASSWORD='…' SEED_MONIQUE_PASSWORD='…' node scripts/seed_coach_passwords.js
-- A fresh coach row therefore has a NULL password_hash until that script is run.

UPDATE coaches SET is_admin = TRUE, is_active = TRUE
WHERE email IN ('cai@hiveleadership.com', 'monique@hiveleadership.com');

UPDATE coaches SET is_super_admin = TRUE
WHERE email IN ('cai@hiveleadership.com', 'monique@hiveleadership.com');

-- Remove temporary test coaches created during access-control verification
DELETE FROM coaches WHERE email IN ('testadmin@hiveleadership.com', 'testcoach@hiveleadership.com');

-- Founders never go through coach onboarding. Mark them complete explicitly — this
-- covers a FRESH database where Cai/Mo are seeded (above) AFTER the SCHEMA_SQL
-- cutoff-based backfill has already run, so they'd otherwise inherit DEFAULT FALSE.
-- Idempotent; on an existing prod DB the cutoff backfill already set these TRUE.
UPDATE coaches SET onboarding_completed = TRUE, onboarding_welcome_seen = TRUE, password_set = TRUE
WHERE email IN ('cai@hiveleadership.com', 'monique@hiveleadership.com');

-- keyword_tags — PROVISIONAL starter list (Coach Portal PR2). Cai/Mo will curate this
-- via the admin tag manager (later deliverable); edit/replace freely. Only active tags
-- surface in the My Profile / onboarding keyword autocomplete.
INSERT INTO keyword_tags (label) VALUES
  ('leadership'), ('executive coaching'), ('career transitions'), ('team dynamics'),
  ('conflict resolution'), ('communication'), ('work-life balance'), ('relationships'),
  ('entrepreneurship'), ('wellness'), ('confidence'), ('burnout'),
  ('life transitions'), ('mindfulness'), ('personal growth'), ('parenting'),
  ('workplace culture'), ('goal setting')
ON CONFLICT (label) DO NOTHING;

-- ═══ IAA v1.2 — Phase A: data migration (DML) ══════════════════════════════════
-- Runs on every boot AFTER all DDL above. Every statement is idempotent
-- (ON CONFLICT DO NOTHING / NOT EXISTS guards) so re-runs never duplicate or error.
-- Ordering: roles seed → users insert → coaches.user_id link → client role → elevated roles.

-- 1) Seed the four roles (static reference data, never changes).
INSERT INTO roles (name, description) VALUES
  ('client', 'Has taken or is taking the assessment'),
  ('coach', 'Certified InsightOut coach; manages client assessments and records'),
  ('admin', 'Coach plus content editing, coach provisioning, dashboard access'),
  ('super_admin', 'Admin plus platform controls: Re-Run, EM Lab, delete, retake approval, embargo')
ON CONFLICT (name) DO NOTHING;

-- 2) Migrate existing coaches into users — email and password_hash copied verbatim so
--    existing credentials keep working after Phase B's login cutover (no forced reset).
INSERT INTO users (email, password_hash, auth_provider, is_active, created_at, updated_at)
SELECT
  email,
  password_hash,
  'local',
  is_active,
  created_at,
  NOW()
FROM coaches
WHERE email IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- 3) Link coaches.user_id back to the new users rows.
UPDATE coaches
SET user_id = users.id
FROM users
WHERE coaches.email = users.email
AND coaches.user_id IS NULL;

-- 4) Assign the client role to all users.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE r.name = 'client'
AND NOT EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = u.id AND ur.role_id = r.id
);

-- 5) Assign elevated roles to Cai and Mo based on their current coaches flags.
--    DELIBERATE DEVIATION FROM SPEC: IAA v1.2 states all existing users receive the
--    client role only during migration — a safeguard against mass unintended elevation
--    across a large user base. With exactly two users in production, both confirmed
--    super-admins, that rule would deadlock: after Phase B's login cutover no one could
--    reach /admin to grant elevated roles. Therefore Cai and Mo receive their full
--    current role set (coach + admin + super_admin), mapped from their existing
--    coaches.is_admin / coaches.is_super_admin flags. This deviation is documented and
--    deliberate, approved for the two-person production migration.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN coaches c ON c.email = u.email
CROSS JOIN roles r
WHERE r.name = 'coach'
AND (c.is_admin = TRUE OR c.is_super_admin = TRUE)
AND NOT EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = u.id AND ur.role_id = r.id
);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN coaches c ON c.email = u.email
CROSS JOIN roles r
WHERE r.name = 'admin'
AND c.is_admin = TRUE
AND NOT EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = u.id AND ur.role_id = r.id
);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN coaches c ON c.email = u.email
CROSS JOIN roles r
WHERE r.name = 'super_admin'
AND c.is_super_admin = TRUE
AND NOT EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = u.id AND ur.role_id = r.id
);

-- 6) Coach self-assessment linkage: backfill clients.user_id by email so a coach's
--    pre-coach client record (their OWN self-assessment, taken as a client before they
--    became a coach) connects to their account. This is the IAA-correct link —
--    clients.user_id is designed to point at the assessment-taker's user (§ "Only
--    coaches.user_id and clients.user_id point outward at users"), but it was never
--    populated. General email→user match, not coach-scoped: any client whose email matches
--    a user gets linked, which is exactly what clients.user_id is meant to hold.
--    Idempotent (user_id IS NULL guard) and self-healing on every boot — so a coach
--    onboarded before their client record existed still links on a later boot. Verified
--    unambiguous against production: no client email maps to more than one user.
UPDATE clients
SET user_id = users.id
FROM users
WHERE lower(clients.email) = lower(users.email)
AND clients.user_id IS NULL;

-- ═══ Provisioning & Commerce v1.0 — PR3: seed data ══════════════════════════════
-- Runs on every boot after all DDL. Idempotent (ON CONFLICT DO NOTHING / WHERE NOT
-- EXISTS) so re-runs never duplicate. Depends on PR1 tables + the coaches seed above.

-- 1) credit_types — static reference (spec §5.1). Only standard_assessment is sold at
--    October launch; the other two ship now so the ledger is typed from day one and
--    never needs a retrofit migration once coaches hold real balances.
INSERT INTO credit_types (name, description) VALUES
  ('standard_assessment',
   'One InsightOut Enneagram Assessment with client and coach report'),
  ('leadership_report',
   'Leadership Report overlay — requires a completed assessment'),
  ('team_report',
   'Team Report — requires completed assessments for all members')
ON CONFLICT (name) DO NOTHING;

-- 2) House account (coach_id NULL) — bills Cai/Mo D2C assessments (handoff F6). One
--    only; guarded on WHERE NOT EXISTS since the partial unique index does not cover
--    NULL coach_id.
INSERT INTO accounts (coach_id, account_type)
  SELECT NULL, 'house'
  WHERE NOT EXISTS (
    SELECT 1 FROM accounts WHERE account_type = 'house'
  );

-- 3) One 'coach' account per existing coach. NOT EXISTS guard is idempotent and also
--    backfills any coach added before this seed ran; the accounts_coach_id_key partial
--    unique index is the hard backstop against duplicates.
INSERT INTO accounts (coach_id, account_type)
  SELECT c.id, 'coach'
  FROM coaches c
  WHERE NOT EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.coach_id = c.id
  );

`;

async function initDb() {
  if (!pool) return;
  try {
    await pool.query(SCHEMA_SQL);
    await pool.query(SEED_SQL);
    console.log('[db] Schema initialized and coaches seeded');
  } catch (e) {
    console.error('[db] Schema init failed:', e.message);
  }
}

// ─── Query helper — never throws, logs errors ──────────────────────────────────

async function query(sql, params) {
  if (!pool) return null;
  try {
    return await pool.query(sql, params);
  } catch (e) {
    console.error('[db] query error:', e.message, '|', sql.slice(0, 80));
    return null;
  }
}

// ─── Assessment tracking helpers ───────────────────────────────────────────────

async function findOrCreateCoach(coachName) {
  const r = await query('SELECT id FROM coaches WHERE name = $1 LIMIT 1', [coachName]);
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}

// D1 upsert: attach to an existing client on duplicate email instead of throwing.
// ON CONFLICT (email) DO NOTHING returns no row on a conflict, so a null result means
// either "email already exists" or a swallowed query() error — disambiguated by the
// case-insensitive getClientByEmail fallback (the unique index is case-sensitive, so the
// fallback also catches a differing-case duplicate the ON CONFLICT target would miss).
// Returns { id, created } — created=true only when a brand-new row was inserted.
// NOTE: return shape changed from a bare id; server.js call sites must be updated (PR8).
async function createClient(intake, coachId) {
  const r = await query(
    `INSERT INTO clients (coach_id, first_name, last_name, email, organization)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [coachId, intake.firstName, intake.lastName, intake.email, intake.organization || null]
  );
  if (r && r.rows.length > 0) return { id: r.rows[0].id, created: true };
  const existing = await getClientByEmail(intake.email);
  if (existing) return { id: existing.id, created: false };
  throw new Error('CLIENT_LOOKUP_FAILED');
}

async function createAssessment(clientId, responses, retakeOfAssessmentId = null) {
  // is_beta is mirrored from the client row at creation via subselect, so the
  // mirror is atomic with the insert and a beta tester's retake inherits the flag
  // without a separate round-trip. COALESCE guards a null/missing client row.
  const r = await query(
    `INSERT INTO assessments (client_id, status, responses, retake_of_assessment_id, is_beta)
     VALUES ($1, 'processing', $2, $3,
             COALESCE((SELECT is_beta FROM clients WHERE id = $1), FALSE))
     RETURNING id`,
    [clientId, JSON.stringify(responses), retakeOfAssessmentId]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}

// ── PROVISIONAL ASSESSMENT HELPERS (PR7a) ───────────────────────────
// The assessment-at-provisioning lifecycle flip: the row is now born at provisioning
// time as 'not_started' (createProvisionalAssessment) and later transitioned to
// 'processing' at submit (transitionAssessmentToProcessing), instead of being created
// 'processing' at submit by createAssessment. PR7a adds the helpers; PR7b/PR8 wire them
// into /api/submit and the provisioning routes.

// Create the assessment row at provisioning time with status='not_started'. status is set
// EXPLICITLY (the base column DEFAULT 'pending' is dead). client_source and the two send
// flags are stamped here (set by the provisioning modal in PR8). is_beta is mirrored from
// the client row via subselect — same atomic pattern as createAssessment — so a provisional
// row inherits the beta flag without a second round-trip.
async function createProvisionalAssessment(clientId, clientSource, autoSendReport, autoSendInvitation, retakeOfAssessmentId) {
  const r = await query(
    `INSERT INTO assessments (
       client_id,
       status,
       client_source,
       auto_send_report,
       auto_send_invitation,
       retake_of_assessment_id,
       is_beta
     )
     VALUES (
       $1,
       'not_started',
       $2,
       $3,
       $4,
       $5,
       COALESCE((SELECT is_beta FROM clients WHERE id = $1), FALSE)
     )
     RETURNING id`,
    [clientId, clientSource ?? null, autoSendReport, autoSendInvitation, retakeOfAssessmentId ?? null]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows.length > 0 ? r.rows[0].id : null;
}

// Transition a pre-existing 'not_started' row → 'processing' and write the responses
// payload. Called by /api/submit (PR7b) in place of createAssessment. The
// WHERE status='not_started' clause is the atomic application-level guard against
// double-submission / concurrent transitions (there is no DB uniqueness on
// (client_id, status)): only the first submit matches and updates a row; a second submit
// matches zero rows and gets null back. Distinguish a DB error (query() → null → throw)
// from a no-match race (zero rows → return null cleanly) via result.rows.length.
async function transitionAssessmentToProcessing(assessmentId, responses) {
  const r = await query(
    `UPDATE assessments
        SET status = 'processing',
            responses = $2
      WHERE id = $1
        AND status = 'not_started'
      RETURNING id`,
    [assessmentId, responses == null ? null : (typeof responses === 'string' ? responses : JSON.stringify(responses))]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows.length > 0 ? r.rows[0].id : null;
}

// Find the client's pre-provisioned not_started assessment row (created at provisioning
// by PR8). /api/submit calls this to locate the row to transition; a null return means
// none exists, and the caller falls back to createAssessment (self-serve path, and any
// submit before PR8 provisioning is deployed). Newest-first in the unlikely event more
// than one not_started row exists. Throws DB_ERROR on a swallowed query() error; returns
// null cleanly on zero rows.
async function getNotStartedAssessmentId(clientId) {
  const r = await query(
    `SELECT id FROM assessments
      WHERE client_id = $1
        AND status = 'not_started'
      ORDER BY created_at DESC
      LIMIT 1`,
    [clientId]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows.length > 0 ? r.rows[0].id : null;
}

// Latest assessment id for a client (by created_at), or null if none. Used by
// /api/submit to stamp retake_of_assessment_id: a client who already has an
// assessment is taking a retake, so the new row points at the prior one.
async function getLatestAssessmentId(clientId) {
  const r = await query(
    'SELECT id FROM assessments WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1',
    [clientId]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}

// Full assessment row by id, or null. Used by the EM engine to resolve client_id
// and read the stored SM verdict (api_result) for the reliability log.
async function getAssessmentById(assessmentId) {
  const r = await query('SELECT * FROM assessments WHERE id = $1 LIMIT 1', [assessmentId]);
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// A1 freeze: write api_result exactly once. The WHERE api_result IS NULL clause is the
// structural enforcement of immutability — the first write (completion / retry-when-null)
// succeeds; any later overwrite attempt updates zero rows and returns false. Callers should
// treat false as "blocked, original preserved" (and may log a warning).
async function writeApiResultOnce(assessmentId, json) {
  const r = await query(
    `UPDATE assessments SET api_result = $1 WHERE id = $2 AND api_result IS NULL`,
    [json == null ? null : (typeof json === 'string' ? json : JSON.stringify(json)), assessmentId]
  );
  return !!(r && r.rowCount > 0);
}

// A1 migration: persist the raw responses snapshot on the assessment row (self-contained
// per assessment). Replaces updateClientResponsesSnapshot as the write path.
async function saveAssessmentSnapshot(assessmentId, snapshot) {
  await query(
    `UPDATE assessments SET responses_snapshot = $1 WHERE id = $2`,
    [snapshot == null ? null : JSON.stringify(snapshot), assessmentId]
  );
}

async function completeAssessment(assessmentId, result) {
  const h = result.hypothesis || {};
  const fr = result.final_response || {};
  // v2: dominant_instinct_hypothesis replaces confirmed_instinct. We write it into both
  // the new column and the legacy confirmed_instinct column so the admin profile views
  // (which still read confirmed_instinct) keep working until the Step 7 read-side rename.
  const dominantInstinct = h.dominant_instinct_hypothesis || null;
  await query(
    `UPDATE assessments SET
       status = 'complete',
       confirmed_type = $1,
       confidence_level = $2,
       stage4_outcome = $3,
       flags = $4,
       final_response_classification = $5,
       confirmed_instinct = $6,
       dominant_instinct_hypothesis = $7,
       completed_at = NOW()
     WHERE id = $8`,
    [
      h.confirmed_type || null,
      h.confidence_level || null,
      h.stage4_outcome || null,
      JSON.stringify(result.flags || []),
      fr.classification || null,
      dominantInstinct,
      dominantInstinct,
      assessmentId,
    ]
  );
}

// Re-Run Analysis (production recovery) — UNGUARDED overwrite of api_result. The
// write-once guard in writeApiResultOnce is deliberately absent here; this is the ONE
// sanctioned path that may replace an existing (or, for a failed assessment, null)
// api_result. Distinct name so the freeze invariant stays greppable. MUST be reachable
// ONLY from the requireSuperAdmin /admin/em-rerun route — never from runBackgroundJob
// or any normal completion path.
async function forceWriteApiResult(assessmentId, json) {
  const r = await query(
    `UPDATE assessments SET api_result = $1 WHERE id = $2`,
    [json == null ? null : (typeof json === 'string' ? json : JSON.stringify(json)), assessmentId]
  );
  return !!(r && r.rowCount > 0);
}

// Re-Run Analysis — sync the denormalized verdict columns to a new api_result WITHOUT
// touching status, completed_at, or created_at (Q2: preserve the original completion
// timestamp). Mirrors the verdict-column subset of completeAssessment; intentionally
// does NOT reuse/extend it so completeAssessment's status + completed_at writes stay out.
async function updateVerdictColumns(assessmentId, result) {
  const h = (result && result.hypothesis) || {};
  const fr = (result && result.final_response) || {};
  const dominantInstinct = h.dominant_instinct_hypothesis || null;
  await query(
    `UPDATE assessments SET
       confirmed_type = $1,
       confidence_level = $2,
       stage4_outcome = $3,
       flags = $4,
       final_response_classification = $5,
       confirmed_instinct = $6,
       dominant_instinct_hypothesis = $7
     WHERE id = $8`,
    [
      h.confirmed_type || null,
      h.confidence_level || null,
      h.stage4_outcome || null,
      JSON.stringify(result.flags || []),
      fr.classification || null,
      dominantInstinct,
      dominantInstinct,
      assessmentId,
    ]
  );
}

async function failAssessment(assessmentId) {
  await query(
    `UPDATE assessments SET status = 'failed', completed_at = NOW() WHERE id = $1`,
    [assessmentId]
  );
}

// Assessment timing (§9). Writes only the four timing columns — touches no existing
// columns. Called once from /api/submit after the assessment row is created.
async function updateAssessmentTiming(assessmentId, { startedAt, completedAt, elapsedSeconds, sessionDays }) {
  await query(
    `UPDATE assessments
       SET assessment_started_at = $1, assessment_completed_at = $2,
           elapsed_seconds = $3, session_days = $4
     WHERE id = $5`,
    [startedAt, completedAt, elapsedSeconds, sessionDays, assessmentId]
  );
}

async function createReport(assessmentId, reportType, pdfPath) {
  await query(
    `INSERT INTO reports (assessment_id, report_type, pdf_path) VALUES ($1, $2, $3)`,
    [assessmentId, reportType, pdfPath]
  );
}

// Shared SELECT for the admin dashboard rows. One row per (client, assessment) —
// a client with a retake yields multiple rows. retake_of_assessment_id drives the
// "Retake" badge in the renderer. is_latest_complete flags the single newest
// completed assessment per client — the renderer uses it to scope the Retake
// button (newest complete row only) and the "Retake Pending" indicator (when the
// client has reset to not_started for a retake). getAdminRowsByCoach appends a
// coach filter; getAllAdminRows (super-admin all-clients view) does not.
const ADMIN_ROWS_SELECT = `
  SELECT
    c.id            AS client_id,
    c.first_name,
    c.last_name,
    c.email,
    c.status        AS client_status,
    a.id            AS assessment_id,
    a.confirmed_type,
    a.confirmed_instinct,
    a.instinct_confidence,
    a.confidence_level,
    a.retake_of_assessment_id,
    COALESCE(
      a.id = (SELECT a2.id FROM assessments a2
              WHERE a2.client_id = c.id AND a2.status = 'complete'
                AND a2.deleted_at IS NULL
              ORDER BY a2.created_at DESC LIMIT 1),
      FALSE
    ) AS is_latest_complete,
    a.deleted_at,
    a.pre_deletion_status,
    a.permanently_deleted,
    a.cancelled_at,
    co.name         AS coach_name,
    COALESCE(a.created_at, c.created_at) AS created_at,
    COALESCE(a.status, c.status, 'unknown') AS status,
    r_cl.pdf_path   AS client_pdf,
    r_co.pdf_path   AS coach_pdf,
    a.pdf_generated_at,
    a.email_sent_at,
    (a.scores_snapshot IS NOT NULL) AS has_scores_snapshot,
    (a.api_result IS NOT NULL)      AS has_api_result,
    a.elapsed_seconds,
    a.session_days,
    a.assessment_started_at,
    a.assessment_completed_at,
    -- Server-side completion stamp, written by completeAssessment. Distinct from
    -- assessment_completed_at, which is the client's submit time and can be NULL on rows
    -- that predate it. My Clients coalesces the two so a completed assessment always has a
    -- completion date to show. Additive column — existing consumers ignore it.
    a.completed_at  AS server_completed_at,
    c.beta_report_generated_at,
    c.beta_report_filename
  FROM clients c
  LEFT JOIN assessments a  ON a.client_id = c.id
  LEFT JOIN coaches co      ON co.id = c.coach_id
  LEFT JOIN LATERAL (SELECT pdf_path FROM reports
                     WHERE assessment_id = a.id AND report_type = 'client'
                     ORDER BY created_at DESC, id DESC LIMIT 1) r_cl ON TRUE
  LEFT JOIN LATERAL (SELECT pdf_path FROM reports
                     WHERE assessment_id = a.id AND report_type = 'coach'
                     ORDER BY created_at DESC, id DESC LIMIT 1) r_co ON TRUE
`;

// Super-admin all-clients view: every client across every coach. Coaches who are
// not super-admins use getAdminRowsByCoach (coach-scoped) instead. Permanently
// deleted assessments (tombstones) are hidden here — their home is the dedicated
// /admin/deleted-assessments page. Pending-deletion rows still appear (badged).
async function getAllAdminRows() {
  const r = await query(
    `${ADMIN_ROWS_SELECT}
     WHERE a.permanently_deleted IS NOT TRUE
     ORDER BY COALESCE(a.created_at, c.created_at) DESC NULLS LAST`
  );
  return r ? r.rows : [];
}

async function getClientReportPaths(clientId) {
  const r = await query(`
    SELECT rp.pdf_path
    FROM reports rp
    JOIN assessments a ON a.id = rp.assessment_id
    WHERE a.client_id = $1
  `, [clientId]);
  return r ? r.rows.map(row => row.pdf_path) : [];
}

// ─── Assessment soft delete (three-state) ──────────────────────────────────────

// Active → Pending deletion. Snapshots the current status (informational only;
// status itself is left untouched). Guarded on deleted_at IS NULL so a double-click
// can't overwrite an earlier snapshot.
async function markAssessmentForDeletion(assessmentId, currentStatus) {
  await query(
    `UPDATE assessments
       SET deleted_at = NOW(), pre_deletion_status = $2
     WHERE id = $1 AND deleted_at IS NULL`,
    [assessmentId, currentStatus || null]
  );
}

// Pending deletion → Active. Refuses to resurrect a tombstone
// (permanently_deleted = TRUE). Clears both soft-delete columns.
async function restoreAssessment(assessmentId) {
  await query(
    `UPDATE assessments
       SET deleted_at = NULL, pre_deletion_status = NULL
     WHERE id = $1 AND permanently_deleted = FALSE`,
    [assessmentId]
  );
}

// Pending deletion → Permanently deleted (tombstone). Sets the flag only; the row
// is intentionally never removed (audit trail, and keeping it sidesteps every FK:
// retake_of_assessment_id chains stay intact, beta_feedback CASCADE is not fired).
// PDF files and reports rows are purged by the caller before/around this flip.
async function permanentlyDeleteAssessment(assessmentId) {
  await query(
    `UPDATE assessments
       SET permanently_deleted = TRUE
     WHERE id = $1 AND deleted_at IS NOT NULL`,
    [assessmentId]
  );
}

// Every deleted assessment (pending + tombstone) for the /admin/deleted-assessments
// page, joined to client + coach + report paths. report paths back the permanent-delete
// purge; pre_deletion_status shows what the assessment was before deletion.
async function getDeletedAssessments() {
  const r = await query(`
    SELECT
      a.id            AS assessment_id,
      a.client_id,
      a.confirmed_type,
      a.confirmed_instinct,
      a.dominant_instinct_hypothesis,
      a.confidence_level,
      a.deleted_at,
      a.pre_deletion_status,
      a.permanently_deleted,
      a.is_beta,
      c.first_name,
      c.last_name,
      c.email,
      co.name         AS coach_name,
      r_cl.pdf_path   AS client_pdf,
      r_co.pdf_path   AS coach_pdf
    FROM assessments a
    JOIN clients c        ON c.id = a.client_id
    LEFT JOIN coaches co   ON co.id = c.coach_id
    LEFT JOIN reports r_cl ON r_cl.assessment_id = a.id AND r_cl.report_type = 'client'
    LEFT JOIN reports r_co ON r_co.assessment_id = a.id AND r_co.report_type = 'coach'
    WHERE a.deleted_at IS NOT NULL
    ORDER BY a.deleted_at DESC
  `);
  return r ? r.rows : [];
}

// Coach-scoped rows. By default (coach's own /admin dashboard) tombstones are
// filtered out in SQL so no permanently-deleted data is ever sent to a coach
// session (D1). The super-admin per-coach accordion on /admin/coaches passes
// includeDeleted=true to surface tombstones (audit trail) and pending rows.
async function getAdminRowsByCoach(coachId, { includeDeleted = false } = {}) {
  const deletedFilter = includeDeleted ? '' : 'AND a.permanently_deleted IS NOT TRUE';
  const r = await query(
    `${ADMIN_ROWS_SELECT}
     WHERE c.coach_id = $1 ${deletedFilter}
     ORDER BY COALESCE(a.created_at, c.created_at) DESC NULLS LAST`,
    [coachId]
  );
  return r ? r.rows : [];
}

// ── Coach Portal PR4a: My Clients (§7.2) ─────────────────────────────────────────
// Every assessment for ONE client, newest first — the detail panel's Assessment History.
// A third consumer of ADMIN_ROWS_SELECT, which already carries every column the panel
// needs (status, created_at, assessment_completed_at, confirmed_type, confirmed_instinct,
// confidence_level, retake_of_assessment_id, and the client/coach PDF paths via the
// LATERAL joins). Every other per-client assessment helper in this file is LIMIT 1.
//
// Tombstones are excluded, matching getAdminRowsByCoach — no permanently-deleted data is
// ever sent to a coach session.
async function getAssessmentsByClient(clientId) {
  const r = await query(
    `${ADMIN_ROWS_SELECT}
     WHERE c.id = $1 AND a.permanently_deleted IS NOT TRUE
     ORDER BY a.created_at DESC NULLS LAST`,
    [clientId]
  );
  // A client with zero assessments still produces one row (LEFT JOIN), with a NULL
  // assessment_id. Drop those — an empty history is empty, not a phantom entry.
  return r ? r.rows.filter(row => row.assessment_id != null) : [];
}

// Narrow writers. Deliberately NOT folded into updateClient, whose hardcoded 4-column SET
// list (first/last/email/organization) is shared with the admin edit path — widening it
// would make every admin client edit also rewrite notes/debrief.
async function setCoachNotes(clientId, notes) {
  await query(
    'UPDATE clients SET coach_notes = $1, updated_at = NOW() WHERE id = $2',
    [notes, clientId]
  );
}

// debrief_date is only meaningful when completed; clearing the flag clears the date so
// the two can't drift into "not completed, but completed on the 5th".
async function setClientDebrief(clientId, { completed, date }) {
  await query(
    `UPDATE clients
        SET debrief_completed = $1,
            debrief_date      = CASE WHEN $1 THEN $2::date ELSE NULL END,
            updated_at        = NOW()
      WHERE id = $3`,
    [!!completed, date || null, clientId]
  );
}

// ── Coach Portal PR4b: retake requests (§7.2 addendum) ───────────────────────────
// Lifecycle: pending → approved → launched, or pending → denied.
// A request is not an assessment. Launching one provisions a REAL assessment through the
// standard path (server.js), and the resulting id is recorded here.

// Deliberately bypasses query(), which swallows every error and returns null — that would
// make "another request is already open" (a 23505 unique violation on
// retake_requests_one_open) indistinguishable from a genuine DB failure, and the coach
// would get a 500 for a perfectly ordinary duplicate click. Let the index be the guard —
// a read-then-write pre-check could race two concurrent submits past it.
async function createRetakeRequest({ clientId, originalAssessmentId, coachId, reason }) {
  if (!pool) throw new Error('DB_ERROR');
  try {
    const r = await pool.query(
      `INSERT INTO retake_requests (client_id, original_assessment_id, coach_id, reason)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [clientId, originalAssessmentId || null, coachId, reason]
    );
    return r.rows[0].id;
  } catch (e) {
    if (e.code === '23505') throw new Error('REQUEST_ALREADY_OPEN');
    console.error('[db] createRetakeRequest error:', e.message);
    throw new Error('DB_ERROR');
  }
}

// The latest request per client for one coach — drives the roster badges. DISTINCT ON
// takes the newest row per client, so a client whose last request was launched shows no
// badge, while a denied one still shows "Retake Denied" until they request again.
async function getLatestRetakeRequestsByCoach(coachId) {
  const r = await query(
    `SELECT DISTINCT ON (client_id)
            id, client_id, original_assessment_id, status, reason, denial_reason,
            requested_at, reviewed_at, resulting_assessment_id, launched_at
       FROM retake_requests
      WHERE coach_id = $1
      ORDER BY client_id, requested_at DESC, id DESC`,
    [coachId]
  );
  if (!r) throw new Error('DB_ERROR');
  const byClient = new Map();
  r.rows.forEach(row => byClient.set(row.client_id, row));
  return byClient;
}

async function getLatestRetakeRequestByClient(clientId) {
  const r = await query(
    `SELECT * FROM retake_requests
      WHERE client_id = $1
      ORDER BY requested_at DESC, id DESC
      LIMIT 1`,
    [clientId]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows.length ? r.rows[0] : null;
}

async function getRetakeRequestById(id) {
  const r = await query('SELECT * FROM retake_requests WHERE id = $1 LIMIT 1', [id]);
  if (!r) throw new Error('DB_ERROR');
  return r.rows.length ? r.rows[0] : null;
}

// Admin queue. Joined out to the names the reviewer needs to make a decision.
async function getPendingRetakeRequests() {
  const r = await query(
    `SELECT rr.id, rr.reason, rr.requested_at,
            rr.client_id, rr.original_assessment_id,
            c.first_name, c.last_name, c.email AS client_email,
            co.name AS coach_name, co.email AS coach_email,
            a.created_at AS original_provisioned_at,
            COALESCE(a.assessment_completed_at, a.completed_at) AS original_completed_at
       FROM retake_requests rr
       JOIN clients c  ON c.id  = rr.client_id
       JOIN coaches co ON co.id = rr.coach_id
       LEFT JOIN assessments a ON a.id = rr.original_assessment_id
      WHERE rr.status = 'pending'
      ORDER BY rr.requested_at ASC`
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows;
}

// Both decision writers are guarded on status='pending', so a double-click (or two admins
// racing) can only land one decision. rowCount 0 means it was already decided.
async function approveRetakeRequest(id, reviewerUserId) {
  const r = await query(
    `UPDATE retake_requests
        SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
      WHERE id = $2 AND status = 'pending'
      RETURNING id`,
    [reviewerUserId, id]
  );
  if (!r) throw new Error('DB_ERROR');
  if (r.rowCount === 0) throw new Error('NOT_PENDING');
  return true;
}

async function denyRetakeRequest(id, reviewerUserId, denialReason) {
  const r = await query(
    `UPDATE retake_requests
        SET status = 'denied', denial_reason = $1, reviewed_by = $2, reviewed_at = NOW()
      WHERE id = $3 AND status = 'pending'
      RETURNING id`,
    [denialReason, reviewerUserId, id]
  );
  if (!r) throw new Error('DB_ERROR');
  if (r.rowCount === 0) throw new Error('NOT_PENDING');
  return true;
}

// Guarded on status='approved' for the same reason: two concurrent Launch clicks must not
// both provision an assessment (and both burn a credit). The caller claims the request
// FIRST, then provisions — see the route.
async function markRetakeRequestLaunched(id, assessmentId) {
  const r = await query(
    `UPDATE retake_requests
        SET status = 'launched', resulting_assessment_id = $1, launched_at = NOW()
      WHERE id = $2 AND status = 'approved'
      RETURNING id`,
    [assessmentId, id]
  );
  if (!r) throw new Error('DB_ERROR');
  if (r.rowCount === 0) throw new Error('NOT_APPROVED');
  return true;
}

// Rollback for a launch that claimed the request but then failed to provision. Puts it
// back to 'approved' so the coach can retry rather than being stranded on a dead request.
async function revertRetakeRequestToApproved(id) {
  await query(
    `UPDATE retake_requests
        SET status = 'approved', resulting_assessment_id = NULL, launched_at = NULL
      WHERE id = $1 AND status = 'launched'`,
    [id]
  );
}

async function getCoachByEmail(email) {
  const r = await query('SELECT id, name, email, password_hash, is_admin, is_active, is_super_admin FROM coaches WHERE email = $1 LIMIT 1', [email]);
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

async function getCoachById(id) {
  const r = await query(
    'SELECT id, name, email, organization, password_hash, is_admin, is_active, user_id, updated_at, updated_by FROM coaches WHERE id = $1 LIMIT 1',
    [id]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

async function updateCoach(coachId, fields, editorName) {
  await query(
    `UPDATE coaches SET name = $1, email = $2, organization = $3, updated_at = NOW(), updated_by = $4 WHERE id = $5`,
    [fields.name, fields.email, fields.organization || null, editorName, coachId]
  );
}

async function updateClient(clientId, fields, editorName) {
  await query(
    `UPDATE clients
     SET first_name = $1, last_name = $2, email = $3, organization = $4,
         updated_at = NOW(), updated_by = $5
     WHERE id = $6`,
    [fields.first_name, fields.last_name, fields.email, fields.organization || null, editorName, clientId]
  );
}

async function insertEditHistory({ record_type, record_id, edited_by_id, edited_by_name, change_summary, editor_note }) {
  await query(
    `INSERT INTO edit_history (record_type, record_id, edited_by_id, edited_by_name, change_summary, editor_note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [record_type, record_id, edited_by_id, edited_by_name, change_summary, editor_note || null]
  );
}

async function getEditHistory(recordType, recordId) {
  const r = await query(
    `SELECT id, edited_at, edited_by_id, edited_by_name, change_summary, editor_note
     FROM edit_history WHERE record_type = $1 AND record_id = $2 ORDER BY edited_at DESC`,
    [recordType, recordId]
  );
  return r ? r.rows : [];
}

// PR B: append a lifecycle event to client_history. Swallows its own errors — this is
// audit logging that fires inside fire-and-forget background jobs, email paths, and
// download streams, so a logging failure must NEVER abort the primary operation.
async function logClientEvent({ clientId, assessmentId, eventType, eventDescription, actor }) {
  try {
    if (!clientId) return;
    await query(
      `INSERT INTO client_history (client_id, assessment_id, event_type, event_description, actor)
       VALUES ($1, $2, $3, $4, $5)`,
      [clientId, assessmentId ?? null, eventType ?? null, eventDescription ?? null, actor ?? 'system']
    );
  } catch (e) {
    console.error('[client_history] logClientEvent failed:', e.message);
  }
}

async function getClientHistory(clientId) {
  const r = await query(
    `SELECT id, client_id, assessment_id, event_type, event_description, actor, created_at
     FROM client_history WHERE client_id = $1 ORDER BY created_at DESC`,
    [clientId]
  );
  return r ? r.rows : [];
}

async function getAllCoaches() {
  const r = await query(`
    SELECT co.id, co.name, co.email, co.organization, co.is_admin, co.is_active,
           COUNT(c.id) AS client_count
    FROM coaches co
    LEFT JOIN clients c ON c.coach_id = co.id
    GROUP BY co.id
    ORDER BY co.created_at ASC
  `);
  return r ? r.rows : [];
}

async function addCoach(name, email, passwordHash, organization) {
  const r = await query(
    `INSERT INTO coaches (name, email, organization, password_hash, is_admin, is_active)
     VALUES ($1, $2, $3, $4, FALSE, TRUE) RETURNING id`,
    [name, email, organization || null, passwordHash]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}

// ── Coach Portal PR2: onboarding-state writers + profile/keyword reads ────────────
// All keyed by coach_id. onboarding_completed / password_set / onboarding_welcome_seen
// live on coaches; the routes update the session flag alongside these DB writes.
async function setCoachPasswordSet(coachId) {
  await query('UPDATE coaches SET password_set = TRUE WHERE id = $1', [coachId]);
}
async function setCoachOnboardingComplete(coachId) {
  await query('UPDATE coaches SET onboarding_completed = TRUE WHERE id = $1', [coachId]);
}
async function setCoachWelcomeSeen(coachId) {
  await query('UPDATE coaches SET onboarding_welcome_seen = TRUE WHERE id = $1', [coachId]);
}

// Upsert one coach_profiles row (coach_id is UNIQUE). Arrays are passed through as
// PostgreSQL text[]. photo_url is preserved on update when not supplied (deferred in PR2).
async function upsertCoachProfile(coachId, p) {
  const r = await query(
    `INSERT INTO coach_profiles
       (coach_id, bio, icf_designations, alternate_email, phone, directory_opt_in, keywords)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (coach_id) DO UPDATE SET
       bio              = EXCLUDED.bio,
       icf_designations = EXCLUDED.icf_designations,
       alternate_email  = EXCLUDED.alternate_email,
       phone            = EXCLUDED.phone,
       directory_opt_in = EXCLUDED.directory_opt_in,
       keywords         = EXCLUDED.keywords,
       updated_at       = NOW()
     RETURNING id`,
    [coachId, p.bio || null, p.icf_designations || null, p.alternate_email || null,
     p.phone || null, !!p.directory_opt_in, p.keywords || null]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}
async function getCoachProfile(coachId) {
  const r = await query('SELECT * FROM coach_profiles WHERE coach_id = $1 LIMIT 1', [coachId]);
  return r && r.rows.length > 0 ? r.rows[0] : null;
}
// Active curated keyword labels for the autocomplete / validation set.
async function getActiveKeywordTags() {
  const r = await query('SELECT label FROM keyword_tags WHERE active = TRUE ORDER BY label');
  return r ? r.rows.map(row => row.label) : [];
}

// Reads the one-time welcome-banner flag. Used only to lazily hydrate a session that
// predates PR3 (sessions created after PR3 carry the flag from login) — see server.js.
async function getCoachWelcomeSeen(coachId) {
  const r = await query('SELECT onboarding_welcome_seen FROM coaches WHERE id = $1', [coachId]);
  if (!r) throw new Error('DB_ERROR');
  return r.rows.length > 0 ? r.rows[0].onboarding_welcome_seen === true : true;
}

// ── Coach Portal PR3: Dashboard reads (spec §7.1 Addendum v1.0) ──────────────────
// Every helper here is READ-ONLY and scoped by coach_id. Nothing in this section writes.
// In particular the milestone tracker (§"Your Journey") is driven purely by
// getCoachCompletedAssessmentCount below — the bonus-credit grant at each threshold is
// Phase 2 per the ThriveCart doc, so NO path from the Dashboard touches credit_lots or
// credit_transactions. The bar is accurate today; it simply doesn't auto-reward yet.

// "Completed" is assessments.status = 'complete' (singular — the value completeAssessment
// writes). Soft-deleted / permanently-deleted rows are excluded, matching the filter
// ADMIN_ROWS_SELECT applies, so this count and the Recent Clients table agree.
async function getCoachCompletedAssessmentCount(coachId) {
  const r = await query(
    `SELECT COUNT(*)::int AS n
       FROM assessments a
       JOIN clients c ON c.id = a.client_id
      WHERE c.coach_id = $1
        AND a.status = 'complete'
        AND a.deleted_at IS NULL
        AND a.permanently_deleted IS NOT TRUE`,
    [coachId]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows[0].n;
}

// CP-2A (ratified): an "active client" is one still in the pipeline —
// clients.status <> 'complete' (i.e. not_started + in_progress). NOTE coaches.is_active is
// a coach ban flag and has nothing to do with this; do not conflate them.
async function getCoachActiveClientCount(coachId) {
  const r = await query(
    `SELECT COUNT(*)::int AS n
       FROM clients c
      WHERE c.coach_id = $1
        AND COALESCE(c.status, 'not_started') <> 'complete'`,
    [coachId]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows[0].n;
}

// Period toggle (CP-2E) → bucket unit + how many buckets the chart plots. The unit is
// interpolated into the SQL below, so it MUST come from this whitelist and never from
// user input directly; the route validates ?period= against these keys.
const ACTIVITY_PERIODS = {
  week:  { unit: 'day',   points: 7  },   // last 7 days,   daily buckets
  month: { unit: 'week',  points: 5  },   // last 5 weeks,  weekly buckets
  year:  { unit: 'month', points: 12 },   // last 12 months, monthly buckets
};

// Two-line chart series (§"Your Activity"): assessments completed vs. clients onboarded.
// CP-2C (ratified): the "onboarded" axis is clients.created_at. The "completed" axis is
// assessments.completed_at (the server-side completion stamp written by completeAssessment).
//
// Three queries: a gapless bucket spine from Postgres generate_series, then the two
// grouped counts. The spine comes from PG rather than being recomputed in JS on purpose —
// re-deriving date_trunc('week') boundaries (ISO Monday) client-side is exactly the kind
// of off-by-one that silently misaligns a chart. The gap-fill itself is done in JS below.
async function getCoachActivitySeries(coachId, period) {
  const cfg = ACTIVITY_PERIODS[period] || ACTIVITY_PERIODS.month;
  const { unit, points } = cfg;
  const since = `date_trunc('${unit}', NOW()) - INTERVAL '${points - 1} ${unit}'`;

  const spine = await query(
    `SELECT generate_series(
              ${since},
              date_trunc('${unit}', NOW()),
              INTERVAL '1 ${unit}'
            ) AS bucket`
  );

  const completed = await query(
    `SELECT date_trunc('${unit}', a.completed_at) AS bucket, COUNT(*)::int AS n
       FROM assessments a
       JOIN clients c ON c.id = a.client_id
      WHERE c.coach_id = $1
        AND a.status = 'complete'
        AND a.deleted_at IS NULL
        AND a.permanently_deleted IS NOT TRUE
        AND a.completed_at IS NOT NULL
        AND a.completed_at >= ${since}
      GROUP BY 1
      ORDER BY 1`,
    [coachId]
  );

  const onboarded = await query(
    `SELECT date_trunc('${unit}', c.created_at) AS bucket, COUNT(*)::int AS n
       FROM clients c
      WHERE c.coach_id = $1
        AND c.created_at >= ${since}
      GROUP BY 1
      ORDER BY 1`,
    [coachId]
  );

  if (!spine || !completed || !onboarded) throw new Error('DB_ERROR');

  // Gap-fill: every bucket on the spine gets a point, zero where the coach had no
  // activity. Without this a sparse coach yields a chart with 2 points and a misleading
  // straight line between them.
  const key = (d) => new Date(d).getTime();
  const cMap = new Map(completed.rows.map(r => [key(r.bucket), r.n]));
  const oMap = new Map(onboarded.rows.map(r => [key(r.bucket), r.n]));

  return {
    unit,
    series: spine.rows.map(r => ({
      bucket:    r.bucket,
      completed: cMap.get(key(r.bucket)) || 0,
      onboarded: oMap.get(key(r.bucket)) || 0,
    })),
  };
}

// "From InsightOut" feed — 5 most recent PUBLISHED announcements. A NULL published_at is
// a draft and a future published_at is scheduled; neither is visible to a coach.
async function getPublishedAnnouncements(limit = 5) {
  const r = await query(
    `SELECT id, category, title, preview_text, published_at
       FROM announcements
      WHERE published_at IS NOT NULL
        AND published_at <= NOW()
      ORDER BY published_at DESC
      LIMIT $1`,
    [limit]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows;
}

async function setCoachActive(coachId, isActive) {
  await query(
    'UPDATE coaches SET is_active = $1 WHERE id = $2',
    [isActive, coachId]
  );
  // IAA §6 (Concern #6): login now authenticates against users.is_active, so a coach
  // deactivation must also flip the linked users row — otherwise "Deactivate" would
  // not actually block sign-in. Mirrored here (one place) rather than in each route.
  // No-op when the coach has no linked user_id (pre-migration / client-less rows).
  await query(
    `UPDATE users SET is_active = $1
      WHERE id = (SELECT user_id FROM coaches WHERE id = $2)
        AND (SELECT user_id FROM coaches WHERE id = $2) IS NOT NULL`,
    [isActive, coachId]
  );
}

// Append one row to the append-only assignment_events audit trail (PR5). Called by the
// reassign helpers below and by the provisioning path (PR8). previousCoachId is null on a
// first assignment; reason is nullable. Uses the query() wrapper (no transaction needed).
async function insertAssignmentEvent(clientId, previousCoachId, newCoachId, assignedBy, reason) {
  const r = await query(
    `INSERT INTO assignment_events
       (client_id, previous_coach_id, new_coach_id, assigned_by, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [clientId, previousCoachId ?? null, newCoachId, assignedBy ?? null, reason ?? null]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows[0];
}

// Bulk reassignment (all of one coach's clients → another). assignedBy/reason are new
// optional trailing params (default null) so existing 2-arg call sites keep working.
// Captures the affected client ids BEFORE the update, then logs one assignment_event per
// moved client. The audit write is best-effort (try/catch, no rethrow) so a logging
// failure never aborts the reassignment — preserving this helper's original never-throw
// contract, matching logClientEvent's documented discipline.
async function reassignClients(fromCoachId, toCoachId, assignedBy = null, reason = null) {
  const before = await query('SELECT id FROM clients WHERE coach_id = $1', [fromCoachId]);
  await query(
    'UPDATE clients SET coach_id = $1 WHERE coach_id = $2',
    [toCoachId, fromCoachId]
  );
  try {
    if (before) {
      for (const row of before.rows) {
        await insertAssignmentEvent(row.id, fromCoachId, toCoachId, assignedBy, reason);
      }
    }
  } catch (e) {
    console.error('[db] reassignClients: assignment_events log failed:', e.message);
  }
}

// Single reassignment. assignedBy/reason are new optional trailing params (default null).
// previousCoachId is read before the update; the audit write is best-effort (see above).
async function reassignClientToCoach(clientId, newCoachId, assignedBy = null, reason = null) {
  const prevCoachId = await getClientCoachId(clientId);
  await query('UPDATE clients SET coach_id = $1 WHERE id = $2', [newCoachId, clientId]);
  try {
    await insertAssignmentEvent(clientId, prevCoachId, newCoachId, assignedBy, reason);
  } catch (e) {
    console.error('[db] reassignClientToCoach: assignment_events log failed:', e.message);
  }
}

async function getClientCoachId(clientId) {
  const r = await query('SELECT coach_id FROM clients WHERE id = $1 LIMIT 1', [clientId]);
  return r && r.rows.length > 0 ? r.rows[0].coach_id : null;
}

async function updateCoachPassword(coachId, passwordHash) {
  await query(
    'UPDATE coaches SET password_hash = $1 WHERE id = $2',
    [passwordHash, coachId]
  );
}

async function getClientById(clientId) {
  const r = await query('SELECT * FROM clients WHERE id = $1 LIMIT 1', [clientId]);
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// Lookup by email (case-insensitive) — used to give the "create client" flow a
// specific message when createClient returns null because the clients_email_key
// UNIQUE index rejected a duplicate email (the error is otherwise swallowed by
// query() and surfaces only as a generic failure).
// PR5: projection widened from {id, coach_id} to carry the name/org the Onboard screen's
// State C1 pre-fills from. Callers that only need the ownership pair (createClient,
// resolveClientForCoach) are unaffected by the extra columns.
//
// NOTE the richer projection is for the SERVER's use. It must not be handed to the client
// wholesale: on a cross-coach match (State C2) the response is deliberately opaque, so the
// route picks fields off this row rather than serialising it — see /coach/clients/lookup.
async function getClientByEmail(email) {
  if (!email) return null;
  const r = await query(
    'SELECT id, coach_id, first_name, last_name, organization FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// ── Coach self-assessment linkage ────────────────────────────────────────────────
// Connect a newly-created user to any pre-existing client record(s) sharing its email, so
// a coach's pre-coach self-assessment (taken as a client) links to their account. The
// SEED_SQL backfill handles existing rows on every boot; this covers the moment a NEW coach
// is created, so a coach onboarded today whose client record already exists links
// immediately rather than waiting for the next boot.
//
// Guarded by `user_id IS NULL` — it never re-links an already-linked row, so it can't steal
// a client that some other user already owns. Returns how many rows it linked.
async function linkClientRecordsToUser(userId, email) {
  if (!userId || !email) return 0;
  const r = await query(
    'UPDATE clients SET user_id = $1 WHERE LOWER(email) = LOWER($2) AND user_id IS NULL RETURNING id',
    [userId, email]
  );
  return r ? r.rowCount : 0;
}

// Count a coach's OWN completed self-assessments, via the identity link (clients.user_id =
// the coach's user_id), excluding soft-deleted/tombstoned rows. Drives the /coach/reports
// zero-state vs. has-report branch. 0 → the coach has no linked report (unlinked, or not yet
// taken); the honest empty state renders.
async function getCoachSelfCompletedAssessmentCount(userId) {
  if (!userId) return 0;
  const r = await query(
    `SELECT COUNT(*)::int AS n
       FROM assessments a
       JOIN clients c ON c.id = a.client_id
      WHERE c.user_id = $1
        AND a.status = 'complete'
        AND a.deleted_at IS NULL
        AND a.permanently_deleted IS NOT TRUE`,
    [userId]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows[0].n;
}

// ── Ownership gate for client-by-email resolution (PR5-security) ─────────────────
// createClient() upserts on clients_email_key, which is UNIQUE across EVERY coach — so an
// ON CONFLICT means *someone* already owns that email, and createClient returns their row
// without ever asking whose it is. Callers that then act on the returned id are, in
// effect, acting on another coach's client.
//
// This is the ownership question createClient never asks. Any caller resolving a client
// by a caller-supplied email MUST ask it first and refuse a cross-coach match.
//
// Returns { exists, ownedByCoach, client } — the caller decides what to do about it, since
// "this is my client, add an assessment" is legitimate and "this is someone else's client"
// is not.
async function resolveClientForCoach({ email, coachId }) {
  const existing = await getClientByEmail(email);
  if (!existing) return { exists: false, ownedByCoach: false, client: null };
  return {
    exists: true,
    ownedByCoach: existing.coach_id === coachId,
    client: existing,
  };
}

async function createClientToken(clientId, token, expiresAt) {
  await query(
    `INSERT INTO client_tokens (client_id, token, expires_at) VALUES ($1, $2, $3)`,
    [clientId, token, expiresAt]
  );
}

async function getTokenWithClient(token) {
  const r = await query(`
    SELECT ct.id AS token_id, ct.client_id, ct.expires_at, ct.used_at,
           c.first_name, c.last_name, c.email, c.organization, c.status AS client_status,
           c.stage0_signal, c.ct_adjustment, c.responses_snapshot,
           c.session_state, c.is_beta,
           co.name AS coach_name, co.id AS coach_id, co.email AS coach_email,
           co.organization AS coach_organization
    FROM client_tokens ct
    JOIN clients c ON c.id = ct.client_id
    JOIN coaches co ON co.id = c.coach_id
    WHERE ct.token = $1
    LIMIT 1
  `, [token]);
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

async function updateClientStage0Signal(clientId, signal) {
  await query(
    `UPDATE clients SET stage0_signal = $1 WHERE id = $2`,
    [signal === null ? null : JSON.stringify(signal), clientId]
  );
}

async function getClientStage0Signal(clientId) {
  const r = await query('SELECT stage0_signal FROM clients WHERE id = $1 LIMIT 1', [clientId]);
  return r && r.rows.length > 0 ? r.rows[0].stage0_signal : null;
}

async function updateClientCtAdjustment(clientId, adjustment) {
  await query(
    `UPDATE clients SET ct_adjustment = $1 WHERE id = $2`,
    [adjustment === null ? null : JSON.stringify(adjustment), clientId]
  );
}

async function getClientCtAdjustment(clientId) {
  const r = await query('SELECT ct_adjustment FROM clients WHERE id = $1 LIMIT 1', [clientId]);
  return r && r.rows.length > 0 ? r.rows[0].ct_adjustment : null;
}

async function saveCall1Result(clientId, result) {
  await query(
    `UPDATE clients SET call1_result = $1 WHERE id = $2`,
    [result === null ? null : JSON.stringify(result), clientId]
  );
}

async function getCall1Result(clientId) {
  const r = await query('SELECT call1_result FROM clients WHERE id = $1 LIMIT 1', [clientId]);
  return r && r.rows.length > 0 ? r.rows[0].call1_result : null;
}

async function updateClientResponsesSnapshot(clientId, snapshot) {
  await query(
    `UPDATE clients SET responses_snapshot = $1 WHERE id = $2`,
    [snapshot === null ? null : JSON.stringify(snapshot), clientId]
  );
}

async function updateTokenUsedAt(tokenId) {
  await query(`UPDATE client_tokens SET used_at = NOW() WHERE id = $1`, [tokenId]);
}

async function updateClientStatus(clientId, status) {
  await query(`UPDATE clients SET status = $1 WHERE id = $2`, [status, clientId]);
}

async function resendInviteTransaction(clientId, newToken, expiresAt) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM client_tokens WHERE client_id = $1`, [clientId]);
    await client.query(
      `INSERT INTO client_tokens (client_id, token, expires_at) VALUES ($1, $2, $3)`,
      [clientId, newToken, expiresAt]
    );
    await client.query(`UPDATE clients SET status = 'not_started' WHERE id = $1`, [clientId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[db] resendInviteTransaction failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

// Retake (super-admin): reopen a completed client for a fresh assessment without
// touching their prior assessment rows. Mirrors resendInviteTransaction (one live
// token at a time) and additionally clears session_state/reminder_sent_at so the
// client lands on Welcome, not Resume. The new assessment row is created later by
// /api/submit, which stamps retake_of_assessment_id at that point.
async function retakeTransaction(clientId, newToken, expiresAt) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM client_tokens WHERE client_id = $1`, [clientId]);
    await client.query(
      `INSERT INTO client_tokens (client_id, token, expires_at) VALUES ($1, $2, $3)`,
      [clientId, newToken, expiresAt]
    );
    await client.query(
      `UPDATE clients SET status = 'not_started', session_state = NULL, reminder_sent_at = NULL WHERE id = $1`,
      [clientId]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[db] retakeTransaction failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

async function getAssessmentPayload(clientId) {
  const r = await query(
    `SELECT id AS assessment_id, api_result, scores_snapshot, responses, pdf_generated_at, email_sent_at
     FROM assessments WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clientId]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// ─── Coach Debrief Confirmation ────────────────────────────────────────────────

async function getAssessmentOwnerCoachId(assessmentId) {
  const r = await query(
    `SELECT c.coach_id
     FROM assessments a
     JOIN clients c ON c.id = a.client_id
     WHERE a.id = $1
     LIMIT 1`,
    [assessmentId]
  );
  return r && r.rows.length > 0 ? r.rows[0].coach_id : null;
}

async function updateCoachDebrief(assessmentId, { coach_confirmed_type, coach_confirmed_instinct, type_clarification_notes }) {
  const r = await query(
    `UPDATE assessments
       SET coach_confirmed_type     = $1,
           coach_confirmed_instinct = $2,
           type_clarification_notes = $3
     WHERE id = $4
     RETURNING coach_confirmed_type, coach_confirmed_instinct, type_clarification_notes`,
    [coach_confirmed_type, coach_confirmed_instinct, type_clarification_notes, assessmentId]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

async function getClientWithCoach(clientId) {
  const r = await query(`
    SELECT c.first_name, c.last_name, c.email, c.organization, co.name AS coach_name,
           co.email AS coach_email, co.organization AS coach_organization
    FROM clients c
    JOIN coaches co ON co.id = c.coach_id
    WHERE c.id = $1
    LIMIT 1
  `, [clientId]);
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

async function getAssessmentReports(assessmentId) {
  const r = await query(
    `SELECT report_type, pdf_path FROM reports WHERE assessment_id = $1 ORDER BY created_at DESC`,
    [assessmentId]
  );
  if (!r) return { clientPdf: null, coachPdf: null };
  const clientRow = r.rows.find(row => row.report_type === 'client');
  const coachRow  = r.rows.find(row => row.report_type === 'coach');
  return {
    clientPdf: clientRow ? clientRow.pdf_path : null,
    coachPdf:  coachRow  ? coachRow.pdf_path  : null,
  };
}

async function deleteReportsByAssessmentId(assessmentId) {
  await query(`DELETE FROM reports WHERE assessment_id = $1`, [assessmentId]);
}

async function getReportCoachId(filename) {
  const r = await query(`
    SELECT c.coach_id
    FROM reports rp
    JOIN assessments a ON a.id = rp.assessment_id
    JOIN clients c ON c.id = a.client_id
    WHERE rp.pdf_path LIKE '%' || $1
    LIMIT 1
  `, [filename]);
  return r && r.rows.length > 0 ? r.rows[0].coach_id : null;
}

async function getBetaModeEnabled() {
  const r = await query('SELECT beta_mode_enabled FROM app_settings WHERE id = 1 LIMIT 1');
  return r && r.rows.length > 0 ? r.rows[0].beta_mode_enabled : false;
}

async function setBetaModeEnabled(enabled) {
  await query('UPDATE app_settings SET beta_mode_enabled = $1 WHERE id = 1', [!!enabled]);
}

async function stampBetaReport(clientId) {
  await query(
    'UPDATE clients SET beta_report_generated_at = NOW() WHERE id = $1',
    [clientId]
  );
}

// ─── Beta feedback (per-assessment is_beta flow) ───────────────────────────────

// Set/clear the beta-tester flag on a client. The assessment row inherits this
// at creation (see createAssessment), so toggling here governs future assessments.
async function setClientBeta(clientId, isBeta) {
  await query('UPDATE clients SET is_beta = $1 WHERE id = $2', [!!isBeta, clientId]);
}

// First scalar value out of a self-hypothesis payload. The beta survey sends each as
// { values: [...], dontKnow: bool }; older callers may pass a bare array. Returns null
// for "don't know" (empty values) or any unexpected shape.
function _firstHypothesisValue(h) {
  if (h == null) return null;
  if (Array.isArray(h)) return h.length ? h[0] : null;
  if (Array.isArray(h.values)) return h.values.length ? h.values[0] : null;
  return null;
}

// Insert a beta tester's post-submit feedback. JSONB columns are stringified; the
// pg driver also accepts objects for JSONB, but we stringify to match the rest of
// this file's insert style (e.g. createAssessment, saveClientSessionState).
async function insertBetaFeedback({ assessmentId, selfHypothesisTypes, selfHypothesisInstincts, flaggedKeys, blockBAnswers, overallNotes, declaredType, declaredInstinct, declaredSubtype, declarationConfidence, moodAtTime, environmentAtTime, stateReflectionText }) {
  // The EM Lab DECLARED column reads declared_type / declared_instinct, but the survey
  // only carries the self-hypothesis. Derive the declared values from the first
  // self-hypothesis entry so new rows populate immediately (an explicit declaredType /
  // declaredInstinct, if a caller ever supplies one, still wins). Mirrors the startup
  // backfill in SCHEMA_SQL.
  const rawType = declaredType ?? _firstHypothesisValue(selfHypothesisTypes);
  const typeInt = Number.isInteger(rawType) ? rawType
    : (rawType != null && /^[0-9]+$/.test(String(rawType)) ? parseInt(rawType, 10) : null);
  const instinct = declaredInstinct ?? _firstHypothesisValue(selfHypothesisInstincts);

  const r = await query(
    `INSERT INTO beta_feedback
       (assessment_id, self_hypothesis_types, self_hypothesis_instincts, flagged_keys, block_b_answers, overall_notes,
        declared_type, declared_instinct, declared_subtype, declaration_confidence,
        mood_at_time, environment_at_time, state_reflection_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [
      assessmentId,
      JSON.stringify(selfHypothesisTypes ?? null),
      JSON.stringify(selfHypothesisInstincts ?? null),
      JSON.stringify(flaggedKeys ?? null),
      JSON.stringify(blockBAnswers ?? null),
      overallNotes ?? null,
      // Declared type/instinct (EM ground truth) — derived from the self-hypothesis above.
      typeInt,
      instinct ?? null,
      declaredSubtype ?? null,
      declarationConfidence ?? null,
      // State-at-time-of-assessment (mood/environment section). state_analysis is written
      // separately by updateBetaStateAnalysis after the non-blocking AI call resolves.
      moodAtTime ?? null,
      environmentAtTime ?? null,
      stateReflectionText ?? null,
    ]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}

// Write the coach-facing state-analysis note onto the feedback row for one assessment.
// Called by the non-blocking AI call after beta survey submission; survey submission
// never depends on this resolving.
async function updateBetaStateAnalysis(assessmentId, text) {
  await query(
    'UPDATE beta_feedback SET state_analysis = $2 WHERE assessment_id = $1',
    [assessmentId, text ?? null]
  );
}

// Latest feedback row for one assessment, or null if none.
async function getBetaFeedback(assessmentId) {
  const r = await query(
    'SELECT * FROM beta_feedback WHERE assessment_id = $1 ORDER BY submitted_at DESC LIMIT 1',
    [assessmentId]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// All feedback rows, newest first — backs the /admin/beta-review list and the
// cross-record re-analyze pass.
async function getAllBetaFeedback() {
  const r = await query('SELECT * FROM beta_feedback ORDER BY submitted_at DESC');
  return r ? r.rows : [];
}

// Respondent list for /admin/beta-review (PR-E). Driven by clients.is_beta so beta
// testers who completed but haven't submitted feedback appear as "pending". Joins the
// latest assessment (engine type/instinct) and any beta_feedback row (submitted_at).
// Submitted rows first, newest-first; pending last.
async function getBetaReviewRespondents() {
  const r = await query(`
    SELECT cl.id AS client_id, cl.first_name, cl.last_name, cl.status AS client_status,
           a.id AS assessment_id, a.confirmed_type, a.confirmed_instinct,
           a.dominant_instinct_hypothesis, a.confidence_level,
           bf.submitted_at
    FROM clients cl
    LEFT JOIN LATERAL (
      SELECT * FROM assessments WHERE client_id = cl.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1
    ) a ON TRUE
    LEFT JOIN beta_feedback bf ON bf.assessment_id = a.id
    WHERE cl.is_beta = TRUE
    ORDER BY (bf.submitted_at IS NULL), bf.submitted_at DESC
  `);
  return r ? r.rows : [];
}

// Single joined row for the tester modal (PR-E). Mirrors generate_report.js
// fetchClientRow but WITHOUT the status='complete' filter (a beta tester who submitted
// feedback may still be 'processing'), and additionally selects the engine hypothesis
// columns so Tab 1's engine side comes from the same query. responses_snapshot,
// scores_snapshot and api_result all live on assessments (A1) — exactly what buildBetaData needs.
async function getBetaReviewRow(clientId) {
  const r = await query(`
    SELECT cl.id AS client_id, cl.first_name, cl.last_name, cl.email,
           a.responses_snapshot,
           co.name AS coach_name,
           a.id AS assessment_id, a.scores_snapshot, a.api_result,
           a.created_at AS assessment_date,
           a.confirmed_type, a.confirmed_instinct, a.dominant_instinct_hypothesis,
           a.confidence_level
    FROM clients cl
    JOIN coaches co    ON co.id = cl.coach_id
    JOIN assessments a ON a.client_id = cl.id
    WHERE cl.id = $1
    ORDER BY a.created_at DESC
    LIMIT 1
  `, [clientId]);
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// Synthesis dataset for the Re-analyze pass (PR-F): every submitted feedback row
// joined to its assessment's engine hypothesis (and client name), newest first.
// Unlike getAllBetaFeedback this carries confirmed_type/instinct so the synthesis
// can compare engine vs. tester self-hypothesis without a second query.
async function getBetaFeedbackForAnalysis() {
  const r = await query(`
    SELECT bf.assessment_id, bf.self_hypothesis_types, bf.self_hypothesis_instincts,
           bf.flagged_keys, bf.block_b_answers, bf.overall_notes, bf.submitted_at,
           a.confirmed_type, a.confirmed_instinct, a.dominant_instinct_hypothesis,
           cl.first_name, cl.last_name
    FROM beta_feedback bf
    JOIN assessments a ON a.id = bf.assessment_id
    JOIN clients cl    ON cl.id = a.client_id
    WHERE a.deleted_at IS NULL
    ORDER BY bf.submitted_at DESC
  `);
  return r ? r.rows : [];
}

// beta_analysis singleton (PR-F). UPSERT overwrites the prior result on re-run.
async function saveBetaAnalysis({ analysisJson, model, tokenUsage, respondentCount }) {
  await query(`
    INSERT INTO beta_analysis (id, analysis_json, model, token_usage, respondent_count, generated_at)
    VALUES (1, $1, $2, $3, $4, NOW())
    ON CONFLICT (id) DO UPDATE SET
      analysis_json    = EXCLUDED.analysis_json,
      model            = EXCLUDED.model,
      token_usage      = EXCLUDED.token_usage,
      respondent_count = EXCLUDED.respondent_count,
      generated_at     = NOW()
  `, [
    JSON.stringify(analysisJson ?? null),
    model ?? null,
    JSON.stringify(tokenUsage ?? null),
    respondentCount ?? null,
  ]);
}

async function getBetaAnalysis() {
  const r = await query('SELECT * FROM beta_analysis WHERE id = 1 LIMIT 1');
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// Invalidate the cross-tester synthesis (nulls analysis_json, keeps the singleton
// row so the UPSERT contract in saveBetaAnalysis is preserved). Called when a beta
// assessment is permanently deleted, since the stored synthesis is then stale.
// renderBetaAnalysisHtml already renders the empty state when analysis_json is null.
async function clearBetaAnalysis() {
  await query(`UPDATE beta_analysis SET analysis_json = NULL, generated_at = NOW() WHERE id = 1`);
}

async function saveClientSessionState(clientId, sessionState) {
  await query(
    'UPDATE clients SET session_state = $1 WHERE id = $2',
    [JSON.stringify(sessionState), clientId]
  );
}

async function clearClientSessionState(clientId) {
  await query(
    'UPDATE clients SET session_state = NULL, reminder_sent_at = NULL WHERE id = $1',
    [clientId]
  );
}

async function getAbandonedClients() {
  const r = await query(`
    SELECT c.id AS client_id, c.first_name, c.email, c.reminder_sent_at,
           co.email AS coach_email, co.name AS coach_name,
           ct.token, ct.expires_at, ct.used_at
    FROM clients c
    JOIN coaches co ON co.id = c.coach_id
    JOIN client_tokens ct ON ct.client_id = c.id
    WHERE c.status = 'in_progress'
      AND c.session_state IS NOT NULL
      AND ct.used_at IS NOT NULL
      AND ct.expires_at > NOW()
    ORDER BY ct.used_at ASC
  `);
  return r ? r.rows : [];
}

async function createPdfToken(token, filename, coachId, expiresAt) {
  await query(
    `INSERT INTO pdf_tokens (token, filename, coach_id, expires_at) VALUES ($1, $2, $3, $4)`,
    [token, filename, coachId, expiresAt]
  );
}

async function getPdfToken(token) {
  const r = await query(
    `SELECT token, filename, coach_id, created_at, expires_at, redeemed_at
     FROM pdf_tokens WHERE token = $1 LIMIT 1`,
    [token]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

async function markPdfTokenRedeemed(token) {
  await query(`UPDATE pdf_tokens SET redeemed_at = NOW() WHERE token = $1`, [token]);
}

async function recordReminderSent(clientId, key, timestamp) {
  await query(
    `UPDATE clients
     SET reminder_sent_at = COALESCE(reminder_sent_at, '{}'::jsonb) || $1::jsonb
     WHERE id = $2`,
    [JSON.stringify({ [key]: timestamp }), clientId]
  );
}

// ─── Enhanced Mode (EM) helpers ────────────────────────────────────────────────

// Singleton app_settings row (id=1) — carries the global EM mode controls.
async function getAppSettings() {
  const r = await query('SELECT * FROM app_settings WHERE id = 1');
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// Update the global EM mode controls. All fields optional — COALESCE preserves the
// existing value for any field not provided (undefined/null → keep current value).
async function updateEmModeSettings({ em_active, em_analysis_mode, em_model, em_prompt_version } = {}) {
  const r = await query(
    `UPDATE app_settings
        SET em_active         = COALESCE($1, em_active),
            em_analysis_mode  = COALESCE($2, em_analysis_mode),
            em_model          = COALESCE($3, em_model),
            em_prompt_version = COALESCE($4, em_prompt_version)
      WHERE id = 1
      RETURNING *`,
    [em_active ?? null, em_analysis_mode ?? null, em_model ?? null, em_prompt_version ?? null]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// Per-client analysis_mode override, or null (inherit from global).
async function getClientAnalysisMode(clientId) {
  const r = await query('SELECT analysis_mode FROM clients WHERE id = $1', [clientId]);
  return r && r.rows.length > 0 ? r.rows[0].analysis_mode : null;
}

// Per-assessment analysis_mode override, or null (inherit).
async function getAssessmentAnalysisMode(assessmentId) {
  const r = await query('SELECT analysis_mode FROM assessments WHERE id = $1', [assessmentId]);
  return r && r.rows.length > 0 ? r.rows[0].analysis_mode : null;
}

// Persist (overwrite) the EM result JSON onto the assessment row. Stringified to
// match this file's JSONB insert style (e.g. updateClientResponsesSnapshot).
async function saveEmResult(assessmentId, resultJson) {
  await query(
    `UPDATE assessments SET experimental_raw_analysis = $1 WHERE id = $2`,
    [resultJson == null ? null : JSON.stringify(resultJson), assessmentId]
  );
}

async function getEmResult(assessmentId) {
  const r = await query('SELECT experimental_raw_analysis FROM assessments WHERE id = $1', [assessmentId]);
  return r && r.rows.length > 0 ? r.rows[0].experimental_raw_analysis : null;
}

// Append one EM run to the reliability log. All fields nullable — a failed run
// writes em_type_* = null with error_message populated. Never throws on a missing field.
async function insertEmReliabilityLog(row = {}) {
  const r = await query(
    `INSERT INTO em_reliability_log
       (assessment_id, client_id, sm_type, sm_instinct, sm_confidence,
        em_type_sonnet, em_instinct_sonnet, em_confidence_sonnet,
        em_type_opus, em_instinct_opus, em_confidence_opus,
        declared_type, declared_instinct, declaration_confidence,
        match_status, prompt_version, model_version,
        full_em_result, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING id`,
    [
      row.assessment_id ?? null,
      row.client_id ?? null,
      row.sm_type ?? null,
      row.sm_instinct ?? null,
      row.sm_confidence ?? null,
      row.em_type_sonnet ?? null,
      row.em_instinct_sonnet ?? null,
      row.em_confidence_sonnet ?? null,
      row.em_type_opus ?? null,
      row.em_instinct_opus ?? null,
      row.em_confidence_opus ?? null,
      row.declared_type ?? null,
      row.declared_instinct ?? null,
      row.declaration_confidence ?? null,
      row.match_status ?? null,
      row.prompt_version ?? null,
      row.model_version ?? null,
      row.full_em_result == null ? null : JSON.stringify(row.full_em_result),
      row.error_message ?? null,
    ]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}

// Reliability log rows, newest first, with optional filters. Each filter uses the
// (col = $n OR $n IS NULL) idiom so a null param matches all rows. Defaults: limit 50, offset 0.
async function getEmReliabilityLog({ assessmentId, clientId, promptVersion, matchStatus, limit, offset } = {}) {
  const r = await query(
    `SELECT * FROM em_reliability_log
      WHERE (assessment_id  = $1 OR $1 IS NULL)
        AND (client_id      = $2 OR $2 IS NULL)
        AND (prompt_version = $3 OR $3 IS NULL)
        AND (match_status   = $4 OR $4 IS NULL)
      ORDER BY ran_at DESC
      LIMIT $5 OFFSET $6`,
    [assessmentId ?? null, clientId ?? null, promptVersion ?? null, matchStatus ?? null, limit ?? 50, offset ?? 0]
  );
  return r ? r.rows : [];
}

// EM re-run report storage (A1). UPSERT on assessment_id — last-write-wins per
// assessment. Writes ONLY to em_rerun_reports; never touches the assessments row.
async function saveEmRerunReport(assessmentId, result, model, promptVersion) {
  await query(
    `INSERT INTO em_rerun_reports (assessment_id, result, model, prompt_version, generated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (assessment_id) DO UPDATE SET
       result         = EXCLUDED.result,
       model          = EXCLUDED.model,
       prompt_version = EXCLUDED.prompt_version,
       generated_at   = NOW()`,
    [assessmentId, result == null ? null : JSON.stringify(result), model ?? null, promptVersion ?? null]
  );
}

async function getEmRerunReport(assessmentId) {
  const r = await query('SELECT * FROM em_rerun_reports WHERE assessment_id = $1 LIMIT 1', [assessmentId]);
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// A2: record the re-run PDF paths on the existing em_rerun_reports row (written after
// the result is stored and the PDFs are generated). Does not touch the reports table.
async function updateEmRerunReportPdfPaths(assessmentId, clientPath, coachPath) {
  await query(
    `UPDATE em_rerun_reports SET rerun_client_pdf_path = $1, rerun_coach_pdf_path = $2 WHERE assessment_id = $3`,
    [clientPath ?? null, coachPath ?? null, assessmentId]
  );
}

// Per-client analysis_mode override (EM Lab profile control). mode is a string
// ('parallel'/'em_only'/'sm_only') or null to clear the override (inherit global).
async function setClientAnalysisMode(clientId, mode) {
  await query('UPDATE clients SET analysis_mode = $1 WHERE id = $2', [mode ?? null, clientId]);
}

// EM Lab roster: one row per assessment that has at least one EM run. Aggregates the
// reliability log per assessment — latest successful Sonnet run and latest successful
// Opus run (separate rows in the log) — joins client identity, the SM verdict (taken
// from the latest log row, immutable post-Call #2), the live beta_feedback declaration,
// and whether a stored EM result exists. Newest run first.
async function getEmLabRoster() {
  const r = await query(
    `SELECT a.id AS assessment_id, a.client_id,
            cl.first_name, cl.last_name, cl.email,
            (a.experimental_raw_analysis IS NOT NULL) AS has_em_result,
            son.em_type_sonnet, son.em_instinct_sonnet, son.em_confidence_sonnet, son.ran_at AS sonnet_ran_at,
            opu.em_type_opus, opu.em_instinct_opus, opu.em_confidence_opus, opu.ran_at AS opus_ran_at,
            latest.sm_type, latest.sm_instinct, latest.sm_confidence, latest.error_message AS latest_error,
            bf.declared_type, bf.declared_instinct, bf.declared_subtype, bf.declaration_confidence,
            bf.declared_type_dont_know, bf.declared_instinct_dont_know,
            GREATEST(COALESCE(son.ran_at, to_timestamp(0)), COALESCE(opu.ran_at, to_timestamp(0)),
                     COALESCE(latest.ran_at, to_timestamp(0))) AS last_run_at
       FROM assessments a
       JOIN clients cl ON cl.id = a.client_id
       LEFT JOIN LATERAL (SELECT * FROM em_reliability_log e WHERE e.assessment_id = a.id AND e.em_type_sonnet IS NOT NULL ORDER BY e.ran_at DESC LIMIT 1) son ON TRUE
       LEFT JOIN LATERAL (SELECT * FROM em_reliability_log e WHERE e.assessment_id = a.id AND e.em_type_opus   IS NOT NULL ORDER BY e.ran_at DESC LIMIT 1) opu ON TRUE
       LEFT JOIN LATERAL (SELECT * FROM em_reliability_log e WHERE e.assessment_id = a.id ORDER BY e.ran_at DESC LIMIT 1) latest ON TRUE
       LEFT JOIN LATERAL (SELECT * FROM beta_feedback b WHERE b.assessment_id = a.id ORDER BY b.submitted_at DESC LIMIT 1) bf ON TRUE
      WHERE EXISTS (SELECT 1 FROM em_reliability_log e WHERE e.assessment_id = a.id)
        AND a.deleted_at IS NULL
      ORDER BY last_run_at DESC`
  );
  return r ? r.rows : [];
}

// Set/update the declared type + instinct for an assessment from the EM Lab editor.
// "Don't Know" is authoritative: when a dont_know flag is true the paired value is
// forced to NULL regardless of what the caller passed (the route validates too, but
// we enforce here as the last line of defence). UPDATEs the latest beta_feedback row
// for the assessment; if the tester has no feedback row yet (the roster is driven by
// em_reliability_log, not beta_feedback), INSERTs a bare declaration row.
async function upsertDeclaration(assessmentId, { declaredType, typeDontKnow, declaredInstinct, instinctDontKnow } = {}) {
  const tdk = !!typeDontKnow;
  const idk = !!instinctDontKnow;
  const type = tdk ? null : (Number.isInteger(declaredType) ? declaredType : null);
  const instinct = idk ? null : (declaredInstinct || null);

  const upd = await query(
    `UPDATE beta_feedback
        SET declared_type = $2, declared_type_dont_know = $3,
            declared_instinct = $4, declared_instinct_dont_know = $5
      WHERE id = (SELECT id FROM beta_feedback WHERE assessment_id = $1 ORDER BY submitted_at DESC LIMIT 1)`,
    [assessmentId, type, tdk, instinct, idk]
  );
  if (upd && upd.rowCount > 0) return;

  await query(
    `INSERT INTO beta_feedback
       (assessment_id, declared_type, declared_type_dont_know, declared_instinct, declared_instinct_dont_know)
     VALUES ($1, $2, $3, $4, $5)`,
    [assessmentId, type, tdk, instinct, idk]
  );
}

// ═══ IAA v1.2 — Phase C: password reset + identity lookups ══════════════════════

// User lookup by id — the credential of record for the change-password flow (login
// and password writes both key on the users table post-Phase-B).
async function getUserById(userId) {
  const r = await query(
    'SELECT id, email, password_hash, is_active FROM users WHERE id = $1 LIMIT 1',
    [userId]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// Store a reset token. Only the SHA-256 hash is persisted (never the plaintext).
async function createPasswordResetToken(userId, tokenHash, expiresAt) {
  const r = await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3) RETURNING id`,
    [userId, tokenHash, expiresAt]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}

async function getPasswordResetToken(tokenHash) {
  const r = await query(
    `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens WHERE token_hash = $1 LIMIT 1`,
    [tokenHash]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// Single-use enforcement: only flips an as-yet-unused token.
async function markResetTokenUsed(tokenId) {
  await query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1 AND used_at IS NULL`,
    [tokenId]
  );
}

// Expire any outstanding unused tokens for a user (called when issuing a new one).
async function invalidateUserResetTokens(userId) {
  await query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
}

// ═══ IAA v1.2 — Phase D: role management + embargo helpers ══════════════════════

// All four roles (static reference) for the role-management checkboxes.
async function getAllRoles() {
  const r = await query('SELECT id, name, description FROM roles ORDER BY id');
  return r ? r.rows : [];
}

// A user's roles with grant metadata (granted_at / granted_by) for the modal.
async function getUserRolesWithMeta(userId) {
  const r = await query(
    `SELECT r.id, r.name, ur.granted_at, ur.granted_by
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
      ORDER BY r.id`,
    [userId]
  );
  return r ? r.rows : [];
}

// Grant a single role (idempotent via the composite PK). granted_by records the actor.
async function assignRole(userId, roleName, grantedBy) {
  await query(
    `INSERT INTO user_roles (user_id, role_id, granted_by)
     SELECT $1, r.id, $3 FROM roles r WHERE r.name = $2
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleName, grantedBy]
  );
}

// Revoke a single role. Returns rowCount so callers can detect a no-op.
async function revokeRole(userId, roleName) {
  const r = await query(
    `DELETE FROM user_roles
      WHERE user_id = $1
        AND role_id = (SELECT id FROM roles WHERE name = $2)`,
    [userId, roleName]
  );
  return r ? r.rowCount : 0;
}

// How many users hold a given role — the last-super_admin guard reads this.
async function countRoleHolders(roleName) {
  const r = await query(
    `SELECT COUNT(*)::int AS count
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
      WHERE r.name = $1`,
    [roleName]
  );
  return r && r.rows.length > 0 ? r.rows[0].count : 0;
}

// Identity-level active flag (full ban / restore). Distinct from coaches.is_active.
async function setUserActive(userId, isActive) {
  await query('UPDATE users SET is_active = $2 WHERE id = $1', [userId, isActive]);
}

// Embargo list for the management page (with the adding super-admin's email).
async function getEmbargoList() {
  const r = await query(
    `SELECT e.id, e.value, e.match_type, e.reason,
            e.embargoed_by, e.created_at,
            u.email AS embargoed_by_email
       FROM embargo_list e
       LEFT JOIN users u ON u.id = e.embargoed_by
      ORDER BY e.created_at DESC`
  );
  return r ? r.rows : [];
}

// Add an embargo entry. Returns the new id, or null if the value already existed.
async function addEmbargo(value, matchType, reason, embargoedBy) {
  const r = await query(
    `INSERT INTO embargo_list (value, match_type, reason, embargoed_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (value) DO NOTHING
     RETURNING id`,
    [value, matchType, reason || null, embargoedBy]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}

async function removeEmbargo(id) {
  await query('DELETE FROM embargo_list WHERE id = $1', [id]);
}

// Existing users matching a new embargo entry — their sessions get invalidated.
// Exact: email equality. Domain: email ending in the '@domain.com' suffix.
async function getUsersByEmbargo(value, matchType) {
  const sql = matchType === 'domain'
    ? `SELECT id FROM users WHERE email LIKE '%' || $1`
    : `SELECT id FROM users WHERE email = $1`;
  const r = await query(sql, [value]);
  return r ? r.rows : [];
}

// ── CREDIT HELPERS (PR4) ────────────────────────────────────────────
// Lot-based credit ledger (spec §5.3). Every mutation is transactional and uses
// pool.connect() directly (NOT the query() wrapper, which swallows errors and returns
// null) so a mid-transaction failure ROLLs BACK and re-throws — mirroring
// resendInviteTransaction. credit_transactions is append-only; credit_lots.quantity_remaining
// is the spendable count. insertCreditTransaction takes a caller-supplied pg client and is
// only ever called INSIDE one of these transactions (never standalone).

// Current spendable balance for an account + credit type: sum of quantity_remaining
// across non-exhausted lots. Read-only, so it uses the query() wrapper — but a null
// return means the statement threw (query() swallows), which we surface as DB_ERROR
// rather than silently reporting a zero balance.
async function getAccountBalance(accountId, creditTypeName) {
  const r = await query(
    `SELECT COALESCE(SUM(cl.quantity_remaining), 0) AS balance
       FROM credit_lots cl
       JOIN credit_types ct ON cl.credit_type_id = ct.id
      WHERE cl.account_id = $1
        AND ct.name = $2
        AND cl.quantity_remaining > 0`,
    [accountId, creditTypeName]
  );
  if (!r) throw new Error('DB_ERROR');
  return { balance: Number(r.rows[0].balance) };
}

// Append one row to the append-only credit_transactions ledger. ALWAYS called with a
// caller-supplied pg client (txClient) inside an open transaction — never standalone —
// so a failure propagates to the caller's catch/ROLLBACK. lotId, assessmentId, and notes
// are all nullable. Returns the inserted row.
async function insertCreditTransaction(client, { accountId, creditTypeId, lotId, eventType, quantity, assessmentId, createdBy, notes }) {
  const r = await client.query(
    `INSERT INTO credit_transactions
       (account_id, credit_type_id, lot_id, event_type, quantity,
        assessment_id, created_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [accountId, creditTypeId, lotId ?? null, eventType, quantity,
     assessmentId ?? null, createdBy ?? null, notes ?? null]
  );
  return r.rows[0];
}

// FIFO consume at provisioning time (PR6a: variable cost, was hardcoded 1).
//
// The cost comes from credit_types.current_cost_credits, read inside the SAME locked
// transaction as the drain — so a mid-flight cost change can never tear a consume.
//
// A cost of N > 1 may not fit in a single lot: a coach holding lot A (2 left) and lot B
// (10 left) has 12 credits, and a 5-credit assessment must take 2 from A and 3 from B.
// So this drains lots FIFO and writes ONE 'consumed' ledger row PER LOT TOUCHED
// (-2 against A, -3 against B). That keeps the ledger reconciled against credit_lots:
// every row names the lot it actually came out of, which is what lets cancellation put
// each portion back where it came from. The old code took 1 from 1 lot; simply changing
// that to "- N" would have driven lot A to -3.
//
// When the balance is short, behaviour depends on app_settings.credit_enforcement_enabled:
// FALSE (launch default) logs a single enforcement_disabled row with a NULL lot for the
// FULL cost and succeeds, so the ledger stays accurate for the eventual enforcement flip;
// TRUE (or unreadable settings) rejects with INSUFFICIENT_CREDITS and touches nothing.
//
// Returns { cost, lotId, transactionId, allocations } where allocations is
// [{ lotId, quantity, transactionId }, …] — one entry per lot drained. lotId/transactionId
// remain as the FIRST allocation for backwards compatibility with existing callers (the
// provisioning ledger back-patch reads transactionId).
async function consumeCredit(accountId, creditTypeName, assessmentId, createdBy) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // a. Resolve credit type → id AND its current cost, in the one SELECT that already
    //    existed. NULL cost = the type isn't sellable yet (leadership/team); refuse rather
    //    than silently defaulting to 1, which is how this class of bug started.
    const typeRes = await client.query(
      'SELECT id, current_cost_credits FROM credit_types WHERE name = $1',
      [creditTypeName]
    );
    if (typeRes.rows.length === 0) throw new Error('UNKNOWN_CREDIT_TYPE');
    const creditTypeId = typeRes.rows[0].id;
    const cost = typeRes.rows[0].current_cost_credits;
    if (!Number.isInteger(cost) || cost <= 0) throw new Error('CREDIT_COST_NOT_SET');

    // b. Every non-exhausted lot, oldest first, row-locked against concurrent consumers.
    //    (Was LIMIT 1; a multi-credit cost may span lots.)
    const lotRes = await client.query(
      `SELECT id, quantity_remaining
         FROM credit_lots
        WHERE account_id = $1
          AND credit_type_id = $2
          AND quantity_remaining > 0
        ORDER BY created_at ASC, id ASC
        FOR UPDATE`,
      [accountId, creditTypeId]
    );

    const available = lotRes.rows.reduce((sum, l) => sum + l.quantity_remaining, 0);

    // c. Not enough credits → enforcement decides.
    if (available < cost) {
      const settings = await getAppSettings();
      const enforcementEnabled = !settings || settings.credit_enforcement_enabled === true;
      if (enforcementEnabled) {
        await client.query('ROLLBACK');
        throw new Error('INSUFFICIENT_CREDITS');
      }
      // Enforcement off: record the FULL cost against a null lot and take nothing from the
      // lots. Partially draining here would leave the coach short AND unblocked — the worst
      // of both. The ledger row still nets correctly if the credit is later restored.
      const tx = await insertCreditTransaction(client, {
        accountId,
        creditTypeId,
        lotId: null,
        eventType: 'consumed',
        quantity: cost,
        assessmentId,
        createdBy,
        notes: 'enforcement_disabled',
      });
      await client.query('COMMIT');
      return {
        cost,
        lotId: null,
        transactionId: tx.id,
        allocations: [{ lotId: null, quantity: cost, transactionId: tx.id }],
      };
    }

    // d. Drain FIFO across lots, one ledger row per lot touched.
    let outstanding = cost;
    const allocations = [];
    for (const lot of lotRes.rows) {
      if (outstanding === 0) break;
      const take = Math.min(lot.quantity_remaining, outstanding);

      await client.query(
        `UPDATE credit_lots SET quantity_remaining = quantity_remaining - $1 WHERE id = $2`,
        [take, lot.id]
      );
      const tx = await insertCreditTransaction(client, {
        accountId,
        creditTypeId,
        lotId: lot.id,
        eventType: 'consumed',
        quantity: take,
        assessmentId,
        createdBy,
        notes: null,
      });

      allocations.push({ lotId: lot.id, quantity: take, transactionId: tx.id });
      outstanding -= take;
    }

    // Belt-and-braces: `available >= cost` above guarantees this, but a drain that failed
    // to satisfy the cost must never commit a half-paid assessment.
    if (outstanding !== 0) throw new Error('CREDIT_DRAIN_INCOMPLETE');

    await client.query('COMMIT');
    return {
      cost,
      lotId: allocations[0].lotId,
      transactionId: allocations[0].transactionId,
      allocations,
    };
  } catch (e) {
    // ROLLBACK is a no-op if the transaction is already rolled back (e.g. the
    // INSUFFICIENT_CREDITS path above); guarded so it never masks the original error.
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (!['INSUFFICIENT_CREDITS', 'UNKNOWN_CREDIT_TYPE', 'CREDIT_COST_NOT_SET'].includes(e.message)) {
      console.error('[db] consumeCredit failed:', e.message);
    }
    throw e;
  } finally {
    client.release();
  }
}

// The live per-assessment cost. Used by the UI copy so nothing re-hardcodes a 5.
async function getCreditCost(creditTypeName) {
  const r = await query('SELECT current_cost_credits FROM credit_types WHERE name = $1', [creditTypeName]);
  if (!r) throw new Error('DB_ERROR');
  return r.rows.length > 0 ? r.rows[0].current_cost_credits : null;
}

// ── Credit cost admin (PR6a amendment) ───────────────────────────────────────────

// Every sellable credit type + its current cost and most recent change, for the admin
// page. LEFT JOIN LATERAL so a type that has never been changed still lists (with a null
// last-change), rather than vanishing from the page.
async function getCreditTypesWithCost() {
  const r = await query(
    `SELECT ct.id, ct.name, ct.description, ct.current_cost_credits,
            h.previous_cost_credits AS last_previous_cost,
            h.new_cost_credits      AS last_new_cost,
            h.changed_at            AS last_changed_at,
            h.note                  AS last_note,
            u.email                 AS last_changed_by_email
       FROM credit_types ct
       LEFT JOIN LATERAL (
         SELECT * FROM credit_type_cost_history
          WHERE credit_type_id = ct.id
          ORDER BY changed_at DESC, id DESC
          LIMIT 1
       ) h ON TRUE
       LEFT JOIN users u ON u.id = h.changed_by
      ORDER BY ct.id`
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows;
}

async function getCreditCostHistory(creditTypeName, limit = 20) {
  const r = await query(
    `SELECT h.id, h.previous_cost_credits, h.new_cost_credits, h.changed_at, h.note,
            u.email AS changed_by_email
       FROM credit_type_cost_history h
       JOIN credit_types ct ON ct.id = h.credit_type_id
       LEFT JOIN users u ON u.id = h.changed_by
      WHERE ct.name = $1
      ORDER BY h.changed_at DESC, h.id DESC
      LIMIT $2`,
    [creditTypeName, limit]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows;
}

// ── Coach Portal PR6: Manage Credits (§7.4) reads ────────────────────────────────

// The three summary stats, in ONE grouped query. All three are REMAINING balances
// (SUM(quantity_remaining) by source), confirmed by the mockup's arithmetic
// (purchased + complimentary = available) — not lifetime totals. Scoped to one account
// and the standard_assessment type (the only sellable one).
//
//   available     — total remaining across all lots
//   purchased     — remaining in source='purchased' lots + how many such lots exist
//   complimentary — remaining in source='granted' lots
async function getCreditSummary(accountId) {
  const r = await query(
    `SELECT
       COALESCE(SUM(cl.quantity_remaining), 0)                                              AS available,
       COALESCE(SUM(cl.quantity_remaining) FILTER (WHERE cl.source = 'purchased'), 0)       AS purchased,
       COALESCE(COUNT(*)                   FILTER (WHERE cl.source = 'purchased'), 0)        AS purchased_lots,
       COALESCE(SUM(cl.quantity_remaining) FILTER (WHERE cl.source = 'granted'), 0)         AS complimentary
     FROM credit_lots cl
     JOIN credit_types ct ON ct.id = cl.credit_type_id
    WHERE cl.account_id = $1
      AND ct.name = 'standard_assessment'`,
    [accountId]
  );
  if (!r) throw new Error('DB_ERROR');
  const row = r.rows[0];
  return {
    available:     Number(row.available),
    purchased:     Number(row.purchased),
    purchasedLots: Number(row.purchased_lots),
    complimentary: Number(row.complimentary),
  };
}

// The full transaction history for the credit account, newest first, WITH a running
// balance. The four flavors (§7.4) are distinguished here:
//   consumed                         → "Assessment — {client}"          -N
//   granted + lot.source='purchased' → "Purchase — …"                   +N
//   granted + lot.source='granted'   → "Complimentary Grant …"          +N
//   restored                         → "Refund — Assessment cancelled"  +N
// so event_type alone is not enough — the lot's source disambiguates the two 'granted'
// cases. LEFT JOINs throughout: an enforcement_disabled consume has lot_id NULL, and a
// consume/restore has no purchase lot to price from.
//
// The signed delta and the running balance are computed IN SQL so the client never has to
// re-derive them (and can't get them wrong). The running total is a window function over
// the WHOLE account history in chronological order; we then return newest-first for
// display. Whole set is returned — pagination is client-side (low per-coach volume), and
// the balance can only be a running total if every prior row is present anyway.
async function getCreditHistory(accountId) {
  const r = await query(
    `WITH ledger AS (
       SELECT
         ct.id,
         ct.created_at,
         ct.event_type,
         ct.quantity,
         ct.lot_id,
         ct.assessment_id,
         cl.source            AS lot_source,
         cl.quantity          AS lot_quantity,
         cl.price_paid_cents  AS lot_price_cents,
         c.first_name, c.last_name, c.email AS client_email,
         -- signed delta: consumed is the only debit; everything else adds.
         CASE WHEN ct.event_type = 'consumed' THEN -ct.quantity ELSE ct.quantity END AS delta
       FROM credit_transactions ct
       LEFT JOIN credit_lots  cl ON cl.id = ct.lot_id
       LEFT JOIN assessments  a  ON a.id  = ct.assessment_id
       LEFT JOIN clients      c  ON c.id  = a.client_id
       WHERE ct.account_id = $1
     )
     SELECT *,
            SUM(delta) OVER (
              ORDER BY created_at ASC, id ASC
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS balance_after
       FROM ledger
      ORDER BY created_at DESC, id DESC`,
    [accountId]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows;
}

// Account-scoped lookup for the purchase-status poll (§7.4 processing→success). Scoped to
// the caller's OWN account on purpose: without that, the poll is an order-enumeration
// oracle — any coach could probe arbitrary order ids and learn which ones landed. A
// foreign or bogus order id simply returns null → the poll reads it as still-processing,
// which is harmless. purchase_reference holds the ThriveCart order_id (see the webhook).
async function getPurchaseByReference(accountId, orderId) {
  const r = await query(
    `SELECT cl.id, cl.quantity, cl.created_at
       FROM credit_lots cl
      WHERE cl.account_id = $1
        AND cl.purchase_reference = $2
      LIMIT 1`,
    [accountId, orderId]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows.length > 0 ? r.rows[0] : null;
}

// Change a credit type's cost AND write its audit row in ONE transaction — the change and
// the record of it must be atomic, or a crash between them leaves a price move with no
// paper trail, which is the exact thing the history table exists to prevent.
//
// The row is locked FOR UPDATE so two admins racing can't interleave and record a
// previous_cost that was never actually the previous cost.
//
// Guarded to sellable types: a type whose current_cost_credits is NULL is not for sale
// (leadership/team), and this is not the route that makes it sellable — that decision
// carries pricing and product weight and should be deliberate, not a side effect of
// someone typing in a number here.
async function setCreditCost(creditTypeName, newCost, changedBy, note) {
  if (!pool) throw new Error('DB_ERROR');
  if (!Number.isInteger(newCost) || newCost <= 0) throw new Error('INVALID_COST');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const typeRes = await client.query(
      'SELECT id, current_cost_credits FROM credit_types WHERE name = $1 FOR UPDATE',
      [creditTypeName]
    );
    if (typeRes.rows.length === 0) throw new Error('UNKNOWN_CREDIT_TYPE');

    const { id: creditTypeId, current_cost_credits: previousCost } = typeRes.rows[0];
    if (previousCost == null) throw new Error('CREDIT_TYPE_NOT_SELLABLE');

    if (previousCost === newCost) {
      await client.query('ROLLBACK');
      return { changed: false, previousCost, newCost };
    }

    await client.query(
      'UPDATE credit_types SET current_cost_credits = $1 WHERE id = $2',
      [newCost, creditTypeId]
    );
    await client.query(
      `INSERT INTO credit_type_cost_history
         (credit_type_id, previous_cost_credits, new_cost_credits, changed_by, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [creditTypeId, previousCost, newCost, changedBy ?? null, note || null]
    );

    await client.query('COMMIT');
    return { changed: true, previousCost, newCost };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (!['INVALID_COST', 'UNKNOWN_CREDIT_TYPE', 'CREDIT_TYPE_NOT_SELLABLE'].includes(e.message)) {
      console.error('[db] setCreditCost failed:', e.message);
    }
    throw e;
  } finally {
    client.release();
  }
}

// Restore exactly one credit to the SAME lot it was consumed from (cancellation path,
// PR5). Increments quantity_remaining on that lot and logs a 'restored' transaction.
// The lot must belong to the given account, else LOT_NOT_FOUND (guards against restoring
// into someone else's lot). Single transaction.
// PR6a: quantity is now an explicit REQUIRED argument, not a hardcoded 1. This helper has
// no callers today (cancelAssessment inlines its own restore on a shared txClient), but it
// is exported — leaving a silent +1 in it would have handed the next caller the exact bug
// PR6a exists to fix.
async function restoreCredit(accountId, creditTypeName, assessmentId, lotId, quantity, createdBy) {
  if (!pool) return;
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('INVALID_RESTORE_QUANTITY');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // a. Resolve credit type name → id.
    const typeRes = await client.query('SELECT id FROM credit_types WHERE name = $1', [creditTypeName]);
    if (typeRes.rows.length === 0) throw new Error('UNKNOWN_CREDIT_TYPE');
    const creditTypeId = typeRes.rows[0].id;

    // b. Increment the original lot, scoped to this account.
    const lotRes = await client.query(
      `UPDATE credit_lots
          SET quantity_remaining = quantity_remaining + $1
        WHERE id = $2 AND account_id = $3
        RETURNING id, quantity_remaining`,
      [quantity, lotId, accountId]
    );
    if (lotRes.rows.length === 0) throw new Error('LOT_NOT_FOUND');
    const newQuantityRemaining = lotRes.rows[0].quantity_remaining;

    // c. Log the restore.
    const tx = await insertCreditTransaction(client, {
      accountId,
      creditTypeId,
      lotId,
      eventType: 'restored',
      quantity,
      assessmentId,
      createdBy,
      notes: null,
    });

    await client.query('COMMIT');
    return { lotId, newQuantityRemaining, transactionId: tx.id };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (e.message !== 'LOT_NOT_FOUND' && e.message !== 'UNKNOWN_CREDIT_TYPE') {
      console.error('[db] restoreCredit failed:', e.message);
    }
    throw e;
  } finally {
    client.release();
  }
}

// Create a new granted (free) lot and log a 'granted' transaction. Used by the admin
// Grant Credits UI (PR11) and the ThriveCart webhook (PR9). source='granted', so
// price_paid_cents / purchase_reference are NULL. quantity_remaining seeds equal to
// quantity. Single transaction.
async function grantCredits(toAccountId, creditTypeName, quantity, grantedBy, notes) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // a. Resolve credit type name → id.
    const typeRes = await client.query('SELECT id FROM credit_types WHERE name = $1', [creditTypeName]);
    if (typeRes.rows.length === 0) throw new Error('UNKNOWN_CREDIT_TYPE');
    const creditTypeId = typeRes.rows[0].id;

    // b. Create the granted lot.
    const lotRes = await client.query(
      `INSERT INTO credit_lots
         (account_id, credit_type_id, quantity, quantity_remaining,
          source, price_paid_cents, purchase_reference)
       VALUES ($1, $2, $3, $3, 'granted', NULL, NULL)
       RETURNING id`,
      [toAccountId, creditTypeId, quantity]
    );
    const newLotId = lotRes.rows[0].id;

    // c. Log the grant.
    const tx = await insertCreditTransaction(client, {
      accountId: toAccountId,
      creditTypeId,
      lotId: newLotId,
      eventType: 'granted',
      quantity,
      assessmentId: null,
      createdBy: grantedBy,
      notes,
    });

    await client.query('COMMIT');
    return { lotId: newLotId, transactionId: tx.id };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (e.message !== 'UNKNOWN_CREDIT_TYPE') {
      console.error('[db] grantCredits failed:', e.message);
    }
    throw e;
  } finally {
    client.release();
  }
}

// ── PURCHASED CREDIT HELPER (PR9) ───────────────────────────────────
// Record a PAID credit lot (source='purchased', with price + purchase_reference) and log
// the ledger row — distinct from grantCredits (free grants). Idempotent: the partial unique
// index credit_lots_purchase_reference_key + ON CONFLICT DO NOTHING means a duplicate
// purchaseReference (ThriveCart retry) inserts nothing and returns { alreadyProcessed: true }
// WITHOUT throwing, so the webhook can answer 200 on a retry. Single transaction; the
// event_type stays 'granted' to match the credit_transactions CHECK (consumed|restored|granted).
async function recordPurchasedCredits(toAccountId, creditTypeName, quantity, purchaseReference, pricePaidCents, grantedBy, notes) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // a. Resolve credit type name → id.
    const typeRes = await client.query('SELECT id FROM credit_types WHERE name = $1', [creditTypeName]);
    if (typeRes.rows.length === 0) throw new Error('UNKNOWN_CREDIT_TYPE');
    const creditTypeId = typeRes.rows[0].id;

    // b. Insert the purchased lot, guarded by the purchase_reference unique index.
    const lotRes = await client.query(
      `INSERT INTO credit_lots
         (account_id, credit_type_id, quantity, quantity_remaining,
          source, price_paid_cents, purchase_reference)
       VALUES ($1, $2, $3, $3, 'purchased', $4, $5)
       ON CONFLICT (purchase_reference) WHERE purchase_reference IS NOT NULL DO NOTHING
       RETURNING id`,
      [toAccountId, creditTypeId, quantity, pricePaidCents ?? null, purchaseReference]
    );
    if (lotRes.rows.length === 0) {
      // Conflict → this purchase_reference was already recorded. Idempotent no-op.
      await client.query('ROLLBACK');
      return { alreadyProcessed: true };
    }
    const newLotId = lotRes.rows[0].id;

    // c. Log the grant transaction.
    const tx = await insertCreditTransaction(client, {
      accountId: toAccountId,
      creditTypeId,
      lotId: newLotId,
      eventType: 'granted',
      quantity,
      assessmentId: null,
      createdBy: grantedBy,
      notes,
    });

    await client.query('COMMIT');
    return { lotId: newLotId, transactionId: tx.id, alreadyProcessed: false };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (e.message !== 'UNKNOWN_CREDIT_TYPE') {
      console.error('[db] recordPurchasedCredits failed:', e.message);
    }
    throw e;
  } finally {
    client.release();
  }
}

// ── ACCOUNT LOOKUP HELPERS (PR8) ────────────────────────────────────
// Resolve which billing account a provisioning consume should debit. Both return a scalar
// account id (or null), read-only via query(); a null query() result (DB error) surfaces as
// DB_ERROR so the caller never mistakes an error for "no account".

// A coach's own billing account (1:1 via the accounts_coach_id_key partial unique index).
async function getAccountByCoachId(coachId) {
  const r = await query(
    `SELECT id FROM accounts
      WHERE coach_id = $1
        AND account_type = 'coach'
      LIMIT 1`,
    [coachId]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows.length > 0 ? r.rows[0].id : null;
}

// The single house account (coach_id NULL) — bills D2C / house-provisioned assessments.
async function getHouseAccount() {
  const r = await query(
    `SELECT id FROM accounts
      WHERE account_type = 'house'
      LIMIT 1`
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows.length > 0 ? r.rows[0].id : null;
}

// ── PROVISIONING/CANCELLATION HELPERS (PR5) ──────────────────────────
// Placed directly below the PR4 credit block because cancellation is credit-adjacent
// (it restores a consumed credit). account_id / lot_id are NOT stored on assessments;
// they are recovered from the credit_transactions ledger via getConsumedCreditTxs.

// The 'consumed' ledger rows for an assessment — the source of truth for which account,
// lots, and credit type a provisioning consume drew from (there is no account_id column on
// assessments). Returns [] if none (caller handles the no-ledger case — e.g. an assessment
// provisioned before the credit ledger existed). A null query() result is DB_ERROR.
//
// PR6a: returns ALL consumed rows for an assessment, not just the first, and now includes
// `quantity`. A 5-credit consume that spanned two lots wrote two rows; refunding only the
// first would silently destroy the rest of the coach's credits. Was LIMIT 1 without
// quantity, back when a consume was always exactly one row of exactly 1.
async function getConsumedCreditTxs(assessmentId) {
  const r = await query(
    `SELECT id, account_id, lot_id, credit_type_id, quantity
       FROM credit_transactions
      WHERE assessment_id = $1
        AND event_type = 'consumed'
      ORDER BY created_at ASC, id ASC`,
    [assessmentId]
  );
  if (!r) throw new Error('DB_ERROR');
  return r.rows;
}

// Cancel a not_started assessment and restore its credit in one transaction (D3: cancel ≠
// soft-delete — this stamps only cancelled_at/cancellation_reason/credit_restored_at and
// never touches deleted_at/status). Eligibility is 'not_started' AND not already cancelled;
// once status advances past not_started the credit is consumed and cancellation is offline
// (Cai/Mo). The restoreCredit logic is INLINED on the same txClient (rather than calling the
// exported restoreCredit, which opens its own connection) to avoid a nested transaction.
async function cancelAssessment(assessmentId, reason, cancelledBy) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // a. Lock the assessment. account_id is intentionally NOT selected — the column does
    //    not exist on assessments; account/lot come from the ledger in step b.
    const aRes = await client.query(
      `SELECT id, status, cancelled_at FROM assessments WHERE id = $1 FOR UPDATE`,
      [assessmentId]
    );
    if (aRes.rows.length === 0) throw new Error('ASSESSMENT_NOT_FOUND');
    // Guard both the status AND an already-cancelled row: re-cancelling would restore a
    // second credit (double-credit), since cancellation leaves status = 'not_started'.
    if (aRes.rows[0].status !== 'not_started' || aRes.rows[0].cancelled_at !== null) {
      throw new Error('CANCELLATION_INELIGIBLE');
    }

    // b. Recover the consumed credits from the ledger and restore them (inlined restoreCredit).
    //
    // PR6a: reverse EVERY consumed row, each back into the lot it actually came out of, for
    // the quantity it actually took. Previously this restored a hardcoded +1 from the first
    // row only — which was correct when a consume was always one row of exactly 1, and
    // silently destroyed 4 of a coach's 5 credits the moment it wasn't. The refund is
    // symmetric with the drain by construction: same rows, same lots, same quantities.
    const txs = await getConsumedCreditTxs(assessmentId);
    let creditRestored = false;
    let creditsRestored = 0;

    if (txs.length > 0) {
      for (const tx of txs) {
        // Restore into the original lot when there is one. A consume made under
        // enforcement_disabled logs a null lot_id (no lot existed); we still record the
        // matching 'restored' ledger row so the ledger nets to zero, just without a lot bump.
        if (tx.lot_id != null) {
          const lotRes = await client.query(
            `UPDATE credit_lots
                SET quantity_remaining = quantity_remaining + $1
              WHERE id = $2 AND account_id = $3
              RETURNING id`,
            [tx.quantity, tx.lot_id, tx.account_id]
          );
          if (lotRes.rows.length === 0) throw new Error('LOT_NOT_FOUND');
        }
        await insertCreditTransaction(client, {
          accountId: tx.account_id,
          creditTypeId: tx.credit_type_id,
          lotId: tx.lot_id ?? null,
          eventType: 'restored',
          quantity: tx.quantity,
          assessmentId,
          createdBy: cancelledBy,
          notes: null,
        });
        creditsRestored += tx.quantity;
      }
      creditRestored = true;
    } else {
      console.warn('[db] cancelAssessment: no consumed credit tx for assessment', assessmentId,
        '— cancelling without credit restore');
    }

    // c. Stamp the cancellation columns. credit_restored_at only when a credit was restored.
    await client.query(
      `UPDATE assessments
          SET cancelled_at = NOW(),
              cancellation_reason = $2,
              credit_restored_at = CASE WHEN $3 THEN NOW() ELSE credit_restored_at END
        WHERE id = $1`,
      [assessmentId, reason ?? null, creditRestored]
    );

    await client.query('COMMIT');
    return { assessmentId, creditRestored, creditsRestored };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (!['ASSESSMENT_NOT_FOUND', 'CANCELLATION_INELIGIBLE', 'LOT_NOT_FOUND'].includes(e.message)) {
      console.error('[db] cancelAssessment failed:', e.message);
    }
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDb,
  query,
  findOrCreateCoach,
  createClient,
  createAssessment,
  getLatestAssessmentId,
  getAssessmentById,
  writeApiResultOnce,
  forceWriteApiResult,
  updateVerdictColumns,
  saveAssessmentSnapshot,
  completeAssessment,
  failAssessment,
  updateAssessmentTiming,
  // Provisioning & Commerce PR7a — provisional assessment lifecycle
  createProvisionalAssessment,
  transitionAssessmentToProcessing,
  // Provisioning & Commerce PR7b — not_started finder
  getNotStartedAssessmentId,
  createReport,
  getAllAdminRows,
  getAdminRowsByCoach,
  // Coach Portal PR4a — My Clients (§7.2)
  getAssessmentsByClient,
  setCoachNotes,
  setClientDebrief,
  // Coach Portal PR4b — retake workflow
  createRetakeRequest,
  getLatestRetakeRequestsByCoach,
  getLatestRetakeRequestByClient,
  getRetakeRequestById,
  getPendingRetakeRequests,
  approveRetakeRequest,
  denyRetakeRequest,
  markRetakeRequestLaunched,
  revertRetakeRequestToApproved,
  getCoachByEmail,
  getCoachById,
  getAllCoaches,
  addCoach,
  setCoachPasswordSet,
  setCoachOnboardingComplete,
  setCoachWelcomeSeen,
  getCoachWelcomeSeen,
  // Coach Portal PR3 — Dashboard reads (read-only; never touch the credit ledger)
  getCoachCompletedAssessmentCount,
  getCoachActiveClientCount,
  getCoachActivitySeries,
  getPublishedAnnouncements,
  upsertCoachProfile,
  getCoachProfile,
  getActiveKeywordTags,
  setCoachActive,
  reassignClients,
  reassignClientToCoach,
  updateCoachPassword,
  updateCoach,
  updateClient,
  insertEditHistory,
  getEditHistory,
  logClientEvent,
  getClientHistory,
  getClientCoachId,
  getReportCoachId,
  getClientReportPaths,
  markAssessmentForDeletion,
  restoreAssessment,
  permanentlyDeleteAssessment,
  getDeletedAssessments,
  getClientById,
  getClientByEmail,
  resolveClientForCoach,   // PR5-security — ownership gate before any createClient upsert
  linkClientRecordsToUser,              // coach self-assessment linkage
  getCoachSelfCompletedAssessmentCount, // coach self-assessment linkage
  createClientToken,
  getTokenWithClient,
  updateTokenUsedAt,
  updateClientStatus,
  resendInviteTransaction,
  retakeTransaction,
  getAssessmentPayload,
  getAssessmentOwnerCoachId,
  updateCoachDebrief,
  getClientWithCoach,
  getAssessmentReports,
  deleteReportsByAssessmentId,
  updateClientStage0Signal,
  getClientStage0Signal,
  updateClientCtAdjustment,
  getClientCtAdjustment,
  saveCall1Result,
  getCall1Result,
  updateClientResponsesSnapshot,
  getBetaModeEnabled,
  setBetaModeEnabled,
  stampBetaReport,
  setClientBeta,
  insertBetaFeedback,
  updateBetaStateAnalysis,
  getBetaFeedback,
  getAllBetaFeedback,
  getBetaReviewRespondents,
  getBetaReviewRow,
  getBetaFeedbackForAnalysis,
  saveBetaAnalysis,
  getBetaAnalysis,
  clearBetaAnalysis,
  saveClientSessionState,
  clearClientSessionState,
  getAbandonedClients,
  recordReminderSent,
  createPdfToken,
  getPdfToken,
  markPdfTokenRedeemed,
  // Enhanced Mode (EM)
  getAppSettings,
  updateEmModeSettings,
  getClientAnalysisMode,
  getAssessmentAnalysisMode,
  saveEmResult,
  getEmResult,
  saveEmRerunReport,
  getEmRerunReport,
  updateEmRerunReportPdfPaths,
  insertEmReliabilityLog,
  getEmReliabilityLog,
  setClientAnalysisMode,
  getEmLabRoster,
  upsertDeclaration,
  // IAA Phase C — password reset + identity lookups
  getUserById,
  createPasswordResetToken,
  getPasswordResetToken,
  markResetTokenUsed,
  invalidateUserResetTokens,
  // IAA Phase D — role management + embargo
  getAllRoles,
  getUserRolesWithMeta,
  assignRole,
  revokeRole,
  countRoleHolders,
  setUserActive,
  getEmbargoList,
  addEmbargo,
  removeEmbargo,
  getUsersByEmbargo,
  // Provisioning & Commerce PR4 — credit ledger
  getAccountBalance,
  insertCreditTransaction,
  consumeCredit,
  restoreCredit,
  grantCredits,
  // Provisioning & Commerce PR9 — purchased credits (ThriveCart)
  recordPurchasedCredits,
  // Provisioning & Commerce PR8 — account lookup
  getAccountByCoachId,
  getHouseAccount,
  // Provisioning & Commerce PR5 — upsert, cancellation, assignment
  insertAssignmentEvent,
  getConsumedCreditTxs,
  getCreditCost,
  getCreditSummary,
  getCreditHistory,
  getPurchaseByReference,
  getCreditTypesWithCost,
  getCreditCostHistory,
  setCreditCost,
  cancelAssessment,
};
