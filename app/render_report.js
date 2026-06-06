'use strict';

/**
 * render_report.js — Step 7 Phase 7a. Orchestrates the new report pipeline with a
 * deterministic measurement-gate self-heal:
 *
 *   report_prep (model) → renderer (HTML) → measure.measureReport (gate)
 *
 * On a gate violation, retries at a higher `tighten` level (lower debrief word
 * budget + global font/spacing compaction) up to MAX_TIGHTEN. If still failing,
 * throws GateExhaustedError — the caller halts and alerts; NO client PDF is sent.
 * AI re-generation (vs. this deterministic tighten) is a separate follow-up.
 */

const prep = require('./report_prep');
const R = require('./renderer');
const { measureReport } = require('./measure');

const MAX_TIGHTEN = 3;

class GateExhaustedError extends Error {
  constructor(kind, violations) {
    super(`measurement gate exhausted for ${kind} report after tighten=${MAX_TIGHTEN}: ` +
      violations.map(v => `${v.zone}(${v.measured}/${Math.round(v.budget)})`).join(', '));
    this.name = 'GateExhaustedError';
    this.kind = kind;
    this.violations = violations;
  }
}

async function _renderWithGate(kind, buildModel, buildHTML) {
  let last = null;
  for (let tighten = 0; tighten <= MAX_TIGHTEN; tighten++) {
    const model = buildModel(tighten);
    const html = buildHTML(model, { tighten });
    const gate = await measureReport(html);
    if (gate.pass) {
      if (tighten > 0) console.warn(`[render] ${kind} report fit at tighten=${tighten} (self-heal)`);
      return { html, model, tighten, gate };
    }
    last = gate;
    console.warn(`[render] ${kind} gate failed at tighten=${tighten} — ${gate.violations.length} zone(s) over; retrying tighter`);
  }
  throw new GateExhaustedError(kind, (last && last.violations) || []);
}

function renderCoachReport({ apiResult, client, coach }) {
  return _renderWithGate('coach',
    (t) => prep.buildCoachModel({ apiResult, client, coach, tighten: t }),
    (m, o) => R.buildCoachReportHTML(m, o));
}

function renderClientReport({ apiResult, client, coach }) {
  return _renderWithGate('client',
    (t) => prep.buildClientModel({ apiResult, client, coach, tighten: t }),
    (m, o) => R.buildClientReportHTML(m, o));
}

module.exports = { renderCoachReport, renderClientReport, GateExhaustedError, MAX_TIGHTEN };
