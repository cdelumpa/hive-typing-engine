# Provisioning & Commerce — Build Handoff

**Purpose:** self-contained brief so a fresh Claude Code chat can start the Provisioning &
Commerce build without the originating conversation. Read this + the spec, confirm base
state, resolve the open blockers (Section F), then build PR-by-PR (Section E).

---

## A. Base state & conventions

- **Repo:** `cdelumpa/hive-typing-engine` · service: hive-typing-engine (Railway)
- **Base commit at handoff:** `12c2ba6` (= `origin/main`). **Branch off CURRENT `main`, not
  `cec70c5`.** ⚠️ Some notes cite HEAD as `cec70c5` — that is 12 commits stale. Branching off
  `cec70c5` would drop this session's fixes/Retake AND the Railway HTTP/1.1 pin (`12c2ba6`),
  reintroducing the production HTTP/2 failure. Always `git pull` and branch off the current tip.
- **Feature branch:** `provisioning-schema-seed` (create fresh; does not exist yet). It groups
  the schema+seed work (PR1 new tables, PR2 columns+backfill, PR3 seed) before helpers/logic.
- **Spec:** `docs/insightout_saas_provisioning_commerce_architecture_v1_0_063026.docx`
  (v1.0, decisions log; §10 is the additive schema proposal). Read it in full first.
- **Key files:** `app/db.js` (`SCHEMA_SQL`/`SEED_SQL` + all data helpers), `app/server.js`
  (routes + email + renderers), `app/auth.js` (roles/session).
- **Workflow conventions:** pull `main` first; read `app/server.js` before editing; use
  absolute paths for tests. Do NOT remove the HTTP/1.1 pin on the Anthropic client
  (commit `12c2ba6`) — Railway egress breaks HTTP/2. `db.query()` swallows SQL errors and
  returns `null` (logs `[db] query error:`), so a helper returning null == its statement threw.
- **Process:** additive only — nothing here revises ratified IAA v1.2 (users/roles/user_roles,
  coaches, clients). Schema PRs land first (DDL only), then helpers, then app logic, then UI.
  No single PR mixes `db.js` schema DDL with `server.js` logic.

---

## B. Audit findings that drive the build (with anchors)

1. **PIVOTAL — the assessment row does not exist at provisioning time today.**
   `/admin/clients/new` (`server.js:3287`) creates only a `clients` row + `client_tokens`
   row and sends the invite; it never calls `createAssessment`. The assessment row is born
   later in `/api/submit` (`server.js:1441`) with status hardcoded `'processing'`
   (`db.js:672`). In practice assessment status only holds `{processing, complete, failed}`;
   `'not_started'`/`'in_progress'` are **client** statuses; the `DEFAULT 'pending'` is dead.
   → Every decision that puts toggles/source/credits "on the assessment, set at provisioning"
   presupposes a row that doesn't exist yet. This is **Blocker #1**.

2. **`report_type` has NO CHECK constraint** (`db.js:61`, `VARCHAR(50) NOT NULL`). Only two
   literals are ever written: `'client'` (`server.js:947`) and `'coach'` (`server.js:957`),
   both via `db.createReport` (`db.js:815`). Extending to `leadership`/`team` needs no DDL —
   but three fixed-shape READER helpers assume the two-type world:
   `ADMIN_ROWS_SELECT` LATERALs (`db.js:870`), `getDeletedAssessments` (`db.js:964`),
   `getAssessmentReports` `.find()` shape (`db.js:1304`). (D6: TODO comments only, this build.)

3. **`SELECT *` reads** that will absorb new columns (harmless to JS, but note the export):
   `getAssessmentById` (`db.js:694`), `getBetaReviewRespondents` LATERAL (`db.js:1443`),
   `/admin/export/:client_id` (`server.js:8535`); on clients: `getClientById` (`db.js:1121`).

4. **Central insertion points** (single place each — good): `createClient` (`db.js:657`),
   `createAssessment` (`db.js:666`, INSERT names only 5 cols), `createReport` (`db.js:815`).

