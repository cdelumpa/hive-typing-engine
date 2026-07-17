'use strict';

/**
 * event_emails.js — Transactional + scheduled email for the Events system (PR14).
 *
 * ONE shared sender (sendEmail) centralizes the SENDGRID_API_KEY / SENDGRID_FROM_EMAIL guard
 * clauses and the from object that every existing server.js sender already uses. The 7 event
 * emails below all route through it. The 8 pre-existing bespoke senders in server.js are left
 * untouched (build directive) — this module is purely additive.
 *
 * @sendgrid/mail is a singleton: server.js calls sgMail.setApiKey() at boot, and require()
 * returns that same configured instance here, so sends work at request time.
 *
 * .ics files are hand-generated (no npm package) — a ~15-line VCALENDAR/VEVENT string.
 */

const sgMail = require('@sendgrid/mail');

const FROM = () => ({ name: 'InsightOut by Hive', email: process.env.SENDGRID_FROM_EMAIL });
const PORTAL_URL = () => (process.env.RAILWAY_PUBLIC_URL || 'https://enneagram.hiveleadership.com');
const TRAINING_URL = () => PORTAL_URL() + '/coach/training';

// Brand palette (matches the existing server.js email templates).
const ORANGE = '#f58527';
const CYAN = '#00b1d7';
const INK = '#1A2B33';
const MUTE = '#7A96A6';
const RULE = '#EFE8E0';

// ── HTML escape (email bodies) ──────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Shared sender ─────────────────────────────────────────────────────────────────
/**
 * sendEmail({ to, subject, html, attachments }). Throws if SendGrid is unconfigured (callers
 * catch and log — a failed event email must never break the registration write that preceded it).
 */
async function sendEmail({ to, subject, html, attachments }) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('[event-email] SENDGRID_API_KEY is not set — email not sent');
  }
  if (!process.env.SENDGRID_FROM_EMAIL) {
    throw new Error('[event-email] SENDGRID_FROM_EMAIL is not set — email not sent');
  }
  const msg = { to, from: FROM(), subject, html };
  if (attachments && attachments.length) msg.attachments = attachments;
  return sgMail.send(msg);
}

// ── Date formatting (DST-accurate, IANA tz) ───────────────────────────────────────
// Same Intl approach as server.js formatEventDate, kept local so this module stands alone.
function fmtDateTime(startsAt, timezone) {
  if (!startsAt) return 'Date to be announced';
  try {
    const d = new Date(startsAt);
    if (isNaN(d.getTime())) throw new Error('bad date');
    const tz = timezone || undefined;
    const datePart = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }).format(d);
    const timePart = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(d);
    let tzAbbr = '';
    if (tz) {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', timeZoneName: 'short' }).formatToParts(d);
      tzAbbr = (parts.find(p => p.type === 'timeZoneName') || {}).value || '';
    }
    return `${datePart} · ${timePart}${tzAbbr ? ' ' + tzAbbr : ''}`;
  } catch (e) {
    return String(startsAt);
  }
}

// Location string for email bodies (Zoom link handled separately, never inlined here for cards).
function locationLine(ev) {
  if (ev.event_type === 'virtual_live') return 'Online via Zoom';
  if (ev.event_type === 'virtual_async') return 'Online — watch anytime';
  const parts = [ev.venue_name, ev.venue_address,
    [ev.venue_city, ev.venue_state].filter(Boolean).join(', '), ev.venue_zip].filter(Boolean);
  return parts.length ? parts.join(', ') : 'In person';
}

