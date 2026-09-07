# p10 Instincts & Subtypes — fit measurements

**What this is.** The numbers the step-3 probe produced, and the one decision they produced.
Evidence, not reasoning — the reasoning is in `docs/audit_pr4_step3_probe.md` and the method is in
`scripts/spike/p10_fit_probe.js`.

**Why it exists.** `.phase6_out/` is gitignored, so the scaffold and the raw JSON do not survive.
The figures below are what decisions were made on, and they needed somewhere durable. Re-derive any
of them with `node scripts/spike/p10_fit_probe.js`.

**Produced by** `scripts/spike/p10_fit_probe.js` at `d8d5e33`, on `main` @ `e6a0e57`. Rendered in
the pinned Chromium the harness uses, at 816×1056, print media, Arial asserted (font probe
2378.81px). Every figure re-derivable by re-running.

---

## Counting basis — stated before any figure

> Characters are counted on the **rendered string with whitespace collapsed and the ends trimmed** —
> what the browser lays out and what an author types into the CMS. Markup is excluded. Labels are
> excluded from the string they label and measured separately. Source indentation is not content.

Same basis `scripts/lib/line_metrics.js` uses for its own `chars`. It does real work: the EM sample
is 777 characters raw and **775** under this basis.

Every figure is tagged **[CC-MEASURED]** (read off a render) or **[CC-DERIVED]** (arithmetic on
measured values). **Nothing here is a limit on future strings.** Spec §7.4 struck three such limits —
95, 53, 90 — with no replacement mechanism, because character count does not predict line count.
This document records what strings *did* render, not what future ones may.

**Four widths, not one:** Z5 **207.33px** · Z3 **196px** · Z6 **670px** · Z2 **710px**. No band
transfers between them, and none is the p6/p7 width the struck figures came from. [CC-MEASURED]

**Two things measured against the store, not committed to it.** The Z3 strings and the revised SO7
narrative were rendered as scaffold content. The content library is byte-identical from `e6a0e57`
through `d8d5e33`. [CC-MEASURED]

---

## Reference — the mockup as it ships

`docs/mockup/claude_The_Peacemaker_Page_Instincts_v1.html`, measured in the same run. [CC-MEASURED]

| | |
|---|---|
| `.ccard` content width | **207.3281px** · `.ceyebrow` 13px (13px with the badge removed) |
| Z2 lead | 65.06px / 3L |
| Z3 row | 152px |
| Z4 banner | 76px |
| Z5 cards | 350.42px box; intrinsic **350.42 / 333.03 / 333.03** |
| Z6 box | 109.13px / 3L |
| page | 1056px, **16.39px slack** to the footer |

The 16.39px is the number everything else is read against: the page as drawn is nearly full.

---

## 1. Z5 — subtype columns, 207.33px, intrinsic height

**Intrinsic, not the card box.** `.ccard` is a flex item under default `align-items: stretch`, so
all three columns render identically whatever they hold. On the mockup the cards read 350.42 across
the board against intrinsic needs of 350.42 / 333.03 / 333.03 — one 17.39px line of absorbed
stretch in two of them. Card height would report three equal columns when one is driving.
[CC-MEASURED]

With the revised SO7 in place, **nine columns tie at the top at 297.81px / 11 lines**: SP1 SP2 SP3
SP4 SP5 SO6 SP7 SP8 SO9. Two columns run 10 lines / 280.42px (SP6, SP9). [CC-MEASURED]

**By character count the worst column would have been SO5** — 394 chars, 11 lines. It is not the
worst. This is the rule failing inside its own data set: **SO5 is 394 characters at 11 lines; the
committed SO7 was 389 at 12.** [CC-MEASURED]

### Last-line fill — the fragility figure

Fill is the last rendered line's width as a fraction of the widest line in the same column. It says
how much room a column has before a further line appears. With nine columns tied, "the tallest" is
whichever the reduce reached first, so the fullest column of each tied triple is named beside it.
[CC-MEASURED]

| Type | tallest | fill | fullest of the tied |
|---|---|---|---|
| 1 | SP1 297.81 / 11L | 36.0% | SX1 74.8% |
| 2 | SP2 297.81 / 11L | 21.2% | SX2 76.5% |
| 3 | SP3 297.81 / 11L | 50.2% | **SX3 95.4%** |
| 4 | SP4 297.81 / 11L | 39.7% | SX4 61.4% |
| 5 | SP5 297.81 / 11L | 31.0% | SX5 84.5% |
| 6 | SO6 297.81 / 11L | 62.0% | SO6 62.0% |
| 7 | SP7 297.81 / 11L | 67.4% | SP7 67.4% |
| 8 | SP8 297.81 / 11L | 66.7% | SP8 66.7% |
| 9 | SO9 297.81 / 11L | 79.8% | SO9 79.8% |

