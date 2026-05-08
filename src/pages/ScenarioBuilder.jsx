<<<<<<< HEAD
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
=======
// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Copy, Save, X, ChevronDown, ChevronUp, Tag, Sparkles, LayoutTemplate, ShieldCheck, Wand2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import CapabilityTagger from "@/components/roleplay/CapabilityTagger";
import AIScenarioGenerator from "@/components/scenariobuilder/AIScenarioGenerator";
import { buildSimulatorScenarioFromNormalized, getScenarioStatusLabel, normalizeGeneratedScenario } from "@/lib/scenarioNormalization";

const BUILDER_TO_SIMULATOR_KEY = "reflectivai:builderScenario";

const ButtonField = /** @type {any} */ (Button);
const InputField = /** @type {any} */ (Input);
const SelectField = /** @type {any} */ (Select);
const SelectContentField = /** @type {any} */ (SelectContent);
const SelectItemField = /** @type {any} */ (SelectItem);
const SelectTriggerField = /** @type {any} */ (SelectTrigger);
const SelectValueField = /** @type {any} */ (SelectValue);
const CapabilityTaggerField = /** @type {any} */ (CapabilityTagger);
const AIScenarioGeneratorField = /** @type {any} */ (AIScenarioGenerator);

/**
 * @typedef {{
 *   id?: string,
 *   title: string,
 *   description: string,
 *   specialty: string,
 *   disease_state: string,
 *   hcp_category: string,
 *   influence_driver: string,
 *   difficulty: string,
 *   details: string,
 *   focus_capabilities: string[],
 *   created_date?: string,
 *   state?: string,
 * }} ScenarioForm
 */

