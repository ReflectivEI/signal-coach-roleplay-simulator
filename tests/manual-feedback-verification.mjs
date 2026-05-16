import { chromium } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:5174";
const URL = `${BASE_URL}/simulator?scenarioId=built-in-the-assumed-priority&realism=3`;

async function waitForNewHcpDialogue(page, previousCount) {
  const locator = page.locator(".hcp-dialogue");
  await locator.nth(previousCount).waitFor({ state: "visible", timeout: 90000 });
}

async function sendRep(page, text) {
  const input = page.getByRole("textbox").first();
  const before = await page.locator(".hcp-dialogue").count();
  await input.fill(text);
  await input.press("Enter");
  await waitForNewHcpDialogue(page, before);
}

function summarize(text = "", max = 500) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole("textbox").first().waitFor({ state: "visible", timeout: 90000 });

  await sendRep(page, "hi dr, I want to make this useful. What would need to change for this to matter in your clinic?");
  await sendRep(page, "The main point is whether the study changes a real treatment decision for the patients you actually manage.");
  await sendRep(page, "In the subgroup most like your patients, what would you need to see before this earns time?");

  await page.getByRole("button", { name: /End & Get Feedback/i }).click();
  await page.getByRole("button", { name: /Generate Sections 1-8|Regenerate Sections 1-8/i }).click();

  const firstHeading = page.getByRole("heading", { name: /1\) Primary Diagnosis/i }).first();
  await firstHeading.waitFor({ state: "visible", timeout: 120000 });

  const sectionTexts = [];
  const headings = [
    "1) Primary Diagnosis",
    "2) Failure Hierarchy",
    "3) Interaction Consequence",
    "4) What You Did Well",
    "5) What Limited the Interaction",
    "6) What the HCP Was Testing",
    "7) Coaching Direction",
    "8) Evidence / References",
  ];

  for (const heading of headings) {
    const card = page.getByRole("heading", { name: new RegExp(heading.replace(/[()]/g, "\\$&")) }).first().locator("..").locator("..");
    const text = await card.innerText();
    sectionTexts.push({ heading, text });
  }

  const overallAnalyze = page.getByRole("button", { name: /^Analyze$/ }).first();
  await overallAnalyze.click();
  const overallBlock = page.locator("text=Brief rationale").first();
  await overallBlock.waitFor({ state: "visible", timeout: 120000 });
  const overallText = await overallBlock.locator("..").locator("..").innerText();

  const metricAnalyze = page.getByRole("button", { name: /^Analyze$/ }).nth(1);
  await metricAnalyze.click();
  const metricBlock = page.locator("text=Specific evidence from the transcript").first();
  await metricBlock.waitFor({ state: "visible", timeout: 120000 });
  const metricText = await metricBlock.locator("..").locator("..").innerText();

  console.log(JSON.stringify({
    sections: sectionTexts.map((item) => ({
      heading: item.heading,
      length: item.text.length,
      preview: summarize(item.text),
    })),
    overallAnalysis: {
      length: overallText.length,
      preview: summarize(overallText, 700),
    },
    metricAnalysis: {
      length: metricText.length,
      preview: summarize(metricText, 700),
    },
  }, null, 2));
} finally {
  await browser.close();
}
