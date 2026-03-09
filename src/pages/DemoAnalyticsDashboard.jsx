import React, { useState } from "react";
import { Download, BarChart2, FileText, ShieldCheck } from "lucide-react";

const demoKPIs = [
  { label: "Roleplay Sessions", value: 42 },
  { label: "Avg. Capability Score", value: "4.1" },
  { label: "Completed Modules", value: 18 },
  { label: "AI Recommendations Generated", value: 12 },
  { label: "Compliance Checks Passed", value: "100%" }
];

const demoCompliance = [
  { label: "HIPAA", status: "Passed" },
  { label: "GDPR", status: "Passed" },
  { label: "GxP", status: "Demo Only" }
];

export default function DemoAnalyticsDashboard() {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    // Simulate export
    setTimeout(() => {
      const csv = [
        "KPI,Value",
        ...demoKPIs.map(k => `${k.label},${k.value}`)
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kpi_report_demo.csv";
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-teal-600" /> Demo Analytics Dashboard
        </h1>
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3">Key Performance Indicators</h2>
          <ul className="grid grid-cols-2 gap-4">
            {demoKPIs.map(k => (
              <li key={k.label} className="bg-teal-50 rounded-lg p-4 flex flex-col items-center border border-teal-100">
                <div className="text-xl font-bold text-teal-700">{k.value}</div>
                <div className="text-xs text-gray-500 mt-1">{k.label}</div>
              </li>
            ))}
          </ul>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="mt-6 inline-flex items-center gap-2 rounded-full border font-semibold text-sm px-5 py-2 border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export KPI Report"}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-500" /> Compliance Report (Demo)
          </h2>
          <ul className="grid grid-cols-3 gap-4">
            {demoCompliance.map(c => (
              <li key={c.label} className="bg-gray-50 rounded-lg p-4 flex flex-col items-center border border-gray-200">
                <div className="text-sm font-bold text-gray-700">{c.label}</div>
                <div className={`text-xs mt-1 font-semibold ${c.status === "Passed" ? "text-green-600" : "text-yellow-600"}`}>{c.status}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" /> Sample Exported Report
          </h2>
          <pre className="bg-gray-100 rounded-lg p-4 text-xs text-gray-700 overflow-x-auto">
KPI,Value
Roleplay Sessions,42
Avg. Capability Score,4.1
Completed Modules,18
AI Recommendations Generated,12
Compliance Checks Passed,100%
          </pre>
        </div>
      </div>
    </div>
  );
}
