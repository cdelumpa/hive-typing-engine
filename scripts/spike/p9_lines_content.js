'use strict';
/**
 * p9 FIT SPIKE — ROUND 2. Candidate content for Types 1, 4 and 8, plus Type 9 from the mockup.
 *
 * SPIKE SCAFFOLDING, NOT THE SHIPPING PATH. The real home is an INTERIM_LINES_V3 constant in
 * scripts/build_content_library.js, following INTERIM_WINGS_V3. It cannot live there yet: the
 * v3 Wings gate is unconditional as of this branch's first commit, so build_content_library.js
 * exits 1 for types 1-8 and never reaches its write. ⚠️ Until Wings content lands for all nine
 * types, no other page's content can be compiled into the library.
 *
 * ROUND 2 REPLACES THE CANON NARRATIVES AND BANDS. Ratified 13 Aug 2026: canon is source
 * material, not an immutable source of truth — new template, new layout, new context, and the
 * content is derived from canon then edited by Cai and Mo. Round 1 measured canon in place at
 * 284-351ch (6-7 rendered lines at 308px) against a design drawn for 189ch; all four measured
 * types spilled. These narratives target 3 lines and these bands 2.
 *
 * Copy is Cai's, verbatim. Nothing here has been reshaped to fit.
 */

const P9_SPIKE = {
  1: {
    stress_narrative: "Under pressure, Ones shift toward Four energy — more emotional, melancholic, focused on what's missing. The composed surface cracks and feeling floods in.",
    stress_band: 'Under pressure: melancholy, flooding. Consciously accessed: depth, honesty.',
    security_narrative: 'When Ones feel safe and resourced, they move toward Seven energy — more spontaneous, playful, open to possibility. The grip of the standard loosens.',
    security_band: 'In flow: spontaneity, play, pleasure. Available now: letting things be imperfect.',
    stress: [
      'Your standards go unmet, your effort goes unnoticed, and something underneath now feels personal.',
      'The self-correction turns inward and sours into a heavier, far more private sense of being unseen.',
      'Proportion goes: the flaw grows larger, the whole picture shrinks, and the mood carries the day.',
    ],
    security: [
      'The grip loosens: possibility returns, the day opens up, and good things feel allowed again.',
      'It comes within reach when the work is good enough and you deliberately let yourself stop checking.',
      'Rest stops needing to be earned, and pleasure stops arriving only after the list is finished.',
    ],
    work: [
      'The critique turns inward and heavy.',
      'Proportion goes; the flaw fills the frame.',
      'Name what is actually good enough.',
    ],
  },
  4: {
    stress_narrative: 'Under pressure, Fours shift toward Two energy — more focused on others, over-giving, seeking connection by being needed. The inward focus turns outward.',
    stress_band: 'Under pressure: over-giving, losing self. Consciously accessed: warmth, real care.',
    security_narrative: 'When Fours feel safe and supported, they move toward One energy — more disciplined, more structured, able to act on their ideals rather than only feel them.',
    security_band: 'In flow: discipline, structure, action. Available now: steady follow-through.',
    stress: [
      'The connection you want is not arriving, so you work harder to earn yourself a place in it.',
      'Attention swings outward: you tend to their needs closely and stop naming any of your own.',
      "What gets lost is you: the self you were protecting disappears into someone else's needs.",
    ],
    security: [
      'Feeling settles into structure: you work steadily and the day holds its shape without effort.',
      'It becomes reachable when the feeling is allowed to pass and the next small task is begun.',
      'The work stops waiting on the mood, and something gets finished while the feeling still moves.',
    ],
    work: [
      'You start tending everyone but yourself.',
      'Your needs go unnamed.',
      'Say one thing you actually want.',
    ],
  },
  8: {
    stress_narrative: 'Under pressure, Eights shift toward Five energy — more withdrawn, cerebral, detached. The forward-moving force goes quiet and retreats into the mind.',
    stress_band: 'Under pressure: withdrawal, detachment. Consciously accessed: strategy, patience.',
    security_narrative: 'When Eights feel safe and resourced, they move toward Two energy — warmer, more openly caring, more willing to tend to others without the armor on.',
    security_band: 'In flow: warmth, care, attunement. Available now: strength as generosity.',
    stress: [
      'The situation stops yielding to force, and pushing harder is no longer changing anything.',
      'The forward motion goes quiet: you pull back, say less, and handle it alone in your head.',
      'Contact goes first: the people who would help are the ones being held furthest away.',
    ],
    security: [
      'The armor comes off: warmth shows without being asked for, and care arrives before force.',
      'It becomes reachable when trust is genuinely present and nothing has to be defended.',
      'Strength stops needing to announce itself, and protecting someone looks like tenderness.',
    ],
    work: [
      'You go quiet and handle it alone.',
      'People stop being able to reach you.',
      'Let one person in before you fix it.',
    ],
  },
  // Type 9 — verbatim from docs/mockup/claude_The_Peacemaker_Page_Lines_v1.html, kept as the
  // round-1 control. Design spec v3.0 §7.2 records Type 9's p9 content as Claude-authored,
  // NOT canon. Its narratives/bands are the mockup's own, not the docx.
  9: {
    stress_narrative: 'When pressure builds past what steady acceptance can absorb, Nines move toward Type 6. You may show either the strengths or the challenges of the Questioner, depending on the circumstances.',
    stress_band: 'Useful vigilance, loyalty, and the commitment to face what matters rather than smooth it over.',
    security_narrative: 'When Nines feel genuinely safe and supported, they move toward Type 3. Here too you may show either the strengths or the challenges of the Performer, depending on the circumstances.',
    security_band: 'Stepping into your own goals rather than deferring. Letting yourself want something and moving toward it.',
    stress: [
      'The easy calm gives way to anxiety, doubt, and worst-case thinking.',
      'Noticed early, the movement signals that something important has been pushed down.',
      'The same line carries you toward Six when you are mobilizing for action, not only when strained.',
    ],
    security: [
      'The diffusion gives way to direction, focus, and energy.',
      'Priorities come into focus and get pursued, without waiting for someone else to set the agenda.',
      'The movement can also arrive paradoxically, when you are overwhelmed or exhausted rather than settled.',
    ],
    work: [
      'Notice the moment the easy calm turns to worry, or the diffusion turns to drive. Early is better than accurate.',
      'Ask what the people around you are experiencing while you are in that energy. The shift lands on them too.',
      'Seen clearly, the movement becomes something you use on purpose rather than something that happens to you.',
    ],
  },
};

