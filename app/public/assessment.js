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
    text: 'What are 3\u20135 words or phrases others who know you well would use to describe you?',
    showRef: false,
  },
  {
    id: 'q3',
    title: 'STRENGTH',
    text: 'Which of the words or phrases you listed is your greatest strength, and why?',
    showRef: true,
  },
  {
    id: 'q4',
    title: 'SHADOW',
    text: 'Which of the words or phrases you listed tends to be most problematic for you, and why?',
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
    { id: 'S6-2b', dimension: 'Resulting preoccupation', text: 'I find myself running through worst-case scenarios and figuring out how to be prepared for what might happen.' },
    { id: 'S6-3',  dimension: 'Energy',                  text: 'I put a lot of energy into questioning, seeking reassurance, and making sure I’m ready for what could go wrong.' },
    { id: 'S6-4',  dimension: 'Avoidance',               text: 'I tend to avoid uncertainty, blindly trusting others, and being caught unprepared.' },
  ],
  9: [
    { id: 'S9-1',  dimension: 'Core motivation',        text: 'I prioritize keeping the peace and maintaining harmony, inside myself and with others.' },
    { id: 'S9-2a', dimension: 'Focus of attention',     text: 'My attention naturally goes outward to other people’s agendas, potential sources of conflict, and to what’s right in front of me.' },
    { id: 'S9-2b', dimension: 'Resulting preoccupation', text: 'I find myself going along with what others want, keeping things comfortable, and losing track of what matters most to me.' },
    { id: 'S9-3',  dimension: 'Energy',                  text: 'I put a lot of energy into accommodating others, staying comfortable, and keeping the peace.' },
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
    { id: 'S7-2b', dimension: 'Resulting preoccupation', text: 'I find myself imagining enjoyable possibilities, generating new options, and reframing negatives into positives.' },
    { id: 'S7-3',  dimension: 'Energy',                  text: 'I put a lot of energy into staying up and positive, planning for pleasurable possibilities, and keeping my options open.' },
    { id: 'S7-4',  dimension: 'Avoidance',               text: 'I tend to avoid people and situations that limit my options or require me to sit with pain or difficulty.' },
  ],
};

