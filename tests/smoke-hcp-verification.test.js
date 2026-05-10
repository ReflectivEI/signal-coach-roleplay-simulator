import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:5174";

const cueSelectors = [
  ".hcp-cue-predicted-state",
  ".hcp-cue-openness",
  ".hcp-cue-trajectory",
  ".hcp-cue-risk",
  ".hcp-cue-behavioral-notes",
];

function hasSubtleResistance(text) {
  return /\b(show me|what|how|need|concrete|specific|practical|before|not|still|risk|concern|workflow|time|patient|data|evidence|fit|useful|relevant|decision)\b/i.test(text);
}

function hasClinicalContext(text) {
  return /\b(patient|patients|clinical|clinic|workflow|practice|data|evidence|safety|risk|access|coverage|staff|implementation|prescribe|therapy|treatment|screen|monitor|discharge|readmission|formulary|case)\b/i.test(text);
}

function hasVisibleDialogueQuality(text) {
  const normalized = text.trim();
  if (normalized.length < 25) return false;
  if (/\b(as an ai|language model|chatbot|system prompt|i cannot|i'm here to help)\b/i.test(normalized)) return false;
  if (/\b(the hcp|hcp (looks|glances|leans|nods|crosses|pauses)|stage direction|cue:|predicted state:)\b/i.test(normalized)) return false;
  return hasSubtleResistance(normalized) && hasClinicalContext(normalized);
}

test("visible HCP cues align with realistic HCP dialogue", async ({ page }) => {
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message);
  });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Start Scenario/i }).first()).toBeVisible({ timeout: 30000 });

  await page.getByRole("button", { name: /Start Scenario/i }).first().click();

  const repInput = page.getByRole("textbox").first();
  await expect(repInput).toBeVisible({ timeout: 30000 });
  await repInput.fill(
    "Thanks for making a few minutes. I want to understand what would make this useful in your clinic before I share any data."
  );
  await repInput.press("Enter");

  for (const selector of cueSelectors) {
    const cue = page.locator(selector).first();
    await expect(cue).toBeVisible({ timeout: 45000 });
    const cueText = (await cue.innerText()).trim();
    expect(cueText.replace(/^-\s*[^:]+:\s*/, "").trim().length).toBeGreaterThan(0);
  }

  const dialogue = page.locator(".hcp-dialogue").last();
  await expect(dialogue).toBeVisible({ timeout: 45000 });
  const dialogueText = (await dialogue.innerText()).trim();

  expect(dialogueText.length).toBeGreaterThan(0);
  expect(hasVisibleDialogueQuality(dialogueText), dialogueText).toBe(true);

  const cueBlockText = await page.locator(".hcp-cue-predicted-state").last().locator("xpath=ancestor::div[contains(@class, 'text-xs')][1]").innerText();
  expect(cueBlockText).toMatch(/Predicted State:/);
  expect(cueBlockText).toMatch(/Openness:/);
  expect(cueBlockText).toMatch(/Trajectory:/);
  expect(cueBlockText).toMatch(/Risk:/);
  expect(cueBlockText).toMatch(/Behavioral Notes:/);

  const relevantErrors = runtimeErrors.filter((entry) => !/favicon|ResizeObserver/i.test(entry));
  expect(relevantErrors, relevantErrors.join("\n")).toEqual([]);
});
