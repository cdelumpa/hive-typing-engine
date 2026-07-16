'use strict';

/**
 * content_overrides.js — CMS render-time override lookup (PR 2).
 *
 * The renderer's baseline content lives in content_library.json (read in
 * report_prep.js via lib()). When a coach publishes an edit through the CMS it
 * lands in the content_overrides table (PR 1) keyed by "<topKey>.<field>", e.g.
 * "subtype_sp9.narrative", "static.welcome", "type_9.wings". This module loads
 * the published overrides once per render and resolves each library field
 * through them, falling back to the baseline when no override exists.
 *
 * One DB query per render (not per key): loadPublishedOverrides() builds a Map
 * once; resolveContent/resolveLibObject then do local Map lookups.
 */

const db = require('./db');

// PR7b: in-process memo of the published-overrides Map. The overrides set is GLOBAL (identical
// for every render — not per-report, not per-user), yet loadPublishedOverrides() previously ran
// a full-table SELECT on every report render (My Reports AND every client/coach PDF render).
// Single Railway replica with an attached volume ("Replicas are not available for attached
// volumes"), so a plain module-level cache is coherent — no cross-instance staleness — and a
// deploy/restart clears it for free. Every write to content_overrides goes through the three
// mutators below (saveDraftOverride/publishOverride/revertOverride), each of which busts the
// cache, so a published edit is reflected on the very next render. NOTE (PR7b audit): api_result
// reruns (forceWriteApiResult) do NOT touch content_overrides, so they don't dirty this cache —
// invalidation here is scoped to the table this module owns. See report_prep buildClientModel.
let _publishedCache = null;

function invalidateOverridesCache() {
  _publishedCache = null;
}

/**
 * Loads all published content overrides from the DB into a Map (memoized in-process).
 * Key:   content_key (e.g. "subtype_sp9.narrative")
 * Value: parsed value (JSON.parse if valid JSON, raw string otherwise)
 * Returns an empty Map if the DB is unavailable or the query fails — never throws.
 * Callers treat the returned Map as read-only (resolveContent/resolveLibObject never mutate it),
 * so the same cached instance is safely shared across renders.
 */
async function loadPublishedOverrides() {
  if (_publishedCache) return _publishedCache;
  try {
    const result = await db.query(
      'SELECT content_key, value FROM content_overrides WHERE status = $1',
      ['published']
    );
    if (!result || !result.rows) return new Map();   // db.query returns null when DATABASE_URL is unset — don't cache a transient miss
    const map = new Map();
    for (const row of result.rows) {
      try {
        map.set(row.content_key, JSON.parse(row.value));
      } catch {
        map.set(row.content_key, row.value);
      }
    }
    _publishedCache = map;   // cache only a genuine result (an empty table yields an empty Map, still cached)
    return map;
  } catch (err) {
    console.error('[content_overrides] Failed to load overrides:', err.message);
    return new Map();
  }
}

/**
 * Returns the override value if one exists for this key, otherwise the baseline
 * value from the JSON file.
 */
function resolveContent(overrides, key, baselineValue) {
  return overrides && overrides.has(key) ? overrides.get(key) : baselineValue;
}

/**
 * Resolves first-level field overrides for a top-level library object. Override
 * keys are namespaced "<topKey>.<field>" (e.g. "type_9.wings", "static.welcome"),
 * matching the shape report_prep reads from content_library.json.
 *
 * Returns the SAME baseline object reference when no override applies, so an
 * empty table (the deploy-time state) yields byte-identical output. When an
 * override applies, returns a shallow copy with the overridden fields replaced;
 * the published value must already match the baseline shape for that field.
 */
function resolveLibObject(overrides, topKey, baseObj) {
  if (!overrides || overrides.size === 0 || baseObj == null || typeof baseObj !== 'object') {
    return baseObj;
  }
  let out = null;
  for (const field of Object.keys(baseObj)) {
    const resolved = resolveContent(overrides, `${topKey}.${field}`, baseObj[field]);
    if (resolved !== baseObj[field]) {
      if (!out) out = Array.isArray(baseObj) ? baseObj.slice() : { ...baseObj };
      out[field] = resolved;
    }
  }
  return out || baseObj;
}

