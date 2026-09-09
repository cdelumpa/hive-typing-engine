'use strict';
/**
 * Sheet 5's CMS preview — P1 and P3, asserted. PR 5 Build B4.
 *
 * WHAT THIS CAN AND CANNOT REACH, said first because it decides the shape. app/server.js exports
 * nothing and calls app.listen() at require time, so this file CANNOT load it — the CMS key
 * surface that lives there is untestable, which is carded for PR 7. What it can load is
 * app/cms_quickref_preview.js, where this build's new entries were deliberately born.
 *
 * So the two halves are tested differently, and the difference is stated rather than papered over:
 *
 *   P3 (the preview is the client's page) is tested DIRECTLY. The apply functions are the one
 *   place a preview diverges from the real render — cmsRenderPreviewPng already uses
 *   buildClientModel and buildClientReportHTML_v3 — and they are all in the module, so each one
 *   is applied to a real model, rendered by the real builder, and required to put its sentinel on
 *   the page. An apply writing a field the builder does not read shows an editor the OLD text
 *   with no error, and this is what catches that.
 *
 *   P1 (every editable key is previewable) is tested by READING server.js AS TEXT. That is not
 *   how anyone would want to assert it, and it is only worth having because the alternative is
 *   asserting nothing: CMS_STATIC_FIELDS and cmsPreviewSpec are independent lists that happen to
 *   coincide, with nothing keeping them in step. A text scan catches a key added to one and not
 *   the other, which is the actual failure. It cannot catch a malformed entry — the sentinel
 *   tests above do that for sheet 5's six.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const qr = require(path.join(ROOT, 'app/cms_quickref_preview.js'));
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));

/** The preview fixture, mirroring cmsPreviewApiResult (server.js) — nine ranking entries. */
function stub(N, instinct) {
  const alt = N === 9 ? 1 : N + 1;
  const others = ['SP', 'SO', 'SX'].filter((x) => x !== instinct);
  const prof = {}; prof[instinct] = 80; prof[others[0]] = 55; prof[others[1]] = 30;
  return {
    hypothesis: {
      confirmed_type: N, alternate_candidate: alt, dominant_instinct_hypothesis: instinct,
      confidence_level: 'HIGH', stage4_outcome: 'CONFIRM',
      call1_ranking: [{ type: N, score: 85 }, { type: alt, score: 60 }].concat(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((t) => t !== N && t !== alt)
          .map((t, i) => ({ type: t, score: 52 - i * 4 }))),
      instinct_score_profile: prof,
    },
  };
}
const model = () => prep.buildClientModel({
  apiResult: stub(9, 'SX'),
  client: { first_name: 'Preview', last_name: 'Sample', date: 'June 2026' },
  coach: { full_name: '', type: null, instinct: null },
});
/**
 * Sheet 5's markup only, so a sentinel cannot be satisfied by some other page.
 *
 * MATCHES THE ATTRIBUTE, NOT THE BARE TOKEN. A first version searched for `v3-qr-two` and found
 * it in the <style> block — the class name appears in the stylesheet and in a CSS comment before
 * it ever appears in markup — which sliced garbage and failed every sentinel at once. Three
 * applies failing identically was the tell: the helper was wrong, not the code under test.
 */
function sheet5(html) {
  const i = html.indexOf('class="v3-page">');
  const j = html.indexOf('class="v3-qr-two"');
  assert.ok(j > -1, 'sheet 5 not present in the rendered document');
  const start = html.lastIndexOf('<div class="v3-page">', j);
  assert.ok(start > -1 && start < j, 'could not locate sheet 5\'s page element');
  const nextPage = html.indexOf('<div class="v3-page"', j);
  return html.slice(start, nextPage > -1 ? nextPage : html.length);
}

// Each entry: the sentinel VALUE an editor might type, in the shape that key carries.
const SENTINELS = {
  'static.quickref_lead_v3':         'ZZSENTINELLEADZZ',
  'static.quickref_h2_v3':           'ZZSENTINELHTWOZZ',
  'static.quickref_zone8_v3':        'ZZSENTINELZONEZZ',
  'static.quickref_tips_heading_v3': 'ZZSENTINELTIPHDZZ',
};

