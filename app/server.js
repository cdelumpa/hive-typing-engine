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
const { buildCoachPdfOptions, HIVE_LOGO_SVG, buildClientReportHTML, betaReportBodyHtml } = require('./renderer');
const { renderClientReport, renderCoachReport } = require('./render_report');
const { generateBetaReport, buildBetaData, BETA_QUESTION_TEXT } = require('./generate_report');
const reportPrep = require('./report_prep');          // buildClientModel — for /admin/content preview
const { TYPE_NAMES: CMS_TYPE_NAMES } = require('./type_meta');  // canonical type names for preview wing/line remap (distinct from the dashboard's local TYPE_NAMES)
const db = require('./db');
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
// The client SPA is served to token-link visitors who carry no basic-auth
// credentials (the /assessment/ HTML itself is already exempt below). index.html
// pulls these assets via <link>/<script> with root-absolute paths, so they must
// bypass basic auth too — otherwise a fresh, credential-less token visit triggers
// the basic-auth dialog on each asset load (regression from PR2's move to
// SPA-served token entry). These are pure client assets; admin, API, reports, the
// '/' entry, and the data layer all stay gated.
const SPA_ASSET_PATHS = new Set([
  '/styles.css', '/state.js', '/ui.js', '/assessment.js', '/app.js',
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

// Super-admin guard — requires is_super_admin flag in session (a strict subset of
// admins; only cai@/monique@ are seeded super). Used for the /admin/content editor.
// Existing sessions gain the flag on next login (same pattern as coach_is_admin).
function requireSuperAdmin(req, res, next) {
  if (!req.session || !req.session.coach_id) return res.redirect('/admin/login');
  if (req.session.coach_is_super_admin !== true) {
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
Judge a counter-type from the slider profile, the dominant instinct, and the open-text language — there is no mechanical lookup.
  SP + Type 3 → Anti-Vanity: humble, hardworking, downplays recognition. Looks like 1.
  SX + Type 6 → Counterphobic: confrontational, risk-taking. Looks like 8.
  SP + Type 4 → Tenacity: driven, resilient, refuses inner defeat. Looks like 3.
  SX + Type 1 → Zeal: intense, crusading, passionate. Looks like 8.
  SO + Type 7 → Sacrifice: shares own joy outward, service-oriented. Looks like 2.

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
confirmed_type is normally the leading_candidate. It changes ONLY on a REDIRECT, where the Stage 4 evidence favored the alternate: in that case set confirmed_type to the alternate_candidate and set redirect_from_type to the original leading_candidate. Otherwise redirect_from_type is null. Set confirmed_type_name to the canonical name of confirmed_type. Set hypothesis_validated true when the leading hypothesis cohered and held, false when it did not (a REDIRECT, or a coherence read that undercut it). Set dominant_instinct_hypothesis from the three-instinct profile and the Call #1 dominant instinct; if the top two instincts are within a point or two, do not force a winner — name your best read and raise low_instinct_confidence. Record the holistic read in holistic_analysis (stage0_coherence, cross_stage_consistency, instinct_coherence, alternative_type_signal, confidence_adjustment), each citing specific evidence.

TASK 2 — Identify and Describe Flags
The flag enum is CLOSED — use ONLY the flag_type values below and never invent a flag type. Note each that is present and describe it specifically, never generically. Quote the client's actual words where relevant. Only flag what is genuinely present; do not manufacture flags for a clean result.

FLAG TYPES:

counter_type — The instinct + type combination produces a known counter-type. Describe which combination, the expected presentation, and how the open-text language confirms it.

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

For pushes_back, include these two fields separately:
  alt_type_name: the alternate_candidate named as a string (e.g. "Type 1 — The Improver")
  key_distinction: one sentence stating the key distinguishing question between the confirmed type and the alternate_candidate

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

  // Send both emails.
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

async function runBackgroundJob(systemPrompt, userMessage, intake, scores, assessmentId, clientId, responsesSnapshot) {
  // 1. Persist scores_snapshot immediately — before the API call — so the
  //    assessment is recoverable even if Claude fails.
  if (assessmentId) {
    await db.query(
      `UPDATE assessments SET scores_snapshot = $1 WHERE id = $2`,
      [JSON.stringify(scores), assessmentId]
    );
  }

  // 1b. Persist responses_snapshot to the clients table so the raw answers
  //     across every stage are recoverable for debugging and engine calibration.
  if (clientId && responsesSnapshot) {
    try {
      await db.updateClientResponsesSnapshot(clientId, responsesSnapshot);
    } catch (e) {
      console.error('[submit] responses_snapshot DB write failed:', e.message);
    }
  }

  // 2. Call Claude API with retries
  let result;
  try {
    result = await callClaudeWithRetry(systemPrompt, userMessage);
  } catch (err) {
    await db.failAssessment(assessmentId);
    // Revert client status so the invite link stops showing the processing
    // gate. session_state is already null, so the in_progress branch will
    // render the "contact your coach" dead-end message.
    if (clientId) await db.updateClientStatus(clientId, 'in_progress');
    await sendErrorNotification(intake, err);
    return;
  }

  // 2b. Stamp the deterministic hypothesis fields onto the verdict (§9.1, §10.3).
  //     The slider profile and the AI Call #1 result are ground truth; the AI does
  //     not recompute or restate them. callAPI sent them on the scores payload, so
  //     we overwrite the model's echoes with the canonical values. Only the judgment
  //     fields (confirmed_type, confirmed_type_name, confidence_level,
  //     dominant_instinct_hypothesis, redirect_from_type, hypothesis_validated) are
  //     left to the AI.
  if (result && result.hypothesis) {
    const h = result.hypothesis;
    const c1 = scores.call1Result || {};
    if (typeof scores.ranking_override === 'boolean') h.ranking_override = scores.ranking_override;
    if (c1.leading_candidate != null)   h.leading_candidate   = c1.leading_candidate;
    if (c1.alternate_candidate != null) h.alternate_candidate = c1.alternate_candidate;
    if (c1.third_candidate != null)     h.third_candidate     = c1.third_candidate;
    if (Array.isArray(c1.ranking))      h.call1_ranking       = c1.ranking;
    if (scores.typeProfile)             h.type_score_profile     = scores.typeProfile;
    if (scores.instinctProfile)         h.instinct_score_profile = scores.instinctProfile;
    if (scores.stage4 && scores.stage4.outcome) h.stage4_outcome  = scores.stage4.outcome;
    // Step 7: stamp the deterministic Stage-1 coherence gap (tight/medium/wide) so the
    // prep layer can derive near_tie = (gap === 'tight'). Engine-set; the AI never emits it.
    if (scores.gap != null)             h.gap                    = scores.gap;
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
  if (clientId) {
    await db.updateClientStatus(clientId, 'complete');
    await db.clearClientSessionState(clientId);
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
  try {
    if (!resolvedClientId) {
      const coachId = await db.findOrCreateCoach(intake?.coach || 'Cai Delumpa');
      resolvedClientId = await db.createClient(intake || {}, coachId);
    }
    // Retake linkage: if this client already has an assessment, the row we're about
    // to create is a retake — point retake_of_assessment_id at the most recent prior
    // assessment. First-time clients have no prior row, so this stays null. (The retake
    // flow is the only path that reopens a completed client, so "has a prior" == retake.)
    const priorAssessmentId = resolvedClientId ? await db.getLatestAssessmentId(resolvedClientId) : null;
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
      await runBackgroundJob(systemPrompt, userMessage, intake || {}, scores || {}, assessmentId, resolvedClientId, responsesSnapshot || null);
    } catch (e) {
      console.error('[submit] unhandled background job error:', e.message);
    }
  })();
});

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
    });
    console.log(`[beta-feedback] stored for assessment #${assessmentId} (client #${clientId})`);
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
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: [{ type: 'text', text: CALL1_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
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
      console.log(`[call1] success — client #${client_id} leading=${parsed.leading_candidate} alt=${parsed.alternate_candidate} gap=${parsed.gap} mode=${parsed.stage3_mode} ct=${parsed.ct_pair} inst=${parsed.dominant_instinct}`);
    } else {
      console.warn('[call1] parsed payload missing 9-entry ranking array');
    }
  } catch (err) {
    console.error('[call1] failed:', err.message);
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
  h+='<div id="coach-debrief-section">'+_coachDebriefReadonlyHTML(data)+'</div>';
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
    req.session.coach_id             = coach.id;
    req.session.coach_name           = coach.name;
    req.session.coach_is_admin       = coach.is_admin === true;
    req.session.coach_is_super_admin = coach.is_super_admin === true;
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
    const coachName = clientInfo ? clientInfo.coach_name : req.session.coach_name;

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.retakeTransaction(clientId, token, expiresAt);
    await sendInviteEmail({ first_name: client.first_name, last_name: client.last_name, email: client.email }, token, coachName);

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
          firstName:    tokenRow.first_name,
          lastName:     tokenRow.last_name,
          email:        tokenRow.email,
          organization: tokenRow.organization || '',
          coach:        tokenRow.coach_name,
          client_id:    tokenRow.client_id,
          token:        req.params.token,
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
      firstName:    tokenRow.first_name,
      lastName:     tokenRow.last_name,
      email:        tokenRow.email,
      organization: tokenRow.organization || '',
      coach:        tokenRow.coach_name,
      client_id:    tokenRow.client_id,
      token:        req.params.token,
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

function renderCoachesPage(coaches, errorMsg, flashMsg, betaModeEnabled = false) {
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
<div id="beta-flash" style="display:none;padding:12px 20px;font-size:13px;border-left:4px solid #1a7a4a;background:#e6f7ee;color:#1a7a4a;"></div>
<div class="container">
  <div class="card" style="margin-bottom:24px;border-left:4px solid ${betaModeEnabled ? '#7c3aed' : '#aaa'};">
    <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
      <span>Beta Mode</span>
      <span id="beta-mode-badge" style="background:${betaModeEnabled ? '#ede9fe' : '#f4f4f4'};color:${betaModeEnabled ? '#7c3aed' : '#666'};padding:3px 10px;border-radius:3px;font-size:12px;font-weight:700;letter-spacing:0.05em;">
        ${betaModeEnabled ? 'ON' : 'OFF'}
      </span>
    </div>
    <div style="padding:16px 20px;display:flex;align-items:center;gap:16px;">
      <p style="margin:0;font-size:13px;color:#1A2B33;">
        When Beta Mode is <strong>ON</strong>, super-admins can generate <code>.docx</code> beta review reports for completed clients directly from the Admin Dashboard.
      </p>
      <button id="beta-toggle-btn"
        onclick="toggleBetaMode(${betaModeEnabled ? 'false' : 'true'})"
        style="flex-shrink:0;background:${betaModeEnabled ? '#c0392b' : '#7c3aed'};color:#fff;border:none;border-radius:4px;font-family:Georgia,serif;font-size:13px;font-weight:700;padding:9px 20px;cursor:pointer;white-space:nowrap;">
        ${betaModeEnabled ? 'Turn Off' : 'Turn On'}
      </button>
    </div>
  </div>
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
var _accordionCache = {};
var _openCoachId = null;
// §9.3 assessment timing: per-row timing payloads (keyed by clientId), populated as
// the accordion renders, read by the timing modal. Inline SVG clock (no Tabler dep).
var _timingData = {};
var CLOCK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="display:inline-block;vertical-align:middle;"><circle cx="12" cy="12" r="8.5" stroke="#00B2D9" stroke-width="2"/><path d="M12 7.5V12l3 2" stroke="#00B2D9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var _typeNames = ${JSON.stringify({1:'The Improver',2:'The Giver',3:'The Performer',4:'The Idealist',5:'The Observer',6:'The Questioner',7:'The Enthusiast',8:'The Protector',9:'The Peacemaker'})};

async function toggleBetaMode(enable) {
  var btn = document.getElementById('beta-toggle-btn');
  var badge = document.getElementById('beta-mode-badge');
  var card = btn.closest('.card');
  var flashEl = document.getElementById('beta-flash');
  var orig = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  try {
    var r = await fetch('/admin/settings/beta-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ enabled: enable }),
    });
    var d = await r.json();
    if (d.success) {
      var on = d.beta_mode_enabled;
      badge.textContent = on ? 'ON' : 'OFF';
      badge.style.background = on ? '#ede9fe' : '#f4f4f4';
      badge.style.color = on ? '#7c3aed' : '#666';
      btn.textContent = on ? 'Turn Off' : 'Turn On';
      btn.style.background = on ? '#c0392b' : '#7c3aed';
      btn.onclick = function(){ toggleBetaMode(!on); };
      card.style.borderLeftColor = on ? '#7c3aed' : '#aaa';
      flashEl.textContent = 'Beta mode ' + (on ? 'enabled' : 'disabled') + '.';
      flashEl.style.background = '#e6f7ee'; flashEl.style.color = '#1a7a4a';
      flashEl.style.borderLeftColor = '#1a7a4a'; flashEl.style.display = '';
      setTimeout(function(){ flashEl.style.display = 'none'; }, 4000);
    } else {
      alert(d.error || 'Failed to update beta mode');
      btn.textContent = orig;
    }
  } catch(e) {
    alert('Request failed');
    btn.textContent = orig;
  }
  btn.disabled = false;
}

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
${sharedModalHTML(true, true)}
</body>
</html>`;
}

// =================== /admin/content — GLOBAL STATIC EDITOR (super-admin) ===================
// Scoped to the 6 static.* keys from content_library.json. Subtype/type content and
// prompt editing are later PRs. Overrides are keyed "static.<field>" (matching PR2's
// resolveLibObject('static', ...)); the value column stores JSON.stringify(value).

const CMS_STATIC_FIELDS = ['welcome', 'primer', 'wings_primer', 'lines_primer', 'instinct_primer', 'instinct_definitions'];
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
    ${req.session.coach_is_super_admin ? `<a href="/admin/beta-review" class="nav-link">Beta Review</a><span class="nav-sep">|</span>` : ''}
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
    ${req.session.coach_is_super_admin ? `<a href="/admin/beta-review" class="nav-link">Beta Review</a><span class="nav-sep">|</span>` : ''}
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
    ${req.session.coach_is_super_admin ? `<a href="/admin/beta-review" class="nav-link">Beta Review</a><span class="nav-sep">|</span>` : ''}
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

  let html = `<div class="br-tab-section">
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
  try {
    respondents = await db.getBetaReviewRespondents();
  } catch (e) {
    console.error('[beta-review] respondent fetch failed:', e.message);
  }
  res.send(renderBetaReviewPage(req, respondents));
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

// Re-analyze scaffold — PR-F will run the Claude synthesis across all beta_feedback
// rows and persist the result. For now this just confirms the route is wired.
app.post('/admin/beta-review/analyze', requireSuperAdmin, async (req, res) => {
  console.log('[beta-review/analyze] stub invoked (PR-F will implement the Claude synthesis)');
  return res.json({ ok: true, stub: true });
});

function renderBetaReviewPage(req, respondents) {
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
    const nameCell = submitted
      ? `<a href="#" class="br-name-link" onclick="openBetaTester(${r.client_id});return false;">${esc(name)}</a>`
      : `<span class="br-name-pending">${esc(name)}</span>`;
    return `<tr>
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
  .btn-reanalyze { background: #00b1d7; color: #fff; border: none; border-radius: 4px; font-family: Georgia, serif; font-size: 13px; font-weight: 700; padding: 9px 16px; cursor: pointer; }
  .btn-reanalyze:hover { background: #009bbf; }
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
      <button class="btn-reanalyze" onclick="reanalyzeBeta(this)">Re-analyze</button>
    </div>
    ${(respondents && respondents.length) ? `<table class="br-list">
      <thead><tr><th>Tester</th><th>Engine type</th><th>Subtype</th><th>Feedback date</th><th>Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>` : emptyState}
  </div>
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
async function reanalyzeBeta(btn){
  var orig=btn.textContent; btn.disabled=true; btn.textContent='Analyzing…';
  try{
    var r=await fetch('/admin/beta-review/analyze',{method:'POST',headers:{Accept:'application/json'}});
    var d=await r.json();
    if(d.ok && d.stub){ _brToast('Re-analyze is coming in a future update.'); }
    else if(d.ok){ _brToast('Analysis complete.'); }
    else { _brToast('Analysis failed.'); }
  }catch(e){ _brToast('Request failed.'); }
  btn.disabled=false; btn.textContent=orig;
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

  const betaModeEnabled = await db.getBetaModeEnabled().catch(() => false);
  res.send(renderCoachesPage(coaches, null, flashMsg, betaModeEnabled));
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

// ── Beta Report generation ────────────────────────────────────────────────────

app.post('/admin/beta-report/:client_id', requireAdmin, async (req, res) => {
  const clientId = parseInt(req.params.client_id, 10);
  if (!clientId || isNaN(clientId)) {
    return res.status(400).json({ success: false, error: 'Invalid client ID' });
  }

  const betaModeEnabled = await db.getBetaModeEnabled().catch(() => false);
  if (!betaModeEnabled) {
    return res.status(403).json({ success: false, error: 'Beta mode is currently disabled. Enable it on the Manage Coaches page.' });
  }

  try {
    const result = await generateBetaReport(clientId, {
      queryFn:    db.query.bind(db),
      reportsDir: REPORTS_DIR,
      force:      true,
    });
    return res.json({ success: true, filename: result.filename, generated_at: result.generated_at });
  } catch (e) {
    console.error(`[admin/beta-report] error for client #${clientId}:`, e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ── Beta mode settings ────────────────────────────────────────────────────────

app.post('/admin/settings/beta-mode', requireAdmin, async (req, res) => {
  const enabled = req.body.enabled === true || req.body.enabled === 'true';
  try {
    await db.setBetaModeEnabled(enabled);
    console.log(`[admin/settings] beta_mode_enabled set to ${enabled} by coach #${req.session.coach_id}`);
    return res.json({ success: true, beta_mode_enabled: enabled });
  } catch (e) {
    console.error('[admin/settings/beta-mode] error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
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
  try {
    // Super-admins see every client across all coaches; other coaches see only their own.
    rows = req.session.coach_is_super_admin === true
      ? await db.getAllAdminRows()
      : await db.getAdminRowsByCoach(req.session.coach_id);
  } catch (e) { console.error('[admin] query error:', e.message); }

  const isAdmin = req.session.coach_is_admin === true;
  const betaModeEnabled = isAdmin ? await db.getBetaModeEnabled().catch(() => false) : false;

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
      clientExists ? `<a href="/reports/token/${encodeURIComponent(clientPdfBase)}" title="Client PDF" style="display:block;color:#00b1d7;text-decoration:none;white-space:nowrap;">&#128196; Client</a>` : '',
      coachExists  ? `<a href="/reports/token/${encodeURIComponent(coachPdfBase)}"  title="Coach PDF"  style="display:block;color:#f58527;text-decoration:none;white-space:nowrap;">&#128196; Coach</a>` : '',
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

    // Retake (super-admin only, completed clients only): issue a fresh assessment
    // while preserving the prior results. Hidden entirely for non-super-admins.
    // Gated on client status (not assessment status): issuing a retake resets
    // client status to 'not_started', so this button hands off to "Resend invite"
    // until the new assessment completes. Also gated on is_latest_complete so that
    // a client with multiple complete rows (original + retake) shows exactly one
    // Retake button — on the most recent complete assessment.
    const retakeAction = (req.session.coach_is_super_admin === true && clientStatus === 'complete' && r.is_latest_complete)
      ? `<button onclick="adminRetake(${clientId},'${rawName.replace(/'/g, "\\'")}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#7c3aed;padding:0;text-decoration:underline;margin-right:6px;">Retake</button>`
      : '';

    // Beta Report cell (super admin only)
    let betaCell = '';
    if (isAdmin) {
      if (!betaModeEnabled) {
        betaCell = `<td id="beta-cell-${clientId}" style="font-size:11px;color:#aaa;">—</td>`;
      } else if (status !== 'complete') {
        betaCell = `<td id="beta-cell-${clientId}" style="font-size:11px;color:#aaa;">—</td>`;
      } else {
        const betaTs = r.beta_report_generated_at;
        if (betaTs) {
          const betaFilename = r.beta_report_filename || null;
          const betaLink = betaFilename
            ? `<a href="/reports/token/${encodeURIComponent(betaFilename)}" style="display:block;color:#7c3aed;text-decoration:none;white-space:nowrap;font-size:11px;">&#128196; Download</a>`
            : '';
          betaCell = `<td id="beta-cell-${clientId}" style="font-size:11px;">
            ✓ ${formatAdminDate(betaTs)}${betaLink}
            <button onclick="adminGenBetaReport(${clientId},'${rawName.replace(/'/g, "\\'")}',this)" style="display:block;background:none;border:none;cursor:pointer;font-size:11px;color:#7c3aed;padding:0;text-decoration:underline;margin-top:2px;">Regenerate</button>
          </td>`;
        } else {
          betaCell = `<td id="beta-cell-${clientId}" style="font-size:11px;">
            <button onclick="adminGenBetaReport(${clientId},'${rawName.replace(/'/g, "\\'")}',this)" style="background:none;border:none;cursor:pointer;font-size:12px;color:#7c3aed;padding:0;text-decoration:underline;">Generate</button>
          </td>`;
        }
      }
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

    return `<tr id="row-${clientId}">
      <td><a href="#" data-entity="client-${clientId}" onclick="openClientProfile(${clientId});return false;" style="color:#00b1d7;text-decoration:underline;text-decoration-style:dotted;font-weight:600;" onmouseover="this.style.textDecorationStyle='solid'" onmouseout="this.style.textDecorationStyle='dotted'">${name}</a>${retakeBadge}</td>
      <td>${typeLabel}</td>
      <td>${instinct}</td>
      <td>${conf}</td>
      <td id="coach-cell-${clientId}">${coach}</td>
      <td>${date}</td>
      <td><span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:3px;font-size:12px;font-weight:600;">${statusLabel}</span>${retakePendingBadge}</td>
      <td id="pdf-status-${clientId}" style="font-size:12px;">${pdfStatus}</td>
      <td id="email-status-${clientId}" style="font-size:12px;">${emailStatus}</td>
      <td>${pdfLinks}</td>
      ${betaCell}
      <td>${reassignAction}${retryAction}${regenAction}${resendAction}${retakeAction}${inviteResendAction}${deleteAction}</td>
    </tr>`;
  }).join('\n');

  const colCount = isAdmin ? 12 : 11;
  const body = rows.length === 0
    ? `<tr><td colspan="${colCount}" style="text-align:center;padding:40px;color:#7A96A6;">No clients yet — click + Client to add one</td></tr>`
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
    ${req.session.coach_is_admin ? `<a href="/admin/coaches" class="nav-link">Manage Coaches</a><span class="nav-sep">|</span>` : ''}
    ${req.session.coach_is_super_admin ? `${cmsContentMenu('')}<span class="nav-sep">|</span><a href="/admin/beta-review" class="nav-link">Beta Review</a><span class="nav-sep">|</span>` : ''}
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
          ${isAdmin ? '<th style="color:#d8b4fe;">Beta Report</th>' : ''}
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
async function adminGenBetaReport(clientId, name, btn) {
  if (!confirm('Generate beta report for ' + name + '?')) return;
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  try {
    const r = await fetch('/admin/beta-report/' + clientId, {method:'POST', headers:{Accept:'application/json'}});
    const d = await r.json();
    if (d.success) {
      const cell = document.getElementById('beta-cell-' + clientId);
      if (cell) {
        const dl = d.filename ? '<a href="/reports/token/'+encodeURIComponent(d.filename)+'" style="display:block;color:#7c3aed;text-decoration:none;white-space:nowrap;font-size:11px;">&#128196; Download</a>' : '';
        cell.innerHTML = '✓ just now' + dl + '<button onclick="adminGenBetaReport('+clientId+',\\''+name.replace(/'/g,"\\\\'")+'\\',this)" style="display:block;background:none;border:none;cursor:pointer;font-size:11px;color:#7c3aed;padding:0;text-decoration:underline;margin-top:2px;">Regenerate</button>';
      }
      showToast('Beta report generated.');
    } else { alert(d.error || 'Generation failed'); btn.disabled = false; btn.textContent = orig; }
  } catch(e) { alert('Request failed'); btn.disabled = false; btn.textContent = orig; }
}
</script>
${sharedModalHTML(req.session.coach_is_admin === true, req.session.coach_is_super_admin === true)}
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
    if (!req.session.coach_is_admin) return res.status(403).send('Forbidden');
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
    `SELECT id AS assessment_id, confirmed_type, confirmed_instinct, confidence_level, status,
            dominant_instinct_hypothesis,
            coach_confirmed_type, coach_confirmed_instinct, type_clarification_notes, is_beta
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

// Coach Debrief Confirmation — coach-verified type/instinct recorded post-debrief.
// Mirrors the auth/owner-check pattern of POST /admin/clients/:client_id/update.
app.post('/admin/assessments/:assessment_id/coach-debrief', requireAdminSession, async (req, res) => {
  const assessmentId = parseInt(req.params.assessment_id, 10);
  if (!assessmentId || isNaN(assessmentId)) return res.status(400).json({ error: 'Invalid assessment ID' });

  const ownerCoachId = await db.getAssessmentOwnerCoachId(assessmentId);
  if (ownerCoachId === null) return res.status(404).json({ error: 'Assessment not found.' });
  const isSuperAdmin = req.session.coach_is_admin === true;
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
