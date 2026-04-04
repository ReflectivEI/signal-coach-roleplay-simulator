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

test("intervention wiring is additive to turn state and audit payload", () => {
  assert.match(SOURCE, /interventionStateRef = useRef\(createInitialInterventionSessionState\(\)\)/);
  assert.match(SOURCE, /demandHoldHistoryRef = useRef\(/);
  assert.match(SOURCE, /buildDemandHoldMessage\(/);
  assert.match(SOURCE, /logAuditEvent\('turn_created',[\s\S]*intervention: interventionSnapshot/);
});
