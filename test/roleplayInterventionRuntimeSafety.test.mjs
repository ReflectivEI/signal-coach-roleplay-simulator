import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE = fs.readFileSync(new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url), "utf8");

test("intervention runtime is feature-flagged off by default", () => {
  assert.match(
    SOURCE,
    /const ENABLE_V2_INTERVENTION_RUNTIME = import\.meta\.env\.VITE_ROLEPLAY_V2_INTERVENTION_ENABLED === "true";/,
  );
  assert.match(
    SOURCE,
    /const ENABLE_V2_INTERVENTION_UI = import\.meta\.env\.VITE_ROLEPLAY_V2_INTERVENTION_UI === "true";/,
  );
});

test("unresolved demand control is always generation-binding in live runtime", () => {
  assert.match(
    SOURCE,
    /const unresolvedDemandActive = Boolean\([\s\S]*activeDemand\?\.isActive[\s\S]*activeDemand\?\.type[\s\S]*\);/,
  );
  assert.doesNotMatch(
    SOURCE,
    /const unresolvedDemandActive = ENABLE_V2_INTERVENTION_RUNTIME/,
  );
  assert.match(
    SOURCE,
    /const demandHoldActive = !overrideExit[\s\S]*activeDemand\?\.isActive[\s\S]*activeDemand\?\.type;/,
  );
});

test("demand hold hard-lock blocks post-processor rewrites from softening unresolved asks", () => {
  assert.match(
    SOURCE,
    /const demandHoldHardLockActive = demandHoldActive && demandHoldOverrodeProgression;/,
  );
  assert.match(
    SOURCE,
    /const rewriteAuthority = \(!overrideExit && nextHcpState !== "disengaged" && !demandHoldHardLockActive\)/,
  );
  assert.match(
    SOURCE,
    /if \(demandHoldHardLockActive && nextHcpState !== "disengaged"\) \{[\s\S]*nextHcpDialogue = lockedDemandLine;[\s\S]*\}/,
  );
});

test("intervention wiring is additive to turn state and audit payload", () => {
  assert.match(SOURCE, /interventionStateRef = useRef\(createInitialInterventionSessionState\(\)\)/);
  assert.match(SOURCE, /demandHoldHistoryRef = useRef\(/);
  assert.match(SOURCE, /buildDemandHoldDirective\(/);
  assert.match(SOURCE, /logAuditEvent\('turn_created',[\s\S]*intervention: interventionSnapshot/);
});
