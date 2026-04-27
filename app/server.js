'use strict';

const express    = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const sgMail     = require('@sendgrid/mail');
const basicAuth  = require('express-basic-auth');
const fs         = require('fs');
const path       = require('path');

// override: true lets values in .env authoritatively replace ambient shell env.
require('dotenv').config({ override: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[boot] FATAL: ANTHROPIC_API_KEY is not set. Check .env');
  process.exit(1);
}

// Configure SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('[boot] WARNING: SENDGRID_API_KEY is not set — emails will not be sent');
}

// Load renderer and type library
const { buildClientHTML, buildCoachHTML } = require('./renderer');
const db = require('./db');

const TYPE_LIBRARY_PATH = path.join(__dirname, '../content/type_library.json');
let typeLibrary = null;
try {
  typeLibrary = JSON.parse(fs.readFileSync(TYPE_LIBRARY_PATH, 'utf8'));
  console.log('[boot] type_library loaded, version:', typeLibrary._meta && typeLibrary._meta.version);
} catch (e) {
  console.warn('[boot] could not load type_library:', e.message);
  typeLibrary = { static_primers: {}, types: {} };
}

// Ensure reports directory exists
const REPORTS_DIR = path.join(__dirname, 'reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Initialize database (schema + seed coaches) — non-blocking
db.initDb().catch(e => console.error('[boot] db.initDb error:', e.message));

// =================== EXPRESS APP ===================

const app = express();

// Basic auth — protects all routes
app.use(basicAuth({
  users: {
    [process.env.BASIC_AUTH_USER || 'hive-enneagram']: process.env.BASIC_AUTH_PASSWORD || '9Types!',
  },
  challenge: true,
  realm: 'Hive Typing Engine',
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/content', express.static('../content'));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// =================== PUPPETEER LAUNCH ===================

async function launchBrowser() {
  if (process.env.NODE_ENV === 'production') {
    // Railway — use full puppeteer with bundled Chromium
    const puppeteerFull = require('puppeteer');
    return await puppeteerFull.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } else {
    // Local Mac — use puppeteer-core with system Chrome
    const puppeteerCore = require('puppeteer-core');
    return await puppeteerCore.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}

// =================== PDF GENERATION ===================

async function generatePDF(htmlString, filename) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(htmlString, { waitUntil: 'networkidle0' });

    const filePath = path.join(REPORTS_DIR, `${filename}_${Date.now()}.pdf`);
    await page.pdf({
      path: filePath,
      format: 'A4',
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      printBackground: true,
    });

    return filePath;
  } finally {
    await browser.close();
  }
}

// =================== EMAIL DELIVERY ===================

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendEmails(intake, result, clientPdfPath, coachPdfPath) {
  const h = result.hypothesis;
  const typeName = (h.confirmed_type_name || '').replace(/^Type\s*\d+\s*[—–-]+\s*/i, '').trim() ||
    { 1: 'The Improver', 2: 'The Giver', 3: 'The Performer', 4: 'The Idealist',
      5: 'The Observer', 6: 'The Questioner', 7: 'The Enthusiast', 8: 'The Protector',
      9: 'The Peacemaker' }[h.confirmed_type] || '';

  const fromEmail  = process.env.SENDGRID_FROM_EMAIL;
  const coachEmail = (intake.coach === 'Monique Breault')
    ? (process.env.COACH_EMAIL_MONIQUE || process.env.COACH_EMAIL)
    : (process.env.COACH_EMAIL_CAI    || process.env.COACH_EMAIL);
  const assessmentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const appUrl = process.env.RAILWAY_PUBLIC_URL || 'https://hive-typing-engine-production.up.railway.app';

  // Read PDFs and encode as base64
  let clientPdfB64 = null;
  let coachPdfB64  = null;

  try { if (clientPdfPath) clientPdfB64 = fs.readFileSync(clientPdfPath).toString('base64'); }
  catch (e) { console.error('[email] could not read client PDF:', e.message); }
  try { if (coachPdfPath) coachPdfB64 = fs.readFileSync(coachPdfPath).toString('base64'); }
  catch (e) { console.error('[email] could not read coach PDF:', e.message); }

  // ---- Client email ----
  const clientMsg = {
    to:      intake.email,
    from:    fromEmail,
    subject: `Your Hive Enneagram Report is Ready, ${intake.firstName}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1A2B33; line-height: 1.7;">
        <div style="border-top: 4px solid #00b1d7; padding-top: 28px; margin-bottom: 24px;">
          <p style="font-size: 11px; color: #7A96A6; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6px;">Hive Enneagram Type Tool</p>
          <h1 style="font-size: 22px; color: #00b1d7; margin: 0; font-weight: 700;">Your Enneagram Report is Ready</h1>
        </div>

        <p style="font-size: 15px;">Dear ${esc(intake.firstName)},</p>

        <p>Thank you for completing the Hive Enneagram assessment. Your personalized report is attached to this email.</p>

        <p>Your report reflects the responses you shared and offers a starting point for understanding your Enneagram type. We encourage you to hold the findings lightly — think of them as a hypothesis worth exploring, not a final verdict.</p>

        <p>Your upcoming session is a great place to unpack what resonates, what doesn't quite fit, and where you'd like to go deeper. If you have questions before then, feel free to reach out.</p>

        <p style="margin-top: 32px; color: #4A6070; font-size: 13px;">We look forward to the conversation.</p>

        <p style="color: #4A6070; font-size: 13px; margin: 0;">Warm regards,<br><strong style="color: #1A2B33;">Cai and Monique</strong><br>Hive Leadership</p>

        <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #E0E8EC; font-size: 11px; color: #7A96A6;">
          This report was generated by the Hive Enneagram Typing Engine at ${appUrl}. © 2026 Hive, Inc. All rights reserved.
        </div>
      </div>
    `,
  };

  if (clientPdfB64) {
    clientMsg.attachments = [{
      content:     clientPdfB64,
      filename:    `Hive_Enneagram_Report_${intake.firstName}_${intake.lastName}.pdf`,
      type:        'application/pdf',
      disposition: 'attachment',
    }];
  } else {
    clientMsg.html += `<p style="color:#856404;font-size:12px;">(Note: the PDF attachment could not be generated — your coach will provide the report in your session.)</p>`;
  }

  // ---- Coach email ----
  const coachMsg = {
    to:      coachEmail,
    from:    fromEmail,
    subject: `Coach Prep Report — ${intake.firstName} ${intake.lastName}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1A2B33; line-height: 1.7;">
        <div style="border-top: 4px solid #f58527; padding-top: 28px; margin-bottom: 24px;">
          <p style="font-size: 11px; color: #7A96A6; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6px;">Hive Enneagram Type Tool — Coach Prep</p>
          <h1 style="font-size: 22px; color: #f58527; margin: 0; font-weight: 700;">Assessment Complete</h1>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
          <tr style="border-bottom: 1px solid #EFE8E0;">
            <td style="padding: 8px 0; color: #7A96A6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; width: 40%;">Client</td>
            <td style="padding: 8px 0; font-weight: 600;">${esc(intake.firstName)} ${esc(intake.lastName)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #EFE8E0;">
            <td style="padding: 8px 0; color: #7A96A6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Email</td>
            <td style="padding: 8px 0;">${esc(intake.email)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #EFE8E0;">
            <td style="padding: 8px 0; color: #7A96A6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Organization</td>
            <td style="padding: 8px 0;">${esc(intake.organization || 'Not provided')}</td>
          </tr>
          <tr style="border-bottom: 1px solid #EFE8E0;">
            <td style="padding: 8px 0; color: #7A96A6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Coach</td>
            <td style="padding: 8px 0;">${esc(intake.coach || 'Not provided')}</td>
          </tr>
          <tr style="border-bottom: 1px solid #EFE8E0;">
            <td style="padding: 8px 0; color: #7A96A6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Confirmed Type</td>
            <td style="padding: 8px 0; font-weight: 700; color: #f58527;">Type ${h.confirmed_type} — ${esc(typeName)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #EFE8E0;">
            <td style="padding: 8px 0; color: #7A96A6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Confidence</td>
            <td style="padding: 8px 0;">${esc((h.confidence_level || '').replace(/_/g, '-'))}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #7A96A6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Date of Assessment</td>
            <td style="padding: 8px 0;">${assessmentDate}</td>
          </tr>
        </table>

        <p style="font-size: 13px; color: #4A6070;">Both the client report and your coach prep report are attached. The client has also received their copy by email.</p>

        <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #E0E8EC; font-size: 11px; color: #7A96A6;">
          Hive Enneagram Typing Engine — Internal Use Only. Generated at ${appUrl}. © 2026 Hive, Inc.
        </div>
      </div>
    `,
  };

  const coachAttachments = [];
  if (clientPdfB64) {
    coachAttachments.push({
      content:     clientPdfB64,
      filename:    `Hive_Enneagram_Report_${intake.firstName}_${intake.lastName}.pdf`,
      type:        'application/pdf',
      disposition: 'attachment',
    });
  }
  if (coachPdfB64) {
    coachAttachments.push({
      content:     coachPdfB64,
      filename:    `Hive_Coach_Report_${intake.firstName}_${intake.lastName}.pdf`,
      type:        'application/pdf',
      disposition: 'attachment',
    });
  }
  if (coachAttachments.length > 0) coachMsg.attachments = coachAttachments;

  // Send both emails
  try {
    await sgMail.send(clientMsg);
    console.log(`[email] client email sent to ${intake.email}`);
  } catch (e) {
    console.error('[email] failed to send client email:', e.message, e.response && e.response.body);
  }

  try {
    await sgMail.send(coachMsg);
    console.log(`[email] coach email sent to ${coachEmail}`);
  } catch (e) {
    console.error('[email] failed to send coach email:', e.message, e.response && e.response.body);
  }
}

// =================== BACKGROUND JOB ===================

async function runBackgroundJob(systemPrompt, userMessage, intake, scores, assessmentId) {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let result = null;

  // 1. Call Claude API with retries
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userMessage }],
      });

      const text  = response.content[0].text;
      const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      result = JSON.parse(clean);

      console.log(`[submit] usage — ${JSON.stringify(response.usage)}`);
      console.log(`[submit] Claude success — attempt ${attempt}, confirmed_type=${result?.hypothesis?.confirmed_type}, confidence=${result?.hypothesis?.confidence_level}`);
      break;
    } catch (err) {
      console.error(`[submit] attempt ${attempt} failed:`, err.message);
      if (attempt < 3) {
        await delay(Math.pow(2, attempt) * 1000);
      } else {
        // All retries exhausted
        await db.failAssessment(assessmentId);
        await sendErrorNotification(intake, err);
        return;
      }
    }
  }

  // 2. Update assessment record with results
  await db.completeAssessment(assessmentId, result);

  // 3. Generate PDFs
  let clientPdfPath = null;
  let coachPdfPath  = null;

  try {
    const clientHtml = buildClientHTML(result, typeLibrary);
    clientPdfPath = await generatePDF(clientHtml, `client_${intake.firstName}_${intake.lastName}`);
    console.log(`[pdf] client PDF generated: ${clientPdfPath}`);
    await db.createReport(assessmentId, 'client', clientPdfPath);
  } catch (e) {
    console.error('[pdf] client PDF generation failed:', e.message);
  }

  try {
    const coachHtml = buildCoachHTML(result, typeLibrary, scores);
    coachPdfPath = await generatePDF(coachHtml, `coach_${intake.firstName}_${intake.lastName}`);
    console.log(`[pdf] coach PDF generated: ${coachPdfPath}`);
    await db.createReport(assessmentId, 'coach', coachPdfPath);
  } catch (e) {
    console.error('[pdf] coach PDF generation failed:', e.message);
  }

  // 4. Send emails
  try {
    await sendEmails(intake, result, clientPdfPath, coachPdfPath);
  } catch (e) {
    console.error('[email] sendEmails threw:', e.message);
  }
}

