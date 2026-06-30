// app/public/stage1_data.js
//
// Canonical single source of truth for the 45 type + 15 instinct Stage 1 statement
// IDs and full statement text. Extracted verbatim from app/public/assessment.js so
// the SPA, the server report builder (generate_report.js), and the EM label map
// (stage1_labels.js) all read identical text from one place — no more triplicated copies.
//
// Dual-mode by design: this file is served to the browser as a plain <script> (it
// declares STAGE1_TYPE_STATEMENTS / STAGE1_INSTINCT_STATEMENTS as ordered globals,
// loaded before assessment.js, matching the existing state.js/ui.js pattern) AND is
// require()-able from Node via the module.exports tail at the bottom.
//
// Shape is keyed by type number / instinct code -> arrays of { id, dimension, text },
// identical to the structure that previously lived inline in assessment.js. Consumers
// that need extra metadata (typeName, Title-Case dimension labels, instinct subdomain)
// layer it locally and join this text by id — see stage1_labels.js.

const STAGE1_TYPE_STATEMENTS = {
  3: [
    { id: 'S3-1',  dimension: 'Core motivation',        text: 'I prioritize achieving my goals and being recognized for what I accomplish.' },
    { id: 'S3-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to what needs to be accomplished and how others perceive me.' },
    { id: 'S3-2b', dimension: 'Resulting preoccupation', text: 'I find myself so focused on what needs to get done that feelings — mine or others’ — go into the background.' },
    { id: 'S3-3',  dimension: 'Energy',                  text: 'My energy goes to staying productive, performing well, and projecting a capable, successful image.' },
    { id: 'S3-4',  dimension: 'Avoidance',               text: 'I tend to avoid failure, slowing down, or being seen as unsuccessful or incapable.' },
  ],
  6: [
    { id: 'S6-1',  dimension: 'Core motivation',        text: 'I prioritize feeling safe, secure, and prepared for whatever might happen.' },
    { id: 'S6-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to what could go wrong, what’s unsafe, and who I can trust.' },
    { id: 'S6-2b', dimension: 'Resulting preoccupation', text: 'I find myself questioning whether people and situations can really be trusted, and anticipating worst-case scenarios.' },
    { id: 'S6-3',  dimension: 'Energy',                  text: 'My energy goes to scanning for danger, contingency planning, and seeking reassurance.' },
    { id: 'S6-4',  dimension: 'Avoidance',               text: 'I tend to avoid uncertainty, unpredictability, and being caught unprepared.' },
  ],
  9: [
    { id: 'S9-1',  dimension: 'Core motivation',        text: 'I prioritize keeping the peace, seeking harmony, and maintaining a sense of belonging.' },
    { id: 'S9-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to potential conflict, other people’s agendas, and disturbances to my inner peace and immediate environment.' },
    { id: 'S9-2b', dimension: 'Resulting preoccupation', text: 'I find myself drifting toward whatever keeps things easy and comfortable, my own priorities quietly fading into the background.' },
    { id: 'S9-3',  dimension: 'Energy',                  text: 'My energy goes to accommodating others, being affable, and keeping myself occupied.' },
    { id: 'S9-4',  dimension: 'Avoidance',               text: 'I tend to avoid conflict, actively asserting my position, and disconnection from others.' },
  ],
  1: [
    { id: 'S1-1',  dimension: 'Core motivation',        text: 'I prioritize doing things right and being a good, responsible person.' },
    { id: 'S1-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to what’s wrong, imprecise, or not meeting the standard in situations, in others, and in myself.' },
    { id: 'S1-2b', dimension: 'Resulting preoccupation', text: 'I find myself monitoring, correcting, and comparing, driven by a relentless internal critic.' },
    { id: 'S1-3',  dimension: 'Energy',                  text: 'My energy goes to improving things, maintaining standards, and keeping myself and my work above reproach.' },
    { id: 'S1-4',  dimension: 'Avoidance',               text: 'I tend to avoid making mistakes, being wrong, and letting my own anger or impulses show.' },
  ],
  4: [
    { id: 'S4-1',  dimension: 'Core motivation',        text: 'I prioritize being authentic and true to myself, and feeling a deep connection to what’s real and meaningful.' },
    { id: 'S4-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to what is missing or unavailable to me, and my internal emotional landscape.' },
    { id: 'S4-2b', dimension: 'Resulting preoccupation', text: 'I find myself drawn toward what would make me feel unique or special and away from the ordinary or mundane.' },
    { id: 'S4-3',  dimension: 'Energy',                  text: 'My energy goes to processing my emotions, seeking depth, and being seen as unique and authentic.' },
    { id: 'S4-4',  dimension: 'Avoidance',               text: 'I tend to avoid being ordinary, feeling cut off from my feelings, and settling for the superficial.' },
  ],
  2: [
    { id: 'S2-1',  dimension: 'Core motivation',        text: 'I prioritize being deeply valued and appreciated for how I care for and support others.' },
    { id: 'S2-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to other people’s feelings and needs and the emotional temperature of our relationship.' },
    { id: 'S2-2b', dimension: 'Resulting preoccupation', text: 'I find myself anticipating what others need, often before they know, and making myself indispensable.' },
    { id: 'S2-3',  dimension: 'Energy',                  text: 'My energy goes to building connection, helping, and supporting others.' },
    { id: 'S2-4',  dimension: 'Avoidance',               text: 'I tend to avoid being seen as needy, naming what I need, and feeling rejected or unappreciated.' },
  ],
  8: [
    { id: 'S8-1',  dimension: 'Core motivation',        text: 'I prioritize being strong and in control so I can protect myself and the people I care about.' },
    { id: 'S8-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to power dynamics, what’s fair or unfair, and any move to control or take advantage of me or others I care about.' },
    { id: 'S8-2b', dimension: 'Resulting preoccupation', text: 'I find myself moving into action, confronting injustice or unfairness head-on, and keeping vulnerability at bay.' },
    { id: 'S8-3',  dimension: 'Energy',                  text: 'My energy goes to asserting my will, making important things happen, and taking charge when no one else steps up.' },
    { id: 'S8-4',  dimension: 'Avoidance',               text: 'I tend to avoid feeling vulnerable, being controlled, and being dependent on others.' },
  ],
  5: [
    { id: 'S5-1',  dimension: 'Core motivation',        text: 'I prioritize understanding the world and having enough knowledge and resources to be self-sufficient.' },
    { id: 'S5-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to ideas, concepts, and phenomena I want to understand, and to potential intrusions on my time, energy, or privacy.' },
    { id: 'S5-2b', dimension: 'Resulting preoccupation', text: 'I find myself retreating into my mind, observing from a distance and mentally cataloguing and compartmentalizing the world around me.' },
    { id: 'S5-3',  dimension: 'Energy',                  text: 'My energy goes to gathering knowledge, figuring things out, protecting my privacy, and conserving my resources.' },
    { id: 'S5-4',  dimension: 'Avoidance',               text: 'I tend to avoid emotional demands, intrusion on my space, and being caught without enough knowledge or resources.' },
  ],
  7: [
    { id: 'S7-1',  dimension: 'Core motivation',        text: 'I prioritize living a life that feels free, expansive, and full of possibility.' },
    { id: 'S7-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to what’s exciting or possible, and to anything that feels limiting, painful, or constraining.' },
    { id: 'S7-2b', dimension: 'Resulting preoccupation', text: 'I find myself planning for pleasurable possibilities, generating new options, and reframing whatever feels limiting or painful.' },
    { id: 'S7-3',  dimension: 'Energy',                  text: 'My energy goes to staying positive, planning for pleasurable possibilities, and keeping my options open.' },
    { id: 'S7-4',  dimension: 'Avoidance',               text: 'I tend to avoid situations that limit my options or require me to sit with pain, difficulty, or boredom.' },
  ],
};

