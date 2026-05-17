# Stage 4 Implementation Brief
## Claude Code Session — May 2026

---

## OBJECTIVE

Update Stage 4 question content and the Type 4 name in `app/assessment.js`. This is a **content-only pass**. Do not touch scoring logic, routing, rendering, or anything outside the five named data objects.

**Source of truth:** `hive_stage4_handoff_050526.md` and `hive_stage4_approved_050526.docx` in the project knowledge. The existing `assessment.js` Stage 4 strings are outdated — do not use them as reference for content.

**Targets — only these five objects:**
- `STAGE4_STRESS`
- `STAGE4_SECURITY`
- `STAGE4_HABIT`
- `STAGE4_CT_COMPARATIVE`
- `TYPE_NAMES`

---

## IMPLEMENTATION ORDER — TWO COMMITS

### COMMIT 1 — Standard Questions + Type Name Fix

**Step 1.** Update `STAGE4_STRESS`, `STAGE4_SECURITY`, and `STAGE4_HABIT` for all nine types using the approved content in Part A below.

**Step 2.** Fix `TYPE_NAMES`: change `4: 'The Idealist'` → `4: 'The Individualist'`. All other names remain unchanged.

**Step 3.** Run both tests:
```bash
node tests/run_test.js sp9
node tests/run_test.js so7
```
Both must pass clean before committing.

**Step 4.** Commit `app/assessment.js` only.
Message: `feat: update Stage 4 standard questions and fix Type 4 name`

---

### COMMIT 2 — CT Comparative Pairs

**Step 5.** Update `STAGE4_CT_COMPARATIVE` for all five CT pairs using the approved content in Part B below.

**Step 6.** Run both tests again. Both must pass clean before committing.

**Step 7.** Check whether `app/type_library.json` stores type names. If it does, sync the Type 4 name fix there too using:
```bash
cp ~/Developer/hive-typing-engine/content/type_library.json ~/Developer/hive-typing-engine/app/type_library.json
```
Commit `app/assessment.js` and `app/type_library.json` together.
Message: `feat: update Stage 4 CT comparative pairs`

---

## FORMAT RULES

- All strings use **two-sentence structure** — no em dashes joining clauses. Every string reads as two complete sentences.
- Use typographic apostrophes (`'`) not straight quotes (`'`).
- Index 0 is always the correct answer; indexes 1 and 2 are distractors. Shuffled at render time — do not change this logic.
- Follow the existing file encoding pattern for special characters.

---

## CROSS-INSTANCE CONSISTENCY — CRITICAL

The following strings appear in both the standard questions AND the CT Comparative pairs. They must be **character-for-character identical** in every location where they appear. After updating both data objects, grep for each shared string to verify consistency before committing Commit 2.

| String | Must appear identically in |
|---|---|
| `"I become weighed down with emotion. I start dwelling on what others have naturally that I don't and I long to be whole."` | Type 1 STRESS [0]; SP-3 CT Stress personB; SX-1 CT Stress personA |
| `"I become lighter, more playful, and spontaneous. I stop being so hard on myself and find it easier to enjoy things without worrying about doing them perfectly."` | Type 1 SECURITY [0]; SP-3 CT Security personB |
| `"To what's wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else."` | Type 1 HABIT [0]; SP-3 CT Habit personB; SX-1 CT Habit personA |
| `"I shut down. The drive and ambition that usually feel effortless just vanish and I find myself checked out and disengaged."` | Type 3 STRESS [0]; SP-3 CT Stress personA; SP-4 CT Stress personB |
| `"I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don't need to go it alone and actually want us to win together."` | Type 3 SECURITY [0]; SP-3 CT Security personA; SP-4 CT Security personB |
| `"I become overly helpful and acutely aware of what others need. I set my own needs aside and seek the appreciation of others."` | Type 4 STRESS [0]; SP-4 CT Stress personA |
| `"I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy."` | Type 8 STRESS [0]; SX-6 CT Stress personB; SX-1 CT Stress personB |
| `"I become magnanimous and open to connection. I put the armor down and allow myself to show my care and support for others."` | Type 8 SECURITY [0]; SX-6 CT Security personB; SX-1 CT Security personB |
| `"To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated."` | Type 8 HABIT [0]; SX-6 CT Habit personB; SX-1 CT Habit personB |
| `"I turn inward and become introspective. I stop trying to take care of others and allow myself to focus on how I'm feeling and what I need."` | Type 2 SECURITY [0]; SO-7 CT Security personB |

