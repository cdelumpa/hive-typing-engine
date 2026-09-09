# Build R — smoke sheet

Full-size renders of the standalone `client-quickref` SVG, at `2×` device scale. Generated from
`buildEnneagramSVG` directly — no page is involved, because sheet 5 has no builder.

**Every image is labelled REACHABLE or SYNTHETIC.** A contact sheet was misread once on this PR as
evidence about reachable states; this sheet says which it is for each image.

| image | record | reachable? |
|---|---|---|
| `collided_9x9_before.png` | leading 9, alternate 9 — **collided**, at `12a0f41` | **REACHABLE IN PRODUCTION.** `call2_stamp.js` ships `confirmed_type === alternate_candidate` deliberately: it sets `collision_flag`, raises an `engine_collision` flag for admin review, and does not hard-stop. Reachable on the `em_only` path, not merely the SM fallback. |
| `collided_9x9_after.png` | the same record, after Build R | **REACHABLE IN PRODUCTION**, same record |
| `control_9x5_before.png` | leading 9, alternate 5 — the `anders_sx9` fixture's own pair, at `12a0f41` | **REACHABLE IN PRODUCTION**, and the ordinary case |
| `control_9x5_after.png` | the same record, after Build R | **REACHABLE IN PRODUCTION**. **Byte-identical to `_before`** — `cmp` reports no difference. This is the control and it did not move. |
| `collided_3x3_after.png` | leading 3, alternate 3 — **collided**, after Build R | **REACHABLE IN PRODUCTION**, same mechanism as 9×9. Included because position 2 falls out of the ranking tail, so a second collided type shows the ring landing somewhere else — node 9 here, not node 5. |

## What the pair shows

**`collided_9x9_before`** is the contradiction Build R removes. Node 5 is shaded second-darkest —
the rank ramp already calls it the second-most-like-you — and it carries **no ring and no label**.
The picture says "5 is second" and "there is no second" at the same time.

**`collided_9x9_after`** rings node 5 dashed and labels it ALTERNATE. The shading and the rings now
agree.

## The §2 fixture correction has no image, and that is the finding

The gate's collided block rendered `9 × 9` while passing `orderFor(9, 5)` — a score vector for a
non-collided record. Corrected to `orderFor(9, 9)`. **Both produce a byte-identical SVG**
`[MEASURED]`: `put(9); put(5)` gives `[9, 5, …]`, and `put(9); put(9)` de-duplicates to `[9]` then
takes 5 from the head of the tail — the same ordering either way. There is nothing to photograph,
and that is precisely why the defect survived unnoticed: nothing read the vector until now.
