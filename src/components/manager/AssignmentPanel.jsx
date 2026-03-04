import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList, Plus, CheckCircle2, Clock, AlertTriangle,
  BookOpen, Trash2, CalendarDays, Loader2
} from "lucide-react";

const TRAINING_MODULES = [
  { id: 1, capability: "signal_awareness", title: "Signal Awareness Masterclass", type: "Video + Practice", duration: "45 min" },
  { id: 2, capability: "signal_awareness", title: "Question Mastery Exercises", type: "Interactive", duration: "30 min" },
  { id: 3, capability: "signal_interpretation", title: "Listening & Responsiveness Drills", type: "Role-Play", duration: "60 min" },
  { id: 4, capability: "value_connection", title: "Clinical Evidence Framing", type: "Case Studies", duration: "40 min" },
  { id: 5, capability: "customer_engagement", title: "HCP Engagement Signals", type: "Video", duration: "25 min" },
  { id: 6, capability: "objection_navigation", title: "Objection Handling Workshop", type: "Role-Play", duration: "50 min" },
  { id: 7, capability: "conversation_management", title: "Conversation Structure & Flow", type: "Interactive", duration: "35 min" },
  { id: 8, capability: "adaptive_response", title: "Real-Time Adaptation Techniques", type: "Simulation", duration: "55 min" },
  { id: 9, capability: "commitment_generation", title: "Commitment Gaining Strategies", type: "Video + Practice", duration: "40 min" },
  { id: 10, capability: "signal_interpretation", title: "Stakeholder Mapping Intensive", type: "Workshop", duration: "60 min" },
];

const STATUS_CONFIG = {
  assigned: { color: "bg-blue-100 text-blue-700 border-blue-200", icon: ClipboardList, label: "Assigned" },
  in_progress: { color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock, label: "In Progress" },
  completed: { color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2, label: "Completed" },
  overdue: { color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle, label: "Overdue" },
};

export default function AssignmentPanel({ rep, assignments, onAssigned, onStatusChange, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [selectedModule, setSelectedModule] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const repAssignments = assignments.filter(a => a.rep_id === rep.id);

  const handleAssign = async () => {
    if (!selectedModule) return;
    setSaving(true);
    try {
      // In real implementation would POST to backend
      const module = TRAINING_MODULES.find(m => m.id === parseInt(selectedModule));
      const newAssignment = {
        id: `assign_${Date.now()}`,
        rep_id: rep.id,
        rep_name: rep.name,
        module_id: selectedModule,
        module_title: module?.title || "",
        assigned_date: new Date().toLocaleDateString(),
        deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        status: "pending",
        notes: notes || ""
      };
      // Would be added to assignments list on backend
      console.log('Assignment created:', newAssignment);
      setShowForm(false);
      setSelectedModule("");
      setDeadline("");
      setNotes("");
      onAssigned();
    } catch (err) {
      console.error('Assignment error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Suggest module based on weak capability
  const suggestedModules = TRAINING_MODULES.filter(m =>
    rep.weakCapability && m.capability.toLowerCase().includes(
      rep.weakCapability.toLowerCase().split(" ")[0].toLowerCase()
    )
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> Assigned Training ({repAssignments.length})
        </p>
        <Button size="sm" onClick={() => setShowForm(v => !v)} className="h-7 text-xs bg-teal-500 hover:bg-teal-600">
          <Plus className="w-3 h-3 mr-1" /> Assign
        </Button>
      </div>

      {/* AI Suggestion Banner */}
      {suggestedModules.length > 0 && !showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <p className="text-xs font-semibold text-amber-800 mb-1">💡 Suggested for {rep.weakCapability}</p>
          <button
            onClick={() => { setSelectedModule(String(suggestedModules[0].id)); setShowForm(true); }}
            className="text-xs text-amber-700 hover:text-amber-900 underline"
          >
            Quick-assign: {suggestedModules[0].title}
          </button>
        </div>
      )}

      {/* Assignment Form */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <Select value={selectedModule} onValueChange={setSelectedModule}>
            <SelectTrigger className="text-xs h-8">
              <SelectValue placeholder="Select a module..." />
            </SelectTrigger>
            <SelectContent>
              {TRAINING_MODULES.map(m => (
                <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                  {m.title} · {m.duration}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
          </div>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional note for rep..."
            className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
            onKeyDown={e => e.key === "Enter" && handleAssign()}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 h-7 text-xs bg-teal-500 hover:bg-teal-600" onClick={handleAssign} disabled={!selectedModule || saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Assign"}
            </Button>
          </div>
        </div>
      )}

      {/* Assignments List */}
      {repAssignments.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-3">No assignments yet</p>
      ) : (
        <div className="space-y-2">
          {repAssignments.map(a => {
            const statusCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.assigned;
            const StatusIcon = statusCfg.icon;
            const isOverdue = a.deadline && new Date(a.deadline) < new Date() && a.status !== "completed";
            const displayStatus = isOverdue ? "overdue" : a.status;
            const cfg = STATUS_CONFIG[displayStatus];
            return (
              <div key={a.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-gray-100 bg-white">
                <BookOpen className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{a.module_title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {a.deadline && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(a.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                  {a.notes && <p className="text-xs text-gray-400 mt-0.5 italic truncate">{a.notes}</p>}
                  {/* Status toggle */}
                  <select
                    value={a.status}
                    onChange={e => onStatusChange(a.id, e.target.value)}
                    className="mt-1.5 text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-600 cursor-pointer"
                  >
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <button onClick={() => onDelete(a.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}