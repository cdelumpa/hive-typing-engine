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
 * Structural leaf-path set for a value, with ARRAY INDICES NORMALIZED.
 *
 *   { subhead: 'x', letters: ['a','b'], signoff: 'y' }  ->  subhead · letters[] · signoff
 *
 * Indices are collapsed to `[]` on purpose. The defect class this guards against is a
 * published override that is MISSING A FIELD the library has since gained — the shape has
 * moved under it. Cardinality is not that: a coach adding a fourth practice bullet is a
 * legitimate edit and must not throw. Field counts that genuinely matter (5 wing bullets,
 * 3 pillars, 9 contents entries) are already hard-gated in build_content_library.js.
 */
function overrideShape(v, prefix = '', out = null) {
  const set = out || new Set();
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const keys = Object.keys(v);
    if (!keys.length) set.add(`${prefix}{}`);
    for (const k of keys) overrideShape(v[k], prefix ? `${prefix}.${k}` : k, set);
  } else if (Array.isArray(v)) {
    if (!v.length) set.add(`${prefix}[]`);
    for (const x of v) overrideShape(x, `${prefix}[]`, set);
  } else {
    set.add(prefix || '(scalar)');
  }
  return set;
}

/**
 * Throw when a published override's shape no longer matches the library field it replaces.
 *
 * WHY A THROW AND NOT A MERGE OR A SILENT FALLBACK
 * ------------------------------------------------
 * resolveLibObject replaces a field WHOLE (`out[field] = resolved`). An override published
 * against an older library therefore silently drops any key the field has gained since.
 * Measured on production, 12 Aug 2026: the June `static.welcome` row predates the `signoff`
 * key PR 2 added, so the v3 Welcome page rendered the literal word "undefined" above the
 * founder photos. Nothing caught it — every offline harness runs with an empty override map.
 *
 * Deep-merging would marry June's `letters` to August's `signoff`: a combination nobody
 * reviewed and nobody can point to a source for, and — worse — it makes the stale row
 * permanently invisible, so nothing ever prompts a cleanup. That is the 130-field drift
 * mechanism applied to a new table. Falling back to the baseline silently is the same defect
 * pointed the other way: a coach's published edit stops applying and nobody is told.
 *
 * A shape mismatch is a data problem only a human can resolve — re-publish the row or retire
 * it. Guessing on the client's behalf is what this codebase has repeatedly paid for.
 *
 * ⚠️ DEPLOY ORDER. This throw reaches EVERY report render, including the dry-validate probe
 * in /api/submit. A mismatched row therefore fails assessment submission, not just a PDF.
 * Retire or re-publish offending rows BEFORE deploying this. `npm run overrides:check`,
 * pointed at the target database, is the pre-deploy gate that proves it is safe to ship.
 */
class OverrideShapeError extends Error {}

function assertOverrideShape(key, baselineValue, overrideValue) {
  const want = overrideShape(baselineValue);
  const got = overrideShape(overrideValue);
  const missing = [...want].filter(p => !got.has(p));
  const unknown = [...got].filter(p => !want.has(p));
  if (!missing.length && !unknown.length) return;
  throw new OverrideShapeError(
    `Published content override "${key}" no longer matches the content library's shape.\n` +
    (missing.length ? `  missing from the override: ${missing.join(', ')}\n` : '') +
    (unknown.length ? `  present only in the override: ${unknown.join(', ')}\n` : '') +
    `  library shape:  ${[...want].sort().join(' · ')}\n` +
    `  override shape: ${[...got].sort().join(' · ')}\n` +
    `The override was published against an older library. Re-publish it from the current\n` +
    `baseline in /admin/content, or revert it. Run \`npm run overrides:check\` to list every\n` +
    `affected row at once.`
  );
}

/**
 * Returns the override value if one exists for this key, otherwise the baseline
 * value from the JSON file. Throws if a published override's shape has drifted from
 * the baseline it replaces (see assertOverrideShape).
 */
function resolveContent(overrides, key, baselineValue) {
  if (!overrides || !overrides.has(key)) return baselineValue;
  const value = overrides.get(key);
  assertOverrideShape(key, baselineValue, value);
  return value;
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
  // Shape guard — exported for tests and scripts/overrides_check.js.
  overrideShape, assertOverrideShape, OverrideShapeError,
};
