import { compressHcpDialogueForState, normalizeHcpSpokenRealism } from './dialogueGrammar.js';

export const CONVERSATIONAL_REALISM_ENGINE_VERSION = 'conversational_realism_engine_v1';

const PRESSURE_CATEGORIES = new Set([
  'focused_narrowing',
  'non_adaptive_impatience',
  'time_constrained',
  'hard_escalation',
  'terminal_exit',
]);

const SOFT_COLLABORATIVE_PATTERN = /\b(i can stay with this|happy to|let'?s explore|we can talk through|i'?m open to discussing)\b/i;
const CONSTRAINED_DIRECT_ASK_PATTERN = /\bi can stay with this if we make it concrete\.[^.?!]*\bwhat\b/i;
const TERMINAL_PATTERN = /\b(pause here|stop here|get back to clinic|we are done|ending|wrap|one point|then show me|move on)\b/i;
const FORMAL_EXPANSION_PATTERN = /\b(to directly address|to address your follow-up|can you specifically elaborate|supports the long-term durability|treatment regimens)\b/i;

function normalizeRuntimeText(...values) {
  return values.map((value) => String(value || '').toLowerCase()).join(' ');
}

function deriveScenarioArchetype({ scenarioContext = '', activeAsk = '', text = '' } = {}) {
  const combined = normalizeRuntimeText(scenarioContext, activeAsk, text);
  if (/\b(stable hiv|stable,? suppressed|suppressed patients|michael chen)\b/.test(combined)) return 'stable_hiv_optimization';
  if (/\bdurability\b/.test(combined) && /\bstable patients?\b/.test(combined)) return 'stable_hiv_optimization';
  if (/\b(post-?covid|antiviral|day 4|day 5|callback list)\b/.test(combined)) return 'post_covid_antiviral_adherence';
  if (/\b(formulary|p&t|committee|cardiology|budget reports?)\b/.test(combined)) return 'cardiology_formulary_review';
  return 'general';
}

function deriveExpressionConcernFamily({ concernFamily = 'general', activeAsk = '', text = '', scenarioContext = '' } = {}) {
  const ask = normalizeRuntimeText(activeAsk);
  const combined = normalizeRuntimeText(activeAsk, text, scenarioContext);
  if (/\b(workflow|staff|team|operational|practice|day one|do differently|first step)\b/.test(ask)) return 'workflow';
  if (/\b(durability|evidence|proof|data point|decision-relevant|outcomes?|justify|justifies|formulary)\b/.test(ask)) return 'evidence';
  if (/\b(access|coverage|payer|prior auth|copay)\b/.test(ask)) return 'access';
  if (/\b(screen|candidate|criteria|patient selection)\b/.test(ask)) return 'screening';
  if (concernFamily && concernFamily !== 'general') return concernFamily;
  if (/\b(durability|evidence|proof|data point|decision-relevant|outcomes?|justify|justifies|formulary)\b/.test(combined)) return 'evidence';
  if (/\b(workflow|staff|team|operational|practice|day one|do differently|first step)\b/.test(combined)) return 'workflow';
  return concernFamily || 'general';
}

function isGenericCompressedAsk(text = '') {
  return /\b(make it concrete|make it practical|what would my (?:team|staff) do first|what evidence point changes the decision|how does that change the decision)\b/i.test(text);
}