function exportScenarioPdf(scenario) {
  const normalized = normalizeGeneratedScenario({
    title: scenario.title,
    description: scenario.description,
    content: scenario.details,
    specialty: scenario.specialty,
    disease_state: scenario.disease_state,
    hcp_category: scenario.hcp_category,
    influence_driver: scenario.influence_driver,
    difficulty: scenario.difficulty,
    focus_capabilities: scenario.focus_capabilities,
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const left = 15;
  const width = doc.internal.pageSize.getWidth() - left * 2;
  let y = 18;

  const writeLines = (label, items) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, left, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    items.forEach((item) => {
      const wrapped = doc.splitTextToSize(`• ${item}`, width);
      doc.text(wrapped, left, y);
      y += wrapped.length * 5;
    });
    y += 3;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(scenario.title || "Untitled Scenario", left, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`State: ${getScenarioStatusLabel(scenario)}`, left, y);
  y += 7;
  writeLines("Opening Scene", [normalized.openingScene]);
  writeLines("HCP", [normalized.hcp]);
  writeLines("Objective", normalized.objective);
  writeLines("Tactical Focus", normalized.tacticalFocus);

  const safeName = (scenario.title || "untitled").replace(/\s+/g, "-").toLowerCase();
  doc.save(`scenario-${safeName}.pdf`);
}

const diseaseStates = ["HIV", "PrEP (HIV Prevention)", "Oncology", "Cardiology", "Neurology", "Vaccines / Immunization"];
const specialties = ["Family Medicine", "Internal Medicine", "Infectious Diseases", "Hem/Onc", "Medical Oncology", "Cardiology", "Neurology"];
const hcpCategories = ["KOL / Thought Leader", "Prescriber / Treater", "Non-Prescribing Influencer", "Low Engagement"];
const influenceDrivers = ["Evidence-Based", "Patient-Centered", "Risk-Averse", "Guideline-Anchored"];
const difficulties = ["beginner", "intermediate", "advanced"];

/** @type {ScenarioForm} */
const emptyForm = {
  title: "",
  description: "",
  specialty: "",
  disease_state: "",
  hcp_category: "",
  influence_driver: "",
  difficulty: "intermediate",
  details: "",
  focus_capabilities: [],
  state: "Draft",
};

const cleanScenarioText = (value = "") => String(value)
  .replace(/^[\s*-]+/gm, "")
  .replace(/\*\*/g, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

export default function ScenarioBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(/** @type {ScenarioForm} */ ({ ...emptyForm }));
  const [expandedId, setExpandedId] = useState(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const isLoading = false;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mode") === "generator") {
      setShowAIGenerator(true);
      setEditingId(null);
    }
  }, [location.search]);

  const manualNormalizedPreview = useMemo(() => normalizeGeneratedScenario({
    title: form.title,
    description: form.description,
    content: form.details,
    specialty: form.specialty,
    disease_state: form.disease_state,
    hcp_category: form.hcp_category,
    influence_driver: form.influence_driver,
    difficulty: form.difficulty,
    focus_capabilities: form.focus_capabilities,
  }), [form]);

  const saveScenario = (data) => {
    if (editingId === "new") {
      setScenarios((prev) => [{ ...data, id: Date.now().toString(), created_date: new Date().toISOString() }, ...prev]);
    } else {
      setScenarios((prev) => prev.map((s) => s.id === editingId ? { ...s, ...data } : s));
    }
    setEditingId(null);
    setForm(emptyForm);
  };

  const deleteScenario = (id) => setScenarios((prev) => prev.filter((s) => s.id !== id));

  const duplicateScenario = (scenario) => {
    const { id: _id, created_date: _createdDate, ...rest } = scenario;
    setScenarios((prev) => [{ ...rest, id: Date.now().toString(), title: `${rest.title} (Copy)`, created_date: new Date().toISOString() }, ...prev]);
  };

  const startEdit = (scenario) => {
    setEditingId(scenario.id);
    setShowAIGenerator(false);
    setForm({
      title: scenario.title || "",
      description: scenario.description || "",
      specialty: scenario.specialty || "",
      disease_state: scenario.disease_state || "",
      hcp_category: scenario.hcp_category || "",
      influence_driver: scenario.influence_driver || "",
      difficulty: scenario.difficulty || "intermediate",
      details: scenario.details || "",
      focus_capabilities: scenario.focus_capabilities || [],
      state: scenario.state || "Draft",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    saveScenario(form);
  };

  const handleGeneratedScenario = (generated) => {
    setShowAIGenerator(false);
    setEditingId("new");
    setForm({
      ...emptyForm,
      title: generated.title || "",
      description: generated.description || "",
      specialty: generated.specialty || "",
      disease_state: generated.disease_state || "",
      hcp_category: generated.hcp_category || "",
      influence_driver: generated.influence_driver || "",
      difficulty: generated.difficulty || "intermediate",
      details: [generated.hcp, generated.openingScene, ...(generated.objective || []), ...(generated.challenges || [])].filter(Boolean).join("\n\n"),
      focus_capabilities: generated.focus_capabilities || [],
      state: generated.state || "Ready for Simulation",
    });
  };

  const handleAddToSimulator = (scenario) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(BUILDER_TO_SIMULATOR_KEY, JSON.stringify(scenario));
    }
    navigate(createPageUrl("RolePlaySimulator"));
  };

  return (
    <div className="min-h-screen bg-slate-100/80">
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="mb-8 overflow-hidden rounded-[32px] border border-[#1A334D]/10 bg-[linear-gradient(135deg,#0f172a_0%,#1A334D_52%,#1f766e_100%)] p-6 text-white shadow-[0_26px_70px_rgba(15,23,42,0.24)] md:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-teal-200">Scenario Design Studio</p>
              <h1 className="mt-3 text-3xl font-bold md:text-[40px] md:leading-[1.05]">Scenario Builder</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">Scenario Builder is the authoring layer for ReflectivAI. Create scenarios here, normalize them for simulator-ready use, and keep runtime execution inside the Role Play Simulator.</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-slate-100 backdrop-blur-sm">
                Signal Intelligence evaluates observable behavior only. It does not infer intent, emotion, or personality. All scenarios operate on a fixed behavioral measurement model.
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: LayoutTemplate, label: "Structured briefs", value: `${scenarios.length} scenarios saved` },
                  { icon: Wand2, label: "Drafting modes", value: "Manual + AI generated" },
                  { icon: ShieldCheck, label: "Stability guard", value: "UI-only enhancement pass" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                      <Icon className="h-5 w-5 text-teal-200" />
                      <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-100">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            {editingId === null && (
              <div className="flex flex-wrap gap-2 self-start">
                <ButtonField
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => { setShowAIGenerator((value) => !value); setEditingId(null); }}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  AI Scenario Generator
                </ButtonField>
                <ButtonField
                  className="bg-teal-500 hover:bg-teal-600"
                  onClick={() => { setEditingId("new"); setForm(emptyForm); setShowAIGenerator(false); }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  + New Scenario
                </ButtonField>
              </div>
            )}
          </div>
        </div>

        {showAIGenerator && editingId === null && (
          <div className="mb-6 rounded-[28px] border border-teal-200/80 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <AIScenarioGeneratorField
              onCancel={() => setShowAIGenerator(false)}
              onGenerated={handleGeneratedScenario}
              onAddToSimulator={handleAddToSimulator}
            />
          </div>
        )}

        {editingId === null && (
          <div className="mb-6 rounded-[28px] border border-[#1A334D]/10 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
            <div className="ui-teal-section rounded-2xl p-4 md:p-5 flex flex-col gap-2">
              <p className="text-sm font-bold text-[#1A334D]">All scenario authoring starts here.</p>
              <p className="text-xs text-gray-600">Use AI Scenario Generator for a simulator-ready brief or + New Scenario for manual authoring. The Role Play Simulator only runs scenarios.</p>
            </div>
          </div>
        )}

        {editingId !== null && (
          <div className="bg-white border border-[#1A334D]/10 rounded-[28px] p-6 mb-6 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">{editingId === "new" ? "New Scenario" : "Edit Scenario"}</h2>
                <p className="text-xs text-slate-500 mt-1">State: <span className={`font-semibold ${form.state === "Ready for Simulation" ? "text-emerald-700" : "text-amber-700"}`}>{form.state || "Draft"}</span></p>
              </div>
              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Title *</label>
                <InputField
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Skeptical Oncologist — Clinical Evidence Challenge"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief overview of the scenario context and challenge..."
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Specialty</label>
                  <SelectField value={form.specialty} onValueChange={(v) => setForm({ ...form, specialty: v })}>
                    <SelectTriggerField><SelectValueField placeholder="Select specialty" /></SelectTriggerField>
                    <SelectContentField>
                      {specialties.map((s) => <SelectItemField key={s} value={s}>{s}</SelectItemField>)}
                    </SelectContentField>
                  </SelectField>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Disease State</label>
                  <SelectField value={form.disease_state} onValueChange={(v) => setForm({ ...form, disease_state: v })}>
                    <SelectTriggerField><SelectValueField placeholder="Select disease state" /></SelectTriggerField>
                    <SelectContentField>
                      {diseaseStates.map((d) => <SelectItemField key={d} value={d}>{d}</SelectItemField>)}
                    </SelectContentField>
                  </SelectField>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">HCP Category</label>
                  <SelectField value={form.hcp_category} onValueChange={(v) => setForm({ ...form, hcp_category: v })}>
                    <SelectTriggerField><SelectValueField placeholder="Select HCP type" /></SelectTriggerField>
                    <SelectContentField>
                      {hcpCategories.map((h) => <SelectItemField key={h} value={h}>{h}</SelectItemField>)}
                    </SelectContentField>
                  </SelectField>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Influence Driver</label>
                  <SelectField value={form.influence_driver} onValueChange={(v) => setForm({ ...form, influence_driver: v })}>
                    <SelectTriggerField><SelectValueField placeholder="Select driver" /></SelectTriggerField>
                    <SelectContentField>
                      {influenceDrivers.map((i) => <SelectItemField key={i} value={i}>{i}</SelectItemField>)}
                    </SelectContentField>
                  </SelectField>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Difficulty</label>
                  <SelectField value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                    <SelectTriggerField><SelectValueField placeholder="Select difficulty" /></SelectTriggerField>
                    <SelectContentField>
                      {difficulties.map((d) => <SelectItemField key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItemField>)}
                    </SelectContentField>
                  </SelectField>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Extended Details</label>
                <textarea
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value, state: form.state || "Draft" })}
                  placeholder="Additional coaching context, HCP background, specific behaviors to practice..."
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px] resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Signal Intelligence Focus Capabilities
                </label>
                <p className="text-xs text-gray-400 mb-2">All 8 Signal Intelligence capabilities will be practiced and evaluated in every scenario.</p>
                <CapabilityTaggerField
                  selected={form.focus_capabilities}
                  onChange={(caps) => setForm({ ...form, focus_capabilities: caps })}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Generated Preview</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Opening Scene</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{manualNormalizedPreview.openingScene}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">HCP</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{manualNormalizedPreview.hcp}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Objective</p>
                    <ul className="space-y-1.5">
                      {manualNormalizedPreview.objective.map((item, index) => <li key={index} className="text-sm text-slate-700 leading-relaxed">• {item}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Tactical Focus</p>
                    <ul className="space-y-1.5">
                      {manualNormalizedPreview.tacticalFocus.map((item, index) => <li key={index} className="text-sm text-slate-700 leading-relaxed">• {item}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 flex-wrap">
                <ButtonField variant="outline" onClick={cancelEdit}>Cancel</ButtonField>
                <ButtonField variant="outline" onClick={() => exportScenarioPdf(form)} disabled={!form.title.trim()}>
                  Export to PDF
                </ButtonField>
                <ButtonField
                  className="bg-teal-500 hover:bg-teal-600"
                  onClick={handleSave}
                  disabled={!form.title.trim()}
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save Scenario
                </ButtonField>
                <ButtonField
                  className="bg-[#1A334D] hover:bg-[#152a3f]"
                  onClick={() => handleAddToSimulator({
                    ...buildSimulatorScenarioFromNormalized(manualNormalizedPreview),
                    state: form.state || "Draft",
                  })}
                  disabled={!form.title.trim()}
                >
                  Add to Simulator
                </ButtonField>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4 rounded-[28px] border border-[#1A334D]/10 bg-white p-4 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : scenarios.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white py-16 text-center text-gray-400 shadow-[0_20px_55px_rgba(15,23,42,0.06)]">
            <p className="text-lg font-medium">No scenarios yet</p>
            <p className="text-sm mt-1">Use AI Scenario Generator or + New Scenario to create your first one</p>
          </div>
        ) : (
          <div className="space-y-3 rounded-[28px] border border-[#1A334D]/10 bg-white p-4 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
            {scenarios.map((s) => (
              <div key={s.id} className={`border rounded-[24px] overflow-hidden transition-all bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] ${editingId === s.id ? "border-teal-300" : "border-gray-200 hover:border-gray-300"}`}>
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{s.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getScenarioStatusLabel(s) === "Ready for Simulation" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{getScenarioStatusLabel(s)}</span>
                    </div>
                    <div className="flex gap-2 mt-1 flex-wrap items-center">
                      {s.specialty && <span className="text-xs text-gray-400">{s.specialty}</span>}
                      {s.specialty && s.disease_state && <span className="text-xs text-gray-300">·</span>}
                      {s.disease_state && <span className="text-xs text-gray-400">{s.disease_state}</span>}
                      {s.hcp_category && <span className="text-xs text-gray-300">·</span>}
                      {s.hcp_category && <span className="text-xs text-gray-400">{s.hcp_category}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      title="View details"
                    >
                      {expandedId === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => startEdit(s)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => duplicateScenario(s)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteScenario(s.id)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedId === s.id && (
                  <div className="px-5 pb-4 pt-0 border-t border-gray-100 bg-gray-50 space-y-3">
                    {s.description && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{cleanScenarioText(s.description)}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Opening Scene</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{normalizeGeneratedScenario({ title: s.title, description: s.description, content: s.details, specialty: s.specialty, disease_state: s.disease_state, hcp_category: s.hcp_category, influence_driver: s.influence_driver, difficulty: s.difficulty, focus_capabilities: s.focus_capabilities }).openingScene}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">HCP</p>
                        <p className="text-sm text-slate-700 leading-relaxed">{normalizeGeneratedScenario({ title: s.title, description: s.description, content: s.details, specialty: s.specialty, disease_state: s.disease_state, hcp_category: s.hcp_category, influence_driver: s.influence_driver, difficulty: s.difficulty, focus_capabilities: s.focus_capabilities }).hcp}</p>
                      </div>
                    </div>
                    {s.details && <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{cleanScenarioText(s.details)}</p>}
                    {!s.description && !s.details && <p className="text-xs text-gray-400 italic">No additional details.</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
>>>>>>> f9564108d7fe619378852cbd8085e729086b6966
      </div>
    </div>
  );
}
