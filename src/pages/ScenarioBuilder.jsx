import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";
import { motion } from "framer-motion";
import { Plus, Sparkles, Loader2, Check, Wand2 } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import EnterpriseBanner from "@/components/layout/EnterpriseBanner";
import { createCustomScenario } from "@/lib/scenarioStorage";
import { invokeWorkerJson } from "@/services/workerClient";
import {
  CHALLENGE_CONTEXT_OPTIONS,
  CONVERSATION_STAGE_OPTIONS,
  HCP_ROLE_OPTIONS,
  RPS_UI_LABELS,
} from "@/lib/rpsUserInputOptions";
import { deriveUISelectionFromBrain, mapUIToBrain } from "@/lib/scenarioInputResolver";

/** @typedef {{ value: string; label: string }} SelectOption */
/**
 * @typedef {{
 *   title: string,
 *   coreTension: string,
 *   description: string,
 *   stakeholder: string,
 *   objective: string,
 *   context: string,
 *   openingScene: string,
 *   visualScene: string,
 *   journeyStage: string,
 *   hcpRoleType: string,
 *   challengeContext: string,
 *   runtimeTemperature: number,
 *   keyChallenges: string,
 *   suggestedFocusCapabilities: string[]
 * }} ScenarioForm
 */

// Scenario Context options without the "all" sentinel (for required field)
const journeyStages = CONVERSATION_STAGE_OPTIONS.filter(/** @param {SelectOption} o */ (o) => o.value !== "all");

/** @type {Record<string, string>} */
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

/** @type {Record<string, string>} */
const challengeDefaultBehaviorState = {
  access_barrier: "resistance",
  time_constraint: "time_pressure",
  skepticism: "neutral",
  prior_experience: "neutral",
  competing_priorities: "curiosity",
};

// HCP Role + Mindset: import from shared module (no "all" sentinel for form selects)
const hcpRoleTypes = HCP_ROLE_OPTIONS.filter(/** @param {SelectOption} o */ (o) => o.value !== "all");
const challengeContexts = CHALLENGE_CONTEXT_OPTIONS.filter(/** @param {SelectOption} o */ (o) => o.value !== "all");

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

/** @param {{ value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean }} props */
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

/** @param {{ value: string; onChange: (value: string) => void; options: SelectOption[] }} props */
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