function selectScenarioGroundedHcpLine({
  text = '',
  activeAsk = '',
  scenarioContext = '',
  concernFamily = 'general',
  cueCategory = 'neutral_attentive',
  terminalBehavior = false,
  timePressure = false,
} = {}) {
  const scenarioArchetype = deriveScenarioArchetype({ scenarioContext, activeAsk, text });
  const expressionConcern = deriveExpressionConcernFamily({ concernFamily, activeAsk, text, scenarioContext });
  const highPressure = /focused_narrowing|non_adaptive_impatience|time_constrained|hard_escalation|terminal_exit/i.test(cueCategory)
    || terminalBehavior
    || timePressure;
  const shouldReplace = highPressure && isGenericCompressedAsk(text);
  if (!shouldReplace) return text;

  if (scenarioArchetype === 'stable_hiv_optimization') {
    if (expressionConcern === 'evidence') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on. If this changes durability for stable patients, what is the evidence point?";
      }
      if (cueCategory === 'time_constrained' || timePressure) {
        return 'Given how little time we have, what specific evidence actually justifies switching stable patients?';
      }
      return "I remember that data, but let me be direct: if I'm changing anything for stable patients, what evidence justifies the switch?";
    }
    if (expressionConcern === 'workflow') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on. If this is real, what would my team do differently next week?";
      }
      return "I remember that data, but I need something actionable. What would my team actually do differently next week?";
    }
  }

  if (scenarioArchetype === 'post_covid_antiviral_adherence') {
    if (cueCategory === 'terminal_exit' || terminalBehavior) {
      return "I'm watching the clock. If this is not simple to operationalize, it's not happening.";
    }
    return "That's exactly the issue, but I do not have bandwidth for theory. What would this look like in practice on day one?";
  }

  if (scenarioArchetype === 'cardiology_formulary_review') {
    if (expressionConcern === 'evidence') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on. What single data point should influence this decision?";
      }
      return 'Let me stop you there: this comes down to evidence. What single data point should influence this decision?';
    }
    if (expressionConcern === 'workflow') {
      if (cueCategory === 'terminal_exit' || terminalBehavior) {
        return "I'm about to move on. If we move forward, what is the first step for my team?";
      }
      return 'What is the realistic first step for my team?';
    }
  }

  return text;
}

function isHighPressureState({ cueCategory = '', interactionMode = '', engagementTier = '', semanticStage = '', terminalBehavior = false } = {}) {
  if (terminalBehavior) return true;
  return /terminal_exit|hard_escalation|time_constrained|non_adaptive_impatience|focused_narrowing|closing|disengaging|directive|hard|terminal/i
    .test(`${cueCategory} ${interactionMode} ${engagementTier} ${semanticStage}`);
}

function compressFormalQuestionToSingleAsk({ text = '', concernFamily = 'general', cueCategory = 'neutral_attentive' } = {}) {
  const value = normalizeHcpSpokenRealism(text);
  const isTerminal = cueCategory === 'terminal_exit';
  const terminalLead = isTerminal ? "I'm about to move on. " : '';

  if (concernFamily === 'workflow' || /workflow|staff|team|clinic flow|practical/i.test(value)) {
    return isTerminal
      ? "I'm about to move on, but make it practical. What would my team do first?"
      : 'I can stay with this if we make it concrete. What would my team do first?';
  }
  if (concernFamily === 'access' || /access|coverage|payer|prior auth|copay/i.test(value)) {
    return `${terminalLead}what is the access step here?`.replace(/^([a-z])/, (_match, c) => c.toUpperCase());
  }
  if (concernFamily === 'screening' || /screen|candidacy|criteria|resistance|patient selection/i.test(value)) {
    return `${terminalLead}who would you screen first?`.replace(/^([a-z])/, (_match, c) => c.toUpperCase());
  }
  if (concernFamily === 'evidence' || /durability|evidence|proof|data|decision|regimen/i.test(value)) {
    if (/stable/i.test(value)) return `${terminalLead}how does that affect durability for stable patients?`.replace(/^([a-z])/, (_match, c) => c.toUpperCase());
    return `${terminalLead}how does that change the decision?`.replace(/^([a-z])/, (_match, c) => c.toUpperCase());
  }
  return isTerminal ? 'One point: what changes here?' : 'Then give me the practical point.';
}

