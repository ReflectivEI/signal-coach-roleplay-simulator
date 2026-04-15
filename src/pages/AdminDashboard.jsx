import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Eye, EyeOff, Plus, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { listAllScenarios, updateCustomScenario, deleteCustomScenario } from "@/lib/scenarioStorage";

export default function AdminDashboard() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setScenarios(await listAllScenarios());
      setLoading(false);
    };
    void load();
  }, []);

  const handleToggleVisibility = async (id, isPublished) => {
    await updateCustomScenario(id, { isPublished: !isPublished });
    setScenarios((current) => current.map((s) => s.id === id ? { ...s, isPublished: !isPublished } : s));
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete "${title}"?`)) return;
    await deleteCustomScenario(id);
    setScenarios((current) => current.filter((s) => s.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40 bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">Scenario Management</h1>
          </div>
          <button onClick={() => navigate("/builder")} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Create Scenario
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {scenarios.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">No scenarios yet</p>
            </div>
          ) : (
            scenarios.map((scenario, i) => (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start justify-between p-4 rounded-lg border border-border/40 bg-surface/40 hover:bg-surface/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm">{scenario.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{scenario.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{scenario.journeyStage || "N/A"}</span>
                    <span className="text-xs text-muted-foreground">Built-in: {scenario.isBuiltIn ? "Yes" : "No"}</span>
                  </div>
                </div>
                {!scenario.isBuiltIn && (
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => handleToggleVisibility(scenario.id, scenario.isPublished)}
                      className="p-1.5 rounded hover:bg-surface/80 transition-colors text-muted-foreground hover:text-foreground"
                      title={scenario.isPublished ? "Unpublish" : "Publish"}
                    >
                      {scenario.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(scenario.id, scenario.title)}
                      className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
