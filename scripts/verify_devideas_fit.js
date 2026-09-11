'use strict';
/**
 * verify_devideas_fit.js — the positive controls for sheet 11's checks (PR 6 Build B1).
 *
 * D1-D4 run inside scripts/render_client.js over every v3 render, and they are green. Green is also
 * what a check that has silently stopped working looks like, so every one of them is driven here
 * against a DELIBERATELY BROKEN real sheet 11 and required to fail. A gate never observed red is not
 * a gate — the standard sheet 5's fit assertions were held to in scripts/verify_quickref_fit.js.
 *
 * The controls call the SAME judges render_client.js calls, from app/devideas_fit.js, over the same
 * in-page probe. Where a control needs a broken page it breaks a real rendered page — through the
 * model where the defect is content, through the DOM where it is layout — and re-measures.
 *
 * Build B2's publish gate will add its own controls here, through the real gate.
 */

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
const DF = require(path.join(ROOT, 'app/devideas_fit.js'));
const pdfLib = require(path.join(ROOT, 'scripts/lib/pdf_pages.js'));
const shellProbe = require(path.join(ROOT, 'scripts/lib/page_shell_probe.js'));
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));
const LIBC = require(path.join(ROOT, 'app/content/content_library.json'));
const { retypeFixture } = require(path.join(ROOT, 'scripts/lib/retype_fixture.js'));

const EXPECTED = {
  titles: LIBC.static.devideas_titles_v3, rails: LIBC.static.devideas_rails_v3,
  lead: LIBC.static.devideas_lead_v3, coda: LIBC.static.devideas_coda_v3,
};
const CLIENT = { first_name: 'Control', last_name: 'Sample', date: 'June 2026' };
const ONE_LINE = 'Notice what you want before you agree to what others want';

let failed = false;
const results = [];
/** A control PASSES when the check it drives behaves as expected — RED where it must catch a defect. */
function control(name, messages, expect) {
  const red = messages.length > 0;
  const ok = red === expect;
  if (!ok) failed = true;
  results.push({ name, ok, red, expect, first: messages[0] || null });
}

