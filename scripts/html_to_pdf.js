'use strict';

/**
 * html_to_pdf.js — Convert existing sample HTML files to PDFs via Puppeteer.
 * Usage: node scripts/html_to_pdf.js <input.html> <output.pdf>
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
require('module').globalPaths.push(path.join(ROOT, 'app/node_modules'));

const { buildPdfOptions } = require(path.join(ROOT, 'app/renderer'));

const [,, inputHtml, outputPdf] = process.argv;
if (!inputHtml || !outputPdf) {
  console.error('Usage: node scripts/html_to_pdf.js <input.html> <output.pdf>');
  process.exit(1);
}

(async () => {
  // Pinned bundled Chromium via the shared launcher — one engine everywhere.
  const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));
  const html = fs.readFileSync(path.resolve(inputHtml), 'utf8');
  const pdfOpts = buildPdfOptions({ firstName: 'SP4', lastName: 'Sample' });

  const browser = await browserLaunch.launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    const outPath = path.resolve(outputPdf);
    await page.pdf({ path: outPath, ...pdfOpts });
    await page.close();
    console.log(`✓ PDF saved: ${outPath}`);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
