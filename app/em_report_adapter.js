'use strict';

// app/em_report_adapter.js
//
// Reshapes the EM two-call output (EM Analysis + EM Report) into the SM Call #2
// api_result contract that report_prep.js / renderer.js consume — so the renderer
// pipeline stays untouched (PR8b constraint C4). The EM Report Call's output schema
// (report-prompt spec §5.1) resembles the report VIEW-MODEL, not the section-based
// api_result the renderer reads; this module bridges that gap.
//
// Mapping decisions (PR8b, confirmed):
//   R1a  coach_report.key_discriminator {leading, alternate}
//          -> coach_report.section6.pushes_back.key_distinction = "leading | alternate"
//   R1b  client_facing.instinct_personal_overlay -> client_facing.instinct_evidence (rename)
//   R1c  coach_report.alternate_callout -> preserved (unused by renderer today)
//   Unused client_facing fields (client_narrative, core_motivation_evidence,
//        stress_security_narratives, what_to_explore) -> passed through verbatim
//        into result.client_facing for future use.
//
// The score-profile hypothesis fields (type_score_profile, instinct_score_profile,
// call1_ranking, gap, stage4_outcome) are NOT set here — runBackgroundJob's existing
// step-2b stamping adds them from `scores`, identically to the SM path.

function _str(v) { return v == null ? '' : String(v); }

// EM coach_report.what_responses_revealed [{bold, bold_lead, body}] -> section2 strings
// parseable by report_prep splitLead (/^(lead)\s*[—–:]\s+(body)$/). A bolded bullet emits
// "lead — body"; the EM body includes the lead, so we strip a leading copy then rejoin.
function _revealedToStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((b) => {
    const body = _str(b && b.body).trim();
    const lead = _str(b && b.bold_lead).trim();
    if (b && b.bold && lead) {
      let rest = body;
      if (body.toLowerCase().startsWith(lead.toLowerCase())) {
        rest = body.slice(lead.length).replace(/^[\s.:—–-]+/, '').trim();
      }
      return rest ? `${lead} — ${rest}` : lead;
    }
    return body;
  }).filter(Boolean);
}

// EM debrief bullets [{bold, text}] -> array of strings (renderer debrief bullets are
// plain strings; the bold flag has no slot in the current contract — dropped, as it is
// for SM section4/5 bullets too).
function _bulletsToStrings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((b) => _str(b && b.text).trim()).filter(Boolean);
}

// adaptEmToContract(emAnalysis, emReport, contextFields) -> SM-shaped api_result object.
//   emAnalysis    = experimental_raw_analysis (EM Analysis Call output)
//   emReport      = EM Report Call output (report-prompt spec §5.1)
//   contextFields = { confirmed_type_name, alternate_candidate_name, subtype_name,
//                     dominant_instinct_name } resolved server-side (R8)
function adaptEmToContract(emAnalysis, emReport, contextFields) {
  const a = emAnalysis || {};
  const r = emReport || {};
  const cr = r.coach_report || {};
  const cf = r.client_facing || {};
  const ctx = contextFields || {};
  const deb = cr.debrief || {};
  const sub = deb.subtype || {};
  const sr = deb.stress_release || {};
  const wg = deb.wings || {};
  const kd = cr.key_discriminator || {};

  // R1a — combine both columns into the single key_distinction string the renderer reads.
  const keyDistinction = [_str(kd.leading).trim(), _str(kd.alternate).trim()].filter(Boolean).join(' | ');

  return {
    // Verdict — flat in EM analysis, nested here. Score-profile fields are added by the
    // existing step-2b stamping in runBackgroundJob (type/instinct profiles, call1_ranking,
    // gap, stage4_outcome) — do not set them here.
    hypothesis: {
      confirmed_type: a.confirmed_type ?? null,
      confirmed_type_name: ctx.confirmed_type_name || a.confirmed_type_name || null,
      confidence_level: a.confidence_level ?? null,
      dominant_instinct_hypothesis: a.dominant_instinct_hypothesis ?? null,
      leading_candidate: a.leading_candidate ?? null,
      alternate_candidate: a.alternate_candidate ?? null,
      ranking_override: typeof a.ranking_override === 'boolean' ? a.ranking_override : null,
      redirect_from_type: null,
      hypothesis_validated: null,
      third_candidate: null,
    },

    // Coach report reshaped into the section-based structure report_prep consumes.
    coach_report: {
      bottom_line: cr.bottom_line ?? null,
      section2: { what_responses_showed: _revealedToStrings(cr.what_responses_revealed) },
      section4: {
        probe: sub.question ?? null,
        how_instinct_shapes: _bulletsToStrings(sub.bullets),
        easy_to_miss: [],
        coaching_notes: [],
      },
      section5: {
        stress_probe: sr.question ?? null,
        stress_notes: _bulletsToStrings(sr.bullets),
        security_notes: [],
        probe: wg.question ?? null,
        wings_notes: _bulletsToStrings(wg.bullets),
      },
      section6: {
        pushes_back: {
          key_distinction: keyDistinction,
          alt_type_name: ctx.alternate_candidate_name || null,
        },
      },
    },

    // Client-facing: pass every EM Report field through verbatim (unused ones preserved
    // for future use), plus the instinct_evidence rename (R1b) the renderer reads.
    client_facing: Object.assign({}, cf, {
      instinct_evidence: cf.instinct_personal_overlay ?? null,
    }),

    // Top-level client_words (renderer reads here).
    client_words: {
      leading_quotes: (r.client_words && r.client_words.leading_quotes) || [],
      alternate_absence_note: (r.client_words && r.client_words.alternate_absence_note) ?? null,
    },

    flags: [],
    final_response: { present: null, classification: null },

    // Raw EM outputs preserved for audit + future report-upgrade use (R1c / unused fields).
    em_report: r,

    meta: {
      source: 'em_primary',
      em_report_prompt_version: (r.meta && r.meta.prompt_version) || null,
      em_analysis_prompt_version: (a.meta && a.meta.prompt_version) || null,
      em_report_usage: (r.meta && r.meta._usage) || null,
    },
  };
}

module.exports = { adaptEmToContract, _revealedToStrings, _bulletsToStrings };
