import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  DISEASE_STATES,
  SPECIALTIES,
  CHALLENGE_CONTEXT_OPTIONS,
  CONVERSATION_STAGE_OPTIONS,
  HCP_ROLE_OPTIONS,
  INTERACTION_PRESSURES,
  JOURNEY_STAGES,
} from "@/lib/rpsUserInputOptions";
import { deriveUISelectionFromBrain } from "@/lib/scenarioInputResolver";

// Re-export from shared module so downstream consumers don't break
export { DISEASE_STATES, SPECIALTIES, INTERACTION_PRESSURES, JOURNEY_STAGES };
export { HCP_ROLE_OPTIONS as HCP_TYPES };
export { CHALLENGE_CONTEXT_OPTIONS as INFLUENCE_DRIVERS };

function FilterDropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value) || options[0];
  const isActive = value !== "all";

  return (
    <div className="relative">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(236, 245, 245, 0.78)" }}>
        {label}
      </p>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg border transition-colors"
        style={{
          borderColor: isActive ? "rgba(145, 232, 213, 0.78)" : "rgba(176, 212, 230, 0.52)",
          background: isActive ? "rgba(43, 122, 138, 0.48)" : "rgba(18, 53, 94, 0.58)",
          color: "hsl(193 78% 97%)",
          fontSize: "0.875rem"
        }}
      >
        <span className="truncate font-medium">{selected.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "hsl(174 80% 85%)" }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border shadow-lg overflow-hidden"
          style={{
            borderColor: "rgba(86, 195, 176, 0.34)",
            background: "linear-gradient(180deg, hsl(222 44% 15%) 0%, hsl(221 41% 13%) 100%)",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.28)",
          }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3.5 py-2 transition-colors"
              style={{
                fontSize: "0.875rem",
                color: opt.value === value ? "hsl(174 84% 84%)" : "hsl(197 40% 92%)",
                fontWeight: opt.value === value ? 600 : 400,
                background: opt.value === value ? "rgba(52, 136, 146, 0.38)" : "transparent",
              }}
              onMouseEnter={e => {
                if (opt.value !== value) e.currentTarget.style.background = "rgba(48, 79, 121, 0.44)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = opt.value === value ? "rgba(52, 136, 146, 0.38)" : "transparent";
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScenarioFilters({ filters, onChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const set = (key) => (val) => onChange({ ...filters, [key]: val });
  const activeCount = Object.entries(filters)
    .filter(([key, value]) => key !== "realism" && value !== "all")
    .length;
  const realism = Math.max(1, Math.min(10, Number(filters.realism) || 5));

  return (
    <div className="mb-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <FilterDropdown label="HCP Role" options={HCP_ROLE_OPTIONS} value={filters.hcpType} onChange={set("hcpType")} />
        <FilterDropdown label="Conversation Moment" options={CONVERSATION_STAGE_OPTIONS} value={filters.stage} onChange={set("stage")} />
        <FilterDropdown label="Challenge Focus" options={CHALLENGE_CONTEXT_OPTIONS} value={filters.challenge} onChange={set("challenge")} />
      </div>

      <div className="mt-2 rounded-lg border px-3.5 py-2"
        style={{ borderColor: "rgba(176, 212, 230, 0.32)", background: "rgba(18, 53, 94, 0.46)" }}>
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(236, 245, 245, 0.82)" }}>
            Realism Lever
          </p>
          <span className="text-xs font-semibold" style={{ color: "hsl(174 84% 84%)" }}>{realism}/10</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={realism}
          onChange={(event) => onChange({ ...filters, realism: Number(event.target.value) })}
          className="w-full accent-teal-400"
          aria-label="Realism Lever"
        />
        <div className="flex items-center justify-between text-[11px]" style={{ color: "rgba(220,236,236,0.72)" }}>
          <span>1 (Cooperative)</span>
          <span>5 (Neutral)</span>
          <span>10 (Sharp)</span>
        </div>
      </div>

      <div className="mt-2">
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: showAdvanced ? "hsl(174 80% 72%)" : "rgba(241, 250, 250, 0.62)" }}
        >
          <SlidersHorizontal className="w-3 h-3" />
          {showAdvanced ? "Hide" : "Advanced"}
          <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>
        {showAdvanced && (
          <div className="mt-2 pt-2 border-t" style={{ borderColor: "rgba(97, 182, 181, 0.22)" }}>
            <p className="text-xs mb-2" style={{ color: "rgba(241, 250, 250, 0.52)" }}>
              Advanced filters are optional and intended for internal/debug narrowing only.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
              <FilterDropdown label="Specialty" options={SPECIALTIES} value={filters.specialty} onChange={set("specialty")} />
              <FilterDropdown label="Disease State" options={DISEASE_STATES} value={filters.diseaseState} onChange={set("diseaseState")} />
            </div>
          </div>
        )}
      </div>

      {activeCount > 0 && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="mt-3 text-xs transition-colors"
          style={{ color: "rgba(241, 250, 250, 0.96)" }}
        >
          Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}

export function applyScenarioFilters(scenarios, filters) {
  return scenarios.filter(s => {
    const uiSelection = deriveUISelectionFromBrain(s);
    const mappedHcpType = uiSelection.hcpType || s.gridMapping?.hcpType || s.hcpRoleType;
    const mappedStage = uiSelection.stage || s.gridMapping?.journeyStage || s.journeyStage;
    const mappedChallenge = uiSelection.challenge;

    if (filters.hcpType !== "all" && mappedHcpType !== filters.hcpType) return false;
    if (filters.stage !== "all" && mappedStage !== filters.stage) return false;
    if (filters.challenge !== "all" && mappedChallenge !== filters.challenge) return false;
    if (filters.diseaseState !== "all") {
      const mappedDiseaseState = s.gridMapping?.diseaseState || s.predictiveSeed?.diseaseState;
      if (mappedDiseaseState) {
        if (mappedDiseaseState !== filters.diseaseState) return false;
      } else {
        const haystack = `${s.stakeholder} ${s.context} ${s.title}`.toLowerCase();
        const termMap = {
          pulmonology: ["pulmonol", "pulmonary", "lung", "respiratory"],
          cardiology: ["cardiol", "cardiac", "heart", "cardiovascular"],
          rheumatology: ["rheumatol", "arthritis"],
          neurology: ["neurolog", "brain"],
          oncology: ["oncolog", "cancer", "tumor"],
          nephrology: ["nephrolog", "kidney", "renal"],
          dermatology: ["dermatol", "skin"],
          hematology: ["hematolog", "blood"],
          gastroenterology: ["gastro", "gi ", "gastroenterol"],
          endocrinology: ["endocrin", "diabetes", "thyroid"],
          primary_care: ["primary care", "internal medicine", "hospitalist", "community"],
        };
        const terms = termMap[filters.diseaseState] || [];
        if (!terms.some(t => haystack.includes(t))) return false;
      }
    }
    if (filters.specialty !== "all") {
      const mappedSpecialty = s.gridMapping?.specialty;
      if (mappedSpecialty) {
        if (mappedSpecialty !== filters.specialty) return false;
      } else {
        const haystack = `${s.stakeholder} ${s.context}`.toLowerCase();
        if (filters.specialty === "academic" && !haystack.includes("academic") && !haystack.includes("kol") && !haystack.includes("committee")) return false;
        if (filters.specialty === "hospital_medicine" && !haystack.includes("hospital")) return false;
        if (filters.specialty === "primary_care" && !haystack.includes("primary care") && !haystack.includes("internal medicine") && !haystack.includes("hospitalist")) return false;
        if (filters.specialty === "specialist") {
          const nonSpec = ["primary care", "hospitalist", "internal medicine"];
          if (nonSpec.some(t => haystack.includes(t))) return false;
        }
      }
    }
    return true;
  });
}

export const DEFAULT_FILTERS = {
  diseaseState: "all",
  specialty: "all",
  hcpType: "all",
  stage: "all",
  challenge: "all",
  realism: 5,
};
