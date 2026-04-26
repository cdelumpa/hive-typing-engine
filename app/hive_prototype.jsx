import { useState } from "react";

// ─── Sample Data ──────────────────────────────────────────────────────────────
const SAMPLE_DATA = {
  stage0_q1: "driven, focused, adaptable, high-achieving, warm",
  stage0_q2: "ambitious, charismatic, gets things done, a little intense sometimes, inspiring",
  stage0_q3: "adaptable — I can read any room and show up the way it needs me to",
  stage0_q4: "intense — I push hard and sometimes I lose sight of slowing down",
  head_score: 9, heart_score: 15, body_score: 12,
  identified_center: "Heart", center_gap: 3, center_confidence: "MEDIUM", second_center: "Body",
  sp_score: 5, so_score: 11, sx_score: 8,
  identified_instinct: "SO", instinct_gap: 3, instinct_confidence: "MEDIUM",
  type_hypothesis_1: 3, type_hypothesis_2: 8, type_hypothesis_3: 6,
  counter_type_flag: "NO", counter_type_combination: null,
  xref_q1: "A", xref_q2: "C", xref_q3: "A",
  xref_primary: 3, xref_alternative: 8,
  xref_ambiguity_axis: "image management vs. power and control",
  xref_counter_type: "NO",
  s3_mode: "STANDARD", s3_pair: "3 vs. 8",
  s3_q1_result: "Person A — Type 3 core motivation resonated clearly",
  s3_q2_result: "Person A — Type 3 avoidance of failure confirmed",
  s3_leading: 3, s3_confidence: "HIGH", s3_ct_answer: "N/A",
  s4_path: "STANDARD", s4_option: "A",
  s4_stress_confirmed: true, s4_security_confirmed: true,
  s4_habit_confirmed: null, s4_outcome: "CONFIRMED"
};

const SYSTEM_PROMPT = `You are an expert Enneagram typing assistant trained in the Narrative Enneagram tradition. You work with Cai Delumpa, a certified Narrative Enneagram teacher and coach.

All typing is hypothesis-driven — never definitive. Use cautious, exploratory language throughout.

CRITICAL: Return your complete analysis as a single JSON object. No text, explanation, markdown, or code fences outside the JSON.

Return this exact structure:
{
  "hypothesis": {
    "confirmed_type": <integer 1-9>,
    "confirmed_type_name": <string>,
    "confidence_level": <"HIGH"|"MEDIUM_HIGH"|"MEDIUM"|"LOW">,
    "confirmed_instinct": <"SP"|"SO"|"SX"|"UNCERTAIN">,
    "instinct_confidence": <"HIGH"|"MEDIUM"|"LOW">,
    "counter_type_confirmed": <boolean>,
    "counter_type_combination": <string or null>,
    "second_candidate_type": <integer or null>,
    "stage4_outcome": <"CONFIRMED"|"CONFIRMED_WITH_NOTE"|"AMBIGUOUS"|"REDIRECT">
  },
  "flags": [{"flag_type": <string>, "description": <string>}],
  "stage0_analysis": {
    "idealization_match": <boolean>,
    "shadow_match": <boolean>,
    "notable_language": <string>
  },
  "stage2_analysis": {
    "hornevian_result": <string>,
    "harmonic_result": <string>,
    "object_relations_result": <string>,
    "framework_alignment": <"ALIGNED"|"PARTIAL"|"DIVERGENT">
  },
  "stage4_analysis": {
    "stress_point_description": <string>,
    "security_point_description": <string>,
    "habit_of_mind_description": <string or null>
  },
  "holistic_analysis": {
    "stage0_coherence": <string>,
    "cross_stage_consistency": <string>,
    "instinct_coherence": <string>,
    "alternative_type_signal": <string or null>,
    "confidence_adjustment": <string>
  },
  "type_overview": {
    "worldview": <string — 2 sentences>,
    "core_motivation": <string — 1 sentence>,
    "strengths": [<string>, <string>, <string>],
    "challenges": [<string>, <string>, <string>],
    "instinct_notes": <string — 2 sentences about this instinct flavor>,
    "stress_point_insight": <string — 2 sentences framed as growth insight>,
    "security_point_insight": <string — 2 sentences framed as growth insight>
  },
  "client_narrative": <string — 3-4 warm sentences using client's own words>,
  "coach_note": <string — 2-3 direct sentences citing evidence, naming one probe>,
  "session_probes": [<string>, <string>, <string>]
}`;

