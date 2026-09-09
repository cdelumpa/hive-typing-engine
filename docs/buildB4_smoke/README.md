# Build B4 — smoke sheet: the editor's preview

**Two images of the preview modal**, one fitting and one flagged.

## What Cai is being asked to judge

P1–P3 are asserted in `tests/cms_quickref_preview_test.js` and run in `npm test`. What no assertion
reaches is the question these images are for:

**Would Mo understand what this is telling her, at the moment she needs to?**

That is a UI question, not a layout one. The verdict is **advisory** — she can still save and
publish — so its only job is to be understood.

## How these were made, stated plainly

The modal's **CSS block and markup are lifted from `app/server.js` verbatim** (selector-matched,
the discipline used for the mockup ports), and the page inside each one is a **real render** with a
**real fit verdict** computed by the shipped code.

**They are not screenshots of the running admin page.** That would need a live server and a
super-admin session, and `app/server.js` binds a port on require. The chrome around the modal — the
card, the "Editing …" line — is scaffolding for the shot. **The caption, the verdict text, the
colours and the page are the real thing.**

## The images

| image | what it shows |
|---|---|
| `b4_preview_fits.png` | `subtype_sx5.quickref_v3` at its shipped value. Green: *"Fits, with 52px to spare on the tightest type (Type 5)."* |
| `b4_preview_spills.png` | The same key with one sentence added. Amber: *"The subtype summary runs to 5 lines. Three is the most that fits — a fourth pushes the page onto a second sheet."* |

**Look at the spilling one and then at the subtype box in the page beneath it.** The summary runs to
five lines there, visibly. The verdict and the evidence for it are in the same frame.

## Two details worth noticing

**The caption says which type the picture is.** For a static key the verdict covers all nine types
while the image shows one — so the caption reads *"showing Type N"* and the verdict says *"on the
tightest type"*. Without that the picture would quietly claim to be the thing that was measured.

**The spilling example still had 14.11 px of page left.** It is flagged on **line count**, not on
height: the summary broke its three-line bound before the page ran out of room. That is why the
check measures both, and it is the case a height-only check would have passed.
