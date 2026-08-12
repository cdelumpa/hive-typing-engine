#!/usr/bin/env node
'use strict';
/**
 * ONE-TIME reconciliation tool — patches the Word source so it matches the committed
 * content library, making Word canonical again.
 *
 * WHY THIS EXISTS
 * ---------------
 * app/content/content_library.json drifted from its Word source by 132 leaf fields:
 * 130 replaces and 2 deletions. The JSON began as a faithful build of this docx
 * (measured: the first committed build matched on 1287 of 1290 leaves), and the docx has
 * not been written since, so every difference is a later deliberate edit to the JSON —
 * mostly Mo-approved page-fit trims made against rendered output. See
 * docs/audit_pr1_5_content_reconciliation.md for the provenance evidence.
 *
 * The JSON is therefore authoritative in every case, and this tool moves its values back
 * into the docx rather than the other way round.
 *
 * HOW IT TARGETS PASSAGES
 * -----------------------
 * By paragraph index, not string search. The build script's parse is deterministic and
 * paragraph-oriented, so the same tokenisation identifies exactly which <w:p> produced
 * each JSON leaf. That removes the "same sentence appears twice" hazard entirely —
 * measured: 132/132 targets locate uniquely, zero ambiguous matches.
 *
 * BOLD
 * ----
 * 28 target paragraphs carry <w:b/> on a lead-in phrase ending in an em-dash. Where the
 * new text still begins with that phrase verbatim, only the trailing run is patched and
 * the bold survives. Where the edit rewrote the lead-in, the paragraph collapses to a
 * single unbolded run: the construction the bold was marking no longer exists in the
 * prose, so preserving it would assert a structure that is gone. Formatting cannot affect
 * the build output — the parser reads <w:t> text and discards everything else — so this is
 * a Word-side authoring decision only. The resulting mixed state is deliberate and is
 * reported below for Mo's pending coordinated bold pass.
 *
 * SAFETY
 * ------
 * Writes only the docx. Never touches content_library.json — verification is done by
 * running the ordinary build afterwards, which refuses to write while any content would
 * change. Run with --dry to preview without writing.
 *
 *   node scripts/reconcile_content_docx.js --dry
 *   node scripts/reconcile_content_docx.js
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const JSZip = require(path.join(ROOT, 'app/node_modules/jszip'));

const DOCX = path.join(ROOT, 'docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx');
const LIB = path.join(ROOT, 'app/content/content_library.json');
const DRY = process.argv.includes('--dry');

// ── XML helpers, mirroring build_content_library.js exactly ──────────────────
const unescapeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function splitParagraphs(xml) {
  const out = [];
  const re = /<w:p[ >]/g;
  let m, starts = [];
  while ((m = re.exec(xml))) starts.push(m.index);
  for (let i = 0; i < starts.length; i++) {
    out.push({ start: starts[i], end: i + 1 < starts.length ? starts[i + 1] : xml.length });
  }
  return out.map((p, i) => {
    const chunk = xml.slice(p.start, p.end);
    const runs = [...chunk.matchAll(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g)].map(r => ({
      open: r[1], text: r[2], close: r[3], index: r.index, length: r[0].length,
    }));
    return { i, ...p, chunk, runs, text: unescapeXml(runs.map(r => r.text).join('')) };
  });
}

/** Replace a paragraph's text, preserving the bold lead-in run when it still applies. */
function patchParagraph(chunk, runs, newText) {
  if (runs.length === 0) return { chunk, mode: 'skipped-no-runs' };
  if (runs.length === 1) {
    const r = runs[0];
    return {
      chunk: chunk.slice(0, r.index) + r.open + escapeXml(newText) + r.close + chunk.slice(r.index + r.length),
      mode: 'single-run',
    };
  }
  const lead = unescapeXml(runs[0].text);
  if (newText.startsWith(lead)) {
    // Bold lead-in survives verbatim: patch only the trailing run(s).
    const rest = newText.slice(lead.length);
    let out = chunk, delta = 0;
    for (let k = 1; k < runs.length; k++) {
      const r = runs[k];
      const replacement = r.open + (k === 1 ? escapeXml(rest) : '') + r.close;
      out = out.slice(0, r.index + delta) + replacement + out.slice(r.index + delta + r.length);
      delta += replacement.length - r.length;
    }
    return { chunk: out, mode: 'bold-preserved' };
  }
  // Lead-in rewritten: collapse to the first run, empty the rest, and drop the bold so the
  // formatting does not claim a structure the prose no longer has.
  let out = chunk, delta = 0;
  for (let k = runs.length - 1; k >= 1; k--) {
    const r = runs[k];
    const replacement = r.open + r.close;
    out = out.slice(0, r.index) + replacement + out.slice(r.index + r.length);
  }
  const r0 = runs[0];
  out = out.slice(0, r0.index) + r0.open + escapeXml(newText) + r0.close + out.slice(r0.index + r0.length);
  // Remove bold from the run properties of the (now sole) text-bearing run.
  out = out.replace(/<w:b\/>/g, '').replace(/<w:b [^>]*\/>/g, '');
  return { chunk: out, mode: 'collapsed' };
}