5. **Email:** `sendEmails` (`server.js:768`) sends BOTH the client report (`clientMsg`,
   `sgMail.send` ~`server.js:908`) and coach prep (`coachMsg`, ~`server.js:917`) in one call.
   Call sites: `/api/submit` (`server.js:1283`), `/admin/retry` (`server.js:8746`),
   `/admin/resend` (`server.js:8831`). D2 splits this.

6. **`clients.email` UNIQUE index** `clients_email_key` (`db.js:153`). `createClient` has no
   `ON CONFLICT` → a duplicate email throws (swallowed → "Failed to create client"). D1 fixes.

7. **ThriveCart webhook `POST /admin/coaches/provision` does NOT exist** — entirely greenfield.
   Existing coach creation `/admin/coaches/new` (`server.js:7499`) already does the two-step
   the webhook must mirror: `db.addCoach` + `auth.createUserWithRoles(email, hash, ['client','coach'])`
   + links `coaches.user_id` (`server.js:7519-7529`).

8. **Admin gating:** all `/admin/coaches/*` and client reassignment are `requireAdmin`
   (admin OR super_admin), and `/admin/clients/new` is only `requireAdminSession`
   (any logged-in user). D4 keeps this for October.

9. **9 proposed tables are all net-new** (accounts, credit_types, credit_lots,
   credit_transactions, certifications, teams, team_members, team_reports, assignment_events).
   **Zero column collisions** — every §10.2 column is net-new. `app_settings` is a singleton
   (`CHECK id=1`) with one row; add the credit bypass flag like the existing `em_*` columns.

---

## C. Decisions (authoritative — resolve the audit flags)

- **D1 — clients.email:** `createClient` → `INSERT ... ON CONFLICT (email) DO NOTHING`,
  returning the existing row id on conflict (needs a `SELECT id` fallback since DO NOTHING
  returns no row). On duplicate, continue by creating a new assessment on the existing client
  (same as retake). `client_source` moves OFF clients → onto **assessments** (same person can
  be coach-provisioned on one assessment, D2C on another).
- **D2 — send flags:** `auto_send_report` defaults **FALSE**; backfill existing rows → TRUE.
  Split `sendEmails` into `sendCoachPrepEmail` (always fires, no flag) and
  `sendClientReportEmail` (fires only when `auto_send_report = TRUE`). Stamp `email_sent_at`
  only on a successful client send. `auto_send_invitation` also lives on **assessments**
  (not clients), default FALSE. Both set at provisioning via the modal (D5).
- **D3 — cancellation ≠ soft-delete (orthogonal).** Existing `deleted_at`/`pre_deletion_status`/
  `permanently_deleted` trio untouched. Cancellation uses only `cancelled_at`,
  `cancellation_reason`, `credit_restored_at`. Eligible: `pending`/`not_started` (invite sent,
  not begun) → coach self-serve cancel, credit restored automatically. `in_progress`/
  `processing`/`complete`/`failed` → CONSUMED, NOT eligible, no restore (contact Cai/Mo).
  A cancelled assessment stays in the roster with a `Cancelled` badge, excluded from active
  counts; the trail is permanent.
- **D4 — gating:** keep `requireAdmin` (admin OR super_admin) for October; add a comment noting
  the conscious October decision pending Open Question 1. Do not tighten to super_admin.
- **D5 — provisioning modal (new UX):** at client-create/assessment-kickoff, two radio groups,
  **both defaulting to manual (FALSE)**:
  - INVITE: "Send the link directly to [Client]" (TRUE) vs "I'll send it myself" (FALSE, default).
    When FALSE, display the token URL to the coach to copy; system sends no invite email.
  - REPORT: "Send the completed report directly to [Client]" (TRUE) vs "I'll send it myself" (FALSE, default).
    When FALSE, coach still gets the coach prep email; client report PDF is on the dashboard for manual send; no client email.
- **D6 — report_type readers:** no logic change this build; add
  `// TODO: extend for leadership and team report types` to the three readers in B.2.
- **D7 — client_source (on assessments):** values `'coach_provisioned'` (coach via /admin or
  /coach) and `'house'` (Cai/Mo for a D2C client); future: `partner_referral`, `employer_sponsored`.

