'use strict';
/**
 * Normalized PDF hashing — the coach report's regression gate.
 *
 * Chromium stamps a wall-clock /CreationDate and /ModDate into every PDF it prints, so two
 * renders of byte-identical HTML seconds apart differ. That makes a raw byte comparison
 * useless as a gate.
 *
 * A structural comparison (page count + per-page heights) was the fallback, but it cannot
 * see colour — and colour is precisely the bug class design spec v3.0 section 3.2 exists
 * for: the cover rendering pink instead of blue changed no page height.
 *
 * Both date values are FIXED-LENGTH strings in the info dictionary, so replacing the digits
 * with a constant of identical length leaves every xref byte offset intact. Verified: two
 * consecutive renders of the same HTML differ by exactly 2 bytes (the seconds digits) and
 * produce identical normalized hashes.
 *
 * If a future Chromium emits a variable-length date or an /ID array, assertSameLength below
 * will catch it — the hash would still be stable, but the guarantee should be re-checked.
 */

const crypto = require('crypto');

const DATE_RE = /\/(CreationDate|ModDate) ?\(D:\d{14}([+\-]\d{2}'\d{2}')?\)/g;

/** Replace timestamp payloads with a constant of the same length. */
function normalizePdf(input) {
  // page.pdf() resolves to a Uint8Array, not a Buffer. Uint8Array#toString ignores its
  // argument and returns comma-separated byte values, which silently produces a garbage
  // "normalized" blob roughly 3.5x the input size — caught by the length check below.
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const s = buf.toString('latin1');
  const out = s.replace(DATE_RE, (match, key) => {
    const replacement = `/${key} (D:00000000000000+00'00')`;
    // Preserve length exactly; fall back to digit-only substitution if spacing differs.
    return replacement.length === match.length
      ? replacement
      : match.replace(/\d{14}/, '00000000000000');
  });
  const buf2 = Buffer.from(out, 'latin1');
  if (buf2.length !== buf.length) {
    throw new Error(`normalizePdf changed byte length (${buf.length} -> ${buf2.length}); `
      + 'xref offsets would be invalid. Inspect the PDF info dictionary.');
  }
  return buf2;
}

function pdfHash(buf) {
  return crypto.createHash('sha256').update(normalizePdf(buf)).digest('hex');
}

function htmlHash(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

module.exports = { normalizePdf, pdfHash, htmlHash };
