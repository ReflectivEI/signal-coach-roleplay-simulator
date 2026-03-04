import React from "react";
import { SIGNAL_CAPABILITIES } from "./signalIntelligenceSOT";

export const CAPABILITIES = SIGNAL_CAPABILITIES.map(c => ({
  id: c.id,
  label: c.label,
  color: c.color,
  desc: c.measurement,
}));

const colorMap = {
  teal:   { active: "bg-teal-500 text-white border-teal-500",   idle: "bg-white text-teal-700 border-teal-300 hover:bg-teal-50" },
  blue:   { active: "bg-blue-500 text-white border-blue-500",   idle: "bg-white text-blue-700 border-blue-300 hover:bg-blue-50" },
  purple: { active: "bg-purple-500 text-white border-purple-500", idle: "bg-white text-purple-700 border-purple-300 hover:bg-purple-50" },
  cyan:   { active: "bg-cyan-500 text-white border-cyan-500",   idle: "bg-white text-cyan-700 border-cyan-300 hover:bg-cyan-50" },
  orange: { active: "bg-orange-500 text-white border-orange-500", idle: "bg-white text-orange-700 border-orange-300 hover:bg-orange-50" },
  slate:  { active: "bg-slate-500 text-white border-slate-500", idle: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50" },
  indigo: { active: "bg-indigo-500 text-white border-indigo-500", idle: "bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50" },
  green:  { active: "bg-green-500 text-white border-green-500", idle: "bg-white text-green-700 border-green-300 hover:bg-green-50" },
};

export function CapabilityBadge({ capId, size = "sm" }) {
  const cap = CAPABILITIES.find((c) => c.id === capId);
  if (!cap) return null;
  const c = colorMap[cap.color] || colorMap.teal;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${c.active} ${size === "xs" ? "text-xs" : "text-xs"}`}>
      {cap.label}
    </span>
  );
}

export default function CapabilityTagger({ selected = [], onChange }) {
  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {CAPABILITIES.map((cap) => {
        const isActive = selected.includes(cap.id);
        const c = colorMap[cap.color] || colorMap.teal;
        return (
          <button
            key={cap.id}
            type="button"
            onClick={() => toggle(cap.id)}
            className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-all ${isActive ? c.active : c.idle}`}
          >
            <span className="text-xs font-semibold leading-tight">{cap.label}</span>
            <span className={`text-xs leading-tight ${isActive ? "opacity-80" : "opacity-60"}`}>{cap.desc}</span>
          </button>
        );
      })}
    </div>
  );
}