import React from "react";
import { BarChart3 } from "lucide-react";
import SessionAnalytics from "@/components/analytics/SessionAnalytics";

export default function PerformanceAnalytics() {
  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto bg-slate-50/60 rounded-2xl">
      <div className="mb-6 rounded-2xl border border-slate-300 bg-gradient-to-r from-white to-slate-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-5 h-5 text-[#1A334D]" />
          <h1 className="text-2xl font-bold text-[#1A334D]">Performance Analytics</h1>
        </div>
        <p className="text-sm text-slate-800">Signal Intelligence scores, misalignment patterns, and capability trends across your role-play sessions.</p>
      </div>
      <div className="[&_.text-gray-400]:!text-slate-600 [&_.text-gray-500]:!text-slate-700 [&_.text-gray-600]:!text-slate-700 [&_.text-slate-400]:!text-slate-600 [&_.text-slate-500]:!text-slate-700 [&_.text-slate-600]:!text-slate-800 [&_svg]:shrink-0">
        <SessionAnalytics />
      </div>
    </div>
  );
}
