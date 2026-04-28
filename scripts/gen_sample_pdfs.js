'use strict';

/**
 * gen_sample_pdfs.js — Generate sample PDFs from SP9 and SO7 fixtures.
 * Usage: node scripts/gen_sample_pdfs.js
 * Prerequisites: server running at localhost:3000
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const APP_JS     = path.join(ROOT, 'app/public/app.js');
const TYPE_LIB   = path.join(ROOT, 'content/type_library.json');
const SAMPLES    = path.join(ROOT, 'samples');
const REPORTS_DIR = path.join(ROOT, 'app/reports');

// Resolve app deps from app/node_modules
require('module').globalPaths.push(path.join(ROOT, 'app/node_modules'));
const { buildClientHTML, buildCoachHTML, buildPdfOptions } = require(path.join(ROOT, 'app/renderer'));

if (!fs.existsSync(SAMPLES)) fs.mkdirSync(SAMPLES, { recursive: true });

const typeLibrary = JSON.parse(fs.readFileSync(TYPE_LIB, 'utf8'));

const src = fs.readFileSync(APP_JS, 'utf8');
const sp  = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/)[1];
const ti  = src.match(/const TASK_INSTRUCTIONS = `([\s\S]*?)`;/)[1];
const of_ = src.match(/const OUTPUT_FORMAT = `([\s\S]*?)`;/)[1];
const systemPrompt = `${sp}\n\n${ti}`;

const BUCKET_LABELS = {
  Hornevian:       { A: 'Assertive', B: 'Compliant',   C: 'Withdrawn'  },
  Harmonic:        { A: 'Intensity', B: 'Positive',    C: 'Competency' },
  ObjectRelations: { A: 'Attachment', B: 'Frustration', C: 'Rejection' },
};

function buildContextFromFixture(f) {
  const s0 = f.stage0, s1 = f.stage1, s2 = f.stage2, s3 = f.stage3, s4 = f.stage4;
  const secondCenterLine = s1.secondCenter ? `Second candidate Center: ${s1.secondCenter}\n` : '';
  const ctStage1 = s1.counterTypeFlag === 'YES'
    ? `Counter-type flag: YES\nCounter-type combination: ${s1.counterTypeCombination}`
    : 'Counter-type flag: NO';
  const secondCandidateLine = s4.secondType ? `Second candidate tested: Type ${s4.secondType}\n` : '';
  const boolStr = (v) => v === true ? 'YES' : v === false ? 'NO' : 'N/A';
  const coach = f.coach || 'Cai Delumpa';
  const finalOpen = (f.final_open_response && f.final_open_response !== '[none provided]')
    ? `"${f.final_open_response}"` : '[none provided]';

  return `CLIENT INFORMATION
==================
Name: Test Client
Organization: Not provided
Coach: ${coach}

CLIENT ASSESSMENT DATA
======================

Stage 0 — Open Text Responses
Self-description (client's own words): "${s0.q1}"
How others describe them: "${s0.q2}"
Greatest strength: "${s0.q3}"
Most problematic quality: "${s0.q4}"

Stage 1 — Centers Scoring
Scoring: Rank 1 = 3pts, Rank 2 = 2pts, Rank 3 = 1pt. Maximum per Center: 18. Confidence: HIGH = gap 5+, MEDIUM = gap 3-4, LOW = gap 0-2.
Head Center total: ${s1.centers.Head} / 18
Heart Center total: ${s1.centers.Heart} / 18
Body Center total: ${s1.centers.Body} / 18
Identified Center: ${s1.identifiedCenter}
Gap to next Center: ${s1.centerGap} points
Center confidence: ${s1.centerConfidence}
${secondCenterLine}
Stage 1 — Instinct Scoring
Maximum per Instinct: 12. Confidence: HIGH = gap 4+, MEDIUM = gap 2-3, LOW = gap 0-1.
SP total: ${s1.instincts.SP} / 12
SO total: ${s1.instincts.SO} / 12
SX total: ${s1.instincts.SX} / 12
Identified Instinct: ${s1.identifiedInstinct}
Gap to next Instinct: ${s1.instinctGap} points
Instinct confidence: ${s1.instinctConfidence}

Stage 1 — Type Hypotheses
Three type hypotheses from Stage 1: Type ${s1.typeHypotheses.join(', Type ')}
${ctStage1}

Stage 2 — Cross-Referencing Results
Q1 Hornevian answer: ${s2.hornevian} (${BUCKET_LABELS.Hornevian[s2.hornevian]})
Q2 Harmonic answer: ${s2.harmonic} (${BUCKET_LABELS.Harmonic[s2.harmonic]})
Q3 Object Relations answer: ${s2.objectRelations} (${BUCKET_LABELS.ObjectRelations[s2.objectRelations]})

Cross-referencing primary hypothesis: Type ${s2.xrefPrimary}
Cross-referencing live alternative: Type ${s2.xrefAlternative}
Ambiguity axis: ${s2.ambiguityAxis}
Counter-type mode triggered: ${s2.counterTypeModeTriggered}

Stage 3 — Pairwise Discrimination Results
Mode: ${s3.mode}
Pair tested: ${s3.pair}
Q1 Core Motivation result: ${s3.mode === 'COUNTER-TYPE' ? 'N/A (counter-type mode — single CT question)' : (s3.q1Result || 'N/A')}
Q2 Avoidance result: ${s3.mode === 'COUNTER-TYPE' ? 'N/A' : (s3.q2Result || 'N/A')}
Stage 3 leading hypothesis: Type ${s3.leading}
Stage 3 confidence: ${s3.confidence}
Counter-type mode answer: ${s3.ctAnswer}

Stage 4 — Confirmation Results
Path: ${s4.path}
Option: ${s4.option}
Lead type tested: Type ${s4.leadType}
${secondCandidateLine}Stress confirmed: ${boolStr(s4.stressConfirmed)}
Security confirmed: ${boolStr(s4.securityConfirmed)}
Habit of Mind confirmed: ${boolStr(s4.habitConfirmed)}
Stage 4 outcome: ${s4.outcome}

Stage 4 — Answer Details (use for stress_point_description / security_point_description / habit_of_mind_description)
Stress: ${s4.stressDescription}
Security: ${s4.securityDescription}
Habit of Mind: ${s4.habitDescription || 'N/A — did not fire'}

Final open response (optional): ${finalOpen}`;
}

const http = require('http');

function postAnalyze(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ systemPrompt, userMessage });
    const authHeader = 'Basic ' + Buffer.from('hive-enneagram:9Types!').toString('base64');
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/analyze', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': authHeader,
      },
      timeout: 360000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`Parse error: ${e.message}\nRaw: ${data.slice(0,200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generateAndSavePDFs(fixtureName) {
  const fixturePath = path.join(ROOT, `tests/fixtures/${fixtureName}_fixture.json`);
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  console.log(`\n=== Generating PDFs for ${fixtureName.toUpperCase()} ===`);

  const userMessage = `${buildContextFromFixture(fixture)}\n\n${of_}`;
  console.log(`  Calling API...`);
  const start = Date.now();
  const resp = await postAnalyze(systemPrompt, userMessage);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  API done in ${elapsed}s — type=${resp.result?.hypothesis?.confirmed_type}`);

  if (!resp.ok || !resp.result) throw new Error(`API returned not-ok: ${JSON.stringify(resp).slice(0,200)}`);

  const result = resp.result;
  const intake = {
    firstName: 'Test',
    lastName: fixtureName.toUpperCase(),
    email: 'test@example.com',
    organization: 'Hive Test',
    coach: fixture.coach || 'Cai Delumpa',
  };
  const scores = {};

  // Build HTML
  const clientHtml = buildClientHTML(result, typeLibrary, intake);
  const coachHtml  = buildCoachHTML(result, typeLibrary, scores, intake);

  // Generate PDFs via Puppeteer
  const puppeteerCore = require(path.join(ROOT, 'app/node_modules/puppeteer-core'));
  const browser = await puppeteerCore.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const pdfOpts = buildPdfOptions(intake);

    async function makePdf(html, label) {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('print');
      const outPath = path.join(SAMPLES, `${fixtureName}_${label}_report.pdf`);
      await page.pdf({ path: outPath, ...pdfOpts });
      await page.close();
      console.log(`  ✓ ${label} PDF saved: ${outPath}`);
      return outPath;
    }

    await makePdf(clientHtml, 'client');
    await makePdf(coachHtml,  'coach');
  } finally {
    await browser.close();
  }
}

(async () => {
  try {
    await generateAndSavePDFs('sp9');
    await generateAndSavePDFs('so7');
    console.log('\n=== All four PDFs generated successfully ===');
  } catch (e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  }
})();
