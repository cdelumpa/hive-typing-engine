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


// ---- Hive logo (base64 PNG, embedded for Puppeteer header template) ----
const HIVE_LOGO_DATA_URI = 'data:image/png;base64,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';

// Simple HTML escaper for injected footer/header template strings
function escFt(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Shared constants (mirrored from app.js) ----
// TYPE_NAMES is authoritative — always use this, never rely on the AI-returned name string
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
  const chunks = str.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const paras = [];
  for (const chunk of chunks) {
    if (chunk.split(/\s+/).length <= 150) {
      paras.push(chunk);
    } else {
      // Split long chunks at sentence boundaries, grouping every 4 sentences
      const sentences = chunk.match(/[^.!?]+[.!?]+[\s]*/g) || [chunk];
      let group = [];
      for (let i = 0; i < sentences.length; i++) {
        group.push(sentences[i]);
        if ((i + 1) % 4 === 0 || i === sentences.length - 1) {
          const text = group.join('').trim();
          if (text) paras.push(text);
          group = [];
        }
      }
    }
  }
  return paras.map((p) => `<p style="${s}">${esc(p)}</p>`).join('');
}

// ---- Client report body HTML ----
function clientReportBodyHtml(result, typeLibrary, intake) {
  const h = result.hypothesis;
  const cf = result.client_facing || {};
  const ambiguous = h.stage4_outcome === 'AMBIGUOUS';
  const clientFullName = intake ? `${intake.firstName || ''} ${intake.lastName || ''}`.trim() : '';

  const typeName =
    TYPE_NAMES[h.confirmed_type] ||
    (h.confirmed_type_name || '').replace(/^Type\s*\d+\s*[—–-]+\s*/i, '').trim() || '';

  const tLib = (typeLibrary && typeLibrary.types && typeLibrary.types[String(h.confirmed_type)]) || {};
  const primers = (typeLibrary && typeLibrary.static_primers) || {};
  const instinctKey = (h.confirmed_instinct || '').toLowerCase();

  const SH = (title) =>
    `<div class="report-sh" style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#00b1d7;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #00b1d7;">${esc(title)}</div>`;
  const SUB = (title) =>
    `<div style="font-size:10px;font-weight:700;color:#00b1d7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${esc(title)}</div>`;
  const EVIDENCE = (text) =>
    text
      ? `<div style="font-size:12px;color:#4A6070;font-style:italic;margin:0 0 14px;">In your responses: ${renderMultiPara(text, 'display:inline;')}</div>`
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
    <div style="font-style:italic;background:#DFF0F7;padding:14px 18px;border-radius:6px;border-left:4px solid #00b1d7;color:#1A2B33;margin:0 0 14px;line-height:1.7;">${renderMultiPara(cf.secondary_type_narrative, 'margin:0 0 10px;')}</div>
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
    <div style="font-family:Georgia,serif;color:#1A2B33;line-height:1.6;font-size:13px;">

      <!-- HEADER -->
      <div style="text-align:center;padding-bottom:12px;margin-bottom:14px;">
        <div style="font-size:11px;color:#7A96A6;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Hive Enneagram Report${clientFullName ? ' Prepared for ' + esc(clientFullName) : ''}</div>
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
        ${cf.stress_point_narrative ? `${SUB('Under Stress')}${renderMultiPara(cf.stress_point_narrative)}` : ''}
        ${cf.security_point_narrative ? `${SUB('When at Ease')}${renderMultiPara(cf.security_point_narrative)}` : ''}

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
      <div style="margin-top:40px;text-align:center;font-size:11px;color:#7A96A6;">
        Generated by the Hive Enneagram Type Hypothesizer &nbsp;·&nbsp; © Copyright 2026, Hive, Inc. All rights reserved.
      </div>
    </div>
  `;
}

// ---- Coach report body HTML ----
function coachReportBodyHtml(result, typeLibrary, scores, intake) {
  const h = result.hypothesis;
  const cr = result.coach_report || {};
  const flags = result.flags || [];
  const s2a = result.stage2_analysis || {};
  const s4a = result.stage4_analysis || {};
  const s0 = result.stage0_analysis || {};
  const scoresObj = scores || {};

  const typeName =
    TYPE_NAMES[h.confirmed_type] ||
    (h.confirmed_type_name || '').replace(/^Type\s*\d+\s*[—–-]+\s*/i, '').trim() || '';

  const ORANGE = '#f58527';
  const SH = (title) =>
    `<div class="report-sh" style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ORANGE};margin:32px 0 12px;padding-bottom:6px;border-bottom:2px solid ${ORANGE};">${esc(title)}</div>`;
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
    <div style="font-family:Georgia,serif;color:#1A2B33;line-height:1.6;font-size:13px;">

      <!-- HEADER -->
      <div style="text-align:center;padding-bottom:12px;margin-bottom:14px;">
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
      <div style="margin-top:40px;text-align:center;font-size:11px;color:#7A96A6;">
        Generated by the Hive Enneagram Type Hypothesizer &nbsp;·&nbsp; For use by Cai and Monique &nbsp;·&nbsp; © Copyright 2026, Hive, Inc.
      </div>
    </div>
  `;
}

// ---- Full HTML wrappers ----
function buildClientHTML(result, typeLibrary, intake) {
  const body = clientReportBodyHtml(result, typeLibrary, intake);
  const h = result.hypothesis;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Client Report — Type ${h.confirmed_type}</title>
<style>
  body { background: #fff; margin: 0; padding: 0; font-family: Georgia, serif; }
  .report-sh { page-break-after: avoid; break-after: avoid; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function buildCoachHTML(result, typeLibrary, scores, intake) {
  const body = coachReportBodyHtml(result, typeLibrary, scores, intake);
  const h = result.hypothesis;
  const instinct =
    h.confirmed_instinct && h.confirmed_instinct !== 'UNCERTAIN' ? ' ' + h.confirmed_instinct : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Coach Report — Type ${h.confirmed_type}${instinct}</title>
<style>
  body { background: #fff; margin: 0; padding: 0; font-family: Georgia, serif; }
  .report-sh { page-break-after: avoid; break-after: avoid; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}


// ---- Puppeteer PDF options (header/footer templates, margins) ----
function buildPdfOptions(intake) {
  const clientFullName = intake
    ? `${intake.firstName || ''} ${intake.lastName || ''}`.trim()
    : '';
  const assessmentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const year = new Date().getFullYear();

  const footerTemplate =
    '<div style="font-size:9px;font-family:Arial,sans-serif;color:#7A96A6;' +
    'width:100%;box-sizing:border-box;display:flex;justify-content:space-between;' +
    'align-items:center;padding:0 72px;height:100%;">' +
    '<span>Prepared for ' + escFt(clientFullName) + ' on ' + escFt(assessmentDate) + '</span>' +
    '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>' +
    '<span>&copy; Copyright ' + year + ' Hive, Inc. All rights reserved.</span>' +
    '</div>';

  const headerTemplate =
    '<div style="width:100%;box-sizing:border-box;display:flex;justify-content:flex-start;' +
    'align-items:center;padding:0 72px;height:100%;">' +
    '<img src="' + HIVE_LOGO_DATA_URI + '" style="width:100px;height:auto;display:block;">' +
    '</div>';

  return {
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    margin: {
      top: '1.25in',     // header logo lives here; extra space creates gap between logo and body
      bottom: '0.875in', // 0.5in footer + 0.375in no-man's-land buffer
      left: '0.75in',
      right: '0.75in',
    },
  };
}

module.exports = { buildClientHTML, buildCoachHTML, buildPdfOptions };
