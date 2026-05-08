import { extractScenarioOwnedOpeningTurn } from "../../components/roleplay/openingTurnAuthority.js";
import { deriveScenarioMetadataEnvelope } from "../roleplay-v2/scenarioMetadataEnvelope.js";
import { resolveActiveHcpAskState } from "./activeHcpAskState.js";

export const ROLEPLAY_SCENARIO_EXECUTION_CONTRACT_VERSION = "roleplay_scenario_execution_contract_v1";

const CONCERN_PATTERNS = Object.freeze({
  workflow: /\b(workflow|staff|staffing|nurse|team|throughput|burden|operational|implementation|implement|process|capacity|standardi[sz]e|training|education|monitoring|call-?tree|one-?pager|pathway|handoff|checklist|protocol|template|standing order)\b/i,
  evidence: /\b(evidence|study|trial|endpoint|head-to-head|methodology|duration|confidence interval|data|proof|formulary|p&t|committee|budget|decision|practice)\b/i,
  access: /\b(access|prior auth|prior-auth|authorization|coverage|payer|insurance|formular|cost|reimbursement|paperwork|copay|affordability|hub|enrollment|benefits)\b/i,
  time: /\b(time|busy|schedule|clinic|today|quick|minutes|rush|back-to-back|between patients)\b/i,
  policy: /\b(policy|protocol|guideline|committee|pathway|institution|restriction|formulary)\b/i,
  screening: /\b(screening|screen|eligibility|eligible|candidacy|candidate|contraindication|resistance|adherence|missed dose|long-acting|injectable|cabotegravir)\b/i,
});

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
  const text = normalizeText(value);
  return text ? [text] : [];
}

function detectConcernFamily(text = "") {
  const sample = String(text || "");
  for (const [family, pattern] of Object.entries(CONCERN_PATTERNS)) {
    if (pattern.test(sample)) return family;
  }
  return "workflow";
}

function classifyOpeningAskStrength(openingText = "", activeAskSource = "") {
  const value = String(openingText || "").toLowerCase();
  if (!value.trim()) return "context_only";
  if (activeAskSource === "narrative_context") return "hard_explicit_ask";
  if (/\?/.test(value)) return "hard_explicit_ask";
  if (/\b(give me|show me|tell me|help me|keep it to|start with|focus on|answer|recommend|recommendation|concrete step|practical step|one step|single point|proof point|first step|what should change)\b/.test(value)) {
    return "hard_explicit_ask";
  }
  if (/\b(asks?|asked|asking|signals for|expects|looking for|needs?|wants?|concern|concerned|constraint|barrier|pressure|issue|problem|struggling|frustrated|short-staffed|workflow|screening|access|evidence|formulary|time|minutes)\b/.test(value)) {
    return "soft_implied_ask";
  }
  return "context_only";
}

function deriveTerminalRules(scenario = {}, metadataEnvelope = {}) {
  const text = [scenario?.title, scenario?.description, scenario?.context, scenario?.openingScene, scenario?.hcpMood].filter(Boolean).join(" ").toLowerCase();
  const timePressure = /\b(time|minutes|busy|between patients|schedule|running late|committee|agenda)\b/.test(text)
    || metadataEnvelope?.interaction_skill === "no_time_physician";
  return {
    maxRepeatedMissesBeforePause: timePressure ? 3 : 4,
    terminalCuePolicy: "behavioral_or_spoken_close_freezes_ask_state",
  };
}