const STAGE1_INSTINCT_STATEMENTS = {
  SP: [
    { id: 'I1-SP-1', dimension: 'Body & comfort',       text: 'I pay close attention to my physical comfort — things like temperature, hunger, rest, and whether my body feels okay.' },
    { id: 'I1-SP-2', dimension: 'Enough / resources',   text: 'I keep track of whether I have enough resources (money, supplies, energy, time, etc.) to ensure comfort and survival.' },
    { id: 'I1-SP-3', dimension: 'Security (protective)', text: 'I keep the people and things I depend on safe.' },
    { id: 'I1-SP-4', dimension: 'Self-reliance',        text: 'I prefer to handle things myself rather than counting on others.' },
    { id: 'I1-SP-5', dimension: 'Energy direction',     text: 'I recharge by being on my own, in my own space, with no demands on me.' },
  ],
  SO: [
    { id: 'I1-SO-1', dimension: 'Place in the group',   text: 'I pay attention to where I stand in a group and how I’m coming across to the people in it.' },
    { id: 'I1-SO-2', dimension: 'Trust / reciprocity',  text: 'I pay attention to who in a group is reliable and can be counted on, and who can’t.' },
    { id: 'I1-SO-3', dimension: 'Social landscape',     text: 'I notice the social landscape — who’s connected to whom, who’s in, and who’s out.' },
    { id: 'I1-SO-4', dimension: 'Larger belonging',     text: 'I am pulled toward something larger than myself: a cause, a community, or a group I want to be part of.' },
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

// Stage 1 v2 slider screen model. One type per screen in narrative order
// (3,6,9,1,4,2,8,5,7) — 5 sliders each (§6.2); then an optional type open-response;
// then one instinct screen per instinct (SP/SO/SX); then an optional instinct
// open-response. 14 screens total (indices 0-13). Slot order is unchanged from the
// paired layout — pagination is orthogonal to the slider→statement mapping.
const STAGE1_SCREENS = (() => {
  const screens = [];
  for (let i = 0; i < STAGE1_TYPE_SCREEN_ORDER.length; i += 1) {
    screens.push({ kind: 'type-sliders', types: [STAGE1_TYPE_SCREEN_ORDER[i]] });
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
  '2-9': { label: 'Being Unloved vs. Disrupted Peace', personA: 'Feeling disconnected or unappreciated by people who matter to me, like my help doesn\u2019t make a difference to them.', personB: 'Feeling pulled into conflict or tension I didn\u2019t create. Having my sense of inner peace disrupted by other people\u2019s agendas is hard to take.' },
  '3-7': { label: 'Failure vs. Limitation', personA: 'Failing visibly or being seen as incompetent. The idea that people might think I\u2019m not capable or successful is genuinely hard to sit with.', personB: 'Feeling trapped, constrained, or stuck with no good options. When life starts to feel repetitive or limited, I feel a real urgency to find a way out.' },
  '3-8': { label: 'Image vs. Control', personA: 'Being seen in a way that doesn\u2019t reflect well on me. I\u2019m aware of how I\u2019m coming across, and it matters that the impression is a good one.', personB: 'Being controlled, overruled, or made to feel powerless. When someone tries to limit what I can do, something in me pushes back hard.' },
  '4-5': { label: 'Trusting the Heart vs. Trusting the Mind', personA: 'Having my emotional reality questioned, or being told that what I feel isn\u2019t accurate. My feelings are how I know what\u2019s true, and having that doubted cuts at something fundamental in me.', personB: 'Being flooded with emotion before I\u2019ve had time to think it through. Feelings that arrive fast and demand an immediate response feel unreliable, and I need to step back and reason before I trust them.' },
  '4-9': { label: 'Amplified Emotion vs. Muted Emotion', personA: 'Feeling emotionally flat or cut off from what\u2019s real. I\u2019d rather feel something intensely than feel nothing at all.', personB: 'Feeling overwhelmed by emotional intensity or conflict. When things get too charged, I find myself going numb or withdrawing until it passes.' },
  '5-9': { label: 'Energy Conservation vs. Tension Avoidance', personA: 'Feeling depleted by too much engagement or contact. When people need too much from me, I feel my resources running out and I need to withdraw to recover.', personB: 'Feeling pressured to assert myself or take a strong position. When there\u2019s potential conflict, I find it easier to go along or disengage than to push back.' },
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
  '2-8': { label: 'Being Unappreciated vs. Being Overpowered', personA: 'Giving myself to people and feeling like it didn\u2019t matter to them. Being taken for granted by someone I\u2019ve supported is genuinely hard to take.', personB: 'Being put in a position where someone else holds power over me. I\u2019d much rather take charge than risk being dependent or controlled.' },
  '3-6': { label: 'Results vs. Planning', personA: 'Failing to reach the goal, or being seen as unsuccessful. What matters most is the result, and falling short of it is what I most want to avoid.', personB: 'Being caught unprepared for what could go wrong. I\u2019m most uneasy when I haven\u2019t worked through the contingencies and mapped out what might happen.' },
  '3-9': { label: 'Stalling vs. Being Pressured', personA: 'Being idle or unproductive, with nothing to point to for my time. Slowing down with no result to show makes me genuinely restless.', personB: 'Being pushed to assert myself or move at someone else\u2019s pace. Pressure to take a hard stance feels more uncomfortable to me than just going along.' },
  '5-7': { label: 'Depletion vs. Constraint', personA: 'Having too much asked of me before I\u2019m ready, draining my energy. When that happens, I pull back to protect what I have left.', personB: 'Being limited to too few options, or stuck in something that\u2019s gone flat. I keep my options open so I never feel cornered.' },
  '5-8': { label: 'Intrusion vs. Vulnerability', personA: 'Being intruded upon, or having more asked of me than I can give. My instinct is to withdraw until I feel ready to connect.', personB: 'Being made to feel weak or dependent on anyone. My instinct is to take up space and make sure I\u2019m not in a position to be controlled.' },
  '6-9': { label: 'Uncertainty vs. Disruption', personA: 'Not knowing what\u2019s coming, or who I can really count on. The uncertainty keeps me on alert until I feel genuinely prepared.', personB: 'Having my peace disturbed by tension or other people\u2019s demands. When conflict rises, I tend to disengage or go along rather than push back.' },
};

// Counter-type comparatives, 5 pairs, keyed by the AI Call #1 ct_pair field.
// Counter-type expression is Person A, lookalike is Person B (authored order;
// the "lower-numbered = Person A" rule is standard-mode only). One question,
// same stem as Q1. Source: hive_stage3_question_bank_v2_052926.docx \u00a7"Counter-Type Mode".
const STAGE3_CT_COMPARATIVES = {
  'SO-7': { ctId: 'CT-1', label: 'SO 7 vs. Type 2', counterType: 7, lookalike: 2, personA: 'I am sharing what I love with the people around me. I feel engaged, generous, and genuinely happy, and I want others to experience that same aliveness I feel.', personB: 'I am tuned in to what others need. I feel genuinely helpful, warm, and deeply connected, and I need to feel that my help matters to them.' },
  'SX-6': { ctId: 'CT-2', label: 'SX 6 vs. Type 8', counterType: 6, lookalike: 8, personA: 'I am facing something head-on and not letting fear win. I feel courageous and alive, most myself when I\u2019m pushing toward the thing that scares me.', personB: 'I am fully in control and unbothered. I feel powerful and clear, with no fear underneath, just a certainty that I won\u2019t be controlled or pushed around.' },
  'SP-3': { ctId: 'CT-3', label: 'SP 3 vs. Type 1', counterType: 3, lookalike: 1, personA: 'I am getting things done and building something solid. I feel capable and self-sufficient, and I don\u2019t need recognition. It is enough for me to know I\u2019ve made it on my own terms.', personB: 'I am doing things the right way. I feel principled and in integrity, and anything less than my own standard would feel like a betrayal of who I am.' },
  'SP-4': { ctId: 'CT-4', label: 'SP 4 vs. Type 3', counterType: 4, lookalike: 3, personA: 'I am proving something to myself more than anyone else. I feel driven and resilient, like I\u2019m refusing to be defeated by a sense of not being enough.', personB: 'I am achieving something meaningful. I feel capable, successful, and recognized, and I want the people who matter to see that I\u2019ve done well.' },
  'SX-1': { ctId: 'CT-5', label: 'SX 1 vs. Type 8', counterType: 1, lookalike: 8, personA: 'I am fighting for something that genuinely matters. I feel intensely alive when I\u2019m up against something wrong, with a standard at stake that I won\u2019t back down from.', personB: 'I am fully in control and unbothered. I feel powerful and clear, and I push hard because I won\u2019t be limited or told what I can\u2019t do.' },
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

// =================== BETA FLAG KEYS — STAGE 3/4 SYNTHETIC STEM KEYS ===================

// Stages 0/1/2 expose stable per-item ids that the beta flag store keys on directly
// (Stage 0 q1-q4; Stage 1 S{type}-N and I1-{instinct}-N; Stage 2 xref-qN). Stage 3
// and Stage 4 stems, however, are shared `const` strings with no per-item id, so the
// beta feature mints stable synthetic keys for them here. This map is the single
// source of truth shared by the flag store, the post-submit review screen, and the
// /admin/beta-review Tab 1 frequency table — do not inline these key strings elsewhere.
const BETA_STEM_KEYS = {
  'S3-Q1':       STAGE3_Q1_STEM,
  'S3-Q2':       STAGE3_Q2_STEM,
  'S4-stress':   STAGE4_STRESS_STEM,
  'S4-security': STAGE4_SECURITY_STEM,
  'S4-habit':    STAGE4_HABIT_STEM,
};

// Flat lookup: any flaggable key → its full question/stem text. Single source for
// reconstructing flagged items on the post-submit beta-review screen (PR-D). Built
// once at load from the same constants the flag mechanic keys on.
const BETA_QUESTION_TEXT = (() => {
  const map = {};
  STAGE0_QUESTIONS.forEach((q) => { map[q.id] = q.text; });
  Object.keys(STAGE1_TYPE_STATEMENTS).forEach((t) => {
    STAGE1_TYPE_STATEMENTS[t].forEach((s) => { map[s.id] = s.text; });
  });
  Object.keys(STAGE1_INSTINCT_STATEMENTS).forEach((inst) => {
    STAGE1_INSTINCT_STATEMENTS[inst].forEach((s) => { map[s.id] = s.text; });
  });
  STAGE2_QUESTIONS.forEach((q) => { map[q.id] = q.text; });
  Object.keys(BETA_STEM_KEYS).forEach((k) => { map[k] = BETA_STEM_KEYS[k]; });
  return map;
})();

// Block B Likert dimensions (post-submit review). Keys are the stored payload keys.
const BETA_LIKERT_DIMS = [
  { key: 'clarity',    label: 'Clarity of questions' },
  { key: 'ease',       label: 'Ease of answering' },
  { key: 'length',     label: 'Length & pacing' },
  { key: 'navigation', label: 'Navigation and way-finding' },
  { key: 'overall',    label: 'Overall experience' },
];

// For each type, a three-option question. Index 0 is the CORRECT answer
// (the canonical stress/security/habit pattern for that type). Indexes 1 and 2
// are alternative energies (annotated in comments) used as distractors.
// Options are shuffled at render time.

const STAGE4_STRESS = {
  1: [
    'I become weighed down with sadness. I start dwelling on what others have naturally that I don\u2019t and I long to be whole.', // correct (1\u21924)
    'I throw myself into achieving something. I push distractions aside, focus on what I can accomplish, and measure my worth by what I can visibly produce.', // 6 energy
    'I go numb and withdraw. I go along to get along, hoping that will restore the peace both internally and externally.', // 9 energy
  ],
  2: [
    'I get angry, forceful, and confrontational. My usual warm and giving self disappears and I become demanding, blunt, or even aggressive about what I need.', // correct (2\u21928)
    'I become hypervigilant about who I can trust. I get suspicious and start needing reassurance that the people in my life are actually there for me.', // 6 energy
    'I detach and go quiet. I stop engaging with people\u2019s needs entirely and retreat into my own head, needing to think things through on my own before I can face anyone.', // 4 energy
  ],
  3: [
    'I shut down. The drive and ambition that usually feel effortless vanish and I find myself checked out and disengaged.', // correct (3\u21929)
    'I lose focus and start jumping between things. Nothing holds my attention and I find myself chasing whatever feels stimulating, unable to settle on any one thing.', // 6 energy
    'I become combative and start pushing hard. I stop being strategic about how I come across and just start forcing things, needing to feel like I\u2019m in control of something.', // 2 energy
  ],
  4: [
    'I become overly helpful and acutely aware of what others need. I set my own needs aside and seek the appreciation of others.', // correct (4\u21922)
    'I become hypervigilant and start looking for what could go wrong. I get caught up in worst-case scenarios and find myself needing to know that things are going to be okay.', // 1 energy
    'I go into overdrive seeking stimulation. I start filling my schedule and looking for the next thing that will make me feel alive again.', // 7 energy
  ],
  5: [
    'I become scattered and overextended. I start taking on too much, chasing new ideas, and lose the focused stillness that usually grounds me.', // correct (5\u21927)
    'I become preoccupied with how others are doing. I find myself checking in, offering help, and seeking connection \u2014 almost as if staying close to people will quiet something that\u2019s unsettled inside me.', // 8 energy
    'I go foggy and check out. I lose my own thread entirely, drift into whatever\u2019s easiest, and stop being able to tell what I actually think.', // 6 energy
  ],
  6: [
    'I become hyper-focused on getting after my own goals. I get driven and image-conscious and start pushing hard to make things happen and be seen as capable.', // correct (6\u21923)
    'I become domineering and start bulldozing through things. I stop second-guessing and just act \u2014 needing to feel like I\u2019m the one calling the shots.', // 8 energy
    'I become rigid and critical, fixating on everything that isn\u2019t being done correctly and feeling a hard edge of irritation when it isn\u2019t.', // 9 energy
  ],
  7: [
    'I become critical and perfectionistic. I lose my lightness and get fixated on what\u2019s wrong, what\u2019s not good enough, and what needs to be corrected.', // correct (7\u21921)
    'I become emotionally flooded and self-absorbed. I get lost in longing for what\u2019s missing and find it hard to focus on anything else.', // 4 energy
    'I become preoccupied with keeping everyone around me happy. I throw myself into smoothing things over and meeting others\u2019 needs, anxious about the connections feeling shaky.', // 5 energy
  ],
  8: [
    'I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy.', // correct (8\u21925)
    'I sink into my own feelings and pull away. I get caught up in a sense that something\u2019s missing or that I\u2019ve been let down, and I dwell on it more than I\u2019d like to admit.', // 2 energy
    'I lose my certainty and start second-guessing every move. I hesitate, look for input before acting, and feel uneasy committing to a decision on my own.', // 3 energy
  ],
  9: [
    'I become anxious and hypervigilant. The usual peace disappears and I start worrying about what could go wrong and whether I\u2019m prepared.', // correct (9\u21926)
    'I get analytical and detached. I start dissecting the problem from a distance, wanting to understand exactly how it works before I\u2019ll let myself act.', // 4 energy
    'I quickly reframe everything in a positive light and start brainstorming options. I get excited about all the ways things could work out and want to keep my choices open.', // 3 energy
  ],
};

const STAGE4_SECURITY = {
  1: [
    'I become lighter, more playful, and spontaneous. I stop being so hard on myself and find it easier to enjoy things without worrying about doing them perfectly.', // correct (1\u21927)
    'I feel powerful and ready to take charge. Nothing intimidates me \u2014 I push forward hard, take up space, and make things happen on my terms.', // 2 energy
    'I become more reflective and emotionally open. I drop the doing and let myself just feel and be for a while.', // 4 energy
  ],
  2: [
    'I turn inward and become introspective. I stop trying to take care of others and allow myself to focus on how I\u2019m feeling and what I need.', // correct (2\u21924)
    'I become more self-contained and reflective. I step back, conserve my energy, and feel content with my own company.', // 9 energy
    'I become more playful and spontaneous. I stop focusing on what others need and let myself just explore and enjoy things freely.', // 7 energy
  ],
  3: [
    'I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don\u2019t need to go it alone and actually want us to win together.', // correct (3\u21926)
    'I get more direct and unfiltered. I stop managing how I come across and just say what I really think, without worrying about the impression I\u2019m making.', // 9 energy
    'I become more self-contained and clear-headed. I stop performing and step back to think things through on my own, content without the audience.', // 7 energy
  ],
  4: [
    'I become more grounded, disciplined, and action-oriented. I stop dwelling on what\u2019s missing and start doing, with a clearer sense of what\u2019s right and what needs to happen.', // correct (4\u21921)
    'I become lighter and more optimistic. I stop focusing on what\u2019s wrong and let myself enjoy what\u2019s actually good in my life.', // 7 energy
    'I become more at peace and accepting. The longing quiets down and I settle into an easy contentment with things just as they are.', // 2 energy
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
    'I become more attuned to the people around me. My energy shifts toward caring for others and I feel fulfilled by making them feel seen and supported.', // 9 energy
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
    'I become more principled and discerning. I get clearer about what actually matters to me and hold a firmer line on it.', // 2 energy
  ],
};

const STAGE4_HABIT = {
  1: [
    'To what\u2019s wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else.', // correct
    'To what\u2019s absent and the longing it stirs \u2014 a sense that something deeper or more meaningful is missing from this.', // 6 attention
    'To what needs to be done and how to do it efficiently. I\u2019m already thinking about tasks, goals, and getting things moving.', // 3 attention
  ],
  2: [
    'To how other people are feeling and what they might need. I\u2019m reading the room emotionally and sensing who needs something before they ask.', // correct
    'To gathering information and understanding how things work. I\u2019m observing from a step back, taking in data and figuring out the underlying logic.', // 9 attention
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
    'To who has the upper hand and how much force is in play. I size people up fast \u2014 strong or weak, straight or evasive \u2014 and brace to assert myself if I need to.', // 6 attention
    'To what\u2019s not quite right. I notice inconsistencies and gaps quickly and feel a pull to correct or clarify.', // 1 attention
  ],
  6: [
    'To what could go wrong or what I might not be prepared for. I\u2019m scanning for potential problems and threats before they materialize.', // correct
    'To what\u2019s not right and needs correcting. I notice mistakes and the gap between how things are and how they should be, and I feel pulled to fix it.', // 5 attention
    'To the overall atmosphere and whether things feel stable. I\u2019m drawn to keeping things easy and avoiding unnecessary disruption.', // 9 attention
  ],
  7: [
    'To what\u2019s next, what\u2019s possible, and what else is available. My mind is already moving toward new ideas, options, and what could be exciting about what\u2019s ahead.', // correct
    'To what needs to happen and how to make it happen quickly. I\u2019m already thinking about goals, tasks, and getting things moving.', // 3 attention
    'To what could go wrong and what I\u2019m not prepared for. I\u2019m scanning for problems and potential threats before they have a chance to materialize.', // 2 attention
  ],
  8: [
    'To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated.', // correct
    'To gathering information and figuring out how things actually work. I observe from a step back, take in the details, and want to understand the whole picture before I\u2019d weigh in.', // 3 attention
    'To potential threats and whether I can trust what\u2019s happening. I\u2019m scanning for danger and assessing who\u2019s reliable.', // 6 attention
  ],
  9: [
    'To the overall atmosphere and whether everyone feels included and comfortable. I\u2019m aware of the whole room and pulled toward making sure things feel settled and okay for everyone.', // correct
    'To what needs to get done and the most efficient way to do it. My mind goes straight to goals, next steps, and making visible progress.', // 2 attention
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
      personA: 'I shut down. The drive and ambition that usually feel effortless vanish and I find myself checked out and disengaged.',
      personB: 'I become weighed down with sadness. I start dwelling on what others have naturally that I don\u2019t and I long to be whole.',
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
      personB: 'I shut down. The drive and ambition that usually feel effortless vanish and I find myself checked out and disengaged.',
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
      personA: 'I become weighed down with sadness. I start dwelling on what others have naturally that I don\u2019t and I long to be whole.',
      personB: 'I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy.',
    },
    security: {
      personA: 'I become lighter, more playful, and spontaneous. I stop being so hard on myself and find it easier to enjoy things without worrying about doing them perfectly.',
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

// Defect #4 — REDIRECT gap-suppression threshold. A REDIRECT overrides the leading
// hypothesis on two Stage 4 movement answers; when the AI Call #1 coherence-score gap
// between the leading and alternate types is wider than this many points, the alternate
// is not a genuine competing hypothesis and the redirect is suppressed (see
// computeStage4Scores). Tunable from alpha data without a code search.
const REDIRECT_SUPPRESSION_GAP_THRESHOLD = 30;

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

  // Defect #4 — REDIRECT gap suppression (STANDARD paths only). When a REDIRECT fires
  // but the AI Call #1 coherence-score gap between the leading and alternate types is
  // very wide, the alternate is not a real competing hypothesis — the redirect is more
  // likely an artifact of how the client engaged Stage 4 than a true type signal. Retain
  // the leading type and downgrade to CONFIRMED_WITH_NOTE so the coach still sees the
  // movement pattern (surfaced server-side via the redirect_suppressed coach flag). Not
  // applied to COUNTER_TYPE paths, where lead/second are a counter-type/lookalike pair
  // and the score gap does not carry the same meaning.
  let redirectSuppressed = false;
  let redirectGap = null;
  if (outcome === 'REDIRECT' && pr.path === 'STANDARD' && pr.secondType != null
      && state.call1Result && Array.isArray(state.call1Result.ranking)) {
    const scoreOf = (t) => {
      const row = state.call1Result.ranking.find((r) => +r.type === +t);
      return row ? row.score : null;
    };
    const leadScore = scoreOf(pr.leadType);
    const altScore = scoreOf(pr.secondType);
    if (leadScore != null && altScore != null) {
      redirectGap = leadScore - altScore;
      if (redirectGap > REDIRECT_SUPPRESSION_GAP_THRESHOLD) {
        outcome = 'CONFIRMED_WITH_NOTE';
        redirectSuppressed = true;
      }
    }
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
    redirectSuppressed,
    redirectGap,
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
  'stage0', 'stage1', 'stage2', 'stage3', 'stage4', 'finalopen',
]);

// =================== CHROME SYSTEM (PR1) ===================
//
// Every screen renders inside a shared chrome shell built by render() — topbar
// (logo + divider + product + Save), global progress bar, sub-progress dot strip,
// and footer (spec §3). Per-screen renderX() functions return ONLY their body;
// they no longer emit their own progress markup. chromeFor() decides which chrome
// variant a phase uses; progress numbers come from ui.js (progressFor).

// Product name shown next to the logo in the full topbar.
const CHROME_PRODUCT_NAME = 'InsightOut Enneagram Assessment';

// Phase → chrome variant. topbar 'logo-only' = centered logo, no progress/save;
// 'full' = logo + divider + product + Save. progress/sub toggle the global bar
// and the "Screen N of N" dot strip. Later PRs extend this map (profile-confirm,
// orientation, resume, part1/part2-complete, thank-you, error screens).
const PHASE_CHROME = {
  welcome:                     { topbar: 'logo-only', progress: false, sub: false },
  'profile-confirm':           { topbar: 'full',      progress: false, sub: false },
  intake:                      { topbar: 'full',      progress: false, sub: false },
  orientation:                 { topbar: 'full',      progress: false, sub: false },
  resume:                      { topbar: 'full',      progress: false, sub: false },
  'expired-token':             { topbar: 'logo-only', progress: false, sub: false },
  'invalid-token':             { topbar: 'logo-only', progress: false, sub: false },
  stage0:                      { topbar: 'full',      progress: true,  sub: true  },
  'stage0to1-bridge':          { topbar: 'full',      progress: true,  sub: false },
  stage1:                      { topbar: 'full',      progress: true,  sub: true  },
  'types-to-instincts-bridge': { topbar: 'full',      progress: true,  sub: false },
  'part1-complete':            { topbar: 'full',      progress: true,  sub: false },
  stage2:                      { topbar: 'full',      progress: true,  sub: true  },
  'part2-complete':            { topbar: 'full',      progress: true,  sub: false },
  stage3:                      { topbar: 'full',      progress: true,  sub: true  },
  stage4:                      { topbar: 'full',      progress: true,  sub: true  },
  finalopen:                   { topbar: 'full',      progress: true,  sub: true  },
  processing:                  { topbar: 'logo-only', progress: false, sub: false },
  'beta-review':               { topbar: 'logo-only', progress: false, sub: false },
  confirmation:                { topbar: 'logo-only', progress: false, sub: false },
  error:                       { topbar: 'logo-only', progress: false, sub: false },
};
const DEFAULT_CHROME = { topbar: 'logo-only', progress: false, sub: false };

// Resolve the chrome descriptor for a phase. showSave preserves the original
// gate exactly (SAVE_LATER_PHASES + an active token). labelColor is 'blue' in
// PR1; PR3 sets 'orange' for the Part-complete interstitials.
function chromeFor(phase) {
  const base = PHASE_CHROME[phase] || DEFAULT_CHROME;
  const prog = progressFor(phase);
  return {
    topbar:          base.topbar,
    showProgress:    base.progress,
    showSubProgress: base.sub,
    showSave:        SAVE_LATER_PHASES.has(phase) && !!(state.intake && state.intake.token),
    stageLabel:      prog.stageLabel,
    pct:             prog.pct,
    dotIndex:        prog.dotIndex,
    dotTotal:        prog.dotTotal,
    // The Part-complete interstitials use the orange progress label (§0D/§0F);
    // everything else is Hive Blue.
    labelColor:      (phase === 'part1-complete' || phase === 'part2-complete') ? 'orange' : 'blue',
    // Orientation re-uses the inlined SVG (PNGs absent, Decision C) but namespaces
    // its clipPath ids to avoid collision with any other logo instance on the page.
    logoNs:          phase === 'orientation' ? 'orient-logo' : null,
  };
}

// Sub-progress dot strip — "Screen N of N" plus one dot per screen in the stage.
function renderSubProgress(chrome) {
  const total = chrome.dotTotal || 0;
  if (total <= 0) return '';
  let dots = '';
  for (let i = 0; i < total; i++) {
    const cls = i < chrome.dotIndex ? 'done' : (i === chrome.dotIndex ? 'current' : 'upcoming');
    dots += `<span class="sp-dot ${cls}"></span>`;
  }
  return `<div class="sub-progress">
      <span class="sp-label">Screen ${chrome.dotIndex + 1} of ${total}</span>
      <span class="sp-dots">${dots}</span>
    </div>`;
}

// Wrap a screen body in the full chrome shell. The logo SVG is inlined into the
// page server-side as window.__HIVE_LOGO_SVG (Q3). The Save row is a single DOM
// node: CSS positions it top-right in the topbar on desktop and as a full-width
// row below the progress bar on mobile (collapsing with the brand header).
function renderChromeShell(chrome, bodyHtml) {
  let logo = (typeof window !== 'undefined' && window.__HIVE_LOGO_SVG) || '';
  // Namespace the clipPath ids (clip-0…clip-5 → <ns>-clip-0…) when requested, so a
  // second logo instance on the same page can't collide on shared ids (§2 / §0C.5).
  // Match only id definitions ("clip-) and references (#clip-) — NOT the clip-path
  // attribute/property name, which also contains the substring "clip-".
  if (chrome.logoNs && logo) logo = logo.replace(/(["#])clip-/g, `$1${chrome.logoNs}-clip-`);
  const full = chrome.topbar === 'full';

  const brand = `<div class="chrome-brand">
        <span class="chrome-logo">${logo}</span>
        ${full ? `<span class="chrome-divider"></span><span class="chrome-product">${CHROME_PRODUCT_NAME}</span>` : ''}
      </div>`;

  const progress = chrome.showProgress ? `
      <div class="global-progress">
        <div class="gp-head">
          <span class="gp-label gp-${chrome.labelColor}">${esc(chrome.stageLabel || '')}</span>
          <span class="gp-pct">${chrome.pct}%</span>
        </div>
        <div class="gp-track"><div class="gp-fill" id="gp-fill" style="width:${chrome.pct}%"></div></div>
      </div>` : '';

  const save = chrome.showSave ? `
      <div class="chrome-save-row">
        <button class="chrome-save" id="btn-save-later">
          <span class="save-full">Save and continue later</span><span class="save-short">Save &amp; Exit</span>
        </button>
      </div>` : '';

  const sub = chrome.showSubProgress ? renderSubProgress(chrome) : '';

  return `<div class="hive-assessment ${full ? 'chrome-mode-full' : 'chrome-mode-logo'}">
    <div class="chrome-top" id="chrome-top">
      <header class="chrome-topbar">${brand}</header>
      ${progress}
      ${save}
      ${sub}
    </div>
    <div class="chrome-content">${bodyHtml}</div>
    <footer class="chrome-footer">&copy; Copyright 2026 Hive, Inc. All rights reserved.</footer>
  </div>`;
}

// Mobile scroll-collapse (spec §3.3): collapse the brand header + Save row once
// the user scrolls past 20px; restore at the top (≤4px). The sub-progress strip
// stays pinned (CSS excludes it from the collapse). Desktop is a no-op (the
// collapse CSS lives inside the mobile media query). The handler is deduped
// across renders.
//
// Compositor-only collapse (Issues 1 + 3): the handler does nothing but toggle
// the .chrome-collapsed class. CSS animates ONLY transform + opacity (220ms
// ease-in-out, symmetric) — both composited, so no per-frame layout. The space
// reclaim (max-height: 0) and padding/border are NOT transitioned, so they snap
// in a single frame. We deliberately do NOT touch max-height (or any layout
// property) from JS here — animating layout during scroll is what caused the
// jitter regression.
let _chromeScrollHandler = null;
function attachChromeScroll() {
  if (_chromeScrollHandler) window.removeEventListener('scroll', _chromeScrollHandler);
  const top = document.getElementById('chrome-top');
  if (!top) { _chromeScrollHandler = null; return; }

  // Seed the baseline to match the current scroll position. mountScreen resets
  // scroll to 0 before this runs, so on a fresh mount this is a no-op (expanded)
  // and never produces a transition flash.
  let ticking = false;
  let collapsed = top.classList.contains('chrome-collapsed');
  const shouldCollapse = (window.scrollY || window.pageYOffset || 0) > 20;
  if (shouldCollapse !== collapsed) { collapsed = shouldCollapse; top.classList.toggle('chrome-collapsed', collapsed); }

  // rAF-gated handler: coalesce scroll bursts into one read+write per frame, and
  // only act on an actual state change so momentum scrolling can't re-trigger the
  // transition every event.
  _chromeScrollHandler = function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      const y = window.scrollY || window.pageYOffset || 0;
      if (y > 20 && !collapsed)      { collapsed = true;  top.classList.add('chrome-collapsed'); }
      else if (y <= 4 && collapsed)  { collapsed = false; top.classList.remove('chrome-collapsed'); }
      ticking = false;
    });
  };
  window.addEventListener('scroll', _chromeScrollHandler, { passive: true });
}

// Build + mount the full chrome shell for the current phase, reset scroll to the
// top, and (re)wire all handlers. Called directly for instant renders and from
// inside the cross-fade gap for animated screen transitions.
function mountScreen() {
  const app = document.getElementById('app');

  let body = '';
  switch (state.phase) {
    case 'welcome':                  body = renderWelcome(); break;
    case 'profile-confirm':          body = renderProfileConfirm(); break;
    case 'intake':                   body = renderIntake(); break;
    case 'orientation':              body = renderOrientationInterstitial(); break;
    case 'resume':                   body = renderResume(); break;
    case 'expired-token':            body = renderExpiredToken(); break;
    case 'invalid-token':            body = renderInvalidToken(); break;
    case 'stage0':                   body = renderStage0(); break;
    case 'stage0to1-bridge':         body = renderStage0to1Bridge(); break;
    case 'stage1':                   body = renderStage1(); break;
    case 'types-to-instincts-bridge': body = renderTypesToInstinctsBridge(); break;
    case 'part1-complete':           body = renderPart1Complete(); break;
    case 'stage2':                   body = renderStage2(); break;
    case 'part2-complete':           body = renderPart2Complete(); break;
    case 'stage3':                   body = renderStage3(); break;
    case 'stage4':                   body = renderStage4(); break;
    case 'finalopen':                body = renderFinalOpen(); break;
    case 'processing':               body = renderProcessing(); break;
    case 'beta-review':              body = renderBetaReview(); break;
    case 'confirmation':             body = renderThankYou(); break;
    case 'error':                    body = renderError(); break;
  }

  app.innerHTML = renderChromeShell(chromeFor(state.phase), body);

  // Reset scroll BEFORE wiring the collapse listener so its seeded state is
  // correct (chrome expanded at scrollY 0). Belt-and-suspenders (Issue 2): the
  // options-object scrollTo is unreliable on iOS Safari, so zero the scrolling
  // element directly AND use the two-arg form, then re-assert on the next frame
  // to defeat scroll-anchoring / residual momentum after the DOM swap.
  const se = document.scrollingElement || document.documentElement;
  se.scrollTop = 0;
  window.scrollTo(0, 0);
  requestAnimationFrame(function () { window.scrollTo(0, 0); });

  updateProgress();        // reaffirm the global bar width after mount
  attachHandlers();        // Save (#btn-save-later) + per-screen gates bound here
  attachChromeScroll();    // measure heights + bind mobile collapse (deduped)
}

// Fix B — cross-fade screen transitions. On a real phase change we fade the
// current content area out (150ms), swap the HTML and reset scroll to the top in
// the invisible gap, then fade the new content in (150ms). Only .chrome-content
// fades; the chrome (topbar / progress / sub-progress) stays put for continuity.
// In-phase re-renders and the initial mount render instantly (no fade), and
// prefers-reduced-motion falls back to an instant render that still resets scroll.
let _lastPhase = null;
let _contentFadeTimer = null;
const CONTENT_FADE_MS = 150;

function render() {
  const app = document.getElementById('app');
  const prev = app ? app.querySelector('.chrome-content') : null;
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const animate = !!prev && _lastPhase !== null && _lastPhase !== state.phase && !reduceMotion;

  if (_contentFadeTimer) { clearTimeout(_contentFadeTimer); _contentFadeTimer = null; }

  if (!animate) {
    mountScreen();
    _lastPhase = state.phase;
    return;
  }

  // 1. Fade the current content out (pointer-events:none blocks double-taps).
  prev.classList.add('content-leaving');

  // 2. In the invisible gap: swap content + reset scroll to top (CRITICAL — must
  //    happen here, after fade-out and before fade-in, on every transition).
  _contentFadeTimer = setTimeout(function () {
    mountScreen();
    const next = document.querySelector('.chrome-content');
    if (next) {
      next.classList.add('content-entering'); // start hidden, no transition jump
      void next.offsetHeight;                 // force reflow to commit opacity:0
      next.classList.remove('content-entering'); // 3. fade in to opacity 1 (150ms)
    }
    _lastPhase = state.phase;
    _contentFadeTimer = null;
  }, CONTENT_FADE_MS);
}

// ---- Welcome ----
function renderWelcome() {
  // Small Hive-Blue envelope glyph for the report carrot (sized via CSS).
  const envelope = `<svg class="carrot-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="#00B2D9" stroke-width="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" stroke="#00B2D9" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>`;
  return `<div class="screen welcome-screen">
    <div class="welcome-eyebrow">INSIGHTOUT ENNEAGRAM ASSESSMENT</div>
    <h1 class="welcome-headline"><span class="wh-light">Discover your</span><span class="wh-bold">Enneagram type.</span></h1>
    <p class="welcome-tagline">Welcome to an experience that reveals why you think, feel, act the way you do.</p>
    ${state.is_beta ? `<p class="welcome-beta-note"><em>A Note for All Testers: As you go, you’ll see a small orange flag icon beside each question. Tap it whenever something feels confusing or hard to answer — it turns green to mark the spot, and tapping again clears it. Before you see your results, we’ll bring those flagged questions back and ask what gave you pause.</em></p>` : ''}
    <p class="report-carrot">${envelope}<span class="carrot-full">When you’re done, a personalized Enneagram report lands in your inbox.</span><span class="carrot-short">When you’re done, a personalized report lands in your inbox.</span></p>
    <p class="welcome-meta">15–20 minutes · No right or wrong answers · Go with your first instinct</p>
    <p class="welcome-precta">Now, find a quiet moment and…</p>
    <button class="btn btn-primary welcome-cta" id="btn-start">Start Assessment</button>
  </div>`;
}

// ---- Profile Confirmation (§0A, returning clients) ----
// Shown when the bootstrap route resolves to 'profile-confirm' (client record
// already has name/email/coach). Read-only card + Continue (always unlocked) +
// Save. Edit link routes to the Intake form (edit flow) prepopulated.
function renderProfileConfirm() {
  const i = state.intake || {};
  const fullName = `${i.firstName || ''} ${i.lastName || ''}`.trim();
  // Organisation row omitted entirely when empty (§0A.4) — no blank row.
  const orgRow = (i.organization && i.organization.trim())
    ? `<div class="pc-row"><div class="pc-label">Organization</div><div class="pc-value">${esc(i.organization)}</div></div>`
    : '';
  return `<div class="screen preassess-screen">
    <h1 class="preassess-heading">Welcome back, ${esc(i.firstName || 'there')}.</h1>
    <p class="preassess-subhead">We found your details on file. Confirm everything looks right before you begin.</p>
    <div class="pc-card">
      <div class="pc-row"><div class="pc-label">Name</div><div class="pc-value">${esc(fullName || '—')}</div></div>
      <div class="pc-row"><div class="pc-label">Email</div><div class="pc-value">${esc(i.email || '—')}</div></div>
      ${orgRow}
      <div class="pc-row"><div class="pc-label">Coach</div><div class="pc-value">${esc(i.coach || '—')}</div></div>
    </div>
    <button class="pc-edit" id="btn-edit-profile"><span class="pc-edit-icon">✎</span> Edit your profile</button>
    <div class="preassess-nav">
      <button class="btn btn-primary" id="btn-profile-continue">Continue</button>
      <button class="btn btn-ghost preassess-save" id="btn-save-later"><span class="save-full">Save and continue later</span><span class="save-short">Save &amp; Exit</span></button>
    </div>
  </div>`;
}

// ---- Intake ----
function renderIntake() {
  const i = state.intake || {};
  // Coach roster from the server bootstrap (active coaches, names only — §0B.7 / E).
  // Falls back to the two seeded coaches for non-token/local sessions.
  const bootCoaches = (typeof window !== 'undefined' && window.__hiveBootstrap && Array.isArray(window.__hiveBootstrap.coaches))
    ? window.__hiveBootstrap.coaches : [];
  const roster = bootCoaches.length ? bootCoaches : ['Cai Delumpa', 'Monique Breault'];
  const single = roster.length === 1;
  // Single coach → pre-select + disable (client can't change). Multiple → blank
  // default + require selection.
  const selectedCoach = single ? roster[0] : (i.coach && roster.includes(i.coach) ? i.coach : '');
  const coachOpts =
    (single ? '' : `<option value="" ${selectedCoach ? '' : 'selected'} disabled>Select your coach</option>`) +
    roster.map((c) => `<option value="${esc(c)}" ${selectedCoach === c ? 'selected' : ''}>${esc(c)}</option>`).join('');

  // Gate (§0B.4): all four required fields present (org optional). Computed for
  // the initial render; the live state is maintained in attachHandlers.
  const gateMet = !!((i.firstName || '').trim() && (i.lastName || '').trim() && (i.email || '').trim() && selectedCoach);

  return `<div class="screen preassess-screen intake-screen">
    <h1 class="preassess-heading">Before we begin</h1>
    <p class="preassess-subhead">Please share a few details so we can send your personalized report to the right place.</p>

    <div class="intake-form">
      <div class="intake-grid">
        <div class="intake-field">
          <label class="intake-label" for="intake-first-name">First name <span class="req">*</span></label>
          <input class="intake-input" id="intake-first-name" type="text" value="${esc(i.firstName || '')}" autocomplete="given-name" />
        </div>
        <div class="intake-field">
          <label class="intake-label" for="intake-last-name">Last name <span class="req">*</span></label>
          <input class="intake-input" id="intake-last-name" type="text" value="${esc(i.lastName || '')}" autocomplete="family-name" />
        </div>
      </div>

      <div class="intake-field">
        <label class="intake-label" for="intake-email">Email address <span class="req">*</span></label>
        <input class="intake-input" id="intake-email" type="email" value="${esc(i.email || '')}" autocomplete="email" />
        <div id="intake-email-error" class="intake-inline-error" style="display:none;">Please enter a valid email address.</div>
      </div>

      <div class="intake-field">
        <label class="intake-label" for="intake-organization">Organization <span class="intake-optional">(optional)</span></label>
        <input class="intake-input" id="intake-organization" type="text" value="${esc(i.organization || '')}" autocomplete="organization" />
      </div>

      <div class="intake-field">
        <label class="intake-label" for="intake-coach">Select your coach <span class="req">*</span></label>
        <select class="intake-input intake-select" id="intake-coach" ${single ? 'disabled' : ''}>
          ${coachOpts}
        </select>
      </div>

      <div id="intake-error" class="intake-form-error" style="display:none;">Please fill in all required fields.</div>

      <div class="preassess-nav">
        <button class="btn btn-primary" id="btn-intake-continue" ${gateMet ? '' : 'disabled'}>Continue</button>
        <button class="btn btn-ghost preassess-save" id="btn-save-later"><span class="save-full">Save and continue later</span><span class="save-short">Save &amp; Exit</span></button>
      </div>
    </div>
  </div>`;
}

// ---- Orientation Interstitial (§0C) ----
// Shown once on the initial run (after profile-confirm/intake, before Stage 0);
// skipped on resume. Full topbar, no progress, no Save. Logo note (§0C.5 /
// Decision C): PNGs absent → the topbar logo uses the inlined SVG with its
// clipPath ids namespaced to orient-logo-clip (handled in chromeFor /
// renderChromeShell) to avoid collision with any other instance on the page.
function renderOrientationInterstitial() {
  const pills = [
    { label: 'Setting the Stage', count: '4 short questions', kind: 'Open responses',     featured: true  },
    { label: 'Part 1',       count: '14 screens',        kind: 'Sliders',            featured: false },
    { label: 'Part 2',       count: '3 questions',       kind: 'Multiple choice',    featured: false },
    { label: 'Parts 3 & 4',  count: 'A few rounds',      kind: 'Paired comparisons', featured: false },
  ];
  const pillsHtml = pills.map((p) => `
    <div class="orient-pill ${p.featured ? 'featured' : ''}">
      <div class="orient-pill-label">${esc(p.label)}</div>
      <div class="orient-pill-count">${esc(p.count)}</div>
      <div class="orient-pill-kind">${esc(p.kind)}</div>
    </div>`).join('');

  return `<div class="screen orient-screen">
    <p class="orient-lead">Here’s what to expect — 4 parts, about 15–20 minutes total. Part 1 is the most involved, but it’s also where the most insight comes from. Take it at your own pace.</p>

    <div class="orient-pills">${pillsHtml}</div>

    <div class="orient-tip">
      <div class="orient-badge warmup">SETTING THE STAGE</div>
      <p class="orient-narrative">This first section gives us context for everything that follows. The richer the detail you provide, the more we have to work with.</p>
      <div class="bridge-tips-title">Other Helpful Tips:</div>
      <ul class="orient-tip-list">
        <li>As you answer the questions, think about your life in general, not just how you’ve been lately or at work. If you feel blocked, answer these questions from the perspective of your 25-year-old self.</li>
        <li>Take your time with these questions and know that there are no wrong answers.</li>
        <li>All questions require a response to continue. The richer the detail you provide, the more we have to work with.</li>
      </ul>
    </div>

    <div class="preassess-nav orient-nav">
      <button class="btn btn-primary" id="btn-orient-begin">Let’s begin</button>
    </div>
  </div>`;
}

// ---- Thank You / Assessment Complete (§0E) ----
// Terminal screen, rendered on the 'confirmation' phase after the final open
// response is submitted. Centered-logo chrome (bookend with Welcome). No
// Continue, no back, no progress.
function renderThankYou() {
  // Gradient checkmark badge (§0E.2).
  const check = `<div class="ty-badge"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  // Envelope glyph for the inbox card (Hive Blue).
  const envelope = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="#00B2D9" stroke-width="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5" stroke="#00B2D9" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>`;
  return `<div class="screen ty-screen">
    ${check}
    <div class="ty-eyebrow">ASSESSMENT COMPLETE</div>
    <h1 class="ty-headline"><span class="ty-light">You did it.</span><span class="ty-bold">Thank you.</span></h1>
    ${state.is_beta ? `<p class="ty-body">
      Thank you — your answers and feedback are a real gift. Your report is on its way and should arrive shortly. If it doesn’t arrive, please reach out to your coach.
    </p>` : `<p class="ty-body">
      <span class="ty-full">That took real honesty and self-reflection — and it shows. Your personalized Enneagram report is on its way and should arrive shortly. If you don’t receive your report, please reach out to your coach.</span>
      <span class="ty-short">That took real honesty. Your personalized Enneagram report is on its way and should arrive shortly. If you don’t receive it, please reach out to your coach.</span>
    </p>`}
    <div class="inbox-card">
      <div class="inbox-icon">${envelope}</div>
      <div class="inbox-body">
        <div class="inbox-title">Check your inbox</div>
        <div class="inbox-sub">
          <span class="ty-full">Your report will arrive from info@hiveleadership.com. Your coach will reach out soon to schedule your debrief.</span>
          <span class="ty-short">Your report will arrive from info@hiveleadership.com. Your coach will reach out soon.</span>
        </div>
        <div class="inbox-spam">Can’t find it? Check your spam or junk folder.</div>
      </div>
    </div>
  </div>`;
}

// ---- Post-submit Beta Review (§ beta feedback, PR-D) ----
// Shown only for beta sessions, between processing and the Thank You screen. Collects
// the client's self-hypothesis (Block 0), notes on flagged questions (Block A), a
// Likert experience rating (Block B), and an optional open comment (Block C). Local
// state lives in the transient state._betaReview (NOT serialized — strictly post-submit,
// no resume). All interactions mutate the DOM in place (no full re-render) so entered
// text survives, matching the in-assessment flag mechanic.

function initBetaReview() {
  state._betaReview = {
    types: [], typesDontKnow: false,
    instincts: [], instinctsDontKnow: false,
    likert: {},
    notes: '',
    flagComments: {},
  };
}

function renderBetaReview() {
  if (!state._betaReview) initBetaReview();
  const r = state._betaReview;

  // Block 0 — type (max 3) + instinct (max 2) multi-select, each with a mutually
  // exclusive "I don't know".
  const typeBtns = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((t) =>
    `<button type="button" class="br-chip${r.types.indexOf(t) >= 0 ? ' active' : ''}" data-br-type="${t}">${t}</button>`
  ).join('');
  const typeDk = `<button type="button" class="br-chip br-dk${r.typesDontKnow ? ' active' : ''}" data-br-type-dk="1">I don’t know</button>`;
  const instBtns = ['SP', 'SX', 'SO'].map((i) =>
    `<button type="button" class="br-chip${r.instincts.indexOf(i) >= 0 ? ' active' : ''}" data-br-inst="${i}">${i}</button>`
  ).join('');
  const instDk = `<button type="button" class="br-chip br-dk${r.instinctsDontKnow ? ' active' : ''}" data-br-inst-dk="1">I don’t know</button>`;

  // Block A — flagged statements, reconstructed from state.betaFlaggedQuestions.
  const flagKeys = Object.keys(state.betaFlaggedQuestions || {});
  let blockA;
  if (flagKeys.length === 0) {
    blockA = `<p class="br-empty">There were no questions flagged for your review.</p>`;
  } else {
    blockA = flagKeys.map((k) => {
      const entry = state.betaFlaggedQuestions[k];
      const reconsidered = !!entry.reconsidered;
      const text = BETA_QUESTION_TEXT[k] || k;
      const comment = r.flagComments[k] || '';
      return `<div class="br-flag" data-br-flag="${esc(k)}">
        <div class="br-flag-head">
          <button type="button" class="br-flag-toggle${reconsidered ? '' : ' flagged'}" data-br-flag-toggle="${esc(k)}" aria-pressed="${reconsidered ? 'false' : 'true'}" aria-label="Remove this flag" title="Remove this flag">${reconsidered ? FLAG_ICON_UNFLAGGED_SVG : FLAG_ICON_FLAGGED_SVG}</button>
          <span class="br-flag-text">${esc(text)}</span>
          <span class="br-flag-removehint">Click to remove.</span>
        </div>
        ${reconsidered ? '' : `<textarea class="text-input br-flag-input" data-br-flag-comment="${esc(k)}" placeholder="What gave you pause here?">${esc(comment)}</textarea>`}
      </div>`;
    }).join('');
  }

  // Block B — Likert matrix, 0–5 per dimension.
  const blockB = BETA_LIKERT_DIMS.map((d) => {
    const sel = r.likert[d.key];
    const scale = [0, 1, 2, 3, 4, 5].map((n) =>
      `<button type="button" class="br-likert-btn${sel === n ? ' active' : ''}" data-br-likert="${d.key}" data-br-likert-val="${n}">${n}</button>`
    ).join('');
    return `<div class="br-likert-row">
      <div class="br-likert-label">${esc(d.label)}</div>
      <div class="br-likert-scale">${scale}</div>
    </div>`;
  }).join('');

  return `<div class="screen br-screen">
    <h1 class="br-headline">Before we show you your results, we have a few questions.</h1>
    <div id="br-err" class="br-err" style="display:none;"></div>

    <section class="br-block">
      <h2 class="br-block-title">What type do you think you are?</h2>
      <p class="br-block-sub">Select up to 3.</p>
      <div class="br-chips" id="br-types">${typeBtns}${typeDk}</div>
      <h2 class="br-block-title br-block-title-2">And your dominant instinct?</h2>
      <p class="br-block-sub">Select up to 2.</p>
      <div class="br-chips" id="br-insts">${instBtns}${instDk}</div>
    </section>

    <section class="br-block">
      <h2 class="br-block-title">Questions you flagged</h2>
      ${blockA}
    </section>

    <section class="br-block">
      <h2 class="br-block-title">How was the experience?</h2>
      <p class="br-block-sub">0 = poor · 5 = excellent</p>
      <div class="br-likert">${blockB}</div>
    </section>

    <section class="br-block">
      <h2 class="br-block-title">Anything else?</h2>
      <textarea class="text-input" id="br-notes" placeholder="Anything else you’d like us to know about your experience?">${esc(r.notes || '')}</textarea>
    </section>

    <div class="nav-row">
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-br-submit" disabled>Submit</button>
    </div>
  </div>`;
}

// Sync Block 0 chip active/disabled state in place (no re-render).
function syncBetaReviewBlock0() {
  const r = state._betaReview; if (!r) return;
  document.querySelectorAll('[data-br-type]').forEach((el) => {
    const t = parseInt(el.getAttribute('data-br-type'), 10);
    const on = r.types.indexOf(t) >= 0;
    el.classList.toggle('active', on);
    el.classList.toggle('disabled', !on && (r.typesDontKnow || r.types.length >= 3));
  });
  const tdk = document.querySelector('[data-br-type-dk]');
  if (tdk) tdk.classList.toggle('active', r.typesDontKnow);
  document.querySelectorAll('[data-br-inst]').forEach((el) => {
    const v = el.getAttribute('data-br-inst');
    const on = r.instincts.indexOf(v) >= 0;
    el.classList.toggle('active', on);
    el.classList.toggle('disabled', !on && (r.instinctsDontKnow || r.instincts.length >= 2));
  });
  const idk = document.querySelector('[data-br-inst-dk]');
  if (idk) idk.classList.toggle('active', r.instinctsDontKnow);
}

// Submit gate: Block 0 complete (type + instinct each chosen or "I don't know"),
// all 5 Likert dimensions rated, and every flagged statement either has text or was
// toggled off (reconsidered). Block C is ungated.
function refreshBetaReviewGate() {
  const r = state._betaReview;
  const btn = document.getElementById('btn-br-submit');
  if (!r || !btn) return;
  const block0 = (r.types.length >= 1 || r.typesDontKnow) && (r.instincts.length >= 1 || r.instinctsDontKnow);
  const blockB = BETA_LIKERT_DIMS.every((d) => r.likert[d.key] !== undefined);
  const blockA = Object.keys(state.betaFlaggedQuestions || {}).every((k) => {
    const e = state.betaFlaggedQuestions[k];
    return e.reconsidered ? true : (r.flagComments[k] || '').trim().length > 0;
  });
  btn.disabled = !(block0 && blockB && blockA);
}

async function submitBetaReview() {
  const r = state._betaReview;
  const btn = document.getElementById('btn-br-submit');
  const err = document.getElementById('br-err');
  if (err) err.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  // Block A comments ride inside flagged_keys (no dedicated column). Reconsidered
  // items carry an empty comment. See the server route's PR-E contract note.
  const flaggedKeys = Object.keys(state.betaFlaggedQuestions || {}).map((k) => ({
    key: k,
    stageLabel: state.betaFlaggedQuestions[k].stageLabel,
    reconsidered: !!state.betaFlaggedQuestions[k].reconsidered,
    comment: state.betaFlaggedQuestions[k].reconsidered ? '' : (r.flagComments[k] || ''),
  }));

  const payload = {
    client_id: state.intake.client_id,
    selfHypothesisTypes:     { dontKnow: r.typesDontKnow,     values: r.typesDontKnow ? [] : r.types },
    selfHypothesisInstincts: { dontKnow: r.instinctsDontKnow, values: r.instinctsDontKnow ? [] : r.instincts },
    flaggedKeys,
    blockBAnswers: r.likert,
    overallNotes: (r.notes || '').trim() || null,
  };

  try {
    const res = await fetch('/api/beta-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error((data && data.error) || 'Submission failed.');
    state.phase = 'confirmation';
    render();
  } catch (e) {
    console.error('[beta-review] submit failed:', e);
    if (err) { err.textContent = 'Something went wrong submitting your feedback. Please try again.'; err.style.display = ''; }
    if (btn) { btn.disabled = false; btn.textContent = 'Submit'; }
  }
}

// ---- Resume Screen (§0G) ----
// Shown when a returning client's token resolves to an in-progress session. The
// SPA rehydrates session_state, stashes the saved phase as state._resumeTarget,
// and lands here instead of jumping straight into the assessment. "Continue where
// I left off" advances to _resumeTarget. No Start Over (§0G.2 — coach-mediated).
function renderResume() {
  const i = state.intake || {};
  const target = state._resumeTarget || 'stage0';
  const rp = resumeProgress(target);
  const segs = rp.segments.map((s) =>
    `<div class="seg seg-${s.state}" style="flex:${s.weight};"><div class="seg-fill" style="width:${Math.round(s.fill * 100)}%;"></div></div>`
  ).join('');
  return `<div class="screen preassess-screen">
    <h1 class="preassess-heading">Welcome back, ${esc(i.firstName || 'there')}.</h1>
    <p class="preassess-subhead">You’ve got a saved assessment in progress. Pick up right where you left off.</p>
    <div class="resume-card">
      <div class="resume-badge">${rp.pct}% <span class="resume-badge-full">complete</span><span class="resume-badge-short">done</span></div>
      <div class="resume-eyebrow">YOU LEFT OFF AT</div>
      <div class="resume-stage">${esc(rp.label)}</div>
      <div class="resume-screen">Screen ${rp.done} of ${rp.total}</div>
      <div class="seg-bar">${segs}</div>
      <div class="resume-here">
        <span class="resume-here-dot"></span>
        <span class="resume-here-full">You are here — screen ${rp.done} of ${rp.total} in ${esc(rp.label)}</span>
        <span class="resume-here-short">Screen ${rp.done} of ${rp.total} in ${esc(rp.label)}</span>
      </div>
    </div>
    <div class="preassess-nav">
      <button class="btn btn-primary resume-cta" id="btn-resume-continue">Continue where I left off</button>
    </div>
  </div>`;
}

// ---- Error screens (§10) ----
// Both are terminal, centered-logo chrome, no progress, no CTA. Rendered before any
// session state loads, off the bootstrap route. Invalid carries no client data
// (token didn't resolve — §10.3); Expired uses generic coach copy for alpha (§10.5).
function coachCard(subCopy) {
  const person = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke="#9AA3AD" stroke-width="2"/><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" stroke="#9AA3AD" stroke-width="2" stroke-linecap="round"/></svg>`;
  return `<div class="coach-card">
    <div class="coach-icon">${person}</div>
    <div class="coach-body">
      <div class="coach-title">Reach out to your coach</div>
      <div class="coach-sub">${subCopy}</div>
    </div>
  </div>`;
}

function renderExpiredToken() {
  const clock = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="#F68625" stroke-width="2"/><path d="M12 7.5V12l3 2" stroke="#F68625" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `<div class="screen err-screen">
    <div class="err-icon err-icon-expired">${clock}</div>
    <div class="err-eyebrow err-eyebrow-expired">LINK EXPIRED</div>
    <h1 class="err-headline">This link is no longer active.</h1>
    <p class="err-body">
      <span class="ty-full">Assessment links are valid for 30 days. Yours has expired, but your progress is safe — your coach can send you a fresh link to pick up where you left off.</span>
      <span class="ty-short">Your link has expired, but your progress is safe. Ask your coach to send a fresh link.</span>
    </p>
    ${coachCard('Ask them to resend your assessment link. Your saved responses will still be there.')}
  </div>`;
}

function renderInvalidToken() {
  const broken = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 15l6-6M8.5 8.5L7 10a3.5 3.5 0 005 5l1.5-1.5M15.5 15.5L17 14a3.5 3.5 0 00-5-5l-1.5 1.5" stroke="#9AA3AD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `<div class="screen err-screen">
    <div class="err-icon err-icon-invalid">${broken}</div>
    <div class="err-eyebrow err-eyebrow-invalid">LINK NOT RECOGNIZED</div>
    <h1 class="err-headline">We couldn’t find that link.</h1>
    <p class="err-body">
      <span class="ty-full">This link doesn’t match any assessment in our system. It may have been copied incorrectly. Your coach can send you the correct link.</span>
      <span class="ty-short">This link doesn’t match any assessment in our system. Your coach can send you the correct one.</span>
    </p>
    ${coachCard('Ask them to resend your assessment link.')}
  </div>`;
}

// ---- Final Open Question ----
function renderFinalOpen() {
  const val = state.finalOpenResponse || '';
  // §6.5/§7: required now — Skip removed, gate on non-whitespace, button label is
  // Continue (the submit action), consistent with every other screen.
  return `<div class="screen">
    <div class="q-text" style="margin-bottom:12px;">Is there anything about how you experience the world — what drives you, what you tend to avoid, or what you've learned about yourself — that the assessment didn't quite capture?</div>
    <!-- Mirrors the §0F primer "THE FINAL QUESTION" — keep the two in sync. [PLACEHOLDER — Mo review required] -->
    <p style="font-size:13px;color:var(--ink-lt);margin-bottom:16px;">You’ve answered a lot of questions — thank you! Your answer to this last one really helps us sharpen the read and bring your report to life. So don’t hold back — the richer the detail, the more we have to work with.</p>
    <textarea class="text-input" id="finalopen-input" placeholder="Type your response here…" style="min-height:130px;">${esc(val)}</textarea>
    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-finalopen-back">Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-finalopen-submit" ${val.trim() ? '' : 'disabled'}>Continue</button>
    </div>
  </div>`;
}

// ---- Stage 0 ----
// =================== BETA FLAG MECHANIC ===================
//
// In beta sessions (state.is_beta), every flaggable element renders a small icon
// at the end: a Hive Orange question-mark circle (unflagged) that toggles to a
// green checkmark circle (flagged). State lives in state.betaFlaggedQuestions and
// is re-read on every mount, so flags survive Back navigation and save/resume.
// The toggle mutates the clicked icon in place (no full re-render) — see the
// delegation block in attachHandlers().

// Hive Orange flag on a short pole (unflagged) — rectangular body, clean edges, no taper.
const FLAG_ICON_UNFLAGGED_SVG = '<svg class="bfi-svg" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="4" y="2.5" width="1.8" height="15" rx="0.9" fill="#F68625"/><rect x="5.8" y="3" width="9.4" height="7" fill="#F68625"/></svg>';
// Hive Green (#2ECC71) flag, same shape (flagged).
const FLAG_ICON_FLAGGED_SVG = '<svg class="bfi-svg" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="4" y="2.5" width="1.8" height="15" rx="0.9" fill="#2ECC71"/><rect x="5.8" y="3" width="9.4" height="7" fill="#2ECC71"/></svg>';

// Render the flag icon for a flaggable element. Returns '' in non-beta sessions so
// production output is byte-identical. key = statement identifier; stageLabel is the
// human stage name stored alongside the flag.
function renderFlagIcon(key, stageLabel) {
  if (!state.is_beta) return '';
  const flagged = !!state.betaFlaggedQuestions[key];
  return `<button type="button" class="beta-flag-icon${flagged ? ' flagged' : ''}" `
    + `data-flag-key="${esc(key)}" data-stage-label="${esc(stageLabel)}" `
    + `aria-pressed="${flagged ? 'true' : 'false'}" `
    + `aria-label="Flag this question for review" title="Flag this question for review">`
    + `${flagged ? FLAG_ICON_FLAGGED_SVG : FLAG_ICON_UNFLAGGED_SVG}</button>`;
}

function renderStage0() {
  const q = STAGE0_QUESTIONS[state.stage0Idx];
  const val = state.stage0Answers[q.id] || '';
  const refHtml = q.showRef ? `
    <div class="ref-box">
      <strong>Your words about yourself:</strong> ${esc(state.stage0Answers.q1 || '')}<br>
      <strong>How others describe you:</strong> ${esc(state.stage0Answers.q2 || '')}
    </div>` : '';

  return `<div class="screen">
    <div class="q-text">${q.text}${renderFlagIcon(q.id, 'Stage 0')}</div>
    ${refHtml}
    <textarea class="text-input" id="stage0-input" placeholder="Type your response here — the richer the detail, the more we have to work with." style="min-height:133px;">${esc(val)}</textarea>
    <div class="nav-row">
      ${state.stage0Idx > 0 ? '<button class="btn btn-ghost" id="btn-back">Back</button>' : ''}
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${val.trim() ? '' : 'disabled'}>Continue</button>
    </div>
  </div>`;
}

// Inline checkmark glyph for the interstitial status rows and the part-pill map.
const IC_CHECK_SVG = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Status row shared by both Part-complete interstitials: spinner + text in
// State A, checkmark + text in State B.
function interstitialStatus(ready, loadingText, readyText) {
  return ready
    ? `<div class="ic-status ready"><span class="ic-check">${IC_CHECK_SVG}</span><span>${esc(readyText)}</span></div>`
    : `<div class="ic-status loading"><span class="ic-spinner"></span><span>${esc(loadingText)}</span></div>`;
}

// Shared four-step part-pill progress map (Warmup / Part 1 / Part 2 / Parts 3 & 4),
// generalized from the §0F part2-complete map so the bridge interstitials can reuse
// it. `current` names the part the client is entering ('warmup'|'part1'|'part2'|
// 'part34'); every part before it renders 'done' (grey + check), the current part
// renders 'upnext' (blue), and the rest render upcoming (plain). Pass a `sub` map to
// annotate a pill with a small kind label (e.g. the up-next pill).
const PARTMAP_STEPS = [
  { key: 'warmup', label: 'Setting the Stage' },
  { key: 'part1',  label: 'Part 1' },
  { key: 'part2',  label: 'Part 2' },
  { key: 'part34', label: 'Parts 3 &amp; 4' },
];
function renderPartmap(current, subs) {
  const subMap = subs || {};
  const curIdx = PARTMAP_STEPS.findIndex((s) => s.key === current);
  const pill = (step, i) => {
    const cls = i < curIdx ? 'done' : (i === curIdx ? 'upnext' : '');
    const stateTxt = i < curIdx ? 'Done' : (i === curIdx ? 'Up next' : '');
    const label = i === curIdx ? `${step.label} →` : step.label;
    const sub = subMap[step.key] || '';
    return `<div class="partmap-pill ${cls}">
       ${cls === 'done' ? `<span class="pm-check">${IC_CHECK_SVG}</span>` : ''}
       <span class="pm-label">${label}</span>
       <span class="pm-state">${stateTxt}</span>
       ${sub ? `<span class="pm-sub">${sub}</span>` : ''}
     </div>`;
  };
  return `<div class="partmap">${PARTMAP_STEPS.map(pill).join('')}</div>`;
}

// ---- Part 1 Complete interstitial (§0D) ----
// Shown after Stage 1, before Stage 2. Two states: A (loading) while the CT
// mini-call resolves, B (ready) once it does. Per Decision A, a minimum 800ms
// State A is enforced in the handler (the CT mini-call is a no-op in v2), so the
// spinner→checkmark transition is always intentional. Orange "PART 1 COMPLETE"
// label @ 42% (chrome). Continue is locked until State B.
function renderPart1Complete() {
  const ready = !!state._part1Ready;
  const tipsLabel = ready ? 'A few tips for what’s ahead' : 'In the meantime, a few tips for what’s ahead';
  return `<div class="screen interstitial">
    <h1 class="ic-headline">Great work — Part 1 is done.</h1>
    <p class="ic-subhead"><span class="ty-full">That was the heaviest lift. From here it should take you 5–10 more minutes to complete the assessment.</span><span class="ty-short">That was the heaviest lift — about 5–10 more minutes to go.</span></p>
    ${interstitialStatus(ready, 'Getting your next set of questions ready…', 'All set — ready when you are.')}
    <div class="ic-divider"></div>
    <div class="ic-tips-label">${tipsLabel}</div>
    <ul class="ic-tips">
      <li>Answer from the arc of your life, not just what’s true right now. If you get stuck, think about how your 25-year-old self would respond.</li>
      <li>In the paired comparisons coming up, you’ll choose between two descriptions of a person. Pick the one that sounds more like you — even if both feel partly true.</li>
      <li>Trust your gut and keep moving — overthinking usually leads away from your true type, not toward it.</li>
    </ul>
    <div class="nav-row">
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${ready ? '' : 'disabled'}>Continue</button>
    </div>
  </div>`;
}

// ---- Part 2 Complete interstitial (§0F) ----
// Shown after Stage 2, before Stage 3. Two states gated by AI Call #1: A while
// the call is in flight, B once state._call1Done. Orange "PART 2 COMPLETE" @ 68%.
// Continue (locked until B) builds the Stage 3 routing and advances.
function renderPart2Complete() {
  const ready = !!state._call1Done;
  const partmap = renderPartmap('part34', { part34: 'Paired comparisons' });

  return `<div class="screen interstitial">
    <h1 class="ic-headline">Nearly there — three parts down.</h1>
    <p class="ic-subhead"><span class="ty-full">Parts 3 and 4 are the final stretch. They’re shorter and more focused — and end with one last open question.</span><span class="ty-short">Parts 3 and 4 are shorter and more focused — and end with one last open question.</span></p>
    ${partmap}
    <div class="primer-card">
      <div class="primer-section">
        <div class="primer-label">HOW PAIRED COMPARISONS WORK</div>
        <!-- [PLACEHOLDER — Mo review required] primer body, replace before beta -->
        <div class="primer-body">You’ll read two short descriptions — Person A and Person B — and choose the one that sounds more like you. If both feel partly true, pick “Both, but more A” or “Both, but more B” and lean toward whichever fits a little more. Go with your first read; there’s no trick here.</div>
      </div>
      <div class="primer-section">
        <div class="primer-label">THE FINAL QUESTION</div>
        <!-- [PLACEHOLDER — Mo review required] primer body, replace before beta -->
        <div class="primer-body">You’ve answered a lot of questions — thank you! Your answer to this last one really helps us sharpen the read and bring your report to life. So don’t hold back — the richer the detail, the more we have to work with.</div>
      </div>
    </div>
    ${interstitialStatus(ready, 'Selecting your final questions…', 'Your final questions are ready.')}
    <div class="nav-row">
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${ready ? '' : 'disabled'}>Continue</button>
    </div>
  </div>`;
}

// ---- Bridge: Stage 0 → Stage 1 (practice slider) ----
// Sits between the last Stage 0 open response (q4) and the first Stage 1 type
// slider screen. Explains how the sliders work and offers a single practice
// ("dummy") slider that behaves identically to a real Stage 1 slider but is
// deliberately ISOLATED from scoring and the responses snapshot: its value lives
// only on state._practiceSlider (a transient field — NOT serialized, NOT in any
// statement bank, NOT touched by buildResponsesSnapshot / scoreStage1Profile).
// Continue is gated until the practice slider has been moved (matches the "move
// all sliders to continue" mechanic of real slider screens).
function renderStage0to1Bridge() {
  const touched = state._practiceSlider !== null && state._practiceSlider !== undefined;
  const pos = touched ? state._practiceSlider : 50;
  return `<div class="screen">
    ${renderPartmap('part1')}
    <p class="slider-instr">Each statement has multiple parts — some may resonate strongly, others less so. Rate how true the whole statement feels for you, not just one piece of it. Think about your patterns over time, not just right now.</p>
    <p class="practice-cue">Try this practice slider:</p>
    <div class="stmt-list">
      <div class="stmt-block">
        <div class="stmt-text">I understand how this slider works.</div>
        <div class="pole-row">
          <span class="pole pole-left"><span class="pole-full">Not like me</span><span class="pole-short">Not like me</span></span>
          <div class="slider-track-wrap" id="tw0">
            <div class="track-bg" id="track0"></div>
            <input type="range" min="0" max="100" value="${pos}" id="s0" class="hive-range" aria-label="I understand how this slider works." />
            <div class="thumb-vis ${touched ? 'grabbing' : 'bar'}" id="th0"></div>
          </div>
          <span class="pole pole-right"><span class="pole-full">Very much like me</span><span class="pole-short">Very much</span></span>
        </div>
      </div>
    </div>
    <div class="bridge-tips">
      <div class="bridge-tips-title">Other Helpful Tips:</div>
      <ul class="orient-tip-list">
        <li>Go with your gut. If a statement makes you pause, ask yourself: would my closest friend say this is true of me?</li>
        <li>Move the slider even if you’re not sure — an uncertain answer is more useful than a blank one. You can’t get this wrong.</li>
        <li>All sliders must be moved to continue to the next screen.</li>
      </ul>
    </div>
    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-back">Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next" ${touched ? '' : 'disabled'}>Continue</button>
    </div>
  </div>`;
}

// ---- Bridge: Types open response → Instincts sliders ----
// Brief encouragement/reset screen between the Stage 1 type open response
// (stage1Idx 9) and the first instinct slider screen (stage1Idx 10). No
// interactive elements other than Continue.
function renderTypesToInstinctsBridge() {
  return `<div class="screen">
    ${renderPartmap('part1')}
    <p class="ic-subhead bridge-encouragement"><span class="bridge-encouragement-lead">Great work so far.</span> You’re in the home stretch of Part 1 — a few more questions and you’ll be on to Part 2!</p>
    <div class="nav-row">
      <button class="btn btn-ghost" id="btn-back">Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="btn-next">Continue</button>
    </div>
  </div>`;
}

// ---- Stage 1 (v2 sliders) ----
function renderStage1() {
  const screen = STAGE1_SCREENS[state.stage1Idx];
  const staleNotice = state._stage1StaleNotice
    ? `<div class="stale-notice">We’ve updated the assessment — please restart from the beginning.</div>`
    : '';
  // Chrome (progress bar / sub-progress) is rendered by render(); this header
  // now carries only the optional stale-session notice.
  const header = staleNotice;

  // Optional open-response screens — never gate Continue.
  if (screen.kind === 'type-open' || screen.kind === 'instinct-open') {
    const isType = screen.kind === 'type-open';
    const val = isType ? state.stage1TypeOpen : state.stage1InstinctOpen;
    const prompt = isType
      ? 'Our core motivations are often hard to pin down. If there’s something about what drives you that the previous statements didn’t capture, add it here.'
      : 'Instinct patterns can be subtle. If there’s something about where your attention and energy naturally go that the statements didn’t quite land on, add it here.';
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
        <div class="stmt-text">${esc(slot.statement.text)}${renderFlagIcon(slot.statement.id, 'Stage 1')}</div>
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
      <div class="slider-progress-txt" id="prog-txt">${touchedCount < N ? `${touchedCount} of ${N} answered — move all sliders to continue` : `${N} of ${N} answered`}</div>
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
    <div class="q-text">${esc(q.text)}${renderFlagIcon(q.id, 'Stage 2')}</div>
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

  return `<div class="screen">
    <div class="q-text">${esc(stem)}${renderFlagIcon(idx === 1 ? 'S3-Q2' : 'S3-Q1', 'Stage 3')}</div>

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

  return `<div class="screen">
    <div class="q-text">${esc(stem)}${renderFlagIcon('S4-' + slot.instrument, 'Stage 4')}</div>

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
  // ---- Beta flag icons ----
  // Toggle in place (no full re-render) so slider positions, textarea focus, and
  // caret survive. DOM is rebuilt each mountScreen(), so a fresh per-icon bind is
  // correct and needs no dedup. State persists across Back/resume via
  // state.betaFlaggedQuestions (see getSerializableState / renderFlagIcon).
  document.querySelectorAll('.beta-flag-icon').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.getAttribute('data-flag-key');
      const stageLabel = el.getAttribute('data-stage-label');
      const wasFlagged = !!state.betaFlaggedQuestions[key];
      if (wasFlagged) {
        delete state.betaFlaggedQuestions[key];
      } else {
        state.betaFlaggedQuestions[key] = { stageLabel, reconsidered: false };
      }
      const nowFlagged = !wasFlagged;
      el.classList.toggle('flagged', nowFlagged);
      el.setAttribute('aria-pressed', String(nowFlagged));
      el.innerHTML = nowFlagged ? FLAG_ICON_FLAGGED_SVG : FLAG_ICON_UNFLAGGED_SVG;
      console.log(`[beta-flag] ${nowFlagged ? 'flagged' : 'unflagged'} ${key} · ${stageLabel}`);
    });
  });

  // ---- Beta review screen (PR-D) ----
  if (state.phase === 'beta-review') {
    if (!state._betaReview) initBetaReview();
    const r = state._betaReview;

    // Block 0 — types (max 3), mutually exclusive with "I don't know".
    document.querySelectorAll('[data-br-type]').forEach((el) => {
      el.addEventListener('click', () => {
        const t = parseInt(el.getAttribute('data-br-type'), 10);
        r.typesDontKnow = false;
        const i = r.types.indexOf(t);
        if (i >= 0) r.types.splice(i, 1);
        else if (r.types.length < 3) r.types.push(t);
        syncBetaReviewBlock0();
        refreshBetaReviewGate();
      });
    });
    const typeDkEl = document.querySelector('[data-br-type-dk]');
    if (typeDkEl) typeDkEl.addEventListener('click', () => {
      r.typesDontKnow = !r.typesDontKnow;
      if (r.typesDontKnow) r.types = [];
      syncBetaReviewBlock0();
      refreshBetaReviewGate();
    });

    // Block 0 — instincts (max 2), mutually exclusive with "I don't know".
    document.querySelectorAll('[data-br-inst]').forEach((el) => {
      el.addEventListener('click', () => {
        const v = el.getAttribute('data-br-inst');
        r.instinctsDontKnow = false;
        const i = r.instincts.indexOf(v);
        if (i >= 0) r.instincts.splice(i, 1);
        else if (r.instincts.length < 2) r.instincts.push(v);
        syncBetaReviewBlock0();
        refreshBetaReviewGate();
      });
    });
    const instDkEl = document.querySelector('[data-br-inst-dk]');
    if (instDkEl) instDkEl.addEventListener('click', () => {
      r.instinctsDontKnow = !r.instinctsDontKnow;
      if (r.instinctsDontKnow) r.instincts = [];
      syncBetaReviewBlock0();
      refreshBetaReviewGate();
    });

    // Block A — "Click to remove" reverts the icon and drops the textbox in place,
    // logging reconsidered=true; clicking again restores the textbox.
    const bindFlagComment = (ta, k) => {
      ta.addEventListener('input', () => { r.flagComments[k] = ta.value; refreshBetaReviewGate(); });
    };
    document.querySelectorAll('[data-br-flag-toggle]').forEach((el) => {
      el.addEventListener('click', () => {
        const k = el.getAttribute('data-br-flag-toggle');
        const entry = state.betaFlaggedQuestions[k];
        if (!entry) return;
        entry.reconsidered = !entry.reconsidered;
        console.log(`[beta-flag] review ${entry.reconsidered ? 'reconsidered (removed)' : 're-flagged'} ${k}`);
        el.classList.toggle('flagged', !entry.reconsidered);
        el.setAttribute('aria-pressed', String(!entry.reconsidered));
        el.innerHTML = entry.reconsidered ? FLAG_ICON_UNFLAGGED_SVG : FLAG_ICON_FLAGGED_SVG;
        const row = el.closest('[data-br-flag]');
        const existing = row && row.querySelector('[data-br-flag-comment]');
        if (entry.reconsidered) {
          if (existing) existing.remove();
          delete r.flagComments[k];
        } else if (row && !existing) {
          const ta = document.createElement('textarea');
          ta.className = 'text-input br-flag-input';
          ta.setAttribute('data-br-flag-comment', k);
          ta.placeholder = 'What gave you pause here?';
          ta.value = r.flagComments[k] || '';
          bindFlagComment(ta, k);
          row.appendChild(ta);
        }
        refreshBetaReviewGate();
      });
    });
    document.querySelectorAll('[data-br-flag-comment]').forEach((el) => {
      bindFlagComment(el, el.getAttribute('data-br-flag-comment'));
    });

    // Block B — Likert.
    document.querySelectorAll('[data-br-likert]').forEach((el) => {
      el.addEventListener('click', () => {
        const dim = el.getAttribute('data-br-likert');
        const val = parseInt(el.getAttribute('data-br-likert-val'), 10);
        r.likert[dim] = val;
        document.querySelectorAll(`[data-br-likert="${dim}"]`).forEach((b) => {
          b.classList.toggle('active', parseInt(b.getAttribute('data-br-likert-val'), 10) === val);
        });
        refreshBetaReviewGate();
      });
    });

    // Block C — optional notes.
    const notesEl = document.getElementById('br-notes');
    if (notesEl) notesEl.addEventListener('input', () => { r.notes = notesEl.value; });

    // Submit.
    const submitBtn = document.getElementById('btn-br-submit');
    if (submitBtn) submitBtn.addEventListener('click', submitBetaReview);

    syncBetaReviewBlock0();
    refreshBetaReviewGate();
  }

  // ---- Welcome (§0) ----
  const btnStart = document.getElementById('btn-start');
  if (btnStart) btnStart.addEventListener('click', () => {
    // Belt-and-suspenders: clear any stale persisted result when a fresh
    // assessment begins.
    clearResult();
    // Decision D: commit the session to in_progress at Start so Save works on the
    // profile-confirm / intake screens. Fire-and-forget — resolves long before
    // the first session save (Stage 0 → Stage 1).
    beginAssessment();
    // Token clients always resolve to profile-confirm (Decision B); local/no-token
    // sessions fall back to the intake form.
    const route = (typeof window !== 'undefined' && window.__hiveBootstrap && window.__hiveBootstrap.route) || 'intake';
    state.phase = (route === 'profile-confirm') ? 'profile-confirm' : 'intake';
    render();
  });

  // ---- Profile Confirmation (§0A) ----
  const btnProfileContinue = document.getElementById('btn-profile-continue');
  if (btnProfileContinue) btnProfileContinue.addEventListener('click', () => {
    state.phase = 'orientation';
    render();
  });
  const btnEditProfile = document.getElementById('btn-edit-profile');
  if (btnEditProfile) btnEditProfile.addEventListener('click', () => {
    state.phase = 'intake';
    render();
  });

  // ---- Intake form (§0B) ----
  // Live gate: Continue unlocks only when all four required fields are present.
  const refreshIntakeGate = () => {
    const btn = document.getElementById('btn-intake-continue');
    if (!btn) return;
    const v = (id) => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
    btn.disabled = !(v('intake-first-name') && v('intake-last-name') && v('intake-email') && v('intake-coach'));
  };
  ['intake-first-name', 'intake-last-name', 'intake-email', 'intake-coach'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', refreshIntakeGate);
    el.addEventListener('change', refreshIntakeGate);
  });

  const btnIntakeContinue = document.getElementById('btn-intake-continue');
  if (btnIntakeContinue) {
    btnIntakeContinue.addEventListener('click', async () => {
      const firstName = (document.getElementById('intake-first-name').value || '').trim();
      const lastName = (document.getElementById('intake-last-name').value || '').trim();
      const email = (document.getElementById('intake-email').value || '').trim();
      const organization = (document.getElementById('intake-organization').value || '').trim();
      const coach = (document.getElementById('intake-coach').value || '').trim();

      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const errorDiv = document.getElementById('intake-error');
      const emailErrorDiv = document.getElementById('intake-email-error');

      emailErrorDiv.style.display = (!email || emailValid) ? 'none' : 'block';

      if (!firstName || !lastName || !email || !emailValid || !coach) {
        errorDiv.style.display = 'block';
        return;
      }

      errorDiv.style.display = 'none';
      // Preserve token / client_id while updating the editable fields (§0B edit flow).
      Object.assign(state.intake, { firstName, lastName, email, organization, coach });
      await persistProfile();   // edit-flow: update the client record in place
      state.phase = 'orientation';
      render();
    });
  }

  // ---- Orientation (§0C) ----
  const btnOrientBegin = document.getElementById('btn-orient-begin');
  if (btnOrientBegin) btnOrientBegin.addEventListener('click', () => {
    state.phase = 'stage0';
    state.stage0Idx = 0;
    render();
    // Persist on entering Stage 0 so a refresh on Q1 (before the client advances)
    // resumes to Q1 instead of re-serving the pre-assessment flow. Q1 isn't answered
    // yet, so the server does NOT stamp assessment_started_at on this save — the
    // timing clock stays anchored to the Q1 answer (see /save handler, §9.2).
    saveSessionState();
  });

  // Resume (§0G) — advance straight to the saved screen; no replay of prior
  // screens or interstitials (§0G.6). All resumable state was rehydrated at boot.
  const btnResumeContinue = document.getElementById('btn-resume-continue');
  if (btnResumeContinue) btnResumeContinue.addEventListener('click', () => {
    state.phase = state._resumeTarget || 'stage0';
    render();
  });

  // Restart (used by the "New Analysis" button on the results screen)
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
        // §9.2 timing: persist after each Stage 0 answer so the FIRST /save lands
        // at Q1 — the server stamps assessment_started_at on that save (guarded,
        // never overwritten on later saves). Best-effort, silent.
        saveSessionState();
      } else {
        // Stage 0 complete — fire the Stage 0 mini-call silently (background,
        // snapshot-guarded) and initialize Stage 1 state. Timing is preserved: the
        // mini-call + initStage1() fire HERE on leaving Stage 0, not on the bridge's
        // Continue. Then route into the stage0→stage1 bridge (practice slider) which
        // precedes the first Stage 1 type slider screen.
        fireStage0MiniCall();
        initStage1();
        state._practiceSlider = null;   // fresh practice slider each time we enter the bridge
        state.phase = 'stage0to1-bridge';
        render();
        saveSessionState();
      }
    });
  }

  // ---- Bridge: Stage 0 → Stage 1 (practice slider) ----
  // Wires the single dummy slider so it behaves identically to a real Stage 1
  // slider (morph on first contact, color/track gradient, thumb tracking) while
  // writing ONLY to state._practiceSlider. Continue is gated until it's moved.
  if (state.phase === 'stage0to1-bridge') {
    const THUMB = 11; // half the grabbing-handle diameter, keeps it on-track
    const valToColor = (v) => {
      const t = v / 100;
      const r = Math.round(180 + (24 - 180) * t);
      const g = Math.round(210 + (95 - 210) * t);
      const b = Math.round(240 + (165 - 240) * t);
      return `rgb(${r},${g},${b})`;
    };
    const trackWidth = () => {
      const tw = document.getElementById('tw0');
      return tw ? tw.getBoundingClientRect().width : 0;
    };
    const placeThumb = (pct) => {
      const th = document.getElementById('th0');
      const w = trackWidth();
      if (th && w) th.style.left = (THUMB + (pct / 100) * (w - THUMB * 2)) + 'px';
    };
    const renderTrack = (v) => {
      const el = document.getElementById('track0');
      const w = trackWidth();
      if (!el || !w) return;
      const leftPx = THUMB + (v / 100) * (w - THUMB * 2);
      const pct = Math.round((leftPx / w) * 100);
      el.style.background =
        `linear-gradient(to right, rgba(180,210,240,0.18) 0%, ${valToColor(v)} ${pct}%, var(--border) ${pct}%, var(--border) 100%)`;
    };
    const refreshGate = () => {
      const btn = document.getElementById('btn-next');
      if (btn) btn.disabled = state._practiceSlider === null || state._practiceSlider === undefined;
    };

    // Position the handle once the DOM has laid out (mirrors Stage 1's deferred init).
    const initPractice = () => {
      if (!document.getElementById('tw0')) return;
      const v = state._practiceSlider;
      placeThumb(v === null || v === undefined ? 50 : v);
      const el = document.getElementById('track0');
      if (el) {
        if (v === null || v === undefined) el.style.background = 'var(--border)';
        else renderTrack(v);
      }
    };
    setTimeout(initPractice, 60);
    if (_stage1ResizeHandler) { window.removeEventListener('resize', _stage1ResizeHandler); }
    _stage1ResizeHandler = initPractice;
    window.addEventListener('resize', initPractice);

    const input = document.getElementById('s0');
    const thumb = document.getElementById('th0');
    if (input && thumb) {
      const grab = () => {
        if (thumb.classList.contains('bar')) {
          thumb.classList.remove('bar');
          thumb.classList.add('grabbing');
        }
        const v = parseInt(input.value, 10);
        thumb.style.background = valToColor(v);
        if (state._practiceSlider === null || state._practiceSlider === undefined) state._practiceSlider = v;
        renderTrack(v);
        placeThumb(v);
        refreshGate();
      };
      input.addEventListener('mousedown', grab);
      input.addEventListener('touchstart', grab);
      input.addEventListener('input', () => {
        if (thumb.classList.contains('bar')) {
          thumb.classList.remove('bar');
          thumb.classList.add('grabbing');
        }
        const v = parseInt(input.value, 10);
        state._practiceSlider = v;
        thumb.style.background = valToColor(v);
        renderTrack(v);
        placeThumb(v);
        refreshGate();
      });
    }

    const btnBackBr = document.getElementById('btn-back');
    if (btnBackBr) btnBackBr.addEventListener('click', () => {
      state.phase = 'stage0';
      state.stage0Idx = 3;
      render();
    });
    const btnNextBr = document.getElementById('btn-next');
    if (btnNextBr) btnNextBr.addEventListener('click', () => {
      if (state._practiceSlider === null || state._practiceSlider === undefined) return; // gated
      state.phase = 'stage1';
      state.stage1Idx = 0;
      render();
      saveSessionState();
    });
  }

  // ---- Bridge: Types open response → Instincts sliders ----
  // Continue-only encouragement screen. Back → type open response (stage1 idx 9);
  // Continue → first instinct slider (stage1 idx 10).
  if (state.phase === 'types-to-instincts-bridge') {
    const btnBackTb = document.getElementById('btn-back');
    if (btnBackTb) btnBackTb.addEventListener('click', () => {
      state.phase = 'stage1';
      state.stage1Idx = 9;
      render();
    });
    const btnNextTb = document.getElementById('btn-next');
    if (btnNextTb) btnNextTb.addEventListener('click', () => {
      state.phase = 'stage1';
      state.stage1Idx = 10;
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
        if (txt) txt.textContent = n < N
          ? `${n} of ${N} answered — move all sliders to continue`
          : `${N} of ${N} answered`;
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
      if (state.stage1Idx === 0) {
        // Back from the first type slider → the stage0→stage1 practice bridge.
        state.phase = 'stage0to1-bridge';
        render();
      } else if (state.stage1Idx === 10) {
        // Back from the first instinct slider → the types→instincts bridge.
        state.phase = 'types-to-instincts-bridge';
        render();
      } else { state.stage1Idx--; render(); }
    });

    const btnNext1 = document.getElementById('btn-next');
    if (btnNext1) btnNext1.addEventListener('click', () => {
      state._stage1StaleNotice = false;
      if (state.stage1Idx === 9) {
        // After the type open response → the types→instincts bridge (before the
        // first instinct slider at idx 10).
        state.phase = 'types-to-instincts-bridge';
        render();
        saveSessionState();
      } else if (state.stage1Idx < STAGE1_SCREENS.length - 1) {
        state.stage1Idx++;
        render();
        saveSessionState();
      } else {
        // Stage 1 complete — score the slider profile and advance to the Part 1
        // Complete interstitial (§0D). _part1Ready starts false so State A (spinner)
        // shows; the part1-complete handler flips it once the CT mini-call resolves
        // (with an 800ms minimum, Decision A).
        state.scores = scoreStage1Profile(state.stage1TypeSliders, state.stage1InstinctSliders);
        console.log('=== STAGE 1 v2 PROFILE ===', state.scores);
        state._part1Ready = false;
        state.phase = 'part1-complete';
        render();
        saveSessionState();
      }
    });
  }

  // ---- Part 1 Complete interstitial (§0D) ----
  // State A (spinner) on entry; fires the CT mini-call and flips to State B once
  // it resolves — but never before an 800ms minimum, so the spinner→checkmark
  // transition is always intentional (Decision A; the CT mini-call is a no-op in
  // v2). On error the mini-call still resolves (it catches internally). Continue
  // is user-controlled and advances to Stage 2 (no auto-advance, §0D.6).
  if (state.phase === 'part1-complete') {
    if (!state._part1Ready) {
      const MIN_SPINNER_MS = 800;
      const started = performance.now();
      let settled = false;
      const reveal = () => {
        if (settled) return;
        settled = true;
        const elapsed = performance.now() - started;
        const wait = Math.max(0, MIN_SPINNER_MS - elapsed);
        setTimeout(() => {
          if (state.phase === 'part1-complete') {
            state._part1Ready = true;
            render();
            saveSessionState();
          }
        }, wait);
      };
      // 8s hard cap so a hung call never traps the client (mirrors the old guard).
      const timer = setTimeout(() => { console.warn('[part1-complete] 8s cap — proceeding'); reveal(); }, 8000);
      fireCtMiniCall().finally(() => { clearTimeout(timer); reveal(); });
    }

    const btnNextP1 = document.getElementById('btn-next');
    if (btnNextP1) btnNextP1.addEventListener('click', () => {
      if (!state._part1Ready) return;   // locked until State B
      state.phase = 'stage2';
      state.stage2Idx = 0;
      render();
      saveSessionState();
    });
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
        // part2-complete interstitial fires the call, stores the §6.3 result, and
        // (on Continue) builds the Stage 3 routing off state.call1Result.
        state._call1Done = false;
        state.phase = 'part2-complete';
        render();
        saveSessionState();
      }
    });
  }

  // ---- Part 2 Complete interstitial (§0F) ----
  // Fires AI Call #1 once on entry (State A → B). A 20s timeout caps the wait so
  // the client never sees a stuck spinner; on success or timeout we mark the
  // screen ready and persist into session_state. Continue (unlocked in State B)
  // builds the Stage 3 routing off state.call1Result and advances (§7.1).
  if (state.phase === 'part2-complete') {
    const contextBlock = state.scores ? buildContextBlock(state.scores) : '';
    const unchanged = state.call1LastSnapshot !== null
      && contextBlock === state.call1LastSnapshot
      && !!state.call1Result;

    const finish = () => {
      if (state.phase === 'part2-complete' && !state._call1Done) {
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

    // Save draft as user types, and live-gate Continue on non-whitespace (§6.5).
    if (inputEl) inputEl.addEventListener('input', () => {
      state.finalOpenResponse = inputEl.value;
      const btn = document.getElementById('btn-finalopen-submit');
      if (btn) btn.disabled = !inputEl.value.trim();
    });

    const submitFinalOpen = () => {
      const v = (inputEl ? inputEl.value : '') || '';
      if (!v.trim()) return;   // required — guard behind the disabled button
      state.finalOpenResponse = v;
      state.phase = 'processing';
      render();
      callAPI();
    };

    const btnSubmit = document.getElementById('btn-finalopen-submit');
    if (btnSubmit) btnSubmit.addEventListener('click', submitFinalOpen);

    const btnBack = document.getElementById('btn-finalopen-back');
    if (btnBack) btnBack.addEventListener('click', () => {
      state.phase = 'stage4';
      state.stage4Idx = state.stage4Sequence.length - 1;
      render();
    });
  }

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

