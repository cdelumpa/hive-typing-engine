'use strict';
/**
 * Shared stylesheet for the v3 client report.
 *
 * SCOPE: v3 client pages only. The coach report pulls partAStyles() + coachReportStyles()
 * and never sees this file, so nothing here can affect it. partAStyles() is deliberately
 * NOT modified — it is the one stylesheet both reports share.
 *
 * WHAT IS SHARED AND WHAT IS NOT
 * ------------------------------
 * Measuring the twelve reference implementations found 285 unique selectors, of which only
 * 9 were byte-identical across pages and 15 were defined DIFFERENTLY on different pages.
 * The other 261 are single-page component CSS and stay with their page.
 *
 * The 15 conflicts are almost entirely spacing, and the spacing is load-bearing: `.lead`
 * carries margin-bottom 24px on five pages, 18px on CAR, 16px on Instincts, 6px on Wings
 * and none at all on Lines. Those values were tuned per page to hit the single-sheet fit,
 * with pages measured between 930 and 1047px against a 976px budget. Hoisting the common
 * 24px would silently add 18px to Wings and 24px to Lines — exactly the invisible
 * regression design spec v3.0 section 3.1 describes, where two overflows were caught only
 * by counting pages in the output PDF.
 *
 * So: this sheet carries INVARIANTS only — colour, font-size, line-height, weight,
 * letter-spacing. Every page-variable margin is an explicit `is-` modifier applied at the
 * call site. A page that needs different spacing says so in its markup rather than
 * inheriting a value that happens to suit five other pages.
 *
 * TOKENS
 * ------
 * Design spec section 5 lists 18 system tokens. The "appears on 3+ pages" heuristic does
 * not hold in either direction — 8 of the listed tokens appear on only 1-2 pages (they are
 * tokens by role: stress node, evidence background), and several non-tokens appear on many.
 * Tokens below are therefore taken from section 5.1/5.2 by role, not by frequency.
 *
 * Deliberately NOT a token: #F0F0F0. It is the browser-only page surround and never
 * reaches the PDF, so it is not emitted here at all.
 *
 * NAMESPACING (section 3.4)
 * -------------------------
 * Generic names (.lead, .sub, .note, .eyebrow, .page) are owned by this sheet. Component
 * modifiers MUST be prefixed `is-`. This bit twice during design, both times invisibly:
 * `class="krow lead"` picked up .lead's font-size and bottom margin, and `class="hhd sub"`
 * picked up .sub's margin. The tracked mockup already complies (`hhd is-sub`, `krow
 * is-lead`); keep it that way.
 */

