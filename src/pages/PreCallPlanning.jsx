// @ts-nocheck
import { saveAs } from "file-saver";
const exportWord = async (plan) => {
  const blob = new Blob([
    `Pre-Call Plan\n\nHCP Name: ${plan.hcp_name}\nSpecialty: ${plan.specialty}\nDisease State: ${plan.disease_state}\n\nObjectives: ${plan.objectives}\n\nKey Messages: ${plan.key_messages}\n\nAnticipated Objections: ${plan.anticipated_objections}\n\nNotes: ${plan.notes}`
  ], { type: "application/msword" });
  saveAs(blob, `pre-call-plan-${plan.hcp_name.replace(/\s+/g, "-").toLowerCase()}.doc`);
};
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClipboardList, Plus, FileText, Trash2, Info, Loader2, Wand2, ChevronDown, ChevronUp, Download, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ENABLEMENT_HUB_SPOKES } from "@/lib/enablementHub";

const REQUIRED_AI_FIELDS = ["hcp_name", "specialty", "disease_state"];

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

export default function PreCallPlanning() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ hcp_name: "", specialty: "", disease_state: "", objectives: "", key_messages: "", anticipated_objections: "", notes: "" });
  const [plans, setPlans] = useState([]);
  const [aiGenerating, setAiGenerating] = useState(null);
  const [predictiveInputs, setPredictiveInputs] = useState({ prescribing_habit: "", access_barrier: "" });
  const [predictiveTips, setPredictiveTips] = useState([]);
  const isLoading = false;

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem("precall-predictive-tips") || "[]");
      if (Array.isArray(cached) && cached.length > 0) {
        setPredictiveTips(cached.slice(0, 3));
      }
    } catch {}
  }, []);

  const hasAllAiFields = useMemo(
    () => REQUIRED_AI_FIELDS.every((field) => String(form[field] || "").trim()),
    [form]
  );
  const aiAssistDisabled = aiGenerating !== null || !hasAllAiFields;

  const aiAssist = async (field) => {
    if (!hasAllAiFields) return;
    setAiGenerating(field);
    const context = `HCP: ${form.hcp_name || "unknown"}, Specialty: ${form.specialty || "unknown"}, Disease State: ${form.disease_state || "unknown"}, Current objectives: ${form.objectives || "none"}, Current key messages: ${form.key_messages || "none"}`;
    const prompts = {
      objectives: `You are a pharma sales coach. Based on this context: ${context}, draft 2-3 clear, specific call objectives using Signal Intelligence principles. Be concise, action-oriented. Plain text only, no markdown headers.`,
      key_messages: `You are a pharma sales coach. Based on this context: ${context}, draft 3 key messages tailored to this HCP's likely priorities using Signal Intelligence principles. Plain text only, no markdown headers.`,
      anticipated_objections: `You are a pharma sales coach. Based on this context: ${context}, list 3 likely objections this HCP might raise, with a brief response strategy for each. Plain text only, no markdown headers.`,
    };
    try {
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[field] })
      });
      const data = await res.json();
      let responseText = data.response || data.text || data.content || '';
      responseText = responseText.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
      setForm(prev => ({ ...prev, [field]: responseText }));
    } catch {
      setForm(prev => ({ ...prev, [field]: 'AI service unavailable.' }));
    }
    setAiGenerating(null);
  };

  const generatePredictiveTips = () => {
    const habit = predictiveInputs.prescribing_habit.toLowerCase();
    const barrier = predictiveInputs.access_barrier.toLowerCase();
    const tips = [];

    if (habit.includes("legacy") || habit.includes("older") || habit.includes("stable")) {
      tips.push("Lead with switch criteria and real-world outcomes for stable patients eligible for optimization.");
    } else {
      tips.push("Open with patient-segment opportunities and one high-impact use case tied to this specialty.");
    }

    if (barrier.includes("prior") || barrier.includes("pa") || barrier.includes("access")) {
      tips.push("Prepare a prior-auth workflow script and bring one payer-specific support resource to reduce friction.");
    } else if (barrier.includes("time") || barrier.includes("staff")) {
      tips.push("Use a 90-second value narrative and propose nurse/pharmacist-enabled follow-up to save clinic time.");
    } else {
      tips.push("Map likely objections in advance and pre-wire one response linked to measurable patient impact.");
    }

    tips.push("Close the call by confirming a concrete next step with owner and date (e.g., chart pull, patient list review, follow-up).");
    setPredictiveTips(tips.slice(0, 3));
  };

  const createPlan = (data) => {
    setPlans((prev) => [{ ...data, id: Date.now().toString(), created_date: new Date().toISOString(), status: "draft" }, ...prev]);
    setShowForm(false);
    setForm({ hcp_name: "", specialty: "", disease_state: "", objectives: "", key_messages: "", anticipated_objections: "", notes: "" });
  };

  const deletePlan = (id) => setPlans((prev) => prev.filter((p) => p.id !== id));
  const [expandedPlan, setExpandedPlan] = useState(null);

  const exportPDF = async (plan) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    doc.setFillColor(26, 51, 77);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Pre-Call Plan", margin, 19);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${format(new Date(), "MMM d, yyyy")}`, pageWidth - margin, 19, { align: "right" });

    y = 40;
    doc.setTextColor(0, 0, 0);

    doc.setFillColor(240, 244, 248);
    doc.rect(margin - 2, y - 4, maxWidth + 4, 22, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 51, 77);
    doc.text(plan.hcp_name || "Pre-Call Planning Template", margin, y + 4);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    const details = [plan.specialty, plan.disease_state].filter(Boolean).join("  ·  ");
    if (details) doc.text(details, margin, y + 11);
    y += 28;

    const addSection = (label, value) => {
      if (!value) return;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(57, 172, 172);
      doc.text(label.toUpperCase(), margin, y);
      y += 5;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(value, maxWidth);
      if (y + lines.length * 5 > 270) { doc.addPage(); y = margin; }
      doc.text(lines, margin, y);
      y += lines.length * 5 + 8;
    };

    addSection("Objectives", plan.objectives);
    addSection("Key Messages", plan.key_messages);
    addSection("Anticipated Objections", plan.anticipated_objections);
    addSection("Notes", plan.notes);

    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text("ReflectivAI · Signal Intelligence™ Pre-Call Planning", pageWidth / 2, 290, { align: "center" });

    const safeName = (plan.hcp_name || "template").trim().replace(/\s+/g, "-").toLowerCase() || "template";
    doc.save(`pre-call-plan-${safeName}.pdf`);
  };

  const exportTemplatePDF = async () => {
    const templatePlan = {
      hcp_name: "",
      specialty: "",
      disease_state: "",
      objectives: "",
      key_messages: "",
      anticipated_objections: "",
      notes: "",
    };
    await exportPDF(templatePlan);
  };

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
                {ENABLEMENT_HUB_SPOKES.filter(spoke => ["performance", "learning", "reports"].includes(spoke.id)).map((spoke) => (
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
              <p className="text-sm text-gray-600">Prepare for your HCP conversations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button className="h-10 min-w-[140px] border border-teal-500 bg-teal-500 text-white shadow-sm hover:bg-teal-600" onClick={() => setShowForm(true)}>
              <Plus className="mr-1 h-4 w-4" /> New Plan
            </Button>
            <Button
              variant="outline"
              onClick={() => plans.length > 0 && exportPDF(plans[0])}
              disabled={plans.length === 0}
              className="h-10 min-w-[172px] border-[#1A334D] bg-[#f8fbff] font-semibold text-[#1A334D] hover:border-[#39ACAC] hover:bg-[#e6f7f7] hover:text-[#39ACAC]"
              title={plans.length > 0 ? "Export most recent plan as PDF" : "Create a plan to enable PDF export"}
            >
              <Download className="mr-1 h-4 w-4" /> Export to PDF
            </Button>
          </div>
        </div>

        <div className="mb-6 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
          <p className="text-sm text-gray-600">
            <strong>Coaching assistance only.</strong> Pre-Call Plans help you think through your approach and prepare for HCP conversations. No evaluation or scoring.
          </p>
        </div>

        {showForm && (
          <Card className="mb-7 border-teal-200 shadow-sm">
            <CardContent className="space-y-4 p-5 md:p-6">
              <div className="flex gap-3 rounded-2xl border border-teal-200 bg-[#e6f7f7] p-4">
                <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-700" />
                <div>
                  <p className="text-sm font-semibold text-[#1A334D]">AI Assistance unlocks once HCP Name, Specialty, and Disease State are entered.</p>
                  <p className="mt-1 text-xs text-slate-600">Complete all three required context fields to enable AI-generated planning support.</p>
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

              {[
                { key: "objectives", label: "Objectives", placeholder: "What do you want to achieve?" },
                { key: "key_messages", label: "Key Messages", placeholder: "Key points to communicate" },
                { key: "anticipated_objections", label: "Anticipated Objections", placeholder: "What resistance might you face?" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-2">
                  <div className="mb-1 flex items-center justify-between">
                    <Label>{label}</Label>
                    {renderTooltipButton({
                      type: "button",
                      onClick: () => aiAssist(key),
                      disabled: aiAssistDisabled,
                      message: "Complete required fields to enable AI Assist",
                      className: "flex items-center gap-1.5 rounded-full border border-teal-300 bg-teal-100/70 px-2.5 py-1 text-xs font-semibold text-teal-800 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50",
                      children: aiGenerating === key ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</> : <><Wand2 className="h-3 w-3" /> AI Assist</>
                    })}
                  </div>
                  <Textarea
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className={aiGenerating === key ? "opacity-50" : ""}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (form.hcp_name && !aiGenerating) createPlan(form);
                      }
                    }}
                  />
                </div>
              ))}

              <div className="space-y-2 rounded-xl border border-teal-100 bg-teal-50 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Predictive Prep Assistant</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Input
                    value={predictiveInputs.prescribing_habit}
                    onChange={(e) => setPredictiveInputs((prev) => ({ ...prev, prescribing_habit: e.target.value }))}
                    placeholder="Prescribing habit (e.g., prefers legacy regimen)"
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
                  <Button
                    variant="outline"
                    className="h-10 min-w-[148px] border-[#1A334D] bg-[#f8fbff] font-semibold text-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC]"
                    onClick={() => exportWord({ ...form, hcp_name: form.hcp_name || "new-plan" })}
                  >
                    Export to Word
                  </Button>
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
            {plans.map((plan) => (
              <Card key={plan.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{plan.hcp_name}</h3>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {plan.specialty && <span className="ui-pill px-2 py-1 text-xs">{plan.specialty}</span>}
                        {plan.disease_state && <span className="ui-pill px-2 py-1 text-xs">{plan.disease_state}</span>}
                        <span className="ui-pill px-2 py-1 text-xs capitalize">{plan.status || "draft"}</span>
                      </div>
                      {plan.objectives && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{plan.objectives}</p>}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-xs text-gray-600">{format(new Date(plan.created_date), "MMM d, yyyy")}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportPDF(plan)} title="Export to PDF">
                        <Download className="h-4 w-4 text-teal-500 hover:text-teal-700" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportWord(plan)} title="Export to Word">
                        <Download className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                        {expandedPlan === plan.id ? <ChevronUp className="h-4 w-4 text-gray-600" /> : <ChevronDown className="h-4 w-4 text-gray-600" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deletePlan(plan.id)}>
                        <Trash2 className="h-4 w-4 text-gray-600" />
                      </Button>
                    </div>
                  </div>

                  {expandedPlan === plan.id && (
                    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                      {[
                        { label: "Objectives", value: plan.objectives },
                        { label: "Key Messages", value: plan.key_messages },
                        { label: "Anticipated Objections", value: plan.anticipated_objections },
                        { label: "Notes", value: plan.notes },
                      ].filter(f => f.value).map(({ label, value }) => (
                        <div key={label}>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>
                          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{value}</p>
                        </div>
                      ))}
                      <div className="pt-1">
                        <Button variant="outline" onClick={() => exportPDF(plan)} className="w-full text-xs font-semibold border-[#1A334D] text-[#1A334D] bg-[#f8fbff] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] sm:w-auto">
                          <Download className="mr-1 h-3.5 w-3.5" /> Export to PDF
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3 rounded-xl border border-teal-200 bg-teal-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#1A334D]">Field-Ready Export</p>
            <p className="text-xs text-slate-600">Export your most recent plan or a blank pre-call template for use in the field.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full text-xs font-semibold border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]"
              onClick={exportTemplatePDF}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Export to PDF (Template)
            </Button>
            <Button
              variant="outline"
              className="rounded-full text-xs font-semibold border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] disabled:opacity-50"
              onClick={() => plans.length > 0 && exportPDF(plans[0])}
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
