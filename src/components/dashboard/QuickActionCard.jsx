import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { ChevronRight } from "lucide-react";

export default function QuickActionCard({ icon: Icon, title, description, page, iconBg }) {
  return (
    <Link
      to={createPageUrl(page)}
      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-teal-200 hover:shadow-md transition-all duration-300 group"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="w-5 h-5 text-teal-600" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm text-gray-900 group-hover:text-teal-700 transition-colors">{title}</h3>
        <p className="text-xs text-gray-600 mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition-colors flex-shrink-0" />
    </Link>
  );
}