/**
 * Predictive HCP Brain Engine
 *
 * Self-contained worker-side module that builds a full HCP persona brain
 * from 6 dropdown selections. Mirrors the deterministic logic used by
 * the Predictive HCP Builder (predictiveBuilderModel.js) without any
 * dependency on client-side code.
 *
 * Exports:
 *   buildHcpBrain(selections)           → full HCP Brain object
 *   buildHcpBrainSummary(hcpBrain)      → concise rep-facing summary
 *   buildHcpBrainPersonaContext(brain)  → multi-line string for prompt injection
 *   evaluateRepAgainstBrain(text, brain)→ deterministic alignment object
 *   buildHcpBrainCoaching(align, brain, phrase) → structured coaching object
 */

// ─── Lookup Tables ────────────────────────────────────────────────────────────

const PROFILE_BY_ARCHETYPE = {
    time_constrained_community_doctor: {
        mindset: "Focused on patient flow and practical feasibility before clinical nuance.",
        likelyObjections: "This will add friction to already constrained office operations.",
        responseStyle: "Brief, direct, quickly redirects to workflow realities.",
        repApproach: "Lead with one workflow-reducing step and ask for a narrow next action.",
        resistanceTriggers: "Long data monologues, vague promises, or abstract positioning.",
        credibilityDrivers: [
            "Demonstrates understanding of workflow constraints and team capacity.",
            "Provides one specific implementation step that reduces friction.",
            "Acknowledges prior-auth or access burden before discussing clinical value.",
        ],
        trustBreakers: [
            "Leading with broad efficacy claims without addressing workflow burden.",
            "Ignoring or minimizing access and operational friction.",
            "Using promotional language or comparative claims without specifics.",
        ],
        qualityTestQuestion:
            "Does this rep understand what actually slows down patient care in my practice, and can they help reduce it?",
        internalMonologue:
            "I have patients waiting. If this doesn't help my team run more efficiently or solve a real patient-care gap, this conversation ends quickly.",
    },
    skeptical_specialist: {
        mindset: "Evaluates claims through evidence quality and fit to real patient populations.",
        likelyObjections: "Data relevance, edge cases, and over-generalized value claims.",
        responseStyle: "Analytical, challenging, and selective about what is credible.",
        repApproach: "Acknowledge concern, ask precision questions, then tie evidence to this panel.",
        resistanceTriggers: "Defensive rebuttals and unsupported comparisons.",
        credibilityDrivers: [
            "Cites subgroup-relevant data aligned to this specialist's actual patient panel.",
            "Acknowledges evidence gaps and uncertainty without minimizing them.",
            "Matches the specialist's language register and asks precision questions.",
        ],
        trustBreakers: [
            "Overstating efficacy or generalizing from trial populations that don't match the panel.",
            "Defensive response to pushback instead of engaging the clinical concern.",
            "Comparative claims without patient-fit qualification.",
        ],
        qualityTestQuestion:
            "Does this rep have genuine specialty understanding, or are they pattern-matching generic training points to my practice?",
        internalMonologue:
            "I've heard broad claims before. I need to see if this rep understands my patient panel before I give them any more time.",
    },
    curious_uncertain_adopter: {
        mindset: "Open to change but cautious about implementation risk.",
        likelyObjections: "Unclear first-step criteria and uncertainty about execution.",
        responseStyle: "Collaborative but non-committal without clear activation path.",
        repApproach: "Co-create explicit patient criteria and secure a time-bound micro-commitment.",
        resistanceTriggers: "Hard close before alignment on practical next steps.",
        credibilityDrivers: [
            "Provides a simple, low-risk first-use protocol the team can pilot.",
            "Helps identify the ideal first patient without overpromising.",
            "Validates uncertainty and offers a manageable next step.",
        ],
        trustBreakers: [
            "Asking for broad adoption commitment before the first patient criteria are clear.",
            "Minimizing implementation uncertainty or treating hesitation as a closing problem.",
            "Overly optimistic framing that doesn't address the real risk of getting it wrong.",
        ],
        qualityTestQuestion:
            "Can this rep give me a clear, low-risk way to start that I can explain to my staff and execute without disruption?",
        internalMonologue:
            "I'm genuinely interested but I can't afford a workflow failure. I need to know exactly what 'trying this' looks like in practice.",
    },
    cost_focused_decision_maker: {
        mindset: "Looks for measurable patient benefit relative to financial and access burden.",
        likelyObjections: "Budget impact, payer friction, and implementation tradeoffs.",
        responseStyle: "Outcome-and-value oriented, asks for practical proof points.",
        repApproach: "Connect one outcome delta to a concrete value metric this HCP tracks.",
        resistanceTriggers: "High-level efficacy talk without cost or access context.",
        credibilityDrivers: [
            "Quantifies value in terms this clinician actually measures.",
            "Addresses payer and formulary realities before clinical value.",
            "Shows practical understanding of budget constraints and ROI logic.",
        ],
        trustBreakers: [
            "Presenting clinical value without cost or access context.",
            "Vague ROI claims without specific numbers or comparable benchmarks.",
            "Minimizing formulary friction or prior-auth burden.",
        ],
        qualityTestQuestion:
            "Can this rep demonstrate that the value delivered justifies the cost and access burden, in terms I can defend to my institution?",
        internalMonologue:
            "The clinical question isn't my main issue. My issue is whether this is defensible from a cost and access standpoint before I commit.",
    },
};

