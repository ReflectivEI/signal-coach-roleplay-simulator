import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import AppHeader from '@/components/layout/AppHeader';
import ScenarioFilters, { applyScenarioFilters, DEFAULT_FILTERS } from '@/components/home/ScenarioFilters';
import { listPublishedScenarios } from '@/lib/scenarioStorage';

export default function ScenarioLibrary() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const navigate = useNavigate();

  useEffect(() => {
    const loadScenarios = async () => {
      setScenarios(await listPublishedScenarios());
      setLoading(false);
    };
    void loadScenarios();
  }, []);

  const filtered = applyScenarioFilters(scenarios, filters);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader maxWidthClassName="max-w-6xl" />

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Scenario Library</h1>
        </div>
        {/* Filters */}
        <div className="rounded-xl px-5 py-4 mb-6" style={{ background: "hsl(174 40% 97%)", border: "1px solid hsl(162 50% 80%)" }}>
          <ScenarioFilters filters={filters} onChange={setFilters} />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No scenarios match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((scenario, i) => (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-col p-4 rounded-lg border border-border/40 bg-surface/40 hover:bg-surface/60 transition-colors"
              >
                <div className="flex-1 min-w-0 mb-3">
                  <h3 className="font-semibold text-foreground text-sm mb-1">{scenario.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{scenario.description}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                    {scenario.journeyStage || 'N/A'}
                  </span>
                    <a
                      href="https://rps.reflectiv-ai.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      Start
                    </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
