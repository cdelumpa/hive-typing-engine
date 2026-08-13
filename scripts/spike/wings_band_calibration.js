'use strict';
/**
 * p8 WINGS — CHARACTER-BAND CALIBRATION. AUDIT SCRATCH, NOT A GATE.
 *
 * Written for docs/audit_pr3_wings.md (PR 3 audit, 13 Aug 2026).
 *
 * WHAT THIS REPLACES. The 12 Aug fit spike produced a character-band rule of thumb —
 * "<=52 chars one line, 53-72 two lines with a ragged last line, 73-88 two lines well
 * filled" — from a handful of samples. That is a proxy. This measures the actual thing:
 * it renders REAL PROSE at every character length into the REAL zone elements of the REAL
 * p8 page under the pinned Chromium, and reports, per length, how many lines came out and
 * how full the last one was.
 *
 * NO CONTENT IS INVENTED. The corpus is existing authored prose already in the repo —
 * every string leaf of app/content/content_library.json plus the p9 spike file. Sentences
 * are cut at word boundaries to hit each target length. These strings are measurement
 * probes for the CONTAINER; none of them is proposed as Wings copy.
 *
 * The zone elements are mutated in place and restored, and nothing is written back to any
 * content file.
 *
 *   node scripts/spike/wings_band_calibration.js
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

const R = require(path.join(ROOT, 'app/renderer.js'));
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));

const PAGE_PX = 1056;
const WINGS_INDEX = 4;
const OUT = path.join(ROOT, '.phase6_out');
fs.mkdirSync(OUT, { recursive: true });

const V3_CLIENT = { full_name: 'Anders Lindqvist', first_name: 'Anders', email: 'anders@example.com', date: 'August 13, 2026' };
const coach = { full_name: 'Monique Breault', first_name: 'Mo', email: 'mo@hive.example' };

// ── Corpus: real authored prose already in the repo ─────────────────────────────
function collectStrings(o, out = []) {
  if (typeof o === 'string') { if (o.length > 30) out.push(o); }
  else if (Array.isArray(o)) o.forEach(v => collectStrings(v, out));
  else if (o && typeof o === 'object') Object.values(o).forEach(v => collectStrings(v, out));
  return out;
}

function buildCorpus() {
  const lib = require(path.join(ROOT, 'app/content/content_library.json'));
  const spike = require(path.join(ROOT, 'scripts/spike/p9_lines_content.js'));
  const raw = [...collectStrings(lib), ...collectStrings(spike.P9_SPIKE)];
  // Split into sentences, normalise whitespace, drop anything with markup or newlines.
  const sents = [];
  for (const s of raw) {
    for (const piece of s.split(/(?<=[.?!])\s+/)) {
      const t = piece.replace(/\s+/g, ' ').trim();
      if (t.length > 25 && !/[<>{}|]/.test(t)) sents.push(t);
    }
  }
  const uniq = [...new Set(sents)];
  // Overviews and resource bands are TWO sentences (150-210 chars); single repo sentences
  // mostly run 40-120, so prefixes above ~150 would be sampled from a handful of unusually
  // long outliers. Joining consecutive sentences restores a real word-length distribution
  // across the whole range these zones occupy.
  const pairs = [];
  for (let i = 0; i + 1 < uniq.length; i++) pairs.push(`${uniq[i]} ${uniq[i + 1]}`);
  return [...uniq, ...pairs];
}

/**
 * For each target length, gather word-boundary prefixes of real sentences whose length is
 * exactly that target. Sampling many distinct strings per length is the point: whether a
 * given length wraps depends on where its last space falls, so one sample per length would
 * reproduce the coin-flip the band rule already suffers from.
 */
function samplesByLength(corpus, lo, hi, perLength) {
  const buckets = new Map();
  for (let n = lo; n <= hi; n++) buckets.set(n, []);
  for (const sent of corpus) {
    const words = sent.split(' ');
    let acc = '';
    for (const w of words) {
      acc = acc ? `${acc} ${w}` : w;
      if (acc.length > hi) break;
      const b = buckets.get(acc.length);
      if (b && b.length < perLength) b.push(acc);
    }
  }
  return buckets;
}

