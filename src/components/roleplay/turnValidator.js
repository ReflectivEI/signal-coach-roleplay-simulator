function toText(value = "") {
  return String(value || "").trim();
}

export async function validateTurnWithRetry({
  initialDraft = "",
  responseMode = "probe",
  turnContractState = {},
  activeConcern = "workflow",
  maxRetries = 1,
  validateTurnContract,
  buildContractRepairResponse,
  regenerate,
  additionalValidators = [],
} = {}) {
  const validatorList = Array.isArray(additionalValidators)
    ? additionalValidators.filter((fn) => typeof fn === "function")
    : [];

  let draftText = toText(initialDraft);
  let lastReason = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const contractResult = typeof validateTurnContract === "function"
      ? validateTurnContract({ responseMode, draftText, turnContractState })
      : { valid: true, reason: null };

    if (!contractResult?.valid) {
      lastReason = contractResult?.reason || "turn_contract_invalid";
    } else {
      const failedValidator = validatorList
        .map((fn) => fn({ draftText, responseMode, turnContractState, activeConcern }))
        .find((result) => result && result.valid === false);

      if (!failedValidator) {
        return {
          valid: true,
          draftText,
          attempt,
          repaired: attempt > 0,
          reason: null,
        };
      }

      lastReason = failedValidator.reason || "additional_validation_failed";
    }

    if (attempt === maxRetries) break;

    if (typeof regenerate === "function") {
      const regenerated = await regenerate({
        attempt: attempt + 1,
        lastReason,
        previousDraft: draftText,
      });
      draftText = toText(regenerated);
    } else if (typeof buildContractRepairResponse === "function") {
      draftText = toText(buildContractRepairResponse({ responseMode, activeConcern }));
    }
  }

  return {
    valid: false,
    draftText: toText(draftText),
    attempt: maxRetries,
    repaired: true,
    reason: lastReason,
  };
}
