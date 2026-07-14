# **InsightOut Coach Portal — Design Spec Addendum: §7.2 My Clients**

**Version 1.0 · Confidential · Hive, Inc.**

**Status:** Locked. Resolves the same "unchanged from v1.4, full specs on record" gap Design Spec v2.2 had for §7.2. Transcribed from the Claude Design mockup set (six desktop states, tablet, three mobile states, two modals) and ratified by Cai. Fold into the master Design Spec as §7.2 whenever that document is next revised.

**Route:** `/coach/clients`. Master-detail: roster (left) \+ selected client detail (right) on desktop/tablet; roster and detail are separate views on mobile.

**Job mapping:** J3 — "Track a client's progress."

**Nav confirmation:** the tablet mockup shows real nav icons (home, people, reports, book/resources, graduation-cap/training, external-link/collective, person/account, card/credits) — **this resolves the PR3 backlog item** ("tablet 64px strip needs a real icon set"). Pass this back to whoever picks up that backlog item.

## Roster (left column, desktop/tablet; standalone list, mobile)

- "Create New Client" primary button, full width, top.  
- Sort toggle: **Recent** / **A-Z** tabs.  
- Search input: "Search clients..."  
- Client rows: status dot \+ name \+ status badge, right-aligned. **Dot rule (confirmed from the mockup): filled `--color-primary` dot only when status \= In Progress; hollow/outline dot for Complete or Not Started.** This is the roster's "needs attention" signal, consistent with the portal's status-driven design principle.  
- A pending retake request adds a second badge under the name: "RETAKE PENDING" in accent orange (`--color-accent`).  
- Selected row (desktop/tablet): `--color-primary-light` background \+ left border accent.  
- Mobile rows end in a chevron (`>`), tapping navigates to the detail view.

## Detail panel (right column, desktop/tablet; own view, mobile)

- Header: avatar circle (initials, `--color-primary` bg) \+ client name (bold) \+ email \+ organization. "Edit" link, top-right.  
- **Assessment History** (eyebrow label): one entry per assessment, most recent first. Each entry: "Standard Assessment" \+ optional "RETAKE" badge (cyan) inline with the title \+ status badge right-aligned. Below: "Provisioned \[date\]" and, if complete, "Completed \[date\]" \+ "Type N · \[instinct code\] · Confidence: \[level\]" \+ "Client Report" / "Coach Report" download links (download icon, `--color-primary`).  
- **Coach Debrief** (eyebrow label): two-column — "DEBRIEF COMPLETED" (Yes/No, green when Yes) \+ "DEBRIEF DATE".  
- **Coach Notes** (eyebrow label): textarea, placeholder "Private notes about this client — only you can see these.", "Autosaved" hint below. Confirm autosave debounce behavior at build time (not specified in the mockup).  
- Bottom CTA, full width: contextual — "Request Retake" (outline) when the client's latest assessment is complete with no pending/approved retake; "Launch Retake" (filled) when a retake request has been approved.

## Modal: Create New Assessment

Trigger: "Create New Client" flow, or provisioning a new assessment for an existing client. Locked client-info block (name/email/org, lock icon — non-editable in this context). **Assessment Type**: "Standard Assessment" selected card, "1 credit" shown right, hint "Leadership and Team reports coming soon" (confirms only Standard is selectable at launch, consistent with the Provisioning doc). **Report Delivery** radios: "Hold report — I'll deliver manually" / "Send automatically when ready". **Send Invitation** radios: "Don't send — I'll share the link" / "Send invitation email now". **Notes (optional)** textarea.

