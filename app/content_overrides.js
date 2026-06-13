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

/**
 * Loads all published content overrides from the DB into a Map.
 * Key:   content_key (e.g. "subtype_sp9.narrative")
 * Value: parsed value (JSON.parse if valid JSON, raw string otherwise)
 * Returns an empty Map if the DB is unavailable or the query fails — never throws.
 */
async function loadPublishedOverrides() {
  try {
    const result = await db.query(
      'SELECT content_key, value FROM content_overrides WHERE status = $1',
      ['published']
    );
    const map = new Map();
    if (!result || !result.rows) return map;   // db.query returns null when DATABASE_URL is unset
    for (const row of result.rows) {
      try {
        map.set(row.content_key, JSON.parse(row.value));
      } catch {
        map.set(row.content_key, row.value);
      }
    }
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

module.exports = { loadPublishedOverrides, resolveContent, resolveLibObject };
