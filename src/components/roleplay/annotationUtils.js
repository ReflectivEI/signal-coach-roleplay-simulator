export const FALLBACK_CAP_STYLE = Object.freeze({
  bg: "bg-slate-100",
  border: "border-slate-300",
  text: "text-slate-800",
  label: "Unmapped signal",
  dot: "bg-slate-400",
});

export function buildAnnotationMap(parsed, validCapabilityIds = []) {
  const validIds = new Set(validCapabilityIds);
  const map = {};

  (parsed || []).forEach((item) => {
    if (item?.index === undefined || item?.index === null) return;
    const safeIndex = Number(item.index);
    if (!Number.isInteger(safeIndex) || safeIndex < 0) return;

    const capability = validIds.has(item.capability) ? item.capability : "unknown";
    map[safeIndex] = {
      ...item,
      index: safeIndex,
      capability,
      type: item?.type === "strength" ? "strength" : "concern",
      note: typeof item?.note === "string" && item.note.trim() ? item.note.trim() : "Signal detected",
    };
  });

  const deduped = {};
  Object.values(map).forEach((ann) => {
    const key = `${ann.capability}-${ann.type}-${ann.note}`;
    if (!Object.values(deduped).some((d) => `${d.capability}-${d.type}-${d.note}` === key)) {
      deduped[ann.index] = ann;
    }
  });

  return deduped;
}

export function getCapabilityStyle(capability, capColors) {
  if (!capability) return FALLBACK_CAP_STYLE;
  return capColors?.[capability] || FALLBACK_CAP_STYLE;
}
