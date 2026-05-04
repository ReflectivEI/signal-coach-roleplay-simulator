import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mic, MicOff, Sparkles, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { generateAdaptiveScenario, evaluateAdaptiveResponse, saveAdaptiveSession } from "./api";
import { useSpeechInput } from "./useSpeechInput";
import { clampTemperature, extractEightBehavioralMetricRows, isGenerateDisabled } from "./interactionState";

const defaults = {
    hcp_profile: "",
    journey_stage: "",
    disease_state: "",
    interaction_pressure: "",
    hcp_type: "",
    behavior_archetype: "",
    influence_driver: "",
    access_barrier_context: "",
    rep_objective: "",
};

const SELECT_OPTIONS = {
    hcp_profile: [
        ["", "Select HCP profile"],
        ["community_time_pressed", "Community Clinician (Time-Pressed)"],
        ["skeptical_specialist", "Skeptical Specialist"],
        ["access_constrained_decision_maker", "Access-Constrained Decision Maker"],
        ["guideline_anchored_evaluator", "Guideline-Anchored Evaluator"],
        ["early_adopter_cautious", "Cautious Early Adopter"],
    ],
    journey_stage: [
        ["", "Select journey stage"],
        ["initial_access", "Initial Access"],
        ["discovery", "Discovery"],
        ["clinical_value", "Clinical Value"],
        ["objection_handling", "Objection Handling"],
        ["adoption_implementation", "Adoption Implementation"],
        ["access_formulary", "Access/Formulary"],
        ["commitment_close", "Commitment Close"],
    ],
    disease_state: [
        ["", "Select disease state"],
        ["pulmonology", "Pulmonology"],
        ["cardiology", "Cardiology"],
        ["oncology", "Oncology"],
        ["primary_care", "Primary Care"],
    ],
    interaction_pressure: [
        ["", "Select interaction pressure"],
        ["time_constrained", "Time Constrained"],
        ["operationally_constrained", "Operationally Constrained"],
        ["skeptical_resistant", "Skeptical / Resistant"],
        ["competitive_bias", "Competitive Bias"],
        ["safety_concern", "Safety Concern"],
        ["access_barrier", "Access Barrier"],
        ["curious_uncertain", "Curious / Uncertain"],
    ],
    hcp_type: [
        ["", "Select HCP type"],
        ["treating_clinician", "Treating Clinician"],
        ["influencer", "Influencer"],
        ["thought_leader", "Thought Leader"],
    ],
    behavior_archetype: [
        ["", "Select behavior archetype"],
        ["time_constrained_community_doctor", "Time-Constrained Community Doctor"],
        ["skeptical_specialist", "Skeptical Specialist"],
        ["curious_uncertain_adopter", "Curious Uncertain Adopter"],
        ["cost_focused_decision_maker", "Cost-Focused Decision Maker"],
    ],
    influence_driver: [
        ["", "Select influence driver"],
        ["patient_centric", "Patient-Centric"],
        ["evidence_driven", "Evidence-Driven"],
        ["risk_averse", "Risk-Averse"],
        ["guideline_anchored", "Guideline-Anchored"],
    ],
    access_barrier_context: [
        ["", "Select access barrier context"],
        ["none", "No Immediate Access Barrier"],
        ["prior_auth_volume", "High Prior Authorization Volume"],
        ["step_therapy_restriction", "Step-Therapy Restriction"],
        ["formulary_non_preferred", "Non-Preferred Formulary Status"],
        ["payer_policy_variability", "Payer Policy Variability"],
        ["staffing_limited_follow_up", "Limited Staff Follow-Up Capacity"],
    ],
    rep_objective: [
        ["", "Select REP objective"],
        ["establish_relevance", "Establish Relevance Quickly"],
        ["uncover_primary_blocker", "Uncover Primary Blocker"],
        ["validate_patient_fit", "Validate Patient Fit"],
        ["align_on_evidence", "Align on Evidence Threshold"],
        ["resolve_access_concern", "Resolve Access Concern"],
        ["secure_small_next_step", "Secure Small Next Step"],
    ],
};

function DashboardCard({ title, children }) {
    return (
        <section className="si-dark-panel rounded-2xl p-4">
            <h3 className="si-dark-title mb-3 text-sm font-semibold uppercase tracking-wide">{title}</h3>
            {children}
        </section>
    );
}

