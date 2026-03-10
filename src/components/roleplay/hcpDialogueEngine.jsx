// hcpDialogueEngine.jsx - Dynamic HCP dialogue and cue recalibration for roleplay simulator

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
  // Helper: detect lunch/meeting requests
  function isLunchInvite(q) {
    return /lunch|coffee|schedule|appointment|meet|catch up|visit/i.test(q);
  }
  // Helper: detect mood or day questions
  function isMoodQuestion(q) {
    return /how are you|how was your (weekend|day|morning|afternoon|evening)|good day|bad day|busy|tired|stress|happy|sad/i.test(q);
  }
  // Helper: detect casual/personal questions
  function isCasualQuestion(q) {
    const casualPatterns = [
      /how are you/i,
      /how was your (weekend|day|morning|afternoon|evening)/i,
      /just want to chat/i,
      /hello|hi|hey/i,
      /thank you/i,
      /busy/i,
      /personal/i,
      /family/i,
      /life/i,
      /doing well/i,
      /good day|bad day/i
    ];
    return casualPatterns.some((pat) => pat.test(q));
  }
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

  // Handle social/casual cues for realism and warmth
  if (isLunchInvite(question)) {
    if (personality && personality.name === "Empathetic") {
      hcpDialogue = "Lunch sounds wonderful! I always appreciate a chance to connect outside the clinic. You know, my staff loves coffee—it's the secret to our energy. Let's find a time that works for both of us. These moments mean a lot.";
      cueBefore = "Dr. Chen beams, genuinely interested in sharing a meal and connecting personally.";
    } else {
      hcpDialogue = "Thank you for the invitation. My schedule is tight, but I can try to make time for lunch soon. Let's coordinate. I appreciate your thoughtfulness.";
      cueBefore = "Dr. Chen smiles, considering the invitation warmly.";
    }
    // Keep conversation open
    hcpDialogue += " By the way, before we get to business, is there anything new with your team or family?";
  } else if (isMoodQuestion(question) || isCasualQuestion(question)) {
    if (personality && personality.name === "Empathetic") {
      const anecdotes = [
        "You know, I wish I could say I was in Italy, but my vacation was spent catching up on sleep and binge-watching old movies. Maybe next time!",
        "No vacation for me this year, but I did manage to sneak in a few rounds of golf. Not quite Italy, but still relaxing.",
        "I haven't taken a vacation yet, but your question makes me realize I need one! Thanks for reminding me to take a break.",
        "Life's been busy, but moments like this—just chatting—are a breath of fresh air.",
        "My staff keeps me on my toes, but I wouldn't trade them for anything. How's your team doing?",
        "I always say, coffee and good company are the best medicine. Glad you stopped by!"
      ];
      const anecdote = anecdotes[Math.floor(Math.random() * anecdotes.length)];
      hcpDialogue = `${anecdote} I appreciate your interest and sense of humor. It's good to connect as people. If you want to keep chatting, I'm all ears. When you're ready, we can pivot to business and talk about ADC integration.`;
      cueBefore = "Dr. Chen responds with humor, warmth, and realism, inviting further conversation before gently pivoting to clinical topics.";
    } else {
      hcpDialogue = "I'm doing well, thank you. It's always nice to catch up. Anything new on your end before we talk clinical?";
      cueBefore = "Dr. Chen smiles, keeping the conversation open and friendly.";
    }
  } else if (isCasualQuestion(question)) {
    if (personality && personality.name === "Empathetic") {
      hcpDialogue = "It's really nice to see you. Sometimes these visits mean more than you realize. If you want to just chat or schedule lunch, I'm open to it. We can talk clinical topics when you're ready, but I value these moments of connection. Anything fun planned for the weekend?";
      cueBefore = "Dr. Chen smiles, shares warmth, and prioritizes human connection before clinical matters, inviting you to continue.";
    } else {
      hcpDialogue = "I'm doing well, thank you. Let's catch up a bit before we dive into clinical topics.";
      cueBefore = "Dr. Chen smiles, keeping the conversation friendly and open.";
    }
  } else {
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
      // Keep conversation open for business topics
      hcpDialogue += " If you have more questions or want to discuss other aspects, I'm happy to continue.";
    } else {
      // If the detected topic doesn't align with the current tab, provide a brief answer and redirect to the relevant tab
      hcpDialogue = applyPersonality(`That's a great question! This topic seems to relate more closely to [${topicDetected}]. If you'd like, we can explore it further or talk about something else that's on your mind.`);
      cueBefore = "Dr. Chen seems thoughtful and invites you to continue the conversation or pivot topics as needed.";
    }
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