export function buildRoleplayScenarioExecutionContract(scenario = {}, taxonomy = {}) {
  const metadataEnvelope = deriveScenarioMetadataEnvelope(scenario, taxonomy);
  const openingTurn = extractScenarioOwnedOpeningTurn(scenario);
  const scenarioText = [
    scenario?.title,
    scenario?.description,
    scenario?.context,
    scenario?.objective,
    scenario?.hcpMood,
    scenario?.stakeholder,
    scenario?.specialty,
    scenario?.hcp_category,
    scenario?.influence_driver,
    ...normalizeList(scenario?.challenges),
    ...normalizeList(scenario?.keyMessages),
  ].filter(Boolean).join(" ");
  const primaryConcernFamily = detectConcernFamily([
    openingTurn?.cueText,
    openingTurn?.dialogueText,
    scenarioText,
  ].filter(Boolean).join(" "));
  const initialActiveAsk = resolveActiveHcpAskState({
    narrativeContext: openingTurn?.cueText || "",
    openingContext: openingTurn?.dialogueText || "",
    fallbackConcern: primaryConcernFamily,
  });
  const openingAskStrength = classifyOpeningAskStrength(
    [initialActiveAsk?.askText, openingTurn?.cueText, openingTurn?.dialogueText].filter(Boolean).join(" "),
    initialActiveAsk?.source,
  );

  return {
    contractVersion: ROLEPLAY_SCENARIO_EXECUTION_CONTRACT_VERSION,
    scenarioIdentity: {
      scenarioId: scenario?.id || scenario?.scenarioId || scenario?.title || "unknown_scenario",
      title: normalizeText(scenario?.title || "Untitled Scenario"),
      category: normalizeText(scenario?.category || metadataEnvelope.family || "unknown"),
      specialty: normalizeText(scenario?.specialty || "unknown"),
      difficulty: normalizeText(scenario?.difficulty || metadataEnvelope.difficulty_level || "intermediate"),
    },
    metadataEnvelope,
    hcpPersona: {
      stakeholder: normalizeText(scenario?.stakeholder || scenario?.hcp || "HCP"),
      mood: normalizeText(scenario?.hcpMood || "neutral"),
      personaPrimary: metadataEnvelope.persona_primary,
      influenceDriver: normalizeText(scenario?.influence_driver || ""),
    },
    openingState: {
      cueText: normalizeText(openingTurn?.cueText || ""),
      dialogueText: normalizeText(openingTurn?.dialogueText || ""),
      consumed: false,
      askStrength: openingAskStrength,
      primaryConcernFamily,
    },
    activeAsk: {
      source: initialActiveAsk?.source || "fallback_concern",
      askText: normalizeText(initialActiveAsk?.askText || primaryConcernFamily),
      concernFamily: initialActiveAsk?.concernFamily || primaryConcernFamily,
      strength: openingAskStrength,
      answerStatus: "unanswered",
      escalationStage: 0,
    },
    constraints: {
      concernFamily: primaryConcernFamily,
      challenges: normalizeList(scenario?.challenges),
      keyMessages: normalizeList(scenario?.keyMessages),
      impact: normalizeList(scenario?.impact),
    },
    stateMachine: {
      currentState: metadataEnvelope.persona_primary === "skeptical_specialist" ? "skeptical" : "neutral",
      allowedStates: ["neutral", "engaged", "narrowed", "pressured", "terminal"],
      terminalRules: deriveTerminalRules(scenario, metadataEnvelope),
    },
    repEvaluationTargets: {
      firstTurnMustAddress: openingAskStrength === "hard_explicit_ask" ? "active_opening_ask" : "opening_context_or_plausible_continuity",
      concernFamily: primaryConcernFamily,
    },
    coachingHooks: {
      firstTurnWeakContext: openingAskStrength === "hard_explicit_ask" ? "block_if_ignored" : "soft_coach_if_weak",
    },
    managerIntegration: {
      scenarioFamily: metadataEnvelope.family,
      chapterStage: metadataEnvelope.chapter_stage,
      interactionSkill: metadataEnvelope.interaction_skill,
      complianceMode: metadataEnvelope.compliance_mode,
    },
  };
}

export function validateRoleplayScenarioExecutionContract(contract = {}) {
  const issues = [];
  if (contract?.contractVersion !== ROLEPLAY_SCENARIO_EXECUTION_CONTRACT_VERSION) issues.push("invalid_contract_version");
  if (!contract?.scenarioIdentity?.scenarioId) issues.push("missing_scenario_id");
  if (!contract?.activeAsk?.askText) issues.push("missing_active_ask");
  if (!contract?.activeAsk?.concernFamily) issues.push("missing_active_ask_family");
  if (!contract?.openingState?.askStrength) issues.push("missing_opening_ask_strength");
  if (!contract?.managerIntegration?.scenarioFamily) issues.push("missing_manager_integration_family");
  return {
    valid: issues.length === 0,
    issues,
  };
}
