/**
 * Signal Intelligence™ — Single Source of Truth
 * Capability definitions, measurements, scoring anchors, and governance rules.
 * 
 * All IDs, labels, sublabels, and coaching diagnostics are canonical.
 * Import from here — never hardcode capability names elsewhere.
 */

export const SIGNAL_CAPABILITIES = [
  {
    id: "question_quality",
    label: "Signal Awareness",
    measurement: "Question Quality",
    canonicalQuestion: "Did the rep notice what mattered?",
    definition: "Asking questions that are timely, relevant to the customer's context, and move the conversation forward.",
    color: "teal",
    coreMetrics: [
      {
        id: "contextual_relevance",
        name: "Contextual Relevance",
        question: "Does the question reflect what is happening in the conversation right now?",
        anchors: [
          { score: 1, desc: "Question is disconnected from the customer's prior statements or context." },
          { score: 2, desc: "Question loosely relates to the topic but does not clearly build on customer input." },
          { score: 3, desc: "Question reflects the customer's stated priorities or recent comments." },
          { score: 4, desc: "Question is well-timed and clearly responds to subtle cues or shifts in context." },
          { score: 5, desc: "Question precisely reflects what matters most in the moment and demonstrates strong situational awareness." },
        ],
      },
      {
        id: "forward_value",
        name: "Forward Value",
        question: "Does the question move the conversation somewhere useful?",
        anchors: [
          { score: 1, desc: "Question does not advance the conversation or leads to a dead end." },
          { score: 2, desc: "Question adds limited value; response does not meaningfully progress discussion." },
          { score: 3, desc: "Question advances understanding or clarifies next steps." },
          { score: 4, desc: "Question opens productive dialogue and builds momentum." },
          { score: 5, desc: "Question significantly deepens the conversation and creates clear forward movement." },
        ],
      },
    ],
    optionalMetrics: [],
    coaching: [
      "Low Contextual Relevance → coach noticing and timing",
      "Low Forward Value → coach purpose and question design",
      "Both high → reinforce judgment, not technique",
    ],
    canonical: "Question Quality is high when questions fit the moment and move the conversation forward.",
  },
  {
    id: "listening_responsiveness",
    label: "Signal Interpretation",
    measurement: "Listening & Responsiveness",
    canonicalQuestion: "Did the rep understand and respond correctly?",
    definition: "Accurately understanding customer input and responding in a way that clearly reflects that understanding.",
    color: "blue",
    coreMetrics: [
      {
        id: "accuracy_of_interpretation",
        name: "Accuracy of Interpretation",
        question: "Did the rep correctly understand what the customer communicated?",
        anchors: [
          { score: 1, desc: "Rep misinterprets or overlooks key customer input." },
          { score: 2, desc: "Rep captures some elements but misses or distorts important meaning." },
          { score: 3, desc: "Rep accurately understands and reflects the customer's stated input." },
          { score: 4, desc: "Rep accurately interprets both explicit input and implied context." },
          { score: 5, desc: "Rep demonstrates precise understanding, including subtle nuance or priority shifts." },
        ],
      },
      {
        id: "responsiveness_of_action",
        name: "Responsiveness of Action",
        question: "Did the rep's response align with what the customer shared?",
        anchors: [
          { score: 1, desc: "Rep response is unrelated or ignores customer input." },
          { score: 2, desc: "Rep response is partially aligned but relies on generic or pre-set content." },
          { score: 3, desc: "Rep responds appropriately and addresses the customer's input." },
          { score: 4, desc: "Rep adapts message or direction clearly based on customer input." },
          { score: 5, desc: "Rep responds fluidly and strategically, advancing the conversation based on customer input." },
        ],
      },
    ],
    optionalMetrics: [
      { id: "confirmation_of_understanding", name: "Confirmation of Understanding", question: "Did the rep confirm their understanding before responding?" },
    ],
    coaching: [
      "Low Accuracy of Interpretation → coach listening precision and confirmation",
      "Low Responsiveness of Action → coach adaptability and response alignment",
      "Both high → reinforce judgment and situational fluency",
    ],
    canonical: "Listening & Responsiveness is strong when the rep understands the customer correctly and responds in a way that clearly reflects that understanding.",
  },
  {
    id: "making_it_matter",
    label: "Value Connection",
    measurement: "Value Framing",
    canonicalQuestion: "Did the rep make it meaningful to the customer?",
    definition: "Connecting information to customer-specific priorities and clearly explaining why it matters to them.",
    color: "purple",
    coreMetrics: [
      {
        id: "customer_relevance_alignment",
        name: "Customer Relevance Alignment",
        question: "Does the value connect to what the customer cares about?",
        anchors: [
          { score: 1, desc: "Value presented is generic or unrelated to customer priorities." },
          { score: 2, desc: "Value loosely relates to customer context but remains mostly generic." },
          { score: 3, desc: "Value aligns with customer's stated priorities or needs." },
          { score: 4, desc: "Value clearly reflects customer-specific goals or challenges." },
          { score: 5, desc: "Value is precisely tailored to what matters most to the customer in that moment." },
        ],
      },
      {
        id: "outcome_translation",
        name: "Outcome Translation",
        question: "Does the rep clearly explain why the information matters?",
        anchors: [
          { score: 1, desc: "Information is presented without explanation of impact." },
          { score: 2, desc: "Limited or vague explanation of why the information matters." },
          { score: 3, desc: "Clear explanation of how the information affects the customer." },
          { score: 4, desc: "Strong linkage between information and meaningful customer outcomes." },
          { score: 5, desc: "Compelling, situation-specific translation that makes impact immediately clear." },
        ],
      },
    ],
    optionalMetrics: [
      { id: "decision_orientation", name: "Decision Orientation", question: "Does the value framing help the customer move toward a decision or next step?" },
    ],
    coaching: [
      "Low Customer Relevance Alignment → coach discovery and context usage",
      "Low Outcome Translation → coach articulation of impact and 'so what'",
      "Both high → reinforce strategic value framing",
    ],
    canonical: "Value Framing is strong when relevance is clear and impact is unmistakable.",
  },
  {
    id: "customer_engagement_cues_cues",
    label: "Customer Engagement Monitoring",
    measurement: "Customer Engagement Cues",
    canonicalQuestion: "Did the rep notice changes in momentum and participation?",
    definition: "Noticing changes in customer participation and conversational momentum and adjusting accordingly.",
    color: "cyan",
    coreMetrics: [
      {
        id: "customer_verbal_participation",
        name: "Customer Verbal Participation Ratio",
        question: "Is the customer actively contributing vs passively responding?",
        anchors: [
          { score: 1, desc: "Customer responses are minimal (yes/no, short acknowledgments); rep dominates conversation." },
          { score: 2, desc: "Customer speaks occasionally but mostly reacts; limited elaboration or initiative." },
          { score: 3, desc: "Customer contributes regularly with complete responses; balanced participation overall." },
          { score: 4, desc: "Customer frequently elaborates, asks questions, or adds perspective; engagement is clearly active." },
          { score: 5, desc: "Customer consistently drives parts of the conversation; high energy, curiosity, and initiative throughout." },
        ],
      },
      {
        id: "responsiveness_to_cues",
        name: "Responsiveness to Customer Cues",
        question: "Whether the rep notices and responds to shifts in engagement.",
        anchors: [
          { score: 1, desc: "Engagement cues are missed or ignored; rep continues unchanged despite clear signals." },
          { score: 2, desc: "Some cues noticed, but responses are delayed, generic, or misaligned." },
          { score: 3, desc: "Rep acknowledges clear cues and adjusts appropriately when they are obvious." },
          { score: 4, desc: "Rep responds promptly to subtle cues and adjusts pacing, depth, or direction effectively." },
          { score: 5, desc: "Rep anticipates engagement shifts and adapts fluidly, often before disengagement occurs." },
        ],
      },
      {
        id: "momentum_continuity",
        name: "Momentum Continuity",
        question: "The ability to maintain conversational flow without stalls or forced transitions.",
        anchors: [
          { score: 1, desc: "Conversation frequently stalls; awkward pauses or abrupt topic shifts disrupt flow." },
          { score: 2, desc: "Momentum is inconsistent; several transitions feel forced or disjointed." },
          { score: 3, desc: "Conversation generally flows; occasional pauses but momentum is maintained overall." },
          { score: 4, desc: "Smooth progression between topics; momentum feels natural and sustained." },
          { score: 5, desc: "Conversation builds naturally with strong continuity; transitions deepen engagement rather than interrupt it." },
        ],
      },
      {
        id: "signal_amplification",
        name: "Customer Signal Amplification",
        question: "Whether the rep strengthens engagement by building on customer input.",
        anchors: [
          { score: 1, desc: "Customer input is ignored or redirected without acknowledgment." },
          { score: 2, desc: "Rep acknowledges input but does not build on it meaningfully." },
          { score: 3, desc: "Rep follows up on customer input with relevant questions or reflections." },
          { score: 4, desc: "Rep consistently deepens engagement by expanding on customer signals." },
          { score: 5, desc: "Rep actively amplifies engagement, leading to richer dialogue and increased customer participation." },
        ],
      },
    ],
    optionalMetrics: [],
    coaching: [
      "Score 1–2 → missed signals, inconsistent awareness — coaching opportunity",
      "Score 3 → functional and acceptable",
      "Score 4 → strong, repeatable skill",
      "Score 5 → advanced, situational mastery",
    ],
    canonical: "Customer Engagement Monitoring is strong when the rep notices and responds to every shift in participation and momentum.",
  },
  {
    id: "objection_handling",
    label: "Objection Navigation",
    measurement: "Objection Handling",
    canonicalQuestion: "Did the rep respond constructively to resistance?",
    definition: "Responding to resistance with composure and engaging it in a way that sustains productive dialogue.",
    color: "orange",
    coreMetrics: [
      {
        id: "non_defensive_response",
        name: "Non-Defensive Response",
        question: "Does the rep remain open and composed when resistance appears?",
        anchors: [
          { score: 1, desc: "Responds defensively, argues, or dismisses the objection." },
          { score: 2, desc: "Shows mild defensiveness or discomfort; acknowledgment feels forced." },
          { score: 3, desc: "Remains calm and acknowledges the objection appropriately." },
          { score: 4, desc: "Responds with openness and curiosity, sustaining a constructive tone." },
          { score: 5, desc: "Creates psychological safety and openness around the objection." },
        ],
      },
      {
        id: "constructive_engagement",
        name: "Constructive Engagement",
        question: "Does the rep engage the objection in a productive way?",
        anchors: [
          { score: 1, desc: "Objection is ignored, deflected, or shut down." },
          { score: 2, desc: "Objection is acknowledged but not meaningfully explored." },
          { score: 3, desc: "Objection is addressed with relevant clarification or response." },
          { score: 4, desc: "Objection is explored and reframed to advance dialogue." },
          { score: 5, desc: "Objection is skillfully navigated, strengthening understanding and momentum." },
        ],
      },
    ],
    optionalMetrics: [
      {
        id: "resolution_clarity",
        name: "Resolution Clarity",
        question: "Is the objection left in a clearer, more workable state?",
        anchors: [
          { score: 1, desc: "Objection remains unresolved and conversation regresses." },
          { score: 2, desc: "Objection is acknowledged but left unclear or open-ended." },
          { score: 3, desc: "Objection is clarified or partially contained." },
          { score: 4, desc: "Objection is clearly reframed or positioned for next steps." },
          { score: 5, desc: "Objection is meaningfully resolved or cleanly staged for follow-up." },
        ],
      },
    ],
    coaching: [
      "Low Non-Defensive Response → coach emotional regulation and stance",
      "Low Constructive Engagement → coach exploration and relevance",
      "Low Resolution Clarity → coach summarization and containment",
    ],
    canonical: "Objection Navigation is strong when resistance is met with composure, engaged with curiosity, and left clearer than it began.",
  },
  {
    id: "conversation_control",
    label: "Conversation Management",
    measurement: "Conversation Control & Structure",
    canonicalQuestion: "Did the rep guide the conversation with clarity and purpose?",
    definition: "Providing clear direction and structure while guiding the conversation toward purposeful progress.",
    color: "indigo",
    coreMetrics: [
      {
        id: "directional_clarity",
        name: "Directional Clarity",
        question: "Does the rep make the direction of the conversation clear?",
        anchors: [
          { score: 1, desc: "Conversation lacks clear direction; topics feel disconnected." },
          { score: 2, desc: "Direction is implied but inconsistent or unclear." },
          { score: 3, desc: "Rep provides a generally clear sense of purpose and flow." },
          { score: 4, desc: "Rep clearly frames direction and transitions smoothly." },
          { score: 5, desc: "Rep consistently establishes and maintains clear conversational direction." },
        ],
      },
      {
        id: "adaptive_steering",
        name: "Adaptive Steering",
        question: "Does the rep adjust structure appropriately as the conversation unfolds?",
        anchors: [
          { score: 1, desc: "Rep ignores customer input and rigidly follows a set path." },
          { score: 2, desc: "Rep makes limited adjustments but structure often feels forced." },
          { score: 3, desc: "Rep adapts direction appropriately when new input arises." },
          { score: 4, desc: "Rep flexes structure fluidly while maintaining coherence." },
          { score: 5, desc: "Rep seamlessly balances structure and adaptability throughout the conversation." },
        ],
      },
    ],
    optionalMetrics: [
      {
        id: "purposeful_closure",
        name: "Purposeful Closure",
        question: "Is the conversation brought to a clear and intentional close?",
        anchors: [
          { score: 1, desc: "Conversation ends abruptly with no summary or next steps." },
          { score: 2, desc: "Closure is attempted but unclear or incomplete." },
          { score: 3, desc: "Rep summarizes or clarifies next steps adequately." },
          { score: 4, desc: "Rep clearly aligns on outcomes or next steps." },
          { score: 5, desc: "Rep brings the conversation to a confident, shared conclusion that supports forward action." },
        ],
      },
    ],
    coaching: [
      "Low Directional Clarity → coach framing and signaling intent",
      "Low Adaptive Steering → coach flexibility and integration of input",
      "Low Purposeful Closure → coach summarization and next-step clarity",
    ],
    canonical: "Conversation Management is strong when direction is clear, structure is adaptive, and purpose is maintained throughout the interaction.",
  },
  {
    id: "adaptability",
    label: "Adaptive Response",
    measurement: "Adaptability",
    canonicalQuestion: "Did the rep adjust appropriately in real time?",
    definition: "Making timely, appropriate adjustments to approach based on what is happening in the interaction.",
    color: "pink",
    coreMetrics: [
      {
        id: "situational_responsiveness",
        name: "Situational Responsiveness",
        question: "Does the rep recognize and respond to changes in the moment?",
        anchors: [
          { score: 1, desc: "Rep does not adjust despite clear changes in the interaction." },
          { score: 2, desc: "Rep notices change but responds slowly or inconsistently." },
          { score: 3, desc: "Rep adjusts appropriately to clear changes in the situation." },
          { score: 4, desc: "Rep responds promptly to subtle shifts in context or cues." },
          { score: 5, desc: "Rep anticipates changes and adapts fluidly as the interaction unfolds." },
        ],
      },
      {
        id: "approach_adjustment_quality",
        name: "Approach Adjustment Quality",
        question: "Is the adjustment appropriate and effective?",
        anchors: [
          { score: 1, desc: "Adjustment is inappropriate or disruptive." },
          { score: 2, desc: "Adjustment partially fits but creates confusion or inefficiency." },
          { score: 3, desc: "Adjustment fits the situation and supports the conversation." },
          { score: 4, desc: "Adjustment clearly improves relevance or momentum." },
          { score: 5, desc: "Adjustment is highly effective and strengthens overall interaction quality." },
        ],
      },
    ],
    optionalMetrics: [
      {
        id: "continuity_preservation",
        name: "Continuity Preservation",
        question: "Does the adaptation maintain coherence and purpose?",
        anchors: [
          { score: 1, desc: "Adaptation fragments the conversation or causes loss of focus." },
          { score: 2, desc: "Adaptation disrupts flow or purpose." },
          { score: 3, desc: "Adaptation maintains basic continuity." },
          { score: 4, desc: "Adaptation preserves clarity and conversational coherence." },
          { score: 5, desc: "Adaptation feels seamless and reinforces overall direction and purpose." },
        ],
      },
    ],
    coaching: [
      "Low Situational Responsiveness → coach noticing and awareness",
      "Low Approach Adjustment Quality → coach judgment and choice of response",
      "Low Continuity Preservation → coach integration and intentional transitions",
    ],
    canonical: "Adaptive Response is strong when adjustments are timely, appropriate, and maintain coherence in the interaction.",
  },
  {
    id: "commitment_gaining",
    label: "Commitment Generation",
    measurement: "Commitment Gaining",
    canonicalQuestion: "Did the customer voluntarily commit to next actions?",
    definition: "Establishing clear next actions that are voluntarily owned by the customer.",
    color: "green",
    coreMetrics: [
      {
        id: "next_step_clarity",
        name: "Next-Step Clarity",
        question: "Is there a clear, specific next action?",
        anchors: [
          { score: 1, desc: "No next step is identified." },
          { score: 2, desc: "Next step is vague or implied but not clearly defined." },
          { score: 3, desc: "Next step is clearly stated." },
          { score: 4, desc: "Next step is specific and well-articulated." },
          { score: 5, desc: "Next step is explicit, concrete, and unambiguous." },
        ],
      },
      {
        id: "customer_ownership",
        name: "Customer Ownership",
        question: "Does the customer voluntarily own the next action?",
        anchors: [
          { score: 1, desc: "No customer commitment is expressed." },
          { score: 2, desc: "Customer passively agrees without clear ownership." },
          { score: 3, desc: "Customer verbally agrees to the next step." },
          { score: 4, desc: "Customer clearly accepts and affirms ownership of the next step." },
          { score: 5, desc: "Customer proactively articulates or reinforces ownership of the next action." },
        ],
      },
    ],
    optionalMetrics: [
      {
        id: "commitment_strength",
        name: "Commitment Strength",
        question: "How firm and actionable is the commitment?",
        anchors: [
          { score: 1, desc: "Commitment is weak or unrealistic." },
          { score: 2, desc: "Commitment is tentative or heavily qualified." },
          { score: 3, desc: "Commitment is reasonable and credible." },
          { score: 4, desc: "Commitment is firm and actionable." },
          { score: 5, desc: "Commitment is strong, specific, and highly credible." },
        ],
      },
    ],
    coaching: [
      "Low Next-Step Clarity → coach articulation of next actions",
      "Low Customer Ownership → coach invitation vs imposition",
      "Low Commitment Strength → coach realism and specificity",
    ],
    canonical: "Commitment Generation is strong when next actions are clear, voluntary, and owned by the customer.",
  },
];

/** Flat lookup by id */
export const CAPABILITY_BY_ID = Object.fromEntries(SIGNAL_CAPABILITIES.map(c => [c.id, c]));

/** Governance rules (source of truth) */
export const GOVERNANCE = {
  scoringRule: "3 = effective / acceptable (not average). Score what is observable — never infer intent, emotion, or outcome.",
  coreMetricsRule: "Core metrics are always active and averaged for the capability score.",
  optionalMetricsRule: "Optional metrics are activated selectively. They explain variance — they do not define performance.",
  weightingRule: "Metrics are never weighted without empirical validation.",
  coachingRule: "Each metric must map to a different coaching action.",
  overlapRules: [
    "Signal Awareness ≠ Signal Interpretation: Awareness = noticing; Interpretation = meaning + response",
    "Customer Engagement Monitoring ≠ Conversation Management: Engagement = customer behavior; Management = rep structure",
    "Adaptive Response ≠ Objection Navigation: Adaptation = any situational shift; Objections = resistance only",
    "Conversation Management ≠ Commitment Generation: Management = process; Commitment = customer decision",
  ],
  canonicalStatement: "Signal Intelligence is a judgment system. Capabilities define where judgment is applied. Measurements reveal how judgment shows up in behavior.",
};