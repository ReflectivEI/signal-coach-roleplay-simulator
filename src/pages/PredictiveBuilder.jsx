import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BrainCircuit, ChevronDown, ChevronUp, FlaskConical, Loader2, MessageSquareText, Stethoscope } from "lucide-react";
import EnterpriseBanner from "@/components/layout/EnterpriseBanner";
import { buildPredictiveProfile, PREDICTIVE_SELECTOR_OPTIONS } from "@/lib/predictiveBuilderModel";
import { checkWorkerHealth, invokeWorkerText, invokeWorkerJsonRawPayload, listEvidenceRecords } from "@/services/workerClient";
import { invokeWorkerJsonWithRetry } from "@/services/workerJsonRetryHandler";
import { getWorkerHealthReport, shouldAttemptWorkerSynthesis } from "@/services/workerOfflineSafeguard";
import { getProfileMemory, recordProfileInteraction } from "@/lib/predictiveMemoryStore";
import {
  buildSelectorLabels,
  buildSpecialistSystemPrompt,
  buildSynthesisUserPrompt,
  resolveSpecialistPersona,
} from "@/lib/specialistSynthesisPrompts";
import { PREDICTIVE_SYNTHESIS_RESPONSE_SCHEMA } from "@/lib/predictiveSynthesisSchema";
import { normalizeHcpSpokenText } from "@/lib/hcpResponseText";

const DEV_DEBUG_SYNTHESIS = import.meta?.env?.DEV && localStorage?.getItem("DEBUG_SYNTHESIS") === "true";

function debugLog(label, data) {
  if (!DEV_DEBUG_SYNTHESIS) return;
  console.log(`[PredictiveBuilder] ${label}`, data);
}

const INITIAL_SELECTION = {
  diseaseState: "",
  hcpType: "",
  journeyStage: "",
  interactionPressure: "",
  influenceDriver: "",
  behaviorArchetype: "",
};

const CHATBOT_STYLE_PATTERNS = [
  /\bi appreciate your willingness\b/i,
  /\bi understand your concern, and\b/i,
  /\bi would like to confirm\b/i,
  /\bthis will help me better understand\b/i,
  /\bcan you tell me what specific\b/i,
  /\bwhat specific aspects of\b/i,
  /\bparticularly in patients with\b/i,
  /\bi prioritize optimizing\b/i,
  /\bconsidering comorbidities like\b/i,
  /\bi need to see data on how your approach performs\b/i,
  /\bi want to make sure we're\b/i,
  /\bfor these patients, i'm focused on optimizing\b/i,
];

function cleanHcpReply(rawReply) {
  return normalizeHcpSpokenText(rawReply, 3);
}

function needsHumanToneRewrite(reply) {
  const line = cleanHcpReply(reply);
  if (!line) return true;
  if (line.split(/\s+/).length > 55) return true;
  return CHATBOT_STYLE_PATTERNS.some((pattern) => pattern.test(line));
}

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

