'use strict';
// PR6 (§9) standalone timing-logic unit tests. Pure logic — no DB, no server.
// Mirrors exactly: the /save started_at guard (server.js), the elapsed_seconds /
// session_days computation (/api/submit), and the modal's duration display rule.

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓  ' + msg); }
  else { failed++; console.log('  ✗  ' + msg); }
}

// ── Exact formulas copied from server.js ──────────────────────────────────────
// /save guard: stamp NOW on the first save that lacks it; preserve thereafter.
function saveGuard(existingStart, nowFn) {
  return existingStart || nowFn();
}
// /api/submit computation.
const dayIdx = (d) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
function computeTiming(startedAtIso, completedAt) {
  const startDate = new Date(startedAtIso);
  const elapsedSeconds = Math.round((completedAt - startDate) / 1000);
  const sessionDays = (dayIdx(completedAt) - dayIdx(startDate)) + 1;
  return { elapsedSeconds, sessionDays };
}
// Modal duration display rule.
const displayMins = (secs) => Math.max(1, Math.round(secs / 60));

// ── 1. Guard idempotency (resume must never overwrite the original start) ─────
console.log('\nGuard idempotency:');
{
  let nowCalls = 0;
  const fakeNow = () => { nowCalls++; return '2026-06-07T10:0' + nowCalls + ':00.000Z'; };
  const first = saveGuard(undefined, fakeNow);          // first save → stamps
  const second = saveGuard(first, fakeNow);             // later save → preserves
  const third = saveGuard(second, fakeNow);             // resume → preserves
  assert(first === '2026-06-07T10:01:00.000Z', 'first save stamps a start time');
  assert(second === first && third === first, 'subsequent saves preserve the original start time');
  assert(nowCalls === 1, 'NOW() is invoked exactly once — no re-stamp on resume');
}

// session_days uses the server's LOCAL calendar day (dayIdx reads getFullYear/
// Month/Date). These cases build local-time instants so they're deterministic in
// any timezone — started is passed as an ISO string (as session_state stores it),
// completed as a Date (as /api/submit has it).

// ── 2. elapsed_seconds + session_days — same-day case ─────────────────────────
console.log('\nSame-day (single sitting):');
{
  const started = new Date(2026, 5, 7, 10, 4, 0).toISOString();   // local Jun 7, 10:04
  const completed = new Date(2026, 5, 7, 10, 22, 0);              // local Jun 7, 10:22
  const { elapsedSeconds, sessionDays } = computeTiming(started, completed);
  assert(elapsedSeconds === 18 * 60, 'elapsed_seconds = 1080 (18 min)');
  assert(sessionDays === 1, 'session_days = 1 (same calendar day)');
}

// ── 3. elapsed_seconds + session_days — next-day case ─────────────────────────
console.log('\nMulti-day (saved and returned):');
{
  const started = new Date(2026, 5, 7, 14, 14, 0).toISOString();  // local Jun 7, 2:14 PM
  const completed = new Date(2026, 5, 8, 9, 19, 0);               // local Jun 8, 9:19 AM
  const { elapsedSeconds, sessionDays } = computeTiming(started, completed);
  assert(sessionDays === 2, 'session_days = 2 (next calendar day)');
  assert(elapsedSeconds === Math.round((completed - new Date(started)) / 1000), 'elapsed_seconds is wall-clock across the gap');
}

// ── 4. Documented midnight edge case (short session crossing midnight → 2) ─────
console.log('\nMidnight edge case (documented approximation):');
{
  const started = new Date(2026, 5, 7, 23, 50, 0).toISOString();  // local Jun 7, 11:50 PM
  const completed = new Date(2026, 5, 8, 0, 10, 0);               // local Jun 8, 12:10 AM
  const { elapsedSeconds, sessionDays } = computeTiming(started, completed);
  assert(elapsedSeconds === 20 * 60, 'elapsed_seconds = 1200 (20 min)');
  assert(sessionDays === 2, 'session_days = 2 — 20-min session crossing midnight reads as multi-day (accepted for alpha)');
}

// ── 5. Duration display rule (Math.round, min 1) ──────────────────────────────
console.log('\nDuration display (modal):');
{
  assert(displayMins(65) === 1, '65s → 1 min (round, not floor)');
  assert(displayMins(20) === 1, '20s → 1 min (minimum display)');
  assert(displayMins(90) === 2, '90s → 2 min');
  assert(displayMins(0) === 1, '0s → 1 min (minimum)');
}

console.log('\n=== RESULT: ' + passed + ' passed, ' + failed + ' failed ===');
process.exit(failed === 0 ? 0 : 1);
