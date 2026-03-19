// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react";
import AIScenarioGenerator from "../components/scenariobuilder/AIScenarioGenerator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import RolePlayChat from "@/components/roleplay/RolePlayChat";
import { Search, SlidersHorizontal, X } from "lucide-react";

const CATEGORIES = ["All", "HIV / PrEP", "Oncology", "Cardiology", "Vaccines", "COVID-19", "Neurology", "Immunology", "Rare Disease"];
const DIFFICULTIES = ["All Levels", "beginner", "intermediate", "advanced"];

const DISEASE_STATES = ["All Disease States", "HIV / PrEP", "Oncology", "Cardiology", "Vaccines", "COVID-19", "Neurology", "Immunology", "Rare Disease"];
const SPECIALTIES = ["All Specialties", "Internal Medicine", "Infectious Diseases", "Hem/Onc", "Medical Oncology", "Cardiology", "Family Medicine", "Neurology", "Pulmonology"];
const HCP_CATEGORIES = ["All HCP Types", "Prescriber / Treater", "KOL / Thought Leader", "Non-Prescribing Influencer"];
const INFLUENCE_DRIVERS = ["All Influence Drivers", "Patient-Centered", "Evidence-Based", "Risk-Averse", "Guideline-Anchored"];

// ...existing code...

