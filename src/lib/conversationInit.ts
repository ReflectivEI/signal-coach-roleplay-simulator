/**
 * Conversation Initialization Engine
 * ====================================
 * Extracted from simulatorEngine.ts to keep file size manageable.
 * Establishes rep vs hcp initiated startup plus backend opener state.
 */

import type { VolatilityProfile } from "./simulatorEngine";
import { requestHcpOpening } from "@/services/workerClient";

export type ConversationStartType = "rep_initiated" | "hcp_initiated";

export interface ConversationInit {
  startType: ConversationStartType;
  hcpOpeningText: string | null;
  initialBehaviorState: string;
  initialVolatilityProfile: VolatilityProfile;
  inputPlaceholder: string;
  openingGuidance: string[];       // non-scripted suggestions shown to rep
}

export async function initializeConversation(scenario: any, sessionId?: string): Promise<ConversationInit> {
  const startType: ConversationStartType =
    scenario?.conversationStartType === "hcp_initiated" ? "hcp_initiated" : "rep_initiated";
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

  let hcpOpeningText: string | null = null;

  if (sessionId) {
    try {
      const realism = await requestHcpOpening({
        sessionId,
        scenarioId: scenario?.id || "",
        title: scenario?.title || "",
        stakeholder: scenario?.stakeholder || "",
        objective: scenario?.objective || "",
        persona: scenario?.persona || null,
        journeyStage: scenario?.journeyStage || null,
        interactionPressure: Array.isArray(scenario?.interactionPressure) ? scenario.interactionPressure : [],
        startingBehaviorState: scenario?.startingBehaviorState || initialBehaviorState,
      });
      hcpOpeningText = realism.rewrittenLine || null;
    } catch {
      hcpOpeningText = null;
    }
  }

  return {
    startType,
    hcpOpeningText,
    initialBehaviorState,
    initialVolatilityProfile: "stable",
    inputPlaceholder:
      startType === "hcp_initiated"
        ? "Respond to the HCP. Read the scene and cues carefully."
        : "Open the conversation. Read the scene and cues carefully.",
    openingGuidance: guidance
  };
}
