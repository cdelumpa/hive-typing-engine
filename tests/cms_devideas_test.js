'use strict';
/**
 * Sheet 11's CMS gate and write routes (PR 6 Build B2) — everything that can be proved without a
 * database or a browser.
 *
 *   · The WRITE ROUTES (app/cms_write.js) with a fake database: a refused sheet 11 edit never reaches
 *     the write, an allowed one reaches it exactly once, every other key behaves as server.js did.
 *   · The GATE's logic (app/cms_devideas.js) with a fake browser whose pages "measure" whatever the
 *     test says: composition for all three actions, the lock, and every way it must refuse.
 *   · The COVERAGE PROOF, on the real renderer: no library field outside the four gated keys and the
 *     library-only titles can change sheet 11's HTML.
 *   · SOURCE SCANS on app/server.js, which no test can load: the routes are mounted through
 *     cms_write, and the titles are not editable.
 *
 * The same gate is driven through the REAL renderer by scripts/verify_devideas_fit.js.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const G = require(path.join(ROOT, 'app/cms_devideas.js'));
const { makeWriteHandlers } = require(path.join(ROOT, 'app/cms_write.js'));
const RULES = require(path.join(ROOT, 'app/devideas_rules.js'));
const { OverrideShapeError } = require(path.join(ROOT, 'app/content_overrides.js'));
const LIB = require(path.join(ROOT, 'app/content/content_library.json'));

// ── Fakes ─────────────────────────────────────────────────────────────────────────────────────
function fakeRes() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}
function fakeStore(ok = true) {
  const calls = [];
  const rec = (name) => async (...a) => { calls.push([name, ...a]); return ok; };
  return { calls, saveDraftOverride: rec('draft'), publishOverride: rec('publish'), revertOverride: rec('revert') };
}
const req = (body) => ({ body, session: { coach_id: 7 } });

/** A probe for a page of `natural` px: header wrapped, one card, nothing past its column. */
const probeOf = (natural, over = {}) => ({ natural, headerLines: 2,
  cards: [{ key: 'growth', contentRight: 743, items: [{ right: 700 }] }], ...over });

/**
 * Deps whose "browser" measures `naturalFor(overrides, type)` — so a test states what a page would
 * measure under a given live set, and the gate's composition decides which set it asks about.
 */
function fakeDeps({ naturalFor = () => 973.13, published = new Map(), log = [], probeFor = null,
  failLaunch = false, failRead = false, shapeError = false, delay = 0 } = {}) {
  return {
    log,
    OverrideShapeError,
    loadPublishedStrict: async () => { log.push('read'); if (failRead) throw new Error('the content database could not be read'); return published; },
    prep: { buildClientModel: async ({ overrides, apiResult }) => {
      if (shapeError) throw new OverrideShapeError('Published content override "type_2.devideas_v3" no longer matches the content library\'s shape.');
      return { overrides, type: apiResult.hypothesis.confirmed_type };
    } },
    R: { buildClientReportHTML_v3: (m) => m },
    assertReportFont: async () => {},
    launchBrowser: async () => {
      if (failLaunch) throw new Error('Chromium could not start');
      log.push('launch');
      let current = null;
      return {
        newPage: async () => ({
          setViewport: async () => {}, setContent: async (m) => { current = m; },
          evaluate: async (fn) => {
            if (typeof fn !== 'function' || fn.name !== 'PROBE') return undefined;   // fonts.ready
            if (delay) await new Promise((r) => setTimeout(r, delay));
            return probeFor ? probeFor(current.overrides, current.type) : probeOf(naturalFor(current.overrides, current.type));
          },
          $: async () => null,
        }),
        close: async () => {},
      };
    },
  };
}
const T9 = LIB.type_9.devideas_v3;

// ── The write routes ──────────────────────────────────────────────────────────────────────────
const isValidKey = (k) => /^(static\.welcome|type_[1-9]\.(wings|devideas_v3)|static\.devideas_(rails|lead|coda)_v3)$/.test(k);
const wordCount = () => 3;