---

## PART A — STANDARD QUESTIONS

### STAGE4_STRESS

**Type 1** *(1→4)*
- [0] CORRECT: `"I become weighed down with emotion. I start dwelling on what others have naturally that I don't and I long to be whole."`
- [1] DISTRACTOR (6 energy): `"I become more anxious and suspicious. I start worrying about what could go wrong and need reassurance that things will be okay."`
- [2] DISTRACTOR (9 energy): `"I go numb and withdraw. I go along to get along, hoping that will restore the peace both internally and externally."`

**Type 2** *(2→8)*
- [0] CORRECT: `"I get angry, forceful, and confrontational. My usual warm and giving self disappears and I become demanding, blunt, or even aggressive about what I need."`
- [1] DISTRACTOR (6 energy): `"I become hypervigilant about who I can trust. I get suspicious and start needing reassurance that the people in my life are actually there for me."`
- [2] DISTRACTOR (4 energy): `"I turn inward and become absorbed in how I'm feeling. I pull away from others and get lost in my own emotional world."`

**Type 3** *(3→9)*
- [0] CORRECT: `"I shut down. The drive and ambition that usually feel effortless just vanish and I find myself checked out and disengaged."`
- [1] DISTRACTOR (6 energy): `"I become anxious and start second-guessing myself. I lose confidence in my own judgment and need others to tell me I'm on the right track."`
- [2] DISTRACTOR (2 energy): `"I become overly focused on others and what they need. I shift into caretaking mode as a way to feel needed and connected."`

**Type 4** *(4→2)*
- [0] CORRECT: `"I become overly helpful and acutely aware of what others need. I set my own needs aside and seek the appreciation of others."`
- [1] DISTRACTOR (1 energy): `"I become self-critical and rigid. I get fixated on what I've done wrong and feel a strong pull to correct myself."`
- [2] DISTRACTOR (7 energy): `"I go into overdrive seeking stimulation. I start filling my schedule and looking for the next thing that will make me feel alive again."`

**Type 5** *(5→7)*
- [0] CORRECT: `"I become scattered and overextended. I start taking on too much, chasing new ideas, and lose the focused stillness that usually grounds me."`
- [1] DISTRACTOR (8 energy): `"I become reactive and forceful. I lose my usual calm detachment and feel an intense need to push back and take control."`
- [2] DISTRACTOR (6 energy): `"I become more anxious and catastrophizing. I lose my objective detachment and start spiraling into what could go wrong."`

**Type 6** *(6→3)*
- [0] CORRECT: `"I become hyper-focused on getting after my own goals. I get driven and image-conscious and start pushing hard to make things happen and be seen as capable."`
- [1] DISTRACTOR (8 energy): `"I become forceful and combative. I stop hesitating and start pushing hard — I need to feel powerful and in control."`
- [2] DISTRACTOR (9 energy): `"I check out and go numb. I stop engaging with the anxiety and just try to get through it by not feeling anything."`

**Type 7** *(7→1)*
- [0] CORRECT: `"I become critical and perfectionistic. I lose my lightness and get fixated on what's wrong, what's not good enough, and what needs to be corrected."`
- [1] DISTRACTOR (4 energy): `"I become emotionally flooded and self-absorbed. I get lost in longing for what's missing and find it hard to focus on anything else."`
- [2] DISTRACTOR (5 energy): `"I withdraw and go quiet. I stop engaging and start retreating into my own world, needing a lot of alone time to recover."`

