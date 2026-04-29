import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, BookOpen, MapPin, Lightbulb, BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";

function DarkSection({ icon: Icon, title, headerRight = null, children }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(18,28,49,0.94) 0%, rgba(20,39,53,0.94) 100%)",
        border: "1px solid rgba(83, 148, 155, 0.24)",
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "rgba(83, 148, 155, 0.16)" }}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(174 60% 68%)" }} />}
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(174 60% 68%)" }}>{title}</span>
        {headerRight && <div className="ml-auto">{headerRight}</div>}
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

function LightSection(props) {
  return <DarkSection {...props} />;
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wider shrink-0" style={{ color: "rgba(236, 245, 245, 0.82)" }}>
        {label}
      </span>
      <div className="flex items-center justify-end text-right">{children}</div>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span
      className="px-2.5 py-1 text-xs font-semibold rounded-md border"
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
  focusCapabilities = [],
  lastNudge = null,
  realtimeFeedback = null,
  scenario = null,
  conversationInit = null,
  hasRepSpoken = false,
  predictiveLens = null,
}) {
  const navigate = useNavigate();
  const [showPredictiveLens, setShowPredictiveLens] = useState(false);
  const traj = hcpPrediction?.trajectory ? trajectoryConfig[hcpPrediction.trajectory] : null;
  const liveCoaching = lastNudge || (realtimeFeedback?.guidance ? {
    title: "Live coaching",
    capabilityName: "Live coaching",
    guidance: realtimeFeedback.guidance,
  } : null);
  const sceneDescription = scenario?.visualScene || scenario?.description || "";
  const openingGuidance = !hasRepSpoken ? (conversationInit?.openingGuidance || []) : [];

  const openPredictiveBuilder = () => {
    const selection = predictiveLens?.data?.selection;
    if (!selection) {
      navigate("/predictive-builder");
      return;
    }

    const params = new URLSearchParams();
    Object.entries(selection).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    const suffix = params.toString();
    navigate(`/predictive-builder${suffix ? `?${suffix}` : ""}`);
  };

  return (
    <div className="space-y-4">
      {(predictiveLens?.isLoading || predictiveLens?.data) && (
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
              <Row label="Source">
                <Pill>{predictiveLens.data.synthesisSource === "ai" ? "AI-synthesized" : "Deterministic"}</Pill>
              </Row>
              <Row label="Specialist">
                <span className="text-[11px] font-semibold uppercase whitespace-nowrap" style={{ color: "rgba(244,249,249,0.96)" }}>
                  {formatSpecialistTitle(predictiveLens.data.specialistTitle)}
                </span>
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

      {scenario && sceneDescription && (
        <DarkSection icon={MapPin} title="Scene">
          <p className="text-xs leading-relaxed" style={{ color: "rgba(244,249,249,0.92)" }}>
            {sceneDescription}
          </p>
          {openingGuidance.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(174 60% 68%)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "hsl(174 60% 68%)" }}>
                  Opening Tips
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {openingGuidance.map((hint, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-md"
                    style={{
                      background: "rgba(37,124,123,0.12)",
                      border: "1px solid rgba(37,124,123,0.24)",
                      color: "rgba(244,249,249,0.96)",
                    }}
                  >
                    {hint}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DarkSection>
      )}

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
            className="p-3 rounded-xl"
            style={{
              background: "linear-gradient(180deg, rgba(98, 74, 13, 0.20) 0%, rgba(68, 52, 11, 0.16) 100%)",
              border: "1px solid rgba(231, 196, 83, 0.30)",
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255, 216, 94, 0.98)" }}>
              {liveCoaching.capabilityName || liveCoaching.title || "Live coaching"}
            </p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "rgba(255, 235, 169, 0.94)" }}>
              <span style={{ color: "hsl(2 57% 43%)", fontStyle: "italic", fontWeight: 700 }}>Tip:</span>{" "}
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
                <span>{traj.label}</span>
              </div>
            </Row>
          )}
          <Row label="Risk">
            <span
              className="text-xs font-medium capitalize"
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
              className="mt-2 p-3 rounded-lg"
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
            <div className="grid grid-cols-1 gap-2 pt-1">
              <Row label="Concern Family">
                <span className="text-xs font-medium capitalize" style={{ color: "rgba(244,249,249,0.96)" }}>
                  {String(hcpPrediction.concernFamily).replace(/_/g, " ")}
                </span>
              </Row>
              <Row label="Scenario Domain">
                <span className="text-xs font-medium capitalize" style={{ color: "rgba(244,249,249,0.96)" }}>
                  {String(hcpPrediction.scenarioDomain || "general")}
                </span>
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
                <span className="text-xs font-medium" style={{ color: "rgba(244,249,249,0.96)" }}>
                  {values[val] || val}
                </span>
              </Row>
            );
          })}
        </DarkSection>
      )}

      {focusCapabilities.length > 0 && (
        <DarkSection icon={BookOpen} title="Focus Capabilities">
          <div className="space-y-1.5">
            {focusCapabilities.map((capId) => {
              const cap = SIGNAL_INTELLIGENCE_CAPABILITIES.find((candidate) => candidate.id === capId);
              if (!cap) return null;
              return (
                <div key={capId} className="p-3 rounded-lg bg-primary/8 border border-primary/25">
                  <div className="text-xs font-semibold" style={{ color: "rgba(244,249,249,0.96)" }}>{cap.label}</div>
                  <div className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(236, 245, 245, 0.86)" }}>{cap.definition}</div>
                </div>
              );
            })}
          </div>
        </DarkSection>
      )}
    </div>
  );
}
