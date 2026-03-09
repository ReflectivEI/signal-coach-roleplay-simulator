import React, { useState, useEffect } from "react";
import {
  Brain, Target, TrendingUp, CheckCircle, Lock, Play, BookOpen, Zap,
  RefreshCw, Loader2, ChevronRight, ChevronDown, Star, AlertTriangle,
  BarChart3, Award, Clock, Sparkles, ArrowRight, Circle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { MODULE_LIBRARY, CAPABILITY_META, getUrgency } from "@/components/learningpath/ModuleLibrary";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const URGENCY_CONFIG = {
  critical: { label: "Critical", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" },
  high: { label: "High", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500" },
  medium: { label: "Medium", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400" },
  low: { label: "On Track", color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", dot: "bg-teal-500" },
};

const LEVEL_COLORS = {
  Foundation: "bg-blue-100 text-blue-700 border-blue-200",
  Intermediate: "bg-purple-100 text-purple-700 border-purple-200",
  Advanced: "bg-orange-100 text-orange-700 border-orange-200",
  Master: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

function ScoreBar({ score, color }) {
  const pct = score ? ((score - 1) / 4) * 100 : 0;
  const barColor = score < 2 ? "#ef4444" : score < 3 ? "#f97316" : score < 4 ? "#39ACAC" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-8">{score ? `${score}/5` : "—"}</span>
    </div>
  );
}

function CapabilityCard({ capability, meta, paths, onSelect, selected }) {
  const path = paths.find(p => p.capability === capability);
  const urgency = path ? getUrgency(path.avg_score) : "medium";
  const cfg = URGENCY_CONFIG[urgency];
  const completedModules = path?.completed_modules || [];
  const capModules = MODULE_LIBRARY.filter(m => m.capability === capability);
  const progress = capModules.length > 0 ? Math.round((completedModules.length / capModules.length) * 100) : 0;

  return (
    <button
      onClick={() => onSelect(capability)}
      className={`w-full text-left rounded-xl border p-4 transition-all ${selected === capability
        ? "border-teal-400 bg-teal-50 shadow-sm"
        : `bg-white ${cfg.border} hover:shadow-md`
        }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: meta.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">{meta.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              {cfg.label}
            </span>
          </div>
          {path?.avg_score && (
            <div className="mt-2">
              <ScoreBar score={path.avg_score} color={meta.color} />
            </div>
          )}
          {!path?.avg_score && (
            <p className="text-xs text-gray-400 mt-1">No sessions yet — start practicing</p>
          )}
          {capModules.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-gray-400">{completedModules.length}/{capModules.length} modules</span>
            </div>
          )}
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${selected === capability ? "rotate-90" : ""}`} />
      </div>
    </button>
  );
}

function ModuleCard({ module, completed, onToggle, onStartRoleplay }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = module.icon;

  return (
    <div className={`rounded-xl border transition-all ${completed ? "border-teal-200 bg-teal-50/40" : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => onToggle(module.id)}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${completed ? "border-teal-500 bg-teal-500" : "border-gray-300 hover:border-teal-400"
              }`}
          >
            {completed && <CheckCircle className="w-3.5 h-3.5 text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${module.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`text-sm font-semibold ${completed ? "line-through text-gray-400" : "text-gray-900"}`}>{module.title}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${LEVEL_COLORS[module.level] || ""}`}>{module.level}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{module.subtitle}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {module.duration}</span>
                  <span className="text-xs text-gray-400">{module.type}</span>
                </div>
              </div>
              <button onClick={() => setExpanded(v => !v)} className="text-gray-400 hover:text-gray-600 p-1">
                <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 ml-9 space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">{module.description}</p>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Behaviors</p>
              <div className="space-y-1.5">
                {module.keyBehaviors.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0 mt-1.5" />
                    {b}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Practice Exercises ({module.exercises.length})</p>
              <div className="space-y-2">
                {module.exercises.map((ex) => (
                  <div key={ex.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-800">{ex.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{ex.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Scoring Anchors</p>
              <div className="space-y-1.5">
                {module.scoringAnchors.map((a, i) => {
                  const c = a.score === 5 ? "bg-green-50 border-green-200 text-green-800" : a.score === 3 ? "bg-yellow-50 border-yellow-200 text-yellow-800" : "bg-red-50 border-red-200 text-red-800";
                  return (
                    <div key={i} className={`flex gap-2 p-2.5 rounded-lg border text-xs ${c}`}>
                      <span className="font-bold w-8 flex-shrink-0">{a.score}/5</span>
                      <span>{a.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onToggle(module.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border font-semibold text-xs px-3 py-1.5 transition-all duration-200 ${completed
                  ? "border-gray-300 text-gray-500 bg-white hover:border-red-300 hover:text-red-500"
                  : "border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]"
                  }`}
              >
                <CheckCircle className="w-3 h-3" />
                {completed ? "Mark Incomplete" : "Mark Complete"}
              </button>
              <button
                onClick={() => onStartRoleplay(module)}
                className="inline-flex items-center gap-1.5 rounded-full border font-semibold text-xs px-3 py-1.5 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] transition-all duration-200"
              >
                <Play className="w-3 h-3" />
                Practice in Simulator
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LearningPaths() {
  const [paths, setPaths] = useState([]);
  const [selectedCap, setSelectedCap] = useState(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loadingPaths, setLoadingPaths] = useState(true);

  useEffect(() => {
    loadData();
    // Populate demo sessions for analysis
    setSessions([
      { capability: "communication", score: 3.8 },
      { capability: "negotiation", score: 4.2 },
      { capability: "communication", score: 4.0 },
      { capability: "negotiation", score: 3.5 },
      { capability: "leadership", score: 4.5 }
    ]);
  }, []);

  const loadData = async () => {
    setLoadingPaths(true);
    try {
      const res = await fetch('/api/learning-paths', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setPaths(data.learningPaths || []);
      } else {
        setPaths([]);
      }
    } catch (err) {
      console.error('Load learning paths error:', err);
      setPaths([]);
    } finally {
      setLoadingPaths(false);
    }
  };

  const analyzePerformanceAndBuildPaths = async () => {
    setAnalyzingAll(true);
    try {
      // Call AI Advise endpoint for all capabilities
      const updatedPaths = await Promise.all(paths.map(async (path) => {
        const cap = CAPABILITY_META[path.capability];
        if (!cap) return path;
        const score = path?.avg_score || "no score yet";
        const sessionCount = path?.session_count || 0;
        const prompt = `You are a sales coaching expert. Generate a personalized learning recommendation for a pharmaceutical sales representative who needs to improve their \"${cap.label}\" capability.\n\nCurrent Performance: ${score}/5 (based on ${sessionCount} roleplay sessions)\n\nProvide a clear, actionable recommendation using this markdown structure:\n\n### Key Learning Objectives\n[2-3 specific, measurable objectives]\n\n### Recommended Practice Scenarios\n[3-4 specific scenarios to practice]\n\n### Skill-Building Exercises\n[3-4 concrete exercises]\n\n### Performance Metrics to Track\n[3-4 specific metrics]\n\nKeep it practical, specific to pharmaceutical sales, and aligned with Signal Intelligence™ behavioral frameworks.`;
        const res = await fetch('/api/llm/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, max_tokens: 800 })
        });
        if (res.ok) {
          const data = await res.json();
          return { ...path, ai_recommendation: data.response || "" };
        } else {
          return path;
        }
      }));
      setPaths(updatedPaths);
    } catch (err) {
      console.error('Analyze performance error:', err);
    } finally {
      setAnalyzingAll(false);
    }
  };

  const toggleModuleComplete = async (capabilityId, moduleId) => {
    try {
      // PATCH to backend to persist module completion
      const res = await fetch('/api/learning-paths/complete', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityId, moduleId })
      });
      if (res.ok) {
        const data = await res.json();
        // Update local state with new completed_modules array
        setPaths(prev => prev.map(p =>
          p.capability === capabilityId
            ? { ...p, completed_modules: data.completed_modules || [] }
            : p
        ));
      } else {
        // Fallback: update local state only
        setPaths(prev => prev.map(p =>
          p.capability === capabilityId
            ? {
              ...p, completed_modules: p.completed_modules.includes(moduleId)
                ? p.completed_modules.filter(m => m !== moduleId)
                : [...p.completed_modules, moduleId]
            }
            : p
        ));
        console.error('Toggle module backend error:', await res.text());
      }
    } catch (err) {
      console.error('Toggle module error:', err);
    }
  };

  const generateAIRecommendation = async (capabilityId) => {
    console.log('🔵 generateAIRecommendation called with:', capabilityId);
    console.log('🔵 Current selectedCap:', selectedCap);
    console.log('🔵 Current generatingAI:', generatingAI);
    
    if (!capabilityId) {
      console.warn('⚠️  No capability ID provided to generateAIRecommendation');
      return;
    }
    
    setGeneratingAI(capabilityId);
    try {
      const cap = CAPABILITY_META[capabilityId];
      console.log('🔵 CAPABILITY_META lookup:', cap);
      
      if (!cap) {
        console.error('❌ Capability not found in CAPABILITY_META:', capabilityId);
        return;
      }
      
      const path = paths.find(p => p.capability === capabilityId);
      console.log('🔵 Found path:', path);
      const score = path?.avg_score || "no score yet";
      const sessionCount = path?.session_count || 0;

      const prompt = `You are a sales coaching expert. Generate a personalized learning recommendation for a pharmaceutical sales representative who needs to improve their "${cap.label}" capability.

Current Performance: ${score}/5 (based on ${sessionCount} roleplay sessions)

Provide a clear, actionable recommendation using this markdown structure:

### Key Learning Objectives
[2-3 specific, measurable objectives]

### Recommended Practice Scenarios
[3-4 specific scenarios to practice]

### Skill-Building Exercises
[3-4 concrete exercises]

### Performance Metrics to Track
[3-4 specific metrics]

Keep it practical, specific to pharmaceutical sales, and aligned with Signal Intelligence™ behavioral frameworks.`;

      console.log('🔵 About to call /api/llm/invoke with prompt length:', prompt.length);
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_tokens: 800
        })
      });

      console.log('🔵 Fetch response:', res.status, res.statusText);
      
      if (res.ok) {
        const data = await res.json();
        console.log('🔵 API response data:', data);
        const recommendation = data.response || "";

        if (recommendation && recommendation.trim().length > 0) {
          console.log('🔵 Updating paths with recommendation');
          setPaths(prev =>
            prev.map(p =>
              p.capability === capabilityId
                ? { ...p, ai_recommendation: recommendation.trim() }
                : p
            )
          );
          console.log('✅ Recommendation successfully set for capability:', capabilityId);
        } else {
          console.log('⚠️  Empty recommendation received from API');
          console.log('⚠️  Full response object:', data);
        }
      } else {
        const errorText = await res.text();
        console.error('❌ Fetch failed with status:', res.status);
        console.error('❌ Error response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          console.error('❌ Error details:', errorData);
        } catch (e) {
          // Not JSON, ignore
        }
      }
    } catch (err) {
      console.error('❌ Generate AI recommendation error:', err);
      console.error('❌ Error stack:', err.stack);
    } finally {
      console.log('🔵 Setting generatingAI to false');
      setGeneratingAI(false);
    }
  };

  // Sort capabilities by urgency (based on avg score)
  const sortedCapabilities = Object.entries(CAPABILITY_META).sort(([aId], [bId]) => {
    const aPath = paths.find(p => p.capability === aId);
    const bPath = paths.find(p => p.capability === bId);
    const aScore = aPath?.avg_score || 3.5;
    const bScore = bPath?.avg_score || 3.5;
    return aScore - bScore; // lowest score = highest priority
  });

  const capModules = selectedCap
    ? MODULE_LIBRARY.filter(m => m.capability === selectedCap || m.capability === "all")
    : [];

  const selectedPath = paths.find(p => p.capability === selectedCap);
  const selectedMeta = selectedCap ? CAPABILITY_META[selectedCap] : null;
  const overallProgress = (() => {
    const totalModules = MODULE_LIBRARY.length;
    const totalCompleted = new Set(paths.flatMap(p => p.completed_modules || [])).size;
    return totalModules > 0 ? Math.round((totalCompleted / totalModules) * 100) : 0;
  })();

  return (
    <div className="min-h-screen" style={{ background: "#f0f4f8" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 md:px-10 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#39ACAC" }}>Signal Intelligence™</p>
              <h1 className="text-3xl font-bold" style={{ color: "#1A334D" }}>My Learning Paths</h1>
              <p className="text-sm text-gray-500 mt-1.5 max-w-xl">Personalized capability-based paths built from your roleplay performance. Track progress across all 8 Signal Intelligence™ capabilities.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-teal-50 border border-teal-100 rounded-xl px-5 py-3 text-center">
                <div className="text-2xl font-bold text-teal-600">{overallProgress}%</div>
                <div className="text-xs text-gray-500">Overall Progress</div>
              </div>
              <button
                onClick={analyzePerformanceAndBuildPaths}
                disabled={analyzingAll}
                className="inline-flex items-center gap-2 rounded-full border font-semibold transition-all duration-200 text-sm px-5 py-2.5 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] disabled:opacity-50"
              >
                {analyzingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {analyzingAll ? "Analyzing…" : "Analyze My Performance"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
        {sessions.length === 0 && paths.length === 0 && !loadingPaths && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center mb-8">
            <Play className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-700 mb-2">Start with the Role-Play Simulator</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">Complete at least one role-play session to generate your personalized learning paths. Your performance will automatically identify your strongest and weakest Signal Intelligence™ capabilities.</p>
            <Link to={createPageUrl("RolePlaySimulator")}>
              <button className="inline-flex items-center gap-2 rounded-full border font-semibold text-sm px-6 py-3 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] transition-all">
                <Play className="w-4 h-4" /> Go to Role-Play Simulator
              </button>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Capability List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Capabilities</h2>
              <span className="text-xs text-gray-400">Sorted by priority</span>
            </div>
            {loadingPaths ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : sortedCapabilities.map(([capId, meta]) => (
              <CapabilityCard
                key={capId}
                capability={capId}
                meta={meta}
                paths={paths}
                onSelect={setSelectedCap}
                selected={selectedCap}
              />
            ))}
          </div>

          {/* Right: Module Detail */}
          <div className="lg:col-span-2">
            {!selectedCap ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center h-full flex flex-col items-center justify-center">
                <BookOpen className="w-12 h-12 text-gray-200 mb-4" />
                <h3 className="font-bold text-gray-600 mb-2">Select a capability to see your learning path</h3>
                <p className="text-sm text-gray-400 max-w-sm">Each capability has a curated set of modules and exercises tailored to build that specific Signal Intelligence™ skill.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Capability Header */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ background: selectedMeta.color }} />
                        <h2 className="text-xl font-bold text-gray-900">{selectedMeta.label}</h2>
                        {selectedPath && (
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${URGENCY_CONFIG[selectedPath.urgency || "medium"].bg} ${URGENCY_CONFIG[selectedPath.urgency || "medium"].color} ${URGENCY_CONFIG[selectedPath.urgency || "medium"].border}`}>
                            {URGENCY_CONFIG[selectedPath.urgency || "medium"].label}
                          </span>
                        )}
                      </div>
                      {selectedPath?.avg_score && (
                        <div className="flex items-center gap-3">
                          <div className="w-48">
                            <ScoreBar score={selectedPath.avg_score} color={selectedMeta.color} />
                          </div>
                          <span className="text-xs text-gray-500">{selectedPath.session_count || 0} sessions analyzed</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        console.log('🔵 Button clicked! selectedCap:', selectedCap);
                        generateAIRecommendation(selectedCap);
                      }}
                      disabled={generatingAI === selectedCap}
                      className="inline-flex items-center gap-1.5 rounded-full border font-semibold text-xs px-3 py-1.5 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] transition-all flex-shrink-0"
                    >
                      {generatingAI === selectedCap ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {selectedPath?.ai_recommendation ? "Refresh AI Advice" : "Get AI Advice"}
                    </button>
                  </div>

                  {selectedPath?.ai_recommendation && (
                    <div className="mt-4 bg-teal-50 border border-teal-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4" style={{ color: "#39ACAC" }} />
                        <span className="text-xs font-bold" style={{ color: "#1A334D" }}>AI Personalized Recommendation</span>
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-700 text-xs leading-relaxed">
                        <ReactMarkdown>{selectedPath.ai_recommendation}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Progress */}
                  {(() => {
                    const completed = selectedPath?.completed_modules || [];
                    const total = capModules.length;
                    const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;
                    return (
                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#39ACAC" }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{completed.length}/{total} modules</span>
                        {pct === 100 && (
                          <span className="flex items-center gap-1 text-xs text-teal-600 font-bold">
                            <Award className="w-3.5 h-3.5" /> Complete!
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Modules */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-800">Learning Modules ({capModules.length})</h3>
                  {capModules.map(mod => (
                    <ModuleCard
                      key={mod.id}
                      module={mod}
                      completed={(selectedPath?.completed_modules || []).includes(mod.id)}
                      onToggle={(moduleId) => toggleModuleComplete(selectedCap, moduleId)}
                      onStartRoleplay={(mod) => {
                        window.location.href = createPageUrl("RolePlaySimulator");
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}