'use strict';

/**
 * measure.js — Puppeteer zone-measurement hard gate (Step 7 Phase 5, A8).
 *
 * Renders report HTML at the fixed page geometry and measures rendered zone
 * heights via getBoundingClientRect(). HARD-FAILS (returns pass:false) on:
 *   - any .page-body whose content overflows its fixed height (scrollHeight > clientHeight)
 *   - any [data-budget] zone whose scrollHeight exceeds its declared px budget
 *
 * The auto-regeneration loop is deferred to Phase 7 — on a violation the caller
 * halts loudly and does NOT generate a PDF.
 */

const TOLERANCE = 1; // px — sub-pixel rounding slack

async function launchBrowser() {
  if (process.env.NODE_ENV === 'production') {
    const puppeteer = require('puppeteer');
    return puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  }
  const puppeteerCore = require('puppeteer-core');
  return puppeteerCore.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

/**
 * Measure a report's HTML. Returns { pass, violations:[{zone,kind,measured,budget,page}], zones:[...] }.
 * @param {string} html
 * @param {object} [opts] { width=816, height=1056 }
 */
async function measureReport(html, opts = {}) {
  const width = opts.width || 816, height = opts.height || 1056;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    // Wait for fonts + a brief settle so metrics are stable.
    await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
    await new Promise(r => setTimeout(r, 150));

    const result = await page.evaluate((tol) => {
      const zones = [];
      // 1. page-body overflow (primary hard gate)
      document.querySelectorAll('.page-body').forEach((el) => {
        zones.push({
          zone: el.getAttribute('data-zone') || 'page-body',
          page: el.getAttribute('data-page') || null,
          kind: 'overflow',
          measured: el.scrollHeight,
          budget: el.clientHeight,
          overflow: el.scrollHeight > el.clientHeight + tol,
        });
      });
      // 2. explicit data-budget zones
      document.querySelectorAll('[data-budget]').forEach((el) => {
        const budget = parseFloat(el.getAttribute('data-budget'));
        zones.push({
          zone: el.getAttribute('data-zone') || el.className,
          page: (el.closest('[data-page]') || {}).getAttribute ? el.closest('[data-page]').getAttribute('data-page') : null,
          kind: 'budget',
          measured: el.scrollHeight,
          budget,
          overflow: el.scrollHeight > budget + tol,
        });
      });
      return zones;
    }, TOLERANCE);

    const violations = result.filter(z => z.overflow);
    return { pass: violations.length === 0, violations, zones: result };
  } finally {
    await browser.close();
  }
}

module.exports = { measureReport };
