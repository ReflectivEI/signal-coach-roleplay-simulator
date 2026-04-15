import { useState } from "react";
import { ChevronDown } from "lucide-react";

const DISEASE_STATES = [
  { value: "all", label: "All Disease States" },
  { value: "pulmonology", label: "Pulmonology" },
  { value: "cardiology", label: "Cardiology" },
  { value: "rheumatology", label: "Rheumatology" },
  { value: "neurology", label: "Neurology" },
  { value: "oncology", label: "Oncology" },
  { value: "nephrology", label: "Nephrology" },
  { value: "dermatology", label: "Dermatology" },
  { value: "hematology", label: "Hematology" },
  { value: "gastroenterology", label: "Gastroenterology" },
  { value: "endocrinology", label: "Endocrinology" },
  { value: "primary_care", label: "Primary Care" },
];

const SPECIALTIES = [
  { value: "all", label: "All Specialties" },
  { value: "specialist", label: "Specialist" },
  { value: "primary_care", label: "Primary Care" },
  { value: "hospital_medicine", label: "Hospital Medicine" },
  { value: "academic", label: "Academic / KOL" },
];

const HCP_TYPES = [
  { value: "all", label: "All HCP Types" },
  { value: "treating_clinician", label: "Treating Clinician" },
  { value: "influencer", label: "Influencer" },
  { value: "thought_leader", label: "Thought Leader" },
];

const INFLUENCE_DRIVERS = [
  { value: "all", label: "All Influence Drivers" },
  { value: "patient_centric", label: "Patient-Centric" },
  { value: "evidence_driven", label: "Evidence-Driven" },
  { value: "risk_averse", label: "Risk-Averse" },
  { value: "guideline_anchored", label: "Guideline-Anchored" },
];

const JOURNEY_STAGES = [
  { value: "all", label: "All Journey Stages" },
  { value: "initial_access", label: "Initial Access" },
  { value: "discovery", label: "Discovery" },
  { value: "clinical_value", label: "Clinical Value" },
  { value: "objection_handling", label: "Objection Handling" },
  { value: "adoption_implementation", label: "Adoption & Implementation" },
  { value: "access_formulary", label: "Access & Formulary" },
  { value: "commitment_close", label: "Commitment & Close" },
];

const INTERACTION_PRESSURES = [
  { value: "all", label: "All Interaction Pressures" },
  { value: "time_constrained", label: "Time Constrained" },
  { value: "operationally_constrained", label: "Operationally Constrained" },
  { value: "skeptical_resistant", label: "Skeptical / Resistant" },
  { value: "competitive_bias", label: "Competitive Bias" },
  { value: "safety_concern", label: "Safety Concern" },
  { value: "access_barrier", label: "Access Barrier" },
  { value: "curious_uncertain", label: "Curious / Uncertain" },
];

function FilterDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value) || options[0];
  const isActive = value !== "all";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-lg border transition-colors"
        style={{
          borderColor: isActive ? "hsl(174 45% 58%)" : "hsl(174 40% 75%)",
          background: isActive ? "hsl(174 40% 93%)" : "#fff",
          color: "hsl(222 52% 22%)",
          fontSize: "0.875rem"
        }}
      >
        <span className="truncate font-medium">{selected.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "hsl(174 45% 42%)" }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3.5 py-2 transition-colors hover:bg-slate-50"
              style={{
                fontSize: "0.875rem",
                color: opt.value === value ? "hsl(174 55% 32%)" : "hsl(222 52% 22%)",
                fontWeight: opt.value === value ? 600 : 400,
                background: opt.value === value ? "hsl(174 40% 93%)" : undefined,
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
  const set = (key) => (val) => onChange({ ...filters, [key]: val });
  const activeCount = Object.values(filters).filter(v => v !== "all").length;

  return (
    <div className="mb-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <FilterDropdown options={DISEASE_STATES}        value={filters.diseaseState}        onChange={set("diseaseState")} />
        <FilterDropdown options={SPECIALTIES}           value={filters.specialty}           onChange={set("specialty")} />
        <FilterDropdown options={HCP_TYPES}             value={filters.hcpType}             onChange={set("hcpType")} />
        <FilterDropdown options={INFLUENCE_DRIVERS}     value={filters.influenceDriver}     onChange={set("influenceDriver")} />
        <FilterDropdown options={JOURNEY_STAGES}        value={filters.journeyStage}        onChange={set("journeyStage")} />
        <FilterDropdown options={INTERACTION_PRESSURES} value={filters.interactionPressure} onChange={set("interactionPressure")} />
      </div>
      {activeCount > 0 && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}

export function applyScenarioFilters(scenarios, filters) {
  return scenarios.filter(s => {
    if (filters.hcpType !== "all" && s.hcpRoleType !== filters.hcpType) return false;
    if (filters.influenceDriver !== "all" && s.decisionOrientation !== filters.influenceDriver) return false;
    if (filters.journeyStage !== "all" && s.journeyStage !== filters.journeyStage) return false;
    if (filters.interactionPressure !== "all") {
      if (!s.interactionPressure?.includes(filters.interactionPressure)) return false;
    }
    if (filters.diseaseState !== "all") {
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
    if (filters.specialty !== "all") {
      const haystack = `${s.stakeholder} ${s.context}`.toLowerCase();
      if (filters.specialty === "academic" && !haystack.includes("academic") && !haystack.includes("kol") && !haystack.includes("committee")) return false;
      if (filters.specialty === "hospital_medicine" && !haystack.includes("hospital")) return false;
      if (filters.specialty === "primary_care" && !haystack.includes("primary care") && !haystack.includes("internal medicine") && !haystack.includes("hospitalist")) return false;
      if (filters.specialty === "specialist") {
        const nonSpec = ["primary care", "hospitalist", "internal medicine"];
        if (nonSpec.some(t => haystack.includes(t))) return false;
      }
    }
    return true;
  });
}

export const DEFAULT_FILTERS = {
  diseaseState: "all",
  specialty: "all",
  hcpType: "all",
  influenceDriver: "all",
  journeyStage: "all",
  interactionPressure: "all",
};