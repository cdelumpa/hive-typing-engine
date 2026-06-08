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
    title: 'SOMETHING WENT RIGHT',
    text: 'Think about a time when things were going really well at work or in your personal life. Rank the following for what that experience was like.',
    options: {
      a: 'I had the autonomy and ability to do things my way.',
      b: 'The people around me had my back and I had theirs.',
      c: 'Things went as I planned and the result was better than I imagined.',
    },
    mapping: { a: 'body', b: 'heart', c: 'head' },
  },
  {
    id: 'q2',
    type: 'instinct',
    title: 'MEETING SOMEONE NEW',
    text: 'You\u2019re meeting a friend of a friend at a social event. Rank the following by what you become most curious about.',
    options: {
      a: 'Where they live and what they like to do.',
      b: 'How they\u2019re connected to our mutual friend and this group.',
      c: 'Whether there\u2019s a real connection to be had.',
    },
    mapping: { a: 'sp', b: 'so', c: 'sx' },
  },
  {
    id: 'q3',
    type: 'centers',
    title: 'AT YOUR BEST',
    text: 'Think about a moment when you were at your best. Rank the following in terms of how much each contributed to that.',
    options: {
      a: 'I felt grounded and impactful.',
      b: 'I felt seen and valued.',
      c: 'I felt knowledgeable and prepared.',
    },
    mapping: { a: 'body', b: 'heart', c: 'head' },
  },
  {
    id: 'q4',
    type: 'instinct',
    title: 'WORST CASE',
    text: 'What\u2019s the worst thing that could happen? Rank the following for what would rock your world the most.',
    options: {
      a: 'Losing my financial security and stability.',
      b: 'Losing my community and sense of belonging.',
      c: 'Losing a close relationship.',
    },
    mapping: { a: 'sp', b: 'so', c: 'sx' },
  },
  {
    id: 'q5',
    type: 'centers',
    title: 'SITTING QUIETLY',
    text: 'You\u2019re sitting quietly with nothing demanding your attention. Rank the following by where your mind most naturally drifts.',
    options: {
      a: 'Something in the present that isn\u2019t quite right and could be better.',
      b: 'Something in the past you wish had gone differently.',
      c: 'Something in the future you\u2019re looking forward to or thinking through.',
    },
    mapping: { a: 'body', b: 'heart', c: 'head' },
  },
  {
    id: 'q6',
    type: 'instinct',
    title: 'NEW JOB',
    text: 'You\u2019ve just started a new job and it\u2019s your first week. Rank the following by what would make you feel most comfortable right away.',
    options: {
      a: 'Making sure I have my work area set up the way I want it.',
      b: 'Meeting \u2014 and sussing out \u2014 all of my co-workers.',
      c: 'Finding one or two people I genuinely connect with.',
    },
    mapping: { a: 'sp', b: 'so', c: 'sx' },
  },
  {
    id: 'q7',
    type: 'centers',
    title: 'FREE TIME',
    text: 'A big meeting just got cancelled and you suddenly have a big chunk of free time. Rank the following in terms of what you naturally gravitate towards.',
    options: {
      a: 'I get busy doing something active or productive.',
      b: 'I connect with someone or something meaningful.',
      c: 'I sit down and plan for what\u2019s next.',
    },
    mapping: { a: 'body', b: 'heart', c: 'head' },
  },
  {
    id: 'q8',
    type: 'instinct',
    title: 'RETURNING HOME',
    text: 'You\u2019ve just returned home after two weeks away. Rank the following by what you find yourself doing first.',
    options: {
      a: 'Getting my space and routine back in order.',
      b: 'Catching up on the latest in my social circle.',
      c: 'Reconnecting with my significant other or best friend.',
    },
    mapping: { a: 'sp', b: 'so', c: 'sx' },
  },
  {
    id: 'q9',
    type: 'centers',
    title: 'RESTRUCTURING',
    text: 'You\u2019ve just learned that your organization is going through a significant restructuring that will affect your role. Rank the following by how closely each matches your immediate internal reaction.',
    options: {
      a: 'I feel a surge of resistance \u2014 this is not okay.',
      b: 'My heart sinks with concern about my worth and place.',
      c: 'I feel anxious about what this means for me.',
    },
    mapping: { a: 'body', b: 'heart', c: 'head' },
  },
  {
    id: 'q10',
    type: 'centers',
    title: 'DECISION MAKING',
    text: 'Recall a time when you had to choose between two equally important and viable options. Rank the following in terms of what played the biggest role in your decision-making.',
    options: {
      a: 'I trusted my gut.',
      b: 'I followed my emotions.',
      c: 'I considered all the facts and options.',
    },
    mapping: { a: 'body', b: 'heart', c: 'head' },
  },
  {
    id: 'q11',
    type: 'instinct',
    title: 'HOW YOU RECHARGE',
    text: 'It\u2019s Sunday night and you\u2019re about to embark on a busy week. Rank the following in terms of how you prefer to spend your time.',
    options: {
      a: 'Laying low and taking it easy, making sure I have energy for the week ahead.',
      b: 'Getting together with friends for one last hurrah before the busy week starts.',
      c: 'Spending quality time with someone I care about.',
    },
    mapping: { a: 'sp', b: 'so', c: 'sx' },
  },
  {
    id: 'q12',
    type: 'instinct',
    title: 'YOUR FIRST MOVE',
    text: 'You\u2019ve just arrived at a party. After greeting the hosts, rank the following by what you\u2019d instinctively want to do next.',
    options: {
      a: 'Go to the food table and make sure there\u2019s stuff you like.',
      b: 'Scan the room to see who\u2019s here and who\u2019s important to connect with.',
      c: 'Find someone you really want to connect with and dive in.',
    },
    mapping: { a: 'sp', b: 'so', c: 'sx' },
  },
];

// =================== STAGE 1 (v2) — TYPE & INSTINCT SLIDER STATEMENTS ===================

// Source of record:
//   hive_stage1_type_statements_final_052926.docx   — 45 type statements (9 types x 5)
//   hive_stage1_instinct_statements_v1_052926.docx   — 15 instinct statements (3 x 5)
// Each statement is a continuous 0-100 slider ("Not like me / Very much like me").
// Flat scoring: every statement carries equal weight (see scoreStage1Profile).
//
// NOTE on IDs: the type-statement IDs are NOT a clean -1..-5 run. The middle
// dimension splits into a 2a/2b pair, so Type 3 reads S3-1, S3-2a, S3-2b, S3-3,
// S3-4. Summing must key on the actual row count per group, never on ID-suffix
// arithmetic. validateStage1Statements() enforces exactly 5 rows per group at load.

const STAGE1_TYPE_STATEMENTS = {
  3: [
    { id: 'S3-1',  dimension: 'Core motivation',        text: 'I prioritize achieving my goals and being recognized for what I accomplish.' },
    { id: 'S3-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to what needs to be accomplished and how I’m coming across.' },
    { id: 'S3-2b', dimension: 'Resulting preoccupation', text: 'I find myself adjusting how I present myself and tracking how I’m landing.' },
    { id: 'S3-3',  dimension: 'Energy',                  text: 'I put a lot of energy into staying productive, performing well, and projecting a capable, successful image.' },
    { id: 'S3-4',  dimension: 'Avoidance',               text: 'I tend to avoid failing, slowing down, or being seen as unsuccessful or incapable.' },
  ],
  6: [
    { id: 'S6-1',  dimension: 'Core motivation',        text: 'I prioritize feeling safe, secure, and prepared for whatever might happen.' },
    { id: 'S6-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to what could go wrong, potential danger, and whether people and situations can really be trusted.' },
    { id: 'S6-2b', dimension: 'Resulting preoccupation', text: 'I find myself running through worst-case scenarios figuring out how to be prepared for what might happen.' },
    { id: 'S6-3',  dimension: 'Energy',                  text: 'I put a lot of energy into questioning, seeking reassurance, and making sure I’m ready for what could go wrong.' },
    { id: 'S6-4',  dimension: 'Avoidance',               text: 'I tend to avoid uncertainty, blindly trusting others, and being caught unprepared.' },
  ],
  9: [
    { id: 'S9-1',  dimension: 'Core motivation',        text: 'I prioritize keeping the peace and maintaining harmony, inside myself and with others.' },
    { id: 'S9-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes outward to other people’s agendas, potential sources of conflict, and to what’s right in front of me.' },
    { id: 'S9-2b', dimension: 'Resulting preoccupation', text: 'I find myself going along with what others want, keeping things comfortable, and losing track of what matters most to me.' },
    { id: 'S9-3',  dimension: 'Energy',                  text: 'I put a lot of energy into accommodating others, staying comfortable, and avoiding friction.' },
    { id: 'S9-4',  dimension: 'Avoidance',               text: 'I tend to avoid conflict, asserting my own position, and anything that disturbs my sense of peace.' },
  ],
  1: [
    { id: 'S1-1',  dimension: 'Core motivation',        text: 'I prioritize doing things right and being a good, responsible person.' },
    { id: 'S1-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to what’s wrong, imprecise, or not meeting the standard in situations, in others, and in myself.' },
    { id: 'S1-2b', dimension: 'Resulting preoccupation', text: 'I find myself monitoring, correcting, and comparing, driven by a relentless internal critic.' },
    { id: 'S1-3',  dimension: 'Energy',                  text: 'I put a lot of energy into improving things, maintaining standards, and keeping myself and my work above reproach.' },
    { id: 'S1-4',  dimension: 'Avoidance',               text: 'I tend to avoid making mistakes, being wrong, and letting my own anger or impulses show.' },
  ],
  4: [
    { id: 'S4-1',  dimension: 'Core motivation',        text: 'I prioritize being authentic and true to myself, and feeling a deep connection to what’s real and meaningful.' },
    { id: 'S4-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to what is missing or unavailable to me, and my internal emotional landscape.' },
    { id: 'S4-2b', dimension: 'Resulting preoccupation', text: 'I find myself drawn toward what would make me feel unique or special and away from the ordinary or mundane.' },
    { id: 'S4-3',  dimension: 'Energy',                  text: 'I put a lot of energy into processing my emotions, seeking depth, and being seen as unique and authentic.' },
    { id: 'S4-4',  dimension: 'Avoidance',               text: 'I tend to avoid being ordinary, feeling cut off from my feelings, and settling for the superficial.' },
  ],
  2: [
    { id: 'S2-1',  dimension: 'Core motivation',        text: 'I prioritize being needed and appreciated for how I care for and support others.' },
    { id: 'S2-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to other people’s feelings and needs, picking up on what they need usually before they even know.' },
    { id: 'S2-2b', dimension: 'Resulting preoccupation', text: 'I find myself setting aside what I need in order to focus on others, telling myself my needs can wait.' },
    { id: 'S2-3',  dimension: 'Energy',                  text: 'I put a lot of energy into helping, supporting, and tending to relationships and others’ needs.' },
    { id: 'S2-4',  dimension: 'Avoidance',               text: 'I tend to avoid acknowledging my own needs, asking for help, and feeling that I’m not needed or appreciated.' },
  ],
  8: [
    { id: 'S8-1',  dimension: 'Core motivation',        text: 'I prioritize being strong and in control so I can protect myself and the people I care about.' },
    { id: 'S8-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to power dynamics, fairness, and any move to control, take advantage, or show weakness.' },
    { id: 'S8-2b', dimension: 'Resulting preoccupation', text: 'I find myself moving toward action, confronting what’s wrong head-on, and protecting against any sign of vulnerability.' },
    { id: 'S8-3',  dimension: 'Energy',                  text: 'My energy goes to taking action, asserting my will, and taking a stand against what’s unjust or unfair.' },
    { id: 'S8-4',  dimension: 'Avoidance',               text: 'I tend to avoid feeling vulnerable, being controlled, and being dependent on others.' },
  ],
  5: [
    { id: 'S5-1',  dimension: 'Core motivation',        text: 'I prioritize understanding the world and having enough knowledge and resources to be self-sufficient.' },
    { id: 'S5-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to demands on my time and energy, and to potential intrusions on my privacy.' },
    { id: 'S5-2b', dimension: 'Resulting preoccupation', text: 'I find myself building my knowledge, maintaining my boundaries, and conserving my energy and resources.' },
    { id: 'S5-3',  dimension: 'Energy',                  text: 'I put a lot of energy into gathering knowledge, figuring things out, and protecting my privacy and resources.' },
    { id: 'S5-4',  dimension: 'Avoidance',               text: 'I tend to avoid emotional demands, intrusion on my space, and being caught without enough understanding or resources.' },
  ],
  7: [
    { id: 'S7-1',  dimension: 'Core motivation',        text: 'I prioritize living a life free from pain and constraints.' },
    { id: 'S7-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes to anything that could potentially limit my options or cause me pain and suffering.' },
    { id: 'S7-2b', dimension: 'Resulting preoccupation', text: 'I find myself planning for pleasurable possibilities, generating new options, and reframing whatever feels limiting or painful.' },
    { id: 'S7-3',  dimension: 'Energy',                  text: 'I put a lot of energy into staying up and positive, planning for pleasurable possibilities, and keeping my options open.' },
    { id: 'S7-4',  dimension: 'Avoidance',               text: 'I tend to avoid people and situations that limit my options or require me to sit with pain or difficulty.' },
  ],
};

