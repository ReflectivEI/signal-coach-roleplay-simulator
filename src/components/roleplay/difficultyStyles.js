export const difficultyVisualSystem = {
  beginner: {
    className: "bg-green-50 text-green-700 border-green-200",
    style: { background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" },
  },
  intermediate: {
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
    style: { background: "#fefce8", color: "#854d0e", borderColor: "#fde68a" },
  },
  advanced: {
    className: "bg-blue-50 text-blue-700 border-blue-200",
    style: { background: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" },
  },
  fallback: {
    className: "bg-slate-100 text-slate-600 border-slate-200",
    style: { background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" },
  },
};

export function getDifficultyVisuals(difficulty) {
  const key = String(difficulty || "").toLowerCase();
  return difficultyVisualSystem[key] || difficultyVisualSystem.fallback;
}
