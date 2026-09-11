'use strict';
/**
 * cms_devideas.js — the publish-time fit gate for sheet 11, Development Ideas (PR 6 Build B2).
 *
 * THE OUTCOME: publishing, saving a draft or reverting a sheet 11 edit in the CMS is REFUSED — never
 * silently shipped — whenever it would push a type's page onto a second sheet (decisions D2, D-B3).
 *
 * VALIDATE → COMPOSE → MEASURE → DECIDE, UNDER ONE LOCK
 *   1 Validate  the CMS rules in app/devideas_rules.js, on what the page would show.
 *   2 Compose   what live reports would show AFTER the action: the published set plus the edit for a
 *               publish; minus the key for a draft save or a revert — a draft save demotes a published
 *               row (content_overrides.saveDraftOverride), so for sheet 11 it changes the live page too.
 *               The published set is read STRICTLY: a failed read refuses (D-B4), never measures empty.
 *   3 Measure   every affected type through the production path — buildClientModel({ overrides }),
 *               so resolveLibObject and assertOverrideShape run on the candidate — rendered with
 *               DF.LONG_NAME, the same wrapped-header fixture CI uses (D-B2), and probed with DF.PROBE.
 *               A type's own key affects one type; the rails, lead and closing note affect all nine.
 *   4 Decide    refuse on a spill, on text past its column, or — failing closed — when the long-name
 *               header did not wrap. NOT on judgeD1's height model: that describes the LIBRARY copy and
 *               would refuse a lead edit that adds a line and still fits (measured, Build B2 audit).
 * Steps 2-4 and the write run under one in-process lock across every sheet 11 key, because the keys
 * interact. One Railway replica (content_overrides.js) makes an in-process lock sufficient.
 *
 * WHY ONLY THESE FOUR KEYS. Sheet 11's height depends on a type's devideas_v3, the four static
 * devideas_*_v3 strings and the client's name — nothing else (tests/cms_devideas_test.js proves it
 * field by field). The titles also move it and are deliberately NOT CMS-editable; a test keeps them so.
 *
 * Every collaborator is injectable (`deps`) so the logic is tested without a database or a browser,
 * and scripts/verify_devideas_fit.js drives the real thing.
 */

const DF = require('./devideas_fit');
const RULES = require('./devideas_rules');

const KEY_RE = /^(?:type_[1-9]\.devideas_v3|static\.devideas_(?:rails|lead|coda)_v3)$/;
const isKey = (key) => typeof key === 'string' && KEY_RE.test(key);
const TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const affectedTypes = (key) => { const m = /^type_([1-9])\./.exec(key); return m ? [+m[1]] : TYPES; };
const SECTION_NAME = { growth: 'Growth Strategies', inquiries: 'Inquiries', experiments: 'Field Experiments' };
const PAGE_LABEL = 'P11 — Development Ideas';

/**
 * A minimal valid api_result for type N — the shape the CMS preview's own stub uses (nine ranking
 * entries, which CLIENT_SPEC requires). Sheet 11 reads nothing from it but the type, so the gate's
 * verdict does not depend on the rest; the client NAME is what matters, and that is DF.LONG_NAME.
 */
function gateApiResult(N) {
  const alt = N === 9 ? 1 : N + 1;
  return {
    hypothesis: {
      confirmed_type: N, alternate_candidate: alt, dominant_instinct_hypothesis: 'SP',
      confidence_level: 'HIGH', stage4_outcome: 'CONFIRM',
      call1_ranking: [{ type: N, score: 85 }, { type: alt, score: 60 }].concat(
        TYPES.filter((t) => t !== N && t !== alt).map((t, i) => ({ type: t, score: 52 - i * 4 }))),
      instinct_score_profile: { SP: 80, SO: 55, SX: 30 },
    },
    coach_report: {}, client_facing: {}, client_words: {},
  };
}
const GATE_CLIENT = { ...DF.LONG_NAME, date: 'June 2026' };
const GATE_COACH = { full_name: '', type: null, instinct: null };

/** What live reports would show after `action`. */
function compose(published, action, key, value) {
  const next = new Map(published);
  if (action === 'publish') next.set(key, value); else next.delete(key);
  return next;
}

/** Refusal reasons for one measured page. Empty = this type fits. */
function decide(probe, type) {
  if (!probe) return [{ kind: 'unverified', type, text: `sheet 11 could not be found for Type ${type}` }];
  const out = [];
  if (DF.spills(probe.natural)) {
    const over = Math.ceil((probe.natural - DF.PAGE_PX) / DF.MODEL.line);
    out.push({ kind: 'spill', type, over, text: `Type ${type} would run ${over} line${over === 1 ? '' : 's'} onto a second sheet` });
  }
  for (const c of probe.cards) {
    if (c.contentRight != null && c.items.some((i) => i.right > c.contentRight + 0.5)) {
      out.push({ kind: 'wide', type, text: `on Type ${type}, ${SECTION_NAME[c.key] || c.key} has text running past the edge of its column — an unbreakable link or word` });
    }
  }
  if (probe.headerLines !== 2) out.push({ kind: 'unverified', type, text: 'the check could not reserve room for a long client name' });
  return out;
}

