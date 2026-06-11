// =================== HELPERS ===================

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

// =================== TYPE LIBRARY ===================

let typeLibrary = null;

async function loadTypeLibrary() {
  if (typeLibrary) return typeLibrary;
  try {
    const res = await fetch('/content/type_library.json');
    typeLibrary = await res.json();
    console.log('[typeLib] loaded version', typeLibrary._meta?.version);
  } catch (e) {
    console.error('[typeLib] failed to load:', e.message);
    typeLibrary = { static_primers: {}, types: {} };
  }
  return typeLibrary;
}

// Return type data for the confirmed type number (as string key).
function typeData(typeNum) {
  return (typeLibrary && typeLibrary.types && typeLibrary.types[String(typeNum)]) || null;
}

// Render an array of strings as separate <p> tags (per schema convention).
function renderParas(arr, style) {
  if (!arr || !Array.isArray(arr)) return '';
  const s = style || 'margin:0 0 14px;';
  return arr.map((p) => `<p style="${s}">${esc(p)}</p>`).join('');
}

// Render a single string that may contain \n\n as separate <p> tags.
// Secondary split: if a segment exceeds ~150 words, break at sentence boundaries every 4 sentences.
function renderMultiPara(str, style) {
  if (!str) return '';
  const s = style || 'margin:0 0 14px;';
  const rawSegs = str.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const segs = [];
  for (const seg of rawSegs) {
    if (seg.split(/\s+/).length > 150) {
      const sentences = seg.match(/[^.!?]*[.!?]+(?:\s+|$)/g) || [seg];
      let chunk = '', count = 0;
      for (const sent of sentences) {
        chunk += sent;
        count++;
        if (count >= 4) { segs.push(chunk.trim()); chunk = ''; count = 0; }
      }
      if (chunk.trim()) segs.push(chunk.trim());
    } else {
      segs.push(seg);
    }
  }
  return segs.map((p) => `<p style="${s}">${esc(p)}</p>`).filter(p => p !== `<p style="${s}"></p>`).join('');
}

// =================== PROGRESS / CHROME META ===================
//
// Single source of truth for the chrome's global progress bar (stage label + %)
// and the sub-progress dot strip ("Screen N of N"). Replaces the old hard /23
// denominator. PR1 seeds counts from the current screen model (Stage 1 derived
// from STAGE1_SCREENS.length); the ~27 recalibration lands with PR4's 9-screen
// Stage 1 rebuild (decision D1). Stage 3/4 counts are dynamic — read from state
// after routing resolves (spec §4/§8).

// Global-bar stage labels (spec §3.4). Phases absent here render no stage label.
const STAGE_LABELS = {
  stage0:    'Warmup',
  stage1:    'Part 1',
  stage2:    'Part 2',
  stage3:    'Part 3',
  stage4:    'Part 4',
  finalopen: 'Part 4',
};

// Part-complete interstitials use a fixed label + percentage and the orange
// progress treatment (§0D/§0F). These override the cumulative computation.
const PHASE_FIXED = {
  'part1-complete': { label: 'PART 1 COMPLETE', pct: 42 },
  'part2-complete': { label: 'PART 2 COMPLETE', pct: 68 },
};

// Screen (dot) count for a question stage. Fixed for Stage 0/1/2; dynamic for
// Stage 3/4. Stage 1 reads STAGE1_SCREENS.length so PR4's rebuild flows through.
function stageDotTotal(phase) {
  switch (phase) {
    case 'stage0': return 4;
    case 'stage1': return (typeof STAGE1_SCREENS !== 'undefined') ? STAGE1_SCREENS.length : 14;
    case 'stage2': return 3;
    case 'stage3':
      return (state.scores && state.scores.stage3Pair && state.scores.stage3Pair.fireQ2) ? 2 : 1;
    case 'stage4':
      return (state.stage4Sequence && state.stage4Sequence.length) ? state.stage4Sequence.length : 2;
    case 'finalopen': return 1;
    default: return 0;
  }
}

