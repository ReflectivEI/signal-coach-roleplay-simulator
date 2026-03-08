import React from "react";
import { Bot, Play, Dumbbell, GraduationCap, Download, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import QuickActionCard from "@/components/dashboard/QuickActionCard";
import SignalCapabilities from "@/components/dashboard/SignalCapabilities";
import AIDailyInsights from "@/components/dashboard/AIDailyInsights";
import MyAssignments from "@/components/rep/MyAssignments";

export default function Dashboard() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-brand-navy tracking-wide mb-2">
            Welcome to Reflectiv<span className="text-brand-teal">AI</span>
          </h1>
          <p className="text-lg text-gray-700 mt-1 font-medium">Master signal intelligence and sales excellence in Life Sciences</p>
        </div>
        <Button variant="outline" className="mt-4 md:mt-0 flex items-center gap-2 text-lg font-semibold border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white transition-all duration-200">
          <Download className="w-5 h-5" />
          Export Report
        </Button>
      </div>

      <AIDailyInsights />

      <MyAssignments />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-3">
          <h2 className="text-2xl font-bold text-brand-navy mb-2 tracking-wide">Quick Actions</h2>
          <p className="text-md text-brand-teal mb-4 font-medium">Start your coaching journey</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickActionCard
              icon={Bot}
              title="AI Coach"
              description="Get personalized coaching and feedback"
              page="AICoach"
              iconBg="bg-teal-50"
            />
            <QuickActionCard
              icon={Play}
              title="Role Play Simulator"
              description="Practice Signal Intelligence™ in realistic scenarios"
              page="RolePlaySimulator"
              iconBg="bg-cyan-50"
            />
            <QuickActionCard
              icon={Dumbbell}
              title="Exercises"
              description="Practice with interactive skill-building exercises"
              page="Exercises"
              iconBg="bg-teal-50"
            />
            <QuickActionCard
              icon={GraduationCap}
              title="Coaching Modules"
              description="Structured learning paths for pharma sales mastery"
              page="CoachingModules"
              iconBg="bg-cyan-50"
            />
            <QuickActionCard
              icon={Route}
              title="My Learning Paths"
              description="AI-personalized paths based on your roleplay performance"
              page="LearningPaths"
              iconBg="bg-teal-50"
            />
          </div>
        </div>

        {/* Signal Intelligence Capabilities */}
        <div className="lg:col-span-2">
          <SignalCapabilities />
        </div>
      </div>
    </div>
  );
}