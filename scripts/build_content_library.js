'use strict';

/**
 * build_content_library.js — Step 7 Phase 2.
 *
 * Compiles the static content library docx into app/content/content_library.json.
 * Authoring surface stays Word; this script parses it into the runtime store.
 * Offline; no API key. Word stays the single editing surface (handles smart quotes).
 *
 *   docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx
 *        │  node scripts/build_content_library.js
 *        ▼
 *   app/content/content_library.json   (keys: type_1..type_9, subtype_sp1..sx9, static)
 *
 * Hard coverage gate: 9 types × required keys, 27 subtypes × 3 pattern blocks +
 * narrative + shifts; wing/line targets validated against the engine. The 6 global
 * static.* units are not in the docx — emitted as null with a PENDING warning
 * (not a hard fail), pending a separate authoring pass before Phase 6.
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const JSZip = require(path.join(ROOT, 'app/node_modules/jszip'));

const DOCX = path.join(ROOT, 'docs/step7-incoming/InsightOut_Static_Content_Library_v1_060526.docx');
const OUT  = path.join(ROOT, 'app/content/content_library.json');

// INTERIM SOURCE — provisional welcome content pending canonical binary-docx
// reconciliation (tracked offline). Do not treat as permanent source of truth.
// When the canonical step7-incoming docx gains a Word-styled WELCOME PAGE section,
// replace this with a parseStatics() read and confirm regenerated output is identical.
// PR 2 note: the letters below are the copy approved for the v3 twelve-page report. They
// supersede BOTH the previous interim text and the v2 mockup. The mockup's third paragraph
// described a page order v3.0 does not have — it promised "first a quick summary of your
// results, then a brief introduction", where the real order is Welcome (sheet 3) → What Is
// (sheet 4) → Quick Reference (sheet 5). Shipping it would have had page one misdescribe
// the report. See docs/audit_pr2_static_pages.md.
//
// `callout` is retained but is now ORPHANED: the v3 Welcome page has no callout box, and
// its substance ("You are the final authority on your own type") folded into letters[2].
// Kept so the shape gate still holds and so removal is a deliberate later decision, not a
// side effect of this PR.
const INTERIM_WELCOME = {
  subhead: "You just did something most people never do.",
  letters: [
    "You took the time to look inward. That's not a small thing. However you were introduced to InsightOut (through a coach, a friend, or sheer coincidence), we're glad you're here.",
    "This report is built from your answers to the InsightOut Enneagram Assessment. It introduces the basic Enneagram concepts, goes deep on your \"home base\" type, explores the dynamics that shape it, and offers development ideas for putting what you learn to work.",
    "Hold all of it as a hypothesis to be tested in the real world. You are the final authority on your own type; what follows is a starting point. Our goal is to help you see yourself more clearly: what drives you, how you see the world, and why you do the things you do. That clarity is what lets you step out of your default patterns and bring more range to everyday life.",
    "If you want to go further, connect with us or any InsightOut-certified coach, or visit www.hiveleadership.com/the-enneagram.",
    "We're honored to be on this journey with you."
  ],
  signoff: "With gratitude and respect,",
  callout: "You are the final authority on your own type. If something in here resonates deeply, wonderful — that's the recognition we're going for. If something doesn't quite fit, that's useful information too. Hold all of it lightly, and stay curious."
};

// INTERIM SOURCE — client report v3 Contents page (sheet 2). Nine entries, transcribed
// verbatim from docs/mockup/claude_The_Peacemaker_Page_TOC_v2.html except entry 07 (see
// below). Same contract as INTERIM_WELCOME: when the docx gains a CONTENTS ENTRIES section
// this becomes a parseStatics() read and the regenerated output must be identical.
//
// `start` names the FIRST sheet of the entry's span, never a page number. Entry 04 spans
// sheets 6-7 (footers 4-5) and is listed once, which is why nine entries cover ten numbered
// sheets and footer 5 never appears in the page column. Page numbers are resolved from
// V3_PAGE_ORDER at render time — never stored here.
//
// Three descriptors carry tokens: {type_word} ("Nine"), {subtype_label} ("One-to-One Nine")
// and {nickname_plural} ("Peacemakers"). Entry 07's descriptor is the one deliberate
// departure from the mockup: the shipped string read "your instincts priority", a reference
// to the instinct stack that decision D4 cut from page 10, and it was ungrammatical. The
// replacement binds to {subtype_label} rather than a [Subtype] [Nickname] pair because all
// 27 labels begin Self-Preservation / Social / One-to-One and therefore all take "a", which
// removes the a/an agreement problem instead of solving it with a conditional.
const INTERIM_CONTENTS = [
  { start: 'welcome',   desc: 'What this report is, how to use it, and what to bring to your debrief.' },
  { start: 'whatis',    desc: 'A brief introduction to the system: nine types, one dynamic map.' },
  { start: 'quickref',  desc: 'Your assessment results at a glance, and tips for your debrief conversation.' },
  { start: 'typeA',     desc: 'Your leading type, its core motivation, and how the pattern shows up in the real world.' },
  { start: 'wings',     desc: 'The two adjacent types that flavor your {type_word}, and what each one offers you.' },
  { start: 'lines',     desc: 'Where you move under pressure and in flow, and how to draw on both.' },
  { start: 'instincts', desc: 'Your dominant instinct, the three instincts, and what it means to be a {subtype_label}.' },
  { start: 'car',       desc: 'Practical ways to build courage, agility, and resilience, starting today.' },
  // Entry 09 departs from TOC_v2.html, which promised "what to expect in your debrief
  // conversation" — the approved p12 copy does not deliver that. Same class of defect as
  // the entry 07 instinct-stack reference: a descriptor promising content the page no
  // longer carries.
  { start: 'thoughts',  desc: 'A closing note and questions to reflect and/or journal on.' },
];

// INTERIM SOURCE — client report v3 "Your Thoughts" page (sheet 12). Approved copy; the
// intro and prompts 3-5 supersede the mockup.
//
// Prompt 3 previously read "Of the development ideas on the previous page (Courage,
// Agility, and Resilience), what would create the most leverage…". The positional
// cross-reference was true only while Development Ideas is sheet 11 and would have broken
// silently inside a client-facing PDF on any reorder. It is deliberately gone; do not
// reintroduce it. The rewrite also drops the prompt from two rendered lines to one.
//
// Coach reference rule across Welcome and this page: "an InsightOut coach", never "your
// coach" — Welcome states a reader may have arrived "through a coach, a friend, or sheer
// coincidence", so not every reader has one.
const INTERIM_THOUGHTS = {
  intro: "Whatever landed as recognition is good data. So is whatever made you want to argue with a paragraph or two. This report is a hypothesis, not a verdict, and the only way to test it is against your own experience. The questions below are a place to start. An InsightOut coach can help you pressure-test any of it.",
  prompts: [
    "What's one thing you want to remember from this report?",
    "What's one thing you're still curious about and want to learn more about?",
    "What's one insight from Development Ideas you'd like to work on?",
    "What would working on that insight give you?",
    "What else would you like to capture?",
  ],
};

// INTERIM SOURCE — "Using Your Wings and Lines" bullets.
// Migrated to the CMS by hand in commit 36aab5c (static.wings_using) WITHOUT a matching
// parser change, so this script did not reproduce it. Re-running the build therefore
// silently dropped the key and regressed the live Wings & Lines page to an empty list
// (renderer.js guards with `|| ''`, so it failed silently rather than crashing).
// Restoring it here makes this script the sole producer of content_library.json again,
// which is what makes a rebuild idempotent and safe. Same contract as INTERIM_WELCOME:
// when the canonical docx gains a Word-styled USING YOUR WINGS AND LINES section, replace
// this with a parseStatics() read and confirm regenerated output is identical.
const INTERIM_WINGS_USING = [
  'Notice which wing is more active this week. You don\'t need to pick one permanently — just observe where the texture is coming from right now.',
  'Use your stress point as an early warning system. When you notice yourself moving into that pattern, something important has been pushed aside.',
  'Your security point is a resource, not just a destination. You can consciously move toward those qualities before you need them.',
  'Wings and lines aren\'t fixed. They\'re dynamic — the texture of your type shifts with context, stress, and growth.',
].join('\n');

// INTERIM SOURCE — client report v3 "Your Wings" page content, all nine types.
//
// Hive-authored copy. Types 1-8 transcribed from
// docs/hive_insightout_wings_content_all_types_081226_r2_verified.md (revision 2,
// render-verified) by a parser reading that document, not by hand. Type 9 is the original
// mockup copy, reproduced in r2 unchanged and asserted here byte-identical to what the
// library already shipped — 14/14 zones — which is what proves the parser reads the
// document correctly rather than merely plausibly.
//
// 126 zones: 112 new, 14 Type 9. Two differ from r2 as authored, both ratified before this
// build and both listed with before/after in docs/wings_content_r3_changed_zones.md:
//   type 2, wing 3, bullet 3   52ch -> 45ch   (52 wrapped to two lines at 3% fill)
//   type 3, wing 4, resource  157ch -> 148ch  (157 ran to four lines at 22% fill)
// Nothing else was re-cut. The character bands those two were cut to are the MEASURED ones
// from docs/audit_pr3_wings.md section C3a — bullets <=48 or 69-89, resource bands 134-150
// or 186-196 — not the older proxy the r2 document itself was drafted against.
//
// The v3 page needs three fields per wing that the docx schema has no sections for, so this
// content has never had a docx equivalent for ANY type, Type 9 included. Unlike
// INTERIM_LINES_V3 it therefore replaces nothing: it is purely additive, and the
// Word-canonical accounting in verify_content_library.js reflects that.
//
// This constant is the editing surface for the page. validateType() enforces every field
// unconditionally for all nine types.

/**
 * The page intro. IDENTICAL for all nine types, so it lives here once and every entry
 * references it — nine copies of one paragraph would be nine chances to drift, and the gate
 * can only see an empty intro, never a divergent one.
 *
 * "...lean more towards one wing." is r2's wording and a deliberate change to live output:
 * the shipped Type 9 page reads "...lean more towards one." Decided by Cai, applied here,
 * and it is the one intentional change to Type 9's rendered page in this PR.
 */
