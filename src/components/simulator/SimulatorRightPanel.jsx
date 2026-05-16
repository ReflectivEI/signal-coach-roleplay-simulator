import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, MapPin, BrainCircuit, ChevronDown, ChevronUp, ChevronRight, Mic } from "lucide-react";
import { requireRealismContract } from "@/lib/scenarioInputResolver";

function DarkSection({ icon: Icon, title, headerRight = null, children }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(18,28,49,0.94) 0%, rgba(20,39,53,0.94) 100%)",
        border: "1px solid rgba(83, 148, 155, 0.24)",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "rgba(83, 148, 155, 0.16)" }}>
        {Icon && <Icon className="w-3 h-3 shrink-0" style={{ color: "hsl(174 60% 68%)" }} />}
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "hsl(174 60% 68%)" }}>{title}</span>
        {headerRight && <div className="ml-auto">{headerRight}</div>}
      </div>
      <div className="px-3 py-2.5 space-y-2">{children}</div>
    </div>
  );
}

function LightSection(props) {
  return <DarkSection {...props} />;
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-medium uppercase tracking-[0.13em] shrink-0" style={{ color: "rgba(236, 245, 245, 0.76)" }}>
        {label}
      </span>
      <div className="flex items-center justify-end text-right min-w-0">{children}</div>
    </div>
  );
}

function ValueText({ children, className = "" }) {
  return (
    <span
      className={`text-[11px] font-semibold uppercase whitespace-nowrap ${className}`}
      style={{ color: "rgba(244,249,249,0.96)" }}
    >
      {children}
    </span>
  );
}

function Pill({ children }) {
  return (
    <span
      className="px-2 py-0.5 text-[11px] font-semibold rounded-md border"
      style={{
        background: "rgba(255,255,255,0.10)",
        color: "rgba(244,249,249,0.96)",
        borderColor: "rgba(125, 173, 190, 0.24)",
      }}
    >
      {children}
    </span>
  );
}

const opennessPill = {
  closed: "Closed",
  neutral: "Neutral",
  open: "Open",
};

const trajectoryConfig = {
  improving: { Icon: TrendingUp, color: "rgba(199,244,214,0.96)", label: "Improving" },
  stalled: { Icon: Minus, color: "rgba(255,233,176,0.96)", label: "Stalled" },
  declining: { Icon: TrendingDown, color: "rgba(255,207,214,0.94)", label: "Declining" },
};

function formatSpecialistTitle(title = "") {
  const normalized = String(title || "").trim();
  if (!normalized) return "N/A";

  const compactMap = [
    { pattern: /Cardiology\s*\/\s*Cardiovascular Medicine/i, replacement: "CARDIOLOGY" },
    { pattern: /Primary Care\s*\/\s*Internal Medicine Specialist/i, replacement: "PCP / INTERNAL MEDICINE" },
    { pattern: /Primary Care Physician/i, replacement: "PCP" },
    { pattern: /Internal Medicine Specialist/i, replacement: "INTERNAL MEDICINE" },
    { pattern: /Specialist$/i, replacement: "" },
  ];

  let compact = normalized;
  for (const rule of compactMap) {
    compact = compact.replace(rule.pattern, rule.replacement).trim();
  }

  return compact.replace(/\s{2,}/g, " ").trim() || normalized;
}

