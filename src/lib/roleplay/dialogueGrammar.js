const QUESTION_STARTER_PATTERN = /^(Who|What|When|Where|Why|How|Is|Are|Am|Was|Were|Do|Does|Did|Can|Could|Will|Would|Should|Shall|Have|Has|Had|May|Might|Must)\b/i;
const SUBORDINATE_DECLARATIVE_PATTERN = /^(What|How|Why|When|Where|Which)\s+(we|i|you|they|it|this|that)\b[\w\s-]{0,60}\b(is|are|was|were|has|have|had)\b/i;
const ACRONYM_TOKEN_PATTERN = /^(HCP|FDA|NPI|EHR|EMR|PA|P\&T|IDN|ICU|ER|US|EU|IV|IM)$/i;

const DEPENDENT_RELATIVE_STARTER_PATTERN = /^(which|that|who|whom|whose|where|when)\b/i;
const DEPENDENT_SUBORDINATOR_STARTER_PATTERN = /^(because|although|while|if|unless|since)\b/i;
const COORDINATING_CONJUNCTION_PATTERN = /^(and|but|or|so|yet|for|nor)\b/i;
const SUBORDINATE_STARTER_PATTERN = /^(because|although|while|if|unless|since|when|whereas|though|once|until|after|before|as)\b/i;
const AUXILIARY_QUESTION_STARTER_PATTERN = /^(could|would|can|do|does|did|is|are|am|will|may|should)$/i;
const QUESTION_JOINER_PATTERN = /(who|what|when|where|why|how|is|are|am|was|were|do|does|did|can|could|will|would|should|shall|have|has|had|may|might|must)\b/i;
const DEPENDENT_PREFACE_PATTERN = /^(before\s+(?:we|i)\s+[^.!?]{2,90}|given\s+[^.!?]{2,90}|from\s+(?:a|an|the|our|your)\s+[^.!?]{2,80}\s+perspective|to\s+make\s+sure\s+i\s+understand|i\s+want\s+to\s+make\s+sure\s+i\s+understand)$/i;
const STOP_WORD_PATTERN = /\b(the|a|an|this|that|these|those|with|for|first|specific|actually|would|does|do|is|are|be|to|in|of|and|or|my|your|you|i|we|it|if|what|which|how)\b/g;

