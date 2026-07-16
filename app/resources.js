'use strict';

/**
 * resources.js — Resources library (spec §7.6 / §9.7), PR8.
 *
 * Domain home for the `resources` table: the published-list read cache (Tier 2 shared
 * content, §12.2) plus admin CRUD. Self-contained on purpose — the memo AND every mutator
 * live here, so invalidation is a local call, mirroring content_overrides.js. This is the
 * REUSABLE TIER-2 SHAPE: a per-domain module with an in-process cache and an invalidateX()
 * that every write calls. Coach Training and Announcements can follow the same pattern.
 *
 * Caching model (single Railway replica, no CDN — see PR7b audit): the spec's "edge cache
 * with stale-while-revalidate" collapses to serve-from-memory + bust-on-write. No TTL is
 * needed because every write goes through the mutators below, each of which busts the cache
 * synchronously; a deploy/restart clears it for free.
 */

const db = require('./db');

// ── Tier-2 read cache ────────────────────────────────────────────────────────────
// Full published rows (including body_rich_text), sorted the way the page renders them:
// by category, then most-recently-published first. Callers treat the array as read-only.
let _publishedCache = null;

function invalidateResourcesCache() {
  _publishedCache = null;
}

// Category render order (spec §7.6): Introducing → Coaching → Typing.
const CATEGORY_ORDER = { introducing: 0, coaching: 1, typing: 2 };

/**
 * All PUBLISHED resources (published_at not null), memoized in-process. Sorted by category
 * order then published_at desc. Returns [] if the DB is unavailable — and does NOT cache that
 * transient miss, so a blip never pins an empty list.
 */
async function getPublishedResources() {
  if (_publishedCache) return _publishedCache;
  const r = await db.query(
    `SELECT id, title, description_short, description_long, category, content_type,
            url, body_rich_text, thumbnail_url, is_featured, published_at
       FROM resources
      WHERE published_at IS NOT NULL
      ORDER BY published_at DESC, id DESC`
  );
  if (!r || !r.rows) return [];   // DB unavailable — don't cache
  const rows = r.rows.slice().sort((a, b) => {
    const c = (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9);
    return c !== 0 ? c : 0;   // within a category, keep the published_at DESC from SQL (stable sort)
  });
  _publishedCache = rows;
  return rows;
}

/** The single featured+published resource for the "New For You" hero, or null. */
async function getFeaturedResource() {
  const rows = await getPublishedResources();
  return rows.find(r => r.is_featured) || null;
}

/** One published resource's rich-text body (Written types), ownership-agnostic (shared content). */
async function getPublishedResourceBody(id) {
  const rows = await getPublishedResources();
  const row = rows.find(r => r.id === id);
  return row ? { id: row.id, title: row.title, content_type: row.content_type, body_rich_text: row.body_rich_text } : null;
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────────
// Every mutator busts the cache synchronously before returning.

/** Full admin list — published AND drafts, newest first. */
async function listResourcesAdmin() {
  const r = await db.query(
    `SELECT id, title, description_short, category, content_type, url, is_featured,
            published_at, created_at, updated_at
       FROM resources
      ORDER BY (published_at IS NULL) DESC, updated_at DESC, id DESC`
  );
  return (r && r.rows) || [];
}

/** One resource by id (any status) for the admin edit form. */
async function getResourceById(id) {
  const r = await db.query(`SELECT * FROM resources WHERE id = $1`, [id]);
  return (r && r.rows[0]) || null;
}

// Whitelisted writable fields, applied by create/update. category/content_type are validated
// by the table CHECK constraints; is_featured is handled transactionally below.
const FIELDS = ['title', 'description_short', 'description_long', 'category', 'content_type',
  'url', 'body_rich_text', 'thumbnail_url'];

/**
 * Create a resource. If featured, unsets any other featured row in the SAME transaction so the
 * partial unique index (resources_one_featured) is never violated. Returns the new id.
 */
async function createResource(fields, createdBy) {
  const featured = fields.is_featured === true;
  const cols = FIELDS.filter(f => fields[f] !== undefined);
  const vals = cols.map(f => fields[f]);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (featured) await client.query('UPDATE resources SET is_featured = FALSE WHERE is_featured');
    const colList = [...cols, 'is_featured', 'created_by'];
    const placeholders = colList.map((_, i) => `$${i + 1}`).join(', ');
    const r = await client.query(
      `INSERT INTO resources (${colList.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      [...vals, featured, createdBy || null]
    );
    await client.query('COMMIT');
    invalidateResourcesCache();
    return r.rows[0].id;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Update a resource's editable fields (and is_featured). Featured toggling is transactional:
 * turning this row featured unsets every other featured row first. updated_at is maintained by
 * the DB trigger.
 */
async function updateResource(id, fields) {
  const featured = fields.is_featured === true;
  const cols = FIELDS.filter(f => fields[f] !== undefined);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (featured) await client.query('UPDATE resources SET is_featured = FALSE WHERE is_featured AND id <> $1', [id]);
    const sets = cols.map((f, i) => `${f} = $${i + 1}`);
    sets.push(`is_featured = $${cols.length + 1}`);
    const params = [...cols.map(f => fields[f]), featured, id];
    await client.query(
      `UPDATE resources SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );
    await client.query('COMMIT');
    invalidateResourcesCache();
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Publish (make visible to coaches). Idempotent-ish: stamps published_at = NOW(). */
async function publishResource(id) {
  const r = await db.query(`UPDATE resources SET published_at = NOW() WHERE id = $1`, [id]);
  invalidateResourcesCache();
  return !!(r && r.rowCount > 0);
}

/** Unpublish (back to draft). */
async function unpublishResource(id) {
  const r = await db.query(`UPDATE resources SET published_at = NULL WHERE id = $1`, [id]);
  invalidateResourcesCache();
  return !!(r && r.rowCount > 0);
}

/** Hard-delete a resource. */
async function deleteResource(id) {
  const r = await db.query(`DELETE FROM resources WHERE id = $1`, [id]);
  invalidateResourcesCache();
  return !!(r && r.rowCount > 0);
}

module.exports = {
  invalidateResourcesCache,
  getPublishedResources, getFeaturedResource, getPublishedResourceBody,
  listResourcesAdmin, getResourceById,
  createResource, updateResource, publishResource, unpublishResource, deleteResource,
};
