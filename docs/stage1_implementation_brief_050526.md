# Stage 1 Implementation Brief
## Claude Code Session — May 2026

---

## OBJECTIVE

Replace all Stage 1 question content and update two scoring parameters in `app/assessment.js`. This is the highest-risk content pass to date because:

- `STAGE1_QUESTIONS` is a **full replacement** — new titles, stems, options, and mappings for all 12 questions
- Question count increases from 10 to 12
- Instinct confidence thresholds change due to the added instinct questions
- Wrong mappings produce **silent scoring errors** — the app will not crash, but hypotheses will be wrong

**Read this brief in full before touching any code.**

**Source of truth:** `hive_stage1_questions_draft_050326.docx` in the project knowledge.

**Targets — only these in `app/assessment.js`:**
- `STAGE1_QUESTIONS` — full replacement
- `renderStage1()` — update the stage label count from `10` to `12`
- `computeStage1Scores()` — update instinct confidence thresholds

**Do not touch:** scoring engine math, Centers thresholds, routing logic, Stage 2–4 content, fixtures.

---

## IMPLEMENTATION ORDER — TWO COMMITS

### COMMIT 1 — Question Replacement + Label Update

**Step 1.** Replace `STAGE1_QUESTIONS` in full using the approved content in Part A below. All 12 question objects, in exact order.

**Step 2.** Update the stage label in `renderStage1()`:
```javascript
// CURRENT:
`Stage 1 · ${trackLabel} · ${state.stage1Idx + 1} of 10`

// NEW:
`Stage 1 · ${trackLabel} · ${state.stage1Idx + 1} of 12`
```

**Step 3.** Run both tests:
```bash
cd ~/Developer/hive-typing-engine && node tests/run_test.js sp9
cd ~/Developer/hive-typing-engine && node tests/run_test.js so7
```

**IMPORTANT:** The fixtures were built against the old question set. They may produce different Stage 1 scores than before — this is expected and does NOT mean the implementation is wrong. What must still pass: the tests must complete without errors and produce valid JSON output. If a test throws a runtime error or produces malformed JSON, stop and report it. If the tests pass structurally but scores differ, that is expected — proceed.

**Step 4.** Commit `app/assessment.js` only.
Message: `feat: replace Stage 1 questions, update to 12-question set`

---

### COMMIT 2 — Instinct Confidence Thresholds

**Step 5.** Update instinct confidence thresholds in `computeStage1Scores()`.

Current code:
```javascript
const instinctConfidence = instinctGap >= 4 ? 'HIGH' : instinctGap >= 2 ? 'MEDIUM' : 'LOW';
```

New code:
```javascript
const instinctConfidence = instinctGap >= 6 ? 'HIGH' : instinctGap >= 3 ? 'MEDIUM' : 'LOW';
```

**Do not change** the Centers confidence thresholds — Centers question count is unchanged at 6.

**Step 6.** Run both tests again:
```bash
cd ~/Developer/hive-typing-engine && node tests/run_test.js sp9
cd ~/Developer/hive-typing-engine && node tests/run_test.js so7
```

Same note as above — structural pass is what matters here.

**Step 7.** Push all commits:
```bash
cd ~/Developer/hive-typing-engine && git push origin main
```

**Step 8.** Commit `app/assessment.js` only.
Message: `feat: update instinct confidence thresholds for 6-question instinct set`

---

## CRITICAL: MAPPING VERIFICATION

Before committing Commit 1, verify the mappings are correct by running this check mentally against each question:

- Centers questions must map `a`, `b`, `c` to `'body'`, `'heart'`, or `'head'` per the approved doc
- Instinct questions must map `a`, `b`, `c` to `'sp'`, `'so'`, or `'sx'` per the approved doc

**The approved doc uses A = Body, B = Heart, C = Head for Centers.** The current code used A = Head for some questions. Do NOT carry over any mapping from the current code — use only the approved doc mappings.

After replacing `STAGE1_QUESTIONS`, grep to confirm question count:
```bash
grep -c "type: 'centers'" app/assessment.js
grep -c "type: 'instinct'" app/assessment.js
```
Expected: **6 centers, 6 instinct**. If either returns a different number, stop and fix before committing.

---

## PART A — APPROVED STAGE1_QUESTIONS

Replace the entire `STAGE1_QUESTIONS` array with the following 12 question objects in this exact order.

