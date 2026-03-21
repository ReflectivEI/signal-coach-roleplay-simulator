import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const SCENARIO_SECTION_ALIASES = {
  title: "Scenario Overview",
  "scenario overview": "Scenario Overview",
  "scenario brief": "Scenario Overview",
  brief: "Scenario Overview",
  overview: "Scenario Overview",
  situation: "Situation",
  "situation setup": "Situation",
  context: "Situation",
  "hcp background and context": "Situation",
  "hcp context": "Situation",
  "behavioral signals": "Behavioral Signals",
  signals: "Behavioral Signals",
  "hcp behavioral signals": "Behavioral Signals",
  "opening statement": "Opening Statement",
  "opening scene": "Opening Statement",
  "opening concern": "Opening Statement",
  "the hcp's opening statement or concern": "Opening Statement",
  "initial greeting from the hcp": "Opening Statement",
  "follow-up questions": "Follow-up Questions",
  "follow up questions": "Follow-up Questions",
  questions: "Follow-up Questions",
  "common mistakes": "Common Mistakes",
  "common mistakes to avoid": "Common Mistakes",
  "mistakes to avoid": "Common Mistakes",
  "best approach": "Best Approach",
  "best approach and expected outcome": "Best Approach",
  "expected outcome": "Best Approach",
  "closing technique": "Closing Technique",
  "closing techniques": "Closing Technique",
  closing: "Closing Technique",
};

const REQUIRED_SCENARIO_SECTIONS = [
  "Scenario Overview",
  "Situation",
  "Behavioral Signals",
  "Opening Statement",
  "Follow-up Questions",
  "Common Mistakes",
  "Best Approach",
  "Closing Technique",
];

function toSectionKey(label = "") {
  return label.toLowerCase().replace(/[–—-]/g, " ").replace(/[^a-z\s']/g, "").replace(/\s+/g, " ").trim();
}

function normalizeScenarioLine(line = "") {
  return line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
}

function sentenceCase(value = "") {
  const text = String(value).trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function inferClosingTechnique(bestApproach = "") {
  if (!bestApproach) return "Close by confirming a specific next step, owner, and timing before the interaction ends.";
  const sentences = String(bestApproach).split(/(?<=[.!?])\s+/).filter(Boolean);
  const candidate = sentences.find((sentence) => /close|next step|follow-up|commit|confirm|owner|date|timeline/i.test(sentence));
  return candidate || "Close by confirming a specific next step, owner, and timing before the interaction ends.";
}

// Utility to format AI-generated scenario text without dropping content.
export function formatScenarioText(rawText = "") {
  const cleaned = String(rawText)
    .replace(/\r\n/g, "\n")
    .replace(/```[\w-]*\n?|\n?```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) return "";

  const sections = Object.fromEntries(REQUIRED_SCENARIO_SECTIONS.map((section) => [section, []]));
  let activeSection = "Scenario Overview";

  cleaned.split("\n").forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const [, rawLabel, rest] = match;
      const mappedSection = SCENARIO_SECTION_ALIASES[toSectionKey(rawLabel)];
      if (mappedSection) {
        activeSection = mappedSection;
        if (rest.trim()) sections[mappedSection].push(rest.trim());
        return;
      }
    }

    sections[activeSection].push(line);
  });

  if (!sections["Behavioral Signals"].length) {
    sections["Behavioral Signals"].push("Look for shifts in tone, urgency, engagement, and what the HCP emphasizes or avoids.");
  }
  if (!sections["Follow-up Questions"].length) {
    sections["Follow-up Questions"].push("What is driving the HCP's current perspective or concern?");
    sections["Follow-up Questions"].push("What patient or workflow impact matters most in this situation?");
  }
  if (!sections["Common Mistakes"].length) {
    sections["Common Mistakes"].push("Jumping into product detail before confirming the HCP's priority.");
  }
  if (!sections["Best Approach"].length) {
    sections["Best Approach"].push("Acknowledge the HCP's context, connect to the most relevant value point, and guide toward a practical next step.");
  }
  if (!sections["Closing Technique"].length) {
    sections["Closing Technique"].push(inferClosingTechnique(sections["Best Approach"].join(" ")));
  }

  const formatSectionBody = (section, entries) => {
    const normalized = entries.map(normalizeScenarioLine).filter(Boolean);
    if (!normalized.length) return "";

    if (["Behavioral Signals", "Common Mistakes"].includes(section)) {
      return normalized.map((entry) => `- ${sentenceCase(entry)}`).join("\n");
    }

    if (section === "Follow-up Questions") {
      return normalized
        .map((entry) => entry.replace(/^(follow-up questions?|follow up questions?)\s*:*/i, "").trim())
        .filter(Boolean)
        .map((entry) => `- ${entry}`)
        .join("\n");
    }

    return normalized.join(" ");
  };

  return REQUIRED_SCENARIO_SECTIONS
    .map((section) => {
      const body = formatSectionBody(section, sections[section]);
      if (!body) return "";
      return `## ${section}\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const isIframe = window.self !== window.top;
