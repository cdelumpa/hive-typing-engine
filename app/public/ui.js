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

// Question stages in flow order — used for cumulative progress accounting.
const PROGRESS_ORDER = ['stage0', 'stage1', 'stage2', 'stage3', 'stage4', 'finalopen'];

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

function overallTotalScreens() {
  return PROGRESS_ORDER.reduce((sum, ph) => sum + stageDotTotal(ph), 0);
}

// Cumulative screens completed up to and including the current phase. Returns
// null for non-question phases. Interstitials report the cumulative total at the
// boundary of the stage they follow.
function completedScreens() {
  const p = state.phase;
  const s1 = stageDotTotal('stage1');
  const s3 = stageDotTotal('stage3');
  const before = {
    stage0: 0,
    'mid-assessment-reminders': 4,
    stage1: 4,
    'ct-analyzing': 4 + s1,
    stage2: 4 + s1,
    'call1-analyzing': 4 + s1 + 3,
    stage3: 4 + s1 + 3,
    stage4: 4 + s1 + 3 + s3,
    finalopen: 4 + s1 + 3 + s3 + stageDotTotal('stage4'),
  };
  if (before[p] == null) return null;
  return PROGRESS_ORDER.includes(p) ? before[p] + stageDotIndex(p) : before[p];
}

// Overall completion fraction (0-1) for the global progress bar. Pre-assessment
// phases read 0; terminal phases read 1.
function overallFraction() {
  const p = state.phase;
  if (p === 'welcome' || p === 'intake' || p === 'profile-confirm' || p === 'orientation' || p === 'resume') return 0;
  if (p === 'confirmation' || p === 'results' || p === 'processing' || p === 'error' || p === 'stage1complete') return 1;
  const done = completedScreens();
  if (done == null) return 0;
  const total = overallTotalScreens();
  return total > 0 ? Math.min(1, done / total) : 0;
}

// Chrome reads this for the global bar + sub-progress strip.
function progressFor(phase) {
  return {
    stageLabel: STAGE_LABELS[phase] || null,
    pct:        Math.round(overallFraction() * 100),
    dotIndex:   stageDotIndex(phase),
    dotTotal:   stageDotTotal(phase),
  };
}

// Live-update the global bar width without a full re-render. No-ops when the bar
// isn't in the DOM (no-progress chrome variants). Reserved for PR4's slider nudge.
function updateProgress() {
  const bar = document.getElementById('gp-fill');
  if (bar) bar.style.width = Math.round(overallFraction() * 100) + '%';
}