const WINGS_INTRO_V3 = 'Wings are the two types immediately adjacent to your home base type. Each wing "flavors" how your type shows up, and most people naturally lean more towards one wing. Both are always present, but which one shows up more is unique to you. When you access your wings intentionally they become valuable resources for balancing the automatic patterns of your home base type.';

const INTERIM_WINGS_V3 = {
  1: {
    intro: WINGS_INTRO_V3,
    wings: {
      9: {
        overview: "A One with a stronger Nine wing tends to be softer, more easygoing, and more patient. The Nine wing brings acceptance and a willingness to let things be, which can cool the inner critic's heat.",
        bullets: [
          'You can let a thing stay imperfect without feeling the pull to correct it.',
          'You bring patience where there was urgency.',
          'Your standards hold; the pressure eases.',
          'Others may find you calmer and more approachable than they expect of a One.',
          'Left unexamined, the drive to improve can quietly settle into passivity and drift.',
        ],
        resource: "When you need to soften, wait, or let something be good enough, reach for the Nine wing. It turns the Improver's precision into something more forgiving.",
      },
      2: {
        overview: 'A One with a strong Two wing is warmer, more people-focused, and more openly caring. The Two wing brings attention to relationships and a real desire to help, softening the corrective edge.',
        bullets: [
          'You lead with warmth, so correction lands as care.',
          "You notice what people need, not only what's wrong.",
          'You hold standards without losing warmth.',
          'Others may find you warmer and more openly generous than they expect of a One.',
          'Left unchecked, criticism can arrive dressed up as helpfulness and concern.',
        ],
        resource: "When you need to connect, encourage, or lead with care, reach for the Two wing. It turns the Improver's high standards into something people can receive.",
      },
    },
  },
  2: {
    intro: WINGS_INTRO_V3,
    wings: {
      1: {
        overview: "A Two with a strong One wing is more structured, principled, and attentive to doing things correctly. The One wing brings discipline and a sense of right conduct to the Two's generosity.",
        bullets: [
          'You give with structure, not just with feeling.',
          'You follow through on what you offer to do.',
          'Your generosity carries a sense of right conduct.',
          'Others may find you more principled and steady than they expect of a Two.',
          "Left unchecked, warmth can cool into criticism when care isn't done properly.",
        ],
        resource: "When you need to hold a boundary or say the harder thing, reach for the One wing. It turns the Giver's warmth into something with a spine.",
      },
      3: {
        overview: "A Two with a strong Three wing is more outgoing, ambitious, and image-aware. The Three wing brings energy and charisma to the Two's warmth, making the care both visible and effective in the wider world.",
        bullets: [
          'You turn care into visible, effective action.',
          'You move easily between warmth and results.',
          'People are drawn to you, and you use it well.',
          'Others may find you more ambitious and polished than they expect of a Two.',
          'Left unexamined, giving can become a performance calibrated to how it lands.',
        ],
        resource: "When you need reach, momentum, or visible results, reach for the Three wing. It turns the Giver's generosity into something that scales.",
      },
    },
  },
  3: {
    intro: WINGS_INTRO_V3,
    wings: {
      2: {
        overview: 'A Three with a strong Two wing is warmer, more people-oriented, and more charming. The Two wing brings genuine care about others into the success drive, so achievement becomes something shared.',
        bullets: [
          'You lead through connection, not only results.',
          'You notice people while you drive toward the goal.',
          'Your success tends to lift the people around you.',
          'Others may find you warmer and more generous than they expect of a Three.',
          'Left unchecked, you can end up chasing approval on two fronts at the same time.',
        ],
        resource: "When you need to bring people with you rather than past them, reach for the Two wing. It turns the Performer's drive into something others want to join.",
      },
      4: {
        overview: 'A Three with a strong Four wing is more introspective, artistic, and attuned to personal expression. The Four wing brings emotional depth and a pull toward authenticity into the achievement drive.',
        bullets: [
          'You want the work to mean something.',
          'You bring real aesthetic judgment to what you make.',
          'You notice quickly when the image and the substance underneath have parted ways.',
          'Others may find you deeper and more self-questioning than they expect of a Three.',
          'Left unexamined, that noticing can quietly curdle into private dissatisfaction.',
        ],
        resource: "When you need to know whether the work matters, reach for the Four wing. It turns the Performer's momentum into something with substance underneath.",
      },
    },
  },
  4: {
    intro: WINGS_INTRO_V3,
    wings: {
      3: {
        overview: 'A Four with a strong Three wing is more outgoing, more accomplished, and more engaged with the outside world. The Three wing brings drive and a capacity to turn inner intensity into visible work.',
        bullets: [
          'You get your inner world out into the open.',
          'You can finish things, not just feel them.',
          'Your intensity translates into work people can see.',
          'Others may find you more driven and productive than they expect of a Four.',
          'Left unchecked, the pull to be seen starts competing with the pull to be real.',
        ],
        resource: "When you need to finish, ship, or be seen, reach for the Three wing. It turns the Individualist's depth into something that reaches other people.",
      },
      5: {
        overview: "A Four with a strong Five wing is more introspective, more private, and more intellectually focused. The Five wing brings analysis and a love of ideas to the Four's emotional depth.",
        bullets: [
          'You think as carefully as you feel.',
          'You go deep into what interests you and stay there.',
          'Solitude restores you rather than draining you.',
          'Others may find you more contained and private than they expect of a Four.',
          'Left unexamined, longing plus withdrawal can settle into real loneliness.',
        ],
        resource: "When a mood has you in its grip, reach for the Five wing. It turns the Individualist's feeling into something you can examine rather than inhabit.",
      },
    },
  },
  5: {
    intro: WINGS_INTRO_V3,
    wings: {
      4: {
        overview: "A Five with a strong Four wing is more emotionally sensitive, more creative, and more attuned to beauty. The Four wing brings feeling and a pull toward meaning into the Five's intellectual life.",
        bullets: [
          'You feel your way into ideas, not just think them.',
          'You bring aesthetic judgment to what you build.',
          'Your inner world is unusually rich.',
          'Others may find you warmer and more expressive than they expect of a Five.',
          'Left unexamined, feeling and analysis can start pulling in opposite directions.',
        ],
        resource: "When the analysis has gone cold, reach for the Four wing. It turns the Observer's clarity into something with warmth in it.",
      },
      6: {
        overview: "A Five with a strong Six wing is more cautious, more loyal, and more engaged with questions of trust. The Six wing brings vigilance and practical problem-solving into the Five's observing stance.",
        bullets: [
          'You see problems coming before other people do.',
          'You engage with systems instead of watching them.',
          'You show real loyalty to the few you trust.',
          'Others may find you more practical and involved than they expect of a Five.',
          'Left unchecked, two head types together can spin worry into real paralysis.',
        ],
        resource: "When you need to act before you have all the information, reach for the Six wing. It turns the Observer's caution into practical preparation.",
      },
    },
  },
  6: {
    intro: WINGS_INTRO_V3,
    wings: {
      5: {
        overview: 'A Six with a strong Five wing is more introverted, more analytical, and more inclined to gather information before acting. The Five wing brings intellectual depth and a habit of withdrawing to think.',
        bullets: [
          'You think a problem through before moving.',
          "You hold real expertise in what you've committed to.",
          'You stay calm while you analyze.',
          'Others may find you more self-contained and private than they expect of a Six.',
          'Left unchecked, withdrawing to think can amplify the worry rather than settle it.',
        ],
        resource: "When the questions are spinning and you need solid ground, reach for the Five wing. It turns the Questioner's vigilance into patient analysis.",
      },
      7: {
        overview: 'A Six with a strong Seven wing is more outgoing, more playful, and more comfortable with risk. The Seven wing brings optimism and a willingness to reframe fear toward possibility rather than threat.',
        bullets: [
          'You find the lighter angle when the room runs heavy.',
          'You take risks the pure Six pattern would avoid.',
          'Your loyalty comes with genuine warmth and humor.',
          'Others may find you more easygoing and light-hearted than they expect of a Six.',
          'Left unexamined, reframing can become a way to skip past the fear entirely.',
        ],
        resource: "When worry has narrowed the field to a single bad outcome, reach for the Seven wing. It turns the Questioner's what-ifs into possibilities worth exploring.",
      },
    },
  },
  7: {
    intro: WINGS_INTRO_V3,
    wings: {
      6: {
        overview: "A Seven with a strong Six wing is more loyal, more responsible, and more attentive to relationships. The Six wing brings warmth and a capacity for genuine commitment into the Seven's forward motion.",
        bullets: [
          'You stay with people and projects past the novelty.',
          'You notice what could go wrong before you leap.',
          'Your enthusiasm comes with follow-through.',
          'Others may find you steadier and more reliable than they expect of a Seven.',
          'Left unchecked, optimism and worry run at the same time, and both are tiring.',
        ],
        resource: "When you need to stay, finish, or keep a promise, reach for the Six wing. It turns the Enthusiast's energy into something people can count on.",
      },
      8: {
        overview: "A Seven with a strong Eight wing is more assertive, more action-oriented, and more willing to push through resistance. The Eight wing brings directness and a tolerance for conflict into the Seven's energy.",
        bullets: [
          'You turn ideas into motion fast.',
          'You push through resistance rather than around it.',
          'You say the hard thing when it needs saying.',
          'Others may find you more forceful and decisive than they expect of a Seven.',
          'Left unexamined, impatience with slower people can quietly cost you the room.',
        ],
        resource: "When something needs to happen now and nobody else will move, reach for the Eight wing. It turns the Enthusiast's ideas into decisive action.",
      },
    },
  },
  8: {
    intro: WINGS_INTRO_V3,
    wings: {
      7: {
        overview: "An Eight with a strong Seven wing is more outgoing, more playful, and more entrepreneurial. The Seven wing brings optimism and a taste for life's pleasures into the Eight's intensity.",
        bullets: [
          'You bring appetite to everything you take on.',
          'You see opportunity where others see only the fight.',
          'Your intensity comes with real charm.',
          'Others may find you more playful and expansive than they expect of an Eight.',
          'Left unchecked, two fast-moving types together can act well before thinking.',
        ],
        resource: "When the work needs lightness or a fresh angle, reach for the Seven wing. It turns the Protector's force into something people enjoy being near.",
      },
      9: {
        overview: "An Eight with a strong Nine wing is more grounded, more patient, and more measured. The Nine wing brings calm and a quality of steady presence into the Eight's energy.",
        bullets: [
          'You hold your ground without needing to push.',
          'Your power is felt before it is announced.',
          'You stay calm when the pressure rises.',
          'Others may find you steadier and more approachable than they expect of an Eight.',
          'Left unexamined, comfort-seeking can talk you out of a needed confrontation.',
        ],
        resource: "When you need to lower the temperature in a room, reach for the Nine wing. It turns the Protector's strength into steady, unhurried presence.",
      },
    },
  },
  9: {
    intro: WINGS_INTRO_V3,
    wings: {
      8: {
        overview: 'A Nine with a strong Eight wing carries more edge, more appetite, and more willingness to push back when pushed. The Eight wing brings access to anger as a useful signal rather than something to manage away.',
        bullets: [
          'You carry real presence, and you will protect others more readily than yourself.',
          'You can be direct, and you will confront something that matters to you.',
          'Once you know where you stand, you act on it.',
          'Others may find you more grounded and forceful than your easygoing manner suggests.',
          'Left unexamined, irritation can arrive suddenly and then vanish back into accommodation.',
        ],
        resource: "When you need to hold a position, take up space, or act decisively, reach for the Eight wing. It turns the Peacemaker's steadiness into something with backbone.",
      },
      1: {
        overview: 'A Nine with a stronger One wing carries more structure, more attention to doing things properly, and more internal discipline. The One wing brings a sense that things should be a certain way.',
        bullets: [
          'You follow through on things, where Nine energy on its own might drift.',
          'You hold standards and want things done right.',
          'You bring care and craft to what you take on.',
          'Others may find you more orderly and idealistic than they expect of a Nine.',
          'Left unchecked, quiet perfectionism can turn self-forgetting into self-judgment.',
        ],
        resource: "When you need focus, standards, or the discipline to finish something important, reach for the One wing. It channels the Peacemaker's acceptance into something more purposeful.",
      },
    },
  },
};

