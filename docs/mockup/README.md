# InsightOut Client Report v3.0 — Design Handoff

**Date:** 7 August 2026
**For:** Claude Code audit session
**From:** Design / solution architecture

---

## What this is

A complete redesign of the InsightOut client report. Twelve pages, design locked, content and
engine work not started.

The mockup is **not a visual comp**. It is real HTML rendered through headless Chromium via the
same `Page.printToPDF` call Puppeteer uses. Every page has been measured to fit exactly one US
Letter sheet.

---

## How to use this package

1. Unzip into the repo root. Everything lands under `/docs`.
2. Open a fresh Claude Code session.
3. Paste the contents of `docs/claude_code_audit_prompt_v3_0.md` into it.

The prompt instructs Claude Code to pull from GitHub first, change nothing, and produce a
feasibility report at `docs/feasibility_report_client_report_v3.md`.

---

## Contents

| File | What it is |
|------|------------|
| `claude_code_audit_prompt_v3_0.md` | **Paste this into Claude Code.** The audit brief |
| `hive_insightout_client_report_design_spec_v3_0.md` | The specification. Constraints, tokens, guardrails, corrections, open questions |
| `insightout_client_report_full_draft_080726.pdf` | The twelve-page rendered mockup |
| `mockup/` | Twelve reference implementations, one HTML file per page |
| `mockup_file_manifest.md` | Which file is which page, plus three superseded drafts to ignore |
| `insightout_all18_diagrams_check.png` | All 18 Enneagram diagrams (9 types × 2 page types), verified |
| `type_library_stress_security_primer_draft_080726.json` | **Do not apply.** Originally circulated as a "name patch", but its archetype names are already identical to `type_library.json` — it corrects nothing. Its only real delta is an unreviewed rewrite of the `static_primers` stress/security prose. Renamed 11 Aug 2026 so it is not mistaken for a safe patch; treat the prose as a draft to be reviewed on its own merits |

---

## Read the spec before the mockup

Several things in the mockup look like stylistic choices and are not. Spec §3 lists constraints
discovered by rendering, each with its reason:

- No `transparent` or `rgba()` in print CSS — it makes Chromium emit soft masks that some PDF
  viewers render with a colour cast
- Every page must assert to exactly one sheet — two overflows during design were invisible in code
- Diagram label positions must be verified by rendering, not derived from a formula — three
  separate bugs were found this way
- CSS component modifiers need an `is-` prefix — a class-name collision with the shared page CSS
  bit twice

---

## Three things to know going in

**The mockup is one client.** Anders Wennerstrom, Type 9, SX9. Some values are structural and must
not change; others are Type 9 content that varies. Spec §3 says which.

**Some copy is placeholder.** Spec §7.2 lists exactly what. Do not build content structures that
assume that text is final.

**Content authoring is not in scope for Claude Code.** The design team is writing it by hand. Gaps
should be logged as gaps, not filled.

---

## The ask

A feasibility report. What needs creating, modifying, or obsoleting; what content can be leveraged
from the current report and what must be written from scratch; and a recommended PR sequence.

No code changes in this session. We will ratify the report, agree a build plan, then take one PR
at a time.
