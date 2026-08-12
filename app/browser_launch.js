'use strict';
/**
 * Single source of truth for launching Chromium, and for asserting that the font
 * the report was measured against is the font Chromium actually resolved.
 *
 * WHY THIS EXISTS (PR 1, client report v3)
 * ----------------------------------------
 * Before this module, production launched full `puppeteer` (bundled Chromium) while
 * local dev and the verification scripts launched `puppeteer-core` against a hard-coded
 * /Applications/Google Chrome path. That meant production rendered on Chromium 147
 * (pinned by puppeteer 24.42.0) while local rendered on whatever Chrome the developer
 * had — 151 at the time of writing. Four major versions apart, on the same HTML, with
 * the single-sheet contract measured locally. Design spec v3.0 section 3.3 calls a font
 * or engine mismatch "the most likely cause of a page silently becoming two sheets in
 * production"; the engine half of that was already true and invisible.
 *
 * Everything now launches the bundled binary, so there is exactly one rendering engine.
 * PUPPETEER_EXECUTABLE_PATH remains as an opt-in escape hatch for anyone who genuinely
 * needs a system browser — it is never the default.
 */

const REPORT_FONT_STACK = 'Arial, Helvetica, sans-serif';

/**
 * Arial advance widths for a probe string at 100px, measured on a machine with genuine
 * Arial. Liberation Sans is metric-compatible and reproduces these exactly; DejaVu Sans
 * (the usual Linux fallback when neither is installed) does not. Comparing against a
 * known constant is deterministic — unlike comparing against the generic sans-serif
 * default, which produces a false failure when the default happens to BE the target font.
 */
const FONT_PROBE = {
  text: 'Hamburgefonstiv HAMBURGEFONSTIV 0123456789',
  sizePx: 100,
  tolerancePx: 1.0,
};

/**
 * Measured against genuine Arial under the pinned Chromium (147.0.7727.57).
 * Liberation Sans reproduces this exactly — that is what "metric-compatible" means.
 * DejaVu Sans, the usual fallback when neither is installed, does not.
 *
 * Note on platform sensitivity: on macOS, Arial IS the default sans-serif, so a missing
 * font cannot be distinguished by width there. The check therefore has its discriminating
 * power on Linux — which is precisely where production and CI run, and why the CI runner
 * is deliberately Linux rather than macOS.
 */
const FONT_PROBE_EXPECTED = 2378.81;

function launchOptions(extraArgs = []) {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', ...extraArgs];
  const opts = { headless: 'new', args };
  // Opt-in only. Set PUPPETEER_EXECUTABLE_PATH to render with a system browser instead
  // of the pinned bundled Chromium. Doing so voids the measurement guarantees above.
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  return opts;
}

/** Launch the pinned, bundled Chromium. One engine everywhere: prod, local, CI. */
async function launchBrowser(extraArgs = []) {
  const puppeteer = require('puppeteer');
  return puppeteer.launch(launchOptions(extraArgs));
}

/** Chromium build actually in use, for build reports and CI logs. */
async function browserVersion(browser) {
  try { return await browser.version(); } catch { return 'unknown'; }
}

/**
 * Fail loudly if Chromium resolved something other than an Arial-metric font.
 *
 * Without this the failure is silent: Chromium substitutes, every line break shifts, and
 * the first symptom is a page quietly becoming two sheets. Call it against any page that
 * has already had content set.
 */
async function assertReportFont(page) {
  const measured = await page.evaluate((probe, stack) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${probe.sizePx}px ${stack}`;
    return c.measureText(probe.text).width;
  }, { text: FONT_PROBE.text, sizePx: FONT_PROBE.sizePx }, REPORT_FONT_STACK);

  const delta = Math.abs(measured - FONT_PROBE_EXPECTED);
  if (delta > FONT_PROBE.tolerancePx) {
    throw new Error(
      `Font resolution check FAILED.\n` +
      `  stack:    ${REPORT_FONT_STACK}\n` +
      `  expected: ${FONT_PROBE_EXPECTED}px (Arial / Liberation Sans metrics)\n` +
      `  measured: ${measured.toFixed(1)}px  (delta ${delta.toFixed(1)}px)\n` +
      `Chromium substituted a different font. Every measurement in design spec v3.0\n` +
      `section 3 assumes Arial metrics, so single-sheet fit is no longer guaranteed.\n` +
      `Install Liberation Sans (see nixpacks.toml) or set the font explicitly.`
    );
  }
  return measured;
}

module.exports = {
  launchBrowser, launchOptions, browserVersion, assertReportFont,
  REPORT_FONT_STACK, FONT_PROBE, FONT_PROBE_EXPECTED,
};
