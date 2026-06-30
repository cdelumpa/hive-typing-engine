// app/stage1_labels.js
//
// Frozen server-side label map for Enhanced Mode (EM). Single source of truth for
// the 45 type + 15 instinct Stage 1 statements (IDs, dimension/sub-domain labels,
// full statement text) and the Enneagram type geometry table, consumed by the EM
// prompt builder (app/experimental_analysis.js, PR4).
//
// Statement text is VERBATIM from hive_insightout_em_prompt_spec_v1_0_061626.docx
// §4.2 (type) and §4.3 (instinct); geometry from §2.2 / design doc §5.3. The prompt
// spec is authoritative (D7) — this module is NOT generated at runtime from the
// browser bundle (app/public/assessment.js), and where the two differ the spec wins.
// Note: S7-2b and S9-3 use the assessment.js wording (Mo's edits) as the source of
// truth, not the prompt spec §4.2 text (spec to reconcile in v1.1).
'use strict';

// 45 type statements, numerical type order (Type 1 → Type 9), dimension order
// Core Motivation → Focus of Attention → Resulting Preoccupation → Energy → Avoidance.
const TYPE_STATEMENTS = [
  { id: "S1-1", type: 1, typeName: "The Improver", dimension: "Core Motivation", text: "I prioritize doing things right and being a good, responsible person." },
  { id: "S1-2a", type: 1, typeName: "The Improver", dimension: "Focus of Attention", text: "My attention naturally goes to what’s wrong, imprecise, or not meeting the standard in situations, in others, and in myself." },
  { id: "S1-2b", type: 1, typeName: "The Improver", dimension: "Resulting Preoccupation", text: "I find myself monitoring, correcting, and comparing, driven by a relentless internal critic." },
  { id: "S1-3", type: 1, typeName: "The Improver", dimension: "Energy", text: "My energy goes to improving things, maintaining standards, and keeping myself and my work above reproach." },
  { id: "S1-4", type: 1, typeName: "The Improver", dimension: "Avoidance", text: "I tend to avoid making mistakes, being wrong, and letting my own anger or impulses show." },

  { id: "S2-1", type: 2, typeName: "The Giver", dimension: "Core Motivation", text: "I prioritize being deeply valued and appreciated for how I care for and support others." },
  { id: "S2-2a", type: 2, typeName: "The Giver", dimension: "Focus of Attention", text: "My attention naturally goes to other people’s feelings and needs and the emotional temperature of our relationship." },
  { id: "S2-2b", type: 2, typeName: "The Giver", dimension: "Resulting Preoccupation", text: "I find myself anticipating what others need, often before they know, and making myself indispensable." },
  { id: "S2-3", type: 2, typeName: "The Giver", dimension: "Energy", text: "My energy goes to building connection, helping, and supporting others." },
  { id: "S2-4", type: 2, typeName: "The Giver", dimension: "Avoidance", text: "I tend to avoid being seen as needy, naming what I need, and feeling rejected or unappreciated." },

  { id: "S3-1", type: 3, typeName: "The Performer", dimension: "Core Motivation", text: "I prioritize achieving my goals and being recognized for what I accomplish." },
  { id: "S3-2a", type: 3, typeName: "The Performer", dimension: "Focus of Attention", text: "My attention naturally goes to what needs to be accomplished and how others perceive me." },
  { id: "S3-2b", type: 3, typeName: "The Performer", dimension: "Resulting Preoccupation", text: "I find myself so focused on what needs to get done that feelings — mine or others’ — go into the background." },
  { id: "S3-3", type: 3, typeName: "The Performer", dimension: "Energy", text: "My energy goes to staying productive, performing well, and projecting a capable, successful image." },
  { id: "S3-4", type: 3, typeName: "The Performer", dimension: "Avoidance", text: "I tend to avoid failure, slowing down, or being seen as unsuccessful or incapable." },

  { id: "S4-1", type: 4, typeName: "The Individualist", dimension: "Core Motivation", text: "I prioritize being authentic and true to myself, and feeling a deep connection to what’s real and meaningful." },
  { id: "S4-2a", type: 4, typeName: "The Individualist", dimension: "Focus of Attention", text: "My attention naturally goes to what is missing or unavailable to me, and my internal emotional landscape." },
  { id: "S4-2b", type: 4, typeName: "The Individualist", dimension: "Resulting Preoccupation", text: "I find myself drawn toward what would make me feel unique or special and away from the ordinary or mundane." },
  { id: "S4-3", type: 4, typeName: "The Individualist", dimension: "Energy", text: "My energy goes to processing my emotions, seeking depth, and being seen as unique and authentic." },
  { id: "S4-4", type: 4, typeName: "The Individualist", dimension: "Avoidance", text: "I tend to avoid being ordinary, feeling cut off from my feelings, and settling for the superficial." },

  { id: "S5-1", type: 5, typeName: "The Observer", dimension: "Core Motivation", text: "I prioritize understanding the world and having enough knowledge and resources to be self-sufficient." },
  { id: "S5-2a", type: 5, typeName: "The Observer", dimension: "Focus of Attention", text: "My attention naturally goes to ideas, concepts, and phenomena I want to understand, and to potential intrusions on my time, energy, or privacy." },
  { id: "S5-2b", type: 5, typeName: "The Observer", dimension: "Resulting Preoccupation", text: "I find myself retreating into my mind, observing from a distance and mentally cataloguing and compartmentalizing the world around me." },
  { id: "S5-3", type: 5, typeName: "The Observer", dimension: "Energy", text: "My energy goes to gathering knowledge, figuring things out, protecting my privacy, and conserving my resources." },
  { id: "S5-4", type: 5, typeName: "The Observer", dimension: "Avoidance", text: "I tend to avoid emotional demands, intrusion on my space, and being caught without enough knowledge or resources." },

  { id: "S6-1", type: 6, typeName: "The Questioner", dimension: "Core Motivation", text: "I prioritize feeling safe, secure, and prepared for whatever might happen." },
  { id: "S6-2a", type: 6, typeName: "The Questioner", dimension: "Focus of Attention", text: "My attention naturally goes to what could go wrong, what’s unsafe, and who I can trust." },
  { id: "S6-2b", type: 6, typeName: "The Questioner", dimension: "Resulting Preoccupation", text: "I find myself questioning whether people and situations can really be trusted, and anticipating worst-case scenarios." },
  { id: "S6-3", type: 6, typeName: "The Questioner", dimension: "Energy", text: "My energy goes to scanning for danger, contingency planning, and seeking reassurance." },
  { id: "S6-4", type: 6, typeName: "The Questioner", dimension: "Avoidance", text: "I tend to avoid uncertainty, unpredictability, and being caught unprepared." },

  { id: "S7-1", type: 7, typeName: "The Enthusiast", dimension: "Core Motivation", text: "I prioritize living a life that feels free, expansive, and full of possibility." },
  { id: "S7-2a", type: 7, typeName: "The Enthusiast", dimension: "Focus of Attention", text: "My attention naturally goes to what’s exciting or possible, and to anything that feels limiting, painful, or constraining." },
  { id: "S7-2b", type: 7, typeName: "The Enthusiast", dimension: "Resulting Preoccupation", text: "I find myself planning for pleasurable possibilities, generating new options, and reframing whatever feels limiting or painful." },
  { id: "S7-3", type: 7, typeName: "The Enthusiast", dimension: "Energy", text: "My energy goes to staying positive, planning for pleasurable possibilities, and keeping my options open." },
  { id: "S7-4", type: 7, typeName: "The Enthusiast", dimension: "Avoidance", text: "I tend to avoid situations that limit my options or require me to sit with pain, difficulty, or boredom." },

  { id: "S8-1", type: 8, typeName: "The Protector", dimension: "Core Motivation", text: "I prioritize being strong and in control so I can protect myself and the people I care about." },
  { id: "S8-2a", type: 8, typeName: "The Protector", dimension: "Focus of Attention", text: "My attention naturally goes to power dynamics, what’s fair or unfair, and any move to control or take advantage of me or others I care about." },
  { id: "S8-2b", type: 8, typeName: "The Protector", dimension: "Resulting Preoccupation", text: "I find myself moving into action, confronting injustice or unfairness head-on, and keeping vulnerability at bay." },
  { id: "S8-3", type: 8, typeName: "The Protector", dimension: "Energy", text: "My energy goes to asserting my will, making important things happen, and taking charge when no one else steps up." },
  { id: "S8-4", type: 8, typeName: "The Protector", dimension: "Avoidance", text: "I tend to avoid feeling vulnerable, being controlled, and being dependent on others." },

  { id: "S9-1", type: 9, typeName: "The Peacemaker", dimension: "Core Motivation", text: "I prioritize keeping the peace, seeking harmony, and maintaining a sense of belonging." },
  { id: "S9-2a", type: 9, typeName: "The Peacemaker", dimension: "Focus of Attention", text: "My attention naturally goes to potential conflict, other people’s agendas, and disturbances to my inner peace and immediate environment." },
  { id: "S9-2b", type: 9, typeName: "The Peacemaker", dimension: "Resulting Preoccupation", text: "I find myself drifting toward whatever keeps things easy and comfortable, my own priorities quietly fading into the background." },
  { id: "S9-3", type: 9, typeName: "The Peacemaker", dimension: "Energy", text: "My energy goes to accommodating others, being affable, and keeping myself occupied." },
  { id: "S9-4", type: 9, typeName: "The Peacemaker", dimension: "Avoidance", text: "I tend to avoid conflict, actively asserting my position, and disconnection from others." },
];

