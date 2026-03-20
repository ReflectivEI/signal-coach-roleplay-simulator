import React from "react";
import { BarChart3 } from "lucide-react";
import SessionAnalytics from "@/components/analytics/SessionAnalytics";

export default function PerformanceAnalytics() {
  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-5 rounded-[24px] border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-teal-700" />
          <h1 className="text-2xl font-bold leading-tight text-slate-900">Performance Analytics</h1>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">Signal Intelligence scores, misalignment patterns, and capability trends across your role-play sessions.</p>
      </div>
      <div className="[&_svg]:shrink-0">
        <SessionAnalytics />
      </div>
    </div>
  );
}