**Type 8** *(8→5)*
- [0] CORRECT: `"I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy."`
- [1] DISTRACTOR (2 energy): `"I become more giving and focused on others. I move toward people and shift into support mode, wanting to feel needed."`
- [2] DISTRACTOR (3 energy): `"I become more driven and performance-focused. I push myself harder to stay productive and appear capable under pressure."`

**Type 9** *(9→6)*
- [0] CORRECT: `"I become anxious and hypervigilant. The usual peace disappears and I start worrying about what could go wrong and whether I'm prepared."`
- [1] DISTRACTOR (4 energy): `"I become emotionally flooded and withdrawn. I get absorbed in my feelings and pull away from people and obligations."`
- [2] DISTRACTOR (3 energy): `"I become driven and task-focused. I throw myself into productivity to avoid feeling what's happening under the surface."`

---

### STAGE4_SECURITY

**Type 1** *(1→7)*
- [0] CORRECT: `"I become lighter, more playful, and spontaneous. I stop being so hard on myself and find it easier to enjoy things without worrying about doing them perfectly."`
- [1] DISTRACTOR (2 energy): `"I become warmer and more focused on others. I want to give more and feel more connected to the people I care about."`
- [2] DISTRACTOR (4 energy): `"I become more reflective and emotionally open. I drop the doing and let myself just feel and be for a while."`

**Type 2** *(2→4)*
- [0] CORRECT: `"I turn inward and become introspective. I stop trying to take care of others and allow myself to focus on how I'm feeling and what I need."`
- [1] DISTRACTOR (9 energy): `"I become easier to be around and less agenda-driven. I stop pushing so hard to be needed and let myself just relax and enjoy things."`
- [2] DISTRACTOR (7 energy): `"I become more playful and spontaneous. I stop focusing on what others need and let myself just explore and enjoy things freely."`

**Type 3** *(3→6)*
- [0] CORRECT: `"I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don't need to go it alone and actually want us to win together."`
- [1] DISTRACTOR (9 energy): `"I slow down and become more easygoing. I stop needing to achieve and just let myself be present without an agenda."`
- [2] DISTRACTOR (7 energy): `"I become more spontaneous and curious. I stop focusing on goals and let myself just explore and enjoy what's in front of me."`

**Type 4** *(4→1)*
- [0] CORRECT: `"I become more grounded, disciplined, and action-oriented. I stop dwelling on what's missing and start doing, with a clearer sense of what's right and what needs to happen."`
- [1] DISTRACTOR (7 energy): `"I become lighter and more optimistic. I stop focusing on what's wrong and let myself enjoy what's actually good in my life."`
- [2] DISTRACTOR (2 energy): `"I become more outward-focused and giving. I stop dwelling on myself and feel genuinely energized by helping and connecting with others."`

**Type 5** *(5→8)*
- [0] CORRECT: `"I become more present, decisive, and action-oriented. I step into the world with confidence and feel energized by direct engagement rather than observation."`
- [1] DISTRACTOR (9 energy): `"I become more easygoing and comfortable in my own skin. I stop overthinking and let myself just be present without needing to analyze everything."`
- [2] DISTRACTOR (2 energy): `"I become more connected and warm. I drop the detachment and feel genuinely open to the people around me."`

**Type 6** *(6→9)*
- [0] CORRECT: `"I become genuinely peaceful and easy. I find myself just present, comfortable, and okay with how things are without needing to figure anything out."`
- [1] DISTRACTOR (2 energy): `"I become warmer and more giving. I feel safe enough to focus on others and genuinely enjoy taking care of the people I care about."`
- [2] DISTRACTOR (4 energy): `"I become more emotionally open and introspective. I feel safe enough to explore my inner world without it feeling threatening."`

**Type 7** *(7→5)*
- [0] CORRECT: `"I become quieter, more focused, and genuinely still. I stop needing to share and stimulate and find deep satisfaction in solitude and going deep on one thing."`
- [1] DISTRACTOR (9 energy): `"I become more easygoing and present. I stop planning ahead and let myself just be where I am without needing something else to be happening."`
- [2] DISTRACTOR (3 energy): `"I become more focused and goal-oriented. I channel my energy into building something and feel grounded by the progress I'm making."`

