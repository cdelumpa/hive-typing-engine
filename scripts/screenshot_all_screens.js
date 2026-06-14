/* =============================================================================
 * screenshot_all_screens.js
 *
 * Renders every distinct screen of the Hive Typing Engine v2 assessment flow to
 * numbered PNGs under docs/hive-v2-assessment-screens/, as a visual inventory
 * ahead of alpha UI tweaks.
 *
 * HOW IT WORKS
 *   - Spins up a tiny static HTTP server rooted at app/public (so /styles.css,
 *     /state.js, /ui.js, /assessment.js, /app.js and the logo all resolve; the
 *     /content/type_library.json fetch is mapped to app/type_library.json).
 *   - Drives the SPA by injecting state directly and calling the app's own
 *     global render functions via page.evaluate() — NOT by simulating clicks
 *     through every prior screen (per the task brief).
 *   - Viewport defaults to 390x844 (mobile, the primary target), deviceScaleFactor 2.
 *     Set env HIVE_VIEWPORT=desktop for a 1280x900 pass written to ./desktop/
 *     with a '_desktop' filename suffix.
 *
 * BROWSER ENGINE NOTE
 *   The brief asked for Playwright. Playwright is NOT installed in this repo
 *   (checked app/node_modules/playwright and the global PATH — absent). Puppeteer
 *   v24 IS installed with a working bundled Chromium, so this script uses
 *   Puppeteer instead. Functionally equivalent for headless-Chromium screenshots.
 *
 * -----------------------------------------------------------------------------
 * RECONCILED SCREEN INVENTORY  (actual code vs. the brief's expected list)
 * -----------------------------------------------------------------------------
 * The flow is phase-driven (state.phase in app/public/state.js). Traversal order
 * a real client experiences:
 *
 *   welcome -> intake -> stage0 (q1..q4) -> mid-assessment-reminders
 *     -> stage1 (5 type-slider screens, type-open, 3 instinct-slider screens,
 *        instinct-open)
 *     -> ct-analyzing (CONDITIONAL: only when a Stage-1 counter-type flag is set)
 *     -> stage2 (q1 Hornevian, q2 Harmonic, q3 Centers ranking)
 *     -> call1-analyzing (AI Call #1 interstitial; spinner -> "done" w/ Continue)
 *     -> stage3 (pairwise; STANDARD or COUNTER-TYPE branch)
 *     -> stage4 (stress, security, + CONDITIONAL habit)
 *     -> finalopen -> processing (AI Call #2 runs server-side) -> confirmation
 *
 * DISCREPANCIES vs. the brief's numbered list:
 *   - "1. Welcome/landing" in code is TWO screens: welcome + a separate intake
 *     form. Captured both.
 *   - The brief omits the 'mid-assessment-reminders' interstitial (fires after
 *     Stage 0 Q4, before Stage 1). It exists in code — captured.
 *   - Brief "16. AI Call #1 interstitial" is placed BEFORE Stage 2. In code the
 *     interstitial between Stage 1 and Stage 2 is 'ct-analyzing' (the CT
 *     mini-call cover). The actual AI Call #1 interstitial ('call1-analyzing')
 *     fires AFTER Stage 2. Both captured, in their true positions.
 *   - Brief "24. AI Call #2 interstitial" maps to the 'processing' screen (AI
 *     Call #2 runs server-side while 'processing' shows). Captured.
 *   - Brief "25. Results screen (client-facing output)" — v2 has NO in-app
 *     results screen; results are emailed. The client-facing end state is the
 *     'confirmation' screen ("Your report is on its way"). Captured as such.
 *   - 'finalopen' (final optional open question) and 'error' screens exist in
 *     code but aren't in the brief — captured as extras.
 *
 * CONDITIONAL BRANCHES — standard branch captured; alternates noted as TODO:
 *   - Stage 3: captured STANDARD pairwise (Q1 core-motivation, single question).
 *     TODO: COUNTER-TYPE comparative branch; STANDARD Q2 (avoidance) when
 *           AI Call #1 returns gap='tight' on a bespoke pair.
 *   - Stage 4: captured Option B (pairwise) stress/security + a pairwise habit.
 *     TODO: Option A (3opt single-type) branch; MODIFIED_B (ct-pairwise) branch.
 *   - call1-analyzing: captured both the spinner and the "done/Continue" states.
 * ===========================================================================*/

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'app', 'node_modules', 'puppeteer'));

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'app', 'public');
const TYPE_LIB = path.join(ROOT, 'app', 'type_library.json');
const BASE_OUT = path.join(ROOT, 'docs', 'hive-v2-assessment-screens');

