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
  { id: "S1-2a", type: 1, typeName: "The Improver", dimension: "Focus of Attention", text: "My attention naturally goes to what's wrong, imprecise, or not meeting the standard in situations, in others, and in myself." },
  { id: "S1-2b", type: 1, typeName: "The Improver", dimension: "Resulting Preoccupation", text: "I find myself monitoring, correcting, and comparing, driven by a relentless internal critic." },
  { id: "S1-3", type: 1, typeName: "The Improver", dimension: "Energy", text: "I put a lot of energy into improving things, maintaining standards, and keeping myself and my work above reproach." },
  { id: "S1-4", type: 1, typeName: "The Improver", dimension: "Avoidance", text: "I tend to avoid making mistakes, being wrong, and letting my own anger or impulses show." },

  { id: "S2-1", type: 2, typeName: "The Giver", dimension: "Core Motivation", text: "I prioritize being needed and appreciated for how I care for and support others." },
  { id: "S2-2a", type: 2, typeName: "The Giver", dimension: "Focus of Attention", text: "My attention naturally goes to other people's feelings and needs, picking up on what they need usually before they even know." },
  { id: "S2-2b", type: 2, typeName: "The Giver", dimension: "Resulting Preoccupation", text: "I find myself setting aside what I need in order to focus on others, telling myself my needs can wait." },
  { id: "S2-3", type: 2, typeName: "The Giver", dimension: "Energy", text: "I put a lot of energy into helping, supporting, and tending to relationships and others' needs." },
  { id: "S2-4", type: 2, typeName: "The Giver", dimension: "Avoidance", text: "I tend to avoid acknowledging my own needs, asking for help, and feeling that I'm not needed or appreciated." },

  { id: "S3-1", type: 3, typeName: "The Performer", dimension: "Core Motivation", text: "I prioritize achieving my goals and being recognized for what I accomplish." },
  { id: "S3-2a", type: 3, typeName: "The Performer", dimension: "Focus of Attention", text: "My attention naturally goes to what needs to be accomplished and how I'm coming across." },
  { id: "S3-2b", type: 3, typeName: "The Performer", dimension: "Resulting Preoccupation", text: "I find myself adjusting how I present myself and tracking how I'm landing." },
  { id: "S3-3", type: 3, typeName: "The Performer", dimension: "Energy", text: "I put a lot of energy into staying productive, performing well, and projecting a capable, successful image." },
  { id: "S3-4", type: 3, typeName: "The Performer", dimension: "Avoidance", text: "I tend to avoid failing, slowing down, or being seen as unsuccessful or incapable." },

  { id: "S4-1", type: 4, typeName: "The Individualist", dimension: "Core Motivation", text: "I prioritize being authentic and true to myself, and feeling a deep connection to what's real and meaningful." },
  { id: "S4-2a", type: 4, typeName: "The Individualist", dimension: "Focus of Attention", text: "My attention naturally goes to what is missing or unavailable to me, and my internal emotional landscape." },
  { id: "S4-2b", type: 4, typeName: "The Individualist", dimension: "Resulting Preoccupation", text: "I find myself drawn toward what would make me feel unique or special and away from the ordinary or mundane." },
  { id: "S4-3", type: 4, typeName: "The Individualist", dimension: "Energy", text: "I put a lot of energy into processing my emotions, seeking depth, and being seen as unique and authentic." },
  { id: "S4-4", type: 4, typeName: "The Individualist", dimension: "Avoidance", text: "I tend to avoid being ordinary, feeling cut off from my feelings, and settling for the superficial." },

  { id: "S5-1", type: 5, typeName: "The Observer", dimension: "Core Motivation", text: "I prioritize understanding the world and having enough knowledge and resources to be self-sufficient." },
  { id: "S5-2a", type: 5, typeName: "The Observer", dimension: "Focus of Attention", text: "My attention naturally goes to demands on my time and energy, and to potential intrusions on my privacy." },
  { id: "S5-2b", type: 5, typeName: "The Observer", dimension: "Resulting Preoccupation", text: "I find myself building my knowledge, maintaining my boundaries, and conserving my energy and resources." },
  { id: "S5-3", type: 5, typeName: "The Observer", dimension: "Energy", text: "I put a lot of energy into gathering knowledge, figuring things out, and protecting my privacy and resources." },
  { id: "S5-4", type: 5, typeName: "The Observer", dimension: "Avoidance", text: "I tend to avoid emotional demands, intrusion on my space, and being caught without enough understanding or resources." },

  { id: "S6-1", type: 6, typeName: "The Questioner", dimension: "Core Motivation", text: "I prioritize feeling safe, secure, and prepared for whatever might happen." },
  { id: "S6-2a", type: 6, typeName: "The Questioner", dimension: "Focus of Attention", text: "My attention naturally goes to what could go wrong, potential danger, and whether people and situations can really be trusted." },
  { id: "S6-2b", type: 6, typeName: "The Questioner", dimension: "Resulting Preoccupation", text: "I find myself running through worst-case scenarios figuring out how to be prepared for what might happen." },
  { id: "S6-3", type: 6, typeName: "The Questioner", dimension: "Energy", text: "I put a lot of energy into questioning, seeking reassurance, and making sure I'm ready for what could go wrong." },
  { id: "S6-4", type: 6, typeName: "The Questioner", dimension: "Avoidance", text: "I tend to avoid uncertainty, blindly trusting others, and being caught unprepared." },

  { id: "S7-1", type: 7, typeName: "The Enthusiast", dimension: "Core Motivation", text: "I prioritize living a life free from pain and constraints." },
  { id: "S7-2a", type: 7, typeName: "The Enthusiast", dimension: "Focus of Attention", text: "My attention naturally goes to anything that could potentially limit my options or cause me pain and suffering." },
  { id: "S7-2b", type: 7, typeName: "The Enthusiast", dimension: "Resulting Preoccupation", text: "I find myself imagining enjoyable possibilities, generating new options, and reframing negatives into positives." },
  { id: "S7-3", type: 7, typeName: "The Enthusiast", dimension: "Energy", text: "I put a lot of energy into staying up and positive, planning for pleasurable possibilities, and keeping my options open." },
  { id: "S7-4", type: 7, typeName: "The Enthusiast", dimension: "Avoidance", text: "I tend to avoid people and situations that limit my options or require me to sit with pain or difficulty." },

  { id: "S8-1", type: 8, typeName: "The Protector", dimension: "Core Motivation", text: "I prioritize being strong and in control so I can protect myself and the people I care about." },
  { id: "S8-2a", type: 8, typeName: "The Protector", dimension: "Focus of Attention", text: "My attention naturally goes to power dynamics, fairness, and any move to control, take advantage, or show weakness." },
  { id: "S8-2b", type: 8, typeName: "The Protector", dimension: "Resulting Preoccupation", text: "I find myself moving toward action, confronting what's wrong head-on, and protecting against any sign of vulnerability." },
  { id: "S8-3", type: 8, typeName: "The Protector", dimension: "Energy", text: "My energy goes to taking action, asserting my will, and taking a stand against what's unjust or unfair." },
  { id: "S8-4", type: 8, typeName: "The Protector", dimension: "Avoidance", text: "I tend to avoid feeling vulnerable, being controlled, and being dependent on others." },

  { id: "S9-1", type: 9, typeName: "The Peacemaker", dimension: "Core Motivation", text: "I prioritize keeping the peace and maintaining harmony, inside myself and with others." },
  { id: "S9-2a", type: 9, typeName: "The Peacemaker", dimension: "Focus of Attention", text: "My attention naturally goes outward to other people's agendas, potential sources of conflict, and to what's right in front of me." },
  { id: "S9-2b", type: 9, typeName: "The Peacemaker", dimension: "Resulting Preoccupation", text: "I find myself going along with what others want, keeping things comfortable, and losing track of what matters most to me." },
  { id: "S9-3", type: 9, typeName: "The Peacemaker", dimension: "Energy", text: "I put a lot of energy into accommodating others, staying comfortable, and keeping the peace." },
  { id: "S9-4", type: 9, typeName: "The Peacemaker", dimension: "Avoidance", text: "I tend to avoid conflict, asserting my own position, and anything that disturbs my sense of peace." },
];

