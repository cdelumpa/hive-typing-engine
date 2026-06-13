'use strict';

/**
 * render_report.js — orchestrates the report pipeline:
 *
 *   report_prep (model) → renderer (HTML)
 *
 * Flowing-layout reports cannot clip, so the former Puppeteer measurement gate
 * and its deterministic tighten self-heal were removed; each report renders
 * straight through. (See app/measure.js history / render history for the prior
 * fixed-canvas + gate architecture.)
 */

const prep = require('./report_prep');
const R = require('./renderer');

// async: buildCoachModel/buildClientModel load published content_overrides from the DB.
async function renderCoachReport({ apiResult, client, coach }) {
  const model = await prep.buildCoachModel({ apiResult, client, coach });
  return { html: R.buildCoachReportHTML(model), model };
}

async function renderClientReport({ apiResult, client, coach }) {
  const model = await prep.buildClientModel({ apiResult, client, coach });
  return { html: R.buildClientReportHTML(model), model };
}

module.exports = { renderCoachReport, renderClientReport };
