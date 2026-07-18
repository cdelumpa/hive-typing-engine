'use strict';

/*
 * Anthropic API error classification — PR20.
 *
 * Why this exists: the client is pinned to maxRetries:0 (server.js), so the
 * SDK no longer retries internally and the hand-rolled loops are the single
 * source of retry truth. That means the loops must now make the decisions the
 * SDK used to make for us:
 *
 *   - which statuses are worth retrying (SDK: x-should-retry, 408, 409, 429, >=500)
 *   - honoring retry-after / retry-after-ms
 *
 * Before PR20 every loop used a bare `catch (err)`, so a 401 with a bad API
 * key, a 429, a full outage, and JSON.parse() throwing on a prose response all
 * burned the identical retry budget. This module makes them distinguishable.
 *
 * Shared by server.js and experimental_analysis.js so both classify identically.
 * No dependencies — safe to require from anywhere, no circular-import risk.
 */

/** Error kinds. `retryable` drives the loops; `kind` drives the log line. */
const KIND = {
  AUTH:        'auth',         // 401 / 403 — bad or revoked key. Never retry.
  BAD_REQUEST: 'bad_request',  // 400 — malformed request. Never retry.
  CREDIT:      'credit',       // billing / credit exhaustion. Never retry, short-circuit chain.
  RATE_LIMIT:  'rate_limit',   // 429 — retry, honor retry-after.
  OVERLOADED:  'overloaded',   // 529 — retry.
  SERVER:      'server',       // 5xx / 408 / 409 — retry.
  CONNECTION:  'connection',   // socket/DNS/timeout — retry.
  PARSE:       'parse',        // JSON.parse or empty content — model problem, at most ONE retry.
  UNKNOWN:     'unknown',      // unclassified — treated as retryable, logged loudly.
};

/**
 * Credit/billing exhaustion.
 *
 * Anthropic surfaces this as a 400 invalid_request_error whose message names
 * the credit balance, not as a distinct status, so status alone cannot
 * identify it — the message must be inspected. 402 is matched defensively.
 * Deliberately checked BEFORE the generic 400 branch: a credit 400 must not be
 * classified as BAD_REQUEST, because CREDIT additionally suppresses the
 * em_only -> SM fallback.
 */
function isCreditError(err) {
  if (!err) return false;
  if (err.status === 402) return true;
  const msg = String(err.message || '') + ' ' + String(err?.error?.error?.message || '');
  return /credit balance|insufficient (?:funds|credit)|billing|payment required|quota exceeded/i.test(msg);
}

/** True for a JSON.parse failure or an empty/missing content block. */
function isParseError(err) {
  if (!err) return false;
  if (err instanceof SyntaxError) return true;               // JSON.parse
  if (err.name === 'EmptyContentError') return true;         // thrown by callers
  // content[0].text on an empty content array
  return /Cannot read propert(?:y|ies) .*of undefined|reading 'text'/i.test(String(err.message || ''));
}

/**
 * Classify an error thrown by an Anthropic SDK call (or by our own parsing of
 * its response).
 *
 * @returns {{kind: string, retryable: boolean, status: number|null,
 *            retryAfterMs: number|null, isCredit: boolean, message: string}}
 */
function classifyApiError(err) {
  const status  = (err && typeof err.status === 'number') ? err.status : null;
  const message = String((err && err.message) || err || 'unknown error');
  const base    = { status, message, retryAfterMs: readRetryAfterMs(err), isCredit: false };

  // Credit first — it is a 400, and must not fall into the BAD_REQUEST branch.
  if (isCreditError(err))  return { ...base, kind: KIND.CREDIT,      retryable: false, isCredit: true };
  // Parse errors carry no status; check before status-based branches.
  if (isParseError(err))   return { ...base, kind: KIND.PARSE,       retryable: true  };

  if (status === 401 || status === 403) return { ...base, kind: KIND.AUTH,        retryable: false };
  if (status === 400)                   return { ...base, kind: KIND.BAD_REQUEST, retryable: false };
  if (status === 429)                   return { ...base, kind: KIND.RATE_LIMIT,  retryable: true  };
  if (status === 529)                   return { ...base, kind: KIND.OVERLOADED,  retryable: true  };
  if (status === 408 || status === 409) return { ...base, kind: KIND.SERVER,      retryable: true  };
  if (status !== null && status >= 500) return { ...base, kind: KIND.SERVER,      retryable: true  };
  if (status !== null && status >= 400) return { ...base, kind: KIND.BAD_REQUEST, retryable: false };

  // No status: connection reset, DNS, abort/timeout. Matches the SDK's own
  // APIConnectionError / APIConnectionTimeoutError names and their messages
  // ("Request timed out." / "Connection error.").
  const name = String((err && err.name) || '');
  if (/APIConnection(?:Timeout)?Error|AbortError|TimeoutError/i.test(name) ||
      /time[d]?\s*out|timeout|aborted|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EPIPE|socket hang up|fetch failed|connection error|network/i.test(message)) {
    return { ...base, kind: KIND.CONNECTION, retryable: true };
  }
  return { ...base, kind: KIND.UNKNOWN, retryable: true };
}

/**
 * Read retry-after / retry-after-ms off an SDK error.
 *
 * The SDK honored these on its internal retries; pinning maxRetries:0 gives up
 * that behavior, so we re-implement it here. Values above 60s are ignored as
 * implausible for this workload (the SDK applies the same sanity bound).
 */
function readRetryAfterMs(err) {
  const h = err && (err.headers || err.response?.headers);
  if (!h) return null;
  const get = (k) => (typeof h.get === 'function' ? h.get(k) : h[k]);

  const ms = parseFloat(get('retry-after-ms'));
  if (Number.isFinite(ms) && ms > 0 && ms <= 60_000) return ms;

  const s = parseFloat(get('retry-after'));
  if (Number.isFinite(s) && s > 0 && s <= 60) return s * 1000;

  const date = get('retry-after');
  if (date) {
    const delta = Date.parse(date) - Date.now();
    if (Number.isFinite(delta) && delta > 0 && delta <= 60_000) return delta;
  }
  return null;
}

/**
 * Backoff for `attempt` (1-based), honoring retry-after when the server sent
 * one. Adds full jitter — the pre-PR20 backoff was a bare 2^attempt*1000 with
 * no jitter, which synchronizes retries across concurrent assessments and
 * makes a 429 storm self-reinforcing.
 */
function backoffMs(attempt, retryAfterMs) {
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) return retryAfterMs;
  const capped = Math.min(Math.pow(2, attempt) * 1000, 30_000);
  return Math.round(capped / 2 + Math.random() * (capped / 2));   // full jitter, 50-100% of capped
}

/** Error thrown to short-circuit an entire assessment chain on credit exhaustion. */
class CreditExhaustedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CreditExhaustedError';
    this.isCreditExhausted = true;
  }
}

module.exports = {
  KIND,
  classifyApiError,
  readRetryAfterMs,
  backoffMs,
  isCreditError,
  isParseError,
  CreditExhaustedError,
};