const STAGE1_INSTINCT_STATEMENTS = {
  SP: [
    { id: 'I1-SP-1', dimension: 'Body & comfort',       text: 'I pay close attention to my physical comfort — things like temperature, hunger, rest, and how my body is feeling from moment to moment.' },
    { id: 'I1-SP-2', dimension: 'Enough / resources',   text: 'I keep track of whether I have enough of the practical, material things I need to feel secure and comfortable.' },
    { id: 'I1-SP-3', dimension: 'Security / nest', text: 'I find myself regularly checking that the practical foundations of my life — home, health, finances — are stable and in order.' },
    { id: 'I1-SP-4', dimension: 'Self-reliance',        text: 'I prefer to handle things myself rather than counting on others.' },
    { id: 'I1-SP-5', dimension: 'Energy direction',     text: 'I restore my energy by returning to my own familiar environment and meeting my basic needs for rest, nourishment, and self-care.' },
  ],
  SO: [
    { id: 'I1-SO-1', dimension: 'Place in the group',   text: 'I pay attention to my place in a group — whether I belong, what role I play, and my standing within it.' },
    { id: 'I1-SO-2', dimension: 'Trust / reciprocity',  text: 'I pay attention to whether people in a group are showing up, pulling their weight, and treating each other respectfully.' },
    { id: 'I1-SO-3', dimension: 'Social landscape',     text: 'I naturally read a room, quickly picking up on who has influence, how people relate to each other, and where I fit.' },
    { id: 'I1-SO-4', dimension: 'Larger belonging',     text: 'I’m pulled toward being part of something bigger than myself, whether that’s a cause, a community, or a shared mission.' },
    { id: 'I1-SO-5', dimension: 'Energy direction',     text: 'I invest my energy in the relationships, obligations, and communities that make up my social network.' },
  ],
  SX: [
    { id: 'I1-SX-1', dimension: 'Intensity', text: 'I’m drawn to experiences, conversations, and people that have real depth and intensity.' },
    { id: 'I1-SX-2', dimension: 'Attraction',     text: 'When something or someone captures my attention, the pull is immediate, strong, and hard to ignore.' },
    { id: 'I1-SX-3', dimension: 'Bonding',             text: 'I prefer direct, face-to-face connection where both of us feel fully met and fully seen.' },
    { id: 'I1-SX-4', dimension: 'Transmitting',            text: 'I bring a lot of energy and presence to the people and things I care about.' },
    { id: 'I1-SX-5', dimension: 'Vitality',           text: 'There’s a quality of aliveness I look for in relationships and experiences and I know immediately if it’s there or not.' },
  ],
};

// Dual-mode export: CommonJS for Node consumers (generate_report.js, stage1_labels.js);
// in the browser, module is undefined and the two consts above remain page globals.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAGE1_TYPE_STATEMENTS, STAGE1_INSTINCT_STATEMENTS };
}
