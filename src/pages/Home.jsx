import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Zap, MapPin } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
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
    <div
      className="min-h-screen font-inter"
      style={{
        background: "linear-gradient(180deg, #f7fbfc 0%, #eef5f6 38%, #f8fbfc 100%)",
      }}
    >
      <AppHeader maxWidthClassName="max-w-[1420px]" />

      <div className="w-full max-w-[1480px] mx-auto px-5 xl:px-6 py-8 space-y-8">

        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-[28px] overflow-hidden"
          style={{
            background: "linear-gradient(92deg, hsl(224 50% 15%) 0%, hsl(214 54% 21%) 42%, hsl(186 44% 20%) 100%)",
            border: "1px solid rgba(31, 58, 107, 0.42)",
            boxShadow: "0 24px 54px rgba(9, 20, 43, 0.14)",
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 px-7 py-6"
            style={{ borderBottom: "1px solid rgba(89, 125, 175, 0.38)" }}>
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
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap text-white"
                style={{
                  background: "linear-gradient(135deg, hsl(163 53% 42%), hsl(174 58% 34%))",
                  boxShadow: "0 12px 24px rgba(14, 135, 122, 0.22)",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "hsl(162 55% 32%)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "hsl(162 55% 38%)"; }}
              >
                + New Scenario
              </Link>
              <div className="px-4 py-2 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(116, 227, 206, 0.16)" }}>
                <div className="text-xl font-bold text-white">{scenarios.length || 19}</div>
                <div className="text-xs text-slate-300 uppercase tracking-wider">Scenarios</div>
              </div>
              <div className="px-4 py-2 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(116, 227, 206, 0.16)" }}>
                <div className="text-xl font-bold text-white">8</div>
                <div className="text-xs text-slate-300 uppercase tracking-wider">Capabilities</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters container — styled like Opening Scene */}
        <div
          className="rounded-[26px] px-5 py-5"
          style={{
            background: "linear-gradient(268deg, hsl(186 44% 20%) 0%, hsl(210 45% 25%) 48%, hsl(223 45% 18%) 100%)",
            border: "1px solid rgba(47, 86, 129, 0.42)",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(174 62% 74%)" }} />
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(174 62% 82%)" }}>Training Scenarios</h2>
            </div>
            <Link to="/builder" className="text-xs font-medium flex items-center gap-1 transition-colors" style={{ color: "hsl(174 70% 86%)" }}>
              Create custom <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <ScenarioFilters filters={filters} onChange={setFilters} />
          <p className="text-xs mt-1.5" style={{ color: "rgba(234, 248, 247, 0.78)" }}>
            Use Preview Brief on any card to review context, then start the roleplay. Predictive Builder remains available as an optional deep-dive workspace.
          </p>
        </div>

        {/* Grid container — navy background */}
        <div
          className="rounded-[28px] p-5"
          style={{
            background: "linear-gradient(132deg, hsl(223 46% 17%) 0%, hsl(213 40% 22%) 52%, hsl(181 37% 23%) 100%)",
            border: "1px solid rgba(78, 139, 146, 0.42)",
            boxShadow: "0 22px 48px rgba(13, 19, 36, 0.10)",
          }}
        >
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-5">
              {/* Build Your Own card — first position */}
              <BuildYourOwnCard />
              {filtered.map((scenario, i) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  index={i}
                  isFeatured={i === 0}
                  selectedRealism={filters.realism}
                  onDelete={handleDeleteScenario}
                />
              ))}
            </div>
          )}
        </div>

        {/* Capabilities strip */}
        <div
          className="rounded-[28px] px-8 py-8"
          style={{
            background: "linear-gradient(180deg, hsl(223 42% 12%) 0%, hsl(222 40% 13%) 100%)",
            border: "1px solid rgba(39, 63, 103, 0.65)",
            boxShadow: "0 20px 42px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="w-4 h-4" style={{ color: "hsl(162 60% 55%)" }} />
            <span className="text-sm font-semibold text-white">8 Signal Intelligence Capabilities</span>
            <Link to="/capabilities" className="ml-auto text-xs font-medium transition-colors" style={{ color: "hsl(162 60% 55%)" }}>
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {SIGNAL_INTELLIGENCE_CAPABILITIES.map((cap) => (
              <div
                key={cap.id}
                className="rounded-2xl p-4 transition-transform duration-200"
                style={{
                  cursor: "pointer",
                  border: "1px solid rgba(87, 214, 186, 0.22)",
                  background: "linear-gradient(180deg, rgba(19, 30, 53, 0.96) 0%, rgba(20, 29, 45, 0.98) 100%)",
                }}
              >
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
