// hcpDialogueEngine.js - Dynamic HCP dialogue and cue recalibration for roleplay simulator

// Define the scenario card
export const scenario = {
  title: "ADC Integration with IO Backbone",
  hcp: {
    name: "Dr. Robert Chen",
    specialty: "Hematology/Oncology",
    practice: "Community Practice",
    keyChallenges: [
      "Toxicity management resource constraints",
      "P&T cost scrutiny and pathway integration",
      "Infusion chair time limitations",
      "Competition with established IO regimens"
    ],
    objective: "Define biomarker-driven patient subset with clear OS/PFS benefit and operational fit; add to order sets and tumor board review",
    personality: {
      name: "Empathetic",
      description: "Shows concern for others, uses warm and supportive language, listens actively.",
      effect: "Responds with understanding, acknowledges feelings, and offers encouragement.",
      verbalRules: "Use phrases that show care and support. Avoid cold or dismissive language. Ask questions that invite sharing."
    }
  },
  topic: "Cost-Response, Toxicity Management, Pathway Integration"
};

// Simulating HCP Dialogue and Cue Recalibration
export function recalibrateHcpDialogueAndCue(question, currentTab) {
  // Basic topic detection logic
  const questionLower = question.toLowerCase();

  let topicDetected = "";

  if (questionLower.includes("cost") || questionLower.includes("response") || questionLower.includes("toxicity") || questionLower.includes("chair time")) {
    topicDetected = "Cost/Response & Toxicity";
  } else if (questionLower.includes("biomarker") || questionLower.includes("os") || questionLower.includes("pfs")) {
    topicDetected = "Biomarker-Driven Subset";
  } else {
    topicDetected = "General";
  }

  // Basic response generation based on detected topic
  let hcpDialogue = "";
  let cueBefore = "";

  // Personality integration
  const personality = scenario.hcp && scenario.hcp.personality ? scenario.hcp.personality : null;
  function applyPersonality(text) {
    if (!personality) return text;
    // Empathetic example: add warmth, supportive phrases, and active listening cues
    if (personality.name === "Empathetic") {
      return `I appreciate your thoughtful question. ${text} I want to ensure we address your concerns and support your goals for patient care.`;
    }
    // Add more personality types as needed
    return text;
  }

  // If the detected topic aligns with the current tab, answer directly
  if (topicDetected === currentTab) {
    if (topicDetected === "Cost/Response & Toxicity") {
      hcpDialogue = applyPersonality("Our P&T committee is focused on cost-effectiveness and managing IO toxicity. Can you explain how this ADC fits into our pathway with those concerns in mind?");
      cueBefore = "Dr. Chen looks up from reviewing the lab results and reflects on how the ADC may be integrated into the cost-conscious and toxicity-sensitive practice.";
    } else if (topicDetected === "Biomarker-Driven Subset") {
      hcpDialogue = applyPersonality("Which specific biomarker-driven patient subset is this ADC targeting? What improvements can we expect in OS/PFS for these patients?");
      cueBefore = "Dr. Chen considers the clinical trial data to evaluate the effectiveness of this ADC in biomarker-driven patients.";
    } else {
      hcpDialogue = applyPersonality("That’s a great question! How does this ADC improve overall treatment in terms of patient subset, cost, and treatment management?");
      cueBefore = "Dr. Chen leans forward, showing curiosity while considering the broader implications of ADC usage in community oncology practices.";
    }
  } else {
    // If the detected topic doesn't align with the current tab, provide a brief answer and redirect to the relevant tab
    hcpDialogue = applyPersonality(`That's a great question! This topic seems to relate more closely to [${topicDetected}]`);
    cueBefore = "Dr. Chen seems thoughtful and suggests that a deeper exploration of this topic might be needed in a different context.";
  }

  // Return the recalibrated cue and dialogue for the HCP
  return {
    hcpState: "engaged", // HCP's emotional state
    temperature: "neutral", // Current emotional temperature
    severity: 0, // Severity of the current conversation
    cueBefore: cueBefore, // The context of Dr. Chen's behavior
    hcpDialogueBefore: hcpDialogue, // HCP's dialogue based on user question
  };
}

// Function to determine the relevant tab and adjust the conversation
export function getTabBasedOnQuestion(question) {
  const lowerCaseQuestion = question.toLowerCase();
  
  if (lowerCaseQuestion.includes("cost") || lowerCaseQuestion.includes("response")) {
    return "Cost/Response & Toxicity";
  } else if (lowerCaseQuestion.includes("biomarker") || lowerCaseQuestion.includes("os") || lowerCaseQuestion.includes("pfs")) {
    return "Biomarker-Driven Subset";
  } else {
    return "General"; // Default tab
  }
}