const INTRO_MOCKUP = "The Enneagram system shows you where you tend to move when you're feeling secure and in flow, and where you tend to move under an unusual amount of stress. Both moves happen in the background, part of the same internal operating system as your Home Base type and your Wings. When you access these points intentionally they become valuable resources to expand your range of choices in any situation.";
const WORK_LEAD = 'These movements are easier to work with once you can see them happening. The skill is catching yourself in the moment, and it builds with practice.';

/**
 * Splice spike content into a deep copy of the content library.
 * `narrativeSource`: 'spike' (round-2 rewrites, the default and what would ship) or
 * 'canon' (the docx narratives left in place — the round-1 control).
 */
function spliceLines(library, { narrativeSource = 'spike', intro = INTRO_MOCKUP } = {}) {
  const lib = JSON.parse(JSON.stringify(library));
  for (const n of Object.keys(P9_SPIKE)) {
    const t = lib[`type_${n}`], c = P9_SPIKE[n];
    t.lines.intro_v3 = intro;
    t.lines.work_lead_v3 = WORK_LEAD;
    t.lines.work_v3 = c.work;
    t.lines.stress.bullets_v3 = c.stress;
    t.lines.security.bullets_v3 = c.security;
    if (narrativeSource === 'spike') {
      t.lines.stress.narrative = c.stress_narrative;
      t.lines.stress.resource_card = c.stress_band;
      t.lines.security.narrative = c.security_narrative;
      t.lines.security.resource_card = c.security_band;
    }
  }
  return lib;
}

module.exports = { P9_SPIKE, INTRO_MOCKUP, WORK_LEAD, spliceLines };