// ── .ics builder ──────────────────────────────────────────────────────────────────
// Escape TEXT per RFC 5545 (backslash, comma, semicolon, newline).
function icsEscape(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
// JS Date → 'YYYYMMDDTHHMMSSZ' (UTC). A fixed reference DTSTAMP is passed in by the caller to
// keep output deterministic; where none is given we derive it from the event start.
function icsUtc(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/**
 * Build a one-event .ics string. ev needs { id, title, starts_at, ends_at, timezone, description }
 * plus venue_* for LOCATION. coachId scopes the UID so each attendee's file is distinct.
 * DTEND defaults to start + 1h when ends_at is null.
 */
function buildEventIcs(ev, coachId) {
  const start = new Date(ev.starts_at);
  const end = ev.ends_at ? new Date(ev.ends_at) : new Date(start.getTime() + 60 * 60 * 1000);
  const stamp = start; // deterministic; avoids Date.now() (unavailable in some runtimes)
  const uid = `event-${ev.id}-coach-${coachId || 0}@insightout.hiveleadership.com`;
  const loc = ev.event_type === 'virtual_live' ? 'Online via Zoom'
    : ev.event_type === 'virtual_async' ? 'Online'
    : locationLine(ev);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hive Leadership//InsightOut Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsUtc(stamp)}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `DESCRIPTION:${icsEscape((ev.description || '').slice(0, 500))}`,
    `LOCATION:${icsEscape(loc)}`,
    `URL:${icsEscape(TRAINING_URL())}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

function icsAttachment(ev, coachId) {
  return {
    content: Buffer.from(buildEventIcs(ev, coachId)).toString('base64'),
    filename: 'event.ics',
    type: 'text/calendar',
    disposition: 'attachment',
  };
}

// ── Shared HTML shell ─────────────────────────────────────────────────────────────
function shell(headline, innerHtml) {
  return `
  <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: ${INK}; line-height: 1.7;">
    <div style="border-top: 4px solid ${ORANGE}; padding-top: 28px; margin-bottom: 20px;">
      <h1 style="font-size: 22px; color: ${ORANGE}; margin: 0; font-weight: 700;">${esc(headline)}</h1>
    </div>
    ${innerHtml}
    <p style="margin-top: 28px; font-size: 12px; color: ${MUTE};">
      InsightOut by Hive · <a href="${esc(TRAINING_URL())}" style="color:${CYAN};">View in the coach portal</a>
    </p>
  </div>`;
}

// Event summary table used across confirmation-style emails.
function summaryTable(ev, extraRows = []) {
  const row = (label, val) => `
    <tr style="border-bottom: 1px solid ${RULE};">
      <td style="padding: 8px 0; color: ${MUTE}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; width: 34%; vertical-align: top;">${esc(label)}</td>
      <td style="padding: 8px 0; font-weight: 600;">${val}</td>
    </tr>`;
  const rows = [
    row('Event', esc(ev.title)),
    row('When', esc(fmtDateTime(ev.starts_at, ev.timezone))),
    row('Where', esc(locationLine(ev))),
    ...extraRows,
  ].join('');
  return `<table style="width: 100%; border-collapse: collapse; margin: 8px 0 20px; font-size: 14px;">${rows}</table>`;
}

// A prominent link row (Zoom / async), rendered only when a URL is present.
function linkRow(label, url) {
  if (!url) return '';
  return `<p style="margin: 4px 0 16px; font-size: 14px;">
    <strong style="color:${MUTE};font-size:11px;text-transform:uppercase;letter-spacing:.05em;">${esc(label)}:</strong><br>
    <a href="${esc(url)}" style="color:${CYAN}; word-break: break-all;">${esc(url)}</a></p>`;
}

// ── The 7 event emails ────────────────────────────────────────────────────────────
// Each takes { event, coach } (coach = { name, email, coach_id }) plus type-specific extras.

/** #1 Registration confirmation — + .ics; Zoom link (virtual_live) / async link (virtual_async). */
async function sendRegistrationConfirmation({ event, coach }) {
  const extras = [];
  if (event.event_type === 'virtual_live' && event.zoom_url) extras.push(linkRow('Zoom link', event.zoom_url));
  if (event.event_type === 'virtual_async' && event.async_url) extras.push(linkRow('Watch here', event.async_url));
  const inner = `
    <p>Hi ${esc(firstName(coach.name))},</p>
    <p>You're registered. Here are the details:</p>
    ${summaryTable(event)}
    ${extras.join('')}
    <p>We've attached a calendar file so you can add it to your calendar in one click.</p>`;
  return sendEmail({
    to: coach.email,
    subject: `You're registered: ${event.title}`,
    html: shell("You're registered", inner),
    attachments: [icsAttachment(event, coach.coach_id)],
  });
}

/** #2 48-hour reminder — same content as confirmation (+ .ics). */
async function sendReminder({ event, coach }) {
  const extras = [];
  if (event.event_type === 'virtual_live' && event.zoom_url) extras.push(linkRow('Zoom link', event.zoom_url));
  if (event.event_type === 'virtual_async' && event.async_url) extras.push(linkRow('Watch here', event.async_url));
  const inner = `
    <p>Hi ${esc(firstName(coach.name))},</p>
    <p>A quick reminder — this is coming up soon:</p>
    ${summaryTable(event)}
    ${extras.join('')}`;
  return sendEmail({
    to: coach.email,
    subject: `Tomorrow: ${event.title}`,
    html: shell('Coming up soon', inner),
    attachments: [icsAttachment(event, coach.coach_id)],
  });
}

/** #3 Waitlist confirmation — includes waitlist position when known. */
async function sendWaitlistConfirmation({ event, coach, position }) {
  const posRow = position
    ? [`<tr style="border-bottom:1px solid ${RULE};"><td style="padding:8px 0;color:${MUTE};font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;">Your position</td><td style="padding:8px 0;font-weight:600;">#${esc(position)} on the waitlist</td></tr>`]
    : [];
  const inner = `
    <p>Hi ${esc(firstName(coach.name))},</p>
    <p>This event is currently full, so we've added you to the waitlist. If a spot opens up, we'll move you in automatically and email you right away.</p>
    ${summaryTable(event, posRow)}`;
  return sendEmail({
    to: coach.email,
    subject: `You're on the waitlist: ${event.title}`,
    html: shell("You're on the waitlist", inner),
  });
}

/** #4 Waitlist promotion (immediate) — + .ics, same content as confirmation. */
async function sendWaitlistPromotion({ event, coach }) {
  const extras = [];
  if (event.event_type === 'virtual_live' && event.zoom_url) extras.push(linkRow('Zoom link', event.zoom_url));
  if (event.event_type === 'virtual_async' && event.async_url) extras.push(linkRow('Watch here', event.async_url));
  const inner = `
    <p>Hi ${esc(firstName(coach.name))},</p>
    <p>Good news — a spot opened up and <strong>you're in</strong>. Your registration is confirmed:</p>
    ${summaryTable(event)}
    ${extras.join('')}
    <p>We've attached a calendar file so you can add it to your calendar in one click.</p>`;
  return sendEmail({
    to: coach.email,
    subject: `You're in! ${event.title}`,
    html: shell("You're in!", inner),
    attachments: [icsAttachment(event, coach.coach_id)],
  });
}

/** #4b Waitlist payment offer — PAID events: a seat opened, complete checkout to claim it (CP-5). */
async function sendWaitlistPaymentOffer({ event, coach }) {
  const priceCents = Number(event.price_cents || 0);
  const price = priceCents > 0 ? '$' + (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2) : '';
  const base = event.thrivecart_url || TRAINING_URL();
  const url = event.thrivecart_url
    ? base + (base.includes('?') ? '&' : '?') + 'customer_email=' + encodeURIComponent(coach.email || '')
    : base;
  const inner = `
    <p>Hi ${esc(firstName(coach.name))},</p>
    <p>Good news — a spot just opened up for this event and you're next on the waitlist. To claim it, complete your registration${price ? ` (${esc(price)})` : ''} at the link below:</p>
    ${summaryTable(event)}
    <p style="margin: 8px 0 20px;">
      <a href="${esc(url)}" style="display:inline-block; background:${CYAN}; color:#fff; text-decoration:none; font-weight:700; padding:12px 22px; border-radius:6px;">Complete registration &rarr;</a>
    </p>
    <p style="font-size:13px; color:${INK};"><strong>Please complete payment within 24 hours to claim your spot.</strong> After that the spot is released to the next person on the waitlist. Once you pay, your seat is confirmed automatically.</p>`;
  return sendEmail({
    to: coach.email,
    subject: `A spot opened up: ${event.title}`,
    html: shell('A spot just opened up', inner),
  });
}

/** #5 Waitlist expiry — sent ~24h before to coaches still waitlisted, not promoted. */
async function sendWaitlistExpiry({ event, coach }) {
  const inner = `
    <p>Hi ${esc(firstName(coach.name))},</p>
    <p>Unfortunately we weren't able to move you off the waitlist for this event. We're sorry to miss you this time — keep an eye on the portal for future dates.</p>
    ${summaryTable(event)}`;
  return sendEmail({
    to: coach.email,
    subject: `Update on ${event.title}`,
    html: shell('An update on your waitlist', inner),
  });
}

/** #6 Registration cancellation confirmation — to the coach who self-cancels. */
async function sendRegistrationCancellation({ event, coach }) {
  const inner = `
    <p>Hi ${esc(firstName(coach.name))},</p>
    <p>Your registration has been cancelled. You're all set — no further action needed.</p>
    ${summaryTable(event)}
    <p>Changed your mind? You can register again any time from the coach portal.</p>`;
  return sendEmail({
    to: coach.email,
    subject: `Registration cancelled: ${event.title}`,
    html: shell('Registration cancelled', inner),
  });
}

/** #7 Event cancellation — to all registrants + waitlisted coaches when an admin cancels. */
async function sendEventCancellation({ event, coach }) {
  const inner = `
    <p>Hi ${esc(firstName(coach.name))},</p>
    <p>We're sorry to share that the following event has been cancelled:</p>
    ${summaryTable(event)}
    <p>If you paid for this event, our team will be in touch about a refund. We appreciate your understanding.</p>`;
  return sendEmail({
    to: coach.email,
    subject: `${event.title} has been cancelled`,
    html: shell('Event cancelled', inner),
  });
}

// First name for a friendly greeting; falls back to "there".
function firstName(name) {
  const t = String(name || '').trim().split(/\s+/)[0];
  return t || 'there';
}

module.exports = {
  sendEmail, buildEventIcs, icsAttachment, fmtDateTime, locationLine,
  sendRegistrationConfirmation, sendReminder, sendWaitlistConfirmation,
  sendWaitlistPromotion, sendWaitlistPaymentOffer, sendWaitlistExpiry,
  sendRegistrationCancellation, sendEventCancellation,
};
