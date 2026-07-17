'use strict';

/**
 * events.js — Events Management System (PR14).
 *
 * Domain home for the `events` table and its registration/waitlist state machine. Replaces
 * the Eventbrite-sourced /coach/training (PR9). Structural sibling of resources.js.
 *
 * Caching model: the coach grid's BASE event list (static fields + venue join) is memoized
 * for 5 minutes and busted on any event mutation. Registration/waitlist STATE — live counts
 * and a coach's registered/waitlisted status — is NEVER cached; every read hits the DB so
 * SOLD OUT / Registered ✓ reflect reality immediately (build directive, Task 2/§coach grid).
 *
 * Concurrency: register/cancel run in a transaction that locks the event row (SELECT ... FOR
 * UPDATE) before the capacity check, so two coaches racing for the last seat can't both land
 * a registration. Single Railway replica, but the lock is correct regardless.
 */

const db = require('./db');

// Writable columns for create/update. Status flags (is_published/is_featured) come through the
// same whitelist so the admin form checkboxes round-trip; is_cancelled is owned by cancelEvent().
// cover_photo_path is written by updateEvent() after the sharp pipeline runs (needs the id first).
const FIELDS = [
  'title', 'category', 'event_type', 'cover_photo_path', 'description', 'facilitator_name',
  'facilitator_bio', 'starts_at', 'ends_at', 'timezone', 'icf_cce_core', 'icf_cce_resource',
  'price_cents', 'thrivecart_url', 'thrivecart_product_slug', 'capacity', 'registration_deadline',
  'zoom_url', 'async_url', 'venue_id', 'is_published', 'is_featured',
];

// ── Tier-2 base-list cache (5-min TTL) ─────────────────────────────────────────────
// Published, non-cancelled, upcoming events with their venue joined — the static shape the
// coach grid renders. Counts and coach status are layered on live by the caller.
let _gridCache = { data: null, fetchedAt: 0 };
const GRID_CACHE_TTL_MS = 5 * 60 * 1000;

function invalidateEventsCache() {
  _gridCache = { data: null, fetchedAt: 0 };
}

const VENUE_JOIN_COLS = `
  v.name AS venue_name, v.address AS venue_address, v.city AS venue_city,
  v.state AS venue_state, v.zip AS venue_zip, v.website_url AS venue_website_url`;

// ── Coach-facing reads ─────────────────────────────────────────────────────────────

/**
 * Base list for the coach grid: published, not cancelled, and upcoming (no start, or starts
 * in the future). Featured first, then soonest start. Memoized 5 min. Returns [] on DB error
 * (never caches a transient miss).
 */
async function getUpcomingEventsBase() {
  if (_gridCache.data && Date.now() - _gridCache.fetchedAt < GRID_CACHE_TTL_MS) {
    return _gridCache.data;
  }
  const r = await db.query(
    `SELECT e.*, ${VENUE_JOIN_COLS}
       FROM events e
       LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.is_published = true
        AND e.is_cancelled = false
        AND (e.starts_at IS NULL OR e.starts_at >= NOW())
      ORDER BY e.is_featured DESC, e.starts_at ASC NULLS LAST, e.id ASC`
  );
  if (!r || !r.rows) return [];
  _gridCache = { data: r.rows, fetchedAt: Date.now() };
  return r.rows;
}

/** One event + joined venue (any status) — for the coach detail modal and admin edit. */
async function getEventWithVenue(id) {
  if (!id) return null;
  const r = await db.query(
    `SELECT e.*, ${VENUE_JOIN_COLS}
       FROM events e LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.id = $1`, [id]);
  return (r && r.rows[0]) || null;
}

/** Raw event row by id (any status). */
async function getEventById(id) {
  if (!id) return null;
  const r = await db.query(`SELECT * FROM events WHERE id = $1`, [id]);
  return (r && r.rows[0]) || null;
}

/** Event whose ThriveCart product slug matches (webhook slug → event resolution), or null. */
async function getEventByProductSlug(slug) {
  if (!slug) return null;
  const r = await db.query(
    `SELECT * FROM events WHERE thrivecart_product_slug = $1 LIMIT 1`, [String(slug)]);
  return (r && r.rows[0]) || null;
}

// ── Live registration/waitlist state (NEVER cached) ─────────────────────────────────

/** Active registration count for one event. */
async function getRegistrationCount(eventId) {
  const r = await db.query(
    `SELECT COUNT(*)::int AS n FROM event_registrations WHERE event_id = $1`, [eventId]);
  return (r && r.rows[0] && r.rows[0].n) || 0;
}

