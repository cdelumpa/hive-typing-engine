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
    stress_narrative: "Under pressure, Ones shift toward Four energy — more emotional, melancholic, focused on what's missing. The composed surface cracks.",
    stress_band: 'Draw on it when you need emotional depth, honesty, and the courage to feel what is actually there.',
    security_narrative: 'When Ones feel safe and resourced, they move toward Seven energy — more spontaneous and playful. The standard stops running the day.',
    security_band: 'Draw on it when you need spontaneity, play, and permission for things to be imperfect.',
    stress: [
      'Your standards go unmet, your effort unnoticed, and something underneath now feels personal.',
      'The self-correction turns inward and sours into a heavier, far more private sense of being unseen.',
      'Proportion goes: the flaw grows larger, the whole picture shrinks, and the mood carries the day.',
    ],
    security: [
      'The grip loosens: possibility returns, the day opens up, and good things feel allowed again.',
      'It comes within reach when the work is good enough and you deliberately let yourself stop checking.',
      'Rest stops needing to be earned, and pleasure stops arriving only after the list is finished.',
    ],
    work: [
      'You notice the correcting turn inward, and the tone of it shifting from standards to something personal.',
      'One flaw has filled the frame, and everything else that is true about the work has dropped out of view.',
      'Say out loud what good enough actually looks like here, and then let the work be finished at that.',
    ],
  },
  4: {
    stress_narrative: 'Under pressure, Fours shift toward Two energy — more focused on others, over-giving, seeking connection by being needed. The self recedes.',
    stress_band: 'Draw on it when you need warmth, generosity, and real attention to what someone else needs.',
    security_narrative: 'When Fours feel safe and supported, they move toward One energy — more disciplined and structured. Ideals turn into action.',
    security_band: 'Draw on it when you need discipline, structure, and the follow-through to finish what you start.',
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
      "You notice yourself tending closely to everyone else's needs, and going quiet about anything of your own.",
      'You have gone missing from your own day, and nobody has noticed because you are being so useful.',
      'Say one thing you actually want, out loud, before you have worked out whether it will be welcome.',
    ],
  },
  8: {
    stress_narrative: 'Under pressure, Eights shift toward Five energy — more withdrawn, cerebral, detached. The forward force goes quiet and retreats inward.',
    stress_band: 'Draw on it when you need strategy, patience, and the ability to observe before acting.',
    security_narrative: 'When Eights feel safe and resourced, they move toward Two energy — warmer, more openly caring, more willing to tend to others.',
    security_band: 'Draw on it when you need warmth, attunement, and strength that expresses itself as care.',
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
      'You notice yourself going quiet, pulling back from the room, and working the whole problem alone.',
      'The people who could actually help are the ones you have put furthest outside it, and they can tell.',
      'Tell one person what is actually going on before you have fixed it, or decided that you have to.',
    ],
  },
  // Type 9 — REWRITTEN to the round-5 template, 13 Aug 2026. Supersedes the mockup
  // transcription that spec v3.0 section 7.2 records as Claude-authored and not canon.
  // Drafted narrative-first: the narratives were locked, then the bullets written against
  // them, which is what stops the closing-sentence/first-bullet collision by construction
  // rather than by iteration (rounds 3, 4 and 5 each closed one and opened another).
  9: {
    stress_narrative: 'Under pressure, Nines shift toward Six energy — more anxious, doubting, worst-case-focused. The easy calm gives way to worry.',
    stress_band: 'Draw on it when you need vigilance, preparation, and the will to face what you would avoid.',
    security_narrative: 'When Nines feel safe and supported, they move toward Three energy — more focused and energized. Priorities come into view.',
    security_band: 'Draw on it when you need focus, drive, and the push to act on your own goals rather than defer.',
    stress: [
      'Something that mattered got set aside to keep the peace, and it has not gone away.',
      'The scanning starts: every outcome gets checked, and none of them feels safe enough.',
      'The steadiness goes first: what usually holds you level is what starts to shake.',
    ],
    security: [
      'The fog clears: you know what you want and you move on it without stalling.',
      "It becomes reachable when your own agenda is allowed to matter as much as everyone else's.",
      'Wanting something stops feeling like a risk to the peace, and starts moving you.',
    ],
    work: [
      'You notice yourself going along with something, agreeing easily, while the thing you actually think stays unsaid.',
      'The peace you are keeping is costing you your own position, and the worry underneath it keeps growing.',
      'Name the one thing you want here, out loud, before the moment closes and going along becomes the answer.',
    ],
  },
};

const INTRO_MOCKUP = "The Enneagram system shows you where you tend to move when you're feeling secure and in flow, and where you tend to move under an unusual amount of stress. Both moves happen in the background, part of the same internal operating system as your Home Base type and your Wings. When you access these points intentionally they become valuable resources to expand your range of choices in any situation.";
const WORK_LEAD = 'Your Wings and your Stress and Security points give you more choices, and more range. The first step is catching yourself in the moment, pausing to notice, and then making a purposeful choice.';

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