**Most fragile, across all 27:** [CC-MEASURED]

| Column | fill | lines | chars | |
|---|---|---|---|---|
| **SX3** | **95.4%** | 11 | 379 | **the column that would undo this result** — any edit adding a few characters takes Type 3 to 12 lines |
| SP9 | 90.0% | 10 | 360 | at 10L, so a 12th line is two edits away |
| SP6 | 88.0% | 10 | 378 | as above |
| **SX5** | **84.5%** | 11 | 382 | **next behind SX3** at 11 lines |
| SO9 | 79.8% | 11 | 382 | |

Lowest is SP2 at 21.2%.

---

## 2. Z6 "In Your Words" — four states, 670px

[CC-MEASURED]

| State | box | lines | blocks | chars |
|---|---|---|---|---|
| `sm_bullets` | 179.25px | 6 | 3 | 568 |
| **`em_paragraph`** | **186.63px** | **7** | 1 | 775 |

**Both rows re-measured on the SHIPPED renderer at step 6A (PR 4).** [CC-MEASURED]

`em_paragraph`'s **186.63px is correct and stays** — but only as a description of the page after
step 6A's join. The step-3 scaffold collapsed this value's paragraph breaks to spaces before
rendering, which is exactly what the p10-local join now does, so the two agree. **Before the join
the shipped page rendered it at 244.75px**, because `renderer.js`'s `esc()` converts `\n` to
`<br>` and its two `\n\n` became four `<br>` — two blank line slots. It occupied **10 line slots
while a Range-based counter reported 8**, since such a counter sees only the slots carrying text.
`51 + 19.375 × 10 = 244.75` closes exactly.

`sm_bullets` was recorded here as **173.25px and measures 179.25px shipped.** The scaffold's
adjacent 3px block margins collapsed to 3px per gap where the shipped rule is a non-collapsing
`margin-top:6px` on the adjacent sibling; two gaps account for the whole 6.00px. **Corrected in the
table above.** After the join this state renders as one element at **147.88px / 5 lines**, because
joining reclaims each item's partial last line and both 6px gaps.
| `null` | 0 | 0 | 0 | 0 |
| `absent` | 0 | 0 | 0 | 0 |

`em_paragraph` is the worst **by rendered height**, found by rendering. Inter-bullet spacing in the
SM shape contributes **6.00px measured** — adjacent block margins collapse, so it is half what
multiplying the margin would give. [CC-MEASURED]

**Both shapes shed 19.37–19.38px per line** — one line box at 12.5px × 1.55. The expectation that
SM sheds less, because three bullets carry three rows of leading, does not hold: removing a line
inside a bullet removes a line box and nothing else. The rates would diverge only when a whole
bullet goes, and SM cannot get there by shortening — with three bullets it bottoms out at **3
rendered lines (115.13px)**, below which is a producer-contract change, not a shortening.
[CC-MEASURED]

The SM shape's markup is a **scaffold assumption**: the mockup draws Z6 only as one paragraph, so
three-bullet markup was chosen in the probe. EM's height carries no such caveat.

---

## 3. Z3 — instinct definitions, 196px

The three new strings, recounted on the stated basis: **157 / 150 / 156** — exact against the
stated counts, zero delta. [CC-MEASURED]

> **Self-Preservation** — Governs our need for physical well-being, material security, and safety.
> People who lead with SP prioritize food, shelter, warmth, health, and managing risk.
>
> **Social** — Governs our need for belonging, membership, and a recognized place within groups.
> People who lead with SO seek power and influence in a group setting.
>
> **One-to-One** — Governs our need for an intense bond or connection with one person at a time.
> People who lead with SX seek intimacy and passion in one-on-one relationships.

**Two mechanisms, two numbers.** Removing the FOCUSED ON row is structural — it happens whatever
the characters do. Shortening the bodies is not. [CC-MEASURED]

| Configuration | row | lines | chars |
|---|---|---|---|
| store text + FOCUSED ON row *(ships today)* | 208.25px | 6/7/7 | 185/185/200 |
| store text, row removed | 192.25px | 6/7/7 | 185/185/200 |
| new text + row | 170.75px | 5/5/5 | 157/150/156 |
| **new text, row removed** | **154.75px** | **5/5/5** | **157/150/156** |

| | |
|---|---|
| **FOCUSED ON row removed** | **16.00px** — structural |
| **text shortened** | **37.50px** |
| **total Z3 recovery** | **53.50px** (208.25 → 154.75; the mockup was 152) |

