'use strict';

/**
 * venues.js — Venue directory (PR14, Events Management System).
 *
 * Domain home for the `venues` table: admin CRUD for the physical locations that
 * in-person events reference. Mirrors resources.js in shape but WITHOUT a read cache —
 * venues are admin-only reference data read at event-form render time and joined into the
 * event grid, both low-frequency; a cache would only add invalidation surface for no win.
 *
 * The events table references venues via `venue_id ... ON DELETE SET NULL`, so deleting a
 * venue never breaks an event row — it just nulls the link. deleteVenue() is guarded at the
 * route layer (warn if referenced) rather than here.
 */

const db = require('./db');

// Whitelisted writable columns, applied by create/update.
const FIELDS = ['name', 'address', 'city', 'state', 'zip', 'website_url'];

/** All venues, alphabetical — for the admin list and the event-form selector. */
async function listVenues() {
  const r = await db.query(
    `SELECT id, name, address, city, state, zip, website_url, created_at, updated_at
       FROM venues
      ORDER BY name ASC, id ASC`
  );
  return (r && r.rows) || [];
}

/** One venue by id (for the admin edit form and event-detail join fallback), or null. */
async function getVenueById(id) {
  if (!id) return null;
  const r = await db.query(`SELECT * FROM venues WHERE id = $1`, [id]);
  return (r && r.rows[0]) || null;
}

/** Count of non-cancelled events that reference this venue (delete-guard for the route). */
async function countEventsForVenue(id) {
  const r = await db.query(
    `SELECT COUNT(*)::int AS n FROM events WHERE venue_id = $1 AND is_cancelled = false`,
    [id]
  );
  return (r && r.rows[0] && r.rows[0].n) || 0;
}

/** Create a venue from whitelisted fields. Returns the new id. */
async function createVenue(fields) {
  const cols = FIELDS.filter(f => fields[f] !== undefined);
  const vals = cols.map(f => fields[f]);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const r = await db.query(
    `INSERT INTO venues (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    vals
  );
  return r.rows[0].id;
}

/** Update a venue's editable fields. updated_at is maintained by the DB trigger. */
async function updateVenue(id, fields) {
  const cols = FIELDS.filter(f => fields[f] !== undefined);
  if (!cols.length) return false;
  const sets = cols.map((f, i) => `${f} = $${i + 1}`);
  const params = [...cols.map(f => fields[f]), id];
  const r = await db.query(
    `UPDATE venues SET ${sets.join(', ')} WHERE id = $${params.length}`,
    params
  );
  return !!(r && r.rowCount > 0);
}

/** Hard-delete a venue. Events referencing it have venue_id set NULL by the FK. */
async function deleteVenue(id) {
  const r = await db.query(`DELETE FROM venues WHERE id = $1`, [id]);
  return !!(r && r.rowCount > 0);
}

module.exports = {
  listVenues, getVenueById, countEventsForVenue,
  createVenue, updateVenue, deleteVenue,
};
