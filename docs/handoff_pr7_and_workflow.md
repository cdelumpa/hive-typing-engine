# Handoff — PR 7, the workflow PR, and the method notes behind PR 5

Written at the end of PR 5 Build B3 (base `11bca71`). It exists because most of what follows was
learned across a long series of builds and would otherwise live only in a chat transcript. Nothing
here is a plan; it is what someone picking these up should know before they start.

## 1. PR 7 — extract the CMS key surface out of `app/server.js`

**1.1 · Why it cannot be tested today.** `app/server.js` exports nothing and calls `app.listen()`
unconditionally at require time. Requiring it binds a port, so no test can load it, and the whole
CMS key surface — `cmsPreviewSpec`, `cmsIsValidTypeKey`, `cmsRenderPreviewPng` and the key maps —
is unreachable from `npm test`.

**1.2 · What Build B4 did instead, and why PR 7 should pull toward it rather than away.** The six
sheet-5 preview entries were born in `app/cms_quickref_preview.js` rather than in `server.js`.
`server.js` requires that module and spreads the entries into the maps it already builds. Nothing
existing moved and the new surface was testable from its first commit. Build B3 then put the fit
sweep there for the same reason — and that immediately paid: `tests/quickref_fit_test.js` asserts
the sweep covers all 27 records, which is a claim its predecessor inside `server.js` could not have
been held to by anything. **The pattern is the recommendation.** PR 7 should move the existing
surface toward that module, not invent a third home.

**1.3 · What the module already exports, and what now depends on it.**
`{ P5, P5_SEL, STATIC_ENTRIES, subtypeEntry, fitProbe, fitVerdict, fitSweep, INSTINCTS, PAGE_PX }`.
As of B3 `scripts/render_client.js` imports `fitProbe` and `subtypeEntry().cap` **as a gate
dependency**, so changing either signature turns CI red. That coupling is intentional: it is what
stops the gate and the CMS acquiring two definitions of "fits".

**1.4 · The thing to read before touching any CMS key.** `assertOverrideShape`
(`app/content_overrides.js:159`) throws in BOTH directions — a missing leaf and a leaf present only
in the override. Per the note at `content_overrides.js:114` it reaches **every** report render,
including the dry-validate probe in `/api/submit`. A mismatched row therefore fails **assessment
submission**, not merely a PDF. `overrideShape` collapses arrays to `prefix[]` and does not track
length, so arrays may grow safely; new object keys may not.

**1.5 · A defect fixed in B3 that says something about the shape of that file.** The preview fit
sweep read `if (t !== spec.type) setContent(...)` — correct only on the first iteration, so the
last pass of a 1..9 sweep measured type 8's page and recorded it as type 9. It sat unnoticed
because nothing could test it. That is the argument for PR 7 in one line.

## 2. The workflow PR

**2.1 · The four queued items stand.**

1. **Narrow the apt fix so the offender is named.** The current
   `find /etc/apt/sources.list.d -mindepth 1 ! -name 'ubuntu.sources' -delete` works but removes
   everything except Ubuntu's. The first attempt at this removed `*.list` on the assumption that
   third-party repositories use the classic one-line format; on this runner image they do not, so
   it deleted `microsoft-prod.list` — never the problem — and left Google's deb822
   `google-chrome.sources`, which was. **Do not assume the format of a third-party list.**
2. **Pin the Node version.** `node-version: '24'` floats; it has been resolving to v24.20.0 in CI
   and v24.15.0 locally.
3. **Wire `scripts/check_docs.py` into CI.** It is run by hand today, which means it is run when
   someone remembers. It reads no `.md` in CI at all.
4. **Wire `scripts/verify_wings_pixel.js` into CI.** Same reason.

**2.2 · What B3 already did, so it is not queued twice.** B3 added a seventh gate,
`node scripts/verify_quickref_fit.js`, in the same build that wrote it. A gate that only runs
locally does not deliver its outcome — that is item 3's failure by another route — and the workflow
PR's queue was the wrong home for a step this build depends on.

**2.3 · The CI trap that costs a whole run.** A `pull_request` run checks out `refs/pull/N/merge`,
a merge commit **pinned to a SHA**. Re-running a PR after `main` has moved reuses the STALE merge
SHA. Merge `main` into the branch instead of re-running.

## 3. Method notes — each of these cost a build to learn

