import { buildPredictiveProfile, PREDICTIVE_SELECTOR_OPTIONS } from "@/lib/predictiveBuilderModel";
import {
    buildSelectorLabels,
    buildSpecialistSystemPrompt,
    buildSynthesisUserPrompt,
    resolveSpecialistPersona,
} from "@/lib/specialistSynthesisPrompts";
import { checkWorkerHealth, invokeWorkerJson, invokeWorkerJsonRawPayload, listEvidenceRecords } from "@/services/workerClient";
import { invokeWorkerJsonWithRetry } from "@/services/workerJsonRetryHandler";
import { getWorkerHealthReport, shouldAttemptWorkerSynthesis } from "@/services/workerOfflineSafeguard";
import { PREDICTIVE_SYNTHESIS_RESPONSE_SCHEMA } from "@/lib/predictiveSynthesisSchema";

function getOptionLabel(field, value) {
    const options = PREDICTIVE_SELECTOR_OPTIONS[field] || [];
    const match = options.find((option) => option.value === value);
    return match?.label || value;
}

function staticLensFromProfile(profile) {
    return {
        sections: profile.sections,
        hcpPerspective: null,
        repPreparation: null,
        evidenceHighlights: [],
        synthesisConfidence: "static",
    };
}

export function buildPredictivePromptContext(runtimeLens = null) {
    if (!runtimeLens?.selection || !runtimeLens?.lens?.sections) return "";

    const seed = runtimeLens.selection;
    const sections = runtimeLens.lens.sections || {};

    const lines = [
        "PREDICTIVE HCP LENS (runtime, scenario-derived):",
        `- Source: ${runtimeLens.synthesisSource === "ai" ? "AI-synthesized" : "deterministic"}`,
        `- Specialist frame: ${runtimeLens.specialistTitle || "Clinical Specialist"}`,
        `- Seed disease state: ${seed.diseaseState}`,
        `- Seed HCP type: ${seed.hcpType}`,
        `- Seed journey stage: ${seed.journeyStage}`,
        `- Seed interaction pressure: ${seed.interactionPressure}`,
        `- Seed influence driver: ${seed.influenceDriver}`,
        `- Seed behavior archetype: ${seed.behaviorArchetype}`,
        `- Mindset headline: ${sections?.mindset?.headline || ""}`,
        `- Objection headline: ${sections?.objections?.headline || ""}`,
        `- Response style headline: ${sections?.responseStyle?.headline || ""}`,
        `- Rep approach headline: ${sections?.repApproach?.headline || ""}`,
    ];

    const hcpPerspective = runtimeLens.lens?.hcpPerspective;
    if (hcpPerspective?.internalMonologue) {
        lines.push(`- Internal monologue cue: ${hcpPerspective.internalMonologue}`);
    }
    if (hcpPerspective?.equalityTestQuestion) {
        lines.push(`- Equality test question: ${hcpPerspective.equalityTestQuestion}`);
    }

    return lines.join("\n");
}

/**
 * @typedef {Object} PredictiveRuntimeLensOptions
 * @property {Object} selection
 * @property {string} [scenarioTitle]
 */

/**
 * @param {PredictiveRuntimeLensOptions} [options]
 */
export async function buildPredictiveRuntimeLens(options = {}) {
    const { selection, scenarioTitle = "" } = options;
    const staticProfile = buildPredictiveProfile(selection);
    const selectorLabels = buildSelectorLabels(selection, getOptionLabel);
    const specialist = resolveSpecialistPersona(selection);

    let evidenceRecords = [];
    let synthesisSource = "static";
    let synthesisError = "";
    let lens = staticLensFromProfile(staticProfile);

    try {
        // Pre-flight health check using safeguard
        const healthReport = await getWorkerHealthReport();
        if (!shouldAttemptWorkerSynthesis(healthReport.status)) {
            synthesisError = `Worker unavailable (${healthReport.status}) — using deterministic lens.`;
            return {
                selection,
                selectorLabels,
                specialistTitle: specialist.title,
                evidenceRecords,
                synthesisSource,
                synthesisError,
                lens,
            };
        }

        try {
            evidenceRecords = await listEvidenceRecords({ diseaseState: selection.diseaseState, limit: 10 });
        } catch {
            evidenceRecords = [];
        }

        const systemPrompt = buildSpecialistSystemPrompt(selection);
        const userPrompt = buildSynthesisUserPrompt(selection, evidenceRecords, staticProfile, selectorLabels);

        const runtimePrompt = `${systemPrompt}\n\n${userPrompt}\n\nRuntime scenario: ${scenarioTitle}`;

        const synthesized = await invokeWorkerJsonWithRetry({
            invokerFn: async (temp) =>
                invokeWorkerJsonRawPayload({
                    prompt: runtimePrompt,
                    response_json_schema: PREDICTIVE_SYNTHESIS_RESPONSE_SCHEMA,
                    max_tokens: 2800,
                    temperature: temp,
                    roleplay: false,
                }),
            maxRetries: 5,
            temperature: 0.18,
        });

        if (synthesized?.sections) {
            lens = synthesized;
            synthesisSource = "ai";
        } else {
            synthesisError = "Runtime synthesis returned unexpected structure — service-level issue detected.";
        }
    } catch (err) {
        const isRetryExhausted = err?.code === "WORKER_JSON_RETRY_EXHAUSTED";
        if (isRetryExhausted) {
            synthesisError = "Runtime synthesis persistent formatting issue — worker output format needs adjustment.";
        } else if (String(err?.message || "").includes("timed out") || err?.name === "AbortError") {
            synthesisError = "Runtime synthesis service timeout — worker unavailable.";
        } else {
            synthesisError = "Runtime synthesis failed — using deterministic lens.";
        }
    }

    return {
        selection,
        selectorLabels,
        specialistTitle: specialist.title,
        evidenceRecords,
        synthesisSource,
        synthesisError,
        lens,
    };
}