test('routes — an ordinary key is written exactly as server.js wrote it, and the gate is never asked', async () => {
  const store = fakeStore();
  let asked = 0;
  const h = makeWriteHandlers({ contentOverrides: store, isValidKey, wordCount, guard: { isKey: G.isKey, guardedWrite: async () => { asked++; } } });
  const res = fakeRes();
  await h.publish(req({ content_key: 'static.welcome', value: { subhead: 'x' } }), res);
  assert.deepStrictEqual(res.body, { ok: true, error: undefined });
  assert.deepStrictEqual(store.calls, [['publish', 'static.welcome', { subhead: 'x' }, 3, 7]]);
  assert.strictEqual(asked, 0);
  const r2 = fakeRes(); await h.revert(req({ content_key: 'type_9.wings' }), r2);
  assert.deepStrictEqual(store.calls[1], ['revert', 'type_9.wings']);
  const failing = makeWriteHandlers({ contentOverrides: fakeStore(false), isValidKey, wordCount, guard: { isKey: G.isKey } });
  const r3 = fakeRes(); await failing.draft(req({ content_key: 'static.welcome', value: 'v' }), r3);
  assert.deepStrictEqual(r3.body, { ok: false, error: 'database unavailable' });
});

test('routes — the 400s are unchanged: an invalid key, and a missing value on draft and publish', async () => {
  const store = fakeStore();
  const h = makeWriteHandlers({ contentOverrides: store, isValidKey, wordCount, guard: { isKey: G.isKey } });
  for (const [fn, body, err] of [['publish', { content_key: 'type_9.nope', value: 1 }, 'invalid content_key'],
    ['draft', { content_key: 'static.welcome' }, 'missing value'], ['publish', { content_key: 'static.welcome' }, 'missing value'],
    ['revert', { content_key: 'nope' }, 'invalid content_key']]) {
    const res = fakeRes(); await h[fn](req(body), res);
    assert.strictEqual(res.statusCode, 400); assert.deepStrictEqual(res.body, { ok: false, error: err });
  }
  assert.strictEqual(store.calls.length, 0);
});

test('routes — a sheet 11 key goes through the gate; a refusal never reaches the database', async () => {
  const store = fakeStore();
  const h = makeWriteHandlers({ contentOverrides: store, isValidKey, wordCount,
    guard: { isKey: G.isKey, guardedWrite: (a, k, v, write) => G.guardedWrite(a, k, v, write, fakeDeps({ naturalFor: () => 1072.13 })) } });
  const res = fakeRes();
  await h.publish(req({ content_key: 'type_9.devideas_v3', value: T9 }), res);
  assert.strictEqual(res.body.ok, false);
  assert.match(res.body.error, /^Not published — Type 9 would run 1 line onto a second sheet\./);
  assert.strictEqual(store.calls.length, 0, 'a refused edit must not be written');
});

test('routes — an allowed sheet 11 edit is written exactly once, for each of the three actions', async () => {
  for (const action of ['publish', 'draft', 'revert']) {
    const store = fakeStore();
    const deps = fakeDeps({ published: new Map([['type_9.devideas_v3', T9]]) });
    const h = makeWriteHandlers({ contentOverrides: store, isValidKey, wordCount,
      guard: { isKey: G.isKey, guardedWrite: (a, k, v, write) => G.guardedWrite(a, k, v, write, deps) } });
    const res = fakeRes();
    await h[action](req({ content_key: 'type_9.devideas_v3', value: T9 }), res);
    assert.deepStrictEqual(res.body, { ok: true, error: undefined }, action);
    assert.strictEqual(store.calls.length, 1, `${action}: written once`);
    assert.strictEqual(store.calls[0][0], action);
  }
});

test('routes — a gate that throws refuses; it does not 500 and does not write', async () => {
  const store = fakeStore();
  const h = makeWriteHandlers({ contentOverrides: store, isValidKey, wordCount,
    guard: { isKey: G.isKey, guardedWrite: async () => { throw new Error('boom'); } } });
  const res = fakeRes(); await h.draft(req({ content_key: 'static.devideas_lead_v3', value: 'x' }), res);
  assert.strictEqual(res.statusCode, 200); assert.strictEqual(res.body.ok, false);
  assert.match(res.body.error, /could not be checked \(boom\)/);
  assert.strictEqual(store.calls.length, 0);
});

// ── The gate's logic ──────────────────────────────────────────────────────────────────────────
const write = (log) => async () => { log.push('write'); return true; };

test('gate — which keys it guards: the four editable sheet 11 keys, and not the titles', () => {
  for (const k of ['type_1.devideas_v3', 'type_9.devideas_v3', 'static.devideas_rails_v3', 'static.devideas_lead_v3', 'static.devideas_coda_v3']) assert.ok(G.isKey(k), k);
  for (const k of ['static.devideas_titles_v3', 'type_9.wings', 'static.welcome', 'type_0.devideas_v3']) assert.ok(!G.isKey(k), k);
  assert.deepStrictEqual(G.affectedTypes('type_4.devideas_v3'), [4]);
  assert.strictEqual(G.affectedTypes('static.devideas_lead_v3').length, 9);
});

