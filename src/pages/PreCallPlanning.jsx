// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardList, Plus, FileText, Trash2, Info, Loader2, Wand2, ChevronDown, ChevronUp, Download, Sparkles, CheckCircle2 } from "lucide-react";
import { createPageUrl } from "@/utils";
import { ENABLEMENT_HUB_SPOKES } from "@/lib/enablementHub";
import { buildFieldCoachingGrounding } from "@/lib/fieldCoachingGuidance";

const REQUIRED_AI_FIELDS = ["hcp_name", "specialty", "disease_state"];
const LOCAL_STORAGE_KEY = "reflectivai-precall-plans";

const PLAN_SECTION_CONFIG = [
  {
    key: "objectives",
    label: "Call Objectives",
    shortLabel: "Objectives",
    placeholder: "Primary outcomes you want from this discussion.",
    emptyState: [
      "Clarify the HCP's current perspective and success criteria.",
      "Advance the conversation toward one concrete next step.",
    ],
    aiPrompt: (context) => `You are a pharmaceutical sales planning assistant. Based on this context: ${context}\n\nReturn exactly 3 concise call objectives.\nFormatting rules:\n- Plain text only\n- One bullet per line beginning with \"- \"\n- Each bullet must begin with an action verb\n- No extra headers or commentary`,
  },
  {
    key: "key_messages",
    label: "Key Messages",
    shortLabel: "Messages",
    placeholder: "Value points, evidence themes, and talk tracks to land.",
    emptyState: [
      "Connect the conversation to one HCP-specific value point.",
      "Anchor your message to a practical patient or workflow outcome.",
    ],
    aiPrompt: (context) => `You are a pharmaceutical sales planning assistant. Based on this context: ${context}\n\nReturn exactly 3 key messages tailored to the HCP.\nFormatting rules:\n- Plain text only\n- One bullet per line beginning with \"- \"\n- Each bullet must be no more than 22 words\n- Focus on value, relevance, and evidence\n- No extra headers or commentary`,
  },
  {
    key: "anticipated_objections",
    label: "Anticipated Objections",
    shortLabel: "Objections",
    placeholder: "Likely concerns and your planned responses.",
    emptyState: [
      "Concern: Access, staffing, or workflow burden may limit uptake.",
      "Response: Prepare one concise evidence-based answer plus one practical support step.",
    ],
    aiPrompt: (context) => `You are a pharmaceutical sales planning assistant. Based on this context: ${context}\n\nReturn exactly 3 anticipated objections with response strategies.\nFormatting rules:\n- Plain text only\n- For each objection use two lines in this format:\nConcern: ...\nResponse: ...\n- Put a blank line between each objection block\n- No markdown symbols, bullets, or extra headers`,
  },
  {
    key: "notes",
    label: "Discussion Notes & Next-Step Cues",
    shortLabel: "Notes",
    placeholder: "Operational reminders, follow-up items, or context worth remembering.",
    emptyState: [
      "Document any payer, staffing, or patient-mix context that should shape your approach.",
      "Capture the owner and timing for the best next step you want to secure.",
    ],
    aiPrompt: null,
  },
];

const defaultForm = {
  hcp_name: "",
  specialty: "",
  disease_state: "",
  objectives: "",
  key_messages: "",
  anticipated_objections: "",
  notes: "",
};

function renderTooltipButton({ children, disabled, message, ...props }) {
  if (!disabled) {
    return <button {...props}>{children}</button>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <button {...props} disabled>
            {children}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{message}</TooltipContent>
    </Tooltip>
  );
}

