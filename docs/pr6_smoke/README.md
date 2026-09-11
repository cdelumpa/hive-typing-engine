# PR 6 Build B1 — smoke sheet: Development Ideas (sheet 11)

**Full-page renders of sheet 11 for all nine types**, at 2× device scale, through the real
document builder (`buildClientModel` → `buildClientReportHTML_v3`), in the report's shared styling
(decision D1). Regenerate with `node scripts/smoke_sheet11.js`; it measures with the same probe CI
uses and prints the table below.

## What Cai is being asked to judge

D1–D4 prove, on every render, that each page fits, that the three cards share one shape, that every
Field Experiment is a bold label and a body, and that the rail descriptions are the same everywhere.
**What they cannot prove is whether the page reads well** — whether the rail-and-card rhythm holds
across very different list lengths, and whether the pages with a lot of spare room look deliberate
rather than unfinished. That is this sheet's question.

## The images

Every image is **REACHABLE IN PRODUCTION** once v3 goes live at PR 7, content as of Build A:
the nine source extracts, unedited.

| image | what to look at |
|---|---|
| `sheet11_contact_sheet.png` | All nine types side by side, each labelled with its spare room, rendered lines and items. Start here. |
| `sheet11_type9.png` | **The tightest page**: 93.87px free, 14 items. The longest Growth Strategies list (7). |
| `sheet11_type6.png` | **The loosest page**: 205.62px free. The spare room gathers above the closing note, which sits 14px over the footer's rule. |
| `sheet11_type1.png` | The longest Inquiries (8 lines): a card whose height is set by its list, not its rail. |
| `sheet11_type9_long_name.png` | **The D-B2 reserve**: an 82-character client name wraps the page header onto two lines, and the page still fits with 82.87px free. Note the brand also wraps — see the build report, §7. |
| `sheet11_type2` … `_type8` | The rest of the nine. |

| Type | Natural px | Free px | Lines G/I/E | Items G/I/E |
|---|---|---|---|---|
| 1 | 950.13 | 105.87 | 6/8/9 | 5/4/3 |
| 2 | 893.88 | 162.12 | 6/5/9 | 5/4/3 |
| 3 | 893.88 | 162.12 | 7/4/9 | 5/4/3 |
| 4 | 912.63 | 143.37 | 7/5/9 | 6/3/3 |
| 5 | 893.88 | 162.12 | 6/5/9 | 5/4/3 |
| 6 | 850.38 | 205.62 | 5/4/9 | 5/3/3 |
| 7 | 900.63 | 155.37 | 7/5/9 | 4/3/3 |
| 8 | 918.63 | 137.37 | 7/5/9 | 6/4/3 |
| 9 | 962.13 | 93.87 | 7/7/9 | 7/4/3 |

Type 9 with the long-name fixture: 973.13px, 82.87px free — the tightest page the report can produce
today, and the figure the uniformity pass should read its budget against.

## What the checks cover, and what they do not

**Covered, on every CI render:** one sheet, and the height model (D1); card order, one rail and one
body per card, rails the full height of their cards, equal rail widths and edges, nothing past its
column (D2); a bold label ending in a colon then body text on every experiment, and no bold in the
other two lists (D3); the lead, closing note, titles and rail descriptions equal to the library on
every type, and the canonical H1 (D4).

**Not covered — for your eye:** the ragged last lines the content carries today (Type 9's "me?",
Type 1's "bit?"), which are the uniformity pass's to fix, not the layout's; and whether the white
space on the shortest pages reads as intended.
