function normalizeText(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function extractRepReferenceSignals(repMessage = "") {
  const text = normalizeText(repMessage);
  return {
    hasAcknowledgment: /\b(i hear|i understand|fair point|you are right|valid concern|i appreciate)\b/.test(text),
    hasEvidence: /\b(study|trial|data|evidence|published|outcome|percent|rate|metric)\b/.test(text),
    hasAccessConstraint: /\b(access|prior auth|coverage|payer|authorization|paperwork|reimbursement)\b/.test(text),
    hasWorkflowConstraint: /\b(workflow|staff|capacity|clinic|process|handoff|time)\b/.test(text),
    hasNextStep: /\b(first step|next step|start with|do this|assign|timeline|this week|today)\b/.test(text),
  };
}

export function validateReferencePhrase(phrase = "") {
  const normalized = String(phrase || "").replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (normalized.split(" ").length < 3) return false;
  if (/\b(\w+)\s+\1\s+\1\b/i.test(normalized)) return false;
  if (/\b(and|or|to|for|with|of|the)\.?$/i.test(normalized)) return false;
  return true;
}

export function buildSafeRepReferencePhrase(repMessage = "") {
  const signals = extractRepReferenceSignals(repMessage);
  const candidates = [
    signals.hasAcknowledgment && signals.hasAccessConstraint && "the access challenge",
    signals.hasAcknowledgment && signals.hasWorkflowConstraint && "the workflow constraint",
    signals.hasEvidence && "supporting evidence",
    signals.hasNextStep && "a concrete next step",
    signals.hasAcknowledgment && "the concern",
    signals.hasWorkflowConstraint && "workflow fit",
    signals.hasAccessConstraint && "access barriers",
  ].filter(Boolean);

  const selected = candidates[0] ? `You mentioned ${candidates[0]}` : "";
  return validateReferencePhrase(selected) ? selected : "";
}

export function buildSafeReferenceLeadIn(repMessage = "", fallback = "I hear your concern.") {
  const reference = buildSafeRepReferencePhrase(repMessage);
  if (reference) return `${reference}.`;
  return String(fallback || "I hear your concern.").trim();
}
