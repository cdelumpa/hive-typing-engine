'use strict';
/**
 * p6 / p7 "Exploring Your Type Hypothesis" — PER-ZONE CHARACTER CEILINGS. AUDIT SCRATCH.
 *
 * Cai is drafting the 1/4/8 batch against Type 9's own character counts. A single shipped
 * example proves a floor, not a ceiling — one draft already ran 2x over before anyone noticed.
 * This measures the actual ceilings.
 *
 * METHOD — the one that has survived review on this project:
 *   - Measure inside the REAL rendered page (real renderer, real shared stylesheet, pinned
 *     Chromium, Arial asserted), never a synthetic harness.
 *   - Line counts from Range.getClientRects(), merged by top edge, so an inline <b> or a
 *     nowrap span inside a line does not read as an extra line.
 *   - Grow REAL PROSE word by word. Synthetic filler carries the wrong last-word length
 *     distribution and moves the wrap point.
 *
 * THE BUG THIS IS BUILT TO NOT REPEAT. The Wings fit probe stuffed text into a container that
 * sizes to its own content, which CHANGED the width it was trying to measure (280.66px
 * reported against a real 293px) and produced a band that was simply wrong. Every zone here
 * therefore carries three width readings — contentBox (non-mutating, authoritative), maxLine
 * (the widest line of the CURRENT shipped text, a lower bound), and a width RE-READ after
 * every mutation. If the re-read ever drifts from contentBox the zone is reported as
 * WIDTH-UNSTABLE and its ceilings are suppressed rather than printed.
 *
 *   node scripts/spike/explore_fit_probe.js
 *   node scripts/spike/explore_fit_probe.js --band    # inject the In Your Own Words band first
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const R = require(path.join(ROOT, 'app/renderer.js'));
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const bl = require(path.join(ROOT, 'app/browser_launch.js'));
const lineMetrics = require(path.join(ROOT, 'scripts/lib/line_metrics.js'));

const PAGE_PX = 1056;
const WITH_BAND = process.argv.includes('--band');
const OUT = path.join(ROOT, '.phase6_out');
fs.mkdirSync(OUT, { recursive: true });

const CLIENT = { full_name: 'Anders Wennerstrom', first_name: 'Anders', email: 'a@e.com', date: 'August 13, 2026' };
const coach = { full_name: 'Monique Breault', first_name: 'Mo', email: 'mo@hive.example' };

// Zones. `sheet` is the V3_PAGE_ORDER key; `sel` is resolved WITHIN that page.
// `inlineBold` marks a box whose text is `<b>label</b> body` — one box, two type weights.
const ZONES = [
  { sheet: 'typeA', key: 'core_motivation', sel: '.v3-ta-cm-narr',  label: 'Core Motivation' },
  { sheet: 'typeA', key: 'worldview',       sel: '.v3-ta-cm-col:nth-of-type(1) .v3-ta-cm-txt', label: 'Worldview' },
  { sheet: 'typeA', key: 'core_belief',     sel: '.v3-ta-cm-col:nth-of-type(2) .v3-ta-cm-txt', label: 'Core Belief' },
  { sheet: 'typeA', key: 'glance_label',    sel: '.v3-ta-glbl',     label: 'At A Glance — label' },
  { sheet: 'typeA', key: 'glance_value',    sel: '.v3-ta-gval',     label: 'At A Glance — value' },
  { sheet: 'typeA', key: 'pattern_body',    sel: '.v3-ta-pat-body', label: 'Typical Patterns body' },
  { sheet: 'typeB', key: 'item_txt',        sel: '.v3-tb-item-txt', label: 'Strengths/Challenges item', inlineBold: true },
  { sheet: 'typeB', key: 'style_name',      sel: '.v3-tb-style-name', label: 'Chicklet name' },
  { sheet: 'typeB', key: 'style_bullet',    sel: '.v3-tb-s-txt',    label: 'Chicklet bullet' },
  { sheet: 'typeB', key: 'practice',        sel: '.v3-tb-pr-txt',   label: 'Practice bullet' },
];

/** Real prose corpus: Type 9's shipped explore content first, then the wider library. */
function corpus() {
  const lib = require(path.join(ROOT, 'app/content/content_library.json'));
  const out = [];
  const walk = (o) => {
    if (typeof o === 'string') { if (o.length > 25) out.push(o); }
    else if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  };
  walk(lib.type_9.explore_v3);   // the shipped p6/p7 prose — the closest shape to what is being drafted
  walk(lib);
  const words = out.join(' ').replace(/\s+/g, ' ').split(' ').filter(w => /[a-z]/i.test(w));
  return words;
}

