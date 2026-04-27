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
       completed_at = NOW()
     WHERE id = $6`,
    [
      h.confirmed_type || null,
      h.confidence_level || null,
      h.stage4_outcome || null,
      JSON.stringify(result.flags || []),
      fr.classification || null,
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

module.exports = {
  initDb,
  query,
  findOrCreateCoach,
  createClient,
  createAssessment,
  completeAssessment,
  failAssessment,
  createReport,
};
