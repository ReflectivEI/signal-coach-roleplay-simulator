import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import ScenarioDetailModal from "./ScenarioDetailModal";
import TermTooltip from "./TermTooltip";

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

export default function ScenarioCard({ scenario, index, isFeatured, onDelete }) {
  const [showDetail, setShowDetail] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const difficulty = getDifficulty(scenario);

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
        style={{
          background: "hsl(174 40% 97%)",
          border: `1px solid ${hovered ? "hsl(162 50% 65%)" : "hsl(162 50% 80%)"}`,
          borderRadius: "1rem",
          boxShadow: hovered
            ? "0 6px 20px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)"
            : "0 1px 3px rgba(0,0,0,0.04)",
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
          transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
          padding: "0.85rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem",
          position: "relative",
        }}
      >
        {/* Title + badge inline */}
        <div className="flex items-start justify-between gap-2 min-h-0">
          <h3 className="font-bold leading-tight text-base" style={{ color: "#1a1a1a" }}>
            {scenario.title}
          </h3>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 mt-0.5 ${difficulty.cls}`}>
            {difficulty.label}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setShowDetail(true)}
            className="py-1 px-4 rounded-full text-xs font-semibold transition-colors border whitespace-nowrap"
            style={{
              border: "1.5px solid hsl(174 60% 32%)",
              color: "hsl(174 60% 32%)",
              background: "transparent",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "hsl(174 60% 95%)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            Expand for Details
          </button>
          <button
            onClick={() => navigate(`/simulator?scenarioId=${scenario.id}`)}
            className="py-1 px-4 rounded-full text-xs font-bold transition-colors whitespace-nowrap"
            style={{
              background: "white",
              color: "hsl(222 40% 20%)",
              border: "1.5px solid hsl(222 40% 20%)"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "hsl(222 40% 95%)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "white"; }}
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
            onStart={() => navigate(`/simulator?scenarioId=${scenario.id}`)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
