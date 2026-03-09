// Utility to format AI-generated scenario text
export function formatScenarioText(rawText) {
  let text = rawText.replace(/\*/g, "").replace(/\n{2,}/g, "\n");
  const sections = [
    { key: "Stakeholder", regex: /(Stakeholder:|Stakeholder\s*-)/i },
    { key: "Objective", regex: /(Objective:|Objective\s*-)/i },
    { key: "Key Challenges", regex: /(Key Challenges:|Challenges:|Challenges\s*-)/i },
    { key: "Mood", regex: /(Mood:|HCP Mood:|Mood\s*-)/i },
    { key: "Opening Scene", regex: /(Opening Scene:|Scene:|Scene\s*-)/i },
    { key: "Signal Capabilities Practiced", regex: /(Signal Capabilities:|Capabilities:|Capabilities\s*-)/i },
  ];
  sections.forEach(({ key, regex }) => {
    // Bold section header and add extra space
    text = text.replace(regex, `\n\n**${key}**\n`);
  });
  // Ensure double newlines between sections
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;
