'use strict';

// Resolve app dependencies from the app's own node_modules
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const APP_MODULES = path.join(ROOT, 'app/node_modules');

require(path.join(APP_MODULES, 'dotenv')).config({ path: path.join(ROOT, '.env') });

const fs   = require('fs');
const { Pool } = require(path.join(APP_MODULES, 'pg'));

const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, LevelFormat,
} = require(path.join(APP_MODULES, 'docx'));

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
  4: 'The Individualist', 5: 'The Observer', 6: 'The Questioner',
  7: 'The Enthusiast', 8: 'The Protector', 9: 'The Peacemaker',
};

// ─── DB Setup ────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fetchClients(clientId) {
  const where = clientId ? 'AND cl.id = $1' : '';
  const params = clientId ? [clientId] : [];
  const sql = `
    SELECT
      cl.id            AS client_id,
      cl.first_name,
      cl.last_name,
      cl.email,
      cl.created_at,
      cl.responses_snapshot,
      co.name          AS coach_name,
      a.scores_snapshot,
      a.api_result,
      a.created_at     AS assessment_date
    FROM clients cl
    JOIN coaches co   ON co.id = cl.coach_id
    JOIN assessments a ON a.client_id = cl.id
    WHERE cl.status = 'complete'
      ${where}
    ORDER BY a.created_at DESC
  `;
  const r = await pool.query(sql, params);
  return r.rows;
}

// ─── docx helpers ────────────────────────────────────────────────────────────

const LIGHT_GRAY = 'E8E8E8';
const DXA_PAGE_WIDTH  = 12240;
const DXA_PAGE_HEIGHT = 15840;
const DXA_MARGIN      = 1440; // 1 inch
const DXA_CONTENT     = DXA_PAGE_WIDTH - 2 * DXA_MARGIN; // 9360

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, bold: true })] });
}

function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text })] });
}

function para(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, ...opts })] });
}

function boldPara(text) {
  return para(text, { bold: true });
}

function spacer() {
  return new Paragraph({ children: [] });
}

// Two-column label:value table row
function labelRow(label, value, shade = false) {
  const fill = shade ? LIGHT_GRAY : 'FFFFFF';
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2800, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
      }),
      new TableCell({
        width: { size: DXA_CONTENT - 2800, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill },
        children: [new Paragraph({ children: [new TextRun({ text: value || '' })] })],
      }),
    ],
  });
}

function simpleTable(rows) {
  return new Table({
    width: { size: DXA_CONTENT, type: WidthType.DXA },
    columnWidths: [2800, DXA_CONTENT - 2800],
    rows,
  });
}

// Pairwise option row — shows A / B labels + text, marks selected
function pairRow(label, text, selected, shade = false) {
  const fill = shade ? LIGHT_GRAY : 'FFFFFF';
  const displayText = selected ? `>> ${text}` : text;
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 1200, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
      }),
      new TableCell({
        width: { size: DXA_CONTENT - 1200, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill },
        children: [new Paragraph({ children: [new TextRun({ text: displayText, bold: selected })] })],
      }),
    ],
  });
}

function pairTable(rows) {
  return new Table({
    width: { size: DXA_CONTENT, type: WidthType.DXA },
    columnWidths: [1200, DXA_CONTENT - 1200],
    rows,
  });
}

