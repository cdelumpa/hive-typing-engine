'use strict';
/**
 * Content-override shape guard.
 *
 * The override table is a fourth content source — alongside the docx, the compiled library
 * and the INTERIM_* constants — and it was outside every gate. PR 1.5 reconciled the docx
 * against content_library.json and declared Word canonical while seven published rows sat
 * outside that reconciliation carrying June copies of the same fields. Nothing could see
 * them: every offline harness renders with an empty override map.
 *
 * A test that proves the throw fires is worth more than the throw. This is that test, and it
 * runs in `npm test` with no database.
 *
 * The `drifted` cases are the real production rows, reproduced in shape:
 *   static.welcome  — published 13 Jun, predates the `signoff` key PR 2 added 12 Aug. Measured
 *                     before the guard: the v3 Welcome page rendered the literal word
 *                     "undefined" above the founder photos.
 *   type_N.wings    — published 13 Jun, carries the v2 {target_type, body} shape and predates
 *                     the overview/bullets/resource/intro_v3 fields. Inert while the type has
 *                     no v3 wing content; blanks the page the moment it does.
 *
 * THE GUARD HAS TWO HALVES, AND BOTH ARE BUILT NOT TO EXPIRE
 * ----------------------------------------------------------
 * A shape guard is only meaningful if it fires on drift AND stays quiet without it. One test
 * each, and the difference between them is where each gets its baseline:
 *
 *   FIRES   — real data. The type_1.wings row against type 1's ACTUAL current library
 *             content. This is the incident itself, not a model of it, and it is worth
 *             testing with real data precisely because the library is what moves. Every page
 *             PR that adds fields to an overridden object makes this assertion stronger; none
 *             can make it stale, because it asserts the throw, and fields only ever get added.
 *
 *   QUIET   — a SYNTHETIC baseline, constructed in the test. Deliberately not a real type.
 *
 * That second choice is the lesson of 13 Aug 2026. The original version of the quiet case
 * picked whichever real type happened to lack v3 wing content that week and asserted no-throw
 * against it. It was correct when written and its own comment predicted its end — "it starts
 * throwing the day their content lands" — but it still went red on PR 3-Wings, because its
 * example stopped being an example. The behaviour never changed. The test was a hostage to
 * shipping order.
 *
 * So: assert the throw against real data that can only get realer, and assert the silence
 * against a target nobody ships. Neither half depends on which pages happen to be built.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const co = require(path.join(__dirname, '../app/content_overrides.js'));
const library = require(path.join(__dirname, '../app/content/content_library.json'));
const FIX = require(path.join(__dirname, 'fixtures/published_overrides.json'));

const mapOf = (obj) => new Map(Object.entries(obj).filter(([k]) => k !== '_note'));
const field = (key) => {
  const [top, f] = key.split('.');
  return library[top][f];
};

test('overrideShape normalizes array indices to []', () => {
  const a = co.overrideShape({ letters: ['x', 'y'] });
  const b = co.overrideShape({ letters: ['x', 'y', 'z'] });
  assert.deepStrictEqual([...a].sort(), [...b].sort(), 'cardinality must not affect shape');
  assert.ok(a.has('letters[]'));
});

test('a matching override resolves and replaces the baseline', () => {
  const overrides = mapOf(FIX.matching);
  for (const [key, value] of overrides) {
    assert.strictEqual(co.resolveContent(overrides, key, field(key)), value,
      `${key} should resolve to the override value`);
  }
});

test('a matching override survives resolveLibObject and changes the object', () => {
  const overrides = mapOf(FIX.matching);
  const out = co.resolveLibObject(overrides, 'static', library.static);
  assert.notStrictEqual(out, library.static, 'a shallow copy is expected when an override applies');
  assert.strictEqual(out.wings_using, FIX.matching['static.wings_using']);
  assert.strictEqual(out.welcome, library.static.welcome, 'untouched fields keep their identity');
});

test('an override MISSING a key the library gained throws (static.welcome / signoff)', () => {
  const overrides = mapOf(FIX.drifted);
  assert.ok('signoff' in library.static.welcome,
    'precondition: the library carries `signoff` (added by PR 2)');
  assert.throws(
    () => co.resolveContent(overrides, 'static.welcome', library.static.welcome),
    (e) => e instanceof co.OverrideShapeError && /missing from the override: .*signoff/.test(e.message),
    'a June-shaped welcome override must throw, not render "undefined"');
});

test('a v2-shaped wings override throws once the type has v3 wing content', () => {
  const overrides = mapOf(FIX.drifted);
  assert.ok(library.type_9.wings.wing_a.overview,
    'precondition: type_9 carries the v3 wing fields (added by PR 1)');
  assert.throws(
    () => co.resolveContent(overrides, 'type_9.wings', library.type_9.wings),
    (e) => e instanceof co.OverrideShapeError && /overview/.test(e.message),
    'a v2-shaped wings override must throw against a v3-shaped baseline');
});

test('the real type_1.wings row throws now that type 1 has v3 content', () => {
  // THE LITERAL INCIDENT. type_1.wings was one of the seven rows published in June, carrying
  // the v2 {target_type, body} shape. It sat inert for two months because type 1 had no v3
  // wing fields to lose. PR 3-Wings gave it fourteen of them on 13 Aug 2026, and from that
  // moment the row would have replaced the whole `wings` object and blanked the page —
  // resolveLibObject assigns a field WHOLE, so every key the field has gained since goes with
  // it. In production only: no offline harness loads overrides, which is why this file exists.
  //
  // Asserted through resolveLibObject rather than resolveContent because that is the call
  // report_prep actually makes, and the throw has to survive the walk to be worth anything.
  const overrides = mapOf(FIX.drifted);
  assert.ok(library.type_1.wings.wing_a.overview,
    'precondition: type 1 carries v3 wing fields (added by PR 3-Wings)');
  assert.throws(
    () => co.resolveLibObject(overrides, 'type_1', library.type_1),
    (e) => e instanceof co.OverrideShapeError
      && /type_1\.wings/.test(e.message)
      && /overview/.test(e.message),
    'the June type_1.wings row must throw by name, not silently blank the Wings page');
});

test('a v2-shaped override is inert against a target with no v3 fields', () => {
  // The other half of the guarantee: the guard fires on DRIFT, not on the mere presence of an
  // override. A row published against a field that has not moved underneath it must resolve
  // silently, or the throw is just noise.
  //
  // SYNTHETIC BASELINE, DELIBERATELY. The version of this test that shipped on 12 Aug picked
  // a real type — whichever one happened to lack v3 content that week — and asserted the
  // no-drift case against it. That made the test a hostage to shipping order: it went red the
  // day PR 3-Wings landed, not because the behaviour changed but because its chosen example
  // stopped being an example. Constructing the target here means there is no real type to go
  // stale, and no future page PR can expire it.
  const baseline = {
    wing_a: { target_type: 9, body: 'v2 wing body, no v3 fields.' },
    wing_b: { target_type: 2, body: 'v2 wing body, no v3 fields.' },
  };
  const overrides = new Map([['synthetic.wings', FIX.drifted['type_1.wings']]]);
  assert.doesNotThrow(() => co.resolveContent(overrides, 'synthetic.wings', baseline),
    'same shape on both sides -> no drift -> no throw');
  assert.deepStrictEqual(
    co.resolveContent(overrides, 'synthetic.wings', baseline), FIX.drifted['type_1.wings'],
    'and the override is actually applied, not just tolerated');
});

test('resolveLibObject propagates the throw rather than rendering a broken page', () => {
  const overrides = mapOf(FIX.drifted);
  assert.throws(() => co.resolveLibObject(overrides, 'static', library.static), co.OverrideShapeError);
});

test('a different array length is NOT a shape mismatch', () => {
  const overrides = mapOf(FIX.cardinality);
  const baseline = library.type_9.practices;
  assert.notStrictEqual(baseline.bullets.length, FIX.cardinality['type_9.practices'].bullets.length,
    'precondition: the fixture has a different bullet count');
  assert.doesNotThrow(() => co.resolveContent(overrides, 'type_9.practices', baseline),
    'a coach adding a bullet is a legitimate edit');
});

test('an empty override map returns the baseline object by identity', () => {
  const out = co.resolveLibObject(new Map(), 'static', library.static);
  assert.strictEqual(out, library.static, 'no override -> byte-identical output');
});

test('auditShapes warns loudly but does NOT throw — it is the smoke alarm, not the sprinkler', () => {
  // loadPublishedOverrides' contract is that it never throws. A boot that dies because of a
  // content row is a worse failure than one that shouts, so the early warning must stay
  // non-fatal; the hard stop is resolveContent.
  const lines = [];
  const real = console.error;
  console.error = (...a) => lines.push(a.join(' '));
  try {
    assert.doesNotThrow(() => co.auditShapes(mapOf(FIX.drifted)));
  } finally { console.error = real; }
  const out = lines.join('\n');
  assert.match(out, /WILL THROW AT RENDER TIME/);
  assert.match(out, /static\.welcome/);
  assert.match(out, /signoff/);
});

test('auditShapes is silent on a clean set', () => {
  const lines = [];
  const real = console.error;
  console.error = (...a) => lines.push(a.join(' '));
  try { co.auditShapes(mapOf(FIX.matching)); } finally { console.error = real; }
  assert.strictEqual(lines.length, 0, 'a matching override set must not warn');
});
