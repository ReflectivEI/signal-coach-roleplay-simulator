import React, { useState } from "react";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// ...existing code...
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Copy, Save, X, ChevronDown, ChevronUp, Tag, Sparkles } from "lucide-react";
import CapabilityTagger from "@/components/roleplay/CapabilityTagger";
import AIScenarioGenerator from "@/components/scenariobuilder/AIScenarioGenerator";

const exportScenarioWord = (scenario) => {
  const blob = new Blob([
    `Scenario Title: ${scenario.title || "Untitled"}\n\nDescription:\n${scenario.description || ""}\n\nSpecialty: ${scenario.specialty || ""}\nDisease State: ${scenario.disease_state || ""}\nHCP Category: ${scenario.hcp_category || ""}\nInfluence Driver: ${scenario.influence_driver || ""}\nDifficulty: ${scenario.difficulty || ""}\n\nDetails:\n${scenario.details || ""}`
  ], { type: "application/msword" });
  saveAs(blob, `scenario-${(scenario.title || "untitled").replace(/\s+/g, "-").toLowerCase()}.doc`);
};

const diseaseStates = ["HIV", "PrEP (HIV Prevention)", "Oncology", "Cardiology", "Neurology", "Vaccines / Immunization"];
const specialties = ["Family Medicine", "Internal Medicine", "Infectious Diseases", "Hem/Onc", "Medical Oncology", "Cardiology", "Neurology"];
const hcpCategories = ["KOL / Thought Leader", "Prescriber / Treater", "Non-Prescribing Influencer", "Low Engagement"];
const influenceDrivers = ["Evidence-Based", "Patient-Centered", "Risk-Averse", "Guideline-Anchored"];
const difficulties = ["beginner", "intermediate", "advanced"];

const difficultyColors = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-red-100 text-red-700",
};

const emptyForm = {
  title: "",
  description: "",
  specialty: "",
  disease_state: "",
  hcp_category: "",
  influence_driver: "",
  difficulty: "intermediate",
  details: "",
  focus_capabilities: [],
};