/** Delete a paragraph entirely (used for the 2 trimmed bullets). */
function deleteParagraph() { return { chunk: '', mode: 'deleted' }; }

(async () => {
  const lib = JSON.parse(fs.readFileSync(LIB, 'utf8'));
  const zip = await JSZip.loadAsync(fs.readFileSync(DOCX));
  const xml = await zip.file('word/document.xml').async('string');
  const paras = splitParagraphs(xml);

  // Index paragraphs by their exact text so targets can be located unambiguously.
  const byText = new Map();
  for (const p of paras) {
    const key = p.text.trim();
    if (!byText.has(key)) byText.set(key, []);
    byText.get(key).push(p);
  }

  // Build the target list by walking the CURRENT docx-derived values and pairing them with
  // the committed JSON values. We re-derive the docx side here rather than trusting a saved
  // diff, so the tool is correct even if run twice.
  const { targets, deletions } = require(path.join(ROOT, 'scripts/lib/reconcile_targets.js'))(lib, paras, byText);

  console.log(`Targets: ${targets.length} replaces, ${deletions.length} deletions`);
  const ops = [];
  const stats = { 'single-run': 0, 'bold-preserved': 0, collapsed: 0, deleted: 0, 'skipped-no-runs': 0 };
  const collapsedList = [], preservedList = [];

  for (const t of targets) {
    const p = paras[t.paraIndex];
    const res = patchParagraph(p.chunk, p.runs, t.newText);
    stats[res.mode]++;
    if (res.mode === 'collapsed') collapsedList.push(t.field);
    if (res.mode === 'bold-preserved') preservedList.push(t.field);
    ops.push({ start: p.start, end: p.end, chunk: res.chunk });
  }
  for (const d of deletions) {
    const p = paras[d.paraIndex];
    stats.deleted++;
    ops.push({ start: p.start, end: p.end, chunk: deleteParagraph().chunk });
  }

  // Apply back-to-front so earlier offsets stay valid.
  ops.sort((a, b) => b.start - a.start);
  let out = xml;
  for (const op of ops) out = out.slice(0, op.start) + op.chunk + out.slice(op.end);

  console.log('\nDisposition (measured):');
  for (const [k, v] of Object.entries(stats)) if (v) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log(`\nBold preserved (${preservedList.length}):`);
  preservedList.forEach(f => console.log(`  ${f}`));
  console.log(`\nBold collapsed (${collapsedList.length}) — input for the pending coordinated bold pass:`);
  collapsedList.forEach(f => console.log(`  ${f}`));

  if (DRY) { console.log('\n--dry: no file written.'); return; }
  zip.file('word/document.xml', out);
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(DOCX, buf);
  console.log(`\nWrote ${path.relative(ROOT, DOCX)} (${buf.length} bytes).`);
  console.log('Verify with: node scripts/build_content_library.js   (must succeed WITHOUT --accept-drift)');
})().catch(e => { console.error('RECONCILE FAILED:', e.stack || e.message); process.exit(1); });
