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

ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage0_signal JSONB;

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_by TEXT;

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

async function createAssessment(clientId, responses) {
  const r = await query(
    `INSERT INTO assessments (client_id, status, responses) VALUES ($1, 'processing', $2) RETURNING id`,
    [clientId, JSON.stringify(responses)]
  );
  return r && r.rows.length > 0 ? r.rows[0].id : null;
}

async function completeAssessment(assessmentId, result) {
  const h = result.hypothesis || {};
  const fr = result.final_response || {};
  await query(
    `UPDATE assessments SET
       status = 'complete',
       confirmed_type = $1,
       confidence_level = $2,
       stage4_outcome = $3,
       flags = $4,
       final_response_classification = $5,
       confirmed_instinct = $6,
       instinct_confidence = $7,
       completed_at = NOW()
     WHERE id = $8`,
    [
      h.confirmed_type || null,
      h.confidence_level || null,
      h.stage4_outcome || null,
      JSON.stringify(result.flags || []),
      fr.classification || null,
      h.confirmed_instinct || null,
      h.instinct_confidence || null,
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

async function createReport(assessmentId, reportType, pdfPath) {
  await query(
    `INSERT INTO reports (assessment_id, report_type, pdf_path) VALUES ($1, $2, $3)`,
    [assessmentId, reportType, pdfPath]
  );
}

async function getAdminRows() {
  const r = await query(`
    SELECT
      c.id            AS client_id,
      c.first_name,
      c.last_name,
      a.id            AS assessment_id,
      a.confirmed_type,
      a.confirmed_instinct,
      a.instinct_confidence,
      a.confidence_level,
      co.name         AS coach_name,
      a.created_at,
      a.status,
      r_cl.pdf_path   AS client_pdf,
      r_co.pdf_path   AS coach_pdf
    FROM clients c
    LEFT JOIN assessments a  ON a.client_id = c.id
    LEFT JOIN coaches co      ON co.id = c.coach_id
    LEFT JOIN reports r_cl    ON r_cl.assessment_id = a.id AND r_cl.report_type = 'client'
    LEFT JOIN reports r_co    ON r_co.assessment_id = a.id AND r_co.report_type = 'coach'
    ORDER BY a.created_at DESC NULLS LAST
  `);
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
  const r = await query(`
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
      co.name         AS coach_name,
      COALESCE(a.created_at, c.created_at) AS created_at,
      COALESCE(a.status, c.status, 'unknown') AS status,
      r_cl.pdf_path   AS client_pdf,
      r_co.pdf_path   AS coach_pdf,
      a.pdf_generated_at,
      a.email_sent_at,
      (a.scores_snapshot IS NOT NULL) AS has_scores_snapshot,
      (a.api_result IS NOT NULL)      AS has_api_result
    FROM clients c
    LEFT JOIN assessments a  ON a.client_id = c.id
    LEFT JOIN coaches co      ON co.id = c.coach_id
    LEFT JOIN reports r_cl    ON r_cl.assessment_id = a.id AND r_cl.report_type = 'client'
    LEFT JOIN reports r_co    ON r_co.assessment_id = a.id AND r_co.report_type = 'coach'
    WHERE c.coach_id = $1
    ORDER BY COALESCE(a.created_at, c.created_at) DESC NULLS LAST
  `, [coachId]);
  return r ? r.rows : [];
}

async function getCoachByEmail(email) {
  const r = await query('SELECT id, name, email, password_hash, is_admin, is_active FROM coaches WHERE email = $1 LIMIT 1', [email]);
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
           c.stage0_signal,
           co.name AS coach_name, co.id AS coach_id
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

async function getAssessmentPayload(clientId) {
  const r = await query(
    `SELECT id AS assessment_id, api_result, scores_snapshot, responses, pdf_generated_at, email_sent_at
     FROM assessments WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clientId]
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

module.exports = {
  pool,
  initDb,
  query,
  findOrCreateCoach,
  createClient,
  createAssessment,
  completeAssessment,
  failAssessment,
  createReport,
  getAdminRows,
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
  getAssessmentPayload,
  getClientWithCoach,
  getAssessmentReports,
  deleteReportsByAssessmentId,
  updateClientStage0Signal,
  getClientStage0Signal,
};
