'use strict';

/**
 * render_client.js — report layout verification (offline, no API key, no DB).
 *
 * For sp4/sx7: api_result fixture + synthetic client/coach → report_prep →
 * renderer → PDF, for BOTH the client and coach reports. Flowing layout (no
 * measurement gate): renders straight, then measures each page's rendered height.
 * Writes HTML + PDF per report to .phase6_out/ (gitignored).
 *
 * Failure (process exits non-zero) on any of:
 *   - a builder or render throwing;
 *   - wrong logical page count (client 10, coach 3);
 *   - CLIENT page spill past one physical sheet (1056px @96dpi) — the client
 *     report is a hard one-sheet-per-page contract;
 *   - a §6.1 paired-column line-count mismatch on client sheet 6 or 7 (see V3_PAIRS).
 * Coach `.report-page` is min-height:1056 and flows by design, so coach spill is
 * reported for visibility but is NOT a failure.
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const prep = require(path.join(ROOT, 'app/report_prep.js'));
const R = require(path.join(ROOT, 'app/renderer.js'));
// The instinct axis (PR 4 step 2). Defined in tests/fixtures/ so the harness and
// tests/instinct_axis_test.js share one definition and cannot drift; this script already
// requires fixtures from there.
const { applyInstinct, INSTINCT_MARKUP, applyZ6, Z6_STATES, Z6_CAP_LINES, applyCollision } =
  require(path.join(ROOT, 'tests/fixtures/instinct_axis.js'));

const PAGE_PX = 1056; // US Letter 11in @96dpi
const OUT = path.join(ROOT, '.phase6_out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const client = { first_name: 'Test', last_name: 'Client', organization: 'Acme Co', date: 'June 2026' };
const coach = { full_name: 'Cai Delumpa', type: 5, instinct: 'SP' };
// The v3 reference implementation is built for this client; the masthead is compared
// against it, so the name must match.
const V3_CLIENT = { first_name: 'Anders', last_name: 'Wennerstrom', organization: 'Hive', date: 'August 2026' };

/**
 * SPEC §6.1 — matched line counts between paired columns on sheets 6 and 7.
 *
 * ENFORCED. A mismatch fails the run (PR 3f, 4 Sep 2026). It was report-only from PR 3d until
 * here for one reason: four of the nine types did not satisfy the rule, all four on best/edge,
 * all four because the third Growing Edge line rendered three lines against a two-line
 * Strengths column. A hard gate then would have gone red on arrival and blocked every unrelated
 * PR. Report-only bought the baseline the five new types were read against as they landed; it
 * was never the destination. The four source lines were shortened, PR 3f re-ingested them, and
 * all 27 pairs across nine types now match — measured, see the build report.
 *
 * THE RUN STILL PRINTS EVERY PAIR, pass or fail. A gate that speaks only on failure would
 * remove the one artefact that made this rule tractable: 27 rows of measured line counts that
 * a content edit can be read against BEFORE it is committed. Failing and reporting are separate
 * jobs and this does both.
 *
 * `!r.match` covers the unmeasurable case as well as the unequal one — `measurePairs` leaves
 * `match` false when a root selector misses, and a pair that could not be measured is not a
 * pair that passed. The printed mark distinguishes the two.
 *
 * Columns are addressed by their own headings where the markup allows — `.v3-tb-col` carries
 * `.is-best` / `.is-edge` — rather than by sibling position. `.v3-tb-pr-col` has no such marker,
 * so those two are positional, and the renderer emits Signs before Interrupting (`_clv3TypeB`).
 */
const V3_PAIRS = [
  { name: 'worldview / core_belief', pageKey: 'typeA',
    a: { label: 'worldview',   root: '.v3-ta-cm-col:nth-of-type(1) .v3-ta-cm-txt' },
    b: { label: 'core_belief', root: '.v3-ta-cm-col:nth-of-type(2) .v3-ta-cm-txt' } },
  { name: 'best / edge', pageKey: 'typeB',
    a: { label: 'best', root: '.v3-tb-col:has(.v3-tb-col-head.is-best)', sel: '.v3-tb-item-txt' },
    b: { label: 'edge', root: '.v3-tb-col:has(.v3-tb-col-head.is-edge)', sel: '.v3-tb-item-txt' } },
  { name: 'signs / interrupt', pageKey: 'typeB',
    a: { label: 'signs',     root: '.v3-tb-pr-col:nth-of-type(1)', sel: '.v3-tb-pr-txt' },
    b: { label: 'interrupt', root: '.v3-tb-pr-col:nth-of-type(2)', sel: '.v3-tb-pr-txt' } },
];

/**
 * The two zones design spec §6 flagged as last-line fill outliers. Re-measured here rather
 * than in a separate run: same browser, same page, no second launch.
 *
 * The standing 13.0% / 15.9% figures were taken on `deb13f3`, before the Type 9 source doc
 * replaced 36 of that type's 40 strings, so they describe prose that no longer ships.
 */
/**
 * p10 GEOMETRY — the shipped page held to the page it was MEASURED as.
 *
 * Every figure in docs/p10_fit_results.md was taken on a scaffold at the mockup's grid,
 * before p10 had a renderer. Step 5A's markup is not the scaffold's, so the shipped page
 * can drift from the measured one and nothing else would notice: the fit numbers would
 * quietly stop describing the page they are cited for.
 *
 * Three assertions, and two of them are the CORRECTED versions — the first drafts of both
 * were wrong when the scaffold shipped them at step 3:
 *
 *  1. WIDTH via getBoundingClientRect minus padding, NOT line_metrics' contentBox.
 *     contentBox derives from `clientWidth`, which is an INTEGER: it reports this column as
 *     207 where the real width is 207.3281. Fine for counting lines, wrong for checking a
 *     fractional grid against a fractional reference. The step-3 probe failed on exactly
 *     this and the scaffold was not at fault — the ruler was.
 *
 *  2. THE BADGE ROW'S RESERVATION, tested by REMOVING the badge. Asserting the row is 13px
 *     is satisfied by the badge simply being 13px tall on its own, which is a different
 *     fact. What matters is that `min-height` holds the row open, because a renderer that
 *     omits the badge inherits the 13px only if it does. The scaffold shipped the weak
 *     version first and it passed with the min-height deleted.
 *
 *  3. INTRINSIC column height, not the card box. `.v3-inst-card` is a flex item under the
 *     default `align-items: stretch`, so all three columns report the SAME height whatever
 *     they hold. An assertion on the card box would be green while one column overflowed.
 */