const ALL_SCENARIOS = [
  // ── HIV / PrEP ─────────────────────────────────────────────────────────────
  {
    id: "hiv_im_prep_lowshare",
    title: "HIV Prevention Gap in High-Risk Population",
    description: "IM prescriber underutilizes PrEP despite steady STI testing in young MSM",
    category: "HIV / PrEP",
    specialty: "Internal Medicine",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Patient-Centered",
    stakeholder: "Dr. Maya Patel - Internal Medicine MD, Urban Clinic",
    difficulty: "intermediate",
    objective: "Create urgency around PrEP gaps; commit to proactive PrEP prescribing where appropriate and standardize quarterly follow-ups",
    context: "This time-pressed IM physician has inconsistent quarterly labs and follow-ups. STI testing volume suggests missed PrEP opportunities. Clinic believes few true PrEP candidates exist despite evidence to the contrary.",
    openingScene: "Dr. Patel glances at her watch as you enter. She's between patients, typing notes rapidly. 'I have about 10 minutes,' she says without looking up. 'What's this about?'",
    hcpMood: "time-pressured, skeptical",
    challenges: ["Belief that few patients are true PrEP candidates","Renal safety and monitoring workload concerns","Limited time for detailed discussions","Prior auth burden for PrEP medications"],
    keyMessages: ["Quantify at-risk patient pool from STI volume","Review TAF-based PrEP renal safety advantages","Propose nurse-led PrEP/lab cadence","Streamlined quarterly follow-up protocol"],
    impact: ["Reduce new HIV infections in at-risk population","Improve clinic PrEP initiation rates by 30%","Establish standardized monitoring workflow","Protect high-risk patients proactively"],
    suggestedPhrasing: ["I noticed your STI testing volume suggests there may be patients who could benefit from PrEP. Can we review the data together?","TAF-based PrEP offers renal safety advantages that may address your monitoring concerns. Would you like to see the comparison data?","What if we set up a nurse-led protocol to handle quarterly labs and follow-ups? This could reduce your workload significantly."],
    // focus_capabilities: ["signal_awareness", "conversation_management"],
  },
  {
    id: "hiv_np_highshare_access",
    title: "PrEP Access Barriers Despite Strong Adoption",
    description: "NP with strong PrEP adoption faces prior-auth workload and staffing friction",
    category: "HIV / PrEP",
    specialty: "Infectious Diseases",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Patient-Centered",
    stakeholder: "Sarah Thompson, NP - HIV Specialty Clinic",
    difficulty: "advanced",
    objective: "Broaden appropriate PrEP use via predictable PA batching and support roles; revisit patients on older regimens with unrestricted coverage",
    context: "High-performing NP with excellent PrEP adoption. However, prior-auth burden and limited staffing cap patient throughput. Workflow friction limits breadth of appropriate prescribing.",
    openingScene: "Sarah looks up from a stack of prior-auth forms with a tired smile. 'I love getting my patients on PrEP, but honestly, the paperwork is killing us. We're drowning in PAs.'",
    hcpMood: "frustrated, overwhelmed",
    challenges: ["Prior-auth processing burden","Limited staffing resources","Workflow friction for new starts","Time constraints during patient visits"],
    keyMessages: ["Implement twice-weekly PA batching protocol","Partner with specialty pharmacy for benefits checks","Identify patients on older regimens with commercial coverage for optimization","Streamlined hub enrollment process"],
    impact: ["Increase patient access to optimal PrEP regimen","Reduce staff burnout from PA processing","Optimize eligible patients to newer regimens","Improve clinic efficiency by 25%"],
    suggestedPhrasing: ["Your PrEP adoption is excellent. What if we could reduce the PA burden by batching them twice weekly?","I can connect you with our specialty pharmacy partner to handle benefits verification. Would that help free up your staff?","There may be patients on older regimens with commercial coverage who could benefit from newer options without additional PA. Can we identify them together?"],
    // focus_capabilities: ["objection_navigation", "value_connection"],
  },
  {
    id: "hiv_pa_treat_switch_slowdown",
    title: "Treatment Optimization in Stable HIV Patients",
    description: "Top HIV clinic with declining optimization velocity; perception that most patients are already on best regimens",
    category: "HIV / PrEP",
    specialty: "Infectious Diseases",
    hcp_category: "KOL / Thought Leader",
    influence_driver: "Evidence-Based",
    stakeholder: "Michael Chen, PA-C - Academic HIV Center",
    difficulty: "advanced",
    objective: "Reinforce durability and convenience benefits; define clear optimization criteria and implement quarterly review",
    context: "Hospital-affiliated ID clinic where prior optimization velocity fell to 1-2 patients in 13 weeks. Strong perception that most patients are already optimized on current regimens.",
    openingScene: "Michael leans back in his chair, arms crossed but with an open expression. 'I'm always interested in better outcomes for my patients. What data do you have on long-term durability?'",
    hcpMood: "curious, data-driven",
    challenges: ["Reluctance to optimize stable, suppressed patients","Perception of complete optimization","Limited awareness of newer treatment options","Competing clinical priorities"],
    keyMessages: ["Long-term durability and resistance barrier data","Simplified regimen improves adherence","Create candidate list by labs/adherence flags","Schedule switch day with counseling script"],
    impact: ["Improve long-term treatment outcomes","Reduce pill burden for eligible patients","Proactive resistance prevention","Enhanced patient satisfaction"],
    suggestedPhrasing: ["Even with stable, suppressed patients, there may be opportunities to simplify regimens. Can we review which patients might benefit?","The resistance barrier data for single-tablet regimens is compelling for long-term durability. Would you like to see the latest studies?","What if we scheduled a quarterly optimization day to systematically review candidates? I can provide a counseling script to streamline the process."],
    // focus_capabilities: ["signal_interpretation", "commitment_generation"],
  },
  {
    id: "hiv_np_cab_growth",
    title: "Cabotegravir Interest Without Systematic Screening",
    description: "CAB share growing but NP honors requests without systematic adherence/resistance evaluation",
    category: "HIV / PrEP",
    specialty: "Infectious Diseases",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Patient-Centered",
    stakeholder: "Jennifer Williams, NP - Community Health Center",
    difficulty: "intermediate",
    objective: "Align on candidacy and monitoring criteria; protect long-term regimen durability through proper screening",
    context: "Patient demand is driving CAB/RPV selection without systematic adherence and resistance evaluation. Risk of inappropriate starts and treatment failures.",
    openingScene: "Jennifer greets you warmly but looks slightly uncertain. 'I'm glad you're here. My patients keep asking about the long-acting injectable, and I want to make sure I'm doing this right. I've started a few, but I'm not sure if I'm screening properly.'",
    hcpMood: "uncertain, eager to learn",
    challenges: ["Patient-driven selection without clinical criteria","Uncertainty about resistance screening requirements","Monitoring protocol gaps","Missed-dose management concerns"],
    keyMessages: ["Adopt eligibility checklist for long-acting candidates","Review resistance history before initiation","Establish missed-dose action plan","Set up injection calendar system"],
    impact: ["Prevent treatment failures from inappropriate selection","Protect long-term regimen options","Improve patient outcomes with proper screening","Reduce virologic breakthrough risk"],
    suggestedPhrasing: ["I understand patients are asking for long-acting options. Would an eligibility checklist help ensure we're selecting the right candidates?","Resistance history is critical for CAB success. Can I share a screening protocol that other practices have found helpful?","What's your current approach for missed-dose scenarios? I have some resources that could help with patient counseling."],
    // focus_capabilities: ["signal_awareness", "value_connection"],
  },
  // ── Oncology ────────────────────────────────────────────────────────────────
  {
    id: "onc_md_io_adc_pathways",
    title: "ADC Integration with IO Backbone",
    description: "Solid-tumor center evaluating ADCs; P&T scrutinizes cost/response and chair time",
    category: "Oncology",
    specialty: "Hem/Onc",
    hcp_category: "KOL / Thought Leader",
    influence_driver: "Evidence-Based",
    stakeholder: "Dr. Robert Chen - Hematology/Oncology, Community Practice",
    difficulty: "advanced",
    objective: "Define biomarker-driven patient subset with clear OS/PFS benefit and operational fit; add to order sets and tumor board review",
    context: "Center is IO-backbone heavy with toxicity bandwidth constraints. P&T committee focuses on cost-per-response and infusion chair time. Need to demonstrate clear value proposition.",
    openingScene: "Dr. Chen looks up from reviewing lab results, his expression thoughtful. 'I've been hearing about the ADC data. Our P&T committee is very cost-conscious, and we're already managing a lot of IO toxicity. What makes this worth adding to our pathways?'",
    hcpMood: "analytical, cost-conscious",
    challenges: ["Toxicity management resource constraints","P&T cost scrutiny and pathway integration","Infusion chair time limitations","Competition with established IO regimens"],
    keyMessages: ["Biomarker-driven patient selection criteria","Clear delta OS/PFS vs standard of care","AE mitigation and management protocols","NCCN category of evidence alignment"],
    impact: ["Expand treatment options for biomarker+ patients","Improve progression-free survival","Establish clear pathway position","Enhance tumor board decision-making"],
    suggestedPhrasing: ["For your biomarker-positive patients, the OS/PFS data shows a clear benefit. Would you like to review the subset analysis?","I understand chair time is a concern. The infusion protocol is designed to fit within your existing workflow. Can I walk you through it?","This aligns with the NCCN category of evidence. Would it help to present this to your tumor board?"],
    // focus_capabilities: ["value_connection", "objection_navigation"],
  },
  {
    id: "onc_np_pathway_ops",
    title: "Pathway-Driven Care with Staffing Constraints",
    description: "Community infusion site with conservative IO use and short-staffed AE clinics",
    category: "Oncology",
    specialty: "Medical Oncology",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Patient-Centered",
    stakeholder: "Lisa Martinez, NP - Community Oncology Infusion Center",
    difficulty: "intermediate",
    objective: "Standardize NP-led education and toxicity call-tree; add AE one-pager to pathway handouts",
    context: "Conservative IO adoption due to staffing and AE management concerns. Education packets inconsistent across patients. Need standardized approach within resource constraints.",
    openingScene: "Lisa is organizing patient education materials when you arrive. She looks up with a mix of frustration and hope. 'We're so short-staffed right now. I want to use the best treatments, but I need systems that won't overwhelm my team. Can you help with that?'",
    hcpMood: "overwhelmed, seeking solutions",
    challenges: ["Staffing limitations for AE management","Pathway paperwork burden","Inconsistent patient education","Limited time for toxicity monitoring"],
    keyMessages: ["Template kits for patient education","Standing nurse protocols for common AEs","Streamlined pathway documentation","Toxicity call-tree for efficient triage"],
    impact: ["Improve patient safety with standardized protocols","Reduce staff burden through efficiency","Increase confidence in IO prescribing","Better patient outcomes with consistent education"],
    suggestedPhrasing: ["I have template kits that other infusion centers have used successfully. Would you like to see how they've streamlined patient education?","A toxicity call-tree could help your team triage more efficiently. Can I share one that's been working well?","Standing nurse protocols for common AEs could reduce the documentation burden. Would that be helpful to review?"],
    // focus_capabilities: ["adaptive_response", "commitment_generation"],
  },
  {
    id: "onc_pa_gu_oral_onc_tminus7",
    title: "Oral Oncolytic Onboarding Optimization",
    description: "GU team struggles with hub forms and day-25-30 refill gaps",
    category: "Oncology",
    specialty: "Medical Oncology",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Patient-Centered",
    stakeholder: "David Park, PA-C - GU Oncology Practice",
    difficulty: "beginner",
    objective: "Adopt T-7 onboarding with early hub enrollment, benefits check, and day-10 toxicity tele-visit",
    context: "Fragmented onboarding leads to late hub enrollment and refill gaps at days 25-30. Patients experience treatment interruptions affecting outcomes.",
    openingScene: "David is reviewing a patient chart with visible frustration. 'Another refill gap. This is the third one this month. We're losing patients to these administrative delays. There has to be a better way to handle this.'",
    hcpMood: "frustrated, process-focused",
    challenges: ["Fragmented onboarding process","Late hub enrollment timing","Day-25-30 refill gaps","Inconsistent toxicity monitoring"],
    keyMessages: ["T-7 onboarding checklist implementation","Early hub enrollment at prescription","Day-10 toxicity tele-visit protocol","Refill safeguard system"],
    impact: ["Eliminate treatment interruptions","Improve medication adherence rates","Earlier toxicity detection and management","Better patient outcomes through continuity"],
    suggestedPhrasing: ["If we enroll patients in the hub at T-7, we can avoid those day-25 refill gaps. Would you like to see the onboarding checklist?","A day-10 toxicity tele-visit catches issues early before they become serious. How does that fit with your current workflow?","Early benefits verification prevents surprises at the pharmacy. Can I show you how other GU practices have implemented this?"],
    // focus_capabilities: ["signal_interpretation", "conversation_management"],
  },
  {
    id: "onc-kol",
    title: "Oncology KOL Introduction",
    description: "First meeting with a key opinion leader in breast cancer treatment",
    category: "Oncology",
    specialty: "Medical Oncology",
    hcp_category: "KOL / Thought Leader",
    influence_driver: "Evidence-Based",
    stakeholder: "Dr. Sarah Chen, MD - Medical Oncologist, Cancer Center Director",
    difficulty: "advanced",
    objective: "Establish credibility and schedule a follow-up meeting to discuss clinical data",
    context: "Dr. Chen is highly published in HER2+ breast cancer. She's skeptical of new therapies without robust long-term data. Her time is extremely limited.",
    openingScene: "Dr. Chen glances at her watch as you enter. 'I have 15 minutes before my next patient. Make it count.'",
    hcpMood: "skeptical, time-pressured",
    challenges: ["Limited time window (15 minutes)","High skepticism toward pharma reps","Demands peer-reviewed evidence","Already loyal to competitor product"],
    keyMessages: ["Novel mechanism of action","Phase 3 overall survival data","Quality of life improvements","Patient support program"],
    impact: ["Establish key opinion leader relationship","Open door for clinical data presentation","Potential speaker/advisory opportunity","Regional practice influence"],
    suggestedPhrasing: ["I know your time is valuable. I have one piece of data I think you'll find compelling—may I share it briefly?","Your publications in HER2+ breast cancer are impressive. Our Phase 3 data addresses some of the gaps you've written about.","Would a peer-to-peer with one of our investigators be more valuable than a follow-up with me?"],
    // focus_capabilities: ["signal_awareness", "adaptive_response"],
  },
  // ── Cardiology ──────────────────────────────────────────────────────────────
  {
    id: "cv_card_md_hf_gdmt_uptake",
    title: "Heart Failure GDMT Optimization Challenge",
    description: "ARNI uptake 62% of eligible HFrEF; SGLT2 at 38%; day-30 refill gaps",
    category: "Cardiology",
    specialty: "Cardiology",
    hcp_category: "KOL / Thought Leader",
    influence_driver: "Evidence-Based",
    stakeholder: "Dr. Amanda Lewis - Cardiologist, Academic Heart Failure Center",
    difficulty: "advanced",
    objective: "Implement discharge GDMT checklist; pharmacy tech enrollment for copay help; achieve +10pp SGLT2 in 90 days",
    context: "Top-tier HF program with suboptimal four-pillar GDMT adoption. Fellows handle PAs leading to delays. Day-30 refill gaps compromise outcomes.",
    openingScene: "Dr. Lewis is reviewing discharge summaries when you enter. She looks up with a concerned expression. 'Our GDMT numbers aren't where they should be. I know the evidence, but the copay barriers and PA delays are killing us. What can we do differently?'",
    hcpMood: "concerned, evidence-driven",
    challenges: ["Copay barriers for SGLT2 inhibitors","PA friction through fellow workflow","Handoff gaps to PCP after discharge","Inconsistent four-pillar implementation"],
    keyMessages: ["Discharge GDMT checklist implementation","Pharmacy tech copay assistance enrollment","Start SGLT2 before discharge when eligible","Convert ACE/ARB to ARNI within 48-72h per protocol"],
    impact: ["Reduce 30-day HF readmissions by 20%","Improve SGLT2 uptake to 48%+ in 90 days","Eliminate day-30 refill gaps","Better mortality outcomes with complete GDMT"],
    suggestedPhrasing: ["Starting SGLT2 before discharge captures patients while they're still in the system. What would it take to add this to your discharge protocol?","A pharmacy tech can handle copay assistance enrollment, freeing up your fellows for clinical work. Would that help?","The 48-72h window for ARNI conversion is evidence-based. Can I share the protocol that other HF centers are using?"],
    // focus_capabilities: ["value_connection", "commitment_generation"],
  },
  {
    id: "cv_np_ckd_sglt2_calendar",
    title: "Rural HF Program with CKD Safety Concerns",
    description: "SGLT2 underused in CKD stage 3 due to misconceptions; no titration calendar",
    category: "Cardiology",
    specialty: "Cardiology",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Risk-Averse",
    stakeholder: "Karen Mitchell, NP - Rural Heart Failure Clinic",
    difficulty: "intermediate",
    objective: "Implement titration calendar and CKD-safe counseling; track eGFR and UACR at baseline and 12 weeks",
    context: "Rural practice with high CKD comorbidity in HF patients. SGLT2 inhibitors underutilized due to renal safety misconceptions. No structured titration approach.",
    openingScene: "Karen looks up from patient charts, her expression cautious. 'I've been hesitant to use SGLT2 inhibitors in my CKD patients. I've heard conflicting things about renal safety, and we don't have easy access to specialists out here. Can you help me understand this better?'",
    hcpMood: "cautious, seeking guidance",
    challenges: ["CKD safety misconceptions about SGLT2i","No structured titration calendar","Limited specialist support in rural setting","Patient education gaps on sick-day rules"],
    keyMessages: ["SGLT2i renal safety data in CKD Stage 3","Standardized titration calendar template","Sick-day rules patient education","Follow-up lab monitoring protocol"],
    impact: ["Expand SGLT2i access to CKD patients","Improve cardiorenal outcomes","Reduce HF hospitalizations in rural population","Build provider confidence in CKD prescribing"],
    suggestedPhrasing: ["The DAPA-CKD and EMPA-KIDNEY trials show SGLT2i are safe in Stage 3 CKD. Would you like to review the renal outcomes?","A titration calendar takes the guesswork out of dosing. Can I share a template you could customize for your practice?","Sick-day rules are critical for patient safety. I have a one-pager that explains this in patient-friendly language."],
    focus_capabilities: ["objection_navigation", "signal_interpretation"],
  },
  {
    id: "cv_pa_postmi_transitions",
    title: "Post-MI and HF Transitions Optimization",
    description: "SGLT2 initiation often deferred to PCP; ARNI starts delayed pending echo; readmissions above benchmark",
    category: "Cardiology",
    specialty: "Cardiology",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Guideline-Anchored",
    stakeholder: "James Rodriguez, PA-C - Cardiac Care Unit",
    difficulty: "intermediate",
    objective: "Start SGLT2 prior to discharge and convert to ARNI within 48-72h; pharmacy follow-up day 7",
    context: "Post-MI patients with reduced EF often discharged without complete GDMT. SGLT2 deferred to PCP, ARNI delayed for echo. Readmission rates above national benchmark.",
    openingScene: "James is reviewing readmission data with visible concern. 'Our readmission rates are too high. I know we should be starting GDMT before discharge, but there's always something that gets deferred. How do other centers handle this transition?'",
    hcpMood: "concerned, quality-focused",
    challenges: ["Deferrals of GDMT initiation to outpatient","Delayed ARNI titration pending echo","Readmissions above benchmark","Lack of structured transition protocol"],
    keyMessages: ["In-hospital SGLT2 initiation protocol","ARNI conversion within 48-72h timeline","Day-7 pharmacy follow-up call","Transition checklist with accountable owners"],
    impact: ["Reduce 30-day readmissions to benchmark","Improve complete GDMT at discharge","Better post-MI survival outcomes","Seamless transition to outpatient care"],
    suggestedPhrasing: ["Deferring GDMT to the PCP often means it doesn't happen. What if we started SGLT2 here before discharge?","A day-7 pharmacy follow-up call catches refill issues before they become gaps. Would that help with your readmission rates?","A transition checklist with clear accountability could ensure nothing falls through the cracks. Can I share what's working at other centers?"],
    // focus_capabilities: ["adaptive_response", "conversation_management"],
  },
  {
    id: "card-formulary",
    title: "Cardiology Formulary Review",
    description: "Present to the P&T committee for formulary inclusion",
    category: "Cardiology",
    specialty: "Cardiology",
    hcp_category: "Non-Prescribing Influencer",
    influence_driver: "Evidence-Based",
    stakeholder: "Hospital P&T Committee - 8 members including pharmacists, physicians, and administrators",
    difficulty: "advanced",
    objective: "Gain preferred formulary status for your heart failure medication",
    context: "The hospital is cost-conscious but values clinical outcomes. Current standard of care is well-established. Your drug offers incremental benefit at higher cost.",
    openingScene: "The P&T committee members are reviewing budget reports. The pharmacy director looks up. 'We have three formulary requests today. You have 20 minutes.'",
    hcpMood: "cost-conscious, analytical",
    challenges: ["Price premium over existing options","Limited real-world evidence","Need pharmacoeconomic justification","Competing presentation from rival company"],
    keyMessages: ["Reduction in hospitalizations","Total cost of care savings","Improved patient outcomes","Physician feedback data"],
    impact: ["Formulary access for 2,000+ HF patients","Reduced administrative burden for prescribers","Improved patient access to therapy","Potential system-wide adoption"],
    suggestedPhrasing: ["When you factor in reduced hospitalizations, the total cost of care actually decreases. May I walk you through the pharmacoeconomic analysis?","Physicians in similar health systems have shared positive feedback on patient outcomes. Would it help to hear their experience?","Preferred formulary status would remove barriers for your prescribers. What additional data would support that decision?"],
    // focus_capabilities: ["value_connection", "objection_navigation"],
  },
  // ── Vaccines ─────────────────────────────────────────────────────────────────
  {
    id: "vac_id_adult_flu_playbook",
    title: "Adult Flu Program Optimization",
    description: "ID group with LTC/high-risk adults; late clinic launches; weak reminder-recall",
    category: "Vaccines",
    specialty: "Infectious Diseases",
    hcp_category: "KOL / Thought Leader",
    influence_driver: "Guideline-Anchored",
    stakeholder: "Dr. Evelyn Harper - Infectious Diseases Specialist",
    difficulty: "intermediate",
    objective: "Pre-book age-appropriate vaccine mix; schedule early clinics; implement SMS reminders and standing orders in LTC",
    context: "ID practice serving long-term care and high-risk adult populations. Flu coverage fell in 65+ patients. Late clinic start and weak reminder systems contribute to missed opportunities.",
    openingScene: "Dr. Evelyn Harper looks up from a stack of prior authorization forms, rubbing her temples. A frustrated sigh escapes as she sees another rep waiting. Her body language is tired but professional. The clinic is running behind, and she has three more patients before lunch.",
    hcpMood: "frustrated",
    challenges: ["Late flu clinic scheduling","Weak reminder-recall systems","Denials for 65+ formulations","LTC coordination gaps"],
    keyMessages: ["Pre-book age-appropriate vaccine mix early","Calendarize clinic days before season","EHR prompts for 65+ high-dose selection","Standing orders in LTC facilities"],
    impact: ["Increase 65+ flu coverage by 15%","Reduce hospitalizations in high-risk patients","Optimize clinic efficiency","Improve LTC protection rates"],
    suggestedPhrasing: ["Pre-booking the age-appropriate vaccine mix early ensures you have the right formulations when patients arrive. Can we plan this together?","SMS reminders have shown 20% improvement in show rates. Would you like to see how to integrate this with your EHR?","Standing orders in LTC facilities streamline the process significantly. I can help you implement this if you're interested."],
    // focus_capabilities: ["signal_awareness", "commitment_generation"],
  },
  {
    id: "vac_np_primary_care_capture",
    title: "Primary Care Vaccine Capture Improvement",
    description: "Adequate storage but VIS misses due to staff rotation; ad-hoc Saturday clinics",
    category: "Vaccines",
    specialty: "Family Medicine",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Patient-Centered",
    stakeholder: "Alex Nguyen, NP - Family Medicine Practice",
    difficulty: "beginner",
    objective: "Implement standing orders, huddle checklists, and fixed weekend clinic schedule",
    context: "Primary care practice with adequate vaccine storage but workflow inconsistencies. Staff rotation causes VIS documentation misses. Saturday clinics are ad-hoc rather than scheduled.",
    openingScene: "Alex looks up from reviewing patient charts, slightly frazzled. 'Sorry, we're short-staffed today. What can I help you with?'",
    hcpMood: "busy, slightly overwhelmed",
    challenges: ["Workflow inconsistency with staff rotation","VIS documentation misses","Ad-hoc weekend clinic scheduling","EHR prompt underutilization"],
    keyMessages: ["Standing orders for routine vaccinations","Morning huddle vaccination checklist","Fixed weekend clinic calendar","Standardized VIS documentation workflow"],
    impact: ["Improve vaccination capture rates by 20%","Reduce documentation errors","Consistent patient access on weekends","Streamlined staff workflow"],
    suggestedPhrasing: ["A morning huddle checklist ensures everyone knows who needs vaccinations that day. Would that help with staff rotation?","Fixed weekend clinic schedules are easier for patients to remember. What would it take to make Saturdays consistent?","Standing orders remove the need for individual physician authorization. Can I show you how other practices have set this up?"],
    // focus_capabilities: ["adaptive_response", "signal_interpretation"],
  },
  // ── COVID-19 ─────────────────────────────────────────────────────────────────
  {
    id: "covid_pulm_md_antiviral_ddi_path",
    title: "Outpatient Antiviral Optimization",
    description: "High-risk COPD/ILD population; Paxlovid first line but DDI triage slows prescribing",
    category: "COVID-19",
    specialty: "Internal Medicine",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Risk-Averse",
    stakeholder: "Dr. Carlos Ramos - Pulmonologist",
    difficulty: "advanced",
    objective: "Implement rapid DDI triage protocol and standing infusion slot; achieve 48-hour initiation KPI",
    context: "Pulmonology practice with high-risk COPD and ILD patients. Paxlovid is first-line but DDI complexity slows prescribing. 3-day IV remdesivir limited by infusion capacity.",
    openingScene: "Dr. Ramos is reviewing a patient's medication list, frowning. 'Another complex DDI case. I want to prescribe Paxlovid but this is going to take time to sort out.'",
    hcpMood: "concerned, methodical",
    challenges: ["DDI complexity slowing Paxlovid initiation","Limited infusion capacity for remdesivir","Delayed treatment beyond 48-hour window","Variable prescriber comfort with DDI triage"],
    keyMessages: ["Rapid DDI screening protocol","Standing infusion slot reservation","48-hour initiation as quality metric","Partner scheduling for IV options"],
    impact: ["Reduce time to antiviral initiation","Improve outcomes in high-risk patients","Decrease COVID hospitalizations","Standardize treatment approach"],
    suggestedPhrasing: ["A rapid DDI screening protocol could help you prescribe Paxlovid more confidently. Would you like to see one?","What if we reserved standing infusion slots for remdesivir candidates? That way capacity isn't a barrier.","48-hour initiation is the key quality metric. How close are you currently, and what's the biggest bottleneck?"],
    // focus_capabilities: ["conversation_management", "objection_navigation"],
  },
  {
    id: "covid_pulm_np_postcovid_adherence",
    title: "Post-COVID Clinic Antiviral Adherence",
    description: "Eligible patients present day 4-5; callbacks delay start; variable rebound education",
    category: "COVID-19",
    specialty: "Internal Medicine",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Patient-Centered",
    stakeholder: "Maria Santos, NP - Pulmonary Medicine",
    difficulty: "beginner",
    objective: "Implement same-day eRx template; create patient one-pager; route day-2 positives to NP tele-start",
    context: "Post-COVID clinic seeing eligible patients too late in disease course. Callback delays push initiation beyond therapeutic window. Inconsistent patient education on rebound symptoms.",
    openingScene: "Maria is reviewing a patient callback list, looking frustrated. 'We're seeing too many patients on day 4 or 5. By then, it's almost too late for antivirals.'",
    hcpMood: "frustrated, solution-focused",
    challenges: ["Late patient presentation (day 4-5)","Callback delays to initiation","Inconsistent rebound counseling","Limited same-day access"],
    keyMessages: ["Same-day eRx template for eligible patients","Patient one-pager on treatment expectations","Day-2 positive routing to NP tele-start","Standardized rebound education"],
    impact: ["Reduce time to treatment initiation","Improve patient adherence and expectations","Decrease hospitalization rates","Better patient satisfaction with care"],
    suggestedPhrasing: ["A same-day eRx template gets treatment started before the callback delay. Would that work for your workflow?","Patients often have questions about rebound symptoms. This one-pager addresses the most common concerns.","Routing day-2 positives directly to an NP tele-start could catch more patients in the therapeutic window. How does that sound?"],
    // focus_capabilities: ["signal_awareness", "adaptive_response"],
  },
  // ── Neurology ────────────────────────────────────────────────────────────────
  {
    id: "neuro-access",
    title: "Neurology Market Access",
    description: "Navigate prior authorization challenges with a payer",
    category: "Neurology",
    specialty: "Neurology",
    hcp_category: "Non-Prescribing Influencer",
    influence_driver: "Risk-Averse",
    stakeholder: "Dr. James Miller - Medical Director, Regional Health Plan",
    difficulty: "intermediate",
    objective: "Reduce prior authorization barriers for your multiple sclerosis therapy",
    context: "The payer has strict utilization management. Your therapy is second-line due to cost. Physicians are frustrated with approval delays.",
    openingScene: "Dr. Miller is reviewing PA metrics on his screen. 'Our approval times are up 30%. Physicians are complaining. What do you have for me?'",
    hcpMood: "concerned, data-driven",
    challenges: ["Strict step-therapy requirements","Focus on cost containment","Limited meeting time","Competing therapies on formulary"],
    keyMessages: ["Clinical differentiation data","Patient adherence benefits","Long-term cost effectiveness","Real-world outcomes"],
    impact: ["Reduce PA turnaround to 24-48 hours","Improve physician satisfaction","Faster patient access to therapy","Reduced disease progression"],
    suggestedPhrasing: ["I understand cost containment is critical. Our real-world data shows reduced relapse rates that translate to lower long-term costs.","Physicians have expressed frustration with approval delays. What would make the PA process work better for everyone?","Would you consider a streamlined approval pathway for patients who meet specific clinical criteria?"],
    // focus_capabilities: ["objection_navigation", "value_connection"],
  },
  // ── Immunology ───────────────────────────────────────────────────────────────
  {
    id: "immuno-launch",
    title: "Immunology New Product Launch",
    description: "Introduce a newly approved biologic to a rheumatology practice",
    category: "Immunology",
    specialty: "Internal Medicine",
    hcp_category: "Prescriber / Treater",
    influence_driver: "Patient-Centered",
    stakeholder: "Dr. Maria Rodriguez - Rheumatologist, Private Practice",
    difficulty: "beginner",
    objective: "Secure commitment to trial the new therapy with appropriate patients",
    context: "The practice sees many rheumatoid arthritis patients. They're familiar with existing biologics. Your product offers a novel mechanism with good safety data.",
    openingScene: "Dr. Rodriguez is reviewing patient charts between appointments. 'Another new biologic? I'm pretty comfortable with what I'm using now. What makes this different?'",
    hcpMood: "comfortable with status quo, mildly curious",
    challenges: ["Comfort with existing therapies","Concern about switching stable patients","Questions about insurance coverage","Limited office visit time"],
    keyMessages: ["Rapid onset of action","Favorable safety profile","Patient convenience features","Access and affordability programs"],
    impact: ["Expand treatment options for RA patients","Improve outcomes in inadequate responders","Establish early adoption in practice","Build foundation for broader use"],
    suggestedPhrasing: ["For patients who haven't responded adequately to current biologics, this offers a new mechanism. Would you like to identify potential candidates?","The rapid onset of action means patients may see improvement sooner. Can I share the timeline data?","Our patient support program handles coverage questions, so your staff doesn't have to. Would that be helpful?"],
    // focus_capabilities: ["signal_interpretation", "commitment_generation"],
  },
  // ── Rare Disease ─────────────────────────────────────────────────────────────
  {
    id: "rare-diagnosis",
    title: "Rare Disease Diagnosis Journey",
    description: "Help a physician recognize and diagnose a rare metabolic disorder",
    category: "Rare Disease",
    specialty: "Internal Medicine",
    hcp_category: "KOL / Thought Leader",
    influence_driver: "Evidence-Based",
    stakeholder: "Dr. Patricia Lee - Pediatric Geneticist, Academic Medical Center",
    difficulty: "intermediate",
    objective: "Increase awareness of disease symptoms and diagnostic pathway",
    context: "The condition affects 1 in 50,000 patients. Average time to diagnosis is 5 years. Your company offers the only approved treatment.",
    openingScene: "Dr. Lee is reviewing a complex case file. 'I've seen a few patients with similar presentations, but the diagnosis remains elusive. What brings you here?'",
    hcpMood: "intellectually curious, diagnostically challenged",
    challenges: ["Low disease awareness","Complex diagnostic workup","Limited patient population","Academic skepticism"],
    keyMessages: ["Red flag symptoms","Diagnostic algorithm","Early treatment benefits","Patient identification support"],
    impact: ["Reduce diagnostic odyssey for patients","Earlier intervention and treatment","Improved long-term outcomes","Regional center of excellence potential"],
    suggestedPhrasing: ["Patients with this condition often present with symptoms that could be mistaken for other disorders. I have a red flag checklist that might help with early identification.","The average diagnostic delay is 5 years. A simple screening algorithm could help identify candidates sooner. Would you like to see it?","We offer patient identification support to help find undiagnosed patients in your system. Can I explain how it works?"],
    // focus_capabilities: ["signal_awareness", "value_connection"],
  },
];