// INTERIM SOURCE — client report v3 "Your Stress and Security Points" page (sheet 9).
// Hive-authored copy, transcribed verbatim from scripts/spike/p9_lines_content.js on
// pr-3-per-type-pages, where it was written and render-verified across seven spike rounds.
// Every one of the 119 strings below was copied by machine and asserted byte-identical
// against that file, not retyped.
//
// THIS CONSTANT IS THE EDITING SURFACE FOR THESE FIELDS. `narrative` and `resource_card`
// are also parsed from the docx a few lines below in assembleType(); the values here
// REPLACE them for all nine types. That is the ratified 13 Aug 2026 position — the docx is
// source material for this page, not its source of truth. It was not a style preference:
// the docx narratives run 284-351 characters against a layout drawn for ~189, and round 1
// measured every type it tried spilling past one sheet. These are rewritten to the layout's
// numbers, at 3 rendered lines for narratives and 2 for bands.
//
// The practical consequence, stated so nobody loses an afternoon to it: editing a p9
// narrative or resource card in the docx now has NO effect on the built library. Edit it
// here. validateLines() below is unconditional for all nine types, so this page cannot land
// blank the way p8 Wings could.
//
// intro and work_lead are static across all nine types (ratified 13 Aug 2026), as are the
// three .v3-work-lbl labels, which live in the renderer rather than here because they are
// layout furniture rather than content.
const INTERIM_LINES_V3 = {
  intro: "The Enneagram system shows you where you tend to move when you're feeling secure and in flow, and where you tend to move under an unusual amount of stress. Both moves happen in the background, part of the same internal operating system as your Home Base type and your Wings. When you access these points intentionally they become valuable resources to expand your range of choices in any situation.",
  work_lead: 'Your Wings and your Stress and Security points give you more choices, and more range. The first step is catching yourself in the moment, pausing to notice, and then making a purposeful choice.',
  types: {
    1: {
      stress: {
        narrative: "Under pressure, Ones shift toward Four energy — more emotional, melancholic, focused on what's missing. The composed surface cracks.",
        resource_card: 'Draw on it when you need emotional depth, honesty, and the courage to feel what is actually there.',
        bullets: [
          'Your standards go unmet, your effort unnoticed, and something underneath now feels personal.',
          'The self-correction turns inward and sours into a heavier, far more private sense of being unseen.',
          'Proportion goes: the flaw grows larger, the whole picture shrinks, and the mood carries the day.',
        ],
      },
      security: {
        narrative: 'When Ones feel safe and resourced, they move toward Seven energy — more spontaneous and playful. The standard stops running the day.',
        resource_card: 'Draw on it when you need spontaneity, play, and permission for things to be imperfect.',
        bullets: [
          'The grip loosens: possibility returns, the day opens up, and good things feel allowed again.',
          'It comes within reach when the work is good enough and you deliberately let yourself stop checking.',
          'Rest stops needing to be earned, and pleasure stops arriving only after the list is finished.',
        ],
      },
      work: [
        'You notice the correcting turn inward, and the tone of it shifting from standards to something personal.',
        'One flaw has filled the frame, and everything else that is true about the work has dropped out of view.',
        'Say out loud what good enough actually looks like here, and then let the work be finished at that.',
      ],
    },
    2: {
      stress: {
        narrative: 'Under pressure, Twos shift toward Eight — more forceful, blunt, and openly angry. The warmth hardens into demand.',
        resource_card: 'Draw on it when you need directness, backbone, and the will to say what you actually want.',
        bullets: [
          'The giving has not been returned, and something owed is starting to feel unpaid.',
          'You stop asking and start telling, and the edge in your voice surprises people.',
          'The help you gave becomes a debt you are collecting, and that changes what it was.',
        ],
      },
      security: {
        narrative: 'When Twos feel safe and supported, they move toward Four energy — more inward and honest about their own needs. The attention turns home.',
        resource_card: 'Draw on it when you need depth, honesty, and real contact with what you actually feel.',
        bullets: [
          'You know what you are feeling before you know what anyone else needs from you.',
          'It becomes reachable when being liked stops being the price of being yourself.',
          'Your own wanting becomes something to follow rather than something to apologize for.',
        ],
      },
      work: [
        'You notice the giving turning into keeping score, and the warmth going hard at the edges of what you say.',
        'The care you meant to give has turned into an account you are quietly keeping, and other people can feel it.',
        'Ask for the thing you want directly, out loud, before the asking turns into a bill for services.',
      ],
    },
    3: {
      stress: {
        narrative: 'Under pressure, Threes shift toward Nine — more disengaged, diffuse, unable to mobilize. The engine stalls out.',
        resource_card: 'Draw on it when you need rest, presence, and the ability to stop without losing yourself.',
        bullets: [
          'The results stopped landing, and effort no longer converts into anything visible.',
          'You go quiet and busy at once: motion without traction, tasks without the goal.',
          'The drive that usually carries you is the exact thing that will not start now.',
        ],
      },
      security: {
        narrative: 'When Threes feel safe and supported, they move toward Six — more loyal and collaborative. Success stops being a solo project.',
        resource_card: 'Draw on it when you need loyalty, trust, and a purpose you share with other people.',
        bullets: [
          'You work with people rather than past them, and the win stops being only yours.',
          'It becomes reachable when you let someone see the effort and not just the result.',
          'Belonging stops competing with achievement, and starts making it worth something.',
        ],
      },
      work: [
        'You notice the momentum going flat, and yourself filling the day with motion that goes nowhere.',
        'The harder you push the less moves, and the person underneath the performance is out of reach.',
        'Stop, and tell one person what is actually going on for you before you produce another result.',
      ],
    },
    4: {
      stress: {
        narrative: 'Under pressure, Fours shift toward Two energy — more focused on others, over-giving, seeking connection by being needed. The self recedes.',
        resource_card: 'Draw on it when you need warmth, generosity, and real attention to what someone else needs.',
        bullets: [
          'The connection you want is not arriving, so you work harder to earn yourself a place in it.',
          'Attention swings outward: you tend to their needs closely and stop naming any of your own.',
          "What gets lost is you: the self you were protecting disappears into someone else's needs.",
        ],
      },
      security: {
        narrative: 'When Fours feel safe and supported, they move toward One energy — more disciplined and structured. Ideals turn into action.',
        resource_card: 'Draw on it when you need discipline, structure, and the follow-through to finish what you start.',
        bullets: [
          'Feeling settles into structure: you work steadily and the day holds its shape without effort.',
          'It becomes reachable when the feeling is allowed to pass and the next small task is begun.',
          'The work stops waiting on the mood, and something gets finished while the feeling still moves.',
        ],
      },
      work: [
        "You notice yourself tending closely to everyone else's needs, and going quiet about anything of your own.",
        'You have gone missing from your own day, and nobody has noticed because you are being so useful.',
        'Say one thing you actually want, out loud, before you have worked out whether it will be welcome.',
      ],
    },
    5: {
      stress: {
        narrative: 'Under pressure, Fives shift toward Seven energy — more scattered, restless, escaping into possibility. The careful focus fragments.',
        resource_card: 'Draw on it when you need spontaneity, range, and a reason to come out and engage.',
        bullets: [
          'The demands have outrun what you have to give, and the reserve is nearly gone.',
          'The mind starts running everywhere at once, and none of it settles into work.',
          'What goes first is the depth: attention scatters across everything and lands nowhere.',
        ],
      },
      security: {
        narrative: 'When Fives feel safe and resourced, they move toward Eight — more assertive, embodied, willing to act. Thinking turns into doing.',
        resource_card: 'Draw on it when you need presence, directness, and the will to act on what you know.',
        bullets: [
          'You take up space in the room, and what you understand finally arrives out loud.',
          'It becomes reachable when there is enough left over to spend some of it on people.',
          'Knowing stops being a private store, and starts being something you act on.',
        ],
      },
      work: [
        'You notice the focus fragmenting, and yourself reaching for anything other than the thing itself.',
        'The energy you were guarding is going out sideways, and none of it is reaching the work that matters.',
        'Pick the one thing, close everything else, and stay with it for longer than feels comfortable.',
      ],
    },
    6: {
      stress: {
        narrative: 'Under pressure, Sixes shift toward Three energy — more driven, image-focused, outrunning the doubt. Activity replaces certainty.',
        resource_card: 'Draw on it when you need drive, decisiveness, and the momentum to act before you are sure.',
        bullets: [
          'The uncertainty has not resolved, so you start moving fast enough to outrun it.',
          'Doing replaces deciding: you produce and perform while the question stays open.',
          'The doubt does not leave, it just goes underground and waits for a quiet moment.',
        ],
      },
      security: {
        narrative: 'When Sixes feel safe and supported, they move toward Nine — steadier, more accepting, less braced. The scanning quiets down.',
        resource_card: 'Draw on it when you need steadiness, ease, and the ability to let something be fine.',
        bullets: [
          'The bracing stops: you are simply here, and nothing needs checking right now.',
          'It becomes reachable when the people around you have earned the trust you gave.',
          'Certainty stops being the price of calm, and the calm turns up without it anyway.',
        ],
      },
      work: [
        'You notice the scanning start up, and yourself getting busy so the open question has less room.',
        'You are moving quickly and deciding nothing, and the doubt is waiting exactly where it was.',
        'Name the thing you are actually unsure about, say it out loud, and then make the call anyway.',
      ],
    },
    7: {
      stress: {
        narrative: 'Under pressure, Sevens shift toward One energy — more critical, rigid, sharply focused on what is wrong. The optimism narrows.',
        resource_card: 'Draw on it when you need discernment, standards, and the discipline to finish something.',
        bullets: [
          'The exits have closed and the reframe is not working, so something has to be wrong.',
          'The lightness goes sharp: you start correcting, judging, finding fault out loud.',
          'What you were outrunning has caught up, and now it is looking for someone to blame.',
        ],
      },
      security: {
        narrative: 'When Sevens feel safe and resourced, they move toward Five — more focused and reflective. Breadth turns into depth.',
        resource_card: 'Draw on it when you need focus, quiet, and the patience to go all the way in.',
        bullets: [
          'You stay with one thing for long enough that it actually becomes yours to keep.',
          'It becomes reachable when stopping stops feeling like something is being lost.',
          'Depth turns out to hold more than the next option ever did, and you notice.',
        ],
      },
      work: [
        'You notice the mood turning sharp, and yourself finding fault with whatever is in front of you.',
        'The thing you were moving away from has arrived anyway, and the irritation is where it lives.',
        'Stay in the room with the discomfort for one more minute before you reach for the next thing.',
      ],
    },
    8: {
      stress: {
        narrative: 'Under pressure, Eights shift toward Five energy — more withdrawn, cerebral, detached. The forward force goes quiet and retreats inward.',
        resource_card: 'Draw on it when you need strategy, patience, and the ability to observe before acting.',
        bullets: [
          'The situation stops yielding to force, and pushing harder is no longer changing anything.',
          'The forward motion goes quiet: you pull back, say less, and handle it alone in your head.',
          'Contact goes first: the people who would help are the ones being held furthest away.',
        ],
      },
      security: {
        narrative: 'When Eights feel safe and resourced, they move toward Two energy — warmer, more openly caring, more willing to tend to others.',
        resource_card: 'Draw on it when you need warmth, attunement, and strength that expresses itself as care.',
        bullets: [
          'The armor comes off: warmth shows without being asked for, and care arrives before force.',
          'It becomes reachable when trust is genuinely present and nothing has to be defended.',
          'Strength stops needing to announce itself, and protecting someone looks like tenderness.',
        ],
      },
      work: [
        'You notice yourself going quiet, pulling back from the room, and working the whole problem alone.',
        'The people who could actually help are the ones you have put furthest outside it, and they can tell.',
        'Tell one person what is actually going on before you have fixed it, or decided that you have to.',
      ],
    },
    9: {
      stress: {
        narrative: 'Under pressure, Nines shift toward Six energy — more anxious, doubting, worst-case-focused. The easy calm gives way to worry.',
        resource_card: 'Draw on it when you need vigilance, preparation, and the will to face what you would avoid.',
        bullets: [
          'Something that mattered got set aside to keep the peace, and it has not gone away.',
          'The scanning starts: every outcome gets checked, and none of them feels safe enough.',
          'The steadiness goes first: what usually holds you level is what starts to shake.',
        ],
      },
      security: {
        narrative: 'When Nines feel safe and supported, they move toward Three energy — more focused and energized. Priorities come into view.',
        resource_card: 'Draw on it when you need focus, drive, and the push to act on your own goals rather than defer.',
        bullets: [
          'The fog clears: you know what you want and you move on it without stalling.',
          "It becomes reachable when your own agenda is allowed to matter as much as everyone else's.",
          'Wanting something stops feeling like a risk to the peace, and starts moving you.',
        ],
      },
      work: [
        'You notice yourself going along with something, agreeing easily, while the thing you actually think stays unsaid.',
        'The peace you are keeping is costing you your own position, and the worry underneath it keeps growing.',
        'Name the one thing you want here, out loud, before the moment closes and going along becomes the answer.',
      ],
    },
  },
};

