import { saveAs } from "file-saver";
const exportWord = async (plan) => {
  const blob = new Blob([
    `Pre-Call Plan\n\nHCP Name: ${plan.hcp_name}\nSpecialty: ${plan.specialty}\nDisease State: ${plan.disease_state}\n\nObjectives: ${plan.objectives}\n\nKey Messages: ${plan.key_messages}\n\nAnticipated Objections: ${plan.anticipated_objections}\n\nNotes: ${plan.notes}`
  ], { type: "application/msword" });
  saveAs(blob, `pre-call-plan-${plan.hcp_name.replace(/\s+/g, "-").toLowerCase()}.doc`);
};
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, Plus, FileText, Trash2, Info, Loader2, Wand2, ChevronDown, ChevronUp, Download } from "lucide-react";
import { format } from "date-fns";

export default function PreCallPlanning() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ hcp_name: "", specialty: "", disease_state: "", objectives: "", key_messages: "", anticipated_objections: "", notes: "" });
  const [plans, setPlans] = useState([]);
  const [aiGenerating, setAiGenerating] = useState(null); // which field is being generated
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


  const aiAssist = async (field) => {
    if (!form.hcp_name && !form.specialty && !form.disease_state) return;
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
      // Strip markdown code blocks for clean display
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

    // Header
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

    // HCP Info
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

    // Footer
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
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-2">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-gray-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pre-Call Planning</h1>
            <p className="text-sm text-gray-600">Prepare for your HCP conversations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => plans.length > 0 && exportPDF(plans[0])}
            disabled={plans.length === 0}
            className="border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]"
            title={plans.length > 0 ? "Export most recent plan as PDF" : "Create a plan to enable PDF export"}
          >
            <Download className="w-4 h-4 mr-1" /> Export to PDF (Latest Plan)
          </Button>
          <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Plan
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 flex gap-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-gray-600">
          <strong>Coaching assistance only.</strong> Pre-Call Plans help you think through your approach and prepare for HCP conversations. No evaluation or scoring.
        </p>
      </div>

      {/* New Plan Form */}
      {showForm && (
        <Card className="mb-8 border-teal-200">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>HCP Name</Label>
                <Input value={form.hcp_name} onChange={(e) => setForm({ ...form, hcp_name: e.target.value })} placeholder="Dr. Smith" />
              </div>
              <div>
                <Label>Specialty</Label>
                <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="Oncology" />
              </div>
              <div>
                <Label>Disease State</Label>
                <Input value={form.disease_state} onChange={(e) => setForm({ ...form, disease_state: e.target.value })} placeholder="HIV" />
              </div>
            </div>
            {[
              { key: "objectives", label: "Objectives", placeholder: "What do you want to achieve?" },
              { key: "key_messages", label: "Key Messages", placeholder: "Key points to communicate" },
              { key: "anticipated_objections", label: "Anticipated Objections", placeholder: "What resistance might you face?" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <Label>{label}</Label>
                  <button
                    type="button"
                    onClick={() => aiAssist(key)}
                    disabled={aiGenerating !== null || (!form.hcp_name && !form.specialty && !form.disease_state)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 border border-teal-300 bg-teal-100/70 shadow-sm rounded-full px-2.5 py-1 hover:bg-teal-200 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {aiGenerating === key ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                    ) : (
                      <><Wand2 className="w-3 h-3" /> AI Assistance</>
                    )}
                  </button>
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

            <div className="rounded-xl border border-teal-100 bg-teal-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Predictive Prep Assistant</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                <ul className="list-disc pl-4 text-xs text-gray-700 space-y-1">
                  {predictiveTips.map((tip) => <li key={tip}>{tip}</li>)}
                </ul>
              )}
            </div>

            <div className="flex gap-3 justify-between items-center">
              <p className="text-xs text-gray-600">
                Enter HCP name, specialty, or disease state to unlock AI assistance
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => createPlan(form)} disabled={!form.hcp_name || aiGenerating !== null}>
                  Create Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans List */}
      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Plans Yet</h3>
          <p className="text-sm text-gray-600 mb-6">Create your first Pre-Call Plan to start preparing for HCP conversations.</p>
          <Button className="bg-teal-500 hover:bg-teal-600" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create Your First Plan
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{plan.hcp_name}</h3>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {plan.specialty && <span className="text-xs bg-gray-100 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">{plan.specialty}</span>}
                      {plan.disease_state && <span className="text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">{plan.disease_state}</span>}
                      <span className="text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5 capitalize">{plan.status || "draft"}</span>
                    </div>
                    {plan.objectives && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{plan.objectives}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-600">{format(new Date(plan.created_date), "MMM d, yyyy")}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportPDF(plan)} title="Export to PDF">
                      <Download className="w-4 h-4 text-teal-500 hover:text-teal-700" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportWord(plan)} title="Export to Word">
                      <Download className="w-4 h-4 text-blue-500 hover:text-blue-700" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}>
                      {expandedPlan === plan.id ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deletePlan(plan.id)}>
                      <Trash2 className="w-4 h-4 text-gray-600" />
                    </Button>
                  </div>
                </div>

                {expandedPlan === plan.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {[
                      { label: "Objectives", value: plan.objectives },
                      { label: "Key Messages", value: plan.key_messages },
                      { label: "Anticipated Objections", value: plan.anticipated_objections },
                      { label: "Notes", value: plan.notes },
                    ].filter(f => f.value).map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">{label}</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{value}</p>
                      </div>
                    ))}
                    <div className="pt-1">
                      <Button variant="outline" onClick={() => exportPDF(plan)} className="w-full sm:w-auto text-xs font-semibold border-[#1A334D] text-[#1A334D] bg-[#f8fbff] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]">
                        <Download className="w-3.5 h-3.5 mr-1" /> Export to PDF
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-teal-200 bg-teal-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
            <Download className="w-3.5 h-3.5 mr-1" /> Export to PDF (Template)
          </Button>
          <Button
            variant="outline"
            className="rounded-full text-xs font-semibold border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] disabled:opacity-50"
            onClick={() => plans.length > 0 && exportPDF(plans[0])}
            disabled={plans.length === 0}
            title={plans.length > 0 ? "Export most recent plan as PDF" : "Create a plan to enable PDF export"}
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Export to PDF (Latest Plan)
          </Button>
        </div>
      </div>

    </div>
  );
}