const defaultDeps = () => ({
  prep: require('./report_prep'),
  R: require('./renderer'),
  launchBrowser: require('./browser_launch').launchBrowser,
  assertReportFont: require('./browser_launch').assertReportFont,
  loadPublishedStrict: require('./content_overrides').loadPublishedOverridesStrict,
  OverrideShapeError: require('./content_overrides').OverrideShapeError,
});

/**
 * Render and probe sheet 11 for each type under `overrides`. One browser, one page, re-used; the
 * font is asserted before anything is measured. `shotType` also returns a 2x PNG of that type's page.
 */
async function measure(overrides, types, deps, { shotType = null } = {}) {
  const browser = await deps.launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: DF.PAGE_PX, deviceScaleFactor: shotType ? 2 : 1 });
    const out = [];
    let fontChecked = false;
    for (const type of types) {
      const m = await deps.prep.buildClientModel({ apiResult: gateApiResult(type), client: GATE_CLIENT, coach: GATE_COACH, overrides });
      await page.setContent(deps.R.buildClientReportHTML_v3(m), { waitUntil: 'domcontentloaded' });
      if (!fontChecked) { await deps.assertReportFont(page); fontChecked = true; }
      await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
      const probe = await page.evaluate(DF.PROBE, DF.SHEET_SEL);
      let png = null;
      if (shotType === type) {
        const el = await page.$(DF.SHEET_SEL);
        if (el) png = 'data:image/png;base64,' + (await el.screenshot({ type: 'png' })).toString('base64');
      }
      out.push({ type, probe, png });
    }
    return out;
  } finally { await browser.close(); }
}

const VERB = {
  publish: { refused: 'Not published', lead: '' },
  draft: { refused: 'Not saved', lead: 'saving a draft takes this edit out of live reports, and then ' },
  revert: { refused: 'Not reverted', lead: 'going back to the library text, ' },
};
const joinTypes = (xs) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** The words an editor reads, for a set of refusal reasons. */
function refusalMessage(action, reasons) {
  const v = VERB[action];
  const unverified = reasons.find((r) => r.kind === 'unverified');
  if (unverified) return `${v.refused} — ${unverified.text}, so the fit could not be checked. Nothing was saved.`;
  const spills = reasons.filter((r) => r.kind === 'spill');
  if (spills.length) {
    const worst = spills.reduce((a, b) => (b.over > a.over ? b : a));
    const who = spills.length === 1 ? spills[0].text : `Types ${joinTypes(spills.map((s) => s.type))} would run onto a second sheet (Type ${worst.type} by ${worst.over} line${worst.over === 1 ? '' : 's'})`;
    return `${v.refused} — ${v.lead}${who}. Shorten something on the page first. Nothing was saved.`;
  }
  return `${v.refused} — ${v.lead}${reasons[0].text}. Nothing was saved.`;
}

/**
 * THE VERDICT for one action, against a given published set. Does not write. `measured` carries every
 * type's probe so the preview and the controls can show their working.
 */
async function evaluate(action, key, value, published, deps = defaultDeps()) {
  if (!isKey(key)) return { ok: true, skipped: 'not a sheet 11 key' };
  // A draft save or a revert of a key that is not live changes nothing a client sees.
  if (action !== 'publish' && !published.has(key)) return { ok: true, skipped: 'not live' };
  if (action === 'publish') {
    const errs = RULES.cmsErrors(key, value);
    if (errs.length) return { ok: false, kind: 'rules', message: `${VERB.publish.refused} — ${errs[0]}. Nothing was saved.`, reasons: errs };
  }
  const next = compose(published, action, key, value);
  let measured;
  try {
    measured = await measure(next, affectedTypes(key), deps);
  } catch (e) {
    if (e instanceof deps.OverrideShapeError) {
      // The candidate reached assertOverrideShape: the right refusal, in its own words — not a
      // browser failure, which is what it read as in the Build B2 audit.
      return { ok: false, kind: 'shape', message: `${VERB[action].refused} — this change doesn't match the shape of the field it replaces, so it can't be applied. Nothing was saved. (${e.message.split('\n')[0]})` };
    }
    return { ok: false, kind: 'unverified', message: `${VERB[action].refused} — the fit could not be checked right now (${e.message}). Nothing was saved.` };
  }
  const reasons = measured.flatMap((x) => decide(x.probe, x.type));
  const worst = measured.reduce((a, b) => (!a || (b.probe && b.probe.natural > a.probe.natural) ? b : a), null);
  if (reasons.length) return { ok: false, kind: reasons[0].kind, message: refusalMessage(action, reasons), reasons, worst, measured };
  const free = DF.PAGE_PX - worst.probe.natural;
  return { ok: true, worst, measured,
    message: `Fits — ${Math.floor(free / DF.MODEL.line)} line${Math.floor(free / DF.MODEL.line) === 1 ? '' : 's'} free on the tightest page (Type ${worst.type})${measured.length > 1 ? `, across all ${measured.length} types` : ''}.` };
}