async function sendErrorNotification(intake, err) {
  if (!process.env.SENDGRID_API_KEY) return;
  const coachEmail = process.env.COACH_EMAIL_CAI || process.env.COACH_EMAIL;
  try {
    await sgMail.send({
      to:      coachEmail,
      from:    process.env.SENDGRID_FROM_EMAIL,
      subject: `[Hive Error] Assessment processing failed — ${intake.firstName} ${intake.lastName}`,
      text: [
        `Assessment processing failed after all retries.`,
        ``,
        `Client: ${intake.firstName} ${intake.lastName}`,
        `Email: ${intake.email}`,
        `Organization: ${intake.organization || 'Not provided'}`,
        ``,
        `Error: ${err && err.message}`,
        `Timestamp: ${new Date().toISOString()}`,
      ].join('\n'),
    });
    console.log('[error-notify] error notification sent to coach');
  } catch (notifyErr) {
    console.error('[error-notify] could not send error notification:', notifyErr.message);
  }
}

// =================== ROUTES ===================

// New submission endpoint — returns immediately, processes in background
app.post('/api/submit', async (req, res) => {
  const { systemPrompt, userMessage, intake, scores } = req.body;
  const intakeInfo = intake ? `${intake.firstName} ${intake.lastName} <${intake.email}>` : 'unknown';
  console.log(`[submit] received from ${intakeInfo} — system ${systemPrompt?.length ?? 0} chars, user ${userMessage?.length ?? 0} chars`);

  // Respond immediately
  res.json({ ok: true, status: 'processing' });

  // Create DB records (fire-and-forget safe — all wrapped in try/catch in db.js)
  let assessmentId = null;
  try {
    const coachId  = await db.findOrCreateCoach(intake?.coach || 'Cai Delumpa');
    const clientId = await db.createClient(intake || {}, coachId);
    assessmentId   = await db.createAssessment(clientId, { systemPrompt, userMessage, intake });
    if (assessmentId) console.log(`[submit] assessment #${assessmentId} created`);
  } catch (e) {
    console.error('[submit] DB record creation error:', e.message);
  }

  // Fire and forget background job
  (async () => {
    try {
      await runBackgroundJob(systemPrompt, userMessage, intake || {}, scores || {}, assessmentId);
    } catch (e) {
      console.error('[submit] unhandled background job error:', e.message);
    }
  })();
});

