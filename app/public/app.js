// =================== STAGE 0 MINI-CALL ===================

// Concatenates the four Stage 0 responses into a single string used to decide
// whether the cached signal is still aligned with the client's current answers.
// A simple string compare is enough — we only need to detect change, not collisions.
function stage0Snapshot() {
  const a = state.stage0Answers || {};
  return ['q1', 'q2', 'q3', 'q4'].map(k => (a[k] || '').trim()).join('');
}

// Fires from the Mid-Assessment Reminders screen. Runs in the background — never
// blocks the UI, and a failure leaves state.stage0_signal null so the final API
// call simply omits the Stage 0 Language Analysis block. Skips the call when
// the Stage 0 responses haven't changed since the previous fire; re-fires (and
// overwrites the stored signal + DB row) when any answer has been edited.
async function fireStage0MiniCall() {
  const snapshot = stage0Snapshot();
  if (state.stage0LastSnapshot !== null && snapshot === state.stage0LastSnapshot) {
    console.log('[stage0-signal] responses unchanged — skipping re-fire');
    return;
  }

  const a = state.stage0Answers || {};
  const clientId = (state.intake && state.intake.client_id) || null;

  // Record the snapshot up-front so an in-flight call doesn't get launched a
  // second time if the user toggles back into the screen mid-request.
  state.stage0LastSnapshot = snapshot;

  try {
    const res = await fetch('/api/stage0-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, stage0_answers: { q1: a.q1, q2: a.q2, q3: a.q3, q4: a.q4 } }),
    });
    const data = await res.json();
    if (data && data.ok && Array.isArray(data.signal) && data.signal.length > 0) {
      state.stage0_signal = data.signal;
      console.log('[stage0-signal] received', data.signal);
    } else {
      state.stage0_signal = null;
      console.warn('[stage0-signal] no signal returned');
    }
  } catch (err) {
    state.stage0_signal = null;
    console.error('[stage0-signal] request failed:', err && err.message);
  }
}

// =================== CT MINI-CALL ===================

// Snapshot string for the CT mini-call: ct_key plus the six Stage 1 totals.
// We re-fire whenever any of these change so an edit-and-return from Stage 2
// doesn't reuse a stale adjustment.
function ctSnapshot() {
  const s = state.scores || {};
  return [
    s.counterTypeKey || '',
    s.body, s.heart, s.head,
    s.sp, s.so, s.sx,
  ].join('|');
}

// Fires from the 'ct-analyzing' transition screen. Returns a promise that
// resolves when the call completes (success or failure) — the caller races it
// against an 8-second timeout. When adjustment_made is true the revised
// hypothesis list overwrites state.scores.typeHypotheses for downstream stages.
// Snapshot-guarded: if the current ct_key + Stage 1 scores match the last
// fire's snapshot, we skip the network call and reuse the cached adjustment.
async function fireCtMiniCall() {
  const s = state.scores;
  if (!s || s.counterTypeFlag !== 'YES') return;

  const snapshot = ctSnapshot();
  if (state.ctLastSnapshot !== null && snapshot === state.ctLastSnapshot) {
    console.log('[ct-adjustment] snapshot unchanged — skipping re-fire');
    return;
  }

  // Record the snapshot up-front so a re-entry mid-flight doesn't double-fire.
  state.ctLastSnapshot = snapshot;

  const clientId = (state.intake && state.intake.client_id) || null;
  const payload = {
    client_id: clientId,
    stage0_signal: state.stage0_signal || null,
    stage1_scores: {
      body: s.body, heart: s.heart, head: s.head,
      sp: s.sp, so: s.so, sx: s.sx,
    },
    ct_key: s.counterTypeKey,
  };

  try {
    const res = await fetch('/api/ct-adjustment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data && data.ok && data.adjustment) {
      state.ctAdjustment = data.adjustment;
      if (data.adjustment.adjustment_made && Array.isArray(data.adjustment.revised_hypotheses)) {
        state.scores.typeHypotheses = data.adjustment.revised_hypotheses.slice(0, 3);
        console.log('[ct-adjustment] revised hypotheses applied:', state.scores.typeHypotheses);
      } else {
        console.log('[ct-adjustment] no adjustment made — keeping original hypotheses');
      }
    } else {
      state.ctAdjustment = null;
      console.warn('[ct-adjustment] no adjustment returned');
    }
  } catch (err) {
    state.ctAdjustment = null;
    console.error('[ct-adjustment] request failed:', err && err.message);
  }
}

