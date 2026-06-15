'use strict';

// In-app version of beta/generate_report.js — kept in sync because production
// deployments only ship the app/ folder. ROOT is app/ here; modules and
// renderer paths are adjusted accordingly.
const path = require('path');
const ROOT = __dirname;  // app/ is the root when deployed
const APP_MODULES = path.join(ROOT, 'node_modules');

require(path.join(APP_MODULES, 'dotenv')).config({ path: path.join(ROOT, '.env') });

const fs   = require('fs');
const { Pool } = require(path.join(APP_MODULES, 'pg'));

const { buildBetaHTML, buildPdfOptions } = require(path.join(ROOT, 'renderer'));

// ─── Question data (mirrored from assessment.js — single source of truth) ───

const STAGE0_QUESTIONS = [
  { id: 'q1', title: 'SELF-DESCRIPTION',     text: 'What are 3–5 words or phrases you would use to describe yourself?' },
  { id: 'q2', title: 'OTHERS’ DESCRIPTION', text: 'What are 3–5 words or phrases others would use to describe you?' },
  { id: 'q3', title: 'STRENGTH',              text: 'Which of the words or phrases you listed is your greatest strength?' },
  { id: 'q4', title: 'SHADOW',                text: 'Which of the words or phrases you listed tends to be most problematic for you?' },
];

const STAGE1_QUESTIONS = [
  { id: 'q1',  type: 'centers',  title: 'SOMETHING WENT RIGHT', text: 'Think about a time when things were going really well at work or in your personal life. Rank the following for what that experience was like.', options: { a: 'I had the autonomy and ability to do things my way.', b: 'The people around me had my back and I had theirs.', c: 'Things went as I planned and the result was better than I imagined.' }, mapping: { a: 'body', b: 'heart', c: 'head' } },
  { id: 'q2',  type: 'instinct', title: 'MEETING SOMEONE NEW',   text: 'You’re meeting a friend of a friend at a social event. Rank the following by what you become most curious about.', options: { a: 'Where they live and what they like to do.', b: 'How they’re connected to our mutual friend and this group.', c: 'Whether there’s a real connection to be had.' }, mapping: { a: 'sp', b: 'so', c: 'sx' } },
  { id: 'q3',  type: 'centers',  title: 'AT YOUR BEST',          text: 'Think about a moment when you were at your best. Rank the following in terms of how much each contributed to that.', options: { a: 'I felt grounded and impactful.', b: 'I felt seen and valued.', c: 'I felt knowledgeable and prepared.' }, mapping: { a: 'body', b: 'heart', c: 'head' } },
  { id: 'q4',  type: 'instinct', title: 'WORST CASE',            text: 'What’s the worst thing that could happen? Rank the following for what would rock your world the most.', options: { a: 'Losing my financial security and stability.', b: 'Losing my community and sense of belonging.', c: 'Losing a close relationship.' }, mapping: { a: 'sp', b: 'so', c: 'sx' } },
  { id: 'q5',  type: 'centers',  title: 'SITTING QUIETLY',       text: 'You’re sitting quietly with nothing demanding your attention. Rank the following by where your mind most naturally drifts.', options: { a: 'Something in the present that isn’t quite right and could be better.', b: 'Something in the past you wish had gone differently.', c: 'Something in the future you’re looking forward to or thinking through.' }, mapping: { a: 'body', b: 'heart', c: 'head' } },
  { id: 'q6',  type: 'instinct', title: 'NEW JOB',               text: 'You’ve just started a new job and it’s your first week. Rank the following by what would make you feel most comfortable right away.', options: { a: 'Making sure I have my work area set up the way I want it.', b: 'Meeting — and sussing out — all of my co-workers.', c: 'Finding one or two people I genuinely connect with.' }, mapping: { a: 'sp', b: 'so', c: 'sx' } },
  { id: 'q7',  type: 'centers',  title: 'FREE TIME',             text: 'A big meeting just got cancelled and you suddenly have a big chunk of free time. Rank the following in terms of what you naturally gravitate towards.', options: { a: 'I get busy doing something active or productive.', b: 'I connect with someone or something meaningful.', c: 'I sit down and plan for what’s next.' }, mapping: { a: 'body', b: 'heart', c: 'head' } },
  { id: 'q8',  type: 'instinct', title: 'RETURNING HOME',        text: 'You’ve just returned home after two weeks away. Rank the following by what you find yourself doing first.', options: { a: 'Getting my space and routine back in order.', b: 'Catching up on the latest in my social circle.', c: 'Reconnecting with my significant other or best friend.' }, mapping: { a: 'sp', b: 'so', c: 'sx' } },
  { id: 'q9',  type: 'centers',  title: 'RESTRUCTURING',         text: 'You’ve just learned that your organization is going through a significant restructuring that will affect your role. Rank the following by how closely each matches your immediate internal reaction.', options: { a: 'I feel a surge of resistance — this is not okay.', b: 'My heart sinks with concern about my worth and place.', c: 'I feel anxious about what this means for me.' }, mapping: { a: 'body', b: 'heart', c: 'head' } },
  { id: 'q10', type: 'centers',  title: 'DECISION MAKING',       text: 'Recall a time when you had to choose between two equally important and viable options. Rank the following in terms of what played the biggest role in your decision-making.', options: { a: 'I trusted my gut.', b: 'I followed my emotions.', c: 'I considered all the facts and options.' }, mapping: { a: 'body', b: 'heart', c: 'head' } },
  { id: 'q11', type: 'instinct', title: 'HOW YOU RECHARGE',      text: 'It’s Sunday night and you’re about to embark on a busy week. Rank the following in terms of how you prefer to spend your time.', options: { a: 'Laying low and taking it easy, making sure I have energy for the week ahead.', b: 'Getting together with friends for one last hurrah before the busy week starts.', c: 'Spending quality time with someone I care about.' }, mapping: { a: 'sp', b: 'so', c: 'sx' } },
  { id: 'q12', type: 'instinct', title: 'YOUR FIRST MOVE',       text: 'You’ve just arrived at a party. After greeting the hosts, rank the following by what you’d instinctively want to do next.', options: { a: 'Go to the food table and make sure there’s stuff you like.', b: 'Scan the room to see who’s here and who’s important to connect with.', c: 'Find someone you really want to connect with and dive in.' }, mapping: { a: 'sp', b: 'so', c: 'sx' } },
];

