'use strict';
/**
 * Pairs each drifted leaf field with the docx paragraph(s) that produced it.
 *
 * Locating is done by the paragraph's exact current text, which the audit measured to be
 * unambiguous for every target: 132/132 unique matches, zero collisions. The build script's
 * parse is paragraph-oriented, so once a paragraph is identified its index is a stable
 * address that does not depend on string search over the whole document.
 *
 * Three shapes of target:
 *
 *   1. Whole-paragraph  — the field's value IS one paragraph's text (116 of them).
 *   2. Multi-paragraph  — the field is `normParas(b).join('\n\n')` over consecutive
 *                         paragraphs (15 narratives + static.primer.intro). Measured: the
 *                         committed value splits into the same number of parts in every
 *                         case, so the correspondence is 1:1 and each part is patched into
 *                         its own paragraph.
 *   3. Pipe row         — one cell of a '|'-delimited table line
 *                         (static.primer.nine_types[4].description). The delimiters make
 *                         the boundary unambiguous; the surrounding cells are preserved.
 *
 * The docx-derived side is passed in rather than recomputed, so this module has no opinion
 * about how the library is built — it only answers "which paragraph holds this text".
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

function leaves(o, prefix = '', out = {}) {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(o)) {
    o.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
  } else out[prefix] = o;
  return out;
}

module.exports = function buildTargets(committedLib, paras, byText) {
  // The docx's current view, produced by the same build the script performs. Written by
  // the caller's scratch build so this module stays free of build logic.
  const docxLibPath = process.env.RECONCILE_DOCX_JSON;
  if (!docxLibPath || !fs.existsSync(docxLibPath)) {
    throw new Error('RECONCILE_DOCX_JSON must point at a JSON built from the CURRENT docx.\n'
      + 'Produce it with a scratch build, then re-run. See scripts/reconcile_content_docx.js.');
  }
  const D = leaves(JSON.parse(fs.readFileSync(docxLibPath, 'utf8')));
  const C = leaves(committedLib);

  const targets = [], deletions = [], unresolved = [];
  const claimed = new Set();

  const locate = (text) => {
    const hits = (byText.get(text.trim()) || []).filter(p => !claimed.has(p.i));
    return hits.length === 1 ? hits[0] : (hits.length === 0 ? null : 'AMBIGUOUS');
  };

  for (const key of Object.keys(D)) {
    if (key.startsWith('_meta')) continue;
    const docxVal = D[key];
    if (typeof docxVal !== 'string') continue;

    // Present in docx but absent from the committed library -> the passage was deleted.
    if (!(key in C)) {
      const p = locate(docxVal);
      if (!p || p === 'AMBIGUOUS') { unresolved.push({ key, why: p === 'AMBIGUOUS' ? 'ambiguous' : 'not found', op: 'delete' }); continue; }
      claimed.add(p.i);
      deletions.push({ field: key, paraIndex: p.i });
      continue;
    }
    const newVal = C[key];
    if (typeof newVal !== 'string' || newVal === docxVal) continue;

    // 1. Whole paragraph.
    let p = locate(docxVal);
    if (p && p !== 'AMBIGUOUS') {
      claimed.add(p.i);
      targets.push({ field: key, paraIndex: p.i, newText: newVal });
      continue;
    }

    // 2. Multi-paragraph field.
    const oldParts = docxVal.split('\n\n').filter(s => s.trim());
    const newParts = newVal.split('\n\n').filter(s => s.trim());
    if (oldParts.length > 1 && oldParts.length === newParts.length) {
      const found = oldParts.map(locate);
      if (found.every(x => x && x !== 'AMBIGUOUS')) {
        found.forEach((pp, idx) => {
          claimed.add(pp.i);
          targets.push({ field: `${key}#${idx}`, paraIndex: pp.i, newText: newParts[idx] });
        });
        continue;
      }
    }

    // 3. Pipe-delimited table cell.
    const row = paras.find(pp => !claimed.has(pp.i) && pp.text.includes('|') && pp.text.includes(docxVal.trim()));
    if (row) {
      const cells = row.text.split('|').map(s => s.trim());
      const at = cells.findIndex(c => c === docxVal.trim());
      if (at >= 0) {
        cells[at] = newVal;
        claimed.add(row.i);
        targets.push({ field: `${key} (pipe cell ${at})`, paraIndex: row.i, newText: cells.join(' | ') });
        continue;
      }
    }

    unresolved.push({ key, why: 'no strategy matched', op: 'replace' });
  }

  if (unresolved.length) {
    console.error(`\n${unresolved.length} target(s) could not be located — refusing to patch a partial set:`);
    for (const u of unresolved) console.error(`  [${u.op}] ${u.key}  (${u.why})`);
    throw new Error('Unresolved targets. No file written.');
  }
  return { targets, deletions };
};
