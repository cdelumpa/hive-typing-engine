# PR 1.5 — Content Library Reconciliation: Pre-Build Audit

**Prepared by:** Claude Code (lead engineer / QA)
**Date:** 12 August 2026
**Against:** `main` @ `7e75e27` (PR 1 and PR 1.1 merged)
**Scope:** Investigation only. No files changed outside this document. Reconciliation not started.

**Provenance convention:** every number below is labelled **measured** (with the command or method that produced it), **derived** (with the assumption named), or **aggregate** (with the set named).

---

## Verdict up front

**Reconciliation is cheaper and lower-risk than the framing assumed. Proceed.**

The four things that could have made this expensive are all absent:

- The drift is **uniformly "JSON wins"** — not a mixed bag needing content review (§2).
- Every one of the 132 target passages is **uniquely locatable** in the docx, with **zero ambiguous matches** (§4).
- Verification is **exact and self-proving**, not an eyeball review (§5).
- Both artifacts are **git-tracked**, so there is no unrecoverable state (§6).

The one genuine judgement call is cosmetic and output-irrelevant: 28 paragraphs carry bold formatting that 20 of the edits disrupted (§4.4). Word formatting has **no effect on the build output** — the parser reads text only — so this cannot threaten the output-neutrality gate.

**The escape hatch does not need to be taken.** But there is a durability problem worth naming plainly, and it is not solved by this PR: nothing prevents the same drift recurring (§3.3).

---

## 1. The split — 130 replaces, 0 orphans, 2 deletions

**Method (measured):** built the docx into a scratch copy via `node scripts/build_content_library.js --accept-drift`, restored the committed file immediately (verified `git status` clean), then flattened both JSON trees to leaf paths and compared.

| Group | Count | Meaning |
|---|---|---|
| **A. In both, text differs** | **130** | A replace: patch the docx passage |
| **B. In JSON only, no docx counterpart** | **0** | — |
| **C. In docx only, JSON lacks it** | **2** | A deletion: remove the docx passage |

**Group B is zero, and that is a PR 1 artifact worth understanding.** `wings_using` and the v3 wing fields *do* lack docx counterparts, but PR 1 restored them as `INTERIM_*` constants inside the build script, so the script now emits them. They are produced by code, not by Word. **To make Word genuinely canonical they still need Word sections** — that is real remaining work, but it is not part of the 130 and it belongs with the content PR, not here.

### 1.1 Where the 130 live (measured, by leaf path prefix)

| Area | Fields | Character |
|---|---|---|
| `subtype_*` | **117** | 16 of 27 subtypes; 103 pattern bullets + 14 narratives |
| `type_*` | **9** | **All nine** are `type_N.lines.stress.narrative` — one systematic fix |
| `static.*` | **4** | `primer.intro`, `primer.footer`, `primer.nine_types[4].description`, `wings_primer` |

The 9 type-level fields being *exactly* the nine stress narratives, and the subtype count being *exactly* 16, is the first clue to provenance — both match commit messages precisely (§3).

### 1.2 The 2 deletions

`subtype_sx8.patterns.behaving[2]` and `subtype_sp9.patterns.behaving[2]`. The docx has a third bullet; the JSON has two.

**Measured:** at the first committed build (`74a8e76`) both arrays had 3 bullets; at `05b165a` both had 2. They were trimmed by *"content: P6 subtype trims (16 subtypes, approved by Mo)"* — layout-driven removals to stop page spill. **Deliberate, approved deletions**, so the JSON is ahead in this direction too.

---

## 2. Which side is right — measured, not assumed

**The JSON wins on all 132. Uniformly. This is not an assumption.**

Two independent lines of evidence:

**2.1 The docx has not been touched since the JSON was built from it (measured, `git log`).**

```
2026-08-11  JSON  4e0121d  PR 1: make the content library build non-destructive
2026-06-18  JSON  36aab5c  migrate Using Your Wings and Lines block to CMS
2026-06-13  JSON  d6cbc79  async render collateral + retire welcome_body
2026-06-12  JSON  dafe741  wings primer — 'adding texture' → 'adding color and texture'
2026-06-12  JSON  9338ea3  global static content pass 1 (approved edits)
2026-06-12  JSON  873cbf3  refine Type 4 primer description
2026-06-12  JSON  6aca4d4  correct stress-narrative dangling modifier + remove stale SP9 artifact
2026-06-12  JSON  42004aa  static.primer.intro — reword second sentence
2026-06-08  JSON  2832500  move content_library.json under app/
2026-06-07  JSON  6c1999f  P6 content trims v1.3: SX5 + SP2 pattern bullets
2026-06-07  JSON  05b165a  P6 subtype trims (16 subtypes, approved by Mo)
2026-06-05  DOCX  ac41d71  Step 7 Phase 0: reconciliation spike        <-- last docx change
2026-06-05  DOCX  5cf0ba2  Step 7: populate static.* globals
2026-06-05  DOCX  2ad5b27  Step 7 planning artifacts
```

