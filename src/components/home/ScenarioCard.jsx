import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import ScenarioDetailModal from "./ScenarioDetailModal";

function getDifficulty(scenario) {
  const stage = scenario.journeyStage || "";
  const state = scenario.startingBehaviorState || "";
  const pressures = scenario.interactionPressure || [];
  const hardStages = ["objection_handling", "commitment_close", "access_formulary"];
  const hardStates = ["closed", "resistance", "frustration"];
  const hardPressures = ["skeptical_resistant", "safety_concern", "competitive_bias"];

  let score = 0;
  if (hardStages.includes(stage)) score += 2;
  else if (stage === "adoption_implementation" || stage === "clinical_value") score += 1;
  if (hardStates.includes(state)) score += 2;
  if (pressures.some(p => hardPressures.includes(p))) score += 1;
  if (pressures.length >= 2) score += 1;

  if (score >= 4) return { label: "Advanced", cls: "text-red-600 border-red-200 bg-red-50" };
  if (score >= 2) return { label: "Intermediate", cls: "text-amber-600 border-amber-200 bg-amber-50" };
  return { label: "Foundational", cls: "text-emerald-600 border-emerald-200 bg-emerald-50" };
}

export default function ScenarioCard({ scenario, index, isFeatured, onDelete, selectedRealism = 5 }) {
  const [showDetail, setShowDetail] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const difficulty = getDifficulty(scenario);
  const normalizedRealism = Math.max(1, Math.min(10, Number(selectedRealism) || 5));
  const launchUrl = `/simulator?scenarioId=${encodeURIComponent(scenario.id)}&realism=${normalizedRealism}`;
  const displayTitle = scenario.title === "The Warm Intro That Turns Cold"
    ? "Warm Intro Turns Cold"
    : scenario.title.replace(/^The\s+/, "");

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete "${scenario.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleting(false);
    onDelete?.(scenario.id);
  };

  // All cards render the same regardless of isFeatured
  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="h-full"
        style={{
          background: "linear-gradient(180deg, hsl(186 24% 95%) 0%, hsl(174 28% 96%) 100%)",
          border: `1.5px solid ${hovered ? "rgba(82, 163, 156, 0.95)" : "rgba(128, 191, 186, 0.82)"}`,
          borderRadius: "1.1rem",
          boxShadow: hovered
            ? "0 18px 34px rgba(8, 27, 47, 0.14), 0 6px 16px rgba(12, 39, 59, 0.08)"
            : "0 2px 6px rgba(0,0,0,0.04)",
          transform: hovered ? "translateY(-4px) scale(1.01)" : "translateY(0)",
          transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease",
          padding: "0.9rem 1rem 0.85rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          minHeight: "94px",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        {/* Title + badge inline */}
        <div className="flex items-start justify-between gap-2 min-h-[38px]">
          <h3
            className="font-bold leading-[1.18] text-[0.985rem] tracking-[-0.01em] pr-1 line-clamp-2"
            style={{ color: "#1a1a1a" }}
          >
            {displayTitle}
          </h3>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 mt-0.5 ${difficulty.cls}`}>
            {difficulty.label}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 mt-auto">
          <button
            onClick={() => setShowDetail(true)}
            className="py-1 px-4 rounded-full text-xs font-semibold transition-colors border whitespace-nowrap"
            style={{
              border: "1.5px solid hsl(178 49% 42%)",
              color: "hsl(178 49% 35%)",
              background: hovered ? "rgba(170, 231, 223, 0.32)" : "rgba(255,255,255,0.42)",
            }}
          >
            Preview Brief
          </button>
          <button
            onClick={() => navigate(launchUrl)}
            className="py-1 px-4 rounded-full text-xs font-semibold transition-colors border whitespace-nowrap"
            style={{
              border: "1.5px solid hsl(223 32% 34%)",
              color: "hsl(223 32% 28%)",
              background: hovered ? "rgba(233, 243, 252, 0.95)" : "rgba(255,255,255,0.75)",
            }}
          >
            Start Scenario →
          </button>
          {!scenario.isBuiltIn && onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="py-1 px-2 rounded-full text-xs transition-colors border absolute right-3"
              style={{
                border: "1.5px solid #ef4444",
                color: "#dc2626",
                background: "transparent",
                opacity: deleting ? 0.5 : 1,
                cursor: deleting ? "not-allowed" : "pointer"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              title="Delete scenario"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDetail && (
          <ScenarioDetailModal
            scenario={scenario}
            difficulty={difficulty}
            onClose={() => setShowDetail(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
