'use strict';

// One-time script: set initial bcrypt passwords for Cai and Monique.
// Run from repo root: node scripts/seed_coach_passwords.js

const path = require('path');
// Resolve app dependencies from the app directory
const appDir = path.join(__dirname, '../app');
require(path.join(appDir, 'node_modules', 'dotenv')).config({ path: path.join(appDir, '.env'), override: true });

const { Pool } = require(path.join(appDir, 'node_modules', 'pg'));
const bcrypt   = require(path.join(appDir, 'node_modules', 'bcrypt'));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set — aborting');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const COACHES = [
  { email: 'cai@hiveleadership.com',     password: 'HiveCai2026!' },
  { email: 'monique@hiveleadership.com', password: 'HiveMo2026!' },
];

async function run() {
  // Ensure column exists
  await pool.query('ALTER TABLE coaches ADD COLUMN IF NOT EXISTS password_hash TEXT');

  for (const { email, password } of COACHES) {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'UPDATE coaches SET password_hash = $1 WHERE email = $2 RETURNING name',
      [hash, email]
    );
    if (result.rowCount > 0) {
      console.log(`[seed] password set for ${result.rows[0].name} (${email})`);
    } else {
      console.warn(`[seed] no coach found with email ${email}`);
    }
  }

  await pool.end();
  console.log('[seed] done');
}

run().catch(e => {
  console.error('[seed] error:', e.message);
  process.exit(1);
});
