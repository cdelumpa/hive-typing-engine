// =================== STATE ===================

const state = {
  phase: 'welcome', // welcome | profile-confirm | intake | orientation | stage0 | stage1 | part1-complete | stage2 | part2-complete | stage3 | stage4 | finalopen | processing | beta-review | confirmation | results | error
  intake: { firstName: '', lastName: '', email: '', organization: '', coach: 'Cai Delumpa', client_id: null },
  finalOpenResponse: '',
  stage0Idx: 0,
  stage0Answers: {},     // { q1, q2, q3, q4 }
  stage0_signal: null,   // [{type, likelihood, rationale}, ...] from Stage 0 mini-call, or null on failure
  stage0LastSnapshot: null, // concatenated Stage 0 responses from the last mini-call; re-fire only when responses change
  ctAdjustment: null,    // { revised_hypotheses, adjustment_made, rationale } from CT mini-call, or null
  ctLastSnapshot: null,  // ct_key + Stage 1 scores from the last CT mini-call; re-fire only when these change
  stage1Idx: 0,
  stage1TypeSliders: {},     // { 1:[v×5], …, 9:[v×5] } each 0-100, or null until touched
  stage1InstinctSliders: {}, // { SP:[v×5], SO:[v×5], SX:[v×5] } each 0-100, or null until touched
  stage1TypeOpen: '',        // optional open response after the type sliders
  stage1InstinctOpen: '',    // optional open response after the instinct sliders
  stage2Idx: 0,
  stage2Answers: [],     // ['A'|'B'|'C', ...] one per Stage 2 question
  call1Result: null,     // frozen §6.3 output contract from AI Call #1, or null on failure
  call1LastSnapshot: null, // context block from the last Call #1 fire; re-fire only when it changes
  noPairwise: false,     // true when stage3_mode = none: Stage 3 skipped, flagged for AI Call #2
  stage3Mode: null,      // 'STANDARD' | 'COUNTER-TYPE' — set when entering Stage 3
  stage3Idx: 0,          // 0 or 1 (only ★ pairs reach 1)
  stage3Answers: [],     // ['A'|'A-slight'|'B-slight'|'B', ...] Q1 then optional Q2
  stage4Sequence: [],    // [{instrument, format, ...}, ...] built at Stage 4 entry
  stage4Idx: 0,
  stage4Answers: [],     // 'correct'|'alt1'|'alt2' for 3opt; 'A'|'A-slight'|'B-slight'|'B' for pairwise
  stage4Shuffles: [],    // for each 3opt question, a permutation of [0,1,2] for display order
  resultsTab: 'client',  // 'client' | 'coach' — which tab is active on the results screen
  // Computed
  scores: null,          // output of scoreStage1Profile (v2 type/instinct profile); later stages tuck results on
  apiResult: null,
  // Beta feedback (per-assessment). is_beta is set fresh from window.__hiveBootstrap on
  // every load (never persisted), gating the flag mechanic + welcome block.
  is_beta: false,
  betaFlaggedQuestions: {}, // { [statementKey]: { stageLabel, reconsidered: bool } }
};

// Initialize Stage 1 slider state. Each statement starts null (untouched) so the
// UI can distinguish "deliberately left at 50" from "never moved" for gating.
function initStage1() {
  state.stage1TypeSliders = {};
  [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((t) => { state.stage1TypeSliders[t] = [null, null, null, null, null]; });
  state.stage1InstinctSliders = {};
  ['SP', 'SO', 'SX'].forEach((i) => { state.stage1InstinctSliders[i] = [null, null, null, null, null]; });
  state.stage1TypeOpen = '';
  state.stage1InstinctOpen = '';
}

// =================== PERSISTENCE ===================

// clearResult() removes any legacy persisted-result key from localStorage. The
// synchronous in-browser results flow (save/load/render) was removed in Step 7 6b.


const RESULT_STORAGE_KEY = 'hive_typing_result_v1';

function clearResult() {
  try { localStorage.removeItem(RESULT_STORAGE_KEY); } catch (_) {}
}

// Returns a plain object of all rehydratable state fields for mid-assessment
// persistence. Excludes apiResult and resultsTab which are only valid after a
// completed API call. Includes scores because stage3Pair / stage4PathResolve
// are derived mid-assessment and are required to render Stages 3 and 4 on resume.
function getSerializableState() {
  return {
    // schemaVersion gates resume rehydration. Bumped to 2 for the v2 slider
    // Stage 1: a saved session without this (or < 2) carries the retired
    // forced-rank shape and must not be rehydrated into the slider UI.
    schemaVersion:       2,
    phase:               state.phase,
    stage0Idx:           state.stage0Idx,
    stage0Answers:       state.stage0Answers,
    stage0_signal:       state.stage0_signal,
    stage0LastSnapshot:  state.stage0LastSnapshot,
    ctAdjustment:        state.ctAdjustment,
    ctLastSnapshot:      state.ctLastSnapshot,
    stage1Idx:           state.stage1Idx,
    stage1TypeSliders:     state.stage1TypeSliders,
    stage1InstinctSliders: state.stage1InstinctSliders,
    stage1TypeOpen:        state.stage1TypeOpen,
    stage1InstinctOpen:    state.stage1InstinctOpen,
    stage2Idx:           state.stage2Idx,
    stage2Answers:       state.stage2Answers,
    call1Result:         state.call1Result,
    call1LastSnapshot:   state.call1LastSnapshot,
    noPairwise:          state.noPairwise,
    stage3Mode:          state.stage3Mode,
    stage3Idx:           state.stage3Idx,
    stage3Answers:       state.stage3Answers,
    stage4Sequence:      state.stage4Sequence,
    stage4Idx:           state.stage4Idx,
    stage4Answers:       state.stage4Answers,
    stage4Shuffles:      state.stage4Shuffles,
    finalOpenResponse:   state.finalOpenResponse,
    betaFlaggedQuestions: state.betaFlaggedQuestions,
    scores:              state.scores,
  };
}