export default function AdaptiveRpsPage() {
    const [form, setForm] = useState(defaults);
    const [temperature, setTemperature] = useState(6);
    const [scenario, setScenario] = useState(null);
    const [conversationMemory, setConversationMemory] = useState(null);
    const [hcpState, setHcpState] = useState(null);
    const [repText, setRepText] = useState("");
    const [evaluation, setEvaluation] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [savedId, setSavedId] = useState("");

    const speech = useSpeechInput();

    useEffect(() => {
        if (!speech.transcript) return;
        setRepText(speech.transcript);
    }, [speech.transcript]);

    const repTranscript = useMemo(() => {
        return (repText || "").trim();
    }, [repText]);

    const disableGenerate = isGenerateDisabled(form, busy);
    const metricRows = extractEightBehavioralMetricRows(evaluation);

    async function handleGenerateScenario() {
        setBusy(true);
        setError("");
        setEvaluation(null);
        setSavedId("");
        try {
            const data = await generateAdaptiveScenario({
                ...form,
                hcp_default_temperature: 5,
                rep_selected_temperature: temperature,
                live_temperature: temperature,
                initial_temperature: temperature,
                temperature_shift_history: [],
                conversation_memory: conversationMemory || {},
            });
            setScenario(data);
            setConversationMemory(data?.conversation_memory || null);
            setHcpState(data?.hcp_state || null);
        } catch (err) {
            setError(String(err?.message || err));
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

        setBusy(true);
        setError("");
        setSavedId("");

        try {
            const result = await evaluateAdaptiveResponse({
                scenario_id: scenario.scenario_id,
                scenario_context: scenario,
                rep_response_transcript: repTranscript,
                voice_metadata: speech.voiceMetadata,
                selected_dropdowns: form,
                rep_selected_temperature: temperature,
                live_temperature: temperature,
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
            setError(String(err?.message || err));
        } finally {
            setBusy(false);
        }
    }

    async function handleSave() {
        if (!scenario || !evaluation) {
            setError("Generate and evaluate before saving session.");
            return;
        }

        setBusy(true);
        setError("");
        try {
            const result = await saveAdaptiveSession({
                dropdown_selections: form,
                temperature,
                initial_temperature: temperature,
                live_temperature: temperature,
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
            });
            setSavedId(result?.session_id || "saved");
        } catch (err) {
            setError(String(err?.message || err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="si-dark-shell min-h-screen px-4 py-6 md:px-8">
            <div className="mx-auto max-w-6xl space-y-4">
                <header className="si-dark-panel rounded-2xl bg-gradient-to-r from-slate-950/95 via-blue-950/90 to-teal-950/90 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-teal-200">Adaptive Behavioral Intelligence Engine</p>
                            <h1 className="text-2xl font-semibold">Real-Time HCP Interaction Lab</h1>
                            <p className="si-dark-label mt-1 text-sm">Evaluates what the REP said, how they said it, and whether the interaction advanced.</p>
                        </div>
                        <Link to="/" className="inline-flex items-center gap-2 rounded-lg border border-[#4f7e9a] px-3 py-2 text-sm text-slate-100 hover:bg-[#12314d]">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Library
                        </Link>
                    </div>
                </header>

                <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                    <DashboardCard title="Scenario Controls">
                        <div className="grid gap-3 sm:grid-cols-2">
                            {Object.entries(form).map(([key, value]) => (
                                <label key={key} className="si-dark-label space-y-1 text-xs uppercase tracking-wide">
                                    {key.replace(/_/g, " ")}
                                    {SELECT_OPTIONS[key] ? (
                                        <select
                                            value={value}
                                            onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                                            className="si-dark-field w-full rounded-lg px-3 py-2 text-sm normal-case"
                                        >
                                            {SELECT_OPTIONS[key].map(([optionValue, optionLabel]) => (
                                                <option key={optionValue || "empty"} value={optionValue}>
                                                    {optionLabel}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            value={value}
                                            onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                                            className="si-dark-field w-full rounded-lg px-3 py-2 text-sm normal-case"
                                        />
                                    )}
                                </label>
                            ))}
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span>REP Realism Lever</span>
                                <span className="rounded-md border border-[#44708c] bg-[#0a223a] px-2 py-1 font-semibold text-[#e8f5ff]">{temperature}/10</span>
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
                        <p className="si-dark-field mt-1 rounded-lg p-3 text-sm">
                            {scenario?.opening_scene || "Generate a scenario to begin."}
                        </p>

                        <p className="si-dark-muted mt-3 text-xs uppercase tracking-wide">HCP statement or question</p>
                        <p className="mt-1 rounded-lg border border-cyan-300/50 bg-cyan-400/18 p-3 text-sm text-cyan-50">
                            {scenario?.hcp_statement_or_question || "No prompt yet."}
                        </p>

                        <p className="si-dark-muted mt-3 text-xs uppercase tracking-wide">REP-only cue / signal</p>
                        <p className="mt-1 rounded-lg border border-amber-300/50 bg-amber-400/18 p-3 text-sm text-amber-50">
                            {scenario?.cue_signal || "No cue signal yet."}
                        </p>

                        <div className="mt-3 rounded-lg border border-violet-300/45 bg-violet-500/16 p-3 text-sm text-violet-50">
                            <p className="text-xs uppercase tracking-wide text-violet-100">Powered by Predictive HCP Brain</p>
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
                                className="inline-flex items-center gap-2 rounded-lg border border-teal-300/60 bg-teal-400/24 px-3 py-2 text-sm text-teal-50 hover:bg-teal-400/32 disabled:opacity-50"
                            >
                                <Mic className="h-4 w-4" />
                                Start Mic
                            </button>
                            <button
                                type="button"
                                onClick={speech.stop}
                                disabled={!speech.isSupported || !speech.isListening}
                                className="inline-flex items-center gap-2 rounded-lg border border-rose-300/60 bg-rose-400/24 px-3 py-2 text-sm text-rose-50 hover:bg-rose-400/32 disabled:opacity-50"
                            >
                                <MicOff className="h-4 w-4" />
                                Stop Mic
                            </button>
                        </div>

                        <textarea
                            value={repText}
                            onChange={(e) => {
                                setRepText(e.target.value);
                                speech.setTranscript(e.target.value);
                            }}
                            placeholder="Enter REP response text here if you are not using microphone capture."
                            className="si-dark-field mt-3 h-28 w-full rounded-lg p-3 text-sm"
                        />

                        <p className="si-dark-label mt-2 text-xs">Live speech transcript: {speech.transcript || "(none)"}</p>
                        <p className="si-dark-muted mt-1 text-xs">Voice metadata: {JSON.stringify(speech.voiceMetadata)}</p>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleEvaluate}
                                disabled={busy}
                                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-60"
                            >
                                Evaluate REP Response
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={busy || !evaluation}
                                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
                            >
                                <Save className="h-4 w-4" />
                                Save Session
                            </button>
                        </div>
                    </DashboardCard>

                    <DashboardCard title="Evaluation Dashboard">
                        {!evaluation ? (
                            <p className="si-dark-label text-sm">Run an evaluation to see scoring, cue alignment, delivery analysis, and coaching feedback.</p>
                        ) : (
                            <div className="space-y-3 text-sm">
                                <p className="text-lg font-semibold text-teal-200">Overall Score: {evaluation.overall_score}/10</p>
                                <div className="si-dark-field rounded-lg p-3">
                                    <p className="si-dark-muted mb-2 text-xs uppercase tracking-wide">Behavioral Metric Scores (8)</p>
                                    <div className="space-y-1.5">
                                        {metricRows.map((row) => (
                                            <p key={row.key}>
                                                <span className="font-semibold text-slate-100">{row.key}:</span> {row.score ?? "N/A"} {row.rationale ? `- ${row.rationale}` : ""}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                                <p><span className="font-semibold text-slate-200">Outcome:</span> {JSON.stringify(evaluation.outcome_analysis)}</p>
                                <p><span className="font-semibold text-slate-200">Strengths:</span> {evaluation.observed_strengths?.join(" | ") || "None"}</p>
                                <p><span className="font-semibold text-slate-200">Missed Cues:</span> {evaluation.missed_cues?.join(" | ") || "None"}</p>
                                <p><span className="font-semibold text-slate-200">Delivery Issues:</span> {evaluation.delivery_issues?.join(" | ") || "None"}</p>
                                <div className="rounded-lg border border-teal-300/40 bg-teal-500/16 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-teal-100">Delivery Impact on HCP</p>
                                    <p><span className="font-semibold text-slate-200">Perceived Listening:</span> {evaluation.voice_behavior_adaptation?.perceived_listening_signal || "unknown"}</p>
                                    <p><span className="font-semibold text-slate-200">Likely HCP Reaction:</span> {evaluation.delivery_impact_on_hcp?.likely_hcp_reaction || evaluation.voice_behavior_adaptation?.hcp_reaction_modifier || "hold"}</p>
                                    <p><span className="font-semibold text-slate-200">Resistance / Trust Impact:</span> {`${evaluation.voice_behavior_adaptation?.resistance_delta ?? 0} / ${evaluation.voice_behavior_adaptation?.trust_delta ?? 0}`}</p>
                                    <p><span className="font-semibold text-slate-200">Delivery Tip:</span> {evaluation.delivery_coaching?.recommended_delivery_adjustment || "Acknowledge, pause, and ask one diagnostic question."}</p>
                                </div>
                                <div className="rounded-lg border border-violet-300/40 bg-violet-500/16 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-violet-100">HCP Brain Alignment</p>
                                    <p><span className="font-semibold text-slate-200">Quality Test Satisfied:</span> {evaluation.hcp_brain_alignment?.quality_test_satisfied ? "Yes" : "No"}</p>
                                    <p><span className="font-semibold text-slate-200">Credibility Drivers:</span> {(evaluation.hcp_brain_alignment?.credibility_drivers_demonstrated || []).join(" | ") || "None"}</p>
                                    <p><span className="font-semibold text-slate-200">Trust Breakers Triggered:</span> {(evaluation.hcp_brain_alignment?.trust_breakers_triggered || []).join(" | ") || "None"}</p>
                                    <p><span className="font-semibold text-slate-200">Likely Objections Addressed:</span> {evaluation.hcp_brain_alignment?.likely_objections_addressed ? "Yes" : "No"}</p>
                                    <p><span className="font-semibold text-slate-200">Recommended Approach Used:</span> {evaluation.hcp_brain_alignment?.recommended_rep_approach_used ? "Yes" : "No"}</p>
                                    <p><span className="font-semibold text-slate-200">Alignment Rationale:</span> {evaluation.hcp_brain_alignment?.alignment_rationale || "No rationale available."}</p>
                                </div>
                                <div className="rounded-lg border border-emerald-300/40 bg-emerald-500/16 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-emerald-100">HCP Brain Coaching</p>
                                    <p><span className="font-semibold text-slate-200">Quality Test Feedback:</span> {evaluation.hcp_brain_coaching?.quality_test_feedback || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-200">Credibility Feedback:</span> {evaluation.hcp_brain_coaching?.credibility_driver_feedback || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-200">Trust Breaker Feedback:</span> {evaluation.hcp_brain_coaching?.trust_breaker_feedback || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-200">Objection Alignment Feedback:</span> {evaluation.hcp_brain_coaching?.objection_alignment_feedback || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-200">Recommended Rep Move:</span> {evaluation.hcp_brain_coaching?.recommended_rep_move_feedback || "Not available."}</p>
                                    <p><span className="font-semibold text-slate-200">Grounded Improved Response:</span> {evaluation.hcp_brain_coaching?.improved_response_grounded_in_hcp_brain || "Not available."}</p>
                                </div>
                                <p><span className="font-semibold text-slate-200">Voice Behavior Signals:</span> {JSON.stringify(evaluation.voice_behavior_signals || {})}</p>
                                <p><span className="font-semibold text-slate-200">Voice-to-Metric Mapping:</span> {JSON.stringify(evaluation.score_rationale?.voice_behavior_mapping || {})}</p>
                                <p><span className="font-semibold text-slate-200">Coaching:</span> {(evaluation.coaching_feedback || []).join(" | ")}</p>
                                <p><span className="font-semibold text-slate-200">Better Phrasing:</span> {evaluation.better_phrasing}</p>
                                <p><span className="font-semibold text-slate-200">Next Best Question:</span> {evaluation.next_best_question}</p>
                                <p><span className="font-semibold text-slate-200">What HCP Likely Heard:</span> {evaluation.what_hcp_likely_heard}</p>
                                <p><span className="font-semibold text-slate-200">Improved Response Example:</span> {evaluation.improved_response_example}</p>
                            </div>
                        )}

                        {savedId ? <p className="mt-3 text-sm text-emerald-300">Session saved: {savedId}</p> : null}
                    </DashboardCard>
                </div>

                {evaluation && (
                    <DashboardCard title="HCP State Progression">
                        <div className="space-y-3 text-sm">
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3 space-y-1">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Resistance / Trust / Openness / Patience</p>
                                    {[
                                        { label: "Resistance", value: evaluation.hcp_state?.resistance_level, color: "bg-rose-500" },
                                        { label: "Trust", value: evaluation.hcp_state?.trust_level, color: "bg-teal-500" },
                                        { label: "Openness", value: evaluation.hcp_state?.openness_level, color: "bg-sky-500" },
                                        { label: "Patience", value: evaluation.hcp_state?.patience_level, color: "bg-amber-400" },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} className="flex items-center gap-2">
                                            <span className="w-20 text-xs text-slate-300">{label}</span>
                                            <div className="flex-1 rounded bg-slate-800 h-2">
                                                <div className={`h-2 rounded ${color}`} style={{ width: `${(Number(value) || 0) * 10}%` }} />
                                            </div>
                                            <span className="w-6 text-right text-xs font-semibold">{value ?? "—"}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="rounded-lg border border-white/10 bg-slate-950/60 p-3 space-y-1">
                                    <p className="text-xs uppercase tracking-wide text-slate-400">Conversation State</p>
                                    <p><span className="font-semibold text-slate-200">Stage:</span> {evaluation.hcp_state?.conversation_stage?.replace(/_/g, " ") || "—"}</p>
                                    <p><span className="font-semibold text-slate-200">Position:</span> {evaluation.hcp_state?.hcp_position?.replace(/_/g, " ") || "—"}</p>
                                    <p><span className="font-semibold text-slate-200">Rep Quality Read:</span> {evaluation.hcp_state?.last_rep_quality || "—"}</p>
                                    <p><span className="font-semibold text-slate-200">Response Type:</span> {evaluation.hcp_response_type?.replace(/_/g, " ") || "—"}</p>
                                </div>
                            </div>
                            {evaluation.hcp_state_delta && (
                                <div className="rounded-lg border border-indigo-400/25 bg-indigo-500/10 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-indigo-200">State Delta (this turn)</p>
                                    <p><span className="font-semibold text-slate-200">Resistance:</span> {evaluation.hcp_state_delta.resistance_change >= 0 ? "+" : ""}{evaluation.hcp_state_delta.resistance_change}</p>
                                    <p><span className="font-semibold text-slate-200">Trust:</span> {evaluation.hcp_state_delta.trust_change >= 0 ? "+" : ""}{evaluation.hcp_state_delta.trust_change}</p>
                                    <p><span className="font-semibold text-slate-200">Stage Change:</span> {evaluation.hcp_state_delta.stage_change || "unchanged"}</p>
                                    <p><span className="font-semibold text-slate-200">Concern Movement:</span> {evaluation.hcp_state_delta.concern_movement?.replace(/_/g, " ") || "none"}</p>
                                    <p className="mt-1 text-slate-300">{evaluation.hcp_state_delta.reason}</p>
                                </div>
                            )}
                            <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 p-3">
                                <p className="mb-1 text-xs uppercase tracking-wide text-cyan-200">Simulated HCP Next Response</p>
                                <p className="text-cyan-100">{evaluation.simulated_hcp_next_response || "—"}</p>
                                {evaluation.hcp_progression_explanation && (
                                    <p className="mt-1 text-xs text-slate-400">{evaluation.hcp_progression_explanation}</p>
                                )}
                            </div>
                            {evaluation.hcp_state?.unresolved_concerns?.length > 0 && (
                                <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-rose-200">Unresolved Concerns</p>
                                    {evaluation.hcp_state.unresolved_concerns.map((c, i) => (
                                        <p key={i} className="text-rose-100 text-xs">{c}</p>
                                    ))}
                                </div>
                            )}
                            {evaluation.hcp_state?.next_expected_rep_move && (
                                <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-3">
                                    <p className="mb-1 text-xs uppercase tracking-wide text-amber-200">Next Expected REP Move</p>
                                    <p className="text-amber-100">{evaluation.hcp_state.next_expected_rep_move}</p>
                                </div>
                            )}
                        </div>
                    </DashboardCard>
                )}

                {error ? <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p> : null}
            </div>
        </div>
    );
}
