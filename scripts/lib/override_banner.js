'use strict';
/**
 * The override-count banner every render harness prints before it measures anything.
 *
 * WHY THIS IS A FIRST-CLASS LINE AND NOT A LOG
 * --------------------------------------------
 * Every offline harness renders with an EMPTY published-override map, because DATABASE_URL
 * is not set. content_overrides.js reports that as
 *
 *     [content_overrides] Failed to load overrides: DATABASE_URL is not set, so this query…
 *
 * — an error line, in among other noise, that reads as a harmless environment complaint. It
 * is not. It means the harness is measuring content the production renderer would not
 * produce. Five PRs' worth of reports have cited runs like that as evidence about the
 * shipped report; the seven stale rows found on 12 August 2026 were invisible to all of them.
 *
 * Printing the count where the reader cannot miss it does not fix the gap — scripts/
 * overrides_check.js and the resolver throw do that. It stops the gap being mistaken for
 * its absence.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

/**
 * Loads the published overrides and prints one line describing what the run will render
 * against. Returns the Map so a caller can assert on it. Never throws.
 */
async function printOverrideBanner(label = '') {
  const co = require(path.join(ROOT, 'app/content_overrides.js'));
  let map = new Map();
  try { map = await co.loadPublishedOverrides(); } catch { /* reported below as 0 */ }
  const n = map.size;
  const prefix = label ? `${label} ` : '';
  if (n === 0) {
    console.log(`${prefix}overrides: 0 published (none loaded — no DATABASE_URL, or the table is empty).`);
    console.log(`${prefix}            This run does NOT exercise the CMS override layer. Production may differ.`);
  } else {
    console.log(`${prefix}overrides: ${n} published — ${[...map.keys()].join(', ')}`);
  }
  return map;
}

module.exports = { printOverrideBanner };
