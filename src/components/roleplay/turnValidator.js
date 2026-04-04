export async function validateTurnWithRetry({
  initialDraft = '',
  responseMode = 'probe',
  turnContractState,
  activeConcern = 'workflow',
  maxRetries = 1,
  validateTurnContract,
  buildContractRepairResponse,
} = {}) {
  const validator = typeof validateTurnContract === 'function'
    ? validateTurnContract
    : () => ({ valid: true, reasons: [] });

  const repairBuilder = typeof buildContractRepairResponse === 'function'
    ? buildContractRepairResponse
    : ({ fallbackDraft }) => fallbackDraft;

  let draftText = String(initialDraft || '').trim();
  const attempts = Math.max(0, Number(maxRetries) || 0);

  const normalizeReasons = (result) => {
    if (Array.isArray(result?.reasons)) return result.reasons;
    if (result?.reason) return [result.reason];
    return [];
  };

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    const result = validator({
      draftText,
      generatedText: draftText,
      responseMode,
      turnContractState,
      activeConcern,
    });

    if (result?.valid) {
      return {
        valid: true,
        attempts: attempt,
        draftText,
        reasons: normalizeReasons(result),
      };
    }

    const reasons = normalizeReasons(result);
    if (attempt === attempts) {
      return {
        valid: false,
        attempts: attempt,
        draftText,
        reasons,
      };
    }

    draftText = String(repairBuilder({
      fallbackDraft: draftText,
      responseMode,
      turnContractState,
      activeConcern,
      validationReasons: reasons,
    }) || draftText).trim();
  }

  return { valid: false, attempts, draftText, reasons: ['validation_retry_exhausted'] };
}
