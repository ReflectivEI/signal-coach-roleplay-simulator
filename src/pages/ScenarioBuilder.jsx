import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Sparkles, Loader2, Check, Wand2, SlidersHorizontal, ChevronDown } from "lucide-react";
import EnterpriseBanner from "@/components/layout/EnterpriseBanner";
import { createCustomScenario } from "@/lib/scenarioStorage";
import { invokeWorkerJson } from "@/services/workerClient";
import { PREDICTIVE_SELECTOR_OPTIONS } from "@/lib/predictiveBuilderModel";
import {
  CHALLENGE_CONTEXT_OPTIONS,
  CONVERSATION_STAGE_OPTIONS,
  HCP_ROLE_OPTIONS,
  INTERACTION_PRESSURES,
  ADVANCED_CONTROLS_WARNING,
} from "@/lib/rpsUserInputOptions";
import { deriveUISelectionFromBrain, mapUIToBrain } from "@/lib/scenarioInputResolver";

// Scenario Context options without the "all" sentinel (for required field)
const journeyStages = CONVERSATION_STAGE_OPTIONS.filter(o => o.value !== "all");

const journeyStateForStage = {
  first_exposure: "early_discovery",
  early_exploration: "early_discovery",
  access_logistics: "access_formulary",
  objection_resistance: "objection_phase",
  followup_commitment: "adoption_commitment",
  initial_access: "early_discovery",
  discovery: "early_discovery",
  clinical_value: "clinical_evaluation",
  objection_handling: "objection_phase",
  access_formulary: "access_formulary",
  adoption_implementation: "adoption_commitment",
  commitment_close: "adoption_commitment",
};

const challengeDefaultBehaviorState = {
  access_barrier: "resistance",
  time_constraint: "time_pressure",
  skepticism: "neutral",
  prior_experience: "neutral",
  competing_priorities: "curiosity",
};

// HCP Role + Mindset: import from shared module (no "all" sentinel for form selects)
const hcpRoleTypes = HCP_ROLE_OPTIONS.filter(o => o.value !== "all");
const challengeContexts = CHALLENGE_CONTEXT_OPTIONS.filter(o => o.value !== "all");

const behaviorStates = [
  { value: "closed", label: "Closed" },
  { value: "neutral", label: "Neutral" },
  { value: "open", label: "Open" },
  { value: "curiosity", label: "Curiosity" },
  { value: "resistance", label: "Resistance" },
  { value: "frustration", label: "Frustration" },
  { value: "time_pressure", label: "Time Pressure" },
];

const pressures = INTERACTION_PRESSURES.filter(o => o.value !== "all");

const predictiveSeedFields = [
  "diseaseState",
  "hcpType",
  "journeyStage",
  "interactionPressure",
  "influenceDriver",
  "behaviorArchetype",
];

function validatePredictiveSeed(seed = {}) {
  const normalized = Object.fromEntries(
    predictiveSeedFields.map((field) => [field, String(seed?.[field] || "").trim()]),
  );

  const filledCount = Object.values(normalized).filter(Boolean).length;
  if (filledCount === 0) {
    return { ok: true, normalized: null, message: "" };
  }

  if (filledCount !== predictiveSeedFields.length) {
    return {
      ok: false,
      normalized: null,
      message: "If using Predictive HCP Seed, all 6 fields are required.",
    };
  }

  for (const field of predictiveSeedFields) {
    const options = PREDICTIVE_SELECTOR_OPTIONS[field] || [];
    const allowed = new Set(options.map((item) => item.value));
    if (!allowed.has(normalized[field])) {
      return {
        ok: false,
        normalized: null,
        message: `Predictive seed field \"${field}\" has an invalid value.`,
      };
    }
  }

  return { ok: true, normalized, message: "" };
}

