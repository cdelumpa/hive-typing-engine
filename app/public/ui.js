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

// Returns a cumulative count of questions answered so far (max 23).
// Used to drive the progress bar — no text or labels, just a fill width.
function getQuestionsAnswered() {
  const p = state.phase;
  if (p === 'welcome' || p === 'intake') return 0;
  if (p === 'confirmation' || p === 'results' || p === 'processing' || p === 'stage1complete') return 23;

  const a0 = state.stage0Answers || {};
  const s0 = ['q1', 'q2', 'q3', 'q4'].filter(k => a0[k] && String(a0[k]).trim()).length;
  if (p === 'stage0') return s0;
  if (p === 'mid-assessment-reminders') return 4;

  // stage1: idx = number of questions completed so far on this pass
  const s1 = (p === 'stage1') ? (state.stage1Idx || 0) : 10;
  if (p === 'stage1') return 4 + s1;

  // stage2
  const s2 = (p === 'stage2') ? (state.stage2Idx || 0) : 3;
  if (p === 'stage2') return 14 + s2;

  // stage3 and beyond: use array lengths for completed stages
  const s3 = (state.stage3Answers || []).length;
  if (p === 'stage3') return 17 + s3;

  const s4 = (state.stage4Answers || []).length;
  if (p === 'stage4') return 17 + s3 + s4;

  if (p === 'finalopen') return 17 + s3 + s4 + 1;

  return 23;
}

function updateProgress() {
  const wrap = document.getElementById('progress-bar-wrap');
  const bar  = document.getElementById('progress-bar');
  if (!wrap || !bar) return;
  const p = state.phase;
  if (p === 'welcome' || p === 'intake') {
    wrap.style.display = 'none';
    return;
  }
  // The mid-assessment-reminders screen uses its own inline progress markup,
  // so suppress the shared bar to avoid double-rendering.
  if (p === 'mid-assessment-reminders') {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  const pct = Math.min(100, Math.round((getQuestionsAnswered() / 23) * 100));
  bar.style.width = pct + '%';
}