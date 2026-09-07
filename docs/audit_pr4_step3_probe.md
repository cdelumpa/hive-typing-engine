# Audit — PR 4 step 3, the probe

**Branch:** `pr-4-step3-probe-audit`, off `main` @
`e6a0e57e4af043aeeb6fe06aa54a99c0bacd9cc3` (`e6a0e57` — "Merge pull request #87"), pulled and
confirmed 7 Sep 2026. **Main has not moved** since step 2 merged. [CC-MEASURED]

**Nature:** audit. No spike script, no scaffold, no renderer, no content, and **no probe output** —
no budget, no ceiling, no fit verdict.

**A boundary I drew, because §0 and §2 pull against each other.** §0 says "no measurements"; §2
says "Report, MEASURED … make it measured." I read the prohibition as covering *the probe's
deliverable* — per-zone budgets and the fit verdict — and not the repo measurement §2 demands. So
I measured the **existing artifacts** (the mockup's geometry, the badge, the committed content)
and did **not** measure whether the new structure fits. That question is step 3's, and answering
it here would be building. [CC-JUDGMENT]

Tags: **[CC-MEASURED]** read out of the repo or executed · **[CC-DERIVED]** arithmetic on measured
values · **[CC-JUDGMENT]** my read.

All browser figures below come from the mockup rendered in the **same pinned Chromium the harness
uses**, at 816×1056, print media, with `assertReportFont` green (2378.81px — Arial metrics).
[CC-MEASURED]

---

## 0. Two corrections I owe before anything else

Both are mine, both are **counting-basis errors**, and §8 is the section that warns about exactly
this. One of them has propagated into three prompts.

### 0a. Z3 store bodies are **185–200**, not 177–201

I published *"Store bodies run 177–201 chars"* in §2.4. Measured now: **185 / 185 / 200**.
[CC-MEASURED] And `static.instinct_definitions` is byte-identical at `9285751` (when I wrote it),
at `13119b4` and at `e6a0e57` — `git diff 9285751 e6a0e57` touches it zero times. So the content
did not move; **the number was simply wrong.** [CC-MEASURED]

§4 of this prompt carries it forward as "177–201". The corrected framing: the store's three bodies
are **185 / 185 / 200** against a mockup fitted to **117 / 126 / 120**. The gap is real and if
anything slightly narrower than I said at the bottom end.

### 0b. Z6's "333 chars" is a basis, not a fact — and I never said which

The mockup's `.resp-txt` measures **three different numbers depending on the basis**: [CC-MEASURED]

| Basis | Count |
|---|---|
| source `innerHTML` | 353 |
| trimmed only — what `textContent` and the browser see | **345** |
| whitespace-collapsed and trimmed — **what I published** | **333** |

The string carries source indentation and newlines that HTML collapses at layout. 333 is the right
number *for content purposes* — it is what an author types and what actually lays out — but I
published it bare, and 345 and 353 are equally "measured" under other bases.

**This is the §8 failure committed by the person auditing §8.** It has been repeated in three
prompts since. The correction is not to the value but to the label: **333 chars, whitespace-
collapsed**. Everything downstream still holds, because every comparison I drew used the same
basis on both sides.

I record these two here rather than in §9 because the scope statement below depends on them.

---

## 1. Re-validating the 4b scope

Re-checked against main, not assumed. **The method survives; the target does not.**

What still holds: measuring inside a real render with the shared stylesheet and pinned Chromium;
line counts from merged `getClientRects()`; growing real prose word by word; re-reading contentBox
after every mutation with WIDTH-UNSTABLE suppression. [CC-MEASURED — `scripts/lib/line_metrics.js`
exists and `explore_fit_probe.js` consumes it]

What does not: 4b said *"p10 skeleton … Z5 scaffold"* against the three-block structure, and it
said *"measured per-zone budgets for p10"*. Both are stale. The structure is one narrative per
subtype, and per §1 the 345–415 band is the working standard, so **the probe diagnoses; it does
not budget.** §4 below takes that seriously and cuts one measurement entirely.

---

## 2. The construction problem

### 2a. The outer grid — measured, and my 207 was right to a third of a pixel

| Element | width | content width | notes |
|---|---|---|---|
| `.page` | 816 | **710** | `padding: 40px 53px` |
| `.unit` | 710 | 708 | `border: 1px` |
| `.cmp` | 708 | 708 | `display:flex`, `border-top:1px` |
| `.ccard` ×3 | 235.33 / 236.34 / 236.33 | 235.33 / 235.34 / 235.33 | `flex: 1 1 0%`; the +1 is `border-left` on cards 2–3 |
| `.chead` ×3 | 235.33 | **207.33** | `padding: 11px 14px` |
| `.cbody` ×3 | 235.33 | **207.33** | `padding: 16px 14px` |

[CC-MEASURED] **Z5 text width is 207.33px.** My Amendment 1 figure of "roughly 207px" was
[CC-DERIVED]; it is now measured and correct.

**Gutters between the three columns are 0px.** `.cmp` has no `gap`; the columns are separated by
`border-left: 1px` on `.ccard + .ccard`. [CC-MEASURED] Anyone reading "three-column grid" and
assuming a gutter would mis-model the width.

**Two other widths, because they are different and the difference matters:** Z3's `.itxt` is
**196px** (`.inst` has `gap:16px`, so 710 − 32 = 678 / 3 = 226, less 2px border and 28px padding),
and Z6's `.resp-txt` is **670px**, and Z2's `.lead` is **710px**. [CC-MEASURED] **Four zones, four
different measuring widths.** No band from one transfers to another, and none of them is the p6/p7
width the struck ceilings were taken at.

### 2b. The outer grid is content-independent — proven by emptying it

`.ccard` is `flex: 1 1 0%`. Flex-basis 0 means the widths come from the container, not the
content. I tested it rather than reading it: [CC-MEASURED]

```
widths with the shipped 3-block content : 235.33 / 236.34 / 236.33
widths with every column body EMPTIED   : 235.33 / 236.34 / 236.33
widths restored                         : 235.33 / 236.34 / 236.33
```

**Identical.** So **nothing about the three-block structure was load-bearing on the geometry.** The
outer grid does not know or care what sits inside it, and a new inner structure inherits exactly
the same 207.33px.

**One genuine exception, and I checked whether it is real.** Flex items default to
`min-width: auto`, so a token wider than the column *can* force expansion. Demonstrated: an 80-
character unbreakable word in column 1 blew it to **934.09px** and crushed the others to 106 and
100.45. [CC-MEASURED]

Is that a risk for the committed content? **No.** The widest unbreakable token across all 27
`instincts_v3` rows — naranjo, signature and narrative, split at whitespace *and* at legal hyphen
break opportunities — is **`compartmentalizing` at 104.05px** in the 12px Arial the column uses.
Against 207.33px that leaves **103.28px of headroom.** [CC-MEASURED] Per §10's rule, I verified
the risk before letting the argument count, and **it does not count** — no guard is needed.

It does have one consequence for method: it is a second, independent reason the probe must grow
**real** prose rather than synthetic filler. Filler can contain a token the real content never
would, and that token changes the width being measured — which is precisely the Wings bug
`explore_fit_probe.js`'s own header records. [CC-JUDGMENT]

### 2c. Is a scaffold at the mockup's outer grid sound? — **Yes, and 2b is why**

The objection to a scaffold is that it measures a page nobody will ship. That objection would bite
if the geometry we are borrowing were entangled with the structure we are discarding. **It is not:**
the grid is provably content-independent (2b), so the 207.33px column is a property of
`.page` padding, `.unit` border and `flex: 1 1 0%` — all of which survive the Z5 change untouched.

So the scaffold measures the real column at the real width with the real content. What it cannot
measure is anything that depends on markup nobody has written yet. That is a genuine limit and §2d
is where it bites.

**I am not countering the approach.** The alternative — build the p10 renderer first and probe the
real page — inverts steps 3 and 4, and it means the renderer is authored against no measurement at
all, which is the position p6/p7 was in when the three struck ceilings were published. Scaffold
first is the better order. [CC-JUDGMENT]

**But I would name the scaffold honestly in its own header:** it is a measurement instrument, not a
draft of the page, and its geometry is inherited from the mockup and asserted against it rather
than re-typed. If the scaffold's `.ccard` ever stops measuring 207.33px, the scaffold is wrong, and
that should be an assertion inside it, not an assumption. [CC-JUDGMENT]

### 2d. What the scaffold must include to be honest — and the trap that would have caught us

Four things, three of them measured hazards rather than caution:

**1. `.ceyebrow` with its `min-height: 13px`.** See §3. Omit the row and every column reads 13px
short.

**2. THE FLEX-STRETCH TRAP — this is the one that would have produced a floor dressed as a
ceiling.** `.ccard` is a flex item in a row container with default `align-items: stretch`, so **all
three columns render the same height regardless of content.** Measured on the shipped mockup:
[CC-MEASURED]

| Column | card height | INTRINSIC height needed |
|---|---|---|
| SP9 | 350.42 | **350.42** |
| SO9 | 350.42 | 333.03 |
| SX9 | 350.42 | 333.03 |

**Reading card height tells you nothing** — all three are identical, and a probe that recorded
"350.42px" for each would have reported three equal columns when one column is driving and the
other two are absorbing 17.39px of stretch each. 17.39px is exactly one line at
`12px × 1.45`. [CC-DERIVED]

So the scaffold must measure **intrinsic content height** — the `.czone` stack plus `.cbody`
padding plus `.chead` — not the rendered card box. Without that, "which column is tallest" is
unanswerable and the per-type worst case in §5 cannot be found.

**3. Z6 in all four states, at full height.** `.resp` is auto-height with no max-height, so the
zone that can spill the page is the one whose worst case is least predictable.

**4. Every element that occupies vertical space, including ones with no content decision yet.**
Z2 and Z3 are deferred (§6) but they *occupy space*; a scaffold that omits them measures a page
with two zones missing. That is §7.4's error verbatim.

---

## 3. The badges — the concern is real in mechanism and **null in effect**

Verified rather than reasoned. [CC-MEASURED]

`.ctag` is `display: block`, `position: static` — **in normal flow**, a flex item of `.ceyebrow`.
It measures **13px tall**, 68.59px wide, `padding: 2px 6px`, `font-size: 8px`. So Claude's
mechanism is right: it is in flow, and in flow means it can cost space.

It costs none. I removed all three badges from the rendered page and re-measured:

```
.ceyebrow height WITH badge   : 13 / 13 / 13
.ceyebrow height WITHOUT badge: 13 / 13 / 13
.chead    height WITH badge   : 74.52 / 74.52 / 74.52
.chead    height WITHOUT badge: 74.52 / 74.52 / 74.52
```

**Identical.** The reason is that `.ceyebrow` carries `min-height: 13px` and the badge is exactly
13px tall — the min-height was put there to reserve the row whether or not a badge is present.
[CC-MEASURED]

**So the concern dies, with one condition that is not optional.** The badge costs nothing *because
`.ceyebrow` reserves 13px*. A scaffold that renders the code without the eyebrow wrapper, or that
drops `min-height: 13px`, measures **13px short per column** and inherits exactly the defect §3
was worried about. **The scaffold must carry `.ceyebrow` with its min-height**, and badge
placeholders are then unnecessary — the reservation, not the badge, is what must be present.
[CC-JUDGMENT, on measured facts]

Width is not a concern either: the eyebrow is 207.33px, the code is a three-character string and
the widest badge is 68.59px. [CC-MEASURED]

---

## 4. What each measurement is for — and one I would not produce

Asked directly, so answered directly, including the one that fails the test.

### Z5 narrative — **the consumer is the page-fit verdict, not a budget**

With 345–415 adopted and the content committed, measuring "how many characters fit in a Z5 column"
answers a question nobody will act on: if it says 402 and the content is 394, nothing happens; if
it says 380, the content is not being re-authored to 380 — a column would have to actually break
first.

**So do not publish a Z5 character ceiling.** What Z5 must produce instead is **the intrinsic
height of the tallest column of each of the nine triples**, which is an input to §5's composite and
is consumed by the only live question: does the page fit. Height, not characters. [CC-JUDGMENT]

### Z3 instinct definitions — **live consumer: Cai's AS-IS vs edited decision**

Store bodies **185 / 185 / 200** (corrected, §0a) into cards the mockup fitted to **117 / 126 /
120**, at a **196px** column, `12.5px × 1.5` = 18.75px per line. Mockup `.itxt` renders at 75px
(4 lines) inside a `.icard` of 152px. [CC-MEASURED] The number Cai needs is **how many lines the
store text takes and what that does to `.icard`** — rendered AS-IS, so the gap is measured rather
than argued. That was my 4b position and it stands.

### Z6 — **live consumer: the step-5 cap and the two producer shapes**

Four states, and prose characters do not order rendered height: the SM worst is 568 chars across
**three bullet rows** with their own leading, the sp4 EM is 777 in **one paragraph**. Measured
mockup baseline: `.resp-txt` renders 58.13px (3 lines at `12.5px × 1.55` = 19.375) inside a `.resp`
box of 109.13px, at 670px wide. [CC-MEASURED] Z6 must produce **rendered height per state**, which
is what step 5 caps against and what §5 needs.

### `.cname` under the Naranjo substitution — **live consumer: my own conditional price**

I priced fork A at zero additional line boxes [CC-DERIVED], conditional on a one-line fit, and said
step 3 settles it. It does, and it is one cheap measurement: render all 27 naranjo values in
`.cname` at 14px bold in a 207.33px column and confirm each occupies one line. Consumed by the
step-4 renderer author, who is otherwise relying on my derivation.

### Measurements nobody asked for that **do** have consumers

**1. The page's own slack — and it is the most consumed number on this page.** Measured on the
mockup as it ships: **16.39px** between the bottom of `.resp` and the top of `.page-footer`.
[CC-MEASURED] That is **less than one line** of Z5 body text (17.39px) and less than one line of Z6
text (19.375px). The page as drawn is nearly full. Every other number here is only interesting
relative to that one, and nothing in the prompt asks for it.

**2. The intrinsic-vs-stretched delta per column** (§2d item 2). Consumed by anyone reading the Z5
numbers; without it they are wrong.

**3. `.hhead` (Z4) at 76px, and what its `.htag` renders.** See §9a — there is a decision hiding in
it.

---

## 5. The worst-case composite

**The page, not the zone.** `.page` is `width:816; min-height:1056; padding:40px 53px`, so the
content box is **976px** tall, and `.page-footer` is pinned to the bottom by `margin-top: auto`.
[CC-MEASURED] The gate is 1057px and `.resp` is auto-height, so the failure mode is **page spill**,
not clipping.

**Composite worst case:**

```
Z2 (lead)  +  Z3 (tallest of 3 cards)  +  Z4 (.hhead)  +  Z5 (tallest column of the worst triple)
           +  Z6 (tallest of 4 states)  +  page chrome (header, rule, eyebrow, H1, H2, footer)
           +  every inter-zone margin
                                             must be  ≤ 976px
```

**The maxima are jointly reachable, which is why summing them is legitimate rather than
pessimistic.** Z5's worst is selected by `confirmed_type`; Z6's worst is selected by which producer
ran and what it emitted; Z3 and Z2 are static. These are independent per-client variables, so a
single client **can** carry the worst Z5 triple and the worst Z6 state at once. A composite that
took the max of each is not a hypothetical stack-up — it is a reachable page. [CC-JUDGMENT, on the
measured independence of the inputs]

**How to measure it, and the two traps:**

1. **Z5's worst triple must be found by rendering all nine**, taking each triple's tallest column
   by **intrinsic** height (§2d item 2). The Amendment 1 figures — per-type tallest spanning
   382–394, SO5 the global worst at 394 — are **character counts**, and characters do not order
   rendered height. They are a hypothesis for which triple wins, not the answer. Re-derive by
   rendering. [CC-JUDGMENT]
2. **Z6's worst state must be found by rendering all four**, for the same reason: 568 across three
   bullet rows and 777 in one paragraph cannot be ordered by their character counts. I said this
   myself about the SM bullets and it applies here.

**Report the composite as a single headroom figure in pixels, plus the per-zone contributions that
produced it.** One number answers "does p10 fit"; the breakdown says which zone to talk to if it
does not. Neither is a ceiling (§8).

---

## 6. Z2 and Z3 in the scaffold, without prejudging Cai

### Z3 — **AS-IS, as agreed**

Render `static.instinct_definitions` bodies verbatim into the mockup's `.icard` at 196px. That
measures the gap instead of arguing it, and it prejudges nothing: AS-IS is the build plan's own
committed position, so rendering it is measuring the default, not choosing it. Cost to the
measurement: none — it is the only option that produces the number Cai needs. [CC-JUDGMENT]

### Z2 — **the store string AS-IS, with the token gap reported as a length, not resolved**

Three options and their cost to the measurement:

| Option | Cost to the measurement |
|---|---|
| **Store string AS-IS (330 chars, no token)** | Measures a real committed string at the real 710px width. Understates by whatever a type token adds — **and that is a bounded, statable number**: the longest token expansion is `nickname_plural` / `type_word`, and the shortest is a few characters. Report the measured height *and* the height with the longest plausible token appended, so both bounds are on the record. |
| Measured-length placeholder | Measures invented prose at roughly the right length. Rejected for the reason §1b gives about filler and for the reason in §2b: filler carries the wrong token-width distribution. |
| Store string + a token spliced in | Requires inventing the re-authored sentence, which **is** the deferred decision. Prejudges Cai. |

**I would take the first**, and report it as *"Z2 measured at the committed 330-char string; a type
token adds N px"* with N measured, not guessed. That is honest without the decision being made, and
it hands Cai a number rather than a question. [CC-JUDGMENT]

Measured baseline for it: mockup `.lead` is 303 chars rendering at **65.06px** across 710px at
`14px × 1.55` = 21.7px per line, i.e. 3 lines. The store's `instinct_primer` is **330 chars** — 27
longer. [CC-MEASURED] Whether that crosses to a 4th line is a probe measurement and I have not made
it.

---

## 7. The sp4 fixture switch — confirmed, and re-priced against the step-2 matrix

**It still holds.** From step 3 the probe's own output is a rendered page someone will look at, and
sp4's overlay is Type 4 SP prose. Transplanted onto anders_sx9 it prints under a Type 9 SX heading
and every reader has to be told to ignore the words.

**Re-priced — my step-2 estimate is now stale.** I said "+9 renders, ~+19.7s CI" against the
then-9-render matrix. The matrix is now 11. [CC-MEASURED, step 2] At the step-2 marginal rates
(1.409 s/render local, ~2.19 s/render CI): [CC-DERIVED]

| Scope | renders | local | CI |
|---|---|---|---|
| sp4 across the full axis | +11 | +15.5 s | +24.1 s |
| **sp4 at its own type only** | **+1** | **+1.4 s** | **+2.2 s** |

**One type — sp4's own, Type 4.** Not a cost argument; a correctness one. The switch exists to make
the probe's output coherent for eyeballing. sp4's overlay is coherent on a Type 4 SP page **and
nowhere else** — rendering it as Types 1–9 would reproduce the exact incoherence the switch removes,
nine times, and pay 11 renders for the privilege. [CC-JUDGMENT]

**A side-benefit worth recording rather than acting on.** sp4's profile is
`{SP:73, SO:40, SX:51}` — sorted 73 / 51 / 40, so a 22-point top gap and an 11-point second/third
gap. [CC-MEASURED] That is **not** a near-tie, unlike all three step-2 profiles. So adding sp4 as a
fixture brings a clearly-separated profile into the matrix for free, which is part of what I
deferred to step 4 as `wide_gap`. **Record it; do not widen step 3 to use it** — it is only visible
once badges render.

---

## 8. Counting basis, stated before any number

**The basis for every character count in step 3, and it must appear in the output header before a
single figure:**

> Characters are counted on the **rendered string with whitespace collapsed and the ends trimmed** —
> what the browser lays out and what an author types into the CMS. Markup is excluded. Labels are
> excluded from the string they label and measured separately. Source indentation is not content.

That is the basis my own 333 used and failed to declare (§0b), and declaring it is the whole
lesson.

**Measurements and ceilings are different artifacts, and step 3 produces only one of them.**

- A **measurement** says *this string, in this box, at this width, renders N px tall / M lines*. It
  is a fact about a rendered artifact.
- A **ceiling** says *no string here may exceed N*. It is a rule, and it needs a mechanism nobody
  has: **§7.4 struck 95, 53 and 90 with no replacements**, because the rule that generated them —
  label width drives the wrap — was invented, written into the spec and nine documents, and
  disproved. Character count does not predict line count.

**Step 3 publishes measurements only.** Every number in its output carries a per-zone label saying
which it is, and none of them says "ceiling". The one number that reads like a limit — §5's page
headroom — is a measurement of a rendered composite, not a rule about future strings, and should
say so in the same sentence. [CC-JUDGMENT]

---

## 9. Where I think §1–§9 is wrong

### 9a. Fork A's own statement is not yet true of Z4 — and nobody has decided it

§1 says the Naranjo name replaces the display nickname in `.cname`, and step 1's decision said "The
Collector does not appear on the page at all."

**It appears in Z4.** The mockup's banner is: [CC-MEASURED]

```html
<div class="hbadge">SX·9</div>
<div class="hlbl">Your Subtype</div>
<div class="hname">The One-to-One Nine</div>
<div class="htag">The Seeker · Merging &amp; Intensity</div>
```

`.htag` carries **the display nickname and the signature**. `.hname` is `display.subtype_label`
with an article and is unaffected. So under fork A, `.htag` is either substituted
(`Fusion · Merging & Intensity`), left as the nickname — in which case "does not appear on the page
at all" is false — or re-shaped.

This is not a quibble about wording: the scaffold has to render *something* in `.htag`, the three
options differ in length, and `.hhead` is 76px of the page's 976. **It is a decision, it is
unmade, and it is upstream of the scaffold.** New open question. [CC-MEASURED premise,
CC-JUDGMENT that it is undecided]

### 9b. §4's "177–201" is my error, propagated

Corrected in §0a to **185–200**. Flagging it here too because the prompt states it as given and it
will otherwise be copied again.

### 9c. §9's "confirm it is still the right tool" — the method is right, the tool is half-right

`explore_fit_probe.js` cannot be reused as-is, and the reason is structural rather than
incidental. Its `ZONES` are `{ sheet, sel }` where `sheet` is a **`V3_PAGE_ORDER` key**, and it
acquires pages by calling `R.buildClientReportHTML_v3(model)` and then indexing
`document.querySelectorAll('.v3-page')`. [CC-MEASURED] p10 has no builder, so it emits no page and
there is nothing for a selector to resolve within.

**But the measurement core is already extracted.** `scripts/lib/line_metrics.js` was lifted out of
that spike precisely so there is one definition of "how many lines is this", and it exports
`BROWSER_SRC / install / measurePairs / measureZones`. [CC-MEASURED] So step 3 reuses
`line_metrics` and writes its own page acquisition. That is a smaller change than "reuse the
probe" implies and a larger one than "it is settled" implies. The **method** is settled; **the
harness around it is not, and cannot be until p10 exists.** [CC-JUDGMENT]

### 9d. Not wrong, but the framing understates the finding

§5 says "the real question is page fit, not zone fit" and it is right. What the measurements add is
that the page has **16.39px of slack as drawn** — under one line in every zone's type size. The
question is therefore not "how much room is there" but "is there any", and the probe should be
scoped to answer that first and produce per-zone numbers second.

---

## 10. Step-3 scope statement

**Purpose.** Measure whether p10 fits at its worst-case composite, using the real committed content
at the mockup's real geometry, and produce the two numbers with live consumers (Z3's AS-IS gap,
Z6's per-state height) plus the one that settles a conditional price (`.cname`).

**Files touched**
- `scripts/spike/p10_fit_probe.js` — new. Consumes `scripts/lib/line_metrics.js`.
- `.phase6_out/` — a measurements JSON and the rendered scaffold, both gitignored.
- **Nothing else.** No renderer, no `V3_PAGE_BUILDERS`, no content, no gate, no CMS.

**The scaffold**
- Built to the **new** Z5 structure (code · naranjo · signature · narrative) at the mockup's outer
  grid, with the grid **asserted** — `.ccard` content width must measure 207.33px or the probe
  fails rather than reporting.
- Carries `.ceyebrow` **with `min-height: 13px`** (§3). Badge placeholders are not required; the
  reservation is.
- Carries every zone that occupies space: Z2, Z3, Z4, Z5, Z6 and the page chrome. No zone omitted
  because its content decision is deferred.
- Z3 **AS-IS** from `static.instinct_definitions`. Z2 the committed `instinct_primer` AS-IS, with
  the token delta reported as a measured px figure (§6).
- `.htag` (Z4) **blocked on 9a** — see "not done when".

**The measurements**
1. Z5 intrinsic column heights, all 9 triples, **intrinsic not stretched** (§2d item 2); the
   tallest column of each triple named.
2. Z6 rendered height in all four states.
3. Z3 AS-IS rendered height and line count against the mockup's 4-line, 75px baseline.
4. Z2 rendered height, plus the token delta.
5. `.cname`: all 27 naranjo values at 14px bold in 207.33px — one line each, or which are not.
6. **The composite** (§5): total against the 976px content box, as a headroom figure in px, with
   per-zone contributions.

**Method.** Real render, shared stylesheet, pinned Chromium, Arial asserted, `line_metrics` for
line counts, real prose only, contentBox re-read after every mutation with WIDTH-UNSTABLE
suppression.

**Counting basis stated in the output header before any number** (§8). Every figure labelled
**measurement**; the word *ceiling* appears nowhere.

**Done when**
1. The scaffold's `.ccard` content width asserts at 207.33px and `.ceyebrow` at 13px, or the probe
   fails loudly.
2. All six measurements produced, each labelled with its zone, its width and its basis.
3. The composite headroom figure is produced with its breakdown.
4. The existing gates stay green — `verify:render`, coach baseline, `npm test`, content library.
   Step 3 touches no path they cover, so any movement is a signal, not noise.

**Not done when — state this in the build report**
- **No budget and no ceiling is published**, for any zone, including Z5.
- **The probe does not gate the content.** 345–415 is the working standard; a probe result that
  disagrees with a committed narrative is a diagnosis, and the response is Cai's.
- **Z2 and Z3 are not decided** — their numbers are inputs to decisions, not the decisions.
- **`.htag` is unresolved (9a)**; whatever the scaffold renders there is a placeholder and the
  composite carries that caveat.
- **The scaffold is not the page.** It is a measurement instrument at the mockup's geometry, and
  step 4 is not obliged to inherit its markup.

---

## 11. Open questions

### New

1. **Under fork A, what does Z4's `.htag` render?** It carries the display nickname today, which
   contradicts "the nickname does not appear on p10 at all". Upstream of the scaffold. [§9a]
2. **Is 16.39px of slack the accepted starting point?** The mockup ships nearly full, with the
   *old* Z5 and a 333-char Z6. If the composite comes out negative, the response is a content or a
   layout decision, and it would be worth knowing now which one is on the table. [§4, §5]

### Carried

3. **Z3 AS-IS or edited** — step 3 measures it. · 4. **Z2 token or no token** — step 3 measures the
   delta. · 5. **How many stored assessments lack the instinct fields** — still needs a production
   query.
6. **`instinctStack` returns "Leading = SP" for a missing or empty profile** — own card, pinned by
   step 2, not fixed.
7. **`dominant_instinct_hypothesis` and `instinct_score_profile` are never reconciled** — own card,
   decided as watch-in-beta at step 4.
8. **`CMS_PREVIEW_WORST_EVIDENCE`'s comment says "~25 words each" against measured 27/29/28** — own
   card, a `server.js` fix.
9. **The 345–415 band's provenance is unestablished** — accepted knowingly; not hunted, and I did
   not trip over it.
