import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fixtures from "./fixtures/roleplay-runtime-fixtures.json" with { type: "json" };

import { computeAlignment } from "../src/components/roleplay/alignmentEngine.jsx";
import {
  deriveInitialState,
  deriveInitialTemperature,
  transitionSeverity,
  transitionState,
  transitionTemperature,
} from "../src/components/roleplay/hcpSimulationEngine.jsx";
import {
  HCP_RENDERING_ENTRY_POINTS,
  validateHcpRenderingEntryPointAudit,
} from "../src/lib/roleplay/hcpRenderingEntryPoints.js";

const EXPECTED_METRIC_KEYS = [
  "signal_awareness",
  "signal_interpretation",
  "value_connection",
  "customer_engagement",
  "objection_navigation",
  "conversation_management",
  "adaptive_response",
  "commitment_generation",
];

test("computeAlignment returns 8-capability rubric output", () => {
  const alignment = computeAlignment("neutral", "Thanks for your time—what matters most for your workflow today?");
  const metricKeys = Object.keys(alignment.metrics).sort();
  assert.deepEqual(metricKeys, [...EXPECTED_METRIC_KEYS].sort());
  assert.equal(typeof alignment.score, "number");
  assert.ok(alignment.score >= 1 && alignment.score <= 5);
});

test("runtime replay fixtures execute deterministically across scoring and transitions", () => {
  for (const fixture of fixtures) {
    const firstAlignment = computeAlignment(
      fixture.prevState,
      fixture.repMessage,
      null,
      fixture.prevTemp,
      fixture.prevHcpState,
    );
    const secondAlignment = computeAlignment(
      fixture.prevState,
      fixture.repMessage,
      null,
      fixture.prevTemp,
      fixture.prevHcpState,
    );

    assert.equal(firstAlignment.score, secondAlignment.score, `${fixture.name}: score should be deterministic`);
    assert.deepEqual(firstAlignment.metrics, secondAlignment.metrics, `${fixture.name}: metrics should be deterministic`);

    const nextStateA = transitionState(fixture.prevState, fixture.repMessage, fixture.prevTemp);
    const nextStateB = transitionState(fixture.prevState, fixture.repMessage, fixture.prevTemp);
    assert.equal(nextStateA, nextStateB, `${fixture.name}: next state should be deterministic`);

    const nextTempA = transitionTemperature(fixture.prevTemp, fixture.repMessage);
    const nextTempB = transitionTemperature(fixture.prevTemp, fixture.repMessage);
    assert.equal(nextTempA, nextTempB, `${fixture.name}: next temperature should be deterministic`);

    const nextSeverity = transitionSeverity(
      fixture.prevSeverity,
      firstAlignment,
      fixture.prevState,
      nextStateA,
    );
    assert.ok(nextSeverity >= 0 && nextSeverity <= 2, `${fixture.name}: severity should stay in [0,2]`);
  }
});

test("deriveInitialState/deriveInitialTemperature remain stable for same scenario text", () => {
  const scenario = {
    title: "Busy clinic with low staffing and heavy schedule pressure",
    description: "HCP says there is no time for long discussions right now.",
    details: "Workflow bottleneck and rushed appointments.",
  };

  const stateA = deriveInitialState(scenario);
  const stateB = deriveInitialState(scenario);
  assert.equal(stateA, stateB);

  const tempA = deriveInitialTemperature(stateA);
  const tempB = deriveInitialTemperature(stateB);
  assert.equal(tempA, tempB);
});

test("deriveInitialState honors explicit runtime behavior tags before prose inference", () => {
  const state = deriveInitialState({
    title: "Busy clinic with staffing pressure",
    description: "The scenario prose mentions time pressure and prior-auth backlog.",
    runtimeBehaviorTags: { startingState: "engaged", timePressure: "low", engagementLevel: "engaged" },
    hcpStateModel: { startingState: "engaged" },
  });

  assert.equal(state, "engaged");
  assert.equal(deriveInitialTemperature(state), "positive");
});

