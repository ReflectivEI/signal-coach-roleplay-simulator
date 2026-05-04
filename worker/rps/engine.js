import { computeHcpStateProgression, buildInitialHcpState } from "./hcpState.js";

function text(value, fallback = "") {
    const out = String(value ?? "").trim();
    return out || fallback;
}

function asNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function unique(items) {
    return [...new Set((items || []).filter(Boolean))];
}

function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalize(value = "") {
    return text(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function clampDelta(value) {
    return clamp(Math.round(asNumber(value, 0)), -2, 2);
}

function quoteRepPhrase(line = "") {
    const cleaned = text(line);
    if (!cleaned) return "(no rep phrase captured)";
    const sentence = cleaned.split(/[.!?]/).map((part) => part.trim()).find(Boolean) || cleaned;
    return sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
}

const BANNED_GENERIC = [
    /tell me more about your product/i,
    /how is this different\??/i,
    /i\s*'?m skeptical/i,
    /can you provide evidence\??/i,
    /this seems interesting/i,
];

export function mapTemperatureToBehavior(level) {
    const clamped = clamp(Math.round(asNumber(level, 5)), 1, 10);
    if (clamped <= 3) {
        return {
            level: clamped,
            band: "low",
            traits: ["open but realistic", "clarifying", "conditionally collaborative"],
            cueIntensity: "moderate",
            resistanceDepth: "shallow",
            willingnessToAnswerFollowUps: "high",
            partialAgreementLikelihood: "high",
            commitmentThreshold: "medium",
            specificityThreshold: "moderate",
            postRepShiftBehavior: "softens with good cue alignment",
        };
    }
    if (clamped <= 7) {
        return {
            level: clamped,
            band: "mid",
            traits: ["selective", "practically skeptical", "relevance-gated"],
            cueIntensity: "high",
            resistanceDepth: "moderate",
            willingnessToAnswerFollowUps: "conditional",
            partialAgreementLikelihood: "moderate",
            commitmentThreshold: "moderate-high",
            specificityThreshold: "high",
            postRepShiftBehavior: "neutral unless REP earns engagement",
        };
    }
    return {
        level: clamped,
        band: "high",
        traits: ["resistant", "compressed", "constraint-driven"],
        cueIntensity: "very_high",
        resistanceDepth: "deep",
        willingnessToAnswerFollowUps: "low",
        partialAgreementLikelihood: "low",
        commitmentThreshold: "very_high",
        specificityThreshold: "very_high",
        postRepShiftBehavior: "hardens quickly if cue is missed",
    };
}

function rubricTemplate() {
    return [
        { metric: "Context Awareness", what_good_looks_like: "Uses journey, disease, pressure, and access context naturally.", common_miss: "Generic message detached from practical constraints." },
        { metric: "Cue Recognition", what_good_looks_like: "Addresses primary cue and hidden resistance.", common_miss: "Responds to surface words only." },
        { metric: "Empathy / Acknowledgment", what_good_looks_like: "Acknowledges practical concern without stalling.", common_miss: "Canned empathy or no acknowledgment." },
        { metric: "Strategic Questioning", what_good_looks_like: "Asks one precise open question to reveal decision criteria.", common_miss: "No question or unfocused closed question." },
        { metric: "Evidence Framing", what_good_looks_like: "Frames evidence against this HCP's real barrier.", common_miss: "Data dump or vague efficacy language." },
        { metric: "Objection Handling", what_good_looks_like: "Names concern, narrows it, responds without overclaim.", common_miss: "Deflects concern or argues." },
        { metric: "Conversational Control", what_good_looks_like: "Advances next step matched to resistance level.", common_miss: "Stall loop or premature close." },
        { metric: "Tone / Pace / Confidence", what_good_looks_like: "Measured and temperature-aligned delivery.", common_miss: "Rushed, hesitant, or mismatched tone." },
    ];
}

function buildLayeredCue(payload = {}, temp = mapTemperatureToBehavior(5), memory = {}) {
    const pressure = normalize(payload.interaction_pressure || "operationally_constrained");
    const access = normalize(payload.access_barrier_context || "");
    const unresolved = Array.isArray(memory.unresolved_cues) ? memory.unresolved_cues : [];
    const priorMisses = Array.isArray(memory.prior_rep_moves)
        ? memory.prior_rep_moves.filter((move) => /ignored cue|vague evidence|overpitch|no question|early close/i.test(String(move))).length
        : 0;

    const primary_cue = pressure.includes("time")
        ? "Low perceived differentiation under time pressure"
        : pressure.includes("skept")
            ? "Low confidence in claim relevance"
            : pressure.includes("access")
                ? "Workflow/access friction"
                : "Decision-risk and practical fit uncertainty";

    const secondary_cue = access.includes("prior")
        ? "Prior authorization and callback burden"
        : access.includes("formulary")
            ? "Formulary process uncertainty"
            : "Clinic workflow burden";

    const hidden_resistance = priorMisses > 0 || unresolved.length
        ? "Prior negative experience with broad claims and unresolved workflow concerns"
        : "Concern that discussion will not change Monday-morning decisions";

    const lastVoiceAdaptation = memory.last_voice_adaptation || (Array.isArray(memory.voice_adaptation_history) ? memory.voice_adaptation_history[memory.voice_adaptation_history.length - 1] : null);
    const reactionModifier = text(lastVoiceAdaptation?.hcp_reaction_modifier, "hold");

    let openness_level = temp.band === "low" ? "Conditional" : temp.band === "mid" ? "Guarded" : "Minimal";
    let emotional_tone = temp.band === "high" ? "Compressed, mildly frustrated" : temp.band === "mid" ? "Professional but skeptical" : "Open but cautious";
    let likely_reason_for_pushback = temp.band === "high"
        ? "Time and staff burden outweigh perceived value unless rep is highly specific"
        : "Unclear practical relevance to current workflow and patient processing pressure";

    if (reactionModifier === "harden") {
        openness_level = temp.band === "low" ? "Conditional-Guarded" : "Minimal";
        emotional_tone = temp.band === "high" ? "Guarded and compressed under perceived delivery pressure" : "More guarded due to rushed framing";
        likely_reason_for_pushback = `${likely_reason_for_pushback}; delivery felt rushed or not fully consultative.`;
    }
    if (reactionModifier === "soften") {
        openness_level = temp.band === "high" ? "Guarded" : "Conditional";
        emotional_tone = temp.band === "high" ? "Still cautious, slightly less guarded" : "Open and practical";
    }

    return {
        primary_cue,
        secondary_cue,
        hidden_resistance,
        openness_level,
        emotional_tone,
        likely_reason_for_pushback,
        what_the_rep_must_detect: "The HCP is testing practical decision impact under constraints, not asking for more product features.",
    };
}

function defaultConversationMemory(payload = {}) {
    return {
        prior_rep_moves: Array.isArray(payload.prior_rep_moves) ? payload.prior_rep_moves : [],
        prior_hcp_reactions: Array.isArray(payload.prior_hcp_reactions) ? payload.prior_hcp_reactions : [],
        unresolved_cues: Array.isArray(payload.unresolved_cues) ? payload.unresolved_cues : [],
        addressed_cues: Array.isArray(payload.addressed_cues) ? payload.addressed_cues : [],
        delivery_trend: text(payload.delivery_trend, "neutral"),
        perceived_listening_trend: text(payload.perceived_listening_trend, "neutral"),
        resistance_trend: text(payload.resistance_trend, "stable"),
        trust_trend: text(payload.trust_trend, "neutral"),
        openness_trend: text(payload.openness_trend, "neutral"),
        voice_adaptation_history: Array.isArray(payload.voice_adaptation_history) ? payload.voice_adaptation_history : [],
        last_voice_adaptation: payload.last_voice_adaptation || null,
        last_commitment_attempt: text(payload.last_commitment_attempt, "none"),
        hcp_state: payload.hcp_state || null,
    };
}

function generateRealisticHcpLine(temp, layeredCue, memory) {
    const hardening = /up|rising|increasing/i.test(text(memory.resistance_trend));
    const lastVoiceAdaptation = memory.last_voice_adaptation || (Array.isArray(memory.voice_adaptation_history) ? memory.voice_adaptation_history[memory.voice_adaptation_history.length - 1] : null);
    const reactionModifier = text(lastVoiceAdaptation?.hcp_reaction_modifier, "hold");
    const deliveryPressure = text(lastVoiceAdaptation?.delivery_pressure_signal, "neutral");

    const lowLines = [
        "I'm not opposed to looking at it, I just need to know where this changes what my team does on Monday morning.",
        "In theory that sounds reasonable. Where does this actually reduce work for staff, not add another step?",
        "I can give this a minute. Is the difference mainly in access handling or patient fit?",
    ];

    const midLines = [
        "I've heard similar framing before, so help me understand what decision this changes in real clinic flow.",
        "That may be true in aggregate, but my bottleneck is still the access piece. Where does your approach move that?",
        "I can listen, but keep it practical - what's different for staff workload, specifically?",
    ];

    const highLines = [
        "I have about a minute. If this adds one more access step, it's not usable for us.",
        "We've tried versions of this story before. Unless this changes the prior-auth friction, it won't move.",
        "I'm not dismissing it - I'm saying I'm not seeing the operational difference yet.",
    ];

    const holdLines = [
        "Maybe. I still need to understand where this fits practically for staff workload.",
        "I can listen, but I need clearer practical relevance before moving this further.",
    ];
    const hardenLines = [
        "That still feels broad relative to the workflow concern.",
        "You moved quickly past the concern. What exactly changes for my staff?",
        "I'm not sure this addressed the operational barrier yet.",
    ];
    const softenLines = [
        "Okay, that's closer to the issue.",
        "That's a fair way to frame it under our workflow constraints.",
        "If we stay this specific, I can consider where it might fit.",
    ];

    let set = temp.band === "low" ? lowLines : temp.band === "mid" ? midLines : highLines;
    if (reactionModifier === "harden") set = hardenLines;
    if (reactionModifier === "soften") set = softenLines;
    if (reactionModifier === "hold") set = [...set, ...holdLines];
    const base = set[(Date.now() + set.length) % set.length];
    if ((hardening || deliveryPressure === "pressure_increasing") && temp.band !== "low") {
        return `${base} Right now it still sounds high-level.`;
    }

    if (layeredCue.secondary_cue.toLowerCase().includes("prior")) {
        return `${base} Most of the drag for us is in prior-auth callbacks.`;
    }

    return base;
}

function detectQuestionDeliverySignal(line = "", questionCountFromVoice = 0) {
    const normalized = normalize(line);
    const questionMarks = (line.match(/\?/g) || []).length;
    const questionWordCount = (normalized.match(/\b(what|how|which|where|when|why|would|could|can|is|are|do|does)\b/g) || []).length;
    const diagnostic = /\b(barrier|reason|workflow|access|prior auth|patient type|decision|criteria|staff|callback|fit|friction)\b/.test(normalized) && (questionMarks > 0 || questionWordCount > 0);

    if (questionMarks === 0 && questionCountFromVoice === 0) return "no_question";
    if (questionMarks >= 2 || questionWordCount >= 3) return "overloaded_question";
    if (diagnostic) return "diagnostic_question";
    return "closed_question";
}

function detectConfidenceSignal(line = "") {
    const normalized = normalize(line);
    const hedgingCount = (normalized.match(/\b(i think|maybe|kind of|sort of|hopefully|probably|might)\b/g) || []).length;
    const overconfidentCount = (normalized.match(/\b(definitely|guaranteed|obviously|you should|certainly|no doubt)\b/g) || []).length;

    if (hedgingCount >= 2 && hedgingCount > overconfidentCount) return "hedging";
    if (overconfidentCount >= 2 && overconfidentCount > hedgingCount) return "overconfident";
    return "balanced";
}

function derivePerceivedListeningSignal({ acknowledged, pauseSignal, questionDeliverySignal, pacingSignal, contextual }) {
    const high = acknowledged && pauseSignal === "strategic_pause" && questionDeliverySignal === "diagnostic_question";
    if (high) return "high";

    const low = !acknowledged || pauseSignal === "rushed_no_pause" || questionDeliverySignal === "no_question" || pacingSignal === "too_fast" || !contextual;
    if (low) return "low";

    return "moderate";
}

export function deriveVoiceBehaviorAdaptation(voiceMetadata = {}, transcript = "", scenarioContext = {}, liveTemperature = 5) {
    const wpm = asNumber(voiceMetadata.words_per_minute, NaN);
    const pauseCount = asNumber(voiceMetadata.pause_count, NaN);
    const avgPause = asNumber(voiceMetadata.avg_pause_duration_ms, NaN);
    const fillerRate = asNumber(voiceMetadata.filler_word_rate, NaN);
    const questionCount = asNumber(voiceMetadata.question_count, (transcript.match(/\?/g) || []).length);

    const pacing_signal = Number.isNaN(wpm)
        ? "unknown"
        : wpm > 180
            ? "too_fast"
            : wpm < 100
                ? "too_slow"
                : wpm >= 120 && wpm <= 160
                    ? "optimal"
                    : "optimal";

    const pause_signal = Number.isNaN(avgPause) || Number.isNaN(pauseCount)
        ? "unknown"
        : pauseCount === 0 || avgPause < 250
            ? "rushed_no_pause"
            : avgPause >= 350 && avgPause <= 900
                ? "strategic_pause"
                : avgPause > 1500 || pauseCount >= 10
                    ? "overpaused"
                    : "strategic_pause";

    const filler_signal = Number.isNaN(fillerRate)
        ? "unknown"
        : fillerRate < 0.02
            ? "low"
            : fillerRate <= 0.06
                ? "moderate"
                : "high";

    const confidence_signal = detectConfidenceSignal(transcript);
    const question_delivery_signal = detectQuestionDeliverySignal(transcript, questionCount);

    const normalizedLine = normalize(transcript);
    const acknowledged = /\b(i hear|i understand|that makes sense|fair point|you'?re right|i get that)\b/.test(normalizedLine);
    const contextual = /\b(workflow|access|prior auth|staff|barrier|patient type|fit|callback|friction)\b/.test(normalizedLine);

    const perceived_listening_signal = derivePerceivedListeningSignal({
        acknowledged,
        pauseSignal: pause_signal,
        questionDeliverySignal: question_delivery_signal,
        pacingSignal: pacing_signal,
        contextual,
    });

    const delivery_pressure_signal =
        pacing_signal === "too_fast" || pause_signal === "rushed_no_pause" || filler_signal === "high" || confidence_signal === "overconfident"
            ? "pressure_increasing"
            : pacing_signal === "optimal" && pause_signal === "strategic_pause" && perceived_listening_signal === "high"
                ? "calming"
                : "neutral";

    let hcp_reaction_modifier = "hold";
    let resistance_delta = 0;
    let openness_delta = 0;
    let trust_delta = 0;
    let cue_intensity_delta = 0;

    const strongDelivery =
        pacing_signal === "optimal"
        && pause_signal === "strategic_pause"
        && confidence_signal === "balanced"
        && question_delivery_signal === "diagnostic_question"
        && acknowledged;

    const poorDelivery =
        pacing_signal === "too_fast"
        || pause_signal === "rushed_no_pause"
        || filler_signal === "high"
        || confidence_signal === "hedging"
        || confidence_signal === "overconfident"
        || question_delivery_signal === "no_question";

    if (strongDelivery) {
        hcp_reaction_modifier = "soften";
        resistance_delta = -1;
        openness_delta = 1;
        trust_delta = 1;
        cue_intensity_delta = -1;
    } else if (poorDelivery) {
        hcp_reaction_modifier = "harden";
        resistance_delta = 1;
        openness_delta = -1;
        trust_delta = -1;
        cue_intensity_delta = 1;
    }

    const temp = mapTemperatureToBehavior(liveTemperature);
    if (hcp_reaction_modifier === "harden" && temp.band === "high") {
        resistance_delta += 1;
        trust_delta -= 1;
        cue_intensity_delta += 1;
    }
    if (hcp_reaction_modifier === "harden" && temp.band === "low") {
        resistance_delta = Math.max(1, resistance_delta - 1);
        trust_delta = Math.min(-1, trust_delta + 1);
        cue_intensity_delta = Math.max(0, cue_intensity_delta - 1);
    }

    const cueMatched = /\b(workflow|access|prior auth|staff|barrier|fit|callback|friction)\b/.test(normalizedLine);
    if (cueMatched && hcp_reaction_modifier === "harden" && delivery_pressure_signal !== "pressure_increasing") {
        resistance_delta -= 1;
        trust_delta += 1;
        hcp_reaction_modifier = resistance_delta > 0 ? "harden" : "hold";
    }

    resistance_delta = clampDelta(resistance_delta);
    openness_delta = clampDelta(openness_delta);
    trust_delta = clampDelta(trust_delta);
    cue_intensity_delta = clampDelta(cue_intensity_delta);

    const next_turn_guidance = hcp_reaction_modifier === "harden"
        ? "HCP should sound more guarded, challenge broad framing, and ask for concrete workflow relevance."
        : hcp_reaction_modifier === "soften"
            ? "HCP should soften slightly, provide one useful detail, but remain clinically cautious."
            : "HCP should remain neutral-selective and ask for practical relevance before progressing.";

    return {
        pacing_signal,
        pause_signal,
        filler_signal,
        confidence_signal,
        question_delivery_signal,
        perceived_listening_signal,
        delivery_pressure_signal,
        hcp_reaction_modifier,
        resistance_delta,
        openness_delta,
        trust_delta,
        cue_intensity_delta,
        next_turn_guidance,
    };
}

function deriveDeliveryImpactOnHcp(adaptation, transcript = "", voiceMetadata = {}) {
    const repPhrase = quoteRepPhrase(transcript);
    const wpm = asNumber(voiceMetadata.words_per_minute, NaN);
    const pause = asNumber(voiceMetadata.avg_pause_duration_ms, NaN);
    const perceived = adaptation.perceived_listening_signal === "high"
        ? "The HCP likely perceived consultative listening."
        : adaptation.perceived_listening_signal === "low"
            ? "The HCP likely perceived pressure rather than listening."
            : "The HCP likely perceived partial listening with mixed delivery cues.";

    const likely = adaptation.hcp_reaction_modifier === "harden"
        ? "HCP becomes more guarded and re-tests practical relevance."
        : adaptation.hcp_reaction_modifier === "soften"
            ? "HCP softens slightly and may offer a more useful constraint detail."
            : "HCP holds neutral-selective posture pending clearer relevance.";

    const coaching = `When you said \"${repPhrase}\" at ${Number.isNaN(wpm) ? "unknown" : `${wpm} WPM`} with avg pause ${Number.isNaN(pause) ? "unknown" : `${pause}ms`}, the delivery likely shifted receptivity by signaling ${adaptation.delivery_pressure_signal === "pressure_increasing" ? "pressure" : adaptation.delivery_pressure_signal}.`;

    return {
        perceived_by_hcp: perceived,
        likely_hcp_reaction: likely,
        impact_on_resistance: adaptation.resistance_delta,
        impact_on_trust: adaptation.trust_delta,
        coaching_implication: coaching,
    };
}

function buildDeliveryCoaching(adaptation, transcript = "") {
    const phrase = quoteRepPhrase(transcript);
    return {
        pacing_feedback: adaptation.pacing_signal === "too_fast"
            ? "You moved too quickly through the concern; slow your pace to let the HCP process relevance."
            : adaptation.pacing_signal === "too_slow"
                ? "Your pace may have reduced momentum; tighten phrasing while staying consultative."
                : "Your pacing was generally aligned to a consultative exchange.",
        pause_feedback: adaptation.pause_signal === "rushed_no_pause"
            ? "Add a brief pause after acknowledging the concern before asking your next question."
            : adaptation.pause_signal === "overpaused"
                ? "Trim long pauses so the exchange feels confident and structured."
                : "Your pause pattern supported listening and structure.",
        confidence_feedback: adaptation.confidence_signal === "hedging"
            ? "Reduce hedging language so your question sounds intentional and clinically useful."
            : adaptation.confidence_signal === "overconfident"
                ? "Dial down certainty language so the HCP does not feel pushed."
                : "Confidence level was balanced for this resistance level.",
        question_delivery_feedback: adaptation.question_delivery_signal === "diagnostic_question"
            ? "Diagnostic question quality was strong; keep narrowing to one barrier at a time."
            : adaptation.question_delivery_signal === "overloaded_question"
                ? "Split multi-part questions into one clear diagnostic question."
                : adaptation.question_delivery_signal === "no_question"
                    ? "Add one diagnostic question that targets workflow, access, or fit criteria."
                    : "Convert closed questions into one diagnostic question tied to decision criteria.",
        perceived_listening_feedback: adaptation.perceived_listening_signal === "low"
            ? "The HCP likely experienced low listening signal; acknowledge first, then narrow."
            : adaptation.perceived_listening_signal === "high"
                ? "Listening signal likely felt strong; maintain this cadence and specificity."
                : "Listening signal was mixed; tighten acknowledgment-to-question sequencing.",
        recommended_delivery_adjustment: "After acknowledging the concern, pause briefly, ask one diagnostic question, and avoid rushing into product framing.",
        example_rephrasing_with_delivery_note: `Delivery note: pause after \"I hear the workflow burden\" before asking \"When this stalls care, is the bigger issue prior authorization friction, callback load, or patient-fit uncertainty?\" (original phrase: \"${phrase}\").`,
    };
}

function sanitizeScenarioQuestion(line, fallback) {
    const candidate = text(line, fallback);
    if (BANNED_GENERIC.some((pattern) => pattern.test(candidate))) {
        return fallback;
    }
    return candidate;
}

export function buildScenarioContract(payload = {}) {
    const temp = mapTemperatureToBehavior(payload.live_temperature ?? payload.rep_selected_temperature ?? payload.hcp_default_temperature ?? 5);
    const objective = text(payload.rep_objective, "advance to a practical next step");
    const journey = text(payload.journey_stage, "discovery");
    const disease = text(payload.disease_state, "general");
    const inboundMemory = payload?.conversation_memory || payload?.scenario_memory || payload;
    const memory = defaultConversationMemory(inboundMemory);
    const layeredCue = buildLayeredCue(payload, temp, memory);

    const opening_scene = temp.band === "high"
        ? "The HCP is squeezed for time, guarded from prior experiences, and testing whether this changes operational reality."
        : temp.band === "mid"
            ? "The HCP is selective and attentive, probing for practical relevance before engaging further."
            : "The HCP is open but practical, willing to explore only if relevance is concrete.";

    const fallbackQuestion = temp.band === "high"
        ? "I've seen this pattern before - where does this actually reduce access friction for my staff?"
        : temp.band === "mid"
            ? "What's the practical difference for my clinic workflow if we try this?"
            : "What would be the first practical step without creating more burden?";

    const hcp_statement_or_question = sanitizeScenarioQuestion(
        generateRealisticHcpLine(temp, layeredCue, memory),
        fallbackQuestion,
    );

    return {
        scenario_id: createId("rps"),
        opening_scene,
        hcp_statement_or_question,
        cue_signal: text(payload.interaction_pressure, "operationally_constrained"),
        cue_signal_layered: layeredCue,
        hcp_likely_motivation: "Protect patient-care quality while minimizing staff and access drag.",
        journey_stage_context: `Journey stage ${journey} in ${disease}, under ${temp.band} resistance pressure.`,
        difficulty_level: temp.band,
        expected_rep_skill_response: `Acknowledge practical constraint, map evidence to ${layeredCue.primary_cue.toLowerCase()}, then ask one focused next-step question tied to ${objective}.`,
        si_capabilities_tested: [
            "question_quality",
            "listening_responsiveness",
            "making_it_matter",
            "objection_navigation",
            "commitment_gaining",
        ],
        behavioral_metrics_observed: [
            "context_awareness",
            "cue_alignment",
            "acknowledgment_quality",
            "next_step_clarity",
            "temperature_adaptation",
        ],
        conversation_memory: memory,
        scoring_rubric: rubricTemplate(),
    };
}

export function detectCommitment(response = "") {
    const line = normalize(response);
    const hasAsk = /\b(can we|would you|are you open|next step|follow up|review|meet|pilot|trial|schedule|if we)\b/.test(line);

    if (!hasAsk) {
        return {
            commitment_attempted: false,
            commitment_type: "none",
            commitment_strength: "none",
        };
    }

    let commitment_type = "agreement_to_consider";
    if (/\bmeeting|schedule|calendar|follow up\b/.test(line)) commitment_type = "follow_up_meeting";
    if (/\bdata|evidence|study|review\b/.test(line)) commitment_type = "data_review";
    if (/\bchange|switch|adopt|therapy|patient type\b/.test(line)) commitment_type = "fit_exploration";

    const commitment_strength = /\bthis week|specific|30 minutes|tomorrow|date|time\b/.test(line)
        ? "strong"
        : /\bnext|follow up|review together|would you be open\b/.test(line)
            ? "moderate"
            : "weak";

    return {
        commitment_attempted: true,
        commitment_type,
        commitment_strength,
    };
}

export function evaluateVoiceMetadata(meta = {}) {
    const issues = [];
    let score = 7;

    const wpm = asNumber(meta.words_per_minute, 135);
    const pacedSpeaking = wpm >= 105 && wpm <= 172;
    if (wpm > 182) {
        score -= 2;
        issues.push("Pace was too fast for a skeptical HCP conversation.");
    } else if (wpm < 96) {
        score -= 1;
        issues.push("Pace was too slow and may reduce conversational control.");
    }

    const pauseCount = asNumber(meta.pause_count, 0);
    const avgPause = asNumber(meta.avg_pause_duration_ms, 0);
    const pauseControl = pauseCount <= 8 && avgPause <= 1450;
    if (pauseCount > 8 || avgPause > 1450) {
        score -= 1;
        issues.push("Pausing pattern suggested uncertainty.");
    }

    const fillerRate = asNumber(meta.filler_word_rate, 0);
    const fillerControl = fillerRate <= 0.08;
    if (fillerRate > 0.08) {
        score -= 2;
        issues.push("Filler-word rate diluted confidence.");
    }

    const confidence = asNumber(meta.speech_confidence_score, 0.75);
    const confidenceStable = confidence >= 0.55;
    if (confidence < 0.55) {
        score -= 1;
        issues.push("Confidence signal was low.");
    }

    const questionCount = asNumber(meta.question_count, 0);
    const questionDensity = questionCount >= 1 ? "present" : "missing";

    const behaviorSignals = {
        paced_speaking: pacedSpeaking,
        pause_control: pauseControl,
        filler_control: fillerControl,
        confidence_stable: confidenceStable,
        question_density: questionDensity,
        words_per_minute: wpm,
        pause_count: pauseCount,
        avg_pause_duration_ms: avgPause,
        question_count: questionCount,
    };

    return { score: clamp(Math.round(score), 1, 10), issues, behaviorSignals };
}

function hasQuestion(line) {
    return /\?/.test(line);
}

function isOpenQuestion(line = "") {
    return /\b(what|how|which|where|when)\b/i.test(line) && hasQuestion(line);
}

function semanticSignals(response = "", scenarioContext = {}) {
    const lower = normalize(response);
    const layered = scenarioContext?.cue_signal_layered || {};
    const primary = normalize(layered.primary_cue || "");
    const secondary = normalize(layered.secondary_cue || "");
    const hidden = normalize(layered.hidden_resistance || "");

    const acknowledged = /\b(i hear|i understand|that makes sense|fair point|you'?re right|i get that)\b/.test(lower);
    const contextual = /\b(prior auth|workflow|access|formulary|journey|patient type|clinic|team|staff|barrier|callback|burden|monday morning)\b/.test(lower);
    const forwardMove = /\b(next|plan|step|review|align|agree|follow up|permission|would you be open)\b/.test(lower);
    const objectionHandling = /\b(concern|barrier|risk|friction|not opposed|constraint|bottleneck)\b/.test(lower);
    const evidenceFraming = /\b(data|evidence|outcome|study|real-world|signal|results)\b/.test(lower);
    const genericPitch = /\b(innovative|leading|best-in-class|great product|exciting|help everyone)\b/.test(lower);

    const cueMatched = [primary, secondary, hidden]
        .filter(Boolean)
        .some((cue) => cue.split(" ").some((token) => token.length > 4 && lower.includes(token)));

    return {
        acknowledged,
        contextual,
        forwardMove,
        objectionHandling,
        evidenceFraming,
        cueMatched,
        genericPitch,
    };
}

function metric(score, rationale, band) {
    return {
        score_1_to_10: clamp(Math.round(score), 1, 10),
        rationale,
        performance_band: band,
    };
}

function bandFor(score) {
    if (score <= 3) return "low";
    if (score <= 5) return "mid_low";
    if (score <= 7) return "mid_high";
    if (score === 8) return "high";
    return "exceptional";
}

function expectedOutcomeForTemperature(tempBand) {
    if (tempBand === "high") {
        return "Reduced resistance, clearer objection, or permission to continue with one relevant point.";
    }
    if (tempBand === "mid") {
        return "Willingness to explore fit, review relevant data, or clarify barrier specifics.";
    }
    return "Concrete next step such as follow-up agreement, data review, or patient/workflow action.";
}

function evaluateOutcome({ commitment, signals, temperatureBand }) {
    let conversationAdvanced = commitment.commitment_attempted || (signals.forwardMove && isOpenQuestion(signals.originalLine || ""));

    let actual_outcome = "no_clear_progression";
    let outcome_quality = "limited";
    let gap_between_expected_and_actual = "high";
    let progression_rationale = "Response did not create enough behavioral movement.";

    if (temperatureBand === "high") {
        if (signals.acknowledged && (signals.cueMatched || signals.contextual)) {
            actual_outcome = commitment.commitment_attempted ? "permission_plus_directional_ask" : "reduced_resistance_and_permission";
            outcome_quality = commitment.commitment_attempted ? "strong" : "good";
            gap_between_expected_and_actual = commitment.commitment_attempted ? "low" : "moderate";
            progression_rationale = "At high resistance, acknowledgment plus cue alignment created usable movement even without immediate hard commitment.";
            conversationAdvanced = true;
        }
    } else if (temperatureBand === "mid") {
        if (signals.cueMatched && (signals.forwardMove || commitment.commitment_attempted)) {
            actual_outcome = commitment.commitment_attempted ? "fit_exploration_with_next_step" : "barrier_clarified";
            outcome_quality = commitment.commitment_attempted ? "strong" : "good";
            gap_between_expected_and_actual = "low";
            progression_rationale = "Selective HCP behavior shifted because response linked claim to practical barrier.";
            conversationAdvanced = true;
        }
    } else if (signals.cueMatched && commitment.commitment_attempted) {
        actual_outcome = "clear_next_step_commitment";
        outcome_quality = commitment.commitment_strength === "strong" ? "strong" : "good";
        gap_between_expected_and_actual = commitment.commitment_strength === "strong" ? "low" : "moderate";
        progression_rationale = "Low resistance scenario advanced to a concrete next action as expected.";
        conversationAdvanced = true;
    }

    const commitment_attempt_quality = !commitment.commitment_attempted
        ? "none"
        : commitment.commitment_strength === "strong"
            ? "high"
            : commitment.commitment_strength === "moderate"
                ? "moderate"
                : "low";

    const expected_commitment_level_for_temperature = temperatureBand === "high"
        ? "moderate_or_permission"
        : temperatureBand === "mid"
            ? "moderate"
            : "moderate_to_strong";

    const actual_commitment_level = text(commitment.commitment_strength, commitment.commitment_attempted ? "weak" : "none");

    const outcome_alignment_to_temperature = gap_between_expected_and_actual === "low"
        ? "aligned"
        : gap_between_expected_and_actual === "moderate"
            ? "partially_aligned"
            : "underperformed";

    const temperature_adjusted_outcome_assessment = temperatureBand === "high"
        ? "Evaluated against high-resistance expectations where reduced resistance or permission can count as progress."
        : "Evaluated against standard progression expectations for current resistance level.";

    return {
        conversation_advanced: conversationAdvanced,
        expected_outcome_for_temperature: expectedOutcomeForTemperature(temperatureBand),
        actual_outcome,
        outcome_quality,
        gap_between_expected_and_actual,
        commitment_attempt_quality,
        progression_rationale,
        outcome_rationale: progression_rationale,
        temperature_adjusted_outcome_assessment,
        expected_commitment_level_for_temperature,
        actual_commitment_level,
        outcome_alignment_to_temperature,
    };
}

function updateConversationMemory(memory = {}, signals = {}, commitment = {}, temperatureBand = "mid", voiceAdaptation = null) {
    const unresolved = [...(Array.isArray(memory.unresolved_cues) ? memory.unresolved_cues : [])];
    const addressed = [...(Array.isArray(memory.addressed_cues) ? memory.addressed_cues : [])];

    if (!signals.cueMatched) {
        unresolved.push("primary_cue_unresolved");
    } else {
        addressed.push("primary_cue_addressed");
    }

    let resistance_trend = !signals.cueMatched || (!signals.acknowledged && temperatureBand !== "low")
        ? "rising"
        : signals.cueMatched && signals.acknowledged
            ? "softening"
            : text(memory.resistance_trend, "stable");

    let trust_trend = signals.acknowledged && signals.contextual
        ? "improving"
        : !signals.contextual
            ? "declining"
            : text(memory.trust_trend, "neutral");

    let openness_trend = text(memory.openness_trend, "neutral");
    let perceived_listening_trend = text(memory.perceived_listening_trend, "neutral");
    let delivery_trend = text(memory.delivery_trend, "neutral");

    if (voiceAdaptation) {
        if (voiceAdaptation.resistance_delta > 0) resistance_trend = "rising";
        if (voiceAdaptation.resistance_delta < 0) resistance_trend = "softening";
        if (voiceAdaptation.trust_delta > 0) trust_trend = "improving";
        if (voiceAdaptation.trust_delta < 0) trust_trend = "declining";

        openness_trend = voiceAdaptation.openness_delta > 0 ? "opening" : voiceAdaptation.openness_delta < 0 ? "closing" : openness_trend;
        perceived_listening_trend = voiceAdaptation.perceived_listening_signal === "high"
            ? "improving"
            : voiceAdaptation.perceived_listening_signal === "low"
                ? "declining"
                : perceived_listening_trend;
        delivery_trend = voiceAdaptation.delivery_pressure_signal === "calming"
            ? "improving"
            : voiceAdaptation.delivery_pressure_signal === "pressure_increasing"
                ? "degrading"
                : delivery_trend;
    }

    const adaptationHistory = Array.isArray(memory.voice_adaptation_history) ? memory.voice_adaptation_history : [];
    const nextAdaptationHistory = voiceAdaptation
        ? [...adaptationHistory, {
            timestamp: new Date().toISOString(),
            turn_id: createId("turn"),
            pacing_signal: voiceAdaptation.pacing_signal,
            pause_signal: voiceAdaptation.pause_signal,
            confidence_signal: voiceAdaptation.confidence_signal,
            question_delivery_signal: voiceAdaptation.question_delivery_signal,
            perceived_listening_signal: voiceAdaptation.perceived_listening_signal,
            hcp_reaction_modifier: voiceAdaptation.hcp_reaction_modifier,
            resistance_delta: voiceAdaptation.resistance_delta,
            openness_delta: voiceAdaptation.openness_delta,
            trust_delta: voiceAdaptation.trust_delta,
            cue_intensity_delta: voiceAdaptation.cue_intensity_delta,
        }].slice(-20)
        : adaptationHistory;

    return {
        prior_rep_moves: [...(Array.isArray(memory.prior_rep_moves) ? memory.prior_rep_moves : []), signals.summary || "rep_turn"].slice(-8),
        prior_hcp_reactions: Array.isArray(memory.prior_hcp_reactions) ? memory.prior_hcp_reactions : [],
        unresolved_cues: unique(unresolved).slice(-8),
        addressed_cues: unique(addressed).slice(-8),
        delivery_trend,
        perceived_listening_trend,
        resistance_trend,
        trust_trend,
        openness_trend,
        voice_adaptation_history: nextAdaptationHistory,
        last_voice_adaptation: voiceAdaptation || memory.last_voice_adaptation || null,
        last_commitment_attempt: commitment.commitment_attempted ? commitment.commitment_type : "none",
        hcp_state: memory.hcp_state || null, // Persisted externally by computeHcpStateProgression
    };
}

function buildCoaching({ line, signals, layeredCue, temperatureBand }) {
    const quoted = quoteRepPhrase(line);
    const cueText = text(layeredCue?.what_the_rep_must_detect, "The HCP is asking for practical decision impact, not features.");
    const likelyHeard = signals.cueMatched
        ? "You connected part of my practical concern, but I still need tighter specificity tied to workflow constraints."
        : "I heard a broad product statement, not a response to my practical barrier.";

    const missedCue = signals.cueMatched
        ? "Secondary or hidden resistance was only partially addressed."
        : `Missed cue: ${text(layeredCue?.primary_cue, "practical barrier")} with hidden resistance around prior unsuccessful claims.`;

    const consequence = signals.cueMatched
        ? "The conversation can move, but trust may plateau if you stay broad."
        : "Behaviorally, this increases guardedness and forces the HCP to repeat constraints.";

    const betterPhrasing = "When you say this may not change your day-to-day decisions, is the bigger blocker access friction, patient-fit confidence, or staff workflow load?";
    const nextQuestion = temperatureBand === "high"
        ? "If we focus on one operational bottleneck only, which step would you want solved first to keep this worth discussing?"
        : "Which specific patient or workflow scenario would make this discussion most relevant for your decision?";

    const coaching_feedback = [
        `When you said \"${quoted}\", the HCP likely heard: ${likelyHeard}`,
        `${missedCue} ${consequence}`,
        `A stronger move is to narrow the barrier before advancing: \"${betterPhrasing}\"`,
    ];

    return {
        coaching_feedback,
        better_phrasing: betterPhrasing,
        next_best_question: nextQuestion,
        what_hcp_likely_heard: likelyHeard,
        improved_response_example: `I hear your practical concern. If we stay focused on one barrier, which step is actually slowing decisions today - access, workflow, or patient selection?`,
    };
}

export function evaluateRepResponse({
    repResponseTranscript = "",
    voiceMetadata = {},
    cueSignal = "",
    repSelectedTemperature = 5,
    scenarioContext = {},
    conversationMemory = {},
    hcpBrain = null,
    previousHcpState = null,
} = {}) {
    const line = text(repResponseTranscript);
    const temp = mapTemperatureToBehavior(repSelectedTemperature);
    const safeScenarioContext = /** @type {any} */ (scenarioContext || {});
    const layeredCue = safeScenarioContext?.["cue_signal_layered"] || {
        primary_cue: cueSignal,
        secondary_cue: "workflow burden",
        hidden_resistance: "prior claim fatigue",
        what_the_rep_must_detect: "Practical decision impact under constraints",
    };
    const signals = semanticSignals(line, scenarioContext);
    signals.originalLine = line;
    signals.summary = signals.cueMatched ? "addressed_cue" : "missed_cue";
    const voice = evaluateVoiceMetadata(voiceMetadata || {});
    const voiceAdaptation = deriveVoiceBehaviorAdaptation(voiceMetadata || {}, line, scenarioContext || {}, repSelectedTemperature);
    const deliveryImpactOnHcp = deriveDeliveryImpactOnHcp(voiceAdaptation, line, voiceMetadata || {});
    const deliveryCoaching = buildDeliveryCoaching(voiceAdaptation, line);
    const commitment = detectCommitment(line);

    // Broad score calibration: generic polished responses are capped when cue/context is missed.
    const genericPenalty = signals.genericPitch ? 2 : 0;
    const noQuestionPenalty = hasQuestion(line) ? 0 : 2;
    const cueMissPenalty = signals.cueMatched ? 0 : 3;
    const contextMissPenalty = signals.contextual ? 0 : 2;

    let contextScore = 7 + (signals.contextual ? 1 : -2) + (signals.forwardMove ? 1 : 0) - genericPenalty;
    let cueScore = 7 + (signals.cueMatched ? 1 : -3) + (signals.acknowledged ? 1 : 0) - genericPenalty;
    let empathyScore = 6 + (signals.acknowledged ? 2 : -2) - (signals.genericPitch ? 1 : 0);
    let questionScore = 6 + (isOpenQuestion(line) ? 2 : hasQuestion(line) ? 0 : -2) + (signals.forwardMove ? 1 : 0);
    let evidenceScore = 6 + (signals.evidenceFraming ? 2 : -1) + (signals.contextual ? 1 : -1);
    let objectionScore = 6 + (signals.objectionHandling ? 2 : -1) + (signals.cueMatched ? 1 : -1);
    let controlScore = 6 + (signals.forwardMove ? 2 : -2) + (commitment.commitment_attempted ? 1 : 0);

    // Voice-derived alignment influences additional behavioral metrics beyond tone/pace.
    const questionCountFromVoice = Number(voice?.behaviorSignals?.question_count || 0);
    if (!hasQuestion(line) && questionCountFromVoice >= 1) {
        questionScore += 1;
    }
    if (hasQuestion(line) && questionCountFromVoice === 0) {
        questionScore -= 1;
    }

    if (voice?.behaviorSignals?.pause_control) {
        controlScore += 1;
    } else {
        controlScore -= 1;
    }

    if (!voice?.behaviorSignals?.paced_speaking) {
        questionScore -= 1;
    }

    if (!signals.cueMatched) {
        contextScore -= 1;
        evidenceScore -= 1;
        controlScore -= 1;
    }

    if (temp.band === "high" && commitment.commitment_strength === "strong" && !signals.cueMatched) {
        controlScore -= 2;
        objectionScore -= 1;
    }

    const poorPacing = !voice?.behaviorSignals?.paced_speaking;
    const poorPauseControl = !voice?.behaviorSignals?.pause_control;
    const highResistanceVoiceCapApplied = temp.band === "high" && (poorPacing || poorPauseControl);

    let strategicQuestioningScore = questionScore - noQuestionPenalty;
    let conversationalControlScore = controlScore;

    if (highResistanceVoiceCapApplied) {
        // Under high resistance, poor delivery sharply reduces perceived strategic quality and control.
        strategicQuestioningScore = Math.min(strategicQuestioningScore, poorPacing ? 5 : 6);
        conversationalControlScore = Math.min(conversationalControlScore, poorPauseControl ? 5 : 6);
    }

    const metric_scores = {
        context_awareness: metric(contextScore - contextMissPenalty, signals.contextual ? "Used scenario context and practical constraints." : "Stayed generic and did not naturally use pressure/access context.", bandFor(contextScore - contextMissPenalty)),
        cue_recognition: metric(cueScore - cueMissPenalty, signals.cueMatched ? "Addressed primary cue and at least part of hidden resistance." : "Responded to surface language and missed underlying cue.", bandFor(cueScore - cueMissPenalty)),
        empathy_acknowledgment: metric(empathyScore, signals.acknowledged ? "Acknowledged practical concern without over-validating." : "No practical acknowledgment before advancing claims.", bandFor(empathyScore)),
        strategic_questioning: metric(strategicQuestioningScore, isOpenQuestion(line) ? "Asked a specific open question that can reveal decision criteria." : hasQuestion(line) ? "Question present but not sufficiently diagnostic." : "No meaningful question to progress the interaction.", bandFor(strategicQuestioningScore)),
        evidence_framing: metric(evidenceScore, signals.evidenceFraming && signals.contextual ? "Evidence was framed to the active workflow/access concern." : "Evidence framing was vague or detached from the active barrier.", bandFor(evidenceScore)),
        objection_handling: metric(objectionScore, signals.objectionHandling ? "Named the concern and attempted to narrow it." : "Did not directly handle the practical objection.", bandFor(objectionScore)),
        conversational_control: metric(conversationalControlScore, signals.forwardMove ? "Guided a next move appropriate to resistance level." : "Conversation drifted without clear directional movement.", bandFor(conversationalControlScore)),
        tone_pace_confidence: metric(voice.score, "Derived from pace, pauses, filler rate, and confidence signals.", bandFor(voice.score)),
    };

    const scoreValues = Object.values(metric_scores).map((item) => item.score_1_to_10);
    const rawOverall = Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length);

    // Calibration guardrail: polished generic replies should not score high.
    const overall_score = !signals.cueMatched && !signals.contextual
        ? Math.min(rawOverall, 5)
        : rawOverall;

    const observed_strengths = unique([
        metric_scores.context_awareness.score_1_to_10 >= 7 ? "Context awareness" : "",
        metric_scores.cue_recognition.score_1_to_10 >= 7 ? "Cue recognition" : "",
        metric_scores.strategic_questioning.score_1_to_10 >= 7 ? "Strategic questioning" : "",
        metric_scores.conversational_control.score_1_to_10 >= 7 ? "Conversational control" : "",
    ]);

    const missed_cues = unique([
        !signals.cueMatched ? `Primary cue not resolved: ${text(layeredCue.primary_cue, cueSignal)}` : "",
        !signals.acknowledged ? "HCP practical concern was not explicitly acknowledged." : "",
        !hasQuestion(line) ? "No diagnostic next-step question was asked." : "",
        signals.genericPitch ? "Language leaned generic/polished instead of context-specific." : "",
    ]);

    const outcome = evaluateOutcome({ commitment, signals, temperatureBand: temp.band });

    // Build a partial evaluation object for hcpState (hcp_brain_alignment injected externally in index.ts,
    // but we can pass what we have so far for the state engine to use)
    const partialEvalForState = {
        overall_score,
        outcome_analysis: outcome,
        hcp_brain_alignment: null, // Will be overridden in index.ts after hcpBrain eval
    };

    // HCP State Progression — deterministic, uses hcpBrain + voiceAdaptation + evaluation
    const previousState = previousHcpState || (conversationMemory?.hcp_state) || null;
    const stateProgression = computeHcpStateProgression({
        hcpBrain,
        previousHcpState: previousState,
        repResponseTranscript: line,
        evaluation: partialEvalForState,
        voiceBehaviorAdaptation: voiceAdaptation,
        liveTemperature: repSelectedTemperature,
        conversationMemory,
    });

    const updatedMemory = updateConversationMemory(conversationMemory, signals, commitment, temp.band, voiceAdaptation);
    // Persist hcp_state into conversation memory
    updatedMemory.hcp_state = stateProgression.hcp_state;
    updatedMemory.response_type_history = [
        ...(Array.isArray(conversationMemory?.response_type_history) ? conversationMemory.response_type_history : []),
        stateProgression.hcp_response_type,
    ].filter(Boolean).slice(-8);

    const coaching = buildCoaching({ line, signals, layeredCue, temperatureBand: temp.band });

    return {
        overall_score,
        metric_scores,
        voice_behavior_signals: voice.behaviorSignals,
        voice_behavior_adaptation: voiceAdaptation,
        delivery_impact_on_hcp: deliveryImpactOnHcp,
        delivery_coaching: deliveryCoaching,
        simulated_hcp_next_response: stateProgression.simulated_hcp_next_response,
        hcp_state: stateProgression.hcp_state,
        hcp_state_delta: stateProgression.hcp_state_delta,
        hcp_response_type: stateProgression.hcp_response_type,
        response_type_reason: stateProgression.response_type_reason,
        previous_response_types: stateProgression.previous_response_types,
        response_type_transition_explanation: stateProgression.response_type_transition_explanation,
        hcp_progression_explanation: stateProgression.hcp_progression_explanation,
        score_rationale: {
            scoring_guardrail_applied: !signals.cueMatched && !signals.contextual,
            guardrail_reason: !signals.cueMatched && !signals.contextual
                ? "Generic response with missed cue/context is capped to prevent inflated scoring."
                : "No cap applied.",
            voice_behavior_mapping: {
                strategic_questioning: {
                    question_count_signal: questionCountFromVoice,
                    paced_speaking_signal: Boolean(voice?.behaviorSignals?.paced_speaking),
                    high_resistance_cap_applied: highResistanceVoiceCapApplied && poorPacing,
                    effect: "question density and pacing can raise/lower strategic_questioning for spoken delivery quality",
                },
                conversational_control: {
                    pause_control_signal: Boolean(voice?.behaviorSignals?.pause_control),
                    high_resistance_cap_applied: highResistanceVoiceCapApplied && poorPauseControl,
                    effect: "pause control can raise/lower conversational_control for turn stability",
                },
                tone_pace_confidence: {
                    words_per_minute: voice?.behaviorSignals?.words_per_minute,
                    filler_control: Boolean(voice?.behaviorSignals?.filler_control),
                    confidence_stable: Boolean(voice?.behaviorSignals?.confidence_stable),
                    effect: "directly powers tone_pace_confidence scoring",
                },
                hcp_behavior_adaptation: {
                    hcp_reaction_modifier: voiceAdaptation.hcp_reaction_modifier,
                    resistance_delta: voiceAdaptation.resistance_delta,
                    openness_delta: voiceAdaptation.openness_delta,
                    trust_delta: voiceAdaptation.trust_delta,
                    cue_intensity_delta: voiceAdaptation.cue_intensity_delta,
                    effect: "voice delivery signals influence next HCP guard/soften behavior and memory trends",
                },
            },
            drivers: {
                cue_matched: signals.cueMatched,
                contextual_language: signals.contextual,
                open_question: isOpenQuestion(line),
                evidence_framing: signals.evidenceFraming,
                objection_handling: signals.objectionHandling,
            },
        },
        observed_strengths,
        missed_cues,
        delivery_issues: voice.issues,
        outcome_analysis: {
            ...commitment,
            hcp_progression: outcome.outcome_quality === "strong" ? "meaningfully_advanced" : outcome.outcome_quality === "good" ? "slightly_advanced" : "unchanged",
            ...outcome,
        },
        conversation_memory: updatedMemory,
        coaching_feedback: coaching.coaching_feedback,
        better_phrasing: coaching.better_phrasing,
        next_best_question: coaching.next_best_question,
        what_hcp_likely_heard: coaching.what_hcp_likely_heard,
        improved_response_example: coaching.improved_response_example,
    };
}
