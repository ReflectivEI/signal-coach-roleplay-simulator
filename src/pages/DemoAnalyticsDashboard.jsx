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
  const [exporting, setExporting] = React.useState(false);
  const [sortField, setSortField] = React.useState('name');
  const [sortAsc, setSortAsc] = React.useState(true);
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [filterCompliance, setFilterCompliance] = React.useState('all');
  const [hoveredBar, setHoveredBar] = React.useState(null);

  // Mock user data for enterprise analytics
  const mockUsers = [
    { name: "Alice Smith", role: "Sales Rep", sessions: 12, avgScore: 4.3, completedModules: 8, compliance: true },
    { name: "Bob Johnson", role: "Manager", sessions: 5, avgScore: 4.7, completedModules: 12, compliance: true },
    { name: "Carol Lee", role: "Sales Rep", sessions: 9, avgScore: 3.9, completedModules: 6, compliance: false },
    { name: "David Kim", role: "Sales Rep", sessions: 15, avgScore: 4.5, completedModules: 10, compliance: true },
    { name: "Eve Patel", role: "Sales Rep", sessions: 7, avgScore: 4.0, completedModules: 5, compliance: true },
    { name: "Frank Wu", role: "Sales Rep", sessions: 10, avgScore: 4.2, completedModules: 7, compliance: true },
    { name: "Grace Lin", role: "Manager", sessions: 8, avgScore: 4.6, completedModules: 11, compliance: true },
    { name: "Henry Ford", role: "Sales Rep", sessions: 6, avgScore: 3.8, completedModules: 4, compliance: false },
    { name: "Ivy Chen", role: "Sales Rep", sessions: 13, avgScore: 4.4, completedModules: 9, compliance: true },
    { name: "Jack Lee", role: "Sales Rep", sessions: 11, avgScore: 4.1, completedModules: 6, compliance: true }
  ];

  const demoKPIs = [
    { label: "Total Users", value: mockUsers.length },
    { label: "Roleplay Sessions", value: mockUsers.reduce((sum, u) => sum + u.sessions, 0) },
    { label: "Avg. Capability Score", value: (mockUsers.reduce((sum, u) => sum + u.avgScore, 0) / mockUsers.length).toFixed(2) },
    { label: "Completed Modules", value: mockUsers.reduce((sum, u) => sum + u.completedModules, 0) },
    { label: "Compliance Rate", value: ((mockUsers.filter(u => u.compliance).length / mockUsers.length) * 100).toFixed(0) + "%" }
  ];

  const demoCompliance = [
    { label: "HIPAA", status: "Passed" },
    { label: "GDPR", status: "Passed" },
    { label: "GxP", status: "Demo Only" }
  ];

  const monthlySessions = [12, 15, 18, 22, 19, 25, 28, 30, 27, 32, 35, 40];
  const monthlyScores = [4.1, 4.2, 4.3, 4.0, 4.4, 4.5, 4.3, 4.6, 4.5, 4.7, 4.8, 4.9];

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      const usersToExport = mockUsers.filter(u =>
        filterCompliance === 'all' ? true : (filterCompliance === 'compliant' ? u.compliance : !u.compliance)
      );
      const csv = [
        "Name,Role,Sessions,AvgScore,CompletedModules,Compliance",
        ...usersToExport.map(u => `${u.name},${u.role},${u.sessions},${u.avgScore},${u.completedModules},${u.compliance ? "Yes" : "No"}`)
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "enterprise_analytics_demo.csv";
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-teal-600" /> Enterprise Analytics Dashboard (Demo)
        </h1>
        {/* KPIs */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3">Key Performance Indicators</h2>
          <ul className="grid grid-cols-5 gap-4">
            {demoKPIs.map(k => (
              <li key={k.label} className="bg-teal-50 rounded-lg p-4 flex flex-col items-center border border-teal-100" title={`KPI: ${k.label}`}> {/* Tooltip */}
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
            {exporting ? "Exporting..." : "Export User Analytics Report"}
          </button>
        </div>

        {/* User Table with sorting and modal */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-500" /> User Performance Overview
          </h2>
          <div className="mb-4 flex gap-2">
            <label className="text-xs font-semibold">Filter:</label>
            <select value={filterCompliance} onChange={e => setFilterCompliance(e.target.value)} className="text-xs border rounded px-2 py-1">
              <option value="all">All</option>
              <option value="compliant">Compliant</option>
              <option value="noncompliant">Non-Compliant</option>
            </select>
          </div>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {['name','role','sessions','avgScore','completedModules','compliance'].map(field => (
                  <th key={field} className="p-2 cursor-pointer" onClick={() => {
                    setSortField(field);
                    setSortAsc(sortField === field ? !sortAsc : true);
                  }}>
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                    {sortField === field ? (sortAsc ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockUsers
                .filter(u => filterCompliance === 'all' ? true : (filterCompliance === 'compliant' ? u.compliance : !u.compliance))
                .sort((a, b) => {
                  if (a[sortField] < b[sortField]) return sortAsc ? -1 : 1;
                  if (a[sortField] > b[sortField]) return sortAsc ? 1 : -1;
                  return 0;
                })
                .map(u => (
                  <tr key={u.name} className="border-b last:border-b-0 hover:bg-teal-50 cursor-pointer" onClick={() => setSelectedUser(u)}>
                    <td className="p-2 font-medium text-gray-700">{u.name}</td>
                    <td className="p-2 text-gray-500">{u.role}</td>
                    <td className="p-2 text-gray-700">{u.sessions}</td>
                    <td className="p-2 text-gray-700">{u.avgScore}</td>
                    <td className="p-2 text-gray-700">{u.completedModules}</td>
                    <td className="p-2">
                      {u.compliance ? <ShieldCheck className="w-4 h-4 text-green-500" /> : <BarChart2 className="w-4 h-4 text-red-500" />}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {/* User detail modal */}
          {selectedUser && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl border border-gray-200 p-6 w-96 relative">
                <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-700" onClick={() => setSelectedUser(null)}>&times;</button>
                <h3 className="text-lg font-bold mb-2">User Details</h3>
                <div className="space-y-2">
                  <div><span className="font-semibold">Name:</span> {selectedUser.name}</div>
                  <div><span className="font-semibold">Role:</span> {selectedUser.role}</div>
                  <div><span className="font-semibold">Sessions:</span> {selectedUser.sessions}</div>
                  <div><span className="font-semibold">Avg Score:</span> {selectedUser.avgScore}</div>
                  <div><span className="font-semibold">Completed Modules:</span> {selectedUser.completedModules}</div>
                  <div><span className="font-semibold">Compliance:</span> {selectedUser.compliance ? 'Yes' : 'No'}</div>
                  <div className="mt-2 text-xs text-gray-500">Click outside or &times; to close.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trends & Visualizations */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-green-500" /> Monthly Performance Trends
          </h2>
          <div className="flex gap-8">
            <div className="flex-1">
              <h3 className="text-xs font-bold text-gray-700 mb-2">Roleplay Sessions</h3>
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-end gap-1 h-32">
                  {monthlySessions.map((v, i) => (
                    <div
                      key={i}
                      className={`w-4 rounded-lg ${hoveredBar === i ? 'bg-teal-700' : 'bg-teal-400'}`}
                      style={{ height: `${v * 3}px` }}
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <span className="block text-[10px] text-center text-teal-900 mt-1">{v}</span>
                      {hoveredBar === i && (
                        <div className="absolute bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 shadow-lg" style={{ left: `${i * 32}px`, top: '-30px' }}>
                          Month {i+1}: {v} sessions
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-2">
                  {Array.from({ length: 12 }, (_, i) => <span key={i}>{"M" + (i + 1)}</span>)}
                </div>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-bold text-gray-700 mb-2">Avg Capability Score</h3>
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-end gap-1 h-32">
                  {monthlyScores.map((v, i) => (
                    <div
                      key={i}
                      className={`w-4 rounded-lg ${hoveredBar === 'score'+i ? 'bg-blue-700' : 'bg-blue-400'}`}
                      style={{ height: `${v * 20}px` }}
                      onMouseEnter={() => setHoveredBar('score'+i)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <span className="block text-[10px] text-center text-blue-900 mt-1">{v}</span>
                      {hoveredBar === 'score'+i && (
                        <div className="absolute bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-700 shadow-lg" style={{ left: `${i * 32}px`, top: '-30px' }}>
                          Month {i+1}: {v} avg score
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-2">
                  {Array.from({ length: 12 }, (_, i) => <span key={i}>{"M" + (i + 1)}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Report */}
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

        {/* Sample Exported Report */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" /> Sample Exported User Analytics Report
          </h2>
          <pre className="bg-gray-100 rounded-lg p-4 text-xs text-gray-700 overflow-x-auto">
Name,Role,Sessions,AvgScore,CompletedModules,Compliance
Alice Smith,Sales Rep,12,4.3,8,Yes
Bob Johnson,Manager,5,4.7,12,Yes
Carol Lee,Sales Rep,9,3.9,6,No
David Kim,Sales Rep,15,4.5,10,Yes
Eve Patel,Sales Rep,7,4.0,5,Yes
          </pre>
        </div>
      </div>
    </div>
  );
}
