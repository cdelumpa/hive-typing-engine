/* ============================================================
   HIVE ENNEAGRAM TYPING ENGINE — Client Application
   ============================================================ */

// =================== QUESTION DATA ===================

const STAGE0_QUESTIONS = [
  {
    id: 'q1',
    title: 'SELF-DESCRIPTION',
    text: 'What are 3\u20135 words or phrases you would use to describe yourself?',
    showRef: false,
  },
  {
    id: 'q2',
    title: 'OTHERS\u2019 DESCRIPTION',
    text: 'What are 3\u20135 words or phrases others would use to describe you?',
    showRef: false,
  },
  {
    id: 'q3',
    title: 'STRENGTH',
    text: 'Which of the words or phrases you listed is your greatest strength?',
    showRef: true,
  },
  {
    id: 'q4',
    title: 'SHADOW',
    text: 'Which of the words or phrases you listed tends to be most problematic for you?',
    showRef: true,
  },
];

const STAGE1_QUESTIONS = [
  {
    id: 'q1',
    type: 'centers',
    title: 'DRIVING EMOTION',
    text: 'When something important to you goes wrong, what tends to happen inside you first?',
    options: {
      a: 'A pulse of anxiety and a scanning for what could go wrong \u2014 or something quieter, a pulling-back and a need for space to sort things through on my own before I can fully engage',
      b: 'An emotion lands \u2014 hurt, disappointment, or concern about what this means for the people who matter to me or for how I\u2019m showing up \u2014 though there\u2019s also a pull to keep going, as if the feeling will be there when I have time for it later',
      c: 'A kind of tightening or going-flat inside \u2014 for some it shows up as frustration and an impulse to take control; for others it\u2019s quieter, like whatever I\u2019d normally feel about it just dissolves before I can register it',
    },
    mapping: { a: 'head', b: 'heart', c: 'body' },
  },
  {
    id: 'q2',
    type: 'instinct',
    title: 'WHAT PREOCCUPIES YOU WHEN STRESSED',
    text: 'When life feels out of balance, what do you find yourself most preoccupied with?',
    options: {
      a: 'Whether my basic needs are covered \u2014 enough resources, stability, and self-care to feel okay',
      b: 'Whether my most important relationships feel alive, close, and genuinely connected',
      c: 'Whether I belong, whether I\u2019m fulfilling my role, and whether things are right with my community or group',
    },
    mapping: { a: 'sp', b: 'sx', c: 'so' },
  },
  {
    id: 'q3',
    type: 'centers',
    title: 'WHAT YOU WANT',
    text: 'When you imagine your life going really well, what matters most to you?',
    options: {
      a: 'Feeling safe, prepared, and certain about what\u2019s ahead',
      b: 'Feeling loved, seen, and deeply connected to the people who matter to me',
      c: 'Feeling autonomous, capable, and in control of my own world',
    },
    mapping: { a: 'head', b: 'heart', c: 'body' },
  },
  {
    id: 'q4',
    type: 'centers',
    title: 'WHAT YOU FEAR',
    text: 'What would feel most threatening to your sense of wellbeing?',
    options: {
      a: 'Feeling overwhelmed, unprepared, or without the support I need',
      b: 'Feeling unloved, worthless, or fundamentally disconnected from others',
      c: 'Feeling controlled, powerless, or like I don\u2019t matter',
    },
    mapping: { a: 'head', b: 'heart', c: 'body' },
  },
  {
    id: 'q5',
    type: 'instinct',
    title: 'WHAT YOU PROTECT',
    text: 'When you think about what you protect most fiercely in your life, where does most of your attention and energy go?',
    options: {
      a: 'My personal world \u2014 my health, home, finances, daily rhythms, and sense of physical security',
      b: 'My key relationships \u2014 the people I feel most intensely connected to and want to know deeply',
      c: 'My place in the world \u2014 my role, my friendships, my sense of belonging to groups and community',
    },
    mapping: { a: 'sp', b: 'sx', c: 'so' },
  },
  {
    id: 'q6',
    type: 'centers',
    title: 'WHAT YOU NEED IN RELATIONSHIPS',
    text: 'In your closest relationships, what do you find yourself most needing from the other person?',
    options: {
      a: 'To feel understood without being crowded \u2014 someone who helps me feel less alone with my concerns but doesn\u2019t demand more engagement than I have in me',
      b: 'To feel genuinely seen and valued \u2014 someone who recognizes who I am and what I bring, and whose appreciation feels real rather than perfunctory',
      c: 'To feel respected and given space \u2014 someone who doesn\u2019t crowd me or try to control me',
    },
    mapping: { a: 'head', b: 'heart', c: 'body' },
  },
  {
    id: 'q7',
    type: 'instinct',
    title: 'HOW YOU ENGAGE RELATIONALLY',
    text: 'When you think about how you most naturally engage with the people in your life, which of these feels most like you?',
    options: {
      a: 'I tend to be selective and protective \u2014 I keep a relatively small circle and guard my time and energy carefully',
      b: 'I gravitate toward depth over breadth \u2014 I want a few relationships that feel genuinely intense and alive',
      c: 'I move naturally toward groups and community \u2014 I feel most like myself when I have a role and a sense of belonging',
    },
    mapping: { a: 'sp', b: 'sx', c: 'so' },
  },
  {
    id: 'q8',
    type: 'centers',
    title: 'DECISION MAKING',
    text: 'When you\u2019re facing an important decision, what\u2019s most present for you internally?',
    options: {
      a: 'A need to think it through carefully \u2014 I want to feel certain I\u2019ve considered all the angles before moving forward',
      b: 'A need to feel right about it emotionally \u2014 I check in with how it feels and how it affects the people involved',
      c: 'A felt pull around the doing of it \u2014 for some it\u2019s an urgency to move and decide, for others a quieter sense that if I keep the friction low the right path will settle into place on its own',
    },
    mapping: { a: 'head', b: 'heart', c: 'body' },
  },
  {
    id: 'q9',
    type: 'instinct',
    title: 'WHAT FEELS MOST SATISFYING',
    text: 'When life feels genuinely good, what\u2019s most present for you?',
    options: {
      a: 'A feeling of being settled, secure, and well-resourced \u2014 my personal world feels stable and taken care of',
      b: 'A feeling of being deeply connected and fully alive in my most important relationships',
      c: 'A feeling of belonging, of mattering to my community or group, of playing a meaningful role in something larger than myself',
    },
    mapping: { a: 'sp', b: 'sx', c: 'so' },
  },
  {
    id: 'q10',
    type: 'centers',
    title: 'WHAT BOTHERS YOU',
    text: 'What tends to bother you most when it shows up repeatedly in your life?',
    options: {
      a: 'Uncertainty and feeling like I don\u2019t have enough information to feel prepared \u2014 or the feeling of being intruded upon, drained by demands I didn\u2019t choose, or pushed to engage when my reserves are low',
      b: 'Feeling dismissed, unseen, or like I\u2019m not landing the way I\u2019d want with the people around me',
      c: 'Feeling like others are overstepping, taking over, or pulling me into pressure and tension I didn\u2019t create and can\u2019t quite step out of',
    },
    mapping: { a: 'head', b: 'heart', c: 'body' },
  },
];

// =================== COUNTER-TYPE CONFIG ===================

// Known counter-type combinations. Flag triggers YES when confirmed instinct
// plus any of the three Stage 1 hypotheses matches one of these pairs.
const CT_COMBOS = {
  'SP-3': 'SP 3 Anti-Vanity',
  'SX-6': 'SX 6 Counterphobic',
  'SP-4': 'SP 4 Tenacity',
  'SX-1': 'SX 1 Zeal',
  'SO-7': 'SO 7 Sacrifice',
};

// Three types in each Center, fixed order. Used to build Stage 1 hypotheses.
const CENTER_TYPES = {
  Body: [8, 9, 1],
  Heart: [2, 3, 4],
  Head: [5, 6, 7],
};

// =================== STAGE 2 DATA ===================

// Three single-select questions covering the Narrative Enneagram's three
// cross-referencing frameworks. Each answer maps to a bucket of three types.
const STAGE2_QUESTIONS = [
  {
    id: 'xref-q1',
    framework: 'Hornevian',
    title: 'SOCIAL STANCE',
    text: 'What is your default strategy for getting what you want or need?',
    options: {
      A: 'I step up and go for it \u2014 I\u2019m direct, sometimes forceful, and I trust myself to make things happen.',
      B: 'I work with others carefully \u2014 I try to do the right thing, follow the right process, or earn it through effort and relationship.',
      C: 'I pull back and figure out my approach first \u2014 I need time to think, feel, or map things out before I move.',
    },
  },
  {
    id: 'xref-q2',
    framework: 'Harmonic',
    title: 'CONFLICT RESPONSE',
    text: 'How do you react when things don\u2019t go the way you were expecting?',
    options: {
      A: 'I call it out directly \u2014 I feel it intensely and I want to deal with it immediately.',
      B: 'I try to look on the bright side \u2014 I\u2019d rather find what\u2019s still working than dwell on what went wrong.',
      C: 'I go into problem-solving mode \u2014 I want to understand what happened and figure out how to fix it.',
    },
  },
  {
    id: 'xref-q3',
    framework: 'ObjectRelations',
    title: 'LIFE THEME',
    text: 'Which of these has been a quiet but consistent theme over the arc of your life, even when things are otherwise going well?',
    options: {
      A: 'Needing to feel genuinely connected and knowing where I stand \u2014 with people, in relationships, or in the structures and groups that matter to me.',
      B: 'A sense that things \u2014 relationships, experiences, or life itself \u2014 rarely quite live up to what they could or should be.',
      C: 'A quiet discomfort with feeling too exposed, too dependent, or too vulnerable with others.',
    },
  },
];

// Framework buckets — which three types land in each answer.
const STAGE2_FRAMEWORK_TYPES = {
  Hornevian:       { A: [3, 7, 8], B: [1, 2, 6], C: [4, 5, 9] },
  Harmonic:        { A: [4, 6, 8], B: [2, 7, 9], C: [1, 3, 5] },
  ObjectRelations: { A: [3, 6, 9], B: [1, 4, 7], C: [2, 5, 8] },
};

// Plain-English bucket labels — used for rendering and the ambiguity axis string.
const STAGE2_BUCKET_LABELS = {
  Hornevian:       { A: 'Assertive',  B: 'Compliant',  C: 'Withdrawn'  },
  Harmonic:        { A: 'Intensity',  B: 'Positive',   C: 'Competency' },
  ObjectRelations: { A: 'Attachment', B: 'Frustration', C: 'Rejection' },
};

const STAGE2_FRAMEWORK_LABELS = {
  Hornevian: 'Hornevian',
  Harmonic: 'Harmonic',
  ObjectRelations: 'Object Relations',
};

// =================== STAGE 3 DATA ===================

// Shared stems.
const STAGE3_Q1_STEM = 'Which of these sounds most like you at your best?';
const STAGE3_Q2_STEM = 'Which of these is hardest for you to be with?';

// Nine core-motivation descriptions. Pairs are assembled dynamically.
const STAGE3_CORE_MOTIVATIONS = {
  1: 'I am doing things the right way. I feel principled, clear, and in integrity with my own standards.',
  2: 'I am tuned in to what others need. I feel genuinely helpful, warm, and deeply connected.',
  3: 'I am achieving my goals and getting things done. I feel capable, successful, and recognized for what I bring.',
  4: 'I am expressing who I really am \u2014 nothing hidden, nothing performed. I feel a sense of meaning and purpose, alive, and creative.',
  5: 'I am deeply knowledgeable about things that matter. I feel well-boundaried, self-sufficient, and resourced.',
  6: 'I am prepared for whatever life throws at me. I feel steady, certain, and loyal to people I trust.',
  7: 'I am experiencing life to the fullest. I feel free, expansive, and open to everything available to me.',
  8: 'I am fully in control of my world. I feel strong, powerful, and completely unbothered by outside pressure.',
  9: 'I am experiencing a sense of inner and outer calm. I feel connected to everyone and everything.',
};

// High-ambiguity pairs. Q2 avoidance fires automatically for these. Keys are
// 'lower-higher' numerical pairs; lower-numbered type is always Person A.
const STAGE3_HIGH_AMBIGUITY_PAIRS = new Set([
  '1-6', '1-9', '2-6', '2-9', '3-6', '3-7', '3-8', '4-5', '4-9', '5-6', '5-9', '6-8',
]);

// Avoidance Q2 content per high-ambiguity pair.
const STAGE3_AVOIDANCE_QUESTIONS = {
  '1-6': {
    label: 'Inner Critic vs. External Certainty',
    personA: 'The voice in my head that tells me I\u2019m not enough, not good enough, or that I\u2019m wrong.',
    personB: 'Feeling unsupported, unprepared, or uncertain about what\u2019s about to happen.',
  },
  '1-9': {
    label: 'Inner Critic vs. Conflict Avoidance',
    personA: 'Seeing something wrong, incorrect, or broken and not being able to fix it.',
    personB: 'Experiencing conflict or tension in the peace and not being able to escape it.',
  },
  '2-6': {
    label: 'Rejection vs. Uncertainty',
    personA: 'Feeling like my care and support is unwanted or unnecessary.',
    personB: 'Feeling like I don\u2019t know where things stand or who I can truly trust.',
  },
  '2-9': {
    label: 'Being Unloved vs. Disrupted Peace',
    personA: 'Feeling like I\u2019m no longer needed by people that matter to me.',
    personB: 'Feeling friction or conflict with people that matter to me.',
  },
  '3-6': {
    label: 'Recognition vs. Support',
    personA: 'Feeling like my efforts aren\u2019t being noticed or valued.',
    personB: 'Feeling unsupported in the face of uncertainty.',
  },
  '3-7': {
    label: 'Goal Orientation vs. Limitation',
    personA: 'Not having a clear goal to achieve or things on my to-do list.',
    personB: 'Running out of ideas, energy, or possibilities.',
  },
  '3-8': {
    label: 'Image vs. Power',
    personA: 'People who don\u2019t appreciate what it took for me to achieve a goal.',
    personB: 'People who won\u2019t go head-to-head with me in tough conversations.',
  },
  '4-5': {
    label: 'Ordinariness vs. Emotional Overwhelm',
    personA: 'Feeling like there\u2019s nothing special about me \u2014 that I\u2019m just like everyone else.',
    personB: 'Feeling overwhelmed by an emotional experience, mine or someone else\u2019s.',
  },
  '4-9': {
    label: 'Emotional Flatness vs. Emotional Intensity',
    personA: 'Feeling emotionally flat or numb \u2014 like nothing is moving inside me.',
    personB: 'Feeling pulled into someone else\u2019s emotional intensity or drama.',
  },
  '5-6': {
    label: 'Resource Scarcity vs. Lack of Support',
    personA: 'Feeling like I don\u2019t have the resources to navigate the world.',
    personB: 'Feeling unsupported in the face of uncertainty.',
  },
  '5-9': {
    label: 'Depletion vs. Conflict',
    personA: 'Feeling depleted by too much engagement or contact.',
    personB: 'Feeling pressured to take a position that could cause conflict or disharmony.',
  },
  '6-8': {
    label: 'Managed Fear vs. Denied Vulnerability',
    personA: 'Feeling unprepared for something that could go wrong.',
    personB: 'Feeling weak, vulnerable, or like someone has gotten the upper hand.',
  },
};

// Counter-type mode pairs, keyed by instinct-type key (matches CT_COMBOS).
// counterType/lookalike are the type numbers for leading-type resolution.
const STAGE3_CT_PAIRS = {
  'SO-7': {
    label: 'SO 7 vs. Type 2',
    counterType: 7,
    lookalike: 2,
    personA: 'I am sharing what I love with the people around me. I feel engaged, generous, and genuinely happy \u2014 and I want others to experience that same aliveness I feel.',
    personB: 'I am tuned in to what others need. I feel genuinely helpful, warm, and deeply connected \u2014 and I need to feel that my presence matters to them.',
  },
  'SX-6': {
    label: 'SX 6 vs. Type 8',
    counterType: 6,
    lookalike: 8,
    personA: 'I am facing something head-on and not letting fear win. I feel courageous and alive \u2014 most myself when I\u2019m pushing toward the thing that scares me.',
    personB: 'I am fully in control and unbothered. I feel powerful and clear \u2014 there\u2019s no fear underneath, just a certainty that I won\u2019t be controlled or pushed around.',
  },
  'SP-3': {
    label: 'SP 3 vs. Type 1',
    counterType: 3,
    lookalike: 1,
    personA: 'I am getting things done and building something solid. I feel capable and self-sufficient \u2014 I don\u2019t need recognition, I just need to know I\u2019ve made it on my own terms.',
    personB: 'I am doing things the right way. I feel principled and in integrity \u2014 anything less than my own standard would feel like a betrayal of who I am.',
  },
  'SP-4': {
    label: 'SP 4 vs. Type 3',
    counterType: 4,
    lookalike: 3,
    personA: 'I am proving something \u2014 to myself more than anyone else. I feel driven and resilient, like I\u2019m refusing to be defeated by a sense of not being enough.',
    personB: 'I am achieving something meaningful. I feel capable, successful, and recognized \u2014 and I want the people who matter to see that I\u2019ve done well.',
  },
  'SX-1': {
    label: 'SX 1 vs. Type 8',
    counterType: 1,
    lookalike: 8,
    personA: 'I am fighting for something that genuinely matters. I feel intensely alive when I\u2019m up against something wrong \u2014 there\u2019s a standard at stake and I won\u2019t back down from it.',
    personB: 'I am fully in control and unbothered. I feel powerful and clear \u2014 I push hard because I won\u2019t be limited or told what I can\u2019t do.',
  },
};

