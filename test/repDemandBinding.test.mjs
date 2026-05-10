import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SOURCE = fs.readFileSync(new URL("../src/components/roleplay/RolePlayChat.jsx", import.meta.url), "utf8");

test("rep demand binding remains anchored to the current responding HCP prompt", () => {
  assert.match(
    SOURCE,
    /updateInterventionSessionState\(interventionStateRef\.current,[\s\S]*hcpPrompt: respondingToTurn\?\.hcpDialogueBefore \|\| "",/,
  );
});

test("demand hold reads active demand from intervention state without changing binding pipeline", () => {
  assert.match(SOURCE, /const activeDemand = interventionStateRef\.current\?\.activeDemand;/);
  assert.match(SOURCE, /activeDemand\?\.isActive/);
  assert.match(SOURCE, /activeDemand\?\.type/);
});
