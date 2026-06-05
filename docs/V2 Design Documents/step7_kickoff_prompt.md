# Step 7 — fresh-session kickoff prompt

Paste the block below into a new Claude Code chat to start the Step 7 build.

---

```
We're continuing the Hive Typing Engine v2 migration. Step 6 is done and committed;
this session is STEP 7 — the InsightOut client + coach report overhaul.

ORIENT YOURSELF FIRST (read before proposing anything):
1. docs/V2 Design Documents/step7_plan.md  — the build plan: report_prep.js interface,
   content build-script workflow, 7-phase order, settled decisions, risk notes.
2. docs/V2 Design Documents/hive_insightout_report_design_system_v1_3.md — authoritative
   build reference (Part A shared design system / B coach report / C client report; data
   contract B8 reconciled against this branch).
3. docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx — the static
   content library (v1 DRAFT; 9 types + 27 subtypes; Type 8 is the approved benchmark).
4. My project memory (Hive Typing Engine) for the migration history and decisions.
Also read the current code you'll touch before suggesting edits: the Call #2 path in
app/server.js (/api/submit → runBackgroundJob), app/renderer.js, and callAPI in
app/public/app.js.

BRANCH / SAFETY (important):
- Repo: ~/Developer/hive-typing-engine. Work happens on local branch `main`, which TRACKS
  origin/typing-engine-v2. Routine `git push` goes to origin/typing-engine-v2.
- NEVER push to origin/main — that's what production deploys from. Pull latest from
  origin/typing-engine-v2 before starting.

SETTLED DECISIONS — do NOT re-litigate (detail in step7_plan.md):
1. Engine TYPE_NAMES are the source of truth; the content-library headings for types
   1/3/4/6 are stale labels to correct in the docx.
2. active_wing is dropped — render both wings, assert neither.
3. Static content is looked up at RENDER time (persist only personalized AI output).
4. Prep layer = a new server-side module app/report_prep.js; renderer.js becomes pure.
5. Content build script parses the .docx directly into content/content_library.json.
6. Validation gate is split: word-count proxy from Phase 4; real Puppeteer zone-measurement
   hard gate from Phase 5; auto-regeneration loop deferred to Phase 7.
7. Call #2 delta is small (mostly reuse via prep; ~3 genuinely new fields).

CONTENT STATUS:
- Mo's content review is in progress (a few days out). Treat the content library as DRAFT
  and build templates/structure against it NOW — do not wait for Mo. Because static content
  is a render-time lookup, finalized prose swaps in later with no structural change and no
  AI re-run, retroactively across all reports. Only flag if a proposed content change would
  alter STRUCTURE (a new field/zone) — that's the rare, non-trivial case.

HOW I WORK:
- Present a plan for each phase and get my EXPLICIT confirmation BEFORE writing any code.
  Start with Phase 0 (reconciliation spike) — propose the exact steps and wait.
- Each phase = one verified commit on this branch.
- Run tests with ABSOLUTE paths only; never bare `node tests/run_test.js`.
- The ANTHROPIC_API_KEY is NOT in your shell, so you can't make live AI calls. When a step
  needs a live call, prepare the harness/inputs and I'll run it and paste results back.
- Self-check your work against the plan before presenting; don't call a phase done until
  its verification step passes.

Start by confirming you've read the four sources above, give me a 3–5 line summary of the
Phase 0 scope as you understand it, then propose the Phase 0 plan for my approval.
```
