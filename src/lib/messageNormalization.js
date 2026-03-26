const QUESTION_STARTER_RE = /^(who|what|when|where|why|how|do|does|did|can|could|would|will|are|is|am|should|may|might|have|has|had)\b/i;
const AUX_SUBJECT_CAP_FIX_RE = /\b(can|could|would|will|should|do|does|did|is|are|was|were|have|has|had)\s+you\s+([A-Z][a-z]+)\b/g;
const CONNECTOR_MID_SENTENCE_RE = /\b(?:Before|After|And|But|Or|So|Then|Because|While|When|If)\b/g;

function capitalizeFirstLetter(text) {
  const index = text.search(/[A-Za-z]/);
  if (index === -1) return text;
  return text.slice(0, index) + text.charAt(index).toUpperCase() + text.slice(index + 1);
}

export function normalizeMessage(text) {
  if (text == null) return text;

  let cleaned = String(text).trim();
  if (!cleaned) return cleaned;

  // Remove awkward question-to-dash artifacts while preserving punctuation.
  cleaned = cleaned.replace(/\?\s*-\s*/g, "? ");

  // Normalize spacing artifacts from model output.
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  cleaned = cleaned.replace(/\s+([,.;:!?])/g, "$1");
  cleaned = cleaned.replace(/([,.;:!?])(?=\S)/g, "$1 ");
  cleaned = cleaned.replace(/\s{2,}/g, " ");

  // Smooth common grammar artifacts from model generation.
  cleaned = cleaned.replace(AUX_SUBJECT_CAP_FIX_RE, (_, aux, token) => `${aux} you ${token.toLowerCase()}`);
  cleaned = cleaned.replace(CONNECTOR_MID_SENTENCE_RE, (token, offset, fullText) => {
    if (typeof offset !== "number" || typeof fullText !== "string") return token;
    if (offset === 0) return token;
    const prior = fullText.slice(0, offset);
    if (/[.!?]\s*$/.test(prior)) return token;
    return token.toLowerCase();
  });

  // Capitalize sentence starts for a polished, readable surface.
  cleaned = cleaned.replace(/(^|[.!?]\s+)([a-z])/g, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);

  // Start sentence with capital letter for professional UI presentation.
  cleaned = capitalizeFirstLetter(cleaned);

  // If message reads like a question and lacks terminal punctuation, end with '?'.
  const hasTerminalPunctuation = /[.!?]$/.test(cleaned);
  if (QUESTION_STARTER_RE.test(cleaned) && !hasTerminalPunctuation) {
    cleaned = `${cleaned}?`;
  }

  return cleaned;
}
