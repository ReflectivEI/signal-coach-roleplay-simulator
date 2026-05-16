import { useEffect, useMemo, useState } from "react";
import { Mic, MicOff, Sparkles, Save } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import { generateAdaptiveScenario, evaluateAdaptiveResponse, saveAdaptiveSession } from "./api";
import { useSpeechInput } from "./useSpeechInput";
import { clampTemperature, extractEightBehavioralMetricRows, isGenerateDisabled } from "./interactionState";
import { HCP_ROLE_OPTIONS, CONVERSATION_STAGE_OPTIONS, CHALLENGE_CONTEXT_OPTIONS, REALISM_LEVEL_LABELS, RPS_UI_LABELS } from "@/lib/rpsUserInputOptions";
import { mapUIToBrain, requireRealismContract } from "@/lib/scenarioInputResolver";

/**
 * @typedef {{
 *   scenario_id?: string,
 *   opening_scene?: string,
 *   hcp_statement_or_question?: string,
 *   cue_signal?: string,
 *   hcp_brain_summary?: Record<string, any>,
 *   conversation_memory?: Record<string, any>,
 *   hcp_state?: Record<string, any>
 * }} AdaptiveScenario
 */

/** @typedef {Record<string, any>} LooseRecord */

const defaults = {
    hcpType: "",
    stage: "",
    challenge: "",
};

/** @param {{ title: string; children: import("react").ReactNode }} props */
function DashboardCard({ title, children }) {
    return (
        <section className="si-dark-panel rounded-[24px] p-5">
            <h3 className="si-dark-title mb-4 text-sm font-semibold uppercase tracking-[0.14em]">{title}</h3>
            {children}
        </section>
    );
}

/** @param {{ label: string; children: import("react").ReactNode; tone?: "default" | "teal" }} props */
function InfoPanel({ label, children, tone = "default" }) {
    return (
        <div
            className="rounded-xl p-3 text-sm"
            style={{
                background: tone === "teal" ? "rgba(37,124,123,0.08)" : "rgba(20,56,89,0.05)",
                border: tone === "teal" ? "1px solid rgba(37,124,123,0.22)" : "1px solid rgba(92,135,165,0.26)",
                color: "hsl(222 38% 20%)",
            }}
        >
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "hsl(206 39% 30%)" }}>{label}</p>
            {children}
        </div>
    );
}

/** @param {string} state */
function describeCapabilityConsequence(state) {
    if (state === "Breakdown") return "This left the HCP's active barrier unresolved and stalled the exchange.";
    if (state === "Unstable") return "This weakened credibility and made the interaction harder to advance.";
    if (state === "Developing") return "This showed partial traction, but it did not move the interaction decisively.";
    if (state === "Effective") return "This supported forward movement and improved interaction quality.";
    if (state === "Strong") return "This clearly advanced credibility and next-step momentum.";
    return "This influenced the interaction, but the effect was not clearly differentiated.";
}

/** @param {number | null | undefined} value @param {string} positiveText @param {string} negativeText @param {string} neutralText */
function describeDelta(value, positiveText, negativeText, neutralText) {
    const numeric = Number(value ?? 0);
    if (numeric > 0) return positiveText;
    if (numeric < 0) return negativeText;
    return neutralText;
}

/** @param {number | null | undefined} value */
function describeLevel(value) {
    const numeric = Number(value ?? 0);
    if (numeric >= 8) return "very high";
    if (numeric >= 6) return "high";
    if (numeric >= 4) return "moderate";
    if (numeric >= 2) return "low";
    return "very low";
}

