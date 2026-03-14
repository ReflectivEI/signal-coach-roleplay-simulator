import React from "react";
import { BarChart3 } from "lucide-react";
import SessionAnalytics from "@/components/analytics/SessionAnalytics";

export default function PerformanceAnalytics() {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto bg-slate-50/60 rounded-2xl">
      <div className="mb-6 rounded-2xl border border-slate-300 bg-gradient-to-r from-white to-slate-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-5 h-5 text-teal-500" />
          <h1 className="text-2xl font-bold text-[#1A334D]">Performance Analytics</h1>
        </div>
        <p className="text-slate-700 text-sm">Signal Intelligence scores, misalignment patterns, and capability trends across your role-play sessions.</p>
      </div>
      <SessionAnalytics />
    </div>
  );
}
