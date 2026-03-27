export function normalizeTone(text) {
  if (text == null) return text;

  let cleaned = String(text);

  cleaned = cleaned.replace(
    /will give you confidence/gi,
    "examines prescribing confidence"
  );

  cleaned = cleaned.replace(
    /\babsolutely\b[,\s]*/gi,
    ""
  );

  cleaned = cleaned.replace(
    /\bfirst\b[,\s]*/gi,
    "Before we go further, "
  );

  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return cleaned;
}