**MAPPING KEY:**
- Centers: `a = 'body'`, `b = 'heart'`, `c = 'head'` (unless noted otherwise per question)
- Instincts: `a = 'sp'`, `b = 'so'`, `c = 'sx'` (unless noted otherwise per question)

---

### Q1 — PRIMARY CONCERN (Centers)

```javascript
{
  id: 'q1',
  type: 'centers',
  title: 'PRIMARY CONCERN',
  text: 'Rank the following concerns by how much they\u2019ve been a theme over the course of your life.',
  options: {
    a: 'Having a sense of control over my life and my environment.',
    b: 'Being in life-affirming relationships.',
    c: 'Knowing what might be coming next.',
  },
  mapping: { a: 'body', b: 'heart', c: 'head' },
},
```

---

### Q2 — PRIMARY FOCUS (Instincts)

```javascript
{
  id: 'q2',
  type: 'instinct',
  title: 'PRIMARY FOCUS',
  text: 'Rank the following in terms of how much of your energy and attention gets directed towards them.',
  options: {
    a: 'Material security and comfort.',
    b: 'Belonging and navigating social landscapes.',
    c: 'Intense connection \u2014 with people, ideas, or passions.',
  },
  mapping: { a: 'sp', b: 'so', c: 'sx' },
},
```

---

### Q3 — WHAT THEY WANT MOST (Centers)

```javascript
{
  id: 'q3',
  type: 'centers',
  title: 'WHAT THEY WANT MOST',
  text: 'Rank the following in terms of how they play a role in making your life worthwhile.',
  options: {
    a: 'Making an impact in my work and my world.',
    b: 'Having the admiration of others important to me.',
    c: 'Feeling reassured that things will work out.',
  },
  mapping: { a: 'body', b: 'heart', c: 'head' },
},
```

---

### Q4 — HOW YOU RECHARGE (Instincts · Scenario)

```javascript
{
  id: 'q4',
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
```

---

### Q5 — WHAT THEY WANT MOST — VALIDATION (Centers)

```javascript
{
  id: 'q5',
  type: 'centers',
  title: 'WHAT THEY WANT MOST \u2014 VALIDATION',
  text: 'Rank the following in terms of what would upset you the most.',
  options: {
    a: 'Feeling like I\u2019m being controlled by others.',
    b: 'Feeling invisible to the people who matter to me.',
    c: 'Feeling unprepared for potential adversity.',
  },
  mapping: { a: 'body', b: 'heart', c: 'head' },
},
```

*Note: Option B is flagged for future A/B testing against "Feeling like I'm not valued for who I am." Current version ships as above.*

---

### Q6 — RELATIONAL STYLE (Instincts)

```javascript
{
  id: 'q6',
  type: 'instinct',
  title: 'RELATIONAL STYLE',
  text: 'Rank the following in terms of your relational style.',
  options: {
    a: 'I prefer a small, carefully chosen circle.',
    b: 'I move naturally toward groups.',
    c: 'I\u2019m drawn to intense, deep connection.',
  },
  mapping: { a: 'sp', b: 'so', c: 'sx' },
},
```

---

### Q7 — DRIVING EMOTION (Centers)

```javascript
{
  id: 'q7',
  type: 'centers',
  title: 'DRIVING EMOTION',
  text: 'Rank the following emotions by how aware you are of their presence in your everyday life.',
  options: {
    a: 'Anger',
    b: 'Shame',
    c: 'Fear',
  },
  mapping: { a: 'body', b: 'heart', c: 'head' },
},
```

---

### Q8 — WHAT YOU MOST NEED (Instincts)

```javascript
{
  id: 'q8',
  type: 'instinct',
  title: 'WHAT YOU MOST NEED',
  text: 'Rank the following in terms of what you most need to feel okay.',
  options: {
    a: 'A sense that my basic needs and personal world are taken care of.',
    b: 'A sense of belonging and knowing where I stand in the groups that matter to me.',
    c: 'A sense of aliveness and intensity in what matters most to me.',
  },
  mapping: { a: 'sp', b: 'so', c: 'sx' },
},
```

---

### Q9 — DRIVING EMOTION — VALIDATION (Centers · Scenario)

