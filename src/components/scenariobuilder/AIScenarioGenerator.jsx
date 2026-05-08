// @ts-nocheck
import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import CapabilityTagger from "@/components/roleplay/CapabilityTagger";
import EnterpriseScenarioCard from "@/components/roleplay/EnterpriseScenarioCard";
import { buildSimulatorScenarioFromNormalized, normalizeGeneratedScenario } from "@/lib/scenarioNormalization";
import { buildFieldCoachingGrounding } from "@/lib/fieldCoachingGuidance";

const diseaseStates = ["HIV", "PrEP (HIV Prevention)", "Oncology", "Cardiology", "Neurology", "Vaccines / Immunization"];
const specialties = ["Family Medicine", "Internal Medicine", "Infectious Diseases", "Hem/Onc", "Medical Oncology", "Cardiology", "Neurology"];
const hcpCategories = ["KOL / Thought Leader", "Prescriber / Treater", "Non-Prescribing Influencer", "Low Engagement"];
const difficulties = ["beginner", "intermediate", "advanced"];
const challengeOptions = [
  "Handling objections about new clinical data",
  "Navigating a time-pressured interaction",
  "Gaining commitment from a resistant HCP",
  "Building credibility with a skeptical KOL",
  "Responding to formulary / access objections",
  "Engaging a low-interest, low-engagement prescriber",
  "Presenting comparative efficacy to a data-driven HCP",
  "Managing an emotionally charged / frustrated HCP",
];

