function normalize(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isGenericLabel(value = "") {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return true;
  return /^(hcp|health care professional|healthcare professional|hospital p\s*&\s*t committee|p\s*&\s*t committee|committee|formulary committee)$/i.test(normalized);
}

export function resolveCanonicalHcpIdentity(scenario = {}) {
  const directName = normalize(
    scenario?.hcpProfile?.name
    || scenario?.hcp_profile?.name
    || scenario?.hcpIdentity?.name
    || scenario?.hcp_identity?.name
    || scenario?.metadataEnvelope?.hcpProfile?.name
  );
  if (directName && !isGenericLabel(directName)) {
    return {
      canonicalHcpDisplayName: directName,
      hcpIdentitySource: "scenario.hcpProfile.name",
      hcpFallbackUsed: false,
    };
  }

  const stakeholderName = normalize(scenario?.stakeholder);
  if (stakeholderName && !isGenericLabel(stakeholderName)) {
    return {
      canonicalHcpDisplayName: stakeholderName,
      hcpIdentitySource: "scenario.stakeholder",
      hcpFallbackUsed: false,
    };
  }

  const hcpName = normalize(scenario?.hcp);
  if (hcpName && !isGenericLabel(hcpName)) {
    return {
      canonicalHcpDisplayName: hcpName,
      hcpIdentitySource: "scenario.hcp",
      hcpFallbackUsed: false,
    };
  }

  const categoryName = normalize(scenario?.hcp_category);
  if (categoryName) {
    return {
      canonicalHcpDisplayName: categoryName,
      hcpIdentitySource: "scenario.hcp_category",
      hcpFallbackUsed: true,
    };
  }

  return {
    canonicalHcpDisplayName: "HCP",
    hcpIdentitySource: "runtime_default",
    hcpFallbackUsed: true,
  };
}
