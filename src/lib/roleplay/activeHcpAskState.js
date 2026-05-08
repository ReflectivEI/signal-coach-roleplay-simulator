function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasQuestionOrAskLanguage(value = "") {
  return /\?\s*$|\b(ask|asks|asked|asking|need|needs|want|wants|looking for|expects|signals for|give me|show me|tell me|help me|keep it to|start with|focus on)\b/i.test(String(value || ""));
}

export function extractActionableAskFromNarrative(narrativeText = "") {
  const text = normalizeText(narrativeText);
  if (!text || !hasQuestionOrAskLanguage(text)) return "";

  const askForMatch = text.match(/\b(?:asks?|signals|looking|expects|gestures|waits)\b[^.?!]*?\bfor\b\s+([^.?!]+)/i);
  if (askForMatch?.[1]) return normalizeText(askForMatch[1]);

  const askToMatch = text.match(/\b(?:asks?|signals|looking|expects|gestures|waits)\b[^.?!]*?\bto\b\s+([^.?!]+)/i);
  if (askToMatch?.[1]) return normalizeText(askToMatch[1]);

  const directAskMatch = text.match(/\b(give me|show me|tell me|help me|keep it to|start with|focus on)\b\s+([^.?!]+)/i);
  if (directAskMatch?.[0]) return normalizeText(directAskMatch[0]);

  return text.includes("?") ? text : "";
}

export function resolveActiveHcpAskState({
  explicitHcpDialogue = "",
  narrativeContext = "",
  openingContext = "",
  fallbackConcern = "general",
  terminal = false,
} = {}) {
  if (terminal) {
    return {
      source: "terminal",
      askText: "",
      concernFamily: "terminal",
      frozen: true,
    };
  }

  const explicit = normalizeText(explicitHcpDialogue);
  if (explicit && hasQuestionOrAskLanguage(explicit)) {
    return {
      source: "explicit_hcp_dialogue",
      askText: explicit,
      concernFamily: fallbackConcern || "general",
      frozen: false,
    };
  }

  const narrativeAsk = extractActionableAskFromNarrative(narrativeContext);
  if (narrativeAsk) {
    return {
      source: "narrative_context",
      askText: narrativeAsk,
      concernFamily: fallbackConcern || "general",
      frozen: false,
    };
  }

  const opening = normalizeText(openingContext);
  if (opening) {
    return {
      source: "opening_scene",
      askText: opening,
      concernFamily: fallbackConcern || "general",
      frozen: false,
    };
  }

  return {
    source: "fallback_concern",
    askText: normalizeText(fallbackConcern || "general"),
    concernFamily: fallbackConcern || "general",
    frozen: false,
  };
}