const V3_GEOMETRY = {
  pageKey: 'instincts',
  colWidth: 207.3281,     // docs/p10_fit_results.md — .v3-inst-body content width
  eyebrow: 13,            // .v3-inst-eyebrow min-height, the badge-row reservation
  // Inter-zone spacing, added after the step-5A smoke render found the lead sitting flush
  // against "The Three Instincts". The shared .v3-page .lead has no bottom margin; the
  // geometry p10 was measured at is the mockup's, which has 16px. Column width and the
  // eyebrow were both correct while this was wrong, so it needs its own assertion.
  leadGap: 16,
  tol: 0.05,
};

const V3_FILL_ZONES = [
  { name: 'p6 core motivation',  pageKey: 'typeA', sel: '.v3-ta-cm-narr' },
  { name: 'p7 chicklet bullet 8', pageKey: 'typeB', sel: '.v3-tb-s-txt', nth: 7 },
];

// Per report kind: how to build it, which page containers to measure, how many to
// expect, and whether page spill past one sheet is a failure (client only).
// Client uses .cover (Title/TOC/Welcome), .page (P2), and .pN-page (P3–P8) — the
// legacy .report-page selector no longer matches any client page. Coach uses
// .report-page ×3.
const REPORTS = {
  client: {
    build: async (apiResult) => R.buildClientReportHTML(await prep.buildClientModel({ apiResult, client, coach })),
    selector: '.cover, .page, .p3-page, .p4-page, .p5-page, .p6-page, .p7-page, .p8-page',
    expected: 10,
    enforceSheet: true,
    labels: ['Title', 'TOC', 'P1 Welcome', 'P2 Primer', 'P3 Hypotheses', 'P4 Patterns',
      'P5 Wings/Lines', 'P6 Instinct', 'P7 Strengths', 'P8 Application'],
  },
  // CLIENT REPORT v3 (PR 1). Renders alongside the live 10-page config above, which stays
  // green until cutover. Grows one page at a time; PR 1 carries Wings only.
  client_v3: {
    build: async (apiResult) => R.buildClientReportHTML_v3(
      await prep.buildClientModel({ apiResult, client: V3_CLIENT, coach })),
    selector: '.v3-page',
    // PER-TYPE, not a single literal. Every type emits nine pages as of PR 3e, so a fixed
    // number would now be correct again — but deriving it from v3PagesFor is what kept this
    // honest through a rollout where the count genuinely differed per type, and it costs
    // nothing to keep. It also stays correct if a page family is ever staged again.
    expectedFor: (type) => R.v3PagesFor(type == null ? 9 : type).length,
    labelsFor: (type) => R.v3PagesFor(type == null ? 9 : type)
      .map(p => `P${p.sheet} ${p.title.replace(/ \(continued\)$/, ' cont')}`.slice(0, 16)),
    enforceSheet: true,
    // Document order, not sheet order: PR 2 adds sheets 1-4 and 12 around the Wings page
    // PR 1 built, and sheets 5-11 land in later PRs.
    checkHyphens: true,
    // §6.1 matched line counts + the §6 fill outliers. Report-only; see V3_PAIRS.
    pairChecks: V3_PAIRS,
    fillZones: V3_FILL_ZONES,
    geometry: V3_GEOMETRY,
    // anders_sx9 is the fixture the v3 mockups were built for. sp4 joins at STEP 5A for
    // coherence, not coverage: its instinct_evidence is Type 4 SP prose, which reads
    // correctly on a Type 4 SP page and nowhere else. Transplanting it onto anders_sx9 —
    // which the step-3 probe did — puts Type 4 prose under a Type 9 heading and anyone
    // eyeballing the output has to be told to ignore the words.
    fixtures: ['anders_sx9', 'sp4'],
    // Render EVERY type from the one fixture, swapping confirmed_type. The per-type pages
    // fit differently per type — the canon line narratives alone range 284-351 chars — so a
    // single-type run cannot answer "does this page fit". No new fixtures needed: the client
    // model derives everything from hypothesis.confirmed_type.
    // PER FIXTURE. anders_sx9 sweeps all nine types; sp4 renders ONLY at its own type,
    // because the reason it is here is that its per-client prose matches that type.
    typesFor: (fx) => (fx === 'sp4' ? [4] : [1, 2, 3, 4, 5, 6, 7, 8, 9]),
    types: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    // ── The instinct axis (PR 4 step 2) ────────────────────────────────────────────────
    //
    // ELEVEN RENDERS, NOT TWENTY-SEVEN, and the arithmetic is the argument. Measured on
    // main @ feb5e4f by rendering the v3 document under each profile and byte-diffing
    // (docs/audit_pr4_step2_fixture_axis.md §2a): the instinct axis changes ONE line of
    // 965, on the Contents page, and it does so ONLY through
    // dominant_instinct_hypothesis -> display.subtype_label. instinct_score_profile
    // changes nothing rendered at all.
    //
    // What that one line varies is not three strings but THREE MARKUP SHAPES, because
    // _v3NoBreak (renderer.js:3176) wraps hyphenated compounds in a nowrap span:
    // "Self-Preservation" and "One-to-One" are wrapped, "Social" is not. `null` means the
    // fixture's own values, and anders_sx9 IS sx_primary — so the existing nine renders
    // already cover the third shape, and TWO more renders cover the other two.
    //
    // A full 3 x 9 would spend eighteen extra renders to vary one string in three shapes:
    // measured 1.409 s/render locally and ~2.19 s/render in CI, that is ~+39 s on every CI
    // run against ~+4.4 s here, FOR THE SAME COVERAGE. The full matrix belongs at STEP 4,
    // where p10 exists and 27 renders put all 27 subtype columns in the highlighted slot —
    // which is what it was designed to deliver and delivers none of here.
    // TWENTY-SEVEN now, not eleven. p10 exists as of step 5A, so the full 3 x 9 finally
    // earns its cost: it is the only thing that puts all 27 subtype columns in the
    // highlighted slot, which is the build plan's own PR 4 pass/fail. `null` means the
    // fixture's own instinct values — anders_sx9 IS sx_primary, so the three cases are
    // sx/sp/so. Measured 1.424 s/render locally, ~2.25 s in CI.
    //
    // sp4 takes `null` only: its own dominant is SP and its own type is 4, which is the
    // whole point of it being here. 27 + 1 = 28.
    instinctsFor: (fx) => (fx === 'sp4' ? [null] : [null, 'sp_primary', 'so_primary']),

    // ── The Z6 axis (PR 4 step 6A) ────────────────────────────────────────────────────
    // Z6 is p10's "In Your Words" band, fed by client_facing.instinct_evidence. Until this
    // axis existed the page gate had only ever seen sp4's own 3-bullet SM evidence, which
    // fits; the synthetic worst cases lived in tests/fixtures/instinct_axis.js and were
    // model-level only, so NOTHING RENDERED THEM.
    //
    // sp4 ONLY, and that is not a shortcut. anders_sx9 ships `client_facing: {}`, so its 27
    // renders carry no Z6 box at all and `[null]` keeps them byte-identical — the same
    // reasoning instinctsFor uses. Putting four Z6 states on 27 renders would multiply the
    // matrix to 108 to re-measure one band that does not vary with type or instinct.
    // 27 + 4 = 31.
    //
    // `null` is sp4's own real evidence, not an empty state — the fixture's untouched
    // 3-bullet SM value, which is what shipped before this axis and is the control the other
    // three are read against.
    // EVERY STATE IS NAMED as of step 6B. `sp4_real` is the fixture's own untouched evidence,
    // which used to be a bare `null` here; naming it means every state the matrix renders
    // carries a declaration, with no entry inheriting a permissive default. anders_sx9 keeps
    // `[null]` — that is the ABSENCE of the axis, not a state, and it carries no declaration.
    z6For: (fx) => (fx === 'sp4'
      ? ['sp4_real', 'sm_bullets', 'em_paragraph', 'em_observed_max', 'cms_preview']
      : [null]),

    // ── The collision axis (PR 5 Build B2a) ───────────────────────────────────────────
    //
    // A record whose two hypothesis scalars name the same type. call2_stamp.js ships these
    // deliberately (Defect #3: flag for admin review, do not hard-stop), so it is a PRODUCTION
    // shape — and until this axis the harness could not make one: the retype rule at
    // `alternate_candidate = (asType % 9) + 1` has no fixed point on 1..9. The hardest record
    // for sheet 5's outcome had never been rendered as a page.
    //
    // ONE (fixture, type) PAIR, NOT A SWEEP, and the arithmetic is the argument. What a
    // collided record changes about the DOCUMENT is confined to sheet 5's two hypotheses, and
    // sheet 5 is not built yet — so today this axis renders the shape and proves the model
    // carries it. The nine-way sweep that matters is the FIGURE's, and scripts/verify_diagrams.js
    // already does it: 1x1 through 9x9, asserting the dashed ring lands on position 2's node.
    // Duplicating that here would spend renders re-proving a geometry another gate owns.
    //
    // anders_sx9 at its OWN type, not a re-typed one. The re-typed clones already carry a
    // synthetic alternate; collapsing a synthetic alternate onto a synthetic leading would
    // model a fixture artefact rather than the engine state. At asType 9 the retype is a no-op
    // on the fields this axis touches, so the collision is applied to the fixture's real shape.
    //
    // `null` is the ABSENCE of the axis, not a state — every render that existed before this
    // is byte-identical, which is asserted by diff rather than assumed.
    collidedFor: (fx, asType) => ((fx === 'anders_sx9' && asType === 9) ? [null, 'collided'] : [null]),
  },
  coach: {
    build: async (apiResult) => R.buildCoachReportHTML(await prep.buildCoachModel({ apiResult, client, coach })),
    selector: '.report-page',
    expected: 3,
    enforceSheet: false,
    labels: ['Coach P1', 'Coach P2', 'Coach P3'],
  },
};