// 15 instinct statements, SP → SO → SX order.
const INSTINCT_STATEMENTS = [
  { id: "I1-SP-1", instinct: "SP", subdomain: "Body & comfort", text: "I pay close attention to my physical comfort — things like temperature, hunger, rest, and how my body is feeling from moment to moment." },
  { id: "I1-SP-2", instinct: "SP", subdomain: "Enough / resources", text: "I keep track of whether I have enough of the practical, material things I need to feel secure and comfortable." },
  { id: "I1-SP-3", instinct: "SP", subdomain: "Security / nest", text: "I find myself regularly checking that the practical foundations of my life — home, health, finances — are stable and in order." },
  { id: "I1-SP-4", instinct: "SP", subdomain: "Self-reliance", text: "I prefer to handle things myself rather than counting on others." },
  { id: "I1-SP-5", instinct: "SP", subdomain: "Energy direction", text: "I restore my energy by returning to my own familiar environment and meeting my basic needs for rest, nourishment, and self-care." },

  { id: "I1-SO-1", instinct: "SO", subdomain: "Place in the group", text: "I pay attention to my place in a group — whether I belong, what role I play, and my standing within it." },
  { id: "I1-SO-2", instinct: "SO", subdomain: "Trust / reciprocity", text: "I pay attention to whether people in a group are showing up, pulling their weight, and treating each other respectfully." },
  { id: "I1-SO-3", instinct: "SO", subdomain: "Social landscape", text: "I naturally read a room, quickly picking up on who has influence, how people relate to each other, and where I fit." },
  { id: "I1-SO-4", instinct: "SO", subdomain: "Larger belonging", text: "I’m pulled toward being part of something bigger than myself, whether that’s a cause, a community, or a shared mission." },
  { id: "I1-SO-5", instinct: "SO", subdomain: "Energy direction", text: "I invest my energy in the relationships, obligations, and communities that make up my social network." },

  { id: "I1-SX-1", instinct: "SX", subdomain: "Intensity", text: "I’m drawn to experiences, conversations, and people that have real depth and intensity." },
  { id: "I1-SX-2", instinct: "SX", subdomain: "Attraction", text: "When something or someone captures my attention, the pull is immediate, strong, and hard to ignore." },
  { id: "I1-SX-3", instinct: "SX", subdomain: "Bonding", text: "I prefer direct, face-to-face connection where both of us feel fully met and fully seen." },
  { id: "I1-SX-4", instinct: "SX", subdomain: "Transmitting", text: "I bring a lot of energy and presence to the people and things I care about." },
  { id: "I1-SX-5", instinct: "SX", subdomain: "Vitality", text: "There’s a quality of aliveness I look for in relationships and experiences and I know immediately if it’s there or not." },
];