// =================== STAGE 4 DATA ===================

// Shared stems.
const STAGE4_STRESS_STEM = 'When you\u2019re under significant and prolonged stress, which of these feels most like what happens to you \u2014 even if it surprises you?';
const STAGE4_SECURITY_STEM = 'When you feel genuinely safe, relaxed, and at ease \u2014 when the pressure is off \u2014 which of these feels most like how you show up?';
const STAGE4_HABIT_STEM = 'Without trying to control it, where does your attention tend to go first in most situations?';

// For each type, a three-option question. Index 0 is the CORRECT answer
// (the canonical stress/security/habit pattern for that type). Indexes 1 and 2
// are alternative energies (annotated in comments) used as distractors.
// Options are shuffled at render time.

const STAGE4_STRESS = {
  1: [
    'I become weighed down with emotion. I start dwelling on what others have naturally that I don\u2019t and I long to be whole.', // correct (1\u21924)
    'I become more anxious and suspicious. I start worrying about what could go wrong and need reassurance that things will be okay.', // 6 energy
    'I go numb and withdraw. I go along to get along, hoping that will restore the peace both internally and externally.', // 9 energy
  ],
  2: [
    'I get angry, forceful, and confrontational. My usual warm and giving self disappears and I become demanding, blunt, or even aggressive about what I need.', // correct (2\u21928)
    'I become hypervigilant about who I can trust. I get suspicious and start needing reassurance that the people in my life are actually there for me.', // 6 energy
    'I turn inward and become absorbed in how I\u2019m feeling. I pull away from others and get lost in my own emotional world.', // 4 energy
  ],
  3: [
    'I shut down. The drive and ambition that usually feel effortless just vanish and I find myself checked out and disengaged.', // correct (3\u21929)
    'I become anxious and start second-guessing myself. I lose confidence in my own judgment and need others to tell me I\u2019m on the right track.', // 6 energy
    'I become overly focused on others and what they need. I shift into caretaking mode as a way to feel needed and connected.', // 2 energy
  ],
  4: [
    'I become overly helpful and acutely aware of what others need. I set my own needs aside and seek the appreciation of others.', // correct (4\u21922)
    'I become self-critical and rigid. I get fixated on what I\u2019ve done wrong and feel a strong pull to correct myself.', // 1 energy
    'I go into overdrive seeking stimulation. I start filling my schedule and looking for the next thing that will make me feel alive again.', // 7 energy
  ],
  5: [
    'I become scattered and overextended. I start taking on too much, chasing new ideas, and lose the focused stillness that usually grounds me.', // correct (5\u21927)
    'I become reactive and forceful. I lose my usual calm detachment and feel an intense need to push back and take control.', // 8 energy
    'I become more anxious and catastrophizing. I lose my objective detachment and start spiraling into what could go wrong.', // 6 energy
  ],
  6: [
    'I become hyper-focused on getting after my own goals. I get driven and image-conscious and start pushing hard to make things happen and be seen as capable.', // correct (6\u21923)
    'I become forceful and combative. I stop hesitating and start pushing hard \u2014 I need to feel powerful and in control.', // 8 energy
    'I check out and go numb. I stop engaging with the anxiety and just try to get through it by not feeling anything.', // 9 energy
  ],
  7: [
    'I become critical and perfectionistic. I lose my lightness and get fixated on what\u2019s wrong, what\u2019s not good enough, and what needs to be corrected.', // correct (7\u21921)
    'I become emotionally flooded and self-absorbed. I get lost in longing for what\u2019s missing and find it hard to focus on anything else.', // 4 energy
    'I withdraw and go quiet. I stop engaging and start retreating into my own world, needing a lot of alone time to recover.', // 5 energy
  ],
  8: [
    'I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy.', // correct (8\u21925)
    'I become more giving and focused on others. I move toward people and shift into support mode, wanting to feel needed.', // 2 energy
    'I become more driven and performance-focused. I push myself harder to stay productive and appear capable under pressure.', // 3 energy
  ],
  9: [
    'I become anxious and hypervigilant. The usual peace disappears and I start worrying about what could go wrong and whether I\u2019m prepared.', // correct (9\u21926)
    'I become emotionally flooded and withdrawn. I get absorbed in my feelings and pull away from people and obligations.', // 4 energy
    'I become driven and task-focused. I throw myself into productivity to avoid feeling what\u2019s happening under the surface.', // 3 energy
  ],
};

const STAGE4_SECURITY = {
  1: [
    'I become lighter, more playful, and spontaneous. I stop being so hard on myself and find it easier to enjoy things without worrying about doing them perfectly.', // correct (1\u21927)
    'I become warmer and more focused on others. I want to give more and feel more connected to the people I care about.', // 2 energy
    'I become more reflective and emotionally open. I drop the doing and let myself just feel and be for a while.', // 4 energy
  ],
  2: [
    'I turn inward and become introspective. I stop trying to take care of others and allow myself to focus on how I\u2019m feeling and what I need.', // correct (2\u21924)
    'I become easier to be around and less agenda-driven. I stop pushing so hard to be needed and let myself just relax and enjoy things.', // 9 energy
    'I become more playful and spontaneous. I stop focusing on what others need and let myself just explore and enjoy things freely.', // 7 energy
  ],
  3: [
    'I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don\u2019t need to go it alone and actually want us to win together.', // correct (3\u21926)
    'I slow down and become more easygoing. I stop needing to achieve and just let myself be present without an agenda.', // 9 energy
    'I become more spontaneous and curious. I stop focusing on goals and let myself just explore and enjoy what\u2019s in front of me.', // 7 energy
  ],
  4: [
    'I become more grounded, disciplined, and action-oriented. I stop dwelling on what\u2019s missing and start doing, with a clearer sense of what\u2019s right and what needs to happen.', // correct (4\u21921)
    'I become lighter and more optimistic. I stop focusing on what\u2019s wrong and let myself enjoy what\u2019s actually good in my life.', // 7 energy
    'I become more outward-focused and giving. I stop dwelling on myself and feel genuinely energized by helping and connecting with others.', // 2 energy
  ],
  5: [
    'I become more present, decisive, and action-oriented. I step into the world with confidence and feel energized by direct engagement rather than observation.', // correct (5\u21928)
    'I become more easygoing and comfortable in my own skin. I stop overthinking and let myself just be present without needing to analyze everything.', // 9 energy
    'I become more connected and warm. I drop the detachment and feel genuinely open to the people around me.', // 2 energy
  ],
  6: [
    'I become genuinely peaceful and easy. I find myself just present, comfortable, and okay with how things are without needing to figure anything out.', // correct (6\u21929)
    'I become warmer and more giving. I feel safe enough to focus on others and genuinely enjoy taking care of the people I care about.', // 2 energy
    'I become more emotionally open and introspective. I feel safe enough to explore my inner world without it feeling threatening.', // 4 energy
  ],
  7: [
    'I become quieter, more focused, and genuinely still. I stop needing to share and stimulate and find deep satisfaction in solitude and going deep on one thing.', // correct (7\u21925)
    'I become more easygoing and present. I stop planning ahead and let myself just be where I am without needing something else to be happening.', // 9 energy
    'I become more focused and goal-oriented. I channel my energy into building something and feel grounded by the progress I\u2019m making.', // 3 energy
  ],
  8: [
    'I become magnanimous and open to connection. I put the armor down and allow myself to show my care and support for others.', // correct (8\u21922)
    'I become more relaxed and easygoing. I stop pushing so hard and let things unfold without needing to be in control.', // 9 energy
    'I become more loyal and collaborative. I feel a strong pull toward the people I trust and want to make sure everyone is okay.', // 6 energy
  ],
  9: [
    'I become more focused, energized, and directed. I connect with what I actually want and feel a pull to make things happen rather than just going along.', // correct (9\u21923)
    'I become lighter and more playful. I stop worrying about keeping the peace and let myself just enjoy what\u2019s in front of me.', // 7 energy
    'I become warmer and more attuned. I feel a pull toward the people around me and genuinely enjoy caring for them.', // 2 energy
  ],
};

const STAGE4_HABIT = {
  1: [
    'To what\u2019s wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else.', // correct
    'To what could go wrong or what I might not be prepared for. I\u2019m scanning for potential problems and threats before they materialize.', // 6 attention
    'To what needs to be done and how to do it efficiently. I\u2019m already thinking about tasks, goals, and getting things moving.', // 3 attention
  ],
  2: [
    'To how other people are feeling and what they might need. I\u2019m reading the room emotionally and sensing who needs something before they ask.', // correct
    'To the overall atmosphere and whether everyone feels comfortable. I\u2019m aware of the group energy and pulled toward making sure things feel settled.', // 9 attention
    'To whether things are going to be okay and who I can rely on. I\u2019m scanning for reliability and trying to anticipate what might go sideways.', // 6 attention
  ],
  3: [
    'To what needs to happen and who\u2019s going to make it happen. I\u2019m assessing quickly and feel a pull to take charge and get things moving.', // correct
    'To what could be done better. I notice quickly when something isn\u2019t quite right and feel a pull to fix it.', // 1 attention
    'To what\u2019s possible and what else could be interesting. My mind moves toward options, opportunities, and what could make this better.', // 7 attention
  ],
  4: [
    'To what\u2019s absent or incomplete. There\u2019s a persistent sense that something essential is missing, and my attention keeps returning to that gap even when things are going reasonably well.', // correct
    'To how other people are feeling. I\u2019m attuned to the emotional undercurrent and feel a pull to respond to what I sense in others.', // 2 attention
    'To the overall feel of things. I\u2019m drawn to what\u2019s harmonious and what might disrupt the atmosphere.', // 9 attention
  ],
  5: [
    'To understanding the situation fully before engaging. I want to gather enough information to feel confident about what\u2019s happening before I say or do anything.', // correct
    'To what could go wrong and whether I\u2019m prepared. I find myself anticipating problems and wanting to have a plan before I\u2019m in over my head.', // 6 attention
    'To what\u2019s not quite right. I notice inconsistencies and gaps quickly and feel a pull to correct or clarify.', // 1 attention
  ],
  6: [
    'To what could go wrong or what I might not be prepared for. I\u2019m scanning for potential problems and threats before they materialize.', // correct
    'To understanding the situation fully before engaging. I want enough information to feel confident before I commit to anything.', // 5 attention
    'To the overall atmosphere and whether things feel stable. I\u2019m drawn to keeping things easy and avoiding unnecessary disruption.', // 9 attention
  ],
  7: [
    'To what\u2019s next, what\u2019s possible, and what else is available. My mind is already moving toward new ideas, options, and what could be exciting about what\u2019s ahead.', // correct
    'To what needs to happen and how to make it happen quickly. I\u2019m already thinking about goals, tasks, and getting things moving.', // 3 attention
    'To the people in the room and what might make this more enjoyable for everyone. I want to create energy and connection.', // 2 attention
  ],
  8: [
    'To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated.', // correct
    'To what needs to happen and who\u2019s going to make it happen. I\u2019m assessing quickly and feel a pull to take charge if no one else is.', // 3 attention
    'To potential threats and whether I can trust what\u2019s happening. I\u2019m scanning for danger and assessing who\u2019s reliable.', // 6 attention
  ],
  9: [
    'To the overall atmosphere and whether everyone feels included and comfortable. I\u2019m aware of the whole room and pulled toward making sure things feel settled and okay for everyone.', // correct
    'To who might need something. I notice quickly if someone seems left out or uncomfortable and feel a pull to help.', // 2 attention
    'To what might make this more enjoyable or interesting. I\u2019m looking for the positive angle and what could make the situation feel lighter.', // 7 attention
  ],
};

// Counter-type comparative questions (Modified Option B). Fires when Stage 3
// CT mode produced a 'Both' answer. Person A = counter-type, Person B = lookalike.
// 4-way response: Person A / Both but more A / Both but more B / Person B.
const STAGE4_CT_COMPARATIVE = {
  'SO-7': {
    label: 'SO 7 vs. Type 2',
    stress: {
      personA: 'I become critical, rigid, and perfectionistic. I lose my usual lightness and start fixating on what\u2019s wrong, what needs correcting, and whether things are being done properly.',
      personB: 'I get angry, forceful, and confrontational. My usual warm and giving self disappears and I become demanding, blunt, or even aggressive about what I need.',
    },
    security: {
      personA: 'I become quieter, more focused, and genuinely still. I stop needing to share and stimulate and find deep satisfaction in solitude and going deep on one thing.',
      personB: 'I turn inward and become introspective. I stop trying to take care of others and allow myself to focus on how I\u2019m feeling and what I need.',
    },
    habit: {
      personA: 'To what\u2019s possible and what I can share. My attention goes toward experiences, ideas, and people I can bring into what I love, so that others feel the aliveness I feel.',
      personB: 'To how other people are feeling and what they might need. I\u2019m reading the room emotionally and sensing who needs something before they ask.',
    },
  },
  'SX-6': {
    label: 'SX 6 vs. Type 8',
    stress: {
      personA: 'I become hyper-focused on getting after my own goals. I put energy into efficiency, achievement, and being seen as successful.',
      personB: 'I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy.',
    },
    security: {
      personA: 'I become genuinely peaceful and easy. I find myself just present, comfortable, and okay with how things are.',
      personB: 'I become magnanimous and open to connection. I put the armor down and allow myself to show my care and support for others.',
    },
    habit: {
      personA: 'To what could go wrong or what I might not be prepared for. I\u2019m constantly scanning for danger and coming up with contingency plans.',
      personB: 'To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated.',
    },
  },
  'SP-3': {
    label: 'SP 3 vs. Type 1',
    stress: {
      personA: 'I shut down. The drive and ambition that usually feel effortless just vanish and I find myself checked out and disengaged.',
      personB: 'I become weighed down with emotion. I start dwelling on what others have naturally that I don\u2019t and I long to be whole.',
    },
    security: {
      personA: 'I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don\u2019t need to go it alone and actually want us to win together.',
      personB: 'I become lighter, more playful, and spontaneous. I stop being so hard on myself and find it easier to enjoy things without worrying about doing them perfectly.',
    },
    habit: {
      personA: 'To what needs to be done and whether I\u2019m being effective. My attention goes to tasks, results, and whether I\u2019m building something solid, without needing anyone to notice.',
      personB: 'To what\u2019s wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else.',
    },
  },
  'SP-4': {
    label: 'SP 4 vs. Type 3',
    stress: {
      personA: 'I become overly helpful and acutely aware of what others need. I set my own needs aside and seek the appreciation of others.',
      personB: 'I shut down. The drive and ambition that usually feel effortless just vanish and I find myself checked out and disengaged.',
    },
    security: {
      personA: 'I become more grounded, disciplined, and action-oriented. I stop dwelling on what\u2019s missing and start doing, with a clearer sense of what\u2019s right and what needs to happen.',
      personB: 'I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don\u2019t need to go it alone and actually want us to win together.',
    },
    habit: {
      personA: 'To what\u2019s absent or incomplete. There\u2019s a persistent sense that something essential is missing, and my attention keeps returning to that gap even when things are going reasonably well.',
      personB: 'To how I\u2019m coming across and whether I\u2019m building something meaningful. I\u2019m aware of whether I\u2019m being effective and whether the people who matter can see what I\u2019m capable of.',
    },
  },
  'SX-1': {
    label: 'SX 1 vs. Type 8',
    stress: {
      personA: 'I become weighed down with emotion. I start dwelling on what others have naturally that I don\u2019t and I long to be whole.',
      personB: 'I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy.',
    },
    security: {
      personA: 'I become more loyal, collaborative, and questioning. I want to check in with people I trust and think things through more carefully, and I feel less need to prove myself.',
      personB: 'I become magnanimous and open to connection. I put the armor down and allow myself to show my care and support for others.',
    },
    habit: {
      personA: 'To what\u2019s wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else.',
      personB: 'To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated.',
    },
  },
};

const TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer',
  4: 'The Individualist', 5: 'The Observer', 6: 'The Questioner',
  7: 'The Enthusiast', 8: 'The Protector', 9: 'The Peacemaker',
};

// =================== SCORING ENGINE ===================

