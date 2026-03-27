export function normalizeTone(text) {
  if (text == null) return text;

  let cleaned = String(text).trim();
  if (!cleaned) return cleaned;

  // High-fidelity mode: no lexical rewrites; punctuation/casing only.
  cleaned = cleaned.replace(/\s+([,.;:!?])/g, "$1");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  cleaned = cleaned.replace(/^([a-z])/, (match, char) => char.toUpperCase());

  return cleaned;
}