// =================== AI CALL #1 (KEYSTONE) ===================

// Fires from the 'call1-analyzing' transition screen after Stage 2. Sends the
// §6.2 evidence context block to the server, which runs the reasoning call and
// returns the frozen §6.3 contract. The parsed result is stored on
// state.call1Result (mirrored into session_state by getSerializableState) and
// persisted server-side to clients.call1_result. Snapshot-guarded on the
// context block so an edit-and-return from Stage 2 re-fires, but a plain
// re-entry with unchanged answers reuses the cached result.
async function fireCall1() {
  const s = state.scores;
  if (!s) return;

  const contextBlock = buildContextBlock(s);
  if (state.call1LastSnapshot !== null && contextBlock === state.call1LastSnapshot && state.call1Result) {
    console.log('[call1] inputs unchanged — skipping re-fire');
    return;
  }

  // Record the snapshot up-front so a re-entry mid-flight doesn't double-fire.
  state.call1LastSnapshot = contextBlock;
  const clientId = (state.intake && state.intake.client_id) || null;

  try {
    const res = await fetch('/api/call1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, contextBlock }),
    });
    const data = await res.json();
    if (data && data.ok && data.result) {
      state.call1Result = data.result;
      console.log('[call1] received', data.result);
    } else {
      state.call1Result = null;
      console.warn('[call1] no result returned');
    }
  } catch (err) {
    state.call1Result = null;
    console.error('[call1] request failed:', err && err.message);
  }
}

// =================== RESPONSES SNAPSHOT ===================

