'use strict';
/**
 * cms_write.js — the three CMS write routes: save draft, publish, revert (PR 6 Build B2, decision B2-1).
 *
 * MOVED OUT OF app/server.js so they can be tested. server.js calls app.listen() at require time, so
 * nothing in it can be loaded by a test, and before this move the only proof that sheet 11's gate sat
 * on these routes would have been a person clicking through the admin UI. Here, CI drives the real
 * handlers with a fake database: a refused edit never reaches the write, an allowed one reaches it
 * exactly once, and every other key behaves exactly as it did in server.js. server.js keeps one
 * mounting line per route, which tests/cms_devideas_test.js asserts by reading the source.
 *
 * FOR EVERY KEY BUT SHEET 11'S, THE BEHAVIOUR IS THE OLD ROUTE BODY, VERBATIM: the same key check,
 * the same `missing value` 400, the same mutator call, the same `{ ok, error }` reply. Sheet 11's four
 * keys go through app/cms_devideas.js guardedWrite, which calls the same mutator only when the page
 * still fits — for all three actions, because a draft save and a revert change the live page too
 * (decision D-B3).
 *
 * Dependencies are injected so the handlers never reach for server.js's globals.
 */

function makeWriteHandlers({ contentOverrides, isValidKey, wordCount, guard }) {
  // The gate's reply for a sheet 11 key. A throw inside the gate refuses rather than 500s — a write
  // that could not be checked is not a write that happened.
  const viaGate = async (res, action, key, value, write) => {
    let r;
    try { r = await guard.guardedWrite(action, key, value, write); } catch (e) {
      r = { ok: false, error: `Not saved — the fit could not be checked (${e.message}). Nothing was saved.` };
    }
    return res.json({ ok: r.ok, error: r.ok ? undefined : r.error });
  };

  async function draft(req, res) {
    const { content_key, value } = req.body || {};
    if (!isValidKey(content_key)) return res.status(400).json({ ok: false, error: 'invalid content_key' });
    if (value === undefined) return res.status(400).json({ ok: false, error: 'missing value' });
    const write = () => contentOverrides.saveDraftOverride(content_key, value, wordCount(value), req.session.coach_id);
    if (guard.isKey(content_key)) return viaGate(res, 'draft', content_key, value, write);
    const ok = await write();
    res.json({ ok, error: ok ? undefined : 'database unavailable' });
  }

  async function publish(req, res) {
    const { content_key, value } = req.body || {};
    if (!isValidKey(content_key)) return res.status(400).json({ ok: false, error: 'invalid content_key' });
    if (value === undefined) return res.status(400).json({ ok: false, error: 'missing value' });
    const write = () => contentOverrides.publishOverride(content_key, value, wordCount(value), req.session.coach_id);
    if (guard.isKey(content_key)) return viaGate(res, 'publish', content_key, value, write);
    const ok = await write();
    res.json({ ok, error: ok ? undefined : 'database unavailable' });
  }

  async function revert(req, res) {
    const { content_key } = req.body || {};
    if (!isValidKey(content_key)) return res.status(400).json({ ok: false, error: 'invalid content_key' });
    const write = () => contentOverrides.revertOverride(content_key);
    if (guard.isKey(content_key)) return viaGate(res, 'revert', content_key, undefined, write);
    const ok = await write();
    res.json({ ok, error: ok ? undefined : 'database unavailable' });
  }

  return { draft, publish, revert };
}

module.exports = { makeWriteHandlers };