test('gate — composition: publish adds the edit; save draft and revert both remove the key', () => {
  const live = new Map([['type_9.devideas_v3', 'A'], ['static.devideas_lead_v3', 'L']]);
  assert.strictEqual(G.compose(live, 'publish', 'type_9.devideas_v3', 'B').get('type_9.devideas_v3'), 'B');
  for (const a of ['draft', 'revert']) {
    const m = G.compose(live, a, 'type_9.devideas_v3');
    assert.ok(!m.has('type_9.devideas_v3') && m.get('static.devideas_lead_v3') === 'L', a);
  }
  assert.strictEqual(live.size, 2, 'the published set itself is never mutated');
});

test('gate — THE COMBINATION: an edit that fits alone is refused once another live edit shares its page', async () => {
  // The lead edit adds 21.68px on every type; Type 9's live edit adds 74.25px. Each fits alone.
  const naturalFor = (o, t) => (t === 9 ? 973.13 : 950) + (o.has('type_9.devideas_v3') && t === 9 ? 74.25 : 0) + (o.has('static.devideas_lead_v3') ? 21.68 : 0);
  const alone = await G.evaluate('publish', 'static.devideas_lead_v3', 'Lead.', new Map(), fakeDeps({ naturalFor }));
  assert.strictEqual(alone.ok, true, alone.message);
  const t9 = await G.evaluate('publish', 'type_9.devideas_v3', T9, new Map(), fakeDeps({ naturalFor }));
  assert.strictEqual(t9.ok, true, t9.message);
  const both = await G.evaluate('publish', 'static.devideas_lead_v3', 'Lead.', new Map([['type_9.devideas_v3', T9]]), fakeDeps({ naturalFor }));
  assert.strictEqual(both.ok, false);
  assert.match(both.message, /Type 9 would run 1 line onto a second sheet/);
});

test('gate — save draft and revert are refused when taking a live edit away would spill', async () => {
  // A shortened Type 9 is live, and a big lead only fits because of it.
  const live = new Map([['type_9.devideas_v3', 'short'], ['static.devideas_lead_v3', 'big']]);
  const naturalFor = (o, t) => (t === 9 ? (o.has('type_9.devideas_v3') ? 980 : 1059.88) : 960);
  for (const [a, words] of [['draft', /^Not saved — saving a draft takes this edit out of live reports, and then Type 9 would run 1 line/], ['revert', /^Not reverted — going back to the library text, Type 9 would run 1 line/]]) {
    const log = [];
    const r = await G.guardedWrite(a, 'type_9.devideas_v3', 'short', write(log), fakeDeps({ naturalFor, published: live, log }));
    assert.strictEqual(r.ok, false, a); assert.match(r.error, words); assert.ok(!log.includes('write'), `${a} must not write`);
  }
});

test('gate — a draft save or revert of a key that is not live writes without rendering', async () => {
  const log = [];
  const r = await G.guardedWrite('revert', 'type_3.devideas_v3', undefined, write(log), fakeDeps({ log, naturalFor: () => 2000 }));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(log, ['read', 'write'], 'no browser was launched');
});

