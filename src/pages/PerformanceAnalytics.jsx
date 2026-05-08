import React from "react";
import SessionAnalytics from "@/components/analytics/SessionAnalytics";

export default function PerformanceAnalytics() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-6 pt-0 md:px-8 md:pb-8 md:pt-0">
      <div className="[&_svg]:shrink-0">
        <SessionAnalytics />
      </div>
    </div>
  );
}