Cross-check: 16.00 + 37.50 = 53.50, matching the measured total. [CC-DERIVED]

**⚠ This cannot land as an edit in place.** `static.instinct_definitions` is **live v2 content**:
`_clP6Instinct` (`app/renderer.js:2247`) renders it at `:2252` on the live v2 `.p6-page`, which
`tests/lib/report_page_inventory.js:22` asserts is in every client report; it is CMS-editable
(`server.js:9866`) with a working preview mapped to `.p6-page` (`server.js:13850`), has a
`cmsWordBudget` branch (`:10018`), and `build_content_library.js:1994` hard-gates it at exactly 3.
Editing the three strings for p10 would change what shipped v2 clients see. The change needs a
**v3-only field beside them**, the pattern `instincts_v3` already uses. [CC-MEASURED]

---

## 4. SO7 — before and after

[CC-MEASURED]

| | chars | lines | intrinsic | last-line fill |
|---|---|---|---|---|
| committed | 389 | **12** | 315.20px | 21.3% |
| **revised** | **373** | **11** | **297.81px** | 51.5% |

−16 chars, **−1 line**, −17.39px. Recount 373 — exact against the stated figure.

**It is not a length result, and the break positions show why.** The committed SO7 was five
characters *shorter* than SO5, which fits at 11 lines, and still cost a line. What changed is where
the words break: [CC-MEASURED]

```
committed  line 4   78.4% fill   "aligned with social norms and"
revised    line 4   99.3% fill   "aligned with social expectations. SO7s"
```

Dropping "norms and" repacked line 4 from 78.4% to 99.3%, which pulled the whole tail up by one
line. The other two edits — "ideas and possibilities" → "ideas and options", "scattered" →
"unfocused" — are near-neutral.

**Consequence:** SO7 is no longer the constraint. Before the revision Type 7 sat at −28.64px while
the other eight sat at −11.25px; all nine are now uniform. [CC-MEASURED]

---

## 5. Z2 and `.cname`

**Z2** `instinct_primer` AS-IS at 710px: **3 lines, 65.06px, 330 chars** — the same line count as
the mockup's 303-char lead. The store string has no type-token slot; a token would add to this and
that delta is not measured here. [CC-MEASURED]

**`.cname`** — all 27 naranjo values at 14px bold in 207.33px: **27 of 27 occupy exactly one line**,
longest `Keepers of the Castle` at 21 characters. This settles the zero-additional-line-box price
of the fork-A substitution, which was previously derived and conditional. [CC-MEASURED]

---

## 6. The composite, per type — against the 976px content box

Z6 held at its worst state (`em_paragraph`, 7 lines), new Z3 in place, revised SO7 in place.
Headroom is signed: positive is slack before the footer, negative is spill past 1056px.
[CC-MEASURED]

| Type | Z2 | Z3 | Z4 | Z5 tallest | Z6 | page | headroom |
|---|---|---|---|---|---|---|---|
| 1 | 65.06 | 154.75 | 76 | SP1 297.81 / 11L | 186.63 | 1067.25 | **−11.25** |
| 2 | 65.06 | 154.75 | 76 | SP2 297.81 / 11L | 186.63 | 1067.25 | **−11.25** |
| 3 | 65.06 | 154.75 | 76 | SP3 297.81 / 11L | 186.63 | 1067.25 | **−11.25** |
| 4 | 65.06 | 154.75 | 76 | SP4 297.81 / 11L | 186.63 | 1067.25 | **−11.25** |
| 5 | 65.06 | 154.75 | 76 | SP5 297.81 / 11L | 186.63 | 1067.25 | **−11.25** |
| 6 | 65.06 | 154.75 | 76 | SO6 297.81 / 11L | 186.63 | 1067.25 | **−11.25** |
| 7 | 65.06 | 154.75 | 76 | SP7 297.81 / 11L | 186.63 | 1067.25 | **−11.25** |
| 8 | 65.06 | 154.75 | 76 | SP8 297.81 / 11L | 186.63 | 1067.25 | **−11.25** |
| 9 | 65.06 | 154.75 | 76 | SO9 297.81 / 11L | 186.63 | 1067.25 | **−11.25** |

**Against the mockup**, at the worst type and worst Z6: [CC-MEASURED]

| Zone | mockup | now | Δ |
|---|---|---|---|
| Z2 | 65.06 | 65.06 | +0.00 |
| Z3 | 152 | 154.75 | +2.75 |
| Z4 | 76 | 76 | +0.00 |
| **Z5** | 350.42 | 297.81 | **−52.61** |
| **Z6** | 109.13 | 186.63 | **+77.50** |
| page | 1056 | 1067.25 | +11.25 |

