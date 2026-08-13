#!/usr/bin/env node
'use strict';
/**
 * ONE-TIME migration — moves the two CMS override edits Cai kept into the Word source,
 * so the rows can be retired without losing the content.
 *
 * WHY
 * ---
 * Seven content_overrides rows published 13-29 June 2026 sat outside PR 1.5's
 * docx/JSON reconciliation. Six carried real edits. Cai's decisions (12 Aug 2026):
 *
 *   static.primer.footer   KEEP the override's URL version. Page 4's footer points the
 *                          reader to the website; the Welcome sign-off keeps its own URL.
 *                          The reader meets the link twice, two pages apart, deliberately.
 *   subtype_sx9.tagline    KEEP "significant other". Mo's word choice stands.
 *
 * Both fields are Word-sourced — footer from the ENNEAGRAM PRIMER FOOTER section, the
 * tagline from the paragraph immediately after the "SX9 —" heading — so migration is a
 * docx paragraph edit and the ordinary build carries it into content_library.json. The
 * remaining five rows carry nothing worth keeping and are deleted outright.
 *
 * DELETION ORDER IS NOT OPTIONAL. Verify the built library carries these values BEFORE
 * running scripts/retire_overrides.js --confirm. Retiring first loses the content: the
 * override table is the only place either edit exists.
 *
 * HOW IT TARGETS PASSAGES
 * -----------------------
 * By paragraph index, using the same tokenisation as build_content_library.js, exactly as
 * reconcile_content_docx.js does — never string search, so a sentence appearing twice is
 * not a hazard. Each target's CURRENT text is asserted against the committed library
 * before anything is written; a mismatch aborts without touching the file.
 *
 *   node scripts/migrate_overrides_to_docx.js              # dry run
 *   node scripts/migrate_overrides_to_docx.js --write      # patch the docx
 *
 * Then: node scripts/build_content_library.js && node scripts/verify_content_library.js
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const JSZip = require(path.join(ROOT, 'app/node_modules/jszip'));

const DOCX = path.join(ROOT, 'docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx');
const LIB = require(path.join(ROOT, 'app/content/content_library.json'));
const write = process.argv.includes('--write');

// The two keeps. `from` is asserted against the committed library before patching.
const TARGETS = [
  {
    key: 'static.primer.footer',
    from: LIB.static.primer.footer,
    to: 'For more detailed information on the Enneagram or each of the nine Enneagram types, visit us at https://www.hiveleadership.com/the-enneagram.',
    locate: 'the first body paragraph after the ENNEAGRAM PRIMER FOOTER label',
  },
  {
    key: 'subtype_sx9.tagline',
    from: LIB.subtype_sx9.tagline,
    to: 'The Seeker — peace through merging with a significant other.',
    locate: 'the first body paragraph after the "SX9 —" heading',
  },
];

// ── mirrors build_content_library.js exactly ─────────────────────────────────
const unescapeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function isLabel(t) {
  if (t.length > 60) return false;
  const letters = [...t].filter(ch => /[a-z]/i.test(ch));
  if (!letters.length) return false;
  return letters.filter(ch => ch === ch.toUpperCase()).length / letters.length > 0.85;
}
const isWordCount = (s) => /^\[word count/i.test(s);

function splitParagraphs(xml) {
  const starts = [];
  const re = /<w:p[ >]/g;
  let m;
  while ((m = re.exec(xml))) starts.push(m.index);
  return starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : xml.length;
    const chunk = xml.slice(s, end);
    const runs = [...chunk.matchAll(/(<w:t[^>]*>)(.*?)(<\/w:t>)/g)].map(r => ({
      open: r[1], text: r[2], close: r[3], index: r.index, length: r[0].length,
    }));
    const styleM = chunk.match(/<w:pStyle w:val="([^"]+)"/);
    return {
      i, start: s, end, chunk, runs,
      style: styleM ? styleM[1] : 'Normal',
      text: unescapeXml(runs.map(r => r.text).join('')).trim(),
    };
  });
}

/** Replace a paragraph's text across its runs, keeping the first run's formatting. */
function patchParagraph(chunk, runs, newText) {
  if (!runs.length) throw new Error('paragraph has no text runs');
  let out = chunk;
  for (let k = runs.length - 1; k >= 1; k--) {
    const r = runs[k];
    out = out.slice(0, r.index) + r.open + r.close + out.slice(r.index + r.length);
  }
  const r0 = runs[0];
  return out.slice(0, r0.index) + r0.open + escapeXml(newText) + r0.close + out.slice(r0.index + r0.length);
}

/** First body paragraph at or after `from`: non-empty, not a label, not a bullet, not a word count. */
function firstBodyAfter(paras, from) {
  for (let i = from + 1; i < paras.length; i++) {
    const p = paras[i];
    if (!p.text) continue;
    if (p.style === 'ListParagraph') continue;
    if (isLabel(p.text)) continue;
    if (isWordCount(p.text)) continue;
    return p;
  }
  return null;
}

(async () => {
  const zip = await JSZip.loadAsync(fs.readFileSync(DOCX));
  const xml = await zip.file('word/document.xml').async('string');
  const paras = splitParagraphs(xml);

  const footerLabel = paras.find(p => p.text === 'ENNEAGRAM PRIMER FOOTER');
  const sx9Heading = paras.find(p => /^SX9\s*[—–-]\s*/.test(p.text));
  if (!footerLabel) throw new Error('ENNEAGRAM PRIMER FOOTER label not found');
  if (!sx9Heading) throw new Error('SX9 heading not found');

  const found = [firstBodyAfter(paras, footerLabel.i), firstBodyAfter(paras, sx9Heading.i)];

  console.log('=== Migrate kept CMS override edits into the Word source ===\n');
  let abort = false;
  TARGETS.forEach((t, n) => {
    const p = found[n];
    console.log(`${t.key}`);
    console.log(`  located: paragraph ${p ? p.i : '(none)'} — ${t.locate}`);
    if (!p) { console.log('  *** ABORT — target paragraph not found'); abort = true; return; }
    console.log(`  BEFORE (${p.text.length}ch): ${JSON.stringify(p.text)}`);
    console.log(`  AFTER  (${t.to.length}ch): ${JSON.stringify(t.to)}`);
    if (p.text !== t.from) {
      console.log('  *** ABORT — the docx paragraph does not match the committed library value.');
      console.log(`      library: ${JSON.stringify(t.from)}`);
      abort = true;
    } else {
      console.log('  ✓ docx matches the committed library — safe to patch');
    }
    console.log('');
  });
  if (abort) process.exit(1);

  if (!write) {
    console.log('DRY RUN — nothing written. Re-run with --write.');
    return;
  }

  // Patch back-to-front so earlier offsets stay valid.
  const order = TARGETS.map((t, n) => ({ t, p: found[n] })).sort((a, b) => b.p.start - a.p.start);
  let out = xml;
  for (const { t, p } of order) {
    const patched = patchParagraph(p.chunk, p.runs, t.to);
    out = out.slice(0, p.start) + patched + out.slice(p.end);
  }

  zip.file('word/document.xml', out);
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(DOCX, buf);
  console.log(`WROTE ${path.relative(ROOT, DOCX)} (${(buf.length / 1024).toFixed(1)} KB)`);
  console.log('\nNext: node scripts/build_content_library.js && node scripts/verify_content_library.js');
  console.log('Confirm both values land in the built library BEFORE retiring the override rows.');
})().catch(e => { console.error('MIGRATION FAILED:', e.stack || e.message); process.exit(1); });
