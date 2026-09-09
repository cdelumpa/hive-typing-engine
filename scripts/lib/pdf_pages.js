'use strict';
/**
 * pdf_pages.js — how many physical sheets a PDF actually has (PR 5 Build B3).
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────
 * Every fit measurement in PR 5 is Chromium screen layout at 816px: `enforceSheet` compares a DOM
 * element's height to 1056px, and render_client.js prints "estimated physical sheets" from
 * ceil(height / (PAGE_PX + 1)). That is a PROXY for one sheet, not the thing itself. The client
 * receives a PDF, and until this file nothing in the repo read one back — render_client.js:883
 * writes a PDF per render and no gate has ever opened it.
 *
 * Closing PR 5 while believing "one sheet" was covered, when only the stand-in was, is the
 * gates-that-do-not-gate pattern operating on a whole PR rather than on one assertion. [DECISION —
 * Cai: close it in B3 rather than carding it.]
 *
 * ── THE METHOD ───────────────────────────────────────────────────────────────────────────────
 * Count `/Type /Page` objects, excluding `/Type /Pages` (the tree node). Cross-checked against the
 * page tree's own `/Count`, and a disagreement FAILS rather than picking a winner: two readings of
 * the same file that disagree mean the parse is wrong, and a gate that silently prefers one has
 * stopped measuring.
 *
 * Chromium writes page objects uncompressed, so the raw bytes are enough. If a future Chromium
 * moves them into object streams the raw count drops to zero, which is why `inflated` exists and
 * why `source` is reported: a silent zero would make this gate pass everything.
 */
const zlib = require('zlib');

/** Raw bytes as latin1. page.pdf() resolves to a Uint8Array, whose toString ignores its argument
 *  and returns comma-joined byte values — the mistake tests/lib/pdf_normalize.js records. */
function latin1(input) {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString('latin1');
}

/** Raw text plus every stream that inflates, for the object-stream case. */
function withStreams(raw) {
  const parts = [raw];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    try { parts.push(zlib.inflateSync(Buffer.from(raw.slice(start, end), 'latin1')).toString('latin1')); }
    catch { /* not Flate, or an image; the raw bytes are already in parts[0] */ }
  }
  return parts.join('\n');
}

/**
 * `{ pages, count, source }` — pages from the page objects, count from the tree, source telling
 * you which bytes were read. `count` is null when no page tree node was found.
 */
function readPageCount(input) {
  const raw = latin1(input);
  // (?![s\w]) so /Type /Pages and any longer name cannot be mistaken for a page.
  const countIn = (t) => (t.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  let text = raw, source = 'raw';
  let pages = countIn(text);
  if (pages === 0) { text = withStreams(raw); source = 'inflated'; pages = countIn(text); }
  // The page tree node carries /Count. Key order inside a dictionary is not fixed, so both
  // orderings are matched rather than assuming Chromium's.
  const forward = [...text.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,600}?\/Count\s+(\d+)/g)].map((m) => +m[1]);
  const backward = [...text.matchAll(/\/Count\s+(\d+)[\s\S]{0,600}?\/Type\s*\/Pages\b/g)].map((m) => +m[1]);
  const all = forward.concat(backward);
  // The ROOT of the tree is the largest /Count; intermediate nodes carry their own subtotals.
  const count = all.length ? Math.max(...all) : null;
  return { pages, count, source };
}

/**
 * Assert a PDF is exactly `expected` sheets. Returns null when it is, or a message when it is not.
 * Kept as a returned string rather than a throw so the harness can accumulate failures the way it
 * does for every other check.
 */
function checkPageCount(input, expected, label) {
  const r = readPageCount(input);
  if (r.pages === 0) {
    return `${label}: could not find any page objects in the PDF (source ${r.source}) — this gate `
         + `would pass everything, so it fails instead`;
  }
  if (r.count != null && r.count !== r.pages) {
    return `${label}: the PDF disagrees with itself — ${r.pages} page objects but the page tree `
         + `says /Count ${r.count} (source ${r.source})`;
  }
  if (r.pages !== expected) {
    return `${label}: the PDF has ${r.pages} sheets, expected ${expected} (source ${r.source})`;
  }
  return null;
}

module.exports = { readPageCount, checkPageCount };