function AdvancedControlsSection({ label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-medium transition-colors"
        style={{ color: open ? "hsl(174 80% 40%)" : "hsl(215 18% 46%)" }}
      >
        <SlidersHorizontal className="w-3 h-3" />
        Advanced: {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 pt-2 border-t" style={{ borderColor: "rgba(92, 135, 165, 0.22)" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ label: string; hint?: string; children: any }} props
 */
function Field({ label, hint = "", children }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "hsl(222 46% 25%)" }}>{label}</label>
      {hint && <p className="text-xs mb-2 leading-relaxed" style={{ color: "hsl(215 18% 46%)" }}>{hint}</p>}
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, multiline = false }) {
  const cls = "w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-colors";
  const style = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,249,0.98) 100%)",
    border: "1.5px solid rgba(92, 135, 165, 0.42)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78), 0 1px 3px rgba(14, 24, 43, 0.03)",
  };
  if (multiline) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${cls} resize-none`} style={style} />;
  }
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} style={style} />;
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,249,0.98) 100%)",
        border: "1.5px solid rgba(92, 135, 165, 0.42)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78), 0 1px 3px rgba(14, 24, 43, 0.03)",
      }}
    >
      <option value="">Select...</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function MultiToggle({ options, selected, onChange }) {
  const toggle = (v) => {
    if (selected.includes(v)) onChange(selected.filter((s) => s !== v));
    else onChange([...selected, v]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
          style={selected.includes(o.value)
            ? {
              background: "linear-gradient(135deg, rgba(26, 67, 114, 0.12), rgba(28, 128, 118, 0.14))",
              borderColor: "rgba(37, 124, 123, 0.44)",
              color: "hsl(176 54% 31%)",
              boxShadow: "0 6px 16px rgba(20, 72, 89, 0.08)",
            }
            : {
              background: "rgba(255,255,255,0.88)",
              borderColor: "rgba(92, 135, 165, 0.34)",
              color: "hsl(215 16% 44%)",
            }}
        >
          {selected.includes(o.value) && <Check className="w-3 h-3" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ScenarioBuilder() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    coreTension: "",
    description: "",
    stakeholder: "",
    objective: "",
    context: "",
    openingScene: "",
    visualScene: "",
    journeyStage: "",
    journeyState: "",
    hcpRoleType: "",
    decisionOrientation: "",
    challengeContext: "",
    runtimeTemperature: 5,
    persona: "curious_uncertain_adopter",
    startingBehaviorState: "",
    interactionPressure: [],
    keyChallenges: "",
    suggestedFocusCapabilities: [],
    predictiveSeed: {
      diseaseState: "primary_care",
      hcpType: "",
      journeyStage: "",
      interactionPressure: "",
      influenceDriver: "",
      behaviorArchetype: "",
    },
    predictiveSeedUI: {
      hcpType: "",
      stage: "",
      challenge: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const applyTopLevelMapping = (current, partial) => {
    const next = { ...current, ...partial };
    if (!next.hcpRoleType || !next.journeyStage || !next.challengeContext) {
      return next;
    }

    const mapped = mapUIToBrain({
      hcpType: next.hcpRoleType,
      stage: next.journeyStage,
      challenge: next.challengeContext,
      realism: next.runtimeTemperature,
      diseaseState: next.predictiveSeed?.diseaseState || "primary_care",
    });

    return {
      ...next,
      journeyStage: next.journeyStage,
      journeyState: journeyStateForStage[mapped.resolvedFields.journey_stage] || next.journeyState,
      hcpRoleType: mapped.resolvedFields.hcp_type,
      decisionOrientation: mapped.resolvedFields.influence_driver,
      persona: mapped.resolvedFields.behavior_archetype,
      startingBehaviorState: next.startingBehaviorState || challengeDefaultBehaviorState[next.challengeContext] || "neutral",
      interactionPressure: mapped.resolvedFields.interaction_pressure,
    };
  };

  const applyPredictiveSeedMapping = (current, partialUi) => {
    const predictiveSeedUI = { ...current.predictiveSeedUI, ...partialUi };
    if (!predictiveSeedUI.hcpType || !predictiveSeedUI.stage || !predictiveSeedUI.challenge) {
      return { ...current, predictiveSeedUI };
    }

    const mapped = mapUIToBrain({
      hcpType: predictiveSeedUI.hcpType,
      stage: predictiveSeedUI.stage,
      challenge: predictiveSeedUI.challenge,
      realism: current.runtimeTemperature,
      diseaseState: current.predictiveSeed?.diseaseState || "primary_care",
    });

    return {
      ...current,
      predictiveSeedUI,
      predictiveSeed: {
        ...mapped.predictiveSelection,
        diseaseState: current.predictiveSeed?.diseaseState || mapped.predictiveSelection.diseaseState,
      },
    };
  };

  const generateWithAI = async () => {
    if (!form.title && !form.coreTension && !form.stakeholder) return;
    setAiGenerating(true);

    try {
      const capabilityIds = SIGNAL_INTELLIGENCE_CAPABILITIES.map((c) => c.id).join(", ");
      const predictiveOptions = Object.fromEntries(
        predictiveSeedFields.map((field) => [
          field,
          (PREDICTIVE_SELECTOR_OPTIONS[field] || []).map((item) => item.value).join(", "),
        ]),
      );

      const prompt = `You are building a canonical Signal Intelligence Coaching Simulator scenario for pharma rep training.

