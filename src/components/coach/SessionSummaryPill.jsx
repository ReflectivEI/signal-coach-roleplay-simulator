// @ts-nocheck
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Download, X, Sparkles, Clock3, ClipboardList, ChevronRight } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * @typedef {{
 *   title?: string,
 *   score?: number | string,
 *   duration?: string,
 *   summary?: string,
 * } | null} SessionSummaryData
 */

const ButtonField = /** @type {any} */ (Button);
const CardField = /** @type {any} */ (Card);

function normalizeSummary(summary = "") {
  return String(summary).replace(/\r/g, "").replace(/^#{1,6}\s*/gm, "").trim();
}

function buildSummarySections(summary = "") {
  const cleaned = normalizeSummary(summary);
  if (!cleaned) return [];

  return cleaned
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, idx) => {
      const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
      const firstLine = lines[0] || "";
      const hasHeader = lines.length > 1 && firstLine.length <= 48;

      return {
        title: hasHeader ? firstLine : idx === 0 ? "Executive Summary" : `Insight ${idx + 1}`,
        bullets: (hasHeader ? lines.slice(1) : lines)
          .map((line) => line.replace(/^[-*•]\s*/, "").trim())
          .filter(Boolean),
      };
    });
}

/** @param {{ sessionData: SessionSummaryData }} props */
export default function SessionSummaryPill({ sessionData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const sections = useMemo(() => buildSummarySections(sessionData?.summary || ""), [sessionData]);

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById("session-summary-content");
      if (!element) {
        throw new Error("Session summary content not found");
      }
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
      pdf.save("session-summary.pdf");
    } catch (e) {
      console.error("Export failed:", e);
    }
    setIsExporting(false);
  };

  if (!sessionData) return (
    <ButtonField size="sm" variant="outline" className="text-xs border-gray-200 text-gray-400 cursor-not-allowed flex items-center gap-1" disabled>
      <FileText className="w-3 h-3" />
      Session Summary
    </ButtonField>
  );

  return (
    <>
      <ButtonField
        size="sm"
        variant="outline"
        className="text-xs border-teal-300 text-teal-600 hover:bg-teal-50 flex items-center gap-1"
        onClick={() => setIsOpen(true)}
      >
        <FileText className="w-3 h-3" />
        Session Summary
      </ButtonField>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <CardField className="w-full max-w-4xl max-h-[86vh] overflow-y-auto rounded-[28px] border border-[#1A334D]/12 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200/90 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1A334D_0%,#39ACAC_100%)] text-white shadow-sm">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-teal-600">Session Summary</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">Executive Recap</h2>
                  <p className="mt-1 text-sm text-slate-600">A cleaner, export-ready view of your AI Coach session recap.</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div id="session-summary-content" className="space-y-6 p-6 md:p-7">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {sessionData.title && (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Session</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{sessionData.title}</p>
                  </div>
                )}
                {sessionData.score && (
                  <div className="rounded-2xl border border-teal-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.9)_0%,rgba(240,253,250,0.95)_100%)] px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700">Overall Score</p>
                    <p className="mt-2 text-3xl font-bold text-teal-700">{sessionData.score}/5</p>
                  </div>
                )}
                {sessionData.duration && (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      <Clock3 className="w-3.5 h-3.5 text-teal-600" />
                      Duration
                    </div>
                    <p className="mt-2 text-base font-semibold text-slate-900">{sessionData.duration}</p>
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-[#1A334D]/10 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-700">Summary Narrative</h3>
                </div>
                {sections.length > 0 ? (
                  <div className="space-y-4">
                    {sections.map((section, idx) => (
                      <div key={`${section.title}-${idx}`} className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[11px] font-bold text-teal-700">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-800">{section.title}</h4>
                        </div>
                        <div className="mt-3 space-y-2">
                          {section.bullets.map((line, lineIdx) => (
                            <div key={lineIdx} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
                              <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-teal-500" />
                              <span>{line}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm leading-7 text-slate-700">{normalizeSummary(sessionData.summary)}</p>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
              <ButtonField variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                Close
              </ButtonField>
              <ButtonField
                size="sm"
                className="bg-teal-500 hover:bg-teal-600 text-white flex items-center gap-1"
                onClick={exportToPDF}
                disabled={isExporting}
              >
                <Download className="w-3 h-3" />
                {isExporting ? "Exporting..." : "Export PDF"}
              </ButtonField>
            </div>
          </CardField>
        </div>
      )}
    </>
  );
}