const STAGE1_INSTINCT_STATEMENTS = {
  SP: [
    { id: 'I1-SP-1', dimension: 'Body & comfort',       text: 'I pay close attention to my physical comfort — things like temperature, hunger, rest, and whether my body feels okay.' },
    { id: 'I1-SP-2', dimension: 'Enough / resources',   text: 'I keep track of whether I have enough resources (money, supplies, energy, time, etc) to ensure comfort and survival.' },
    { id: 'I1-SP-3', dimension: 'Security (protective)', text: 'I keep the people and things I depend on safe.' },
    { id: 'I1-SP-4', dimension: 'Self-reliance',        text: 'I prefer to handle things myself rather than counting on others.' },
    { id: 'I1-SP-5', dimension: 'Energy direction',     text: 'I recharge by being on my own, in my own space, with no demands on me.' },
  ],
  SO: [
    { id: 'I1-SO-1', dimension: 'Place in the group',   text: 'I pay attention to where I stand in a group and how I’m coming across to the people in it.' },
    { id: 'I1-SO-2', dimension: 'Trust / reciprocity',  text: 'I pay attention to who in a group is reliable and can be counted on, and who can’t.' },
    { id: 'I1-SO-3', dimension: 'Social landscape',     text: 'I notice the social landscape — who’s connected to whom, who’s in, who’s on the outside.' },
    { id: 'I1-SO-4', dimension: 'Larger belonging',     text: 'I am pulled toward something larger than myself: a cause, a community, a group I want to be part of.' },
    { id: 'I1-SO-5', dimension: 'Energy direction',     text: 'I get my energy by being part of a community.' },
  ],
  SX: [
    { id: 'I1-SX-1', dimension: 'Magnetized attention', text: 'My attention gets pulled strongly toward specific people or things, sometimes to the point of crowding out everything else.' },
    { id: 'I1-SX-2', dimension: 'Energy direction',     text: 'I find intense one-on-one conversations energizing.' },
    { id: 'I1-SX-3', dimension: 'Override',             text: 'When I’m captivated by someone or something, the pull can override my better judgment about what I should be doing.' },
    { id: 'I1-SX-4', dimension: 'Asserting',            text: 'When I want something, I go after it directly and don’t hold back.' },
    { id: 'I1-SX-5', dimension: 'Impressing',           text: 'I want to have a real impact on the people and things that matter to me, even if I don’t make it obvious.' },
  ],
};

// Narrative training screen order (design §4.1). Scoring is order-independent;
// this is carried for the deferred Stage 1 slider UI.
const STAGE1_TYPE_SCREEN_ORDER = [3, 6, 9, 1, 4, 2, 8, 5, 7];
const STAGE1_INSTINCT_ORDER = ['SP', 'SO', 'SX'];

// High-ambiguity near-tie margin on the normalized 0-100 scale. Carries the
// v1 "~25-pt-on-300" intent forward (≈8 pts here). TUNABLE — the concrete
// value is reserved for Step-1 tuning against real profiles; do not treat as
// settled. The unit test asserts the flag logic against THIS constant, not 8.
const HIGH_AMBIGUITY_MARGIN = 8;

// Fail loudly at load if a content edit drops or adds a statement row, so a
// miscount surfaces immediately instead of silently mis-normalizing. Keys on the
// actual row count per group (not ID arithmetic), per the 2a/2b ID note above.
function validateStage1Statements() {
  for (const t of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const rows = STAGE1_TYPE_STATEMENTS[t];
    if (!Array.isArray(rows) || rows.length !== 5) {
      throw new Error(`[stage1] Type ${t} must have exactly 5 statements, found ${rows ? rows.length : 'none'}.`);
    }
  }
  for (const inst of ['SP', 'SO', 'SX']) {
    const rows = STAGE1_INSTINCT_STATEMENTS[inst];
    if (!Array.isArray(rows) || rows.length !== 5) {
      throw new Error(`[stage1] Instinct ${inst} must have exactly 5 statements, found ${rows ? rows.length : 'none'}.`);
    }
  }
}
validateStage1Statements();

// Stage 1 v2 slider screen model. Type screens pair the narrative order two
// types at a time ([3,6][9,1][4,2][8,5][7]); then an optional type open-response;
// then one instinct screen per instinct (SP/SO/SX); then an optional instinct
// open-response. 10 screens total (indices 0-9).
const STAGE1_SCREENS = (() => {
  const screens = [];
  for (let i = 0; i < STAGE1_TYPE_SCREEN_ORDER.length; i += 2) {
    screens.push({ kind: 'type-sliders', types: STAGE1_TYPE_SCREEN_ORDER.slice(i, i + 2) });
  }
  screens.push({ kind: 'type-open' });
  STAGE1_INSTINCT_ORDER.forEach((inst) => screens.push({ kind: 'instinct-sliders', instinct: inst }));
  screens.push({ kind: 'instinct-open' });
  return screens;
})();

// Flatten a slider screen into ordered slots. Each slot ties a rendered slider
// (index i on the screen) back to its state location: type/instinct group + the
// statement index 0-4. Render order == storage order, so the i-th slider always
// writes the i-th statement of its group. Scoring (scoreStage1Profile) takes the
// mean of the five, so intra-group order is score-neutral, but we keep it aligned
// to the statement bank to stay self-describing in the responses snapshot.
function stage1ScreenSlots(screen) {
  const slots = [];
  if (screen.kind === 'type-sliders') {
    screen.types.forEach((t) => {
      STAGE1_TYPE_STATEMENTS[t].forEach((statement, stmtIdx) => {
        slots.push({ groupKind: 'type', groupKey: t, stmtIdx, statement });
      });
    });
  } else if (screen.kind === 'instinct-sliders') {
    STAGE1_INSTINCT_STATEMENTS[screen.instinct].forEach((statement, stmtIdx) => {
      slots.push({ groupKind: 'instinct', groupKey: screen.instinct, stmtIdx, statement });
    });
  }
  return slots;
}

function stage1SlotValue(slot) {
  return slot.groupKind === 'type'
    ? state.stage1TypeSliders[slot.groupKey][slot.stmtIdx]
    : state.stage1InstinctSliders[slot.groupKey][slot.stmtIdx];
}

function stage1SetSlotValue(slot, v) {
  if (slot.groupKind === 'type') state.stage1TypeSliders[slot.groupKey][slot.stmtIdx] = v;
  else state.stage1InstinctSliders[slot.groupKey][slot.stmtIdx] = v;
}

// The slider component attaches a window resize listener to reposition thumbs.
// We hold the active handler here so each render can detach the previous one,
// preventing listener buildup and stale-DOM repositioning after navigation.
let _stage1ResizeHandler = null;

// =================== STAGE 2 DATA ===================

