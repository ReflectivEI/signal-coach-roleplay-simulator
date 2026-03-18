import React, { useMemo } from "react";
import {
  Bot,
  Play,
  Dumbbell,
  GraduationCap,
  Route,
  Sparkles,
  Workflow,
  ShieldCheck,
  Mail,
  MessageSquareShare,
} from "lucide-react";
import { BarChart2 } from "lucide-react";
import QuickActionCard from "@/components/dashboard/QuickActionCard";
import SignalCapabilities from "@/components/dashboard/SignalCapabilities";
import AIDailyInsights from "@/components/dashboard/AIDailyInsights";

const DASHBOARD_THEME = {
  light: { pageBg: "#f0f4f8", cardBorder: "border-gray-200", accent: "text-teal-700", text: "text-gray-900", subtext: "text-gray-600" },
};

export default function Dashboard() {
  const notice = "Pipeline forecasting summary updated 2 min ago.";
  const theme = DASHBOARD_THEME.light;

  const quickActions = useMemo(() => ([
    { icon: BarChart2, title: "Analytics Dashboard", description: "View demo KPIs, export reports, and compliance status", page: "demo-analytics", iconBg: "bg-teal-50" },
    { icon: Bot, title: "AI Coach", description: "Get personalized coaching and feedback", page: "AICoach", iconBg: "bg-teal-50" },
    { icon: Play, title: "Role Play Simulator", description: "Practice Signal Intelligence™ in realistic scenarios", page: "RolePlaySimulator", iconBg: "bg-cyan-50" },
    { icon: Dumbbell, title: "Exercises", description: "Practice with interactive skill-building exercises", page: "Exercises", iconBg: "bg-teal-50" },
    { icon: GraduationCap, title: "Coaching Modules", description: "Structured learning paths for pharma sales mastery", page: "CoachingModules", iconBg: "bg-cyan-50" },
    { icon: Route, title: "My Learning Paths", description: "AI-personalized paths based on your roleplay performance", page: "LearningPaths", iconBg: "bg-teal-50" },
  ]), []);

  const openEmail = () => {
    const subject = encodeURIComponent("ReflectivAI Dashboard Digest");
    const body = encodeURIComponent("Sharing the latest forecasting and enablement insights from ReflectivAI.");
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const openSlack = () => {
    window.open("https://slack.com/app_redirect?channel=general", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto" style={{ background: theme.pageBg }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-3">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold ${theme.text}`}>
            Welcome to Reflectiv<span className="text-teal-500">AI</span>
          </h1>
          <p className={`${theme.subtext} mt-1`}>Master signal intelligence and sales excellence in Life Sciences</p>
          <p className={`text-xs mt-1 ${theme.accent}`}>{notice}</p>
        </div>
        {/* Color mode + PDF export intentionally hidden; light mode remains default. */}
      </div>

      <AIDailyInsights />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Quick Actions */}
        <div className={`lg:col-span-3 rounded-2xl border ${theme.cardBorder} bg-white p-5 shadow-sm`}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Quick Actions</h2>
              <p className="text-sm text-gray-600">Start your coaching journey</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
              <Sparkles className="w-3.5 h-3.5" />
              Recommended
            </span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={openSlack} className="inline-flex items-center gap-1.5 rounded-full border border-[#1A334D] px-3 py-1 text-xs font-semibold text-[#1A334D] hover:bg-slate-50">
              <MessageSquareShare className="w-3.5 h-3.5" /> Share to Slack
            </button>
            <button onClick={openEmail} className="inline-flex items-center gap-1.5 rounded-full border border-teal-300 px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50">
              <Mail className="w-3.5 h-3.5" /> Send Email
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <QuickActionCard key={action.title} {...action} />
            ))}
          </div>
        </div>

        {/* Signal Intelligence Capabilities */}
        <div className="lg:col-span-2">
          <div className="space-y-3">
            <SignalCapabilities />
            <div className={`rounded-2xl border ${theme.cardBorder} bg-white p-4 shadow-sm`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Platform Quality</p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-teal-600" />
                  Deterministic behavioral scoring engine with explicit rules.
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <Workflow className="w-4 h-4 mt-0.5 text-teal-600" />
                  Unified Signal Intelligence™ workflows across coaching tools.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
