import { normalizeScenarioRuntimeContract } from '../../lib/scenarioNormalization.js';

function normalizeText(value = '') {
  return String(value || '').trim();
}

function deterministicIndex(seed = '', modulo = 1) {
  const text = String(seed || '');
  if (!text || modulo <= 1) return 0;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0) % modulo;
}

function stripOuterPunctuation(value = '') {
  return String(value || '').trim().replace(/^[\s:;,.-]+|[\s:;,.-]+$/g, '').trim();
}

function isWordChar(char = '') {
  return /[a-z0-9]/i.test(String(char || ''));
}

function isQuoteBoundary(source = '', index = -1, quote = '') {
  if (quote !== "'") return true;
  const previous = index > 0 ? source[index - 1] : '';
  const next = index >= 0 && index < source.length - 1 ? source[index + 1] : '';
  return !(isWordChar(previous) && isWordChar(next));
}

function collectQuotedSegments(source = '', quote = '') {
  const segments = [];
  let start = -1;

  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== quote || !isQuoteBoundary(source, i, quote)) continue;
    if (start < 0) {
      start = i;
      continue;
    }
    const candidate = source.slice(start + 1, i).trim();
    if (candidate.split(/\s+/).filter(Boolean).length >= 2) segments.push(candidate);
    start = -1;
  }

  return segments;
}

function findFirstDialogueQuoteIndex(source = '') {
  const indexes = ['“', '"', "'"]
    .flatMap((quote) => {
      const result = [];
      for (let i = 0; i < source.length; i += 1) {
        if (source[i] === quote && isQuoteBoundary(source, i, quote)) result.push(i);
      }
      return result;
    });
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function joinSpokenSegments(segments = []) {
  return segments
    .map((segment, index) => {
      const value = String(segment || '').trim();
      if (index < segments.length - 1 && /[,;:]$/.test(value)) {
        return value.replace(/[,;:]+$/, '.');
      }
      return value;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasNaturalAcknowledgment(dialogueText = '') {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)\b[\s,.!]/i.test(String(dialogueText || '').trim());
}

function scenarioExplicitlySkipsGreeting(openingScene = '') {
  return /\b(no greeting|without greeting|does not acknowledge|doesn't acknowledge|ignores the rep|cuts off the rep|refuses to engage)\b/i.test(String(openingScene || ''));
}

function chooseOpeningAcknowledgment(seed = '', openingScene = '') {
  const scene = String(openingScene || '').toLowerCase();
  const hurried = /\b(time|minutes?|schedule|watch|clock|between patients|running late|rushed|quick|tight)\b/.test(scene);
  const pool = hurried
    ? ['Hi.', 'Hi there.']
    : ['Hi.', 'Hi there.', 'Hey, good to see you.'];
  return pool[deterministicIndex(seed, pool.length)] || 'Hi.';
}

function normalizeOpeningRealism(dialogueText = '', openingScene = '', scenario = {}) {
  let dialogue = normalizeText(dialogueText);
  if (!dialogue) return '';

  dialogue = dialogue
    .replace(/\bi\s+have\s+about\s+10\s+minutes\b/gi, "I've got a few minutes")
    .replace(/\bwhat['’]?s\s+this\s+about\??/gi, 'What did you want to go over?')
    .replace(/\s+/g, ' ')
    .trim();

  if (!hasNaturalAcknowledgment(dialogue) && !scenarioExplicitlySkipsGreeting(openingScene)) {
    const seed = [scenario?.id, scenario?.scenarioId, scenario?.title, openingScene, dialogue].filter(Boolean).join(':');
    dialogue = `${chooseOpeningAcknowledgment(seed, openingScene)} ${dialogue}`.trim();
  }

  return dialogue;
}

function extractQuotedDialogue(text = '') {
  const source = String(text || '').trim();
  if (!source) return '';

  const quoteCandidates = ['“', '"', "'"];
  for (const quote of quoteCandidates) {
    const segments = collectQuotedSegments(source, quote);
    const candidate = joinSpokenSegments(segments);
    if (candidate.split(/\s+/).filter(Boolean).length >= 2) return candidate;
  }

  return '';
}

function extractNarrativeCue(text = '') {
  const source = String(text || '').trim();
  if (!source) return '';

  const firstQuoteIndex = findFirstDialogueQuoteIndex(source);

  if (firstQuoteIndex > 0) {
    return stripOuterPunctuation(source.slice(0, firstQuoteIndex));
  }

  return '';
}

function buildCueFromCanonical(contract = {}) {
  const openingEnvironment = normalizeText(contract?.sceneSetup?.openingEnvironment);
  const openingCueSet = Array.isArray(contract?.sceneSetup?.openingCueSet)
    ? contract.sceneSetup.openingCueSet.filter(Boolean)
    : [];

  if (openingEnvironment && openingCueSet.length > 0) {
    return `${openingEnvironment}. ${openingCueSet.join(', ')}.`.replace(/\.\s*\./g, '.').trim();
  }
  if (openingEnvironment) return openingEnvironment;
  if (openingCueSet.length > 0) return `${openingCueSet.join(', ')}.`;
  return '';
}

function buildDialogueFromCanonical(contract = {}, scenario = {}) {
  return normalizeText(
    contract?.sceneSetup?.openingLine
      || scenario?.openingLine
      || scenario?.opening_line
      || scenario?.initialHcpLine
      || scenario?.opening_scene
      || scenario?.openingScene
  );
}

export function extractScenarioOwnedOpeningTurn(scenario = {}) {
  const contract = normalizeScenarioRuntimeContract(scenario);
  const openingScene = normalizeText(scenario?.openingScene || scenario?.opening_scene);

  const openingCue = extractNarrativeCue(openingScene) || buildCueFromCanonical(contract);
  const rawOpeningDialogue = extractQuotedDialogue(openingScene) || buildDialogueFromCanonical(contract, scenario);
  const openingDialogue = normalizeOpeningRealism(rawOpeningDialogue, openingScene, scenario);

  return {
    cueText: openingCue,
    dialogueText: openingDialogue,
    source: openingScene ? 'scenario_opening_scene' : 'canonical_opening_line',
  };
}

export function hasScenarioOwnedOpeningTurn(scenario = {}) {
  const openingTurn = extractScenarioOwnedOpeningTurn(scenario);
  return Boolean(normalizeText(openingTurn.cueText) || normalizeText(openingTurn.dialogueText));
}
