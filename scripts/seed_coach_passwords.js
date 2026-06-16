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

// Passwords are read from environment variables — NEVER hardcode them here
// (this file is committed to source control). Provide them inline at run time:
//   SEED_CAI_PASSWORD='…' SEED_MONIQUE_PASSWORD='…' node scripts/seed_coach_passwords.js
// Any coach whose env var is unset is skipped, so you can rotate one account at a time.
const COACHES = [
  { email: 'cai@hiveleadership.com',     password: process.env.SEED_CAI_PASSWORD },
  { email: 'monique@hiveleadership.com', password: process.env.SEED_MONIQUE_PASSWORD },
];

async function run() {
  // Ensure column exists
  await pool.query('ALTER TABLE coaches ADD COLUMN IF NOT EXISTS password_hash TEXT');

  for (const { email, password } of COACHES) {
    if (!password) {
      console.warn(`[seed] no password env var set for ${email} — skipping`);
      continue;
    }
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
