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
