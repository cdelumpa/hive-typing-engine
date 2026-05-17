# Stage 2 Implementation Brief
## Claude Code Session — May 2026

---

## OBJECTIVE

Update Stage 2 question strings and fix one stale comment in `app/assessment.js`. This is a **low-risk string-only pass**. The framework buckets, bucket labels, scoring logic, and routing are all correct and must not be touched.

**Source of truth:** `hive_stage2_questions_revised_050326.docx` in the project knowledge.

**Targets — only these in `app/assessment.js`:**
- `STAGE2_QUESTIONS` — update titles, stems, and option text for all 3 questions
- `buildContextBlock()` — fix one stale instinct max comment (12 → 18)

**Do not touch:** `STAGE2_FRAMEWORK_TYPES`, `STAGE2_BUCKET_LABELS`, `STAGE2_FRAMEWORK_LABELS`, scoring logic, routing, or any other stage.

---

## IMPLEMENTATION — ONE COMMIT

**Step 1.** Update `STAGE2_QUESTIONS` using the approved content in Part A below. Replace titles, stems, and option text only. The `mapping` objects are not part of `STAGE2_QUESTIONS` — do not add or change any mappings.

**Step 2.** In `buildContextBlock()`, find the comment that reads:
```
Maximum per Instinct: 12. Confidence: HIGH = gap 4+, MEDIUM = gap 2-3, LOW = gap 0-1.
```
Replace with:
```
Maximum per Instinct: 18. Confidence: HIGH = gap 6+, MEDIUM = gap 3-5, LOW = gap 0-2.
```
This comment describes the instinct scoring for the AI context block. It was written for the old 4-question instinct set and needs to reflect the new 6-question set shipped in the Stage 1 pass.

**Step 3.** Run both tests:
```bash
cd ~/Developer/hive-typing-engine && node tests/run_test.js sp9
cd ~/Developer/hive-typing-engine && node tests/run_test.js so7
```
Both must pass clean before committing.

**Step 4.** Push all commits:
```bash
cd ~/Developer/hive-typing-engine && git push origin main
```

**Step 5.** Commit `app/assessment.js` only.
Message: `feat: update Stage 2 question strings, fix instinct max comment`

---

## PART A — APPROVED STAGE2_QUESTIONS

Replace the title, text, and options for all three questions. The object structure (`id`, `type`, framework axis references) stays the same — only the human-readable strings change.

---

### Q1 — SOCIAL STANCE (Hornevian)

```javascript
{
  // id, type, mapping — unchanged
  title: 'SOCIAL STANCE',
  text: 'How do you tend to go about getting what you want or need in life?',
  options: {
    A: 'I go for what I want, knowing I can make it happen.',
    B: 'I actively attend to what\u2019s needed by the person, situation, or group.',
    C: 'I move inward where I know I\u2019ll find peace, solitude, and meaning.',
  },
},
```

---

### Q2 — CONFLICT RESPONSE (Harmonic)

```javascript
{
  // id, type, mapping — unchanged
  title: 'CONFLICT RESPONSE',
  text: 'How do you experience not getting what matters most to you?',
  options: {
    A: 'I call out what\u2019s wrong, sometimes loudly, and challenge the status quo.',
    B: 'I look on the bright side and try to make the best of the situation.',
    C: 'I switch to analysis mode and start correcting what\u2019s wrong.',
  },
},
```

---

### Q3 — LIFE THEME (Object Relations)

```javascript
{
  // id, type, mapping — unchanged
  title: 'LIFE THEME',
  text: 'Which of the following have you tended to prioritize most over the course of your life?',
  options: {
    A: 'Having a sense of connection and belonging with others.',
    B: 'Reaching toward something better, deeper, or more complete.',
    C: 'Protecting myself from intrusion, overwhelm, and control by others.',
  },
},
```

---

## PART B — CONTEXT BLOCK FIX

In `buildContextBlock()`, find and update this comment line only. Do not touch any surrounding logic.

**Find:**
```
Maximum per Instinct: 12. Confidence: HIGH = gap 4+, MEDIUM = gap 2-3, LOW = gap 0-1.
```

**Replace with:**
```
Maximum per Instinct: 18. Confidence: HIGH = gap 6+, MEDIUM = gap 3-5, LOW = gap 0-2.
```

---

## VERIFICATION CHECKLIST

- [ ] Q1 title: `'SOCIAL STANCE'`, stem: `'How do you tend to go about getting what you want or need in life?'`
- [ ] Q2 title: `'CONFLICT RESPONSE'`, stem: `'How do you experience not getting what matters most to you?'`
- [ ] Q3 title: `'LIFE THEME'`, stem: `'Which of the following have you tended to prioritize most over the course of your life?'`
- [ ] `STAGE2_FRAMEWORK_TYPES` — unchanged
- [ ] `STAGE2_BUCKET_LABELS` — unchanged
- [ ] Context block instinct max comment updated to 18
- [ ] `sp9` — PASS
- [ ] `so7` — PASS
- [ ] Committed and pushed to `origin/main`

---

## WHAT IS NOT IN SCOPE FOR THIS SESSION

- Fixture rebuild — separate session
- Stage 1, 3, or 4 content — already shipped
- Scoring logic, routing, or rendering changes
- `assessment.js` refactor — deferred until Mo's edits are complete

---

*Hive Typing Engine — Stage 2 Implementation Brief*
*Cai Delumpa & Monique Breault — Hive, Inc. — May 2026*
*CONFIDENTIAL — For internal use only*