const STAGE2_QUESTIONS = [
  { id: 'xref-q1', framework: 'Hornevian',       title: 'SOCIAL STANCE',    text: 'How do you tend to go about getting what you want or need in life?',                                     options: { A: 'I go for what I want, knowing I can make it happen.', B: 'I actively attend to what’s needed by the person, situation, or group.', C: 'I move inward where I know I’ll find peace, solitude, and meaning.' } },
  { id: 'xref-q2', framework: 'Harmonic',         title: 'CONFLICT RESPONSE', text: 'How do you experience not getting what matters most to you?',                                           options: { A: 'I call out what’s wrong, sometimes loudly, and challenge the status quo.', B: 'I look on the bright side and try to make the best of the situation.', C: 'I switch to analysis mode and start correcting what’s wrong.' } },
  { id: 'xref-q3', framework: 'ObjectRelations',  title: 'LIFE THEME',        text: 'Which of the following have you tended to prioritize most over the course of your life?',              options: { A: 'Having a sense of connection and belonging with others.', B: 'Reaching toward something better, deeper, or more complete.', C: 'Protecting myself from intrusion, overwhelm, and control by others.' } },
];

const STAGE3_Q1_STEM = 'Which of these sounds most like you at your best?';
const STAGE3_Q2_STEM = 'Which of these is hardest for you to be with?';

const STAGE3_CORE_MOTIVATIONS = {
  1: 'I am doing things the right way. I feel principled, clear, and in integrity with my own standards.',
  2: 'I am tuned in to what others need. I feel genuinely helpful, warm, and deeply connected.',
  3: 'I am achieving my goals and getting things done. I feel capable, successful, and recognized for what I bring.',
  4: 'I am expressing who I really am — nothing hidden, nothing performed. I feel a sense of meaning and purpose, alive, and creative.',
  5: 'I am deeply knowledgeable about things that matter. I feel well-boundaried, self-sufficient, and resourced.',
  6: 'I am prepared for whatever life throws at me. I feel steady, certain, and loyal to people I trust.',
  7: 'I am experiencing life to the fullest. I feel free, expansive, and open to everything available to me.',
  8: 'I am fully in control of my world. I feel strong, powerful, and completely unbothered by outside pressure.',
  9: 'I am experiencing a sense of inner and outer calm. I feel connected to everyone and everything.',
};

const STAGE3_AVOIDANCE_QUESTIONS = {
  '1-6': { personA: 'The voice in my head that tells me I’m not enough, not good enough, or that I’m wrong.', personB: 'Feeling unsupported, unprepared, or uncertain about what’s about to happen.' },
  '1-9': { personA: 'Seeing something wrong, incorrect, or broken and not being able to fix it.', personB: 'Experiencing conflict or tension in the peace and not being able to escape it.' },
  '2-6': { personA: 'Feeling like my care and support is unwanted or unnecessary.', personB: 'Feeling like I don’t know where things stand or who I can truly trust.' },
  '2-9': { personA: 'Feeling like I’m no longer needed by people that matter to me.', personB: 'Feeling friction or conflict with people that matter to me.' },
  '3-6': { personA: 'Feeling like my efforts aren’t being noticed or valued.', personB: 'Feeling unsupported in the face of uncertainty.' },
  '3-7': { personA: 'Not having a clear goal to achieve or things on my to-do list.', personB: 'Running out of ideas, energy, or possibilities.' },
  '3-8': { personA: 'People who don’t appreciate what it took for me to achieve a goal.', personB: 'People who won’t go head-to-head with me in tough conversations.' },
  '4-5': { personA: 'Feeling like there’s nothing special about me — that I’m just like everyone else.', personB: 'Feeling overwhelmed by an emotional experience, mine or someone else’s.' },
  '4-9': { personA: 'Feeling emotionally flat or numb — like nothing is moving inside me.', personB: 'Feeling pulled into someone else’s emotional intensity or drama.' },
  '5-6': { personA: 'Feeling like I don’t have the resources to navigate the world.', personB: 'Feeling unsupported in the face of uncertainty.' },
  '5-9': { personA: 'Feeling depleted by too much engagement or contact.', personB: 'Feeling pressured to take a position that could cause conflict or disharmony.' },
  '6-8': { personA: 'Feeling unprepared for something that could go wrong.', personB: 'Feeling weak, vulnerable, or like someone has gotten the upper hand.' },
};

const STAGE3_CT_PAIRS = {
  'SO-7': { label: 'SO 7 vs. Type 2', counterType: 7, lookalike: 2, personA: 'I am sharing enjoyable experiences with the people around me.', personB: 'I am tuned in to and delivering what others need.' },
  'SX-6': { label: 'SX 6 vs. Type 8', counterType: 6, lookalike: 8, personA: 'I am facing something head-on and not letting fear win.', personB: 'I am in full control, making important things happen.' },
  'SP-3': { label: 'SP 3 vs. Type 1', counterType: 3, lookalike: 1, personA: 'I am getting results and making things happen without needing anyone’s help or approval.', personB: 'I am doing things the right way, even when no one is watching.' },
  'SP-4': { label: 'SP 4 vs. Type 3', counterType: 4, lookalike: 3, personA: 'I am throwing myself into something that feels alive, authentic, and worth pursuing.', personB: 'I am moving toward a goal and fully focused on making it happen.' },
  'SX-1': { label: 'SX 1 vs. Type 8', counterType: 1, lookalike: 8, personA: 'I feel a strong pull to step in to fix what’s wrong or is falling short of the ideal.', personB: 'I am fully at ease with my own power and presence and know how to use it.' },
};

const STAGE4_STRESS_STEM    = 'When you’re under significant and prolonged stress, which of these feels most like what happens to you — even if it surprises you?';
const STAGE4_SECURITY_STEM  = 'When you feel genuinely safe, relaxed, and at ease — when the pressure is off — which of these feels most like how you show up?';
const STAGE4_HABIT_STEM     = 'Without trying to control it, where does your attention tend to go first in most situations?';

const STAGE4_STRESS = {
  1: ['I become weighed down with emotion. I start dwelling on what others have naturally that I don’t and I long to be whole.', 'I become more anxious and suspicious. I start worrying about what could go wrong and need reassurance that things will be okay.', 'I go numb and withdraw. I go along to get along, hoping that will restore the peace both internally and externally.'],
  2: ['I get angry, forceful, and confrontational. My usual warm and giving self disappears and I become demanding, blunt, or even aggressive about what I need.', 'I become hypervigilant about who I can trust. I get suspicious and start needing reassurance that the people in my life are actually there for me.', 'I turn inward and become absorbed in how I’m feeling. I pull away from others and get lost in my own emotional world.'],
  3: ['I shut down. The drive and ambition that usually feel effortless just vanish and I find myself checked out and disengaged.', 'I become anxious and start second-guessing myself. I lose confidence in my own judgment and need others to tell me I’m on the right track.', 'I become overly focused on others and what they need. I shift into caretaking mode as a way to feel needed and connected.'],
  4: ['I become overly helpful and acutely aware of what others need. I set my own needs aside and seek the appreciation of others.', 'I become self-critical and rigid. I get fixated on what I’ve done wrong and feel a strong pull to correct myself.', 'I go into overdrive seeking stimulation. I start filling my schedule and looking for the next thing that will make me feel alive again.'],
  5: ['I become scattered and overextended. I start taking on too much, chasing new ideas, and lose the focused stillness that usually grounds me.', 'I become reactive and forceful. I lose my usual calm detachment and feel an intense need to push back and take control.', 'I become more anxious and catastrophizing. I lose my objective detachment and start spiraling into what could go wrong.'],
  6: ['I become hyper-focused on getting after my own goals. I get driven and image-conscious and start pushing hard to make things happen and be seen as capable.', 'I become forceful and combative. I stop hesitating and start pushing hard — I need to feel powerful and in control.', 'I check out and go numb. I stop engaging with the anxiety and just try to get through it by not feeling anything.'],
  7: ['I become critical and perfectionistic. I lose my lightness and get fixated on what’s wrong, what’s not good enough, and what needs to be corrected.', 'I become emotionally flooded and self-absorbed. I get lost in longing for what’s missing and find it hard to focus on anything else.', 'I withdraw and go quiet. I stop engaging and start retreating into my own world, needing a lot of alone time to recover.'],
  8: ['I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy.', 'I become more giving and focused on others. I move toward people and shift into support mode, wanting to feel needed.', 'I become more driven and performance-focused. I push myself harder to stay productive and appear capable under pressure.'],
  9: ['I become anxious and hypervigilant. The usual peace disappears and I start worrying about what could go wrong and whether I’m prepared.', 'I become emotionally flooded and withdrawn. I get absorbed in my feelings and pull away from people and obligations.', 'I become driven and task-focused. I throw myself into productivity to avoid feeling what’s happening under the surface.'],
};

