'use strict';

// Call #2 deterministic post-processing (extracted from runBackgroundJob, server.js
// step 2b). Stamps the deterministic hypothesis fields onto the model's verdict and
// applies the REDIRECT fixes shipped in feature/redirect-fix:
//   Defect #2  — alternate_candidate swap on a legitimate REDIRECT
//   Defect #3  — equality guard (confirmed_type === alternate_candidate collision)
//   Defect #4  — redirect_suppressed coach flag for a gap-suppressed REDIRECT
//
// This is pure, deterministic post-processing on (model result, engine scores). It is
// the unit under test in tests/redirect_logic_test.js and is replayed by the fixture
// runner (tests/run_test.js) so a Call #2 fixture sees the same output production does.
// Mutates `result` in place and returns it.
function applyCall2DeterministicStamps(result, scores, analysisMode, assessmentId) {
  scores = scores || {};

  // 2b. Stamp the deterministic hypothesis fields onto the verdict (§9.1, §10.3).
  //     The slider profile and the AI Call #1 result are ground truth; the AI does
  //     not recompute or restate them. callAPI sent them on the scores payload, so
  //     we overwrite the model's echoes with the canonical values. Only the judgment
  //     fields (confirmed_type, confirmed_type_name, confidence_level,
  //     dominant_instinct_hypothesis, redirect_from_type, hypothesis_validated) are
  //     left to the AI.
  if (result && result.hypothesis) {
    const h = result.hypothesis;
    const c1 = scores.call1Result || {};
    if (typeof scores.ranking_override === 'boolean') h.ranking_override = scores.ranking_override;
    // em_only: EM owns the type hypothesis (leading + alternate) — see _stampScoresForDryValidate.
    // For sm_only/parallel, Call #1's ranking stays authoritative — same behavior as before.
    if (analysisMode !== 'em_only' && c1.leading_candidate != null)   h.leading_candidate   = c1.leading_candidate;
    if (analysisMode !== 'em_only' && c1.alternate_candidate != null) h.alternate_candidate = c1.alternate_candidate;
    if (c1.third_candidate != null)     h.third_candidate     = c1.third_candidate;
    // em_only: keep EM's em_ranking (adapter-set) for the coach chart unless EM provided none;
    // SM/parallel always overwrite the model's echoed ranking with the canonical Call #1 ranking.
    if (Array.isArray(c1.ranking) && (analysisMode !== 'em_only' || !(Array.isArray(h.call1_ranking) && h.call1_ranking.length))) h.call1_ranking = c1.ranking;
    if (scores.typeProfile)             h.type_score_profile     = scores.typeProfile;
    if (scores.instinctProfile)         h.instinct_score_profile = scores.instinctProfile;
    if (scores.stage4 && scores.stage4.outcome) h.stage4_outcome  = scores.stage4.outcome;
    // Step 7: stamp the deterministic Stage-1 coherence gap (tight/medium/wide) so the
    // prep layer can derive near_tie = (gap === 'tight'). Engine-set; the AI never emits it.
    if (scores.gap != null)             h.gap                    = scores.gap;

    // Defect #2 — REDIRECT swap. On a REDIRECT the model set confirmed_type to the
    // (former) alternate and redirect_from_type to the displaced original leader. The
    // alternate_candidate stamp above re-asserted Call #1's position-2 type, which on a
    // REDIRECT is exactly the type just confirmed — leaving confirmed_type ===
    // alternate_candidate. Move the displaced leader into alternate_candidate so the
    // alternate is a genuine competing hypothesis again. (em_only never redirects —
    // its adapter hard-sets redirect_from_type=null — so this is inert on that path.)
    if (h.stage4_outcome === 'REDIRECT' && h.redirect_from_type != null
        && h.redirect_from_type !== h.confirmed_type) {
      h.alternate_candidate = h.redirect_from_type;
    }

    // Defect #3 — equality guard (backstop). After the swap, confirmed_type must never
    // equal alternate_candidate. If it still does, recover from redirect_from_type when
    // possible; otherwise flag the collision for admin review. Never pass a collided
    // result through silently — but do not hard-stop: the client still gets a report.
    if (h.confirmed_type != null && h.confirmed_type === h.alternate_candidate) {
      console.error(`[collision] assessment #${assessmentId}: confirmed_type === alternate_candidate (Type ${h.confirmed_type}); redirect_from_type=${h.redirect_from_type}, outcome=${h.stage4_outcome}`);
      if (h.redirect_from_type != null && h.redirect_from_type !== h.confirmed_type) {
        h.alternate_candidate = h.redirect_from_type;
      } else {
        result.collision_flag = true;
        result.flags = Array.isArray(result.flags) ? result.flags : [];
        result.flags.push({
          flag_type: 'engine_collision',
          description: 'confirmed_type equalled alternate_candidate; no clean recovery. Flagged for review.',
        });
      }
    }

    // Defect #4 — coach note for a suppressed REDIRECT. computeStage4Scores downgraded a
    // wide-gap REDIRECT to CONFIRMED_WITH_NOTE upstream, so the model never saw a REDIRECT
    // and confirmed the leading type normally. Surface the reason to the coach as an
    // engine-authored flag (renders cleanly; not in renderer's confusion-flag set).
    if (scores.stage4 && scores.stage4.redirectSuppressed === true) {
      result.flags = Array.isArray(result.flags) ? result.flags : [];
      result.flags.push({
        flag_type: 'redirect_suppressed',
        description: 'Stage 4 movement evidence pointed toward the alternate type, but the coherence gap between the leading and alternate hypotheses is large enough that the redirect has been suppressed. The leading type hypothesis is retained. The coach should explore the Stage 4 movement pattern in the debrief.',
      });
    }
  }

  return result;
}

module.exports = { applyCall2DeterministicStamps };
