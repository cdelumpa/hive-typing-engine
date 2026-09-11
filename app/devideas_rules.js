'use strict';
/**
 * devideas_rules.js — what valid sheet 11 content IS (PR 6 Build B2).
 *
 * One definition, two callers. scripts/build_content_library.js applies the LIBRARY rules at ingest
 * (moved here verbatim from its validateDevIdeas, every message unchanged, so the library builds
 * byte-identical and Build A's red controls still match). app/cms_devideas.js applies the CMS rules
 * at publish. Two copies of "what a valid list is" would drift; the build and the publish gate
 * cannot disagree about a label if there is only one.
 *
 * WHY THE CMS RULES DIFFER, AND ONLY WHERE THEY MUST
 *   · Blank items. The CMS saves an emptied box as '' and has no way to remove an item, so blanking
 *     is how an editor shortens a list (report_prep.devIdeas drops blanks). The library forbids
 *     them; the CMS allows them, provided no list ends up empty and no experiment is half-blank.
 *   · Curly quotes. The library stores straight forms and asserts it. A CMS edit typed on a Mac
 *     carries curly ones, and _v3t straightens them at render — so the CMS does not refuse them.
 *   Everything else — the colon and length rules on labels, the pre-canon names — is the same rule.
 *
 * Pure: values in, messages out. No I/O, no rendering.
 */

// A colon in a label would print as "Label::" once the renderer adds its own; 30 characters bounds
// a sentence pasted into the label (longest today: 23, Type 1's "Self-Compassion Journal").
const LABEL_MAX = 30;
// Straight quotes only in the library — the p6/p7 rule, asserted at ingest so it is not left to _v3t.
const CURLY = /[‘’“”…]/;
// The four pre-canon names the p11 source docs carry in their titles and headings. None may reach
// sheet 11: the canonical names are the Performer, Observer, Questioner and Protector.
const PRE_CANON = /\b(?:Achievers?|Investigators?|Loyal Skeptics?|Challengers?)\b/;
const SECTIONS = ['growth', 'inquiries', 'experiments'];
const nonEmpty = (s) => typeof s === 'string' && s.trim() !== '';