const STAGE4_SECURITY = {
  1: ['I become lighter, more playful, and spontaneous. I stop being so hard on myself and find it easier to enjoy things without worrying about doing them perfectly.', 'I become warmer and more focused on others. I want to give more and feel more connected to the people I care about.', 'I become more reflective and emotionally open. I drop the doing and let myself just feel and be for a while.'],
  2: ['I turn inward and become introspective. I stop trying to take care of others and allow myself to focus on how I’m feeling and what I need.', 'I become easier to be around and less agenda-driven. I stop pushing so hard to be needed and let myself just relax and enjoy things.', 'I become more playful and spontaneous. I stop focusing on what others need and let myself just explore and enjoy things freely.'],
  3: ['I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don’t need to go it alone and actually want us to win together.', 'I slow down and become more easygoing. I stop needing to achieve and just let myself be present without an agenda.', 'I become more spontaneous and curious. I stop focusing on goals and let myself just explore and enjoy what’s in front of me.'],
  4: ['I become more grounded, disciplined, and action-oriented. I stop dwelling on what’s missing and start doing, with a clearer sense of what’s right and what needs to happen.', 'I become lighter and more optimistic. I stop focusing on what’s wrong and let myself enjoy what’s actually good in my life.', 'I become more outward-focused and giving. I stop dwelling on myself and feel genuinely energized by helping and connecting with others.'],
  5: ['I become more present, decisive, and action-oriented. I step into the world with confidence and feel energized by direct engagement rather than observation.', 'I become more easygoing and comfortable in my own skin. I stop overthinking and let myself just be present without needing to analyze everything.', 'I become more connected and warm. I drop the detachment and feel genuinely open to the people around me.'],
  6: ['I become genuinely peaceful and easy. I find myself just present, comfortable, and okay with how things are without needing to figure anything out.', 'I become warmer and more giving. I feel safe enough to focus on others and genuinely enjoy taking care of the people I care about.', 'I become more emotionally open and introspective. I feel safe enough to explore my inner world without it feeling threatening.'],
  7: ['I become quieter, more focused, and genuinely still. I stop needing to share and stimulate and find deep satisfaction in solitude and going deep on one thing.', 'I become more easygoing and present. I stop planning ahead and let myself just be where I am without needing something else to be happening.', 'I become more focused and goal-oriented. I channel my energy into building something and feel grounded by the progress I’m making.'],
  8: ['I become magnanimous and open to connection. I put the armor down and allow myself to show my care and support for others.', 'I become more relaxed and easygoing. I stop pushing so hard and let things unfold without needing to be in control.', 'I become more loyal and collaborative. I feel a strong pull toward the people I trust and want to make sure everyone is okay.'],
  9: ['I become more focused, energized, and directed. I connect with what I actually want and feel a pull to make things happen rather than just going along.', 'I become lighter and more playful. I stop worrying about keeping the peace and let myself just enjoy what’s in front of me.', 'I become warmer and more attuned. I feel a pull toward the people around me and genuinely enjoy caring for them.'],
};

const STAGE4_HABIT = {
  1: ['To what’s wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else.', 'To what could go wrong or what I might not be prepared for. I’m scanning for potential problems and threats before they materialize.', 'To what needs to be done and how to do it efficiently. I’m already thinking about tasks, goals, and getting things moving.'],
  2: ['To how other people are feeling and what they might need. I’m reading the room emotionally and sensing who needs something before they ask.', 'To the overall atmosphere and whether everyone feels comfortable. I’m aware of the group energy and pulled toward making sure things feel settled.', 'To whether things are going to be okay and who I can rely on. I’m scanning for reliability and trying to anticipate what might go sideways.'],
  3: ['To what needs to happen and who’s going to make it happen. I’m assessing quickly and feel a pull to take charge and get things moving.', 'To what could be done better. I notice quickly when something isn’t quite right and feel a pull to fix it.', 'To what’s possible and what else could be interesting. My mind moves toward options, opportunities, and what could make this better.'],
  4: ['To what’s absent or incomplete. There’s a persistent sense that something essential is missing, and my attention keeps returning to that gap even when things are going reasonably well.', 'To how other people are feeling. I’m attuned to the emotional undercurrent and feel a pull to respond to what I sense in others.', 'To the overall feel of things. I’m drawn to what’s harmonious and what might disrupt the atmosphere.'],
  5: ['To understanding the situation fully before engaging. I want to gather enough information to feel confident about what’s happening before I say or do anything.', 'To what could go wrong and whether I’m prepared. I find myself anticipating problems and wanting to have a plan before I’m in over my head.', 'To what’s not quite right. I notice inconsistencies and gaps quickly and feel a pull to correct or clarify.'],
  6: ['To what could go wrong or what I might not be prepared for. I’m scanning for potential problems and threats before they materialize.', 'To understanding the situation fully before engaging. I want enough information to feel confident before I commit to anything.', 'To the overall atmosphere and whether things feel stable. I’m drawn to keeping things easy and avoiding unnecessary disruption.'],
  7: ['To what’s next, what’s possible, and what else is available. My mind is already moving toward new ideas, options, and what could be exciting about what’s ahead.', 'To what needs to happen and how to make it happen quickly. I’m already thinking about goals, tasks, and getting things moving.', 'To the people in the room and what might make this more enjoyable for everyone. I want to create energy and connection.'],
  8: ['To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated.', 'To what needs to happen and who’s going to make it happen. I’m assessing quickly and feel a pull to take charge if no one else is.', 'To potential threats and whether I can trust what’s happening. I’m scanning for danger and assessing who’s reliable.'],
  9: ['To the overall atmosphere and whether everyone feels included and comfortable. I’m aware of the whole room and pulled toward making sure things feel settled and okay for everyone.', 'To who might need something. I notice quickly if someone seems left out or uncomfortable and feel a pull to help.', 'To what might make this more enjoyable or interesting. I’m looking for the positive angle and what could make the situation feel lighter.'],
};

