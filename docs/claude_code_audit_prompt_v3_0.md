# Claude Code Audit Prompt — InsightOut Client Report v3.0

Paste the following into a fresh Claude Code session.

**Before you start:** place these four files in `/docs` in the repo:

- `hive_insightout_client_report_design_spec_v3_0.md`
- `insightout_client_report_full_draft_080726.pdf`
- `type_library_name_patch_080726.json`
- `insightout_all18_diagrams_check.png`

Also place the twelve reference HTML files in `/docs/mockup/`:
`claude_The_Peacemaker_Page_*.html`

---

## PROMPT

```
Start by pulling the latest from GitHub so you are working against current main.

## This is an investigation. Do not change anything.

Do not edit, create, delete, refactor, or reformat any file. Do not run migrations, do not
install packages, do not open a PR. Read only. If you find something obviously broken, note
it in your report rather than fixing it.

The single deliverable is a written feasibility report.

## Context

We have redesigned the InsightOut client report. The design is locked; content and engine
work have not started. Read these first, in this order:

1. /docs/hive_insightout_client_report_design_spec_v3_0.md — the specification
2. /docs/insightout_client_report_full_draft_080726.pdf — the twelve-page rendered mockup
3. /docs/mockup/*.html — twelve reference implementations, real HTML rendered through
   headless Chromium
4. /docs/insightout_all18_diagrams_check.png — all 18 Enneagram diagrams, contact sheet
5. /docs/type_library_name_patch_080726.json — a corrected type library (see spec §4.1)

The mockup HTML is the reference implementation, not a visual comp. Every page has been
measured to fit exactly one US Letter sheet. Spec §3 lists constraints that were discovered
by rendering rather than chosen stylistically — each states its reason, so you can evaluate
them rather than either following blindly or optimising them away.

Two things about the mockup that are easy to misread:

- It is hand-built for one client (Anders Wennerstrom, Type 9, SX9 subtype). Some values are
  structural and must not change; others are Type 9 content that varies per client. Spec §3
  tells you which is which. Where it is ambiguous, ask rather than assume.
- Some copy in it is placeholder. Spec §7.2 lists exactly what. Do not build content
  structures that assume that text is final.

## Answer this one question first, before writing the rest

**Should the report generator use the mockup HTML files as templates, or be rebuilt in the
production framework using them as visual reference?**

Give a recommendation with reasoning. The answer changes the shape of everything after it,
including where CSS consolidation lands in the PR sequence. If you want to discuss it before
writing the full report, stop here and raise it.

## Then produce the feasibility report

### 1. Current-state inventory

What exists today that produces the client report. Files, modules, entry points, the render
pipeline, where content lives, where type data lives, how the PDF is currently produced.
Include how the coach report is generated if it shares any of this.

### 2. Create / modify / obsolete

Every file or module that will need to be created, modified, or obsoleted, with a one-line
reason for each. Be specific about paths. Flag anything the coach report also depends on —
we do not want to break it.

### 3. Content audit

This is the part we most need, because Cai and Mo will do the content authoring by hand.

For every content zone in the twelve pages, tell us:

- **Leverage as-is** — exists in the current CMS or codebase and can be used unchanged
- **Leverage with edits** — exists but needs rework (say what kind)
- **Create from scratch** — does not exist anywhere

Group by page, and give totals per category. Where content exists, say where it lives.

Pay particular attention to:
- Wings and Lines narratives (spec says these are already authored — verify)
- The three subtype comparison columns
- The three instinct definitions
- Whether Communication Style and Conflict Style content in the current report can be reused
  for the p7 style chicklets, given those were derived differently in the mockup
- Anything in the current report that is now orphaned by the removal of "At Work",
  "In Relationships", and the alternate type page

Count zones. We need to know whether we are authoring 40 units or 400.

### 4. Answer the open questions

Spec §8 lists eight. Answer each against the actual codebase. In particular:

- **Question 4** is a blocker: does the client report generator have access to all nine type
  scores and the three instinct scores today, or is that coach-report-only? The Quick
  Reference page cannot be built without them.
- **Question 6** (editable PDF fields) — scope it, then recommend in or out for v1.

### 5. Corrections

Spec §4 lists three bugs found during design that are independent of this redesign:
four wrong archetype names in type_library.json, a reversed triangle sequence and security
arrow in the design system, and unreliable data in the v3 mockup. Confirm each against the
codebase, say what else references them, and say whether they should be fixed in their own
PR ahead of the redesign or folded into it.

### 6. Recommended PR sequence

Propose the build as a sequence of PRs. For each: what it does, what it depends on, what
could break, and how we would validate it before merging.

Constraints on the sequence:
- One PR at a time. We validate each before starting the next.
- Nothing that breaks the currently working report and coach report while in progress.
- Spec §9 suggests the first milestone is one type, one page, end to end — data in, PDF out,
  single-sheet assertion passing, with Your Wings as the page. Tell us if you disagree.

Say where CSS consolidation belongs in the sequence (spec §8 question 2: 478 rules across
twelve inline style blocks, no shared stylesheet, 39 hex values of which only 18 are real
tokens).

### 7. Risks

What worries you. Anything in the spec that is underspecified, internally inconsistent, or
that you think is wrong. Anything in the current codebase that makes this harder than it
looks. Be direct — we would rather hear it now.

## Output

Write the report to /docs/feasibility_report_client_report_v3.md and summarise the key
findings in your response. Do not change any other file.
```

---

## Notes for Cai

**Three things worth deciding before or during the CC session:**

1. **Whether to split the corrections out first.** The four archetype names and the reversed
   triangle sequence are real bugs affecting the current coach report, independent of this
   redesign. A small PR fixing those before the redesign starts is low-risk and clears the
   ground. CC is asked to recommend, but you may already know the answer.

2. **Whether the coach report is in scope.** The spec moves the alternate-type discriminator
   treatment *to* the coach report. That is a coach report change we have not specified. It can
   wait, but CC should know it is coming so it does not design the client report in a way that
   makes it awkward.

3. **What "done" means for PR 1.** If the first milestone is one page end to end, decide now
   whether that page must be pixel-identical to the mockup or merely structurally correct.
   Pixel-identical is a much higher bar and worth choosing deliberately.