function computeStage1Scores() {
  // Rank 1 = 3pts, Rank 2 = 2pts, Rank 3 = 1pt (inverted)
  const totals = { head: 0, heart: 0, body: 0, sp: 0, so: 0, sx: 0 };

  STAGE1_QUESTIONS.forEach((q, idx) => {
    const r = state.stage1Rankings[idx];
    ['a', 'b', 'c'].forEach((letter) => {
      const pts = 4 - r[letter]; // rank 1→3, rank 2→2, rank 3→1
      const dim = q.mapping[letter]; // e.g. 'head', 'sp'
      totals[dim] = (totals[dim] || 0) + pts;
    });
  });

  // Centers
  const centerScores = { Head: totals.head, Heart: totals.heart, Body: totals.body };
  const sortedCenters = Object.entries(centerScores).sort((a, b) => b[1] - a[1]);
  const identifiedCenter = sortedCenters[0][0];
  const centerGap = sortedCenters[0][1] - sortedCenters[1][1];
  const centerConfidence = centerGap >= 5 ? 'HIGH' : centerGap >= 3 ? 'MEDIUM' : 'LOW';
  const secondCenter = centerConfidence === 'LOW' ? sortedCenters[1][0] : null;

  // Instincts
  const instinctScores = { SP: totals.sp, SO: totals.so, SX: totals.sx };
  const sortedInstincts = Object.entries(instinctScores).sort((a, b) => b[1] - a[1]);
  const identifiedInstinct = sortedInstincts[0][0];
  const instinctGap = sortedInstincts[0][1] - sortedInstincts[1][1];
  const instinctConfidence = instinctGap >= 4 ? 'HIGH' : instinctGap >= 2 ? 'MEDIUM' : 'LOW';

  // Three type hypotheses (fixed Center order: Body 8,9,1 / Heart 2,3,4 / Head 5,6,7).
  // On LOW Center confidence: primary[0], secondary[0], primary[1] — top of each
  // candidate Center plus second slot from the primary Center.
  let typeHypotheses;
  if (centerConfidence === 'LOW') {
    const primary = CENTER_TYPES[identifiedCenter];
    const secondary = CENTER_TYPES[secondCenter];
    typeHypotheses = [primary[0], secondary[0], primary[1]];
  } else {
    typeHypotheses = [...CENTER_TYPES[identifiedCenter]];
  }

  // Counter-type flag — YES if any hypothesis + confirmed instinct matches a
  // known CT combo. First match (in hypothesis order) is stored.
  let counterTypeFlag = 'NO';
  let counterTypeCombination = null;
  let counterTypeKey = null;
  for (const t of typeHypotheses) {
    const key = `${identifiedInstinct}-${t}`;
    if (CT_COMBOS[key]) {
      counterTypeFlag = 'YES';
      counterTypeCombination = CT_COMBOS[key];
      counterTypeKey = key;
      break;
    }
  }

  return {
    head: totals.head, heart: totals.heart, body: totals.body,
    sp: totals.sp, so: totals.so, sx: totals.sx,
    identifiedCenter, centerGap, centerConfidence, secondCenter,
    identifiedInstinct, instinctGap, instinctConfidence,
    sortedInstincts,
    typeHypotheses,
    counterTypeFlag,
    counterTypeCombination,
    counterTypeKey,
  };
}

// Stage 2 scoring: for each Stage 1 hypothesis, count how many of the three
// framework answers include that type in their bucket. Highest count wins
// primary; next wins alternative. Ties resolved by Stage 1 Center score.
//
// Special cases: cross-center overrides for Types 3, 9, and 5. All three have
// structural patterns that cause their home-Center scores to undershoot in
// self-report, so when the Stage 2 framework signature unambiguously points to
// one of them we trust the cross-referencing result over the Stage 1 Center.
// The three signatures are mutually exclusive (Q1 alone separates 3 from
// 9/5; Q2 or Q3 separates 9 from 5), so the if/else if chain is safe.
//
//   Type 3 override (A/C/A → Assertive + Competency + Attachment):
//     fires when Stage 1 Center ≠ Heart. Type 3 actively suppresses Heart
//     emotions in service of performance — conscious bypass.
//
//   Type 9 override (C/B/A → Withdrawn + Positive + Attachment):
//     fires when Stage 1 Center ≠ Body. Type 9 dissipates and narcotizes
//     anger pre-consciously — the feeling doesn't register as feeling.
//
//   Type 5 override (C/C/C → Withdrawn + Competency + Rejection):
//     fires when Stage 1 Center ≠ Head. Type 5 walls fear off behind
//     self-sufficiency pre-emptively — felt as a need for privacy and
//     energy conservation rather than as anxiety.
function computeStage2Scores() {
  const s = state.scores;
  const hypotheses = s.typeHypotheses;
  const answers = state.stage2Answers; // ['A', 'C', 'A']
  const frameworks = ['Hornevian', 'Harmonic', 'ObjectRelations'];

  const counts = {};
  hypotheses.forEach((t) => { counts[t] = 0; });

  frameworks.forEach((framework, idx) => {
    const bucket = STAGE2_FRAMEWORK_TYPES[framework][answers[idx]];
    hypotheses.forEach((t) => {
      if (bucket.includes(t)) counts[t]++;
    });
  });

  const centerOfType = (t) => {
    if (CENTER_TYPES.Body.includes(t)) return 'Body';
    if (CENTER_TYPES.Heart.includes(t)) return 'Heart';
    return 'Head';
  };
  const centerScore = { Body: s.body, Heart: s.heart, Head: s.head };

  // Normal intersection sort first — stable, so equal-count ties preserve
  // fixed hypothesis order. Center-score tiebreak matters when hypotheses
  // span two Centers (LOW confidence).
  const sorted = [...hypotheses].sort((a, b) => {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    return centerScore[centerOfType(b)] - centerScore[centerOfType(a)];
  });

  let xrefPrimary = sorted[0];
  let xrefAlternative = sorted[1];

  // Cross-center overrides for Types 3, 9, and 5.
  const isType3Signature = answers[0] === 'A' && answers[1] === 'C' && answers[2] === 'A';
  const isType9Signature = answers[0] === 'C' && answers[1] === 'B' && answers[2] === 'A';
  const isType5Signature = answers[0] === 'C' && answers[1] === 'C' && answers[2] === 'C';
  let crossCenterDivergence = false;
  let crossCenterNote = null;
  if (isType3Signature && s.identifiedCenter !== 'Heart') {
    crossCenterDivergence = true;
    crossCenterNote = `Stage 1 Center is ${s.identifiedCenter}, but Stage 2 signature is Assertive + Competency + Attachment — the unique Type 3 intersection. Cross-center mistype is common for Type 3 because their structure suppresses Heart center emotions in service of performance. Carry Type 3 as the primary hypothesis and flag this as stage2_stage3_divergence.`;
    xrefAlternative = sorted[0]; // preserve Stage 1's top candidate as the alternative
    xrefPrimary = 3;
  } else if (isType9Signature && s.identifiedCenter !== 'Body') {
    crossCenterDivergence = true;
    crossCenterNote = `Stage 1 Center is ${s.identifiedCenter}, but Stage 2 signature is Withdrawn + Positive + Attachment — the unique Type 9 intersection. Cross-center mistype is common for Type 9 because their structure dissipates and narcotizes anger rather than expressing or converting it — a genuine 9 often does not recognize anger as anger, so Body center scores undershoot in self-report. Carry Type 9 as the primary hypothesis and flag this as stage2_stage3_divergence.`;
    xrefAlternative = sorted[0]; // preserve Stage 1's top candidate as the alternative
    xrefPrimary = 9;
  } else if (isType5Signature && s.identifiedCenter !== 'Head') {
    crossCenterDivergence = true;
    crossCenterNote = `Stage 1 Center is ${s.identifiedCenter}, but Stage 2 signature is Withdrawn + Competency + Rejection — the unique Type 5 intersection. Cross-center mistype is common for Type 5 because their structure walls fear off behind self-sufficiency rather than experiencing it as anxiety — a genuine 5 often reads fear as a preference for privacy and a need to conserve energy, so Head center scores undershoot in self-report. Carry Type 5 as the primary hypothesis and flag this as stage2_stage3_divergence.`;
    xrefAlternative = sorted[0]; // preserve Stage 1's top candidate as the alternative
    xrefPrimary = 5;
  }

  // Ambiguity axis: first framework where primary and alternative land in
  // different buckets. Plain-language string.
  let xrefAmbiguityAxis = null;
  for (const framework of frameworks) {
    const buckets = STAGE2_FRAMEWORK_TYPES[framework];
    const pBucket = Object.keys(buckets).find((k) => buckets[k].includes(xrefPrimary));
    const aBucket = Object.keys(buckets).find((k) => buckets[k].includes(xrefAlternative));
    if (pBucket && aBucket && pBucket !== aBucket) {
      const fName = STAGE2_FRAMEWORK_LABELS[framework];
      const pName = STAGE2_BUCKET_LABELS[framework][pBucket];
      const aName = STAGE2_BUCKET_LABELS[framework][aBucket];
      xrefAmbiguityAxis = `${fName}: primary (Type ${xrefPrimary}) scores ${pName}, alternative (Type ${xrefAlternative}) scores ${aName}.`;
      break;
    }
  }
  if (crossCenterDivergence) {
    xrefAmbiguityAxis = `Cross-center divergence: Stage 1 Center is ${s.identifiedCenter} but Stage 2 signature points to Type 3 (Heart). ${xrefAmbiguityAxis || ''}`.trim();
  }
  if (!xrefAmbiguityAxis) {
    xrefAmbiguityAxis = `Primary (Type ${xrefPrimary}) and alternative (Type ${xrefAlternative}) share the same bucket across all three frameworks.`;
  }

  // Counter-type check with the narrowed primary.
  const ctKey = `${s.identifiedInstinct}-${xrefPrimary}`;
  const xrefCounterType = CT_COMBOS[ctKey] ? 'YES' : 'NO';

  return {
    answers: [...answers],
    counts,
    xrefPrimary,
    xrefAlternative,
    xrefAmbiguityAxis,
    xrefCounterType,
    crossCenterDivergence,
    crossCenterNote,
  };
}

// =================== STAGE 3 HELPERS ===================

// Decide which Stage 3 pair to run and which mode applies. Called when we leave
// Stage 2, so the engine knows what to render.
//
// Rule: the Stage 1 counter-type flag is a hypothesis, not a directive. CT mode
// only fires when Stage 2 confirms it by landing on the counter-type's base
// type. If Stage 1 flagged (say) SX+6 but Stage 2 cleanly points to Type 7,
// Stage 2 wins and we route to Standard Mode on 7 vs. the Stage 2 alternative.
function resolveStage3Pair(scoresObj) {
  const xp = scoresObj.stage2.xrefPrimary;
  const xa = scoresObj.stage2.xrefAlternative;

  // CT mode — only when Stage 2 primary matches the flagged counter-type's base type.
  if (scoresObj.counterTypeFlag === 'YES' && STAGE3_CT_PAIRS[scoresObj.counterTypeKey]) {
    const ct = STAGE3_CT_PAIRS[scoresObj.counterTypeKey];
    if (xp === ct.counterType) {
      return { mode: 'COUNTER-TYPE', ctKey: scoresObj.counterTypeKey };
    }
    // Flag was set in Stage 1 but Stage 2 points elsewhere — trust Stage 2.
  }

  // Standard mode using Stage 2's primary and alternative.
  const lower = Math.min(xp, xa);
  const higher = Math.max(xp, xa);
  const pairKey = `${lower}-${higher}`;
  return {
    mode: 'STANDARD',
    pairKey,
    typeA: lower,
    typeB: higher,
    hasAvoidance: STAGE3_HIGH_AMBIGUITY_PAIRS.has(pairKey),
  };
}

// +2 / +1 / -1 / -2 for A / A-slight / B-slight / B. Positive = Person A wins.
function stage3Score(answer) {
  return { 'A': 2, 'A-slight': 1, 'B-slight': -1, 'B': -2 }[answer];
}

// Stage 3 scoring: STANDARD (1 or 2 questions) or COUNTER-TYPE (1 question).
function computeStage3Scores() {
  const s = state.scores;
  const pair = resolveStage3Pair(s);
  const answers = state.stage3Answers;

  if (pair.mode === 'COUNTER-TYPE') {
    const ct = STAGE3_CT_PAIRS[pair.ctKey];
    const q1 = answers[0];
    const clean = q1 === 'A' || q1 === 'B';
    const leaningA = q1 === 'A' || q1 === 'A-slight';
    const leading = leaningA ? ct.counterType : ct.lookalike;
    const confidence = clean ? 'HIGH' : 'MEDIUM';
    const ctAnswer = clean ? 'CLEAN' : 'BOTH';
    return {
      mode: 'COUNTER-TYPE',
      pair: ct.label,
      pairKey: pair.ctKey,
      typeA: ct.counterType,
      typeB: ct.lookalike,
      q1Answer: q1,
      q1Result: describeStage3Answer(q1, ct.counterType, ct.lookalike),
      q2Answer: null,
      q2Result: 'N/A',
      leading,
      confidence,
      ctAnswer,
    };
  }

  // STANDARD mode
  const q1 = answers[0];
  const q1Score = stage3Score(q1);

  if (pair.hasAvoidance) {
    const q2 = answers[1];
    const q2Score = stage3Score(q2);
    const total = q1Score + q2Score;
    let leading;
    if (total > 0) leading = pair.typeA;
    else if (total < 0) leading = pair.typeB;
    else leading = pair.typeA; // exact split — arbitrary tiebreak, LOW confidence signals it

    const abs = Math.abs(total);
    let confidence;
    if (abs === 4) confidence = 'HIGH';
    else if (abs === 3 || abs === 2) confidence = 'MEDIUM';
    else confidence = 'LOW';

    return {
      mode: 'STANDARD',
      pair: `${pair.typeA} vs. ${pair.typeB}`,
      pairKey: pair.pairKey,
      typeA: pair.typeA,
      typeB: pair.typeB,
      q1Answer: q1,
      q1Result: describeStage3Answer(q1, pair.typeA, pair.typeB),
      q2Answer: q2,
      q2Result: describeStage3Answer(q2, pair.typeA, pair.typeB),
      leading,
      confidence,
      ctAnswer: 'N/A',
    };
  }

  // STANDARD mode, Q1 only
  const leaningA = q1 === 'A' || q1 === 'A-slight';
  const clean = q1 === 'A' || q1 === 'B';
  return {
    mode: 'STANDARD',
    pair: `${pair.typeA} vs. ${pair.typeB}`,
    pairKey: pair.pairKey,
    typeA: pair.typeA,
    typeB: pair.typeB,
    q1Answer: q1,
    q1Result: describeStage3Answer(q1, pair.typeA, pair.typeB),
    q2Answer: null,
    q2Result: 'N/A',
    leading: leaningA ? pair.typeA : pair.typeB,
    confidence: clean ? 'HIGH' : 'MEDIUM',
    ctAnswer: 'N/A',
  };
}

function describeStage3Answer(answer, typeA, typeB) {
  switch (answer) {
    case 'A':        return `Person A clean (Type ${typeA})`;
    case 'A-slight': return `Both, leaning A (Type ${typeA})`;
    case 'B-slight': return `Both, leaning B (Type ${typeB})`;
    case 'B':        return `Person B clean (Type ${typeB})`;
    default:         return 'N/A';
  }
}

// =================== STAGE 4 HELPERS ===================

// How many of the three Stage 2 framework answers include the given type.
function countFrameworkMatches(stage2, type) {
  const frameworks = ['Hornevian', 'Harmonic', 'ObjectRelations'];
  let count = 0;
  frameworks.forEach((f, i) => {
    const bucket = STAGE2_FRAMEWORK_TYPES[f][stage2.answers[i]];
    if (bucket.includes(type)) count++;
  });
  return count;
}

// Decide which Stage 4 path to run based on Stage 2 + Stage 3 results.
// Returns: { option: 'A'|'B'|'MODIFIED_B', path: 'STANDARD'|'COUNTER_TYPE_CONFIRMED'|'COUNTER_TYPE_AMBIGUOUS',
//           leadType, secondType?, ctKey? }
function resolveStage4Path(scores) {
  const s3 = scores.stage3;
  const s2 = scores.stage2;

  // CT mode with 'BOTH' answer → Modified Option B
  if (s3.mode === 'COUNTER-TYPE' && s3.ctAnswer === 'BOTH') {
    const ctKey = s3.pairKey;
    const ct = STAGE3_CT_PAIRS[ctKey];
    return {
      option: 'MODIFIED_B',
      path: 'COUNTER_TYPE_AMBIGUOUS',
      ctKey,
      leadType: ct.counterType,
      secondType: ct.lookalike,
    };
  }

  // CT mode with CLEAN answer → Option A for the confirmed leading type
  if (s3.mode === 'COUNTER-TYPE' && s3.ctAnswer === 'CLEAN') {
    return {
      option: 'A',
      path: 'COUNTER_TYPE_CONFIRMED',
      leadType: s3.leading,
    };
  }

  // STANDARD mode — decide A vs B based on Stage 3 confidence + Stage 2 alignment.
  const alignmentCount = countFrameworkMatches(s2, s3.leading);
  if (s3.confidence === 'HIGH' && alignmentCount >= 2) {
    return {
      option: 'A',
      path: 'STANDARD',
      leadType: s3.leading,
    };
  }

  // Option B — second candidate is whichever of Stage 2's primary/alternative
  // isn't the Stage 3 leading type. Falls back to Stage 2 alternative.
  const leadType = s3.leading;
  const secondType = (leadType === s2.xrefPrimary) ? s2.xrefAlternative : s2.xrefPrimary;
  return {
    option: 'B',
    path: 'STANDARD',
    leadType,
    secondType,
  };
}