// INTERIM SOURCE — client report v3 "Exploring Your Type Hypothesis" pages (sheets 6 and 7).
//
// TYPE 9 ONLY, DELIBERATELY. This is the solo pilot before the 1/4/8 batch. Types 1-8 have no
// content here and MUST NOT render these pages — see the pilot gate on the typeA/typeB entries
// in V3_PAGE_ORDER (app/renderer.js) and validateExplore() below.
//
// PORTED, NOT AUTHORED. Every string is transcribed verbatim from the two Type 9 mockups,
//   docs/mockup/claude_The_Peacemaker_Page_LeadingType_A_v1.html   (sheet 6)
//   docs/mockup/claude_The_Peacemaker_Page_LeadingType_B_v1.html   (sheet 7)
// by reading the RENDERED DOM rather than the HTML source, because the mockup wraps prose
// across source lines and only the browser's own normalisation yields the string as it
// actually renders. 34 of 34 zones verified byte-identical against that DOM.
//
// THIS IS APPROVED HIVE CONTENT, NOT DRAFT COPY. Unlike the Wings r2 batch, nothing here
// carries standing authorization for editorial re-cuts. If a zone does not fit, that is a
// finding for Cai and Mo, not a build-time trim.
//
// The prose contains type-specific literals — "As a Peacemaker", "Nines" — which are stored
// VERBATIM rather than tokenised. Tokenising approved prose would be editing it, and the
// batch build will carry each type's own text anyway. Only the page chrome is tokenised.
//
// The docx has no sections for any of these zones (checked: no At-a-Glance, no Core Belief,
// no Decision-Making, no catching-patterns), so this cannot be a parseStatics() read. Same
// contract as INTERIM_WINGS_V3 and INTERIM_LINES_V3: when the docx gains them, replace this
// with a parser read and confirm regenerated output is identical.

// PILOT SCOPE — the single place in this file that says which types render sheets 6 and 7.
// app/renderer.js carries the matching list on the typeA/typeB V3_PAGE_ORDER entries.
// ⚠️ PLACEHOLDER, revisit before the remaining five types: two lists that must agree is
// precisely the drift this project has been bitten by, and the batch build should collapse
// them into one.
const EXPLORE_PILOT_TYPES = [1, 4, 7, 9];