// Stage 2 collects three framework answers as evidence for the AI (design §5).
// Q1 (Hornevian) and Q2 (Harmonic) are single-select. Q3 is the NEW Centers
// decision-making question (§5.1) — a ranking of Gut / Feelings / Facts that
// replaces the retired Object Relations question. The engine no longer scores
// these (intersection scoring is removed in a later step); this session is the
// content + UI swap only.
const STAGE2_QUESTIONS = [
  {
    id: 'xref-q1',
    framework: 'Hornevian',
    format: 'select',
    title: 'SOCIAL STANCE',
    text: 'How do you tend to go about getting what you want or need in life?',
    options: {
      A: 'I go for what I want, knowing I can make it happen.',
      B: 'I actively attend to what\u2019s needed by the person, situation, or group.',
      C: 'I move inward where I know I\u2019ll find peace, solitude, and meaning.',
    },
  },
  {
    id: 'xref-q2',
    framework: 'Harmonic',
    format: 'select',
    title: 'CONFLICT RESPONSE',
    text: 'How do you experience not getting what matters most to you?',
    options: {
      A: 'I call out what\u2019s wrong, sometimes loudly, and challenge the status quo.',
      B: 'I look on the bright side and try to make the best of the situation.',
      C: 'I switch to analysis mode and start correcting what\u2019s wrong.',
    },
  },
  {
    id: 'xref-q3',
    framework: 'Centers',
    format: 'ranking',
    title: 'DECISION MAKING',
    text: 'When you face an important decision, rank the following by how much each one guides your process.',
    options: {
      a: 'My gut \u2014 my instinct about what feels right.',
      b: 'My feelings \u2014 how I and the people involved feel about it.',
      c: 'The facts \u2014 the logic, the data, and a careful weighing of the options.',
    },
    mapping: { a: 'Gut', b: 'Feelings', c: 'Facts' },
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

// Shared stems (question-bank v2, hive_stage3_question_bank_v2_052926.docx).
const STAGE3_Q1_STEM = 'When you\u2019re at your best, how would you describe your internal experience?';
const STAGE3_Q2_STEM = 'Which of these feels most uncomfortable or intolerable when it shows up in your life?';

// Nine core-motivation descriptions (question-bank v2). Q1 pairs are composed
// dynamically from these \u2014 the nine assemble into any of the 36 pairs.
const STAGE3_CORE_MOTIVATIONS = {
  1: 'I am doing things the right way. I feel principled, clear, and in integrity with my own standards.',
  2: 'I am tuned in to what others need. I feel genuinely helpful, warm, and deeply connected.',
  3: 'I am achieving something meaningful. I feel capable, successful, and recognized for what I bring.',
  4: 'I am fully and authentically myself. I feel deeply seen, creatively alive, and emotionally real.',
  5: 'I understand what\u2019s happening at a deep level. I feel clear, self-sufficient, and completely capable.',
  6: 'I am prepared and loyal to what matters. I feel reliable, certain, and securely connected to people I trust.',
  7: 'I am experiencing life to the fullest. I feel free, expansive, and open to everything available to me.',
  8: 'I am fully in control of my world. I feel strong, powerful, and completely unbothered by outside pressure.',
  9: 'Everything feels settled and at peace. I feel harmonious, easy, and genuinely okay with where things are.',
};

// Bespoke Q2 (avoidance) items, 26 pairs, keyed 'lower-higher'. Lower-numbered
// type is Person A. Q2 fires only when AI Call #1 returns gap = 'tight' AND the
// top-two pair is one of these 26 (the realistic confusion set: original ten +
// seven wings + nine lines). Top-two outside this set runs Q1 only. Source:
// hive_stage3_question_bank_v2_052926.docx \u00a7"Stage 3 Q2".
const STAGE3_Q2_PAIRS = {
  // Original high-ambiguity ten.
  '1-6': { label: 'Inner Standards vs. External Certainty', personA: 'Realizing I\u2019ve done something wrong or fallen short of my own standards. The self-criticism that follows is hard to shake.', personB: 'Feeling unprepared or uncertain about what\u2019s coming. Not knowing who or what I can count on genuinely unsettles me.' },
  '1-9': { label: 'Inner Critic vs. Conflict Avoidance', personA: 'Knowing something is wrong and feeling unable to correct it. The gap between how things are and how they should be creates real internal tension.', personB: 'Feeling tension or conflict with people I care about. Disruption to harmony feels genuinely uncomfortable in my body.' },
  '2-6': { label: 'Rejection vs. Uncertainty', personA: 'Feeling unwanted, unneeded, or like my care isn\u2019t appreciated. The possibility of being rejected by someone I\u2019ve given myself to is hard to bear.', personB: 'Feeling like I don\u2019t know where things stand or who I can truly trust. Uncertainty about what\u2019s coming, or whether I\u2019m really supported, keeps me on edge.' },
  '2-9': { label: 'Being Unloved vs. Disrupted Peace', personA: 'Feeling disconnected or unappreciated by people who matter to me, like my presence doesn\u2019t make a difference to them.', personB: 'Feeling pulled into conflict or tension I didn\u2019t create. Having my sense of inner peace disrupted by other people\u2019s agendas is hard to take.' },
  '3-7': { label: 'Failure vs. Limitation', personA: 'Failing visibly or being seen as incompetent. The idea that people might think I\u2019m not capable or successful is genuinely hard to sit with.', personB: 'Feeling trapped, constrained, or stuck with no good options. When life starts to feel repetitive or limited, I feel a real urgency to find a way out.' },
  '3-8': { label: 'Image vs. Control', personA: 'Being seen in a way that doesn\u2019t reflect well on me. I\u2019m aware of how I\u2019m coming across, and it matters that the impression is a good one.', personB: 'Being controlled, overruled, or made to feel powerless. When someone tries to limit what I can do, something in me pushes back hard.' },
  '4-5': { label: 'Trusting the Heart vs. Trusting the Mind', personA: 'Having my emotional reality questioned, or being told that what I feel isn\u2019t accurate. My feelings are how I know what\u2019s true, and having that doubted cuts at something fundamental in me.', personB: 'Being flooded with emotion before I\u2019ve had time to think it through. Feelings that arrive fast and demand an immediate response feel unreliable, and I need to step back and reason before I trust them.' },
  '4-9': { label: 'Amplified Emotion vs. Muted Emotion', personA: 'Feeling emotionally flat or cut off from what\u2019s real. I\u2019d rather feel something intensely than feel nothing at all.', personB: 'Feeling overwhelmed by emotional intensity or conflict. When things get too charged, I find myself going numb or withdrawing until it passes.' },
  '5-9': { label: 'Energy Conservation vs. Tension Avoidance', personA: 'Feeling depleted by too much engagement or contact. When people need too much from me, I feel my resources running out and I need to withdraw to recover.', personB: 'Feeling pressured to assert myself or take a strong position. When there\u2019s conflict or expectation, I find it easier to go along or disengage than to push back.' },
  '6-8': { label: 'Managed Fear vs. Denied Vulnerability', personA: 'Feeling unprepared for something that could go wrong. There\u2019s an undercurrent of worry that I might not have what it takes to handle what\u2019s coming.', personB: 'Feeling weak, dependent, or like someone has gotten the upper hand. Vulnerability isn\u2019t something I show easily, and being in that position feels genuinely wrong.' },
  // Wing pairs.
  '1-2': { label: 'Falling Short vs. Being Unwanted', personA: 'Realizing I\u2019ve done something wrong or let my own standards slip. The self-correction that follows is hard to shake, even when others tell me it\u2019s fine.', personB: 'Sensing that I\u2019m not really wanted, or that the care I give isn\u2019t landing. The possibility that someone close to me doesn\u2019t actually need me is genuinely hard to sit with.' },
  '2-3': { label: 'Being Unneeded vs. Being Unimpressive', personA: 'Feeling that my support goes unnoticed or unreturned. What gets to me is the sense that all my giving hasn\u2019t earned me a real place in someone\u2019s life.', personB: 'Falling short of what I set out to achieve, or being seen as ordinary. The idea that I haven\u2019t measured up to what I\u2019m capable of is genuinely hard to sit with.' },
  '3-4': { label: 'Being Ordinary vs. Being Inauthentic', personA: 'Stalling out, or being seen as average with nothing to show for it. Slowing down long enough to feel unproductive is genuinely uncomfortable for me.', personB: 'Having to present a version of myself that isn\u2019t real. Being polished but hollow feels worse to me than being a mess that\u2019s at least honest.' },
  '5-6': { label: 'Withdrawing vs. Preparing', personA: 'Having demands land on me before I\u2019ve had time to think and gather myself. When too much is asked too fast, everything in me wants to pull back and conserve.', personB: 'Being caught without a plan for what might go wrong. When things feel uncertain, my mind runs through scenarios until I\u2019ve worked out every contingency.' },
  '6-7': { label: 'Trapped by Danger vs. Trapped by Limits', personA: 'Committing to something without knowing whether it\u2019s safe or who I can trust. The uncertainty keeps me scanning for what could go wrong.', personB: 'Feeling boxed in, with no way out and no better options. When life starts to feel limited or repetitive, I feel a real urgency to find a way out.' },
  '7-8': { label: 'Pain I Can\u2019t Reframe vs. Weakness I Can\u2019t Deny', personA: 'Being stuck with discomfort I can\u2019t move past or turn into something better. When something painful won\u2019t reframe, I feel a strong pull to get away from it.', personB: 'Being put in a position of weakness or dependence. Needing someone else, or being unable to act on my own terms, feels genuinely wrong to me.' },
  '8-9': { label: 'Being Controlled vs. Being Disrupted', personA: 'Being overruled or made to feel powerless. When someone tries to limit what I can do, something in me pushes back hard and right away.', personB: 'Being pulled into conflict that breaks the calm. When tension rises around me, I\u2019d rather smooth it over or go quiet than get drawn into it.' },
  // Line pairs (derived from Stage 4 stress/security arrows).
  '1-4': { label: 'Correcting the Flaw vs. Feeling the Lack', personA: 'Knowing something is wrong and not being able to put it right. The gap between how things are and how they should be creates a tension I can\u2019t ignore.', personB: 'Feeling that something essential is missing from my life or from me. The longing for what I don\u2019t have colors how I experience almost everything.' },
  '1-7': { label: 'Doing It Right vs. Keeping It Open', personA: 'Cutting corners, or letting something be done the wrong way. Even when no one else would notice, doing it improperly sits badly with me.', personB: 'Being tied down to one rigid way when other options exist. Rules that seem to exist only to constrain feel like something to get around.' },
  '2-4': { label: 'Others\u2019 Pain vs. My Own Lack', personA: 'Seeing someone I care about in need and being unable to help them. My attention goes straight to their feelings, often before I notice my own.', personB: 'Sitting with the sense that I\u2019m deficient, or that others have what I\u2019m missing. My attention turns inward to what\u2019s lacking, not outward to who needs me.' },
  '2-8': { label: 'Being Unappreciated vs. Being Overpowered', personA: 'Giving myself to people and feeling like it didn\u2019t matter to them. Being taken for granted by someone I\u2019ve supported is genuinely hard to take.', personB: 'Being put in a position where someone else holds power over me. I\u2019d far rather take charge than risk being dependent or controlled.' },
  '3-6': { label: 'Results vs. Planning', personA: 'Failing to reach the goal, or being seen as unsuccessful. What matters most is the result, and falling short of it is what I most want to avoid.', personB: 'Being caught unprepared for what could go wrong. I\u2019m most uneasy when I haven\u2019t worked through the contingencies and mapped out what might happen.' },
  '3-9': { label: 'Stalling vs. Being Pressured', personA: 'Being idle or unproductive, with nothing to point to for my time. Slowing down with no result to show makes me genuinely restless.', personB: 'Being pushed to assert myself or move at someone else\u2019s pace. Pressure to take a hard stance feels more uncomfortable to me than just going along.' },
  '5-7': { label: 'Depletion vs. Constraint', personA: 'Having too much asked of me before I\u2019m ready, draining my energy and space. When that happens, I pull back to protect what I have left.', personB: 'Being limited to too few options, or stuck in something that\u2019s gone flat. I keep my options open so I never feel cornered.' },
  '5-8': { label: 'Intrusion vs. Vulnerability', personA: 'Being intruded upon, or having more asked of me than I can give. My instinct is to withdraw and make myself small until I feel ready.', personB: 'Being made to feel weak or dependent on anyone. My instinct is to take up space and make sure I\u2019m not in a position to be controlled.' },
  '6-9': { label: 'Uncertainty vs. Disruption', personA: 'Not knowing what\u2019s coming, or who I can really count on. The uncertainty keeps me on alert until I feel genuinely prepared.', personB: 'Having my peace disturbed by tension or other people\u2019s demands. When conflict rises, I tend to disengage or go along rather than push back.' },
};

// Counter-type comparatives, 5 pairs, keyed by the AI Call #1 ct_pair field.
// Counter-type expression is Person A, lookalike is Person B (authored order;
// the "lower-numbered = Person A" rule is standard-mode only). One question,
// same stem as Q1. Source: hive_stage3_question_bank_v2_052926.docx \u00a7"Counter-Type Mode".
const STAGE3_CT_COMPARATIVES = {
  'SO-7': { ctId: 'CT-1', label: 'SO 7 vs. Type 2', counterType: 7, lookalike: 2, personA: 'I am sharing what I love with the people around me. I feel engaged, generous, and genuinely happy, and I want others to experience that same aliveness I feel.', personB: 'I am tuned in to what others need. I feel genuinely helpful, warm, and deeply connected, and I need to feel that my presence matters to them.' },
  'SX-6': { ctId: 'CT-2', label: 'SX 6 vs. Type 8', counterType: 6, lookalike: 8, personA: 'I am facing something head-on and not letting fear win. I feel courageous and alive, most myself when I\u2019m pushing toward the thing that scares me.', personB: 'I am fully in control and unbothered. I feel powerful and clear, with no fear underneath, just a certainty that I won\u2019t be controlled or pushed around.' },
  'SP-3': { ctId: 'CT-3', label: 'SP 3 vs. Type 1', counterType: 3, lookalike: 1, personA: 'I am getting things done and building something solid. I feel capable and self-sufficient, and I don\u2019t need recognition, just to know I\u2019ve made it on my own terms.', personB: 'I am doing things the right way. I feel principled and in integrity, and anything less than my own standard would feel like a betrayal of who I am.' },
  'SP-4': { ctId: 'CT-4', label: 'SP 4 vs. Type 3', counterType: 4, lookalike: 3, personA: 'I am proving something, to myself more than anyone else. I feel driven and resilient, like I\u2019m refusing to be defeated by a sense of not being enough.', personB: 'I am achieving something meaningful. I feel capable, successful, and recognized, and I want the people who matter to see that I\u2019ve done well.' },
  'SX-1': { ctId: 'CT-5', label: 'SX 1 vs. Type 8', counterType: 1, lookalike: 8, personA: 'I am fighting for something that genuinely matters. I feel intensely alive when I\u2019m up against something wrong, with a standard at stake I won\u2019t back down from.', personB: 'I am fully in control and unbothered. I feel powerful and clear, and I push hard because I won\u2019t be limited or told what I can\u2019t do.' },
};

// Load-time guard: fail loudly if the question bank was truncated or mis-keyed.
function validateStage3Bank() {
  const motCount = Object.keys(STAGE3_CORE_MOTIVATIONS).length;
  if (motCount !== 9) throw new Error(`[stage3] STAGE3_CORE_MOTIVATIONS must have 9 entries, found ${motCount}.`);
  const q2Keys = Object.keys(STAGE3_Q2_PAIRS);
  if (q2Keys.length !== 26) throw new Error(`[stage3] STAGE3_Q2_PAIRS must have 26 entries, found ${q2Keys.length}.`);
  q2Keys.forEach((k) => {
    const m = /^(\d)-(\d)$/.exec(k);
    if (!m || +m[1] >= +m[2]) throw new Error(`[stage3] STAGE3_Q2_PAIRS key "${k}" must be 'lower-higher' with lower < higher.`);
    const v = STAGE3_Q2_PAIRS[k];
    if (!v || !v.label || !v.personA || !v.personB) throw new Error(`[stage3] STAGE3_Q2_PAIRS["${k}"] missing label/personA/personB.`);
  });
  const ctKeys = Object.keys(STAGE3_CT_COMPARATIVES);
  if (ctKeys.length !== 5) throw new Error(`[stage3] STAGE3_CT_COMPARATIVES must have 5 entries, found ${ctKeys.length}.`);
  ctKeys.forEach((k) => {
    const v = STAGE3_CT_COMPARATIVES[k];
    if (!v || !v.ctId || !v.counterType || !v.lookalike || !v.personA || !v.personB) {
      throw new Error(`[stage3] STAGE3_CT_COMPARATIVES["${k}"] missing required fields.`);
    }
  });
}
validateStage3Bank();

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

const SUBTYPE_NAMES = {
  'sp-1': 'The Organizer',
  'so-1': 'The Social Reformer',
  'sx-1': 'The Evangelist',
  'sp-2': 'The Nurturer',
  'so-2': 'The Ambassador',
  'sx-2': 'The Healer',
  'sp-3': 'The Diligent Worker',
  'so-3': 'The Politician',
  'sx-3': 'The Movie Star',
  'sp-4': 'The Creative Individualist',
  'so-4': 'The Critical Commentator',
  'sx-4': 'The Dramatic Person',
  'sp-5': 'The Castle Defender',
  'so-5': 'The Professor',
  'sx-5': 'The Secret Agent',
  'sp-6': 'The Family Loyalist',
  'so-6': 'The Social Guardian',
  'sx-6': 'The Warrior',
  'sp-7': 'The Epicure',
  'so-7': 'The Social Visionary',
  'sx-7': 'The Adventurer',
  'sp-8': 'The Survivalist',
  'so-8': 'The Group Leader',
  'sx-8': 'The Commander',
  'sp-9': 'The Collector',
  'so-9': 'The Community Benefactor',
  'sx-9': 'The Seeker',
};

// =================== SCORING ENGINE ===================

// Stage 1 (v2) scoring — pure and deterministic: slider inputs in, raw profiles
// + high-ambiguity flag out. No center scoring, no Type->Center lookup, no
// HIGH/MEDIUM/LOW confidence labels, no counter-type flag — those mechanics are
// retired (design §4.3). The AI reasons over the raw profiles (§4.2, §6).
//
//   typeSliders:     { 1: [v,v,v,v,v], 2: [...], ..., 9: [...] }   each v in 0-100
//   instinctSliders: { SP: [v,v,v,v,v], SO: [...], SX: [...] }
//
// Each type/instinct score is the MEAN of its five sliders (sum / 5), landing on
// a 0-100 scale. The nine type scores form the raw type profile; the three
// instinct scores form the {SP, SO, SX} profile.
function scoreStage1Profile(typeSliders, instinctSliders) {
  const TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const INSTINCTS = ['SP', 'SO', 'SX'];

  // Mean of exactly five sliders. Throws loudly on a wrong-length input so a
  // future content/wiring change can't silently mis-normalize (e.g. divide a
  // four-slider group by five, or drop a slider).
  const mean5 = (arr, label) => {
    if (!Array.isArray(arr) || arr.length !== 5) {
      throw new Error(`[stage1] ${label} must have exactly 5 slider values, found ${arr ? arr.length : 'none'}.`);
    }
    return (arr[0] + arr[1] + arr[2] + arr[3] + arr[4]) / 5;
  };

  const typeProfile = {};
  TYPES.forEach((t) => { typeProfile[t] = mean5(typeSliders[t], `Type ${t}`); });

  const instinctProfile = {};
  INSTINCTS.forEach((i) => { instinctProfile[i] = mean5(instinctSliders[i], `Instinct ${i}`); });

  // Rank types by score descending; tie-break by type number ascending so the
  // ordering is fully deterministic.
  const rankedTypes = TYPES.slice().sort((a, b) =>
    (typeProfile[b] - typeProfile[a]) || (a - b)
  );
  const leadingType = rankedTypes[0];
  const alternateType = rankedTypes[1];
  const gap = typeProfile[leadingType] - typeProfile[alternateType];

  // High-ambiguity flag: top two type scores fall within HIGH_AMBIGUITY_MARGIN
  // (inclusive). A signal for the AI, not a routing directive.
  const highAmbiguity = gap <= HIGH_AMBIGUITY_MARGIN;

  // Raw dominant instinct (argmax) — NOT a mechanical confidence label. The AI
  // characterizes instinct dominance/confidence from the full profile; near-ties
  // are preserved by construction.
  const dominantInstinct = INSTINCTS.slice().sort((a, b) =>
    (instinctProfile[b] - instinctProfile[a]) || (INSTINCTS.indexOf(a) - INSTINCTS.indexOf(b))
  )[0];

  return {
    typeProfile,
    instinctProfile,
    leadingType,
    alternateType,
    gap,
    highAmbiguity,
    dominantInstinct,
  };
}

// =================== STAGE 3 HELPERS ===================

// Build Stage 3 routing from the frozen AI Call #1 contract (§7.1). Returns the
// shape renderStage3 / computeStage3Scores consume, or { mode: 'NONE' } when the
// AI declined a pairwise (stage3_mode = 'none' — a freak top-two outside the
// authored set, flagged "no pairwise" for Call #2). Standard pairs put the
// lower-numbered type as Person A; Q2 fires only when gap = 'tight' AND the pair
// is one of the 26 bespoke items. CT comparatives key off ct_pair and keep their
// authored A/B order (counter-type = Person A).
function buildStage3Routing(call1) {
  const mode = call1 && call1.stage3_mode;

  if (mode === 'counter_type') {
    const ct = STAGE3_CT_COMPARATIVES[call1.ct_pair];
    if (!ct) return { mode: 'NONE' }; // ct_pair absent / Null — no comparative to serve
    return {
      mode: 'COUNTER-TYPE',
      ctPair: call1.ct_pair,
      ctId: ct.ctId,
      label: ct.label,
      typeA: ct.counterType, // Person A
      typeB: ct.lookalike,   // Person B
    };
  }

  if (mode === 'standard') {
    const lead = +call1.leading_candidate;
    const alt = +call1.alternate_candidate;
    const lower = Math.min(lead, alt);
    const higher = Math.max(lead, alt);
    const pairKey = `${lower}-${higher}`;
    return {
      mode: 'STANDARD',
      pairKey,
      typeA: lower,
      typeB: higher,
      leading: lead,
      alternate: alt,
      gap: call1.gap,
      fireQ2: call1.gap === 'tight' && !!STAGE3_Q2_PAIRS[pairKey],
    };
  }

  // stage3_mode === 'none' (or missing/unrecognized) — skip the pairwise.
  return { mode: 'NONE' };
}

// Record the raw Stage 3 lean as one weighted observation for AI Call #2 (§7.3).
// No winner crowning and no confidence math — those dissolved into the AI. Reads
// the routing already stored on state.scores.stage3Pair plus the user's answers.
function computeStage3Scores() {
  const pair = state.scores.stage3Pair;
  const answers = state.stage3Answers;

  if (!pair || pair.mode === 'NONE') {
    return { mode: 'NONE', administered: false, noPairwise: true };
  }

  const q1 = answers[0] || null;

  if (pair.mode === 'COUNTER-TYPE') {
    return {
      mode: 'COUNTER-TYPE',
      administered: true,
      ctPair: pair.ctPair,
      ctId: pair.ctId,
      pair: pair.label,
      typeA: pair.typeA, // counter-type
      typeB: pair.typeB, // lookalike
      q1Answer: q1,
      q1Lean: describeStage3Answer(q1, pair.typeA, pair.typeB),
      q2Answer: null,
    };
  }

  // STANDARD — Q1 always, Q2 only when it fired.
  const q2 = pair.fireQ2 ? (answers[1] || null) : null;
  return {
    mode: 'STANDARD',
    administered: true,
    pairKey: pair.pairKey,
    typeA: pair.typeA,
    typeB: pair.typeB,
    leading: pair.leading,
    alternate: pair.alternate,
    q1Answer: q1,
    q1Lean: describeStage3Answer(q1, pair.typeA, pair.typeB),
    q2Answer: q2,
    q2Lean: q2 ? describeStage3Answer(q2, pair.typeA, pair.typeB) : null,
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

// Decide which Stage 4 path to run from the AI Call #1 candidate read (call1)
// and the raw Stage 3 lean (s3). v2 §8.1: routing re-keys on leading_candidate /
// alternate_candidate / stage3_mode / the Stage 3 lean, replacing the deleted
// center confidence + CT flag. Returns:
//   { option: 'A'|'B'|'MODIFIED_B',
//     path: 'STANDARD'|'COUNTER_TYPE_CONFIRMED'|'COUNTER_TYPE_AMBIGUOUS',
//     leadType, secondType?, ctKey? }
function resolveStage4Path(call1, s3) {
  // ---- counter_type: Person A = counter-type, Person B = lookalike ----
  if (s3.mode === 'COUNTER-TYPE') {
    // Only a clean lean toward the counter-type confirms it (Option A).
    if (s3.q1Answer === 'A') {
      return { option: 'A', path: 'COUNTER_TYPE_CONFIRMED', leadType: s3.typeA };
    }
    // Slight either way, or a clean lean toward the lookalike → re-test the CT
    // comparative in Stage 4 rather than crowning a mid-flow flip.
    return {
      option: 'MODIFIED_B',
      path: 'COUNTER_TYPE_AMBIGUOUS',
      ctKey: s3.ctPair,
      leadType: s3.typeA,   // counter-type
      secondType: s3.typeB, // lookalike
    };
  }

  const leadType = +call1.leading_candidate;
  const secondType = +call1.alternate_candidate;

  // ---- none: no pairwise lean exists → head-to-head of the AI's top two ----
  if (s3.mode === 'NONE') {
    return { option: 'B', path: 'STANDARD', leadType, secondType };
  }

  // ---- standard: q1Answer's A/B is keyed to lower/higher type #, not lead ----
  const leadingIsPersonA = s3.leading === s3.typeA;
  const cleanTowardLeading =
    (leadingIsPersonA && s3.q1Answer === 'A') ||
    (!leadingIsPersonA && s3.q1Answer === 'B');

  // Option A (3opt on the lead) only when the pairwise cleanly confirms the lead
  // AND the top two are not near-tied. Otherwise a lead-vs-alternate head-to-head.
  if (cleanTowardLeading && call1.gap !== 'tight') {
    return { option: 'A', path: 'STANDARD', leadType };
  }
  return { option: 'B', path: 'STANDARD', leadType, secondType };
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
    // Unreachable under valid flow. Reaching here requires exactly one of stress/security
    // confirmed (the only state past the CONFIRMED and REDIRECT branches above) AND the habit
    // question not having fired — but stress/security disagreement is exactly what makes
    // shouldFireHabit() fire, and the habit slot's Next button is gated until it's answered,
    // with stage4Sequence/stage4Answers kept in sync on back-nav. So one-confirmed always
    // yields a fired, answered habit -> branch (2) or (4), never here. Fail loud instead of
    // silently emitting AMBIGUOUS so a broken invariant surfaces.
    throw new Error('computeStage4Scores: unreachable state — exactly one of stress/security confirmed but the habit question did not fire. This violates the shouldFireHabit invariant (stress/security disagreement must trigger the habit question). Check shouldFireHabit(), the Next-gating on the habit slot, and stage4Sequence/stage4Answers sync in the Stage 4 Next handler.');
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

// Serializes the §6.2 AI Call #1 evidence set into the context block the AI
// receives after Stage 2. This is the v2 evidence set ONLY — raw slider profiles
// and verbatim answers, with NO engine verdict. The scoring engine no longer
// decides; AI Call #1 does the ranking/typing from this evidence. The
// OUTPUT_FORMAT JSON-priming block is appended by the caller (callAPI), never
// here.
//
// `s` is the scoreStage1Profile output (state.scores): { typeProfile,
// instinctProfile, leadingType, alternateType, gap, highAmbiguity,
// dominantInstinct }. Stage 0 text, Stage 1 opens, and Stage 2 answers are read
// from `state` directly.
//
// Block order:
//   1. Client information + Stage 0 raw open-text responses
//   2. Stage 1 — raw nine-type slider profile (+ leading/alternate/gap/ambiguity)
//   3. Stage 1 — raw three-instinct slider profile (+ dominant instinct)
//   4. Stage 1 — open responses (verbatim)
//   5. Stage 2 — three framework answers (evidence only, no scoring)
// ---- Shared evidence-block builders (blocks 1-5) ----
// Both buildContextBlock (Call #1) and buildCall2Context (Call #2) must present
// the Stage 0/1/2 evidence identically. These helpers are the single source of
// truth so the two context blocks cannot drift. `s` is the scoreStage1Profile
// output (state.scores); Stage 0 text, Stage 1 opens, and Stage 2 answers are
// read from `state` directly.

function _evidenceHeaderBlock() {
  const a0 = state.stage0Answers || {};
  const intake = state.intake || {};
  const clientName = [intake.firstName, intake.lastName].filter(Boolean).join(' ') || 'Not provided';
  const clientOrg = intake.organization || 'Not provided';
  const clientCoach = intake.coach || 'Not provided';
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
Most problematic quality: "${a0.q4 || 'not provided'}"`;
}

function _stage1TypeBlock(s) {
  // Stage 1 — raw nine-type slider profile, rank-ordered high to low. Labeled as
  // raw evidence, not a verdict: the AI does the typing in Call #1.
  const TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const rankedTypes = TYPES.slice().sort((x, y) =>
    (s.typeProfile[y] - s.typeProfile[x]) || (x - y)
  );
  const typeRows = rankedTypes
    .map((t) => `Type ${t} (${TYPE_NAMES[t]}): ${s.typeProfile[t].toFixed(1)} / 100`)
    .join('\n');
  return `Stage 1 — Nine-Type Profile (raw slider scores 0-100; each score is the mean of five self-report statements)
This is raw self-report evidence, NOT a verdict. Rank-ordered high to low:
${typeRows}
Leading slider type: Type ${s.leadingType} (${TYPE_NAMES[s.leadingType]})
Closest alternate: Type ${s.alternateType} (${TYPE_NAMES[s.alternateType]})
Gap (leading minus alternate): ${s.gap.toFixed(1)} points
High-ambiguity flag (top two within ${HIGH_AMBIGUITY_MARGIN} points): ${s.highAmbiguity ? 'YES' : 'NO'}`;
}

function _stage1InstinctBlock(s) {
  // Stage 1 — raw three-instinct slider profile. No mechanical identified-instinct
  // or confidence label; the AI characterizes dominance from the full profile.
  const INSTINCTS = ['SP', 'SO', 'SX'];
  const rankedInst = INSTINCTS.slice().sort((x, y) =>
    (s.instinctProfile[y] - s.instinctProfile[x]) || (INSTINCTS.indexOf(x) - INSTINCTS.indexOf(y))
  );
  const instRows = rankedInst
    .map((i) => `${i}: ${s.instinctProfile[i].toFixed(1)} / 100`)
    .join('\n');
  return `Stage 1 — Three-Instinct Profile (raw slider scores 0-100; each score is the mean of five self-report statements)
Raw self-report evidence, NOT a verdict. Rank-ordered high to low:
${instRows}
Dominant slider instinct: ${s.dominantInstinct}`;
}

function _stage1OpenBlock() {
  // Stage 1 — open responses, verbatim.
  const typeOpen = state.stage1TypeOpen && state.stage1TypeOpen.trim()
    ? `"${state.stage1TypeOpen.trim()}"` : '[none provided]';
  const instinctOpen = state.stage1InstinctOpen && state.stage1InstinctOpen.trim()
    ? `"${state.stage1InstinctOpen.trim()}"` : '[none provided]';
  return `Stage 1 — Open Responses (client's own words)
After the type sliders: ${typeOpen}
After the instinct sliders: ${instinctOpen}`;
}

function _stage2EvidenceBlock() {
  // Stage 2 — three framework answers as evidence (no intersection scoring).
  // Q1/Q2 are single-select uppercase letters; Q3 is the Centers ranking.
  const s2a = state.stage2Answers || [];
  const q1 = s2a[0];
  const q2 = s2a[1];
  const q1Line = q1
    ? `Q1 Hornevian (social stance): ${q1} (${STAGE2_BUCKET_LABELS.Hornevian[q1]})`
    : 'Q1 Hornevian (social stance): [not answered]';
  const q2Line = q2
    ? `Q2 Harmonic (conflict response): ${q2} (${STAGE2_BUCKET_LABELS.Harmonic[q2]})`
    : 'Q2 Harmonic (conflict response): [not answered]';

  // Q3 Centers decision-making: stored as { a, b, c } ranks 1-3 (1 = most
  // relied on). Order the triple by ascending rank — index 0 is the client's
  // most-relied-on center, index 2 the least. The AI receives the full ordered
  // triple, not just the top pick.
  const Q3_LABELS = { a: 'Gut', b: 'Feelings', c: 'Facts' };
  const q3 = s2a[2] || {};
  const q3Ordered = ['a', 'b', 'c']
    .filter((k) => q3[k] != null)
    .sort((x, y) => q3[x] - q3[y])
    .map((k) => Q3_LABELS[k]);
  const q3Line = q3Ordered.length === 3
    ? `Q3 Centers (decision-making), ranked most to least relied on:
  1st (most relied on): ${q3Ordered[0]}
  2nd: ${q3Ordered[1]}
  3rd (least relied on): ${q3Ordered[2]}`
    : 'Q3 Centers (decision-making): [not answered]';

  return `Stage 2 — Framework Answers (evidence only; the engine does not score these)
${q1Line}
${q2Line}
${q3Line}`;
}

function buildContextBlock(s) {
  const parts = [
    _evidenceHeaderBlock(),
    _stage1TypeBlock(s),
    _stage1InstinctBlock(s),
    _stage1OpenBlock(),
    _stage2EvidenceBlock(),
  ].filter(p => p && p.trim().length > 0);

  return parts.join('\n\n');
}

// ---- AI Call #2 case-file blocks (6-8) ----

// Deterministic ranking_override (§10.3): true when AI Call #1 promoted a type
// that was NOT the raw slider leader. The slider leader is s.leadingType — the
// canonical, tie-broken argmax of the type profile (lower type number wins a
// tie) — NOT a fresh argmax, so the tie-break matches the rest of the engine.
// This is ground truth; the AI never recomputes it. Used by both buildCall2Context
// (renders the pre-resolved sentence) and callAPI (sets the payload field) so the
// two cannot drift.
function rankingOverrideInfo(s) {
  const sliderLeader = s.leadingType;
  const call1Leader = state.call1Result.leading_candidate;
  return { override: call1Leader !== sliderLeader, sliderLeader, call1Leader };
}

// Block 6 — the frozen AI Call #1 §6.3 contract, presented as the AI's own
// coherence judgment (not slider math). supporting_language is the literal
// string "Null" when no aligning fragment was found; we render an explicit
// "[none found]" line in that case so Call #2 cannot mistake the sentinel for a
// quotable fragment. The ranking_override line is pre-resolved ground truth (see
// rankingOverrideInfo) — the AI reads it, it does not decide it.
function _call1ResultBlock(s) {
  const c1 = state.call1Result;
  const rankRows = (c1.ranking || [])
    .map((r) => `Type ${r.type} (${TYPE_NAMES[r.type]}): ${r.score} / 100`)
    .join('\n');
  const support = (c1.supporting_language && c1.supporting_language !== 'Null')
    ? `"${c1.supporting_language}"`
    : '[none — no aligning open-response fragment was found]';
  const ctPair = (c1.ct_pair && c1.ct_pair !== 'Null') ? c1.ct_pair : '[not applicable]';
  const ro = rankingOverrideInfo(s);
  const roLine = ro.override
    ? `Ranking override: YES — AI Call #1 promoted Type ${ro.call1Leader} (${TYPE_NAMES[ro.call1Leader]}) over the raw slider leader Type ${ro.sliderLeader} (${TYPE_NAMES[ro.sliderLeader]}).`
    : `Ranking override: NO — the AI Call #1 leader matches the raw slider leader (Type ${ro.sliderLeader}, ${TYPE_NAMES[ro.sliderLeader]}).`;
  return `AI CALL #1 RESULT — coherence-weighted ranking. This is the AI's own judgment of fit, not a recomputation of slider math.
Coherence ranking (0-100), rank-ordered high to low:
${rankRows}
Leading candidate: Type ${c1.leading_candidate} (${TYPE_NAMES[c1.leading_candidate]})
Alternate candidate: Type ${c1.alternate_candidate} (${TYPE_NAMES[c1.alternate_candidate]})
Third candidate (reasoning context only — NOT shown in either report): Type ${c1.third_candidate} (${TYPE_NAMES[c1.third_candidate]})
Gap between leading and alternate: ${c1.gap}
Supporting open-response language: ${support}
Stage 3 routing mode (Call #1): ${c1.stage3_mode}
Counter-type pair (Call #1): ${ctPair}
Dominant instinct (Call #1): ${c1.dominant_instinct}
${roLine}`;
}

// Block 7 — Stage 3 lean. A legitimately-absent Stage 3 is valid data
// (noPairwise: the top-two pair fell outside the authored question set); render
// the explicit "not administered" line rather than guarding it as breakage.
function _stage3LeanBlock(s) {
  const s3 = s.stage3 || {};
  if (!s3.administered || s3.noPairwise) {
    return `Stage 3 — Discriminating Pair
Stage 3: not administered — top-two pair outside the authored question set.`;
  }
  const lines = ['Stage 3 — Discriminating Pair', `Mode: ${s3.mode}`];
  if (s3.mode === 'COUNTER-TYPE') {
    lines.push(`Counter-type pair: ${s3.ctPair} (${s3.pair})`);
    lines.push(`Q1 lean: ${s3.q1Lean}`);
  } else {
    lines.push(`Pair: ${s3.pairKey} (Type ${s3.typeA} vs Type ${s3.typeB})`);
    lines.push(`Q1 lean: ${s3.q1Lean}`);
    if (s3.q2Answer) lines.push(`Q2 lean: ${s3.q2Lean}`);
  }
  return lines.join('\n');
}

// Block 8 — Stage 4 movement verification: evidence + the deterministic outcome.
function _stage4EvidenceBlock(s) {
  const s4 = s.stage4 || {};
  const fmt = (v) => (v === true ? 'YES' : v === false ? 'NO' : 'N/A');
  const lines = [
    'Stage 4 — Movement Verification',
    `Path: ${s4.path}   Option: ${s4.option}`,
    `Outcome: ${s4.outcome}`,
    `Stress point — ${s4.stressDescription || '[no answer]'} (matched leading type: ${fmt(s4.stressConfirmed)})`,
    `Security point — ${s4.securityDescription || '[no answer]'} (matched leading type: ${fmt(s4.securityConfirmed)})`,
  ];
  if (s4.habitAnswer != null) {
    lines.push(`Habit of Mind — ${s4.habitDescription || '[no answer]'} (matched leading type: ${fmt(s4.habitConfirmed)})`);
  } else {
    lines.push('Habit of Mind — not administered.');
  }
  return lines.join('\n');
}

// Assembles the full AI Call #2 case file (§9.1): the Stage 0/1/2 evidence
// (shared with Call #1), the frozen AI Call #1 result, the Stage 3 lean, and the
// Stage 4 evidence + outcome. OUTPUT_FORMAT is NOT appended here — /api/submit
// appends it server-side so the schema stays absolute-last.
//
// Loud guards, same discipline as validateStage1Statements(): Call #2 must never
// fire on a broken case file. A missing call1Result / scores / stage4 is a
// broken-flow signal, not a degrade-gracefully case — fail explicitly rather
// than emitting an empty or fabricated block.
function buildCall2Context(s) {
  if (!s || typeof s !== 'object') {
    throw new Error('[call2] state.scores is missing — Call #2 cannot build a case file without the Stage 1 profile.');
  }
  if (!state.call1Result || typeof state.call1Result !== 'object') {
    throw new Error('[call2] state.call1Result is missing — Call #2 cannot fire without the AI Call #1 result. This indicates Call #1 failed or was skipped; refusing to build a context block with absent case-file evidence.');
  }
  if (!s.stage4 || typeof s.stage4 !== 'object') {
    throw new Error('[call2] state.scores.stage4 is missing — Call #2 runs after Stage 4; a missing Stage 4 outcome means the flow is broken.');
  }

  const parts = [
    _evidenceHeaderBlock(),
    _stage1TypeBlock(s),
    _stage1InstinctBlock(s),
    _stage1OpenBlock(),
    _stage2EvidenceBlock(),
    _call1ResultBlock(s),
    _stage3LeanBlock(s),
    _stage4EvidenceBlock(s),
  ].filter(p => p && p.trim().length > 0);

  return parts.join('\n\n');
}
// =================== RENDER ===================

const SAVE_LATER_PHASES = new Set([
  'stage0', 'mid-assessment-reminders', 'stage1', 'ct-analyzing',
  'stage2', 'call1-analyzing', 'stage3', 'stage4', 'finalopen',
]);

function render() {
  updateProgress();
  const app = document.getElementById('app');

  switch (state.phase) {
    case 'welcome':        app.innerHTML = renderWelcome(); break;
    case 'intake':         app.innerHTML = renderIntake(); break;
    case 'stage0':         app.innerHTML = renderStage0(); break;
    case 'mid-assessment-reminders': app.innerHTML = renderMidAssessmentReminders(); break;
    case 'stage1':         app.innerHTML = renderStage1(); break;
    case 'ct-analyzing':   app.innerHTML = renderCtAnalyzing(); break;
    case 'stage2':         app.innerHTML = renderStage2(); break;
    case 'call1-analyzing': app.innerHTML = renderCall1Analyzing(); break;
    case 'stage3':         app.innerHTML = renderStage3(); break;
    case 'stage4':         app.innerHTML = renderStage4(); break;
    case 'finalopen':      app.innerHTML = renderFinalOpen(); break;
    case 'stage1complete': app.innerHTML = renderStage1Complete(); break;
    case 'processing':     app.innerHTML = renderProcessing(); break;
    case 'confirmation':   app.innerHTML = renderConfirmation(); break;
    case 'error':          app.innerHTML = renderError(); break;
  }

  // Inject Save and Continue Later link for active assessment stages. It sits
  // just left of the primary action (Continue/Submit) inside the screen's
  // .nav-row, styled as a ghost button to match the Back/Skip controls there.
  // Analyzing interstitials have no nav-row, so they fall back to a centered bar.
  if (SAVE_LATER_PHASES.has(state.phase) && state.intake && state.intake.token) {
    const navRow = app.querySelector('.nav-row');
    const primaryBtn = navRow && navRow.querySelector('.btn-primary');
    if (navRow && primaryBtn) {
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-ghost';
      saveBtn.id = 'btn-save-later';
      saveBtn.textContent = 'Save and Continue Later';
      navRow.insertBefore(saveBtn, primaryBtn);
    } else {
      const saveLaterEl = document.createElement('div');
      saveLaterEl.id = 'save-later-bar';
      saveLaterEl.style.cssText = 'text-align:center;padding:16px 0 8px;';
      saveLaterEl.innerHTML = '<button id="btn-save-later" style="background:none;border:none;color:#7A96A6;font-size:13px;font-family:Georgia,serif;cursor:pointer;text-decoration:underline;padding:4px 8px;">Save and Continue Later</button>';
      app.appendChild(saveLaterEl);
    }
  }

  attachHandlers();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Welcome ----
function renderWelcome() {
  return `<div class="screen">
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
  const pct = Math.min(100, Math.round((getQuestionsAnswered() / 23) * 100));
  return `<div class="screen">
    <div class="progress-section">
      <div class="progress-label">Completed</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>
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

  const pct0 = Math.min(100, Math.round((getQuestionsAnswered() / 23) * 100));
  return `<div class="screen">
    <div class="progress-section">
      <div class="progress-label">Completed</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct0}%"></div></div>
    </div>
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

// ---- Mid-Assessment Reminders ----
// Fires after Stage 0 Q4 is submitted and before Stage 1 Q1. Doubles as latency
// cover for the Stage 0 mini-call (kicked off from attachHandlers on entry).
function renderMidAssessmentReminders() {
  const pctMid = Math.min(100, Math.round((getQuestionsAnswered() / 23) * 100));
  return `<div class="screen">
    <div class="progress-section">
      <div class="progress-label">Completed</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pctMid}%"></div></div>
    </div>
    <div class="q-text" style="margin-bottom:18px;">Great work — you’ve completed the first part of the assessment. If you want to review or edit your responses, hit the “Go Back” button. Otherwise, here are a few tips to help you complete the rest of the assessment:</div>
    <ul style="margin:0 0 24px;padding-left:20px;line-height:1.7;font-size:14px;color:#1A2B33;">
      <li style="margin-bottom:10px;">Answer the questions in the context of your life in general and try not to confine your answers to your work life only.</li>
      <li style="margin-bottom:10px;">Choose a response that applies to the arc of your life, rather than answering only from what is true in the current moment. If you get stuck on a question, recall how your 25-year-old self might respond to the questions.</li>
      <li style="margin-bottom:10px;">Try to complete the assessment in one sitting without interruptions.</li>
      <li style="margin-bottom:10px;">From here it should take you no longer than 20–25 minutes. If it’s taking longer, that could mean you’re overthinking things. Trust your gut when this happens.</li>
      <li style="margin-bottom:10px;">Now, take a deep breath, hit “Continue” and have fun!</li>
    </ul>
    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-mid-back">Go Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-mid-continue">Continue</button>
    </div>
  </div>`;
}

// ---- CT Analyzing Transition ----
// Fires between Stage 1 and Stage 2 only when a CT flag was raised in Stage 1.
// Provides latency cover for the CT mini-call, which runs in the background
// from attachHandlers. Auto-advances to Stage 2 on success or after the
// 8-second timeout. The progress bar reflects Stage 1 completion (14/23).
function renderCtAnalyzing() {
  const pctCt = Math.min(100, Math.round((getQuestionsAnswered() / 23) * 100));
  return `<div class="screen">
    <div class="progress-section">
      <div class="progress-label">Completed</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pctCt}%"></div></div>
    </div>
    <div class="processing-wrap">
      <div class="spinner"></div>
      <div class="processing-heading">Analyzing your responses…</div>
      <div class="processing-sub">Thanks for your patience — we’re preparing your next set of questions.</div>
    </div>
  </div>`;
}

// AI Call #1 interstitial — latency cover while the reasoning call runs after
// Stage 2. While the call is in flight it shows the spinner; once it resolves it
// shows a Continue button that advances into Stage 3 off state.call1Result (the
// routing is built when Continue is clicked, in attachHandlers).
function renderCall1Analyzing() {
  const pctC1 = Math.min(100, Math.round((getQuestionsAnswered() / 23) * 100));
  const done = state._call1Done;
  const heading = done ? 'Analysis complete' : 'Analyzing your responses…';
  const sub = done
    ? 'Your next set of questions is being prepared.'
    : 'Thanks for your patience — we’re weighing everything you’ve told us.';
  const spinner = done ? '' : '<div class="spinner"></div>';
  const continueBtn = done
    ? `<div class="nav-row"><div class="spacer"></div><button class="btn btn-primary" id="btn-next">Continue</button></div>`
    : '';
  return `<div class="screen">
    <div class="progress-section">
      <div class="progress-label">Completed</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pctC1}%"></div></div>
    </div>
    <div class="processing-wrap">
      ${spinner}
      <div class="processing-heading">${heading}</div>
      <div class="processing-sub">${sub}</div>
    </div>
    ${continueBtn}
  </div>`;
}

// ---- Stage 1 (v2 sliders) ----
function renderStage1() {
  const screen = STAGE1_SCREENS[state.stage1Idx];
  const pct1 = Math.min(100, Math.round((getQuestionsAnswered() / 23) * 100));
  const staleNotice = state._stage1StaleNotice
    ? `<div class="stale-notice">We’ve updated the assessment — please restart from the beginning.</div>`
    : '';
  const header = `
    <div class="progress-section">
      <div class="progress-label">Completed</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct1}%"></div></div>
    </div>
    ${staleNotice}`;

  // Optional open-response screens — never gate Continue.
  if (screen.kind === 'type-open' || screen.kind === 'instinct-open') {
    const isType = screen.kind === 'type-open';
    const val = isType ? state.stage1TypeOpen : state.stage1InstinctOpen;
    const prompt = isType
      ? 'Is there anything about what drives you that those statements didn’t capture? (Optional)'
      : 'Is there anything about where your attention and energy naturally go that you’d like to add? (Optional)';
    return `<div class="screen">
      ${header}
      <div class="q-text">${prompt}</div>
      <textarea class="text-input" id="stage1-open" placeholder="Type your response here… (optional)">${esc(val || '')}</textarea>
      <div class="nav-row">
        <button class="btn btn-ghost" id="btn-back">Back</button>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="btn-next">Continue</button>
      </div>
    </div>`;
  }

  // Slider screens.
  const slots = stage1ScreenSlots(screen);
  const N = slots.length;
  const touchedCount = slots.filter((s) => stage1SlotValue(s) !== null).length;
  const allTouched = touchedCount === N;

  let blocksHtml = '';
  let lastGroup = null;
  slots.forEach((slot, i) => {
    if (slot.groupKey !== lastGroup) {
      lastGroup = slot.groupKey;
      // Beta-only group header (hidden in production via CSS). The client sees a
      // continuous list of statements with no type/instinct labels.
      const pill = slot.groupKind === 'type' ? slot.groupKey : slot.groupKey;
      const name = slot.groupKind === 'type'
        ? `Type ${slot.groupKey} — ${TYPE_NAMES[slot.groupKey]}`
        : `Instinct — ${slot.groupKey}`;
      blocksHtml += `<div class="type-hdr"><span class="type-hdr-pill">${pill}</span><span class="type-hdr-name">${esc(name)}</span></div>`;
    }
    const v = stage1SlotValue(slot);
    const touched = v !== null;
    const pos = touched ? v : 50;
    blocksHtml += `
      <div class="stmt-block">
        <div class="stmt-cat">${esc(slot.statement.dimension)}</div>
        <div class="stmt-text">${esc(slot.statement.text)}</div>
        <div class="pole-row">
          <span class="pole pole-left"><span class="pole-full">Not like me</span><span class="pole-short">Not like me</span></span>
          <div class="slider-track-wrap" id="tw${i}">
            <div class="track-bg" id="track${i}"></div>
            <input type="range" min="0" max="100" value="${pos}" id="s${i}" class="hive-range" aria-label="${esc(slot.statement.text)}" />
            <div class="thumb-vis ${touched ? 'grabbing' : 'bar'}" id="th${i}"></div>
          </div>
          <span class="pole pole-right"><span class="pole-full">Very much like me</span><span class="pole-short">Very much</span></span>
        </div>
      </div>`;
  });

  return `<div class="screen">
    ${header}
    <div class="slider-progress">
      <div class="slider-progress-track"><div class="slider-progress-fill" id="prog" style="width:${Math.round((touchedCount / N) * 100)}%"></div></div>
      <div class="slider-progress-txt" id="prog-txt">${touchedCount} of ${N} answered</div>
    </div>
    <p class="slider-instr">Move each slider to show how much each statement is like you.</p>
    <div class="stmt-list">${blocksHtml}</div>
    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-back">Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${allTouched ? '' : 'disabled'}>Continue</button>
    </div>
  </div>`;
}

// ---- Stage 2: Cross-Referencing ----
function renderStage2() {
  const q = STAGE2_QUESTIONS[state.stage2Idx];
  const pct2 = Math.min(100, Math.round((getQuestionsAnswered() / 23) * 100));

  let bodyHtml, answered;

  if (q.format === 'ranking') {
    // Centers decision-making question — rank Gut / Feelings / Facts (1st–3rd).
    // Reuses the Stage 1 rank-button markup and CSS. The answer is stored as a
    // { a, b, c } ranks object (ranks 1/2/3), not a single 'A'|'B'|'C' string.
    const stored = state.stage2Answers[state.stage2Idx];
    const r = (stored && typeof stored === 'object') ? stored : { a: null, b: null, c: null };
    answered = r.a !== null && r.b !== null && r.c !== null;

    const rankBtns = (letter) => [1, 2, 3].map((rank) =>
      `<button class="rank-btn ${r[letter] === rank ? 'active' : ''}" data-rank="${rank}" data-opt="${letter}">
        ${rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}
      </button>`
    ).join('');
    const rankClass = (letter) => r[letter] ? `ranked-${r[letter]}` : '';
    const badgeClass = (letter) => r[letter] ? `r${r[letter]}` : '';
    const badgeText = (letter) => r[letter]
      ? (r[letter] === 1 ? '1st — Most important' : r[letter] === 2 ? '2nd' : '3rd — Least important')
      : 'Not yet ranked';
    const optHtml = (letter) => `
      <div class="rank-option ${rankClass(letter)}">
        <div class="rank-option-header">
          <span class="rank-badge ${badgeClass(letter)}">${badgeText(letter)}</span>
        </div>
        <div class="rank-option-text">${esc(q.options[letter])}</div>
        <div class="rank-btn-group">${rankBtns(letter)}</div>
      </div>`;
    bodyHtml = `
      <p style="font-size:13px;color:var(--ink-lt);margin-bottom:16px;">Rank each from most important <strong>(1st)</strong> to least important <strong>(3rd)</strong>.</p>
      <div class="rank-options">
        ${optHtml('a')}
        ${optHtml('b')}
        ${optHtml('c')}
      </div>`;
  } else {
    const sel = state.stage2Answers[state.stage2Idx] || null;
    answered = !!sel;
    const optHtml = (key) => `
      <div class="person-option ${sel === key ? 'selected' : ''}" data-choice="${key}">
        <div class="person-text">${esc(q.options[key])}</div>
      </div>`;
    bodyHtml = `
      <div class="person-options">
        ${optHtml('A')}
        ${optHtml('B')}
        ${optHtml('C')}
      </div>`;
  }

  return `<div class="screen">
    <div class="progress-section">
      <div class="progress-label">Completed</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct2}%"></div></div>
    </div>
    <div class="q-text">${esc(q.text)}</div>
    ${bodyHtml}
    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-back">Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${answered ? '' : 'disabled'}>Continue</button>
    </div>
  </div>`;
}

// ---- Stage 3: Pairwise Discrimination ----
// Renders whichever Stage 3 question is currently active. The pair and mode
// were resolved when Stage 2 finished (stored on state.scores.stage3Pair).
function renderStage3() {
  const s = state.scores;
  const pair = s.stage3Pair; // { mode:'STANDARD'|'COUNTER-TYPE', pairKey|ctPair, typeA, typeB, fireQ2? }
  const idx = state.stage3Idx;
  const sel = state.stage3Answers[idx] || null;

  // Resolve Person A / Person B content based on mode and current question.
  let stem, personAText, personBText, subtitle;
  if (pair.mode === 'COUNTER-TYPE') {
    const ct = STAGE3_CT_COMPARATIVES[pair.ctPair];
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
    const av = STAGE3_Q2_PAIRS[pair.pairKey];
    stem = STAGE3_Q2_STEM;
    personAText = av.personA;
    personBText = av.personB;
    subtitle = `Type ${pair.typeA} vs. Type ${pair.typeB} \u00b7 ${av.label}`;
  }

  const totalQs = pair.mode === 'COUNTER-TYPE' ? 1 : (pair.fireQ2 ? 2 : 1);
  const isLast = idx === totalQs - 1;

  const pct3 = Math.min(100, Math.round((getQuestionsAnswered() / 23) * 100));
  return `<div class="screen">
    <div class="progress-section">
      <div class="progress-label">Completed</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct3}%"></div></div>
    </div>
    <div class="q-text">${esc(stem)}</div>

    <div class="person-options">
      ${render4WayOptions(personAText, personBText, sel)}
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

  const pct4 = Math.min(100, Math.round((getQuestionsAnswered() / 23) * 100));
  return `<div class="screen">
    <div class="progress-section">
      <div class="progress-label">Completed</div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct4}%"></div></div>
    </div>
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
    <div class="person-option ${sel === 'A-slight' ? 'selected' : ''}" data-choice="A-slight">
      <div class="person-label">Both, but more A</div>
    </div>
    <div class="person-option ${sel === 'B-slight' ? 'selected' : ''}" data-choice="B-slight">
      <div class="person-label">Both, but more B</div>
    </div>
  `;
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
      stage0_signal: null, stage0LastSnapshot: null,
      ctAdjustment: null, ctLastSnapshot: null,
      stage1Idx: 0, stage1TypeSliders: {}, stage1InstinctSliders: {},
      stage1TypeOpen: '', stage1InstinctOpen: '', _stage1StaleNotice: false,
      stage2Idx: 0, stage2Answers: [],
      call1Result: null, call1LastSnapshot: null, _call1Done: false, noPairwise: false,
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
        // Stage 0 complete — pause on Mid-Assessment Reminders before Stage 1.
        // The mini-call is fired from that screen's attachHandlers block.
        state.phase = 'mid-assessment-reminders';
        render();
      }
    });
  }

  // ---- Mid-Assessment Reminders ----
  if (state.phase === 'mid-assessment-reminders') {
    // Fire the Stage 0 mini-call on entry — runs in the background, never blocks.
    // Snapshot comparison inside the function skips the call when responses
    // haven't changed since the last successful fire (so navigating back/forward
    // without edits is a no-op, but editing any answer triggers a fresh call).
    fireStage0MiniCall();

    const btnMidBack = document.getElementById('btn-mid-back');
    if (btnMidBack) btnMidBack.addEventListener('click', () => {
      state.phase = 'stage0';
      state.stage0Idx = 3;
      render();
    });

    const btnMidContinue = document.getElementById('btn-mid-continue');
    if (btnMidContinue) btnMidContinue.addEventListener('click', () => {
      initStage1();
      state.phase = 'stage1';
      state.stage1Idx = 0;
      render();
      saveSessionState();
    });
  }

  // ---- Stage 1 (v2 sliders) ----
  if (state.phase === 'stage1') {
    const screen = STAGE1_SCREENS[state.stage1Idx];

    // Detach the previous render's resize handler before (re)wiring this screen,
    // so listeners don't accumulate and a stale handler never fires against a
    // DOM that no longer holds these sliders.
    if (_stage1ResizeHandler) {
      window.removeEventListener('resize', _stage1ResizeHandler);
      _stage1ResizeHandler = null;
    }

    if (screen.kind === 'type-sliders' || screen.kind === 'instinct-sliders') {
      const slots = stage1ScreenSlots(screen);
      const N = slots.length;
      const THUMB = 11; // half the grabbing-handle diameter, keeps it on-track

      const valToColor = (v) => {
        const t = v / 100;
        const r = Math.round(180 + (24 - 180) * t);
        const g = Math.round(210 + (95 - 210) * t);
        const b = Math.round(240 + (165 - 240) * t);
        return `rgb(${r},${g},${b})`;
      };
      const trackWidth = (i) => {
        const tw = document.getElementById('tw' + i);
        return tw ? tw.getBoundingClientRect().width : 0;
      };
      const placeThumb = (i, pct) => {
        const th = document.getElementById('th' + i);
        const w = trackWidth(i);
        if (th && w) th.style.left = (THUMB + (pct / 100) * (w - THUMB * 2)) + 'px';
      };
      const renderTrack = (i, v) => {
        const el = document.getElementById('track' + i);
        const w = trackWidth(i);
        if (!el || !w) return;
        const leftPx = THUMB + (v / 100) * (w - THUMB * 2);
        const pct = Math.round((leftPx / w) * 100);
        el.style.background =
          `linear-gradient(to right, rgba(180,210,240,0.18) 0%, ${valToColor(v)} ${pct}%, var(--border) ${pct}%, var(--border) 100%)`;
      };
      const refreshGate = () => {
        const n = slots.filter((s) => stage1SlotValue(s) !== null).length;
        const prog = document.getElementById('prog');
        const txt = document.getElementById('prog-txt');
        if (prog) prog.style.width = Math.round((n / N) * 100) + '%';
        if (txt) txt.textContent = n + ' of ' + N + ' answered';
        const btn = document.getElementById('btn-next');
        if (btn) btn.disabled = n !== N;
      };

      // Position every handle once the DOM has laid out (getBoundingClientRect
      // reads 0 before layout). Re-runs on resize. Bails if these sliders are
      // no longer mounted (navigation raced the timer / a stale resize fired).
      const init = () => {
        if (!document.getElementById('tw0')) return;
        slots.forEach((slot, i) => {
          const v = stage1SlotValue(slot);
          placeThumb(i, v === null ? 50 : v);
          const el = document.getElementById('track' + i);
          if (el) {
            if (v === null) el.style.background = 'var(--border)';
            else renderTrack(i, v);
          }
        });
      };
      setTimeout(init, 60);
      _stage1ResizeHandler = init;
      window.addEventListener('resize', init);

      slots.forEach((slot, i) => {
        const input = document.getElementById('s' + i);
        const thumb = document.getElementById('th' + i);
        if (!input || !thumb) return;

        // First contact: morph the bar handle into the grab circle and record a
        // value even if the client never drags (a deliberate touch counts; an
        // untouched midpoint does not). Fires before any movement, per spec.
        const grab = () => {
          if (thumb.classList.contains('bar')) {
            thumb.classList.remove('bar');
            thumb.classList.add('grabbing');
          }
          const v = parseInt(input.value, 10);
          thumb.style.background = valToColor(v);
          if (stage1SlotValue(slot) === null) stage1SetSlotValue(slot, v);
          renderTrack(i, v);
          placeThumb(i, v);
          refreshGate();
        };
        input.addEventListener('mousedown', grab);
        input.addEventListener('touchstart', grab);

        input.addEventListener('input', () => {
          // Keyboard users reach here without a mousedown — morph on first input.
          if (thumb.classList.contains('bar')) {
            thumb.classList.remove('bar');
            thumb.classList.add('grabbing');
          }
          const v = parseInt(input.value, 10);
          stage1SetSlotValue(slot, v);
          thumb.style.background = valToColor(v);
          renderTrack(i, v);
          placeThumb(i, v);
          refreshGate();
        });
      });
    } else {
      // Open-response screen — capture text, never gate Continue.
      const ta = document.getElementById('stage1-open');
      if (ta) ta.addEventListener('input', () => {
        if (screen.kind === 'type-open') state.stage1TypeOpen = ta.value;
        else state.stage1InstinctOpen = ta.value;
      });
    }

    // Shared nav (all Stage 1 screens). Any navigation clears the stale notice.
    const btnBack1 = document.getElementById('btn-back');
    if (btnBack1) btnBack1.addEventListener('click', () => {
      state._stage1StaleNotice = false;
      if (state.stage1Idx > 0) { state.stage1Idx--; render(); }
      else { state.phase = 'stage0'; state.stage0Idx = 3; render(); }
    });

    const btnNext1 = document.getElementById('btn-next');
    if (btnNext1) btnNext1.addEventListener('click', () => {
      state._stage1StaleNotice = false;
      if (state.stage1Idx < STAGE1_SCREENS.length - 1) {
        state.stage1Idx++;
        render();
        saveSessionState();
      } else {
        // Stage 1 complete — score the slider profile and advance to Stage 2.
        // (v2: no center/CT routing — the AI decides downstream. The retired
        // ct-analyzing path is now unreachable from Stage 1; left as an orphan
        // for the Steps 4-5 cleanup.)
        state.scores = scoreStage1Profile(state.stage1TypeSliders, state.stage1InstinctSliders);
        console.log('=== STAGE 1 v2 PROFILE ===', state.scores);
        state.phase = 'stage2';
        state.stage2Idx = 0;
        render();
        saveSessionState();
      }
    });
  }

  // ---- CT Analyzing Transition ----
  // Snapshot guard handles all three re-entry cases:
  //   1. First entry — fires the mini-call, records the snapshot
  //   2. Re-entry with unchanged inputs — skip the call, auto-advance immediately
  //   3. Re-entry with changed inputs — fires a fresh call (snapshot mismatch)
  // An 8s timeout caps the wait so the user never sees a stuck screen. On
  // timeout we keep the original Stage 1 hypotheses and write null for
  // ct_adjustment (handled in fireCtMiniCall via the catch path).
  if (state.phase === 'ct-analyzing') {
    const snapshot = ctSnapshot();
    const unchanged = state.ctLastSnapshot !== null && snapshot === state.ctLastSnapshot;

    const advance = () => {
      if (state.phase === 'ct-analyzing') {
        state.phase = 'stage2';
        state.stage2Idx = 0;
        render();
      }
    };

    if (unchanged) {
      // Cached — advance on next tick so the spinner doesn't flash.
      setTimeout(advance, 200);
    } else {
      const timeoutMs = 8000;
      let advanced = false;
      const timer = setTimeout(() => {
        if (!advanced) {
          advanced = true;
          // Timeout — clear any partial adjustment, persist null to DB.
          state.ctAdjustment = null;
          const cid = state.intake && state.intake.client_id;
          if (cid) {
            fetch('/api/ct-adjustment-clear', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ client_id: cid }),
            }).catch(() => {});
          }
          console.warn('[ct-adjustment] 8s timeout — proceeding with original Stage 1 hypotheses');
          advance();
        }
      }, timeoutMs);

      fireCtMiniCall().finally(() => {
        if (!advanced) {
          advanced = true;
          clearTimeout(timer);
          advance();
        }
      });
    }
  }

  // ---- Stage 2: Cross-Referencing ----
  if (state.phase === 'stage2') {
    const q2 = STAGE2_QUESTIONS[state.stage2Idx];
    if (q2.format === 'ranking') {
      // Centers decision-making — rank Gut / Feelings / Facts. Mirrors the
      // Stage 1 rank handler: assigning a rank clears it from any other option,
      // and re-tapping the active rank toggles it off.
      document.querySelectorAll('.rank-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const opt = btn.dataset.opt;            // 'a' | 'b' | 'c'
          const rank = parseInt(btn.dataset.rank); // 1 | 2 | 3
          let r = state.stage2Answers[state.stage2Idx];
          if (!r || typeof r !== 'object') r = { a: null, b: null, c: null };
          ['a', 'b', 'c'].forEach((l) => { if (l !== opt && r[l] === rank) r[l] = null; });
          r[opt] = r[opt] === rank ? null : rank;
          state.stage2Answers[state.stage2Idx] = r;
          render();
        });
      });
    } else {
      document.querySelectorAll('.person-option').forEach((el) => {
        el.addEventListener('click', () => {
          state.stage2Answers[state.stage2Idx] = el.dataset.choice;
          render();
        });
      });
    }

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
        // Done with Stage 2 — hand off to AI Call #1 (the reasoning layer). The
        // call1-analyzing screen fires the call, stores the §6.3 result, and (on
        // Continue) builds the Stage 3 routing off state.call1Result.
        state._call1Done = false;
        state.phase = 'call1-analyzing';
        render();
        saveSessionState();
      }
    });
  }

  // ---- AI Call #1 interstitial ----
  // Fires the reasoning call once on entry. A 20s timeout caps the wait so the
  // user never sees a stuck spinner; on success or timeout we mark the screen
  // done and persist the result into session_state. Once done, a Continue button
  // builds the Stage 3 routing off state.call1Result and advances (§7.1).
  if (state.phase === 'call1-analyzing') {
    const contextBlock = state.scores ? buildContextBlock(state.scores) : '';
    const unchanged = state.call1LastSnapshot !== null
      && contextBlock === state.call1LastSnapshot
      && !!state.call1Result;

    const finish = () => {
      if (state.phase === 'call1-analyzing' && !state._call1Done) {
        state._call1Done = true;
        render();
        saveSessionState();
      }
    };

    if (unchanged) {
      setTimeout(finish, 200);
    } else {
      let finished = false;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          console.warn('[call1] 20s timeout — proceeding without a result');
          finish();
        }
      }, 20000);

      fireCall1().finally(() => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          finish();
        }
      });
    }

    // Continue (shown once _call1Done) — build Stage 3 routing and advance.
    const btnNextC1 = document.getElementById('btn-next');
    if (btnNextC1) btnNextC1.addEventListener('click', () => {
      const routing = buildStage3Routing(state.call1Result);
      state.scores.stage3Pair = routing;
      state.stage3Idx = 0;
      state.stage3Answers = [];
      if (routing.mode === 'NONE') {
        // AI declined a pairwise (stage3_mode = none) — skip Stage 3, flag it for
        // Call #2, build the Stage 4 path off the AI top two, advance to Stage 4.
        state.noPairwise = true;
        state.scores.stage3 = computeStage3Scores(); // { mode:'NONE', noPairwise:true }
        const pr = resolveStage4Path(state.call1Result, state.scores.stage3);
        state.scores.stage4PathResolve = pr;
        state.stage4Sequence = initialStage4Sequence(pr);
        state.stage4Idx = 0;
        state.stage4Answers = [];
        state.stage4Shuffles = [];
        state.phase = 'stage4';
      } else {
        state.noPairwise = false;
        state.phase = 'stage3';
      }
      render();
      saveSessionState();
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
    const totalQs = pair.mode === 'COUNTER-TYPE' ? 1 : (pair.fireQ2 ? 2 : 1);

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
        const pr = resolveStage4Path(state.call1Result, state.scores.stage3);
        state.scores.stage4PathResolve = pr;
        state.stage4Sequence = initialStage4Sequence(pr);
        state.stage4Idx = 0;
        state.stage4Answers = [];
        state.stage4Shuffles = [];
        state.phase = 'stage4';
        render();
        saveSessionState();
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
        const s3Total = pair.mode === 'COUNTER-TYPE' ? 1 : (pair.fireQ2 ? 2 : 1);
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
        saveSessionState();
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

  // ---- Save and Continue Later ----
  const btnSaveLater = document.getElementById('btn-save-later');
  if (btnSaveLater) btnSaveLater.addEventListener('click', async () => {
    const token = state.intake && state.intake.token;
    if (!token) return;
    btnSaveLater.disabled = true;
    btnSaveLater.textContent = 'Saving…';
    await saveSessionState();
    window.location.href = '/assessment/' + encodeURIComponent(token) + '/saved';
  });
}