/** Every string under `o`: curly forms (library only) and pre-canon names. */
function textErrors(P, o, { straight = true } = {}) {
  const out = [];
  const walk = (p, v) => {
    if (typeof v === 'string') {
      if (straight && CURLY.test(v)) out.push(`${p} contains a curly quote or ellipsis — sheet 11 stores straight forms`);
      if (PRE_CANON.test(v)) out.push(`${p} names a pre-canon type ("${v.match(PRE_CANON)}") — use TYPE_NAMES`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(`${p}[${i}]`, x));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(`${p}.${k}`, x);
  };
  walk(P, o);
  return out;
}

/**
 * LIBRARY: a type's devideas_v3 block, at ingest. UNCONDITIONAL for all nine types — a type missing
 * its block must fail the build, not render an empty page. Counts are NOT fixed (the uniformity pass
 * has not settled them), so a list needs at least one item, not N.
 */
function libraryTypeErrors(n, d) {
  const P = `type_${n}.devideas_v3`;
  if (!d) return [`${P} missing — sheet 11 requires it for every type`];
  const out = [];
  // Named keys, not a count: a renamed list would render as a missing section.
  if (Object.keys(d).sort().join() !== 'experiments,growth,inquiries') {
    out.push(`${P} keys are [${Object.keys(d).join(', ')}] — want exactly growth, inquiries, experiments`);
  }
  for (const k of ['growth', 'inquiries']) {
    if (!(Array.isArray(d[k]) && d[k].length >= 1 && d[k].every(nonEmpty))) {
      out.push(`${P}.${k} must be a non-empty list of non-empty strings, got ${Array.isArray(d[k]) ? d[k].length : 'none'}`);
    }
  }
  const ex = d.experiments;
  if (!(Array.isArray(ex) && ex.length >= 1)) out.push(`${P}.experiments must be a non-empty list, got ${Array.isArray(ex) ? 0 : 'none'}`);
  (Array.isArray(ex) ? ex : []).forEach((e, i) => {
    const Q = `${P}.experiments[${i}]`;
    if (!(e && Object.keys(e).sort().join() === 'body,label')) out.push(`${Q} must be exactly { label, body }`);
    if (!(e && nonEmpty(e.label))) out.push(`${Q}.label empty`);
    if (!(e && nonEmpty(e.body))) out.push(`${Q}.body empty`);
    if (e && nonEmpty(e.label)) {
      if (e.label.includes(':')) out.push(`${Q}.label "${e.label}" contains a colon — the renderer adds it`);
      if (e.label.length > LABEL_MAX) out.push(`${Q}.label is ${e.label.length} characters (max ${LABEL_MAX})`);
    }
  });
  return out.concat(textErrors(P, d));
}

/**
 * LIBRARY: the four static siblings. Titles and rails are named key by key: a renamed key renders
 * `undefined` on every client's page, not on one type's.
 */
function libraryStaticErrors(S) {
  const out = [];
  for (const k of ['devideas_titles_v3', 'devideas_rails_v3']) {
    if (!(S[k] && Object.keys(S[k]).sort().join() === 'experiments,growth,inquiries'
      && SECTIONS.every((s) => nonEmpty(S[k][s])))) {
      out.push(`static.${k} must be exactly { growth, inquiries, experiments }, all non-empty`);
    }
  }
  if (!nonEmpty(S.devideas_lead_v3)) out.push('static.devideas_lead_v3 empty');
  if (!nonEmpty(S.devideas_coda_v3)) out.push('static.devideas_coda_v3 empty');
  for (const k of ['devideas_titles_v3', 'devideas_rails_v3', 'devideas_lead_v3', 'devideas_coda_v3']) {
    out.push(...textErrors(`static.${k}`, S[k]));
  }
  return out;
}

/**
 * CMS: a candidate value for one of the four editable sheet 11 keys, in words an editor reads.
 * Shape is NOT checked here — assertOverrideShape is, at composition, and its refusal is worded as a
 * shape error by app/cms_devideas.js. This checks what the page would SHOW: lists after blanks drop.
 */
function cmsErrors(key, value) {
  const out = [];
  if (/^type_[1-9]\.devideas_v3$/.test(key)) {
    const d = value || {};
    const NAMES = { growth: 'Growth Strategies', inquiries: 'Inquiries', experiments: 'Field Experiments' };
    for (const k of ['growth', 'inquiries']) {
      if (Array.isArray(d[k]) && !d[k].some(nonEmpty)) out.push(`${NAMES[k]} would be empty — at least one item must stay`);
    }
    const ex = Array.isArray(d.experiments) ? d.experiments : [];
    const kept = ex.filter((e) => e && (nonEmpty(e.label) || nonEmpty(e.body)));
    if (Array.isArray(d.experiments) && !kept.length) out.push('Field Experiments would be empty — at least one item must stay');
    ex.forEach((e, i) => {
      if (!e) return;
      const n = i + 1;
      if (nonEmpty(e.label) && !nonEmpty(e.body)) out.push(`Field Experiment ${n} has a label but no body — fill both, or empty both to remove it`);
      if (!nonEmpty(e.label) && nonEmpty(e.body)) out.push(`Field Experiment ${n} has a body but no label — fill both, or empty both to remove it`);
      if (nonEmpty(e.label) && e.label.includes(':')) out.push(`Field Experiment ${n}'s label contains a colon — leave it out; the page adds it`);
      if (nonEmpty(e.label) && e.label.trim().length > LABEL_MAX) out.push(`Field Experiment ${n}'s label is ${e.label.trim().length} characters — the limit is ${LABEL_MAX}`);
    });
  } else if (key === 'static.devideas_rails_v3') {
    for (const s of SECTIONS) if (!nonEmpty((value || {})[s])) out.push(`The ${s} rail description is empty`);
  } else if (key === 'static.devideas_lead_v3' || key === 'static.devideas_coda_v3') {
    if (!nonEmpty(value)) out.push(`The ${key === 'static.devideas_lead_v3' ? 'lead paragraph' : 'closing note'} is empty`);
  }
  for (const m of textErrors('', value, { straight: false })) {
    out.push(`Uses a pre-canon type name ("${m.match(/\("([^"]+)"\)/)[1]}") — use the current type names`);
  }
  return out;
}

module.exports = { LABEL_MAX, CURLY, PRE_CANON, SECTIONS, nonEmpty, textErrors, libraryTypeErrors, libraryStaticErrors, cmsErrors };