// Canonical Enneagram structural relationships (prompt spec §2.2 / design §5.3).
const TYPE_GEOMETRY = {
  1: { name: "The Improver", center: "Body", hornevian: "Dutiful", harmonic: "Competency", stress: 4, security: 7, wings: [9, 2] },
  2: { name: "The Giver", center: "Heart", hornevian: "Dutiful", harmonic: "Positive Outlook", stress: 8, security: 4, wings: [1, 3] },
  3: { name: "The Performer", center: "Heart", hornevian: "Assertive", harmonic: "Competency", stress: 9, security: 6, wings: [2, 4] },
  4: { name: "The Individualist", center: "Heart", hornevian: "Withdrawn", harmonic: "Reactive", stress: 2, security: 1, wings: [3, 5] },
  5: { name: "The Observer", center: "Head", hornevian: "Withdrawn", harmonic: "Competency", stress: 7, security: 8, wings: [4, 6] },
  6: { name: "The Questioner", center: "Head", hornevian: "Dutiful", harmonic: "Reactive", stress: 3, security: 9, wings: [5, 7] },
  7: { name: "The Enthusiast", center: "Head", hornevian: "Assertive", harmonic: "Positive Outlook", stress: 1, security: 5, wings: [6, 8] },
  8: { name: "The Protector", center: "Body", hornevian: "Assertive", harmonic: "Reactive", stress: 5, security: 2, wings: [7, 9] },
  9: { name: "The Peacemaker", center: "Body", hornevian: "Withdrawn", harmonic: "Positive Outlook", stress: 6, security: 3, wings: [8, 1] },
};

module.exports = { TYPE_STATEMENTS, INSTINCT_STATEMENTS, TYPE_GEOMETRY };

// D8 parity guard — fires once on require() at server start. Does not throw or block.
const _typeCount = TYPE_STATEMENTS.length;
const _instinctCount = INSTINCT_STATEMENTS.length;
if (_typeCount !== 45 || _instinctCount !== 15) {
  console.warn(
    `[stage1_labels] WARNING: expected 45 type + 15 instinct ` +
    `statements, got ${_typeCount} + ${_instinctCount}. ` +
    `stage1_labels.js may be out of sync with the prompt spec.`
  );
}
