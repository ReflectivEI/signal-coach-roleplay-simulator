import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Download, X } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function SessionSummaryPill({ sessionData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById("session-summary-content");
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
    <Button size="sm" variant="outline" className="text-xs border-gray-200 text-gray-400 cursor-not-allowed flex items-center gap-1" disabled>
      <FileText className="w-3 h-3" />
      Session Summary
    </Button>
  );

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="text-xs border-teal-300 text-teal-600 hover:bg-teal-50 flex items-center gap-1"
        onClick={() => setIsOpen(true)}
      >
        <FileText className="w-3 h-3" />
        Session Summary
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Session Summary</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div id="session-summary-content" className="p-6 space-y-4">
              <div className="space-y-3">
                {sessionData.title && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Scenario</h3>
                    <p className="text-sm font-medium text-gray-900">{sessionData.title}</p>
                  </div>
                )}
                {sessionData.score && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Overall Score</h3>
                    <p className="text-2xl font-bold text-teal-600">{sessionData.score}/5</p>
                  </div>
                )}
                {sessionData.duration && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Duration</h3>
                    <p className="text-sm text-gray-700">{sessionData.duration}</p>
                  </div>
                )}
                {sessionData.summary && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Summary</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{sessionData.summary}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                className="bg-teal-500 hover:bg-teal-600 text-white flex items-center gap-1"
                onClick={exportToPDF}
                disabled={isExporting}
              >
                <Download className="w-3 h-3" />
                {isExporting ? "Exporting..." : "Export PDF"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}