export function enforceTerminalCompression({ text, concernFamily = 'general', cueCategory = 'terminal_exit' } = {}) {
  let value = normalizeHcpSpokenRealism(text)
    .replace(/^To directly address[^.?!]*[.?!]\s*/i, '')
    .replace(/^To address[^.?!]*[.?!]\s*/i, '')
    .replace(/\bCan you specifically elaborate on how\b/gi, 'How does')
    .replace(/\bcan you specifically elaborate on how\b/g, 'how does')
    .replace(/\bsupports the long-term durability of treatment regimens for\b/gi, 'affect durability for')
    .replace(/\bsupport the long-term durability of treatment regimens for\b/gi, 'affect durability for')
    .replace(/\bsupports long-term durability of treatment regimens for\b/gi, 'affect durability for')
    .replace(/\btreatment regimens\b/gi, 'treatments')
    .replace(/\s{2,}/g, ' ')
    .trim();

  value = normalizeHcpSpokenRealism(value);
  if (concernFamily === 'workflow' || /workflow|staff|team|clinic flow|practical/i.test(value)) {
    value = value
      .replace(/^What is the first practical workflow step here\?$/i, 'I can stay with this if we make it concrete. What would my team do first?')
      .replace(/^Start with one practical workflow step my team could actually use\.?$/i, 'I can stay with this if we make it concrete. What would my team do first?')
      .replace(/^Keep it to one workflow step we could use here\.?$/i, 'I can stay with this if we make it concrete. What would my team do first?')
      .replace(/^Tell me the first practical workflow step you would recommend\.?$/i, 'I can stay with this if we make it concrete. What would my team do first?');
    if (cueCategory === 'terminal_exit') {
      value = value.replace(/^I can stay with this if we make it concrete\. What would my team do first\?$/i, "I'm about to move on, but make it practical. What would my team do first?");
    }
  }
  if (concernFamily === 'evidence' || /evidence|proof|data|decision|durability|formulary/i.test(value)) {
    value = value
      .replace(/^Given the time, what is the one decision-relevant evidence point\?$/i, 'Given the time, what evidence point changes the decision?')
      .replace(/^How does that change the decision\?$/i, 'Can you tie that to the decision?')
      .replace(/^Before we move on, can you tie that to durability for my stable patients\?$/i, 'Before we move on, can you tie that to durability for my stable patients?');
    if (cueCategory === 'terminal_exit') {
      value = value.replace(/^Given the time, what evidence point changes the decision\?$/i, "I'm about to move on. What evidence point changes the decision?");
    }
  }
  const overpacked = detectOverpackedSentence({ text: value });
  if (FORMAL_EXPANSION_PATTERN.test(text) || overpacked.overpacked || overpacked.wordCount > 16) {
    return compressFormalQuestionToSingleAsk({ text: value, concernFamily, cueCategory });
  }
  return value;
}

function normalizeRecentTurns(recentHcpTurns = []) {
  return (Array.isArray(recentHcpTurns) ? recentHcpTurns : [])
    .map((turn) => String(turn?.hcpDialogueBefore || turn?.hcpDialogue || turn || '').trim())
    .filter(Boolean)
    .slice(-4);
}

function phraseFamilyForText(text = '', concernFamily = 'general') {
  const value = String(text || '').toLowerCase();
  if (/durability|evidence|proof|data|decision/.test(value)) return 'evidenceAsk';
  if (/workflow|staff|team|practical|own first|do first/.test(value)) return 'workflowAsk';
  if (/access|coverage|payer|prior|auth|copay/.test(value)) return 'accessAsk';
  if (/screen|candidacy|criteria|patient selection|resistance/.test(value)) return 'screeningAsk';
  if (/pause here|stop here|wrap|get back/.test(value)) return 'closingThreshold';
  return `${concernFamily || 'general'}Ask`;
}

export function detectOverpackedSentence({ text } = {}) {
  const value = String(text || '').trim();
  if (!value) return { overpacked: false, wordCount: 0, clauseCount: 0, reasons: [] };
  const wordCount = value.split(/\s+/).filter(Boolean).length;
  const clauseCount = (value.match(/[,;:—-]/g) || []).length + 1;
  const reasons = [];
  if (wordCount > 26) reasons.push('too_many_words');
  if (clauseCount > 3) reasons.push('too_many_clauses');
  if (/\bwhich (?:was|is)|\bas that (?:is|was)|\bin the context of\b/i.test(value)) reasons.push('formal_meta_labeling');
  return { overpacked: reasons.length > 0, wordCount, clauseCount, reasons };
}