function normalizeDialogueSignature(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(STOP_WORD_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hcpAskIntentSignature(sentence = '') {
  const value = String(sentence || '').toLowerCase();
  if (/\bpatient subgroup\b/.test(value) && /\b(decision changes?|change in treatment choice|treatment choice|treatment decision|changes? treatment)\b/.test(value)) {
    return 'patient-subgroup-treatment-decision';
  }
  if (/\bpatient profile\b/.test(value) && /\bendpoint\b/.test(value) && /\bdecision\b/.test(value)) {
    return 'patient-subgroup-treatment-decision';
  }
  if (/\bthreshold\b/.test(value) && /\b(clinically useful|useful for the patients|patients? you are thinking about)\b/.test(value)) {
    return 'clinical-utility-threshold';
  }
  if (/\bapproved (?:safety|information|materials?)\b/.test(value) && /\bmedical resource\b/.test(value)) {
    return 'approved-information-boundary';
  }
  if (/\baccess step\b/.test(value) && /\bstaff\b/.test(value)) {
    return 'access-step-staff';
  }
  if (/\bfirst (?:staff|clinic|workflow|access|approval) step\b/.test(value) && /\bchanges?|owns?|pilot\b/.test(value)) {
    return 'first-operational-step';
  }
  return '';
}

export function dedupeRepeatedHcpAsks(dialogue = '') {
  const value = String(dialogue || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /(\bWhat specific patient subgroup[^?.!]{0,140}\bchange in treatment choice[^?.!?,]*),\s*which patient subgroup does that affect first, and what decision changes\?/gi,
      '$1?'
    )
    .replace(
      /(\bWhich patient subgroup does that affect first, and what decision changes[?.!])\s+Which patient subgroup does that affect first, and what decision changes[?.!]?/gi,
      '$1'
    );
  if (!value) return value;

  const sentences = value.match(/[^?.!]+[?.!]?/g) || [value];
  const seenExact = new Set();
  const seenIntent = new Set();
  const kept = [];

  for (const rawSentence of sentences) {
    const sentence = String(rawSentence || '').trim();
    if (!sentence) continue;

    const exact = normalizeDialogueSignature(sentence);
    if (exact && seenExact.has(exact)) continue;

    const intent = hcpAskIntentSignature(sentence);
    if (intent && seenIntent.has(intent)) continue;

    if (exact) seenExact.add(exact);
    if (intent) seenIntent.add(intent);
    kept.push(sentence);
  }

  return kept.join(' ').replace(/\s{2,}/g, ' ').trim();
}

function normalizeAllCapsSentence(sentence = '') {
  const lettersOnly = sentence.replace(/[^A-Za-z]/g, '');
  if (!lettersOnly) return sentence;
  const hasLowercase = /[a-z]/.test(lettersOnly);
  const hasUppercase = /[A-Z]/.test(lettersOnly);
  if (!hasUppercase || hasLowercase) return sentence;

  let normalizedSentence = sentence.toLowerCase();
  normalizedSentence = normalizedSentence.replace(/\bi\b/g, 'I');
  normalizedSentence = normalizedSentence.replace(/\b([a-z&]{2,5})\b/g, (token) => {
    return ACRONYM_TOKEN_PATTERN.test(token) ? token.toUpperCase() : token;
  });
  return normalizedSentence;
}

function normalizeMalformedOpener(value = '') {
  return String(value)
    .replace(/^on\s+(great|good|important|fair)\s+question\b[\s,:-]*/i, (_match, descriptor) => `${descriptor.charAt(0).toUpperCase()}${descriptor.slice(1).toLowerCase()} question, `)
    .replace(/^on\s+(great|good|important|fair)\s+point\b[\s,:-]*/i, (_match, descriptor) => `${descriptor.charAt(0).toUpperCase()}${descriptor.slice(1).toLowerCase()} point, `)
    .trim();
}

function lowercaseQuestionStarter(starter = '') {
  return String(starter || '').toLowerCase();
}

export function formatHcpSentence({ preface = '', ask = '', tone = 'neutral' } = {}) {
  const safePreface = String(preface || '').trim().replace(/[.!?]+$/, '');
  const safeAsk = String(ask || '').trim().replace(/^[,;:!?\s]+/, '');
  if (!safePreface) return safeAsk;
  if (!safeAsk) return safePreface;

  const askWithFlow = safeAsk.replace(QUESTION_JOINER_PATTERN, (starter) => lowercaseQuestionStarter(starter));
  const joiner = tone === 'emphatic' ? ', ' : ', ';
  return `${safePreface}${joiner}${askWithFlow}`;
}

function clauseLooksIndependent(text = '') {
  const value = String(text || '').trim().replace(/["'“”‘’]/g, '');
  if (!value) return false;
  if (SUBORDINATE_STARTER_PATTERN.test(value)) return false;
  if (DEPENDENT_RELATIVE_STARTER_PATTERN.test(value)) return false;

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;

  const startsLikeSubject = /^(i|we|you|they|he|she|it|there|this|that|these|those|the|a|an|our|my|your|their|dr\.?|doctor)\b/i.test(words[0]);
  const finiteVerb = /\b(am|is|are|was|were|have|has|had|do|does|did|can|could|will|would|should|may|might|must|need|needs|needed|seem|seems|seemed|feel|feels|felt|want|wants|wanted|think|thinks|thought|review|reviews|reviewed|prefer|prefers|preferred|keep|keeps|kept|ask|asks|asked|work|works|worked|fit|fits|fitted|\w+ed|\w+s)\b/i.test(value);
  return startsLikeSubject && finiteVerb;
}

export function detectDialogueBoundaryIssues(text = '') {
  const value = String(text || '').trim();
  if (!value) return [];

  const issues = [];
  const commaFragments = value.split(/(?<=[.!?])\s+/);
  commaFragments.forEach((fragment) => {
    const normalizedFragment = String(fragment || '').trim().replace(/[.!?]+$/, '');
    const match = normalizedFragment.match(/^([^?.!]{8,}),\s+([^?.!]{8,})$/);
    if (!match) return;
    const [, left, right] = match;
    if (COORDINATING_CONJUNCTION_PATTERN.test(right)) return;
    if (clauseLooksIndependent(left) && clauseLooksIndependent(right)) {
      issues.push('comma_splice');
    }
  });

  if (/\b[a-z0-9][,;:]\s*(who|what|when|where|why|how|could|would|can|do|does|did|is|are|am|will|may|should)\b/i.test(value)) {
    issues.push('weak_sentence_join_before_question');
  }

  return [...new Set(issues)];
}

function repairSentenceBoundaryJoins(text = '') {
  return String(text || '')
    .replace(
      /([^,.!?]{8,}),\s*(who|what|when|where|why|how|could|would|can|do|does|did|is|are|am|will|may|should)\b(\s+(?:i|we|you|they|he|she|it|there|this|that)\b)?/gi,
      (match, prefix, starter, subjectToken = '') => {
        if (DEPENDENT_PREFACE_PATTERN.test(String(prefix || '').trim())) {
          return `${prefix.trim()}, ${lowercaseQuestionStarter(starter)}${subjectToken || ''}`;
        }
        if (AUXILIARY_QUESTION_STARTER_PATTERN.test(starter) && !String(subjectToken || '').trim()) {
          return match;
        }
        return `${prefix.trim()}. ${starter}${subjectToken || ''}`;
      }
    )
    .replace(/(^|[.!?]\s+)([^?.!]{8,}),\s+([^?.!]{8,})([?.!]?)(?=\s|$)/g, (match, prefix, leftClause, rightClause, trailingPunct) => {
      if (COORDINATING_CONJUNCTION_PATTERN.test(rightClause)) return match;
      if (!clauseLooksIndependent(leftClause) || !clauseLooksIndependent(rightClause)) return match;
      const suffix = trailingPunct || '';
      return `${prefix}${leftClause.trim()}. ${rightClause.trim()}${suffix}`;
    });
}

function repairDependentPrefaceQuestionFragments(text = '') {
  return String(text || '').replace(
    /(^|[.!?]\s+)([^.!?]{3,110}?)\.\s+(Who|What|When|Where|Why|How|Is|Are|Am|Was|Were|Do|Does|Did|Can|Could|Will|Would|Should|Shall|Have|Has|Had|May|Might|Must)\b/g,
    (match, prefix, preface, starter) => {
      const cleanPreface = String(preface || '').trim();
      if (!DEPENDENT_PREFACE_PATTERN.test(cleanPreface)) return match;
      return `${prefix}${formatHcpSentence({ preface: cleanPreface, ask: starter })}`;
    }
  );
}

function hasDependentPrefaceQuestion(text = '') {
  const value = String(text || '').trim();
  const commaIndex = value.indexOf(',');
  if (commaIndex < 0) return false;
  const preface = value.slice(0, commaIndex).trim();
  const remainder = value.slice(commaIndex + 1).trim();
  return DEPENDENT_PREFACE_PATTERN.test(preface) && QUESTION_JOINER_PATTERN.test(remainder);
}

function mergeDependentClauseFragments(sentences = []) {
  return sentences.reduce((merged, rawSentence) => {
    const sentence = String(rawSentence || '').trim();
    if (!sentence) return merged;
    if (merged.length === 0) {
      merged.push(sentence);
      return merged;
    }

    const withoutEndPunct = sentence.replace(/[?.!]+$/, '').trim();
    const isQuestion = /\?$/.test(sentence);
    const isRelativeFragment = DEPENDENT_RELATIVE_STARTER_PATTERN.test(withoutEndPunct) && !isQuestion;
    const isSubordinatorFragment =
      DEPENDENT_SUBORDINATOR_STARTER_PATTERN.test(withoutEndPunct)
      && !isQuestion
      && !withoutEndPunct.includes(',');

    if (!isRelativeFragment && !isSubordinatorFragment) {
      merged.push(sentence);
      return merged;
    }

    const previous = merged.pop() || '';
    const previousWithoutEndPunct = previous.replace(/[?.!]+$/, '').trim();
    const currentWithoutEndPunct = withoutEndPunct.replace(/^([A-Z])/, (char) => char.toLowerCase());
    merged.push(`${previousWithoutEndPunct}, ${currentWithoutEndPunct}.`);
    return merged;
  }, []);
}

function normalizeFormalRecallPhrases(text = '') {
  return String(text || '')
    .replace(/\bBefore we discuss further,\s*/gi, 'Before we go further, ')
    .replace(/\bBefore we discuss further\.\s*/gi, 'Before we go further. ')
    .replace(/\bBefore we discuss new data,\s*/gi, 'Before we get into new data, ')
    .replace(/\bBefore we discuss new data\.\s*/gi, 'Before we get into new data. ')
    .replace(/\bBefore we discuss more data,\s*/gi, 'Before we get into more data, ')
    .replace(/\bBefore we discuss more data\.\s*/gi, 'Before we get into more data. ')
    .replace(/\bthe treatment options you (?:mentioned|shared|reviewed|discussed) last week\b/gi, 'that')
    .replace(/\bthe data you (?:mentioned|shared|reviewed|discussed) last week\b/gi, 'that data')
    .replace(/\bthe evidence you (?:mentioned|shared|reviewed|discussed) last week\b/gi, 'that evidence')
    .replace(/\bwould impact\b/gi, 'would change')
    .replace(/\bimpact the long-term durability for\b/gi, 'affects durability for')
    .replace(/\bimpact the long-term durability of treatments for\b/gi, 'affects durability for')
    .replace(/\bspecifically address how\b/gi, 'tie back how')
    .replace(/\bapplies to the long-term durability of treatments for\b/gi, 'ties to long-term durability for')
    .replace(/\bapply to the long-term durability of treatments for\b/gi, 'tie to long-term durability for')
    .replace(/\bhow that data ties to\b/gi, 'how that data ties back to')
    .replace(/\bhow that ties to\b/gi, 'how that ties back to')
    .replace(/\bworkflow for my stable, suppressed patients\b/gi, 'workflow for stable patients')
    .replace(/\bworkflow for my stable patients\b/gi, 'workflow for stable patients')
    .replace(/\bCan you tie back how\b/g, 'Can you tie that back to how')
    .replace(/\bcan you tie back how\b/g, 'can you tie that back to how')
    .replace(/\bcan you tie that back to how that data ties back to\b/gi, 'can you tie that data back to')
    .replace(/\bcan you tie that back to how that evidence ties back to\b/gi, 'can you tie that evidence back to')
    .replace(/\bcan you tie that back to how that would actually change\b/gi, 'can you walk me through how that would actually change')
    .replace(/\bcan you tie that back to how that affects durability for\b/gi, 'can you tie that to durability for')
    .replace(/\bcan you tie that back to how that impact durability for\b/gi, 'can you tie that to durability for')
    .replace(/\bCan you specifically address\b/g, 'Can you tie that back to')
    .replace(/\bcan you specifically address\b/g, 'can you tie that back to')
    .replace(/\bhow that would change the workflow\b/gi, 'how that would actually change the workflow')
    .replace(/\bcan you tie that back to how that would actually change\b/gi, 'can you walk me through how that would actually change')
    .replace(/\bthe workflow for stable patients\b/gi, 'my workflow for stable patients')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function repairSpokenPrefaceQuestionJoin(text = '') {
  return String(text || '').replace(
    /^(Before we (?:go further|get into (?:new|more) data))\.\s+(Can|Could|Would|What|How|Which|When|Where|Why)\b/,
    (_match, preface, starter) => `${preface}, ${lowercaseQuestionStarter(starter)}`
  );
}

export function detectBrokenDependency(text = '') {
  const value = String(text || '').trim();
  const issues = [];
  if (/(^|[.!?]\s+)(before\s+(?:i|we)\s+[^.!?]{2,110})\.\s+(who|what|when|where|why|how|which|can|could|would)\b/i.test(value)) {
    issues.push('dependent_preface_split_before_question');
  }
  if (/;\s*if\s+[^.!?]{2,90}\.\s+(who|what|when|where|why|how|which|can|could|would)\b/i.test(value)) {
    issues.push('semicolon_if_clause_split_before_question');
  }
  if (/\bif\s+we\s+changed\s+course\.\s+(who|what|when|where|why|how|which|can|could|would)\b/i.test(value)) {
    issues.push('conditional_clause_split_before_question');
  }
  return [...new Set(issues)];
}

export function detectUnsafePunctuationSplit(text = '') {
  const value = String(text || '').trim();
  const issues = [];
  if (/;\s*(if|because|while|when|before|after|once)\b[^.!?]{2,110}\.\s+(who|what|when|where|why|how|which|can|could|would)\b/i.test(value)) {
    issues.push('unsafe_semicolon_dependent_split');
  }
  if (/(^|[.!?]\s+)(given\s+[^.!?]{2,90}|from\s+(?:a|an|the|our|your)\s+[^.!?]{2,80}\s+perspective)\.\s+(who|what|when|where|why|how|which|can|could|would)\b/i.test(value)) {
    issues.push('unsafe_dependent_period_split');
  }
  return [...new Set(issues)];
}

export function detectClauseStitchFailure(text = '') {
  return [...new Set([...detectBrokenDependency(text), ...detectUnsafePunctuationSplit(text)])];
}

export function reviseForSentenceIntegrity(text = '') {
  let value = String(text || '').trim();
  if (!value) return value;

  value = value
    .replace(
      /(^|[.!?]\s+)(before\s+(?:i|we)\s+[^.!?]{2,110})\.\s+(Who|What|When|Where|Why|How|Which|Can|Could|Would)\b/gi,
      (_match, prefix, preface, starter) => `${prefix}${preface}, ${lowercaseQuestionStarter(starter)}`
    )
    .replace(
      /;\s*(if\s+[^.!?]{2,90})\.\s+(Who|What|When|Where|Why|How|Which|Can|Could|Would)\b/gi,
      (_match, condition, starter) => `; ${condition}, ${lowercaseQuestionStarter(starter)}`
    )
    .replace(
      /\b(if\s+we\s+changed\s+course)\.\s+(Who|What|When|Where|Why|How|Which|Can|Could|Would)\b/gi,
      (_match, condition, starter) => `${condition}, ${lowercaseQuestionStarter(starter)}`
    )
    .replace(/\s{2,}/g, ' ')
    .trim();

  return value;
}

function splitOverlongHcpQuestion(text = '') {
  const value = String(text || '').trim();
  if (!value || value.split(/\s+/).length <= 25) return value;

  return value
    .replace(
      /^(Before we (?:go further|get into (?:new|more) data),)\s+can you tie that back to how ([^?]{18,160})\?$/i,
      (_match, preface, ask) => `${preface} help me make this practical. How ${ask.trim()}?`
    )
    .replace(
      /^(Before we (?:go further|get into (?:new|more) data),)\s+can you tie that back to ([^?]{18,160})\?$/i,
      (_match, preface, ask) => `${preface} help me make this practical. How does ${ask.trim()}?`
    )
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeHcpSpokenRealism(dialogue) {
  const normalized = normalizeDialogueSentenceBoundaries(dialogue);
  if (!normalized) return normalized;
  return dedupeRepeatedHcpAsks(
    repairSpokenPrefaceQuestionJoin(
      normalizeDialogueSentenceBoundaries(
        reviseForSentenceIntegrity(
          splitOverlongHcpQuestion(
            normalizeFormalRecallPhrases(normalized)
          )
        )
      )
    )
  );
}

function compressWorkflowOwnershipQuestion(text = '', cueCategory = '') {
  const value = String(text || '');
  if (!/focused_narrowing|non_adaptive_impatience|time_constrained|hard_escalation/.test(cueCategory)) return value;

  let compressed = value
    .replace(
      /^I can stay with this if we make it concrete\. What is the first step my staff would own\?$/i,
      cueCategory === 'hard_escalation'
        ? 'I can stay with this if we make it concrete. What would my staff own first?'
        : 'Okay, make it concrete. What would my staff do first?'
    )
    .replace(
      /^Okay, make it concrete\. What would my staff own first\?$/i,
      cueCategory === 'hard_escalation'
        ? 'I can stay with this if we make it concrete. What would my staff own first?'
        : 'Okay, make it concrete. What would my staff own first?'
    )
    .replace(
      /^Okay, make it concrete\. What is the first step my staff would own\?$/i,
      cueCategory === 'hard_escalation'
        ? 'I can stay with this if we make it concrete. What would my staff own first?'
        : 'Okay, make it concrete. What would my staff do first?'
    )
    .replace(
      /^I am open to the idea, but it has to be practical\. What is the smallest workflow change you would recommend first\?$/i,
      cueCategory === 'hard_escalation'
        ? 'Make it practical. What is the smallest workflow change?'
        : 'I am open to it, but make it practical. What is the smallest workflow change?'
    )
    .replace(/\bWhat is the first step my staff would own\?/i, 'What would my staff own first?')
    .replace(/\bWhat is the first practical step here\?/i, cueCategory === 'hard_escalation' ? 'What is the practical step?' : 'What is the first practical step?');

  if (cueCategory === 'time_constrained') {
    compressed = compressed
      .replace(/^I am open to it, but make it practical\./i, 'I am open to it, but keep it practical.')
      .replace(/\bWhat is the smallest workflow change\?/i, 'What is the smallest workflow change we could actually run?');
  }

  return compressed;
}

function compressEvidenceQuestion(text = '', cueCategory = '') {
  const value = String(text || '');
  let compressed = value
    .replace(/,?\s+which was my primary concern\??/gi, '')
    .replace(/,?\s+which is my primary concern\??/gi, '')
    .replace(/\bwhat you showed last week\b/gi, 'last week’s data')
    .replace(/\bthat data you shared\b/gi, 'that data');

  if (/focused_narrowing|non_adaptive_impatience|time_constrained|hard_escalation/.test(cueCategory)) {
    compressed = compressed
      .replace(
        /^Before we get into new data, can you tie that data back to long-term durability for my stable HIV patients\?$/i,
        cueCategory === 'hard_escalation'
          ? 'Can you connect last week’s data to durability for my stable patients?'
          : 'Before we get into new data, can you tie that data to durability for my stable patients?'
      )
      .replace(
        /^Before we go further, can you tie that data back to long-term durability for my stable HIV patients\?$/i,
        'Before we go further, can you tie that data to durability for my stable patients?'
      )
      .replace(/\blong-term durability for my stable HIV patients\b/gi, 'durability for my stable patients')
      .replace(/\blong-term durability for my stable patients\b/gi, 'durability for my stable patients');
  }

  if (cueCategory === 'hard_escalation') {
    compressed = compressed
      .replace(/^I hear the setup, but I need the evidence answer: /i, '')
      .replace(/^Before we get into new data, /i, '')
      .replace(/^Before we go further, /i, '');
  }

  return compressed;
}

function compressTerminalDialogue(text = '') {
  return String(text || '')
    .replace(/^I need to pause here if we cannot get to the ([^.?!]+) answer\.?$/i, 'I need to pause here.')
    .replace(/^I need to stop here if we cannot get to the ([^.?!]+) answer\.?$/i, 'I need to stop here.')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function compressHcpDialogueForState(dialogue, {
  cueCategory = 'neutral_attentive',
  concernFamily = 'general',
} = {}) {
  const normalized = normalizeHcpSpokenRealism(dialogue);
  if (!normalized) return normalized;
  if (cueCategory === 'neutral_attentive') return normalized;

  let compressed = normalized
    .replace(/\bCan you specifically address\b/gi, 'Can you tie that back to')
    .replace(/\bthe treatment options you mentioned last week\b/gi, 'what you showed last week')
    .replace(/\bthe data you shared last week\b/gi, 'that data')
    .replace(/,?\s+as that(?:'s| is) (?:the )?(?:key factor|primary concern)[^?.!]*([?.!])/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (concernFamily === 'workflow' || /workflow|staff|practical step|clinic flow/i.test(compressed)) {
    compressed = compressWorkflowOwnershipQuestion(compressed, cueCategory);
  }
  if (concernFamily === 'evidence' || /evidence|data|proof|durability|decision/i.test(compressed)) {
    compressed = compressEvidenceQuestion(compressed, cueCategory);
  }
  if (cueCategory === 'terminal_exit') {
    compressed = compressTerminalDialogue(compressed);
  }

  return normalizeHcpSpokenRealism(compressed);
}

export function normalizeDialogueSentenceBoundaries(dialogue) {
  if (!dialogue) return dialogue;

  let text = String(dialogue).replace(/\s+/g, ' ').trim();
  if (!text) return text;

  text = normalizeMalformedOpener(text);

  text = repairSentenceBoundaryJoins(text)
    .replace(/\s{2,}/g, ' ')
    .trim();

  text = repairDependentPrefaceQuestionFragments(text)
    .replace(/^[,;:\-–—]+\s*/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=\S)/g, '$1 ')
    .replace(/([a-z0-9])([.!?])([A-Za-z])/g, '$1$2 $3')
    .replace(/\.\s*\?/g, '?')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const sentences = text.match(/[^?.!]+[?.!]?/g) || [text];
  const normalizedSentences = sentences
    .map((rawSentence) => {
      const sentence = normalizeAllCapsSentence(rawSentence.trim());
      if (!sentence) return '';

      const withoutEndPunct = sentence.replace(/[?.!]+$/, '').trim();
      if (!withoutEndPunct) return '';

      const capitalized = withoutEndPunct.replace(/^([a-z])/, (_match, c) => c.toUpperCase());
      const isQuestion = QUESTION_STARTER_PATTERN.test(withoutEndPunct);
      const isDependentPrefaceQuestion = hasDependentPrefaceQuestion(withoutEndPunct);
      const isSubordinateDeclarative = SUBORDINATE_DECLARATIVE_PATTERN.test(withoutEndPunct);

      if ((isQuestion || isDependentPrefaceQuestion) && !isSubordinateDeclarative) return `${capitalized}?`;
      if (/[?.!]$/.test(sentence)) return sentence;
      return `${capitalized}.`;
    })
    .filter(Boolean);

  const normalized = mergeDependentClauseFragments(normalizedSentences)
    .join(' ')
    .trim()
    .replace(/^([a-z])/, (_match, c) => c.toUpperCase())
    .replace(/([.!?]\s+)([a-z])/g, (_match, prefix, c) => `${prefix}${c.toUpperCase()}`);

  if (!/[?.!]$/.test(normalized)) return `${normalized}.`;
  return normalized;
}
