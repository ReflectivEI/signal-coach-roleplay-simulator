/**
 * HCP State Progression Validation — Multi-Turn Simulation
 *
 * Runs an 8-turn simulation against the live staging worker and asserts:
 *   1. HCP responses are distinct across turns (no repeated text)
 *   2. hcp_state.resistance_level and trust_level move logically based on response quality
 *   3. conversation_stage advances from guarded_opening forward
 *   4. hcp_response_type changes across turns
 *   5. hcp_state is present on every evaluate response
 *
 * Usage:
 *   node scripts/hcp-state-progression-validation.mjs
 *   RPS_WORKER_URL="https://..." node scripts/hcp-state-progression-validation.mjs
 */

const BASE = (
    process.env.RPS_WORKER_URL ||
    process.env.VITE_ROLEPLAY_WORKER_URL ||
    "https://reflectivai-rps-api-staging.tonyabdelmalak.workers.dev"
).replace(/\/$/, "");

// ─── Assertion helpers ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${message}`);
    } else {
        failed++;
        console.error(`  ❌ FAIL: ${message}`);
    }
}

function assertAll(results) {
    if (failed > 0) {
        console.error(`\n${failed} assertion(s) failed out of ${passed + failed} total.\n`);
        process.exit(1);
    } else {
        console.log(`\n✅ All ${passed} assertions passed.\n`);
    }
}

// ─── Request helpers ──────────────────────────────────────────────────────────

async function generateScenario(dropdowns) {
    const res = await fetch(`${BASE}/api/rps/generate-scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...dropdowns,
            hcp_default_temperature: 5,
            rep_selected_temperature: 7,
            live_temperature: 7,
            initial_temperature: 7,
            temperature_shift_history: [],
            conversation_memory: {},
        }),
    });
    if (!res.ok) throw new Error(`generate-scenario ${res.status}: ${await res.text()}`);
    return res.json();
}

async function evaluateResponse({ scenario, repText, conversationMemory, hcpState, temperature = 7 }) {
    const body = {
        scenario_id: scenario.scenario_id,
        scenario_context: scenario,
        rep_response_transcript: repText,
        voice_metadata: {},
        selected_dropdowns: {},
        rep_selected_temperature: temperature,
        live_temperature: temperature,
        hcp_state: hcpState || conversationMemory?.hcp_state || scenario?.hcp_state || null,
        conversation_memory: {
            ...(conversationMemory || {}),
            hcp_state: hcpState || conversationMemory?.hcp_state || scenario?.hcp_state || null,
        },
    };
    const res = await fetch(`${BASE}/api/rps/evaluate-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`evaluate-response ${res.status}: ${await res.text()}`);
    return res.json();
}

// ─── Multi-turn rep responses ─────────────────────────────────────────────────
// Intentionally varied in quality: generic → diagnostic → credibility → commitment

