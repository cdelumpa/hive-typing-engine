/**
 * renderer.js — Server-side HTML rendering for Hive Enneagram reports.
 *
 * This is a Node.js mirror of the clientReportBodyHtml / coachReportBodyHtml /
 * buildClientHTML / buildCoachHTML functions that live in app/public/app.js.
 *
 * The logic is identical; the only adaptation is:
 *  - `state.scores` is passed in as a parameter instead of reading global state
 *  - `typeLibrary` is passed in as a parameter
 *  - No browser-only APIs are used (everything is pure string building)
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ---- Shared constants (mirrored from app.js) ----
const TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer',
  4: 'The Idealist', 5: 'The Observer', 6: 'The Questioner',
  7: 'The Enthusiast', 8: 'The Protector', 9: 'The Peacemaker',
};

// ---- Helpers ----
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

function renderParas(arr, style) {
  if (!arr || !Array.isArray(arr)) return '';
  const s = style || 'margin:0 0 14px;';
  return arr.map((p) => `<p style="${s}">${esc(p)}</p>`).join('');
}

function renderMultiPara(str, style) {
  if (!str) return '';
  const s = style || 'margin:0 0 14px;';
  return str
    .split(/\n\n+/)
    .map((p) => `<p style="${s}">${esc(p.trim())}</p>`)
    .filter((p) => p !== `<p style="${s}"></p>`)
    .join('');
}

// ---- Client report body HTML ----
function clientReportBodyHtml(result, typeLibrary) {
  const h = result.hypothesis;
  const cf = result.client_facing || {};
  const ambiguous = h.stage4_outcome === 'AMBIGUOUS';

  const typeName =
    (h.confirmed_type_name || '').replace(/^Type\s*\d+\s*[—–-]+\s*/i, '').trim() ||
    TYPE_NAMES[h.confirmed_type] || '';

  const tLib = (typeLibrary && typeLibrary.types && typeLibrary.types[String(h.confirmed_type)]) || {};
  const primers = (typeLibrary && typeLibrary.static_primers) || {};
  const instinctKey = (h.confirmed_instinct || '').toLowerCase();

  const SH = (title) =>
    `<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#00b1d7;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #00b1d7;">${esc(title)}</div>`;
  const SUB = (title) =>
    `<div style="font-size:10px;font-weight:700;color:#00b1d7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${esc(title)}</div>`;
  const EVIDENCE = (text) =>
    text
      ? `<p style="font-size:12px;color:#4A6070;font-style:italic;margin:0 0 14px;">In your responses: ${renderMultiPara(text, 'display:inline;')}</p>`
      : '';

  const header = ambiguous
    ? `<div style="font-size:28px;font-weight:700;color:#00b1d7;line-height:1.2;margin-bottom:12px;">A Genuinely Complex Pattern</div>`
    : `<div style="font-size:42px;font-weight:700;color:#00b1d7;line-height:1.1;margin-bottom:4px;">Type ${h.confirmed_type}</div>
       <div style="font-size:20px;color:#4A6070;margin-bottom:12px;">${esc(typeName)}</div>`;

  const noteText = ambiguous
    ? `Your responses reflect a genuinely complex pattern — one that resonates with more than one Enneagram type in meaningful ways. This isn't a limitation of the assessment; it's an honest finding about you. Rather than offering a premature hypothesis, we'd like to invite you into a conversation with your Enneagram coach or practitioner where this complexity can be explored properly.`
    : `Based on your responses, the pattern that appears most consistent with your experience is <strong>Type ${h.confirmed_type} — ${esc(typeName)}</strong>. We encourage you to hold this as a hypothesis or theory that you get to test 'in the wild'. That's the fun part. If it resonates, wonderful. If it doesn't fully fit, that's important information too. Debriefing this report with a trained Enneagram coach or practitioner like Cai or Monique is a great place to explore what fits, what doesn't, and why.`;

  const instinctLabelMap = { sp: 'Self-Preservation', sx: 'One-to-One', so: 'Social' };
  const instinctLabel = instinctLabelMap[instinctKey] || h.confirmed_instinct || '';

  const strengthsHtml = (tLib.strengths || []).map((s) =>
    `<div style="font-size:13px;margin-bottom:5px;"><span style="color:#00b1d7;font-weight:700;">+</span> ${esc(s)}</div>`
  ).join('');

  const challengesHtml = (tLib.challenges || []).map((c) =>
    `<div style="font-size:13px;margin-bottom:5px;"><span style="color:#f58527;font-weight:700;">–</span> ${esc(c)}</div>`
  ).join('');

  const tipsHtml = (tLib.development_tips || []).map((tip, i) =>
    `<div style="padding:8px 14px;margin-bottom:6px;background:#F5F9FB;border-radius:4px;font-size:13px;display:flex;gap:10px;">
       <span style="color:#00b1d7;font-weight:700;">${i + 1}.</span>
       <span>${esc(tip)}</span>
     </div>`
  ).join('');

  const patternsHtml = !ambiguous
    ? `
    ${SH('Patterns of Thinking, Feeling, and Behaving')}
    <p style="margin:0 0 14px;">Your core motivation doesn't just live in the background — it expresses itself as recognizable patterns of thinking, feeling, and behaving that show up consistently across different areas of your life.</p>
    ${SUB(`Thinking Patterns of a Type ${h.confirmed_type} — ${esc(typeName)}`)}
    ${renderParas(tLib.patterns_of_thinking)}
    ${SUB(`Feeling Patterns of a Type ${h.confirmed_type} — ${esc(typeName)}`)}
    ${renderParas(tLib.patterns_of_feeling)}
    ${SUB(`Behavior Patterns of a Type ${h.confirmed_type} — ${esc(typeName)}`)}
    ${renderParas(tLib.patterns_of_behaving)}
  `
    : '';

  const instinctBody =
    tLib.instincts && tLib.instincts[instinctKey] ? renderParas(tLib.instincts[instinctKey]) : '';

  const wingLow = tLib.wing_low || {};
  const wingHigh = tLib.wing_high || {};
  const wingsHtml = !ambiguous
    ? `
    ${SH('Wing Influence')}
    ${SUB('About Wings')}
    ${renderParas((primers.wing_primer || {}).body)}
    ${wingLow.name ? `${SUB(`${esc(wingLow.name)} — Type ${wingLow.number}`)}${renderParas(wingLow.body)}` : ''}
    ${wingHigh.name ? `${SUB(`${esc(wingHigh.name)} — Type ${wingHigh.number}`)}${renderParas(wingHigh.body)}` : ''}
  `
    : '';

  const secondaryHtml =
    cf.secondary_type_narrative && !ambiguous
      ? `
    ${SH('Secondary Type Hypothesis')}
    <p style="font-style:italic;background:#DFF0F7;padding:14px 18px;border-radius:6px;border-left:4px solid #00b1d7;color:#1A2B33;margin:0 0 14px;line-height:1.7;">${renderMultiPara(cf.secondary_type_narrative, 'margin:0 0 10px;')}</p>
  `
      : '';

  const exploreQuestions = cf.what_to_explore || [];
  const exploreHtml =
    exploreQuestions.length > 0
      ? `
    ${SH('What to Explore With Your Enneagram Coach or Practitioner')}
    <p style="color:#4A6070;margin:0 0 10px;font-size:13px;">These questions are designed to help you get the most out of your work with a coach or practitioner. Take a moment to sit with each one before your session.</p>
    ${exploreQuestions
      .map(
        (q, i) => `
      <div style="padding:8px 14px;margin-bottom:6px;background:#F5F9FB;border-radius:4px;font-size:13px;display:flex;gap:10px;">
        <span style="color:#00b1d7;font-weight:700;">${i + 1}.</span>
        <span>${esc(q)}</span>
      </div>`
      )
      .join('')}
  `
      : '';

  return `
    <div style="background:#fff;border-radius:10px;padding:36px 40px;box-shadow:0 1px 10px rgba(0,0,0,0.04);font-family:Georgia,serif;color:#1A2B33;line-height:1.6;font-size:13px;max-width:720px;margin:0 auto;">

      <!-- HEADER -->
      <div style="text-align:center;padding-bottom:24px;margin-bottom:28px;border-bottom:3px solid #00b1d7;">
        <div style="font-size:11px;color:#7A96A6;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Your Enneagram</div>
        ${header}
      </div>

      <!-- ABOUT THE ENNEAGRAM -->
      ${SH('About the Enneagram')}
      ${renderParas((primers.enneagram_intro || {}).body)}

      <!-- A NOTE ON THIS RESULT -->
      ${SH('A Note on This Result')}
      <p style="font-style:italic;margin:0 0 14px;">${noteText}</p>

      <!-- WHAT WE NOTICED ABOUT YOU -->
      ${SH('What We Noticed About You')}
      <div style="font-style:italic;background:#DFF0F7;padding:14px 18px;border-radius:6px;border-left:4px solid #00b1d7;color:#1A2B33;margin:0 0 14px;line-height:1.7;">${renderMultiPara(cf.client_narrative, 'margin:0 0 10px;')}</div>

      ${
        !ambiguous
          ? `
        <!-- YOUR TYPE AT A GLANCE -->
        ${SH('Your Type at a Glance')}
        ${tLib.how_you_see_the_world ? `${SUB('How You See the World')}<p style="margin:0 0 14px;">${esc(tLib.how_you_see_the_world)}</p>` : ''}
        ${tLib.core_motivation ? `${SUB('Core Motivation')}${renderParas(tLib.core_motivation)}` : ''}
        ${cf.core_motivation_evidence ? EVIDENCE(cf.core_motivation_evidence) : ''}

        <!-- PATTERNS -->
        ${patternsHtml}

        <!-- STRENGTHS & CHALLENGES -->
        ${
          tLib.strengths && tLib.strengths.length && tLib.challenges && tLib.challenges.length
            ? `
          <p style="margin:0 0 10px;font-size:13px;color:#1A2B33;">These patterns give rise to a distinctive set of strengths and challenges. The ones below are characteristic of Type ${h.confirmed_type} — you may recognize some more than others, and that recognition itself is useful information.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 14px;">
            <div style="background:#DFF0F7;padding:12px 16px;border-radius:6px;">
              <div style="font-size:10px;font-weight:700;color:#00b1d7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Strengths</div>
              ${strengthsHtml}
            </div>
            <div style="background:#FFF8F0;padding:12px 16px;border-radius:6px;">
              <div style="font-size:10px;font-weight:700;color:#f58527;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Challenges</div>
              ${challengesHtml}
            </div>
          </div>
        `
            : ''
        }

        <!-- DEVELOPMENT TIPS -->
        ${
          tipsHtml
            ? `
          ${SH('Development Tips')}
          <p style="color:#4A6070;margin:0 0 10px;font-size:13px;">These practices can help you leverage your strengths and address the patterns that can hold you back.</p>
          ${tipsHtml}
        `
            : ''
        }

        <!-- ABOUT THE INSTINCTS -->
        ${SH('About the Instincts')}
        ${renderParas((primers.instinct_primer || {}).body)}

        <!-- YOUR INSTINCT -->
        ${
          instinctBody
            ? `
          ${SH('Your Instinct — ' + instinctLabel)}
          ${instinctBody}
          ${cf.instinct_personal_overlay ? EVIDENCE(cf.instinct_personal_overlay) : ''}
        `
            : ''
        }

        <!-- HOW YOUR TYPE MOVES THROUGH STRESS AND EASE -->
        ${SH('How Your Type Moves Through Stress and Ease')}
        ${renderParas((primers.stress_security_primer || {}).body)}
        ${cf.stress_point_narrative ? `${SUB('Under Stress')}<p style="margin:0 0 14px;">${esc(cf.stress_point_narrative)}</p>` : ''}
        ${cf.security_point_narrative ? `${SUB('When at Ease')}<p style="margin:0 0 14px;">${esc(cf.security_point_narrative)}</p>` : ''}

        <!-- WING INFLUENCE -->
        ${wingsHtml}

        <!-- SECONDARY TYPE HYPOTHESIS (conditional) -->
        ${secondaryHtml}
      `
          : ''
      }

      <!-- WHAT TO EXPLORE -->
      ${exploreHtml}

      <!-- FOOTER -->
      <div style="margin-top:40px;padding-top:16px;border-top:2px solid #00b1d7;text-align:center;font-size:11px;color:#7A96A6;">
        Generated by the Hive Enneagram Typing Engine &nbsp;·&nbsp; © Copyright 2026, Hive, Inc. All rights reserved.
      </div>
    </div>
  `;
}