const STAGE4_CT_COMPARATIVE = {
  'SO-7': { stress: { personA: 'I become critical, rigid, and perfectionistic. I lose my usual lightness and start fixating on what’s wrong, what needs correcting, and whether things are being done properly.', personB: 'I get angry, forceful, and confrontational. My usual warm and giving self disappears and I become demanding, blunt, or even aggressive about what I need.' }, security: { personA: 'I become quieter, more focused, and genuinely still. I stop needing to share and stimulate and find deep satisfaction in solitude and going deep on one thing.', personB: 'I turn inward and become introspective. I stop trying to take care of others and allow myself to focus on how I’m feeling and what I need.' }, habit: { personA: 'To what’s possible and what I can share. My attention goes toward experiences, ideas, and people I can bring into what I love, so that others feel the aliveness I feel.', personB: 'To how other people are feeling and what they might need. I’m reading the room emotionally and sensing who needs something before they ask.' } },
  'SX-6': { stress: { personA: 'I become hyper-focused on getting after my own goals. I put energy into efficiency, achievement, and being seen as successful.', personB: 'I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy.' }, security: { personA: 'I become genuinely peaceful and easy. I find myself just present, comfortable, and okay with how things are.', personB: 'I become magnanimous and open to connection. I put the armor down and allow myself to show my care and support for others.' }, habit: { personA: 'To what could go wrong or what I might not be prepared for. I’m constantly scanning for danger and coming up with contingency plans.', personB: 'To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated.' } },
  'SP-3': { stress: { personA: 'I shut down. The drive and ambition that usually feel effortless just vanish and I find myself checked out and disengaged.', personB: 'I become weighed down with emotion. I start dwelling on what others have naturally that I don’t and I long to be whole.' }, security: { personA: 'I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don’t need to go it alone and actually want us to win together.', personB: 'I become lighter, more playful, and spontaneous. I stop being so hard on myself and find it easier to enjoy things without worrying about doing them perfectly.' }, habit: { personA: 'To what needs to be done and whether I’m being effective. My attention goes to tasks, results, and whether I’m building something solid, without needing anyone to notice.', personB: 'To what’s wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else.' } },
  'SP-4': { stress: { personA: 'I become overly helpful and acutely aware of what others need. I set my own needs aside and seek the appreciation of others.', personB: 'I shut down. The drive and ambition that usually feel effortless just vanish and I find myself checked out and disengaged.' }, security: { personA: 'I become more grounded, disciplined, and action-oriented. I stop dwelling on what’s missing and start doing, with a clearer sense of what’s right and what needs to happen.', personB: 'I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don’t need to go it alone and actually want us to win together.' }, habit: { personA: 'To what’s absent or incomplete. There’s a persistent sense that something essential is missing, and my attention keeps returning to that gap even when things are going reasonably well.', personB: 'To how I’m coming across and whether I’m building something meaningful. I’m aware of whether I’m being effective and whether the people who matter can see what I’m capable of.' } },
  'SX-1': { stress: { personA: 'I become weighed down with emotion. I start dwelling on what others have naturally that I don’t and I long to be whole.', personB: 'I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy.' }, security: { personA: 'I become more loyal, collaborative, and questioning. I want to check in with people I trust and think things through more carefully, and I feel less need to prove myself.', personB: 'I become magnanimous and open to connection. I put the armor down and allow myself to show my care and support for others.' }, habit: { personA: 'To what’s wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else.', personB: 'To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated.' } },
};

const TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer',
  4: 'The Idealist', 5: 'The Observer', 6: 'The Questioner',
  7: 'The Enthusiast', 8: 'The Protector', 9: 'The Peacemaker',
};

// ─── Output path ─────────────────────────────────────────────────────────────

const REPORTS_DIR = process.env.REPORTS_DIR || path.join(ROOT, 'reports');

// ─── Lazy DB pool (CLI only — server passes queryFn explicitly) ───────────────

let _pool = null;
function getPool() {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return _pool;
}

// Default query function — uses module-level pool (CLI usage)
async function defaultQuery(sql, params) {
  return getPool().query(sql, params);
}

// Fetch a single client row for generation
async function fetchClientRow(clientId, queryFn) {
  const r = await queryFn(`
    SELECT
      cl.id                        AS client_id,
      cl.first_name,
      cl.last_name,
      cl.email,
      cl.created_at,
      cl.responses_snapshot,
      cl.beta_report_generated_at,
      co.name                      AS coach_name,
      a.scores_snapshot,
      a.api_result,
      a.created_at                 AS assessment_date
    FROM clients cl
    JOIN coaches co   ON co.id = cl.coach_id
    JOIN assessments a ON a.client_id = cl.id
    WHERE cl.status = 'complete'
      AND cl.id = $1
    ORDER BY a.created_at DESC
    LIMIT 1
  `, [clientId]);
  return r && r.rows.length > 0 ? r.rows[0] : null;
}

// Fetch all complete clients (CLI --all mode)
async function fetchAllClients(queryFn) {
  const r = await queryFn(`
    SELECT
      cl.id                        AS client_id,
      cl.first_name,
      cl.last_name,
      cl.email,
      cl.created_at,
      cl.responses_snapshot,
      cl.beta_report_generated_at,
      co.name                      AS coach_name,
      a.scores_snapshot,
      a.api_result,
      a.created_at                 AS assessment_date
    FROM clients cl
    JOIN coaches co   ON co.id = cl.coach_id
    JOIN assessments a ON a.client_id = cl.id
    WHERE cl.status = 'complete'
    ORDER BY a.created_at DESC
  `, []);
  return r ? r.rows : [];
}