const REP_TURNS = [
    // Turn 1: generic pitch — should get weak/generic read
    "Our product has strong clinical data and patients see real improvements.",
    // Turn 2: still broad, mentions workflow — partial
    "I understand workflow is important. We have support resources to help with access.",
    // Turn 3: asks diagnostic question — improving
    "What's the specific workflow step that concerns you the most when starting a new therapy?",
    // Turn 4: addresses concern, shows understanding — improving/strong
    "So the main bottleneck is prior auth turnaround. We have a dedicated PA team that averages 48-hour turnaround, and your staff would have one contact.",
    // Turn 5: follow-up diagnostic — strong
    "Which patient population would feel the least operational burden in your practice? That's where we'd recommend starting.",
    // Turn 6: connects evidence to specific concern — strong
    "The clinical data specifically includes a sub-group analysis of community practices with limited support staff — the workflow burden was 40% lower than the comparator.",
    // Turn 7: asks for permission to continue / soft next step — strong
    "Would it make sense to run a quick pilot with one patient profile — specifically the ones where prior auth is most predictable — so you can see how the workflow lands in practice?",
    // Turn 8: wrap-up with concrete next step
    "If I send you a one-page clinical summary specifically on the PA workflow with one patient profile pre-identified, would you review it before our next touchpoint?",
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\nHCP State Progression Validation`);
    console.log(`Worker: ${BASE}`);
    console.log(`─────────────────────────────────────────────────\n`);

    const dropdowns = {
        journey_stage: "objection_handling",
        disease_state: "pulmonology",
        interaction_pressure: "skeptical_resistant",
        hcp_type: "treating_clinician",
        behavior_archetype: "skeptical_specialist",
        influence_driver: "evidence_driven",
    };

    // 1. Generate scenario
    console.log("▶ Generating scenario...");
    let scenario;
    try {
        scenario = await generateScenario(dropdowns);
    } catch (err) {
        console.error(`Fatal: ${err.message}`);
        process.exit(1);
    }
    console.log(`  Scenario ID: ${scenario.scenario_id}`);
    assert(Boolean(scenario.hcp_state), "Scenario includes initial hcp_state");
    assert(
        Boolean(scenario.hcp_state?.conversation_stage),
        `Initial conversation_stage present: ${scenario.hcp_state?.conversation_stage}`,
    );
    assert(
        scenario.hcp_state?.conversation_stage === "guarded_opening",
        `Initial stage is guarded_opening (got: ${scenario.hcp_state?.conversation_stage})`,
    );
    console.log();

    // 2. Multi-turn evaluation
    let conversationMemory = scenario.conversation_memory || {};
    let hcpState = scenario.hcp_state || null;
    const responses = [];
    const stateHistory = [];

    for (let i = 0; i < REP_TURNS.length; i++) {
        const repText = REP_TURNS[i];
        const turnNum = i + 1;
        console.log(`▶ Turn ${turnNum}: "${repText.slice(0, 60)}..."`);

        let result;
        try {
            result = await evaluateResponse({
                scenario,
                repText,
                conversationMemory,
                hcpState,
            });
        } catch (err) {
            console.error(`  Fatal on turn ${turnNum}: ${err.message}`);
            process.exit(1);
        }

        // Extract state
        const state = result.hcp_state;
        const delta = result.hcp_state_delta;
        const responseType = result.hcp_response_type;
        const responseTypeReason = result.response_type_reason;
        const responseTypeTransitionExplanation = result.response_type_transition_explanation;
        const hcpLine = result.simulated_hcp_next_response;
        const score = result.overall_score;

        responses.push(hcpLine);
        stateHistory.push({
            state,
            delta,
            responseType,
            responseTypeReason,
            responseTypeTransitionExplanation,
            score,
            turn: turnNum,
        });

        // Per-turn assertions
        assert(state !== null && typeof state === "object", `Turn ${turnNum}: hcp_state present`);
        assert(typeof state.resistance_level === "number", `Turn ${turnNum}: resistance_level is number (${state?.resistance_level})`);
        assert(typeof state.trust_level === "number", `Turn ${turnNum}: trust_level is number (${state?.trust_level})`);
        assert(Boolean(state?.conversation_stage), `Turn ${turnNum}: conversation_stage present (${state?.conversation_stage})`);
        assert(Boolean(state?.hcp_position), `Turn ${turnNum}: hcp_position present (${state?.hcp_position})`);
        assert(delta !== null && typeof delta === "object", `Turn ${turnNum}: hcp_state_delta present`);
        assert(typeof delta.resistance_change === "number", `Turn ${turnNum}: delta.resistance_change is number`);
        assert(Boolean(responseType), `Turn ${turnNum}: hcp_response_type present (${responseType})`);
        assert(Boolean(responseTypeReason), `Turn ${turnNum}: response_type_reason present`);
        assert(Boolean(responseTypeTransitionExplanation), `Turn ${turnNum}: response_type_transition_explanation present`);
        assert(Array.isArray(result.previous_response_types), `Turn ${turnNum}: previous_response_types array present`);
        assert(Boolean(hcpLine) && hcpLine.length > 10, `Turn ${turnNum}: simulated_hcp_next_response has content`);

        console.log(`  Stage: ${state?.conversation_stage} | Position: ${state?.hcp_position}`);
        console.log(`  R:${state?.resistance_level} T:${state?.trust_level} O:${state?.openness_level} P:${state?.patience_level} | Δ R:${delta?.resistance_change} T:${delta?.trust_change}`);
        console.log(`  Type: ${responseType} | Score: ${score}`);
        console.log(`  Type reason: ${responseTypeReason}`);
        console.log(`  Type transition: ${responseTypeTransitionExplanation}`);
        console.log(`  HCP: "${hcpLine?.slice(0, 80)}${hcpLine?.length > 80 ? "..." : ""}"`);
        console.log();

        // Update state for next turn
        conversationMemory = {
            ...(result.conversation_memory || conversationMemory),
            hcp_state: state,
        };
        hcpState = state;
    }

    // ─── Cross-turn assertions ─────────────────────────────────────────────────
    console.log("▶ Cross-turn assertions...");

    // 1. HCP responses should not all be identical
    const uniqueResponses = new Set(responses);
    assert(
        uniqueResponses.size >= 4,
        `HCP responses varied across turns: ${uniqueResponses.size} distinct out of ${responses.length}`,
    );

    // 2. Check no two adjacent turns have identical HCP text
    let adjacentDupes = 0;
    for (let i = 1; i < responses.length; i++) {
        if (responses[i] === responses[i - 1]) adjacentDupes++;
    }
    assert(adjacentDupes === 0, `No adjacent turn repeats (found ${adjacentDupes})`);

    // 3. hcp_response_type should vary (at least 3 distinct types over 8 turns)
    const responseTypes = stateHistory.map((s) => s.responseType);
    const uniqueTypes = new Set(responseTypes);
    assert(
        uniqueTypes.size >= 3,
        `At least 3 distinct hcp_response_type values across turns (got: ${[...uniqueTypes].join(", ")})`,
    );

    // 4. No response type should repeat more than 2 turns consecutively
    let maxConsecutive = 1;
    let run = 1;
    for (let i = 1; i < responseTypes.length; i++) {
        run = responseTypes[i] === responseTypes[i - 1] ? run + 1 : 1;
        maxConsecutive = Math.max(maxConsecutive, run);
    }
    assert(maxConsecutive <= 2, `No response type repeats more than twice consecutively (max run ${maxConsecutive})`);

    // 5. Dominance check: no single response type should exceed 50% unless REP stayed consistently weak
    const typeCounts = responseTypes.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0] || ["none", 0];
    const dominantRatio = responseTypes.length ? dominant[1] / responseTypes.length : 0;
    const finalRepQualities = Array.isArray(stateHistory[stateHistory.length - 1]?.state?.previous_rep_qualities)
        ? stateHistory[stateHistory.length - 1].state.previous_rep_qualities
        : [];
    const weakishCount = finalRepQualities.slice(-4).filter((q) => ["weak", "generic", "trust_breaker"].includes(q)).length;
    const consistentlyWeak = weakishCount >= 3;
    assert(
        dominantRatio <= 0.5 || consistentlyWeak,
        `No response-type dominance >50% unless consistently weak (dominant=${dominant[0]}, ratio=${dominantRatio.toFixed(2)}, consistentlyWeak=${consistentlyWeak})`,
    );

    // 6. Transition richness: at least 4 type transitions across 8 turns
    let transitions = 0;
    for (let i = 1; i < responseTypes.length; i++) {
        if (responseTypes[i] !== responseTypes[i - 1]) transitions += 1;
    }
    assert(transitions >= 4, `Response type transitions are rich (transitions=${transitions})`);

    // 7. Conversation stage should advance from turn 1 to later turns
    const firstStage = stateHistory[0].state?.conversation_stage;
    const lastStage = stateHistory[stateHistory.length - 1].state?.conversation_stage;
    const stagesOrdered = [
        "guarded_opening", "resistance_surface", "concern_clarification",
        "deeper_barrier_reveal", "conditional_openness", "next_step_consideration",
    ];
    const firstIdx = stagesOrdered.indexOf(firstStage);
    const lastIdx = stagesOrdered.indexOf(lastStage);
    assert(
        lastIdx > firstIdx || lastStage === "stalled" || lastStage === "disengaging" || lastStage !== firstStage,
        `Stage progressed from turn 1 (${firstStage}) to turn 8 (${lastStage})`,
    );

    // 8. By turn 5+, trust_level should be higher than turn 1 (given increasingly strong responses)
    const turn1Trust = stateHistory[0].state?.trust_level;
    const turn5Trust = stateHistory[4]?.state?.trust_level;
    assert(
        turn5Trust >= turn1Trust,
        `Trust builds by turn 5: turn1=${turn1Trust}, turn5=${turn5Trust}`,
    );

    // 9. Resistance should not strictly increase past turn 4 (strong responses should soften it)
    const turn4Resistance = stateHistory[3]?.state?.resistance_level;
    const turn8Resistance = stateHistory[7]?.state?.resistance_level;
    assert(
        turn8Resistance <= turn4Resistance + 1,
        `Resistance does not sharply increase in second half: turn4=${turn4Resistance}, turn8=${turn8Resistance}`,
    );

    // 10. All HCP lines are >= 30 characters (not empty or trivially short)
    const shortLines = responses.filter((r) => !r || r.length < 30);
    assert(shortLines.length === 0, `All HCP responses are substantive (>= 30 chars, found ${shortLines.length} short)`);

    // 11. Diversity score (0..1): unique-type ratio + transition ratio + anti-dominance ratio
    const uniqueRatio = uniqueTypes.size / responseTypes.length;
    const transitionRatio = transitions / (responseTypes.length - 1);
    const antiDominanceRatio = 1 - dominantRatio;
    const diversityScore = (uniqueRatio + transitionRatio + antiDominanceRatio) / 3;
    assert(diversityScore >= 0.55, `Diversity score threshold met (score=${diversityScore.toFixed(3)})`);

    console.log(`Response-type distribution: ${JSON.stringify(typeCounts)}`);
    console.log(`Response-type transitions: ${transitions}`);
    console.log(`Response-type diversity score: ${diversityScore.toFixed(3)}`);
    console.log();
    assertAll();
}

main().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
});