function probe(payload) {
  const { zones, WORDS, bandSpec } = payload;

  // Both helpers now come from scripts/lib/line_metrics.js, injected before this runs, so the
  // gate in render_client.js and this probe share one definition of "how many lines is this".
  // lineRects there returns {top, width} objects; this probe wants widths, hence the map.
  const lineRects = (n) => window.__lineMetrics.lineRects(n).map(r => r.width);
  const contentBox = (n) => window.__lineMetrics.contentBox(n);
  const naturalOf = (el) => {
    const prev = el.style.minHeight; el.style.minHeight = '0px';
    const h = el.getBoundingClientRect().height; el.style.minHeight = prev;
    return +h.toFixed(2);
  };

  const pages = [...document.querySelectorAll('.v3-page')];
  const pageOf = {};
  for (const [k, i] of Object.entries(payload.pageIndex)) pageOf[k] = pages[i];

  // Optional: inject the In Your Own Words band before measuring anything.
  if (bandSpec) {
    const cm = pageOf.typeA.querySelector('.v3-ta-cm');
    const band = document.createElement('div');
    band.style.cssText = 'background:#F5F5EE;border-top:1px solid #E8ECF0;padding:13px 20px;';
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;font-weight:bold;color:#6B7785;text-transform:uppercase;letter-spacing:.1em;margin-bottom:9px;';
    lbl.textContent = 'In Your Own Words';
    const q = document.createElement('div');
    q.style.cssText = 'font-size:12.5px;color:#1E2A35;line-height:1.55;font-style:italic;';
    q.textContent = bandSpec.text;
    band.appendChild(lbl); band.appendChild(q); cm.appendChild(band);
  }

  const headroom = { typeA: +(1056 - naturalOf(pageOf.typeA)).toFixed(2),
                     typeB: +(1056 - naturalOf(pageOf.typeB)).toFixed(2) };

  const results = [];
  for (const z of zones) {
    const page = pageOf[z.sheet];
    const all = [...page.querySelectorAll(z.sel)];
    const node = all[0];
    if (!node) { results.push({ ...z, error: 'selector matched nothing' }); continue; }
    // Every instance's shipped length, not just the first: the widest shipped string is what
    // has to clear the ceiling, and these zones repeat 3-9 times per page.
    const instances = all.map(el => ({
      chars: el.textContent.replace(/\s+/g, ' ').trim().length,
      lines: lineRects(el).length,
    }));

    const box0 = contentBox(node);
    const shipped = node.textContent.replace(/\s+/g, ' ').trim();
    const shippedLines = lineRects(node).length;
    const maxLine = Math.max(...lineRects(node), 0);
    const cs = getComputedStyle(node);
    const lineHeight = +parseFloat(cs.lineHeight).toFixed(2);
    const font = `${parseFloat(cs.fontSize)}/${cs.fontWeight}`;

    const original = node.innerHTML;
    let unstable = null;

    // For an inline-bold box, hold a representative label and grow only the BODY, then a
    // second pass growing only the LABEL. They share one box, so neither has an independent
    // ceiling — what each pass yields is the ceiling for that part GIVEN the other.
    const boldLabel = z.inlineBold ? (node.querySelector('b') || {}).textContent || '' : null;

    const setText = (s) => {
      if (z.inlineBold) node.innerHTML = `<b>${boldLabel}</b> ${s}`;
      else node.textContent = s;
    };
    const setLabel = (s) => { node.innerHTML = `<b>${s}</b> ${bodyOnly}`; };
    const bodyOnly = z.inlineBold ? shipped.slice(boldLabel.length).trim() : '';

    // Grow word by word, recording the last length that still fit each line count.
    //
    // WIDTH GUARD, corrected. Several of these zones are flex children with the default
    // `flex: 0 1 auto`, so their base size is max-content: a two-character string genuinely
    // occupies a 13px box, and the box only reaches its constrained width once the text is
    // long enough to need it. Demanding a CONSTANT width therefore rejects a perfectly sound
    // measurement. What must hold instead is CONVERGENCE — the box grows to a ceiling and
    // then stays there for every longer string. That ceiling is the real available width, and
    // it is what the wrap algorithm has been working against for every multi-line reading.
    // A box that keeps moving after it has started wrapping is the actual Wings bug, and that
    // still suppresses the zone.
    // MANY SAMPLES PER LENGTH, not one growth sequence.
    //
    // A single growing string samples ONE wrap path. Validated against shipped content it
    // fails immediately: Type 9 has a 173-char Patterns body rendering 5 lines against a
    // single-sequence "5-line ceiling" of 161, and a 91-char Strengths item on 2 lines
    // against a 2-line ceiling of 89. Neither is a contradiction — they are different word
    // sequences wrapping differently, which is the whole reason character bands are fuzzy.
    //
    // So: for each target length, take many DISTINCT real-prose substrings cut at word
    // boundaries, and report two numbers per line count —
    //   safe      the largest length at which EVERY sample still fits (author against this)
    //   observed  the largest length at which ANY sample fits (what a lucky string can reach)
    // Shipped content should sit at or below `observed`, and ideally at or below `safe`.
    const SAMPLES = 24;
    const byLen = new Map();          // length -> array of line counts
    let boxSeen = 0;                  // widest content box observed while wrapping real prose
    for (let start = 0; start < SAMPLES; start++) {
      const off = Math.floor((WORDS.length / SAMPLES) * start);
      let acc = '';
      for (let i = 0; i < 400; i++) {
        const w = WORDS[(off + i) % WORDS.length];
        acc = acc ? `${acc} ${w}` : w;
        if (acc.length > 420) break;
        setText(acc);
        const rendered = z.inlineBold ? `${boldLabel} ${acc}`.length : acc.length;
        const L = lineRects(node).length;
        boxSeen = Math.max(boxSeen, contentBox(node));
        if (!byLen.has(rendered)) byLen.set(rendered, []);
        byLen.get(rendered).push(L);
        if (L >= 8) break;
      }
    }

    // WIDTH: the widest content box observed while wrapping REAL prose. Not a stuffed string
    // of unbroken characters — that has no break opportunity, so it overflows the box and
    // reports the overflowing text width rather than the box (measured: 2500-3003px against
    // real widths of 179-423px). That is the original Wings bug, and re-introducing it here
    // while editing this very file is the reason the width column is cross-checked below.
    const wMax = boxSeen;
    const ceilings = {}, observedC = {};
    for (const [len, lines] of [...byLen.entries()].sort((a, b) => a[0] - b[0])) {
      const worst = Math.max(...lines), best = Math.min(...lines);
      ceilings[worst] = Math.max(ceilings[worst] || 0, 0);         // ensure key exists
      // safe: every sample fits in `worst` lines -> length qualifies for `worst`
      ceilings[worst] = Math.max(ceilings[worst] || 0, len);
      observedC[best] = Math.max(observedC[best] || 0, len);
    }
    // `safe[L]` must be monotonic: the largest length where NO sample exceeded L.
    const safe = {};
    for (let L = 1; L <= 8; L++) {
      let best = 0;
      for (const [len, lines] of byLen.entries()) if (Math.max(...lines) <= L) best = Math.max(best, len);
      if (best) safe[L] = best;
    }
    const observed = {};
    for (let L = 1; L <= 8; L++) {
      let best = 0;
      for (const [len, lines] of byLen.entries()) if (Math.min(...lines) <= L) best = Math.max(best, len);
      if (best) observed[L] = best;
    }

    let labelCeilings = null;
    if (z.inlineBold && !unstable) {
      labelCeilings = {};
      let ls = '';
      for (let i = 0; i < WORDS.length; i++) {
        ls = ls ? `${ls} ${WORDS[i]}` : WORDS[i];
        if (ls.length > 200) break;
        setLabel(ls);
        const L = lineRects(node).length;
        labelCeilings[L] = Math.max(labelCeilings[L] || 0, ls.length);
      }
    }

    node.innerHTML = original;
    const boxAfter = contentBox(node);

    // Independent cross-check on the width: for a flex row (dot + text), the text's available
    // width must equal the row's content box minus the dot and its margins. Two derivations
    // agreeing is what makes the number trustworthy rather than merely repeatable.
    let derivedAvail = null;
    const row = node.parentElement;
    const rcs0 = row ? getComputedStyle(row) : null;
    if (row && rcs0.display === 'flex' && !/column/.test(rcs0.flexDirection)) {
      const rcs = rcs0;
      const rowBox = row.clientWidth - parseFloat(rcs.paddingLeft) - parseFloat(rcs.paddingRight);
      let others = 0;
      for (const sib of row.children) {
        if (sib === node) continue;
        const scs = getComputedStyle(sib);
        others += sib.getBoundingClientRect().width + parseFloat(scs.marginLeft) + parseFloat(scs.marginRight);
      }
      // `gap` is not margin and does not appear on any child box — count it explicitly or
      // the derivation lands one gap-width per sibling too high.
      const gap = parseFloat(rcs.columnGap) || 0;
      derivedAvail = +(rowBox - others - gap * (row.children.length - 1)).toFixed(2);
    }

    results.push({
      ...z, font, lineHeight,
      contentBox: box0, contentBoxAfterRestore: boxAfter, availWidth: wMax, derivedAvail,
      maxLineShipped: +maxLine.toFixed(2),
      shippedChars: shipped.length, shippedLines, instances, n: all.length,
      safe, observed, labelCeilings, unstable,
    });
  }
  return { headroom, results };
}

