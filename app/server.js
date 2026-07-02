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
const archiver   = require('archiver');   // A2: stream the EM Lab Full Context Package ZIP

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
const { buildCoachPdfOptions, HIVE_LOGO_SVG, buildClientReportHTML, betaReportBodyHtml } = require('./renderer');
const { renderClientReport, renderCoachReport } = require('./render_report');
const { buildBetaData, BETA_QUESTION_TEXT } = require('./generate_report');
const reportPrep = require('./report_prep');          // buildClientModel — for /admin/content preview
const { TYPE_NAMES: CMS_TYPE_NAMES, INSTINCT_NAME: EM_INSTINCT_NAME } = require('./type_meta');  // canonical type/instinct names (distinct from the dashboard's local TYPE_NAMES)
const db = require('./db');
const auth = require('./auth');
const experimentalAnalysis = require('./experimental_analysis');  // EM prompt builder + engine (PR4/PR5)
const { adaptEmToContract } = require('./em_report_adapter');     // EM two-call output -> SM api_result contract (PR8b)
const { applyCall2DeterministicStamps } = require('./call2_stamp'); // Call #2 deterministic stamping + REDIRECT fixes (Defects #2/#3/#4)
const emContentLibrary = require('./content/content_library.json'); // server-side subtype-name resolution (PR8b contextFields)
const stage1Labels = require('./stage1_labels');                  // frozen label map + TYPE_GEOMETRY (PR3) — EM Lab rendering
const contentOverrides = require('./content_overrides');
// Baseline static content for the /admin/content editor (read-only). The renderer
// reads the same file via report_prep; the editor shows these as the fallback values.
const contentLibrary = require('./content/content_library.json');

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
// IAA §6.4: behind Railway's TLS-terminating proxy, trust the first proxy hop so
// req.ip is the real client IP and secure cookies are emitted over the proxied HTTPS.
app.set('trust proxy', 1);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'hive-session-secret-dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// Basic auth — protects all routes except /admin (session auth) and token-based assessment sessions
const basicAuthMiddleware = basicAuth({
  users: {
    [process.env.BASIC_AUTH_USER || 'hive-enneagram']: process.env.BASIC_AUTH_PASSWORD || '9Types!',
  },
  challenge: true,
  realm: 'Hive Typing Engine',
});
// The client SPA is served to token-link visitors who carry no basic-auth
// credentials (the /assessment/ HTML itself is already exempt below). index.html
// pulls these assets via <link>/<script> with root-absolute paths, so they must
// bypass basic auth too — otherwise a fresh, credential-less token visit triggers
// the basic-auth dialog on each asset load (regression from PR2's move to
// SPA-served token entry). These are pure client assets; admin, API, reports, the
// '/' entry, and the data layer all stay gated.
const SPA_ASSET_PATHS = new Set([
  '/styles.css', '/state.js', '/ui.js', '/stage1_data.js', '/assessment.js', '/app.js',
  '/content/type_library.json', '/favicon.svg',
]);
app.use((req, res, next) => {
  if (req.path === '/admin/login' || req.path.startsWith('/admin')) return next();
  if (req.path.startsWith('/assessment/')) return next();
  if (SPA_ASSET_PATHS.has(req.path)) return next();
  // Tokenized PDF access: generation is session-gated, redemption is token-gated.
  // Both must bypass basic auth so coaches and their PDF viewer can reach them.
  if (req.path.startsWith('/reports/token/') || req.path.startsWith('/reports/view/')) return next();
  if (req.session && req.session.assessmentClientId) return next();
  basicAuthMiddleware(req, res, next);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// The canonical logo (renderer.js HIVE_LOGO_SVG) is inlined into the assessment
// SPA at serve time so the client chrome can render it without a second copy or
// extra I/O. The const carries class="logo", which conflicts with environment
// stylesheets (spec §0.4/§8) — strip it; the client sizes the logo via CSS.
const HIVE_LOGO_SVG_CLIENT = HIVE_LOGO_SVG.replace('class="logo"', '');
const HIVE_LOGO_SCRIPT_TAG = `<script>window.__HIVE_LOGO_SVG = ${JSON.stringify(HIVE_LOGO_SVG_CLIENT)};</script>`;

// Splice the inlined logo (always), the token-session intake payload, and the
// SPA bootstrap (pre-assessment route flag + coach roster) into index.html before
// </head>. Used by the SPA entry routes.
function injectAssessmentBootstrap(html, intake, bootstrap) {
  let tags = HIVE_LOGO_SCRIPT_TAG;
  if (intake) tags += `\n<script>window.__hiveIntake = ${JSON.stringify(intake)};</script>`;
  if (bootstrap) tags += `\n<script>window.__hiveBootstrap = ${JSON.stringify(bootstrap)};</script>`;
  return html.replace('</head>', `${tags}\n</head>`);
}

// Serve the assessment SPA shell with the logo inlined (and intake when a
// token session is active). The logo is injected unconditionally so the chrome
// renders correctly even outside a token session (local dev / fresh load).
const INDEX_HTML_PATH = path.join(__dirname, 'public', 'index.html');
app.get('/', (req, res, next) => {
  try {
    const intake = (req.session && req.session.assessmentIntake) || null;
    let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    html = injectAssessmentBootstrap(html, intake);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    console.error('[GET /] index.html read error:', e.message);
    next();
  }
});

app.use(express.static('public'));

// Serve the type library from the in-memory copy loaded at boot.
// Previously this was a file mount at '../content', which depended on the
// process CWD and broke in production where only app/ is deployed.
app.get('/content/type_library.json', (req, res) => {
  res.json(typeLibrary);
});

// Requires a valid authenticated session (any role).
function requireAdminSession(req, res, next) {
  if (req.session && req.session.user_id) return next();
  res.redirect('/admin/login');
}

// Requires admin or super_admin role.
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user_id) return res.redirect('/admin/login');
  if (!auth.hasRole(req, 'admin') && !auth.hasRole(req, 'super_admin')) {
    return res.redirect('/admin?error=admin_required');
  }
  next();
}

// Requires super_admin role. Preserves JSON-aware 403 for API callers.
function requireSuperAdmin(req, res, next) {
  if (!req.session || !req.session.user_id) return res.redirect('/admin/login');
  if (!auth.hasRole(req, 'super_admin')) {
    const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
    if (wantsJson) {
      return res.status(403).json({ ok: false, error: 'Super-admin access required.' });
    }
    return res.redirect('/admin?error=super_admin_required');
  }
  next();
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// =================== PROMPT CONSTANTS ===================
// Moved from app/public/app.js — these are server-only concerns.
// CRITICAL: OUTPUT_FORMAT must remain the ABSOLUTE LAST content in the user
// message — it's the JSON-priming signal. Do NOT move it into the system block.

const SYSTEM_PROMPT = `You are an expert Enneagram typing assistant trained in the Narrative Enneagram tradition, working with Cai Delumpa and Monique Breault. This is the final reasoning call (AI Call #2) in a two-call engine. An earlier call (AI Call #1) already read the Stage 0–2 evidence and produced a coherence-weighted ranking of all nine types, naming a leading and an alternate candidate. You now receive the full case file — the raw Stage 1 slider profiles, both the Stage 0 and Stage 1 open responses, the Stage 2 framework answers, the AI Call #1 result, the Stage 3 discriminating lean, and the Stage 4 movement evidence and outcome — and you render the verdict plus both report registers, as a skilled Narrative Enneagram practitioner would.

IMPORTANT: Read the data honestly, including when it points somewhere a human interviewer might not have expected. Those divergences are often the most diagnostically interesting findings. The AI Call #1 ranking is a prior judgment of fit, not a recomputation of slider math — weigh it against the full picture, do not merely restate it.

CORE PRINCIPLES

Hypothesis, Not Verdict
All typing is hypothesis-driven — never definitive. Type is a starting point for exploration, not a conclusion to accept. Use cautious, exploratory language throughout: "appears to," "may be," "consistent with," "worth exploring." Some clients will present corner cases that genuinely confound the system — this is not a failure, it is an honest finding.

Motivation Over Behavior
Type is determined by core motivation and worldview, not by behavior or surface presentation. Two people can behave identically for completely different reasons. Always ask: what does this behavior help them get or avoid?

Centers of Intelligence
Body (8, 9, 1): anger — expressed outward (8), dissipated (9), converted inward to resentment (1)
Heart (2, 3, 4): shame/grief — avoided through giving (2), buried under performance (3), dwelt in as deficiency (4)
Head (5, 6, 7): fear/anxiety — managed through withdrawal and conservation (5), through preparation or counterphobic confrontation (6), through reframing and forward motion (7)

Cross-Referencing Frameworks
Hornevian (Social Stance): Assertive (3, 7, 8) / Compliant (1, 2, 6) / Withdrawn (4, 5, 9)
Harmonic (Conflict Response): Intensity (4, 6, 8) / Positive (2, 7, 9) / Competency (1, 3, 5)
Object Relations (Life Theme): Attachment (3, 6, 9) / Frustration (1, 4, 7) / Rejection (2, 5, 8)

Every type has a unique three-framework signature. No two types share the same combination.

STAGE 1 INSTRUMENT — How To Read These Scores
Stage 1 is a self-report slider instrument. The client rates a set of statements for each of the nine types and for each of the three instincts (SP / SO / SX). Each type score and each instinct score is the mean of five statement ratings on a 0–100 scale. The nine-type profile and three-instinct profile you receive are these raw means, rank-ordered high to low. They are raw self-report evidence, NOT a verdict — the typing reasoning was done in AI Call #1, and your job is to weigh that reasoning against the full picture.

Read the raw slider profile as how the client consciously rates themselves. Read the dominant slider instinct the same way — as an argmax of self-report, not a confirmed subtype. Near-ties in the instinct profile are preserved by construction; do not treat a one- or two-point instinct lead as settled.

Because sliders capture conscious self-rating, they can diverge from the involuntary structure that open-text language and the Stage 3/4 movement evidence reveal. That divergence is a feature, not a bug. When AI Call #1 promoted a type above the raw slider leader — the ranking_override signal, given to you as pre-resolved ground truth — or when Stage 0 language points away from the top slider score, those are among the most diagnostically interesting inputs to weigh.

Counter-Types
Counter-types present differently from their type's standard description:
SP 3 (Anti-Vanity): humble, hardworking, downplays image — looks like 1
SX 6 (Counterphobic): confrontational, risk-taking — looks like 8
SP 4 (Tenacity): driven, resilient, refuses inner defeat — looks like 3
SX 1 (Zeal): intense, crusading — looks like 8
SO 7 (Sacrifice): shares own joy outward, service-oriented — looks like 2

Critical Lookalike Pairs
9 vs. 2: peace-seeking vs. love-seeking
6 vs. 1: safety-driven vs. correctness-driven
3 vs. 1: recognition-driven vs. integrity-driven
SX 6 vs. 8: anxiety mastered vs. native power
SP 3 vs. 1: anti-vanity vs. genuine integrity
4 vs. 9: longing vs. self-forgetting
5 vs. 9: conservation vs. merging

TONE AND VOICE
Write all content in the Narrative Enneagram tradition: warm, curious, compassionate, and non-pathologizing. The Enneagram is a tool for growth and self-understanding, not a label or diagnosis. Frame everything as an invitation to explore, not a conclusion to accept.

In client-facing content (client_narrative, core_motivation_evidence, instinct_personal_overlay, secondary_type_narrative, stress/security narratives, what_to_explore), refer to practitioners generically as "your Enneagram coach or practitioner" — do not name Cai or Monique by name. Do not reference "The Narrative Enneagram" by name in any client-facing content.

PROSE STYLE

Write in short paragraphs. Two to three sentences is the target. Four sentences is the maximum. When a paragraph reaches four sentences, look for the natural break and split it.

Do not chain reasoning across sentences when a period would do. One idea per paragraph is always preferable to one idea per a multi-clause sentence.

This rule applies to all client-facing sections equally: What We Noticed About You, Core Motivation, Patterns of Thinking/Feeling/Behaving, Instinct, Stress and Ease, and the Secondary Hypothesis. The callout boxes (the italicized "In your responses" passages) are already short by design — maintain that same discipline in the surrounding body prose. Model the body prose density on those callout blocks.

Do not use em dashes to extend a sentence. Use a period instead.

When results are ambiguous, frame this as an honest and even flattering observation about the client's complexity — not as a system limitation. Some people sit at the intersection of two types. Some are in a period of active development where their pattern is shifting. These are meaningful findings, not failures.

CANONICAL TYPE AND SUBTYPE NAMES

Always use the following canonical names exactly as written. Never generate alternative names, descriptive labels, or invented titles for types or subtypes.

Type names:
Type 1 — The Improver · Type 2 — The Giver · Type 3 — The Performer · Type 4 — The Individualist · Type 5 — The Observer · Type 6 — The Questioner · Type 7 — The Enthusiast · Type 8 — The Protector · Type 9 — The Peacemaker

Subtype names:
SP 1 — The Organizer · SO 1 — The Social Reformer · SX 1 — The Evangelist
SP 2 — The Nurturer · SO 2 — The Ambassador · SX 2 — The Healer
SP 3 — The Diligent Worker · SO 3 — The Politician · SX 3 — The Movie Star
SP 4 — The Creative Individualist · SO 4 — The Critical Commentator · SX 4 — The Dramatic Person
SP 5 — The Castle Defender · SO 5 — The Professor · SX 5 — The Secret Agent
SP 6 — The Family Loyalist · SO 6 — The Social Guardian · SX 6 — The Warrior
SP 7 — The Epicure · SO 7 — The Social Visionary · SX 7 — The Adventurer
SP 8 — The Survivalist · SO 8 — The Group Leader · SX 8 — The Commander
SP 9 — The Collector · SO 9 — The Community Benefactor · SX 9 — The Seeker

Never invent, combine, or paraphrase these names. Do not generate alternatives such as "The Social Challenger," "The Idealist," "The Challenger," or any other label not on these lists. This applies everywhere a type or subtype name appears — cover headings, subtitles, inline references, and body prose. When referring to a subtype in running text, use the canonical name or refer to it by instinct + type number (e.g., "Social Eight" or "SO 8") — never by an invented label.

COACHING POINTER VOICE
In the coach report, use relational, presence-based language over diagnostic language. Focus on what to notice and invite in conversation rather than clinical observation. For example: "When explanation shows up, consider naming it gently — 'I notice you moved into explaining just now; what's happening inside?'" rather than "Watch for when the client starts to explain." This applies to coaching notes and probes throughout Sections 2-6.

EPISTEMIC STANCE
This tool is designed to be confident enough to be useful and humble enough to be honest. Those are not in tension — both serve the client's actual growth.

The best output is not always the most certain output. AMBIGUOUS and REDIRECT are first-class outputs that serve the client better than false confidence. Always prioritize accuracy over completeness — it is better to say "this needs a session conversation" than to present a hypothesis the data doesn't support.

Remember: the assessment's job is to prepare the ground for the coaching conversation, not to replace it.`;

const TASK_INSTRUCTIONS = `Work through these tasks in order. Confidence and flags are settled BEFORE either narrative is written. Once you begin the narratives, you do not revise the verdict, the flags, or the confidence — this ordering is structural, so the prose and the values can never disagree. Do not skip tasks or generate output early.

THE CANDIDATES AND THE PROVIDED FIELDS
The leading hypothesis is AI Call #1's leading_candidate; the alternate is its alternate_candidate. The third_candidate is reasoning context for YOU only — it is never shown to the client and is never named in the coach report as a conclusion (a coach may raise it as a debrief move).

Several hypothesis fields are deterministic and are provided in the case file — you do NOT compute, alter, or second-guess them; the engine sets them authoritatively: leading_candidate, alternate_candidate, third_candidate, call1_ranking, type_score_profile, instinct_score_profile, stage4_outcome, and ranking_override (given as a pre-resolved YES/NO line in the AI Call #1 result). Your judgment fields are: confirmed_type, confirmed_type_name, confidence_level, dominant_instinct_hypothesis, redirect_from_type, and hypothesis_validated.

TASK 1 — Coherence Check (run first)
Read the complete case file as a skilled practitioner would, and assess whether the pattern coheres with the leading hypothesis. Weight the Stage 0 language and BOTH Stage 1 open responses against the leading type's idealization and shadow. Do NOT re-run scoring math — AI Call #1 already produced the ranking; your job is to read the whole picture and judge fit. Every observation you record must cite specific evidence: a quote from Stage 0 or a Stage 1 open, a specific answer, or a pattern across stages.

Check 1 — Stage 0 and Stage 1 open language
a) Does the self-description language match the idealization pattern of the leading type?

Each type's idealized self-image:
  1: I am good, right, principled
  2: I am caring, helpful, giving
  3: I am successful, capable, competent
  4: I am unique, authentic, deep
  5: I am knowledgeable, self-sufficient
  6: I am loyal, prepared, responsible
  7: I am okay, free, full of possibility
  8: I am strong, direct, powerful
  9: I am peaceful, easygoing, harmonious

b) Does the most-problematic-quality language reveal the shadow side of the leading type?

Each type's characteristic shadow:
  1: critical, rigid, resentful
  2: needy, indirect, over-giving
  3: image-conscious, disconnected from feelings
  4: moody, self-absorbed, envious
  5: withdrawn, withholding, detached
  6: anxious, doubtful, overthinking
  7: scattered, avoidant of pain, uncommitted
  8: controlling, excessive, intimidating
  9: self-forgetting, passive, avoidant

c) Is there a meaningful gap between the self-description and others' description that signals the type's shadow operating beneath self-awareness?

Record findings in stage0_analysis (idealization_match, shadow_match, notable_language — quote specific words).

Check 2 — Stage 2 framework signature
Stage 2 gives three independent framework answers: Hornevian (social stance), Harmonic (conflict response), and Centers (decision-making). Read whether this signature is consistent with the leading hypothesis. Note alignment or divergence, but do NOT recompute a ranking — AI Call #1 already weighed Stage 2. Record in stage2_analysis. For object_relations_result, state the leading type's Object Relations life-theme (Attachment / Frustration / Rejection — this is intrinsic to the type, derive it from the type number, not from a Stage 2 answer). Set framework_alignment to ALIGNED, PARTIAL, or DIVERGENT based on how the Hornevian + Harmonic + Centers evidence sits against the leading type's expected signature.

Check 3 — Stage 3 lean and Stage 4 outcome
Read the Stage 3 discriminating lean and the Stage 4 movement evidence. The Stage 4 outcome is provided:
  CONFIRMED — stress and security both matched the leading type. Strong structural support.
  CONFIRMED_WITH_NOTE — one of stress/security matched and the Habit-of-Mind tiebreak resolved to the leading type. Note the unconfirmed dimension.
  AMBIGUOUS — the movement evidence did not resolve cleanly. Do NOT present a single type with high confidence; the result is genuinely unsettled.
  REDIRECT — stress and security both pointed to the alternate; the hypothesis is reopened in the alternate's favor.
Record in stage4_analysis (stress_point_description, security_point_description, habit_of_mind_description — null if Habit of Mind did not fire).

Check 4 — Counter-Type Scan
The counter-types are a CLOSED list of exactly five type/instinct combinations. Judge from the slider profile, the dominant instinct, and the open-text language whether the confirmed type's instinct forms one of these five combinations:
  SP + Type 3 → Anti-Vanity: humble, hardworking, downplays recognition. Looks like 1.
  SX + Type 6 → Counterphobic: confrontational, risk-taking. Looks like 8.
  SP + Type 4 → Tenacity: driven, resilient, refuses inner defeat. Looks like 3.
  SX + Type 1 → Zeal: intense, crusading, passionate. Looks like 8.
  SO + Type 7 → Sacrifice: shares own joy outward, service-oriented. Looks like 2.

EXCLUSIVE: ONLY these five combinations qualify for a counter_type flag. If the confirmed type's instinct combination is not one of the five above, do NOT emit a counter_type flag — no matter how intense, crusading, or instinct-flavored the language is, and regardless of any other signal. A non-listed combination (e.g. SX + Type 7) is an instinct flavor of the type, NOT a counter-type, and must not raise the flag.

CRITICAL: When a counter-type is confirmed, the standard type description may not resonate with the client. Do NOT treat low resonance with the standard description as a redirect signal when a counter-type is confirmed.

Check 5 — Final Open Response
If final_open_response is present and non-trivial, classify it into one of four buckets:

SELF_TYPING — Client claims or implies a specific type. Triggers include:
  - Explicit: "I think I'm a Type 4", "I'm probably a 9", "I've always tested as a 2"
  - Authority-attributed: "My therapist says I'm a 6", "Everyone tells me I'm a Three"
  - Descriptive paraphrase: "I think I'm the type that needs everything to be perfect" (→ Type 1), "I'm probably the most chill type" (→ Type 9)
  - When a descriptive paraphrase is ambiguous across multiple types, classify as CONTEXTUAL rather than forcing a SELF_TYPING classification with an uncertain type.

  Engine behavior for SELF_TYPING:
  - Extract or map the claimed type to a type number
  - Set client_self_typed: true and client_self_typed_type: N
  - EXCLUDE this claim from the coherence read — do not let it influence the hypothesis
  - Compare claimed type against the confirmed hypothesis (match or mismatch)
  - Surface in the Task 4 client narrative and the Task 5 Section 1 Going In bullets

CONTEXTUAL — Useful life context that may inform interpretation. Examples: "I'm going through a divorce", "I'm autistic", "I grew up in a very religious household", "I'm currently in therapy", "I recently lost my job."

  Engine behavior for CONTEXTUAL:
  - Hold as background context for the coherence read
  - Weight lightly — can add nuance to an existing read but cannot drive a type change on its own
  - If it creates tension with the structured data, note it
  - Surface in the Task 5 Section 1 Going In bullets if relevant to the debrief

NOISE — Off-topic, irrelevant, or trivially short. Examples: "I love hiking", "this was hard", "my dog's name is Max", "not sure".

  Engine behavior for NOISE:
  - Ignore entirely
  - Do not surface anywhere in output
  - Do not raise any flags

EMPTY — Client left it blank or skipped.

  Engine behavior for EMPTY:
  - Ignore entirely, no processing, no flags

Verdict — set the judgment fields
confirmed_type is normally the leading_candidate. It changes ONLY on a REDIRECT, where the Stage 4 evidence favored the alternate: in that case set confirmed_type to the alternate_candidate and set redirect_from_type to the original leading_candidate. Otherwise redirect_from_type is null.

CRITICAL — which type is "the alternate" on a REDIRECT: when stage4_outcome is REDIRECT, you have just confirmed the type that was the alternate_candidate, and the engine then moves the displaced original leader into alternate_candidate after you return. So on a REDIRECT, the alternate type hypothesis — the runner-up to hold lightly, the one a coach raises if the client pushes back — is redirect_from_type, NOT alternate_candidate (which on a REDIRECT still names the type you just confirmed). For every prose field that names or describes the alternate type (Section 6 pushes_back alt_type_name and key_distinction, and any secondary-type discussion), treat redirect_from_type as the alternate. On all non-REDIRECT outcomes, alternate_candidate is the alternate as usual. Set confirmed_type_name to the canonical name of confirmed_type. Set hypothesis_validated true when the leading hypothesis cohered and held, false when it did not (a REDIRECT, or a coherence read that undercut it). Set dominant_instinct_hypothesis from the three-instinct profile and the Call #1 dominant instinct; if the top two instincts are within a point or two, do not force a winner — name your best read and raise low_instinct_confidence. Record the holistic read in holistic_analysis (stage0_coherence, cross_stage_consistency, instinct_coherence, alternative_type_signal, confidence_adjustment), each citing specific evidence.

TASK 2 — Identify and Describe Flags
The flag enum is CLOSED — use ONLY the flag_type values below and never invent a flag type. Note each that is present and describe it specifically, never generically. Quote the client's actual words where relevant. Only flag what is genuinely present; do not manufacture flags for a clean result.

FLAG TYPES:

counter_type — The instinct + type combination is one of the five known counter-types listed in Check 4 (SP+3, SX+6, SP+4, SX+1, SO+7) — and ONLY one of those five. Describe which combination, the expected presentation, and how the open-text language confirms it. Never raise this flag for a combination outside that closed list.

lookalike_ambiguity — Two types remain close after Stage 3/4, or ambiguous answers persisted. Describe which pair, the distinguishing dimension, and the probe that would resolve it in session.

stage0_contradiction — Stage 0 / open-response language points toward a different type than the leading hypothesis. Quote the specific words and name the type they suggest.

ranking_override — AI Call #1 promoted a type above the raw slider leader. The ranking_override line in the case file is pre-resolved ground truth: raise this flag when it says YES, and describe which type was promoted over which slider leader and how the open-text or framework evidence supports the promotion. Do NOT raise it when the line says NO.

stage4_stress_unrecognized — The stress-point answer didn't match the leading type. Describe which type the client answered toward and what that might indicate.

stage4_security_unrecognized — The security-point answer didn't match the leading type. Describe what this might indicate.

stage4_habit_unrecognized — The Habit-of-Mind answer aligned more with the alternate than the leading type.

stage4_redirect — Stress and security both favor the alternate; the hypothesis is reopened. Describe the specific mismatch.

low_instinct_confidence — The top two instinct scores are too close to name a dominant instinct with confidence.

TASK 3 — Confidence
Set confidence_level. The Stage 4 outcome gives a starting point; you may move from it based on the coherence read, but state your reasoning in holistic_analysis.confidence_adjustment.
  CONFIRMED → start at HIGH
  CONFIRMED_WITH_NOTE → start at MEDIUM_HIGH
  AMBIGUOUS → start at LOW
  REDIRECT → start at LOW
AMBIGUOUS and REDIRECT are first-class, honest outcomes. On AMBIGUOUS, do not present a confident single-type verdict — the client is better served by an invitation to a session than by false confidence.

TASK 4 — Client-Facing Content (written now, with confidence and flags already fixed)
Produce four AI-generated fields and a what_to_explore list. These go in the client_facing object.

Per §9.3, the client sees two candidates: the leading hypothesis and the alternate (secondary_type_narrative). NEVER name or present the third candidate to the client. Two candidates can read as more confident than three — keep the "these are hypotheses to test in your life" framing throughout so the read never sounds oracular.

FIELD 1 — client_narrative
3-4 sentence paragraph opening with what is specific about THIS client — their particular words, the texture of their answers, what you noticed that felt distinct.

CRITICAL: Do NOT open with "Based on your responses..." — begin with the client, their language, what stood out. Use their Stage 0 words directly.

If Stage 4 outcome is AMBIGUOUS: do not name a type. Instead invite: "Your responses reflect a genuinely complex pattern — one that resonates with more than one Enneagram type in meaningful ways. Rather than offering a premature hypothesis, we'd like to invite you into a conversation with your Enneagram coach or practitioner where this complexity can be explored properly."

SELF-TYPING COMPARISON (add as a second paragraph to client_narrative when client_self_typed is true):

When the claimed type MATCHES the engine's confirmed hypothesis:
"You mentioned that you suspected you might be a [Type N] — and the patterns we noticed in your responses agree. That alignment is its own piece of useful self-knowledge to bring to your session."

When the claimed type DOES NOT MATCH the engine's confirmed hypothesis:
"You mentioned that you thought you might be a [claimed type] — that's worth honoring as a starting point, because you know your inner life in a way no assessment can. What we noticed in your responses points more toward a [confirmed type] pattern: [one or two specific evidence points from their actual responses, in plain language, no framework jargon]. We'd offer this for you to consider rather than to correct what you brought — type discovery is a journey, and you remain the final authority on your own type. A session with your Enneagram coach or practitioner is the right place to sit with both possibilities."

When the final_response_classification was CONTEXTUAL and contained a self-description paraphrase that was too ambiguous to classify as SELF_TYPING:
"You shared a description of what you thought your type might be. That self-observation is worth holding. What we noticed in your responses points toward [confirmed type]: [brief evidence]. We'd offer that for you to consider, and the gap between what you described and what we found is a great thing to explore with your Enneagram coach or practitioner."

Rules for this paragraph:
- Always use invitational voice — never corrective
- Always include the explicit statement that the client is the final authority on their own type (except for the MATCH case, where it is not needed)
- Never use framework jargon (no stage numbers, no Hornevian, no Harmonic, etc.)
- Reference specific evidence from their Stage 0 language, not generic type descriptions
- Refer to the practitioner generically as "your Enneagram coach or practitioner" — do not name Cai or Monique

Paragraph length rule: For every AI-generated client-facing field (client_narrative, core_motivation_evidence, instinct_personal_overlay, secondary_type_narrative, and the self-typing comparison paragraph), insert a paragraph break (\n\n) at every natural topic transition. No paragraph should exceed 4 sentences. If a thought runs longer than 4 sentences, find the most natural break point and split it. This applies without exception — short paragraphs are always preferable to long ones in this context.

FIELD 2 — core_motivation_evidence
3-5 sentences showing how this client's specific responses align with the confirmed type's core motivation. Reference specific Stage 0 language or answer patterns without naming frameworks or stages. Use cautious language: "consistent with," "points toward," "aligns with." Null for AMBIGUOUS or REDIRECT outcomes.

FIELD 3 — instinct_personal_overlay
2-4 sentences describing how the dominant instinct shows up specifically for this client based on their responses. Reference specific answers without naming stages or frameworks. Note ambiguity if instinct confidence is LOW. Null for AMBIGUOUS or REDIRECT outcomes.

FIELD 4 — secondary_type_narrative
3-5 sentences describing the secondary type candidate ONLY if the holistic analysis surfaced a meaningful alternative type signal. Use cautious language. Null if no meaningful secondary type emerged or if outcome is AMBIGUOUS or REDIRECT.

FIELD 5 — stress_point_narrative
2-3 sentences describing the confirmed type's movement toward its stress point. Client-appropriate language, no framework jargon. Framed as a growth insight. Example: "Under significant stress, [Type N]s can move toward Type [X]'s territory — [description of what this looks/feels like and why it matters to recognize]." Null for AMBIGUOUS outcome.

FIELD 6 — security_point_narrative
2-3 sentences describing the confirmed type's movement toward its security point. Client-appropriate language. Example: "When [Type N]s feel genuinely safe and supported, they can access Type [X]'s positive qualities — [description and growth framing]." Null for AMBIGUOUS outcome.

WHAT TO EXPLORE — what_to_explore
Three questions (always), plus a fourth question only when confusion flags are present AND stage4_outcome is not REDIRECT.

Question 1 — Core motivation curiosity: Restate the confirmed type's core motivation in plain English, invite the client to locate it in their life right now, ask what they most want to explore with their coach.

Question 2 — Patterns in context: Ask the client to think of a specific challenge or opportunity they're currently facing and notice how their thinking, feeling, and behavior patterns show up there. Frame around whether those patterns are helping, getting in the way, or both.

Question 3 — Strengths and challenges: Provide the client's key strengths and challenges (comma-separated from the type), invite them to choose one they'd most like to bring more of or work on, and ask why.

Question 4 (conditional — include ONLY when confusion flags exist and outcome is not REDIRECT) — Type confusion observation: "An invitation to observe yourself this week." Describe the two types in question. State the core motivation of each. Ask the client to notice which feels closer in challenging moments this week.

FIELD 7 — instinct_evidence
For the client report's "In Your Responses" box (Page 6): exactly 3 short bullets, ≤25 words each, each naming a SPECIFIC piece of the client's own responses that shows their dominant instinct (SP/SO/SX) at work. Plain language, no stage/framework jargon. Distinct from FIELD 3 instinct_personal_overlay (a 2-4 sentence narrative) — these are crisp, evidence-pointing bullets for a different page. Set to null when the low_instinct_confidence flag is present (instinct genuinely uncertain); otherwise always exactly 3 bullets.

TASK 5 — Coach Prep Report
Produce a structured coach_report JSON object. This report is for Cai and Monique, not the client. Use coaching-oriented, Enneagram-literate language. Assume deep system knowledge. Write in second or third person about the client consistently throughout (use "she," "he," "they," or "the client" — pick one based on Stage 0 language clues, defaulting to "they" if unclear).

Per §9.4, the coach report shows a coherence bar graph of all nine types. That graph is rendered downstream from the call1_ranking field — do NOT describe, narrate, or reproduce it in any prose field. The third_candidate is reasoning context that a coach may raise as a debrief move; never present it as a conclusion.

THE BOTTOM LINE — bottom_line
One short paragraph (2-3 sentences) giving the plain-English bottom line for the coach: who this client most likely is and the single most important thing to hold going into the debrief. No jargon, no scores, no framework language. This is distinct from section1.the_read — the_read is the fuller 4-6 sentence read; bottom_line is the one-breath summary. Always present: on AMBIGUOUS, state plainly that the pattern is genuinely complex and points to a session rather than a single type.

SECTION 1 — Your Read on This Client
the_read: 4-6 sentence plain-English read of this client, anchored firmly in their Stage 0 language. What jumped out? What does the overall pattern feel like? What's the most important thing to know going in?
going_in: 3-5 bullets on confidence framing, what the client may recognize vs. resist, and any flagged concerns (counter-type, lookalike, redirect). Additionally include when relevant:
  - If client_self_typed is true: "The client indicated they thought they were a Type [N]. The engine [confirmed / did not confirm] this — worth noting before you open the debrief."
  - If final_response_classification is CONTEXTUAL: "The client shared something worth knowing going in: [contextual note]. Hold this as background context for the session."

SECTION 1A (produce only when the counter_type flag is present, otherwise set to null)
why_this_matters: 3-4 bullets on why counter-type framing matters for this debrief
standard_vs_counter: 3-4 bullets on how standard and counter-type presentations differ for this combination, what they share, and the distinguishing motivation
coaching_notes: 2-3 bullets on how to introduce counter-type framing without destabilizing the client's recognition

SECTION 2 — Debriefing Core Motivation and Worldview
core_pattern: 3-4 bullets on the type's worldview and core motivation, written as coaching orientation (not a Wikipedia summary — written for someone who knows this system well)
what_responses_showed: 3-4 bullets citing specific Stage 0 language and answer patterns as evidence for the core motivation hypothesis. Additionally include when relevant:
  - If final_response_classification is CONTEXTUAL and directly relevant to type interpretation: "The client mentioned [contextual note] in their open response. This is held lightly as background — it informed the holistic read but did not drive the type hypothesis."
coaching_notes: 2-3 bullets on how to present the worldview, what order, what to watch for
probe: One question the coach can ask to open the worldview conversation. Format as "Try asking: [question]"

SECTION 3 — Debriefing Patterns of Thinking, Feeling, and Behaving
hardest_to_see: 2-3 bullets on the core emotional habit or shadow that is most likely outside this client's current awareness, with specific evidence from the assessment
framework_signals: Array of exactly 3 objects, one per cross-referencing framework, in this order: Hornevian (label "Social Style — [bucket name]"), Harmonic (label "Emotional Style — [bucket name]"), Object Relations (label "Attachment Style — [bucket name]"). Each object has:
  - label: the framework + result label
  - bullets: 3 bullets about what this pattern means for THIS client specifically
  - probe: one "Weave in:" question for the debrief conversation
coaching_notes: 2-3 bullets on pacing, tone, and what to watch for when walking through patterns
probe: One body-based probe. Format as "Try asking: [question]"

PAGE-3 DEBRIEF BULLET TARGET — FORMAT GUIDANCE for sections 4 and 5:
The coach report's Page 3 is a practitioner debrief laid out as THREE stacked bands, each a two-column list of bullets at 9.5pt: a "Subtype" band (section 4's how_instinct_shapes + easy_to_miss + coaching_notes, merged), a "Lines" band (section 5's stress_notes + security_notes, merged), and a "Wings" band (section 5's wings_notes). Aim each band toward roughly 6 bullets totaling about 130 words. Write each bullet as ONE coaching point of about 16–18 words (≤ 2 lines), front-loading the key idea. Favor substantive, specific bullets — if a band genuinely has fewer than 6 useful points, write fewer rather than padding.

SECTION 4 — Debriefing Instinct and Subtype
subtype_name: Full subtype name (e.g. "SP Nine — The Self-Preservation Peacemaker")
how_instinct_shapes: 3-4 bullets on how the dominant instinct shapes this type's presentation for THIS client — coaching-perspective bullets drawn from subtype knowledge
easy_to_miss: 3-4 bullets on why this subtype can be hard to spot, what the typical misread is
coaching_notes: 2-3 bullets on how to surface the instinct in conversation
probe: One question to help surface the instinct. Format as "Try asking: [question]"

SECTION 5 — Debriefing Wings, Lines, and Resources
stress_notes: 3 bullets on the stress point movement — what it looks like for this type, what this client's Stage 4 stress answer showed, coaching angle
stress_probe: One question. Format as "Try asking: [question]"
security_notes: 3 bullets on the security movement — what it looks like, what this client's answer showed, coaching angle
security_probe: One question. Format as "Try asking: [question]"
wings_notes: 6 bullets about the two wings for this type — what each brings, how to let the client lead, what to watch for
probe: One question to open the wings conversation. Format as "Try asking: [question]"

SECTION 6 — If the Conversation Goes Sideways
resonates_strongly: bullets (2-3) on what to do when client strongly agrees — how to move from recognition to commitment + probe
pushes_back: bullets (3-4) on how to handle pushback — do not defend the hypothesis, name the most likely alternate type with the key distinguishing question
confused: bullets (2-3) on how to work with confusion — find the foothold, treat what doesn't fit as equally useful + probe

For pushes_back, include these two fields separately (on a REDIRECT, "the alternate" here is redirect_from_type, not alternate_candidate — see the REDIRECT rule in Task 1):
  alt_type_name: the alternate type named as a string (e.g. "Type 1 — The Improver")
  key_distinction: one sentence stating the key distinguishing question between the confirmed type and the alternate type

SECTION 6A (produce only when type-confusion flags are present AND stage4_outcome is not REDIRECT, otherwise set to null. Confusion flags: lookalike_ambiguity, ranking_override, or AMBIGUOUS outcome)
types_in_question: string describing both types being explored (e.g. "Type 9 and Type 1")
what_to_do: 3-4 bullets on how to debrief the type confusion observation — what data to bring in, what to listen for, how to hold both possibilities
if_no_data: 2-3 bullets noting what type-specific access challenges might explain the ambiguity — why certain types are harder to confirm through self-report alone
probe: One question to use when the confusion observation didn't yield clarity. Format as "Try asking: [question]"

TASK 6 — Verbatim Client Words (client_words)
Select the client's own words to quote in both reports. These are VERBATIM selections — copy the client's exact text; never paraphrase, summarize, correct, or edit it. Pull ONLY from the client's open responses in the case file (the Stage 0 and Stage 1 open answers).
leading_quotes: 1-2 short quotes (≤60 words total across all quotes) that best capture the language pointing toward the confirmed/leading type. Copy each quote character-for-character from the client's responses. If you must trim for length, trim only at a natural boundary and never alter the words you keep. Always produce at least one quote.
alternate_absence_note: One brief sentence noting that the client's language shows little or no signal for the alternate type. Set to null when stage4_outcome is AMBIGUOUS (no single leading type to contrast against).
This client_words object is a top-level sibling of client_facing and coach_report — not nested inside either.
`;

const OUTPUT_FORMAT = `CRITICAL: Return your complete analysis as a single JSON object. Do not include any text, explanation, markdown formatting, or code fences outside the JSON object. The application parses this response directly — any non-JSON content will cause a parsing failure.

{
  "hypothesis": {
    "confirmed_type": <integer 1-9 — Call #2 final verdict; may differ from leading_candidate only on a REDIRECT>,
    "confirmed_type_name": <string>,
    "confidence_level": <"HIGH" | "MEDIUM_HIGH" | "MEDIUM" | "LOW">,
    "leading_candidate": <integer 1-9 — position 1 of the AI Call #1 coherence ranking>,
    "alternate_candidate": <integer 1-9 — position 2 of the AI Call #1 coherence ranking>,
    "third_candidate": <integer 1-9 — position 3; reasoning context only, NOT shown in either report>,
    "call1_ranking": [{"type": <integer 1-9>, "score": <integer 0-100>}, ... 9 objects, rank-descending, from the AI Call #1 result],
    "type_score_profile": {"1": <0-100>, "2": <0-100>, "3": <0-100>, "4": <0-100>, "5": <0-100>, "6": <0-100>, "7": <0-100>, "8": <0-100>, "9": <0-100>},
    "instinct_score_profile": {"SP": <0-100>, "SO": <0-100>, "SX": <0-100>},
    "dominant_instinct_hypothesis": <"SP" | "SO" | "SX">,
    "ranking_override": <boolean — true when the AI Call #1 ranking departed from raw slider order (a type was promoted)>,
    "stage4_outcome": <"CONFIRMED" | "CONFIRMED_WITH_NOTE" | "AMBIGUOUS" | "REDIRECT">,
    "redirect_from_type": <integer 1-9 or null>,
    "hypothesis_validated": <boolean>
  },
  "flags": [
    {
      "flag_type": <"counter_type" | "lookalike_ambiguity" | "stage0_contradiction" | "ranking_override" | "stage4_stress_unrecognized" | "stage4_security_unrecognized" | "stage4_habit_unrecognized" | "stage4_redirect" | "low_instinct_confidence">,
      "description": <string — specific, cites evidence, 1-2 sentences>
    }
  ],
  "stage0_analysis": {
    "idealization_match": <boolean>,
    "shadow_match": <boolean>,
    "notable_language": <string — specific words from Stage 0, 1-2 sentences>
  },
  "stage2_analysis": {
    "hornevian_result": <string>,
    "harmonic_result": <string>,
    "object_relations_result": <string>,
    "framework_alignment": <"ALIGNED" | "PARTIAL" | "DIVERGENT">
  },
  "stage4_analysis": {
    "stress_point_description": <string — what the client answered and what it suggests>,
    "security_point_description": <string — what the client answered and what it suggests>,
    "habit_of_mind_description": <string or null>
  },
  "holistic_analysis": {
    "stage0_coherence": <string — specific observation with evidence>,
    "cross_stage_consistency": <string — specific observation with evidence>,
    "instinct_coherence": <string — specific observation with evidence>,
    "alternative_type_signal": <string or null — if present, name type and cite evidence>,
    "confidence_adjustment": <string — reasoning or confirmation>
  },
  "client_facing": {
    "client_narrative": <string — 3-4 sentences, warm, specific, uses client's Stage 0 words, does NOT open with "Based on your responses...">,
    "core_motivation_evidence": <string or null — 3-5 sentences connecting client's specific responses to confirmed type's core motivation. Null for AMBIGUOUS or REDIRECT.>,
    "instinct_personal_overlay": <string or null — 2-4 sentences on dominant instinct as seen in client's specific responses. Null for AMBIGUOUS or REDIRECT.>,
    "secondary_type_narrative": <string or null — 3-5 sentences on secondary type if holistic analysis surfaced meaningful alternative signal. Null if none.>,
    "stress_point_narrative": <string or null — 2-3 client-appropriate sentences on confirmed type's stress movement. Null for AMBIGUOUS.>,
    "security_point_narrative": <string or null — 2-3 client-appropriate sentences on confirmed type's security movement. Null for AMBIGUOUS.>,
    "what_to_explore": [<string q1>, <string q2>, <string q3>],
    "instinct_evidence": <[<string>, <string>, <string>] or null — exactly 3 bullets, ≤25 words each, client-specific instinct evidence; null on low_instinct_confidence>
  },
  "coach_report": {
    "bottom_line": <string — 1 short paragraph (2-3 sentences), plain-English summary of the finding; no jargon, no scores. Distinct from section1.the_read.>,
    "section1": {
      "the_read": <string — 4-6 sentence paragraph, plain-English, anchored to Stage 0 language>,
      "going_in": [<string bullet>, ...]
    },
    "section1a": <null or {
      "why_this_matters": [<string bullet>, ...],
      "standard_vs_counter": [<string bullet>, ...],
      "coaching_notes": [<string bullet>, ...]
    }>,
    "section2": {
      "core_pattern": [<string bullet>, ...],
      "what_responses_showed": [<string bullet>, ...],
      "coaching_notes": [<string bullet>, ...],
      "probe": <string — "Try asking: [question]">
    },
    "section3": {
      "hardest_to_see": [<string bullet>, ...],
      "framework_signals": [
        {
          "label": <string — e.g. "Social Style — Withdrawing">,
          "bullets": [<string bullet>, ...],
          "probe": <string — "Weave in: [question]">
        }
      ],
      "coaching_notes": [<string bullet>, ...],
      "probe": <string — "Try asking: [body-based question]">
    },
    "section4": {
      "subtype_name": <string — e.g. "SP Nine — The Self-Preservation Peacemaker">,
      "how_instinct_shapes": [<string bullet>, ...],
      "easy_to_miss": [<string bullet>, ...],
      "coaching_notes": [<string bullet>, ...],
      "probe": <string — "Try asking: [question]">
    },
    "section5": {
      "stress_notes": [<string bullet>, ...],
      "stress_probe": <string — "Try asking: [question]">,
      "security_notes": [<string bullet>, ...],
      "security_probe": <string — "Try asking: [question]">,
      "wings_notes": [<string bullet>, ...],
      "probe": <string — "Try asking: [question]">
    },
    "section6": {
      "resonates_strongly": {
        "bullets": [<string bullet>, ...],
        "probe": <string>
      },
      "pushes_back": {
        "bullets": [<string bullet>, ...],
        "alt_type_name": <string — e.g. "Type 1 — The Improver">,
        "key_distinction": <string — one sentence stating the key distinguishing question>
      },
      "confused": {
        "bullets": [<string bullet>, ...],
        "probe": <string>
      }
    },
    "section6a": <null or {
      "types_in_question": <string — e.g. "Type 9 and Type 1">,
      "what_to_do": [<string bullet>, ...],
      "if_no_data": [<string bullet>, ...],
      "probe": <string — "Try asking: [question]">
    }>
  },
  "client_words": {
    "leading_quotes": [<string — VERBATIM client quote copied exactly from an open response, never edited>, ...1-2 quotes, ≤60 words total],
    "alternate_absence_note": <string or null — brief note that the client's language shows little/no signal for the alternate type; null on AMBIGUOUS>
  },
  "final_response": {
    "present": <boolean>,
    "classification": <"SELF_TYPING" | "CONTEXTUAL" | "NOISE" | "EMPTY">,
    "client_self_typed": <boolean>,
    "client_self_typed_type": <integer or null>,
    "client_self_typed_match": <boolean or null>,
    "contextual_note": <string or null>
  }
}`;

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

async function sendEmails(intake, result, clientPdfPath, coachPdfPath, opts = {}) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('[email] SENDGRID_API_KEY is not set — email not sent');
  }
  if (!process.env.SENDGRID_FROM_EMAIL) {
    throw new Error('[email] SENDGRID_FROM_EMAIL is not set — email not sent');
  }
  const h = result.hypothesis;
  const typeName = (h.confirmed_type_name || '').replace(/^Type\s*\d+\s*[—–-]+\s*/i, '').trim() ||
    { 1: 'The Improver', 2: 'The Giver', 3: 'The Performer', 4: 'The Idealist',
      5: 'The Observer', 6: 'The Questioner', 7: 'The Enthusiast', 8: 'The Protector',
      9: 'The Peacemaker' }[h.confirmed_type] || '';

  const fromEmail  = process.env.SENDGRID_FROM_EMAIL;
  const coachEmail = intake.coach_email;
  const assessmentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

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
    replyTo: { name: esc(intake.coach), email: intake.coach_email },
    subject: `Your InsightOut Enneagram Report`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1A2B33; line-height: 1.7;">
        <div style="border-top: 4px solid #00b1d7; padding-top: 28px; margin-bottom: 24px;">
          <h1 style="font-size: 22px; color: #00b1d7; margin: 0; font-weight: 700;">Your InsightOut Enneagram Report is Ready!</h1>
        </div>

        <p style="font-size:15px;">Hi ${esc(intake.firstName)},</p>

        <p style="font-size:15px;">Thank you for completing your InsightOut Enneagram Assessment. Your personalized report is attached to this email.</p>

        <p style="font-size:15px;">Your report reflects the responses you shared and offers a starting point for understanding your Enneagram type. I encourage you to hold the findings lightly — think of them as a hypothesis worth exploring, not a final verdict.</p>

        <p style="font-size:15px;">I am happy to debrief your report with you to unpack what resonates, what doesn't quite fit, and where you'd like to go deeper. If you haven't already, feel free to reach out to book a debrief session with me.</p>

        <p style="font-size:15px;color:#333333;margin:24px 0 4px 0;">${esc(intake.coach)}</p>
        ${intake.coach_organization ? `<p style="font-size:15px;color:#333333;margin:0 0 4px 0;">${esc(intake.coach_organization)}</p>` : ''}
        <p style="font-size:15px;color:#333333;margin:0 0 24px 0;"><a href="mailto:${intake.coach_email}" style="color:#00b1d7;text-decoration:none;">${esc(intake.coach_email)}</a></p>

        <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #E0E8EC; font-size: 11px; color: #7A96A6;">
          This report was generated by the InsightOut Enneagram Assessment. © 2026 Hive, Inc. All rights reserved.
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
          This report was generated by the InsightOut Enneagram Assessment. © 2026 Hive, Inc. All rights reserved. For internal use only.
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

  // Send client email — throws on failure.
  try {
    await sgMail.send(clientMsg);
    console.log(`[email] client email sent to ${intake.email}`);
  } catch (e) {
    const detail = e.response && e.response.body ? JSON.stringify(e.response.body) : e.message;
    throw new Error(`[email] client email failed to ${intake.email}: ${detail}`);
  }

  // Send coach email — throws on failure.
  try {
    await sgMail.send(coachMsg);
    console.log(`[email] coach email sent to ${coachEmail}`);
  } catch (e) {
    const detail = e.response && e.response.body ? JSON.stringify(e.response.body) : e.message;
    throw new Error(`[email] coach email failed to ${coachEmail}: ${detail}`);
  }
}

// =================== PDF REPORT GENERATION HELPER ===================

async function generateReportPDFs(result, scores, intake, assessmentId) {
  // Step 7 Phase 7a: new pipeline (report_prep -> Part B/C renderer -> measurement
  // gate w/ deterministic self-heal). US Letter. V1 buildClientHTML/buildCoachHTML retired.
  const pdfOpts = buildCoachPdfOptions();
  const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const client = { first_name: intake.firstName, last_name: intake.lastName, organization: intake.organization, date: reportDate };
  const coach = { full_name: intake.coach || 'Cai Delumpa', type: null, instinct: null };  // type/instinct: B4 placeholder
  let clientPdfPath = null;
  let coachPdfPath  = null;

  // Tie each PDF to its assessment row so retakes never collide on the Railway
  // Volume — a same-day retake produces a distinct file (generatePDF also appends
  // a millisecond timestamp). Skipped only if assessmentId is somehow absent.
  const idSuffix = assessmentId ? `_${assessmentId}` : '';

  try {
    // await required: render pipeline loads content_overrides from DB
    const { html } = await renderClientReport({ apiResult: result, client, coach });
    clientPdfPath = await generatePDF(html, `client_${intake.firstName}_${intake.lastName}${idSuffix}`, pdfOpts);
    console.log(`[pdf] client PDF generated: ${clientPdfPath}`);
    if (assessmentId) await db.createReport(assessmentId, 'client', clientPdfPath);
  } catch (e) {
    console.error('[pdf] client PDF generation failed:', e.message);
  }

  try {
    // await required: render pipeline loads content_overrides from DB
    const { html } = await renderCoachReport({ apiResult: result, client, coach });
    coachPdfPath = await generatePDF(html, `coach_${intake.firstName}_${intake.lastName}${idSuffix}`, pdfOpts);
    console.log(`[pdf] coach PDF generated: ${coachPdfPath}`);
    if (assessmentId) await db.createReport(assessmentId, 'coach', coachPdfPath);
  } catch (e) {
    console.error('[pdf] coach PDF generation failed:', e.message);
  }

  return { clientPdfPath, coachPdfPath };
}

// A2: EM Lab re-run PDF generation. Mirrors generateReportPDFs but (1) uses the
// rerun_*_<assessmentId>_<timestamp>.pdf naming convention so the files are visibly
// distinct from production PDFs, and (2) NEVER calls db.createReport — these PDFs are
// recorded only on em_rerun_reports and surfaced only inside EM Lab, never on the
// dashboard. PDF failures are non-fatal: the caller has already persisted the re-run
// result, so a render failure must not lose it.
async function generateRerunReportPDFs(result, intake, assessmentId) {
  const pdfOpts = buildCoachPdfOptions();
  const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  const client = { first_name: intake.firstName, last_name: intake.lastName, organization: intake.organization, date: reportDate };
  const coach = { full_name: intake.coach || 'Cai Delumpa', type: null, instinct: null };
  let clientPdfPath = null;
  let coachPdfPath  = null;
  let ok = true;

  try {
    const { html } = await renderClientReport({ apiResult: result, client, coach });
    clientPdfPath = await generatePDF(html, `rerun_client_${assessmentId}`, pdfOpts);
    console.log(`[em-lab/rerun-pdf] #${assessmentId} client PDF generated: ${clientPdfPath}`);
  } catch (e) {
    ok = false;
    console.error(`[em-lab/rerun-pdf] #${assessmentId} client PDF generation failed:`, e.message);
  }

  try {
    const { html } = await renderCoachReport({ apiResult: result, client, coach });
    coachPdfPath = await generatePDF(html, `rerun_coach_${assessmentId}`, pdfOpts);
    console.log(`[em-lab/rerun-pdf] #${assessmentId} coach PDF generated: ${coachPdfPath}`);
  } catch (e) {
    ok = false;
    console.error(`[em-lab/rerun-pdf] #${assessmentId} coach PDF generation failed:`, e.message);
  }

  return { clientPdfPath, coachPdfPath, pdf_generated: ok };
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
      // D6: persist Call #2 token usage in the result's meta block so it lands in
      // assessments.api_result. response.usage is only in scope here (inside the
      // retry helper), so usage is attached to the returned result rather than in
      // runBackgroundJob; the unchanged api_result write then persists it.
      result.meta = result.meta || {};
      result.meta._usage = {
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
        cache_read_input_tokens: response.usage?.cache_read_input_tokens ?? null,
        cache_creation_input_tokens: response.usage?.cache_creation_input_tokens ?? null,
      };
      console.log(`[claude] success — attempt ${attempt}, confirmed_type=${result?.hypothesis?.confirmed_type}, confidence=${result?.hypothesis?.confidence_level}`);
      return result;
    } catch (err) {
      console.error(`[claude] attempt ${attempt} failed:`, err.message);
      if (attempt < 3) await delay(Math.pow(2, attempt) * 1000);
      else throw err;
    }
  }
}

// Resolve the name strings the EM Report Call needs (PR8b R8 — server-side via type_meta
// / content_library, never the client-side maps in assessment.js).
function resolveEmContextFields(emAnalysis, intake) {
  const a = emAnalysis || {};
  const t = a.confirmed_type, alt = a.alternate_candidate, inst = a.dominant_instinct_hypothesis;
  let subtypeName = '';
  try {
    const key = `subtype_${String(inst).toLowerCase()}${t}`;
    subtypeName = (emContentLibrary[key] && emContentLibrary[key].name) || '';
  } catch (e) { subtypeName = ''; }
  if (!subtypeName) subtypeName = `${EM_INSTINCT_NAME[inst] || inst || ''} ${CMS_TYPE_NAMES[t] || ''}`.trim();
  return {
    client_first_name: (intake && intake.firstName) || '',
    client_last_name: (intake && intake.lastName) || '',
    confirmed_type_name: CMS_TYPE_NAMES[t] || a.confirmed_type_name || '',
    alternate_candidate_name: CMS_TYPE_NAMES[alt] || '',
    subtype_name: subtypeName,
    dominant_instinct_name: EM_INSTINCT_NAME[inst] || inst || '',
  };
}

// Mirror of the step-2b stamping — applied ONLY to the dry-validation copy so the EM
// result can be validated against the renderer before commit. The real result is stamped
// by the existing untouched 2b block after step 2 (kept byte-identical).
function _stampScoresForDryValidate(h, scores) {
  const c1 = (scores && scores.call1Result) || {};
  if (typeof scores.ranking_override === 'boolean') h.ranking_override = scores.ranking_override;
  // em_only: EM owns the type hypothesis — do NOT overwrite leading_candidate or alternate_candidate
  // with Call #1's. (Call #1 runs only to gate Stage 3 routing; its ranking is not authoritative for
  // the type hypothesis in em_only.) This helper is em_only-only, so both overwrites are dropped.
  if (c1.third_candidate != null) h.third_candidate = c1.third_candidate;
  // em_only: keep EM's em_ranking (adapter-set) so the coach chart matches the EM hypothesis;
  // fall back to Call #1's ranking only if EM provided none. (Helper is em_only-only.)
  if (Array.isArray(c1.ranking) && !(Array.isArray(h.call1_ranking) && h.call1_ranking.length)) h.call1_ranking = c1.ranking;
  if (scores.typeProfile) h.type_score_profile = scores.typeProfile;
  if (scores.instinctProfile) h.instinct_score_profile = scores.instinctProfile;
  if (scores.stage4 && scores.stage4.outcome) h.stage4_outcome = scores.stage4.outcome;
  if (scores.gap != null) h.gap = scores.gap;
}

// EM-primary report path (PR8b, B1). EM Analysis -> EM Report -> adapter, then DRY-VALIDATES
// against the real renderer prep (buildCoachModel + buildClientModel THROW on a contract
// failure) BEFORE returning. Returns the adapted (un-stamped) api_result on success, or
// null on ANY failure so runBackgroundJob falls back to SM's Call #2 (C1). C5: report call
// is always Opus (client-facing); analysis uses Opus only when em_model='opus'.
async function runEmPrimary({ assessmentId, clientId, scores, intake, responsesSnapshot, emModel }) {
  try {
    const callClaude = async ({ model, max_tokens, system, user }) => {
      const response = await client.messages.create({
        model, max_tokens,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      });
      return { text: response.content[0].text, usage: response.usage };
    };

    const analysisModelId = (emModel === 'opus') ? experimentalAnalysis.EM_MODEL_OPUS : experimentalAnalysis.EM_MODEL_SONNET;
    const an = await experimentalAnalysis.runExperimentalAnalysis({ assessmentId, model: analysisModelId, trigger: 'em_only', callClaude, db });
    if (!an || !an.ok || !an.result) { console.warn(`[em][primary] #${assessmentId} analysis call failed`); return null; }

    const contextFields = resolveEmContextFields(an.result, intake);
    const rep = await experimentalAnalysis.runEmReportCall({
      emAnalysis: an.result, responsesSnapshot, contextFields, callClaude, db,
      model: experimentalAnalysis.EM_MODEL_OPUS,   // C5: report is client-facing -> always Opus
    });
    if (!rep || !rep.ok || !rep.result) { console.warn(`[em][primary] #${assessmentId} report call failed`); return null; }

    const adapted = adaptEmToContract(an.result, rep.result, contextFields);

    // DRY-VALIDATE against the real renderer prep BEFORE committing (C1). Stamp a deep copy
    // with the score-profile fields (the real result is stamped by the untouched 2b block
    // after step 2). buildCoachModel/buildClientModel throw on validateModel failure.
    const probe = JSON.parse(JSON.stringify(adapted));
    if (probe.hypothesis) _stampScoresForDryValidate(probe.hypothesis, scores || {});
    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const dvClient = { first_name: intake.firstName, last_name: intake.lastName, organization: intake.organization, date: reportDate };
    const dvCoach = { full_name: intake.coach || 'Cai Delumpa', type: null, instinct: null };
    await reportPrep.buildCoachModel({ apiResult: probe, client: dvClient, coach: dvCoach });
    await reportPrep.buildClientModel({ apiResult: probe, client: dvClient, coach: dvCoach });
    // Exercise the real renderers too. buildCoachModel/buildClientModel/validateModel check the
    // MODEL, but type mismatches that only surface in the renderer (e.g. instinct_evidence
    // arriving as a string and hitting .map) slip past validateModel — that gap shipped a broken
    // PDF for #45. Rendering both reports here turns a render-level contract failure into
    // null -> SM fallback (C1).
    await renderClientReport({ apiResult: probe, client: dvClient, coach: dvCoach });
    await renderCoachReport({ apiResult: probe, client: dvClient, coach: dvCoach });

    console.log(`[em][primary] #${assessmentId} EM-primary OK — type=${adapted.hypothesis.confirmed_type} (analysis=${analysisModelId}, report=opus)`);
    return adapted;
  } catch (e) {
    console.error(`[em][primary] #${assessmentId} EM-primary failed (falling back to SM):`, e && e.message);
    return null;
  }
}

// Re-Run Analysis eligibility: tag each admin row with em_rerun_eligible — true only for a
// FAILED assessment (scores_snapshot present, api_result NULL) whose resolved analysis mode
// is em_only. Resolution mirrors runBackgroundJob's precedence (assessment override > client
// override > global) so the button matches what would actually run. Computed here rather
// than in the row SQL so the dashboard query stays untouched; only the (rare) failed rows
// are probed, so this is a near no-op for an all-complete dashboard.
async function annotateEmRerunEligibility(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  let appSettings = null;
  try { appSettings = await db.getAppSettings(); } catch (e) { /* null → resolves sm_only */ }
  await Promise.all(rows.map(async (r) => {
    r.em_rerun_eligible = false;
    if (!r.has_scores_snapshot || r.has_api_result || !r.assessment_id) return;
    try {
      const aMode = await db.getAssessmentAnalysisMode(r.assessment_id);
      const cMode = r.client_id ? await db.getClientAnalysisMode(r.client_id) : null;
      const mode = experimentalAnalysis.resolveAnalysisMode({
        assessment: { analysis_mode: aMode }, client: { analysis_mode: cMode }, appSettings,
      });
      r.em_rerun_eligible = (mode === 'em_only');
    } catch (e) { /* leave false on any resolution error */ }
  }));
  return rows;
}

async function runBackgroundJob(systemPrompt, userMessage, intake, scores, assessmentId, clientId, responsesSnapshot, isRetake = false) {
  // 1. Persist scores_snapshot immediately — before the API call — so the
  //    assessment is recoverable even if Claude fails.
  if (assessmentId) {
    await db.query(
      `UPDATE assessments SET scores_snapshot = $1 WHERE id = $2`,
      [JSON.stringify(scores), assessmentId]
    );
  }

  // 1b. Persist responses_snapshot on the ASSESSMENT row (A1) so the raw answers across
  //     every stage are recoverable per assessment — a retake no longer overwrites the
  //     prior take's snapshot. (Was clients.responses_snapshot; that column is deprecated.)
  if (assessmentId && responsesSnapshot) {
    try {
      await db.saveAssessmentSnapshot(assessmentId, responsesSnapshot);
    } catch (e) {
      console.error('[submit] responses_snapshot DB write failed:', e.message);
    }
  }

  // 1c. Resolve the analysis mode ONCE — gates the Call #2 source (em_only) and the Step 8
  //     parallel auto-fire. Fail-safe to sm_only so a resolution error never blocks SM.
  let analysisMode = 'sm_only';
  let emModel = 'sonnet';
  try {
    const appSettings = await db.getAppSettings();
    emModel = (appSettings && appSettings.em_model) || 'sonnet';
    const aMode = assessmentId ? await db.getAssessmentAnalysisMode(assessmentId) : null;
    const cMode = clientId ? await db.getClientAnalysisMode(clientId) : null;
    analysisMode = experimentalAnalysis.resolveAnalysisMode({
      assessment: { analysis_mode: aMode }, client: { analysis_mode: cMode }, appSettings,
    }) || 'sm_only';
  } catch (e) {
    console.error('[em] mode resolution failed; defaulting to sm_only:', e && e.message);
    analysisMode = 'sm_only';
  }

  // 2. Produce the Call #2 verdict + report registers. In em_only, EM is primary
  //    (EM Analysis + EM Report -> adapter -> dry-validated against the renderer), with a
  //    hard fallback to SM's Call #2 if any part fails (C1). All other modes run SM's
  //    Call #2 exactly as before (byte-identical).
  let result;
  try {
    if (analysisMode === 'em_only') {
      result = await runEmPrimary({ assessmentId, clientId, scores, intake, responsesSnapshot, emModel });
      if (!result) {
        console.warn(`[em][primary] #${assessmentId} fell back to SM Call #2 (EM-primary unavailable)`);
        result = await callClaudeWithRetry(systemPrompt, userMessage);   // EXACT existing SM call — fallback (C1)
      }
    } else {
      result = await callClaudeWithRetry(systemPrompt, userMessage);      // sm_only / parallel — unchanged
    }
  } catch (err) {
    await db.failAssessment(assessmentId);
    // Revert client status so the invite link stops showing the processing
    // gate. session_state is already null, so the in_progress branch will
    // render the "contact your coach" dead-end message.
    if (clientId) await db.updateClientStatus(clientId, 'in_progress');
    await sendErrorNotification(intake, err);
    return;
  }

  // 2b. Stamp the deterministic hypothesis fields onto the verdict (§9.1, §10.3) and
  //     apply the REDIRECT fixes (Defects #2/#3/#4). Extracted to app/call2_stamp.js so
  //     the same post-processing is unit-tested and replayed by the fixture runner.
  applyCall2DeterministicStamps(result, scores, analysisMode, assessmentId);

  // 3. Persist api_result now that the call succeeded (A1: write-once — this is the
  //    legitimate first write at completion; the IS NULL guard makes it a no-op if a
  //    result was somehow already frozen, preserving the original).
  if (assessmentId) {
    const wrote = await db.writeApiResultOnce(assessmentId, result);
    if (!wrote) console.warn(`[submit] api_result already set for assessment #${assessmentId} — completion write skipped (frozen)`);
  }

  // 4. Update assessment record with results
  await db.completeAssessment(assessmentId, result);
  if (clientId) {
    await db.updateClientStatus(clientId, 'complete');
    await db.clearClientSessionState(clientId);
  }

  // PR B: lifecycle audit — assessment (or retake) completed. Model/prompt version come
  // from the result meta. Fire-and-forget; logClientEvent swallows its own errors.
  if (clientId) {
    const _m = (result && result.meta) || {};
    const _model = _m.model || _m.em_model || 'unknown';
    const _pv = _m.prompt_version || _m.em_report_prompt_version || _m.em_analysis_prompt_version || 'unknown';
    db.logClientEvent({
      clientId, assessmentId,
      eventType: isRetake ? 'retake_completed' : 'assessment_completed',
      eventDescription: `${isRetake ? 'Retake' : 'Assessment'} completed (model: ${_model}, prompt version: ${_pv})`,
      actor: 'system',
    });
  }

  // 5. Generate PDFs via shared helper
  const { clientPdfPath, coachPdfPath } = await generateReportPDFs(result, scores, intake, assessmentId);

  // 6. Mark PDF generation timestamp
  if (assessmentId) {
    await db.query(
      `UPDATE assessments SET pdf_generated_at = NOW() WHERE id = $1`,
      [assessmentId]
    );
  }

  // 7. Send emails — email_sent_at and report_delivered only stamp on confirmed delivery to both recipients.
  // Security: on this path `intake` arrives via req.body on /api/submit (the SPA posts
  // back the bootstrap it was served), so intake.coach_email / intake.coach_organization
  // are client-supplied and must not be trusted — a tampered payload could redirect the
  // confidential coach prep report. Re-source both from the server-side DB record keyed
  // on the server-resolved clientId (same trusted source the admin flows use). tokenRow
  // is not in scope here, so getClientWithCoach(clientId) is the equivalent lookup.
  if (clientId) {
    const trustedCoach = await db.getClientWithCoach(clientId);
    if (trustedCoach) {
      intake.coach_email        = trustedCoach.coach_email;
      intake.coach_organization = trustedCoach.coach_organization;
    }
  }
  try {
    await sendEmails(intake, result, clientPdfPath, coachPdfPath);
    if (assessmentId) {
      await db.query(
        `UPDATE assessments SET email_sent_at = NOW() WHERE id = $1`,
        [assessmentId]
      );
    }
    if (clientId) {
      db.logClientEvent({
        clientId, assessmentId,
        eventType: isRetake ? 'retake_report_delivered' : 'report_delivered',
        eventDescription: `${isRetake ? 'Retake report' : 'Report'} delivered to client and coach`,
        actor: 'system',
      });
    }
  } catch (e) {
    console.error('[email] report email failed — email_sent_at not stamped:', e.message);
    // Assessment is complete; email failure is logged but does not block the completion flow.
  }

  // 8. Enhanced Mode (EM) auto-fire — PARALLEL MODE ONLY (PR8b R6). Runs after every SM
  //    operation above has committed (api_result, completeAssessment, PDFs, email), so it
  //    can never delay or affect SM. em_only does NOT reach here — EM ran as the primary
  //    path in step 2; firing again would re-run the analysis. The mode is the one resolved
  //    once in step 1c; the block is fully isolated (SM unaffected in every case).
  try {
    if (assessmentId && analysisMode === 'parallel') {
      // Inline Claude adapter (same contract as the manual route's — R4).
      const callClaude = async ({ model, max_tokens, system, user }) => {
        const response = await client.messages.create({
          model,
          max_tokens,
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: user }],
        });
        return { text: response.content[0].text, usage: response.usage };
      };
      // Auto-fire model is driven by app_settings.em_model (captured in step 1c): 'sonnet' /
      // 'opus' fire one; 'sonnet_and_opus' fires both sequentially. Each runExperimentalAnalysis
      // call is fully isolated (returns {ok:false}, never throws) and writes its own
      // em_reliability_log row in that model's columns (Option A — two rows). Order is
      // ['sonnet','opus'] so the Opus result lands last. Manual Run Opus stays available.
      const runModels = emModel === 'opus' ? ['opus']
                      : emModel === 'sonnet_and_opus' ? ['sonnet', 'opus']
                      : ['sonnet'];
      for (const m of runModels) {
        const modelId = m === 'opus' ? experimentalAnalysis.EM_MODEL_OPUS : experimentalAnalysis.EM_MODEL_SONNET;
        const out = await experimentalAnalysis.runExperimentalAnalysis({
          assessmentId,
          model: modelId,
          trigger: 'auto',                             // R2: distinguishes auto vs manual runs
          callClaude,
          db,
        });
        console.log(`[em][auto] assessment #${assessmentId} mode=parallel model=${m} -> ${out && out.ok ? 'ok type=' + (out.result && out.result.confirmed_type) : 'failed: ' + (out && out.error)}`);
      }
    }
  } catch (e) {
    // Absolute isolation: EM must never surface into SM's path.
    console.error(`[em][auto] assessment #${assessmentId} EM block error (SM unaffected):`, e && e.message);
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
  const { contextBlock, intake, scores, client_id: bodyClientId, responses_snapshot: responsesSnapshot } = req.body;
  const systemPrompt = `${SYSTEM_PROMPT}\n\n${TASK_INSTRUCTIONS}`;
  const userMessage  = `${contextBlock}\n\n${OUTPUT_FORMAT}`;
  const intakeInfo = intake ? `${intake.firstName} ${intake.lastName} <${intake.email}>` : 'unknown';
  console.log(`[submit] received from ${intakeInfo} — context ${contextBlock?.length ?? 0} chars`);

  // §9 timing: read the server-stamped start time from session_state BEFORE the
  // lock block clears it, then compute the completion metrics. Submit IS the
  // completion moment (§9.2 phase → processing). elapsed is wall-clock (idle time
  // included, intentional §9.1); session_days = calendar days spanned (same day = 1).
  let timing = null;
  if (bodyClientId) {
    try {
      const c = await db.getClientById(bodyClientId);
      const startedAt = c && c.session_state && c.session_state.assessment_started_at;
      if (startedAt) {
        const completedAt = new Date();
        const startDate = new Date(startedAt);
        const elapsedSeconds = Math.round((completedAt - startDate) / 1000);
        const dayIdx = (d) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
        const sessionDays = (dayIdx(completedAt) - dayIdx(startDate)) + 1;
        timing = { startedAt, completedAt: completedAt.toISOString(), elapsedSeconds, sessionDays };
      }
    } catch (e) {
      console.error('[submit] timing read failed:', e.message);
    }
  }

  // Lock the invite link before responding — must happen before Claude fires so
  // a client returning to their link mid-processing hits the processing gate.
  if (bodyClientId) {
    try {
      await db.updateClientStatus(bodyClientId, 'processing');
      await db.clearClientSessionState(bodyClientId);
    } catch (e) {
      console.error('[submit] processing-status update failed:', e.message);
    }
  }

  res.json({ ok: true, status: 'processing' });

  // Create DB records (fire-and-forget safe — all wrapped in try/catch in db.js)
  let assessmentId = null;
  let resolvedClientId = bodyClientId || null;
  let isRetake = false;
  try {
    if (!resolvedClientId) {
      const coachId = await db.findOrCreateCoach(intake?.coach || 'Cai Delumpa');
      resolvedClientId = await db.createClient(intake || {}, coachId);
      // PR B: lifecycle audit — client created via the self-serve submit fallback (no
      // admin actor available, so 'system').
      if (resolvedClientId) {
        db.logClientEvent({
          clientId: resolvedClientId, assessmentId: null,
          eventType: 'client_created',
          eventDescription: `Client created (self-serve submission)`,
          actor: 'system',
        });
      }
    }
    // Retake linkage: if this client already has an assessment, the row we're about
    // to create is a retake — point retake_of_assessment_id at the most recent prior
    // assessment. First-time clients have no prior row, so this stays null. (The retake
    // flow is the only path that reopens a completed client, so "has a prior" == retake.)
    const priorAssessmentId = resolvedClientId ? await db.getLatestAssessmentId(resolvedClientId) : null;
    isRetake = priorAssessmentId != null;
    assessmentId = await db.createAssessment(resolvedClientId, { systemPrompt, userMessage, intake }, priorAssessmentId);
    if (assessmentId) console.log(`[submit] assessment #${assessmentId} created for client #${resolvedClientId}`);
    // §9 timing: write the computed metrics onto the fresh assessment row. Guarded
    // on a captured start time — if none (client never saved during Stage 0), skip
    // and the admin clock icon stays hidden (gated on elapsed_seconds IS NOT NULL).
    if (assessmentId && timing) {
      await db.updateAssessmentTiming(assessmentId, timing);
      console.log(`[submit] timing: ${timing.elapsedSeconds}s over ${timing.sessionDays} day(s)`);
    }
  } catch (e) {
    console.error('[submit] DB record creation error:', e.message);
  }

  // Fire and forget background job
  (async () => {
    try {
      await runBackgroundJob(systemPrompt, userMessage, intake || {}, scores || {}, assessmentId, resolvedClientId, responsesSnapshot || null, isRetake);
    } catch (e) {
      console.error('[submit] unhandled background job error:', e.message);
    }
  })();
});

// State-at-time-of-assessment (mood/environment section) — valid enum values for the
// two single-selects. Mirrored in the client survey and the admin label maps; the route
// rejects any out-of-set value with a 400.
const VALID_MOOD_AT_TIME = ['calm', 'mildly_stressed', 'emotionally_heavy', 'distracted'];
const VALID_ENVIRONMENT_AT_TIME = ['quiet', 'somewhat_distracted', 'noisy_interrupted'];

// System prompt for the beta state-analysis mini-call (Layer 3). Short, coach-facing,
// plain-text interpretive note — no JSON wrapper.
const BETA_STATE_ANALYSIS_SYSTEM = `You are an assistant helping Enneagram coaches Cai and Mo interpret beta tester data. You will be given a tester's self-reported mood and environment at the time of taking an Enneagram self-assessment, along with the engine's confidence level and gap score for that assessment. Write two to three plain-English sentences that note any connection worth investigating — for example, whether the mood or environment may have influenced the result, or whether the engine's confidence is consistent or surprising given the reported state. Be specific, not generic. Write directly to Cai and Mo. Do not use jargon. Do not hedge excessively.`;

// Beta state-analysis mini-call. Fires non-blocking after a beta survey submission,
// reads the just-submitted mood/environment plus the assessment's engine confidence
// (assessments row) and gap (Call #1 result on the client), and stores a short
// coach-facing note on beta_feedback.state_analysis. Never throws to the caller — the
// survey submission must never fail because of this call. confidence_level/gap may not
// be populated yet at submit time (Call #2 runs in the background job), so each falls
// back to a readable placeholder.
async function runBetaStateAnalysis({ assessmentId, clientId, moodAtTime, environmentAtTime, stateReflectionText }) {
  try {
    let confidenceLevel = null;
    let gap = null;
    try {
      const a = await db.getAssessmentById(assessmentId);
      confidenceLevel = (a && a.confidence_level) || null;
    } catch (e) { console.error('[beta-state-analysis] confidence lookup failed:', e.message); }
    try {
      const c1 = await db.getCall1Result(clientId);
      gap = (c1 && c1.gap) || null;
    } catch (e) { console.error('[beta-state-analysis] gap lookup failed:', e.message); }

    const userMessage = `Tester's mood at time of assessment: ${moodAtTime}
Tester's environment at time of assessment: ${environmentAtTime}
Tester's own reflection: ${(stateReflectionText && stateReflectionText.trim()) || 'None provided'}
Engine confidence level: ${confidenceLevel || 'Not yet available'}
Engine gap: ${gap || 'Not yet available'}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: [{ type: 'text', text: BETA_STATE_ANALYSIS_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = ((response.content[0] && response.content[0].text) || '').trim();
    if (text) {
      await db.updateBetaStateAnalysis(assessmentId, text);
      console.log(`[beta-state-analysis] stored for assessment #${assessmentId}`);
    } else {
      console.warn(`[beta-state-analysis] empty response for assessment #${assessmentId}`);
    }
  } catch (e) {
    console.error('[beta-state-analysis] failed:', e.message);
  }
}

// Beta post-submit feedback (PR-D). Fired by the beta-review screen right after
// /api/submit. No per-route auth — the in-assessment session bypasses basic auth
// via req.session.assessmentClientId (see the global middleware), same as /api/submit.
//
// The frontend only knows client_id; the assessments row is created by /api/submit
// moments earlier (after its response, before its background job), so we resolve the
// latest assessment for this client. A short bounded retry covers the sub-second
// creation race — human fill-time on the review screen makes a miss virtually
// impossible, but the retry is belt-and-suspenders.
//
// CONTRACT for PR-E (/admin/beta-review): Block A per-statement comments have no
// dedicated column — they ride inside flagged_keys JSONB. Each element is
// { key, stageLabel, reconsidered, comment }; PR-E reads the comment from
// flagged_keys[n].comment. self_hypothesis_{types,instincts} use the shape
// { dontKnow: bool, values: [...] }.
app.post('/api/beta-feedback', async (req, res) => {
  const b = req.body || {};
  const clientId = parseInt(b.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ ok: false, error: 'Missing client_id' });

  // Lightweight enum validation for the two state single-selects. Reject any value that
  // is present but out of set; null/absent is allowed (columns are nullable — defensive
  // for callers that don't send the section).
  const moodAtTime = b.mood_at_time ?? null;
  const environmentAtTime = b.environment_at_time ?? null;
  const stateReflectionText = b.state_reflection_text ?? null;
  if (moodAtTime != null && !VALID_MOOD_AT_TIME.includes(moodAtTime)) {
    return res.status(400).json({ ok: false, error: `Invalid mood_at_time: ${moodAtTime}` });
  }
  if (environmentAtTime != null && !VALID_ENVIRONMENT_AT_TIME.includes(environmentAtTime)) {
    return res.status(400).json({ ok: false, error: `Invalid environment_at_time: ${environmentAtTime}` });
  }

  let assessmentId = null;
  for (let attempt = 0; attempt < 4 && !assessmentId; attempt++) {
    assessmentId = await db.getLatestAssessmentId(clientId).catch(() => null);
    if (!assessmentId) await new Promise((r) => setTimeout(r, 500));
  }
  if (!assessmentId) return res.status(404).json({ ok: false, error: 'No assessment found for client' });

  try {
    await db.insertBetaFeedback({
      assessmentId,
      selfHypothesisTypes:     b.selfHypothesisTypes ?? null,
      selfHypothesisInstincts: b.selfHypothesisInstincts ?? null,
      flaggedKeys:             b.flaggedKeys ?? null,
      blockBAnswers:           b.blockBAnswers ?? null,
      overallNotes:            b.overallNotes ?? null,
      // Declared type/instinct (EM ground truth). The frontend doesn't send these
      // directly; insertBetaFeedback derives them from the self-hypothesis above (first
      // type / first instinct). Passing the explicit fields lets a caller override.
      declaredType:            b.declared_type ?? null,
      declaredInstinct:        b.declared_instinct ?? null,
      declaredSubtype:         b.declared_subtype ?? null,
      declarationConfidence:   b.declaration_confidence ?? null,
      // State-at-time-of-assessment (mood/environment section).
      moodAtTime,
      environmentAtTime,
      stateReflectionText,
    });
    console.log(`[beta-feedback] stored for assessment #${assessmentId} (client #${clientId})`);

    // Fire the state-analysis mini-call non-blocking — do NOT await before responding.
    // Survey submission must never fail because of the analysis call (errors are logged
    // inside runBetaStateAnalysis). Only fire when at least mood/environment were given.
    if (moodAtTime || environmentAtTime) {
      runBetaStateAnalysis({ assessmentId, clientId, moodAtTime, environmentAtTime, stateReflectionText })
        .catch((e) => console.error('[beta-state-analysis] unexpected:', e && e.message));
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('[beta-feedback] insert failed:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Stage 0 mini-call — analyzes the four open-text Stage 0 responses to
// produce a soft Enneagram-type signal (2-3 candidate types with rationale).
// Fires from the Mid-Assessment Reminders screen as background latency cover.
// Stores the parsed array (or null on failure) on clients.stage0_signal.
app.post('/api/stage0-signal', async (req, res) => {
  const { client_id, stage0_answers } = req.body || {};
  const a = stage0_answers || {};

  const STAGE0_SYSTEM = `You are an expert Enneagram practitioner analyzing a client's open-ended self-description responses to identify possible Enneagram type patterns. Your task is to identify 2-3 Enneagram types that are most consistent with the language and themes in the client's responses.

Guidelines:
- Focus on the specific words and phrases the client uses, not just the content
- Look for idealization language (how they want to be seen) and shadow language (what they admit is problematic)
- Consider which types would most naturally use this specific vocabulary
- Return exactly 2-3 type numbers in order of likelihood, with a one-sentence rationale for each
- This is a soft signal only — hold it lightly
- Do not mention the Enneagram framework, type names, or any technical terminology in your rationale — use plain descriptive language only
- Respond only with valid JSON. No preamble, no markdown, no explanation outside the JSON object.`;

  const userMessage = `Here are a client's responses to four open-ended questions:

Q1 - Words or phrases they use to describe themselves:
${a.q1 || ''}

Q2 - Words or phrases others would use to describe them:
${a.q2 || ''}

Q3 - Their greatest strength:
${a.q3 || ''}

Q4 - Their most problematic trait:
${a.q4 || ''}

Based on these responses, identify 2-3 Enneagram types most consistent with this language. Return your response as a JSON object in exactly this format:

{
  "stage0_signal": [
    {
      "type": [number],
      "likelihood": 1,
      "rationale": "[one sentence in plain English]"
    },
    {
      "type": [number],
      "likelihood": 2,
      "rationale": "[one sentence in plain English]"
    }
  ]
}`;

  let signal = null;
  try {
    const response = await client.messages.create({
      // Spec asked for claude-sonnet-4-20250514; that snapshot 404s on this
      // workspace, so use the same Sonnet 4 model the main /api/analyze call
      // uses to keep the mini-call functional.
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: [{ type: 'text', text: STAGE0_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = response.content[0].text;
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed && Array.isArray(parsed.stage0_signal) && parsed.stage0_signal.length > 0) {
      signal = parsed.stage0_signal;
      console.log(`[stage0-signal] success — client #${client_id} types=${signal.map(s => s.type).join(',')}`);
    } else {
      console.warn(`[stage0-signal] parsed payload missing stage0_signal array`);
    }
  } catch (err) {
    console.error('[stage0-signal] failed:', err.message);
  }

  if (client_id) {
    try {
      await db.updateClientStage0Signal(client_id, signal);
    } catch (e) {
      console.error('[stage0-signal] DB write failed:', e.message);
    }
  }

  return res.json({ ok: true, signal });
});

// Counter-type mini-call — fires from the 'ct-analyzing' transition screen
// after Stage 1 scoring when a CT flag was detected. Reconciles Stage 0
// language signal + Stage 1 scores + CT combination into a revised, reordered
// hypothesis list. On success the parsed result is stored on
// clients.ct_adjustment. On failure or timeout we return adjustment: null so
// the client can fall back to the original Stage 1 hypotheses.
app.post('/api/ct-adjustment', async (req, res) => {
  const { client_id, stage0_signal, stage1_scores, ct_key } = req.body || {};
  const sc = stage1_scores || {};

  const CT_SYSTEM = `You are an expert Enneagram practitioner helping to refine a type hypothesis based on two sources of evidence: a client's open-ended self-description (Stage 0) and their structured assessment scores (Stage 1).

You will receive:
- A Stage 0 language signal — 2-3 type candidates identified from the client's own words
- Stage 1 scores — numeric scores across the three Centers and three Instincts
- A counter-type flag — a specific CT combination that was detected in the scoring

Your task is to return a revised hypothesis list that best reconciles all three signals. The counter-type pattern means the client's dominant instinct is suppressing the expected expression of their Center, which can cause scoring ambiguity.

Guidelines:
- Weight the Stage 0 language signal heavily — it is uncontaminated by framework priming
- Weight the CT flag as a known structural pattern, not a scoring artifact
- Return exactly 3 type numbers in order of likelihood
- Include a one-sentence plain-English rationale for the primary type only
- If the evidence strongly supports the CT hypothesis, place the CT base type first
- If the evidence does not support the CT hypothesis, place it second or third
- Respond only with valid JSON. No preamble, no markdown, no explanation outside the JSON object.`;

  const signalBlock = Array.isArray(stage0_signal) && stage0_signal.length > 0
    ? stage0_signal.map(s => `Type ${s.type} (likelihood ${s.likelihood}): ${s.rationale}`).join('\n')
    : 'No Stage 0 signal available.';

  const userMessage = `Stage 0 language signal:
${signalBlock}

Stage 1 scores:
Centers: Body=${sc.body}, Heart=${sc.heart}, Head=${sc.head}
Instincts: SP=${sc.sp}, SO=${sc.so}, SX=${sc.sx}

Counter-type flag: ${ct_key}

Return a revised hypothesis list in exactly this format:
{
  "revised_hypotheses": [n, n, n],
  "adjustment_made": true/false,
  "rationale": "one sentence in plain English about why the primary type was selected"
}`;

  let adjustment = null;
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: [{ type: 'text', text: CT_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = response.content[0].text;
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed && Array.isArray(parsed.revised_hypotheses) && parsed.revised_hypotheses.length === 3) {
      adjustment = parsed;
      console.log(`[ct-adjustment] success — client #${client_id} ct_key=${ct_key} revised=${parsed.revised_hypotheses.join(',')} made=${parsed.adjustment_made}`);
    } else {
      console.warn('[ct-adjustment] parsed payload missing revised_hypotheses array');
    }
  } catch (err) {
    console.error('[ct-adjustment] failed:', err.message);
  }

  if (client_id) {
    try {
      await db.updateClientCtAdjustment(client_id, adjustment);
    } catch (e) {
      console.error('[ct-adjustment] DB write failed:', e.message);
    }
  }

  if (!adjustment) return res.json({ ok: false, adjustment: null });
  return res.json({ ok: true, adjustment });
});

// Clear ct_adjustment to null for a client. Called when a CT flag drops on
// re-entry or when the 8s mini-call timeout fires, so the persisted record
// matches what the main API call will use.
app.post('/api/ct-adjustment-clear', async (req, res) => {
  const { client_id } = req.body || {};
  if (client_id) {
    try {
      await db.updateClientCtAdjustment(client_id, null);
    } catch (e) {
      console.error('[ct-adjustment-clear] DB write failed:', e.message);
    }
  }
  return res.json({ ok: true });
});

// =================== AI CALL #1 — CANDIDATE REASONING (KEYSTONE) ===================

// Fires after Stage 2 from the 'call1-analyzing' transition screen. This is the
// v2 reasoning layer that replaces the retired mechanical Stage 1/2 logic: it
// re-scores all nine types on its own coherence scale (it can override the
// slider ranking when orthogonal evidence supports a promotion), and emits the
// frozen §6.3 output contract that Stage 3, Stage 4, and AI Call #2 all read
// from. The parsed result is persisted to clients.call1_result (authoritative)
// and mirrored into the client's session_state for resume rehydration.

const CALL1_SYSTEM = `You are an expert Enneagram practitioner serving as the reasoning layer of a typing engine. You receive a client's Stage 1 self-report slider profiles (nine types and three instincts), both of their Stage 1 open responses, their Stage 0 self-description, and three Stage 2 framework answers. Your job is to produce a coherence-weighted ranking of all nine Enneagram types plus the routing decisions that the later stages depend on.

You are NOT a ratifier of the slider ranking. The sliders are raw self-report and are distorted in known ways:
- Counter-types under-endorse the statements of their own type, because their dominant instinct drives them to live the type against its usual grain (an SP-3 disclaims image-focus; an SX-6 disclaims fear; an SP-4 disclaims emotional self-indulgence).
- Some types undershoot their home center in self-report — a Type 9 often does not recognize anger as anger, a Type 5 reads fear as a preference for privacy, a Type 3 suppresses heart-center feeling in service of performance.
Read across ALL the evidence — the open responses, the framework answers, and the instinct profile — and PROMOTE a type the sliders understated when the orthogonal evidence coheres around it. Using your judgment to reorder is the entire reason you exist: a call that merely echoes the slider order has failed.

SCORING — assign each of the nine types a 0-100 coherence score expressing how well the WHOLE picture fits that type. This is a judgment of fit, not a recomputation of the sliders. Use the full range: a type that clearly fits scores high (80-100); a type with little support scores low (10-30). The spread between your top type and your weakest type must be wide. If your scores cluster in a narrow band you have not committed to a reading.

GAP — judge the closeness of your top two scores:
gap = "tight" when the difference between the top two coherence scores is 10 points or fewer (inclusive); gap = "wide" when the difference is greater than 25 points; gap = "medium" otherwise.
The gap label must agree with the arithmetic of the two scores you assigned.

INSTINCT — name the single dominant instinct (SP, SO, or SX). Anchor this primarily on the three-instinct slider profile and the instinct open response; the thematic content of the type responses is secondary and must not override a clear instinct signal (e.g. "I look after my own resources and comfort first" is SP even when the person also talks about helping the group).

COUNTER-TYPE ROUTING — these dominant-instinct + type combinations are the known counter-types:
  SO + 7 -> key "SO-7"
  SX + 6 -> key "SX-6"
  SP + 3 -> key "SP-3"
  SP + 4 -> key "SP-4"
  SX + 1 -> key "SX-1"
If your dominant_instinct combined with your leading_candidate forms one of these combinations, set stage3_mode to "counter_type" and ct_pair to that key. The instinct is also a pre-flag: when it points at one of these combinations, treat the corresponding type as potentially understated in the sliders and weigh promoting it.

COUNTER-TYPE LOOKALIKE TRAP —
Two counter-types present a specific lookalike trap that requires explicit attention. SO-7 (Sacrifice) resembles Type 2 on the surface — warm, other-focused, giving language — and will often rank below Type 2 on sliders. When the instinct profile shows SO as dominant or strong, and Type 7 appears anywhere in the top four of the slider ranking, evaluate whether the Type 2 surface presentation is better explained by an SO-7 counter-type. SX-6 (Counterphobic) resembles Type 8 — confrontational, intensity-seeking, fear-forward language — and will often rank below Type 8 on sliders. When SX is dominant or strong, and Type 6 appears anywhere in the top four, evaluate whether the Type 8 presentation is better explained by SX-6. In both cases, if the counter-type hypothesis is plausible, set stage3_mode to counter_type with the correct ct_pair and promote the counter-type candidate in your ranking accordingly.

STAGE 3 MODE —
- "counter_type" when the counter-type condition above fires; ct_pair = the matching key.
- "standard" in the normal case: leading and alternate form a discriminable pair. Q1 composes any of the 36 pairs, and 26 pairs additionally carry a bespoke avoidance question (listed in the user message).
- "none" only when leading and alternate form a pairing so rarely confused that no meaningful discrimination question applies. This is a rare freak-pair fallback, never a default.
When stage3_mode is "standard" or "none", ct_pair is the literal string "Null".

SUPPORTING LANGUAGE — if any of the client's open-response text aligns with your third-ranked candidate, quote or paraphrase the aligning fragment in supporting_language. If nothing aligns, use the literal string "Null".

CONSISTENCY RULE (applied last, before returning output): ct_pair is only valid when leading_candidate is the counter-type's base type. The valid pairings are:

  ct_pair SP-3  requires  leading_candidate = 3
  ct_pair SX-6  requires  leading_candidate = 6
  ct_pair SP-4  requires  leading_candidate = 4
  ct_pair SX-1  requires  leading_candidate = 1
  ct_pair SO-7  requires  leading_candidate = 7

If ct_pair is set but leading_candidate is not the base type for that pair, set stage3_mode = "standard" and ct_pair = "Null". A genuine Type 8 with SX instinct is not SX-6 — it is a Type 8 who leads with intensity. The counter-type flag describes the leading candidate's subtype, not the instinct alone.

Respond only with valid JSON. No preamble, no markdown, no code fences, no text outside the JSON object.`;

const CALL1_LEGAL_PAIRS_BLOCK = `STAGE 3 BESPOKE-AVOIDANCE PAIR LIST (the 26 realistic-confusion pairs; lower number first):
1-2, 1-4, 1-6, 1-7, 1-9, 2-3, 2-4, 2-6, 2-8, 2-9, 3-4, 3-6, 3-7, 3-8, 3-9, 4-5, 4-9, 5-6, 5-7, 5-8, 5-9, 6-7, 6-8, 6-9, 7-8, 8-9

KNOWN COUNTER-TYPE COMBINATIONS (dominant instinct + leading type): SO-7, SX-6, SP-3, SP-4, SX-1`;

const CALL1_OUTPUT_FORMAT = `Return your analysis as a single JSON object in exactly this shape:
{
  "ranking": [
    { "type": <type number 1-9>, "score": <0-100> }
    // exactly nine entries, one per type, ordered highest score first
  ],
  "leading_candidate": <type number, equal to ranking[0].type>,
  "alternate_candidate": <type number, equal to ranking[1].type>,
  "third_candidate": <type number, equal to ranking[2].type>,
  "gap": "tight" | "medium" | "wide",
  "supporting_language": "<aligning open-response text>" | "Null",
  "stage3_mode": "standard" | "counter_type" | "none",
  "ct_pair": "SP-3" | "SX-6" | "SP-4" | "SX-1" | "SO-7" | "Null",
  "dominant_instinct": "SP" | "SO" | "SX"
}

All nine types (1 through 9) must appear exactly once in "ranking". Use the literal string "Null" (capital N) for supporting_language and ct_pair when not applicable — never null, never an empty string, never an omitted field.`;

// Extract the first balanced JSON object from model output. On hard cases the
// model occasionally appends commentary after the object — and that prose can
// itself contain braces — so a naive first-{ to last-} slice breaks. This scan
// is string-aware (ignores braces inside string values) and stops at the first
// object's matching close brace.
function extractFirstJsonObject(s) {
  const start = s.indexOf('{');
  if (start === -1) return s;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return s.slice(start);
}

app.post('/api/call1', async (req, res) => {
  const { client_id, contextBlock } = req.body || {};
  if (!contextBlock || typeof contextBlock !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing contextBlock.' });
  }

  const userMessage = `${contextBlock}\n\n${CALL1_LEGAL_PAIRS_BLOCK}\n\n${CALL1_OUTPUT_FORMAT}`;

  let result = null;
  try {
    // Stream Call #1 rather than a plain create(): a non-streaming POST held open
    // for the full reasoning call is the shape PaaS proxies (Railway) reap mid-
    // response, surfacing as an APIConnectionError / "Premature close" that never
    // yields a result. Streaming keeps the connection active with incremental data
    // — Anthropic's documented remedy for long-request connection drops. We don't
    // need per-token handling, so .finalMessage() reassembles the same Message the
    // create() call returned (same .content / .usage shape downstream).
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: [{ type: 'text', text: CALL1_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
    const response = await stream.finalMessage();
    console.log(`[call1] usage — ${JSON.stringify(response.usage)}`);
    const text = response.content[0].text;
    const stripped = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const clean = extractFirstJsonObject(stripped);
    const parsed = JSON.parse(clean);
    if (parsed && Array.isArray(parsed.ranking) && parsed.ranking.length === 9) {
      // Gap coherence: derive the label from the top two scores so it can never
      // disagree with the arithmetic. The model mislabels gaps even mid-range
      // (e.g. a 16-point gap returned as "wide"), so the route is the source of truth.
      const sorted = parsed.ranking.map((e) => e && e.score).filter((s) => typeof s === 'number').sort((a, b) => b - a);
      if (sorted.length >= 2) {
        const d = sorted[0] - sorted[1];
        parsed.gap = d <= 10 ? 'tight' : d > 25 ? 'wide' : 'medium';
      }
      // Counter-type coherence: a counter_type route is only valid when ct_pair
      // is a known key whose instinct prefix matches dominant_instinct AND whose
      // base type matches leading_candidate (a CT key like SO-7 *means* SO + 7).
      // Anything else — ct_pair "Null", a base/instinct mismatch — coerces to standard.
      const CT_SPEC = { 'SO-7': { inst: 'SO', base: 7 }, 'SX-6': { inst: 'SX', base: 6 }, 'SP-3': { inst: 'SP', base: 3 }, 'SP-4': { inst: 'SP', base: 4 }, 'SX-1': { inst: 'SX', base: 1 } };
      if (parsed.stage3_mode === 'counter_type') {
        const spec = CT_SPEC[parsed.ct_pair];
        if (!spec || spec.base !== parsed.leading_candidate || spec.inst !== parsed.dominant_instinct) {
          parsed.stage3_mode = 'standard';
          parsed.ct_pair = 'Null';
        }
      }
      result = parsed;
      // D6: persist Call #1 token usage on the saved result (additive; null-safe).
      result._usage = {
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
        cache_read_input_tokens: response.usage?.cache_read_input_tokens ?? null,
        cache_creation_input_tokens: response.usage?.cache_creation_input_tokens ?? null,
      };
      console.log(`[call1] success — client #${client_id} leading=${parsed.leading_candidate} alt=${parsed.alternate_candidate} gap=${parsed.gap} mode=${parsed.stage3_mode} ct=${parsed.ct_pair} inst=${parsed.dominant_instinct}`);
    } else {
      console.warn('[call1] parsed payload missing 9-entry ranking array');
    }
  } catch (err) {
    // Log name + cause, not just message: an APIConnectionError's message is a
    // generic "Connection error." — the underlying "Premature close" / "terminated"
    // lives on err.cause, and err.name distinguishes a connection drop from a
    // timeout or a downstream JSON parse failure.
    console.error(`[call1] failed: ${err.name}: ${err.message}`, err.cause ? `(cause: ${err.cause})` : '');
  }

  if (client_id) {
    try {
      await db.saveCall1Result(client_id, result);
    } catch (e) {
      console.error('[call1] DB write failed:', e.message);
    }
  }

  if (!result) return res.json({ ok: false, result: null });
  return res.json({ ok: true, result });
});

// Original endpoint — kept unchanged for the test runner
app.post('/api/analyze', async (req, res) => {
  const { contextBlock } = req.body;
  const systemPrompt = `${SYSTEM_PROMPT}\n\n${TASK_INSTRUCTIONS}`;
  const userMessage  = `${contextBlock}\n\n${OUTPUT_FORMAT}`;
  const started = Date.now();
  console.log(`[analyze] request received — context ${contextBlock?.length ?? 0} chars`);

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

async function sendInviteEmail(client, token, coach) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[invite] SENDGRID_API_KEY not set — invite email skipped');
    return;
  }
  const appUrl   = process.env.RAILWAY_PUBLIC_URL || 'https://enneagram.hiveleadership.com';
  const link     = `${appUrl}/assessment/${token}`;
  const msg = {
    to:      client.email,
    from:    { name: 'InsightOut by Hive', email: process.env.SENDGRID_FROM_EMAIL },
    replyTo: { name: coach.name, email: coach.email },
    subject: `Your InsightOut Enneagram Assessment is Ready!`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1A2B33; line-height: 1.7;">
        <div style="border-top: 4px solid #00b1d7; padding-top: 28px; margin-bottom: 24px;">
          <h1 style="font-size: 22px; color: #00b1d7; margin: 0; font-weight: 700;">Welcome to the Enneagram!</h1>
        </div>

        <p style="font-size:15px;color:#333333;margin:0 0 16px 0;">Hi ${esc(client.first_name)},</p>

        <p style="font-size:15px;">Your journey to discover your Enneagram type starts here.</p>

        <p style="font-size:15px;">The InsightOut Enneagram Assessment walks you through a series of questions about how you think, what you care about, and how you tend to move through the world. Your responses will help us form a hypothesis about your Enneagram type.</p>

        <p style="font-size:15px;">There are no right or wrong answers — just respond as honestly and as thoroughly as you can. For open-ended questions, the more detail you provide, the more we have to work with.</p>

        <p style="font-size:15px;">It takes about 15–20 minutes to complete, and you'll receive your full report by email shortly after. If you have any questions or run into any bumps in the road, reach out to me at <a href="mailto:${coach.email}">${esc(coach.email)}</a>. Click "Begin My Assessment" below when you're ready.</p>

        <p style="margin: 32px 0;">
          <a href="${link}" style="display:inline-block;background:#00b1d7;color:#fff;padding:14px 28px;border-radius:4px;font-weight:700;text-decoration:none;font-size:15px;">Begin My Assessment →</a>
        </p>

        <p style="font-size: 13px; color: #4A6070;">If the button above doesn't work, copy and paste this link into your browser:<br>
          <a href="${link}" style="color:#00b1d7;">${link}</a>
        </p>

        <p style="font-size:15px;color:#333333;margin:24px 0 4px 0;">${esc(coach.name)}</p>
        ${coach.organization ? `<p style="font-size:15px;color:#333333;margin:0 0 4px 0;">${esc(coach.organization)}</p>` : ''}
        <p style="font-size:15px;color:#333333;margin:0 0 24px 0;"><a href="mailto:${coach.email}" style="color:#00b1d7;text-decoration:none;">${esc(coach.email)}</a></p>

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
    ? [['name', 'name'], ['email', 'email'], ['organization', 'organization']]
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
function sharedModalHTML(isAdmin, isSuperAdmin) {
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
var _IS_SUPER_ADMIN = ${isSuperAdmin ? 'true' : 'false'};
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
  var TN={1:'The Improver',2:'The Giver',3:'The Performer',4:'The Individualist',5:'The Observer',6:'The Questioner',7:'The Enthusiast',8:'The Protector',9:'The Peacemaker'};
  var typeLabel=a.confirmed_type?('Type '+a.confirmed_type+' — '+(TN[a.confirmed_type]||'')):null;
  var conf=a.confidence_level?a.confidence_level.replace(/_/g,'-'):null;
  var SM={complete:'Complete',in_progress:'In Progress',not_started:'Not Started',processing:'Processing',failed:'Failed'};
  var statusStr=SM[a.status||c.status]||(a.status||c.status)||null;
  var lu=c.updated_at?('<p style="font-size:12px;color:#7A96A6;margin:0 0 16px;">Last Updated: '+_esc(_fmtFull(c.updated_at))+' by <strong>'+_esc(c.updated_by||'')+'</strong></p>'):'';

  var h=_modalHeader('Client Profile',(c.first_name||'')+' '+(c.last_name||''),'#00b1d7');
  // PR B: super-admins get a tabbed modal (Profile | History). Regular coaches see the
  // flat profile unchanged. The History tab is a read-only lifecycle audit trail
  // (client_history) — distinct from the Edit History section inside the Profile tab.
  if(_IS_SUPER_ADMIN){
    var _ctBtn=function(name,label,active){
      return '<button id="client-tab-btn-'+name+'" onclick="switchClientTab(&#39;'+name+'&#39;)" '+
        'style="background:none;border:none;border-bottom:2px solid '+(active?'#00b1d7':'transparent')+';'+
        'color:'+(active?'#1A2B33':'#7A96A6')+';font-family:Georgia,serif;font-size:13px;font-weight:700;'+
        'padding:8px 14px;cursor:pointer;">'+label+'</button>';
    };
    h+='<div style="display:flex;gap:4px;border-bottom:1px solid #EFE8E0;margin:0 0 16px;">'+
       _ctBtn('profile','Profile',true)+_ctBtn('history','History',false)+'</div>';
    h+='<div id="client-tab-profile">';
  }
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
  // Beta Tester toggle — super-admin only. Bound to clients.is_beta (the field the
  // beta-toggle endpoint writes via db.setClientBeta), not the assessment's mirrored
  // snapshot, so the checked state survives reopening the modal.
  if(_IS_SUPER_ADMIN){
    var betaChecked=c.is_beta?' checked':'';
    h+='<div style="border-top:1px solid #EFE8E0;padding-top:12px;margin-bottom:16px;">';
    h+='<div id="beta-toggle-err" style="display:none;background:#fdecea;color:#c0392b;border-radius:4px;padding:8px 12px;font-size:12px;margin-bottom:10px;"></div>';
    h+='<label style="display:flex;align-items:center;gap:10px;cursor:pointer;">';
    h+='<input type="checkbox" id="beta-toggle"'+betaChecked+' onchange="window._toggleClientBeta(this)" style="width:16px;height:16px;cursor:pointer;">';
    h+='<span style="font-size:11px;color:#7A96A6;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">Beta Tester</span>';
    h+='</label>';
    h+='</div>';
  }
  // Per-client EM analysis_mode override (super-admin only). null/'' = inherit global.
  if(_IS_SUPER_ADMIN){
    var amVal=c.analysis_mode||'';
    var amOpt=function(v,l){ return '<option value="'+v+'"'+(amVal===v?' selected':'')+'>'+l+'</option>'; };
    h+='<div style="border-top:1px solid #EFE8E0;padding-top:12px;margin-bottom:16px;">';
    h+='<div id="am-override-err" style="display:none;background:#fdecea;color:#c0392b;border-radius:4px;padding:8px 12px;font-size:12px;margin-bottom:10px;"></div>';
    h+='<label style="display:block;font-size:11px;color:#7A96A6;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;margin-bottom:6px;">EM Analysis Mode Override</label>';
    h+='<select id="am-override" onchange="window._setClientAnalysisMode('+c.id+',this)" style="width:100%;padding:8px;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;">';
    h+=amOpt('','Inherit global')+amOpt('parallel','Parallel')+amOpt('em_only','EM only')+amOpt('sm_only','SM only');
    h+='</select>';
    h+='<p style="font-size:11px;color:#7A96A6;margin:4px 0 0;">Overrides the global EM mode for new assessments by this client.</p>';
    h+='</div>';
  }
  h+='<div id="coach-debrief-section">'+_coachDebriefReadonlyHTML(data)+'</div>';
  h+='<div style="border-top:1px solid #EFE8E0;padding-top:12px;margin-bottom:20px;">';
  h+='<p style="font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin:0 0 8px;">Edit History</p>';
  h+=_renderHistory(hist);
  h+='</div>';
  h+='<div style="display:flex;gap:10px;justify-content:flex-end;padding:0 0 24px;">';
  h+='<button onclick="window._editClientMode()" style="background:#00b1d7;color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer;">Edit Profile</button>';
  h+='<button onclick="_hideModal()" style="background:#fff;color:#7A96A6;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;padding:9px 18px;cursor:pointer;">Close</button>';
  h+='</div>';
  // PR B: close the Profile panel and add the read-only History panel (super-admin only).
  if(_IS_SUPER_ADMIN){
    h+='</div>'; // close #client-tab-profile
    h+='<div id="client-tab-history" style="display:none;padding-bottom:24px;">';
    h+='<p style="font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin:0 0 8px;">Client History</p>';
    h+=_renderClientHistory(data.clientHistory||[]);
    h+='</div>';
  }
  h+='</div>';
  _content().innerHTML=h; _showModal();
}

// PR B: switch between Profile and History tabs in the client details modal.
// Mirrors switchEmTab; inline-styled because the em-tab CSS isn't loaded on this page.
window.switchClientTab = function(name){
  ['profile','history'].forEach(function(t){
    var panel=document.getElementById('client-tab-'+t);
    var btn=document.getElementById('client-tab-btn-'+t);
    if(panel) panel.style.display=(t===name)?'block':'none';
    if(btn){ btn.style.borderBottomColor=(t===name)?'#00b1d7':'transparent'; btn.style.color=(t===name)?'#1A2B33':'#7A96A6'; }
  });
};

// PR B: render the client_history lifecycle audit trail (read-only). Mirrors
// _renderHistory but for client_history rows (created_at, actor, event_type, description).
function _renderClientHistory(rows){
  if(!rows||rows.length===0) return '<p style="font-size:12px;color:#7A96A6;margin:6px 0 0;">No history yet.</p>';
  return rows.map(function(r){
    return '<div style="padding:8px 0;border-bottom:1px solid #f0ece8;">'+
      '<div style="font-size:11px;color:#7A96A6;">'+_esc(_fmtFull(r.created_at))+' — <strong style="color:#4A6070;">'+_esc(r.actor||'system')+'</strong>'+
      ' <span style="display:inline-block;background:#eef4f7;color:#4A6070;border-radius:3px;padding:1px 6px;font-size:10px;letter-spacing:0.04em;">'+_esc(r.event_type||'')+'</span></div>'+
      '<div style="font-size:12px;margin-top:3px;color:#1A2B33;">'+_esc(r.event_description||'')+'</div>'+
      '</div>';
  }).join('');
}

window._editClientMode = function(){
  var data=_hiveRec; if(!data)return;
  var c=data.client;
  var TN={1:'The Improver',2:'The Giver',3:'The Performer',4:'The Individualist',5:'The Observer',6:'The Questioner',7:'The Enthusiast',8:'The Protector',9:'The Peacemaker'};
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
  h+='<div style="font-size:12px;color:#7A96A6;font-style:italic;margin:-8px 0 14px;">Changing this will affect report delivery and login access.</div>';
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
  h+='<button onclick="window._cancelClientEdit()" style="background:#fff;color:#7A96A6;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;padding:9px 18px;cursor:pointer;">Cancel</button>';
  h+='</div></div>';
  _content().innerHTML=h;
};

// Cancel edit: discard the form and restore the read-only profile view in place
// (modal stays open), re-rendering from the unchanged _hiveRec.
window._cancelClientEdit = function(){
  if(_hiveRec) _renderClientView(_hiveRec);
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
    _renderClientView(_hiveRec); _showToast('Profile updated.');
  }catch(e){errDiv.textContent='Request failed: '+e.message;errDiv.style.display='';saveBtn.disabled=false;saveBtn.textContent='Save Changes';}
};

// Beta Tester toggle — super-admin only. Optimistic: flips clients.is_beta server-
// side, updates the cached record without a page reload, and rolls the checkbox back
// on error (showing an inline message).
window._toggleClientBeta = async function(cb){
  var errDiv=document.getElementById('beta-toggle-err');
  if(errDiv) errDiv.style.display='none';
  var clientId=_hiveRec.client.id;
  var want=cb.checked;
  cb.disabled=true;
  try{
    var resp=await fetch('/admin/clients/'+clientId+'/beta-toggle',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({isBeta:want})});
    var data=await resp.json();
    if(!resp.ok||!data.ok){ throw new Error(data.error||'Toggle failed.'); }
    _hiveRec.client.is_beta=want;
    _showToast('Beta tester '+(want?'enabled':'disabled')+'.');
  }catch(e){
    cb.checked=!want;
    if(errDiv){ errDiv.textContent=e.message; errDiv.style.display=''; }
  }finally{
    cb.disabled=false;
  }
};

window._setClientAnalysisMode = async function(clientId, sel){
  var errDiv=document.getElementById('am-override-err');
  if(errDiv) errDiv.style.display='none';
  var mode=sel.value||'';
  sel.disabled=true;
  try{
    var resp=await fetch('/admin/clients/'+clientId+'/analysis-mode',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({analysis_mode:mode})});
    var data=await resp.json();
    if(!resp.ok||!data.ok){ throw new Error(data.error||'Update failed.'); }
    if(_hiveRec&&_hiveRec.client) _hiveRec.client.analysis_mode=mode||null;
    _showToast('Analysis mode override '+(mode?('set to '+mode):'cleared')+'.');
  }catch(e){
    if(errDiv){ errDiv.textContent=e.message; errDiv.style.display=''; }
  }finally{
    sel.disabled=false;
  }
};

// ── Coach Debrief Confirmation (assessment annotation sub-editor) ────────────

var _CD_TYPE_NAMES={1:'The Improver',2:'The Giver',3:'The Performer',4:'The Individualist',5:'The Observer',6:'The Questioner',7:'The Enthusiast',8:'The Protector',9:'The Peacemaker'};
var _CD_INSTINCTS=[['SP','SP – Self-Preservation'],['SO','SO – Social'],['SX','SX – One-to-One']];
function _cdInstinctLabel(v){for(var i=0;i<_CD_INSTINCTS.length;i++){if(_CD_INSTINCTS[i][0]===String(v).toUpperCase())return _CD_INSTINCTS[i][1];}return _esc(v);}
function _cdBadge(){return ' <span style="color:#F68625;font-size:11px;">⚠ Differs from engine hypothesis</span>';}

function _coachDebriefReadonlyHTML(data){
  var a=data.assessment;
  var hasAsm=!!(a&&a.assessment_id!=null);
  var html='<div style="border-top:1px solid #EFE8E0;padding-top:12px;margin-bottom:20px;">';
  html+='<div style="display:flex;align-items:center;justify-content:space-between;margin:0;">';
  html+='<p style="font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin:0;">Coach Debrief Confirmation</p>';
  if(hasAsm){
    html+='<button onclick="window._editCoachDebriefMode()" style="background:none;border:none;color:#00B2D9;font-family:Georgia,serif;font-size:12px;font-weight:700;cursor:pointer;padding:0;">✎ Edit</button>';
  }else{
    html+='<button disabled title="No assessment to annotate yet." style="background:none;border:none;color:#B8C4CC;font-family:Georgia,serif;font-size:12px;font-weight:700;cursor:not-allowed;padding:0;">✎ Edit</button>';
  }
  html+='</div>';
  html+='<p style="font-size:12px;color:#7A96A6;margin:2px 0 8px;">Filled in after debrief session.</p>';
  html+='<table style="width:100%;border-collapse:collapse;">';
  // Confirmed Type
  var ct=a?a.coach_confirmed_type:null;
  var typeVal='—';
  if(ct!=null&&ct!==''){
    typeVal=_esc(ct+' – '+(_CD_TYPE_NAMES[Number(ct)]||''));
    if(a.confirmed_type!=null&&Number(ct)!==Number(a.confirmed_type)) typeVal+=_cdBadge();
  }
  html+=_profileRowRaw('Confirmed Type',typeVal);
  // Confirmed Instinct
  var ci=a?a.coach_confirmed_instinct:null;
  var instVal='—';
  if(ci!=null&&ci!==''){
    instVal=_esc(_cdInstinctLabel(ci));
    var dih=a.dominant_instinct_hypothesis;
    if(dih!=null&&dih!==''&&String(ci).toUpperCase()!==String(dih).toUpperCase()) instVal+=_cdBadge();
  }
  html+=_profileRowRaw('Confirmed Instinct',instVal);
  // Clarification Notes
  var notes=a?a.type_clarification_notes:null;
  html+=_profileRowRaw('Clarification Notes',(notes!=null&&notes!=='')?_esc(notes):'—');
  html+='</table>';
  html+='</div>';
  return html;
}

function _coachDebriefEditHTML(data){
  var a=data.assessment||{};
  var ct=a.coach_confirmed_type, ci=a.coach_confirmed_instinct, notes=a.type_clarification_notes||'';
  var lbl='display:block;font-size:11px;color:#7A96A6;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;margin-bottom:5px;';
  var fld='width:100%;padding:9px 11px;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;color:#1A2B33;outline:none;box-sizing:border-box;';
  var html='<div style="border-top:1px solid #EFE8E0;padding-top:12px;margin-bottom:20px;">';
  html+='<p style="font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin:0 0 2px;">Coach Debrief Confirmation</p>';
  html+='<p style="font-size:12px;color:#7A96A6;margin:0 0 10px;">Filled in after debrief session.</p>';
  html+='<div id="cd-err" style="display:none;background:#fdecea;color:#c0392b;border-radius:4px;padding:10px 14px;font-size:13px;margin-bottom:12px;"></div>';
  // Type dropdown
  html+='<div style="margin-bottom:12px;"><label for="cd_type" style="'+lbl+'">Confirmed Type</label>';
  html+='<select id="cd_type" style="'+fld+'background:#fff;"><option value="">— Not set —</option>';
  for(var i=1;i<=9;i++){ html+='<option value="'+i+'"'+(Number(ct)===i?' selected':'')+'>'+i+' – '+_CD_TYPE_NAMES[i]+'</option>'; }
  html+='</select></div>';
  // Instinct dropdown
  html+='<div style="margin-bottom:12px;"><label for="cd_inst" style="'+lbl+'">Confirmed Instinct</label>';
  html+='<select id="cd_inst" style="'+fld+'background:#fff;"><option value="">— Not set —</option>';
  for(var j=0;j<_CD_INSTINCTS.length;j++){ html+='<option value="'+_CD_INSTINCTS[j][0]+'"'+(String(ci).toUpperCase()===_CD_INSTINCTS[j][0]?' selected':'')+'>'+_CD_INSTINCTS[j][1]+'</option>'; }
  html+='</select></div>';
  // Notes
  html+='<div style="margin-bottom:14px;"><label for="cd_notes" style="'+lbl+'">Clarification Notes</label>';
  html+='<textarea id="cd_notes" rows="4" style="'+fld+'resize:vertical;">'+_esc(notes)+'</textarea></div>';
  // Buttons
  html+='<div style="display:flex;gap:10px;justify-content:flex-end;">';
  html+='<button id="cd-save-btn" onclick="window._saveCoachDebrief()" style="background:#00B2D9;color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer;">Save</button>';
  html+='<button onclick="window._cancelCoachDebrief()" style="background:#fff;color:#7A96A6;border:1px solid #D0DCE4;border-radius:4px;font-family:Georgia,serif;font-size:13px;padding:9px 18px;cursor:pointer;">Cancel</button>';
  html+='</div></div>';
  return html;
}

window._editCoachDebriefMode=function(){
  var el=document.getElementById('coach-debrief-section'); if(!el||!_hiveRec)return;
  el.innerHTML=_coachDebriefEditHTML(_hiveRec);
};
window._cancelCoachDebrief=function(){
  var el=document.getElementById('coach-debrief-section'); if(!el||!_hiveRec)return;
  el.innerHTML=_coachDebriefReadonlyHTML(_hiveRec);
};
window._saveCoachDebrief=async function(){
  var errDiv=document.getElementById('cd-err');
  var saveBtn=document.getElementById('cd-save-btn');
  var a=(_hiveRec&&_hiveRec.assessment)||{};
  var assessmentId=a.assessment_id;
  var typeVal=document.getElementById('cd_type').value||null;
  var instVal=document.getElementById('cd_inst').value||null;
  var notesVal=(document.getElementById('cd_notes').value||'').trim()||null;
  errDiv.style.display='none';
  saveBtn.disabled=true; saveBtn.textContent='Saving…';
  try{
    var resp=await fetch('/admin/assessments/'+assessmentId+'/coach-debrief',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({coach_confirmed_type:typeVal,coach_confirmed_instinct:instVal,type_clarification_notes:notesVal})});
    var data=await resp.json();
    if(!resp.ok||!data.success){ errDiv.textContent=data.error||'Save failed.'; errDiv.style.display=''; saveBtn.disabled=false; saveBtn.textContent='Save'; return; }
    _hiveRec.assessment=Object.assign({},_hiveRec.assessment,{
      coach_confirmed_type:data.updated.coach_confirmed_type,
      coach_confirmed_instinct:data.updated.coach_confirmed_instinct,
      type_clarification_notes:data.updated.type_clarification_notes,
    });
    var el=document.getElementById('coach-debrief-section'); if(el) el.innerHTML=_coachDebriefReadonlyHTML(_hiveRec);
    _showToast('Coach debrief saved.');
  }catch(e){ errDiv.textContent='Request failed: '+e.message; errDiv.style.display=''; saveBtn.disabled=false; saveBtn.textContent='Save'; }
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
  h+=_profileRow('Organization',c.organization || '—');
  h+=_profileRowRaw('Admin',adminBadge);
  h+=_profileRowRaw('Status',activeBadge);
  h+='</table>';
  h+=lu;
  h+=_renderRolesSection(data);
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

// IAA Phase D — Roles & Access section for the coach profile modal. Super-admin only.
// Reads data.user_id / data.roles / data.user_is_active / data.is_self from the
// profile JSON. Checkboxes carry user_id + role in data-* attrs so no quote-escaping
// is needed; changes POST to the role routes and re-render the modal on success.
function _renderRolesSection(data){
  if(!_IS_SUPER_ADMIN) return '';
  var uid = data.user_id;
  var head = '<div style="border-top:1px solid #EFE8E0;padding-top:12px;margin-bottom:20px;">'
    + '<p style="font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin:0 0 8px;">Roles &amp; Access</p>';
  if(!uid){
    return head + '<p style="font-size:13px;color:#7A96A6;margin:0;">No linked user account — roles unavailable.</p></div>';
  }
  var held = {};
  (data.roles||[]).forEach(function(r){ held[r.name]=r.granted_at; });
  var isSelf = !!data.is_self;
  var ROLE_DEFS = [['client','Client'],['coach','Coach'],['admin','Admin'],['super_admin','Super Admin']];
  var rows = ROLE_DEFS.map(function(rd){
    var nm=rd[0], label=rd[1];
    var checked = held.hasOwnProperty(nm);
    var when = (checked && held[nm]) ? ' <span style="color:#7A96A6;font-size:11px;">granted '+_esc(_fmtFull(held[nm]))+'</span>' : '';
    var disabled = (nm==='super_admin' && isSelf) ? 'disabled title="You cannot change your own super_admin role."' : '';
    return '<label style="display:block;margin-bottom:6px;font-size:13px;color:#1A2B33;">'
      + '<input type="checkbox" data-user-id="'+uid+'" data-role="'+nm+'" '+(checked?'checked':'')+' '+disabled+' onchange="window._toggleRole(this)" style="margin-right:8px;vertical-align:middle;">'
      + label + when + '</label>';
  }).join('');
  var statusBlock;
  if(data.user_is_active===false){
    statusBlock = '<span style="background:#fdecea;color:#c0392b;padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;">Banned</span>'
      + ' <button onclick="window._unbanUserAction('+uid+')" style="background:#1a7a4a;color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:12px;font-weight:700;padding:6px 12px;cursor:pointer;margin-left:8px;">Restore user</button>';
  } else {
    var banAttr = isSelf ? 'disabled title="You cannot ban your own account." style="background:#c0392b;color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:12px;font-weight:700;padding:6px 12px;margin-left:8px;opacity:0.5;cursor:not-allowed;"' : 'style="background:#c0392b;color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:12px;font-weight:700;padding:6px 12px;cursor:pointer;margin-left:8px;"';
    statusBlock = '<span style="background:#e6f7ee;color:#1a7a4a;padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;">Active</span>'
      + ' <button onclick="window._banUserAction('+uid+')" '+banAttr+'>Ban user</button>';
  }
  return head
    + '<div id="role-msg" style="display:none;background:#fdecea;color:#c0392b;border-radius:4px;padding:8px 12px;font-size:12px;margin-bottom:10px;"></div>'
    + rows
    + '<p style="font-size:11px;color:#7A96A6;margin:8px 0 14px;">Role changes take effect immediately and invalidate active sessions.</p>'
    + '<p style="font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;margin:0 0 8px;">Account Status</p>'
    + '<div>'+statusBlock+'</div>'
    + '</div>';
}

function _roleErr(msg){
  var m=document.getElementById('role-msg');
  if(m){ m.textContent=msg; m.style.display='block'; } else { alert(msg); }
}
function _refreshCoachModal(){
  if(_hiveRec && _hiveRec.coach) window.openCoachProfile(_hiveRec.coach.id);
}

window._toggleRole = function(el){
  var uid=el.dataset.userId, role=el.dataset.role, grant=el.checked;
  el.disabled=true;
  var url='/admin/users/'+uid+'/roles/'+(grant?'grant':'revoke');
  fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({role:role})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.ok){ _refreshCoachModal(); }
      else { _roleErr(d.error||'Action failed'); el.checked=!grant; el.disabled=false; }
    })
    .catch(function(){ _roleErr('Request failed'); el.checked=!grant; el.disabled=false; });
};

window._banUserAction = function(uid){
  if(!confirm('Ban this user? They will be signed out and unable to log in.')) return;
  fetch('/admin/users/'+uid+'/ban',{method:'POST',headers:{Accept:'application/json'}})
    .then(function(r){return r.json();})
    .then(function(d){ if(d.ok){ _refreshCoachModal(); } else { _roleErr(d.error||'Ban failed'); } })
    .catch(function(){ _roleErr('Request failed'); });
};

window._unbanUserAction = function(uid){
  fetch('/admin/users/'+uid+'/unban',{method:'POST',headers:{Accept:'application/json'}})
    .then(function(r){return r.json();})
    .then(function(d){ if(d.ok){ _refreshCoachModal(); } else { _roleErr(d.error||'Restore failed'); } })
    .catch(function(){ _roleErr('Request failed'); });
};

window._editCoachMode = function(){
  var data=_hiveRec; if(!data)return;
  var c=data.coach;
  var adminBadge=c.is_admin?'<span style="color:#1a7a4a;font-weight:700;">Yes</span>':'No';
  var activeBadge=c.is_active!==false?'<span style="color:#1a7a4a;">Active</span>':'<span style="color:#c0392b;">Inactive</span>';

  var h=_modalHeader('Edit Coach',c.name,'#f58527');
  h+='<div id="modal-err" style="display:none;background:#fdecea;color:#c0392b;border-radius:4px;padding:10px 14px;font-size:13px;margin-bottom:14px;"></div>';
  h+=_editInput('m_cname','Full Name',c.name,true);
  h+=_editInput('m_cemail','Email',c.email,true,'email');
  h+=_editInput('m_corg','Organization',c.organization || '',false);
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
  var organization=(document.getElementById('m_corg').value||'').trim();
  var note=(document.getElementById('m_note').value||'').trim();
  errDiv.style.display='none';
  if(!name){errDiv.textContent='Full name is required.';errDiv.style.display='';return;}
  if(!email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){errDiv.textContent='A valid email address is required.';errDiv.style.display='';return;}
  saveBtn.disabled=true; saveBtn.textContent='Saving…';
  try{
    var coachId=_hiveRec.coach.id;
    var resp=await fetch('/admin/coaches/'+coachId+'/update',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({name:name,email:email,organization:organization||null,note:note||null})});
    var data=await resp.json();
    if(!resp.ok||!data.success){errDiv.textContent=data.error||'Update failed.';errDiv.style.display='';saveBtn.disabled=false;saveBtn.textContent='Save Changes';return;}
    // Update coach name links in page
    document.querySelectorAll('[data-entity="coach-'+coachId+'"]').forEach(function(el){el.textContent=name;});
    _hiveRec.coach=Object.assign({},_hiveRec.coach,{name:name,email:email,organization:organization||null});
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
  <p style="text-align:center;margin-top:16px;margin-bottom:0;">
    <a href="/admin/forgot-password"
       style="font-size:13px;color:#7A96A6;text-decoration:none;">
      Forgot your password?
    </a>
  </p>
</div>
</body>
</html>`;
}

app.get('/admin/login', (req, res) => {
  if (req.session && req.session.user_id) return res.redirect('/admin');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderLoginPage(null));
});

app.post('/admin/login', async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password || '';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // 1) Rate limit by IP (IAA §4.1). Counts every attempt; blocks past the window cap.
  if (auth.checkRateLimit(req.ip)) {
    await auth.logAuthEvent(null, 'login_rate_limited', req, { email });
    return res.send(renderLoginPage('Too many sign-in attempts. Please wait 15 minutes.'));
  }

  // 2) Embargo check (IAA §4.3/§4.4) — generic error, never reveal the block.
  if (await auth.checkEmbargo(email)) {
    await auth.logAuthEvent(null, 'login_embargoed', req, { email });
    return res.send(renderLoginPage('Invalid email or password.'));
  }

  // 3) User lookup. Generic error whether the email is unknown or has no password.
  const user = await auth.getUserByEmail(email);
  if (!user || !user.password_hash) {
    await auth.logAuthEvent(null, 'login_failed', req, { email, reason: 'user_not_found' });
    return res.send(renderLoginPage('Invalid email or password.'));
  }

  // 4) Full ban — inactive account.
  if (user.is_active === false) {
    await auth.logAuthEvent(user.id, 'login_account_inactive', req);
    return res.send(renderLoginPage('This account has been deactivated. Please contact an administrator.'));
  }

  // 5) Account lockout (IAA §4.2).
  if (auth.checkAccountLock(user)) {
    await auth.logAuthEvent(user.id, 'login_account_locked', req);
    return res.send(renderLoginPage('Account temporarily locked. Please try again later.'));
  }

  // 6) Verify password. On failure, increment the lockout counter.
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    await auth.incrementFailedAttempts(user.id);
    await auth.logAuthEvent(user.id, 'login_failed', req, { reason: 'bad_password' });
    return res.send(renderLoginPage('Invalid email or password.'));
  }

  // 7) Success path — load the role set and resolve the coach domain row (may be
  //    null for a future client-only user).
  const roles = await auth.getUserRoles(user.id);
  const coach = await auth.resolveCoachByUserId(user.id);

  // 8) Fresh session (fixation protection); populate identity + roles. The two
  //    coach_is_* booleans are intentionally gone — access derives from roles.
  req.session.regenerate(async (err) => {
    if (err) {
      console.error('[admin/login] session regenerate error:', err.message);
      return res.send(renderLoginPage('Sign-in failed — please try again.'));
    }
    req.session.user_id    = user.id;
    req.session.roles      = roles;
    req.session.coach_id   = coach ? coach.id : null;
    req.session.coach_name = coach ? coach.name : null;
    await auth.recordLoginSuccess(user.id, req);
    await auth.logAuthEvent(user.id, 'login_success', req);
    res.redirect('/admin');
  });
});

app.get('/admin/logout', async (req, res) => {
  const userId = req.session.user_id;
  if (userId) {
    await auth.logAuthEvent(userId, 'logout', req).catch(() => {});
  }
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ═══ IAA v1.2 — Phase C: password reset flow ════════════════════════════════════

// Shared card chrome (matches renderLoginPage exactly) + success/muted/backlink styles.
const RESET_PAGE_STYLE = `
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
  .success { background: #eafaf1; color: #1e8449; border-radius: 4px; padding: 10px 14px; font-size: 13px; margin-bottom: 20px; }
  .muted { font-size: 12px; color: #7A96A6; margin: -8px 0 0; }
  .backlink { display: block; text-align: center; margin-top: 20px; font-size: 13px; color: #7A96A6; text-decoration: none; }
  .backlink:hover { color: #00b1d7; }
`;

function renderForgotPasswordPage(message, isError) {
  // Success message hides the form (nothing more to do); errors keep the form so the
  // user can request a fresh link inline.
  const showForm = !(message && !isError);
  const banner = message
    ? (isError ? `<div class="error">${message}</div>` : `<div class="success">${message}</div>`)
    : '';
  const form = showForm ? `
  <form method="POST" action="/admin/forgot-password">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required autocomplete="username">
    <button type="submit">Send Reset Link</button>
  </form>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hive Admin — Reset Password</title>
<style>${RESET_PAGE_STYLE}</style>
</head>
<body>
<div class="card">
  <div class="logo-bar">
    <p>Hive Enneagram Type Tool</p>
    <h1>Reset Password</h1>
  </div>
  ${banner}${form}
  <a href="/admin/login" class="backlink">← Back to sign in</a>
</div>
</body>
</html>`;
}

function renderResetPasswordPage(errorMsg, token) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hive Admin — Set New Password</title>
<style>${RESET_PAGE_STYLE}</style>
</head>
<body>
<div class="card">
  <div class="logo-bar">
    <p>Hive Enneagram Type Tool</p>
    <h1>Set New Password</h1>
  </div>
  ${errorMsg ? `<div class="error">${errorMsg}</div>` : ''}
  <form method="POST" action="/admin/reset-password/${token}">
    <label for="new_password">New Password</label>
    <input type="password" id="new_password" name="new_password" required autocomplete="new-password">
    <label for="confirm_password">Confirm New Password</label>
    <input type="password" id="confirm_password" name="confirm_password" required autocomplete="new-password">
    <p class="muted">Minimum 10 characters, one uppercase letter, one number.</p>
    <button type="submit" style="margin-top:20px;">Set New Password</button>
  </form>
  <a href="/admin/login" class="backlink">← Back to sign in</a>
</div>
</body>
</html>`;
}

// Best-effort reset email (mirrors sendInviteEmail): logs on failure, never throws —
// enumeration safety requires the route response be identical regardless of outcome.
async function sendPasswordResetEmail(toEmail, resetUrl) {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    console.warn('[auth] SendGrid not configured — reset email not sent');
    return;
  }
  const msg = {
    to:      toEmail,
    from:    { name: 'InsightOut by Hive', email: process.env.SENDGRID_FROM_EMAIL },
    subject: 'Reset your InsightOut admin password',
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1A2B33; line-height: 1.7;">
        <div style="border-top: 4px solid #00b1d7; padding-top: 28px; margin-bottom: 24px;">
          <h1 style="font-size: 22px; color: #00b1d7; margin: 0; font-weight: 700;">Reset your password</h1>
        </div>

        <p style="font-size:15px;">We received a request to reset the password for this admin account. Click the button below to set a new password.</p>

        <p style="margin: 32px 0;">
          <a href="${resetUrl}" style="display:inline-block;background:#00b1d7;color:#fff;padding:14px 28px;border-radius:4px;font-weight:700;text-decoration:none;font-size:15px;">Reset Password →</a>
        </p>

        <p style="font-size: 13px; color: #4A6070;">Or copy this link:<br>
          <a href="${resetUrl}" style="color:#00b1d7;">${resetUrl}</a>
        </p>

        <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #E0E8EC; font-size: 11px; color: #7A96A6;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </div>
      </div>
    `,
  };
  try {
    await sgMail.send(msg);
    console.log(`[auth] reset email sent to ${toEmail}`);
  } catch (e) {
    console.error('[auth] reset email send failed:', e.message);
  }
}

// Best-effort security notification sent after any admin password change (reset flow
// or authenticated change-password form). Never throws — the route behavior and
// redirect are unchanged regardless of send outcome.
async function sendPasswordChangedEmail(toEmail) {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    console.warn('[auth] SendGrid not configured — password changed email not sent');
    return;
  }
  const msg = {
    to:      toEmail,
    from:    { name: 'InsightOut by Hive', email: process.env.SENDGRID_FROM_EMAIL },
    subject: 'Your InsightOut admin password was changed',
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1A2B33; line-height: 1.7;">
        <div style="border-top: 4px solid #00b1d7; padding-top: 28px; margin-bottom: 24px;">
          <h1 style="font-size: 22px; color: #00b1d7; margin: 0; font-weight: 700;">Password changed</h1>
        </div>
        <p style="font-size: 15px;">Your InsightOut admin password was recently changed.</p>
        <p style="font-size: 15px;">If you made this change, no action is needed.</p>
        <p style="font-size: 15px;">If you did not make this change, please contact us immediately at
          <a href="mailto:${process.env.SENDGRID_FROM_EMAIL}" style="color:#00b1d7;">
            ${process.env.SENDGRID_FROM_EMAIL}
          </a>.
        </p>
        <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #E0E8EC; font-size: 11px; color: #7A96A6;">
          This is an automated security notification from InsightOut by Hive.
        </div>
      </div>
    `,
  };
  try {
    await sgMail.send(msg);
    console.log(`[auth] password changed notification sent to ${toEmail}`);
  } catch (e) {
    console.error('[auth] password changed email failed:', e.message);
  }
}

// The generic confirmation returned for every forgot-password outcome (unknown email,
// rate-limited, or sent) — never reveals whether an account exists.
const RESET_GENERIC_CONFIRMATION = 'If that email is registered, a reset link is on its way.';

app.get('/admin/forgot-password', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderForgotPasswordPage(null, false));
});

app.post('/admin/forgot-password', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const email = (req.body.email || '').toLowerCase().trim();

  // 1) Rate limit by email — console-only (no auth_events: no user_id, and logging
  //    would confirm the address exists).
  if (auth.checkResetRateLimit(email)) {
    console.warn('[auth] reset rate limit hit');
    return res.send(renderForgotPasswordPage(RESET_GENERIC_CONFIRMATION, false));
  }

  // 2) Look up the user. Unknown email → identical response (enumeration safety).
  const user = await auth.getUserByEmail(email);
  if (!user) {
    console.warn('[auth] reset requested for unknown email');
    return res.send(renderForgotPasswordPage(RESET_GENERIC_CONFIRMATION, false));
  }

  // 3) Mint a token, email the link, audit the request.
  const rawToken = await auth.generateResetToken(user.id);
  const appUrl = process.env.RAILWAY_PUBLIC_URL || 'https://enneagram.hiveleadership.com';
  const resetUrl = `${appUrl}/admin/reset-password/${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
  await auth.logAuthEvent(user.id, 'password_reset_requested', req, null);
  return res.send(renderForgotPasswordPage(RESET_GENERIC_CONFIRMATION, false));
});

app.get('/admin/reset-password/:token', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const token = req.params.token;
  const result = await auth.validateResetToken(token);
  if (!result.valid) {
    const messages = {
      expired: 'This reset link has expired. Please request a new one.',
      already_used: 'This reset link has already been used. Please request a new one.',
      not_found: 'This reset link is invalid. Please request a new one.',
    };
    const msg = messages[result.reason] || messages.not_found;
    return res.send(renderForgotPasswordPage(msg, true));
  }
  return res.send(renderResetPasswordPage(null, token));
});

app.post('/admin/reset-password/:token', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const token = req.params.token;
  const { new_password, confirm_password } = req.body;

  if ((new_password || '') !== (confirm_password || '')) {
    return res.send(renderResetPasswordPage('Passwords do not match.', token));
  }

  const strength = auth.validatePasswordStrength(new_password || '');
  if (!strength.valid) {
    return res.send(renderResetPasswordPage(strength.reason, token));
  }

  const newHash = await bcrypt.hash(new_password, 12);
  const result = await auth.redeemResetToken(token, newHash);
  if (!result.ok) {
    // Token may have expired or been used between GET and POST.
    const messages = {
      expired: 'This reset link has expired. Please request a new one.',
      already_used: 'This reset link has already been used. Please request a new one.',
      not_found: 'This reset link is invalid. Please request a new one.',
    };
    const msg = messages[result.reason] || messages.not_found;
    return res.send(renderForgotPasswordPage(msg, true));
  }

  await auth.logAuthEvent(result.userId, 'password_changed', req, { source: 'reset' });
  const changedUser = await db.getUserById(result.userId);
  if (changedUser && changedUser.email) {
    await sendPasswordChangedEmail(changedUser.email).catch(() => {});
  }
  res.redirect('/admin/login?flash=password_reset');
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

  const user = await db.getUserById(req.session.user_id);
  if (!user || !user.password_hash) {
    return res.send(renderChangePasswordPage('Could not verify current password.'));
  }

  const currentMatch = await bcrypt.compare(current_password || '', user.password_hash);
  if (!currentMatch) {
    return res.send(renderChangePasswordPage('Current password is incorrect.'));
  }

  if ((new_password || '') !== (confirm_password || '')) {
    return res.send(renderChangePasswordPage('New passwords do not match.'));
  }

  const strength = auth.validatePasswordStrength(new_password || '');
  if (!strength.valid) {
    return res.send(renderChangePasswordPage(strength.reason));
  }

  const newHash = await bcrypt.hash(new_password, 12);
  await auth.updateUserPassword(req.session.user_id, newHash);
  await auth.logAuthEvent(req.session.user_id, 'password_changed', req, { source: 'change_form' });
  console.log(`[admin/password] password updated for user #${req.session.user_id}`);
  await auth.invalidateAllSessions(req.session.user_id);
  const pwUser = await db.getUserById(req.session.user_id);
  if (pwUser && pwUser.email) {
    await sendPasswordChangedEmail(pwUser.email).catch(() => {});
  }
  res.redirect('/admin/login?flash=password_changed');
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
      // createClient returns null when its INSERT throws (db.query swallows the
      // error). The one throw source on the current schema is the clients_email_key
      // UNIQUE index — so a null return almost always means the email already
      // exists. Surface that specifically instead of the opaque generic message.
      const existing = await db.getClientByEmail(email.trim().toLowerCase()).catch(() => null);
      const msg = existing
        ? 'A client with this email already exists. Use the existing client, or enter a different email.'
        : 'Failed to create client — please try again.';
      return res.send(renderNewClientPage(msg, req.body));
    }
    // PR B: lifecycle audit — client created by a coach/super-admin.
    db.logClientEvent({
      clientId, assessmentId: null,
      eventType: 'client_created',
      eventDescription: 'Client created',
      actor: req.session.coach_name,
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.createClientToken(clientId, token, expiresAt);

    const clientRow = { first_name: first_name.trim(), last_name: last_name.trim(), email: email.trim().toLowerCase() };
    const coach = await db.getCoachById(req.session.coach_id);
    await sendInviteEmail(clientRow, token, coach);
    // PR B: lifecycle audit — invitation sent.
    db.logClientEvent({
      clientId, assessmentId: null,
      eventType: 'invitation_sent',
      eventDescription: 'Invitation sent',
      actor: req.session.coach_name,
    });

    console.log(`[admin/clients/new] created client #${clientId} and sent invite`);
    res.redirect('/admin?flash=invite_sent');
  } catch (e) {
    console.error('[admin/clients/new] error:', e.message);
    res.send(renderNewClientPage('An error occurred — please try again.', req.body));
  }
});

// ── Resend Invite ─────────────────────────────────────────────────────────────

app.post('/admin/clients/resend/:client_id', requireAdminSession, async (req, res) => {
  // Content-negotiated: the dashboard POST form expects a redirect (+ flash); the
  // coach-accordion fetch sends Accept: application/json and expects { ok }.
  const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) {
    if (wantsJson) return res.status(400).json({ ok: false, error: 'Invalid client ID' });
    return res.status(400).send('Invalid client ID');
  }

  const ownerCoachId = await db.getClientCoachId(clientId);
  const isSuperAdmin = auth.hasRole(req, 'super_admin');
  if (!isSuperAdmin && ownerCoachId !== req.session.coach_id) {
    if (wantsJson) return res.status(403).json({ ok: false, error: 'Forbidden' });
    return res.status(403).send('Forbidden');
  }

  try {
    const client = await db.getClientById(clientId);
    if (!client) {
      if (wantsJson) return res.status(404).json({ ok: false, error: 'Client not found' });
      return res.status(404).send('Client not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.resendInviteTransaction(clientId, token, expiresAt);
    // Invite identity is the client's OWNING coach (reply-to / signature), not the
    // actor — a super-admin resending another coach's invite must still send it from
    // that coach. Falls back to the actor's coach when the owner is unknown.
    const coach = await db.getCoachById(ownerCoachId || req.session.coach_id);
    await sendInviteEmail({ first_name: client.first_name, last_name: client.last_name, email: client.email }, token, coach);
    // PR B: lifecycle audit — invitation re-sent.
    db.logClientEvent({
      clientId, assessmentId: null,
      eventType: 'invitation_sent',
      eventDescription: 'Invitation re-sent',
      actor: req.session.coach_name,
    });

    console.log(`[admin/clients/resend] resent invite for client #${clientId}`);
    if (wantsJson) return res.json({ ok: true });
    res.redirect('/admin?flash=invite_resent');
  } catch (e) {
    console.error('[admin/clients/resend] error:', e.message);
    if (wantsJson) return res.status(500).json({ ok: false, error: 'Resend failed' });
    res.redirect('/admin');
  }
});

// ── Retake (super-admin only) ──────────────────────────────────────────────────
// Issue a fresh assessment to a completed client while preserving their prior
// assessment row(s). requireSuperAdmin gates the route (defense-in-depth behind the
// super-admin-only button). The new assessment row is created later by /api/submit,
// which stamps retake_of_assessment_id; here we only reopen the invite.
app.post('/admin/clients/:client_id/retake', requireSuperAdmin, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  try {
    const client = await db.getClientById(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found.' });
    if (client.status !== 'complete') {
      return res.status(400).json({ error: 'Retake is only available for clients who have completed an assessment.' });
    }

    // Invite is sent from the client's own coach, not the acting super-admin.
    const clientInfo = await db.getClientWithCoach(clientId);
    const coach = {
      name: clientInfo.coach_name,
      email: clientInfo.coach_email,
      organization: clientInfo.coach_organization,
    };

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.retakeTransaction(clientId, token, expiresAt);
    await sendInviteEmail({ first_name: client.first_name, last_name: client.last_name, email: client.email }, token, coach);

    // PR B: lifecycle audit — retake issued by a super-admin. The retake's own
    // "started/completed/report delivered" events are logged through the normal
    // assessment flow (runBackgroundJob branches on isRetake).
    db.logClientEvent({
      clientId, assessmentId: null,
      eventType: 'retake_issued',
      eventDescription: `Retake issued (invitation sent)`,
      actor: req.session.coach_name,
    });
    // HOOK: Retake requested by coach — not yet built
    // HOOK: Retake approved by super-admin — not yet built
    // HOOK: Retake denied by super-admin — not yet built

    console.log(`[admin/clients/retake] retake issued for client #${clientId} by coach #${req.session.coach_id}`);
    return res.json({ success: true });
  } catch (e) {
    console.error('[admin/clients/retake] error:', e.message);
    return res.status(500).json({ error: 'Retake failed — please try again.' });
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

  // Token not found → Invalid Link SPA screen (§10.3). No client data — the token
  // didn't resolve, so the SPA renders generic copy with no personalization.
  if (!tokenRow) {
    try {
      let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
      return res.send(injectAssessmentBootstrap(html, null, { route: 'invalid-token' }));
    } catch (e) {
      console.error('[assessment/:token invalid] serve error:', e.message);
      return res.send(renderAssessmentGate('Link Not Found',
        'This assessment link is not valid. Please contact your coach to request a new invite.', ''));
    }
  }

  // Token resolved but expired → Expired Link SPA screen (§10.2). Generic coach
  // copy for alpha (Decision C) — no personalization despite the record resolving.
  if (new Date(tokenRow.expires_at) < new Date()) {
    try {
      let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
      return res.send(injectAssessmentBootstrap(html, null, { route: 'expired-token' }));
    } catch (e) {
      console.error('[assessment/:token expired] serve error:', e.message);
      return res.send(renderAssessmentGate('Link Expired',
        'This assessment link has expired. Please contact your coach to request a new invite.', ''));
    }
  }

  if (tokenRow.client_status === 'complete') {
    return res.send(renderAssessmentGate(
      'Assessment Complete',
      `You've already completed your Hive Enneagram assessment, ${esc(tokenRow.first_name)}. Your coach will be in touch to discuss your results.`,
      ''
    ));
  }

  if (tokenRow.client_status === 'processing') {
    return res.send(renderAssessmentGate(
      'Assessment Being Processed',
      "Your assessment is being processed. You'll receive your results by email shortly — there's nothing more you need to do.",
      ''
    ));
  }

  if (tokenRow.client_status === 'in_progress') {
    if (tokenRow.session_state) {
      // Resumable — inject intake + saved session state and serve the full app
      try {
        let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
        const intake = {
          firstName:         tokenRow.first_name,
          lastName:          tokenRow.last_name,
          email:             tokenRow.email,
          organization:      tokenRow.organization || '',
          coach:             tokenRow.coach_name,
          coach_email:       tokenRow.coach_email,
          coach_organization: tokenRow.coach_organization,
          client_id:         tokenRow.client_id,
          token:             req.params.token,
        };
        const sessionTag = `<script>window.__hiveSessionState = ${JSON.stringify(tokenRow.session_state)};</script>`;
        // Refresh vs. cold return. /begin stamps req.session.assessmentClientId, so
        // an active browser session (a refresh of an in-flight assessment) carries it.
        // A genuine cold return — clicking the saved link from a new session/device —
        // does not. Refresh → 'resume-direct': the SPA rehydrates and lands the client
        // straight back on the screen they were on. Cold return → 'resume': the §0G
        // "Welcome back" screen (its specced trigger: "clicks their saved assessment
        // link"). app.js only shows the Resume screen for route === 'resume', so
        // 'resume-direct' falls through to the saved phase with no client change.
        const activeSession = !!(req.session && req.session.assessmentClientId === tokenRow.client_id);
        const route = activeSession ? 'resume-direct' : 'resume';
        html = injectAssessmentBootstrap(html, intake, { route, is_beta: tokenRow.is_beta === true }).replace('</head>', `${sessionTag}\n</head>`);
        return res.send(html);
      } catch (e) {
        console.error('[assessment/resume] index.html read error:', e.message);
      }
    }
    // In progress with no saved state — two very different situations:
    //  1. Submitted, but the background job failed. /api/submit clears session_state
    //     and the failure path reverts status to in_progress (server.js ~973), while
    //     an assessments row with the client's responses already exists. Re-serving
    //     the SPA would let them re-take the whole assessment and create a duplicate
    //     submission — so show a gate; the coach retries the API and their responses
    //     are safe server-side.
    //  2. Never submitted — a refresh during the pre-assessment screens (Welcome /
    //     intake / profile-confirm / orientation), before the first Stage 0 save.
    //     Nothing to resume, so fall through and re-serve the SPA fresh rather than
    //     dead-ending the client. /begin is idempotent for an already-in_progress
    //     client, so re-entering the pre-assessment flow is lossless.
    const submitted = await db.getAssessmentPayload(tokenRow.client_id).catch(() => null);
    if (submitted) {
      return res.send(renderAssessmentGate(
        'Assessment Received',
        `Thanks, ${esc(tokenRow.first_name)} — we've received your responses and your report is being prepared. If it doesn't arrive shortly, please reach out to your coach.`,
        ''
      ));
    }
    // Never submitted — fall through to re-serve the SPA fresh.
  }

  // not_started, or in_progress with no saved state yet — serve the SPA; it owns
  // the full pre-assessment flow (Welcome → profile-confirm/intake → orientation →
  // Stage 0). The bootstrap carries the route flag (§0A: profile-confirm when the
  // record is complete, else intake) and the active coach roster for the intake form.
  try {
    const intake = {
      firstName:          tokenRow.first_name,
      lastName:           tokenRow.last_name,
      email:              tokenRow.email,
      organization:       tokenRow.organization || '',
      coach:              tokenRow.coach_name,
      coach_email:        tokenRow.coach_email,
      coach_organization: tokenRow.coach_organization,
      client_id:          tokenRow.client_id,
      token:              req.params.token,
    };
    const recordComplete = !!(tokenRow.first_name && tokenRow.last_name && tokenRow.email && tokenRow.coach_name);
    let coaches = [];
    try {
      const all = await db.getAllCoaches();
      coaches = (all || []).filter((c) => c.is_active).map((c) => c.name);
    } catch (e) { /* roster is best-effort; intake falls back to seeded coaches */ }
    const bootstrap = { route: recordComplete ? 'profile-confirm' : 'intake', coaches, is_beta: tokenRow.is_beta === true };
    let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    html = injectAssessmentBootstrap(html, intake, bootstrap);
    return res.send(html);
  } catch (e) {
    console.error('[assessment/:token not_started] serve error:', e.message);
    return res.send(renderAssessmentGate(
      'Something went wrong',
      'Please try opening your link again, or contact your coach.',
      ''
    ));
  }
});

// Commit the session to in_progress. Now called by the SPA via fetch from the
// Welcome "Start Assessment" click (Decision D), so it returns JSON rather than
// redirecting. Idempotent: a repeat begin only re-affirms the session.
app.post('/assessment/:token/begin', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const tokenRow = await db.getTokenWithClient(req.params.token);

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date() || tokenRow.client_status === 'complete') {
    return res.status(400).json({ error: 'Assessment not available.' });
  }

  // Only flip on the first begin; never overwrite an already-started session.
  if (tokenRow.client_status === 'not_started') {
    await db.updateClientStatus(tokenRow.client_id, 'in_progress');
    await db.updateTokenUsedAt(tokenRow.token_id);
  }

  req.session.assessmentClientId = tokenRow.client_id;
  req.session.assessmentIntake = {
    firstName:    tokenRow.first_name,
    lastName:     tokenRow.last_name,
    email:        tokenRow.email,
    organization: tokenRow.organization || '',
    coach:        tokenRow.coach_name,
    client_id:    tokenRow.client_id,
    token:        req.params.token,
  };

  req.session.save((err) => {
    if (err) console.error('[assessment/begin] session save error:', err.message);
    res.json({ ok: true });
  });
});

// Save mid-assessment session state — called by the browser on stage advance
// and by the Save and Continue Later button. Token is the identity mechanism.
app.post('/assessment/:token/save', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const tokenRow = await db.getTokenWithClient(req.params.token);
  if (!tokenRow) return res.status(400).json({ error: 'Token not found.' });
  if (new Date(tokenRow.expires_at) < new Date()) return res.status(400).json({ error: 'Token expired.' });
  if (tokenRow.client_status !== 'in_progress') return res.status(400).json({ error: 'Assessment not in progress.' });
  const sessionState = req.body && req.body.sessionState;
  if (!sessionState || typeof sessionState !== 'object') return res.status(400).json({ error: 'Invalid sessionState.' });
  // §9.2/§9.5 timing: server-authoritative assessment_started_at, anchored to the
  // Stage 0 Q1 answer. Two independent events share the /save endpoint:
  //   • Stage-0-entry save (orientation "Let's begin"): persists state so a refresh
  //     on Q1 resumes — but Q1 isn't answered yet, so it must NOT stamp the clock.
  //   • Q1-answer save (advancing off Q1): stage0Answers.q1 is populated → stamp NOW.
  // Gating on "Q1 answered" (rather than "first save") keeps the start time pinned to
  // Q1 even though an earlier save now exists. The client never carries this field, so
  // once set it's preserved from the DB on every later save — idempotent across resumes.
  const existingStart = tokenRow.session_state && tokenRow.session_state.assessment_started_at;
  const q1Answered = !!(sessionState.stage0Answers
    && typeof sessionState.stage0Answers.q1 === 'string'
    && sessionState.stage0Answers.q1.trim().length > 0);
  if (existingStart) {
    sessionState.assessment_started_at = existingStart;          // preserve — never overwrite
  } else if (q1Answered) {
    sessionState.assessment_started_at = new Date().toISOString(); // first stamp, at Q1
    // PR B: lifecycle audit — assessment started (first Stage 0 Q1 save). Logged once,
    // at the first stamp only (the existingStart branch never reaches here). Client-driven,
    // so actor is 'system'. assessment_id is null — the assessments row is created at submit.
    db.logClientEvent({
      clientId: tokenRow.client_id, assessmentId: null,
      eventType: 'assessment_started',
      eventDescription: 'Assessment started (Stage 0 began)',
      actor: 'system',
    });
  }
  // else: Stage-0-entry save before Q1 — persist state, leave started_at unset.
  await db.saveClientSessionState(tokenRow.client_id, sessionState);
  return res.json({ ok: true });
});

// Confirmation page after Save and Continue Later
app.get('/assessment/:token/saved', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderAssessmentGate(
    'Progress Saved',
    'Your progress has been saved. Return to your invite link anytime to continue where you left off.',
    ''
  ));
});

app.patch('/assessment/:token/profile', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const tokenRow = await db.getTokenWithClient(req.params.token).catch(() => null);
  if (!tokenRow) return res.status(404).json({ error: 'Token not found.' });
  if (new Date(tokenRow.expires_at) < new Date()) return res.status(410).json({ error: 'This link has expired.' });
  // Decision D: edits are allowed before Start (not_started) and after Start
  // (in_progress, via the §0A "Edit your profile" flow). Reject only terminal states.
  if (!['not_started', 'in_progress'].includes(tokenRow.client_status)) {
    return res.status(409).json({ error: 'Assessment can no longer be edited.' });
  }
  const firstName    = (req.body.first_name   || '').trim();
  const lastName     = (req.body.last_name    || '').trim();
  const email        = (req.body.email        || '').trim();
  const organization = (req.body.organization || '').trim() || null;
  const coachName    = (req.body.coach        || '').trim();
  if (!firstName || !lastName) return res.status(400).json({ error: 'First name and last name are required.' });

  // Resolve coach name → coach_id when provided and recognised; leave unchanged otherwise.
  let coachId = null;
  if (coachName) { try { coachId = await db.findOrCreateCoach(coachName); } catch (e) { coachId = null; } }

  await db.query(
    `UPDATE clients
       SET first_name = $1,
           last_name  = $2,
           email      = COALESCE(NULLIF($3, ''), email),
           organization = $4,
           coach_id   = COALESCE($5, coach_id),
           updated_at = NOW(),
           updated_by = 'self'
     WHERE id = $6`,
    [firstName, lastName, email, organization, coachId, tokenRow.client_id]
  );
  console.log(`[assessment/profile] client #${tokenRow.client_id} updated their profile`);
  return res.json({ success: true });
});

// ── Coach Management (super-admin only) ──────────────────────────────────────

function renderCoachesPage(coaches, errorMsg, flashMsg, isSuperAdmin = false) {
  const TYPE_NAMES_LOCAL = {
    1: 'The Improver', 2: 'The Giver',   3: 'The Performer', 4: 'The Idealist',
    5: 'The Observer', 6: 'The Questioner', 7: 'The Enthusiast',
    8: 'The Protector', 9: 'The Peacemaker',
  };

  const coachRowPairs = coaches.map(co => {
    const name        = esc(co.name);
    const email       = esc(co.email);
    const organization = co.organization ? esc(co.organization) : '—';
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
      <td style="color:#7A96A6;font-size:12px;">${organization}</td>
      <td>${isAdminFlag}</td>
      <td>${statusLabel}</td>
      <td style="text-align:center;">${clientsLink}</td>
      <td>${toggleAction}${reassignControl}</td>
    </tr>`;

    const accordionRow = `<tr id="accordion-${co.id}" style="display:none;">
      <td colspan="7" style="padding:0;background:#f7f5f2;border-bottom:2px solid #00b1d7;">
        <div id="accordion-content-${co.id}" style="padding:16px 20px;"></div>
      </td>
    </tr>`;

    return coachRow + '\n' + accordionRow;
  }).join('\n');

  const body = coaches.length === 0
    ? '<tr><td colspan="7" style="text-align:center;padding:40px;color:#7A96A6;">No coaches found.</td></tr>'
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
  .add-form { padding: 20px; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 12px; align-items: end; }
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
          <th>Organization</th>
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
        <label for="coach_organization">Organization</label>
        <input type="text" id="coach_organization" name="organization" placeholder="Organization (optional)">
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

<!-- §9.3.2 assessment-timing modal (fixed overlay; outside-click + Escape dismiss) -->
<div id="timing-modal" onclick="if(event.target===this)closeTimingModal()" style="display:none;position:fixed;inset:0;background:rgba(26,43,51,0.55);z-index:9500;align-items:center;justify-content:center;padding:24px;">
  <div style="background:#fff;border-radius:10px;max-width:420px;width:100%;padding:22px 24px;box-shadow:0 8px 30px rgba(0,0,0,.18);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:8px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#00B2D9" stroke-width="2"/><path d="M12 7.5V12l3 2" stroke="#00B2D9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span style="font-weight:700;font-size:15px;color:#1A2B33;">Completion time</span></div>
      <button onclick="closeTimingModal()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#9AA3AD;line-height:1;">&times;</button>
    </div>
    <div id="timing-modal-body"></div>
  </div>
</div>

<script>
// Super-admin flag for client-side gating (PR-F) — injected before the accordion
// renderer so the trash-can delete button can be hidden for non-super-admins.
window.__IS_SUPER_ADMIN = ${isSuperAdmin ? 'true' : 'false'};
var _accordionCache = {};
var _openCoachId = null;
// §9.3 assessment timing: per-row timing payloads (keyed by clientId), populated as
// the accordion renders, read by the timing modal. Inline SVG clock (no Tabler dep).
var _timingData = {};
var CLOCK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="8.5" stroke="#00B2D9" stroke-width="2"/><path d="M12 7.5V12l3 2" stroke="#00B2D9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
      if (clientPdf) links.push('<a href="/reports/token/'+encodeURIComponent(clientPdf)+'" style="display:block;color:#00b1d7;text-decoration:none;white-space:nowrap;">&#128196; Client</a>');
      if (coachPdf)  links.push('<a href="/reports/token/'+encodeURIComponent(coachPdf)+'" style="display:block;color:#f58527;text-decoration:none;white-space:nowrap;">&#128196; Coach</a>');
      pdfLinks = links.join('') || '—';
    }

    var hasScores    = !!r.has_scores_snapshot;
    var hasApiResult = !!r.has_api_result;

    var nameLink = '<a href="#" data-entity="client-'+clientId+'" onclick="openClientProfile('+clientId+');return false;" style="color:#00b1d7;text-decoration:underline;text-decoration-style:dotted;font-weight:600;" onmouseover="this.style.textDecorationStyle=\\'solid\\'" onmouseout="this.style.textDecorationStyle=\\'dotted\\'">'+name+'</a>';
    var reassignBtn = '<button onclick="openReassignModal('+clientId+',\\''+name.replace(/'/g,"\\\\'")+'\\','+coachId+',\\''+coach.replace(/'/g,"\\\\'")+'\\',true,'+coachId+')" style="background:none;border:none;cursor:pointer;font-size:11px;color:#00b1d7;padding:0;text-decoration:underline;margin-right:4px;">Reassign</button>';
    // Re-Run Analysis (super-admin) — production recovery for a FAILED em_only assessment
    // (scores present, api_result NULL). Shown only when em_rerun_eligible (computed
    // server-side in the clients JSON route); posts to /admin/em-rerun/:assessment_id via
    // the reRunAnalysis handler (fires a confirmation modal first). Hive Orange (#f58527),
    // destructive. Mutually exclusive with Regen, which renders only when api_result exists.
    var reRunBtn = (window.__IS_SUPER_ADMIN && hasScores && !hasApiResult && r.em_rerun_eligible && r.assessment_id)
      ? '<button onclick="reRunAnalysis('+r.assessment_id+',\\''+name.replace(/'/g,"\\\\'")+'\\',this)" style="background:none;border:none;cursor:pointer;font-size:11px;color:#f58527;padding:0;text-decoration:underline;margin-right:4px;">Re-Run Analysis</button>'
      : '';
    var regenBtn = hasApiResult
      ? '<button onclick="accordionRegen('+clientId+',\\''+name.replace(/'/g,"\\\\'")+'\\',this,'+coachId+')" style="background:none;border:none;cursor:pointer;font-size:11px;color:#f58527;padding:0;text-decoration:underline;margin-right:4px;">Regen</button>'
      : '';
    var resendBtn = hasApiResult
      ? '<button onclick="accordionResend('+clientId+',\\''+clientEmail.replace(/'/g,"\\\\'")+'\\',this)" style="background:none;border:none;cursor:pointer;font-size:11px;color:#00b1d7;padding:0;text-decoration:underline;margin-right:4px;">Resend</button>'
      : '';
    // Three-state soft delete. The super-admin accordion is the only view that
    // receives tombstones (permanently_deleted), so all three states render here.
    var asmtId = r.assessment_id;
    var isPending = !!r.deleted_at && !r.permanently_deleted;
    var isTombstone = !!r.permanently_deleted;
    var delBadge = '';
    if (isPending) delBadge = ' <span style="background:#fff3cd;color:#8b6914;font-size:10px;font-weight:700;letter-spacing:0.04em;padding:1px 6px;border-radius:3px;white-space:nowrap;">PENDING DELETION</span>';
    else if (isTombstone) delBadge = ' <span style="background:#fdecea;color:#c0392b;font-size:10px;font-weight:700;letter-spacing:0.04em;padding:1px 6px;border-radius:3px;white-space:nowrap;">PERMANENTLY DELETED</span>';

    var actionsCell;
    if (isTombstone) {
      actionsCell = '<span style="color:#9AA3AD;">—</span>';
    } else if (isPending) {
      actionsCell = (window.__IS_SUPER_ADMIN && asmtId)
        ? '<button onclick="accordionRestore('+asmtId+',\\''+name.replace(/'/g,"\\\\'")+'\\','+coachId+')" style="background:none;border:none;cursor:pointer;font-size:11px;color:#1a7a4a;padding:0;text-decoration:underline;">Restore</button>'
        : '<span style="color:#9AA3AD;">—</span>';
    } else {
      var deleteBtn = asmtId ? '<button onclick="accordionMarkDeleted('+asmtId+',\\''+name.replace(/'/g,"\\\\'")+'\\','+coachId+')" title="Delete assessment" style="background:none;border:none;cursor:pointer;font-size:13px;color:#c0392b;padding:0;">&#128465;</button>' : '';
      // Resend invite — not-started clients only (mirrors the main dashboard control).
      // Fetch-based (Accept: application/json) so it hits the content-negotiated JSON
      // branch of /admin/clients/resend/:client_id rather than the form redirect.
      var inviteResendBtn = (r.client_status === 'not_started' && !isPending && !isTombstone)
        ? '<button onclick="accordionResendInvite('+clientId+',\\''+name.replace(/'/g,"\\\\'")+'\\',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#00b1d7;padding:0;text-decoration:underline;margin-right:6px;" title="Resend invite email">Resend invite</button>'
        : '';
      // Retake — super-admin, completed clients only (mirrors the main dashboard's
      // Retake). Gated on is_latest_complete so exactly one shows per client; issuing
      // a retake resets the client to not_started (handing off to Resend invite).
      var retakeBtn = (window.__IS_SUPER_ADMIN && status === 'complete' && r.is_latest_complete)
        ? '<button onclick="accordionRetake('+clientId+',\\''+name.replace(/'/g,"\\\\'")+'\\',this,'+coachId+')" style="background:none;border:none;cursor:pointer;font-size:11px;color:#7c3aed;padding:0;text-decoration:underline;margin-right:4px;">Retake</button>'
        : '';
      actionsCell = reassignBtn+reRunBtn+regenBtn+resendBtn+retakeBtn+inviteResendBtn+deleteBtn;
    }

    // §9.3.1 clock icon — render only on Complete rows that captured timing. Stash the
    // per-row payload for the modal; the button sits inline-left of the date (5px gap).
    var clockCell = '';
    if (status === 'complete' && r.elapsed_seconds != null) {
      _timingData[clientId] = { name: name, secs: r.elapsed_seconds, days: r.session_days, started: r.assessment_started_at, completed: r.assessment_completed_at };
      clockCell = '<button title="View completion time" onclick="openTimingModal('+clientId+')" style="background:none;border:none;cursor:pointer;padding:0;margin-right:5px;vertical-align:middle;opacity:0.75;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.75">'+CLOCK_SVG+'</button>';
    }

    html += '<tr id="acc-row-'+clientId+'">' +
      '<td>'+nameLink+'</td>' +
      '<td>'+typeLabel+'</td>' +
      '<td>'+instinct+'</td>' +
      '<td>'+conf+'</td>' +
      '<td id="acc-coach-cell-'+clientId+'">'+coach+'</td>' +
      '<td>'+clockCell+date+'</td>' +
      '<td>'+_statusBadge(status)+delBadge+'</td>' +
      '<td id="acc-pdf-'+clientId+'" style="font-size:11px;">'+_pdfStatusHtml(r)+'</td>' +
      '<td id="acc-email-'+clientId+'" style="font-size:11px;">'+_emailStatusHtml(r)+'</td>' +
      '<td>'+pdfLinks+'</td>' +
      '<td>'+actionsCell+'</td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

// §9.3.2 timing modal. Same-day (session_days===1) shows times only; multi-day shows
// full date + time. Duration min 1 (Math.round, not floor). Dismiss: close button,
// outside-overlay click (bound on the overlay div), or Escape.
function _tTime(ts){ return new Date(ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); }
function _tDateTime(ts){ var d=new Date(ts); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+' at '+_tTime(ts); }
function _timingEsc(e){ if(e.key==='Escape') closeTimingModal(); }
function closeTimingModal(){
  document.getElementById('timing-modal').style.display = 'none';
  document.removeEventListener('keydown', _timingEsc);
}
function openTimingModal(clientId){
  var t = _timingData[clientId];
  if(!t) return;
  var mins = Math.max(1, Math.round(t.secs/60));
  var dayWord = (t.days===1) ? 'day' : 'days';
  var body = (t.days===1)
    ? (t.name+' completed their assessment in a single sitting.')
    : (t.name+' saved their progress and returned to complete the assessment.');
  var footer = (t.days===1)
    ? ('Started '+_tTime(t.started)+' · Completed '+_tTime(t.completed))
    : ('Started '+_tDateTime(t.started)+' · Completed '+_tDateTime(t.completed));
  var card = 'flex:1;background:#f7f5f2;border-radius:8px;padding:14px;text-align:center;';
  var num  = 'font-size:26px;font-weight:700;color:#1A2B33;';
  var unit = 'font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.05em;';
  var h = '';
  h += '<p style="font-size:13px;color:#4A6070;line-height:1.6;margin:0 0 16px;">'+body+'</p>';
  h += '<div style="display:flex;gap:12px;margin-bottom:16px;">';
  h += '<div style="'+card+'"><div style="'+num+'">'+mins+'</div><div style="'+unit+'">min</div></div>';
  h += '<div style="'+card+'"><div style="'+num+'">'+t.days+'</div><div style="'+unit+'">'+dayWord+'</div></div>';
  h += '</div>';
  h += '<div style="font-size:12px;color:#9AA3AD;border-top:1px solid #EFE8E0;padding-top:12px;">'+footer+'</div>';
  document.getElementById('timing-modal-body').innerHTML = h;
  document.getElementById('timing-modal').style.display = 'flex';
  document.addEventListener('keydown', _timingEsc);
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

// Re-Run Analysis handler (super-admin). Fires a confirmation modal, then re-runs the full
// EM pipeline on a FAILED em_only assessment via POST /admin/em-rerun/:assessment_id,
// force-writing the new result into production and re-delivering reports.
function reRunAnalysisModal(onContinue) {
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;';
  var box = document.createElement('div');
  box.style.cssText = 'background:#fff;max-width:460px;width:90%;border-radius:6px;padding:24px 26px;box-shadow:0 8px 30px rgba(0,0,0,.3);';
  box.innerHTML = '<h3 style="margin:0 0 12px;font-size:18px;color:#1a2330;">Re-Run Analysis</h3>'
    + '<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#3a4250;">Re-running the analysis updates the Client and Coach reports. Any changes made by the analysis are permanent. If you wish to keep the old reports, please exit this message and download those reports first. Then re-run the analysis.</p>'
    + '<div style="text-align:right;">'
    + '<button id="rra-cancel" style="background:none;border:1px solid #c5ccd6;border-radius:4px;cursor:pointer;font-size:13px;color:#3a4250;padding:7px 16px;margin-right:8px;">Cancel</button>'
    + '<button id="rra-continue" style="background:#f58527;border:none;border-radius:4px;cursor:pointer;font-size:13px;color:#fff;padding:7px 16px;">Continue</button>'
    + '</div>';
  ov.appendChild(box);
  document.body.appendChild(ov);
  function close(){ ov.remove(); }
  ov.addEventListener('click', function(e){ if (e.target === ov) close(); });   // outside-click dismiss, no state change
  box.querySelector('#rra-cancel').addEventListener('click', close);
  box.querySelector('#rra-continue').addEventListener('click', function(){ close(); onContinue(); });
}
function reRunAnalysis(assessmentId, name, btn) {
  reRunAnalysisModal(async function(){
    var orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
    try {
      var r = await fetch('/admin/em-rerun/'+assessmentId, {method:'POST',headers:{Accept:'application/json'}});
      var d = await r.json();
      if (d.success) {
        btn.style.display = 'none';
        showToast('Re-Run Analysis complete. Reports re-delivered.');
        setTimeout(function(){ location.reload(); }, 1200);
      } else { alert(d.error || 'Re-Run Analysis failed'); btn.disabled = false; btn.textContent = orig; }
    } catch(e) { alert('Request failed'); btn.disabled = false; btn.textContent = orig; }
  });
}
// DEAD CODE — retired 2026-06-20. Mark for removal in post-beta cleanup sweep.
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

// Resend the INVITE email for a not-started client (distinct from accordionResend,
// which re-sends the results email post-completion). Sends Accept: application/json so
// the content-negotiated route returns { ok } instead of a redirect.
async function accordionResendInvite(clientId, clientName, btn) {
  if (!confirm('Resend invite to '+clientName+'?')) return;
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    var r = await fetch('/admin/clients/resend/'+clientId, {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.ok) { btn.textContent = 'Sent ✓'; btn.style.color = '#27ae60'; }
    else { btn.textContent = 'Failed'; btn.style.color = '#c0392b'; btn.disabled = false; }
  } catch(e) { btn.textContent = 'Failed'; btn.style.color = '#c0392b'; btn.disabled = false; }
}

// Re-fetch and re-render one coach's accordion (used after mark-deleted / restore,
// since a state change can add/remove badges and actions on any row).
async function reloadAccordion(coachId) {
  delete _accordionCache[coachId];
  var content = document.getElementById('accordion-content-'+coachId);
  if (!content) return;
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
async function accordionMarkDeleted(assessmentId, name, coachId) {
  if (!confirm('Mark this assessment for '+name+' for deletion? A super-admin can restore it from Deleted Assessments.')) return;
  try {
    var r = await fetch('/admin/assessments/'+assessmentId+'/mark-deleted', {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.ok) { showToast('Assessment marked for deletion.'); reloadAccordion(coachId); }
    else { alert(d.error || 'Failed to mark for deletion'); }
  } catch(e) { alert('Request failed'); }
}
async function accordionRestore(assessmentId, name, coachId) {
  if (!confirm('Restore the assessment for '+name+' to active?')) return;
  try {
    var r = await fetch('/admin/assessments/'+assessmentId+'/restore', {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.ok) { showToast('Assessment restored.'); reloadAccordion(coachId); }
    else { alert(d.error || 'Restore failed'); }
  } catch(e) { alert('Request failed'); }
}

// Retake (super-admin, completed clients only): issue a fresh assessment while
// preserving the prior results. Mirrors adminRetake on the main dashboard, but
// reloads just this coach's accordion (re-rendering badges/actions) instead of the
// whole page, so the accordion stays open. POSTs to the same requireSuperAdmin route.
async function accordionRetake(clientId, name, btn, coachId) {
  if (!confirm('Issue a new assessment for '+name+'? Their previous results will be preserved.')) return;
  var orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    var r = await fetch('/admin/clients/'+clientId+'/retake', {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.success) { showToast('Retake issued — a fresh invite has been sent.'); reloadAccordion(coachId); }
    else { alert(d.error || 'Retake failed'); btn.disabled = false; btn.textContent = orig; }
  } catch(e) { alert('Request failed'); btn.disabled = false; btn.textContent = orig; }
}

// adminRetry / adminRegen / adminResend also used on main dashboard — define here too for coaches page
// DEAD CODE — retired 2026-06-20. Mark for removal in post-beta cleanup sweep.
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
${sharedModalHTML(true, isSuperAdmin)}
</body>
</html>`;
}

// =================== /admin/content — GLOBAL STATIC EDITOR (super-admin) ===================
// Scoped to the 6 static.* keys from content_library.json. Subtype/type content and
// prompt editing are later PRs. Overrides are keyed "static.<field>" (matching PR2's
// resolveLibObject('static', ...)); the value column stores JSON.stringify(value).

const CMS_STATIC_FIELDS = ['welcome', 'primer', 'wings_primer', 'lines_primer', 'wings_using', 'instinct_primer', 'instinct_definitions'];
function cmsIsValidStaticKey(k) {
  return typeof k === 'string' && k.indexOf('static.') === 0 && CMS_STATIC_FIELDS.indexOf(k.slice(7)) >= 0;
}

// Friendly display name + report-page reference per key. The raw key still drives the
// POST routes (carried in data-card-key); these are presentation-only.
const CMS_FIELD_META = {
  'static.welcome':              { name: 'Welcome Page',         page: 'P1 — Welcome from Cai & Monique' },
  'static.primer':               { name: 'Enneagram Primer',     page: 'P2 — What Is the Enneagram?' },
  'static.wings_primer':         { name: 'Wings Sidebar',        page: 'P5 — Wings & Lines' },
  'static.lines_primer':         { name: 'Lines Sidebar',        page: 'P5 — Wings & Lines' },
  'static.wings_using':          { name: 'Using Your Wings and Lines', page: 'P5 — Wings & Lines' },
  'static.instinct_primer':      { name: 'Instinct Sidebar',     page: 'P6 — Instinct & Subtype' },
  'static.instinct_definitions': { name: 'Instinct Definitions', page: 'P6 — Instinct & Subtype' },
};
const cmsCardId = (key) => 'card-' + key.replace(/\./g, '-');

// ── Subtype editor (PR 4a) ──────────────────────────────────────────────────────
const CMS_INSTINCTS = [
  { code: 'sp', label: 'SP', name: 'Self-Preservation' },
  { code: 'so', label: 'SO', name: 'Social' },
  { code: 'sx', label: 'SX', name: 'One-to-One' },
];
const CMS_TYPE_WORD = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine' };
// The four editable subtype fields (code/name stay read-only context). Each is its own
// content_key (subtype_{inst}{N}.{field}) — matching report_prep's resolveLibObject lookup.
const CMS_SUBTYPE_FIELDS = [
  { field: 'tagline',   label: 'Tagline' },
  { field: 'narrative', label: 'Narrative' },
  { field: 'patterns',  label: 'Patterns' },
  { field: 'shifts',    label: 'Shifts' },
];
function cmsIsValidSubtypeKey(k) {
  return typeof k === 'string' && /^subtype_(sp|so|sx)[1-9]\.(tagline|narrative|patterns|shifts)$/.test(k);
}
// Combined gate for the POST routes: 6 static + 108 subtype keys; rejects type_*.* (PR5)
// and subtype_*.{code,name}.
// Type keys (PR 5): all 12 editable type_{N} fields. Editable across the same 4 routes as
// static/subtype now that the type editor exists.
function cmsIsValidTypeKey(k) {
  return typeof k === 'string' && /^type_[1-9]\.(description|comparison|patterns|inquiry_lines|wings|lines|strengths|challenges|practices|communication|conflict|center)$/.test(k);
}
function cmsIsValidContentKey(k) { return cmsIsValidStaticKey(k) || cmsIsValidSubtypeKey(k) || cmsIsValidTypeKey(k); }
// Preview accepts the same keys as the write routes (type keys folded into cmsIsValidContentKey
// in PR 5; kept as an alias for the preview route's call site).
function cmsIsValidPreviewKey(k) { return cmsIsValidContentKey(k); }
const cmsStatusWord = (s) => (s === 'published' ? 'Published' : s === 'draft' ? 'Draft' : 'Unmodified');
const cmsStatusClass = (s) => (s === 'published' ? 'pub' : s === 'draft' ? 'draft' : 'unmod');
// Worst status across a subtype's fields: any draft -> draft; else any published -> published.
function cmsWorstStatus(statuses) {
  if (statuses.indexOf('draft') >= 0) return 'draft';
  if (statuses.indexOf('published') >= 0) return 'published';
  return 'unmodified';
}

// Super-admin "Content" dropdown for admin topbars. `active` ∈ global|subtypes|types|''.
function cmsContentMenu(active) {
  const item = (href, label, key, disabled) => disabled
    ? `<span class="cmenu-item cmenu-disabled">${label}</span>`
    : `<a class="cmenu-item${active === key ? ' cmenu-active' : ''}" href="${href}">${label}</a>`;
  return `<details class="cmenu">
      <summary class="nav-link">Content ▾</summary>
      <div class="cmenu-list">
        ${item('/admin/content/global',   'Client Report — Global Content',  'global',   false)}
        ${item('/admin/content/subtypes', 'Client Report — Subtype Content', 'subtypes', false)}
        ${item('/admin/content/types',    'Client Report — Type Content',    'types',    false)}
      </div>
    </details>`;
}
const CMS_DROPDOWN_CSS = `
  .cmenu { position: relative; display: inline-block; }
  .cmenu > summary { list-style: none; cursor: pointer; }
  .cmenu > summary::-webkit-details-marker { display: none; }
  .cmenu-list { position: absolute; right: 0; top: 100%; margin-top: 8px; background: #fff; border: 1px solid #E2E6EA; border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,.16); min-width: 244px; padding: 6px 0; z-index: 40; }
  .cmenu-item { display: block; padding: 9px 16px; font-family: Georgia, serif; font-size: 13px; color: #1A2B33; text-decoration: none; white-space: nowrap; }
  a.cmenu-item:hover { background: #F2F7F9; color: #00859f; }
  .cmenu-item.cmenu-active { color: #00859f; font-weight: 700; }
  .cmenu-disabled { color: #B7C2C9; cursor: not-allowed; }
`;

// Editor JS shared byte-identically across all three /admin/content pages (PR: cms-shared-js).
// Injected via ${CMS_SHARED_JS} at the top of each page's <script>. Only functions that were
// byte-identical across the global/subtypes/types copies live here; functions that differ
// (cmsSave, cmsRevert, cmsCollect, cmsWc, cmsInput, cmsRefresh, cmsBadge, cmsMsg,
// cmsResetToBaseline, cmsSetPath) or are page-specific (cmsShowSubtype, cmsUpdateNav,
// cmsToggleGroup, cmsCountWords) stay per-page. cmsPreview→cmsCollect, cmsSetStatus→cmsBadge/
// cmsRefresh resolve at runtime: per-page functions share the same <script> scope (hoisted).
const CMS_SHARED_JS = `  function cmsCardEl(key) { return document.querySelector('[data-card-key="' + key + '"]'); }
  function cmsPreview(key) {
    var card = cmsCardEl(key); if (!card) return;
    var btn = card.querySelector('[data-role="preview"]'); var orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Rendering…'; }
    var value = cmsCollect(key);
    fetch('/admin/content/preview', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ content_key: key, value: value }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
        if (res.ok) { cmsShowPreview(res.png, res.page); } else { alert(res.error || 'Preview failed'); }
      })
      .catch(function () { if (btn) { btn.disabled = false; btn.textContent = orig; } alert('Preview request failed'); });
  }
  function cmsShowPreview(png, label) {
    var m = document.getElementById('cms-preview-modal'); if (!m) return;
    m.querySelector('.cmpv-cap').textContent = label || 'Preview';
    m.querySelector('.cmpv-img').src = png;
    m.style.display = 'flex';
  }
  function cmsClosePreview() {
    var m = document.getElementById('cms-preview-modal'); if (!m) return;
    m.style.display = 'none'; m.querySelector('.cmpv-img').src = '';
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cmsClosePreview(); });
  function cmsGetPath(obj, path) {
    if (path === '') return obj;
    var segs = path.split('.'), cur = obj;
    for (var i = 0; i < segs.length; i++) { if (cur == null) return undefined; var s = segs[i]; cur = cur[/^\\d+$/.test(s) ? parseInt(s, 10) : s]; }
    return cur;
  }
  function cmsSetStatus(card, status) { card.setAttribute('data-status', status); cmsBadge(card, status); cmsRefresh(card); }`;

// Total words across all string leaves of a value (object/array/string). Server-side
// authority for the word_count column.
function cmsWordCount(v) {
  if (v == null) return 0;
  if (typeof v === 'string') return v.trim() ? v.trim().split(/\s+/).filter(Boolean).length : 0;
  if (Array.isArray(v)) return v.reduce((a, x) => a + cmsWordCount(x), 0);
  if (typeof v === 'object') return Object.values(v).reduce((a, x) => a + cmsWordCount(x), 0);
  return 0;
}

// Advisory word budget per leaf path (0 = no budget shown). Derived from baseline + headroom.
function cmsBudgetFor(key, path) {
  if (key === 'static.welcome') {
    if (path === 'subhead') return 15;
    if (/^letters\./.test(path)) return 60;
    if (path === 'callout') return 55;
  }
  if (key === 'static.primer') {
    if (path === 'intro') return 95;
    if (path === 'scan_line') return 25;
    if (path === 'footer') return 45;
    if (/^pillars\.\d+\.title$/.test(path)) return 6;
    if (/^pillars\.\d+\.body$/.test(path)) return 20;
    if (/^nine_types\.\d+\.name$/.test(path)) return 6;
    if (/^nine_types\.\d+\.description$/.test(path)) return 35;
    if (/^nine_types\.\d+\.gifts$/.test(path)) return 25;
  }
  if (key === 'static.wings_primer') return 55;
  if (key === 'static.lines_primer') return 75;
  if (key === 'static.wings_using') return 80;
  if (key === 'static.instinct_primer') return 75;
  if (key === 'static.instinct_definitions') {
    if (/^\d+\.name$/.test(path)) return 6;
    if (/^\d+\.body$/.test(path)) return 45;
  }
  // Subtype fields (PR 4a): budget keys off the field suffix (all leaves of a unit share it).
  if (/^subtype_/.test(key)) {
    if (key.endsWith('.tagline')) return 15;     // P6 name+tagline zone
    if (key.endsWith('.narrative')) return 130;  // P6 left column, 2 paragraphs
    if (key.endsWith('.patterns')) return 25;    // each T/F/B bullet (~3-line proxy)
    if (key.endsWith('.shifts')) return 25;      // each P7 "What Shifts" tip
  }
  // Type fields (PR 5): budget per leaf path within each field's value (design §C8–C12 + proxy).
  if (/^type_/.test(key)) {
    if (key.endsWith('.description')) return path === 'core_motivation' ? 30 : 50;  // worldview not client-rendered
    if (key.endsWith('.comparison')) return 20;                                     // P3 table cells
    if (key.endsWith('.patterns')) { if (/\.intro$/.test(path)) return 40; if (/\.inquiry$/.test(path)) return 15; return 20; }  // bullets
    if (key.endsWith('.inquiry_lines')) return 15;
    if (key.endsWith('.wings')) return 70;        // wing narrative ≤70 (target_type renders read-only)
    if (key.endsWith('.lines')) return /\.resource_card$/.test(path) ? 25 : 60;     // line narrative ≤60
    if (key.endsWith('.strengths') || key.endsWith('.challenges')) return /\.title$/.test(path) ? 5 : 30;
    if (key.endsWith('.practices')) return path === 'intro' ? 25 : 30;
    if (/\.(communication|conflict|center)$/.test(key)) { if (path === 'subhead' || path === 'framework') return 10; return 25; }
  }
  return 0;
}

// Structural identifiers are read-only (never edited as prose).
function cmsIsIdentifierLeaf(path) {
  const last = path.split('.').pop();
  return last === 'number' || last === 'center' || last === 'code';
}
function cmsHumanize(seg) {
  return String(seg).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function cmsArrayHeading(key, parentPath, item, i) {
  if (/\.shifts$/.test(key)) return 'Shift ' + (i + 1);                 // subtype shifts (root array)
  if (/\.inquiry_lines$/.test(key)) return 'Inquiry ' + (i + 1);       // type inquiry_lines (root array)
  if (/\.strengths$/.test(key)) return 'Strength ' + (i + 1);          // type strengths (root array)
  if (/\.challenges$/.test(key)) return 'Challenge ' + (i + 1);        // type challenges (root array)
  if (parentPath === 'thinking') return 'Thinking ' + (i + 1);         // subtype + type patterns
  if (parentPath === 'feeling') return 'Feeling ' + (i + 1);
  if (parentPath === 'behaving') return 'Behaving ' + (i + 1);
  if (parentPath === 'bullets') return 'Bullet ' + (i + 1);            // type practices / communication / conflict / center
  if (parentPath === 'watch_for') return 'Watch-For ' + (i + 1);
  if (parentPath === 'working_with') return 'Working-With ' + (i + 1);
  if (parentPath === 'off_center') return 'Off-Center ' + (i + 1);
  if (parentPath === 'letters') return 'Letter ' + (i + 1);
  if (parentPath === 'pillars') return 'Pillar ' + (i + 1);
  if (parentPath === 'nine_types') return 'Type ' + (item && item.number != null ? item.number : i + 1) + (item && item.center ? ' (' + item.center + ')' : '');
  if ((parentPath === '' || parentPath === 'instinct_definitions') && item && item.code) return String(item.code);
  return 'Item ' + (i + 1);
}

// Recursively render structured inputs for a field value. Editable text leaves get a
// textarea (data-field/data-path drive client-side reassembly) + a live word-count box;
// identifier leaves render read-only.
function cmsRenderInputs(key, value, path) {
  if (typeof value === 'string') {
    // Suppress the label for the field root ('') and for numeric array indices
    // (e.g. welcome.letters.0) — the enclosing group heading already labels those.
    const lastSeg = path.split('.').pop();
    const leafLabel = (path === '' || /^\d+$/.test(lastSeg)) ? '' : cmsHumanize(lastSeg);
    if (cmsIsIdentifierLeaf(path)) {
      return `<div class="leaf"><label>${esc(leafLabel)}</label><div class="ro">${esc(value)}</div></div>`;
    }
    const budget = cmsBudgetFor(key, path);
    const wcNow = value.trim() ? value.trim().split(/\s+/).filter(Boolean).length : 0;
    const rows = value.length > 140 ? 4 : 2;
    return `<div class="leaf">`
      + (leafLabel ? `<label>${esc(leafLabel)}</label>` : '')
      + `<textarea class="cms-input" data-field="${esc(key)}" data-path="${esc(path)}" data-budget="${budget}" oninput="cmsInput(this)" rows="${rows}">${esc(value)}</textarea>`
      + `<div class="wc"><span class="wc-now">${wcNow}</span>${budget ? ` / <span class="wc-bud">${budget}</span> words` : ' words'}</div>`
      + `</div>`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `<div class="leaf"><label>${esc(cmsHumanize(path.split('.').pop()))}</label><div class="ro">${esc(String(value))}</div></div>`;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) =>
      `<div class="group"><div class="group-h">${esc(cmsArrayHeading(key, path, item, i))}</div>`
      + cmsRenderInputs(key, item, path === '' ? String(i) : path + '.' + i)
      + `</div>`).join('');
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).map(k => cmsRenderInputs(key, value[k], path === '' ? k : path + '.' + k)).join('');
  }
  return '';
}

function cmsFieldCard(key, currentValue, status) {
  const meta = CMS_FIELD_META[key] || { name: key, page: '' };
  const badgeClass = status === 'published' ? 'pub' : status === 'draft' ? 'draft' : 'unmod';
  const badgeLabel = status === 'published' ? 'Published' : status === 'draft' ? 'Draft' : 'Unmodified';
  // Initial button states (JS re-affirms on load; rendered here to avoid a flash):
  // draft always disabled at load; publish enabled only for an existing draft;
  // revert hidden only when unmodified.
  const pubDisabled = status !== 'draft';
  const revHidden = status === 'unmodified';
  return `<div class="card" id="${cmsCardId(key)}" data-card-key="${esc(key)}" data-status="${status}" data-dirty="0">
    <div class="card-header">
      <div class="ch-titles">
        <div class="ch-name">${esc(meta.name)}</div>
        ${meta.page ? `<div class="ch-page">${esc(meta.page)}</div>` : ''}
        <div class="ch-key">${esc(key)}</div>
      </div>
      <span class="badge ${badgeClass}" data-role="badge">${badgeLabel}</span>
    </div>
    <div class="field-body">${cmsRenderInputs(key, currentValue, '')}</div>
    <div class="field-actions">
      <button class="btn-draft" type="button" data-role="draft" disabled onclick="cmsSave('${key}','draft')">Save as Draft</button>
      <button class="btn-pub" type="button" data-role="publish"${pubDisabled ? ' disabled' : ''} onclick="cmsSave('${key}','publish')">Publish</button>
      <button class="btn-preview" type="button" data-role="preview" onclick="cmsPreview('${key}')">Preview</button>
      <button class="btn-revert" type="button" data-role="revert"${revHidden ? ' style="display:none"' : ''} onclick="cmsRevert('${key}')">Revert to baseline</button>
    </div>
    <div class="field-msg" data-role="msg" style="display:none"></div>
  </div>`;
}

function renderContentPage(overrides, req) {
  const baseline = contentLibrary.static || {};
  const template = {}, baselineMap = {}, statusMap = {};
  let nPub = 0, nDraft = 0, nUnmod = 0;
  const cards = CMS_STATIC_FIELDS.map(name => {
    const key = 'static.' + name;
    const ov = overrides[key];
    const status = ov ? ov.status : 'unmodified';
    if (status === 'published') nPub++; else if (status === 'draft') nDraft++; else nUnmod++;
    const currentValue = ov ? ov.parsed : baseline[name];
    template[key] = currentValue;
    baselineMap[key] = baseline[name];   // for client-side revert-to-baseline reset
    statusMap[key] = status;
    return cmsFieldCard(key, currentValue, status);
  }).join('');
  const sidebar = CMS_STATIC_FIELDS.map(name => {
    const key = 'static.' + name;
    const meta = CMS_FIELD_META[key] || { name: key };
    return `<a href="#${cmsCardId(key)}" class="spy-link" data-target="${cmsCardId(key)}">${esc(meta.name)}</a>`;
  }).join('');
  // Embed editor state as data (server interpolation); escape < to keep JSON inside <script> safe.
  const templateJson = JSON.stringify(template).replace(/</g, '\\u003c');
  const baselineJson = JSON.stringify(baselineMap).replace(/</g, '\\u003c');
  const statusJson = JSON.stringify(statusMap).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Hive Admin — Global Static Content</title>
<style>
  * { box-sizing: border-box; }
  :root { --topbar-h: 84px; --sidebar-w: 200px; }  /* topbar renders ~83px (logo + title row); clears overlap */
  body { margin: 0; font-family: Georgia, serif; background: #F7F4EF; color: #1A2B33; }
  .top-bar { background: #1A2B33; color: #fff; padding: 16px 24px; min-height: var(--topbar-h); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 20; }
  .top-bar h1 { font-size: 18px; margin: 4px 0 0; font-weight: 700; }
  .top-bar span { font-size: 12px; color: #9FB4C0; }
  .top-bar svg.logo { height: 26px; width: auto; vertical-align: middle; }
  .top-bar .nav-link { color: #9FB4C0; font-size: 12px; text-decoration: none; }
  .top-bar .nav-link:hover { color: #fff; }
  .nav-sep { color: #4A5E68; margin: 0 4px; }
  /* Scrollspy sidebar */
  .sidebar { position: fixed; top: var(--topbar-h); left: 0; bottom: 0; width: var(--sidebar-w); background: #fff; border-right: 1px solid #E2E6EA; overflow-y: auto; padding: 18px 0; z-index: 10; }
  .sidebar .spy-title { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #9FB0B9; font-weight: 700; padding: 0 18px 10px; }
  .spy-link { display: block; padding: 8px 18px; font-size: 13px; color: #5A6472; text-decoration: none; border-left: 3px solid transparent; }
  .spy-link:hover { background: #F7F8F9; }
  .spy-link.active { color: #00B2D9; border-left-color: #00B2D9; font-weight: 700; }
  .container { max-width: 900px; margin: 0 0 0 var(--sidebar-w); padding: 28px 24px; }
  .summary { font-size: 13px; color: #5A6E78; margin-bottom: 20px; }
  .summary b { color: #1A2B33; }
  .card { background: #fff; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; margin-bottom: 24px; scroll-margin-top: calc(var(--topbar-h) + 16px); }
  .card-header { padding: 14px 18px; border-bottom: 1px solid #EFE8E0; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .ch-name { font-size: 15px; font-weight: 700; color: #1A2B33; }
  .ch-page { font-size: 12px; color: #7A8A92; margin-top: 2px; }
  .ch-key { font-size: 11px; color: #9FB0B9; font-family: Menlo, monospace; margin-top: 5px; }
  .badge { flex-shrink: 0; font-family: Georgia, serif; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 3px; letter-spacing: 0.04em; }
  .badge.pub { background: #e6f7ee; color: #1a7a4a; }
  .badge.draft { background: #fef6e0; color: #9a6a00; }
  .badge.unmod { background: #f1f1ee; color: #7A8A92; }
  .field-body { padding: 16px 18px; }
  .leaf { margin-bottom: 14px; }
  .leaf label { display: block; font-size: 11px; color: #7A96A6; letter-spacing: 0.07em; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
  .cms-input { width: 100%; padding: 9px 11px; border: 1px solid #D0DCE4; border-radius: 4px; font-family: Georgia, serif; font-size: 14px; line-height: 1.5; color: #1A2B33; outline: none; resize: vertical; }
  .cms-input:focus { border-color: #00b1d7; }
  .ro { font-size: 13px; color: #5A6E78; background: #f7f7f4; border: 1px solid #ECECE6; border-radius: 4px; padding: 7px 10px; }
  .wc { font-size: 11px; color: #7A96A6; margin-top: 3px; }
  .group { border-left: 3px solid #EFE8E0; padding-left: 14px; margin-bottom: 16px; }
  .group-h { font-size: 12px; font-weight: 700; color: #00859f; margin-bottom: 8px; letter-spacing: 0.03em; }
  .field-actions { padding: 12px 18px; border-top: 1px solid #EFE8E0; background: #fbfaf7; display: flex; gap: 10px; align-items: center; }
  .field-actions button { font-family: Georgia, serif; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; }
  .field-actions button:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-draft { background: #eef2f4; color: #1A2B33; }
  .btn-draft:not(:disabled):hover { background: #e2e8eb; }
  .btn-pub { background: #00b1d7; color: #fff; }
  .btn-pub:not(:disabled):hover { background: #009bbf; }
  .btn-revert { background: transparent; color: #c0392b; margin-left: auto; }
  .btn-revert:not(:disabled):hover { text-decoration: underline; }
  .field-msg { padding: 0 18px 12px; font-size: 13px; align-items: center; gap: 12px; }
  .field-msg .msg-ok { color: #1a7a4a; }
  .field-msg .msg-err { color: #c0392b; }
  .field-msg .msg-dismiss { font-family: Georgia, serif; font-size: 11px; font-weight: 700; color: #c0392b; background: transparent; border: 1px solid #e3b7b1; border-radius: 3px; padding: 2px 8px; cursor: pointer; }
  .btn-preview { background: #e4eef2; color: #00859f; }
  .btn-preview:not(:disabled):hover { background: #d4e6ec; }
  .cmpv-overlay { position: fixed; inset: 0; background: rgba(20,30,40,.72); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .cmpv-panel { background: #fff; border-radius: 8px; padding: 14px; max-height: 94vh; display: flex; flex-direction: column; box-shadow: 0 12px 48px rgba(0,0,0,.4); }
  .cmpv-head { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 10px; }
  .cmpv-cap { font-size: 13px; font-weight: 700; color: #1A2B33; }
  .cmpv-close { font-family: Georgia, serif; font-size: 12px; font-weight: 700; color: #c0392b; background: transparent; border: 1px solid #e3b7b1; border-radius: 4px; padding: 5px 12px; cursor: pointer; }
  .cmpv-img { max-height: 86vh; max-width: 86vw; width: auto; height: auto; border: 1px solid #E2E6EA; }
  ${CMS_DROPDOWN_CSS}
  @media (max-width: 768px) {
    .sidebar { display: none; }
    .container { margin-left: 0; }
  }
</style></head>
<body>
<div class="top-bar">
  <div>${HIVE_LOGO_SVG}<h1>Global Static Content</h1></div>
  <div style="display:flex;align-items:center;gap:10px;">
    <a href="/admin" class="nav-link">← Dashboard</a><span class="nav-sep">|</span>
    ${cmsContentMenu('global')}<span class="nav-sep">|</span>
    ${auth.hasRole(req, 'super_admin') ? `<a href="/admin/beta-review" class="nav-link">Beta Review</a><span class="nav-sep">|</span>` : ''}
    <a href="/admin/logout" class="nav-link">Sign out</a>
  </div>
</div>
<nav class="sidebar">
  <div class="spy-title">Fields</div>
  ${sidebar}
</nav>
<div class="container">
  <div class="summary">Editing global static fields (<b>static.*</b>). Published edits go live on the next report render; drafts do not. Status — <b>${nPub}</b> published · <b>${nDraft}</b> draft · <b>${nUnmod}</b> unmodified.</div>
  ${cards}
</div>
<div id="cms-preview-modal" class="cmpv-overlay" style="display:none" onclick="if(event.target===this)cmsClosePreview()">
  <div class="cmpv-panel">
    <div class="cmpv-head"><span class="cmpv-cap"></span><button type="button" class="cmpv-close" onclick="cmsClosePreview()">✕ Close</button></div>
    <img class="cmpv-img" alt="page preview">
  </div>
</div>
<script>
  var CMS_TEMPLATE = ${templateJson};
  var CMS_BASELINE = ${baselineJson};
  var CMS_STATUS = ${statusJson};
</script>
<script>
${CMS_SHARED_JS}
  function cmsSetPath(obj, path, val) {
    if (path === '') return;
    var segs = path.split('.'), cur = obj;
    for (var i = 0; i < segs.length - 1; i++) {
      var s = segs[i]; cur = cur[/^\\d+$/.test(s) ? parseInt(s, 10) : s];
      if (cur == null) return;
    }
    var last = segs[segs.length - 1];
    cur[/^\\d+$/.test(last) ? parseInt(last, 10) : last] = val;
  }
  function cmsCollect(key) {
    var tpl = CMS_TEMPLATE[key];
    if (typeof tpl === 'string') {
      var one = document.querySelector('[data-field="' + key + '"]');
      return one ? one.value : tpl;
    }
    var out = JSON.parse(JSON.stringify(tpl));
    var els = document.querySelectorAll('[data-field="' + key + '"]');
    for (var i = 0; i < els.length; i++) cmsSetPath(out, els[i].getAttribute('data-path'), els[i].value);
    return out;
  }
  function cmsWc(el) {
    var t = el.value.trim();
    var n = t ? t.split(/\\s+/).length : 0;
    var box = el.parentNode.querySelector('.wc-now'); if (box) box.textContent = n;
    var bud = parseInt(el.getAttribute('data-budget'), 10);
    var wrap = el.parentNode.querySelector('.wc');
    if (bud && wrap) wrap.style.color = n > bud ? '#c0392b' : '#7A96A6';
  }
  // Edit handler: live word count + mark the card dirty.
  function cmsInput(el) {
    cmsWc(el);
    var card = el.closest('.card');
    if (card) { card.setAttribute('data-dirty', '1'); cmsRefresh(card); }
  }
  // Derive button states from (status, dirty). Draft enabled only when dirty; Publish
  // enabled only for a saved draft that is not dirty; Revert hidden only when unmodified.
  function cmsRefresh(card) {
    var status = card.getAttribute('data-status');
    var dirty = card.getAttribute('data-dirty') === '1';
    var d = card.querySelector('[data-role="draft"]');
    var p = card.querySelector('[data-role="publish"]');
    var r = card.querySelector('[data-role="revert"]');
    if (d) d.disabled = !dirty;
    if (p) p.disabled = !(status === 'draft' && !dirty);
    if (r) r.style.display = (status === 'unmodified') ? 'none' : '';
  }
  function cmsBadge(card, status) {
    var b = card.querySelector('[data-role="badge"]');
    if (!b) return;
    b.className = 'badge ' + (status === 'published' ? 'pub' : status === 'draft' ? 'draft' : 'unmod');
    b.textContent = status === 'published' ? 'Published' : status === 'draft' ? 'Draft' : 'Unmodified';
  }
  function cmsMsg(card, text, isError) {
    var m = card.querySelector('[data-role="msg"]'); if (!m) return;
    if (m._t) { clearTimeout(m._t); m._t = null; }
    m.innerHTML = ''; m.style.display = 'flex';
    var s = document.createElement('span'); s.textContent = text; s.className = isError ? 'msg-err' : 'msg-ok';
    m.appendChild(s);
    if (isError) {
      var x = document.createElement('button'); x.type = 'button'; x.className = 'msg-dismiss'; x.textContent = 'Dismiss';
      x.onclick = function () { m.style.display = 'none'; m.innerHTML = ''; };
      m.appendChild(x);
    } else {
      m._t = setTimeout(function () { m.style.display = 'none'; m.innerHTML = ''; }, 3000);
    }
  }
  function cmsResetToBaseline(card, key) {
    var base = CMS_BASELINE[key];
    CMS_TEMPLATE[key] = (typeof base === 'string') ? base : JSON.parse(JSON.stringify(base));
    var els = card.querySelectorAll('.cms-input');
    for (var i = 0; i < els.length; i++) {
      var p = els[i].getAttribute('data-path');
      var v = (typeof base === 'string') ? base : cmsGetPath(base, p);
      els[i].value = (v == null ? '' : v);
      cmsWc(els[i]);
    }
  }
  function cmsSave(key, action) {
    var card = cmsCardEl(key); if (!card) return;
    var d = card.querySelector('[data-role="draft"]'), p = card.querySelector('[data-role="publish"]');
    var btn = action === 'draft' ? d : p; var orig = btn.textContent;
    d.disabled = true; p.disabled = true;
    btn.textContent = action === 'draft' ? 'Saving…' : 'Publishing…';
    var value = cmsCollect(key);
    fetch('/admin/content/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ content_key: key, value: value }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        btn.textContent = orig;
        if (res.ok) {
          CMS_TEMPLATE[key] = value;
          CMS_STATUS[key]   = (action === 'draft') ? 'draft' : 'published';
          card.setAttribute('data-dirty', '0');
          cmsSetStatus(card, action === 'draft' ? 'draft' : 'published');
          cmsMsg(card, action === 'draft' ? 'Saved as draft' : 'Published', false);
        } else { cmsRefresh(card); cmsMsg(card, res.error || 'Save failed', true); }
      })
      .catch(function () { btn.textContent = orig; cmsRefresh(card); cmsMsg(card, 'Request failed', true); });
  }
  function cmsRevert(key) {
    if (!confirm('Revert ' + key + ' to baseline? This deletes any draft or published override for this field.')) return;
    var card = cmsCardEl(key); if (!card) return;
    var r = card.querySelector('[data-role="revert"]'); var orig = r.textContent;
    r.disabled = true; r.textContent = 'Reverting…';
    fetch('/admin/content/revert', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ content_key: key }) })
      .then(function (rp) { return rp.json(); })
      .then(function (res) {
        r.disabled = false; r.textContent = orig;
        if (res.ok) { cmsResetToBaseline(card, key); card.setAttribute('data-dirty', '0'); cmsSetStatus(card, 'unmodified'); }
        else { cmsMsg(card, res.error || 'Revert failed', true); }
      })
      .catch(function () { r.disabled = false; r.textContent = orig; cmsMsg(card, 'Request failed', true); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    var cards = document.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) { cards[i].setAttribute('data-dirty', '0'); cmsRefresh(cards[i]); }
    var inputs = document.querySelectorAll('.cms-input');
    for (var j = 0; j < inputs.length; j++) cmsWc(inputs[j]);
    // Scrollspy — highlight the sidebar link for the card nearest the top of the viewport.
    var links = {}, ls = document.querySelectorAll('.spy-link');
    for (var k = 0; k < ls.length; k++) links[ls[k].getAttribute('data-target')] = ls[k];
    function setActive(id) { for (var t in links) links[t].classList.toggle('active', t === id); }
    if (ls.length) setActive(ls[0].getAttribute('data-target'));
    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id); });
      }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 });
      for (var m = 0; m < cards.length; m++) obs.observe(cards[m]);
    }
  });
</script>
</body></html>`;
}

// One independently-saveable subtype field unit (tagline / narrative / patterns / shifts).
// Reuses the same data-card-key / data-role machinery as the static cards.
function cmsSubtypeUnit(key, value, status, label, note) {
  const badgeClass = status === 'published' ? 'pub' : status === 'draft' ? 'draft' : 'unmod';
  const pubDisabled = status !== 'draft';
  const revHidden = status === 'unmodified';
  return `<div class="card unit" data-card-key="${esc(key)}" data-status="${status}" data-dirty="0">
      <div class="unit-head">
        <span class="unit-label">${esc(label)}</span>
        <span class="badge ${badgeClass}" data-role="badge">${cmsStatusWord(status)}</span>
      </div>
      ${note ? `<div class="unit-note">${esc(note)}</div>` : ''}
      <div class="field-body">${cmsRenderInputs(key, value, '')}</div>
      <div class="field-actions">
        <button class="btn-draft" type="button" data-role="draft" disabled onclick="cmsSave('${key}','draft')">Save as Draft</button>
        <button class="btn-pub" type="button" data-role="publish"${pubDisabled ? ' disabled' : ''} onclick="cmsSave('${key}','publish')">Publish</button>
        <button class="btn-preview" type="button" data-role="preview" onclick="cmsPreview('${key}')">Preview</button>
        <button class="btn-revert" type="button" data-role="revert"${revHidden ? ' style="display:none"' : ''} onclick="cmsRevert('${key}')">Revert to baseline</button>
      </div>
      <div class="field-msg" data-role="msg" style="display:none"></div>
    </div>`;
}

function renderSubtypesPage(overrides, req) {
  const template = {}, baselineMap = {}, statusMap = {};
  let nPub = 0, nDraft = 0, nUnmod = 0, subtypesWithPub = 0;
  let firstId = null;
  const groups = [], cards = [];

  for (const inst of CMS_INSTINCTS) {
    const links = [];
    for (let n = 1; n <= 9; n++) {
      const subKey = `subtype_${inst.code}${n}`;
      const baseObj = contentLibrary[subKey] || {};
      const subId = cmsCardId(subKey);                 // card-subtype-sp1
      if (!firstId) firstId = subId;
      const fieldStatuses = [];
      const units = CMS_SUBTYPE_FIELDS.map(f => {
        const key = `${subKey}.${f.field}`;
        const ov = overrides[key];
        const status = ov ? ov.status : 'unmodified';
        if (status === 'published') nPub++; else if (status === 'draft') nDraft++; else nUnmod++;
        const value = ov ? ov.parsed : baseObj[f.field];
        template[key] = value;
        baselineMap[key] = baseObj[f.field];
        statusMap[key] = status;
        fieldStatuses.push(status);
        return cmsSubtypeUnit(key, value, status, f.label);
      }).join('');
      const worst = cmsWorstStatus(fieldStatuses);
      if (fieldStatuses.indexOf('published') >= 0) subtypesWithPub++;
      const label = `${inst.label} ${CMS_TYPE_WORD[n]}`;
      links.push(`<a class="sub-link" href="#${subId}" data-subtype="${subId}" onclick="cmsShowSubtype('${subId}');return false;"><span>${esc(label)}</span><span class="sub-stat ${cmsStatusClass(worst)}" data-role="navstat">${cmsStatusWord(worst)}</span></a>`);
      cards.push(`<div class="subtype-card" id="${subId}" style="display:none">
        <div class="subtype-head"><span class="st-code">${esc(baseObj.code || (inst.label + n))}</span><span class="st-name">${esc(baseObj.name || label)}</span></div>
        ${units}
      </div>`);
    }
    // Only the group containing the default selection (SP) starts expanded.
    const open = inst.code === 'sp' ? ' open' : '';
    groups.push(`<div class="nav-group${open}" data-group="${inst.code}">
      <div class="nav-group-h" onclick="cmsToggleGroup('${inst.code}')"><span class="ng-caret">▸</span>${esc(inst.name)}</div>
      <div class="nav-group-items">${links.join('')}</div>
    </div>`);
  }

  const templateJson = JSON.stringify(template).replace(/</g, '\\u003c');
  const baselineJson = JSON.stringify(baselineMap).replace(/</g, '\\u003c');
  const statusJson = JSON.stringify(statusMap).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Hive Admin — Subtype Content</title>
<style>
  * { box-sizing: border-box; }
  :root { --topbar-h: 84px; --sidebar-w: 230px; }  /* topbar renders ~83px (logo + title row); clears overlap */
  body { margin: 0; font-family: Georgia, serif; background: #F7F4EF; color: #1A2B33; }
  .top-bar { background: #1A2B33; color: #fff; padding: 16px 24px; min-height: var(--topbar-h); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 20; }
  .top-bar h1 { font-size: 18px; margin: 4px 0 0; font-weight: 700; }
  .top-bar svg.logo { height: 26px; width: auto; vertical-align: middle; }
  .top-bar .nav-link { color: #9FB4C0; font-size: 12px; text-decoration: none; }
  .top-bar .nav-link:hover { color: #fff; }
  .nav-sep { color: #4A5E68; margin: 0 4px; }
  .sidebar { position: fixed; top: var(--topbar-h); left: 0; bottom: 0; width: var(--sidebar-w); background: #fff; border-right: 1px solid #E2E6EA; overflow-y: auto; padding: 14px 0; z-index: 10; }
  .nav-group-h { font-size: 12px; font-weight: 700; letter-spacing: 0.03em; color: #1A2B33; padding: 9px 16px; cursor: pointer; user-select: none; }
  .nav-group-h:hover { background: #F7F8F9; }
  .ng-caret { display: inline-block; width: 14px; color: #9FB0B9; transition: transform .12s; }
  .nav-group.open .ng-caret { transform: rotate(90deg); }
  .nav-group-items { display: none; }
  .nav-group.open .nav-group-items { display: block; }
  .sub-link { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 16px 7px 30px; font-size: 13px; color: #5A6472; text-decoration: none; border-left: 3px solid transparent; }
  .sub-link:hover { background: #F7F8F9; }
  .sub-link.active { color: #00B2D9; border-left-color: #00B2D9; font-weight: 700; }
  .sub-stat { font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; }
  .sub-stat.pub { background: #e6f7ee; color: #1a7a4a; }
  .sub-stat.draft { background: #fef6e0; color: #9a6a00; }
  .sub-stat.unmod { background: #f1f1ee; color: #8A969C; }
  .container { max-width: 860px; margin: 0 0 0 var(--sidebar-w); padding: 28px 24px; }
  .summary { font-size: 13px; color: #5A6E78; margin-bottom: 20px; }
  .summary b { color: #1A2B33; }
  .subtype-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
  .subtype-head .st-code { font-family: Menlo, monospace; font-size: 12px; font-weight: 700; color: #fff; background: #00859f; padding: 3px 8px; border-radius: 3px; }
  .subtype-head .st-name { font-size: 20px; font-weight: 700; color: #1A2B33; }
  .card { background: #fff; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; margin-bottom: 18px; }
  .unit-head { padding: 12px 18px; border-bottom: 1px solid #EFE8E0; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .unit-label { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; color: #1A2B33; text-transform: uppercase; }
  .badge { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 3px; letter-spacing: 0.04em; }
  .badge.pub { background: #e6f7ee; color: #1a7a4a; }
  .badge.draft { background: #fef6e0; color: #9a6a00; }
  .badge.unmod { background: #f1f1ee; color: #7A8A92; }
  .field-body { padding: 16px 18px; }
  .leaf { margin-bottom: 14px; }
  .leaf label { display: block; font-size: 11px; color: #7A96A6; letter-spacing: 0.07em; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
  .cms-input { width: 100%; padding: 9px 11px; border: 1px solid #D0DCE4; border-radius: 4px; font-family: Georgia, serif; font-size: 14px; line-height: 1.5; color: #1A2B33; outline: none; resize: vertical; }
  .cms-input:focus { border-color: #00b1d7; }
  .ro { font-size: 13px; color: #5A6E78; background: #f7f7f4; border: 1px solid #ECECE6; border-radius: 4px; padding: 7px 10px; }
  .wc { font-size: 11px; color: #7A96A6; margin-top: 3px; }
  .group { border-left: 3px solid #EFE8E0; padding-left: 14px; margin-bottom: 16px; }
  .group-h { font-size: 12px; font-weight: 700; color: #00859f; margin-bottom: 8px; letter-spacing: 0.03em; }
  .field-actions { padding: 12px 18px; border-top: 1px solid #EFE8E0; background: #fbfaf7; display: flex; gap: 10px; align-items: center; }
  .field-actions button { font-family: Georgia, serif; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; }
  .field-actions button:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-draft { background: #eef2f4; color: #1A2B33; }
  .btn-draft:not(:disabled):hover { background: #e2e8eb; }
  .btn-pub { background: #00b1d7; color: #fff; }
  .btn-pub:not(:disabled):hover { background: #009bbf; }
  .btn-revert { background: transparent; color: #c0392b; margin-left: auto; }
  .btn-revert:not(:disabled):hover { text-decoration: underline; }
  .field-msg { padding: 0 18px 12px; font-size: 13px; align-items: center; gap: 12px; }
  .field-msg .msg-ok { color: #1a7a4a; }
  .field-msg .msg-err { color: #c0392b; }
  .field-msg .msg-dismiss { font-family: Georgia, serif; font-size: 11px; font-weight: 700; color: #c0392b; background: transparent; border: 1px solid #e3b7b1; border-radius: 3px; padding: 2px 8px; cursor: pointer; }
  .btn-preview { background: #e4eef2; color: #00859f; }
  .btn-preview:not(:disabled):hover { background: #d4e6ec; }
  .cmpv-overlay { position: fixed; inset: 0; background: rgba(20,30,40,.72); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .cmpv-panel { background: #fff; border-radius: 8px; padding: 14px; max-height: 94vh; display: flex; flex-direction: column; box-shadow: 0 12px 48px rgba(0,0,0,.4); }
  .cmpv-head { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 10px; }
  .cmpv-cap { font-size: 13px; font-weight: 700; color: #1A2B33; }
  .cmpv-close { font-family: Georgia, serif; font-size: 12px; font-weight: 700; color: #c0392b; background: transparent; border: 1px solid #e3b7b1; border-radius: 4px; padding: 5px 12px; cursor: pointer; }
  .cmpv-img { max-height: 86vh; max-width: 86vw; width: auto; height: auto; border: 1px solid #E2E6EA; }
  ${CMS_DROPDOWN_CSS}
  @media (max-width: 768px) { .sidebar { display: none; } .container { margin-left: 0; } }
</style></head>
<body>
<div class="top-bar">
  <div>${HIVE_LOGO_SVG}<h1>Subtype Content</h1></div>
  <div style="display:flex;align-items:center;gap:10px;">
    <a href="/admin" class="nav-link">← Dashboard</a><span class="nav-sep">|</span>
    ${cmsContentMenu('subtypes')}<span class="nav-sep">|</span>
    ${auth.hasRole(req, 'super_admin') ? `<a href="/admin/beta-review" class="nav-link">Beta Review</a><span class="nav-sep">|</span>` : ''}
    <a href="/admin/logout" class="nav-link">Sign out</a>
  </div>
</div>
<nav class="sidebar">${groups.join('')}</nav>
<div class="container">
  <div class="summary">Editing subtype content (<b>subtype_*.*</b>). Published edits go live on the next report render; drafts do not. Status — <b>${nPub}</b> published · <b>${nDraft}</b> draft · <b>${nUnmod}</b> unmodified (of 108 fields across 27 subtypes). <b>${subtypesWithPub}</b>/27 subtypes have at least one published edit.</div>
  ${cards.join('')}
</div>
<div id="cms-preview-modal" class="cmpv-overlay" style="display:none" onclick="if(event.target===this)cmsClosePreview()">
  <div class="cmpv-panel">
    <div class="cmpv-head"><span class="cmpv-cap"></span><button type="button" class="cmpv-close" onclick="cmsClosePreview()">✕ Close</button></div>
    <img class="cmpv-img" alt="page preview">
  </div>
</div>
<script>
  var CMS_TEMPLATE = ${templateJson};
  var CMS_BASELINE = ${baselineJson};
  var CMS_STATUS = ${statusJson};
</script>
<script>
${CMS_SHARED_JS}
  function cmsSetPath(obj, path, val) {
    if (path === '') return;
    var segs = path.split('.'), cur = obj;
    for (var i = 0; i < segs.length - 1; i++) { var s = segs[i]; cur = cur[/^\\d+$/.test(s) ? parseInt(s, 10) : s]; if (cur == null) return; }
    var last = segs[segs.length - 1];
    cur[/^\\d+$/.test(last) ? parseInt(last, 10) : last] = val;
  }
  function cmsCollect(key) {
    var tpl = CMS_TEMPLATE[key];
    if (typeof tpl === 'string') { var one = document.querySelector('[data-field="' + key + '"]'); return one ? one.value : tpl; }
    var out = JSON.parse(JSON.stringify(tpl));
    var els = document.querySelectorAll('[data-field="' + key + '"]');
    for (var i = 0; i < els.length; i++) cmsSetPath(out, els[i].getAttribute('data-path'), els[i].value);
    return out;
  }
  function cmsCountWords(v) {
    if (v == null) return 0;
    if (typeof v === 'string') { var t = v.trim(); return t ? t.split(/\\s+/).length : 0; }
    if (Array.isArray(v)) { var s = 0; for (var i = 0; i < v.length; i++) s += cmsCountWords(v[i]); return s; }
    if (typeof v === 'object') { var s2 = 0; for (var k in v) s2 += cmsCountWords(v[k]); return s2; }
    return 0;
  }
  function cmsWc(el) {
    var t = el.value.trim(); var n = t ? t.split(/\\s+/).length : 0;
    var box = el.parentNode.querySelector('.wc-now'); if (box) box.textContent = n;
    var bud = parseInt(el.getAttribute('data-budget'), 10);
    var wrap = el.parentNode.querySelector('.wc');
    if (bud && wrap) wrap.style.color = n > bud ? '#c0392b' : '#7A96A6';
  }
  function cmsInput(el) { cmsWc(el); var card = el.closest('[data-card-key]'); if (card) { card.setAttribute('data-dirty', '1'); cmsRefresh(card); } }
  function cmsRefresh(card) {
    var status = card.getAttribute('data-status'); var dirty = card.getAttribute('data-dirty') === '1';
    var d = card.querySelector('[data-role="draft"]'), p = card.querySelector('[data-role="publish"]'), r = card.querySelector('[data-role="revert"]');
    if (d) d.disabled = !dirty;
    if (p) p.disabled = !(status === 'draft' && !dirty);
    if (r) r.style.display = (status === 'unmodified') ? 'none' : '';
  }
  function cmsBadge(card, status) {
    var b = card.querySelector('[data-role="badge"]'); if (!b) return;
    b.className = 'badge ' + (status === 'published' ? 'pub' : status === 'draft' ? 'draft' : 'unmod');
    b.textContent = status === 'published' ? 'Published' : status === 'draft' ? 'Draft' : 'Unmodified';
  }
  function cmsMsg(card, text, isError) {
    var m = card.querySelector('[data-role="msg"]'); if (!m) return;
    if (m._t) { clearTimeout(m._t); m._t = null; }
    m.innerHTML = ''; m.style.display = 'flex';
    var s = document.createElement('span'); s.textContent = text; s.className = isError ? 'msg-err' : 'msg-ok'; m.appendChild(s);
    if (isError) { var x = document.createElement('button'); x.type = 'button'; x.className = 'msg-dismiss'; x.textContent = 'Dismiss'; x.onclick = function () { m.style.display = 'none'; m.innerHTML = ''; }; m.appendChild(x); }
    else { m._t = setTimeout(function () { m.style.display = 'none'; m.innerHTML = ''; }, 3000); }
  }
  function cmsResetToBaseline(card, key) {
    var base = CMS_BASELINE[key];
    CMS_TEMPLATE[key] = (typeof base === 'string') ? base : JSON.parse(JSON.stringify(base));
    var els = card.querySelectorAll('.cms-input');
    for (var i = 0; i < els.length; i++) { var p = els[i].getAttribute('data-path'); var v = (typeof base === 'string') ? base : cmsGetPath(base, p); els[i].value = (v == null ? '' : v); cmsWc(els[i]); }
  }
  // Update the sidebar status indicator for the subtype a unit belongs to.
  function cmsUpdateNav(key) {
    var m = /^(subtype_(?:sp|so|sx)[1-9])\\./.exec(key); if (!m) return;
    var subId = 'card-' + m[1].replace(/\\./g, '-');
    var card = document.getElementById(subId); if (!card) return;
    var units = card.querySelectorAll('[data-card-key]'), statuses = [];
    for (var i = 0; i < units.length; i++) statuses.push(units[i].getAttribute('data-status'));
    var worst = statuses.indexOf('draft') >= 0 ? 'draft' : statuses.indexOf('published') >= 0 ? 'published' : 'unmodified';
    var cls = worst === 'published' ? 'pub' : worst === 'draft' ? 'draft' : 'unmod';
    var st = document.querySelector('.sub-link[data-subtype="' + subId + '"] [data-role="navstat"]');
    if (st) { st.className = 'sub-stat ' + cls; st.textContent = worst === 'published' ? 'Published' : worst === 'draft' ? 'Draft' : 'Unmodified'; }
  }
  function cmsSave(key, action) {
    var card = cmsCardEl(key); if (!card) return;
    var value = cmsCollect(key);
    if (action === 'publish') {                                  // P6 overflow guard
      var n = cmsCountWords(value), over = null;
      if (/\\.narrative$/.test(key) && n > 130) over = 'narrative is ' + n + ' words (P6 budget ~130)';
      else if (/\\.patterns$/.test(key) && n > 135) over = 'pattern bullets total ' + n + ' words (P6 budget ~135)';
      if (over && !confirm('This ' + over + '. The P6 page layout may overflow. Publish anyway?')) return;
    }
    var d = card.querySelector('[data-role="draft"]'), p = card.querySelector('[data-role="publish"]');
    var btn = action === 'draft' ? d : p; var orig = btn.textContent;
    d.disabled = true; p.disabled = true; btn.textContent = action === 'draft' ? 'Saving…' : 'Publishing…';
    fetch('/admin/content/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ content_key: key, value: value }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        btn.textContent = orig;
        if (res.ok) {
          CMS_TEMPLATE[key] = value; CMS_STATUS[key] = (action === 'draft') ? 'draft' : 'published';
          card.setAttribute('data-dirty', '0');
          cmsSetStatus(card, action === 'draft' ? 'draft' : 'published');
          cmsMsg(card, action === 'draft' ? 'Saved as draft' : 'Published', false);
          cmsUpdateNav(key);
        } else { cmsRefresh(card); cmsMsg(card, res.error || 'Save failed', true); }
      })
      .catch(function () { btn.textContent = orig; cmsRefresh(card); cmsMsg(card, 'Request failed', true); });
  }
  function cmsRevert(key) {
    if (!confirm('Revert ' + key + ' to baseline? This deletes any draft or published override for this field.')) return;
    var card = cmsCardEl(key); if (!card) return;
    var r = card.querySelector('[data-role="revert"]'); var orig = r.textContent;
    r.disabled = true; r.textContent = 'Reverting…';
    fetch('/admin/content/revert', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ content_key: key }) })
      .then(function (rp) { return rp.json(); })
      .then(function (res) {
        r.disabled = false; r.textContent = orig;
        if (res.ok) { cmsResetToBaseline(card, key); card.setAttribute('data-dirty', '0'); cmsSetStatus(card, 'unmodified'); cmsUpdateNav(key); }
        else { cmsMsg(card, res.error || 'Revert failed', true); }
      })
      .catch(function () { r.disabled = false; r.textContent = orig; cmsMsg(card, 'Request failed', true); });
  }
  function cmsShowSubtype(subId) {
    var cards = document.querySelectorAll('.subtype-card');
    for (var i = 0; i < cards.length; i++) cards[i].style.display = (cards[i].id === subId) ? '' : 'none';
    var links = document.querySelectorAll('.sub-link');
    for (var j = 0; j < links.length; j++) links[j].classList.toggle('active', links[j].getAttribute('data-subtype') === subId);
  }
  function cmsToggleGroup(code) { var g = document.querySelector('.nav-group[data-group="' + code + '"]'); if (g) g.classList.toggle('open'); }
  document.addEventListener('DOMContentLoaded', function () {
    var units = document.querySelectorAll('[data-card-key]');
    for (var i = 0; i < units.length; i++) { units[i].setAttribute('data-dirty', '0'); cmsRefresh(units[i]); }
    var inputs = document.querySelectorAll('.cms-input');
    for (var j = 0; j < inputs.length; j++) cmsWc(inputs[j]);
    cmsShowSubtype('${firstId}');
  });
</script>
</body></html>`;
}

// The 12 editable type fields, grouped by the report page they affect (PR 5).
const CMS_TYPE_PAGES = [
  { page: 'PAGE 3 — Type Hypotheses', fields: [
      { field: 'description', label: 'Description', note: "Heads up: the “Worldview” text below is not shown in the client report — only “Core Motivation” renders (P3). Preview reflects Core Motivation edits only." },
      { field: 'comparison', label: 'Comparison Rows' } ] },
  { page: 'PAGE 4 — Patterns', fields: [
      { field: 'patterns', label: 'Patterns' },
      { field: 'inquiry_lines', label: 'Inquiry Lines', note: 'This field is not currently rendered in the client report preview.' } ] },
  { page: 'PAGE 5 — Wings & Lines', fields: [
      { field: 'wings', label: 'Wings' },
      { field: 'lines', label: 'Lines' } ] },
  { page: 'PAGE 7 — Strengths & Growth', fields: [
      { field: 'strengths', label: 'Strengths' },
      { field: 'challenges', label: 'Challenges' },
      { field: 'practices', label: 'Practices' } ] },
  { page: 'PAGE 8 — Application', fields: [
      { field: 'communication', label: 'Communication' },
      { field: 'conflict', label: 'Conflict' },
      { field: 'center', label: 'Center' } ] },
];

function renderTypesPage(overrides, req) {
  const template = {}, baselineMap = {}, statusMap = {};
  let nPub = 0, nDraft = 0, nUnmod = 0, typesWithPub = 0;
  let firstId = null;
  const links = [], cards = [];

  for (let n = 1; n <= 9; n++) {
    const typeKey = `type_${n}`;
    const baseObj = contentLibrary[typeKey] || {};
    const cardId = cmsCardId(typeKey);             // card-type_9
    if (!firstId) firstId = cardId;
    const fieldStatuses = [];
    const groupHtml = CMS_TYPE_PAGES.map(grp => {
      const units = grp.fields.map(f => {
        const key = `${typeKey}.${f.field}`;
        const ov = overrides[key];
        const status = ov ? ov.status : 'unmodified';
        if (status === 'published') nPub++; else if (status === 'draft') nDraft++; else nUnmod++;
        const value = ov ? ov.parsed : baseObj[f.field];
        template[key] = value;
        baselineMap[key] = baseObj[f.field];
        statusMap[key] = status;
        fieldStatuses.push(status);
        return cmsSubtypeUnit(key, value, status, f.label, f.note);
      }).join('');
      return `<div class="page-group"><div class="page-group-h">${esc(grp.page)}</div>${units}</div>`;
    }).join('');
    const worst = cmsWorstStatus(fieldStatuses);
    if (fieldStatuses.indexOf('published') >= 0) typesWithPub++;
    const label = `Type ${n} — ${esc(baseObj.name || ('Type ' + n))}`;
    links.push(`<a class="sub-link" href="#${cardId}" data-subtype="${cardId}" onclick="cmsShowSubtype('${cardId}');return false;"><span>${label}</span><span class="sub-stat ${cmsStatusClass(worst)}" data-role="navstat">${cmsStatusWord(worst)}</span></a>`);
    cards.push(`<div class="subtype-card" id="${cardId}" style="display:none">
      <div class="subtype-head"><span class="st-code">Type ${n}</span><span class="st-name">${esc(baseObj.name || ('Type ' + n))}</span>${baseObj.center_label ? `<span class="st-center">${esc(baseObj.center_label)}</span>` : ''}</div>
      ${groupHtml}
    </div>`);
  }

  const templateJson = JSON.stringify(template).replace(/</g, '\\u003c');
  const baselineJson = JSON.stringify(baselineMap).replace(/</g, '\\u003c');
  const statusJson = JSON.stringify(statusMap).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Hive Admin — Type Content</title>
<style>
  * { box-sizing: border-box; }
  :root { --topbar-h: 84px; --sidebar-w: 230px; }
  body { margin: 0; font-family: Georgia, serif; background: #F7F4EF; color: #1A2B33; }
  .top-bar { background: #1A2B33; color: #fff; padding: 16px 24px; min-height: var(--topbar-h); display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 20; }
  .top-bar h1 { font-size: 18px; margin: 4px 0 0; font-weight: 700; }
  .top-bar svg.logo { height: 26px; width: auto; vertical-align: middle; }
  .top-bar .nav-link { color: #9FB4C0; font-size: 12px; text-decoration: none; }
  .top-bar .nav-link:hover { color: #fff; }
  .nav-sep { color: #4A5E68; margin: 0 4px; }
  .sidebar { position: fixed; top: var(--topbar-h); left: 0; bottom: 0; width: var(--sidebar-w); background: #fff; border-right: 1px solid #E2E6EA; overflow-y: auto; padding: 14px 0; z-index: 10; }
  .spy-title { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #9FB0B9; font-weight: 700; padding: 0 16px 8px; }
  .sub-link { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 16px; font-size: 13px; color: #5A6472; text-decoration: none; border-left: 3px solid transparent; }
  .sub-link:hover { background: #F7F8F9; }
  .sub-link.active { color: #00B2D9; border-left-color: #00B2D9; font-weight: 700; }
  .sub-stat { font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; flex-shrink: 0; }
  .sub-stat.pub { background: #e6f7ee; color: #1a7a4a; }
  .sub-stat.draft { background: #fef6e0; color: #9a6a00; }
  .sub-stat.unmod { background: #f1f1ee; color: #8A969C; }
  .container { max-width: 860px; margin: 0 0 0 var(--sidebar-w); padding: 28px 24px; }
  .summary { font-size: 13px; color: #5A6E78; margin-bottom: 20px; }
  .summary b { color: #1A2B33; }
  .subtype-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
  .subtype-head .st-code { font-family: Menlo, monospace; font-size: 12px; font-weight: 700; color: #fff; background: #00859f; padding: 3px 8px; border-radius: 3px; }
  .subtype-head .st-name { font-size: 20px; font-weight: 700; color: #1A2B33; }
  .subtype-head .st-center { font-size: 12px; color: #7A8A92; }
  .page-group { margin-bottom: 26px; }
  .page-group-h { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #00859f; border-bottom: 2px solid #d8eef2; padding-bottom: 5px; margin: 22px 0 12px; }
  .card { background: #fff; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; margin-bottom: 14px; }
  .unit-head { padding: 12px 18px; border-bottom: 1px solid #EFE8E0; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .unit-label { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; color: #1A2B33; text-transform: uppercase; }
  .unit-note { padding: 9px 18px; font-size: 12px; font-style: italic; color: #8A6d00; background: #fef9ec; border-bottom: 1px solid #f0e6cf; }
  .badge { flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 3px; letter-spacing: 0.04em; }
  .badge.pub { background: #e6f7ee; color: #1a7a4a; }
  .badge.draft { background: #fef6e0; color: #9a6a00; }
  .badge.unmod { background: #f1f1ee; color: #7A8A92; }
  .field-body { padding: 16px 18px; }
  .leaf { margin-bottom: 14px; }
  .leaf label { display: block; font-size: 11px; color: #7A96A6; letter-spacing: 0.07em; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
  .cms-input { width: 100%; padding: 9px 11px; border: 1px solid #D0DCE4; border-radius: 4px; font-family: Georgia, serif; font-size: 14px; line-height: 1.5; color: #1A2B33; outline: none; resize: vertical; }
  .cms-input:focus { border-color: #00b1d7; }
  .ro { font-size: 13px; color: #5A6E78; background: #f7f7f4; border: 1px solid #ECECE6; border-radius: 4px; padding: 7px 10px; }
  .wc { font-size: 11px; color: #7A96A6; margin-top: 3px; }
  .group { border-left: 3px solid #EFE8E0; padding-left: 14px; margin-bottom: 16px; }
  .group-h { font-size: 12px; font-weight: 700; color: #00859f; margin-bottom: 8px; letter-spacing: 0.03em; }
  .field-actions { padding: 12px 18px; border-top: 1px solid #EFE8E0; background: #fbfaf7; display: flex; gap: 10px; align-items: center; }
  .field-actions button { font-family: Georgia, serif; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; }
  .field-actions button:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-draft { background: #eef2f4; color: #1A2B33; }
  .btn-draft:not(:disabled):hover { background: #e2e8eb; }
  .btn-pub { background: #00b1d7; color: #fff; }
  .btn-pub:not(:disabled):hover { background: #009bbf; }
  .btn-preview { background: #e4eef2; color: #00859f; }
  .btn-preview:not(:disabled):hover { background: #d4e6ec; }
  .btn-revert { background: transparent; color: #c0392b; margin-left: auto; }
  .btn-revert:not(:disabled):hover { text-decoration: underline; }
  .field-msg { padding: 0 18px 12px; font-size: 13px; align-items: center; gap: 12px; }
  .field-msg .msg-ok { color: #1a7a4a; }
  .field-msg .msg-err { color: #c0392b; }
  .field-msg .msg-dismiss { font-family: Georgia, serif; font-size: 11px; font-weight: 700; color: #c0392b; background: transparent; border: 1px solid #e3b7b1; border-radius: 3px; padding: 2px 8px; cursor: pointer; }
  .cmpv-overlay { position: fixed; inset: 0; background: rgba(20,30,40,.72); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .cmpv-panel { background: #fff; border-radius: 8px; padding: 14px; max-height: 94vh; display: flex; flex-direction: column; box-shadow: 0 12px 48px rgba(0,0,0,.4); }
  .cmpv-head { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 10px; }
  .cmpv-cap { font-size: 13px; font-weight: 700; color: #1A2B33; }
  .cmpv-close { font-family: Georgia, serif; font-size: 12px; font-weight: 700; color: #c0392b; background: transparent; border: 1px solid #e3b7b1; border-radius: 4px; padding: 5px 12px; cursor: pointer; }
  .cmpv-img { max-height: 86vh; max-width: 86vw; width: auto; height: auto; border: 1px solid #E2E6EA; }
  ${CMS_DROPDOWN_CSS}
  @media (max-width: 768px) { .sidebar { display: none; } .container { margin-left: 0; } }
</style></head>
<body>
<div class="top-bar">
  <div>${HIVE_LOGO_SVG}<h1>Type Content</h1></div>
  <div style="display:flex;align-items:center;gap:10px;">
    <a href="/admin" class="nav-link">← Dashboard</a><span class="nav-sep">|</span>
    ${cmsContentMenu('types')}<span class="nav-sep">|</span>
    ${auth.hasRole(req, 'super_admin') ? `<a href="/admin/beta-review" class="nav-link">Beta Review</a><span class="nav-sep">|</span>` : ''}
    <a href="/admin/logout" class="nav-link">Sign out</a>
  </div>
</div>
<nav class="sidebar"><div class="spy-title">Types</div>${links.join('')}</nav>
<div class="container">
  <div class="summary">Editing type content (<b>type_*.*</b>). Published edits go live on the next report render; drafts do not. Status — <b>${nPub}</b> published · <b>${nDraft}</b> draft · <b>${nUnmod}</b> unmodified (of 108 fields across 9 types). <b>${typesWithPub}</b>/9 types have at least one published edit.</div>
  ${cards.join('')}
</div>
<div id="cms-preview-modal" class="cmpv-overlay" style="display:none" onclick="if(event.target===this)cmsClosePreview()">
  <div class="cmpv-panel">
    <div class="cmpv-head"><span class="cmpv-cap"></span><button type="button" class="cmpv-close" onclick="cmsClosePreview()">✕ Close</button></div>
    <img class="cmpv-img" alt="page preview">
  </div>
</div>
<script>
  var CMS_TEMPLATE = ${templateJson};
  var CMS_BASELINE = ${baselineJson};
  var CMS_STATUS = ${statusJson};
</script>
<script>
${CMS_SHARED_JS}
  function cmsSetPath(obj, path, val) {
    if (path === '') return;
    var segs = path.split('.'), cur = obj;
    for (var i = 0; i < segs.length - 1; i++) { var s = segs[i]; cur = cur[/^\\d+$/.test(s) ? parseInt(s, 10) : s]; if (cur == null) return; }
    var last = segs[segs.length - 1];
    cur[/^\\d+$/.test(last) ? parseInt(last, 10) : last] = val;
  }
  function cmsCollect(key) {
    var tpl = CMS_TEMPLATE[key];
    if (typeof tpl === 'string') { var one = document.querySelector('[data-field="' + key + '"]'); return one ? one.value : tpl; }
    var out = JSON.parse(JSON.stringify(tpl));
    var els = document.querySelectorAll('[data-field="' + key + '"]');
    for (var i = 0; i < els.length; i++) cmsSetPath(out, els[i].getAttribute('data-path'), els[i].value);
    return out;
  }
  function cmsWc(el) {
    var t = el.value.trim(); var n = t ? t.split(/\\s+/).length : 0;
    var box = el.parentNode.querySelector('.wc-now'); if (box) box.textContent = n;
    var bud = parseInt(el.getAttribute('data-budget'), 10);
    var wrap = el.parentNode.querySelector('.wc');
    if (bud && wrap) wrap.style.color = n > bud ? '#c0392b' : '#7A96A6';
  }
  function cmsInput(el) { cmsWc(el); var card = el.closest('[data-card-key]'); if (card) { card.setAttribute('data-dirty', '1'); cmsRefresh(card); } }
  function cmsRefresh(card) {
    var status = card.getAttribute('data-status'); var dirty = card.getAttribute('data-dirty') === '1';
    var d = card.querySelector('[data-role="draft"]'), p = card.querySelector('[data-role="publish"]'), r = card.querySelector('[data-role="revert"]');
    if (d) d.disabled = !dirty;
    if (p) p.disabled = !(status === 'draft' && !dirty);
    if (r) r.style.display = (status === 'unmodified') ? 'none' : '';
  }
  function cmsBadge(card, status) {
    var b = card.querySelector('[data-role="badge"]'); if (!b) return;
    b.className = 'badge ' + (status === 'published' ? 'pub' : status === 'draft' ? 'draft' : 'unmod');
    b.textContent = status === 'published' ? 'Published' : status === 'draft' ? 'Draft' : 'Unmodified';
  }
  function cmsMsg(card, text, isError) {
    var m = card.querySelector('[data-role="msg"]'); if (!m) return;
    if (m._t) { clearTimeout(m._t); m._t = null; }
    m.innerHTML = ''; m.style.display = 'flex';
    var s = document.createElement('span'); s.textContent = text; s.className = isError ? 'msg-err' : 'msg-ok'; m.appendChild(s);
    if (isError) { var x = document.createElement('button'); x.type = 'button'; x.className = 'msg-dismiss'; x.textContent = 'Dismiss'; x.onclick = function () { m.style.display = 'none'; m.innerHTML = ''; }; m.appendChild(x); }
    else { m._t = setTimeout(function () { m.style.display = 'none'; m.innerHTML = ''; }, 3000); }
  }
  function cmsResetToBaseline(card, key) {
    var base = CMS_BASELINE[key];
    CMS_TEMPLATE[key] = (typeof base === 'string') ? base : JSON.parse(JSON.stringify(base));
    var els = card.querySelectorAll('.cms-input');
    for (var i = 0; i < els.length; i++) { var p = els[i].getAttribute('data-path'); var v = (typeof base === 'string') ? base : cmsGetPath(base, p); els[i].value = (v == null ? '' : v); cmsWc(els[i]); }
  }
  // Update the sidebar status indicator for the type a unit belongs to.
  function cmsUpdateNav(key) {
    var m = /^(type_[1-9])\\./.exec(key); if (!m) return;
    var cardId = 'card-' + m[1].replace(/\\./g, '-');
    var card = document.getElementById(cardId); if (!card) return;
    var units = card.querySelectorAll('[data-card-key]'), statuses = [];
    for (var i = 0; i < units.length; i++) statuses.push(units[i].getAttribute('data-status'));
    var worst = statuses.indexOf('draft') >= 0 ? 'draft' : statuses.indexOf('published') >= 0 ? 'published' : 'unmodified';
    var cls = worst === 'published' ? 'pub' : worst === 'draft' ? 'draft' : 'unmod';
    var st = document.querySelector('.sub-link[data-subtype="' + cardId + '"] [data-role="navstat"]');
    if (st) { st.className = 'sub-stat ' + cls; st.textContent = worst === 'published' ? 'Published' : worst === 'draft' ? 'Draft' : 'Unmodified'; }
  }
  function cmsSave(key, action) {
    var card = cmsCardEl(key); if (!card) return;
    var value = cmsCollect(key);
    var d = card.querySelector('[data-role="draft"]'), p = card.querySelector('[data-role="publish"]');
    var btn = action === 'draft' ? d : p; var orig = btn.textContent;
    d.disabled = true; p.disabled = true; btn.textContent = action === 'draft' ? 'Saving…' : 'Publishing…';
    fetch('/admin/content/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ content_key: key, value: value }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        btn.textContent = orig;
        if (res.ok) {
          CMS_TEMPLATE[key] = value; CMS_STATUS[key] = (action === 'draft') ? 'draft' : 'published';
          card.setAttribute('data-dirty', '0');
          cmsSetStatus(card, action === 'draft' ? 'draft' : 'published');
          cmsMsg(card, action === 'draft' ? 'Saved as draft' : 'Published', false);
          cmsUpdateNav(key);
        } else { cmsRefresh(card); cmsMsg(card, res.error || 'Save failed', true); }
      })
      .catch(function () { btn.textContent = orig; cmsRefresh(card); cmsMsg(card, 'Request failed', true); });
  }
  function cmsRevert(key) {
    if (!confirm('Revert ' + key + ' to baseline? This deletes any draft or published override for this field.')) return;
    var card = cmsCardEl(key); if (!card) return;
    var r = card.querySelector('[data-role="revert"]'); var orig = r.textContent;
    r.disabled = true; r.textContent = 'Reverting…';
    fetch('/admin/content/revert', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ content_key: key }) })
      .then(function (rp) { return rp.json(); })
      .then(function (res) {
        r.disabled = false; r.textContent = orig;
        if (res.ok) { cmsResetToBaseline(card, key); card.setAttribute('data-dirty', '0'); cmsSetStatus(card, 'unmodified'); cmsUpdateNav(key); }
        else { cmsMsg(card, res.error || 'Revert failed', true); }
      })
      .catch(function () { r.disabled = false; r.textContent = orig; cmsMsg(card, 'Request failed', true); });
  }
  function cmsShowSubtype(cardId) {
    var cards = document.querySelectorAll('.subtype-card');
    for (var i = 0; i < cards.length; i++) cards[i].style.display = (cards[i].id === cardId) ? '' : 'none';
    var links = document.querySelectorAll('.sub-link');
    for (var j = 0; j < links.length; j++) links[j].classList.toggle('active', links[j].getAttribute('data-subtype') === cardId);
  }
  document.addEventListener('DOMContentLoaded', function () {
    var units = document.querySelectorAll('[data-card-key]');
    for (var i = 0; i < units.length; i++) { units[i].setAttribute('data-dirty', '0'); cmsRefresh(units[i]); }
    var inputs = document.querySelectorAll('.cms-input');
    for (var j = 0; j < inputs.length; j++) cmsWc(inputs[j]);
    cmsShowSubtype('${firstId}');
  });
</script>
</body></html>`;
}

app.get('/admin/content', requireSuperAdmin, (req, res) => res.redirect('/admin/content/global'));

app.get('/admin/content/global', requireSuperAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const overrides = await contentOverrides.getAllOverrides();
  res.send(renderContentPage(overrides, req));
});

app.get('/admin/content/subtypes', requireSuperAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const overrides = await contentOverrides.getAllOverrides();
  res.send(renderSubtypesPage(overrides, req));
});

app.get('/admin/content/types', requireSuperAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const overrides = await contentOverrides.getAllOverrides();
  res.send(renderTypesPage(overrides, req));
});

// =================== /admin/beta-review — BETA FEEDBACK REVIEW (super-admin) ===================
// Respondent list (server-rendered) + a two-tab tester modal (self-vs-engine + survey
// in Tab 1; full stage-by-stage walkthrough in Tab 2) + a Re-analyze scaffold (PR-F).

const BR_TYPE_NAMES = {
  1: 'The Improver', 2: 'The Giver', 3: 'The Performer', 4: 'The Individualist',
  5: 'The Observer', 6: 'The Questioner', 7: 'The Enthusiast', 8: 'The Protector',
  9: 'The Peacemaker',
};
const BR_LIKERT_LABELS = {
  clarity: 'Clarity of questions', ease: 'Ease of answering', length: 'Length & pacing',
  navigation: 'Navigation and way-finding', overall: 'Overall experience',
};
// Human-readable labels for the state-at-time-of-assessment single-selects (enum → label).
const BR_MOOD_LABELS = {
  calm: 'Calm and clear', mildly_stressed: 'Mildly stressed or busy',
  emotionally_heavy: 'Emotionally heavy or activated', distracted: 'Distracted or scattered',
};
const BR_ENVIRONMENT_LABELS = {
  quiet: 'Quiet and uninterrupted', somewhat_distracted: 'Somewhat distracted',
  noisy_interrupted: 'Noisy or interrupted',
};

function brParseMaybe(v) {
  if (v == null) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (_) { return null; } }
  return v;
}

// Self vs engine indicator. selfObj = { dontKnow, values }. Match only when the engine
// value is the sole self-pick; Partial when it's one of several; Miss when absent.
function brMatch(engineVal, selfObj) {
  if (!selfObj || selfObj.dontKnow) return { label: 'Not assessed', cls: 'na' };
  if (engineVal == null || engineVal === '') return { label: '—', cls: 'na' };
  const vals = (selfObj.values || []).map(String);
  if (vals.indexOf(String(engineVal)) >= 0) {
    return vals.length === 1 ? { label: 'Match', cls: 'match' } : { label: 'Partial', cls: 'partial' };
  }
  return { label: 'Miss', cls: 'miss' };
}

function brSelfTypesStr(selfObj) {
  if (!selfObj || selfObj.dontKnow) return 'I don’t know';
  const vals = selfObj.values || [];
  return vals.length ? vals.map((t) => `Type ${t}`).join(', ') : '—';
}
function brSelfInstStr(selfObj) {
  if (!selfObj || selfObj.dontKnow) return 'I don’t know';
  const vals = selfObj.values || [];
  return vals.length ? vals.join(', ') : '—';
}

// Build Tab 1 HTML (self-vs-engine comparison + Blocks A/B/C) from the joined row + the
// beta_feedback row.
function renderBetaTab1Html(row, bf) {
  const selfTypes = brParseMaybe(bf.self_hypothesis_types);
  const selfInst  = brParseMaybe(bf.self_hypothesis_instincts);
  const flagged   = brParseMaybe(bf.flagged_keys) || [];
  const likert    = brParseMaybe(bf.block_b_answers) || {};

  const engineType = row.confirmed_type;
  const engineInst = row.dominant_instinct_hypothesis || row.confirmed_instinct;
  const typeMatch  = brMatch(engineType, selfTypes);
  const instMatch  = brMatch(engineInst, selfInst);
  const engineTypeStr = engineType ? `Type ${engineType} — ${BR_TYPE_NAMES[engineType] || ''}` : '—';
  const engineSubStr  = (engineInst && engineType) ? `${engineInst} ${engineType}` : '—';

  const cmpRow = (label, selfStr, engineStr, m) => `
    <tr>
      <td style="padding:8px 10px;font-size:12px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;width:22%;">${esc(label)}</td>
      <td style="padding:8px 10px;font-size:14px;color:#1A2B33;width:33%;">${esc(selfStr)}</td>
      <td style="padding:8px 10px;font-size:14px;color:#1A2B33;width:33%;">${esc(engineStr)}</td>
      <td style="padding:8px 10px;text-align:right;width:12%;"><span class="br-ind br-ind-${m.cls}">${esc(m.label)}</span></td>
    </tr>`;

  // State-at-time-of-assessment (mood/environment section) — first section.
  const moodLabel = bf.mood_at_time ? (BR_MOOD_LABELS[bf.mood_at_time] || bf.mood_at_time) : null;
  const envLabel  = bf.environment_at_time ? (BR_ENVIRONMENT_LABELS[bf.environment_at_time] || bf.environment_at_time) : null;
  const stateRow = (label, val) => `
    <tr>
      <td style="padding:8px 10px;font-size:12px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;width:30%;vertical-align:top;">${esc(label)}</td>
      <td style="padding:8px 10px;font-size:14px;color:#1A2B33;">${val}</td>
    </tr>`;
  let html = `<div class="br-tab-section">
    <div class="br-tab-h">Your Mood/Environment During Testing</div>
    <table class="br-cmp">
      ${stateRow('Mood', moodLabel ? esc(moodLabel) : '<span class="br-muted">Not provided</span>')}
      ${stateRow('Environment', envLabel ? esc(envLabel) : '<span class="br-muted">Not provided</span>')}
      ${stateRow('Reflection', bf.state_reflection_text ? esc(bf.state_reflection_text) : '<span class="br-muted">None provided</span>')}
    </table>
    ${bf.state_analysis
      ? `<div style="margin-top:12px;padding:12px 14px;background:#F0F8FA;border-left:3px solid #00859f;border-radius:4px;">
           <div style="font-size:11px;color:#00859f;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;margin-bottom:4px;">Hive note</div>
           <div style="font-size:14px;color:#1A2B33;line-height:1.5;">${esc(bf.state_analysis)}</div>
         </div>`
      : `<div style="margin-top:12px;"><span class="br-muted">Analysis pending</span></div>`}
  </div>`;

  html += `<div class="br-tab-section">
    <div class="br-tab-h">Self-hypothesis vs. engine</div>
    <table class="br-cmp">
      <tr><td></td>
        <td style="padding:6px 10px;font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Tester thinks</td>
        <td style="padding:6px 10px;font-size:11px;color:#7A96A6;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Engine says</td>
        <td></td></tr>
      ${cmpRow('Type', brSelfTypesStr(selfTypes), engineTypeStr, typeMatch)}
      ${cmpRow('Instinct', brSelfInstStr(selfInst), engineSubStr, instMatch)}
    </table>
    <div style="font-size:12px;color:#7A96A6;margin-top:4px;">Engine confidence: ${esc(row.confidence_level || '—')}</div>
  </div>`;

  // Block A — flagged statements + comments
  html += `<div class="br-tab-section"><div class="br-tab-h">Flagged questions (Block A)</div>`;
  if (!flagged.length) {
    html += `<p class="br-muted">No questions were flagged.</p>`;
  } else {
    html += flagged.map((f) => {
      const text = BETA_QUESTION_TEXT[f.key] || f.key;
      const meta = `${f.stageLabel || ''} · ${f.key}`;
      const body = f.reconsidered
        ? `<div class="br-flag-reconsidered">Reconsidered and removed by the tester.</div>`
        : `<div class="br-flag-comment">${f.comment ? esc(f.comment) : '<span class="br-muted">(no comment)</span>'}</div>`;
      return `<div class="br-flag-row">
        <div class="br-flag-q">${esc(text)}</div>
        <div class="br-flag-meta">${esc(meta)}</div>
        ${body}
      </div>`;
    }).join('');
  }
  html += `</div>`;

  // Block B — Likert
  html += `<div class="br-tab-section"><div class="br-tab-h">Experience ratings (Block B)</div><table class="br-likert-tbl">`;
  html += Object.keys(BR_LIKERT_LABELS).map((k) => {
    const v = (likert && likert[k] != null) ? likert[k] : '—';
    return `<tr><td style="padding:6px 10px;font-size:13px;color:#1A2B33;">${esc(BR_LIKERT_LABELS[k])}</td>
      <td style="padding:6px 10px;font-size:14px;font-weight:700;color:#00859f;text-align:right;width:60px;">${esc(String(v))} ${v === '—' ? '' : '/ 5'}</td></tr>`;
  }).join('');
  html += `</table></div>`;

  // Block C — open text
  html += `<div class="br-tab-section"><div class="br-tab-h">Anything else (Block C)</div>`;
  html += bf.overall_notes ? `<p class="br-notes">${esc(bf.overall_notes)}</p>` : `<p class="br-muted">—</p>`;
  html += `</div>`;

  return html;
}

// Build Tab 2 HTML (stage-by-stage walkthrough) by reusing the beta-report builder.
// Returns null when the snapshots needed to reconstruct the walkthrough are absent.
function renderBetaTab2Html(row) {
  if (!row || !row.responses_snapshot || !row.scores_snapshot) return null;
  try {
    const data = buildBetaData(row);
    const header = `<div class="br-engine-header">
      <span class="br-eh-type">${esc(data.typeLabel || '—')}</span>
      <span class="br-eh-meta">Confidence: ${esc(data.confidenceLevel || '—')} · Stage 4: ${esc(data.stage4Outcome || '—')}${data.flags && data.flags.length ? ' · Flags: ' + esc(data.flags.map((f) => f.label).join(', ')) : ''}</span>
    </div>`;
    return header + `<div class="br-walkthrough">${betaReportBodyHtml(data)}</div>`;
  } catch (e) {
    console.error(`[beta-review/tab2] buildBetaData failed for client #${row.client_id}:`, e.message);
    return null;
  }
}

app.get('/admin/beta-review', requireSuperAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  let respondents = [];
  let analysis = null;
  try {
    respondents = await db.getBetaReviewRespondents();
  } catch (e) {
    console.error('[beta-review] respondent fetch failed:', e.message);
  }
  try {
    analysis = await db.getBetaAnalysis();
  } catch (e) {
    console.error('[beta-review] analysis fetch failed:', e.message);
  }
  res.send(renderBetaReviewPage(req, respondents, analysis));
});

app.get('/admin/beta-review/tester/:client_id', requireSuperAdmin, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const row = await db.getBetaReviewRow(clientId).catch(() => null);
  if (!row) return res.json({ available: false, reason: 'No assessment found for this tester.' });

  const bf = await db.getBetaFeedback(row.assessment_id).catch(() => null);
  if (!bf) return res.json({ available: false, reason: 'This tester has not submitted feedback yet.' });

  const testerName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
  const tab1Html = renderBetaTab1Html(row, bf);
  const tab2Html = renderBetaTab2Html(row); // null when snapshots are missing
  return res.json({ available: true, testerName, tab1Html, tab2Html });
});

// ── Re-analyze synthesis (PR-F) ───────────────────────────────────────────────
// Hybrid design: the handler computes the counts/averages deterministically (never
// trusting the LLM to do arithmetic); Opus 4.8 supplies interpretation — per-statement
// comment synthesis, Likert narratives, subtype-accuracy clusters, Block C themes, and
// recommended actions. The merged five-part result is stored in beta_analysis (overwrite
// on re-run) and rendered on /admin/beta-review.

const BETA_ANALYSIS_MODEL = 'claude-opus-4-8';

const BETA_SYNTHESIS_SYSTEM = `You are a product researcher analyzing beta-tester feedback for the InsightOut Enneagram typing assessment. You are given (1) pre-computed aggregates and (2) the raw per-tester feedback. Your job is INTERPRETATION ONLY — never recompute or restate the provided counts or averages; treat them as ground truth and explain what they mean. Be concrete, specific, and concise. Ground every statement in the supplied data. Output strictly the requested JSON object and nothing else.`;

const BETA_SYNTHESIS_OUTPUT_FORMAT = `Return ONLY a JSON object with exactly these keys:
{
  "flagged_comments": { "<statement key>": "<one-sentence synthesis of what testers said about this flagged statement>" },
  "likert_narratives": { "clarity": "<one sentence>", "ease": "<one sentence>", "length": "<one sentence>", "navigation": "<one sentence>", "overall": "<one sentence>" },
  "subtype_accuracy": { "summary": "<2-3 sentences on engine-vs-tester self-hypothesis agreement>", "clusters": [ { "pattern": "<short label>", "detail": "<1-2 sentences naming the misfire cluster>" } ] },
  "block_c_themes": { "summary": "<1-2 sentences>", "themes": [ "<theme>", "..." ] },
  "recommended_actions": [ "<action>", "... (3 to 5 total)" ]
}
Only include "flagged_comments" entries for statement keys that appear in the provided flagged data. Use the literal text provided; do not invent feedback. If a section has no data, return an empty object/array and say so in its summary.`;

// Deterministic aggregation over the analysis rows. Returns flagged-key counts (live
// flags only — reconsidered ones are excluded), Likert per-dimension averages, and the
// respondent count. Defensive against string-vs-object JSONB.
function brComputeAggregates(rows) {
  const parse = (v) => {
    if (v == null) return null;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch (_) { return null; } }
    return v;
  };
  const flagMap = {}; // key -> { key, stageLabel, questionText, count }
  const likertSums = {}; const likertN = {};
  const dims = ['clarity', 'ease', 'length', 'navigation', 'overall'];
  dims.forEach((d) => { likertSums[d] = 0; likertN[d] = 0; });

  rows.forEach((row) => {
    const flagged = parse(row.flagged_keys) || [];
    (Array.isArray(flagged) ? flagged : []).forEach((f) => {
      if (!f || f.reconsidered) return; // count only live flags
      const key = f.key;
      if (!flagMap[key]) {
        flagMap[key] = { key, stageLabel: f.stageLabel || '', questionText: BETA_QUESTION_TEXT[key] || key, count: 0 };
      }
      flagMap[key].count += 1;
    });
    const likert = parse(row.block_b_answers) || {};
    dims.forEach((d) => {
      const v = likert[d];
      if (typeof v === 'number') { likertSums[d] += v; likertN[d] += 1; }
    });
  });

  const flaggedCounts = Object.values(flagMap).sort((a, b) => b.count - a.count);
  const likertAvg = {};
  dims.forEach((d) => { likertAvg[d] = likertN[d] ? Math.round((likertSums[d] / likertN[d]) * 10) / 10 : null; });
  return { flaggedCounts, likertAvg, respondentCount: rows.length };
}

// Compact per-tester payload for the LLM (live flags only, with reconstructed text).
function brBuildSynthesisInput(rows) {
  const parse = (v) => {
    if (v == null) return null;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch (_) { return null; } }
    return v;
  };
  return rows.map((row) => {
    const selfT = parse(row.self_hypothesis_types);
    const selfI = parse(row.self_hypothesis_instincts);
    const flagged = (parse(row.flagged_keys) || []).filter((f) => f && !f.reconsidered).map((f) => ({
      key: f.key, stage: f.stageLabel || '', text: BETA_QUESTION_TEXT[f.key] || f.key, comment: f.comment || '',
    }));
    return {
      engine: { type: row.confirmed_type, instinct: row.dominant_instinct_hypothesis || row.confirmed_instinct },
      self: { types: selfT, instincts: selfI },
      flagged,
      likert: parse(row.block_b_answers) || {},
      notes: row.overall_notes || '',
    };
  });
}

app.post('/admin/beta-review/analyze', requireSuperAdmin, async (req, res) => {
  let rows = [];
  try {
    rows = await db.getBetaFeedbackForAnalysis();
  } catch (e) {
    console.error('[beta-review/analyze] data fetch failed:', e.message);
    return res.status(500).json({ ok: false, error: 'Could not load feedback data.' });
  }
  // Restrict to the tester selection sent by the page (assessment IDs). Absent/empty
  // body → analyze all (backward compatible). The inner join to beta_feedback already
  // bounds the result set to submitted rows, so an unsubmitted ID can't slip through.
  const ids = Array.isArray(req.body && req.body.assessmentIds)
    ? req.body.assessmentIds.map(Number).filter(Number.isInteger)
    : null;
  if (ids && ids.length) rows = rows.filter((r) => ids.includes(r.assessment_id));
  if (!rows.length) {
    return res.json({ ok: false, error: 'No feedback to analyze yet.' });
  }

  const agg = brComputeAggregates(rows);
  const testers = brBuildSynthesisInput(rows);

  const userMessage = `PRE-COMPUTED AGGREGATES (ground truth — do not recompute):
- Respondents: ${agg.respondentCount}
- Flagged-statement counts (live flags), ranked: ${JSON.stringify(agg.flaggedCounts)}
- Likert averages (0–5) per dimension: ${JSON.stringify(agg.likertAvg)}

RAW PER-TESTER FEEDBACK:
${JSON.stringify(testers, null, 2)}

${BETA_SYNTHESIS_OUTPUT_FORMAT}`;

  let parsed = null;
  let usage = null;
  try {
    const response = await client.messages.create({
      model: BETA_ANALYSIS_MODEL,
      max_tokens: 4000,
      system: [{ type: 'text', text: BETA_SYNTHESIS_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
    usage = response.usage || null;
    console.log(`[beta-review/analyze] usage — ${JSON.stringify(usage)}`);
    const text = response.content[0].text;
    const stripped = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(extractFirstJsonObject(stripped));
  } catch (e) {
    console.error('[beta-review/analyze] Claude call/parse failed:', e.message);
    return res.status(500).json({ ok: false, error: 'Analysis failed. Please try again.' });
  }

  // Merge deterministic aggregates with the LLM narrative into the stored shape.
  const flaggedComments = (parsed && parsed.flagged_comments) || {};
  const likertNarr = (parsed && parsed.likert_narratives) || {};
  const analysisJson = {
    flagged_frequency: agg.flaggedCounts.map((f) => ({ ...f, synthesized_comment: flaggedComments[f.key] || '' })),
    likert: ['clarity', 'ease', 'length', 'navigation', 'overall'].reduce((o, d) => {
      o[d] = { avg: agg.likertAvg[d], narrative: likertNarr[d] || '' };
      return o;
    }, {}),
    subtype_accuracy: (parsed && parsed.subtype_accuracy) || { summary: '', clusters: [] },
    block_c_themes: (parsed && parsed.block_c_themes) || { summary: '', themes: [] },
    recommended_actions: (parsed && parsed.recommended_actions) || [],
  };

  try {
    await db.saveBetaAnalysis({ analysisJson, model: BETA_ANALYSIS_MODEL, tokenUsage: usage, respondentCount: agg.respondentCount });
  } catch (e) {
    console.error('[beta-review/analyze] save failed:', e.message);
    return res.status(500).json({ ok: false, error: 'Analysis ran but could not be saved.' });
  }

  const saved = await db.getBetaAnalysis().catch(() => null);
  return res.json({ ok: true, analysisHtml: renderBetaAnalysisHtml(saved) });
});

// Clear the stored cross-tester analysis (nulls analysis_json via clearBetaAnalysis,
// added in PR-F). The page then shows the "Not yet analyzed" empty state. Super-admin only.
app.post('/admin/beta-review/clear-analysis', requireSuperAdmin, async (req, res) => {
  try {
    await db.clearBetaAnalysis();
    return res.json({ ok: true });
  } catch (e) {
    console.error('[beta-review/clear-analysis] failed:', e.message);
    return res.status(500).json({ ok: false, error: 'Clear failed' });
  }
});

// ── Enhanced Mode (EM) — on-demand experimental analysis (super-admin) ────────────
// Manual Re-run / Run-Opus trigger. The automatic parallel-mode trigger is PR6's
// runBackgroundJob hook; this route is the after-the-fact re-run. The Anthropic call
// is wrapped here (server owns the SDK client) and injected into runExperimentalAnalysis
// so app/experimental_analysis.js stays SDK-free (C-c). EM is fully isolated — a failure
// returns { ok:false } and never affects SM.
app.post('/admin/experiment/raw-analysis/:assessment_id', requireSuperAdmin, async (req, res) => {
  const assessmentId = parseInt(req.params.assessment_id, 10);
  if (!assessmentId || isNaN(assessmentId)) {
    return res.status(400).json({ ok: false, error: 'Invalid assessment id' });
  }
  // 'opus' selects Opus; anything else (incl. absent/unrecognized) defaults to Sonnet (C-d).
  const model = (req.body && req.body.model) || 'sonnet';

  // Adapter matching runExperimentalAnalysis's callClaude contract:
  //   ({ model, max_tokens, system, user }) => { text, usage }
  const callClaude = async ({ model: modelId, max_tokens, system, user }) => {
    const response = await client.messages.create({
      model: modelId,
      max_tokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    });
    console.log(`[em] usage — ${JSON.stringify(response.usage)}`);
    return { text: response.content[0].text, usage: response.usage };
  };

  try {
    const out = await experimentalAnalysis.runExperimentalAnalysis({
      assessmentId, model, trigger: 'manual', callClaude, db,
    });
    if (!out.ok) {
      console.warn(`[em] assessment #${assessmentId} failed: ${out.error}`);
      return res.status(422).json(out);
    }
    console.log(`[em] assessment #${assessmentId} ok — type=${out.result?.confirmed_type} match=${out.match_status}`);
    // PR B: lifecycle audit — EM analysis re-run completed (super-admin action).
    try {
      const _asm = await db.getAssessmentById(assessmentId);
      const _pv = (out.result && out.result.meta && out.result.meta.prompt_version) || 'unknown';
      if (_asm && _asm.client_id) {
        db.logClientEvent({
          clientId: _asm.client_id, assessmentId,
          eventType: 'em_rerun_completed',
          eventDescription: `EM analysis re-run completed (model: ${model}, prompt version: ${_pv})`,
          actor: req.session.coach_name,
        });
      }
    } catch (le) { console.error('[em] history log failed:', le.message); }
    return res.json(out);
  } catch (e) {
    // runExperimentalAnalysis is self-contained, but guard the route regardless.
    console.error('[em] route error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ══ Enhanced Mode (EM) Analysis Lab (PR7) — super-admin ════════════════════════════
// Admin UI for the EM experiment: cohort Overview, per-assessment SM/EM/declared
// comparison, Mode Settings, and the Reliability Log. All super-admin only; zero
// contact with live assessment routing. Per-model EM results are read from
// em_reliability_log (R1); declared type + match status are computed LIVE from
// beta_feedback (R2). The model selector persists but auto-fire is Sonnet-only (R5);
// the EM-active toggle maps to em_analysis_mode (R6).

function _emTypeName(n) {
  return (n && stage1Labels.TYPE_GEOMETRY[n] && stage1Labels.TYPE_GEOMETRY[n].name) || '';
}
function _emTypeLabel(n) {
  if (!n) return '—';
  const nm = _emTypeName(n);
  return 'Type ' + n + (nm ? ' — ' + nm : '');
}
function _emSubtype(type, inst) {
  if (!type) return '—';
  return (inst ? inst + ' ' : '') + type;
}
// Collapse an EM Lab roster row's engine results into a priority-ordered candidate
// list for the union MATCH check. Priority: EM Opus → EM Sonnet → SM. Only results
// with a non-null type are included (a missing engine is skipped, not treated as 0).
function resolveEngineResults(r) {
  return [
    { type: r.em_type_opus,   instinct: r.em_instinct_opus,   source: 'opus' },
    { type: r.em_type_sonnet, instinct: r.em_instinct_sonnet, source: 'sonnet' },
    { type: r.sm_type,        instinct: r.sm_instinct,        source: 'sm' },
  ].filter((c) => c.type != null);
}
function _emMatchBadge(status) {
  let cls = 'em-ind-na';
  if (status === 'Exact') cls = 'em-ind-match';
  else if (status === 'Type only' || status === 'Instinct only') cls = 'em-ind-partial';
  else if (status === 'Mismatch') cls = 'em-ind-miss';
  else if (status === 'Incomplete') cls = 'em-ind-incomplete';
  return '<span class="em-ind ' + cls + '">' + esc(status || 'Pending') + '</span>';
}
// DECLARED cell label for the EM Lab roster, per the 5-state declaration matrix.
// Don't-Know / asterisk cases never route through _emSubtype (which prints "—" for a
// null type). Legacy partial rows (type set, instinct null, idk false) → Pending.
function _emDeclaredLabel(r) {
  const tdk = !!r.declared_type_dont_know;
  const idk = !!r.declared_instinct_dont_know;
  const typeSet = r.declared_type != null;
  const instSet = r.declared_instinct != null;
  if (typeSet && instSet) return esc(_emSubtype(r.declared_type, r.declared_instinct)); // e.g. SX 4
  if (typeSet && idk)      return esc(String(r.declared_type) + '*');                    // e.g. 4*
  if (tdk && instSet)      return esc(String(r.declared_instinct) + '*');               // e.g. SX*
  if (tdk && idk)          return '<span class="em-badge-dk">Don\'t Know</span>';
  return '<span class="em-badge-pend">Pending</span>';
}
// MATCH cell for the EM Lab roster under the declaration matrix. Both dimensions known
// → the union check (computeMatchStatus). Exactly one known (other Don't Know) →
// Incomplete. Both Don't Know, or nothing declared → Pending.
function _emDeclaredMatch(r, candidates) {
  const tdk = !!r.declared_type_dont_know;
  const idk = !!r.declared_instinct_dont_know;
  const typeSet = r.declared_type != null;
  const instSet = r.declared_instinct != null;
  if (typeSet && instSet) {
    return _emMatchBadge(experimentalAnalysis.computeMatchStatus(candidates,
      { type: r.declared_type, instinct: r.declared_instinct }));
  }
  if ((typeSet && idk) || (tdk && instSet)) return _emMatchBadge('Incomplete');
  return _emMatchBadge('Pending');
}
function _emParse(v) {
  if (v == null) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return null; } }
  return v;
}
function _emSm(assessment) {
  const ar = _emParse(assessment && assessment.api_result);
  const h = (ar && ar.hypothesis) || {};
  // em_only: h.call1_ranking holds EM's dimensional ranking (it drives the coach chart). The TRUE
  // SM Call #1 coherence ranking lives on scores_snapshot.call1Result.ranking — read it from there
  // so the "SM Coherence" column shows real coherence scores, not EM's dimensional scores.
  let ranking = Array.isArray(h.call1_ranking) ? h.call1_ranking : null;   // R3: may be null on older rows
  if (ar && ar.meta && ar.meta.source === 'em_primary') {
    const ss = _emParse(assessment && assessment.scores_snapshot);
    const c1 = ss && ss.call1Result && ss.call1Result.ranking;
    if (Array.isArray(c1)) ranking = c1;
  }
  return {
    type: h.confirmed_type ?? null,
    instinct: h.dominant_instinct_hypothesis ?? null,
    confidence: h.confidence_level ?? null,
    alternate: h.alternate_candidate ?? null,
    ranking,
  };
}
function _emFmtDate(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return '—'; }
}

// Side-by-side bar chart: SM coherence (call1_ranking) vs EM dimensional (em_ranking).
function _emBarsHtml(smRanking, emRanking) {
  const sm = {}; (smRanking || []).forEach((e) => { if (e && e.type != null) sm[e.type] = e.score; });
  const em = {}; (emRanking || []).forEach((e) => { if (e && e.type != null) em[e.type] = e.score; });
  const scores = [].concat(Object.values(sm), Object.values(em)).filter((v) => typeof v === 'number');
  const denom = scores.length ? Math.max.apply(null, scores) : 100;
  const d = denom > 0 ? denom : 100;
  let rows = '';
  for (let t = 1; t <= 9; t++) {
    const s = sm[t], e = em[t];
    const sW = (typeof s === 'number') ? Math.round((s / d) * 100) : 0;
    const eW = (typeof e === 'number') ? Math.round((e / d) * 100) : 0;
    rows += '<div class="em-bar-row"><div class="em-bar-lbl">' + esc(_emTypeLabel(t)) + '</div>'
      + '<div class="em-bar-track"><div class="em-bar em-bar-sm" style="width:' + sW + '%;"></div><span class="em-bar-val">' + (typeof s === 'number' ? s : 'n/a') + '</span></div>'
      + '<div class="em-bar-track"><div class="em-bar em-bar-em" style="width:' + eW + '%;"></div><span class="em-bar-val">' + (typeof e === 'number' ? e : 'n/a') + '</span></div></div>';
  }
  const note = smRanking ? '' : '<p class="em-muted">SM coherence ranking unavailable for this assessment.</p>';
  return '<div class="em-bars"><div class="em-bar-row em-bar-headrow"><div class="em-bar-lbl"></div><div class="em-bar-h em-bar-h-sm">SM coherence</div><div class="em-bar-h em-bar-h-em">EM dimensional</div></div>' + rows + '</div>' + note;
}

function _emObsHtml(obs) {
  if (!Array.isArray(obs) || !obs.length) return '<p class="em-muted">No observations.</p>';
  return '<ul class="em-obs">' + obs.map((o) => {
    const s = String(o || '');
    let cls = 'em-obs-note', label = 'NOTE', body = s;
    const m = /^\s*\[(CONFIRMS|NOTE|FLAG)\]\s*/i.exec(s);
    if (m) {
      const tag = m[1].toUpperCase();
      body = s.slice(m[0].length);
      if (tag === 'CONFIRMS') { cls = 'em-obs-confirm'; label = 'CONFIRMS'; }
      else if (tag === 'FLAG') { cls = 'em-obs-flag'; label = 'FLAG'; }
    }
    return '<li><span class="em-obs-badge ' + cls + '">' + label + '</span>' + esc(body) + '</li>';
  }).join('') + '</ul>';
}

// Server-rendered detail panel for one assessment (returned by the detail route).
function renderEmDetailHtml(d) {
  const aid = d.assessmentId;
  const sm = d.sm || {};
  const em = d.em;                       // experimental_raw_analysis (latest run) or null
  const declared = d.declared || null;
  const dType = declared ? declared.declared_type : null;
  const dInst = declared ? declared.declared_instinct : null;

  if (!em) {
    return '<div class="em-empty-detail">'
      + '<p class="em-muted">No EM result yet for assessment #' + aid + '.</p>'
      + '<button class="em-btn" onclick="emRun(' + aid + ',\'sonnet\',this)">Run Analysis</button>'
      + '</div>';
  }

  const matchEm = experimentalAnalysis.computeMatchStatus(
    { type: em.confirmed_type, instinct: em.dominant_instinct_hypothesis }, { type: dType, instinct: dInst });
  const matchSm = experimentalAnalysis.computeMatchStatus(
    { type: sm.type, instinct: sm.instinct }, { type: dType, instinct: dInst });

  // 3-column comparison (SM · EM · Declared).
  const smCol = '<div class="em-col"><div class="em-col-h">Standard Mode</div>'
    + '<div class="em-col-type">' + esc(_emTypeLabel(sm.type)) + '</div>'
    + '<div class="em-col-meta">Instinct: <strong>' + esc(sm.instinct || '—') + '</strong></div>'
    + '<div class="em-col-meta">Confidence: ' + esc(sm.confidence || '—') + '</div>'
    + '<div class="em-col-meta">Alternate: ' + esc(_emTypeLabel(sm.alternate)) + '</div></div>';
  const emCol = '<div class="em-col em-col-em' + (sm.type && em.confirmed_type && sm.type !== em.confirmed_type ? ' em-col-diff' : '') + '">'
    + '<div class="em-col-h">Enhanced Mode</div>'
    + '<div class="em-col-type">' + esc(_emTypeLabel(em.confirmed_type)) + '</div>'
    + '<div class="em-col-meta">Instinct: <strong>' + esc(em.dominant_instinct_hypothesis || '—') + '</strong> (' + esc(em.em_instinct_confidence || '—') + ')</div>'
    + '<div class="em-col-meta">Confidence: ' + esc(em.confidence_level || '—') + '</div>'
    + (em.confidence_rationale ? '<div class="em-col-note">' + esc(em.confidence_rationale) + '</div>' : '')
    + '<div class="em-col-meta">Alternate: ' + esc(_emTypeLabel(em.alternate_candidate)) + '</div>'
    + (em.alternate_rationale ? '<div class="em-col-note">' + esc(em.alternate_rationale) + '</div>' : '') + '</div>';
  const decCol = '<div class="em-col"><div class="em-col-h">Declared</div>'
    + (dType
        ? '<div class="em-col-type">' + esc(_emTypeLabel(dType)) + '</div>'
          + '<div class="em-col-meta">Instinct: <strong>' + esc(dInst || '—') + '</strong></div>'
          + (declared.declared_subtype ? '<div class="em-col-meta">Subtype: ' + esc(declared.declared_subtype) + '</div>' : '')
          + '<div class="em-col-meta">Confidence: ' + esc(declared.declaration_confidence || '—') + '</div>'
          + '<div class="em-col-meta">vs EM: ' + _emMatchBadge(matchEm) + '</div>'
          + '<div class="em-col-meta">vs SM: ' + _emMatchBadge(matchSm) + '</div>'
        : '<p class="em-muted">Pending tester declaration.</p>')
    + '</div>';

  // Framework signals.
  const fs = em.framework_signals || {};
  const fwHtml = '<table class="em-tbl"><tbody>'
    + '<tr><th>Hornevian</th><td>' + esc(fs.hornevian || '—') + '</td></tr>'
    + '<tr><th>Harmonic</th><td>' + esc(fs.harmonic || '—') + '</td></tr>'
    + '<tr><th>Center</th><td>' + esc(fs.center || '—') + '</td></tr>'
    + '<tr><th>Stage 2 alignment</th><td>' + esc(fs.stage2_alignment || '—') + '</td></tr>'
    + '</tbody></table>';

  // Geometric neighborhood (3 cards).
  const gn = em.geometric_neighborhood || {};
  const geo = stage1Labels.TYPE_GEOMETRY[em.confirmed_type] || {};
  const wingCard = '<div class="em-card"><div class="em-card-h">Active wing</div><div class="em-card-type">' + esc(_emTypeLabel(gn.active_wing)) + '</div></div>';
  const stressCard = '<div class="em-card"><div class="em-card-h">Stress point</div><div class="em-card-type">' + esc(_emTypeLabel(geo.stress)) + '</div><div class="em-card-note">' + (gn.stress_echo_present ? 'echo: ' + esc(gn.stress_echo_note || 'present') : 'no echo') + '</div></div>';
  const secCard = '<div class="em-card"><div class="em-card-h">Security point</div><div class="em-card-type">' + esc(_emTypeLabel(geo.security)) + '</div><div class="em-card-note">' + (gn.security_echo_present ? 'echo: ' + esc(gn.security_echo_note || 'present') : 'no echo') + '</div></div>';
  const geoHtml = '<div class="em-cards">' + wingCard + stressCard + secCard + '</div><p class="em-muted">Neighborhood coherence: ' + esc(gn.neighborhood_coherence || '—') + '</p>';

  // Instinct analysis.
  const ia = em.instinct_analysis || {};
  const iaHtml = '<table class="em-tbl"><tbody>'
    + '<tr><th>Stack coherence</th><td>' + esc(ia.stack_coherence || '—') + '</td></tr>'
    + '<tr><th>Means (dom / sec / ter)</th><td>' + [ia.dominant_mean, ia.secondary_mean, ia.tertiary_mean].map((x) => (x == null ? '—' : x)).join(' / ') + '</td></tr>'
    + '<tr><th>Stack gap</th><td>' + (ia.stack_gap == null ? '—' : ia.stack_gap) + '</td></tr>'
    + '<tr><th>Dominant confidence</th><td>' + esc(ia.dominant_confidence || '—') + '</td></tr>'
    + (ia.within_instinct_notes ? '<tr><th>Notes</th><td>' + esc(ia.within_instinct_notes) + '</td></tr>' : '')
    + '</tbody></table>';

  // Counter-type flag (only if flagged).
  const ct = em.counter_type_flag || {};
  const ctHtml = ct.flagged
    ? '<div class="em-section"><div class="em-h em-h-flag">Counter-type flag</div><div class="em-ct">'
      + '<strong>' + esc(_emTypeLabel(ct.type)) + (ct.instinct ? ' · ' + esc(ct.instinct) : '') + '</strong>'
      + (ct.rationale ? '<p>' + esc(ct.rationale) + '</p>' : '') + '</div></div>'
    : '';

  // Run metadata.
  const meta = em.meta || {};
  const perModel = [];
  if (d.emSonnetType) perModel.push('Sonnet → ' + esc(_emTypeLabel(d.emSonnetType)));
  if (d.emOpusType) perModel.push('Opus → ' + esc(_emTypeLabel(d.emOpusType)));
  const metaHtml = '<table class="em-tbl"><tbody>'
    + '<tr><th>Model</th><td>' + esc(meta.model || '—') + '</td></tr>'
    + '<tr><th>Prompt version</th><td>' + esc(meta.prompt_version || '—') + '</td></tr>'
    + '<tr><th>Trigger</th><td>' + esc(meta.trigger || '—') + '</td></tr>'
    + '<tr><th>Generated</th><td>' + esc(_emFmtDate(meta.generated_at)) + '</td></tr>'
    + '<tr><th>Tokens (in / out)</th><td>' + (meta.input_tokens == null ? '—' : meta.input_tokens) + ' / ' + (meta.output_tokens == null ? '—' : meta.output_tokens) + '</td></tr>'
    + (perModel.length ? '<tr><th>Models run</th><td>' + perModel.join(' · ') + '</td></tr>' : '')
    + (meta.source_assessment_is_latest === false ? '<tr><th>Warning</th><td class="em-warn">Snapshot reflects the client\'s latest assessment, not this one.</td></tr>' : '')
    + '</tbody></table>';

  // Download Comparison (A2): active only when BOTH a Sonnet and an Opus analysis run
  // exist for this assessment; otherwise disabled with a tooltip naming what's missing.
  const hasSonnet = !!d.hasSonnetRerun;
  const hasOpus = !!d.hasOpusRerun;
  let comparisonBtn;
  if (hasSonnet && hasOpus) {
    comparisonBtn = '<a class="em-btn em-btn-ghost" href="/admin/em-lab/assessment/' + aid + '/comparison.csv">Download Comparison</a>';
  } else {
    const missing = !hasSonnet && !hasOpus ? 'Sonnet and Opus re-runs' : (!hasSonnet ? 'Sonnet re-run' : 'Opus re-run');
    comparisonBtn = '<button class="em-btn em-btn-ghost" disabled title="Run ' + esc(missing) + ' first to enable comparison">Download Comparison</button>';
  }

  const actions = '<div class="em-detail-actions">'
    + '<button class="em-btn" onclick="emRun(' + aid + ',\'sonnet\',this)">Re-run (Sonnet)</button>'
    + '<button class="em-btn em-btn-ghost" onclick="emRun(' + aid + ',\'opus\',this)">Run Opus</button>'
    + '<button class="em-btn em-btn-ghost" onclick="emReport(' + aid + ',this)">Re-run Report</button>'
    + '<a class="em-btn em-btn-ghost" href="/admin/em-lab/assessment/' + aid + '/context-package">Download Full Context Package</a>'
    + comparisonBtn
    + '</div>';

  // Re-run PDF links (A2): surfaced only after a Re-run Report has produced PDFs.
  const rr = d.rerunReport || null;
  const rerunLinks = (rr && (rr.rerun_client_pdf_path || rr.rerun_coach_pdf_path))
    ? '<div class="em-detail-actions" style="margin-top:8px;">'
      + (rr.rerun_client_pdf_path ? '<a class="em-btn em-btn-ghost" href="/admin/em-lab/assessment/' + aid + '/rerun-pdf/client" target="_blank" rel="noopener">View Re-run Client Report</a>' : '')
      + (rr.rerun_coach_pdf_path ? '<a class="em-btn em-btn-ghost" href="/admin/em-lab/assessment/' + aid + '/rerun-pdf/coach" target="_blank" rel="noopener">View Re-run Coach Report</a>' : '')
      + '</div>'
    : '';

  return '<div class="em-detail">'
    + '<div class="em-3col">' + smCol + emCol + decCol + '</div>'
    + '<div class="em-section"><div class="em-h">Type score comparison</div>' + _emBarsHtml(sm.ranking, em.em_ranking) + '</div>'
    + '<div class="em-section"><div class="em-h">Framework signals</div>' + fwHtml + '</div>'
    + '<div class="em-section"><div class="em-h">Dimensional observations</div>' + _emObsHtml(em.dimensional_observations) + '</div>'
    + '<div class="em-section"><div class="em-h">Geometric neighborhood</div>' + geoHtml + '</div>'
    + '<div class="em-section"><div class="em-h">Instinct analysis</div>' + iaHtml + '</div>'
    + ctHtml
    + '<div class="em-section"><div class="em-h">EM reasoning</div><div class="em-reasoning">' + esc(em.reasoning || '—') + '</div></div>'
    + '<div class="em-section"><div class="em-h">Run metadata</div>' + metaHtml + '</div>'
    + actions + rerunLinks + '</div>';
}

// GET the EM Lab page (Overview / Mode Settings / Reliability rendered server-side;
// Assessment Detail lazy-loads on roster click).
app.get('/admin/em-lab', requireSuperAdmin, async (req, res) => {
  const [roster, settings, log] = await Promise.all([
    db.getEmLabRoster().catch(() => []),
    db.getAppSettings().catch(() => null),
    db.getEmReliabilityLog({ limit: 300 }).catch(() => []),
  ]);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderEmLabPage(req, { roster: roster || [], settings: settings || {}, log: log || [] }));
});

// GET the detail panel for one assessment (server-rendered HTML).
app.get('/admin/em-lab/assessment/:assessment_id', requireSuperAdmin, async (req, res) => {
  const aid = parseInt(req.params.assessment_id, 10);
  if (!aid || isNaN(aid)) return res.status(400).json({ available: false, error: 'Invalid assessment id' });
  try {
    const assessment = await db.getAssessmentById(aid);
    if (!assessment) return res.json({ available: false, error: 'Assessment not found' });
    const [em, logRows, declared, client, rerunReport] = await Promise.all([
      db.getEmResult(aid).catch(() => null),
      db.getEmReliabilityLog({ assessmentId: aid }).catch(() => []),
      db.getBetaFeedback(aid).catch(() => null),
      db.getClientById(assessment.client_id).catch(() => null),
      db.getEmRerunReport(aid).catch(() => null),
    ]);
    const sonnetRow = (logRows || []).find((r) => r.em_type_sonnet != null);
    const opusRow = (logRows || []).find((r) => r.em_type_opus != null);
    const html = renderEmDetailHtml({
      assessmentId: aid,
      sm: _emSm(assessment),
      em: _emParse(em),
      emSonnetType: sonnetRow ? sonnetRow.em_type_sonnet : null,
      emOpusType: opusRow ? opusRow.em_type_opus : null,
      hasSonnetRerun: !!sonnetRow,
      hasOpusRerun: !!opusRow,
      rerunReport: rerunReport || null,
      declared,
      client,
    });
    const name = client ? ((client.first_name || '') + ' ' + (client.last_name || '')).trim() : 'Assessment #' + aid;
    return res.json({ available: true, hasEmResult: !!em, html, name });
  } catch (e) {
    console.error('[em-lab/detail] failed:', e.message);
    return res.status(500).json({ available: false, error: e.message });
  }
});

// ── A2 EM Lab tooling helpers ────────────────────────────────────────────────────
// Filename-safe segment: lowercase, non-alphanumerics → underscore. Used for the
// download Content-Disposition names.
function _safeSegment(str) {
  return (str == null || String(str).trim() === '' ? 'unknown' : String(str))
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

// RFC 4180 CSV cell + spreadsheet formula-injection guard. A leading = + - @ is
// neutralized with a single quote so Excel/Sheets won't evaluate it as a formula.
function _csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// GET the Full Context Package (ZIP) for one assessment — five JSON files, no PDFs.
// Streams via archiver. Super-admin only; EM Lab is a read/analysis workspace.
app.get('/admin/em-lab/assessment/:assessment_id/context-package', requireSuperAdmin, async (req, res) => {
  const aid = parseInt(req.params.assessment_id, 10);
  if (!aid || isNaN(aid)) return res.status(400).json({ error: 'Invalid assessment id' });
  try {
    const assessment = await db.getAssessmentById(aid);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (assessment.status !== 'complete') {
      return res.status(422).json({ error: 'Assessment is not complete — context package unavailable until completion.' });
    }

    const [client, settings] = await Promise.all([
      assessment.client_id ? db.getClientById(assessment.client_id).catch(() => null) : null,
      db.getAppSettings().catch(() => null),
    ]);
    const coach = client && client.coach_id ? await db.getCoachById(client.coach_id).catch(() => null) : null;

    const apiResult = _emParse(assessment.api_result);
    const hyp = (apiResult && apiResult.hypothesis) || {};
    const meta = (apiResult && apiResult.meta) || {};
    const clientName = client ? ((client.first_name || '') + ' ' + (client.last_name || '')).trim() : null;
    const completedAt = assessment.assessment_completed_at || assessment.completed_at || null;

    // responses_snapshot: prefer the per-assessment column (A1); fall back to the
    // deprecated clients column with a note that it may reflect a later assessment.
    let snapshot = _emParse(assessment.responses_snapshot);
    let snapshotNote = null;
    if (!snapshot && client) {
      snapshot = _emParse(client.responses_snapshot);
      if (snapshot) snapshotNote = 'responses_snapshot read from clients table — may reflect a later assessment';
    }

    // a) assessment_result.json
    const resultFile = apiResult || { unavailable: true, note: 'api_result was not set at time of download' };

    // b) raw_scores.json — snapshot wrapped with a metadata header.
    const rawScoresFile = {
      _metadata: {
        assessment_id: aid,
        client_name: clientName,
        completion_date: completedAt,
        model: meta.model || null,
        prompt_version: meta.prompt_version || null,
        ...(snapshotNote ? { _note: snapshotNote } : {}),
      },
      responses_snapshot: snapshot || null,
    };

    // c) open_responses.json — verbatim, null fields omitted. finalQuestion is the
    //    TOP-LEVEL snapshot key (the "Stage 4 final reflection"); there is no stage4.finalQuestion.
    const s0 = (snapshot && snapshot.stage0) || {};
    const s1 = (snapshot && snapshot.stage1) || {};
    const openResponses = {};
    if (s0.q1) openResponses['Stage 0 — Q1 (self-description)'] = s0.q1;
    if (s0.q2) openResponses['Stage 0 — Q2 (how others describe you)'] = s0.q2;
    if (s0.q3) openResponses['Stage 0 — Q3 (greatest strength)'] = s0.q3;
    if (s0.q4) openResponses['Stage 0 — Q4 (most problematic)'] = s0.q4;
    if (s1.typeOpen) openResponses['Stage 1 — Type open response'] = s1.typeOpen;
    if (s1.instinctOpen) openResponses['Stage 1 — Instinct open response'] = s1.instinctOpen;
    if (snapshot && snapshot.finalQuestion) openResponses['Stage 4 — Final reflection'] = snapshot.finalQuestion;

    // d) assessment_metadata.json
    const metadataFile = {
      client_id: assessment.client_id,
      assessment_id: aid,
      client_name: clientName,
      coach_name: coach ? coach.name : null,
      completed_at: completedAt,
      analysis_mode: assessment.analysis_mode || null,
      assessment_analysis_mode_override: assessment.analysis_mode || null,
      current_global_em_analysis_mode: settings ? (settings.em_analysis_mode || null) : null,
      _note: 'current_global_em_analysis_mode is current-state, not the mode historically in effect at assessment time',
      model: meta.model || null,
      prompt_version: meta.prompt_version || null,
      confirmed_type: hyp.confirmed_type ?? assessment.confirmed_type ?? null,
      confidence_level: hyp.confidence_level ?? assessment.confidence_level ?? null,
      dominant_instinct_hypothesis: hyp.dominant_instinct_hypothesis ?? assessment.dominant_instinct_hypothesis ?? null,
      alternate_candidate: hyp.alternate_candidate ?? null,
      stage4_outcome: hyp.stage4_outcome ?? null,
      ...(hyp.counter_type_flag ? { counter_type_flag: hyp.counter_type_flag } : {}),
    };

    // e) em_analysis.json
    const emAnalysis = _emParse(assessment.experimental_raw_analysis);
    const emAnalysisFile = emAnalysis || { unavailable: true, note: 'No EM analysis run found for this assessment' };

    const last = _safeSegment(client && client.last_name);
    const first = _safeSegment(client && client.first_name);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="context_package_${last}_${first}_${aid}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error(`[em-lab/context-package] #${aid} archive error:`, err.message);
      try { res.destroy(err); } catch (e) {}
    });
    archive.pipe(res);
    const J = (o) => JSON.stringify(o, null, 2);
    archive.append(J(resultFile), { name: 'assessment_result.json' });
    archive.append(J(rawScoresFile), { name: 'raw_scores.json' });
    archive.append(J(openResponses), { name: 'open_responses.json' });
    archive.append(J(metadataFile), { name: 'assessment_metadata.json' });
    archive.append(J(emAnalysisFile), { name: 'em_analysis.json' });
    // PR B: lifecycle audit — Full Context Package downloaded (super-admin action). Logged
    // here, after the data assembled cleanly and just before streaming begins.
    if (assessment.client_id) {
      db.logClientEvent({
        clientId: assessment.client_id, assessmentId: aid,
        eventType: 'context_package_downloaded',
        eventDescription: 'Full Context Package (ZIP) downloaded',
        actor: req.session.coach_name,
      });
    }
    await archive.finalize();
    console.log(`[em-lab/context-package] #${aid} streamed (5 files)`);
  } catch (e) {
    console.error('[em-lab/context-package] route error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// GET the Sonnet-vs-Opus comparison CSV for one assessment. Sources the latest Sonnet
// and latest Opus EM ANALYSIS runs from em_reliability_log (full_em_result). Super-admin only.
app.get('/admin/em-lab/assessment/:assessment_id/comparison.csv', requireSuperAdmin, async (req, res) => {
  const aid = parseInt(req.params.assessment_id, 10);
  if (!aid || isNaN(aid)) return res.status(400).json({ error: 'Invalid assessment id' });
  try {
    const assessment = await db.getAssessmentById(aid);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const logRows = await db.getEmReliabilityLog({ assessmentId: aid }).catch(() => []);
    const sonnetRow = (logRows || []).find((r) => r.em_type_sonnet != null);
    const opusRow = (logRows || []).find((r) => r.em_type_opus != null);
    if (!sonnetRow || !opusRow) {
      const missing = !sonnetRow && !opusRow ? 'Sonnet and Opus re-runs' : (!sonnetRow ? 'Sonnet re-run' : 'Opus re-run');
      return res.status(422).json({ error: `Comparison unavailable — missing ${missing}. Run both Sonnet and Opus before downloading.` });
    }

    const s = _emParse(sonnetRow.full_em_result) || {};
    const o = _emParse(opusRow.full_em_result) || {};
    const ctText = (d) => {
      const ct = d.counter_type_flag || {};
      return ct.flagged ? 'Yes — ' + _emTypeLabel(ct.type) + (ct.instinct ? ' · ' + ct.instinct : '') : 'No';
    };
    const fw = (d) => d.framework_signals || {};
    const gn = (d) => d.geometric_neighborhood || {};
    const instConf = (d) => d.em_instinct_confidence ?? (d.instinct_analysis && d.instinct_analysis.dominant_confidence) ?? null;

    const rows = [
      ['Field', 'Sonnet', 'Opus'],
      ['Confirmed Type', _emTypeLabel(s.confirmed_type), _emTypeLabel(o.confirmed_type)],
      ['Confidence', s.confidence_level, o.confidence_level],
      ['Dominant Instinct', s.dominant_instinct_hypothesis, o.dominant_instinct_hypothesis],
      ['Instinct Confidence', instConf(s), instConf(o)],
      ['Alternate Candidate', _emTypeLabel(s.alternate_candidate), _emTypeLabel(o.alternate_candidate)],
      ['Counter-Type Flag', ctText(s), ctText(o)],
      ['Reasoning Summary', s.reasoning, o.reasoning],
    ];

    // Dimensional observations — one row per observation, padded to the longer array.
    const sObs = Array.isArray(s.dimensional_observations) ? s.dimensional_observations : [];
    const oObs = Array.isArray(o.dimensional_observations) ? o.dimensional_observations : [];
    const obsMax = Math.max(sObs.length, oObs.length);
    for (let i = 0; i < obsMax; i++) {
      rows.push(['Dimensional Observation ' + (i + 1), sObs[i] != null ? sObs[i] : '', oObs[i] != null ? oObs[i] : '']);
    }

    rows.push(['Framework Signals — Hornevian', fw(s).hornevian, fw(o).hornevian]);
    rows.push(['Framework Signals — Harmonic', fw(s).harmonic, fw(o).harmonic]);
    rows.push(['Framework Signals — Center', fw(s).center, fw(o).center]);
    rows.push(['Geometric Neighborhood — Active Wing', _emTypeLabel(gn(s).active_wing), _emTypeLabel(gn(o).active_wing)]);
    rows.push(['Stress Echo', gn(s).stress_echo_present ? (gn(s).stress_echo_note || 'present') : 'no echo', gn(o).stress_echo_present ? (gn(o).stress_echo_note || 'present') : 'no echo']);
    rows.push(['Security Echo', gn(s).security_echo_present ? (gn(s).security_echo_note || 'present') : 'no echo', gn(o).security_echo_present ? (gn(o).security_echo_note || 'present') : 'no echo']);

    const csv = rows.map((r) => r.map(_csvCell).join(',')).join('\r\n');

    // PR B: lifecycle audit — Sonnet vs Opus comparison downloaded (super-admin action).
    if (assessment.client_id) {
      db.logClientEvent({
        clientId: assessment.client_id, assessmentId: aid,
        eventType: 'comparison_downloaded',
        eventDescription: 'Sonnet vs Opus comparison (CSV) downloaded',
        actor: req.session.coach_name,
      });
    }

    const client = assessment.client_id ? await db.getClientById(assessment.client_id).catch(() => null) : null;
    const last = _safeSegment(client && client.last_name);
    const first = _safeSegment(client && client.first_name);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="comparison_${last}_${first}_${aid}.csv"`);
    return res.send(csv);
  } catch (e) {
    console.error('[em-lab/comparison] route error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// Serve a re-run PDF (client|coach) inline. The path comes ONLY from the
// em_rerun_reports DB column — never user input — and is basename-guarded before read.
// Super-admin only; re-run PDFs live exclusively inside EM Lab.
app.get('/admin/em-lab/assessment/:assessment_id/rerun-pdf/:which', requireSuperAdmin, async (req, res) => {
  const aid = parseInt(req.params.assessment_id, 10);
  const which = req.params.which;
  if (!aid || isNaN(aid)) return res.status(400).send('Invalid assessment id');
  if (which !== 'client' && which !== 'coach') return res.status(400).send('Invalid report type');
  try {
    const rr = await db.getEmRerunReport(aid);
    const storedPath = rr && (which === 'client' ? rr.rerun_client_pdf_path : rr.rerun_coach_pdf_path);
    if (!storedPath) return res.status(404).send('No re-run PDF found');
    const filePath = path.join(REPORTS_DIR, path.basename(storedPath));
    if (!fs.existsSync(filePath)) return res.status(404).send('Re-run PDF file not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    return res.sendFile(filePath);
  } catch (e) {
    console.error('[em-lab/rerun-pdf] route error:', e.message);
    return res.status(500).send('Error serving re-run PDF');
  }
});

// Re-run JUST the EM Report Call on a stored assessment, using the already-stored EM analysis
// (experimental_raw_analysis) as input — no full retake, no re-run of the analysis. Reshapes via
// the adapter, dry-validates against the real renderers (build*Model + render*Report), stamps the
// 2b score fields, then persists to em_rerun_reports. Manual / super-admin only; never touches
// runBackgroundJob. The report call is always Opus (client-facing, C5).
//
// ARCHITECTURAL GUARD (A1): EM Lab is a read/analysis workspace. This route MUST NEVER write to
// any production-report path — specifically it must NOT call db.writeApiResultOnce (or otherwise
// touch assessments.api_result), nor db.deleteReportsByAssessmentId / generateReportPDFs (the
// production PDF + reports-row path). Re-run output lands ONLY in em_rerun_reports. The
// writeApiResultOnce "IS NULL" guard also structurally no-ops any accidental call from here.
// (A2): re-run PDFs are generated via generateRerunReportPDFs on the rerun_*_<aid>_<ts>.pdf
// path and recorded on em_rerun_reports only — generateRerunReportPDFs never calls
// db.createReport, so the reports table and dashboard remain untouched.
app.post('/admin/em-lab/report/:assessment_id', requireSuperAdmin, async (req, res) => {
  const aid = parseInt(req.params.assessment_id, 10);
  if (!aid || isNaN(aid)) return res.status(400).json({ ok: false, error: 'Invalid assessment id' });
  try {
    const assessment = await db.getAssessmentById(aid);
    if (!assessment) return res.status(404).json({ ok: false, error: 'Assessment not found' });

    // The stored EM analysis is the report-call input — required.
    const emAnalysis = _emParse(assessment.experimental_raw_analysis);
    if (!emAnalysis) return res.status(422).json({ ok: false, error: 'No EM analysis result found — run EM analysis first' });

    // responses_snapshot now lives on the assessment (A1); fall back to the deprecated
    // clients column for pre-migration rows that were never backfilled. scores_snapshot
    // is on the assessment.
    const cl = assessment.client_id ? await db.getClientById(assessment.client_id) : null;
    const responsesSnapshot = _emParse(assessment.responses_snapshot) || (cl ? _emParse(cl.responses_snapshot) : null);
    if (!responsesSnapshot) return res.status(422).json({ ok: false, error: 'No responses_snapshot found for this assessment' });
    const scores = _emParse(assessment.scores_snapshot) || {};

    // Intake for name resolution (R8) + dry-validation. Coach name affects only the dry render.
    let coachName = 'Cai Delumpa';
    if (cl && cl.coach_id) { try { const co = await db.getCoachById(cl.coach_id); if (co && co.name) coachName = co.name; } catch (e) {} }
    const intake = {
      firstName: (cl && cl.first_name) || '',
      lastName: (cl && cl.last_name) || '',
      organization: (cl && cl.organization) || '',
      coach: coachName,
    };

    // em_model is read for parity with the em_only path; it does NOT change the report model —
    // the report call is always Opus (no analysis is re-run here).
    const appSettings = await db.getAppSettings().catch(() => null);
    const emModel = (appSettings && appSettings.em_model) || 'sonnet';

    const callClaude = async ({ model: modelId, max_tokens, system, user }) => {
      const response = await client.messages.create({
        model: modelId, max_tokens,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      });
      return { text: response.content[0].text, usage: response.usage };
    };

    const contextFields = resolveEmContextFields(emAnalysis, intake);
    const rep = await experimentalAnalysis.runEmReportCall({
      emAnalysis, responsesSnapshot, contextFields, callClaude, db,
      model: experimentalAnalysis.EM_MODEL_OPUS,   // C5: report is client-facing -> always Opus
    });
    if (!rep || !rep.ok || !rep.result) {
      return res.status(422).json({ ok: false, error: 'EM report call failed: ' + ((rep && rep.error) || 'unknown') });
    }

    const adapted = adaptEmToContract(emAnalysis, rep.result, contextFields);

    // DRY-VALIDATE against the real renderers BEFORE persisting (same gate as runEmPrimary). Stamp
    // the 2b score fields onto the copy we persist, so api_result matches the normal-flow shape.
    const probe = JSON.parse(JSON.stringify(adapted));
    if (probe.hypothesis) _stampScoresForDryValidate(probe.hypothesis, scores || {});
    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const dvClient = { first_name: intake.firstName, last_name: intake.lastName, organization: intake.organization, date: reportDate };
    const dvCoach = { full_name: intake.coach, type: null, instinct: null };
    try {
      await reportPrep.buildCoachModel({ apiResult: probe, client: dvClient, coach: dvCoach });
      await reportPrep.buildClientModel({ apiResult: probe, client: dvClient, coach: dvCoach });
      await renderClientReport({ apiResult: probe, client: dvClient, coach: dvCoach });
      await renderCoachReport({ apiResult: probe, client: dvClient, coach: dvCoach });
    } catch (ve) {
      console.error(`[em-lab/report] #${aid} dry-validation failed:`, ve && ve.message);
      return res.status(422).json({ ok: false, error: 'Report failed renderer validation: ' + (ve && ve.message) });
    }

    // Persist the stamped, validated result to em_rerun_reports ONLY (A1) — last-write-wins
    // per assessment. The production assessment row (api_result, PDFs, reports rows) is never
    // touched.
    await db.saveEmRerunReport(
      aid,
      probe,
      experimentalAnalysis.EM_MODEL_OPUS,
      (rep.result && rep.result.meta && rep.result.meta.prompt_version) || null
    );
    console.log(`[em-lab/report] #${aid} EM report re-run stored in em_rerun_reports — type=${probe.hypothesis && probe.hypothesis.confirmed_type} (report=opus, em_model=${emModel}); api_result untouched`);

    // A2: generate re-run PDFs on the rerun_*_<aid>_<ts>.pdf path (NEVER the production
    // reports table) and record the paths on the em_rerun_reports row. Non-fatal: the
    // result above is already committed, so a PDF failure is reported but not raised.
    const rerunPdfs = await generateRerunReportPDFs(probe, intake, aid);
    await db.updateEmRerunReportPdfPaths(aid, rerunPdfs.clientPdfPath, rerunPdfs.coachPdfPath);
    if (!rerunPdfs.pdf_generated) console.warn(`[em-lab/report] #${aid} re-run PDF generation incomplete — result stored, PDFs missing`);

    // PR B: lifecycle audit — EM Lab Re-run Report completed (super-admin action).
    if (assessment.client_id) {
      const _pv = (rep.result && rep.result.meta && rep.result.meta.prompt_version) || 'unknown';
      db.logClientEvent({
        clientId: assessment.client_id, assessmentId: aid,
        eventType: 'em_rerun_completed',
        eventDescription: `EM Lab Re-run Report completed (model: ${experimentalAnalysis.EM_MODEL_OPUS}, prompt version: ${_pv})`,
        actor: req.session.coach_name,
      });
    }

    return res.json({
      ok: true,
      result: probe,
      stored: 'em_rerun_reports',
      pdf_generated: rerunPdfs.pdf_generated,
      has_client_pdf: !!rerunPdfs.clientPdfPath,
      has_coach_pdf: !!rerunPdfs.coachPdfPath,
    });
  } catch (e) {
    console.error('[em-lab/report] route error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// POST global EM mode settings. R6: the active toggle maps to em_analysis_mode
// (on → selected mode default 'parallel'; off → 'sm_only'). No runBackgroundJob change.
app.post('/admin/em-lab/mode-settings', requireSuperAdmin, async (req, res) => {
  const b = req.body || {};
  const active = !!b.em_active;
  const sel = (b.em_analysis_mode === 'em_only' || b.em_analysis_mode === 'parallel') ? b.em_analysis_mode : 'parallel';
  const em_analysis_mode = active ? sel : 'sm_only';
  const VALID_MODELS = ['sonnet', 'opus', 'sonnet_and_opus'];
  const em_model = VALID_MODELS.includes(b.em_model) ? b.em_model : 'sonnet';
  const em_prompt_version = b.em_prompt_version || experimentalAnalysis.PROMPT_VERSION;
  try {
    await db.updateEmModeSettings({ em_active: active, em_analysis_mode, em_model, em_prompt_version });
    const settings = await db.getAppSettings();
    return res.json({ ok: true, settings });
  } catch (e) {
    console.error('[em-lab/mode-settings] failed:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// POST per-client analysis_mode override (also wired into the client profile modal).
app.post('/admin/clients/:client_id/analysis-mode', requireSuperAdmin, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ ok: false, error: 'Invalid client id' });
  let mode = (req.body && req.body.analysis_mode) || null;
  if (mode === '' || mode === 'inherit') mode = null;
  if (mode !== null && !['parallel', 'em_only', 'sm_only'].includes(mode)) {
    return res.status(400).json({ ok: false, error: 'Invalid mode' });
  }
  try {
    await db.setClientAnalysisMode(clientId, mode);
    return res.json({ ok: true, analysis_mode: mode });
  } catch (e) {
    console.error('[clients/analysis-mode] failed:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// POST set/update the declared type + instinct for one assessment (EM Lab editor).
// Super-admin only, consistent with every other EM Lab route. Don't-Know wins server
// -side: the paired value is nulled regardless of what the client sent. Returns the
// re-rendered DECLARED and MATCH cell HTML (computed from the freshly-persisted roster
// row) so the Overview updates in place without a reload.
app.post('/admin/em-lab/declared/:assessment_id', requireSuperAdmin, async (req, res) => {
  const aid = parseInt(req.params.assessment_id, 10);
  if (!aid || isNaN(aid)) return res.status(400).json({ ok: false, error: 'Invalid assessment id' });
  const b = req.body || {};
  const typeDontKnow = !!b.type_dont_know;
  const instinctDontKnow = !!b.instinct_dont_know;

  let declaredType = typeDontKnow ? null : b.declared_type;
  if (declaredType != null) {
    declaredType = parseInt(declaredType, 10);
    if (!Number.isInteger(declaredType) || declaredType < 1 || declaredType > 9) {
      return res.status(400).json({ ok: false, error: 'Invalid type (expected 1–9)' });
    }
  }
  let declaredInstinct = instinctDontKnow ? null : (b.declared_instinct || null);
  if (declaredInstinct != null && !['SP', 'SO', 'SX'].includes(declaredInstinct)) {
    return res.status(400).json({ ok: false, error: 'Invalid instinct (expected SP/SO/SX)' });
  }

  try {
    await db.upsertDeclaration(aid, { declaredType, typeDontKnow, declaredInstinct, instinctDontKnow });
    const roster = await db.getEmLabRoster();
    const r = roster.find((row) => row.assessment_id === aid);
    if (!r) return res.json({ ok: true, declared_html: '', match_html: '' });
    const candidates = resolveEngineResults(r);
    return res.json({ ok: true, declared_html: _emDeclaredLabel(r), match_html: _emDeclaredMatch(r, candidates) });
  } catch (e) {
    console.error('[em-lab/declared] failed:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

function renderEmLabPage(req, data) {
  const roster = data.roster || [];
  const settings = data.settings || {};
  const log = data.log || [];

  // Effective global mode is the source of truth (R6) — derive UI from em_analysis_mode.
  const gMode = settings.em_analysis_mode || 'sm_only';
  const active = gMode !== 'sm_only';
  const selMode = gMode === 'em_only' ? 'em_only' : 'parallel';
  const gModel = settings.em_model || 'sonnet';
  const gVersion = settings.em_prompt_version || experimentalAnalysis.PROMPT_VERSION;

  // ── Cohort metrics (computed from roster; Sonnet is the auto-fire model) ──
  const withResult = roster.filter((r) => r.has_em_result);
  const declaredRows = roster.filter((r) => r.declared_type != null);
  // Type match rate: a row is eligible once it has a declaration and at least one
  // engine result (EM Opus, EM Sonnet, or SM); it counts as a hit if ANY of those
  // results matches the declared type (type dimension only).
  const typeMatchElig = roster.filter((r) => r.declared_type != null && resolveEngineResults(r).length > 0);
  const typeMatchHits = typeMatchElig.filter((r) =>
    resolveEngineResults(r).some((c) => Number(c.type) === Number(r.declared_type)));
  const agreeElig = roster.filter((r) => r.sm_type != null && r.em_type_sonnet != null);
  const agreeHits = agreeElig.filter((r) => Number(r.sm_type) === Number(r.em_type_sonnet));
  const pending = withResult.filter((r) => r.declared_type == null);
  const pct = (h, n) => (n ? Math.round((h / n) * 100) + '%' : '—');

  const cards = `
    <div class="em-card-grid">
      <div class="em-metric"><div class="em-metric-n">${roster.length}</div><div class="em-metric-l">Assessments run</div><div class="em-metric-sub">${withResult.length} with EM result</div></div>
      <div class="em-metric"><div class="em-metric-n">${pct(typeMatchHits.length, typeMatchElig.length)}</div><div class="em-metric-l">Type match rate</div><div class="em-metric-sub">Engine vs declared (${typeMatchElig.length})</div></div>
      <div class="em-metric"><div class="em-metric-n">${pct(agreeHits.length, agreeElig.length)}</div><div class="em-metric-l">SM vs EM agreement</div><div class="em-metric-sub">${agreeElig.length} comparable</div></div>
      <div class="em-metric"><div class="em-metric-n">${pending.length}</div><div class="em-metric-l">Declarations pending</div><div class="em-metric-sub">EM result, no declaration</div></div>
    </div>`;

  // ── Roster rows ──
  const rosterRows = roster.map((r) => {
    const name = ((r.first_name || '') + ' ' + (r.last_name || '')).trim() || '(unnamed)';
    const candidates = resolveEngineResults(r);
    const emSon = r.em_type_sonnet != null ? esc(_emSubtype(r.em_type_sonnet, r.em_instinct_sonnet)) : (r.latest_error ? '<span class="em-muted">failed</span>' : '—');
    const emOpu = r.em_type_opus != null ? esc(_emSubtype(r.em_type_opus, r.em_instinct_opus)) : '—';
    const aid = r.assessment_id;
    const decData = `data-aid="${aid}" data-type="${r.declared_type != null ? r.declared_type : ''}" data-tdk="${r.declared_type_dont_know ? 1 : 0}" data-inst="${r.declared_instinct != null ? esc(r.declared_instinct) : ''}" data-idk="${r.declared_instinct_dont_know ? 1 : 0}"`;
    return `<tr>
      <td><a href="#" class="em-name-link" onclick="emLoadDetail(${aid});return false;">${esc(name)}</a><div class="em-sub">${esc(r.email || '')}</div></td>
      <td>${esc(_emSubtype(r.sm_type, r.sm_instinct))}</td>
      <td>${emSon}</td>
      <td>${emOpu}</td>
      <td class="em-dec-cell" id="em-dec-${aid}" ${decData} onclick="emOpenDecl(this)" title="Click to edit declared type">${_emDeclaredLabel(r)}</td>
      <td id="em-match-${aid}">${_emDeclaredMatch(r, candidates)}</td>
      <td><button class="em-btn em-btn-sm" onclick="emLoadDetail(${aid})">View</button></td>
    </tr>`;
  }).join('');
  const rosterTable = roster.length
    ? `<table class="em-list"><thead><tr><th>Tester</th><th>SM</th><th>EM Sonnet</th><th>EM Opus</th><th>Declared</th><th>Match</th><th></th></tr></thead><tbody>${rosterRows}</tbody></table>`
    : `<p class="em-muted" style="padding:20px;">No EM runs yet. Complete an assessment in parallel mode, or run one from a client's profile.</p>`;

  // ── Reliability log rows ──
  const nameByClient = {};
  roster.forEach((r) => { nameByClient[r.client_id] = ((r.first_name || '') + ' ' + (r.last_name || '')).trim(); });
  const logRows = log.map((e) => {
    const emType = e.em_type_sonnet != null ? e.em_type_sonnet : e.em_type_opus;
    const emInst = e.em_instinct_sonnet != null ? e.em_instinct_sonnet : e.em_instinct_opus;
    const ms = e.match_status || 'Pending';
    return `<tr data-ms="${esc(ms)}" data-pv="${esc(e.prompt_version || '')}" data-mv="${esc(e.model_version || '')}">
      <td>#${e.assessment_id}</td>
      <td>${esc(nameByClient[e.client_id] || ('client #' + e.client_id))}</td>
      <td>${esc(_emFmtDate(e.ran_at))}</td>
      <td>${esc(_emSubtype(e.sm_type, e.sm_instinct))} ${e.sm_confidence ? '(' + esc(e.sm_confidence) + ')' : ''}</td>
      <td>${emType != null ? esc(_emSubtype(emType, emInst)) : (e.error_message ? '<span class="em-muted">failed</span>' : '—')}</td>
      <td>${e.declared_type != null ? esc(_emSubtype(e.declared_type, e.declared_instinct)) : '—'}</td>
      <td>${_emMatchBadge(ms)}</td>
      <td>${esc(e.model_version || '—')}</td>
      <td>${esc(e.prompt_version || '—')}</td>
      <td>${e.error_message ? '<span class="em-warn">' + esc(e.error_message) + '</span>' : '—'}</td>
    </tr>`;
  }).join('');
  const logTable = log.length
    ? `<table class="em-list em-log"><thead><tr><th>Assessment</th><th>Tester</th><th>Run</th><th>SM</th><th>EM</th><th>Declared</th><th>Match</th><th>Model</th><th>Prompt</th><th>Error</th></tr></thead><tbody>${logRows}</tbody></table>`
    : `<p class="em-muted" style="padding:20px;">No reliability-log rows yet.</p>`;

  // Distinct filter values from the log.
  const versions = Array.from(new Set(log.map((e) => e.prompt_version).filter(Boolean)));
  const models = Array.from(new Set(log.map((e) => e.model_version).filter(Boolean)));
  const verOpts = versions.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  const modelOpts = models.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('');

  // ── Mode Settings form ──
  const settingsForm = `
    <div class="em-form">
      <label class="em-toggle"><input type="checkbox" id="em-active" ${active ? 'checked' : ''}> <span>EM active</span></label>
      <p class="em-form-help">When off, EM never auto-fires (global mode forced to <code>sm_only</code>).</p>

      <div class="em-field"><label>Mode</label>
        <select id="em-mode">
          <option value="parallel" ${selMode === 'parallel' ? 'selected' : ''}>Parallel — SM report + EM stored alongside</option>
          <option value="em_only" ${selMode === 'em_only' ? 'selected' : ''}>EM only — EM runs in addition (SM still reports in alpha)</option>
        </select>
      </div>

      <div class="em-field"><label>Auto-fire model</label>
        <select id="em-model">
          <option value="opus" ${gModel === 'opus' ? 'selected' : ''}>Opus</option>
          <option value="sonnet" ${gModel === 'sonnet' ? 'selected' : ''}>Sonnet</option>
          <option value="sonnet_and_opus" ${gModel === 'sonnet_and_opus' ? 'selected' : ''}>Sonnet + Opus</option>
        </select>
        <p class="em-form-help">In parallel mode, auto-fire uses the selected model. Sonnet + Opus runs both on every assessment.</p>
      </div>

      <div class="em-field"><label>Prompt version</label>
        <select id="em-version"><option value="${esc(gVersion)}" selected>${esc(gVersion)}</option></select>
      </div>

      <div class="em-advisory">Mode changes apply to new assessments only. SM report generation is unaffected in all modes.</div>
      <button class="em-btn" onclick="emSaveSettings(this)">Save settings</button>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>EM Analysis Lab — Hive</title>
<style>
  body { margin:0; background:#F4F2EE; font-family:Georgia, serif; color:#1A2B33; }
  .top-bar { display:flex; justify-content:space-between; align-items:center; background:#1A2B33; padding:14px 24px; }
  .top-bar h1 { color:#00b1d7; font-size:18px; margin:0; font-weight:700; }
  .top-bar .eyebrow { color:#7A96A6; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; }
  .top-bar .nav-link { color:#7A96A6; font-size:12px; text-decoration:none; } .top-bar .nav-link:hover { color:#fff; }
  .top-bar .nav-sep { color:#3A4B55; font-size:12px; margin:0 8px; }
  .container { max-width:1080px; margin:24px auto; padding:0 20px; }
  .em-tabs { display:flex; gap:4px; border-bottom:1px solid #E2E6EA; margin-bottom:18px; }
  .em-tab-btn { background:none; border:none; border-bottom:3px solid transparent; font-family:Georgia, serif; font-size:14px; font-weight:700; color:#7A96A6; padding:10px 16px; cursor:pointer; }
  .em-tab-btn.active { color:#5C4080; border-bottom-color:#7B5EA7; }
  .em-panel { background:#fff; border:1px solid #E2E6EA; border-radius:8px; padding:18px; }
  .em-card-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:18px; }
  .em-metric { background:#F8F6FB; border:1px solid #E9E3F2; border-radius:8px; padding:14px 16px; }
  .em-metric-n { font-size:26px; font-weight:700; color:#5C4080; }
  .em-metric-l { font-size:13px; font-weight:700; color:#1A2B33; margin-top:2px; }
  .em-metric-sub { font-size:11px; color:#7A96A6; margin-top:2px; }
  table.em-list { width:100%; border-collapse:collapse; }
  table.em-list th { text-align:left; font-size:11px; color:#7A96A6; text-transform:uppercase; letter-spacing:0.05em; padding:9px 10px; border-bottom:1px solid #EFEAE3; }
  table.em-list td { padding:9px 10px; font-size:13px; border-bottom:1px solid #F2EEE9; vertical-align:top; }
  table.em-list tr:nth-child(even) td { background:#FAFAF8; }
  .em-name-link { color:#00859f; font-weight:700; text-decoration:none; } .em-name-link:hover { text-decoration:underline; }
  .em-sub { font-size:11px; color:#9FB0B9; }
  .em-ind { font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; white-space:nowrap; }
  .em-ind-match { background:#e6f7ee; color:#1a7a4a; } .em-ind-partial { background:#fef6e0; color:#9a6a00; }
  .em-ind-miss { background:#fdecea; color:#c0392b; } .em-ind-na { background:#f1f1ee; color:#7A8A92; }
  .em-ind-incomplete { background:#eef1f4; color:#5b6b78; }
  .em-badge-pend { background:#fef6e0; color:#9a6a00; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; }
  .em-badge-dk { background:#eef1f4; color:#5b6b78; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; }
  .em-dec-cell { cursor:pointer; } .em-dec-cell:hover { background:#F0F8FA !important; outline:1px solid #BFE3EC; outline-offset:-1px; }
  .em-modal-overlay { display:none; position:fixed; inset:0; background:rgba(26,43,51,0.45); z-index:1000; align-items:center; justify-content:center; }
  .em-modal-overlay.open { display:flex; }
  .em-modal { background:#fff; border-radius:10px; padding:22px 24px; width:340px; max-width:92vw; box-shadow:0 12px 40px rgba(0,0,0,0.25); font-family:Georgia, serif; }
  .em-modal h3 { margin:0 0 14px; font-size:16px; color:#1A2B33; }
  .em-modal-row { margin-bottom:14px; }
  .em-modal-row > label { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#7A96A6; margin-bottom:5px; }
  .em-modal select { width:100%; padding:7px 8px; font-family:Georgia, serif; font-size:13px; border:1px solid #C9D2D8; border-radius:5px; background:#fff; }
  .em-modal select:disabled { background:#F1F1EE; color:#9FB0B9; }
  .em-modal-dk { display:flex; align-items:center; gap:6px; margin-top:6px; font-size:12px; color:#1A2B33; font-style:normal; }
  .em-modal-dk input { margin:0; }
  .em-modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
  .em-btn:disabled { background:#C9D2D8; cursor:not-allowed; }
  .em-muted { color:#9FB0B9; font-style:italic; }
  .em-warn { color:#c0392b; }
  .em-btn { background:#00b1d7; color:#fff; border:none; border-radius:4px; font-family:Georgia, serif; font-size:13px; font-weight:700; padding:8px 14px; cursor:pointer; }
  .em-btn:hover { background:#009bbf; } .em-btn-ghost { background:#fff; color:#5C4080; border:1px solid #C9BEDF; }
  .em-btn-sm { padding:5px 10px; font-size:12px; }
  .em-3col { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:20px; }
  .em-col { border:1px solid #E2E6EA; border-radius:8px; padding:12px 14px; } .em-col-em { background:#F8F6FB; } .em-col-diff { border-color:#7B5EA7; box-shadow:0 0 0 1px #7B5EA7; }
  .em-col-h { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#7A96A6; margin-bottom:6px; }
  .em-col-type { font-size:15px; font-weight:700; color:#5C4080; margin-bottom:4px; }
  .em-col-meta { font-size:12px; color:#1A2B33; margin:2px 0; } .em-col-note { font-size:12px; color:#7A6A90; font-style:italic; margin:3px 0; }
  .em-section { margin-bottom:20px; } .em-h { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:#5C4080; margin:0 0 8px; padding-bottom:4px; border-bottom:1px solid #EFEAF6; } .em-h-flag { color:#c0392b; border-bottom-color:#f6d6d2; }
  table.em-tbl { width:100%; border-collapse:collapse; } table.em-tbl th { text-align:left; width:34%; font-size:12px; color:#7A96A6; font-weight:700; padding:6px 10px; border-bottom:1px solid #F2EEE9; vertical-align:top; } table.em-tbl td { padding:6px 10px; font-size:13px; border-bottom:1px solid #F2EEE9; }
  .em-bars { margin-top:6px; } .em-bar-row { display:grid; grid-template-columns:180px 1fr 1fr; gap:10px; align-items:center; margin-bottom:5px; }
  .em-bar-headrow .em-bar-h { font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:#7A96A6; } .em-bar-h-sm { color:#2b6fa6; } .em-bar-h-em { color:#1a7a4a; }
  .em-bar-lbl { font-size:12px; color:#1A2B33; } .em-bar-track { position:relative; background:#F1EFEA; border-radius:3px; height:16px; }
  .em-bar { height:16px; border-radius:3px; } .em-bar-sm { background:#5b9bd5; } .em-bar-em { background:#4caf7d; }
  .em-bar-val { position:absolute; right:5px; top:0; font-size:10px; line-height:16px; color:#33414a; }
  .em-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; } .em-card { border:1px solid #E2E6EA; border-radius:8px; padding:10px 12px; } .em-card-h { font-size:11px; text-transform:uppercase; color:#7A96A6; font-weight:700; } .em-card-type { font-size:14px; font-weight:700; color:#5C4080; margin:3px 0; } .em-card-note { font-size:11px; color:#7A96A6; }
  .em-obs { margin:0; padding:0; list-style:none; } .em-obs li { font-size:13px; line-height:1.5; margin-bottom:7px; }
  .em-obs-badge { font-size:10px; font-weight:700; padding:1px 6px; border-radius:3px; margin-right:7px; letter-spacing:0.04em; } .em-obs-confirm { background:#e6f7ee; color:#1a7a4a; } .em-obs-note { background:#eef1f4; color:#566; } .em-obs-flag { background:#fdecea; color:#c0392b; }
  .em-ct { background:#fdf3f2; border-left:3px solid #c0392b; padding:10px 14px; border-radius:4px; font-size:13px; }
  .em-reasoning { font-size:14px; line-height:1.6; white-space:pre-wrap; color:#1A2B33; }
  .em-detail-actions { display:flex; gap:10px; margin-top:8px; } .em-empty-detail { text-align:center; padding:40px 20px; }
  .em-form { max-width:560px; } .em-field { margin:14px 0; } .em-field label { display:block; font-size:12px; font-weight:700; color:#5C4080; margin-bottom:4px; }
  .em-field select { width:100%; padding:8px; border:1px solid #C9BEDF; border-radius:4px; font-family:Georgia, serif; font-size:13px; }
  .em-toggle { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:700; } .em-form-help { font-size:11px; color:#7A96A6; margin:3px 0 0; }
  .em-advisory { background:#F1ECF7; border:1px solid #E4DEEE; border-radius:6px; padding:10px 14px; font-size:12px; color:#5C4080; margin:16px 0; }
  .em-log-filters { display:flex; gap:10px; margin-bottom:12px; } .em-log-filters select { padding:6px; border:1px solid #D0DCE4; border-radius:4px; font-family:Georgia, serif; font-size:12px; }
  #em-toast { display:none; position:fixed; bottom:24px; right:24px; background:#1a7a4a; color:#fff; padding:12px 20px; border-radius:6px; font-size:13px; z-index:9500; box-shadow:0 2px 8px rgba(0,0,0,.18); }
</style></head>
<body>
<div class="top-bar">
  <div><div><span class="eyebrow">Hive Enneagram Type Tool</span></div><h1>EM Analysis Lab</h1></div>
  <div style="display:flex;align-items:center;gap:8px;">
    <a href="/admin" class="nav-link">← Dashboard</a><span class="nav-sep">|</span>
    <a href="/admin/beta-review" class="nav-link">Beta Review</a><span class="nav-sep">|</span>
    <a href="/admin/logout" class="nav-link">Sign out</a>
  </div>
</div>
<div class="container">
  <div class="em-tabs">
    <button class="em-tab-btn active" id="em-tab-btn-1" onclick="switchEmTab(1)">Overview</button>
    <button class="em-tab-btn" id="em-tab-btn-2" onclick="switchEmTab(2)">Assessment detail</button>
    <button class="em-tab-btn" id="em-tab-btn-3" onclick="switchEmTab(3)">Mode settings</button>
    <button class="em-tab-btn" id="em-tab-btn-4" onclick="switchEmTab(4)">Reliability log</button>
  </div>

  <div id="em-tab-1" class="em-panel">${cards}${rosterTable}</div>
  <div id="em-tab-2" class="em-panel" style="display:none;"><p class="em-muted">Select an assessment from the Overview roster to view its EM analysis.</p></div>
  <div id="em-tab-3" class="em-panel" style="display:none;">${settingsForm}</div>
  <div id="em-tab-4" class="em-panel" style="display:none;">
    <div class="em-log-filters">
      <select id="em-flt-ms" onchange="emFilterLog()"><option value="">All match</option><option>Exact</option><option>Type only</option><option>Instinct only</option><option>Mismatch</option><option>Pending</option></select>
      <select id="em-flt-pv" onchange="emFilterLog()"><option value="">All prompts</option>${verOpts}</select>
      <select id="em-flt-mv" onchange="emFilterLog()"><option value="">All models</option>${modelOpts}</select>
    </div>
    ${logTable}
  </div>
</div>
<div id="em-toast"></div>
<div id="em-decl-modal" class="em-modal-overlay" onclick="if(event.target===this)emCloseDecl()">
  <div class="em-modal">
    <h3>Declared Type</h3>
    <input type="hidden" id="em-decl-aid">
    <div class="em-modal-row">
      <label for="em-decl-type">Type</label>
      <select id="em-decl-type" onchange="emCheckSaveReady()">
        <option value="">— Select type —</option>
        ${[1,2,3,4,5,6,7,8,9].map((n) => '<option value="' + n + '">' + esc(_emTypeLabel(n)) + '</option>').join('')}
      </select>
      <label class="em-modal-dk"><input type="checkbox" id="em-decl-tdk" onchange="emDkToggle('type')"> Don't Know</label>
    </div>
    <div class="em-modal-row">
      <label for="em-decl-inst">Instinct</label>
      <select id="em-decl-inst" onchange="emCheckSaveReady()">
        <option value="">— Select instinct —</option>
        <option value="SP">SP — Self-Preservation</option>
        <option value="SO">SO — Social</option>
        <option value="SX">SX — Sexual / One-to-One</option>
      </select>
      <label class="em-modal-dk"><input type="checkbox" id="em-decl-idk" onchange="emDkToggle('inst')"> Don't Know</label>
    </div>
    <div class="em-modal-actions">
      <button class="em-btn em-btn-ghost" onclick="emCloseDecl()">Cancel</button>
      <button class="em-btn" id="em-decl-save" onclick="emSaveDecl()" disabled>Save</button>
    </div>
  </div>
</div>
<script>
function _emToast(m){ var t=document.getElementById('em-toast'); t.textContent=m; t.style.display='block'; setTimeout(function(){t.style.display='none';},2600); }
var _emDeclCell=null;
function emOpenDecl(cell){
  _emDeclCell=cell;
  var typeSel=document.getElementById('em-decl-type'), instSel=document.getElementById('em-decl-inst');
  var tdk=document.getElementById('em-decl-tdk'), idk=document.getElementById('em-decl-idk');
  document.getElementById('em-decl-aid').value=cell.getAttribute('data-aid');
  typeSel.value=cell.getAttribute('data-type')||'';
  instSel.value=cell.getAttribute('data-inst')||'';
  tdk.checked=cell.getAttribute('data-tdk')==='1';
  idk.checked=cell.getAttribute('data-idk')==='1';
  emDkToggle('type'); emDkToggle('inst');   // sync disabled state (also runs emCheckSaveReady)
  document.getElementById('em-decl-modal').classList.add('open');
}
function emDkToggle(which){
  var sel=document.getElementById(which==='type'?'em-decl-type':'em-decl-inst');
  var dk=document.getElementById(which==='type'?'em-decl-tdk':'em-decl-idk');
  sel.disabled=dk.checked;
  if(dk.checked) sel.value='';
  emCheckSaveReady();
}
function emCheckSaveReady(){
  var typeOk=document.getElementById('em-decl-type').value!=='' || document.getElementById('em-decl-tdk').checked;
  var instOk=document.getElementById('em-decl-inst').value!=='' || document.getElementById('em-decl-idk').checked;
  document.getElementById('em-decl-save').disabled=!(typeOk && instOk);
}
function emCloseDecl(){
  document.getElementById('em-decl-modal').classList.remove('open');
  _emDeclCell=null;
}
async function emSaveDecl(){
  var aid=document.getElementById('em-decl-aid').value;
  var tdk=document.getElementById('em-decl-tdk').checked, idk=document.getElementById('em-decl-idk').checked;
  var typeVal=document.getElementById('em-decl-type').value;
  var instVal=document.getElementById('em-decl-inst').value;
  var payload={
    declared_type: tdk ? null : (typeVal!=='' ? parseInt(typeVal,10) : null),
    type_dont_know: tdk,
    declared_instinct: idk ? null : (instVal!=='' ? instVal : null),
    instinct_dont_know: idk
  };
  var saveBtn=document.getElementById('em-decl-save');
  saveBtn.disabled=true; saveBtn.textContent='Saving…';
  try{
    var r=await fetch('/admin/em-lab/declared/'+aid,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});
    var d=await r.json();
    if(!d.ok){ _emToast('Save failed: '+(d.error||'error')); saveBtn.disabled=false; saveBtn.textContent='Save'; return; }
    var decCell=document.getElementById('em-dec-'+aid), matchCell=document.getElementById('em-match-'+aid);
    if(decCell){
      decCell.innerHTML=d.declared_html;
      decCell.setAttribute('data-type', payload.declared_type!=null ? payload.declared_type : '');
      decCell.setAttribute('data-tdk', tdk ? 1 : 0);
      decCell.setAttribute('data-inst', payload.declared_instinct!=null ? payload.declared_instinct : '');
      decCell.setAttribute('data-idk', idk ? 1 : 0);
    }
    if(matchCell) matchCell.innerHTML=d.match_html;
    saveBtn.textContent='Save';
    emCloseDecl();
    _emToast('Declared type saved');
  }catch(e){ _emToast('Save error: '+e.message); saveBtn.disabled=false; saveBtn.textContent='Save'; }
}
function switchEmTab(n){
  for (var i=1;i<=4;i++){
    document.getElementById('em-tab-btn-'+i).classList.toggle('active', i===n);
    document.getElementById('em-tab-'+i).style.display = (i===n)?'block':'none';
  }
}
async function emLoadDetail(aid){
  switchEmTab(2);
  var panel=document.getElementById('em-tab-2');
  panel.innerHTML='<p class="em-muted">Loading…</p>';
  try{
    var r=await fetch('/admin/em-lab/assessment/'+aid,{headers:{Accept:'application/json'}});
    var d=await r.json();
    if(!d.available){ panel.innerHTML='<p class="em-muted">'+(d.error||'Unavailable.')+'</p>'; return; }
    panel.innerHTML=d.html;
  }catch(e){ panel.innerHTML='<p class="em-warn">Failed to load: '+e.message+'</p>'; }
}
async function emRun(aid, model, btn){
  if(btn){ btn.disabled=true; btn.textContent='Running '+model+'…'; }
  try{
    var r=await fetch('/admin/experiment/raw-analysis/'+aid,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({model:model})});
    var d=await r.json();
    if(!d.ok){ _emToast('Run failed: '+(d.error||'error')); if(btn){btn.disabled=false;btn.textContent='Retry';} return; }
    _emToast('EM run complete ('+model+')');
    emLoadDetail(aid);
  }catch(e){ _emToast('Run error: '+e.message); if(btn){btn.disabled=false;btn.textContent='Retry';} }
}
async function emReport(aid, btn){
  if(btn){ btn.disabled=true; btn.textContent='Running report…'; }
  try{
    var r=await fetch('/admin/em-lab/report/'+aid,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'}});
    var d=await r.json();
    if(!d.ok){ _emToast('Report run failed: '+(d.error||'error')); if(btn){btn.disabled=false;btn.textContent='Retry Report';} return; }
    _emToast(d.pdf_generated ? 'EM report re-run complete — re-run PDFs generated (production untouched)' : 'EM report re-run complete — stored, but PDF generation failed (see logs)');
    emLoadDetail(aid);
  }catch(e){ _emToast('Report run error: '+e.message); if(btn){btn.disabled=false;btn.textContent='Retry Report';} }
}
async function emSaveSettings(btn){
  var payload={
    em_active: document.getElementById('em-active').checked,
    em_analysis_mode: document.getElementById('em-mode').value,
    em_model: document.getElementById('em-model').value,
    em_prompt_version: document.getElementById('em-version').value
  };
  if(btn){ btn.disabled=true; btn.textContent='Saving…'; }
  try{
    var r=await fetch('/admin/em-lab/mode-settings',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});
    var d=await r.json();
    if(d.ok){ _emToast('Settings saved (mode: '+d.settings.em_analysis_mode+')'); } else { _emToast('Save failed'); }
  }catch(e){ _emToast('Save error: '+e.message); }
  if(btn){ btn.disabled=false; btn.textContent='Save settings'; }
}
function emFilterLog(){
  var ms=document.getElementById('em-flt-ms').value, pv=document.getElementById('em-flt-pv').value, mv=document.getElementById('em-flt-mv').value;
  var rows=document.querySelectorAll('table.em-log tbody tr');
  for(var i=0;i<rows.length;i++){
    var row=rows[i];
    var ok=(!ms||row.getAttribute('data-ms')===ms)&&(!pv||row.getAttribute('data-pv')===pv)&&(!mv||row.getAttribute('data-mv')===mv);
    row.style.display=ok?'':'none';
  }
}
</script>
</body></html>`;
}

// Render the stored beta_analysis row (or the empty state) for the analysis panel.
// Shared by the page load (GET) and the Re-analyze refresh (POST).
function renderBetaAnalysisHtml(analysis) {
  const head = (stamp) => `<div class="ba-head"><h2>Cross-tester analysis</h2><span class="ba-stamp">${stamp}</span></div>`;
  if (!analysis || !analysis.analysis_json) {
    return head('Not yet analyzed') + `<div class="ba-empty">No analysis yet. Click <strong>Re-analyze</strong> to synthesize feedback across all testers.</div>`;
  }
  const a = typeof analysis.analysis_json === 'string' ? JSON.parse(analysis.analysis_json) : analysis.analysis_json;
  let stampStr = 'Last analyzed: unknown';
  try {
    const dt = new Date(analysis.generated_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    stampStr = `Last analyzed: ${dt} · ${esc(analysis.model || '')} · ${analysis.respondent_count || 0} respondents`;
  } catch (_) {}

  // (1) Flagged frequency
  const freq = a.flagged_frequency || [];
  const freqHtml = freq.length ? `<table class="ba-tbl">
    <thead><tr><th>Statement</th><th>Stage</th><th style="text-align:center;">Flags</th><th>Synthesized comment</th></tr></thead>
    <tbody>${freq.map((f) => `<tr>
      <td>${esc(f.questionText || f.key)}</td>
      <td>${esc(f.stageLabel || '')}</td>
      <td class="ba-count">${esc(String(f.count))}</td>
      <td class="ba-narr">${f.synthesized_comment ? esc(f.synthesized_comment) : '<span class="ba-muted">—</span>'}</td>
    </tr>`).join('')}</tbody></table>` : `<p class="ba-muted">No questions were flagged across testers.</p>`;

  // (2) Likert
  const lk = a.likert || {};
  const lkLabels = { clarity: 'Clarity of questions', ease: 'Ease of answering', length: 'Length & pacing', navigation: 'Navigation and way-finding', overall: 'Overall experience' };
  const lkHtml = `<table class="ba-tbl">
    <thead><tr><th>Dimension</th><th style="text-align:center;">Avg</th><th>Interpretation</th></tr></thead>
    <tbody>${Object.keys(lkLabels).map((d) => {
      const row = lk[d] || {};
      const avg = (row.avg == null) ? '—' : `${row.avg} / 5`;
      return `<tr><td>${esc(lkLabels[d])}</td><td class="ba-avg">${esc(avg)}</td><td class="ba-narr">${row.narrative ? esc(row.narrative) : '<span class="ba-muted">—</span>'}</td></tr>`;
    }).join('')}</tbody></table>`;

  // (3) Subtype accuracy
  const sa = a.subtype_accuracy || {};
  const saClusters = (sa.clusters || []).map((c) => `<li><strong>${esc(c.pattern || '')}</strong> — ${esc(c.detail || '')}</li>`).join('');
  const saHtml = `${sa.summary ? `<p class="ba-summary">${esc(sa.summary)}</p>` : ''}${saClusters ? `<ul class="ba-list">${saClusters}</ul>` : (sa.summary ? '' : '<p class="ba-muted">—</p>')}`;

  // (4) Block C themes
  const bc = a.block_c_themes || {};
  const bcThemes = (bc.themes || []).map((t) => `<li>${esc(t)}</li>`).join('');
  const bcHtml = `${bc.summary ? `<p class="ba-summary">${esc(bc.summary)}</p>` : ''}${bcThemes ? `<ul class="ba-list">${bcThemes}</ul>` : (bc.summary ? '' : '<p class="ba-muted">—</p>')}`;

  // (5) Recommended actions
  const acts = a.recommended_actions || [];
  const actsHtml = acts.length ? `<ul class="ba-list ba-actions">${acts.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="ba-muted">—</p>';

  return head(stampStr) + `<div class="ba-body">
    <div class="ba-section"><div class="ba-h">Flagged statement frequency</div>${freqHtml}</div>
    <div class="ba-section"><div class="ba-h">Experience ratings</div>${lkHtml}</div>
    <div class="ba-section"><div class="ba-h">Subtype accuracy pattern</div>${saHtml}</div>
    <div class="ba-section"><div class="ba-h">Open-comment themes</div>${bcHtml}</div>
    <div class="ba-section"><div class="ba-h">Recommended actions</div>${actsHtml}</div>
  </div>`;
}

function renderBetaReviewPage(req, respondents, analysis) {
  // Clear Analysis is only meaningful when a stored synthesis exists.
  const hasAnalysis = !!(analysis && analysis.analysis_json);
  const fmtDate = (ts) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (_) { return '—'; }
  };
  const rowsHtml = (respondents || []).map((r) => {
    const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || '(unnamed)';
    const submitted = !!r.submitted_at;
    const engineType = r.confirmed_type ? `Type ${r.confirmed_type}` : '—';
    const inst = r.dominant_instinct_hypothesis || r.confirmed_instinct;
    const subtype = (inst && r.confirmed_type) ? `${inst} ${r.confirmed_type}` : '—';
    const statusBadge = submitted
      ? `<span class="br-badge br-badge-sub">Submitted</span>`
      : `<span class="br-badge br-badge-pend">Pending</span>`;
    const newBadge = submitted
      ? `<span class="br-new-badge" data-aid="${r.assessment_id}" style="display:none">New</span>`
      : '';
    const nameCell = submitted
      ? `<a href="#" class="br-name-link" onclick="openBetaTester(${r.client_id});return false;">${esc(name)}</a>${newBadge}`
      : `<span class="br-name-pending">${esc(name)}</span>`;
    const checkCell = submitted
      ? `<input type="checkbox" class="br-check" value="${r.assessment_id}" onchange="brOnCheck()">`
      : `<input type="checkbox" disabled class="br-check-disabled">`;
    return `<tr>
      <td class="br-check-cell">${checkCell}</td>
      <td style="padding:10px 12px;">${nameCell}</td>
      <td style="padding:10px 12px;">${esc(engineType)}</td>
      <td style="padding:10px 12px;">${esc(subtype)}</td>
      <td style="padding:10px 12px;">${esc(fmtDate(r.submitted_at))}</td>
      <td style="padding:10px 12px;">${statusBadge}</td>
    </tr>`;
  }).join('');

  const emptyState = (respondents && respondents.length)
    ? ''
    : `<p style="padding:24px;color:#7A96A6;">No beta testers yet. Toggle “Beta Tester” on a client’s profile to add one.</p>`;

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Beta Review — Hive</title>
<style>
  body { margin: 0; background: #F4F2EE; font-family: Georgia, serif; color: #1A2B33; }
  .top-bar { display: flex; justify-content: space-between; align-items: center; background: #1A2B33; padding: 14px 24px; }
  .top-bar h1 { color: #00b1d7; font-size: 18px; margin: 0; font-weight: 700; }
  .top-bar span.eyebrow { color: #7A96A6; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
  .top-bar .nav-link { color: #7A96A6; font-size: 12px; text-decoration: none; font-family: Georgia, serif; }
  .top-bar .nav-link:hover { color: #fff; }
  .top-bar .nav-sep { color: #3A4B55; font-size: 12px; margin: 0 8px; }
  .container { max-width: 980px; margin: 28px auto; padding: 0 20px; }
  .panel { background: #fff; border: 1px solid #E2E6EA; border-radius: 8px; overflow: hidden; }
  .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-bottom: 1px solid #EFEAE3; }
  .panel-head h2 { font-size: 16px; margin: 0; }
  table.br-list { width: 100%; border-collapse: collapse; }
  table.br-list th { text-align: left; font-size: 11px; color: #7A96A6; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 12px; border-bottom: 1px solid #EFEAE3; }
  table.br-list tr:nth-child(even) td { background: #FAFAF8; }
  .br-name-link { color: #00859f; text-decoration: none; font-weight: 700; }
  .br-name-link:hover { text-decoration: underline; }
  .br-name-pending { color: #7A96A6; }
  .br-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 3px; letter-spacing: 0.04em; }
  .br-badge-sub { background: #e6f7ee; color: #1a7a4a; }
  .br-badge-pend { background: #fef6e0; color: #9a6a00; }
  .br-check-cell { width: 36px; text-align: center; padding: 10px 8px; }
  .br-check, #brSelectAll { cursor: pointer; }
  .br-check-disabled { opacity: 0.35; cursor: not-allowed; }
  .br-new-badge { display: inline-block; margin-left: 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: #F68625; color: #fff; padding: 2px 7px; border-radius: 3px; vertical-align: middle; }
  .btn-reanalyze:disabled { background: #B7C4CB; cursor: not-allowed; }
  .btn-reanalyze { background: #00b1d7; color: #fff; border: none; border-radius: 4px; font-family: Georgia, serif; font-size: 13px; font-weight: 700; padding: 9px 16px; cursor: pointer; }
  .btn-reanalyze:hover { background: #009bbf; }
  .btn-clear-analysis { background: #fff; color: #7A96A6; border: 1px solid #D0DCE4; border-radius: 4px; font-family: Georgia, serif; font-size: 13px; font-weight: 700; padding: 9px 16px; cursor: pointer; }
  .btn-clear-analysis:hover { background: #f4f4f4; color: #5A7280; }
  /* Modal */
  .br-overlay { display: none; position: fixed; inset: 0; background: rgba(26,43,51,0.55); z-index: 9000; align-items: flex-start; justify-content: center; padding: 36px 16px; overflow-y: auto; }
  .br-modal { background: #fff; width: 100%; max-width: 720px; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,.2); }
  .br-modal-head { border-top: 4px solid #7B5EA7; padding: 18px 22px 0; }
  .br-modal-title { font-size: 19px; font-weight: 700; margin: 0 0 12px; }
  .br-tabs { display: flex; gap: 4px; border-bottom: 1px solid #EFEAE3; }
  .br-tab-btn { background: none; border: none; border-bottom: 3px solid transparent; font-family: Georgia, serif; font-size: 13px; font-weight: 700; color: #7A96A6; padding: 10px 14px; cursor: pointer; }
  .br-tab-btn.active { color: #5C4080; border-bottom-color: #7B5EA7; }
  .br-tab-body { padding: 18px 22px 24px; max-height: 70vh; overflow-y: auto; }
  .br-tab-section { margin-bottom: 20px; }
  .br-tab-h { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #5C4080; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid #EFEAF6; }
  table.br-cmp, table.br-likert-tbl { width: 100%; border-collapse: collapse; }
  table.br-cmp td { border-bottom: 1px solid #F2EEE9; vertical-align: top; }
  .br-ind { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
  .br-ind-match { background: #e6f7ee; color: #1a7a4a; }
  .br-ind-partial { background: #fef6e0; color: #9a6a00; }
  .br-ind-miss { background: #fdecea; color: #c0392b; }
  .br-ind-na { background: #f1f1ee; color: #7A8A92; }
  .br-flag-row { padding: 10px 0; border-bottom: 1px solid #F2EEE9; }
  .br-flag-q { font-size: 14px; color: #1A2B33; }
  .br-flag-meta { font-size: 11px; color: #9FB0B9; margin: 2px 0 6px; font-family: Menlo, monospace; }
  .br-flag-comment { font-size: 13px; color: #4A6070; background: #FAF7FC; border-left: 3px solid #7B5EA7; padding: 8px 12px; border-radius: 4px; white-space: pre-wrap; }
  .br-flag-reconsidered { font-size: 12px; color: #7A96A6; font-style: italic; }
  .br-notes { font-size: 14px; color: #1A2B33; background: #FAF7FC; border-left: 3px solid #7B5EA7; padding: 10px 14px; border-radius: 4px; white-space: pre-wrap; }
  .br-muted { color: #9FB0B9; font-style: italic; }
  .br-engine-header { position: sticky; top: 0; background: #F1ECF7; border: 1px solid #E4DEEE; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; z-index: 2; }
  .br-eh-type { font-size: 15px; font-weight: 700; color: #5C4080; display: block; }
  .br-eh-meta { font-size: 12px; color: #7A6A90; }
  .br-modal-foot { display: flex; justify-content: flex-end; padding: 0 22px 22px; }
  .br-close { background: #fff; color: #7A96A6; border: 1px solid #D0DCE4; border-radius: 4px; font-family: Georgia, serif; font-size: 13px; padding: 9px 18px; cursor: pointer; }
  #br-toast { display: none; position: fixed; bottom: 24px; right: 24px; background: #1a7a4a; color: #fff; padding: 12px 20px; border-radius: 6px; font-size: 13px; z-index: 9500; box-shadow: 0 2px 8px rgba(0,0,0,.18); }
  /* Analysis panel */
  .ba-head { display: flex; justify-content: space-between; align-items: baseline; padding: 16px 18px; border-bottom: 1px solid #EFEAE3; }
  .ba-head h2 { font-size: 16px; margin: 0; }
  .ba-stamp { font-size: 12px; color: #7A96A6; }
  .ba-body { padding: 4px 18px 18px; }
  .ba-empty { padding: 24px 18px; color: #7A96A6; }
  .ba-section { margin-top: 18px; }
  .ba-h { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #5C4080; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid #EFEAF6; }
  table.ba-tbl { width: 100%; border-collapse: collapse; }
  table.ba-tbl th { text-align: left; font-size: 11px; color: #7A96A6; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 10px; border-bottom: 1px solid #EFEAE3; }
  table.ba-tbl td { padding: 7px 10px; font-size: 13px; color: #1A2B33; border-bottom: 1px solid #F2EEE9; vertical-align: top; }
  .ba-count { font-weight: 700; color: #00859f; text-align: center; }
  .ba-avg { font-weight: 700; color: #00859f; text-align: center; width: 60px; }
  .ba-narr { color: #4A6070; }
  .ba-list { margin: 0; padding-left: 20px; }
  .ba-list li { font-size: 14px; color: #1A2B33; margin-bottom: 6px; line-height: 1.5; }
  .ba-actions li { font-weight: 700; }
  .ba-summary { font-size: 14px; color: #1A2B33; margin: 0 0 8px; line-height: 1.55; }
  .ba-muted { color: #9FB0B9; font-style: italic; }
</style></head>
<body>
<div class="top-bar">
  <div><div><span class="eyebrow">Hive Enneagram Type Tool</span></div><h1>Beta Review</h1></div>
  <div style="display:flex;align-items:center;gap:8px;">
    <a href="/admin" class="nav-link">← Dashboard</a><span class="nav-sep">|</span>
    <a href="/admin/logout" class="nav-link">Sign out</a>
  </div>
</div>
<div class="container">
  <div class="panel">
    <div class="panel-head">
      <h2>Beta testers</h2>
      <div style="display:flex;align-items:center;gap:8px;">
        <button id="btn-clear-analysis" class="btn-clear-analysis" onclick="clearBetaAnalysis(this)" style="display:${hasAnalysis ? 'inline-block' : 'none'};">Clear Analysis</button>
        <button id="btn-reanalyze" class="btn-reanalyze" onclick="reanalyzeBeta(this)" disabled>Re-analyze</button>
      </div>
    </div>
    ${(respondents && respondents.length) ? `<table class="br-list">
      <thead><tr><th class="br-check-cell"><input type="checkbox" id="brSelectAll" onchange="brToggleSelectAll(this)"></th><th>Tester</th><th>Engine type</th><th>Subtype</th><th>Feedback date</th><th>Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>` : emptyState}
  </div>
  <div class="panel" id="br-analysis-panel" style="margin-top:24px;">${renderBetaAnalysisHtml(analysis)}</div>
</div>

<div id="br-overlay" class="br-overlay" onclick="if(event.target===this)closeBetaTester()">
  <div class="br-modal">
    <div class="br-modal-head">
      <h2 class="br-modal-title" id="br-modal-title">Tester</h2>
      <div class="br-tabs">
        <button class="br-tab-btn active" id="br-tab-btn-1" onclick="switchBetaTab(1)">Self vs. Engine</button>
        <button class="br-tab-btn" id="br-tab-btn-2" onclick="switchBetaTab(2)">Assessment Walkthrough</button>
      </div>
    </div>
    <div class="br-tab-body">
      <div id="br-tab-1"></div>
      <div id="br-tab-2" style="display:none;"></div>
    </div>
    <div class="br-modal-foot"><button class="br-close" onclick="closeBetaTester()">Close</button></div>
  </div>
</div>
<div id="br-toast"></div>

<script>
function _brToast(msg){ var t=document.getElementById('br-toast'); t.textContent=msg; t.style.display='block'; setTimeout(function(){t.style.display='none';},2600); }
function switchBetaTab(n){
  document.getElementById('br-tab-btn-1').classList.toggle('active', n===1);
  document.getElementById('br-tab-btn-2').classList.toggle('active', n===2);
  document.getElementById('br-tab-1').style.display = n===1 ? 'block' : 'none';
  document.getElementById('br-tab-2').style.display = n===2 ? 'block' : 'none';
}
function closeBetaTester(){ document.getElementById('br-overlay').style.display='none'; }
async function openBetaTester(clientId){
  var t1=document.getElementById('br-tab-1'), t2=document.getElementById('br-tab-2');
  t1.innerHTML='<p class="br-muted">Loading…</p>'; t2.innerHTML='';
  switchBetaTab(1);
  document.getElementById('br-overlay').style.display='flex';
  try{
    var r=await fetch('/admin/beta-review/tester/'+clientId,{headers:{Accept:'application/json'}});
    var d=await r.json();
    if(!d.available){ t1.innerHTML='<p class="br-muted">'+(d.reason||'Unavailable.')+'</p>'; document.getElementById('br-modal-title').textContent='Tester'; return; }
    document.getElementById('br-modal-title').textContent=d.testerName||'Tester';
    t1.innerHTML=d.tab1Html||'<p class="br-muted">No data.</p>';
    t2.innerHTML=d.tab2Html||'<p class="br-muted">Stage-by-stage walkthrough is unavailable for this record (assessment still processing or snapshots missing).</p>';
  }catch(e){ t1.innerHTML='<p class="br-muted">Failed to load tester detail.</p>'; }
}
function _brCheckedBoxes(){ return Array.prototype.slice.call(document.querySelectorAll('.br-check')).filter(function(c){return c.checked;}); }
function _brCheckedIds(){ return _brCheckedBoxes().map(function(c){return parseInt(c.value,10);}).filter(function(n){return !isNaN(n);}); }
async function reanalyzeBeta(btn){
  var assessmentIds=_brCheckedIds();
  var orig=btn.textContent; btn.disabled=true; btn.textContent='Analyzing…';
  try{
    var r=await fetch('/admin/beta-review/analyze',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({assessmentIds:assessmentIds})});
    var d=await r.json();
    if(d.ok && d.analysisHtml){
      var panel=document.getElementById('br-analysis-panel');
      if(panel) panel.innerHTML=d.analysisHtml;
      var clearBtn=document.getElementById('btn-clear-analysis');
      if(clearBtn) clearBtn.style.display='inline-block';
      // Included testers are no longer "new": clear their badges and fold them into
      // the stored selection.
      _brCheckedBoxes().forEach(function(c){
        var badge=document.querySelector('.br-new-badge[data-aid="'+c.value+'"]');
        if(badge) badge.style.display='none';
      });
      brPersistSelection();
      _brToast('Analysis complete.');
    } else {
      _brToast(d.error || 'Analysis failed.');
    }
  }catch(e){ _brToast('Request failed.'); }
  btn.textContent=orig;
  brUpdateReanalyzeState(); // re-derive disabled from selection, not unconditional enable
}
var BR_LS_KEY='hive.betaReview.selectedAssessmentIds';
function brToggleSelectAll(el){
  Array.prototype.slice.call(document.querySelectorAll('.br-check')).forEach(function(c){ c.checked=el.checked; });
  brOnCheck();
}
function brOnCheck(){ brUpdateReanalyzeState(); brPersistSelection(); }
function brUpdateReanalyzeState(){
  var boxes=Array.prototype.slice.call(document.querySelectorAll('.br-check'));
  var checked=boxes.filter(function(c){return c.checked;}).length;
  var btn=document.getElementById('btn-reanalyze');
  if(btn) btn.disabled=(checked===0);
  var all=document.getElementById('brSelectAll');
  if(all){
    all.checked=(boxes.length>0 && checked===boxes.length);
    all.indeterminate=(checked>0 && checked<boxes.length);
  }
}
function brPersistSelection(){
  try{ localStorage.setItem(BR_LS_KEY, JSON.stringify(_brCheckedIds())); }catch(e){}
}
function brRestoreSelection(){
  var boxes=Array.prototype.slice.call(document.querySelectorAll('.br-check'));
  if(!boxes.length){ brUpdateReanalyzeState(); return; } // empty roster — no-op gracefully
  var submittedIds=boxes.map(function(c){return parseInt(c.value,10);});
  var stored=null;
  try{ stored=JSON.parse(localStorage.getItem(BR_LS_KEY)); }catch(e){ stored=null; }
  var hideAllBadges=function(){ Array.prototype.slice.call(document.querySelectorAll('.br-new-badge')).forEach(function(b){b.style.display='none';}); };
  // Steps 1+3: invalid/parse-fail or empty intersection → all submitted checked, no New flags.
  if(!Array.isArray(stored)){
    boxes.forEach(function(c){c.checked=true;}); hideAllBadges(); brUpdateReanalyzeState(); return;
  }
  var storedInts=stored.map(Number).filter(Number.isInteger);
  var intersection=submittedIds.filter(function(id){return storedInts.indexOf(id)>=0;});
  if(!intersection.length){
    boxes.forEach(function(c){c.checked=true;}); hideAllBadges(); brUpdateReanalyzeState(); return;
  }
  // Step 4: check exactly the intersection; submitted IDs not in it get unchecked + New badge.
  boxes.forEach(function(c){
    var id=parseInt(c.value,10);
    var inSel=intersection.indexOf(id)>=0;
    c.checked=inSel;
    var badge=document.querySelector('.br-new-badge[data-aid="'+c.value+'"]');
    if(badge) badge.style.display=inSel?'none':'inline-block';
  });
  brUpdateReanalyzeState(); // step 5
}
document.addEventListener('DOMContentLoaded', brRestoreSelection);
async function clearBetaAnalysis(btn){
  if(!confirm('Clear the stored analysis? This cannot be undone.')) return;
  btn.disabled=true;
  try{
    var r=await fetch('/admin/beta-review/clear-analysis',{method:'POST',headers:{Accept:'application/json'}});
    var d=await r.json();
    if(d.ok){ location.reload(); }
    else { _brToast(d.error || 'Clear failed.'); btn.disabled=false; }
  }catch(e){ _brToast('Request failed.'); btn.disabled=false; }
}
</script>
</body></html>`;
}

app.post('/admin/content/draft', requireSuperAdmin, async (req, res) => {
  const { content_key, value } = req.body || {};
  if (!cmsIsValidContentKey(content_key)) return res.status(400).json({ ok: false, error: 'invalid content_key' });
  if (value === undefined) return res.status(400).json({ ok: false, error: 'missing value' });
  const ok = await contentOverrides.saveDraftOverride(content_key, value, cmsWordCount(value), req.session.coach_id);
  res.json({ ok, error: ok ? undefined : 'database unavailable' });
});

app.post('/admin/content/publish', requireSuperAdmin, async (req, res) => {
  const { content_key, value } = req.body || {};
  if (!cmsIsValidContentKey(content_key)) return res.status(400).json({ ok: false, error: 'invalid content_key' });
  if (value === undefined) return res.status(400).json({ ok: false, error: 'missing value' });
  const ok = await contentOverrides.publishOverride(content_key, value, cmsWordCount(value), req.session.coach_id);
  res.json({ ok, error: ok ? undefined : 'database unavailable' });
});

app.post('/admin/content/revert', requireSuperAdmin, async (req, res) => {
  const { content_key } = req.body || {};
  if (!cmsIsValidContentKey(content_key)) return res.status(400).json({ ok: false, error: 'invalid content_key' });
  const ok = await contentOverrides.revertOverride(content_key);
  res.json({ ok, error: ok ? undefined : 'database unavailable' });
});

// =================== /admin/content — SINGLE-PAGE PNG PREVIEW (PR 4b) ===================
// Renders one client-report PDF page as a PNG so a super-admin sees a draft edit in context
// before publishing. The draft value is injected onto a synthetic model (never the DB), the
// full client report is rendered, and only the target page element is screenshotted.

// Worst-case "In Your Responses" evidence (3 bullets ~25 words each) injected on P6 previews
// so the orange box is shown at maximum size — exposing overflow risk, not a best case.
const CMS_PREVIEW_WORST_EVIDENCE = [
  'Across several of your responses you returned to maintaining comfort, protecting your energy, and keeping daily life steady and predictable, which is the clearest available signal here.',
  'You repeatedly described scanning your environment for what could go wrong and quietly securing resources ahead of time, a pattern that points strongly toward this instinctual focus showing up.',
  'When asked about stress you emphasized withdrawing to conserve, tending to practical needs first, and restoring your baseline before re-engaging with the people and demands around you again.',
];

// splitWingBest / wing+line remap mirror report_prep (kept in sync manually; report_prep is
// out of scope for this PR). Used only to overlay draft type_*.wings / type_*.lines values,
// which report_prep transforms into wing_low/wing_high and line_stress/line_security.
function cmsPreviewSplitWingBest(text) {
  const s = String(text || '');
  const m = s.match(/\n+\s*At their best:\s*/i);
  if (!m) return { body: s.trim(), best: '' };
  return { body: s.slice(0, m.index).trim(), best: s.slice(m.index + m[0].length).trim() };
}

// content_key -> { page (label), selector (page wrapper class), type N, instinct, apply(model,value) }.
// apply() overlays the draft onto the already-built model at the same path report_prep populates.
function cmsPreviewSpec(key) {
  const P6 = 'P6 — Instinct & Subtype', P5 = 'P5 — Wings & Lines';
  const STATIC = {
    'static.welcome':              { page: 'P1 — Welcome',            selector: '.cover-welcome', apply: (m, v) => { Object.assign(m.pages.welcome, v); } },
    'static.primer':               { page: 'P2 — Enneagram Primer',   selector: '.page',          apply: (m, v) => { m.pages.primer = v; } },
    'static.wings_primer':         { page: P5,                        selector: '.p5-page',       apply: (m, v) => { m.pages.wings_lines.wings_primer = v; } },
    'static.lines_primer':         { page: P5,                        selector: '.p5-page',       apply: (m, v) => { m.pages.wings_lines.lines_primer = v; } },
    'static.wings_using':          { page: P5,                        selector: '.p5-page',       apply: (m, v) => { m.pages.wings_lines.wings_using = v; } },
    'static.instinct_primer':      { page: P6,                        selector: '.p6-page',       apply: (m, v) => { m.pages.instinct_subtype.instinct_primer = v; } },
    'static.instinct_definitions': { page: P6,                        selector: '.p6-page',       apply: (m, v) => { m.pages.instinct_subtype.instinct_definitions = v; } },
  };
  if (STATIC[key]) return { ...STATIC[key], type: 9, instinct: 'SP' };

  let mm = /^subtype_(sp|so|sx)([1-9])\.(tagline|narrative|patterns|shifts)$/.exec(key);
  if (mm) {
    const instinct = mm[1].toUpperCase(), N = +mm[2], field = mm[3];
    const SUB = {
      tagline:   { page: P6, selector: '.p6-page', apply: (m, v) => { m.pages.instinct_subtype.subtype.tagline = v; } },
      narrative: { page: P6, selector: '.p6-page', apply: (m, v) => { m.pages.instinct_subtype.subtype.narrative = v; } },
      patterns:  { page: P6, selector: '.p6-page', apply: (m, v) => { m.pages.instinct_subtype.subtype.patterns = v; } },
      shifts:    { page: 'P7 — Strengths & Growth', selector: '.p7-page', apply: (m, v) => { m.pages.strengths_challenges.shifts = v; } },
    };
    return { ...SUB[field], type: N, instinct };
  }

  mm = /^type_([1-9])\.(description|comparison|patterns|inquiry_lines|wings|lines|strengths|challenges|practices|communication|conflict|center)$/.exec(key);
  if (mm) {
    const N = +mm[1], field = mm[2];
    const remapWing = (w) => { const s = cmsPreviewSplitWingBest(w.body); return { number: w.target_type, name: CMS_TYPE_NAMES[w.target_type], body: s.body, best: s.best }; };
    const remapLine = (l) => ({ name: CMS_TYPE_NAMES[l.target_type], body: l.narrative, resource: l.resource_card, toward: l.target_type });
    const TYP = {
      description:   { page: 'P3 — Type Hypotheses', selector: '.p3-page', apply: (m, v) => { if (v && v.core_motivation != null) m.pages.type_hypotheses.core_motivation = v.core_motivation; } },
      comparison:    { page: 'P3 — Type Hypotheses', selector: '.p3-page', apply: (m, v) => { m.pages.type_hypotheses.comparison_rows = v; } },
      patterns:      { page: 'P4 — Patterns',        selector: '.p4-page', apply: (m, v) => { if (v) { m.pages.patterns.thinking = v.thinking; m.pages.patterns.feeling = v.feeling; m.pages.patterns.behaving = v.behaving; } } },
      inquiry_lines: { page: 'P4 — Patterns',        selector: '.p4-page', apply: (m, v) => { m.pages.patterns.inquiry_lines = v; } },
      wings:         { page: 'P5 — Wings & Lines',   selector: '.p5-page', apply: (m, v) => { const pair = [v.wing_a, v.wing_b].slice().sort((a, b) => a.target_type - b.target_type); m.pages.wings_lines.wings = v; m.pages.wings_lines.wing_low = remapWing(pair[0]); m.pages.wings_lines.wing_high = remapWing(pair[1]); } },
      lines:         { page: 'P5 — Wings & Lines',   selector: '.p5-page', apply: (m, v) => { m.pages.wings_lines.lines = v; m.pages.wings_lines.line_stress = remapLine(v.stress); m.pages.wings_lines.line_security = remapLine(v.security); } },
      strengths:     { page: 'P7 — Strengths & Growth', selector: '.p7-page', apply: (m, v) => { m.pages.strengths_challenges.strengths = v; } },
      challenges:    { page: 'P7 — Strengths & Growth', selector: '.p7-page', apply: (m, v) => { m.pages.strengths_challenges.challenges = v; } },
      practices:     { page: 'P7 — Strengths & Growth', selector: '.p7-page', apply: (m, v) => { m.pages.strengths_challenges.practices = v; } },
      communication: { page: 'P8 — Application',     selector: '.p8-page', apply: (m, v) => { m.pages.application.communication = v; } },
      conflict:      { page: 'P8 — Application',     selector: '.p8-page', apply: (m, v) => { m.pages.application.conflict = v; } },
      center:        { page: 'P8 — Application',     selector: '.p8-page', apply: (m, v) => { m.pages.application.center = v; } },
    };
    return { ...TYP[field], type: N, instinct: 'SP' };
  }
  return null;
}

// Minimal valid Call #2 result for the target type/instinct. buildClientModel derives every
// CLIENT_SPEC-required field from content_library + type_meta; empty AI objects fall through
// to the model's null/[] defaults (no AI field is required, so they render in their natural
// empty state — see the P3 quote box and P6 orange box).
function cmsPreviewApiResult(N, instinct) {
  const alt = N === 9 ? 1 : N + 1;
  const others = ['SP', 'SO', 'SX'].filter(x => x !== instinct);
  const prof = {}; prof[instinct] = 80; prof[others[0]] = 55; prof[others[1]] = 30;
  return {
    hypothesis: {
      confirmed_type: N, alternate_candidate: alt, dominant_instinct_hypothesis: instinct,
      confidence_level: 'HIGH', stage4_outcome: 'CONFIRM',
      call1_ranking: [{ type: N, score: 85 }, { type: alt, score: 60 }],
      instinct_score_profile: prof,
    },
    coach_report: {}, client_facing: {}, client_words: {},
  };
}

async function cmsRenderPreviewPng(spec, value) {
  const apiResult = cmsPreviewApiResult(spec.type, spec.instinct);
  const client = { first_name: 'Preview', last_name: 'Sample', date: 'June 2026' };
  const coach = { full_name: '', type: null, instinct: null };
  const model = await reportPrep.buildClientModel({ apiResult, client, coach });
  spec.apply(model, value);
  if (spec.selector === '.p6-page') model.pages.instinct_subtype.instinct_evidence = CMS_PREVIEW_WORST_EVIDENCE.slice();
  const html = buildClientReportHTML(model);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1400, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
    const el = await page.$(spec.selector);
    if (!el) throw new Error('preview page element not found: ' + spec.selector);
    const buf = await el.screenshot({ type: 'png' });
    return 'data:image/png;base64,' + buf.toString('base64');
  } finally {
    await browser.close();
  }
}

app.post('/admin/content/preview', requireSuperAdmin, async (req, res) => {
  const { content_key, value } = req.body || {};
  if (!cmsIsValidPreviewKey(content_key)) return res.status(400).json({ ok: false, error: 'invalid content_key' });
  if (value === undefined) return res.status(400).json({ ok: false, error: 'missing value' });
  const spec = cmsPreviewSpec(content_key);
  if (!spec) return res.status(400).json({ ok: false, error: 'no preview mapping for key' });
  try {
    const png = await cmsRenderPreviewPng(spec, value);
    res.json({ ok: true, png, page: spec.page });
  } catch (e) {
    console.error('[admin/content/preview] failed:', e.message);
    res.json({ ok: false, error: 'Preview render failed: ' + e.message });
  }
});

app.get('/admin/coaches', requireAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  let flashMsg = null;
  if (req.query.flash === 'coach_added')        flashMsg = 'Coach added successfully.';
  else if (req.query.flash === 'coach_deactivated')  flashMsg = 'Coach deactivated.';
  else if (req.query.flash === 'coach_reactivated')  flashMsg = 'Coach reactivated.';
  else if (req.query.flash === 'clients_reassigned') flashMsg = 'Clients reassigned successfully.';

  let coaches = [];
  try { coaches = await db.getAllCoaches(); } catch (e) { console.error('[admin/coaches] query error:', e.message); }

  res.send(renderCoachesPage(coaches, null, flashMsg, auth.hasRole(req, 'super_admin')));
});

app.get('/admin/coaches/active', requireAdmin, async (req, res) => {
  const coaches = await db.getAllCoaches().catch(() => []);
  res.json(coaches.filter(c => c.is_active !== false).map(c => ({ id: c.id, name: c.name })));
});

app.post('/admin/coaches/new', requireAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const { name, email, password, organization } = req.body;

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
    const newId = await db.addCoach(name.trim(), email.trim().toLowerCase(), passwordHash, organization ? organization.trim() : null);
    if (!newId) {
      const coaches = await db.getAllCoaches().catch(() => []);
      return res.send(renderCoachesPage(coaches, 'Failed to add coach — email may already be in use.', null));
    }
    // Create corresponding users row and assign client + coach roles
    const newUserId = await auth.createUserWithRoles(
      email.toLowerCase().trim(),
      passwordHash,
      ['client', 'coach']
    );
    if (newUserId) {
      await db.query(
        'UPDATE coaches SET user_id = $1 WHERE email = $2',
        [newUserId, email.toLowerCase().trim()]
      );
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

// ── Beta diagnostic report + global beta-mode toggle: RETIRED (PR-F) ───────────
// The old per-client beta .docx report (POST /admin/beta-report/:client_id) and the
// global Beta Mode toggle (POST /admin/settings/beta-mode) were removed when
// /admin/beta-review replaced them. The app_settings.beta_mode_enabled column and the
// clients.beta_report_* columns are intentionally NOT dropped here — flagged for a
// future cleanup migration. db.getBetaModeEnabled/setBetaModeEnabled remain exported
// but unused.

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
  try {
    // Super-admins see every client across all coaches; other coaches see only their own.
    rows = auth.hasRole(req, 'super_admin')
      ? await db.getAllAdminRows()
      : await db.getAdminRowsByCoach(req.session.coach_id);
  } catch (e) { console.error('[admin] query error:', e.message); }

  // Tag rows with em_rerun_eligible so rowCells can show the Re-Run Analysis button only for failed
  // em_only assessments. Self-contained (never throws); leaves the flag false on any error.
  try { await annotateEmRerunEligibility(rows); } catch (e) { console.error('[admin] em-rerun annotate failed:', e.message); }

  const isAdmin = auth.hasRole(req, 'admin') || auth.hasRole(req, 'super_admin');
  const isSuperAdmin = auth.hasRole(req, 'super_admin');

  // Per-row cells (the 11 <td>s, no <tr> wrapper) so the same builder feeds both the
  // flat super-admin table and the coach client-grouped accordion. Tombstones are
  // filtered out of both /admin queries, so a row here is either active or pending.
  const rowCells = (r) => {
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
      clientExists ? `<a href="/reports/token/${encodeURIComponent(clientPdfBase)}" title="Client PDF" style="display:block;color:#00b1d7;text-decoration:none;white-space:nowrap;">&#128196; Client</a>` : '',
      coachExists  ? `<a href="/reports/token/${encodeURIComponent(coachPdfBase)}"  title="Coach PDF"  style="display:block;color:#f58527;text-decoration:none;white-space:nowrap;">&#128196; Coach</a>` : '',
    ].filter(Boolean).join('') || '—' : '—';

    const clientId = r.client_id;
    const assessmentId = r.assessment_id;
    const rawName  = `${r.first_name || ''} ${r.last_name || ''}`.trim();
    const jsName   = rawName.replace(/'/g, "\\'");
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

    // Three-state soft delete (assessment-scoped). A pending-deletion row shows the
    // PENDING DELETION badge and no operational actions; super-admins additionally
    // get a Restore link in place of the trash can.
    const isPending = !!r.deleted_at;
    const deletionBadge = isPending
      ? ` <span title="Marked for deletion — recoverable by a super-admin from Deleted Assessments" style="background:#fff3cd;color:#8b6914;font-size:10px;font-weight:700;letter-spacing:0.04em;padding:1px 6px;border-radius:3px;vertical-align:middle;white-space:nowrap;">PENDING DELETION</span>`
      : '';

    const hasScores    = !!r.has_scores_snapshot;
    const hasApiResult = !!r.has_api_result;

    let actionCell;
    if (isPending) {
      actionCell = (isSuperAdmin && assessmentId)
        ? `<button onclick="restoreAssessmentUI(${assessmentId},'${jsName}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#1a7a4a;padding:0;text-decoration:underline;">Restore</button>`
        : `<span style="color:#9AA3AD;">—</span>`;
    } else {
      const inviteResendAction = clientStatus === 'not_started' ? `
      <form method="POST" action="/admin/clients/resend/${clientId}" style="display:inline;" onsubmit="return confirm('Resend invite to ${jsName}?');">
        <button type="submit" style="background:none;border:none;cursor:pointer;font-size:12px;color:#00b1d7;padding:0;text-decoration:underline;">Resend invite</button>
      </form> ` : '';

      const reassignAction = isAdmin
        ? `<button onclick="openReassignModal(${clientId},'${jsName}',${req.session.coach_id},'${(r.coach_name || '').replace(/'/g, "\\'")}',false,null)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#00b1d7;padding:0;text-decoration:underline;margin-right:6px;">Reassign</button>`
        : '';

      // Re-Run Analysis (super-admin) — production recovery for a FAILED em_only assessment
      // (scores present, api_result NULL). Replaces the retired EM Retry. Gated to
      // super-admins to match the requireSuperAdmin route (a plain admin would only hit a
      // 403). em_rerun_eligible is computed server-side (annotateEmRerunEligibility) and is
      // true only for failed em_only rows. Fires a confirmation modal before the route.
      // Hive Orange (#f58527), destructive. Mutually exclusive with Regen (api_result exists).
      const reRunAction = (isSuperAdmin && hasScores && !hasApiResult && r.em_rerun_eligible && assessmentId)
        ? `<button onclick="reRunAnalysis(${assessmentId},'${jsName}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#f58527;padding:0;text-decoration:underline;margin-right:6px;">Re-Run Analysis</button>`
        : '';

      const regenAction = (isAdmin && hasApiResult)
        ? `<button onclick="adminRegen(${clientId},'${jsName}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#f58527;padding:0;text-decoration:underline;margin-right:6px;">Regen</button>`
        : '';

      const resendAction = hasApiResult
        ? `<button onclick="adminResend(${clientId},'${esc(rawEmail).replace(/'/g, "\\'")}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#00b1d7;padding:0;text-decoration:underline;margin-right:6px;">Resend</button>`
        : '';

      // Retake (super-admin only, completed clients only): issue a fresh assessment
      // while preserving the prior results. Gated on client status (issuing a retake
      // resets the client to not_started, handing off to "Resend invite") and on
      // is_latest_complete so exactly one Retake button shows per client.
      const retakeAction = (auth.hasRole(req, 'super_admin') && clientStatus === 'complete' && r.is_latest_complete)
        ? `<button onclick="adminRetake(${clientId},'${jsName}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#7c3aed;padding:0;text-decoration:underline;margin-right:6px;">Retake</button>`
        : '';

      // Trash → mark this single assessment for deletion. Available to coaches (own
      // assessments) and super-admins. Hidden when there is no assessment row to
      // delete (a not_started client with no assessment yet — D3).
      const trashAction = assessmentId
        ? `<button onclick="markAssessmentDeleted(${assessmentId},'${jsName}',this)" title="Delete assessment" style="background:none;border:none;cursor:pointer;font-size:16px;padding:0;color:#c0392b;">&#128465;</button>`
        : '';

      actionCell = `${reassignAction}${reRunAction}${regenAction}${resendAction}${retakeAction}${inviteResendAction}${trashAction}`;
    }

    const retakeBadge = r.retake_of_assessment_id
      ? ` <span title="Issued as a retake" style="background:#ede9fe;color:#7c3aed;font-size:10px;font-weight:700;letter-spacing:0.04em;padding:1px 5px;border-radius:3px;vertical-align:middle;">RETAKE</span>`
      : '';

    // Retake Pending: the client has reset to not_started for a retake but still
    // has a prior completed assessment (is_latest_complete). Distinguishes a retake
    // in progress from a brand-new client (not_started, no prior assessment).
    const retakePendingBadge = (clientStatus === 'not_started' && r.is_latest_complete)
      ? ` <span title="A retake has been issued and is awaiting completion" style="background:#fff3cd;color:#8b6914;font-size:10px;font-weight:700;letter-spacing:0.04em;padding:1px 6px;border-radius:3px;vertical-align:middle;white-space:nowrap;">Retake Pending</span>`
      : '';

    return `
      <td><a href="#" data-entity="client-${clientId}" onclick="openClientProfile(${clientId});return false;" style="color:#00b1d7;text-decoration:underline;text-decoration-style:dotted;font-weight:600;" onmouseover="this.style.textDecorationStyle='solid'" onmouseout="this.style.textDecorationStyle='dotted'">${name}</a>${retakeBadge}</td>
      <td>${typeLabel}</td>
      <td>${instinct}</td>
      <td>${conf}</td>
      <td id="coach-cell-${clientId}">${coach}</td>
      <td>${date}</td>
      <td><span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;">${statusLabel}</span>${retakePendingBadge}${deletionBadge}</td>
      <td id="pdf-status-${clientId}" style="font-size:12px;">${pdfStatus}</td>
      <td id="email-status-${clientId}" style="font-size:12px;">${emailStatus}</td>
      <td>${pdfLinks}</td>
      <td>${actionCell}</td>`;
  };

  // Sort keys for the client-side sortable table (consumed by sortAdminTable in the page
  // script). Stamped as data-* on each assessment <tr> so sorting never parses rendered
  // cell HTML. Blank/missing values are emitted as '' and always sort last (comparator).
  const rowSortAttrs = (r) => {
    const nameKey   = `${r.first_name || ''} ${r.last_name || ''}`.trim().toLowerCase();
    const typeKey   = r.confirmed_type ? `type ${r.confirmed_type} — ${(TYPE_NAMES[r.confirmed_type] || '').toLowerCase()}` : '';
    const instKey   = (r.confirmed_instinct || '').toLowerCase();
    const confKey   = (r.confidence_level || '').toLowerCase();
    const coachKey  = (r.coach_name || '').toLowerCase();
    let dateKey = '';
    if (r.created_at) { const t = new Date(r.created_at).getTime(); if (!isNaN(t)) dateKey = String(t); }
    const statusKey = (r.status || '').replace(/_/g, ' ').toLowerCase();
    return `data-sort-name="${esc(nameKey)}" data-sort-type="${esc(typeKey)}" data-sort-instinct="${esc(instKey)}" data-sort-conf="${esc(confKey)}" data-sort-coach="${esc(coachKey)}" data-sort-date="${dateKey}" data-sort-status="${esc(statusKey)}"`;
  };

  // Row DOM id: assessment-scoped when an assessment exists, else client-scoped (a
  // not_started client with no assessment row).
  const rowId = (r) => r.assessment_id ? `row-asmt-${r.assessment_id}` : `row-client-${r.client_id}`;

  let body;
  if (rows.length === 0) {
    body = `<tr><td colspan="11" style="text-align:center;padding:40px;color:#7A96A6;">No clients yet — click + Client to add one</td></tr>`;
  } else {
    // Group a client's multiple assessments into an accordion (collapsed by default);
    // single-assessment clients stay a flat row. Applies to BOTH the coach view and the
    // super-admin view (D5 reversed — super-admins also need the accordion given
    // increasing assessment volume). rowCells handles all per-role action gating, so the
    // grouping logic is identical for both. Rows arrive ordered by created_at DESC;
    // grouping preserves first-seen order.
    const groups = [];
    const idx = {};
    rows.forEach(r => {
      if (idx[r.client_id] === undefined) { idx[r.client_id] = groups.length; groups.push([]); }
      groups[idx[r.client_id]].push(r);
    });
    body = groups.map(g => {
      if (g.length === 1) return `<tr id="${rowId(g[0])}" data-kind="row" data-client-id="${g[0].client_id}" ${rowSortAttrs(g[0])}>${rowCells(g[0])}</tr>`;
      const first = g[0];
      const gName = esc(`${first.first_name || ''} ${first.last_name || ''}`.trim()) || '—';
      const gNameKey = `${first.first_name || ''} ${first.last_name || ''}`.trim().toLowerCase();
      const header = `<tr class="cgroup-header" data-kind="header" data-client-id="${first.client_id}" data-sort-name="${esc(gNameKey)}" onclick="toggleClientGroup(${first.client_id})">
        <td colspan="11"><span id="cgroup-caret-${first.client_id}" class="cgroup-caret">▶</span> ${gName} <span class="cgroup-count">— ${g.length} assessments</span></td>
      </tr>`;
      const subRows = g.map(r => `<tr id="${rowId(r)}" class="cgroup-row cgroup-${first.client_id}" data-kind="row" data-client-id="${first.client_id}" ${rowSortAttrs(r)} style="display:none;">${rowCells(r)}</tr>`).join('\n');
      return header + '\n' + subRows;
    }).join('\n');
  }

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
  /* Coach dashboard client-grouping accordion (multi-assessment clients) */
  tbody tr.cgroup-header { cursor: pointer; background: #eef6f9; }
  tbody tr.cgroup-header:hover { background: #e3f0f5; }
  tbody tr.cgroup-header td { font-weight: 700; color: #1A2B33; }
  .cgroup-caret { display: inline-block; width: 12px; color: #00b1d7; }
  .cgroup-count { color: #7A96A6; font-weight: 400; font-size: 12px; }
  tbody tr.cgroup-row td:first-child { border-left: 3px solid #00b1d7; padding-left: 18px; }
  /* Sortable column headers */
  thead th.sortable { cursor: pointer; user-select: none; white-space: nowrap; }
  thead th.sortable:hover { background: #009bbf; }
  thead th .sort-ind { font-size: 10px; margin-left: 4px; opacity: 0.85; }
  /* Flat sort dissolves the client-group accordion: group headers are hidden in JS;
     sub-rows lose their group indentation so every row reads as an independent row. */
  tbody.flat-sort tr.cgroup-row td:first-child { border-left: none; padding-left: 14px; }
  ${CMS_DROPDOWN_CSS}
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
    ${auth.hasRole(req, 'admin') || auth.hasRole(req, 'super_admin') ? `<a href="/admin/coaches" class="nav-link">Manage Coaches</a><span class="nav-sep">|</span>` : ''}
    ${auth.hasRole(req, 'super_admin') ? `${cmsContentMenu('')}<span class="nav-sep">|</span><a href="/admin/beta-review" class="nav-link">Beta Review</a><span class="nav-sep">|</span><a href="/admin/em-lab" class="nav-link">EM Lab</a><span class="nav-sep">|</span><a href="/admin/deleted-assessments" class="nav-link">Deleted Assessments</a><span class="nav-sep">|</span><a href="/admin/embargo" class="nav-link">Embargo List</a><span class="nav-sep">|</span>` : ''}
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
          <th class="sortable" data-col="name" onclick="headerSort('name')">Client Name <span class="sort-ind">⇅</span></th>
          <th class="sortable" data-col="type" onclick="headerSort('type')">Type <span class="sort-ind">⇅</span></th>
          <th class="sortable" data-col="instinct" onclick="headerSort('instinct')">Instinct <span class="sort-ind">⇅</span></th>
          <th class="sortable" data-col="confidence" onclick="headerSort('confidence')">Confidence <span class="sort-ind">⇅</span></th>
          <th class="sortable" data-col="coach" onclick="headerSort('coach')">Coach <span class="sort-ind">⇅</span></th>
          <th class="sortable" data-col="date" onclick="headerSort('date')">Date <span class="sort-ind">⇅</span></th>
          <th class="sortable" data-col="status" onclick="headerSort('status')">Status <span class="sort-ind">⇅</span></th>
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
// Re-Run Analysis handler (super-admin). Fires a confirmation modal, then re-runs the full
// EM pipeline on a FAILED em_only assessment via POST /admin/em-rerun/:assessment_id,
// force-writing the new result into production and re-delivering reports.
function reRunAnalysisModal(onContinue) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;max-width:460px;width:90%;border-radius:6px;padding:24px 26px;box-shadow:0 8px 30px rgba(0,0,0,.3);';
  box.innerHTML = '<h3 style="margin:0 0 12px;font-size:18px;color:#1a2330;">Re-Run Analysis</h3>'
    + '<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#3a4250;">Re-running the analysis updates the Client and Coach reports. Any changes made by the analysis are permanent. If you wish to keep the old reports, please exit this message and download those reports first. Then re-run the analysis.</p>'
    + '<div style="text-align:right;">'
    + '<button id="rra-cancel" style="background:none;border:1px solid #c5ccd6;border-radius:4px;cursor:pointer;font-size:13px;color:#3a4250;padding:7px 16px;margin-right:8px;">Cancel</button>'
    + '<button id="rra-continue" style="background:#f58527;border:none;border-radius:4px;cursor:pointer;font-size:13px;color:#fff;padding:7px 16px;">Continue</button>'
    + '</div>';
  ov.appendChild(box);
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });   // outside-click dismiss, no state change
  box.querySelector('#rra-cancel').addEventListener('click', close);
  box.querySelector('#rra-continue').addEventListener('click', () => { close(); onContinue(); });
}
function reRunAnalysis(assessmentId, name, btn) {
  reRunAnalysisModal(async () => {
    const orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
    try {
      const r = await fetch('/admin/em-rerun/' + assessmentId, {method:'POST', headers:{Accept:'application/json'}});
      const d = await r.json();
      if (d.success) {
        btn.style.display = 'none';
        showToast('Re-Run Analysis complete. Reports re-delivered.');
        setTimeout(function(){ location.reload(); }, 1200);
      } else { alert(d.error || 'Re-Run Analysis failed'); btn.disabled = false; btn.textContent = orig; }
    } catch(e) { alert('Request failed'); btn.disabled = false; btn.textContent = orig; }
  });
}
// DEAD CODE — retired 2026-06-20. Mark for removal in post-beta cleanup sweep.
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
async function adminRetake(clientId, name, btn) {
  if (!confirm('Issue a new assessment for ' + name + '? Their previous results will be preserved.')) return;
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  try {
    const r = await fetch('/admin/clients/' + clientId + '/retake', {method:'POST', headers:{Accept:'application/json'}});
    const d = await r.json();
    if (d.success) {
      showToast('Retake issued — a fresh invite has been sent.');
      setTimeout(function(){ location.reload(); }, 1200);
    } else { alert(d.error || 'Retake failed'); btn.disabled = false; btn.textContent = orig; }
  } catch(e) { alert('Request failed'); btn.disabled = false; btn.textContent = orig; }
}
// Three-state soft delete. Mark/restore reload after success so badges and the
// coach client-grouping re-render correctly (the dataset is small).
async function markAssessmentDeleted(assessmentId, name, btn) {
  if (!confirm('Mark this assessment for ' + name + ' for deletion? A super-admin can restore it from Deleted Assessments.')) return;
  btn.disabled = true;
  try {
    var r = await fetch('/admin/assessments/' + assessmentId + '/mark-deleted', {method:'POST', headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.ok) { showToast('Assessment marked for deletion.'); setTimeout(function(){ location.reload(); }, 600); }
    else { alert(d.error || 'Failed to mark for deletion'); btn.disabled = false; }
  } catch(e) { alert('Request failed'); btn.disabled = false; }
}
async function restoreAssessmentUI(assessmentId, name, btn) {
  if (!confirm('Restore the assessment for ' + name + ' to active?')) return;
  btn.disabled = true;
  try {
    var r = await fetch('/admin/assessments/' + assessmentId + '/restore', {method:'POST', headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.ok) { showToast('Assessment restored.'); setTimeout(function(){ location.reload(); }, 600); }
    else { alert(d.error || 'Restore failed'); btn.disabled = false; }
  } catch(e) { alert('Request failed'); btn.disabled = false; }
}
// ============ Sortable dashboard table (client-side) ============
// Two modes: the default CLIENT NAME ascending keeps the client-group accordion intact
// (groups ordered by client name asc); any other column/direction dissolves the groups
// into one flat sorted list. The active sort is persisted in localStorage so a reload
// restores it. All sort logic is reachable from sortAdminTable(column, direction).
(function () {
  var SORT_KEY = 'adminDashboardSort';
  var COLUMNS = ['name', 'type', 'instinct', 'confidence', 'coach', 'date', 'status'];
  var CONF_RANK = { high: 0, medium: 1, low: 2 };   // HIGH → MEDIUM → LOW (ascending)
  var tbody, BLOCKS;

  // Snapshot the server-rendered structure into ordered blocks: each block is either a
  // single ungrouped row, or a group header followed by its collapsed sub-rows. Node
  // references persist across re-sorts (appendChild moves nodes, never destroys them).
  function buildBlocks() {
    var blocks = [], cur = null;
    Array.prototype.forEach.call(tbody.children, function (node) {
      var kind = node.getAttribute && node.getAttribute('data-kind');
      if (kind === 'header') {
        cur = { kind: 'group', name: node.getAttribute('data-sort-name') || '', nodes: [node] };
        blocks.push(cur);
      } else if (node.classList && node.classList.contains('cgroup-row')) {
        if (cur && cur.kind === 'group') cur.nodes.push(node);
        else blocks.push({ kind: 'single', name: (node.getAttribute && node.getAttribute('data-sort-name')) || '', nodes: [node] });
      } else {
        cur = null;
        blocks.push({ kind: 'single', name: (node.getAttribute && node.getAttribute('data-sort-name')) || '', nodes: [node] });
      }
    });
    return blocks;
  }

  function blank(v) { return v === null || v === undefined || v === ''; }

  function readStored() {
    try {
      var raw = localStorage.getItem(SORT_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && COLUMNS.indexOf(s.column) !== -1 && (s.direction === 'asc' || s.direction === 'desc')) return s;
    } catch (e) {}
    return null;
  }
  function writeStored(column, direction) {
    try { localStorage.setItem(SORT_KEY, JSON.stringify({ column: column, direction: direction })); } catch (e) {}
  }

  // Comparator value for a row on a column → { blank } or { num } or { str }.
  function keyFor(row, column) {
    if (column === 'date') {
      var d = row.getAttribute('data-sort-date');
      return blank(d) ? { blank: true } : { num: parseFloat(d) };
    }
    if (column === 'confidence') {
      var c = row.getAttribute('data-sort-conf');
      if (blank(c)) return { blank: true };
      return { num: (c in CONF_RANK) ? CONF_RANK[c] : 3 };   // unknown non-blank: after low, before blank
    }
    var v = row.getAttribute('data-sort-' + column);          // name | type | instinct | coach | status
    return blank(v) ? { blank: true } : { str: v };
  }

  function comparator(column, direction) {
    var sign = direction === 'desc' ? -1 : 1;
    return function (ra, rb) {
      var a = keyFor(ra, column), b = keyFor(rb, column);
      if (a.blank && b.blank) return 0;
      if (a.blank) return 1;            // blanks always last, regardless of direction
      if (b.blank) return -1;
      var r = (typeof a.num === 'number') ? (a.num - b.num)
            : (a.str < b.str ? -1 : a.str > b.str ? 1 : 0);
      return sign * r;
    };
  }

  function updateIndicators(column, direction) {
    Array.prototype.forEach.call(document.querySelectorAll('thead th.sortable'), function (th) {
      var ind = th.querySelector('.sort-ind');
      if (!ind) return;
      ind.textContent = (th.getAttribute('data-col') === column) ? (direction === 'desc' ? '▼' : '▲') : '⇅';
    });
  }

  // Default view: groups intact, ordered by client name ascending (blanks last).
  function renderGrouped() {
    tbody.classList.remove('flat-sort');
    var sorted = BLOCKS.slice().sort(function (x, y) {
      var xb = blank(x.name), yb = blank(y.name);
      if (xb && yb) return 0; if (xb) return 1; if (yb) return -1;
      return x.name < y.name ? -1 : x.name > y.name ? 1 : 0;
    });
    sorted.forEach(function (b) {
      b.nodes.forEach(function (n, i) {
        tbody.appendChild(n);
        if (b.kind === 'group') {
          if (i === 0) { n.style.display = ''; var caret = n.querySelector('.cgroup-caret'); if (caret) caret.textContent = '▶'; }
          else n.style.display = 'none';   // sub-rows collapsed by default (matches server render)
        } else {
          n.style.display = '';
        }
      });
    });
  }

  // Flat view: groups dissolved — all assessment rows sorted as independent rows.
  function renderFlat(column, direction) {
    tbody.classList.add('flat-sort');
    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr[data-kind="row"]'));
    rows.sort(comparator(column, direction));
    rows.forEach(function (r) { r.style.display = ''; tbody.appendChild(r); });
    Array.prototype.forEach.call(tbody.querySelectorAll('tr[data-kind="header"]'), function (h) { h.style.display = 'none'; });
  }

  // Entry point — apply a sort, persist it, and update the header indicators.
  window.sortAdminTable = function (column, direction) {
    if (!tbody) return;
    if (COLUMNS.indexOf(column) === -1) column = 'name';
    direction = direction === 'desc' ? 'desc' : 'asc';
    writeStored(column, direction);
    updateIndicators(column, direction);
    if (column === 'name' && direction === 'asc') renderGrouped();
    else renderFlat(column, direction);
  };

  // Header click: first click on a column sorts ascending; clicking the active column
  // again flips to descending (then back to ascending on the next click).
  window.headerSort = function (column) {
    var cur = readStored() || { column: 'name', direction: 'asc' };
    var direction = (cur.column === column && cur.direction === 'asc') ? 'desc' : 'asc';
    window.sortAdminTable(column, direction);
  };

  function initSort() {
    tbody = document.querySelector('table tbody');
    if (!tbody) return;
    BLOCKS = buildBlocks();
    var s = readStored() || { column: 'name', direction: 'asc' };   // default: CLIENT NAME asc
    window.sortAdminTable(s.column, s.direction);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSort);
  else initSort();
})();

// Coach dashboard: collapse/expand a client's grouped assessment rows.
function toggleClientGroup(clientId) {
  var rows = document.querySelectorAll('.cgroup-' + clientId);
  if (!rows.length) return;
  var collapse = rows[0].style.display !== 'none';
  rows.forEach(function(row){ row.style.display = collapse ? 'none' : ''; });
  var caret = document.getElementById('cgroup-caret-' + clientId);
  if (caret) caret.textContent = collapse ? '▶' : '▼';
}
</script>
${sharedModalHTML(auth.hasRole(req, 'admin') || auth.hasRole(req, 'super_admin'), auth.hasRole(req, 'super_admin'))}
</body>
</html>`);
});

// Tokenized PDF access — generation step. Coach must be logged in. Returns a
// 302 redirect to /reports/view/<token>, which is a single-use, 15-min URL.
const PDF_FILENAME_RE = /^(client|coach|beta)_[^/]+\.pdf$/;

app.get('/reports/token/:filename', requireAdminSession, async (req, res) => {
  const filename = req.params.filename;
  if (!PDF_FILENAME_RE.test(filename)) {
    return res.status(400).send('Bad request');
  }

  // Preserve coach-scope check from the old route: client/coach PDFs are scoped
  // to the owning coach; beta PDFs require super-admin.
  if (/^beta_/.test(filename)) {
    if (!auth.hasRole(req, 'super_admin')) return res.status(403).send('Forbidden');
  } else {
    const ownerCoachId = await db.getReportCoachId(filename);
    if (ownerCoachId !== null && ownerCoachId !== req.session.coach_id) {
      return res.status(403).send('Forbidden');
    }
  }

  const filePath = path.join(REPORTS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.createPdfToken(token, filename, req.session.coach_id, expiresAt);

  res.redirect(302, `/reports/view/${token}`);
});

// Tokenized PDF access — redemption step. Public route: no session required.
// Token is single-use and expires 15 minutes after issue.
app.get('/reports/view/:token', async (req, res) => {
  const token = req.params.token;
  const row = await db.getPdfToken(token);
  if (!row) return res.status(403).send('Forbidden');
  if (row.redeemed_at) return res.status(403).send('Forbidden');
  if (new Date(row.expires_at).getTime() <= Date.now()) return res.status(403).send('Forbidden');

  await db.markPdfTokenRedeemed(token);

  const filePath = path.join(REPORTS_DIR, row.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${row.filename}"`);
  res.sendFile(filePath);
});

// ── Assessment soft delete (three-state, assessment-scoped) ──────────────────
// Replaces the retired client-scoped cascade (POST /admin/delete/:client_id).
// A retake no longer takes its siblings down with it: each trash-can targets one
// assessment id.

// Helper: the coach who owns a given assessment (via its client). Used to gate
// coaches to their own assessments; super-admins bypass.
async function assertAssessmentAccess(req, res, assessmentId) {
  if (auth.hasRole(req, 'super_admin')) return true;
  const ownerCoachId = await db.getAssessmentOwnerCoachId(assessmentId);
  if (ownerCoachId !== null && ownerCoachId !== req.session.coach_id) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// Active → Pending deletion. Available to coaches (own assessments) and super-admins.
app.post('/admin/assessments/:assessment_id/mark-deleted', requireAdminSession, async (req, res) => {
  const assessmentId = parseInt(req.params.assessment_id, 10);
  if (!assessmentId || isNaN(assessmentId)) return res.status(400).json({ error: 'Invalid assessment ID' });
  if (!(await assertAssessmentAccess(req, res, assessmentId))) return;

  try {
    const r = await db.query('SELECT status FROM assessments WHERE id = $1 LIMIT 1', [assessmentId]);
    if (!r || r.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    await db.markAssessmentForDeletion(assessmentId, r.rows[0].status);
    console.log(`[admin] assessment #${assessmentId} marked for deletion by coach #${req.session.coach_id}`);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[admin] mark-deleted error:', e.message);
    return res.status(500).json({ error: 'Mark-for-deletion failed' });
  }
});

// Pending deletion → Active. Super-admin only.
app.post('/admin/assessments/:assessment_id/restore', requireSuperAdmin, async (req, res) => {
  const assessmentId = parseInt(req.params.assessment_id, 10);
  if (!assessmentId || isNaN(assessmentId)) return res.status(400).json({ error: 'Invalid assessment ID' });
  try {
    await db.restoreAssessment(assessmentId);
    console.log(`[admin] assessment #${assessmentId} restored by super-admin #${req.session.coach_id}`);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[admin] restore error:', e.message);
    return res.status(500).json({ error: 'Restore failed' });
  }
});

// Pending deletion → Permanently deleted (tombstone). Super-admin only. Purges PDF
// files from disk and removes the reports rows, then flips the flag (row is kept as
// an audit tombstone). If the assessment had beta feedback, invalidates the stale
// cross-tester analysis singleton.
app.post('/admin/assessments/:assessment_id/permanent-delete', requireSuperAdmin, async (req, res) => {
  const assessmentId = parseInt(req.params.assessment_id, 10);
  if (!assessmentId || isNaN(assessmentId)) return res.status(400).json({ error: 'Invalid assessment ID' });

  try {
    // Guard: only a pending-deletion row can be permanently deleted.
    const chk = await db.query(
      'SELECT deleted_at, permanently_deleted FROM assessments WHERE id = $1 LIMIT 1',
      [assessmentId]
    );
    if (!chk || chk.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
    if (chk.rows[0].deleted_at === null) {
      return res.status(409).json({ error: 'Assessment is not pending deletion' });
    }
    if (chk.rows[0].permanently_deleted === true) {
      return res.json({ ok: true }); // already a tombstone — idempotent no-op
    }

    // 1) Purge PDF files via the reports-table join (reliable, assessment-scoped —
    //    never filename-parsed).
    const { clientPdf, coachPdf } = await db.getAssessmentReports(assessmentId);
    for (const p of [clientPdf, coachPdf]) {
      if (!p) continue;
      try { fs.unlinkSync(p); console.log(`[admin] purged PDF: ${p}`); }
      catch (e) { console.warn(`[admin] could not purge PDF ${p}:`, e.message); }
    }
    // 2) Remove the now-dangling reports rows.
    await db.deleteReportsByAssessmentId(assessmentId);
    // 3) Flip the tombstone flag (keep the row).
    await db.permanentlyDeleteAssessment(assessmentId);
    // 4) If this assessment had beta feedback, the cross-tester synthesis is stale.
    const bf = await db.getBetaFeedback(assessmentId).catch(() => null);
    if (bf) {
      await db.clearBetaAnalysis();
      console.log(`[admin] cleared beta_analysis after permanent delete of beta assessment #${assessmentId}`);
    }
    console.log(`[admin] assessment #${assessmentId} permanently deleted by super-admin #${req.session.coach_id}`);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[admin] permanent-delete error:', e.message);
    return res.status(500).json({ error: 'Permanent delete failed' });
  }
});

// ── Deleted Assessments management page (super-admin) ────────────────────────
// System of record for every soft-deleted assessment (pending + tombstone).
// Patterned on /admin/beta-review: fetch then render via a page builder.
app.get('/admin/deleted-assessments', requireSuperAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  let rows = [];
  try { rows = await db.getDeletedAssessments(); }
  catch (e) { console.error('[deleted-assessments] query error:', e.message); }
  res.send(renderDeletedAssessmentsPage(req, rows));
});

function renderDeletedAssessmentsPage(req, rows) {
  const fmtStatus = (s) => {
    if (!s) return '—';
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const bodyRows = rows.map(r => {
    const name   = esc(`${r.first_name || ''} ${r.last_name || ''}`.trim()) || '—';
    const coach  = esc(r.coach_name || '—');
    const typeNum = r.confirmed_type;
    const instinct = r.dominant_instinct_hypothesis || r.confirmed_instinct || '';
    const typeHypothesis = typeNum
      ? `Type ${typeNum} — ${TYPE_NAMES[typeNum] || ''}${instinct ? ` · ${esc(instinct)}` : ''}`
      : '—';
    const delDate = formatAdminDate(r.deleted_at);
    const isTombstone = r.permanently_deleted === true;
    const jsName = name.replace(/'/g, "\\'");

    const statusBadge = isTombstone
      ? `<span style="background:#fdecea;color:#c0392b;font-size:10px;font-weight:700;letter-spacing:0.04em;padding:2px 7px;border-radius:3px;white-space:nowrap;">PERMANENTLY DELETED</span>`
      : `<span style="background:#fff3cd;color:#8b6914;font-size:10px;font-weight:700;letter-spacing:0.04em;padding:2px 7px;border-radius:3px;white-space:nowrap;">PENDING DELETION</span>`;

    const preStatus = r.pre_deletion_status
      ? `<div style="color:#9AA3AD;font-size:11px;margin-top:3px;">was: ${esc(fmtStatus(r.pre_deletion_status))}</div>`
      : '';

    const checkbox = isTombstone
      ? `<input type="checkbox" disabled style="opacity:0.3;">`
      : `<input type="checkbox" class="da-check" value="${r.assessment_id}">`;

    const actions = isTombstone
      ? `<span style="color:#9AA3AD;">—</span>`
      : `<button onclick="restoreDeleted(${r.assessment_id},'${jsName}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#1a7a4a;padding:0;text-decoration:underline;margin-right:10px;">Restore</button>
         <button onclick="permanentDelete(${r.assessment_id},'${jsName}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#c0392b;padding:0;text-decoration:underline;">Delete Permanently</button>`;

    return `<tr id="da-row-${r.assessment_id}">
      <td style="text-align:center;">${checkbox}</td>
      <td>${name}</td>
      <td>${coach}</td>
      <td>${typeHypothesis}</td>
      <td>${delDate}</td>
      <td>${statusBadge}${preStatus}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('\n');

  const emptyRow = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#7A96A6;">No deleted assessments.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hive Admin — Deleted Assessments</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: Georgia, serif; background: #f7f5f2; color: #1A2B33; margin: 0; padding: 0; }
  .top-bar { background: #1A2B33; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .top-bar h1 { color: #00b1d7; font-size: 18px; margin: 0; font-weight: 700; }
  .top-bar span { color: #7A96A6; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
  .top-bar .nav-link { color: #7A96A6; font-size: 12px; text-decoration: none; font-family: Georgia, serif; }
  .top-bar .nav-link:hover { color: #fff; }
  .top-bar .nav-sep { color: #3A4B55; font-size: 12px; margin: 0 8px; }
  .container { max-width: 1300px; margin: 0 auto; padding: 32px 24px; }
  .card { background: #fff; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; }
  .toolbar { padding: 14px 18px; border-bottom: 1px solid #EFE8E0; display: flex; align-items: center; gap: 16px; font-size: 13px; }
  .toolbar a { color: #00b1d7; text-decoration: underline; cursor: pointer; }
  .btn-danger { background: #c0392b; color: #fff; border: none; border-radius: 4px; font-family: Georgia, serif; font-size: 12px; font-weight: 700; padding: 7px 14px; cursor: pointer; }
  .btn-danger:disabled { background: #d8a39d; cursor: default; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { background: #00b1d7; color: #fff; text-align: left; padding: 12px 14px; font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; font-weight: 700; }
  tbody tr { border-bottom: 1px solid #EFE8E0; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: #fafaf8; }
  tbody td { padding: 11px 14px; vertical-align: middle; }
</style>
</head>
<body>
<div class="top-bar">
  <div>
    <div><span>Hive Enneagram Type Tool</span></div>
    <h1>Deleted Assessments</h1>
  </div>
  <div style="display:flex;align-items:center;gap:16px;">
    <a href="/admin" class="nav-link">← Dashboard</a>
    <span class="nav-sep">|</span>
    <a href="/admin/beta-review" class="nav-link">Beta Review</a>
    <span class="nav-sep">|</span>
    <a href="/admin/logout" class="nav-link">Sign out</a>
  </div>
</div>
<div class="container">
  <div class="card">
    <div class="toolbar">
      <a onclick="toggleSelectAll()">Select all (pending)</a>
      <button id="da-delete-selected" class="btn-danger" onclick="deleteSelected()">Delete Selected</button>
      <span style="color:#7A96A6;font-size:12px;">Permanent deletion purges PDFs from disk and cannot be undone. Pending rows can be restored.</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:38px;"></th>
          <th>Client Name</th>
          <th>Coach</th>
          <th>Type Hypothesis</th>
          <th>Deletion Date</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows.length === 0 ? emptyRow : bodyRows}</tbody>
    </table>
  </div>
</div>
<script>
function showToast(msg) {
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a7a4a;color:#fff;padding:12px 20px;border-radius:5px;font-family:Georgia,serif;font-size:13px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.25);';
  document.body.appendChild(t);
  setTimeout(function(){t.remove();}, 4000);
}
function toggleSelectAll() {
  var boxes = document.querySelectorAll('.da-check');
  var anyUnchecked = Array.prototype.some.call(boxes, function(b){ return !b.checked; });
  boxes.forEach(function(b){ b.checked = anyUnchecked; });
}
async function restoreDeleted(assessmentId, name, btn) {
  if (!confirm('Restore the assessment for '+name+' to active?')) return;
  btn.disabled = true;
  try {
    var r = await fetch('/admin/assessments/'+assessmentId+'/restore', {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.ok) { var row = document.getElementById('da-row-'+assessmentId); if (row) row.remove(); showToast('Assessment restored.'); }
    else { alert(d.error || 'Restore failed'); btn.disabled = false; }
  } catch(e) { alert('Request failed'); btn.disabled = false; }
}
async function permanentDelete(assessmentId, name, btn) {
  if (!confirm('Permanently delete the assessment for '+name+'? This purges its PDFs from disk and cannot be undone.')) return;
  btn.disabled = true;
  try {
    var r = await fetch('/admin/assessments/'+assessmentId+'/permanent-delete', {method:'POST',headers:{Accept:'application/json'}});
    var d = await r.json();
    if (d.ok) { showToast('Assessment permanently deleted.'); setTimeout(function(){ location.reload(); }, 600); }
    else { alert(d.error || 'Permanent delete failed'); btn.disabled = false; }
  } catch(e) { alert('Request failed'); btn.disabled = false; }
}
// Bulk permanent delete: loops the single permanent-delete route client-side (D6).
// Only pending rows carry an enabled checkbox, so tombstones can never be re-deleted.
async function deleteSelected() {
  var ids = Array.prototype.map.call(document.querySelectorAll('.da-check:checked'), function(b){ return b.value; });
  if (ids.length === 0) { alert('No pending assessments selected.'); return; }
  if (!confirm('Permanently delete '+ids.length+' assessment(s)? This purges their PDFs from disk and cannot be undone.')) return;
  var btn = document.getElementById('da-delete-selected');
  btn.disabled = true; btn.textContent = 'Deleting…';
  var failures = 0;
  for (var i = 0; i < ids.length; i++) {
    try {
      var r = await fetch('/admin/assessments/'+ids[i]+'/permanent-delete', {method:'POST',headers:{Accept:'application/json'}});
      var d = await r.json();
      if (!d.ok) failures++;
    } catch(e) { failures++; }
  }
  showToast(failures === 0 ? 'Deleted '+ids.length+' assessment(s).' : (failures+' of '+ids.length+' failed.'));
  setTimeout(function(){ location.reload(); }, 700);
}
</script>
</body>
</html>`;
}

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
    firstName:          clientInfo.first_name,
    lastName:           clientInfo.last_name,
    email:              clientInfo.email,
    organization:       clientInfo.organization || '',
    coach:              clientInfo.coach_name,
    coach_email:        clientInfo.coach_email,
    coach_organization: clientInfo.coach_organization,
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
  // RETIRED (em_only migration, 2026-06-20). The old retry was mode-blind: it always re-fired
  // SM Call #2 (ignoring analysis_mode) and skipped applyCall2DeterministicStamps, so retried
  // results lacked the REDIRECT post-processing fixes. Superseded by the EM-only Retry button →
  // POST /admin/em-retry/:assessment_id. The route shell is kept (locked 410) as a safety net
  // against any unexpected or cached callers rather than deleted; requireAdmin stays in place.
  return res.status(410).json({ error: 'The Retry function has been retired. For stuck assessments, please use the EM Retry button.' });
});

// ── EM Retry — RETIRED (2026-06-20, Re-Run Analysis migration). EM Retry's production
//    behaviour (force production api_result, regen production PDFs, re-send client email) is
//    superseded by POST /admin/em-rerun/:assessment_id, the single production-recovery path
//    surfaced on the main dashboard + coaches accordion. The route shell is kept (locked 410)
//    as a safety net against cached/bookmarked callers; requireSuperAdmin stays in place. ──
app.post('/admin/em-retry/:assessment_id', requireSuperAdmin, async (req, res) => {
  return res.status(410).json({ error: 'EM Retry has been retired. Use Re-Run Analysis from the main dashboard to recover failed assessments.' });
});

// ── Re-Run Analysis (super-admin) — production recovery for a FAILED em_only assessment
//    (scores_snapshot + responses_snapshot present, api_result IS NULL). Re-fires the FULL EM
//    pipeline via runEmPrimary, then FORCE-writes the new result into production, syncs the
//    verdict columns (preserving completed_at), regenerates production PDFs, and re-sends
//    emails. Failure at or before runEmPrimary leaves the assessment completely untouched.
//    em_model resolves from app_settings (global) only — there is no per-assessment/client
//    em_model column; this matches every other EM path. Gated requireSuperAdmin. ──
app.post('/admin/em-rerun/:assessment_id', requireSuperAdmin, async (req, res) => {
  const assessmentId = parseInt(req.params.assessment_id, 10);
  if (!assessmentId || isNaN(assessmentId)) return res.status(400).json({ error: 'Invalid assessment id' });

  // Guards — fail fast, before any AI calls.
  const asmt = await db.getAssessmentById(assessmentId);
  if (!asmt) return res.status(404).json({ error: 'Assessment not found.' });
  if (!asmt.scores_snapshot) {
    return res.status(400).json({ error: 'No scores snapshot found. Client may need to retake the assessment.' });
  }
  if (!asmt.responses_snapshot) {
    return res.status(400).json({ error: 'No responses snapshot found for this assessment.' });
  }
  if (asmt.api_result) {
    return res.status(400).json({ error: 'API result already exists. Re-Run Analysis only recovers failed assessments — use Regen/Resend for a completed one.' });
  }

  const clientId = asmt.client_id;

  // Resolve analysis mode (assessment > client > global) and em_model (global only —
  // app_settings.em_model, DEFAULT 'sonnet'). Mode MUST resolve to em_only.
  let analysisMode = 'sm_only';
  let emModel = 'sonnet';
  try {
    const appSettings = await db.getAppSettings();
    emModel = (appSettings && appSettings.em_model) || 'sonnet';
    const aMode = await db.getAssessmentAnalysisMode(assessmentId);
    const cMode = clientId ? await db.getClientAnalysisMode(clientId) : null;
    analysisMode = experimentalAnalysis.resolveAnalysisMode({
      assessment: { analysis_mode: aMode }, client: { analysis_mode: cMode }, appSettings,
    }) || 'sm_only';
  } catch (e) {
    console.error('[admin/em-rerun] mode resolution failed:', e && e.message);
    return res.status(500).json({ error: 'Could not resolve analysis mode.' });
  }
  if (analysisMode !== 'em_only') {
    return res.status(409).json({ error: `Re-Run Analysis is only available for em_only assessments (resolved mode: ${analysisMode}).` });
  }

  // Capture the resolved model for the provenance meta block before any writes.
  const originalModel = emModel;

  const clientInfo = clientId ? await db.getClientWithCoach(clientId) : null;
  if (!clientInfo) return res.status(404).json({ error: 'Client not found.' });

  const intake = {
    firstName:          clientInfo.first_name,
    lastName:           clientInfo.last_name,
    email:              clientInfo.email,
    organization:       clientInfo.organization || '',
    coach:              clientInfo.coach_name,
    coach_email:        clientInfo.coach_email,
    coach_organization: clientInfo.coach_organization,
  };

  // Resolve the actor identity for rerun_by. coach_email is not stored on the session
  // (only coach_id/coach_name), so look it up; fall back to coach_name.
  let actorEmail = req.session.coach_name;
  try { const co = await db.getCoachById(req.session.coach_id); if (co && co.email) actorEmail = co.email; } catch (e) {}

  const scores = typeof asmt.scores_snapshot === 'string'
    ? JSON.parse(asmt.scores_snapshot)
    : asmt.scores_snapshot;
  let responsesSnapshot = asmt.responses_snapshot || null;
  if (typeof responsesSnapshot === 'string') {
    try { responsesSnapshot = JSON.parse(responsesSnapshot); } catch (e) { responsesSnapshot = null; }
  }

  // Re-fire EM Analysis + EM Report (runEmPrimary returns the adapted result, or null on ANY
  // failure — analysis, report, adapter, or dry-validate). No SM fallback: null → leave the
  // assessment completely untouched and surface an error (no writes have happened yet).
  let result;
  try {
    result = await runEmPrimary({ assessmentId, clientId, scores, intake, responsesSnapshot, emModel });
  } catch (err) {
    console.error(`[admin/em-rerun] #${assessmentId} EM-primary threw:`, err.message);
    return res.status(500).json({ error: `Re-Run Analysis failed: ${err.message}` });
  }
  if (!result) {
    console.warn(`[admin/em-rerun] #${assessmentId} EM-primary returned null — assessment left unchanged`);
    return res.status(502).json({ error: 'EM Analysis/Report did not produce a valid result. Assessment left unchanged.' });
  }

  // Deterministic hypothesis stamping + REDIRECT fixes (parity with runBackgroundJob step 2b).
  applyCall2DeterministicStamps(result, scores, 'em_only', assessmentId);

  // Inject rerun provenance into the api_result meta block.
  result.meta = result.meta || {};
  result.meta.rerun = true;
  result.meta.rerun_at = new Date().toISOString();
  result.meta.rerun_by = actorEmail;
  result.meta.original_model = originalModel;

  try {
    // Stash the prior api_result (null for a failed assessment — stashed explicitly for
    // schema consistency / forensic recoverability) BEFORE the force-write.
    await db.query(
      `UPDATE assessments SET pre_rerun_api_result = $1 WHERE id = $2`,
      [asmt.api_result == null ? null : (typeof asmt.api_result === 'string' ? asmt.api_result : JSON.stringify(asmt.api_result)), assessmentId]
    );
    // Force-write the new result (no IS NULL guard — the sanctioned overwrite path).
    await db.forceWriteApiResult(assessmentId, result);
    // Sync the denormalized verdict columns WITHOUT touching status/completed_at (Q2).
    await db.updateVerdictColumns(assessmentId, result);
    // Record rerun provenance on the row.
    await db.query(
      `UPDATE assessments SET rerun_at = $1, rerun_by = $2 WHERE id = $3`,
      [result.meta.rerun_at, actorEmail, assessmentId]
    );
    if (clientId) {
      await db.updateClientStatus(clientId, 'complete');
      await db.clearClientSessionState(clientId);
    }

    // Delete-first, then regenerate production PDFs. PDF failure does NOT unwind the
    // api_result write — the new result stands; the admin recovers PDFs via Regen/Resend.
    await db.deleteReportsByAssessmentId(assessmentId);
    const { clientPdfPath, coachPdfPath } = await generateReportPDFs(result, scores, intake, assessmentId);
    if (!clientPdfPath || !coachPdfPath) {
      console.error(`[admin/em-rerun] #${assessmentId} PDF generation incomplete — api_result written, reports missing`);
      return res.status(500).json({ error: 'Analysis updated but report generation failed. Use Regen and Resend to recover.' });
    }
    await db.query(
      `UPDATE assessments SET pdf_generated_at = NOW() WHERE id = $1`,
      [assessmentId]
    );

    // Send emails — wrapped independently so an email failure does not 500 an otherwise-successful rerun.
    try {
      await sendEmails(intake, result, clientPdfPath, coachPdfPath);
      await db.query(
        `UPDATE assessments SET email_sent_at = NOW() WHERE id = $1`,
        [assessmentId]
      );
    } catch (e) {
      console.error('[admin/em-rerun] email delivery failed — rerun succeeded but email not sent:', e.message);
      // Do not rethrow — the rerun itself succeeded; email failure is logged only.
    }

    db.logClientEvent({
      clientId, assessmentId,
      eventType: 'em_rerun_analysis',
      eventDescription: 'Re-Run Analysis completed by admin',
      actor: req.session.coach_name,
    });

    console.log(`[admin/em-rerun] #${assessmentId} succeeded (model=${emModel}, type=${result.hypothesis && result.hypothesis.confirmed_type})`);
    return res.json({
      success: true,
      assessment_id: assessmentId,
      model: emModel,
      confirmed_type: (result.hypothesis && result.hypothesis.confirmed_type) ?? null,
    });
  } catch (err) {
    console.error('[admin/em-rerun] post-result processing failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Result Email Resend (super admin or coach-scoped) ────────────────────────

app.post('/admin/resend/:client_id', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const ownerCoachId = await db.getClientCoachId(clientId);
  const isSuperAdmin = auth.hasRole(req, 'super_admin');
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
    firstName:          clientInfo.first_name,
    lastName:           clientInfo.last_name,
    email:              clientInfo.email,
    organization:       clientInfo.organization || '',
    coach:              clientInfo.coach_name,
    coach_email:        clientInfo.coach_email,
    coach_organization: clientInfo.coach_organization,
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
    // PR B: lifecycle audit — report delivered via admin resend.
    db.logClientEvent({
      clientId, assessmentId: payload.assessment_id,
      eventType: 'report_delivered',
      eventDescription: 'Report delivered (admin resend)',
      actor: req.session.coach_name,
    });
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
    // Super-admins see all three states (active / pending / tombstone) in the
    // accordion; plain admins and coaches never receive tombstone data (D1).
    const includeDeleted = auth.hasRole(req, 'super_admin');
    const rows = await db.getAdminRowsByCoach(coachId, { includeDeleted });
    // Tag em_rerun_eligible so the client-side accordion can gate the Re-Run Analysis button.
    try { await annotateEmRerunEligibility(rows); } catch (e) { console.error('[admin/coaches/clients] em-rerun annotate failed:', e.message); }
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

  // IAA Phase D: role/account data for the modal's Roles & Access section. is_self is
  // computed here (rather than injecting the current user id client-side) so the modal
  // can disable self-revoke/self-ban controls; the server still enforces both guards.
  let roles = [];
  let userIsActive = true;
  let isSelf = false;
  if (coach.user_id) {
    roles = await db.getUserRolesWithMeta(coach.user_id);
    const u = await db.getUserById(coach.user_id);
    userIsActive = u ? u.is_active !== false : true;
    isSelf = coach.user_id === req.session.user_id;
  }
  return res.json({
    coach,
    history,
    user_id: coach.user_id || null,
    roles,
    user_is_active: userIsActive,
    is_self: isSelf,
  });
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

  const { name, email, organization, note } = req.body;

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

  const after = { name: name.trim(), email: emailTrimmed, organization: organization && organization.trim() ? organization.trim() : null };
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

// ═══ IAA v1.2 — Phase D: embargo management page ════════════════════════════════
function renderEmbargoPage(embargoList, flashMsg, errorMsg) {
  const fmt = (ts) => { try { return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return '—'; } };
  const rows = (embargoList || []).map((e) => {
    const typeBadge = e.match_type === 'domain'
      ? '<span style="background:#ede9fe;color:#7c3aed;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:600;">Domain</span>'
      : '<span style="background:#e6f7ee;color:#1a7a4a;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:600;">Exact</span>';
    return `<tr>
      <td style="font-family:monospace;font-size:12px;">${esc(e.value)}</td>
      <td>${typeBadge}</td>
      <td style="color:#7A96A6;font-size:12px;">${e.reason ? esc(e.reason) : '—'}</td>
      <td style="color:#7A96A6;font-size:12px;">${e.embargoed_by_email ? esc(e.embargoed_by_email) : '—'}</td>
      <td style="color:#7A96A6;font-size:12px;">${fmt(e.created_at)}</td>
      <td>
        <form method="POST" action="/admin/embargo/${e.id}/remove" style="display:inline;" onsubmit="return confirm('Remove ${esc(e.value)} from the embargo list?');">
          <button type="submit" style="background:none;border:none;cursor:pointer;font-size:12px;color:#c0392b;text-decoration:underline;padding:0;">Remove</button>
        </form>
      </td>
    </tr>`;
  }).join('\n');
  const body = (embargoList && embargoList.length)
    ? rows
    : '<tr><td colspan="6" style="text-align:center;padding:40px;color:#7A96A6;">No embargo entries.</td></tr>';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hive Admin — Embargo List</title>
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
  .container { max-width: 1000px; margin: 0 auto; padding: 32px 24px; }
  .card { background: #fff; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); overflow: hidden; margin-bottom: 32px; }
  .card-header { padding: 18px 20px; border-bottom: 1px solid #EFE8E0; font-size: 13px; font-weight: 700; color: #1A2B33; text-transform: uppercase; letter-spacing: 0.08em; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { background: #00b1d7; color: #fff; text-align: left; padding: 12px 14px; font-size: 11px; letter-spacing: 0.07em; text-transform: uppercase; font-weight: 700; }
  tbody tr { border-bottom: 1px solid #EFE8E0; }
  tbody tr:last-child { border-bottom: none; }
  tbody td { padding: 11px 14px; vertical-align: middle; }
  .add-form { padding: 20px; display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: end; }
  .add-form label { display: block; font-size: 11px; color: #7A96A6; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; margin-bottom: 5px; }
  .add-form input { width: 100%; padding: 9px 11px; border: 1px solid #D0DCE4; border-radius: 4px; font-family: Georgia, serif; font-size: 13px; color: #1A2B33; outline: none; }
  .add-form input:focus { border-color: #00b1d7; }
  .btn-add { background: #00b1d7; color: #fff; border: none; border-radius: 4px; font-family: Georgia, serif; font-size: 13px; font-weight: 700; padding: 10px 18px; cursor: pointer; white-space: nowrap; }
  .btn-add:hover { background: #009bbf; }
  .help { padding: 0 20px 20px; font-size: 12px; color: #7A96A6; }
</style>
</head>
<body>
<div class="top-bar">
  <div>
    <div><span>Hive Enneagram Type Tool</span></div>
    <h1>Embargo List</h1>
  </div>
  <div style="display:flex;align-items:center;gap:16px;">
    <a href="/admin" class="nav-link">← Dashboard</a>
    <span class="nav-sep">|</span>
    <a href="/admin/logout" class="nav-link">Sign out</a>
  </div>
</div>
${flashMsg ? `<div class="flash-success">${esc(flashMsg)}</div>` : ''}
${errorMsg ? `<div class="flash-error">${esc(errorMsg)}</div>` : ''}
<div class="container">
  <div class="card">
    <div class="card-header">Embargoed Identities</div>
    <table>
      <thead>
        <tr><th>Value</th><th>Type</th><th>Reason</th><th>Added by</th><th>Date</th><th>Action</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-header">Add to Embargo List</div>
    <form method="POST" action="/admin/embargo" class="add-form">
      <div>
        <label for="embargo_value">Value</label>
        <input type="text" id="embargo_value" name="value" required placeholder="email@example.com or @domain.com">
      </div>
      <div>
        <label for="embargo_reason">Reason</label>
        <input type="text" id="embargo_reason" name="reason" placeholder="Reason (optional)">
      </div>
      <div>
        <button type="submit" class="btn-add">Add to Embargo List</button>
      </div>
    </form>
    <p class="help">Enter an email address for an exact match, or a domain starting with @ (e.g. @spam.com) to block all addresses from that domain.</p>
  </div>
</div>
</body>
</html>`;
}

// ═══ IAA v1.2 — Phase D: role management + embargo routes (all super-admin) ══════

// Current roles + account status for a user (feeds the coach-profile modal).
app.get('/admin/users/:user_id/roles', requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.user_id, 10);
  if (!userId || isNaN(userId)) return res.status(400).json({ ok: false, error: 'Invalid user ID' });
  const user = await db.getUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  const roles = await db.getUserRolesWithMeta(userId);
  return res.json({ user: { id: user.id, email: user.email, is_active: user.is_active }, roles });
});

app.post('/admin/users/:user_id/roles/grant', requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.user_id, 10);
  if (!userId || isNaN(userId)) return res.status(400).json({ ok: false, error: 'Invalid user ID' });
  const role = (req.body && req.body.role) || '';
  if (!['client', 'coach', 'admin', 'super_admin'].includes(role)) {
    return res.status(400).json({ ok: false, error: 'Invalid role.' });
  }
  const result = await auth.grantRole(userId, role, req.session.user_id, req);
  return res.json(result);
});

app.post('/admin/users/:user_id/roles/revoke', requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.user_id, 10);
  if (!userId || isNaN(userId)) return res.status(400).json({ ok: false, error: 'Invalid user ID' });
  const role = (req.body && req.body.role) || '';
  if (!['client', 'coach', 'admin', 'super_admin'].includes(role)) {
    return res.status(400).json({ ok: false, error: 'Invalid role.' });
  }
  const result = await auth.revokeRole(userId, role, req.session.user_id, req);
  return res.json(result);
});

app.post('/admin/users/:user_id/ban', requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.user_id, 10);
  if (!userId || isNaN(userId)) return res.status(400).json({ ok: false, error: 'Invalid user ID' });
  const result = await auth.banUser(userId, req.session.user_id, req);
  return res.json(result);
});

app.post('/admin/users/:user_id/unban', requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.user_id, 10);
  if (!userId || isNaN(userId)) return res.status(400).json({ ok: false, error: 'Invalid user ID' });
  const result = await auth.unbanUser(userId, req.session.user_id, req);
  return res.json(result);
});

app.get('/admin/embargo', requireSuperAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  let flashMsg = null;
  if (req.query.flash === 'embargo_added')        flashMsg = 'Embargo entry added.';
  else if (req.query.flash === 'embargo_removed') flashMsg = 'Embargo entry removed.';
  const list = await db.getEmbargoList().catch(() => []);
  res.send(renderEmbargoPage(list, flashMsg, null));
});

app.post('/admin/embargo', requireSuperAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const { value, reason } = req.body || {};
  const result = await auth.addEmbargoEntry(value || '', reason || null, req.session.user_id, req);
  if (result.ok) return res.redirect('/admin/embargo?flash=embargo_added');
  const list = await db.getEmbargoList().catch(() => []);
  return res.send(renderEmbargoPage(list, null, result.error));
});

app.post('/admin/embargo/:id/remove', requireSuperAdmin, async (req, res) => {
  const embargoId = parseInt(req.params.id, 10);
  if (embargoId && !isNaN(embargoId)) {
    await auth.removeEmbargoEntry(embargoId, req.session.user_id, req);
  }
  return res.redirect('/admin/embargo?flash=embargo_removed');
});

app.get('/admin/clients/:client_id/profile', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const ownerCoachId = await db.getClientCoachId(clientId);
  const isSuperAdmin = auth.hasRole(req, 'super_admin');
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
    `SELECT id AS assessment_id, confirmed_type, confirmed_instinct, confidence_level, status,
            dominant_instinct_hypothesis,
            coach_confirmed_type, coach_confirmed_instinct, type_clarification_notes, is_beta
     FROM assessments WHERE client_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clientId]
  );
  const assessment = asmR && asmR.rows.length > 0 ? asmR.rows[0] : null;

  const history = await db.getEditHistory('client', clientId);
  // PR B: lifecycle audit trail for the History tab. Super-admin only — defense-in-depth:
  // regular coaches never receive the data even though the route is admin-session gated.
  const clientHistory = auth.hasRole(req, 'super_admin')
    ? await db.getClientHistory(clientId)
    : [];
  return res.json({ client, assessment, history, clientHistory });
});

app.get('/admin/clients/:client_id/edit-history', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const ownerCoachId = await db.getClientCoachId(clientId);
  const isSuperAdmin = auth.hasRole(req, 'super_admin');
  if (!isSuperAdmin && ownerCoachId !== req.session.coach_id) return res.status(403).json({ error: 'Forbidden' });

  const history = await db.getEditHistory('client', clientId);
  return res.json(history);
});

app.post('/admin/clients/:client_id/update', requireAdminSession, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const ownerCoachId = await db.getClientCoachId(clientId);
  const isSuperAdmin = auth.hasRole(req, 'super_admin');
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

// Coach Debrief Confirmation — coach-verified type/instinct recorded post-debrief.
// Mirrors the auth/owner-check pattern of POST /admin/clients/:client_id/update.
app.post('/admin/assessments/:assessment_id/coach-debrief', requireAdminSession, async (req, res) => {
  const assessmentId = parseInt(req.params.assessment_id, 10);
  if (!assessmentId || isNaN(assessmentId)) return res.status(400).json({ error: 'Invalid assessment ID' });

  const ownerCoachId = await db.getAssessmentOwnerCoachId(assessmentId);
  if (ownerCoachId === null) return res.status(404).json({ error: 'Assessment not found.' });
  const isSuperAdmin = auth.hasRole(req, 'super_admin');
  if (!isSuperAdmin && ownerCoachId !== req.session.coach_id) return res.status(403).json({ error: 'Forbidden' });

  const body = req.body || {};

  // coach_confirmed_type: null/''/absent → NULL; integer 1–9 → store; else 400.
  let coachType = null;
  const rawType = body.coach_confirmed_type;
  if (rawType !== null && rawType !== undefined && String(rawType).trim() !== '') {
    const n = Number(rawType);
    if (!Number.isInteger(n) || n < 1 || n > 9) {
      return res.status(400).json({ error: 'Confirmed type must be 1–9 or blank.' });
    }
    coachType = n;
  }

  // coach_confirmed_instinct: null/''/absent → NULL; SP/SO/SX (case-insensitive) → uppercased; else 400.
  let coachInstinct = null;
  const rawInstinct = body.coach_confirmed_instinct;
  if (rawInstinct !== null && rawInstinct !== undefined && String(rawInstinct).trim() !== '') {
    const v = String(rawInstinct).trim().toUpperCase();
    if (!['SP', 'SO', 'SX'].includes(v)) {
      return res.status(400).json({ error: 'Instinct must be SP, SO, or SX.' });
    }
    coachInstinct = v;
  }

  // type_clarification_notes: trim; empty → NULL.
  let notes = null;
  const rawNotes = body.type_clarification_notes;
  if (rawNotes !== null && rawNotes !== undefined && String(rawNotes).trim() !== '') {
    notes = String(rawNotes).trim();
  }

  const updated = await db.updateCoachDebrief(assessmentId, {
    coach_confirmed_type:     coachType,
    coach_confirmed_instinct: coachInstinct,
    type_clarification_notes: notes,
  });
  if (!updated) return res.status(404).json({ error: 'Assessment not found.' });

  console.log(`[admin/assessments/coach-debrief] updated assessment #${assessmentId}: type=${coachType}, instinct=${coachInstinct}`);
  return res.json({ success: true, updated });
});

// Beta-tester flag toggle — super-admin only (requireSuperAdmin is the strongest
// gate, so no per-coach owner check is needed). Sets clients.is_beta; future
// assessments inherit it at creation (see db.createAssessment).
app.post('/admin/clients/:client_id/beta-toggle', requireSuperAdmin, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) return res.status(400).json({ error: 'Invalid client ID' });

  const body = req.body || {};
  const isBeta = body.isBeta === true || body.isBeta === 'true';

  await db.setClientBeta(clientId, isBeta);
  console.log(`[admin/clients/beta-toggle] client #${clientId} is_beta=${isBeta}`);
  return res.json({ ok: true });
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
    const appUrl    = process.env.RAILWAY_PUBLIC_URL || 'https://enneagram.hiveleadership.com';
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

// =================== ABANDONMENT REMINDER POLLER ===================

async function runReminderPoller() {
  if (!process.env.SENDGRID_API_KEY) return;
  const appUrl = process.env.RAILWAY_PUBLIC_URL || 'https://enneagram.hiveleadership.com';
  let clients;
  try {
    clients = await db.getAbandonedClients();
  } catch (e) {
    console.error('[reminder-poller] failed to query abandoned clients:', e.message);
    return;
  }

  for (const row of clients) {
    try {
      const usedAt = new Date(row.used_at);
      const now = new Date();
      const elapsedHours = (now - usedAt) / (1000 * 60 * 60);
      const reminderSent = row.reminder_sent_at || {};
      const expiryDate = new Date(row.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const inviteLink = `${appUrl}/assessment/${row.token}`;

      // Determine coach first name
      const coachFirstName = (row.coach_name || '').split(' ')[0] || 'Your coach';

      const reminderKeys = [
        { key: '72h', minHours: 72 },
        { key: '120h', minHours: 120 },
      ];

      for (const { key, minHours } of reminderKeys) {
        if (elapsedHours >= minHours && !reminderSent[key]) {
          const body = [
            `Hi ${row.first_name},`,
            ``,
            `You started your Enneagram assessment with ${coachFirstName} but haven't finished yet. It only takes a few more minutes to complete.`,
            ``,
            `Pick up where you left off:`,
            inviteLink,
            ``,
            `Your link is valid until ${expiryDate}.`,
            ``,
            coachFirstName,
          ].join('\n');

          try {
            await sgMail.send({
              to:      row.email,
              from:    { name: coachFirstName, email: row.coach_email || process.env.SENDGRID_FROM_EMAIL },
              subject: 'A gentle nudge — your Enneagram assessment is waiting',
              text:    body,
            });
            console.log(`[reminder-poller] sent ${key} reminder to client #${row.client_id} (${row.email})`);
          } catch (emailErr) {
            console.error(`[reminder-poller] email send failed for client #${row.client_id}:`, emailErr.message);
            continue;
          }

          await db.recordReminderSent(row.client_id, key, now.toISOString());
        }
      }
    } catch (clientErr) {
      console.error(`[reminder-poller] error processing client #${row.client_id}:`, clientErr.message);
    }
  }
}

// Run every 30 minutes; first tick after 30s to avoid hammering DB at cold start
setTimeout(() => {
  runReminderPoller();
  setInterval(runReminderPoller, 30 * 60 * 1000);
}, 30 * 1000);

// =================== START ===================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Hive Typing Engine → http://localhost:${PORT}`)
);