// Build the sequence of question slots the user will fill in Stage 4.
// Each slot: { instrument: 'stress'|'security'|'habit', format: '3opt'|'pairwise', typeNum?, pair? }
// Habit is not included yet — it's appended conditionally based on answers to Stress/Security.
function initialStage4Sequence(pathResolve) {
  if (pathResolve.option === 'A') {
    return [
      { instrument: 'stress',   format: '3opt', typeNum: pathResolve.leadType },
      { instrument: 'security', format: '3opt', typeNum: pathResolve.leadType },
    ];
  }
  if (pathResolve.option === 'B') {
    return [
      { instrument: 'stress',   format: 'pairwise', typeA: pathResolve.leadType, typeB: pathResolve.secondType },
      { instrument: 'security', format: 'pairwise', typeA: pathResolve.leadType, typeB: pathResolve.secondType },
    ];
  }
  // MODIFIED_B — CT comparative
  const ct = STAGE4_CT_COMPARATIVE[pathResolve.ctKey];
  return [
    { instrument: 'stress',   format: 'ct-pairwise', ctKey: pathResolve.ctKey, labelA: 'Counter-type', labelB: 'Lookalike' },
    { instrument: 'security', format: 'ct-pairwise', ctKey: pathResolve.ctKey, labelA: 'Counter-type', labelB: 'Lookalike' },
  ];
}

// Should the Habit question fire given current Stage 4 answers?
// Fires when Stress and Security disagree, or when either was unrecognized
// in Option A, or when answers are slight in pairwise modes.
function shouldFireHabit(pathResolve, answers) {
  if (answers.length < 2) return false;
  const [stressAns, securityAns] = answers;

  if (pathResolve.option === 'A') {
    // 3opt: stressAns is 'correct'|'alt1'|'alt2'. Fire if either Stress or Security is wrong.
    const stressCorrect = stressAns === 'correct';
    const securityCorrect = securityAns === 'correct';
    return !(stressCorrect && securityCorrect); // fire whenever not both clean-correct
  }
  // pairwise + ct-pairwise: 'A'|'A-slight'|'B-slight'|'B'
  const stressLeansA = stressAns === 'A' || stressAns === 'A-slight';
  const securityLeansA = securityAns === 'A' || securityAns === 'A-slight';
  const stressSlight = stressAns === 'A-slight' || stressAns === 'B-slight';
  const securitySlight = securityAns === 'A-slight' || securityAns === 'B-slight';
  // Fire on split or on any slight answer.
  return (stressLeansA !== securityLeansA) || stressSlight || securitySlight;
}

// Stage 4 scoring. Reads state.stage4Sequence and state.stage4Answers.
function computeStage4Scores() {
  const s = state.scores;
  const pr = s.stage4PathResolve;
  const seq = state.stage4Sequence;
  const answers = state.stage4Answers;

  // Stress confirmed? (Did user's answer align with the lead type's correct option?)
  const [stressSlot, securitySlot, habitSlot] = seq;
  const stressAns = answers[0];
  const securityAns = answers[1];
  const habitAns = answers.length > 2 ? answers[2] : null;

  const isLeadAnswer = (slot, ans) => {
    if (!slot || ans == null) return null;
    if (slot.format === '3opt') return ans === 'correct';
    // pairwise & ct-pairwise: Person A = lead (or counter-type); slight counts as leaning.
    return ans === 'A' || ans === 'A-slight';
  };

  const stressConfirmed = isLeadAnswer(stressSlot, stressAns);
  const securityConfirmed = isLeadAnswer(securitySlot, securityAns);
  const habitFired = habitAns != null;
  const habitConfirmed = habitFired ? isLeadAnswer(habitSlot, habitAns) : null;

  // Outcome logic — shared across paths, with a small CT tweak.
  let outcome;
  if (stressConfirmed && securityConfirmed) {
    outcome = 'CONFIRMED';
  } else if (stressConfirmed !== securityConfirmed && habitConfirmed === true) {
    outcome = 'CONFIRMED_WITH_NOTE';
  } else if (!stressConfirmed && !securityConfirmed) {
    // Neither confirmed — Stage 4 architecture strongly points to second candidate.
    outcome = 'REDIRECT';
  } else if (habitFired && habitConfirmed === false) {
    outcome = 'AMBIGUOUS';
  } else {
    // One confirmed, habit not fired (shouldn't normally happen) or unresolved.
    outcome = 'AMBIGUOUS';
  }

  // Describe what the user chose for each instrument (AI-facing).
  const describe = (slot, ans) => {
    if (!slot || ans == null) return null;
    if (slot.format === '3opt') {
      if (ans === 'correct') return `Picked the canonical Type ${slot.typeNum} answer.`;
      return `Picked an alternative energy instead of the canonical Type ${slot.typeNum} answer (${ans}).`;
    }
    if (slot.format === 'pairwise') {
      const map = { 'A':'leaned strongly toward lead', 'A-slight':'slight lean toward lead', 'B-slight':'slight lean toward second candidate', 'B':'leaned strongly toward second candidate' };
      return `${map[ans]} — lead Type ${slot.typeA}, second Type ${slot.typeB}.`;
    }
    // ct-pairwise
    const ct = STAGE4_CT_COMPARATIVE[slot.ctKey];
    const map = { 'A':'leaned strongly toward counter-type', 'A-slight':'slight lean toward counter-type', 'B-slight':'slight lean toward lookalike', 'B':'leaned strongly toward lookalike' };
    return `${map[ans]} — ${ct.label}.`;
  };

  return {
    path: pr.path,
    option: pr.option,
    leadType: pr.leadType,
    secondType: pr.secondType || null,
    ctKey: pr.ctKey || null,
    stressConfirmed,
    securityConfirmed,
    habitConfirmed,
    outcome,
    stressAnswer: stressAns,
    securityAnswer: securityAns,
    habitAnswer: habitAns,
    stressDescription: describe(stressSlot, stressAns),
    securityDescription: describe(securitySlot, securityAns),
    habitDescription: habitFired ? describe(habitSlot, habitAns) : null,
  };
}

// Fisher–Yates shuffle. Returns a permutation of indices 0..n-1.
function shuffleIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Serializes the full Stage 0/1/2/3/4 state into the v2 context block format
// the AI expects. Each section mirrors the {{variable}} slots in the spec.
function buildContextBlock(s) {
  const a0 = state.stage0Answers;
  const s2 = s.stage2;
  const s3 = s.stage3;
  const s4 = s.stage4;

  const boolStr = (v) => v === true ? 'YES' : v === false ? 'NO' : 'N/A';

  const ctStage1Line = s.counterTypeFlag === 'YES'
    ? `Counter-type flag: YES\nCounter-type combination: ${s.counterTypeCombination}`
    : 'Counter-type flag: NO';

  const secondCenterLine = (s.centerConfidence === 'LOW' && s.secondCenter)
    ? `Second candidate Center: ${s.secondCenter}\n`
    : '';

  const crossCenterBlock = s2.crossCenterDivergence
    ? `\n\n⚠ CROSS-CENTER DIVERGENCE (engine-surfaced signal): ${s2.crossCenterNote}`
    : '';

  const secondCandidateLine = s4.secondType
    ? `Second candidate tested: Type ${s4.secondType}\n`
    : '';

  const intake = state.intake || {};
  const clientName = [intake.firstName, intake.lastName].filter(Boolean).join(' ') || 'Not provided';
  const clientOrg = intake.organization || 'Not provided';
  const clientCoach = intake.coach || 'Not provided';
  const finalOpen = state.finalOpenResponse && state.finalOpenResponse.trim()
    ? `"${state.finalOpenResponse.trim()}"`
    : '[none provided]';

  return `CLIENT INFORMATION
==================
Name: ${clientName}
Organization: ${clientOrg}
Coach: ${clientCoach}

CLIENT ASSESSMENT DATA
======================

Stage 0 — Open Text Responses
Self-description (client's own words): "${a0.q1 || 'not provided'}"
How others describe them: "${a0.q2 || 'not provided'}"
Greatest strength: "${a0.q3 || 'not provided'}"
Most problematic quality: "${a0.q4 || 'not provided'}"

Stage 1 — Centers Scoring
Scoring: Rank 1 = 3pts, Rank 2 = 2pts, Rank 3 = 1pt. Maximum per Center: 18. Confidence: HIGH = gap 5+, MEDIUM = gap 3-4, LOW = gap 0-2.
Head Center total: ${s.head} / 18
Heart Center total: ${s.heart} / 18
Body Center total: ${s.body} / 18
Identified Center: ${s.identifiedCenter}
Gap to next Center: ${s.centerGap} points
Center confidence: ${s.centerConfidence}
${secondCenterLine}
Stage 1 — Instinct Scoring
Maximum per Instinct: 12. Confidence: HIGH = gap 4+, MEDIUM = gap 2-3, LOW = gap 0-1.
SP total: ${s.sp} / 12
SO total: ${s.so} / 12
SX total: ${s.sx} / 12
Identified Instinct: ${s.identifiedInstinct}
Gap to next Instinct: ${s.instinctGap} points
Instinct confidence: ${s.instinctConfidence}

Stage 1 — Type Hypotheses
Three type hypotheses from Stage 1: Type ${s.typeHypotheses[0]}, Type ${s.typeHypotheses[1]}, Type ${s.typeHypotheses[2]}
${ctStage1Line}

Stage 2 — Cross-Referencing Results
Q1 Hornevian answer: ${s2.answers[0]} (${STAGE2_BUCKET_LABELS.Hornevian[s2.answers[0]]})
Q2 Harmonic answer: ${s2.answers[1]} (${STAGE2_BUCKET_LABELS.Harmonic[s2.answers[1]]})
Q3 Object Relations answer: ${s2.answers[2]} (${STAGE2_BUCKET_LABELS.ObjectRelations[s2.answers[2]]})

Cross-referencing primary hypothesis: Type ${s2.xrefPrimary}
Cross-referencing live alternative: Type ${s2.xrefAlternative}
Ambiguity axis: ${s2.xrefAmbiguityAxis}
Counter-type mode triggered: ${s2.xrefCounterType}${crossCenterBlock}

Stage 3 — Pairwise Discrimination Results
Mode: ${s3.mode}
Pair tested: ${s3.pair}
Q1 Core Motivation result: ${s3.q1Result}
Q2 Avoidance result: ${s3.q2Result}
Stage 3 leading hypothesis: Type ${s3.leading}
Stage 3 confidence: ${s3.confidence}
Counter-type mode answer: ${s3.ctAnswer}

Stage 4 — Confirmation Results
Path: ${s4.path}
Option: ${s4.option}
Lead type tested: Type ${s4.leadType}
${secondCandidateLine}Stress confirmed: ${boolStr(s4.stressConfirmed)}
Security confirmed: ${boolStr(s4.securityConfirmed)}
Habit of Mind confirmed: ${boolStr(s4.habitConfirmed)}
Stage 4 outcome: ${s4.outcome}

Stage 4 — Answer Details (use for stress_point_description / security_point_description / habit_of_mind_description)
Stress: ${s4.stressDescription || 'not provided'}
Security: ${s4.securityDescription || 'not provided'}
Habit of Mind: ${s4.habitDescription || 'N/A — did not fire'}

Final open response (optional): ${finalOpen}`;
}
// =================== RENDER ===================