(async () => {
  const fx = require(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json'));
  const model = await prep.buildClientModel({ apiResult: fx, client: CLIENT, coach });
  const html = R.buildClientReportHTML_v3(model);
  const order = R.v3PagesFor(9);
  const pageIndex = { typeA: order.findIndex(p => p.key === 'typeA'), typeB: order.findIndex(p => p.key === 'typeB') };

  const WORDS = corpus();
  const BAND_TEXT = '"I usually notice what everyone else in the room needs long before I notice what I '
    + 'need myself, and I can hold several different points of view at once without feeling any push to '
    + 'pick one of them. Working out what I actually think takes longer."';

  const browser = await bl.launchBrowser();
  let out;
  try {
    const p = await browser.newPage();
    await p.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });
    await p.setContent(html, { waitUntil: 'networkidle0' });
    await p.emulateMediaType('print');
    await bl.assertReportFont(p);
    await p.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
    await new Promise(r => setTimeout(r, 150));
    await lineMetrics.install(p);
    out = await p.evaluate(probe, { zones: ZONES, WORDS, pageIndex, bandSpec: WITH_BAND ? { text: BAND_TEXT } : null });
    await p.close();
  } finally { await browser.close(); }

  const cond = WITH_BAND ? 'WITH the In Your Own Words band' : 'WITHOUT the band (today\'s shipped state)';
  console.log(`\np6 / p7 ZONE CEILINGS — ${cond}`);
  console.log(`page headroom: sheet 6 ${out.headroom.typeA}px · sheet 7 ${out.headroom.typeB}px\n`);
  console.log('zone                          font    lh     width   shipped        ceilings (max chars per line count)');
  for (const r of out.results) {
    if (r.error) { console.log(`  ${r.label.padEnd(28)} ${r.error}`); continue; }
    if (r.unstable) {
      console.log(`  ${r.label.padEnd(28)} *** WIDTH-UNSTABLE (${r.unstable.note}) max=${r.unstable.wMax} — ${r.unstable.examples.join(', ')} — ceilings suppressed`);
      continue;
    }
    const c = Object.keys(r.safe).map(Number).sort((a, b) => a - b).filter(L => L <= 6)
      .map(L => `${L}L:${r.safe[L]}/${r.observed[L]}`).join('  ');
    console.log(`  ${r.label.padEnd(28)} ${r.font.padEnd(8)}${String(r.lineHeight).padStart(5)}  `
      + `${String(r.availWidth).padStart(6)}${(r.derivedAvail != null && Math.abs(r.derivedAvail - r.availWidth) > 0.5 ? '!' : ' ')} ${String(r.shippedChars).padStart(4)}ch/${r.shippedLines}L  ${c}`);
    if (r.labelCeilings) {
      const lc = Object.keys(r.labelCeilings).map(Number).sort((a, b) => a - b)
        .map(L => `${L}L≤${r.labelCeilings[L]}`).join('  ');
      console.log(`  ${''.padEnd(28)} bold label, body held fixed:                  ${lc}`);
    }
  }

  const bad = out.results.filter(r => !r.error && !r.unstable && Math.abs(r.contentBox - r.contentBoxAfterRestore) > 0.5);
  console.log(`\nwidth stable across mutation: ${out.results.filter(r => !r.unstable && !r.error).length}/${out.results.length} zones`
    + (bad.length ? `  *** ${bad.length} did not restore` : ''));

  fs.writeFileSync(path.join(OUT, `explore_fit_probe${WITH_BAND ? '_band' : ''}.json`), JSON.stringify(out, null, 2));
  console.log(`wrote .phase6_out/explore_fit_probe${WITH_BAND ? '_band' : ''}.json`);
})().catch(e => { console.error('PROBE FAILED:', e.stack || e.message); process.exit(1); });