test("direct HCP metric/threshold question is penalized when rep answer is non-specific", () => {
  const vagueAnswer = computeAlignment(
    "time-pressured",
    "Side effect profile.",
    { hcpUtterance: "What's the specific viral load threshold that would indicate this treatment is effective and worth scaling?" },
    "neutral",
    "time-pressured",
  );

  const concreteAnswer = computeAlignment(
    "time-pressured",
    "Track viral load at week 4 and consider scaling if patients stay suppressed under 200 copies/mL without new tolerability issues.",
    { hcpUtterance: "What's the specific viral load threshold that would indicate this treatment is effective and worth scaling?" },
    "neutral",
    "time-pressured",
  );

  assert.ok(
    vagueAnswer.metrics.signal_interpretation.score < concreteAnswer.metrics.signal_interpretation.score,
    "non-specific reply should score lower on signal interpretation than a concrete answer"
  );
  assert.ok(
    vagueAnswer.metrics.conversation_management.score < concreteAnswer.metrics.conversation_management.score,
    "threshold question without numeric anchor should reduce conversation management score"
  );
});

test("multi-scenario fixtures keep deterministic scoring and stronger replies outperform weak replies", () => {
  const scenarioFixtures = [
    {
      scenarioId: "hiv_prep_like",
      scenarioTitle: "HIV Prevention Gap : High-Risk Population",
      scenarioDescription: "Urban clinic managing PrEP adherence and payer barriers.",
      hcpUtterance: "What specific evidence should change my current PrEP approach?",
      weakReply: "To share data.",
      strongReply: "In high-risk patients, week-12 retention improved by 18%, and we can pilot one eligibility checklist this week.",
    },
    {
      scenarioId: "oncology_access_like",
      scenarioTitle: "Biomarker Access Delay in Metastatic Care",
      scenarioDescription: "Tumor board debating pathway fit and reimbursement denials.",
      hcpUtterance: "What practical change improves biomarker turnaround without delaying treatment starts?",
      weakReply: "We can follow up.",
      strongReply: "Use same-day reflex ordering; centers cut biomarker turnaround by 4 days and reduced treatment-start delays.",
    },
    {
      scenarioId: "cardiometabolic_like",
      scenarioTitle: "Cardiometabolic Adherence Bottleneck",
      scenarioDescription: "Formulary restrictions and refill gaps in diabetes clinic.",
      hcpUtterance: "How do we reduce refill drop-off in the next month?",
      weakReply: "Schedule time.",
      strongReply: "Start a refill-outreach queue: one nurse call at day 21 reduced 30-day refill gaps by 12% in a similar clinic.",
    },
    {
      scenarioId: "general_access_like",
      scenarioTitle: "Workflow Integration Pilot",
      scenarioDescription: "Staff burden and operational bottlenecks in a general clinic.",
      hcpUtterance: "What first workflow step can we test this week?",
      weakReply: "We should discuss.",
      strongReply: "Pilot a front-desk routing checklist for one week and track same-day completion rate.",
    },
  ];

  for (const fixture of scenarioFixtures) {
    const weak = computeAlignment(
      "time-pressured",
      fixture.weakReply,
      { hcpUtterance: fixture.hcpUtterance },
      "neutral",
      "time-pressured",
    );
    const strong = computeAlignment(
      "time-pressured",
      fixture.strongReply,
      { hcpUtterance: fixture.hcpUtterance },
      "neutral",
      "time-pressured",
    );

    assert.ok(
      strong.score >= weak.score,
      `${fixture.scenarioId}: stronger response should not score lower than weak response`,
    );

    const weakState = transitionState("time-pressured", fixture.weakReply, "neutral");
    const strongState = transitionState("time-pressured", fixture.strongReply, "neutral");
    assert.ok(
      EXPECTED_METRIC_KEYS.every((metricKey) => typeof strong.metrics?.[metricKey]?.score === "number"),
      `${fixture.scenarioId}: strong reply should produce complete metric snapshot`,
    );
    assert.ok(
      EXPECTED_METRIC_KEYS.every((metricKey) => typeof weak.metrics?.[metricKey]?.score === "number"),
      `${fixture.scenarioId}: weak reply should produce complete metric snapshot`,
    );
    assert.ok(
      [weakState, strongState].every((state) => typeof state === "string" && state.length > 0),
      `${fixture.scenarioId}: transition state should resolve for weak and strong turns`,
    );
  }
});

test("live RolePlayChat path protects engaged evidence-seeking turns from premature terminal mapping", () => {
  const source = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /function isEvidenceSeekingEngagement/);
  assert.match(source, /const engagedEvidenceSeekingRequest = isEvidenceSeekingEngagement/);
  assert.match(source, /holdAtBoundary: engagedEvidenceSeekingRequest && !overrideExit/);
  assert.match(source, /hasMaterialProgression: engagedEvidenceSeekingRequest \|\| materiallyProgressedConstraintRequest/);
});

