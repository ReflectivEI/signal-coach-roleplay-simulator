const DIRECT_STEP_PATTERN = /\b(one step|single step|first step|one concrete step|one practical step)\b/i;

function normalizeText(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function computeTokenSimilarity(a = "", b = "") {
  const tokensA = new Set(normalizeText(a).split(" ").filter((token) => token.length > 2));
  const tokensB = new Set(normalizeText(b).split(" ").filter((token) => token.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) overlap += 1;
  });
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function detectConstraintShape({ activeDemandType = "", hcpPrompt = "", activeConcern = "workflow" } = {}) {
  const prompt = normalizeText(hcpPrompt);
  const demandType = String(activeDemandType || "").toLowerCase();

  if (demandType.includes("evidence") || /\b(evidence|data|study|trial|endpoint|published|proof point|metric)\b/.test(prompt)) {
    return "evidence";
  }
  if (demandType.includes("applicability") || /\b(apply|applicable|patient mix|your setting|your practice|for my patients)\b/.test(prompt)) {
    return "applicability";
  }
  if (demandType.includes("operational") || /\b(staff|capacity|time|handoff|process|operational|prior auth|paperwork)\b/.test(prompt)) {
    return "operational";
  }
  if (/\b(access|coverage|payer|insurance|authorization|reimbursement|cost|formular)\b/.test(prompt) || String(activeConcern || "").toLowerCase() === "access") {
    return "access";
  }
  return "workflow";
}

function isSpecificResponse(message = "") {
  const value = normalizeText(message);
  if (!value) return false;
  return /\b(first|next|assign|schedule|start|use|run|review|document|confirm|call|submit|track|within|today|this week|by friday|owner|checklist|handoff)\b/.test(value);
}

function hasSinglePrimaryAction(message = "") {
  const value = String(message || "");
  const lower = normalizeText(value);
  if (!lower) return false;
  if (/\n\s*[-*•]/.test(value) || /\b(1\.|2\.|first, second|option 1|option 2|either|or we can)\b/i.test(value)) return false;
  if (/\b(including|several|multiple|various options|a few ways)\b/.test(lower)) return false;
  const sentenceCount = value.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length;
  const hasActionLead = /\b(first step|start by|do this|assign|schedule|submit|run|review|confirm|document)\b/.test(lower);
  return sentenceCount <= 2 && hasActionLead;
}

function addressesDemandShape(message = "", shape = "workflow") {
  const lower = normalizeText(message);
  if (!lower) return false;
  const checks = {
    evidence: /\b(study|trial|data|published|endpoint|rate|percent|metric)\b/.test(lower),
    applicability: /\b(your clinic|your practice|your patients|this setting|for your team|for my patients)\b/.test(lower),
    operational: /\b(workflow|staff|handoff|owner|time block|prior auth|process|checklist)\b/.test(lower),
    access: /\b(coverage|payer|authorization|reimbursement|cost|formular|access)\b/.test(lower),
    workflow: /\b(step|workflow|team|owner|checklist|process|handoff|schedule)\b/.test(lower),
  };
  return checks[shape] || checks.workflow;
}

function buildConstrainedRepResponse({ shape = "workflow", hcpPrompt = "" } = {}) {
  const tieBack = {
    evidence: "to answer your evidence request",
    applicability: "for your patient setting",
    operational: "for your workflow constraint",
    access: "for your access constraint",
    workflow: "for your workflow",
  };

  const actionByShape = {
    evidence: "First step: pull one published outcome metric from our approved summary and review it with your team in tomorrow's huddle",
    applicability: "First step: pick one eligible patient profile from this week's schedule and apply the protocol in your setting",
    operational: "First step: assign one staff owner for a same-day checklist handoff in your current workflow",
    access: "First step: submit one benefits verification for the next eligible patient to confirm coverage requirements",
    workflow: "First step: assign one owner to run a same-day checklist in your current clinic flow",
  };

  const promptSignal = DIRECT_STEP_PATTERN.test(hcpPrompt) ? " as one concrete step" : "";
  return `${actionByShape[shape]} ${tieBack[shape]}${promptSignal}.`;
}

export function enforceRepDemandBinding({
  repMessage = "",
  previousRepMessage = "",
  unresolvedDemandActive = false,
  activeDemandType = "",
  hcpPrompt = "",
  activeConcern = "workflow",
} = {}) {
  const trimmed = String(repMessage || "").trim();
  if (!trimmed) return { repMessage: "", constrained: false, reason: null, shape: "workflow" };

  const oneStepDemand = DIRECT_STEP_PATTERN.test(hcpPrompt) || String(activeDemandType || "").toLowerCase().includes("direct_answer");
  const shape = detectConstraintShape({ activeDemandType, hcpPrompt, activeConcern });

  if (!unresolvedDemandActive && !oneStepDemand) {
    return { repMessage: trimmed, constrained: false, reason: null, shape };
  }

  const similarity = computeTokenSimilarity(previousRepMessage, trimmed);
  const directAnswer = addressesDemandShape(trimmed, shape);
  const materiallyDifferent = similarity < 0.82;
  const specific = isSpecificResponse(trimmed);
  const oneStepCompliant = !oneStepDemand || hasSinglePrimaryAction(trimmed);
  const valid = directAnswer && materiallyDifferent && specific && oneStepCompliant;

  if (valid) {
    return { repMessage: trimmed, constrained: false, reason: null, shape, similarity };
  }

  return {
    repMessage: buildConstrainedRepResponse({ shape, hcpPrompt }),
    constrained: true,
    reason: !materiallyDifferent ? "blocked_reuse" : !directAnswer ? "missed_demand" : !specific ? "not_specific" : "not_single_step",
    shape,
    similarity,
  };
}
