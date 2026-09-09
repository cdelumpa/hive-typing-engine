# Build B2b — smoke sheet: the Quick Reference page

**Full-page renders of sheet 5**, at 2× device scale, from the real document builder.

## What Cai is being asked to judge

The C4 assertion in `scripts/render_client.js` proves, on all 35 renders, that every element naming
a hypothesis names the same one. **What it cannot prove is C2** — that each hypothesis is
*identifiable as itself* by a person looking at the page. Cyan versus grey label, solid versus
dashed ring, first position versus second: those are design properties, not data ones, and no test
can tell you whether they read.

**So the question for this sheet is:** on each page, are the leading and the alternate **equally
present and equally identifiable**? Not "is the alternate there" — it is, and the assertion says so
— but does it read as a second offer rather than as an afterthought or a footnote?

## The images

Every one is **REACHABLE IN PRODUCTION**. None is synthetic.

| image | visual discriminator — true of this image alone | record |
|---|---|---|
| `p5_ordinary_type9.png` | LEADING ring on node **9** (top), dashed ALTERNATE on node **5**. Header reads *Type 9 — The Peacemaker*. **The ordinary case.** | `anders_sx9` at its own type. The common path. |
| `p5_collided_type9.png` | **Identical to the ordinary page above** — same rings, same panels, same two types. That sameness is the point. | The same record with `alternate_candidate` forced to equal `confirmed_type`. `call2_stamp` ships these deliberately: it flags the collision for admin review and does not hard-stop. |
| `p5_ordinary_type4.png` | **The only image whose LEADING ring is not on node 9** — it is on node **4**, dashed ALTERNATE on the adjacent node **5**, both labels on the bottom rail. Header reads *Type 4*. | `anders_sx9` re-typed to 4. **This is the case the figure's rhythm changes were aimed at** — two labels side by side on one rail, above the legend. |

## The collided page is the one to look at

On that record the engine's two hypothesis scalars **both name Type 9**. A page built the obvious
way — reading `m.alternate.number` — would print *"Type 9 · The Peacemaker"* under ALTERNATE WORTH
EXPLORING, beside a dashed ring on node 5. That was the default construction before Build B2a.

**It now reads Type 9 leading, Type 5 alternate, exactly like the ordinary page** — because every
element on the sheet reads one ordering rather than the scalars.

That is also why `p5_collided_type9.png` and `p5_ordinary_type9.png` look the same: **a collided
record is no longer a visibly different page.** If they ever stop matching, something has regressed.

## What the assertion covers, and what it does not

**Covered, on all 35 renders** — the two ring nodes, the two ring labels' nodes, and the two panel
headings agree three ways per role; the two roles name different types; both panels are present;
neither panel carries the other's copy.

**Red-controlled, not merely green:** reintroducing the defect — sourcing the alternate panel from
`m.alternate.number` — produced **6 failures on exactly the 3 collided renders** and left the other
32 passing, because on a non-collided record the scalar and position 2 agree. The check is silent
where the defect is silent and loud where it matters.

**Not covered:** whether the visual hierarchy reads. That is this sheet.

## Refreshed after Cai's review (9 Sep)

These renders carry six amendments: one page name (`Your Report at a Glance`, no eyebrow, the
eyebrow's 20 px given back to the title), a reworded Contents descriptor, the figure's labels pulled
in toward the wheel and the legend pushed away from them (**clearance 10.10 px → 22.10 px**), and
the ALTERNATE eyebrow in the same cyan as LEADING.

**Look at `p5_ordinary_type4.png` first** — it is the crowding case, and the only one where both
labels land side by side on the bottom rail.

**The cyan change is the one to judge against C2.** The leading/alternate hierarchy is now carried by
position, by solid-versus-dashed ring, and by the words. Colour no longer separates them. Does the
alternate still read as the *second* offer rather than a co-equal one — and is that the right
balance?