const PRESSURE_SIGNALS = {
    time_constrained:
        "Compressed replies, interrupting for prioritization, asks for immediate relevance.",
    operationally_constrained:
        "References staffing limits, process burden, and implementation fatigue.",
    skeptical_resistant:
        "Pushback language, challenges framing, tests credibility before engagement.",
    competitive_bias:
        "Compares against incumbent choice and discounts incremental differences.",
    safety_concern:
        "Risk-first questioning, seeks confidence boundaries and escalation paths.",
    access_barrier:
        "Coverage and formulary concerns dominate willingness to discuss clinical fit.",
    curious_uncertain:
        "Engaged questions with hesitation around execution confidence.",
};

const INFLUENCE_LENS = {
    patient_centric: "patient impact and day-to-day care practicality",
    evidence_driven: "strength of evidence and real-world applicability",
    risk_averse: "downside control and confidence in safe adoption",
    guideline_anchored: "guideline alignment and defensible decision logic",
};

const DISEASE_INTELLIGENCE = {
    pulmonology: {
        decisionRealities: [
            "Escalation choices are often constrained by prior exacerbation history, inhaler technique, and adherence uncertainty.",
            "Workflow burden rises quickly when therapy changes require extra coaching, follow-up calls, or payer documentation.",
        ],
    },
    cardiology: {
        decisionRealities: [
            "Risk stratification and sequence-of-therapy logic dominate cardiology decisions.",
            "Coverage and affordability frequently determine whether intended therapy is clinically actionable.",
        ],
    },
    oncology: {
        decisionRealities: [
            "Treatment choices are heavily protocol-driven with high sensitivity to biomarker fit and line-of-therapy context.",
            "Competitive alternatives are usually top-of-mind and can anchor initial resistance.",
        ],
    },
    primary_care: {
        decisionRealities: [
            "Primary care choices balance broad population fit, practical workflow, and follow-up feasibility.",
            "Payer and pharmacy realities can outweigh theoretical clinical preference.",
        ],
    },
};

const HCP_TYPE_INTELLIGENCE = {
    treating_clinician: {
        topDrivers: [
            "Immediate patient-fit clarity.",
            "Low-friction implementation path in current clinic workflow.",
        ],
    },
    influencer: {
        topDrivers: [
            "Cross-team relevance and transferability of outcomes.",
            "Decision logic that can be defended in peer conversations.",
        ],
    },
    thought_leader: {
        topDrivers: [
            "Methodological rigor and subgroup validity.",
            "Nuanced interpretation over simplified positioning claims.",
        ],
    },
};

