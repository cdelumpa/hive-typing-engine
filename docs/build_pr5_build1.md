# PR 5 Build 1 — data exposure, the shared instinct rule, and the harness

Branch `pr5-build1-data-exposure`, off `main @ 216e926`. Scope and assertions from
`docs/audit_pr5_quickref.md` **§22.4d** (not §§19–21 — see the build report).

**Every number below is labelled `[MEASURED]` or `[ESTIMATED]`.** On the docs PR the whole
wall-clock deviation sat in unlabelled estimates while the one scaled figure held to 4.9%, so
nothing here carries a decimal point without saying where it came from.

---

## 1. Predictions, committed before the code changed

### 1.1 What the build will and will not move

| # | Prediction | Basis |
|---|---|---|
| P1 | **The v3 client HTML is byte-identical before and after the ENTIRE build**, for all nine types — not just after the `instinctRanks` extraction. | `[MEASURED]` No v3 page builder reads `m.alternate` or `confidence.near_tie` (`awk 'NR>3140' app/renderer.js \| grep` → no hits; the three readers are `:1576` coach and `:2076`/`:2106` v2 p3). Nothing renders `charts.types` yet. So every change in this build is invisible to the emitted document. |
| P2 | **The 27-render 3×9 instinct matrix stays green**, and it is a weaker statement than P1. | `[MEASURED]` — it is the gate; P1 is the proof. |
| P3 | **`charts.types` will carry exactly 9 entries** for all three fixtures. | `[MEASURED]` — all three `*_api_result.json` carry `call1_ranking` at 9/9 (audit §20.1). |
| P4 | **The page count does not change: 10.** No `V3_PAGE_ORDER` edit, no tripwire edit. | `[MEASURED]` — `report_page_inventory.js:47` is `client_v3: { 'v3-page': 10 }` and this build does not touch it. |

### 1.2 A7, red first

| # | Prediction | Basis |
|---|---|---|
| P5 | A7 fails on **exactly 8 of 9 types** for `anders_sx9` (types 1–8) and **0 of 1** for `sp4`. | `[MEASURED]` — the table in audit §19.1. `asType 9` passes because `leading_candidate` is already 9 and `call1 #1` is already 9. `sp4` renders only at its own type 4, so its scalars already agree. |
| P6 | The red run fails **on the assertion's own message**, not on a `TypeError`. | `[ESTIMATED]` — it is what the assertion is written to do; the proof is the captured text. |

### 1.3 Gates

| # | Prediction | Basis |
|---|---|---|
| P7 | **Coach byte-diff: HTML half PASSES, PDF half SKIPS.** A local pass is a **HALF-RESULT** and is not something to merge on. | `[MEASURED]` — this machine printed `COACH BASELINE: ALL PASSED — HTML only (PDF half skipped off-Linux)` earlier today. |
| P8 | All six gates green after the build. | `[MEASURED]` premise (P1: no rendered output moves) + `[ESTIMATED]` conclusion. |

### 1.4 Timings — local, on this machine

Baselines measured on `main @ 216e926` earlier today, macOS, Chromium 147.0.7727.57:

| Gate | Baseline `[MEASURED]` | Predicted after the build | Label |
|---|---|---|---|
| `npm test` | 0.31s | 0.3–0.5s | `[ESTIMATED]` |
| `npm run verify:render` | 52.53s | 52–56s | `[ESTIMATED]` |
| `verify_diagrams.js` | 0.95s | 0.9–1.0s | `[ESTIMATED]` — untouched |
| `verify_transparency.js` | 2.89s | 2.8–3.0s | `[ESTIMATED]` — untouched |
| `verify_coach_baseline.js` | 2.85s | 2.8–3.0s | `[ESTIMATED]` |
| `verify_content_library.js` | 0.22s | 0.2–0.3s | `[ESTIMATED]` — untouched |

**The four "untouched" rows are the honest ones**; the two that could move are `verify:render`
(the harness changes) and `npm test` (new assertions). **No CI prediction is made** — this prompt
stops at the commit, so no CI runs.

**A note on the estimate labels, given the docs-PR finding.** The only figures with a measured
basis are the baselines. Every "predicted after" cell is an estimate, and the honest content of
each is "roughly unchanged, because the work added is small next to 27 renders." If one of them
moves by more than a few percent that is a finding.

---