// ---- Coach report body HTML ----
function coachReportBodyHtml(result, typeLibrary, scores) {
  const h = result.hypothesis;
  const cr = result.coach_report || {};
  const flags = result.flags || [];
  const s2a = result.stage2_analysis || {};
  const s4a = result.stage4_analysis || {};
  const s0 = result.stage0_analysis || {};
  const scoresObj = scores || {};

  const typeName =
    (h.confirmed_type_name || '').replace(/^Type\s*\d+\s*[—–-]+\s*/i, '').trim() ||
    TYPE_NAMES[h.confirmed_type] || '';

  const ORANGE = '#f58527';
  const SH = (title) =>
    `<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ORANGE};margin:32px 0 12px;padding-bottom:6px;border-bottom:2px solid ${ORANGE};">${esc(title)}</div>`;
  const SUBH = (title) =>
    `<div style="font-size:10px;font-weight:700;color:${ORANGE};text-transform:uppercase;letter-spacing:0.08em;margin:18px 0 8px;">${esc(title)}</div>`;
  const PROBE = (text) =>
    text
      ? `<div style="background:#FAF6F2;padding:10px 14px;border-radius:4px;font-style:italic;color:#1A2B33;margin:6px 0;border-left:3px solid ${ORANGE};">${esc(text)}</div>`
      : '';
  const BULLETS = (arr) =>
    arr && arr.length
      ? `<ul style="margin:0 0 14px 0;padding-left:20px;">${arr.map((b) => `<li style="margin-bottom:8px;line-height:1.55;">${esc(b)}</li>`).join('')}</ul>`
      : '';
  const CALLOUT = (content, warning) => {
    const bg = warning ? '#F9E0DC' : '#FDE8D4';
    const border = warning ? '#C44530' : ORANGE;
    return `<div style="background:${bg};padding:14px 18px;border-radius:6px;border-left:4px solid ${border};margin:0 0 16px;">${content}</div>`;
  };
  const CALLOUT_TITLE = (text, warning) =>
    `<div style="font-size:12px;font-weight:700;color:${warning ? '#C44530' : ORANGE};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${esc(text)}</div>`;

  const instinctKey = (h.confirmed_instinct || '').toLowerCase();
  const instinctFull =
    { sp: 'Self-Preservation (SP)', sx: 'One-to-One (SX)', so: 'Social (SO)' }[instinctKey] ||
    h.confirmed_instinct ||
    'Unknown';
  const confLabel = (h.confidence_level || '').replace(/_/g, '-');

  const metaRow = (label, value, style) => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:1px solid #EFE8E0;">
      <span style="font-size:11px;color:#7A96A6;letter-spacing:0.05em;text-transform:uppercase;font-weight:700;">${esc(label)}</span>
      <span style="font-size:14px;color:${style || '#1A2B33'};font-weight:600;">${value}</span>
    </div>`;

  const s1 = cr.section1 || {};
  const s1a = cr.section1a || null;
  const s2 = cr.section2 || {};
  const s3 = cr.section3 || {};
  const s4 = cr.section4 || {};
  const s5 = cr.section5 || {};
  const s6 = cr.section6 || {};
  const s6a = cr.section6a || null;

  // Centers bar chart
  const centerScoreMap = {
    Body: scoresObj.body || 0,
    Heart: scoresObj.heart || 0,
    Head: scoresObj.head || 0,
  };
  const identifiedCenter = scoresObj.identifiedCenter || '';
  const totalCenter = 18;
  const centerBar = (name, score) => {
    const pct = Math.round((score / totalCenter) * 100);
    const isId = name === identifiedCenter;
    const fillClass = isId
      ? 'background:#f58527;'
      : pct >= 44
      ? 'background:#F5B988;'
      : 'background:#FBDDC2;';
    return `<div style="display:grid;grid-template-columns:160px 1fr 60px;gap:10px;align-items:center;margin-bottom:10px;font-size:13px;">
      <span style="font-weight:${isId ? '700' : '600'};color:${isId ? ORANGE : '#1A2B33'};">${esc(name)} Center${isId ? ' ●' : ''}</span>
      <div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#EFE8E0;border-radius:3px;height:14px;overflow:hidden;"><div style="${fillClass}height:100%;border-radius:3px;width:${pct}%;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div></div>
      <span style="color:#4A6070;font-size:12px;text-align:right;">${score} / ${totalCenter}</span>
    </div>`;
  };

  // Instinct bar chart
  const instinctScores = scoresObj.sortedInstincts || [];
  const instinctTotal = 12;
  const instinctBar = (name, score) => {
    const pct = Math.round((score / instinctTotal) * 100);
    const isId = name === (h.confirmed_instinct || '');
    const fillStyle = isId
      ? 'background:#f58527;'
      : pct >= 50
      ? 'background:#F5B988;'
      : 'background:#FBDDC2;';
    const label = { SP: 'Self-Preservation', SO: 'Social', SX: 'One-to-One' }[name] || name;
    return `<div style="display:grid;grid-template-columns:160px 1fr 60px;gap:10px;align-items:center;margin-bottom:10px;font-size:13px;">
      <span style="font-weight:${isId ? '700' : '600'};color:${isId ? ORANGE : '#1A2B33'};">${esc(label)}${isId ? ' ●' : ''}</span>
      <div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#EFE8E0;border-radius:3px;height:14px;overflow:hidden;"><div style="${fillStyle}height:100%;border-radius:3px;width:${pct}%;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div></div>
      <span style="color:#4A6070;font-size:12px;text-align:right;">${score} / ${instinctTotal}</span>
    </div>`;
  };

  const confusionFlagTypes = [
    'lookalike_ambiguity',
    'stage2_stage3_divergence',
    'framework_cluster_mismatch',
    'low_center_confidence',
  ];
  const hasConfusionFlags =
    flags.some((f) => confusionFlagTypes.includes(f.flag_type)) || h.stage4_outcome === 'AMBIGUOUS';
  const show6A = hasConfusionFlags && h.stage4_outcome !== 'REDIRECT' && s6a !== null;

  const typeLibData =
    (typeLibrary && typeLibrary.types && typeLibrary.types[String(h.confirmed_type)]) || {};

  const frameworkSignals = (s3.framework_signals || [])
    .map(
      (sig) => `
    ${CALLOUT(`
      ${CALLOUT_TITLE(sig.label)}
      ${BULLETS(sig.bullets)}
      ${PROBE(sig.probe)}
    `)}
  `
    )
    .join('');

  return `
    <div style="background:#fff;border-radius:10px;padding:36px 40px;box-shadow:0 1px 10px rgba(0,0,0,0.04);font-family:Georgia,serif;color:#1A2B33;line-height:1.6;font-size:13px;max-width:760px;margin:0 auto;">

      <!-- HEADER -->
      <div style="text-align:center;padding-bottom:24px;margin-bottom:28px;border-bottom:3px solid ${ORANGE};">
        <div style="font-size:11px;color:#7A96A6;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Coach Prep Report</div>
        <div style="font-size:42px;font-weight:700;color:${ORANGE};line-height:1.1;margin-bottom:4px;">Type ${h.confirmed_type} · ${h.confirmed_instinct}</div>
        <div style="font-size:20px;color:#4A6070;margin-bottom:12px;">${esc(s4.subtype_name || '')}</div>
        <span style="display:inline-block;padding:3px 12px;border-radius:20px;background:#FFF9E6;color:#A17E23;font-weight:700;font-size:11px;letter-spacing:0.05em;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${esc(confLabel)} CONFIDENCE</span>
      </div>

      <!-- HOW TO USE -->
      <p style="font-size:12px;color:#4A6070;font-style:italic;margin:0 0 20px;background:#FAF6F2;padding:12px 16px;border-radius:6px;">This report is designed as a session prep tool — organized around the debrief conversation you'll have with your client, not around how the assessment engine arrived at its hypothesis. Read Section 1 for the quick read. Use Sections 2 through 5 as a companion during the debrief itself. Section 6 offers contingency guidance depending on how the conversation unfolds.</p>

      <!-- SECTION 1 — YOUR READ -->
      ${SH('1 · Your Read on This Client')}
      <div style="background:#FAF6F2;padding:16px 20px;border-radius:6px;margin-bottom:16px;">
        ${metaRow('Primary Hypothesis', `Type ${h.confirmed_type} — ${esc(typeName)}`)}
        ${metaRow('Dominant Instinct', instinctFull)}
        ${metaRow('Confidence', confLabel, '#A17E23')}
        ${metaRow('Alternate to Hold Lightly', h.second_candidate_type ? `Type ${h.second_candidate_type} — ${esc(TYPE_NAMES[h.second_candidate_type] || '')}` : 'None identified')}
        ${metaRow('Counter-Type', h.counter_type_confirmed ? `Confirmed — ${esc(h.counter_type_combination || '')}` : 'Not flagged', h.counter_type_confirmed ? ORANGE : '#4A6070')}
      </div>

      ${SUBH('The Read')}
      <p style="margin:0 0 14px;">${esc(s1.the_read || '')}</p>
      ${SUBH('Going In')}
      ${BULLETS(s1.going_in)}

      ${
        s1a
          ? `
        <!-- SECTION 1A — COUNTER-TYPE -->
        ${SH('1A · Counter-Type Considerations')}
        ${SUBH('Why This Matters')}
        ${BULLETS(s1a.why_this_matters)}
        ${SUBH('Standard vs. Counter-Type Presentation')}
        ${BULLETS(s1a.standard_vs_counter)}
        ${SUBH('Coaching Notes')}
        ${BULLETS(s1a.coaching_notes)}
      `
          : ''
      }

      <!-- SECTION 2 — CORE MOTIVATION -->
      ${SH('2 · Debriefing Core Motivation and Worldview')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">How to present the heart of the type and connect it to their own words.</p>
      ${SUBH('The Core Pattern')}
      ${BULLETS(s2.core_pattern)}
      ${SUBH('What Their Responses Showed')}
      ${BULLETS(s2.what_responses_showed)}
      ${SUBH('Coaching Notes')}
      ${BULLETS(s2.coaching_notes)}
      ${PROBE(s2.probe)}

      <!-- SECTION 3 — PATTERNS -->
      ${SH('3 · Debriefing Patterns of Thinking, Feeling, and Behaving')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">What to expect and what to watch for as you walk through type patterns.</p>

      ${SUBH('Centers of Intelligence')}
      <div style="background:#FAF6F2;padding:14px 18px;border-radius:6px;margin-bottom:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        ${centerBar('Body', centerScoreMap.Body)}
        ${centerBar('Heart', centerScoreMap.Heart)}
        ${centerBar('Head', centerScoreMap.Head)}
      </div>

      ${SUBH('Likely to Resonate Easily')}
      ${BULLETS(typeLibData.strengths || [])}

      ${SUBH('May Take More Careful Unpacking')}
      ${BULLETS(typeLibData.challenges || [])}

      ${s3.hardest_to_see && s3.hardest_to_see.length ? `${SUBH('May Be Hardest to See')}${BULLETS(s3.hardest_to_see)}` : ''}

      ${
        frameworkSignals
          ? `
        ${SUBH('How the Client Appears to Move — The Three Framework Signals')}
        <p style="margin:0 0 14px;font-size:12px;color:#4A6070;font-style:italic;">These are cross-referenced patterns that showed up consistently in their responses. Each offers a different lens on the type — worth weaving in conversationally rather than introducing as categories.</p>
        ${frameworkSignals}
      `
          : ''
      }

      ${SUBH('Coaching Notes for This Section')}
      ${BULLETS(s3.coaching_notes)}
      ${PROBE(s3.probe)}

      <!-- SECTION 4 — INSTINCT & SUBTYPE -->
      ${SH('4 · Debriefing Instinct and Subtype')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">Their particular flavor of Type ${h.confirmed_type}, and why it matters.</p>

      ${SUBH('Instinct Ranking')}
      <div style="background:#FAF6F2;padding:14px 18px;border-radius:6px;margin-bottom:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        ${instinctScores.map(([name, score]) => instinctBar(name, score)).join('')}
      </div>

      ${s4.subtype_name ? `${SUBH(s4.subtype_name + ' — How the Instinct Shapes the Type')}` : ''}
      ${BULLETS(s4.how_instinct_shapes)}
      ${s4.easy_to_miss && s4.easy_to_miss.length ? `${SUBH('Why This Subtype Can Be Easy to Miss')}${BULLETS(s4.easy_to_miss)}` : ''}
      ${SUBH('Coaching Notes')}
      ${BULLETS(s4.coaching_notes)}
      ${PROBE(s4.probe)}

      <!-- SECTION 5 — WINGS, LINES, RESOURCES -->
      ${SH('5 · Debriefing Wings, Lines, and Resources')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">What they have available, especially under pressure.</p>

      ${SUBH('Stress Movement — Toward Type ' + (typeLibData.stress_point || ''))}
      ${BULLETS(s5.stress_notes)}
      ${PROBE(s5.stress_probe)}

      ${SUBH('Security Movement — Toward Type ' + (typeLibData.security_point || ''))}
      ${BULLETS(s5.security_notes)}
      ${PROBE(s5.security_probe)}

      ${SUBH('Wings — ' + ((typeLibData.wings || []).map((w) => 'Type ' + w).join(' and ')))}
      ${BULLETS(s5.wings_notes)}
      ${PROBE(s5.probe)}

      <!-- SECTION 6 — CONTINGENCIES -->
      ${SH('6 · If the Conversation Goes Sideways')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">What to do depending on how they receive the hypothesis.</p>

      ${CALLOUT(`
        ${CALLOUT_TITLE('If They Resonate Strongly')}
        ${BULLETS((s6.resonates_strongly || {}).bullets || [])}
        ${PROBE((s6.resonates_strongly || {}).probe || '')}
      `)}

      ${CALLOUT(
        `
        ${CALLOUT_TITLE('If They Push Back or Disagree', true)}
        ${BULLETS((s6.pushes_back || {}).bullets || [])}
        ${(s6.pushes_back || {}).alt_type_name ? `<p style="margin:8px 0 4px;font-size:12px;"><strong>Most likely alternate type:</strong> ${esc(s6.pushes_back.alt_type_name)}</p>` : ''}
        ${(s6.pushes_back || {}).key_distinction ? `<p style="margin:0 0 0;font-size:12px;font-style:italic;"><strong>Key distinguishing question:</strong> ${esc(s6.pushes_back.key_distinction)}</p>` : ''}
      `,
        true
      )}

      ${CALLOUT(`
        ${CALLOUT_TITLE("If They're Confused or Need More Clarity")}
        ${BULLETS((s6.confused || {}).bullets || [])}
        ${PROBE((s6.confused || {}).probe || '')}
      `)}

      ${
        show6A && s6a
          ? `
        <!-- SECTION 6A — TYPE CONFUSION OBSERVATION -->
        ${SH('6A · Type Confusion Observation Block')}
        <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12px;">Types in question: ${esc(s6a.types_in_question || '')}. Use only if the client brought in their type confusion observation during the session.</p>
        ${SUBH('What to Do With What They Bring')}
        ${BULLETS(s6a.what_to_do)}
        ${SUBH("If the Observation Didn't Yield Clear Data")}
        ${BULLETS(s6a.if_no_data)}
        ${PROBE(s6a.probe)}
      `
          : ''
      }

      <!-- FOOTER -->
      <div style="margin-top:40px;padding-top:16px;border-top:2px solid ${ORANGE};text-align:center;font-size:11px;color:#7A96A6;">
        Generated by the Hive Enneagram Typing Engine &nbsp;·&nbsp; For use by Cai and Monique &nbsp;·&nbsp; © Copyright 2026, Hive, Inc.
      </div>
    </div>
  `;
}

// ---- Full HTML wrappers ----
function buildClientHTML(result, typeLibrary) {
  const body = clientReportBodyHtml(result, typeLibrary);
  const h = result.hypothesis;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Client Report — Type ${h.confirmed_type}</title>
<style>
  @media print { body { background: #fff; margin: 0; } @page { margin: 2cm; } }
  body { background: #F5F9FB; margin: 0; padding: 40px 20px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function buildCoachHTML(result, typeLibrary, scores) {
  const body = coachReportBodyHtml(result, typeLibrary, scores);
  const h = result.hypothesis;
  const instinct =
    h.confirmed_instinct && h.confirmed_instinct !== 'UNCERTAIN' ? ' ' + h.confirmed_instinct : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Coach Report — Type ${h.confirmed_type}${instinct}</title>
<style>
  @media print { body { background: #fff; margin: 0; } @page { margin: 2cm; } }
  body { background: #F5F9FB; margin: 0; padding: 40px 20px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

module.exports = { buildClientHTML, buildCoachHTML };
