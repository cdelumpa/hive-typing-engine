# Wings r2 → r3: every zone that changed

**Three zones of 126.** Everything else in `docs/wings_content_r3_shipped.md` is r2 as
authored, transcribed by parser and asserted byte-identical.

This is the audit's C4 table (`docs/audit_pr3_wings.md`) closed out against what actually
shipped — not a fresh proposal round. All three changes were ratified before the build
started. Nothing here was decided during it.

---

## 1. The shared page intro — wording

Applies to **all nine types**, including the live Type 9 page.

| | |
|---|---|
| **Before** (shipped) | …most people naturally lean more towards **one**. |
| **After** (r2 wording) | …most people naturally lean more towards **one wing**. |

Full text after the change:

> Wings are the two types immediately adjacent to your home base type. Each wing "flavors" how your type shows up, and most people naturally lean more towards one wing. Both are always present, but which one shows up more is unique to you. When you access your wings intentionally they become valuable resources for balancing the automatic patterns of your home base type.

**Reason.** r2's wording, ratified by Cai. "…lean more towards one." leaves the noun implied
and can read as "one *type*" on a page that has just introduced two of them.

**Meaning change: yes** — it disambiguates. Not mechanical.

**Cost: none.** 365 → 370 chars, still 8 rendered lines. Type 9's page headroom is 37.25px
before and after, to the hundredth of a pixel: the intro band's height is set by the 252px
diagram beside it, not by the text, so the intro has slack before it costs anything.

**This is the only change to Type 9's rendered output in this PR.** Its other 14 zones are
byte-identical to what was already shipped — verified as a library diff, which reported
exactly one changed leaf, `type_9.wings.intro_v3`.

---

## 2. Type 2 · Wing 3 (The Performer) · bullet 3 — re-cut for width

| | |
|---|---|
| **Before** | People are drawn to you, and you know how to use it. |
| **After** | People are drawn to you, and you use it well. |

| | chars | lines | last-line fill |
|---|---|---|---|
| Before | 52 | 2 | **3.0%** |
| After | **45** | **1** | 100% |

**Reason.** The worst stranded line in the whole set, and the only capacity bullet that
wrapped instead of holding at one line. 52 characters sits inside the measured coin-flip band
(at 52ch, 21 of 40 sampled strings hold one line and 19 wrap — `audit_pr3_wings.md` §C3a); it
lost that toss and dropped two words onto a second line. 45 is inside the measured one-line
band of ≤48, where the minimum observed fill is 85.4%.

**Meaning change: minor.** "you know how to use it" → "you use it well" keeps both the
magnetism and the conscious, skilled deployment of it; it drops the explicit note that the
knowing is deliberate. **Worth Mo's eye, but not a rewrite.**

**Effect.** Type 2's column drift went **18.75px → 0.00px**. Both columns now render level.

---

## 3. Type 3 · Wing 4 (The Individualist) · resource band — re-cut for line count

| | |
|---|---|
| **Before** | When you need to know whether the work **actually** matters, reach for the Four wing. It turns the Performer's momentum into something with substance underneath. |
| **After** | When you need to know whether the work matters, reach for the Four wing. It turns the Performer's momentum into something with substance underneath. |

| | chars | lines | last-line fill |
|---|---|---|---|
| Before | 157 | 4 | **22.0%** |
| After | **148** | **3** | 98.6% |

**Reason.** The only resource band among the sixteen new ones that ran to four lines; the
other fifteen held at three. 157 characters sits in the measured unstable range between the
3-line band (134–150) and the 4-line band (186–196). Deleting one word lands it at 148, inside
the 3-line band, and it now renders at 98.6% fill — the best-filled band on the page.

**Meaning change: none.** A single intensifier deleted. "whether the work actually matters"
and "whether the work matters" say the same thing. **Mechanical.**

**Frame preserved:** two sentences, "When you need ___, reach for the ___ wing. It turns the
[Archetype]'s ___ into ___."

**Effect.** The band dropped from 4 lines to 3 as targeted. Type 3's column drift is
**18.75px**, not 0.00px — see the note below.

---

## Deliberately not changed

Ratified decision 4, and the measurements confirm it was the right call.

| Zone | Measured | Why it stays |
|---|---|---|
| Type 3 · wing 4 · bullet 3 | 80 chars, 2 lines, **78.0%** fill | Well inside the 69–89 two-line band and filling most of its last line. Shortening it costs meaning for no typographic gain. |
| Type 1 · wing 9 · bullet 1 | 74 chars, 2 lines, **30.1%** fill | In-band. A short last line is not a stranded one. |

**These two are the entire remaining column drift.** Types 1 and 3 each carry 18.75px — one
bullet line — and it comes from these bullets, not from anything the re-cuts failed to fix.
The other six new types render at 0.00px drift. 18.75px is exactly the drift Type 9's own live
page has carried since it shipped, so it is within demonstrated tolerance rather than a new
defect.

Re-cut 3 did what it was asked to do — the band went 4 lines → 3 — but Type 3's drift was
never going to reach 0.00px while its wing-4 column keeps three two-line bullets against
wing 2's fewer. That was known when decision 4 was taken.

---

## Residual risk for the r3 review

Not defects, and **not fixed here** — flagged so they are visible when Mo reads r3 rather than
discovered by a later render.

**Sixteen bullets sit at 49–52 characters**, inside the measured coin-flip band where wrapping
depends on where the last space falls rather than on the total. **All sixteen currently render
on one line**, verified against the render — so nothing is wrong today:

| Zone | chars |
|---|---|
| Type 1 · wing 2 · bullet 1 | 50 |
| Type 1 · wing 2 · bullet 2 | 51 |
| Type 2 · wing 1 · bullet 3 | 49 |
| Type 3 · wing 2 · bullet 2 | 50 |
| Type 3 · wing 2 · bullet 3 | 49 |
| Type 3 · wing 4 · bullet 2 | 51 |
| Type 4 · wing 3 · bullet 3 | 51 |
| Type 4 · wing 5 · bullet 2 | 51 |
| Type 5 · wing 4 · bullet 1 | 50 |
| Type 5 · wing 6 · bullet 2 | 49 |
| Type 6 · wing 5 · bullet 2 | 52 |
| Type 6 · wing 7 · bullet 1 | 52 |
| Type 6 · wing 7 · bullet 3 | 49 |
| Type 7 · wing 6 · bullet 1 | 51 |
| Type 7 · wing 8 · bullet 2 | 50 |
| Type 8 · wing 7 · bullet 2 | 52 |

The exposure is that a one-word edit to any of them during the r3 review can silently flip it
to two lines with a badly stranded last line — which is exactly what had happened to the Type 2
bullet in change 2 above. The r2 document was drafted against the older proxy bands (≤52 one
line), which is why they cluster just under 52; the measured ceiling is **48**.

Sixteen of 90 bullets is not a small share, and it is the single largest source of future
churn on this page. Two options, both fine, neither taken here because this build was scoped
to the two ratified cuts:

- **Leave them.** They render correctly today and the gate will catch a spill if one ever
  flips. Cheapest, and the risk only materialises if someone edits one.
- **Pull all sixteen to ≤48 in r3.** Removes the class of problem, at the cost of sixteen
  small meaning-affecting edits Mo would have to review.

If any of these sixteen gets edited in r3, re-render before accepting it.
