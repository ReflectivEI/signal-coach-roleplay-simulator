export function normalizeTone(text) {
  if (text == null) return text;

  let cleaned = String(text).trim();
  if (!cleaned) return cleaned;

  cleaned = cleaned.replace(
    /will give you confidence/gi,
    "can support prescribing confidence"
  );

  // Remove over-eager affirmation only when used as a leading filler.
  cleaned = cleaned.replace(
    /^\s*absolutely\b[,\s]*/i,
    ""
  );

  // Reframe "First," only when used as an opening transition.
  cleaned = cleaned.replace(
    /^\s*first\b[,\s]*/i,
    "Before we go further, "
  );

  cleaned = cleaned.replace(/\s+([,.;:!?])/g, "$1");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  cleaned = cleaned.replace(/^([a-z])/, (match, char) => char.toUpperCase());

  return cleaned;
}