---

## D. Scope

**Build fully (October):** all new tables (accounts, credit_types, credit_lots,
credit_transactions, certifications, assignment_events); column adds on assessments
(cancelled_at, cancellation_reason, credit_restored_at, auto_send_report, auto_send_invitation,
requested_report_types, client_source) and reports (version_number, parent_report_id, team_id —
nullable, no FK yet); teams/team_members/team_reports (**schema only**); seed credit_types +
one `house` account + coach-account backfill; helpers consumeCredit/restoreCredit/
getAccountBalance/insertCreditTransaction; createClient upsert; sendEmails split; send-flag
backfill; provisioning modal; cancellation logic + Cancelled badge; ThriveCart webhook
`POST /admin/coaches/provision`; credit-balance display in coach profile; assignment_events
wired into single + bulk reassignment (replace the edit_history free-text write);
`app_settings.credit_enforcement_enabled BOOLEAN DEFAULT FALSE`; D6 TODOs.

**Deferred (schema ships, no logic):** teams/team_members/team_reports UI + generation;
certifications UI; Leadership Report; Team Report; "Send to Client" manual-delivery UI in /coach;
D2C refund flow; coach marketplace / coach_profiles; cancellation approval queue for consumed
assessments.

---

## E. PR plan (schema → helpers → email → lifecycle → logic → webhook → UI)

1. **Schema: new tables (DDL only)** — db.js SCHEMA_SQL. All 9 CREATE TABLE + indexes. LOW.
2. **Schema: existing-table columns + backfill** — db.js SCHEMA_SQL. Column adds above +
   `credit_enforcement_enabled`; send-flag backfill via a **fixed authoring-time cutoff**
   (see G). MEDIUM.
3. **Seed** — db.js SEED_SQL. credit_types rows; one `house` account (coach_id NULL); backfill
   a `coach` account per existing coach. Dep: PR1. LOW.
4. **DB helpers: credit ledger** — insertCreditTransaction / consumeCredit (lot FIFO, honor
   bypass flag but still log) / restoreCredit / **grantCredits(toAccountId, creditTypeName,
   quantity, grantedBy, notes)** / getAccountBalance / getAccountByCoachId / getHouseAccount.
   Dep: PR1(+3). LOW–MED.
5. **DB helpers: createClient upsert + cancellation + assignment** — ON CONFLICT + id fallback;
   cancelAssessment/markCreditRestored; insertAssignmentEvent + refactor reassign helpers; D6
   TODOs. Dep: PR1,2. MEDIUM (createClient is the most central insert).
6. **Email split** — server.js sendCoachPrepEmail (always) + sendClientReportEmail (gated);
   rework 3 call sites; stamp email_sent_at only on client send. Dep: PR2. MED–HIGH.
