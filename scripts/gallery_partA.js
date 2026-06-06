'use strict';

/**
 * gallery_partA.js — Step 7 Phase 3 visual-verification harness.
 *
 * Renders every Part A primitive in isolation into one HTML page for browser QA:
 *   - buildEnneagramSVG: 3 variants × 9 types (27) + the type-agnostic 'base'.
 *   - renderTypeStrengthChart + renderInstinctChart (synthetic scores).
 *   - partAStyles() :root tokens applied to the page.
 * Offline; no API key. Output: .phase3_gallery/index.html (gitignored).
 *
 * USAGE: node scripts/gallery_partA.js   then serve + screenshot the output dir.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const R = require(path.join(ROOT, 'app/renderer.js'));

const OUT_DIR = path.join(ROOT, '.phase3_gallery');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const TYPE_NAMES = {
  1: 'Improver', 2: 'Giver', 3: 'Performer', 4: 'Individualist', 5: 'Observer',
  6: 'Questioner', 7: 'Enthusiast', 8: 'Protector', 9: 'Peacemaker',
};

const cell = (title, svg) =>
  `<div class="cell"><div class="cap">${title}</div><div class="art">${svg}</div></div>`;

function variantGrid(variant) {
  const cells = [];
  for (let n = 1; n <= 9; n++) cells.push(cell(`Type ${n} — ${TYPE_NAMES[n]}`, R.buildEnneagramSVG({ type: n, variant })));
  return `<h2>variant: <code>${variant}</code></h2><div class="grid">${cells.join('')}</div>`;
}

// Synthetic scores for charts (deterministic; verifies fills/order/scale, not data).
const typeBars = [8, 9, 1, 2, 3, 4, 5, 6, 7].map((t, i) => ({ type: t, score: 90 - i * 8 }));
const instinctBars = [{ code: 'SP', score: 82 }, { code: 'SO', score: 45 }, { code: 'SX', score: 63 }];

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Part A gallery</title>
${R.partAStyles()}
<style>
  body{margin:24px;background:#fff;}
  h1{font-size:20pt;color:var(--hive-blue);}
  h2{font-size:12pt;color:var(--section-title);margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:4px;}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
  .cell{border:1px solid #eee;border-radius:6px;padding:8px;}
  .cap{font-size:9pt;font-weight:bold;color:var(--section-title);margin-bottom:4px;}
  .art{width:220px;height:220px;margin:0 auto;}
  .charts{display:grid;grid-template-columns:1fr 1fr;gap:32px;max-width:820px;}
  .chartbox{border:1px solid #eee;border-radius:6px;padding:14px;}
</style></head>
<body>
  <h1>InsightOut — Part A shared library (Phase 3)</h1>

  <h2>variant: <code>base</code> (type-agnostic)</h2>
  <div class="grid"><div class="cell"><div class="cap">base</div><div class="art">${R.buildEnneagramSVG({ variant: 'base' })}</div></div></div>

  ${variantGrid('type')}
  ${variantGrid('wings-lines')}

  <h2>Bar charts (A5) — synthetic scores, fixed 0–100</h2>
  <div class="charts">
    <div class="chartbox"><div class="cap">Relative Type Pattern Strength (order 8,9,1,2,3,4,5,6,7)</div>${R.renderTypeStrengthChart(typeBars)}</div>
    <div class="chartbox"><div class="cap">Relative Instincts Strength (SP, SO, SX)</div>${R.renderInstinctChart(instinctBars)}</div>
  </div>
</body></html>`;

const out = path.join(OUT_DIR, 'index.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${path.relative(ROOT, out)} (${(html.length / 1024).toFixed(1)} KB)`);
console.log('Serve + open:  (cd ' + path.relative(ROOT, OUT_DIR) + ' && python3 -m http.server)  then http://localhost:8000');
