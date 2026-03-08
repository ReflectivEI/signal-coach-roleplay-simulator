import React from "react";
import { Bot, Play, Dumbbell, GraduationCap, Download, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import QuickActionCard from "@/components/dashboard/QuickActionCard";
import SignalCapabilities from "@/components/dashboard/SignalCapabilities";
import AIDailyInsights from "@/components/dashboard/AIDailyInsights";
import MyAssignments from "@/components/rep/MyAssignments";

export default function Dashboard() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Welcome to Reflectiv<span className="text-teal-500">AI</span>
          </h1>
          <p className="text-gray-600 mt-1">Master signal intelligence and sales excellence in Life Sciences</p>
        </div>
        <Button variant="outline" className="mt-4 md:mt-0 flex items-center gap-2 text-sm">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      <AIDailyInsights />

      <MyAssignments />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-3">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Quick Actions</h2>
          <p className="text-sm text-gray-600 mb-4">Start your coaching journey</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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