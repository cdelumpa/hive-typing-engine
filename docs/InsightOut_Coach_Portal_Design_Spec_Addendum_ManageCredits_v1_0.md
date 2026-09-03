# InsightOut Coach Portal — Design Spec Addendum: §7.4 Manage Credits

**Version 1.0 · Confidential · Hive, Inc.**

**Status:** Locked. Resolves the same "unchanged from v1.4, full specs on record" gap
Design Spec v2.2 had for §7.4. Transcribed from the Claude Design mockup set, already
committed in-repo at `docs/Coach Portal Screens/Manage Credits/` (14 PNGs: base screen ×3
breakpoints, Purchase Credits modal ×3, modal no-selection state ×3, success banner ×3,
failed banner ×2, processing banner ×2). Fold into the master Design Spec as §7.4
whenever that document is next revised.

**Route:** `/coach/credits`. Nav item already live (Manage Credits, card icon, MANAGE
zone, per PR1/PR2's already-built nav).

**Job mapping:** J4 — "Buy and track credits."

**Depends on:** the credit-pricing-model change (variable per-assessment credit cost,
5-credit baseline, promotable) — a prerequisite PR ahead of this one. This addendum's
package pricing and per-assessment consumption language assume that PR has already
landed; do not build this screen against the original 1-credit-per-assessment model.

## Header (all breakpoints)

Standard portal chrome — unchanged from Dashboard/My Clients. H1 "Manage Credits"
(Georgia, `--color-text-heading`), "Purchase Credits →" primary button top-right
(desktop/tablet). Mobile: full-width button directly below the H1, above the summary
card.

## Summary card

Three-stat row, divided by thin vertical rules on desktop/tablet, tighter grid on
mobile:

- **AVAILABLE** — large Georgia number, "credits" label beneath (muted, small caps
  eyebrow style matches other metric-tile idioms already used on Dashboard/My Reports).
- **PURCHASED** — large number, "from N lots" beneath.
- **COMPLIMENTARY** — large number, "certification grant" beneath.

All three are **remaining balances** (`SUM(quantity_remaining)` grouped by
`credit_lots.source`), confirmed by the mockup's own arithmetic (Purchased 10 +
Complimentary 2 = Available 12) — not lifetime totals. Lifetime purchased would run far
higher than Available given ordinary consumption and wouldn't reconcile.

These three numbers must always be live-queried, never cached (same `Cache-Control:
no-store` posture as Dashboard, per Design Spec §12.3 Tier 3 — a coach seeing a stale
balance right after a purchase is a real support-ticket risk, not just a nice-to-have).

**Because an assessment now costs more than 1 credit (5 by default), consider a small
derived line under the Available stat — e.g. "≈ N assessments" — so the raw credit
count doesn't read as more purchasing power than it is.** Flagging as a recommendation,
not a locked requirement; confirm with Cai before building if this feels like scope
creep for v1.

## Credit Purchase and Usage History

Card below the summary, header "Credit Purchase and Usage History".

- **Desktop:** table — DATE / DESCRIPTION / UNIT PRICE / AMOUNT PAID / CREDITS /
  BALANCE. Right-aligned numeric columns.
- **Tablet:** same table, **UNIT PRICE column dropped** to fit the narrower width —
  DATE / DESCRIPTION / AMOUNT PAID / CREDITS / BALANCE.
- **Mobile:** card-per-row. Date (muted, small) + description (bold) stacked on the
  left, credits delta top-right of the row; amount paid (if any) and running balance
  stacked below the description/delta.

**Row types confirmed from the mockup data:**
- **Assessment consumption** — e.g. "Assessment — Jordan Lee". Unit price and amount
  paid render as em-dash (—). Credits column: `-N` (N = whatever the assessment's
  credit cost was at the time it was provisioned — 5 by default, less during a promo
  week; **do not hardcode `-1`**), black/default text. 1:1 mapping to a
  `credit_transactions` debit row tied to a provisioned assessment; description
  interpolates the client's name.
- **Purchase** — e.g. "Purchase — 5-pack". Unit price + amount paid populated. Credits
  column: `+N`, green (`--color-success`).
- **Complimentary grant** — e.g. "Complimentary Grant — Certification". Unit price and
  amount paid render as em-dash. Credits: `+N`, green. Ties to the certification-gate
  bonus-credit mechanic already described in the Provisioning & Commerce doc.
- **Refund (assessment cancelled)** — net-new row type, not in the original mockups,
  surfaced during the PR6 audit: cancelling an assessment restores whatever credits
  were consumed for it. Description "Refund — Assessment cancelled", credits `+N`
  (matching whatever was originally consumed, not a fixed amount), green. Cannot be
  omitted from the history — the running balance wouldn't reconcile without it.

**Pagination:** "Showing N of NN transactions" (left), first/prev/next/last controls +
page indicator ("Page 1 of 5") + a "Show: [N ▾]" page-size selector (right). Desktop/
tablet default page size 10; mobile default page size 5 (confirmed from the mock — this
is a real breakpoint-specific default, not an inconsistency to normalize away).

## Modal: Purchase Credits

Triggered by the "Purchase Credits" button anywhere on the page.

Header "Purchase Credits" + × close. Eyebrow "SELECT A PACKAGE". Four radio-card
options — **no Single Credit tier**: since an assessment costs 5 credits, a lone
credit can't buy anything on its own, and the 5-pack is effectively the "one
assessment" tier now. Each option shows per-credit unit price (small, muted) under
the package name and total price (bold, right-aligned):