function render() {
  updateProgress();
  const app = document.getElementById('app');

  switch (state.phase) {
    case 'welcome':        app.innerHTML = renderWelcome(); break;
    case 'intake':         app.innerHTML = renderIntake(); break;
    case 'stage0':         app.innerHTML = renderStage0(); break;
    case 'stage1':         app.innerHTML = renderStage1(); break;
    case 'stage2':         app.innerHTML = renderStage2(); break;
    case 'stage3':         app.innerHTML = renderStage3(); break;
    case 'stage4':         app.innerHTML = renderStage4(); break;
    case 'finalopen':      app.innerHTML = renderFinalOpen(); break;
    case 'stage1complete': app.innerHTML = renderStage1Complete(); break;
    case 'processing':     app.innerHTML = renderProcessing(); break;
    case 'confirmation':   app.innerHTML = renderConfirmation(); break;
    case 'results':        app.innerHTML = renderResults(); break;
    case 'error':          app.innerHTML = renderError(); break;
  }

  attachHandlers();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Welcome ----
function renderWelcome() {
  return `<div class="screen">
    <div class="welcome-logo">Hive <span>· Enneagram Type Tool</span></div>
    <h1 class="welcome-heading">Discover your<br><strong>Enneagram type.</strong></h1>
    <p class="welcome-body">
      This assessment guides you through a series of questions about how you experience the world, what drives you, and what matters most to you. There are no right or wrong answers — simply respond as honestly as you can.<br><br>
      The process takes about 15–20 minutes. Find a quiet moment and go with your first instinct.
    </p>
    <button class="btn btn-primary" id="btn-start">Start Assessment</button>
  </div>`;
}

// ---- Intake ----
function renderIntake() {
  const i = state.intake || {};
  return `<div class="screen">
    <div class="welcome-logo">Hive <span>· Enneagram Type Tool</span></div>
    <h1 class="welcome-heading" style="font-size:22px;margin-bottom:8px;">Before we begin</h1>
    <p class="welcome-body" style="margin-bottom:28px;">
      Please share a few details so we can send your personalized report to the right place.
    </p>

    <div style="width:100%;max-width:400px;margin:0 auto;text-align:left;">

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#4A6070;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">First Name <span style="color:#f58527;">*</span></label>
        <input id="intake-first-name" type="text" value="${esc(i.firstName || '')}" autocomplete="given-name"
          style="width:100%;box-sizing:border-box;padding:10px 14px;border:1.5px solid var(--border, #D6E2E8);border-radius:6px;font-family:inherit;font-size:14px;color:#1A2B33;outline:none;" />
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#4A6070;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Last Name <span style="color:#f58527;">*</span></label>
        <input id="intake-last-name" type="text" value="${esc(i.lastName || '')}" autocomplete="family-name"
          style="width:100%;box-sizing:border-box;padding:10px 14px;border:1.5px solid var(--border, #D6E2E8);border-radius:6px;font-family:inherit;font-size:14px;color:#1A2B33;outline:none;" />
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#4A6070;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Email Address <span style="color:#f58527;">*</span></label>
        <input id="intake-email" type="email" value="${esc(i.email || '')}" autocomplete="email"
          style="width:100%;box-sizing:border-box;padding:10px 14px;border:1.5px solid var(--border, #D6E2E8);border-radius:6px;font-family:inherit;font-size:14px;color:#1A2B33;outline:none;" />
        <div id="intake-email-error" style="display:none;color:#C44530;font-size:12px;margin-top:4px;">Please enter a valid email address.</div>
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#4A6070;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Organization <span style="color:#7A96A6;font-weight:400;text-transform:none;">(optional)</span></label>
        <input id="intake-organization" type="text" value="${esc(i.organization || '')}" autocomplete="organization"
          style="width:100%;box-sizing:border-box;padding:10px 14px;border:1.5px solid var(--border, #D6E2E8);border-radius:6px;font-family:inherit;font-size:14px;color:#1A2B33;outline:none;" />
      </div>

      <div style="margin-bottom:28px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#4A6070;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Select your coach <span style="color:#f58527;">*</span></label>
        <select id="intake-coach"
          style="width:100%;box-sizing:border-box;padding:10px 14px;border:1.5px solid var(--border, #D6E2E8);border-radius:6px;font-family:inherit;font-size:14px;color:#1A2B33;outline:none;background:#fff;appearance:none;-webkit-appearance:none;background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22><path fill=%22%234A6070%22 d=%22M6 8L0 0h12z%22/></svg>');background-repeat:no-repeat;background-position:right 14px center;">
          <option value="Cai Delumpa" ${i.coach === 'Cai Delumpa' ? 'selected' : ''}>Cai Delumpa</option>
          <option value="Monique Breault" ${i.coach === 'Monique Breault' ? 'selected' : ''}>Monique Breault</option>
        </select>
      </div>

      <div id="intake-error" style="display:none;color:#C44530;font-size:13px;margin-bottom:16px;text-align:center;">Please fill in all required fields.</div>

      <button class="btn btn-primary" id="btn-intake-continue" style="width:100%;">Continue</button>
    </div>
  </div>`;
}

// ---- Confirmation ----
function renderConfirmation() {
  const i = state.intake || {};
  const firstName = i.firstName || 'there';
  const email = i.email || '';
  return `<div class="screen" style="text-align:center;">
    <div style="margin:0 auto;max-width:480px;">
      <div style="font-size:42px;margin-bottom:16px;">✓</div>
      <div class="welcome-logo" style="margin-bottom:16px;">Hive <span>· Enneagram Type Tool</span></div>
      <h1 style="font-family:Georgia,serif;font-size:26px;color:#00b1d7;font-weight:700;margin:0 0 12px;">Thank you, ${esc(firstName)}.</h1>
      <p style="font-family:Georgia,serif;font-size:16px;color:#1A2B33;margin:0 0 16px;line-height:1.7;">
        Your Hive Enneagram Report is on its way.
      </p>
      <p style="font-family:Georgia,serif;font-size:14px;color:#4A6070;line-height:1.7;margin:0;">
        You'll receive an email at <strong style="color:#1A2B33;">${esc(email)}</strong> shortly with your results attached.
        If it doesn't arrive within a few minutes, please check your spam or junk folder.
      </p>
    </div>
  </div>`;
}

// ---- Final Open Question ----
function renderFinalOpen() {
  const val = state.finalOpenResponse || '';
  return `<div class="screen">
    <div class="stage-label">Final Question · Optional</div>
    <div class="q-title">ANYTHING ELSE?</div>
    <div class="q-text" style="margin-bottom:20px;">Is there anything about how you experience the world — what drives you, what you tend to avoid, or what you've learned about yourself — that the assessment didn't quite capture?</div>
    <p style="font-size:13px;color:var(--ink-lt);margin-bottom:16px;font-style:italic;">Optional — skip if nothing comes to mind.</p>
    <textarea class="text-input" id="finalopen-input" placeholder="Type your response here…" style="min-height:130px;">${esc(val)}</textarea>
    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-finalopen-back">Back</button>
      <div class="spacer"></div>
      <button class="btn btn-ghost" id="btn-finalopen-skip" style="margin-right:10px;">Skip</button>
      <button class="btn btn-primary" id="btn-finalopen-submit">Submit</button>
    </div>
  </div>`;
}

// ---- Stage 0 ----
function renderStage0() {
  const q = STAGE0_QUESTIONS[state.stage0Idx];
  const val = state.stage0Answers[q.id] || '';
  const refHtml = q.showRef ? `
    <div class="ref-box">
      <strong>Your words about yourself:</strong> ${esc(state.stage0Answers.q1 || '')}<br>
      <strong>How others describe you:</strong> ${esc(state.stage0Answers.q2 || '')}
    </div>` : '';

  return `<div class="screen">
    <div class="stage-label">Stage 0 of 2 · Warm-Up · ${state.stage0Idx + 1} of 4</div>
    <div class="q-title">${q.title}</div>
    <div class="q-text">${q.text}</div>
    ${refHtml}
    <textarea class="text-input" id="stage0-input" placeholder="Type your response here…">${esc(val)}</textarea>
    <div class="nav-row">
      ${state.stage0Idx > 0 ? '<button class="btn btn-ghost" id="btn-back">Back</button>' : ''}
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${val.trim() ? '' : 'disabled'}>Continue</button>
    </div>
  </div>`;
}

// ---- Stage 1 ----
function renderStage1() {
  const q = STAGE1_QUESTIONS[state.stage1Idx];
  const r = state.stage1Rankings[state.stage1Idx];
  const allRanked = r.a !== null && r.b !== null && r.c !== null;
  const trackLabel = q.type === 'centers' ? 'Centers' : 'Instincts';

  const rankBtns = (letter) => [1, 2, 3].map((rank) =>
    `<button class="rank-btn ${r[letter] === rank ? 'active' : ''}"
      data-rank="${rank}" data-opt="${letter}">
      ${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}
    </button>`
  ).join('');

  const rankClass = (letter) => r[letter] ? `ranked-${r[letter]}` : '';
  const badgeClass = (letter) => r[letter] ? `r${r[letter]}` : '';
  const badgeText = (letter) => r[letter]
    ? (r[letter] === 1 ? '1st — Most like me' : r[letter] === 2 ? '2nd' : '3rd — Least like me')
    : 'Not yet ranked';

  const optHtml = (letter) => `
    <div class="rank-option ${rankClass(letter)}">
      <div class="rank-option-header">
        <span class="rank-badge ${badgeClass(letter)}">${badgeText(letter)}</span>
      </div>
      <div class="rank-option-text">${esc(q.options[letter])}</div>
      <div class="rank-btn-group">${rankBtns(letter)}</div>
    </div>`;

  return `<div class="screen">
    <div class="stage-label">Stage 1 · ${trackLabel} · ${state.stage1Idx + 1} of 10</div>
    <div class="q-title">${q.title}</div>
    <div class="q-text">${q.text}</div>
    <p style="font-size:13px;color:var(--ink-lt);margin-bottom:16px;">Rank each from most like you <strong>(1st)</strong> to least like you <strong>(3rd)</strong>.</p>
    <div class="rank-options">
      ${optHtml('a')}
      ${optHtml('b')}
      ${optHtml('c')}
    </div>
    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-back">Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${allRanked ? '' : 'disabled'}>Continue</button>
    </div>
  </div>`;
}

// ---- Stage 2: Cross-Referencing ----
function renderStage2() {
  const q = STAGE2_QUESTIONS[state.stage2Idx];
  const sel = state.stage2Answers[state.stage2Idx] || null;
  const isLast = state.stage2Idx === STAGE2_QUESTIONS.length - 1;

  const optHtml = (key) => `
    <div class="person-option ${sel === key ? 'selected' : ''}" data-choice="${key}">
      <div class="person-text">${esc(q.options[key])}</div>
    </div>`;

  return `<div class="screen">
    <div class="stage-label">Stage 2 \u00b7 Cross-Referencing \u00b7 ${state.stage2Idx + 1} of ${STAGE2_QUESTIONS.length}</div>
    <div class="q-title">${q.title}</div>
    <div class="q-text">${esc(q.text)}</div>
    <div class="person-options">
      ${optHtml('A')}
      ${optHtml('B')}
      ${optHtml('C')}
    </div>
    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-back">Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${sel ? '' : 'disabled'}>${isLast ? 'Continue' : 'Continue'}</button>
    </div>
  </div>`;
}

// ---- Stage 3: Pairwise Discrimination ----
// Renders whichever Stage 3 question is currently active. The pair and mode
// were resolved when Stage 2 finished (stored on state.scores.stage3Pair).
function renderStage3() {
  const s = state.scores;
  const pair = s.stage3Pair; // { mode, pairKey|ctKey, typeA, typeB, hasAvoidance? }
  const idx = state.stage3Idx;
  const sel = state.stage3Answers[idx] || null;

  // Resolve Person A / Person B content based on mode and current question.
  let stem, personAText, personBText, subtitle;
  if (pair.mode === 'COUNTER-TYPE') {
    const ct = STAGE3_CT_PAIRS[pair.ctKey];
    stem = STAGE3_Q1_STEM;
    personAText = ct.personA;
    personBText = ct.personB;
    subtitle = `Counter-type mode \u00b7 ${ct.label}`;
  } else if (idx === 0) {
    // Standard Q1 — core motivation
    stem = STAGE3_Q1_STEM;
    personAText = STAGE3_CORE_MOTIVATIONS[pair.typeA];
    personBText = STAGE3_CORE_MOTIVATIONS[pair.typeB];
    subtitle = `Type ${pair.typeA} vs. Type ${pair.typeB} \u00b7 Core Motivation`;
  } else {
    // Standard Q2 — avoidance (only on high-ambiguity pairs)
    const av = STAGE3_AVOIDANCE_QUESTIONS[pair.pairKey];
    stem = STAGE3_Q2_STEM;
    personAText = av.personA;
    personBText = av.personB;
    subtitle = `Type ${pair.typeA} vs. Type ${pair.typeB} \u00b7 ${av.label}`;
  }

  const totalQs = pair.mode === 'COUNTER-TYPE' ? 1 : (pair.hasAvoidance ? 2 : 1);
  const isLast = idx === totalQs - 1;

  return `<div class="screen">
    <div class="stage-label">Stage 3 \u00b7 Pairwise Discrimination \u00b7 ${idx + 1} of ${totalQs}</div>
    <div class="q-title">${esc(subtitle)}</div>
    <div class="q-text">${esc(stem)}</div>

    <div class="person-options">
      <div class="person-option ${sel === 'A' ? 'selected' : ''}" data-choice="A">
        <div class="person-label">Person A</div>
        <div class="person-text">${esc(personAText)}</div>
      </div>
      <div class="person-option ${sel === 'B' ? 'selected' : ''}" data-choice="B">
        <div class="person-label">Person B</div>
        <div class="person-text">${esc(personBText)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="person-option ${sel === 'A-slight' ? 'selected' : ''}" data-choice="A-slight" style="text-align:center;">
          <div class="person-label" style="font-size:12px;">Both, but more A</div>
        </div>
        <div class="person-option ${sel === 'B-slight' ? 'selected' : ''}" data-choice="B-slight" style="text-align:center;">
          <div class="person-label" style="font-size:12px;">Both, but more B</div>
        </div>
      </div>
    </div>

    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-back">Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${sel ? '' : 'disabled'}>${isLast ? 'Continue' : 'Continue'}</button>
    </div>
  </div>`;
}

// ---- Stage 4: Confirmation ----
// Renders the current Stage 4 question. Format depends on the slot in
// state.stage4Sequence[state.stage4Idx]:
//   3opt          — single type Stress/Security/Habit with three options, shuffled
//   pairwise      — Option B Person A (lead) vs Person B (second candidate)
//   ct-pairwise   — Modified Option B: Person A (counter-type) vs Person B (lookalike)
function renderStage4() {
  const slot = state.stage4Sequence[state.stage4Idx];
  const sel = state.stage4Answers[state.stage4Idx] || null;
  const totalQs = state.stage4Sequence.length;

  const stemMap = {
    stress: STAGE4_STRESS_STEM,
    security: STAGE4_SECURITY_STEM,
    habit: STAGE4_HABIT_STEM,
  };
  const stem = stemMap[slot.instrument];

  const instrumentLabel = {
    stress: 'Stress Point',
    security: 'Security Point',
    habit: 'Habit of Mind',
  }[slot.instrument];

  let bodyHtml = '';
  let subtitle = '';

  if (slot.format === '3opt') {
    // Ensure a shuffle exists for this question.
    if (!state.stage4Shuffles[state.stage4Idx]) {
      state.stage4Shuffles[state.stage4Idx] = shuffleIndices(3);
    }
    const shuffle = state.stage4Shuffles[state.stage4Idx];
    const dataMap = { stress: STAGE4_STRESS, security: STAGE4_SECURITY, habit: STAGE4_HABIT };
    const options = dataMap[slot.instrument][slot.typeNum];
    const dataIdxToKey = ['correct', 'alt1', 'alt2'];

    subtitle = `Type ${slot.typeNum} \u00b7 ${instrumentLabel}`;
    bodyHtml = shuffle.map((dataIdx) => {
      const key = dataIdxToKey[dataIdx];
      const selected = sel === key ? 'selected' : '';
      return `<div class="person-option ${selected}" data-choice="${key}">
        <div class="person-text">${esc(options[dataIdx])}</div>
      </div>`;
    }).join('');
  } else if (slot.format === 'pairwise') {
    // Option B — lead type (Person A) vs second candidate (Person B). Show
    // the canonical Stress/Security for each type.
    const dataMap = { stress: STAGE4_STRESS, security: STAGE4_SECURITY, habit: STAGE4_HABIT };
    const personAText = dataMap[slot.instrument][slot.typeA][0]; // correct option
    const personBText = dataMap[slot.instrument][slot.typeB][0];
    subtitle = `Type ${slot.typeA} vs. Type ${slot.typeB} \u00b7 ${instrumentLabel}`;
    bodyHtml = render4WayOptions(personAText, personBText, sel);
  } else {
    // ct-pairwise
    const ct = STAGE4_CT_COMPARATIVE[slot.ctKey];
    const block = ct[slot.instrument];
    subtitle = `${ct.label} \u00b7 ${instrumentLabel}`;
    bodyHtml = render4WayOptions(block.personA, block.personB, sel);
  }

  return `<div class="screen">
    <div class="stage-label">Stage 4 \u00b7 Confirmation \u00b7 ${state.stage4Idx + 1} of ${totalQs}</div>
    <div class="q-title">${esc(subtitle)}</div>
    <div class="q-text">${esc(stem)}</div>

    <div class="person-options">
      ${bodyHtml}
    </div>

    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-back">Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${sel ? '' : 'disabled'}>Continue</button>
    </div>
  </div>`;
}

function render4WayOptions(personAText, personBText, sel) {
  return `
    <div class="person-option ${sel === 'A' ? 'selected' : ''}" data-choice="A">
      <div class="person-label">Person A</div>
      <div class="person-text">${esc(personAText)}</div>
    </div>
    <div class="person-option ${sel === 'B' ? 'selected' : ''}" data-choice="B">
      <div class="person-label">Person B</div>
      <div class="person-text">${esc(personBText)}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div class="person-option ${sel === 'A-slight' ? 'selected' : ''}" data-choice="A-slight" style="text-align:center;">
        <div class="person-label" style="font-size:12px;">Both, but more A</div>
      </div>
      <div class="person-option ${sel === 'B-slight' ? 'selected' : ''}" data-choice="B-slight" style="text-align:center;">
        <div class="person-label" style="font-size:12px;">Both, but more B</div>
      </div>
    </div>`;
}

// Helper for renderStage1Complete: renders the Stage 2 output block.
function renderStage2Summary(s) {
  const x = s.stage2;
  const frameworks = ['Hornevian', 'Harmonic', 'ObjectRelations'];
  const rows = frameworks.map((f, i) => {
    const ans = x.answers[i];
    const label = STAGE2_BUCKET_LABELS[f][ans];
    return `${STAGE2_FRAMEWORK_LABELS[f]}: <strong>${label}</strong> (${ans})`;
  }).join('<br>');

  const countRows = s.typeHypotheses.map((t) =>
    `Type ${t}: <strong>${x.counts[t] != null ? x.counts[t] : 0}</strong> framework matches`
  ).join('<br>');

  const ctLine = x.xrefCounterType === 'YES'
    ? `<strong>Counter-type (Stage 2):</strong> YES &nbsp;\u00b7&nbsp; ${CT_COMBOS[`${s.identifiedInstinct}-${x.xrefPrimary}`]}`
    : `<strong>Counter-type (Stage 2):</strong> NO`;

  const divergenceBlock = x.crossCenterDivergence
    ? `<div class="coach-block" style="border-left:3px solid var(--accent, #f58527);">
         <div class="coach-block-label">\u26a0\ufe0f Cross-Center Divergence (stage2_stage3_divergence)</div>
         <div class="coach-block-text">${esc(x.crossCenterNote)}</div>
       </div>`
    : '';

  return `
    <div class="section-heading">Stage 2 \u00b7 Cross-Referencing</div>

    <div class="coach-block">
      <div class="coach-block-label">Framework Answers</div>
      <div class="coach-block-text">${rows}</div>
    </div>

    <div class="coach-block">
      <div class="coach-block-label">Framework Match Counts</div>
      <div class="coach-block-text">${countRows}</div>
    </div>

    <div class="coach-block">
      <div class="coach-block-label">Cross-Referencing Result</div>
      <div class="coach-block-text">
        <strong>Primary:</strong> Type ${x.xrefPrimary} \u2014 ${TYPE_NAMES[x.xrefPrimary]}<br>
        <strong>Alternative:</strong> Type ${x.xrefAlternative} \u2014 ${TYPE_NAMES[x.xrefAlternative]}<br>
        <strong>Ambiguity axis:</strong> ${esc(x.xrefAmbiguityAxis)}<br>
        ${ctLine}
      </div>
    </div>

    ${divergenceBlock}
  `;
}

// Helper for renderStage1Complete: renders the Stage 3 output block.
function renderStage3Summary(s) {
  const r = s.stage3;
  const q2Line = r.q2Answer
    ? `<strong>Q2 (avoidance):</strong> ${esc(r.q2Result)}<br>`
    : '';
  return `
    <div class="section-heading">Stage 3 \u00b7 Pairwise Discrimination</div>

    <div class="coach-block">
      <div class="coach-block-label">Mode &amp; Pair</div>
      <div class="coach-block-text">
        <strong>Mode:</strong> ${r.mode}<br>
        <strong>Pair:</strong> ${r.pair}
      </div>
    </div>

    <div class="coach-block">
      <div class="coach-block-label">Answers</div>
      <div class="coach-block-text">
        <strong>Q1 (core motivation):</strong> ${esc(r.q1Result)}<br>
        ${q2Line}
        ${r.mode === 'COUNTER-TYPE' ? `<strong>CT answer:</strong> ${r.ctAnswer}` : ''}
      </div>
    </div>

    <div class="coach-block">
      <div class="coach-block-label">Stage 3 Result</div>
      <div class="coach-block-text">
        <strong>Leading:</strong> Type ${r.leading} \u2014 ${TYPE_NAMES[r.leading]}<br>
        <strong>Confidence:</strong> ${r.confidence}
      </div>
    </div>
  `;
}

// Helper for renderStage1Complete: renders the Stage 4 output block.
function renderStage4Summary(s) {
  const r = s.stage4;
  const boolLabel = (v) => v === true ? '\u2713 confirmed' : v === false ? '\u2717 unrecognized' : '\u2014 N/A';
  const habitLine = r.habitConfirmed != null
    ? `<strong>Habit of Mind:</strong> ${boolLabel(r.habitConfirmed)}<br>`
    : '';
  const habitDescLine = r.habitDescription
    ? `<strong>Habit detail:</strong> ${esc(r.habitDescription)}<br>`
    : '';

  return `
    <div class="section-heading">Stage 4 \u00b7 Confirmation</div>

    <div class="coach-block">
      <div class="coach-block-label">Path &amp; Option</div>
      <div class="coach-block-text">
        <strong>Path:</strong> ${r.path}<br>
        <strong>Option:</strong> ${r.option}<br>
        <strong>Lead type:</strong> Type ${r.leadType} \u2014 ${TYPE_NAMES[r.leadType]}
        ${r.secondType ? `<br><strong>Second candidate:</strong> Type ${r.secondType} \u2014 ${TYPE_NAMES[r.secondType]}` : ''}
      </div>
    </div>

    <div class="coach-block">
      <div class="coach-block-label">Confirmation Results</div>
      <div class="coach-block-text">
        <strong>Stress:</strong> ${boolLabel(r.stressConfirmed)}<br>
        <strong>Security:</strong> ${boolLabel(r.securityConfirmed)}<br>
        ${habitLine}
      </div>
    </div>

    <div class="coach-block">
      <div class="coach-block-label">Answer Detail</div>
      <div class="coach-block-text">
        <strong>Stress detail:</strong> ${esc(r.stressDescription)}<br>
        <strong>Security detail:</strong> ${esc(r.securityDescription)}<br>
        ${habitDescLine}
      </div>
    </div>

    <div class="coach-block">
      <div class="coach-block-label">Stage 4 Outcome</div>
      <div class="coach-block-text"><strong>${r.outcome}</strong></div>
    </div>
  `;
}

// ---- Stage 1 Complete (all four stages wired; placeholder until report is built) ----
function renderStage1Complete() {
  const s = state.scores;
  const centerCol = (name, score) => {
    const isPrimary = name === s.identifiedCenter;
    const isSecond = name === s.secondCenter;
    const tag = isPrimary ? ' · primary' : isSecond ? ' · second' : '';
    return `<div class="score-card">
      <div class="score-card-label">${name}${tag}</div>
      <div class="score-card-value">${score} / 18</div>
      <div class="score-bar-wrap"><div class="score-bar" style="width:${Math.round(score / 18 * 100)}%"></div></div>
    </div>`;
  };

  const ctLine = s.counterTypeFlag === 'YES'
    ? `<strong>Counter-type flag:</strong> YES &nbsp;·&nbsp; ${s.counterTypeCombination}`
    : `<strong>Counter-type flag:</strong> NO`;

  return `<div class="screen">
    <div class="results-logo">Hive · Enneagram Type Tool</div>

    <div class="section-heading">Stage 1 Complete</div>
    <p style="color:var(--ink-lt);font-size:14px;margin-bottom:24px;">
      Stages 2, 3, and 4 are under construction. The output below is what Stage 1
      produces for the AI engine — shown here so we can verify the scoring before
      the next stages are wired up.
    </p>

    <div class="coach-block">
      <div class="coach-block-label">Identified Center</div>
      <div class="coach-block-text">
        <strong>${s.identifiedCenter}</strong> &nbsp;·&nbsp; gap ${s.centerGap} &nbsp;·&nbsp; ${s.centerConfidence} confidence
        ${s.secondCenter ? `<br><span style="color:var(--ink-lt);">Second candidate Center: ${s.secondCenter}</span>` : ''}
      </div>
    </div>

    <div class="coach-block">
      <div class="coach-block-label">Identified Instinct</div>
      <div class="coach-block-text">
        <strong>${s.identifiedInstinct}</strong> &nbsp;·&nbsp; gap ${s.instinctGap} &nbsp;·&nbsp; ${s.instinctConfidence} confidence
      </div>
    </div>

    <div class="coach-block">
      <div class="coach-block-label">Three Type Hypotheses</div>
      <div class="coach-block-text">
        ${s.typeHypotheses.map((t) => `Type ${t} — ${TYPE_NAMES[t]}`).join('<br>')}
      </div>
    </div>

    <div class="coach-block">
      <div class="coach-block-label">Counter-Type (Stage 1)</div>
      <div class="coach-block-text">${ctLine}</div>
    </div>

    ${s.stage2 ? renderStage2Summary(s) : ''}
    ${s.stage3 ? renderStage3Summary(s) : ''}
    ${s.stage4 ? renderStage4Summary(s) : ''}

    <div class="section-heading">Stage 1 Scores</div>
    <div class="scores-grid">
      ${centerCol('Head', s.head)}
      ${centerCol('Heart', s.heart)}
      ${centerCol('Body', s.body)}
      <div class="score-card">
        <div class="score-card-label">SP · SO · SX</div>
        <div class="score-card-value" style="font-size:16px;">${s.sp} · ${s.so} · ${s.sx}</div>
      </div>
    </div>

    <div class="nav-row" style="margin-top:32px;">
      <button class="btn btn-ghost" id="btn-restart">Start over</button>
      <div class="spacer"></div>
    </div>
  </div>`;
}

// ---- Processing ----
function renderProcessing() {
  return `<div class="screen">
    <div class="processing-wrap">
      <div class="spinner"></div>
      <div class="processing-heading">Preparing your results…</div>
      <div class="processing-sub">This usually takes about 60 seconds.<br>Please keep this window open.</div>
    </div>
  </div>`;
}

// ---- Results ----
// Two-tab Client/Coach view. The same body HTML is reused for the downloadable
// standalone reports (wrapped in a <!DOCTYPE html> shell by buildClientHTML /
// buildCoachHTML). The report bodies use inline styles so they render the same
// way inside the app and inside a downloaded file.
function renderResults() {
  const r = state.apiResult;
  const h = r.hypothesis;
  const tab = state.resultsTab || 'client';

  // Strip any "Type N — " prefix the AI may have included in confirmed_type_name
  const typeName = TYPE_NAMES[h.confirmed_type] || (h.confirmed_type_name || '').replace(/^Type\s*\d+\s*[—–-]+\s*/i, '').trim() || '';

  const instinctLabel = (h.confirmed_instinct && h.confirmed_instinct !== 'UNCERTAIN') ? ` ${h.confirmed_instinct}` : '';
  const badge = confidenceBadgeHtml(h.confidence_level);
  const secondCandidate = h.second_candidate_type
    ? `<span style="font-size:12px;color:var(--ink-mid);">Second candidate: Type ${h.second_candidate_type}</span>`
    : '';

  const tabStyle = (active, color) => `padding:12px 20px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:${active ? 700 : 500};letter-spacing:0.02em;color:${active ? color : 'var(--ink-mid)'};border-bottom:3px solid ${active ? color : 'transparent'};transition:all 0.15s;`;

  const body = tab === 'coach' ? coachReportBodyHtml(r) : clientReportBodyHtml(r);

  return `<div class="screen" style="max-width:920px;">
    <!-- Top bar -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:10px 10px 0 0;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <span style="font-size:13px;font-weight:700;color:var(--teal);letter-spacing:0.08em;text-transform:uppercase;">Hive Typing Engine</span>
        <span style="color:var(--border);">|</span>
        <span style="font-size:13px;color:var(--ink-mid);">Type ${h.confirmed_type}${instinctLabel} \u2014 ${esc(typeName)}</span>
        ${badge}
        ${secondCandidate}
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-download-client" style="padding:7px 14px;border-radius:4px;border:1px solid var(--teal);background:#fff;color:var(--teal);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:0.05em;">\u2193 Client Report</button>
        <button class="btn-download-coach" style="padding:7px 14px;border-radius:4px;border:1px solid var(--accent);background:#fff;color:var(--accent);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:0.05em;">\u2193 Coach Report</button>
        <button class="btn-new-analysis" style="padding:7px 14px;border-radius:4px;border:1px solid var(--border);background:#fff;color:var(--ink-mid);font-family:inherit;font-size:12px;cursor:pointer;">New Analysis</button>
      </div>
    </div>

    <!-- Tabs -->
    <div style="background:#fff;border-left:1px solid var(--border);border-right:1px solid var(--border);padding:0 20px;display:flex;gap:0;">
      <button class="btn-tab-client" style="${tabStyle(tab === 'client', 'var(--teal)')}">Client Report</button>
      <button class="btn-tab-coach" style="${tabStyle(tab === 'coach', 'var(--accent)')}">Coach Report</button>
    </div>

    <!-- Body -->
    <div style="background:var(--cream);border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;padding:28px 20px;">
      ${body}
    </div>
  </div>`;
}

function confidenceBadgeHtml(level) {
  // Gradient green \u2192 light amber \u2192 amber \u2192 red.
  const map = {
    HIGH:        { bg: '#D4EDDA', fg: '#2D6A4F' }, // green
    MEDIUM_HIGH: { bg: '#FFF9E6', fg: '#A17E23' }, // pale amber
    MEDIUM:      { bg: '#FFF3CD', fg: '#856404' }, // amber
    LOW:         { bg: '#F8D7DA', fg: '#842029' }, // red
  };
  const c = map[level] || { bg: '#F5F9FB', fg: '#4A6070' };
  const text = (level || '').replace('_', '-');
  return `<span style="display:inline-block;padding:3px 12px;border-radius:20px;background:${c.bg};color:${c.fg};font-weight:700;font-size:12px;letter-spacing:0.05em;">${text}</span>`;
}

function reportSectionHtml(title, color) {
  return `<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${color};margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid ${color};">${esc(title)}</div>`;
}

// Body HTML for the Client Report — warm, client-facing. Inline styles only so
// this same string can be wrapped in a standalone HTML document for download.
function clientReportBodyHtml(result) {
  const h = result.hypothesis;
  const cf = result.client_facing || {};
  const ambiguous = h.stage4_outcome === 'AMBIGUOUS';

  // Strip any "Type N — " prefix the AI may have included in confirmed_type_name
  const typeName = TYPE_NAMES[h.confirmed_type] || (h.confirmed_type_name || '').replace(/^Type\s*\d+\s*[—–-]+\s*/i, '').trim() || '';

  const tLib = typeData(h.confirmed_type) || {};
  const primers = (typeLibrary && typeLibrary.static_primers) || {};
  const instinctKey = (h.confirmed_instinct || '').toLowerCase();

  const SH = (title) => `<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#00b1d7;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #00b1d7;">${esc(title)}</div>`;
  const SUB = (title) => `<div style="font-size:10px;font-weight:700;color:#00b1d7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${esc(title)}</div>`;
  const EVIDENCE = (text) => text ? `<div style="font-size:12px;color:#4A6070;font-style:italic;margin:0 0 14px;">In your responses: ${renderMultiPara(text, 'display:inline;')}</div>` : '';

  const header = ambiguous
    ? `<div style="font-size:28px;font-weight:700;color:#00b1d7;line-height:1.2;margin-bottom:12px;">A Genuinely Complex Pattern</div>`
    : `<div style="font-size:42px;font-weight:700;color:#00b1d7;line-height:1.1;margin-bottom:4px;">Type ${h.confirmed_type}</div>
       <div style="font-size:20px;color:#4A6070;margin-bottom:12px;">${esc(typeName)}</div>`;

  const noteText = ambiguous
    ? `Your responses reflect a genuinely complex pattern — one that resonates with more than one Enneagram type in meaningful ways. This isn’t a limitation of the assessment; it’s an honest finding about you. Rather than offering a premature hypothesis, we’d like to invite you into a conversation with your Enneagram coach or practitioner where this complexity can be explored properly.`
    : `Based on your responses, the pattern that appears most consistent with your experience is <strong>Type ${h.confirmed_type} — ${esc(typeName)}</strong>. We encourage you to hold this as a hypothesis or theory that you get to test ‘in the wild’. That’s the fun part. If it resonates, wonderful. If it doesn’t fully fit, that’s important information too. Debriefing this report with a trained Enneagram coach or practitioner like Cai or Monique is a great place to explore what fits, what doesn’t, and why.`;

  const instinctLabelMap = { sp: 'Self-Preservation', sx: 'One-to-One', so: 'Social' };
  const instinctLabel = instinctLabelMap[instinctKey] || h.confirmed_instinct || '';

  const strengthsHtml = (tLib.strengths || []).map((s) =>
    `<div style="font-size:13px;margin-bottom:5px;"><span style="color:#00b1d7;font-weight:700;">+</span> ${esc(s)}</div>`
  ).join('');
  const challengesHtml = (tLib.challenges || []).map((c) =>
    `<div style="font-size:13px;margin-bottom:5px;"><span style="color:#f58527;font-weight:700;">–</span> ${esc(c)}</div>`
  ).join('');

  const tipsHtml = (tLib.development_tips || []).map((tip, i) =>
    `<div style="padding:8px 14px;margin-bottom:6px;background:#F5F9FB;border-radius:4px;font-size:13px;display:flex;gap:10px;">
       <span style="color:#00b1d7;font-weight:700;">${i + 1}.</span>
       <span>${esc(tip)}</span>
     </div>`
  ).join('');

  const patternsHtml = !ambiguous ? `
    ${SH('Patterns of Thinking, Feeling, and Behaving')}
    <p style="margin:0 0 14px;">Your core motivation doesn’t just live in the background — it expresses itself as recognizable patterns of thinking, feeling, and behaving that show up consistently across different areas of your life.</p>
    ${SUB(`Thinking Patterns of a Type ${h.confirmed_type} — ${esc(typeName)}`)}
    ${renderParas(tLib.patterns_of_thinking)}
    ${SUB(`Feeling Patterns of a Type ${h.confirmed_type} — ${esc(typeName)}`)}
    ${renderParas(tLib.patterns_of_feeling)}
    ${SUB(`Behavior Patterns of a Type ${h.confirmed_type} — ${esc(typeName)}`)}
    ${renderParas(tLib.patterns_of_behaving)}
  ` : '';

  const instinctBody = tLib.instincts && tLib.instincts[instinctKey]
    ? renderParas(tLib.instincts[instinctKey])
    : '';

  const wingLow = tLib.wing_low || {};
  const wingHigh = tLib.wing_high || {};
  const wingsHtml = !ambiguous ? `
    ${SH('Wing Influence')}
    ${SUB('About Wings')}
    ${renderParas((primers.wing_primer || {}).body)}
    ${wingLow.name ? `${SUB(`${esc(wingLow.name)} — Type ${wingLow.number}`)}${renderParas(wingLow.body)}` : ''}
    ${wingHigh.name ? `${SUB(`${esc(wingHigh.name)} — Type ${wingHigh.number}`)}${renderParas(wingHigh.body)}` : ''}
  ` : '';

  const secondaryHtml = (cf.secondary_type_narrative && !ambiguous) ? `
    ${SH('Secondary Type Hypothesis')}
    <div style="font-style:italic;background:#DFF0F7;padding:14px 18px;border-radius:6px;border-left:4px solid #00b1d7;color:#1A2B33;margin:0 0 14px;line-height:1.7;">${renderMultiPara(cf.secondary_type_narrative, 'margin:0 0 10px;')}</div>
  ` : '';

  const exploreQuestions = cf.what_to_explore || [];
  const exploreHtml = exploreQuestions.length > 0 ? `
    ${SH('What to Explore With Your Enneagram Coach or Practitioner')}
    <p style="color:#4A6070;margin:0 0 10px;font-size:13px;">These questions are designed to help you get the most out of your work with a coach or practitioner. Take a moment to sit with each one before your session.</p>
    ${exploreQuestions.map((q, i) => `
      <div style="padding:8px 14px;margin-bottom:6px;background:#F5F9FB;border-radius:4px;font-size:13px;display:flex;gap:10px;">
        <span style="color:#00b1d7;font-weight:700;">${i + 1}.</span>
        <span>${esc(q)}</span>
      </div>`).join('')}
  ` : '';

  return `
    <div style="font-family:Georgia,serif;color:#1A2B33;line-height:1.6;font-size:13px;">

      <!-- HEADER -->
      <div style="text-align:center;padding-bottom:24px;margin-bottom:28px;border-bottom:3px solid #00b1d7;">
        <div style="font-size:11px;color:#7A96A6;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Your Enneagram</div>
        ${header}
      </div>

      <!-- ABOUT THE ENNEAGRAM -->
      ${SH('About the Enneagram')}
      ${renderParas((primers.enneagram_intro || {}).body)}

      <!-- A NOTE ON THIS RESULT -->
      ${SH('A Note on This Result')}
      <p style="font-style:italic;margin:0 0 14px;">${noteText}</p>

      <!-- WHAT WE NOTICED ABOUT YOU -->
      ${SH('What We Noticed About You')}
      <div style="font-style:italic;background:#DFF0F7;padding:14px 18px;border-radius:6px;border-left:4px solid #00b1d7;color:#1A2B33;margin:0 0 14px;line-height:1.7;">${renderMultiPara(cf.client_narrative, 'margin:0 0 10px;')}</div>

      ${!ambiguous ? `
        <!-- YOUR TYPE AT A GLANCE -->
        ${SH('Your Type at a Glance')}
        ${tLib.how_you_see_the_world ? `${SUB('How You See the World')}<p style="margin:0 0 14px;">${esc(tLib.how_you_see_the_world)}</p>` : ''}
        ${tLib.core_motivation ? `${SUB('Core Motivation')}${renderParas(tLib.core_motivation)}` : ''}
        ${cf.core_motivation_evidence ? EVIDENCE(cf.core_motivation_evidence) : ''}

        <!-- PATTERNS -->
        ${patternsHtml}

        <!-- STRENGTHS & CHALLENGES -->
        ${(tLib.strengths && tLib.strengths.length && tLib.challenges && tLib.challenges.length) ? `
          <p style="margin:0 0 10px;font-size:13px;color:#1A2B33;">These patterns give rise to a distinctive set of strengths and challenges. The ones below are characteristic of Type ${h.confirmed_type} — you may recognize some more than others, and that recognition itself is useful information.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 14px;">
            <div style="background:#DFF0F7;padding:12px 16px;border-radius:6px;">
              <div style="font-size:10px;font-weight:700;color:#00b1d7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Strengths</div>
              ${strengthsHtml}
            </div>
            <div style="background:#FFF8F0;padding:12px 16px;border-radius:6px;">
              <div style="font-size:10px;font-weight:700;color:#f58527;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Challenges</div>
              ${challengesHtml}
            </div>
          </div>
        ` : ''}

        <!-- DEVELOPMENT TIPS -->
        ${tipsHtml ? `
          ${SH('Development Tips')}
          <p style="color:#4A6070;margin:0 0 10px;font-size:13px;">These practices can help you leverage your strengths and address the patterns that can hold you back.</p>
          ${tipsHtml}
        ` : ''}

        <!-- ABOUT THE INSTINCTS -->
        ${SH('About the Instincts')}
        ${renderParas((primers.instinct_primer || {}).body)}

        <!-- YOUR INSTINCT -->
        ${instinctBody ? `
          ${SH('Your Instinct — ' + instinctLabel)}
          ${instinctBody}
          ${cf.instinct_personal_overlay ? EVIDENCE(cf.instinct_personal_overlay) : ''}
        ` : ''}

        <!-- HOW YOUR TYPE MOVES THROUGH STRESS AND EASE -->
        ${SH('How Your Type Moves Through Stress and Ease')}
        ${renderParas((primers.stress_security_primer || {}).body)}
        ${cf.stress_point_narrative ? `${SUB('Under Stress')}${renderMultiPara(cf.stress_point_narrative)}` : ''}
        ${cf.security_point_narrative ? `${SUB('When at Ease')}${renderMultiPara(cf.security_point_narrative)}` : ''}

        <!-- WING INFLUENCE -->
        ${wingsHtml}

        <!-- SECONDARY TYPE HYPOTHESIS (conditional) -->
        ${secondaryHtml}
      ` : ''}

      <!-- WHAT TO EXPLORE -->
      ${exploreHtml}

      <!-- FOOTER -->
      <div style="margin-top:40px;padding-top:16px;border-top:2px solid #00b1d7;text-align:center;font-size:11px;color:#7A96A6;">
        Generated by the Hive Enneagram Typing Engine &nbsp;·&nbsp; © Copyright 2026, Hive, Inc. All rights reserved.
      </div>

      <!-- PRINT FOOTER (fixed, every page) -->
      <div class="print-footer">
        <span>© Copyright 2026, Hive, Inc. All rights reserved.</span>
        <span class="page-number">Page </span>
      </div>
    </div>
  `;
}
// Body HTML for the Coach Report — confidential, coach-facing. Orange styling.
function coachReportBodyHtml(result) {
  const h = result.hypothesis;
  const cr = result.coach_report || {};
  const flags = result.flags || [];
  const s0 = result.stage0_analysis || {};
  const s2a = result.stage2_analysis || {};
  const s4a = result.stage4_analysis || {};
  const scores = state.scores || {};

  // Strip any "Type N — " prefix the AI may have included in confirmed_type_name
  const typeName = TYPE_NAMES[h.confirmed_type] || (h.confirmed_type_name || '').replace(/^Type\s*\d+\s*[—–-]+\s*/i, '').trim() || '';

  const ORANGE = '#f58527';
  const SH = (title) => `<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ORANGE};margin:32px 0 12px;padding-bottom:6px;border-bottom:2px solid ${ORANGE};">${esc(title)}</div>`;
  const SUBH = (title) => `<div style="font-size:10px;font-weight:700;color:${ORANGE};text-transform:uppercase;letter-spacing:0.08em;margin:18px 0 8px;">${esc(title)}</div>`;
  const PROBE = (text) => text ? `<div style="background:#FAF6F2;padding:10px 14px;border-radius:4px;font-style:italic;color:#1A2B33;margin:6px 0;border-left:3px solid ${ORANGE};">${esc(text)}</div>` : '';
  const BULLETS = (arr) => arr && arr.length ? `<ul style="margin:0 0 14px 0;padding-left:20px;">${arr.map((b) => `<li style="margin-bottom:8px;line-height:1.55;">${esc(b)}</li>`).join('')}</ul>` : '';
  const CALLOUT = (content, warning) => {
    const bg = warning ? '#F9E0DC' : '#FDE8D4';
    const border = warning ? '#C44530' : ORANGE;
    return `<div style="background:${bg};padding:14px 18px;border-radius:6px;border-left:4px solid ${border};margin:0 0 16px;">${content}</div>`;
  };
  const CALLOUT_TITLE = (text, warning) => `<div style="font-size:12px;font-weight:700;color:${warning ? '#C44530' : ORANGE};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${esc(text)}</div>`;

  // Instinct labels
  const instinctKey = (h.confirmed_instinct || '').toLowerCase();
  const instinctFull = { sp: 'Self-Preservation (SP)', sx: 'One-to-One (SX)', so: 'Social (SO)' }[instinctKey] || h.confirmed_instinct || 'Unknown';
  const confLabel = (h.confidence_level || '').replace(/_/g, '-');

  // Meta table
  const metaRow = (label, value, style) => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:1px solid #EFE8E0;">
      <span style="font-size:11px;color:#7A96A6;letter-spacing:0.05em;text-transform:uppercase;font-weight:700;">${esc(label)}</span>
      <span style="font-size:14px;color:${style || '#1A2B33'};font-weight:600;">${value}</span>
    </div>`;

  const s1 = cr.section1 || {};
  const s1a = cr.section1a || null;
  const s2 = cr.section2 || {};
  const s3 = cr.section3 || {};
  const s4 = cr.section4 || {};
  const s5 = cr.section5 || {};
  const s6 = cr.section6 || {};
  const s6a = cr.section6a || null;

  // Centers bar chart — from state.scores
  const centerScoreMap = { Body: scores.body || 0, Heart: scores.heart || 0, Head: scores.head || 0 };
  const identifiedCenter = scores.identifiedCenter || '';
  const totalCenter = 18;
  const centerBar = (name, score) => {
    const pct = Math.round(score / totalCenter * 100);
    const isId = name === identifiedCenter;
    const fillClass = isId ? 'background:#f58527;' : (pct >= 44 ? 'background:#F5B988;' : 'background:#FBDDC2;');
    return `<div style="display:grid;grid-template-columns:160px 1fr 60px;gap:10px;align-items:center;margin-bottom:10px;font-size:13px;">
      <span style="font-weight:${isId ? '700' : '600'};color:${isId ? ORANGE : '#1A2B33'};">${esc(name)} Center${isId ? ' ●' : ''}</span>
      <div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#EFE8E0;border-radius:3px;height:14px;overflow:hidden;"><div style="${fillClass}height:100%;border-radius:3px;width:${pct}%;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div></div>
      <span style="color:#4A6070;font-size:12px;text-align:right;">${score} / ${totalCenter}</span>
    </div>`;
  };

  // Instinct bar chart — from state.scores
  const instinctScores = scores.sortedInstincts || [];
  const instinctTotal = 12;
  const instinctBar = (name, score) => {
    const pct = Math.round(score / instinctTotal * 100);
    const isId = name === (h.confirmed_instinct || '');
    const fillStyle = isId ? 'background:#f58527;' : (pct >= 50 ? 'background:#F5B988;' : 'background:#FBDDC2;');
    const label = { SP: 'Self-Preservation', SO: 'Social', SX: 'One-to-One' }[name] || name;
    return `<div style="display:grid;grid-template-columns:160px 1fr 60px;gap:10px;align-items:center;margin-bottom:10px;font-size:13px;">
      <span style="font-weight:${isId ? '700' : '600'};color:${isId ? ORANGE : '#1A2B33'};">${esc(label)}${isId ? ' ●' : ''}</span>
      <div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#EFE8E0;border-radius:3px;height:14px;overflow:hidden;"><div style="${fillStyle}height:100%;border-radius:3px;width:${pct}%;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div></div>
      <span style="color:#4A6070;font-size:12px;text-align:right;">${score} / ${instinctTotal}</span>
    </div>`;
  };

  // Confusion flags check for Section 6A
  const confusionFlagTypes = ['lookalike_ambiguity', 'stage2_stage3_divergence', 'framework_cluster_mismatch', 'low_center_confidence'];
  const hasConfusionFlags = flags.some((f) => confusionFlagTypes.includes(f.flag_type)) || h.stage4_outcome === 'AMBIGUOUS';
  const show6A = hasConfusionFlags && h.stage4_outcome !== 'REDIRECT' && s6a !== null;

  // Framework signals (Section 3)
  const frameworkSignals = (s3.framework_signals || []).map((sig) => `
    ${CALLOUT(`
      ${CALLOUT_TITLE(sig.label)}
      ${BULLETS(sig.bullets)}
      ${PROBE(sig.probe)}
    `)}
  `).join('');

  return `
    <div style="background:#fff;border-radius:10px;padding:36px 40px;box-shadow:0 1px 10px rgba(0,0,0,0.04);font-family:Georgia,serif;color:#1A2B33;line-height:1.6;font-size:13px;max-width:760px;margin:0 auto;">

      <!-- HEADER -->
      <div style="text-align:center;padding-bottom:24px;margin-bottom:28px;border-bottom:3px solid ${ORANGE};">
        <div style="font-size:11px;color:#7A96A6;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Coach Prep Report</div>
        <div style="font-size:42px;font-weight:700;color:${ORANGE};line-height:1.1;margin-bottom:4px;">Type ${h.confirmed_type} · ${h.confirmed_instinct}</div>
        <div style="font-size:20px;color:#4A6070;margin-bottom:12px;">${esc(s4.subtype_name || '')}</div>
        <span style="display:inline-block;padding:3px 12px;border-radius:20px;background:#FFF9E6;color:#A17E23;font-weight:700;font-size:11px;letter-spacing:0.05em;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${esc(confLabel)} CONFIDENCE</span>
      </div>

      <!-- HOW TO USE -->
      <p style="font-size:12px;color:#4A6070;font-style:italic;margin:0 0 20px;background:#FAF6F2;padding:12px 16px;border-radius:6px;">This report is designed as a session prep tool — organized around the debrief conversation you'll have with your client, not around how the assessment engine arrived at its hypothesis. Read Section 1 for the quick read. Use Sections 2 through 5 as a companion during the debrief itself. Section 6 offers contingency guidance depending on how the conversation unfolds.</p>

      <!-- SECTION 1 — YOUR READ -->
      ${SH('1 · Your Read on This Client')}
      <div style="background:#FAF6F2;padding:16px 20px;border-radius:6px;margin-bottom:16px;">
        ${metaRow('Primary Hypothesis', `Type ${h.confirmed_type} — ${esc(typeName)}`)}
        ${metaRow('Dominant Instinct', instinctFull)}
        ${metaRow('Confidence', confLabel, '#A17E23')}
        ${metaRow('Alternate to Hold Lightly', h.second_candidate_type ? `Type ${h.second_candidate_type} — ${esc(TYPE_NAMES[h.second_candidate_type] || '')}` : 'None identified')}
        ${metaRow('Counter-Type', h.counter_type_confirmed ? `Confirmed — ${esc(h.counter_type_combination || '')}` : 'Not flagged', h.counter_type_confirmed ? ORANGE : '#4A6070')}
      </div>

      ${SUBH('The Read')}
      <p style="margin:0 0 14px;">${esc(s1.the_read || '')}</p>
      ${SUBH('Going In')}
      ${BULLETS(s1.going_in)}

      ${s1a ? `
        <!-- SECTION 1A — COUNTER-TYPE -->
        ${SH('1A · Counter-Type Considerations')}
        ${SUBH('Why This Matters')}
        ${BULLETS(s1a.why_this_matters)}
        ${SUBH('Standard vs. Counter-Type Presentation')}
        ${BULLETS(s1a.standard_vs_counter)}
        ${SUBH('Coaching Notes')}
        ${BULLETS(s1a.coaching_notes)}
      ` : ''}

      <!-- SECTION 2 — CORE MOTIVATION -->
      ${SH('2 · Debriefing Core Motivation and Worldview')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">How to present the heart of the type and connect it to their own words.</p>
      ${SUBH('The Core Pattern')}
      ${BULLETS(s2.core_pattern)}
      ${SUBH('What Their Responses Showed')}
      ${BULLETS(s2.what_responses_showed)}
      ${SUBH('Coaching Notes')}
      ${BULLETS(s2.coaching_notes)}
      ${PROBE(s2.probe)}

      <!-- SECTION 3 — PATTERNS -->
      ${SH('3 · Debriefing Patterns of Thinking, Feeling, and Behaving')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">What to expect and what to watch for as you walk through type patterns.</p>

      ${SUBH('Centers of Intelligence')}
      <div style="background:#FAF6F2;padding:14px 18px;border-radius:6px;margin-bottom:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        ${centerBar('Body', centerScoreMap.Body)}
        ${centerBar('Heart', centerScoreMap.Heart)}
        ${centerBar('Head', centerScoreMap.Head)}
      </div>

      ${SUBH('Likely to Resonate Easily')}
      ${BULLETS((typeData(h.confirmed_type) || {}).strengths || [])}

      ${SUBH('May Take More Careful Unpacking')}
      ${BULLETS((typeData(h.confirmed_type) || {}).challenges || [])}

      ${s3.hardest_to_see && s3.hardest_to_see.length ? `${SUBH('May Be Hardest to See')}${BULLETS(s3.hardest_to_see)}` : ''}

      ${frameworkSignals ? `
        ${SUBH('How the Client Appears to Move — The Three Framework Signals')}
        <p style="margin:0 0 14px;font-size:12px;color:#4A6070;font-style:italic;">These are cross-referenced patterns that showed up consistently in their responses. Each offers a different lens on the type — worth weaving in conversationally rather than introducing as categories.</p>
        ${frameworkSignals}
      ` : ''}

      ${SUBH('Coaching Notes for This Section')}
      ${BULLETS(s3.coaching_notes)}
      ${PROBE(s3.probe)}

      <!-- SECTION 4 — INSTINCT & SUBTYPE -->
      ${SH('4 · Debriefing Instinct and Subtype')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">Their particular flavor of Type ${h.confirmed_type}, and why it matters.</p>

      ${SUBH('Instinct Ranking')}
      <div style="background:#FAF6F2;padding:14px 18px;border-radius:6px;margin-bottom:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        ${instinctScores.map(([name, score]) => instinctBar(name, score)).join('')}
      </div>

      ${s4.subtype_name ? `${SUBH(s4.subtype_name + ' — How the Instinct Shapes the Type')}` : ''}
      ${BULLETS(s4.how_instinct_shapes)}
      ${s4.easy_to_miss && s4.easy_to_miss.length ? `${SUBH('Why This Subtype Can Be Easy to Miss')}${BULLETS(s4.easy_to_miss)}` : ''}
      ${SUBH('Coaching Notes')}
      ${BULLETS(s4.coaching_notes)}
      ${PROBE(s4.probe)}

      <!-- SECTION 5 — WINGS, LINES, RESOURCES -->
      ${SH('5 · Debriefing Wings, Lines, and Resources')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">What they have available, especially under pressure.</p>

      ${SUBH('Stress Movement — Toward Type ' + (typeData(h.confirmed_type) || {}).stress_point)}
      ${BULLETS(s5.stress_notes)}
      ${PROBE(s5.stress_probe)}

      ${SUBH('Security Movement — Toward Type ' + (typeData(h.confirmed_type) || {}).security_point)}
      ${BULLETS(s5.security_notes)}
      ${PROBE(s5.security_probe)}

      ${SUBH('Wings — ' + ((typeData(h.confirmed_type) || {}).wings || []).map((w) => 'Type ' + w).join(' and '))}
      ${BULLETS(s5.wings_notes)}
      ${PROBE(s5.probe)}

      <!-- SECTION 6 — CONTINGENCIES -->
      ${SH('6 · If the Conversation Goes Sideways')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">What to do depending on how they receive the hypothesis.</p>

      ${CALLOUT(`
        ${CALLOUT_TITLE('If They Resonate Strongly')}
        ${BULLETS((s6.resonates_strongly || {}).bullets || [])}
        ${PROBE((s6.resonates_strongly || {}).probe || '')}
      `)}

      ${CALLOUT(`
        ${CALLOUT_TITLE('If They Push Back or Disagree', true)}
        ${BULLETS((s6.pushes_back || {}).bullets || [])}
        ${(s6.pushes_back || {}).alt_type_name ? `<p style="margin:8px 0 4px;font-size:12px;"><strong>Most likely alternate type:</strong> ${esc(s6.pushes_back.alt_type_name)}</p>` : ''}
        ${(s6.pushes_back || {}).key_distinction ? `<p style="margin:0 0 0;font-size:12px;font-style:italic;"><strong>Key distinguishing question:</strong> ${esc(s6.pushes_back.key_distinction)}</p>` : ''}
      `, true)}

      ${CALLOUT(`
        ${CALLOUT_TITLE('If They\'re Confused or Need More Clarity')}
        ${BULLETS((s6.confused || {}).bullets || [])}
        ${PROBE((s6.confused || {}).probe || '')}
      `)}

      ${show6A && s6a ? `
        <!-- SECTION 6A — TYPE CONFUSION OBSERVATION -->
        ${SH('6A · Type Confusion Observation Block')}
        <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">Types in question: ${esc(s6a.types_in_question || '')}. Use only if the client brought in their type confusion observation during the session.</p>
        ${SUBH('What to Do With What They Bring')}
        ${BULLETS(s6a.what_to_do)}
        ${SUBH('If the Observation Didn\'t Yield Clear Data')}
        ${BULLETS(s6a.if_no_data)}
        ${PROBE(s6a.probe)}
      ` : ''}

      <!-- FOOTER -->
      <div style="margin-top:40px;padding-top:16px;border-top:2px solid ${ORANGE};text-align:center;font-size:11px;color:#7A96A6;">
        Generated by the Hive Enneagram Typing Engine &nbsp;·&nbsp; For use by Cai and Monique &nbsp;·&nbsp; © Copyright 2026, Hive, Inc.
      </div>
    </div>
  `;
}
function buildClientHTML(result) {
  const body = clientReportBodyHtml(result);
  const h = result.hypothesis;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Client Report \u2014 Type ${h.confirmed_type}</title>
<style>
  @page { margin: 0.75in; }
  body { background: #ffffff; margin: 0; padding: 0; }
  @media print {
    body { background: #fff; margin: 0; }
    .print-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 0.5in;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: Arial, sans-serif;
      font-size: 9px;
      color: #7A96A6;
      border-top: 1px solid #E0E0E0;
      padding: 0 0.75in;
    }
    .page-number::after {
      content: counter(page);
    }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function buildCoachHTML(result) {
  const body = coachReportBodyHtml(result);
  const h = result.hypothesis;
  const instinct = (h.confirmed_instinct && h.confirmed_instinct !== 'UNCERTAIN') ? ' ' + h.confirmed_instinct : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Coach Report \u2014 Type ${h.confirmed_type}${instinct}</title>
<style>
  @media print { body { background: #fff; margin: 0; } @page { margin: 2cm; } }
  body { background: #F5F9FB; margin: 0; padding: 40px 20px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function triggerReportDownload(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Error ----
function renderError() {
  return `<div class="screen">
    <div class="error-screen">
      <div class="error-icon">○</div>
      <div class="error-heading">Something went wrong</div>
      <div class="error-text">
        The analysis couldn\u2019t complete just now. Your responses are still saved \u2014 you can try again, and if the problem persists we\u2019ll email your results within 24 hours.
      </div>
      <button class="btn btn-primary" id="btn-retry-api" style="margin-top:20px;">Try again</button>
    </div>
  </div>`;
}

// =================== EVENT HANDLERS ===================

function attachHandlers() {
  // Welcome
  const btnStart = document.getElementById('btn-start');
  if (btnStart) btnStart.addEventListener('click', () => {
    // Belt-and-suspenders: if storage somehow survived, clear it when a fresh
    // assessment actually begins. (resetAndReturnHome already clears on
    // "New Analysis", but this protects edge cases.)
    clearResult();
    state.phase = 'intake';
    render();
  });

  // Intake form
  const btnIntakeContinue = document.getElementById('btn-intake-continue');
  if (btnIntakeContinue) {
    btnIntakeContinue.addEventListener('click', () => {
      const firstName = (document.getElementById('intake-first-name').value || '').trim();
      const lastName = (document.getElementById('intake-last-name').value || '').trim();
      const email = (document.getElementById('intake-email').value || '').trim();
      const organization = (document.getElementById('intake-organization').value || '').trim();
      const coach = (document.getElementById('intake-coach').value || 'Cai Delumpa').trim();

      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const errorDiv = document.getElementById('intake-error');
      const emailErrorDiv = document.getElementById('intake-email-error');

      emailErrorDiv.style.display = (!email || emailValid) ? 'none' : 'block';

      if (!firstName || !lastName || !email || !emailValid) {
        errorDiv.style.display = 'block';
        return;
      }

      errorDiv.style.display = 'none';
      state.intake = { firstName, lastName, email, organization, coach };
      state.phase = 'stage0';
      state.stage0Idx = 0;
      render();
    });
  }

  // Restart (used by stage1complete placeholder + "New Analysis" button on results)
  const resetAndReturnHome = () => {
    clearResult();
    Object.assign(state, {
      phase: 'welcome',
      intake: { firstName: '', lastName: '', email: '', organization: '', coach: 'Cai Delumpa', client_id: null },
      finalOpenResponse: '',
      stage0Idx: 0, stage0Answers: {},
      stage1Idx: 0, stage1Rankings: [],
      stage2Idx: 0, stage2Answers: [],
      stage3Mode: null, stage3Idx: 0, stage3Answers: [],
      stage4Sequence: [], stage4Idx: 0, stage4Answers: [], stage4Shuffles: [],
      resultsTab: 'client',
      scores: null, apiResult: null,
    });
    initStage1();
    render();
  };

  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) btnRestart.addEventListener('click', () => {
    if (confirm('Start a new assessment? Your current results will be cleared.')) {
      resetAndReturnHome();
    }
  });

  // Results screen — tabs, downloads, new analysis
  const btnTabClient = document.querySelector('.btn-tab-client');
  if (btnTabClient) btnTabClient.addEventListener('click', () => {
    state.resultsTab = 'client';
    render();
  });

  const btnTabCoach = document.querySelector('.btn-tab-coach');
  if (btnTabCoach) btnTabCoach.addEventListener('click', () => {
    state.resultsTab = 'coach';
    render();
  });

  const btnDownloadClient = document.querySelector('.btn-download-client');
  if (btnDownloadClient) btnDownloadClient.addEventListener('click', () => {
    if (state.apiResult) triggerReportDownload(buildClientHTML(state.apiResult), 'hive_client_report');
  });

  const btnDownloadCoach = document.querySelector('.btn-download-coach');
  if (btnDownloadCoach) btnDownloadCoach.addEventListener('click', () => {
    if (state.apiResult) triggerReportDownload(buildCoachHTML(state.apiResult), 'hive_coach_report');
  });

  const btnNewAnalysis = document.querySelector('.btn-new-analysis');
  if (btnNewAnalysis) btnNewAnalysis.addEventListener('click', () => {
    if (confirm('Start a new assessment? Your current results will be cleared.')) {
      resetAndReturnHome();
    }
  });

  // Error screen — retry the API call without losing assessment state.
  const btnRetryApi = document.getElementById('btn-retry-api');
  if (btnRetryApi) btnRetryApi.addEventListener('click', () => {
    state.phase = 'processing';
    render();
    callAPI();
  });

  // Coach toggle
  const coachToggle = document.getElementById('coach-toggle');
  if (coachToggle) coachToggle.addEventListener('change', (e) => {
    document.getElementById('coach-section').classList.toggle('visible', e.target.checked);
  });

  // ---- Stage 0 ----
  const stage0Input = document.getElementById('stage0-input');
  if (stage0Input) {
    const btnNext = document.getElementById('btn-next');
    stage0Input.addEventListener('input', () => {
      btnNext.disabled = !stage0Input.value.trim();
    });
  }

  const btnBack0 = document.getElementById('btn-back');
  if (btnBack0 && state.phase === 'stage0') {
    btnBack0.addEventListener('click', () => {
      if (state.stage0Idx > 0) { state.stage0Idx--; render(); }
    });
  }

  const btnNext0 = document.getElementById('btn-next');
  if (btnNext0 && state.phase === 'stage0') {
    btnNext0.addEventListener('click', () => {
      const q = STAGE0_QUESTIONS[state.stage0Idx];
      const val = document.getElementById('stage0-input').value.trim();
      state.stage0Answers[q.id] = val;
      if (state.stage0Idx < 3) {
        state.stage0Idx++;
        render();
      } else {
        // Move to stage 1
        initStage1();
        state.phase = 'stage1';
        state.stage1Idx = 0;
        render();
      }
    });
  }

  // ---- Stage 1 ranking ----
  if (state.phase === 'stage1') {
    document.querySelectorAll('.rank-btn').forEach((btn) => {
      if (btn.closest('.rank-options') && state.phase === 'stage1') {
        btn.addEventListener('click', () => {
          const opt = btn.dataset.opt;
          const rank = parseInt(btn.dataset.rank);
          const r = state.stage1Rankings[state.stage1Idx];
          // Clear this rank from any other option
          ['a', 'b', 'c'].forEach((l) => { if (l !== opt && r[l] === rank) r[l] = null; });
          // Toggle off if already selected, otherwise set
          r[opt] = r[opt] === rank ? null : rank;
          render();
        });
      }
    });

    const btnBack1 = document.getElementById('btn-back');
    if (btnBack1) btnBack1.addEventListener('click', () => {
      if (state.stage1Idx > 0) { state.stage1Idx--; render(); }
      else { state.phase = 'stage0'; state.stage0Idx = 3; render(); }
    });

    const btnNext1 = document.getElementById('btn-next');
    if (btnNext1) btnNext1.addEventListener('click', () => {
      if (state.stage1Idx < 9) {
        state.stage1Idx++;
        render();
      } else {
        // Done with Stage 1 — compute scores and advance to Stage 2.
        state.scores = computeStage1Scores();
        console.log('=== STAGE 1 OUTPUT ===', state.scores);
        state.phase = 'stage2';
        state.stage2Idx = 0;
        render();
      }
    });
  }

  // ---- Stage 2: Cross-Referencing ----
  if (state.phase === 'stage2') {
    document.querySelectorAll('.person-option').forEach((el) => {
      el.addEventListener('click', () => {
        state.stage2Answers[state.stage2Idx] = el.dataset.choice;
        render();
      });
    });

    const btnBackS2 = document.getElementById('btn-back');
    if (btnBackS2) btnBackS2.addEventListener('click', () => {
      if (state.stage2Idx > 0) {
        state.stage2Idx--;
        render();
      } else {
        // Back to last Stage 1 question
        state.phase = 'stage1';
        state.stage1Idx = 9;
        render();
      }
    });

    const btnNextS2 = document.getElementById('btn-next');
    if (btnNextS2) btnNextS2.addEventListener('click', () => {
      if (state.stage2Idx < STAGE2_QUESTIONS.length - 1) {
        state.stage2Idx++;
        render();
      } else {
        // Done with Stage 2 — compute scores, resolve Stage 3 pair, advance.
        state.scores.stage2 = computeStage2Scores();
        console.log('=== STAGE 2 OUTPUT ===', state.scores.stage2);
        state.scores.stage3Pair = resolveStage3Pair(state.scores);
        state.stage3Mode = state.scores.stage3Pair.mode;
        state.stage3Idx = 0;
        state.stage3Answers = [];
        state.phase = 'stage3';
        render();
      }
    });
  }

  // ---- Stage 3: Pairwise Discrimination ----
  if (state.phase === 'stage3') {
    document.querySelectorAll('.person-option').forEach((el) => {
      el.addEventListener('click', () => {
        state.stage3Answers[state.stage3Idx] = el.dataset.choice;
        render();
      });
    });

    const pair = state.scores.stage3Pair;
    const totalQs = pair.mode === 'COUNTER-TYPE' ? 1 : (pair.hasAvoidance ? 2 : 1);

    const btnBackS3 = document.getElementById('btn-back');
    if (btnBackS3) btnBackS3.addEventListener('click', () => {
      if (state.stage3Idx > 0) {
        state.stage3Idx--;
        render();
      } else {
        // Back to last Stage 2 question
        state.phase = 'stage2';
        state.stage2Idx = STAGE2_QUESTIONS.length - 1;
        render();
      }
    });

    const btnNextS3 = document.getElementById('btn-next');
    if (btnNextS3) btnNextS3.addEventListener('click', () => {
      if (state.stage3Idx < totalQs - 1) {
        state.stage3Idx++;
        render();
      } else {
        // Done with Stage 3 — compute scores, resolve Stage 4 path, advance.
        state.scores.stage3 = computeStage3Scores();
        console.log('=== STAGE 3 OUTPUT ===', state.scores.stage3);
        const pr = resolveStage4Path(state.scores);
        state.scores.stage4PathResolve = pr;
        state.stage4Sequence = initialStage4Sequence(pr);
        state.stage4Idx = 0;
        state.stage4Answers = [];
        state.stage4Shuffles = [];
        state.phase = 'stage4';
        render();
      }
    });
  }

  // ---- Stage 4: Confirmation ----
  if (state.phase === 'stage4') {
    document.querySelectorAll('.person-option').forEach((el) => {
      el.addEventListener('click', () => {
        state.stage4Answers[state.stage4Idx] = el.dataset.choice;
        render();
      });
    });

    const btnBackS4 = document.getElementById('btn-back');
    if (btnBackS4) btnBackS4.addEventListener('click', () => {
      if (state.stage4Idx > 0) {
        state.stage4Idx--;
        render();
      } else {
        // Back to last Stage 3 question
        const pair = state.scores.stage3Pair;
        const s3Total = pair.mode === 'COUNTER-TYPE' ? 1 : (pair.hasAvoidance ? 2 : 1);
        state.phase = 'stage3';
        state.stage3Idx = s3Total - 1;
        render();
      }
    });

    const btnNextS4 = document.getElementById('btn-next');
    if (btnNextS4) btnNextS4.addEventListener('click', () => {
      const pr = state.scores.stage4PathResolve;

      // After Stress+Security, decide whether to append Habit.
      if (state.stage4Idx === 1) {
        const habitNeeded = shouldFireHabit(pr, state.stage4Answers);
        const alreadyHasHabit = state.stage4Sequence.length > 2;
        if (habitNeeded && !alreadyHasHabit) {
          const habitSlot = pr.option === 'A'
            ? { instrument: 'habit', format: '3opt', typeNum: pr.leadType }
            : pr.option === 'B'
              ? { instrument: 'habit', format: 'pairwise', typeA: pr.leadType, typeB: pr.secondType }
              : { instrument: 'habit', format: 'ct-pairwise', ctKey: pr.ctKey, labelA: 'Counter-type', labelB: 'Lookalike' };
          state.stage4Sequence.push(habitSlot);
        } else if (!habitNeeded && alreadyHasHabit) {
          // User walked back and changed answers so Habit is no longer needed.
          state.stage4Sequence = state.stage4Sequence.slice(0, 2);
          state.stage4Answers = state.stage4Answers.slice(0, 2);
          state.stage4Shuffles = state.stage4Shuffles.slice(0, 2);
        }
      }

      if (state.stage4Idx < state.stage4Sequence.length - 1) {
        state.stage4Idx++;
        render();
      } else {
        // Done with Stage 4 — compute scores, transition to finalopen question.
        state.scores.stage4 = computeStage4Scores();
        console.log('=== STAGE 4 OUTPUT ===', state.scores.stage4);
        state.phase = 'finalopen';
        render();
      }
    });
  }

  // ---- Final Open Question ----
  if (state.phase === 'finalopen') {
    const inputEl = document.getElementById('finalopen-input');

    // Save draft as user types
    if (inputEl) inputEl.addEventListener('input', () => {
      state.finalOpenResponse = inputEl.value;
    });

    const submitFinalOpen = () => {
      state.finalOpenResponse = (inputEl ? inputEl.value : '') || '';
      state.phase = 'processing';
      render();
      callAPI();
    };

    const btnSkip = document.getElementById('btn-finalopen-skip');
    if (btnSkip) btnSkip.addEventListener('click', () => {
      state.finalOpenResponse = '';
      state.phase = 'processing';
      render();
      callAPI();
    });

    const btnSubmit = document.getElementById('btn-finalopen-submit');
    if (btnSubmit) btnSubmit.addEventListener('click', submitFinalOpen);

    const btnBack = document.getElementById('btn-finalopen-back');
    if (btnBack) btnBack.addEventListener('click', () => {
      state.phase = 'stage4';
      state.stage4Idx = state.stage4Sequence.length - 1;
      render();
    });
  }

  // ---- Stage 1 Complete (placeholder) ----
  // Only the Restart button lives here for now. Restart handler is attached
  // above in the shared block.
}