function buildUserPrompt(d) {
  return `Analyze this completed Enneagram assessment.

STAGE 0 — OPEN TEXT
Self-description: "${d.stage0_q1}"
Others' description: "${d.stage0_q2}"
Greatest strength: "${d.stage0_q3}"
Most problematic quality: "${d.stage0_q4}"

STAGE 1 — CENTERS
Heart: ${d.heart_score}/18 | Head: ${d.head_score}/18 | Body: ${d.body_score}/18
Identified Center: ${d.identified_center} | Gap: ${d.center_gap} | Confidence: ${d.center_confidence}
Second candidate: ${d.second_center}

STAGE 1 — INSTINCTS
SO: ${d.so_score}/12 | SX: ${d.sx_score}/12 | SP: ${d.sp_score}/12
Identified Instinct: ${d.identified_instinct} | Gap: ${d.instinct_gap} | Confidence: ${d.instinct_confidence}

STAGE 1 — HYPOTHESES
Three type hypotheses: ${d.type_hypothesis_1}, ${d.type_hypothesis_2}, ${d.type_hypothesis_3}
Counter-type flag: ${d.counter_type_flag}

STAGE 2 — CROSS-REFERENCING
Q1 Hornevian: ${d.xref_q1} (A=Assertive/B=Compliant/C=Withdrawn)
Q2 Harmonic: ${d.xref_q2} (A=Intensity/B=Positive/C=Competency)
Q3 Object Relations: ${d.xref_q3} (A=Attachment/B=Frustration/C=Rejection)
Primary hypothesis: Type ${d.xref_primary} | Live alternative: Type ${d.xref_alternative}
Ambiguity axis: ${d.xref_ambiguity_axis}

STAGE 3 — PAIRWISE DISCRIMINATION
Mode: ${d.s3_mode} | Pair: ${d.s3_pair}
Q1 result: ${d.s3_q1_result}
Q2 result: ${d.s3_q2_result}
Leading hypothesis: Type ${d.s3_leading} | Confidence: ${d.s3_confidence}

STAGE 4 — CONFIRMATION
Path: ${d.s4_path} | Option: ${d.s4_option}
Stress confirmed: ${d.s4_stress_confirmed}
Security confirmed: ${d.s4_security_confirmed}
Habit confirmed: ${d.s4_habit_confirmed}
Outcome: ${d.s4_outcome}`;
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  teal: "#2E86AB", darkTeal: "#1A5C7A", lightTeal: "#E8F4F8",
  gold: "#B8860B", lightGold: "#FFF8E7",
  dark: "#1a1a2e", mid: "#555", light: "#888",
  bg: "#f8f9fa", white: "#ffffff",
  green: "#2E7D32", greenBg: "#E8F5E9",
  orange: "#E65100", orangeBg: "#FFF3E0",
  red: "#C62828", redBg: "#FFEBEE",
};

// ─── Confidence Badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ level }) {
  const map = {
    HIGH: [C.green, C.greenBg],
    MEDIUM_HIGH: [C.orange, C.orangeBg],
    MEDIUM: [C.orange, C.orangeBg],
    LOW: [C.red, C.redBg],
  };
  const [color, bg] = map[level] || [C.mid, C.bg];
  return (
    <span style={{
      display: "inline-block", padding: "3px 12px", borderRadius: 20,
      background: bg, color, fontWeight: 700, fontSize: 12, letterSpacing: "0.05em"
    }}>
      {level.replace("_", "-")}
    </span>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ title, children, gold = false }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: gold ? C.gold : C.teal,
        marginBottom: 10, paddingBottom: 6,
        borderBottom: `2px solid ${gold ? C.gold : C.teal}`
      }}>{title}</div>
      {children}
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.teal, textTransform: "uppercase",
        letterSpacing: "0.08em", minWidth: 140, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.dark, lineHeight: 1.5, flex: 1 }}>{value}</span>
    </div>
  );
}

