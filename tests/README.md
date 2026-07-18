# Hive Typing Engine — Tests

Two separate tiers. **Know which one you are running — one is free, one costs money.**

| Tier | Command | Cost | Needs server? | Needs live key? | Needs DB? | Runtime |
|------|---------|------|---------------|-----------------|-----------|---------|
| Offline unit tests | `npm test` | **free** | no | no | no | ~0.3 s |
| Live fixture tests | `npm run test:fixtures -- <fixture>` | **~$0.15 each** | yes | yes | yes | ~3–12 min |

Both run from `app/` (the only `package.json` in the repo):

```bash
cd app && npm test
```

---

## Offline unit tests (`npm test`)

Deterministic, zero-cost, zero-network, no database. Safe as a pre-commit
check. Exits non-zero if any assertion fails.

| File | Covers | Assertions |
|------|--------|-----------|
| `auth_test.js` | Pure functions in `app/auth.js` — password strength, embargo type detection, self-revoke guard | 20 |
| `redirect_logic_test.js` | REDIRECT engine defects — engine collision, suppression-flag injection, candidate swap | 14 |
| `stage1_scoring_test.js` | Stage 1 slider scoring — leading/alternate type, gap, high-ambiguity margin, malformed-group defence | 39 |
| `timing_test.js` | Elapsed-time and session-day computation, duration display rounding | 13 |

They are invoked by **explicit file list, not directory discovery**. This is
deliberate: `run_test.js` also matches the `*_test.js` convention, so
`node --test tests/` would sweep the paid live-API runner into the free
suite. Do not replace the explicit list with a glob or a directory.

`auth_test.js` requires `app/auth.js`, which pulls in `app/db.js`. With no
`DATABASE_URL` set, `db.js` creates no pool, and the pure functions under
test never issue a query. `db.js`'s "unconfigured" error is thrown at first
*use*, not at module load, specifically to keep this working — see the
comment at `app/db.js:1298-1301`. Do not "fix" that by moving the throw to
module load; it would break this file.

All four are cwd-independent and can also be run directly:

```bash
node tests/auth_test.js
```

---

## Live fixture tests (`npm run test:fixtures`)

End-to-end. Posts a complete fixture payload to a running `/api/analyze`,
verifies the JSON result (type, instinct, confidence, flags, required
sections), renders the client and coach HTML reports, and writes them to
`samples/`.

**These make real Anthropic API calls and cost real money.** They are
deliberately excluded from `npm test`.

Prerequisites — server running, live key, DB reachable. Use the dev-local
launcher from the repo root; `app/.env` points at **production**:

```bash
node scripts/dev-local.js        # from repo root
cd app && npm run test:fixtures -- sp4
```

| Fixture | Expected |
|---------|----------|
| `sp4` | Type 4, HIGH confidence, `counter_type` flag, `ranking_override: false` |
| `sx7` | Sexual Seven |
| `redirect69` | REDIRECT path, 6→9 |

Fixtures resolve as `tests/fixtures/<name>.json`. The remaining files in
`fixtures/` (`so7.json`, `sp9_selftyping.json`, `*_api_result.json`,
`*_pre051426.json`) are payload and snapshot data, not runnable fixture
names. Run with no argument to have the runner list what is available.

The runner authenticates with `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`,
falling back to `hive-enneagram` / `9Types!` (`tests/run_test.js:150-151`,
matching the server defaults at `app/server.js:106-107`).

### What the fixture suite does *not* cover

- **Prompt-cache behaviour.** Nothing asserts on `usage`, and `/api/analyze`
  does not return it, so cache hits and misses are invisible here.
- **Retry, timeout, and API error handling.** There is no fault injection;
  the suite exercises only the success path.
- **Client report page count.** The render check asserts `html.length > 0`,
  which passes on a report that renders zero pages.