// Pinned bundled Chromium via the shared launcher — same engine as production and CI.
const browserLaunch = require(path.join(ROOT, 'app/browser_launch.js'));
const lineMetrics = require(path.join(ROOT, 'scripts/lib/line_metrics.js'));
async function launch() { return browserLaunch.launchBrowser(); }
let fontReported = false;

/**
 * Find lines that break at a hyphen, splitting a word across two lines (brief v2.0 §12.6).
 *
 * The obvious check — look for U+00AD or automatic hyphenation — finds nothing and would
 * pass forever: computed `hyphens` is `manual` on every page, so Chromium never inserts a
 * hyphen. Every real occurrence is a break at a hyphen that is ALREADY in the string, which
 * `hyphens` does not govern at all. Measured on the reference set, three compounds split
 * this way ("self-forgetting", "present-moment", "pressure-test") and, once the Welcome
 * letter landed, so did a URL — "www.hiveleadership.com/the-" / "enneagram." in a
 * client-facing PDF.
 *
 * Fixes are U+2011 (non-breaking hyphen) in prose, and a nowrap span for URLs so the text
 * stays copy-exact. A hyphen preceded by whitespace is a dash, not a compound, and breaking
 * there is correct typography — those are excluded.
 */
async function findHyphenBreaks(page, selector) {
  return page.evaluate((sel) => {
    const out = [];
    for (const root of document.querySelectorAll(sel)) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.nodeValue;
        if (!t || !t.trim() || !n.parentElement || n.parentElement.closest('svg')) continue;
        const r = document.createRange();
        const lines = []; let cur = null;
        for (let i = 0; i < t.length; i++) {
          r.setStart(n, i); r.setEnd(n, i + 1);
          const b = r.getBoundingClientRect();
          if (!b.width && !b.height) continue;
          const top = Math.round(b.top * 2) / 2;
          if (!cur || cur.top !== top) { cur = { top, f: i, l: i }; lines.push(cur); } else cur.l = i;
        }
        for (let i = 0; i < lines.length - 1; i++) {
          const seg = t.slice(lines[i].f, lines[i].l + 1).replace(/\s+$/, '');
          if (/[-‐]$/.test(seg) && !/\s.$/.test(seg)) {
            out.push({ cls: n.parentElement.className,
              before: seg.slice(-30), after: t.slice(lines[i + 1].f, lines[i + 1].l + 1).trim().slice(0, 20) });
          }
        }
      }
    }
    return out;
  }, selector);
}

