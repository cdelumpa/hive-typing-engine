'use strict';
/**
 * retype_fixture.js — re-type an api_result fixture to another Enneagram type (PR 6 Build B1).
 *
 * Moved verbatim out of scripts/render_client.js, where it was an inline closure in the render loop,
 * so the render harness, scripts/verify_devideas_fit.js and scripts/smoke_sheet11.js re-type one
 * way. Three copies of this recipe had already appeared; the next one would have drifted.
 */

/**
 * Re-type a fixture to `asType`: the scalars and the ranking together, with the client's own quotes
 * withheld from any type but the fixture's. The body is unchanged from render_client.js, comments included.
 */
function retypeFixture(fixture, asType) {
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
}

module.exports = { retypeFixture };
