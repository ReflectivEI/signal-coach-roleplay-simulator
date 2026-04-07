function normalizeForSimilarity(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function computeSimilarity(a = "", b = "") {
  const tokensA = new Set(normalizeForSimilarity(a).split(" ").filter((token) => token.length > 2));
  const tokensB = new Set(normalizeForSimilarity(b).split(" ").filter((token) => token.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) overlap += 1;
  });
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function hasConcreteOperationalMove(repMessage = "") {
  return /\b(step|plan|process|workflow|handoff|assign|pilot|start with|first action|specific|implement|standardi[sz]e|train|training|education|monitoring|call-?tree|one-?pager|pathway|protocol|checklist|template|standing order|change for your team|for your staff)\b/i.test(String(repMessage || ""));
}

function hasImplementationMove(repMessage = "") {
  return /\b(standardi[sz]e|implement|roll out|rollout|pilot|start|add|use|train|training|education|monitoring|toxicity monitoring|call-?tree|one-?pager|pathway handout|pathway|protocol|checklist|template|handoff)\b/i.test(String(repMessage || ""));
}

function hasVagueOperationalOwner(repMessage = "") {
  const value = String(repMessage || "").toLowerCase();
  if (!value.trim()) return false;
  return /\b(someone|somebody)\s+(on|from)?\s*(your|the|my)?\s*(staff|team)\b/.test(value)
    || /\b(staff|team)\s+(would|can|could|should)?\s*(own|handle|run|manage|implement|do)\b/.test(value);
}

function hasExplicitOperationalOwner(repMessage = "") {
  const value = String(repMessage || "").toLowerCase();
  if (!value.trim()) return false;
  return /\b(np|nurse|nursing|ma|medical assistant|pharmacist|pharmacy tech|care coordinator|case manager|hub coordinator|front desk|scheduler|provider|physician|clinician|app|advanced practice provider)\b/.test(value)
    && /\b(own|lead|run|handle|manage|start|implement|standardi[sz]e|education|monitoring|call-?tree|checklist|protocol|handoff)\b/.test(value);
}

function latestHcpAskRequiresOwner(latestHcpAsk = "") {
  const value = String(latestHcpAsk || "").toLowerCase();
  if (!value.trim()) return false;
  const asksOwnership = /\b(who|which role|owner|own|owns|responsib|assigned|handoff)\b/.test(value);
  const operationalFrame = /\b(first|step|workflow|staff|team|task|implement|run|use|this week)\b/.test(value);
  return asksOwnership && operationalFrame;
}

function latestHcpAskRequiresWorkflowStep(latestHcpAsk = "") {
  const value = String(latestHcpAsk || "").toLowerCase();
  if (!value.trim()) return false;
  return /\b(first step|practical step|workflow step|process change|smallest workflow change|what would my team do|what is one change|what is one step|what should we do first|what changes in.*workflow)\b/.test(value);
}

function hasOwnershipDeflection(repMessage = "") {
  const value = String(repMessage || "").toLowerCase();
  if (!value.trim()) return false;
  const ownershipLanguage = /\b(who|owner|own|staff|team|role|responsib|decision)\b/.test(value);
  const deflectionLanguage = /\b(can't|cannot|can not|don't know|do not know|couldn't|wouldn't|your decision|you decide|up to you|not my decision)\b/.test(value);
  return ownershipLanguage && deflectionLanguage;
}

function hasRepConversationLoopChallenge(repMessage = "") {
  return /\b(you just asked|you already asked|i already said|i said|again|as i said|just told you)\b/i.test(String(repMessage || ""));
}

export function classifyLatestAskProgression({ latestHcpAsk = "", repMessage = "", previousRepMessages = [] } = {}) {
  const latestAsk = String(latestHcpAsk || "").trim();
  const rep = String(repMessage || "").trim();
  if (!latestAsk || !rep) return { status: "none", needsProgression: false };

  const requiresOwner = latestHcpAskRequiresOwner(latestAsk);
  const requiresWorkflowStep = latestHcpAskRequiresWorkflowStep(latestAsk);
  if (!requiresOwner && !requiresWorkflowStep) return { status: "none", needsProgression: false };

  const implementationMove = hasImplementationMove(rep) || hasConcreteOperationalMove(rep);
  const vagueOwner = hasVagueOperationalOwner(rep);
  const explicitOwner = hasExplicitOperationalOwner(rep);
  const ownershipDeflection = hasOwnershipDeflection(rep);
  const loopChallenge = hasRepConversationLoopChallenge(rep);
  const repeatedRep = previousRepMessages
    .filter(Boolean)
    .slice(-3)
    .some((previous) => computeSimilarity(previous, rep) >= 0.84);

  if (requiresOwner) {
    if (ownershipDeflection) {
      return { status: "ownership_deflected", needsProgression: true, loopChallenge };
    }
    if (implementationMove && explicitOwner) {
      return { status: loopChallenge || repeatedRep ? "repeated_owner_progress" : "owner_progress", needsProgression: true, loopChallenge: loopChallenge || repeatedRep };
    }
    if (implementationMove && vagueOwner) {
      return { status: "vague_owner_progress", needsProgression: true, loopChallenge: loopChallenge || repeatedRep };
    }
    if (implementationMove) {
      return { status: loopChallenge || repeatedRep ? "repeated_missing_owner" : "missing_owner", needsProgression: true, loopChallenge: loopChallenge || repeatedRep };
    }
    return { status: "missed", needsProgression: false, loopChallenge };
  }

  if (requiresWorkflowStep && implementationMove) {
    return { status: loopChallenge || repeatedRep ? "repeated_workflow_progress" : "workflow_progress", needsProgression: true, loopChallenge: loopChallenge || repeatedRep };
  }

  return { status: "missed", needsProgression: false, loopChallenge };
}

export function buildLatestAskProgressionDialogue(latestAskProgression = {}) {
  switch (latestAskProgression.status) {
    case "ownership_deflected":
      return "Fair, you may not know my staffing model. Give me the role you usually see owning the first step, and I can decide if that fits here.";
    case "repeated_owner_progress":
      return "I heard the owner and the action. What is the first handoff they would run this week?";
    case "owner_progress":
      return "That is more useful. What is the first handoff they would run this week?";
    case "vague_owner_progress":
      return "That gives me a direction, but the owner is still too vague. Which role owns the first step?";
    case "repeated_missing_owner":
      return "I heard the process change. The missing piece is ownership: which role starts it first?";
    case "missing_owner":
      return "That is closer. Who owns the first step, and what changes in the workflow this week?";
    case "repeated_workflow_progress":
      return "I heard that workflow step. Now make it usable for me: who starts it, and when?";
    case "workflow_progress":
      return "That is a workable starting point. Who owns it first, and when would they do it?";
    default:
      return "";
  }
}

