import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import CapabilityTagger from "@/components/roleplay/CapabilityTagger";

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

export default function AIScenarioGenerator({ onGenerated, onCancel }) {
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    setPreview(null);

    const challenge = params.challenge === "__custom__" ? params.custom_challenge : params.challenge;

    try {
      const prompt = `Generate a realistic pharmaceutical sales roleplay scenario for training. Use these parameters:
- HCP Type: ${params.hcp_type}
- Disease State: ${params.disease_state}
- Rep Challenge: ${challenge}
- Difficulty: ${params.difficulty}
- Time Limit: ${params.prep_time} minutes

Create a detailed scenario that includes:
1. HCP background and context
2. Office setting description
3. Patient population / case details
4. HCP's current state and concerns
5. Initial greeting from the HCP
6. 2-3 potential objections or resistance points
7. Success criteria for the roleplay

Format as a detailed scenario brief that a sales rep can use for practice.`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 1200 })
      });
      if (res.ok) {
        const data = await res.json();
        let scenarioText = typeof data.response === 'string' ? data.response : String(data.response);
        // Strip markdown code blocks
        scenarioText = scenarioText.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
        setPreview({ title: `${params.hcp_category || 'HCP'} - ${challenge}`, content: scenarioText, description: scenarioText });
      }
    } catch (err) {
      console.error('Scenario generation error:', err);
      setResult(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAccept = () => {
    if (!preview) return;
    const challenge = params.challenge === "__custom__" ? params.custom_challenge : params.challenge;

    const stateArcText = preview.state_arc?.length > 0
      ? `State Arc:\n${preview.state_arc.map(e =>
        `• Turns ${e.turn_range} [${e.state}]: ${e.trigger} (${e.trigger_type}) — ${e.coaching_note}`
      ).join("\n")}`
      : "";

    const objectionText = preview.layered_objections?.length > 0
      ? `Layered Objections:\n${preview.layered_objections.map((o, i) =>
        `${i + 1}. "${o.objection}"\n   Underlying: ${o.underlying_concern}\n   Layer 3 (excellent): ${o.layer_3_response}`
      ).join("\n\n")}`
      : "";

    onGenerated({
      title: preview.title,
      description: preview.description,
      specialty: params.specialty,
      disease_state: params.disease_state,
      hcp_category: params.hcp_category,
      difficulty: params.difficulty,
      focus_capabilities: params.focus_capabilities,
      details: [
        preview.hcp_persona ? `HCP Persona: ${preview.hcp_persona}` : "",
        preview.initial_state ? `Initial State: ${preview.initial_state} — ${preview.initial_state_rationale || ""}` : "",
        stateArcText,
        objectionText,
        preview.dialogue_cues?.length > 0 ? `Opening Cues:\n${preview.dialogue_cues.map(c => `• ${c}`).join("\n")}` : "",
        preview.details || "",
        challenge ? `Core Challenge: ${challenge}` : "",
      ].filter(Boolean).join("\n\n"),
    });
  };

  const canGenerate = params.hcp_category || params.specialty || params.challenge;

  return (
    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-2xl p-6 mb-6 shadow-sm">
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

      <p className="text-xs text-gray-500 mb-5">Describe what you want to practice. The AI will generate a full scenario with HCP persona, behavioral cues, and coaching context.</p>

      <div className="space-y-4">
        {/* Core params */}
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

        {/* Challenge */}
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

        {/* Advanced: Focus Capabilities */}
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

      {/* Preview */}
      {preview && (
        <div className="mt-5 bg-white rounded-xl border border-teal-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Generated Preview</span>
            <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-xs h-7" onClick={handleAccept}>
              Use This Scenario →
            </Button>
          </div>
          <h3 className="font-bold text-gray-900">{preview.title}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{preview.description}</p>
          {preview.hcp_name && (
            <div className="text-xs text-gray-500"><span className="font-medium text-gray-700">HCP:</span> {preview.hcp_name}</div>
          )}
          {preview.initial_state && (
            <div className="text-xs">
              <span className="font-medium text-gray-700">Initial State:</span>{" "}
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{preview.initial_state}</span>
              {preview.initial_state_rationale && <span className="text-gray-500 ml-2">— {preview.initial_state_rationale}</span>}
            </div>
          )}
          {preview.state_arc?.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> State Arc
              </div>
              {preview.state_arc.map((e, i) => (
                <div key={i} className="flex gap-2 items-start text-xs pl-2">
                  <span className="text-gray-400 font-mono flex-shrink-0">T{e.turn_range}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0">{e.state}</span>
                  <span className="text-gray-500 italic">{e.trigger}</span>
                  {e.trigger_type === 'external_event' && <span className="text-blue-400 text-xs flex-shrink-0">[ext]</span>}
                </div>
              ))}
            </div>
          )}
          {preview.layered_objections?.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Layered Objections
              </div>
              {preview.layered_objections.map((o, i) => (
                <div key={i} className="pl-2 border-l-2 border-orange-200 space-y-0.5">
                  <div className="text-xs font-medium text-gray-700">"{o.objection}"</div>
                  <div className="text-xs text-gray-400 italic">Underlying: {o.underlying_concern}</div>
                  <div className="text-xs text-teal-600">✓ {o.layer_3_response}</div>
                </div>
              ))}
            </div>
          )}
          {preview.dialogue_cues?.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-700">Opening Cues:</div>
              {preview.dialogue_cues.map((cue, i) => (
                <div key={i} className="text-xs text-gray-600 italic pl-3 border-l-2 border-teal-200">{cue}</div>
              ))}
            </div>
          )}
          <div className="flex justify-between pt-1">
            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={handleGenerate}>
              ↻ Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}