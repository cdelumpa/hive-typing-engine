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
`;

const SEED_SQL = `
INSERT INTO coaches (name, email)
VALUES ('Cai Delumpa', 'cai@hiveleadership.com'),
       ('Monique Breault', 'monique@hiveleadership.com')
ON CONFLICT (email) DO NOTHING;
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

module.exports = {
  initDb,
  query,
  findOrCreateCoach,
  createClient,
  createAssessment,
  completeAssessment,
  failAssessment,
  createReport,
  getAdminRows,
  getClientReportPaths,
  deleteClientCascade,
};