// Stage 1 ranking table — 3 options with rank + dimension label
function stage1RankTable(q, ranking) {
  // Sort options by rank (1 first)
  const opts = ['a', 'b', 'c'].map(letter => ({
    letter,
    rank: ranking[letter],
    text: q.options[letter],
    dim: q.mapping[letter].toUpperCase(),
  })).sort((x, y) => x.rank - y.rank);

  const colWidths = [800, 1000, DXA_CONTENT - 1800];
  const rows = [
    new TableRow({
      children: [
        new TableCell({ width: { size: colWidths[0], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: LIGHT_GRAY }, children: [new Paragraph({ children: [new TextRun({ text: 'Rank', bold: true })] })] }),
        new TableCell({ width: { size: colWidths[1], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: LIGHT_GRAY }, children: [new Paragraph({ children: [new TextRun({ text: 'Dimension', bold: true })] })] }),
        new TableCell({ width: { size: colWidths[2], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: LIGHT_GRAY }, children: [new Paragraph({ children: [new TextRun({ text: 'Option Text', bold: true })] })] }),
      ],
    }),
    ...opts.map((o, i) => {
      const rankLabel = ['1st', '2nd', '3rd'][o.rank - 1] || `${o.rank}`;
      const shade = i % 2 === 1;
      const fill = shade ? LIGHT_GRAY : 'FFFFFF';
      return new TableRow({
        children: [
          new TableCell({ width: { size: colWidths[0], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill }, children: [new Paragraph({ children: [new TextRun({ text: rankLabel, bold: o.rank === 1 })] })] }),
          new TableCell({ width: { size: colWidths[1], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill }, children: [new Paragraph({ children: [new TextRun({ text: o.dim })] })] }),
          new TableCell({ width: { size: colWidths[2], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill }, children: [new Paragraph({ children: [new TextRun({ text: o.text, bold: o.rank === 1 })] })] }),
        ],
      });
    }),
  ];

  return new Table({
    width: { size: DXA_CONTENT, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}

// Stage 2 option rows — shows all options, marks selected
function stage2OptionsTable(q, selectedLetter) {
  const colWidths = [800, DXA_CONTENT - 800];
  const rows = ['A', 'B', 'C'].map((letter, i) => {
    const selected = letter === selectedLetter;
    const fill = i % 2 === 1 ? LIGHT_GRAY : 'FFFFFF';
    return new TableRow({
      children: [
        new TableCell({ width: { size: colWidths[0], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill }, children: [new Paragraph({ children: [new TextRun({ text: selected ? `>> ${letter}` : letter, bold: selected })] })] }),
        new TableCell({ width: { size: colWidths[1], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill }, children: [new Paragraph({ children: [new TextRun({ text: q.options[letter], bold: selected })] })] }),
      ],
    });
  });
  return new Table({
    width: { size: DXA_CONTENT, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}

// Stage 4 three-option table — 3 options, marks selected
function stage4ThreeOptTable(options, selectedKey) {
  const keyOrder = ['correct', 'alt1', 'alt2'];
  const colWidths = [1000, DXA_CONTENT - 1000];
  const rows = keyOrder.map((key, i) => {
    const selected = key === selectedKey;
    const fill = i % 2 === 1 ? LIGHT_GRAY : 'FFFFFF';
    const labelText = selected ? `>> ${key.toUpperCase()}` : key.toUpperCase();
    return new TableRow({
      children: [
        new TableCell({ width: { size: colWidths[0], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill }, children: [new Paragraph({ children: [new TextRun({ text: labelText, bold: selected })] })] }),
        new TableCell({ width: { size: colWidths[1], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill }, children: [new Paragraph({ children: [new TextRun({ text: options[i], bold: selected })] })] }),
      ],
    });
  });
  return new Table({
    width: { size: DXA_CONTENT, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}

// ─── Stage 3 answer decoding ─────────────────────────────────────────────────

// 'a' | 'both_a' | 'both_b' | 'b'
function decodeStage3Answer(raw) {
  switch (raw) {
    case 'a':      return { label: 'Person A',              leanA: true,  leanB: false, both: false };
    case 'both_a': return { label: 'Both — leaning A',     leanA: true,  leanB: false, both: true  };
    case 'both_b': return { label: 'Both — leaning B',     leanA: false, leanB: true,  both: true  };
    case 'b':      return { label: 'Person B',              leanA: false, leanB: true,  both: false };
    default:       return { label: raw || 'N/A',            leanA: false, leanB: false, both: false };
  }
}

// ─── Stage 4 answer decoding ─────────────────────────────────────────────────

// For pairwise answers: 'A' | 'A-slight' | 'B-slight' | 'B'
function decodeStage4Pairwise(raw) {
  switch (raw) {
    case 'A':       return { leanA: true,  leanB: false, both: false, label: 'Person A' };
    case 'A-slight':return { leanA: true,  leanB: false, both: true,  label: 'Both — leaning A' };
    case 'B-slight':return { leanA: false, leanB: true,  both: true,  label: 'Both — leaning B' };
    case 'B':       return { leanA: false, leanB: true,  both: false, label: 'Person B' };
    default:        return { leanA: false, leanB: false, both: false, label: raw || 'N/A' };
  }
}

// Determine if a Stage 4 answer is pairwise or 3opt
function isStage4Pairwise(raw) {
  return ['A', 'A-slight', 'B-slight', 'B'].includes(raw);
}

// ─── Report builder ───────────────────────────────────────────────────────────

function buildReport(row) {
  const scores = typeof row.scores_snapshot === 'string'
    ? JSON.parse(row.scores_snapshot)
    : (row.scores_snapshot || {});
  const responses = typeof row.responses_snapshot === 'string'
    ? JSON.parse(row.responses_snapshot)
    : (row.responses_snapshot || {});

  // api_result.hypothesis carries confirmed type/instinct and Stage 4 outcome
  // for all clients. scores_snapshot may lack stage2/3/4 sub-objects for older
  // records, so we fall back to hypothesis fields.
  const apiResult = typeof row.api_result === 'string'
    ? JSON.parse(row.api_result)
    : (row.api_result || {});
  const hyp = apiResult.hypothesis || {};
  const apiFlags = apiResult.flags || [];

  const s1  = scores;              // stage1 fields live at top level
  const s2  = scores.stage2 || {};
  const s3  = scores.stage3 || {};
  // Synthesize s4 from scores_snapshot (newer) or api_result.hypothesis (older)
  const s4  = scores.stage4 || {
    path:             hyp.stage4_path     || null,
    option:           hyp.stage4_option   || null,
    leadType:         hyp.confirmed_type  || null,
    secondType:       hyp.second_candidate_type || null,
    outcome:          hyp.stage4_outcome  || null,
    stressConfirmed:  hyp.stage4_stress_confirmed   ?? null,
    securityConfirmed: hyp.stage4_security_confirmed ?? null,
    habitConfirmed:   hyp.stage4_habit_confirmed     ?? null,
  };

  const r0  = responses.stage0  || {};
  const r1  = responses.stage1  || {};
  const r2  = responses.stage2  || {};
  const r3  = responses.stage3  || {};
  const r4  = responses.stage4  || {};
  const finalQ = responses.finalQuestion;

  const confirmedType    = s4.leadType || hyp.confirmed_type || s1.typeHypotheses?.[0];
  const confirmedInstinct = hyp.confirmed_instinct || s1.identifiedInstinct || '?';
  const typeName         = TYPE_NAMES[confirmedType] || '';

  // Assessment date
  const assessDate = row.assessment_date
    ? new Date(row.assessment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';

  const children = [];

  // ── HEADER ──────────────────────────────────────────────────────────────────
  children.push(h1('HIVE ENNEAGRAM BETA REPORT'));
  children.push(spacer());
  children.push(simpleTable([
    labelRow('Client Name',    `${row.first_name} ${row.last_name}`, false),
    labelRow('Email',          row.email,     true),
    labelRow('Coach',          row.coach_name, false),
    labelRow('Assessment Date', assessDate,    true),
  ]));
  children.push(spacer());

  // ── ENGINE OUTCOME ───────────────────────────────────────────────────────────
  children.push(h1('Engine Outcome'));
  const typeLabel = confirmedType
    ? `${confirmedInstinct} ${confirmedType} — ${typeName}`
    : 'Not confirmed';
  children.push(boldPara(`Confirmed Type: ${typeLabel}`));
  children.push(spacer());
  children.push(simpleTable([
    labelRow('Confirmed Type',     typeLabel,                         false),
    labelRow('Confidence Level',   hyp.confidence_level || s1.instinctConfidence || '?', true),
    labelRow('Stage 4 Outcome',    s4.outcome  || 'N/A',             false),
    labelRow('Stage 4 Path',       s4.path     || 'N/A',             true),
  ]));
  children.push(spacer());

  // Use api_result.flags when scores_snapshot doesn't carry them
  const flags = (scores.flags && scores.flags.length > 0) ? scores.flags : apiFlags;
  children.push(h2('Flags Raised'));
  if (flags.length === 0) {
    children.push(para('None'));
  } else {
    flags.forEach(f => {
      const ft = typeof f === 'string' ? f : (f.flag_type || JSON.stringify(f));
      const desc = typeof f === 'object' ? (f.description || f.explanation || '') : '';
      children.push(para(`• ${ft}${desc ? ': ' + desc : ''}`));
    });
  }
  children.push(spacer());

  // ── STAGE 0 ──────────────────────────────────────────────────────────────────
  children.push(h1('Stage 0 — Warm-Up'));
  STAGE0_QUESTIONS.forEach(q => {
    children.push(h2(q.title));
    children.push(boldPara(q.text));
    children.push(para(r0[q.id] || '[No response]'));
    children.push(spacer());
  });

  // ── STAGE 1 ──────────────────────────────────────────────────────────────────
  children.push(h1('Stage 1 — Centers & Instincts'));

  // Summary scores
  const centerHead   = s1.head   ?? '?';
  const centerHeart  = s1.heart  ?? '?';
  const centerBody   = s1.body   ?? '?';
  const instSP       = s1.sp     ?? '?';
  const instSO       = s1.so     ?? '?';
  const instSX       = s1.sx     ?? '?';

  children.push(h2('Score Summary'));
  children.push(simpleTable([
    labelRow('Head / Heart / Body',      `${centerHead} / ${centerHeart} / ${centerBody}  (gap: ${s1.centerGap ?? '?'})`, false),
    labelRow('Confirmed Center',          s1.identifiedCenter || '?',  true),
    labelRow('Center Confidence',         s1.centerConfidence || '?',  false),
    labelRow('SP / SO / SX',            `${instSP} / ${instSO} / ${instSX}  (gap: ${s1.instinctGap ?? '?'})`, true),
    labelRow('Confirmed Instinct',        confirmedInstinct, false),
    labelRow('Instinct Confidence',       hyp.instinct_confidence || s1.instinctConfidence || '?', true),
    labelRow('Type Hypotheses',           (s1.typeHypotheses || []).map(t => `Type ${t}`).join(', '), false),
    labelRow('Counter-Type Flag',         s1.counterTypeFlag || (hyp.counter_type_confirmed ? 'YES' : 'NO'), true),
    ...(s1.counterTypeCombination || hyp.counter_type_combination
      ? [labelRow('Counter-Type Combination', s1.counterTypeCombination || hyp.counter_type_combination || '', false)]
      : []),
  ]));
  children.push(spacer());

  // Individual questions
  STAGE1_QUESTIONS.forEach((q, idx) => {
    const rankingRaw = r1[q.id] || {};
    // ranking values: a/b/c = 1/2/3
    const ranking = {
      a: typeof rankingRaw.a === 'number' ? rankingRaw.a : parseInt(rankingRaw.a) || 0,
      b: typeof rankingRaw.b === 'number' ? rankingRaw.b : parseInt(rankingRaw.b) || 0,
      c: typeof rankingRaw.c === 'number' ? rankingRaw.c : parseInt(rankingRaw.c) || 0,
    };
    const dimLabel = q.type === 'centers' ? 'Centers (Body / Heart / Head)' : 'Instincts (SP / SO / SX)';
    children.push(h2(`Q${idx + 1}: ${q.title} [${dimLabel}]`));
    children.push(boldPara(q.text));
    children.push(stage1RankTable(q, ranking));
    children.push(spacer());
  });

  // ── STAGE 2 ──────────────────────────────────────────────────────────────────
  children.push(h1('Stage 2 — Cross-Referencing'));
  children.push(h2('Summary'));
  children.push(simpleTable([
    labelRow('Primary Hypothesis',   `Type ${s2.xrefPrimary || '?'}`,     false),
    labelRow('Alternative Hypothesis', `Type ${s2.xrefAlternative || '?'}`, true),
    labelRow('Ambiguity Axis',       s2.xrefAmbiguityAxis || '?',          false),
    labelRow('Cross-Center Divergence', s2.crossCenterDivergence ? 'YES' : 'NO', true),
  ]));
  children.push(spacer());

  const s2QuestionKeys = ['q1', 'q2', 'q3'];
  STAGE2_QUESTIONS.forEach((q, idx) => {
    const selected = r2[s2QuestionKeys[idx]] || null;
    children.push(h2(`Q${idx + 1}: ${q.title} [${q.framework}]`));
    children.push(boldPara(q.text));
    children.push(stage2OptionsTable(q, selected));
    children.push(spacer());
  });

  // ── STAGE 3 ──────────────────────────────────────────────────────────────────
  children.push(h1('Stage 3 — Pairwise Discrimination'));
  children.push(h2('Summary'));
  children.push(simpleTable([
    labelRow('Mode',          s3.mode       || '?',  false),
    labelRow('Pair Tested',   s3.pair       || '?',  true),
    labelRow('Result',        s3.q1Result   || '?',  false),
    labelRow('Leading Type',  `Type ${s3.leading || '?'}`, true),
    labelRow('Confidence',    s3.confidence || '?',  false),
    labelRow('CT Answer',     s3.ctAnswer   || 'N/A', true),
  ]));
  children.push(spacer());

  // Q1
  const q1Raw = r3.q1;
  if (q1Raw) {
    children.push(h2('Q1: ' + STAGE3_Q1_STEM));

    if (s3.mode === 'COUNTER-TYPE') {
      const ctKey = s3.pairKey || s1.counterTypeKey;
      const ctPair = STAGE3_CT_PAIRS[ctKey] || {};
      const decoded = decodeStage3Answer(q1Raw);
      children.push(boldPara(STAGE3_Q1_STEM));
      children.push(pairTable([
        pairRow('Person A', ctPair.personA || '[CT pair not found]', decoded.leanA && !decoded.both),
        pairRow('Person B', ctPair.personB || '[CT pair not found]', decoded.leanB && !decoded.both),
      ]));
      children.push(para(`Selected: ${decoded.label}`, { bold: true }));
    } else {
      // Standard mode — determine pair
      const pairKey = s3.pairKey;
      let typeA, typeB;
      if (pairKey && pairKey.includes('-')) {
        const parts = pairKey.split('-');
        typeA = parseInt(parts[0]);
        typeB = parseInt(parts[1]);
      }
      const textA = typeA ? (STAGE3_CORE_MOTIVATIONS[typeA] || '') : '';
      const textB = typeB ? (STAGE3_CORE_MOTIVATIONS[typeB] || '') : '';
      const decoded = decodeStage3Answer(q1Raw);
      children.push(boldPara(STAGE3_Q1_STEM));
      children.push(pairTable([
        pairRow(`Person A (Type ${typeA || '?'})`, textA, decoded.leanA && !decoded.both),
        pairRow(`Person B (Type ${typeB || '?'})`, textB, decoded.leanB && !decoded.both),
      ]));
      children.push(para(`Selected: ${decoded.label}`, { bold: true }));
    }
    children.push(spacer());
  }

  // Q2 — only if fired (not null)
  const q2Raw = r3.q2;
  if (q2Raw) {
    children.push(h2('Q2: ' + STAGE3_Q2_STEM));
    const pairKey = s3.pairKey;
    const avoidance = STAGE3_AVOIDANCE_QUESTIONS[pairKey] || {};
    const decoded = decodeStage3Answer(q2Raw);
    children.push(boldPara(STAGE3_Q2_STEM));
    children.push(pairTable([
      pairRow('Person A', avoidance.personA || '[avoidance text not found]', decoded.leanA && !decoded.both),
      pairRow('Person B', avoidance.personB || '[avoidance text not found]', decoded.leanB && !decoded.both),
    ]));
    children.push(para(`Selected: ${decoded.label}`, { bold: true }));
    children.push(spacer());
  }

  // ── STAGE 4 ──────────────────────────────────────────────────────────────────
  children.push(h1('Stage 4 — Confirmation'));
  children.push(h2('Summary'));
  children.push(simpleTable([
    labelRow('Path Taken',        s4.path    || '?',  false),
    labelRow('Option',            s4.option  || '?',  true),
    labelRow('Lead Type',         `Type ${s4.leadType || '?'}`, false),
    labelRow('Stage 4 Outcome',   s4.outcome || '?',  true),
    labelRow('Stress Confirmed',  s4.stressConfirmed   != null ? (s4.stressConfirmed   ? 'Yes' : 'No') : 'N/A', false),
    labelRow('Security Confirmed', s4.securityConfirmed != null ? (s4.securityConfirmed ? 'Yes' : 'No') : 'N/A', true),
    labelRow('Habit Confirmed',   s4.habitConfirmed    != null ? (s4.habitConfirmed    ? 'Yes' : 'No') : 'N/A (did not fire)', false),
  ]));
  children.push(spacer());

  const leadType = s4.leadType || confirmedType;
  const ctKey = s1.counterTypeKey;
  const isCTPairwise = s4.path === 'COUNTER_TYPE_AMBIGUOUS';
  const ctComparative = STAGE4_CT_COMPARATIVE[ctKey];

  // Stress
  const stressAns = r4.stress;
  if (stressAns != null) {
    children.push(h2('Stress Point'));
    children.push(boldPara(STAGE4_STRESS_STEM));
    const isPairwise = isStage4Pairwise(stressAns);
    if (isPairwise && ctComparative) {
      const decoded = decodeStage4Pairwise(stressAns);
      children.push(pairTable([
        pairRow('Person A', ctComparative.stress.personA, decoded.leanA && !decoded.both),
        pairRow('Person B', ctComparative.stress.personB, decoded.leanB && !decoded.both),
      ]));
      children.push(para(`Selected: ${decoded.label}`, { bold: true }));
    } else if (leadType && STAGE4_STRESS[leadType]) {
      children.push(stage4ThreeOptTable(STAGE4_STRESS[leadType], stressAns));
    } else {
      children.push(para(`Answer: ${stressAns}`));
    }
    children.push(para(`Confirmed: ${s4.stressConfirmed != null ? (s4.stressConfirmed ? 'Yes' : 'No') : 'N/A'}`));
    children.push(spacer());
  }

  // Security
  const securityAns = r4.security;
  if (securityAns != null) {
    children.push(h2('Security Point'));
    children.push(boldPara(STAGE4_SECURITY_STEM));
    const isPairwise = isStage4Pairwise(securityAns);
    if (isPairwise && ctComparative) {
      const decoded = decodeStage4Pairwise(securityAns);
      children.push(pairTable([
        pairRow('Person A', ctComparative.security.personA, decoded.leanA && !decoded.both),
        pairRow('Person B', ctComparative.security.personB, decoded.leanB && !decoded.both),
      ]));
      children.push(para(`Selected: ${decoded.label}`, { bold: true }));
    } else if (leadType && STAGE4_SECURITY[leadType]) {
      children.push(stage4ThreeOptTable(STAGE4_SECURITY[leadType], securityAns));
    } else {
      children.push(para(`Answer: ${securityAns}`));
    }
    children.push(para(`Confirmed: ${s4.securityConfirmed != null ? (s4.securityConfirmed ? 'Yes' : 'No') : 'N/A'}`));
    children.push(spacer());
  }

  // Habit (only if fired)
  const habitAns = r4.habit;
  if (habitAns != null) {
    children.push(h2('Habit of Mind'));
    children.push(boldPara(STAGE4_HABIT_STEM));
    const isPairwise = isStage4Pairwise(habitAns);
    if (isPairwise && ctComparative) {
      const decoded = decodeStage4Pairwise(habitAns);
      children.push(pairTable([
        pairRow('Person A', ctComparative.habit.personA, decoded.leanA && !decoded.both),
        pairRow('Person B', ctComparative.habit.personB, decoded.leanB && !decoded.both),
      ]));
      children.push(para(`Selected: ${decoded.label}`, { bold: true }));
    } else if (leadType && STAGE4_HABIT[leadType]) {
      children.push(stage4ThreeOptTable(STAGE4_HABIT[leadType], habitAns));
    } else {
      children.push(para(`Answer: ${habitAns}`));
    }
    children.push(para(`Confirmed: ${s4.habitConfirmed != null ? (s4.habitConfirmed ? 'Yes' : 'No') : 'N/A'}`));
    children.push(spacer());
  }

  // ── FINAL OPEN QUESTION ───────────────────────────────────────────────────────
  children.push(h1('Final Open Question'));
  if (finalQ) {
    children.push(boldPara('Final Open Response'));
    children.push(para(finalQ));
  } else {
    children.push(para('Skipped.'));
  }
  children.push(spacer());

  // ── BETA COMPARISON ───────────────────────────────────────────────────────────
  children.push(h1('Beta Comparison (Manual Entry)'));
  children.push(simpleTable([
    labelRow("Coach's self-reported type", '_______________', false),
    labelRow('Engine match?',              '_______________', true),
    labelRow('Notes from Google Form',     '',                false),
  ]));
  children.push(spacer());
  children.push(para('[Space for notes]'));

  // ── BUILD DOC ─────────────────────────────────────────────────────────────────
  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullet-list',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: DXA_PAGE_WIDTH, height: DXA_PAGE_HEIGHT },
          margin: { top: DXA_MARGIN, right: DXA_MARGIN, bottom: DXA_MARGIN, left: DXA_MARGIN },
        },
      },
      children,
    }],
  });

  return doc;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node beta/generate_report.js <client_id>');
    console.error('       node beta/generate_report.js --all');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set — cannot connect to database');
    process.exit(1);
  }

  const outDir = path.join(__dirname, 'user_reports');
  fs.mkdirSync(outDir, { recursive: true });

  let rows;
  try {
    if (arg === '--all') {
      rows = await fetchClients(null);
    } else {
      const id = parseInt(arg);
      if (isNaN(id)) {
        console.error(`Invalid client_id: ${arg}`);
        process.exit(1);
      }
      rows = await fetchClients(id);
    }
  } catch (e) {
    console.error('DB query failed:', e.message);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log('No completed clients found for the given criteria.');
    await pool.end();
    return;
  }

  for (const row of rows) {
    if (!row.scores_snapshot || !row.responses_snapshot) {
      console.warn(`Skipping client ${row.client_id} (${row.first_name} ${row.last_name}) — missing snapshots`);
      continue;
    }

    const date = row.assessment_date ? new Date(row.assessment_date) : new Date();
    const dateStr = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('');

    const lastName  = (row.last_name  || 'unknown').toLowerCase().replace(/\s+/g, '_');
    const firstName = (row.first_name || 'unknown').toLowerCase().replace(/\s+/g, '_');
    const filename  = `${lastName}_${firstName}_${dateStr}.docx`;
    const outPath   = path.join(outDir, filename);

    console.log(`Generating: ${filename}  (client #${row.client_id})`);

    let doc;
    try {
      doc = buildReport(row);
    } catch (e) {
      console.error(`  ERROR building report for client #${row.client_id}:`, e.message);
      continue;
    }

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outPath, buffer);
    console.log(`  Written: ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  await pool.end();
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
