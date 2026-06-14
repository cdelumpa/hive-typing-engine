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
ALTER TABLE clients ADD COLUMN IF NOT EXISTS responses_snapshot JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS call1_result JSONB;

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS beta_report_generated_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS beta_report_filename TEXT;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS session_state JSONB DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reminder_sent_at JSONB DEFAULT NULL;

-- Enforce one client per email. Unique INDEX (not ADD CONSTRAINT) so we can use
-- IF NOT EXISTS, matching the idempotent-migration style used throughout this file.
-- Case-sensitive by design for now; normalizing the /api/submit insert path to
-- lowercase is a tracked follow-up, not part of this change.
CREATE UNIQUE INDEX IF NOT EXISTS clients_email_key ON clients (email);

-- Idempotent data fix: ensure the sole remaining client record carries the
-- correct name. No-op once the name is already correct, so safe on every boot.
UPDATE clients
SET first_name = 'Cai', last_name = 'Delumpa'
WHERE email = 'cdelumpa@gmail.com'
  AND (first_name != 'Cai' OR last_name != 'Delumpa');

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  beta_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (id = 1)
);
INSERT INTO app_settings (id, beta_mode_enabled)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

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
`;

const SEED_SQL = `
INSERT INTO coaches (name, email)
VALUES ('Cai Delumpa', 'cai@hiveleadership.com'),
       ('Monique Breault', 'monique@hiveleadership.com')
ON CONFLICT (email) DO NOTHING;

UPDATE coaches SET password_hash = '$2b$12$NkrKjo3/RF8oMM4.D1tJU.88toD/AC1N1tHl4dm4P.ChGUJBFSey2'
WHERE email = 'cai@hiveleadership.com' AND password_hash IS NULL;

UPDATE coaches SET password_hash = '$2b$12$j76FBdX8jQoB4agtmjXpGOfhVevkpi1jnkwZMBnerFkHsWA/rkIN.'
WHERE email = 'monique@hiveleadership.com' AND password_hash IS NULL;

UPDATE coaches SET is_admin = TRUE, is_active = TRUE
WHERE email IN ('cai@hiveleadership.com', 'monique@hiveleadership.com');

UPDATE coaches SET is_super_admin = TRUE
WHERE email IN ('cai@hiveleadership.com', 'monique@hiveleadership.com');

-- Remove temporary test coaches created during access-control verification
DELETE FROM coaches WHERE email IN ('testadmin@hiveleadership.com', 'testcoach@hiveleadership.com');

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
  const r = await query(
    `INSERT INTO assessments (client_id, status, responses, retake_of_assessment_id)
     VALUES ($1, 'processing', $2, $3) RETURNING id`,
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
              ORDER BY a2.created_at DESC LIMIT 1),
      FALSE
    ) AS is_latest_complete,
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
  LEFT JOIN reports r_cl    ON r_cl.assessment_id = a.id AND r_cl.report_type = 'client'
  LEFT JOIN reports r_co    ON r_co.assessment_id = a.id AND r_co.report_type = 'coach'
`;

// Super-admin all-clients view: every client across every coach. Coaches who are
// not super-admins use getAdminRowsByCoach (coach-scoped) instead.
async function getAllAdminRows() {
  const r = await query(
    `${ADMIN_ROWS_SELECT}
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

async function deleteClientCascade(clientId) {
  await query(`DELETE FROM reports WHERE assessment_id IN (SELECT id FROM assessments WHERE client_id = $1)`, [clientId]);
  await query(`DELETE FROM assessments WHERE client_id = $1`, [clientId]);
  await query(`DELETE FROM clients WHERE id = $1`, [clientId]);
}

async function getAdminRowsByCoach(coachId) {
  const r = await query(
    `${ADMIN_ROWS_SELECT}
     WHERE c.coach_id = $1
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
    'SELECT id, name, email, password_hash, is_admin, is_active, updated_at, updated_by FROM coaches WHERE id = $1 LIMIT 1',
    [id]
  );
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

async function updateCoach(coachId, fields, editorName) {
  await query(
    `UPDATE coaches SET name = $1, email = $2, updated_at = NOW(), updated_by = $3 WHERE id = $4`,
    [fields.name, fields.email, editorName, coachId]
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

async function getAllCoaches() {
  const r = await query(`
    SELECT co.id, co.name, co.email, co.is_admin, co.is_active,
           COUNT(c.id) AS client_count
    FROM coaches co
    LEFT JOIN clients c ON c.coach_id = co.id
    GROUP BY co.id
    ORDER BY co.created_at ASC
  `);
  return r ? r.rows : [];
}

async function addCoach(name, email, passwordHash) {
  const r = await query(
    `INSERT INTO coaches (name, email, password_hash, is_admin, is_active)
     VALUES ($1, $2, $3, FALSE, TRUE) RETURNING id`,
    [name, email, passwordHash]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}

async function setCoachActive(coachId, isActive) {
  await query(
    'UPDATE coaches SET is_active = $1 WHERE id = $2',
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
           c.session_state,
           co.name AS coach_name, co.id AS coach_id, co.email AS coach_email
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
    SELECT c.first_name, c.last_name, c.email, c.organization, co.name AS coach_name
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

module.exports = {
  pool,
  initDb,
  query,
  findOrCreateCoach,
  createClient,
  createAssessment,
  getLatestAssessmentId,
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
  getClientCoachId,
  getReportCoachId,
  getClientReportPaths,
  deleteClientCascade,
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
  saveClientSessionState,
  clearClientSessionState,
  getAbandonedClients,
  recordReminderSent,
  createPdfToken,
  getPdfToken,
  markPdfTokenRedeemed,
};
