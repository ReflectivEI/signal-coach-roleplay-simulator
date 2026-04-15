import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Plus, Brain, FlaskConical, Zap, MapPin, Settings } from "lucide-react";
import ScenarioCard from "@/components/home/ScenarioCard";
import BuildYourOwnCard from "@/components/home/BuildYourOwnCard";
import ScenarioFilters, { applyScenarioFilters, DEFAULT_FILTERS } from "@/components/home/ScenarioFilters";
import { listAllScenarios, deleteCustomScenario } from "@/lib/scenarioStorage";

export default function Home() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => { void loadScenarios(); }, []);

  const loadScenarios = async () => {
    setLoading(true);
    const allScenarios = await listAllScenarios();
    setScenarios(allScenarios.filter((scenario) => scenario.journeyStage));
    setLoading(false);
  };

  const handleDeleteScenario = async (scenarioId) => {
    await deleteCustomScenario(scenarioId);
    setScenarios((current) => current.filter((scenario) => scenario.id !== scenarioId));
  };

  const filtered = applyScenarioFilters(scenarios, filters);

  // Group scenarios by journey stage for display
  const STAGE_ORDER = ["initial_access", "discovery", "clinical_value", "objection_handling", "adoption_implementation", "access_formulary", "commitment_close"];
  const STAGE_LABELS = {
    initial_access: "Initial Access",
    discovery: "Discovery",
    clinical_value: "Clinical Value",
    objection_handling: "Objection Handling",
    adoption_implementation: "Adoption & Implementation",
    access_formulary: "Access & Formulary",
    commitment_close: "Commitment & Close",
  };

  return (
    <div className="min-h-screen font-inter" style={{ background: "#f8fafb" }}>

      {/* Top nav — clean white */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "hsl(174 40% 12%)" }}>
              <Zap className="w-3.5 h-3.5" style={{ color: "hsl(174 60% 65%)" }} />
            </div>
            <div>
              <span className="font-semibold text-slate-800 text-sm">Signal Intelligence</span>
              <span className="text-slate-400 text-sm ml-1.5">Coaching Simulator</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/library" className="text-sm text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Library
            </Link>
            <Link to="/builder" className="text-sm text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Build Scenario
            </Link>
            <Link to="/capabilities" className="text-sm text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" />
              Capabilities
            </Link>
            <Link to="/qa" className="text-sm text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              QA Twin
            </Link>
            <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8">

        {/* Hero header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="rounded-2xl overflow-hidden mb-8"
          style={{ background: "hsl(174 40% 11%)", border: "1px solid hsl(174 40% 18%)" }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 px-7 py-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "hsl(162 60% 55%)" }}>
                Signal Intelligence™ Practice
              </p>
              <h1 className="text-2xl font-bold text-white leading-tight mb-2">Role-Play Simulator</h1>
              <p className="text-base text-white max-w-2xl leading-snug">
                Practice realistic HCP conversations across disease states and stakeholder types. Each scenario delivers targeted Signal Intelligence coaching feedback.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link to="/builder"
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap text-white"
                style={{ background: "hsl(162 55% 38%)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "hsl(162 55% 32%)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "hsl(162 55% 38%)"; }}
              >
                + New Scenario
              </Link>
              <div className="px-4 py-2 rounded-lg text-center" style={{ background: "hsl(174 40% 16%)", border: "1px solid hsl(174 40% 22%)" }}>
                <div className="text-xl font-bold text-white">{scenarios.length || 19}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">Scenarios</div>
              </div>
              <div className="px-4 py-2 rounded-lg text-center" style={{ background: "hsl(174 40% 16%)", border: "1px solid hsl(174 40% 22%)" }}>
                <div className="text-xl font-bold text-white">8</div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">Capabilities</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters container — styled like Opening Scene */}
        <div className="rounded-xl px-5 py-4 mb-4" style={{ background: "hsl(174 40% 97%)", border: "1px solid hsl(162 50% 80%)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(162 55% 38%)" }} />
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(162 55% 38%)" }}>Training Scenarios</h2>
            </div>
            <Link to="/builder" className="text-xs font-medium flex items-center gap-1 transition-colors" style={{ color: "hsl(162 55% 40%)" }}>
              Create custom <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <ScenarioFilters filters={filters} onChange={setFilters} />
        </div>

        {/* Grid container — navy background */}
        <div className="rounded-2xl p-5" style={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(222 30% 20%)" }}>
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-slate-700 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-sm">
              No scenarios match the selected filters.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {/* Build Your Own card — first position */}
              <BuildYourOwnCard />
              {filtered.map((scenario, i) => (
                <ScenarioCard 
                  key={scenario.id} 
                  scenario={scenario} 
                  index={i} 
                  isFeatured={i === 0}
                  onDelete={handleDeleteScenario}
                />
              ))}
            </div>
          )}
        </div>

        {/* Capabilities strip */}
        <div className="mt-14 pt-8 rounded-2xl px-8 py-8" style={{ background: "hsl(222 40% 12%)", border: "1px solid hsl(222 30% 20%)" }}>
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="w-4 h-4" style={{ color: "hsl(162 60% 55%)" }} />
            <span className="text-sm font-semibold text-white">8 Signal Intelligence Capabilities</span>
            <Link to="/capabilities" className="ml-auto text-xs font-medium transition-colors" style={{ color: "hsl(162 60% 55%)" }}>
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-6">
            {SIGNAL_INTELLIGENCE_CAPABILITIES.map((cap) => (
              <div key={cap.id} className="rounded-xl p-4" style={{ cursor: "pointer", border: "1px solid hsl(174 50% 30% / 0.5)", background: "hsl(222 40% 14%)" }}>
                <div className="text-sm font-semibold mb-2 leading-snug" style={{ color: "hsl(162 60% 55%)" }}>{cap.metric}</div>
                <div className="text-xs text-white leading-relaxed">{cap.definition}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