/** @param {{ options: SelectOption[]; selected: string[]; onChange: (value: string[]) => void }} props */
function MultiToggle({ options, selected, onChange }) {
  /** @param {string} v */
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
  const [form, setForm] = useState(/** @type {ScenarioForm} */ ({
    title: "",
    coreTension: "",
    description: "",
    stakeholder: "",
    objective: "",
    context: "",
    openingScene: "",
    visualScene: "",
    journeyStage: "",
    hcpRoleType: "",
    challengeContext: "",
    runtimeTemperature: 5,
    keyChallenges: "",
    suggestedFocusCapabilities: [],
  }));
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  /** @param {keyof ScenarioForm} key */
  const set = (key) => /** @param {ScenarioForm[keyof ScenarioForm]} val */ (val) => setForm((f) => ({ ...f, [key]: val }));

  /** @param {ScenarioForm} current @param {Partial<ScenarioForm>} partial */
  const applyTopLevelMapping = (current, partial) => {
    const next = { ...current, ...partial };
    return next;
  };

  const generateWithAI = async () => {
    if (!form.title && !form.coreTension && !form.stakeholder) return;
    setAiGenerating(true);

    try {
      const capabilityIds = SIGNAL_INTELLIGENCE_CAPABILITIES.map((c) => c.id).join(", ");

      const prompt = `You are building a canonical Signal Intelligence Coaching Simulator scenario for pharma rep training.

Format the scenario using the exact schema below. Every field must be populated. The result must feel like a real conversation, not a training module.

Input provided:
Title: ${form.title || "not specified"}
Core Tension: ${form.coreTension || "not specified"}
Stakeholder: ${form.stakeholder || "not specified"}
Context: ${form.context || "not specified"}
Objective: ${form.objective || "not specified"}
Scenario Stage: ${form.journeyStage || "not specified"}
HCP Profile: ${form.hcpRoleType || "not specified"}
Challenge Context: ${form.challengeContext || "not specified"}

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
  "keyChallenges": ["string", "string", "string"],
  "suggestedFocusCapabilities": ["string", "string"]
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
            keyChallenges: { type: "array", items: { type: "string" } },
            suggestedFocusCapabilities: { type: "array", items: { type: "string" } },
          },
        },
      });

      const derivedTopLevelUi = deriveUISelectionFromBrain(result || {});

      setForm((f) => applyTopLevelMapping({
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
        hcpRoleType: result.hcpRoleType || f.hcpRoleType,
        challengeContext: derivedTopLevelUi.challenge || f.challengeContext,
        keyChallenges: (result.keyChallenges || []).join("\n") || f.keyChallenges,
        suggestedFocusCapabilities: result.suggestedFocusCapabilities?.length ? result.suggestedFocusCapabilities : f.suggestedFocusCapabilities,
      }, {
        hcpRoleType: result.hcpRoleType || f.hcpRoleType,
        journeyStage: derivedTopLevelUi.stage || f.journeyStage,
        challengeContext: derivedTopLevelUi.challenge || f.challengeContext,
      }));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.openingScene || !form.hcpRoleType || !form.journeyStage || !form.challengeContext) {
      setSaveError("Complete HCP Profile, Scenario Stage, Challenge Context, title, and opening scene before saving.");
      return;
    }

    setSaveError("");
    setSaving(true);

    const mappedForSave = mapUIToBrain({
      hcpType: form.hcpRoleType,
      stage: form.journeyStage,
      challenge: form.challengeContext,
      realism: form.runtimeTemperature,
      diseaseState: "primary_care",
    });

    await createCustomScenario({
      ...form,
      predictiveSeed: mappedForSave.predictiveSelection,
      journeyStage: mappedForSave.resolvedFields.journey_stage,
      journeyState: journeyStateForStage[mappedForSave.resolvedFields.journey_stage] || "early_discovery",
      decisionOrientation: mappedForSave.resolvedFields.influence_driver,
      persona: mappedForSave.resolvedFields.behavior_archetype,
      startingBehaviorState: challengeDefaultBehaviorState[form.challengeContext] || "neutral",
      interactionPressure: mappedForSave.resolvedFields.interaction_pressure,
      runtimeTemperature: Math.max(1, Math.min(10, Number(form.runtimeTemperature) || 5)),
      keyChallenges: form.keyChallenges.split("\n").filter(Boolean),
      isBuiltIn: false,
      isPublished: true,
    });

    setSaved(true);
    setTimeout(() => navigate("/"), 1200);
  };

  const isValid = form.title && form.openingScene && form.hcpRoleType && form.journeyStage && form.challengeContext;

  return (
    <div
      className="min-h-screen font-inter"
      style={{ background: "linear-gradient(180deg, #f7fbfc 0%, #eef5f6 38%, #f8fbfc 100%)" }}
    >
      <AppHeader maxWidthClassName="max-w-[1180px]" />

      <div className="max-w-[1180px] mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div>
            <span className="font-semibold" style={{ color: "hsl(222 48% 22%)" }}>Scenario Builder</span>
            <span className="text-sm ml-2" style={{ color: "hsl(215 18% 46%)" }}>Create a custom training scenario</span>
          </div>
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
                  <Field label={`${RPS_UI_LABELS.hcpType} *`}>
                    <Select value={form.hcpRoleType} onChange={(value) => setForm((f) => applyTopLevelMapping(f, { hcpRoleType: value }))} options={hcpRoleTypes} />
                  </Field>
                  <Field label={`${RPS_UI_LABELS.stage} *`}>
                    <Select value={form.journeyStage} onChange={(value) => setForm((f) => applyTopLevelMapping(f, { journeyStage: value }))} options={journeyStages} />
                  </Field>
                  <Field label={`${RPS_UI_LABELS.challenge} *`}>
                    <Select value={form.challengeContext} onChange={(value) => setForm((f) => applyTopLevelMapping(f, { challengeContext: value }))} options={challengeContexts} />
                  </Field>
                  <Field label={RPS_UI_LABELS.realism}>
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
                        aria-label={RPS_UI_LABELS.realism}
                      />
                    </div>
                  </Field>
                </div>
                <p className="text-xs" style={{ color: "hsl(215 18% 46%)" }}>
                  Starting behavior, interaction pressure, predictive seed, and other runtime fields are derived automatically from these four controls.
                </p>
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
