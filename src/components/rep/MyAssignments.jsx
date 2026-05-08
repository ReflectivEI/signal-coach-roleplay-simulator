import React, { useState, useEffect } from "react";
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, BookOpen, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_CONFIG = {
  assigned: { color: "bg-blue-100 text-blue-700", label: "Assigned", icon: ClipboardList },
  in_progress: { color: "bg-amber-100 text-amber-700", label: "In Progress", icon: Clock },
  completed: { color: "bg-green-100 text-green-700", label: "Completed", icon: CheckCircle2 },
  overdue: { color: "bg-red-100 text-red-700", label: "Overdue", icon: AlertTriangle },
};

// Hardcoded to show assignments for rep ID 1 (current user simulation)
const CURRENT_REP_ID = 1;

export default function MyAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assignments', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      } else {
        setAssignments([]);
      }
    } catch (err) {
      console.error('Load assignments error:', err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markInProgress = async (id) => {
    try {
      const res = await fetch('/api/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'in_progress' })
      });
      if (res.ok) {
        load();
      }
    } catch (err) {
      console.error('Mark in progress error:', err);
      load();
    }
  };

  const pending = assignments.filter(a => a.status !== "completed");
  const completed = assignments.filter(a => a.status === "completed");

  if (loading) return null;
  if (assignments.length === 0) return null;

  return (
    <div className="rounded-xl border border-teal-100 bg-white mb-6 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-teal-50 hover:bg-teal-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-bold text-teal-900">My Assigned Training</span>
          {pending.length > 0 && (
            <span className="text-xs bg-teal-500 text-white rounded-full px-2 py-0.5 font-bold">{pending.length}</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-teal-500" /> : <ChevronDown className="w-4 h-4 text-teal-500" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-2">
          {pending.length === 0 && completed.length > 0 && (
            <p className="text-xs text-center text-green-600 font-semibold py-2">🎉 All assignments complete!</p>
          )}
          {[...pending, ...completed].map(a => {
            const isOverdue = a.deadline && new Date(a.deadline) < new Date() && a.status !== "completed";
            const statusKey = isOverdue ? "overdue" : a.status;
            const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.assigned;
            const StatusIcon = cfg.icon;
            return (
              <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${a.status === "completed" ? "border-green-100 bg-green-50 opacity-70" : "border-gray-100 bg-gray-50"}`}>
                <BookOpen className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-tight">{a.module_title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3 inline mr-0.5" />{cfg.label}
                    </span>
                    {a.deadline && (
                      <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-500 font-semibold" : "text-gray-400"}`}>
                        <CalendarDays className="w-3 h-3" />
                        Due {new Date(a.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                  {a.notes && <p className="text-xs text-gray-400 mt-1 italic">{a.notes}</p>}
                </div>
                {a.status === "assigned" && (
                  <button
                    onClick={() => markInProgress(a.id)}
                    className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex-shrink-0 border border-teal-200 rounded px-2 py-0.5"
                  >
                    Start
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}