// Serializes the complete raw client response data across every stage so the
// server can persist it alongside scores_snapshot. Captures the actual answers
// (not the derived scores) so a client's assessment can be reconstructed,
// debugged, or replayed against engine changes.
function buildResponsesSnapshot() {
  const a0 = state.stage0Answers || {};
  const stage0 = { q1: a0.q1 || '', q2: a0.q2 || '', q3: a0.q3 || '', q4: a0.q4 || '' };

  // Stage 1 (v2) — raw slider values keyed by statement id (self-describing),
  // the two optional open responses, and the scored profile. Keying by statement
  // id keeps the snapshot resilient to screen reordering and decoupled from the
  // per-type array indexing used internally.
  const typeSliders = {};
  Object.keys(STAGE1_TYPE_STATEMENTS).forEach((t) => {
    const arr = (state.stage1TypeSliders && state.stage1TypeSliders[t]) || [];
    STAGE1_TYPE_STATEMENTS[t].forEach((st, idx) => {
      typeSliders[st.id] = arr[idx] != null ? arr[idx] : null;
    });
  });
  const instinctSliders = {};
  Object.keys(STAGE1_INSTINCT_STATEMENTS).forEach((inst) => {
    const arr = (state.stage1InstinctSliders && state.stage1InstinctSliders[inst]) || [];
    STAGE1_INSTINCT_STATEMENTS[inst].forEach((st, idx) => {
      instinctSliders[st.id] = arr[idx] != null ? arr[idx] : null;
    });
  });
  const sc = state.scores || {};
  const stage1 = {
    typeSliders,
    instinctSliders,
    typeOpen: state.stage1TypeOpen || '',
    instinctOpen: state.stage1InstinctOpen || '',
    profile: sc.typeProfile ? {
      typeProfile: sc.typeProfile,
      instinctProfile: sc.instinctProfile,
      leadingType: sc.leadingType,
      alternateType: sc.alternateType,
      gap: sc.gap,
      highAmbiguity: sc.highAmbiguity,
      dominantInstinct: sc.dominantInstinct,
    } : null,
  };

  // Stage 2 — three single-select answers ('A' | 'B' | 'C').
  const s2a = state.stage2Answers || [];
  const stage2 = { q1: s2a[0] || null, q2: s2a[1] || null, q3: s2a[2] || null };

  // Stage 3 — normalize the internal 4-way encoding ('A'|'A-slight'|'B-slight'|'B')
  // to the spec's 'a'|'both_a'|'both_b'|'b' vocabulary. Q2 fires only on high-
  // ambiguity standard pairs; null otherwise.
  const s3map = { 'A': 'a', 'A-slight': 'both_a', 'B-slight': 'both_b', 'B': 'b' };
  const s3a = state.stage3Answers || [];
  const stage3 = {
    q1: s3a[0] ? (s3map[s3a[0]] || s3a[0]) : null,
    q2: s3a[1] ? (s3map[s3a[1]] || s3a[1]) : null,
  };

  // Stage 4 — sequence drives which slot is stress/security/habit. The raw
  // answer is preserved verbatim — 'correct'|'alt1'|'alt2' for 3opt and
  // 'A'|'A-slight'|'B-slight'|'B' for pairwise / ct-pairwise — so the format
  // is recoverable from the answer plus the slot metadata. Habit is null when
  // it didn't fire.
  const seq = state.stage4Sequence || [];
  const s4a = state.stage4Answers || [];
  const stage4 = { stress: null, security: null, habit: null };
  seq.forEach((slot, idx) => {
    const ans = s4a[idx];
    if (ans != null && slot && stage4[slot.instrument] !== undefined) {
      stage4[slot.instrument] = ans;
    }
  });

  const finalQuestion = (state.finalOpenResponse && state.finalOpenResponse.trim())
    ? state.finalOpenResponse
    : null;

  return { stage0, stage1, stage2, stage3, stage4, finalQuestion };
}

// =================== API CALL ===================

async function callAPI() {
  // Ensure type library is loaded before rendering reports
  await loadTypeLibrary();

  const s = state.scores;
  // AI Call #2 case file (§9.1). buildCall2Context throws loudly if call1Result /
  // scores / stage4 are missing — a broken-flow signal, not a degrade case.
  const contextBlock = buildCall2Context(s);

  try {
    // ranking_override is deterministic ground truth (§10.3). Computed here from
    // the canonical slider leader (s.leadingType) vs the Call #1 leader; sent as a
    // payload field and server-stamped onto hypothesis.ranking_override so the
    // stored value is never the AI's restatement.
    const ro = rankingOverrideInfo(s);
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextBlock, intake: state.intake, scores: {
        // Stage 1 — v2 raw profile
        typeProfile: s.typeProfile,
        instinctProfile: s.instinctProfile,
        leadingType: s.leadingType,
        alternateType: s.alternateType,
        gap: s.gap,
        highAmbiguity: s.highAmbiguity,
        dominantInstinct: s.dominantInstinct,
        // AI Call #1 frozen §6.3 contract
        call1Result: state.call1Result,
        // Stage 3 lean + Stage 4 evidence/outcome (v2 shapes)
        stage3: s.stage3,
        stage4: s.stage4,
        // Deterministic ranking_override (+ leaders for logging)
        ranking_override: ro.override,
        sliderLeader: ro.sliderLeader,
        call1Leader: ro.call1Leader,
      }, finalOpenResponse: state.finalOpenResponse || '', client_id: state.intake.client_id || null,
      responses_snapshot: buildResponsesSnapshot() }),
    });

    const data = await res.json();

    if (data.ok && data.status === 'processing') {
      // Background processing confirmed — show confirmation screen immediately
      state.phase = 'confirmation';
      render();
      return;
    } else {
      state.phase = 'error';
    }
  } catch (err) {
    console.error('API error:', err);
    state.phase = 'error';
  }

  render();
}
// =================== SESSION SAVE ===================

