import { test, expect } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:5174";

const cueSelectors = [
  ".hcp-cue-predicted-state",
  ".hcp-cue-openness",
  ".hcp-cue-trajectory",
  ".hcp-cue-risk",
  ".hcp-cue-behavioral-notes",
];

const simulatorUrl = `${BASE_URL}/simulator?scenarioId=built-in-the-assumed-priority&realism=3`;

function hasSubtleResistance(text) {
  return /\b(show me|what|how|need|concrete|specific|practical|before|not|still|risk|concern|workflow|time|patient|data|evidence|fit|useful|relevant|decision)\b/i.test(text);
}

function hasClinicalContext(text) {
  return /\b(patient|patients|clinical|clinic|workflow|practice|data|evidence|safety|risk|access|coverage|staff|implementation|prescribe|therapy|treatment|screen|monitor|discharge|readmission|formulary|case|prior auth|prior authorization|approval|burden|payer)\b/i.test(text);
}

function hasVisibleDialogueQuality(text) {
  const normalized = text.trim();
  if (normalized.length < 25) return false;
  if (/\b(as an ai|language model|chatbot|system prompt|i cannot|i'm here to help)\b/i.test(normalized)) return false;
  if (/\b(the hcp|hcp (looks|glances|leans|nods|crosses|pauses)|stage direction|cue:|predicted state:)\b/i.test(normalized)) return false;
  return hasSubtleResistance(normalized) && hasClinicalContext(normalized);
}

function normalizedDialogue(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function openingFrame(text) {
  return normalizedDialogue(text).split(" ").slice(0, 8).join(" ");
}

function hasMalformedTail(text) {
  return /\bwould\s+(that|this|what|how|who)\b/i.test(text)
    || /,\s*what specific (change|adjustment|step) would\b/i.test(text);
}

function hasRepeatedFrames(dialogues) {
  const frames = dialogues.map(openingFrame).filter((frame) => frame.split(" ").length >= 5);
  return new Set(frames).size !== frames.length;
}

async function submitRepMessageAndReadHcp(page, repMessage) {
  await page.goto(simulatorUrl, { waitUntil: "domcontentloaded" });
  const repInput = page.getByRole("textbox").first();
  await expect(repInput).toBeVisible({ timeout: 30000 });
  await repInput.fill(repMessage);
  await repInput.press("Enter");

  const dialogue = page.locator(".hcp-dialogue").last();
  await expect(dialogue).toBeVisible({ timeout: 45000 });
  return (await dialogue.innerText()).trim();
}

test("HCP cues stay hidden while realistic HCP dialogue renders", async ({ page }) => {
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

  const dialogue = page.locator(".hcp-dialogue").last();
  await expect(dialogue).toBeVisible({ timeout: 45000 });
  const dialogueText = (await dialogue.innerText()).trim();
  const descriptor = page.locator(".hcp-cue-descriptor").last();
  await expect(descriptor).toBeVisible({ timeout: 45000 });
  const descriptorText = (await descriptor.innerText()).trim();

  expect(dialogueText.length).toBeGreaterThan(0);
  expect(descriptorText.length).toBeGreaterThan(0);
  expect(hasVisibleDialogueQuality(dialogueText), dialogueText).toBe(true);

  for (const selector of cueSelectors) {
    await expect(page.locator(selector)).toHaveCount(0);
  }

  const relevantErrors = runtimeErrors.filter((entry) => !/favicon|ResizeObserver/i.test(entry));
  expect(relevantErrors, relevantErrors.join("\n")).toEqual([]);
});

test("first HCP response adapts to different rep openers", async ({ browser }) => {
  const genericPage = await browser.newPage();
  const evidencePage = await browser.newPage();

  const genericDialogue = await submitRepMessageAndReadHcp(genericPage, "hi dr");
  const evidenceDialogue = await submitRepMessageAndReadHcp(
    evidencePage,
    "I want to discuss a study and how the evidence lines up with guidelines and formulary review."
  );

  expect(genericDialogue.length).toBeGreaterThan(0);
  expect(evidenceDialogue.length).toBeGreaterThan(0);
  expect(genericDialogue).not.toEqual(evidenceDialogue);
  expect(hasVisibleDialogueQuality(genericDialogue), genericDialogue).toBe(true);
  expect(hasVisibleDialogueQuality(evidenceDialogue), evidenceDialogue).toBe(true);

  for (const selector of cueSelectors) {
    await expect(genericPage.locator(selector)).toHaveCount(0);
    await expect(evidencePage.locator(selector)).toHaveCount(0);
  }
  await expect(genericPage.locator(".hcp-cue-descriptor").last()).toBeVisible();
  await expect(evidencePage.locator(".hcp-cue-descriptor").last()).toBeVisible();

  await genericPage.close();
  await evidencePage.close();
});

test("access workflow exchange does not repeat or collapse implementation answer", async ({ page }) => {
  await page.goto(simulatorUrl, { waitUntil: "domcontentloaded" });
  const repInput = page.getByRole("textbox").first();
  await expect(repInput).toBeVisible({ timeout: 30000 });

  const sendAndReadLatestHcp = async (message) => {
    const before = await page.locator(".hcp-dialogue").count();
    await repInput.fill(message);
    await repInput.press("Enter");
    await expect(page.locator(".hcp-dialogue")).toHaveCount(before + 1, { timeout: 45000 });
    const dialogue = page.locator(".hcp-dialogue").last();
    await expect(dialogue).toBeVisible({ timeout: 45000 });
    return (await dialogue.innerText()).trim();
  };

  const turns = [];
  turns.push(await sendAndReadLatestHcp("hi dr, can we discuss your prior auth burden and workflow?"));
  turns.push(await sendAndReadLatestHcp("streamline the process"));
  turns.push(await sendAndReadLatestHcp("a new system implementation."));

  for (const text of turns) {
    expect(hasVisibleDialogueQuality(text), text).toBe(true);
    expect(hasMalformedTail(text), text).toBe(false);
  }

  expect(new Set(turns.map(normalizedDialogue)).size).toBe(turns.length);
  expect(hasRepeatedFrames(turns), turns.join("\n---\n")).toBe(false);
  expect(turns[2], turns[2]).toMatch(/\b(implementation|system|workflow|owner|handoff|deploy|rollout)\b/i);
  expect(turns[2], turns[2]).not.toMatch(/what specific (change|adjustment) in the access step/i);

  await expect(page.locator(".hcp-cue-descriptor").last()).toBeVisible();
  for (const selector of cueSelectors) {
    await expect(page.locator(selector)).toHaveCount(0);
  }
});
