'use strict';
require('dotenv').config();
const db = require('./db');

async function main() {
  // Most recent assessment with client info, checking for Jonas or whoever is latest
  const r = await db.query(`
    SELECT
      c.id            AS client_id,
      c.first_name,
      c.last_name,
      c.email,
      c.organization,
      c.status        AS client_status,
      c.created_at    AS client_created_at,
      c.updated_at    AS client_updated_at,
      c.updated_by    AS client_updated_by,
      a.id            AS assessment_id,
      a.status        AS assessment_status,
      a.confirmed_type,
      a.confidence_level,
      a.stage4_outcome,
      a.final_response_classification,
      a.confirmed_instinct,
      a.instinct_confidence,
      a.flags,
      a.responses     IS NOT NULL AS has_responses,
      a.api_result    IS NOT NULL AS has_api_result,
      a.scores_snapshot IS NOT NULL AS has_scores_snapshot,
      a.pdf_generated_at,
      a.email_sent_at,
      a.created_at    AS assessment_created_at,
      a.completed_at
    FROM assessments a
    JOIN clients c ON c.id = a.client_id
    ORDER BY a.created_at DESC
    LIMIT 5
  `);

  if (!r || r.rows.length === 0) {
    console.log('No assessments found.');
    process.exit(0);
  }

  console.log(`\nFound ${r.rows.length} most recent assessment(s):\n`);

  r.rows.forEach((row, i) => {
    console.log(`─── Row ${i + 1} ──────────────────────────────────`);
    for (const [key, val] of Object.entries(row)) {
      const display = val === null || val === undefined
        ? 'NULL'
        : val === true  ? 'true (populated)'
        : val === false ? 'false (NULL/empty)'
        : String(val).slice(0, 120);
      console.log(`  ${key.padEnd(32)} ${display}`);
    }
    console.log();
  });

  await db.pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
