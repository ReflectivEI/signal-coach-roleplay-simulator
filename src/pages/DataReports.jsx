import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// ...existing code...
import { AlertTriangle, Send, Loader2, Clock, Database, BarChart3, TrendingUp, FileText, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";

const SAMPLE_QUERIES = [
  "Show me the top 10 prescribers by total prescriptions in the last quarter",
  "What is the market share by product in my territory?",
  "Which physicians haven't been contacted in 30 days?",
  "Compare prescription trends for oncology vs cardiology",
];

export default function DataReports() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const translate = async (q) => {
    const question = q || query;
    if (!question.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const prompt = `You are a data analytics assistant for a pharmaceutical sales organization. A user has asked a business question. Provide a realistic summary of what the data would show for this query: "${question}"\n\nProvide:\n1. A brief answer to their question with realistic data estimates\n2. Key insights\n3. Recommended actions based on the data\n\nBe specific and provide realistic numbers where appropriate.`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 600 })
      });
      if (res.ok) {
        const data = await res.json();
        let reportResult = typeof data.response === 'string' ? data.response : String(data.response);
        // Strip markdown code blocks for clean display
        reportResult = reportResult.replace(/^```[\w]*\n?|\n?```$/g, '').trim();
        setResult(reportResult);
        const entry = { id: Date.now(), question, result: reportResult, timestamp: new Date().toLocaleString() };
        setHistory(prev => [entry, ...prev.slice(0, 9)]);
      } else {
        setResult("Unable to generate report. Please try again.");
      }
    } catch (err) {
      console.error('Data report error:', err);
      setResult("Unable to generate report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-teal-500" />
          <h1 className="text-2xl font-bold text-gray-900">Data and Reports</h1>
          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">Manager Access</Badge>
        </div>
        <p className="text-sm text-gray-500 mt-1">Translate natural language questions into SQL queries for sales data analysis</p>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 leading-relaxed">
          Data and Reports supports performance trends, coaching insights, and reporting for managers and leadership. This feature is not intended for daily sales representative workflows.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Role Plays Completed", value: "0", icon: BarChart3, color: "text-teal-500" },
          { label: "Avg. Score", value: "--", icon: TrendingUp, color: "text-blue-500" },
          { label: "Exercises Done", value: "0", icon: FileText, color: "text-purple-500" },
          { label: "This Month", value: "0 sessions", icon: Calendar, color: "text-orange-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{stat.label}</span>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Q&A */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Ask a Question</h2>
              <p className="text-sm text-gray-500 mb-4">Enter a natural language question about your sales data</p>
              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g., Show me the top 10 prescribers by total prescriptions in the last quarter"
                rows={4}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); translate(); } }}
                className="w-full text-sm rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none mb-3 leading-relaxed"
              />
              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-2 mb-4">
                {SAMPLE_QUERIES.slice(0, 2).map((sq, i) => (
                  <button key={i} onClick={() => { setQuery(sq); translate(sq); }} className="text-xs text-gray-500 hover:text-teal-600 bg-gray-100 hover:bg-teal-50 border border-gray-200 hover:border-teal-200 rounded-full px-3 py-1 transition-colors truncate max-w-[200px]">
                    {sq.slice(0, 35)}...
                  </button>
                ))}
              </div>
              <Button onClick={() => translate()} disabled={!query.trim() || isLoading} className="w-full text-white" style={{ background: "#39ACAC" }}>
                {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Translating...</> : <><Send className="w-4 h-4 mr-2" /> Translate</>}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          {result && (
            <Card>
              <CardContent className="p-6">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                  <ReactMarkdown
                    components={{
                      code: ({ node, inline, ...props }) => inline
                        ? <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-teal-700" {...props} />
                        : <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-xs font-mono my-3"><code {...props} /></pre>
                    }}
                  >{result}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Query History */}
        <div>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Query History</h2>
              </div>
              <p className="text-xs text-gray-400 mb-4">Recent translations</p>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No queries yet. Ask a question to get started.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h, i) => (
                    <button key={i} onClick={() => { setQuery(h.question); setResult(h.result); }} className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-teal-200 hover:bg-teal-50/50 transition-all">
                      <p className="text-xs font-medium text-gray-700 line-clamp-2 mb-1">{h.question}</p>
                      <p className="text-xs text-gray-400">{h.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}