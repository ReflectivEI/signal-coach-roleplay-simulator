import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Sparkles, Loader2, Check, Wand2 } from "lucide-react";
import EnterpriseBanner from "@/components/layout/EnterpriseBanner";
import { createCustomScenario } from "@/lib/scenarioStorage";
import { invokeWorkerJson } from "@/services/workerClient";

const journeyStages = [
  { value: "initial_access", label: "Initial Access" },
  { value: "discovery", label: "Discovery" },
  { value: "clinical_value", label: "Clinical Value" },
  { value: "objection_handling", label: "Objection Handling" },
  { value: "access_formulary", label: "Access & Formulary" },
  { value: "adoption_implementation", label: "Adoption & Implementation" },
  { value: "commitment_close", label: "Commitment & Close" },
];

const journeyStateForStage = {
  initial_access: "early_discovery",
  discovery: "early_discovery",
  clinical_value: "clinical_evaluation",
  objection_handling: "objection_phase",
  access_formulary: "access_formulary",
  adoption_implementation: "adoption_commitment",
  commitment_close: "adoption_commitment",
};

const hcpRoleTypes = [
  { value: "treating_clinician", label: "Treating Clinician" },
  { value: "influencer", label: "Influencer" },
  { value: "thought_leader", label: "Thought Leader" },
];

const decisionOrientations = [
  { value: "patient_centric", label: "Patient-Centric" },
  { value: "evidence_driven", label: "Evidence-Driven" },
  { value: "risk_averse", label: "Risk-Averse" },
  { value: "guideline_anchored", label: "Guideline-Anchored" },
];

const behaviorStates = [
  { value: "closed", label: "Closed" },
  { value: "neutral", label: "Neutral" },
  { value: "open", label: "Open" },
];