Every JSON content commit post-dates every docx commit. **There is no window in which someone could have edited the docx without rebuilding** — the docx's last write is 5 June, and the JSON's first content edit is 7 June.

**2.2 The JSON began as a faithful build of this exact docx (measured).**

Comparing the first committed library (`74a8e76`, 5 Jun, at its original path `content/content_library.json`) against today's docx build:

```
common leaf fields: 1290    differing: 3    (all three in static.*, which was populated later)
```

**1287 of 1290 fields identical.** The JSON started as clean output of this docx. Therefore every one of the 132 differences is a later, deliberate edit to the JSON — there is no "the docx is ahead" case anywhere in the set.

**Consequence:** reconciliation is a **mechanical patch**, not a content review. Nobody needs to adjudicate 130 fields.

---

## 3. How the drift happened

### 3.1 Mechanism: direct edits to the committed JSON. Not overrides.

**Measured:** every drifted field maps to an identifiable commit that edited `content_library.json` directly. The DB-published override path (`content_overrides.js`) is **not** implicated — overrides are applied at *render* time by `resolveLibObject()` and never written back to the JSON. Nothing in the repo writes that file except `build_content_library.js` and human commits.

| Commit | What drifted | Fields |
|---|---|---|
| `05b165a` *P6 subtype trims (16 subtypes, approved by Mo)* | subtype patterns + narratives | ~115 |
| `6c1999f` *P6 content trims v1.3: SX5 + SP2 pattern bullets* | 2 more subtypes' bullets | ~2 |
| `6aca4d4` *correct stress-narrative dangling modifier* | all 9 `lines.stress.narrative` | 9 |
| `42004aa`, `9338ea3`, `873cbf3`, `dafe741` | `static.primer.*`, `wings_primer` | 4 |

The 16-subtype count in `05b165a`'s message matches the measured 16-of-27 exactly.

### 3.2 Why it happened: the edits were layout fixes, made where the layout was measured

These were not careless. They were **page-fit trims approved by Mo** — the P6 subtype page was spilling, and the fix was to shorten bullets. That work happened against the rendered output, so the JSON was the natural place to edit. The round trip to Word was skipped because nothing required it and nothing detected it.

There is corroborating evidence that a partial reconciliation was already attempted: `57d2505 docs: global static content editing doc v1.4 (current JSON state — PRs #13-#16)` created `docs/InsightOut_Global_Static_Content_v1_4_061226.docx` **to capture the JSON state in Word form**. That document covers the `static.*` globals only — 4 of the 130 — and was never fed back into the build input.

### 3.3 🔴 Durability — the part this PR does not fix

**Reconciliation makes the two sides agree once. It does nothing to keep them agreeing.**

The exact conditions that produced this drift are unchanged after PR 1.5:

- `content_library.json` remains tracked, editable, and the fastest place to fix a layout spill.
- The next page-fit crisis will present the same temptation, with the same justification.
- PR 1's drift guard blocks *silent loss*, but it fires at **rebuild** time — which may be weeks after the edit, and its only remedies are "reconcile again" or `--accept-drift`.

So the realistic forecast is: reconcile now, drift again during PR 3 (the tightest fitting PR, ~296 content units), and rediscover this. **The guard converts silent corruption into a blocked build — a real improvement, but it is a smoke alarm, not a sprinkler.**

The cheap durable fix is a CI check asserting `content_library.json` equals a fresh build of the docx (modulo `_meta`), so a direct JSON edit fails the PR that makes it, at the moment it is made. That is roughly 10 lines on top of `verify_content_library.js`, which already computes the comparison. **I recommend it ships with this PR** — reconciling without it means doing this again.

---

## 4. Is programmatic patching feasible? Yes — 132/132 locatable, 0 ambiguous

**Method (measured):** extracted `word/document.xml` (782,229 chars; 1,805 `<w:p>` paragraphs; 1,979 `<w:t>` runs), rebuilt the build script's own tokenisation, and matched every target passage against paragraph text.