/**
 * Measure each page container's rendered height, physical-sheet count, and HEADROOM.
 *
 * WHY HEADROOM IS MEASURED SEPARATELY, AND WHY IT MATTERS MORE THAN ITS SIZE SUGGESTS
 * -----------------------------------------------------------------------------------
 * `.v3-page` is `min-height:1056px`, so getBoundingClientRect().height reports exactly
 * 1056px for every page that fits — on every platform, at every content length. The spill
 * check below is still correct (an overflowing page grows past the minimum and is caught),
 * but the number it prints carries almost no information: a page with 200px to spare and a
 * page one word from spilling both log `1056px`.
 *
 * That is why CI green has only ever proved "content stack <= 976px". It says nothing about
 * whether the stack is 938.75px on Linux or 951px — and the character bands governing the
 * ~550 authoring units of PR 3 have never been corroborated cross-platform by anything
 * except the font probe. Liberation Sans is metric-compatible with Arial, so they should
 * agree; "should" is not a measurement.
 *
 * Releasing min-height to 0 lets the box collapse to its natural content height. Headroom is
 * then 1056 minus that — directly "how much can this page grow before it spills", with no
 * convention to argue about. (Note this differs by ~20px from the figures in
 * docs/audit_pr2_static_pages.md section 9, which excluded the .page-footer box from the
 * stack; the ordering is identical and the offset is constant.)
 *
 * With this printed, PR 3's first CI run yields the Linux bands for free.
 *
 * CAVEAT: this only collapses boxes sized by `min-height`. The legacy `.cover` pages (Title,
 * TOC, P1 Welcome) use a fixed `height`, so they report `0.00px free` — that is "not
 * measurable this way", not "one word from spilling". Every `.v3-page` is min-height, so the
 * figure is real for the whole v3 document, which is what PR 3 needs.
 */
async function measureLayout(page, selector) {
  await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 150));
  return page.evaluate((PAGE_PX, selector) => {
    const els = [...document.querySelectorAll(selector)];
    const rendered = els.map(el => el.getBoundingClientRect().height);
    // Natural height with the minimum released, then restored. Done per element and undone
    // immediately so no later measurement in this page context sees a mutated layout.
    const natural = els.map(el => {
      const prev = el.style.minHeight;
      el.style.minHeight = '0px';
      const h = el.getBoundingClientRect().height;
      el.style.minHeight = prev;
      return h;
    });
    return els.map((el, i) => ({
      index: i,
      height: Math.round(rendered[i]),
      natural: +natural[i].toFixed(2),
      headroom: +(PAGE_PX - natural[i]).toFixed(2),
      sheets: Math.max(1, Math.ceil(rendered[i] / (PAGE_PX + 1))),
    }));
  }, PAGE_PX, selector);
}

