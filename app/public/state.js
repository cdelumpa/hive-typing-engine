// =================== STATE ===================

const state = {
  phase: 'welcome', // welcome | intake | stage0 | mid-assessment-reminders | stage1 | stage2 | stage3 | stage4 | finalopen | stage1complete | processing | confirmation | results | error
  intake: { firstName: '', lastName: '', email: '', organization: '', coach: 'Cai Delumpa', client_id: null },
  finalOpenResponse: '',
  stage0Idx: 0,
  stage0Answers: {},     // { q1, q2, q3, q4 }
  stage0_signal: null,   // [{type, likelihood, rationale}, ...] from Stage 0 mini-call, or null on failure
  stage0LastSnapshot: null, // concatenated Stage 0 responses from the last mini-call; re-fire only when responses change
  stage1Idx: 0,
  stage1Rankings: [],    // [{a:rank, b:rank, c:rank}, ...] per question (1=most, 3=least)
  stage2Idx: 0,
  stage2Answers: [],     // ['A'|'B'|'C', ...] one per Stage 2 question
  stage3Mode: null,      // 'STANDARD' | 'COUNTER-TYPE' — set when entering Stage 3
  stage3Idx: 0,          // 0 or 1 (only ★ pairs reach 1)
  stage3Answers: [],     // ['A'|'A-slight'|'B-slight'|'B', ...] Q1 then optional Q2
  stage4Sequence: [],    // [{instrument, format, ...}, ...] built at Stage 4 entry
  stage4Idx: 0,
  stage4Answers: [],     // 'correct'|'alt1'|'alt2' for 3opt; 'A'|'A-slight'|'B-slight'|'B' for pairwise
  stage4Shuffles: [],    // for each 3opt question, a permutation of [0,1,2] for display order
  resultsTab: 'client',  // 'client' | 'coach' — which tab is active on the results screen
  // Computed
  scores: null,          // output of computeStage1Scores; Stage 2/3/4 results tucked on as .stage2/.stage3/.stage4
  apiResult: null,
};

// Initialize stage1 rankings
function initStage1() {
  state.stage1Rankings = STAGE1_QUESTIONS.map(() => ({ a: null, b: null, c: null }));
}

// =================== PERSISTENCE ===================

// Save the final result to localStorage so an accidental refresh on the
// results screen doesn't lose the report. We persist scores + apiResult +
// resultsTab (everything renderResults needs to rehydrate). Storage is
// cleared on restart / "New Analysis" / starting a fresh assessment.

const RESULT_STORAGE_KEY = 'hive_typing_result_v1';
const RESULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function saveResult() {
  if (!state.apiResult) return;
  try {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      scores: state.scores,
      apiResult: state.apiResult,
      resultsTab: state.resultsTab || 'client',
    };
    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[persistence] could not save result:', e && e.message);
  }
}

function loadResult() {
  try {
    const raw = localStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload || payload.version !== 1) { clearResult(); return false; }
    if (!payload.apiResult || !payload.scores) { clearResult(); return false; }
    if (Date.now() - (payload.savedAt || 0) > RESULT_MAX_AGE_MS) { clearResult(); return false; }
    state.scores = payload.scores;
    state.apiResult = payload.apiResult;
    state.resultsTab = payload.resultsTab || 'client';
    state.phase = 'results';
    console.log('[persistence] restored saved result from', new Date(payload.savedAt).toLocaleString());
    return true;
  } catch (e) {
    console.warn('[persistence] could not restore result:', e && e.message);
    clearResult();
    return false;
  }
}

function clearResult() {
  try { localStorage.removeItem(RESULT_STORAGE_KEY); } catch (_) {}
}