(async () => {
  const corpus = buildCorpus();
  console.log(`corpus: ${corpus.length} distinct real sentences from content_library.json + p9 spike`);

  const ZONES = [
    { key: 'bullet',   sel: '.v3-wing-txt',    lo: 35, hi: 100, per: 40 },
    { key: "overview", sel: ".v3-wing-over",   lo: 120, hi: 250, per: 60 },
    { key: "resource", sel: ".v3-res-txt",     lo: 100, hi: 230, per: 60 },
  ];

  const fixture = require(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json'));
  const apiResult = JSON.parse(JSON.stringify(fixture));   // Type 9 — the only page with all zones populated
  const model = await prep.buildClientModel({ apiResult, client: V3_CLIENT, coach });
  const html = R.buildClientReportHTML_v3(model);

  const browser = await browserLaunch.launchBrowser();
  let results;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    await browserLaunch.assertReportFont(page);
    await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
    await new Promise(r => setTimeout(r, 150));

    const payload = ZONES.map(z => ({
      key: z.key, sel: z.sel,
      lengths: [...samplesByLength(corpus, z.lo, z.hi, z.per).entries()]
        .map(([n, arr]) => ({ n, samples: arr })).filter(e => e.samples.length >= 5),
    }));

    results = await page.evaluate((payload, WINGS_INDEX) => {
      const el = [...document.querySelectorAll('.v3-page')][WINGS_INDEX];
      const lineRects = (n) => {
        const rg = document.createRange();
        rg.selectNodeContents(n);
        const raw = [...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0);
        const byTop = new Map();
        for (const r of raw) {
          const k = Math.round(r.top * 2) / 2;
          const cur = byTop.get(k);
          if (!cur) byTop.set(k, { top: k, left: r.left, right: r.right });
          else { cur.left = Math.min(cur.left, r.left); cur.right = Math.max(cur.right, r.right); }
        }
        return [...byTop.values()].sort((a, b) => a.top - b.top).map(r => ({ width: r.right - r.left }));
      };

      const out = {};
      for (const z of payload) {
        const node = el.querySelector(z.sel);
        const original = node.innerHTML;
        // AVAILABLE LINE WIDTH. Not `getBoundingClientRect().width`: `.v3-wing-txt` is a
        // flex item that shrinks to its content, so a short bullet reports a box narrower
        // than the space it actually had. Not one long unbroken token either — with no
        // break opportunity it overflows the box and the rect reports the overflowing text
        // width. Fill the node with many short words so it genuinely wraps, then take the
        // widest resulting line box: that is the width the wrap algorithm was working with.
        node.textContent = Array(200).fill('lorem ipsum dolor sit amet').join(' ');
        const availW = Math.max(...lineRects(node).map(r => r.width));
        const rows = [];
        for (const { n, samples } of z.lengths) {
          const rec = { n, count: samples.length, lines: {}, fills: [] };
          for (const s of samples) {
            node.textContent = s;
            const rects = lineRects(node);
            rec.lines[rects.length] = (rec.lines[rects.length] || 0) + 1;
            rec.fills.push(rects[rects.length - 1].width / availW);
          }
          rows.push(rec);
        }
        node.innerHTML = original;
        out[z.key] = { availW: +availW.toFixed(2), rows };
      }
      return out;
    }, payload, WINGS_INDEX);
    await page.close();
  } finally { await browser.close(); }

  const pct = (x) => (x * 100).toFixed(1) + '%';
  for (const z of ZONES) {
    const r = results[z.key];
    if (!r) continue;
    console.log(`\n=== ${z.key.toUpperCase()}  (${z.sel}, available line width ${r.availW}px) ===`);
    console.log('chars   n   lines(count)          minFill  meanFill   verdict');
    for (const row of r.rows) {
      const dist = Object.entries(row.lines).sort().map(([k, v]) => `${k}L×${v}`).join(' ');
      const min = Math.min(...row.fills), mean = row.fills.reduce((a, b) => a + b, 0) / row.fills.length;
      const single = Object.keys(row.lines).length === 1;
      const maxLines = Math.max(...Object.keys(row.lines).map(Number));
      let verdict = '';
      if (!single) verdict = 'MIXED — wrap is a coin flip';
      else if (min < 0.25) verdict = 'RAGGED — last line under 25%';
      else if (min < 0.5) verdict = 'short last line';
      else verdict = 'ok';
      row.maxLines = maxLines; row.min = min; row.mean = mean; row.stable = single;
      console.log(`${String(row.n).padStart(5)} ${String(row.count).padStart(3)}   ${dist.padEnd(20)} `
        + `${pct(min).padStart(7)}  ${pct(mean).padStart(8)}   ${verdict}`);
    }
    // Contiguous safe bands: stable line count AND min fill >= 25%.
    const safe = r.rows.filter(x => x.stable && x.min >= 0.25);
    const bands = [];
    for (const row of safe) {
      const last = bands[bands.length - 1];
      if (last && row.n === last.hi + 1 && row.maxLines === last.lines) last.hi = row.n;
      else bands.push({ lo: row.n, hi: row.n, lines: row.maxLines });
    }
    console.log(`  SAFE BANDS (stable line count, no last line under 25%):`);
    for (const b of bands.filter(b => b.hi > b.lo)) console.log(`    ${b.lo}-${b.hi} chars -> ${b.lines} line(s)`);
  }

  fs.writeFileSync(path.join(OUT, 'wings_band_calibration.json'), JSON.stringify(results, null, 2));
  console.log('\nwrote .phase6_out/wings_band_calibration.json');
})().catch(e => { console.error('CALIBRATION FAILED:', e.stack || e.message); process.exit(1); });
