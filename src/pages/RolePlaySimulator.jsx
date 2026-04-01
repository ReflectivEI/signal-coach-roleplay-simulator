// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { createPageUrl } from "@/utils";
import EnterpriseScenarioCard from "@/components/roleplay/EnterpriseScenarioCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { enrichScenarioWithTaxonomy } from "@/lib/roleplay-v2/scenarioTaxonomy";
import {
  ALL_SCENARIOS,
  CATEGORIES,
  DIFFICULTIES,
  DISEASE_STATES,
  SPECIALTIES,
  HCP_CATEGORIES,
  INFLUENCE_DRIVERS,
  JOURNEY_STAGES,
  INTERACTION_PRESSURES,
} from "@/lib/roleplay-v2/scenarioCatalog";
import { recordSimulatorTelemetry } from "@/lib/roleplay-v2/simulatorTelemetry";

const BUILDER_TO_SIMULATOR_KEY = "reflectivai:builderScenario";

export default function RolePlaySimulator() {
  const [customScenario, setCustomScenario] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(BUILDER_TO_SIMULATOR_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      if (parsed?.title) {
        setCustomScenario(parsed);
      }
    } catch (error) {
      console.error("Failed to load builder scenario:", error);
    } finally {
      window.sessionStorage.removeItem(BUILDER_TO_SIMULATOR_KEY);
    }
  }, []);

  const handleNewScenarioRoute = () => {
    window.location.assign(`${createPageUrl("ScenarioBuilder")}?mode=generator`);
  };
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeDifficulty, setActiveDifficulty] = useState("All Levels");
  const [search, setSearch] = useState("");
  const [diseaseStateFilter, setDiseaseStateFilter] = useState("All Disease States");
  const [specialtyFilter, setSpecialtyFilter] = useState("All Specialties");
  const [hcpCategoryFilter, setHcpCategoryFilter] = useState("All HCP Types");
  const [influenceDriverFilter, setInfluenceDriverFilter] = useState("All Influence Drivers");
  const [journeyStageFilter, setJourneyStageFilter] = useState("All Journey Stages");
  const [interactionPressureFilter, setInteractionPressureFilter] = useState("All Interaction Pressures");

  const scenarioCatalog = useMemo(
    () => ALL_SCENARIOS.map((scenario) => enrichScenarioWithTaxonomy(scenario)),
    []
  );

  const filteredScenarios = useMemo(() => {
    return scenarioCatalog.filter(s => {
      const catMatch = activeCategory === "All" || s.category === activeCategory;
      const diffMatch = activeDifficulty === "All Levels" || s.difficulty === activeDifficulty;
      const q = search.toLowerCase();
      const searchMatch = !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.stakeholder.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      const dsMatch = diseaseStateFilter === "All Disease States" || s.category === diseaseStateFilter;
      const specMatch = specialtyFilter === "All Specialties" || s.specialty === specialtyFilter;
      const hcpMatch = hcpCategoryFilter === "All HCP Types" || s.hcp_category === hcpCategoryFilter;
      const infMatch = influenceDriverFilter === "All Influence Drivers" || s.influence_driver === influenceDriverFilter;
      const stageMatch = journeyStageFilter === "All Journey Stages" || s.taxonomy?.journeyStage === journeyStageFilter;
      const pressureMatch = interactionPressureFilter === "All Interaction Pressures" || s.taxonomy?.interactionPressure === interactionPressureFilter;
      return catMatch && diffMatch && searchMatch && dsMatch && specMatch && hcpMatch && infMatch && stageMatch && pressureMatch;
    });
  }, [scenarioCatalog, activeCategory, activeDifficulty, search, diseaseStateFilter, specialtyFilter, hcpCategoryFilter, influenceDriverFilter, journeyStageFilter, interactionPressureFilter]);

  useEffect(() => {
    recordSimulatorTelemetry("filters.changed", {
      activeCategory,
      activeDifficulty,
      searchLength: search.length,
      diseaseStateFilter,
      specialtyFilter,
      hcpCategoryFilter,
      influenceDriverFilter,
      journeyStageFilter,
      interactionPressureFilter,
      filteredCount: filteredScenarios.length,
    });
  }, [activeCategory, activeDifficulty, search, diseaseStateFilter, specialtyFilter, hcpCategoryFilter, influenceDriverFilter, journeyStageFilter, interactionPressureFilter, filteredScenarios.length]);

  const handleScenarioStartTelemetry = (scenario) => {
    recordSimulatorTelemetry("scenario.start", {
      scenarioId: scenario.id || "custom",
      title: scenario.title,
      category: scenario.category,
      difficulty: scenario.difficulty,
      taxonomy: scenario.taxonomy || null,
      metadataSource: scenario.metadataEnvelope?.metadata_source || null,
      filters: {
        activeCategory,
        activeDifficulty,
        diseaseStateFilter,
        specialtyFilter,
        hcpCategoryFilter,
        influenceDriverFilter,
        journeyStageFilter,
        interactionPressureFilter,
      },
    });
  };

  const counts = useMemo(() => {
    const c = {};
    CATEGORIES.forEach(cat => {
      c[cat] = cat === "All" ? scenarioCatalog.length : scenarioCatalog.filter(s => s.category === cat).length;
    });
    return c;
  }, [scenarioCatalog]);

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      {/* Page Header */}
      <div className="px-6 md:px-10 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="overflow-hidden rounded-[32px] border border-[#1A334D]/10 bg-[linear-gradient(135deg,#0f172a_0%,#1A334D_54%,#2c8d89_100%)] px-6 py-7 text-white shadow-[0_26px_70px_rgba(15,23,42,0.24)] md:px-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] mb-2 text-teal-200">Signal Intelligence™ Practice</p>
              <h1 className="text-3xl font-bold md:text-[42px] md:leading-[1.04]">Role-Play Simulator</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                Practice realistic HCP conversations across disease states and stakeholder types. Each scenario delivers targeted Signal Intelligence feedback in a cleaner enterprise-grade workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-stretch gap-3 text-sm">
              <button
                className="inline-flex h-[58px] items-center rounded-full bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold px-5 shadow-sm"
                onClick={handleNewScenarioRoute}
              >
                + New Scenario
              </button>
              <div className="flex min-h-[104px] min-w-[150px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur-sm">
                <span className="text-3xl font-bold text-white">{scenarioCatalog.length}</span>
                <span className="mt-1 text-xs uppercase tracking-[0.16em] text-teal-100">Scenarios</span>
              </div>
              <div className="flex min-h-[104px] min-w-[150px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur-sm">
                <span className="text-3xl font-bold text-white">{CATEGORIES.length - 1}</span>
                <span className="mt-1 text-xs uppercase tracking-[0.16em] text-teal-100">Disease Areas</span>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10">
        {/* Taxonomy + profile filters */}
        <div className="mb-7 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Select value={diseaseStateFilter} onValueChange={setDiseaseStateFilter}>
              <SelectTrigger className="text-sm h-10 border-[#1A334D] text-[#1A334D] transition-colors duration-200 hover:border-[#39ACAC] focus:ring-teal-400" style={diseaseStateFilter !== "All Disease States" ? { borderColor: "#39ACAC", color: "#1A334D", fontWeight: 600 } : {}}>
                <SelectValue placeholder="Disease State" />
              </SelectTrigger>
              <SelectContent>
                {DISEASE_STATES.map(ds => <SelectItem key={ds} value={ds}>{ds}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="text-sm h-10 border-[#1A334D] text-[#1A334D] transition-colors duration-200 hover:border-[#39ACAC]" style={specialtyFilter !== "All Specialties" ? { borderColor: "#39ACAC", color: "#1A334D", fontWeight: 600 } : {}}>
                <SelectValue placeholder="Specialty" />
              </SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={hcpCategoryFilter} onValueChange={setHcpCategoryFilter}>
              <SelectTrigger className="text-sm h-10 border-[#1A334D] text-[#1A334D] transition-colors duration-200 hover:border-[#39ACAC]" style={hcpCategoryFilter !== "All HCP Types" ? { borderColor: "#39ACAC", color: "#1A334D", fontWeight: 600 } : {}}>
                <SelectValue placeholder="HCP Category" />
              </SelectTrigger>
              <SelectContent>
                {HCP_CATEGORIES.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={influenceDriverFilter} onValueChange={setInfluenceDriverFilter}>
              <SelectTrigger className="text-sm h-10 border-[#1A334D] text-[#1A334D] transition-colors duration-200 hover:border-[#39ACAC]" style={influenceDriverFilter !== "All Influence Drivers" ? { borderColor: "#39ACAC", color: "#1A334D", fontWeight: 600 } : {}}>
                <SelectValue placeholder="Influence Driver" />
              </SelectTrigger>
              <SelectContent>
                {INFLUENCE_DRIVERS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={journeyStageFilter} onValueChange={setJourneyStageFilter}>
              <SelectTrigger className="text-sm h-10 border-[#1A334D] text-[#1A334D] transition-colors duration-200 hover:border-[#39ACAC]" style={journeyStageFilter !== "All Journey Stages" ? { borderColor: "#39ACAC", color: "#1A334D", fontWeight: 600 } : {}}>
                <SelectValue placeholder="Journey Stage" />
              </SelectTrigger>
              <SelectContent>
                {JOURNEY_STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={interactionPressureFilter} onValueChange={setInteractionPressureFilter}>
              <SelectTrigger className="text-sm h-10 border-[#1A334D] text-[#1A334D] transition-colors duration-200 hover:border-[#39ACAC]" style={interactionPressureFilter !== "All Interaction Pressures" ? { borderColor: "#39ACAC", color: "#1A334D", fontWeight: 600 } : {}}>
                <SelectValue placeholder="Interaction Pressure" />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_PRESSURES.map((pressure) => <SelectItem key={pressure} value={pressure}>{pressure}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search + Difficulty Row */}
        <div className="mb-7 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search scenarios, stakeholders, disease states..."
              className="h-10 bg-white pl-9 text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setActiveDifficulty(d)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 ease-in-out ${
                  activeDifficulty === d
                    ? "border-transparent text-white"
                    : "bg-white border-slate-200 text-gray-600 hover:-translate-y-[1px] hover:border-teal-300 hover:shadow-md"
                }`}
                style={activeDifficulty === d ? { background: "#1A334D" } : {}}
              >
                {d === "All Levels" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills */}
        <div className="mb-7 flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-150 ease-in-out ${
                activeCategory === cat
                  ? "text-white shadow-sm"
                  : "bg-white border-[#1A334D] text-[#1A334D] hover:-translate-y-[1px] hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 hover:shadow-sm"
              }`}
              style={activeCategory === cat ? { background: "#39ACAC", borderColor: "#1A334D" } : {}}
            >
              {cat}
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${activeCategory === cat ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                {counts[cat]}
              </span>
            </button>
          ))}
        </div>

        {/* Filter actions */}
        {(activeCategory !== "All" || activeDifficulty !== "All Levels" || search || diseaseStateFilter !== "All Disease States" || specialtyFilter !== "All Specialties" || hcpCategoryFilter !== "All HCP Types" || influenceDriverFilter !== "All Influence Drivers" || journeyStageFilter !== "All Journey Stages" || interactionPressureFilter !== "All Interaction Pressures") && (
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => { setActiveCategory("All"); setActiveDifficulty("All Levels"); setSearch(""); setDiseaseStateFilter("All Disease States"); setSpecialtyFilter("All Specialties"); setHcpCategoryFilter("All HCP Types"); setInfluenceDriverFilter("All Influence Drivers"); setJourneyStageFilter("All Journey Stages"); setInteractionPressureFilter("All Interaction Pressures"); }}
              className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear all filters
            </button>
          </div>
        )}
        {/* Scenario Grid */}
        {customScenario ? (
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            <EnterpriseScenarioCard key={customScenario.id || 'custom'} scenario={customScenario} onStart={() => handleScenarioStartTelemetry(customScenario)} />
            {filteredScenarios.map(s => (
              <EnterpriseScenarioCard key={s.id} scenario={s} onStart={() => handleScenarioStartTelemetry(s)} />
            ))}
          </div>
        ) : filteredScenarios.length > 0 ? (
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredScenarios.map(s => (
              <EnterpriseScenarioCard key={s.id} scenario={s} onStart={() => handleScenarioStartTelemetry(s)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-gray-400">
            <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-gray-600">No scenarios match your filters</p>
            <p className="text-sm mt-1">Try a different category or clear your search</p>
          </div>
        )}
      </div>
    </div>
  );
}