**3.1 · Count rendered lines by merging `Range.getClientRects()` on the rounded top edge.** A naive
`getClientRects().length` over-counts wherever an inline `<b>` or a `_v3NoBreak` nowrap span splits
one visual line, and sheet 5 has both. One implementation, `scripts/lib/line_metrics.js`, mirrored
in `fitProbe` and `quickref_fit.js` — and B3's F4a asserts the two agree on every render precisely
so that "mirrored" cannot quietly become "different".

**3.2 · Never derive a layout assertion from the constants that produced the layout.** It agrees by
construction and goes green forever. Measure it off the render. The one legitimate exception is a
failure that has no observable box at all — the SVG viewBox clipping its own captions, guarded by
the `vh = rampY + 32` relation — and it should be justified in the comment when it is taken.

**3.3 · A gate that has never been observed red is not a gate.** `verify_transparency.js`
established the positive-control pattern here; `verify_quickref_fit.js` follows it with 15 controls
plus a negative one. Controls must drive the **real** predicate, which is why B3's predicates were
lifted out of the harness into pure functions.

**3.4 · Any new axis in the render harness must appear in the output `tag`.** Otherwise two renders
share a filename, and a reviewer opens whichever ran last with every gate green.

**3.5 · `git checkout` reverts source but not `.phase6_out`.** Wipe the directory before any
before/after artefact comparison, or use a separate `git worktree` — stale artefacts otherwise get
compared against themselves and report "0 new".

**3.6 · Never `git stash` in this repo.** It has popped a pre-existing foreign stash twice.

**3.7 · `class="v3-page"` as a scratch regex misses the cover's `class="v3-page is-cover"`.** Match
the full attribute. Be aware, too, that a bare class token appears in the stylesheet before it
appears in the markup — which made three sentinel tests fail identically in B4.

**3.8 · `_v3Straighten` (`renderer.js:3473`) rewrites curly quotes to straight on every v3 page**,
so the curly form is unreachable there. Any probe or measurement must apply it before counting.

**3.9 · Backticks inside a comment inside a JS template literal terminate the literal.** It has
happened twice. `node --check` catches it immediately.

**3.10 · Modifiers on shared v3 classes must be `is-` prefixed.** `app/client_report_v3_styles.js:40`
records that `.lead`, `.sub`, `.note`, `.eyebrow` and `.page` are owned by the shared sheet, and
that re-using them "bit twice during design, both times invisibly".

**3.11 · `content_library.json` is a BUILT ARTEFACT** at `app/content/content_library.json`. Never
hand-edit it — edit the docx or an `INTERIM_*` constant in `scripts/build_content_library.js` and
rebuild. CI asserts JSON equals build(docx).

**3.12 · `docs/mockup/claude_The_Peacemaker_Page_AtAGlance_v1.html` must not be edited.** It is the
ratified layout record AND `verify_transparency.js`'s positive control. It is canon for LAYOUT
only, and carries three stale strings that must not be ported: the old H2, the italic caption, and
`.stag`'s "The Seeker".

**3.13 · Off Linux, `verify_coach_baseline.js` is a HALF-RESULT.** The PDF-hash half skips; only
the HTML comparison ran. Say so rather than reporting a pass.

## 4. Sheet 5's own facts, for whoever changes it next

**4.1 · Its height varies with exactly one thing: the subtype summary's rendered line count.**
Measured across all 35 renders, only three page heights exist — 73.86px free at one summary line,
70.36px at two, 51.61px at three. Nothing else on the sheet varies in height by type.

**4.2 · The page holds five summary lines and spills at six.** `cap: 3` in
`app/cms_quickref_preview.js` is a **design limit with two lines of slack**, not the layout's
bound. `scripts/render_client.js` asserts `cap + 1` still fits on every render.

**4.3 · Summary lines do not cost a constant.** While the instincts panel is the taller of the two
`.v3-qr-half` flex items, a summary line costs the page nothing — one line to two costs 3.50px, not
18.75px. Do not divide headroom by a line height to get a bound; push the page until it spills.

**4.4 · The tightest record is not a fact about the type.** Sixteen of the 35 renders tie at the
minimum, spanning eight different types. Any statement of the form "Type N is tightest" is wrong in
kind, not merely in value.

**4.5 · The character ceiling is sufficient, not necessary.** SO5 is 161 characters and renders
inside three lines, above §27's 132-character ceiling, because ceilings of that sort are
conditional on word width.
