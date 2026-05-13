'use strict';

const express    = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const sgMail     = require('@sendgrid/mail');
const basicAuth  = require('express-basic-auth');
const bcrypt     = require('bcrypt');
const session    = require('express-session');
const crypto     = require('crypto');
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
const { buildClientHTML, buildCoachHTML, buildPdfOptions } = require('./renderer');
const db = require('./db');

const TYPE_LIBRARY_PATH = path.join(__dirname, 'type_library.json');
let typeLibrary = null;
try {
  typeLibrary = JSON.parse(fs.readFileSync(TYPE_LIBRARY_PATH, 'utf8'));
  console.log('[boot] type_library loaded, version:', typeLibrary._meta && typeLibrary._meta.version);
} catch (e) {
  console.warn('[boot] could not load type_library:', e.message);
  typeLibrary = { static_primers: {}, types: {} };
}

// Ensure reports directory exists (Railway Volume path takes precedence)
const REPORTS_DIR = process.env.REPORTS_DIR || path.join(__dirname, 'reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// Initialize database (schema + seed coaches) — non-blocking
db.initDb().catch(e => console.error('[boot] db.initDb error:', e.message));

// =================== EXPRESS APP ===================

const app = express();

// Session middleware — must run before basic auth so req.session is available for exemption checks
const PgSession = require('connect-pg-simple')(session);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'hive-session-secret-dev',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 },
}));

// Basic auth — protects all routes except /admin (session auth) and token-based assessment sessions
const basicAuthMiddleware = basicAuth({
  users: {
    [process.env.BASIC_AUTH_USER || 'hive-enneagram']: process.env.BASIC_AUTH_PASSWORD || '9Types!',
  },
  challenge: true,
  realm: 'Hive Typing Engine',
});
app.use((req, res, next) => {
  if (req.path === '/admin/login' || req.path.startsWith('/admin')) return next();
  if (req.path.startsWith('/assessment/')) return next();
  if (req.session && req.session.assessmentClientId) return next();
  basicAuthMiddleware(req, res, next);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// Inject window.__hiveIntake for token-based assessment sessions before static serves index.html
const INDEX_HTML_PATH = path.join(__dirname, 'public', 'index.html');
app.get('/', (req, res, next) => {
  if (!req.session || !req.session.assessmentIntake) return next();
  try {
    let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    const scriptTag = `<script>window.__hiveIntake = ${JSON.stringify(req.session.assessmentIntake)};</script>`;
    html = html.replace('</head>', `${scriptTag}\n</head>`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    console.error('[GET /] index.html read error:', e.message);
    next();
  }
});

app.use(express.static('public'));
app.use('/content', express.static('../content'));

// Session auth guard for admin routes
function requireAdminSession(req, res, next) {
  if (req.session && req.session.coach_id) return next();
  res.redirect('/admin/login');
}

// Super-admin guard — requires is_admin flag in session
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.coach_id) return res.redirect('/admin/login');
  if (req.session.coach_is_admin !== true) {
    return res.redirect('/admin?error=admin_required');
  }
  next();
}

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

async function generatePDF(htmlString, filename, pdfOptions) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(htmlString, { waitUntil: 'networkidle0' });

    // Activate print media so @media print CSS rules are applied
    await page.emulateMediaType('print');

    const filePath = path.join(REPORTS_DIR, `${filename}_${Date.now()}.pdf`);
    await page.pdf({
      path: filePath,
      // pdfOptions includes format, printBackground, displayHeaderFooter,
      // headerTemplate, footerTemplate, and margin (header/footer/content margins).
      ...(pdfOptions || {
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
      }),
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
    from:    { name: 'InsightOut by Hive', email: fromEmail },
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
    from:    { name: 'InsightOut by Hive', email: fromEmail },
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

// =================== PDF REPORT GENERATION HELPER ===================

async function generateReportPDFs(result, scores, intake, assessmentId) {
  const pdfOpts = buildPdfOptions(intake);
  let clientPdfPath = null;
  let coachPdfPath  = null;

  try {
    const clientHtml = buildClientHTML(result, typeLibrary, intake);
    clientPdfPath = await generatePDF(clientHtml, `client_${intake.firstName}_${intake.lastName}`, pdfOpts);
    console.log(`[pdf] client PDF generated: ${clientPdfPath}`);
    if (assessmentId) await db.createReport(assessmentId, 'client', clientPdfPath);
  } catch (e) {
    console.error('[pdf] client PDF generation failed:', e.message);
  }

  try {
    const coachHtml = buildCoachHTML(result, typeLibrary, scores, intake);
    coachPdfPath = await generatePDF(coachHtml, `coach_${intake.firstName}_${intake.lastName}`, pdfOpts);
    console.log(`[pdf] coach PDF generated: ${coachPdfPath}`);
    if (assessmentId) await db.createReport(assessmentId, 'coach', coachPdfPath);
  } catch (e) {
    console.error('[pdf] coach PDF generation failed:', e.message);
  }

  return { clientPdfPath, coachPdfPath };
}

// =================== BACKGROUND JOB ===================

// Shared helper: call Claude API with up to 3 attempts + exponential backoff.
// Resolves to the parsed JSON result, or throws if all attempts fail.
async function callClaudeWithRetry(systemPrompt, userMessage) {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      });
      const text  = response.content[0].text;
      const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const result = JSON.parse(clean);
      console.log(`[claude] usage — ${JSON.stringify(response.usage)}`);
      console.log(`[claude] success — attempt ${attempt}, confirmed_type=${result?.hypothesis?.confirmed_type}, confidence=${result?.hypothesis?.confidence_level}`);
      return result;
    } catch (err) {
      console.error(`[claude] attempt ${attempt} failed:`, err.message);
      if (attempt < 3) await delay(Math.pow(2, attempt) * 1000);
      else throw err;
    }
  }
}

