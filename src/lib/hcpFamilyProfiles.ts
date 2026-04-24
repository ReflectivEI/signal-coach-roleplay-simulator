export interface HcpFamilyTemperamentControls {
  familyKey: string;
  warmthBias: -1 | 0 | 1;
  directnessBias: -1 | 0 | 1;
  brevityBias: -1 | 0 | 1;
  patienceBias: -1 | 0 | 1;
  notes: string[];
}

const FAMILY_PRESETS: Record<string, HcpFamilyTemperamentControls> = {
  initial_access: {
    familyKey: "initial_access",
    warmthBias: -1,
    directnessBias: 1,
    brevityBias: 1,
    patienceBias: -1,
    notes: [
      "Initial-access HCPs should protect time and control the opening.",
      "Do not let early access scenarios sound too relaxed or generous too quickly.",
    ],
  },
  early_discovery: {
    familyKey: "early_discovery",
    warmthBias: 0,
    directnessBias: 0,
    brevityBias: 0,
    patienceBias: 0,
    notes: [
      "Discovery scenarios can allow more space if the HCP state earns it.",
    ],
  },
  clinical_value: {
    familyKey: "clinical_value",
    warmthBias: -1,
    directnessBias: 1,
    brevityBias: 0,
    patienceBias: -1,
    notes: [
      "Clinical-value HCPs should sound threshold-aware and unconvinced until the proof point is earned.",
    ],
  },
  objection_handling: {
    familyKey: "objection_handling",
    warmthBias: -1,
    directnessBias: 1,
    brevityBias: 1,
    patienceBias: -1,
    notes: [
      "Objection-stage HCPs should repeat or sharpen the blocker instead of opening new space casually.",
    ],
  },
  adoption_implementation: {
    familyKey: "adoption_implementation",
    warmthBias: 0,
    directnessBias: 1,
    brevityBias: 0,
    patienceBias: 0,
    notes: [
      "Adoption-stage HCPs should stay practical about workflow, ownership, and implementation burden.",
    ],
  },
  access_formulary: {
    familyKey: "access_formulary",
    warmthBias: -1,
    directnessBias: 1,
    brevityBias: 0,
    patienceBias: -1,
    notes: [
      "Access/formulary HCPs should stay process-bound and specific about the blocking step.",
    ],
  },
  commitment_close: {
    familyKey: "commitment_close",
    warmthBias: 0,
    directnessBias: 1,
    brevityBias: 1,
    patienceBias: -1,
    notes: [
      "Close-stage HCPs should be conditionally open at most, and should not reopen broad discovery late.",
    ],
  },
};

const PERSONA_OVERRIDES: Record<string, Partial<HcpFamilyTemperamentControls>> = {
  skeptical_specialist: {
    warmthBias: -1,
    directnessBias: 1,
    patienceBias: -1,
    notes: ["Skeptical specialists should stay exacting and guarded rather than casually collaborative."],
  },
  time_constrained_community_doctor: {
    warmthBias: -1,
    directnessBias: 1,
    brevityBias: 1,
    patienceBias: -1,
    notes: ["Time-constrained community doctors should sound professionally clipped, not rude."],
  },
  curious_uncertain_adopter: {
    warmthBias: 1,
    directnessBias: 0,
    brevityBias: 0,
    patienceBias: 1,
    notes: ["Curious/uncertain adopters can allow a little more openness once the rep earns it."],
  },
  cost_focused_decision_maker: {
    warmthBias: -1,
    directnessBias: 1,
    brevityBias: 0,
    patienceBias: -1,
    notes: ["Cost-focused decision makers should stay disciplined around value thresholds and practical impact."],
  },
};

function clampBias(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

export function deriveFamilyTemperamentControls(scenario: any = {}): HcpFamilyTemperamentControls {
  const family = String(scenario?.journeyStage || "early_discovery").toLowerCase();
  const persona = String(scenario?.persona || "").toLowerCase();
  const familyPreset = FAMILY_PRESETS[family] || FAMILY_PRESETS.early_discovery;
  const personaOverride = PERSONA_OVERRIDES[persona] || {};

  return {
    familyKey: familyPreset.familyKey,
    warmthBias: clampBias((familyPreset.warmthBias || 0) + (personaOverride.warmthBias || 0)),
    directnessBias: clampBias((familyPreset.directnessBias || 0) + (personaOverride.directnessBias || 0)),
    brevityBias: clampBias((familyPreset.brevityBias || 0) + (personaOverride.brevityBias || 0)),
    patienceBias: clampBias((familyPreset.patienceBias || 0) + (personaOverride.patienceBias || 0)),
    notes: [...(familyPreset.notes || []), ...((personaOverride.notes as string[]) || [])],
  };
}

export function buildFamilyTemperamentPrompt(controls: HcpFamilyTemperamentControls): string {
  return [
    "FAMILY TEMPERAMENT CONTROLS:",
    `- Scenario family: ${controls.familyKey}`,
    `- Warmth bias: ${controls.warmthBias}`,
    `- Directness bias: ${controls.directnessBias}`,
    `- Brevity bias: ${controls.brevityBias}`,
    `- Patience bias: ${controls.patienceBias}`,
    ...controls.notes.map((note) => `- ${note}`),
  ].join("\n");
}