**Type 8** *(8→2)*
- [0] CORRECT: `"I become magnanimous and open to connection. I put the armor down and allow myself to show my care and support for others."`
- [1] DISTRACTOR (9 energy): `"I become more relaxed and easygoing. I stop pushing so hard and let things unfold without needing to be in control."`
- [2] DISTRACTOR (6 energy): `"I become more loyal and collaborative. I feel a strong pull toward the people I trust and want to make sure everyone is okay."`

**Type 9** *(9→3)*
- [0] CORRECT: `"I become more focused, energized, and directed. I connect with what I actually want and feel a pull to make things happen rather than just going along."`
- [1] DISTRACTOR (7 energy): `"I become lighter and more playful. I stop worrying about keeping the peace and let myself just enjoy what's in front of me."`
- [2] DISTRACTOR (2 energy): `"I become warmer and more attuned. I feel a pull toward the people around me and genuinely enjoy caring for them."`

---

### STAGE4_HABIT

**Type 1**
- [0] CORRECT: `"To what's wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else."`
- [1] DISTRACTOR (6 attention): `"To what could go wrong or what I might not be prepared for. I'm scanning for potential problems and threats before they materialize."`
- [2] DISTRACTOR (3 attention): `"To what needs to be done and how to do it efficiently. I'm already thinking about tasks, goals, and getting things moving."`

**Type 2**
- [0] CORRECT: `"To how other people are feeling and what they might need. I'm reading the room emotionally and sensing who needs something before they ask."`
- [1] DISTRACTOR (9 attention): `"To the overall atmosphere and whether everyone feels comfortable. I'm aware of the group energy and pulled toward making sure things feel settled."`
- [2] DISTRACTOR (6 attention): `"To whether things are going to be okay and who I can rely on. I'm scanning for reliability and trying to anticipate what might go sideways."`

**Type 3**
- [0] CORRECT: `"To what needs to happen and who's going to make it happen. I'm assessing quickly and feel a pull to take charge and get things moving."`
- [1] DISTRACTOR (1 attention): `"To what could be done better. I notice quickly when something isn't quite right and feel a pull to fix it."`
- [2] DISTRACTOR (7 attention): `"To what's possible and what else could be interesting. My mind moves toward options, opportunities, and what could make this better."`

**Type 4**
- [0] CORRECT: `"To what's absent or incomplete. There's a persistent sense that something essential is missing, and my attention keeps returning to that gap even when things are going reasonably well."`
- [1] DISTRACTOR (2 attention): `"To how other people are feeling. I'm attuned to the emotional undercurrent and feel a pull to respond to what I sense in others."`
- [2] DISTRACTOR (9 attention): `"To the overall feel of things. I'm drawn to what's harmonious and what might disrupt the atmosphere."`

**Type 5**
- [0] CORRECT: `"To understanding the situation fully before engaging. I want to gather enough information to feel confident about what's happening before I say or do anything."`
- [1] DISTRACTOR (6 attention): `"To what could go wrong and whether I'm prepared. I find myself anticipating problems and wanting to have a plan before I'm in over my head."`
- [2] DISTRACTOR (1 attention): `"To what's not quite right. I notice inconsistencies and gaps quickly and feel a pull to correct or clarify."`

**Type 6**
- [0] CORRECT: `"To what could go wrong or what I might not be prepared for. I'm scanning for potential problems and threats before they materialize."`
- [1] DISTRACTOR (5 attention): `"To understanding the situation fully before engaging. I want enough information to feel confident before I commit to anything."`
- [2] DISTRACTOR (9 attention): `"To the overall atmosphere and whether things feel stable. I'm drawn to keeping things easy and avoiding unnecessary disruption."`

**Type 7**
- [0] CORRECT: `"To what's next, what's possible, and what else is available. My mind is already moving toward new ideas, options, and what could be exciting about what's ahead."`
- [1] DISTRACTOR (3 attention): `"To what needs to happen and how to make it happen quickly. I'm already thinking about goals, tasks, and getting things moving."`
- [2] DISTRACTOR (2 attention): `"To the people in the room and what might make this more enjoyable for everyone. I want to create energy and connection."`

