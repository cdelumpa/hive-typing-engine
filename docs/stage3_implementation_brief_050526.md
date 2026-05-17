# Stage 3 Implementation Brief
## Claude Code Session — May 2026

---

## OBJECTIVE

Update Stage 3 question content in `app/assessment.js`. This is a **content-only pass**. Do not touch scoring logic, routing, rendering, or any Stage other than Stage 3.

**Source of truth:** `hive_stage3_questions_approved_050526.docx` in the project knowledge. The existing `assessment.js` Stage 3 strings are outdated — do not use them as reference for content.

**Targets — only these data objects:**
- `STAGE3_Q1_STEM`
- `STAGE3_Q2_STEM`
- `STAGE3_CORE_MOTIVATIONS`
- `STAGE3_HIGH_AMBIGUITY_PAIRS`
- `STAGE3_AVOIDANCE_QUESTIONS`
- `STAGE3_CT_PAIRS`

---

## IMPLEMENTATION ORDER — THREE COMMITS

### COMMIT 1 — Stems + Core Motivations

**Step 1.** Update `STAGE3_Q1_STEM` and `STAGE3_Q2_STEM`.

**Step 2.** Update all 9 entries in `STAGE3_CORE_MOTIVATIONS`.

**Step 3.** Run both tests:
```bash
cd ~/Developer/hive-typing-engine && node tests/run_test.js sp9
cd ~/Developer/hive-typing-engine && node tests/run_test.js so7
```
Both must pass clean before committing.

**Step 4.** Commit. Message: `feat: update Stage 3 stems and core motivations`

---

### COMMIT 2 — Avoidance Questions + High-Ambiguity Set

**Step 5.** Update all existing entries in `STAGE3_AVOIDANCE_QUESTIONS`.

**Step 6.** Add the new `'3-6'` entry to `STAGE3_AVOIDANCE_QUESTIONS`.

**Step 7.** Add `'3-6'` and `'5-6'` to `STAGE3_HIGH_AMBIGUITY_PAIRS`. The updated set should be:
```javascript
const STAGE3_HIGH_AMBIGUITY_PAIRS = new Set([
  '1-6', '1-9', '2-6', '2-9', '3-6', '3-7', '3-8', '4-5', '4-9', '5-6', '5-9', '6-8',
]);
```

**Step 8.** Add the new `'5-6'` entry to `STAGE3_AVOIDANCE_QUESTIONS`.

**Step 9.** Run both tests:
```bash
cd ~/Developer/hive-typing-engine && node tests/run_test.js sp9
cd ~/Developer/hive-typing-engine && node tests/run_test.js so7
```
Both must pass clean before committing.

**Step 10.** Commit. Message: `feat: update Stage 3 avoidance questions, add 3v6 and 5v6`

---

### COMMIT 3 — CT Pairs

**Step 11.** Update all 5 entries in `STAGE3_CT_PAIRS`.

**Step 12.** Run both tests:
```bash
cd ~/Developer/hive-typing-engine && node tests/run_test.js sp9
cd ~/Developer/hive-typing-engine && node tests/run_test.js so7
```
Both must pass clean before committing.

**Step 13.** Push all commits to origin:
```bash
cd ~/Developer/hive-typing-engine && git push origin main
```

**Step 14.** Commit. Message: `feat: update Stage 3 CT pairs`

---

## FORMAT RULES

- Follow the existing file encoding pattern for special characters (typographic apostrophes as `\u2019`, em dashes as `\u2014` where they appear in existing strings).
- Do not add or remove em dashes — match the style of the approved content exactly.
- Keys in `STAGE3_AVOIDANCE_QUESTIONS` and `STAGE3_HIGH_AMBIGUITY_PAIRS` use the format `'lower-higher'` (e.g. `'3-6'`, not `'6-3'`).

---

## PART A — STEMS

### STAGE3_Q1_STEM
**Current:** `'When you're at your best, how would you describe your internal experience?'`
**New:** `'Which of these sounds most like you at your best?'`

### STAGE3_Q2_STEM
**Current:** `'Which of these feels most uncomfortable or intolerable when it shows up in your life?'`
**New:** `'Which of these is hardest for you to be with?'`

---

## PART B — CORE MOTIVATIONS

All 9 entries updated. Replace `STAGE3_CORE_MOTIVATIONS` in full:

