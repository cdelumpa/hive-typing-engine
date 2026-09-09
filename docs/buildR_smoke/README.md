# Build R — smoke sheet

Full-size renders of the standalone `client-quickref` SVG at 2× device scale, generated from
`buildEnneagramSVG` directly. No page is involved — sheet 5 has no builder.

## ⚠ Read this before matching an image to a row

**Identify each image by what is IN it, not by the order it arrived in.** These were once delivered
in a different order than the captions listed, and the labels could not be checked against the
pictures. Every row below therefore carries a **visual discriminator** that is true of that image
alone.

**And three of the four 9-leading images are the SAME PICTURE.** That is not a mistake in the sheet
— it is the result the build exists to produce, and it is stated here so nobody tries to tell them
apart. `[MEASURED]`: among the four, there are **exactly 2 distinct SVGs**.

| group | files | SVG |
|---|---|---|
| **A** | `collided_9x9_before.png` | unique — 3572 chars, **0 dashed rings** |
| **B** | `collided_9x9_after.png` · `control_9x5_before.png` · `control_9x5_after.png` | **byte-identical to each other**, 3572 chars, 1 dashed ring |

**Group B is the whole point.** After Build R, a collided record renders *exactly* the same figure as
an ordinary one — same rings, same labels, same bytes. The picture that used to mark a collided
record as different no longer exists.

*(The PNGs in group B differ by 4 bytes — 51096 vs 51092 — despite identical SVGs. That is
PNG-encoder noise across separate render passes, not a content difference. Do not chase it.)*

## The images

| image | visual discriminator — true of this image alone | record | reachable? |
|---|---|---|---|
| `collided_9x9_before.png` | **The only image with NO dashed ring.** Solid LEADING ring on node 9 at the top; node 5 is shaded second-darkest but bare — no ring, no label. Only one label on the whole figure. | leading 9, alternate 9 — **collided**, at `12a0f41` | **REACHABLE IN PRODUCTION** |
| `collided_9x9_after.png` | LEADING on node 9 (top), dashed **ALTERNATE on node 5** (bottom-left). Identical to both control images. | the same collided record, after Build R | **REACHABLE IN PRODUCTION** |
| `control_9x5_before.png` | As above — identical picture. | leading 9, alternate 5 — ordinary record, at `12a0f41` | **REACHABLE IN PRODUCTION**, and the common case |
| `control_9x5_after.png` | As above — identical picture, and **byte-identical to `_before`**; `cmp` reports no difference. This is the control and it did not move. | the same ordinary record, after Build R | **REACHABLE IN PRODUCTION** |
| `collided_3x3_after.png` | **The only image whose LEADING ring is not on node 9.** Solid LEADING on node **3** (right side, label at the bottom); dashed **ALTERNATE on node 9** (top). | leading 3, alternate 3 — **collided**, after Build R | **REACHABLE IN PRODUCTION** |

**Why every row says REACHABLE.** `call2_stamp.js` ships `confirmed_type === alternate_candidate`
deliberately: it sets `collision_flag`, raises an `engine_collision` flag for admin review, and does
not hard-stop. Reachable on the `em_only` path, not merely the SM fallback. None of these five is
synthetic.

## What the change looks like

**Group A** is the contradiction Build R removes. Node 5 is shaded second-darkest — the rank ramp
already calls it second-most-like-you — and carries no ring and no label. The picture says
"5 is second" and "there is no second" at the same time.

**Group B** rings node 5 dashed and labels it ALTERNATE. Shading and rings agree.

**`collided_3x3_after`** is included because position 2 falls out of the ranking tail, so a second
collided type puts the ring somewhere else entirely — node 9, not node 5. One collided example
would not have shown that.

## The fixture correction has no image, and that is the finding

The gate's collided block rendered `9 × 9` while passing `orderFor(9, 5)` — a score vector for a
non-collided record. Corrected to `orderFor(9, 9)`. **Both produce a byte-identical SVG**
`[MEASURED]`: `put(9); put(5)` gives `[9, 5, …]`, and `put(9); put(9)` de-duplicates to `[9]` then
takes 5 from the head of the tail — the same ordering either way. There is nothing to photograph,
and that is exactly why the defect survived: nothing read the vector until now.
