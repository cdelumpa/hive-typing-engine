/* =============================================================================
 * extract_question_bank.js
 *
 * Extracts every client-facing question / option / prompt string from the live
 * assessment by eval-loading the data constants directly out of
 * app/public/assessment.js (so the 60 Stage-1 slider statements + the Stage-2/3
 * banks are byte-for-byte faithful — no hand transcription), then emits a single
 * JSON blob (with source line numbers) for the python-docx builder to format.
 *
 * Mechanism: assessment.js declares its data as top-level `const`s and only runs
 * two side-effect-free validators at load (validateStage1Statements,
 * validateStage3Bank). We wrap the whole source in a Function so those `const`s
 * live in the function scope, pass browser globals (document/window/state/...) as
 * stub params so the file's later render-fn *definitions* don't trip Reference
 * errors, and append a `return {...}` epilogue in the SAME scope to hand the
 * consts back out.
 *
 * Prose UI copy (loading / completion / error / framing) lives inside template
 * literals in render functions, not in data consts, so those few strings are
 * encoded here verbatim and line-located against the source.
 * ===========================================================================*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_PATH = path.join(ROOT, 'app', 'public', 'assessment.js');
const OUT_PATH = path.join(ROOT, 'scripts', '.question_bank_data.json');

const src = fs.readFileSync(SRC_PATH, 'utf8');

// ---- line lookup ----------------------------------------------------------
// Decode \uXXXX escapes per-line (line count unchanged) so needles carrying real
// curly quotes / em-dashes match source lines that use the escaped form.
const decodeEscapes = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const decLines = src.split('\n').map(decodeEscapes);
// Find the line of a needle, optionally restricting the search to [fromLine, toLine]
// (1-based, inclusive). The bound matters because the Stage-4 banks intentionally
// reuse identical canonical sentences across instruments/types, so an unbounded
// first-match would point at the wrong (earlier, identical) row.
function lineOf(needle, fromLine, toLine) {
  if (!needle) return null;
  const lo = fromLine ? fromLine - 1 : 0;
  const hi = toLine ? Math.min(toLine, decLines.length) : decLines.length;
  for (const len of [60, 40, 25, 15]) {
    const n = needle.slice(0, len);
    for (let i = lo; i < hi; i++) {
      if (decLines[i].includes(n)) return i + 1;
    }
  }
  return null;
}
// 1-based line of a `const NAME = ` declaration (exact, to disambiguate
// STAGE4_STRESS from STAGE4_STRESS_STEM).
function constLine(decl) {
  for (let i = 0; i < decLines.length; i++) {
    if (decLines[i].startsWith('const ' + decl)) return i + 1;
  }
  return null;
}
// 1-based line of an object key (`  3: [` or `  'SO-7': {`) within [start, end].
function blockLine(start, end, keyLiteral) {
  for (let i = start - 1; i < Math.min(end, decLines.length); i++) {
    if (decLines[i].trimStart().startsWith(keyLiteral)) return i + 1;
  }
  return start;
}

// ---- eval-extract the data consts -----------------------------------------
const stub = () => undefined;
const docStub = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: stub };
const winStub = { addEventListener: stub, removeEventListener: stub, scrollTo: stub, location: {} };

const epilogue = `
;return {
  STAGE0_QUESTIONS,
  STAGE1_TYPE_STATEMENTS, STAGE1_INSTINCT_STATEMENTS,
  STAGE1_TYPE_SCREEN_ORDER, STAGE1_INSTINCT_ORDER,
  STAGE2_QUESTIONS, STAGE2_FRAMEWORK_TYPES, STAGE2_BUCKET_LABELS, STAGE2_FRAMEWORK_LABELS,
  STAGE3_Q1_STEM, STAGE3_Q2_STEM, STAGE3_CORE_MOTIVATIONS, STAGE3_Q2_PAIRS, STAGE3_CT_COMPARATIVES,
  STAGE4_STRESS_STEM, STAGE4_SECURITY_STEM, STAGE4_HABIT_STEM,
  STAGE4_STRESS, STAGE4_SECURITY, STAGE4_HABIT, STAGE4_CT_COMPARATIVE,
  TYPE_NAMES
};`;

let data;
try {
  // eslint-disable-next-line no-new-func
  const fn = new Function('document', 'window', 'state', 'navigator', 'location', 'fetch', 'console', src + epilogue);
  data = fn(docStub, winStub, {}, {}, {}, stub, console);
} catch (e) {
  console.error('Eval extraction failed:', e);
  process.exit(1);
}

// ---- prose UI copy (verbatim from render functions) -----------------------
const prose = {
  welcomeHeading: 'Discover your Enneagram type.',
  welcomeBody: [
    'This assessment guides you through a series of questions about how you experience the world, what drives you, and what matters most to you. There are no right or wrong answers — simply respond as honestly as you can.',
    'The process takes about 15–20 minutes. Find a quiet moment and go with your first instinct.',
  ],
  midIntro: 'Great work — you’ve completed the first part of the assessment. If you want to review or edit your responses, hit the “Go Back” button. Otherwise, here are a few tips to help you complete the rest of the assessment:',
  midBullets: [
    'Answer the questions in the context of your life in general and try not to confine your answers to your work life only.',
    'Choose a response that applies to the arc of your life, rather than answering only from what is true in the current moment. If you get stuck on a question, recall how your 25-year-old self might respond to the questions.',
    'Try to complete the assessment in one sitting without interruptions.',
    'From here it should take you no longer than 20–25 minutes. If it’s taking longer, that could mean you’re overthinking things. Trust your gut when this happens.',
    'Now, take a deep breath, hit “Continue” and have fun!',
  ],
  typeOpenPrompt: 'Our core motivations are often hard to pin down. If there’s something about what drives you that the previous statements didn’t capture, add it here.',
  instinctOpenPrompt: 'Instinct patterns can be subtle. If there’s something about where your attention and energy naturally go that the statements didn’t quite land on, add it here.',
  finalOpenQuestion: 'Is there anything about how you experience the world — what drives you, what you tend to avoid, or what you’ve learned about yourself — that the assessment didn’t quite capture?',
  finalOpenNote: 'Optional — skip if nothing comes to mind.',
  ctHeading: 'Analyzing your responses…',
  ctSub: 'Thanks for your patience — we’re preparing your next set of questions.',
  call1Heading: 'Analyzing your responses…',
  call1Sub: 'Thanks for your patience — we’re weighing everything you’ve told us.',
  call1DoneHeading: 'Analysis complete',
  call1DoneSub: 'Your next set of questions is being prepared.',
  processingHeading: 'Preparing your results…',
  processingSub: 'This usually takes about 60 seconds. Please keep this window open.',
  confirmationHeading: 'Thank you, {firstName}.',
  confirmationBody1: 'Your Hive Enneagram Report is on its way.',
  confirmationBody2: 'You’ll receive an email at {email} shortly with your results attached. If it doesn’t arrive within a few minutes, please check your spam or junk folder.',
  errorHeading: 'Something went wrong',
  errorText: 'The analysis couldn’t complete just now. Your responses are still saved — you can try again, and if the problem persists we’ll email your results within 24 hours.',
  fourWayLabels: ['Person A', 'Person B', 'Both, but more A', 'Both, but more B'],
};

// ---- build line-number lookup map -----------------------------------------
const lines = {};
data.STAGE0_QUESTIONS.forEach((q) => { lines['stage0:' + q.id] = lineOf(q.text); });
Object.keys(data.STAGE1_TYPE_STATEMENTS).forEach((t) => {
  data.STAGE1_TYPE_STATEMENTS[t].forEach((s) => { lines['type:' + s.id] = lineOf(s.text); });
});
Object.keys(data.STAGE1_INSTINCT_STATEMENTS).forEach((inst) => {
  data.STAGE1_INSTINCT_STATEMENTS[inst].forEach((s) => { lines['instinct:' + s.id] = lineOf(s.text); });
});
data.STAGE2_QUESTIONS.forEach((q) => { lines['stage2:' + q.id] = lineOf(q.text); });
Object.keys(data.STAGE3_CORE_MOTIVATIONS).forEach((t) => { lines['motivation:' + t] = lineOf(data.STAGE3_CORE_MOTIVATIONS[t]); });
Object.keys(data.STAGE3_Q2_PAIRS).forEach((k) => { lines['q2pair:' + k] = lineOf(data.STAGE3_Q2_PAIRS[k].personA); });
Object.keys(data.STAGE3_CT_COMPARATIVES).forEach((k) => { lines['ctpair:' + k] = lineOf(data.STAGE3_CT_COMPARATIVES[k].personA); });
lines['stage3:q1stem'] = lineOf(data.STAGE3_Q1_STEM);
lines['stage3:q2stem'] = lineOf(data.STAGE3_Q2_STEM);
// Stage 4 — bound each lookup to its own const's line span so duplicate canonical
// sentences (reused across instruments/types) resolve to the correct row.
lines['stage4:stressStem'] = lineOf(data.STAGE4_STRESS_STEM);
lines['stage4:securityStem'] = lineOf(data.STAGE4_SECURITY_STEM);
lines['stage4:habitStem'] = lineOf(data.STAGE4_HABIT_STEM);
const s4spans = {
  STRESS: [constLine('STAGE4_STRESS = '), constLine('STAGE4_SECURITY = ')],
  SECURITY: [constLine('STAGE4_SECURITY = '), constLine('STAGE4_HABIT = ')],
  HABIT: [constLine('STAGE4_HABIT = '), constLine('STAGE4_CT_COMPARATIVE = ')],
  CT: [constLine('STAGE4_CT_COMPARATIVE = '), constLine('TYPE_NAMES = ')],
};
Object.keys(data.STAGE4_STRESS).forEach((t) => {
  const bl = blockLine(s4spans.STRESS[0], s4spans.STRESS[1], t + ': [');
  lines['stress:' + t] = lineOf(data.STAGE4_STRESS[t][0], bl, s4spans.STRESS[1]);
});
Object.keys(data.STAGE4_SECURITY).forEach((t) => {
  const bl = blockLine(s4spans.SECURITY[0], s4spans.SECURITY[1], t + ': [');
  lines['security:' + t] = lineOf(data.STAGE4_SECURITY[t][0], bl, s4spans.SECURITY[1]);
});
Object.keys(data.STAGE4_HABIT).forEach((t) => {
  const bl = blockLine(s4spans.HABIT[0], s4spans.HABIT[1], t + ': [');
  lines['habit:' + t] = lineOf(data.STAGE4_HABIT[t][0], bl, s4spans.HABIT[1]);
});
Object.keys(data.STAGE4_CT_COMPARATIVE).forEach((k) => {
  const bl = blockLine(s4spans.CT[0], s4spans.CT[1], "'" + k + "':");
  lines['s4ct:' + k] = lineOf(data.STAGE4_CT_COMPARATIVE[k].stress.personA, bl, s4spans.CT[1]);
});
// prose
lines['prose:welcomeHeading'] = lineOf('Discover your');
lines['prose:welcomeBody'] = lineOf('This assessment guides you');
lines['prose:mid'] = lineOf('Great work');
lines['prose:typeOpenPrompt'] = lineOf('Our core motivations are often hard to pin down');
lines['prose:instinctOpenPrompt'] = lineOf('Instinct patterns can be subtle');
lines['prose:finalOpenQuestion'] = lineOf('Is there anything about how you experience the world');
lines['prose:ct'] = lineOf('we’re preparing your next set of questions');
lines['prose:call1'] = lineOf('we’re weighing everything you’ve told us');
lines['prose:call1Done'] = lineOf('Analysis complete');
lines['prose:processing'] = lineOf('Preparing your results');
lines['prose:confirmation'] = lineOf('Your Hive Enneagram Report is on its way');
lines['prose:error'] = lineOf('Something went wrong');
lines['prose:fourWay'] = lineOf('Both, but more A');

const out = {
  generatedFrom: 'app/public/assessment.js',
  data,
  prose,
  lines,
};
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
console.log('Wrote', OUT_PATH);
console.log('  Stage 0 questions:', data.STAGE0_QUESTIONS.length);
console.log('  Stage 1 type statements:', Object.values(data.STAGE1_TYPE_STATEMENTS).reduce((a, b) => a + b.length, 0));
console.log('  Stage 1 instinct statements:', Object.values(data.STAGE1_INSTINCT_STATEMENTS).reduce((a, b) => a + b.length, 0));
console.log('  Stage 2 questions:', data.STAGE2_QUESTIONS.length);
console.log('  Stage 3 core motivations:', Object.keys(data.STAGE3_CORE_MOTIVATIONS).length);
console.log('  Stage 3 Q2 bespoke pairs:', Object.keys(data.STAGE3_Q2_PAIRS).length);
console.log('  Stage 3 CT comparatives:', Object.keys(data.STAGE3_CT_COMPARATIVES).length);
console.log('  Stage 4 stress option sets:', Object.keys(data.STAGE4_STRESS).length);
console.log('  Stage 4 security option sets:', Object.keys(data.STAGE4_SECURITY).length);
console.log('  Stage 4 habit option sets:', Object.keys(data.STAGE4_HABIT).length);
console.log('  Stage 4 CT comparatives:', Object.keys(data.STAGE4_CT_COMPARATIVE).length);
const nullLines = Object.entries(lines).filter(([, v]) => v == null).map(([k]) => k);
if (nullLines.length) console.warn('  WARNING: no line found for:', nullLines.join(', '));