// ── THE LOCK ───────────────────────────────────────────────────────────────────────────────
let chain = Promise.resolve();
function locked(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

/**
 * THE GATE, as the write routes call it. Reads the published set strictly, evaluates, and calls
 * `write()` — the real database mutator — ONLY when the page fits, all under the lock. Returns the
 * route's `{ ok, error }` shape.
 */
function guardedWrite(action, key, value, write, deps = defaultDeps()) {
  return locked(async () => {
    let published;
    try { published = await deps.loadPublishedStrict(); } catch (e) {
      return { ok: false, error: `${VERB[action].refused} — the live content could not be read (${e.message}), so the fit could not be checked. Nothing was saved.` };
    }
    const verdict = await evaluate(action, key, value, published, deps);
    if (!verdict.ok) return { ok: false, error: verdict.message, refused: true, verdict };
    const ok = await write();
    return { ok, error: ok ? undefined : 'database unavailable', verdict };
  });
}

/**
 * The CMS preview for a sheet 11 key: the page an editor's draft would produce, and the SAME verdict
 * the gate would give on publish — { ok, message }, the fields the preview modal already reads.
 */
async function preview(key, value, deps = defaultDeps()) {
  let published;
  try { published = await deps.loadPublishedStrict(); } catch (e) { published = null; }
  const errs = RULES.cmsErrors(key, value);
  const next = compose(published || new Map(), 'publish', key, value);
  const types = affectedTypes(key);
  // Measure every affected type, then picture the tightest — in one pass when there is only one type.
  const measured = await measure(next, types, deps, { shotType: types.length === 1 ? types[0] : null });
  const worst = measured.reduce((a, b) => (b.probe && (!a || b.probe.natural > a.probe.natural) ? b : a), null);
  const shot = worst.png ? worst : (await measure(next, [worst.type], deps, { shotType: worst.type }))[0];
  let fit;
  if (!published) fit = { ok: null, message: 'The live content could not be read, so this preview cannot say whether publishing would be allowed.' };
  else if (errs.length) fit = { ok: false, message: `Publishing this would be refused — ${errs[0]}.` };
  else {
    const reasons = measured.flatMap((x) => decide(x.probe, x.type));
    const free = DF.PAGE_PX - worst.probe.natural;
    fit = reasons.length
      ? { ok: false, message: `Publishing this would be refused — ${refusalMessage('publish', reasons).replace(/^Not published — /, '').replace(/ Nothing was saved\.$/, '')}` }
      : { ok: true, message: `Fits — ${Math.floor(free / DF.MODEL.line)} lines free on the tightest page (Type ${worst.type}). Shown: Type ${worst.type}.` };
  }
  return { png: shot.png, page: PAGE_LABEL, fit };
}

/**
 * THE BOOT-TIME AUDIT (decision D-B5). Renders all nine types under the LIVE published set and
 * reports any page that spills — the case neither CI (library only) nor the gate (edits only) can
 * see: a deploy bringing new library content under an old override. Logs, and calls `notify` once
 * when something spills. Never throws; never blocks.
 */
async function auditLive({ notify = null, log = console, deps = defaultDeps() } = {}) {
  try {
    const published = await deps.loadPublishedStrict();
    const measured = await measure(published, TYPES, deps);
    const reasons = measured.flatMap((x) => decide(x.probe, x.type)).filter((r) => r.kind !== 'unverified');
    const worst = measured.reduce((a, b) => (b.probe && (!a || b.probe.natural > a.probe.natural) ? b : a), null);
    const live = [...published.keys()].filter(isKey);
    if (!reasons.length) {
      log.log(`[sheet11-audit] ok — tightest page Type ${worst.type}, ${(DF.PAGE_PX - worst.probe.natural).toFixed(2)}px free; ${live.length} live sheet 11 override(s)`);
      return { ok: true, worst, live };
    }
    const summary = reasons.map((r) => r.text).join('; ');
    log.error(`[sheet11-audit] SHEET 11 DOES NOT FIT — ${summary}. Live sheet 11 overrides: ${live.join(', ') || 'none'}`);
    if (notify) {
      await notify({
        subject: `[Hive Warning] Sheet 11 spills — ${reasons.filter((r) => r.kind === 'spill').map((r) => `Type ${r.type}`).join(', ') || 'see body'}`,
        text: [
          'The Development Ideas page (sheet 11) no longer fits on one sheet with the content that is live now.',
          '', summary, '',
          `Live sheet 11 overrides: ${live.join(', ') || 'none'}`,
          'This usually means new library content met an older CMS edit. Revert or shorten the edit in the CMS.',
          `Checked at boot: ${new Date().toISOString()}`,
        ].join('\n'),
      });
    }
    return { ok: false, reasons, worst, live };
  } catch (e) {
    log.error(`[sheet11-audit] could not run: ${e.message}`);
    return { ok: null, error: e.message };
  }
}

module.exports = {
  isKey, affectedTypes, compose, decide, evaluate, guardedWrite, preview, auditLive, refusalMessage,
  gateApiResult, GATE_CLIENT, PAGE_LABEL,
  // For scripts/verify_devideas_fit.js, which drives the real gate with one collaborator swapped.
  defaultDeps,
};
