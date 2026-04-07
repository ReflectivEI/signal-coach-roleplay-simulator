import { normalizeScenarioRuntimeContract } from '../../lib/scenarioNormalization.js';

function normalizeText(value = '') {
  return String(value || '').trim();
}

function stripOuterPunctuation(value = '') {
  return String(value || '').trim().replace(/^[\s:;,.-]+|[\s:;,.-]+$/g, '').trim();
}

function extractQuotedDialogue(text = '') {
  const source = String(text || '').trim();
  if (!source) return '';

  const quoteCandidates = ['“', '"', "'"];
  for (const quote of quoteCandidates) {
    const start = source.indexOf(quote);
    const end = source.lastIndexOf(quote);
    if (start >= 0 && end > start + 12) {
      const candidate = source.slice(start + 1, end).trim();
      if (candidate.split(/\s+/).length >= 4) return candidate;
    }
  }

  return '';
}

function extractNarrativeCue(text = '') {
  const source = String(text || '').trim();
  if (!source) return '';

  const firstQuoteIndexes = ['“', '"', "'"]
    .map((quote) => source.indexOf(quote))
    .filter((index) => index >= 0);
  const firstQuoteIndex = firstQuoteIndexes.length > 0 ? Math.min(...firstQuoteIndexes) : -1;

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
      || scenario?.opening_scene
      || scenario?.openingScene
  );
}

export function extractScenarioOwnedOpeningTurn(scenario = {}) {
  const contract = normalizeScenarioRuntimeContract(scenario);
  const openingScene = normalizeText(scenario?.openingScene || scenario?.opening_scene);

  const openingCue = extractNarrativeCue(openingScene) || buildCueFromCanonical(contract);
  const openingDialogue = extractQuotedDialogue(openingScene) || buildDialogueFromCanonical(contract, scenario);

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
