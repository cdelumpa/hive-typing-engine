'use strict';
/**
 * MEASURE THE r2 CONTENT BEFORE TRANSCRIBING IT.
 * Splices the parsed export into an IN-MEMORY library copy and renders through the real
 * v3 renderer + stylesheet. Writes nothing into the repo.
 */
const path = require('path'), fs = require('fs'), Module = require('module');
const ROOT = '/Users/caidelumpa/Developer/hive-typing-engine';
const SCR = '/private/tmp/claude-501/-Users-caidelumpa/d23ef6cf-3512-43ae-91cf-0def433f857e/scratchpad';
const LIBPATH = path.join(ROOT, 'app/content/content_library.json');
const REAL = JSON.parse(fs.readFileSync(LIBPATH, 'utf8'));
const { types } = JSON.parse(fs.readFileSync(path.join(SCR, 'r2_parsed.json'), 'utf8'));
const bl = require(path.join(ROOT, 'app/browser_launch.js'));

const INTRO = 'Wings are the two types immediately adjacent to your home base type. Each wing "flavors" how your type shows up, and most people naturally lean more towards one wing. Both are always present, but which one shows up more is unique to you. When you access your wings intentionally they become valuable resources for balancing the automatic patterns of your home base type.';

// ── Type 9 diff against what INTERIM_WINGS_V3 already produced ────────────────
console.log('=== TYPE 9 DIFF — r2 export vs the live INTERIM_WINGS_V3 content ===');
{
  const live = REAL.type_9.wings;
  const r2 = types['9'].wings;
  let diffs = 0, same = 0;
  const cmp = (label, a, b) => {
    if (a === b) { same++; return; }
    diffs++;
    console.log(`  DIFFERS  ${label}`);
    console.log(`    live: ${JSON.stringify(a)}`);
    console.log(`    r2  : ${JSON.stringify(b)}`);
  };
  for (const slot of ['wing_a', 'wing_b']) {
    const lw = live[slot], tt = lw.target_type, rw = r2[tt];
    if (!rw) { console.log(`  *** r2 has no wing block for target type ${tt}`); diffs++; continue; }
    cmp(`type_9 wing ${tt} overview`, lw.overview, rw.overview.text);
    cmp(`type_9 wing ${tt} resource`, lw.resource, rw.resource.text);
    (lw.bullets || []).forEach((b, i) => cmp(`type_9 wing ${tt} bullet ${i + 1}`, b, rw.bullets[i] && rw.bullets[i].text));
  }
  cmp('type_9 wings.intro_v3', live.intro_v3, INTRO);
  console.log(`  ${same} identical, ${diffs} differing (15 zones compared: 2 overviews, 10 bullets, 2 resources, 1 intro)`);
}

// ── splice all nine into an in-memory copy ────────────────────────────────────
const lib = JSON.parse(JSON.stringify(REAL));
for (let n = 1; n <= 9; n++) {
  const t = lib[`type_${n}`], src = types[String(n)];
  t.wings.intro_v3 = INTRO;
  for (const slot of ['wing_a', 'wing_b']) {
    const tt = t.wings[slot].target_type, w = src.wings[tt];
    t.wings[slot].overview = w.overview.text;
    t.wings[slot].bullets = w.bullets.map(b => b.text);
    t.wings[slot].resource = w.resource.text;
  }
}
require.cache[require.resolve(LIBPATH)] = Object.assign(new Module(LIBPATH, null), { exports: lib, loaded: true });
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json'), 'utf8'));
const WINGS = 4;
const fx = (n) => { const f = JSON.parse(JSON.stringify(base)); f.hypothesis.confirmed_type = n;
  f.hypothesis.confirmed_type_name = null; f.hypothesis.alternate_candidate = (n % 9) + 1;
  if (f.coach_report?.section6?.pushes_back) f.coach_report.section6.pushes_back.alt_type_name = null; return f; };

