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
// TYPE_NAMES and SUBTYPE_NAMES are authoritative — always use these, never rely
// on AI-returned name strings. Key format for SUBTYPE_NAMES is
// `${instinct.toLowerCase()}-${typeNumber}` (e.g. 'so-8').
const TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer',
  4: 'The Individualist', 5: 'The Observer', 6: 'The Questioner',
  7: 'The Enthusiast', 8: 'The Protector', 9: 'The Peacemaker',
};

const SUBTYPE_NAMES = {
  'sp-1': 'The Organizer',
  'so-1': 'The Social Reformer',
  'sx-1': 'The Evangelist',
  'sp-2': 'The Nurturer',
  'so-2': 'The Ambassador',
  'sx-2': 'The Healer',
  'sp-3': 'The Diligent Worker',
  'so-3': 'The Politician',
  'sx-3': 'The Movie Star',
  'sp-4': 'The Creative Individualist',
  'so-4': 'The Critical Commentator',
  'sx-4': 'The Dramatic Person',
  'sp-5': 'The Castle Defender',
  'so-5': 'The Professor',
  'sx-5': 'The Secret Agent',
  'sp-6': 'The Family Loyalist',
  'so-6': 'The Social Guardian',
  'sx-6': 'The Warrior',
  'sp-7': 'The Epicure',
  'so-7': 'The Social Visionary',
  'sx-7': 'The Adventurer',
  'sp-8': 'The Survivalist',
  'so-8': 'The Group Leader',
  'sx-8': 'The Commander',
  'sp-9': 'The Collector',
  'so-9': 'The Community Benefactor',
  'sx-9': 'The Seeker',
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
  // Call #2 instinct verdict. The rendered object carries dominant_instinct_hypothesis;
  // confirmed_instinct is a legacy DB-only mirror that never re-enters this object
  // (Step 7 Phase 0). Read the hypothesis field; fall back to the legacy name for safety.
  const dominantInstinct = h.dominant_instinct_hypothesis || h.confirmed_instinct || '';
  const cf = result.client_facing || {};
  const ambiguous = h.stage4_outcome === 'AMBIGUOUS';
  const clientFullName = intake ? `${intake.firstName || ''} ${intake.lastName || ''}`.trim() : '';

  const typeName = TYPE_NAMES[h.confirmed_type] || '';

  const tLib = (typeLibrary && typeLibrary.types && typeLibrary.types[String(h.confirmed_type)]) || {};
  const primers = (typeLibrary && typeLibrary.static_primers) || {};
  const instinctKey = (dominantInstinct || '').toLowerCase();

  const SH = (title) =>
    `<div class="report-sh" style="font-size:14pt;line-height:16pt;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#00b1d7;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #00b1d7;">${esc(title)}</div>`;
  const SUB = (title) =>
    `<div style="font-size:14pt;line-height:16pt;font-weight:700;color:#00b1d7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${esc(title)}</div>`;
  const EVIDENCE = (text) =>
    text
      ? `<div style="font-size:12pt;line-height:15pt;color:#4A6070;font-style:italic;margin:0 0 14px;">In your responses: ${renderMultiPara(text, 'display:inline;')}</div>`
      : '';

  const header = ambiguous
    ? `<div style="font-size:28px;font-weight:700;color:#00b1d7;line-height:1.2;margin-bottom:12px;">A Genuinely Complex Pattern</div>`
    : `<div style="font-size:44px;font-weight:700;color:#00b1d7;line-height:1.1;margin-bottom:4px;">Type ${h.confirmed_type}</div>
       <div style="font-size:22px;color:#4A6070;margin-bottom:12px;">${esc(typeName)}</div>`;

  const noteText = ambiguous
    ? `Your responses reflect a genuinely complex pattern — one that resonates with more than one Enneagram type in meaningful ways. This isn't a limitation of the assessment; it's an honest finding about you. Rather than offering a premature hypothesis, we'd like to invite you into a conversation with your Enneagram coach or practitioner where this complexity can be explored properly.`
    : `Based on your responses, the pattern that appears most consistent with your experience is <strong>Type ${h.confirmed_type} — ${esc(typeName)}</strong>. We encourage you to hold this as a hypothesis or theory that you get to test 'in the wild'. That's the fun part. If it resonates, wonderful. If it doesn't fully fit, that's important information too. Debriefing this report with a trained Enneagram coach or practitioner like Cai or Monique is a great place to explore what fits, what doesn't, and why.`;

  const instinctLabelMap = { sp: 'Self-Preservation', sx: 'One-to-One', so: 'Social' };
  const instinctLabel = instinctLabelMap[instinctKey] || dominantInstinct || '';

  const strengthsHtml = (tLib.strengths || []).map((s) =>
    `<div style="font-size:12pt;line-height:15pt;margin-bottom:5px;"><span style="color:#00b1d7;font-weight:700;">+</span> ${esc(s)}</div>`
  ).join('');

  const challengesHtml = (tLib.challenges || []).map((c) =>
    `<div style="font-size:12pt;line-height:15pt;margin-bottom:5px;"><span style="color:#f58527;font-weight:700;">–</span> ${esc(c)}</div>`
  ).join('');

  const tipsHtml = (tLib.development_tips || []).map((tip, i) =>
    `<div style="padding:8px 14px;margin-bottom:6px;background:#F5F9FB;border-radius:4px;font-size:12pt;line-height:15pt;display:flex;gap:10px;">
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
    <div style="font-style:italic;background:#DFF0F7;padding:14px 18px;border-radius:6px;border-left:4px solid #00b1d7;color:#1A2B33;margin:0 0 14px;line-height:15pt;">${renderMultiPara(cf.secondary_type_narrative, 'margin:0 0 10px;')}</div>
  `
      : '';

  const exploreQuestions = cf.what_to_explore || [];
  const exploreHtml =
    exploreQuestions.length > 0
      ? `
    ${SH('What to Explore With Your Enneagram Coach or Practitioner')}
    <p style="color:#4A6070;margin:0 0 10px;font-size:12pt;line-height:15pt;">These questions are designed to help you get the most out of your work with a coach or practitioner. Take a moment to sit with each one before your session.</p>
    ${exploreQuestions
      .map(
        (q, i) => `
      <div style="padding:8px 14px;margin-bottom:6px;background:#F5F9FB;border-radius:4px;font-size:12pt;line-height:15pt;display:flex;gap:10px;">
        <span style="color:#00b1d7;font-weight:700;">${i + 1}.</span>
        <span>${esc(q)}</span>
      </div>`
      )
      .join('')}
  `
      : '';

  return `
    <div style="font-family:Georgia,serif;color:#1A2B33;line-height:15pt;font-size:12pt;">

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
      <div style="font-style:italic;background:#DFF0F7;padding:14px 18px;border-radius:6px;border-left:4px solid #00b1d7;color:#1A2B33;margin:0 0 14px;line-height:15pt;">${renderMultiPara(cf.client_narrative, 'margin:0 0 10px;')}</div>

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
          <p style="margin:0 0 10px;font-size:12pt;line-height:15pt;color:#1A2B33;">These patterns give rise to a distinctive set of strengths and challenges. The ones below are characteristic of Type ${h.confirmed_type} — you may recognize some more than others, and that recognition itself is useful information.</p>
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
          <p style="color:#4A6070;margin:0 0 10px;font-size:12pt;line-height:15pt;">These practices can help you leverage your strengths and address the patterns that can hold you back.</p>
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

      ${(result.final_response && result.final_response.present && result.final_response.contextual_note) ? `
      <!-- YOUR FINAL RESPONSE -->
      ${SH('Your Final Response')}
      <div style="font-style:italic;background:#DFF0F7;padding:14px 18px;border-radius:6px;border-left:4px solid #00b1d7;color:#1A2B33;margin:0 0 14px;line-height:15pt;">${esc(result.final_response.contextual_note)}</div>
      ` : ''}

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
  // Call #2 instinct verdict — read dominant_instinct_hypothesis; confirmed_instinct is a
  // legacy DB-only mirror absent from the rendered object (Step 7 Phase 0). Fallback for safety.
  const dominantInstinct = h.dominant_instinct_hypothesis || h.confirmed_instinct || '';
  const cr = result.coach_report || {};
  const flags = result.flags || [];
  const s2a = result.stage2_analysis || {};
  const s4a = result.stage4_analysis || {};
  const s0 = result.stage0_analysis || {};
  const scoresObj = scores || {};

  const typeName = TYPE_NAMES[h.confirmed_type] || '';

  const ORANGE = '#f58527';
  const SH = (title) =>
    `<div class="report-sh" style="font-size:14pt;line-height:16pt;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${ORANGE};margin:32px 0 12px;padding-bottom:6px;border-bottom:2px solid ${ORANGE};">${esc(title)}</div>`;
  const SUBH = (title) =>
    `<div style="font-size:14pt;line-height:16pt;font-weight:700;color:${ORANGE};text-transform:uppercase;letter-spacing:0.08em;margin:18px 0 8px;">${esc(title)}</div>`;
  const PROBE = (text) =>
    text
      ? `<div style="background:#FAF6F2;padding:10px 14px;border-radius:4px;font-style:italic;color:#1A2B33;margin:6px 0;border-left:3px solid ${ORANGE};">${esc(text)}</div>`
      : '';
  const BULLETS = (arr) =>
    arr && arr.length
      ? `<ul style="margin:0 0 14px 0;padding-left:20px;">${arr.map((b) => `<li style="margin-bottom:8px;line-height:15pt;font-size:12pt;">${esc(b)}</li>`).join('')}</ul>`
      : '';
  const CALLOUT = (content, warning) => {
    const bg = warning ? '#F9E0DC' : '#FDE8D4';
    const border = warning ? '#C44530' : ORANGE;
    return `<div style="background:${bg};padding:14px 18px;border-radius:6px;border-left:4px solid ${border};margin:0 0 16px;">${content}</div>`;
  };
  const CALLOUT_TITLE = (text, warning) =>
    `<div style="font-size:14pt;line-height:16pt;font-weight:700;color:${warning ? '#C44530' : ORANGE};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">${esc(text)}</div>`;

  const instinctKey = (dominantInstinct || '').toLowerCase();
  const instinctFull =
    { sp: 'Self-Preservation (SP)', sx: 'One-to-One (SX)', so: 'Social (SO)' }[instinctKey] ||
    dominantInstinct ||
    'Unknown';
  const subtypeName = SUBTYPE_NAMES[`${instinctKey}-${h.confirmed_type}`] || '';
  const confLabel = (h.confidence_level || '').replace(/_/g, '-');

  const metaRow = (label, value, style) => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:1px solid #EFE8E0;">
      <span style="font-size:11px;color:#7A96A6;letter-spacing:0.05em;text-transform:uppercase;font-weight:700;">${esc(label)}</span>
      <span style="font-size:15px;color:${style || '#1A2B33'};font-weight:600;">${value}</span>
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
    return `<div style="display:grid;grid-template-columns:160px 1fr 60px;gap:10px;align-items:center;margin-bottom:10px;font-size:15px;">
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
    const isId = name === (dominantInstinct || '');
    const fillStyle = isId
      ? 'background:#f58527;'
      : pct >= 50
      ? 'background:#F5B988;'
      : 'background:#FBDDC2;';
    const label = { SP: 'Self-Preservation', SO: 'Social', SX: 'One-to-One' }[name] || name;
    return `<div style="display:grid;grid-template-columns:160px 1fr 60px;gap:10px;align-items:center;margin-bottom:10px;font-size:15px;">
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
    <div style="font-family:Georgia,serif;color:#1A2B33;line-height:15pt;font-size:12pt;">

      <!-- HEADER -->
      <div style="text-align:center;padding-bottom:12px;margin-bottom:14px;">
        <div style="font-size:11px;color:#7A96A6;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Coach Prep Report</div>
        <div style="font-size:42px;font-weight:700;color:${ORANGE};line-height:1.1;margin-bottom:4px;">Type ${h.confirmed_type} · ${dominantInstinct}</div>
        <div style="font-size:20px;color:#4A6070;margin-bottom:12px;">${esc(subtypeName)}</div>
        <span style="display:inline-block;padding:3px 12px;border-radius:20px;background:#FFF9E6;color:#A17E23;font-weight:700;font-size:11px;letter-spacing:0.05em;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${esc(confLabel)} CONFIDENCE</span>
      </div>

      <!-- HOW TO USE -->
      <p style="font-size:12pt;line-height:15pt;color:#4A6070;font-style:italic;margin:0 0 20px;background:#FAF6F2;padding:12px 16px;border-radius:6px;">This report is designed as a session prep tool — organized around the debrief conversation you'll have with your client, not around how the assessment engine arrived at its hypothesis. Read Section 1 for the quick read. Use Sections 2 through 5 as a companion during the debrief itself. Section 6 offers contingency guidance depending on how the conversation unfolds.</p>

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
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12pt;line-height:15pt;">How to present the heart of the type and connect it to their own words.</p>
      ${SUBH('The Core Pattern')}
      ${BULLETS(s2.core_pattern)}
      ${SUBH('What Their Responses Showed')}
      ${BULLETS(s2.what_responses_showed)}
      ${SUBH('Coaching Notes')}
      ${BULLETS(s2.coaching_notes)}
      ${PROBE(s2.probe)}

      <!-- SECTION 3 — PATTERNS -->
      ${SH('3 · Debriefing Patterns of Thinking, Feeling, and Behaving')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12pt;line-height:15pt;">What to expect and what to watch for as you walk through type patterns.</p>

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
        <p style="margin:0 0 14px;font-size:12pt;line-height:15pt;color:#4A6070;font-style:italic;">These are cross-referenced patterns that showed up consistently in their responses. Each offers a different lens on the type — worth weaving in conversationally rather than introducing as categories.</p>
        ${frameworkSignals}
      `
          : ''
      }

      ${SUBH('Coaching Notes for This Section')}
      ${BULLETS(s3.coaching_notes)}
      ${PROBE(s3.probe)}

      <!-- SECTION 4 — INSTINCT & SUBTYPE -->
      ${SH('4 · Debriefing Instinct and Subtype')}
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12pt;line-height:15pt;">Their particular flavor of Type ${h.confirmed_type}, and why it matters.</p>

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
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12pt;line-height:15pt;">What they have available, especially under pressure.</p>

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
      <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12pt;line-height:15pt;">What to do depending on how they receive the hypothesis.</p>

      ${CALLOUT(`
        ${CALLOUT_TITLE('If They Resonate Strongly')}
        ${BULLETS((s6.resonates_strongly || {}).bullets || [])}
        ${PROBE((s6.resonates_strongly || {}).probe || '')}
      `)}

      ${CALLOUT(
        `
        ${CALLOUT_TITLE('If They Push Back or Disagree', true)}
        ${BULLETS((s6.pushes_back || {}).bullets || [])}
        ${(s6.pushes_back || {}).alt_type_name ? `<p style="margin:8px 0 4px;font-size:12pt;line-height:15pt;"><strong>Most likely alternate type:</strong> ${esc(s6.pushes_back.alt_type_name)}</p>` : ''}
        ${(s6.pushes_back || {}).key_distinction ? `<p style="margin:0 0 0;font-size:12pt;line-height:15pt;font-style:italic;"><strong>Key distinguishing question:</strong> ${esc(s6.pushes_back.key_distinction)}</p>` : ''}
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
        <p style="color:#4A6070;font-style:italic;margin:0 0 14px;font-size:12pt;line-height:15pt;">Types in question: ${esc(s6a.types_in_question || '')}. Use only if the client brought in their type confusion observation during the session.</p>
        ${SUBH('What to Do With What They Bring')}
        ${BULLETS(s6a.what_to_do)}
        ${SUBH("If the Observation Didn't Yield Clear Data")}
        ${BULLETS(s6a.if_no_data)}
        ${PROBE(s6a.probe)}
      `
          : ''
      }

      ${(result.final_response && result.final_response.present && result.final_response.contextual_note) ? `
      <!-- FINAL OPEN-ENDED RESPONSE -->
      ${SH('Final Open-Ended Response')}
      <div style="background:#FAF6F2;padding:14px 18px;border-radius:6px;border-left:4px solid ${ORANGE};margin:0 0 16px;">
        <div style="font-size:10px;font-weight:700;color:${ORANGE};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Final Open-Ended Response</div>
        <div style="font-style:italic;color:#1A2B33;line-height:15pt;">${esc(result.final_response.contextual_note)}</div>
      </div>
      ` : ''}

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
  // Call #2 instinct verdict (Step 7 Phase 0) — dominant_instinct_hypothesis is the live
  // field; confirmed_instinct is a legacy DB-only mirror kept as a fallback.
  const dominantInstinct = h.dominant_instinct_hypothesis || h.confirmed_instinct || '';
  const instinct =
    dominantInstinct && dominantInstinct !== 'UNCERTAIN' ? ' ' + dominantInstinct : '';
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

// ---- Beta diagnostic report HTML ----
// Renders an audit-style report of every input + scoring decision for QA review.
// Visual structure mirrors the client/coach reports (header bar via buildPdfOptions,
// section headers, tabular summaries) but uses a purple accent (#7B5EA7) to
// distinguish it from the cyan client report and orange coach report.
//
// `data` is a pre-resolved structure built in beta/generate_report.js — this
// function does no scores_snapshot/api_result fallback logic of its own.
function betaReportBodyHtml(data) {
  const PURPLE = '#7B5EA7';
  const PURPLE_DARK = '#5C4080';
  const PURPLE_LIGHT = '#F1ECF7';
  const PURPLE_TINT = '#FAF7FC';

  const SH = (title) =>
    `<div class="report-sh" style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${PURPLE};margin:32px 0 12px;padding-bottom:6px;border-bottom:2px solid ${PURPLE};">${esc(title)}</div>`;
  const SUBH = (title) =>
    `<div style="font-size:11px;font-weight:700;color:${PURPLE};text-transform:uppercase;letter-spacing:0.08em;margin:18px 0 8px;">${esc(title)}</div>`;
  const SUBH3 = (title) =>
    `<div style="font-size:10px;font-weight:700;color:${PURPLE_DARK};text-transform:uppercase;letter-spacing:0.06em;margin:12px 0 6px;">${esc(title)}</div>`;

  // Two-column label:value row — alternating shade. Mirrors coachReportBodyHtml's
  // metaRow but renders inside a table so column widths stay aligned.
  const summaryTable = (rows) => {
    if (!rows || rows.length === 0) return '';
    const html = rows.map((r, i) => {
      const bg = i % 2 === 0 ? PURPLE_TINT : '#FFFFFF';
      return `<tr style="background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <td style="padding:7px 12px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#4A6070;width:38%;vertical-align:top;border-bottom:1px solid #EFEAF6;">${esc(r.label)}</td>
        <td style="padding:7px 12px;font-size:14px;color:#1A2B33;vertical-align:top;border-bottom:1px solid #EFEAF6;">${esc(r.value == null || r.value === '' ? '—' : r.value)}</td>
      </tr>`;
    }).join('');
    return `<table style="width:100%;border-collapse:collapse;margin:0 0 14px;border:1px solid #E4DEEE;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${html}</table>`;
  };

  // Stage-0 question + response block
  const stage0Block = (item) => `
    ${SUBH(item.title)}
    <p style="margin:0 0 6px;font-size:13px;color:#4A6070;font-style:italic;">${esc(item.text)}</p>
    <div style="background:${PURPLE_TINT};border-left:3px solid ${PURPLE};padding:10px 14px;border-radius:4px;margin:0 0 16px;font-size:14px;color:#1A2B33;-webkit-print-color-adjust:exact;print-color-adjust:exact;white-space:pre-wrap;">${esc(item.response || '[no response]')}</div>
  `;

  // Stage-1 ranking table (3 rows: 1st/2nd/3rd, with dimension label)
  const stage1QuestionBlock = (q) => {
    const rowsHtml = q.rows.map((r, i) => {
      const bg = i % 2 === 0 ? PURPLE_TINT : '#FFFFFF';
      const weight = r.isTop ? '700' : '400';
      return `<tr style="background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <td style="padding:6px 10px;font-size:13px;font-weight:700;color:${r.isTop ? PURPLE : '#1A2B33'};width:60px;border-bottom:1px solid #EFEAF6;">${esc(r.rankLabel)}</td>
        <td style="padding:6px 10px;font-size:12px;color:#4A6070;letter-spacing:0.04em;width:80px;border-bottom:1px solid #EFEAF6;">${esc(r.dim)}</td>
        <td style="padding:6px 10px;font-size:14px;color:#1A2B33;font-weight:${weight};border-bottom:1px solid #EFEAF6;">${esc(r.text)}</td>
      </tr>`;
    }).join('');
    return `
      ${SUBH(`Q${q.idx}: ${q.title}`)}
      <div style="font-size:11px;color:#7A96A6;letter-spacing:0.04em;margin:0 0 6px;text-transform:uppercase;">${esc(q.dimLabel)}</div>
      <p style="margin:0 0 8px;font-size:13px;color:#4A6070;font-style:italic;">${esc(q.text)}</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 14px;border:1px solid #E4DEEE;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <thead><tr style="background:${PURPLE_LIGHT};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <th style="padding:6px 10px;font-size:10px;color:${PURPLE_DARK};text-align:left;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;border-bottom:1px solid #D6CCE8;">Rank</th>
          <th style="padding:6px 10px;font-size:10px;color:${PURPLE_DARK};text-align:left;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;border-bottom:1px solid #D6CCE8;">Dimension</th>
          <th style="padding:6px 10px;font-size:10px;color:${PURPLE_DARK};text-align:left;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;border-bottom:1px solid #D6CCE8;">Option Text</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  };

  // Stage-2 options table — single-letter A/B/C with selected marker
  const stage2QuestionBlock = (q) => {
    const rowsHtml = q.options.map((o, i) => {
      const bg = o.selected ? PURPLE_LIGHT : (i % 2 === 0 ? PURPLE_TINT : '#FFFFFF');
      const marker = o.selected
        ? `<span style="color:${PURPLE};font-weight:700;">▶ ${esc(o.letter)}</span>`
        : `<span style="color:#7A96A6;">${esc(o.letter)}</span>`;
      const weight = o.selected ? '700' : '400';
      return `<tr style="background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <td style="padding:7px 10px;font-size:13px;width:70px;border-bottom:1px solid #EFEAF6;">${marker}</td>
        <td style="padding:7px 10px;font-size:14px;color:#1A2B33;font-weight:${weight};border-bottom:1px solid #EFEAF6;">${esc(o.text)}</td>
      </tr>`;
    }).join('');
    return `
      ${SUBH(`Q${q.idx}: ${q.title}`)}
      <div style="font-size:11px;color:#7A96A6;letter-spacing:0.04em;margin:0 0 6px;text-transform:uppercase;">${esc(q.framework)}</div>
      <p style="margin:0 0 8px;font-size:13px;color:#4A6070;font-style:italic;">${esc(q.text)}</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 14px;border:1px solid #E4DEEE;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${rowsHtml}</table>
    `;
  };

  // Person A / Person B pairwise table (Stage 3 + Stage 4 pairwise)
  const pairwiseTable = (pairs) => {
    const rowsHtml = pairs.map((p, i) => {
      const bg = p.selected ? PURPLE_LIGHT : (i % 2 === 0 ? PURPLE_TINT : '#FFFFFF');
      const marker = p.selected
        ? `<span style="color:${PURPLE};font-weight:700;">▶ ${esc(p.label)}</span>`
        : `<span style="color:#7A96A6;">${esc(p.label)}</span>`;
      const weight = p.selected ? '700' : '400';
      return `<tr style="background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <td style="padding:7px 10px;font-size:13px;width:140px;border-bottom:1px solid #EFEAF6;">${marker}</td>
        <td style="padding:7px 10px;font-size:14px;color:#1A2B33;font-weight:${weight};border-bottom:1px solid #EFEAF6;">${esc(p.text)}</td>
      </tr>`;
    }).join('');
    return `<table style="width:100%;border-collapse:collapse;margin:0 0 8px;border:1px solid #E4DEEE;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${rowsHtml}</table>`;
  };

  const stage3QuestionBlock = (label, q) => q ? `
    ${SUBH(label + ': ' + q.stem)}
    ${pairwiseTable(q.pairs)}
    <p style="margin:0 0 14px;font-size:13px;color:#1A2B33;font-weight:700;">Selected: ${esc(q.selectedLabel)}</p>
  ` : '';

  // Stage-4 instrument block — pairwise OR 3opt
  const stage4InstrumentBlock = (label, stem, item) => {
    if (!item) return '';
    let body;
    if (item.mode === 'pairwise') {
      body = pairwiseTable(item.options);
    } else {
      const rowsHtml = item.options.map((o, i) => {
        const bg = o.selected ? PURPLE_LIGHT : (i % 2 === 0 ? PURPLE_TINT : '#FFFFFF');
        const marker = o.selected
          ? `<span style="color:${PURPLE};font-weight:700;">▶ ${esc(o.label)}</span>`
          : `<span style="color:#7A96A6;">${esc(o.label)}</span>`;
        const weight = o.selected ? '700' : '400';
        return `<tr style="background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <td style="padding:7px 10px;font-size:13px;width:120px;border-bottom:1px solid #EFEAF6;">${marker}</td>
          <td style="padding:7px 10px;font-size:14px;color:#1A2B33;font-weight:${weight};border-bottom:1px solid #EFEAF6;">${esc(o.text)}</td>
        </tr>`;
      }).join('');
      body = `<table style="width:100%;border-collapse:collapse;margin:0 0 8px;border:1px solid #E4DEEE;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${rowsHtml}</table>`;
    }
    return `
      ${SUBH(label)}
      <p style="margin:0 0 8px;font-size:13px;color:#4A6070;font-style:italic;">${esc(stem)}</p>
      ${body}
      <p style="margin:0 0 4px;font-size:13px;color:#1A2B33;font-weight:700;">Selected: ${esc(item.selectedLabel)}</p>
      <p style="margin:0 0 16px;font-size:12px;color:#4A6070;">Confirmed: ${esc(item.confirmedLabel)}</p>
    `;
  };

  // ── Header (Client / Email / Coach / Date)
  const headerTable = summaryTable([
    { label: 'Client Name',     value: data.clientName },
    { label: 'Email',           value: data.email },
    { label: 'Coach',           value: data.coachName },
    { label: 'Assessment Date', value: data.assessmentDate },
  ]);

  // ── Engine Outcome
  const engineTable = summaryTable([
    { label: 'Confirmed Type',   value: data.typeLabel },
    { label: 'Confidence Level', value: data.confidenceLevel },
    { label: 'Stage 4 Outcome',  value: data.stage4Outcome },
    { label: 'Stage 4 Path',     value: data.stage4Path },
  ]);

  const flagsHtml = (data.flags && data.flags.length > 0)
    ? `<ul style="margin:0 0 14px;padding-left:20px;">${data.flags.map(f =>
        `<li style="margin-bottom:6px;font-size:13px;line-height:1.55;"><strong>${esc(f.label)}</strong>${f.description ? ': ' + esc(f.description) : ''}</li>`
      ).join('')}</ul>`
    : `<p style="margin:0 0 14px;font-size:14px;color:#4A6070;">None</p>`;

  // ── Stage blocks
  const stage0Html = (data.stage0 || []).map(stage0Block).join('');
  const stage1QuestionsHtml = (data.stage1.questions || []).map(stage1QuestionBlock).join('');
  const stage2QuestionsHtml = (data.stage2.questions || []).map(stage2QuestionBlock).join('');

  return `
    <div style="font-family:Georgia,serif;color:#1A2B33;line-height:15pt;font-size:12pt;">

      <!-- HEADER -->
      <div style="text-align:center;padding-bottom:12px;margin-bottom:14px;">
        <div style="font-size:11px;color:#7A96A6;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Hive Enneagram — Beta Diagnostic Report</div>
        <div style="font-size:30px;font-weight:700;color:${PURPLE};line-height:1.1;margin-bottom:4px;">Engine Audit</div>
        <div style="font-size:14px;color:#4A6070;">${esc(data.clientName)}</div>
      </div>

      ${headerTable}

      <!-- ENGINE OUTCOME -->
      ${SH('Engine Outcome')}
      ${engineTable}
      ${SUBH('Flags Raised')}
      ${flagsHtml}

      <!-- STAGE 0 -->
      ${SH('Stage 0 — Warm-Up')}
      ${stage0Html}

      <!-- STAGE 1 -->
      ${SH('Stage 1 — Centers & Instincts')}
      ${SUBH('Score Summary')}
      ${summaryTable(data.stage1.summary)}
      ${stage1QuestionsHtml}

      <!-- STAGE 2 -->
      ${SH('Stage 2 — Cross-Referencing')}
      ${SUBH('Summary')}
      ${summaryTable(data.stage2.summary)}
      ${stage2QuestionsHtml}

      <!-- STAGE 3 -->
      ${SH('Stage 3 — Pairwise Discrimination')}
      ${SUBH('Summary')}
      ${summaryTable(data.stage3.summary)}
      ${stage3QuestionBlock('Q1', data.stage3.q1)}
      ${stage3QuestionBlock('Q2', data.stage3.q2)}

      <!-- STAGE 4 -->
      ${SH('Stage 4 — Confirmation')}
      ${SUBH('Summary')}
      ${summaryTable(data.stage4.summary)}
      ${stage4InstrumentBlock('Stress Point',  data.stage4.stressStem,   data.stage4.stress)}
      ${stage4InstrumentBlock('Security Point', data.stage4.securityStem, data.stage4.security)}
      ${stage4InstrumentBlock('Habit of Mind', data.stage4.habitStem,    data.stage4.habit)}

      <!-- FINAL OPEN QUESTION -->
      ${SH('Final Open Question')}
      ${data.finalOpenResponse
        ? `<div style="background:${PURPLE_TINT};border-left:3px solid ${PURPLE};padding:12px 16px;border-radius:4px;font-size:14px;color:#1A2B33;-webkit-print-color-adjust:exact;print-color-adjust:exact;white-space:pre-wrap;">${esc(data.finalOpenResponse)}</div>`
        : `<p style="margin:0 0 14px;font-size:14px;color:#4A6070;font-style:italic;">Skipped.</p>`}

      <!-- FOOTER -->
      <div style="margin-top:40px;text-align:center;font-size:11px;color:#7A96A6;">
        Generated by the Hive Enneagram Type Hypothesizer &nbsp;·&nbsp; Beta Diagnostic &nbsp;·&nbsp; © Copyright 2026, Hive, Inc.
      </div>
    </div>
  `;
}

function buildBetaHTML(data) {
  const body = betaReportBodyHtml(data);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Beta Diagnostic Report — ${esc(data.clientName || 'Client')}</title>
<style>
  body { background: #fff; margin: 0; padding: 0; font-family: Georgia, serif; }
  .report-sh { page-break-after: avoid; break-after: avoid; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
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

// ============================================================================
// PART A — Shared design system (Step 7 Phase 3). Pure, deterministic, AI-free.
// Inline SVG Enneagram (A6), bar charts (A5), palette/CSS tokens (A2/A3).
// New + exported; the V1 renderer above is untouched (Phase 5/6 replaces it).
// A6 SVG colors are self-contained and authoritative for the diagram (some
// differ from the A2 brand palette by design, e.g. base nodes #F7941D).
// ============================================================================

const PALETTE = {
  hiveBlue: '#00B2D9', hiveOrange: '#F68625',
  body: '#404040', sectionTitle: '#595959', altPillText: '#333333',
  gut: '#5271B7', heart: '#D38481', headFill: '#BED6A8', headText: '#4F845C',
  track: '#D6D7D8',
  leadingPillBg: '#D9E4E9', leadingPillText: '#495A78',
  confidenceBg: '#DFEAD8', confidenceText: '#4F845C',
  alternatePillBg: '#E6E7E8', calloutBg: '#F5F5EE', tealBox: '#E8F6FA', footer: '#999999',
};

// A2 Center-color mapping — single source of truth. Only Head splits fill/text.
const CENTER_COLORS = {
  Gut:   { fill: '#5271B7', text: '#5271B7' },
  Heart: { fill: '#D38481', text: '#D38481' },
  Head:  { fill: '#BED6A8', text: '#4F845C' },
};

// A6 per-type metadata (mirrors engine TYPE_META; Phase 4 centralizes into type_meta.js).
const SVG_TYPE_META = {
  1: { stress: 4, security: 7, wings: [9, 2], center: 'Gut' },
  2: { stress: 8, security: 4, wings: [1, 3], center: 'Heart' },
  3: { stress: 9, security: 6, wings: [2, 4], center: 'Heart' },
  4: { stress: 2, security: 1, wings: [3, 5], center: 'Heart' },
  5: { stress: 7, security: 8, wings: [4, 6], center: 'Head' },
  6: { stress: 3, security: 9, wings: [5, 7], center: 'Head' },
  7: { stress: 1, security: 5, wings: [6, 8], center: 'Head' },
  8: { stress: 5, security: 2, wings: [7, 9], center: 'Gut' },
  9: { stress: 6, security: 3, wings: [8, 1], center: 'Gut' },
};

// A6 node coordinates: center (250,250), r=210, clockwise from top at 40°.
const SVG_NODES = {
  9: [250.0, 40.0], 1: [385.0, 89.1], 2: [456.8, 213.5], 3: [431.9, 355.0],
  4: [321.8, 447.3], 5: [178.2, 447.3], 6: [68.1, 355.0], 7: [43.2, 213.5], 8: [115.0, 89.1],
};
// Arrow flow = canonical disintegration direction (Cai-confirmed). Hexad per A6;
// triangle is 9→6→3→9 — the REVERSE of A6's "3→6→9→3" text (an error in the doc),
// so the triangle arrows flow consistently with the hexad in the base diagram.
const SVG_HEXAD = [[1, 4], [4, 2], [2, 8], [8, 5], [5, 7], [7, 1]];
const SVG_TRIANGLE = [[9, 6], [6, 3], [3, 9]];
// Canonical directed flow = the base-diagram arrow directions. Type-variant
// stress/security arrows are oriented by this so they match the base EXACTLY
// (Cai-confirmed): stress stays home→stress; security follows the flow into home.
const SVG_FLOW = new Set([...SVG_HEXAD, ...SVG_TRIANGLE].map(([a, b]) => `${a}-${b}`));
const _flowDir = (x, y) => (SVG_FLOW.has(`${x}-${y}`) ? [x, y] : [y, x]);

function _trim(p1, p2, t) {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
  return [[p1[0] + ux * t, p1[1] + uy * t], [p2[0] - ux * t, p2[1] - uy * t]];
}
function _svgLine(a, b, attrs) {
  return `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" ${attrs}/>`;
}
function _svgNode(i, r, fill) { const [x, y] = SVG_NODES[i]; return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`; }
function _svgLabel(i, fontSize, bold) {
  const [x, y] = SVG_NODES[i];
  return `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="${bold ? 'bold' : 'normal'}" fill="white" text-anchor="middle" dominant-baseline="central">${i}</text>`;
}
function _arrowMarker(id, color) {
  return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;
}

// A6 — single source for all Enneagram diagrams. variant: 'base'|'type'|'wings-lines'.
function buildEnneagramSVG({ type, variant }) {
  const open = `<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">`;
  const uid = `${variant}-${type || 'base'}`;

  if (variant === 'base') {
    const m = `arr-${uid}`;
    const lines = [...SVG_HEXAD, ...SVG_TRIANGLE].map(([a, b]) => {
      const [p1, p2] = _trim(SVG_NODES[a], SVG_NODES[b], 30);
      return _svgLine(p1, p2, `stroke="#F7941D" stroke-width="2" marker-end="url(#${m})"`);
    }).join('');
    const nodes = Object.keys(SVG_NODES).map(i => _svgNode(+i, 22, '#F7941D') + _svgLabel(+i, 20, true)).join('');
    return open + `<defs>${_arrowMarker(m, '#F7941D')}</defs>`
      + `<circle cx="250" cy="250" r="210" fill="none" stroke="#00B2D9" stroke-width="8"/>` + lines + nodes + `</svg>`;
  }

  const meta = SVG_TYPE_META[type];
  if (!meta) throw new Error(`buildEnneagramSVG: type ${type} required for variant "${variant}"`);
  const { stress, security, wings } = meta, home = type;

  if (variant === 'type') {
    const mS = `str-${uid}`, mG = `sec-${uid}`;
    const wedges =
        `<path d="M 250,250 L 68.1,145.0 A 210,210 0 0,1 431.9,145.0 Z" fill="#5271B7" opacity="0.15"/>`
      + `<path d="M 250,250 L 431.9,145.0 A 210,210 0 0,1 250.0,460.0 Z" fill="#D38481" opacity="0.15"/>`
      + `<path d="M 250,250 L 250.0,460.0 A 210,210 0 0,1 68.1,145.0 Z" fill="#BED6A8" opacity="0.50"/>`;
    const dividers = [[68.1, 145.0], [431.9, 145.0], [250.0, 460.0]]
      .map(p => _svgLine([250, 250], p, `stroke="white" stroke-width="1.5"`)).join('');
    const inactive = [...SVG_HEXAD, ...SVG_TRIANGLE].map(([a, b]) => {
      const [p1, p2] = _trim(SVG_NODES[a], SVG_NODES[b], 30);
      return _svgLine(p1, p2, `stroke="#C8C8C8" stroke-width="1.5"`);
    }).join('');
    const [sa, sb] = _flowDir(home, stress);     // arrow direction matches the base diagram
    const [ga, gb] = _flowDir(home, security);   // (e.g. Type 1 security → 7→1, into home)
    const [s1, s2] = _trim(SVG_NODES[sa], SVG_NODES[sb], 30);
    const [g1, g2] = _trim(SVG_NODES[ga], SVG_NODES[gb], 30);
    const stressLine = _svgLine(s1, s2, `stroke="#D38481" stroke-width="2.5" stroke-dasharray="6,4" marker-end="url(#${mS})"`);
    const secLine = _svgLine(g1, g2, `stroke="#4F845C" stroke-width="2.5" marker-end="url(#${mG})"`);
    let nodes = '';
    for (const k of Object.keys(SVG_NODES)) {
      const i = +k; let r, fill, fs, bold;
      if (i === home) { r = 26; fill = '#00B2D9'; fs = 19; bold = true; }
      else if (i === stress) { r = 22; fill = '#D38481'; fs = 17; bold = true; }
      else if (i === security) { r = 22; fill = '#4F845C'; fs = 17; bold = true; }
      else if (wings.includes(i)) { r = 20; fill = '#A0A0A0'; fs = 17; bold = false; }
      else { r = 20; fill = '#C8C8C8'; fs = 17; bold = false; }
      nodes += _svgNode(i, r, fill) + _svgLabel(i, fs, bold);
    }
    return open + `<defs>${_arrowMarker(mS, '#D38481')}${_arrowMarker(mG, '#4F845C')}</defs>`
      + wedges + dividers + `<circle cx="250" cy="250" r="210" fill="none" stroke="#00B2D9" stroke-width="8"/>`
      + inactive + stressLine + secLine + nodes + `</svg>`;
  }

  if (variant === 'wings-lines') {
    const wingConn = wings.map(w => {
      const [p1, p2] = _trim(SVG_NODES[home], SVG_NODES[w], 30);
      return _svgLine(p1, p2, `stroke="#C8C8C8" stroke-width="2"`);
    }).join('');
    const [s1, s2] = _trim(SVG_NODES[home], SVG_NODES[stress], 30);
    const [g1, g2] = _trim(SVG_NODES[home], SVG_NODES[security], 30);
    const stressLine = _svgLine(s1, s2, `stroke="#D0312D" stroke-width="2.5" stroke-dasharray="10,6"`);
    const secLine = _svgLine(g1, g2, `stroke="#4F845C" stroke-width="2.5"`);
    let nodes = '';
    for (const k of Object.keys(SVG_NODES)) {
      const i = +k; let r, fill, fs, bold;
      if (i === home) { r = 26; fill = '#2E3F6F'; fs = 19; bold = true; }
      else if (i === stress) { r = 22; fill = '#D0312D'; fs = 17; bold = true; }
      else if (i === security) { r = 22; fill = '#4F845C'; fs = 17; bold = true; }
      else { r = 20; fill = '#C8C8C8'; fs = 17; bold = false; }
      nodes += _svgNode(i, r, fill) + _svgLabel(i, fs, bold);
    }
    return open + `<circle cx="250" cy="250" r="210" fill="none" stroke="#C8C8C8" stroke-width="8"/>`
      + wingConn + stressLine + secLine + nodes + `</svg>`;
  }

  throw new Error(`buildEnneagramSVG: unknown variant "${variant}"`);
}

// A5 — deterministic bar charts. Fixed 0-100 scale (no auto-scale). Inline SVG.
const SVG_TYPE_BAR_ORDER = [8, 9, 1, 2, 3, 4, 5, 6, 7];
function _barChartSVG(rows) {
  const rowH = 30, labelW = 36, trackW = 280, scoreW = 34, barH = 14;
  const W = labelW + trackW + scoreW, H = rows.length * rowH;
  const body = rows.map((r, i) => {
    const cy = i * rowH + rowH / 2, by = cy - barH / 2;
    const fillW = Math.max(0, Math.min(100, r.score)) / 100 * trackW;
    return `<text x="0" y="${cy}" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="${r.labelColor}" dominant-baseline="central">${esc(String(r.label))}</text>`
      + `<rect x="${labelW}" y="${by}" width="${trackW}" height="${barH}" rx="3" fill="#D6D7D8"/>`
      + `<rect x="${labelW}" y="${by}" width="${fillW.toFixed(1)}" height="${barH}" rx="3" fill="${r.color}"/>`
      + `<text x="${labelW + trackW + 6}" y="${cy}" font-family="Arial,sans-serif" font-size="11" fill="#404040" dominant-baseline="central">${Math.round(r.score)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%">${body}</svg>`;
}
// bars: [{type, score, color?}] — Relative Type Pattern Strength (9 bars, Center-color fills).
function renderTypeStrengthChart(bars) {
  const byType = {}; bars.forEach(b => { byType[b.type] = b; });
  const rows = SVG_TYPE_BAR_ORDER.filter(t => byType[t]).map(t => {
    const center = SVG_TYPE_META[t].center;
    return { label: t, score: byType[t].score, color: byType[t].color || CENTER_COLORS[center].fill, labelColor: CENTER_COLORS[center].text };
  });
  return _barChartSVG(rows);
}
// bars: [{code, score}] — Relative Instincts Strength (3 bars, all Hive Orange).
function renderInstinctChart(bars) {
  const byCode = {}; bars.forEach(b => { byCode[b.code] = b; });
  const rows = ['SP', 'SO', 'SX'].filter(c => byCode[c]).map(c => ({ label: c, score: byCode[c].score, color: PALETTE.hiveOrange, labelColor: PALETTE.hiveOrange }));
  return _barChartSVG(rows);
}

// A2/A3 — palette + type scale as :root CSS variables for Phase 5/6 templates.
function partAStyles() {
  return `<style>
:root{
  --hive-blue:${PALETTE.hiveBlue};--hive-orange:${PALETTE.hiveOrange};
  --body:${PALETTE.body};--section-title:${PALETTE.sectionTitle};--alt-pill-text:${PALETTE.altPillText};
  --gut:${PALETTE.gut};--heart:${PALETTE.heart};--head-fill:${PALETTE.headFill};--head-text:${PALETTE.headText};
  --track:${PALETTE.track};--leading-pill-bg:${PALETTE.leadingPillBg};--leading-pill-text:${PALETTE.leadingPillText};
  --confidence-bg:${PALETTE.confidenceBg};--confidence-text:${PALETTE.confidenceText};
  --alternate-pill-bg:${PALETTE.alternatePillBg};--callout-bg:${PALETTE.calloutBg};--teal-box:${PALETTE.tealBox};--footer:${PALETTE.footer};
  --fs-title:13pt;--fs-name:24pt;--fs-section-label:9pt;--fs-body:10pt;--lh-body:15pt;
}
body{font-family:Arial,Helvetica,sans-serif;color:var(--body);}
</style>`;
}

// ============================================================================
// PART B — Coach Report (Step 7 Phase 5). Pure templating off the coach view-model
// (report_prep.buildCoachModel). US Letter; flowing layout (min-height, no clip).
// data-budget/data-zone attributes are now inert (measurement gate removed). V1 buildCoachHTML untouched.
// ============================================================================

// B2: 6 static clarification questions, identical on every report (placeholder wording
// pending Mo review — flagged in the Phase 5 notes).
const COACH_CLARIFICATION_QUESTIONS = [
  'When you walk into a room, where does your attention go first?',
  'What are you usually moving toward — or away from — without noticing?',
  'When something matters deeply to you, what do you do?',
  'What feeling is closest to the surface for you, and which takes longest to reach?',
  'When you are at your best, what is true? When you are stretched thin, what changes?',
  'What do people consistently misread about you?',
];

const _bcBullets = (arr) => (arr || []).map(b =>
  `<div class="bc-bullet">${esc(b)}</div>`).join('');
const _bcRevealed = (arr) => (arr || []).map(r =>
  `<div class="bc-bullet">${r.bold_lead ? `<strong>${esc(r.bold_lead)}</strong> ` : ''}${esc(r.body)}</div>`).join('');
const _agRow = (label, value, color) =>
  `<div class="ag-row"><span class="ag-label">${esc(label)}</span><span class="ag-val" style="color:${color || '#404040'}">${value}</span></div>`;

function _coachPage1(m) {
  const wings = m.ataglance.wings.map(w => `Type ${w.number} — ${esc(w.name)}`).join('<br>');
  const pill = `
    <div class="bc-pill">
      <div class="bc-pill-num">Type ${m.hero.number}</div>
      <div class="bc-pill-name">${esc(m.hero.name)}</div>
      <div class="bc-pill-sub">${esc(m.hero.subtype_name)} Subtype</div>
    </div>
    <div class="bc-badges">
      <span class="bc-conf">${esc(m.confidence.label)} confidence</span>
      ${m.confidence.near_tie ? '<span class="bc-tie">Near-Tie (see notes)</span>' : ''}
      <span class="bc-alt">Alternate: Type ${m.alternate.number} — ${esc(m.alternate.name)}</span>
    </div>`;
  const redirect = m.redirect
    ? `<div class="bc-redirect">REDIRECT — confirmed type differs from the leading coherence bar (originally Type ${m.redirect.from_type}). The chart shows the coherence ranking; the hero reflects the Stage 4 evidence.</div>`
    : '';
  return `
  <div class="report-page">
    <div class="page-header"><div class="ph-title">Coach Prep Report · Type ${m.hero.number} — ${esc(m.hero.name)}</div></div>
    <div class="page-body" data-page="1" data-zone="page1-body">
      <div class="bc-grid">
        <div class="bc-left" data-budget="880" data-zone="p1-left">
          <div class="bc-label">Leading Type Hypothesis</div>
          ${pill}${redirect}
          <div class="bc-label">The Bottom Line</div>
          <p class="bc-body">${esc(m.bottom_line)}</p>
          <div class="bc-label">What ${esc(m.client.first_name || 'the client')} Revealed</div>
          ${_bcRevealed(m.responses_revealed)}
        </div>
        <div class="bc-right">
          <div class="bc-svg">${buildEnneagramSVG(m.svg)}</div>
          <div class="bc-ataglance">
            ${_agRow('Wings', wings, m.ataglance.centerColor)}
            ${_agRow('Stress', `Type ${m.ataglance.stress.number} — ${esc(m.ataglance.stress.name)}`, '#D0312D')}
            ${_agRow('Release', `Type ${m.ataglance.release.number} — ${esc(m.ataglance.release.name)}`, '#4F845C')}
            ${_agRow('Center of Intelligence', esc(m.ataglance.center), m.ataglance.centerColor)}
          </div>
          <div class="bc-chart-title">Relative Type Pattern Strength</div>
          ${renderTypeStrengthChart(m.charts.types)}
          <div class="bc-chart-title">Relative Instincts Strength</div>
          ${renderInstinctChart(m.charts.instincts)}
          <div class="bc-reminder">These are hypotheses to inform the debrief — not labels to assign.</div>
        </div>
      </div>
    </div>
    <div class="page-footer">© Hive · Confidential · Page 1</div>
  </div>`;
}

function _coachPage2(m) {
  const c = m.comparison;
  const row = (label, lead, alt) => `
    <tr><td class="cmp-label">${esc(label)}</td>
      <td class="cmp-lead">${esc(lead || '')}</td>
      <td class="cmp-alt">${esc(alt || '')}</td></tr>`;
  const quotes = (c.client_words.quotes || []).map(q => `“${esc(q)}”`).join('<br>');
  return `
  <div class="report-page">
    <div class="page-header"><div class="ph-title">Type Hypothesis Comparison</div></div>
    <div class="page-body" data-page="2" data-zone="page2-body">
      ${c.note ? `<div class="bc-callout" data-zone="p2-callout">${esc(c.note)}</div>` : ''}
      <table class="cmp" data-zone="p2-table">
        <thead><tr><th></th>
          <th class="cmp-lead-h">Type ${c.leading.number} — ${esc(c.leading.name)}</th>
          <th class="cmp-alt-h">Type ${c.alternate.number} — ${esc(c.alternate.name)}</th></tr></thead>
        <tbody>
          ${row('Core Motivation', c.leading.rows.core_motivation, c.alternate.rows.core_motivation)}
          ${row('Focus of Attention', c.leading.rows.focus, c.alternate.rows.focus)}
          ${row('Energy Goes To', c.leading.rows.energy, c.alternate.rows.energy)}
          ${row('Gifts', c.leading.rows.gifts, c.alternate.rows.gifts)}
          ${row('Challenges', c.leading.rows.challenges, c.alternate.rows.challenges)}
          <tr><td class="cmp-label">Key Discriminator</td><td class="cmp-disc" colspan="2">${esc(c.discriminator || '')}</td></tr>
          <tr><td class="cmp-label">In ${esc(m.client.first_name || 'Client')}'s Words</td>
            <td class="cmp-lead">${quotes}</td>
            <td class="cmp-alt">${esc(c.client_words.absence_note || '')}</td></tr>
        </tbody>
      </table>
      <div class="bc-label">Clarification Questions</div>
      <div class="bc-qlist">${COACH_CLARIFICATION_QUESTIONS.map(q => `<div class="bc-q">${esc(q)}</div>`).join('')}</div>
    </div>
    <div class="page-footer">© Hive · Confidential · Page 2</div>
  </div>`;
}

function _coachPage3(m) {
  const section = (title, blk, zone) => `
    <div class="dbf-section" data-zone="${zone}" data-budget="330">
      <div class="bc-label">${esc(title)}</div>
      <div class="dbf-q">${esc(blk.question || '')}</div>
      ${_bcBullets(blk.bullets)}
    </div>`;
  return `
  <div class="report-page">
    <div class="page-header"><div class="ph-title">Debriefing Tips</div></div>
    <div class="page-body bc-9pt" data-page="3" data-zone="page3-body">
      <div class="dbf-cols">
        ${section('Debriefing the ' + esc(m.hero.subtype_name) + ' Subtype', m.debrief.subtype, 'p3-subtype')}
        ${section('Debriefing the Stress & Release Points', m.debrief.lines, 'p3-lines')}
        ${section('Debriefing the Wings', m.debrief.wings, 'p3-wings')}
      </div>
    </div>
    <div class="page-footer">© Hive · Confidential · Page 3</div>
  </div>`;
}

function _coachPage4() {
  return `
  <div class="report-page">
    <div class="page-header"><div class="ph-title">Coach-Type Preparation</div></div>
    <div class="page-body" data-page="4" data-zone="page4-body">
      <div class="bc-placeholder">Reserved — coach-type preparation (type-on-type) is being designed offline and will inherit this layout.</div>
    </div>
    <div class="page-footer">© Hive · Confidential · Page 4</div>
  </div>`;
}

function coachReportStyles() {
  return `<style>
  @page { size: 8.5in 11in; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: var(--body); }
  .report-page { width: 816px; min-height: 1056px; padding: 40px 48px; position: relative; page-break-after: always; background: #fff; display: flex; flex-direction: column; }
  .page-header { height: 56px; border-bottom: 1px solid #ddd; margin-bottom: 16px; }
  .ph-title { font-size: 9pt; font-weight: bold; letter-spacing: .06em; text-transform: uppercase; color: var(--hive-blue); padding-top: 8px; }
  .page-body { flex: 1 1 auto; }
  .page-footer { margin-top: auto; font-size: 7pt; color: var(--footer); text-align: center; }
  .bc-label { font-size: 9pt; font-weight: bold; letter-spacing: .06em; text-transform: uppercase; color: var(--hive-blue); margin: 14px 0 6px; }
  .bc-body { font-size: 10pt; line-height: 15pt; margin: 0 0 8px; }
  .bc-bullet { font-size: 10pt; line-height: 15pt; margin: 0 0 6px; padding-left: 12px; position: relative; }
  .bc-bullet::before { content: "•"; color: var(--hive-orange); position: absolute; left: 0; }
  .bc-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 22px; height: 100%; }
  .bc-pill { background: var(--leading-pill-bg); border-radius: 8px; padding: 12px 16px; }
  .bc-pill-num { font-size: 27pt; font-weight: bold; color: var(--leading-pill-text); line-height: 1; }
  .bc-pill-name { font-size: 14pt; font-weight: bold; color: var(--leading-pill-text); }
  .bc-pill-sub { font-size: 10pt; color: var(--leading-pill-text); }
  .bc-badges { margin: 8px 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .bc-conf { font-size: 9pt; font-weight: bold; color: var(--confidence-text); background: var(--confidence-bg); border-radius: 10px; padding: 3px 10px; }
  .bc-tie { font-size: 9pt; font-weight: bold; color: #B25A00; background: #FBE8D6; border-radius: 10px; padding: 3px 10px; }
  .bc-alt { font-size: 9pt; font-style: italic; color: var(--alt-pill-text); background: var(--alternate-pill-bg); border-radius: 10px; padding: 3px 10px; }
  .bc-redirect { font-size: 9pt; color: #B25A00; background: #FBE8D6; border-radius: 6px; padding: 8px 10px; margin: 6px 0; }
  .bc-svg { width: 280px; height: 280px; margin: 0 auto 6px; }
  .ag-row { display: flex; justify-content: space-between; gap: 8px; font-size: 10pt; padding: 3px 0; border-bottom: 1px solid #eee; }
  .ag-label { font-weight: bold; color: var(--body); }
  .ag-val { text-align: right; font-weight: 600; }
  .bc-chart-title { font-size: 9pt; font-weight: bold; color: var(--section-title); margin: 10px 0 4px; }
  .bc-reminder { font-size: 10pt; font-style: italic; color: var(--hive-blue); margin-top: 10px; }
  .bc-callout { background: var(--callout-bg); border-left: 4px solid var(--hive-orange); border-radius: 4px; padding: 10px 14px; font-size: 10pt; line-height: 15pt; margin-bottom: 12px; }
  table.cmp { width: 100%; border-collapse: collapse; }
  table.cmp th, table.cmp td { text-align: left; vertical-align: top; padding: 4px 8px; font-size: 10pt; line-height: 13pt; border-bottom: 1px solid #eee; }
  .cmp-label { font-size: 9pt; font-weight: bold; color: var(--section-title); width: 18%; }
  .cmp-lead-h, .cmp-alt-h { font-size: 12pt; font-weight: bold; color: var(--leading-pill-text); }
  .cmp-lead { background: var(--leading-pill-bg); }
  .cmp-alt { background: var(--callout-bg); }
  .cmp-disc { font-style: italic; color: var(--body); }
  .bc-qlist { columns: 2; column-gap: 22px; }
  .bc-q { font-size: 10pt; font-style: italic; color: var(--hive-blue); margin-bottom: 6px; break-inside: avoid; }
  .bc-9pt .bc-label { margin-top: 8px; }
  .bc-9pt .bc-bullet { font-size: 9pt; line-height: 13.5pt; }
  .dbf-cols { columns: 2; column-gap: 24px; }
  .dbf-section { break-inside: avoid; margin-bottom: 12px; }
  .dbf-q { font-size: 10pt; font-style: italic; color: var(--hive-blue); margin-bottom: 6px; }
  .bc-placeholder { font-size: 10pt; color: #888; font-style: italic; padding-top: 40px; text-align: center; }
  </style>`;
}

// Build the full 3-page (+placeholder) coach report HTML from the coach view-model.
function buildCoachReportHTML(model, opts = {}) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Coach Report — Type ${model.hero.number}</title>
${partAStyles()}
${coachReportStyles()}
</head><body>
${_coachPage1(model)}
${_coachPage2(model)}
${_coachPage3(model)}
${_coachPage4()}
</body></html>`;
}

// US Letter PDF options (A1). Margins are 0 — the template owns its padding so the
// measurement gate and the PDF agree on geometry. V1 buildPdfOptions (A4) untouched.
function buildCoachPdfOptions() {
  return {
    width: '8.5in', height: '11in',
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
    preferCSSPageSize: true,
  };
}

// ============================================================================
// PART C — Client Report (Step 7 Phase 6a). 10 pages (Title + TOC + 8 body) off
// the client view-model (report_prep.buildClientModel). US Letter; flowing layout
// (min-height, no clip; data-page/data-zone attributes now inert). V1 buildClientHTML untouched (retired in 6b).
// ============================================================================

const _clBullets = (arr) => (arr || []).map(b => `<div class="cl-bullet">${esc(b)}</div>`).join('');
const _clHeader = (title) => `<div class="page-header"><div class="ph-title">${esc(title)}</div></div>`;
const _clFooter = (n) => `<div class="page-footer">© Hive · Confidential · Page ${n}</div>`;

function _clPage(title, n, bodyClass, inner) {
  return `<div class="report-page">${_clHeader(title)}
    <div class="page-body ${bodyClass || ''}" data-page="${n}" data-zone="p${n}-body">${inner}</div>
    ${_clFooter(n)}</div>`;
}

// Title (cover) — V2 template-ported (title_page.html). Absolute-positioned cover chrome
// (masthead/hero/footer) in its own .cover/.cv-* namespace — does NOT reuse P2's flow
// classes. Symbol authored by buildEnneagramSVG(m.svg.base) (single SVG source; the
// template's inline base SVG is preview-only). Only dynamic fields: client name + date.
function _clTitle(m) {
  return `<div class="cover">
  <div class="cv-masthead">${HIVE_LOGO_SVG}<div class="cv-report-label">INSIGHTOUT ENNEAGRAM REPORT</div></div>
  <div class="cv-hero">
    <div class="cv-symbol">${buildEnneagramSVG(m.svg.base)}</div>
    <div class="cv-supertitle">INSIGHTOUT BY HIVE</div>
    <h1 class="cv-title">Your <span class="cv-accent">Enneagram</span><br>Report</h1>
    <hr class="cv-rule">
    <p class="cv-tagline">Understanding yourself from the inside out.</p>
    <div class="cv-prepared-card">
      <div class="cv-tp-label">PREPARED FOR</div>
      <div class="cv-tp-name">${esc(m.client.full_name)}</div>
      <div class="cv-tp-date">${esc(m.client.date)}</div>
    </div>
  </div>
  <div class="cv-footer">
    <span>© Copyright 2026 Hive, Inc. All rights reserved.</span>
    <span>Client confidential - for use by report owner only.</span>
  </div>
</div>`;
}

// TOC (cover) — V2 template-ported (toc_page.html). Numbered-badge + leader-dot + page-num
// layout in the .cover/.cv-* namespace. Entries 4/5/6/7 are personalized from existing
// frozen display.* fields. The template's {{type_name}} slot is resolved HERE by mapping
// the existing m.display.confirmed_type_name (no new model field; prep layer untouched).
function _clTOC(m) {
  const D = m.display;
  const entries = [
    ['Welcome from Cai &amp; Monique', 'What this report is, how to use it, and what to bring to your debrief.'],
    ['What Is the Enneagram?', 'A brief introduction to the system — nine types, one dynamic map.'],
    ['Your Type Hypotheses', 'Your leading and alternate type hypotheses, your core motivation, and how the two compare.'],
    ['How Your Type Shows Up', `Characteristic patterns of thinking, feeling, and behaving for ${esc(D.confirmed_type_name)}.`],
    ['Wings &amp; Lines', `The adjacent types that flavor your ${esc(D.type_word)} — and where your energy goes under stress and in flow.`],
    ['Instincts &amp; Subtypes', `Your dominant instinct, your instinct stack, and what it means to be a ${esc(D.subtype_label)}.`],
    ['Strengths, Challenges, &amp; Growth', `The gifts of the ${esc(D.type_word)} pattern and the places where the same gifts create friction.`],
    ['Putting It All Together', 'Communication style, conflict style, and coming back to center — your type in everyday practice.'],
  ];
  const rows = entries.map(([t, d], i) => `
      <li class="cv-entry">
        <div class="cv-num">${i + 1}</div>
        <div class="cv-entry-main">
          <div class="cv-entry-titleline">
            <span class="cv-entry-title">${t}</span>
            <span class="cv-leader"></span>
            <span class="cv-entry-page">${i + 1}</span>
          </div>
          <div class="cv-entry-desc">${d}</div>
        </div>
      </li>`).join('');
  return `<div class="cover">
  <div class="cv-masthead">${HIVE_LOGO_SVG}<div class="cv-report-label">INSIGHTOUT ENNEAGRAM REPORT</div></div>
  <div class="cv-header-rule"></div>
  <div class="cv-body">
    <div class="cv-toc-label">PREPARED FOR</div>
    <div class="cv-toc-name">${esc(m.client.full_name)}</div>
    <div class="cv-type-line">Type ${m.hero.number} — ${esc(m.hero.name)}<span class="cv-sep">·</span>${esc(D.instinct_label)} Subtype<span class="cv-sep">·</span>${esc(m.client.date)}</div>
    <div class="cv-section-heading">WHAT'S IN THIS REPORT</div>
    <ul class="cv-toc">${rows}
    </ul>
  </div>
  <div class="cv-footer">
    <span>© Copyright 2026 Hive, Inc. All rights reserved.</span>
    <span>Client confidential - for use by report owner only.</span>
  </div>
</div>`;
}

function _clP1Welcome(m) {
  const paras = (m.pages.welcome.body || '').split('\n\n').map(p => `<p class="cl-body">${esc(p)}</p>`).join('');
  const inner = `
    <div class="cl-greeting">Welcome, ${esc(m.pages.welcome.greeting_name)}!</div>
    <div class="cl-welcome">${paras}</div>
    <div class="cl-sigs">
      <div class="cl-sig"><strong>Cai Delumpa</strong><br>Co-Founder, Hive Inc.<br>Type 7 — The Enthusiast</div>
      <div class="cl-sig"><strong>Monique Breault</strong><br>Co-Founder, Hive Inc.<br>Type 9 — The Peacemaker</div>
    </div>`;
  return _clPage('Welcome', 1, 'cl-center', inner);
}

// Hive wordmark logo (masthead). Ported verbatim from the V2 templates; reused by every
// page's masthead as pages are ported. Carries class="logo" (sized by .logo in the stylesheet).
const HIVE_LOGO_SVG = `<svg class="logo" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 420.551 132.143">
<defs>
<clipPath id="clip-0">
<path clip-rule="nonzero" d="M 232 26 L 355 26 L 355 101 L 232 101 Z M 232 26 "/>
</clipPath>
<clipPath id="clip-1">
<path clip-rule="nonzero" d="M 232.398438 26.914062 L 232.398438 100.621094 L 239.242188 100.621094 L 239.242188 81.113281 C 239.242188 74.074219 239.570312 69.253906 240.21875 66.648438 C 241.261719 62.605469 243.421875 59.21875 246.691406 56.480469 C 249.96875 53.75 253.679688 52.382812 257.816406 52.382812 C 261.4375 52.382812 264.359375 53.261719 266.582031 55.039062 C 268.816406 56.816406 270.363281 59.457031 271.207031 62.980469 C 271.695312 65.03125 271.9375 69.121094 271.9375 75.25 L 271.9375 100.621094 L 278.785156 100.621094 L 278.785156 73.25 C 278.785156 65.980469 278.050781 60.640625 276.585938 57.242188 C 275.117188 53.828125 272.84375 51.121094 269.765625 49.101562 C 266.683594 47.078125 263.160156 46.074219 259.183594 46.074219 C 255.308594 46.074219 251.707031 46.976562 248.378906 48.777344 C 245.058594 50.59375 242.019531 53.324219 239.242188 56.964844 L 239.242188 26.914062 Z M 347.367188 47.4375 L 329.71875 86.152344 L 311.925781 47.4375 L 304.640625 47.4375 L 329.128906 100.621094 L 330.347656 100.621094 L 354.699219 47.4375 Z M 290.519531 100.621094 L 297.410156 100.621094 L 297.410156 47.4375 L 290.519531 47.4375 Z M 290.519531 100.621094 "/>
</clipPath>
<clipPath id="clip-2">
<path clip-rule="nonzero" d="M 188 0 L 399 0 L 399 131.292969 L 188 131.292969 Z M 188 0 "/>
</clipPath>
<clipPath id="clip-3">
<path clip-rule="nonzero" d="M 355 47 L 410 47 L 410 102 L 355 102 Z M 355 47 "/>
</clipPath>
<clipPath id="clip-4">
<path clip-rule="nonzero" d="M 368.320312 51.085938 C 361.089844 55.429688 356.976562 61.65625 355.988281 69.761719 C 355.191406 76.140625 356.464844 82.097656 359.792969 87.644531 C 363.332031 93.535156 368.507812 97.609375 375.332031 99.863281 C 382.152344 102.125 389.128906 101.113281 396.253906 96.832031 C 399.460938 94.902344 402.046875 92.6875 404.007812 90.179688 C 405.957031 87.671875 407.394531 84.875 408.296875 81.773438 C 409.214844 78.679688 409.527344 75.140625 409.242188 71.15625 L 403.007812 71.515625 C 403.011719 75.402344 402.667969 78.4375 401.972656 80.605469 C 401.273438 82.773438 400.109375 84.886719 398.46875 86.921875 C 396.832031 88.960938 394.898438 90.648438 392.679688 91.984375 C 388.070312 94.75 383.230469 95.445312 378.148438 94.082031 C 373.058594 92.703125 368.925781 89.507812 365.765625 84.488281 L 405.042969 60.890625 C 401.40625 54.949219 396.808594 50.933594 391.25 48.84375 C 388.117188 47.652344 385.015625 47.058594 381.941406 47.058594 C 377.332031 47.058594 372.789062 48.398438 368.320312 51.085938 M 363.078125 67.191406 C 364.503906 62.582031 367.351562 58.988281 371.640625 56.421875 C 374.234375 54.859375 377.039062 53.921875 380.0625 53.597656 C 383.070312 53.285156 385.847656 53.589844 388.347656 54.523438 C 390.859375 55.457031 393.386719 57.195312 395.941406 59.742188 L 363.414062 79.289062 C 362.140625 74.578125 362.042969 70.546875 363.078125 67.191406 "/>
</clipPath>
<clipPath id="clip-5">
<path clip-rule="nonzero" d="M 313 4 L 418.972656 4 L 418.972656 131.292969 L 313 131.292969 Z M 313 4 "/>
</clipPath>
</defs>
<path fill-rule="nonzero" fill="rgb(12.713623%, 11.364746%, 11.106873%)" fill-opacity="1" d="M 232.398438 26.914062 L 239.242188 26.914062 L 239.242188 56.964844 C 242.019531 53.324219 245.058594 50.59375 248.378906 48.777344 C 251.707031 46.976562 255.308594 46.074219 259.183594 46.074219 C 263.160156 46.074219 266.683594 47.078125 269.765625 49.101562 C 272.84375 51.121094 275.117188 53.828125 276.585938 57.242188 C 278.050781 60.640625 278.785156 65.980469 278.785156 73.25 L 278.785156 100.621094 L 271.9375 100.621094 L 271.9375 75.25 C 271.9375 69.121094 271.699219 65.03125 271.207031 62.980469 C 270.363281 59.457031 268.816406 56.8125 266.582031 55.039062 C 264.359375 53.261719 261.4375 52.382812 257.820312 52.382812 C 253.679688 52.382812 249.96875 53.75 246.691406 56.480469 C 243.421875 59.21875 241.261719 62.605469 240.21875 66.648438 C 239.570312 69.257812 239.242188 74.074219 239.242188 81.113281 L 239.242188 100.621094 L 232.398438 100.621094 Z M 290.519531 47.4375 L 297.410156 47.4375 L 297.410156 100.621094 L 290.519531 100.621094 Z M 304.640625 47.4375 L 311.925781 47.4375 L 329.71875 86.152344 L 347.367188 47.4375 L 354.699219 47.4375 L 330.347656 100.621094 L 329.125 100.621094 Z M 304.640625 47.4375 "/>
<g clip-path="url(#clip-0)">
<g clip-path="url(#clip-1)">
<rect x="-42.0551" y="-13.2143" width="504.6612" height="158.5716" fill="rgb(12.713623%, 11.364746%, 11.106873%)" fill-opacity="1"/>
<path fill-rule="nonzero" fill="rgb(12.713623%, 11.364746%, 11.106873%)" fill-opacity="1" stroke-width="3.132" stroke-linecap="butt" stroke-linejoin="miter" stroke="rgb(12.713623%, 11.364746%, 11.106873%)" stroke-opacity="1" stroke-miterlimit="10" d="M 226.766817 24.873673 L 361.856029 24.873673 L 361.856029 111.057917 L 226.766817 111.057917 Z M 226.766817 24.873673 " transform="matrix(0.993556, 0, 0, -0.993556, 1.13188, 131.291522)"/>
<path fill="none" stroke-width="3.132" stroke-linecap="butt" stroke-linejoin="miter" stroke="rgb(12.713623%, 11.364746%, 11.106873%)" stroke-opacity="1" stroke-miterlimit="10" d="M -1944.866967 -614.445065 L 857.094024 -614.445065 L 857.094024 343.929545 L -1944.866967 343.929545 Z M -1944.866967 -614.445065 " transform="matrix(0.993556, 0, 0, -0.993556, 1.13188, 131.291522)"/>
</g>
</g>
<g clip-path="url(#clip-2)">
<path fill="none" stroke-width="3.132" stroke-linecap="butt" stroke-linejoin="miter" stroke="rgb(12.713623%, 11.364746%, 11.106873%)" stroke-opacity="1" stroke-miterlimit="10" d="M 0.00121356 0.0000890823 L 6.889348 0.0000890823 L 6.889348 -30.245583 C 9.684704 -26.581348 12.743476 -23.833171 16.085322 -22.004984 C 19.435031 -20.192524 23.059951 -19.284328 26.960082 -19.284328 C 30.962434 -19.284328 34.508723 -20.294745 37.610742 -22.331306 C 40.70883 -24.363934 42.997012 -27.088522 44.475287 -30.524726 C 45.949631 -33.945204 46.688769 -39.319678 46.688769 -46.636355 L 46.688769 -74.184962 L 39.796703 -74.184962 L 39.796703 -48.649326 C 39.796703 -42.480672 39.556876 -38.364304 39.061497 -36.300222 C 38.212274 -32.753934 36.655367 -30.092252 34.406502 -28.307313 C 32.16943 -26.518442 29.228606 -25.633836 25.58796 -25.633836 C 21.420481 -25.633836 17.685477 -27.00989 14.386878 -29.758067 C 11.096142 -32.514107 8.921977 -35.92279 7.872244 -39.991979 C 7.219601 -42.618277 6.889348 -47.46592 6.889348 -54.550633 L 6.889348 -74.184962 L 0.00121356 -74.184962 Z M 58.499246 -20.656451 L 65.434559 -20.656451 L 65.434559 -74.184962 L 58.499246 -74.184962 Z M 72.71192 -20.656451 L 80.044324 -20.656451 L 97.952687 -59.622376 L 115.715582 -20.656451 L 123.095164 -20.656451 L 98.585672 -74.184962 L 97.355086 -74.184962 Z M 72.71192 -20.656451 " transform="matrix(0.993556, 0, 0, -0.993556, 232.397232, 26.914151)"/>
</g>
<path fill-rule="nonzero" fill="rgb(12.713623%, 11.364746%, 11.106873%)" fill-opacity="1" d="M 403.007812 71.515625 L 409.242188 71.15625 C 409.527344 75.140625 409.214844 78.679688 408.296875 81.773438 C 407.394531 84.875 405.957031 87.671875 404.007812 90.179688 C 402.046875 92.6875 399.460938 94.902344 396.253906 96.832031 C 389.128906 101.113281 382.152344 102.125 375.335938 99.863281 C 368.507812 97.609375 363.332031 93.53125 359.792969 87.644531 C 356.464844 82.097656 355.191406 76.140625 355.988281 69.761719 C 356.976562 61.65625 361.089844 55.433594 368.320312 51.085938 C 375.765625 46.609375 383.414062 45.871094 391.25 48.84375 C 396.808594 50.933594 401.410156 54.949219 405.042969 60.890625 L 365.765625 84.488281 C 368.925781 89.511719 373.058594 92.703125 378.148438 94.082031 C 383.230469 95.449219 388.070312 94.75 392.679688 91.984375 C 394.898438 90.648438 396.832031 88.960938 398.46875 86.921875 C 400.109375 84.886719 401.273438 82.773438 401.972656 80.605469 C 402.667969 78.4375 403.011719 75.402344 403.007812 71.515625 M 395.941406 59.742188 C 393.386719 57.195312 390.859375 55.457031 388.347656 54.523438 C 385.847656 53.589844 383.070312 53.285156 380.058594 53.597656 C 377.039062 53.921875 374.234375 54.859375 371.640625 56.421875 C 367.351562 58.988281 364.503906 62.582031 363.078125 67.191406 C 362.042969 70.546875 362.140625 74.578125 363.414062 79.289062 Z M 395.941406 59.742188 "/>
<g clip-path="url(#clip-3)">
<g clip-path="url(#clip-4)">
<path fill-rule="nonzero" fill="rgb(12.713623%, 11.364746%, 11.106873%)" fill-opacity="1" d="M -1883.691406 518.421875 L 774.582031 750.992188 L 854.128906 -158.238281 L -1804.140625 -390.808594 Z M -1883.691406 518.421875 "/>
<path fill-rule="nonzero" fill="rgb(12.713623%, 11.364746%, 11.106873%)" fill-opacity="1" stroke-width="3.002" stroke-linecap="butt" stroke-linejoin="miter" stroke="rgb(12.713623%, 11.364746%, 11.106873%)" stroke-opacity="1" stroke-miterlimit="10" d="M 0.00110752 -0.000795406 L 55.204473 33.166044 L 88.909939 -22.925859 L 33.706574 -56.09663 Z M 0.00110752 -0.000795406 " transform="matrix(0.993556, 0, 0, -0.993556, 338.080931, 62.59296)"/>
<path fill="none" stroke-width="3.002" stroke-linecap="butt" stroke-linejoin="miter" stroke="rgb(12.713623%, 11.364746%, 11.106873%)" stroke-opacity="1" stroke-miterlimit="10" d="M -0.000815861 0.000952604 L 2675.512584 -234.077671 L 2755.575352 681.04952 L 80.065884 915.128143 Z M -0.000815861 0.000952604 " transform="matrix(0.993556, 0, 0, -0.993556, -1883.690596, 518.422821)"/>
</g>
</g>
<g clip-path="url(#clip-5)">
<path fill="none" stroke-width="3.002" stroke-linecap="butt" stroke-linejoin="miter" stroke="rgb(12.713623%, 11.364746%, 11.106873%)" stroke-opacity="1" stroke-miterlimit="10" d="M 0.00025833 -0.00013232 L 6.275066 0.361573 C 6.562071 -3.648642 6.247545 -7.210657 5.323623 -10.324471 C 4.415427 -13.446148 2.968604 -16.261162 1.006744 -18.785239 C -0.966911 -21.309315 -3.56962 -23.538523 -6.79745 -25.480726 C -13.968658 -29.789741 -20.990466 -30.808021 -27.85108 -28.531634 C -34.723488 -26.263111 -39.932836 -22.158537 -43.494851 -16.233641 C -46.84456 -10.650792 -48.126256 -4.655127 -47.324213 1.765149 C -46.329523 9.923185 -42.189565 16.186197 -34.912204 20.56205 C -27.418606 25.067645 -19.720565 25.810714 -11.833808 22.818779 C -6.239165 20.715382 -1.607759 16.673714 2.048613 10.693775 L -37.48346 -13.056921 C -34.302808 -18.112938 -30.143193 -21.325042 -25.02034 -22.712891 C -19.905349 -24.088945 -15.034117 -23.385191 -10.394849 -20.60163 C -8.161709 -19.257029 -6.215575 -17.558585 -4.568242 -15.506298 C -2.916977 -13.457943 -1.745365 -11.330956 -1.041611 -9.148927 C -0.341789 -6.966898 0.00418991 -3.912058 0.00025833 -0.00013232 Z M -7.111976 11.849661 C -9.683232 14.413053 -12.226967 16.162608 -14.754975 17.102256 C -17.271188 18.041905 -20.066544 18.348568 -23.097795 18.034042 C -26.136909 17.70772 -28.959786 16.76414 -31.570358 15.191507 C -35.887237 12.608456 -38.753361 8.991399 -40.188389 4.352131 C -41.230259 0.9749 -41.131969 -3.082494 -39.850273 -7.823984 Z M -7.111976 11.849661 " transform="matrix(0.993556, 0, 0, -0.993556, 403.007556, 71.515494)"/>
</g>
<path fill-rule="nonzero" fill="rgb(95.883179%, 45.910645%, 10.510254%)" fill-opacity="1" d="M 9.691406 37.085938 L 65.496094 5.128906 L 120.308594 36.878906 L 120.433594 50.542969 L 109.875 57.371094 L 109.875 43.339844 L 65.664062 17.628906 L 20.703125 43.214844 L 20.578125 89.664062 L 65.539062 115.246094 L 93.480469 99.476562 L 104.164062 105.683594 L 65.664062 127.542969 L 9.898438 95.996094 Z M 9.691406 37.085938 "/>
<path fill-rule="nonzero" fill="rgb(28.529358%, 71.832275%, 86.001587%)" fill-opacity="1" d="M 27.410156 46.941406 L 65.539062 25.578125 L 102.921875 46.816406 L 103.046875 61.71875 L 97.207031 65.570312 L 97.082031 50.542969 L 65.414062 32.285156 L 33.496094 50.542969 L 33.496094 82.832031 L 65.539062 100.71875 L 90.625 87.800781 L 90.625 94.257812 L 65.539062 107.671875 L 27.535156 86.308594 Z M 27.410156 46.941406 "/>
<path fill-rule="nonzero" fill="rgb(28.529358%, 71.832275%, 86.001587%)" fill-opacity="1" d="M 124.40625 34.023438 L 113.726562 27.816406 L 151.355469 4.960938 L 206.25 36.878906 L 206.25 96.371094 L 151.480469 127.667969 L 95.84375 95.625 L 95.84375 85.191406 L 106.523438 78.238281 L 106.523438 89.664062 L 151.480469 115.125 L 195.570312 90.035156 L 195.570312 43.214844 L 151.480469 17.753906 Z M 124.40625 34.023438 "/>
<path fill-rule="nonzero" fill="rgb(95.883179%, 45.910645%, 10.510254%)" fill-opacity="1" d="M 125.523438 41.101562 L 151.605469 25.332031 L 189.234375 46.816406 L 189.234375 86.683594 L 151.730469 107.671875 L 113.601562 86.1875 L 113.601562 73.519531 L 119.6875 69.792969 L 119.6875 82.832031 L 151.730469 100.71875 L 183.152344 82.957031 L 183.152344 50.542969 L 151.605469 32.410156 L 125.523438 48.058594 Z M 125.523438 41.101562 "/>
</svg>`;

// P2 "What Is the Enneagram?" — fully static (template-ported, V2). Full template chrome
// (masthead + header-rule + 3-span footer). Content is byte-static; the only dynamic
// element is the Enneagram symbol, which is authored by buildEnneagramSVG(m.svg.base)
// (single SVG source — the template's inline copy is preview-only and is NOT used here).
function _clP2Primer(m) {
  return `<div class="page">
  <div class="page-body">
  <div class="masthead">${HIVE_LOGO_SVG}<div></div></div>
  <div class="header-rule"></div>
  <div class="intro">
    <div class="intro-left">
      <span class="badge-label">WHAT IS THE ENNEAGRAM?</span>
      <p>The Enneagram is a dynamic system that describes nine distinct ways of being in the world — nine strategies, shaped early in life, for how to get what we need, stay safe, and belong. Each type is anchored by a core worldview and a deep motivational drive that shapes everything: how we think, what we feel, and how we act.</p>
      <p>Understanding your type isn't about putting yourself in a box. It's about seeing the pattern clearly enough that you have a choice about it.</p>
    </div>
    <div class="intro-right">
      <div class="intro-symbol">${buildEnneagramSVG(m.svg.base)}</div>
    </div>
  </div>
  <div class="feature-cards">
    <div class="fcard"><div class="ft">Dynamic</div><div class="fd">A map of how you move, not just where you sit.</div></div>
    <div class="fcard"><div class="ft">Motivational</div><div class="fd">Driven by your deeper "why," not just what you do.</div></div>
    <div class="fcard"><div class="ft">Relational</div><div class="fd">A lens to see yourself and everyone around you.</div></div>
  </div>
  <div class="grid-head">THE NINE ENNEAGRAM TYPES – SCAN EACH ONE</div>
  <div class="grid-instr">As you read, notice which descriptions pull at you – even slightly. That's the Enneagram beginning to work.</div>
  <div class="grid">
    <div class="tcard body">
      <div class="thead">TYPE 8 · BODY CENTER</div>
      <div class="tname">The Protector</div>
      <div class="tdesc">Sees a world where only the strong protect the weak. Motivated to assert strength and guard against injustice. Attention goes to power dynamics and who needs protecting.</div>
      <div class="tgifts">Gifts: Strength, advocacy, courage</div>
    </div>
    <div class="tcard body">
      <div class="thead">TYPE 9 · BODY CENTER</div>
      <div class="tname">The Peacemaker</div>
      <div class="tdesc">Sees a world with underlying unity that conflict threatens. Motivated to maintain harmony and avoid disconnection. Attention goes to others' perspectives and seeking common ground.</div>
      <div class="tgifts">Gifts: Inclusion, steadiness, presence</div>
    </div>
    <div class="tcard body">
      <div class="thead">TYPE 1 · BODY CENTER</div>
      <div class="tname">The Improver</div>
      <div class="tdesc">Sees a world that falls short of what it could be. Motivated to be good, principled, and beyond criticism. Attention goes to what's wrong or is broken.</div>
      <div class="tgifts">Gifts: Integrity, discernment, high standards</div>
    </div>
    <div class="tcard heart">
      <div class="thead">TYPE 2 · HEART CENTER</div>
      <div class="tname">The Giver</div>
      <div class="tdesc">Sees a world where love is earned through service. Motivated to be needed and seen as caring. Attention goes to others' needs and relationship dynamics.</div>
      <div class="tgifts">Gifts: Warmth, attunement, deep care</div>
    </div>
    <div class="tcard heart">
      <div class="thead">TYPE 3 · HEART CENTER</div>
      <div class="tname">The Performer</div>
      <div class="tdesc">Sees a world that rewards results. Motivated to achieve and be recognized as valuable. Attention goes to goals, image, and how others perceive them.</div>
      <div class="tgifts">Gifts: Drive, adaptability, inspiring</div>
    </div>
    <div class="tcard heart">
      <div class="thead">TYPE 4 · HEART CENTER</div>
      <div class="tname">The Individualist</div>
      <div class="tdesc">Sees a world with infinite depth but always something missing. Motivated to be authentic and deeply known. Attention goes to what's absent or lacking.</div>
      <div class="tgifts">Gifts: Depth, originality, emotional honesty</div>
    </div>
    <div class="tcard head">
      <div class="thead">TYPE 5 · HEAD CENTER</div>
      <div class="tname">The Observer</div>
      <div class="tdesc">Sees a world that is overwhelming and intrusive. Motivated to be competent and self-sufficient. Attention goes to ideas, concepts, and conserving energy.</div>
      <div class="tgifts">Gifts: Clarity, insight, objectivity</div>
    </div>
    <div class="tcard head">
      <div class="thead">TYPE 6 · HEAD CENTER</div>
      <div class="tname">The Questioner</div>
      <div class="tdesc">Sees a world that is unpredictable and unsafe. Motivated by security, trust, and preparedness. Attention goes to potential threats and who can be counted on.</div>
      <div class="tgifts">Gifts: Loyalty, foresight, fierce commitment</div>
    </div>
    <div class="tcard head">
      <div class="thead">TYPE 7 · HEAD CENTER</div>
      <div class="tname">The Enthusiast</div>
      <div class="tdesc">Sees a world full of possibility, threatened by limitation and pain. Motivated to stay free and experience life fully. Attention goes to options and what's next.</div>
      <div class="tgifts">Gifts: Possibility, joy, generative energy</div>
    </div>
  </div>
  <div class="closing">We each have access to all Enneagram types — and one of these nine patterns is your home base. Keep reading to find out which type your responses pointed to most clearly.</div>
  </div>
  <div class="footer">
    <span>© Copyright 2026 Hive, Inc. All rights reserved.</span>
    <span class="center">Page 2</span>
    <span>Client confidential - for use by report owner only.</span>
  </div>
</div>`;
}

function _clP3Hypotheses(m) {
  const th = m.pages.type_hypotheses, r = th.comparison_rows;
  const row = (l, v) => `<tr><td class="cmp-label">${esc(l)}</td><td>${esc(v || '')}</td></tr>`;
  const quote = (th.quote || []).map(q => `“${esc(q)}”`).join('<br>');
  const inner = `<div class="cl-2col">
    <div class="cl-2col-l">
      <div class="cl-pill"><span class="cl-pill-num">Type ${th.pill.number}</span> <span class="cl-pill-name">${esc(th.pill.name)}</span><div class="cl-pill-sub">${esc(th.pill.subtype_name)} Subtype</div></div>
      <div class="cl-label">Core Motivation</div><p class="cl-body">${esc(th.core_motivation)}</p>
      ${th.alternate_note ? `<div class="cl-label">A Secondary Pattern Worth Exploring — Type ${m.alternate.number} (${esc(m.alternate.name)})</div><p class="cl-body">${esc(th.alternate_note)}</p>` : ''}
      ${quote ? `<div class="cl-quote"><div class="cl-label">In Your Own Words</div>${quote}</div>` : ''}
      <table class="cmp"><tbody>
        ${row('Core Motivation', r.core_motivation)}${row('Focus of Attention', r.focus)}${row('Energy Goes To', r.energy)}${row('Gifts', r.gifts)}${row('Challenges', r.challenges)}
        ${th.discriminator ? `<tr><td class="cmp-label">Key Distinction</td><td class="cmp-disc">${esc(th.discriminator)}</td></tr>` : ''}
      </tbody></table>
    </div>
    <div class="cl-2col-r"><div class="cl-svg">${buildEnneagramSVG(m.svg.type)}</div>
      <div class="cl-disclaimer">This is a hypothesis to test in your life — not a label.</div></div>
  </div>`;
  return _clPage('Your Type Hypotheses', 3, 'cl-dense', inner);
}

function _clP4Patterns(m) {
  const p = m.pages.patterns;
  const sec = (title, blk, inq) => `
    <div class="pat-sec">
      <div class="cl-label">${esc(title)}</div>
      <p class="cl-body">${esc(blk.intro)}</p>
      <div class="pat-cols">${_clBullets(blk.bullets)}</div>
      <div class="cl-inquiry">${esc(blk.inquiry || inq || '')}</div>
    </div>`;
  const inner = sec('How You Think', p.thinking) + sec('How You Feel', p.feeling) + sec('How You Behave', p.behaving);
  return _clPage('How Your Type Shows Up', 4, '', inner);
}

function _clP5WingsLines(m) {
  const w = m.pages.wings_lines;
  const wing = (x) => `<div class="cl-label">Wing — Type ${x.target_type} (${esc(TYPE_NAMES[x.target_type])})</div><p class="cl-body">${esc(x.body)}</p>`;
  const line = (lbl, x) => `<div class="cl-label">${esc(lbl)} — Type ${x.target_type} (${esc(TYPE_NAMES[x.target_type])})</div><p class="cl-body">${esc(x.narrative)}</p>${x.resource_card ? `<div class="cl-card">${esc(x.resource_card)}</div>` : ''}`;
  const inner = `<div class="cl-2col">
    <div class="cl-2col-l">${wing(w.wings.wing_a)}${wing(w.wings.wing_b)}${line('Stress Point', w.lines.stress)}${line('Security Point', w.lines.security)}</div>
    <div class="cl-2col-r"><div class="cl-svg">${buildEnneagramSVG(m.svg.wings)}</div>
      <div class="cl-sidebar"><div class="cl-side-h">About Wings</div><p class="cl-side-b">${esc(w.wings_primer)}</p>
      <div class="cl-side-h">About Stress & Security Points</div><p class="cl-side-b">${esc(w.lines_primer)}</p></div></div>
  </div>`;
  return _clPage('Wings & Lines', 5, '', inner);
}

function _clP6Instinct(m) {
  const i = m.pages.instinct_subtype, st = i.subtype;
  const defs = (i.instinct_definitions || []).map(d => `<div class="cl-def"><strong>${esc(d.name)} (${esc(d.code)})</strong> ${esc(d.body)}</div>`).join('');
  const stack = (i.instinct_stack || []).map(s => `<div class="cl-stack-row"><span class="cl-stack-l">${esc(s.label)}</span><span>${esc(s.name)} (${esc(s.code)})</span></div>`).join('');
  const evidence = (i.instinct_evidence || []).map(b => `<div class="cl-bullet">${esc(b)}</div>`).join('');
  const inner = `<div class="cl-2col">
    <div class="cl-2col-l">
      <div class="cl-subtype-name">${esc(st.name)}</div><div class="cl-subtype-tag">${esc(st.tagline)}</div>
      <p class="cl-body">${esc(st.narrative)}</p>
      <div class="cl-label">How the ${esc(st.name)} Thinks</div>${_clBullets(st.patterns.thinking)}
      <div class="cl-label">How the ${esc(st.name)} Feels</div>${_clBullets(st.patterns.feeling)}
      <div class="cl-label">How the ${esc(st.name)} Behaves</div>${_clBullets(st.patterns.behaving)}
      ${evidence ? `<div class="cl-orange"><div class="cl-orange-h">In Your Responses</div>${evidence}</div>` : ''}
    </div>
    <div class="cl-2col-r"><div class="cl-sidebar"><div class="cl-side-h">About the Instincts</div><p class="cl-side-b">${esc(i.instinct_primer)}</p>
      <div class="cl-side-h">The Three Instincts</div>${defs}
      <div class="cl-side-h">Your Instincts Stack</div>${stack}</div></div>
  </div>`;
  return _clPage('Instinct & Subtype', 6, 'cl-dense', inner);
}

function _clP7Strengths(m) {
  const s = m.pages.strengths_challenges;
  const cards = (arr, cls) => (arr || []).map(c => `<div class="sc-card ${cls}"><div class="sc-card-t">${esc(c.title)}</div><div class="sc-card-b">${esc(c.body)}</div></div>`).join('');
  const inner = `
    <div class="cl-label">Strengths</div><div class="sc-row">${cards(s.strengths, 'sc-str')}</div>
    <div class="cl-label">Challenges</div><div class="sc-row">${cards(s.challenges, 'sc-chl')}</div>
    <div class="cl-orange"><div class="cl-orange-h">As a ${esc(m.hero.subtype_name)} — What Shifts</div>${_clBullets(s.shifts)}</div>
    <div class="cl-label">Practices That Help</div><p class="cl-body">${esc(s.practices.intro)}</p>${_clBullets(s.practices.bullets)}`;
  return _clPage('Strengths, Challenges & Growth', 7, '', inner);
}

function _clP8Application(m) {
  const a = m.pages.application;
  const block = (title, blk, sub, subTitle) => `
    <div class="app-sec">
      <div class="cl-label">${esc(title)}</div>
      <div class="app-subhead">${esc(blk.subhead)}</div><div class="app-fw">${esc(blk.framework)}</div>
      ${_clBullets(blk.bullets)}
      <div class="app-sub-t">${esc(subTitle)}</div>${_clBullets(blk[sub])}
    </div>`;
  const inner = `<div class="app-cols">
    ${block('Communication Style', a.communication, 'watch_for', 'What to watch for')}
    ${block('Conflict Style', a.conflict, 'working_with', 'Working with it')}
    ${block('Coming Back to Center', a.center, 'off_center', "When you're off-center")}
  </div>`;
  return _clPage('Putting It All Together', 8, 'cl-9pt', inner);
}

function clientReportStyles() {
  return `<style>
:root{
  --body-text:#404040;--leading-text:#495A78;--footer-gray:#999999;
  --card-bg:#E6F4FA;--card-border:#D6D7D8;
  --body-color:#3F7CC4;--heart-color:#D38481;--head-color:#4F845C;
  --p2-callout-bg:#FBF3EB;--font:Arial,Helvetica,sans-serif;
  --page-w:816px;--page-h:1056px;--margin-x:53px;--margin-y:40px;
}
  /* ===== P2 (enneagram_overview) chrome + body — V2 template-ported ===== */
  .page { position: relative; width: var(--page-w); min-height: var(--page-h); background: #fff; margin: 0 auto; display: flex; flex-direction: column; page-break-after: always; }
  .page p { margin: 0; }
  .masthead { display: flex; align-items: center; justify-content: space-between; padding: var(--margin-y) var(--margin-x) 0; }
  .logo { height: 34px; width: auto; display: block; }
  .header-rule { margin: 10px var(--margin-x) 0; height: 2px; background: var(--hive-blue); opacity: .55; }
  .intro { margin: 14px var(--margin-x) 0; display: flex; gap: 26px; }
  .intro-left { flex: 1 1 63%; }
  .intro-right { flex: 0 0 33%; text-align: center; }
  .badge-label { display: inline-block; background: var(--hive-orange); color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .06em; padding: 4px 12px; border-radius: 3px; }
  .intro p { margin-top: 12px; font-size: 13.5px; line-height: 1.6; color: var(--body-text); }
  .intro-symbol { width: 205px; height: 205px; margin: 0 auto; }
  .feature-cards { margin: 15px var(--margin-x) 0; display: flex; gap: 14px; }
  .fcard { flex: 1; background: var(--card-bg); border-radius: 6px; padding: 12px 14px; text-align: center; }
  .fcard .ft { font-size: 13px; font-weight: 700; color: var(--section-title); }
  .fcard .fd { margin-top: 4px; font-size: 11.5px; line-height: 1.4; color: var(--section-title); }
  .grid-head { margin: 16px var(--margin-x) 0; font-size: 11px; font-weight: 700; letter-spacing: .06em; color: var(--hive-blue); }
  .grid-instr { margin: 4px var(--margin-x) 0; font-size: 12px; font-style: italic; color: var(--section-title); }
  .grid { margin: 10px var(--margin-x) 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tcard { border: 1px solid var(--card-border); border-radius: 6px; padding: 9px 12px; }
  .tcard .thead { font-size: 9px; font-weight: 700; letter-spacing: .05em; color: var(--section-title); }
  .tcard .tname { margin-top: 3px; font-size: 16px; font-weight: 700; }
  .tcard.body .tname { color: var(--body-color); }
  .tcard.heart .tname { color: var(--heart-color); }
  .tcard.head .tname { color: var(--head-color); }
  .tcard .tdesc { margin-top: 5px; font-size: 11px; line-height: 1.4; color: var(--body-text); }
  .tcard .tgifts { margin-top: 6px; font-size: 10.5px; font-weight: 700; color: var(--hive-orange); }
  .closing { margin: 12px var(--margin-x) 0; background: var(--p2-callout-bg); border-left: 5px solid var(--hive-orange); border-radius: 0 5px 5px 0; padding: 12px 18px; font-size: 12.5px; font-style: italic; line-height: 1.55; color: var(--body-text); }
  .footer { margin: 12px var(--margin-x) 24px; display: flex; justify-content: space-between; font-size: 9px; color: var(--footer-gray); border-top: 1px solid #F0D9C4; padding-top: 7px; }
  .footer .center { color: var(--hive-blue); }
  /* ===== existing repo client rules (UNCHANGED — drive Title/TOC/P1/P3–P8 until ported) ===== */
  @page { size: 8.5in 11in; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: var(--body); }
  .report-page { width: 816px; min-height: 1056px; padding: 40px 48px; position: relative; page-break-after: always; background: #fff; display: flex; flex-direction: column; }
  .page-header { height: 50px; border-bottom: 1px solid #ddd; margin-bottom: 14px; }
  .ph-title { font-size: 9pt; font-weight: bold; letter-spacing: .06em; text-transform: uppercase; color: var(--hive-blue); padding-top: 8px; }
  .ph-supertitle { font-size: 8pt; font-weight: bold; letter-spacing: .12em; color: var(--hive-blue); padding-top: 8px; }
  .page-body { flex: 1 1 auto; }
  .page-footer { margin-top: auto; font-size: 7pt; color: var(--footer); text-align: center; }
  .cl-label { font-size: 9pt; font-weight: bold; letter-spacing: .05em; text-transform: uppercase; color: var(--hive-blue); margin: 12px 0 5px; }
  .cl-body { font-size: 10pt; line-height: 15pt; margin: 0 0 8px; }
  .cl-bullet { font-size: 10pt; line-height: 14pt; margin: 0 0 5px; padding-left: 12px; position: relative; }
  .cl-bullet::before { content: "•"; color: var(--hive-orange); position: absolute; left: 0; }
  .cl-center { text-align: center; }
  .report-title { text-align: center; padding-top: 120px; }
  .tp-title { font-size: 30pt; font-weight: bold; color: var(--body); margin: 30px 0 8px; }
  .tp-tagline { font-size: 12pt; font-style: italic; color: var(--section-title); }
  .tp-svg { width: 300px; height: 300px; margin: 30px auto; }
  .tp-client { font-size: 24pt; color: var(--hive-orange); }
  .tp-date { font-size: 11pt; color: var(--section-title); }
  .toc-client { font-size: 10pt; color: var(--section-title); margin-bottom: 18px; }
  .toc-title { font-size: 18pt; font-weight: bold; color: var(--hive-blue); margin-bottom: 16px; }
  .toc-row { display: grid; grid-template-columns: 2.2fr 3fr 0.4fr; gap: 10px; padding: 9px 0; border-bottom: 1px solid #eee; font-size: 11pt; }
  .toc-t { font-weight: bold; color: var(--body); } .toc-d { color: var(--section-title); } .toc-n { text-align: right; color: var(--hive-blue); font-weight: bold; }
  .cl-greeting { font-size: 26pt; font-weight: bold; color: var(--hive-orange); margin-bottom: 14px; }
  .cl-welcome { text-align: left; } .cl-welcome .cl-body:last-child { font-style: italic; color: var(--section-title); }
  .cl-sigs { display: flex; gap: 40px; justify-content: center; margin-top: 18px; font-size: 9pt; color: var(--section-title); }
  .prm-top { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; }
  .prm-pillars { display: flex; flex-direction: column; gap: 8px; }
  .prm-pillar-t { font-size: 10pt; font-weight: bold; color: var(--hive-blue); } .prm-pillar-b { font-size: 9pt; color: var(--body); }
  .prm-scan { font-size: 9pt; font-style: italic; color: var(--section-title); margin: 10px 0 8px; }
  .prm-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .prm-card { border: 1px solid #eee; border-radius: 5px; padding: 7px 9px; }
  .prm-card-h { font-size: 7pt; font-weight: bold; color: var(--hive-blue); letter-spacing: .04em; }
  .prm-card-n { font-size: 10pt; font-weight: bold; color: var(--body); }
  .prm-card-d { font-size: 8pt; line-height: 11pt; color: var(--body); margin: 2px 0; }
  .prm-card-g { font-size: 8pt; color: var(--section-title); }
  .prm-footer { font-size: 9pt; font-style: italic; color: var(--section-title); margin-top: 8px; text-align: center; }
  .cl-2col { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; }
  .cl-svg { width: 250px; height: 250px; margin: 0 auto; }
  .cl-pill-num { font-size: 22pt; font-weight: bold; color: var(--leading-pill-text); } .cl-pill-name { font-size: 14pt; font-weight: bold; color: var(--leading-pill-text); } .cl-pill-sub { font-size: 10pt; color: var(--leading-pill-text); }
  .cl-quote { background: var(--teal-box); border-left: 3px solid var(--hive-blue); padding: 8px 12px; border-radius: 4px; font-style: italic; font-size: 10pt; margin: 8px 0; }
  table.cmp { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.cmp td { font-size: 9pt; line-height: 13pt; padding: 4px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .cmp-label { font-weight: bold; color: var(--section-title); width: 30%; } .cmp-disc { font-style: italic; }
  .cl-disclaimer { font-size: 8pt; font-style: italic; color: var(--section-title); text-align: center; margin-top: 10px; }
  .pat-sec { margin-bottom: 12px; } .pat-cols { columns: 2; column-gap: 22px; } .pat-cols .cl-bullet { break-inside: avoid; }
  .cl-inquiry { background: var(--teal-box); border-left: 3px solid var(--hive-blue); padding: 7px 12px; border-radius: 4px; font-size: 10pt; font-style: italic; color: var(--hive-blue); margin-top: 6px; }
  .cl-card { background: var(--callout-bg); border-radius: 4px; padding: 6px 10px; font-size: 9pt; margin: 4px 0 8px; }
  .cl-sidebar { background: #FAFAF7; border-radius: 6px; padding: 12px; } .cl-side-h { font-size: 9pt; font-weight: bold; color: var(--hive-blue); text-transform: uppercase; margin: 8px 0 4px; } .cl-side-h:first-child { margin-top: 0; } .cl-side-b { font-size: 9pt; line-height: 12.5pt; margin: 0; }
  .cl-subtype-name { font-size: 14pt; font-weight: bold; color: var(--body); } .cl-subtype-tag { font-size: 10pt; font-style: italic; color: var(--section-title); margin-bottom: 6px; }
  .cl-def { font-size: 9pt; line-height: 12.5pt; margin-bottom: 6px; }
  .cl-stack-row { display: flex; justify-content: space-between; font-size: 9pt; padding: 3px 0; border-bottom: 1px solid #eee; } .cl-stack-l { font-weight: bold; color: var(--hive-orange); }
  .cl-orange { background: #FDF1E7; border-left: 4px solid var(--hive-orange); border-radius: 4px; padding: 8px 12px; margin: 8px 0; } .cl-orange-h { font-size: 9pt; font-weight: bold; color: var(--hive-orange); text-transform: uppercase; margin-bottom: 4px; }
  .sc-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; } .sc-card { border-radius: 5px; padding: 8px 10px; } .sc-str { background: #EAF4EE; } .sc-chl { background: #FBEDE6; } .sc-card-t { font-size: 10pt; font-weight: bold; color: var(--body); } .sc-card-b { font-size: 9pt; line-height: 12.5pt; }
  .cl-9pt .cl-bullet { font-size: 9pt; line-height: 12.5pt; } .cl-9pt .cl-label { margin-top: 6px; }
  .cl-dense .cl-body { font-size: 9.5pt; line-height: 13pt; margin-bottom: 6px; }
  .cl-dense .cl-bullet { font-size: 9pt; line-height: 12pt; margin-bottom: 4px; }
  .cl-dense .cl-label { margin: 8px 0 4px; }
  .cl-dense table.cmp td { padding: 3px 8px; line-height: 12pt; }
  .cl-dense .cl-quote { padding: 6px 10px; margin: 6px 0; }
  .cl-dense .cl-side-b, .cl-dense .cl-def { font-size: 8.5pt; line-height: 11.5pt; }
  .app-cols { columns: 3; column-gap: 18px; } .app-sec { break-inside: avoid; margin-bottom: 10px; } .app-subhead { font-size: 9pt; font-weight: bold; color: var(--body); } .app-fw { font-size: 8pt; font-style: italic; color: var(--section-title); margin-bottom: 4px; } .app-sub-t { font-size: 8pt; font-weight: bold; color: var(--hive-blue); text-transform: uppercase; margin: 5px 0 3px; }
  /* ===== Cover pages (Title + TOC) — V2 template-ported. Print-locked, absolute layout. ===== */
  /* Namespaced cover/cv- classes so they never collide with P2 flow chrome (page/masthead/footer) or the legacy report-page/tp-/toc- rules above. */
  .cover { position: relative; width: var(--page-w); height: var(--page-h); overflow: hidden; background: #fff; margin: 0 auto; page-break-after: always; }
  .cover h1, .cover p, .cover ul, .cover li { margin: 0; padding: 0; }
  .cover ul { list-style: none; }
  .cover .logo { height: 38px; width: auto; display: block; }
  .cv-masthead { position: absolute; top: var(--margin-y); left: var(--margin-x); right: var(--margin-x); display: flex; align-items: center; justify-content: space-between; }
  .cv-report-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: var(--hive-blue); }
  .cv-footer { position: absolute; left: var(--margin-x); right: var(--margin-x); bottom: var(--margin-y); display: flex; justify-content: space-between; font-size: 9px; color: var(--footer-gray); border-top: 1px solid #E8E8E8; padding-top: 8px; }
  /* --- Title --- */
  .cv-hero { position: absolute; left: 0; right: 0; top: 188px; text-align: center; }
  .cv-symbol { width: 320px; height: 320px; margin: 0 auto; }
  .cv-supertitle { margin-top: 26px; font-size: 14px; font-weight: 700; letter-spacing: 0.14em; color: var(--hive-blue); }
  .cv-title { margin-top: 10px; font-size: 50px; font-weight: 700; line-height: 1.06; color: var(--leading-text); }
  .cv-title .cv-accent { color: var(--hive-blue); }
  .cv-rule { width: 120px; height: 3px; background: var(--hive-orange); border: none; margin: 22px auto 0; }
  .cv-tagline { margin-top: 20px; font-size: 17px; font-style: italic; color: var(--body-text); }
  .cv-prepared-card { margin: 20px auto 0; width: 320px; padding: 22px 24px; background: #F5F5F5; border: 1px solid var(--card-border); border-radius: 6px; text-align: center; }
  .cv-tp-label { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; color: var(--section-title); }
  .cv-tp-name { margin-top: 8px; font-size: 24px; font-weight: 700; color: var(--hive-orange); }
  .cv-tp-date { margin-top: 4px; font-size: 13px; color: var(--body-text); }
  /* --- TOC --- */
  .cv-header-rule { position: absolute; top: 96px; left: var(--margin-x); right: var(--margin-x); height: 2px; background: var(--hive-blue); opacity: 0.55; }
  .cv-body { position: absolute; top: 178px; left: var(--margin-x); right: var(--margin-x); }
  .cv-toc-label { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: var(--section-title); }
  .cv-toc-name { margin-top: 6px; font-size: 26px; font-weight: 700; color: var(--leading-text); }
  .cv-type-line { margin-top: 6px; font-size: 13px; font-style: italic; color: var(--body-text); }
  .cv-type-line .cv-sep { color: #C8C9CA; padding: 0 6px; }
  .cv-section-heading { margin-top: 30px; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: var(--section-title); }
  .cv-toc { margin-top: 18px; }
  .cv-entry { display: flex; align-items: flex-start; gap: 14px; padding: 13px 0; }
  .cv-num { flex: 0 0 auto; width: 26px; height: 26px; border-radius: 50%; background: var(--leading-text); color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
  .cv-entry-main { flex: 1 1 auto; min-width: 0; }
  .cv-entry-titleline { display: flex; align-items: baseline; gap: 6px; }
  .cv-entry-title { font-size: 17px; font-weight: 700; color: var(--leading-text); white-space: nowrap; }
  .cv-leader { flex: 1 1 auto; border-bottom: 1.5px dotted #C8C9CA; transform: translateY(-4px); min-width: 12px; }
  .cv-entry-page { font-size: 14px; font-weight: 700; color: var(--hive-blue); flex: 0 0 auto; }
  .cv-entry-desc { margin-top: 4px; font-size: 12.5px; color: var(--section-title); line-height: 1.4; }
  </style>`;
}

function buildClientReportHTML(model, opts = {}) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Your Enneagram Report — Type ${model.hero.number}</title>
${partAStyles()}
${clientReportStyles()}
</head><body>
${_clTitle(model)}
${_clTOC(model)}
${_clP1Welcome(model)}
${_clP2Primer(model)}
${_clP3Hypotheses(model)}
${_clP4Patterns(model)}
${_clP5WingsLines(model)}
${_clP6Instinct(model)}
${_clP7Strengths(model)}
${_clP8Application(model)}
</body></html>`;
}

module.exports = {
  buildClientHTML, buildCoachHTML, buildBetaHTML, buildPdfOptions,
  buildEnneagramSVG, renderTypeStrengthChart, renderInstinctChart, partAStyles, PALETTE, CENTER_COLORS,
  buildCoachReportHTML, buildCoachPdfOptions, COACH_CLARIFICATION_QUESTIONS,
  buildClientReportHTML,
};
