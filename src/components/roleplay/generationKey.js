export function normalizeGenerationText(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function buildDeterministicGenerationKey({
  sessionId = "",
  turnNumber = -1,
  repMessage = "",
} = {}) {
  const normalizedSessionId = String(sessionId || "").trim() || "session-unknown";
  const normalizedTurn = Number.isFinite(turnNumber) ? turnNumber : -1;
  const normalizedRepMessage = normalizeGenerationText(repMessage);
  return `${normalizedSessionId}::${normalizedTurn}::${normalizedRepMessage}`;
}