test('gate — refuses, and writes nothing, when it cannot measure: a failed read, the browser, a shape error', async () => {
  for (const [opts, pattern] of [
    [{ failRead: true }, /^Not published — the live content could not be read \(the content database could not be read\)/],
    [{ failLaunch: true }, /^Not published — the fit could not be checked right now \(Chromium could not start\)/],
    [{ shapeError: true }, /^Not published — this change doesn't match the shape of the field it replaces/],
  ]) {
    const log = [];
    const r = await G.guardedWrite('publish', 'type_2.devideas_v3', LIB.type_2.devideas_v3, write(log), fakeDeps({ ...opts, log }));
    assert.strictEqual(r.ok, false); assert.match(r.error, pattern); assert.ok(!log.includes('write'));
  }
});

test('gate — refuses a page with text past its column, and one whose long-name header did not wrap', async () => {
  const wide = await G.evaluate('publish', 'type_3.devideas_v3', LIB.type_3.devideas_v3, new Map(),
    fakeDeps({ probeFor: () => probeOf(937.38, { cards: [{ key: 'growth', contentRight: 743, items: [{ right: 818.6 }] }] }) }));
  assert.strictEqual(wide.ok, false); assert.match(wide.message, /Growth Strategies has text running past the edge of its column/);
  const flat = await G.evaluate('publish', 'type_3.devideas_v3', LIB.type_3.devideas_v3, new Map(),
    fakeDeps({ probeFor: () => probeOf(900, { headerLines: 1 }) }));
  assert.strictEqual(flat.ok, false); assert.match(flat.message, /could not reserve room for a long client name/);
});

test('gate — the rules refuse before any render: a half-blank experiment, a colon in a label, an emptied list', async () => {
  const cases = [
    (d) => { d.experiments[1].body = ''; },
    (d) => { d.experiments[0].label = 'Gratitude: Journal'; },
    (d) => { d.inquiries = d.inquiries.map(() => ''); },
  ];
  for (const mutate of cases) {
    const d = structuredClone(LIB.type_4.devideas_v3); mutate(d);
    const log = [];
    const r = await G.guardedWrite('publish', 'type_4.devideas_v3', d, write(log), fakeDeps({ log }));
    assert.strictEqual(r.ok, false); assert.ok(!log.includes('launch') && !log.includes('write'), r.error);
  }
});

test('gate — the lock: a second write waits until the first has read, measured and written', async () => {
  const log = [];
  const deps = fakeDeps({ log, delay: 30 });
  await Promise.all([
    G.guardedWrite('publish', 'type_9.devideas_v3', T9, async () => { log.push('write-1'); return true; }, deps),
    G.guardedWrite('publish', 'static.devideas_lead_v3', 'Lead.', async () => { log.push('write-2'); return true; }, deps),
  ]);
  assert.ok(log.indexOf('write-1') < log.lastIndexOf('read'), `the second read must follow the first write: ${log.join(' ')}`);
});

test('gate — a page that fits is allowed, and says how much room is left', async () => {
  const r = await G.evaluate('publish', 'type_9.devideas_v3', T9, new Map(), fakeDeps({ naturalFor: () => 973.13 }));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.message, 'Fits — 4 lines free on the tightest page (Type 9).');
});

// ── The CMS rules ─────────────────────────────────────────────────────────────────────────────
test('rules — blanks shorten a list; a list may not empty; labels keep their rules; curly quotes are allowed', () => {
  const d = structuredClone(T9);
  d.growth[1] = ''; assert.deepStrictEqual(RULES.cmsErrors('type_9.devideas_v3', d), []);
  d.growth = d.growth.map(() => ' '); assert.match(RULES.cmsErrors('type_9.devideas_v3', d)[0], /Growth Strategies would be empty/);
  const e = structuredClone(T9); e.experiments[0] = { label: '', body: '' }; assert.deepStrictEqual(RULES.cmsErrors('type_9.devideas_v3', e), []);
  const c = structuredClone(T9); c.inquiries[0] = 'What’s “really” going on…?'; assert.deepStrictEqual(RULES.cmsErrors('type_9.devideas_v3', c), []);
  assert.match(RULES.cmsErrors('static.devideas_lead_v3', 'For Achievers.')[0], /pre-canon type name \("Achievers"\)/);
  assert.match(RULES.cmsErrors('static.devideas_rails_v3', { growth: 'g', inquiries: '', experiments: 'e' })[0], /inquiries rail description is empty/);
});

// ── The boot audit ────────────────────────────────────────────────────────────────────────────
test('boot audit — alerts once on a spill, stays quiet on a fit, and never throws', async () => {
  const quiet = { log() {}, error() {} };
  const sent = [];
  const spill = await G.auditLive({ notify: async (m) => { sent.push(m); }, log: quiet,
    deps: fakeDeps({ naturalFor: (o, t) => (t === 9 ? 1059.88 : 950) }) });
  assert.strictEqual(spill.ok, false); assert.strictEqual(sent.length, 1);
  assert.match(sent[0].subject, /Sheet 11 spills — Type 9/);
  const fits = await G.auditLive({ notify: async (m) => { sent.push(m); }, log: quiet, deps: fakeDeps() });
  assert.strictEqual(fits.ok, true); assert.strictEqual(sent.length, 1, 'no alert on a clean boot');
  const broken = await G.auditLive({ notify: async (m) => { sent.push(m); }, log: quiet, deps: fakeDeps({ failRead: true }) });
  assert.strictEqual(broken.ok, null); assert.strictEqual(sent.length, 1);
});

