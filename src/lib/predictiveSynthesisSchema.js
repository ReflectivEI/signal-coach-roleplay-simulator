export const PREDICTIVE_SYNTHESIS_RESPONSE_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["sections"],
    properties: {
        sections: {
            type: "object",
            additionalProperties: true,
        },
        hcpPerspective: {
            type: ["object", "null"],
            additionalProperties: true,
        },
        repPreparation: {
            type: ["object", "null"],
            additionalProperties: true,
        },
        evidenceHighlights: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: true,
            },
        },
        synthesisConfidence: {
            type: "string",
        },
    },
};

export const STRICT_JSON_REMINDER = [
    "Return only a valid JSON object.",
    "Do not include markdown code fences, prose, or commentary.",
].join(" ");
