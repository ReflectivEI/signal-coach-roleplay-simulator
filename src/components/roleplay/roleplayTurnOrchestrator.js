import {
  buildTurnContractBlock,
  validateGeneratedTurn,
  applySatisfactionToLedger,
  buildModeFallbackResponse,
} from "./turnContractController.js";

function buildEngagementLayer({ decayState, activeConcern, suppressCoachingHints, tierGuidance, tierSentenceMax }) {
  if (suppressCoachingHints) {
    return `\n\nENGAGEMENT DECAY LAYER:\n- Current engagement tier: ${decayState.tier}.\n- Active concern to protect: ${activeConcern}.\n- Concern addressed by rep this turn: ${decayState.concernAddressed ? "yes" : "no"}.\n- Repeated evidence without operational link: ${decayState.repeatedEvidence ? "yes" : "no"}.\n- Tier directive: Keep the response concise and mode-compliant. Do not add coaching/probing that conflicts with the selected response mode.\n- Keep sentence count at or below ${tierSentenceMax[decayState.tier]}.\n- Maintain professional tone. Be firm if needed, but never hostile or sarcastic.`;
  }

  return `\n\nENGAGEMENT DECAY LAYER:\n- Current engagement tier: ${decayState.tier}.\n- Active concern to protect: ${activeConcern}.\n- Concern addressed by rep this turn: ${decayState.concernAddressed ? "yes" : "no"}.\n- Repeated evidence without operational link: ${decayState.repeatedEvidence ? "yes" : "no"}.\n- Tier directive: ${tierGuidance[decayState.tier]}\n- Keep sentence count at or below ${tierSentenceMax[decayState.tier]}.\n- Maintain professional tone. Be firm if needed, but never hostile or sarcastic.`;
}

async function invokeModel({ invokeRoleplayModel, prompt, normalizeGeneratedDialogue }) {
  const response = await invokeRoleplayModel(prompt);
  return normalizeGeneratedDialogue(String(response || "").trim().split("\n")[0] || "");
}

export async function runObligationAwareGeneration({
  scenario,
  nextProfile,
  historyText,
  isFirstHcpResponse,
  decayState,
  activeConcern,
  suppressCoachingHints,
  tierGuidance,
  tierSentenceMax,
  turnContractBlock,
  selectedResponseMode,
  obligationLedgerBeforeGeneration,
  repMessage,
  forceTerminalDisengagement,
  terminalCloseFallback,
  buildFirstTurnScenarioFallback,
  buildFollowUpScenarioFallback,
  latestCounterpartIntent,
  invokeRoleplayModel,
  buildPrompt,
  normalizeGeneratedDialogue,
  debugEnabled = false,
  logger = console,
}) {
  let usedDeterministicFallback = false;
  let retryTriggered = false;
  let attemptCount = 0;
  let nextHcpDialogue = "";

  if (forceTerminalDisengagement) {
    nextHcpDialogue = terminalCloseFallback;
    usedDeterministicFallback = true;
  } else {
    const systemPrompt = buildPrompt({
      scenario,
      hcpProfile: nextProfile,
      historyText,
      isOpening: isFirstHcpResponse,
      turnContractBlock,
    }) + buildEngagementLayer({
      decayState,
      activeConcern,
      suppressCoachingHints,
      tierGuidance,
      tierSentenceMax,
    });

    try {
      attemptCount += 1;
      nextHcpDialogue = await invokeModel({ invokeRoleplayModel, prompt: systemPrompt, normalizeGeneratedDialogue });
    } catch {
      usedDeterministicFallback = true;
      nextHcpDialogue = isFirstHcpResponse
        ? buildFirstTurnScenarioFallback()
        : buildFollowUpScenarioFallback();
    }
  }

  let obligationValidation = validateGeneratedTurn({
    mode: selectedResponseMode,
    generatedText: nextHcpDialogue,
    ledger: obligationLedgerBeforeGeneration,
    latestCounterpartTurn: repMessage,
  });

  if (!obligationValidation.satisfied && !forceTerminalDisengagement) {
    retryTriggered = true;
    if (debugEnabled) logger.debug("ROLEPLAY_OBLIGATION_VALIDATION_FAILED_INITIAL", obligationValidation);

    try {
      const strictContractBlock = buildTurnContractBlock({
        ledger: obligationLedgerBeforeGeneration,
        latestCounterpartIntent,
        selectedMode: selectedResponseMode,
        strictness: "strict",
      });
      const retryPrompt = buildPrompt({
        scenario,
        hcpProfile: nextProfile,
        historyText,
        isOpening: isFirstHcpResponse,
        turnContractBlock: strictContractBlock,
      });
      attemptCount += 1;
      nextHcpDialogue = await invokeModel({ invokeRoleplayModel, prompt: retryPrompt, normalizeGeneratedDialogue });
    } catch {
      usedDeterministicFallback = true;
      nextHcpDialogue = buildModeFallbackResponse(
        selectedResponseMode,
        obligationLedgerBeforeGeneration,
        repMessage,
      );
    }

    obligationValidation = {
      ...validateGeneratedTurn({
        mode: selectedResponseMode,
        generatedText: nextHcpDialogue,
        ledger: obligationLedgerBeforeGeneration,
        latestCounterpartTurn: repMessage,
      }),
      retryUsed: true,
    };
  }

  if (!obligationValidation.satisfied) {
    usedDeterministicFallback = true;
    nextHcpDialogue = buildModeFallbackResponse(
      selectedResponseMode,
      obligationLedgerBeforeGeneration,
      repMessage,
    );
    obligationValidation = {
      ...validateGeneratedTurn({
        mode: selectedResponseMode,
        generatedText: nextHcpDialogue,
        ledger: obligationLedgerBeforeGeneration,
        latestCounterpartTurn: repMessage,
      }),
      retryUsed: true,
      reason: "Fallback response applied after validation miss.",
    };
  }

  const obligationLedgerAfter = applySatisfactionToLedger(
    obligationLedgerBeforeGeneration,
    obligationValidation,
  );

  return {
    nextHcpDialogue,
    obligationValidation,
    obligationLedgerAfter,
    usedDeterministicFallback,
    retryTriggered,
    attemptCount,
  };
}
