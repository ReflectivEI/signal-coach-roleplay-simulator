import { capabilityStateFromTenPoint } from "@/lib/capabilityStates";

const REQUIRED_KEYS = [
    "hcpType",
    "stage",
    "challenge",
];

const METRIC_LABELS = {
    context_awareness: "Context Awareness",
    cue_recognition: "Cue Recognition",
    empathy_acknowledgment: "Empathy & Acknowledgment",
    strategic_questioning: "Strategic Questioning",
    evidence_framing: "Evidence Framing",
    objection_handling: "Objection Handling",
    conversational_control: "Conversational Control",
    tone_pace_confidence: "Tone, Pace & Confidence",
};

export function isGenerateDisabled(form, busy) {
    if (busy) return true;
    if (!form || typeof form !== "object") return true;
    return REQUIRED_KEYS.some((key) => !String(form[key] ?? "").trim());
}

export function clampTemperature(value) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return 5;
    return Math.max(1, Math.min(10, Math.round(numeric)));
}

export function extractEightBehavioralMetricRows(evaluation) {
    const metrics = evaluation?.metric_scores || {};
    const expectedOrder = [
        "context_awareness",
        "cue_recognition",
        "empathy_acknowledgment",
        "strategic_questioning",
        "evidence_framing",
        "objection_handling",
        "conversational_control",
        "tone_pace_confidence",
    ];

    return expectedOrder.map((key) => ({
        key,
        label: METRIC_LABELS[key] || key,
        score: metrics?.[key]?.score_1_to_10 ?? null,
        state: capabilityStateFromTenPoint(metrics?.[key]?.score_1_to_10 ?? 5),
        rationale: metrics?.[key]?.rationale ?? "",
    }));
}
