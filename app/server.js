'use strict';

const express    = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const sgMail     = require('@sendgrid/mail');
const basicAuth  = require('express-basic-auth');
const bcrypt     = require('bcrypt');
const session    = require('express-session');
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

// Basic auth — protects all routes except /admin (which uses session auth)
const basicAuthMiddleware = basicAuth({
  users: {
    [process.env.BASIC_AUTH_USER || 'hive-enneagram']: process.env.BASIC_AUTH_PASSWORD || '9Types!',
  },
  challenge: true,
  realm: 'Hive Typing Engine',
});
app.use((req, res, next) => {
  if (req.path === '/admin/login' || req.path.startsWith('/admin')) return next();
  basicAuthMiddleware(req, res, next);
});

// Session middleware (must be before admin routes)
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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use('/content', express.static('../content'));

// Session auth guard for admin routes
function requireAdminSession(req, res, next) {
  if (req.session && req.session.coach_id) return next();
  res.redirect('/admin/login');
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

  const pdfOpts = buildPdfOptions(intake);

  try {
    const clientHtml = buildClientHTML(result, typeLibrary, intake);
    clientPdfPath = await generatePDF(clientHtml, `client_${intake.firstName}_${intake.lastName}`, pdfOpts);
    console.log(`[pdf] client PDF generated: ${clientPdfPath}`);
    await db.createReport(assessmentId, 'client', clientPdfPath);
  } catch (e) {
    console.error('[pdf] client PDF generation failed:', e.message);
  }

  try {
    const coachHtml = buildCoachHTML(result, typeLibrary, scores, intake);
    coachPdfPath = await generatePDF(coachHtml, `coach_${intake.firstName}_${intake.lastName}`, pdfOpts);
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

  req.session.regenerate((err) => {
    if (err) {
      console.error('[admin/login] session regenerate error:', err.message);
      return res.send(renderLoginPage('Sign-in failed — please try again.'));
    }
    req.session.coach_id   = coach.id;
    req.session.coach_name = coach.name;
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
  const flashMsg = req.query.flash === 'password_updated' ? 'Password updated successfully.' : null;
  let rows = [];
  try { rows = await db.getAdminRowsByCoach(req.session.coach_id); } catch (e) { console.error('[admin] query error:', e.message); }

  const tableRows = rows.map(r => {
    const name      = esc(`${r.first_name || ''} ${r.last_name || ''}`.trim()) || '—';
    const typeNum   = r.confirmed_type;
    const typeLabel = typeNum ? `Type ${typeNum} — ${TYPE_NAMES[typeNum] || ''}` : '—';
    const instinct  = r.confirmed_instinct || '—';
    const conf      = r.confidence_level ? r.confidence_level.replace(/_/g, '-') : '—';
    const coach     = esc(r.coach_name || '—');
    const date      = formatAdminDate(r.created_at);
    const status    = r.status || 'unknown';
    const statusColor = status === 'complete' ? '#1a7a4a' : status === 'processing' ? '#b07800' : status === 'failed' ? '#c0392b' : '#666';
    const statusBg    = status === 'complete' ? '#e6f7ee' : status === 'processing' ? '#fff8e1' : status === 'failed' ? '#fdecea' : '#f4f4f4';

    const clientPdfBase = r.client_pdf ? path.basename(r.client_pdf) : null;
    const coachPdfBase  = r.coach_pdf  ? path.basename(r.coach_pdf)  : null;
    const clientExists  = clientPdfBase && fs.existsSync(path.join(REPORTS_DIR, clientPdfBase));
    const coachExists   = coachPdfBase  && fs.existsSync(path.join(REPORTS_DIR, coachPdfBase));

    const pdfLinks = status === 'complete' ? [
      clientExists ? `<a href="/reports/${encodeURIComponent(clientPdfBase)}" title="Client PDF" style="margin-right:8px;color:#00b1d7;text-decoration:none;">&#128196; Client</a>` : '',
      coachExists  ? `<a href="/reports/${encodeURIComponent(coachPdfBase)}"  title="Coach PDF"  style="color:#f58527;text-decoration:none;">&#128196; Coach</a>` : '',
    ].filter(Boolean).join('') || '—' : '—';

    const clientId = r.client_id;
    const rawName  = `${r.first_name || ''} ${r.last_name || ''}`.trim();
    const deleteAction = `
      <form method="POST" action="/admin/delete/${clientId}" style="display:inline;" onsubmit="return confirm('Delete assessment for ${rawName.replace(/'/g, "\\'")}? This will permanently remove the record and both PDFs.');">
        <button type="submit" title="Delete" style="background:none;border:none;cursor:pointer;font-size:16px;padding:0;color:#c0392b;">&#128465;</button>
      </form>`;

    return `<tr>
      <td>${name}</td>
      <td>${typeLabel}</td>
      <td>${instinct}</td>
      <td>${conf}</td>
      <td>${coach}</td>
      <td>${date}</td>
      <td><span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;">${status}</span></td>
      <td>${pdfLinks}</td>
      <td>${deleteAction}</td>
    </tr>`;
  }).join('\n');

  const body = rows.length === 0
    ? '<tr><td colspan="9" style="text-align:center;padding:40px;color:#7A96A6;">No assessments yet</td></tr>'
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
  .flash-success { background: #e6f7ee; color: #1a7a4a; border-left: 4px solid #1a7a4a; padding: 12px 20px; font-size: 13px; margin-bottom: 0; }
  .container { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
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
  <div>
    <a href="/admin/password" class="nav-link">Change password</a>
    <span class="nav-sep">|</span>
    <a href="/admin/logout" class="nav-link">Sign out</a>
  </div>
</div>
${flashMsg ? `<div class="flash-success">${flashMsg}</div>` : ''}
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

// Delete a client + all associated assessments and PDFs (coach-scoped)
app.post('/admin/delete/:client_id', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).send('Invalid client ID');

  const ownerCoachId = await db.getClientCoachId(clientId);
  if (ownerCoachId !== req.session.coach_id) {
    return res.status(403).send('Forbidden');
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
  }

  res.redirect('/admin');
});

// =================== START ===================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Hive Typing Engine → http://localhost:${PORT}`)
);