**Type 8**
- [0] CORRECT: `"To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated."`
- [1] DISTRACTOR (3 attention): `"To what needs to happen and who's going to make it happen. I'm assessing quickly and feel a pull to take charge if no one else is."`
- [2] DISTRACTOR (6 attention): `"To potential threats and whether I can trust what's happening. I'm scanning for danger and assessing who's reliable."`

**Type 9**
- [0] CORRECT: `"To the overall atmosphere and whether everyone feels included and comfortable. I'm aware of the whole room and pulled toward making sure things feel settled and okay for everyone."`
- [1] DISTRACTOR (2 attention): `"To who might need something. I notice quickly if someone seems left out or uncomfortable and feel a pull to help."`
- [2] DISTRACTOR (7 attention): `"To what might make this more enjoyable or interesting. I'm looking for the positive angle and what could make the situation feel lighter."`

---

## PART B — CT COMPARATIVE PAIRS

### STAGE4_CT_COMPARATIVE

#### `'SO-7'` — SO 7 vs. Type 2

```javascript
'SO-7': {
  label: 'SO 7 vs. Type 2',
  stress: {
    personA: 'I become critical, rigid, and perfectionistic. I lose my usual lightness and start fixating on what\'s wrong, what needs correcting, and whether things are being done properly.',  // SO-7 → 1
    personB: 'I get angry, forceful, and confrontational. My usual warm and giving self disappears and I become demanding, blunt, or even aggressive about what I need.',  // Type 2 → 8
  },
  security: {
    personA: 'I become quieter, more focused, and genuinely still. I stop needing to share and stimulate and find deep satisfaction in solitude and going deep on one thing.',  // SO-7 → 5
    personB: 'I turn inward and become introspective. I stop trying to take care of others and allow myself to focus on how I\'m feeling and what I need.',  // Type 2 → 4
  },
  habit: {
    personA: 'To what\'s possible and what I can share. My attention goes toward experiences, ideas, and people I can bring into what I love, so that others feel the aliveness I feel.',  // SO-7
    personB: 'To how other people are feeling and what they might need. I\'m reading the room emotionally and sensing who needs something before they ask.',  // Type 2
  },
},
```

#### `'SX-6'` — SX 6 vs. Type 8

```javascript
'SX-6': {
  label: 'SX 6 vs. Type 8',
  stress: {
    personA: 'I become hyper-focused on getting after my own goals. I put energy into efficiency, achievement, and being seen as successful.',  // SX-6 → 3
    personB: 'I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy.',  // Type 8 → 5
  },
  security: {
    personA: 'I become genuinely peaceful and easy. I find myself just present, comfortable, and okay with how things are.',  // SX-6 → 9
    personB: 'I become magnanimous and open to connection. I put the armor down and allow myself to show my care and support for others.',  // Type 8 → 2
  },
  habit: {
    personA: 'To what could go wrong or what I might not be prepared for. I\'m constantly scanning for danger and coming up with contingency plans.',  // SX-6
    personB: 'To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated.',  // Type 8
  },
},
```

#### `'SP-3'` — SP 3 vs. Type 1

```javascript
'SP-3': {
  label: 'SP 3 vs. Type 1',
  stress: {
    personA: 'I shut down. The drive and ambition that usually feel effortless just vanish and I find myself checked out and disengaged.',  // SP-3 → 9
    personB: 'I become weighed down with emotion. I start dwelling on what others have naturally that I don\'t and I long to be whole.',  // Type 1 → 4
  },
  security: {
    personA: 'I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don\'t need to go it alone and actually want us to win together.',  // SP-3 → 6
    personB: 'I become lighter, more playful, and spontaneous. I stop being so hard on myself and find it easier to enjoy things without worrying about doing them perfectly.',  // Type 1 → 7
  },
  habit: {
    personA: 'To what needs to be done and whether I\'m being effective. My attention goes to tasks, results, and whether I\'m building something solid, without needing anyone to notice.',  // SP-3
    personB: 'To what\'s wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else.',  // Type 1
  },
},
```

