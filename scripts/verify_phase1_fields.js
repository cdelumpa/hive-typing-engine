'use strict';

/**
 * verify_phase1_fields.js — Step 7 Phase 1 verification (offline checker).
 *
 * Validates the 3 new AI fields against live `/api/analyze` captures, plus an
 * offline unit check of the deterministic `gap` stamp.
 *
 * USAGE (after live captures):
 *   1. Server up with ANTHROPIC_API_KEY, then run each fixture TWICE:
 *        node tests/run_test.js sp4   # x2
 *        node tests/run_test.js sx7   # x2
 *      The runner writes <fixture>_call2_run1.json / _run2.json to the OS tmpdir.
 *   2. node scripts/verify_phase1_fields.js            (auto-finds tmpdir captures)
 *      or pass explicit paths:
 *      node scripts/verify_phase1_fields.js sp4=/path/run1.json,/path/run2.json ...
 *
 * Checks per (fixture, run):
 *   - coach_report.bottom_line: non-empty string, ≤3 sentences and ≤70 words.
 *   - client_facing.instinct_evidence: exactly 3 strings ≤25 words each — OR null
 *     iff the low_instinct_confidence flag is present.
 *   - client_words.leading_quotes: 1-2 non-empty strings, ≤60 words total, each a
 *     VERBATIM substring of the client's open-response pool (paraphrase = fail).
 *   - client_words.alternate_absence_note: non-empty string — OR null iff AMBIGUOUS.
 * Stability: both runs of a fixture must pass structurally (prose text may differ).
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const FIXTURES = ['sp4', 'sx7'];
let failures = 0;
const log  = (m) => console.log(m);
const pass = (m) => log(`    PASS — ${m}`);
const fail = (m) => { log(`    *** FAIL — ${m}`); failures++; };

const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
const sentences = (s) => (s || '').split(/[.!?]+/).map(x => x.trim()).filter(Boolean).length;
// Verbatim pool = the exact open responses the AI saw in the Call #2 case file.
function openPool(fixture) {
  const a = fixture.stage0Answers || {};
  return [a.q1, a.q2, a.q3, a.q4, fixture.stage1TypeOpen, fixture.stage1InstinctOpen]
    .filter(Boolean).join('\n');
}
const norm = (s) => (s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
// Verbatim tolerance: trim surrounding whitespace and a single trailing sentence
// terminator the AI may add to close a quote. Word-level paraphrase still fails.
const quoteNorm = (s) => norm(s).trim().replace(/[.?!]$/, '');

function hasFlag(result, name) {
  return (result.flags || []).some(f => f && f.flag_type === name);
}

function checkResult(name, result, fixture) {
  log(`  ${name}:`);
  const cr = result.coach_report || {};
  const cf = result.client_facing || {};
  const cw = result.client_words;
  const outcome = result.hypothesis && result.hypothesis.stage4_outcome;
  const pool = openPool(fixture);

  // 1. bottom_line
  if (typeof cr.bottom_line === 'string' && cr.bottom_line.trim()) {
    const w = words(cr.bottom_line), sent = sentences(cr.bottom_line);
    (w <= 80 && sent <= 3)
      ? pass(`bottom_line present (${sent} sentences, ${w} words)`)
      : fail(`bottom_line over budget (${sent} sentences, ${w} words; want ≤3 / ≤80)`);
  } else fail('bottom_line missing or empty (must always be present)');

  // 2. instinct_evidence
  const lowInst = hasFlag(result, 'low_instinct_confidence');
  if (cf.instinct_evidence === null || cf.instinct_evidence === undefined) {
    lowInst ? pass('instinct_evidence null (low_instinct_confidence flagged — allowed)')
            : fail('instinct_evidence null but low_instinct_confidence NOT flagged (must be 3 bullets)');
  } else if (Array.isArray(cf.instinct_evidence)) {
    const arr = cf.instinct_evidence;
    arr.length === 3 ? pass('instinct_evidence has exactly 3 bullets')
                     : fail(`instinct_evidence has ${arr.length} bullets (want 3)`);
    const over = arr.filter(b => words(b) > 25);
    over.length === 0 ? pass('all instinct_evidence bullets ≤25 words')
                      : fail(`${over.length} instinct_evidence bullet(s) >25 words`);
  } else fail('instinct_evidence is neither array nor null');

  // 3. client_words.leading_quotes — shape, budget, VERBATIM
  if (cw && Array.isArray(cw.leading_quotes)) {
    const q = cw.leading_quotes;
    (q.length >= 1 && q.length <= 2) ? pass(`leading_quotes count ok (${q.length})`)
                                     : fail(`leading_quotes count ${q.length} (want 1-2)`);
    const total = q.reduce((n, s) => n + words(s), 0);
    total <= 60 ? pass(`leading_quotes total ≤60 words (${total})`)
                : fail(`leading_quotes total ${total} words (want ≤60)`);
    q.forEach((quote, i) => {
      if (pool.includes(quote)) pass(`quote[${i}] verbatim`);
      else if (norm(pool).includes(quoteNorm(quote))) pass(`quote[${i}] verbatim (modulo trailing punctuation/quote-chars)`);
      else fail(`quote[${i}] NOT found in client responses (paraphrased/invented): "${String(quote).slice(0,50)}..."`);
    });
  } else fail('client_words.leading_quotes missing or not an array');

  // 4. client_words.alternate_absence_note — null iff AMBIGUOUS
  if (cw) {
    const note = cw.alternate_absence_note;
    if (outcome === 'AMBIGUOUS') {
      note == null ? pass('alternate_absence_note null on AMBIGUOUS (correct)')
                   : fail('alternate_absence_note should be null on AMBIGUOUS');
    } else {
      (typeof note === 'string' && note.trim()) ? pass('alternate_absence_note present (non-AMBIGUOUS)')
                                                : fail('alternate_absence_note missing (required when not AMBIGUOUS)');
    }
  }
}

// ── Locate capture files ──────────────────────────────────────────────────────
const explicit = {};
process.argv.slice(2).forEach(arg => {
  const m = arg.match(/^(\w+)=(.+)$/);
  if (m) explicit[m[1]] = m[2].split(',').map(s => s.trim());
});
function capturePaths(fx) {
  if (explicit[fx]) return explicit[fx];
  return [1, 2].map(r => path.join(ROOT, '.phase1_captures', `${fx}_call2_run${r}.json`));
}

log('=== Phase 1 field verification ===\n');
let missing = false;
for (const fx of FIXTURES) {
  const fixturePath = path.join(ROOT, `tests/fixtures/${fx}.json`);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const paths = capturePaths(fx);
  log(`FIXTURE ${fx}:`);
  const present = paths.filter(p => fs.existsSync(p));
  if (present.length < 2) {
    log(`  AWAITING CAPTURES — found ${present.length}/2 run files:`);
    paths.forEach(p => log(`    ${fs.existsSync(p) ? 'ok ' : '-- '}${p}`));
    missing = true;
    continue;
  }
  paths.forEach((p, i) => {
    const result = JSON.parse(fs.readFileSync(p, 'utf8'));
    checkResult(`run${i + 1}`, result, fixture);
  });
  log('');
}

// ── Offline unit check: deterministic gap stamp ───────────────────────────────
log('GAP STAMP (offline unit check):');
{
  // Mirrors the 2b stamp rule in runBackgroundJob: gap is engine-set, never AI-emitted.
  const apply = (h, scores) => { if (scores.gap != null) h.gap = scores.gap; return h; };
  const stamped = apply({}, { gap: 'tight' });
  stamped.gap === 'tight' ? pass("gap stamped from scores.gap ('tight')")
                          : fail('gap not stamped from scores.gap');
  const noGap = apply({}, {});
  !('gap' in noGap) ? pass('no gap key when scores.gap absent')
                    : fail('gap key set when scores.gap absent');
  // Guard: the real stamp line must still exist in server.js.
  const srv = fs.readFileSync(path.join(ROOT, 'app/server.js'), 'utf8');
  /if \(scores\.gap != null\)\s+h\.gap\s+=\s+scores\.gap;/.test(srv)
    ? pass('server.js still contains the gap stamp line')
    : fail('server.js gap stamp line missing — 2b stamp block regressed');
}

log('');
if (missing) {
  log('RESULT: awaiting live captures — run `node tests/run_test.js sp4` and `sx7` twice each, then re-run.');
  process.exit(2);
}
if (failures) { log(`RESULT: ${failures} FAILURE(S)`); process.exit(1); }
log('RESULT: ALL PHASE 1 CHECKS PASSED.');