// ─── CMS admin DB helpers (PR 3) ───────────────────────────────────────────────
// Read/write access for the /admin/content editor. This module is the domain home
// for all content_overrides table logic. `value` is always stored as a JSON string
// (JSON.stringify of the field's full value) so loadPublishedOverrides' JSON.parse
// returns the correct shape — string, object, or array — for every key.

/**
 * Returns all override rows (any status) keyed by content_key:
 *   { [content_key]: { value, parsed, word_count, updated_by, updated_at, status, previous_value } }
 * `parsed` is the JSON.parsed value (falls back to raw string). Empty object when
 * the DB is unavailable or the query fails — never throws.
 */
async function getAllOverrides() {
  try {
    const result = await db.query(
      `SELECT content_key, value, word_count, updated_by, updated_at, status, previous_value
       FROM content_overrides`
    );
    const out = {};
    if (!result || !result.rows) return out;
    for (const row of result.rows) {
      let parsed;
      try { parsed = JSON.parse(row.value); } catch { parsed = row.value; }
      out[row.content_key] = { ...row, parsed };
    }
    return out;
  } catch (err) {
    console.error('[content_overrides] getAllOverrides failed:', err.message);
    return {};
  }
}

/**
 * Upsert a draft override. Sets status='draft'; never touches previous_value.
 * `value` is the field's full JS value (object/array/string); stored JSON-stringified.
 * Returns true on success, false otherwise.
 */
async function saveDraftOverride(contentKey, value, wordCount, coachId) {
  const json = JSON.stringify(value);
  const r = await db.query(
    `INSERT INTO content_overrides (content_key, value, word_count, updated_by, updated_at, status)
     VALUES ($1, $2, $3, $4, NOW(), 'draft')
     ON CONFLICT (content_key) DO UPDATE
       SET value = EXCLUDED.value, word_count = EXCLUDED.word_count,
           updated_by = EXCLUDED.updated_by, updated_at = NOW(), status = 'draft'`,
    [contentKey, json, wordCount, coachId]
  );
  // A draft save can demote a previously-published key (ON CONFLICT ... SET status='draft'),
  // removing it from the published set — so the render-time cache must be busted here too.
  if (r !== null) invalidateOverridesCache();
  return r !== null;
}

/**
 * Upsert a published override. Snapshots the currently-published value (if any)
 * into previous_value before overwriting, preserving a future undo-last-publish
 * path. Sets status='published'. Returns true on success, false otherwise.
 */
async function publishOverride(contentKey, value, wordCount, coachId) {
  const json = JSON.stringify(value);
  const prev = await db.query(
    `SELECT value FROM content_overrides WHERE content_key = $1 AND status = 'published' LIMIT 1`,
    [contentKey]
  );
  const previousValue = prev && prev.rows.length > 0 ? prev.rows[0].value : null;
  const r = await db.query(
    `INSERT INTO content_overrides (content_key, value, word_count, updated_by, updated_at, status, previous_value)
     VALUES ($1, $2, $3, $4, NOW(), 'published', $5)
     ON CONFLICT (content_key) DO UPDATE
       SET value = EXCLUDED.value, word_count = EXCLUDED.word_count,
           updated_by = EXCLUDED.updated_by, updated_at = NOW(), status = 'published',
           previous_value = EXCLUDED.previous_value`,
    [contentKey, json, wordCount, coachId, previousValue]
  );
  if (r !== null) invalidateOverridesCache();   // published set changed — next render reloads
  return r !== null;
}

/**
 * Revert to baseline: delete the override row so the renderer falls back to the
 * content_library.json baseline. Returns true on success, false otherwise.
 */
async function revertOverride(contentKey) {
  const r = await db.query('DELETE FROM content_overrides WHERE content_key = $1', [contentKey]);
  if (r !== null) invalidateOverridesCache();   // deleting a published row changes the render — bust
  return r !== null;
}

module.exports = {
  loadPublishedOverrides, invalidateOverridesCache, resolveContent, resolveLibObject,
  getAllOverrides, saveDraftOverride, publishOverride, revertOverride,
};
