const QUESTION_STARTER_RE = /^(who|what|when|where|why|how|do|does|did|can|could|would|will|are|is|am|should|may|might|have|has|had)\b/i;

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

  // Start sentence with capital letter for professional UI presentation.
  cleaned = capitalizeFirstLetter(cleaned);

  // If message reads like a question and lacks terminal punctuation, end with '?'.
  const hasTerminalPunctuation = /[.!?]$/.test(cleaned);
  if (QUESTION_STARTER_RE.test(cleaned) && !hasTerminalPunctuation) {
    cleaned = `${cleaned}?`;
  }

  return cleaned;
}
