// app/stage1_labels.js
//
// Frozen server-side label map for Enhanced Mode (EM). Provides the EM prompt builder
// (app/experimental_analysis.js) with the 45 type + 15 instinct Stage 1 statements in
// its expected flat shape — { id, type, typeName, dimension, text } for types and
// { id, instinct, subdomain, text } for instincts — plus the Enneagram type geometry.
//
// Statement TEXT is no longer stored here. It is sourced by id from the canonical
// app/public/stage1_data.js module (shared with the SPA and generate_report.js) so the
// three consumers can never drift. This file layers the EM-only metadata the canonical
// module does not carry — typeName, Title-Case dimension labels, instinct subdomain —
// and joins it to the canonical text by id below. Dimension labels are pinned to Title
// Case (the canonical module stores them lower-case for the SPA) so the EM prompt text
// is unchanged by the extraction. Type names mirror TYPE_GEOMETRY[n].name.
'use strict';

const { STAGE1_TYPE_STATEMENTS, STAGE1_INSTINCT_STATEMENTS } = require('./public/stage1_data');

// EM-only metadata the canonical stage1_data.js module does not carry.
// Title-Case dimension labels, keyed by the canonical lower-case value so the EM prompt
// wording stays pinned regardless of how the SPA stores it.
const TYPE_DIMENSION_LABEL = {
  'Core motivation': 'Core Motivation',
  'Focus of attention': 'Focus of Attention',
  'Resulting preoccupation': 'Resulting Preoccupation',
  'Energy': 'Energy',
  'Avoidance': 'Avoidance',
};

// Type names mirror TYPE_GEOMETRY[n].name (defined below).
const TYPE_NAME = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer', 4: 'The Individualist',
  5: 'The Observer', 6: 'The Questioner', 7: 'The Enthusiast', 8: 'The Protector',
  9: 'The Peacemaker',
};

// 45 type statements, numerical type order (Type 1 → Type 9), dimension order
// Core Motivation → Focus of Attention → Resulting Preoccupation → Energy → Avoidance.
// Text is joined by id from the canonical module; metadata is layered locally.
const TYPE_STATEMENTS = Object.keys(STAGE1_TYPE_STATEMENTS)
  .map(Number)
  .sort((a, b) => a - b)
  .flatMap((type) => STAGE1_TYPE_STATEMENTS[type].map((s) => ({
    id: s.id,
    type,
    typeName: TYPE_NAME[type],
    dimension: TYPE_DIMENSION_LABEL[s.dimension],
    text: s.text,
  })));

// 15 instinct statements, SP → SO → SX order. The canonical module stores the subdomain
// value in its `dimension` field; here it is exposed as `subdomain` (the EM field name).
const INSTINCT_STATEMENTS = Object.keys(STAGE1_INSTINCT_STATEMENTS)
  .flatMap((instinct) => STAGE1_INSTINCT_STATEMENTS[instinct].map((s) => ({
    id: s.id,
    instinct,
    subdomain: s.dimension,
    text: s.text,
  })));

// Canonical Enneagram structural relationships (prompt spec §2.2 / design §5.3).
const TYPE_GEOMETRY = {
  1: { name: "The Improver", center: "Body", hornevian: "Dutiful", harmonic: "Competency", stress: 4, security: 7, wings: [9, 2] },
  2: { name: "The Giver", center: "Heart", hornevian: "Dutiful", harmonic: "Positive Outlook", stress: 8, security: 4, wings: [1, 3] },
  3: { name: "The Performer", center: "Heart", hornevian: "Assertive", harmonic: "Competency", stress: 9, security: 6, wings: [2, 4] },
  4: { name: "The Individualist", center: "Heart", hornevian: "Withdrawn", harmonic: "Reactive", stress: 2, security: 1, wings: [3, 5] },
  5: { name: "The Observer", center: "Head", hornevian: "Withdrawn", harmonic: "Competency", stress: 7, security: 8, wings: [4, 6] },
  6: { name: "The Questioner", center: "Head", hornevian: "Dutiful", harmonic: "Reactive", stress: 3, security: 9, wings: [5, 7] },
  7: { name: "The Enthusiast", center: "Head", hornevian: "Assertive", harmonic: "Positive Outlook", stress: 1, security: 5, wings: [6, 8] },
  8: { name: "The Protector", center: "Body", hornevian: "Assertive", harmonic: "Reactive", stress: 5, security: 2, wings: [7, 9] },
  9: { name: "The Peacemaker", center: "Body", hornevian: "Withdrawn", harmonic: "Positive Outlook", stress: 6, security: 3, wings: [8, 1] },
};

module.exports = { TYPE_STATEMENTS, INSTINCT_STATEMENTS, TYPE_GEOMETRY };

// D8 parity guard — fires once on require() at server start. Does not throw or block.
const _typeCount = TYPE_STATEMENTS.length;
const _instinctCount = INSTINCT_STATEMENTS.length;
if (_typeCount !== 45 || _instinctCount !== 15) {
  console.warn(
    `[stage1_labels] WARNING: expected 45 type + 15 instinct ` +
    `statements, got ${_typeCount} + ${_instinctCount}. ` +
    `stage1_labels.js may be out of sync with the prompt spec.`
  );
}