function clientReportV3Styles() {
  return `<style>
/* Reset. Not cosmetic: the reference implementations all carry it, and every page in the
   set was measured with it applied. Without it the browser's default h1/h2/p margins are
   added on top of the measured layout — the Wings page rendered 1136px against a 1056px
   sheet on first build, which the single-sheet gate caught. */
.v3-page, .v3-page *{ margin:0; padding:0; box-sizing:border-box; }
/* body is outside the .v3-page selector above, so its 8px UA default margin survives the
   reset and shifts every page down by 8px — invisible on screen, but it moves content
   relative to the sheet in print. The reference implementations zero it globally. */
body{ margin:0; padding:0; background:#FFFFFF; }

:root{
  /* Core tokens — spec 5.1 */
  --v3-cyan:#00B2D9;          /* eyebrows, accents, home type, active state */
  --v3-navy:#1E2A35;          /* primary text, headings */
  --v3-soft-navy:#4A5568;     /* secondary text */
  --v3-grey:#6B7785;          /* labels, tertiary text */
  --v3-rule:#C8D0D9;          /* rules, borders */
  --v3-orange:#F68625;        /* CLIENT IDENTITY ONLY — spec 5.3 */
  --v3-leading-bg:#D9E4E9;    /* framework panels */
  --v3-border:#E8ECF0;        /* card borders */
  --v3-panel:#F7FBFC;         /* card headers */
  --v3-alt-bg:#F5F5EE;        /* quote blocks */
  /* New tokens — spec 5.2 */
  --v3-subtype-bg:#F9E7D2;
  --v3-subtype-label:#C2650F;
  --v3-evidence-bg:#FDF3E9;
  --v3-green-fill:#E8F4E8;    /* resource bands */
  --v3-green-label:#2D7A2D;
  --v3-red-fill:#FAE8E8;
  --v3-red-label:#A32D2D;
  --v3-stress:#D38481;
  --v3-security:#4F845C;
  /* Page-local values kept deliberately (documented, not near-duplicates):
     #E4E9ED inactive diagram strokes · #8A96A3 inactive node labels
     #A8BFCA rule accent · #E8E4DF One-wing header, pairs with --v3-leading-bg */
  --v3-diagram-line:#E4E9ED;
  --v3-diagram-inactive:#8A96A3;
  --v3-accent-rule:#A8BFCA;
  --v3-wing-alt-bg:#E8E4DF;
}

/* ── Page shell ───────────────────────────────────────────────────────────── */
.v3-page{
  width:816px; min-height:1056px; background:#FFFFFF; margin:0 auto;
  padding:40px 53px; display:flex; flex-direction:column;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
  font-family:Arial, sans-serif;
}
.v3-page + .v3-page{ page-break-before:always; }

/* ── Page chrome ──────────────────────────────────────────────────────────── */
.v3-page .page-header{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; }
.v3-page .header-left{ font-size:10px; font-weight:bold; color:var(--v3-cyan); text-transform:uppercase; letter-spacing:.12em; }
.v3-page .header-right{ font-size:10px; color:var(--v3-grey); }
.v3-page .header-client{ color:var(--v3-orange); font-weight:bold; }

/* Rule spacing varies per page (18-28px across the set) — modifier, never inherited. */
.v3-page .header-rule{ height:1px; background:var(--v3-rule); }
.v3-page .header-rule.is-tight{ margin-bottom:18px; }
.v3-page .header-rule.is-default{ margin-bottom:22px; }
.v3-page .header-rule.is-loose{ margin-bottom:26px; }
.v3-page .header-rule.is-x-loose{ margin-bottom:28px; }

.v3-page .page-footer{
  margin-top:auto; padding-top:10px; border-top:1px solid var(--v3-rule);
  display:flex; justify-content:space-between; font-size:8px; color:var(--v3-rule);
}

/* ── Typography — invariants only, spacing via modifiers ──────────────────── */
.v3-page .eyebrow{ font-size:10.5px; font-weight:bold; color:var(--v3-cyan); text-transform:uppercase; letter-spacing:.12em; margin-bottom:8px; }
.v3-page .eyebrow.is-loose{ margin-bottom:10px; }
.v3-page .eyebrow.is-x-loose{ margin-bottom:16px; }

.v3-page h1{ font-size:24px; color:var(--v3-navy); font-weight:bold; margin-bottom:12px; }
.v3-page h1.is-loose{ margin-bottom:14px; }
.v3-page h2{ font-size:16px; color:var(--v3-navy); font-weight:bold; margin-bottom:10px; }
.v3-page h2.is-tight{ margin-bottom:8px; }
.v3-page h2.is-loose{ margin-bottom:14px; }

/* .lead margin is page-variable (24 / 18 / 16 / 6 / 0). No default — always a modifier. */
.v3-page .lead{ font-size:14px; color:var(--v3-soft-navy); line-height:1.55; }
.v3-page .lead.is-flush{ margin-bottom:0; }
.v3-page .lead.is-x-tight{ margin-bottom:6px; }
.v3-page .lead.is-tight{ margin-bottom:16px; }
.v3-page .lead.is-mid{ margin-bottom:18px; }
.v3-page .lead.is-loose{ margin-bottom:24px; }

.v3-page .sub{ font-size:13px; color:var(--v3-grey); line-height:1.5; }
.v3-page .sub.is-tight{ margin-bottom:12px; }
.v3-page .sub.is-loose{ margin-bottom:14px; }

.v3-page .note{ font-size:11.5px; color:var(--v3-grey); font-style:italic; line-height:1.45; }

/* ── Diagram container — 430x252 (~1.71:1). Must NOT reuse a square container. ── */
.v3-page .v3-dia{ flex:0 0 378px; }
.v3-page .v3-dia svg{ display:block; width:378px; height:222px; }
</style>`;
}

module.exports = { clientReportV3Styles };