function normalizeText(value = "") {
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/```[\w-]*\n?|\n?```/g, "")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitNormalizedLines(value = "") {
  return normalizeText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanListEntry(line = "") {
  return line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
}

function normalizeSentence(line = "") {
  const cleaned = cleanListEntry(line)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (!cleaned) return "";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function normalizeBulletText(value = "") {
  const lines = splitNormalizedLines(value)
    .map(normalizeSentence)
    .filter(Boolean);

  if (!lines.length) return "";

  const dedupedLines = lines.filter((line, index) => lines.findIndex((entry) => entry.toLowerCase() === line.toLowerCase()) === index);
  return dedupedLines.map((line) => `- ${line}`).join("\n");
}

function normalizeObjectionText(value = "") {
  const lines = splitNormalizedLines(value);
  if (!lines.length) return "";

  const blocks = [];
  let current = { concern: "", response: "" };
  const startsLikeConcern = (line = "") => /^(concern|objection|pushback|risk|barrier)\s*:/i.test(line);
  const startsLikeResponse = (line = "") => /^(response|approach|strategy|planned response|talk track|rebuttal)\s*:/i.test(line);

  const flush = () => {
    if (current.concern || current.response) {
      blocks.push({
        concern: normalizeSentence(current.concern || "Potential concern to prepare for"),
        response: normalizeSentence(current.response || "Prepare a concise, evidence-based response tied to workflow or patient impact"),
      });
      current = { concern: "", response: "" };
    }
  };

  lines.forEach((rawLine) => {
    const line = cleanListEntry(rawLine);
    if (!line) return;

    if (startsLikeConcern(line)) {
      if (current.concern && current.response) flush();
      current.concern = line.replace(/^(concern|objection|pushback|risk|barrier)\s*:/i, "").trim();
      return;
    }

    if (startsLikeResponse(line)) {
      current.response = line.replace(/^(response|approach|strategy|planned response|talk track|rebuttal)\s*:/i, "").trim();
      return;
    }

    const paired = line.match(/^(.*?)(?:\s*(?:planned response|response|approach|strategy)\s*:\s*|\s*[—–-]\s*|\s+>\s+)(.*)$/i);
    if (!current.concern && paired && paired[1] && paired[2]) {
      current.concern = paired[1].trim();
      current.response = paired[2].trim();
      flush();
      return;
    }

    if (!current.concern) {
      current.concern = line;
    } else if (!current.response) {
      current.response = line;
      flush();
    } else {
      flush();
      current.concern = line;
    }
  });

  flush();

  if (!blocks.length) return "";

  const dedupedBlocks = blocks.filter((block, index) => {
    const key = block.concern.toLowerCase();
    return blocks.findIndex((candidate) => candidate.concern.toLowerCase() === key) === index;
  });

  return dedupedBlocks
    .map((block) => [
      `Concern: ${block.concern || "Potential concern to prepare for."}`,
      `Response: ${block.response || "Prepare a concise, evidence-based response tied to workflow or patient impact."}`,
    ].join("\n"))
    .join("\n\n");
}

function normalizePlan(form) {
  return {
    ...form,
    hcp_name: normalizeText(form.hcp_name),
    specialty: normalizeText(form.specialty),
    disease_state: normalizeText(form.disease_state),
    objectives: normalizeBulletText(form.objectives),
    key_messages: normalizeBulletText(form.key_messages),
    anticipated_objections: normalizeObjectionText(form.anticipated_objections),
    notes: normalizeBulletText(form.notes),
  };
}

function parseBulletSection(value = "", fallback = []) {
  const normalized = normalizeBulletText(value);
  const items = splitNormalizedLines(normalized).map(cleanListEntry).filter(Boolean);
  return items.length ? items : fallback;
}

function parseObjectionSection(value = "", fallback = []) {
  const normalized = normalizeObjectionText(value);
  const lines = splitNormalizedLines(normalized);
  const blocks = [];
  let current = { concern: "", response: "" };

  lines.forEach((line) => {
    if (/^concern\s*:/i.test(line)) {
      if (current.concern || current.response) {
        blocks.push({ ...current });
        current = { concern: "", response: "" };
      }
      current.concern = line.replace(/^concern\s*:/i, "").trim();
    } else if (/^response\s*:/i.test(line)) {
      current.response = line.replace(/^response\s*:/i, "").trim();
      blocks.push({ ...current });
      current = { concern: "", response: "" };
    }
  });

  if (current.concern || current.response) blocks.push(current);
  const dedupedBlocks = blocks.filter((block, index) => {
    const key = `${block.concern}`.toLowerCase();
    return blocks.findIndex((candidate) => `${candidate.concern}`.toLowerCase() === key) === index;
  });

  return dedupedBlocks.length ? dedupedBlocks : fallback;
}

function getStructuredPlan(plan) {
  return {
    objectives: parseBulletSection(plan.objectives, PLAN_SECTION_CONFIG.find((section) => section.key === "objectives")?.emptyState || []),
    key_messages: parseBulletSection(plan.key_messages, PLAN_SECTION_CONFIG.find((section) => section.key === "key_messages")?.emptyState || []),
    anticipated_objections: parseObjectionSection(plan.anticipated_objections, [
      {
        concern: "Access, staffing, or competing priorities could slow adoption.",
        response: "Prepare one evidence point plus one operational support step that lowers friction.",
      },
    ]),
    notes: parseBulletSection(plan.notes, PLAN_SECTION_CONFIG.find((section) => section.key === "notes")?.emptyState || []),
  };
}

async function createPdfDocument() {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
}

function drawPdfHeader(doc, title, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 18, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(187, 247, 246);
  doc.text(subtitle, 18, 24);
}

function ensurePdfSpace(doc, y, neededHeight, margin = 18) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + neededHeight <= pageHeight - margin) return y;
  doc.addPage();
  return margin;
}