function exportPreviewPdf(preview, normalized) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const left = 15;
  let y = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - left * 2;

  const addSection = (label, lines = []) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label, left, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(`• ${line}`, contentWidth);
      doc.text(wrapped, left, y);
      y += wrapped.length * 5;
    });
    y += 3;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(preview.title || "Generated Scenario", left, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Difficulty: ${normalized.difficulty}`, left, y);
  y += 8;

  addSection("Opening Scene", [normalized.openingScene]);
  addSection("HCP", [normalized.hcp]);
  addSection("Objective", normalized.objective);
  addSection("Tactical Focus", normalized.tacticalFocus);

  const safeName = (preview.title || "generated-scenario").replace(/\s+/g, "-").toLowerCase();
  doc.save(`generated-scenario-${safeName}.pdf`);
}

export default function AIScenarioGenerator({ onGenerated, onCancel, onAddToSimulator }) {
  const [params, setParams] = useState({
    hcp_category: "",
    specialty: "",
    disease_state: "",
    challenge: "",
    custom_challenge: "",
    difficulty: "intermediate",
    focus_capabilities: [],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const normalizedPreview = useMemo(() => {
    if (!preview) return null;
    return normalizeGeneratedScenario({
      ...preview,
      specialty: params.specialty,
      disease_state: params.disease_state,
      hcp_category: params.hcp_category,
      difficulty: params.difficulty,
      focus_capabilities: params.focus_capabilities,
    });
  }, [params.difficulty, params.disease_state, params.focus_capabilities, params.hcp_category, params.specialty, preview]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setPreview(null);

    const challenge = params.challenge === "__custom__" ? params.custom_challenge : params.challenge;

    try {
      const prompt = `Generate a realistic pharmaceutical sales roleplay scenario for training.

${buildFieldCoachingGrounding({
        surface: "ai_scenario_generator",
        hcpType: params.hcp_category,
        specialty: params.specialty,
        diseaseState: params.disease_state,
        challenge,
        weakestAreas: params.focus_capabilities,
        customNotes: [
          "Keep the scenario customizable for client-specific messaging, product context, and selling model without violating the Signal Intelligence foundation.",
          "Success criteria and resistance points should be grounded in observable SI behaviors rather than generic selling advice.",
        ],
      })}

Use these parameters:
      - HCP Type: ${params.hcp_category || 'Any'}
      - Specialty: ${params.specialty || 'Any'}
      - Disease State: ${params.disease_state}
      - Rep Challenge: ${challenge}
      - Difficulty: ${params.difficulty}
      - Focus capabilities: ${params.focus_capabilities.length ? params.focus_capabilities.join(', ') : 'No explicit focus provided'}

      Create a detailed scenario that includes these exact section headers:
      HCP Background and Context:
      Initial Greeting from the HCP:
      Potential Objections or Resistance Points:
      Success Criteria:

      Initial Greeting from the HCP should start warm and empathetic, then pivot professionally to business talk.
      Keep the content practical for pharmaceutical sales training.
      Make the scenario specific enough for coaching, but leave room for client-specific messaging customization.`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 1200 })
      });
      if (res.ok) {
        const data = await res.json();
        let scenarioText = typeof data.response === 'string' ? data.response : String(data.response);
        scenarioText = scenarioText.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
        setPreview({
          title: `${params.hcp_category || 'HCP'} - ${challenge}`,
          content: scenarioText,
          description: scenarioText,
        });
      }
    } catch (err) {
      console.error('Scenario generation error:', err);
      setPreview(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveScenario = () => {
    if (!preview || !normalizedPreview) return;
    const simulatorScenario = buildSimulatorScenarioFromNormalized(normalizedPreview);
    onGenerated?.(simulatorScenario);
  };

  const handleAddToSimulator = () => {
    if (!preview || !normalizedPreview) return;
    const simulatorScenario = buildSimulatorScenarioFromNormalized(normalizedPreview);
    onAddToSimulator?.(simulatorScenario);
  };

  const canGenerate = params.hcp_category || params.specialty || params.challenge;

  return (
    <div className="ui-teal-section rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-teal-500" />
          <h2 className="font-bold text-gray-900">AI Scenario Generator</h2>
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">Beta</span>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-5">Describe what you want to practice. The AI Scenario Generator creates a structured scenario preview that is ready for simulator ingestion.</p>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">HCP Type</label>
            <Select value={params.hcp_category} onValueChange={(v) => setParams({ ...params, hcp_category: v })}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Any HCP type" /></SelectTrigger>
              <SelectContent>{hcpCategories.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Specialty</label>
            <Select value={params.specialty} onValueChange={(v) => setParams({ ...params, specialty: v })}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Any specialty" /></SelectTrigger>
              <SelectContent>{specialties.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Disease State</label>
            <Select value={params.disease_state} onValueChange={(v) => setParams({ ...params, disease_state: v })}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Any disease state" /></SelectTrigger>
              <SelectContent>{diseaseStates.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Difficulty</label>
            <Select value={params.difficulty} onValueChange={(v) => setParams({ ...params, difficulty: v })}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{difficulties.map(d => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Specific Challenge</label>
          <Select value={params.challenge} onValueChange={(v) => setParams({ ...params, challenge: v })}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="Choose a challenge or describe your own" /></SelectTrigger>
            <SelectContent>
              {challengeOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              <SelectItem value="__custom__">Custom challenge...</SelectItem>
            </SelectContent>
          </Select>
          {params.challenge === "__custom__" && (
            <Input
              className="mt-2 bg-white"
              placeholder="Describe the specific challenge or scenario context..."
              value={params.custom_challenge}
              onChange={(e) => setParams({ ...params, custom_challenge: e.target.value })}
            />
          )}
        </div>

        <div>
          <button
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Signal Intelligence Focus (optional)
          </button>
          {showAdvanced && (
            <div className="mt-2">
              <CapabilityTagger
                selected={params.focus_capabilities}
                onChange={(caps) => setParams({ ...params, focus_capabilities: caps })}
              />
            </div>
          )}
        </div>

        <Button
          className="w-full bg-teal-500 hover:bg-teal-600"
          onClick={handleGenerate}
          disabled={isGenerating || !canGenerate}
        >
          {isGenerating
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating scenario...</>
            : <><Sparkles className="w-4 h-4 mr-2" />Generate Scenario</>
          }
        </Button>
      </div>

      {preview && normalizedPreview && (
        <div className="mt-5 rounded-xl border border-teal-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Generated Preview</span>
              <p className="mt-1 text-xs text-slate-500">State: <span className="font-semibold text-emerald-700">Ready for Simulation</span></p>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-7 border-[#1A334D] text-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC]" onClick={() => exportPreviewPdf(preview, normalizedPreview)}>
              Export to PDF
            </Button>
          </div>

          <EnterpriseScenarioCard
            scenario={buildSimulatorScenarioFromNormalized(normalizedPreview)}
            defaultExpanded
            openingSceneLabel="Preview Scene"
            footerSecondary={(
              <button className="text-xs text-gray-400 hover:text-gray-600" onClick={handleGenerate}>
                ↻ Regenerate
              </button>
            )}
            footerAction={(
              <Button className="rounded-full bg-teal-500 hover:bg-teal-600 px-6" onClick={handleAddToSimulator}>
                Add to Simulator
              </Button>
            )}
            allowStart={false}
          />

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={handleSaveScenario}>Save Scenario</Button>
          </div>
        </div>
      )}
    </div>
  );
}
