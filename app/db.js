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

async function createClient(intake, coachId) {
  const r = await query(
    `INSERT INTO clients (coach_id, first_name, last_name, email, organization)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [coachId, intake.firstName, intake.lastName, intake.email, intake.organization || null]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
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

async function reassignClients(fromCoachId, toCoachId) {
  await query(
    'UPDATE clients SET coach_id = $1 WHERE coach_id = $2',
    [toCoachId, fromCoachId]
  );
}

async function reassignClientToCoach(clientId, newCoachId) {
  await query('UPDATE clients SET coach_id = $1 WHERE id = $2', [newCoachId, clientId]);
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
  createReport,
  getAllAdminRows,
  getAdminRowsByCoach,
  getCoachByEmail,
  getCoachById,
  getAllCoaches,
  addCoach,
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
};