function drawPdfMetaCard(doc, plan, y) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardX = 18;
  const cardWidth = pageWidth - 36;

  doc.setFillColor(247, 250, 252);
  doc.setDrawColor(173, 230, 226);
  doc.roundedRect(cardX, y, cardWidth, 25, 5, 5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 51, 77);
  doc.setFontSize(14);
  doc.text(plan.hcp_name || "Pre-Call Planning Template", cardX + 5, y + 8);

  const metaItems = [
    { label: "Specialty", value: plan.specialty || "Open field" },
    { label: "Disease State", value: plan.disease_state || "Open field" },
    { label: "Created", value: plan.created_date ? format(new Date(plan.created_date), "MMM d, yyyy") : format(new Date(), "MMM d, yyyy") },
  ];

  const columnWidth = (cardWidth - 12) / 3;
  metaItems.forEach((item, index) => {
    const x = cardX + 5 + (columnWidth * index);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(57, 172, 172);
    doc.setFontSize(8);
    doc.text(item.label.toUpperCase(), x, y + 15);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.text(item.value, x, y + 20);
  });

  return y + 32;
}

function drawPdfListSection(doc, label, items, y) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const x = 18;
  const width = pageWidth - 36;
  const contentHeight = items.reduce((total, item) => {
    const lines = doc.splitTextToSize(item, width - 14);
    return total + (lines.length * 5) + 3;
  }, 0);
  const estimatedHeight = Math.max(24, 14 + contentHeight);

  y = ensurePdfSpace(doc, y, estimatedHeight + 6);

  doc.setDrawColor(191, 219, 254);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, width, estimatedHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(26, 51, 77);
  doc.text(label, x + 5, y + 8);

  let cursorY = y + 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);

  items.forEach((item) => {
    const lines = doc.splitTextToSize(item, width - 14);
    cursorY = ensurePdfSpace(doc, cursorY, (lines.length * 5) + 4);
    doc.setFillColor(57, 172, 172);
    doc.circle(x + 6, cursorY - 1, 0.8, "F");
    doc.text(lines, x + 10, cursorY + 1);
    cursorY += (lines.length * 5) + 3;
  });

  return Math.max(y + estimatedHeight + 6, cursorY + 2);
}