const JOURNEY_STAGE_INTELLIGENCE = {
    initial_access: {
        predictivePriority: "Earn relevance in under one minute before discussing data depth.",
        failureMode: "Opening with broad positioning before clarifying what this HCP actually prioritizes.",
        qualityTestFocus: "Does this rep know what actually matters to me before pitching?",
    },
    discovery: {
        predictivePriority: "Surface practical decision criteria before introducing treatment claims.",
        failureMode: "Assuming priorities instead of discovering clinical and workflow constraints.",
        qualityTestFocus: "Is this rep discovering my priorities or presenting a prepared script?",
    },
    clinical_value: {
        predictivePriority: "Link outcomes to this HCP's exact patient segments and decision thresholds.",
        failureMode: "Presenting generalized efficacy without subgroup relevance.",
        qualityTestFocus: "Can this rep translate evidence into what matters for my specific patient panel?",
    },
    objection_handling: {
        predictivePriority:
            "De-escalate defensiveness by naming the concern and testing understanding first.",
        failureMode: "Counter-arguing before exploring the underlying risk or access blocker.",
        qualityTestFocus: "Does this rep hear my real concern or do they just reframe the pitch?",
    },
    adoption_implementation: {
        predictivePriority: "Translate value into a low-risk first-use plan the team can actually run.",
        failureMode: "High-level enthusiasm without practical execution steps.",
        qualityTestFocus:
            "Can this rep give me a realistic path to adoption that my team can execute?",
    },
    access_formulary: {
        predictivePriority: "Isolate the exact gate and provide process-ready support language.",
        failureMode: "Treating access as generic rather than gate-specific.",
        qualityTestFocus:
            "Does this rep know the actual access pathway and how to help me navigate it?",
    },
    commitment_close: {
        predictivePriority: "Secure one concrete owned next step with clear patient criteria.",
        failureMode: "Asking for broad commitment without practical ownership.",
        qualityTestFocus:
            "Can this rep help me commit to one specific, low-risk action I own?",
    },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function take(arr, n = 5) {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    return arr.filter((v) => {
        const s = String(v || "").trim();
        if (!s || seen.has(s)) return false;
        seen.add(s);
        return true;
    }).slice(0, n);
}

function str(v, fallback = "") {
    return String(v ?? "").trim() || fallback;
}

// ─── buildHcpBrain ─────────────────────────────────────────────────────────────

/**
 * Builds the full HCP Brain object from 6 dropdown selections.
 * All fields have safe fallbacks — a partial set of selections still works.
 */
export function buildHcpBrain(selections = {}) {
    const {
        behavior_archetype = "skeptical_specialist",
        influence_driver = "patient_centric",
        disease_state = "primary_care",
        journey_stage = "discovery",
        interaction_pressure = "operationally_constrained",
        specialty_hcp_type,
        hcp_type,
        initial_temperature = 5,
        live_temperature,
    } = selections;

    const resolvedHcpType = hcp_type || specialty_hcp_type || "treating_clinician";

    const persona =
        PROFILE_BY_ARCHETYPE[behavior_archetype] ||
        PROFILE_BY_ARCHETYPE.skeptical_specialist;
    const pressureSignal =
        PRESSURE_SIGNALS[interaction_pressure] || "Signals are mixed and context-dependent.";
    const influenceLens =
        INFLUENCE_LENS[influence_driver] || "practical decision logic";
    const diseaseIntel =
        DISEASE_INTELLIGENCE[str(disease_state).toLowerCase()] ||
        DISEASE_INTELLIGENCE.primary_care;
    const hcpTypeIntel =
        HCP_TYPE_INTELLIGENCE[resolvedHcpType] ||
        HCP_TYPE_INTELLIGENCE.treating_clinician;
    const stageIntel =
        JOURNEY_STAGE_INTELLIGENCE[journey_stage] ||
        JOURNEY_STAGE_INTELLIGENCE.discovery;

    const stageLabel = str(journey_stage).replace(/_/g, " ");
    const pressureLabel = str(interaction_pressure).replace(/_/g, " ");
    const diseaseLabel = str(disease_state).replace(/_/g, " ");

    return {
        hcp_brain_id: `hcp-brain-${behavior_archetype}-${journey_stage}-${Date.now()}`,
        source: "predictive_hcp_brain_engine",
        selections: {
            disease_state: str(disease_state),
            specialty_hcp_type: resolvedHcpType,
            journey_stage: str(journey_stage),
            interaction_pressure: str(interaction_pressure),
            influence_driver: str(influence_driver),
            behavior_archetype: str(behavior_archetype),
        },

        // ── Persona (raw archetype data) ──────────────────────────────────────────
        persona: {
            mindset: persona.mindset,
            likelyObjections: persona.likelyObjections,
            responseStyle: persona.responseStyle,
            repApproach: persona.repApproach,
            resistanceTriggers: persona.resistanceTriggers,
            credibilityDrivers: persona.credibilityDrivers,
            trustBreakers: persona.trustBreakers,
            qualityTestQuestion: persona.qualityTestQuestion,
            internalMonologue: persona.internalMonologue,
        },

        // ── 8 section blocks ──────────────────────────────────────────────────────
        hcp_mindset: {
            key_factors: take(
                [
                    persona.mindset,
                    ...hcpTypeIntel.topDrivers,
                    ...diseaseIntel.decisionRealities,
                ],
                5,
            ),
            predictive_signals: take([
                `Primary lens: ${influenceLens}.`,
                `At ${stageLabel} stage, HCP prioritizes: ${stageIntel.predictivePriority}`,
                "Skepticism increases when claims are not tied to patient-selection logic.",
                persona.responseStyle,
            ], 4),
            rep_moves: take([
                "Lead with one role-specific patient profile before broad clinical framing.",
                persona.repApproach,
                "Confirm practical constraints before introducing additional data.",
                "Ask one diagnostic question before advancing claims.",
            ], 4),
        },

        likely_objections: {
            key_factors: take([
                persona.likelyObjections,
                "Requests for subgroup relevance instead of average population claims.",
                "Pushback if implementation burden is unclear.",
                "Questions about comparative fit versus incumbent options.",
            ], 5),
            predictive_signals: take([
                "Objections will usually sharpen after any generic efficacy statement.",
                "If access or workflow is implied but not addressed, resistance rises quickly.",
                "HCP will test precision before agreeing to next steps.",
            ], 4),
            rep_moves: take([
                "Acknowledge concern and ask one precision question before responding.",
                "Respond with patient-fit and workflow-fit in the same answer.",
                "Close each objection loop with a concrete, low-risk next step.",
            ], 4),
        },

        pressure_signals: {
            key_factors: take([
                pressureSignal,
                "Time pressure often appears as shorter turns, not always explicit rejection.",
                "Engagement drops when the rep does not mirror the HCP's decision pace.",
                "Operational friction concerns can mask clinical openness.",
            ], 5),
            predictive_signals: take([
                `Likely response style: ${persona.responseStyle}`,
                "When pressured, this HCP favors bottom-line utility over full narrative detail.",
                "Sustained relevance improves probability of specific follow-up questions.",
            ], 4),
            rep_moves: take([
                "Use shorter turns with explicit 'why this matters now' framing.",
                "Offer one optional deeper-data path instead of forcing full detail.",
                "Check for agreement on one decision variable at a time.",
            ], 4),
        },

        red_flags: {
            key_factors: take([
                stageIntel.failureMode,
                `Conversation drifts from ${stageLabel} realities into generic framing that ignores ${pressureLabel} pressure.`,
                "Defensive tone after objections predicts reduced next-step ownership.",
                "Product-first monologues increase disengagement and competitive fallback.",
            ], 5),
            predictive_signals: take([
                "Risk of stalled conversation rises when no patient-selection criteria are discussed.",
                "Risk escalates if access and workflow blockers are acknowledged but not operationalized.",
                "Low specificity often leads to polite but non-committal closure.",
            ], 4),
            rep_moves: take([
                "If red flags appear, reset with one clarifying question tied to current patient mix.",
                "Reframe using concrete next-step ownership instead of broader claims.",
                "Prioritize accuracy and relevance over completeness.",
            ], 4),
        },

        language_that_works: {
            key_factors: take([
                `Use specific, role-fit language tied to ${diseaseLabel} decisions.`,
                "Patient-segment phrasing with clear inclusion boundaries.",
                "Workflow-specific wording that identifies who does what next.",
                "Evidence phrasing that links trial signal to local clinical reality.",
                `Language that aligns with ${influenceLens}.`,
            ], 5),
            predictive_signals: take([
                "Receptivity improves when value is translated into one practical decision consequence.",
                "Credibility rises when uncertainty boundaries are named directly.",
                "This HCP responds best to concise, decision-ready language.",
            ], 4),
            rep_moves: take([
                "Use: 'For the patients you described, the practical difference is ...'",
                "Use: 'The first step most teams try is ...'",
                "Use: 'The evidence is strongest in ... and less certain in ...'",
            ], 4),
        },

        language_that_triggers_resistance: {
            key_factors: take([
                persona.resistanceTriggers,
                "Unqualified superlatives without context.",
                "Abstract value claims disconnected from this clinic's workflow.",
                "Comparative claims without clear patient-fit qualifiers.",
                "Promotional language patterns.",
            ], 5),
            predictive_signals: take([
                "Resistance signals often appear as requests for narrowing scope.",
                "HCP may pivot to access or safety if messaging feels broad.",
                "Tone hardens when rep language sounds scripted or defensive.",
            ], 4),
            rep_moves: take([
                "Avoid over-claiming; use bounded language with clear qualifiers.",
                "Replace generic value statements with one specific care-path implication.",
                "If challenged, restate concern before offering data.",
            ], 4),
        },

        predicted_response_style: {
            key_factors: take([
                persona.responseStyle,
                "Will test practical relevance before allowing deeper conversation.",
                "Will likely narrow to one concern family if messaging is too broad.",
                "Decision momentum increases after role-specific evidence translation.",
            ], 5),
            predictive_signals: take([
                "Most likely next move is probing for fit, risk boundary, or implementation burden.",
                "If you stay specific, expected trajectory shifts from resistance to cautious curiosity.",
                "If you stay generic, expected trajectory shifts to polite deferral.",
            ], 4),
            rep_moves: take([
                "Prepare one concise objection-ready response for the dominant pressure signal.",
                "Offer a micro-commitment rather than a broad adoption ask.",
                "Confirm interpretation before moving to your next claim.",
            ], 4),
        },

        recommended_rep_approach: {
            key_factors: take([
                persona.repApproach,
                stageIntel.predictivePriority,
                "Balance clinical confidence with operational feasibility in every key answer.",
                "Sequence responses as: acknowledge → clarify → apply → next step.",
            ], 5),
            predictive_signals: take([
                "High-probability win condition is one owned, low-risk next action.",
                "Best predictor of success is role-fit relevance delivered early.",
                "Sustained precision lowers competitive and access-based deferral behavior.",
            ], 4),
            rep_moves: take([
                "Use a two-part answer: patient-fit evidence + implementation step.",
                "Close with a specific trial condition the HCP can evaluate.",
                persona.repApproach,
            ], 4),
        },

        // ── Clinician perspective ─────────────────────────────────────────────────
        clinician_perspective: {
            perspective_statement: persona.internalMonologue,
            quality_test_question: persona.qualityTestQuestion,
            clinical_credibility_drivers: take(persona.credibilityDrivers, 3),
            trust_breakers: take(persona.trustBreakers, 3),
        },

        // ── Decision filter ───────────────────────────────────────────────────────
        decision_filter: {
            what_hcp_is_testing: persona.qualityTestQuestion,
            what_hcp_needs_to_believe: take([
                (persona.credibilityDrivers || [])[0] || "Rep understands my constraints.",
                `Primary lens: ${influenceLens}`,
            ], 2),
            what_hcp_will_reject: take([
                (persona.trustBreakers || [])[0] || "Broad claims without context.",
                persona.resistanceTriggers,
            ], 2),
            minimum_bar_for_progression: stageIntel.predictivePriority,
        },

        // ── Dialogue rules ────────────────────────────────────────────────────────
        dialogue_rules: {
            speak_from_mindset: persona.mindset,
            evaluate_rep_against_quality_test: persona.qualityTestQuestion,
            resist_when_trust_breaker_triggered: take(persona.trustBreakers, 3),
            soften_when_credibility_driver_met: take(persona.credibilityDrivers, 3),
            keep_responses_grounded_in_workflow_or_clinical_context: pressureSignal,
        },

        initial_temperature: Number(initial_temperature) || 5,
        live_temperature: Number(live_temperature ?? initial_temperature) || 5,
        temperature_behavior_modifiers: {},
        conversation_memory: null,
        voice_behavior_adaptation_history: [],
    };
}

// ─── buildHcpBrainSummary ─────────────────────────────────────────────────────

/**
 * Concise rep-facing summary panel of the HCP Brain.
 * Shown in the RPS UI after scenario generation.
 */
export function buildHcpBrainSummary(hcpBrain) {
    if (!hcpBrain) return null;
    const cp = hcpBrain.clinician_perspective || {};
    const lo = hcpBrain.likely_objections || {};
    const persona = hcpBrain.persona || {};
    const df = hcpBrain.decision_filter || {};

    return {
        archetype: str(hcpBrain.selections?.behavior_archetype).replace(/_/g, " "),
        journey_stage: str(hcpBrain.selections?.journey_stage).replace(/_/g, " "),
        influence_driver: str(hcpBrain.selections?.influence_driver).replace(/_/g, " "),
        mindset_summary: str(persona.mindset),
        quality_test_question: str(cp.quality_test_question),
        primary_trust_breaker: str((cp.trust_breakers || [])[0]),
        primary_credibility_driver: str((cp.clinical_credibility_drivers || [])[0]),
        likely_objection: str((lo.key_factors || [])[0]),
        recommended_rep_approach: str(persona.repApproach),
        minimum_bar_for_progression: str(df.minimum_bar_for_progression),
        internal_monologue: str(cp.perspective_statement),
    };
}

// ─── buildHcpBrainPersonaContext ──────────────────────────────────────────────

/**
 * Returns a multi-line string to inject into scenario/evaluation prompts.
 * Grounds the LLM dialogue generation and evaluation in this HCP persona.
 * INCLUDES realism tier metadata for QA validation and internal tracing.
 */
export function buildHcpBrainPersonaContext(hcpBrain) {
    if (!hcpBrain) return "";
    const cp = hcpBrain.clinician_perspective || {};
    const lo = hcpBrain.likely_objections || {};
    const ps = hcpBrain.pressure_signals || {};
    const ra = hcpBrain.recommended_rep_approach || {};
    const persona = hcpBrain.persona || {};
    const rawArchetype = str(hcpBrain.selections?.behavior_archetype);
    const archetype = rawArchetype.replace(/_/g, " ");
    const stage = str(hcpBrain.selections?.journey_stage).replace(/_/g, " ");
    
    // ── Resolve realism tier from live_temperature ──────────────────────────────────
    const temp = Number(hcpBrain.live_temperature ?? hcpBrain.initial_temperature ?? 5);
    const realismLevel = Math.max(1, Math.min(10, Math.round(temp)));
    let realismTier = "mid";
    let cooperationLevel = 0.5;
    let resistanceLevel = 0.5;
    let interruptionLikelihood = 0.3;
    let escalationLevel = 0.3;

    // LOW tier (1–3): Cooperative, direct, minimal friction
    if (realismLevel <= 3) {
      realismTier = "low";
      cooperationLevel = 0.85;      // High willingness
      resistanceLevel = 0.15;       // Low resistance
      interruptionLikelihood = 0.1; // Rarely interrupts
      escalationLevel = 0.05;       // Almost no escalation
    }
    // HIGH tier (7–10): Strong resistance, demands specificity
    else if (realismLevel >= 7) {
      realismTier = "high";
      cooperationLevel = 0.15;      // Low willingness
      resistanceLevel = 0.85;       // High resistance
      interruptionLikelihood = 0.7; // Frequently interrupts
      escalationLevel = 0.75;       // Frequent escalation pressure
    }
    // MID tier (4–6): Selective skepticism, requires clarity
    else {
      realismTier = "mid";
      cooperationLevel = 0.5;       // Balanced
      resistanceLevel = 0.5;        // Balanced
      interruptionLikelihood = 0.35; // Occasional interrupts
      escalationLevel = 0.4;        // Moderate escalation risk
    }

    return [
        "HCP Brain Persona Context",
        "══════════ PREDICTIVE HCP BRAIN (persona-first source) ══════════",
        `Archetype: ${archetype} (${rawArchetype}) | Stage: ${stage}`,
        `Internal monologue: "${str(persona.internalMonologue)}"`,
        `Quality test: "${str(cp.quality_test_question)}"`,
        `Likely objection: "${str((lo.key_factors || [])[0])}"`,
        `Pressure signal: "${str((ps.key_factors || [])[0])}"`,
        "",
        "REALISM TIER METADATA:",
        `  Realism Level: ${realismLevel}/10 | Tier: ${realismTier.toUpperCase()}`,
        `  Cooperation Level: ${(cooperationLevel * 100).toFixed(0)}% | Resistance Level: ${(resistanceLevel * 100).toFixed(0)}%`,
        `  Interruption Likelihood: ${(interruptionLikelihood * 100).toFixed(0)}% | Escalation Level: ${(escalationLevel * 100).toFixed(0)}%`,
        "",
        "Trust breakers (rep speech patterns that raise guardedness):",
        (cp.trust_breakers || []).slice(0, 2).map((b) => `  • ${b}`).join("\n"),
        "",
        "Credibility drivers (rep behaviors that earn softening):",
        (cp.clinical_credibility_drivers || []).slice(0, 2).map((d) => `  • ${d}`).join("\n"),
        "",
        "Recommended rep approach: " + str(persona.repApproach),
        "Resistance triggers: " + str(persona.resistanceTriggers),
        "",
        "HCP dialogue rules:",
        `  • If REP triggers a trust breaker → redirect to practical/workflow reality, increase guardedness`,
        `  • If REP demonstrates a credibility driver → soften slightly, offer more clinical detail`,
        `  • If REP satisfies quality test → show conditional openness, may reveal real barrier`,
        `  • If REP fails quality test → challenge relevance, stay guarded`,
        `  • REALISM TIER ENFORCEMENT: Apply ${realismTier.toUpperCase()} tier behavioral rules (cooperation=${cooperationLevel.toFixed(2)}, resistance=${resistanceLevel.toFixed(2)})`,
        "═════════════════════════════════════════════════════════════════",
    ].filter(Boolean).join("\n");
}

// ─── evaluateRepAgainstBrain ──────────────────────────────────────────────────

// Keyword sets per archetype for credibility detection
const ARCHETYPE_CREDIBILITY_KEYWORDS = {
    time_constrained_community_doctor: [
        "workflow", "staff", "prior auth", "access", "burden", "friction",
        "operational", "team", "process", "implementation step",
    ],
    skeptical_specialist: [
        "subgroup", "real-world", "your patients", "your panel", "patient population",
        "specific patients", "evidence in", "data in", "trial population",
    ],
    curious_uncertain_adopter: [
        "first patient", "low risk", "start with", "patient criteria", "pilot",
        "one step", "first use", "low-risk", "manageable", "criteria",
    ],
    cost_focused_decision_maker: [
        "cost", "budget", "payer", "formulary", "roi", "financial",
        "access burden", "value metric", "prior auth", "outcome delta",
    ],
};

// Keyword sets per archetype for trust-breaker detection
const ARCHETYPE_TRUST_BREAKER_KEYWORDS = {
    time_constrained_community_doctor: [
        "strong efficacy", "highly effective", "significant improvement",
        "demonstrated superiority", "clinical outcomes", "proven results",
    ],
    skeptical_specialist: [
        "most patients", "all patients", "generally effective", "broadly",
        "across all", "standard of care", "clearly better",
    ],
    curious_uncertain_adopter: [
        "you should", "time to switch", "make the switch", "commit to",
        "we recommend moving", "start prescribing",
    ],
    cost_focused_decision_maker: [
        "clinical benefits", "high efficacy", "strong efficacy",
        "therapeutic advantage", "best in class",
    ],
};

// Generic patterns that trigger resistance across all archetypes
const GENERIC_TRUST_BREAKER_PATTERNS = [
    "best in class", "game changer", "market leader", "value proposition",
    "unique mechanism", "leverag", "proven to be", "highly effective",
    "demonstrated superiority", "strong efficacy", "unmatched",
];

// Generic credibility signals across all archetypes
const GENERIC_CREDIBILITY_PATTERNS = [
    "workflow", "staff", "prior auth", "access", "burden", "friction",
    "patient criteria", "your patients", "formulary", "coverage",
    "which patients", "patient selection", "practical",
];

/**
 * Deterministic evaluation of a REP transcript against the HCP Brain.
 * Returns hcp_brain_alignment object.
 */
export function evaluateRepAgainstBrain(repText, hcpBrain) {
    const lower = String(repText || "").toLowerCase();
    const archetype = str(hcpBrain?.selections?.behavior_archetype);

    // Trust breaker detection
    const archetypeBreakers = ARCHETYPE_TRUST_BREAKER_KEYWORDS[archetype] || [];
    const triggeredBreakers = [
        ...GENERIC_TRUST_BREAKER_PATTERNS.filter((kw) => lower.includes(kw)),
        ...archetypeBreakers.filter((kw) => lower.includes(kw)),
    ];
    const uniqueBreakers = [...new Set(triggeredBreakers)];

    // Credibility driver detection
    const archetypeCredibility = ARCHETYPE_CREDIBILITY_KEYWORDS[archetype] || [];
    const demonstratedCredibility = [
        ...GENERIC_CREDIBILITY_PATTERNS.filter((kw) => lower.includes(kw)),
        ...archetypeCredibility.filter((kw) => lower.includes(kw)),
    ];
    const uniqueCredibility = [...new Set(demonstratedCredibility)];

    // Quality test satisfied
    const qualityTestPatterns = {
        time_constrained_community_doctor:
            /\b(workflow|access|staff|prior auth|burden|friction|operational|implementation)\b/,
        skeptical_specialist:
            /\b(evidence|data|subgroup|population|real.world|your patients|specific)\b/,
        curious_uncertain_adopter:
            /\b(first patient|low risk|start with|patient criteria|pilot|one step|criteria)\b/,
        cost_focused_decision_maker:
            /\b(cost|budget|payer|formulary|financial|roi|access burden|value)\b/,
    };
    const qualityTestRegex = qualityTestPatterns[archetype] || /\b(workflow|evidence|patient|access|cost)\b/;
    const qualityTestSatisfied = qualityTestRegex.test(lower);

    // Likely objection addressed
    const likelyObjection = str((hcpBrain?.likely_objections?.key_factors || [])[0]).toLowerCase();
    const objKws = likelyObjection
        ? likelyObjection.split(/\s+/).filter((w) => w.length > 4)
        : ["workflow", "access", "staff", "data", "evidence", "cost", "burden"];
    const likelyObjectionAddressed = objKws.some((kw) => lower.includes(kw));

    // Pressure signals detected
    const pressureKws = ["time", "busy", "constraint", "workflow", "access", "prior auth", "staff burden"];
    const pressureSignalsDetected = pressureKws.some((kw) => lower.includes(kw));

    // Recommended approach used
    const approachKeywords = {
        time_constrained_community_doctor: ["workflow", "access", "first step", "one step", "narrow"],
        skeptical_specialist: ["precision", "your patients", "evidence in", "subgroup", "diagnostic"],
        curious_uncertain_adopter: ["criteria", "first patient", "pilot", "low risk", "together"],
        cost_focused_decision_maker: ["cost", "value", "metric", "outcome delta", "budget"],
    };
    const recommendedApproachUsed = (approachKeywords[archetype] || []).some((kw) => lower.includes(kw));

    // Language that works used
    const lwKws = ["specific", "your patients", "practical", "workflow", "patient", "for you"];
    const languageThatWorkedUsed = lwKws.some((kw) => lower.includes(kw));

    // Resistance language triggered
    const resistanceLanguageTriggered = uniqueBreakers.length > 0;

    // Build rationale
    const parts = [];
    if (uniqueBreakers.length > 0) {
        parts.push(`Trust breaker language detected (${uniqueBreakers.slice(0, 2).join(", ")}), which elevates HCP guardedness for this archetype.`);
    }
    if (uniqueCredibility.length > 0) {
        parts.push(`Credibility signals present (${uniqueCredibility.slice(0, 2).join(", ")}), which are receptivity-positive for this persona.`);
    }
    if (qualityTestSatisfied) {
        parts.push(`Quality test likely satisfied — transcript addresses what this HCP is testing.`);
    } else {
        parts.push(`Quality test not clearly satisfied — rep did not address the persona's primary decision concern.`);
    }

    return {
        quality_test_satisfied: qualityTestSatisfied,
        credibility_drivers_demonstrated: uniqueCredibility.slice(0, 4),
        trust_breakers_triggered: uniqueBreakers.slice(0, 4),
        likely_objections_addressed: likelyObjectionAddressed,
        pressure_signals_detected: pressureSignalsDetected,
        recommended_rep_approach_used: recommendedApproachUsed,
        language_that_worked_used: languageThatWorkedUsed,
        resistance_language_triggered: resistanceLanguageTriggered,
        alignment_rationale: parts.join(" ") || "Alignment assessed from transcript content against HCP Brain persona.",
    };
}

// ─── buildHcpBrainCoaching ────────────────────────────────────────────────────

const ARCHETYPE_IMPROVED_RESPONSES = {
    time_constrained_community_doctor:
        `Before discussing any data, let me ask — when therapy changes don't get integrated in your clinic, is the bigger issue prior-auth callbacks, staff follow-through, or patient-identification time? I want to focus on whichever is the real constraint for your team.`,
    skeptical_specialist:
        `I don't want to lead with broad claims. In patients like yours — specifically [patient segment] — the data is strongest in [specific finding]. I want to confirm that's relevant to your actual panel before we go further.`,
    curious_uncertain_adopter:
        `What would a low-risk first step look like for you? If we identified one patient profile where you'd feel confident trying this, what criteria would make that feel safe enough to start?`,
    cost_focused_decision_maker:
        `Before the clinical discussion, I want to address the access side. In your formulary context, the typical prior-auth pathway is [specific steps]. Can I show you how the value calculation holds up when you factor in access burden versus the actual outcome delta?`,
};

/**
 * Builds structured HCP Brain coaching from a deterministic alignment result.
 */
export function buildHcpBrainCoaching(alignment, hcpBrain, repPhrase) {
    const persona = hcpBrain?.persona || {};
    const cp = hcpBrain?.clinician_perspective || {};
    const lo = hcpBrain?.likely_objections || {};
    const archetype = str(hcpBrain?.selections?.behavior_archetype);

    const qt = str(cp.quality_test_question, "Did the rep demonstrate understanding of my primary concern?");
    const tbTriggered = Array.isArray(alignment?.trust_breakers_triggered)
        ? alignment.trust_breakers_triggered
        : [];
    const cdDemonstrated = Array.isArray(alignment?.credibility_drivers_demonstrated)
        ? alignment.credibility_drivers_demonstrated
        : [];

    const qualityTestFeedback = alignment?.quality_test_satisfied
        ? `Quality test met. The HCP was evaluating: "${qt}" — your response addressed this.`
        : `Quality test not met. The HCP was evaluating: "${qt}" — address this directly before advancing claims.`;

    const trustBreakerFeedback =
        tbTriggered.length > 0
            ? `Trust breaker triggered: "${tbTriggered[0]}". This raises guardedness for this persona. Avoid: ${(cp.trust_breakers || []).slice(0, 2).join("; ")}.`
            : `No major trust breakers detected. Watch for: ${(cp.trust_breakers || []).slice(0, 2).join("; ")}.`;

    const credibilityFeedback =
        cdDemonstrated.length > 0
            ? `Credibility signal demonstrated: "${cdDemonstrated[0]}". This builds receptivity with this persona.`
            : `No clear credibility signals detected. This persona responds to: ${(cp.clinical_credibility_drivers || []).slice(0, 2).join("; ")}.`;

    const objectionFeedback = alignment?.likely_objections_addressed
        ? `The likely objection (${str((lo.key_factors || [])[0], "operational concerns")}) was acknowledged.`
        : `The likely objection was not addressed. This persona's most predictable concern: "${str((lo.key_factors || [])[0], "operational constraints")}".`;

    const repMoveFeedback = alignment?.recommended_rep_approach_used
        ? `Your approach aligned with the recommended strategy: "${str(persona.repApproach)}".`
        : `Recommended approach for this persona: "${str(persona.repApproach, "lead with one workflow-reducing step and ask for a narrow next action")}". Your response did not clearly demonstrate this strategy.`;

    const improvedResponse =
        ARCHETYPE_IMPROVED_RESPONSES[archetype] ||
        `Address the HCP's primary concern ("${str(persona.likelyObjections, "operational constraints")}") before introducing clinical claims. Ask one diagnostic question to discover their specific barrier.`;

    return {
        quality_test_feedback: qualityTestFeedback,
        credibility_driver_feedback: credibilityFeedback,
        trust_breaker_feedback: trustBreakerFeedback,
        objection_alignment_feedback: objectionFeedback,
        recommended_rep_move_feedback: repMoveFeedback,
        improved_response_grounded_in_hcp_brain: improvedResponse,
    };
}
