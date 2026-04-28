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

// =================== PROGRESS ===================

function totalSteps() {
  // Stage 3 max = 2 questions; Stage 4 max = 3 (Stress + Security + optional Habit).
  // Non-★ pairs + clean Stage 4 will finish a few steps early — acceptable.
  return (
    1 + // welcome
    4 + // stage 0
    10 + // stage 1
    3 + // stage 2
    2 + // stage 3 (max)
    3 + // stage 4 (max)
    1   // finalopen
  );
}

function currentStep() {
  const phaseOrder = {
    welcome: 0,
    intake: 0,
    stage0: 1 + state.stage0Idx,
    stage1: 5 + state.stage1Idx,
    stage2: 15 + state.stage2Idx,
    stage3: 18 + state.stage3Idx,
    stage4: 20 + state.stage4Idx,
    finalopen: 23,
    stage1complete: 24,
    processing: 24,
    confirmation: 24,
    results: 24,
    error: 24,
  };
  return phaseOrder[state.phase] || 0;
}

function updateProgress() {
  const pct = Math.round((currentStep() / totalSteps()) * 100);
  document.getElementById('progress-bar').style.width = Math.min(pct, 100) + '%';
}