// ─── Flag Item ────────────────────────────────────────────────────────────────
function FlagItem({ flag }) {
  return (
    <div style={{
      background: C.lightGold, borderLeft: `3px solid ${C.gold}`,
      padding: "8px 12px", marginBottom: 8, borderRadius: "0 4px 4px 0"
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.gold,
        textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
        {flag.flag_type.replace(/_/g, " ")}
      </div>
      <div style={{ fontSize: 12, color: C.dark, lineHeight: 1.5 }}>{flag.description}</div>
    </div>
  );
}

// ─── Report Tab — Client ──────────────────────────────────────────────────────
function ClientReport({ result }) {
  const h = result.hypothesis;
  const to = result.type_overview || {};
  const s4 = result.stage4_analysis || {};

  return (
    <div style={{ fontFamily: "Georgia, serif", color: C.dark, lineHeight: 1.6 }}>

      {/* Header */}
      <div style={{
        textAlign: "center", paddingBottom: 24, marginBottom: 28,
        borderBottom: `3px solid ${C.teal}`
      }}>
        <div style={{ fontSize: 11, color: C.light, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: 6 }}>Your Enneagram</div>
        <div style={{ fontSize: 42, fontWeight: 700, color: C.teal, lineHeight: 1.1, marginBottom: 4 }}>
          Type {h.confirmed_type}
        </div>
        <div style={{ fontSize: 20, color: C.mid, marginBottom: 12 }}>{h.confirmed_type_name}</div>
        <ConfidenceBadge level={h.confidence_level} />
      </div>

      {/* Note on result */}
      <Section title="A Note on This Result">
        <p style={{ fontSize: 13, color: C.dark, margin: 0, fontStyle: "italic" }}>
          Based on your responses, the pattern that appears most consistent with your experience
          is <strong>Type {h.confirmed_type} — {h.confirmed_type_name}</strong>. This is a hypothesis,
          not a verdict. We hope it feels like recognition rather than assignment. If it resonates,
          wonderful. If it doesn't fully fit, that's important information too. Your session with Cai
          is the right place to explore what fits, what doesn't, and why.
        </p>
      </Section>

      {/* Narrative */}
      <Section title="What We Noticed About You">
        <p style={{ fontSize: 14, color: C.darkTeal, fontStyle: "italic",
          background: C.lightTeal, padding: "14px 18px", borderRadius: 6,
          borderLeft: `4px solid ${C.teal}`, margin: 0, lineHeight: 1.7 }}>
          {result.client_narrative}
        </p>
      </Section>

      {/* Type Overview */}
      <Section title="Your Type at a Glance">
        {to.worldview && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.teal,
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              How You See the World
            </div>
            <p style={{ fontSize: 13, margin: "0 0 14px" }}>{to.worldview}</p>
          </>
        )}
        {to.core_motivation && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.teal,
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Core Motivation
            </div>
            <p style={{ fontSize: 13, margin: "0 0 14px" }}>{to.core_motivation}</p>
          </>
        )}
        {to.strengths && to.challenges && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
            <div style={{ background: C.lightTeal, padding: "12px 16px", borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.teal,
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Strengths
              </div>
              {to.strengths.map((s, i) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 4, display: "flex", gap: 8 }}>
                  <span style={{ color: C.teal }}>+</span> {s}
                </div>
              ))}
            </div>
            <div style={{ background: C.lightGold, padding: "12px 16px", borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.gold,
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Challenges
              </div>
              {to.challenges.map((c, i) => (
                <div key={i} style={{ fontSize: 12, marginBottom: 4, display: "flex", gap: 8 }}>
                  <span style={{ color: C.gold }}>–</span> {c}
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Instinct */}
      {to.instinct_notes && (
        <Section title={`Your Instinct — ${h.confirmed_instinct}`}>
          <p style={{ fontSize: 13, margin: 0 }}>{to.instinct_notes}</p>
        </Section>
      )}

      {/* Stress and Security */}
      <Section title="How Your Type Moves Through Stress and Ease">
        {to.stress_point_insight && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.teal,
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              Under Stress
            </div>
            <p style={{ fontSize: 13, margin: "0 0 6px" }}>{to.stress_point_insight}</p>
            {s4.stress_point_description && (
              <p style={{ fontSize: 12, color: C.mid, margin: 0, fontStyle: "italic" }}>
                In your responses: {s4.stress_point_description}
              </p>
            )}
          </div>
        )}
        {to.security_point_insight && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.teal,
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              When at Ease
            </div>
            <p style={{ fontSize: 13, margin: "0 0 6px" }}>{to.security_point_insight}</p>
            {s4.security_point_description && (
              <p style={{ fontSize: 12, color: C.mid, margin: 0, fontStyle: "italic" }}>
                In your responses: {s4.security_point_description}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Session Probes */}
      {result.session_probes?.length > 0 && (
        <Section title="What to Explore With Cai">
          <p style={{ fontSize: 13, color: C.mid, marginBottom: 10 }}>
            These questions emerged from your assessment as particularly worth exploring in session:
          </p>
          {result.session_probes.map((p, i) => (
            <div key={i} style={{
              padding: "8px 14px", marginBottom: 6,
              background: C.bg, borderRadius: 4,
              fontSize: 13, display: "flex", gap: 10
            }}>
              <span style={{ color: C.teal, fontWeight: 700 }}>{i + 1}.</span>
              <span>{p}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

// ─── Report Tab — Coach ───────────────────────────────────────────────────────
function CoachReport({ result }) {
  const h = result.hypothesis;
  const s0 = result.stage0_analysis || {};
  const s2 = result.stage2_analysis || {};
  const s4 = result.stage4_analysis || {};
  const ha = result.holistic_analysis || {};
  const flags = result.flags || [];

  return (
    <div style={{ fontFamily: "Georgia, serif", color: C.dark, lineHeight: 1.6 }}>

      {/* Header */}
      <div style={{
        paddingBottom: 20, marginBottom: 24,
        borderBottom: `3px solid ${C.gold}`
      }}>
        <div style={{ fontSize: 11, color: C.light, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: 4 }}>Coach Report — Confidential</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.teal, marginBottom: 6 }}>
          Type {h.confirmed_type} {h.confirmed_instinct} — {h.confirmed_type_name}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <ConfidenceBadge level={h.confidence_level} />
          <span style={{ fontSize: 12, color: C.mid }}>
            Instinct confidence: {h.instinct_confidence}
          </span>
          <span style={{ fontSize: 12, color: C.mid }}>
            Stage 4: {h.stage4_outcome}
          </span>
          {h.second_candidate_type && (
            <span style={{ fontSize: 12, color: C.mid }}>
              Second candidate: Type {h.second_candidate_type}
            </span>
          )}
        </div>
      </div>

      {/* Coach Note */}
      <Section title="Coach Note" gold>
        <p style={{ fontSize: 14, color: C.darkTeal, fontStyle: "italic",
          background: C.lightGold, padding: "14px 18px", borderRadius: 6,
          borderLeft: `4px solid ${C.gold}`, margin: 0, lineHeight: 1.7 }}>
          {result.coach_note}
        </p>
      </Section>

      {/* Stage 0 */}
      <Section title="Stage 0 — Language Analysis" gold>
        <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
          <div style={{
            padding: "8px 14px", borderRadius: 4,
            background: s0.idealization_match ? C.greenBg : C.redBg,
            color: s0.idealization_match ? C.green : C.red,
            fontSize: 12, fontWeight: 700
          }}>
            Idealization {s0.idealization_match ? "✓ Match" : "✗ No Match"}
          </div>
          <div style={{
            padding: "8px 14px", borderRadius: 4,
            background: s0.shadow_match ? C.greenBg : C.redBg,
            color: s0.shadow_match ? C.green : C.red,
            fontSize: 12, fontWeight: 700
          }}>
            Shadow {s0.shadow_match ? "✓ Match" : "✗ No Match"}
          </div>
        </div>
        {s0.notable_language && (
          <InfoRow label="Notable Language" value={s0.notable_language} />
        )}
      </Section>

      {/* Stage 2 */}
      <Section title="Stage 2 — Cross-Referencing" gold>
        <InfoRow label="Hornevian" value={s2.hornevian_result} />
        <InfoRow label="Harmonic" value={s2.harmonic_result} />
        <InfoRow label="Object Relations" value={s2.object_relations_result} />
        <InfoRow label="Framework Alignment" value={s2.framework_alignment} />
      </Section>

      {/* Stage 4 */}
      <Section title="Stage 4 — Confirmation" gold>
        {s4.stress_point_description && (
          <InfoRow label="Stress Point" value={s4.stress_point_description} />
        )}
        {s4.security_point_description && (
          <InfoRow label="Security Point" value={s4.security_point_description} />
        )}
        {s4.habit_of_mind_description && (
          <InfoRow label="Habit of Mind" value={s4.habit_of_mind_description} />
        )}
      </Section>

      {/* Holistic Analysis */}
      <Section title="Holistic Analysis — Task 5" gold>
        {ha.stage0_coherence && <InfoRow label="Stage 0 Coherence" value={ha.stage0_coherence} />}
        {ha.cross_stage_consistency && <InfoRow label="Cross-Stage" value={ha.cross_stage_consistency} />}
        {ha.instinct_coherence && <InfoRow label="Instinct Coherence" value={ha.instinct_coherence} />}
        <InfoRow label="Alt Type Signal" value={ha.alternative_type_signal || "None identified"} />
        {ha.confidence_adjustment && <InfoRow label="Confidence" value={ha.confidence_adjustment} />}
      </Section>

      {/* Flags */}
      <Section title={`Flags (${flags.length} identified)`} gold>
        {flags.length === 0 ? (
          <p style={{ fontSize: 13, color: C.mid }}>No flags identified.</p>
        ) : (
          flags.map((f, i) => <FlagItem key={i} flag={f} />)
        )}
      </Section>

      {/* Session Probes */}
      {result.session_probes?.length > 0 && (
        <Section title="Suggested Session Probes" gold>
          {result.session_probes.map((p, i) => (
            <div key={i} style={{
              padding: "8px 14px", marginBottom: 6,
              background: C.lightGold, borderRadius: 4,
              fontSize: 13, display: "flex", gap: 10
            }}>
              <span style={{ color: C.gold, fontWeight: 700 }}>{i + 1}.</span>
              <span>{p}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

// ─── Download Helpers ─────────────────────────────────────────────────────────
function triggerDownload(html, filename) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildClientHTML(result) {
  const h = result.hypothesis;
  const to = result.type_overview || {};
  const s4 = result.stage4_analysis || {};
  const probes = result.session_probes || [];

  const confidenceColors = {
    HIGH: ["#2E7D32", "#E8F5E9"],
    MEDIUM_HIGH: ["#E65100", "#FFF3E0"],
    MEDIUM: ["#E65100", "#FFF3E0"],
    LOW: ["#C62828", "#FFEBEE"],
  };
  const [badgeColor, badgeBg] = confidenceColors[h.confidence_level] || ["#555", "#f5f5f5"];

  const strengthsHTML = (to.strengths || []).map(s =>
    `<div style="font-size:13px;margin-bottom:5px;"><span style="color:#2E86AB">+</span> ${s}</div>`
  ).join("");

  const challengesHTML = (to.challenges || []).map(c =>
    `<div style="font-size:13px;margin-bottom:5px;"><span style="color:#B8860B">–</span> ${c}</div>`
  ).join("");

  const probesHTML = probes.map((p, i) =>
    `<div style="padding:8px 14px;margin-bottom:6px;background:#f8f9fa;border-radius:4px;font-size:13px;">
      <strong style="color:#2E86AB">${i + 1}.</strong> ${p}
    </div>`
  ).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Client Report — Type ${h.confirmed_type}</title>
<style>
  @media print { body { margin: 0; } @page { margin: 2cm; } }
  body { font-family: Georgia, serif; color: #1a1a2e; line-height: 1.6;
    max-width: 680px; margin: 40px auto; padding: 0 24px; font-size: 13px; }
  h2 { font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: #2E86AB; margin: 28px 0 10px;
    padding-bottom: 6px; border-bottom: 2px solid #2E86AB; }
  p { margin: 0 0 12px; }
</style>
</head>
<body>
  <div style="text-align:center;padding-bottom:24px;margin-bottom:28px;border-bottom:3px solid #2E86AB;">
    <div style="font-size:11px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Your Enneagram</div>
    <div style="font-size:42px;font-weight:700;color:#2E86AB;line-height:1.1;margin-bottom:4px;">Type ${h.confirmed_type}</div>
    <div style="font-size:20px;color:#555;margin-bottom:12px;">${h.confirmed_type_name}</div>
    <span style="display:inline-block;padding:4px 14px;border-radius:20px;background:${badgeBg};color:${badgeColor};font-weight:700;font-size:12px;">
      Confidence: ${h.confidence_level.replace("_", "-")}
    </span>
  </div>

  <h2>A Note on This Result</h2>
  <p style="font-style:italic;">Based on your responses, the pattern that appears most consistent with your experience is <strong>Type ${h.confirmed_type} — ${h.confirmed_type_name}</strong>. This is a hypothesis, not a verdict. We hope it feels like recognition rather than assignment. If it resonates, wonderful. If it doesn't fully fit, that's important information too. Your session with Cai is the right place to explore what fits, what doesn't, and why.</p>

  <h2>What We Noticed About You</h2>
  <p style="font-style:italic;background:#E8F4F8;padding:14px 18px;border-radius:6px;border-left:4px solid #2E86AB;color:#1A5C7A;">${result.client_narrative}</p>

  <h2>Your Type at a Glance</h2>
  ${to.worldview ? `<p><strong style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#2E86AB;">How You See the World</strong><br>${to.worldview}</p>` : ""}
  ${to.core_motivation ? `<p><strong style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#2E86AB;">Core Motivation</strong><br>${to.core_motivation}</p>` : ""}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
    <div style="background:#E8F4F8;padding:12px 16px;border-radius:6px;">
      <div style="font-size:10px;font-weight:700;color:#2E86AB;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Strengths</div>
      ${strengthsHTML}
    </div>
    <div style="background:#FFF8E7;padding:12px 16px;border-radius:6px;">
      <div style="font-size:10px;font-weight:700;color:#B8860B;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Challenges</div>
      ${challengesHTML}
    </div>
  </div>

  ${to.instinct_notes ? `<h2>Your Instinct — ${h.confirmed_instinct}</h2><p>${to.instinct_notes}</p>` : ""}

  <h2>How Your Type Moves Through Stress and Ease</h2>
  ${to.stress_point_insight ? `
    <p><strong style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#2E86AB;">Under Stress</strong><br>
    ${to.stress_point_insight}</p>
    ${s4.stress_point_description ? `<p style="font-size:12px;color:#555;font-style:italic;">In your responses: ${s4.stress_point_description}</p>` : ""}
  ` : ""}
  ${to.security_point_insight ? `
    <p><strong style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#2E86AB;">When at Ease</strong><br>
    ${to.security_point_insight}</p>
    ${s4.security_point_description ? `<p style="font-size:12px;color:#555;font-style:italic;">In your responses: ${s4.security_point_description}</p>` : ""}
  ` : ""}

  ${probes.length > 0 ? `
    <h2>What to Explore With Cai</h2>
    <p style="color:#555;">These questions emerged from your assessment as particularly worth exploring in session:</p>
    ${probesHTML}
  ` : ""}

  <div style="margin-top:40px;padding-top:16px;border-top:2px solid #2E86AB;text-align:center;font-size:11px;color:#888;">
    Generated by the Hive Enneagram Typing Engine &nbsp;·&nbsp; For use with Cai Delumpa
  </div>
</body>
</html>`;
}

function buildCoachHTML(result) {
  const h = result.hypothesis;
  const s0 = result.stage0_analysis || {};
  const s2 = result.stage2_analysis || {};
  const s4 = result.stage4_analysis || {};
  const ha = result.holistic_analysis || {};
  const flags = result.flags || [];
  const probes = result.session_probes || [];

  const confidenceColors = {
    HIGH: ["#2E7D32", "#E8F5E9"],
    MEDIUM_HIGH: ["#E65100", "#FFF3E0"],
    MEDIUM: ["#E65100", "#FFF3E0"],
    LOW: ["#C62828", "#FFEBEE"],
  };
  const [badgeColor, badgeBg] = confidenceColors[h.confidence_level] || ["#555", "#f5f5f5"];

  function infoRow(label, value) {
    if (!value) return "";
    return `<div style="display:flex;gap:12px;margin-bottom:8px;align-items:flex-start;">
      <span style="font-size:10px;font-weight:700;color:#B8860B;text-transform:uppercase;letter-spacing:0.08em;min-width:140px;padding-top:2px;">${label}</span>
      <span style="font-size:13px;color:#1a1a2e;line-height:1.5;flex:1;">${value}</span>
    </div>`;
  }

  const flagsHTML = flags.length === 0
    ? `<p style="font-size:13px;color:#555;">No flags identified.</p>`
    : flags.map(f => `
      <div style="background:#FFF8E7;border-left:3px solid #B8860B;padding:8px 12px;margin-bottom:8px;border-radius:0 4px 4px 0;">
        <div style="font-size:10px;font-weight:700;color:#B8860B;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;">${f.flag_type.replace(/_/g, " ")}</div>
        <div style="font-size:12px;color:#1a1a2e;line-height:1.5;">${f.description}</div>
      </div>`).join("");

  const probesHTML = probes.map((p, i) =>
    `<div style="padding:8px 14px;margin-bottom:6px;background:#FFF8E7;border-radius:4px;font-size:13px;">
      <strong style="color:#B8860B">${i + 1}.</strong> ${p}
    </div>`
  ).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Coach Report — Type ${h.confirmed_type} ${h.confirmed_instinct}</title>
<style>
  @media print { body { margin: 0; } @page { margin: 2cm; } }
  body { font-family: Georgia, serif; color: #1a1a2e; line-height: 1.6;
    max-width: 680px; margin: 40px auto; padding: 0 24px; font-size: 13px; }
  h2 { font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: #B8860B; margin: 28px 0 10px;
    padding-bottom: 6px; border-bottom: 2px solid #B8860B; }
  p { margin: 0 0 12px; }
</style>
</head>
<body>
  <div style="padding-bottom:20px;margin-bottom:24px;border-bottom:3px solid #B8860B;">
    <div style="font-size:11px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">Coach Report — Confidential</div>
    <div style="font-size:28px;font-weight:700;color:#2E86AB;margin-bottom:8px;">
      Type ${h.confirmed_type} ${h.confirmed_instinct} — ${h.confirmed_type_name}
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
      <span style="display:inline-block;padding:4px 14px;border-radius:20px;background:${badgeBg};color:${badgeColor};font-weight:700;font-size:12px;">
        Confidence: ${h.confidence_level.replace("_", "-")}
      </span>
      <span style="font-size:12px;color:#555;">Instinct confidence: ${h.instinct_confidence}</span>
      <span style="font-size:12px;color:#555;">Stage 4: ${h.stage4_outcome}</span>
      ${h.second_candidate_type ? `<span style="font-size:12px;color:#555;">Second candidate: Type ${h.second_candidate_type}</span>` : ""}
    </div>
  </div>

  <h2>Coach Note</h2>
  <p style="font-style:italic;background:#FFF8E7;padding:14px 18px;border-radius:6px;border-left:4px solid #B8860B;color:#5c4500;">${result.coach_note}</p>

  <h2>Stage 0 — Language Analysis</h2>
  <div style="display:flex;gap:12px;margin-bottom:12px;">
    <div style="padding:8px 14px;border-radius:4px;background:${s0.idealization_match ? "#E8F5E9" : "#FFEBEE"};color:${s0.idealization_match ? "#2E7D32" : "#C62828"};font-size:12px;font-weight:700;">
      Idealization ${s0.idealization_match ? "✓ Match" : "✗ No Match"}
    </div>
    <div style="padding:8px 14px;border-radius:4px;background:${s0.shadow_match ? "#E8F5E9" : "#FFEBEE"};color:${s0.shadow_match ? "#2E7D32" : "#C62828"};font-size:12px;font-weight:700;">
      Shadow ${s0.shadow_match ? "✓ Match" : "✗ No Match"}
    </div>
  </div>
  ${infoRow("Notable Language", s0.notable_language)}

  <h2>Stage 2 — Cross-Referencing</h2>
  ${infoRow("Hornevian", s2.hornevian_result)}
  ${infoRow("Harmonic", s2.harmonic_result)}
  ${infoRow("Object Relations", s2.object_relations_result)}
  ${infoRow("Framework Alignment", s2.framework_alignment)}

  <h2>Stage 4 — Confirmation</h2>
  ${infoRow("Stress Point", s4.stress_point_description)}
  ${infoRow("Security Point", s4.security_point_description)}
  ${s4.habit_of_mind_description ? infoRow("Habit of Mind", s4.habit_of_mind_description) : ""}

  <h2>Holistic Analysis — Task 5</h2>
  ${infoRow("Stage 0 Coherence", ha.stage0_coherence)}
  ${infoRow("Cross-Stage", ha.cross_stage_consistency)}
  ${infoRow("Instinct Coherence", ha.instinct_coherence)}
  ${infoRow("Alt Type Signal", ha.alternative_type_signal || "None identified")}
  ${infoRow("Confidence", ha.confidence_adjustment)}

  <h2>Flags (${flags.length} identified)</h2>
  ${flagsHTML}

  ${probes.length > 0 ? `
    <h2>Suggested Session Probes</h2>
    ${probesHTML}
  ` : ""}

  <div style="margin-top:40px;padding-top:16px;border-top:2px solid #B8860B;text-align:center;font-size:11px;color:#888;">
    Hive Enneagram Typing Engine &nbsp;·&nbsp; Coach Report &nbsp;·&nbsp; Confidential — For Cai Delumpa only
  </div>
</body>
</html>`;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("client");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  async function runAnalysis() {
    if (!apiKey.trim()) {
      setError("Please enter your Anthropic API key to continue.");
      return;
    }
    setState("loading");
    setError(null);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(SAMPLE_DATA) }]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`API error ${response.status}: ${errData?.error?.message || response.statusText}`);
      }

      const data = await response.json();
      let text = data.content[0].text.trim();
      if (text.startsWith("```")) {
        text = text.split("\n").slice(1).join("\n");
        text = text.replace(/```\s*$/, "").trim();
      }

      const parsed = JSON.parse(text);
      setResult(parsed);
      setState("done");
    } catch (e) {
      setError(e.message);
      setState("error");
    }
  }

  // ── Loading ──
  if (state === "loading") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: C.bg, fontFamily: "Georgia, serif"
      }}>
        <div style={{
          width: 48, height: 48, border: `3px solid ${C.lightTeal}`,
          borderTop: `3px solid ${C.teal}`, borderRadius: "50%",
          animation: "spin 1s linear infinite", marginBottom: 20
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 16, color: C.teal }}>Analyzing assessment...</div>
        <div style={{ fontSize: 12, color: C.light, marginTop: 6 }}>
          Running holistic analysis across all four stages
        </div>
      </div>
    );
  }

  // ── Results ──
  if (state === "done" && result) {
    const h = result.hypothesis;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Georgia, serif" }}>

        {/* Top Bar */}
        <div style={{
          background: C.white, borderBottom: `1px solid #e0e0e0`,
          padding: "12px 32px", display: "flex", alignItems: "center",
          justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.teal,
              letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Hive Typing Engine
            </span>
            <span style={{ color: "#ddd" }}>|</span>
            <span style={{ fontSize: 13, color: C.mid }}>
              Type {h.confirmed_type} {h.confirmed_instinct} — {h.confirmed_type_name}
            </span>
            <ConfidenceBadge level={h.confidence_level} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => triggerDownload(buildClientHTML(result), "hive_client_report")}
              style={{
                padding: "7px 16px", borderRadius: 4, border: `1px solid ${C.teal}`,
                background: C.white, color: C.teal, fontSize: 12, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.05em"
              }}>
              ↓ Client Report
            </button>
            <button
              onClick={() => triggerDownload(buildCoachHTML(result), "hive_coach_report")}
              style={{
                padding: "7px 16px", borderRadius: 4, border: `1px solid ${C.gold}`,
                background: C.white, color: C.gold, fontSize: 12, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.05em"
              }}>
              ↓ Coach Report
            </button>
            <button
              onClick={() => { setState("idle"); setResult(null); setError(null); }}
              style={{
                padding: "7px 16px", borderRadius: 4, border: "1px solid #ddd",
                background: C.white, color: C.mid, fontSize: 12,
                cursor: "pointer"
              }}>
              New Analysis
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          background: C.white, borderBottom: "1px solid #e0e0e0",
          padding: "0 32px", display: "flex", gap: 0
        }}>
          {[
            { id: "client", label: "Client Report" },
            { id: "coach", label: "Coach Report" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "12px 20px", border: "none", background: "none",
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? C.teal : C.mid,
              borderBottom: activeTab === tab.id ? `3px solid ${C.teal}` : "3px solid transparent",
              cursor: "pointer", transition: "all 0.15s"
            }}>{tab.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: activeTab === "client" ? "block" : "none" }}>
            <ClientReport result={result} />
          </div>
          <div style={{ display: activeTab === "coach" ? "block" : "none" }}>
            <CoachReport result={result} />
          </div>
        </div>
      </div>
    );
  }

  // ── Idle / Error ──
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: C.bg, fontFamily: "Georgia, serif", padding: 24
    }}>
      <div style={{
        maxWidth: 520, width: "100%", background: C.white,
        borderRadius: 10, padding: "40px 40px", textAlign: "center",
        boxShadow: "0 2px 20px rgba(0,0,0,0.06)"
      }}>
        <div style={{ fontSize: 11, color: C.light, letterSpacing: "0.12em",
          textTransform: "uppercase", marginBottom: 8 }}>
          Hive Enneagram Typing Engine
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.teal, marginBottom: 8 }}>
          Report Generator
        </div>
        <div style={{ fontSize: 13, color: C.mid, lineHeight: 1.7, marginBottom: 24 }}>
          This prototype analyzes a sample completed assessment using the full
          four-stage typing engine and generates both a client report and a coach report.
        </div>

        {/* API Key Input */}
        <div style={{ textAlign: "left", marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.teal,
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Anthropic API Key
          </div>
          <div style={{ position: "relative" }}>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === "Enter" && apiKey.trim() && runAnalysis()}
              placeholder="sk-ant-..."
              style={{
                width: "100%", padding: "10px 52px 10px 12px",
                border: `1px solid ${apiKey ? C.teal : "#ddd"}`,
                borderRadius: 4, fontSize: 13, outline: "none",
                fontFamily: "monospace", boxSizing: "border-box",
                color: C.dark, background: C.white, transition: "border-color 0.15s"
              }}
            />
            <button
              onClick={() => setShowKey(v => !v)}
              style={{
                position: "absolute", right: 10, top: "50%",
                transform: "translateY(-50%)", background: "none",
                border: "none", cursor: "pointer", fontSize: 11,
                color: C.mid, padding: "2px 4px"
              }}>
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.light, marginTop: 5 }}>
            Used only for this session — never stored.
          </div>
        </div>

        <div style={{
          background: C.lightTeal, borderRadius: 6, padding: "14px 16px",
          marginBottom: 24, textAlign: "left"
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.teal,
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Sample Dataset
          </div>
          {[
            ["Self-description", SAMPLE_DATA.stage0_q1],
            ["Center", `${SAMPLE_DATA.identified_center} (${SAMPLE_DATA.center_confidence})`],
            ["Instinct", `${SAMPLE_DATA.identified_instinct} (${SAMPLE_DATA.instinct_confidence})`],
            ["Stage 3 pair", SAMPLE_DATA.s3_pair],
            ["Stage 4 outcome", SAMPLE_DATA.s4_outcome],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: C.teal, fontWeight: 700, minWidth: 110 }}>{k}:</span>
              <span style={{ color: C.dark }}>{v}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            background: C.redBg, color: C.red, padding: "10px 14px",
            borderRadius: 4, fontSize: 12, marginBottom: 16, textAlign: "left"
          }}>
            {error}
          </div>
        )}

        <button
          onClick={runAnalysis}
          disabled={!apiKey.trim()}
          style={{
            width: "100%", padding: "14px 24px",
            background: apiKey.trim() ? C.teal : "#ccc",
            color: C.white, border: "none", borderRadius: 6,
            fontSize: 14, fontWeight: 700,
            cursor: apiKey.trim() ? "pointer" : "not-allowed",
            letterSpacing: "0.05em", transition: "background 0.15s"
          }}>
          Generate Reports
        </button>

        <div style={{ fontSize: 11, color: C.light, marginTop: 14 }}>
          Calls Claude API · Generates client + coach reports · Downloads as HTML
        </div>
      </div>
    </div>
  );
}