Format the scenario using the exact schema below. Every field must be populated. The result must feel like a real conversation, not a training module.

Input provided:
Title: ${form.title || "not specified"}
Core Tension: ${form.coreTension || "not specified"}
Stakeholder: ${form.stakeholder || "not specified"}
Context: ${form.context || "not specified"}
Objective: ${form.objective || "not specified"}
Conversation Moment: ${form.journeyStage || "not specified"}
HCP Role: ${form.hcpRoleType || "not specified"}
Decision Orientation: ${form.decisionOrientation || "not specified"}
Starting Behavior: ${form.startingBehaviorState || "not specified"}
Interaction Pressures: ${form.interactionPressure?.join(", ") || "not specified"}

SCHEMA RULES:
- coreTension: The fundamental conversational challenge. One sentence. What makes this hard.
- description: 2 sentences max. What the HCP is like and what the rep must navigate.
- objective: What specific behavior the rep should practice.
- context (HCP Profile): Format as "[Role Title] — [clinical background detail]".
- openingScene: The first 1-2 sentences the HCP actually SAYS. No pleasantries.
- visualScene: 2 sentences max. Observable rep-facing opening scene.
- keyChallenges: Exactly 3.
- suggestedFocusCapabilities: Pick 2-3 from this exact list: ${capabilityIds}
- journeyStage: one of: initial_access, discovery, clinical_value, objection_handling, access_formulary, adoption_implementation, commitment_close
- hcpRoleType: one of: treating_clinician, influencer, thought_leader
- decisionOrientation: one of: patient_centric, evidence_driven, risk_averse, guideline_anchored
- startingBehaviorState: one of: closed, neutral, open, curiosity, resistance, frustration, time_pressure
- interactionPressure: array, each value from: time_constrained, skeptical_resistant, curious_uncertain, operationally_constrained, competitive_bias, safety_concern, access_barrier
- predictiveSeed: optional object with ALL 6 fields if present. Allowed values:
  - diseaseState: ${predictiveOptions.diseaseState}
  - hcpType: ${predictiveOptions.hcpType}
  - journeyStage: ${predictiveOptions.journeyStage}
  - interactionPressure: ${predictiveOptions.interactionPressure}
  - influenceDriver: ${predictiveOptions.influenceDriver}
  - behaviorArchetype: ${predictiveOptions.behaviorArchetype}

