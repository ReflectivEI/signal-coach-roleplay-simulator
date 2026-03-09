import { formatScenarioText } from "../../lib/utils";
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

  // If scenario.description is AI-generated, format it
  const formattedDescription = scenario.description
    ? formatScenarioText(scenario.description)
    : "";

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
        className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden font-sans"
        style={{ transition: "box-shadow 0.2s, border-color 0.2s" }}
      >
        {/* Card header — always visible */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-extrabold text-brand-navy text-lg leading-snug flex-1 tracking-wide">{scenario.title}</h3>
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 capitalize border"
              style={{ background: dc.bg, color: dc.text, borderColor: dc.border }}
            >
              {scenario.difficulty}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mb-4 font-medium whitespace-pre-line">{formattedDescription}</p>

          {/* Action buttons */}
          <div className="flex flex-row gap-2 mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-md font-semibold text-brand-navy bg-brand-pale-yellow hover:border-brand-teal hover:bg-brand-teal hover:text-white transition-all duration-200 shadow-sm"
            >
              {expanded ? "Collapse Details" : "Expand for Details"}
            </button>
            <button
              onClick={() => setPlaying(true)}
              className="flex-1 py-2 rounded-lg text-md font-bold text-white bg-brand-teal hover:bg-brand-navy transition-all duration-200 shadow-sm"
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
              <div className="px-6 pb-6 border-t border-gray-200 pt-4 space-y-4">
                {/* Stakeholder */}
                <div>
                  <p className="text-xs font-bold text-brand-teal uppercase tracking-wider mb-0.5">Stakeholder</p>
                  <p className="text-md text-brand-navy font-semibold">{getStakeholder(scenario)}</p>
                </div>

                {/* Objective */}
                <div>
                  <p className="text-xs font-bold text-brand-teal uppercase tracking-wider mb-0.5">Objective</p>
                  <p className="text-md text-gray-700 leading-relaxed font-medium">{getObjective(scenario)}</p>
                </div>

                {/* Key Challenges */}
                <div>
                  <p className="text-xs font-bold text-brand-teal uppercase tracking-wider mb-1">Key Challenges</p>
                  <ul className="list-disc list-inside space-y-1">
                    {getChallenges(scenario).map((c, i) => (
                      <li key={i} className="text-md text-gray-700 font-medium">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* HCP Mood */}
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs italic font-semibold text-brand-teal">{getMoodLabel(scenario)}</p>
                </div>

                {/* Opening Scene */}
                <div>
                  <p className="text-xs font-bold text-brand-teal uppercase tracking-wider mb-0.5">Opening Scene</p>
                  <p className="text-md italic text-gray-600 leading-relaxed font-medium">{getOpeningScene(scenario)}</p>
                </div>

                {/* Signal Capabilities */}
                {scenario.focus_capabilities?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-brand-teal uppercase tracking-wider mb-1">Signal Capabilities Practiced</p>
                    <div className="flex flex-wrap gap-2">
                      {scenario.focus_capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="text-xs px-3 py-1 rounded-full font-semibold border"
                          style={{ background: "#e6f7f7", color: "#1A334D", borderColor: "#b2e4e4" }}
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