7. **FOUNDATIONAL: assessment created at provisioning time** — move createAssessment into
   `/admin/clients/new` (status pending/not_started); `/api/submit` transitions the existing
   row instead of creating one; retake pre-creates + stamps retake_of_assessment_id (retire the
   getLatestAssessmentId heuristic). Dep: PR5. **HIGH.** (Gated on Blocker #1 resolution.)
8. **Provisioning logic: toggles, source, credit consume, cancellation** — stamp client_source/
   auto_send_*/requested_report_types on the provisioning row; gate invite on
   auto_send_invitation (show token URL when FALSE); consume a credit at provisioning (no-op
   under bypass); cancellation route + auto restore + Cancelled badge + active-count exclusion.
   Dep: PR4,5,7. **HIGH.**
9. **ThriveCart webhook** — POST /admin/coaches/provision: verify `THRIVECART_WEBHOOK_SECRET`;
   coach + user + roles + coach account + typed credits via `grantCredits` per the hardcoded
   `THRIVECART_SKU_MAP` constant in server.js; welcome email; idempotent. Dep: PR3,4. MED–HIGH.
10. **assignment_events server wiring** — `/admin/clients/:id/reassign` (`server.js:9300`) +
    bulk `/admin/coaches/:id/reassign` (`server.js:7565`). Dep: PR5. LOW–MED.
11. **Credit-balance display** — coach profile `/admin/coaches/:id/profile` (`server.js:8873`).
    Dep: PR3,4. LOW.
12. **Provisioning modal UI** — `renderNewClientPage` markup/JS: two radio groups + token-URL
    display; Cancelled badge. Dep: PR8. LOW–MED.

---

## F. BLOCKERS — RESOLVED (final, from Claude Chat 2026-07-02; do not re-derive)

1. **Assessment row at provisioning (not stash).** The assessment row is created at
   `/admin/clients/new` with a new pre-start status **`'not_started'`** (credit consumed at
   creation). Lifecycle: provisioning → `not_started` (row created, credit consumed);
   client starts → `processing` (transition in `/api/submit`); job → `complete`/`failed`.
   PR7: `/api/submit` transitions the existing `not_started` row instead of creating one; the
   retake route pre-creates the next row and stamps `retake_of_assessment_id` at retake time.
2. **Credit consumed at PROVISIONING** (when the `not_started` row is created) — the only model
   under which cancel-with-restore is coherent. The house account
   (`account_type='house'`, `app_settings.credit_enforcement_enabled = FALSE`) STILL calls
   `consumeCredit()` and logs the transaction, but does not enforce a balance floor — the ledger
   stays accurate for when enforcement flips on at launch.
3. **Cancellation eligibility literal = `'not_started'` only.** Check:
   `if (assessment.status !== 'not_started') { /* consumed — not eligible */ }`. Once status →
   `processing`, consumed; no restore, no approval queue (exceptional handling offline via Cai/Mo).
   Cancelled ≠ soft-deleted: row stays in roster with a **`Cancelled`** badge; the three
   cancellation columns are permanent. Cancellation and soft-delete are orthogonal — never conflate.
4. **`requested_report_types`** = JSONB array of `credit_types.name` strings.
5. **ThriveCart:** secret in env var **`THRIVECART_WEBHOOK_SECRET`**; SKU→credit map is a
   **hardcoded constant `THRIVECART_SKU_MAP` in `server.js`**.
6. **Accounts:** the `house` account (coach_id NULL) is separate from Cai/Mo personal `coach`
   accounts; house/D2C assessments bill house, a coach's own clients bill their coach account.

---

## G. Migration safety & top regression risks

- **Send-flag backfill trap (PR2):** `ADD COLUMN ... DEFAULT FALSE` + `UPDATE SET TRUE WHERE
  ...=FALSE` re-flips manually-set new rows on every reboot (SCHEMA_SQL runs each boot). Use a
  nullable add + one-time backfill guarded on a fixed cutoff:
  `UPDATE assessments SET auto_send_report=TRUE WHERE auto_send_report IS NULL AND created_at < '2026-07-01 12:00:00+00'`
  (same cutoff for `auto_send_invitation`).
  Until PR8 writes the flags on insert, gate reads with `COALESCE(auto_send_report, TRUE)` (or
  land PR6 after PR8).
- **Export (`server.js:8535`)** will emit the new assessment columns via `SELECT *` — decide if wanted.
- **Regression watch (verify after each relevant PR):**
  1. Report-delivery email (PR6): coach prep still sends when client is suppressed;
     email_sent_at NULL (not error) on suppression; retry/resend still deliver; keep the
     `intake.coach_email` re-source trust fix (`server.js:1275-1281`).
  2. Assessment lifecycle + retake (PR7): one row transitions pending→processing→complete;
     retake stamps retake_of_assessment_id; `is_latest_complete` (`db.js:842`) still correct;
     abandoned-client reminders unaffected.
  3. Dashboard rows + createClient upsert (PR5): duplicate email attaches to existing client
     (no unique violation, no new clients row); coach-scoping intact; id-fallback returns the
     real id so `!clientId` branches don't false-fire.

---

## H. This-session bug fixes already on main (context, not part of the build)
- `stage1_data.js` SPA allowlist + duplicate-email message on client-create.
- Retake button added to the Manage Coaches accordion (`accordionRetake` + `renderAccordionTable`).
All are ancestors of `12c2ba6`.