// Original endpoint — kept unchanged for the test runner
app.post('/api/analyze', async (req, res) => {
  const { systemPrompt, userMessage } = req.body;
  const started = Date.now();
  console.log(`[analyze] request received — system ${systemPrompt?.length ?? 0} chars, user ${userMessage?.length ?? 0} chars`);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userMessage }],
      });

      const text    = response.content[0].text;
      const clean   = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const result  = JSON.parse(clean);
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`[analyze] usage — ${JSON.stringify(response.usage)}`);
      console.log(`[analyze] success — attempt ${attempt}, ${elapsed}s, confirmed_type=${result?.hypothesis?.confirmed_type}, confidence=${result?.hypothesis?.confidence_level}, outcome=${result?.hypothesis?.stage4_outcome}, flags=${result?.flags?.length ?? 0}`);
      return res.json({ ok: true, result });
    } catch (err) {
      console.error(`[analyze] attempt ${attempt} failed:`, err.message);
      if (attempt < 3) await delay(Math.pow(2, attempt) * 1000);
    }
  }

  console.error('[analyze] all 3 attempts failed — returning fallback to client');
  return res.status(500).json({
    ok:      false,
    message: 'Your results are being prepared — check your email within 24 hours.',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Hive Typing Engine → http://localhost:${PORT}`)
);