/** Waitlist size for one event. */
async function getWaitlistCount(eventId) {
  const r = await db.query(
    `SELECT COUNT(*)::int AS n FROM event_waitlist WHERE event_id = $1`, [eventId]);
  return (r && r.rows[0] && r.rows[0].n) || 0;
}

/** { eventId: {reg, wait} } live counts for a set of events (one round-trip each). */
async function getCountsMap(eventIds) {
  const map = {};
  if (!eventIds || !eventIds.length) return map;
  const reg = await db.query(
    `SELECT event_id, COUNT(*)::int AS n FROM event_registrations
      WHERE event_id = ANY($1::int[]) GROUP BY event_id`, [eventIds]);
  const wl = await db.query(
    `SELECT event_id, COUNT(*)::int AS n FROM event_waitlist
      WHERE event_id = ANY($1::int[]) GROUP BY event_id`, [eventIds]);
  for (const id of eventIds) map[id] = { reg: 0, wait: 0 };
  (reg.rows || []).forEach(row => { map[row.event_id].reg = row.n; });
  (wl.rows || []).forEach(row => { map[row.event_id].wait = row.n; });
  return map;
}

/** 'registered' | 'waitlisted' | null for one coach on one event. */
async function getCoachStatus(eventId, coachId) {
  if (!coachId) return null;
  const reg = await db.query(
    `SELECT 1 FROM event_registrations WHERE event_id = $1 AND coach_id = $2`, [eventId, coachId]);
  if (reg && reg.rows.length) return 'registered';
  const wl = await db.query(
    `SELECT 1 FROM event_waitlist WHERE event_id = $1 AND coach_id = $2`, [eventId, coachId]);
  if (wl && wl.rows.length) return 'waitlisted';
  return null;
}

/** { eventId: 'registered' | 'waitlisted' } for a coach across many events (grid batch). */
async function getCoachStatusMap(coachId, eventIds) {
  const map = {};
  if (!coachId || !eventIds || !eventIds.length) return map;
  const reg = await db.query(
    `SELECT event_id FROM event_registrations WHERE coach_id = $1 AND event_id = ANY($2::int[])`,
    [coachId, eventIds]);
  (reg.rows || []).forEach(row => { map[row.event_id] = 'registered'; });
  const wl = await db.query(
    `SELECT event_id FROM event_waitlist WHERE coach_id = $1 AND event_id = ANY($2::int[])`,
    [coachId, eventIds]);
  (wl.rows || []).forEach(row => { if (!map[row.event_id]) map[row.event_id] = 'waitlisted'; });
  return map;
}

// ── Registration state machine ──────────────────────────────────────────────────────

// A paid payment-offer holds a freed seat for 24 hours; after that it lapses and the seat is
// re-offered to the next waitlister (CP-5 follow-up, ratified).
const OFFER_WINDOW_HOURS = 24;

/**
 * Offer as many open paid seats as are actually available to the next eligible waitlisters, under
 * a caller-held event lock. Enforces the invariant: active offers ≤ free seats, so one open seat
 * is never promised to two coaches. Selection prefers never-offered coaches, then previously-lapsed
 * ones, FIFO within each — so a lapsed offer keeps its place in line and is only re-offered once
 * everyone ahead has had a turn. Returns the coach_ids newly offered (for the caller to email).
 */
async function _offerOpenPaidSeats(client, eventId, capacity) {
  if (capacity == null) return [];   // uncapped events never sell out → never waitlist
  const regs = (await client.query(
    `SELECT COUNT(*)::int AS n FROM event_registrations WHERE event_id = $1`, [eventId])).rows[0].n;
  const active = (await client.query(
    `SELECT COUNT(*)::int AS n FROM event_waitlist WHERE event_id = $1 AND payment_offered_at IS NOT NULL`, [eventId])).rows[0].n;
  let offerable = (capacity - regs) - active;
  const offered = [];
  while (offerable > 0) {
    const next = await client.query(
      `SELECT id, coach_id FROM event_waitlist
        WHERE event_id = $1 AND payment_offered_at IS NULL
        ORDER BY (offer_expired_at IS NOT NULL) ASC, waitlisted_at ASC, id ASC LIMIT 1`, [eventId]);
    if (!next.rows.length) break;
    // Fresh 24h window; clear any prior lapse marker so a re-offer starts clean.
    await client.query(
      `UPDATE event_waitlist SET payment_offered_at = NOW(), offer_expired_at = NULL WHERE id = $1`,
      [next.rows[0].id]);
    offered.push(next.rows[0].coach_id);
    offerable--;
  }
  return offered;
}

