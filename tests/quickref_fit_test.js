'use strict';
/**
 * Sheet 5's fit definitions (PR 5 Build B3).
 *
 * The browser-driven halves are covered by scripts/verify_quickref_fit.js's positive controls.
 * What is covered HERE is everything that can be asserted without a render — and in particular
 * the coverage of the CMS fit sweep, which is the reason fitSweep lives in an importable module
 * instead of in server.js where its predecessor could not be seen by any test.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const qr = require(path.join(ROOT, 'app/cms_quickref_preview.js'));
const QF = require(path.join(ROOT, 'scripts/lib/quickref_fit.js'));
const pdfLib = require(path.join(ROOT, 'scripts/lib/pdf_pages.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));

test('fitSweep covers all 27 type-and-instinct records for a static key, each exactly once', () => {
  const sweep = qr.fitSweep({ type: 9, instinct: 'SP' }, 'static.quickref_lead_v3');
  assert.strictEqual(sweep.length, 27);
  const codes = new Set(sweep.map((r) => r.code));
  assert.strictEqual(codes.size, 27, 'a duplicated record would inflate the "checked on N" count');
  for (let t = 1; t <= 9; t++) {
    for (const i of qr.INSTINCTS) assert.ok(codes.has(`${i}${t}`), `missing ${i}${t}`);
  }
});

test('fitSweep measures a subtype summary on its own record only — that is the whole population', () => {
  const sweep = qr.fitSweep({ type: 7, instinct: 'SO' }, 'subtype_so7');
  assert.deepStrictEqual(sweep, [{ type: 7, instinct: 'SO', code: 'SO7' }]);
});

test('the over-limit verdict states the limit and does NOT claim a page spill', () => {
  // Measured in Build B3: the page holds five summary lines and does not spill until six, so a
  // fourth line does not push anything onto a second sheet. render_client.js asserts cap + 1
  // still fits on every render, which is what keeps this true rather than merely true today.
  const v = qr.fitVerdict({ type: 4, code: 'SP4', natural: 1004.39, zoneLines: 5, zoneLineHeight: 18.75 },
    { cap: 3, surveyed: 1 });
  assert.strictEqual(v.ok, false);
  assert.match(v.message, /runs to 5 lines/);
  assert.match(v.message, /Three is the limit/);
  assert.doesNotMatch(v.message, /second sheet/, 'the spill claim was false by two lines');
});

test('a verdict over many records names how many were surveyed and which was tightest', () => {
  const v = qr.fitVerdict({ type: 1, code: 'SP1', natural: 1004.39, zoneLines: 2, zoneLineHeight: 18.75 },
    { surveyed: 27 });
  assert.match(v.message, /all 27 type and instinct combinations/);
  assert.match(v.message, /SP1 is tightest/);
});

test('vh = rampY + 32 holds on the shipped geometry, and moving one without the other is caught', () => {
  const geo = R.QUICKREF_GEO;
  const good = QF.assertGeoRelation(geo);
  assert.ok(good.ok, `vh ${good.vh} should equal rampY + 32 = ${good.expected}`);
  assert.ok(good.descender >= 11, 'the captions need 11px of descender room inside the viewBox');
  assert.ok(!QF.assertGeoRelation({ ...geo, rampY: geo.rampY + 10 }).ok);
  assert.ok(!QF.assertGeoRelation({ ...geo, vh: geo.vh - 4 }).ok);
});

test('judgeSheet treats an absent sheet 5 as a failure, never as a skip', () => {
  const msgs = QF.judgeSheet({ tag: 't', m: null, probeLines: null, bound: null, cap: 3 });
  assert.strictEqual(msgs.length, 1);
  assert.match(msgs[0], /never read "absent" as "fine"/);
});

test('judgeSheet bounds the summary in both directions', () => {
  const base = { summaryLines: 2, summaryText: 'x', summaryChars: 1, clearance: { ratio: 2, worst: {} } };
  const quiet = QF.judgeSheet({ tag: 't', m: base, probeLines: 2, bound: { bound: 4 }, cap: 3 });
  assert.deepStrictEqual(quiet, []);
  const over = QF.judgeSheet({ tag: 't', m: { ...base, summaryLines: 4 }, probeLines: 4, bound: { bound: 5 }, cap: 3 });
  assert.match(over.join(' '), /over the 3-line limit/);
  const empty = QF.judgeSheet({ tag: 't', m: { ...base, summaryLines: 0, summaryText: '' }, probeLines: 0, bound: { bound: 5 }, cap: 3 });
  assert.match(empty.join(' '), /the box is empty or missing/);
});

test('judgeAcross floors headroom at one rendered summary line, measured not hard-coded', () => {
  const row = (o) => ({ tag: 't', headroom: 60, code: 'SP1', lineHeight: 18.75, ...o });
  assert.deepStrictEqual(QF.judgeAcross({ rows: [row({})], expectedSummaries: 1 }), []);
  assert.match(QF.judgeAcross({ rows: [row({ headroom: 12 })], expectedSummaries: 1 }).join(' '), /under one/);
  // A floor whose basis could not be measured must fail, not quietly pass.
  assert.match(QF.judgeAcross({ rows: [row({ lineHeight: null })], expectedSummaries: 1 }).join(' '), /no basis/);
});

test('the PDF reader fails loudly on bytes it cannot parse, rather than reporting zero sheets', () => {
  // A reader that returns 0 makes the page-count gate pass everything, which is the one outcome
  // it must never have.
  assert.strictEqual(pdfLib.readPageCount(Buffer.from('not a pdf')).pages, 0);
  assert.match(pdfLib.checkPageCount(Buffer.from('not a pdf'), 1, 'x'), /would pass everything/);
});

test('the PDF reader counts page objects and cross-checks the page tree, failing on disagreement', () => {
  const ok = '%PDF-1.4\n<< /Type /Pages /Count 2 /Kids [3 0 R 4 0 R] >>\n'
           + '<< /Type /Page /Parent 2 0 R >>\n<< /Type /Page /Parent 2 0 R >>\n';
  const r = pdfLib.readPageCount(Buffer.from(ok, 'latin1'));
  assert.strictEqual(r.pages, 2);
  assert.strictEqual(r.count, 2);
  assert.strictEqual(pdfLib.checkPageCount(Buffer.from(ok, 'latin1'), 2, 'x'), null);
  assert.match(pdfLib.checkPageCount(Buffer.from(ok, 'latin1'), 1, 'x'), /has 2 sheets, expected 1/);
  const lying = ok.replace('/Count 2', '/Count 3');
  assert.match(pdfLib.checkPageCount(Buffer.from(lying, 'latin1'), 2, 'x'), /disagrees with itself/);
});