export default function SimulatorRightPanel({
  hcpPrediction = null,
  lastSignals = {},
  latestVoiceAnalysis = null,
  voiceEvaluation = null,
  lastNudge = null,
  realtimeFeedback = null,
  onAnalyzeVoice = null,
  isVoiceEvaluating = false,
  canAnalyzeVoice = false,
  scenario = null,
  conversationInit = null,
  hasRepSpoken = false,
  predictiveLens = null,
  realism,
}) {
  const displayRealism = requireRealismContract(realism, "session.realism display");
  const navigate = useNavigate();
  const [showPredictiveLens, setShowPredictiveLens] = useState(false);
  const [showVoiceEvaluation, setShowVoiceEvaluation] = useState(false);
  const [selectedVoiceSectionId, setSelectedVoiceSectionId] = useState("delivery");
  const traj = hcpPrediction?.trajectory ? trajectoryConfig[hcpPrediction.trajectory] : null;
  const liveCoaching = lastNudge || (realtimeFeedback?.guidance ? {
    title: "Live coaching",
    capabilityName: "Live coaching",
    guidance: realtimeFeedback.guidance,
  } : null);
  const sceneDescription = scenario?.visualScene || scenario?.description || "";

  const openPredictiveBuilder = () => {
    const selection = predictiveLens?.data?.selection;
    if (!selection) {
      navigate("/predictive-builder");
      return;
    }

    const params = new URLSearchParams();
    const stage = selection.stage || selection.conversationStage || selection.journeyStage;
    const challenge = selection.challenge || selection.challengeContext;

    if (selection.hcpType) params.set("hcpType", String(selection.hcpType));
    if (stage) params.set("stage", String(stage));
    if (challenge) params.set("challenge", String(challenge));

    Object.entries(selection).forEach(([key, value]) => {
      if (!value || params.has(key)) return;
      params.set(key, String(value));
    });
    const suffix = params.toString();
    navigate(`/predictive-builder${suffix ? `?${suffix}` : ""}`);
  };

  const showPredictiveLensPanel = Boolean(predictiveLens?.isLoading || predictiveLens?.data);
  const voiceEvalResult = voiceEvaluation?.result || null;
  const voiceEvalPrimary =
    voiceEvalResult?.coaching_feedback?.[0]
    || voiceEvalResult?.delivery_coaching?.recommended_delivery_adjustment
    || voiceEvalResult?.next_best_question
    || voiceEvaluation?.error
    || "Evaluate a spoken rep response to see delivery and behavioral coaching.";
  const voiceMetadata = voiceEvaluation?.voiceMetadata || latestVoiceAnalysis?.metadata || {};
  const voiceEvaluationSections = [
    {
      id: "delivery",
      title: "Delivery",
      detail: voiceEvaluation?.error
        ? voiceEvaluation.error
        : `Pace: ${voiceMetadata.words_per_minute || 0} wpm. Pauses: ${voiceMetadata.pause_count || 0}. Fillers: ${voiceMetadata.filler_word_count || 0}.`,
    },
    {
      id: "coaching",
      title: "Coaching Direction",
      detail: voiceEvalPrimary,
    },
    {
      id: "outcome",
      title: "Outcome Read",
      detail: voiceEvalResult?.outcome_analysis?.actual_outcome
        || voiceEvalResult?.outcome_analysis?.rationale
        || "",
    },
    {
      id: "better",
      title: "Better Phrasing",
      detail: voiceEvalResult?.better_phrasing || "",
    },
    {
      id: "heard",
      title: "What HCP Heard",
      detail: voiceEvalResult?.what_hcp_likely_heard || "",
    },
    {
      id: "transcript",
      title: "Transcript",
      detail: voiceEvaluation?.transcript || "",
    },
  ].filter((section) => String(section.detail || "").trim());
  const selectedVoiceSection = voiceEvaluationSections.find((section) => section.id === selectedVoiceSectionId)
    || voiceEvaluationSections[0]
    || null;

  const openVoiceSection = (sectionId) => {
    setSelectedVoiceSectionId(sectionId);
    setShowVoiceEvaluation(true);
  };

  return (
    <div className="space-y-3">
      {showPredictiveLensPanel && (
        <DarkSection
          icon={BrainCircuit}
          title="Predictive HCP Lens"
          headerRight={
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: "hsl(174 60% 68%)" }}
              onClick={() => setShowPredictiveLens((prev) => !prev)}
            >
              {showPredictiveLens ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showPredictiveLens ? "Hide" : "View"}
            </button>
          }
        >
          {predictiveLens?.isLoading && (
            <p className="text-xs leading-relaxed" style={{ color: "rgba(244,249,249,0.92)" }}>
              Building predictive lens from scenario metadata...
            </p>
          )}

          {predictiveLens?.data && (
            <>
              <Row label="Specialist">
                <ValueText>{formatSpecialistTitle(predictiveLens.data.specialistTitle)}</ValueText>
              </Row>
              {predictiveLens.data.synthesisError ? (
                <p className="text-xs" style={{ color: "rgba(255, 220, 173, 0.92)" }}>
                  {predictiveLens.data.synthesisError}
                </p>
              ) : null}

              {showPredictiveLens && (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={openPredictiveBuilder}
                    className="text-[11px] font-semibold underline"
                    style={{ color: "hsl(174 60% 68%)" }}
                  >
                    Open in Predictive Builder
                  </button>
                  <div className="grid grid-cols-1 gap-2">
                    <p className="text-[11px] uppercase tracking-wider" style={{ color: "rgba(220,236,236,0.72)" }}>
                      Runtime headlines
                    </p>
                    <div className="space-y-1.5 text-xs" style={{ color: "rgba(244,249,249,0.94)" }}>
                      <p>Mindset: {predictiveLens.data.lens?.sections?.mindset?.headline || "n/a"}</p>
                      <p>Objections: {predictiveLens.data.lens?.sections?.objections?.headline || "n/a"}</p>
                      <p>Response style: {predictiveLens.data.lens?.sections?.responseStyle?.headline || "n/a"}</p>
                      <p>Rep approach: {predictiveLens.data.lens?.sections?.repApproach?.headline || "n/a"}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </DarkSection>
      )}

      <DarkSection icon={Activity} title="Realism">
        <Row label="Level">
          <div className="flex items-center gap-2">
          <ValueText>Balanced resistance</ValueText>
          <Pill>{displayRealism}/10</Pill>
          </div>
        </Row>
      </DarkSection>

      {liveCoaching && (
        <LightSection
          icon={Zap}
          title="Live Coaching"
          headerRight={realtimeFeedback?.timestamp ? (
            <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: "rgba(255, 235, 169, 0.78)" }}>
              {new Date(realtimeFeedback.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        >
          <div
            className="p-2.5 rounded-xl text-left"
            style={{
              background: "linear-gradient(180deg, rgba(98, 74, 13, 0.20) 0%, rgba(68, 52, 11, 0.16) 100%)",
              border: "1px solid rgba(231, 196, 83, 0.30)",
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255, 216, 94, 0.98)" }}>
              {liveCoaching.capabilityName || liveCoaching.title || "Live coaching"}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-left" style={{ color: "rgba(255, 235, 169, 0.94)" }}>
              {liveCoaching.guidance}
            </p>
          </div>
        </LightSection>
      )}

      {hcpPrediction && (
        <LightSection icon={AlertTriangle} title="Predictive Layer">
          <Row label="Predicted State">
            <Pill>{hcpPrediction.predictedBehaviorState}</Pill>
          </Row>
          <Row label="Openness">
            <Pill>{opennessPill[hcpPrediction.openness] || hcpPrediction.openness}</Pill>
          </Row>
          {traj && (
            <Row label="Trajectory">
              <div className="flex items-center gap-1 text-xs font-medium" style={{ color: traj.color }}>
                <traj.Icon className="w-3 h-3" />
                <span className="text-[11px] font-semibold uppercase">{traj.label}</span>
              </div>
            </Row>
          )}
          <Row label="Risk">
            <span
              className="text-[11px] font-semibold uppercase"
              style={{
                color:
                  hcpPrediction.riskLevel === "high"
                    ? "rgba(255,207,214,0.94)"
                    : hcpPrediction.riskLevel === "moderate"
                      ? "rgba(255,233,176,0.94)"
                      : "rgba(199,244,214,0.94)",
              }}
            >
              {hcpPrediction.riskLevel}
            </span>
          </Row>
          {hcpPrediction.nextLikelyBehavior && (
            <div
              className="mt-1.5 p-2.5 rounded-lg"
              style={{
                background: "rgba(37,124,123,0.10)",
                border: "1px solid rgba(37,124,123,0.20)",
              }}
            >
              <p className="text-xs leading-relaxed" style={{ color: "rgba(236,245,245,0.90)" }}>
                {hcpPrediction.nextLikelyBehavior}
              </p>
            </div>
          )}
          {hcpPrediction.concernFamily && (
            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <Row label="Concern Family">
                <ValueText>{String(hcpPrediction.concernFamily).replace(/_/g, " ")}</ValueText>
              </Row>
              <Row label="Scenario Domain">
                <ValueText>{String(hcpPrediction.scenarioDomain || "general")}</ValueText>
              </Row>
            </div>
          )}
        </LightSection>
      )}

      {lastSignals && Object.keys(lastSignals).length > 0 && (
        <DarkSection icon={Activity} title="Observable Signals">
          {[
            { key: "question_type", label: "Question Form", values: { open_ended: "Open-ended", closed_ended: "Closed-ended", leading: "Leading", none: "None used" } },
            { key: "response_alignment", label: "Response to HCP", values: { strong: "Directly addressed", partial: "Partially addressed", weak: "Did not address" } },
            { key: "listening_pattern", label: "Listening", values: { responsive: "Built on HCP input", partially_responsive: "Partially built on", missed: "Did not connect" } },
            { key: "engagement_level", label: "HCP Participation", values: { low: "Disengaged", moderate: "Present", high: "Active" } },
            { key: "commitment_attempt", label: "Next Step", values: { none: "No next step", weak: "Unclear ask", clear: "Specific ask made" } },
          ].map(({ key, label, values }) => {
            const val = lastSignals[key];
            if (!val) return null;
            return (
              <Row key={key} label={label}>
                <ValueText>{values[val] || val}</ValueText>
              </Row>
            );
          })}
        </DarkSection>
      )}

      {onAnalyzeVoice && (
        <DarkSection
          icon={Mic}
          title="Voice Analysis"
          headerRight={
            <button
              type="button"
              onClick={onAnalyzeVoice}
              disabled={!canAnalyzeVoice || isVoiceEvaluating}
              className="rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition-all disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                color: canAnalyzeVoice && !isVoiceEvaluating ? "hsl(174 60% 72%)" : "rgba(220,236,236,0.56)",
                borderColor: "rgba(125, 173, 190, 0.24)",
                background: canAnalyzeVoice && !isVoiceEvaluating ? "rgba(37,124,123,0.16)" : "rgba(255,255,255,0.06)",
              }}
            >
              {isVoiceEvaluating ? "Analyzing" : "Analyze"}
            </button>
          }
        >
          {isVoiceEvaluating || voiceEvaluation?.isLoading ? (
            <p className="text-xs leading-relaxed" style={{ color: "rgba(244,249,249,0.90)" }}>
              Evaluating rep delivery and behavioral fit...
            </p>
          ) : voiceEvaluationSections.length ? (
            <div className="space-y-1.5">
              {voiceEvaluationSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => openVoiceSection(section.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 py-2 text-left transition-all hover:-translate-y-0.5"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    borderColor: "rgba(125,173,190,0.16)",
                    color: "rgba(244,249,249,0.94)",
                  }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{section.title}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(174 60% 68%)" }} />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs leading-relaxed" style={{ color: "rgba(244,249,249,0.76)" }}>
              Draft a response, then analyze delivery and behavioral fit.
            </p>
          )}
        </DarkSection>
      )}

      {scenario && sceneDescription && (
        <DarkSection icon={MapPin} title="Scene">
          <p className="text-xs leading-relaxed" style={{ color: "rgba(244,249,249,0.92)" }}>
            {sceneDescription}
          </p>
        </DarkSection>
      )}

      {showVoiceEvaluation && selectedVoiceSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" onClick={() => setShowVoiceEvaluation(false)}>
          <div
            className="max-h-[82vh] w-full max-w-xl overflow-y-auto rounded-2xl p-5"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
              border: "1.5px solid rgba(92, 135, 165, 0.36)",
              boxShadow: "0 24px 70px rgba(14, 24, 43, 0.26)",
              color: "hsl(222 38% 20%)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "hsl(174 48% 34%)" }}>Voice Analysis</p>
                <h3 className="mt-1 text-lg font-semibold" style={{ color: "hsl(222 48% 22%)" }}>{selectedVoiceSection.title}</h3>
              </div>
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "rgba(38,67,117,0.22)", color: "hsl(222 48% 22%)" }}
                onClick={() => setShowVoiceEvaluation(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: "rgba(20,56,89,0.05)", border: "1px solid rgba(92,135,165,0.26)" }}>
              {selectedVoiceSection.detail.split("\n").map((line) => (
                <p key={line} className="leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