export default function AdaptiveRpsPage() {
    const [form, setForm] = useState(defaults);
    const [temperature, setTemperature] = useState(6);
    const [scenario, setScenario] = useState(/** @type {AdaptiveScenario | null} */ (null));
    const [conversationMemory, setConversationMemory] = useState(/** @type {LooseRecord | null} */ (null));
    const [hcpState, setHcpState] = useState(/** @type {LooseRecord | null} */ (null));
    const [repText, setRepText] = useState("");
    const [evaluation, setEvaluation] = useState(/** @type {LooseRecord | null} */ (null));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [savedId, setSavedId] = useState("");

    const speech = useSpeechInput();

    useEffect(() => {
        if (!speech.transcript) return;
        setRepText(speech.transcript);
    }, [speech.transcript]);

    const mappedUi = useMemo(() => {
        if (!form.hcpType || !form.stage || !form.challenge) return null;
        return mapUIToBrain({
            hcpType: form.hcpType,
            stage: form.stage,
            challenge: form.challenge,
            realism: temperature,
        });
    }, [form.challenge, form.hcpType, form.stage, temperature]);

    /** @param {keyof typeof defaults} key @param {string} value */
    function setFormField(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    const repTranscript = useMemo(() => {
        return (repText || "").trim();
    }, [repText]);

    const canonicalSelections = useMemo(() => ({
        hcpType: form.hcpType,
        stage: form.stage,
        challenge: form.challenge,
        realism: temperature,
    }), [form.challenge, form.hcpType, form.stage, temperature]);

    const disableGenerate = isGenerateDisabled(form, busy);
    const metricRows = extractEightBehavioralMetricRows(evaluation);
    const rankedMetricRows = useMemo(() => {
        return [...metricRows]
            .filter((row) => Number.isFinite(row.score))
            .sort((a, b) => (a.score ?? 99) - (b.score ?? 99));
    }, [metricRows]);
    const primaryMetric = rankedMetricRows[0] || null;
    const primaryFailureDriver = primaryMetric?.label || (evaluation?.missed_cues?.[0] ? "Cue Alignment" : "Interaction Progression");
    const primaryCapabilityState = primaryMetric?.state || "Developing";
    const behavioralDiagnosis = primaryMetric?.rationale
        || evaluation?.missed_cues?.[0]
        || evaluation?.delivery_issues?.[0]
        || "The response did not address the HCP's live barrier clearly enough to move the conversation.";
    const interactionConsequence = evaluation?.outcome_analysis?.progression_rationale
        || evaluation?.outcome_analysis?.outcome_rationale
        || evaluation?.delivery_impact_on_hcp?.likely_hcp_reaction
        || evaluation?.hcp_progression_explanation
        || "The interaction stayed selective and did not advance decisively.";
    const coachingDirection = evaluation?.coaching_feedback?.[0]
        || evaluation?.delivery_coaching?.recommended_delivery_adjustment
        || evaluation?.next_best_question
        || "Acknowledge the HCP's active barrier first, then ask one narrower follow-up question.";

    async function handleGenerateScenario() {
        if (!mappedUi) return;
        const contractRealism = requireRealismContract(temperature, "AdaptiveRpsPage generate realism");
        setBusy(true);
        setError("");
        setEvaluation(null);
        setSavedId("");
        try {
            const payload = {
                ...mappedUi.legacyAdaptivePayload,
                selected_dropdowns: {
                    ...canonicalSelections,
                    realism: contractRealism,
                },
                resolved_brain: mappedUi.resolvedFields,
                rep_selected_temperature: contractRealism,
                live_temperature: contractRealism,
                initial_temperature: contractRealism,
                temperature_shift_history: [],
                conversation_memory: conversationMemory || {},
            };
            const data = await generateAdaptiveScenario(payload);
            setScenario(data);
            setConversationMemory(data?.conversation_memory || null);
            setHcpState(data?.hcp_state || null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    }

    async function handleEvaluate() {
        if (!scenario) {
            setError("Generate a scenario first.");
            return;
        }
        if (!repTranscript) {
            setError("Provide a REP response by voice or text.");
            return;
        }

        if (!mappedUi) {
            setError("Complete the 4 canonical controls (3 selectors + realism) before evaluating.");
            return;
        }

        setBusy(true);
        setError("");
        setSavedId("");

        try {
            const contractRealism = requireRealismContract(temperature, "AdaptiveRpsPage evaluate realism");
            const result = await evaluateAdaptiveResponse({
                scenario_id: scenario.scenario_id,
                scenario_context: scenario,
                rep_response_transcript: repTranscript,
                voice_metadata: speech.voiceMetadata,
                selected_dropdowns: {
                    ...canonicalSelections,
                    realism: contractRealism,
                },
                rep_selected_temperature: contractRealism,
                live_temperature: contractRealism,
                initial_temperature: contractRealism,
                hcp_state: conversationMemory?.hcp_state || hcpState || scenario?.hcp_state || null,
                conversation_memory: {
                    ...(conversationMemory || scenario?.conversation_memory || {}),
                    hcp_state: conversationMemory?.hcp_state || hcpState || scenario?.hcp_state || null,
                },
            });
            setEvaluation(result);
            const newMemory = {
                ...(result?.conversation_memory || conversationMemory || {}),
                hcp_state: result?.hcp_state || conversationMemory?.hcp_state || null,
            };
            setConversationMemory(newMemory);
            setHcpState(result?.hcp_state || null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    }

    async function handleSave() {
        if (!scenario || !evaluation) {
            setError("Generate and evaluate before saving session.");
            return;
        }

        if (!mappedUi) {
            setError("Complete the 4 canonical controls (3 selectors + realism) before saving.");
            return;
        }

        setBusy(true);
        setError("");
        try {
            const contractRealism = requireRealismContract(temperature, "AdaptiveRpsPage save realism");
            const result = await saveAdaptiveSession({
                dropdown_selections: {
                    ...canonicalSelections,
                    realism: contractRealism,
                },
                temperature: contractRealism,
                initial_temperature: contractRealism,
                live_temperature: contractRealism,
                temperature_shift_history: [],
                scenario,
                transcript: repTranscript,
                voice_metadata: speech.voiceMetadata,
                scores: evaluation.metric_scores,
                metric_scores: evaluation.metric_scores,
                overall_score: evaluation.overall_score,
                score_rationale: evaluation.score_rationale,
                outcome_analysis: evaluation.outcome_analysis,
                conversation_memory: evaluation.conversation_memory || conversationMemory || {},
                hcp_state: evaluation.hcp_state || hcpState || null,
                coaching_feedback: evaluation.coaching_feedback,
                better_phrasing: evaluation.better_phrasing,
                next_best_question: evaluation.next_best_question,
                what_hcp_likely_heard: evaluation.what_hcp_likely_heard,
                improved_response_example: evaluation.improved_response_example,
                resolved_brain: mappedUi.resolvedFields,
            });
            setSavedId(result?.session_id || "saved");
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="si-dark-shell min-h-screen px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl space-y-4">
                <AppHeader maxWidthClassName="max-w-6xl" />

                <header
                    className="rounded-[24px] p-6"
                    style={{
                        background: "linear-gradient(135deg, hsl(222 52% 17%) 0%, hsl(174 28% 16%) 60%, hsl(174 35% 19%) 100%)",
                        border: "1px solid hsl(174 60% 52% / 0.3)",
                        boxShadow: "0 18px 40px rgba(14, 24, 43, 0.10)",
                    }}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-teal-200">Adaptive Behavioral Intelligence Engine</p>
                            <h1 className="text-2xl font-semibold text-slate-50">Real-Time HCP Interaction Lab</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-700">Evaluates what the REP said, how they said it, and whether the interaction advanced.</p>
                        </div>
                    </div>
                </header>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                    <DashboardCard title="Scenario Controls">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <label className="si-dark-label space-y-1 text-xs uppercase tracking-wide">
                                {RPS_UI_LABELS.hcpType}
                                <select
                                    value={form.hcpType}
                                    onChange={(e) => setFormField("hcpType", e.target.value)}
                                    className="si-dark-field w-full rounded-lg px-3 py-2 text-sm normal-case"
                                >
                                    <option value="">Select HCP profile</option>
                                    {HCP_ROLE_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="si-dark-label space-y-1 text-xs uppercase tracking-wide">
                                {RPS_UI_LABELS.stage}
                                <select
                                    value={form.stage}
                                    onChange={(e) => setFormField("stage", e.target.value)}
                                    className="si-dark-field w-full rounded-lg px-3 py-2 text-sm normal-case"
                                >
                                    <option value="">Select moment</option>
                                    {CONVERSATION_STAGE_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="si-dark-label space-y-1 text-xs uppercase tracking-wide">
                                {RPS_UI_LABELS.challenge}
                                <select
                                    value={form.challenge}
                                    onChange={(e) => setFormField("challenge", e.target.value)}
                                    className="si-dark-field w-full rounded-lg px-3 py-2 text-sm normal-case"
                                >
                                    <option value="">Select focus</option>
                                    {CHALLENGE_CONTEXT_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>{RPS_UI_LABELS.realism}</span>
                                <span className="rounded-md border border-[#44708c] bg-[#0a223a] px-2 py-1 font-semibold text-[#e8f5ff]">
                                    {temperature}/10 — {REALISM_LEVEL_LABELS[temperature] ?? ""}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={1}
                                max={10}
                                value={temperature}
                                onChange={(e) => setTemperature(clampTemperature(e.target.value))}
                                className="w-full accent-teal-400"
                            />
                        </div>

                        <p className="mt-4 text-xs text-slate-500">
                            Hidden fields are derived automatically from these four controls before the worker payload is built.
                        </p>

                        <button
                            type="button"
                            onClick={handleGenerateScenario}
                            disabled={disableGenerate}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-300 disabled:opacity-60"
                        >
                            <Sparkles className="h-4 w-4" />
                            Generate HCP Question
                        </button>
                    </DashboardCard>

                    <DashboardCard title="HCP Interaction Panel">
                        <p className="si-dark-muted text-xs uppercase tracking-wide">Opening scene</p>
                        <p className="si-dark-field mt-1 rounded-xl p-3 text-sm">
                            {scenario?.opening_scene || "Generate a scenario to begin."}
                        </p>

                        <p className="si-dark-muted mt-3 text-xs uppercase tracking-wide">HCP statement or question</p>
                        <p className="mt-1 rounded-xl p-3 text-sm" style={{ background: "rgba(37,124,123,0.08)", border: "1px solid rgba(37,124,123,0.22)", color: "hsl(222 38% 20%)" }}>
                            {scenario?.hcp_statement_or_question || "No prompt yet."}
                        </p>

                        <p className="si-dark-muted mt-3 text-xs uppercase tracking-wide">REP-only cue / signal</p>
                        <p className="mt-1 rounded-xl p-3 text-sm" style={{ background: "rgba(20,56,89,0.05)", border: "1px solid rgba(92,135,165,0.26)", color: "hsl(222 38% 20%)" }}>
                            {scenario?.cue_signal || "No cue signal yet."}
                        </p>

                        <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: "rgba(20,56,89,0.06)", border: "1px solid rgba(92,135,165,0.28)", color: "hsl(222 38% 20%)" }}>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "hsl(206 39% 30%)" }}>Powered by Predictive HCP Brain</p>
                            <p className="mt-1"><span className="font-semibold">Archetype:</span> {scenario?.hcp_brain_summary?.archetype || "Not generated"}</p>
                            <p><span className="font-semibold">Quality Test:</span> {scenario?.hcp_brain_summary?.quality_test_question || "Not generated"}</p>
                            <p><span className="font-semibold">Primary Trust Breaker:</span> {scenario?.hcp_brain_summary?.primary_trust_breaker || "Not generated"}</p>
                            <p><span className="font-semibold">Primary Credibility Driver:</span> {scenario?.hcp_brain_summary?.primary_credibility_driver || "Not generated"}</p>
                            <p><span className="font-semibold">Likely Objection:</span> {scenario?.hcp_brain_summary?.likely_objection || "Not generated"}</p>
                        </div>
                    </DashboardCard>
                </div>

                <div className="space-y-4">
                    <DashboardCard title="REP Response Capture (Voice + Text)">
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={speech.start}
                                disabled={!speech.isSupported || busy || speech.isListening}
                                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                                style={{ background: "rgba(37,124,123,0.10)", borderColor: "rgba(37,124,123,0.24)", color: "hsl(180 45% 28%)" }}
                            >
                                <Mic className="h-4 w-4" />
                                Start Mic
                            </button>
                            <button
                                type="button"
                                onClick={speech.stop}
                                disabled={!speech.isSupported || !speech.isListening}
                                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                                style={{ background: "rgba(20,56,89,0.06)", borderColor: "rgba(92,135,165,0.30)", color: "hsl(222 48% 22%)" }}
                            >
                                <MicOff className="h-4 w-4" />
                                Stop Mic
                            </button>
                        </div>

                        {speech.isListening && speech.transcript && (
                            <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(37,124,123,0.08)", border: "1px solid rgba(37,124,123,0.22)" }}>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "hsl(206 39% 30%)" }}>Live Voice Input</p>
                                <p className="text-sm text-teal-800 break-words">{speech.transcript}</p>
                            </div>
                        )}

                        <textarea
                            value={repText}
                            onChange={(e) => {
                                setRepText(e.target.value);
                                speech.setTranscript(e.target.value);
                            }}
                            placeholder="Enter REP response text here if you are not using microphone capture."
                            className="si-dark-field mt-3 h-28 w-full rounded-lg p-3 text-sm"
                        />

                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleEvaluate}
                                disabled={busy}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                style={{ background: "hsl(222 52% 24%)" }}
                            >
                                Evaluate REP Response
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={busy || !evaluation}
                                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                style={{ background: "hsl(174 45% 34%)" }}
                            >
                                <Save className="h-4 w-4" />
                                Save Session
                            </button>
                        </div>
                    </DashboardCard>

                    <DashboardCard title="Evaluation Dashboard">
                        {!evaluation ? (
                            <p className="si-dark-label text-sm">Run an evaluation to see capability-state diagnosis, interaction consequence, and coaching direction.</p>
                        ) : (
                            <div className="space-y-3 text-sm">
                                <div className="rounded-lg border border-teal-200 bg-teal-50/80 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-teal-700">Primary Failure Driver</p>
                                    <p className="font-semibold text-slate-800">{primaryFailureDriver}</p>
                                    <p className="mt-2 text-xs uppercase tracking-wide text-teal-700">Capability State</p>
                                    <p className="font-semibold text-slate-800">{primaryCapabilityState}</p>
                                    <p className="mt-2 text-xs uppercase tracking-wide text-teal-700">Behavioral Diagnosis</p>
                                    <p className="text-slate-800">{behavioralDiagnosis}</p>
                                    <p className="mt-2 text-xs uppercase tracking-wide text-teal-700">Interaction Consequence</p>
                                    <p className="text-slate-800">{interactionConsequence}</p>
                                    <p className="mt-2 text-xs uppercase tracking-wide text-teal-700">Coaching Direction</p>
                                    <p className="text-slate-800">{coachingDirection}</p>
                                </div>
                                <div className="si-dark-field rounded-lg p-3">
                                    <p className="si-dark-muted mb-2 text-xs uppercase tracking-wide">Capability Diagnosis (8)</p>
                                    <div className="space-y-1.5">
                                        {metricRows.map((row) => (
                                            <div key={row.key} className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2">
                                                <p>
                                                    <span className="font-semibold text-slate-800">{row.label} — {row.state}</span>
                                                </p>
                                                {row.rationale ? <p className="mt-1 text-slate-600">{row.rationale}</p> : null}
                                                <p className="mt-1 text-xs text-slate-500">{describeCapabilityConsequence(row.state)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white/70 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Outcome Read</p>
                                    <p><span className="font-semibold text-slate-700">Actual Outcome:</span> {evaluation.outcome_analysis?.actual_outcome || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-700">Conversation Advanced:</span> {evaluation.outcome_analysis?.conversation_advanced ? "Yes" : "No"}</p>
                                    <p><span className="font-semibold text-slate-700">Progression Rationale:</span> {evaluation.outcome_analysis?.progression_rationale || evaluation.outcome_analysis?.outcome_rationale || "Not available."}</p>
                                </div>
                                <p><span className="font-semibold text-slate-700">Strengths:</span> {evaluation.observed_strengths?.join(" | ") || "None"}</p>
                                <p><span className="font-semibold text-slate-700">Missed Cues:</span> {evaluation.missed_cues?.join(" | ") || "None"}</p>
                                <p><span className="font-semibold text-slate-700">Delivery Issues:</span> {evaluation.delivery_issues?.join(" | ") || "None"}</p>
                                <div className="rounded-lg border border-teal-200 bg-teal-50/80 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-teal-700">Delivery Impact on HCP</p>
                                    <p><span className="font-semibold text-slate-700">Perceived Listening:</span> {evaluation.voice_behavior_adaptation?.perceived_listening_signal || "unknown"}</p>
                                    <p><span className="font-semibold text-slate-700">Likely HCP Reaction:</span> {evaluation.delivery_impact_on_hcp?.likely_hcp_reaction || evaluation.voice_behavior_adaptation?.hcp_reaction_modifier || "hold"}</p>
                                    <p><span className="font-semibold text-slate-700">Interaction Pressure Effect:</span> {`${describeDelta(evaluation.voice_behavior_adaptation?.resistance_delta, "Resistance increased.", "Resistance eased.", "Resistance held steady.")} ${describeDelta(evaluation.voice_behavior_adaptation?.trust_delta, "Trust improved.", "Trust dropped.", "Trust held steady.")}`}</p>
                                    <p><span className="font-semibold text-slate-700">Delivery Tip:</span> {evaluation.delivery_coaching?.recommended_delivery_adjustment || "Acknowledge, pause, and ask one diagnostic question."}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white/75 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-700">HCP Brain Alignment</p>
                                    <p><span className="font-semibold text-slate-700">Quality Test Satisfied:</span> {evaluation.hcp_brain_alignment?.quality_test_satisfied ? "Yes" : "No"}</p>
                                    <p><span className="font-semibold text-slate-700">Credibility Drivers:</span> {(evaluation.hcp_brain_alignment?.credibility_drivers_demonstrated || []).join(" | ") || "None"}</p>
                                    <p><span className="font-semibold text-slate-700">Trust Breakers Triggered:</span> {(evaluation.hcp_brain_alignment?.trust_breakers_triggered || []).join(" | ") || "None"}</p>
                                    <p><span className="font-semibold text-slate-700">Likely Objections Addressed:</span> {evaluation.hcp_brain_alignment?.likely_objections_addressed ? "Yes" : "No"}</p>
                                    <p><span className="font-semibold text-slate-700">Recommended Approach Used:</span> {evaluation.hcp_brain_alignment?.recommended_rep_approach_used ? "Yes" : "No"}</p>
                                    <p><span className="font-semibold text-slate-700">Alignment Rationale:</span> {evaluation.hcp_brain_alignment?.alignment_rationale || "No rationale available."}</p>
                                </div>
                                <div className="rounded-lg border border-teal-200 bg-white/75 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-700">HCP Brain Coaching</p>
                                    <p><span className="font-semibold text-slate-700">Quality Test Feedback:</span> {evaluation.hcp_brain_coaching?.quality_test_feedback || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-700">Credibility Feedback:</span> {evaluation.hcp_brain_coaching?.credibility_driver_feedback || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-700">Trust Breaker Feedback:</span> {evaluation.hcp_brain_coaching?.trust_breaker_feedback || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-700">Objection Alignment Feedback:</span> {evaluation.hcp_brain_coaching?.objection_alignment_feedback || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-700">Recommended Rep Move:</span> {evaluation.hcp_brain_coaching?.recommended_rep_move_feedback || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-700">Grounded Improved Response:</span> {evaluation.hcp_brain_coaching?.improved_response_grounded_in_hcp_brain || "Not available."}</p>
                                </div>
                                <p><span className="font-semibold text-slate-700">Coaching:</span> {(evaluation.coaching_feedback || []).join(" | ")}</p>
                                <p><span className="font-semibold text-slate-700">Better Phrasing:</span> {evaluation.better_phrasing}</p>
                                <p><span className="font-semibold text-slate-700">Next Best Question:</span> {evaluation.next_best_question}</p>
                                <p><span className="font-semibold text-slate-700">What HCP Likely Heard:</span> {evaluation.what_hcp_likely_heard}</p>
                                <p><span className="font-semibold text-slate-700">Improved Response Example:</span> {evaluation.improved_response_example}</p>
                            </div>
                        )}

                        {savedId ? <p className="mt-3 text-sm text-emerald-300">Session saved: {savedId}</p> : null}
                    </DashboardCard>
                </div>

                {evaluation && (
                    <DashboardCard title="HCP State Progression">
                        <div className="space-y-3 text-sm">
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-lg border border-slate-200 bg-white/75 p-3 space-y-1">
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Resistance / Trust / Openness / Patience</p>
                                    {[
                                        { label: "Resistance", value: evaluation.hcp_state?.resistance_level, color: "bg-[#1c3458]" },
                                        { label: "Trust", value: evaluation.hcp_state?.trust_level, color: "bg-[#257c7b]" },
                                        { label: "Openness", value: evaluation.hcp_state?.openness_level, color: "bg-[#5c87a5]" },
                                        { label: "Patience", value: evaluation.hcp_state?.patience_level, color: "bg-[#39acac]" },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} className="flex items-center gap-2">
                                            <span className="w-20 text-xs text-slate-600">{label}</span>
                                            <div className="flex-1 rounded bg-slate-200 h-2">
                                                <div className={`h-2 rounded ${color}`} style={{ width: `${(Number(value) || 0) * 10}%` }} />
                                            </div>
                                            <span className="w-16 text-right text-xs font-semibold text-slate-600">{describeLevel(value)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white/75 p-3 space-y-1">
                                    <p className="text-xs uppercase tracking-wide text-slate-500">Conversation State</p>
                                    <p><span className="font-semibold text-slate-700">Stage:</span> {evaluation.hcp_state?.conversation_stage?.replace(/_/g, " ") || "—"}</p>
                                    <p><span className="font-semibold text-slate-700">Position:</span> {evaluation.hcp_state?.hcp_position?.replace(/_/g, " ") || "—"}</p>
                                    <p><span className="font-semibold text-slate-700">Rep Quality Read:</span> {evaluation.hcp_state?.last_rep_quality || "—"}</p>
                                    <p><span className="font-semibold text-slate-700">Response Type:</span> {evaluation.hcp_response_type?.replace(/_/g, " ") || "—"}</p>
                                </div>
                            </div>
                            {evaluation.hcp_state_delta && (
                                <div className="rounded-lg border border-slate-200 bg-white/75 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-700">State Delta (this turn)</p>
                                    <p><span className="font-semibold text-slate-700">Resistance:</span> {describeDelta(evaluation.hcp_state_delta.resistance_change, "increased", "eased", "held steady")}</p>
                                    <p><span className="font-semibold text-slate-700">Trust:</span> {describeDelta(evaluation.hcp_state_delta.trust_change, "improved", "dropped", "held steady")}</p>
                                    <p><span className="font-semibold text-slate-700">Stage Change:</span> {evaluation.hcp_state_delta.stage_change || "unchanged"}</p>
                                    <p><span className="font-semibold text-slate-700">Concern Movement:</span> {evaluation.hcp_state_delta.concern_movement?.replace(/_/g, " ") || "none"}</p>
                                    <p className="mt-1 text-slate-600">{evaluation.hcp_state_delta.reason}</p>
                                </div>
                            )}
                            <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-3">
                                <p className="mb-1 text-xs uppercase tracking-wide text-slate-700">Simulated HCP Next Response</p>
                                <p className="text-slate-700">{evaluation.simulated_hcp_next_response || "—"}</p>
                                {evaluation.hcp_progression_explanation && (
                                    <p className="mt-1 text-xs text-slate-500">{evaluation.hcp_progression_explanation}</p>
                                )}
                            </div>
                            {evaluation.hcp_state?.unresolved_concerns?.length > 0 && (
                                <div className="rounded-lg border border-slate-200 bg-white/75 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-700">Unresolved Concerns</p>
                                    {evaluation.hcp_state.unresolved_concerns.map((/** @type {string} */ c, /** @type {number} */ i) => (
                                        <p key={i} className="text-slate-700 text-xs">{c}</p>
                                    ))}
                                </div>
                            )}
                            {evaluation.hcp_state?.next_expected_rep_move && (
                                <div className="rounded-lg border border-slate-200 bg-white/75 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-700">Next Expected REP Move</p>
                                    <p className="text-slate-700">{evaluation.hcp_state.next_expected_rep_move}</p>
                                </div>
                            )}
                        </div>
                    </DashboardCard>
                )}

                {error ? <p className="rounded-lg border border-slate-200 bg-white/75 p-3 text-sm text-slate-700">{error}</p> : null}
            </div>
        </div>
    );
}