// Build safe filename segment from a name string
function safeName(str) {
  return (str || 'unknown').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ─── Stage 3 / Stage 4 answer decoding ────────────────────────────────────────

// 'a' | 'both_a' | 'both_b' | 'b'  (from responses_snapshot)
function decodeStage3Answer(raw) {
  switch (raw) {
    case 'a':      return { label: 'Person A',          leanA: true,  leanB: false, both: false };
    case 'both_a': return { label: 'Both — leaning A', leanA: true,  leanB: false, both: true  };
    case 'both_b': return { label: 'Both — leaning B', leanA: false, leanB: true,  both: true  };
    case 'b':      return { label: 'Person B',          leanA: false, leanB: true,  both: false };
    default:       return { label: raw || 'N/A',        leanA: false, leanB: false, both: false };
  }
}

// Stage-4 pairwise (A | A-slight | B-slight | B)
function decodeStage4Pairwise(raw) {
  switch (raw) {
    case 'A':        return { leanA: true,  leanB: false, both: false, label: 'Person A' };
    case 'A-slight': return { leanA: true,  leanB: false, both: true,  label: 'Both — leaning A' };
    case 'B-slight': return { leanA: false, leanB: true,  both: true,  label: 'Both — leaning B' };
    case 'B':        return { leanA: false, leanB: true,  both: false, label: 'Person B' };
    default:         return { leanA: false, leanB: false, both: false, label: raw || 'N/A' };
  }
}

function isStage4Pairwise(raw) {
  return ['A', 'A-slight', 'B-slight', 'B'].includes(raw);
}

// ─── Build the pre-resolved data object that buildBetaHTML consumes ─────────

function buildBetaData(row) {
  const scores = typeof row.scores_snapshot === 'string'
    ? JSON.parse(row.scores_snapshot)
    : (row.scores_snapshot || {});
  const responses = typeof row.responses_snapshot === 'string'
    ? JSON.parse(row.responses_snapshot)
    : (row.responses_snapshot || {});
  const apiResult = typeof row.api_result === 'string'
    ? JSON.parse(row.api_result)
    : (row.api_result || {});
  const hyp = apiResult.hypothesis || {};
  const apiFlags = apiResult.flags || [];

  const s1 = scores;                  // Stage-1 fields live at the top level
  const s2 = scores.stage2 || {};     // present in newer (post-fix) snapshots
  const s3 = scores.stage3 || {};
  // Stage 4: scores.stage4 (newer) or synthesize from hyp (older records).
  const s4 = scores.stage4 || {
    path:              hyp.stage4_path     || null,
    option:            hyp.stage4_option   || null,
    leadType:          hyp.confirmed_type  || null,
    secondType:        hyp.second_candidate_type || null,
    outcome:           hyp.stage4_outcome  || null,
    stressConfirmed:   hyp.stage4_stress_confirmed   ?? null,
    securityConfirmed: hyp.stage4_security_confirmed ?? null,
    habitConfirmed:    hyp.stage4_habit_confirmed     ?? null,
  };

  const r0 = responses.stage0 || {};
  const r1 = responses.stage1 || {};
  const r2 = responses.stage2 || {};
  const r3 = responses.stage3 || {};
  const r4 = responses.stage4 || {};
  const finalQ = responses.finalQuestion;

  const confirmedType    = hyp.confirmed_type || s4.leadType || scores.leadingType;
  const confirmedInstinct = hyp.dominant_instinct_hypothesis || scores.dominantInstinct || '?';
  const typeName         = TYPE_NAMES[confirmedType] || '';

  const assessDate = row.assessment_date
    ? new Date(row.assessment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';

  const typeLabel = confirmedType
    ? `${confirmedInstinct} ${confirmedType} — ${typeName}`
    : 'Not confirmed';

  // Flags: prefer scores.flags when present, otherwise api_result.flags
  const rawFlags = (scores.flags && scores.flags.length > 0) ? scores.flags : apiFlags;
  const flags = (rawFlags || []).map(f => {
    if (typeof f === 'string') return { label: f, description: '' };
    return {
      label: f.flag_type || f.label || JSON.stringify(f),
      description: f.description || f.explanation || '',
    };
  });

  // ── Stage 0
  const stage0 = STAGE0_QUESTIONS.map(q => ({
    title: q.title,
    text: q.text,
    response: r0[q.id] || '',
  }));

  // ── Stage 1 summary + questions (v2: typeProfile/instinctProfile + Call #1 ranking;
  //    center scoring was removed in v2, so the Head/Heart/Body center rows are dropped).
  const instProf = scores.instinctProfile || {};
  const ranked   = [...(hyp.call1_ranking || [])].sort((a, b) => b.score - a.score).map(r => r.type);
  const counterFlag = flags.some(f => f.label === 'counter_type');

  const stage1Summary = [
    { label: 'SP / SO / SX',          value: `${instProf.SP ?? '?'} / ${instProf.SO ?? '?'} / ${instProf.SX ?? '?'}` },
    { label: 'Dominant Instinct',     value: confirmedInstinct },
    { label: 'Leading / Alternate',   value: `Type ${scores.leadingType ?? '?'} / Type ${scores.alternateType ?? '?'}` },
    { label: 'Coherence Ranking',     value: ranked.length ? ranked.map(t => `Type ${t}`).join(' › ') : '—' },
    { label: 'Counter-Type Flag',     value: counterFlag ? 'YES' : 'NO' },
  ];
  if (counterFlag) {
    const ctf = flags.find(f => f.label === 'counter_type');
    stage1Summary.push({ label: 'Counter-Type Note', value: (ctf && ctf.description) || hyp.counter_type_combination || '' });
  }

  const stage1Questions = STAGE1_QUESTIONS.map((q, idx) => {
    const rankingRaw = r1[q.id] || {};
    const ranking = {
      a: typeof rankingRaw.a === 'number' ? rankingRaw.a : parseInt(rankingRaw.a) || 0,
      b: typeof rankingRaw.b === 'number' ? rankingRaw.b : parseInt(rankingRaw.b) || 0,
      c: typeof rankingRaw.c === 'number' ? rankingRaw.c : parseInt(rankingRaw.c) || 0,
    };
    const opts = ['a', 'b', 'c'].map(letter => ({
      letter,
      rank: ranking[letter],
      text: q.options[letter],
      dim: q.mapping[letter].toUpperCase(),
    })).sort((x, y) => (x.rank || 99) - (y.rank || 99));

    return {
      idx: idx + 1,
      title: q.title,
      dimLabel: q.type === 'centers' ? 'Centers (Body / Heart / Head)' : 'Instincts (SP / SO / SX)',
      text: q.text,
      rows: opts.map(o => ({
        rankLabel: o.rank ? ['1st', '2nd', '3rd'][o.rank - 1] || String(o.rank) : '—',
        dim: o.dim,
        text: o.text,
        isTop: o.rank === 1,
      })),
    };
  });

  // ── Stage 2 summary + questions
  // v2: the framework cross-reference now lives in api_result.stage2_analysis.
  const s2a = apiResult.stage2_analysis || {};
  const stage2Summary = [
    { label: 'Hornevian (Social Style)', value: s2a.hornevian_result || '—' },
    { label: 'Harmonic (Coping Style)',  value: s2a.harmonic_result || '—' },
    { label: 'Object Relations',         value: s2a.object_relations_result || '—' },
    { label: 'Framework Alignment',      value: s2a.framework_alignment || '—' },
  ];

  const s2QuestionKeys = ['q1', 'q2', 'q3'];
  const stage2Questions = STAGE2_QUESTIONS.map((q, idx) => {
    const selected = r2[s2QuestionKeys[idx]] || null;
    return {
      idx: idx + 1,
      title: q.title,
      framework: q.framework,
      text: q.text,
      options: ['A', 'B', 'C'].map(letter => ({
        letter,
        text: q.options[letter],
        selected: letter === selected,
      })),
    };
  });

  // ── Stage 3 summary + Q1/Q2 blocks
  // Mode comes from assessment.js as 'COUNTER-TYPE'/'STANDARD' but Claude
  // returns 'COUNTER_TYPE'/'STANDARD' — normalize so comparisons match either.
  // v2: Stage-3 lean lives in scores.stage3 { mode, pair, ctPair, ctId, typeA, typeB, q1Answer, q1Lean }.
  const s3Mode       = s3.mode ? String(s3.mode).replace(/_/g, '-') : null;
  const s3Pair       = s3.pair;
  const s3Q1Result   = s3.q1Lean;
  const s3Leading    = s3.typeA;

  const stage3Summary = [
    { label: 'Mode',         value: s3Mode || '—' },
    { label: 'Pair Tested',  value: s3Pair || '—' },
    { label: 'Result',       value: s3Q1Result || '—' },
    { label: 'Leading Type', value: s3Leading ? `Type ${s3Leading}` : '—' },
    { label: 'CT Answer',    value: s3.q1Answer || 'N/A' },
  ];

  // Q1 — present whenever a Stage-3 answer was recorded
  let stage3Q1 = null;
  if (r3.q1) {
    const decoded = decodeStage3Answer(r3.q1);
    if (s3Mode === 'COUNTER-TYPE') {
      const ctKey = s3.ctPair;
      const ctPair = STAGE3_CT_PAIRS[ctKey] || {};
      stage3Q1 = {
        stem: STAGE3_Q1_STEM,
        pairs: [
          { label: 'Person A', text: ctPair.personA || '[CT pair not found]', selected: decoded.leanA && !decoded.both },
          { label: 'Person B', text: ctPair.personB || '[CT pair not found]', selected: decoded.leanB && !decoded.both },
        ],
        selectedLabel: decoded.label,
      };
    } else {
      const typeA = s3.typeA;
      const typeB = s3.typeB;
      stage3Q1 = {
        stem: STAGE3_Q1_STEM,
        pairs: [
          { label: `Person A (Type ${typeA || '?'})`, text: typeA ? (STAGE3_CORE_MOTIVATIONS[typeA] || '') : '', selected: decoded.leanA && !decoded.both },
          { label: `Person B (Type ${typeB || '?'})`, text: typeB ? (STAGE3_CORE_MOTIVATIONS[typeB] || '') : '', selected: decoded.leanB && !decoded.both },
        ],
        selectedLabel: decoded.label,
      };
    }
  }

  // Q2 — only fires for high-ambiguity standard pairs
  let stage3Q2 = null;
  if (r3.q2) {
    const decoded = decodeStage3Answer(r3.q2);
    const avoidance = STAGE3_AVOIDANCE_QUESTIONS[`${s3.typeA}-${s3.typeB}`] || {};
    stage3Q2 = {
      stem: STAGE3_Q2_STEM,
      pairs: [
        { label: 'Person A', text: avoidance.personA || '[avoidance text not found]', selected: decoded.leanA && !decoded.both },
        { label: 'Person B', text: avoidance.personB || '[avoidance text not found]', selected: decoded.leanB && !decoded.both },
      ],
      selectedLabel: decoded.label,
    };
  }

  // ── Stage 4 summary + stress/security/habit blocks
  const confirmedStr = (v) => v != null ? (v ? 'Yes' : 'No') : 'N/A';
  const stage4Summary = [
    { label: 'Path Taken',        value: s4.path    || '—' },
    { label: 'Option',            value: s4.option  || '—' },
    { label: 'Lead Type',         value: s4.leadType ? `Type ${s4.leadType}` : '—' },
    { label: 'Stage 4 Outcome',   value: s4.outcome || '—' },
    { label: 'Stress Confirmed',  value: confirmedStr(s4.stressConfirmed) },
    { label: 'Security Confirmed', value: confirmedStr(s4.securityConfirmed) },
    { label: 'Habit Confirmed',   value: s4.habitConfirmed != null ? confirmedStr(s4.habitConfirmed) : 'N/A (did not fire)' },
  ];

  const leadType = s4.leadType || confirmedType;
  const ctKey = s1.counterTypeKey;
  const ctComparative = STAGE4_CT_COMPARATIVE[ctKey];

  // Build a Stage-4 instrument block (stress / security / habit). Returns null
  // when the user didn't answer the slot.
  const buildStage4Block = (rawAnswer, threeOptOptions, ctSlot, confirmed) => {
    if (rawAnswer == null) return null;
    if (isStage4Pairwise(rawAnswer) && ctComparative && ctSlot) {
      const decoded = decodeStage4Pairwise(rawAnswer);
      return {
        mode: 'pairwise',
        options: [
          { label: 'Person A', text: ctSlot.personA, selected: decoded.leanA && !decoded.both },
          { label: 'Person B', text: ctSlot.personB, selected: decoded.leanB && !decoded.both },
        ],
        selectedLabel: decoded.label,
        confirmedLabel: confirmedStr(confirmed),
      };
    }
    if (leadType && threeOptOptions) {
      const keyOrder = ['correct', 'alt1', 'alt2'];
      return {
        mode: '3opt',
        options: keyOrder.map((key, i) => ({
          label: key.toUpperCase(),
          text: threeOptOptions[i],
          selected: key === rawAnswer,
        })),
        selectedLabel: rawAnswer === 'correct' ? `Correct (Type ${leadType})` : `Alternative (${rawAnswer})`,
        confirmedLabel: confirmedStr(confirmed),
      };
    }
    // Unrecognized answer shape — render as a single-line note
    return {
      mode: '3opt',
      options: [{ label: 'ANSWER', text: String(rawAnswer), selected: true }],
      selectedLabel: String(rawAnswer),
      confirmedLabel: confirmedStr(confirmed),
    };
  };

  const stage4 = {
    summary: stage4Summary,
    stressStem: STAGE4_STRESS_STEM,
    securityStem: STAGE4_SECURITY_STEM,
    habitStem: STAGE4_HABIT_STEM,
    stress:   buildStage4Block(r4.stress,   leadType ? STAGE4_STRESS[leadType]   : null, ctComparative && ctComparative.stress,   s4.stressConfirmed),
    security: buildStage4Block(r4.security, leadType ? STAGE4_SECURITY[leadType] : null, ctComparative && ctComparative.security, s4.securityConfirmed),
    habit:    buildStage4Block(r4.habit,    leadType ? STAGE4_HABIT[leadType]    : null, ctComparative && ctComparative.habit,    s4.habitConfirmed),
  };

  return {
    clientName: `${row.first_name} ${row.last_name}`,
    email: row.email,
    coachName: row.coach_name,
    assessmentDate: assessDate,
    typeLabel,
    confidenceLevel: hyp.confidence_level || s1.instinctConfidence || '—',
    stage4Outcome: s4.outcome || 'N/A',
    stage4Path:    s4.path    || 'N/A',
    flags,
    stage0,
    stage1: { summary: stage1Summary, questions: stage1Questions },
    stage2: { summary: stage2Summary, questions: stage2Questions },
    stage3: { summary: stage3Summary, q1: stage3Q1, q2: stage3Q2 },
    stage4,
    finalOpenResponse: finalQ || null,
  };
}

// ─── Puppeteer launch + PDF write ─────────────────────────────────────────────
//
// DEAD CODE (PR-F): the beta diagnostic PDF report was retired when /admin/beta-review
// replaced it. launchBrowser, htmlToPdf, generateBetaReport, and runCli below are no
// longer called by any route or CLI shim. They are intentionally left in place this PR
// to avoid collateral churn; buildBetaData and BETA_QUESTION_TEXT (above/below) remain
// actively used by the /admin/beta-review tester modal and synthesis. Flagged for a
// future cleanup pass that strips the PDF machinery.

async function launchBrowser() {
  if (process.env.NODE_ENV === 'production') {
    const puppeteerFull = require(path.join(APP_MODULES, 'puppeteer'));
    return await puppeteerFull.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  const puppeteerCore = require(path.join(APP_MODULES, 'puppeteer-core'));
  return await puppeteerCore.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function htmlToPdf(html, outPath, pdfOptions) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    await page.pdf({ path: outPath, ...pdfOptions });
  } finally {
    await browser.close();
  }
}

// ─── Core exported function ───────────────────────────────────────────────────

/**
 * Generate a beta .pdf report for a single client.
 *
 * opts.queryFn     — async (sql, params) => pg result  [defaults to module pool]
 * opts.reportsDir  — output directory                  [defaults to REPORTS_DIR]
 * opts.force       — bypass the already-generated skip check
 *
 * Returns { filename, outPath, generated_at } on success, or throws.
 */
async function generateBetaReport(clientId, opts = {}) {
  const queryFn  = opts.queryFn    || defaultQuery;
  const outDir   = opts.reportsDir || REPORTS_DIR;
  const force    = opts.force      || false;

  fs.mkdirSync(outDir, { recursive: true });

  const row = await fetchClientRow(clientId, queryFn);
  if (!row) throw new Error(`No completed client found for id=${clientId}`);

  if (!force && row.beta_report_generated_at) {
    return { skipped: true, reason: 'already generated', filename: null, generated_at: row.beta_report_generated_at };
  }

  if (!row.scores_snapshot || !row.responses_snapshot) {
    throw new Error(`Missing snapshots for client #${clientId} — cannot generate report`);
  }

  const date    = row.assessment_date ? new Date(row.assessment_date) : new Date();
  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  const filename = `beta_${safeName(row.last_name)}_${safeName(row.first_name)}_${dateStr}.pdf`;
  const outPath  = path.join(outDir, filename);

  const data    = buildBetaData(row);
  const html    = buildBetaHTML(data);
  const pdfOpts = buildPdfOptions({ firstName: row.first_name, lastName: row.last_name });
  await htmlToPdf(html, outPath, pdfOpts);

  // Stamp the timestamp and filename on the client row so the admin UI can
  // surface a Download link without rescanning the reports dir.
  await queryFn(
    'UPDATE clients SET beta_report_generated_at = NOW(), beta_report_filename = $2 WHERE id = $1',
    [clientId, filename]
  );

  const stat = fs.statSync(outPath);
  const generated_at = new Date().toISOString();
  console.log(`[beta-report] Generated: ${filename} (client #${clientId}, ${(stat.size / 1024).toFixed(1)} KB)`);
  return { filename, outPath, generated_at };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────
// Single source of truth — beta/generate_report.js is a thin shim that calls runCli().
async function runCli() {
  await (async () => {
    const args = process.argv.slice(2);
    const forceFlag = args.includes('--force');
    const mainArg   = args.find(a => !a.startsWith('--'));

    if (!mainArg) {
      console.error('Usage: node beta/generate_report.js <client_id> [--force]');
      console.error('       node beta/generate_report.js --all [--force]');
      process.exit(1);
    }

    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL not set — cannot connect to database');
      process.exit(1);
    }

    const outDir = REPORTS_DIR;
    fs.mkdirSync(outDir, { recursive: true });

    if (mainArg === '--all') {
      let rows;
      try { rows = await fetchAllClients(defaultQuery); }
      catch (e) { console.error('DB query failed:', e.message); process.exit(1); }

      if (rows.length === 0) { console.log('No completed clients found.'); }

      for (const row of rows) {
        if (!forceFlag && row.beta_report_generated_at) {
          console.log(`Skipping client #${row.client_id} (${row.first_name} ${row.last_name}) — already generated`);
          continue;
        }
        try {
          const result = await generateBetaReport(row.client_id, { reportsDir: outDir, force: forceFlag });
          if (result.skipped) console.log(`Skipped: client #${row.client_id} — ${result.reason}`);
          else console.log(`  → ${result.outPath}`);
        } catch (e) {
          console.error(`  ERROR client #${row.client_id} (${row.first_name} ${row.last_name}):`, e.message);
        }
      }
    } else {
      const id = parseInt(mainArg, 10);
      if (isNaN(id)) { console.error(`Invalid client_id: ${mainArg}`); process.exit(1); }
      try {
        const result = await generateBetaReport(id, { reportsDir: outDir, force: forceFlag });
        if (result.skipped) console.log(`Skipped: already generated at ${result.generated_at}`);
        else console.log(`  → ${result.outPath}`);
      } catch (e) {
        console.error('ERROR:', e.message);
        process.exit(1);
      }
    }

    if (_pool) await _pool.end();
  })().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
}

// ─── Beta flag-key → question text lookup (PR-E) ──────────────────────────────
// Resolves any flaggable key to its full question/statement text for the Block A
// display on /admin/beta-review. Covers Stage 0 (q1-q4), the 60 Stage 1 statements
// (S{type}-N, I1-{inst}-N), Stage 2 (xref-qN), and the Stage 3/4 synthetic stem keys.
//
// WORDING DIVERGENCE (flagged for a future reconciliation pass): the Stage 1
// statement text and the Stage 3/4 stems below are mirrored from app/public/
// assessment.js, but the two files have drifted — notably the Stage 3 stems
// (assessment.js: "When you're at your best, how would you describe your internal
// experience?" vs this file's STAGE3_Q1_STEM). The flag KEY + stage label always
// identify the question unambiguously; only the displayed wording may differ slightly
// from what the tester saw. Reconcile by extracting these constants into a single
// shared data module consumed by both the SPA and the server.
const BETA_STAGE1_STATEMENT_TEXT = {
  'S3-1': 'I prioritize achieving my goals and being recognized for what I accomplish.',
  'S3-2a': 'My attention naturally goes to what needs to be accomplished and how I’m coming across.',
  'S3-2b': 'I find myself adjusting how I present myself and tracking how I’m landing.',
  'S3-3': 'I put a lot of energy into staying productive, performing well, and projecting a capable, successful image.',
  'S3-4': 'I tend to avoid failing, slowing down, or being seen as unsuccessful or incapable.',
  'S6-1': 'I prioritize feeling safe, secure, and prepared for whatever might happen.',
  'S6-2a': 'My attention naturally goes to what could go wrong, potential danger, and whether people and situations can really be trusted.',
  'S6-2b': 'I find myself running through worst-case scenarios and figuring out how to be prepared for what might happen.',
  'S6-3': 'I put a lot of energy into questioning, seeking reassurance, and making sure I’m ready for what could go wrong.',
  'S6-4': 'I tend to avoid uncertainty, blindly trusting others, and being caught unprepared.',
  'S9-1': 'I prioritize keeping the peace and maintaining harmony, inside myself and with others.',
  'S9-2a': 'My attention naturally goes outward to other people’s agendas, potential sources of conflict, and to what’s right in front of me.',
  'S9-2b': 'I find myself going along with what others want, keeping things comfortable, and losing track of what matters most to me.',
  'S9-3': 'I put a lot of energy into accommodating others, staying comfortable, and keeping the peace.',
  'S9-4': 'I tend to avoid conflict, asserting my own position, and anything that disturbs my sense of peace.',
  'S1-1': 'I prioritize doing things right and being a good, responsible person.',
  'S1-2a': 'My attention naturally goes to what’s wrong, imprecise, or not meeting the standard in situations, in others, and in myself.',
  'S1-2b': 'I find myself monitoring, correcting, and comparing, driven by a relentless internal critic.',
  'S1-3': 'I put a lot of energy into improving things, maintaining standards, and keeping myself and my work above reproach.',
  'S1-4': 'I tend to avoid making mistakes, being wrong, and letting my own anger or impulses show.',
  'S4-1': 'I prioritize being authentic and true to myself, and feeling a deep connection to what’s real and meaningful.',
  'S4-2a': 'My attention naturally goes to what is missing or unavailable to me, and my internal emotional landscape.',
  'S4-2b': 'I find myself drawn toward what would make me feel unique or special and away from the ordinary or mundane.',
  'S4-3': 'I put a lot of energy into processing my emotions, seeking depth, and being seen as unique and authentic.',
  'S4-4': 'I tend to avoid being ordinary, feeling cut off from my feelings, and settling for the superficial.',
  'S2-1': 'I prioritize being needed and appreciated for how I care for and support others.',
  'S2-2a': 'My attention naturally goes to other people’s feelings and needs, picking up on what they need usually before they even know.',
  'S2-2b': 'I find myself setting aside what I need in order to focus on others, telling myself my needs can wait.',
  'S2-3': 'I put a lot of energy into helping, supporting, and tending to relationships and others’ needs.',
  'S2-4': 'I tend to avoid acknowledging my own needs, asking for help, and feeling that I’m not needed or appreciated.',
  'S8-1': 'I prioritize being strong and in control so I can protect myself and the people I care about.',
  'S8-2a': 'My attention naturally goes to power dynamics, fairness, and any move to control, take advantage, or show weakness.',
  'S8-2b': 'I find myself moving toward action, confronting what’s wrong head-on, and protecting against any sign of vulnerability.',
  'S8-3': 'My energy goes to taking action, asserting my will, and taking a stand against what’s unjust or unfair.',
  'S8-4': 'I tend to avoid feeling vulnerable, being controlled, and being dependent on others.',
  'S5-1': 'I prioritize understanding the world and having enough knowledge and resources to be self-sufficient.',
  'S5-2a': 'My attention naturally goes to demands on my time and energy, and to potential intrusions on my privacy.',
  'S5-2b': 'I find myself building my knowledge, maintaining my boundaries, and conserving my energy and resources.',
  'S5-3': 'I put a lot of energy into gathering knowledge, figuring things out, and protecting my privacy and resources.',
  'S5-4': 'I tend to avoid emotional demands, intrusion on my space, and being caught without enough understanding or resources.',
  'S7-1': 'I prioritize living a life free from pain and constraints.',
  'S7-2a': 'My attention naturally goes to anything that could potentially limit my options or cause me pain and suffering.',
  'S7-2b': 'I find myself imagining enjoyable possibilities, generating new options, and reframing negatives into positives.',
  'S7-3': 'I put a lot of energy into staying up and positive, planning for pleasurable possibilities, and keeping my options open.',
  'S7-4': 'I tend to avoid people and situations that limit my options or require me to sit with pain or difficulty.',
  'I1-SP-1': 'I pay close attention to my physical comfort — things like temperature, hunger, rest, and whether my body feels okay.',
  'I1-SP-2': 'I keep track of whether I have enough resources (money, supplies, energy, time, etc.) to ensure comfort and survival.',
  'I1-SP-3': 'I keep the people and things I depend on safe.',
  'I1-SP-4': 'I prefer to handle things myself rather than counting on others.',
  'I1-SP-5': 'I recharge by being on my own, in my own space, with no demands on me.',
  'I1-SO-1': 'I pay attention to where I stand in a group and how I’m coming across to the people in it.',
  'I1-SO-2': 'I pay attention to who in a group is reliable and can be counted on, and who can’t.',
  'I1-SO-3': 'I notice the social landscape — who’s connected to whom, who’s in, and who’s out.',
  'I1-SO-4': 'I am pulled toward something larger than myself: a cause, a community, or a group I want to be part of.',
  'I1-SO-5': 'I get my energy by being part of a community.',
  'I1-SX-1': 'My attention gets pulled strongly toward specific people or things, sometimes to the point of crowding out everything else.',
  'I1-SX-2': 'I find intense one-on-one conversations energizing.',
  'I1-SX-3': 'When I’m captivated by someone or something, the pull can override my better judgment about what I should be doing.',
  'I1-SX-4': 'When I want something, I go after it directly and don’t hold back.',
  'I1-SX-5': 'I want to have a real impact on the people and things that matter to me, even if I don’t make it obvious.',
};

const BETA_QUESTION_TEXT = (() => {
  const map = {};
  STAGE0_QUESTIONS.forEach((q) => { map[q.id] = q.text; });
  Object.assign(map, BETA_STAGE1_STATEMENT_TEXT);
  STAGE2_QUESTIONS.forEach((q) => { map[q.id] = q.text; });
  map['S3-Q1'] = STAGE3_Q1_STEM;
  map['S3-Q2'] = STAGE3_Q2_STEM;
  map['S4-stress'] = STAGE4_STRESS_STEM;
  map['S4-security'] = STAGE4_SECURITY_STEM;
  map['S4-habit'] = STAGE4_HABIT_STEM;
  return map;
})();

module.exports = { generateBetaReport, runCli, buildBetaData, BETA_QUESTION_TEXT };

if (require.main === module) runCli();