**Z5 is not the problem.** The one-narrative structure is 52.61px *shorter* than the three labelled
blocks it replaces. The page runs long because Z6's worst case is 77.50px taller than the mockup's.

---

## 7. Headroom as a function of Z6 line count

Nine types × Z6 at 7 / 6 / 5 / 4 rendered lines, new Z3 and revised SO7 in place. Shortened by
**removing rendered lines and re-measuring**, never by a character target. Real samples truncated at
line boundaries for measurement only; no replacement prose was authored and nothing was kept.
[CC-MEASURED]

| Z6 lines | headroom, every type |
|---|---|
| 7 (worst as produced) | **−11.25px** |
| 6 | **+8.13px** |
| **5** | **+27.50px** |
| 4 | **+46.88px** |

All nine types are identical at every line count, because Z5 is level across all nine.

> **Measured on the shipped renderer at step 6A, this table runs 6.00px optimistic at every row.
> See §7b.** §7 is left as measured — it was honest in its own context and overwriting it would
> destroy the step-3 record.

### 7b. The same table, measured on the shipped renderer

§7 was measured on the step-3 probe — a scaffold built from the mockup's CSS. **The shipped p10
runs 6.00px tighter at every Z6 line count.** Both are against the 976px content box; p10's padding
is 40px top and bottom, `box-sizing: border-box`, confirmed by measurement. Z6 is the joined
single-element shape that ships as of step 6A. [CC-MEASURED, step 6A]

| Z6 lines | §7 (step-3 scaffold) | shipped renderer | delta |
|---|---|---|---|
| 4 | +46.88px | **+40.88px** | −6.00 |
| **5** | **+27.50px** | **+21.50px** | −6.00 |
| 6 | +8.13px | **+2.13px** | −6.00 |
| 7 | −11.25px | **−17.25px** | −6.00 |

**Headroom basis, because two are in circulation on this page and they differ by 1px.** The figures
above are `976 − content height`, which equals `1056 − page natural height` and is what
`scripts/render_client.js` prints. **The page gate fails above 1057**, so gate-basis headroom is
1px larger — at 5 lines, +22.50px rather than +21.50px. Both are correct; neither is
interchangeable with the other.

**The offset does not vary by type.** Measured across all 27 `anders_sx9` renders in the step-6A
matrix, p10's stack with Z6 absent is **864.63px for every one of the nine types** — zero variance,
which independently confirms §7's "Z5 is level across all nine" on the shipped renderer rather than
the scaffold. §6's nine composite rows are likewise identical to each other. **So the offset is
6.00px for all nine types and this stays one table**, not nine. [CC-MEASURED, step 6A, at no extra
render cost — the 27 renders already existed]

**The offset is constant along BOTH axes — line count and type — so it is not in Z6 and not in Z5.**
It is elsewhere in the page stack and **it has not been isolated.** Recorded rather than guessed at.
Every composite figure in §6 carries it. One lead for whoever picks it up, and it is arithmetic on
a component that was not measured separately, so treat it as **not traced**: §6 lists Z5 at 297.81
where the shipped `.v3-inst-unit` measures 376.81 including its banner, and §6's Z4 (the banner)
is listed at 76 — leaving 300.81 against 297.81, a 3.00px difference in one zone.

---

## 8. The decision these numbers produced

**Z6 is capped at 5 rendered lines.** Cai, 7 Sep 2026.

**This is a decision, not a measurement**, and it is deliberately not a character figure. What was
measured is the table above; what was decided is which row to sit on.

The reasoning, recorded so it can be revisited rather than re-derived:

- At **5 lines** every type sits at **+27.50px**. That absorbs a **one-line content regression
  anywhere on the page** — one Z5 line is 17.39px, one Z6 line is 19.37px — and still fits.

  > **Corrected at step 6A: the shipped figure is +21.50px, not +27.50px** (§7b). **The decision
  > survives and the reasoning is unchanged** — 21.50px still absorbs a Z6 line at 19.375px and a
  > Z5 line at 17.39px. **The margin behind it is a quarter of what this bullet assumed:** against
  > a Z6-line regression the remainder is **+2.13px, not +8.13px**, and against the Z5-line
  > regression this argument was actually made on it is **+4.11px, not +10.11px**. Still positive,
  > and much thinner than it reads here. [CC-MEASURED, step 6A]
- At **6 lines** every type sits at **+8.13px**, which is less than one line of anything. It fits
  today and stops fitting the first time any column gains a line.