async function saveSessionState() {
  const token = state.intake && state.intake.token;
  if (!token) return;
  try {
    await fetch(`/assessment/${encodeURIComponent(token)}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionState: getSerializableState() }),
    });
  } catch (e) {
    // silent fail — save is best-effort
  }
}

// Commit the assessment to in_progress (Decision D). Fired once from the Welcome
// "Start Assessment" click so Save works on the profile-confirm / intake screens
// and the token's used_at is stamped. Best-effort and idempotent — the server
// also no-ops a repeat begin.
async function beginAssessment() {
  const token = state.intake && state.intake.token;
  if (!token || state._begun) return;
  state._begun = true;
  try {
    await fetch(`/assessment/${encodeURIComponent(token)}/begin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch (e) {
    // best-effort — status flip is server-authoritative
  }
}

// Persist edited intake fields to the client record (§0B edit flow). Best-effort;
// the running session already holds the values in state.intake.
async function persistProfile() {
  const token = state.intake && state.intake.token;
  if (!token) return;
  const i = state.intake;
  try {
    await fetch(`/assessment/${encodeURIComponent(token)}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: i.firstName,
        last_name: i.lastName,
        email: i.email,
        organization: i.organization || null,
        coach: i.coach || null,
      }),
    });
  } catch (e) {
    // silent fail — best-effort
  }
}

// =================== INIT ===================

initStage1();
// Load type library eagerly so it's ready when reports need to render.
loadTypeLibrary();

// Token-based entry: server injects window.__hiveIntake when a valid token session is active.
if (window.__hiveIntake) {
  Object.assign(state.intake, window.__hiveIntake);

  // Resume flow: server injects window.__hiveSessionState when the client had
  // saved mid-assessment progress. Rehydrate all resumable fields and skip the
  // normal Stage 0 initialization so the client lands at the correct stage.
  if (window.__hiveSessionState) {
    const ss = window.__hiveSessionState;
    if (!ss.schemaVersion || ss.schemaVersion < 2) {
      // Stale pre-v2 session: it carries the retired forced-rank Stage 1 shape
      // (stage1Rankings), which is incompatible with the v2 slider UI. Don't try
      // to coerce it. Preserve only Stage 0, reset Stage 1, and restart Stage 1
      // with a notice.
      if (ss.stage0Answers) state.stage0Answers = ss.stage0Answers;
      if (ss.stage0Idx !== undefined) state.stage0Idx = ss.stage0Idx;
      initStage1();
      state.phase = 'stage1';
      state.stage1Idx = 0;
      state._stage1StaleNotice = true;
    } else {
      const rehydratable = [
        'phase', 'stage0Idx', 'stage0Answers', 'stage0_signal', 'stage0LastSnapshot',
        'ctAdjustment', 'ctLastSnapshot', 'stage1Idx',
        'stage1TypeSliders', 'stage1InstinctSliders', 'stage1TypeOpen', 'stage1InstinctOpen',
        'stage2Idx', 'stage2Answers', 'call1Result', 'call1LastSnapshot', 'noPairwise',
        'stage3Mode', 'stage3Idx', 'stage3Answers',
        'stage4Sequence', 'stage4Idx', 'stage4Answers', 'stage4Shuffles', 'finalOpenResponse',
        'scores',
      ];
      rehydratable.forEach(function(key) {
        if (ss[key] !== undefined) state[key] = ss[key];
      });
    }
  }
  // Fresh (non-resume) token entry: the SPA now owns the full pre-assessment flow
  // (Welcome → profile-confirm/intake → orientation → Stage 0), so leave the phase
  // at the default 'welcome'. The Welcome "Start" handler reads window.__hiveBootstrap.route
  // to choose profile-confirm vs intake.
}

render();
