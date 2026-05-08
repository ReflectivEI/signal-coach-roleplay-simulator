import fs from "node:fs";
import path from "node:path";

import { ALL_SCENARIOS } from "../src/lib/roleplay-v2/scenarioCatalog.js";
import { enrichScenarioWithTaxonomy } from "../src/lib/roleplay-v2/scenarioTaxonomy.js";

const rows = ALL_SCENARIOS.map((scenario) => {
  const enriched = enrichScenarioWithTaxonomy(scenario);
  return {
    id: enriched.id,
    title: enriched.title,
    category: enriched.category,
    difficulty: enriched.difficulty,
    journeyStage: enriched.taxonomy?.journeyStage,
    interactionPressure: enriched.taxonomy?.interactionPressure,
    hcpPersona: enriched.taxonomy?.hcpPersona,
    complianceMode: enriched.taxonomy?.complianceMode,
    family: enriched.metadataEnvelope?.family,
    personaPrimary: enriched.metadataEnvelope?.persona_primary,
    chapterStage: enriched.metadataEnvelope?.chapter_stage,
    metadataSource: enriched.metadataEnvelope?.metadata_source,
  };
});

const report = {
  generated_at: new Date().toISOString(),
  total_scenarios: rows.length,
  rows,
};

const outputDir = path.resolve("docs/artifacts");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "taxonomy-coverage-report.json");
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`Generated taxonomy coverage report: ${outputPath}`);