export function humanizeClinicalReferences({ text, concernFamily = 'general', scenarioContext = '' } = {}) {
  return normalizeHcpSpokenRealism(text)
    .replace(/\bthe treatment options you mentioned last week\b/gi, 'what you showed last week')
    .replace(/\bthe outcomes data you shared last week\b/gi, 'that data you shared last week')
    .replace(/\bthe evidence you referenced previously\b/gi, 'that evidence')
    .replace(/\bthe operational implications for my staff\b/gi, 'what my staff would actually do')
    .replace(/\bin the context of our current standard of care\b/gi, 'for the patients we are actually treating')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function reduceFormalMetaLabeling({ text } = {}) {
  const reduced = String(text || '')
    .replace(/,?\s+which was my primary concern\??/gi, '')
    .replace(/,?\s+which is my primary concern\??/gi, '')
    .replace(/,?\s+as that (?:is|was) the key factor in my decision\.?/gi, '. That is what matters here.')
    .replace(/,?\s+which is the most important consideration\??/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return normalizeHcpSpokenRealism(reduced);
}

export function enforceSpokenLanguage({ text, interactionMode = '', engagementTier = '' } = {}) {
  let value = normalizeHcpSpokenRealism(text);
  value = reduceFormalMetaLabeling({ text: value });

  if (/directive|closing|constrained|impatient|hard|terminal/i.test(`${interactionMode} ${engagementTier}`)) {
    value = value
      .replace(/^I can stay with this if we make it concrete\./i, 'Okay, make it concrete.')
      .replace(/^Before we get into new data, can you tie that data to/i, 'Before we move on, can you tie that to')
      .replace(/^Before we get into new data, can you tie that to/i, 'Before we move on, can you tie that to')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return normalizeHcpSpokenRealism(value);
}

export function compressByState({ text, concernFamily = 'general', cueCategory = 'neutral_attentive' } = {}) {
  return compressHcpDialogueForState(text, { cueCategory, concernFamily });
}

export function splitOrCompressSentence({ text, interactionMode = '', cueCategory = 'neutral_attentive', concernFamily = 'general' } = {}) {
  const compressed = compressByState({ text, cueCategory, concernFamily });
  const overpacked = detectOverpackedSentence({ text: compressed });
  if (!overpacked.overpacked || cueCategory === 'neutral_attentive') return compressed;
  if (/hard_escalation|terminal_exit/.test(cueCategory)) return compressByState({ text: compressed, cueCategory, concernFamily });
  return enforceSpokenLanguage({ text: compressed, interactionMode, engagementTier: cueCategory });
}

export function varyPressurePhrasing({ text, concernFamily = 'general', recentHcpTurns = [], interactionMode = '', cueCategory = 'neutral_attentive' } = {}) {
  const currentFamily = phraseFamilyForText(text, concernFamily);
  const recent = normalizeRecentTurns(recentHcpTurns);
  const repeatedFamilyCount = recent.filter((turn) => phraseFamilyForText(turn, concernFamily) === currentFamily).length;
  if (repeatedFamilyCount < 2) {
    return { text, phraseFamily: currentFamily, repeatedFamilyCount, changed: false };
  }

  const tightened = compressByState({ text, concernFamily, cueCategory: PRESSURE_CATEGORIES.has(cueCategory) ? cueCategory : 'focused_narrowing' });
  return {
    text: tightened,
    phraseFamily: currentFamily,
    repeatedFamilyCount,
    changed: tightened !== text,
  };
}

export function validateCueDialogueLockstep({ cueCategory = 'neutral_attentive', interactionMode = '', engagementTier = '', semanticStage = '', finalText = '' } = {}) {
  const text = String(finalText || '').trim();
  const mismatchReasons = [];
  if (cueCategory === 'terminal_exit' && !TERMINAL_PATTERN.test(text)) mismatchReasons.push('terminal_cue_without_terminal_dialogue');
  if (cueCategory === 'time_constrained' && detectOverpackedSentence({ text }).wordCount > 22) mismatchReasons.push('time_constrained_dialogue_too_long');
  if (cueCategory === 'hard_escalation' && SOFT_COLLABORATIVE_PATTERN.test(text) && !CONSTRAINED_DIRECT_ASK_PATTERN.test(text)) {
    mismatchReasons.push('hard_escalation_with_soft_framing');
  }
  return {
    aligned: mismatchReasons.length === 0,
    mismatchReasons,
  };
}

export function applyConversationalRealism({
  text,
  activeAsk = '',
  concernFamily = 'general',
  engagementTier = '',
  interactionMode = '',
  semanticStage = '',
  terminalBehavior = false,
  timePressure = false,
  cueCategory = 'neutral_attentive',
  conversationIntelligence = null,
  recentHcpTurns = [],
  scenarioContext = '',
} = {}) {
  const expressionConcernFamily = deriveExpressionConcernFamily({ concernFamily, activeAsk, text, scenarioContext });
  const resolvedCueCategory = terminalBehavior
    ? 'terminal_exit'
    : (timePressure && cueCategory === 'neutral_attentive' ? 'time_constrained' : cueCategory || 'neutral_attentive');

  const grammarNormalized = normalizeHcpSpokenRealism(text);
  const humanized = humanizeClinicalReferences({ text: grammarNormalized, concernFamily: expressionConcernFamily, scenarioContext });
  const spoken = enforceSpokenLanguage({ text: humanized, interactionMode, engagementTier });
  const terminalCompressed = isHighPressureState({
    cueCategory: resolvedCueCategory,
    interactionMode,
    engagementTier,
    semanticStage,
    terminalBehavior,
  })
    ? enforceTerminalCompression({ text: spoken, concernFamily: expressionConcernFamily, cueCategory: resolvedCueCategory })
    : spoken;
  const compressed = splitOrCompressSentence({ text: terminalCompressed, interactionMode, cueCategory: resolvedCueCategory, concernFamily: expressionConcernFamily });
  const scenarioGrounded = selectScenarioGroundedHcpLine({
    text: compressed,
    activeAsk,
    scenarioContext,
    concernFamily: expressionConcernFamily,
    cueCategory: resolvedCueCategory,
    terminalBehavior,
    timePressure,
  });
  const varied = varyPressurePhrasing({ text: scenarioGrounded, concernFamily: expressionConcernFamily, recentHcpTurns, interactionMode, cueCategory: resolvedCueCategory });
  const lockstep = validateCueDialogueLockstep({
    cueCategory: resolvedCueCategory,
    interactionMode,
    engagementTier,
    semanticStage,
    finalText: varied.text,
  });
  const finalText = lockstep.aligned
    ? varied.text
    : enforceTerminalCompression({
      text: compressByState({ text: varied.text, concernFamily: expressionConcernFamily, cueCategory: resolvedCueCategory }),
      concernFamily: expressionConcernFamily,
      cueCategory: resolvedCueCategory,
    });

  return {
    text: normalizeHcpSpokenRealism(finalText),
    metadata: {
      version: CONVERSATIONAL_REALISM_ENGINE_VERSION,
      cueCategory: resolvedCueCategory,
      concernFamily: expressionConcernFamily,
      scenarioArchetype: deriveScenarioArchetype({ scenarioContext, activeAsk, text }),
      phraseFamily: varied.phraseFamily,
      repeatedFamilyCount: varied.repeatedFamilyCount,
      lockstep,
      overpacked: detectOverpackedSentence({ text: finalText }),
      activeAskPresent: Boolean(String(activeAsk || '').trim()),
      terminalCompressionApplied: terminalCompressed !== spoken || finalText !== varied.text,
      conversationIntelligenceProgression: conversationIntelligence?.turnInterpretation?.progression || null,
    },
  };
}