(async () => {
  await require(path.join(ROOT, 'scripts/lib/override_banner.js')).printOverrideBanner();
  const browser = await launch();
  let failed = false;
  const fail = (msg) => { failed = true; console.log(`  *** FAIL — ${msg}`); };
  try {
    for (const [kind, cfg] of Object.entries(REPORTS)) {
     for (const fx of (cfg.fixtures || ['sp4', 'sx7'])) {
      const fixture = require(path.join(ROOT, `tests/fixtures/${fx}_api_result.json`));
      for (const asType of (cfg.typesFor ? cfg.typesFor(fx) : (cfg.types || [null]))) {
       // The instinct axis sits INSIDE the type loop and defaults to [null] — "the fixture's
       // own instinct values, untouched". With no instinctsFor, and for every type that
       // returns [null], the object handed to cfg.build is exactly what it was before this
       // axis existed, which is what makes the nine existing renders byte-identical.
       for (const instKey of (cfg.instinctsFor ? cfg.instinctsFor(fx, asType) : [null])) {
        const retyped = asType == null ? fixture : (() => {
          const c = JSON.parse(JSON.stringify(fixture));
          const realType = fixture.hypothesis.confirmed_type;
          c.hypothesis.confirmed_type = asType;
          c.hypothesis.confirmed_type_name = null;                 // suppress the name-drift flag
          c.hypothesis.alternate_candidate = (asType % 9) + 1;
          const pb = c.coach_report && c.coach_report.section6 && c.coach_report.section6.pushes_back;
          if (pb) pb.alt_type_name = null;
          // The client's verbatim quotes are EVIDENCE FOR THE FIXTURE'S REAL TYPE, so they are
          // dropped when the fixture is re-typed. Sheet 6's "In Your Own Words" band would
          // otherwise print this Type 9 client's own language ("I project a calm presence…")
          // under a Type 1 or Type 7 heading — content that reads as authored-for-this-type and
          // is not. Every other zone on the re-typed sheets is per-type library content and
          // follows asType correctly; this is the only per-client one, and the only one that
          // has to be withheld. Consequence for review renders: the band appears on the
          // fixture's own type and nowhere else, which is the honest result.
          if (asType !== realType) c.client_words = {};

          // ── THE SCALARS AND THE RANKING, RE-TYPED TOGETHER (PR 5 Build 1) ────────────
          //
          // Sheet 5 draws call1_ranking as nine node fills, and puts the ALTERNATE ring on
          // alternate_candidate. Re-typing confirmed_type without re-typing these leaves the
          // ramp ranking the fixture's REAL type first — see A7 below for what that renders.
          //
          // THE RANKING IS DERIVED FROM THE SCALARS, NOT THE OTHER WAY ROUND. The scalars
          // are what the page reads; permuting the ranking to match them keeps
          // alternate_candidate exactly as the line above set it, so m.alternate does not
          // move and no v3 page changes. Deriving the scalars from a re-sorted ranking
          // would have moved it, and m.alternate is live on v2 p3 (renderer.js:2076, :2106).
          //
          // SCORE VALUES ARE PRESERVED, ONLY REASSIGNED. The fixture's own nine scores are
          // taken in descending order and dealt out: position 1 to asType, position 2 to
          // alternate_candidate, the remaining seven to the remaining types in ascending
          // type order. So the ramp's SHAPE — the gaps the heat map renders — is the
          // fixture's real distribution, not a synthetic one. A re-typed render is a real
          // profile wearing a different type's ordering, which is what every other zone on
          // these pages already is.
          c.hypothesis.leading_candidate = asType;
          if (Array.isArray(c.hypothesis.call1_ranking) && c.hypothesis.call1_ranking.length) {
            const scores = c.hypothesis.call1_ranking
              .map((r) => r.score).sort((a, b) => b - a);
            const alt = c.hypothesis.alternate_candidate;
            const rest = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((t) => t !== asType && t !== alt);
            c.hypothesis.call1_ranking = [asType, alt, ...rest]
              .slice(0, scores.length)
              .map((type, i) => ({ type, score: scores[i] }));
          }
          return c;
        })();

        // ── A7 — THE RE-TYPED SCALARS MUST AGREE WITH THE RE-TYPED PAGE ────────────────
        //
        // WHY THIS EXISTS. The retype above swaps confirmed_type and sets a mechanical
        // alternate_candidate, and until PR 5 Build 1 it touched NEITHER leading_candidate
        // NOR call1_ranking. Sheet 5 is the first v3 page to draw either: the nine node
        // fills come from call1_ranking and the ALTERNATE ring from alternate_candidate.
        // Unfixed, eight of the nine re-typed renders would show a ramp whose brightest
        // node is the fixture's real type on a page headlined as a different one, and a
        // reviewer would have to be TOLD to ignore them — which is the same failure the
        // client_words drop above already solved for a different field.
        //
        // WRITTEN RED FIRST, and it failed on exactly 8 of 9 types for anders_sx9 and 0 of
        // 1 for sp4, which is the count docs/audit_pr5_quickref.md §19.1 predicts.
        //
        // ASSERTS ON THE FAILURE TEXT, NOT AN EXIT CODE. fail() records a message; a
        // TypeError here would abort the run without one, and a gate that dies before
        // reporting its own message is one this project has already found five times.
        if (asType != null) {
          const h = retyped.hypothesis;
          const rank = [...(h.call1_ranking || [])].sort((a, b) => b.score - a.score);
          if (h.leading_candidate !== asType) {
            fail(`A7 ${fx} asType ${asType}: leading_candidate is ${h.leading_candidate}, `
               + `expected ${asType} — the retype left it on the fixture's real type`);
          }
          if (!rank.length || rank[0].type !== asType) {
            fail(`A7 ${fx} asType ${asType}: call1_ranking position 1 is `
               + `${rank.length ? rank[0].type : 'ABSENT'}, expected ${asType} — the heat map's `
               + `brightest node would not be this page's type`);
          }
          // ⚠ THE STATED REASON BELOW IS STALE AS OF PR 5 BUILD R, and the clause is kept for a
          // narrower one. It used to say that a mismatch meant "the ALTERNATE ring and the ramp
          // ordering would disagree" — true when the ring read alternate_candidate. The ring now
          // reads POSITION 2, i.e. it reads the ramp ordering itself, so those two CANNOT
          // disagree any more. What survives is a fixture-sanity check: that the retype helper
          // left this clone coherent. Kept at that narrower value, said out loud rather than
          // left to read as a guarantee it no longer provides.
          //
          // NO EXEMPTION IS NEEDED FOR THE COLLISION AXIS, and it is worth saying why rather
          // than leaving it to be rediscovered. This clause reads `retyped`, which is UPSTREAM of
          // applyCollision — the collision is applied inside the z6 loop below, on a further
          // clone. So A7 never sees a collided record. Had it run downstream it would have had to
          // be exempted, because a collided record has alternate_candidate === position 1 and
          // therefore differs from the ranking's runner-up BY CONSTRUCTION — the engine state
          // call2_stamp ships, not a broken fixture.
          if (rank.length > 1 && rank[1].type !== h.alternate_candidate) {
            fail(`A7 ${fx} asType ${asType}: call1_ranking position 2 is ${rank[1].type} but `
               + `alternate_candidate is ${h.alternate_candidate} — the retype left this clone `
               + `incoherent (fixture sanity; the ring itself reads position 2 as of Build R)`);
          }
        }
        // Applied on top of the re-typed clone, and only when a profile is named. Overrides
        // instinct_score_profile AND dominant_instinct_hypothesis together — necessary, not
        // stylistic: nothing in the codebase reconciles them, so overriding one would make
        // the render itself an instance of that contradiction.
        const withInstinct = instKey == null ? retyped : applyInstinct(retyped, instKey);
       for (const z6Key of (cfg.z6For ? cfg.z6For(fx, asType) : [null])) {
        // Z6 sits INSIDE the instinct loop and defaults to [null] — "the fixture's own
        // instinct_evidence, untouched" — so every render that existed before this axis is
        // unchanged by it.
        const withZ6 = z6Key == null ? withInstinct : applyZ6(withInstinct, z6Key);
       for (const collKey of (cfg.collidedFor ? cfg.collidedFor(fx, asType) : [null])) {
        // Innermost, and defaulting to [null] for the same reason the two axes above do: the
        // object handed to cfg.build is exactly what it was before this axis existed on every
        // render that predates it.
        const apiResult = collKey == null ? withZ6 : applyCollision(withZ6);
        console.log(`\n=== ${fx}${asType == null ? '' : ` as Type ${asType}`}${instKey == null ? '' : ` · ${instKey}`}${z6Key == null ? '' : ` · Z6:${z6Key}`}${collKey == null ? '' : ' · COLLIDED'} · ${kind} ===`);
        let html;
        try {
          html = await cfg.build(apiResult);
        } catch (e) {
          fail(`${kind} build threw: ${e.message}`);
          continue;
        }
        // ── Done-when 2 (PR 4 step 2) ──────────────────────────────────────────────
        // The instinct axis's only rendered effect on main is the Contents descriptor, and
        // what it varies is a MARKUP SHAPE, not just a string: _v3NoBreak wraps hyphenated
        // compounds in a nowrap span, so "Self-Preservation" and "One-to-One" are wrapped
        // and "Social" is not. Assert the shape, because the span is the part a regression
        // would silently drop while the words still read correctly.
        //
        // Asserted on Type 9 only — the type the fixture actually is. `null` here means the
        // fixture's own instinct, which IS sx_primary, so the pre-existing Type 9 render
        // covers the third shape for free and only two renders were added.
        //
        // The negative half matters as much as the positive: without it a change that
        // emitted every label would pass. The three shapes are mutually exclusive on this
        // page, and that is asserted, not assumed.
        if (cfg.instinctsFor && fx === 'anders_sx9' && asType === 9) {
          const key = instKey || 'sx_primary';
          const want = INSTINCT_MARKUP[key];
          // SCOPED TO THE CONTENTS DESCRIPTOR, and it has to be as of step 5A.
          //
          // This assertion was always ABOUT that one line; until p10 existed a
          // whole-document `includes` was unambiguous because nothing else on the document
          // carried those strings. p10 changed that: its Z5 narratives OPEN with the same
          // words — "Self-Preservation Nines find peace through…", "Social Nines find…" —
          // and _v3NoBreak wraps the hyphenated ones identically, so every needle now also
          // matches a narrative. Widening the needle would be guesswork; naming the element
          // says what the check always meant.
          const descs = [...html.matchAll(/<div class="v3-toc-desc">([\s\S]*?)<\/div>/g)].map((mm) => mm[1]);
          const desc = descs.find((d) => /dominant instinct/.test(d));
          if (!desc) {
            fail(`${kind} type 9 · ${key}: no Contents descriptor mentioning the dominant instinct`);
          } else if (!desc.includes(want)) {
            fail(`${kind} type 9 · ${key}: Contents descriptor markup not found — expected ${JSON.stringify(want)} in ${JSON.stringify(desc)}`);
          } else {
            const strays = Object.entries(INSTINCT_MARKUP)
              .filter(([k, v]) => k !== key && desc.includes(v)).map(([k]) => k);
            if (strays.length) fail(`${kind} type 9 · ${key}: markup for ${strays.join(', ')} also in the Contents descriptor — the three shapes must be mutually exclusive`);
            else console.log(`  instinct markup (${key}): ${want}`);
          }
        }
        // Every axis that varies a render must appear in the tag, or two renders write to one
        // path and the second silently replaces the first. Caught here by adding an axis: without
        // the collided segment the collided render and its own control shared a filename, so the
        // artifact a reviewer opened would have been whichever ran last.
        const tag = (asType == null ? fx : `${fx}_t${asType}`) + (instKey == null ? '' : `_${instKey}`)
                  + (z6Key == null ? '' : `_z6-${z6Key}`) + (collKey == null ? '' : '_collided');
        fs.writeFileSync(path.join(OUT, `${kind}_${tag}.html`), html);

        const page = await browser.newPage();
        await page.setViewport({ width: 816, height: PAGE_PX, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.emulateMediaType('print');
        // Fail loudly if Chromium substituted a font: every single-sheet measurement below
        // assumes Arial metrics, and a substitution is otherwise invisible until a page
        // silently becomes two sheets.
        try {
          const w = await browserLaunch.assertReportFont(page);
          if (!fontReported) { console.log(`  font probe: ${w.toFixed(2)}px (Arial metrics OK)`); fontReported = true; }
        } catch (e) { fail(e.message); }
        const pages = await measureLayout(page, cfg.selector);
        // Which logical page carries Z6. Derived from V3_PAGE_ORDER rather than hard-coded,
        // so it survives a page being added before sheet 10.
        const z6PageIndex = cfg.z6For
          ? R.v3PagesFor(asType == null ? 9 : asType).findIndex((pg) => pg.key === 'instincts')
          : -1;
        let sheets = 0;
        for (const p of pages) {
          sheets += p.sheets;
          const spill = p.height > PAGE_PX + 1 ? `  *** SPILL → ${p.sheets} sheets` : '';
          // headroom, not height, is the informative number — see measureLayout.
          const room = p.headroom < 0 ? `OVER by ${(-p.headroom).toFixed(2)}px` : `${p.headroom.toFixed(2)}px free`;
          const LBL = cfg.labelsFor ? cfg.labelsFor(asType) : cfg.labels;
          console.log(`  ${(LBL[p.index] || 'page ' + p.index).padEnd(16)} ${p.height}px  ` +
                      `stack ${p.natural.toFixed(2)}px  ${room}${spill}`);
          // p10's verdict on a Z6 render is governed by that state's DECLARATION, compared
          // against the observation in the Z6 block below. This is not the 6A exemption and
          // nothing is suppressed: a missing declaration fails, a declared 'fits' that spills
          // fails, and a declared 'spills' that fits ALSO fails — which is the case an
          // exemption could never catch. The verdict is moved to where the declaration is,
          // not removed.
          const z6Governed = z6Key != null && p.index === z6PageIndex;
          if (cfg.enforceSheet && p.height > PAGE_PX + 1 && !z6Governed) {
            fail(`${kind}${asType == null ? '' : ' Type ' + asType} ${(cfg.labelsFor ? cfg.labelsFor(asType) : cfg.labels)[p.index] || 'page ' + p.index} spills to ${p.sheets} sheets (${p.height}px > ${PAGE_PX}px)`);
          }
        }
        const want = cfg.expectedFor ? cfg.expectedFor(asType) : cfg.expected;
        if (pages.length !== want) {
          fail(`${kind}${asType == null ? '' : ' Type ' + asType} page count ${pages.length}, expected ${want}`);
        }
        // ── §6.1 matched line counts — ENFORCED ──────────────────────────────────
        // Prints every pair for every built type, pass or fail, THEN fails on any that did not
        // match. Both halves matter: the print is the artefact content edits get measured
        // against, the fail is what stops an unmatched pair reaching a client.
        if (cfg.pairChecks && asType != null) {
          const idx = {};
          R.v3PagesFor(asType).forEach((pg, i) => { idx[pg.key] = i; });
          const rows = await lineMetrics.measurePairs(page, idx, cfg.pairChecks);
          for (const r of rows) {
            if (r.skipped) continue;               // sheet not built for this type
            const mark = r.missing ? '  ?? selector missed: ' + r.missing
                       : r.match ? '  ok' : '  *** MISMATCH';
            console.log(`  §6.1 pair  Type ${asType}  ${r.name.padEnd(24)} `
              + `${r.aLabel} ${String(r.a).padStart(2)} / ${r.bLabel} ${String(r.b).padStart(2)}${mark}`);
          }
          for (const r of rows) {
            if (r.skipped || r.match) continue;
            fail(r.missing
              ? `${kind} Type ${asType} §6.1 pair "${r.name}" could not be measured: selector missed ${r.missing}`
              : `${kind} Type ${asType} §6.1 pair "${r.name}" line counts differ: `
                + `${r.aLabel} ${r.a} / ${r.bLabel} ${r.b} — spec §6.1 requires them equal`);
          }
        }

        // ── §6 last-line fill outliers — REPORT-ONLY ──────────────────────────────
        if (cfg.geometry) {
          const g = cfg.geometry;
          const idxOf = Object.fromEntries(R.v3PagesFor(asType == null ? 9 : asType).map((p2, i) => [p2.key, i]));
          const got = await page.evaluate((pi) => {
            const pages = [...document.querySelectorAll('.v3-page')];
            const el = pages[pi];
            if (!el) return { missing: true };
            const body = el.querySelector('.v3-inst-body');
            const eb = el.querySelector('.v3-inst-eyebrow');
            if (!body || !eb) return { missing: true };
            const cs = getComputedStyle(body);
            const w = +(body.getBoundingClientRect().width
              - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)).toFixed(4);
            // Reservation, tested not inferred: pull the badge and re-read.
            const tag = eb.querySelector('.v3-inst-tag');
            const html = tag ? tag.outerHTML : null;
            if (tag) tag.remove();
            const noBadge = +eb.getBoundingClientRect().height.toFixed(2);
            if (html) eb.insertAdjacentHTML('beforeend', html);
            // Intrinsic, not the stretched card box.
            const intrinsic = [...el.querySelectorAll('.v3-inst-card')].map((c) => {
              const head = c.querySelector('.v3-inst-head').getBoundingClientRect().height;
              const b = c.querySelector('.v3-inst-body'), bc = getComputedStyle(b);
              let inner = 0;
              for (const kid of b.children) {
                const k = getComputedStyle(kid);
                inner += kid.getBoundingClientRect().height + parseFloat(k.marginTop) + parseFloat(k.marginBottom);
              }
              return +(head + parseFloat(bc.paddingTop) + inner + parseFloat(bc.paddingBottom)).toFixed(2);
            });
            const lead = el.querySelector('.v3-inst-lead');
            const leadGap = lead ? +parseFloat(getComputedStyle(lead).marginBottom).toFixed(2) : null;
            return { w, leadGap, eyebrow: +eb.getBoundingClientRect().height.toFixed(2), noBadge, intrinsic,
                     cardBox: +el.querySelector('.v3-inst-card').getBoundingClientRect().height.toFixed(2) };
          }, idxOf[g.pageKey]);
          if (got.missing) {
            fail(`${kind}${asType == null ? '' : ' Type ' + asType}: p10 geometry — page or .v3-inst-body/.v3-inst-eyebrow not found`);
          } else {
            if (Math.abs(got.w - g.colWidth) > g.tol) {
              fail(`${kind} Type ${asType}: p10 column content width ${got.w} != ${g.colWidth} — the SHIPPED page has drifted from docs/p10_fit_results.md`);
            }
            if (Math.abs(got.eyebrow - g.eyebrow) > g.tol) {
              fail(`${kind} Type ${asType}: p10 .v3-inst-eyebrow ${got.eyebrow} != ${g.eyebrow}`);
            }
            if (got.leadGap == null || Math.abs(got.leadGap - g.leadGap) > g.tol) {
              fail(`${kind} Type ${asType}: p10 lead bottom margin ${got.leadGap} != ${g.leadGap} — the zone spacing has drifted from the measured geometry`);
            }
            if (Math.abs(got.noBadge - g.eyebrow) > g.tol) {
              fail(`${kind} Type ${asType}: p10 badge row WITHOUT its badge is ${got.noBadge}, not ${g.eyebrow} — min-height is not reserving it`);
            }
            const tallest = Math.max(...got.intrinsic);
            console.log(`  p10 geometry: col ${got.w}px · lead-gap ${got.leadGap}px · eyebrow ${got.eyebrow}/${got.noBadge}px · intrinsic ${got.intrinsic.join('/')} (tallest ${tallest}, card box ${got.cardBox})`);
          }
        }

        if (cfg.fillZones && asType != null) {
          const idx = {};
          R.v3PagesFor(asType).forEach((pg, i) => { idx[pg.key] = i; });
          const zs = await lineMetrics.measureZones(page, idx, cfg.fillZones);
          for (const z of zs) {
            if (z.skipped) continue;
            const fill = z.fill == null ? 'n/a (single line)' : (z.fill * 100).toFixed(1) + '%';
            console.log(`  §6 fill    Type ${asType}  ${z.name.padEnd(24)} `
              + `${String(z.chars).padStart(3)}ch / ${z.lines}L  last-line ${fill}`);
          }
        }

        if (cfg.checkHyphens) {
          const hb = await findHyphenBreaks(page, cfg.selector);
          for (const b of hb) {
            fail(`${kind} word split across lines at an existing hyphen in .${b.cls}: ` +
                 `"…${b.before}" / "${b.after}…" — use U+2011, or a nowrap span for a URL`);
          }
          if (!hb.length) console.log('  hyphenation: no word split across lines');
        }
        // ── Z6 geometry — REPORT-ONLY (PR 4 step 6A) ──────────────────────────────────
        // Printed for every render carrying a Z6 axis, pass or fail. REPORT-ONLY IS
        // DELIBERATE and follows the PR 3d -> 3f precedent: the joined em_paragraph case
        // still spills at 1073.25px, so enforcing here would go red on every branch until
        // 6B lands the cap. Report-only buys the measured baseline that 6B's cap is read
        // against, exactly as V3_PAIRS did for the §6.1 line-count rule.
        //
        // The page gate above already reports and enforces the PAGE total. This block adds
        // the ZONE's own numbers — line count, box height, element count, <br> count and
        // last-line fill — because 6B's cap is stated in rendered lines, and a line count is
        // only a valid unit once the zone is a single element with no <br>. Element and <br>
        // counts are printed for exactly that reason: they are the preconditions, not decor.
        if (cfg.z6For) {
          await lineMetrics.install(page);
          const z6 = await page.evaluate(() => {
            const L = window.__lineMetrics;
            const p10 = [...document.querySelectorAll('.v3-page')].find((el) => el.querySelector('.v3-inst-cmp'));
            if (!p10) return null;
            const box = p10.querySelector('.v3-inst-resp');
            if (!box) return { absent: true };
            const els = [...p10.querySelectorAll('.v3-inst-resp-txt')];
            const last = els[els.length - 1];
            const fill = last ? L.lastLineFill(last) : null;
            return {
              els: els.length,
              brs: els.reduce((a, t) => a + t.querySelectorAll('br').length, 0),
              lines: els.reduce((a, t) => a + L.lineCount(t), 0),
              fill: fill == null ? null : +(fill * 100).toFixed(2),
              box: +box.getBoundingClientRect().height.toFixed(2),
            };
          });
          if (z6 && z6.absent) {
            console.log(`  ${'Z6 band'.padEnd(16)} no box — instinct_evidence is null or absent`);
          } else if (z6) {
            console.log(`  ${'Z6 band'.padEnd(16)} ${z6.lines} lines  box ${z6.box}px  ` +
                        `${z6.els} element(s)  ${z6.brs} <br>  ` +
                        `last-line fill ${z6.fill == null ? 'n/a (single line)' : z6.fill + '%'}`);
          }

          // ── THE CAP, AND THE DECLARATIONS (PR 4 step 6B) ───────────────────────────────
          //
          // WHAT THIS IS: a CI regression gate. It exists so that a producer change, a prompt
          // edit or a content edit that pushes Z6 past Z6_CAP_LINES rendered lines goes red
          // here before it ships.
          // WHAT IT IS NOT: protection for a client. Nothing in the production path measures
          // page height — app/generate_report.js:588 is a bare page.pdf() call, and this file
          // is a CI harness reached only through `npm run verify:render`.
          //
          // fail() is called ONLY when an observation contradicts its declaration, so a green
          // run keeps its ordinary meaning: everything matched what it said it would do. A
          // harness whose green depended on a failure having occurred would invert that.
          if (z6Key != null) {
            const decl = Z6_STATES[z6Key];
            const p10 = pages[z6PageIndex];
            // NO DEFAULT. A state that declares neither field cannot fall through to a
            // permissive assumption — it fails, by name.
            if (!decl || typeof decl.capLines !== 'number' || (decl.page !== 'fits' && decl.page !== 'spills')) {
              fail(`Z6 state "${z6Key}" is missing its capLines/page declaration — every state ` +
                   `named in z6For must declare both (tests/fixtures/instinct_axis.js)`);
            } else if (decl.renderedInMatrix === false) {
              // Keeps the label honest. A state marked "not rendered by the matrix" that IS
              // being rendered means the flag has gone stale — the comment on it would be
              // silently untrue, which is the thing the flag was added to prevent.
              fail(`Z6 state "${z6Key}" is marked renderedInMatrix: false but the matrix just ` +
                   `rendered it — update the flag in tests/fixtures/instinct_axis.js`);
            } else if (!p10) {
              fail(`Z6 state "${z6Key}": could not locate the p10 page to judge (index ${z6PageIndex})`);
            } else {
              const lines = z6 && !z6.absent ? z6.lines : 0;
              const spills = p10.height > PAGE_PX + 1;
              const obs = spills ? 'spills' : 'fits';
              console.log(`  ${'Z6 cap'.padEnd(16)} ${lines} lines vs cap ${Z6_CAP_LINES}  ` +
                          `declared ${decl.capLines} lines / ${decl.page}  observed ${lines} lines / ${obs}`);
              // EXACT, not a bound. A bound would let a state drift a line without notice.
              if (lines !== decl.capLines) {
                fail(`Z6 state "${z6Key}": declared ${decl.capLines} rendered lines, observed ${lines}`);
              }
              if (obs !== decl.page) {
                fail(`Z6 state "${z6Key}": declared page "${decl.page}", observed "${obs}" ` +
                     `(${p10.height}px against the ${PAGE_PX + 1}px gate)`);
              }
              // The cap itself. Only states that are supposed to fit are held to it; a state
              // declared to spill is the hazard case and is SUPPOSED to exceed.
              if (decl.page === 'fits' && lines > Z6_CAP_LINES) {
                fail(`Z6 state "${z6Key}": ${lines} rendered lines over the ${Z6_CAP_LINES}-line cap`);
              }
            }
          }
        }
        await page.pdf({ path: path.join(OUT, `${kind}_${tag}.pdf`), ...R.buildCoachPdfOptions() });
        await page.close();
        console.log(`  logical pages: ${pages.length} · estimated physical sheets: ${sheets} · wrote .phase6_out/${kind}_${tag}.pdf`);
       }
       }
       }
      }
     }
    }
  } finally { await browser.close(); }
  if (failed) { console.log('\nRENDER CHECK: FAILURES ABOVE.'); process.exit(1); }
  console.log('\nRENDER CHECK: ALL PASSED.');
})().catch(e => { console.error('RENDER FAILED:', e.stack || e.message); process.exit(1); });
