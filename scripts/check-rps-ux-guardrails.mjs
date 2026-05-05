import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceOfTruthFile = path.join(rootDir, "src/lib/rpsUserInputOptions.ts");
const auditedUiFiles = [
  "src/components/home/ScenarioFilters.jsx",
  "src/pages/PredictiveBuilder.jsx",
  "src/pages/ScenarioBuilder.jsx",
  "src/features/rps/AdaptiveRpsPage.jsx",
  "src/pages/Simulator.jsx",
  "src/components/home/ScenarioDetailModal.jsx",
];

const userFacingUiFiles = [
  ...auditedUiFiles,
  "src/pages/Home.jsx",
  "src/pages/ScenarioLibrary.jsx",
  "src/components/layout/AppHeader.jsx",
].map((relativePath) => path.join(rootDir, relativePath));

const forbiddenLegacyLabels = [
  "Disease State",
  "Specialty",
  "Interaction Pressure",
  "Influence Driver",
  "Behavior Archetype",
  "Decision Orientation",
  "Starting Behavior State",
  "REP Objective",
  "Predictive Seed",
];

const forbiddenPublicCopy = [
  "3-control",
  "three dropdowns",
  "six filters",
  "six controls",
];

const advancedControlLabels = [
  "Advanced Controls",
  "Predictive HCP Seed",
  "Starting Behavior State",
  "Interaction Pressure",
  "Interaction Pressures",
  "Decision Orientation",
  "Behavior Archetype",
  "REP Objective",
  "Influence Driver",
  "Disease State",
  "Specialty",
];

const optionArrayDefinitionPattern = /const\s+[A-Z0-9_]+(?:_OPTIONS|_LABELS)?\s*=\s*\[/g;
const canonicalOptionValueMarkers = [
  "Treating Clinician",
  "Thought Leader",
  "Access Barrier",
  "Competing Priorities",
  "Follow-up / Commitment",
];

function walkDir(directory, fileList = []) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, fileList);
      continue;
    }
    if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function relative(filePath) {
  return path.relative(rootDir, filePath) || filePath;
}

function addIssue(issues, filePath, message) {
  issues.push(`${relative(filePath)}: ${message}`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasRenderedText(content, text) {
  const escaped = escapeRegex(text);
  const patterns = [
    new RegExp(`>\\s*${escaped}\\s*<`, "i"),
    new RegExp(`(?:label|title|aria-label|placeholder)\\s*=\\s*[\"'\"][^\"']*${escaped}[^\"']*[\"'\"]`, "i"),
    new RegExp(`\{\\s*[\"'\"]${escaped}[\"'\"]\\s*\}`, "i"),
  ];

  return patterns.some((pattern) => pattern.test(content));
}

const issues = [];

for (const filePath of userFacingUiFiles) {
  if (!fs.existsSync(filePath)) {
    addIssue(issues, filePath, "expected UI file is missing");
    continue;
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const label of forbiddenLegacyLabels) {
    if (hasRenderedText(content, label)) {
      addIssue(issues, filePath, `forbidden legacy label found: \"${label}\"`);
    }
  }

  for (const copy of forbiddenPublicCopy) {
    if (hasRenderedText(content, copy)) {
      addIssue(issues, filePath, `forbidden public copy found: \"${copy}\"`);
    }
  }
}

for (const relativePath of auditedUiFiles) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, "utf8");
  for (const label of advancedControlLabels) {
    if (hasRenderedText(content, label)) {
      addIssue(issues, filePath, `possible advanced/selectable regression found: \"${label}\"`);
    }
  }
}

const sourceFiles = walkDir(path.join(rootDir, "src"));
for (const filePath of sourceFiles) {
  if (filePath === sourceOfTruthFile) continue;

  const content = fs.readFileSync(filePath, "utf8");
  const hasOptionDefinition = optionArrayDefinitionPattern.test(content);
  optionArrayDefinitionPattern.lastIndex = 0;
  const looksCanonical = canonicalOptionValueMarkers.some((marker) => content.includes(marker));

  if (hasOptionDefinition && looksCanonical) {
    addIssue(issues, filePath, "possible parallel public option array defined outside src/lib/rpsUserInputOptions.ts");
  }
}

if (issues.length > 0) {
  console.error("RPS UX guardrail check failed:\n");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("RPS UX guardrail check passed.");