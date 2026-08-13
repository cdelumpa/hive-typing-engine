'use strict';
/**
 * p9 FIT SPIKE — candidate content for Types 1, 4 and 8, plus Type 9 from the mockup.
 *
 * SPIKE SCAFFOLDING, NOT THE SHIPPING PATH. The real home for this is an INTERIM_LINES_V3
 * constant in scripts/build_content_library.js, following INTERIM_WINGS_V3. It cannot live
 * there yet: the v3 Wings gate is unconditional as of this branch's first commit, so
 * build_content_library.js exits 1 for types 1-8 and never reaches its write. Putting the
 * content here lets the spike measure through the real renderer and the real stylesheet
 * without either relaxing that gate or inventing Wings copy to get past it.
 *
 * ⚠️ That is itself a finding: until Wings content lands for all nine types, NO other page's
 * content can be compiled into the library. See the spike report.
 *
 * Copy is Cai's, verbatim. Nothing here has been reshaped to fit — measuring unmodified copy
 * is the entire point of the exercise.
 */

// Types 1, 4, 8 — Cai, 13 August 2026.
const P9_SPIKE = {
  1: {
    stress: [
      'Your standards go unmet, your effort goes unnoticed, and something underneath starts to feel personal.',
      'The self-correction turns inward and sours into a heavier, far more private sense of being unseen.',
      'What gets lost is proportion: the flaw grows larger, the whole shrinks, and the mood carries the day.',
    ],
    security: [
      'The grip loosens: possibility returns, the day opens up, and good things start to feel allowed again.',
      'It comes within reach when the work is good enough and you deliberately let yourself stop checking.',
      'Rest stops needing to be earned, and pleasure stops arriving only after the whole list is finished.',
    ],
    work: [
      'The critique turns inward and heavy.',
      'Proportion goes; the flaw fills the frame.',
      'Name what is actually good enough.',
    ],
  },
  4: {
    stress: [
      'The connection you want is not arriving, so you start working harder to earn yourself a place in it.',
      'Your attention swings outward: you tend to their needs closely and stop naming any of your own at all.',
      "What gets lost is you: the very self you were protecting disappears entirely into someone else's needs.",
    ],
    security: [
      'Feeling settles into structure: you work steadily and the day holds its shape without much effort.',
      'It becomes reachable when the feeling is allowed to pass through and the next small task is begun.',
      'The work stops waiting on the mood, and something gets finished while the feeling is still moving.',
    ],
    work: [
      'You start tending everyone but yourself.',
      'Your own needs go unnamed and unmet.',
      'Say one thing you actually want.',
    ],
  },
  8: {
    stress: [
      'The situation stops yielding to force, and pushing harder is no longer changing anything at all.',
      'The forward motion goes quiet: you pull back, say less, and start handling it alone in your head.',
      'What gets lost is contact: the very people who would help are the ones being held furthest away.',
    ],
    security: [
      'The armor comes off: warmth shows without being asked for, and care arrives well before force does.',
      'It becomes reachable when trust is genuinely present and nothing has to be defended for a while.',
      'Strength stops needing to announce itself, and protecting someone starts to look like tenderness.',
    ],
    work: [
      'You go quiet and handle it alone.',
      'People stop being able to reach you.',
      'Let one person in before you fix it.',
    ],
  },
  // Type 9 — transcribed verbatim from docs/mockup/claude_The_Peacemaker_Page_Lines_v1.html.
  // Design spec v3.0 §7.2 records Type 9's p9 content as Claude-authored, NOT yet canon.
  9: {
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

// Page-level static prose. Two variants, because they differ and the difference is a finding.
const INTRO_MOCKUP = "The Enneagram system shows you where you tend to move when you're feeling secure and in flow, and where you tend to move under an unusual amount of stress. Both moves happen in the background, part of the same internal operating system as your Home Base type and your Wings. When you access these points intentionally they become valuable resources to expand your range of choices in any situation.";
const WORK_LEAD = 'These movements are easier to work with once you can see them happening. The skill is catching yourself in the moment, and it builds with practice.';

/**
 * Splice spike content into a deep copy of the content library.
 * `narrativeSource`: 'canon' (docx, what would ship) or 'mockup' (the reference page's own
 * shorter prose, which is NOT in the library).
 */
function spliceLines(library, { narrativeSource = 'canon', intro = INTRO_MOCKUP } = {}) {
  const lib = JSON.parse(JSON.stringify(library));
  const MOCKUP_NARRATIVE = {
    9: {
      stress: 'When pressure builds past what steady acceptance can absorb, Nines move toward Type 6. You may show either the strengths or the challenges of the Questioner, depending on the circumstances.',
      security: 'When Nines feel genuinely safe and supported, they move toward Type 3. Here too you may show either the strengths or the challenges of the Performer, depending on the circumstances.',
    },
  };
  const MOCKUP_BAND = {
    9: {
      stress: 'Useful vigilance, loyalty, and the commitment to face what matters rather than smooth it over.',
      security: 'Stepping into your own goals rather than deferring. Letting yourself want something and moving toward it.',
    },
  };
  for (const n of Object.keys(P9_SPIKE)) {
    const t = lib[`type_${n}`], c = P9_SPIKE[n];
    t.lines.intro_v3 = intro;
    t.lines.work_lead_v3 = WORK_LEAD;
    t.lines.work_v3 = c.work;
    t.lines.stress.bullets_v3 = c.stress;
    t.lines.security.bullets_v3 = c.security;
    if (narrativeSource === 'mockup' && MOCKUP_NARRATIVE[n]) {
      t.lines.stress.narrative = MOCKUP_NARRATIVE[n].stress;
      t.lines.security.narrative = MOCKUP_NARRATIVE[n].security;
      t.lines.stress.resource_card = MOCKUP_BAND[n].stress;
      t.lines.security.resource_card = MOCKUP_BAND[n].security;
    }
  }
  return lib;
}

module.exports = { P9_SPIKE, INTRO_MOCKUP, WORK_LEAD, spliceLines };
