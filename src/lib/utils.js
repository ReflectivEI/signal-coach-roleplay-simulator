import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility to format AI-generated scenario text without dropping content.
export function formatScenarioText(rawText = "") {
  const text = String(rawText)
    .replace(/\r\n/g, "\n")
    .replace(/```[\w-]*\n?|\n?```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return "";

  const sectionLabels = [
    "Title",
    "Scenario Brief",
    "Brief",
    "Difficulty",
    "HCP Background and Context",
    "HCP",
    "Stakeholder",
    "Initial Greeting from the HCP",
    "Opening Scene",
    "Scene",
    "Objective",
    "Potential Objections or Resistance Points",
    "Key Challenges",
    "Challenges",
    "Best Approach and Expected Outcome",
    "Expected Outcome",
    "Follow-Up Questions",
    "Common Mistakes to Avoid",
  ];

  const labelPattern = new RegExp(`(^|\\n)(${sectionLabels.join("|")}):\\s*`, "gi");
  const formatted = text
    .replace(labelPattern, (_match, prefix, label) => `${prefix}\n\n**${label}**\n`)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return formatted || text;
}

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const isIframe = window.self !== window.top;
