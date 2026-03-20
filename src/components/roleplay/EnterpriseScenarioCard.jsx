// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import ScenarioCard from "@/components/roleplay/ScenarioCard";

const DIFFICULTY_CONFIG = {
  beginner: { label: "Beginner", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  intermediate: { label: "Intermediate", color: "bg-amber-50 text-amber-700 border-amber-200" },
  advanced: { label: "Advanced", color: "bg-rose-50 text-rose-700 border-rose-200" },
};

const CATEGORY_COLORS = {
  "HIV / PrEP": "bg-cyan-50 text-cyan-700 border-cyan-200",
  Oncology: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  Cardiology: "bg-red-50 text-red-700 border-red-200",
  Vaccines: "bg-green-50 text-green-700 border-green-200",
  "COVID-19": "bg-sky-50 text-sky-700 border-sky-200",
  Neurology: "bg-violet-50 text-violet-700 border-violet-200",
  Immunology: "bg-teal-50 text-teal-700 border-teal-200",
  "Rare Disease": "bg-orange-50 text-orange-700 border-orange-200",
};

function toLines(value, fallback = []) {
  const lines = Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
    : String(value || "")
      .split(/\n|;|•|\u2022|(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 3);

  return lines.length > 0 ? lines : fallback;
}

export default function EnterpriseScenarioCard({
  scenario,
  footerAction,
  footerSecondary,
  allowStart = true,
  defaultExpanded = false,
  openingSceneLabel = "Play Scene",
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [previewing, setPreviewing] = useState(false);
  const [typingText, setTypingText] = useState("");
  const previewTimerRef = useRef(null);

  const diff = DIFFICULTY_CONFIG[scenario.difficulty] || DIFFICULTY_CONFIG.intermediate;
  const catColor = CATEGORY_COLORS[scenario.category] || "bg-gray-50 text-gray-600 border-gray-200";
  const openingScene = scenario.openingScene || scenario.opening_scene || "Preview the opening moment to hear how the HCP enters the conversation.";
  const objectiveLines = toLines(scenario.objective, ["Guide the discussion toward a clear next step."]);
  const tacticalFocusLines = toLines(scenario.challenges || scenario.tacticalFocus, ["Surface resistance early and connect back to value."]);
  const hcpSummary = String(scenario.hcp || scenario.stakeholder || scenario.context || "Profile details are not available for this HCP.").trim();

  useEffect(() => {
    if (!previewing) {
      setTypingText("");
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      return undefined;
    }

    let index = 0;
    previewTimerRef.current = window.setInterval(() => {
      index += 1;
      setTypingText(openingScene.slice(0, index));
      if (index >= openingScene.length && previewTimerRef.current) {
        window.clearInterval(previewTimerRef.current);
      }
    }, 18);

    return () => {
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
    };
  }, [openingScene, previewing]);

  return (
    <div className={`scenario-card self-start bg-white rounded-2xl border flex flex-col overflow-hidden ${expanded ? "scenario-card-expanded border-[#1A334D] shadow-xl shadow-teal-100/70" : "border-[#1A334D]/70 shadow-md"}`}>
      <div className={`px-5 pt-5 ${expanded ? "pb-4" : "pb-5"} flex-1 space-y-3`}>
        <div className="flex items-start gap-2">
          <h3 className="font-bold text-gray-900 text-sm leading-snug flex-1">{scenario.title}</h3>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex-shrink-0 ${diff.color}`}>{diff.label}</span>
        </div>

        {expanded && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {scenario.category && <span className={`inline-flex items-center rounded-full border border-[#1A334D] px-2.5 py-1 text-[11px] font-semibold ${catColor}`}>{scenario.category}</span>}
              {scenario.specialty && <span className="text-[11px] font-medium text-gray-500">{scenario.specialty}</span>}
            </div>

            {scenario.description && <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{scenario.description}</p>}

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Opening Scene</p>
                <button
                  type="button"
                  onClick={() => setPreviewing((value) => !value)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 transition-all duration-200 hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  {previewing ? "Reset Preview" : openingSceneLabel}
                </button>
              </div>
              <p className={`text-xs leading-relaxed text-slate-600 min-h-[40px] ${previewing ? "typing-preview" : "line-clamp-3"}`}>
                {previewing ? typingText || " " : openingScene}
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">HCP</p>
                <p className="text-xs text-gray-800 font-medium line-clamp-3">{hcpSummary}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Objective</p>
                <div className="space-y-1.5">
                  {objectiveLines.map((line, index) => (
                    <div key={index} className="flex gap-2 text-xs text-gray-700 leading-relaxed">
                      <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                      <span className="line-clamp-2">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
              {tacticalFocusLines.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tactical Focus</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tacticalFocusLines.map((item, index) => (
                      <span key={index} className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-1 max-w-full break-words">{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="px-5 pb-5 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-pressed={expanded}
          className="inline-flex self-center items-center justify-center rounded-full border border-teal-300 bg-teal-50 px-5 py-2 text-sm font-medium text-teal-700 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          {expanded ? "Collapse Details" : "Expand for Details"}
        </button>
        {footerSecondary}
        {footerAction || (allowStart ? (
          <ScenarioCard
            scenario={scenario}
            renderAs="button-only"
            buttonClassName="inline-flex w-auto self-center items-center justify-center rounded-full px-6 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
          />
        ) : null)}
      </div>
    </div>
  );
}
