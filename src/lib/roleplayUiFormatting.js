export function formatTaxonomyFilterLabel(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.toLowerCase().startsWith("all ")) return normalized;

  return normalized
    .replace(/_/g, " ")
    .replace(/\bddi\b/gi, "DDI")
    .replace(/\bauth\b/gi, "Auth")
    .replace(/\bhcp\b/gi, "HCP")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function normalizeInvokeResponseText(payload) {
  const source = payload && typeof payload === "object"
    ? (payload.response ?? payload.text ?? payload.content ?? "")
    : "";

  if (typeof source === "string") return source.trim();
  if (Array.isArray(source)) return source.map((item) => String(item || "")).join(" ").trim();
  if (source && typeof source === "object") {
    if (typeof source.text === "string") return source.text.trim();
    try {
      return JSON.stringify(source).trim();
    } catch {
      return String(source).trim();
    }
  }
  return String(source || "").trim();
}