Return ONLY valid JSON:
{
  "title": "string",
  "coreTension": "string",
  "description": "string",
  "stakeholder": "string",
  "objective": "string",
  "context": "string",
  "openingScene": "string",
  "visualScene": "string",
  "journeyStage": "string",
  "hcpRoleType": "string",
  "decisionOrientation": "string",
  "startingBehaviorState": "string",
  "interactionPressure": ["string"],
  "keyChallenges": ["string", "string", "string"],
  "suggestedFocusCapabilities": ["string", "string"],
  "predictiveSeed": {
    "diseaseState": "string",
    "hcpType": "string",
    "journeyStage": "string",
    "interactionPressure": "string",
    "influenceDriver": "string",
    "behaviorArchetype": "string"
  }
}`;

      const result = await invokeWorkerJson({
        prompt,
        max_tokens: 1400,
        temperature: 0.2,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            coreTension: { type: "string" },
            description: { type: "string" },
            stakeholder: { type: "string" },
            objective: { type: "string" },
            context: { type: "string" },
            openingScene: { type: "string" },
            visualScene: { type: "string" },
            journeyStage: { type: "string" },
            hcpRoleType: { type: "string" },
            decisionOrientation: { type: "string" },
            startingBehaviorState: { type: "string" },
            interactionPressure: { type: "array", items: { type: "string" } },
            keyChallenges: { type: "array", items: { type: "string" } },
            suggestedFocusCapabilities: { type: "array", items: { type: "string" } },
            predictiveSeed: { type: "object" },
          },
        },
      });

      const seedValidation = validatePredictiveSeed(result.predictiveSeed || {});
      const derivedTopLevelUi = deriveUISelectionFromBrain(result || {});
      const derivedSeedUi = deriveUISelectionFromBrain(result?.predictiveSeed || {});

      setForm((f) => applyPredictiveSeedMapping(applyTopLevelMapping({
        ...f,
        title: result.title || f.title,
        coreTension: result.coreTension || f.coreTension,
        description: result.description || f.description,
        stakeholder: result.stakeholder || f.stakeholder,
        objective: result.objective || f.objective,
        context: result.context || f.context,
        openingScene: result.openingScene || f.openingScene,
        visualScene: result.visualScene || f.visualScene,
        journeyStage: derivedTopLevelUi.stage || f.journeyStage,
        journeyState: journeyStateForStage[result.journeyStage] || f.journeyState,
        hcpRoleType: result.hcpRoleType || f.hcpRoleType,
        decisionOrientation: result.decisionOrientation || f.decisionOrientation,
        challengeContext: derivedTopLevelUi.challenge || f.challengeContext,
        startingBehaviorState: result.startingBehaviorState || f.startingBehaviorState,
        interactionPressure: result.interactionPressure?.length ? result.interactionPressure : f.interactionPressure,
        keyChallenges: (result.keyChallenges || []).join("\n") || f.keyChallenges,
        suggestedFocusCapabilities: result.suggestedFocusCapabilities?.length ? result.suggestedFocusCapabilities : f.suggestedFocusCapabilities,
        predictiveSeed: seedValidation.ok && seedValidation.normalized
          ? seedValidation.normalized
          : f.predictiveSeed,
      }, {
        hcpRoleType: result.hcpRoleType || f.hcpRoleType,
        journeyStage: derivedTopLevelUi.stage || f.journeyStage,
        challengeContext: derivedTopLevelUi.challenge || f.challengeContext,
      }), {
        hcpType: derivedSeedUi.hcpType || f.predictiveSeedUI.hcpType,
        stage: derivedSeedUi.stage || f.predictiveSeedUI.stage,
        challenge: derivedSeedUi.challenge || f.predictiveSeedUI.challenge,
      }));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.openingScene || !form.journeyStage || !form.startingBehaviorState) return;
    const seedValidation = validatePredictiveSeed(form.predictiveSeed);
    if (!seedValidation.ok) {
      setSaveError(seedValidation.message);
      return;
    }

    setSaveError("");
    setSaving(true);

    const mappedForSave = mapUIToBrain({
      hcpType: form.hcpRoleType,
      stage: form.journeyStage,
      challenge: form.challengeContext,
      realism: form.runtimeTemperature,
      diseaseState: form.predictiveSeed?.diseaseState || "primary_care",
    });

    await createCustomScenario({
      ...form,
      predictiveSeed: seedValidation.normalized,
      journeyStage: mappedForSave.resolvedFields.journey_stage,
      decisionOrientation: mappedForSave.resolvedFields.influence_driver,
      persona: mappedForSave.resolvedFields.behavior_archetype,
      interactionPressure: mappedForSave.resolvedFields.interaction_pressure,
      runtimeTemperature: Math.max(1, Math.min(10, Number(form.runtimeTemperature) || 5)),
      journeyState: journeyStateForStage[mappedForSave.resolvedFields.journey_stage] || "early_discovery",
      keyChallenges: form.keyChallenges.split("\n").filter(Boolean),
      isBuiltIn: false,
      isPublished: true,
    });

    setSaved(true);
    setTimeout(() => navigate("/"), 1200);
  };

  const isValid = form.title && form.openingScene && form.journeyStage && form.startingBehaviorState;

  return (
    <div
      className="min-h-screen font-inter"
      style={{ background: "linear-gradient(180deg, #f7fbfc 0%, #eef5f6 38%, #f8fbfc 100%)" }}
    >
      <div
        className="sticky top-0 z-10 backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.84)",
          borderBottom: "1px solid rgba(38, 67, 117, 0.18)",
          boxShadow: "0 10px 24px rgba(14, 24, 43, 0.06)",
        }}
      >
        <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="transition-colors" style={{ color: "hsl(222 52% 24%)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "hsl(177 49% 40%)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "hsl(222 52% 24%)"; }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="font-semibold" style={{ color: "hsl(222 48% 22%)" }}>Scenario Builder</span>
            <span className="text-sm ml-2" style={{ color: "hsl(215 18% 46%)" }}>Create a custom training scenario</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <EnterpriseBanner
            title="Build a Scenario"
            subtitle="Create a custom training scenario formatted to the same canonical structure as all built-in scenarios."
          />

          <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
            <div className="space-y-6">
              <div
                className="rounded-[24px] p-6 space-y-5"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
                  border: "1.5px solid rgba(92, 135, 165, 0.36)",
                  boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
                }}
              >
                <div className="pb-3 border-b" style={{ borderColor: "rgba(92, 135, 165, 0.18)" }}>
                  <h3 className="font-semibold" style={{ color: "hsl(174 55% 34%)" }}>Scenario Details</h3>
                </div>
                <Field label="Title *">
                  <Input value={form.title} onChange={set("title")} placeholder="e.g. The prior auth reflex in a rushed oncology clinic" />
                </Field>
                <Field label="Core Tension" hint="What is the fundamental conversational challenge this scenario represents?">
                  <Input value={form.coreTension} onChange={set("coreTension")} placeholder="e.g. HCP raises access concerns before clinical value is established" multiline />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Stakeholder">
                    <Input value={form.stakeholder} onChange={set("stakeholder")} placeholder="e.g. Cardiologist" />
                  </Field>
                  <Field label="Context">
                    <Input value={form.context} onChange={set("context")} placeholder="e.g. Busy outpatient clinic" />
                  </Field>
                </div>
                <Field label="Objective" hint="What should the rep practice in this scenario?">
                  <Input value={form.objective} onChange={set("objective")} placeholder="e.g. Navigate the access objection without abandoning the clinical conversation" multiline />
                </Field>
              </div>

              <div
                className="rounded-[24px] p-5"
                style={{
                  background: "linear-gradient(135deg, hsl(223 39% 18%) 0%, hsl(214 43% 24%) 48%, hsl(184 42% 24%) 100%)",
                  border: "1.5px solid rgba(97, 182, 181, 0.30)",
                  boxShadow: "0 18px 34px rgba(14, 24, 43, 0.12)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(101, 217, 200, 0.12)", border: "1px solid rgba(101, 217, 200, 0.24)" }}>
                    <Wand2 className="w-4 h-4" style={{ color: "hsl(174 60% 70%)" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white mb-0.5">Format into canonical structure</p>
                    <p className="text-xs mb-3 leading-relaxed" style={{ color: "rgba(231, 245, 243, 0.82)" }}>
                      Fill in any fields you have and the worker will format the complete scenario into the same structure as the built-in scenarios.
                    </p>
                    <button
                      onClick={generateWithAI}
                      disabled={aiGenerating || (!form.title && !form.coreTension && !form.stakeholder)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg, hsl(163 53% 42%), hsl(174 58% 34%))", color: "white" }}
                    >
                      {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {aiGenerating ? "Formatting scenario..." : "Generate full scenario"}
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="rounded-[24px] p-6 space-y-5"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
                  border: "1.5px solid rgba(92, 135, 165, 0.36)",
                  boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
                }}
              >
                <div className="pb-3 border-b" style={{ borderColor: "rgba(92, 135, 165, 0.18)" }}>
                  <h3 className="font-semibold" style={{ color: "hsl(174 55% 34%)" }}>Opening Scene *</h3>
                </div>
                <Field label="" hint="The first thing the HCP says. Sets the opening tone and challenge.">
                  <Input value={form.openingScene} onChange={set("openingScene")} placeholder={`e.g. "I only have a minute. What extra steps does this actually create for my staff?"`} multiline />
                </Field>
                <Field label="Visual Scene">
                  <Input value={form.visualScene} onChange={set("visualScene")} placeholder="Rep-facing observational scene" multiline />
                </Field>
                <Field label="Description">
                  <Input value={form.description} onChange={set("description")} placeholder="Brief summary of this scenario's challenge and context" multiline />
                </Field>
              </div>
            </div>

            <div className="space-y-6">
              <div
                className="rounded-[24px] p-6 space-y-5"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
                  border: "1.5px solid rgba(92, 135, 165, 0.36)",
                  boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
                }}
              >
                <div className="pb-3 border-b" style={{ borderColor: "rgba(92, 135, 165, 0.18)" }}>
                  <h3 className="font-semibold" style={{ color: "hsl(174 55% 34%)" }}>Realism Variables</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Conversation Moment *">
                    <Select value={form.journeyStage} onChange={(value) => setForm((f) => applyTopLevelMapping(f, { journeyStage: value }))} options={journeyStages} />
                  </Field>
                  <Field label="HCP Role">
                    <Select value={form.hcpRoleType} onChange={(value) => setForm((f) => applyTopLevelMapping(f, { hcpRoleType: value }))} options={hcpRoleTypes} />
                  </Field>
                  <Field label="Challenge Focus">
                    <Select value={form.challengeContext} onChange={(value) => setForm((f) => applyTopLevelMapping(f, { challengeContext: value }))} options={challengeContexts} />
                  </Field>
                  <Field label="Realism Lever">
                    <div className="rounded-xl px-3.5 py-2.5" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,249,0.98) 100%)", border: "1.5px solid rgba(92, 135, 165, 0.42)" }}>
                      <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: "hsl(215 18% 46%)" }}>
                        <span>1 (Cooperative)</span>
                        <span className="font-semibold" style={{ color: "hsl(173 42% 28%)" }}>{Math.max(1, Math.min(10, Number(form.runtimeTemperature) || 5))}/10</span>
                        <span>10 (Sharp)</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={Math.max(1, Math.min(10, Number(form.runtimeTemperature) || 5))}
                        onChange={(event) => setForm((f) => applyTopLevelMapping(f, { runtimeTemperature: Number(event.target.value) }))}
                        className="w-full accent-teal-600"
                        aria-label="Realism Lever"
                      />
                    </div>
                  </Field>
                </div>

                <p className="text-xs" style={{ color: "hsl(215 18% 46%)" }}>
                  {ADVANCED_CONTROLS_WARNING}
                </p>
                <AdvancedControlsSection label="Derived Scenario Fields">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Starting Behavior State *">
                      <Select value={form.startingBehaviorState} onChange={set("startingBehaviorState")} options={behaviorStates} />
                    </Field>
                    <Field label="Interaction Pressures">
                      <MultiToggle options={pressures} selected={form.interactionPressure} onChange={set("interactionPressure")} />
                    </Field>
                  </div>
                  <div className="pt-3 mt-3 border-t" style={{ borderColor: "rgba(92, 135, 165, 0.18)" }}>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: "hsl(174 55% 34%)" }}>
                      Predictive HCP Seed (Debug)
                    </h4>
                    <p className="text-xs mb-3" style={{ color: "hsl(215 18% 46%)" }}>
                      Optional override for debugging only. Default flow derives this automatically from the 3-control model.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="HCP Role">
                        <Select
                          value={form.predictiveSeedUI.hcpType}
                          onChange={(value) => setForm((f) => applyPredictiveSeedMapping(f, { hcpType: value }))}
                          options={hcpRoleTypes}
                        />
                      </Field>
                      <Field label="Conversation Moment">
                        <Select
                          value={form.predictiveSeedUI.stage}
                          onChange={(value) => setForm((f) => applyPredictiveSeedMapping(f, { stage: value }))}
                          options={journeyStages}
                        />
                      </Field>
                      <Field label="Challenge Focus">
                        <Select
                          value={form.predictiveSeedUI.challenge}
                          onChange={(value) => setForm((f) => applyPredictiveSeedMapping(f, { challenge: value }))}
                          options={challengeContexts}
                        />
                      </Field>
                    </div>
                  </div>
                </AdvancedControlsSection>
              </div>

              <div
                className="rounded-[24px] p-6 space-y-5"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
                  border: "1.5px solid rgba(92, 135, 165, 0.36)",
                  boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
                }}
              >
                <div className="pb-3 border-b" style={{ borderColor: "rgba(92, 135, 165, 0.18)" }}>
                  <h3 className="font-semibold" style={{ color: "hsl(174 55% 34%)" }}>Signal Intelligence Focus</h3>
                </div>
                <Field label="Suggested Focus Capabilities" hint="Which capabilities should the rep pay attention to in this scenario?">
                  <MultiToggle
                    options={SIGNAL_INTELLIGENCE_CAPABILITIES.map((c) => ({ value: c.id, label: c.label }))}
                    selected={form.suggestedFocusCapabilities}
                    onChange={set("suggestedFocusCapabilities")}
                  />
                </Field>
                <Field label="Key Challenges" hint="One per line">
                  <Input value={form.keyChallenges} onChange={set("keyChallenges")} placeholder={`e.g. Skepticism about prior auth burden\nResistance to switching therapy`} multiline />
                </Field>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pb-8">
            {saveError ? (
              <p className="text-xs mr-auto" style={{ color: "hsl(0 62% 34%)" }}>
                {saveError}
              </p>
            ) : null}
            <Link to="/" className="text-sm transition-colors" style={{ color: "hsl(215 16% 44%)" }}>Cancel</Link>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, hsl(163 53% 42%), hsl(174 58% 34%))", color: "white", boxShadow: "0 12px 24px rgba(14, 135, 122, 0.18)" }}
            >
              {saved ? (
                <><Check className="w-4 h-4" /> Saved!</>
              ) : saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                <><Plus className="w-4 h-4" /> Create Scenario</>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