// 0-based index of the current screen within its stage (highlighted dot).
function stageDotIndex(phase) {
  switch (phase) {
    case 'stage0': return state.stage0Idx || 0;
    case 'stage1': return state.stage1Idx || 0;
    case 'stage2': return state.stage2Idx || 0;
    case 'stage3': return state.stage3Idx || 0;
    case 'stage4': return state.stage4Idx || 0;
    default: return 0;
  }
}

// Overall completion fraction (0-1) for the global progress bar. Part-anchored
// model (Decision A / Option 2): the fixed interstitial percentages are the part
// boundaries, and stage screens interpolate within each band — so the bar is
// monotonic (no backward jump at the orange interstitials) while still reflecting
// the screen count within each part. Bands:
//   Warmup 0→12 · Part 1 12→42 · Part 2 42→68 · Parts 3 & 4 68→100
// (part1-complete = 42 and part2-complete = 68 are returned by PHASE_FIXED, which
// coincide exactly with the band endpoints.) Pre-assessment phases read 0;
// terminal phases read 1.
function overallFraction() {
  const p = state.phase;
  if (PHASE_FIXED[p]) return PHASE_FIXED[p].pct / 100;
  if (p === 'welcome' || p === 'intake' || p === 'profile-confirm' || p === 'orientation' || p === 'resume') return 0;
  if (p === 'confirmation' || p === 'results' || p === 'processing' || p === 'error') return 1;

  // Interpolate from lo→hi (percent) by screens completed within the band.
  const lerp = (lo, hi, done, total) => (lo + (total > 0 ? (done / total) * (hi - lo) : 0)) / 100;
  switch (p) {
    case 'stage0': return lerp(0,  12, stageDotIndex('stage0'), stageDotTotal('stage0'));
    case 'stage1': return lerp(12, 42, stageDotIndex('stage1'), stageDotTotal('stage1'));
    case 'stage2': return lerp(42, 68, stageDotIndex('stage2'), stageDotTotal('stage2'));
    case 'stage3':
    case 'stage4':
    case 'finalopen': {
      // Parts 3 & 4 + the final open response share one 68→100 band.
      const s3 = stageDotTotal('stage3'), s4 = stageDotTotal('stage4');
      const total = s3 + s4 + 1;
      const done = p === 'stage3' ? stageDotIndex('stage3')
                 : p === 'stage4' ? s3 + stageDotIndex('stage4')
                 : s3 + s4; // finalopen — the last screen of the band
      return lerp(68, 100, done, total);
    }
    default: return 0;
  }
}

// Chrome reads this for the global bar + sub-progress strip.
function progressFor(phase) {
  let dotIndex = stageDotIndex(phase);
  let dotTotal = stageDotTotal(phase);

  // §6.5 dot trail: Stage 4 and the final open response form ONE continuous Part 4
  // trail of (stage4Sequence.length + 1) dots — the final open is its last dot. So
  // Stage 4 screens read "Screen N of M+1" (no denominator jump at the final open),
  // and the final open reads "Screen M+1 of M+1" (fully filled = assessment done).
  // Localized here so overallFraction (which sums stage4 + 1 separately) is untouched.
  if (phase === 'stage4' || phase === 'finalopen') {
    const m = (state.stage4Sequence && state.stage4Sequence.length) || 2;
    dotTotal = m + 1;
    dotIndex = phase === 'finalopen' ? m : (state.stage4Idx || 0);
  }

  return {
    stageLabel: PHASE_FIXED[phase] ? PHASE_FIXED[phase].label : (STAGE_LABELS[phase] || null),
    pct:        Math.round(overallFraction() * 100),
    dotIndex:   dotIndex,
    dotTotal:   dotTotal,
  };
}