/**
 * Register a coach for an event. Capacity-checked under a row lock: over capacity → waitlist.
 * opts.purchaseReference (ThriveCart order_id) makes the write idempotent for the paid webhook.
 * Returns { status }: 'registered' | 'waitlisted' | 'already_registered' | 'already_waitlisted'
 * | 'already_processed' | 'space_available' | 'waitlisted_paid_full' | 'waitlisted_paid_late'
 * | 'closed' | 'cancelled' | 'not_found'. opts.waitlistOnly (paid Join-Waitlist), opts.purchaseReference.
 */
async function registerCoach(eventId, coachId, opts = {}) {
  const purchaseReference = opts.purchaseReference || null;
  // waitlistOnly: the paid "Join Waitlist" path — a paid sold-out event lets a coach onto the
  // waitlist for FREE (no charge), never granting a registration here. If a seat has opened in
  // the meantime we send them to checkout instead (status 'space_available').
  const waitlistOnly = opts.waitlistOnly === true;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the event row so concurrent registrations serialize on the capacity check.
    const evRes = await client.query(
      `SELECT id, capacity, is_cancelled, registration_deadline
         FROM events WHERE id = $1 FOR UPDATE`, [eventId]);
    const ev = evRes.rows[0];
    if (!ev) { await client.query('ROLLBACK'); return { status: 'not_found' }; }
    if (ev.is_cancelled) { await client.query('ROLLBACK'); return { status: 'cancelled' }; }
    if (ev.registration_deadline && new Date(ev.registration_deadline) < new Date()) {
      await client.query('ROLLBACK'); return { status: 'closed' };
    }
    // Idempotency guard for the paid webhook: this order already produced a row.
    if (purchaseReference) {
      const dup = await client.query(
        `SELECT 1 FROM event_registrations WHERE purchase_reference = $1
          UNION ALL
         SELECT 1 FROM event_waitlist WHERE purchase_reference = $1 LIMIT 1`, [purchaseReference]);
      if (dup.rows.length) { await client.query('ROLLBACK'); return { status: 'already_processed' }; }
    }
    // Live capacity (NULL capacity = uncapped). Computed before the waitlist branch because the
    // paid-promotion decision depends on whether a seat is actually open.
    let atCapacity = false;
    if (ev.capacity != null) {
      const cnt = await client.query(
        `SELECT COUNT(*)::int AS n FROM event_registrations WHERE event_id = $1`, [eventId]);
      atCapacity = cnt.rows[0].n >= ev.capacity;
    }
    // Already registered?
    const existReg = await client.query(
      `SELECT 1 FROM event_registrations WHERE event_id = $1 AND coach_id = $2`, [eventId, coachId]);
    if (existReg.rows.length) { await client.query('ROLLBACK'); return { status: 'already_registered' }; }
    // Already on the waitlist? This is where pay-on-promotion resolves: a coach who joined the
    // free waitlist for a paid event and has now paid (purchaseReference set by the webhook) is
    // moved into the open seat.
    const existWl = await client.query(
      `SELECT id, offer_expired_at FROM event_waitlist WHERE event_id = $1 AND coach_id = $2`, [eventId, coachId]);
    if (existWl.rows.length) {
      const wl = existWl.rows[0];
      if (purchaseReference && !atCapacity) {
        // Payment claims an open seat — register them (covers both an in-window offer and a LATE
        // payment whose offer had lapsed but a seat is free again, decision B).
        await client.query(`DELETE FROM event_waitlist WHERE id = $1`, [wl.id]);
        await client.query(
          `INSERT INTO event_registrations (event_id, coach_id, purchase_reference) VALUES ($1, $2, $3)`,
          [eventId, coachId, purchaseReference]);
        await client.query('COMMIT');
        return { status: 'registered', promotedFromWaitlist: true };
      }
      if (purchaseReference && atCapacity) {
        // Paid but no seat is free — keep them waitlisted, record the order (retry-idempotent);
        // refund is handled MANUALLY (CP-5). Distinguish a LATE payment (their offer had lapsed)
        // from a plain over-capacity payment so the log line is greppable.
        await client.query(`UPDATE event_waitlist SET purchase_reference = $1 WHERE id = $2`, [purchaseReference, wl.id]);
        await client.query('COMMIT');
        return { status: wl.offer_expired_at ? 'waitlisted_paid_late' : 'waitlisted_paid_full' };
      }
      await client.query('ROLLBACK');
      return { status: 'already_waitlisted' };
    }
    // Not in any state yet.
    if (waitlistOnly && !atCapacity) {
      // Paid "Join Waitlist" but a seat opened — don't grant a free registration; send to checkout.
      await client.query('ROLLBACK');
      return { status: 'space_available' };
    }
    if (atCapacity || waitlistOnly) {
      await client.query(
        `INSERT INTO event_waitlist (event_id, coach_id, purchase_reference) VALUES ($1, $2, $3)`,
        [eventId, coachId, purchaseReference]);
      await client.query('COMMIT');
      return { status: 'waitlisted' };
    }
    await client.query(
      `INSERT INTO event_registrations (event_id, coach_id, purchase_reference) VALUES ($1, $2, $3)`,
      [eventId, coachId, purchaseReference]);
    await client.query('COMMIT');
    return { status: 'registered' };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Coach self-cancels their registration, opening a seat. Promotion depends on the event's price:
 *  - FREE event  → auto-promote the FIFO head into the seat (returns promotedCoachId).
 *  - PAID event  → offer the seat to the oldest not-yet-offered waitlister by emailing a checkout
 *                  link (returns paymentOfferedCoachId); they are registered only once the paid
 *                  webhook confirms payment. Nobody is auto-registered for free (CP-5, ratified).
 * Returns { status, promotedCoachId, paymentOfferedCoachIds[] }. status: 'cancelled' | 'not_registered'.
 */
async function cancelRegistration(eventId, coachId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const evRes = await client.query(`SELECT id, price_cents, capacity FROM events WHERE id = $1 FOR UPDATE`, [eventId]);
    const ev = evRes.rows[0];
    const del = await client.query(
      `DELETE FROM event_registrations WHERE event_id = $1 AND coach_id = $2 RETURNING id`,
      [eventId, coachId]);
    if (!del.rows.length) { await client.query('ROLLBACK'); return { status: 'not_registered' }; }

    const isPaid = ev && Number(ev.price_cents || 0) > 0;
    let promotedCoachId = null;
    let paymentOfferedCoachIds = [];

    if (isPaid) {
      // Offer the freed seat(s) to the next eligible waitlister(s) — the shared helper enforces
      // active-offers ≤ free-seats, so the newly opened seat is offered to exactly one coach.
      paymentOfferedCoachIds = await _offerOpenPaidSeats(client, eventId, ev.capacity);
    } else {
      // Free event: auto-promote the FIFO head into the seat.
      const head = await client.query(
        `SELECT id, coach_id, purchase_reference FROM event_waitlist
          WHERE event_id = $1 ORDER BY waitlisted_at ASC, id ASC LIMIT 1`, [eventId]);
      if (head.rows.length) {
        const w = head.rows[0];
        await client.query(`DELETE FROM event_waitlist WHERE id = $1`, [w.id]);
        await client.query(
          `INSERT INTO event_registrations (event_id, coach_id, purchase_reference) VALUES ($1, $2, $3)`,
          [eventId, w.coach_id, w.purchase_reference]);
        promotedCoachId = w.coach_id;
      }
    }
    await client.query('COMMIT');
    return { status: 'cancelled', promotedCoachId, paymentOfferedCoachIds };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Sweep paid payment-offers older than the 24h window: mark them lapsed (offer_expired_at, releasing
 * the held seat while leaving the coach on the waitlist in place), then re-offer the freed seat(s) to
 * the next eligible waitlister(s). Idempotent — a coach freshly offered here is < 24h old so the next
 * hourly tick skips them, and _offerOpenPaidSeats never over-offers. Returns [{ eventId, offeredCoachIds }]
 * for the caller to email. Driven by the existing hourly waitlist-expiry cron (no new job).
 */
async function sweepExpiredPaidOffers() {
  const evRows = await db.query(
    `SELECT DISTINCT ew.event_id
       FROM event_waitlist ew JOIN events e ON e.id = ew.event_id
      WHERE ew.payment_offered_at IS NOT NULL
        AND ew.payment_offered_at < NOW() - ($1 || ' hours')::interval
        AND e.is_cancelled = false`, [String(OFFER_WINDOW_HOURS)]);
  const results = [];
  for (const row of (evRows.rows || [])) {
    const eventId = row.event_id;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const evLock = await client.query(`SELECT capacity FROM events WHERE id = $1 FOR UPDATE`, [eventId]);
      if (!evLock.rows.length) { await client.query('ROLLBACK'); continue; }
      // Lapse every overdue offer on this event (releases their held seats; keeps them waitlisted).
      await client.query(
        `UPDATE event_waitlist SET offer_expired_at = NOW(), payment_offered_at = NULL
          WHERE event_id = $1 AND payment_offered_at IS NOT NULL
            AND payment_offered_at < NOW() - ($2 || ' hours')::interval`,
        [eventId, String(OFFER_WINDOW_HOURS)]);
      const offered = await _offerOpenPaidSeats(client, eventId, evLock.rows[0].capacity);
      await client.query('COMMIT');
      if (offered.length) results.push({ eventId, offeredCoachIds: offered });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[events] paid offer-expiry sweep failed for event', eventId, '—', e.message);
    } finally {
      client.release();
    }
  }
  return results;
}

// ── Admin CRUD ──────────────────────────────────────────────────────────────────────

/** All events (past, unpublished, cancelled), newest start first — admin list. */
async function listEventsAdmin() {
  const r = await db.query(
    `SELECT e.*, v.name AS venue_name,
            (SELECT COUNT(*)::int FROM event_registrations er WHERE er.event_id = e.id) AS reg_count,
            (SELECT COUNT(*)::int FROM event_waitlist ew WHERE ew.event_id = e.id) AS wait_count
       FROM events e LEFT JOIN venues v ON v.id = e.venue_id
      ORDER BY e.starts_at DESC NULLS LAST, e.id DESC`);
  return (r && r.rows) || [];
}

/** Create an event from whitelisted fields. Returns the new id. Busts the grid cache. */
async function createEvent(fields) {
  const cols = FIELDS.filter(f => fields[f] !== undefined);
  const vals = cols.map(f => fields[f]);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const r = await db.query(
    `INSERT INTO events (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`, vals);
  invalidateEventsCache();
  return r.rows[0].id;
}

/** Update whitelisted fields on an event. updated_at maintained by trigger. Busts cache. */
async function updateEvent(id, fields) {
  const cols = FIELDS.filter(f => fields[f] !== undefined);
  if (!cols.length) return false;
  const sets = cols.map((f, i) => `${f} = $${i + 1}`);
  const params = [...cols.map(f => fields[f]), id];
  const r = await db.query(
    `UPDATE events SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  invalidateEventsCache();
  return !!(r && r.rowCount > 0);
}

/** Set is_published. Busts cache. */
async function setPublished(id, published) {
  const r = await db.query(`UPDATE events SET is_published = $1 WHERE id = $2`, [!!published, id]);
  invalidateEventsCache();
  return !!(r && r.rowCount > 0);
}

/** Set is_featured. Busts cache. */
async function setFeatured(id, featured) {
  const r = await db.query(`UPDATE events SET is_featured = $1 WHERE id = $2`, [!!featured, id]);
  invalidateEventsCache();
  return !!(r && r.rowCount > 0);
}

/**
 * Cancel an event: set is_cancelled = true (keeps the row + registrations/waitlist for history
 * and the fan-out email). Returns the distinct list of affected coaches (registrants + waitlist)
 * as { coach_id, name, email } for email #7. Does NOT delete anything.
 */
async function cancelEvent(id) {
  await db.query(`UPDATE events SET is_cancelled = true WHERE id = $1`, [id]);
  invalidateEventsCache();
  const r = await db.query(
    `SELECT DISTINCT c.id AS coach_id, c.name, c.email
       FROM coaches c
      WHERE c.id IN (SELECT coach_id FROM event_registrations WHERE event_id = $1)
         OR c.id IN (SELECT coach_id FROM event_waitlist       WHERE event_id = $1)`, [id]);
  return (r && r.rows) || [];
}

/**
 * Hard-delete an event (CASCADE removes registrations/waitlist). Guarded: only proceeds when
 * there are zero registrations. Returns { deleted, blockedByRegistrations }.
 */
async function hardDeleteEvent(id) {
  const cnt = await getRegistrationCount(id);
  if (cnt > 0) return { deleted: false, blockedByRegistrations: cnt };
  const r = await db.query(`DELETE FROM events WHERE id = $1`, [id]);
  invalidateEventsCache();
  return { deleted: !!(r && r.rowCount > 0), blockedByRegistrations: 0 };
}

// ── Admin registration/waitlist listings (per-event) ─────────────────────────────────

/** Active registrations for an event with coach name/email, registration order. */
async function listRegistrations(eventId) {
  const r = await db.query(
    `SELECT er.id, er.coach_id, er.registered_at, er.purchase_reference, c.name, c.email
       FROM event_registrations er JOIN coaches c ON c.id = er.coach_id
      WHERE er.event_id = $1 ORDER BY er.registered_at ASC, er.id ASC`, [eventId]);
  return (r && r.rows) || [];
}

/** Waitlist for an event, FIFO order, with coach name/email. */
async function listWaitlist(eventId) {
  const r = await db.query(
    `SELECT ew.id, ew.coach_id, ew.waitlisted_at, ew.purchase_reference, c.name, c.email
       FROM event_waitlist ew JOIN coaches c ON c.id = ew.coach_id
      WHERE ew.event_id = $1 ORDER BY ew.waitlisted_at ASC, ew.id ASC`, [eventId]);
  return (r && r.rows) || [];
}

// ── Scheduled-job queries (CP-1) ──────────────────────────────────────────────────────

/**
 * Registrations due a 48-hour reminder: published, non-cancelled events starting within the
 * next 48h, whose registration has not yet been reminded. "within 48h AND reminder_sent_at
 * IS NULL" (rather than a tight 47–48h band) makes a missed hourly tick self-heal on the next
 * run and still sends at most once. Returns rows with the event + coach fields the email needs.
 */
async function findRegistrationsNeedingReminder() {
  const r = await db.query(
    `SELECT er.id AS registration_id, er.coach_id, c.name AS coach_name, c.email AS coach_email,
            e.id AS event_id, e.title, e.event_type, e.starts_at, e.ends_at, e.timezone,
            e.zoom_url, e.async_url, e.description,
            v.name AS venue_name, v.address AS venue_address, v.city AS venue_city,
            v.state AS venue_state, v.zip AS venue_zip
       FROM event_registrations er
       JOIN events e  ON e.id = er.event_id
       JOIN coaches c ON c.id = er.coach_id
       LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.is_published = true AND e.is_cancelled = false
        AND e.starts_at IS NOT NULL
        AND e.starts_at BETWEEN NOW() AND NOW() + INTERVAL '48 hours'
        AND er.reminder_sent_at IS NULL`);
  return (r && r.rows) || [];
}

/** Stamp a registration as reminded (dedupe). */
async function markReminderSent(registrationId) {
  await db.query(`UPDATE event_registrations SET reminder_sent_at = NOW() WHERE id = $1`, [registrationId]);
}

/**
 * Waitlist entries due a 24-hour expiry notice: still-waitlisted coaches on published,
 * non-cancelled events starting within 24h, not yet notified. Same "within window + null guard"
 * shape as the reminder query.
 */
async function findWaitlistNeedingExpiry() {
  const r = await db.query(
    `SELECT ew.id AS waitlist_id, ew.coach_id, c.name AS coach_name, c.email AS coach_email,
            e.id AS event_id, e.title, e.starts_at, e.timezone
       FROM event_waitlist ew
       JOIN events e  ON e.id = ew.event_id
       JOIN coaches c ON c.id = ew.coach_id
      WHERE e.is_published = true AND e.is_cancelled = false
        AND e.starts_at IS NOT NULL
        AND e.starts_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
        AND ew.expiry_notified_at IS NULL`);
  return (r && r.rows) || [];
}

/** Stamp a waitlist entry as expiry-notified (dedupe). */
async function markExpiryNotified(waitlistId) {
  await db.query(`UPDATE event_waitlist SET expiry_notified_at = NOW() WHERE id = $1`, [waitlistId]);
}

module.exports = {
  invalidateEventsCache,
  // coach reads
  getUpcomingEventsBase, getEventWithVenue, getEventById, getEventByProductSlug,
  // live state
  getRegistrationCount, getWaitlistCount, getCountsMap, getCoachStatus, getCoachStatusMap,
  // state machine
  registerCoach, cancelRegistration, sweepExpiredPaidOffers,
  // admin CRUD
  listEventsAdmin, createEvent, updateEvent, setPublished, setFeatured, cancelEvent, hardDeleteEvent,
  listRegistrations, listWaitlist,
  // scheduled jobs
  findRegistrationsNeedingReminder, markReminderSent, findWaitlistNeedingExpiry, markExpiryNotified,
};
