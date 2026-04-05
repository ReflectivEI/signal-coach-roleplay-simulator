import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCanonicalHcpIdentity } from '../src/components/roleplay/hcpIdentity.js';

test('named hcp identity is preserved from canonical profile name when present', () => {
  const identity = resolveCanonicalHcpIdentity({
    stakeholder: 'Hospital P&T Committee',
    hcpProfile: { name: 'Dr. Maya Patel' },
    hcp_category: 'Formulary committee',
  });

  assert.equal(identity.canonicalHcpDisplayName, 'Dr. Maya Patel');
  assert.equal(identity.hcpIdentitySource, 'scenario.hcpProfile.name');
  assert.equal(identity.hcpFallbackUsed, false);
});

test('generic fallback is only used when no specific identity exists', () => {
  const identity = resolveCanonicalHcpIdentity({
    stakeholder: 'Hospital P&T Committee',
    hcp: 'HCP',
    hcp_category: 'Committee Reviewer',
  });

  assert.equal(identity.canonicalHcpDisplayName, 'Committee Reviewer');
  assert.equal(identity.hcpIdentitySource, 'scenario.hcp_category');
  assert.equal(identity.hcpFallbackUsed, true);
});