function drawPdfObjectionSection(doc, blocks, y) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const x = 18;
  const width = pageWidth - 36;
  const contentHeight = blocks.reduce((total, block, index) => {
    const concernLines = doc.splitTextToSize(`Concern ${index + 1}: ${block.concern}`, width - 10);
    const responseLines = doc.splitTextToSize(`Planned response: ${block.response}`, width - 14);
    return total + (concernLines.length * 5) + (responseLines.length * 5) + 4;
  }, 0);
  const estimatedHeight = Math.max(30, 16 + contentHeight);

  y = ensurePdfSpace(doc, y, estimatedHeight + 6);

  doc.setDrawColor(250, 204, 21);
  doc.setFillColor(255, 252, 235);
  doc.roundedRect(x, y, width, estimatedHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(120, 53, 15);
  doc.text("Anticipated Objections", x + 5, y + 8);

  let cursorY = y + 14;
  blocks.forEach((block, index) => {
    const concernLines = doc.splitTextToSize(`Concern ${index + 1}: ${block.concern}`, width - 10);
    const responseLines = doc.splitTextToSize(`Planned response: ${block.response}`, width - 14);
    cursorY = ensurePdfSpace(doc, cursorY, (concernLines.length + responseLines.length) * 5 + 7);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(146, 64, 14);
    doc.text(concernLines, x + 5, cursorY);
    cursorY += concernLines.length * 5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 53, 15);
    doc.text(responseLines, x + 8, cursorY + 1);
    cursorY += (responseLines.length * 5) + 4;
  });

  return Math.max(y + estimatedHeight + 6, cursorY + 2);
}

async function exportPlanPdf(plan) {
  const doc = await createPdfDocument();
  const structured = getStructuredPlan(plan);
  const pageWidth = doc.internal.pageSize.getWidth();

  drawPdfHeader(doc, "Pre-Call Plan", "ReflectivAI · Signal Intelligence™ field-ready discussion brief");
  let y = drawPdfMetaCard(doc, plan, 38);

  y = drawPdfListSection(doc, "Call Objectives", structured.objectives, y);
  y = drawPdfListSection(doc, "Key Messages", structured.key_messages, y);
  y = drawPdfObjectionSection(doc, structured.anticipated_objections, y);
  y = drawPdfListSection(doc, "Discussion Notes & Next-Step Cues", structured.notes, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Prepared for in-field planning and aligned with the saved plan view.", pageWidth / 2, 288, { align: "center" });

  const safeName = (plan.hcp_name || "latest-plan").trim().replace(/\s+/g, "-").toLowerCase() || "latest-plan";
  doc.save(`pre-call-plan-${safeName}.pdf`);
}

async function exportTemplatePdf() {
  const doc = await createPdfDocument();
  const pageWidth = doc.internal.pageSize.getWidth();
  const x = 18;
  const width = pageWidth - 36;

  drawPdfHeader(doc, "Pre-Call Planning Template", "ReflectivAI · Blank field worksheet aligned to the in-app planning format");

  doc.setFillColor(247, 250, 252);
  doc.setDrawColor(173, 230, 226);
  doc.roundedRect(x, 38, width, 38, 5, 5, "FD");
  [
    { label: "HCP Name", y: 48 },
    { label: "Specialty", y: 59 },
    { label: "Disease State", y: 70 },
  ].forEach(({ label, y: lineY }) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 51, 77);
    doc.setFontSize(9);
    doc.text(label, x + 5, lineY - 2);
    doc.setDrawColor(148, 163, 184);
    doc.line(x + 32, lineY - 2, x + width - 5, lineY - 2);
  });

  const sections = [
    { label: "Call Objectives", hint: "Capture 2-3 outcomes you want from the conversation.", lines: 5 },
    { label: "Key Messages", hint: "Write value messages, evidence anchors, and customer-relevant talking points.", lines: 6 },
    { label: "Anticipated Objections & Planned Responses", hint: "Document likely concerns and how you will respond.", lines: 7 },
    { label: "Discussion Notes & Next-Step Cues", hint: "Add reminders, context, follow-up items, and the commitment you want to secure.", lines: 7 },
  ];

  let y = 78;
  sections.forEach((section) => {
    const sectionHeight = 16 + (section.lines * 8);
    y = ensurePdfSpace(doc, y, sectionHeight + 8);
    doc.setDrawColor(191, 219, 254);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, sectionHeight, 4, 4, "FD");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 51, 77);
    doc.setFontSize(10);
    doc.text(section.label, x + 5, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(section.hint, x + 5, y + 13);

    let lineY = y + 20;
    for (let i = 0; i < section.lines; i += 1) {
      doc.setDrawColor(203, 213, 225);
      doc.line(x + 5, lineY, x + width - 5, lineY);
      lineY += 8;
    }

    y += sectionHeight + 8;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Use this template for handwritten or offline planning. It mirrors the saved/exported in-app plan structure.", pageWidth / 2, 288, { align: "center" });
  doc.save("pre-call-plan-template.pdf");
}