test('B4 · P3 — every static apply puts its value on sheet 5', async () => {
  for (const [key, sentinel] of Object.entries(SENTINELS)) {
    const m = await model();
    qr.STATIC_ENTRIES[key].apply(m, sentinel);
    const page = sheet5(R.buildClientReportHTML_v3(m));
    assert.ok(page.includes(sentinel),
      `${key}: the applied value does not appear on sheet 5 — this apply writes a field the ` +
      `builder does not read, which shows an editor the OLD text with no error`);
  }
});

test('B4 · P3 — the tips apply reaches both the lead and the body of every tip', async () => {
  const m = await model();
  const tips = [0, 1, 2, 3].map((i) => ({ lead: `ZZLEAD${i}ZZ`, body: `ZZBODY${i}ZZ` }));
  qr.STATIC_ENTRIES['static.quickref_tips_v3'].apply(m, tips);
  const page = sheet5(R.buildClientReportHTML_v3(m));
  for (const t of tips) {
    assert.ok(page.includes(t.lead), `tips: lead ${t.lead} missing from sheet 5`);
    assert.ok(page.includes(t.body), `tips: body ${t.body} missing from sheet 5`);
  }
});

test('B4 · P3 — the subtype apply reaches the summary box, not a sibling key', async () => {
  const m = await model();
  qr.subtypeEntry().apply(m, { summary: 'ZZSENTINELSUMMARYZZ' });
  const page = sheet5(R.buildClientReportHTML_v3(m));
  assert.ok(page.includes('ZZSENTINELSUMMARYZZ'),
    'subtype quickref_v3: the summary does not appear on sheet 5. Build B2a folded the subtype ' +
    'onto hypotheses[0]; writing it to a sibling key renders nothing and looks like a no-op edit');
});

test('B4 · P3 — the subtype apply leaves the baseline standing when a leaf is absent', async () => {
  const m = await model();
  const before = m.pages.v3_quickref.hypotheses[0].subtype.summary;
  qr.subtypeEntry().apply(m, {});
  assert.strictEqual(m.pages.v3_quickref.hypotheses[0].subtype.summary, before,
    'an object with no summary must leave the baseline, not blank the zone');
});

test('B4 · P2 — the selector names a class that exists ONLY on sheet 5', async () => {
  const m = await model();
  const html = R.buildClientReportHTML_v3(m);
  // ELEMENTS carrying the class, not mentions of the name — the stylesheet names it too.
  const hits = (html.match(/class="v3-qr-two"/g) || []).length;
  assert.strictEqual(hits, 1,
    `v3-qr-two appears ${hits} times; the preview selector needs it unique or page.$() may ` +
    `screenshot a real, plausible page that is simply the wrong one`);
});

test('B4 · P1 — every CMS-editable static key has a preview entry', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app/server.js'), 'utf8');
  const listed = /const CMS_STATIC_FIELDS = \[([\s\S]*?)\];/.exec(src);
  assert.ok(listed, 'CMS_STATIC_FIELDS not found in app/server.js');
  const fields = (listed[1].match(/'([a-z0-9_]+)'/g) || []).map((x) => x.slice(1, -1));
  assert.ok(fields.length >= 13, `expected at least 13 editable static fields, found ${fields.length}`);
  // A key is previewable if cmsPreviewSpec's STATIC map names it, or if this build's module does.
  const spec = /const STATIC = \{([\s\S]*?)\n  \};/.exec(src);
  assert.ok(spec, 'cmsPreviewSpec STATIC map not found in app/server.js');
  const missing = fields.filter((f) => !spec[1].includes(`'static.${f}'`)
    && !Object.prototype.hasOwnProperty.call(qr.STATIC_ENTRIES, `static.${f}`));
  assert.deepStrictEqual(missing, [],
    `editable but not previewable: ${missing.join(', ')} — a key that can be edited and not ` +
    `previewed is a change someone makes blind`);
});