const INTERIM_EXPLORE_V3 = {
  1: {
    p6: {
      worldview: 'The world is a place where goodness is always within reach but is allowed to slip away.',
      core_motivation: 'To reform, improve, and hold the line on your standards.',
      core_belief: "You'll be worthy if you are good, right, and beyond criticism.",
      glance: [
        'To feel in control of yourself, right, and beyond reproach.',
        "What's right or wrong, what's out of line with your standards, and how you're measuring up.",
        'Making mistakes, being criticized, and expressing anger outwardly.',
        'Resentment at the gap between how things are and how they should be, yourself included.',
      ],
      patterns: [
        "Your mind is filled with shoulds and have-tos — how the world ought to be and what needs to happen to fix it. You're the only one holding the line.",
        "Behind a cheerful demeanor sits frustration that things aren't as they ought to be, and a relentless inner critic that never lets you forget where you fall short.",
        'Your energy goes toward improving things, avoiding mistakes, and organizing your life. When you allow yourself to let go, you can enjoy life and the people in it, free of expectations.',
      ],
    },
    p7: {
      best: [
        { title: 'Integrity', body: "— You do what you said you'd do, whether or not anyone is watching." },
        { title: 'Quality', body: '— You bring care and exactness to the work, and it shows in the result.' },
        { title: 'Improvement', body: "— You see what could be better and you're willing to do something about it." },
      ],
      edge: [
        { title: 'The Inner Critic', body: '— Takes 2% of the truth and makes it the whole truth.' },
        { title: 'Perfectionism', body: '— Over-controlling the last 2% when 98% was already good enough.' },
        { title: 'Judgment', body: '— Holding others to your standard can cost you the relationship.' },
      ],
      styles: [
        {
          name: 'Principled and Practical',
          bullets: [
            'You speak clearly and concisely, meaning what you say with no hidden agenda.',
            'Feedback for others can land as criticism even when offered with positive intent.',
            "People can tell when you're irritated; your face and body give you away.",
          ],
        },
        {
          name: 'Making the Case',
          bullets: [
            "You frame the disagreement in terms of right and wrong. It's the principle that matters.",
            'You approach arguments logically and pragmatically, keeping emotion out of it.',
            'Conceding can feel like giving up on your standards, so you hold your position.',
          ],
        },
        {
          name: "Choosing What's Right",
          bullets: [
            "Your moral compass points you to what's right over what's easy or convenient.",
            'You take your time, measuring the options against the standard before choosing.',
            "You'll consider other views, though they have to clear the same bar yours did.",
          ],
        },
      ],
      signs: [
        'You catch yourself saying "should" a lot.',
        'You notice tightness in your jaw and body.',
        "You're reworking something that's already been done.",
      ],
      interrupt: [
        'Try replacing "should" with "what if?".',
        "Get curious about what's annoying you.",
        'Trust that you can correct things after it ships.',
      ],
    },
  },
  4: {
    p6: {
      worldview: 'The world is a place that abandons you, and leaves something essential missing.',
      core_motivation: 'To feel significant and authentic, express your uniqueness, and experience real emotional depth.',
      core_belief: "You'll reclaim the connection you lost by being special, deep, and unmistakably yourself.",
      glance: [
        'To feel whole, at home in yourself, and no longer alone in the world.',
        "What's missing, how you're different, and the ideal experience that would finally complete you.",
        "Being ordinary, feeling deficient, and settling for what's merely okay.",
        'Sadness for what you perceive to be fundamentally missing in you that others seem to have.',
      ],
      patterns: [
        'Your mind is constantly comparing you to others, making you feel better than or less than, often at the same time. In flow, you find purpose, meaning, and beauty in the smallest of things.',
        'The sadness for what you perceive to be missing gives way to envy for the ease with which others are lovable and whole. It shows up as longing, or a melancholy that colors everything.',
        "Your energy goes into cultivating and presenting a version of yourself that fills in the missing pieces. When relaxed, you're able to appreciate yourself and the world as they are.",
      ],
    },
    p7: {
      best: [
        { title: 'Depth', body: '— You sit comfortably with emotional discomfort others flinch at.' },
        { title: 'Authenticity', body: "— Your stand for what's real gives others permission to be themselves." },
        { title: 'Creativity', body: '— You turn inner experience into something others can see and feel.' },
      ],
      edge: [
        { title: 'Moody', body: '— Your emotional weather can take over and impact your relationships.' },
        { title: 'Unsatisfied', body: '— Engaging in "compare and despair" blocks your acceptance of what is.' },
        { title: 'Self-Absorbed', body: "— The intensity of your experience can crowd out room for anyone else's." },
      ],
      styles: [
        {
          name: 'Expressive and Intense',
          bullets: [
            'Your comfort holding a wide range of emotions helps others express themselves freely.',
            'You easily speak truth to power, focusing on what\'s real and on the greater "why".',
            'Your speaking style carries some intensity that can be both emphatic and intimidating.',
          ],
        },
        {
          name: 'Make It Matter',
          bullets: [
            'You want conflict to be raw, authentic, and over something meaningful.',
            "You often focus on what's lacking in the relationship or the other person's response.",
            "You expect the other person to match the emotional size you're experiencing.",
          ],
        },
        {
          name: 'What Feels True',
          bullets: [
            'How a decision feels is more important than the objective data supporting it.',
            'Decisions must align to your personal purpose, identity, and values to feel right.',
            'You tend to avoid "ordinary" paths, opting for more unique solutions to problems.',
          ],
        },
      ],
      signs: [
        'Comparison to others is bringing you down.',
        "You're feeling consumed with an emotion.",
        'What you wanted has lost its shine.',
      ],
      interrupt: [
        'Ask what you actually want, not who has it.',
        'Remember you are not your emotion.',
        'Take a moment to appreciate what you do have.',
      ],
    },
  },
  7: {
    p6: {
      worldview: 'The world is a place filled with pain and limitations that can be avoided.',
      core_motivation: 'To live life fully, escaping limits and maintaining your freedom.',
      core_belief: 'You will be okay if you keep options open, stay positive, and plan for the future.',
      glance: [
        'To experience joy, fun, and adventure in as many ways as possible.',
        "What's next, what's possible, and the quickest way around anything painful.",
        "Pain, boredom, and being trapped in something you can't leave.",
        "Fear of pain and limitation, kept at a distance by filling life with what's good.",
      ],
      patterns: [
        "Your mind is quick, associative, and always generating. The plan for what's next is often more vivid than what's actually in front of you, and staying ahead is what keeps the hard thing behind you.",
        "Being enthusiastic and positive is your default mode. What's harder is staying with something painful long enough to feel it before you pivot to the bright side.",
        'Your energy goes toward saying yes — new projects, new people, a full calendar and more ideas than time. When you slow down and go deep, the thing you started actually gets finished.',
      ],
    },
    p7: {
      best: [
        { title: 'Optimistic', body: '— Your ability to reframe negatives into positives maintains momentum.' },
        { title: 'Infectious Energy', body: '— Your playful and joyful demeanor can light up the darkest of rooms.' },
        { title: 'Creative', body: '— You generate possibilities and connect dots that make the impossible seem doable.' },
      ],
      edge: [
        { title: 'Pain-Avoidant', body: '— Pivoting too quickly away from pain loses you a valuable lesson.' },
        { title: 'Positivity Overload', body: '— Sometimes the room needs to experience the seriousness of the moment.' },
        { title: 'Scattered Attention', body: '— You often lose focus and that has a direct hit on follow-through.' },
      ],
      styles: [
        {
          name: 'Quick and Engaging',
          bullets: [
            'You think out loud, and the story arrives with three tangents attached.',
            'Your energy draws people in, and the room usually moves at your pace.',
            'Humor does real work for you, including the work of not going somewhere heavy.',
          ],
        },
        {
          name: 'React, Reframe, Move On',
          bullets: [
            "You're not afraid of a good argument, especially when your idea is on the line.",
            "You'll flood the room with options rather than sit in a conflicting opinion.",
            "Rather than process through tough emotions, you're on to the next idea.",
          ],
        },
        {
          name: 'Keeping Options Open',
          bullets: [
            'When ordering off a menu, you go last and usually have three-plus options lined up.',
            'Committing to one path means letting go of the others, which is the hard part.',
            'You see several moves ahead and plan accordingly, reserving the right to pivot.',
          ],
        },
      ],
      signs: [
        "You're drowning in possibilities.",
        'You found the bright side fast.',
        'You started something before finishing.',
      ],
      interrupt: [
        'Land on one and write down the first step.',
        'Sit with the hard part before moving past it.',
        'Circle back and finish what you started.',
      ],
    },
  },
  9: {
    p6: {
      worldview: 'The world is a place where harmony is precious and fragile, easily broken by self-interest.',
      core_motivation: 'To keep the peace, stay connected, and avoid conflict.',
      core_belief: "You'll experience harmony and connection if you set aside your own interests and blend in with others.",
      glance: [
        'To feel settled, at ease, and quietly certain that you belong.',
        "The space around you, what others want, and what's pressuring your inner peace.",
        'Discomfort, disconnection, and sharing a position that sets you apart.',
        'Anger smoldering beneath the surface, either unacknowledged or completely out of your awareness.',
      ],
      patterns: [
        "Your thoughts can stray easily, away from what's pressing and toward what's comfortable or routine. You hold multiple points of view, and keeping yours quiet is what keeps the room easy.",
        "You keep an even keel emotionally that reads as affable, diffusing your anger so thoroughly you often don't know you're angry. It comes out sideways — stubbornness, or quietly slowing the pace.",
        "You put your energy toward what keeps things peaceful — routines, familiar tasks, going along with what others want. Once you're moving on something that matters, you're steady and hard to stop.",
      ],
    },
    p7: {
      best: [
        { title: 'Peacemaking', body: '— Your calm presence reassures others, especially when things get difficult.' },
        { title: 'Patience', body: "— You let processes unfold without forcing an outcome before it's ready." },
        { title: 'Inclusiveness', body: '— You hold and convey multiple perspectives, so others feel seen and valued.' },
      ],
      edge: [
        { title: 'Conflict Avoidance', body: '— Smoothing things over leaves the real issue unaddressed.' },
        { title: 'Procrastination', body: '— The uncomfortable thing waits while the less pressing things get done.' },
        { title: 'Self-Forgetting', body: '— You merge with others so completely you forget your own priorities.' },
      ],
      styles: [
        {
          name: 'Friendly and Indirect',
          bullets: [
            "Listening is your superpower. You'd rather ask about someone than talk about yourself.",
            "You'd rather share your opinion last and sometimes the room moves on without yours.",
            "You're indirect when asserting your opinion, often asking leading questions instead.",
          ],
        },
        {
          name: 'Go Along to Get Along',
          bullets: [
            'You withdraw or concede when confronted, thinking this will restore your inner peace.',
            'When conflict is tacit, your first move is to smooth things over and seek consensus.',
            'Pushed hard enough you dig in, becoming stubborn and taking control by slowing the pace.',
          ],
        },
        {
          name: 'Every Option Counts',
          bullets: [
            'You see merit in all options, causing you to sometimes overthink the decision at hand.',
            'You are willing to trade off what you want if it runs counter to what the group wants.',
            "You're often more clear on what you don't want, which you can use to rule out options.",
          ],
        },
      ],
      signs: [
        'You say "yes" when you want to say "no".',
        "You're busy with everything but the hard thing.",
        'You ignore the tension in your body.',
      ],
      interrupt: [
        'Make a counteroffer instead of a flat "no".',
        'Do the uncomfortable thing first, for ten minutes.',
        'Pause, breathe, get curious about the tension.',
      ],
    },
  },
};

// Engine source of truth (mirrors renderer TYPE_NAMES + design A6; Phase 4 centralizes into type_meta.js).
const TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer', 4: 'The Individualist',
  5: 'The Observer', 6: 'The Questioner', 7: 'The Enthusiast', 8: 'The Protector', 9: 'The Peacemaker',
};
const TYPE_META = {
  1: { stress: 4, security: 7, wings: [9, 2] }, 2: { stress: 8, security: 4, wings: [1, 3] },
  3: { stress: 9, security: 6, wings: [2, 4] }, 4: { stress: 2, security: 1, wings: [3, 5] },
  5: { stress: 7, security: 8, wings: [4, 6] }, 6: { stress: 3, security: 9, wings: [5, 7] },
  7: { stress: 1, security: 5, wings: [6, 8] }, 8: { stress: 5, security: 2, wings: [7, 9] },
  9: { stress: 6, security: 3, wings: [8, 1] },
};
const INSTINCT_OF = { SP: 'sp', SO: 'so', SX: 'sx' };