/** A real model for `type`, re-typed the way every render_client.js render is. */
async function modelFor(type, client = CLIENT) {
  const fixture = require(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json'));
  return prep.buildClientModel({ apiResult: retypeFixture(fixture, type), client,
    coach: { full_name: '', type: null, instinct: null } });
}
async function show(page, m) {
  await page.setContent(R.buildClientReportHTML_v3(m), { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
}
const probe = (page) => page.evaluate(DF.PROBE, DF.SHEET_SEL);
const onSheet11 = (page, fn) => page.evaluate(`(${fn})(document.querySelector(${JSON.stringify(DF.SHEET_SEL)}))`);
const all = (tag, p, type, extra = {}) => [
  ...DF.judgeD1({ tag, probe: p, ...extra }), ...DF.judgeD2({ tag, probe: p }),
  ...DF.judgeD3({ tag, probe: p }), ...DF.judgeD4({ tag, probe: p, expected: EXPECTED, type }),
];

(async () => {
  const browser = await browserLaunch.launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: DF.PAGE_PX, deviceScaleFactor: 1 });
    await page.setContent('<p>font</p>');
    await browserLaunch.assertReportFont(page);

    // ── THE NEGATIVE CONTROLS FIRST ─────────────────────────────────────────────────────────
    // An untouched sheet 11 must be SILENT on every type. Without this, a judge that fails on
    // everything would satisfy every red control below.
    const clean = [];
    for (let t = 1; t <= 9; t++) { await show(page, await modelFor(t)); clean.push(...all(`clean/t${t}`, await probe(page), t)); }
    control('negative — an untouched sheet 11 is silent on all four checks, all nine types', clean, false);
    await show(page, await modelFor(9, { ...DF.LONG_NAME, date: 'June 2026' }));
    control('negative — the long-name fixture really wraps the header, and still fits', all('clean/long', await probe(page), 9, { longName: true }), false);

    // ── D1: a spill, the PDF that proves it, model drift, and an unexercised reserve ────────
    const m9 = await modelFor(9);
    m9.pages.v3_devideas.sections[0].items.push(...Array(5).fill(ONE_LINE));
    await show(page, m9);
    const spillP = await probe(page);
    control(`D1 — Type 9 with five more Growth lines spills (${spillP.natural}px) and is caught`,
      DF.judgeD1({ tag: 'd1/spill', probe: spillP }).filter((x) => /spills/.test(x)), true);
    const logical = R.v3PagesFor(9).length;
    const spilled = await page.pdf(R.buildCoachPdfOptions());
    control(`D1 — the spilled document's PDF reads back as more than its ${logical} pages (${pdfLib.readPageCount(spilled).pages})`,
      pdfLib.checkPageCount(spilled, logical, 'd1/pdf') ? ['red'] : [], true);
    await show(page, await modelFor(9));
    control(`D1 — the unspilled document's PDF reads back as exactly ${logical} pages`,
      pdfLib.checkPageCount(await page.pdf(R.buildCoachPdfOptions()), logical, 'd1/pdf-whole') ? ['red'] : [], false);

    await show(page, await modelFor(9));
    await onSheet11(page, (el) => { el.querySelector('.v3-di-card[data-di="inquiries"] .v3-di-body').style.paddingTop = '20px'; });
    const drift = await probe(page);
    control('D1 — a 4px spacing change the model does not know about is caught as drift, though the page still fits',
      DF.judgeD1({ tag: 'd1/drift', probe: drift }).filter((x) => /model no longer describes/.test(x) && !/spills/.test(x)), true);

    await show(page, await modelFor(9));
    control('D1 — a long-name pass whose header stayed on one line is caught, not counted',
      DF.judgeD1({ tag: 'd1/long', probe: await probe(page), longName: true }).filter((x) => /not exercised/.test(x)), true);

    // ── D2: an unstretched rail, a missing card, text past its column ───────────────────────
    await show(page, await modelFor(9));
    await onSheet11(page, (el) => { el.querySelector('.v3-di-card[data-di="experiments"]').style.alignItems = 'flex-start'; });
    control('D2 — a rail that stops short of its card is caught',
      DF.judgeD2({ tag: 'd2/stretch', probe: await probe(page) }).filter((x) => /full height/.test(x)), true);

    await show(page, await modelFor(9));
    await onSheet11(page, (el) => { el.querySelector('.v3-di-card[data-di="inquiries"]').remove(); });
    control('D2 — a missing card is caught',
      DF.judgeD2({ tag: 'd2/missing', probe: await probe(page) }).filter((x) => /want \[growth,inquiries,experiments\]/.test(x)), true);

    const m3 = await modelFor(3);
    m3.pages.v3_devideas.sections[0].items.push('See www.hiveleadership.com/the-enneagram/development-ideas/growth-strategies-for-performers');
    await show(page, m3);
    const wideP = await probe(page);
    control('D2 — an unbreakable URL running past its column is caught (every height check passes it)',
      DF.judgeD2({ tag: 'd2/sideways', probe: wideP }).filter((x) => /past its column/.test(x)), true);
    control('D2 — …and D1 alone does not see it: the page still fits', DF.judgeD1({ tag: 'd2/sideways-d1', probe: wideP }).filter((x) => /spills/.test(x)), false);

    // ── D3: the label-plus-body shape ───────────────────────────────────────────────────────
    await show(page, await modelFor(9));
    await onSheet11(page, (el) => {
      const b = el.querySelector('.v3-di-card[data-di="experiments"] .v3-di-txt b');
      const s = document.createElement('span'); s.textContent = b.textContent; b.replaceWith(s);
    });
    control('D3 — an experiment whose label lost its bold is caught',
      DF.judgeD3({ tag: 'd3/bold', probe: await probe(page) }).filter((x) => /bold label/.test(x)), true);

    await show(page, await modelFor(9));
    await onSheet11(page, (el) => { const b = el.querySelector('.v3-di-card[data-di="experiments"] .v3-di-txt b'); b.textContent = b.textContent.replace(/:$/, ''); });
    control('D3 — a bold label without its colon is caught',
      DF.judgeD3({ tag: 'd3/colon', probe: await probe(page) }).filter((x) => /colon/.test(x)), true);

    await show(page, await modelFor(9));
    await onSheet11(page, (el) => { const t = el.querySelector('.v3-di-card[data-di="growth"] .v3-di-txt'); t.innerHTML = `<b>${t.innerHTML}</b>`; });
    control('D3 — bold leaking into Growth Strategies is caught',
      DF.judgeD3({ tag: 'd3/stray', probe: await probe(page) }).filter((x) => /only Field Experiments/.test(x)), true);

    // ── D4: a rail description that varies by type, and a wrong H1 ──────────────────────────
    const m4 = await modelFor(4);
    m4.pages.v3_devideas.sections[1].desc = 'Journal on these, Individualists.';
    await show(page, m4);
    const railP = await probe(page);
    control('D4 — a rail description that is not the library\'s is caught on the page',
      DF.judgeD4({ tag: 'd4/rail', probe: railP, expected: EXPECTED, type: 4 }).filter((x) => /rail description/.test(x)), true);
    await show(page, await modelFor(9));
    const nineP = await probe(page);
    control('D4 — …and across renders, two forms of the shared strings are caught',
      DF.judgeAcross({ rows: [{ shared: DF.sharedOf(nineP) }, { shared: DF.sharedOf(railP) }] }), true);

    await show(page, await modelFor(8));
    await onSheet11(page, (el) => { el.querySelector('h1').textContent = 'Development Ideas for Challengers'; });
    control('D4 — a pre-canon plural in the H1 is caught',
      DF.judgeD4({ tag: 'd4/h1', probe: await probe(page), expected: EXPECTED, type: 8 }).filter((x) => /want "Development Ideas for Protectors"/.test(x)), true);

    // ── THE SHELL: sheet 11 frozen to a fixed height ─────────────────────────────────────────
    // The shared shell probe catches it, and so does D1's model: a frozen page reports 1056px
    // however little it holds, which the model cannot reproduce.
    await show(page, await modelFor(6));
    await onSheet11(page, (el) => { el.style.height = '1056px'; el.style.overflow = 'hidden'; });
    control('SHELL — a sheet 11 frozen to a fixed height is caught by the shell probe',
      shellProbe.judgePageShell({ tag: 'shell/frozen', rows: await shellProbe.probePageShell(page, 40), spacerPx: 40 }), true);
    control('SHELL — …and by D1, whose model cannot reproduce a frozen page',
      DF.judgeD1({ tag: 'shell/frozen-d1', probe: await probe(page) }).filter((x) => /model no longer describes/.test(x)), true);

    await page.close();
  } finally { await browser.close(); }

  // ── THE PUBLISH GATE (PR 6 Build B2), through the real gate and the real renderer ────────────
  //
  // app/cms_devideas.js, unmodified, with the real report_prep, renderer, font check and browser.
  // Only the published set is supplied, since CI has no database. Every case is BUILT FROM THE ROOM
  // THE PAGE ACTUALLY HAS, not from pixels written here, so the uniformity pass can change the content
  // without breaking these controls; a construction the content no longer permits is reported as a
  // PRECONDITION failure, never mistaken for the gate's.
  const GATE = require(path.join(ROOT, 'app/cms_devideas.js'));
  const real = GATE.defaultDeps();
  const withLive = (live, extra = {}) => ({ ...real, loadPublishedStrict: async () => live, ...extra });
  const T9 = LIBC.type_9.devideas_v3;
  const ITEM = DF.MODEL.line + DF.MODEL.itemGap;   // a one-line item: 18.75 + 6
  const LEAD = LIBC.static.devideas_lead_v3;
  const SENTENCE = ' Pick one idea from any section and start there; you can come back for the others later.';
  const grow = (n) => { const d = structuredClone(T9); d.growth.push(...Array(n).fill(ONE_LINE)); return d; };
  const precondition = (name, ok, why) => { if (!ok) control(`PRECONDITION — ${name}: ${why}`, ['the content no longer permits this construction'], false); return ok; };
  const tightest = (v) => v.worst && v.worst.probe.natural;

  const base = await GATE.evaluate('publish', 'type_9.devideas_v3', T9, new Map(), real);
  control(`GATE — Type 9 unchanged is allowed (${tightest(base)}px)`, base.ok ? [] : [base.message], false);
  const room = DF.PAGE_PX - tightest(base);
  const fitN = Math.floor(room / ITEM);
  const fits = await GATE.evaluate('publish', 'type_9.devideas_v3', grow(fitN), new Map(), real);
  control(`GATE — Type 9 + ${fitN} one-line items, the most that fits, is allowed (${tightest(fits)}px)`, fits.ok ? [] : [fits.message], false);
  const over = await GATE.evaluate('publish', 'type_9.devideas_v3', grow(fitN + 1), new Map(), real);
  control(`GATE — Type 9 + ${fitN + 1} one-line items is refused (${tightest(over)}px): "${(over.message || '').slice(0, 60)}…"`,
    !over.ok && /onto a second sheet/.test(over.message) ? ['refused'] : [], true);

  const url = structuredClone(LIBC.type_3.devideas_v3);
  url.growth.push('See www.hiveleadership.com/the-enneagram/development-ideas/growth-strategies-for-performers');
  const wide = await GATE.evaluate('publish', 'type_3.devideas_v3', url, new Map(), real);
  control('GATE — an unbreakable URL past its column is refused', !wide.ok && /past the edge of its column/.test(wide.message) ? ['refused'] : [], true);

  // THE COMBINATION: Type 9 filled to within one item of the sheet, and a lead two lines longer. Each
  // is allowed alone; together they must be refused.
  const lead2 = LEAD + SENTENCE + SENTENCE;
  const leadAlone = await GATE.evaluate('publish', 'static.devideas_lead_v3', lead2, new Map(), real);
  if (precondition('the combination', leadAlone.ok && fits.ok, 'the lead edit or the Type 9 edit no longer fits alone')) {
    control(`GATE — a lead two lines longer is allowed alone, across all nine (${tightest(leadAlone)}px on Type ${leadAlone.worst.type})`, [], false);
    const both = await GATE.evaluate('publish', 'static.devideas_lead_v3', lead2, new Map([['type_9.devideas_v3', grow(fitN)]]), real);
    control(`GATE — THE COMBINATION: that lead, once Type 9 + ${fitN} is live, is refused (${tightest(both)}px)`,
      !both.ok && /Type 9 would run/.test(both.message) ? ['refused'] : [], true);
  }

  // SAVE DRAFT AND REVERT: a shortened Type 9 is live, and a lead grown until it fits ONLY because of
  // that. Taking the Type 9 edit away — by draft save or revert — must then be refused.
  const shortT9 = structuredClone(T9); shortT9.growth = shortT9.growth.slice(0, 1);
  let bigLead = null;
  for (let k = 1, lead = LEAD; k <= 10 && !bigLead; k++) {
    lead += SENTENCE;
    const withShort = await GATE.evaluate('publish', 'static.devideas_lead_v3', lead, new Map([['type_9.devideas_v3', shortT9]]), real);
    const withLib = await GATE.evaluate('publish', 'static.devideas_lead_v3', lead, new Map(), real);
    if (withShort.ok && !withLib.ok) bigLead = lead;
  }
  if (precondition('draft and revert', !!bigLead, 'no lead length fits with the shortened Type 9 but not the library one')) {
    const live = new Map([['type_9.devideas_v3', shortT9], ['static.devideas_lead_v3', bigLead]]);
    for (const action of ['draft', 'revert']) {
      let wrote = false;
      const r = await GATE.guardedWrite(action, 'type_9.devideas_v3', shortT9, async () => { wrote = true; return true; }, withLive(live));
      control(`GATE — ${action} of the live Type 9 edit is refused and nothing is written: "${(r.error || '').slice(0, 50)}…"`,
        !r.ok && !wrote ? ['refused'] : [], true);
    }
    let wroteLead = false;
    const rl = await GATE.guardedWrite('revert', 'static.devideas_lead_v3', undefined, async () => { wroteLead = true; return true; }, withLive(live));
    control('GATE — reverting the lead instead is allowed, and written once', rl.ok && wroteLead ? [] : [rl.error || 'not written'], false);
  }

  let launches = 0;
  const counted = withLive(new Map(), { launchBrowser: async () => { launches++; return real.launchBrowser(); } });
  const notLive = await GATE.guardedWrite('draft', 'type_3.devideas_v3', LIBC.type_3.devideas_v3, async () => true, counted);
  control('GATE — a draft save of a key that is not live is allowed without rendering', notLive.ok && launches === 0 ? [] : [`launched ${launches}`], false);

  const bad = (mutate) => { const d = structuredClone(LIBC.type_4.devideas_v3); mutate(d); return d; };
  for (const [name, value, pattern] of [
    ['a half-blank experiment', bad((d) => { d.experiments[1].body = ''; }), /label but no body/],
    ['a colon in a label', bad((d) => { d.experiments[0].label = 'Gratitude: Journal'; }), /contains a colon/],
    ['an emptied list', bad((d) => { d.inquiries = d.inquiries.map(() => ''); }), /would be empty/],
    ['an extra key on an experiment', bad((d) => { d.experiments[0].note = 'x'; }), /doesn't match the shape/],
  ]) {
    const r = await GATE.evaluate('publish', 'type_4.devideas_v3', value, new Map(), real);
    control(`GATE — ${name} is refused, in its own words`, !r.ok && pattern.test(r.message) ? ['refused'] : [], true);
  }

  let wroteOnFailure = false;
  const unread = await GATE.guardedWrite('publish', 'type_9.devideas_v3', T9, async () => { wroteOnFailure = true; return true; },
    { ...real, loadPublishedStrict: async () => { throw new Error('the content database could not be read'); } });
  control('GATE — a failed read of the live content refuses and writes nothing', !unread.ok && !wroteOnFailure ? ['refused'] : [], true);
  const noBrowser = await GATE.guardedWrite('publish', 'type_9.devideas_v3', T9, async () => { wroteOnFailure = true; return true; },
    withLive(new Map(), { launchBrowser: async () => { throw new Error('Chromium could not start'); } }));
  control('GATE — a browser that cannot start refuses and writes nothing', !noBrowser.ok && !wroteOnFailure ? ['refused'] : [], true);

  const width = Math.max(...results.map((r) => r.name.length));
  console.log('\nDEVELOPMENT IDEAS (SHEET 11) — POSITIVE CONTROLS\n');
  for (const r of results) {
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.expect ? 'expected RED' : 'expected quiet'} · got ${r.red ? 'RED' : 'quiet'}`);
    if (!r.ok && r.first) console.log(`        first message: ${r.first}`);
  }
  console.log(`\n  ${results.filter((r) => r.ok).length}/${results.length} controls behaved as required`);
  if (failed) { console.log('\nDEVELOPMENT IDEAS CONTROLS: FAILURES ABOVE.'); process.exit(1); }
  console.log('\nDEVELOPMENT IDEAS CONTROLS: ALL PASSED.');
})().catch((e) => { console.error('CONTROLS FAILED:', e.stack || e.message); process.exit(1); });