| Type | New string |
|---|---|
| 1 | `'I am doing things the right way. I feel principled, clear, and in integrity with my own standards.'` |
| 2 | `'I am tuned in to what others need. I feel genuinely helpful, warm, and deeply connected.'` |
| 3 | `'I am achieving my goals and getting things done. I feel capable, successful, and recognized for what I bring.'` |
| 4 | `'I am expressing who I really am — nothing hidden, nothing performed. I feel a sense of meaning and purpose, alive, and creative.'` |
| 5 | `'I am deeply knowledgeable about things that matter. I feel well-boundaried, self-sufficient, and resourced.'` |
| 6 | `'I am prepared for whatever life throws at me. I feel steady, certain, and loyal to people I trust.'` |
| 7 | `'I am experiencing life to the fullest. I feel free, expansive, and open to everything available to me.'` |
| 8 | `'I am fully in control of my world. I feel strong, powerful, and completely unbothered by outside pressure.'` |
| 9 | `'I am experiencing a sense of inner and outer calm. I feel connected to everyone and everything.'` |

**What changed vs. current:**
- Type 3: was `'I am achieving something meaningful...'` → now includes `'getting things done'` and `'recognized for what I bring'`
- Type 4: was `'I am fully and authentically myself...'` → now `'expressing who I really am — nothing hidden, nothing performed'`
- Type 5: was `'I understand what's happening at a deep level...'` → now `'deeply knowledgeable about things that matter'`
- Type 6: was `'I am prepared and loyal to what matters...'` → now `'prepared for whatever life throws at me'`
- Type 9: was `'Everything feels settled and at peace...'` → now `'experiencing a sense of inner and outer calm'`

---

## PART C — AVOIDANCE QUESTIONS

### Updated HIGH_AMBIGUITY_PAIRS set

```javascript
const STAGE3_HIGH_AMBIGUITY_PAIRS = new Set([
  '1-6', '1-9', '2-6', '2-9', '3-6', '3-7', '3-8', '4-5', '4-9', '5-6', '5-9', '6-8',
]);
```

Two additions vs. current: `'3-6'` (new) and `'5-6'` (new).

---

### Updated + New STAGE3_AVOIDANCE_QUESTIONS

Replace all entries in full:

**`'1-6'`** · Inner Critic vs. External Certainty
```javascript
personA: 'The voice in my head that tells me I\u2019m not enough, not good enough, or that I\u2019m wrong.',
personB: 'Feeling unsupported, unprepared, or uncertain about what\u2019s about to happen.',
```

**`'1-9'`** · Inner Critic vs. Conflict Avoidance
```javascript
personA: 'Seeing something wrong, incorrect, or broken and not being able to fix it.',
personB: 'Experiencing conflict or tension in the peace and not being able to escape it.',
```

**`'2-6'`** · Rejection vs. Uncertainty
```javascript
personA: 'Feeling like my care and support is unwanted or unnecessary.',
personB: 'Feeling like I don\u2019t know where things stand or who I can truly trust.',
```

**`'2-9'`** · Being Unloved vs. Disrupted Peace
```javascript
personA: 'Feeling like I\u2019m no longer needed by people that matter to me.',
personB: 'Feeling friction or conflict with people that matter to me.',
```

**`'3-6'`** · Recognition vs. Support *(NEW — add this entry)*
```javascript
personA: 'Feeling like my efforts aren\u2019t being noticed or valued.',
personB: 'Feeling unsupported in the face of uncertainty.',
```

**`'3-7'`** · Goal Orientation vs. Limitation *(label updated)*
```javascript
personA: 'Not having a clear goal to achieve or things on my to-do list.',
personB: 'Running out of ideas, energy, or possibilities.',
```

**`'3-8'`** · Image vs. Power *(label updated)*
```javascript
personA: 'People who don\u2019t appreciate what it took for me to achieve a goal.',
personB: 'People who won\u2019t go head-to-head with me in tough conversations.',
```

**`'4-5'`** · Ordinariness vs. Emotional Overwhelm *(label updated, strings updated)*
```javascript
personA: 'Feeling like there\u2019s nothing special about me \u2014 that I\u2019m just like everyone else.',
personB: 'Feeling overwhelmed by an emotional experience, mine or someone else\u2019s.',
```

**`'4-9'`** · Emotional Flatness vs. Emotional Intensity *(label updated, strings updated)*
```javascript
personA: 'Feeling emotionally flat or numb \u2014 like nothing is moving inside me.',
personB: 'Feeling pulled into someone else\u2019s emotional intensity or drama.',
```

