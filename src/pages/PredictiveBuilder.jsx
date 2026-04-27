import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BrainCircuit, Loader2, MessageSquareText } from "lucide-react";
import EnterpriseBanner from "@/components/layout/EnterpriseBanner";
import {
  PREDICTIVE_SELECTOR_OPTIONS,
  buildPredictiveModel,
  buildPredictiveProfile,
  scenarioPredictivePresets,
} from "@/lib/predictiveBuilderModel";
import { invokeWorkerText } from "@/services/workerClient";

const INITIAL_SELECTION = {
  diseaseState: "",
  hcpType: "",
  journeyStage: "",
  interactionPressure: "",
  influenceDriver: "",
  behaviorArchetype: "",
};

function SelectField({ label, value, options, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(222 46% 25%)" }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,249,0.98) 100%)",
          border: "1.5px solid rgba(92, 135, 165, 0.42)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78), 0 1px 3px rgba(14, 24, 43, 0.03)",
        }}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionCard({ title, bullets, eyebrow }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-teal-600">{eyebrow}</p>
      <h3 className="mt-1 text-base font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2">
        {bullets.filter(Boolean).map((bullet, index) => (
          <li key={`${title}-${index}`} className="flex gap-2 text-sm leading-6 text-slate-700">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResponsePanel({ response, loading, error }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-teal-600" />
        <h3 className="text-base font-semibold text-slate-900">Test HCP Response</h3>
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Sandbox-only response test. This uses the existing worker LLM path, not simulator session state.
      </p>
      {loading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating response...
        </div>
      )}
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
      {response && !loading && (
        <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">HCP reply</p>
          <p className="mt-2 text-sm leading-7 text-slate-800">{response}</p>
        </div>
      )}
    </div>
  );
}

export default function PredictiveBuilder() {
  const [selection, setSelection] = useState(INITIAL_SELECTION);
  const [presetName, setPresetName] = useState("");
  const [repQuestion, setRepQuestion] = useState("");
  const [hcpResponse, setHcpResponse] = useState("");
  const [responseError, setResponseError] = useState("");
  const [responseLoading, setResponseLoading] = useState(false);

  const allSelected = Object.values(selection).every(Boolean);

  const model = useMemo(() => {
    if (!allSelected) return null;
    return buildPredictiveModel(selection);
  }, [allSelected, selection]);

  const compatibilityProfile = useMemo(() => {
    if (!allSelected) return null;
    return buildPredictiveProfile(selection);
  }, [allSelected, selection]);

  const setField = (field) => (value) => {
    setSelection((current) => ({ ...current, [field]: value }));
    setPresetName("");
  };

  const loadPreset = (value) => {
    setPresetName(value);
    const preset = scenarioPredictivePresets[value];
    if (!preset) return;
    setSelection((current) => ({
      ...current,
      ...preset,
    }));
    setResponseError("");
    setHcpResponse("");
  };

  const modelSections = useMemo(() => {
    if (!model) return [];
    return [
      {
        key: "persona_core",
        eyebrow: "Persona Core",
        title: "How this HCP is wired",
        bullets: [
          `Archetype: ${model.persona.archetype}`,
          `Mindset: ${model.persona.mindset}`,
          `Decision style: ${model.persona.decisionStyle}`,
          `Risk tolerance: ${model.persona.riskTolerance}`,
        ],
      },
      {
        key: "pressure_stack",
        eyebrow: "Pressure Stack",
        title: "What is squeezing the interaction",
        bullets: [
          `Time pressure: ${model.pressures.time}`,
          `Workflow burden: ${model.pressures.workflow}`,
          `Cognitive load: ${model.pressures.cognitiveLoad}`,
        ],
      },
      {
        key: "behavior_profile",
        eyebrow: "Behavior Profile",
        title: "How the HCP tends to show up",
        bullets: [
          `Openness: ${model.behavior.openness}`,
          `Skepticism: ${model.behavior.skepticism}`,
          `Engagement pattern: ${model.behavior.engagementPattern}`,
        ],
      },
      {
        key: "objection_system",
        eyebrow: "Objection System",
        title: "What will get challenged first",
        bullets: [
          `Primary objection: ${model.objections.primary}`,
          ...model.objections.secondary.map((item) => `Secondary objection: ${item}`),
          ...model.objections.triggers.map((item) => `Trigger: ${item}`),
        ],
      },
      {
        key: "language_model",
        eyebrow: "Language Model",
        title: "What sounds natural to this HCP",
        bullets: [
          `Prefers: ${model.language.prefers.join(" | ")}`,
          `Rejects: ${model.language.rejects.join(" | ")}`,
          `Question style: ${model.language.questionStyle}`,
        ],
      },
      {
        key: "conversation_dynamics",
        eyebrow: "Conversation Dynamics",
        title: "How the exchange will move",
        bullets: [
          `Turn behavior: ${model.conversationDynamics.turnBehavior}`,
          `Escalation pattern: ${model.conversationDynamics.escalationPattern}`,
          `Disengagement signals: ${model.conversationDynamics.disengagementSignals.join(" | ")}`,
        ],
      },
      {
        key: "coaching_strategy",
        eyebrow: "Coaching Strategy",
        title: "How the rep should respond",
        bullets: [
          `Rep strategy: ${model.coaching.repStrategy.join(" | ")}`,
          `Mistakes to avoid: ${model.coaching.mistakesToAvoid.join(" | ")}`,
        ],
      },
    ];
  }, [model]);

  const handleTestResponse = async () => {
    if (!model || !repQuestion.trim() || responseLoading) return;
    setResponseLoading(true);
    setResponseError("");
    setHcpResponse("");

    try {
      const prompt = [
        "You are an HCP in a pharma role-play simulator.",
        "Respond as a real human clinician would, using the structured profile below as your behavioral state.",
        "Stay grounded, selective, practical, and scenario-consistent.",
        "Do not mention the JSON or that you are following instructions.",
        "Do not sound robotic or overly polished.",
        "Return only the HCP reply.",
        "",
        "STRUCTURED PROFILE JSON:",
        JSON.stringify(model, null, 2),
        "",
        `REP QUESTION: ${repQuestion.trim()}`,
      ].join("\n");

      const response = await invokeWorkerText({
        prompt,
        max_tokens: 180,
        temperature: 0.25,
        timeout_ms: 20000,
      });

      setHcpResponse(response);
    } catch (error) {
      setResponseError(error?.message || "Unable to generate a sandbox HCP response.");
    } finally {
      setResponseLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-inter" style={{ background: "linear-gradient(180deg, #f7fbfc 0%, #eef5f6 38%, #f8fbfc 100%)" }}>
      <div
        className="sticky top-0 z-10 backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.84)",
          borderBottom: "1px solid rgba(38, 67, 117, 0.18)",
          boxShadow: "0 10px 24px rgba(14, 24, 43, 0.06)",
        }}
      >
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-6 py-4">
          <Link to="/" className="transition-colors" style={{ color: "hsl(222 52% 24%)" }}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <span className="font-semibold" style={{ color: "hsl(222 48% 22%)" }}>Predictive HCP Builder</span>
            <span className="ml-2 text-sm" style={{ color: "hsl(215 18% 46%)" }}>structured behavior model + sandbox response test</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] space-y-6 px-6 py-8">
        <EnterpriseBanner
          title="Predictive HCP Builder"
          subtitle="Build a structured HCP behavior model from six selectors, then test a sandbox HCP response without touching simulator sessions."
        />

        <div
          className="rounded-[24px] p-6 space-y-5"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
            border: "1.5px solid rgba(92, 135, 165, 0.36)",
            boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
          }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField label="Disease State" value={selection.diseaseState} options={PREDICTIVE_SELECTOR_OPTIONS.diseaseState} onChange={setField("diseaseState")} />
            <SelectField label="Specialty / HCP Type" value={selection.hcpType} options={PREDICTIVE_SELECTOR_OPTIONS.hcpType} onChange={setField("hcpType")} />
            <SelectField label="Journey Stage" value={selection.journeyStage} options={PREDICTIVE_SELECTOR_OPTIONS.journeyStage} onChange={setField("journeyStage")} />
            <SelectField label="Interaction Pressure" value={selection.interactionPressure} options={PREDICTIVE_SELECTOR_OPTIONS.interactionPressure} onChange={setField("interactionPressure")} />
            <SelectField label="Influence Driver" value={selection.influenceDriver} options={PREDICTIVE_SELECTOR_OPTIONS.influenceDriver} onChange={setField("influenceDriver")} />
            <SelectField label="Behavior Archetype" value={selection.behaviorArchetype} options={PREDICTIVE_SELECTOR_OPTIONS.behaviorArchetype} onChange={setField("behaviorArchetype")} />
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(222 46% 25%)" }}>
                Load Scenario Preset
              </label>
              <select
                value={presetName}
                onChange={(e) => loadPreset(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,249,0.98) 100%)",
                  border: "1.5px solid rgba(92, 135, 165, 0.42)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78), 0 1px 3px rgba(14, 24, 43, 0.03)",
                }}
              >
                <option value="">Choose preset...</option>
                {Object.keys(scenarioPredictivePresets).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Sandbox rules</p>
              <p className="mt-1 leading-6">
                The model is standalone, the response test is sandbox-only, and the simulator / scoring stack remains untouched.
              </p>
            </div>
          </div>
        </div>

        {!allSelected && (
          <div className="rounded-2xl p-5 text-sm" style={{ background: "rgba(30, 64, 175, 0.07)", border: "1px solid rgba(30, 64, 175, 0.2)", color: "hsl(220 30% 32%)" }}>
            Select all six fields to render the structured behavior model.
          </div>
        )}

        {model && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {modelSections.map((section) => (
              <SectionCard key={section.key} eyebrow={section.eyebrow} title={section.title} bullets={section.bullets} />
            ))}
          </div>
        )}

        {compatibilityProfile && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-900">Compatibility profile</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The legacy summary is still available for comparison, but the structured model above is the primary source of truth.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Mindset</p>
                <p className="mt-1 leading-6">{compatibilityProfile.mindset}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Likely objections</p>
                <p className="mt-1 leading-6">{compatibilityProfile.likelyObjections}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Language that works</p>
                <p className="mt-1 leading-6">{compatibilityProfile.languageThatWorks}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Rep approach</p>
                <p className="mt-1 leading-6">{compatibilityProfile.recommendedRepApproach}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-teal-600" />
              <h3 className="text-base font-semibold text-slate-900">Rep question</h3>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Enter exactly what the rep would ask. The sandbox HCP reply will be generated from the structured model only.
            </p>
            <textarea
              value={repQuestion}
              onChange={(e) => setRepQuestion(e.target.value)}
              placeholder="What would you say to the HCP?"
              className="mt-4 min-h-[124px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.76)" }}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleTestResponse}
                disabled={!model || !repQuestion.trim() || responseLoading}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "hsl(174 40% 16%)" }}
              >
                {responseLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Test HCP Response
              </button>
              <button
                type="button"
                onClick={() => {
                  setRepQuestion("");
                  setHcpResponse("");
                  setResponseError("");
                }}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Clear
              </button>
            </div>
          </div>

          <ResponsePanel response={hcpResponse} loading={responseLoading} error={responseError} />
        </div>
      </div>
    </div>
  );
}
