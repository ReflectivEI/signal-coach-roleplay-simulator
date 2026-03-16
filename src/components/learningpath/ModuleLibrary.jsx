/**
 * Expanded Signal Intelligence™ Module Library
 * 16 modules across all 8 capabilities + cross-capability mastery tracks
 */

import {
  MessageCircle, Users, FileText, ShieldAlert, CheckCircle2,
  Brain, BookOpen, Lightbulb, Target, TrendingUp, Zap,
  Eye, Ear, Heart, Compass, RefreshCw, Star
} from "lucide-react";

export const MODULE_LIBRARY = [
  // ── SIGNAL AWARENESS ─────────────────────────────────────────────────────────
  {
    id: "question_mastery",
    title: "Question Mastery",
    subtitle: "Craft signal-triggered questions",
    icon: MessageCircle,
    iconBg: "bg-blue-100 text-blue-600",
    capability: "question_quality",
    capability_label: "Signal Awareness",
    level: "Foundation",
    duration: "35 min",
    type: "Core Module",
    description: "Learn to ask questions that are directly tied to live conversational signals — not scripted templates.",
    keyBehaviors: [
      "Ask questions that reflect what is happening right now",
      "Ensure every question moves the conversation forward",
      "Avoid leading questions that embed conclusions",
      "Notice shifts in tone before forming your next question"
    ],
    exercises: [
      { id: "qm_e1", title: "Signal Audit: Record & Review", desc: "Record a call, then audit whether each question followed an observable signal from the HCP." },
      { id: "qm_e2", title: "The 'Why Now?' Drill", desc: "Before each question in a roleplay, pause and name the signal that prompted it. If you can't, don't ask it." },
      { id: "qm_e3", title: "Context-First Rewrite", desc: "Take 5 scripted questions from your current call guide and rewrite each as a signal-triggered version." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Question directly addresses a live signal and opens a productive path." },
      { score: 3, desc: "Question is relevant but not clearly tied to what just happened." },
      { score: 1, desc: "Question is scripted, off-topic, or ignores an obvious cue." }
    ],
    related: ["listening_responsiveness", "customer_engagement_cues"]
  },
  {
    id: "contextual_awareness",
    title: "Contextual Reading",
    subtitle: "Read the room before you speak",
    icon: Eye,
    iconBg: "bg-sky-100 text-sky-600",
    capability: "question_quality",
    capability_label: "Signal Awareness",
    level: "Advanced",
    duration: "25 min",
    type: "Skill Builder",
    description: "Develop the ability to pick up on environmental, verbal, and non-verbal cues that reveal HCP priorities before you even present.",
    keyBehaviors: [
      "Observe office environment for clues about HCP personality and priorities",
      "Note what the HCP mentions first — it signals priority",
      "Read pacing, tone, and posture shifts as real-time data",
      "Calibrate depth of engagement before asking anything"
    ],
    exercises: [
      { id: "cr_e1", title: "First 60 Seconds Audit", desc: "In your next 5 calls, write down every contextual signal you observed before speaking. Review for patterns." },
      { id: "cr_e2", title: "HCP Priority Map", desc: "Based on contextual signals from last week's calls, map each HCP's likely top priority. Validate on next visit." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Rep demonstrates clear pre-engagement signal reading that shapes their opening approach." },
      { score: 3, desc: "Rep acknowledges context but doesn't explicitly calibrate approach to it." },
      { score: 1, desc: "Rep ignores available context and opens with a scripted approach regardless." }
    ],
    related: ["question_quality", "listening_responsiveness"]
  },

  // ── SIGNAL INTERPRETATION ─────────────────────────────────────────────────────
  {
    id: "active_listening",
    title: "Active Listening Mastery",
    subtitle: "Hear what's behind the words",
    icon: Ear,
    iconBg: "bg-indigo-100 text-indigo-600",
    capability: "listening_responsiveness",
    capability_label: "Signal Interpretation",
    level: "Foundation",
    duration: "40 min",
    type: "Core Module",
    description: "Listening is not passive. Learn to decode what HCPs are actually communicating — including what they're not saying.",
    keyBehaviors: [
      "Pause for 1-2 seconds after the HCP finishes before responding",
      "Reflect back the emotional content, not just the factual content",
      "Distinguish between informational, attitudinal, and experiential signals",
      "Ask clarifying questions before providing information"
    ],
    exercises: [
      { id: "al_e1", title: "Echo & Expand", desc: "In your next roleplay, mirror the HCP's last statement before adding anything new. Practice 5 times." },
      { id: "al_e2", title: "Signal Type Classifier", desc: "Review 3 recent transcripts. Label each HCP statement as: informational, attitudinal, or experiential." },
      { id: "al_e3", title: "The Silence Drill", desc: "Practice holding silence for 3 seconds after the HCP speaks before responding. Record the impact." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Rep clearly demonstrates interpretation by referencing HCP's actual words and adjusting accordingly." },
      { score: 3, desc: "Rep listens but responds generically rather than to the specific signal." },
      { score: 1, desc: "Rep talks over or ignores HCP signals — responds from script not from conversation." }
    ],
    related: ["question_quality", "adaptability"]
  },
  {
    id: "stakeholder_mapping",
    title: "Stakeholder Mapping",
    subtitle: "Identify HCP type and influence driver",
    icon: Users,
    iconBg: "bg-teal-100 text-teal-600",
    capability: "listening_responsiveness",
    capability_label: "Signal Interpretation",
    level: "Intermediate",
    duration: "45 min",
    type: "Core Module",
    description: "Understand the full healthcare decision ecosystem and calibrate your approach based on HCP category and influence driver.",
    keyBehaviors: [
      "Identify whether HCP is KOL, Prescriber, Influencer, or Low-Engagement",
      "Recognize Evidence-Based, Patient-Centered, Risk-Averse, or Guideline-Anchored drivers",
      "Read engagement cues: verbal participation, responsiveness, momentum",
      "Amplify engagement signals when they appear"
    ],
    exercises: [
      { id: "sm_e1", title: "Influence Driver Pre-Call Quiz", desc: "Before each of your next 5 calls, predict the HCP's influence driver. Validate your prediction during the visit." },
      { id: "sm_e2", title: "Decision-Unit Mapping", desc: "Map the full decision-making unit for one territory account: who prescribes, who influences, who blocks?" }
    ],
    scoringAnchors: [
      { score: 5, desc: "Rep identifies stakeholder type and influence driver and visibly adjusts approach in real time." },
      { score: 3, desc: "Rep engages professionally but applies one-size-fits-all approach." },
      { score: 1, desc: "Rep ignores stakeholder signals or misidentifies type and applies wrong approach." }
    ],
    related: ["listening_responsiveness", "customer_engagement_cues", "adaptability"]
  },

  // ── VALUE CONNECTION ──────────────────────────────────────────────────────────
  {
    id: "clinical_evidence",
    title: "Clinical Evidence Framing",
    subtitle: "Make data meaningful to this HCP",
    icon: FileText,
    iconBg: "bg-cyan-100 text-cyan-600",
    capability: "making_it_matter",
    capability_label: "Value Connection",
    level: "Foundation",
    duration: "40 min",
    type: "Core Module",
    description: "Present clinical data in a way that is directly relevant to what this customer cares about — not just reciting study results.",
    keyBehaviors: [
      "Connect clinical data to specific priorities the HCP already expressed",
      "Go beyond data points: explain why it matters for this patient population",
      "Match evidence depth to stakeholder type",
      "Never present value before establishing what the HCP prioritizes"
    ],
    exercises: [
      { id: "ce_e1", title: "'So What?' Bridge", desc: "After every efficacy claim you make in a roleplay, practice adding 'So what for your patients?' — then answer it." },
      { id: "ce_e2", title: "Three HCP Profile Reframe", desc: "Take one clinical data point. Reframe it into an outcome statement for 3 different HCP profiles." },
      { id: "ce_e3", title: "Value-First Sequencing Drill", desc: "Practice always asking what matters to the HCP before introducing any evidence. Review 5 past calls for violations." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Clinical data is tied explicitly to a priority the customer already stated, 'why it matters' is clear." },
      { score: 3, desc: "Data is accurate and relevant but not personalized to this customer's expressed needs." },
      { score: 1, desc: "Data is delivered without connection to any customer priority — feels like a monologue." }
    ],
    related: ["making_it_matter", "question_quality", "listening_responsiveness"]
  },
  {
    id: "outcome_translation",
    title: "Outcome Translation",
    subtitle: "Bridge data to patient impact",
    icon: Heart,
    iconBg: "bg-rose-100 text-rose-600",
    capability: "making_it_matter",
    capability_label: "Value Connection",
    level: "Advanced",
    duration: "30 min",
    type: "Skill Builder",
    description: "Translate clinical statistics into language that resonates with how HCPs think about their patients' lived experience.",
    keyBehaviors: [
      "Convert NNT, hazard ratios, and relative risk into real-world patient language",
      "Use patient archetypes the HCP has already described to anchor your translation",
      "Avoid clinical jargon when patient-level outcomes are more persuasive",
      "Always connect outcome back to the HCP's stated priority"
    ],
    exercises: [
      { id: "ot_e1", title: "Jargon-to-Patient Translator", desc: "Take 3 stats from your current product deck. Rewrite each in patient-impact language that a GP would use to explain it to a patient." },
      { id: "ot_e2", title: "HCP Mirror Drill", desc: "Use the exact words an HCP used to describe their patients as the frame for your outcome statement." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Outcome is framed in patient language using the HCP's own words and priorities as anchors." },
      { score: 3, desc: "Outcome is mentioned but stays in clinical-stat language without patient-level translation." },
      { score: 1, desc: "Outcome is a data dump with no patient or practice relevance framing." }
    ],
    related: ["making_it_matter", "commitment_gaining"]
  },

  // ── CUSTOMER ENGAGEMENT ───────────────────────────────────────────────────────
  {
    id: "engagement_monitoring",
    title: "Engagement Monitoring",
    subtitle: "Read and respond to engagement drops",
    icon: TrendingUp,
    iconBg: "bg-amber-100 text-amber-600",
    capability: "customer_engagement_cues",
    capability_label: "Customer Engagement",
    level: "Foundation",
    duration: "30 min",
    type: "Core Module",
    description: "Learn to monitor HCP engagement levels in real time and adapt before disengagement becomes irreversible.",
    keyBehaviors: [
      "Track verbal participation rate: is the HCP contributing less?",
      "Notice momentum continuity breaks: abrupt topic changes, shorter responses",
      "Amplify engagement signals when the HCP is open",
      "Pivot immediately when disengagement signals appear — don't push through"
    ],
    exercises: [
      { id: "em_e1", title: "Engagement Heatmap", desc: "Review a transcript and mark each HCP turn as: 'high engagement', 'neutral', or 'dropping'. Identify when the rep first noticed and responded." },
      { id: "em_e2", title: "Early Pivot Drill", desc: "In your next roleplay, the moment you notice an engagement dip, practice pivoting to a direct question about the HCP's concern." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Rep detects and responds to engagement shifts in real time — amplifies when HCP is open, pivots when dropping." },
      { score: 3, desc: "Rep notices engagement change but response is delayed or generic." },
      { score: 1, desc: "Rep continues same approach regardless of engagement level — misses clear signals." }
    ],
    related: ["customer_engagement_cues", "adaptability", "listening_responsiveness"]
  },
  {
    id: "participation_amplification",
    title: "Participation Amplification",
    subtitle: "Turn HCP input into momentum",
    icon: Star,
    iconBg: "bg-yellow-100 text-yellow-600",
    capability: "customer_engagement_cues",
    capability_label: "Customer Engagement",
    level: "Intermediate",
    duration: "25 min",
    type: "Skill Builder",
    description: "When an HCP is engaged, your job is to amplify — ask deeper, acknowledge louder, and lean into their momentum.",
    keyBehaviors: [
      "When HCP volunteers information, ask a follow-up before adding anything",
      "Explicitly acknowledge HCP contributions before building on them",
      "Use the HCP's language back in your next statement",
      "Resist the urge to redirect to your agenda when HCP is engaged with theirs"
    ],
    exercises: [
      { id: "pa_e1", title: "HCP-Led Roleplay", desc: "In a roleplay, practice letting the HCP set the direction for 3 turns before you introduce any new topic." },
      { id: "pa_e2", title: "Acknowledgment-First Protocol", desc: "Practice beginning every response to a volunteered HCP statement with explicit acknowledgment before adding content." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Rep explicitly builds on HCP's contribution and deepens the thread before advancing their own agenda." },
      { score: 3, desc: "Rep acknowledges HCP input but transitions quickly to own agenda." },
      { score: 1, desc: "Rep ignores HCP contribution and redirects to their agenda immediately." }
    ],
    related: ["customer_engagement_cues", "listening_responsiveness", "commitment_gaining"]
  },

  // ── OBJECTION NAVIGATION ──────────────────────────────────────────────────────
  {
    id: "objection_handling",
    title: "Objection Navigation",
    subtitle: "Acknowledge, engage, redirect",
    icon: ShieldAlert,
    iconBg: "bg-orange-100 text-orange-600",
    capability: "objection_handling",
    capability_label: "Objection Navigation",
    level: "Foundation",
    duration: "50 min",
    type: "Core Module",
    description: "Respond to resistance in a way that keeps the conversation productive — acknowledge, engage the substance, then redirect.",
    keyBehaviors: [
      "Remain open and composed when resistance appears — never become defensive",
      "Acknowledge before advancing — always confirm the concern was heard",
      "Engage the objection's substance directly — don't deflect or minimize",
      "Distinguish informational, attitudinal, and experiential objection types"
    ],
    exercises: [
      { id: "oh_e1", title: "Acknowledge-Engage-Redirect Drill", desc: "Role-play with a colleague who raises 3 different objection types. Practice the A-E-R sequence each time." },
      { id: "oh_e2", title: "Objection Type Audit", desc: "Review your last 5 objection moments. Classify each as informational, attitudinal, or experiential. Did your response match the type?" },
      { id: "oh_e3", title: "Non-Defensive Language Bank", desc: "Write 10 opening phrases for acknowledging concern that are non-defensive and non-dismissive. Practice until fluent." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Rep acknowledges concern explicitly, engages substance, redirects productively without defensiveness." },
      { score: 3, desc: "Rep acknowledges but response is generic or doesn't fully address the content." },
      { score: 1, desc: "Rep skips concern, becomes defensive, or pivots immediately without acknowledgment." }
    ],
    related: ["objection_handling", "listening_responsiveness", "adaptability"]
  },
  {
    id: "resistance_types",
    title: "Resistance Type Diagnosis",
    subtitle: "Identify what kind of no you're hearing",
    icon: Compass,
    iconBg: "bg-red-100 text-red-600",
    capability: "objection_handling",
    capability_label: "Objection Navigation",
    level: "Advanced",
    duration: "30 min",
    type: "Skill Builder",
    description: "Not all resistance is the same. Learn to diagnose whether resistance is informational, attitudinal, or experiential — and respond differently to each.",
    keyBehaviors: [
      "Informational resistance: needs clarification or data — provide and confirm",
      "Attitudinal resistance: needs empathy first, then exploration",
      "Experiential resistance: needs alternative framing, not more data",
      "Ask before assuming which type you're facing"
    ],
    exercises: [
      { id: "rt_e1", title: "Resistance Classifier Roleplay", desc: "Run 3 roleplays where the HCP presents each resistance type. Practice diagnosing correctly in the first 2 sentences." },
      { id: "rt_e2", title: "Response-Type Matching", desc: "For each of 10 HCP statements, write the correct response type (clarify/empathize/reframe) before writing any actual language." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Rep correctly diagnoses resistance type and responds with matched strategy." },
      { score: 3, desc: "Rep uses a single response approach for all resistance types." },
      { score: 1, desc: "Rep misdiagnoses resistance type and applies counterproductive strategy." }
    ],
    related: ["objection_handling", "listening_responsiveness", "adaptability"]
  },

  // ── CONVERSATION MANAGEMENT ───────────────────────────────────────────────────
  {
    id: "conversation_structure",
    title: "Conversation Structure & Flow",
    subtitle: "Control pacing and direction",
    icon: Compass,
    iconBg: "bg-violet-100 text-violet-600",
    capability: "conversation_control",
    capability_label: "Conversation Management",
    level: "Foundation",
    duration: "35 min",
    type: "Core Module",
    description: "Maintain directional clarity while staying responsive. Learn to structure conversations that always move toward a productive outcome.",
    keyBehaviors: [
      "Establish a clear purpose at the opening",
      "Use single-ask discipline — one question or request per turn",
      "Acknowledge and reorient when the conversation drifts",
      "Control pacing by matching response length to HCP state"
    ],
    exercises: [
      { id: "cs_e1", title: "Single-Ask Discipline", desc: "In your next 5 roleplays, restrict yourself to one question or ask per turn. Debrief after each." },
      { id: "cs_e2", title: "Opening Purpose Statement", desc: "Practice stating a clear call purpose in the first 30 seconds across 5 different HCP types." },
      { id: "cs_e3", title: "Pacing Mirror Drill", desc: "Match your response length to the HCP's previous message length. Practice for 3 full roleplays." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Conversation has clear structure, single asks, appropriate pacing matched to HCP state." },
      { score: 3, desc: "Conversation moves forward but structure is loose with occasional multi-asks or pacing mismatches." },
      { score: 1, desc: "Conversation is disorganized, multi-asks everywhere, pacing not matched to HCP state." }
    ],
    related: ["conversation_control", "adaptability", "question_quality"]
  },
  {
    id: "time_pressure",
    title: "Time-Pressured Conversations",
    subtitle: "Deliver maximum value in minimum time",
    icon: Zap,
    iconBg: "bg-yellow-100 text-yellow-700",
    capability: "conversation_control",
    capability_label: "Conversation Management",
    level: "Advanced",
    duration: "20 min",
    type: "Skill Builder",
    description: "When time is the constraint, structure is everything. Learn to be brief, impactful, and still generate a meaningful next step.",
    keyBehaviors: [
      "Acknowledge the time constraint explicitly within the first 15 seconds",
      "Reduce to one key message and one ask",
      "Never introduce secondary topics when time is limited",
      "Always offer to follow up — a deferred conversation is not a lost one"
    ],
    exercises: [
      { id: "tp_e1", title: "90-Second Drill", desc: "Practice a complete HCP interaction (open, message, ask, close) in under 90 seconds. Record and review." },
      { id: "tp_e2", title: "Time-Signal Response Library", desc: "Write 5 different ways to verbally acknowledge time pressure within the first 15 seconds of a call." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Rep acknowledges time constraint, delivers single focused message and ask, offers clean next step." },
      { score: 3, desc: "Rep recognizes time pressure but still delivers multiple messages or asks." },
      { score: 1, desc: "Rep ignores time pressure signals and continues with full-length interaction." }
    ],
    related: ["conversation_control", "adaptability", "commitment_gaining"]
  },

  // ── ADAPTIVE RESPONSE ─────────────────────────────────────────────────────────
  {
    id: "adaptability",
    title: "Real-Time Adaptation",
    subtitle: "Shift approach when the situation shifts",
    icon: RefreshCw,
    iconBg: "bg-emerald-100 text-emerald-600",
    capability: "adaptability",
    capability_label: "Adaptive Response",
    level: "Foundation",
    duration: "45 min",
    type: "Core Module",
    description: "Every customer signal is an invitation to adapt. Learn to recalibrate approach in real time based on what is actually happening.",
    keyBehaviors: [
      "When HCP state changes, explicitly acknowledge it before responding",
      "Every adaptation should be traceable to an observable HCP signal",
      "Never pivot mid-sentence — observe, pause, then adapt deliberately",
      "Adapting is not random change — it is better-matched behavior"
    ],
    exercises: [
      { id: "ar_e1", title: "Signal-to-Adaptation Mapping", desc: "After a roleplay, list every point where you adapted. For each, identify the exact signal that triggered the change." },
      { id: "ar_e2", title: "State-Change Protocol", desc: "Practice a 3-step sequence: Name the shift (internally), Acknowledge (verbally if appropriate), Adapt (change approach)." },
      { id: "ar_e3", title: "Escalation Tracker", desc: "In 5 roleplays, track every time HCP state escalated. Did you notice? Did you adapt? Review after each." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Every approach change is traceable to an observable HCP signal and is clearly better-matched." },
      { score: 3, desc: "Rep adapts sometimes but inconsistently — misses key transition moments." },
      { score: 1, desc: "Rep applies fixed approach regardless of HCP state changes — no observable adaptation." }
    ],
    related: ["adaptability", "listening_responsiveness", "conversation_control"]
  },
  {
    id: "style_matching",
    title: "Communication Style Matching",
    subtitle: "Mirror HCP communication preferences",
    icon: Users,
    iconBg: "bg-purple-100 text-purple-600",
    capability: "adaptability",
    capability_label: "Adaptive Response",
    level: "Intermediate",
    duration: "30 min",
    type: "Skill Builder",
    description: "Adapt your communication style — not just your content — to match the HCP's preferred mode of engagement.",
    keyBehaviors: [
      "Mirror the HCP's vocabulary level and technicality",
      "Match pace: slower when HCP is deliberate, crisper when HCP is direct",
      "Adjust detail level: KOLs want depth, busy GPs want bottom line first",
      "Read DISC-style signals: direct, expressive, steady, analytical"
    ],
    exercises: [
      { id: "sm2_e1", title: "DISC Style Roleplay", desc: "Run 4 roleplays each with a different DISC-style HCP. Practice adapting your communication style to each." },
      { id: "sm2_e2", title: "Vocabulary Mirror", desc: "In your next 3 calls, deliberately use the HCP's own vocabulary back in your responses. Observe the effect." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Rep's communication style is clearly matched to HCP's observable preferences across vocabulary, pace, and depth." },
      { score: 3, desc: "Rep uses a consistent style that doesn't cause friction but isn't explicitly matched to HCP." },
      { score: 1, desc: "Rep's style clashes visibly with HCP's preferences — too technical, too casual, too fast, etc." }
    ],
    related: ["adaptability", "customer_engagement_cues", "listening_responsiveness"]
  },

  // ── COMMITMENT GENERATION ─────────────────────────────────────────────────────
  {
    id: "closing_techniques",
    title: "Commitment Generation",
    subtitle: "Create clear, voluntary next steps",
    icon: CheckCircle2,
    iconBg: "bg-green-100 text-green-600",
    capability: "commitment_gaining",
    capability_label: "Commitment Generation",
    level: "Foundation",
    duration: "40 min",
    type: "Core Module",
    description: "Guide conversations toward specific, voluntary next steps owned by the customer — not pressure, but clarity.",
    keyBehaviors: [
      "Ensure next step is specific and actionable, not vague",
      "The customer should voluntarily own the next step",
      "Recognize readiness signals and align immediately when they appear",
      "Never close before engagement and value are established"
    ],
    exercises: [
      { id: "ct_e1", title: "Natural Next Step Summary", desc: "End every roleplay by summarizing the conversation into a 'natural next step'. Practice making it feel inevitable, not pushed." },
      { id: "ct_e2", title: "Readiness Signal Hunting", desc: "Review 3 past transcripts. Find the readiness signal in each. Did the rep take the window? If not, when was it?" },
      { id: "ct_e3", title: "Specificity Ladder", desc: "Take a vague next step ('I'll consider it') and practice escalating it through 3 levels of specificity with the HCP." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Clear, specific next step is established and customer expresses voluntary ownership." },
      { score: 3, desc: "Next step is mentioned but lacks specificity or customer confirmation." },
      { score: 1, desc: "No next step established, or close attempted before readiness was present." }
    ],
    related: ["commitment_gaining", "conversation_control", "listening_responsiveness"]
  },

  // ── BEHAVIORAL MASTERY ────────────────────────────────────────────────────────
  {
    id: "behavioral_mastery",
    title: "Signal Intelligence™ Integration",
    subtitle: "All 8 capabilities working as one",
    icon: Brain,
    iconBg: "bg-purple-100 text-purple-600",
    capability: "all",
    capability_label: "All Capabilities",
    level: "Master",
    duration: "60 min",
    type: "Mastery Track",
    description: "The integration of all Signal Intelligence capabilities into a coherent, adaptive, observable behavioral repertoire.",
    keyBehaviors: [
      "Every rep action is traceable to an observable customer signal",
      "Adjust conversation direction in real time without losing focus",
      "Recognize capability gaps mid-conversation and compensate",
      "All 8 capabilities activated in a single fluid interaction"
    ],
    exercises: [
      { id: "bm_e1", title: "Full Annotated Roleplay", desc: "Complete a roleplay with annotation enabled. Review every highlighted moment: 'What signal did I respond to?'" },
      { id: "bm_e2", title: "Capability-of-the-Week Focus", desc: "Each week, select one capability for deliberate practice in every HCP interaction." },
      { id: "bm_e3", title: "Session Pattern Analysis", desc: "After 5+ roleplays, identify which HCP state you consistently struggle with. Design a targeted practice regimen." }
    ],
    scoringAnchors: [
      { score: 5, desc: "Consistent, observable signal-reading across all capabilities — actions traceable to customer cues throughout." },
      { score: 3, desc: "Competent across most capabilities but gaps in one or two, especially under pressure." },
      { score: 1, desc: "Fixed script regardless of customer signals — no observable adaptation across the conversation." }
    ],
    related: ["question_quality", "listening_responsiveness", "making_it_matter", "customer_engagement_cues", "objection_handling", "conversation_control", "adaptability", "commitment_gaining"] // All 8 capabilities from SOT
  }
];

export const CAPABILITY_META = {
  question_quality: { label: "Signal Awareness", color: "#14b8a6", urgencyThreshold: 3.5 },
  listening_responsiveness: { label: "Signal Interpretation", color: "#0284c7", urgencyThreshold: 3.5 },
  making_it_matter: { label: "Value Connection", color: "#8b5cf6", urgencyThreshold: 3.5 },
  customer_engagement_cues: { label: "Customer Engagement", color: "#f59e0b", urgencyThreshold: 3.5 },
  objection_handling: { label: "Objection Navigation", color: "#f97316", urgencyThreshold: 3.2 },
  conversation_control: { label: "Conversation Management", color: "#1A334D", urgencyThreshold: 3.5 },
  adaptability: { label: "Adaptive Response", color: "#06b6d4", urgencyThreshold: 3.5 },
  commitment_gaining: { label: "Commitment Generation", color: "#10b981", urgencyThreshold: 3.2 },
};

export function getModulesForCapability(capabilityId) {
  return MODULE_LIBRARY.filter(m => m.capability === capabilityId || m.capability === "all");
}

export function getUrgency(avgScore) {
  if (avgScore < 2) return "critical";
  if (avgScore < 2.8) return "high";
  if (avgScore < 3.5) return "medium";
  return "low";
}