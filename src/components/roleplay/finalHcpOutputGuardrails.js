function normalize(value = "") {
  return String(value || "").trim();
}

const CONTROL_DIRECTIVE_PATTERNS = [
  /^\s*(?:re-?anchor\s+to|narrow\s+to|final\s+clarification\s*:|stay\s+on|operational\s+constraint\b)/i,
  /^\s*(?:you\s+are\s+generating|rules\s*:|rewrite\s+the|respond\s+directly\s+to)/i,
  /^\s*(?:last\s+pass\s*:|this\s+remains\s+unresolved|we\s+are\s+still\s+unresolved)/i,
];

function hasControlDirectiveLeak(dialogue = "") {
  const text = normalize(dialogue);
  if (!text) return false;
  return CONTROL_DIRECTIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function buildNaturalFallback(activeConcern = "workflow") {
  const concern = String(activeConcern || "workflow").toLowerCase();
  if (concern === "evidence") {
    return "I still need one concrete evidence point tied to this setting before we move forward.";
  }
  if (concern === "access") {
    return "I still need one practical access step we can apply in this clinic without adding burden.";
  }
  if (concern === "time") {
    return "I need one concise, high-yield next step I can apply right away.";
  }
  if (concern === "screening") {
    return "I still need one clear screening decision rule we can use immediately.";
  }
  return "I still need one concrete, workflow-fit next step before we move forward.";
}

export function sanitizeFinalHcpDialogueSurface({
  dialogue = "",
  activeConcern = "workflow",
  fallbackDialogue = "",
} = {}) {
  const raw = normalize(dialogue);
  if (!raw) {
    const fallback = normalize(fallbackDialogue) || buildNaturalFallback(activeConcern);
    return { dialogue: fallback, applied: true, reason: "empty" };
  }

  if (!hasControlDirectiveLeak(raw)) {
    return { dialogue: raw, applied: false, reason: "none" };
  }

  const fallback = normalize(fallbackDialogue) || buildNaturalFallback(activeConcern);
  return {
    dialogue: fallback,
    applied: true,
    reason: "control_directive_guard",
  };
}

export { hasControlDirectiveLeak };