test("live RolePlayChat path applies hard-demand priority lock and writes traceable planner fields", () => {
  const source = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /updateHardDemandPriorityState/);
  assert.match(source, /hardDemandPriorityLock/);
  assert.match(source, /pendingSecondaryConcerns/);
  assert.match(source, /hardDemandReleaseReason/);
  assert.match(source, /secondaryConcernBuffered/);
  assert.match(source, /secondaryConcernSuppressed/);
  assert.match(source, /narrowingLevel/);
  assert.match(source, /supersessionReason/);
  assert.match(source, /hardDemandUnresolved/);
  assert.match(source, /lockedPlannerObjective/);
  assert.match(source, /objectiveOverrideBlocked/);
  assert.match(source, /const chosenResponseObjective = objectiveOverrideBlocked[\s\S]*lockedPlannerObjective/);
  assert.match(source, /buildHardDemandLockedObjective/);
  assert.match(source, /lateTurnConstraintDecision\.forced && !objectiveOverrideBlocked/);
  assert.match(source, /hardDemandContinuation:\s*hardDemandState\.hardDemandPriorityLock/);
});

test("live RolePlayChat path preserves canonical HCP identity and blocks generic fallback overwrite", () => {
  const source = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );
  const identityHelper = fs.readFileSync(
    new URL("../src/components/roleplay/hcpIdentity.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /resolveCanonicalHcpIdentity/);
  assert.match(source, /canonicalHcpIdentityRef/);
  assert.match(source, /canonicalHcpDisplayName/);
  assert.match(source, /hcpIdentitySource/);
  assert.match(source, /hcpIdentityPreserved/);
  assert.match(source, /hcpFallbackUsed/);
  assert.match(identityHelper, /scenario\?\.hcpProfile\?\.name/);
  assert.match(identityHelper, /isGenericLabel/);
});

test("live RolePlayChat path applies deterministic operational realism register enforcement between planner and final turn contract", () => {
  const source = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );
  const enforcerSource = fs.readFileSync(
    new URL("../src/components/roleplay/operationalRealismEnforcer.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /determinePreferredHcpDialogueRegister/);
  assert.match(source, /enforceOperationalRealismPreference/);
  assert.match(source, /runtimeScenarioContractRef\.current\?\.hcpStateModel\?\.startingState/);
  assert.match(source, /cueText:\s*respondingToTurn\?\.cueBefore/);
  assert.match(source, /emitPlannerTrace\("operational_realism_register"/);

  assert.ok(enforcerSource.includes("canonicalProfile.role"));
  assert.ok(enforcerSource.includes("canonicalSceneSetup.timePressure"));
  assert.ok(enforcerSource.includes("canonicalSceneSetup.currentClinicalOperationalContext"));
  assert.match(enforcerSource, /patient_selection_practical/);
  assert.match(enforcerSource, /workflow_implementation/);
});

test("live RolePlayChat path binds cue/dialogue/coaching/scoring to a deterministic hcpReactionContract", () => {
  const source = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );
  const integritySource = fs.readFileSync(
    new URL("../src/components/roleplay/hcpReactionIntegrity.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /buildHcpReactionContract/);
  assert.match(source, /enforceCueDialogueContractIntegrity/);
  assert.match(source, /scoringContextInput/);
  assert.match(source, /scoringCueContext/);
  assert.match(source, /scoringDialogueContext/);
  assert.match(source, /cueDialogueAlignmentStatus/);
  assert.match(source, /reactionContractHash/);
  assert.match(source, /repEvidenceContextHash/);
  assert.match(source, /hcpReactionContract/);

  assert.match(integritySource, /reactionContractHash/);
  assert.match(integritySource, /repEvidenceContextHash/);
  assert.match(integritySource, /selectedDialogueRegister/);
  assert.match(integritySource, /coachingTriggerInputs/);
  assert.match(integritySource, /scoringContext/);
});

test("active runtime route remains RolePlaySimulator -> ScenarioCard -> RolePlayChat with history passed into buildHCPDialoguePrompt", () => {
  const simulatorSource = fs.readFileSync(
    new URL("../src/pages/RolePlaySimulator.jsx", import.meta.url),
    "utf8",
  );
  const scenarioCardSource = fs.readFileSync(
    new URL("../src/components/roleplay/ScenarioCard.jsx", import.meta.url),
    "utf8",
  );
  const rolePlayChatSource = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );

  assert.match(simulatorSource, /EnterpriseScenarioCard/);
  assert.match(scenarioCardSource, /import RolePlayChat from "\.\/RolePlayChat"/);
  assert.match(scenarioCardSource, /<RolePlayChat scenario=\{scenario\}/);
  assert.match(rolePlayChatSource, /const historyText = flattenTurns\(prevTurns\)/);
  assert.match(rolePlayChatSource, /buildHCPDialoguePrompt\(\{\s*[\s\S]*historyText,/);
});

test("live HCP rendering entry point audit forbids runtime fallback renderers", () => {
  const audit = validateHcpRenderingEntryPointAudit();
  assert.equal(audit.valid, true, audit.issues.join(", "));
  assert.equal(audit.liveRuntimeEntryCount, 1);

  const liveEntries = HCP_RENDERING_ENTRY_POINTS.filter((entry) => entry.liveRuntime);
  assert.deepEqual(liveEntries.map((entry) => entry.id), ["RolePlayChat.finalConversationalRealism"]);
  assert.ok(liveEntries.every((entry) => entry.classification === "contract-bound/state-driven/scenario-bound"));
  assert.ok(liveEntries.every((entry) => entry.requires.includes("scenarioExecutionContract")));
  assert.ok(liveEntries.every((entry) => entry.requires.includes("activeAskState")));
  assert.ok(liveEntries.every((entry) => entry.requires.includes("validHcpRealismState")));
});

test("live RolePlayChat final HCP render is hard-gated to contract-bound state", () => {
  const source = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /scenarioExecutionContract:\s*scenarioExecutionContract[\s\S]*scenarioIdentity:\s*scenarioExecutionContract\.scenarioIdentity/);
  assert.match(source, /scenarioExecutionContract:\s*scenarioExecutionContract[\s\S]*activeAsk:\s*scenarioExecutionContract\.activeAsk/);
  assert.match(source, /scenarioExecutionContract:\s*scenarioExecutionContract[\s\S]*stateMachine:\s*scenarioExecutionContract\.stateMachine/);
  assert.match(source, /const conversationalRealism = applyConversationalRealism\(\{[\s\S]*activeAskState:\s*conversationActiveAskState/);
  assert.match(source, /const conversationalRealism = applyConversationalRealism\(\{[\s\S]*scenarioExecutionContract:\s*roleplayTurnValidationContext\.scenarioExecutionContract \|\| null/);
  assert.match(source, /const conversationalRealism = applyConversationalRealism\(\{[\s\S]*requireContractBound:\s*true/);
});

test("RPS HCP dialogue locks Predictive Builder/Predictive Brain output before deterministic rewrites", () => {
  const rolePlaySource = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );
  const workerSource = fs.readFileSync(
    new URL("../worker/index.ts", import.meta.url),
    "utf8",
  );

  assert.match(rolePlaySource, /draftResponseSource = "predictive_route_authoritative"/);
  assert.match(rolePlaySource, /predictiveSource === "predictive_brain"/);
  assert.match(rolePlaySource, /predictiveAuthoritativeDialogue = nextHcpDialogue/);
  assert.match(rolePlaySource, /function cleanPredictiveAuthoritativeDialogue/);
  assert.match(rolePlaySource, /const preservePredictiveAuthority = \(layerName = "downstream_rewrite"\) => \{/);
  assert.match(rolePlaySource, /const latestAskBoundDialogue = predictiveRouteAuthoritative \|\| liveTurnAuthorityBypass/);
  assert.match(rolePlaySource, /const demandHoldActive = ENABLE_V2_INTERVENTION_RUNTIME[\s\S]*&& !predictiveRouteAuthoritative/);
  assert.match(rolePlaySource, /const finalSurfaceDialogue = predictiveRouteAuthoritative[\s\S]*\? preservePredictiveAuthority\("hcp_response_surface"\)/);
  assert.match(rolePlaySource, /predictiveAuthorityLocked: predictiveRouteAuthoritative/);
  assert.match(rolePlaySource, /deterministicRewriteLayersSuppressedByPredictiveAuthority/);

  assert.match(workerSource, /Use the Predictive HCP Brain as the source of truth/);
  assert.match(workerSource, /Match the quality bar of the Predictive Builder Test HCP Response/);
  assert.match(workerSource, /Do not copy the validator-only fallback, right-panel recommendation text, or generic menu labels as the HCP dialogue/);
  assert.doesNotMatch(workerSource, /same scenario lane/);
});

test("right-panel REP recommendation text remains isolated from HCP dialogue runtime", () => {
  const rolePlaySource = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );
  const storeSource = fs.readFileSync(
    new URL("../src/lib/simulatorIntelligenceStore.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(rolePlaySource, /safestResponse/);
  assert.doesNotMatch(rolePlaySource, /Recommended intervention point/i);
  assert.doesNotMatch(rolePlaySource, /recommended response loaded/i);
  assert.match(storeSource, /function selectNonRepeatingRepGuidance/);
  assert.match(storeSource, /responseSimilarity\(line, candidate\) >= 0\.72/);
  assert.doesNotMatch(
    storeSource,
    /safestResponse:\s*"That is an important safety question\./,
    "right-panel REP guidance must not fall back to one hard-coded looping safety line",
  );
});

test("live RolePlayChat resets scenario-bound realism memory on scenario changes", () => {
  const source = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /recentDialoguePhrasesRef\.current\s*=\s*\[\]/);
  assert.match(source, /recentCueHistoryRef\.current\s*=\s*\[\]/);
  assert.match(source, /lastSubmittedTurnKeyRef\.current\s*=\s*""/);
  assert.match(source, /loggedTurnKeysRef\.current\s*=\s*new Set\(\)/);
  assert.match(source, /processedTurnKeysRef\.current\s*=\s*new Set\(\)/);
});

test("live RolePlayChat renders HCP cues even when the opening turn has no dialogue", () => {
  const source = fs.readFileSync(
    new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /function hasVisibleHcpCue\(turn = \{\}\)/);
  assert.match(source, /if \(turn\.hcpDialogueBefore \|\| hasVisibleHcpCue\(turn\)\)/);
  assert.match(source, /SHOW_VISIBLE_HCP_CUES && hasVisibleHcpCue\(turn\)/);
});

test("HCP generator enforces Predictive Brain authority, escalation memory, and validator guardrails", () => {
  const generatorSource = fs.readFileSync(
    new URL("../src/lib/hcpResponseGenerator.ts", import.meta.url),
    "utf8",
  );
  const surfaceSource = fs.readFileSync(
    new URL("../src/lib/hcpResponseSurface.ts", import.meta.url),
    "utf8",
  );

  assert.match(generatorSource, /PREDICTIVE HCP BRAIN \(AUTHORITATIVE SOURCE OF TRUTH FOR HCP DIALOGUE\)/);
  assert.match(generatorSource, /Use the Predictive HCP Brain as the source of truth/);
  assert.match(generatorSource, /Guardrails may constrain or request regeneration, but they must not become the voice of the HCP/);

  for (const requiredField of [
    "repeatedRepPatternCount",
    "unansweredQuestionCount",
    "genericAfterSpecificityCount",
    "lastRepIntent",
    "escalationLevel",
  ]) {
    assert.match(generatorSource, new RegExp(requiredField), `missing escalation memory field ${requiredField}`);
  }

  assert.match(generatorSource, /function applyEscalationBehavior/);
  assert.match(generatorSource, /LOW realism: preserve cooperation/);
  assert.match(generatorSource, /MEDIUM realism: show visible impatience/);
  assert.match(generatorSource, /HIGH realism: escalate quickly/);
  assert.match(generatorSource, /PRESSURE PERSISTENCE \(validator constraint - do not use stock phrases\)/);
  assert.match(generatorSource, /regenerateWithPredictiveBrain/);
  assert.match(generatorSource, /final_stock_phrase_detected: hasGlobalStockPhrase/);
  assert.match(generatorSource, /final_missing_pressure: missingPersistentPressure/);

  for (const banned of [
    "what['’]?s concretely different for me after this",
    "the practical answer has to stay tied",
    "what changes in practice if this is worth continuing",
    "i hear that a lot",
    "keep this brief",
    "i['’]?m not convinced yet",
  ]) {
    assert.ok(generatorSource.includes(banned), `missing banned phrase pattern ${banned}`);
  }

  assert.doesNotMatch(
    surfaceSource,
    /output\s*=\s*`\$\{output\}\s+\$\{pickDeterministicTimeTail/,
    "surface layer must not append deterministic time-pressure tails",
  );
  assert.match(surfaceSource, /output = trimToSentences\(enforceSentenceBoundaries\(output\), 1\)/);
});