// 15 instinct statements, SP → SO → SX order.
const INSTINCT_STATEMENTS = [
  { id: "I1-SP-1", instinct: "SP", subdomain: "Body & comfort", text: "I pay close attention to my physical comfort — things like temperature, hunger, rest, and whether my body feels okay." },
  { id: "I1-SP-2", instinct: "SP", subdomain: "Enough / resources", text: "I keep track of whether I have enough resources (money, supplies, energy, time, etc) to ensure comfort and survival." },
  { id: "I1-SP-3", instinct: "SP", subdomain: "Security (protective)", text: "I keep the people and things I depend on safe." },
  { id: "I1-SP-4", instinct: "SP", subdomain: "Self-reliance", text: "I prefer to handle things myself rather than counting on others." },
  { id: "I1-SP-5", instinct: "SP", subdomain: "Energy direction", text: "I recharge by being on my own, in my own space, with no demands on me." },

  { id: "I1-SO-1", instinct: "SO", subdomain: "Place in the group", text: "I pay attention to where I stand in a group and how I'm coming across to the people in it." },
  { id: "I1-SO-2", instinct: "SO", subdomain: "Trust / reciprocity", text: "I pay attention to who in a group is reliable and can be counted on, and who can't." },
  { id: "I1-SO-3", instinct: "SO", subdomain: "Social landscape", text: "I notice the social landscape — who's connected to whom, who's in, who's on the outside." },
  { id: "I1-SO-4", instinct: "SO", subdomain: "Larger belonging", text: "I am pulled toward something larger than myself: a cause, a community, a group I want to be part of." },
  { id: "I1-SO-5", instinct: "SO", subdomain: "Energy direction", text: "I get my energy by being part of a community." },

  { id: "I1-SX-1", instinct: "SX", subdomain: "Magnetized attention", text: "My attention gets pulled strongly toward specific people or things, sometimes to the point of crowding out everything else." },
  { id: "I1-SX-2", instinct: "SX", subdomain: "Energy direction", text: "I find intense one-on-one conversations energizing." },
  { id: "I1-SX-3", instinct: "SX", subdomain: "Override", text: "When I'm captivated by someone or something, the pull can override my better judgment about what I should be doing." },
  { id: "I1-SX-4", instinct: "SX", subdomain: "Asserting", text: "When I want something, I go after it directly and don't hold back." },
  { id: "I1-SX-5", instinct: "SX", subdomain: "Impressing", text: "I want to have a real impact on the people and things that matter to me, even if I don't make it obvious." },
];

