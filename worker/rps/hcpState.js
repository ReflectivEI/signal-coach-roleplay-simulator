/**
 * HCP State Progression Engine
 *
 * Tracks explicit HCP state across turns and evolves HCP dialogue based on:
 *   - REP behavior (content quality, cue alignment, credibility signals)
 *   - Voice delivery (pace, pause, confidence, question delivery)
 *   - Temperature (resistance rate of change)
 *   - HCP Brain (persona source of truth for barriers, trust breakers, credibility drivers)
 *
 * Exports:
 *   buildInitialHcpState(hcpBrain, liveTemperature)        → initial hcp_state object
 *   updateHcpState({...})                                   → { newState, delta }
 *   selectHcpResponseType(newState, delta, hcpBrain, eval)  → response_type string
 *   generateHcpResponse({...})                              → { hcp_statement, hcp_response_type, hcp_progression_explanation }
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/** @typedef {Record<string, any>} AnyRecord */

function str(v, fallback = "") {
    return String(v ?? "").trim() || fallback;
}

function arr(v) {
    return Array.isArray(v) ? v : [];
}

function includesAny(textValue, patterns = []) {
    const lower = str(textValue).toLowerCase();
    return patterns.some((p) => lower.includes(String(p).toLowerCase()));
}

function dedupeTail(list = [], max = 6) {
    return arr(list).filter(Boolean).slice(-max);
}

function countConsecutiveFromEnd(list = [], target) {
    let count = 0;
    for (let i = list.length - 1; i >= 0; i--) {
        if (list[i] === target) count += 1;
        else break;
    }
    return count;
}

function humanizeBarrierFragment(value = "") {
    const lower = str(value).toLowerCase();
    if (!lower) return "";
    if (/overstating efficacy|generalizing from trial populations/.test(lower)) {
        return "patient-fit evidence instead of a broad efficacy claim";
    }
    if (/defensive response to pushback/.test(lower)) {
        return "a direct answer to the concern instead of pushback";
    }
    if (/comparative claims without patient-fit qualification/.test(lower)) {
        return "clear patient-fit reasoning before any comparison";
    }
    if (/signals are mixed and context-dependent/.test(lower)) {
        return "a clearer practical signal for this clinic";
    }
    return str(value).replace(/\.$/, "");
}