const pressures = [
  { value: "time_constrained", label: "Time Constrained" },
  { value: "skeptical_resistant", label: "Skeptical / Resistant" },
  { value: "curious_uncertain", label: "Curious / Uncertain" },
  { value: "operationally_constrained", label: "Operationally Constrained" },
  { value: "competitive_bias", label: "Competitive Bias" },
  { value: "safety_concern", label: "Safety Concern" },
  { value: "access_barrier", label: "Access Barrier" },
];

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground block mb-1.5">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, multiline = false }) {
  const cls = "w-full bg-input border border-border/60 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 transition-colors";
  if (multiline) {
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${cls} resize-none`} />;
  }
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />;
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-input border border-border/60 rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/40 transition-colors"
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            selected.includes(o.value)
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-accent border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
          }`}
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
    persona: "curious_uncertain_adopter",
    startingBehaviorState: "",
    interactionPressure: [],
    keyChallenges: "",
    suggestedFocusCapabilities: [],
  });
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

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
Journey Stage: ${form.journeyStage || "not specified"}
HCP Role Type: ${form.hcpRoleType || "not specified"}
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
- journeyStage: one of: initial_access, discovery, clinical_value, objection_handling, adoption_implementation, commitment_close
- hcpRoleType: one of: treating_clinician, influencer, thought_leader
- decisionOrientation: one of: patient_centric, evidence_driven, risk_averse, guideline_anchored
- startingBehaviorState: one of: closed, neutral, open
- interactionPressure: array, each value from: time_constrained, skeptical_resistant, curious_uncertain, operationally_constrained, competitive_bias, safety_concern, access_barrier

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
            decisionOrientation: { type: "string" },
            startingBehaviorState: { type: "string" },
            interactionPressure: { type: "array", items: { type: "string" } },
            keyChallenges: { type: "array", items: { type: "string" } },
            suggestedFocusCapabilities: { type: "array", items: { type: "string" } },
          },
        },
      });

      setForm((f) => ({
        ...f,
        title: result.title || f.title,
        coreTension: result.coreTension || f.coreTension,
        description: result.description || f.description,
        stakeholder: result.stakeholder || f.stakeholder,
        objective: result.objective || f.objective,
        context: result.context || f.context,
        openingScene: result.openingScene || f.openingScene,
        visualScene: result.visualScene || f.visualScene,
        journeyStage: result.journeyStage || f.journeyStage,
        journeyState: journeyStateForStage[result.journeyStage] || f.journeyState,
        hcpRoleType: result.hcpRoleType || f.hcpRoleType,
        decisionOrientation: result.decisionOrientation || f.decisionOrientation,
        startingBehaviorState: result.startingBehaviorState || f.startingBehaviorState,
        interactionPressure: result.interactionPressure?.length ? result.interactionPressure : f.interactionPressure,
        keyChallenges: (result.keyChallenges || []).join("\n") || f.keyChallenges,
        suggestedFocusCapabilities: result.suggestedFocusCapabilities?.length ? result.suggestedFocusCapabilities : f.suggestedFocusCapabilities,
      }));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.openingScene || !form.journeyStage || !form.startingBehaviorState) return;
    setSaving(true);

    await createCustomScenario({
      ...form,
      journeyState: journeyStateForStage[form.journeyStage] || "early_discovery",
      keyChallenges: form.keyChallenges.split("\n").filter(Boolean),
      interactionPressure: form.interactionPressure,
      isBuiltIn: false,
      isPublished: true,
    });

    setSaved(true);
    setTimeout(() => navigate("/"), 1200);
  };

  const isValid = form.title && form.openingScene && form.journeyStage && form.startingBehaviorState;

  return (
    <div className="min-h-screen bg-background font-inter">
      <div className="border-b border-border/60 bg-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="font-semibold text-foreground">Scenario Builder</span>
            <span className="text-sm text-muted-foreground ml-2">Create a custom training scenario</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <EnterpriseBanner
            title="Build a Scenario"
            subtitle="Create a custom training scenario formatted to the same canonical structure as all built-in scenarios."
          />

          <div className="rounded-xl border border-border/60 bg-surface p-6 space-y-5">
            <h3 className="font-semibold text-primary">Scenario Details</h3>
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

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Wand2 className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground mb-0.5">Format into canonical structure</p>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  Fill in any fields you have and the worker will format the complete scenario into the same structure as the built-in scenarios.
                </p>
                <button
                  onClick={generateWithAI}
                  disabled={aiGenerating || (!form.title && !form.coreTension && !form.stakeholder)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiGenerating ? "Formatting scenario..." : "Generate full scenario"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-surface p-6 space-y-5">
            <h3 className="font-semibold text-primary">Opening Scene *</h3>
            <Field label="" hint="The first thing the HCP says. Sets the opening tone and challenge.">
              <Input value={form.openingScene} onChange={set("openingScene")} placeholder={`e.g. "I only have a minute. What makes this worth the added burden?"`} multiline />
            </Field>
            <Field label="Visual Scene">
              <Input value={form.visualScene} onChange={set("visualScene")} placeholder="Rep-facing observational scene" multiline />
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={set("description")} placeholder="Brief summary of this scenario's challenge and context" multiline />
            </Field>
          </div>

          <div className="rounded-xl border border-border/60 bg-surface p-6 space-y-5">
            <h3 className="font-semibold text-primary">Realism Variables</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Journey Stage *">
                <Select value={form.journeyStage} onChange={set("journeyStage")} options={journeyStages} />
              </Field>
              <Field label="Starting Behavior State *">
                <Select value={form.startingBehaviorState} onChange={set("startingBehaviorState")} options={behaviorStates} />
              </Field>
              <Field label="HCP Role Type">
                <Select value={form.hcpRoleType} onChange={set("hcpRoleType")} options={hcpRoleTypes} />
              </Field>
              <Field label="Decision Orientation">
                <Select value={form.decisionOrientation} onChange={set("decisionOrientation")} options={decisionOrientations} />
              </Field>
            </div>
            <Field label="Interaction Pressures">
              <MultiToggle options={pressures} selected={form.interactionPressure} onChange={set("interactionPressure")} />
            </Field>
          </div>

          <div className="rounded-xl border border-border/60 bg-surface p-6 space-y-5">
            <h3 className="font-semibold text-primary">Signal Intelligence Focus</h3>
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

          <div className="flex items-center justify-end gap-3 pb-8">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</Link>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