// Viewport mode — set HIVE_VIEWPORT=desktop for the 1280x900 desktop pass.
// mobile (default): 390x844, output to the base dir, no filename suffix.
// desktop:          1280x900, output to base/desktop, '_desktop' filename suffix.
const MODE = process.env.HIVE_VIEWPORT === 'desktop' ? 'desktop' : 'mobile';
const VIEWPORT = MODE === 'desktop'
  ? { width: 1280, height: 900, deviceScaleFactor: 2 }
  : { width: 390, height: 844, deviceScaleFactor: 2 };
const OUT_DIR = MODE === 'desktop' ? path.join(BASE_OUT, 'desktop') : BASE_OUT;
const SUFFIX = MODE === 'desktop' ? '_desktop' : '';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';

      // Map the type-library fetch to its real on-disk location.
      let filePath;
      if (urlPath === '/content/type_library.json') {
        filePath = TYPE_LIB;
      } else {
        filePath = path.join(PUBLIC_DIR, urlPath);
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found: ' + urlPath);
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* ---------------------------------------------------------------------------
 * In-page driver. Runs INSIDE the browser. Sets up `state` and renders the
 * requested screen by calling the app's own global render functions. Returns a
 * marker string so the Node side knows whether attachHandlers/init ran (slider
 * screens need the post-layout thumb-positioning that full render() performs).
 * ------------------------------------------------------------------------- */
function applyScreen(spec) {
  const app = document.getElementById('app');

  // The "Save and Continue Later" / "Save & Exit" button is gated in render() on
  // a token-based session: SAVE_LATER_PHASES.has(state.phase) && state.intake.token.
  // The live app gets this token from the server-injected window.__hiveIntake on
  // token-entry. Simulate an authenticated session so the button renders.
  state.intake = state.intake || {};
  state.intake.token = state.intake.token || 'demo-token-screenshot';

  // Mirrors render()'s save-later injection (assessment.js) exactly, so screens
  // we build via direct innerHTML (bypassing render()) still get the button on
  // every SAVE_LATER phase. No-op on non-SAVE_LATER phases and when no token.
  // Slider screens go through render() instead, which injects on its own — so
  // this is only called on the direct-innerHTML path to avoid double-injection.
  const injectSaveLater = () => {
    if (!(SAVE_LATER_PHASES.has(state.phase) && state.intake && state.intake.token)) return;
    if (document.getElementById('btn-save-later')) return; // guard against double-inject
    const navRow = app.querySelector('.nav-row');
    const primaryBtn = navRow && navRow.querySelector('.btn-primary');
    if (navRow && primaryBtn) {
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-ghost';
      saveBtn.id = 'btn-save-later';
      saveBtn.innerHTML = '<span class="save-full">Save and Continue Later</span><span class="save-short">Save &amp; Exit</span>';
      navRow.insertBefore(saveBtn, primaryBtn);
    } else {
      const saveLaterEl = document.createElement('div');
      saveLaterEl.id = 'save-later-bar';
      saveLaterEl.style.cssText = 'text-align:center;padding:16px 0 8px;';
      saveLaterEl.innerHTML = '<button id="btn-save-later" style="background:none;border:none;color:#7A96A6;font-size:13px;font-family:Georgia,serif;cursor:pointer;text-decoration:underline;padding:4px 8px;">Save and Continue Later</button>';
      app.appendChild(saveLaterEl);
    }
  };

  // Realistic Stage 0 answers so reference boxes (Q3/Q4) and textareas populate.
  const A0 = {
    q1: 'Curious, driven, loyal, a bit restless',
    q2: 'Dependable, warm, intense, sometimes guarded',
    q3: 'Loyal',
    q4: 'Restless',
  };

  const ensureScores = () => { if (!state.scores) state.scores = {}; };

  switch (spec.kind) {
    case 'welcome':
      state.phase = 'welcome';
      app.innerHTML = renderWelcome();
      break;

    case 'intake':
      state.phase = 'intake';
      state.intake = Object.assign({}, state.intake, {
        firstName: 'Alex', lastName: 'Rivera', email: 'alex.rivera@example.com',
        organization: 'Hive Coaching', coach: 'Cai Delumpa',
      });
      app.innerHTML = renderIntake();
      break;

    case 'stage0':
      state.phase = 'stage0';
      state.stage0Answers = Object.assign({}, A0);
      state.stage0Idx = spec.idx;
      app.innerHTML = renderStage0();
      break;

    case 'mid':
      state.phase = 'mid-assessment-reminders';
      state.stage0Answers = Object.assign({}, A0);
      app.innerHTML = renderMidAssessmentReminders();
      break;

    case 'stage1':
      // Full render() so attachHandlers positions slider thumbs / colours tracks
      // after layout (innerHTML alone would leave thumbs at left:0).
      state.phase = 'stage1';
      state.stage1Idx = spec.idx;
      render();
      return 'render';

    case 'ct':
      state.phase = 'ct-analyzing';
      // Direct innerHTML — bypass attachHandlers, which would auto-advance to
      // Stage 2 after ~200ms and/or fire the CT mini-call.
      app.innerHTML = renderCtAnalyzing();
      break;

    case 'stage2':
      state.phase = 'stage2';
      state.stage2Idx = spec.idx;
      if (spec.answer !== undefined) state.stage2Answers[spec.idx] = spec.answer;
      app.innerHTML = renderStage2();
      break;

    case 'call1':
      state.phase = 'call1-analyzing';
      state._call1Done = !!spec.done;
      // Direct innerHTML — bypass attachHandlers (fires the real network call +
      // a 20s timer).
      app.innerHTML = renderCall1Analyzing();
      break;

    case 'stage3': {
      state.phase = 'stage3'; // so getQuestionsAnswered() fills the progress bar
      ensureScores();
      // Synthesize a frozen AI Call #1 contract -> STANDARD pairwise, single Q1.
      // gap='clear' so fireQ2 stays false (one screen). Types 2 vs 1.
      const call1 = { stage3_mode: 'standard', leading_candidate: 2, alternate_candidate: 1, gap: 'clear', ct_pair: null };
      state.call1Result = call1;
      state.scores.stage3Pair = buildStage3Routing(call1);
      state.stage3Idx = 0;
      state.stage3Answers = [];
      app.innerHTML = renderStage3();
      break;
    }

    case 'stage4': {
      state.phase = 'stage4'; // so getQuestionsAnswered() fills the progress bar
      ensureScores();
      // Option B (pairwise) standard path: lead Type 2 vs second Type 1.
      const pr = { option: 'B', path: 'STANDARD', leadType: 2, secondType: 1 };
      state.scores.stage4PathResolve = pr;
      state.stage4Sequence = initialStage4Sequence(pr); // [stress, security]
      if (spec.withHabit) {
        state.stage4Sequence.push({ instrument: 'habit', format: 'pairwise', typeA: 2, typeB: 1 });
      }
      state.stage4Idx = spec.idx;
      state.stage4Answers = [];
      state.stage4Shuffles = [];
      app.innerHTML = renderStage4();
      break;
    }

    case 'finalopen':
      state.phase = 'finalopen';
      app.innerHTML = renderFinalOpen();
      break;

    case 'processing':
      state.phase = 'processing';
      app.innerHTML = renderProcessing();
      break;

    case 'confirmation':
      state.phase = 'confirmation';
      state.intake = Object.assign({}, state.intake, { firstName: 'Alex', email: 'alex.rivera@example.com' });
      app.innerHTML = renderConfirmation();
      break;

    case 'error':
      state.phase = 'error';
      app.innerHTML = renderError();
      break;

    default:
      throw new Error('unknown screen kind: ' + spec.kind);
  }

  if (typeof updateProgress === 'function') updateProgress();
  injectSaveLater();
  return 'innerHTML';
}

/* ---------------------------------------------------------------------------
 * The ordered capture list. Numbers reflect TRUE traversal order (see header).
 * ------------------------------------------------------------------------- */
const SCREENS = [
  { n: 1,  slug: 'welcome',                     spec: { kind: 'welcome' } },
  { n: 2,  slug: 'intake',                       spec: { kind: 'intake' } },
  { n: 3,  slug: 'stage0_q1_self_description',   spec: { kind: 'stage0', idx: 0 } },
  { n: 4,  slug: 'stage0_q2_others_description', spec: { kind: 'stage0', idx: 1 } },
  { n: 5,  slug: 'stage0_q3_strength',           spec: { kind: 'stage0', idx: 2 } },
  { n: 6,  slug: 'stage0_q4_shadow',             spec: { kind: 'stage0', idx: 3 } },
  { n: 7,  slug: 'mid_assessment_reminders',     spec: { kind: 'mid' } },
  { n: 8,  slug: 'stage1_type_sliders_s1_t3_t6', spec: { kind: 'stage1', idx: 0 } },
  { n: 9,  slug: 'stage1_type_sliders_s2_t9_t1', spec: { kind: 'stage1', idx: 1 } },
  { n: 10, slug: 'stage1_type_sliders_s3_t4_t2', spec: { kind: 'stage1', idx: 2 } },
  { n: 11, slug: 'stage1_type_sliders_s4_t8_t5', spec: { kind: 'stage1', idx: 3 } },
  { n: 12, slug: 'stage1_type_sliders_s5_t7',    spec: { kind: 'stage1', idx: 4 } },
  { n: 13, slug: 'stage1_type_open',             spec: { kind: 'stage1', idx: 5 } },
  { n: 14, slug: 'stage1_instinct_sliders_sp',   spec: { kind: 'stage1', idx: 6 } },
  { n: 15, slug: 'stage1_instinct_sliders_so',   spec: { kind: 'stage1', idx: 7 } },
  { n: 16, slug: 'stage1_instinct_sliders_sx',   spec: { kind: 'stage1', idx: 8 } },
  { n: 17, slug: 'stage1_instinct_open',         spec: { kind: 'stage1', idx: 9 } },
  { n: 18, slug: 'ct_analyzing_interstitial',    spec: { kind: 'ct' } },
  { n: 19, slug: 'stage2_q1_hornevian',          spec: { kind: 'stage2', idx: 0 } },
  { n: 20, slug: 'stage2_q2_harmonic',           spec: { kind: 'stage2', idx: 1 } },
  { n: 21, slug: 'stage2_q3_centers_ranking',    spec: { kind: 'stage2', idx: 2 } },
  { n: 22, slug: 'call1_analyzing_spinner',      spec: { kind: 'call1', done: false } },
  { n: 23, slug: 'call1_analyzing_done',         spec: { kind: 'call1', done: true } },
  { n: 24, slug: 'stage3_pairwise_standard',     spec: { kind: 'stage3' } },
  { n: 25, slug: 'stage4_stress',                spec: { kind: 'stage4', idx: 0, withHabit: false } },
  { n: 26, slug: 'stage4_security',              spec: { kind: 'stage4', idx: 1, withHabit: false } },
  { n: 27, slug: 'stage4_habit',                 spec: { kind: 'stage4', idx: 2, withHabit: true } },
  { n: 28, slug: 'finalopen',                    spec: { kind: 'finalopen' } },
  { n: 29, slug: 'processing_call2',             spec: { kind: 'processing' } },
  { n: 30, slug: 'confirmation_client_end',      spec: { kind: 'confirmation' } },
  { n: 31, slug: 'error',                        spec: { kind: 'error' } },
];

const pad2 = (n) => String(n).padStart(2, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const server = await startServer();
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/`;
  console.log(`[server] static server on ${baseUrl}`);

  console.log(`[mode] ${MODE} — viewport ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log(`[out]  ${OUT_DIR}  (suffix '${SUFFIX}')`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // Surface in-page errors so a broken screen doesn't fail silently.
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const captured = [];
  const failed = [];

  for (const screen of SCREENS) {
    const fileName = `screen_${pad2(screen.n)}_${screen.slug}${SUFFIX}.png`;
    const filePath = path.join(OUT_DIR, fileName);
    try {
      // Fresh load each iteration -> pristine state, no cross-screen bleed.
      await page.goto(baseUrl, { waitUntil: 'networkidle0' });

      const errBefore = pageErrors.length;
      const mode = await page.evaluate(applyScreen, screen.spec);
      // Slider screens schedule thumb positioning at ~60ms post-render; give it
      // room plus a beat for fonts/layout to settle.
      await sleep(mode === 'render' ? 400 : 150);

      if (pageErrors.length > errBefore) {
        throw new Error('in-page error: ' + pageErrors.slice(errBefore).join(' | '));
      }

      // Guard against a blank render.
      const textLen = await page.evaluate(() => (document.getElementById('app').innerText || '').trim().length);
      if (textLen === 0) throw new Error('blank render (app has no text)');

      await page.screenshot({ path: filePath, fullPage: true });
      captured.push({ file: fileName, path: filePath });
      console.log(`  ✓ ${fileName}`);
    } catch (err) {
      failed.push({ file: fileName, reason: err.message });
      console.log(`  ✗ ${fileName} — FAILED: ${err.message}`);
    }
  }

  await browser.close();
  server.close();

  // -------- Summary --------
  console.log('\n=================== SUMMARY ===================');
  console.log(`Total screens in inventory: ${SCREENS.length}`);
  console.log(`Captured: ${captured.length}`);
  console.log(`Failed:   ${failed.length}`);
  if (failed.length) {
    console.log('\nFAILED screens:');
    failed.forEach((f) => console.log(`  - ${f.file}: ${f.reason}`));
  }
  console.log(`\nOutput dir: ${OUT_DIR}`);
  console.log('Files written:');
  captured.forEach((c) => console.log(`  ${c.path}`));

  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