const cleanScenarioText = (value = "") => String(value)
  .replace(/^[\s*-]+/gm, "")
  .replace(/\*\*/g, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

export default function ScenarioBuilder() {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const isLoading = false;

  const saveScenario = (data) => {
    if (editingId === "new") {
      setScenarios((prev) => [{ ...data, id: Date.now().toString(), created_date: new Date().toISOString() }, ...prev]);
    } else {
      setScenarios((prev) => prev.map((s) => s.id === editingId ? { ...s, ...data } : s));
    }
    setEditingId(null);
    setForm(emptyForm);
  };

  const deleteScenario = (id) => setScenarios((prev) => prev.filter((s) => s.id !== id));

  const duplicateScenario = (scenario) => {
    const { id, created_date, ...rest } = scenario;
    setScenarios((prev) => [{ ...rest, id: Date.now().toString(), title: `${rest.title} (Copy)`, created_date: new Date().toISOString() }, ...prev]);
  };

  const startEdit = (scenario) => {
    setEditingId(scenario.id);
    setForm({
      title: scenario.title || "",
      description: scenario.description || "",
      specialty: scenario.specialty || "",
      disease_state: scenario.disease_state || "",
      hcp_category: scenario.hcp_category || "",
      influence_driver: scenario.influence_driver || "",
      difficulty: scenario.difficulty || "intermediate",
      details: scenario.details || "",
      focus_capabilities: scenario.focus_capabilities || [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    saveScenario(form);
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scenario Builder</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage role-play scenarios</p>
        </div>
        {editingId === null && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-teal-300 text-teal-600 hover:bg-teal-50"
              onClick={() => { setShowAIGenerator(!showAIGenerator); setEditingId(null); }}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              AI Generate
            </Button>
            <Button
              className="bg-teal-500 hover:bg-teal-600"
              onClick={() => { setEditingId("new"); setForm(emptyForm); setShowAIGenerator(false); }}
            >
              <Plus className="w-4 h-4 mr-1" />
              New Scenario
            </Button>
          </div>
        )}
      </div>

      {/* AI Generator */}
      {showAIGenerator && editingId === null && (
        <AIScenarioGenerator
          onCancel={() => setShowAIGenerator(false)}
          onGenerated={(generated) => {
            setShowAIGenerator(false);
            setEditingId("new");
            setForm({ ...emptyForm, ...generated });
          }}
        />
      )}

      {editingId === null && (
        <div className="mb-6 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#1A334D]">Need a custom scenario for your next simulation?</p>
            <p className="text-xs text-gray-600">Use + New Scenario for manual control, or AI Generate for a fast first draft you can refine.</p>
          </div>
          <Button className="bg-[#1A334D] hover:bg-[#152a3f]" onClick={() => { setEditingId("new"); setForm(emptyForm); setShowAIGenerator(false); }}>
            <Plus className="w-4 h-4 mr-1" />
            + New Scenario
          </Button>
        </div>
      )}

      {/* Edit / New Form */}
      {editingId !== null && (
        <div className="bg-white border border-teal-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">{editingId === "new" ? "New Scenario" : "Edit Scenario"}</h2>
            <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Title *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Skeptical Oncologist — Clinical Evidence Challenge"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief overview of the scenario context and challenge..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-none"
              />
            </div>

            {/* Row: Specialty + Disease State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Specialty</label>
                <Select value={form.specialty} onValueChange={(v) => setForm({ ...form, specialty: v })}>
                  <SelectTrigger><SelectValue placeholder="Select specialty" /></SelectTrigger>
                  <SelectContent>
                    {specialties.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Disease State</label>
                <Select value={form.disease_state} onValueChange={(v) => setForm({ ...form, disease_state: v })}>
                  <SelectTrigger><SelectValue placeholder="Select disease state" /></SelectTrigger>
                  <SelectContent>
                    {diseaseStates.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row: HCP Category + Influence Driver + Difficulty */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">HCP Category</label>
                <Select value={form.hcp_category} onValueChange={(v) => setForm({ ...form, hcp_category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select HCP type" /></SelectTrigger>
                  <SelectContent>
                    {hcpCategories.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Influence Driver</label>
                <Select value={form.influence_driver} onValueChange={(v) => setForm({ ...form, influence_driver: v })}>
                  <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                  <SelectContent>
                    {influenceDrivers.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Difficulty</label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                  <SelectContent>
                    {difficulties.map((d) => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Details */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Extended Details</label>
              <textarea
                value={form.details}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
                placeholder="Additional coaching context, HCP background, specific behaviors to practice..."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px] resize-none"
              />
            </div>

            {/* Focus Capabilities */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Signal Intelligence Focus Capabilities
              </label>
                <p className="text-xs text-gray-400 mb-2">All 8 Signal Intelligence capabilities will be practiced and evaluated in every scenario.</p>
              <CapabilityTagger
                selected={form.focus_capabilities}
                onChange={(caps) => setForm({ ...form, focus_capabilities: caps })}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={cancelEdit}>Cancel</Button>
              <Button variant="outline" onClick={() => exportScenarioWord(form)} disabled={!form.title.trim()}>
                Export to Word
              </Button>
              <Button
                className="bg-teal-500 hover:bg-teal-600"
                onClick={handleSave}
                disabled={!form.title.trim()}
              >
                <Save className="w-4 h-4 mr-1" />
                Save Scenario
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : scenarios.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No scenarios yet</p>
          <p className="text-sm mt-1">Click "New Scenario" to create your first one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => (
            <div key={s.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${editingId === s.id ? "border-teal-300" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">{s.title}</span>
                  </div>
                  <div className="flex gap-2 mt-1 flex-wrap items-center">
                    {s.specialty && <span className="text-xs text-gray-400">{s.specialty}</span>}
                    {s.specialty && s.disease_state && <span className="text-xs text-gray-300">·</span>}
                    {s.disease_state && <span className="text-xs text-gray-400">{s.disease_state}</span>}
                    {s.hcp_category && <span className="text-xs text-gray-300">·</span>}
                    {s.hcp_category && <span className="text-xs text-gray-400">{s.hcp_category}</span>}
                  </div>
                  {/* ...existing code... */}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    title="View details"
                  >
                    {expandedId === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => startEdit(s)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                   onClick={() => duplicateScenario(s)}
                   className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                   title="Duplicate"
                  >
                   <Copy className="w-4 h-4" />
                  </button>
                  <button
                   onClick={() => deleteScenario(s.id)}
                   className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                   title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedId === s.id && (
                <div className="px-5 pb-4 pt-0 border-t border-gray-100 bg-gray-50 space-y-2">
                  {s.description && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{cleanScenarioText(s.description)}</p>}
                  {s.details && <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{cleanScenarioText(s.details)}</p>}
                  {!s.description && !s.details && <p className="text-xs text-gray-400 italic">No additional details.</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
