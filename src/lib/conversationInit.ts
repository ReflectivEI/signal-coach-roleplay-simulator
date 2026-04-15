/**
 * Conversation Initialization Engine
 * ====================================
 * Extracted from simulatorEngine.ts to keep file size manageable.
 * Establishes rep-first simulator setup and initial guidance.
 */

import type { VolatilityProfile } from "./simulatorEngine";

export type ConversationStartType = "rep_initiated";

export interface ConversationInit {
  startType: ConversationStartType;
  hcpOpeningText: null;
  initialBehaviorState: string;
  initialVolatilityProfile: VolatilityProfile;
  inputPlaceholder: string;
  openingGuidance: string[];       // non-scripted suggestions shown to rep
}

export async function initializeConversation(scenario: any): Promise<ConversationInit> {
  // Rep ALWAYS opens the conversation
  const startType: ConversationStartType = "rep_initiated";

  // Determine initial behavior state from scenario
  const initialBehaviorState = scenario.startingBehaviorState || "neutral";

  // Persona-specific input guidance (non-scripted — gives rep cognitive scaffolding)
  const guidanceMap: Record<string, string[]> = {
    time_constrained_community_doctor: [
      "Acknowledge time constraints immediately",
      "Lead with a single, specific question",
      "Avoid any framing or setup — get to the point"
    ],
    skeptical_specialist: [
      "Reference a specific clinical context, not a product claim",
      "Ask what they've observed — not what you want to tell them",
      "Signal you're here to explore, not pitch"
    ],
    cost_focused_decision_maker: [
      "Reference patient or practice impact — not efficacy data",
      "Ask about their current decision criteria",
      "Acknowledge the access or cost context upfront"
    ],
    curious_uncertain_adopter: [
      "Ask an open question about their current approach",
      "Reference a prior interaction if one exists",
      "Create space — don't fill the silence with content"
    ]
  };

  const guidance = guidanceMap[scenario.persona] || [
    "Open with a question relevant to this HCP's context",
    "Acknowledge any prior interaction or referral",
    "Avoid leading with product claims"
  ];

  return {
    startType,
    hcpOpeningText: null,
    initialBehaviorState,
    initialVolatilityProfile: "stable",
    inputPlaceholder: "Open the conversation. Read the scene and cues carefully.",
    openingGuidance: guidance
  };
}
