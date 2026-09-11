# ENV-SAFETY — a local server cannot reach production by accident

**Branch** `env-safety-local-db`, base **`c234700`** (`main` after PR #109). Not part of PR 6; it
does not depend on Build B2, and B2 does not depend on it.

**Status: COMPLETE ON THE BRANCH, NOT PUSHED.** Three commits plus this report. `npm test` 62/62,
every CI gate green locally, nine boot proofs, three structural tests each observed red.
`overrides_check.js` has run locally for the first time: **green, 0 published rows**. Paused for
review, as instructed.

| Commit | Step |
|---|---|
| `dfea10b` | `server.js` refuses to boot against a non-local database outside Railway (scope item 1) |
| `eb8a43e` | `overrides_check.js` uses SSL only for a remote database (scope item 2) |
| `efef75c` | No module can re-point `DATABASE_URL` after the boot check (found during the build — §5) |
| *this commit* | Build report |

## 1. What changed

| File | Change |
|---|---|
| `app/env_guard.js` | **New.** Pure: no I/O, no `process.env` reads of its own. `checkDatabaseTarget({ databaseUrl, outsideEnv })` and `checkUnchanged(approved, current)`, plus `isLocalDatabaseUrl`, which is the one definition of "local" (`localhost`, `127.0.0.1`, `::1`, parsed with `new URL`). |
| `app/server.js` | Snapshots the environment **before** `dotenv.config({ override: true })`, runs the guard straight after it, and exits 1 on refusal. It records the approved URL. A second check, just before `connect-pg-simple` builds the session store, requires that URL unchanged. |
| `app/generate_report.js` | The top-level `dotenv.config({ path: app/.env })` moved into `loadCliEnv()`, which only `runCli()` calls. Requiring the module no longer touches `process.env`. |
| `scripts/overrides_check.js` | `ssl: local ? false : { rejectUnauthorized: false }`, with "local" taken from `env_guard`. The header documents the local command. |
| `tests/env_guard_test.js` | **New.** Nine tests: the verdicts, and the source ordering in `server.js` that makes them mean anything. |
| `app/package.json` | Adds the test file to `npm test`. |

**The rule, as built:**

| `DATABASE_URL` after dotenv | Permission (shell / Railway env only) | Result |
|---|---|---|
| unset | — | boots, no database (as before) |
| local | — | boots |
| non-local | any of `RAILWAY_PROJECT_ID`, `_ENVIRONMENT_ID`, `_SERVICE_ID`, `_DEPLOYMENT_ID`, `_ENVIRONMENT_NAME`, `RAILWAY_ENVIRONMENT` | boots |
| non-local | `ALLOW_NONLOCAL_DATABASE=1` | boots, with a `WARNING` line |
| non-local | none, or permission written in a `.env` file | **exits 1**, names the host, never the password |

Permission comes only from the environment as it stood before dotenv ran. This is the same guard
`scripts/dev-local.js` has had all along, which refuses a non-local database. The server's version
is stricter about what "local" means and also takes explicit opt-ins.

## 2. Pass/fail evidence

### Boot proofs

Each proof ran `node app/server.js` from a scratch directory holding its own `.env`, with fake
`.invalid` hosts, so nothing could connect even if the guard failed. None of them used `app/`.

| # | Setup | Expected | Observed |
|---|---|---|---|
| 1 | Non-local URL in `.env`, nothing in the shell | refuse | exit 1, `REFUSING TO BOOT … (db.….invalid)`, before `db.js` loaded |
| 2 | Same, with `RAILWAY_PROJECT_ID` in the shell | boot | boots |
| 3 | Same, with `ALLOW_NONLOCAL_DATABASE=1` in the shell | boot + warn | boots, `WARNING` printed |
| 4 | `ALLOW_NONLOCAL_DATABASE=1` written **in `.env`** | refuse | exit 1 |
| 5 | `RAILWAY_PROJECT_ID` written **in `.env`** | refuse | exit 1 |
| 6 | No URL at boot; a `--require` preload injects one after the check | refuse | exit 1, the backstop: `now db.injected.invalid, approved none` |
| 7 | No database anywhere (fake BASIC_AUTH) | boot | boots unconnected |
| 8 | `node scripts/dev-local.js` | boot | boots against local `hive_typing_local` |
| 9 | Proof 1 again, on a **trial merge of this branch with B2** (§4) | refuse | exit 1; the password appears 0 times in the output |

### Tests

`npm test` **62/62**: the 53 existing tests, plus the 9 new ones in `tests/env_guard_test.js`.
Three of the new tests are structural. Each was observed red against a scratch copy of the source
carrying the defect it guards against:

| Test | Red control | Observed |
|---|---|---|
| Snapshot, then dotenv, then guard, then exit, and `db`/`render_report`/`content_overrides`/`report_prep` load after the guard | snapshot moved after dotenv | red |
| The backstop sits after every module that loads `db.js`, and before `new PgSession(` | backstop removed | red |
| No module `server.js` requires loads dotenv at top level | `generate_report.js`'s top-level dotenv restored | red |

### Gates

All green locally on this branch:

- `verify_render` ALL PASSED (67s).
- `verify_quickref_fit` 19/19.
- `verify_devideas_fit` 19/19.
- `verify_content_library`.
- Diagrams and transparency.
- Coach baseline, HTML half. The PDF half is Linux-only, as always.
- `verify_phase7c_beta` ALL PASSED. This harness exercises `generate_report.js` as a module, so it
  covers the `loadCliEnv` change.

## 3. `overrides_check.js` — the first local run, and what it says

**This is the local database, not production.** "The current live combination" here means today's
library against the rows published in `hive_typing_local`. I did not point the check at production.
Running it there is Cai's deliberate step (below).

**This branch (main's library, no sheet 11 audit):**

```
=== Published override shape check ===
database: localhost
published rows: 0

OVERRIDES CHECK: ALL PASSED — every published override matches the current library shape.
```

The exit code was 0. For comparison, I ran `main`'s version of the script against the same
database. It printed `OVERRIDES CHECK: DID NOT RUN — database error: The server does not support
SSL connections` and exited 2. Before this branch it could only ever run against production.

**Red control:** two rows planted locally.

| Row | Planted state | Result |
|---|---|---|
| `static.welcome` | missing `signoff` | `MISMATCH … missing from override: signoff` |
| `static.wings_primer` | well-formed | `ok` |

The run exited 1. Both rows were deleted afterwards, returning the database to 0 rows.

**B2's version** (which adds the sheet 11 audit), with this SSL fix applied:

```
[sheet11-audit] ok — tightest page Type 9, 82.87px free; 0 live sheet 11 override(s)
OVERRIDES CHECK: ALL PASSED — … and sheet 11 fits for all nine types.
```

The exit code was 0. It gives the same verdict on the trial merge (§4). The B2 red control: a
seeded `type_9.devideas_v3` that spills gave `SHEET 11 DOES NOT FIT — Type 9 would run 1 line onto
a second sheet`, and the run exited 1. It was cleaned up to 0 rows.

**What it says:** locally, nothing overrides anything. So the local click-through starts from the
library exactly as built, and Type 9 has 82.87px of headroom with its reserved long name. That is
not evidence about production's rows. To get that, Cai runs this from the repo root:

```bash
node scripts/overrides_check.js
```

With no `DATABASE_URL` in the shell, it loads `app/.env` and reads **production**, read-only. SSL is
unchanged for a remote host.

## 4. Coexistence with B2

I trial-merged B2 (`81a66af`) onto this branch in a scratch worktree, which is now removed:

- **One conflict: `app/package.json`.** Both branches append a file to the same `test` line. The
  resolution is to keep both: `… ../tests/cms_devideas_test.js ../tests/env_guard_test.js`.
- `server.js` and `overrides_check.js` merge automatically.
- The merged `npm test` passes **86/86**.
- The merged `overrides_check` against the local database is green, with the sheet 11 audit
  reporting 82.87px.
- The merged server refuses a non-local `.env` (boot proof 9).

B2's boot audit runs after `app.listen` and is gated on `DATABASE_URL`. It now only ever reaches a
database the guard approved.

**Whichever of the two merges second** has to resolve that one-line conflict. It needs a
merge-from-main on the branch (see the stale-merge-ref note from PR 5), not a re-run of CI.

## 5. Deviations from the plan

1. **A third commit, `efef75c`.** The planned guard alone could be bypassed. A server started with
   **no** `DATABASE_URL` was approved as "no database". Then `server.js` required `generate_report.js`,
   whose top-level `dotenv.config({ path: app/.env })` filled the unset variable with production's
   URL. The session store (`conString: process.env.DATABASE_URL`) and `db.js`'s lazy pool would then
   have connected. There were two fixes:
   - `generate_report.js` loads dotenv only when run as a CLI.
   - A backstop refuses to continue if the URL differs from the one the guard approved. It catches
     this, and any future module that does the same.

   This is within scope, since it is the same promise ("refuses to boot against a non-local
   database"), just kept.
2. **No predictions file.** Previous builds committed measurement predictions first. This change has
   no page measurement to predict. Its evidence is the boot proofs and the red-controlled tests
   instead.

## 6. New risks surfaced

The guard covers **`server.js` only**. Several scripts still reach production by default when run
from a normal shell:

| Script | Default target | Writes? | Note |
|---|---|---|---|
| `scripts/seed_coach_passwords.js` | `app/.env` with **`override: true`** | **yes**, `UPDATE coaches SET password_hash` | the highest-risk one: a shell `DATABASE_URL` cannot even redirect it |
| `scripts/retire_overrides.js` | `app/.env` | **yes**, with `--confirm` | dry run by default; a shell `DATABASE_URL` wins |
| `app/generate_report.js` (CLI) | `app/.env` | **yes**, `UPDATE clients SET beta_report_…` | only when run as a CLI; as a module it is now clean |
| `scripts/overrides_check.js` | `app/.env` | no | read-only; now also runs locally |
| `app/inspect_latest.js` | `.env` in the working directory | no | from `app/` that is production |

A follow-up could route all of these through `env_guard.checkDatabaseTarget`. That would be a small
PR of its own, and I have not started it.

Other risks:

- **Production boots only because Railway injects a marker.** Railway documents the six variables
  as always present, but I cannot see this project's runtime environment from here. If none of them
  arrives, production **refuses to boot**. It fails loudly (the deploy log shows the refusal), not
  silently.
  - **Watch the first deploy's log.**
  - The fallback is `ALLOW_NONLOCAL_DATABASE=1` as a Railway **service variable**. Those are process
    environment, not a `.env` file, so they count.
- **A server started without `app/.env` now stops on BASIC_AUTH.** Before this branch, the
  `generate_report` injection silently supplied the credentials. The fail-fast is pre-existing and
  correct. Only the silent rescue is gone.
- **Repo-root `.env.local` holds the production URL.** Nothing in the repo reads it today. It is a
  loaded gun for any future script that reaches for `.env.local` by convention.
- **Three findings in `scripts/dev-local.js`**, all pre-existing and not changed here:
  - It prints the **full** `DATABASE_URL` when it refuses, so a production password would land in
    the terminal.
  - Its "local" test is a substring match, so `localhost.example.com` passes. `server.js`'s stricter
    guard now runs underneath it and would catch that.
  - A comment refers to server.js's "line-15" dotenv call. That call is now at line 21.
- **Under `dev-local.js`, the guard's "before dotenv" snapshot includes file values.** `dev-local`
  loads `app/.env` and `.env.dev.local` into `process.env` before `server.js` starts. A Railway
  marker placed in either file would therefore count as permission. I checked that neither file
  contains one, and `dev-local` refuses a non-local database itself.

## 7. For Cai's click-through

```bash
node scripts/dev-local.js
```

Run it from the repo root, then open `http://localhost:3000/admin/login`. The console's first lines
name the database: `[dev-local] booting server.js against postgresql://…@localhost:5432/hive_typing_local`.
If `server.js` is ever started any other way with `app/.env` in reach, it now stops with
`REFUSING TO BOOT` instead of connecting.