### 4.1 Location

| Outcome | Count |
|---|---|
| Unique whole-paragraph match | **116** |
| Multi-paragraph field, every constituent uniquely located | **15** |
| Sub-paragraph field (pipe-delimited table cell) | **1** |
| **Ambiguous (>1 candidate)** | **0** |
| **Not locatable** | **0** |

Nothing in the set is ambiguous. The build script's parse is deterministic and paragraph-oriented, so patching can address paragraphs **by index** rather than by string search — which removes the usual "same sentence appears twice" hazard entirely.

The 15 multi-paragraph fields are narratives joined with `\n\n`; each constituent paragraph is uniquely locatable and single-run. The 1 sub-paragraph case is `static.primer.nine_types[4].description`, a 5-field pipe row (paragraph #1788, single run) — the delimiters make the boundary unambiguous.

### 4.2 Fragmentation

Across the whole document, 187 of 1,805 paragraphs (10.4%) are split across multiple runs. **Within the 132 targets: 28 are fragmented, all exactly 2 runs; 104 are single-run.**

### 4.3 The fragmentation is semantic, not accidental

**Measured:** all 28 split at a word boundary immediately after an em-dash, and **all 28 carry an explicit `<w:b/>`** on the first run:

```
run0: 'Attention lands on group dynamics first —'          <- bold
run1: " who has power, who's being marginalized, …"
```

This is the bold lead-in pattern that commit `6c1999f` records as deliberate: *"Source ** bold markers stripped — pending coordinated bold lead-in pass across all 27 subtypes + renderer support (Mo intent recorded in v1.3 source)."*

### 4.4 The only judgement call — and why it cannot affect the gate

Of the 28 fragmented paragraphs (measured):

- **8** — the new JSON text still begins with run0 verbatim → patch run1 only, **bold preserved automatically**.
- **20** — the edit rewrote the lead-in itself. Of these, only **2** contain a single em-dash from which a split point could be inferred; **18** dropped the em-dash construction entirely (`"X — y"` became `"X and y"` or `"X. Y"`), so there is no machine-inferable bold boundary.

**Critically, this cannot threaten output-neutrality.** `tokenize()` extracts `<w:t>` text and discards all formatting, so **bold has zero effect on `content_library.json` and therefore zero effect on any rendered report.** It is a Word-side authoring affordance only.

**Recommendation:** preserve bold on the 8 where it is free; collapse the other 20 to a single run. The bold in the docx is already mid-migration by Mo's own note — a coordinated bold lead-in pass across all 27 subtypes is a known pending task, and collapsing 20 runs does not destroy a finished state. Record it so the pending pass knows what it is re-applying. **Do not spend 18 human decisions on formatting that has no output effect and is scheduled to be redone.**

---

## 5. Does the verification actually work? Yes — and it is self-proving

**Byte-identical is achievable for the content, and exactly one field must be normalized: `_meta`.**

Three measured results:

1. **No structural noise.** Comparing committed vs docx-build ignoring `_meta`: key order and container shape are identical everywhere **except** the two arrays holding the deleted bullets. There is no whitespace, escaping, ordering, or Unicode drift to normalize away — the *only* differences are the 132 content ones.

2. **Serialization is already exact.** Re-serializing the committed JSON with the script's settings (`indent=2`, non-ASCII preserved, trailing newline) reproduces the committed file **byte-for-byte: True**. The committed artifact is already in precisely the form the script emits.

3. **`_meta` will differ, expectedly.** Committed still carries the old `built_at: 2026-06-07…` (PR 1 hand-edited the file rather than rebuilding). A rebuild emits `source_sha256`, and that hash **must** change because the docx changes. This is a one-time schema catch-up, and the changing hash is *evidence the patch landed*, not noise being suppressed.

### 5.1 The gate — and yes, I agree it is the right one

**I agree that output-neutrality is the correct pass/fail criterion, and it is achievable.** It is stronger than a docx review because it is mechanical and total: it checks all ~1,300 leaf fields, not the 132 someone remembered to look at.

Better still, the check is **self-proving with no new tooling**:

> After patching, `node scripts/build_content_library.js` must succeed **without `--accept-drift`.**

The drift guard refuses when any existing field would change or vanish, and it already skips `_meta`. If it writes without refusing, the rebuilt content is identical to the committed content **by construction**. The success condition is literally "the guard stops objecting."

**Full gate:**

| Check | Expected |
|---|---|
| Build without `--accept-drift` | Succeeds (guard reports nothing) |
| `git diff app/content/content_library.json` | **`_meta` only** — `built_at` → `source_sha256` |
| Client HTML, both fixtures | **byte-identical** |
| Coach HTML + normalized PDF hash | **byte-identical / unchanged** (`verify_coach_baseline.js`) |
| `verify:render` single-sheet | unchanged |
| `verify_diagrams.js` | unchanged (not content-dependent) |

If any rendered byte moves, the patch is wrong. That is the whole point.

---

## 6. Rollback

**`docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx` is git-tracked** (measured: `git ls-files`; 3 commits, last `ac41d71`, 5 Jun 2026). `content_library.json` is tracked too.

**Recovery is `git checkout` on either artifact.** Both sides of the operation are versioned, so a botched patch is recoverable in one command.

**Is there a state with neither a good docx nor a good JSON? No — with one caveat.**

The JSON is only written by the build script, and the guard refuses to write while content would change. So a partially-patched docx **cannot** corrupt the JSON: the build simply refuses. The only way to write bad content is to pass `--accept-drift` against a partially-patched docx — which would overwrite the JSON with partial content.

**Mitigation, and it is absolute: `--accept-drift` must never be used during reconciliation.** It is not needed. A correct patch makes the guard pass on its own; an incorrect patch should be fixed in the docx, not forced past the guard. I would go further and suggest the flag be removed once reconciliation lands, since its only legitimate use was the pre-reconciliation state.

Standard precaution: commit or stash before starting, so `git checkout` is a clean escape.

---

## 7. Where the plan is wrong, and scope opinions

**7.1 On the two deferred items — I agree with both, with one addition.**

- **No new content in this PR.** Agreed, and the reasoning is exactly right: output-neutrality is the gate, and content changes output. Adding the nine types' Wings content here would make it impossible to tell a patch error from an intended change.
- **The ~10-line parser extension travels with the content.** Agreed, for the same reason — but note the extension is *output-neutral in isolation* (new fields nobody reads yet). The stronger argument is coupling: the parser change is untestable without the Word sections it parses.

**7.2 Add the recurrence guard to this PR (§3.3).** This is my one substantive disagreement with the scope as framed. Reconciling without asserting the invariant in CI means the same drift returns during PR 3, and PR 1.5 gets repeated. The check is ~10 lines on machinery that already exists, it is output-neutral, and it is the only part of this work that prevents a recurrence rather than cleaning one up.

**7.3 The `INTERIM_*` constants are a second, quieter divergence.** `wings_using`, `static.welcome`, and the v3 wing fields are emitted from script constants, not Word. After reconciliation the docx will be canonical for 130 fields and *still not canonical* for those. That is fine and correct for now — but "Word is canonical again" will be true with an asterisk, and the asterisk should be written down rather than discovered later.

**7.4 A second Word document already holds part of the answer.** `docs/InsightOut_Global_Static_Content_v1_4_061226.docx` was created specifically to capture the JSON state for the `static.*` globals. It covers 4 of the 130. Worth a look before patching those four by hand — though at 4 fields, patching directly is likely faster than reconciling two Word documents.

**7.5 Nothing here needs the escape hatch.** The conditions you named for pulling it — "the 130 are not cleanly JSON-wins", "the docx mapping is ambiguous at scale", "the drift came from a mechanism that will simply recur" — resolve as: uniformly JSON-wins (measured), zero ambiguity (measured), and a mechanism that *will* recur but is cheaply preventable (§3.3). The Word-as-authoring-surface decision does not need revisiting on this evidence.

---

## Appendix — method and reproduction

- **Split, provenance, structural comparison:** built the docx to a scratch copy, restored the committed file immediately (`git status` verified clean at every step). Leaf-flattening compares scalar values at full dotted paths including array indices.
- **Timeline:** `git log --follow` on `app/content/content_library.json` (catches the pre-`2832500` path `content/content_library.json`) and `git log` on the docx.
- **Historical comparison:** `git show 74a8e76:content/content_library.json`.
- **Docx analysis:** `word/document.xml` extracted via the same JSZip the build script uses; paragraphs split on `(?=<w:p[ >])` and runs matched with `<w:t[^>]*>(.*?)</w:t>`, mirroring `tokenize()` exactly so the analysis and the build agree on what a paragraph is.
- **Counts stated as "measured" come from those comparisons.** No number in this report is estimated.
