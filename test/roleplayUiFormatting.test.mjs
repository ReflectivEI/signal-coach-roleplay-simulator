import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatTaxonomyFilterLabel,
  normalizeInvokeResponseText,
} from '../src/lib/roleplayUiFormatting.js';

test('formatTaxonomyFilterLabel humanizes taxonomy values', () => {
  assert.equal(formatTaxonomyFilterLabel('initial_access_prospecting'), 'Initial Access Prospecting');
  assert.equal(formatTaxonomyFilterLabel('access_prior_auth_barrier'), 'Access Prior Auth Barrier');
  assert.equal(formatTaxonomyFilterLabel('All Journey Stages'), 'All Journey Stages');
});

test('normalizeInvokeResponseText handles string and object responses', () => {
  assert.equal(normalizeInvokeResponseText({ response: '  hello world  ' }), 'hello world');
  assert.equal(normalizeInvokeResponseText({ content: { text: '  nested text  ' } }), 'nested text');
});

test('normalizeInvokeResponseText handles arrays and fallback objects', () => {
  assert.equal(normalizeInvokeResponseText({ response: ['One', 'Two'] }), 'One Two');

  const fallback = normalizeInvokeResponseText({ response: { summary: 'abc' } });
  assert.match(fallback, /summary/);
});