| Package | Unit price | Total |
| --- | --- | --- |
| 5-Pack | $8.00 / credit | $40.00 |
| 10-Pack | $7.50 / credit | $75.00 |
| 25-Pack | $6.40 / credit | $160.00 |
| 50-Pack | $6.00 / credit | $300.00 — **"BEST VALUE"** badge (accent orange, best
  per-credit rate) |

Selected card: `--color-primary-light` bg, `--color-primary` border, filled radio.
Divider, then "Total due" (label + dollar amount, left) and "Continue to Checkout →"
(primary button, right) + lock icon + "Checkout secured by ThriveCart" microcopy
beneath the button — matches the existing ThriveCart-hosted-checkout pattern from the
ThriveCart Integration Architecture doc; this is not a new payment surface, it's a
CTA into the existing hosted flow.

### No-selection state (modal default on open)

Confirmed as the modal's actual initial state — no package pre-selected. All radios
unchecked, "Total due" shows em-dash, "Continue to Checkout" renders disabled/inert
(muted bg/text, non-interactive) until the coach picks a package.

## Post-purchase banners

All three render as a dismissible-or-not inline notice directly below the H1/button
row, above the summary card. Positioned identically across breakpoints (full-width on
mobile).

### Success

Green checkmark icon, `--color-success-bg` background, "Purchase confirmed — N credits
have been added to your account." **Has a dismiss ×.** Summary stats and history table
reflect the new balance/lot/row immediately — this requires the credit_lot to already
exist server-side by the time this banner renders (see backend note below on the
processing→success handoff).

### Failed

Warning-triangle icon, `--color-error-bg` background, `--color-error` text/border —
"Purchase wasn't completed — your credits haven't changed. Need help? Contact
support@insightoutenneagram.com" (email rendered as a live `mailto:` link, primary
color). **Has a dismiss ×.** Stats/history remain exactly as they were pre-attempt.
Note this state is inherently a "we don't see it landed" signal (timeout-based), not a
confirmed decline — the copy is already worded honestly for that ambiguity; don't
change it to assert a cause we don't actually know.

### Processing

Spinner icon (animate it), `--color-accent-light`-toned background, accent
text/border — "Your purchase is processing — credits will appear in a moment."
**No dismiss × in the mockup — this is deliberate.** The state is transient and
resolves itself via polling rather than being manually dismissible.

## Backend notes

- Confirms and builds on the PR3 audit's finding that `accounts`, `credit_types`,
  `credit_lots`, `credit_transactions` already exist — this screen is their first
  coach-facing UI. Available/Purchased/Complimentary stats are aggregates over
  `credit_lots.quantity_remaining` scoped to the coach's account and the
  `standard_assessment` credit type.
- History requires a join from `credit_transactions` through `credit_lots` (to read
  `source` and derive unit price from `price_paid_cents / lot.quantity`) and through
  `assessments`/`clients` (for the consumption row's client-name description) — use a
  `LEFT JOIN` throughout, since enforcement-disabled consumptions and some other rows
  may have a null `lot_id`.
- Running BALANCE is a true running total, not derivable within a single page — use a
  window function (`SUM(...) OVER (PARTITION BY account_id ORDER BY created_at, id
  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`) over the full history, then
  paginate client-side (recommended, given realistic per-coach transaction volume is
  low — tens, not thousands — and this also cleanly handles the breakpoint-conditional
  page-size default with no double-fetch).
- Assessment consumption cost is **dynamic**, read from wherever the pricing-model PR
  lands it (e.g. `credit_types.current_cost_credits`), not hardcoded. Do not assume
  `-1` anywhere in this screen's queries or rendering.
- Checkout is hosted by ThriveCart (existing integration). "Continue to Checkout"
  hands off to a checkout URL per package — read these from env vars (e.g.
  `THRIVECART_CHECKOUT_URL_5PACK` / `_10PACK` / `_25PACK` / `_50PACK`), matching the
  existing `THRIVECART_WEBHOOK_SECRET` pattern. Cai will populate real values in
  Railway before smoke test/launch — not a code blocker.
- `THRIVECART_SKU_MAP` needs new entries matching the four new package sizes/prices;
  the old Single/5-Pack/10-Pack entries are stale and should be replaced, not
  supplemented.
- Success/Failed/Processing: recommend correlating via the order id ThriveCart passes
  back on its redirect (confirmed available in ThriveCart's return query string, along
  with a verifiable hash) against `credit_lots.purchase_reference` — poll
  `GET /coach/credits/purchase-status?order=<id>` until the lot appears (Success), or a
  timeout is reached (Failed/uncertain). This is grounded in the lot's actual
  existence rather than trusting the redirect alone, which can arrive before the
  asynchronous webhook has processed.
- **Enforcement note (ratified):** `credit_enforcement_enabled` stays FALSE in this PR
  — no backend enforcement change. Because this screen presents balances as a real,
  spendable number, add a small honest note near the Available stat making clear
  balances aren't yet enforced at provisioning time. Suggested copy: "Balances are for
  your reference — provisioning an assessment isn't blocked if you run out." Exact
  placement/wording is CC's call within that intent.

## Breakpoint notes

- **Desktop/Tablet:** identical layout and modal treatment; only the history table's
  UNIT PRICE column and page-size default differ (per above).
- **Mobile:** stacked summary grid, card-per-row history, full-width modal-as-bottom-
  sheet (consistent with the bottom-sheet pattern already established for Create New
  Assessment / Request a Retake in My Clients).

*End of Addendum — v1.0*
