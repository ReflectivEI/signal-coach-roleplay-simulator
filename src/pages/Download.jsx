import React from "react";
import { Download, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DownloadPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <FileArchive className="w-12 h-12 mx-auto mb-4 text-teal-500" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Download Project</h1>
        <p className="text-gray-600 mb-6">Export your project files as a ZIP archive.</p>
        
        <a
          href="/project-files.zip"
          download="signal-intelligence-project.zip"
        >
          <Button className="w-full bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            Download ZIP
          </Button>
        </a>
      </div>
    </div>
  );
}