const DIFFICULTY_CONFIG = {
  beginner:     { label: "Beginner",     color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  intermediate: { label: "Intermediate", color: "bg-amber-100  text-amber-700  border-amber-200"  },
  advanced:     { label: "Advanced",     color: "bg-rose-100   text-rose-700   border-rose-200"    },
};

const CATEGORY_COLORS = {
  "HIV / PrEP":   "bg-purple-50 text-purple-700 border-purple-200",
  "Oncology":     "bg-rose-50 text-rose-700 border-rose-200",
  "Cardiology":   "bg-red-50 text-red-700 border-red-200",
  "Vaccines":     "bg-green-50 text-green-700 border-green-200",
  "COVID-19":     "bg-sky-50 text-sky-700 border-sky-200",
  "Neurology":    "bg-violet-50 text-violet-700 border-violet-200",
  "Immunology":   "bg-teal-50 text-teal-700 border-teal-200",
  "Rare Disease": "bg-orange-50 text-orange-700 border-orange-200",
};

export default function RolePlaySimulator() {
    // Modal state for AI scenario generation
    const [showScenarioGenerator, setShowScenarioGenerator] = useState(false);
    const [customScenario, setCustomScenario] = useState(null);
    // Handler for AI scenario generation
    const handleScenarioGenerated = (scenario) => {
      setCustomScenario(scenario);
      setShowScenarioGenerator(false);
    };
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeDifficulty, setActiveDifficulty] = useState("All Levels");
  const [search, setSearch] = useState("");
  const [diseaseStateFilter, setDiseaseStateFilter] = useState("All Disease States");
  const [specialtyFilter, setSpecialtyFilter] = useState("All Specialties");
  const [hcpCategoryFilter, setHcpCategoryFilter] = useState("All HCP Types");
  const [influenceDriverFilter, setInfluenceDriverFilter] = useState("All Influence Drivers");

  const filteredScenarios = useMemo(() => {
    return ALL_SCENARIOS.filter(s => {
      const catMatch = activeCategory === "All" || s.category === activeCategory;
      const diffMatch = activeDifficulty === "All Levels" || s.difficulty === activeDifficulty;
      const q = search.toLowerCase();
      const searchMatch = !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.stakeholder.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      const dsMatch = diseaseStateFilter === "All Disease States" || s.category === diseaseStateFilter;
      const specMatch = specialtyFilter === "All Specialties" || s.specialty === specialtyFilter;
      const hcpMatch = hcpCategoryFilter === "All HCP Types" || s.hcp_category === hcpCategoryFilter;
      const infMatch = influenceDriverFilter === "All Influence Drivers" || s.influence_driver === influenceDriverFilter;
      return catMatch && diffMatch && searchMatch && dsMatch && specMatch && hcpMatch && infMatch;
    });
  }, [activeCategory, activeDifficulty, search, diseaseStateFilter, specialtyFilter, hcpCategoryFilter, influenceDriverFilter]);

  const counts = useMemo(() => {
    const c = {};
    CATEGORIES.forEach(cat => {
      c[cat] = cat === "All" ? ALL_SCENARIOS.length : ALL_SCENARIOS.filter(s => s.category === cat).length;
    });
    return c;
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 md:px-10 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#39ACAC" }}>Signal Intelligence™ Practice</p>
              <h1 className="text-3xl font-bold" style={{ color: "#1A334D" }}>Role-Play Simulator</h1>
              <p className="text-sm text-gray-500 mt-1.5 max-w-xl">Practice realistic HCP conversations across disease states and stakeholder types. Each scenario provides targeted Signal Intelligence feedback.</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex flex-col items-center bg-teal-50 border border-teal-100 rounded-xl px-5 py-3">
                <span className="text-2xl font-bold text-teal-600">{ALL_SCENARIOS.length}</span>
                <span className="text-xs text-gray-500">Scenarios</span>
              </div>
              <div className="flex flex-col items-center bg-navy-50 border border-gray-200 rounded-xl px-5 py-3">
                <span className="text-2xl font-bold" style={{ color: "#1A334D" }}>{CATEGORIES.length - 1}</span>
                <span className="text-xs text-gray-500">Disease Areas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
        {/* 4 Dropdown Filters — matches screenshot exactly */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={diseaseStateFilter} onValueChange={setDiseaseStateFilter}>
              <SelectTrigger className="text-sm h-10 border-teal-300 focus:ring-teal-400" style={diseaseStateFilter !== "All Disease States" ? { borderColor: "#39ACAC", color: "#1A334D", fontWeight: 500 } : {}}>
                <SelectValue placeholder="Disease State" />
              </SelectTrigger>
              <SelectContent>
                {DISEASE_STATES.map(ds => <SelectItem key={ds} value={ds}>{ds}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="text-sm h-10" style={specialtyFilter !== "All Specialties" ? { borderColor: "#39ACAC", color: "#1A334D", fontWeight: 500 } : {}}>
                <SelectValue placeholder="Specialty" />
              </SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={hcpCategoryFilter} onValueChange={setHcpCategoryFilter}>
              <SelectTrigger className="text-sm h-10" style={hcpCategoryFilter !== "All HCP Types" ? { borderColor: "#39ACAC", color: "#1A334D", fontWeight: 500 } : {}}>
                <SelectValue placeholder="HCP Category" />
              </SelectTrigger>
              <SelectContent>
                {HCP_CATEGORIES.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={influenceDriverFilter} onValueChange={setInfluenceDriverFilter}>
              <SelectTrigger className="text-sm h-10" style={influenceDriverFilter !== "All Influence Drivers" ? { borderColor: "#39ACAC", color: "#1A334D", fontWeight: 500 } : {}}>
                <SelectValue placeholder="Influence Driver" />
              </SelectTrigger>
              <SelectContent>
                {INFLUENCE_DRIVERS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search + Difficulty Row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search scenarios, stakeholders, disease states..."
              className="pl-9 bg-white text-sm h-10"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setActiveDifficulty(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  activeDifficulty === d
                    ? "border-transparent text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
                style={activeDifficulty === d ? { background: "#1A334D" } : {}}
              >
                {d === "All Levels" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activeCategory === cat
                  ? "border-transparent text-white shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:border-teal-200 hover:text-teal-700"
              }`}
              style={activeCategory === cat ? { background: "#39ACAC" } : {}}
            >
              {cat}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${activeCategory === cat ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                {counts[cat]}
              </span>
            </button>
          ))}
        </div>

        {/* Results count and AI Generate button */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{filteredScenarios.length}</span> scenario{filteredScenarios.length !== 1 ? "s" : ""} found
          </p>
          <div className="flex gap-2">
            <button
              className="bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold px-3 py-1 rounded-lg shadow-sm"
              onClick={() => setShowScenarioGenerator(true)}
            >
              + New Scenario
            </button>
            {(activeCategory !== "All" || activeDifficulty !== "All Levels" || search || diseaseStateFilter !== "All Disease States" || specialtyFilter !== "All Specialties" || hcpCategoryFilter !== "All HCP Types" || influenceDriverFilter !== "All Influence Drivers") && (
              <button
                onClick={() => { setActiveCategory("All"); setActiveDifficulty("All Levels"); setSearch(""); setDiseaseStateFilter("All Disease States"); setSpecialtyFilter("All Specialties"); setHcpCategoryFilter("All HCP Types"); setInfluenceDriverFilter("All Influence Drivers"); }}
                className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear all filters
              </button>
            )}
          </div>
        </div>
        {/* AI Scenario Generator Modal */}
        {showScenarioGenerator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full relative flex flex-col" style={{ maxHeight: '90vh' }}>
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 z-10"
                onClick={() => setShowScenarioGenerator(false)}
                aria-label="Close scenario modal"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="overflow-y-auto" style={{ maxHeight: '75vh' }}>
                <AIScenarioGenerator
                  onGenerated={handleScenarioGenerated}
                  onCancel={() => setShowScenarioGenerator(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Scenario Grid */}
        {customScenario ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <EnterpriseScenarioCard key={customScenario.id || 'custom'} scenario={customScenario} />
            {filteredScenarios.map(s => (
              <EnterpriseScenarioCard key={s.id} scenario={s} />
            ))}
          </div>
        ) : filteredScenarios.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredScenarios.map(s => (
              <EnterpriseScenarioCard key={s.id} scenario={s} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-gray-400">
            <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-gray-600">No scenarios match your filters</p>
            <p className="text-sm mt-1">Try a different category or clear your search</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EnterpriseScenarioCard({ scenario }) {
  const [expanded, setExpanded] = useState(false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [typingText, setTypingText] = useState("");
  const [isExiting, setIsExiting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const previewTimerRef = useRef(null);
  const autoHoverEnabled = useRef(false);
  const diff = DIFFICULTY_CONFIG[scenario.difficulty] || DIFFICULTY_CONFIG.intermediate;
  const catColor = CATEGORY_COLORS[scenario.category] || "bg-gray-50 text-gray-600 border-gray-200";
  const openingScene = scenario.openingScene || "Preview the opening moment to hear how the HCP enters the conversation.";
  const challengePreview = scenario.challenges?.slice(0, 3) || [];
  const objectiveLines = String(scenario.objective || "")
    .split(/;|•|\.|,/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  const isInteractiveExpanded = expanded || hoverExpanded;

  useEffect(() => {
    if (typeof window !== "undefined") {
      autoHoverEnabled.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    }
  }, []);

  useEffect(() => {
    if (!previewing) {
      setTypingText("");
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      return undefined;
    }

    let index = 0;
    previewTimerRef.current = window.setInterval(() => {
      index += 1;
      setTypingText(openingScene.slice(0, index));
      if (index >= openingScene.length && previewTimerRef.current) {
        window.clearInterval(previewTimerRef.current);
      }
    }, 18);

    return () => {
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
    };
  }, [openingScene, previewing]);

  const handleStartScenario = () => {
    setIsExiting(true);
    window.setTimeout(() => {
      setPlaying(true);
      setIsExiting(false);
    }, 280);
  };

  const handleMouseEnter = () => {
    if (autoHoverEnabled.current) setHoverExpanded(true);
  };

  const handleMouseLeave = () => {
    if (autoHoverEnabled.current) setHoverExpanded(false);
  };

  return (
    <>
      <div
        className={`scenario-card bg-white rounded-2xl border flex flex-col overflow-hidden group ${isInteractiveExpanded ? "scenario-card-expanded border-teal-300 shadow-xl shadow-teal-100/70" : "border-gray-200 shadow-sm"} ${isExiting ? "scenario-card-exit" : ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="px-5 pt-5 pb-4 flex-1 space-y-3">
          <div className="flex items-start gap-2">
            <h3 className="font-bold text-gray-900 text-sm leading-snug flex-1">{scenario.title}</h3>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex-shrink-0 ${diff.color}`}>{diff.label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${catColor}`}>{scenario.category}</span>
            <span className="text-[11px] font-medium text-gray-500">{scenario.specialty}</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{scenario.description}</p>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Opening scene</p>
              <button
                type="button"
                onClick={() => setPreviewing(value => !value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 transition-all duration-200 hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {previewing ? "Reset Preview" : "Play Scene"}
              </button>
            </div>
            <p className={`text-xs leading-relaxed text-slate-600 ${previewing ? "typing-preview" : ""}`}>
              {previewing ? typingText || " " : "Preview the HCP's first beat before you enter the live simulation."}
            </p>
          </div>

          <div className={`scenario-extra-content space-y-3 ${isInteractiveExpanded ? "is-visible" : ""}`}>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">HCP</p>
              <p className="text-xs text-gray-800 font-medium">{scenario.stakeholder}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Objective</p>
              <div className="space-y-1.5">
                {objectiveLines.map((line, index) => (
                  <div key={index} className="flex gap-2 text-xs text-gray-700 leading-relaxed">
                    <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
            {challengePreview.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tactical focus</p>
                <div className="flex flex-wrap gap-1.5">
                  {challengePreview.map((c, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 rounded px-2 py-1">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 space-y-2">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-pressed={isInteractiveExpanded}
            className={`w-full py-2 rounded-xl border text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${isInteractiveExpanded ? "border-teal-300 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-700 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50"}`}
          >
            {isInteractiveExpanded ? "Collapse Details" : "Expand for Details"}
          </button>
          <button
            type="button"
            onClick={handleStartScenario}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
            style={{ background: "#1A334D" }}
          >
            Start Scenario
          </button>
        </div>
      </div>

      {playing && <RolePlayChat scenario={scenario} onClose={() => setPlaying(false)} />}
    </>
  );
}
