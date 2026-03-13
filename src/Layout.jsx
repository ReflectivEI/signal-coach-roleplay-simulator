import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, LayoutDashboard, Play, Bot, ClipboardList, Dumbbell, GraduationCap,
  BarChart3, FileText, Globe, BookOpen, HelpCircle, Settings, ChevronRight,
  ChevronDown, Bell, User, Moon, PenSquare, TrendingUp, UserCircle, Users, Route
} from "lucide-react";

const navSections = [
  {
    label: "Core Activities",
    icon: Target,
    defaultOpen: true,
    items: [
      { label: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
      { label: "Role Play Simulator", page: "RolePlaySimulator", icon: Play },
      { label: "Scenario Builder", page: "ScenarioBuilder", icon: PenSquare },
      { label: "AI Coach", page: "AICoach", icon: Bot },
      { label: "Pre-Call Planning", page: "PreCallPlanning", icon: ClipboardList },
      { label: "Exercises", page: "Exercises", icon: Dumbbell },
      { label: "Coaching Modules", page: "CoachingModules", icon: GraduationCap },
      { label: "My Learning Paths", page: "LearningPaths", icon: Route },
    ],
  },
  {
    label: "Insights & Measurement",
    icon: BarChart3,
    defaultOpen: false,
    items: [
      { label: "Behavioral Metrics", page: "BehavioralMetrics", icon: BarChart3 },
      { label: "Performance Analytics", page: "PerformanceAnalytics", icon: TrendingUp },
      { label: "Data and Reports", page: "DataReports", icon: FileText },
    ],
  },
  {
    label: "Enablement",
    icon: Globe,
    defaultOpen: false,
    items: [
      { label: "Selling and Coaching Frameworks", page: "Frameworks", icon: Globe },
      { label: "Knowledge Base", page: "KnowledgeBase", icon: BookOpen },
    ],
  },
  {
    label: "Manager",
    icon: Users,
    defaultOpen: false,
    items: [
      { label: "Manager View", page: "ManagerView", icon: Users },
    ],
  },
  {
    label: "System",
    icon: Settings,
    defaultOpen: false,
    items: [
      { label: "Help Center", page: "HelpCenter", icon: HelpCircle },
    ],
  },
];


export default function Layout({ children, currentPageName }) {
  const [openSections, setOpenSections] = useState(
    navSections.reduce((acc, s) => ({ ...acc, [s.label]: s.defaultOpen }), {})
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const { user: authUser, logout } = useAuth();

  useEffect(() => {
    const handler = (e) => { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleSection = (label) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };



  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f0f4f8" }}>
      <style>{`
        :root {
          --brand-navy:   #1A334D;
          --brand-teal:   #39ACAC;
          --brand-teal-light: #e6f7f7;
          --brand-pale-yellow: #fefce8;
          --brand-light-gray: #f0f4f8;
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #39ACAC44; border-radius: 4px; }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — navy background matching marketing site */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-72 flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden"
          }`}
        style={{ background: "#1A334D", borderRight: "1px solid #22405f" }}
      >
        {/* Brand */}
        <div className="p-4 flex items-center gap-3 border-b" style={{ borderColor: "#22405f" }}>
          <div className="flex-shrink-0">
            {/* ReflectivAI Logo Icon - navy globe with leaf */}
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="20" fill="#1A334D" />
              {/* globe arc bottom */}
              <path d="M6 28 Q20 38 34 28" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              {/* outer ring */}
              <circle cx="20" cy="18" r="11" stroke="white" strokeWidth="1.8" fill="none" />
              {/* inner leaf/teardrop */}
              <path d="M20 10 C24 14 24 22 20 26 C16 22 16 14 20 10Z" fill="white" />
            </svg>
          </div>
          <div>
            <div className="flex items-baseline gap-0">
              <span className="text-sm font-bold text-white tracking-wide">Reflectiv</span>
              <span className="text-sm font-bold tracking-wide" style={{ color: "#39ACAC" }}>AI</span>
            </div>
            <span className="text-xs" style={{ color: "#39ACAC" }}>Sales Enablement</span>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-3 border-b relative" style={{ borderColor: "#22405f" }} ref={userMenuRef}>
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-white/10 transition-colors"
            onClick={() => setUserMenuOpen(v => !v)}
          >
            <div className="w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#39ACAC" }}>
              {authUser?.name ? authUser.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                {authUser?.name || authUser?.email || "Loading…"}
                {authUser?.role === "admin" && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#39ACAC22", color: "#39ACAC", border: "1px solid #39ACAC55" }}>ADMIN</span>
                )}
              </div>
              <div className="text-xs truncate" style={{ color: "#39ACAC" }}>{authUser?.email || ""}</div>
            </div>
            <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} style={{ color: "#39ACAC" }} />
          </div>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute left-4 right-4 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden"
              >
                <div className="px-4 py-2.5 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">My Account</p>
                </div>
                <Link
                  to={createPageUrl("ProfileSettings")}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <UserCircle className="w-4 h-4 text-gray-400" />
                  Profile & Settings
                </Link>
                {authUser?.role === "admin" && (
                  <Link
                    to={createPageUrl("ManagerView")}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                  >
                    <Users className="w-4 h-4 text-gray-400" />
                    Admin / Manager View
                  </Link>
                )}
                <button
                  onClick={() => logout(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-gray-100"
                >
                  <Settings className="w-4 h-4" />
                  Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navSections.map((section) => (
            <div key={section.label} className="mb-1">
              <button
                onClick={() => toggleSection(section.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 text-xs font-bold uppercase tracking-wider ${openSections[section.label]
                  ? "text-white"
                  : "text-white/50 hover:text-white/80"
                  }`}
              >
                <section.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{section.label}</span>
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform duration-200 flex-shrink-0 ${openSections[section.label] ? "rotate-90" : ""
                    }`}
                />
              </button>
              {openSections[section.label] && (
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = currentPageName === item.page;
                    return (
                      <motion.div
                        key={item.page}
                        whileHover={{ x: 3 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Link
                          to={createPageUrl(item.page)}
                          className={`flex items-center gap-3 pl-3 pr-2 py-2 rounded-md text-sm transition-all duration-200 ${isActive
                            ? "text-white font-semibold"
                            : "text-white/60 hover:text-white hover:bg-white/10"
                            }`}
                          style={isActive ? { background: "#39ACAC" } : {}}
                          onClick={() => {
                            if (window.innerWidth < 768) setSidebarOpen(false);
                          }}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md hover:bg-gray-100"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="#1A334D" />
                <path d="M6 28 Q20 38 34 28" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <circle cx="20" cy="18" r="11" stroke="white" strokeWidth="1.8" fill="none" />
                <path d="M20 10 C24 14 24 22 20 26 C16 22 16 14 20 10Z" fill="white" />
              </svg>
              <div className="flex items-baseline gap-0">
                <span className="font-bold text-sm tracking-wide" style={{ color: "#1A334D" }}>Reflectiv</span>
                <span className="font-bold text-sm tracking-wide" style={{ color: "#39ACAC" }}>AI</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <User className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <Moon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}