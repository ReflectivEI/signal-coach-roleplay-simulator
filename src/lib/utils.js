// Utility to format AI-generated scenario text
export function formatScenarioText(rawText) {
  // Remove asterisks and excess whitespace
  let text = rawText.replace(/\*/g, "").replace(/\n{2,}/g, "\n");
  // Extract sections
  const sectionMap = {
    title: /^(Scenario Brief:|Title:|Scenario:|Brief:)[^\n]*\n?/im,
    difficulty: /(Difficulty:|Level:)[^\n]*\n?/im,
    brief: /(Scenario Brief:|Brief:)[^\n]*\n?/im,
    hcp: /(HCP Background and Context:|HCP:|Stakeholder:)[^\n]*\n?/im,
    opening: /(Initial Greeting from the HCP:|Opening Scene:|Scene:)[^\n]*\n?/im,
    objective: /(Objective:)[^\n]*\n?/im,
    challenges: /(Potential Objections or Resistance Points:|Key Challenges:|Challenges:)[^\n]*((\n\s*\d+\.|\n\s*-|\n\s*\*)[^\n]*)*/im,
  };
  let formatted = "";
  // Title
  const titleMatch = text.match(sectionMap.title);
  if (titleMatch) formatted += `**Title**\n${titleMatch[0].replace(/^(Scenario Brief:|Title:|Scenario:|Brief:)/i, "").trim()}\n\n`;
  // Difficulty
  const diffMatch = text.match(sectionMap.difficulty);
  if (diffMatch) formatted += `**Difficulty**\n${diffMatch[0].replace(/^(Difficulty:|Level:)/i, "").trim()}\n\n`;
  // Brief
  const briefMatch = text.match(sectionMap.brief);
  if (briefMatch) formatted += `**Brief**\n${briefMatch[0].replace(/^(Scenario Brief:|Brief:)/i, "").trim()}\n\n`;
  // HCP
  const hcpMatch = text.match(sectionMap.hcp);
  if (hcpMatch) formatted += `**HCP**\n${hcpMatch[0].replace(/^(HCP Background and Context:|HCP:|Stakeholder:)/i, "").trim()}\n\n`;
  // Opening Scene
  const openingMatch = text.match(sectionMap.opening);
  if (openingMatch) formatted += `**Opening Scene**\n${openingMatch[0].replace(/^(Initial Greeting from the HCP:|Opening Scene:|Scene:)/i, "").trim()}\n\n`;
  // Objective
  const objMatch = text.match(sectionMap.objective);
  if (objMatch) formatted += `**Objective**\n${objMatch[0].replace(/^(Objective:)/i, "").trim()}\n\n`;
  // Challenges
  const chalMatch = text.match(sectionMap.challenges);
  if (chalMatch) {
    formatted += `**Key Challenges**\n`;
    // Extract bullet points
    const bullets = chalMatch[0].split(/\n/).filter(l => l.match(/^(\s*\d+\.|\s*-|\s*\*)/));
    formatted += bullets.map(b => b.replace(/^\s*\d+\.\s*|^\s*-\s*|^\s*\*\s*/, "- ")).join("\n");
    formatted += "\n\n";
  }
  return formatted.trim();
}
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;
