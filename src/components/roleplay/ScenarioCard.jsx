import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RolePlayChat from "./RolePlayChat";

const difficultyColors = {
  beginner: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  intermediate: { bg: "#fefce8", text: "#854d0e", border: "#fde68a" },
  advanced: { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
};

const hcpMoodColor = "#39ACAC";

// Derive stakeholder label from scenario data
function getStakeholder(scenario) {
  const parts = [];
  if (scenario.hcp_category) parts.push(scenario.hcp_category);
  if (scenario.specialty) parts.push(scenario.specialty);
  return parts.join(" — ");
}

function getObjective(scenario) {
  return scenario.objective || scenario.details || "Practice Signal Intelligence™ behaviors in a realistic clinical conversation with an emphasis on reading and responding to cues.";
}

function getChallenges(scenario) {
  return scenario.challenges || [
    "Navigating resistance or low engagement",
    "Connecting value to HCP priorities",
  ];
}

function getMoodLabel(scenario) {
  return scenario.hcp_mood || scenario.influence_driver || "professional, guarded";
}

function getOpeningScene(scenario) {
  return scenario.opening_scene || `The HCP is available for a brief conversation. This is your opportunity to open with purpose and read the room carefully.`;
}

export default function ScenarioCard({ scenario, renderAs }) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const dc = difficultyColors[scenario.difficulty] || difficultyColors.intermediate;

  // When used as "button-only" inside EnterpriseScenarioCard
  if (renderAs === "button-only") {
    return (
      <>
        <button
          onClick={() => setPlaying(true)}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 group-hover:shadow-md"
          style={{ background: "#1A334D" }}
        >
          Start Scenario →
        </button>
        {playing && <RolePlayChat scenario={scenario} onClose={() => setPlaying(false)} />}
      </>
    );
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(26,51,77,0.10)" }}
        className="bg-white rounded-xl border border-gray-100 overflow-hidden"
        style={{ transition: "box-shadow 0.2s, border-color 0.2s" }}
      >
        {/* Card header — always visible */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug flex-1">{scenario.title}</h3>
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 capitalize"
              style={{ background: dc.bg, color: dc.text, border: `1px solid ${dc.border}` }}
            >
              {scenario.difficulty}
            </span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed mb-4">{scenario.description}</p>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
            >
              {expanded ? "Collapse Details" : "Expand for Details"}
            </button>
            <button
              onClick={() => setPlaying(true)}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-all duration-150 hover:opacity-90"
              style={{ background: "#39ACAC" }}
            >
              Start Scenario
            </button>
          </div>
        </div>

        {/* Expanded details */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
                {/* Stakeholder */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Stakeholder</p>
                  <p className="text-sm text-gray-900">{getStakeholder(scenario)}</p>
                </div>

                {/* Objective */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Objective</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{getObjective(scenario)}</p>
                </div>

                {/* Key Challenges */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Key Challenges</p>
                  <ul className="space-y-1">
                    {getChallenges(scenario).map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#39ACAC" }} />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* HCP Mood */}
                <div className="pt-1 border-t border-gray-100">
                  <p className="text-xs italic" style={{ color: hcpMoodColor }}>{getMoodLabel(scenario)}</p>
                </div>

                {/* Opening Scene */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Opening Scene</p>
                  <p className="text-sm italic text-gray-600 leading-relaxed">{getOpeningScene(scenario)}</p>
                </div>

                {/* Signal Capabilities */}
                {scenario.focus_capabilities?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Signal Capabilities Practiced</p>
                    <div className="flex flex-wrap gap-1.5">
                      {scenario.focus_capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "#e6f7f7", color: "#1A334D", border: "1px solid #b2e4e4" }}
                        >
                          {cap.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {playing && (
        <RolePlayChat scenario={scenario} onClose={() => setPlaying(false)} />
      )}
    </>
  );
}