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

// =================== RESPONSES SNAPSHOT ===================

// Serializes the complete raw client response data across every stage so the
// server can persist it alongside scores_snapshot. Captures the actual answers
// (not the derived scores) so a client's assessment can be reconstructed,
// debugged, or replayed against engine changes.
function buildResponsesSnapshot() {
  const a0 = state.stage0Answers || {};
  const stage0 = { q1: a0.q1 || '', q2: a0.q2 || '', q3: a0.q3 || '', q4: a0.q4 || '' };

  // Stage 1 — preserve the canonical question ids (q1..q12) rather than array
  // indices so the structure is self-describing and resilient to reordering.
  const stage1 = {};
  STAGE1_QUESTIONS.forEach((q, idx) => {
    const r = state.stage1Rankings[idx] || { a: null, b: null, c: null };
    stage1[q.id] = { a: r.a, b: r.b, c: r.c };
  });

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
  const contextBlock = buildContextBlock(s);

  try {
    const s2 = s.stage2 || {};
    const s3 = s.stage3 || {};
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextBlock, intake: state.intake, scores: {
        head: s.head, heart: s.heart, body: s.body,
        identifiedCenter: s.identifiedCenter,
        sp: s.sp, so: s.so, sx: s.sx,
        identifiedInstinct: s.identifiedInstinct,
        sortedInstincts: s.sortedInstincts,
        // Stage 1 confidence — needed by the beta report generator
        centerGap: s.centerGap,
        centerConfidence: s.centerConfidence,
        // Stage 2 — flattened from state.scores.stage2 so it survives to scores_snapshot
        xrefPrimary: s2.xrefPrimary,
        xrefAlternative: s2.xrefAlternative,
        xrefAmbiguityAxis: s2.xrefAmbiguityAxis,
        // Stage 3 — flattened from state.scores.stage3 with `s3` prefix
        s3mode: s3.mode,
        s3pair: s3.pair,
        s3q1Result: s3.q1Result,
        s3leading: s3.leading,
        s3confidence: s3.confidence,
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

// =================== INIT ===================

initStage1();
// Load type library eagerly so it's ready when reports need to render.
loadTypeLibrary();
// If a previous result is still in localStorage (e.g. user refreshed), jump
// straight back to the results screen with their report intact.
loadResult();

// Token-based entry: server injects window.__hiveIntake when a valid token session is active.
if (window.__hiveIntake) {
  Object.assign(state.intake, window.__hiveIntake);

  // Resume flow: server injects window.__hiveSessionState when the client had
  // saved mid-assessment progress. Rehydrate all resumable fields and skip the
  // normal Stage 0 initialization so the client lands at the correct stage.
  if (window.__hiveSessionState) {
    const ss = window.__hiveSessionState;
    const rehydratable = [
      'phase', 'stage0Idx', 'stage0Answers', 'stage0_signal', 'stage0LastSnapshot',
      'ctAdjustment', 'ctLastSnapshot', 'stage1Idx', 'stage1Rankings',
      'stage2Idx', 'stage2Answers', 'stage3Mode', 'stage3Idx', 'stage3Answers',
      'stage4Sequence', 'stage4Idx', 'stage4Answers', 'stage4Shuffles', 'finalOpenResponse',
      'scores',
    ];
    rehydratable.forEach(function(key) {
      if (ss[key] !== undefined) state[key] = ss[key];
    });
  } else if (state.phase === 'welcome') {
    state.phase = 'stage0';
  }
}

render();
