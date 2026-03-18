import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, LayoutDashboard, Play, Bot, ClipboardList, Dumbbell, GraduationCap,
  BarChart3, FileText, Globe, BookOpen, HelpCircle, Settings, ChevronRight,
  ChevronDown, Bell, User, PenSquare, TrendingUp, UserCircle, Users, Route, MessageCircle, Send
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState([
    { role: "assistant", content: "Hi! I'm Alora. I can help you learn about ReflectivAI and how Signal Intelligence works. What would you like to know?" },
  ]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const userMenuRef = useRef(null);
  const notifMenuRef = useRef(null);
  const assistantRef = useRef(null);
  const { user: authUser, logout } = useAuth();

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("app-color-mode", "light");
    window.dispatchEvent(new CustomEvent("app-color-mode-changed", { detail: "light" }));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) setNotificationsOpen(false);
      if (assistantRef.current && !assistantRef.current.contains(e.target) && !e.target.closest("[data-chat-trigger='true']")) setAssistantOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleSection = (label) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const sendAssistantMessage = async () => {
    const text = assistantInput.trim();
    if (!text || assistantLoading) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...assistantMessages, userMsg];
    setAssistantMessages(newMessages);
    setAssistantInput("");
    setAssistantLoading(true);

    try {
      const prompt = `You are Alora, the ReflectivAI Assistant. Answer platform navigation and usage questions in concise, polished, enterprise-grade guidance.\n\nConversation:\n${newMessages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")}`;
      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 300 }),
      });
      const data = await res.json().catch(() => ({}));
      const responseText = String(data?.response || data?.text || data?.content || "I couldn’t generate an answer right now. Please try again.");
      setAssistantMessages((prev) => [...prev, { role: "assistant", content: responseText }]);
    } catch {
      setAssistantMessages((prev) => [...prev, { role: "assistant", content: "Service is temporarily unavailable. Please try again." }]);
    } finally {
      setAssistantLoading(false);
    }
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

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #39ACAC44; border-radius: 4px; }
      `}</style>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 w-72 flex flex-col transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden"
          }`}
        style={{ background: "#1A334D", borderRight: "1px solid #22405f" }}
      >
        <div className="p-4 flex items-center gap-3 border-b" style={{ borderColor: "#22405f" }}>
          <div className="flex-shrink-0">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="20" fill="#1A334D" />
              <path d="M6 28 Q20 38 34 28" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <circle cx="20" cy="18" r="11" stroke="white" strokeWidth="1.8" fill="none" />
              <path d="M20 10 C24 14 24 22 20 26 C16 22 16 14 20 10Z" fill="white" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-tight tracking-tight">
              <span style={{ color: "#ffffff" }}>Reflectiv</span>
              <span style={{ color: "#39ACAC" }}>AI</span>
            </h1>
            <p className="text-[11px] text-white/65 -mt-0.5">Sales Enablement</p>
          </div>
        </div>

        <div className="px-3 py-3 border-b" style={{ borderColor: "#22405f" }}>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-white/10 border border-white/10" ref={userMenuRef}>
            <div className="w-8 h-8 rounded-full bg-white/20 text-white text-xs font-bold flex items-center justify-center">
              {authUser?.name?.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "DU"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{authUser?.name || "Demo User"}</div>
              <div className="text-[11px] text-white/60 truncate">{authUser?.email || "demo@example.com"}</div>
            </div>
            <button onClick={() => setUserMenuOpen((v) => !v)} className="text-white/70 hover:text-white">
              <ChevronDown className={`w-4 h-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute mt-32 right-4 z-40 w-48 rounded-lg border border-slate-200 bg-white shadow-lg p-1"
                >
                  <Link to={createPageUrl("ProfileSettings")} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <UserCircle className="w-4 h-4" /> Profile Settings
                  </Link>
                  <button onClick={() => logout?.()} className="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

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
                          className={`group relative flex items-center gap-3 pl-3 pr-2 py-2 rounded-md text-sm transition-all duration-200 ${isActive
                            ? "text-white font-semibold"
                            : "text-white/60 hover:text-white hover:bg-white/10"
                            }`}
                          style={isActive ? { background: "#39ACAC" } : { border: "1px solid transparent" }}
                          onClick={() => {
                            if (window.innerWidth < 768) setSidebarOpen(false);
                          }}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {!isActive && (
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-[10px] font-semibold opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200"
                              style={{ background: "#39ACAC", color: "#ffffff", border: "1px solid #79caca" }}
                            >
                              Open
                            </span>
                          )}
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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center justify-between px-4 flex-shrink-0" style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md transition-colors" style={{ background: "transparent", color: "#6b7280" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="relative" ref={notifMenuRef}>
              <button onClick={() => setNotificationsOpen((v) => !v)} className="p-2 rounded-md transition-colors hover:bg-slate-100" style={{ color: "#64748b" }}>
                <Bell className="w-4 h-4" />
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg p-2 z-40">
                  <p className="text-xs font-semibold text-slate-500 uppercase px-2 py-1">Notifications</p>
                  <Link to={createPageUrl("RolePlaySimulator")} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700">Role Play feedback is ready to review.</Link>
                  <Link to={createPageUrl("PreCallPlanning")} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700">Pre-Call Planning tips were updated.</Link>
                  <Link to={createPageUrl("HelpCenter")} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700">Visit Help Center for platform guidance.</Link>
                </div>
              )}
            </div>
            <Link to={createPageUrl("ProfileSettings")} className="p-2 rounded-md transition-colors hover:bg-slate-100" style={{ color: "#64748b" }} title="Profile Settings">
              <User className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ background: "#f0f4f8" }}>
          {children}
        </main>
      </div>

      <button
        data-chat-trigger="true"
        onClick={() => setAssistantOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 h-16 w-16 rounded-full border-[3px] border-teal-400 bg-[#1A3F63] text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)] hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(15,23,42,0.34)] transition-all"
        aria-label="Open platform assistant"
      >
        <MessageCircle className="w-6 h-6 mx-auto" />
      </button>

      {assistantOpen && (
        <div ref={assistantRef} className="fixed bottom-24 right-5 z-50 w-[420px] max-w-[94vw] rounded-[24px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.2)] overflow-hidden">
          <div className="flex items-start justify-between gap-4 px-5 py-5 bg-[#234D86] text-white">
            <div className="flex items-center gap-4 min-w-0">
              <img
                src="/IMG_0817.jpeg"
                alt="Alora avatar"
                className="h-14 w-14 rounded-full border-2 border-white/80 object-cover shadow-md flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[18px] font-semibold leading-tight">Alora</p>
                <p className="text-sm text-white/85 leading-tight">ReflectivAI Assistant</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close assistant"
            >
              <span className="block text-2xl leading-none">×</span>
            </button>
          </div>
          <div className="h-[540px] max-h-[68vh] overflow-y-auto px-5 py-6 space-y-4 bg-white">
            {assistantMessages.map((m, idx) => (
              <div key={idx} className={`flex items-start gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <img
                    src="/IMG_0817.jpeg"
                    alt="Alora avatar"
                    className="mt-1 h-10 w-10 rounded-full border border-slate-200 object-cover shadow-sm"
                  />
                )}
                <div className={`max-w-[82%] rounded-[18px] border px-4 py-3 text-[15px] leading-8 shadow-sm ${m.role === "user" ? "bg-[#1A3F63] text-white border-[#1A3F63]" : "bg-slate-50 text-slate-700 border-slate-100"}`}>
                  <p className="leading-[1.55]">{m.content}</p>
                  {m.role === "assistant" && <p className="mt-2 text-xs leading-none text-slate-500">{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>}
                </div>
              </div>
            ))}
            {assistantLoading && <p className="text-sm text-slate-500">Thinking…</p>}
          </div>
          <div className="relative border-t border-slate-200 bg-white px-4 py-4">
            <input
              value={assistantInput}
              onChange={(e) => setAssistantInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendAssistantMessage()}
              placeholder="Ask me anything about ReflectivAI..."
              className="h-14 w-full rounded-2xl border-2 border-[#234D86] px-4 pr-16 text-[15px] text-slate-700 outline-none transition-colors placeholder:text-slate-500 focus:border-teal-500"
            />
            <div className="pointer-events-none relative -mt-14 flex justify-end pr-2">
              <button
                onClick={sendAssistantMessage}
                className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#8EA7CC] text-white shadow-sm transition-colors hover:bg-[#6E8FBC] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={assistantLoading}
                aria-label="Send assistant message"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