```javascript
{
  id: 'q9',
  type: 'centers',
  title: 'DRIVING EMOTION \u2014 VALIDATION',
  text: 'You\u2019ve just received unexpected critical feedback from someone whose opinion matters to you. Rank the following by how closely each matches your immediate internal experience.',
  options: {
    a: 'I feel the urge to dig in or push back.',
    b: 'I feel sad that I haven\u2019t lived up to their expectations.',
    c: 'I worry about how I\u2019ll be impacted as a result of this feedback.',
  },
  mapping: { a: 'body', b: 'heart', c: 'head' },
},
```

---

### Q10 — LEAD WITH (Centers)

```javascript
{
  id: 'q10',
  type: 'centers',
  title: 'LEAD WITH',
  text: 'Rank the following in terms of how you tend to sense and make sense of the world.',
  options: {
    a: 'Gut instinct/intuition',
    b: 'Emotions/feelings',
    c: 'Ideas/analysis',
  },
  mapping: { a: 'body', b: 'heart', c: 'head' },
},
```

---

### Q11 — WHAT FEELS MOST THREATENING (Instincts)

```javascript
{
  id: 'q11',
  type: 'instinct',
  title: 'WHAT FEELS MOST THREATENING',
  text: 'Rank the following in terms of how threatening each would feel to your sense of wellbeing.',
  options: {
    a: 'Feeling like my personal security and resources are at risk.',
    b: 'Feeling like I no longer belong in the groups that matter to me.',
    c: 'Feeling disconnected from the people or things that make life feel alive.',
  },
  mapping: { a: 'sp', b: 'so', c: 'sx' },
},
```

---

### Q12 — YOUR FIRST MOVE (Instincts · Scenario)

```javascript
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
```

---

## PART B — SCORING CHANGES

### Instinct Confidence Thresholds

**Why this changes:** Instinct questions increase from 4 to 6. New max score per instinct = 18 (6 × 3pts). Thresholds recalibrated proportionally.

| | Old (4 questions, max 12) | New (6 questions, max 18) |
|---|---|---|
| HIGH | gap ≥ 4 | gap ≥ 6 |
| MEDIUM | gap 2–3 | gap 3–5 |
| LOW | gap 0–1 | gap 0–2 |

**In `computeStage1Scores()`**, find:
```javascript
const instinctConfidence = instinctGap >= 4 ? 'HIGH' : instinctGap >= 2 ? 'MEDIUM' : 'LOW';
```

Replace with:
```javascript
const instinctConfidence = instinctGap >= 6 ? 'HIGH' : instinctGap >= 3 ? 'MEDIUM' : 'LOW';
```

**Centers thresholds are unchanged** — do not touch them.

---

## PART C — WHAT NOT TO CHANGE

- Do not update the SP9 or SO7 test fixtures — fixture rebuild is a separate session
- Do not touch Centers confidence thresholds
- Do not touch Stage 2, 3, or 4 content
- Do not touch scoring engine math (the `pts = 4 - rank` formula)
- Do not touch routing logic

---

## VERIFICATION CHECKLIST

### After Commit 1
- [ ] `STAGE1_QUESTIONS` has exactly 12 entries
- [ ] `grep -c "type: 'centers'"` returns 6
- [ ] `grep -c "type: 'instinct'"` returns 6
- [ ] Stage label reads `of 12` in `renderStage1()`
- [ ] Centers mapping on every Centers question: `a = 'body'`, `b = 'heart'`, `c = 'head'`
- [ ] Instincts mapping on every Instinct question: `a = 'sp'`, `b = 'so'`, `c = 'sx'`
- [ ] `sp9` — structural pass (no runtime error, valid JSON output)
- [ ] `so7` — structural pass (no runtime error, valid JSON output)

### After Commit 2
- [ ] Instinct threshold line updated to `>= 6 / >= 3`
- [ ] Centers threshold line unchanged
- [ ] `sp9` — structural pass
- [ ] `so7` — structural pass
- [ ] All commits pushed to `origin/main`

---

## POST-IMPLEMENTATION MANUAL VERIFICATION (Cai to run)

After Railway deploys, run a manual session on the live app using a known profile (e.g. yourself as SP 9). Check the Stage 1 coach debug output and confirm:

- Identified Center matches expectation
- Identified Instinct matches expectation
- Three type hypotheses are plausible for the profile

This is the only reliable way to confirm mappings are correct. Fixture rebuild follows in a separate session.

---

*Hive Typing Engine — Stage 1 Implementation Brief*
*Cai Delumpa & Monique Breault — Hive, Inc. — May 2026*
*CONFIDENTIAL — For internal use only*
