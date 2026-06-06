'use strict';

/**
 * type_meta.js — canonical Enneagram type metadata (Step 7 Phase 4).
 *
 * Single source of truth for report_prep.js: engine type names + A6 per-type
 * structure (stress/security points, wings, center, center color). Mirrors the
 * design A6 lookup table and A2 Center-color mapping. (renderer.js and the
 * content build script keep their own inline copies for now — see Phase 4 plan.)
 */

const TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer', 4: 'The Individualist',
  5: 'The Observer', 6: 'The Questioner', 7: 'The Enthusiast', 8: 'The Protector', 9: 'The Peacemaker',
};

// A2 Center-color mapping (single source). Only Head splits fill vs. text; text is
// the value used for colored labels in the reports.
const CENTER_COLOR = { Gut: '#5271B7', Heart: '#D38481', Head: '#4F845C' };

// A6 per-type lookup: stress point, security point, two wings, center.
const TYPE_META = {
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
// Attach centerColor for convenience.
for (const n of Object.keys(TYPE_META)) TYPE_META[n].centerColor = CENTER_COLOR[TYPE_META[n].center];

const INSTINCT_NAME = { SP: 'Self-Preservation', SO: 'Social', SX: 'One-to-One' };

module.exports = { TYPE_NAMES, TYPE_META, CENTER_COLOR, INSTINCT_NAME };