// =================== RESUME PROGRESS (§0G) ===================
//
// The Resume screen uses a SEGMENT-WEIGHT model that is intentionally distinct
// from the chrome's part-anchored overallFraction. Per §0G.4 the four parts carry
// flex weights Warmup 1 · Part 1 3 · Part 2 1 · Parts 3 & 4 1.5 (total 6.5), and
// the overall % is (completed-part weights + current-part fraction × its weight)
// / 6.5. screens_done counts the current screen (dotIndex + 1), so "screen 8 of 14"
// reads 8/14 and the badge shows 42% — matching the §0G worked example exactly.
const RESUME_SEGMENTS = [
  { key: 'warmup', label: 'Warmup', weight: 1 },
  { key: 'part1',  label: 'Part 1', weight: 3 },
  { key: 'part2',  label: 'Part 2', weight: 1 },
  { key: 'part34', label: 'Part 4', weight: 1.5 }, // Parts 3 & 4 combined (§0G.4)
];

// Map a saved (resume-target) phase → { segIdx, label, done, total } where done/total
// are screens within the current part. Part labels are part-only per Decision B.
function resumePartInfo(phase) {
  const s3 = stageDotTotal('stage3');
  const s4 = stageDotTotal('stage4');
  const p34Total = s3 + s4 + 1; // Parts 3 & 4 + final open share one trail (§6.5)
  switch (phase) {
    case 'stage0':
      return { segIdx: 0, label: 'Warmup', done: (state.stage0Idx || 0) + 1, total: stageDotTotal('stage0') };
    case 'stage1':
      return { segIdx: 1, label: 'Part 1', done: (state.stage1Idx || 0) + 1, total: stageDotTotal('stage1') };
    case 'part1-complete':
      return { segIdx: 1, label: 'Part 1', done: stageDotTotal('stage1'), total: stageDotTotal('stage1') };
    case 'stage2':
      return { segIdx: 2, label: 'Part 2', done: (state.stage2Idx || 0) + 1, total: stageDotTotal('stage2') };
    case 'part2-complete':
      return { segIdx: 2, label: 'Part 2', done: stageDotTotal('stage2'), total: stageDotTotal('stage2') };
    case 'stage3':
      return { segIdx: 3, label: 'Part 3', done: (state.stage3Idx || 0) + 1, total: p34Total };
    case 'stage4':
      return { segIdx: 3, label: 'Part 4', done: s3 + (state.stage4Idx || 0) + 1, total: p34Total };
    case 'finalopen':
      return { segIdx: 3, label: 'Part 4', done: p34Total, total: p34Total };
    default:
      return { segIdx: 0, label: 'Warmup', done: 1, total: stageDotTotal('stage0') };
  }
}

// Full resume progress payload for renderResume: current part, screen position,
// per-segment fill fractions, and the segment-weighted overall %.
function resumeProgress(phase) {
  const part = resumePartInfo(phase);
  const frac = part.total > 0 ? Math.min(1, part.done / part.total) : 0;
  const completedWeight = RESUME_SEGMENTS.slice(0, part.segIdx).reduce((s, x) => s + x.weight, 0);
  const totalWeight = RESUME_SEGMENTS.reduce((s, x) => s + x.weight, 0);
  const pct = Math.round(((completedWeight + frac * RESUME_SEGMENTS[part.segIdx].weight) / totalWeight) * 100);
  const segments = RESUME_SEGMENTS.map((seg, i) => ({
    weight: seg.weight,
    state: i < part.segIdx ? 'done' : (i === part.segIdx ? 'current' : 'upcoming'),
    fill:  i < part.segIdx ? 1 : (i === part.segIdx ? frac : 0),
  }));
  return { segIdx: part.segIdx, label: part.label, done: part.done, total: part.total, pct, segments };
}

// Live-update the global bar width without a full re-render. No-ops when the bar
// isn't in the DOM (no-progress chrome variants). Reserved for PR4's slider nudge.
function updateProgress() {
  const bar = document.getElementById('gp-fill');
  if (bar) bar.style.width = Math.round(overallFraction() * 100) + '%';
}