// Canonical Enneagram structural relationships (prompt spec §2.2 / design §5.3).
const TYPE_GEOMETRY = {
  1: { name: "The Improver", center: "Body", hornevian: "Dutiful", harmonic: "Competency", stress: 4, security: 7, wings: [9, 2] },
  2: { name: "The Giver", center: "Heart", hornevian: "Dutiful", harmonic: "Positive Outlook", stress: 8, security: 4, wings: [1, 3] },
  3: { name: "The Performer", center: "Heart", hornevian: "Withdrawn", harmonic: "Competency", stress: 9, security: 6, wings: [2, 4] },
  4: { name: "The Individualist", center: "Heart", hornevian: "Withdrawn", harmonic: "Reactive", stress: 2, security: 1, wings: [3, 5] },
  5: { name: "The Observer", center: "Head", hornevian: "Withdrawn", harmonic: "Competency", stress: 7, security: 8, wings: [4, 6] },
  6: { name: "The Questioner", center: "Head", hornevian: "Dutiful", harmonic: "Reactive", stress: 3, security: 9, wings: [5, 7] },
  7: { name: "The Enthusiast", center: "Head", hornevian: "Withdrawn", harmonic: "Positive Outlook", stress: 1, security: 5, wings: [6, 8] },
  8: { name: "The Protector", center: "Body", hornevian: "Withdrawn", harmonic: "Reactive", stress: 5, security: 2, wings: [7, 9] },
  9: { name: "The Peacemaker", center: "Body", hornevian: "Dutiful", harmonic: "Positive Outlook", stress: 6, security: 3, wings: [8, 1] },
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