This directly implements the manual-send controls from the SaaS Provisioning & Commerce Architecture doc §8 (`auto_send_report`, `auto_send_invitation` on `assessments`) — those columns already exist (per the PR3 audit's confirmed schema). This modal is their first real UI. Submit action reuses the existing `POST /admin/clients/provision` logic per the original phased-plan's reuse guidance, now with these two flags wired through instead of defaulting silently to TRUE.

## Modal: Request a Retake

Locked client-info block. **Reason for Retake** (required textarea), hint: "This will be sent to InsightOut for approval. You'll be notified when a decision is made." Cancel

+ "Submit Request" buttons.

## The retake workflow — new scope, not previously designed anywhere

**This entire workflow does not exist in any of the four architecture documents.** Ratified direction (Cai's call): build both the coach-side request/display AND a minimal admin-side approval surface in this PR — not a manual-outside-the-system stopgap.

### **Schema — new `retake_requests` table**

A retake request is NOT an assessment until launched — it's a request that references the original assessment being retaken. Proposed:

CREATE TABLE IF NOT EXISTS retake\_requests (

  id SERIAL PRIMARY KEY,

  client\_id INTEGER NOT NULL REFERENCES clients(id),

  original\_assessment\_id INTEGER NOT NULL REFERENCES assessments(id),

  coach\_id INTEGER NOT NULL REFERENCES coaches(id),

  reason TEXT NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending', \-- pending | approved | denied

  denial\_reason TEXT,

  requested\_at TIMESTAMPTZ DEFAULT NOW(),

  reviewed\_by INTEGER REFERENCES users(id),

  reviewed\_at TIMESTAMPTZ,

  resulting\_assessment\_id INTEGER REFERENCES assessments(id) \-- set when launched

);

CC should confirm this against actual `assessments`/`clients` FK types at build time — proposed shape, not final DDL.

### **State machine**

1. **Pending** — coach submits reason. Roster shows "RETAKE PENDING" badge. No assessment exists yet.  
2. **Approved** — admin approves. Detail panel shows "RETAKE · APPROVED", italic "Approved — ready to launch", and a "Launch Retake →" action. Still no assessment until launched.  
3. **Denied** — admin denies with a required reason. Detail panel shows "RETAKE · DENIED", italic red "Retake request denied", and an accent-tinted callout box labeled "REASON FOR DENIAL" containing the admin's text. Coach may submit a new request later — no restriction implied by the mockup.  
4. **Launched** — coach clicks "Launch Retake" on an approved request. This provisions an actual new assessment (reuses the existing provisioning path), sets `resulting_assessment_id`, and the new assessment then appears in Assessment History with a "RETAKE" badge, its own Provisioned/Completed dates and status.

**Open item, flagging rather than deciding:** does launching an approved retake consume a Standard Assessment credit, same as any new assessment? The "1 credit" language in the Create New Assessment modal suggests yes, and that's the safer default (protects revenue, consistent with "every assessment costs a credit"), but no document confirms this either way. Provisional call: **yes, consumes 1 credit** — flag for Cai to override if retakes should be free.

### **Coach-side scope**

- Wire the "Request Retake" button → modal → `retake_requests` insert.  
- Wire roster \+ detail rendering of all three request states per above.  
- Wire "Launch Retake" → provisioning flow, credit consumption per the open item above.  
- Email notification to the coach on approval or denial (reuse existing SendGrid pattern — same infra already used for password reset / welcome emails).

### **Admin-side scope (minimal, per ratified direction)**

- A list view of pending retake requests (coach name, client name, original assessment date, reason). Match the existing admin panel's visual conventions — this is an internal tool, not a new design system.  
- Approve action (single click, sets `reviewed_by`/`reviewed_at`).  
- Deny action, requires a reason (populates `denial_reason`).  
- Both actions trigger the coach-facing email notification above.  
- Exact admin route/page placement (new page vs. added to an existing coach/client admin view) is CC's technical call — describe options in the audit rather than guessing blind.

## Breakpoint notes

- **Tablet:** icon-only 64px nav (real icons, confirmed above), master-detail preserved side by side, footer visible ("© 2026 Hive, Inc. | Privacy Policy | Terms of Use" — first confirmed sighting of actual footer copy).  
- **Mobile:** hamburger nav, roster and detail are separate views (`← My Clients` back link on detail). Modals render as bottom sheets with a drag handle, matching the pattern already established in Resources/onboarding modals.

*End of Addendum — v1.0*