- §1's fragility table says that is not hypothetical: **SX3 sits at 95.4% last-line fill**, and
  SX5 at 84.5% behind it. A few characters into SX3 and Type 3 goes to 12 lines.

So 5 lines is chosen for the margin, not for the fit. [CC-JUDGMENT — the choice; the figures it
rests on are measured]

**What it constrains, and what it does not.** It constrains the rendered output of
`instinct_evidence` on p10. It is not a character count, it does not transfer to any other zone or
width, and it is not a rule about `client_words` on sheet 6 — which shares the *label* "In Your
Words" and is a different field, page and producer.

Implementation lands at **step 6B**, not step 5. [Corrected at step 6A.] Step 5 built the page;
step 6A joined the zone into one paragraph so that a cap can be *stated* in rendered lines; the cap
itself and its gate land at 6B.

Neither producer respects its own current spec, and `CMS_PREVIEW_WORST_EVIDENCE` runs 27/29/28
words against a "≤25 words each" contract.

**One correction to how that sentence used to read.** It cited "the EM sample" at 5 sentences under
a "2–4 sentences" instruction. **That value is not an EM sample.** It is sp4's
`instinct_personal_overlay`, and sp4 is an **SM** fixture — 3-bullet `instinct_evidence`, and
`stress_point_narrative` where the EM report emits `stress_security_narratives`. SM's contract for
that field is "2-4 sentences" (`server.js:4956`); EM's is "2-3" (`experimental_analysis.js:613`).
So it is one producer's field measured against the other producer's spec. Real EM output is
recorded in §9: 17 rows, every one of them 2 or 3 sentences, maximum 532 characters. The fixture
carrying that value is labelled a **synthetic hazard case** as of step 6A, not a sample.

---

## 9. The production population — what the cap is actually sized against

Executed against production Postgres, 7 Sep 2026, over `client_facing.instinct_personal_overlay`
on every stored assessment carrying an `api_result`. [CC-MEASURED — run by Cai; not independently
verified from this repo, which cannot reach that database.]

**NUMBERS ONLY. No client prose is recorded here or anywhere in this repo**, and no id is attached
to any content. The strings were read for measurement and discarded.

**Counting basis.** Elements joined with a single space, then whitespace-collapsed and trimmed.
Newlines counted on the **raw** joined string, before collapsing — collapsing would destroy the
thing being measured. Sentences are terminal-punctuation counts (`.` `!` `?`), which is a
**ceiling**: a sentence ending `."` is counted once, and a decimal point would be counted as a
sentence end.

### Shape — every row with an `api_result`, no exceptions

| shape | rows | producer |
|---|---|---|
| array, 1 item | **17** | EM |
| array, 3 items | **2** | SM |
| null / absent / non-array | **0** | — |

**`report_prep.js:408`'s `?? null` has never fired in production.** The fallback exists, is
asserted by `tests/instinct_axis_test.js`, and has never been reached by a real row.

### Distribution

| | n | min | median | mean | p95 | max |
|---|---|---|---|---|---|---|
| all rows | 19 | 308 | — | 442 | 511.3 | **532** |
| **EM only** | **17** | 348 | 456 | 450.7 | — | **532** |

Max words **80**. EM spread **184**. **Every EM row is 2 or 3 sentences — never more.**

### Newlines

**Zero rows contain a newline of any kind**, and therefore zero contain a paragraph break, across
all 19 rows spanning **2026-06-15 to 2026-07-19**. This is why step 6A's join is described as
*corrective* for preview fidelity and for the cap's measurement basis, and merely *defensive*
against the `<br>` hazard.

### What the maximum renders as

The 532-char maximum renders on the shipped p10 Z6 at **5 rendered lines, box 147.88px, page
natural 1034.50px** — **+21.50px** of headroom on this page's basis, **+22.50px** gate-basis.
[CC-MEASURED, step 6A]

**So the observed maximum sits exactly ON the 5-line cap, and the page's limit is exactly one line
above it.** The cap accommodates the entire observed population and has no slack above it.

`tests/fixtures/instinct_axis.js`'s `EM_OBSERVED_MAX` is a **synthetic** matched to that render —
531 chars and 83 words against the real 532 and 80, rendering identically. The real string is not
in this repo.

### The caveat, which is not a formality

**n=19, of which 17 are the shipping producer, over five weeks.** A compact distribution — p95
511.3 against a 532 max is a 20.7-char right tail — at that sample size is a **floor for a
decision, not a bound.** Nothing here establishes a ceiling, and the cap is justified by the page
(§7b) rather than by this table. What this table establishes is how often the cap will bite: on the
observed population, never.