#### `'SP-4'` — SP 4 vs. Type 3

```javascript
'SP-4': {
  label: 'SP 4 vs. Type 3',
  stress: {
    personA: 'I become overly helpful and acutely aware of what others need. I set my own needs aside and seek the appreciation of others.',  // SP-4 → 2
    personB: 'I shut down. The drive and ambition that usually feel effortless just vanish and I find myself checked out and disengaged.',  // Type 3 → 9
  },
  security: {
    personA: 'I become more grounded, disciplined, and action-oriented. I stop dwelling on what\'s missing and start doing, with a clearer sense of what\'s right and what needs to happen.',  // SP-4 → 1
    personB: 'I care more about the people around me and feel a stronger sense of loyalty to them. I realize I don\'t need to go it alone and actually want us to win together.',  // Type 3 → 6
  },
  habit: {
    personA: 'To what\'s absent or incomplete. There\'s a persistent sense that something essential is missing, and my attention keeps returning to that gap even when things are going reasonably well.',  // SP-4
    personB: 'To how I\'m coming across and whether I\'m building something meaningful. I\'m aware of whether I\'m being effective and whether the people who matter can see what I\'m capable of.',  // Type 3
  },
},
```

#### `'SX-1'` — SX 1 vs. Type 8

```javascript
'SX-1': {
  label: 'SX 1 vs. Type 8',
  stress: {
    personA: 'I become weighed down with emotion. I start dwelling on what others have naturally that I don\'t and I long to be whole.',  // SX-1 → 4
    personB: 'I disengage and go silent. I pull back, observe from a distance, and become protective of my space and privacy.',  // Type 8 → 5
  },
  security: {
    personA: 'I become more loyal, collaborative, and questioning. I want to check in with people I trust and think things through more carefully, and I feel less need to prove myself.',  // SX-1 → 6
    personB: 'I become magnanimous and open to connection. I put the armor down and allow myself to show my care and support for others.',  // Type 8 → 2
  },
  habit: {
    personA: 'To what\'s wrong, imprecise, or could be improved. I notice errors, inconsistencies, and what needs fixing almost before I notice anything else.',  // SX-1
    personB: 'To the power dynamics in the room and whether power is being used fairly. I step up and take charge if I start feeling controlled or manipulated.',  // Type 8
  },
},
```

---

## VERIFICATION CHECKLIST

### After Commit 1
- [ ] All 9 types updated in `STAGE4_STRESS`, `STAGE4_SECURITY`, `STAGE4_HABIT`
- [ ] No em dashes in any new strings
- [ ] `TYPE_NAMES` entry 4 reads `'The Individualist'`
- [ ] `node tests/run_test.js sp9` — PASS
- [ ] `node tests/run_test.js so7` — PASS

### After Commit 2
- [ ] All 5 CT pairs updated in `STAGE4_CT_COMPARATIVE`
- [ ] Cross-instance strings verified identical (grep each shared string across both objects)
- [ ] `node tests/run_test.js sp9` — PASS
- [ ] `node tests/run_test.js so7` — PASS
- [ ] `app/type_library.json` checked for Type 4 name — synced if present, both files committed together

---

## WHAT IS NOT IN SCOPE FOR THIS SESSION

Do not implement any of the following — these are deferred to separate sessions:

- Stage 1, 2, or 3 question updates
- `assessment.js` refactor (waiting on Mo's scoring logic edits)
- Stage 3 content updates from `hive_stage3_questions_approved_050526.docx`
- 5v6 addition to `STAGE3_HIGH_AMBIGUITY_PAIRS`
- SaaS/tiered access model

---

*Hive Typing Engine — Stage 4 Implementation Brief*
*Cai Delumpa & Monique Breault — Hive, Inc. — May 2026*
*CONFIDENTIAL — For internal use only*
