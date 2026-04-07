import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKER_SOURCE = fs.readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8');
const CHAT_SOURCE = fs.readFileSync(new URL('../src/components/roleplay/RolePlayChat.jsx', import.meta.url), 'utf8');

test('worker roleplay boundary enforces shared turn validation before provider invocation', () => {
  assert.match(WORKER_SOURCE, /import \{ validateRoleplayRepTurn \}/);
  assert.match(WORKER_SOURCE, /function enforceRoleplayTurnValidationBoundary/);
  assert.match(WORKER_SOURCE, /ROLEPLAY_TURN_VALIDATION_REQUIRED/);
  assert.match(WORKER_SOURCE, /ROLEPLAY_TURN_BLOCKED/);
  assert.match(WORKER_SOURCE, /blockHcpGeneration: true/);
  assert.match(WORKER_SOURCE, /blockScoring: true/);
  assert.match(WORKER_SOURCE, /blockStateAdvance: true/);

  const openingAuthorityIndex = WORKER_SOURCE.indexOf('const roleplayOpeningAuthority = roleplay ? extractRoleplayOpeningAuthority(prompt) : null');
  const boundaryIndex = WORKER_SOURCE.indexOf('const boundary = enforceRoleplayTurnValidationBoundary(body)');
  const providerIndex = WORKER_SOURCE.indexOf('const requestedProvider = body?.provider');
  const fetchIndex = WORKER_SOURCE.indexOf('const openaiResponse = await fetch(llmUrl');

  assert.ok(openingAuthorityIndex > 0, 'worker must preserve deterministic opening authority before validation');
  assert.ok(boundaryIndex > openingAuthorityIndex, 'worker should validate non-opening roleplay turns after opening authority');
  assert.ok(providerIndex > boundaryIndex, 'provider selection must not occur before roleplay validation');
  assert.ok(fetchIndex > boundaryIndex, 'provider fetch must not occur before roleplay validation');
});

test('current RolePlayChat roleplay provider calls carry shared validation context', () => {
  const roleplayCallCount = (CHAT_SOURCE.match(/roleplay: true/g) || []).length;
  const validationContextCount = (CHAT_SOURCE.match(/roleplayTurnValidation: roleplayTurnValidationContext/g) || []).length;

  assert.equal(roleplayCallCount, 4, 'update this test if a new roleplay provider call is added');
  assert.equal(validationContextCount, roleplayCallCount, 'every roleplay provider call must send validation context');
  assert.match(CHAT_SOURCE, /const roleplayTurnValidationContext = \{/);
  assert.match(CHAT_SOURCE, /latestHcpAsk: respondingToTurn\?\.hcpDialogueBefore/);
  assert.match(CHAT_SOURCE, /repMessage,/);
  assert.match(CHAT_SOURCE, /previousRepMessages: collectRepMessagesForSimilarLatestAsk\(turns, respondingToTurn\?\.hcpDialogueBefore/);
});
