function splitSentences(text: string): string[] {
    return String(text || "")
        .split(/(?<=[.?!])\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
}

function sentenceWordCount(text: string): number {
    return String(text || "").split(/\s+/).filter(Boolean).length;
}

function uppercaseSentenceStart(text: string): string {
    const line = String(text || "");
    return line.replace(/^[a-z]/, (c) => c.toUpperCase());
}

function forceTerminalPunctuation(text: string): string {
    const line = String(text || "").trim();
    if (!line) return "";
    if (/[.?!]$/.test(line)) return line;
    return `${line}.`;
}

function normalizeClinicianVoice(text: string): string {
    return String(text || "")
        .replace(/^So\s+I want to make sure\s+(?:we're|we are)\s+/i, "For these patients, I'm focused on ")
        .replace(/^I want to make sure\s+(?:we're|we are)\s+/i, "For these patients, I'm focused on ")
        .replace(/^So\s+I need to make sure\s+/i, "I need to know ")
        .replace(/\bconsidering comorbidities like\b/gi, "especially with comorbidities such as")
        .replace(/\bsolid data\b/gi, "clear data")
        .replace(/\byour approach works in patients with complex conditions like\b/gi, "this works in patients with complex conditions such as")
        .replace(/\s+/g, " ")
        .trim();
}

function splitLongRunOn(line: string): string {
    let text = String(line || "").trim();
    if (!text) return text;
    if (sentenceWordCount(text) <= 26) return text;

    // Prefer period-based spoken segmentation over semicolons.
    const replacements: Array<[RegExp, string]> = [
        [/\s*,\s*and honestly\s*,\s*/i, ". Honestly, "],
        [/\s*,\s*but\s+/i, ". But "],
        [/\s*,\s*and\s+/i, ". And "],
    ];

    for (const [pattern, replacement] of replacements) {
        if (pattern.test(text) && splitSentences(text).length === 1) {
            text = text.replace(pattern, replacement);
        }
    }

    return text;
}

function addCausalConnectorForConstraintPivot(line: string): string {
    const text = String(line || "").trim();
    if (!text) return text;

    // Common spoken-to-written repair for constraint pivots:
    // "I've got a patient waiting, let's ..." -> "I've got a patient waiting, so let's ..."
    const constraintFirstClause =
        /^(?:i(?:'m| am)|i(?:'ve| have)|we(?:'re| are)|we(?:'ve| have))\b[^.?!]{0,120}\b(?:patient|minute|minutes|time|between visits|staff|clinic|schedule|room|waiting|next patient|callbacks?)\b[^.?!]*,/i;

    const hasLetsPivotWithoutConnector = /,\s*(?!so\b)let'?s\b/i.test(text);
    if (constraintFirstClause.test(text) && hasLetsPivotWithoutConnector) {
        return text.replace(/,\s*let'?s\b/i, ", so let's");
    }

    // Interrogative pivots are common in clipped clinician dialogue:
    // "I've got a minute, what's the point..." -> "I've got a minute, so what's the point..."
    const hasQuestionPivotWithoutConnector = /,\s*(?!so\b)(what'?s|why|how|where|when|who|do we|are we|is this|can we)\b/i.test(text);
    if (constraintFirstClause.test(text) && hasQuestionPivotWithoutConnector) {
        return text.replace(
            /,\s*(what'?s|why|how|where|when|who|do we|are we|is this|can we)\b/i,
            ", so $1",
        );
    }

    return text;
}

/**
 * Normalizes model output into natural spoken English with readable punctuation.
 * Keeps realism while preventing long run-on written lines.
 */
export function normalizeHcpSpokenText(rawText: unknown, maxSentences = 3): string {
    const cleaned = String(rawText || "")
        .replace(/```(?:json|text)?\s*/gi, "")
        .replace(/```/g, "")
        .replace(/^\s*[\-•*]\s*/gm, "")
        .replace(/^\s*\d+[.)]\s*/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^\s*["']+|["']+\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (!cleaned) return "";

    const voiceNormalized = normalizeClinicianVoice(cleaned);
    const runOnSafe = splitLongRunOn(voiceNormalized);
    const connectorSafe = addCausalConnectorForConstraintPivot(runOnSafe);
    const sentenceList = splitSentences(connectorSafe).slice(0, maxSentences);
    const normalized = sentenceList
        .map((sentence) => forceTerminalPunctuation(uppercaseSentenceStart(sentence.trim())))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

    return normalized;
}
