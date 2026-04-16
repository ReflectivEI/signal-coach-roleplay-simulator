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
          borderColor: isActive ? "rgba(146, 236, 217, 0.68)" : "rgba(182, 230, 220, 0.28)",
          background: isActive ? "rgba(59, 140, 154, 0.34)" : "rgba(34, 68, 108, 0.42)",
          color: "hsl(190 40% 96%)",
          fontSize: "0.875rem"
        }}
      >
        <span className="truncate font-medium">{selected.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "hsl(174 62% 78%)" }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border shadow-lg overflow-hidden"
          style={{
            borderColor: "rgba(86, 195, 176, 0.25)",
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
                color: opt.value === value ? "hsl(174 75% 78%)" : "hsl(195 28% 86%)",
                fontWeight: opt.value === value ? 600 : 400,
                background: opt.value === value ? "rgba(52, 136, 146, 0.28)" : "transparent",
              }}
              onMouseEnter={e => {
                if (opt.value !== value) e.currentTarget.style.background = "rgba(48, 79, 121, 0.34)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = opt.value === value ? "rgba(52, 136, 146, 0.28)" : "transparent";
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
          className="mt-3 text-xs transition-colors"
          style={{ color: "rgba(233, 247, 245, 0.78)" }}
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