// ── The coverage proof, on the real renderer ──────────────────────────────────────────────────
test('coverage — only the four gated keys and the library-only titles can change sheet 11', async () => {
  const prep = require(path.join(ROOT, 'app/report_prep.js'));
  const R = require(path.join(ROOT, 'app/renderer.js'));
  const { retypeFixture } = require(path.join(ROOT, 'scripts/lib/retype_fixture.js'));
  const fixture = retypeFixture(require(path.join(ROOT, 'tests/fixtures/anders_sx9_api_result.json')), 9);
  const sheet11 = async (overrides) => {
    const m = await prep.buildClientModel({ apiResult: fixture, client: { first_name: 'A', last_name: 'B' }, coach: {}, overrides });
    return R.buildClientReportHTML_v3(m).split(/(?=<div class="v3-page)/).find((c) => c.includes('class="v3-di-card"'));
  };
  // Change every string a field holds, keeping its shape. Identifier leaves are left alone: they
  // select data rather than print it, and changing them tests the prep, not the page.
  const SKIP = new Set(['code', 'number', 'center', 'target_type', 'start', 'type']);
  const mutate = (v, k) => (typeof v === 'string' ? (SKIP.has(k) ? v : `Zz ${v}`)
    : Array.isArray(v) ? v.map((x) => mutate(x, k))
      : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, mutate(x, kk)])) : v);
  const base = await sheet11(new Map());
  const movers = [];
  let tried = 0;
  for (const top of ['type_9', 'subtype_sx9', 'static']) {
    for (const f of Object.keys(LIB[top])) {
      const val = mutate(LIB[top][f], f);
      if (JSON.stringify(val) === JSON.stringify(LIB[top][f])) continue;
      tried++;
      if (await sheet11(new Map([[`${top}.${f}`, val]])) !== base) movers.push(`${top}.${f}`);
    }
  }
  assert.ok(tried >= 40, `only ${tried} fields were exercised`);
  assert.deepStrictEqual(movers.sort(), ['static.devideas_coda_v3', 'static.devideas_lead_v3', 'static.devideas_rails_v3',
    'static.devideas_titles_v3', 'type_9.devideas_v3'], `fields that move sheet 11: ${movers.join(', ')}`);
  assert.deepStrictEqual(movers.filter((k) => !G.isKey(k)), ['static.devideas_titles_v3'],
    'every field that moves sheet 11 is gated, except the titles, which are not editable');
});

// ── Source scans on app/server.js ─────────────────────────────────────────────────────────────
const SERVER = fs.readFileSync(path.join(ROOT, 'app/server.js'), 'utf8');

test('server.js — the three write routes are mounted through cms_write, once each', () => {
  for (const a of ['draft', 'publish', 'revert']) {
    const mounts = SERVER.match(new RegExp(`app\\.post\\('/admin/content/${a}'[^\\n]*`, 'g')) || [];
    assert.deepStrictEqual(mounts, [`app.post('/admin/content/${a}', requireSuperAdmin, cmsWrite.${a});`], `${a}: ${mounts.join(' | ')}`);
  }
});

test('app/ — nothing but cms_write calls the override writers', () => {
  const offenders = fs.readdirSync(path.join(ROOT, 'app')).filter((f) => f.endsWith('.js') && !['cms_write.js', 'content_overrides.js'].includes(f))
    .filter((f) => /\b(saveDraftOverride|publishOverride|revertOverride)\s*\(/.test(fs.readFileSync(path.join(ROOT, 'app', f), 'utf8')));
  assert.deepStrictEqual(offenders, [], `write paths that bypass the gate: ${offenders.join(', ')}`);
});

test('server.js — the titles are not editable, and the three sheet 11 statics and devideas_v3 are', () => {
  const listed = /const CMS_STATIC_FIELDS = \[([\s\S]*?)\];/.exec(SERVER)[1].replace(/\/\/[^\n]*/g, '');
  const fields = (listed.match(/'([a-z0-9_]+)'/g) || []).map((x) => x.slice(1, -1));
  assert.ok(!fields.includes('devideas_titles_v3'), 'the titles move sheet 11 and are not gated — they must stay library-only');
  for (const f of ['devideas_rails_v3', 'devideas_lead_v3', 'devideas_coda_v3']) assert.ok(fields.includes(f), f);
  assert.match(/function cmsIsValidTypeKey[\s\S]*?\n\}/.exec(SERVER)[0], /\|devideas_v3\)\$/);
});