export default function PredictiveBuilder() {
  const [selection, setSelection] = useState(INITIAL_SELECTION);
  const [repQuestion, setRepQuestion] = useState("");
  const [testReply, setTestReply] = useState("");
  const [testError, setTestError] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [workerStatus, setWorkerStatus] = useState("unknown");

  // AI synthesis state
  const [evidenceRecords, setEvidenceRecords] = useState([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [aiSynthesis, setAiSynthesis] = useState(null);
  const [synthesisError, setSynthesisError] = useState("");
  const [synthesisSource, setSynthesisSource] = useState(""); // "ai" | "static"
  const synthAbortRef = useRef(null);

  const allSelected = Object.values(selection).every(Boolean);

  const profile = useMemo(() => {
    if (!allSelected) return null;
    return buildPredictiveProfile(selection);
  }, [allSelected, selection]);

  const profileMemory = useMemo(() => {
    if (!allSelected) return null;
    return getProfileMemory(selection);
  }, [allSelected, selection, testReply]);

  const setField = (field) => (value) => setSelection((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search || "");
    const fromQuery = {
      diseaseState: params.get("diseaseState") || "",
      hcpType: params.get("hcpType") || "",
      journeyStage: params.get("journeyStage") || "",
      interactionPressure: params.get("interactionPressure") || "",
      influenceDriver: params.get("influenceDriver") || "",
      behaviorArchetype: params.get("behaviorArchetype") || "",
    };

    const hasAny = Object.values(fromQuery).some(Boolean);
    if (!hasAny) return;

    const validated = Object.fromEntries(
      Object.entries(fromQuery).map(([field, value]) => {
        const options = PREDICTIVE_SELECTOR_OPTIONS[field] || [];
        const allowed = new Set(options.map((item) => item.value));
        return [field, allowed.has(value) ? value : ""];
      }),
    );

    setSelection(validated);
  }, []);

  const getOptionLabel = (field, value) => {
    const options = PREDICTIVE_SELECTOR_OPTIONS[field] || [];
    const match = options.find((option) => option.value === value);
    return match?.label || value;
  };

  // ─── AI synthesis effect: fires when all 6 selectors are filled ──────────
  useEffect(() => {
    if (!allSelected || !profile) {
      setAiSynthesis(null);
      setSynthesisError("");
      setSynthesisSource("");
      setEvidenceRecords([]);
      return;
    }

    // Cancel any in-flight synthesis for a prior selection
    if (synthAbortRef.current) {
      synthAbortRef.current.cancelled = true;
    }
    const ticket = { cancelled: false };
    synthAbortRef.current = ticket;

    async function runSynthesis() {
      setIsSynthesizing(true);
      setSynthesisError("");
      setAiSynthesis(null);
      setSynthesisSource("");

      try {
        // Step 1: Pre-flight health check using safeguard
        const healthReport = await getWorkerHealthReport();
        if (ticket.cancelled) return;
        setWorkerStatus(healthReport.status);

        if (!shouldAttemptWorkerSynthesis(healthReport.status)) {
          setSynthesisSource("static");
          setSynthesisError(
            `⚠️ ${healthReport.message} Start \`npm run worker:dev\` to enable AI synthesis.`
          );
          debugLog("runSynthesis", `Worker unavailable: ${healthReport.message}`);
          return;
        }

        debugLog("runSynthesis", `Worker status: ${healthReport.status}`);

        // Step 2: Fetch evidence records for this disease state
        let records = [];
        try {
          records = await listEvidenceRecords({
            diseaseState: selection.diseaseState,
            limit: 10,
          });
        } catch {
          // Non-fatal — synthesis proceeds without evidence records
          records = [];
        }
        if (ticket.cancelled) return;
        setEvidenceRecords(records);

        // Step 3: Build prompts using the specialist synthesis framework
        const selectorLabels = buildSelectorLabels(selection, getOptionLabel);
        const systemPrompt = buildSpecialistSystemPrompt(selection);
        const userPrompt = buildSynthesisUserPrompt(selection, records, profile, selectorLabels);

        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

        // Step 4: Invoke worker for structured synthesis with aggressive retry and recovery
        const synthesized = await invokeWorkerJsonWithRetry({
          invokerFn: async (temp) =>
            invokeWorkerJsonRawPayload({
              prompt: fullPrompt,
              response_json_schema: PREDICTIVE_SYNTHESIS_RESPONSE_SCHEMA,
              max_tokens: 3200,
              temperature: temp,
              roleplay: false,
            }),
          maxRetries: 5,
          temperature: 0.18,
          onRetry: (retryInfo) => {
            debugLog("Synthesis retry", retryInfo);
          },
        });
        if (ticket.cancelled) return;

        if (synthesized && synthesized.sections) {
          setAiSynthesis(synthesized);
          setSynthesisSource("ai");
        } else {
          setSynthesisSource("static");
          setSynthesisError(
            "AI synthesis returned unexpected structure despite recovery attempts — this indicates a service-level issue, not a formatting mismatch."
          );
        }
      } catch (err) {
        if (ticket.cancelled) return;
        setSynthesisSource("static");

        // Categorize the error type
        const isRetryExhausted = err?.code === "WORKER_JSON_RETRY_EXHAUSTED";
        const isNetworkError = err?.name === "AbortError" || String(err?.message || "").includes("timed out");
        const isServiceError = isNetworkError || (err?.code === "ECONNREFUSED");

        if (isRetryExhausted && !isServiceError) {
          // All extraction+parse retries failed: this is a persistent formatting issue
          setSynthesisError(
            "⚠️ PERSISTENT JSON FORMATTING ISSUE: Worker is returning non-recoverable output format. This requires worker/model configuration adjustment."
          );
        } else if (isServiceError) {
          // Actual service failure (network, worker down, etc.)
          setSynthesisError("Worker service unavailable — showing deterministic profile. Retry when service recovers.");
        } else {
          setSynthesisError(`AI synthesis failed: ${String(err?.message || "").slice(0, 80)}…`);
        }
      } finally {
        if (!ticket.cancelled) {
          setIsSynthesizing(false);
        }
      }
    }

    runSynthesis();

    return () => {
      ticket.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSelected, selection.diseaseState, selection.hcpType, selection.journeyStage, selection.interactionPressure, selection.influenceDriver, selection.behaviorArchetype]);

  // ─── Derive the active card data (AI synthesis or static fallback) ────────
  const activeCard = aiSynthesis || (profile ? {
    sections: profile.sections,
    hcpPerspective: null,
    repPreparation: null,
    evidenceHighlights: [],
    synthesisConfidence: "static",
  } : null);

  // ─── Test HCP Response ────────────────────────────────────────────────────
  const handleTestHcpResponse = async () => {
    if (!profile || !repQuestion.trim() || isTesting) return;

    setIsTesting(true);
    setTestError("");

    try {
      const health = await checkWorkerHealth();
      setWorkerStatus(health);

      if (health === "offline") {
        throw new Error("Worker is offline. Start it with `npm run worker:dev` and keep `npm run dev` running.");
      }

      // Build HCP context — use AI synthesis if available for richer realism
      const hcpInternalMonologue = aiSynthesis?.hcpPerspective?.internalMonologue || "";
      const clinicianVoiceCue = aiSynthesis?.sections?.responseStyle?.hcpLens || "";
      const trustBreakers = (aiSynthesis?.hcpPerspective?.trustBreakers || []).slice(0, 3).join(" | ");
      const equalityTestQ = aiSynthesis?.hcpPerspective?.equalityTestQuestion || "";

      const synthesisContext = aiSynthesis
        ? `
AI-synthesized specialist context (use this as the ground truth for this clinician's voice):
- Internal monologue: ${hcpInternalMonologue}
- Voice cue: ${clinicianVoiceCue}
- Trust breakers this rep must avoid: ${trustBreakers}
- The question this clinician is internally testing: ${equalityTestQ}
- Mindset headline: ${aiSynthesis.sections?.mindset?.headline || ""}
- Objections headline: ${aiSynthesis.sections?.objections?.headline || ""}
- Response style headline: ${aiSynthesis.sections?.responseStyle?.headline || ""}
`
        : `
Deterministic profile context:
- Mindset: ${profile.mindset}
- Likely objections: ${profile.likelyObjections}
- Predicted response style: ${profile.predictedResponseStyle}
- Profile intelligence: ${(profile.sections?.mindset?.keyFactors || []).join(" | ")}
`;

      const prompt = `You are simulating one realistic HCP reply in a pharma role-play training session.

HCP profile:
- Disease state: ${getOptionLabel("diseaseState", selection.diseaseState)}
- HCP type: ${getOptionLabel("hcpType", selection.hcpType)}
- Journey stage: ${getOptionLabel("journeyStage", selection.journeyStage)}
- Interaction pressure: ${getOptionLabel("interactionPressure", selection.interactionPressure)}
- Influence driver: ${getOptionLabel("influenceDriver", selection.influenceDriver)}
- Behavior archetype: ${getOptionLabel("behaviorArchetype", selection.behaviorArchetype)}
${synthesisContext}
Continuous learning memory:
- Prior interaction count: ${profileMemory?.interactionCount || 0}
- Recurring signals: ${(profileMemory?.recurringSignals || []).join(" | ") || "none yet"}
- Recent HCP phrasing: ${(profileMemory?.recentInteractions || []).slice(0, 2).map((item) => item.hcpReply).join(" | ") || "none yet"}

Rep message:
${repQuestion.trim()}

Rules:
- Respond as the HCP only, in first-person clinician voice.
- Keep it 1-3 short spoken sentences.
- Sound like a real clinician under time pressure — not polished writing.
- Use concrete practice language specific to this specialty.
- Reflect the behavior archetype and pressure level naturally.
- Use standard written English punctuation for readability (avoid run-on sentences; split distinct thoughts into separate sentences).
- Avoid stiff/formal constructions; prefer natural spoken clinician phrasing with normal contractions when appropriate.
- Do not start with filler setups like "So I want to make sure..." or other meta framing that sounds like narrated reasoning instead of direct clinician speech.
- Do not include bullet points, markdown, labels, numbering, or meta commentary.

Return only the HCP reply text.`;

      let nextReply = await invokeWorkerText({
        prompt,
        max_tokens: 200,
        temperature: 0.35,
        roleplay: true,
      });

      if (needsHumanToneRewrite(nextReply)) {
        const rewritePrompt = `Rewrite this line as a realistic spoken HCP response.

Constraints:
- Keep same meaning and stance.
- Keep it under 3 short sentences.
- Make it sound like a real clinician in a live conversation.
- Use standard written punctuation and split run-ons into short readable sentences.
- De-formalize wording into realistic spoken clinician language; keep grammar clean and natural.
- Remove clinician-unrealistic lead-ins such as "So I want to make sure..." and rewrite them into direct spoken language.
- No markdown, bullets, labels, numbering, or analysis.

Original:
${nextReply}

Return only rewritten response text.`;

        nextReply = await invokeWorkerText({
          prompt: rewritePrompt,
          max_tokens: 130,
          temperature: 0.25,
          roleplay: true,
        });
      }

      const cleanedReply = cleanHcpReply(nextReply);
      setTestReply(cleanedReply);
      recordProfileInteraction(selection, {
        repMessage: repQuestion,
        hcpReply: cleanedReply,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate HCP response.";
      setTestError(message);
      setTestReply("");
    } finally {
      setIsTesting(false);
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
        <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="transition-colors" style={{ color: "hsl(222 52% 24%)" }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="font-semibold" style={{ color: "hsl(222 48% 22%)" }}>Predictive HCP Builder</span>
            {isSynthesizing && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(19, 78, 74, 0.1)", color: "hsl(173 42% 28%)", border: "1px solid rgba(19, 78, 74, 0.22)" }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Synthesizing {resolveSpecialistPersona(selection).title}...
              </span>
            )}
            {synthesisSource === "ai" && !isSynthesizing && (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(19, 78, 74, 0.1)", color: "hsl(173 42% 28%)", border: "1px solid rgba(19, 78, 74, 0.22)" }}>
                <Stethoscope className="w-3 h-3" />
                AI specialist synthesis active
              </span>
            )}
          </div>
          <p className="text-xs shrink-0" style={{ color: "hsl(215 18% 46%)" }}>Worker: {workerStatus}</p>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 py-8 space-y-6">
        <EnterpriseBanner
          title="Predictive HCP Builder"
          subtitle="AI-synthesized dual-perspective profile — clinician intelligence and rep preparation from a specialist lens."
        />

        {/* ── Selectors ── */}
        <div
          className="rounded-[24px] p-6 space-y-5"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
            border: "1.5px solid rgba(92, 135, 165, 0.36)",
            boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <SelectField label="Disease State" value={selection.diseaseState} options={PREDICTIVE_SELECTOR_OPTIONS.diseaseState} onChange={setField("diseaseState")} />
            <SelectField label="Specialty / HCP Type" value={selection.hcpType} options={PREDICTIVE_SELECTOR_OPTIONS.hcpType} onChange={setField("hcpType")} />
            <SelectField label="Journey Stage" value={selection.journeyStage} options={PREDICTIVE_SELECTOR_OPTIONS.journeyStage} onChange={setField("journeyStage")} />
            <SelectField label="Interaction Pressure" value={selection.interactionPressure} options={PREDICTIVE_SELECTOR_OPTIONS.interactionPressure} onChange={setField("interactionPressure")} />
            <SelectField label="Influence Driver" value={selection.influenceDriver} options={PREDICTIVE_SELECTOR_OPTIONS.influenceDriver} onChange={setField("influenceDriver")} />
            <SelectField label="Behavior Archetype" value={selection.behaviorArchetype} options={PREDICTIVE_SELECTOR_OPTIONS.behaviorArchetype} onChange={setField("behaviorArchetype")} />
          </div>
        </div>

        {!allSelected && (
          <div className="rounded-2xl p-5 text-sm" style={{ background: "rgba(30, 64, 175, 0.07)", border: "1px solid rgba(30, 64, 175, 0.2)", color: "hsl(220 30% 32%)" }}>
            Select all six fields to render the Predictive Profile Card with AI specialist synthesis.
          </div>
        )}

        {/* ── Synthesis loading state ── */}
        {allSelected && isSynthesizing && (
          <div
            className="rounded-[24px] p-8 flex flex-col items-center justify-center gap-4 text-center"
            style={{
              background: "linear-gradient(180deg, hsl(222 44% 17%) 0%, hsl(215 42% 18%) 100%)",
              border: "1px solid rgba(66, 132, 145, 0.45)",
              minHeight: 220,
            }}
          >
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "hsl(169 56% 66%)" }} />
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color: "hsl(193 35% 90%)" }}>
                AI Specialist Synthesis Running
              </p>
              <p className="text-xs" style={{ color: "hsl(193 35% 70%)" }}>
                Acting as {resolveSpecialistPersona(selection).title} — consolidating all 6 profile dimensions into dual-perspective clinical intelligence...
              </p>
            </div>
            {evidenceRecords.length > 0 && (
              <p className="text-xs" style={{ color: "hsl(169 56% 58%)" }}>
                {evidenceRecords.length} evidence record{evidenceRecords.length !== 1 ? "s" : ""} loaded from store
              </p>
            )}
          </div>
        )}

        {/* ── Synthesis error / fallback notice ── */}
        {synthesisError && !isSynthesizing && (
          <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(180, 120, 20, 0.08)", border: "1px solid rgba(180, 120, 20, 0.28)", color: "hsl(38 62% 34%)" }}>
            {synthesisError}
          </div>
        )}

        {/* ── Main profile card ── */}
        {activeCard && !isSynthesizing && (
          <div className="space-y-5">

            {/* ── Predictive Profile Card ── */}
            <div
              className="rounded-[24px] p-6"
              style={{
                background: "linear-gradient(180deg, hsl(222 44% 17%) 0%, hsl(215 42% 18%) 100%)",
                border: "1px solid rgba(66, 132, 145, 0.45)",
                boxShadow: "0 18px 38px rgba(15, 23, 42, 0.16)",
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                <div className="flex items-center gap-2" style={{ color: "hsl(169 56% 66%)" }}>
                  <BrainCircuit className="w-4 h-4" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider">Predictive Profile Card</h2>
                </div>
                {synthesisSource === "ai" && (
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(66, 132, 145, 0.25)", color: "hsl(169 56% 72%)", border: "1px solid rgba(66, 132, 145, 0.35)" }}>
                    Specialist-synthesized · {evidenceRecords.length > 0 ? `${evidenceRecords.length} evidence records ingested` : "specialist knowledge base"}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <DualPerspectiveSectionCard label="HCP Mindset" section={activeCard.sections?.mindset} isAi={synthesisSource === "ai"} />
                <DualPerspectiveSectionCard label="Likely Objections" section={activeCard.sections?.objections} isAi={synthesisSource === "ai"} />
                <DualPerspectiveSectionCard label="Pressure Signals" section={activeCard.sections?.pressure} isAi={synthesisSource === "ai"} />
                <DualPerspectiveSectionCard label="Red Flags" section={activeCard.sections?.redFlags} isAi={synthesisSource === "ai"} />
                <DualPerspectiveSectionCard label="Language That Works" section={activeCard.sections?.languageWorks} isAi={synthesisSource === "ai"} />
                <DualPerspectiveSectionCard label="Language That Triggers Resistance" section={activeCard.sections?.languageResistance} isAi={synthesisSource === "ai"} />
                <DualPerspectiveSectionCard label="Predicted Response Style" section={activeCard.sections?.responseStyle} isAi={synthesisSource === "ai"} />
                <DualPerspectiveSectionCard label="Recommended REP Approach" section={activeCard.sections?.repApproach} isAi={synthesisSource === "ai"} />
              </div>
            </div>

            {/* ── HCP Perspective + Rep Preparation panels (AI only) ── */}
            {synthesisSource === "ai" && activeCard.hcpPerspective && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* HCP Perspective */}
                <div
                  className="rounded-[24px] p-6 space-y-4"
                  style={{
                    background: "linear-gradient(180deg, hsl(172 38% 14%) 0%, hsl(173 36% 16%) 100%)",
                    border: "1px solid rgba(66, 145, 132, 0.45)",
                    boxShadow: "0 14px 32px rgba(14, 24, 43, 0.12)",
                  }}
                >
                  <div className="flex items-center gap-2" style={{ color: "hsl(169 56% 66%)" }}>
                    <Stethoscope className="w-4 h-4" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Clinician Perspective</h3>
                  </div>
                  <p className="text-xs italic" style={{ color: "hsl(169 56% 72%)", lineHeight: 1.55 }}>
                    "{activeCard.hcpPerspective.internalMonologue}"
                  </p>
                  {activeCard.hcpPerspective.equalityTestQuestion && (
                    <div className="rounded-xl px-3.5 py-3 space-y-1" style={{ background: "rgba(66, 145, 132, 0.15)", border: "1px solid rgba(66, 145, 132, 0.3)" }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(169 56% 66%)" }}>Equality test question</p>
                      <p className="text-sm" style={{ color: "hsl(193 35% 90%)", lineHeight: 1.5 }}>
                        {activeCard.hcpPerspective.equalityTestQuestion}
                      </p>
                    </div>
                  )}
                  <SectionList
                    title="What registers as clinical credibility"
                    items={activeCard.hcpPerspective.credibilitySignals}
                    color="hsl(193 35% 88%)"
                    labelColor="hsl(169 56% 66%)"
                  />
                  <SectionList
                    title="What immediately breaks trust"
                    items={activeCard.hcpPerspective.trustBreakers}
                    color="hsl(0 40% 82%)"
                    labelColor="hsl(0 56% 66%)"
                  />
                </div>

                {/* Rep Preparation */}
                <div
                  className="rounded-[24px] p-6 space-y-4"
                  style={{
                    background: "linear-gradient(180deg, hsl(222 44% 16%) 0%, hsl(218 40% 18%) 100%)",
                    border: "1px solid rgba(92, 135, 165, 0.45)",
                    boxShadow: "0 14px 32px rgba(14, 24, 43, 0.12)",
                  }}
                >
                  <div className="flex items-center gap-2" style={{ color: "hsl(210 56% 72%)" }}>
                    <FlaskConical className="w-4 h-4" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">Rep Preparation Intelligence</h3>
                  </div>
                  {activeCard.repPreparation?.conversationFrame && (
                    <p className="text-xs" style={{ color: "hsl(210 35% 80%)", lineHeight: 1.55 }}>
                      {activeCard.repPreparation.conversationFrame}
                    </p>
                  )}
                  <SectionList
                    title="Pre-call must-know"
                    items={activeCard.repPreparation?.preCallIntel}
                    color="hsl(210 35% 88%)"
                    labelColor="hsl(210 56% 72%)"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SectionList
                      title="Say this"
                      items={activeCard.repPreparation?.languageDos}
                      color="hsl(169 35% 82%)"
                      labelColor="hsl(169 56% 66%)"
                    />
                    <SectionList
                      title="Not this"
                      items={activeCard.repPreparation?.languageDonts}
                      color="hsl(0 35% 82%)"
                      labelColor="hsl(0 56% 68%)"
                    />
                  </div>
                  {activeCard.repPreparation?.winCondition && (
                    <div className="rounded-xl px-3.5 py-3 space-y-1" style={{ background: "rgba(92, 135, 165, 0.18)", border: "1px solid rgba(92, 135, 165, 0.35)" }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(210 56% 72%)" }}>Win condition for this interaction</p>
                      <p className="text-sm" style={{ color: "hsl(193 35% 90%)", lineHeight: 1.5 }}>
                        {activeCard.repPreparation.winCondition}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Evidence highlights (AI only) ── */}
            {synthesisSource === "ai" && activeCard.evidenceHighlights?.length > 0 && (
              <div
                className="rounded-[24px] p-6 space-y-4"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
                  border: "1.5px solid rgba(92, 135, 165, 0.36)",
                  boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
                }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "hsl(222 48% 22%)" }}>
                    Evidence Highlights — Clinical Application
                  </h3>
                  <Link
                    to="/predictive-builder/references"
                    className="text-xs font-semibold underline"
                    style={{ color: "hsl(198 57% 35%)" }}
                  >
                    Full References Appendix
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeCard.evidenceHighlights.map((highlight, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl p-3.5 space-y-2"
                      style={{ background: "rgba(20, 56, 89, 0.06)", border: "1px solid rgba(92, 135, 165, 0.28)" }}
                    >
                      <p className="text-xs font-semibold" style={{ color: "hsl(206 39% 28%)", lineHeight: 1.4 }}>
                        {highlight.title}
                      </p>
                      <p className="text-xs" style={{ color: "hsl(213 20% 38%)", lineHeight: 1.5 }}>
                        {highlight.clinicalApplication}
                      </p>
                      {highlight.repTranslation && (
                        <p className="text-xs italic" style={{ color: "hsl(198 40% 35%)", lineHeight: 1.5 }}>
                          Rep: {highlight.repTranslation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Evidence & Market Intelligence (static fallback or supplement) ── */}
            {profile && synthesisSource !== "ai" && (
              <div
                className="rounded-[24px] p-6 space-y-4"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
                  border: "1.5px solid rgba(92, 135, 165, 0.36)",
                  boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
                }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "hsl(222 48% 22%)" }}>
                    Evidence and Market Intelligence Signals
                  </h3>
                  <Link
                    to="/predictive-builder/references"
                    className="text-xs font-semibold underline"
                    style={{ color: "hsl(198 57% 35%)" }}
                  >
                    References Appendix
                  </Link>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  <InfoListCard title="Publication themes to monitor" items={profile.evidenceIntel?.publicationThemes || []} />
                  <InfoListCard title="Strategic interpretation" items={profile.evidenceIntel?.strategicNotes || []} />
                </div>
                <div className="rounded-xl p-3.5" style={{ background: "rgba(20, 56, 89, 0.06)", border: "1px solid rgba(92, 135, 165, 0.28)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(206 39% 30%)" }}>Credible source map</p>
                  <ul className="space-y-1.5 text-sm" style={{ color: "hsl(213 20% 33%)" }}>
                    {(profile.evidenceIntel?.sourceSignals || []).map((source) => (
                      <li key={source.name}>
                        - {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "hsl(198 57% 35%)", textDecoration: "underline" }}
                          >
                            {source.name}
                          </a>
                        ) : (
                          source.name
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* ── Test HCP Response ── */}
            <div
              className="rounded-[24px] p-6 space-y-4"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
                border: "1.5px solid rgba(92, 135, 165, 0.36)",
                boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
              }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2" style={{ color: "hsl(222 48% 22%)" }}>
                  <MessageSquareText className="w-4 h-4" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider">Test HCP Response</h2>
                </div>
                {synthesisSource === "ai" && (
                  <span className="text-xs" style={{ color: "hsl(173 42% 28%)" }}>
                    Grounded in specialist synthesis
                  </span>
                )}
              </div>

              <div className="rounded-xl px-3.5 py-3 text-xs" style={{ background: "rgba(19, 78, 74, 0.08)", border: "1px solid rgba(19, 78, 74, 0.24)", color: "hsl(173 42% 28%)" }}>
                Continuous learning memory: {profileMemory?.interactionCount || 0} prior tests | recurring signals: {(profileMemory?.recurringSignals || []).join(", ") || "none yet"}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(222 46% 25%)" }}>
                  Enter a rep message or question
                </label>
                <textarea
                  value={repQuestion}
                  onChange={(event) => setRepQuestion(event.target.value)}
                  rows={4}
                  placeholder="Example: If we focus on the highest-risk subgroup first, what would you need to see before trying this in one patient profile?"
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none resize-none"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,249,0.98) 100%)",
                    border: "1.5px solid rgba(92, 135, 165, 0.42)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78), 0 1px 3px rgba(14, 24, 43, 0.03)",
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleTestHcpResponse}
                disabled={isTesting || !repQuestion.trim()}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, hsl(222 48% 24%) 0%, hsl(188 61% 31%) 100%)",
                  color: "hsl(180 38% 96%)",
                  boxShadow: "0 12px 24px rgba(20, 58, 98, 0.22)",
                }}
              >
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareText className="w-4 h-4" />}
                Test HCP Response
              </button>

              {testError && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(220, 38, 38, 0.08)", border: "1px solid rgba(220, 38, 38, 0.28)", color: "hsl(0 62% 34%)" }}>
                  {testError}
                </div>
              )}

              {testReply && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: "linear-gradient(180deg, hsl(222 44% 17%) 0%, hsl(215 42% 18%) 100%)",
                    border: "1px solid rgba(66, 132, 145, 0.45)",
                    color: "hsl(193 35% 90%)",
                    lineHeight: 1.55,
                  }}
                >
                  {testReply}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * DualPerspectiveSectionCard
 * Shows a profile section with optional HCP Lens and Rep Lens perspective blocks.
 */
function DualPerspectiveSectionCard({ label, section, isAi = false }) {
  const [expanded, setExpanded] = useState(false);
  const [titleHovered, setTitleHovered] = useState(false);

  if (!section) {
    return (
      <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(138, 200, 210, 0.2)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(168 62% 74%)" }}>{label}</p>
        <p className="text-sm" style={{ color: "hsl(193 35% 90%)" }}>No data available.</p>
      </div>
    );
  }

  const hasPerspectives = isAi && (section.hcpLens || section.repLens);

  return (
    <div className="rounded-xl p-3.5 space-y-3" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(138, 200, 210, 0.2)" }}>
      <div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
          onMouseEnter={() => setTitleHovered(true)}
          onMouseLeave={() => setTitleHovered(false)}
          style={{
            color: titleHovered ? "hsl(175 62% 84%)" : "hsl(193 35% 96%)",
            border: "1px solid rgba(106, 227, 216, 0.45)",
            background: titleHovered ? "rgba(27, 120, 112, 0.24)" : "rgba(19, 78, 74, 0.14)",
            boxShadow: titleHovered ? "0 0 0 1px rgba(106, 227, 216, 0.12) inset" : "none",
            transition: "color 140ms ease, background 140ms ease, box-shadow 140ms ease",
          }}
        >
          {label}
        </span>
      </div>
      <SectionDisclosure title="Key factors" items={section.keyFactors} />
      <SectionDisclosure title="Predictive signals" items={section.predictiveSignals} />
      <SectionDisclosure title="Rep moves" items={section.repMoves} />

      {hasPerspectives && (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: "hsl(169 56% 66%)" }}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide perspectives" : "See dual-perspective breakdown"}
        </button>
      )}

      {hasPerspectives && expanded && (
        <div className="space-y-2 pt-1">
          {section.hcpLens && (
            <div className="rounded-lg px-3 py-2.5 space-y-1" style={{ background: "rgba(19, 78, 74, 0.14)", border: "1px solid rgba(66, 145, 132, 0.3)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "hsl(169 56% 66%)" }}>
                Clinician lens
              </p>
              <p className="text-xs" style={{ color: "hsl(169 56% 82%)", lineHeight: 1.5 }}>{section.hcpLens}</p>
            </div>
          )}
          {section.repLens && (
            <div className="rounded-lg px-3 py-2.5 space-y-1" style={{ background: "rgba(20, 56, 89, 0.16)", border: "1px solid rgba(92, 135, 165, 0.3)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "hsl(210 56% 72%)" }}>
                Rep lens
              </p>
              <p className="text-xs" style={{ color: "hsl(210 35% 86%)", lineHeight: 1.5 }}>{section.repLens}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionDisclosure({ title, items = [], color = "hsl(193 35% 88%)", labelColor = "hsl(169 56% 70%)" }) {
  const [open, setOpen] = useState(false);
  const visible = (items || []).slice(0, 5);

  return (
    <div className="rounded-lg px-2.5 py-2" style={{ border: "1px solid rgba(138, 200, 210, 0.16)", background: "rgba(255,255,255,0.03)" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-left" style={{ color: labelColor }}>
          {title}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" style={{ color: labelColor }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: labelColor }} />}
      </button>

      {open && visible.length > 0 && (
        <ul className="space-y-1.5 mt-2" style={{ color }}>
          {visible.map((item) => (
            <li key={`${title}-${item}`} className="flex items-start gap-2 text-sm" style={{ lineHeight: 1.45 }}>
              <span
                aria-hidden="true"
                className="mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "hsl(173 42% 52%)" }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {open && !visible.length && (
        <p className="text-xs mt-2" style={{ color: "hsl(193 24% 72%)" }}>No details available.</p>
      )}
    </div>
  );
}

function SectionList({ title, items = [], color = "hsl(193 35% 88%)", labelColor = "hsl(169 56% 70%)" }) {
  const visible = (items || []).slice(0, 5);
  if (!visible.length) return null;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: labelColor }}>
        {title}
      </p>
      <ul className="space-y-1" style={{ color }}>
        {visible.map((item) => (
          <li key={`${title}-${item}`} className="text-sm" style={{ lineHeight: 1.45 }}>
            - {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoListCard({ title, items = [] }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: "rgba(20, 56, 89, 0.06)", border: "1px solid rgba(92, 135, 165, 0.28)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(206 39% 30%)" }}>
        {title}
      </p>
      <ul className="space-y-1.5 text-sm" style={{ color: "hsl(213 20% 33%)" }}>
        {(items || []).slice(0, 5).map((item) => (
          <li key={`${title}-${item}`}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
