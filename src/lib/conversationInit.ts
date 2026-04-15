/**
 * Conversation Initialization Engine
 * ====================================
 * Extracted from simulatorEngine.ts to keep file size manageable.
 * Determines rep vs hcp_initiated start, generates HCP opening for hcp_initiated.
 */

import { invokeWorkerText } from "@/services/workerClient";
import type { VolatilityProfile } from "./simulatorEngine";

export type ConversationStartType = "rep_initiated" | "hcp_initiated";

export interface ConversationInit {
  startType: ConversationStartType;
  hcpOpeningText: string | null;   // null for rep_initiated
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

  // For rep_initiated: no HCP opening needed
  if (startType === "rep_initiated") {
    return {
      startType,
      hcpOpeningText: null,
      initialBehaviorState,
      initialVolatilityProfile: "stable",
      inputPlaceholder: "Start the conversation. The HCP is waiting.",
      openingGuidance: guidance
    };
  }

  // For hcp_initiated: generate a constrained, persona-specific HCP opening
  const prompt = `You are generating the OPENING LINE for an HCP in a pharma rep training simulator.

SCENARIO:
Opening Scene: ${scenario.openingScene}
HCP Persona: ${scenario.persona}
Interaction Pressures: ${(scenario.interactionPressure || []).join(", ")}
Starting Behavior State: ${scenario.startingBehaviorState}
Journey Stage: ${scenario.journeyStage}
Stakeholder: ${scenario.stakeholder}
Context: ${scenario.context || ""}

RULES — APPLY ALL:
1. The opening MUST reference the Opening Scene above — it is the situational context.
2. The opening MUST include a constraint, tension, or challenge for the rep.
3. The opening MUST reflect this persona's communication style:
   - time_constrained_community_doctor: short (1–2 sentences), direct, signals limited time
   - skeptical_specialist: analytical, challenges assumptions immediately, wants specifics
   - cost_focused_decision_maker: cuts to ROI/access framing, skips clinical warmup
   - curious_uncertain_adopter: open but cautious, asking a genuine question
4. The opening MUST create immediate cognitive load for the rep — they must think before responding.
5. Do NOT use generic greetings ("Hi", "Hello", "What can I help you with?")
6. Do NOT use neutral contextless statements
7. Clinical professionalism always maintained — no sarcasm, no hostility
8. Maximum 2 sentences.

PERSONA TONE CONSTRAINTS:
- time_constrained_community_doctor: signals urgency, may mention next patient or time limit
- skeptical_specialist: challenges the premise or the data, asks for specifics immediately
- cost_focused_decision_maker: pivots to cost/access before anything else
- curious_uncertain_adopter: asks a genuine, exploratory question that puts the rep in discovery mode

Return ONLY the HCP's opening line as a plain string. No quotes, no labels, no extra text.`;

  const result = await invokeWorkerText({ prompt, max_tokens: 220, temperature: 0.2 });

  // Validate: reject generic openings by checking for forbidden patterns
  const forbidden = ["hi ", "hello", "what did you want", "how can i help", "what can i do"];
  const raw = typeof result === "string" ? result : (result as any)?.toString() || scenario.openingScene;
  const isGeneric = forbidden.some(f => raw.toLowerCase().startsWith(f));
  const hcpOpeningText = isGeneric ? scenario.openingScene : raw;

  return {
    startType,
    hcpOpeningText,
    initialBehaviorState,
    initialVolatilityProfile: "stable",
    inputPlaceholder: "Respond to the HCP. Read the scene carefully.",
    openingGuidance: guidance
  };
}