function PlanSectionCard({ title, children, tone = "default" }) {
  const tones = {
    default: "border-slate-200 bg-white",
    teal: "border-teal-200 bg-teal-50/50",
    amber: "border-amber-200 bg-amber-50/70",
  };

  return (
    <div className={`rounded-2xl border p-4 pt-5 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function getPlanHighlights(structured) {
  return [
    structured.objectives[0],
    structured.key_messages[0],
    structured.anticipated_objections[0]?.concern,
  ].filter(Boolean).slice(0, 2);
}

export default function PreCallPlanning() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [plans, setPlans] = useState([]);
  const [aiGenerating, setAiGenerating] = useState(null);
  const [predictiveInputs, setPredictiveInputs] = useState({ prescribing_habit: "", access_barrier: "" });
  const [predictiveTips, setPredictiveTips] = useState([]);
  const [expandedPlan, setExpandedPlan] = useState(null);
  const isLoading = false;

  useEffect(() => {
    try {
      const cachedTips = JSON.parse(localStorage.getItem("precall-predictive-tips") || "[]");
      if (Array.isArray(cachedTips) && cachedTips.length > 0) {
        setPredictiveTips(cachedTips.slice(0, 3));
      }
    } catch {}

    try {
      const cachedPlans = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
      if (Array.isArray(cachedPlans)) {
        setPlans(cachedPlans);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  const hasAllAiFields = useMemo(
    () => REQUIRED_AI_FIELDS.every((field) => String(form[field] || "").trim()),
    [form]
  );
  const aiAssistDisabled = aiGenerating !== null || !hasAllAiFields;

  const aiAssist = async (field) => {
    const section = PLAN_SECTION_CONFIG.find((item) => item.key === field);
    if (!hasAllAiFields || !section?.aiPrompt) return;

    setAiGenerating(field);
    const context = [
      `HCP: ${form.hcp_name || "unknown"}`,
      `Specialty: ${form.specialty || "unknown"}`,
      `Disease state: ${form.disease_state || "unknown"}`,
      `Current objectives: ${form.objectives || "none"}`,
      `Current key messages: ${form.key_messages || "none"}`,
    ].join(", ");

    try {
      const groundedPrompt = `${buildFieldCoachingGrounding({
        surface: `pre_call_planning_${field}`,
        hcpType: form.hcp_name || "",
        specialty: form.specialty || "",
        diseaseState: form.disease_state || "",
        challenge: field,
        customNotes: [
          "Preserve client-specific product, company, and selling-model customization in the generated plan.",
          "Keep the output field-usable, compliant, and grounded in Signal Intelligence behaviors.",
        ],
      })}

${section.aiPrompt(context)}`;
      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: groundedPrompt }),
      });
      const data = await res.json();
      let responseText = data.response || data.text || data.content || "";
      responseText = normalizeText(responseText);

      const formattedValue = field === "anticipated_objections"
        ? normalizeObjectionText(responseText)
        : normalizeBulletText(responseText);

      setForm((prev) => ({ ...prev, [field]: formattedValue }));
    } catch {
      setForm((prev) => ({
        ...prev,
        [field]: field === "anticipated_objections"
          ? normalizeObjectionText("Concern: AI service unavailable.\nResponse: Draft this section manually.")
          : normalizeBulletText("- AI service unavailable. Please complete this section manually."),
      }));
    }

    setAiGenerating(null);
  };

  const generatePredictiveTips = () => {
    const habit = predictiveInputs.prescribing_habit.toLowerCase();
    const barrier = predictiveInputs.access_barrier.toLowerCase();
    const tips = [];

    if (habit.includes("older") || habit.includes("established") || habit.includes("stable")) {
      tips.push("Lead with switch criteria and one outcome-based rationale for patients who may be appropriate for optimization.");
    } else {
      tips.push("Open with a patient-segment opportunity and one specialty-specific use case that feels immediately relevant.");
    }

    if (barrier.includes("prior") || barrier.includes("pa") || barrier.includes("access")) {
      tips.push("Prepare a brief access workflow explanation and bring one payer-support resource that reduces implementation friction.");
    } else if (barrier.includes("time") || barrier.includes("staff")) {
      tips.push("Use a concise 90-second value narrative and offer a low-burden follow-up path for the broader care team.");
    } else {
      tips.push("Map the most likely objection in advance and connect your response to a measurable patient or workflow benefit.");
    }

    tips.push("Close by confirming a specific next step, the owner, and the expected timing before the conversation ends.");
    const nextTips = tips.slice(0, 3);
    setPredictiveTips(nextTips);
    localStorage.setItem("precall-predictive-tips", JSON.stringify(nextTips));
  };

  const createPlan = (data) => {
    const normalized = normalizePlan(data);
    setPlans((prev) => [{
      ...normalized,
      id: Date.now().toString(),
      created_date: new Date().toISOString(),
      status: "draft",
    }, ...prev]);
    setShowForm(false);
    setExpandedPlan(null);
    setForm(defaultForm);
  };

  const deletePlan = (id) => setPlans((prev) => prev.filter((plan) => plan.id !== id));

  return (
    <TooltipProvider>
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <div className="mb-6 rounded-[28px] border border-slate-200 bg-gradient-to-r from-[#0f172a] via-[#13263f] to-[#154955] p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-inner">
                  <ClipboardList className="h-6 w-6 text-teal-200" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-200">Call strategy hub</p>
                  <h1 className="mt-1 text-3xl font-bold text-white">Pre-Call Planning</h1>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200">
                Structure call objectives, pressure-test likely objections, and package a field-ready discussion plan before the HCP conversation starts.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Plan status", value: plans.length > 0 ? `${plans.length}` : "0", sub: "saved plans" },
                  { label: "AI assist", value: "3", sub: "draftable sections" },
                  { label: "Prep mode", value: "Live", sub: "field-ready workflow" },
                  { label: "Best use", value: "HCP", sub: "pre-meeting prep" },
                ].map((item) => (
                  <div key={item.label} className="flex min-h-[126px] flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{item.label}</p>
                    <p className="mt-3 text-xl font-bold text-white">{item.value}</p>
                    <p className="mt-2 text-xs text-slate-400">{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">Hub and spoke routing</p>
              <div className="mt-4 space-y-3">
                {ENABLEMENT_HUB_SPOKES.filter((spoke) => ["performance", "learning", "reports"].includes(spoke.id)).map((spoke) => (
                  <Link key={spoke.id} to={createPageUrl(spoke.page)} className="block rounded-2xl border border-white/10 bg-slate-950/20 p-4 transition-all hover:border-teal-300/60 hover:bg-slate-950/30">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-200">{spoke.label}</p>
                    <p className="text-sm font-semibold text-white">{spoke.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">{spoke.summary}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-gray-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pre-Call Planning</h1>
              <p className="text-sm text-gray-600">Prepare for your HCP conversations with one consistent save and export workflow.</p>
            </div>
          </div>
          <Button className="h-10 min-w-[140px] border border-teal-500 bg-teal-500 text-white shadow-sm hover:bg-teal-600" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Plan
          </Button>
        </div>

        <div className="mb-6 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
          <p className="text-sm text-gray-600">
            <strong>Coaching assistance only.</strong> Pre-Call Plans help you think through your approach and prepare for HCP conversations. Saved plans and exported PDFs now share the same structured format.
          </p>
        </div>

        {showForm && (
          <Card className="mb-7 border-teal-200 shadow-sm">
            <CardContent className="space-y-4 p-5 md:p-6">
              <div className="flex gap-3 rounded-2xl border border-teal-200 bg-[#e6f7f7] p-4">
                <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-700" />
                <div>
                  <p className="text-sm font-semibold text-[#1A334D]">AI Assistance unlocks once HCP Name, Specialty, and Disease State are entered.</p>
                  <p className="mt-1 text-xs text-slate-600">AI responses follow structured parsing rules so the saved plan and exported PDF stay aligned and easy to read.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {[
                  { key: "hcp_name", label: "HCP Name", placeholder: "Dr. Smith" },
                  { key: "specialty", label: "Specialty", placeholder: "Oncology" },
                  { key: "disease_state", label: "Disease State", placeholder: "HIV" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <p className="text-[11px] font-medium text-teal-700">Required for AI Assist</p>
                    <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />
                  </div>
                ))}
              </div>

              {PLAN_SECTION_CONFIG.map(({ key, label, placeholder, aiPrompt }) => (
                <div key={key} className="space-y-2">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div>
                      <Label>{label}</Label>
                      <p className="text-[11px] text-slate-500">
                        {key === "anticipated_objections"
                          ? "Use Concern / Response pairs."
                          : "Use one concise bullet per line for the cleanest saved and exported formatting."}
                      </p>
                    </div>
                    {aiPrompt ? renderTooltipButton({
                      type: "button",
                      onClick: () => aiAssist(key),
                      disabled: aiAssistDisabled,
                      message: "Complete required fields to enable AI Assist",
                      className: "flex items-center gap-1.5 rounded-full border border-teal-300 bg-teal-100/70 px-2.5 py-1 text-xs font-semibold text-teal-800 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50",
                      children: aiGenerating === key ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</> : <><Wand2 className="h-3 w-3" /> AI Assist</>,
                    }) : null}
                  </div>
                  <Textarea
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className={aiGenerating === key ? "opacity-50" : ""}
                  />
                </div>
              ))}

              <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Predictive Prep Assistant</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Input
                    value={predictiveInputs.prescribing_habit}
                    onChange={(e) => setPredictiveInputs((prev) => ({ ...prev, prescribing_habit: e.target.value }))}
                    placeholder="Prescribing habit (e.g., prefers established regimen)"
                  />
                  <Input
                    value={predictiveInputs.access_barrier}
                    onChange={(e) => setPredictiveInputs((prev) => ({ ...prev, access_barrier: e.target.value }))}
                    placeholder="Barrier (e.g., PA workload, access, staffing)"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-600">Generate top 3 recommendations before your next HCP discussion.</p>
                  <Button type="button" variant="outline" className="text-xs font-semibold border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] hover:-translate-y-0.5 transition-all shadow-sm" onClick={generatePredictiveTips}>Generate Top 3</Button>
                </div>
                {predictiveTips.length > 0 && (
                  <ul className="ui-bullet-list text-xs text-gray-700">
                    {predictiveTips.map((tip) => <li key={tip}>{tip}</li>)}
                  </ul>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">AI Assist stays disabled until all required context fields are complete.</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" className="h-10 min-w-[104px] border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => setShowForm(false)}>Cancel</Button>
                  <Button className="h-10 min-w-[136px] bg-teal-500 font-semibold hover:bg-teal-600" onClick={() => createPlan(form)} disabled={!form.hcp_name || aiGenerating !== null}>
                    Create Plan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />)}</div>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white py-20 text-center">
            <FileText className="mx-auto mb-4 h-16 w-16 text-gray-200" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No Plans Yet</h3>
            <p className="mb-6 text-sm text-gray-600">Create your first Pre-Call Plan to start preparing for HCP conversations.</p>
            <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => setShowForm(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create Your First Plan
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => {
              const structured = getStructuredPlan(plan);
              const highlights = getPlanHighlights(structured);
              return (
                <Card key={plan.id} className="border-teal-200/80 transition-shadow hover:shadow-md">
                  <CardContent className="ui-card-top-padding p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{plan.hcp_name}</h3>
                          <span className="ui-pill px-2 py-1 text-xs capitalize">{plan.status || "draft"}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {plan.specialty && <span className="ui-pill px-2 py-1 text-xs">{plan.specialty}</span>}
                          {plan.disease_state && <span className="ui-pill px-2 py-1 text-xs">{plan.disease_state}</span>}
                        </div>
                        {highlights.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {highlights.map((highlight) => (
                              <span key={highlight} className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs leading-relaxed text-slate-600">
                                {highlight}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span className="text-xs text-gray-600">{format(new Date(plan.created_date), "MMM d, yyyy")}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                          {expandedPlan === plan.id ? <ChevronUp className="h-4 w-4 text-gray-600" /> : <ChevronDown className="h-4 w-4 text-gray-600" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deletePlan(plan.id)}>
                          <Trash2 className="h-4 w-4 text-gray-600" />
                        </Button>
                      </div>
                    </div>

                    {expandedPlan === plan.id && (
                      <div className="mt-5 space-y-4 border-t border-gray-100 pt-4">
                        <div className="grid gap-4 xl:grid-cols-2">
                          <PlanSectionCard title="Call Objectives" tone="teal">
                            <ul className="space-y-2 text-sm text-slate-700">
                              {structured.objectives.map((item) => (
                                <li key={item} className="flex items-start gap-2 leading-relaxed">
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-600" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </PlanSectionCard>

                          <PlanSectionCard title="Key Messages" tone="teal">
                            <ul className="space-y-2 text-sm text-slate-700">
                              {structured.key_messages.map((item) => (
                                <li key={item} className="flex items-start gap-2 leading-relaxed">
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-600" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </PlanSectionCard>
                        </div>

                        <PlanSectionCard title="Anticipated Objections" tone="amber">
                          <div className="space-y-3">
                            {structured.anticipated_objections.map((item, index) => (
                              <div key={`${item.concern}-${index}`} className="rounded-2xl border border-amber-200 bg-white/70 p-4">
                                <p className="text-sm font-semibold text-amber-900">Concern {index + 1}</p>
                                <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.concern}</p>
                                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Planned response</p>
                                <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.response}</p>
                              </div>
                            ))}
                          </div>
                        </PlanSectionCard>

                        <PlanSectionCard title="Discussion Notes & Next-Step Cues">
                          <ul className="space-y-2 text-sm text-slate-700">
                            {structured.notes.map((item) => (
                              <li key={item} className="flex items-start gap-2 leading-relaxed">
                                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </PlanSectionCard>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#1A334D]">Field-Ready Export</p>
            <p className="text-xs text-slate-600">Use the consolidated export area below for either a blank planning worksheet or your latest saved plan.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full text-xs font-semibold border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]"
              onClick={exportTemplatePdf}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Export to PDF (Template)
            </Button>
            <Button
              variant="outline"
              className="rounded-full text-xs font-semibold border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] disabled:opacity-50"
              onClick={() => plans.length > 0 && exportPlanPdf(plans[0])}
              disabled={plans.length === 0}
              title={plans.length > 0 ? "Export most recent plan as PDF" : "Create a plan to enable PDF export"}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Export to PDF (Latest Plan)
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