**`'5-6'`** · Resource Scarcity vs. Lack of Support *(NEW — add this entry)*
```javascript
personA: 'Feeling like I don\u2019t have the resources to navigate the world.',
personB: 'Feeling unsupported in the face of uncertainty.',
```

**`'5-9'`** · Depletion vs. Conflict *(strings updated)*
```javascript
personA: 'Feeling depleted by too much engagement or contact.',
personB: 'Feeling pressured to take a position that could cause conflict or disharmony.',
```

**`'6-8'`** · Managed Fear vs. Denied Vulnerability *(strings updated)*
```javascript
personA: 'Feeling unprepared for something that could go wrong.',
personB: 'Feeling weak, vulnerable, or like someone has gotten the upper hand.',
```

---

## PART D — CT PAIRS

Replace all 5 entries in `STAGE3_CT_PAIRS` in full:

**`'SO-7'`** · SO 7 vs. Type 2
```javascript
'SO-7': {
  label: 'SO 7 vs. Type 2',
  counterType: 7,
  lookalike: 2,
  personA: 'I am sharing enjoyable experiences with the people around me.',
  personB: 'I am tuned in to and delivering what others need.',
},
```

**`'SX-6'`** · SX 6 vs. Type 8
```javascript
'SX-6': {
  label: 'SX 6 vs. Type 8',
  counterType: 6,
  lookalike: 8,
  personA: 'I am facing something head-on and not letting fear win.',
  personB: 'I am in full control, making important things happen.',
},
```

**`'SP-3'`** · SP 3 vs. Type 1
```javascript
'SP-3': {
  label: 'SP 3 vs. Type 1',
  counterType: 3,
  lookalike: 1,
  personA: 'I am getting results and making things happen without needing anyone\u2019s help or approval.',
  personB: 'I am doing things the right way, even when no one is watching.',
},
```

**`'SP-4'`** · SP 4 vs. Type 3
```javascript
'SP-4': {
  label: 'SP 4 vs. Type 3',
  counterType: 4,
  lookalike: 3,
  personA: 'I am throwing myself into something that feels alive, authentic, and worth pursuing.',
  personB: 'I am moving toward a goal and fully focused on making it happen.',
},
```

**`'SX-1'`** · SX 1 vs. Type 8
```javascript
'SX-1': {
  label: 'SX 1 vs. Type 8',
  counterType: 1,
  lookalike: 8,
  personA: 'I feel a strong pull to step in to fix what\u2019s wrong or is falling short of the ideal.',
  personB: 'I am fully at ease with my own power and presence and know how to use it.',
},
```

---

## VERIFICATION CHECKLIST

### After Commit 1
- [ ] `STAGE3_Q1_STEM` updated
- [ ] `STAGE3_Q2_STEM` updated
- [ ] All 9 `STAGE3_CORE_MOTIVATIONS` entries updated
- [ ] `sp9` — PASS
- [ ] `so7` — PASS

### After Commit 2
- [ ] All existing `STAGE3_AVOIDANCE_QUESTIONS` entries updated
- [ ] `'3-6'` added to `STAGE3_AVOIDANCE_QUESTIONS`
- [ ] `'5-6'` added to `STAGE3_AVOIDANCE_QUESTIONS`
- [ ] `STAGE3_HIGH_AMBIGUITY_PAIRS` now contains 12 entries including `'3-6'` and `'5-6'`
- [ ] `sp9` — PASS
- [ ] `so7` — PASS

### After Commit 3
- [ ] All 5 `STAGE3_CT_PAIRS` entries updated
- [ ] `sp9` — PASS
- [ ] `so7` — PASS
- [ ] All commits pushed to `origin/main`

---

## WHAT IS NOT IN SCOPE FOR THIS SESSION

- Stage 1 or Stage 2 question updates — deferred to separate sessions
- `assessment.js` refactor — deferred until Mo's scoring logic edits are complete
- Stage 4 content — already shipped in commits `ef32e90` and `910b3e5`
- SaaS/tiered access model — deferred pending business model alignment

---

*Hive Typing Engine — Stage 3 Implementation Brief*
*Cai Delumpa & Monique Breault — Hive, Inc. — May 2026*
*CONFIDENTIAL — For internal use only*