function normalizeSimilarityText(value = "") {
    return str(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function similarityRatio(a = "", b = "") {
    const leftTokens = new Set(normalizeSimilarityText(a).split(" ").filter((token) => token.length > 2));
    const rightTokens = new Set(normalizeSimilarityText(b).split(" ").filter((token) => token.length > 2));
    if (!leftTokens.size || !rightTokens.size) return 0;

    let shared = 0;
    leftTokens.forEach((token) => {
        if (rightTokens.has(token)) shared += 1;
    });
    return shared / Math.max(leftTokens.size, rightTokens.size);
}

function semanticSimilarityScore(a = "", b = "") {
    const left = normalizeSimilarityText(a);
    const right = normalizeSimilarityText(b);
    if (!left || !right) return 0;
    if (left === right) return 1;

    const tokenScore = similarityRatio(left, right);
    const prefixScore = left.slice(0, 90) === right.slice(0, 90) ? 1 : 0;
    const leftBigrams = new Set(left.split(" ").filter((token) => token.length > 2).map((token, idx, arrTokens) => {
        if (idx >= arrTokens.length - 1) return "";
        return `${token} ${arrTokens[idx + 1]}`;
    }).filter(Boolean));
    const rightBigrams = new Set(right.split(" ").filter((token) => token.length > 2).map((token, idx, arrTokens) => {
        if (idx >= arrTokens.length - 1) return "";
        return `${token} ${arrTokens[idx + 1]}`;
    }).filter(Boolean));
    let sharedBigrams = 0;
    leftBigrams.forEach((pair) => {
        if (rightBigrams.has(pair)) sharedBigrams += 1;
    });
    const bigramScore = leftBigrams.size && rightBigrams.size
        ? sharedBigrams / Math.max(leftBigrams.size, rightBigrams.size)
        : 0;

    return (tokenScore * 0.55) + (bigramScore * 0.35) + (prefixScore * 0.1);
}

function isNearDuplicateResponse(nextLine = "", previousLine = "") {
    const current = normalizeSimilarityText(nextLine);
    const previous = normalizeSimilarityText(previousLine);
    if (!current || !previous) return false;
    if (current === previous) return true;
    return similarityRatio(current, previous) >= 0.8;
}

/** @param {{ hcpState?: Record<string, any>, hcpBrain?: Record<string, any>, liveTemperature?: number, previousLine?: string, candidateLine?: string }} [params] */
function forceNonRepeatingVariation({
    hcpState,
    hcpBrain,
    liveTemperature = 5,
    previousLine = "",
    candidateLine = "",
} = {}) {
    const temp = clamp(Math.round(Number(liveTemperature) || 5), 1, 10);
    const barrier = pickBarrierText(hcpState, hcpBrain);
    const revealed = pickRevealedBarrier(hcpState, hcpBrain);
    const emphasisPool = [
        `I still need a concrete workflow answer on ${barrier}.`,
        `I still need to understand what this changes for the patients I'd actually consider.`,
        `If this remains unclear on access and approval flow, it still won't move here.`,
    ];
    const seed = `${previousLine}|${candidateLine}|${hcpState?.conversation_stage || "stage"}|${temp}`;
    const score = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const base = emphasisPool[score % emphasisPool.length];

    const realismTail = temp >= 8
        ? " I need the direct version."
        : temp <= 3
            ? " I'm open if you keep it practical."
            : " Keep it focused for my practice.";

    const clarifiedBarrier = humanizeBarrierFragment(revealed);
    const clarified = clarifiedBarrier && !base.toLowerCase().includes("access")
        ? `${base.replace(/\.$/, "")}. What I still do not have is ${clarifiedBarrier}.`
        : base;

    return clipToSentenceCount(`${clarified}${realismTail}`, temp >= 8 ? 1 : 2);
}

function softenSpecificityLexicon(line = "") {
    return str(line)
        .replace(/\bspecific\b/gi, "focused")
        .replace(/\bconcrete\b/gi, "clear")
        .replace(/\bpractical\b/gi, "usable")
        .replace(/\bdetails\b/gi, "signal")
        .replace(/\bexact\b/gi, "clear");
}

const INTENT_BUCKET_ORDER = [
    "workflow",
    "evidence",
    "cost",
    "access",
    "implementation",
    "time",
    "risk",
    "patient_fit",
];

function inferIntentBucketFromLine(line = "", hcpState = {}, hcpBrain = {}) {
    const text = normalizeSimilarityText(line);
    const combined = text;

    if (/\bworkflow\b|\bstaff\b|\bhandoff\b|\bcallback\b|\bprocess\b|\boperational\b/.test(combined)) return "workflow";
    if (/\bevidence\b|\btrial\b|\bdata\b|\bsubgroup\b|\boutcome\b|\breal world\b/.test(combined)) return "evidence";
    if (/\bcost\b|\bspend\b|\bvalue\b|\bmonitoring\b|\btesting\b|\bbudget\b/.test(combined)) return "cost";
    if (/\baccess\b|\bprior auth\b|\bapproval\b|\bformulary\b|\bpayer\b|\bcoverage\b/.test(combined)) return "access";
    if (/\bimplementation\b|\brollout\b|\badopt\b|\bexecution\b|\bowner\b|\bstep\b/.test(combined)) return "implementation";
    if (/\btime\b|\bminute\b|\bbrief\b|\bquick\b|\bout of time\b/.test(combined)) return "time";
    if (/\brisk\b|\bsafety\b|\buncertain\b|\bconfidence\b|\bunknown\b/.test(combined)) return "risk";
    if (/\bpatient\b|\bprofile\b|\bfit\b|\bcriteria\b|\bcandidate\b/.test(combined)) return "patient_fit";
    if (/\bclinic\b|\bpractice\b|\bdecision\b/.test(combined)) return "evidence";
    return "workflow";
}

function nextIntentBucket(bucket = "workflow", allowedBuckets = INTENT_BUCKET_ORDER) {
    const options = Array.isArray(allowedBuckets) && allowedBuckets.length
        ? allowedBuckets
        : INTENT_BUCKET_ORDER;
    const idx = options.indexOf(bucket);
    if (idx < 0) return options[0];
    return options[(idx + 1) % options.length];
}

function countTrailingSameBucket(bucketHistory = [], bucket) {
    let count = 0;
    for (let i = bucketHistory.length - 1; i >= 0; i -= 1) {
        if (bucketHistory[i] === bucket) count += 1;
        else break;
    }
    return count;
}

function normalizeStage(value = "") {
    return str(value).toLowerCase().replace(/\s+/g, "_");
}

function buildScenarioLanePolicy({
    hcpState = {},
    conversationMemory = {},
    scenarioContext = {},
} = {}) {
    const memoryContext = conversationMemory?.scenario_context || {};
    const stage = normalizeStage(
        scenarioContext?.journeyStage
        || scenarioContext?.journey_stage
        || memoryContext?.journeyStage
        || memoryContext?.journey_stage
        || hcpState?.journey_stage
        || "",
    );
    const pressures = [
        ...(Array.isArray(scenarioContext?.interactionPressure) ? scenarioContext.interactionPressure : []),
        ...(Array.isArray(scenarioContext?.interaction_pressure) ? scenarioContext.interaction_pressure : []),
        ...(Array.isArray(memoryContext?.interactionPressure) ? memoryContext.interactionPressure : []),
        ...(Array.isArray(memoryContext?.interaction_pressure) ? memoryContext.interaction_pressure : []),
    ].map((item) => str(item).toLowerCase()).filter(Boolean);
    const combinedBarrierText = [
        hcpState?.current_primary_barrier,
        hcpState?.current_secondary_barrier,
        ...(arr(hcpState?.unresolved_concerns || [])),
        ...(arr(hcpState?.revealed_concerns || [])),
        scenarioContext?.concernFamily,
        memoryContext?.concernFamily,
    ].join(" ").toLowerCase();

    const hasAccessPressure = pressures.includes("access_barrier")
        || /\bprior auth\b|\baccess\b|\bpayer\b|\bformulary\b|\bapproval\b|\bcoverage\b/.test(combinedBarrierText);
    const hasWorkflowPressure = pressures.includes("operationally_constrained")
        || /\bworkflow\b|\bstaff\b|\bcallback\b|\bhandoff\b|\boperational\b/.test(combinedBarrierText);
    const hasCostPressure = /\bcost\b|\bvalue\b|\bspend\b|\bbudget\b|\bmonitoring\b|\btesting\b/.test(combinedBarrierText);
    const hasRiskPressure = /\bsafety\b|\brisk\b|\bhepatic\b|\badverse\b/.test(combinedBarrierText);

    let allowedBuckets = ["workflow", "evidence", "patient_fit"];
    let primaryBucket = "workflow";

    switch (stage) {
        case "clinical_value":
            allowedBuckets = ["evidence", "patient_fit", "cost", "risk"];
            if (hasCostPressure) primaryBucket = "cost";
            else if (hasRiskPressure) primaryBucket = "risk";
            else primaryBucket = "evidence";
            if (hasAccessPressure) allowedBuckets.push("access");
            if (hasWorkflowPressure) allowedBuckets.push("workflow");
            break;
        case "access_formulary":
            allowedBuckets = ["access", "workflow", "implementation", "cost"];
            primaryBucket = hasWorkflowPressure ? "workflow" : "access";
            break;
        case "adoption_implementation":
            allowedBuckets = ["workflow", "implementation", "access", "time"];
            primaryBucket = hasAccessPressure ? "access" : "workflow";
            break;
        case "commitment_close":
            allowedBuckets = ["patient_fit", "evidence", "cost", "workflow"];
            primaryBucket = hasCostPressure ? "cost" : "patient_fit";
            break;
        case "objection_handling":
            allowedBuckets = ["evidence", "patient_fit", "cost", "risk"];
            if (hasAccessPressure) allowedBuckets.push("access");
            if (hasWorkflowPressure) allowedBuckets.push("workflow");
            primaryBucket = hasCostPressure ? "cost" : hasRiskPressure ? "risk" : "evidence";
            break;
        case "discovery":
        case "early_discovery":
        case "initial_access":
            allowedBuckets = ["patient_fit", "evidence", "workflow", "access", "time"];
            primaryBucket = hasAccessPressure ? "access" : hasWorkflowPressure ? "workflow" : "patient_fit";
            break;
        default:
            if (hasCostPressure) {
                allowedBuckets = ["cost", "evidence", "patient_fit", "access", "workflow"];
                primaryBucket = "cost";
            } else if (hasAccessPressure) {
                allowedBuckets = ["access", "workflow", "implementation", "cost"];
                primaryBucket = hasWorkflowPressure ? "workflow" : "access";
            } else if (hasRiskPressure) {
                allowedBuckets = ["risk", "evidence", "patient_fit"];
                primaryBucket = "risk";
            }
            break;
    }

    const ordered = [...new Set(allowedBuckets.filter(Boolean))];
    return {
        stage,
        pressures,
        allowedBuckets: ordered,
        primaryBucket: ordered.includes(primaryBucket) ? primaryBucket : ordered[0] || "workflow",
        hasAccessPressure,
        hasWorkflowPressure,
        hasCostPressure,
        hasRiskPressure,
    };
}

function getRepTopicSignals(textValue = "") {
    const lower = str(textValue).toLowerCase();
    return {
        study: /\b(jama|study|trial|data|evidence|paper|guideline)\b/.test(lower),
        patient_fit: /\b(patient profile|which patients|patient subgroup|subgroup|fit|criteria|who fits)\b/.test(lower),
        access: /\b(prior auth|prior authorization|approval|payer|coverage|formulary|access)\b/.test(lower),
        workflow: /\b(workflow|staff|handoff|process|callback|operational)\b/.test(lower),
        safety: /\b(safety|risk|adverse|side effect|hepatic|liver)\b/.test(lower),
        cost: /\b(cost|spend|value|budget|monitoring|testing|readmission)\b/.test(lower),
    };
}

function inferRepTopic(textValue = "") {
    const lower = str(textValue).toLowerCase();
    if (!lower) return "none";

    const signals = getRepTopicSignals(lower);
    if (signals.access) return "access";
    if (signals.workflow) return "workflow";
    if (signals.safety) return "safety";
    if (signals.cost) return "cost";
    // Prefer patient-fit when subgroup language is explicit, even if trial/data is also present.
    if (signals.patient_fit) return "patient_fit";
    if (signals.study) return "study";
    return "none";
}

function topicAcknowledged(line = "", topic = "none") {
    const lower = str(line).toLowerCase();
    if (!lower || topic === "none") return true;
    if (topic === "study") return /\b(jama|study|trial|paper)\b/.test(lower);
    if (topic === "patient_fit") return /\b(patient|patients|subgroup|fit|criteria|profile)\b/.test(lower);
    if (topic === "access") return /\b(prior auth|approval|payer|coverage|formulary|access)\b/.test(lower);
    if (topic === "workflow") return /\b(workflow|staff|handoff|process|callback|operational)\b/.test(lower);
    if (topic === "safety") return /\b(safety|risk|adverse|side effect|hepatic|liver)\b/.test(lower);
    return true;
}

function hasConflictingTopicSignal(sentence = "", topic = "none") {
    const lower = str(sentence).toLowerCase();
    if (!lower || topic === "none") return false;
    const signals = getRepTopicSignals(lower);

    if (topic === "study") return signals.patient_fit || signals.access || signals.workflow;
    if (topic === "patient_fit") return signals.study || signals.access || signals.workflow || signals.safety;
    if (topic === "access") return signals.study || signals.patient_fit || signals.workflow || signals.safety;
    if (topic === "workflow") return signals.study || signals.patient_fit || signals.access || signals.safety;
    if (topic === "safety") return signals.study || signals.patient_fit || signals.access || signals.workflow;
    return false;
}

function buildRepAlignedLead(topic = "none", repTranscript = "", hcpState = {}, conversationMemory = {}, scenarioContext = {}) {
    const pressureTight = Number(hcpState?.patience_level || 5) <= 4;
    const repLower = str(repTranscript).toLowerCase();
    const hasFollowupSignal = /\b(last week|follow up|following up|dropped off|earlier|as we discussed|you asked)\b/.test(repLower);
    const recentHistory = dedupeTail(arr(hcpState?.hcp_response_history), 4);
    const lanePolicy = buildScenarioLanePolicy({ hcpState, conversationMemory, scenarioContext });
    const requestedBucket = topic === "study"
        ? "evidence"
        : topic === "patient_fit"
            ? "patient_fit"
            : topic === "access"
                ? "access"
                : topic === "workflow"
                    ? "workflow"
                    : topic === "safety"
                        ? "risk"
                        : topic === "cost"
                            ? "cost"
                            : lanePolicy.primaryBucket;
    const bucketForTopic = lanePolicy.allowedBuckets.includes(requestedBucket)
        ? requestedBucket
        : lanePolicy.primaryBucket;

    const trailingTopicRun = countConsecutiveFromEnd(arr(hcpState?.intent_bucket_history), bucketForTopic);

    const pickLead = (options = []) => {
        const viable = options.filter(Boolean);
        if (!viable.length) return "I need a direct answer tied to what I just asked.";
        const previousLine = str(recentHistory[recentHistory.length - 1], "");
        const previousMatchIndex = previousLine
            ? viable.findIndex((option) => semanticSimilarityScore(option, previousLine) >= 0.72)
            : -1;
        if (previousMatchIndex >= 0) {
            return viable[(previousMatchIndex + 1) % viable.length];
        }
        if (trailingTopicRun > 0) {
            return viable[trailingTopicRun % viable.length];
        }
        const recentNorm = recentHistory.map((line) => normalizeSimilarityText(line)).filter(Boolean);
        const fresh = viable.find((option) => {
            const optionNorm = normalizeSimilarityText(option);
            return !recentNorm.some((historical) => semanticSimilarityScore(optionNorm, historical) >= 0.72);
        });
        return fresh || viable[0];
    };

    if (bucketForTopic === "evidence") {
        if (hasFollowupSignal) {
            return pickLead([
                pressureTight
                    ? "I remember the study you dropped off last week. What in that data changes a real treatment decision for my patients?"
                    : "I remember that study from last week. What in the data changes a real treatment decision for my patients?",
                "I remember the paper. Which finding changes who you would actually treat?",
                "I remember that study. What patient-level decision does it change in real practice?",
            ]);
        }
        return pickLead([
            "If we're talking about that study, what exactly changes for the patients I actually treat?",
            "Stay on the study for a second. Which result changes how I'd treat a real patient?",
            "If this is the data discussion, tell me which treatment decision actually changes.",
        ]);
    }
    if (bucketForTopic === "patient_fit") {
        return pickLead([
            "If we're discussing patient fit, tell me exactly which patients you mean and who should be excluded.",
            "Keep this on patient selection. Who fits first, and who clearly does not?",
            "Which patients are you actually talking about, and who should I leave out?",
        ]);
    }
    if (bucketForTopic === "cost") {
        return pickLead([
            "If we're discussing value, tell me which patient outcome actually justifies the total spend.",
            "Keep this on value. What outcome changes enough to justify the full cost per patient?",
            "If this is the cost discussion, what clinical result makes the spend worth it in practice?",
        ]);
    }
    if (bucketForTopic === "access") {
        if (lanePolicy.stage === "clinical_value") {
            return pickLead([
                "If access is still part of the value story, tell me which approval step changes for the patients you'd actually put on it.",
                "Keep this on access tied to value. What changes in prior auth before the patient can actually start?",
                "If this is still worth the spend, where does the approval path get simpler for a real patient?",
            ]);
        }
        return pickLead([
            "If this is about access, I need to know which approval step changes for my team.",
            "Keep this on access. What changes in the approval path for my staff first?",
            "If we're talking access, tell me where the prior-auth burden actually drops.",
        ]);
    }
    if (bucketForTopic === "workflow") {
        if (lanePolicy.stage === "clinical_value") {
            return pickLead([
                "Before this becomes a value decision, tell me what staff step actually gets easier first.",
                "Keep this on workflow tied to value. Which task comes off my team's plate if this matters?",
                "If this changes practice, where does the callback or handoff burden drop for staff first?",
            ]);
        }
        return pickLead([
            "If this is about workflow, tell me what staff step gets easier first.",
            "Keep this on workflow. Which task actually comes off my team's plate first?",
            "If we're talking workflow, where does the callback burden drop first for staff?",
        ]);
    }
    if (bucketForTopic === "risk") {
        return pickLead([
            "If this is about safety, I need to know what signal lowers risk for the patients I actually treat.",
            "Keep this on safety. What lowers risk in the patients I'd actually see?",
            "If we're talking safety, give me the signal that changes risk in practice.",
        ]);
    }
    return pickLead([
        "I need a direct answer tied to what I just asked.",
        "Keep this on the point I raised and tell me what actually changes.",
    ]);
}

function buildTopicRepeatBreaker(topic = "none", repTranscript = "", hcpState = {}, conversationMemory = {}, scenarioContext = {}) {
    const lanePolicy = buildScenarioLanePolicy({ hcpState, conversationMemory, scenarioContext });
    const topicKey = topic === "study" ? "study" : topic;
    const optionsByTopic = {
        study: [
            "Stay on the study for a second. Which result changes how I'd treat a real patient?",
            "I remember the paper. Which finding changes who you would actually treat?",
        ],
        patient_fit: [
            "Keep this on patient selection. Who fits first, and who clearly does not?",
            "Which patients are you actually talking about, and who should I leave out?",
        ],
        access: [
            "Keep this on access. What changes in the approval path for my staff first?",
            "If we're talking access, tell me where the prior-auth burden actually drops.",
        ],
        workflow: [
            "Keep this on workflow. Which task actually comes off my team's plate first?",
            "If we're talking workflow, where does the callback burden drop first for staff?",
        ],
        safety: [
            "Keep this on safety. What lowers risk in the patients I'd actually see?",
            "If we're talking safety, give me the signal that changes risk in practice.",
        ],
        cost: [
            "Keep this on value. What outcome changes enough to justify the total spend?",
            "If this is still worth it, what result justifies the full cost per patient?",
        ],
    };

    const recentHistory = dedupeTail(arr(hcpState?.hcp_response_history), 3);
    const previousLine = str(recentHistory[recentHistory.length - 1], "");
    const options = arr(optionsByTopic[topicKey] || []);
    const fresh = options.find((option) => !previousLine || !isNearDuplicateResponse(option, previousLine));
    return fresh || buildRepAlignedLead(topicKey, repTranscript, hcpState, conversationMemory, scenarioContext);
}

function enforceRepTranscriptAlignment(line = "", repTranscript = "", hcpState = {}, conversationMemory = {}, scenarioContext = {}) {
    const current = str(line);
    if (!current) return current;
    const topic = inferRepTopic(repTranscript);
    if (topic === "none") return current;
    const recentHistory = dedupeTail(arr(hcpState?.hcp_response_history), 3);
    const previousHcpLine = str(recentHistory[recentHistory.length - 1], "");
    const sentences = current.split(/(?<=[.!?])\s+/).filter(Boolean);
    const firstSentence = str(sentences[0]);
    const acknowledgesAnywhere = topicAcknowledged(current, topic);
    const acknowledgesLead = topicAcknowledged(firstSentence, topic) && !hasConflictingTopicSignal(firstSentence, topic);
    const filteredTail = sentences
        .slice(1)
        .filter((sentence) => !hasConflictingTopicSignal(sentence, topic))
        .slice(0, 1)
        .join(" ")
        .trim();

    if (acknowledgesAnywhere && acknowledgesLead) {
        const stabilized = filteredTail ? `${firstSentence} ${filteredTail}` : firstSentence;
        if (previousHcpLine && isNearDuplicateResponse(stabilized, previousHcpLine)) {
            const rotatedLead = buildRepAlignedLead(topic, repTranscript, hcpState, conversationMemory, scenarioContext);
            const rotated = filteredTail ? `${rotatedLead} ${filteredTail}` : rotatedLead;
            return clipToSentenceCount(rotated, 2);
        }
        return clipToSentenceCount(stabilized, 2);
    }

    const lead = buildRepAlignedLead(topic, repTranscript, hcpState, conversationMemory, scenarioContext);
    const merged = filteredTail ? `${lead} ${filteredTail}` : lead;
    return clipToSentenceCount(merged, 2);
}

function hasSessionNearDuplicate(line = "", history = []) {
    const candidate = str(line);
    if (!candidate) return false;
    const recent = dedupeTail(history, 8).filter(Boolean);
    return recent.some((prior) => semanticSimilarityScore(candidate, prior) >= 0.72);
}

/** @param {{ targetBucket?: string, barrier?: string, revealedBarrier?: string, variationSeed?: number, liveTemperature?: number }} [params] */
function buildForcedBucketLine({
    targetBucket,
    barrier,
    revealedBarrier,
    variationSeed = 0,
    liveTemperature = 5,
} = {}) {
    const temp = clamp(Math.round(Number(liveTemperature) || 5), 1, 10);
    const high = temp >= 8;
    const templates = {
        workflow: [
            `Operational path first: who owns the next handoff and what task drops?`,
            `Keep this operational: identify the next handoff owner and the removed step.`,
            `I need the care-path sequence: who takes the first handoff and what clears?`,
        ],
        evidence: [
            `Evidence-level clarity now. Which data point supports this in real patients?`,
            `Stay on evidence: which real-world signal shifts this decision?`,
            `Give one evidence point that changes confidence.`,
        ],
        access: [
            `Payer path first: which approval step moves and where does denial risk fall?`,
            `Give me the payer sequence: what shifts in approval timing or denial risk?`,
            `Keep this on payer access: which approval gate moves first?`,
        ],
        cost: [
            `Value first: which patient outcome actually justifies the full cost per patient?`,
            `Keep this on value: what result makes the spend defensible in practice?`,
            `I need the cost answer tied to one patient-level outcome, not a broad value claim.`,
        ],
        implementation: [
            `Keep this usable: who owns the first implementation step and what do they do?`,
            `I need one implementation detail: which role executes step one?`,
            `Implementation answer only: what gets added and who coordinates it?`,
        ],
        time: [
            `I need the short version. Which immediate minute-level burden drops first?`,
            `Time is tight. Give me one change that saves time this week.`,
            `Be brief: which immediate burden drops?`,
        ],
        risk: [
            `I still see risk here. Which signal reduces uncertainty for my patients and team?`,
            `Give me a risk signal: what shifts safety confidence in real practice?`,
            `I need one risk control before this moves forward.`,
        ],
        patient_fit: [
            `Which patient profile is this for, and who should be excluded at the start?`,
            `Stay on patient fit: which subgroup should I treat and which should I avoid?`,
            `I need one fit rule for patient selection before I proceed.`,
        ],
    };
    const options = templates[targetBucket] || templates.workflow;
    const base = options[Math.abs(Number(variationSeed) || 0) % options.length];
    if (high) {
        return clipToSentenceCount(softenSpecificityLexicon(base), 2);
    }
    return clipToSentenceCount(softenSpecificityLexicon(base), 2);
}

/** @param {{ hcpStatement?: string, hcpState?: AnyRecord, hcpBrain?: AnyRecord, liveTemperature?: number, conversationMemory?: AnyRecord }} [params] */
function enforceDeterministicAntiLoop({
    hcpStatement,
    hcpState,
    hcpBrain,
    liveTemperature = 5,
    conversationMemory = {},
    scenarioContext = {},
} = {}) {
    const recentHistory = dedupeTail([
        ...arr(conversationMemory?.hcp_response_history || []),
        ...arr(hcpState?.hcp_response_history || []),
    ], 5).filter(Boolean);

    const intentHistory = dedupeTail([
        ...arr(conversationMemory?.intent_bucket_history || []),
        ...arr(hcpState?.intent_bucket_history || []),
    ], 5).filter(Boolean);

    const barrier = pickBarrierText(hcpState, hcpBrain);
    const revealedBarrier = pickRevealedBarrier(hcpState, hcpBrain);
    const candidateBucket = inferIntentBucketFromLine(hcpStatement, hcpState, hcpBrain);
    const lanePolicy = buildScenarioLanePolicy({ hcpState, conversationMemory, scenarioContext });
    const normalizedCandidateBucket = lanePolicy.allowedBuckets.includes(candidateBucket)
        ? candidateBucket
        : lanePolicy.primaryBucket;
    const trailingBucketRun = countTrailingSameBucket(intentHistory, normalizedCandidateBucket);

    let maxSimilarity = 0;
    for (const historicalLine of recentHistory) {
        const score = semanticSimilarityScore(hcpStatement, historicalLine);
        if (score > maxSimilarity) maxSimilarity = score;
    }

    const similarityBlocked = maxSimilarity > 0.75;
    const bucketBlocked = trailingBucketRun >= 2;
    const blocked = similarityBlocked || bucketBlocked;
    if (!blocked) {
        return {
            line: hcpStatement,
            anti_loop_intervention_triggered: false,
            anti_loop_intervention_reason: "none",
            intent_bucket: normalizedCandidateBucket,
            semantic_similarity_max: Number(maxSimilarity.toFixed(3)),
            trailing_bucket_run: trailingBucketRun,
        };
    }

    const temp = clamp(Math.round(Number(liveTemperature) || 5), 1, 10);
    const targetBucket = bucketBlocked
        ? nextIntentBucket(normalizedCandidateBucket, lanePolicy.allowedBuckets)
        : normalizedCandidateBucket;
    let forcedLine = hcpStatement;
    let reason = similarityBlocked ? `semantic_similarity>${maxSimilarity.toFixed(3)}` : "intent_bucket_repeat_run>2";
    const variationSeed = Number(hcpState?.anti_loop_intervention_count || 0) + trailingBucketRun + recentHistory.length;

    if (temp >= 8) {
        forcedLine = buildForcedBucketLine({
            targetBucket,
            barrier,
            revealedBarrier,
            variationSeed,
            liveTemperature,
        });
        reason = `${reason}|escalate_resistance`;
    } else if (bucketBlocked) {
        forcedLine = buildForcedBucketLine({
            targetBucket,
            barrier,
            revealedBarrier,
            variationSeed,
            liveTemperature,
        });
        reason = `${reason}|shift_dimension:${normalizedCandidateBucket}->${targetBucket}`;
    } else {
        const constraintPool = [
            `What changes for staff ownership on ${barrier}?`,
            `What changes in payer approval timing on ${barrier}?`,
            `What changes in the time burden in my day-to-day workflow?`,
            `What changes in clinical risk for the patients I actually treat?`,
        ];
        const seed = `${barrier}|${revealedBarrier}|${candidateBucket}|${temp}|${recentHistory.join("|")}`;
        const score = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const injectedConstraint = constraintPool[score % constraintPool.length];
        forcedLine = clipToSentenceCount(`I still need one concrete answer. ${injectedConstraint}`, 2);
        reason = `${reason}|introduce_new_constraint`;
    }

    let uniquenessBucket = targetBucket;
    let forcedNorm = normalizeSimilarityText(forcedLine);
    const normalizedRecent = new Set(recentHistory.map((line) => normalizeSimilarityText(line)).filter(Boolean));
    let uniquenessAttempts = 0;
    while (forcedNorm && normalizedRecent.has(forcedNorm) && uniquenessAttempts < INTENT_BUCKET_ORDER.length) {
        uniquenessBucket = nextIntentBucket(uniquenessBucket, lanePolicy.allowedBuckets);
        forcedLine = clipToSentenceCount(
            buildForcedBucketLine({
                targetBucket: uniquenessBucket,
                barrier,
                revealedBarrier,
                variationSeed: variationSeed + 1 + uniquenessAttempts,
                liveTemperature,
            }),
            2,
        );
        forcedNorm = normalizeSimilarityText(forcedLine);
        uniquenessAttempts += 1;
    }

    const postInterventionSimilarity = recentHistory.reduce((max, historicalLine) => {
        return Math.max(max, semanticSimilarityScore(forcedLine, historicalLine));
    }, 0);
    let finalBucket = uniquenessBucket;
    if (postInterventionSimilarity > 0.75) {
        finalBucket = nextIntentBucket(targetBucket, lanePolicy.allowedBuckets);
        forcedLine = clipToSentenceCount(
            buildForcedBucketLine({
                targetBucket: finalBucket,
                barrier,
                revealedBarrier,
                variationSeed: variationSeed + 1,
                liveTemperature,
            }),
            2,
        );
        reason = `${reason}|post_similarity_breaker`;
    }

    let finalNorm = normalizeSimilarityText(forcedLine);
    let finalAttempts = 0;
    while (finalNorm && normalizedRecent.has(finalNorm) && finalAttempts < INTENT_BUCKET_ORDER.length) {
        finalBucket = nextIntentBucket(finalBucket, lanePolicy.allowedBuckets);
        forcedLine = clipToSentenceCount(
            buildForcedBucketLine({
                targetBucket: finalBucket,
                barrier,
                revealedBarrier,
                variationSeed: variationSeed + 2 + finalAttempts,
                liveTemperature,
            }),
            2,
        );
        finalNorm = normalizeSimilarityText(forcedLine);
        finalAttempts += 1;
        reason = `${reason}|final_uniqueness_rotation`;
    }

    return {
        line: softenSpecificityLexicon(forcedLine),
        anti_loop_intervention_triggered: true,
        anti_loop_intervention_reason: reason,
        intent_bucket: finalBucket,
        semantic_similarity_max: Number(maxSimilarity.toFixed(3)),
        trailing_bucket_run: trailingBucketRun,
    };
}

/** @param {{ previousState?: AnyRecord, nextState?: AnyRecord, liveTemperature?: number }} [params] */
function enforceRealismTrajectory({ previousState, nextState, liveTemperature = 5 } = {}) {
    const prev = previousState || {};
    const next = { ...(nextState || {}) };
    const temp = clamp(Math.round(Number(liveTemperature) || 5), 1, 10);
    const deltaTrust = Number(next.trust_level || 0) - Number(prev.trust_level || 0);
    const deltaResistance = Number(next.resistance_level || 0) - Number(prev.resistance_level || 0);

    let enforced = false;
    let reason = "none";

    if (temp <= 3) {
        if (deltaTrust < 1) {
            next.trust_level = clamp(Number(prev.trust_level || 0) + 1, 0, 10);
            enforced = true;
        }
        if (deltaResistance > -1) {
            next.resistance_level = clamp(Number(prev.resistance_level || 0) - 1, 0, 10);
            enforced = true;
        }
        if (enforced) reason = "low_tier_requires_trust_up_resistance_down";

        const stageFlow = [
            "guarded_opening",
            "resistance_surface",
            "concern_clarification",
            "deeper_barrier_reveal",
            "conditional_openness",
            "next_step_consideration",
        ];
        const prevStage = str(prev.conversation_stage, "guarded_opening");
        const nextStage = str(next.conversation_stage, prevStage);
        const prevIdx = stageFlow.indexOf(prevStage);
        const nextIdx = stageFlow.indexOf(nextStage);
        const turnDepth = arr(prev.hcp_response_history).length;
        if (turnDepth >= 4 && prevIdx >= 0 && nextIdx === prevIdx && nextIdx < stageFlow.length - 1) {
            next.conversation_stage = stageFlow[nextIdx + 1];
            enforced = true;
            reason = "low_tier_forced_late_stage_progression";
        }
    } else if (temp >= 8) {
        if (deltaResistance < 0) {
            next.resistance_level = clamp(Number(prev.resistance_level || 0), 0, 10);
            enforced = true;
        }
        if (deltaTrust > 0) {
            next.trust_level = clamp(Number(prev.trust_level || 0), 0, 10);
            enforced = true;
        }
        if (enforced) reason = "high_tier_requires_resistance_non_decreasing_and_trust_non_increasing";
    } else {
        const clampedTrustDelta = clamp(deltaTrust, -1, 1);
        const clampedResistanceDelta = clamp(deltaResistance, -1, 1);
        if (clampedTrustDelta !== deltaTrust) {
            next.trust_level = clamp(Number(prev.trust_level || 0) + clampedTrustDelta, 0, 10);
            enforced = true;
        }
        if (clampedResistanceDelta !== deltaResistance) {
            next.resistance_level = clamp(Number(prev.resistance_level || 0) + clampedResistanceDelta, 0, 10);
            enforced = true;
        }
        if (enforced) reason = "mid_tier_conditional_change_only";
    }

    return {
        nextState: next,
        realism_trajectory_enforced: enforced,
        realism_trajectory_reason: reason,
    };
}

// ─── Stage and position maps ──────────────────────────────────────────────────

const CONVERSATION_STAGES = [
    "guarded_opening",
    "resistance_surface",
    "concern_clarification",
    "deeper_barrier_reveal",
    "conditional_openness",
    "next_step_consideration",
    "stalled",
    "disengaging",
];

const HCP_POSITIONS = [
    "resistant",
    "guarded",
    "neutral",
    "conditionally_open",
    "willing_to_explore",
    "ready_for_next_step",
];

// ─── buildInitialHcpState ─────────────────────────────────────────────────────

/**
 * Builds the initial HCP state from a built HCP Brain and live temperature.
 * Called once when a scenario is generated.
 */
export function buildInitialHcpState(hcpBrain, liveTemperature = 5) {
    const temp = clamp(Math.round(Number(liveTemperature) || 5), 1, 10);
    const band = temp <= 3 ? "low" : temp <= 7 ? "mid" : "high";
    const persona = hcpBrain?.persona || {};
    const cp = hcpBrain?.clinician_perspective || {};
    const lo = hcpBrain?.likely_objections || {};
    const ps = hcpBrain?.pressure_signals || {};

    // Initial levels driven by temperature band
    const resistance_level = band === "high" ? 8 : band === "mid" ? 6 : 4;
    const trust_level = band === "high" ? 2 : band === "mid" ? 4 : 6;
    const openness_level = band === "high" ? 2 : band === "mid" ? 3 : 5;
    const patience_level = band === "high" ? 3 : band === "mid" ? 5 : 7;

    // Seed barriers from brain's likely objections
    const primaryObjection = str(arr(lo.key_factors)[0], "Unclear practical relevance to clinic workflow.");
    const secondaryObjection = str(arr(lo.key_factors)[1], "Access and operational burden concerns.");

    // Hidden concerns from trust breakers and pressure signals
    const hiddenConcerns = [
        ...arr(cp.trust_breakers).slice(0, 2),
        ...arr(ps.key_factors).slice(0, 1),
    ].filter(Boolean);

    const hcp_position = band === "high" ? "resistant" : "guarded";
    const conversation_stage = "guarded_opening";

    return {
        resistance_level,
        trust_level,
        openness_level,
        patience_level,
        conversation_stage,
        last_rep_quality: "unknown",
        unresolved_concerns: [primaryObjection, secondaryObjection].filter(Boolean),
        partially_addressed_concerns: [],
        resolved_concerns: [],
        revealed_concerns: [],
        hidden_concerns: hiddenConcerns,
        current_primary_barrier: primaryObjection,
        current_secondary_barrier: secondaryObjection,
        hcp_position,
        next_expected_rep_move: str(persona.repApproach, "Address primary concern and ask diagnostic question."),
        repetition_count: 0,
        hcp_response_history: [],
        intent_bucket_history: [],
        anti_loop_intervention_count: 0,
        last_hcp_response_type: null,
        last_hcp_response_text: "",
        previous_response_types: [],
        previous_rep_qualities: [],
        progression_reason: "initial",
    };
}

// ─── classifyRepQuality ───────────────────────────────────────────────────────

function classifyRepQuality(evaluation = {}, voiceBehaviorAdaptation = {}) {
    const alignment = evaluation?.hcp_brain_alignment || {};
    const overall = Number(evaluation?.overall_score || 0);
    const reactionModifier = str(voiceBehaviorAdaptation?.hcp_reaction_modifier, "hold");
    const perceivedListening = str(voiceBehaviorAdaptation?.perceived_listening_signal, "moderate");

    // Strong: high score, quality test satisfied, good delivery, no trust breakers
    if (
        overall >= 7 &&
        alignment.quality_test_satisfied &&
        reactionModifier === "soften" &&
        perceivedListening === "high"
    ) return "strong";

    // Generic/weak: low score, trust breakers triggered, poor delivery
    if (
        overall <= 3 ||
        (arr(alignment.trust_breakers_triggered).length > 0 && !alignment.quality_test_satisfied) ||
        reactionModifier === "harden"
    ) return alignment.trust_breakers_triggered?.length > 0 ? "trust_breaker" : "weak";

    // Improving: mid score, some credibility signals, partial delivery
    if (
        overall >= 5 &&
        (alignment.quality_test_satisfied || arr(alignment.credibility_drivers_demonstrated).length > 0)
    ) return "improving";

    // Generic: no cue alignment, polished but surface level
    if (!alignment.quality_test_satisfied && overall <= 5) return "generic";

    return "partial";
}

// ─── computeStateDelta ───────────────────────────────────────────────────────

function computeStateDelta(
    hcpBrain,
    previousState,
    repQuality,
    evaluation,
    voiceBehaviorAdaptation,
    liveTemperature,
) {
    const temp = clamp(Math.round(Number(liveTemperature) || 5), 1, 10);
    const band = temp <= 3 ? "low" : temp <= 7 ? "mid" : "high";
    const alignment = evaluation?.hcp_brain_alignment || {};
    const reactionModifier = str(voiceBehaviorAdaptation?.hcp_reaction_modifier, "hold");
    const deliveryPressure = str(voiceBehaviorAdaptation?.delivery_pressure_signal, "neutral");
    const perceivedListening = str(voiceBehaviorAdaptation?.perceived_listening_signal, "moderate");
    const commitment = evaluation?.outcome_analysis || {};

    let resistance_change = 0;
    let trust_change = 0;
    let openness_change = 0;
    let patience_change = 0;
    let concern_movement = "none";
    let reason = "No significant change.";

    // ── Content quality rules ────────────────────────────────────────────────
    if (repQuality === "trust_breaker") {
        // Sharp resistance increase on trust breaker
        resistance_change += band === "high" ? 3 : 2;
        trust_change -= 2;
        patience_change -= 2;
        concern_movement = "trust_breaker_triggered";
        reason = `Trust breaker language detected — resistance increases sharply. HCP loses confidence in rep's intent.`;
    } else if (repQuality === "weak" || repQuality === "generic") {
        resistance_change += band === "high" ? 2 : 1;
        trust_change -= 1;
        patience_change -= 1;
        concern_movement = "concern_remains_unresolved";
        reason = `Generic or product-heavy response — resistance increases, concern unresolved.`;
    } else if (repQuality === "partial") {
        // Slight improvement but not enough to move stage
        trust_change += 1;
        concern_movement = "concern_partially_addressed";
        reason = `Partial acknowledgment of concern — slight trust increase but concern remains partially addressed.`;
    } else if (repQuality === "improving") {
        resistance_change -= 1;
        trust_change += 1;
        openness_change += 1;
        concern_movement = "concern_partially_addressed";
        reason = `Improving response — reduces resistance slightly, trust building.`;
    } else if (repQuality === "strong") {
        resistance_change -= band === "high" ? 1 : 2;
        trust_change += band === "high" ? 1 : 2;
        openness_change += 1;
        patience_change += 1;
        concern_movement = "deeper_barrier_revealed";
        reason = `Strong diagnostic response — resistance drops, trust improves, HCP willing to reveal deeper concern.`;
    }

    // ── HCP Brain alignment rules ────────────────────────────────────────────
    if (alignment.quality_test_satisfied) {
        resistance_change -= 1;
        trust_change += 1;
        if (concern_movement === "none") concern_movement = "concern_partially_addressed";
        reason += " Quality test satisfied.";
    }

    if (arr(alignment.credibility_drivers_demonstrated).length > 0) {
        trust_change += 1;
        openness_change += 1;
        reason += ` Credibility driver demonstrated (${alignment.credibility_drivers_demonstrated[0]}).`;
    }

    if (arr(alignment.trust_breakers_triggered).length > 0 && repQuality !== "trust_breaker") {
        // Minor trust breaker already partially handled
        resistance_change += 1;
        trust_change -= 1;
    }

    // ── Premature commitment at high temperature ──────────────────────────────
    if (band === "high" && commitment.commitment_type === "fit_exploration" && !alignment.quality_test_satisfied) {
        resistance_change += 1;
        patience_change -= 1;
        reason += " Premature commitment attempt at high temperature — HCP pushes back.";
    }

    // ── Voice delivery rules ─────────────────────────────────────────────────
    if (reactionModifier === "harden") {
        resistance_change += band === "high" ? 2 : 1;
        trust_change -= 1;
        reason += " Poor delivery (rushed/overconfident) prevents softening.";
    } else if (reactionModifier === "soften") {
        resistance_change -= 1;
        trust_change += 1;
        openness_change += 1;
        reason += " Strong delivery (optimal pace, strategic pause, diagnostic question) improves receptivity.";
    }

    if (deliveryPressure === "pressure_increasing") {
        resistance_change += 1;
        patience_change -= 1;
    }
    if (perceivedListening === "low") {
        trust_change -= 1;
        openness_change -= 1;
    } else if (perceivedListening === "high") {
        trust_change += 1;
    }

    // ── Temperature rate modifiers ───────────────────────────────────────────
    if (band === "high") {
        // Resistance increases faster, trust builds slower
        if (resistance_change > 0) resistance_change = Math.ceil(resistance_change * 1.3);
        if (trust_change > 0) trust_change = Math.floor(trust_change * 0.7);
        if (patience_change < 0) patience_change = Math.floor(patience_change * 1.3);
    } else if (band === "low") {
        // Trust builds faster, resistance decreases more easily
        if (trust_change > 0) trust_change = Math.ceil(trust_change * 1.3);
        if (resistance_change < 0) resistance_change = Math.floor(resistance_change * 1.3);
    }

    return {
        resistance_change: clamp(Math.round(resistance_change), -3, 4),
        trust_change: clamp(Math.round(trust_change), -3, 3),
        openness_change: clamp(Math.round(openness_change), -2, 2),
        patience_change: clamp(Math.round(patience_change), -3, 2),
        concern_movement,
        reason: reason.trim(),
    };
}

// ─── deriveNewStage ───────────────────────────────────────────────────────────

function deriveNewStage(previousState, newLevels, delta, repQuality, liveTemperature) {
    const { resistance_level, trust_level, openness_level, patience_level } = newLevels;
    const currentStage = previousState.conversation_stage;
    const temp = clamp(Math.round(Number(liveTemperature) || 5), 1, 10);
    const band = temp <= 3 ? "low" : temp <= 7 ? "mid" : "high";

    // Disengaging: patience exhausted or repeated trust breakers
    if (patience_level <= 1 || (resistance_level >= 9 && trust_level <= 2)) {
        return "disengaging";
    }

    // Stalled: high resistance stuck with no movement
    if (resistance_level >= 8 && delta.concern_movement === "concern_remains_unresolved") {
        return "stalled";
    }

    // Progression forward
    if (repQuality === "strong" || delta.concern_movement === "deeper_barrier_revealed") {
        if (currentStage === "guarded_opening" || currentStage === "resistance_surface") {
            return "concern_clarification";
        }
        if (currentStage === "concern_clarification") {
            return "deeper_barrier_reveal";
        }
        if (currentStage === "deeper_barrier_reveal") {
            // High temp caps at conditional_openness, not further
            return band === "high" ? "conditional_openness" : "conditional_openness";
        }
        if (currentStage === "conditional_openness" && band !== "high") {
            return "next_step_consideration";
        }
    }

    if (repQuality === "improving") {
        if (currentStage === "guarded_opening") return "resistance_surface";
        if (currentStage === "resistance_surface") return "concern_clarification";
        // Stay in place for deeper stages without strong signal
    }

    if (repQuality === "weak" || repQuality === "generic" || repQuality === "trust_breaker") {
        if (currentStage === "concern_clarification") return "resistance_surface";
        if (currentStage === "deeper_barrier_reveal") return "concern_clarification";
        if (currentStage === "next_step_consideration") return "conditional_openness";
        if (currentStage === "resistance_surface" || currentStage === "guarded_opening") {
            return currentStage; // Stay in opening/surface — will stall next time
        }
    }

    // Default: stay in current stage
    return currentStage;
}

// ─── deriveNewPosition ────────────────────────────────────────────────────────

function deriveNewPosition(newLevels, newStage) {
    const { resistance_level, trust_level, openness_level } = newLevels;

    if (newStage === "disengaging") return "resistant";
    if (newStage === "stalled") return resistance_level >= 7 ? "resistant" : "guarded";
    if (newStage === "next_step_consideration") return "willing_to_explore";
    if (newStage === "conditional_openness") return trust_level >= 6 ? "conditionally_open" : "guarded";
    if (newStage === "deeper_barrier_reveal") return trust_level >= 5 ? "neutral" : "guarded";
    if (newStage === "concern_clarification") return resistance_level <= 5 ? "guarded" : "resistant";
    if (newStage === "resistance_surface") return "resistant";
    if (newStage === "guarded_opening") return resistance_level >= 7 ? "resistant" : "guarded";

    // Fallback based on raw levels
    if (resistance_level >= 8) return "resistant";
    if (resistance_level >= 6) return "guarded";
    if (trust_level >= 7 && openness_level >= 6) return "willing_to_explore";
    if (trust_level >= 5 && openness_level >= 4) return "conditionally_open";
    return "neutral";
}

// ─── updateConcerns ──────────────────────────────────────────────────────────

function updateConcerns(previousState, delta, evaluation, hcpBrain) {
    const alignment = evaluation?.hcp_brain_alignment || {};
    const unresolved = [...arr(previousState.unresolved_concerns)];
    const partial = [...arr(previousState.partially_addressed_concerns)];
    const resolved = [...arr(previousState.resolved_concerns)];
    const revealed = [...arr(previousState.revealed_concerns)];
    const hidden = [...arr(previousState.hidden_concerns)];

    if (delta.concern_movement === "deeper_barrier_revealed" && hidden.length > 0) {
        // Move first hidden concern to revealed
        const newRevealed = hidden.shift();
        if (newRevealed) revealed.push(newRevealed);
    }

    if (delta.concern_movement === "concern_partially_addressed" && unresolved.length > 0) {
        const moved = unresolved.shift();
        if (moved && !partial.includes(moved)) partial.push(moved);
    }

    if (alignment.quality_test_satisfied && partial.length > 0) {
        // Move first partial concern to resolved if quality test met
        const resolvedConcern = partial.shift();
        if (resolvedConcern) resolved.push(resolvedConcern);
    }

    // If trust breaker triggered, unshift a new concern from hidden
    if (delta.concern_movement === "trust_breaker_triggered") {
        const tb = arr(hcpBrain?.clinician_perspective?.trust_breakers)[0];
        if (tb && !unresolved.includes(tb)) unresolved.unshift(tb);
    }

    return {
        unresolved_concerns: unresolved.slice(0, 5),
        partially_addressed_concerns: partial.slice(0, 5),
        resolved_concerns: resolved.slice(0, 5),
        revealed_concerns: revealed.slice(0, 5),
        hidden_concerns: hidden.slice(0, 5),
    };
}

// ─── updateHcpState ──────────────────────────────────────────────────────────

/**
 * Updates HCP state after a REP turn.
 * Returns { newState, delta }.
 */
/** @param {{ hcpBrain?: AnyRecord, previousHcpState?: AnyRecord, repResponseTranscript?: string, evaluation?: AnyRecord, voiceBehaviorAdaptation?: AnyRecord, liveTemperature?: number, conversationMemory?: AnyRecord }} [params] */
export function updateHcpState({
    hcpBrain,
    previousHcpState,
    repResponseTranscript = "",
    evaluation = {},
    voiceBehaviorAdaptation = {},
    liveTemperature = 5,
    conversationMemory = {},
} = {}) {
    const previous = previousHcpState || buildInitialHcpState(hcpBrain, liveTemperature);
    const repQuality = classifyRepQuality(evaluation, voiceBehaviorAdaptation);

    const delta = computeStateDelta(
        hcpBrain,
        previous,
        repQuality,
        evaluation,
        voiceBehaviorAdaptation,
        liveTemperature,
    );

    const newLevels = {
        resistance_level: clamp(previous.resistance_level + delta.resistance_change, 0, 10),
        trust_level: clamp(previous.trust_level + delta.trust_change, 0, 10),
        openness_level: clamp(previous.openness_level + delta.openness_change, 0, 10),
        patience_level: clamp(previous.patience_level + delta.patience_change, 0, 10),
    };

    const newStage = deriveNewStage(previous, newLevels, delta, repQuality, liveTemperature);
    const stage_change = newStage !== previous.conversation_stage
        ? `${previous.conversation_stage} → ${newStage}`
        : "unchanged";

    const newPosition = deriveNewPosition(newLevels, newStage);

    const concernUpdates = updateConcerns(previous, delta, evaluation, hcpBrain);

    const repLower = str(repResponseTranscript).toLowerCase();
    const repHasDiagnosticQuestion = /\b(what|how|which|where|when|is|can|would|could)\b/.test(repLower)
        && repLower.includes("?")
        && /\b(workflow|access|prior auth|staff|barrier|fit|patient|criteria|implementation|callback)\b/.test(repLower);
    const repUsesVagueProductLanguage = /\b(best|innovative|leading|strong data|broad value|game changer|market leader|highly effective)\b/.test(repLower)
        && !/\b(workflow|access|prior auth|staff|barrier|fit|patient|criteria|implementation|callback)\b/.test(repLower);

    const primaryBarrier = concernUpdates.unresolved_concerns[0]
        || concernUpdates.partially_addressed_concerns[0]
        || previous.current_primary_barrier;
    const secondaryBarrier = concernUpdates.revealed_concerns[0]
        || concernUpdates.unresolved_concerns[1]
        || previous.current_secondary_barrier;

    // Update next expected rep move from brain based on stage
    const cp = hcpBrain?.clinician_perspective || {};
    const stageToRepMove = {
        guarded_opening: str(hcpBrain?.persona?.repApproach, "Lead with one workflow-reducing step and ask a narrow diagnostic question."),
        resistance_surface: "Acknowledge the concern directly and ask one precision question before responding.",
        concern_clarification: "Narrow the specific barrier — ask which part of the concern (access, workflow, patient fit) is the biggest blocker.",
        deeper_barrier_reveal: "Connect evidence or approach specifically to the revealed deeper barrier.",
        conditional_openness: "Confirm understanding and propose one concrete low-risk next step.",
        next_step_consideration: "Secure one specific owned next action with clear patient criteria.",
        stalled: "Reset the conversation — restate concern, ask diagnostic question, avoid advancing claims.",
        disengaging: "Acknowledge the time constraint, request a focused 2-minute clarification, or accept the outcome.",
    };
    const next_expected_rep_move = stageToRepMove[newStage] || previous.next_expected_rep_move;

    // Anti-repetition: track if new response type would repeat
    const wouldRepeatType = previous.last_hcp_response_type !== null &&
        repQuality === previous.last_rep_quality;
    const newRepetitionCount = wouldRepeatType ? previous.repetition_count + 1 : 0;

    const previousRepQualities = dedupeTail(previous.previous_rep_qualities || [], 6);
    const nextRepQualities = dedupeTail([...previousRepQualities, repQuality], 6);

    const newState = {
        ...newLevels,
        conversation_stage: newStage,
        last_rep_quality: repQuality,
        rep_has_diagnostic_question: repHasDiagnosticQuestion,
        rep_uses_vague_product_language: repUsesVagueProductLanguage,
        ...concernUpdates,
        current_primary_barrier: primaryBarrier,
        current_secondary_barrier: secondaryBarrier,
        hcp_position: newPosition,
        next_expected_rep_move,
        repetition_count: newRepetitionCount,
        last_hcp_response_type: previous.last_hcp_response_type, // Will be updated in generateHcpResponse
        last_hcp_response_text: str(previous.last_hcp_response_text, ""),
        previous_response_types: dedupeTail(previous.previous_response_types || [], 6),
        previous_rep_qualities: nextRepQualities,
        progression_reason: delta.reason,
    };

    return {
        newState,
        delta: {
            ...delta,
            stage_change,
        },
    };
}

// ─── selectHcpResponseType ────────────────────────────────────────────────────

const RESPONSE_TYPES = [
    "restate_surface_concern",
    "sharpen_objection",
    "reveal_hidden_barrier",
    "acknowledge_partial_progress",
    "challenge_assumption",
    "ask_for_specificity",
    "conditionally_open",
    "permission_to_continue",
    "soft_next_step",
    "disengage",
];

const WEAK_ESCALATION = [
    "restate_surface_concern",
    "sharpen_objection",
    "challenge_assumption",
    "disengage",
];

const IMPROVING_SHIFT = [
    "acknowledge_partial_progress",
    "reveal_hidden_barrier",
    "ask_for_specificity",
];

const STRONG_SHIFT = [
    "conditionally_open",
    "permission_to_continue",
    "soft_next_step",
];

function nextInSequence(sequence, lastType) {
    const idx = sequence.indexOf(lastType);
    if (idx < 0) return sequence[0];
    return sequence[Math.min(idx + 1, sequence.length - 1)];
}

function isFailingQuality(repQuality) {
    return ["weak", "generic", "trust_breaker"].includes(repQuality);
}

function isStrongDelivery(voiceBehaviorAdaptation = {}) {
    return str(voiceBehaviorAdaptation.hcp_reaction_modifier) === "soften"
        || str(voiceBehaviorAdaptation.perceived_listening_signal) === "high";
}

function isPoorDelivery(voiceBehaviorAdaptation = {}) {
    return str(voiceBehaviorAdaptation.hcp_reaction_modifier) === "harden"
        || str(voiceBehaviorAdaptation.delivery_pressure_signal) === "pressure_increasing"
        || str(voiceBehaviorAdaptation.perceived_listening_signal) === "low";
}

function scoreType(scores, type, points) {
    scores[type] = (scores[type] || 0) + points;
}

function isDominatingOverHalf(history = [], candidate, consistentlyFailing) {
    if (consistentlyFailing) return false;
    const h = arr(history).filter(Boolean);
    if (h.length < 4) return false;
    const future = [...h, candidate];
    const count = future.filter((t) => t === candidate).length;
    return count / future.length > 0.5;
}

/**
 * Response Type Selection Engine
 *
 * selectHcpResponseType({
 *   hcp_state,
 *   previous_response_types,
 *   rep_quality,
 *   voice_behavior_adaptation,
 *   live_temperature,
 *   evaluation,
 * })
 */
/** @param {{ hcp_state?: AnyRecord, previous_response_types?: any[], rep_quality?: string, voice_behavior_adaptation?: AnyRecord, live_temperature?: number, evaluation?: AnyRecord }} [params] */
export function selectHcpResponseType({
    hcp_state,
    previous_response_types = [],
    rep_quality,
    voice_behavior_adaptation = {},
    live_temperature = 5,
    evaluation = {},
} = {}) {
    const hcpState = hcp_state || {};
    const stage = str(hcpState.conversation_stage, "guarded_opening");
    const position = str(hcpState.hcp_position, "guarded");
    const lastType = str(hcpState.last_hcp_response_type);
    const repQuality = str(rep_quality || hcpState.last_rep_quality, "partial");
    const history = dedupeTail(previous_response_types.length ? previous_response_types : hcpState.previous_response_types, 6);
    const consecutiveSame = lastType ? countConsecutiveFromEnd(history, lastType) : 0;
    const tempBand = (() => {
        const t = clamp(Math.round(Number(live_temperature) || 5), 1, 10);
        return t <= 3 ? "low" : t <= 7 ? "mid" : "high";
    })();
    const alignment = evaluation?.hcp_brain_alignment || {};

    const repQualHistory = dedupeTail(hcpState.previous_rep_qualities || [], 6);
    const recentQual = dedupeTail([...repQualHistory, repQuality], 6);
    const recentFailCount = recentQual.slice(-4).filter((q) => isFailingQuality(q)).length;
    const consistentlyFailing = recentFailCount >= 3 || (isFailingQuality(repQuality) && recentFailCount >= 2);

    const hasDiagnosticQuestion = Boolean(hcpState.rep_has_diagnostic_question);
    const hasVagueProductLanguage = Boolean(hcpState.rep_uses_vague_product_language);
    const trustBreakerTriggered = arr(alignment.trust_breakers_triggered).length > 0 || repQuality === "trust_breaker";
    const credibilityDriverShown = arr(alignment.credibility_drivers_demonstrated).length > 0;
    const poorDelivery = isPoorDelivery(voice_behavior_adaptation);
    const strongDelivery = isStrongDelivery(voice_behavior_adaptation);

    let responseTypeReason = "";
    let responseTypeTransitionExplanation = "";

    // Rule-first transitions for clearly repeating weak/improving/strong patterns.
    if (consistentlyFailing) {
        const escalated = nextInSequence(WEAK_ESCALATION, lastType || WEAK_ESCALATION[0]);
        responseTypeReason = "REP quality repeatedly weak/generic; escalating objection pressure.";
        responseTypeTransitionExplanation = `${lastType || "none"} -> ${escalated} due to repeated failure pattern.`;
        return {
            responseType: escalated,
            responseTypeReason,
            responseTypeTransitionExplanation,
        };
    }

    if (repQuality === "improving" && lastType && IMPROVING_SHIFT.includes(lastType)) {
        const shifted = nextInSequence(IMPROVING_SHIFT, lastType);
        const canUseShift = shifted !== lastType
            && !isDominatingOverHalf(history, shifted, false)
            && countConsecutiveFromEnd(history, shifted) < 2;
        if (canUseShift) {
            responseTypeReason = "REP quality improving; shifting from acknowledgment toward deeper clarification/specificity.";
            responseTypeTransitionExplanation = `${lastType} -> ${shifted} for improving REP behavior.`;
            return {
                responseType: shifted,
                responseTypeReason,
                responseTypeTransitionExplanation,
            };
        }
    }

    if (repQuality === "strong" && lastType && STRONG_SHIFT.includes(lastType)) {
        const shifted = nextInSequence(STRONG_SHIFT, lastType);
        const canUseShift = shifted !== lastType
            && !isDominatingOverHalf(history, shifted, false)
            && countConsecutiveFromEnd(history, shifted) < 2;
        if (canUseShift) {
            responseTypeReason = "REP quality strong; moving toward forward-motion response types.";
            responseTypeTransitionExplanation = `${lastType} -> ${shifted} for strong REP behavior.`;
            return {
                responseType: shifted,
                responseTypeReason,
                responseTypeTransitionExplanation,
            };
        }
    }

    // Scored candidate engine for diversity + behavioral alignment.
    const scores = Object.fromEntries(RESPONSE_TYPES.map((t) => [t, 0]));

    // Base stage-position priors.
    const stageBias = {
        guarded_opening: ["restate_surface_concern", "ask_for_specificity"],
        resistance_surface: ["sharpen_objection", "challenge_assumption", "ask_for_specificity"],
        concern_clarification: ["acknowledge_partial_progress", "ask_for_specificity", "reveal_hidden_barrier"],
        deeper_barrier_reveal: ["reveal_hidden_barrier", "acknowledge_partial_progress", "conditionally_open"],
        conditional_openness: ["conditionally_open", "permission_to_continue", "soft_next_step"],
        next_step_consideration: ["soft_next_step", "permission_to_continue", "conditionally_open"],
        stalled: ["challenge_assumption", "ask_for_specificity", "sharpen_objection"],
        disengaging: ["disengage", "sharpen_objection"],
    };
    for (const type of stageBias[stage] || ["ask_for_specificity"]) scoreType(scores, type, 2);

    if (position === "resistant" || Number(hcpState.resistance_level || 0) >= 7) {
        ["restate_surface_concern", "sharpen_objection", "challenge_assumption"].forEach((t) => scoreType(scores, t, 2));
    }
    if (Number(hcpState.trust_level || 0) >= 6) {
        ["acknowledge_partial_progress", "conditionally_open", "permission_to_continue"].forEach((t) => scoreType(scores, t, 2));
    }
    if (Number(hcpState.openness_level || 0) >= 6) {
        ["soft_next_step", "permission_to_continue", "conditionally_open"].forEach((t) => scoreType(scores, t, 2));
    }
    if (Number(hcpState.patience_level || 0) <= 2) {
        ["disengage", "sharpen_objection"].forEach((t) => scoreType(scores, t, 3));
    }

    // REP behavior mapping.
    if (isFailingQuality(repQuality)) {
        ["restate_surface_concern", "sharpen_objection", "challenge_assumption"].forEach((t) => scoreType(scores, t, 3));
    }
    if (repQuality === "improving") {
        ["acknowledge_partial_progress", "reveal_hidden_barrier", "ask_for_specificity"].forEach((t) => scoreType(scores, t, 3));
    }
    if (repQuality === "strong") {
        ["conditionally_open", "permission_to_continue", "soft_next_step"].forEach((t) => scoreType(scores, t, 3));
    }

    if (hasDiagnosticQuestion) {
        ["reveal_hidden_barrier", "ask_for_specificity"].forEach((t) => scoreType(scores, t, 3));
    }
    if (hasVagueProductLanguage) {
        ["challenge_assumption", "sharpen_objection"].forEach((t) => scoreType(scores, t, 3));
    }
    if (trustBreakerTriggered) {
        ["sharpen_objection", "disengage"].forEach((t) => scoreType(scores, t, 4));
    }
    if (credibilityDriverShown) {
        ["acknowledge_partial_progress", "conditionally_open"].forEach((t) => scoreType(scores, t, 3));
    }

    // Temperature mapping.
    if (tempBand === "high") {
        ["challenge_assumption", "sharpen_objection", "disengage"].forEach((t) => scoreType(scores, t, 3));
        ["conditionally_open", "soft_next_step"].forEach((t) => scoreType(scores, t, -2));
    } else if (tempBand === "low") {
        ["acknowledge_partial_progress", "conditionally_open", "soft_next_step"].forEach((t) => scoreType(scores, t, 3));
    }

    // Voice mapping.
    if (poorDelivery) {
        ["challenge_assumption", "sharpen_objection"].forEach((t) => scoreType(scores, t, 3));
    }
    if (strongDelivery) {
        ["acknowledge_partial_progress", "reveal_hidden_barrier", "conditionally_open"].forEach((t) => scoreType(scores, t, 2));
    }

    // Anti-repetition hard rule: no more than 2 identical in a row.
    if (lastType && consecutiveSame >= 2) {
        scoreType(scores, lastType, -100);
    }

    // Diversity pressure: avoid >50% domination unless consistently failing.
    for (const type of RESPONSE_TYPES) {
        if (isDominatingOverHalf(history, type, consistentlyFailing)) {
            scoreType(scores, type, -8);
        }
    }

    const ranked = [...RESPONSE_TYPES].sort((a, b) => scores[b] - scores[a]);
    let responseType = ranked[0] || "restate_surface_concern";

    // Enforce non-repetition when repetition would exceed 2 consecutive.
    if (lastType && consecutiveSame >= 2 && responseType === lastType) {
        const alt = ranked.find((t) => t !== lastType) || "ask_for_specificity";
        responseType = alt;
    }

    // If REP improved after repeated type, force upgrade to advanced compatible type.
    if (repQuality === "improving" && lastType && countConsecutiveFromEnd(history, lastType) >= 2) {
        const forced = ["acknowledge_partial_progress", "reveal_hidden_barrier", "ask_for_specificity"].find((t) => t !== lastType);
        if (forced) responseType = forced;
    }
    if (repQuality === "strong" && lastType && countConsecutiveFromEnd(history, lastType) >= 2) {
        const forced = ["conditionally_open", "permission_to_continue", "soft_next_step"].find((t) => t !== lastType);
        if (forced) responseType = forced;
    }

    responseTypeReason = [
        `stage=${stage}`,
        `rep_quality=${repQuality}`,
        `temperature=${tempBand}`,
        `voice=${str(voice_behavior_adaptation.hcp_reaction_modifier, "hold")}`,
        hasDiagnosticQuestion ? "diagnostic_question=yes" : "diagnostic_question=no",
        hasVagueProductLanguage ? "vague_language=yes" : "vague_language=no",
        trustBreakerTriggered ? "trust_breaker=yes" : "trust_breaker=no",
        credibilityDriverShown ? "credibility_driver=yes" : "credibility_driver=no",
    ].join("; ");
    responseTypeTransitionExplanation = `${lastType || "none"} -> ${responseType}; top_candidates=${ranked.slice(0, 3).join(",")}; score=${scores[responseType]}`;

    return {
        responseType,
        responseTypeReason,
        responseTypeTransitionExplanation,
    };
}

// ─── Response text templates ──────────────────────────────────────────────────

function pickBarrierText(hcpState, hcpBrain) {
    // Primary from unresolved/partial, fallback to brain's likely objection
    const primary = hcpState.current_primary_barrier
        || str(arr(hcpBrain?.likely_objections?.key_factors)[0], "workflow and access burden in our practice");
    // Shorten for in-line use
    const words = primary.split(/\s+/);
    return words.slice(0, 12).join(" ").replace(/\.$/, "");
}

function pickRevealedBarrier(hcpState, hcpBrain) {
    const revealed = arr(hcpState.revealed_concerns)[0]
        || arr(hcpState.hidden_concerns)[0]
        || str(arr(hcpBrain?.clinician_perspective?.trust_breakers)[0], "the downstream workflow impact on our team");
    const words = revealed.split(/\s+/);
    return words.slice(0, 12).join(" ").replace(/\.$/, "");
}

function pickCredibilityHook(hcpBrain) {
    const driver = str(arr(hcpBrain?.clinician_perspective?.clinical_credibility_drivers)[0],
        "understanding of workflow constraints");
    const words = driver.split(/\s+/);
    return words.slice(0, 10).join(" ").toLowerCase().replace(/\.$/, "");
}

function clipToSentenceCount(text = "", maxSentences = 2) {
    const cleaned = str(text).replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    const sentences = cleaned.match(/[^.!?]+[.!?]?/g) || [cleaned];
    return sentences.slice(0, maxSentences).join(" ").trim();
}

function hasWorkflowAnchor(text = "") {
    return /\bstaff\b|\bworkflow\b|\bhandoff\b|\bcallback\b|\bprocess\b|\bprior auth\b|\boffice\b|\bteam\b/.test(str(text).toLowerCase());
}

function hasPersonaAnchor(text = "") {
    return /\bpatients?\b|\bpractice\b|\bclinic\b|\bstaff\b|\bworkflow\b|\bformulary\b|\bprior auth\b|\bcase\b/.test(str(text).toLowerCase());
}

/** @param {{ line?: string, hcpState?: AnyRecord, hcpBrain?: AnyRecord }} [params] */
export function validateWorkflowPlausibility({ line, hcpState, hcpBrain } = {}) {
    const text = str(line);
    const state = str(hcpState?.conversation_stage).toLowerCase();
    const mentionsOperationalConstraint = includesAny(
        [
            hcpState?.current_primary_barrier,
            hcpState?.current_secondary_barrier,
            ...(arr(hcpState?.unresolved_concerns || [])),
            ...(arr(hcpBrain?.pressure_signals?.key_factors || [])),
        ].join(" "),
        ["workflow", "staff", "prior auth", "access", "callback", "handoff", "operational", "process"]
    );

    if (!mentionsOperationalConstraint) {
        return { pass: true, reason: "no_operational_constraint_detected" };
    }

    const needsAnchor = ["guarded_opening", "resistance_surface", "concern_clarification", "stalled"].includes(state);
    const pass = !needsAnchor || hasWorkflowAnchor(text);
    return {
        pass,
        reason: pass ? "workflow_anchor_present" : "missing_workflow_anchor",
    };
}

/** @param {{ line?: string, hcpState?: AnyRecord, hcpBrain?: AnyRecord }} [params] */
export function validatePersonaFit({ line, hcpState, hcpBrain } = {}) {
    const text = str(line);
    const personaSignals = [
        hcpBrain?.persona?.name,
        hcpBrain?.persona?.profile,
        ...(arr(hcpBrain?.clinician_perspective?.decision_lens || [])),
    ].join(" ").toLowerCase();
    const resistantState = Number(hcpState?.resistance_level || 0) >= 7;
    const pass = hasPersonaAnchor(text) || (!resistantState && text.split(/\s+/).length >= 7);

    if (personaSignals.includes("community") && !/\bpractice\b|\boffice\b|\bstaff\b|\bpatients?\b/.test(text.toLowerCase())) {
        return { pass: false, reason: "community_persona_missing_context" };
    }

    return {
        pass,
        reason: pass ? "persona_anchor_present" : "missing_persona_anchor",
    };
}

/** @param {{ line?: string, hcpState?: AnyRecord, liveTemperature?: number }} [params] */
export function enforcePressureBehavior({ line, hcpState, liveTemperature = 5 } = {}) {
    const text = str(line);
    if (!text) return text;

    const temp = clamp(Math.round(Number(liveTemperature) || 5), 1, 10);
    const highPressure = temp >= 8 || Number(hcpState?.patience_level || 0) <= 3 || Number(hcpState?.resistance_level || 0) >= 8;
    if (!highPressure) return clipToSentenceCount(text, 2);

    let normalized = text
        .replace(/^\s*(i appreciate[^.?!]*[.?!]\s*)/i, "")
        .replace(/^\s*(thanks[^.?!]*[.?!]\s*)/i, "")
        .replace(/^\s*(okay[, ]+)?/i, "");

    return clipToSentenceCount(normalized, 2);
}

/** @param {{ line?: string, hcpState?: AnyRecord }} [params] */
export function enforceJourneyStageBehavior({ line, hcpState } = {}) {
    const text = str(line);
    if (!text) return text;

    const stage = str(hcpState?.conversation_stage, "guarded_opening");
    if (stage === "guarded_opening" || stage === "resistance_surface") {
        if (/\bwould you be open\b|\bnext step\b|\bschedule\b|\bfollow-up\b/.test(text.toLowerCase())) {
            return clipToSentenceCount(text, 2);
        }
    }

    if (stage === "next_step_consideration" && !/\bnext step\b|\breview\b|\bopen to\b|\bfollow-up\b|\bone patient\b/.test(text.toLowerCase())) {
        return clipToSentenceCount(text, 2);
    }

    return clipToSentenceCount(text, 2);
}

/**
 * Generates the HCP next response based on response_type and state.
 * Returns { hcp_statement, hcp_response_type, hcp_progression_explanation }.
 */
/** @param {{ responseType?: string, hcpState?: AnyRecord, hcpBrain?: AnyRecord, liveTemperature?: number, conversationMemory?: AnyRecord }} [params] */
export function generateHcpResponse({
    responseType,
    hcpState,
    hcpBrain,
    liveTemperature = 5,
    conversationMemory = {},
    repResponseTranscript = "",
    scenarioContext = {},
} = {}) {
    const temp = clamp(Math.round(Number(liveTemperature) || 5), 1, 10);
    const band = temp <= 3 ? "low" : temp <= 7 ? "mid" : "high";
    const barrier = pickBarrierText(hcpState, hcpBrain);
    const revealedBarrier = pickRevealedBarrier(hcpState, hcpBrain);
    const credibilityHook = pickCredibilityHook(hcpBrain);
    const stage = hcpState.conversation_stage;
    const repQuality = hcpState.last_rep_quality;
    const previousHcpLine = str(
        hcpState.last_hcp_response_text || conversationMemory.last_hcp_response_text,
        "",
    );

    // Resistance/patience-aware sentence suffix
    const urgencyTag = hcpState.patience_level <= 3
        ? " I don't have much more time for this today."
        : "";

    let hcp_statement = "";
    let hcp_progression_explanation = "";

    switch (responseType) {
        case "restate_surface_concern": {
            const variants = [
                `That still doesn't speak to the ${barrier}.`,
                `I keep coming back to the same question — what actually changes for my staff around ${barrier}?`,
                `That sounds reasonable in theory, but the practical issue is still ${barrier}.`,
            ];
            hcp_statement = variants[hcpState.trust_level % variants.length];
            hcp_progression_explanation = "HCP restates core surface concern — REP has not yet addressed it specifically enough.";
            break;
        }
        case "sharpen_objection": {
            const variants = [
                `You moved past the concern too quickly. The issue isn't general workflow — it's specifically ${barrier}.`,
                `I'm not dismissing it, but you're still talking at the category level. My issue is ${barrier}.`,
                `That still feels broad. If you can't speak specifically to ${barrier}, this probably isn't worth more time today.`,
            ];
            // Pick by trust level to vary response across turns
            hcp_statement = variants[hcpState.resistance_level % variants.length] + urgencyTag;
            hcp_progression_explanation = "HCP sharpens the objection — response was too broad relative to the actual barrier.";
            break;
        }
        case "reveal_hidden_barrier": {
            const variants = [
                `You're addressing part of it, but the deeper blocker is actually ${revealedBarrier}. That's what slows decisions in this clinic.`,
                `Let me be direct: the surface issue isn't the real one. The bigger barrier is ${revealedBarrier}, and that's what needs a practical answer.`,
                `This is closer, but the true constraint sits underneath the surface concern: ${revealedBarrier}. That's where implementation breaks down.`,
            ];
            const idx = (hcpState.repetition_count + hcpState.trust_level + hcpState.openness_level) % variants.length;
            hcp_statement = `${variants[idx]}${urgencyTag}`;
            hcp_progression_explanation = "REP demonstrated enough credibility for HCP to reveal a deeper, previously hidden barrier.";
            break;
        }
        case "acknowledge_partial_progress": {
            const variants = [
                `That's closer to the issue. I'm not fully there yet, but you're addressing the right area around ${barrier}.`,
                `Okay, I can hear that you understand part of the concern. The workflow side is clearer now. I still need to understand the ${revealedBarrier || barrier} before I'm ready to move.`,
            ];
            hcp_statement = variants[hcpState.openness_level % variants.length];
            hcp_progression_explanation = "REP showed partial alignment — HCP acknowledges progress but is not yet ready to move forward.";
            break;
        }
        case "challenge_assumption": {
            const variants = [
                `You're assuming the bottleneck is on the prescribing side. It's not. It's ${barrier} — and I haven't heard anything that addresses that yet.`,
                `I think you may be solving the wrong problem. What I need is someone who understands ${barrier}, not just the clinical side.`,
                `You're still framing this as a clinical question. For me, it's an operational one — specifically ${barrier}.`,
            ];
            hcp_statement = variants[(hcpState.resistance_level + hcpState.trust_level) % variants.length] + urgencyTag;
            hcp_progression_explanation = "HCP challenges the rep's underlying assumption — the framing doesn't match the actual barrier.";
            break;
        }
        case "ask_for_specificity": {
            const variants = [
                `I can follow where you're going, but I need more specificity. What exactly would change regarding ${barrier} — for my team specifically, not in general?`,
                `That's a reasonable framing. But help me understand: where does this actually make a difference on ${barrier}? I need that to be concrete.`,
                `Okay. If I were to test this with one patient, what would I tell my staff about ${barrier}? What's the specific answer?`,
            ];
            hcp_statement = variants[hcpState.openness_level % variants.length];
            hcp_progression_explanation = "HCP is engaged but demands specificity before progressing — generic answers won't move this forward.";
            break;
        }
        case "conditionally_open": {
            hcp_statement = `I'm willing to look at this more closely — but only if we stay focused on ${barrier}. If you can show me where that specifically gets simpler, I'd consider it.`;
            if (band === "high") {
                hcp_statement = `I'm not saying no. But at this practice, the only way this moves forward is if you can address ${barrier} directly. Conditional yes — but the bar is high.`;
            }
            hcp_progression_explanation = "REP earned conditional openness — HCP is willing to explore with clear conditions attached.";
            break;
        }
        case "permission_to_continue": {
            hcp_statement = `I'll give you a minute more. But focus on ${barrier} — that's what determines whether this is relevant to how I practice.`;
            hcp_progression_explanation = "HCP grants permission to continue but sets a tight relevance gate.";
            break;
        }
        case "soft_next_step": {
            hcp_statement = `If you can keep this at the level of specificity you just used, I'd be open to a follow-up focused on ${barrier}. Send me something brief and practical — one page, not a slide deck.`;
            if (band === "high") {
                hcp_statement = `That's practical. If you can commit to a focused conversation on ${barrier} — not a full presentation — I'd look at one patient profile where this might fit.`;
            }
            hcp_progression_explanation = "REP earned a soft next step — HCP is willing to move forward on specific, practical terms.";
            break;
        }
        case "disengage": {
            const variants = [
                `I have to get back. If this doesn't address ${barrier} directly, I'm not sure this is the right fit right now.`,
                `We're out of time. I need to see something specific on ${barrier} before we take this further.`,
                `I appreciate the effort, but we haven't gotten to the core issue. Reach back out when you have something concrete on ${barrier}.`,
            ];
            hcp_statement = variants[hcpState.resistance_level % variants.length];
            hcp_progression_explanation = "HCP disengages due to repeated lack of progress or time exhaustion.";
            break;
        }
        default: {
            hcp_statement = `I still need to understand what specifically changes around ${barrier} before I can move forward.`;
            hcp_progression_explanation = "HCP holds position pending more specific information.";
        }
    }

    hcp_statement = enforcePressureBehavior({
        line: hcp_statement,
        hcpState,
        liveTemperature,
    });

    hcp_statement = enforceJourneyStageBehavior({
        line: hcp_statement,
        hcpState,
    });

    const workflowValidation = validateWorkflowPlausibility({
        line: hcp_statement,
        hcpState,
        hcpBrain,
    });
    if (!workflowValidation.pass) {
        hcp_progression_explanation = `${hcp_progression_explanation} Workflow plausibility warning: ${workflowValidation.reason}.`.trim();
    }

    const personaValidation = validatePersonaFit({
        line: hcp_statement,
        hcpState,
        hcpBrain,
    });
    if (!personaValidation.pass) {
        hcp_progression_explanation = `${hcp_progression_explanation} Persona-fit warning: ${personaValidation.reason}.`.trim();
    }

    if (isNearDuplicateResponse(hcp_statement, previousHcpLine)) {
        const varied = forceNonRepeatingVariation({
            hcpState,
            hcpBrain,
            liveTemperature,
            previousLine: previousHcpLine,
            candidateLine: hcp_statement,
        });
        hcp_statement = isNearDuplicateResponse(varied, previousHcpLine)
            ? clipToSentenceCount(`I still need one concrete reason this changes ${barrier}.`, liveTemperature >= 8 ? 1 : 2)
            : varied;
        hcp_progression_explanation = `${hcp_progression_explanation} Text-level anti-repetition variation applied.`.trim();
    }

    const antiLoopEnforcement = enforceDeterministicAntiLoop({
        hcpStatement: hcp_statement,
        hcpState,
        hcpBrain,
        liveTemperature,
        conversationMemory,
        scenarioContext,
    });
    hcp_statement = clipToSentenceCount(str(antiLoopEnforcement.line, hcp_statement), liveTemperature >= 8 ? 2 : 2);

    // Final global guard: never allow generated HCP line to drift away from the rep's latest topic.
    hcp_statement = enforceRepTranscriptAlignment(hcp_statement, repResponseTranscript, hcpState, conversationMemory, scenarioContext);
    if (isNearDuplicateResponse(hcp_statement, previousHcpLine)) {
        const topic = inferRepTopic(repResponseTranscript);
        hcp_statement = clipToSentenceCount(buildTopicRepeatBreaker(topic, repResponseTranscript, hcpState, conversationMemory, scenarioContext), 2);
        hcp_progression_explanation = `${hcp_progression_explanation} Final topic-preserving duplicate breaker applied.`.trim();
    }

    // Full-session uniqueness guard (not just prior turn) to prevent repeated stock lines.
    const sessionHistory = dedupeTail([
        ...arr(conversationMemory?.hcp_response_history || []),
        ...arr(hcpState?.hcp_response_history || []),
    ], 8).filter(Boolean);
    if (hasSessionNearDuplicate(hcp_statement, sessionHistory)) {
        const currentBucket = inferIntentBucketFromLine(hcp_statement, hcpState, hcpBrain);
        const lanePolicy = buildScenarioLanePolicy({ hcpState, conversationMemory, scenarioContext });
        const rotatedBucket = nextIntentBucket(
            lanePolicy.allowedBuckets.includes(currentBucket) ? currentBucket : lanePolicy.primaryBucket,
            lanePolicy.allowedBuckets,
        );
        const variationSeed = sessionHistory.length + Number(hcpState?.anti_loop_intervention_count || 0);
        hcp_statement = clipToSentenceCount(buildForcedBucketLine({
            targetBucket: rotatedBucket,
            barrier,
            revealedBarrier,
            variationSeed,
            liveTemperature,
        }), 2);
        hcp_progression_explanation = `${hcp_progression_explanation} Full-session anti-repeat guard rotated the prompt lane.`.trim();
    }

    if (antiLoopEnforcement.anti_loop_intervention_triggered) {
        hcp_progression_explanation = `${hcp_progression_explanation} Deterministic anti-loop intervention applied (${antiLoopEnforcement.anti_loop_intervention_reason}).`.trim();
    }

    return {
        hcp_statement: hcp_statement.trim(),
        hcp_response_type: responseType,
        hcp_progression_explanation,
        anti_loop_intervention_triggered: Boolean(antiLoopEnforcement.anti_loop_intervention_triggered),
        anti_loop_intervention_reason: str(antiLoopEnforcement.anti_loop_intervention_reason, "none"),
        intent_bucket: str(antiLoopEnforcement.intent_bucket, inferIntentBucketFromLine(hcp_statement, hcpState, hcpBrain)),
        semantic_similarity_max: Number(antiLoopEnforcement.semantic_similarity_max || 0),
        trailing_bucket_run: Number(antiLoopEnforcement.trailing_bucket_run || 0),
    };
}

// ─── Public orchestrator ──────────────────────────────────────────────────────

/**
 * Full pipeline: given previous state + evaluation → update state → generate response.
 * Returns the enriched evaluation fields to merge into the response payload.
 *
 * Usage in engine.js:
 *   const stateResult = computeHcpStateProgression({ hcpBrain, previousHcpState, evaluation, voiceBehaviorAdaptation, liveTemperature, conversationMemory });
 */
/** @param {{ hcpBrain?: AnyRecord, previousHcpState?: AnyRecord, repResponseTranscript?: string, evaluation?: AnyRecord, voiceBehaviorAdaptation?: AnyRecord, liveTemperature?: number, conversationMemory?: AnyRecord }} [params] */
export function computeHcpStateProgression({
    hcpBrain,
    previousHcpState,
    repResponseTranscript = "",
    evaluation = {},
    voiceBehaviorAdaptation = {},
    liveTemperature = 5,
    conversationMemory = {},
    scenarioContext = {},
} = {}) {
    const previous = previousHcpState || buildInitialHcpState(hcpBrain, liveTemperature);

    // 1. Update state
    const { newState, delta } = updateHcpState({
        hcpBrain,
        previousHcpState,
        repResponseTranscript,
        evaluation,
        voiceBehaviorAdaptation,
        liveTemperature,
        conversationMemory,
    });

    const trajectoryEnforcement = enforceRealismTrajectory({
        previousState: previous,
        nextState: newState,
        liveTemperature,
    });
    const adjustedState = /** @type {AnyRecord} */ ({
        ...trajectoryEnforcement.nextState,
        realism_trajectory_enforced: trajectoryEnforcement.realism_trajectory_enforced,
        realism_trajectory_reason: trajectoryEnforcement.realism_trajectory_reason,
    });

    // 2. Select response type
    const selection = selectHcpResponseType({
        hcp_state: adjustedState,
        previous_response_types: dedupeTail([
            ...(arr(conversationMemory?.response_type_history).slice(-6)),
            ...arr(adjustedState.previous_response_types).slice(-6),
        ], 6),
        rep_quality: adjustedState.last_rep_quality,
        voice_behavior_adaptation: voiceBehaviorAdaptation,
        live_temperature: liveTemperature,
        evaluation,
    });
    const responseType = selection.responseType;

    // 3. Generate response
    const responseResult = generateHcpResponse({
        responseType,
        hcpState: adjustedState,
        hcpBrain,
        liveTemperature,
        conversationMemory,
        repResponseTranscript,
        scenarioContext,
    });

    // 4. Stamp response type into state
    const finalHistory = dedupeTail([
        ...arr(adjustedState.previous_response_types),
        responseType,
    ], 6);
    const finalResponseHistory = dedupeTail([
        ...arr(adjustedState.hcp_response_history),
        str(responseResult.hcp_statement, ""),
    ], 8);
    const finalIntentHistory = dedupeTail([
        ...arr(adjustedState.intent_bucket_history),
        str(responseResult.intent_bucket, inferIntentBucketFromLine(responseResult.hcp_statement, adjustedState, hcpBrain)),
    ], 8);
    const finalState = {
        ...adjustedState,
        last_hcp_response_type: responseType,
        last_hcp_response_text: str(responseResult.hcp_statement, ""),
        previous_response_types: finalHistory,
        hcp_response_history: finalResponseHistory,
        intent_bucket_history: finalIntentHistory,
        anti_loop_intervention_count: Number(adjustedState.anti_loop_intervention_count || 0) + (responseResult.anti_loop_intervention_triggered ? 1 : 0),
    };

    return {
        hcp_state: finalState,
        hcp_state_delta: delta,
        hcp_response_type: responseType,
        response_type_reason: selection.responseTypeReason,
        previous_response_types: finalHistory,
        response_type_transition_explanation: selection.responseTypeTransitionExplanation,
        hcp_progression_explanation: responseResult.hcp_progression_explanation,
        simulated_hcp_next_response: responseResult.hcp_statement,
        anti_loop_intervention_triggered: Boolean(responseResult.anti_loop_intervention_triggered),
        anti_loop_intervention_reason: str(responseResult.anti_loop_intervention_reason, "none"),
        intent_bucket: str(responseResult.intent_bucket, "workflow"),
        semantic_similarity_max: Number(responseResult.semantic_similarity_max || 0),
        trailing_bucket_run: Number(responseResult.trailing_bucket_run || 0),
    };
}
