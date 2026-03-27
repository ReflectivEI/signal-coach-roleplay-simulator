import test from "node:test";
import assert from "node:assert/strict";

import { computeAlignment } from "../src/components/roleplay/alignmentEngine.jsx";
import {
  deriveInitialState,
  deriveInitialTemperature,
  transitionSeverity,
  transitionState,
  transitionTemperature,
} from "../src/components/roleplay/hcpSimulationEngine.jsx";

const EXCHANGES_PER_SCENARIO = 12;
const DEMO_SCENARIO_SMOKE_CASES = [
  { id: "hiv_im_prep_lowshare", title: "HIV Prevention Gap in High-Risk Population", description: "Time-pressed IM clinic under-identifies PrEP candidates.", hcp_category: "Prescriber / Treater", influence_driver: "Patient-Centered" },
  { id: "hiv_pa_treat_switch_slowdown", title: "Treatment Optimization in Stable HIV Patients", description: "Academic HIV center perceives optimization complete.", hcp_category: "KOL / Thought Leader", influence_driver: "Evidence-Based" },
  { id: "onc_md_io_adc_pathways", title: "ADC Integration with IO Backbone", description: "Oncology center balancing pathway and infusion constraints.", hcp_category: "KOL / Thought Leader", influence_driver: "Evidence-Based" },
  { id: "onc_np_pathway_ops", title: "Pathway-Driven Care with Staffing Constraints", description: "Community infusion NP needs workflow-safe implementation.", hcp_category: "Prescriber / Treater", influence_driver: "Patient-Centered" },
  { id: "cv_card_md_hf_gdmt_uptake", title: "Heart Failure GDMT Optimization Challenge", description: "Academic HF service needs stronger four-pillar adoption.", hcp_category: "KOL / Thought Leader", influence_driver: "Evidence-Based" },
  { id: "cv_np_ckd_sglt2_calendar", title: "Rural HF Program with CKD Safety Concerns", description: "Risk-averse NP uncertain about CKD treatment protocols.", hcp_category: "Prescriber / Treater", influence_driver: "Risk-Averse" },
  { id: "vac_id_adult_flu_playbook", title: "Adult Flu Program Optimization", description: "ID practice needs guideline-consistent seasonal execution.", hcp_category: "KOL / Thought Leader", influence_driver: "Guideline-Anchored" },
  { id: "covid_pulm_md_antiviral_ddi_path", title: "Outpatient Antiviral Optimization", description: "Pulmonary practice slowed by DDI triage complexity.", hcp_category: "Prescriber / Treater", influence_driver: "Risk-Averse" },
  { id: "neuro_access", title: "Neurology Market Access", description: "Payer-facing discussion on prior authorization friction.", hcp_category: "Non-Prescribing Influencer", influence_driver: "Risk-Averse" },
  { id: "rare_diagnosis", title: "Rare Disease Diagnosis Journey", description: "Academic specialist needs efficient diagnostic pathway recognition.", hcp_category: "KOL / Thought Leader", influence_driver: "Evidence-Based" },
];

const REP_MESSAGES = [
  "I heard your team is short on time—what is one measurable outcome you need to improve this month?",
  "If we pilot one protocol this week, we can track completion rate and staff handoff time.",
  "Can we focus on one patient segment where the current workflow is breaking down most often?",
  "In similar clinics, adding a checklist reduced rework and improved follow-through within 2-4 weeks.",
  "What is the biggest blocker today: candidate identification, access, or follow-up execution?",
  "We can start with one concrete change and review results at your next team huddle.",
  "Would a short one-pager for staff reduce back-and-forth while keeping quality controls in place?",
  "If we align on criteria now, we can avoid inconsistent decisions later in the pathway.",
  "Can we define a simple success metric so your team knows this is helping and not adding burden?",
  "I can share an implementation template used by similar practices to reduce delays and missed steps.",
  "What would make this practical for your current staffing level over the next two weeks?",
  "Let's agree on one next step you can action immediately and one checkpoint to measure impact.",
];

test("smoke: 10-scenario demo set remains stable across 12 exchanges each", () => {
  assert.equal(DEMO_SCENARIO_SMOKE_CASES.length, 10, "smoke set should include 10 scenarios");

  for (const scenario of DEMO_SCENARIO_SMOKE_CASES) {
    let state = deriveInitialState(scenario);
    let temp = deriveInitialTemperature(state);
    let severity = 0;

    for (let i = 0; i < EXCHANGES_PER_SCENARIO; i += 1) {
      const repMessage = REP_MESSAGES[i % REP_MESSAGES.length];
      const hcpUtterance = `${scenario.title} ${scenario.description}`;

      const alignmentA = computeAlignment(state, repMessage, { hcpUtterance }, temp, state);
      const alignmentB = computeAlignment(state, repMessage, { hcpUtterance }, temp, state);

      assert.equal(alignmentA.score, alignmentB.score, `${scenario.id} turn ${i + 1}: scoring should be deterministic`);
      assert.deepEqual(alignmentA.metrics, alignmentB.metrics, `${scenario.id} turn ${i + 1}: metric breakdown should be deterministic`);
      assert.ok(alignmentA.score >= 1 && alignmentA.score <= 5, `${scenario.id} turn ${i + 1}: score should stay in [1, 5]`);

      const nextStateA = transitionState(state, repMessage, temp);
      const nextStateB = transitionState(state, repMessage, temp);
      assert.equal(nextStateA, nextStateB, `${scenario.id} turn ${i + 1}: next state should be deterministic`);

      const nextTempA = transitionTemperature(temp, repMessage);
      const nextTempB = transitionTemperature(temp, repMessage);
      assert.equal(nextTempA, nextTempB, `${scenario.id} turn ${i + 1}: next temperature should be deterministic`);

      const nextSeverity = transitionSeverity(severity, alignmentA, state, nextStateA);
      assert.ok(nextSeverity >= 0 && nextSeverity <= 2, `${scenario.id} turn ${i + 1}: severity should stay in [0, 2]`);

      state = nextStateA;
      temp = nextTempA;
      severity = nextSeverity;
    }
  }
});