// ── XML → tokens ──────────────────────────────────────────────────────────────
function unescapeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}
function tokenize(xml) {
  const chunks = xml.split(/(?=<w:p[ >])/);
  const toks = [];
  for (const c of chunks) {
    if (!/^<w:p[ >]/.test(c)) continue;
    const styleM = c.match(/<w:pStyle w:val="([^"]+)"/);
    const style = styleM ? styleM[1] : 'Normal';
    const text = unescapeXml([...c.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map(m => m[1]).join('')).trim();
    if (!text) continue;
    toks.push({ style, text, label: isLabel(text), bullet: style === 'ListParagraph' });
  }
  return toks;
}
function isLabel(t) {
  if (t.length > 60) return false;
  const letters = [...t].filter(ch => /[a-z]/i.test(ch));
  if (!letters.length) return false;
  return letters.filter(ch => ch === ch.toUpperCase()).length / letters.length > 0.85;
}
const stripWc = (s) => /^\[word count/i.test(s);

// ── Block model: a label + the non-label tokens until the next label ──────────
function toBlocks(toks) {
  const blocks = [];
  let cur = null;
  for (const t of toks) {
    if (t.label) { cur = { label: t.text, paras: [], bullets: [] }; blocks.push(cur); }
    else if (cur) { (t.bullet ? cur.bullets : cur.paras).push(t.text); }
  }
  return blocks;
}
const findBlock  = (blocks, label) => blocks.find(b => b.label === label);
const findByRe   = (blocks, re)    => blocks.filter(b => re.test(b.label));
const normParas  = (b) => (b ? b.paras.filter(p => !stripWc(p)) : []);

// ── Assemble one type ─────────────────────────────────────────────────────────
const errs = [];
function need(cond, msg) { if (!cond) errs.push(msg); }

function assembleType(n, blocks) {
  const name = TYPE_NAMES[n];
  const t = { number: n, name };

  // description
  const world = findBlock(blocks, 'HOW YOU SEE THE WORLD');
  const motiv = findBlock(blocks, 'CORE MOTIVATION');
  t.description = { worldview: (normParas(world)[0] || ''), core_motivation: (normParas(motiv)[0] || '') };

  // patterns + inquiry_lines
  t.patterns = {};
  for (const [key, lab] of [['thinking', 'PATTERN OF THINKING'], ['feeling', 'PATTERN OF FEELING'], ['behaving', 'PATTERN OF BEHAVING']]) {
    const b = findBlock(blocks, lab);
    const np = normParas(b);
    const inquiry = (np.find(p => /^Inquiry:/i.test(p)) || '').replace(/^Inquiry:\s*/i, '');
    const intro = np.find(p => !/^Inquiry:/i.test(p)) || '';
    t.patterns[key] = { intro, bullets: b ? b.bullets : [], inquiry };
  }
  t.inquiry_lines = ['thinking', 'feeling', 'behaving'].map(k => t.patterns[k].inquiry).filter(Boolean);

  // wings (order → wing_a, wing_b; target type parsed from label, validated vs engine)
  const wingBlocks = findByRe(blocks, /^TYPE \d WING/);
  t.wings = {};
  ['wing_a', 'wing_b'].forEach((slot, i) => {
    const b = wingBlocks[i];
    const tt = b && b.label.match(/^TYPE (\d) WING/);
    t.wings[slot] = { target_type: tt ? +tt[1] : null, body: normParas(b).join('\n\n') };
    // v3 client report additions (INTERIM, see top). Purely additive: target_type/body are
    // untouched, so splitWingBest() and the existing P5 renderer are unaffected.
    const v3 = INTERIM_WINGS_V3[n] && INTERIM_WINGS_V3[n].wings[t.wings[slot].target_type];
    if (v3) Object.assign(t.wings[slot], { overview: v3.overview, bullets: v3.bullets, resource: v3.resource });
  });
  if (INTERIM_WINGS_V3[n]) t.wings.intro_v3 = INTERIM_WINGS_V3[n].intro;

  // lines (order → stress, security; target parsed; resource_card from "Resource card:")
  const lineBlocks = findByRe(blocks, /^MOVING TOWARD TYPE/);
  t.lines = {};
  ['stress', 'security'].forEach((slot, i) => {
    const b = lineBlocks[i];
    const tt = b && b.label.match(/TYPE (\d)/);
    const np = normParas(b);
    const card = (np.find(p => /^Resource card:/i.test(p)) || '').replace(/^Resource card:\s*/i, '');
    const narrative = np.find(p => !/^Resource card:/i.test(p)) || '';
    t.lines[slot] = { target_type: tt ? +tt[1] : null, narrative, resource_card: card };
    // v3 client report additions (INTERIM, see top). bullets_v3 is purely additive; narrative
    // and resource_card are REPLACED — see the constant's header for why.
    const l3 = INTERIM_LINES_V3.types[n];
    if (l3) Object.assign(t.lines[slot], {
      narrative: l3[slot].narrative, resource_card: l3[slot].resource_card, bullets_v3: l3[slot].bullets,
    });
  });
  if (INTERIM_LINES_V3.types[n]) {
    t.lines.intro_v3 = INTERIM_LINES_V3.intro;
    t.lines.work_lead_v3 = INTERIM_LINES_V3.work_lead;
    t.lines.work_v3 = INTERIM_LINES_V3.types[n].work;
  }

  // v3 sheets 6 and 7, "Exploring Your Type Hypothesis". Types 1/4/7/9 are authored; the key is
  // ABSENT for every other type, which is what the renderer's pilot gate keys off. Absent, not
  // empty: an empty object would render a blank page, which is the failure mode this whole
  // sequence exists to prevent.
  if (INTERIM_EXPLORE_V3[n]) t.explore_v3 = INTERIM_EXPLORE_V3[n];

  // strengths / challenges → 3 {title, body} pairs each
  const pairs = (label) => {
    const np = normParas(findBlock(blocks, label));
    const out = [];
    for (let i = 0; i + 1 < np.length; i += 2) out.push({ title: np[i], body: np[i + 1] });
    return out;
  };
  t.strengths = pairs('STRENGTHS');
  t.challenges = pairs('CHALLENGES');

  // practices → {intro, bullets}
  const pr = findBlock(blocks, 'PRACTICES THAT HELP');
  t.practices = { intro: (normParas(pr)[0] || ''), bullets: pr ? pr.bullets : [] };

  // application: communication / conflict / center (subhead+framework live in the PRIOR block's paras)
  const subFw = (b) => { const np = normParas(b); return { subhead: np[0] || '', framework: np[1] || '' }; };
  const comm = findBlock(blocks, 'HOW YOU NATURALLY COMMUNICATE');
  const watch = findBlock(blocks, 'WHAT TO WATCH FOR');
  const conf = findBlock(blocks, 'HOW CONFLICT SHOWS UP FOR YOU');
  const work = findBlock(blocks, 'WORKING WITH IT');
  const cen  = findBlock(blocks, 'YOUR CENTER OF INTELLIGENCE');
  const off  = findBlock(blocks, "WHEN YOU'RE OFF-CENTER");
  t.communication = { ...subFw(findBlock(blocks, 'PUTTING IT ALL TOGETHER — APPLICATION')), bullets: comm ? comm.bullets : [], watch_for: watch ? watch.bullets : [] };
  t.conflict      = { ...subFw(watch), bullets: conf ? conf.bullets : [], working_with: work ? work.bullets : [] };
  t.center        = { ...subFw(work), bullets: cen ? cen.bullets : [], off_center: off ? off.bullets : [] };

  // comparison rows
  const cmp = findBlock(blocks, 'COMPARISON ROWS (PAGES 3 & COACH REPORT)');
  const rowMap = { 'core motivation': 'core_motivation', 'focus of attention': 'focus', 'energy goes to': 'energy', 'gifts': 'gifts', 'challenges': 'challenges' };
  t.comparison = {};
  for (const p of normParas(cmp)) {
    const m = p.match(/^([^:]+):\s*(.+)$/s);
    if (m && rowMap[m[1].trim().toLowerCase()]) t.comparison[rowMap[m[1].trim().toLowerCase()]] = m[2].trim();
  }
  return t;
}

// ── Assemble subtypes under an H2 region ──────────────────────────────────────
function assembleSubtypes(n, toks) {
  const out = {}; // 'sp8' -> {...}
  let cur = null, field = null, awaitTagline = false;
  const open = (code, name) => {
    const inst = INSTINCT_OF[code.slice(0, 2)];
    cur = { code, name, tagline: '', narrative: '', patterns: { thinking: [], feeling: [], behaving: [] }, shifts: [] };
    out[`${inst}${n}`] = cur; field = null; awaitTagline = true;
  };
  for (const t of toks) {
    const m = !t.bullet && t.text.match(/^(SP|SO|SX)(\d)\s*[—–-]\s*(.+)$/);
    if (m && +m[2] === n) { open(`${m[1]}${m[2]}`, m[3].trim()); continue; }
    if (!cur) continue;
    if (awaitTagline && !t.label && !t.bullet) { cur.tagline = t.text; awaitTagline = false; continue; }
    if (t.label) {
      if (t.text === 'SUBTYPE NARRATIVE') field = 'narrative';
      else if (/^PATTERN BULLETS — THINKING/.test(t.text)) field = 'p_thinking';
      else if (/^PATTERN BULLETS — FEELING/.test(t.text))  field = 'p_feeling';
      else if (/^PATTERN BULLETS — BEHAVING/.test(t.text)) field = 'p_behaving';
      else if (/^WHAT SHIFTS/.test(t.text)) field = 'shifts';
      else field = null;
      continue;
    }
    if (stripWc(t.text)) continue;
    if (field === 'narrative' && !t.bullet) cur.narrative = cur.narrative ? cur.narrative + '\n\n' + t.text : t.text;
    else if (field === 'p_thinking' && t.bullet) cur.patterns.thinking.push(t.text);
    else if (field === 'p_feeling'  && t.bullet) cur.patterns.feeling.push(t.text);
    else if (field === 'p_behaving' && t.bullet) cur.patterns.behaving.push(t.text);
    else if (field === 'shifts'     && t.bullet) cur.shifts.push(t.text);
  }
  return out;
}

// ── Parse the GLOBAL STATIC CONTENT section → static.* (Phase 6 prerequisite) ──
function parseStatics(toks) {
  const blocks = toBlocks(toks);
  const linesOf = (label) => normParas(findBlock(blocks, label));
  const text = (label) => linesOf(label).join('\n\n');
  const pipeRows = (label, keys) => linesOf(label).map(line => {
    const parts = line.split('|').map(s => s.trim());
    const o = {}; keys.forEach((k, i) => { o[k] = parts[i] || ''; }); return o;
  });
  const primer = {
    intro: text('ENNEAGRAM PRIMER INTRO'),
    scan_line: linesOf('ENNEAGRAM PRIMER SCAN LINE')[0] || '',
    scan_heading: linesOf('ENNEAGRAM PRIMER SCAN HEADING')[0] || '',
    // ORPHANED at PR 2: the v3 "What Is the Enneagram?" page has no pillars band. Kept
    // (and still gated at 3) so removal is a deliberate decision rather than a side effect.
    pillars: pipeRows('ENNEAGRAM PRIMER PILLARS', ['title', 'body']),
    nine_types: pipeRows('ENNEAGRAM PRIMER NINE TYPES', ['number', 'center', 'name', 'description', 'gifts'])
      .map(r => ({ ...r, number: +r.number })),
    footer: linesOf('ENNEAGRAM PRIMER FOOTER')[0] || '',
  };
  return {
    welcome: INTERIM_WELCOME,   // INTERIM (see top): structured welcome
    primer,
    wings_primer: text('WINGS PRIMER'),
    lines_primer: text('LINES PRIMER'),
    wings_using: INTERIM_WINGS_USING,   // INTERIM (see top): restores a key a hand-edit added
    instinct_primer: text('INSTINCT PRIMER'),
    instinct_definitions: pipeRows('INSTINCT DEFINITIONS', ['code', 'name', 'body']),
    contents: INTERIM_CONTENTS,         // INTERIM (see top): v3 Contents page, 9 entries
    thoughts: INTERIM_THOUGHTS,         // INTERIM (see top): v3 Your Thoughts page
  };
}

// ── Drift detection ───────────────────────────────────────────────────────────
// Flattens both trees to leaf paths and reports what a write would do to content that
// already exists. Additions are safe; changes and removals are what we guard against.
// _meta is excluded — it describes the build, not the content.
function flattenLeaves(o, prefix = '', out = {}) {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) flattenLeaves(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(o)) {
    o.forEach((v, i) => flattenLeaves(v, `${prefix}[${i}]`, out));
  } else {
    out[prefix] = o;
  }
  return out;
}
function diffAgainstExisting(outPath, nextLib) {
  if (!fs.existsSync(outPath)) return null;
  let prev;
  try { prev = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch { return null; }
  const skip = (k) => k.startsWith('_meta');
  const a = flattenLeaves(prev), b = flattenLeaves(nextLib);
  const removed = Object.keys(a).filter(k => !skip(k) && !(k in b));
  const changed = Object.keys(a).filter(k => !skip(k) && k in b && a[k] !== b[k]);
  const added   = Object.keys(b).filter(k => !skip(k) && !(k in a));
  return (removed.length || changed.length) ? { removed, changed, added } : null;
}

// ── Validation (hard gate for type/subtype AND the static globals) ────────────
function validateType(n, t) {
  const P = `type_${n}`;
  need(t.name === TYPE_NAMES[n], `${P}: name "${t.name}" != engine "${TYPE_NAMES[n]}"`);
  need(t.description.worldview, `${P}.description.worldview empty`);
  need(t.description.core_motivation, `${P}.description.core_motivation empty`);
  for (const k of ['thinking', 'feeling', 'behaving']) {
    need(t.patterns[k].intro, `${P}.patterns.${k}.intro empty`);
    need(t.patterns[k].bullets.length >= 1, `${P}.patterns.${k}.bullets empty`);
    need(t.patterns[k].inquiry, `${P}.patterns.${k}.inquiry empty`);
  }
  need(t.inquiry_lines.length === 3, `${P}.inquiry_lines = ${t.inquiry_lines.length} (want 3)`);
  const wt = [t.wings.wing_a.target_type, t.wings.wing_b.target_type].sort();
  need(JSON.stringify(wt) === JSON.stringify([...TYPE_META[n].wings].sort()), `${P}.wings targets ${wt} != engine ${TYPE_META[n].wings}`);
  need(t.wings.wing_a.body && t.wings.wing_b.body, `${P}.wings body empty`);
  // v3 "Your Wings" page fields — UNCONDITIONAL as of the PR 3 audit.
  //
  // This was `if (INTERIM_WINGS_V3[n])`, i.e. enforced only for types that already had
  // content, on the reasoning that unauthored types would "fail loudly at their own PR".
  // They did not. Measured: rendering buildClientReportHTML_v3 for types 1-8 produces a
  // Wings page with two empty overviews, two empty resource bands, no bullets and no intro
  // — 560px of content against a 976px budget — and every gate stays green, because
  // report_prep's mk() defaults each missing field to '' / [] and 416px of headroom is
  // MORE comfortable than Type 9's 37.25px. A conditional gate cannot see missing content;
  // it can only see content that is present and wrong.
  //
  // Unconditional means the build now fails for the eight unauthored types. That is the
  // intended signal and it is what PR 3 closes, type by type. It is deliberately NOT put
  // behind a flag: PR 1.5 retired --accept-drift precisely because a flag used routinely
  // stops being a guard.
  need(t.wings.intro_v3, `${P}.wings.intro_v3 empty (v3 page intro)`);
  for (const slot of ['wing_a', 'wing_b']) {
    const w = t.wings[slot];
    need(w.overview, `${P}.wings.${slot}.overview empty (v3)`);
    need(Array.isArray(w.bullets) && w.bullets.length === 5 && w.bullets.every(Boolean),
      `${P}.wings.${slot}.bullets must be exactly 5 non-empty (v3), got ${w.bullets ? w.bullets.length : 'none'}`);
    need(w.resource, `${P}.wings.${slot}.resource empty (v3 "As a Resource" band)`);
  }
  need(t.lines.stress.target_type === TYPE_META[n].stress, `${P}.lines.stress target ${t.lines.stress.target_type} != engine ${TYPE_META[n].stress}`);
  need(t.lines.security.target_type === TYPE_META[n].security, `${P}.lines.security target ${t.lines.security.target_type} != engine ${TYPE_META[n].security}`);
  for (const s of ['stress', 'security']) { need(t.lines[s].narrative, `${P}.lines.${s}.narrative empty`); need(t.lines[s].resource_card, `${P}.lines.${s}.resource_card empty`); }
  validateLines(n, t);
  validateExplore(n, t);
  need(t.strengths.length === 3, `${P}.strengths = ${t.strengths.length} (want 3)`);
  need(t.challenges.length === 3, `${P}.challenges = ${t.challenges.length} (want 3)`);
  need(t.practices.bullets.length >= 1, `${P}.practices.bullets empty`);
  for (const [k, sub] of [['communication', 'watch_for'], ['conflict', 'working_with'], ['center', 'off_center']]) {
    need(t[k].subhead, `${P}.${k}.subhead empty`);
    need(t[k].framework, `${P}.${k}.framework empty`);
    need(t[k].bullets.length >= 1, `${P}.${k}.bullets empty`);
    need(t[k][sub].length >= 1, `${P}.${k}.${sub} empty`);
  }
  for (const r of ['core_motivation', 'focus', 'energy', 'gifts', 'challenges']) need(t.comparison[r], `${P}.comparison.${r} empty`);
}
/**
 * v3 "Your Stress and Security Points" page fields (sheet 9).
 *
 * UNCONDITIONAL, all nine types. Not `if (INTERIM_LINES_V3.types[n])`, and the reason is on
 * the record rather than a matter of taste: the v3 Wings gate was written conditionally on
 * exactly that reasoning — unauthored types would "fail loudly at their own PR" — and they
 * did not. report_prep's mk() defaults every missing v3 field to '' / [], so types 1-8
 * rendered a Wings page with empty overviews, no bullets and empty resource bands, with
 * every gate green, because a blank page satisfies the single-sheet contract more
 * comfortably than a full one does. A conditional gate cannot see missing content; it can
 * only see content that is present and wrong.
 *
 * p9 ships with content for all nine types in the same commit, so unconditional costs
 * nothing today. It is what stops the page silently emptying later — a botched edit to
 * INTERIM_LINES_V3, or a tenth type — rather than a signal that content is outstanding.
 *
 * Cardinality is asserted, not just presence. Three stress bullets, three security bullets
 * and three "Putting Your Resources to Work" bodies are what the layout is drawn for: the
 * work row is a three-column flex and a fourth entry would silently squeeze it, while the
 * renderer pairs work[i] with a fixed WORK_LABELS[i], so a short array renders a labelled
 * empty cell rather than failing.
 */
/**
 * v3 sheets 6 and 7. PILOT SCOPE: types 1, 4, 7 and 9 carry content; 2, 3, 5, 6 and 8 carry
 * NONE.
 *
 * Both halves are asserted, and the second is the one that matters. A type with a PARTIAL
 * explore_v3 — some zones filled, some missing — would render a page with visible gaps and
 * every gate green, which is exactly the defect the unconditional Wings gate was introduced
 * to stop. So an unauthored type must have the key ABSENT entirely, not empty and not
 * half-filled, and this asserts that rather than trusting it.
 *
 * As each further type is authored, EXPLORE_PILOT_TYPES moves and this keeps working
 * unchanged.
 */
function validateExplore(n, t) {
  const P = `type_${n}`;
  const e = t.explore_v3;

  if (!EXPLORE_PILOT_TYPES.includes(n)) {
    need(e === undefined,
      `${P}.explore_v3 present but type ${n} is not in EXPLORE_PILOT_TYPES [${EXPLORE_PILOT_TYPES}] — `
      + 'a type either has all of sheets 6-7 or none of it');
    return;
  }
  if (!e) { need(false, `${P}.explore_v3 missing (type ${n} is a pilot type)`); return; }

  const arr = (v, k, len) => need(Array.isArray(v) && v.length === len && v.every(Boolean),
    `${P}.explore_v3.${k} must be exactly ${len} non-empty, got ${Array.isArray(v) ? v.length : 'none'}`);

  need(e.p6, `${P}.explore_v3.p6 missing`);
  if (e.p6) {
    need(e.p6.core_motivation, `${P}.explore_v3.p6.core_motivation empty`);
    need(e.p6.worldview, `${P}.explore_v3.p6.worldview empty`);
    need(e.p6.core_belief, `${P}.explore_v3.p6.core_belief empty`);
    arr(e.p6.glance, 'p6.glance', 4);
    arr(e.p6.patterns, 'p6.patterns', 3);
  }

  need(e.p7, `${P}.explore_v3.p7 missing`);
  if (e.p7) {
    for (const k of ['best', 'edge']) {
      need(Array.isArray(e.p7[k]) && e.p7[k].length === 3 && e.p7[k].every(x => x && x.title && x.body),
        `${P}.explore_v3.p7.${k} must be exactly 3 items with title+body, got ${Array.isArray(e.p7[k]) ? e.p7[k].length : 'none'}`);
    }
    need(Array.isArray(e.p7.styles) && e.p7.styles.length === 3,
      `${P}.explore_v3.p7.styles must be exactly 3 (communication, conflict, decision-making), got ${Array.isArray(e.p7.styles) ? e.p7.styles.length : 'none'}`);
    (e.p7.styles || []).forEach((st, i) => {
      need(st && st.name, `${P}.explore_v3.p7.styles[${i}].name empty`);
      arr(st && st.bullets, `p7.styles[${i}].bullets`, 3);
    });
    arr(e.p7.signs, 'p7.signs', 3);
    arr(e.p7.interrupt, 'p7.interrupt', 3);
  }
}

function validateLines(n, t) {
  const P = `type_${n}`;
  const L = t.lines;
  need(L.intro_v3, `${P}.lines.intro_v3 empty (v3 page intro)`);
  need(L.work_lead_v3, `${P}.lines.work_lead_v3 empty (v3 "Putting Your Resources to Work" lead)`);
  need(Array.isArray(L.work_v3) && L.work_v3.length === 3 && L.work_v3.every(Boolean),
    `${P}.lines.work_v3 must be exactly 3 non-empty (v3), got ${Array.isArray(L.work_v3) ? L.work_v3.length : 'none'}`);
  for (const slot of ['stress', 'security']) {
    const s = L[slot];
    // narrative and resource_card are asserted non-empty above for every type, docx-parsed
    // or not. What is new here is that INTERIM_LINES_V3 must actually have supplied them —
    // a type missing from the constant would otherwise pass on the docx values, which are
    // the 284-351ch originals this page cannot fit.
    need(INTERIM_LINES_V3.types[n] && s.narrative === INTERIM_LINES_V3.types[n][slot].narrative,
      `${P}.lines.${slot}.narrative is not the v3 rewrite (INTERIM_LINES_V3 missing or not applied)`);
    need(INTERIM_LINES_V3.types[n] && s.resource_card === INTERIM_LINES_V3.types[n][slot].resource_card,
      `${P}.lines.${slot}.resource_card is not the v3 rewrite (INTERIM_LINES_V3 missing or not applied)`);
    need(Array.isArray(s.bullets_v3) && s.bullets_v3.length === 3 && s.bullets_v3.every(Boolean),
      `${P}.lines.${slot}.bullets_v3 must be exactly 3 non-empty (v3), got ${Array.isArray(s.bullets_v3) ? s.bullets_v3.length : 'none'}`);
  }
}

function validateSubtype(key, st) {
  const P = `subtype_${key}`;
  need(st.name, `${P}.name empty`); need(st.tagline, `${P}.tagline empty`); need(st.narrative, `${P}.narrative empty`);
  for (const k of ['thinking', 'feeling', 'behaving']) need(st.patterns[k].length >= 1, `${P}.patterns.${k} empty`);
  need(st.shifts.length >= 1, `${P}.shifts empty`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const buf = fs.readFileSync(DOCX);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml').async('string');
  const toks = tokenize(xml);

  // Split into type regions by H1; within each, the H2 begins the subtype region.
  const h1idx = toks.map((t, i) => ({ t, i })).filter(x => x.t.style === 'Heading1');
  // _meta identifies the SOURCE, not the moment of the build. A wall-clock `built_at`
  // made the output differ on every run, so the artifact churned on every rebuild and a
  // byte-level idempotence check was impossible. A digest of the docx is deterministic on
  // any machine and answers the more useful question: which source produced this file.
  const sourceSha = crypto.createHash('sha256').update(fs.readFileSync(DOCX)).digest('hex');
  const lib = { _meta: { source: path.basename(DOCX), source_sha256: sourceSha, version: 'v1_060526' }, static: {
    primer: null, welcome: null, instinct_primer: null, instinct_definitions: null, wings_primer: null, lines_primer: null,
    contents: null, thoughts: null,
  } };
  const seenTypes = [];

  for (let k = 0; k < h1idx.length; k++) {
    const start = h1idx[k].i;
    const end = k + 1 < h1idx.length ? h1idx[k + 1].i : toks.length;
    if (toks[start].text === 'GLOBAL STATIC CONTENT') {
      lib.static = parseStatics(toks.slice(start + 1, end));
      continue;
    }
    const m = toks[start].text.match(/^Type (\d)\s*[—–-]\s*(.+)$/);
    if (!m) { errs.push(`Unparseable H1: "${toks[start].text}"`); continue; }
    const n = +m[1];
    seenTypes.push(n);
    const region = toks.slice(start + 1, end);
    const h2 = region.findIndex(t => t.style === 'Heading2');
    const typeToks = h2 >= 0 ? region.slice(0, h2) : region;
    const subToks  = h2 >= 0 ? region.slice(h2 + 1) : [];

    const t = assembleType(n, toBlocks(typeToks));
    const firstPara = typeToks.find(x => !x.label && !x.bullet);
    t.center_label = firstPara ? firstPara.text : '';  // e.g. "Body/Gut Center" — NOT the center-of-intelligence block
    lib[`type_${n}`] = t;

    const subs = assembleSubtypes(n, subToks);
    for (const [key, st] of Object.entries(subs)) lib[`subtype_${key}`] = st;
  }

  // Coverage validation
  for (let n = 1; n <= 9; n++) {
    if (!lib[`type_${n}`]) { errs.push(`type_${n} MISSING`); continue; }
    validateType(n, lib[`type_${n}`]);
  }
  let subCount = 0;
  for (let n = 1; n <= 9; n++) for (const inst of ['sp', 'so', 'sx']) {
    const key = `${inst}${n}`;
    if (!lib[`subtype_${key}`]) { errs.push(`subtype_${key} MISSING`); continue; }
    subCount++; validateSubtype(key, lib[`subtype_${key}`]);
  }

  // static.* coverage — now sourced from the docx GLOBAL STATIC CONTENT section (hard gate)
  const S = lib.static || {};
  for (const k of ['wings_primer', 'lines_primer', 'wings_using', 'instinct_primer']) need(S[k], `static.${k} empty`);
  need(S.welcome && S.welcome.subhead && Array.isArray(S.welcome.letters) && S.welcome.letters.length === 5 && S.welcome.letters.every(Boolean) && S.welcome.signoff && S.welcome.callout,
    'static.welcome shape invalid (want { subhead, letters[5], signoff, callout })');
  need(S.primer && S.primer.intro, 'static.primer.intro empty');
  need(S.primer && S.primer.scan_heading, 'static.primer.scan_heading empty');
  need(S.primer && Array.isArray(S.primer.pillars) && S.primer.pillars.length === 3, `static.primer.pillars != 3 (${S.primer && S.primer.pillars && S.primer.pillars.length})`);
  need(S.primer && Array.isArray(S.primer.nine_types) && S.primer.nine_types.length === 9, `static.primer.nine_types != 9 (${S.primer && S.primer.nine_types && S.primer.nine_types.length})`);
  need(S.primer && S.primer.nine_types && S.primer.nine_types.every(t => t.number >= 1 && t.number <= 9 && t.name && t.description && t.gifts), 'static.primer.nine_types rows incomplete');
  need(Array.isArray(S.instinct_definitions) && S.instinct_definitions.length === 3, `static.instinct_definitions != 3 (${S.instinct_definitions && S.instinct_definitions.length})`);

  // v3 Contents (sheet 2) — nine entries, each naming the first sheet of its span. The
  // `start` keys are checked against V3_PAGE_ORDER by tests/report_pages_test.js; here we
  // only assert shape, so a missing entry fails the build rather than rendering a short TOC.
  need(Array.isArray(S.contents) && S.contents.length === 9, `static.contents != 9 (${S.contents && S.contents.length})`);
  need(Array.isArray(S.contents) && S.contents.every(e => e.start && e.desc), 'static.contents rows incomplete (want { start, desc })');
  // v3 Your Thoughts (sheet 12) — intro plus exactly five reflection prompts.
  need(S.thoughts && S.thoughts.intro, 'static.thoughts.intro empty');
  need(S.thoughts && Array.isArray(S.thoughts.prompts) && S.thoughts.prompts.length === 5 && S.thoughts.prompts.every(Boolean),
    `static.thoughts.prompts != 5 (${S.thoughts && S.thoughts.prompts && S.thoughts.prompts.length})`);

  // Report
  console.log('=== Content library build ===');
  console.log(`Types parsed:    ${seenTypes.sort((a, b) => a - b).join(', ')} (${seenTypes.length}/9)`);
  console.log(`Subtypes parsed: ${subCount}/27`);
  const staticKeys = ['welcome', 'primer', 'wings_primer', 'lines_primer', 'wings_using', 'instinct_primer', 'instinct_definitions', 'contents', 'thoughts'];
  const pending = staticKeys.filter(k => lib.static[k] == null);
  console.log(`Static globals:  ${staticKeys.length - pending.length}/${staticKeys.length} populated` + (pending.length ? ` — PENDING: ${pending.join(', ')}` : ' (zero PENDING)'));

  if (errs.length) {
    console.error(`\n*** COVERAGE FAILURES (${errs.length}):`);
    errs.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
  // Reconciliation (PR 1.5) made the docx canonical again, so this script is a plain
  // deterministic producer once more: it builds and it writes. The build-time drift guard
  // that lived here was scaffolding for exactly that operation — it blocked a 130-field
  // revert, and "the guard stops objecting" was the signal the patch was complete.
  //
  // It is not kept, for two reasons. After reconciliation a legitimate Word edit is
  // indistinguishable to it from the corruption it existed to prevent, so --accept-drift
  // would have become the normal authoring path — and a flag used routinely is not a guard.
  // And it could not see the case that matters most: a docx edited but never rebuilt.
  //
  // The invariant is enforced instead by scripts/verify_content_library.js in CI, which
  // asserts that the committed JSON equals a fresh build. That catches a direct JSON edit
  // in the PR that makes it rather than at whoever's next rebuild, does not false-positive
  // on legitimate docx or script changes, and does catch the never-rebuilt case.
  const summary = diffAgainstExisting(OUT, lib);
  if (summary) {
    console.log(`\n  note: ${summary.changed.length} changed, ${summary.removed.length} removed, `
      + `${summary.added.length} added vs the committed library.`);
    console.log('  If you did not intend that, check whether app/content/content_library.json');
    console.log('  was edited directly — the Word source is canonical.');
  }

  fs.writeFileSync(OUT, JSON.stringify(lib, null, 2) + '\n');
  console.log(`\nHARD GATE GREEN — wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
})().catch(e => { console.error('BUILD FAILED:', e.stack || e.message); process.exit(1); });