async function runBackgroundJob(systemPrompt, userMessage, intake, scores, assessmentId, clientId) {
  // 1. Persist scores_snapshot immediately — before the API call — so the
  //    assessment is recoverable even if Claude fails.
  if (assessmentId) {
    await db.query(
      `UPDATE assessments SET scores_snapshot = $1 WHERE id = $2`,
      [JSON.stringify(scores), assessmentId]
    );
  }

  // 2. Call Claude API with retries
  let result;
  try {
    result = await callClaudeWithRetry(systemPrompt, userMessage);
  } catch (err) {
    await db.failAssessment(assessmentId);
    await sendErrorNotification(intake, err);
    return;
  }

  // 3. Persist api_result now that the call succeeded
  if (assessmentId) {
    await db.query(
      `UPDATE assessments SET api_result = $1 WHERE id = $2`,
      [JSON.stringify(result), assessmentId]
    );
  }

  // 4. Update assessment record with results
  await db.completeAssessment(assessmentId, result);
  if (clientId) await db.updateClientStatus(clientId, 'complete');

  // 5. Generate PDFs via shared helper
  const { clientPdfPath, coachPdfPath } = await generateReportPDFs(result, scores, intake, assessmentId);

  // 6. Mark PDF generation timestamp
  if (assessmentId) {
    await db.query(
      `UPDATE assessments SET pdf_generated_at = NOW() WHERE id = $1`,
      [assessmentId]
    );
  }

  // 7. Send emails
  try {
    await sendEmails(intake, result, clientPdfPath, coachPdfPath);
    if (assessmentId) {
      await db.query(
        `UPDATE assessments SET email_sent_at = NOW() WHERE id = $1`,
        [assessmentId]
      );
    }
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
      from:    { name: 'InsightOut by Hive', email: process.env.SENDGRID_FROM_EMAIL },
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
  const { systemPrompt, userMessage, intake, scores, client_id: bodyClientId } = req.body;
  const intakeInfo = intake ? `${intake.firstName} ${intake.lastName} <${intake.email}>` : 'unknown';
  console.log(`[submit] received from ${intakeInfo} — system ${systemPrompt?.length ?? 0} chars, user ${userMessage?.length ?? 0} chars`);

  // Respond immediately
  res.json({ ok: true, status: 'processing' });

  // Create DB records (fire-and-forget safe — all wrapped in try/catch in db.js)
  let assessmentId = null;
  let resolvedClientId = bodyClientId || null;
  try {
    if (!resolvedClientId) {
      const coachId = await db.findOrCreateCoach(intake?.coach || 'Cai Delumpa');
      resolvedClientId = await db.createClient(intake || {}, coachId);
    }
    assessmentId = await db.createAssessment(resolvedClientId, { systemPrompt, userMessage, intake });
    if (assessmentId) console.log(`[submit] assessment #${assessmentId} created for client #${resolvedClientId}`);
  } catch (e) {
    console.error('[submit] DB record creation error:', e.message);
  }

  // Fire and forget background job
  (async () => {
    try {
      await runBackgroundJob(systemPrompt, userMessage, intake || {}, scores || {}, assessmentId, resolvedClientId);
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

// =================== INVITE EMAIL ===================

async function sendInviteEmail(client, token, coachName) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[invite] SENDGRID_API_KEY not set — invite email skipped');
    return;
  }
  const appUrl   = process.env.RAILWAY_PUBLIC_URL || 'https://hive-typing-engine-production.up.railway.app';
  const link     = `${appUrl}/assessment/${token}`;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const coachEmail = (coachName === 'Monique Breault')
    ? (process.env.COACH_EMAIL_MONIQUE || process.env.COACH_EMAIL)
    : (process.env.COACH_EMAIL_CAI    || process.env.COACH_EMAIL);

  const msg = {
    to:      client.email,
    from:    { name: 'InsightOut by Hive', email: coachEmail },
    subject: `Your Hive Enneagram Assessment`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1A2B33; line-height: 1.7;">
        <div style="border-top: 4px solid #00b1d7; padding-top: 28px; margin-bottom: 24px;">
          <p style="font-size: 11px; color: #7A96A6; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6px;">Hive Enneagram Type Tool</p>
          <h1 style="font-size: 22px; color: #00b1d7; margin: 0; font-weight: 700;">Your Assessment is Ready</h1>
        </div>

        <p style="font-size: 15px;">Hi ${esc(client.first_name)},</p>

        <p>I've set up your Hive Enneagram assessment. It takes about 30–45 minutes to complete, and you can do it at any time before our session.</p>

        <p>The assessment walks you through a series of questions designed to surface your instinctive patterns and help us arrive at a working hypothesis for your Enneagram type. There are no right or wrong answers — just respond as honestly as you can.</p>

        <p style="margin: 32px 0;">
          <a href="${link}" style="display:inline-block;background:#00b1d7;color:#fff;padding:14px 28px;border-radius:4px;font-weight:700;text-decoration:none;font-size:15px;">Begin My Assessment →</a>
        </p>

        <p style="font-size: 13px; color: #4A6070;">If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="${link}" style="color:#00b1d7;">${link}</a>
        </p>

        <p style="font-size: 13px; color: #4A6070;">Looking forward to our conversation.</p>
        <p style="font-size: 13px; color: #4A6070; margin: 0;">Warm regards,<br><strong style="color: #1A2B33;">${esc(coachName)}</strong><br>Hive Leadership</p>

        <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #E0E8EC; font-size: 11px; color: #7A96A6;">
          This link is personal to you and expires in 30 days. © 2026 Hive, Inc. All rights reserved.
        </div>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`[invite] invite sent to ${client.email}`);
  } catch (e) {
    console.error('[invite] failed to send invite:', e.message, e.response && e.response.body);
  }
}

// =================== ADMIN HELPERS ===================

// Build a plain-English summary of what changed between two DB records
function buildChangeSummary(recordType, before, after) {
  const fields = recordType === 'coach'
    ? [['name', 'name'], ['email', 'email']]
    : [['first_name', 'first name'], ['last_name', 'last name'], ['email', 'email'], ['organization', 'organization']];

  const changes = [];
  for (const [key, label] of fields) {
    const oldVal = (before[key] || '').toString().trim();
    const newVal = (after[key]  || '').toString().trim();
    if (oldVal !== newVal) {
      changes.push(`${label} changed from '${oldVal}' to '${newVal}'`);
    }
  }
  return changes.length > 0 ? changes.join('; ') : 'No fields were modified.';
}

// Shared modal overlay HTML + JS injected into every admin page
function sharedModalHTML(isAdmin) {
  return `
<div id="hive-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(26,43,51,0.55);z-index:9000;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto;">
  <div style="background:#fff;width:100%;max-width:580px;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.2);font-family:Georgia,serif;">
    <div id="hive-modal-content"></div>
  </div>
</div>
<div id="hive-toast" style="display:none;position:fixed;bottom:24px;right:24px;background:#1a7a4a;color:#fff;padding:12px 20px;border-radius:6px;font-size:13px;font-family:Georgia,serif;z-index:9500;box-shadow:0 2px 8px rgba(0,0,0,.18);"></div>
<script>
(function(){
var _IS_ADMIN = ${isAdmin ? 'true' : 'false'};
var _hiveRec  = null; // current profile data
var _hiveType = null; // 'client' | 'coach'
var _reassignState = null; // { clientId, currentCoachId, currentCoachName, fromAccordion, accordionCoachId }

function _esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}

function _fmtFull(ts){
  if(!ts)return null;
  var d=new Date(ts);
  return d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})+' at '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
}

function _overlay(){return document.getElementById('hive-modal-overlay');}
function _content(){return document.getElementById('hive-modal-content');}

function _showModal(){
  var o=_overlay(); o.style.display='flex';
}
function _hideModal(){
  _overlay().style.display='none';
  _hiveRec=null; _hiveType=null;
}
window._hideModal=_hideModal;
function _showLoading(){
  _content().innerHTML='<div style="padding:48px;text-align:center;color:#7A96A6;font-size:14px;">Loading…</div>';
  _showModal();
}
function _showToast(msg){
  var t=document.getElementById('hive-toast');
  t.textContent=msg; t.style.display='block'; t.style.opacity='1';
  setTimeout(function(){
    t.style.transition='opacity 0.4s'; t.style.opacity='0';
    setTimeout(function(){t.style.display='none';t.style.transition='';t.style.opacity='1';},420);
  },2400);
}

function _profileRow(label,val){
  return '<tr style="border-bottom:1px solid #EFE8E0;"><td style="padding:8px 0;color:#7A96A6;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;width:34%;vertical-align:top;">'+_esc(label)+'</td><td style="padding:8px 0;font-size:13px;">'+_esc(val!=null&&val!==''?String(val):'—')+'</td></tr>';
}
function _profileRowRaw(label,val){
  return '<tr style="border-bottom:1px solid #EFE8E0;"><td style="padding:8px 0;color:#7A96A6;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;width:34%;vertical-align:top;">'+_esc(label)+'</td><td style="padding:8px 0;font-size:13px;">'+(val||'—')+'</td></tr>';
}

function _renderHistory(hist){
  if(!hist||hist.length===0) return '<p style="font-size:12px;color:#7A96A6;margin:6px 0 0;">No edit history yet.</p>';
  return hist.map(function(h){
    return '<div style="padding:8px 0;border-bottom:1px solid #f0ece8;">'+
      '<div style="font-size:11px;color:#7A96A6;">'+_esc(_fmtFull(h.edited_at))+' — <strong style="color:#4A6070;">'+_esc(h.edited_by_name)+'</strong></div>'+
      '<div style="font-size:12px;margin-top:3px;color:#1A2B33;">'+_esc(h.change_summary)+'</div>'+
      (h.editor_note?'<div style="font-size:11px;color:#7A96A6;font-style:italic;margin-top:2px;">“'+_esc(h.editor_note)+'”</div>':'')+
      '</div>';
  }).join('');
}

function _modalHeader(labelText, titleText, color){
  return '<div style="border-top:4px solid '+color+';padding:24px 28px 0;">'+
    '<p style="font-size:11px;color:#7A96A6;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 4px;">'+_esc(labelText)+'</p>'+
    '<h2 style="font-size:20px;color:#1A2B33;margin:0 0 20px;font-weight:700;">'+_esc(titleText)+'</h2>';
}

function _editInput(id, label, value, required, type){
  type=type||'text';
  return '<div style="margin-bottom:14px;">'+
    '<label for="'+id+'" style="display:block;font-size:11px;color:#7A96A6;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;margin-bottom:5px;">'+_esc(label)+(required?' <span style="color:#c0392b;">*</span>':'')+'</label>'+
    '<input type="'+type+'" id="'+id+'" value="'+_esc(value||'')+'" style="width:100%;padding:9px 11px;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;color:#1A2B33;outline:none;box-sizing:border-box;">'+
    '</div>';
}

// ── Client profile ──────────────────────────────────────────────────────────

window.openClientProfile = async function(clientId){
  _hiveType='client'; _showLoading();
  try{
    var r=await fetch('/admin/clients/'+clientId+'/profile',{headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    var data=await r.json();
    _hiveRec=data; _renderClientView(data);
  }catch(e){ _hideModal(); alert('Failed to load profile: '+e.message); }
};

function _renderClientView(data){
  var c=data.client; var a=data.assessment||{}; var hist=data.history||[];
  var TN={1:'The Improver',2:'The Giver',3:'The Performer',4:'The Idealist',5:'The Observer',6:'The Questioner',7:'The Enthusiast',8:'The Protector',9:'The Peacemaker'};
  var typeLabel=a.confirmed_type?('Type '+a.confirmed_type+' — '+(TN[a.confirmed_type]||'')):null;
  var conf=a.confidence_level?a.confidence_level.replace(/_/g,'-'):null;
  var SM={complete:'Complete',in_progress:'In Progress',not_started:'Not Started',processing:'Processing',failed:'Failed'};
  var statusStr=SM[a.status||c.status]||(a.status||c.status)||null;
  var lu=c.updated_at?('<p style="font-size:12px;color:#7A96A6;margin:0 0 16px;">Last Updated: '+_esc(_fmtFull(c.updated_at))+' by <strong>'+_esc(c.updated_by||'')+'</strong></p>'):'';

  var h=_modalHeader('Client Profile',(c.first_name||'')+' '+(c.last_name||''),'#00b1d7');
  h+='<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">';
  h+=_profileRow('First Name',c.first_name);
  h+=_profileRow('Last Name',c.last_name);
  h+=_profileRow('Email',c.email);
  h+=_profileRow('Organization',c.organization||'Not provided');
  h+=_profileRow('Coach',c.coach_name);
  h+=_profileRow('Type',typeLabel);
  h+=_profileRow('Instinct',a.confirmed_instinct);
  h+=_profileRow('Confidence',conf);
  h+=_profileRow('Status',statusStr);
  h+='</table>';
  h+=lu;
  h+='<div style="border-top:1px solid #EFE8E0;padding-top:12px;margin-bottom:20px;">';
  h+='<p style="font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin:0 0 8px;">Edit History</p>';
  h+=_renderHistory(hist);
  h+='</div>';
  h+='<div style="display:flex;gap:10px;justify-content:flex-end;padding:0 0 24px;">';
  h+='<button onclick="window._editClientMode()" style="background:#00b1d7;color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer;">Edit Profile</button>';
  h+='<button onclick="_hideModal()" style="background:#fff;color:#7A96A6;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;padding:9px 18px;cursor:pointer;">Close</button>';
  h+='</div></div>';
  _content().innerHTML=h; _showModal();
}

window._editClientMode = function(){
  var data=_hiveRec; if(!data)return;
  var c=data.client;
  var TN={1:'The Improver',2:'The Giver',3:'The Performer',4:'The Idealist',5:'The Observer',6:'The Questioner',7:'The Enthusiast',8:'The Protector',9:'The Peacemaker'};
  var a=data.assessment||{};
  var typeLabel=a.confirmed_type?('Type '+a.confirmed_type+' — '+(TN[a.confirmed_type]||'')):'—';
  var conf=a.confidence_level?a.confidence_level.replace(/_/g,'-'):'—';
  var SM={complete:'Complete',in_progress:'In Progress',not_started:'Not Started',processing:'Processing',failed:'Failed'};
  var statusStr=SM[a.status||c.status]||(a.status||c.status)||'—';

  var h=_modalHeader('Edit Client',(c.first_name||'')+' '+(c.last_name||''),'#00b1d7');
  h+='<div id="modal-err" style="display:none;background:#fdecea;color:#c0392b;border-radius:4px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>';
  h+=_editInput('m_fn','First Name',c.first_name,true);
  h+=_editInput('m_ln','Last Name',c.last_name,true);
  h+=_editInput('m_em','Email',c.email,true,'email');
  h+=_editInput('m_org','Organization',c.organization,false);
  h+='<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">';
  h+=_profileRow('Coach',c.coach_name);
  h+=_profileRow('Type',typeLabel);
  h+=_profileRow('Instinct',a.confirmed_instinct||'—');
  h+=_profileRow('Confidence',conf);
  h+=_profileRow('Status',statusStr);
  h+='</table>';
  h+='<div style="margin-bottom:16px;">';
  h+='<label for="m_note" style="display:block;font-size:11px;color:#7A96A6;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;margin-bottom:5px;">Notes <span style="font-weight:400;text-transform:none;">(optional)</span></label>';
  h+='<textarea id="m_note" placeholder="Add a note about this change (optional)" style="width:100%;padding:9px 11px;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;color:#1A2B33;outline:none;box-sizing:border-box;height:72px;resize:vertical;"></textarea>';
  h+='</div>';
  h+='<div style="display:flex;gap:10px;justify-content:flex-end;padding:0 0 24px;">';
  h+='<button id="modal-save-btn" onclick="window._saveClientProfile()" style="background:#00b1d7;color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer;">Save Changes</button>';
  h+='<button onclick="window._hideModal()" style="background:#fff;color:#7A96A6;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;padding:9px 18px;cursor:pointer;">Cancel</button>';
  h+='</div></div>';
  _content().innerHTML=h;
};

window._saveClientProfile = async function(){
  var errDiv=document.getElementById('modal-err');
  var saveBtn=document.getElementById('modal-save-btn');
  var fn=(document.getElementById('m_fn').value||'').trim();
  var ln=(document.getElementById('m_ln').value||'').trim();
  var em=(document.getElementById('m_em').value||'').trim();
  var org=(document.getElementById('m_org').value||'').trim();
  var note=(document.getElementById('m_note').value||'').trim();
  errDiv.style.display='none';
  if(!fn||!ln){errDiv.textContent='First name and last name are required.';errDiv.style.display='';return;}
  if(!em||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(em)){errDiv.textContent='A valid email address is required.';errDiv.style.display='';return;}
  saveBtn.disabled=true; saveBtn.textContent='Saving…';
  try{
    var clientId=_hiveRec.client.id;
    var resp=await fetch('/admin/clients/'+clientId+'/update',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({first_name:fn,last_name:ln,email:em,organization:org||null,note:note||null})});
    var data=await resp.json();
    if(!resp.ok||!data.success){errDiv.textContent=data.error||'Update failed.';errDiv.style.display='';saveBtn.disabled=false;saveBtn.textContent='Save Changes';return;}
    // Update name links in page
    var newName=fn+' '+ln;
    document.querySelectorAll('[data-entity="client-'+clientId+'"]').forEach(function(el){el.textContent=newName;});
    // Reload record for history display
    _hiveRec.client=Object.assign({},_hiveRec.client,{first_name:fn,last_name:ln,email:em,organization:org||null});
    if(data.historyEntry) (_hiveRec.history=_hiveRec.history||[]).unshift(data.historyEntry);
    _hideModal(); _showToast('Profile updated.');
  }catch(e){errDiv.textContent='Request failed: '+e.message;errDiv.style.display='';saveBtn.disabled=false;saveBtn.textContent='Save Changes';}
};

// ── Coach profile ───────────────────────────────────────────────────────────

window.openCoachProfile = async function(coachId){
  _hiveType='coach'; _showLoading();
  try{
    var r=await fetch('/admin/coaches/'+coachId+'/profile',{headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    var data=await r.json();
    _hiveRec=data; _renderCoachView(data);
  }catch(e){ _hideModal(); alert('Failed to load profile: '+e.message); }
};

function _renderCoachView(data){
  var c=data.coach; var hist=data.history||[];
  var lu=c.updated_at?('<p style="font-size:12px;color:#7A96A6;margin:0 0 16px;">Last Updated: '+_esc(_fmtFull(c.updated_at))+' by <strong>'+_esc(c.updated_by||'')+'</strong></p>'):'';
  var adminBadge=c.is_admin?'<span style="color:#1a7a4a;font-weight:700;">Yes</span>':'No';
  var activeBadge=c.is_active!==false?'<span style="color:#1a7a4a;">Active</span>':'<span style="color:#c0392b;">Inactive</span>';

  var h=_modalHeader('Coach Profile',c.name,'#f58527');
  h+='<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">';
  h+=_profileRow('Name',c.name);
  h+=_profileRow('Email',c.email);
  h+=_profileRowRaw('Admin',adminBadge);
  h+=_profileRowRaw('Status',activeBadge);
  h+='</table>';
  h+=lu;
  h+='<div style="border-top:1px solid #EFE8E0;padding-top:12px;margin-bottom:20px;">';
  h+='<p style="font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin:0 0 8px;">Edit History</p>';
  h+=_renderHistory(hist);
  h+='</div>';
  h+='<div style="display:flex;gap:10px;justify-content:flex-end;padding:0 0 24px;">';
  if(_IS_ADMIN) h+='<button onclick="window._editCoachMode()" style="background:#f58527;color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer;">Edit Profile</button>';
  h+='<button onclick="_hideModal()" style="background:#fff;color:#7A96A6;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;padding:9px 18px;cursor:pointer;">Close</button>';
  h+='</div></div>';
  _content().innerHTML=h; _showModal();
}

window._editCoachMode = function(){
  var data=_hiveRec; if(!data)return;
  var c=data.coach;
  var adminBadge=c.is_admin?'<span style="color:#1a7a4a;font-weight:700;">Yes</span>':'No';
  var activeBadge=c.is_active!==false?'<span style="color:#1a7a4a;">Active</span>':'<span style="color:#c0392b;">Inactive</span>';

  var h=_modalHeader('Edit Coach',c.name,'#f58527');
  h+='<div id="modal-err" style="display:none;background:#fdecea;color:#c0392b;border-radius:4px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>';
  h+=_editInput('m_cname','Full Name',c.name,true);
  h+=_editInput('m_cemail','Email',c.email,true,'email');
  h+='<table style="width:100%;border-collapse:collapse;margin-bottom:14px;">';
  h+=_profileRowRaw('Admin',adminBadge);
  h+=_profileRowRaw('Status',activeBadge);
  h+='</table>';
  h+='<div style="margin-bottom:16px;">';
  h+='<label for="m_note" style="display:block;font-size:11px;color:#7A96A6;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;margin-bottom:5px;">Notes <span style="font-weight:400;text-transform:none;">(optional)</span></label>';
  h+='<textarea id="m_note" placeholder="Add a note about this change (optional)" style="width:100%;padding:9px 11px;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;color:#1A2B33;outline:none;box-sizing:border-box;height:72px;resize:vertical;"></textarea>';
  h+='</div>';
  h+='<div style="display:flex;gap:10px;justify-content:flex-end;padding:0 0 24px;">';
  h+='<button id="modal-save-btn" onclick="window._saveCoachProfile()" style="background:#f58527;color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer;">Save Changes</button>';
  h+='<button onclick="window._hideModal()" style="background:#fff;color:#7A96A6;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;padding:9px 18px;cursor:pointer;">Cancel</button>';
  h+='</div></div>';
  _content().innerHTML=h;
};

window._saveCoachProfile = async function(){
  var errDiv=document.getElementById('modal-err');
  var saveBtn=document.getElementById('modal-save-btn');
  var name=(document.getElementById('m_cname').value||'').trim();
  var email=(document.getElementById('m_cemail').value||'').trim();
  var note=(document.getElementById('m_note').value||'').trim();
  errDiv.style.display='none';
  if(!name){errDiv.textContent='Full name is required.';errDiv.style.display='';return;}
  if(!email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){errDiv.textContent='A valid email address is required.';errDiv.style.display='';return;}
  saveBtn.disabled=true; saveBtn.textContent='Saving…';
  try{
    var coachId=_hiveRec.coach.id;
    var resp=await fetch('/admin/coaches/'+coachId+'/update',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({name:name,email:email,note:note||null})});
    var data=await resp.json();
    if(!resp.ok||!data.success){errDiv.textContent=data.error||'Update failed.';errDiv.style.display='';saveBtn.disabled=false;saveBtn.textContent='Save Changes';return;}
    // Update coach name links in page
    document.querySelectorAll('[data-entity="coach-'+coachId+'"]').forEach(function(el){el.textContent=name;});
    _hiveRec.coach=Object.assign({},_hiveRec.coach,{name:name,email:email});
    if(data.historyEntry) (_hiveRec.history=_hiveRec.history||[]).unshift(data.historyEntry);
    _hideModal(); _showToast('Profile updated.');
  }catch(e){errDiv.textContent='Request failed: '+e.message;errDiv.style.display='';saveBtn.disabled=false;saveBtn.textContent='Save Changes';}
};

// ── Coach reassignment modal ────────────────────────────────────────────────

window.openReassignModal = async function(clientId, clientName, currentCoachId, currentCoachName, fromAccordion, accordionCoachId) {
  _reassignState = {clientId:clientId, currentCoachId:currentCoachId, currentCoachName:currentCoachName, fromAccordion:fromAccordion, accordionCoachId:accordionCoachId};
  _showLoading();
  try {
    var r = await fetch('/admin/coaches/active', {headers:{Accept:'application/json'}});
    if (!r.ok) throw new Error('HTTP '+r.status);
    var coaches = await r.json();
    var h = _modalHeader('Reassign Client','Reassign Client','#00b1d7');
    h += '<div style="padding:0 28px;">';
    h += '<p style="font-size:13px;color:#4A6070;margin:0 0 20px;">Moving: <strong>'+_esc(clientName)+'</strong> — currently assigned to <strong>'+_esc(currentCoachName)+'</strong></p>';
    h += '<div id="modal-err" style="display:none;background:#fdecea;color:#c0392b;border-radius:4px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>';
    h += '<div style="margin-bottom:20px;">';
    h += '<label for="reassign-coach" style="display:block;font-size:11px;color:#7A96A6;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;margin-bottom:5px;">Assign to… <span style="color:#c0392b;">*</span></label>';
    h += '<select id="reassign-coach" style="width:100%;padding:9px 11px;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;color:#1A2B33;outline:none;box-sizing:border-box;">';
    coaches.forEach(function(c){
      h += '<option value="'+c.id+'"'+(c.id===currentCoachId?' selected':'')+'>'+_esc(c.name)+'</option>';
    });
    h += '</select></div>';
    h += '<div style="margin-bottom:20px;">';
    h += '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#4A6070;cursor:pointer;">';
    h += '<input type="checkbox" id="notify-coach-cb" name="notify_coach" value="true" checked style="width:15px;height:15px;cursor:pointer;">';
    h += 'Notify the receiving coach by email';
    h += '</label>';
    h += '</div>';
    h += '<div style="display:flex;gap:10px;justify-content:flex-end;padding:0 0 24px;">';
    h += '<button id="modal-reassign-btn" onclick="window._confirmReassign()" style="background:#00b1d7;color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer;">Confirm Reassignment</button>';
    h += '<button onclick="_hideModal()" style="background:#fff;color:#7A96A6;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;padding:9px 18px;cursor:pointer;">Cancel</button>';
    h += '</div></div>';
    _content().innerHTML = h;
  } catch(e) { _hideModal(); alert('Failed to load coaches: '+e.message); }
};

window._confirmReassign = async function() {
  var st = _reassignState;
  if (!st) return;
  var sel = document.getElementById('reassign-coach');
  var newCoachId = parseInt(sel.value, 10);
  var newCoachName = sel.options[sel.selectedIndex].text;
  var errDiv = document.getElementById('modal-err');
  var btn = document.getElementById('modal-reassign-btn');
  errDiv.style.display = 'none';
  if (newCoachId === st.currentCoachId) {
    errDiv.textContent = 'This client is already assigned to '+st.currentCoachName+'.';
    errDiv.style.display = '';
    return;
  }
  var notifyCb = document.getElementById('notify-coach-cb');
  var notifyCoach = notifyCb ? notifyCb.checked : true;
  btn.disabled = true; btn.textContent = 'Reassigning…';
  try {
    var r = await fetch('/admin/clients/'+st.clientId+'/reassign', {
      method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({new_coach_id:newCoachId, notify_coach:notifyCoach})
    });
    var data = await r.json();
    if (!r.ok || !data.success) {
      errDiv.textContent = data.error || 'Reassignment failed.';
      errDiv.style.display = ''; btn.disabled = false; btn.textContent = 'Confirm Reassignment';
      return;
    }
    _hideModal();
    _reassignState = null;
    if (st.fromAccordion) {
      var row = document.getElementById('acc-row-'+st.clientId);
      if (row) row.remove();
      if (st.accordionCoachId !== null) {
        if (typeof _accordionCache !== 'undefined') delete _accordionCache[st.accordionCoachId];
        var link = document.getElementById('client-count-'+st.accordionCoachId);
        if (link) {
          var newCount = parseInt(link.dataset.count, 10) - 1;
          link.dataset.count = newCount;
          if (newCount === 0) {
            link.replaceWith(document.createTextNode('0'));
            var acc = document.getElementById('accordion-'+st.accordionCoachId);
            if (acc) acc.style.display = 'none';
            if (typeof _openCoachId !== 'undefined') _openCoachId = null;
          } else {
            link.textContent = newCount+' clients ▲';
          }
        }
      }
    } else {
      var cell = document.getElementById('coach-cell-'+st.clientId);
      if (cell) cell.textContent = data.new_coach_name;
    }
    _showToast('Client reassigned to '+data.new_coach_name+'.');
  } catch(e) {
    errDiv.textContent = 'Request failed: '+e.message;
    errDiv.style.display = ''; btn.disabled = false; btn.textContent = 'Confirm Reassignment';
  }
};

// Close on overlay click or Escape
document.addEventListener('DOMContentLoaded',function(){
  document.getElementById('hive-modal-overlay').addEventListener('click',function(e){if(e.target===this)_hideModal();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')_hideModal();});
});
})();
</script>`;
}

// =================== ADMIN ROUTES ===================

// ── Login / Logout ────────────────────────────────────────────────────────────

function renderLoginPage(errorMsg) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hive Admin — Sign In</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: Georgia, serif; background: #f7f5f2; color: #1A2B33; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.1); padding: 48px 40px; width: 100%; max-width: 400px; }
  .logo-bar { border-top: 4px solid #00b1d7; padding-top: 20px; margin-bottom: 32px; }
  .logo-bar p { font-size: 11px; color: #7A96A6; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6px; }
  .logo-bar h1 { font-size: 20px; color: #00b1d7; margin: 0; font-weight: 700; }
  label { display: block; font-size: 11px; color: #7A96A6; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
  input[type=email], input[type=password] { width: 100%; padding: 10px 12px; border: 1px solid #D0DCE4; border-radius: 4px; font-family: Georgia, serif; font-size: 14px; color: #1A2B33; outline: none; margin-bottom: 20px; }
  input:focus { border-color: #00b1d7; }
  button[type=submit] { width: 100%; padding: 12px; background: #00b1d7; color: #fff; border: none; border-radius: 4px; font-family: Georgia, serif; font-size: 15px; font-weight: 700; cursor: pointer; }
  button[type=submit]:hover { background: #009bbf; }
  .error { background: #fdecea; color: #c0392b; border-radius: 4px; padding: 10px 14px; font-size: 13px; margin-bottom: 20px; }
</style>
</head>
<body>
<div class="card">
  <div class="logo-bar">
    <p>Hive Enneagram Type Tool</p>
    <h1>Admin Sign In</h1>
  </div>
  ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
  <form method="POST" action="/admin/login">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required autocomplete="username">
    <label for="password">Password</label>
    <input type="password" id="password" name="password" required autocomplete="current-password">
    <button type="submit">Sign In</button>
  </form>
</div>
</body>
</html>`;
}

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.coach_id) return res.redirect('/admin');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderLoginPage(null));
});

app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const coach = await db.getCoachByEmail((email || '').toLowerCase().trim());
  if (!coach || !coach.password_hash) {
    return res.send(renderLoginPage('Invalid email or password.'));
  }

  const match = await bcrypt.compare(password || '', coach.password_hash);
  if (!match) {
    return res.send(renderLoginPage('Invalid email or password.'));
  }

  if (coach.is_active === false) {
    return res.send(renderLoginPage('This account has been deactivated. Please contact an administrator.'));
  }

  req.session.regenerate((err) => {
    if (err) {
      console.error('[admin/login] session regenerate error:', err.message);
      return res.send(renderLoginPage('Sign-in failed — please try again.'));
    }
    req.session.coach_id       = coach.id;
    req.session.coach_name     = coach.name;
    req.session.coach_is_admin = coach.is_admin === true;
    res.redirect('/admin');
  });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ── Change Password ───────────────────────────────────────────────────────────

function renderChangePasswordPage(errorMsg) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hive Admin — Change Password</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: Georgia, serif; background: #f7f5f2; color: #1A2B33; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.1); padding: 48px 40px; width: 100%; max-width: 400px; }
  .logo-bar { border-top: 4px solid #00b1d7; padding-top: 20px; margin-bottom: 32px; }
  .logo-bar p { font-size: 11px; color: #7A96A6; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6px; }
  .logo-bar h1 { font-size: 20px; color: #00b1d7; margin: 0; font-weight: 700; }
  label { display: block; font-size: 11px; color: #7A96A6; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
  input[type=password] { width: 100%; padding: 10px 12px; border: 1px solid #D0DCE4; border-radius: 4px; font-family: Georgia, serif; font-size: 14px; color: #1A2B33; outline: none; margin-bottom: 20px; }
  input:focus { border-color: #00b1d7; }
  button[type=submit] { width: 100%; padding: 12px; background: #00b1d7; color: #fff; border: none; border-radius: 4px; font-family: Georgia, serif; font-size: 15px; font-weight: 700; cursor: pointer; }
  button[type=submit]:hover { background: #009bbf; }
  .error { background: #fdecea; color: #c0392b; border-radius: 4px; padding: 10px 14px; font-size: 13px; margin-bottom: 20px; }
  .back { display: block; text-align: center; margin-top: 20px; font-size: 13px; color: #7A96A6; text-decoration: none; }
  .back:hover { color: #00b1d7; }
</style>
</head>
<body>
<div class="card">
  <div class="logo-bar">
    <p>Hive Enneagram Type Tool</p>
    <h1>Change Password</h1>
  </div>
  ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
  <form method="POST" action="/admin/password">
    <label for="current_password">Current Password</label>
    <input type="password" id="current_password" name="current_password" required autocomplete="current-password">
    <label for="new_password">New Password</label>
    <input type="password" id="new_password" name="new_password" required autocomplete="new-password">
    <label for="confirm_password">Confirm New Password</label>
    <input type="password" id="confirm_password" name="confirm_password" required autocomplete="new-password">
    <button type="submit">Update Password</button>
  </form>
  <a href="/admin" class="back">← Back to dashboard</a>
</div>
</body>
</html>`;
}

app.get('/admin/password', requireAdminSession, (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderChangePasswordPage(null));
});

app.post('/admin/password', requireAdminSession, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const { current_password, new_password, confirm_password } = req.body;

  const coach = await db.getCoachById(req.session.coach_id);
  if (!coach || !coach.password_hash) {
    return res.send(renderChangePasswordPage('Could not verify current password.'));
  }

  const currentMatch = await bcrypt.compare(current_password || '', coach.password_hash);
  if (!currentMatch) {
    return res.send(renderChangePasswordPage('Current password is incorrect.'));
  }

  if ((new_password || '') !== (confirm_password || '')) {
    return res.send(renderChangePasswordPage('New passwords do not match.'));
  }

  if ((new_password || '').length < 8) {
    return res.send(renderChangePasswordPage('New password must be at least 8 characters.'));
  }

  const newHash = await bcrypt.hash(new_password, 12);
  await db.updateCoachPassword(req.session.coach_id, newHash);
  console.log(`[admin/password] password updated for coach #${req.session.coach_id}`);

  res.redirect('/admin?flash=password_updated');
});

// ── New Client Intake ────────────────────────────────────────────────────────

function renderNewClientPage(errorMsg, formValues) {
  const v = formValues || {};
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hive Admin — New Client</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: Georgia, serif; background: #f7f5f2; color: #1A2B33; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.1); padding: 48px 40px; width: 100%; max-width: 480px; }
  .logo-bar { border-top: 4px solid #00b1d7; padding-top: 20px; margin-bottom: 32px; }
  .logo-bar p { font-size: 11px; color: #7A96A6; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6px; }
  .logo-bar h1 { font-size: 20px; color: #00b1d7; margin: 0; font-weight: 700; }
  label { display: block; font-size: 11px; color: #7A96A6; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
  input[type=text], input[type=email] { width: 100%; padding: 10px 12px; border: 1px solid #D0DCE4; border-radius: 4px; font-family: Georgia, serif; font-size: 14px; color: #1A2B33; outline: none; margin-bottom: 20px; }
  input:focus { border-color: #00b1d7; }
  button[type=submit] { width: 100%; padding: 12px; background: #00b1d7; color: #fff; border: none; border-radius: 4px; font-family: Georgia, serif; font-size: 15px; font-weight: 700; cursor: pointer; }
  button[type=submit]:hover { background: #009bbf; }
  .error { background: #fdecea; color: #c0392b; border-radius: 4px; padding: 10px 14px; font-size: 13px; margin-bottom: 20px; }
  .back { display: block; text-align: center; margin-top: 20px; font-size: 13px; color: #7A96A6; text-decoration: none; }
  .back:hover { color: #00b1d7; }
</style>
</head>
<body>
<div class="card">
  <div class="logo-bar">
    <p>Hive Enneagram Type Tool</p>
    <h1>New Client</h1>
  </div>
  ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
  <form method="POST" action="/admin/clients/new">
    <label for="first_name">First Name</label>
    <input type="text" id="first_name" name="first_name" required value="${esc(v.first_name || '')}">
    <label for="last_name">Last Name</label>
    <input type="text" id="last_name" name="last_name" required value="${esc(v.last_name || '')}">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required value="${esc(v.email || '')}">
    <label for="organization">Organization <span style="font-weight:400;text-transform:none;">(optional)</span></label>
    <input type="text" id="organization" name="organization" value="${esc(v.organization || '')}">
    <button type="submit">Create Client &amp; Send Invite</button>
  </form>
  <a href="/admin" class="back">← Back to dashboard</a>
</div>
</body>
</html>`;
}

app.get('/admin/clients/new', requireAdminSession, (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderNewClientPage(null, null));
});

app.post('/admin/clients/new', requireAdminSession, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const { first_name, last_name, email, organization } = req.body;

  if (!first_name || !last_name || !email) {
    return res.send(renderNewClientPage('First name, last name, and email are required.', req.body));
  }

  try {
    const coachId = req.session.coach_id;
    const clientId = await db.createClient(
      { firstName: first_name.trim(), lastName: last_name.trim(), email: email.trim().toLowerCase(), organization: organization ? organization.trim() : null },
      coachId
    );
    if (!clientId) {
      return res.send(renderNewClientPage('Failed to create client — please try again.', req.body));
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.createClientToken(clientId, token, expiresAt);

    const clientRow = { first_name: first_name.trim(), last_name: last_name.trim(), email: email.trim().toLowerCase() };
    await sendInviteEmail(clientRow, token, req.session.coach_name);

    console.log(`[admin/clients/new] created client #${clientId} and sent invite`);
    res.redirect('/admin?flash=invite_sent');
  } catch (e) {
    console.error('[admin/clients/new] error:', e.message);
    res.send(renderNewClientPage('An error occurred — please try again.', req.body));
  }
});

// ── Resend Invite ─────────────────────────────────────────────────────────────

app.post('/admin/clients/resend/:client_id', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).send('Invalid client ID');

  const ownerCoachId = await db.getClientCoachId(clientId);
  if (ownerCoachId !== req.session.coach_id) return res.status(403).send('Forbidden');

  try {
    const client = await db.getClientById(clientId);
    if (!client) return res.status(404).send('Client not found');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.resendInviteTransaction(clientId, token, expiresAt);
    await sendInviteEmail({ first_name: client.first_name, last_name: client.last_name, email: client.email }, token, req.session.coach_name);

    console.log(`[admin/clients/resend] resent invite for client #${clientId}`);
    res.redirect('/admin?flash=invite_resent');
  } catch (e) {
    console.error('[admin/clients/resend] error:', e.message);
    res.redirect('/admin');
  }
});

// ── Assessment Token Entry ─────────────────────────────────────────────────────

function renderAssessmentGate(title, message, actionHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hive Enneagram Assessment</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: Georgia, serif; background: #f7f5f2; color: #1A2B33; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.1); padding: 48px 40px; width: 100%; max-width: 520px; text-align: center; }
  .logo-bar { border-top: 4px solid #00b1d7; padding-top: 20px; margin-bottom: 32px; }
  .logo-bar p { font-size: 11px; color: #7A96A6; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6px; }
  .logo-bar h1 { font-size: 22px; color: #00b1d7; margin: 0; font-weight: 700; }
  .message { font-size: 15px; color: #4A6070; line-height: 1.7; margin-bottom: 32px; }
  .btn { display: inline-block; background: #00b1d7; color: #fff; padding: 14px 32px; border-radius: 4px; font-weight: 700; font-family: Georgia, serif; font-size: 15px; text-decoration: none; border: none; cursor: pointer; }
  .btn:hover { background: #009bbf; }
</style>
</head>
<body>
<div class="card">
  <div class="logo-bar">
    <p>Hive Enneagram Type Tool</p>
    <h1>${esc(title)}</h1>
  </div>
  <p class="message">${message}</p>
  ${actionHtml || ''}
</div>
</body>
</html>`;
}

app.get('/assessment/:token', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const tokenRow = await db.getTokenWithClient(req.params.token);

  if (!tokenRow) {
    return res.send(renderAssessmentGate(
      'Link Not Found',
      'This assessment link is not valid. Please contact your coach to request a new invite.',
      ''
    ));
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return res.send(renderAssessmentGate(
      'Link Expired',
      'This assessment link has expired. Please contact your coach to request a new invite.',
      ''
    ));
  }

  if (tokenRow.client_status === 'complete') {
    return res.send(renderAssessmentGate(
      'Assessment Complete',
      `You've already completed your Hive Enneagram assessment, ${esc(tokenRow.first_name)}. Your coach will be in touch to discuss your results.`,
      ''
    ));
  }

  if (tokenRow.client_status === 'in_progress') {
    return res.send(renderAssessmentGate(
      'Assessment In Progress',
      `It looks like you've already started your assessment, ${esc(tokenRow.first_name)}. If you need to restart, please contact your coach.`,
      ''
    ));
  }

  // not_started — show welcome screen with Begin button
  return res.send(renderAssessmentGate(
    `Welcome, ${esc(tokenRow.first_name)}`,
    `Your Hive Enneagram assessment is ready. It takes approximately 30–45 minutes to complete.<br><br>When you're ready, click the button below to begin.`,
    `<form method="POST" action="/assessment/${encodeURIComponent(req.params.token)}/begin">
      <button type="submit" class="btn">Begin My Assessment</button>
    </form>`
  ));
});

app.post('/assessment/:token/begin', async (req, res) => {
  const tokenRow = await db.getTokenWithClient(req.params.token);

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date() || tokenRow.client_status === 'complete') {
    return res.redirect(`/assessment/${encodeURIComponent(req.params.token)}`);
  }

  await db.updateClientStatus(tokenRow.client_id, 'in_progress');
  await db.updateTokenUsedAt(tokenRow.token_id);

  req.session.assessmentClientId = tokenRow.client_id;
  req.session.assessmentIntake = {
    firstName:    tokenRow.first_name,
    lastName:     tokenRow.last_name,
    email:        tokenRow.email,
    organization: tokenRow.organization || '',
    coach:        tokenRow.coach_name,
    client_id:    tokenRow.client_id,
  };

  req.session.save((err) => {
    if (err) console.error('[assessment/begin] session save error:', err.message);
    res.redirect('/');
  });
});

// ── Coach Management (super-admin only) ──────────────────────────────────────

function renderCoachesPage(coaches, errorMsg, flashMsg) {
  const TYPE_NAMES_LOCAL = {
    1: 'The Improver', 2: 'The Giver',   3: 'The Performer', 4: 'The Idealist',
    5: 'The Observer', 6: 'The Questioner', 7: 'The Enthusiast',
    8: 'The Protector', 9: 'The Peacemaker',
  };

  const coachRowPairs = coaches.map(co => {
    const name        = esc(co.name);
    const email       = esc(co.email);
    const isAdminFlag = co.is_admin ? '<span style="color:#1a7a4a;font-weight:700;">Yes</span>' : 'No';
    const isActive    = co.is_active !== false;
    const statusLabel = isActive
      ? '<span style="background:#e6f7ee;color:#1a7a4a;padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;">Active</span>'
      : '<span style="background:#fdecea;color:#c0392b;padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;">Inactive</span>';
    const clientCount = parseInt(co.client_count, 10) || 0;

    const toggleAction = isActive
      ? `<form method="POST" action="/admin/coaches/${co.id}/deactivate" style="display:inline;"
           onsubmit="return confirm('Deactivate ${name}? They will not be able to log in.');">
           <button type="submit" style="background:none;border:none;cursor:pointer;font-size:12px;color:#c0392b;text-decoration:underline;padding:0;">Deactivate</button>
         </form>`
      : `<form method="POST" action="/admin/coaches/${co.id}/reactivate" style="display:inline;">
           <button type="submit" style="background:none;border:none;cursor:pointer;font-size:12px;color:#1a7a4a;text-decoration:underline;padding:0;">Reactivate</button>
         </form>`;

    const reassignControl = (clientCount > 0 && isActive)
      ? `<form method="POST" action="/admin/coaches/${co.id}/reassign" style="display:inline-flex;align-items:center;gap:6px;margin-left:10px;">
           <select name="to_coach_id" required style="font-family:Georgia,serif;font-size:12px;padding:2px 4px;border:1px solid #D0DCE4;border-radius:3px;">
             <option value="">Move clients to…</option>
             ${coaches.filter(c => c.id !== co.id && c.is_active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
           </select>
           <button type="submit" style="background:#f58527;color:#fff;border:none;border-radius:3px;font-family:Georgia,serif;font-size:12px;font-weight:700;padding:3px 8px;cursor:pointer;">Reassign</button>
         </form>`
      : '';

    const clientsLink = clientCount > 0
      ? `<a href="#" id="client-count-${co.id}" class="client-count-link" data-coach-id="${co.id}" data-count="${clientCount}" onclick="toggleAccordion(${co.id},${clientCount});return false;" style="color:#00b1d7;text-decoration:none;font-weight:600;">${clientCount} clients ▼</a>`
      : `<span style="color:#7A96A6;">${clientCount}</span>`;

    const coachRow = `<tr id="coach-row-${co.id}">
      <td><a href="#" data-entity="coach-${co.id}" onclick="openCoachProfile(${co.id});return false;" style="color:#00b1d7;text-decoration:underline;text-decoration-style:dotted;font-weight:600;" onmouseover="this.style.textDecorationStyle='solid'" onmouseout="this.style.textDecorationStyle='dotted'">${name}</a></td>
      <td style="color:#7A96A6;font-size:12px;">${email}</td>
      <td>${isAdminFlag}</td>
      <td>${statusLabel}</td>
      <td style="text-align:center;">${clientsLink}</td>
      <td>${toggleAction}${reassignControl}</td>
    </tr>`;

    const accordionRow = `<tr id="accordion-${co.id}" style="display:none;">
      <td colspan="6" style="padding:0;background:#f7f5f2;border-bottom:2px solid #00b1d7;">
        <div id="accordion-content-${co.id}" style="padding:16px 20px;"></div>
      </td>
    </tr>`;

    return coachRow + '\n' + accordionRow;
  }).join('\n');

  const body = coaches.length === 0
    ? '<tr><td colspan="6" style="text-align:center;padding:40px;color:#7A96A6;">No coaches found.</td></tr>'
    : coachRowPairs;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hive Admin — Manage Coaches</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: Georgia, serif; background: #f7f5f2; color: #1A2B33; margin: 0; padding: 0; }
  .top-bar { background: #1A2B33; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .top-bar h1 { color: #00b1d7; font-size: 18px; margin: 0; font-weight: 700; }
  .top-bar span { color: #7A96A6; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
  .top-bar .nav-link { color: #7A96A6; font-size: 12px; text-decoration: none; font-family: Georgia, serif; }
  .top-bar .nav-link:hover { color: #fff; }
  .top-bar .nav-sep { color: #3A4B55; font-size: 12px; margin: 0 8px; }
  .flash-success { background: #e6f7ee; color: #1a7a4a; border-left: 4px solid #1a7a4a; padding: 12px 20px; font-size: 13px; }
  .flash-error { background: #fdecea; color: #c0392b; border-left: 4px solid #c0392b; padding: 12px 20px; font-size: 13px; }
  .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
  .card { background: #fff; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; margin-bottom: 32px; }
  .card-header { padding: 18px 20px; border-bottom: 1px solid #EFE8E0; font-size: 13px; font-weight: 700; color: #1A2B33; text-transform: uppercase; letter-spacing: 0.08em; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { background: #00b1d7; color: #fff; text-align: left; padding: 12px 14px;
             font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; font-weight: 700; }
  tbody tr { border-bottom: 1px solid #EFE8E0; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: #fafaf8; }
  tbody td { padding: 11px 14px; vertical-align: middle; }
  .add-form { padding: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; }
  .add-form label { display: block; font-size: 11px; color: #7A96A6; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; margin-bottom: 5px; }
  .add-form input { width: 100%; padding: 9px 11px; border: 1px solid #D0DCE4; border-radius: 4px; font-family: Georgia, serif; font-size: 13px; color: #1A2B33; outline: none; }
  .add-form input:focus { border-color: #00b1d7; }
  .btn-add { background: #00b1d7; color: #fff; border: none; border-radius: 4px; font-family: Georgia, serif; font-size: 13px; font-weight: 700; padding: 10px 18px; cursor: pointer; white-space: nowrap; }
  .btn-add:hover { background: #009bbf; }
  .sub-table { width:100%; border-collapse:collapse; font-size:12px; background:#fff; }
  .sub-table th { background:#1A2B33; color:#fff; text-align:left; padding:8px 10px; font-size:10px; letter-spacing:0.07em; text-transform:uppercase; font-weight:700; }
  .sub-table td { padding:8px 10px; border-bottom:1px solid #EFE8E0; vertical-align:middle; }
  .sub-table tr:last-child td { border-bottom:none; }
</style>
</head>
<body>
<div class="top-bar">
  <div>
    <div><span>Hive Enneagram Type Tool</span></div>
    <h1>Manage Coaches</h1>
  </div>
  <div style="display:flex;align-items:center;gap:16px;">
    <a href="/admin" class="nav-link">← Dashboard</a>
    <span class="nav-sep">|</span>
    <a href="/admin/logout" class="nav-link">Sign out</a>
  </div>
</div>
${flashMsg   ? `<div class="flash-success">${flashMsg}</div>`   : ''}
${errorMsg   ? `<div class="flash-error">${errorMsg}</div>`     : ''}
<div class="container">
  <div class="card">
    <div class="card-header">All Coaches</div>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Admin</th>
          <th>Status</th>
          <th style="text-align:center;">Clients</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-header">Add New Coach</div>
    <form method="POST" action="/admin/coaches/new" class="add-form">
      <div>
        <label for="coach_name">Full Name</label>
        <input type="text" id="coach_name" name="name" required placeholder="Jane Smith">
      </div>
      <div>
        <label for="coach_email">Email</label>
        <input type="email" id="coach_email" name="email" required placeholder="jane@example.com">
      </div>
      <div>
        <label for="coach_password">Temporary Password</label>
        <input type="password" id="coach_password" name="password" required minlength="8" placeholder="min 8 characters">
      </div>
      <div>
        <button type="submit" class="btn-add">Add Coach</button>
      </div>
    </form>
  </div>
</div>
<script>
var _accordionCache = {};
var _openCoachId = null;
var _typeNames = ${JSON.stringify({1:'The Improver',2:'The Giver',3:'The Performer',4:'The Idealist',5:'The Observer',6:'The Questioner',7:'The Enthusiast',8:'The Protector',9:'The Peacemaker'})};

function _fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

function _statusBadge(status) {
  var map = {
    complete: ['#e6f7ee','#1a7a4a','Complete'],
    processing: ['#fff8e1','#b07800','Processing'],
    failed: ['#fdecea','#c0392b','Failed'],
    in_progress: ['#fff3cd','#8b6914','In Progress'],
    not_started: ['#f4f4f4','#666','Not Started'],
  };
  var s = map[status] || ['#f4f4f4','#666',status];
  return '<span style="background:'+s[0]+';color:'+s[1]+';padding:2px 7px;border-radius:3px;font-size:11px;font-weight:600;">'+s[2]+'</span>';
}

function _pdfStatusHtml(r) {
  if (r.status !== 'complete') return '—';
  return r.pdf_generated_at ? ('✓ '+_fmt(r.pdf_generated_at)) : '<span style="color:#b07800;">⚠ Pending</span>';
}

function _emailStatusHtml(r) {
  if (r.status !== 'complete') return '—';
  return r.email_sent_at ? ('✓ '+_fmt(r.email_sent_at)) : '<span style="color:#b07800;">⚠ Pending</span>';
}

function renderAccordionTable(coachId, rows) {
  if (!rows || rows.length === 0) {
    return '<p style="padding:12px;color:#7A96A6;font-size:13px;">No clients found.</p>';
  }
  var html = '<table class="sub-table"><thead><tr>' +
    '<th>Client Name</th><th>Type</th><th>Instinct</th><th>Confidence</th><th>Coach</th>' +
    '<th>Date</th><th>Status</th><th>PDF</th><th>Email</th><th>Reports</th><th>Actions</th>' +
    '</tr></thead><tbody>';

  rows.forEach(function(r) {
    var name = ((r.first_name||'') + ' ' + (r.last_name||'')).trim() || '—';
    var typeNum = r.confirmed_type;
    var typeLabel = typeNum ? ('Type '+typeNum+' — '+(_typeNames[typeNum]||'')) : '—';
    var instinct = r.confirmed_instinct || '—';
    var conf = r.confidence_level ? r.confidence_level.replace(/_/g,'-') : '—';
    var coach = r.coach_name || '—';
    var date = _fmt(r.created_at);
    var status = r.status || 'unknown';
    var clientId = r.client_id;
    var clientEmail = r.email || '';

    var clientPdf = r.client_pdf ? r.client_pdf.replace(/.*[/\\\\]/,'') : null;
    var coachPdf  = r.coach_pdf  ? r.coach_pdf.replace(/.*[/\\\\]/,'')  : null;
    var pdfLinks = '—';
    if (status === 'complete') {
      var links = [];
      if (clientPdf) links.push('<a href="/reports/'+encodeURIComponent(clientPdf)+'" style="display:block;color:#00b1d7;text-decoration:none;white-space:nowrap;">&#128196; Client</a>');
      if (coachPdf)  links.push('<a href="/reports/'+encodeURIComponent(coachPdf)+'" style="display:block;color:#f58527;text-decoration:none;white-space:nowrap;">&#128196; Coach</a>');
      pdfLinks = links.join('') || '—';
    }

    var hasScores    = !!r.has_scores_snapshot;
    var hasApiResult = !!r.has_api_result;

    var nameLink = '<a href="#" data-entity="client-'+clientId+'" onclick="openClientProfile('+clientId+');return false;" style="color:#00b1d7;text-decoration:underline;text-decoration-style:dotted;font-weight:600;" onmouseover="this.style.textDecorationStyle=\\'solid\\'" onmouseout="this.style.textDecorationStyle=\\'dotted\\'">'+name+'</a>';
    var reassignBtn = '<button onclick="openReassignModal('+clientId+',\\''+name.replace(/'/g,"\\\\'")+'\\','+coachId+',\\''+coach.replace(/'/g,"\\\\'")+'\\',true,'+coachId+')" style="background:none;border:none;cursor:pointer;font-size:11px;color:#00b1d7;padding:0;text-decoration:underline;margin-right:4px;">Reassign</button>';
    var retryBtn = (hasScores && !hasApiResult)
      ? '<button onclick="accordionRetry('+clientId+',\\''+name.replace(/'/g,"\\\\'")+'\\',this,'+coachId+')" style="background:none;border:none;cursor:pointer;font-size:11px;color:#e67e22;padding:0;text-decoration:underline;margin-right:4px;">Retry API</button>'
      : '';
    var regenBtn = hasApiResult
      ? '<button onclick="accordionRegen('+clientId+',\\''+name.replace(/'/g,"\\\\'")+'\\',this,'+coachId+')" style="background:none;border:none;cursor:pointer;font-size:11px;color:#f58527;padding:0;text-decoration:underline;margin-right:4px;">Regen</button>'
      : '';
    var resendBtn = hasApiResult
      ? '<button onclick="accordionResend('+clientId+',\\''+clientEmail.replace(/'/g,"\\\\'")+'\\',this)" style="background:none;border:none;cursor:pointer;font-size:11px;color:#00b1d7;padding:0;text-decoration:underline;margin-right:4px;">Resend</button>'
      : '';
    var deleteBtn = '<button onclick="accordionDelete('+clientId+',\\''+name.replace(/'/g,"\\\\'")+'\\',this,'+coachId+')" style="background:none;border:none;cursor:pointer;font-size:13px;color:#c0392b;padding:0;">&#128465;</button>';

    html += '<tr id="acc-row-'+clientId+'">' +
      '<td>'+nameLink+'</td>' +
      '<td>'+typeLabel+'</td>' +
      '<td>'+instinct+'</td>' +
      '<td>'+conf+'</td>' +
      '<td id="acc-coach-cell-'+clientId+'">'+coach+'</td>' +
      '<td>'+date+'</td>' +
      '<td>'+_statusBadge(status)+'</td>' +
      '<td id="acc-pdf-'+clientId+'" style="font-size:11px;">'+_pdfStatusHtml(r)+'</td>' +
      '<td id="acc-email-'+clientId+'" style="font-size:11px;">'+_emailStatusHtml(r)+'</td>' +
      '<td>'+pdfLinks+'</td>' +
      '<td>'+reassignBtn+retryBtn+regenBtn+resendBtn+deleteBtn+'</td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

async function toggleAccordion(coachId, count) {
  var link = document.getElementById('client-count-'+coachId);
  if (_openCoachId === coachId) {
    document.getElementById('accordion-'+coachId).style.display = 'none';
    link.textContent = count+' clients ▼';
    _openCoachId = null;
    return;
  }
  if (_openCoachId !== null) {
    document.getElementById('accordion-'+_openCoachId).style.display = 'none';
    var prevLink = document.getElementById('client-count-'+_openCoachId);
    if (prevLink) prevLink.textContent = prevLink.dataset.count+' clients ▼';
  }
  _openCoachId = coachId;
  link.textContent = count+' clients ▲';
  document.getElementById('accordion-'+coachId).style.display = '';

  if (!_accordionCache[coachId]) {
    var content = document.getElementById('accordion-content-'+coachId);
    content.innerHTML = '<p style="padding:12px;color:#7A96A6;font-size:13px;">Loading…</p>';
    try {
      var resp = await fetch('/admin/coaches/'+coachId+'/clients', {headers:{Accept:'application/json'}});
      var data = await resp.json();
      _accordionCache[coachId] = data;
      content.innerHTML = renderAccordionTable(coachId, data);
    } catch(e) {
      content.innerHTML = '<p style="padding:12px;color:#c0392b;font-size:13px;">Failed to load clients.</p>';
    }
  }
}

function showToast(msg) {
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a7a4a;color:#fff;padding:12px 20px;border-radius:5px;font-family:Georgia,serif;font-size:13px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.25);';
  document.body.appendChild(t);
  setTimeout(function(){t.remove();}, 4000);
}

async function accordionRetry(clientId, name, btn, coachId) {
  if (!confirm('Re-run Claude API call for '+name+' and deliver results?')) return;
  var orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    var r = await fetch('/admin/retry/'+clientId, {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.success) {
      var pdfCell = document.getElementById('acc-pdf-'+clientId);
      if (pdfCell) pdfCell.textContent = '✓ just now';
      var emailCell = document.getElementById('acc-email-'+clientId);
      if (emailCell) emailCell.textContent = '✓ just now';
      btn.style.display = 'none';
      showToast('API call succeeded. Results delivered.');
      delete _accordionCache[coachId];
    } else { alert(d.error || 'Retry failed'); btn.disabled = false; btn.textContent = orig; }
  } catch(e) { alert('Request failed'); btn.disabled = false; btn.textContent = orig; }
}

async function accordionRegen(clientId, name, btn, coachId) {
  if (!confirm('Regenerate PDFs for '+name+'?')) return;
  var orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    var r = await fetch('/admin/regenerate/'+clientId, {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.success) {
      var cell = document.getElementById('acc-pdf-'+clientId);
      if (cell) cell.textContent = '✓ just now';
    } else { alert(d.error || 'Regeneration failed'); }
  } catch(e) { alert('Request failed'); }
  btn.disabled = false; btn.textContent = orig;
}

async function accordionResend(clientId, email, btn) {
  if (!confirm('Resend results email to '+email+'?')) return;
  var orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    var r = await fetch('/admin/resend/'+clientId, {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.success) {
      var cell = document.getElementById('acc-email-'+clientId);
      if (cell) cell.textContent = '✓ just now';
    } else { alert(d.error || 'Resend failed'); }
  } catch(e) { alert('Request failed'); }
  btn.disabled = false; btn.textContent = orig;
}

async function accordionDelete(clientId, name, btn, coachId) {
  if (!confirm('Delete record for '+name+'? This will permanently remove the record and any PDFs.')) return;
  btn.disabled = true;
  try {
    var r = await fetch('/admin/delete/'+clientId, {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.success) {
      var row = document.getElementById('acc-row-'+clientId);
      if (row) row.remove();
      // Invalidate cache and decrement count
      delete _accordionCache[coachId];
      var link = document.getElementById('client-count-'+coachId);
      if (link) {
        var newCount = parseInt(link.dataset.count, 10) - 1;
        link.dataset.count = newCount;
        link.textContent = newCount+' clients ▲';
        if (newCount === 0) {
          link.replaceWith(document.createTextNode('0'));
          document.getElementById('accordion-'+coachId).style.display = 'none';
          _openCoachId = null;
        }
      }
    } else { alert(d.error || 'Delete failed'); btn.disabled = false; }
  } catch(e) { alert('Request failed'); btn.disabled = false; }
}

// adminRetry / adminRegen / adminResend also used on main dashboard — define here too for coaches page
async function adminRetry(clientId, name, btn) {
  if (!confirm('Re-run Claude API call for '+name+' and deliver results?')) return;
  var orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    var r = await fetch('/admin/retry/'+clientId, {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.success) {
      var pdfCell = document.getElementById('pdf-status-'+clientId);
      if (pdfCell) pdfCell.textContent = '✓ just now';
      var emailCell = document.getElementById('email-status-'+clientId);
      if (emailCell) emailCell.textContent = '✓ just now';
      btn.style.display = 'none';
      showToast('API call succeeded. Results delivered.');
    } else { alert(d.error || 'Retry failed'); btn.disabled = false; btn.textContent = orig; }
  } catch(e) { alert('Request failed'); btn.disabled = false; btn.textContent = orig; }
}
async function adminRegen(clientId, name, btn) {
  if (!confirm('Regenerate PDFs for '+name+'?')) return;
  var orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    var r = await fetch('/admin/regenerate/'+clientId, {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.success) {
      var cell = document.getElementById('pdf-status-'+clientId);
      if (cell) cell.textContent = '✓ just now';
    } else { alert(d.error || 'Regeneration failed'); }
  } catch(e) { alert('Request failed'); }
  btn.disabled = false; btn.textContent = orig;
}
async function adminResend(clientId, email, btn) {
  if (!confirm('Resend results email to '+email+'?')) return;
  var orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    var r = await fetch('/admin/resend/'+clientId, {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.success) {
      var cell = document.getElementById('email-status-'+clientId);
      if (cell) cell.textContent = '✓ just now';
    } else { alert(d.error || 'Resend failed'); }
  } catch(e) { alert('Request failed'); }
  btn.disabled = false; btn.textContent = orig;
}
</script>
${sharedModalHTML(true)}
</body>
</html>`;
}

app.get('/admin/coaches', requireAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  let flashMsg = null;
  if (req.query.flash === 'coach_added')        flashMsg = 'Coach added successfully.';
  else if (req.query.flash === 'coach_deactivated')  flashMsg = 'Coach deactivated.';
  else if (req.query.flash === 'coach_reactivated')  flashMsg = 'Coach reactivated.';
  else if (req.query.flash === 'clients_reassigned') flashMsg = 'Clients reassigned successfully.';

  let coaches = [];
  try { coaches = await db.getAllCoaches(); } catch (e) { console.error('[admin/coaches] query error:', e.message); }

  res.send(renderCoachesPage(coaches, null, flashMsg));
});

app.get('/admin/coaches/active', requireAdmin, async (req, res) => {
  const coaches = await db.getAllCoaches().catch(() => []);
  res.json(coaches.filter(c => c.is_active !== false).map(c => ({ id: c.id, name: c.name })));
});

app.post('/admin/coaches/new', requireAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    const coaches = await db.getAllCoaches().catch(() => []);
    return res.send(renderCoachesPage(coaches, 'Name, email, and password are all required.', null));
  }
  if ((password || '').length < 8) {
    const coaches = await db.getAllCoaches().catch(() => []);
    return res.send(renderCoachesPage(coaches, 'Password must be at least 8 characters.', null));
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const newId = await db.addCoach(name.trim(), email.trim().toLowerCase(), passwordHash);
    if (!newId) {
      const coaches = await db.getAllCoaches().catch(() => []);
      return res.send(renderCoachesPage(coaches, 'Failed to add coach — email may already be in use.', null));
    }
    console.log(`[admin/coaches/new] added coach #${newId}: ${name} <${email}>`);
    res.redirect('/admin/coaches?flash=coach_added');
  } catch (e) {
    console.error('[admin/coaches/new] error:', e.message);
    const coaches = await db.getAllCoaches().catch(() => []);
    res.send(renderCoachesPage(coaches, 'An error occurred — email may already be in use.', null));
  }
});

app.post('/admin/coaches/:coach_id/deactivate', requireAdmin, async (req, res) => {
  const coachId = parseInt(req.params.coach_id, 10);
  if (!coachId || isNaN(coachId)) return res.status(400).send('Invalid coach ID');

  // Prevent self-deactivation
  if (coachId === req.session.coach_id) {
    const coaches = await db.getAllCoaches().catch(() => []);
    return res.setHeader('Content-Type', 'text/html; charset=utf-8') ||
      res.send(renderCoachesPage(coaches, 'You cannot deactivate your own account.', null));
  }

  await db.setCoachActive(coachId, false).catch(e => console.error('[admin/coaches/deactivate]', e.message));
  console.log(`[admin/coaches] deactivated coach #${coachId}`);
  res.redirect('/admin/coaches?flash=coach_deactivated');
});

app.post('/admin/coaches/:coach_id/reactivate', requireAdmin, async (req, res) => {
  const coachId = parseInt(req.params.coach_id, 10);
  if (!coachId || isNaN(coachId)) return res.status(400).send('Invalid coach ID');

  await db.setCoachActive(coachId, true).catch(e => console.error('[admin/coaches/reactivate]', e.message));
  console.log(`[admin/coaches] reactivated coach #${coachId}`);
  res.redirect('/admin/coaches?flash=coach_reactivated');
});

app.post('/admin/coaches/:coach_id/reassign', requireAdmin, async (req, res) => {
  const fromCoachId = parseInt(req.params.coach_id, 10);
  const toCoachId   = parseInt(req.body.to_coach_id, 10);

  if (!fromCoachId || isNaN(fromCoachId) || !toCoachId || isNaN(toCoachId)) {
    return res.status(400).send('Invalid coach IDs');
  }
  if (fromCoachId === toCoachId) {
    const coaches = await db.getAllCoaches().catch(() => []);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderCoachesPage(coaches, 'Cannot reassign clients to the same coach.', null));
  }

  await db.reassignClients(fromCoachId, toCoachId).catch(e => console.error('[admin/coaches/reassign]', e.message));
  console.log(`[admin/coaches] reassigned clients from coach #${fromCoachId} to #${toCoachId}`);
  res.redirect('/admin/coaches?flash=clients_reassigned');
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

const TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver',   3: 'The Performer', 4: 'The Idealist',
  5: 'The Observer', 6: 'The Questioner', 7: 'The Enthusiast',
  8: 'The Protector', 9: 'The Peacemaker',
};

function formatAdminDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

app.get('/admin', requireAdminSession, async (req, res) => {
  let flashMsg = null;
  let flashError = null;
  if (req.query.flash === 'password_updated')   flashMsg   = 'Password updated successfully.';
  else if (req.query.flash === 'invite_sent')   flashMsg   = 'Invite sent successfully.';
  else if (req.query.flash === 'invite_resent') flashMsg   = 'Invite resent successfully.';
  else if (req.query.flash === 'coach_added')   flashMsg   = 'Coach added successfully.';
  else if (req.query.flash === 'coach_deactivated') flashMsg = 'Coach deactivated.';
  else if (req.query.flash === 'coach_reactivated') flashMsg = 'Coach reactivated.';
  else if (req.query.flash === 'clients_reassigned') flashMsg = 'Clients reassigned successfully.';
  if (req.query.error === 'admin_required') flashError = 'Access denied — super-admin privileges required.';

  let rows = [];
  try { rows = await db.getAdminRowsByCoach(req.session.coach_id); } catch (e) { console.error('[admin] query error:', e.message); }

  const isAdmin = req.session.coach_is_admin === true;

  const tableRows = rows.map(r => {
    const name      = esc(`${r.first_name || ''} ${r.last_name || ''}`.trim()) || '—';
    const typeNum   = r.confirmed_type;
    const typeLabel = typeNum ? `Type ${typeNum} — ${TYPE_NAMES[typeNum] || ''}` : '—';
    const instinct  = r.confirmed_instinct || '—';
    const conf      = r.confidence_level ? r.confidence_level.replace(/_/g, '-') : '—';
    const coach     = esc(r.coach_name || '—');
    const date      = formatAdminDate(r.created_at);
    const status    = r.status || 'unknown';
    const clientStatus = r.client_status || status;

    let statusColor, statusBg, statusLabel;
    if (status === 'complete') {
      statusColor = '#1a7a4a'; statusBg = '#e6f7ee'; statusLabel = 'Complete';
    } else if (status === 'processing') {
      statusColor = '#b07800'; statusBg = '#fff8e1'; statusLabel = 'Processing';
    } else if (status === 'failed') {
      statusColor = '#c0392b'; statusBg = '#fdecea'; statusLabel = 'Failed';
    } else if (status === 'in_progress') {
      statusColor = '#8b6914'; statusBg = '#fff3cd'; statusLabel = 'In Progress';
    } else if (status === 'not_started') {
      statusColor = '#666'; statusBg = '#f4f4f4'; statusLabel = 'Not Started';
    } else {
      statusColor = '#666'; statusBg = '#f4f4f4'; statusLabel = status;
    }

    const clientPdfBase = r.client_pdf ? path.basename(r.client_pdf) : null;
    const coachPdfBase  = r.coach_pdf  ? path.basename(r.coach_pdf)  : null;
    const clientExists  = clientPdfBase && fs.existsSync(path.join(REPORTS_DIR, clientPdfBase));
    const coachExists   = coachPdfBase  && fs.existsSync(path.join(REPORTS_DIR, coachPdfBase));

    const pdfLinks = status === 'complete' ? [
      clientExists ? `<a href="/reports/${encodeURIComponent(clientPdfBase)}" title="Client PDF" style="display:block;color:#00b1d7;text-decoration:none;white-space:nowrap;">&#128196; Client</a>` : '',
      coachExists  ? `<a href="/reports/${encodeURIComponent(coachPdfBase)}"  title="Coach PDF"  style="display:block;color:#f58527;text-decoration:none;white-space:nowrap;">&#128196; Coach</a>` : '',
    ].filter(Boolean).join('') || '—' : '—';

    const clientId = r.client_id;
    const rawName  = `${r.first_name || ''} ${r.last_name || ''}`.trim();
    const rawEmail = r.email || '';

    // PDF / Email generation status cells
    const pdfStatus = status === 'complete'
      ? (r.pdf_generated_at
          ? `✓ ${formatAdminDate(r.pdf_generated_at)}`
          : `<span style="color:#b07800;">⚠ Pending</span>`)
      : '—';
    const emailStatus = status === 'complete'
      ? (r.email_sent_at
          ? `✓ ${formatAdminDate(r.email_sent_at)}`
          : `<span style="color:#b07800;">⚠ Pending</span>`)
      : '—';

    const deleteAction = `
      <form method="POST" action="/admin/delete/${clientId}" style="display:inline;" onsubmit="return confirm('Delete record for ${rawName.replace(/'/g, "\\'")}? This will permanently remove the record and any PDFs.');">
        <button type="submit" title="Delete" style="background:none;border:none;cursor:pointer;font-size:16px;padding:0;color:#c0392b;">&#128465;</button>
      </form>`;

    const inviteResendAction = clientStatus === 'not_started' ? `
      <form method="POST" action="/admin/clients/resend/${clientId}" style="display:inline;" onsubmit="return confirm('Resend invite to ${rawName.replace(/'/g, "\\'")}?');">
        <button type="submit" style="background:none;border:none;cursor:pointer;font-size:12px;color:#00b1d7;padding:0;text-decoration:underline;">Resend invite</button>
      </form> ` : '';

    const hasScores    = !!r.has_scores_snapshot;
    const hasApiResult = !!r.has_api_result;

    const reassignAction = isAdmin
      ? `<button onclick="openReassignModal(${clientId},'${rawName.replace(/'/g, "\\'")}',${req.session.coach_id},'${(r.coach_name || '').replace(/'/g, "\\'")}',false,null)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#00b1d7;padding:0;text-decoration:underline;margin-right:6px;">Reassign</button>`
      : '';

    const retryAction = (isAdmin && hasScores && !hasApiResult)
      ? `<button onclick="adminRetry(${clientId},'${rawName.replace(/'/g, "\\'")}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#e67e22;padding:0;text-decoration:underline;margin-right:6px;">Retry API</button>`
      : '';

    const regenAction = (isAdmin && hasApiResult)
      ? `<button onclick="adminRegen(${clientId},'${rawName.replace(/'/g, "\\'")}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#f58527;padding:0;text-decoration:underline;margin-right:6px;">Regen</button>`
      : '';

    const resendAction = hasApiResult
      ? `<button onclick="adminResend(${clientId},'${esc(rawEmail).replace(/'/g, "\\'")}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#00b1d7;padding:0;text-decoration:underline;margin-right:6px;">Resend</button>`
      : '';

    return `<tr id="row-${clientId}">
      <td><a href="#" data-entity="client-${clientId}" onclick="openClientProfile(${clientId});return false;" style="color:#00b1d7;text-decoration:underline;text-decoration-style:dotted;font-weight:600;" onmouseover="this.style.textDecorationStyle='solid'" onmouseout="this.style.textDecorationStyle='dotted'">${name}</a></td>
      <td>${typeLabel}</td>
      <td>${instinct}</td>
      <td>${conf}</td>
      <td id="coach-cell-${clientId}">${coach}</td>
      <td>${date}</td>
      <td><span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;">${statusLabel}</span></td>
      <td id="pdf-status-${clientId}" style="font-size:12px;">${pdfStatus}</td>
      <td id="email-status-${clientId}" style="font-size:12px;">${emailStatus}</td>
      <td>${pdfLinks}</td>
      <td>${reassignAction}${retryAction}${regenAction}${resendAction}${inviteResendAction}${deleteAction}</td>
    </tr>`;
  }).join('\n');

  const body = rows.length === 0
    ? '<tr><td colspan="11" style="text-align:center;padding:40px;color:#7A96A6;">No clients yet — click + Client to add one</td></tr>'
    : tableRows;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hive Admin — Assessments</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: Georgia, serif; background: #f7f5f2; color: #1A2B33; margin: 0; padding: 0; }
  .top-bar { background: #1A2B33; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .top-bar h1 { color: #00b1d7; font-size: 18px; margin: 0; font-weight: 700; }
  .top-bar span { color: #7A96A6; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
  .top-bar .nav-link { color: #7A96A6; font-size: 12px; text-decoration: none; font-family: Georgia, serif; }
  .top-bar .nav-link:hover { color: #fff; }
  .top-bar .nav-sep { color: #3A4B55; font-size: 12px; margin: 0 8px; }
  .btn-new-client { background: #00b1d7; color: #fff; font-family: Georgia, serif; font-size: 12px; font-weight: 700; border: none; border-radius: 4px; padding: 7px 14px; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn-new-client:hover { background: #009bbf; }
  .flash-success { background: #e6f7ee; color: #1a7a4a; border-left: 4px solid #1a7a4a; padding: 12px 20px; font-size: 13px; margin-bottom: 0; }
  .flash-error { background: #fdecea; color: #c0392b; border-left: 4px solid #c0392b; padding: 12px 20px; font-size: 13px; margin-bottom: 0; }
  .container { max-width: 1400px; margin: 0 auto; padding: 32px 24px; }
  .card { background: #fff; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { background: #00b1d7; color: #fff; text-align: left; padding: 12px 14px;
             font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; font-weight: 700; }
  tbody tr { border-bottom: 1px solid #EFE8E0; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: #fafaf8; }
  tbody td { padding: 11px 14px; vertical-align: middle; }
  @media (max-width: 768px) {
    .container { padding: 16px 12px; }
    table, thead, tbody, th, td, tr { display: block; }
    thead tr { display: none; }
    tbody tr { margin-bottom: 12px; background: #fff; border: 1px solid #EFE8E0; border-radius: 4px; padding: 8px 12px; }
    tbody td { border: none; padding: 4px 0; font-size: 13px; }
    tbody td::before { content: attr(data-label) ': '; font-weight: 700; color: #7A96A6; font-size: 11px; text-transform: uppercase; }
  }
</style>
</head>
<body>
<div class="top-bar">
  <div>
    <div><span>Hive Enneagram Type Tool</span></div>
    <h1>Admin Dashboard</h1>
  </div>
  <div style="display:flex;align-items:center;gap:16px;">
    <a href="/admin/clients/new" class="btn-new-client">+ Client</a>
    ${req.session.coach_is_admin ? `<a href="/admin/coaches" class="nav-link">Manage Coaches</a><span class="nav-sep">|</span>` : ''}
    <a href="/admin/password" class="nav-link">Change password</a>
    <span class="nav-sep">|</span>
    <a href="/admin/logout" class="nav-link">Sign out</a>
  </div>
</div>
${flashMsg   ? `<div class="flash-success">${flashMsg}</div>`   : ''}
${flashError ? `<div class="flash-error">${flashError}</div>` : ''}
<div class="container">
  <div class="card">
    <table>
      <thead>
        <tr>
          <th>Client Name</th>
          <th>Type</th>
          <th>Instinct</th>
          <th>Confidence</th>
          <th>Coach</th>
          <th>Date</th>
          <th>Status</th>
          <th>PDF</th>
          <th>Email</th>
          <th>Reports</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
    </table>
  </div>
</div>
<script>
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a7a4a;color:#fff;padding:12px 20px;border-radius:5px;font-family:Georgia,serif;font-size:13px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.25);';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
async function adminRetry(clientId, name, btn) {
  if (!confirm('Re-run Claude API call for ' + name + ' and deliver results?')) return;
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  try {
    const r = await fetch('/admin/retry/' + clientId, {method:'POST', headers:{Accept:'application/json'}});
    const d = await r.json();
    if (d.success) {
      const pdfCell = document.getElementById('pdf-status-' + clientId);
      if (pdfCell) pdfCell.textContent = '✓ just now';
      const emailCell = document.getElementById('email-status-' + clientId);
      if (emailCell) emailCell.textContent = '✓ just now';
      btn.style.display = 'none';
      showToast('API call succeeded. Results delivered.');
    } else { alert(d.error || 'Retry failed'); btn.disabled = false; btn.textContent = orig; }
  } catch(e) { alert('Request failed'); btn.disabled = false; btn.textContent = orig; }
}
async function adminRegen(clientId, name, btn) {
  if (!confirm('Regenerate PDFs for ' + name + '?')) return;
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  try {
    const r = await fetch('/admin/regenerate/' + clientId, {method:'POST', headers:{Accept:'application/json'}});
    const d = await r.json();
    if (d.success) {
      const cell = document.getElementById('pdf-status-' + clientId);
      if (cell) cell.textContent = '✓ just now';
    } else { alert(d.error || 'Regeneration failed'); }
  } catch(e) { alert('Request failed'); }
  btn.disabled = false; btn.textContent = orig;
}
async function adminResend(clientId, email, btn) {
  if (!confirm('Resend results email to ' + email + '?')) return;
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  try {
    const r = await fetch('/admin/resend/' + clientId, {method:'POST', headers:{Accept:'application/json'}});
    const d = await r.json();
    if (d.success) {
      const cell = document.getElementById('email-status-' + clientId);
      if (cell) cell.textContent = '✓ just now';
    } else { alert(d.error || 'Resend failed'); }
  } catch(e) { alert('Request failed'); }
  btn.disabled = false; btn.textContent = orig;
}
</script>
${sharedModalHTML(req.session.coach_is_admin === true)}
</body>
</html>`);
});

// Serve PDFs — only client_*.pdf and coach_*.pdf patterns allowed, coach-scoped
app.get('/reports/:filename', requireAdminSession, async (req, res) => {
  const filename = req.params.filename;
  if (!/^(client|coach)_[^/]+\.pdf$/.test(filename)) {
    return res.status(403).send('Forbidden');
  }

  const coachId = await db.getReportCoachId(filename);
  if (coachId !== null && coachId !== req.session.coach_id) {
    return res.status(403).send('Forbidden');
  }

  const filePath = path.join(REPORTS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.sendFile(filePath);
});

// Delete a client + all associated assessments and PDFs (coach-scoped; super admin unrestricted)
app.post('/admin/delete/:client_id', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
  if (!clientId || isNaN(clientId)) {
    return wantsJson ? res.status(400).json({ error: 'Invalid client ID' }) : res.status(400).send('Invalid client ID');
  }

  const ownerCoachId = await db.getClientCoachId(clientId);
  const isSuperAdmin = req.session.coach_is_admin === true;
  if (!isSuperAdmin && ownerCoachId !== req.session.coach_id) {
    return wantsJson ? res.status(403).json({ error: 'Forbidden' }) : res.status(403).send('Forbidden');
  }

  try {
    const pdfPaths = await db.getClientReportPaths(clientId);
    for (const p of pdfPaths) {
      try { fs.unlinkSync(p); console.log(`[admin] deleted PDF: ${p}`); }
      catch (e) { console.warn(`[admin] could not delete PDF ${p}:`, e.message); }
    }
    await db.deleteClientCascade(clientId);
    console.log(`[admin] deleted client #${clientId} and all related records`);
  } catch (e) {
    console.error('[admin] delete error:', e.message);
    return wantsJson ? res.status(500).json({ error: 'Delete failed' }) : res.redirect('/admin');
  }

  if (wantsJson) return res.json({ success: true });
  res.redirect('/admin');
});

// ── TEMPORARY DIAGNOSTIC — remove when done ──────────────────────────────────

app.get('/admin/export/:client_id', requireAdmin, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });
  const r = await db.query(
    `SELECT * FROM assessments WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clientId]
  );
  if (!r || r.rows.length === 0) return res.status(404).json({ error: 'No assessment found' });
  return res.json(r.rows[0]);
});

// ── Report Regeneration (super admin only) ───────────────────────────────────

app.post('/admin/regenerate/:client_id', requireAdmin, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const payload = await db.getAssessmentPayload(clientId);
  if (!payload || !payload.api_result || !payload.scores_snapshot) {
    return res.status(400).json({ error: 'No stored payload found for this client.' });
  }

  const clientInfo = await db.getClientWithCoach(clientId);
  if (!clientInfo) return res.status(404).json({ error: 'Client not found.' });

  const intake = {
    firstName:    clientInfo.first_name,
    lastName:     clientInfo.last_name,
    email:        clientInfo.email,
    organization: clientInfo.organization || '',
    coach:        clientInfo.coach_name,
  };

  const result = typeof payload.api_result === 'string'
    ? JSON.parse(payload.api_result)
    : payload.api_result;
  const scores = typeof payload.scores_snapshot === 'string'
    ? JSON.parse(payload.scores_snapshot)
    : payload.scores_snapshot;

  // Remove stale report entries before regenerating
  await db.deleteReportsByAssessmentId(payload.assessment_id);

  try {
    await generateReportPDFs(result, scores, intake, payload.assessment_id);
    await db.query(
      `UPDATE assessments SET pdf_generated_at = NOW() WHERE id = $1`,
      [payload.assessment_id]
    );
    console.log(`[admin/regenerate] PDFs regenerated for client #${clientId}`);
    return res.json({ success: true, message: 'PDFs regenerated.' });
  } catch (e) {
    console.error('[admin/regenerate] error:', e.message);
    return res.status(500).json({ error: 'PDF generation failed.' });
  }
});

// ── Retry Claude API call (super admin only — for assessments where scores_snapshot exists but api_result is NULL) ──

app.post('/admin/retry/:client_id', requireAdmin, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const payload = await db.getAssessmentPayload(clientId);
  if (!payload || !payload.scores_snapshot) {
    return res.status(400).json({ error: 'No scores snapshot found. Client may need to retake the assessment.' });
  }
  if (payload.api_result) {
    return res.status(400).json({ error: 'API result already exists. Use Regenerate instead.' });
  }

  const responses = typeof payload.responses === 'string'
    ? JSON.parse(payload.responses)
    : (payload.responses || {});
  const { systemPrompt, userMessage } = responses;
  if (!systemPrompt || !userMessage) {
    return res.status(400).json({ error: 'Stored prompts missing — cannot retry. Client may need to retake.' });
  }

  const scores = typeof payload.scores_snapshot === 'string'
    ? JSON.parse(payload.scores_snapshot)
    : payload.scores_snapshot;

  const clientInfo = await db.getClientWithCoach(clientId);
  if (!clientInfo) return res.status(404).json({ error: 'Client not found.' });

  const intake = {
    firstName:    clientInfo.first_name,
    lastName:     clientInfo.last_name,
    email:        clientInfo.email,
    organization: clientInfo.organization || '',
    coach:        clientInfo.coach_name,
  };

  let result;
  try {
    result = await callClaudeWithRetry(systemPrompt, userMessage);
  } catch (err) {
    console.error('[admin/retry] Claude API failed:', err.message);
    return res.status(500).json({ error: `Claude API call failed: ${err.message}` });
  }

  try {
    await db.query(
      `UPDATE assessments SET api_result = $1 WHERE id = $2`,
      [JSON.stringify(result), payload.assessment_id]
    );
    await db.completeAssessment(payload.assessment_id, result);
    await db.updateClientStatus(clientId, 'complete');

    await db.deleteReportsByAssessmentId(payload.assessment_id);
    const { clientPdfPath, coachPdfPath } = await generateReportPDFs(result, scores, intake, payload.assessment_id);
    await db.query(
      `UPDATE assessments SET pdf_generated_at = NOW() WHERE id = $1`,
      [payload.assessment_id]
    );

    await sendEmails(intake, result, clientPdfPath, coachPdfPath);
    await db.query(
      `UPDATE assessments SET email_sent_at = NOW() WHERE id = $1`,
      [payload.assessment_id]
    );

    console.log(`[admin/retry] succeeded for client #${clientId}`);
    return res.json({ success: true, message: 'API call succeeded. PDFs generated and email sent.' });
  } catch (err) {
    console.error('[admin/retry] post-API processing failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Result Email Resend (super admin or coach-scoped) ────────────────────────

app.post('/admin/resend/:client_id', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const ownerCoachId = await db.getClientCoachId(clientId);
  const isSuperAdmin = req.session.coach_is_admin === true;
  if (!isSuperAdmin && ownerCoachId !== req.session.coach_id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const payload = await db.getAssessmentPayload(clientId);
  if (!payload || !payload.api_result) {
    return res.status(400).json({ error: 'No stored payload found for this client.' });
  }

  const clientInfo = await db.getClientWithCoach(clientId);
  if (!clientInfo) return res.status(404).json({ error: 'Client not found.' });

  const intake = {
    firstName:    clientInfo.first_name,
    lastName:     clientInfo.last_name,
    email:        clientInfo.email,
    organization: clientInfo.organization || '',
    coach:        clientInfo.coach_name,
  };

  const result = typeof payload.api_result === 'string'
    ? JSON.parse(payload.api_result)
    : payload.api_result;
  const scores = typeof payload.scores_snapshot === 'string'
    ? JSON.parse(payload.scores_snapshot)
    : (payload.scores_snapshot || {});

  // Regenerate PDFs if missing
  if (!payload.pdf_generated_at) {
    await db.deleteReportsByAssessmentId(payload.assessment_id);
    try {
      await generateReportPDFs(result, scores, intake, payload.assessment_id);
      await db.query(
        `UPDATE assessments SET pdf_generated_at = NOW() WHERE id = $1`,
        [payload.assessment_id]
      );
      console.log(`[admin/resend] PDFs regenerated for client #${clientId}`);
    } catch (e) {
      console.error('[admin/resend] PDF regeneration failed:', e.message);
    }
  }

  const reports = await db.getAssessmentReports(payload.assessment_id);

  try {
    await sendEmails(intake, result, reports.clientPdf, reports.coachPdf);
    await db.query(
      `UPDATE assessments SET email_sent_at = NOW() WHERE id = $1`,
      [payload.assessment_id]
    );
    console.log(`[admin/resend] email resent for client #${clientId}`);
    return res.json({ success: true, message: 'Email resent.' });
  } catch (e) {
    console.error('[admin/resend] sendEmails error:', e.message);
    return res.status(500).json({ error: 'Email delivery failed.' });
  }
});

// ── Coach client list (super admin only, JSON) ───────────────────────────────

app.get('/admin/coaches/:coach_id/clients', requireAdmin, async (req, res) => {
  const coachId = parseInt(req.params.coach_id, 10);
  if (!coachId || isNaN(coachId)) return res.status(400).json({ error: 'Invalid coach ID' });

  try {
    const rows = await db.getAdminRowsByCoach(coachId);
    return res.json(rows);
  } catch (e) {
    console.error('[admin/coaches/clients] query error:', e.message);
    return res.status(500).json({ error: 'Query failed' });
  }
});

// ── Profile endpoints ─────────────────────────────────────────────────────────

app.get('/admin/coaches/:coach_id/profile', requireAdmin, async (req, res) => {
  const coachId = parseInt(req.params.coach_id, 10);
  if (!coachId || isNaN(coachId)) return res.status(400).json({ error: 'Invalid coach ID' });

  const coach = await db.getCoachById(coachId);
  if (!coach) return res.status(404).json({ error: 'Coach not found' });

  const history = await db.getEditHistory('coach', coachId);
  return res.json({ coach, history });
});

app.get('/admin/coaches/:coach_id/edit-history', requireAdmin, async (req, res) => {
  const coachId = parseInt(req.params.coach_id, 10);
  if (!coachId || isNaN(coachId)) return res.status(400).json({ error: 'Invalid coach ID' });
  const history = await db.getEditHistory('coach', coachId);
  return res.json(history);
});

app.post('/admin/coaches/:coach_id/update', requireAdmin, async (req, res) => {
  const coachId = parseInt(req.params.coach_id, 10);
  if (!coachId || isNaN(coachId)) return res.status(400).json({ error: 'Invalid coach ID' });

  const { name, email, note } = req.body;

  // Validate
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required.' });
  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) return res.status(400).json({ error: 'Invalid email address.' });

  // Check email uniqueness (exclude current coach)
  const existing = await db.getCoachByEmail(emailTrimmed);
  if (existing && existing.id !== coachId) return res.status(400).json({ error: 'Email is already in use by another coach.' });

  const before = await db.getCoachById(coachId);
  if (!before) return res.status(404).json({ error: 'Coach not found.' });

  const after = { name: name.trim(), email: emailTrimmed };
  const changeSummary = buildChangeSummary('coach', before, after);

  await db.updateCoach(coachId, after, req.session.coach_name);
  await db.insertEditHistory({
    record_type:    'coach',
    record_id:      coachId,
    edited_by_id:   req.session.coach_id,
    edited_by_name: req.session.coach_name,
    change_summary: changeSummary,
    editor_note:    note || null,
  });

  const historyEntry = {
    edited_at:      new Date().toISOString(),
    edited_by_id:   req.session.coach_id,
    edited_by_name: req.session.coach_name,
    change_summary: changeSummary,
    editor_note:    note || null,
  };

  console.log(`[admin/coaches/update] updated coach #${coachId}: ${changeSummary}`);
  return res.json({ success: true, updated: after, historyEntry });
});

app.get('/admin/clients/:client_id/profile', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const ownerCoachId = await db.getClientCoachId(clientId);
  const isSuperAdmin = req.session.coach_is_admin === true;
  if (!isSuperAdmin && ownerCoachId !== req.session.coach_id) return res.status(403).json({ error: 'Forbidden' });

  // Fetch client + coach name
  const clientR = await db.query(`
    SELECT c.*, co.name AS coach_name
    FROM clients c
    LEFT JOIN coaches co ON co.id = c.coach_id
    WHERE c.id = $1 LIMIT 1
  `, [clientId]);
  const client = clientR && clientR.rows.length > 0 ? clientR.rows[0] : null;
  if (!client) return res.status(404).json({ error: 'Client not found.' });

  // Latest assessment summary
  const asmR = await db.query(
    `SELECT confirmed_type, confirmed_instinct, confidence_level, status
     FROM assessments WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clientId]
  );
  const assessment = asmR && asmR.rows.length > 0 ? asmR.rows[0] : null;

  const history = await db.getEditHistory('client', clientId);
  return res.json({ client, assessment, history });
});

app.get('/admin/clients/:client_id/edit-history', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const ownerCoachId = await db.getClientCoachId(clientId);
  const isSuperAdmin = req.session.coach_is_admin === true;
  if (!isSuperAdmin && ownerCoachId !== req.session.coach_id) return res.status(403).json({ error: 'Forbidden' });

  const history = await db.getEditHistory('client', clientId);
  return res.json(history);
});

app.post('/admin/clients/:client_id/update', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const ownerCoachId = await db.getClientCoachId(clientId);
  const isSuperAdmin = req.session.coach_is_admin === true;
  if (!isSuperAdmin && ownerCoachId !== req.session.coach_id) return res.status(403).json({ error: 'Forbidden' });

  const { first_name, last_name, email, organization, note } = req.body;

  // Validate
  if (!first_name || !first_name.trim()) return res.status(400).json({ error: 'First name is required.' });
  if (!last_name  || !last_name.trim())  return res.status(400).json({ error: 'Last name is required.' });
  if (!email      || !email.trim())      return res.status(400).json({ error: 'Email is required.' });
  const emailTrimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) return res.status(400).json({ error: 'Invalid email address.' });

  const before = await db.getClientById(clientId);
  if (!before) return res.status(404).json({ error: 'Client not found.' });

  const after = {
    first_name:   first_name.trim(),
    last_name:    last_name.trim(),
    email:        emailTrimmed,
    organization: organization ? organization.trim() : null,
  };
  const changeSummary = buildChangeSummary('client', before, after);

  await db.updateClient(clientId, after, req.session.coach_name);
  await db.insertEditHistory({
    record_type:    'client',
    record_id:      clientId,
    edited_by_id:   req.session.coach_id,
    edited_by_name: req.session.coach_name,
    change_summary: changeSummary,
    editor_note:    note || null,
  });

  const historyEntry = {
    edited_at:      new Date().toISOString(),
    edited_by_id:   req.session.coach_id,
    edited_by_name: req.session.coach_name,
    change_summary: changeSummary,
    editor_note:    note || null,
  };

  console.log(`[admin/clients/update] updated client #${clientId}: ${changeSummary}`);
  return res.json({ success: true, updated: after, historyEntry });
});

app.post('/admin/clients/:client_id/reassign', requireAdmin, async (req, res) => {
  const clientId   = parseInt(req.params.client_id, 10);
  const newCoachId = parseInt(req.body.new_coach_id, 10);
  const notifyCoach = req.body.notify_coach === true || req.body.notify_coach === 'true';

  if (!clientId || isNaN(clientId) || !newCoachId || isNaN(newCoachId)) {
    return res.status(400).json({ error: 'Invalid client or coach ID.' });
  }

  const newCoach = await db.getCoachById(newCoachId).catch(() => null);
  if (!newCoach || newCoach.is_active === false) {
    return res.status(400).json({ error: 'Coach not found or inactive.' });
  }

  const oldCoachId = await db.getClientCoachId(clientId);
  if (oldCoachId === null) return res.status(404).json({ error: 'Client not found.' });

  const oldCoach = await db.getCoachById(oldCoachId).catch(() => null);
  const oldCoachName = oldCoach ? oldCoach.name : 'Unknown';

  const clientRow = await db.getClientById(clientId).catch(() => null);

  await db.reassignClientToCoach(clientId, newCoachId);
  await db.insertEditHistory({
    record_type:    'client',
    record_id:      clientId,
    edited_by_id:   req.session.coach_id,
    edited_by_name: req.session.coach_name,
    change_summary: `Coach reassigned from ${oldCoachName} to ${newCoach.name}`,
    editor_note:    null,
  });

  if (notifyCoach && newCoach.email) {
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    const appUrl    = process.env.RAILWAY_PUBLIC_URL || 'https://hive-typing-engine-production.up.railway.app';
    const coachFirstName = newCoach.name ? newCoach.name.split(' ')[0] : newCoach.name;
    const clientFullName = clientRow ? `${clientRow.first_name} ${clientRow.last_name}` : `Client #${clientId}`;
    try {
      await sgMail.send({
        to:      newCoach.email,
        from:    { name: 'InsightOut by Hive', email: fromEmail },
        subject: `You've Been Assigned an InsightOut Client`,
        text: [
          `Hi ${coachFirstName},`,
          ``,
          `A client has been added to your InsightOut roster.`,
          ``,
          `Client: ${clientFullName}`,
          ``,
          `You can view their assessment status and access their report from your dashboard.`,
          ``,
          `View Dashboard: ${appUrl}/admin`,
          ``,
          `— InsightOut by Hive`,
        ].join('\n'),
        html: `
          <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1A2B33;line-height:1.7;">
            <div style="border-top:4px solid #00b1d7;padding-top:28px;margin-bottom:24px;">
              <p style="font-size:11px;color:#7A96A6;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px;">InsightOut by Hive</p>
              <h1 style="font-size:22px;color:#00b1d7;margin:0;font-weight:700;">New Client Assignment</h1>
            </div>
            <p style="font-size:15px;">Hi ${esc(coachFirstName)},</p>
            <p>A client has been added to your InsightOut roster.</p>
            <p><strong>Client:</strong> ${esc(clientFullName)}</p>
            <p>You can view their assessment status and access their report from your dashboard.</p>
            <p style="margin:32px 0;">
              <a href="${appUrl}/admin" style="display:inline-block;background:#00b1d7;color:#fff;padding:14px 28px;border-radius:4px;font-weight:700;text-decoration:none;font-size:15px;">View Dashboard →</a>
            </p>
            <div style="margin-top:40px;padding-top:16px;border-top:1px solid #E0E8EC;font-size:11px;color:#7A96A6;">
              — InsightOut by Hive
            </div>
          </div>
        `,
      });
      console.log(`[admin/clients/reassign] notification sent to coach ${newCoach.email}`);
    } catch (e) {
      console.error('[admin/clients/reassign] notification email failed:', e.message);
    }
  }

  console.log(`[admin/clients/reassign] client #${clientId} reassigned from coach #${oldCoachId} to #${newCoachId}`);
  return res.json({ success: true, new_coach_name: newCoach.name });
});

// =================== START ===================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Hive Typing Engine → http://localhost:${PORT}`)
);