(async () => {
  const browser = await bl.launchBrowser();
  const rows = [];
  for (let n = 1; n <= 9; n++) {
    const m = await prep.buildClientModel({ apiResult: fx(n),
      client: { first_name: 'Anders', last_name: 'Wennerstrom', organization: 'Hive', date: 'August 2026' },
      coach: { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' } });
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
    await page.setContent(R.buildClientReportHTML_v3(m), { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    await bl.assertReportFont(page);
    const r = await page.evaluate((WINGS) => {
      const pg = document.querySelectorAll('.v3-page')[WINGS];
      const lineBoxes = (e) => {
        const out = [];
        const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
        let node; const rects = [];
        while ((node = w.nextNode())) {
          if (!node.nodeValue.trim()) continue;
          const rg = document.createRange(); rg.selectNodeContents(node);
          rects.push(...[...rg.getClientRects()].filter(x => x.width > 0));
        }
        return rects;
      };
      // GROUP RECTS INTO LINES BY THEIR TOP EDGE. _v3NoBreak wraps hyphenated compounds in
      // <span class="v3-nb">, which splits the text into several nodes, so a raw rect count
      // over-reports: one line carrying a span yields 2-3 rects. Distinct tops is the line
      // count; the last line's fill is the SUM of the widths of the rects sharing that top.
      const zone = (e) => {
        const rects = lineBoxes(e);
        const byTop = new Map();
        for (const r of rects) {
          const k = Math.round(r.top * 2) / 2;
          const cur = byTop.get(k) || { w: 0, left: Infinity, right: -Infinity };
          cur.w += r.width; cur.left = Math.min(cur.left, r.left); cur.right = Math.max(cur.right, r.right);
          byTop.set(k, cur);
        }
        const tops = [...byTop.keys()].sort((a, b) => a - b);
        const last = tops.length ? byTop.get(tops[tops.length - 1]) : null;
        const box = e.getBoundingClientRect();
        return { chars: e.textContent.trim().length, lines: tops.length,
          fill: last ? +((last.right - last.left) / e.clientWidth).toFixed(3) : 0,
          h: +box.height.toFixed(2) };
      };
      const cols = [...pg.querySelectorAll('.v3-wing')];
      const per = cols.map(c => ({
        overview: zone(c.querySelector('.v3-wing-over')),
        bullets: [...c.querySelectorAll('.v3-wing-txt')].map(zone),
        resource: zone(c.querySelector('.v3-res-txt')),
        bodyH: +c.querySelector('.v3-wing-body').getBoundingClientRect().height.toFixed(2),
      }));
      // natural column heights with the flex stretch released
      const wrap = pg.querySelector('.v3-wings');
      const prevAlign = wrap.style.alignItems; wrap.style.alignItems = 'flex-start';
      const natural = cols.map(c => +c.getBoundingClientRect().height.toFixed(2));
      const naturalBody = cols.map(c => +c.querySelector('.v3-wing-body').getBoundingClientRect().height.toFixed(2));
      wrap.style.alignItems = prevAlign;
      const prevMin = pg.style.minHeight; pg.style.minHeight = '0px';
      const nat = pg.getBoundingClientRect().height; pg.style.minHeight = prevMin;
      return { per, natural, naturalBody, headroom: +(1056 - nat).toFixed(2), stack: +(nat - 80).toFixed(2) };
    }, WINGS);
    await page.close();
    rows.push({ n, ...r });
  }
  await browser.close();
  fs.writeFileSync(path.join(SCR, 'r2_measured.json'), JSON.stringify(rows, null, 2));

  // ── (b) report ──────────────────────────────────────────────────────────────
  console.log('\n=== (b) MEASURED FIT — r2 content through the real renderer ===');
  console.log('type  headroom    stack   | col A body  col B body  drift | A zones (o/b1-5/r lines)   B zones');
  for (const r of rows) {
    const f = (p) => `${p.overview.lines}/${p.bullets.map(b => b.lines).join('')}/${p.resource.lines}`;
    console.log(`  ${r.n}  ${String(r.headroom).padStart(8)}px ${String(r.stack).padStart(8)} | `
      + `${String(r.naturalBody[0]).padStart(9)}  ${String(r.naturalBody[1]).padStart(10)}  ${String(Math.abs(r.natural[0] - r.natural[1]).toFixed(2)).padStart(6)} | `
      + `${f(r.per[0]).padEnd(24)}  ${f(r.per[1])}`
      + (r.headroom < 0 ? '  *** SPILLS' : ''));
  }

  console.log('\n=== COLUMN BODY vs 600.00px BUDGET ===');
  console.log('type   col A body   margin   col B body   margin   verdict');
  for (const r of rows) {
    const a = r.naturalBody[0], b = r.naturalBody[1];
    const ma = 600 - a, mb = 600 - b;
    const v = (ma < 0 || mb < 0) ? '*** OVER BUDGET' : (Math.min(ma, mb) < 20 ? 'tight' : 'ok');
    console.log(`  ${r.n}   ${String(a).padStart(9)}  ${String(ma.toFixed(2)).padStart(7)}   ${String(b).padStart(9)}  ${String(mb.toFixed(2)).padStart(7)}   ${v}`);
  }

  console.log('\n=== ZONES OUTSIDE THE AUTHORING BANDS (bullets: <=52 or 73-88 | overview: <=205) ===');
  let out = 0;
  for (const r of rows) {
    r.per.forEach((p, ci) => {
      const tt = ci === 0 ? 'A' : 'B';
      if (p.overview.chars > 205) { out++; console.log(`  T${r.n} ${tt} overview  ${p.overview.chars}ch  ${p.overview.lines}L  *** over 205`); }
      p.bullets.forEach((b, i) => {
        const inBand = b.chars <= 52 || (b.chars >= 73 && b.chars <= 88);
        if (!inBand) { out++; console.log(`  T${r.n} ${tt} bullet ${i + 1}  ${b.chars}ch  ${b.lines}L  fill ${(b.fill * 100).toFixed(0)}%  *** outside (53-72 dead zone or >88)`); }
      });
    });
  }
  console.log(`  ${out} zones outside the bands` + (out ? '' : ' — all clear'));

  console.log('\n=== LAST-LINE FILL, bullets + overviews only (resource bands reported, not judged) ===');
  for (const r of rows) {
    const s = r.per.map((p, ci) => `${ci === 0 ? 'A' : 'B'} ov ${(p.overview.fill * 100).toFixed(0)}% b[${p.bullets.map(b => (b.fill * 100).toFixed(0)).join(',')}] res ${(p.resource.fill * 100).toFixed(0)}%`).join('   ');
    console.log(`  T${r.n}  ${s}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
